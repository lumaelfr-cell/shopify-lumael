// Synthèse sonore moteur (aucun échantillon) : train d'impulsions de combustion
// à la fréquence d'allumage, filtré par des résonances fixes (échappement, carter)
// et une ligne à retard (pot de détente), puis saturé. Partagé entre l'AudioWorklet
// et le repli ScriptProcessor.

export type EngineKind = '2t-mx' | '2t-small' | '4t-mx' | '4t-big' | 'scooter-2t' | 'scooter-4t' | 'car';

interface Preset {
  firePerRev: number; // allumages par tour
  decay: number; // s (à 1000 tr/min)
  attack: number;
  noise: number;
  formants: [number, number, number][];
  direct: number;
  combMs: number;
  combFb: number;
  drive: number;
  lpBase: number;
  lpLoad: number;
  intake: number;
  skip: number; // ratés au ralenti (2T)
  pops: number; // pétarades au lever de gaz (4T)
  gain: number;
}

export const PRESETS: Record<EngineKind, Preset> = {
  '2t-mx': { firePerRev: 1, decay: 0.0026, attack: 0.00012, noise: 0.55, formants: [[360, 1.8, 1.0], [1150, 2.8, 0.7], [2700, 3.5, 0.35]], direct: 0.25, combMs: 1.45, combFb: 0.58, drive: 2.3, lpBase: 2200, lpLoad: 5200, intake: 0.12, skip: 0.22, pops: 0.0, gain: 0.85 },
  '2t-small': { firePerRev: 1, decay: 0.0019, attack: 0.0001, noise: 0.6, formants: [[520, 2.2, 1.0], [1650, 3, 0.75], [3600, 4, 0.4]], direct: 0.25, combMs: 1.05, combFb: 0.52, drive: 2.7, lpBase: 2800, lpLoad: 5200, intake: 0.14, skip: 0.28, pops: 0, gain: 0.8 },
  '4t-mx': { firePerRev: 0.5, decay: 0.0055, attack: 0.00025, noise: 0.32, formants: [[130, 1.4, 1.25], [560, 2.4, 0.55], [1450, 3, 0.28]], direct: 0.35, combMs: 3.1, combFb: 0.36, drive: 1.9, lpBase: 1100, lpLoad: 3900, intake: 0.08, skip: 0.02, pops: 0.12, gain: 1.0 },
  '4t-big': { firePerRev: 0.5, decay: 0.0075, attack: 0.0003, noise: 0.26, formants: [[92, 1.3, 1.35], [400, 2, 0.5], [1050, 3, 0.22]], direct: 0.4, combMs: 4.4, combFb: 0.3, drive: 1.7, lpBase: 850, lpLoad: 3100, intake: 0.07, skip: 0.01, pops: 0.18, gain: 1.05 },
  'scooter-2t': { firePerRev: 1, decay: 0.0016, attack: 0.0001, noise: 0.55, formants: [[720, 2.6, 1.0], [1950, 3.5, 0.6], [4300, 4, 0.3]], direct: 0.22, combMs: 0.85, combFb: 0.46, drive: 2.5, lpBase: 3000, lpLoad: 3800, intake: 0.16, skip: 0.3, pops: 0, gain: 0.7 },
  'scooter-4t': { firePerRev: 0.5, decay: 0.0034, attack: 0.0002, noise: 0.3, formants: [[260, 2, 1.0], [880, 3, 0.45], [2100, 3.5, 0.2]], direct: 0.3, combMs: 2.0, combFb: 0.3, drive: 1.6, lpBase: 1400, lpLoad: 2600, intake: 0.1, skip: 0.02, pops: 0.05, gain: 0.8 },
  car: { firePerRev: 2, decay: 0.0032, attack: 0.0003, noise: 0.25, formants: [[115, 1.2, 1.0], [380, 2, 0.4], [900, 2.5, 0.15]], direct: 0.3, combMs: 2.6, combFb: 0.2, drive: 1.2, lpBase: 600, lpLoad: 1300, intake: 0.05, skip: 0, pops: 0, gain: 0.6 },
};

class Biquad {
  b0 = 0; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  bandpass(f: number, q: number, sr: number): void {
    const w0 = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w0)) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

export interface EngineParams {
  rpm: number;
  load: number;
  vol: number;
  loud: number; // échappement 0..1
  whine: number; // fréquence de sifflement de courroie (Hz), 0 = aucun
}

export class EngineDSP {
  private sr: number;
  private p: Preset;
  private phase = 0;
  private pulseT = 1;
  private amp = 0;
  private bq: Biquad[] = [];
  private comb: Float32Array;
  private combIdx = 0;
  private lp = 0;
  private hp = 0;
  private intakeBq = new Biquad();
  private seed = 12345;
  private whinePh = 0;
  target: EngineParams = { rpm: 1500, load: 0, vol: 0, loud: 0.3, whine: 0 };
  private cur: EngineParams = { rpm: 1500, load: 0, vol: 0, loud: 0.3, whine: 0 };

  constructor(sr: number, kind: EngineKind) {
    this.sr = sr;
    this.p = PRESETS[kind];
    this.comb = new Float32Array(Math.ceil(sr * 0.02));
    this.setKind(kind);
  }

  setKind(kind: EngineKind): void {
    this.p = PRESETS[kind];
    this.bq = this.p.formants.map(([f, q]) => {
      const b = new Biquad();
      b.bandpass(f, q, this.sr);
      return b;
    });
    this.intakeBq.bandpass(2600, 1.2, this.sr);
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  render(out: Float32Array, from = 0, to = out.length): void {
    const p = this.p;
    const sr = this.sr;
    const c = this.cur, t = this.target;
    const n = to - from;
    // lissage par bloc
    const k = Math.min(1, n / (sr * 0.03));
    c.rpm += (t.rpm - c.rpm) * Math.min(1, k * 1.6);
    c.load += (t.load - c.load) * k;
    c.vol += (t.vol - c.vol) * k;
    c.loud += (t.loud - c.loud) * k;
    c.whine += (t.whine - c.whine) * k;
    const rpm = Math.max(300, c.rpm);
    const fFire = (rpm / 60) * p.firePerRev;
    const decay = p.decay * Math.max(0.35, Math.min(1.6, 1000 / rpm + 0.45));
    const combLen = Math.max(8, Math.min(this.comb.length - 1, Math.round((p.combMs / 1000) * sr * (1 + 0.15 * (1 - c.load)))));
    const drive = p.drive * (0.7 + 0.6 * c.load) * (1 + c.loud * 0.45);
    const lpHz = p.lpBase + p.lpLoad * c.load * (0.6 + 0.4 * c.loud) + rpm * 0.08;
    const lpA = 1 - Math.exp((-2 * Math.PI * Math.min(lpHz, sr * 0.45)) / sr);
    const gain = p.gain * c.vol * (0.75 + c.loud * 0.5);
    const intakeAmt = p.intake * (0.3 + 0.7 * c.load) * Math.min(1.5, rpm / 6000);
    const lowLoad = c.load < 0.12;
    for (let i = from; i < to; i++) {
      this.phase += fFire / sr;
      if (this.phase >= 1) {
        this.phase -= 1 + (this.rand() - 0.5) * 0.03;
        let a = 0.35 + 0.65 * c.load;
        if (lowLoad && this.rand() < p.skip * (rpm < 4000 ? 1 : 0.4)) a *= 0.15;
        if (lowLoad && rpm > 3500 && this.rand() < p.pops * 0.4) a *= 2.4;
        this.amp = a * (0.9 + this.rand() * 0.2);
        this.pulseT = 0;
      }
      const tt = this.pulseT;
      this.pulseT += 1 / sr;
      const env = Math.exp(-tt / decay) * (1 - Math.exp(-tt / p.attack));
      const src = this.amp * env * (1 + p.noise * (this.rand() * 2 - 1));
      let y = src * p.direct;
      for (let b = 0; b < this.bq.length; b++) y += this.bq[b].run(src) * p.formants[b][2];
      // résonateur (ligne à retard)
      let ri = this.combIdx - combLen;
      if (ri < 0) ri += this.comb.length;
      const cOut = y + p.combFb * this.comb[ri];
      this.comb[this.combIdx] = cOut;
      this.combIdx = (this.combIdx + 1) % this.comb.length;
      let z = Math.tanh(cOut * drive);
      // admission
      z += this.intakeBq.run((this.rand() * 2 - 1) * env) * intakeAmt;
      this.lp += (z - this.lp) * lpA;
      // passe-haut léger (retire le continu)
      this.hp += (this.lp - this.hp) * 0.002;
      let s = (this.lp - this.hp) * gain;
      if (c.whine > 1) {
        this.whinePh += c.whine / sr;
        if (this.whinePh > 1) this.whinePh -= 1;
        s += Math.sin(this.whinePh * Math.PI * 2) * 0.025 * c.vol;
      }
      out[i] = s;
    }
  }
}

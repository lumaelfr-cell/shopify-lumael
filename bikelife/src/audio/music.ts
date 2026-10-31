// Musique d'ambiance procédurale (originale) : séquenceur Web Audio façon
// trap / boom-bap — kick, caisse claire, charleston, basse 808, nappes.

export class Music {
  playing = false;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 140;
  private style = 0;
  private bar = 0;
  private noise: AudioBuffer;
  private out: GainNode;
  readonly styles = ['Trap nocturne', 'Boom bap', 'Drill'];

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.6;
    this.out.connect(dest);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get styleName(): string {
    return this.styles[this.style];
  }

  setStyle(i: number): void {
    this.style = ((i % this.styles.length) + this.styles.length) % this.styles.length;
    this.bpm = [140, 90, 144][this.style];
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const spb = 60 / this.bpm / 4; // double-croche
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % 8;
    }
  }

  private playStep(s: number, t: number, spb: number): void {
    const prog = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]]; // la mineur, fa, sol, mi
    const chord = prog[Math.floor(this.bar / 2) % 4];
    const root = 45; // A2
    const st = this.style;
    // kick
    const kicks = st === 1 ? [0, 7, 10] : st === 2 ? [0, 6, 11] : [0, 10, 13];
    if (kicks.includes(s)) this.kick(t);
    // caisse claire / clap
    if (s === (st === 1 ? 4 : 8) || (st === 1 && s === 12)) this.snare(t);
    // charleston
    if (st === 1) {
      if (s % 2 === 0) this.hat(t, 0.05);
    } else {
      if (s % 2 === 0 || (this.bar % 2 === 1 && s >= 12)) this.hat(t, 0.035);
      if (this.bar % 4 === 3 && s >= 12) this.hat(t + spb / 2, 0.03);
    }
    // basse 808
    const bassSteps = st === 1 ? [0, 7, 10] : [0, 10, 13];
    if (bassSteps.includes(s)) this.bass(t, root + chord[0] - 12, spb * (st === 1 ? 3 : 5));
    // nappes
    if (s === 0 && this.bar % 2 === 0) for (const n of chord) this.pad(t, root + 12 + n, spb * 30);
    // mélodie pluck
    if (st !== 1 && this.bar >= 4 && [2, 5, 9, 14].includes(s)) this.pluck(t, root + 24 + chord[(s + this.bar) % 3]);
  }

  private mtof(m: number): number {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.4);
  }

  private snare(t: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.2);
  }

  private hat(t: number, dur: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private bass(t: number, note: number, dur: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const fr = this.mtof(note);
    o.frequency.setValueAtTime(fr * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(fr, t + 0.05);
    const sh = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    sh.curve = curve;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(sh).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(t: number, note: number, dur: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = this.mtof(note);
    o.detune.value = (Math.random() - 0.5) * 12;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pluck(t: number, note: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = this.mtof(note);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }
}

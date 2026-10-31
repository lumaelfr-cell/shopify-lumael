// Gestionnaire audio : moteurs (AudioWorklet, repli ScriptProcessor), pneus,
// vent, ambiance urbaine, pluie, chocs, klaxons, interface et musique.

import { EngineDSP, EngineKind, EngineParams } from './engineDSP';
import workletUrl from './engineWorklet.ts?worker&url';
import { Music } from './music';
import { clamp } from '../core/math';

export interface Volumes {
  master: number;
  engine: number;
  sfx: number;
  music: number;
  ambience: number;
}

export class EngineVoice {
  node: AudioNode;
  out: GainNode;
  panner: PannerNode | null = null;
  private port: MessagePort | null = null;
  private dsp: EngineDSP | null = null;
  constructor(private ctx: AudioContext, kind: EngineKind, useWorklet: boolean, spatial: boolean) {
    this.out = ctx.createGain();
    if (useWorklet) {
      const n = new AudioWorkletNode(ctx, 'engine-processor', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { kind } });
      this.port = n.port;
      this.node = n;
    } else {
      const sp = ctx.createScriptProcessor(1024, 0, 1);
      const dsp = new EngineDSP(ctx.sampleRate, kind);
      sp.onaudioprocess = (e) => dsp.render(e.outputBuffer.getChannelData(0));
      this.dsp = dsp;
      this.node = sp;
    }
    if (spatial) {
      this.panner = new PannerNode(ctx, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 6, maxDistance: 400, rolloffFactor: 1.4 });
      this.node.connect(this.panner).connect(this.out);
    } else this.node.connect(this.out);
  }
  setKind(kind: EngineKind): void {
    if (this.port) this.port.postMessage({ kind });
    else this.dsp?.setKind(kind);
  }
  set(p: Partial<EngineParams>): void {
    if (this.port) this.port.postMessage({ p });
    else if (this.dsp) Object.assign(this.dsp.target, p);
  }
  setPos(x: number, y: number, z: number): void {
    if (!this.panner) return;
    const t = this.ctx.currentTime;
    this.panner.positionX.setTargetAtTime(x, t, 0.05);
    this.panner.positionY.setTargetAtTime(y, t, 0.05);
    this.panner.positionZ.setTargetAtTime(z, t, 0.05);
  }
  dispose(): void {
    try {
      this.node.disconnect();
      this.out.disconnect();
    } catch {
      /* déjà déconnecté */
    }
  }
}

export class AudioManager {
  ctx: AudioContext | null = null;
  ready = false;
  private master!: GainNode;
  private buses!: Record<keyof Omit<Volumes, 'master'>, GainNode>;
  private worklet = false;
  player: EngineVoice | null = null;
  traffic: EngineVoice[] = [];
  remote: EngineVoice[] = [];
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  private loops: Record<string, { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }> = {};
  music: Music | null = null;
  vol: Volumes = { master: 0.8, engine: 0.9, sfx: 0.8, music: 0.45, ambience: 0.6 };
  musicOn = true;
  private initPromise: Promise<void> | null = null;
  private lastEvent = 0;

  /** À appeler depuis un geste utilisateur (exigence des navigateurs). */
  init(): Promise<void> {
    if (this.initPromise) {
      this.ctx?.resume();
      return this.initPromise;
    }
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.buses = {
      engine: ctx.createGain(), sfx: ctx.createGain(), music: ctx.createGain(), ambience: ctx.createGain(),
    };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    try {
      if (ctx.audioWorklet) {
        await ctx.audioWorklet.addModule(workletUrl);
        this.worklet = true;
      }
    } catch (e) {
      console.warn('[audio] AudioWorklet indisponible, repli ScriptProcessor', e);
      this.worklet = false;
    }
    // bruits
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bd[i] = last * 3.5;
    }
    this.makeLoop('skid', this.noise, 'bandpass', 1300, 2.5, 'sfx');
    this.makeLoop('roost', this.brown, 'lowpass', 900, 0.7, 'sfx');
    this.makeLoop('wind', this.noise, 'lowpass', 400, 0.5, 'sfx');
    this.makeLoop('city', this.brown, 'lowpass', 320, 0.5, 'ambience');
    this.makeLoop('rain', this.noise, 'highpass', 2500, 0.4, 'ambience');
    this.makeLoop('scrape', this.noise, 'bandpass', 3800, 3, 'sfx');
    this.music = new Music(ctx, this.buses.music);
    this.applyVolumes();
    this.ready = true;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  private makeLoop(name: string, buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, bus: keyof AudioManager['buses']): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = f;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.buses[bus]);
    src.start();
    this.loops[name] = { src, gain, filter };
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.buses.engine.gain.setTargetAtTime(this.vol.engine, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.buses.music.gain.setTargetAtTime(this.musicOn ? this.vol.music : 0, t, 0.05);
    this.buses.ambience.gain.setTargetAtTime(this.vol.ambience, t, 0.05);
  }

  setPlayerEngine(kind: EngineKind): void {
    if (!this.ready || !this.ctx) return;
    if (!this.player) {
      this.player = new EngineVoice(this.ctx, kind, this.worklet, false);
      this.player.out.connect(this.buses.engine);
    } else this.player.setKind(kind);
  }

  ensureTrafficVoices(n: number): void {
    if (!this.ready || !this.ctx) return;
    while (this.traffic.length < n) {
      const v = new EngineVoice(this.ctx, 'car', this.worklet, true);
      v.out.connect(this.buses.engine);
      v.out.gain.value = 0.7;
      this.traffic.push(v);
    }
  }

  ensureRemoteVoices(n: number, kinds: EngineKind[]): void {
    if (!this.ready || !this.ctx) return;
    while (this.remote.length < n) {
      const v = new EngineVoice(this.ctx, kinds[this.remote.length] ?? '4t-mx', this.worklet, true);
      v.out.connect(this.buses.engine);
      this.remote.push(v);
    }
  }

  setListener(x: number, y: number, z: number, fx: number, fz: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.05);
      l.positionY.setTargetAtTime(y, t, 0.05);
      l.positionZ.setTargetAtTime(z, t, 0.05);
      l.forwardX.setTargetAtTime(fx, t, 0.05);
      l.forwardY.setTargetAtTime(0, t, 0.05);
      l.forwardZ.setTargetAtTime(fz, t, 0.05);
    } else {
      (l as any).setPosition(x, y, z);
      (l as any).setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  /** Mise à jour continue des boucles (pneus, vent, ambiance, pluie). */
  updateLoops(p: { skid: number; skidLoose: boolean; speed: number; city: number; rain: number; scrape: number; night: number }): void {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const L = this.loops;
    const set = (n: string, g: number, f?: number) => {
      L[n].gain.gain.setTargetAtTime(g, t, 0.06);
      if (f) L[n].filter.frequency.setTargetAtTime(f, t, 0.08);
    };
    set('skid', p.skidLoose ? 0 : clamp(p.skid, 0, 1) * 0.5, 1100 + p.speed * 18);
    set('roost', p.skidLoose ? clamp(p.skid, 0, 1) * 0.9 : 0);
    set('wind', clamp((p.speed - 8) / 40, 0, 1) * 0.35, 300 + p.speed * 25);
    set('city', p.city * (0.55 - p.night * 0.25));
    set('rain', p.rain * 0.35);
    set('scrape', clamp(p.scrape, 0, 1) * 0.4);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private noiseBurst(dur: number, type: BiquadFilterType, f: number, q: number, peak: number, bus: 'sfx' | 'ambience' = 'sfx', attack = 0.005): void {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, attack, peak, dur);
    src.connect(fl).connect(g).connect(this.buses[bus]);
    src.start(t, Math.random());
    src.stop(t + dur + 0.1);
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number, delay = 0, bus: 'sfx' | 'music' = 'sfx'): void {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, peak, dur);
    o.connect(g).connect(this.buses[bus]);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  land(impact: number): void {
    const a = clamp(impact / 7, 0.1, 1);
    this.tone(70, 0.25, 'sine', 0.6 * a, 38);
    this.noiseBurst(0.18, 'lowpass', 600, 0.7, 0.35 * a);
    if (impact > 3) this.noiseBurst(0.08, 'bandpass', 2400, 4, 0.12 * a); // suspension qui talonne
  }

  crash(): void {
    this.noiseBurst(0.6, 'lowpass', 1800, 0.6, 0.8);
    this.noiseBurst(0.35, 'bandpass', 3200, 6, 0.4);
    this.tone(55, 0.5, 'triangle', 0.5, 30);
    for (let i = 0; i < 4; i++) this.tone(900 + Math.random() * 1500, 0.08, 'square', 0.06, 400, 0.08 + i * 0.09);
  }

  shift(): void {
    this.noiseBurst(0.03, 'bandpass', 1800, 8, 0.12);
  }

  backfire(): void {
    const now = performance.now();
    if (now - this.lastEvent < 120) return;
    this.lastEvent = now;
    this.noiseBurst(0.07, 'lowpass', 900, 0.8, 0.5);
    this.tone(120, 0.06, 'square', 0.15, 60);
  }

  horn(car: boolean, dist = 0): void {
    const g = car ? clamp(1 - dist / 120, 0, 1) * 0.25 : 0.3;
    if (g <= 0.01) return;
    const f = car ? 360 + Math.random() * 80 : 480;
    this.tone(f, car ? 0.45 : 0.3, 'sawtooth', g);
    this.tone(f * 1.26, car ? 0.45 : 0.3, 'sawtooth', g * 0.7);
  }

  ui(kind: 'click' | 'buy' | 'error' | 'select' = 'click'): void {
    if (kind === 'click') this.tone(900, 0.05, 'triangle', 0.15);
    else if (kind === 'select') this.tone(1300, 0.06, 'sine', 0.12);
    else if (kind === 'buy') {
      this.tone(880, 0.1, 'triangle', 0.18);
      this.tone(1320, 0.18, 'triangle', 0.16, undefined, 0.08);
    } else this.tone(180, 0.18, 'square', 0.1);
  }

  money(): void {
    [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, undefined, i * 0.06));
  }

  combo(mult: number): void {
    this.tone(500 + mult * 90, 0.12, 'square', 0.07);
  }

  record(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, undefined, i * 0.09));
  }

  beep(high = false): void {
    this.tone(high ? 1320 : 660, high ? 0.35 : 0.15, 'square', 0.12);
  }

  checkpoint(): void {
    this.tone(1046, 0.08, 'sine', 0.2);
    this.tone(1568, 0.14, 'sine', 0.18, undefined, 0.07);
  }

  fail(): void {
    this.tone(330, 0.2, 'sawtooth', 0.12, 160);
  }

  suspend(): void {
    this.ctx?.suspend();
  }

  resume(): void {
    this.ctx?.resume();
  }
}

export const audio = new AudioManager();

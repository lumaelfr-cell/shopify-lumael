// Modes de jeu : balade libre, wheeling (records), session stunt chronométrée,
// défis (médailles bronze/argent/or) et contre-la-montre avec fantôme.

import type { BikePhysics } from '../physics/bikePhysics';
import type { Progression } from './progression';
import type { ChallengeDef, Gate, TimeTrialDef } from '../data/challenges';
import { formatTime } from '../core/math';

export interface ModeContext {
  bike: () => BikePhysics;
  prog: Progression;
  teleport: (x: number, z: number, yaw: number, y?: number) => void;
  notify: (text: string, kind?: 'info' | 'good' | 'bad' | 'gold') => void;
  showResult: (r: ModeResult) => void;
  setGates: (gates: Gate[] | null, current: number) => void;
  beep: (high: boolean) => void;
  checkpointSound: () => void;
  ghost: { record: (t: number) => void; startPlayback: (data: number[] | null) => void; stopPlayback: () => void; data: () => number[] };
  freeze: (on: boolean) => void;
}

export interface ModeHud {
  title: string;
  timer?: string;
  lines: string[];
  big?: string;
}

export interface ModeResult {
  title: string;
  lines: string[];
  medal: 0 | 1 | 2 | 3;
  reward: number;
  retry: () => void;
}

export abstract class GameMode {
  abstract id: string;
  abstract name: string;
  finished = false;
  constructor(protected ctx: ModeContext) {}
  start(): void {}
  update(_dt: number): void {}
  onTrick(_kind: string, _value: number, _extra?: Record<string, number>): void {}
  onCombo(_points: number): void {}
  onCrash(): void {}
  end(): void {
    this.ctx.setGates(null, 0);
  }
  hud(): ModeHud | null {
    return null;
  }
}

export class FreeRide extends GameMode {
  id = 'free';
  name = 'Balade libre';
}

export class WheelieMode extends GameMode {
  id = 'wheelie';
  name = 'Mode wheeling';
  private last = 0;
  private attempts = 0;
  private best = 0;
  constructor(ctx: ModeContext, private where: { x: number; z: number; yaw: number; name: string }) {
    super(ctx);
  }
  start(): void {
    this.ctx.teleport(this.where.x, this.where.z, this.where.yaw);
    this.ctx.notify(`${this.where.name} : lève la roue et va le plus loin possible !`, 'info');
  }
  onTrick(kind: string, value: number, extra?: Record<string, number>): void {
    if (kind !== 'wheelie' || value < 5) return;
    this.attempts++;
    this.last = value;
    this.best = Math.max(this.best, value);
    const rec = this.ctx.prog.p.records.wheelieDist ?? 0;
    this.ctx.notify(`Wheeling : ${value.toFixed(1)} m en ${(extra?.time ?? 0).toFixed(1)} s${value >= rec ? ' — RECORD !' : ''}`, value >= rec ? 'gold' : 'good');
  }
  hud(): ModeHud {
    const p = this.ctx.prog.p;
    return {
      title: 'MODE WHEELING',
      lines: [`Record : ${(p.records.wheelieDist ?? 0).toFixed(1)} m · ${(p.records.wheelieTime ?? 0).toFixed(1)} s`, `Dernier : ${this.last.toFixed(1)} m · Meilleur session : ${this.best.toFixed(1)} m`, `Essais : ${this.attempts}`],
    };
  }
}

export class StuntSession extends GameMode {
  id = 'stunt';
  name = 'Session stunt';
  private time = 120;
  private score = 0;
  private started = false;
  constructor(ctx: ModeContext, private where: { x: number; z: number; yaw: number }) {
    super(ctx);
  }
  start(): void {
    this.ctx.teleport(this.where.x, this.where.z, this.where.yaw);
    this.ctx.notify('Session stunt : 2 minutes pour le plus gros score. Enchaîne les figures !', 'info');
    this.started = true;
  }
  onCombo(points: number): void {
    if (!this.finished) this.score += points;
  }
  update(dt: number): void {
    if (!this.started || this.finished) return;
    this.time -= dt;
    if (this.time <= 0) {
      this.finished = true;
      const th = [5000, 15000, 32000];
      const medal = (this.score >= th[2] ? 3 : this.score >= th[1] ? 2 : this.score >= th[0] ? 1 : 0) as 0 | 1 | 2 | 3;
      const reward = [150, 1000, 2200, 4000][medal];
      const rec = this.ctx.prog.record('stuntSession', this.score, 'Session stunt', 'pts');
      this.ctx.showResult({
        title: 'Session stunt terminée',
        lines: [`Score : ${this.score.toLocaleString('fr-FR')} pts${rec ? ' — NOUVEAU RECORD' : ''}`, `Bronze ${th[0].toLocaleString('fr-FR')} · Argent ${th[1].toLocaleString('fr-FR')} · Or ${th[2].toLocaleString('fr-FR')}`],
        medal, reward,
        retry: () => {
          this.time = 120;
          this.score = 0;
          this.finished = false;
          this.start();
        },
      });
    }
  }
  hud(): ModeHud {
    return { title: 'SESSION STUNT', timer: formatTime(Math.max(0, this.time)), lines: [`Score : ${this.score.toLocaleString('fr-FR')}`, `Record : ${(this.ctx.prog.p.records.stuntSession ?? 0).toLocaleString('fr-FR')}`] };
  }
}

export class ChallengeMode extends GameMode {
  id = 'challenge';
  name: string;
  private value = 0;
  private time = 0;
  private countdown = 3.5;
  private gateIdx = 0;
  private lastBeep = 4;
  private comboBest = 0;
  constructor(ctx: ModeContext, private def: ChallengeDef) {
    super(ctx);
    this.name = def.name;
  }
  start(): void {
    const d = this.def;
    this.ctx.teleport(d.start.x, d.start.z, d.start.yaw, d.start.y);
    this.value = 0;
    this.time = 0;
    this.countdown = 3.5;
    this.gateIdx = 0;
    this.finished = false;
    this.lastBeep = 4;
    this.ctx.freeze(true);
    if (d.gates) this.ctx.setGates(d.gates, 0);
  }
  private higherBetter(): boolean {
    return this.def.metric !== 'checkpoints';
  }
  onTrick(kind: string, value: number, extra?: Record<string, number>): void {
    if (this.countdown > 0 || this.finished) return;
    const m = this.def.metric;
    const set = (v: number) => (this.value = Math.max(this.value, v));
    if (kind === 'wheelie') {
      if (m === 'wheelieDist') set(value);
      if (m === 'wheelieTime') set(extra?.time ?? 0);
      if (m === 'highWheelie') set(extra?.highTime ?? 0);
    } else if (kind === 'stoppie' && m === 'stoppieDist') set(value);
    else if (kind === 'air') {
      if (m === 'airTime') set(value);
      if (m === 'jumpDist') set(extra?.dist ?? 0);
      if (m === 'airTricks') this.value += extra?.tricks ?? 0;
    } else if (kind === 'drift' && m === 'driftTime') this.value += value;
    else if (kind === 'nearmiss' && m === 'nearMiss') this.value += 1;
  }
  onCombo(points: number): void {
    if (this.def.metric === 'comboPoints' && this.countdown <= 0) this.value = Math.max(this.value, points);
  }
  update(dt: number): void {
    if (this.finished) return;
    if (this.countdown > 0) {
      this.countdown -= dt;
      const sec = Math.ceil(this.countdown);
      if (sec < this.lastBeep && sec >= 0) {
        this.lastBeep = sec;
        this.ctx.beep(sec === 0);
      }
      if (this.countdown <= 0) this.ctx.freeze(false);
      return;
    }
    this.time += dt;
    const b = this.ctx.bike();
    if (this.def.metric === 'topSpeed') this.value = Math.max(this.value, b.kmh);
    if (this.def.metric === 'checkpoints' && this.def.gates) {
      const gt = this.def.gates[this.gateIdx];
      if (Math.hypot(b.x - gt.x, b.z - gt.z) < gt.r && Math.abs(b.y - b.comHeight - gt.y) < 3.5) {
        this.gateIdx++;
        this.ctx.checkpointSound();
        if (this.gateIdx >= this.def.gates.length) {
          this.value = this.time;
          this.finish();
          return;
        }
        this.ctx.setGates(this.def.gates, this.gateIdx);
      }
    }
    if (this.time >= this.def.timeLimit) this.finish();
  }
  private finish(): void {
    this.finished = true;
    this.ctx.setGates(null, 0);
    const d = this.def;
    const hb = this.higherBetter();
    const v = d.metric === 'checkpoints' && this.gateIdx < (d.gates?.length ?? 0) ? Infinity : this.value;
    let medal = 0;
    for (let i = 0; i < 3; i++) if (hb ? v >= d.thresholds[i] : v <= d.thresholds[i]) medal = i + 1;
    const prev = this.ctx.prog.p.challenges[d.id] ?? 0;
    let reward = 0;
    if (medal > prev) {
      for (let i = prev; i < medal; i++) reward += d.rewards[i];
      this.ctx.prog.p.challenges[d.id] = medal;
      if (prev === 0) this.ctx.prog.stat('challengesDone', 1);
    } else if (medal > 0) reward = Math.round(d.rewards[medal - 1] * 0.15);
    const shown = v === Infinity ? 'non terminé' : `${v.toFixed(d.unit === 'pts' || d.unit === '' || d.unit === 'figures' ? 0 : 1)} ${d.unit}`;
    this.ctx.showResult({
      title: d.name,
      lines: [`Résultat : ${shown}`, `Bronze ${d.thresholds[0]} · Argent ${d.thresholds[1]} · Or ${d.thresholds[2]} ${d.unit}`, medal > prev ? 'Nouvelle médaille !' : prev ? `Meilleure médaille : ${['', 'bronze', 'argent', 'or'][prev]}` : ''],
      medal: medal as 0 | 1 | 2 | 3,
      reward,
      retry: () => this.start(),
    });
  }
  hud(): ModeHud {
    const d = this.def;
    const hb = this.higherBetter();
    const shown = d.metric === 'checkpoints' ? `Porte ${Math.min(this.gateIdx + 1, d.gates!.length)}/${d.gates!.length}` : `${this.value.toFixed(d.unit === 'pts' || d.unit === '' || d.unit === 'figures' ? 0 : 1)} ${d.unit}`;
    return {
      title: d.name.toUpperCase(),
      timer: this.countdown > 0 ? undefined : formatTime(hb ? Math.max(0, d.timeLimit - this.time) : this.time),
      big: this.countdown > 0 ? (Math.ceil(this.countdown) > 0 ? String(Math.ceil(this.countdown)) : 'GO !') : undefined,
      lines: [d.desc, shown, `Objectifs : ${d.thresholds.join(' / ')} ${d.unit}`],
    };
  }
}

export class TimeTrial extends GameMode {
  id = 'timetrial';
  name: string;
  private time = 0;
  private countdown = 3.5;
  private gateIdx = 0;
  private lastBeep = 4;
  private recT = 0;
  constructor(ctx: ModeContext, private def: TimeTrialDef) {
    super(ctx);
    this.name = def.name;
  }
  start(): void {
    const d = this.def;
    this.ctx.teleport(d.start.x, d.start.z, d.start.yaw);
    this.time = 0;
    this.countdown = 3.5;
    this.gateIdx = 0;
    this.finished = false;
    this.lastBeep = 4;
    this.ctx.freeze(true);
    this.ctx.setGates(d.gates, 0);
    this.ctx.ghost.startPlayback(this.ctx.prog.p.ghosts[d.id] ?? null);
  }
  update(dt: number): void {
    if (this.finished) return;
    if (this.countdown > 0) {
      this.countdown -= dt;
      const sec = Math.ceil(this.countdown);
      if (sec < this.lastBeep && sec >= 0) {
        this.lastBeep = sec;
        this.ctx.beep(sec === 0);
      }
      if (this.countdown <= 0) this.ctx.freeze(false);
      return;
    }
    this.time += dt;
    this.recT += dt;
    if (this.recT >= 0.1) {
      this.recT = 0;
      this.ctx.ghost.record(this.time);
    }
    const b = this.ctx.bike();
    const gt = this.def.gates[this.gateIdx];
    if (Math.hypot(b.x - gt.x, b.z - gt.z) < gt.r && Math.abs(b.y - b.comHeight - gt.y) < 4) {
      this.gateIdx++;
      this.ctx.checkpointSound();
      if (this.gateIdx >= this.def.gates.length) return this.finish();
      this.ctx.setGates(this.def.gates, this.gateIdx);
    }
    if (this.time > this.def.medals[0] * 2.5) {
      this.finished = true;
      this.ctx.setGates(null, 0);
      this.ctx.ghost.stopPlayback();
      this.ctx.showResult({ title: this.def.name, lines: ['Temps limite dépassé.'], medal: 0, reward: 0, retry: () => this.start() });
    }
  }
  private finish(): void {
    this.finished = true;
    this.ctx.setGates(null, 0);
    this.ctx.ghost.stopPlayback();
    const d = this.def;
    const t = this.time;
    const prevBest = this.ctx.prog.p.timeTrials[d.id];
    const better = prevBest === undefined || t < prevBest;
    if (better) {
      this.ctx.prog.p.timeTrials[d.id] = t;
      this.ctx.prog.p.ghosts[d.id] = this.ctx.ghost.data();
      this.ctx.prog.save();
    }
    let medal = 0;
    for (let i = 0; i < 3; i++) if (t <= d.medals[i]) medal = i + 1;
    const prevMedal = this.ctx.prog.p.challenges[d.id] ?? 0;
    let reward = 0;
    if (medal > prevMedal) {
      for (let i = prevMedal; i < medal; i++) reward += d.rewards[i];
      this.ctx.prog.p.challenges[d.id] = medal;
    } else if (medal > 0) reward = Math.round(d.rewards[medal - 1] * 0.15);
    this.ctx.showResult({
      title: d.name,
      lines: [`Temps : ${formatTime(t)}${better ? ' — MEILLEUR TEMPS' : ''}`, prevBest !== undefined ? `Précédent : ${formatTime(prevBest)}` : 'Premier temps enregistré', `Or ${formatTime(d.medals[2])} · Argent ${formatTime(d.medals[1])} · Bronze ${formatTime(d.medals[0])}`],
      medal: medal as 0 | 1 | 2 | 3,
      reward,
      retry: () => this.start(),
    });
  }
  end(): void {
    super.end();
    this.ctx.ghost.stopPlayback();
  }
  hud(): ModeHud {
    const best = this.ctx.prog.p.timeTrials[this.def.id];
    return {
      title: this.def.name.toUpperCase(),
      timer: formatTime(this.time),
      big: this.countdown > 0 ? (Math.ceil(this.countdown) > 0 ? String(Math.ceil(this.countdown)) : 'GO !') : undefined,
      lines: [`Porte ${Math.min(this.gateIdx + 1, this.def.gates.length)}/${this.def.gates.length}`, best !== undefined ? `Meilleur : ${formatTime(best)} (fantôme bleu)` : 'Pas encore de temps'],
    };
  }
}

// Détection des figures et calcul du score : wheeling (distance, durée, angle,
// vitesse), stoppie, sauts (temps de vol, distance, figures freestyle, whip,
// flips), dérapages, burn, frottement de barre de 12h, frôlements. Les figures
// s'enchaînent en combo avec multiplicateur ; une chute fait perdre le combo.

import type { BikePhysics } from '../physics/bikePhysics';
import type { TrickName } from '../vehicle/rider';
import { events } from '../core/events';
import { clamp, DEG, RAD } from '../core/math';

export const AIR_TRICKS: { name: TrickName; label: string; points: number; dur: number }[] = [
  { name: 'nohander', label: 'No Hander', points: 400, dur: 0.9 },
  { name: 'superman', label: 'Superman', points: 650, dur: 1.1 },
  { name: 'nacnac', label: 'Nac Nac', points: 500, dur: 1.0 },
  { name: 'heelclicker', label: 'Heel Clicker', points: 550, dur: 1.0 },
  { name: 'cancan', label: 'Can Can', points: 450, dur: 0.9 },
];

export interface LiveTrick {
  label: string;
  points: number;
  sub: string;
}

export class TrickSystem {
  // wheeling
  wheelie = { active: false, dist: 0, time: 0, maxAngle: 0, yawAcc: 0, highTime: 0, pts: 0, prevYaw: 0, grace: 0 };
  stoppie = { active: false, dist: 0, time: 0, pts: 0, grace: 0 };
  air = { active: false, time: 0, x0: 0, z0: 0, y0: 0, maxY: 0, pitchAcc: 0, tricks: [] as string[], pts: 0, whip: 0 };
  drift = { active: false, time: 0, maxAngle: 0, pts: 0, calm: 0 };
  burn = { active: false, time: 0, pts: 0 };
  scrape = { time: 0, pts: 0 };
  // figure aérienne en cours (pose du pilote)
  trickPose: { name: TrickName; t: number; dur: number; label: string; points: number } | null = null;
  // combo
  combo = { active: false, points: 0, mult: 1, tricks: [] as string[], timer: 0, kinds: new Set<string>() };
  live: LiveTrick | null = null;
  enabled = true;
  /** pour les modes (défis) */
  onTrickEnd: ((kind: string, value: number, extra?: Record<string, number>) => void) | null = null;
  private lastSpeed = 0;
  private landTimer = 0;
  private pendingAirBank = 0;

  reset(): void {
    this.wheelie.active = this.stoppie.active = this.air.active = this.drift.active = this.burn.active = false;
    this.trickPose = null;
    this.combo = { active: false, points: 0, mult: 1, tricks: [], timer: 0, kinds: new Set() };
    this.live = null;
    this.pendingAirBank = 0;
  }

  /** Démarre une figure aérienne (bouton figure + direction). */
  startAirTrick(dir: { x: number; y: number }, bike: BikePhysics): void {
    if (!bike.airborne || this.trickPose || bike.airTime < 0.12) return;
    let t = AIR_TRICKS[0];
    if (dir.y > 0.5) t = AIR_TRICKS[1];
    else if (dir.y < -0.5) t = AIR_TRICKS[3];
    else if (dir.x < -0.5) t = AIR_TRICKS[2];
    else if (dir.x > 0.5) t = AIR_TRICKS[4];
    this.trickPose = { name: t.name, t: 0, dur: t.dur, label: t.label, points: t.points };
    events.emit('trickStart', { name: t.label });
  }

  private addToCombo(label: string, kind: string, points: number): void {
    if (points <= 0) return;
    const c = this.combo;
    if (!c.active) {
      c.active = true;
      c.points = 0;
      c.tricks = [];
      c.kinds = new Set();
    }
    c.points += points;
    c.tricks.push(label);
    c.kinds.add(kind);
    c.mult = Math.min(10, c.tricks.length);
    c.timer = 2.2;
    events.emit('trickLanded', { name: label, points: Math.round(points) });
  }

  private bankCombo(): void {
    const c = this.combo;
    if (!c.active) return;
    const total = Math.round(c.points * c.mult);
    const money = Math.round(total / 9);
    const xp = Math.round(total / 4);
    events.emit('comboBanked', { points: total, multiplier: c.mult, tricks: [...c.tricks], money, xp });
    c.active = false;
    c.points = 0;
    c.tricks = [];
  }

  loseCombo(): void {
    if (this.combo.active) events.emit('comboLost', { points: Math.round(this.combo.points * this.combo.mult) });
    this.combo.active = false;
    this.combo.points = 0;
    this.combo.tricks = [];
    this.trickPose = null;
    this.wheelie.active = this.stoppie.active = this.air.active = this.drift.active = this.burn.active = false;
    this.live = null;
    this.pendingAirBank = 0;
  }

  /** Points de combo en cours (affichage). */
  get comboTotal(): number {
    return Math.round(this.combo.points * this.combo.mult);
  }

  update(dt: number, b: BikePhysics, frontBrake: number, nearMiss: boolean): void {
    if (!this.enabled || b.crashed) return;
    const kmh = b.kmh;
    const ds = b.speed * dt;
    const pitchDeg = b.pitch * RAD;
    let anyActive = false;
    this.live = null;

    // ---------------- wheeling
    const W = this.wheelie;
    const inWheelie = b.state === 'wheelie' && pitchDeg > 6 && b.speed > 1.5;
    if (inWheelie) {
      if (!W.active) {
        Object.assign(W, { active: true, dist: 0, time: 0, maxAngle: 0, yawAcc: 0, highTime: 0, pts: 0, prevYaw: b.yaw, grace: 0 });
      }
      W.grace = 0;
      W.dist += ds;
      W.time += dt;
      W.maxAngle = Math.max(W.maxAngle, pitchDeg);
      let dy = b.yaw - W.prevYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      W.yawAcc += dy;
      W.prevYaw = b.yaw;
      if (pitchDeg > 62) W.highTime += dt;
      const angleF = 1 + clamp((pitchDeg - 10) / 35, 0, 1.3);
      const speedF = 0.6 + Math.min(kmh, 140) / 80;
      W.pts += ds * 10 * angleF * speedF * (pitchDeg > 62 ? 1.5 : 1);
      anyActive = true;
    } else if (W.active) {
      // petite tolérance : la roue avant qui effleure le sol ne coupe pas tout de suite
      W.grace += dt;
      if (W.grace > 0.12 || b.state === 'air' || b.speed < 1) {
        W.active = false;
        if (W.dist > 3) {
          const circle = Math.abs(W.yawAcc) > 5.2;
          let label = `Wheeling ${W.dist.toFixed(0)} m`;
          if (W.highTime > 1) label = `12h ${W.dist.toFixed(0)} m`;
          if (circle) label = `Circle wheeling ${Math.round((Math.abs(W.yawAcc) * RAD) / 360 * 10) / 10} tour(s)`;
          this.addToCombo(label, circle ? 'circle' : W.highTime > 1 ? '12h' : 'wheelie', W.pts + (circle ? 800 : 0));
          events.emit('wheelieEnd', { distance: W.dist, time: W.time, maxAngle: W.maxAngle });
          this.onTrickEnd?.('wheelie', W.dist, { time: W.time, maxAngle: W.maxAngle, highTime: W.highTime });
        }
      } else anyActive = true;
    }
    if (W.active) this.live = { label: W.highTime > 1 ? '12 HEURES' : Math.abs(W.yawAcc) > 3 ? 'CIRCLE' : 'WHEELING', points: W.pts, sub: `${W.dist.toFixed(1)} m · ${W.time.toFixed(1)} s · ${pitchDeg.toFixed(0)}°` };

    // ---------------- stoppie
    const S = this.stoppie;
    const inStoppie = b.state === 'stoppie' && pitchDeg < -4 && b.speed > 1;
    if (inStoppie) {
      if (!S.active) Object.assign(S, { active: true, dist: 0, time: 0, pts: 0, grace: 0 });
      S.grace = 0;
      S.dist += ds;
      S.time += dt;
      S.pts += ds * 22;
      anyActive = true;
      this.live = { label: 'STOPPIE', points: S.pts, sub: `${S.dist.toFixed(1)} m` };
    } else if (S.active) {
      S.grace += dt;
      if (S.grace > 0.1) {
        S.active = false;
        if (S.dist > 1.5) {
          this.addToCombo(`Stoppie ${S.dist.toFixed(1)} m`, 'stoppie', S.pts);
          events.emit('stoppieEnd', { distance: S.dist, time: S.time });
          this.onTrickEnd?.('stoppie', S.dist);
        }
      } else anyActive = true;
    }

    // ---------------- sauts
    const A = this.air;
    if (b.state === 'air') {
      if (!A.active) Object.assign(A, { active: true, time: 0, x0: b.x, z0: b.z, y0: b.y, maxY: b.y, pitchAcc: 0, tricks: [], pts: 0, whip: 0 });
      A.time += dt;
      A.maxY = Math.max(A.maxY, b.y);
      A.pitchAcc += b.pitchVel * dt;
      A.whip = Math.max(A.whip, Math.abs(b.airRoll));
      anyActive = true;
      // figure en cours
      const tp = this.trickPose;
      if (tp) {
        tp.t += dt;
        if (tp.t >= tp.dur) {
          A.tricks.push(tp.label);
          A.pts += tp.points;
          this.trickPose = null;
        }
      }
      if (A.time > 0.3 || tp) this.live = { label: tp ? tp.label.toUpperCase() : 'AIR', points: A.pts + A.time * 150, sub: `${A.time.toFixed(2)} s · ${(A.maxY - A.y0 + 0.3).toFixed(1)} m` };
    } else if (A.active) {
      A.active = false;
      const dist = Math.hypot(b.x - A.x0, b.z - A.z0);
      const height = A.maxY - Math.min(A.y0, b.y);
      if (A.time > 0.45) {
        let pts = A.pts + A.time * 150 + height * 60;
        const labels: string[] = [...A.tricks];
        if (A.whip > 0.42) {
          pts += 350;
          labels.push('Whip');
        }
        const flips = Math.floor(Math.abs(A.pitchAcc) / (Math.PI * 2) + 0.08);
        if (flips >= 1) {
          pts += 2500 * flips;
          labels.push(A.pitchAcc > 0 ? (flips > 1 ? `Double backflip` : 'Backflip') : 'Frontflip');
        }
        const label = labels.length ? labels.join(' + ') : `Saut ${dist.toFixed(0)} m`;
        this.pendingAirBank = 0.35; // le saut ne compte que si la réception tient
        this.landTimer = 0;
        this.pendingAir = { label, pts, time: A.time, dist, height, tricks: A.tricks.length };
      }
      this.trickPose = null;
    }
    if (this.pendingAirBank > 0) {
      this.pendingAirBank -= dt;
      anyActive = true;
      if (this.pendingAirBank <= 0 && this.pendingAir) {
        const pa = this.pendingAir;
        this.addToCombo(pa.label, pa.tricks ? 'freestyle' : 'jump', pa.pts);
        events.emit('airEnd', { time: pa.time, distance: pa.dist, height: pa.height, tricks: [], landed: true });
        this.onTrickEnd?.('air', pa.time, { dist: pa.dist, height: pa.height, tricks: pa.tricks });
        this.pendingAir = null;
      }
    }

    // ---------------- dérapage
    const D = this.drift;
    const slip = Math.abs(b.slipAngle);
    const onGround = b.state !== 'air';
    if (onGround && slip > 18 * DEG && b.speed > 5) {
      if (!D.active) Object.assign(D, { active: true, time: 0, maxAngle: 0, pts: 0, calm: 0 });
      D.calm = 0;
      D.time += dt;
      D.maxAngle = Math.max(D.maxAngle, slip * RAD);
      D.pts += dt * 150 * (1 + slip);
      anyActive = true;
      if (!this.live) this.live = { label: 'DÉRAPAGE', points: D.pts, sub: `${D.time.toFixed(1)} s · ${(slip * RAD).toFixed(0)}°` };
    } else if (D.active) {
      D.calm += dt;
      if (D.calm > 0.3) {
        D.active = false;
        if (D.time > 0.5) {
          this.addToCombo(`Dérapage ${D.time.toFixed(1)} s`, 'drift', D.pts);
          this.onTrickEnd?.('drift', D.time);
        }
      } else anyActive = true;
    }

    // ---------------- burn
    const B = this.burn;
    const spinning = b.rear.contact && b.rear.slipping && b.speed < 2 && b.rear.omega * b.rear.r > 6 && (frontBrake > 0.3 || b.speed < 0.6);
    if (spinning) {
      if (!B.active) Object.assign(B, { active: true, time: 0, pts: 0 });
      B.time += dt;
      B.pts += dt * 90;
      anyActive = true;
      if (!this.live) this.live = { label: 'BURN', points: B.pts, sub: `${B.time.toFixed(1)} s` };
    } else if (B.active) {
      B.active = false;
      if (B.time > 1) this.addToCombo(`Burn ${B.time.toFixed(1)} s`, 'burn', B.pts);
    }

    // ---------------- barre de 12h
    if (b.scrape > 0.5 && b.state === 'wheelie' && pitchDeg > 55) {
      this.scrape.time += dt;
      this.scrape.pts += dt * 320;
      anyActive = true;
    } else if (this.scrape.time > 0.4) {
      this.addToCombo(`Frottement 12h ${this.scrape.time.toFixed(1)} s`, 'scrape', this.scrape.pts);
      this.scrape.time = this.scrape.pts = 0;
    } else {
      this.scrape.time = this.scrape.pts = 0;
    }

    // ---------------- frôlement
    if (nearMiss) {
      this.addToCombo('Frôlement !', 'nearmiss', 220 + kmh * 2);
      this.onTrickEnd?.('nearmiss', 1);
    }

    // ---------------- combo
    if (this.combo.active) {
      if (anyActive) this.combo.timer = Math.max(this.combo.timer, 0.6);
      else {
        this.combo.timer -= dt;
        if (this.combo.timer <= 0) this.bankCombo();
      }
    }
    this.lastSpeed = b.speed;
  }

  private pendingAir: { label: string; pts: number; time: number; dist: number; height: number; tricks: number } | null = null;

  /** Poids de la pose de figure (0..1) pour l'animation du pilote. */
  get trickWeight(): number {
    const tp = this.trickPose;
    if (!tp) return 0;
    const t = tp.t / tp.dur;
    return clamp(Math.min(t / 0.25, (1 - t) / 0.25), 0, 1);
  }
}

// Modèle moteur + embrayage + boîte (manuelle/auto) ou variateur CVT.
// Le couple transmis passe par un embrayage à capacité limitée, ce qui permet
// le "coup d'embrayage" (clutch pop) : moteur lancé, embrayage relâché → pic de couple.

import type { BikeSpec } from '../data/bikes';
import { clamp, curve, smoothstep } from '../core/math';

export const RPM2RAD = (Math.PI * 2) / 60;

export interface EngineControl {
  throttle: number;
  clutchHeld: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  autoGear: boolean;
}

export interface EngineStepResult {
  /** couple appliqué par la transmission sur la roue arrière (Nm) */
  wheelTorque: number;
  /** nouvelle vitesse de roue (rad/s) — modifiée uniquement si la roue est libre */
  wheelOmega: number;
}

const EFF = 0.9;

export class Engine {
  spec: BikeSpec;
  torqueMult = 1;
  gearMult = 1;
  rpm: number;
  omega: number;
  gear = 1;
  ratio = 1;
  engagement = 1;
  clutchTorque = 0;
  shiftTimer = 0;
  limiterCut = false;
  load = 0;
  throttleEff = 0;
  popKick = 0;
  popRpm = 0;
  private prevClutch = false;
  private manualHold = 0;
  private res: EngineStepResult = { wheelTorque: 0, wheelOmega: 0 };

  constructor(spec: BikeSpec) {
    this.spec = spec;
    this.rpm = spec.idleRpm;
    this.omega = this.rpm * RPM2RAD;
    this.ratio = this.currentRatio(0);
  }

  get gearCount(): number {
    return this.spec.gears ? this.spec.gears.length : 1;
  }

  get isCVT(): boolean {
    return !this.spec.gears;
  }

  torque(rpm: number, thr: number): number {
    const s = this.spec;
    const tq = s.peakTorque * this.torqueMult * curve(s.torqueCurve, rpm);
    const fric = (s.peakTorque * 0.03 + s.engineBrake * 0.2) * (0.3 + 0.7 * (rpm / s.redline));
    const brake = s.engineBrake * (rpm / s.redline) ** 2;
    return thr * tq - (1 - thr) * brake - fric;
  }

  private currentRatio(wheelOmega: number): number {
    const s = this.spec;
    if (s.gears) return s.gears[this.gear - 1] * this.gearMult;
    const cvt = s.cvt!;
    const target = (cvt.engageRpm + 700 + (cvt.holdRpm - cvt.engageRpm - 700) * Math.min(1, this.throttleEff * 1.4)) * RPM2RAD;
    const r = target / Math.max(0.5, Math.abs(wheelOmega));
    return clamp(r, cvt.high * this.gearMult, cvt.low * this.gearMult);
  }

  /**
   * @param wheelOmega vitesse actuelle de la roue arrière (rad/s)
   * @param wheelFree vrai si la roue n'est pas liée au sol (en l'air ou en patinage)
   * @param wheelInertia inertie de la roue (kg.m²)
   * @param extTorque couple extérieur sur la roue (sol + frein), Nm, + = accélère vers l'avant
   */
  step(dt: number, ctl: EngineControl, wheelOmega: number, grounded: boolean, wheelFree: boolean, wheelInertia: number, extTorque: number): EngineStepResult {
    const s = this.spec;
    if (s.gears) {
      if (this.shiftTimer > 0) this.shiftTimer -= dt;
      const n = s.gears.length;
      if (ctl.autoGear) {
        if (!ctl.clutchHeld && this.shiftTimer <= 0 && this.engagement > 0.95 && grounded) {
          if (this.rpm > s.redline * 0.965 && this.gear < n) {
            this.shiftTo(this.gear + 1, wheelOmega);
          } else if (this.gear > 1) {
            const nextRpm = (this.rpm * s.gears[this.gear - 2]) / s.gears[this.gear - 1];
            if (this.rpm < s.redline * 0.46 && nextRpm < s.redline * 0.8) this.shiftTo(this.gear - 1, wheelOmega);
          }
        }
      } else {
        if (ctl.shiftUp && this.gear < n) this.shiftTo(this.gear + 1, wheelOmega);
        if (ctl.shiftDown && this.gear > 1) this.shiftTo(this.gear - 1, wheelOmega);
      }
    }
    if (this.rpm > s.limiter) this.limiterCut = true;
    else if (this.rpm < s.limiter - 300) this.limiterCut = false;

    const idleAssist = clamp((s.idleRpm - this.rpm) / 500, 0, 0.2);
    let thr = Math.max(ctl.throttle, idleAssist);
    if (this.limiterCut || this.shiftTimer > 0) thr = 0;
    this.throttleEff += (thr - this.throttleEff) * Math.min(1, dt * 20);

    this.ratio = this.currentRatio(wheelOmega);

    // ---- embrayage
    // embrayage automatique : glisse jusqu'au régime de décollage (comme un embrayage centrifuge)
    const launch = s.gears ? s.redline * (s.stroke === 2 ? 0.62 : 0.45) : s.cvt!.holdRpm * 0.85;
    const auto = smoothstep(launch * 0.68, launch * 1.05, this.rpm);
    const manual = ctl.clutchHeld && !!s.gears;
    if (manual) this.manualHold = Math.min(1, this.manualHold + dt * 16);
    else this.manualHold = Math.max(0, this.manualHold - dt * 25);
    if (this.prevClutch && !manual) {
      this.popKick = clamp((this.rpm - (wheelOmega * this.ratio) / RPM2RAD) / s.redline, 0, 1);
      this.popRpm = this.rpm;
    }
    this.prevClutch = manual;
    this.popKick = Math.max(0, this.popKick - dt * 2.2);
    const manualEngaged = 1 - this.manualHold;
    const autoEff = this.popKick > 0.04 ? 1 : auto;
    this.engagement = Math.min(manualEngaged, autoEff);

    const Te = this.torque(this.rpm, this.throttleEff);
    const Ie = s.engineInertia;
    const capacity = this.engagement * s.peakTorque * this.torqueMult * 2.0 + 0.001;
    let slip = this.omega - wheelOmega * this.ratio;
    const res = this.res;
    let wOmega = wheelOmega;

    if (!wheelFree) {
      // roue liée au véhicule : l'embrayage verrouille "en douceur" le moteur sur la roue
      const kLock = (Ie / dt) * 0.6;
      let tC = clamp(slip * kLock, -capacity, capacity);
      if (this.popKick > 0.04 && slip > 0) {
        // coup d'embrayage : le pilote fait patiner l'embrayage, le moteur reste dans les tours
        const popTq = this.torque(Math.max(this.rpm, this.popRpm * 0.9), Math.max(this.throttleEff, 0.6)) * 1.5;
        tC = Math.min(capacity, Math.max(tC, popTq));
        const floor = this.popRpm * 0.82 * RPM2RAD;
        if (this.omega < floor) this.omega = floor;
      }
      this.clutchTorque = tC;
      this.omega += ((Te - tC) / Ie) * dt;
      res.wheelTorque = tC * this.ratio * EFF;
    } else {
      const Isys = wheelInertia + Ie * this.ratio * this.ratio;
      const lockedAccel = (Te * this.ratio * EFF + extTorque) / Isys;
      // couple que l'embrayage doit passer pour rester collé
      const needed = (wheelInertia * lockedAccel - extTorque) / (this.ratio * EFF);
      if (this.engagement > 0.9 && Math.abs(slip) < 30 && Math.abs(needed) <= capacity) {
        wOmega = wheelOmega + lockedAccel * dt;
        this.omega = wOmega * this.ratio;
        this.clutchTorque = needed;
        res.wheelTorque = needed * this.ratio * EFF;
      } else {
        const kSoft = Math.min((Ie / dt) * 0.4, (wheelInertia / (this.ratio * this.ratio * dt)) * 0.4);
        const tC = clamp(slip * kSoft, -capacity, capacity);
        this.clutchTorque = tC;
        this.omega += ((Te - tC) / Ie) * dt;
        res.wheelTorque = tC * this.ratio * EFF;
        wOmega = wheelOmega + ((res.wheelTorque + extTorque) / wheelInertia) * dt;
      }
    }
    const minOmega = 650 * RPM2RAD;
    if (this.omega < minOmega) this.omega = minOmega;
    const maxOmega = (s.limiter + 450) * RPM2RAD;
    if (this.omega > maxOmega) this.omega = maxOmega;
    this.rpm = this.omega / RPM2RAD;
    slip = this.omega - wOmega * this.ratio;
    this.load = clamp(this.throttleEff * (0.3 + 0.7 * Math.min(1, Math.abs(this.clutchTorque) / (s.peakTorque * this.torqueMult + 1))), 0, 1);
    res.wheelOmega = wOmega;
    return res;
  }

  /** Passage de rapport : le régime se cale sur la nouvelle démultiplication (embrayage/shifter). */
  private shiftTo(g: number, wheelOmega: number): void {
    const s = this.spec;
    if (!s.gears) return;
    const up = g > this.gear;
    this.gear = g;
    this.shiftTimer = up ? 0.08 : 0.06;
    this.lastShift = up ? 1 : -1;
    const sync = Math.abs(wheelOmega) * s.gears[g - 1] * this.gearMult;
    if (sync > 0) this.omega = Math.min((s.limiter + 200) * RPM2RAD, Math.max(s.idleRpm * RPM2RAD, sync));
    this.rpm = this.omega / RPM2RAD;
  }

  lastShift = 0;

  reset(): void {
    this.rpm = this.spec.idleRpm;
    this.omega = this.rpm * RPM2RAD;
    this.gear = 1;
    this.engagement = 1;
    this.throttleEff = 0;
    this.shiftTimer = 0;
    this.manualHold = 0;
    this.popKick = 0;
    this.limiterCut = false;
  }
}

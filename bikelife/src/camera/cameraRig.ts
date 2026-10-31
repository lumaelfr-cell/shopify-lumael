// Caméras : poursuite, rapprochée (course), vue pilote/guidon, cinématique
// (plans fixes en bord de route), et caméra latérale spéciale wheeling.

import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../core/math';

export type CamMode = 'chase' | 'close' | 'fpv' | 'cine' | 'wheelie' | 'orbit';
export const CAM_MODES: CamMode[] = ['chase', 'close', 'fpv', 'cine', 'wheelie', 'orbit'];
export const CAM_LABEL: Record<CamMode, string> = {
  chase: 'Poursuite',
  close: 'Rapprochée',
  fpv: 'Vue pilote',
  cine: 'Cinématique',
  wheelie: 'Caméra wheeling',
  orbit: 'Caméra libre (glisser pour tourner)',
};

export interface CamTarget {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  vx: number;
  vz: number;
  wheelie: boolean;
  airborne: boolean;
  head: THREE.Vector3;
  groundY: number;
}

export class CameraRig {
  cam: THREE.PerspectiveCamera;
  mode: CamMode = 'chase';
  autoWheelieCam = true;
  baseFov = 62;
  private pos = new THREE.Vector3(0, 3, -6);
  private look = new THREE.Vector3();
  private heading = 0;
  private cinePoint = new THREE.Vector3();
  private cineTimer = 0;
  private shakeAmt = 0;
  private wheelieTime = 0;
  private activeAuto = false;
  private sideSign = 1;
  orbit = 0; // menu : rotation automatique
  // caméra libre : angles persistants (souris / stick droit / doigt)
  freeYaw = 0;
  freePitch = 0.25;
  private freeIdle = 0;

  /** Rotation manuelle de la caméra libre. */
  addFree(dX: number, dY: number, dt: number): void {
    if (Math.abs(dX) + Math.abs(dY) > 1e-4) this.freeIdle = 0;
    else this.freeIdle += dt;
    this.freeYaw += dX * 1.2 + (this.freeIdle > 3 ? dt * 0.25 : 0);
    this.freePitch = clamp(this.freePitch + dY * 0.8, -0.05, 1.2);
  }
  raycast: ((ax: number, ay: number, az: number, bx: number, by: number, bz: number, step?: number) => number) | null = null;

  constructor(aspect: number) {
    this.cam = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.08, 1400);
  }

  shake(a: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  next(): CamMode {
    const i = CAMERA_ORDER.indexOf(this.mode);
    this.mode = CAMERA_ORDER[(i + 1) % CAMERA_ORDER.length];
    this.cineTimer = 0;
    if (this.mode === 'orbit') this.freeYaw = Math.atan2(this.pos.x - this.look.x, this.pos.z - this.look.z);
    return this.mode;
  }

  snap(t: CamTarget): void {
    this.heading = t.yaw;
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    this.pos.set(t.x - fx * 6, t.y + 2.2, t.z - fz * 6);
    this.look.set(t.x, t.y + 0.8, t.z);
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }

  update(dt: number, t: CamTarget, lookX: number, lookY: number): void {
    const moving = t.speed > 2.5;
    const velYaw = moving ? Math.atan2(t.vx, t.vz) : t.yaw;
    this.heading = dampAngle(this.heading, moving ? velYaw : t.yaw, moving ? 3.2 : 1.6, dt);
    // caméra wheeling automatique après 1,5 s de wheeling
    if (t.wheelie) this.wheelieTime += dt;
    else this.wheelieTime = Math.max(0, this.wheelieTime - dt * 3);
    const autoW = this.autoWheelieCam && (this.mode === 'chase' || this.mode === 'close') && this.wheelieTime > 1.5;
    if (autoW && !this.activeAuto) this.sideSign = Math.random() > 0.5 ? 1 : -1;
    this.activeAuto = autoW;
    const mode: CamMode = autoW ? 'wheelie' : this.mode;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    const camYaw = this.heading + lookX;
    const cfx = Math.sin(camYaw), cfz = Math.cos(camYaw);
    let fov = this.baseFov;
    const desired = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    let rate = 6;
    let lookRate = 12;
    switch (mode) {
      case 'chase': {
        const dist = 5.4 + Math.min(t.speed, 40) * 0.035;
        desired.set(t.x - cfx * dist, t.y + 1.75 + lookY * 3, t.z - cfz * dist);
        lookAt.set(t.x + fx * 2.5, t.y + 0.75, t.z + fz * 2.5);
        fov += Math.min(t.speed, 45) * 0.22;
        rate = 7;
        break;
      }
      case 'close': {
        const dist = 3.3;
        desired.set(t.x - cfx * dist, t.y + 1.15 + lookY * 2, t.z - cfz * dist);
        lookAt.set(t.x + fx * 4, t.y + 0.75, t.z + fz * 4);
        fov = 68 + Math.min(t.speed, 45) * 0.25;
        rate = 10;
        break;
      }
      case 'fpv': {
        desired.copy(t.head);
        const pitchFollow = t.pitch * 0.45;
        const yaw = t.yaw + lookX;
        lookAt.set(t.head.x + Math.sin(yaw) * 10 * Math.cos(pitchFollow), t.head.y + Math.sin(pitchFollow) * 10 - 1.2 - lookY * 4, t.head.z + Math.cos(yaw) * 10 * Math.cos(pitchFollow));
        fov = 78;
        rate = 60;
        lookRate = 40;
        break;
      }
      case 'cine': {
        this.cineTimer -= dt;
        const toBike = new THREE.Vector3(t.x - this.cinePoint.x, 0, t.z - this.cinePoint.z);
        const behind = toBike.dot(new THREE.Vector3(t.vx, 0, t.vz).normalize()) > 22;
        if (this.cineTimer <= 0 || toBike.length() > 75 || behind) {
          const ahead = 26 + Math.min(t.speed, 30) * 1.2;
          const side = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 6);
          this.cinePoint.set(t.x + fx * ahead + rx * side, t.groundY + 0.6 + Math.random() * 2.5, t.z + fz * ahead + rz * side);
          this.cineTimer = 6 + Math.random() * 3;
          this.pos.copy(this.cinePoint);
        }
        desired.copy(this.cinePoint);
        lookAt.set(t.x, t.y + 0.5, t.z);
        const d = this.cinePoint.distanceTo(lookAt);
        fov = clamp(1400 / (d + 10), 18, 60);
        rate = 40;
        lookRate = 8;
        break;
      }
      case 'orbit': {
        const d = 4.2, p = this.freePitch;
        desired.set(t.x + Math.sin(this.freeYaw) * Math.cos(p) * d, t.y + 0.3 + Math.sin(p) * d, t.z + Math.cos(this.freeYaw) * Math.cos(p) * d);
        lookAt.set(t.x, t.y + 0.1, t.z);
        fov = 50;
        rate = 12;
        break;
      }
      case 'wheelie': {
        const s = this.sideSign;
        desired.set(t.x + rx * 4.6 * s + fx * 1.4, t.y + 0.15, t.z + rz * 4.6 * s + fz * 1.4);
        lookAt.set(t.x + fx * 0.6, t.y + 0.55, t.z + fz * 0.6);
        fov = 55;
        rate = 5;
        break;
      }
    }
    // collision caméra / décor
    if (this.raycast && mode !== 'fpv' && mode !== 'cine') {
      const f = this.raycast(t.x, t.y + 0.9, t.z, desired.x, desired.y, desired.z);
      if (f < 1) desired.set(lerp(t.x, desired.x, f * 0.92), lerp(t.y + 0.9, desired.y, f * 0.92), lerp(t.z, desired.z, f * 0.92));
    }
    if (desired.y < t.groundY + 0.35) desired.y = t.groundY + 0.35;
    this.pos.x = damp(this.pos.x, desired.x, rate, dt);
    this.pos.y = damp(this.pos.y, desired.y, rate * 0.8, dt);
    this.pos.z = damp(this.pos.z, desired.z, rate, dt);
    if (mode === 'fpv') this.pos.copy(desired);
    this.look.x = damp(this.look.x, lookAt.x, lookRate, dt);
    this.look.y = damp(this.look.y, lookAt.y, lookRate, dt);
    this.look.z = damp(this.look.z, lookAt.z, lookRate, dt);
    // tremblement
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    const sh = this.shakeAmt * this.shakeAmt;
    this.cam.position.set(this.pos.x + (Math.random() - 0.5) * sh * 0.3, this.pos.y + (Math.random() - 0.5) * sh * 0.3, this.pos.z + (Math.random() - 0.5) * sh * 0.3);
    if (mode === 'fpv') {
      this.cam.up.set(-Math.cos(t.yaw) * Math.sin(t.roll) * 0.6, 1, Math.sin(t.yaw) * Math.sin(t.roll) * 0.6).normalize();
    } else this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.look);
    this.cam.fov = damp(this.cam.fov, fov, 4, dt);
    this.cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- à pied
  /** cap de la caméra à pied (sert de référence aux déplacements) */
  footYaw = 0;
  private footPitch = 0.28;
  private manualT = 9;

  snapFoot(yaw: number): void {
    this.footYaw = yaw;
    this.footPitch = 0.28;
    this.manualT = 9;
  }

  /**
   * Caméra à la troisième personne (épaule) ou vue subjective quand le joueur
   * marche. `dX/dY` : rotation demandée cette frame (souris, stick, doigt).
   */
  updateFoot(dt: number, t: { x: number; y: number; z: number; yaw: number; forward: boolean; head: THREE.Vector3; groundY: number }, dX: number, dY: number, indoor: boolean): void {
    if (Math.abs(dX) + Math.abs(dY) > 1e-4) this.manualT = 0;
    else this.manualT += dt;
    this.footYaw += dX * 1.1;
    this.footPitch = clamp(this.footPitch + dY * 0.9, -0.55, 1.15);
    // recentre derrière le personnage quand on avance sans toucher à la caméra
    if (t.forward && this.manualT > 1.2) this.footYaw = dampAngle(this.footYaw, t.yaw, 1.4, dt);
    const fpv = this.mode === 'fpv';
    const cy = Math.cos(this.footYaw), sy = Math.sin(this.footYaw);
    const desired = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (fpv) {
      desired.copy(t.head);
      const p = this.footPitch - 0.28;
      look.set(t.head.x + sy * Math.cos(p) * 10, t.head.y - Math.sin(p) * 10, t.head.z + cy * Math.cos(p) * 10);
    } else {
      const dist = indoor ? 2.5 : 3.6;
      const p = this.footPitch;
      const side = indoor ? 0.35 : 0.45; // caméra d'épaule
      const pivot = new THREE.Vector3(t.x - cy * side, t.y + 1.5, t.z + sy * side);
      desired.set(pivot.x - sy * dist * Math.cos(p), pivot.y + Math.sin(p) * dist * 0.85, pivot.z - cy * dist * Math.cos(p));
      if (this.raycast) {
        // pas fin : les cloisons intérieures ne font que 12 à 30 cm
        const f = this.raycast(pivot.x, pivot.y, pivot.z, desired.x, desired.y, desired.z, 0.08);
        if (f < 1) desired.set(lerp(pivot.x, desired.x, Math.max(0, f - 0.06)), lerp(pivot.y, desired.y, Math.max(0, f - 0.06)), lerp(pivot.z, desired.z, Math.max(0, f - 0.06)));
      }
      if (desired.y < t.groundY + 0.3) desired.y = t.groundY + 0.3;
      look.set(pivot.x + sy * 2, pivot.y - 0.1 - (p - 0.28) * 0.8, pivot.z + cy * 2);
    }
    const rate = fpv ? 60 : 14;
    this.pos.x = damp(this.pos.x, desired.x, rate, dt);
    this.pos.y = damp(this.pos.y, desired.y, rate, dt);
    this.pos.z = damp(this.pos.z, desired.z, rate, dt);
    // pas de lissage qui ferait traverser un mur
    if (!fpv && this.raycast && this.raycast(t.x, t.y + 1.5, t.z, this.pos.x, this.pos.y, this.pos.z, 0.08) < 1) this.pos.copy(desired);
    this.look.copy(look);
    this.cam.position.copy(this.pos);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.look);
    this.cam.fov = damp(this.cam.fov, fpv ? 75 : 60, 6, dt);
    this.cam.updateProjectionMatrix();
  }

  /** Orbite lente autour d'un point (menus / garage extérieur). */
  orbitAround(dt: number, center: THREE.Vector3, radius: number, height: number): void {
    this.orbit += dt * 0.12;
    this.cam.position.set(center.x + Math.sin(this.orbit) * radius, center.y + height, center.z + Math.cos(this.orbit) * radius);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(center);
    this.cam.fov = 45;
    this.cam.updateProjectionMatrix();
    this.pos.copy(this.cam.position);
    this.look.copy(center);
  }
}

const CAMERA_ORDER: CamMode[] = CAM_MODES;

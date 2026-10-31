// Caméras : poursuite, rapprochée (course), vue pilote/guidon, cinématique
// (plans fixes en bord de route), et caméra latérale spéciale wheeling.

import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../core/math';

export type CamMode = 'chase' | 'close' | 'fpv' | 'cine' | 'wheelie';
export const CAM_MODES: CamMode[] = ['chase', 'close', 'fpv', 'cine', 'wheelie'];
export const CAM_LABEL: Record<CamMode, string> = {
  chase: 'Poursuite',
  close: 'Rapprochée',
  fpv: 'Vue pilote',
  cine: 'Cinématique',
  wheelie: 'Caméra wheeling',
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
  raycast: ((ax: number, ay: number, az: number, bx: number, by: number, bz: number) => number) | null = null;

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

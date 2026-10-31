// Joueur à pied : déplacement relatif à la caméra (marche / course / saut),
// collisions avec les murs, portes et meubles (couche « piéton »), escaliers,
// étages, endurance, position assise / allongée. Le pilote (Rider) est
// réutilisé tel quel : son groupe est rattaché au personnage.

import * as THREE from 'three';
import type { CollisionWorld, GroundHit, WallHit } from '../physics/collision';
import type { Rider, BodyTargets } from './rider';
import { idlePose, walkPose, sitPose, lyingPose } from './poses';
import { clamp, damp, dampAngle } from '../core/math';

export interface FootInput {
  moveX: number; // + = droite
  moveY: number; // + = avant
  sprint: boolean;
  jump: boolean;
}

export interface SeatSpot {
  x: number;
  y: number; // hauteur du sol sous le siège (monde)
  h: number; // hauteur d'assise / de couchage au-dessus du sol
  z: number;
  yaw: number;
  lie?: boolean;
  /** appelé à chaque frame tant que le joueur reste assis */
  onTick?: (dt: number) => void;
}

const RADIUS = 0.3;
const STEP = 0.45;

export class Walker {
  root = new THREE.Group();
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  vy = 0;
  speed = 0;
  grounded = true;
  phase = 0;
  stamina = 1;
  /** boisson énergisante : course illimitée pendant n secondes */
  boost = 0;
  seat: SeatSpot | null = null;
  private vx = 0;
  private vz = 0;
  private t = 0;
  private air = 0;
  private gh: GroundHit = { h: 0, surf: 'concrete', id: -1 };
  private wh: WallHit = { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false };
  lookYaw = 0;
  /** vitesse max réduite à l'intérieur */
  indoor = false;

  constructor(private world: CollisionWorld) {}

  place(x: number, y: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    const g = this.world.groundAt(x, z, y + 1.2, this.gh, 'foot');
    this.y = g.h;
    this.vx = this.vz = this.vy = 0;
    this.speed = 0;
    this.grounded = true;
    this.seat = null;
    this.sync();
  }

  sit(s: SeatSpot): void {
    this.seat = s;
    this.vx = this.vz = this.speed = 0;
  }

  standUp(): void {
    if (!this.seat) return;
    const s = this.seat;
    this.seat = null;
    // se relève devant le siège
    this.x = s.x + Math.sin(s.yaw) * 0.55;
    this.z = s.z + Math.cos(s.yaw) * 0.55;
    const g = this.world.groundAt(this.x, this.z, s.y + 0.4, this.gh, 'foot');
    this.y = g.h;
    this.yaw = s.yaw;
    this.resolveWalls();
  }

  update(dt: number, inp: FootInput, camYaw: number): void {
    this.t += dt;
    if (this.seat) {
      this.seat.onTick?.(dt);
      if (Math.hypot(inp.moveX, inp.moveY) > 0.5 || inp.jump) this.standUp();
      else {
        this.x = this.seat.x;
        this.z = this.seat.z;
        this.y = this.seat.y;
        this.yaw = this.seat.yaw;
        this.stamina = Math.min(1, this.stamina + dt * 0.3);
        this.sync();
        return;
      }
    }
    const mag = Math.min(1, Math.hypot(inp.moveX, inp.moveY));
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let wx = fx * inp.moveY + rx * inp.moveX;
    let wz = fz * inp.moveY + rz * inp.moveX;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) {
      wx /= wl;
      wz /= wl;
    }
    const canSprint = this.boost > 0 || this.stamina > 0.04;
    const sprinting = inp.sprint && canSprint && mag > 0.3;
    const vmax = (sprinting ? 6.2 : 2.1) * (this.indoor && !sprinting ? 0.85 : 1);
    const target = mag * vmax;
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt);
    if (sprinting && this.boost <= 0) this.stamina = Math.max(0, this.stamina - dt * 0.11);
    else this.stamina = Math.min(1, this.stamina + dt * (mag > 0.1 ? 0.12 : 0.22));
    const ctrl = this.grounded ? 9 : 2.5;
    const tvx = wx * target, tvz = wz * target;
    this.vx += (tvx - this.vx) * Math.min(1, dt * ctrl);
    this.vz += (tvz - this.vz) * Math.min(1, dt * ctrl);
    if (mag > 0.08) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 11, dt);
    // saut
    if (inp.jump && this.grounded) {
      this.vy = 4.8;
      this.grounded = false;
    }
    // intégration par sous-pas (les murs restent étanches)
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vx, this.vz) * dt) / 0.2));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.x += this.vx * h;
      this.z += this.vz * h;
      this.resolveWalls();
      this.ground(h);
    }
    this.speed = Math.hypot(this.vx, this.vz);
    this.air = damp(this.air, this.grounded ? 0 : 1, 10, dt);
    const stride = this.speed > 3 ? 2.4 : 1.35;
    this.phase += (this.speed / stride) * Math.PI * dt * (this.grounded ? 1 : 0.2);
    this.sync();
  }

  private resolveWalls(): void {
    for (let k = 0; k < 2; k++) {
      const w = this.world.collideCapsule(this.x, this.z, this.y + 0.05, this.y + 1.75, RADIUS, STEP, this.wh, 'foot');
      if (!w.hit) break;
      this.x += w.px;
      this.z += w.pz;
      const vn = this.vx * w.nx + this.vz * w.nz;
      if (vn < 0) {
        this.vx -= w.nx * vn;
        this.vz -= w.nz * vn;
      }
    }
  }

  private ground(dt: number): void {
    const g = this.world.groundAt(this.x, this.z, this.y + STEP, this.gh, 'foot');
    if (this.grounded) {
      if (g.h >= this.y - 0.55) {
        // marches et escaliers : suivi rapide de la hauteur
        this.y = g.h > this.y ? Math.min(g.h, this.y + dt * 6 + (g.h - this.y) * 0.5) : Math.max(g.h, this.y - dt * 8);
      } else this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 19 * dt;
      this.y += this.vy * dt;
      if (this.y <= g.h && this.vy <= 0) {
        this.y = g.h;
        this.vy = 0;
        this.grounded = true;
      }
    }
  }

  sync(): void {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.set(0, this.yaw, 0);
  }

  /** Pose du corps pour cette frame. */
  targets(): BodyTargets {
    if (this.seat) {
      if (this.seat.lie) return lyingPose(this.t, this.seat.h);
      return sitPose(this.seat.h, this.t, this.lookYaw);
    }
    const s = this.speed;
    if (s < 0.15 && this.grounded) return idlePose(this.t, { lookYaw: this.lookYaw });
    const b = walkPose(this.phase, s, this.air);
    if (s < 0.6 && this.grounded) {
      // démarrage / arrêt : mélange avec la pose de repos
      const k = clamp(s / 0.6, 0, 1);
      const idle = idlePose(this.t);
      b.footL.lerp(idle.footL, 1 - k);
      b.footR.lerp(idle.footR, 1 - k);
      b.handL.lerp(idle.handL, 1 - k);
      b.handR.lerp(idle.handR, 1 - k);
    }
    return b;
  }

  pose(rider: Rider, firstPerson: boolean): void {
    const b = this.targets();
    b.firstPerson = firstPerson;
    rider.poseFree(b);
  }

  /** Position de la tête (vue à la première personne). */
  headPos(out: THREE.Vector3): THREE.Vector3 {
    const h = this.seat ? this.seat.h + (this.seat.lie ? 0.3 : 0.75) : 1.62;
    return out.set(this.x + Math.sin(this.yaw) * 0.1, this.y + h, this.z + Math.cos(this.yaw) * 0.1);
  }
}

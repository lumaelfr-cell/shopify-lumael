// Poupée de chiffon du pilote lors d'une chute : 15 particules (intégration de
// Verlet) reliées par des contraintes de distance (os) et quelques
// contreventements pour garder un tronc rigide ; collisions avec le sol (avec
// frottement) et les murs. Les membres du modèle suivent les particules.

import * as THREE from 'three';
import type { CollisionWorld, GroundHit, WallHit } from '../physics/collision';
import { isLoose } from '../physics/collision';

const BONES: [string, string][] = [
  ['pelvis', 'neck'], ['neck', 'head'], ['neck', 'shL'], ['neck', 'shR'], ['shL', 'shR'],
  ['pelvis', 'hipL'], ['pelvis', 'hipR'], ['hipL', 'hipR'],
  ['shL', 'elL'], ['elL', 'wrL'], ['shR', 'elR'], ['elR', 'wrR'],
  ['hipL', 'knL'], ['knL', 'anL'], ['hipR', 'knR'], ['knR', 'anR'],
  // contreventement du tronc
  ['shL', 'hipL'], ['shR', 'hipR'], ['shL', 'hipR'], ['shR', 'hipL'], ['head', 'shL'], ['head', 'shR'],
  // genoux et coudes ne se replient pas complètement
  ['hipL', 'anL'], ['hipR', 'anR'], ['shL', 'wrL'], ['shR', 'wrR'],
];
const SOFT = new Set(['hipL:anL', 'hipR:anR', 'shL:wrL', 'shR:wrR']);

export class Ragdoll {
  p: Record<string, THREE.Vector3> = {};
  private prev: Record<string, THREE.Vector3> = {};
  private rest: { a: string; b: string; len: number; soft: boolean }[] = [];
  private gh: GroundHit = { h: 0, surf: 'asphalt', id: -1 };
  private wh: WallHit = { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false };
  /** vitesse de glissement au sol (frottements / étincelles) */
  slide = 0;

  constructor(joints: Record<string, THREE.Vector3>, vel: THREE.Vector3, spin: THREE.Vector3, private world: CollisionWorld) {
    const c = joints.pelvis.clone();
    for (const [k, v] of Object.entries(joints)) {
      this.p[k] = v.clone();
      // vitesse initiale : moto + rotation du corps autour du bassin
      const r = v.clone().sub(c);
      const w = new THREE.Vector3().crossVectors(spin, r);
      this.prev[k] = v.clone().sub(vel.clone().add(w).multiplyScalar(1 / 60));
    }
    for (const [a, b] of BONES) {
      if (!this.p[a] || !this.p[b]) continue;
      const soft = SOFT.has(`${a}:${b}`);
      this.rest.push({ a, b, len: this.p[a].distanceTo(this.p[b]) * (soft ? 0.98 : 1), soft });
    }
  }

  private acc = 0;

  /** Pas fixe de 1/60 s (sous-pas si la frame est longue). */
  step(dt: number): void {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= 1 / 60 && n < 6) {
      this.acc -= 1 / 60;
      this.sub();
      n++;
    }
  }

  private sub(): void {
    const g = -9.81 / 3600;
    for (const k in this.p) {
      const x = this.p[k], o = this.prev[k];
      const vx = (x.x - o.x) * 0.998, vy = (x.y - o.y) * 0.998, vz = (x.z - o.z) * 0.998;
      o.copy(x);
      x.x += vx;
      x.y += vy + g;
      x.z += vz;
    }
    this.slide = 0;
    for (let it = 0; it < 6; it++) {
      for (const r of this.rest) {
        const a = this.p[r.a], b = this.p[r.b];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        // les contraintes « souples » n'empêchent que l'hyper-extension
        if (r.soft && d < r.len) continue;
        const diff = ((d - r.len) / d) * 0.5;
        a.x += dx * diff; a.y += dy * diff; a.z += dz * diff;
        b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff;
      }
      // sol et murs
      for (const k in this.p) {
        const x = this.p[k];
        const gr = this.world.groundAt(x.x, x.z, x.y + 0.4, this.gh);
        const rad = k === 'head' ? 0.13 : k === 'pelvis' ? 0.12 : 0.06;
        if (x.y < gr.h + rad) {
          x.y = gr.h + rad;
          // frottement : on freine le déplacement horizontal
          const o = this.prev[k];
          const fr = isLoose(gr.surf) ? 0.35 : 0.2;
          o.x += (x.x - o.x) * fr;
          o.z += (x.z - o.z) * fr;
          if (k === 'pelvis') this.slide = Math.hypot(x.x - o.x, x.z - o.z) * 60;
        }
        if (k === 'pelvis' || k === 'head') {
          const w = this.world.collideCapsule(x.x, x.z, x.y - 0.1, x.y + 0.1, rad, 0.1, this.wh);
          if (w.hit) {
            x.x += w.px;
            x.z += w.pz;
          }
        }
      }
    }
  }
}

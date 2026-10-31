// Piétons : marchent sur les trottoirs autour des blocs, s'écartent quand une
// moto arrive. Rendu par parties instanciées (8 draw calls pour tous les piétons).

import * as THREE from 'three';
import { GRID_N, blockDistrict, blockRect, CURB } from './layout';
import { rng } from '../core/math';

interface Ped {
  bx: number;
  bz: number;
  s: number; // abscisse sur le périmètre
  dir: 1 | -1;
  speed: number;
  phase: number;
  inset: number;
  dodge: number;
  x: number;
  z: number;
  yaw: number;
  shirt: THREE.Color;
  pants: THREE.Color;
  skin: THREE.Color;
}

const WALK_BLOCKS: { bx: number; bz: number }[] = [];
for (let bx = 0; bx < GRID_N; bx++) {
  for (let bz = 0; bz < GRID_N; bz++) {
    const d = blockDistrict(bx, bz);
    if (d !== 'industrial' && d !== 'stunt' && d !== 'training') WALK_BLOCKS.push({ bx, bz });
  }
}

export class Pedestrians {
  group = new THREE.Group();
  peds: Ped[] = [];
  private parts: Record<string, THREE.InstancedMesh> = {};
  private r = rng(777);

  constructor(private count: number) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const defs: Record<string, THREE.BufferGeometry> = {
      head: new THREE.SphereGeometry(0.11, 10, 8),
      torso: new THREE.BoxGeometry(0.38, 0.55, 0.22),
      legL: new THREE.BoxGeometry(0.14, 0.8, 0.14).translate(0, -0.4, 0),
      legR: new THREE.BoxGeometry(0.14, 0.8, 0.14).translate(0, -0.4, 0),
      armL: new THREE.BoxGeometry(0.1, 0.6, 0.1).translate(0, -0.3, 0),
      armR: new THREE.BoxGeometry(0.1, 0.6, 0.1).translate(0, -0.3, 0),
      hair: new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    };
    for (const [k, g] of Object.entries(defs)) {
      const im = new THREE.InstancedMesh(g, mat, count);
      im.castShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      this.parts[k] = im;
      this.group.add(im);
    }
  }

  private perimeter(bx: number, bz: number, inset: number): { x0: number; z0: number; x1: number; z1: number; len: number } {
    const R = blockRect(bx, bz);
    const x0 = R.x0 + inset, z0 = R.z0 + inset, x1 = R.x1 - inset, z1 = R.z1 - inset;
    return { x0, z0, x1, z1, len: 2 * (x1 - x0 + z1 - z0) };
  }

  private place(p: Ped): void {
    const P = this.perimeter(p.bx, p.bz, p.inset + p.dodge);
    let s = ((p.s % P.len) + P.len) % P.len;
    const w = P.x1 - P.x0, h = P.z1 - P.z0;
    let x: number, z: number, yaw: number;
    if (s < w) { x = P.x0 + s; z = P.z0; yaw = Math.PI / 2; }
    else if ((s -= w) < h) { x = P.x1; z = P.z0 + s; yaw = 0; }
    else if ((s -= h) < w) { x = P.x1 - s; z = P.z1; yaw = -Math.PI / 2; }
    else { s -= w; x = P.x0; z = P.z1 - s; yaw = Math.PI; }
    p.x = x;
    p.z = z;
    p.yaw = p.dir > 0 ? yaw : yaw + Math.PI;
  }

  private spawn(p: Ped | null, px: number, pz: number): Ped {
    let best = WALK_BLOCKS[0];
    for (let i = 0; i < 30; i++) {
      const b = WALK_BLOCKS[Math.floor(this.r() * WALK_BLOCKS.length)];
      const R = blockRect(b.bx, b.bz);
      const d = Math.hypot((R.x0 + R.x1) / 2 - px, (R.z0 + R.z1) / 2 - pz);
      best = b;
      if (d < 150) break;
    }
    const ped = p ?? ({} as Ped);
    const shirts = ['#c0392b', '#2c3e50', '#ecf0f1', '#16a085', '#f39c12', '#8e44ad', '#111111', '#2980b9', '#e84393', '#6ab04c'];
    const pants = ['#1e272e', '#34495e', '#2f3640', '#576574', '#2f4f7f', '#8395a7'];
    const skins = ['#f1c9a5', '#e0ac85', '#c68b62', '#a0683f', '#7a4b2a', '#4f301b'];
    Object.assign(ped, {
      bx: best.bx, bz: best.bz, s: this.r() * 300, dir: this.r() > 0.5 ? 1 : -1, speed: 1.1 + this.r() * 0.6, phase: this.r() * 6,
      inset: 1.4 + this.r() * 1.4, dodge: 0, x: 0, z: 0, yaw: 0,
      shirt: new THREE.Color(shirts[Math.floor(this.r() * shirts.length)]),
      pants: new THREE.Color(pants[Math.floor(this.r() * pants.length)]),
      skin: new THREE.Color(skins[Math.floor(this.r() * skins.length)]),
    });
    this.place(ped);
    return ped;
  }

  reset(px: number, pz: number): void {
    this.peds = [];
    for (let i = 0; i < this.count; i++) this.peds.push(this.spawn(null, px, pz));
  }

  update(dt: number, bx: number, bz: number, bikeSpeed: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    let k = 0;
    for (const p of this.peds) {
      if (Math.hypot(p.x - bx, p.z - bz) > 200) this.spawn(p, bx, bz);
      const d = Math.hypot(p.x - bx, p.z - bz);
      const danger = d < 5 && bikeSpeed > 2;
      p.dodge += ((danger ? 1.3 : 0) - p.dodge) * Math.min(1, dt * (danger ? 9 : 1.5));
      const sp = danger ? 0.2 : p.speed;
      p.s += p.dir * sp * dt;
      p.phase += sp * dt * 5.5;
      this.place(p);
      const swing = Math.sin(p.phase) * 0.5 * Math.min(1, sp);
      const set = (part: string, x: number, y: number, z: number, rx: number, color: THREE.Color) => {
        const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
        e.set(rx, p.yaw, 0, 'YXZ');
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(p.x + c * x + s * z, CURB + y, p.z - s * x + c * z), q, one);
        this.parts[part].setMatrixAt(k, m);
        this.parts[part].setColorAt(k, color);
      };
      const bob = Math.abs(Math.cos(p.phase)) * 0.03;
      const scared = danger ? 1 : 0;
      set('torso', 0, 1.18 + bob, 0, 0, p.shirt);
      set('head', 0, 1.6 + bob, 0, 0, p.skin);
      set('hair', 0, 1.62 + bob, -0.01, 0, p.pants);
      set('legL', 0.1, 0.9 + bob, 0, swing, p.pants);
      set('legR', -0.1, 0.9 + bob, 0, -swing, p.pants);
      set('armL', 0.25, 1.42 + bob, 0, -swing * 0.8 - scared * 2.6, p.shirt);
      set('armR', -0.25, 1.42 + bob, 0, swing * 0.8 - scared * 2.6, p.shirt);
      k++;
    }
    for (const im of Object.values(this.parts)) {
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  /** Les piétons repoussent doucement la moto (pas de chute). */
  push(x: number, z: number): [number, number] {
    let px = 0, pz = 0;
    for (const p of this.peds) {
      const dx = x - p.x, dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.65 && d > 1e-3) {
        px += (dx / d) * (0.65 - d);
        pz += (dz / d) * (0.65 - d);
      }
    }
    return [px, pz];
  }
}

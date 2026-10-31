// Circulation : voitures IA sur le réseau de rues (voies à droite), virages
// aux carrefours, feux tricolores, rond-point central, distance de sécurité,
// collisions avec le joueur et détection des "frôlements".

import * as THREE from 'three';
import { GRID_N, lineCoord, roadWidth, laneOffsets, CENTER_ISLAND_R, CURB } from './layout';
import { clamp, rng } from '../core/math';
import { merge } from '../vehicle/geom';

interface Path {
  pts: THREE.Vector3[];
  len: number;
  cum: number[];
}

interface Car {
  // segment courant : axe 'x' (route horizontale z=cst) ou 'z' (route verticale x=cst)
  axis: 'x' | 'z';
  line: number; // indice de la ligne
  from: number; // indice du nœud de départ (sur l'autre axe)
  dir: 1 | -1;
  lane: number;
  path: Path;
  s: number;
  speed: number;
  vmax: number;
  inTurn: boolean;
  next: { axis: 'x' | 'z'; line: number; from: number; dir: 1 | -1; lane: number } | null;
  pos: THREE.Vector3;
  heading: number;
  color: THREE.Color;
  type: number;
  honk: number;
  nearMissCd: number;
  blocked: number;
  stopped: boolean;
}

export interface TrafficHit {
  crash: boolean;
  pushX: number;
  pushZ: number;
  relSpeed: number;
}

const CYCLE = 18;

export class Traffic {
  group = new THREE.Group();
  cars: Car[] = [];
  private bodies: THREE.InstancedMesh[] = [];
  private glass: THREE.InstancedMesh[] = [];
  private wheels: THREE.InstancedMesh[] = [];
  private lights: THREE.InstancedMesh;
  private tails: THREE.InstancedMesh;
  private r = rng(4242);
  time = 0;
  count: number;
  onHonk: ((x: number, z: number) => void) | null = null;
  onNearMiss: (() => void) | null = null;
  headlightMat: THREE.MeshStandardMaterial;

  constructor(count: number) {
    this.count = count;
    const paint = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.55 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#10161d', roughness: 0.08, metalness: 0.7 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
    // type 0 : berline, type 1 : utilitaire
    const types = [
      { body: [new THREE.BoxGeometry(1.82, 0.6, 4.4).translate(0, 0.62, 0), new THREE.BoxGeometry(1.64, 0.5, 2.3).translate(0, 1.16, -0.25)], glass: [new THREE.BoxGeometry(1.66, 0.4, 2.1).translate(0, 1.17, -0.25)], wb: 1.35 },
      { body: [new THREE.BoxGeometry(1.95, 1.5, 4.9).translate(0, 1.15, 0)], glass: [new THREE.BoxGeometry(1.9, 0.55, 0.5).translate(0, 1.5, 2.25)], wb: 1.6 },
    ];
    const n = count;
    for (const t of types) {
      const b = new THREE.InstancedMesh(merge(t.body), paint, n);
      const g = new THREE.InstancedMesh(merge(t.glass), glassMat, n);
      const wg = merge([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12).rotateZ(Math.PI / 2).translate(sx * 0.82, 0.34, sz * t.wb))));
      const w = new THREE.InstancedMesh(wg, wheelMat, n);
      for (const m of [b, g, w]) {
        m.castShadow = true;
        m.frustumCulled = false;
        m.count = 0;
        this.group.add(m);
      }
      this.bodies.push(b);
      this.glass.push(g);
      this.wheels.push(w);
    }
    this.headlightMat = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: new THREE.Color('#fff2d0'), emissiveIntensity: 0.3 });
    const hl = merge([-1, 1].map((sx) => new THREE.BoxGeometry(0.34, 0.14, 0.05).translate(sx * 0.62, 0.72, 2.2)));
    this.lights = new THREE.InstancedMesh(hl, this.headlightMat, n * 2);
    const tl = merge([-1, 1].map((sx) => new THREE.BoxGeometry(0.34, 0.14, 0.05).translate(sx * 0.62, 0.78, -2.22)));
    this.tails = new THREE.InstancedMesh(tl, new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: new THREE.Color('#ff1a0a'), emissiveIntensity: 1.2 }), n * 2);
    for (const m of [this.lights, this.tails]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
  }

  // ------------------------------------------------------------ réseau
  private nodePos(axis: 'x' | 'z', line: number, node: number): [number, number] {
    // axe 'x' = route horizontale : z = lineCoord(line), x = lineCoord(node)
    return axis === 'x' ? [lineCoord(node), lineCoord(line)] : [lineCoord(line), lineCoord(node)];
  }

  private dirVec(axis: 'x' | 'z', dir: 1 | -1): [number, number] {
    return axis === 'x' ? [dir, 0] : [0, dir];
  }

  private segmentPath(axis: 'x' | 'z', line: number, from: number, dir: 1 | -1, lane: number): Path {
    const to = from + dir;
    const [ax, az] = this.nodePos(axis, line, from);
    const [bx, bz] = this.nodePos(axis, line, to);
    const [dx, dz] = this.dirVec(axis, dir);
    const rx = -dz, rz = dx; // droite
    const offs = laneOffsets(line);
    const off = offs[Math.min(lane, offs.length - 1)];
    const hwA = roadWidth(from) / 2 + 2.5, hwB = roadWidth(to) / 2 + 2.5;
    const p0 = new THREE.Vector3(ax + dx * hwA + rx * off, 0, az + dz * hwA + rz * off);
    const p1 = new THREE.Vector3(bx - dx * hwB + rx * off, 0, bz - dz * hwB + rz * off);
    return mkPath([p0, p1]);
  }

  private turnPath(a: Path, axis: 'x' | 'z', line: number, from: number, dir: 1 | -1, lane: number, center: [number, number] | null): Path {
    const pEnd = a.pts[a.pts.length - 1];
    const nextSeg = this.segmentPath(axis, line, from, dir, lane);
    const pStart = nextSeg.pts[0];
    const pts: THREE.Vector3[] = [pEnd.clone()];
    if (center) {
      // rond-point : tourne dans le sens inverse des aiguilles d'une montre (vu du dessus)
      const [cx, cz] = center;
      const a0 = Math.atan2(pEnd.z - cz, pEnd.x - cx);
      let a1 = Math.atan2(pStart.z - cz, pStart.x - cx);
      while (a1 > a0) a1 -= Math.PI * 2;
      if (a0 - a1 < 0.3) a1 -= Math.PI * 2;
      const R = CENTER_ISLAND_R + 2.6;
      const steps = Math.max(4, Math.ceil((a0 - a1) / 0.25));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const ang = a0 + (a1 - a0) * t;
        const rr = R + (1 - Math.sin(t * Math.PI)) * 2.5;
        pts.push(new THREE.Vector3(cx + Math.cos(ang) * rr, 0, cz + Math.sin(ang) * rr));
      }
    } else {
      const [d1x, d1z] = [pEnd.x - a.pts[0].x, pEnd.z - a.pts[0].z];
      const l1 = Math.hypot(d1x, d1z);
      const ux = d1x / l1, uz = d1z / l1;
      const proj = (pStart.x - pEnd.x) * ux + (pStart.z - pEnd.z) * uz;
      const ctrl = new THREE.Vector3(pEnd.x + ux * proj, 0, pEnd.z + uz * proj);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const q = pEnd.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(ctrl, 2 * (1 - t) * t).addScaledVector(pStart, t * t);
        pts.push(q);
      }
    }
    pts.push(pStart.clone());
    return mkPath(pts);
  }

  /** Phase des feux (axe z/x) pour un carrefour donné. */
  lightPhase(i: number, j: number): { zAxis: 'g' | 'y' | 'r'; xAxis: 'g' | 'y' | 'r' } {
    const t = (this.time + (i * 3.1 + j * 1.7)) % CYCLE;
    const h = CYCLE / 2;
    const zAxis = t < h - 2 ? 'g' : t < h ? 'y' : 'r';
    const xAxis = t < h ? 'r' : t < CYCLE - 2 ? 'g' : 'y';
    return { zAxis, xAxis };
  }

  private hasLight(i: number, j: number): boolean {
    return i > 0 && i < GRID_N && j > 0 && j < GRID_N && !(i === 6 && j === 6);
  }

  private chooseNext(c: Car): void {
    const node = c.from + c.dir; // indice du nœud d'arrivée sur l'axe courant
    const options: { axis: 'x' | 'z'; line: number; from: number; dir: 1 | -1 }[] = [];
    // tout droit
    if (node + c.dir >= 0 && node + c.dir <= GRID_N) options.push({ axis: c.axis, line: c.line, from: node, dir: c.dir });
    // tourner : on passe sur l'autre axe, ligne = node, départ = c.line
    const other: 'x' | 'z' = c.axis === 'x' ? 'z' : 'x';
    for (const d of [1, -1] as const) {
      if (c.line + d >= 0 && c.line + d <= GRID_N) options.push({ axis: other, line: node, from: c.line, dir: d });
    }
    const straightBias = options.length && options[0].axis === c.axis ? 0.55 : 0;
    let pick = options[0];
    if (!(this.r() < straightBias) || options.length === 1) pick = options[Math.floor(this.r() * options.length)];
    const lanes = laneOffsets(pick.line).length;
    c.next = { ...pick, lane: Math.min(c.lane, lanes - 1) };
  }

  private spawnCar(c: Car | null, px: number, pz: number, minD: number, maxD: number): Car {
    // choisir un segment dont le milieu est dans l'anneau [minD, maxD] autour du joueur
    for (let tries = 0; tries < 40; tries++) {
      const axis: 'x' | 'z' = this.r() > 0.5 ? 'x' : 'z';
      const line = Math.floor(this.r() * (GRID_N + 1));
      const from = Math.floor(this.r() * GRID_N);
      const dir: 1 | -1 = this.r() > 0.5 ? 1 : -1;
      const f = dir === 1 ? from : from + 1;
      const [ax, az] = this.nodePos(axis, line, f);
      const [bx, bz] = this.nodePos(axis, line, f + dir);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const d = Math.hypot(mx - px, mz - pz);
      if (d < minD || d > maxD) continue;
      const lane = Math.floor(this.r() * laneOffsets(line).length);
      const path = this.segmentPath(axis, line, f, dir, lane);
      const ring = line === 0 || line === GRID_N;
      const car: Car = c ?? ({} as Car);
      Object.assign(car, {
        axis, line, from: f, dir, lane, path, s: this.r() * path.len * 0.8, speed: 8, vmax: (ring ? 19 : line === 6 ? 15 : 12.5) * (0.85 + this.r() * 0.3),
        inTurn: false, next: null, pos: car.pos ?? new THREE.Vector3(), heading: 0,
        color: car.color ?? new THREE.Color(), type: this.r() > 0.82 ? 1 : 0, honk: 0, nearMissCd: 0, blocked: 0, stopped: false,
      });
      const cols = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2980b9', '#111111', '#d0d3d4', '#16a085', '#f1c40f', '#6d214f', '#3d3d3d'];
      car.color.set(cols[Math.floor(this.r() * cols.length)]);
      this.chooseNext(car);
      return car;
    }
    return c ?? this.spawnCar(null, px, pz, 0, 1e9);
  }

  reset(px: number, pz: number): void {
    this.cars = [];
    for (let i = 0; i < this.count; i++) this.cars.push(this.spawnCar(null, px, pz, 30, 260));
  }

  // ------------------------------------------------------------ simulation
  update(dt: number, px: number, pz: number, bikeVx: number, bikeVz: number, night: number): void {
    this.time += dt;
    const cars = this.cars;
    for (const c of cars) {
      // respawn si trop loin
      if (Math.hypot(c.pos.x - px, c.pos.z - pz) > 330) this.spawnCar(c, px, pz, 140, 280);
      // vitesse cible : feux + véhicule devant + joueur
      let target = c.vmax * (c.inTurn ? 0.55 : 1);
      const remain = c.path.len - c.s;
      if (!c.inTurn) {
        const node = c.from + c.dir;
        const [i, j] = c.axis === 'x' ? [node, c.line] : [c.line, node];
        if (this.hasLight(i, j) && remain < 40) {
          const ph = this.lightPhase(i, j);
          const st = c.axis === 'z' ? ph.zAxis : ph.xAxis;
          if (st === 'r' || (st === 'y' && remain > 8)) target = Math.min(target, Math.max(0, (remain - 1.5) * 0.7));
        }
      }
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      let gap = 1e9;
      for (const o of cars) {
        if (o === c) continue;
        const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z;
        const ahead = dx * fx + dz * fz;
        if (ahead <= 0 || ahead > 30) continue;
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat < 1.9) gap = Math.min(gap, ahead);
      }
      // le joueur
      {
        const dx = px - c.pos.x, dz = pz - c.pos.z;
        const ahead = dx * fx + dz * fz;
        const lat = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 26 && lat < 2.2) {
          gap = Math.min(gap, ahead);
          if (ahead < 9) {
            c.blocked += dt;
            if (c.blocked > 1.6 && c.honk <= 0) {
              c.honk = 4;
              this.onHonk?.(c.pos.x, c.pos.z);
            }
          }
        } else c.blocked = Math.max(0, c.blocked - dt);
      }
      if (gap < 1e9) target = Math.min(target, Math.max(0, (gap - 6.5) * 0.9));
      const acc = target > c.speed ? 2.6 : 7.5;
      c.speed += clamp(target - c.speed, -acc * dt, acc * dt);
      c.honk -= dt;
      c.nearMissCd -= dt;
      c.s += c.speed * dt;
      // fin de chemin
      while (c.s >= c.path.len) {
        c.s -= c.path.len;
        if (!c.inTurn) {
          if (!c.next) this.chooseNext(c);
          const n = c.next!;
          const node = c.from + c.dir;
          const [ni, nj] = c.axis === 'x' ? [node, c.line] : [c.line, node];
          const center: [number, number] | null = ni === 6 && nj === 6 ? [lineCoord(6), lineCoord(6)] : null;
          c.path = this.turnPath(c.path, n.axis, n.line, n.from, n.dir, n.lane, center);
          c.inTurn = true;
        } else {
          const n = c.next!;
          c.axis = n.axis;
          c.line = n.line;
          c.from = n.from;
          c.dir = n.dir;
          c.lane = n.lane;
          c.path = this.segmentPath(n.axis, n.line, n.from, n.dir, n.lane);
          c.inTurn = false;
          c.next = null;
          this.chooseNext(c);
        }
      }
      samplePath(c.path, c.s, c.pos);
      const ahead = new THREE.Vector3();
      samplePath(c.path, Math.min(c.path.len, c.s + 1.5), ahead);
      if (ahead.distanceToSquared(c.pos) > 1e-4) {
        const h = Math.atan2(ahead.x - c.pos.x, ahead.z - c.pos.z);
        let d = h - c.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        c.heading += d * Math.min(1, dt * 8);
      }
      // frôlement
      const rvx = bikeVx - Math.sin(c.heading) * c.speed, rvz = bikeVz - Math.cos(c.heading) * c.speed;
      const rel = Math.hypot(rvx, rvz);
      const dist = Math.hypot(px - c.pos.x, pz - c.pos.z);
      if (dist < 3.2 && dist > 1.6 && rel > 9 && c.nearMissCd <= 0) {
        c.nearMissCd = 3;
        this.onNearMiss?.();
      }
    }
    this.writeInstances(night);
  }

  private writeInstances(night: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const counts = [0, 0];
    for (const c of this.cars) {
      q.setFromAxisAngle(up, c.heading);
      m.compose(new THREE.Vector3(c.pos.x, 0.02, c.pos.z), q, one);
      const k = counts[c.type]++;
      this.bodies[c.type].setMatrixAt(k, m);
      this.bodies[c.type].setColorAt(k, c.color);
      this.glass[c.type].setMatrixAt(k, m);
      this.wheels[c.type].setMatrixAt(k, m);
    }
    for (let t = 0; t < 2; t++) {
      for (const im of [this.bodies[t], this.glass[t], this.wheels[t]]) {
        im.count = counts[t];
        im.instanceMatrix.needsUpdate = true;
      }
      if (this.bodies[t].instanceColor) this.bodies[t].instanceColor!.needsUpdate = true;
    }
    let k = 0;
    for (const c of this.cars) {
      q.setFromAxisAngle(up, c.heading);
      m.compose(new THREE.Vector3(c.pos.x, 0.02 + (c.type === 1 ? 0.3 : 0), c.pos.z), q, one);
      this.lights.setMatrixAt(k, m);
      this.tails.setMatrixAt(k, m);
      k++;
    }
    this.lights.count = this.tails.count = k;
    this.lights.instanceMatrix.needsUpdate = true;
    this.tails.instanceMatrix.needsUpdate = true;
    this.headlightMat.emissiveIntensity = 0.3 + night * 3;
  }

  /** Collision boîte orientée voiture ↔ points de la moto. */
  collide(points: { x: number; z: number }[], bikeVx: number, bikeVz: number, out: TrafficHit): boolean {
    out.crash = false;
    out.pushX = out.pushZ = 0;
    out.relSpeed = 0;
    let hit = false;
    for (const c of this.cars) {
      const s = Math.sin(c.heading), co = Math.cos(c.heading);
      const hx = c.type === 1 ? 1.0 : 0.92, hz = c.type === 1 ? 2.45 : 2.2;
      for (const p of points) {
        const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
        if (dx * dx + dz * dz > 16) continue;
        const lx = dx * co - dz * s, lz = dx * s + dz * co;
        const r = 0.32;
        const ox = hx + r - Math.abs(lx), oz = hz + r - Math.abs(lz);
        if (ox <= 0 || oz <= 0) continue;
        hit = true;
        let nlx = 0, nlz = 0, depth = 0;
        if (ox < oz) {
          nlx = Math.sign(lx) || 1;
          depth = ox;
        } else {
          nlz = Math.sign(lz) || 1;
          depth = oz;
        }
        const nx = nlx * co + nlz * s, nz = -nlx * s + nlz * co;
        out.pushX += nx * depth;
        out.pushZ += nz * depth;
        const cvx = s * c.speed, cvz = co * c.speed;
        const rel = -((bikeVx - cvx) * nx + (bikeVz - cvz) * nz);
        out.relSpeed = Math.max(out.relSpeed, rel);
        if (rel > 5) {
          out.crash = true;
          c.speed = 0;
        }
      }
    }
    return hit;
  }
}

function mkPath(pts: THREE.Vector3[]): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, len: Math.max(0.01, cum[cum.length - 1]), cum };
}

function samplePath(p: Path, s: number, out: THREE.Vector3): void {
  const { pts, cum } = p;
  if (s <= 0) {
    out.copy(pts[0]);
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i]) {
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      out.copy(pts[i - 1]).lerp(pts[i], t);
      return;
    }
  }
  out.copy(pts[pts.length - 1]);
}

export { CURB };

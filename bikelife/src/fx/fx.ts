// Effets visuels : particules (fumée de pneu, poussière, étincelles, gaz
// d'échappement) et traces de pneus au sol.

import * as THREE from 'three';

const MAX = 900;

export type ParticleKind = 'smoke' | 'dust' | 'spark' | 'exhaust' | 'splash';

export class Particles {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private alpha = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grow = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private a0 = new Float32Array(MAX);
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  quality = 1;

  constructor(pixelRatio: number) {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 420 * pixelRatio } },
      vertexShader: `
        attribute vec3 color; attribute float alpha; attribute float size;
        varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard;
          float soft = smoothstep(0.25, 0.0, r); gl_FragColor = vec4(vC, vA * soft); }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(kind: ParticleKind, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0, intensity = 1): void {
    if (Math.random() > this.quality) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const r = () => Math.random() - 0.5;
    this.pos.set([x + r() * 0.2, y, z + r() * 0.2], i * 3);
    let c: [number, number, number];
    switch (kind) {
      case 'smoke':
        c = [0.82, 0.82, 0.84];
        this.vel.set([vx * 0.2 + r() * 1.2, 0.6 + Math.random() * 0.9, vz * 0.2 + r() * 1.2], i * 3);
        this.maxLife[i] = 1.6 + Math.random() * 1.2;
        this.size[i] = 0.5;
        this.grow[i] = 2.4;
        this.grav[i] = -0.25;
        this.a0[i] = 0.45 * intensity;
        break;
      case 'dust':
        c = [0.55, 0.43, 0.3];
        this.vel.set([vx * 0.3 + r() * 2, 0.8 + Math.random() * 1.4, vz * 0.3 + r() * 2], i * 3);
        this.maxLife[i] = 1.0 + Math.random() * 0.8;
        this.size[i] = 0.4;
        this.grow[i] = 1.9;
        this.grav[i] = 1.2;
        this.a0[i] = 0.5 * intensity;
        break;
      case 'spark':
        c = [1.0, 0.7, 0.25];
        this.vel.set([vx * 0.6 + r() * 4, 1 + Math.random() * 3, vz * 0.6 + r() * 4], i * 3);
        this.maxLife[i] = 0.25 + Math.random() * 0.3;
        this.size[i] = 0.06;
        this.grow[i] = 0;
        this.grav[i] = 9;
        this.a0[i] = 1;
        break;
      case 'exhaust':
        c = [0.6, 0.66, 0.78];
        this.vel.set([vx + r() * 0.4, 0.3 + Math.random() * 0.3, vz + r() * 0.4], i * 3);
        this.maxLife[i] = 0.8 + Math.random() * 0.6;
        this.size[i] = 0.12;
        this.grow[i] = 0.9;
        this.grav[i] = -0.2;
        this.a0[i] = 0.18 * intensity;
        break;
      case 'splash':
        c = [0.75, 0.8, 0.85];
        this.vel.set([vx * 0.3 + r() * 1.5, 0.8 + Math.random(), vz * 0.3 + r() * 1.5], i * 3);
        this.maxLife[i] = 0.5;
        this.size[i] = 0.25;
        this.grow[i] = 1.2;
        this.grav[i] = 6;
        this.a0[i] = 0.3 * intensity;
        break;
    }
    this.col.set(c, i * 3);
    this.life[i] = this.maxLife[i];
  }

  update(dt: number, lightLevel: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      const drag = Math.max(0, 1 - dt * 1.6);
      this.vel[k] *= drag;
      this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * (1 - t) * (this.grav[i] > 8 ? 1 : lightLevel);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

const SKID_MAX = 1400;

export class Skidmarks {
  mesh: THREE.Mesh;
  private pos = new Float32Array(SKID_MAX * 4 * 3);
  private alpha = new Float32Array(SKID_MAX * 4);
  private cursor = 0;
  private last: Record<string, THREE.Vector3 | null> = { f: null, r: null };
  private geo: THREE.BufferGeometry;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const idx = new Uint32Array(SKID_MAX * 6);
    for (let i = 0; i < SKID_MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.04,0.04,0.045, vA); }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Ajoute un segment de trace pour la roue `w` ('f' ou 'r'). intensity=0 coupe la trace. */
  add(w: 'f' | 'r', x: number, y: number, z: number, intensity: number, width = 0.14): void {
    const p = new THREE.Vector3(x, y + 0.012, z);
    const prev = this.last[w];
    if (intensity <= 0.05) {
      this.last[w] = null;
      return;
    }
    if (!prev) {
      this.last[w] = p;
      return;
    }
    const d = p.distanceTo(prev);
    if (d < 0.25) return;
    if (d > 3) {
      this.last[w] = p;
      return;
    }
    const dx = (p.x - prev.x) / d, dz = (p.z - prev.z) / d;
    const nx = -dz * width, nz = dx * width;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % SKID_MAX;
    this.pos.set([prev.x + nx, prev.y, prev.z + nz, prev.x - nx, prev.y, prev.z - nz, p.x - nx, p.y, p.z - nz, p.x + nx, p.y, p.z + nz], i * 12);
    const a = Math.min(0.75, intensity * 0.8);
    this.alpha.set([a, a, a, a], i * 4);
    this.last[w] = p;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }

  clear(): void {
    this.alpha.fill(0);
    this.geo.attributes.alpha.needsUpdate = true;
    this.last.f = this.last.r = null;
  }
}

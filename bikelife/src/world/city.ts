// Génération procédurale (déterministe) de la ville : chaussées, trottoirs,
// bâtiments par quartier, parkings (souterrain + étages), stunt park, MX park,
// route de la corniche, mobilier urbain instancié et collisions associées.

import * as THREE from 'three';
import { CollisionWorld, GroundHit, Surface } from '../physics/collision';
import { rng, clamp } from '../core/math';
import { WorldTextures, FacadeTex } from './textures';
import {
  BLOCK, CORNICHE, CURB, GRID_N, MX_ZONE, ORIGIN, PARKING_STRUCT, Rect, SIDEWALK, UNDERGROUND, WORLD_BOUNDS,
  blockDistrict, blockInterior, blockRect, lineCoord, roadWidth, CENTER_ISLAND_R, District,
} from './layout';
import { merge } from '../vehicle/geom';

const CHUNK = 300;

// ------------------------------------------------------------------ batching
class Batches {
  private chunks = new Map<string, { cx: number; cz: number; mats: Map<THREE.Material, THREE.BufferGeometry[]> }>();
  add(x: number, z: number, mat: THREE.Material, geo: THREE.BufferGeometry): void {
    const ix = Math.floor(x / CHUNK), iz = Math.floor(z / CHUNK);
    const k = `${ix},${iz}`;
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, (c = { cx: (ix + 0.5) * CHUNK, cz: (iz + 0.5) * CHUNK, mats: new Map() }));
    let arr = c.mats.get(mat);
    if (!arr) c.mats.set(mat, (arr = []));
    arr.push(geo);
  }
  build(parent: THREE.Object3D, receiveOnly: Set<THREE.Material>): THREE.Group[] {
    const out: THREE.Group[] = [];
    for (const c of this.chunks.values()) {
      const g = new THREE.Group();
      g.userData.cx = c.cx;
      g.userData.cz = c.cz;
      for (const [mat, geos] of c.mats) {
        const m = new THREE.Mesh(merge(geos), mat);
        m.receiveShadow = true;
        m.castShadow = !receiveOnly.has(mat);
        geos.forEach((x) => x.dispose());
        g.add(m);
      }
      parent.add(g);
      out.push(g);
    }
    this.chunks.clear();
    return out;
  }
}

interface PropPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  shadow: boolean;
  colored?: boolean;
}

const ICHUNK = 300;

class Instances {
  types = new Map<string, { parts: PropPart[]; items: { key: string; m: THREE.Matrix4; c: THREE.Color }[] }>();
  define(name: string, parts: PropPart[]): void {
    this.types.set(name, { parts, items: [] });
  }
  add(name: string, x: number, y: number, z: number, yaw = 0, scale = 1, color?: THREE.Color): void {
    const t = this.types.get(name)!;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    t.items.push({ key: `${Math.floor(x / ICHUNK)},${Math.floor(z / ICHUNK)}`, m, c: color ?? new THREE.Color(1, 1, 1) });
  }
  /** Construit des InstancedMesh regroupés par zone (culling par distance et par frustum). */
  build(parent: THREE.Object3D, shadows: boolean): THREE.Group[] {
    const groups = new Map<string, THREE.Group>();
    for (const t of this.types.values()) {
      const byKey = new Map<string, { m: THREE.Matrix4; c: THREE.Color }[]>();
      for (const it of t.items) {
        let arr = byKey.get(it.key);
        if (!arr) byKey.set(it.key, (arr = []));
        arr.push(it);
      }
      for (const [key, items] of byKey) {
        let g = groups.get(key);
        if (!g) {
          const [ix, iz] = key.split(',').map(Number);
          g = new THREE.Group();
          g.userData.cx = (ix + 0.5) * ICHUNK;
          g.userData.cz = (iz + 0.5) * ICHUNK;
          g.userData.r = ICHUNK * 0.75;
          g.userData.props = true;
          groups.set(key, g);
          parent.add(g);
        }
        for (const p of t.parts) {
          const im = new THREE.InstancedMesh(p.geo, p.mat, items.length);
          items.forEach((it, i) => im.setMatrixAt(i, it.m));
          if (p.colored) items.forEach((it, i) => im.setColorAt(i, it.c));
          im.castShadow = shadows && p.shadow;
          im.receiveShadow = true;
          im.computeBoundingSphere();
          g.add(im);
        }
      }
    }
    return [...groups.values()];
  }
}

// ------------------------------------------------------------------ géométrie monde
function hQuad(x0: number, z0: number, x1: number, z1: number, y: number, su = 4, sv = 4, uv?: (x: number, z: number) => [number, number]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const p = [x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0];
  const f = uv ?? ((x: number, z: number) => [x / su, z / sv] as [number, number]);
  const uvs = [...f(x0, z0), ...f(x0, z1), ...f(x1, z1), ...f(x1, z0)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Quad vertical entre (x0,z0) et (x1,z1), de y0 à y1, face vers la normale (droite du segment). */
function vQuad(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, su: number, sv: number, u0 = 0): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const nx = (z1 - z0) / len, nz = -(x1 - x0) / len;
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, y0 / sv, u0 + len / su, y0 / sv, u0 + len / su, y1 / sv, u0, y1 / sv], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

/** Boîte axis-aligned en coordonnées monde, UV en mètres. */
function boxGeo(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, su = 4, sv = 4): THREE.BufferGeometry {
  const parts = [
    vQuad(x0, z1, x0, z0, y0, y1, su, sv),
    vQuad(x1, z0, x1, z1, y0, y1, su, sv),
    vQuad(x0, z0, x1, z0, y0, y1, su, sv),
    vQuad(x1, z1, x0, z1, y0, y1, su, sv),
    hQuad(x0, z0, x1, z1, y1, su, sv),
  ];
  return merge(parts);
}

/** Mesh d'une rampe à profil (z local, h) extrudée sur sa largeur, en monde. */
function profileGeo(x: number, z: number, hx: number, yaw: number, y0: number, pts: [number, number][], su = 3): THREE.BufferGeometry {
  const zc = (pts[0][0] + pts[pts.length - 1][0]) / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let v = 0;
  const push = (lx: number, ly: number, lz: number, u: number, w: number) => {
    pos.push(lx, ly, lz - zc);
    uv.push(u, w);
    return v++;
  };
  // dessus
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [za, ha] = pts[i], [zb, hb] = pts[i + 1];
    const seg = Math.hypot(zb - za, hb - ha);
    const a = push(-hx, ha, za, -hx / su, acc / su), b = push(hx, ha, za, hx / su, acc / su);
    const c = push(hx, hb, zb, hx / su, (acc + seg) / su), d = push(-hx, hb, zb, -hx / su, (acc + seg) / su);
    idx.push(a, d, c, a, c, b);
    acc += seg;
  }
  // flancs
  for (const sx of [-1, 1]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [za, ha] = pts[i], [zb, hb] = pts[i + 1];
      const a = push(sx * hx, 0, za, za / su, 0), b = push(sx * hx, 0, zb, zb / su, 0);
      const c = push(sx * hx, hb, zb, zb / su, hb / su), d = push(sx * hx, ha, za, za / su, ha / su);
      if (sx > 0) idx.push(a, b, c, a, c, d);
      else idx.push(a, c, b, a, d, c);
    }
  }
  // faces avant/arrière
  for (const end of [0, pts.length - 1]) {
    const [ze, he] = pts[end];
    if (he < 0.01) continue;
    const a = push(-hx, 0, ze, 0, 0), b = push(hx, 0, ze, 2 * hx / su, 0), c = push(hx, he, ze, 2 * hx / su, he / su), d = push(-hx, he, ze, 0, he / su);
    if (end === 0) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Matrix4().makeRotationY(yaw);
  const zcW = zc;
  g.applyMatrix4(m);
  g.translate(x + Math.sin(yaw) * zcW, y0, z + Math.cos(yaw) * zcW);
  return g;
}

function prismRoof(x0: number, z0: number, x1: number, z1: number, y: number, h: number, alongX: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const o = 0.4;
  if (alongX) {
    pos.push(x0 - o, y, z0 - o, x1 + o, y, z0 - o, x1 + o, y + h, cz, x0 - o, y, z0 - o, x1 + o, y + h, cz, x0 - o, y + h, cz);
    pos.push(x1 + o, y, z1 + o, x0 - o, y, z1 + o, x0 - o, y + h, cz, x1 + o, y, z1 + o, x0 - o, y + h, cz, x1 + o, y + h, cz);
    pos.push(x0, y, z0, x0, y + h, cz, x0, y, z1);
    pos.push(x1, y, z1, x1, y + h, cz, x1, y, z0);
  } else {
    pos.push(x1 + o, y, z0 - o, x1 + o, y, z1 + o, cx, y + h, z1 + o, x1 + o, y, z0 - o, cx, y + h, z1 + o, cx, y + h, z0 - o);
    pos.push(x0 - o, y, z1 + o, x0 - o, y, z0 - o, cx, y + h, z0 - o, x0 - o, y, z1 + o, cx, y + h, z0 - o, cx, y + h, z1 + o);
    pos.push(x0, y, z1, cx, y + h, z1, x1, y, z1);
    pos.push(x1, y, z0, cx, y + h, z0, x0, y, z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 3 + pos[i + 2] / 3, pos[i + 1] / 3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ ville
export interface NightMat {
  mat: THREE.MeshStandardMaterial;
  base: number;
}

export interface LampInfo {
  x: number;
  z: number;
}

export interface TrafficLightInfo {
  i: number;
  j: number;
  x: number;
  z: number;
}

export class City {
  group = new THREE.Group();
  world: CollisionWorld;
  tex: WorldTextures;
  chunks: THREE.Group[] = [];
  nightMats: NightMat[] = [];
  wetMats: { mat: THREE.MeshStandardMaterial; dry: number }[] = [];
  lamps: LampInfo[] = [];
  trafficLights: TrafficLightInfo[] = [];
  lightPools!: THREE.InstancedMesh;
  lightPoolMat!: THREE.MeshBasicMaterial;
  bulbs: THREE.InstancedMesh | null = null;
  bulbIndex = new Map<string, number[]>();
  minimap: HTMLCanvasElement;
  readonly mapScale = 0.5; // px par mètre
  private batches = new Batches();
  private inst = new Instances();
  private r = rng(1337);
  private m!: Record<string, THREE.MeshStandardMaterial>;
  private facadeMats: Record<string, THREE.MeshStandardMaterial> = {};
  private receiveOnly = new Set<THREE.Material>();
  private mapCtx: CanvasRenderingContext2D;
  private shadowsProps: boolean;

  constructor(world: CollisionWorld, opts: { propShadows: boolean }) {
    this.world = world;
    this.shadowsProps = opts.propShadows;
    this.tex = new WorldTextures();
    this.minimap = document.createElement('canvas');
    this.minimap.width = Math.round((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * this.mapScale);
    this.minimap.height = Math.round((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * this.mapScale);
    this.mapCtx = this.minimap.getContext('2d')!;
    this.mapCtx.fillStyle = '#3d5a34';
    this.mapCtx.fillRect(0, 0, this.minimap.width, this.minimap.height);
    this.makeMaterials();
    this.defineProps();
    this.setupBaseGround();
    this.build();
  }

  // --------------------------------------------------------------- matériaux
  private makeMaterials(): void {
    const T = this.tex;
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    this.m = {
      asphalt: std({ map: T.asphalt, roughness: 0.92 }),
      road: std({ map: T.road, roughness: 0.9 }),
      roadMain: std({ map: T.roadMain, roughness: 0.9 }),
      sidewalk: std({ map: T.sidewalk, roughness: 0.85 }),
      curb: std({ color: '#b9b6ae', roughness: 0.8 }),
      concrete: std({ map: T.concrete, roughness: 0.88 }),
      grass: std({ map: T.grass, roughness: 0.95 }),
      dirt: std({ map: T.dirt, roughness: 1 }),
      roof: std({ map: T.roof, roughness: 0.9 }),
      tile: std({ color: '#9c4a2f', roughness: 0.8 }),
      tileGray: std({ color: '#4d5257', roughness: 0.8 }),
      wood: std({ map: T.wood, roughness: 0.75 }),
      parking: std({ map: T.parkingLines, roughness: 0.9 }),
      metal: std({ map: T.metalSiding, roughness: 0.5, metalness: 0.6 }),
      darkGlass: std({ color: '#1d242c', roughness: 0.15, metalness: 0.6 }),
      door: std({ color: '#3a3d42', roughness: 0.6, metalness: 0.5 }),
      white: std({ color: '#ececec', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      yellow: std({ color: '#e0b322', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      rubber: std({ color: '#1a1a1a', roughness: 0.95 }),
      railing: std({ color: '#c9ced3', roughness: 0.35, metalness: 0.9 }),
      water: std({ color: '#3d7fa6', roughness: 0.05, metalness: 0.3 }),
      undergroundFloor: std({ map: T.parkingLines, roughness: 0.8, color: '#9a9a9a' }),
      hay: std({ color: '#d2b55b', roughness: 1 }),
      banner: std({ color: '#ff2bd6', roughness: 0.6 }),
      pit: std({ color: '#6f6d68', roughness: 0.9 }),
    };
    for (const k of ['asphalt', 'road', 'roadMain', 'sidewalk', 'concrete', 'grass', 'dirt', 'parking', 'white', 'yellow', 'undergroundFloor', 'water']) this.receiveOnly.add(this.m[k]);
    for (const k of ['asphalt', 'road', 'roadMain', 'sidewalk', 'concrete', 'parking']) this.wetMats.push({ mat: this.m[k], dry: this.m[k].roughness });
    for (const [key, f] of Object.entries(T.facades)) {
      const mat = std({ map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: key === 'glass' ? 0.2 : 0.75, metalness: key === 'glass' ? 0.5 : 0.05 });
      this.facadeMats[key] = mat;
      this.nightMats.push({ mat, base: key === 'industrial' ? 0 : 1.1 });
    }
    const signMat = std({ map: T.signAtlas, emissiveMap: T.signAtlas, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.15, roughness: 0.5 });
    this.m.sign = signMat;
    this.nightMats.push({ mat: signMat, base: 1.4 });
    this.m.graffiti = std({ map: T.graffitiAtlas, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.m.container = std({ map: T.containers[0], roughness: 0.6, metalness: 0.4 });
    const ul = std({ color: '#fdf6e3', emissive: new THREE.Color('#fff3d6'), emissiveIntensity: 1.6 });
    this.m.underLight = ul;
    this.containerMats = T.containers.map((t) => std({ map: t, roughness: 0.6, metalness: 0.4 }));
  }

  private containerMats: THREE.MeshStandardMaterial[] = [];

  private fac(key: string): [THREE.MeshStandardMaterial, FacadeTex] {
    return [this.facadeMats[key], this.tex.facades[key]];
  }

  // --------------------------------------------------------------- props instanciés
  private defineProps(): void {
    const std = (c: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    const poleMat = std('#3b3f45', 0.4, 0.8);
    const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.1 });
    this.nightMats.push({ mat: lampHeadMat, base: 3 });
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0);
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5).rotateZ(Math.PI / 2).translate(-0.9, 7.4, 0);
    const head = new THREE.BoxGeometry(0.7, 0.16, 0.32).translate(-1.6, 7.3, 0);
    this.inst.define('lamp', [
      { geo: merge([pole, arm]), mat: poleMat, shadow: true },
      { geo: head, mat: lampHeadMat, shadow: false },
    ]);
    // arbres
    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).translate(0, 1.6, 0);
    const fol1 = new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.2, 0);
    const fol2 = new THREE.IcosahedronGeometry(1.6, 0).translate(0.7, 5.3, 0.3);
    const fol3 = new THREE.IcosahedronGeometry(1.4, 0).translate(-0.8, 5.0, -0.4);
    const folMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
    this.inst.define('tree', [
      { geo: trunk, mat: std('#5b4330', 0.9), shadow: true },
      { geo: merge([fol1, fol2, fol3]), mat: folMat, shadow: true, colored: true },
    ]);
    this.inst.define('bush', [{ geo: new THREE.IcosahedronGeometry(0.9, 1).scale(1.3, 0.8, 1.3).translate(0, 0.6, 0), mat: folMat, shadow: true, colored: true }]);
    this.inst.define('bench', [
      { geo: merge([new THREE.BoxGeometry(1.8, 0.08, 0.45).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.4, 0.06).translate(0, 0.7, -0.2)]), mat: std('#7a5333', 0.8), shadow: true },
      { geo: merge([new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(-0.8, 0.22, 0), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(0.8, 0.22, 0)]), mat: poleMat, shadow: true },
    ]);
    this.inst.define('bin', [{ geo: new THREE.CylinderGeometry(0.28, 0.25, 0.9, 10).translate(0, 0.45, 0), mat: std('#2f6b3a', 0.6, 0.3), shadow: true }]);
    this.inst.define('hydrant', [{ geo: merge([new THREE.CylinderGeometry(0.13, 0.15, 0.7, 8).translate(0, 0.35, 0), new THREE.SphereGeometry(0.14, 8, 6).translate(0, 0.72, 0)]), mat: std('#c0392b', 0.5, 0.2), shadow: true }]);
    this.inst.define('bollard', [{ geo: new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6).translate(0, 0.45, 0), mat: poleMat, shadow: false }]);
    this.inst.define('cone', [{ geo: new THREE.ConeGeometry(0.22, 0.6, 8).translate(0, 0.3, 0), mat: std('#ff6a00', 0.5), shadow: false }]);
    this.inst.define('dumpster', [{ geo: new THREE.BoxGeometry(1.9, 1.3, 1.1).translate(0, 0.65, 0), mat: std('#2c5e3f', 0.6, 0.4), shadow: true }]);
    this.inst.define('tire', [{ geo: new THREE.TorusGeometry(0.42, 0.18, 6, 12).rotateX(Math.PI / 2).translate(0, 0.18, 0), mat: std('#161616', 0.95), shadow: true }]);
    this.inst.define('hay', [{ geo: new THREE.BoxGeometry(1.2, 0.6, 0.6).translate(0, 0.3, 0), mat: this.m.hay, shadow: true }]);
    // feux de circulation
    this.inst.define('tlight', [
      { geo: merge([new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6).translate(0, 2.1, 0), new THREE.BoxGeometry(0.32, 0.95, 0.3).translate(0, 3.6, 0)]), mat: std('#22252a', 0.5, 0.6), shadow: true },
    ]);
    // voitures garées (carrosserie colorée + vitres)
    const body = merge([
      new THREE.BoxGeometry(1.8, 0.62, 4.3).translate(0, 0.62, 0),
      new THREE.BoxGeometry(1.6, 0.5, 2.2).translate(0, 1.18, -0.2),
    ]);
    const glass = merge([
      new THREE.BoxGeometry(1.62, 0.42, 2.0).translate(0, 1.18, -0.2),
    ]);
    const wheels = merge([-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10).rotateZ(Math.PI / 2).translate(sx * 0.8, 0.33, sz * 1.35))));
    this.inst.define('car', [
      { geo: body, mat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.5 }), shadow: true, colored: true },
      { geo: glass.scale(1.01, 1.0, 1.01), mat: std('#14191f', 0.1, 0.6), shadow: false },
      { geo: wheels, mat: std('#121212', 0.9), shadow: false },
    ]);
  }

  // --------------------------------------------------------------- sol de base
  private setupBaseGround(): void {
    const pit = UNDERGROUND.pit;
    const cityMin = ORIGIN - 14, cityMax = ORIGIN + GRID_N * BLOCK + 14;
    this.world.base = (x: number, z: number, out: GroundHit) => {
      out.id = -1;
      if (x > pit.x0 && x < pit.x1 && z > pit.z0 && z < pit.z1) {
        out.h = UNDERGROUND.floor;
        out.surf = 'concrete';
        return;
      }
      out.h = 0;
      if (x > cityMin && x < cityMax && z > cityMin && z < cityMax) out.surf = 'asphalt';
      else if (x > MX_ZONE.x0 && x < MX_ZONE.x1 && z > MX_ZONE.z0 - 40 && z < MX_ZONE.z1) out.surf = 'dirt';
      else if (Math.abs(x - CORNICHE.x) < CORNICHE.width / 2 + 0.5 && z < CORNICHE.z0 + 10) out.surf = 'asphalt';
      else if (Math.abs(x) < 6 && z > cityMax - 20 && z < MX_ZONE.z0) out.surf = 'dirt';
      else out.surf = 'grass';
    };
    this.world.bounds = { ...WORLD_BOUNDS };
  }

  // --------------------------------------------------------------- construction
  private build(): void {
    this.buildRoads();
    for (let bx = 0; bx < GRID_N; bx++) for (let bz = 0; bz < GRID_N; bz++) this.buildBlock(bx, bz);
    this.buildCenterRoundabout();
    this.buildOutskirts();
    this.buildMXPark();
    this.buildCorniche();
    this.chunks = this.batches.build(this.group, this.receiveOnly);
    for (const c of this.chunks) c.userData.r = CHUNK * 0.75;
    this.chunks.push(...this.inst.build(this.group, this.shadowsProps));
    this.buildLightPools();
    this.buildTrafficBulbs();
  }

  private mapRect(x0: number, z0: number, x1: number, z1: number, color: string): void {
    const s = this.mapScale;
    this.mapCtx.fillStyle = color;
    this.mapCtx.fillRect((x0 - WORLD_BOUNDS.minX) * s, (z0 - WORLD_BOUNDS.minZ) * s, (x1 - x0) * s, (z1 - z0) * s);
  }

  // ----- chaussées
  private buildRoads(): void {
    const n = GRID_N;
    const cmin = lineCoord(0), cmax = lineCoord(n);
    for (let i = 0; i <= n; i++) {
      const c = lineCoord(i);
      const w = roadWidth(i);
      const mat = w >= 22 ? this.m.roadMain : this.m.road;
      for (let j = 0; j < n; j++) {
        const a = lineCoord(j) + roadWidth(j) / 2, b = lineCoord(j + 1) - roadWidth(j + 1) / 2;
        // route verticale (x = c)
        this.batches.add(c, (a + b) / 2, mat, hQuad(c - w / 2, a, c + w / 2, b, 0, 1, 1, (x, z) => [(x - (c - w / 2)) / w, z / 12]));
        // route horizontale (z = c)
        this.batches.add((a + b) / 2, c, mat, hQuad(a, c - w / 2, b, c + w / 2, 0, 1, 1, (x, z) => [(z - (c - w / 2)) / w, x / 12]));
        this.mapRect(c - w / 2, a, c + w / 2, b, '#2b2d31');
        this.mapRect(a, c - w / 2, b, c + w / 2, '#2b2d31');
      }
      for (let j = 0; j <= n; j++) {
        const cz = lineCoord(j), wz = roadWidth(j);
        this.batches.add(c, cz, this.m.asphalt, hQuad(c - w / 2, cz - wz / 2, c + w / 2, cz + wz / 2, 0, 8, 8));
        this.mapRect(c - w / 2, cz - wz / 2, c + w / 2, cz + wz / 2, '#2b2d31');
        // passages piétons + feux
        const ring = i === 0 || i === n || j === 0 || j === n;
        if (!ring && !(i === 6 && j === 6)) {
          this.crosswalks(c, cz, w, wz);
          this.trafficLights.push({ i, j, x: c, z: cz });
          this.inst.add('tlight', c - w / 2 - 1.2, CURB, cz - wz / 2 - 1.2, 0);
          this.inst.add('tlight', c + w / 2 + 1.2, CURB, cz + wz / 2 + 1.2, Math.PI);
        }
      }
    }
    void cmin;
    void cmax;
  }

  private crosswalks(cx: number, cz: number, wx: number, wz: number): void {
    const stripes: THREE.BufferGeometry[] = [];
    for (const sd of [-1, 1]) {
      // traversées de la route verticale (bandes parallèles à z)
      const zc = cz + sd * (wz / 2 + 2.2);
      for (let x = cx - wx / 2 + 1; x < cx + wx / 2 - 0.6; x += 1.2) stripes.push(hQuad(x, zc - 1.6, x + 0.6, zc + 1.6, 0.012));
      const xc = cx + sd * (wx / 2 + 2.2);
      for (let z = cz - wz / 2 + 1; z < cz + wz / 2 - 0.6; z += 1.2) stripes.push(hQuad(xc - 1.6, z, xc + 1.6, z + 0.6, 0.012));
    }
    this.batches.add(cx, cz, this.m.white, merge(stripes));
  }

  private buildCenterRoundabout(): void {
    const x = lineCoord(6), z = lineCoord(6);
    const r = CENTER_ISLAND_R;
    const island = new THREE.CylinderGeometry(r, r, 0.35, 32).translate(x, 0.175, z);
    this.batches.add(x, z, this.m.curb, island);
    const top = new THREE.CircleGeometry(r - 0.4, 32).rotateX(-Math.PI / 2).translate(x, 0.36, z);
    this.batches.add(x, z, this.m.grass, top);
    this.world.addCylinder({ x, z, r, y1: 0.35, surf: 'grass', solid: true });
    // monument
    const pillar = merge([new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8).translate(x, 0.95, z), new THREE.CylinderGeometry(0.45, 0.6, 9, 8).translate(x, 6, z), new THREE.SphereGeometry(0.8, 12, 8).translate(x, 11, z)]);
    this.batches.add(x, z, this.m.concrete, pillar);
    this.world.addCylinder({ x, z, r: 1.8, y0: 0, y1: 11, surf: 'concrete' });
    this.mapCircle(x, z, r, '#4f7a3b');
  }

  private mapCircle(x: number, z: number, r: number, color: string): void {
    const s = this.mapScale;
    this.mapCtx.fillStyle = color;
    this.mapCtx.beginPath();
    this.mapCtx.arc((x - WORLD_BOUNDS.minX) * s, (z - WORLD_BOUNDS.minZ) * s, r * s, 0, Math.PI * 2);
    this.mapCtx.fill();
  }

  // ----- blocs
  private platform(rect: Rect, surf: Surface, interiorMat: THREE.Material, skipCollider = false): void {
    const { x0, z0, x1, z1 } = rect;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!skipCollider) this.world.addBox({ x: cx, z: cz, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y1: CURB, surf: 'concrete' });
    const S = SIDEWALK;
    const sw = [hQuad(x0, z0, x1, z0 + S, CURB, 2, 2), hQuad(x0, z1 - S, x1, z1, CURB, 2, 2), hQuad(x0, z0 + S, x0 + S, z1 - S, CURB, 2, 2), hQuad(x1 - S, z0 + S, x1, z1 - S, CURB, 2, 2)];
    this.batches.add(cx, cz, this.m.sidewalk, merge(sw));
    const curbs = [vQuad(x0, z0, x1, z0, 0, CURB, 1, 1), vQuad(x1, z1, x0, z1, 0, CURB, 1, 1), vQuad(x0, z1, x0, z0, 0, CURB, 1, 1), vQuad(x1, z0, x1, z1, 0, CURB, 1, 1)];
    this.batches.add(cx, cz, this.m.curb, merge(curbs));
    const I = { x0: x0 + S, z0: z0 + S, x1: x1 - S, z1: z1 - S };
    this.batches.add(cx, cz, interiorMat, hQuad(I.x0, I.z0, I.x1, I.z1, CURB + 0.003, 6, 6));
    if (surf !== 'concrete') this.surfacePatch(I, surf);
    this.mapRect(x0, z0, x1, z1, '#8f8b84');
  }

  private surfacePatch(r: Rect, surf: Surface, top = CURB + 0.004): void {
    this.world.addBox({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2, y0: 0, y1: top, surf, solid: false });
  }

  private building(x0: number, z0: number, x1: number, z1: number, h: number, facade: string, y0 = CURB, roof = true, collide = true): void {
    const [mat, ft] = this.fac(facade);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sides = [
      vQuad(x0, z0, x1, z0, y0, y0 + h, ft.tileW, ft.tileH),
      vQuad(x1, z0, x1, z1, y0, y0 + h, ft.tileW, ft.tileH),
      vQuad(x1, z1, x0, z1, y0, y0 + h, ft.tileW, ft.tileH),
      vQuad(x0, z1, x0, z0, y0, y0 + h, ft.tileW, ft.tileH),
    ];
    this.batches.add(cx, cz, mat, merge(sides));
    if (roof) this.batches.add(cx, cz, this.m.roof, hQuad(x0, z0, x1, z1, y0 + h, 6, 6));
    if (collide) this.world.addBox({ x: cx, z: cz, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: y0 - CURB, y1: y0 + h, surf: 'concrete' });
    this.mapRect(x0, z0, x1, z1, facade === 'industrial' ? '#6f7478' : '#5e5a55');
  }

  private rooftop(x0: number, z0: number, x1: number, z1: number, y: number): void {
    const n = 1 + Math.floor(this.r() * 3);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const w = 2 + this.r() * 4, d = 2 + this.r() * 4, hh = 1 + this.r() * 2.5;
      const x = x0 + 2 + this.r() * Math.max(0.1, x1 - x0 - w - 4), z = z0 + 2 + this.r() * Math.max(0.1, z1 - z0 - d - 4);
      parts.push(boxGeo(x, y, z, x + w, y + hh, z + d, 3, 3));
    }
    this.batches.add((x0 + x1) / 2, (z0 + z1) / 2, this.m.concrete, merge(parts));
  }

  private sign(x: number, z: number, y: number, w: number, yaw: number): void {
    // panneau d'enseigne collé à la façade, orienté selon yaw (normale)
    const idx = Math.floor(this.r() * this.tex.signCount);
    const g = new THREE.PlaneGeometry(w, 0.9);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const n = this.tex.signCount;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (idx + 1 - uv.getY(i)) / n);
    g.rotateY(yaw);
    g.translate(x, y, z);
    this.batches.add(x, z, this.m.sign, g);
  }

  private graffiti(x: number, z: number, y: number, w: number, yaw: number): void {
    const idx = Math.floor(this.r() * this.tex.graffitiCount);
    const g = new THREE.PlaneGeometry(w, w / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const n = this.tex.graffitiCount;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (idx + 1 - uv.getY(i)) / n);
    g.rotateY(yaw);
    g.translate(x, y, z);
    this.batches.add(x, z, this.m.graffiti, g);
  }

  private tree(x: number, z: number, y = CURB, s = 1): void {
    const hue = 0.22 + this.r() * 0.1;
    const col = new THREE.Color().setHSL(hue, 0.45 + this.r() * 0.2, 0.25 + this.r() * 0.12);
    this.inst.add('tree', x, y, z, this.r() * 6.28, s * (0.8 + this.r() * 0.5), col);
    this.world.addCylinder({ x, z, r: 0.3 * s, y0: y, y1: y + 4, surf: 'wood' });
    this.mapCircle(x, z, 2.2 * s, '#3f6a33');
  }

  private lamp(x: number, z: number, yaw: number, y = CURB): void {
    this.inst.add('lamp', x, y, z, yaw);
    this.world.addCylinder({ x, z, r: 0.14, y0: y, y1: y + 7.5, surf: 'metal' });
    // la tête de lampe est décalée de 1.6 m le long de -x local
    this.lamps.push({ x: x - Math.cos(yaw) * 1.6, z: z + Math.sin(yaw) * 1.6 });
  }

  private parkedCar(x: number, z: number, yaw: number, y = CURB): void {
    const cols = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2980b9', '#16a085', '#111111', '#f39c12', '#8e44ad', '#d0d3d4'];
    this.inst.add('car', x, y, z, yaw, 1, new THREE.Color(cols[Math.floor(this.r() * cols.length)]));
    this.world.addBox({ x, z, hx: 0.9, hz: 2.15, yaw, y0: y, y1: y + 1.45, surf: 'metal', tag: 'car' });
  }

  private buildBlock(bx: number, bz: number): void {
    const d = blockDistrict(bx, bz);
    const R = blockRect(bx, bz);
    const I = blockInterior(bx, bz);
    const interiorMat: Record<District, THREE.Material> = {
      downtown: this.m.concrete, commercial: this.m.parking, residential: this.m.grass, cite: this.m.asphalt, industrial: this.m.concrete,
      park: this.m.grass, plaza: this.m.concrete, stunt: this.m.concrete, training: this.m.asphalt, parking: this.m.asphalt, garage: this.m.concrete, mall: this.m.parking,
    };
    const surfMap: Partial<Record<District, Surface>> = { residential: 'grass', park: 'grass', cite: 'asphalt', training: 'asphalt', parking: 'asphalt', commercial: 'asphalt', mall: 'asphalt' };
    if (d === 'plaza') this.buildPlaza(R, I);
    else this.platform(R, surfMap[d] ?? 'concrete', interiorMat[d]);
    this.streetFurniture(R, d);
    switch (d) {
      case 'downtown': this.downtown(I, bx, bz); break;
      case 'commercial': this.commercial(I, false); break;
      case 'mall': this.mall(I); break;
      case 'residential': this.residential(I); break;
      case 'cite': this.cite(I); break;
      case 'industrial': this.industrial(I); break;
      case 'park': this.park(I); break;
      case 'stunt': this.stuntPark(I); break;
      case 'training': this.training(I); break;
      case 'parking': this.parkingStructure(I); break;
      case 'garage': this.garageBlock(I); break;
      default: break;
    }
    const mapCol: Record<District, string> = {
      downtown: '#77736c', commercial: '#8a8379', residential: '#55794a', cite: '#7c7a74', industrial: '#7b7f82', park: '#4f8a3f', plaza: '#a29d93',
      stunt: '#b0aaa0', training: '#4a4c50', parking: '#6d6a66', garage: '#8a8379', mall: '#6a6c70',
    };
    if (d === 'park' || d === 'residential' || d === 'stunt' || d === 'training') this.mapRect(I.x0, I.z0, I.x1, I.z1, mapCol[d]);
  }

  private streetFurniture(R: Rect, d: District): void {
    const step = 30;
    const off = 0.9;
    const greenery = d === 'downtown' || d === 'commercial' || d === 'garage' || d === 'plaza' || d === 'cite';
    // lampadaires le long des 4 côtés (bras vers la chaussée)
    for (let x = R.x0 + 8; x < R.x1 - 4; x += step) {
      this.lamp(x, R.z0 + off, -Math.PI / 2);
      this.lamp(x + step / 2, R.z1 - off, Math.PI / 2);
    }
    for (let z = R.z0 + 8; z < R.z1 - 4; z += step) {
      this.lamp(R.x0 + off, z + step / 2, 0);
      this.lamp(R.x1 - off, z, Math.PI);
    }
    if (greenery) {
      for (let x = R.x0 + 15; x < R.x1 - 8; x += 18) {
        if (this.r() > 0.25) this.tree(x, R.z0 + 2.2, CURB, 0.75);
        if (this.r() > 0.25) this.tree(x + 6, R.z1 - 2.2, CURB, 0.75);
      }
    }
    // bancs, poubelles, bornes
    for (let i = 0; i < 3; i++) {
      const side = Math.floor(this.r() * 4);
      const t = 0.2 + this.r() * 0.6;
      const [x, z, yaw] = side === 0 ? [R.x0 + (R.x1 - R.x0) * t, R.z0 + 3, 0] : side === 1 ? [R.x0 + (R.x1 - R.x0) * t, R.z1 - 3, Math.PI] : side === 2 ? [R.x0 + 3, R.z0 + (R.z1 - R.z0) * t, Math.PI / 2] : [R.x1 - 3, R.z0 + (R.z1 - R.z0) * t, -Math.PI / 2];
      this.inst.add(this.r() > 0.5 ? 'bench' : 'bin', x, CURB, z, yaw);
    }
    if (this.r() > 0.5) this.inst.add('hydrant', R.x0 + 1.4, CURB, R.z0 + 6, 0);
  }

  private downtown(I: Rect, bx: number, bz: number): void {
    const center = 1 - Math.min(1, Math.hypot(bx - 5.5, bz - 5.5) / 3.2);
    const alongX = this.r() > 0.5;
    const midX = (I.x0 + I.x1) / 2, midZ = (I.z0 + I.z1) / 2;
    const lots: Rect[] = alongX
      ? [{ x0: I.x0, z0: I.z0, x1: midX - 0.5, z1: midZ - 3 }, { x0: midX + 0.5, z0: I.z0, x1: I.x1, z1: midZ - 3 }, { x0: I.x0, z0: midZ + 3, x1: midX - 0.5, z1: I.z1 }, { x0: midX + 0.5, z0: midZ + 3, x1: I.x1, z1: I.z1 }]
      : [{ x0: I.x0, z0: I.z0, x1: midX - 3, z1: midZ - 0.5 }, { x0: midX + 3, z0: I.z0, x1: I.x1, z1: midZ - 0.5 }, { x0: I.x0, z0: midZ + 0.5, x1: midX - 3, z1: I.z1 }, { x0: midX + 3, z0: midZ + 0.5, x1: I.x1, z1: I.z1 }];
    for (const L of lots) {
      const h = 28 + this.r() * 40 + center * 70;
      const fac = this.r() > 0.45 ? 'glass' : 'office';
      if (this.r() > 0.4) {
        this.building(L.x0 + 0.5, L.z0 + 0.5, L.x1 - 0.5, L.z1 - 0.5, 8, 'shop', CURB, true);
        this.building(L.x0 + 3, L.z0 + 3, L.x1 - 3, L.z1 - 3, h, fac, CURB + 8, true, false);
        this.world.addBox({ x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, hx: (L.x1 - L.x0) / 2 - 3, hz: (L.z1 - L.z0) / 2 - 3, y0: CURB + 8, y1: CURB + 8 + h });
        this.rooftop(L.x0 + 3, L.z0 + 3, L.x1 - 3, L.z1 - 3, CURB + 8 + h);
      } else {
        this.building(L.x0 + 1, L.z0 + 1, L.x1 - 1, L.z1 - 1, h, fac);
        this.rooftop(L.x0 + 1, L.z0 + 1, L.x1 - 1, L.z1 - 1, CURB + h);
      }
    }
    // ruelle : bennes + graffitis
    if (alongX) {
      this.inst.add('dumpster', I.x0 + 8, CURB, midZ - 1.6, 0);
      this.world.addBox({ x: I.x0 + 8, z: midZ - 1.6, hx: 0.95, hz: 0.55, y0: CURB, y1: CURB + 1.3 });
      this.graffiti(I.x0 + 18, midZ - 2.96, CURB + 2.4, 7, 0);
      this.graffiti(I.x1 - 18, midZ + 2.96, CURB + 2.4, 7, Math.PI);
    } else {
      this.inst.add('dumpster', midX - 1.6, CURB, I.z0 + 8, Math.PI / 2);
      this.world.addBox({ x: midX - 1.6, z: I.z0 + 8, hx: 0.55, hz: 0.95, y0: CURB, y1: CURB + 1.3 });
      this.graffiti(midX - 2.96, I.z0 + 20, CURB + 2.4, 7, Math.PI / 2);
    }
  }

  private commercial(I: Rect, sparse: boolean): void {
    const depth = 15;
    const sides: { a: number; b: number; fixed: number; dir: 'n' | 's' | 'w' | 'e' }[] = [
      { a: I.x0, b: I.x1, fixed: I.z0, dir: 'n' },
      { a: I.x0, b: I.x1, fixed: I.z1, dir: 's' },
      { a: I.z0 + depth, b: I.z1 - depth, fixed: I.x0, dir: 'w' },
      { a: I.z0 + depth, b: I.z1 - depth, fixed: I.x1, dir: 'e' },
    ];
    const gapSide = Math.floor(this.r() * 4);
    sides.forEach((s, si) => {
      let p = s.a;
      let gapDone = false;
      while (p < s.b - 6) {
        const w = Math.min(s.b - p, 10 + this.r() * 12);
        const isGap: boolean = si === gapSide && !gapDone && p > (s.a + s.b) / 2 - 12;
        if (isGap || (sparse && this.r() > 0.6)) {
          gapDone = gapDone || isGap;
          p += w;
          continue;
        }
        const h = 7 + this.r() * 16;
        const fac = this.r() > 0.5 ? 'brick' : this.r() > 0.5 ? 'apartment' : 'shop';
        let x0: number, x1: number, z0: number, z1: number, signX: number, signZ: number, yaw: number;
        if (s.dir === 'n' || s.dir === 's') {
          x0 = p + 0.3; x1 = p + w - 0.3;
          z0 = s.dir === 'n' ? s.fixed : s.fixed - depth;
          z1 = s.dir === 'n' ? s.fixed + depth : s.fixed;
          signX = (x0 + x1) / 2;
          signZ = s.dir === 'n' ? z0 - 0.06 : z1 + 0.06;
          yaw = s.dir === 'n' ? Math.PI : 0;
        } else {
          z0 = p + 0.3; z1 = p + w - 0.3;
          x0 = s.dir === 'w' ? s.fixed : s.fixed - depth;
          x1 = s.dir === 'w' ? s.fixed + depth : s.fixed;
          signZ = (z0 + z1) / 2;
          signX = s.dir === 'w' ? x0 - 0.06 : x1 + 0.06;
          yaw = s.dir === 'w' ? -Math.PI / 2 : Math.PI / 2;
        }
        // rez-de-chaussée commerçant + étages
        this.building(x0, z0, x1, z1, 4.2, 'shop');
        this.building(x0, z0, x1, z1, h, fac, CURB + 4.2, true, false);
        this.world.addBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: CURB, y1: CURB + 4.2 + h });
        this.sign(signX, signZ, CURB + 3.6, Math.min(w - 1.5, 9), yaw);
        p += w;
      }
    });
    // cour intérieure : voitures garées
    for (let i = 0; i < 6; i++) {
      const x = I.x0 + depth + 4 + this.r() * Math.max(1, I.x1 - I.x0 - 2 * depth - 8);
      const z = I.z0 + depth + 4 + this.r() * Math.max(1, I.z1 - I.z0 - 2 * depth - 8);
      if (this.r() > 0.35) this.parkedCar(x, z, this.r() > 0.5 ? 0 : Math.PI / 2);
    }
  }

  private mall(I: Rect): void {
    const x0 = I.x0 + 4, x1 = I.x1 - 4;
    const z1 = I.z1 - 2, z0 = z1 - 26;
    this.building(x0, z0, x1, z1, 10, 'shop');
    this.sign((x0 + x1) / 2, z0 - 0.06, CURB + 7.5, 14, Math.PI);
    for (let x = I.x0 + 4; x < I.x1 - 4; x += 3) {
      for (const z of [I.z0 + 6, I.z0 + 18, I.z0 + 26]) if (this.r() > 0.45) this.parkedCar(x + 1.5, z, 0);
    }
    for (let x = I.x0 + 6; x < I.x1 - 4; x += 16) this.lamp(x, I.z0 + 12, Math.PI / 2);
  }

  private residential(I: Rect): void {
    const lotW = 17, lotD = 22;
    for (let x = I.x0; x + lotW <= I.x1 + 0.1; x += lotW) {
      for (let z = I.z0; z + lotD <= I.z1 + 0.1; z += lotD) {
        const hw = 8 + this.r() * 3, hd = 8 + this.r() * 3;
        const cx = x + lotW / 2, cz = z + lotD / 2;
        const h = 5.5 + this.r() * 2.5;
        const hx0 = cx - hw / 2, hx1 = cx + hw / 2, hz0 = cz - hd / 2, hz1 = cz + hd / 2;
        this.building(hx0, hz0, hx1, hz1, h, 'house', CURB, false);
        const along = this.r() > 0.5;
        this.batches.add(cx, cz, this.r() > 0.4 ? this.m.tile : this.m.tileGray, prismRoof(hx0, hz0, hx1, hz1, CURB + h, 2.6, along));
        // haie basse
        if (this.r() > 0.4) {
          const hedge = boxGeo(x + 0.4, CURB, z + 0.2, x + lotW - 0.4, CURB + 0.9, z + 0.8, 2, 2);
          this.batches.add(cx, cz, this.m.grass, hedge);
          this.world.addBox({ x: cx, z: z + 0.5, hx: lotW / 2 - 0.4, hz: 0.3, y0: CURB, y1: CURB + 0.9, surf: 'grass' });
        }
        if (this.r() > 0.35) this.tree(x + 2.5, z + lotD - 3, CURB, 0.8);
        if (this.r() > 0.6) this.parkedCar(x + lotW - 2.5, z + 4, 0);
      }
    }
  }

  private cite(I: Rect): void {
    const alongX = this.r() > 0.5;
    const n = 2;
    for (let k = 0; k < n; k++) {
      const h = 21 + this.r() * 12;
      if (alongX) {
        const z0 = I.z0 + 6 + k * ((I.z1 - I.z0 - 24) / (n - 1 || 1));
        this.building(I.x0 + 5, z0, I.x1 - 5, z0 + 12, h, 'apartment');
        this.graffiti(I.x0 + 15, z0 - 0.05, CURB + 1.8, 6, Math.PI);
      } else {
        const x0 = I.x0 + 6 + k * ((I.x1 - I.x0 - 24) / (n - 1 || 1));
        this.building(x0, I.z0 + 5, x0 + 12, I.z1 - 5, h, 'apartment');
        this.graffiti(x0 - 0.05, I.z0 + 15, CURB + 1.8, 6, -Math.PI / 2);
      }
    }
    // pelouse centrale, arbres et voitures
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
    const lawn: Rect = alongX ? { x0: I.x0 + 10, z0: cz - 7, x1: cx - 4, z1: cz + 7 } : { x0: cx - 7, z0: I.z0 + 10, x1: cx + 7, z1: cz - 4 };
    this.batches.add(cx, cz, this.m.grass, hQuad(lawn.x0, lawn.z0, lawn.x1, lawn.z1, CURB + 0.006, 6, 6));
    this.surfacePatch(lawn, 'grass', CURB + 0.007);
    for (let i = 0; i < 4; i++) this.tree(lawn.x0 + 3 + this.r() * (lawn.x1 - lawn.x0 - 6), lawn.z0 + 3 + this.r() * (lawn.z1 - lawn.z0 - 6), CURB, 1);
    for (let i = 0; i < 7; i++) {
      if (alongX) this.parkedCar(cx + 6 + i * 3.2, cz + (this.r() > 0.5 ? 4 : -4), 0);
      else this.parkedCar(cx + (this.r() > 0.5 ? 4 : -4), cz + 6 + i * 3.2, Math.PI / 2);
    }
  }

  private industrial(I: Rect): void {
    const w = 30 + this.r() * 12, dd = 22 + this.r() * 6, h = 10 + this.r() * 4;
    const x0 = I.x0 + 3, z0 = I.z0 + 3;
    this.building(x0, z0, x0 + w, z0 + dd, h, 'industrial');
    // portes sectionnelles
    for (let k = 0; k < 3; k++) {
      const dx = x0 + 4 + k * 9;
      const door = vQuad(dx + 5, z0 + dd + 0.03, dx, z0 + dd + 0.03, CURB, CURB + 4.5, 5, 4.5);
      this.batches.add(dx, z0 + dd, this.m.door, door);
    }
    // quai de chargement + rampe d'accès
    const qz0 = z0 + dd, qz1 = qz0 + 5;
    this.batches.add(x0 + w / 2, qz0, this.m.concrete, boxGeo(x0, CURB, qz0, x0 + w - 8, CURB + 1.2, qz1, 3, 3));
    this.world.addBox({ x: x0 + (w - 8) / 2, z: (qz0 + qz1) / 2, hx: (w - 8) / 2, hz: 2.5, y0: 0, y1: CURB + 1.2, surf: 'concrete' });
    const rampPts: [number, number][] = [[0, 0], [6, 1.2]];
    this.world.addProfile({ x: x0 + w - 8 + 0.0, z: (qz0 + qz1) / 2, hx: 2.5, yaw: -Math.PI / 2, y0: CURB, points: rampPts, surf: 'concrete' });
    this.batches.add(x0 + w, qz0, this.m.concrete, profileGeo(x0 + w - 8, (qz0 + qz1) / 2, 2.5, -Math.PI / 2, CURB, rampPts));
    this.graffiti(x0 + w + 0.05, z0 + dd / 2, CURB + 3, 8, Math.PI / 2);
    // conteneurs
    const cx0 = I.x1 - 16, cz0 = I.z0 + 4;
    for (let k = 0; k < 4; k++) {
      const stack = 1 + Math.floor(this.r() * 3);
      for (let s = 0; s < stack; s++) {
        const z = cz0 + k * 3.2;
        const y = CURB + s * 2.6;
        const mat = this.containerMats[Math.floor(this.r() * this.containerMats.length)];
        this.batches.add(cx0, z, mat, boxGeo(cx0, y, z, cx0 + 12, y + 2.6, z + 2.45, 12, 2.6));
      }
      this.world.addBox({ x: cx0 + 6, z: cz0 + k * 3.2 + 1.22, hx: 6, hz: 1.22, y0: 0, y1: CURB + stack * 2.6, surf: 'metal' });
    }
    // silos
    if (this.r() > 0.4) {
      const sx = I.x1 - 8, sz = I.z1 - 10;
      this.batches.add(sx, sz, this.m.metal, new THREE.CylinderGeometry(4, 4, 16, 16).translate(sx, CURB + 8, sz));
      this.world.addCylinder({ x: sx, z: sz, r: 4, y0: 0, y1: 16 });
    }
    for (let i = 0; i < 5; i++) this.inst.add('cone', I.x0 + 10 + this.r() * 30, CURB, I.z1 - 8 - this.r() * 10, 0);
  }

  private park(I: Rect): void {
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
    // allées
    const paths = [hQuad(I.x0, cz - 2, I.x1, cz + 2, CURB + 0.008, 2, 2), hQuad(cx - 2, I.z0, cx + 2, I.z1, CURB + 0.008, 2, 2)];
    this.batches.add(cx, cz, this.m.sidewalk, merge(paths));
    this.surfacePatch({ x0: I.x0, z0: cz - 2, x1: I.x1, z1: cz + 2 }, 'concrete', CURB + 0.009);
    this.surfacePatch({ x0: cx - 2, z0: I.z0, x1: cx + 2, z1: I.z1 }, 'concrete', CURB + 0.009);
    // fontaine
    this.batches.add(cx, cz, this.m.concrete, new THREE.CylinderGeometry(5, 5.2, 0.6, 24).translate(cx, CURB + 0.3, cz));
    this.batches.add(cx, cz, this.m.water, new THREE.CircleGeometry(4.6, 24).rotateX(-Math.PI / 2).translate(cx, CURB + 0.55, cz));
    this.world.addCylinder({ x: cx, z: cz, r: 5.2, y0: 0, y1: CURB + 0.6, surf: 'concrete' });
    for (let i = 0; i < 26; i++) {
      const x = I.x0 + 3 + this.r() * (I.x1 - I.x0 - 6), z = I.z0 + 3 + this.r() * (I.z1 - I.z0 - 6);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
      this.tree(x, z, CURB, 0.9 + this.r() * 0.5);
    }
    for (let i = 0; i < 6; i++) this.inst.add('bench', cx + (i % 2 ? 5 : -5), CURB, I.z0 + 8 + i * 9, i % 2 ? -Math.PI / 2 : Math.PI / 2);
    for (let i = 0; i < 10; i++) this.inst.add('bush', I.x0 + 2 + this.r() * (I.x1 - I.x0 - 4), CURB, I.z0 + 2 + this.r() * (I.z1 - I.z0 - 4), 0, 1, new THREE.Color().setHSL(0.28, 0.5, 0.25));
  }

  private buildPlaza(R: Rect, I: Rect): void {
    const pit = UNDERGROUND.pit;
    const ramp = UNDERGROUND.ramp;
    const F = UNDERGROUND.floor;
    // plateformes autour de la fosse
    const ring: Rect[] = [
      { x0: R.x0, z0: R.z0, x1: R.x1, z1: pit.z0 },
      { x0: R.x0, z0: pit.z1, x1: R.x1, z1: R.z1 },
      { x0: R.x0, z0: pit.z0, x1: pit.x0, z1: pit.z1 },
      { x0: pit.x1, z0: pit.z0, x1: R.x1, z1: pit.z1 },
    ];
    for (const r of ring) this.world.addBox({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2, y0: F - 1, y1: CURB, surf: 'concrete' });
    // dalle-plafond au-dessus de la fosse (sauf trémie de la rampe)
    const slabs: Rect[] = [
      { x0: ramp.x1, z0: pit.z0, x1: pit.x1, z1: pit.z1 },
      { x0: pit.x0, z0: pit.z0, x1: ramp.x1, z1: ramp.zBottom },
    ];
    for (const s of slabs) {
      this.world.addBox({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, hx: (s.x1 - s.x0) / 2, hz: (s.z1 - s.z0) / 2, y0: CURB - 0.45, y1: CURB, surf: 'concrete' });
      this.batches.add(s.x0, s.z0, this.m.pit, boxGeo(s.x0, CURB - 0.45, s.z0, s.x1, CURB, s.z1, 4, 4));
    }
    // visuels : trottoirs + place
    const S = SIDEWALK;
    this.batches.add(R.x0, R.z0, this.m.sidewalk, merge([hQuad(R.x0, R.z0, R.x1, R.z0 + S, CURB, 2, 2), hQuad(R.x0, R.z1 - S, R.x1, R.z1, CURB, 2, 2), hQuad(R.x0, R.z0 + S, R.x0 + S, R.z1 - S, CURB, 2, 2), hQuad(R.x1 - S, R.z0 + S, R.x1, R.z1 - S, CURB, 2, 2)]));
    const curbs = [vQuad(R.x0, R.z0, R.x1, R.z0, 0, CURB, 1, 1), vQuad(R.x1, R.z1, R.x0, R.z1, 0, CURB, 1, 1), vQuad(R.x0, R.z1, R.x0, R.z0, 0, CURB, 1, 1), vQuad(R.x1, R.z0, R.x1, R.z1, 0, CURB, 1, 1)];
    this.batches.add(R.x0, R.z0, this.m.curb, merge(curbs));
    const plazaParts = [
      hQuad(I.x0, I.z0, I.x1, pit.z0, CURB + 0.003, 5, 5), hQuad(I.x0, pit.z1, I.x1, I.z1, CURB + 0.003, 5, 5),
      hQuad(I.x0, pit.z0, pit.x0, pit.z1, CURB + 0.003, 5, 5), hQuad(pit.x1, pit.z0, I.x1, pit.z1, CURB + 0.003, 5, 5),
    ];
    this.batches.add(I.x0, I.z0, this.m.concrete, merge(plazaParts));
    for (const s of slabs) this.batches.add(s.x0 + 1, s.z0 + 1, this.m.concrete, hQuad(s.x0, s.z0, s.x1, s.z1, CURB + 0.004, 5, 5));
    this.mapRect(R.x0, R.z0, R.x1, R.z1, '#a29d93');
    // garde-corps autour de la trémie
    const rail = (x0: number, z0: number, x1: number, z1: number, full: boolean) => {
      this.world.addBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.max(0.15, (x1 - x0) / 2), hz: Math.max(0.15, (z1 - z0) / 2), y0: full ? F : CURB - 0.45, y1: CURB + 1.05, surf: 'metal' });
      this.batches.add(x0, z0, this.m.railing, boxGeo(x0, CURB, z0, x1, CURB + 1.05, z1, 1, 1));
    };
    rail(ramp.x1 - 0.15, ramp.zBottom, ramp.x1 + 0.15, ramp.zTop - 0.5, true);
    rail(ramp.x0, ramp.zBottom - 0.15, ramp.x1, ramp.zBottom + 0.15, false);
    // rampe descendante
    const depth = CURB - F;
    const pts: [number, number][] = [[0, 0], [2, 0.1], [26, depth - 0.1], [30, depth]];
    // orientée vers +z (monte vers zTop) : la base est au fond de la fosse
    this.world.addProfile({ x: (ramp.x0 + ramp.x1) / 2, z: ramp.zBottom, hx: (ramp.x1 - ramp.x0) / 2, yaw: 0, y0: F, points: pts, surf: 'concrete' });
    this.batches.add(ramp.x0, ramp.zBottom, this.m.concrete, profileGeo((ramp.x0 + ramp.x1) / 2, ramp.zBottom, (ramp.x1 - ramp.x0) / 2, 0, F, pts));
    // murs de la fosse
    const wallMat = this.m.pit;
    const walls: [number, number, number, number][] = [
      [pit.x0 - 0.4, pit.z0 - 0.4, pit.x1 + 0.4, pit.z0], [pit.x0 - 0.4, pit.z1, ramp.x0, pit.z1 + 0.4], [ramp.x1, pit.z1, pit.x1 + 0.4, pit.z1 + 0.4],
      [pit.x0 - 0.4, pit.z0, pit.x0, pit.z1], [pit.x1, pit.z0, pit.x1 + 0.4, pit.z1],
    ];
    for (const [x0, z0, x1, z1] of walls) this.batches.add(x0, z0, wallMat, boxGeo(x0, F, z0, x1, CURB - 0.01, z1, 3, 3));
    // sol, piliers, néons
    this.batches.add(pit.x0, pit.z0, this.m.undergroundFloor, hQuad(pit.x0, pit.z0, pit.x1, pit.z1, F + 0.01, 10, 10));
    const pillars: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    for (let x = pit.x0 + 14; x < pit.x1 - 4; x += 12) {
      for (let z = pit.z0 + 8; z < pit.z1 - 4; z += 12) {
        pillars.push(boxGeo(x - 0.4, F, z - 0.4, x + 0.4, CURB - 0.45, z + 0.4, 1, 3));
        this.world.addBox({ x, z, hx: 0.4, hz: 0.4, y0: F, y1: CURB - 0.45 });
        lights.push(hQuad(x + 3, z - 0.15, x + 7, z + 0.15, CURB - 0.47, 1, 1).rotateX(0));
      }
    }
    lights.forEach((g) => flipFaces(g));
    this.batches.add(pit.x0, pit.z0, this.m.concrete, merge(pillars));
    this.batches.add(pit.x0, pit.z0, this.m.underLight, merge(lights));
    for (let i = 0; i < 8; i++) this.parkedCar(pit.x1 - 6 - this.r() * 20, pit.z0 + 5 + i * 5.5, Math.PI / 2, F);
    // déco de la place
    this.batches.add(I.x1 - 8, I.z1 - 8, this.m.concrete, new THREE.CylinderGeometry(3.5, 3.7, 0.5, 20).translate(I.x1 - 8, CURB + 0.25, I.z1 - 8));
    this.world.addCylinder({ x: I.x1 - 8, z: I.z1 - 8, r: 3.7, y0: 0, y1: CURB + 0.5 });
    for (let i = 0; i < 4; i++) this.tree(I.x0 + 4 + i * 16, I.z0 + 3, CURB, 0.9);
  }

  private garageBlock(I: Rect): void {
    // le garage du joueur fait face au boulevard (z = I.z0)
    const gx0 = I.x0 + 4, gx1 = gx0 + 30, gz0 = I.z0, gz1 = gz0 + 20;
    this.building(gx0, gz0, gx1, gz1, 8, 'industrial');
    const door = vQuad(gx0 + 9, gz0 - 0.03, gx0 + 19, gz0 - 0.03, CURB, CURB + 5, 10, 5);
    this.batches.add(gx0, gz0, this.m.door, door);
    this.sign((gx0 + gx1) / 2, gz0 - 0.08, CURB + 6.5, 12, Math.PI);
    this.graffiti(gx0 + 4, gz0 - 0.06, CURB + 2.6, 6, Math.PI);
    this.commercial({ x0: gx1 + 2, z0: I.z0, x1: I.x1, z1: I.z1 }, true);
  }

  private training(I: Rect): void {
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
    // cercles peints + lignes de distance
    const ring = (r: number) => new THREE.RingGeometry(r - 0.12, r + 0.12, 48).rotateX(-Math.PI / 2).translate(cx - 12, CURB + 0.012, cz);
    this.batches.add(cx, cz, this.m.white, merge([ring(6), ring(10)]));
    const lines: THREE.BufferGeometry[] = [];
    for (let z = I.z0 + 4; z < I.z1 - 2; z += 10) lines.push(hQuad(cx + 6, z - 0.1, cx + 20, z + 0.1, CURB + 0.012));
    this.batches.add(cx, cz, this.m.yellow, merge(lines));
    for (let i = 0; i < 10; i++) this.inst.add('cone', cx + 13, CURB, I.z0 + 6 + i * 5.5, 0);
    for (let i = 0; i < 8; i++) this.inst.add('tire', I.x0 + 3, CURB, I.z0 + 4 + i * 2, 0);
  }

  private stuntPark(I: Rect): void {
    const W = this.m.wood;
    const ramp = (x: number, z: number, hx: number, yaw: number, pts: [number, number][], mat: THREE.Material = W) => {
      this.world.addProfile({ x, z, hx, yaw, y0: CURB, points: pts, surf: mat === W ? 'wood' : 'concrete' });
      this.batches.add(x, z, mat, profileGeo(x, z, hx, yaw, CURB, pts));
    };
    const cx = (I.x0 + I.x1) / 2;
    // petit et moyen kicker (vers -z)
    ramp(I.x0 + 8, I.z1 - 14, 1.5, Math.PI, [[0, 0], [1.5, 0.2], [3, 0.8]]);
    ramp(I.x0 + 16, I.z1 - 16, 1.8, Math.PI, [[0, 0], [2, 0.25], [3.6, 0.85], [4.6, 1.45]]);
    // grand saut : kicker + réception (vers -z)
    const gx = cx + 6;
    ramp(gx, I.z1 - 12, 2.2, Math.PI, [[0, 0], [2.5, 0.25], [5, 1.0], [6.5, 1.9], [7.3, 2.5]]);
    ramp(gx, I.z1 - 34, 2.6, Math.PI, [[0, 2.4], [1, 2.4], [10, 0.2], [11, 0]], this.m.concrete);
    // funbox
    const fx = I.x0 + 12, fz = I.z0 + 22;
    ramp(fx, fz - 7, 3, 0, [[-3, 0], [0, 1.1]]);
    ramp(fx, fz + 7, 3, Math.PI, [[-3, 0], [0, 1.1]]);
    this.world.addBox({ x: fx, z: fz, hx: 3, hz: 7, y0: 0, y1: CURB + 1.1, surf: 'concrete' });
    this.batches.add(fx, fz, this.m.concrete, boxGeo(fx - 3, CURB, fz - 7, fx + 3, CURB + 1.1, fz + 7, 3, 3));
    // spine
    ramp(cx - 8, I.z0 + 18, 3, 0, [[0, 0], [2, 0.3], [4, 1.3]]);
    ramp(cx - 8, I.z0 + 26, 3, Math.PI, [[0, 0], [2, 0.3], [4, 1.3]]);
    // quarter pipes le long du bord ouest
    for (let k = 0; k < 2; k++) ramp(I.x0 + 3.5, I.z0 + 40 + k * 8, 3.5, -Math.PI / 2, [[0, 0], [1, 0.08], [2, 0.35], [2.8, 0.9], [3.3, 1.6], [3.5, 2.4]], this.m.concrete);
    // table
    ramp(I.x1 - 10, I.z0 + 22, 2.5, 0, [[0, 0], [4, 1.4], [10, 1.4], [15, 0]]);
    // muret (ledge) et escalier
    this.world.addBox({ x: I.x1 - 4, z: I.z0 + 46, hx: 0.6, hz: 6, y0: 0, y1: CURB + 0.45, surf: 'concrete' });
    this.batches.add(I.x1 - 4, I.z0 + 46, this.m.concrete, boxGeo(I.x1 - 4.6, CURB, I.z0 + 40, I.x1 - 3.4, CURB + 0.45, I.z0 + 52, 2, 2));
    // gradins + graffitis
    this.batches.add(I.x0, I.z0, this.m.concrete, merge([0, 1, 2].map((k) => boxGeo(I.x0 + 20 + k * 0, CURB, I.z0 + 1 + k * 1.2, I.x1 - 20, CURB + 0.5 + k * 0.5, I.z0 + 2.2 + k * 1.2, 2, 2))));
    this.world.addBox({ x: cx, z: I.z0 + 2.8, hx: (I.x1 - I.x0) / 2 - 20, hz: 1.9, y0: 0, y1: CURB + 1.5 });
    for (let k = 0; k < 3; k++) this.graffiti(I.x0 + 25 + k * 9, I.z0 + 0.9, CURB + 2.4, 8, 0);
    this.batches.add(cx, I.z0, this.m.concrete, boxGeo(I.x0 + 20, CURB, I.z0 + 0.2, I.x1 - 20, CURB + 4, I.z0 + 0.8, 2, 2));
    this.world.addBox({ x: cx, z: I.z0 + 0.5, hx: (I.x1 - I.x0) / 2 - 20, hz: 0.3, y0: 0, y1: CURB + 4 });
  }

  private parkingStructure(I: Rect): void {
    const P = PARKING_STRUCT;
    const L = P.levels;
    const lane = P.lane;
    const conc = this.m.concrete;
    const slabT = 0.3;
    const zr0 = P.z0 + 8, zr1 = P.z1 - 12; // longueur des rampes
    const east = { x0: P.x1 - lane, x1: P.x1 };
    const west = { x0: P.x0, x1: P.x0 + lane };
    for (let k = 1; k < L.length; k++) {
      const h = L[k];
      const opening = k % 2 === 1 ? east : west; // trémie de la rampe venant du niveau inférieur
      const rects: Rect[] = [
        { x0: P.x0, z0: P.z0, x1: P.x1, z1: zr0 },
        { x0: P.x0, z0: zr1, x1: P.x1, z1: P.z1 },
        opening === east ? { x0: P.x0, z0: zr0, x1: east.x0, z1: zr1 } : { x0: west.x1, z0: zr0, x1: P.x1, z1: zr1 },
      ];
      for (const r of rects) {
        this.world.addBox({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2, y0: h - slabT, y1: h, surf: 'concrete' });
        this.batches.add(r.x0, r.z0, conc, boxGeo(r.x0, h - slabT, r.z0, r.x1, h, r.z1, 4, 4));
        this.batches.add(r.x0, r.z0, this.m.parking, hQuad(r.x0, r.z0, r.x1, r.z1, h + 0.005, 10, 10));
      }
      // parapets (ouverts côté rue au rez-de-chaussée seulement)
      const par = 1.0;
      const segs: [number, number, number, number][] = [
        [P.x0 - 0.3, P.z0 - 0.3, P.x1 + 0.3, P.z0], [P.x0 - 0.3, P.z1, P.x1 + 0.3, P.z1 + 0.3], [P.x0 - 0.3, P.z0, P.x0, P.z1], [P.x1, P.z0, P.x1 + 0.3, P.z1],
      ];
      for (const [x0, z0, x1, z1] of segs) {
        this.world.addBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: h - slabT, y1: h + par, surf: 'concrete' });
        this.batches.add(x0, z0, conc, boxGeo(x0, h - slabT, z0, x1, h + par, z1, 3, 3));
      }
      // garde-corps le long de la trémie (côté intérieur)
      const gx = opening === east ? east.x0 - 0.15 : west.x1 + 0.15;
      this.world.addBox({ x: gx, z: (zr0 + zr1) / 2, hx: 0.15, hz: (zr1 - zr0) / 2 - 1, y0: h - slabT, y1: h + par, surf: 'metal' });
      this.batches.add(gx, zr0, this.m.railing, boxGeo(gx - 0.1, h, zr0 + 1, gx + 0.1, h + par, zr1 - 1, 1, 1));
      // piliers
      for (const [px, pz] of [[P.x0 + 0.5, P.z0 + 0.5], [P.x1 - 0.5, P.z0 + 0.5], [P.x0 + 0.5, P.z1 - 0.5], [P.x1 - 0.5, P.z1 - 0.5], [(P.x0 + P.x1) / 2, P.z0 + 0.5], [(P.x0 + P.x1) / 2, P.z1 - 0.5], [(P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2]] as [number, number][]) {
        this.world.addBox({ x: px, z: pz, hx: 0.4, hz: 0.4, y0: L[k - 1], y1: h - slabT });
        this.batches.add(px, pz, conc, boxGeo(px - 0.4, L[k - 1], pz - 0.4, px + 0.4, h - slabT, pz + 0.4, 1, 3));
      }
    }
    // rampes entre niveaux
    for (let k = 0; k < L.length - 1; k++) {
      const rise = L[k + 1] - L[k];
      const lanes = k % 2 === 0 ? east : west;
      const x = (lanes.x0 + lanes.x1) / 2;
      const pts: [number, number][] = [[0, 0], [1.5, 0.08], [zr1 - zr0 - 1.5, rise - 0.08], [zr1 - zr0, rise]];
      if (k % 2 === 0) {
        this.world.addProfile({ x, z: zr0, hx: lane / 2 - 0.3, yaw: 0, y0: L[k], points: pts, surf: 'concrete' });
        this.batches.add(x, zr0, conc, profileGeo(x, zr0, lane / 2 - 0.3, 0, L[k], pts));
      } else {
        this.world.addProfile({ x, z: zr1, hx: lane / 2 - 0.3, yaw: Math.PI, y0: L[k], points: pts, surf: 'concrete' });
        this.batches.add(x, zr1, conc, profileGeo(x, zr1, lane / 2 - 0.3, Math.PI, L[k], pts));
      }
    }
    this.mapRect(P.x0, P.z0, P.x1, P.z1, '#555250');
    for (let i = 0; i < 6; i++) this.parkedCar(P.x0 + 12 + i * 3.2, P.z1 - 6, 0, L[1 + (i % 3)]);
    this.sign((P.x0 + P.x1) / 2, P.z0 - 0.4, L[1] + 1.2, 10, Math.PI);
    // petites boutiques à côté
    this.building(I.x0, I.z0, P.x0 - 3, I.z0 + 18, 9, 'brick');
  }

  // ----- hors ville
  private buildOutskirts(): void {
    const B = WORLD_BOUNDS;
    const cmin = lineCoord(0) - roadWidth(0) / 2, cmax = lineCoord(GRID_N) + roadWidth(GRID_N) / 2;
    const parts: [number, number, number, number][] = [
      [B.minX, B.minZ, B.maxX, cmin], [B.minX, cmax, B.maxX, B.maxZ], [B.minX, cmin, cmin, cmax], [cmax, cmin, B.maxX, cmax],
    ];
    for (const [x0, z0, x1, z1] of parts) {
      // découpage en tuiles pour le culling
      for (let x = x0; x < x1; x += CHUNK) {
        for (let z = z0; z < z1; z += CHUNK) {
          const xa = Math.min(x + CHUNK, x1), za = Math.min(z + CHUNK, z1);
          this.batches.add((x + xa) / 2, (z + za) / 2, this.m.grass, hQuad(x, z, xa, za, -0.01, 8, 8));
        }
      }
    }
    // arbres épars + haies de bord de monde
    for (let i = 0; i < 170; i++) {
      const x = B.minX + 20 + this.r() * (B.maxX - B.minX - 40);
      const z = B.minZ + 20 + this.r() * (B.maxZ - B.minZ - 40);
      if (x > cmin - 20 && x < cmax + 20 && z > cmin - 20 && z < cmax + 20) continue;
      if (Math.abs(x - CORNICHE.x) < 25 && z < cmin) continue;
      if (x > MX_ZONE.x0 - 15 && x < MX_ZONE.x1 + 15 && z > MX_ZONE.z0 - 50 && z < MX_ZONE.z1 + 15) continue;
      this.tree(x, z, 0, 1.2 + this.r() * 0.8);
    }
    // collines de fond (décor, hors limites)
    const hills: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rx = 1250 + this.r() * 250, rz = 1500 + this.r() * 250;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz - 250;
      hills.push(new THREE.SphereGeometry(180 + this.r() * 160, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.35 + this.r() * 0.25, 1).translate(x, -10, z));
    }
    const hillMat = new THREE.MeshStandardMaterial({ color: '#4b6b3f', roughness: 1, flatShading: true });
    const hm = new THREE.Mesh(merge(hills), hillMat);
    hm.receiveShadow = false;
    this.group.add(hm);
    // route d'accès au MX Park (chemin de terre)
    const accZ0 = cmax, accZ1 = MX_ZONE.z0;
    this.batches.add(0, (accZ0 + accZ1) / 2, this.m.dirt, hQuad(-6, accZ0, 6, accZ1, 0.003, 6, 6));
    this.mapRect(-6, accZ0, 6, accZ1, '#8a6a46');
  }

  private buildCorniche(): void {
    const C = CORNICHE;
    const hw = C.width / 2;
    const z0 = C.z1, z1 = C.z0 + 12;
    for (let z = z0; z < z1; z += CHUNK / 2) {
      const za = Math.min(z + CHUNK / 2, z1);
      this.batches.add(C.x, (z + za) / 2, this.m.road, hQuad(C.x - hw, z, C.x + hw, za, 0.004, 1, 1, (x, zz) => [(x - (C.x - hw)) / C.width, zz / 12]));
    }
    this.mapRect(C.x - hw, z0, C.x + hw, z1, '#2b2d31');
    // glissières de sécurité
    for (const sd of [-1, 1]) {
      const x = C.x + sd * (hw + 0.6);
      this.world.addBox({ x, z: (z0 + z1) / 2 - 6, hx: 0.15, hz: (z1 - z0) / 2 - 8, y0: 0, y1: 0.8, surf: 'metal' });
      for (let z = z0 + 2; z < z1 - 14; z += CHUNK / 2) {
        const za = Math.min(z + CHUNK / 2, z1 - 14);
        this.batches.add(x, (z + za) / 2, this.m.railing, boxGeo(x - 0.08, 0.45, z, x + 0.08, 0.8, za, 4, 1));
      }
      for (let z = z0 + 20; z < z1 - 20; z += 40) this.lamp(C.x + sd * (hw + 1.6), z, sd > 0 ? 0 : Math.PI, 0);
    }
    // aire de demi-tour
    const tz = z0 - 18;
    this.batches.add(C.x, tz, this.m.asphalt, new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2).translate(C.x, 0.004, tz));
    this.mapCircle(C.x, tz, 30, '#2b2d31');
    this.world.addCylinder({ x: C.x, z: tz, r: 6, y0: 0, y1: 0.4, surf: 'grass' });
    this.batches.add(C.x, tz, this.m.grass, new THREE.CylinderGeometry(6, 6, 0.4, 24).translate(C.x, 0.2, tz));
    // panneaux de distance (bornes) tous les 100 m
    for (let z = C.z0 - 100; z > C.z1; z -= 100) this.inst.add('bollard', C.x + hw + 1.2, 0, z, 0, 1.4);
  }

  private buildMXPark(): void {
    const Z = MX_ZONE;
    const dirt = this.m.dirt;
    this.mapRect(Z.x0, Z.z0, Z.x1, Z.z1, '#8a6a46');
    // tuiles de terre
    for (let x = Z.x0; x < Z.x1; x += 90) for (let z = Z.z0; z < Z.z1; z += 90) {
      this.batches.add(x + 45, z + 45, dirt, hQuad(x, z, Math.min(x + 90, Z.x1), Math.min(z + 90, Z.z1), 0.002, 6, 6));
    }
    const ramp = (x: number, z: number, hx: number, yaw: number, pts: [number, number][]) => {
      this.world.addProfile({ x, z, hx, yaw, y0: 0, points: pts, surf: 'dirt' });
      this.batches.add(x, z, dirt, profileGeo(x, z, hx, yaw, 0, pts, 4));
    };
    const E = Math.PI / 2, W = -Math.PI / 2;
    // ligne droite 1 (vers +x) à z = 625
    const z1 = 625;
    ramp(-120, z1, 5, E, [[0, 0], [3, 0.6], [6, 2.0], [14, 2.0], [16, 1.4], [22, 0]]); // table
    ramp(-60, z1, 4, E, [[0, 0], [2.5, 0.5], [5, 1.4], [6.5, 2.1]]); // double : kicker
    ramp(-36, z1, 4.5, E, [[0, 2.0], [2, 2.0], [10, 0.4], [12, 0]]); // réception
    for (let k = 0; k < 14; k++) {
      const pts: [number, number][] = [];
      for (let s = 0; s <= 8; s++) pts.push([s * 0.5, Math.sin((s / 8) * Math.PI) * 0.55]);
      ramp(10 + k * 4.2, z1, 4, E, pts); // whoops
    }
    ramp(110, z1, 5, E, [[0, 0], [3, 0.5], [7, 2.2], [16, 2.2], [18, 1.5], [24, 0]]); // step-up / table
    ramp(160, z1, 5, E, [[0, 0], [3, 0.6], [6, 1.8], [8, 3.0], [9, 3.6]]); // gros saut
    ramp(194, z1, 6, E, [[0, 3.4], [2, 3.4], [14, 0.4], [17, 0]]);
    // ligne droite 2 (vers -x) à z = 780
    const z2 = 780;
    for (let k = 0; k < 3; k++) {
      const x = 150 - k * 22;
      ramp(x, z2, 4, W, [[0, 0], [2.5, 0.5], [5, 1.5], [6, 1.9]]);
      ramp(x - 12, z2, 4, W, [[0, 1.8], [2, 1.8], [8, 0.3], [9.5, 0]]);
    }
    ramp(40, z2, 5, W, [[0, 0], [4, 1.5], [12, 1.5], [16, 0]]);
    ramp(-30, z2, 6, W, [[0, 0], [4, 0.9], [8, 2.6], [10, 4.0], [11, 4.6]]); // le "send it"
    ramp(-72, z2, 7, W, [[0, 4.4], [3, 4.4], [18, 0.5], [21, 0]]);
    // bosses de freeride au milieu
    for (let k = 0; k < 10; k++) {
      const x = -160 + this.r() * 320, z = 680 + this.r() * 60;
      const h = 0.8 + this.r() * 1.6;
      ramp(x, z, 3 + this.r() * 3, this.r() * Math.PI * 2, [[0, 0], [3, h * 0.6], [5, h], [7, h * 0.6], [10, 0]]);
    }
    // bordures : pneus et bottes de paille
    for (let x = Z.x0 + 4; x < Z.x1 - 4; x += 3) {
      this.inst.add('tire', x, 0, Z.z0 + 2, 0);
      this.inst.add('tire', x, 0, Z.z1 - 2, 0);
    }
    for (let z = Z.z0 + 4; z < Z.z1 - 4; z += 3) {
      this.inst.add('hay', Z.x0 + 2, 0, z, Math.PI / 2);
      this.inst.add('hay', Z.x1 - 2, 0, z, Math.PI / 2);
    }
    this.world.addBox({ x: (Z.x0 + Z.x1) / 2, z: Z.z1 - 2, hx: (Z.x1 - Z.x0) / 2, hz: 0.5, y0: 0, y1: 0.6, surf: 'dirt' });
    // porche de départ
    const gate = merge([boxGeo(-200, 0, 617, -199.4, 6, 617.6, 1, 1), boxGeo(-200, 0, 632.4, -199.4, 6, 633, 1, 1), boxGeo(-200, 5.2, 617, -199.4, 6.2, 633, 2, 1)]);
    this.batches.add(-200, 625, this.m.banner, gate);
    for (let i = 0; i < 6; i++) this.lamp(-180 + i * 70, Z.z0 + 30, Math.PI, 0);
  }

  // ----- éclairage nocturne
  private buildLightPools(): void {
    this.lightPoolMat = new THREE.MeshBasicMaterial({ map: this.tex.lightPool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const g = new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, this.lightPoolMat, this.lamps.length);
    const m = new THREE.Matrix4();
    this.lamps.forEach((l, i) => {
      const gh = this.world.groundAt(l.x, l.z, 20, { h: 0, surf: 'asphalt', id: -1 });
      m.makeTranslation(l.x, gh.h + 0.03, l.z);
      im.setMatrixAt(i, m);
    });
    im.frustumCulled = false;
    im.renderOrder = 2;
    this.lightPools = im;
    this.group.add(im);
  }

  private buildTrafficBulbs(): void {
    const n = this.trafficLights.length * 4;
    if (!n) return;
    const g = new THREE.SphereGeometry(0.12, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const im = new THREE.InstancedMesh(g, mat, n);
    const m = new THREE.Matrix4();
    let k = 0;
    for (const t of this.trafficLights) {
      const w = roadWidth(t.i), wz = roadWidth(t.j);
      const idx: number[] = [];
      // deux poteaux, chacun avec une ampoule vers chaque axe
      const poles = [[t.x - w / 2 - 1.2, t.z - wz / 2 - 1.2], [t.x + w / 2 + 1.2, t.z + wz / 2 + 1.2]];
      for (const [px, pz] of poles) {
        m.makeTranslation(px, CURB + 3.95, pz + (pz < t.z ? -0.18 : 0.18));
        im.setMatrixAt(k, m);
        idx.push(k++); // fait face à l'axe z (circulation nord-sud)
        m.makeTranslation(px + (px < t.x ? -0.18 : 0.18), CURB + 3.6, pz);
        im.setMatrixAt(k, m);
        idx.push(k++); // fait face à l'axe x
      }
      this.bulbIndex.set(`${t.i},${t.j}`, idx);
    }
    im.frustumCulled = false;
    this.bulbs = im;
    this.group.add(im);
  }

  /** Met à jour les ampoules des feux (phase : 0 = vert pour l'axe z, 1 = vert pour l'axe x). */
  setTrafficBulbs(phaseFor: (i: number, j: number) => { zAxis: 'g' | 'y' | 'r'; xAxis: 'g' | 'y' | 'r' }): void {
    if (!this.bulbs) return;
    const col = { g: new THREE.Color('#2bff6a'), y: new THREE.Color('#ffc21a'), r: new THREE.Color('#ff2a1a') };
    for (const t of this.trafficLights) {
      const ph = phaseFor(t.i, t.j);
      const idx = this.bulbIndex.get(`${t.i},${t.j}`)!;
      this.bulbs.setColorAt(idx[0], col[ph.zAxis]);
      this.bulbs.setColorAt(idx[2], col[ph.zAxis]);
      this.bulbs.setColorAt(idx[1], col[ph.xAxis]);
      this.bulbs.setColorAt(idx[3], col[ph.xAxis]);
    }
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
  }

  /** Visibilité par distance des chunks + intensités nocturnes + humidité. */
  update(camX: number, camZ: number, viewDist: number, night: number, wet: number): void {
    const propDist = Math.min(viewDist, 280);
    for (const c of this.chunks) {
      const dx = c.userData.cx - camX, dz = c.userData.cz - camZ;
      const vd = (c.userData.props ? propDist : viewDist) + c.userData.r;
      c.visible = dx * dx + dz * dz < vd * vd;
    }
    for (const n of this.nightMats) n.mat.emissiveIntensity = n.base * night + (n.mat === this.m.sign ? 0.12 : 0);
    this.lightPoolMat.opacity = clamp(night * 0.55, 0, 0.45);
    for (const w of this.wetMats) {
      // chaussée mouillée : plus sombre et plus brillante (sans devenir un miroir)
      w.mat.roughness = w.dry * (1 - wet * 0.5);
      w.mat.color.setScalar(1 - wet * 0.42);
    }
  }
}

function flipFaces(g: THREE.BufferGeometry): void {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
}

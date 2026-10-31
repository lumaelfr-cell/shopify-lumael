// Kit de construction des bâtiments visitables : murs avec ouvertures (portes,
// vitrines), dalles d'étage avec trémies, escaliers praticables, portes animées
// (battantes, coulissantes automatiques, rideaux métalliques), mobilier en
// couleurs de sommets (peu de draw calls), éclairage intérieur, enseignes,
// PNJ animés et motos d'exposition. Tout est construit dans le monde, sans
// écran de chargement : on entre à pied ou à moto selon la porte.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CollisionWorld, Collider, Layer, Surface } from '../physics/collision';
import { hQuad, boxGeo, profileGeo } from './worldGeom';
import { Rider } from '../vehicle/rider';
import { idlePose, sitPose } from '../vehicle/poses';
import { defaultRider, RiderConfig } from '../data/apparel';
import type { BikeSpec } from '../data/bikes';
import type { BikeConfig } from '../data/parts';
import { buildBikeVisual } from '../vehicle/bikeModel';
import { merge } from '../vehicle/geom';
import { clamp, damp, rng, wrapAngle } from '../core/math';

// ------------------------------------------------------------------ textures
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, amp: number, seed: number, size = 2): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * amp;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
  }
}

function makeTextures(): Record<string, THREE.Texture> {
  const T: Record<string, THREE.Texture> = {};
  T.tile = canvasTex(256, 256, (g, w, h) => {
    // carrelage 60 cm (1 tuile = 1,2 m → 2×2 carreaux)
    g.fillStyle = '#c4c0b8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b9b5ad';
    g.fillRect(0, 0, w / 2, h / 2);
    g.fillRect(w / 2, h / 2, w / 2, h / 2);
    speckle(g, w, h, 900, 0.06, 11);
    g.strokeStyle = 'rgba(80,80,80,0.5)';
    g.lineWidth = 2;
    for (const p of [0, w / 2]) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
  });
  T.darkTile = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a2c30';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1200, 0.08, 12);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    for (const p of [0, w / 2]) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
  });
  T.wood = canvasTex(256, 256, (g, w, h) => {
    // parquet : lames de 20 cm
    const r = rng(5);
    for (let i = 0; i < 8; i++) {
      const l = 0.36 + r() * 0.12;
      g.fillStyle = `hsl(28, 45%, ${l * 100}%)`;
      g.fillRect(0, (i * h) / 8, w, h / 8);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, (i * h) / 8, w, 1.5);
      const cut = r() * w;
      g.fillRect(cut, (i * h) / 8, 1.5, h / 8);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = `rgba(60,30,10,${0.05 + r() * 0.1})`;
        g.fillRect(r() * w, (i * h) / 8 + r() * (h / 8), 20 + r() * 60, 1);
      }
    }
  });
  T.epoxy = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6d7175';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, 0.1, 13, 1.5);
  });
  T.concrete = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8c8a85';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2500, 0.12, 14, 3);
    const r = rng(15);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(30,25,20,${0.05 + r() * 0.08})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 10 + r() * 40, 8 + r() * 25, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  T.carpet = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5b5348';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2500, 0.12, 16, 1);
  });
  T.plaster = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d6d2ca';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 800, 0.04, 17, 2);
  });
  T.plasterWarm = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d4c3a8';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 800, 0.04, 18, 2);
  });
  T.plasterDark = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3d42';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 800, 0.05, 19, 2);
  });
  T.tileWall = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f2f2ef';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,120,120,0.45)';
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke();
    }
  });
  T.brick = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9b9089';
    g.fillRect(0, 0, w, h);
    const r = rng(20);
    const bh = h / 12, bw = w / 4;
    for (let row = 0; row < 12; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * bw + (row % 2 ? bw / 2 : 0);
        g.fillStyle = `hsl(${12 + r() * 10}, ${40 + r() * 15}%, ${30 + r() * 10}%)`;
        g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    speckle(g, w, h, 800, 0.08, 21);
  });
  T.siding = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d858c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)';
      g.fillRect((i * w) / 16, 0, w / 32, h);
    }
    speckle(g, w, h, 600, 0.06, 22);
  });
  T.rust = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f6a63';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)';
      g.fillRect((i * w) / 16, 0, w / 32, h);
    }
    const r = rng(23);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${120 + r() * 60},${50 + r() * 30},20,${0.15 + r() * 0.3})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 4 + r() * 30, 6 + r() * 50, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  T.render = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d8d3c8';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, 0.07, 24, 2);
  });
  T.renderDark = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4e55';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, 0.06, 25, 2);
  });
  T.ceiling = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#dedcd5';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.strokeRect(0, 0, w, h);
    speckle(g, w, h, 600, 0.04, 26);
  });
  T.roof = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#55575a';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2500, 0.12, 27, 2);
  });
  T.asphalt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3b3e';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, 0.12, 28, 1.5);
  });
  T.graffiti = canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(29);
    const words = ['BIKE LIFE', 'WHEELIE', 'RIDE OR DIE', '12H', 'STREET KINGS'];
    for (let i = 0; i < 4; i++) {
      const word = words[i % words.length];
      const x = 30 + i * 250, y = 90 + (i % 2) * 90;
      g.save();
      g.translate(x, y);
      g.rotate((r() - 0.5) * 0.3);
      g.font = `900 ${52 + r() * 18}px Impact, Arial Black, sans-serif`;
      const hue = Math.floor(r() * 360);
      g.lineWidth = 10;
      g.strokeStyle = '#111';
      g.strokeText(word, 0, 0);
      g.fillStyle = `hsl(${hue}, 90%, 58%)`;
      g.fillText(word, 0, 0);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(0, -8, g.measureText(word).width * 0.8, 3);
      g.restore();
    }
  }, false);
  return T;
}

// ------------------------------------------------------------------ couleurs de sommets
const TMP_C = new THREE.Color();
function paint(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  TMP_C.set(hex);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = TMP_C.r;
    arr[i * 3 + 1] = TMP_C.g;
    arr[i * 3 + 2] = TMP_C.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

function prep(g: THREE.BufferGeometry, color: boolean): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(color && name === 'color')) out.deleteAttribute(name);
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  if (color && !out.attributes.color) paint(out, '#ffffff');
  out.clearGroups();
  return out;
}

function flipDown(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

// ------------------------------------------------------------------ types publics
export interface Interactable {
  id: string;
  x: number;
  y: number;
  z: number;
  r: number;
  mode: 'foot' | 'bike' | 'both';
  /** libellé de l'action (null = indisponible) */
  label: () => string | null;
  action: () => void;
  building?: string;
}

export interface Building {
  id: string;
  name: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
  lights: THREE.Vector3[];
  group: THREE.Group;
  /** objets dynamiques (motos exposées…) reconstruits à la demande */
  dynamic: THREE.Group;
  doors: Door[];
  npcs: Npc[];
  /** le joueur peut-il y entrer à moto ? */
  rideable: boolean;
  /** matériau des plafonniers (propre au bâtiment : interrupteur) */
  glow: THREE.MeshBasicMaterial;
  lightsOn: boolean;
  /** niveaux de plancher (étages) */
  levels: number[];
}

export function insideBuilding(b: Building, x: number, y: number, z: number, margin = 0): boolean {
  return x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin && y > b.y0 - 1 && y < b.y1;
}

export interface ColOpt {
  surf?: Surface;
  layer?: Layer;
  walkable?: boolean;
  solid?: boolean;
}

export interface Hole {
  a0: number;
  a1: number;
  y0: number;
  y1: number;
  glass?: boolean;
}

// ------------------------------------------------------------------ kit
export class Kit {
  mats: Record<string, THREE.Material> = {};
  tex: Record<string, THREE.Texture>;
  interactables: Interactable[] = [];
  buildings: Building[] = [];
  root = new THREE.Group();
  private signCache = new Map<string, THREE.Material>();

  constructor(public world: CollisionWorld) {
    this.tex = makeTextures();
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    this.mats = {
      matte: std({ vertexColors: true, roughness: 0.85 }),
      gloss: std({ vertexColors: true, roughness: 0.32, metalness: 0.05 }),
      metal: std({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
      fabric: std({ vertexColors: true, roughness: 0.97 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
      glass: std({ color: '#a9cbd8', transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.4, depthWrite: false }),
      mirror: std({ color: '#d8e4ea', roughness: 0.02, metalness: 1 }),
    };
    const T = this.tex;
    const tx = (k: string, rough: number, metal = 0) => (this.mats[k] = std({ map: T[k], roughness: rough, metalness: metal }));
    tx('tile', 0.25);
    tx('darkTile', 0.3);
    tx('wood', 0.55);
    tx('epoxy', 0.35);
    tx('concrete', 0.9);
    tx('carpet', 1);
    tx('plaster', 0.9);
    tx('plasterWarm', 0.9);
    tx('plasterDark', 0.85);
    tx('tileWall', 0.3);
    tx('brick', 0.9);
    tx('siding', 0.5, 0.5);
    tx('rust', 0.8, 0.3);
    tx('render', 0.9);
    tx('renderDark', 0.85);
    tx('ceiling', 0.9);
    tx('roof', 0.95);
    tx('asphalt', 0.9);
    this.mats.woodPlank = std({ map: T.wood, roughness: 0.75, color: '#c9b18c' });
    this.mats.graffiti = std({ map: T.graffiti, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }

  /** Enseigne / affiche / écran en texture canvas (mise en cache par contenu). */
  signMat(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, basic = true): THREE.Material {
    let m = this.signCache.get(key);
    if (m) return m;
    const t = canvasTex(w, h, draw, false);
    m = basic ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
    this.signCache.set(key, m);
    return m;
  }

  addInteract(i: Interactable): Interactable {
    this.interactables.push(i);
    return i;
  }
}

// ------------------------------------------------------------------ constructeur d'un bâtiment
export class B {
  private geos = new Map<string, THREE.BufferGeometry[]>();
  private extraMats = new Map<string, THREE.Material>();

  constructor(public kit: Kit, public b: Building) {}

  add(key: string, g: THREE.BufferGeometry, mat?: THREE.Material): void {
    if (mat) this.extraMats.set(key, mat);
    let arr = this.geos.get(key);
    if (!arr) this.geos.set(key, (arr = []));
    arr.push(g);
  }

  col(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, o: ColOpt = {}): Collider {
    return this.kit.world.addBox({
      x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.max(0.02, (x1 - x0) / 2), hz: Math.max(0.02, (z1 - z0) / 2), y0, y1,
      surf: o.surf ?? 'concrete', layer: o.layer, walkable: o.walkable, solid: o.solid,
    });
  }

  private collide(c: boolean | ColOpt | undefined, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    if (!c) return;
    this.col(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1, c === true ? {} : c);
  }

  /** Boîte en couleur de sommets. */
  cbox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, key = 'matte', collide: boolean | ColOpt = false): void {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(key, paint(g, color));
    this.collide(collide, x0, y0, z0, x1, y1, z1);
  }

  ccyl(x: number, y0: number, z: number, r: number, h: number, color: string, key = 'matte', seg = 12, collide = false, r2 = r): void {
    const g = new THREE.CylinderGeometry(r2, r, h, seg).translate(x, y0 + h / 2, z);
    this.add(key, paint(g, color));
    if (collide) this.kit.world.addCylinder({ x, z, r: Math.max(r, r2), y0, y1: y0 + h, surf: 'metal' });
  }

  /** Cylindre couché (axe x ou z). */
  chcyl(x: number, y: number, z: number, r: number, len: number, axis: 'x' | 'z', color: string, key = 'matte', seg = 14): void {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    else g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.add(key, paint(g, color));
  }

  csphere(x: number, y: number, z: number, r: number, color: string, key = 'gloss', sx = 1, sy = 1, sz = 1): void {
    const g = new THREE.SphereGeometry(r, 12, 9).scale(sx, sy, sz).translate(x, y, z);
    this.add(key, paint(g, color));
  }

  /** Boîte texturée (UV en mètres). */
  tbox(key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, su = 2, sv = 2, collide: boolean | ColOpt = false): void {
    this.add(key, boxGeo(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), su, sv));
    this.collide(collide, x0, y0, z0, x1, y1, z1);
  }

  floor(key: string, x0: number, z0: number, x1: number, z1: number, y: number, s = 2): void {
    this.add(key, hQuad(x0, z0, x1, z1, y, s, s));
  }

  ceil(key: string, x0: number, z0: number, x1: number, z1: number, y: number, s = 2): void {
    this.add(key, flipDown(hQuad(x0, z0, x1, z1, y, s, s)));
  }

  /** Plan vertical texturé par un matériau dédié (enseigne, affiche, écran). */
  plane(key: string, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, yaw: number): void {
    const g = new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z);
    this.add(key, g, mat);
  }

  /**
   * Mur parallèle à x (à z = zc) de x0 à x1, épaisseur t. `inSide` = +1 si
   * l'intérieur est vers +z. Les ouvertures (portes / fenêtres) sont des trous.
   */
  wallX(zc: number, x0: number, x1: number, y0: number, y1: number, t: number, holes: Hole[], inKey: string, outKey: string | null, inSide: 1 | -1, su = 2): void {
    const pieces = this.pieces(x0, x1, y0, y1, holes);
    const zi0 = zc, zi1 = zc + inSide * (t / 2), zo1 = zc - inSide * (t / 2);
    for (const p of pieces) {
      this.tbox(inKey, p.a0, p.y0, zi0, p.a1, p.y1, zi1, su, su);
      if (outKey) this.tbox(outKey, p.a0, p.y0, zi0, p.a1, p.y1, zo1, su, su);
      this.col(p.a0, Math.min(zi1, zo1), p.a1, Math.max(zi1, zo1), p.y0, p.y1, { walkable: p.y1 - p.y0 < 1.2 && p.y0 <= y0 + 0.01 ? true : false });
    }
    for (const h of holes) {
      if (!h.glass) continue;
      this.add('glass', new THREE.BoxGeometry(h.a1 - h.a0, h.y1 - h.y0, 0.03).translate((h.a0 + h.a1) / 2, (h.y0 + h.y1) / 2, zc));
      this.cbox(h.a0, h.y0 - 0.04, zc - 0.06, h.a1, h.y0, zc + 0.06, '#2b2e33', 'metal');
      this.col(h.a0, zc - 0.08, h.a1, zc + 0.08, h.y0, h.y1, { walkable: false });
    }
  }

  wallZ(xc: number, z0: number, z1: number, y0: number, y1: number, t: number, holes: Hole[], inKey: string, outKey: string | null, inSide: 1 | -1, su = 2): void {
    const pieces = this.pieces(z0, z1, y0, y1, holes);
    const xi0 = xc, xi1 = xc + inSide * (t / 2), xo1 = xc - inSide * (t / 2);
    for (const p of pieces) {
      this.tbox(inKey, xi0, p.y0, p.a0, xi1, p.y1, p.a1, su, su);
      if (outKey) this.tbox(outKey, xi0, p.y0, p.a0, xo1, p.y1, p.a1, su, su);
      this.col(Math.min(xi1, xo1), p.a0, Math.max(xi1, xo1), p.a1, p.y0, p.y1, { walkable: p.y1 - p.y0 < 1.2 && p.y0 <= y0 + 0.01 ? true : false });
    }
    for (const h of holes) {
      if (!h.glass) continue;
      this.add('glass', new THREE.BoxGeometry(0.03, h.y1 - h.y0, h.a1 - h.a0).translate(xc, (h.y0 + h.y1) / 2, (h.a0 + h.a1) / 2));
      this.cbox(xc - 0.06, h.y0 - 0.04, h.a0, xc + 0.06, h.y0, h.a1, '#2b2e33', 'metal');
      this.col(xc - 0.08, h.a0, xc + 0.08, h.a1, h.y0, h.y1, { walkable: false });
    }
  }

  private pieces(a0: number, a1: number, y0: number, y1: number, holes: Hole[]): { a0: number; a1: number; y0: number; y1: number }[] {
    const out: { a0: number; a1: number; y0: number; y1: number }[] = [];
    // regroupe les ouvertures par colonne (même intervalle horizontal)
    const cols = new Map<string, Hole[]>();
    for (const h of holes) {
      const k = `${h.a0.toFixed(3)}:${h.a1.toFixed(3)}`;
      if (!cols.has(k)) cols.set(k, []);
      cols.get(k)!.push(h);
    }
    const list = [...cols.values()].sort((p, q) => p[0].a0 - q[0].a0);
    let cur = a0;
    for (const col of list) {
      const ca0 = col[0].a0, ca1 = col[0].a1;
      if (ca0 > cur + 0.01) out.push({ a0: cur, a1: ca0, y0, y1 });
      let y = y0;
      for (const h of col.sort((p, q) => p.y0 - q.y0)) {
        if (h.y0 > y + 0.01) out.push({ a0: ca0, a1: ca1, y0: y, y1: h.y0 });
        y = Math.max(y, h.y1);
      }
      if (y1 > y + 0.01) out.push({ a0: ca0, a1: ca1, y0: y, y1 });
      cur = Math.max(cur, ca1);
    }
    if (a1 > cur + 0.01) out.push({ a0: cur, a1, y0, y1 });
    return out;
  }

  /** Dalle percée de trémies : découpe en rectangles pleins. */
  slabHoles(x0: number, z0: number, x1: number, z1: number, yTop: number, t: number, holes: { x0: number; z0: number; x1: number; z1: number }[], topKey: string, botKey = 'ceiling'): void {
    const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((v) => v >= x0 && v <= x1).sort((a, b) => a - b);
    const zs = [...new Set([z0, z1, ...holes.flatMap((h) => [h.z0, h.z1])])].filter((v) => v >= z0 && v <= z1).sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      // fusion verticale des cellules pleines d'une même bande x
      let start = -1;
      for (let j = 0; j <= zs.length - 1; j++) {
        const inHole = j < zs.length - 1 && holes.some((h) => xs[i] >= h.x0 && xs[i + 1] <= h.x1 && zs[j] >= h.z0 && zs[j + 1] <= h.z1);
        const valid = j < zs.length - 1 && !inHole;
        if (valid && start < 0) start = j;
        if ((!valid || j === zs.length - 1) && start >= 0) {
          const end = valid ? j + 1 : j;
          this.slab(xs[i], zs[start], xs[i + 1], zs[end], yTop, t, topKey, botKey);
          start = -1;
        }
      }
    }
  }

  /** Rampe praticable (profil [z, h]) avec géométrie. */
  ramp(x: number, z: number, hx: number, yaw: number, y0: number, pts: [number, number][], key = 'woodPlank', surf: Surface = 'wood'): void {
    this.kit.world.addProfile({ x, z, hx, yaw, y0, points: pts, surf });
    this.add(key, profileGeo(x, z, hx, yaw, y0, pts, 2));
  }

  /** Dalle d'étage (dessus praticable à yTop) : sol, plafond dessous, chant. */
  slab(x0: number, z0: number, x1: number, z1: number, yTop: number, t: number, topKey: string, botKey = 'ceiling'): void {
    this.floor(topKey, x0, z0, x1, z1, yTop);
    this.ceil(botKey, x0, z0, x1, z1, yTop - t);
    this.col(x0, z0, x1, z1, yTop - t, yTop);
  }

  /**
   * Volée d'escalier droite de (a0 → a1) le long de `axis`, largeur [b0,b1],
   * montant de y0 à y1. Marches visibles + rampe de collision praticable.
   */
  stairs(axis: 'x' | 'z', a0: number, a1: number, b0: number, b1: number, y0: number, y1: number, color = '#9a978f', key = 'matte'): void {
    const n = Math.max(2, Math.round((y1 - y0) / 0.18));
    const run = (a1 - a0) / n;
    const rise = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const sa = a0 + run * i, sb = sa + run;
      const top = y0 + rise * (i + 1);
      if (axis === 'x') this.cbox(Math.min(sa, sb), top - rise - 0.02, b0, Math.max(sa, sb), top, b1, i % 2 ? color : shadeHex(color, -0.04), key);
      else this.cbox(b0, top - rise - 0.02, Math.min(sa, sb), b1, top, Math.max(sa, sb), i % 2 ? color : shadeHex(color, -0.04), key);
    }
    // limon / dessous
    const len = Math.abs(a1 - a0);
    const yaw = axis === 'x' ? (a1 > a0 ? Math.PI / 2 : -Math.PI / 2) : a1 > a0 ? 0 : Math.PI;
    const mid = (b0 + b1) / 2;
    this.kit.world.addProfile({
      x: axis === 'x' ? a0 : mid, z: axis === 'x' ? mid : a0, hx: (b1 - b0) / 2, yaw, y0,
      points: [[0, 0], [len, y1 - y0]], surf: 'concrete', tag: 'stairs',
    });
  }

  /** Garde-corps (main courante + montants) entre deux points au sol. */
  railing(xa: number, za: number, xb: number, zb: number, y: number, h = 1.05, color = '#c9ced3'): void {
    const len = Math.hypot(xb - xa, zb - za);
    const n = Math.max(1, Math.round(len / 1.2));
    const ang = Math.atan2(xb - xa, zb - za);
    const top = new THREE.CylinderGeometry(0.03, 0.03, len, 8).rotateX(Math.PI / 2).rotateY(ang).translate((xa + xb) / 2, y + h, (za + zb) / 2);
    this.add('metal', paint(top, color));
    const mid = new THREE.CylinderGeometry(0.015, 0.015, len, 6).rotateX(Math.PI / 2).rotateY(ang).translate((xa + xb) / 2, y + h * 0.5, (za + zb) / 2);
    this.add('metal', paint(mid, color));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      this.ccyl(xa + (xb - xa) * k, y, za + (zb - za) * k, 0.025, h, color, 'metal', 6);
    }
    this.col(Math.min(xa, xb) - 0.06, Math.min(za, zb) - 0.06, Math.max(xa, xb) + 0.06, Math.max(za, zb) + 0.06, y, y + h, { walkable: false });
  }

  /** Plafonnier : panneau lumineux + point d'ancrage d'une lampe dynamique. */
  light(x: number, y: number, z: number, w = 1.2, d = 0.3, color = '#fff6e6', anchor = true): void {
    this.cbox(x - w / 2, y - 0.04, z - d / 2, x + w / 2, y, z + d / 2, color, 'glow');
    if (anchor) this.b.lights.push(new THREE.Vector3(x, y - 0.3, z));
  }

  /** Enseigne texte lumineuse. */
  sign(text: string, x: number, y: number, z: number, w: number, h: number, yaw: number, bg = '#111317', fg = '#ffffff', accent = '#ff2bd6'): void {
    const key = `sign:${text}:${bg}:${fg}:${accent}`;
    const W = 512, H = Math.max(64, Math.round((512 * h) / w));
    const mat = this.kit.signMat(key, W, H, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = accent;
      g.fillRect(0, H - 8, W, 8);
      g.fillStyle = fg;
      let size = Math.floor(H * 0.62);
      g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
      while (g.measureText(text).width > W * 0.9 && size > 10) {
        size -= 2;
        g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, W / 2, H / 2);
    });
    this.plane(key, mat, x, y, z, w, h, yaw);
  }

  /** Panneau de texte multi-lignes (menus, tarifs, affiches). */
  board(id: string, lines: string[], x: number, y: number, z: number, w: number, h: number, yaw: number, bg = '#1b1d22', fg = '#f4f4f4', title = '#ffd166'): void {
    const key = `board:${id}`;
    const W = 512, H = Math.round((512 * h) / w);
    const mat = this.kit.signMat(key, W, H, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const lh = Math.min(42, (H - 20) / lines.length);
      lines.forEach((l, i) => {
        g.fillStyle = i === 0 ? title : fg;
        g.font = `${i === 0 ? 900 : 600} ${Math.round(lh * (i === 0 ? 0.8 : 0.62))}px Arial, sans-serif`;
        g.textBaseline = 'middle';
        g.fillText(l, 18, 14 + lh * (i + 0.5));
      });
    });
    this.plane(key, mat, x, y, z, w, h, yaw);
  }

  /** Graffiti sur un mur. */
  graffiti(x: number, y: number, z: number, w: number, yaw: number, slot = 0): void {
    const g = new THREE.PlaneGeometry(w, w / 4);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, ((slot % 4) + uv.getX(i)) / 4);
    g.rotateY(yaw).translate(x, y, z);
    this.add('graffiti', g);
  }

  // ---------------------------------------------------------------- mobilier
  counter(x0: number, z0: number, x1: number, z1: number, y: number, h = 1.05, body = '#3b3f46', top = '#d9d4c7'): void {
    this.cbox(x0, y, z0, x1, y + h - 0.05, z1, body, 'matte', { walkable: false });
    this.cbox(x0 - 0.04, y + h - 0.05, z0 - 0.04, x1 + 0.04, y + h, z1 + 0.04, top, 'gloss');
  }

  shelf(x0: number, z0: number, x1: number, z1: number, y: number, h: number, levels: number, seed: number, colorful = true, frame = '#c8ccd1'): void {
    const alongX = x1 - x0 > z1 - z0;
    this.cbox(x0, y, z0, x1, y + 0.08, z1, frame, 'metal', { walkable: false });
    this.col(x0, z0, x1, z1, y, y + h, { walkable: false });
    const r = rng(seed);
    for (let k = 0; k < levels; k++) {
      const yy = y + 0.12 + (k * (h - 0.2)) / levels;
      this.cbox(x0, yy - 0.02, z0, x1, yy, z1, frame, 'metal');
      // produits
      const len = alongX ? x1 - x0 : z1 - z0;
      const depth = alongX ? z1 - z0 : x1 - x0;
      let p = 0.04;
      while (p < len - 0.1) {
        const pw = 0.08 + r() * 0.16;
        const ph = 0.1 + r() * ((h - 0.2) / levels - 0.14);
        const pd = depth * (0.5 + r() * 0.4);
        const col = colorful ? `hsl(${Math.floor(r() * 360)}, ${50 + r() * 40}%, ${35 + r() * 30}%)` : `hsl(30, 10%, ${30 + r() * 30}%)`;
        if (alongX) this.cbox(x0 + p, yy, (z0 + z1) / 2 - pd / 2, x0 + p + pw, yy + ph, (z0 + z1) / 2 + pd / 2, col, r() > 0.6 ? 'gloss' : 'matte');
        else this.cbox((x0 + x1) / 2 - pd / 2, yy, z0 + p, (x0 + x1) / 2 + pd / 2, yy + ph, z0 + p + pw, col, r() > 0.6 ? 'gloss' : 'matte');
        p += pw + 0.015 + r() * 0.03;
      }
    }
    // montants
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) this.cbox(px - 0.025, y, pz - 0.025, px + 0.025, y + h, pz + 0.025, frame, 'metal');
  }

  table(x: number, z: number, y: number, w: number, d: number, h = 0.75, top = '#7a5333', legs = '#2b2b2b'): void {
    this.cbox(x - w / 2, y + h - 0.04, z - d / 2, x + w / 2, y + h, z + d / 2, top, 'gloss');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cbox(x + sx * (w / 2 - 0.05) - 0.025, y, z + sz * (d / 2 - 0.05) - 0.025, x + sx * (w / 2 - 0.05) + 0.025, y + h - 0.04, z + sz * (d / 2 - 0.05) + 0.025, legs, 'metal');
    this.col(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y, y + h, { walkable: false });
  }

  chair(x: number, z: number, y: number, yaw: number, color = '#2b2f36'): void {
    const g: THREE.BufferGeometry[] = [];
    g.push(new THREE.BoxGeometry(0.44, 0.05, 0.44).translate(0, 0.45, 0));
    g.push(new THREE.BoxGeometry(0.44, 0.45, 0.05).translate(0, 0.7, -0.2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(sx * 0.19, 0.225, sz * 0.19));
    const m = merge(g).rotateY(yaw).translate(x, y, z);
    this.add('matte', paint(m, color));
  }

  sofa(x: number, z: number, y: number, yaw: number, w = 2.1, color = '#4b4f5a'): void {
    const g: THREE.BufferGeometry[] = [];
    g.push(new THREE.BoxGeometry(w, 0.42, 0.9).translate(0, 0.21, 0));
    g.push(new THREE.BoxGeometry(w, 0.5, 0.22).translate(0, 0.6, -0.34));
    g.push(new THREE.BoxGeometry(0.2, 0.62, 0.9).translate(-w / 2 + 0.1, 0.31, 0));
    g.push(new THREE.BoxGeometry(0.2, 0.62, 0.9).translate(w / 2 - 0.1, 0.31, 0));
    const m = merge(g).rotateY(yaw).translate(x, y, z);
    this.add('fabric', paint(m, color));
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hx = (w / 2) * c + 0.45 * s, hz = (w / 2) * s + 0.45 * c;
    this.col(x - hx, z - hz, x + hx, z + hz, y, y + 0.45, { walkable: false });
  }

  bed(x: number, z: number, y: number, yaw: number, color = '#3d5a80'): void {
    const g: THREE.BufferGeometry[] = [];
    g.push(new THREE.BoxGeometry(1.5, 0.3, 2.05).translate(0, 0.15, 0));
    const frame = merge(g).rotateY(yaw).translate(x, y, z);
    this.add('matte', paint(frame, '#5b4636'));
    const mat = new THREE.BoxGeometry(1.42, 0.22, 1.95).translate(0, 0.41, 0).rotateY(yaw).translate(x, y, z);
    this.add('fabric', paint(mat, color));
    const pillow = new THREE.BoxGeometry(1.2, 0.12, 0.4).translate(0, 0.57, -0.72).rotateY(yaw).translate(x, y, z);
    this.add('fabric', paint(pillow, '#f0eee8'));
    const head = new THREE.BoxGeometry(1.5, 0.8, 0.08).translate(0, 0.4, -1.03).rotateY(yaw).translate(x, y, z);
    this.add('matte', paint(head, '#5b4636'));
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hx = 0.75 * c + 1.03 * s, hz = 0.75 * s + 1.03 * c;
    this.col(x - hx, z - hz, x + hx, z + hz, y, y + 0.52, { walkable: false });
  }

  plant(x: number, z: number, y: number, s = 1): void {
    this.ccyl(x, y, z, 0.2 * s, 0.4 * s, '#6e4f3a', 'matte', 10, false, 0.24 * s);
    const g = new THREE.IcosahedronGeometry(0.42 * s, 1).scale(1, 1.3, 1).translate(x, y + 0.85 * s, z);
    this.add('matte', paint(g, '#3f7a3a'));
    this.kit.world.addCylinder({ x, z, r: 0.25 * s, y0: y, y1: y + 1.2 * s, surf: 'wood', walkable: false });
  }

  tv(x: number, y: number, z: number, yaw: number, w = 1.3): THREE.Mesh {
    const frame = new THREE.BoxGeometry(w + 0.06, w * 0.6, 0.06).rotateY(yaw).translate(x, y, z);
    this.add('gloss', paint(frame, '#0d0e10'));
    // écran dynamique (allumé / éteint)
    const screenMat = new THREE.MeshBasicMaterial({ color: '#05070a' });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.55), screenMat);
    scr.position.set(x + Math.sin(yaw) * 0.035, y, z + Math.cos(yaw) * 0.035);
    scr.rotation.y = yaw;
    this.b.dynamic.add(scr);
    return scr;
  }

  tires(x: number, z: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const g = new THREE.TorusGeometry(0.33, 0.12, 8, 18).rotateX(Math.PI / 2).translate(x, y + 0.12 + i * 0.24, z);
      this.add('matte', paint(g, '#151515'));
    }
    this.kit.world.addCylinder({ x, z, r: 0.45, y0: y, y1: y + n * 0.24, surf: 'metal' });
  }

  barrel(x: number, z: number, y: number, color = '#2f5d8a'): void {
    this.ccyl(x, y, z, 0.29, 0.88, color, 'gloss', 14, true);
    this.ccyl(x, y + 0.88, z, 0.27, 0.02, '#333', 'metal', 14);
  }

  pallet(x: number, z: number, y: number, yaw = 0, load = 0): void {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) g.push(new THREE.BoxGeometry(1.2, 0.025, 0.14).translate(0, 0.13, -0.4 + i * 0.2));
    for (let i = 0; i < 3; i++) g.push(new THREE.BoxGeometry(0.1, 0.1, 1.0).translate(-0.5 + i * 0.5, 0.06, 0));
    const m = merge(g).rotateY(yaw).translate(x, y, z);
    this.add('matte', paint(m, '#a37b4c'));
    if (load > 0) this.cbox(x - 0.55, y + 0.145, z - 0.45, x + 0.55, y + 0.145 + load, z + 0.45, '#b49a72', 'matte');
    this.col(x - 0.6, z - 0.6, x + 0.6, z + 0.6, y, y + 0.15 + load, { walkable: true, surf: 'wood' });
  }

  toolWall(x0: number, x1: number, z: number, y: number, inSide: 1 | -1, seed: number): void {
    // panneau perforé + outils
    this.cbox(x0, y + 1.1, z, x1, y + 2.4, z + inSide * 0.03, '#3a4a5a', 'matte');
    const r = rng(seed);
    for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.16 + r() * 0.12) {
      const yy = y + 1.25 + r() * 0.9;
      const len = 0.15 + r() * 0.25;
      this.cbox(x, yy, z + inSide * 0.03, x + 0.03, yy + len, z + inSide * 0.06, r() > 0.5 ? '#c0c4c8' : '#c0392b', r() > 0.5 ? 'metal' : 'gloss');
    }
  }

  toolChest(x: number, z: number, y: number, color = '#c0392b'): void {
    this.cbox(x - 0.35, y + 0.1, z - 0.25, x + 0.35, y + 1.0, z + 0.25, color, 'gloss', { walkable: false });
    for (let i = 0; i < 5; i++) this.cbox(x - 0.33, y + 0.2 + i * 0.16, z + 0.25, x + 0.33, y + 0.22 + i * 0.16, z + 0.27, '#c8ccd1', 'metal');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.ccyl(x + sx * 0.28, y, z + sz * 0.18, 0.05, 0.1, '#111', 'matte', 8);
  }

  /** Pont élévateur moto (table hydraulique). */
  lift(x: number, z0: number, z1: number, y: number, h = 0.6): void {
    this.cbox(x - 0.35, y + h - 0.06, z0, x + 0.35, y + h, z1, '#d63c2f', 'gloss');
    this.cbox(x - 0.25, y, (z0 + z1) / 2 - 0.4, x + 0.25, y + h - 0.06, (z0 + z1) / 2 + 0.4, '#5b5f66', 'metal');
    this.cbox(x - 0.06, y + h, z1 - 0.25, x + 0.06, y + h + 0.3, z1 - 0.05, '#2b2b2b', 'metal');
    this.col(x - 0.36, z0, x + 0.36, z1, y, y + h, { surf: 'metal' });
  }

  car(x: number, z: number, y: number, yaw: number, color: string, wrecked = false): void {
    const g: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1.8, 0.62, 4.3).translate(0, 0.62, 0), new THREE.BoxGeometry(1.6, 0.5, 2.2).translate(0, 1.18, -0.2)];
    const body = merge(g).rotateY(yaw).translate(x, y - (wrecked ? 0.25 : 0), z);
    this.add('gloss', paint(body, color));
    const glass = new THREE.BoxGeometry(1.62, 0.42, 2.0).translate(0, 1.18, -0.2).rotateY(yaw).translate(x, y - (wrecked ? 0.25 : 0), z);
    this.add('gloss', paint(glass, wrecked ? '#30302c' : '#14191f'));
    if (!wrecked) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2).translate(sx * 0.8, 0.33, sz * 1.35).rotateY(yaw).translate(x, y, z);
      this.add('matte', paint(w, '#121212'));
    }
    this.kit.world.addBox({ x, z, hx: 0.9, hz: 2.15, yaw, y0: y, y1: y + 1.45 - (wrecked ? 0.25 : 0), surf: 'metal', tag: 'car' });
  }

  debris(x: number, z: number, y: number, seed: number, n = 10, spread = 1.5): void {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const s = 0.1 + r() * 0.35;
      const g = new THREE.BoxGeometry(s * (1 + r()), s * 0.6, s * (1 + r())).rotateY(r() * 3).rotateX((r() - 0.5) * 0.6).translate(x + (r() - 0.5) * spread * 2, y + s * 0.25, z + (r() - 0.5) * spread * 2);
      this.add('matte', paint(g, r() > 0.5 ? '#7d7a73' : '#5b544b'));
    }
  }

  /** Fusionne la géométrie par matériau dans le groupe du bâtiment. */
  finish(): void {
    const K = this.kit;
    for (const [key, list] of this.geos) {
      const mat = key === 'glow' ? this.b.glow : this.extraMats.get(key) ?? K.mats[key];
      if (!mat) throw new Error(`matériau inconnu : ${key}`);
      const colored = !!(mat as THREE.MeshStandardMaterial).vertexColors;
      const merged = mergeGeometries(list.map((g) => prep(g, colored)), false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = key !== 'glass' && key !== 'glow' && !key.startsWith('sign') && !key.startsWith('board');
      m.receiveShadow = key !== 'glow';
      this.b.group.add(m);
    }
    this.geos.clear();
  }
}

export function shadeHex(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l + amt, 0, 1));
  return '#' + c.getHexString();
}

// ------------------------------------------------------------------ portes
export type DoorKind = 'swing' | 'slide' | 'rollup';

export interface DoorOpts {
  id: string;
  kind: DoorKind;
  axis: 'x' | 'z'; // la porte s'étend le long de cet axe
  a0: number; // début de l'ouverture (le long de l'axe)
  a1: number;
  c: number; // position du mur (z si axis = x, x si axis = z)
  y0: number;
  h: number;
  inSide: 1 | -1; // côté intérieur (+z / +x)
  auto?: boolean; // s'ouvre seule à l'approche d'un piéton
  bikeOk?: boolean; // une moto peut passer
  color?: string;
  glass?: boolean;
  name: string; // « la porte », « le rideau »…
  building: string;
}

export class Door {
  open = 0;
  target = 0;
  group = new THREE.Group();
  private leaves: { obj: THREE.Object3D; sign: number }[] = [];
  collider: Collider;
  speed: number;
  /** verrouillée tant que la condition est vraie */
  locked: (() => string | null) | null = null;

  constructor(public o: DoorOpts, kit: Kit) {
    const w = o.a1 - o.a0;
    const mid = (o.a0 + o.a1) / 2;
    const at = (a: number, y: number, c: number) => (o.axis === 'x' ? new THREE.Vector3(a, y, c) : new THREE.Vector3(c, y, a));
    const color = o.color ?? (o.kind === 'rollup' ? '#9aa1a8' : '#4a3a2c');
    const leafMat = o.glass ? (kit.mats.glass as THREE.Material) : new THREE.MeshStandardMaterial({ color, roughness: o.kind === 'rollup' ? 0.45 : 0.6, metalness: o.kind === 'rollup' ? 0.6 : 0.1 });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.4, metalness: 0.7 });
    this.speed = o.kind === 'rollup' ? 0.45 : o.kind === 'slide' ? 1.6 : 1.4;
    if (o.kind === 'rollup') {
      // rideau à lames : panneau texturé qui remonte dans le caisson
      const tex = kit.signMat(`rollup:${color}`, 64, 256, (g, W, H) => {
        g.fillStyle = color;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 32; i++) {
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.fillRect(0, (i * H) / 32, W, 2);
          g.fillStyle = 'rgba(255,255,255,0.15)';
          g.fillRect(0, (i * H) / 32 + 2, W, 1);
        }
      }, false);
      (tex as THREE.MeshStandardMaterial).metalness = 0.5;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(o.axis === 'x' ? w : 0.06, o.h, o.axis === 'x' ? 0.06 : w).translate(0, -o.h / 2, 0), tex);
      panel.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.copy(at(mid, o.y0 + o.h, o.c));
      pivot.add(panel);
      this.group.add(pivot);
      this.leaves.push({ obj: panel, sign: 1 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(o.axis === 'x' ? w + 0.3 : 0.5, 0.45, o.axis === 'x' ? 0.5 : w + 0.3), frameMat);
      box.position.copy(at(mid, o.y0 + o.h + 0.2, o.c - o.inSide * 0.05));
      this.group.add(box);
    } else {
      const double = w > 1.3;
      const n = double ? 2 : 1;
      const lw = w / n;
      for (let i = 0; i < n; i++) {
        const hingeA = i === 0 ? o.a0 : o.a1;
        const dirA = i === 0 ? 1 : -1;
        const pivot = new THREE.Group();
        pivot.position.copy(at(hingeA, o.y0, o.c));
        const leaf = new THREE.Group();
        const geo = o.axis === 'x' ? new THREE.BoxGeometry(lw - 0.02, o.h - 0.02, 0.05).translate((dirA * lw) / 2, o.h / 2, 0) : new THREE.BoxGeometry(0.05, o.h - 0.02, lw - 0.02).translate(0, o.h / 2, (dirA * lw) / 2);
        const m = new THREE.Mesh(geo, leafMat);
        m.castShadow = !o.glass;
        leaf.add(m);
        // cadre + poignée
        const fg = o.axis === 'x' ? new THREE.BoxGeometry(lw, 0.06, 0.07).translate((dirA * lw) / 2, o.h - 0.03, 0) : new THREE.BoxGeometry(0.07, 0.06, lw).translate(0, o.h - 0.03, (dirA * lw) / 2);
        leaf.add(new THREE.Mesh(fg, frameMat));
        if (o.glass) {
          const fb = o.axis === 'x' ? new THREE.BoxGeometry(lw, 0.08, 0.07).translate((dirA * lw) / 2, 0.04, 0) : new THREE.BoxGeometry(0.07, 0.08, lw).translate(0, 0.04, (dirA * lw) / 2);
          leaf.add(new THREE.Mesh(fb, frameMat));
          const fs = o.axis === 'x' ? new THREE.BoxGeometry(0.05, o.h, 0.07).translate(dirA * (lw - 0.025), o.h / 2, 0) : new THREE.BoxGeometry(0.07, o.h, 0.05).translate(0, o.h / 2, dirA * (lw - 0.025));
          leaf.add(new THREE.Mesh(fs, frameMat));
        }
        const hd = o.axis === 'x' ? new THREE.BoxGeometry(0.03, 0.3, 0.14).translate(dirA * (lw - 0.1), 1.0, 0) : new THREE.BoxGeometry(0.14, 0.3, 0.03).translate(0, 1.0, dirA * (lw - 0.1));
        leaf.add(new THREE.Mesh(hd, Mats_handle));
        pivot.add(leaf);
        this.group.add(pivot);
        this.leaves.push({ obj: o.kind === 'swing' ? pivot : leaf, sign: dirA });
      }
    }
    // collision de l'ouvrant (non praticable comme sol)
    const th = 0.14;
    this.collider = o.axis === 'x'
      ? kit.world.addBox({ x: mid, z: o.c, hx: w / 2, hz: th, y0: o.y0, y1: o.y0 + o.h, surf: 'metal', walkable: false })
      : kit.world.addBox({ x: o.c, z: mid, hx: th, hz: w / 2, y0: o.y0, y1: o.y0 + o.h, surf: 'metal', walkable: false });
    if (!o.bikeOk) {
      // barrière invisible : les motos ne passent pas les portes piétonnes
      if (o.axis === 'x') kit.world.addBox({ x: mid, z: o.c, hx: w / 2 + 0.1, hz: 0.5, y0: o.y0 - 0.3, y1: o.y0 + o.h, layer: 'bike', walkable: false });
      else kit.world.addBox({ x: o.c, z: mid, hx: 0.5, hz: w / 2 + 0.1, y0: o.y0 - 0.3, y1: o.y0 + o.h, layer: 'bike', walkable: false });
    }
  }

  get center(): THREE.Vector3 {
    const mid = (this.o.a0 + this.o.a1) / 2;
    return this.o.axis === 'x' ? new THREE.Vector3(mid, this.o.y0 + 1, this.o.c) : new THREE.Vector3(this.o.c, this.o.y0 + 1, mid);
  }

  toggle(): void {
    this.target = this.target > 0.5 ? 0 : 1;
  }

  /** `walkerNear` : un piéton est devant la porte (portes automatiques). */
  update(dt: number, walkerNear: boolean): void {
    if (this.o.auto) this.target = walkerNear ? 1 : 0;
    const prev = this.open;
    this.open = clamp(this.open + Math.sign(this.target - this.open) * this.speed * dt, 0, 1);
    if (Math.abs(this.target - this.open) < this.speed * dt) this.open = this.target;
    if (prev === this.open) return;
    const e = this.open * this.open * (3 - 2 * this.open);
    const o = this.o;
    const w = o.a1 - o.a0;
    for (const l of this.leaves) {
      if (o.kind === 'swing') {
        // s'ouvre vers l'intérieur
        const ang = e * 1.55;
        if (o.axis === 'x') l.obj.rotation.y = -o.inSide * l.sign * ang;
        else l.obj.rotation.y = o.inSide * l.sign * ang;
      } else if (o.kind === 'slide') {
        const d = -l.sign * e * (w / 2 - 0.05);
        if (o.axis === 'x') l.obj.position.x = d;
        else l.obj.position.z = d;
      } else {
        l.obj.scale.y = Math.max(0.04, 1 - e * 0.96);
        l.obj.position.y = 0;
      }
    }
    this.collider.solid = this.open < 0.8;
  }
}

const Mats_handle = new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.25, metalness: 1 });

// ------------------------------------------------------------------ PNJ
export type NpcPose = 'stand' | 'counter' | 'sit' | 'talk';

export interface NpcOpts {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: NpcPose;
  counterH?: number;
  seatH?: number;
  look: Partial<RiderConfig>;
  lines: string[];
}

export class Npc {
  root = new THREE.Group();
  rider: Rider;
  private t: number;
  private head = 0;
  private lineIdx = 0;

  constructor(public o: NpcOpts, kit: Kit) {
    this.rider = new Rider({ ...defaultRider(), helmet: 'none', top: 'tee', pants: 'jeans', shoes: 'sneakers', backpack: false, topPattern: 'solid', ...o.look } as RiderConfig);
    this.root.add(this.rider.root);
    this.root.position.set(o.x, o.y, o.z);
    this.root.rotation.y = o.yaw;
    this.t = (o.x * 7.3 + o.z * 3.1) % 10;
    // on ne traverse pas les personnages
    kit.world.addCylinder({ x: o.x, z: o.z, r: 0.32, y0: o.y, y1: o.y + 1.8, surf: 'concrete', walkable: false });
    this.pose(0);
  }

  nextLine(): string {
    const l = this.o.lines[this.lineIdx % this.o.lines.length];
    this.lineIdx++;
    return l;
  }

  update(dt: number, px: number, pz: number, near: boolean): void {
    this.t += dt;
    let want = 0;
    if (near) {
      const ang = Math.atan2(px - this.o.x, pz - this.o.z);
      want = clamp(wrapAngle(ang - this.o.yaw), -1.1, 1.1);
    }
    this.head = damp(this.head, want, 4, dt);
    this.pose(dt);
  }

  private pose(_dt: number): void {
    const o = this.o;
    const b = o.pose === 'sit' ? sitPose(o.seatH ?? 0.45, this.t, this.head) : idlePose(this.t, { lookYaw: this.head, handsOn: o.pose === 'counter' ? (o.counterH ?? 1.05) : null, gesture: o.pose === 'talk' ? 1 : 0 });
    this.rider.poseFree(b);
  }
}

// ------------------------------------------------------------------ motos d'exposition
/** Construit le modèle 3D d'une moto et fusionne ses pièces par matériau (exposition). */
export function displayBike(spec: BikeSpec, cfg: BikeConfig): THREE.Group {
  const vis = buildBikeVisual(spec, cfg);
  vis.update(0.25, spec.travelF * 0.25, spec.travelR * 0.25, 0, 0);
  vis.root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  vis.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || !m.visible) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    let arr = byMat.get(m.material);
    if (!arr) byMat.set(m.material, (arr = []));
    arr.push(g);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const mesh = new THREE.Mesh(merge(list), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
    list.forEach((g) => g.dispose());
  }
  vis.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  return out;
}

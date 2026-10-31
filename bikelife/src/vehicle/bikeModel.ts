// Construction procédurale des modèles 3D de motos et de scooters.
// Repère modèle : origine au sol sous l'axe de roue arrière, +Z vers l'avant,
// +Y vers le haut, +X = côté gauche du pilote.

import * as THREE from 'three';
import type { BikeSpec, TireType } from '../data/bikes';
import type { BikeConfig } from '../data/parts';
import { DEG } from '../core/math';
import { Mats, decalTexture, plateTexture, licenseTexture, seatTexture, shade } from './materials';
import { cylBetween, merge, mergeStatic, mesh, roundedBox, shell, sidePanel, tube, varTube, yawAroundCenter, V3 } from './geom';
import { lookFor, exhaustFor } from '../data/modelStyles';
import { buildRoad } from './roadModel';

export interface BikeVisual {
  root: THREE.Group;
  steer: THREE.Object3D;
  forkSlider: THREE.Object3D;
  frontWheel: THREE.Object3D;
  rearWheel: THREE.Object3D;
  swingarm: THREE.Object3D;
  gripL: THREE.Object3D;
  gripR: THREE.Object3D;
  seat: THREE.Vector3;
  pegL: THREE.Vector3;
  pegR: THREE.Vector3;
  headlight: THREE.Object3D | null;
  headlightMat: THREE.MeshStandardMaterial | null;
  taillightMat: THREE.MeshStandardMaterial | null;
  exhaustTip: THREE.Vector3;
  isScooter: boolean;
  update(steer: number, compF: number, compR: number, rotF: number, rotR: number): void;
  dispose(): void;
}

// ------------------------------------------------------------------ roues
function knobGeometry(r: number, w: number, tire: TireType): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  if (tire === 'street' || tire === 'slick') return out;
  const knobH = tire === 'knobby' ? 0.016 : 0.009;
  const n = Math.round((Math.PI * 2 * r) / (tire === 'knobby' ? 0.042 : 0.034));
  const box = new THREE.BoxGeometry(knobH, 0.022, 0.026);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rows = i % 2 === 0 ? [-0.3, 0.3] : [0];
    for (const rx of rows) {
      const g = box.clone();
      const rr = r - 0.004 + knobH / 2;
      // le box est orienté radial selon X local avant rotation ; on le place dans le plan YZ
      const m = new THREE.Matrix4().makeRotationX(a);
      const t = new THREE.Matrix4().makeTranslation(rx * w, 0, 0);
      const local = new THREE.Matrix4().makeTranslation(0, rr, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      g.applyMatrix4(local);
      g.applyMatrix4(m);
      g.applyMatrix4(t);
      out.push(g);
    }
  }
  box.dispose();
  return out;
}

function tireGeometry(r: number, rimR: number, w: number, tire: TireType): THREE.BufferGeometry {
  const hT = r - rimR;
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [
    [rimR - 0.004, -0.4], [rimR + 0.25 * hT, -0.5], [rimR + 0.7 * hT, -0.5], [r - 0.12 * hT, -0.4], [r - 0.02 * hT, -0.24],
    [r, -0.08], [r, 0.08], [r - 0.02 * hT, 0.24], [r - 0.12 * hT, 0.4], [rimR + 0.7 * hT, 0.5], [rimR + 0.25 * hT, 0.5], [rimR - 0.004, 0.4],
  ];
  const knob = tire === 'knobby' || tire === 'enduro' ? 0.01 : 0;
  for (const [rad, ax] of prof) pts.push(new THREE.Vector2(rad - knob, ax * w));
  const g = new THREE.LatheGeometry(pts, 44);
  // axe du tour (Y) → axe X
  g.rotateZ(Math.PI / 2);
  const parts = [g, ...knobGeometry(r - knob, w, tire)];
  return merge(parts);
}

function rimGeometry(rimR: number, w: number): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(rimR - 0.018, -0.5 * w), new THREE.Vector2(rimR + 0.006, -0.5 * w), new THREE.Vector2(rimR + 0.006, -0.42 * w),
    new THREE.Vector2(rimR - 0.008, -0.36 * w), new THREE.Vector2(rimR - 0.008, 0.36 * w), new THREE.Vector2(rimR + 0.006, 0.42 * w),
    new THREE.Vector2(rimR + 0.006, 0.5 * w), new THREE.Vector2(rimR - 0.018, 0.5 * w), new THREE.Vector2(rimR - 0.024, 0),
    new THREE.Vector2(rimR - 0.018, -0.5 * w),
  ];
  const g = new THREE.LatheGeometry(pts, 44);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function discGeometry(radius: number, wave: boolean): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = radius * (wave ? 1 + 0.035 * Math.sin(a * 12) : 1);
    i === 0 ? s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const inner = new THREE.Path();
  inner.absarc(0, 0, radius * 0.62, 0, Math.PI * 2, true);
  s.holes.push(inner);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8, radius * 0.045, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false, curveSegments: 6 });
  g.rotateY(Math.PI / 2);
  return g;
}

function sprocketGeometry(radius: number, teeth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? radius : radius * 0.93;
    i === 0 ? s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.45, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 4 });
  g.rotateY(Math.PI / 2);
  return g;
}

export interface WheelOpts {
  r: number;
  rimInch: number;
  width: number;
  tire: TireType;
  rimStyle: 'spoke' | 'cast' | 'deep';
  rimColor: string;
  disc?: { r: number; side: number };
  sprocket?: { r: number; side: number };
  spokes: number;
  hubColor?: string;
}

export function buildWheel(o: WheelOpts): THREE.Group {
  const g = new THREE.Group();
  const rimR = (o.rimInch * 0.0254) / 2 + 0.012;
  mesh(tireGeometry(o.r, rimR, o.width, o.tire), Mats.rubber(), g);
  const rimW = o.rimStyle === 'deep' ? o.width * 0.95 : o.width * 0.72;
  const rimMat = o.rimStyle === 'cast' ? Mats.metal(o.rimColor, 0.3, 0.75) : Mats.metal(o.rimColor, 0.28, 0.85);
  mesh(rimGeometry(rimR, rimW), rimMat, g);
  const hubMat = Mats.metal(o.hubColor ?? '#b8bcc2', 0.3, 1);
  // moyeu
  const hub = new THREE.CylinderGeometry(0.042, 0.042, 0.15, 16);
  hub.rotateZ(Math.PI / 2);
  const hubParts: THREE.BufferGeometry[] = [hub];
  for (const sd of [-1, 1]) {
    const f = new THREE.CylinderGeometry(0.058, 0.058, 0.008, 18);
    f.rotateZ(Math.PI / 2);
    f.translate(sd * 0.05, 0, 0);
    hubParts.push(f);
  }
  mesh(merge(hubParts), hubMat, g);
  if (o.rimStyle === 'cast') {
    const blades: THREE.BufferGeometry[] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const off of [-0.09, 0.09]) {
        const aa = a + off;
        blades.push(cylBetween([0, Math.cos(aa) * 0.045, Math.sin(aa) * 0.045], [0, Math.cos(aa + off * 0.4) * (rimR - 0.015), Math.sin(aa + off * 0.4) * (rimR - 0.015)], 0.012, 0.009, 6));
      }
    }
    mesh(merge(blades), rimMat, g);
  } else {
    const spokes: THREE.BufferGeometry[] = [];
    const n = o.spokes;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const side = i % 2 === 0 ? 1 : -1;
      const cross = (i % 4 < 2 ? 1 : -1) * 0.32;
      const hx = side * 0.05;
      const ha = a + cross;
      spokes.push(cylBetween([hx, Math.cos(ha) * 0.054, Math.sin(ha) * 0.054], [side * 0.012, Math.cos(a) * (rimR - 0.018), Math.sin(a) * (rimR - 0.018)], 0.0022, 0.0022, 4));
    }
    mesh(merge(spokes), Mats.metal('#c9ccd1', 0.25, 1), g);
  }
  if (o.disc) {
    const d = discGeometry(o.disc.r, true);
    d.translate(o.disc.side * 0.072, 0, 0);
    mesh(d, Mats.metal('#9ea3a8', 0.22, 1), g);
    const carrier = new THREE.CylinderGeometry(o.disc.r * 0.6, o.disc.r * 0.6, 0.012, 20);
    carrier.rotateZ(Math.PI / 2);
    carrier.translate(o.disc.side * 0.066, 0, 0);
    mesh(carrier, Mats.metal('#d9a520', 0.35, 0.9), g);
  }
  if (o.sprocket) {
    const sp = sprocketGeometry(o.sprocket.r, 48);
    sp.translate(o.sprocket.side * 0.085, 0, 0);
    mesh(sp, Mats.metal('#c43b1a', 0.4, 0.9), g);
  }
  return g;
}

// ------------------------------------------------------------------ helpers locaux
const P = (z: number, y: number): [number, number] => [z, y];

export function exhaustMat(cfg: BikeConfig): THREE.Material {
  switch (cfg.exhaust) {
    case 'titanium':
      return Mats.titanium();
    case 'carbon':
      return Mats.carbon();
    case 'sport':
      return Mats.metal('#d7dadf', 0.18, 1);
    default:
      return Mats.metal('#8a8f96', 0.3, 1);
  }
}

// ------------------------------------------------------------------ moto (MX / SM / stunt)
function buildMoto(spec: BikeSpec, cfg: BikeConfig): BikeVisual {
  const root = new THREE.Group();
  root.name = 'bike';
  const L = spec.wheelbase;
  const s = L / 1.48;
  const rF = spec.rFront, rR = spec.rRear;
  const dy = (rF + rR) / 2 - 0.345 + (spec.cls === 'mini' ? 0.03 : 0);
  const rake = spec.rake * DEG;
  const isSM = spec.cls === 'sm' || spec.cls === 'stunt';
  const fourT = spec.stroke === 4;
  const big = spec.cc >= 400;

  const primary = cfg.primary;
  const plastMat = Mats.plastic(primary, 0.38);
  const secMat = Mats.plastic(cfg.secondary, 0.4);
  const frameMat = Mats.metal(cfg.frame, 0.3, spec.cls === 'mx' || spec.cls === 'mini' ? 0.9 : 0.6);
  const darkMat = Mats.dark();
  const engMat = Mats.engine(fourT ? '#34363b' : '#2a2b2f');
  const alu = Mats.metal('#c3c8ce', 0.28, 1);
  const brandName = spec.brand === 'Custom' ? 'STREET KINGS' : spec.brand;
  const decalTex = decalTexture(cfg.decal === 'factory' ? `factory:${lookFor(spec.id).graphic}` : cfg.decal, primary, cfg.secondary, cfg.accent, brandName, cfg.plateNumber);
  const decalMat = Mats.textured(`dec:${decalTex.uuid}`, decalTex, { roughness: 0.36 });

  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  root.add(chassis);
  // proportions verticales calées sur les cotes réelles : le bas du cadre est à la
  // garde au sol, la selle à la hauteur de selle (dessin de référence : 0.20 → 0.96)
  const gc = spec.groundClearance;
  const ky = (spec.seatHeight - gc) / 0.76;
  const Y = (y: number) => gc + (y - 0.2) * ky;
  void dy;
  const Z = (z: number) => z * s;

  // --- cadre : aluminium double poutre (japonaises, Fantic) ou acier chrome-molybdène peint (européennes)
  const look = lookFor(spec.id);
  const ex4 = exhaustFor(spec.id, cfg.year);
  const subMat = look.subframeColor && !spec.stuntKit ? Mats.plastic(look.subframeColor, 0.55) : frameMat;
  const head: V3 = [0, Y(1.06), Z(1.1)];
  const headLow: V3 = [0, Y(0.9), Z(1.17)];
  const pivotZ = Z(0.585), pivotY = Y(0.5);
  if (look.frame === 'alu') {
    // poutres plates de section rectangulaire, de la colonne de direction à l'axe de bras
    const path: [number, number][] = [[Z(1.1), Y(1.06)], [Z(0.98), Y(1.0)], [Z(0.78), Y(0.88)], [Z(0.64), Y(0.7)], [pivotZ + 0.02, pivotY + 0.04]];
    const hw = [0.045, 0.05, 0.052, 0.055, 0.06];
    const up = path.map(([z, y], i) => P(z, y + hw[i]));
    const dn = path.map(([z, y], i) => P(z, y - hw[i])).reverse();
    for (const sd of [-1, 1]) {
      const spar = sidePanel([...up, ...dn], 0.034, 0, 0.008);
      spar.translate(sd * 0.105, 0, 0);
      mesh(spar, frameMat, chassis);
      // berceau inférieur fin
      mesh(tube([[0.02 * sd, headLow[1], headLow[2] - 0.02], [sd * 0.05, Y(0.6), Z(1.07)], [sd * 0.06, Y(0.28), Z(0.98)], [sd * 0.06, Y(0.2), Z(0.8)], [sd * 0.07, Y(0.26), Z(0.62)], [sd * 0.09, pivotY - 0.05, pivotZ]], 0.012, 24, 6), frameMat, chassis);
      // cadre arrière (boucle)
      mesh(tube([[sd * 0.09, Y(0.84), Z(0.7)], [sd * 0.085, Y(0.88), Z(0.35)], [sd * 0.075, Y(0.9), Z(-0.05)]], 0.013, 12, 6), subMat, chassis);
      mesh(tube([[sd * 0.09, Y(0.6), Z(0.6)], [sd * 0.085, Y(0.72), Z(0.3)], [sd * 0.075, Y(0.88), Z(0.0)]], 0.01, 12, 6), subMat, chassis);
    }
  } else {
    for (const sd of [-1, 1]) {
      const x = sd * 0.1;
      mesh(varTube([[0.03 * sd, head[1], head[2]], [x, Y(1.0), Z(0.98)], [x * 1.1, Y(0.86), Z(0.76)], [x, Y(0.66), Z(0.62)], [x * 0.95, pivotY + 0.03, pivotZ + 0.02]], (t) => 0.024 - t * 0.006, 20, 8), frameMat, chassis);
      // berceau
      mesh(tube([[0.02 * sd, headLow[1], headLow[2] - 0.02], [x * 0.5, Y(0.6), Z(1.07)], [x * 0.6, Y(0.28), Z(0.98)], [x * 0.6, Y(0.2), Z(0.8)], [x * 0.7, Y(0.26), Z(0.62)], [x * 0.9, pivotY - 0.05, pivotZ]], 0.013, 24, 6), frameMat, chassis);
      // boucle arrière (cadre arrière composite / alu selon le modèle)
      mesh(tube([[x * 0.9, Y(0.84), Z(0.7)], [x * 0.85, Y(0.88), Z(0.35)], [x * 0.75, Y(0.9), Z(-0.05)]], 0.014, 12, 6), subMat, chassis);
      mesh(tube([[x * 0.9, Y(0.6), Z(0.6)], [x * 0.85, Y(0.72), Z(0.3)], [x * 0.75, Y(0.88), Z(0.0)]], 0.011, 12, 6), subMat, chassis);
    }
  }
  // tube de direction
  mesh(cylBetween([0, Y(0.88), Z(1.175)], [0, Y(1.1), Z(1.065)], 0.028, 0.028, 14), frameMat, chassis);

  // --- moteur
  const eng = new THREE.Group();
  chassis.add(eng);
  const crank = roundedBox(0.2, 0.26 * s, 0.36 * s, 0.05);
  crank.rotateY(Math.PI / 2);
  crank.translate(0, Y(0.38), Z(0.8));
  mesh(crank, engMat, eng);
  // carters latéraux
  for (const sd of [-1, 1]) {
    const cov = new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.03, 24);
    cov.rotateZ(Math.PI / 2);
    cov.translate(sd * 0.105, Y(0.36), Z(sd < 0 ? 0.86 : 0.74));
    mesh(cov, sd < 0 ? Mats.metal('#43464c', 0.35, 0.9) : engMat, eng);
  }
  // cylindre
  const cylH = fourT ? 0.24 : 0.2;
  const cylAx = new THREE.Vector3(0, Math.cos(0.22), Math.sin(0.22));
  const cylBase = new THREE.Vector3(0, Y(0.5), Z(0.86));
  const cylTop = cylBase.clone().addScaledVector(cylAx, cylH * s);
  const finParts: THREE.BufferGeometry[] = [];
  const nFins = fourT ? 5 : 8;
  for (let i = 0; i < nFins; i++) {
    const p = cylBase.clone().addScaledVector(cylAx, (i / (nFins - 1)) * cylH * s * 0.85);
    const fin = new THREE.BoxGeometry(fourT ? 0.16 : 0.15, 0.012, fourT ? 0.16 : 0.13);
    fin.rotateX(0.22);
    fin.translate(p.x, p.y, p.z);
    finParts.push(fin);
  }
  finParts.push(cylBetween([cylBase.x, cylBase.y, cylBase.z], [cylTop.x, cylTop.y, cylTop.z], fourT ? 0.065 : 0.055, fourT ? 0.06 : 0.05, 16));
  mesh(merge(finParts), Mats.metal(fourT ? '#4a4d53' : '#5a5e65', 0.4, 0.85), eng);
  if (fourT) {
    const headCov = roundedBox(0.17, 0.08, 0.17, 0.03);
    headCov.rotateX(0.22);
    headCov.translate(cylTop.x, cylTop.y + 0.02, cylTop.z + 0.01);
    mesh(headCov, Mats.metal(spec.brand === 'Kronos' ? '#ff6a00' : '#c7cbd0', 0.35, 0.6), eng);
  }
  // radiateurs
  for (const sd of [-1, 1]) {
    const rad = new THREE.BoxGeometry(0.035, 0.3 * s, 0.17 * s);
    rad.rotateX(-0.15);
    rad.translate(sd * 0.115, Y(0.72), Z(1.04));
    mesh(rad, Mats.metal('#3b3e43', 0.5, 0.7), chassis);
  }

  // --- échappement
  const exMat = exhaustMat(cfg);
  const pipeMat = Mats.metal('#6d6259', 0.38, 1);
  const exhaustTip = new THREE.Vector3();
  if (!fourT) {
    // pot de détente 2 temps
    const pts: V3[] = [
      [0, cylBase.y + 0.02, cylBase.z + 0.07], [-0.02, Y(0.52), Z(1.08)], [-0.07, Y(0.32), Z(1.13)], [-0.12, Y(0.22), Z(1.0)],
      [-0.15, Y(0.3), Z(0.72)], [-0.16, Y(0.52), Z(0.48)], [-0.16, Y(0.66), Z(0.3)],
    ];
    mesh(varTube(pts, (t) => (0.022 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.042) * s, 48, 12), pipeMat, chassis);
    const sil0 = new THREE.Vector3(-0.16, Y(0.68), Z(0.32));
    const sil1 = new THREE.Vector3(-0.17, Y(0.85), Z(-0.22));
    mesh(cylBetween([sil0.x, sil0.y, sil0.z], [sil1.x, sil1.y, sil1.z], 0.04, 0.042, 16), exMat, chassis);
    exhaustTip.copy(sil1);
  } else {
    const silR = cfg.exhaust === 'stock' ? 0.048 : 0.052;
    const hdrMat = cfg.exhaust === 'titanium' ? Mats.titanium() : pipeMat;
    const silencer = (sd: number) => {
      const sil0 = new THREE.Vector3(sd * 0.165, Y(0.68), Z(0.4));
      const sil1 = new THREE.Vector3(sd * 0.175, Y(0.87), Z(-0.2));
      mesh(cylBetween([sil0.x, sil0.y, sil0.z], [sil1.x, sil1.y, sil1.z], silR * 0.9, silR, 16), exMat, chassis);
      mesh(cylBetween([sil1.x, sil1.y, sil1.z], [sil1.x, sil1.y + 0.01, sil1.z - 0.03], silR * 0.95, silR * 0.6, 16), Mats.metal('#2b2b2b', 0.4, 1), chassis);
      return sil1;
    };
    if (ex4 === 'reversed') {
      // culasse inversée : admission à l'avant, collecteur qui sort vers l'arrière et contourne la culasse
      const pts: V3[] = [
        [0, cylTop.y - 0.01, cylTop.z - 0.07], [-0.02, cylTop.y + 0.02, Z(0.66)], [-0.08, Y(0.86), Z(0.56)], [-0.14, Y(0.8), Z(0.48)], [-0.165, Y(0.72), Z(0.42)],
      ];
      mesh(varTube(pts, () => 0.022 * s, 30, 10), hdrMat, chassis);
      exhaustTip.copy(silencer(-1));
    } else {
      const pts: V3[] = [
        [0, cylTop.y - 0.03, cylTop.z + 0.06], [-0.04, Y(0.62), Z(1.08)], [-0.1, Y(0.42), Z(1.06)], [-0.15, Y(0.38), Z(0.86)],
        [-0.16, Y(0.5), Z(0.6)], [-0.165, Y(0.66), Z(0.38)],
      ];
      mesh(varTube(pts, () => 0.021 * s, 40, 10), hdrMat, chassis);
      exhaustTip.copy(silencer(-1));
      if (ex4 === 'dual') {
        // double silencieux (un de chaque côté, collecteurs séparés)
        const ptsL: V3[] = pts.map(([x, y, z], i) => [i === 0 ? 0.02 : -x, y, z] as V3);
        mesh(varTube(ptsL, () => 0.019 * s, 40, 10), hdrMat, chassis);
        silencer(1);
      }
    }
  }

  // prises d'air frontales (admission par l'avant de la culasse inversée)
  if (look.intakeVents) {
    for (const sd of [-1, 1]) {
      const v = roundedBox(0.03, 0.05, 0.12, 0.01);
      v.rotateX(-0.5);
      v.translate(sd * 0.075, Y(1.03), Z(1.0));
      mesh(v, Mats.dark(), chassis);
    }
  }

  // --- plastiques
  const tidy = cfg.plastics === 'stunt' || spec.cls === 'stunt';
  // réservoir
  mesh(sidePanel([P(Z(0.7), Y(0.88)), P(Z(0.74), Y(1.01)), P(Z(0.92), Y(1.06)), P(Z(1.06), Y(1.02)), P(Z(1.05), Y(0.9)), P(Z(0.88), Y(0.84))], 0.24, 0, 0.035), Mats.paint(primary, 0.35), chassis);
  // écopes de radiateur
  const raceKit = cfg.plastics === 'race';
  const retro = cfg.plastics === 'retro';
  const stockShrouds: Record<string, [number, number][]> = {
    // arrondies, bord avant incliné (YZ)
    rounded: [P(Z(0.8), Y(1.0)), P(Z(0.98), Y(1.06)), P(Z(1.18), Y(1.0)), P(Z(1.24), Y(0.84)), P(Z(1.12), Y(0.62)), P(Z(0.98), Y(0.66)), P(Z(0.86), Y(0.86))],
    // anguleuses à arêtes vives (KX, SX, MC, Fantic)
    angular: [P(Z(0.78), Y(1.01)), P(Z(1.0), Y(1.07)), P(Z(1.22), Y(1.02)), P(Z(1.2), Y(0.9)), P(Z(1.28), Y(0.78)), P(Z(1.1), Y(0.6)), P(Z(0.95), Y(0.7)), P(Z(0.84), Y(0.9))],
    // longues et effilées vers l'arrière (CR/CRF, RM-Z)
    swept: [P(Z(0.72), Y(0.97)), P(Z(0.96), Y(1.05)), P(Z(1.2), Y(1.01)), P(Z(1.26), Y(0.86)), P(Z(1.16), Y(0.6)), P(Z(1.0), Y(0.64)), P(Z(0.8), Y(0.86))],
    // hautes et carrées (TC / FC)
    blocky: [P(Z(0.82), Y(1.02)), P(Z(1.02), Y(1.07)), P(Z(1.22), Y(1.05)), P(Z(1.25), Y(0.8)), P(Z(1.16), Y(0.6)), P(Z(0.98), Y(0.62)), P(Z(0.86), Y(0.8))],
  };
  const shroudProf: [number, number][] = retro
    ? [P(Z(0.82), Y(0.98)), P(Z(1.0), Y(1.04)), P(Z(1.2), Y(0.92)), P(Z(1.16), Y(0.66)), P(Z(0.98), Y(0.68)), P(Z(0.84), Y(0.86))]
    : raceKit
      ? [P(Z(0.8), Y(1.0)), P(Z(0.98), Y(1.06)), P(Z(1.22), Y(1.0)), P(Z(1.29), Y(0.84)), P(Z(1.12), Y(0.62)), P(Z(0.98), Y(0.66)), P(Z(0.86), Y(0.86))]
      : stockShrouds[look.shroud];
  for (const sd of [-1, 1]) {
    const g = yawAroundCenter(sidePanel(shroudProf, 0.012, 0, 0.003), sd * 0.1, sd * (0.15 + (raceKit ? 0.015 : 0)));
    mesh(g, decalMat, chassis);
  }
  // selle
  const seatTex = seatTexture(cfg.seatColor, cfg.seat);
  const seatMat = Mats.textured(`seat:${seatTex.uuid}`, seatTex, { roughness: 0.75, clearcoat: 0 });
  const flat = cfg.seat === 'flat';
  const seatTop = spec.seatHeight;
  const seatProf: [number, number][] = [
    P(Z(-0.12), seatTop - 0.03), P(Z(0.2), seatTop + (flat ? -0.01 : 0.0)), P(Z(0.55), seatTop + (flat ? -0.01 : 0.005)), P(Z(0.8), seatTop + 0.035), P(Z(0.9), seatTop + 0.02),
    P(Z(0.88), seatTop - 0.06), P(Z(0.4), seatTop - 0.07), P(Z(-0.1), seatTop - 0.07),
  ];
  mesh(sidePanel(seatProf, 0.22, 0, 0.03), seatMat, chassis);
  // garde-boue arrière
  const fenderLen = tidy || cfg.fender === 'short' ? 0.3 : 0.58;
  const fProf: [number, number][] = [P(Z(0.05), seatTop - 0.07), P(Z(-0.15), seatTop - 0.05), P(Z(-fenderLen + 0.08), seatTop - 0.03), P(Z(-fenderLen), seatTop - 0.02), P(Z(-fenderLen), seatTop - 0.05), P(Z(-fenderLen + 0.08), seatTop - 0.06), P(Z(-0.15), seatTop - 0.1), P(Z(0.05), seatTop - 0.12)];
  mesh(sidePanel(fProf, 0.2, 0, 0.01), Mats.plastic(cfg.fenderColor ?? primary, 0.38), chassis);
  // plaques latérales (numéro)
  const plateTex = plateTexture(cfg.plateNumber, cfg.plateColor);
  const plateMat = Mats.textured(`plate:${plateTex.uuid}`, plateTex, { roughness: 0.4 });
  const sideProf: [number, number][] = [P(Z(-0.08), seatTop - 0.07), P(Z(0.42), seatTop - 0.07), P(Z(0.36), Y(0.66)), P(Z(0.06), Y(0.62))];
  for (const sd of [-1, 1]) {
    const sp = new THREE.Mesh(sidePanel(sideProf, 0.01, 0, 0.002), plateMat);
    sp.position.x = sd * 0.15;
    sp.castShadow = true;
    chassis.add(sp);
  }
  // boîte à air / cache
  const airbox = roundedBox(0.22, 0.2, 0.36, 0.03);
  airbox.translate(0, seatTop - 0.18, Z(0.25));
  mesh(airbox, darkMat, chassis);
  // repose-pieds
  const pegY = Y(0.33), pegZ = Z(0.55);
  for (const sd of [-1, 1]) {
    const peg = new THREE.BoxGeometry(0.1, 0.022, 0.05);
    peg.translate(sd * 0.2, pegY, pegZ);
    mesh(peg, Mats.metal('#9aa0a6', 0.35, 1), chassis);
  }
  // pédale de frein / sélecteur
  mesh(tube([[-0.16, pegY + 0.03, pegZ - 0.02], [-0.17, pegY + 0.01, pegZ + 0.16], [-0.16, pegY + 0.05, pegZ + 0.22]], 0.008, 6, 5), alu, chassis);
  mesh(tube([[0.15, pegY + 0.08, pegZ - 0.02], [0.17, pegY + 0.07, pegZ + 0.16]], 0.007, 4, 5), alu, chassis);
  // amortisseur arrière : partie supérieure fixe
  const shockTop = new THREE.Vector3(0, Y(0.86), Z(0.5));
  // phare / plaque avant
  let headlight: THREE.Object3D | null = null;
  let headlightMat: THREE.MeshStandardMaterial | null = null;
  let taillightMat: THREE.MeshStandardMaterial | null = null;
  // feu arrière + support de plaque (rue)
  if (isSM) {
    taillightMat = Mats.emissive('#ff2a1a', 1.2).clone();
    const tl = new THREE.BoxGeometry(0.08, 0.03, 0.03);
    tl.translate(0, seatTop - 0.04, Z(-fenderLen + 0.02));
    const tm = new THREE.Mesh(tl, taillightMat);
    tm.userData.keep = true;
    chassis.add(tm);
    const lic = new THREE.PlaneGeometry(0.17, 0.085);
    lic.rotateY(Math.PI);
    lic.rotateX(0.35);
    lic.translate(0, seatTop - 0.16, Z(-fenderLen + 0.03));
    const licTex = licenseTexture(cfg.plateNumber.padStart(3, '0') + '-BL');
    mesh(lic, Mats.textured(`lic:${licTex.uuid}`, licTex, { roughness: 0.5, clearcoat: 0 }), chassis);
  }

  // --- 12h / cage
  if (cfg.stuntBar) {
    for (const sd of [-1, 1]) {
      mesh(tube([[sd * 0.1, Y(0.86), Z(0.0)], [sd * 0.17, Y(0.82), Z(-0.22)], [sd * 0.16, Y(0.72), Z(-0.36)], [sd * 0.08, Y(0.68), Z(-0.42)]], 0.014, 14, 6), Mats.metal(cfg.accent, 0.35, 0.8), chassis);
    }
    mesh(cylBetween([-0.085, Y(0.68), Z(-0.42)], [0.085, Y(0.68), Z(-0.42)], 0.014), Mats.metal(cfg.accent, 0.35, 0.8), chassis);
  }
  if (cfg.cage) {
    for (const sd of [-1, 1]) {
      mesh(tube([[sd * 0.08, Y(1.0), Z(1.05)], [sd * 0.24, Y(0.82), Z(1.02)], [sd * 0.26, Y(0.45), Z(0.88)], [sd * 0.2, Y(0.3), Z(0.62)], [sd * 0.1, Y(0.5), Z(0.58)]], 0.013, 20, 6), Mats.metal(cfg.accent, 0.35, 0.8), chassis);
    }
  }

  // --- direction (fourche, guidon, roue avant)
  const axle = new THREE.Vector3(0, rF, L);
  const steerPivot = new THREE.Object3D();
  steerPivot.position.copy(axle);
  steerPivot.rotation.x = -rake;
  root.add(steerPivot);
  const steer = new THREE.Object3D();
  steerPivot.add(steer);
  const forkLen = (Y(1.12) - rF) / Math.cos(rake);
  const topClampY = forkLen;
  const lowClampY = forkLen - 0.17 * s;
  const clampMat = Mats.metal(spec.cls === 'mx' || spec.cls === 'mini' ? '#d8dbe0' : '#2a2a2a', 0.3, 1);
  const top = roundedBox(0.24, 0.035, 0.08, 0.012);
  top.translate(0, topClampY, -0.03);
  mesh(top, clampMat, steer);
  const low = roundedBox(0.26, 0.05, 0.09, 0.015);
  low.translate(0, lowClampY, -0.025);
  mesh(low, clampMat, steer);
  const forkColor = spec.cls === 'stunt' ? cfg.accent : look.forkOuter;
  const outerMat = Mats.metal(forkColor, 0.3, 0.9);
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * 0.085, topClampY + 0.02, -0.03], [sd * 0.085, forkLen * 0.42, -0.03], 0.027, 0.029, 14), outerMat, steer);
  }
  // guidon
  const barRise = cfg.bars === 'high' ? 0.13 : cfg.bars === 'low' ? 0.04 : cfg.bars === 'stunt' ? 0.09 : 0.085;
  const barW = cfg.bars === 'stunt' ? 0.4 : 0.39;
  const barMat = Mats.metal(cfg.barColor, 0.3, 0.9);
  const barBase = topClampY + 0.05;
  const barPts: V3[] = [[-barW, barBase + barRise + 0.02, -0.12], [-barW * 0.55, barBase + barRise, -0.1], [-0.11, barBase + 0.02, -0.06], [0, barBase, -0.05], [0.11, barBase + 0.02, -0.06], [barW * 0.55, barBase + barRise, -0.1], [barW, barBase + barRise + 0.02, -0.12]];
  mesh(tube(barPts, 0.014, 28, 8), barMat, steer);
  // mousse de guidon
  const pad = roundedBox(0.2, 0.05, 0.05, 0.02);
  pad.translate(0, barBase + 0.06, -0.06);
  if (cfg.bars !== 'low') mesh(pad, Mats.plastic(cfg.accent, 0.8), steer);
  for (const sd of [-1, 1]) {
    // poignées + leviers
    mesh(cylBetween([sd * (barW - 0.12), barBase + barRise + 0.015, -0.115], [sd * (barW + 0.005), barBase + barRise + 0.02, -0.12], 0.017, 0.017, 10), cfg.gripColor && cfg.gripColor !== '#1a1a1a' ? Mats.plastic(cfg.gripColor, 0.85) : Mats.rubber(), steer);
    mesh(tube([[sd * (barW - 0.15), barBase + barRise + 0.02, -0.1], [sd * (barW - 0.05), barBase + barRise + 0.03, -0.04], [sd * (barW - 0.0), barBase + barRise + 0.025, -0.05]], 0.006, 6, 5), Mats.metal('#2d2f33', 0.3, 0.9), steer);
  }
  if (cfg.bars === 'stunt') {
    // frein arrière au guidon (levier supplémentaire)
    mesh(tube([[0.24, barBase + barRise - 0.015, -0.1], [0.32, barBase + barRise - 0.02, -0.05]], 0.005, 4, 5), Mats.metal('#e01a22', 0.35, 0.9), steer);
  }
  const gripL = new THREE.Object3D();
  gripL.position.set(barW - 0.06, barBase + barRise + 0.018, -0.118);
  steer.add(gripL);
  const gripR = new THREE.Object3D();
  gripR.position.set(-(barW - 0.06), barBase + barRise + 0.018, -0.118);
  steer.add(gripR);
  // garde-boue avant (fixé au té inférieur) / plaque frontale ou phare
  const ffLen = cfg.fender === 'high' ? 0.4 : cfg.fender === 'short' ? 0.22 : 0.32;
  const ffPts: V3[] = [[0, lowClampY - 0.06, -0.2], [0, lowClampY - 0.06, -0.02], [0, lowClampY - 0.09, ffLen * 0.5], [0, lowClampY - (cfg.fender === 'high' ? 0.14 : 0.2), ffLen]];
  const ffGeo = shell(ffPts, (t) => 0.075 + Math.sin(t * Math.PI) * 0.012 - t * 0.02, 0.025, 0.004, 18, 8);
  mesh(ffGeo, isSM ? Mats.plastic(primary) : plastMat, steer);
  const lampKind = look.lamp !== 'none' ? look.lamp : isSM ? 'pointed' : 'none';
  if (lampKind === 'pointed') {
    // masque de phare pointu (supermotard)
    headlightMat = Mats.emissive('#fff4dc', 0.25).clone();
    const mask = sidePanel([P(-0.06, 0), P(0.1, 0.03), P(0.13, 0.2), P(0.02, 0.3), P(-0.08, 0.18)], 0.2, 0, 0.02);
    mask.translate(0, lowClampY - 0.12, 0.05);
    mesh(mask, decalMat, steer);
    const lens = new THREE.BoxGeometry(0.11, 0.045, 0.03);
    lens.rotateX(-0.35);
    lens.translate(0, lowClampY + 0.0, 0.17);
    const lm = new THREE.Mesh(lens, headlightMat);
    lm.userData.keep = true;
    steer.add(lm);
    headlight = new THREE.Object3D();
    headlight.position.set(0, lowClampY - 0.02, 0.2);
    steer.add(headlight);
  } else if (lampKind === 'round') {
    // optique ronde dans un masque clair
    headlightMat = Mats.emissive('#fff4dc', 0.25).clone();
    const mask = sidePanel([P(-0.06, 0), P(0.07, 0.02), P(0.1, 0.22), P(0.0, 0.3), P(-0.08, 0.2)], 0.22, 0, 0.025);
    mask.translate(0, lowClampY - 0.12, 0.04);
    mesh(mask, Mats.plastic(cfg.secondary === '#13235b' ? '#eef2f6' : cfg.primary, 0.4), steer);
    const ring = new THREE.TorusGeometry(0.068, 0.012, 8, 28);
    ring.translate(0, lowClampY - 0.0, 0.14);
    mesh(ring, Mats.metal('#2b2e33', 0.3, 0.8), steer);
    const lens = new THREE.CircleGeometry(0.066, 28);
    lens.translate(0, lowClampY - 0.0, 0.145);
    const lm = new THREE.Mesh(lens, headlightMat);
    lm.userData.keep = true;
    steer.add(lm);
    headlight = new THREE.Object3D();
    headlight.position.set(0, lowClampY - 0.0, 0.2);
    steer.add(headlight);
  } else {
    // plaque frontale (forme selon le modèle)
    const fplate = new THREE.Shape();
    if (look.plate === 'angular') {
      fplate.moveTo(-0.11, -0.13);
      fplate.lineTo(0.11, -0.13);
      fplate.lineTo(0.15, 0.06);
      fplate.lineTo(0.08, 0.13);
      fplate.lineTo(-0.08, 0.13);
      fplate.lineTo(-0.15, 0.06);
    } else if (look.plate === 'shield') {
      fplate.moveTo(0, -0.16);
      fplate.lineTo(0.13, -0.06);
      fplate.lineTo(0.14, 0.1);
      fplate.quadraticCurveTo(0, 0.15, -0.14, 0.1);
      fplate.lineTo(-0.13, -0.06);
    } else {
      fplate.moveTo(-0.12, -0.11);
      fplate.quadraticCurveTo(0, -0.16, 0.12, -0.11);
      fplate.lineTo(0.14, 0.09);
      fplate.quadraticCurveTo(0, 0.14, -0.14, 0.09);
    }
    fplate.closePath();
    const fpg = new THREE.ExtrudeGeometry(fplate, { depth: 0.008, bevelEnabled: false, curveSegments: 8 });
    // UV 0..1
    fpg.computeBoundingBox();
    const bb = fpg.boundingBox!;
    const uv = fpg.attributes.uv as THREE.BufferAttribute;
    const pos = fpg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
    fpg.rotateX(-0.12);
    fpg.translate(0, lowClampY + 0.04, 0.07);
    mesh(fpg, plateMat, steer);
    if (lampKind === 'enduro') {
      // phare d'enduro intégré à la plaque (homologué route)
      headlightMat = Mats.emissive('#fff4dc', 0.25).clone();
      const lens = new THREE.BoxGeometry(0.1, 0.06, 0.025).translate(0, lowClampY + 0.0, 0.085);
      const lm = new THREE.Mesh(lens, headlightMat);
      lm.userData.keep = true;
      steer.add(lm);
      headlight = new THREE.Object3D();
      headlight.position.set(0, lowClampY, 0.12);
      steer.add(headlight);
    } else {
      // rampe LED sur la plaque avant (éclairage de nuit)
      headlightMat = Mats.emissive('#eaf4ff', 0.25).clone();
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.02).translate(0, lowClampY - 0.03, 0.09), headlightMat);
      led.userData.keep = true;
      steer.add(led);
      headlight = new THREE.Object3D();
      headlight.position.set(0, lowClampY - 0.03, 0.12);
      steer.add(headlight);
    }
  }
  // coulisse de fourche (se déplace le long de l'axe)
  const forkSlider = new THREE.Object3D();
  steer.add(forkSlider);
  const stanchionMat = look.stanchion === 'gold' || spec.cls === 'stunt' ? Mats.metal('#d4a546', 0.15, 1) : look.stanchion === 'black' ? Mats.metal('#222', 0.2, 1) : Mats.chrome();
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * 0.085, forkLen * 0.48, -0.03], [sd * 0.085, 0.05, -0.03], 0.021, 0.021, 12), stanchionMat, forkSlider);
    const lug = roundedBox(0.04, 0.1, 0.06, 0.012);
    lug.translate(sd * 0.085, 0.02, -0.02);
    mesh(lug, darkMat, forkSlider);
  }
  // étrier avant (côté gauche)
  const cal = roundedBox(0.035, 0.08, 0.05, 0.01);
  cal.translate(0.075, (isSM ? 0.26 : 0.22) * 0.75, -0.11);
  mesh(cal, Mats.metal(isSM ? '#c41a1a' : '#bfa03a', 0.4, 0.8), forkSlider);
  const frontWheel = buildWheel({
    r: rF, rimInch: spec.rimFront, width: spec.tireWF, tire: cfg.tire, rimStyle: cfg.rimStyle, rimColor: cfg.rimColor,
    disc: { r: isSM || cfg.brakes === 'oversize' ? 0.155 : 0.13, side: 1 }, spokes: 36, hubColor: cfg.hubColor,
  });
  forkSlider.add(frontWheel);

  // --- bras oscillant + roue arrière
  const swingarm = new THREE.Object3D();
  swingarm.position.set(0, pivotY, pivotZ);
  root.add(swingarm);
  const armMat = Mats.metal(spec.cls === 'mx' || spec.cls === 'mini' ? look.swingarmColor : spec.stuntKit ? cfg.frame : look.swingarmColor, 0.3, 0.9);
  const ax = new THREE.Vector3(0, rR - pivotY, -pivotZ);
  for (const sd of [-1, 1]) {
    const x = sd * 0.1;
    mesh(varTube([[x * 0.95, 0, 0], [x, ax.y * 0.5, ax.z * 0.5], [x, ax.y, ax.z + 0.02]], (t) => 0.03 - t * 0.012, 8, 6), armMat, swingarm);
  }
  // chaîne (côté gauche)
  const fs = new THREE.Vector3(0.085, -0.06, 0.06);
  const rs = new THREE.Vector3(0.085, ax.y, ax.z);
  const chainPts: V3[] = [];
  for (let i = 0; i <= 16; i++) {
    const b = (i / 16) * Math.PI;
    chainPts.push([0.085, rs.y + Math.cos(b) * 0.115, rs.z - Math.sin(b) * 0.115]);
  }
  for (let i = 1; i < 10; i++) {
    const b = (i / 10) * Math.PI;
    chainPts.push([0.085, fs.y - Math.cos(b) * 0.05, fs.z + Math.sin(b) * 0.05]);
  }
  mesh(tube(chainPts, 0.006, 60, 4, true), Mats.metal('#3a3530', 0.6, 0.8), swingarm);
  // étrier arrière (droite)
  const calR = roundedBox(0.03, 0.06, 0.05, 0.01);
  calR.translate(-0.075, ax.y + 0.08, ax.z + 0.07);
  mesh(calR, Mats.metal('#bfa03a', 0.4, 0.8), swingarm);
  const rearWheel = buildWheel({
    r: rR, rimInch: spec.rimRear, width: spec.tireWR, tire: cfg.tire, rimStyle: cfg.rimStyle, rimColor: cfg.rimColor,
    disc: { r: 0.11, side: -1 }, sprocket: { r: 0.11, side: 1 }, spokes: 36, hubColor: cfg.hubColor,
  });
  rearWheel.position.copy(ax);
  swingarm.add(rearWheel);
  // amortisseur (mis à jour dynamiquement)
  const shockLow = new THREE.Vector3(0, -0.06, -0.14); // point d'ancrage dans le repère du bras
  const shock = new THREE.Group();
  root.add(shock);
  const spring = new THREE.Mesh(springGeometry(0.045, 1, 9), Mats.metal(spec.cls === 'stunt' ? cfg.accent : '#d23a1a', 0.35, 0.8));
  spring.castShadow = true;
  shock.add(spring);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10).translate(0, 0.5, 0), Mats.metal('#2a2b2e', 0.3, 1));
  shock.add(body);
  const reservoir = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), Mats.metal('#c8a030', 0.3, 1));
  reservoir.position.set(0.04, 0.85, 0);
  shock.add(reservoir);

  // fusion des pièces statiques par matériau
  mergeStatic(chassis);
  mergeStatic(eng);
  mergeStatic(steer);
  mergeStatic(forkSlider);
  for (const w of [frontWheel, rearWheel]) mergeStatic(w);
  mergeStatic(swingarm);

  const swingLen = Math.hypot(ax.y, ax.z);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const sagF = spec.travelF * 0.3, sagR = spec.travelR * 0.3;

  const vis: BikeVisual = {
    root, steer, forkSlider, frontWheel, rearWheel, swingarm, gripL, gripR,
    seat: new THREE.Vector3(0, seatTop + 0.02, Z(0.4)),
    pegL: new THREE.Vector3(0.2, pegY + 0.02, pegZ),
    pegR: new THREE.Vector3(-0.2, pegY + 0.02, pegZ),
    headlight, headlightMat, taillightMat, exhaustTip, isScooter: false,
    update(steerA, compF, compR, rotF, rotR) {
      steer.rotation.y = -steerA;
      forkSlider.position.y = compF - sagF;
      swingarm.rotation.x = Math.asin(Math.max(-0.9, Math.min(0.9, (compR - sagR) / swingLen)));
      frontWheel.rotation.x = rotF;
      rearWheel.rotation.x = rotR;
      // amortisseur entre le cadre et le bras
      tmpA.copy(shockLow).applyEuler(swingarm.rotation).add(swingarm.position);
      tmpB.copy(shockTop);
      const len = tmpA.distanceTo(tmpB);
      shock.position.copy(tmpA);
      shock.quaternion.setFromUnitVectors(up, tmpB.clone().sub(tmpA).normalize());
      spring.scale.set(1, len * 0.75, 1);
      spring.position.y = len * 0.12;
      body.scale.set(1, len, 1);
      reservoir.position.y = len * 0.8;
    },
    dispose() {
      root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
  vis.update(0, sagF, sagR, 0, 0);
  return vis;
}

export function springGeometry(r: number, len: number, turns: number): THREE.BufferGeometry {
  const pts: V3[] = [];
  const n = turns * 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push([Math.cos(a) * r, t * len, Math.sin(a) * r]);
  }
  return tube(pts, 0.006, n, 5);
}

// ------------------------------------------------------------------ scooter
function buildScooter(spec: BikeSpec, cfg: BikeConfig): BikeVisual {
  const root = new THREE.Group();
  root.name = 'scooter';
  const L = spec.wheelbase;
  const rF = spec.rFront, rR = spec.rRear;
  const style = spec.scooterStyle ?? 'sport';
  const primary = cfg.primary;
  const paint = Mats.paint(primary, 0.28);
  const sec = Mats.paint(cfg.secondary, 0.3);
  const dark = Mats.plastic('#18191b', 0.6);
  const decalTex = decalTexture(cfg.decal === 'factory' ? 'split' : cfg.decal, primary, cfg.secondary, cfg.accent, spec.brand, cfg.plateNumber);
  const decalMat = Mats.textured(`sdec:${decalTex.uuid}`, decalTex, { roughness: 0.3, clearcoat: 0.9 });
  const body = new THREE.Group();
  root.add(body);
  const tall = style === 'round' ? 0.03 : style === 'maxi' ? 0.12 : 0;
  const maxi = style === 'maxi';

  // carrosserie arrière (flancs décorés)
  const tailUp = style === 'sport' || style === 'aggressive' ? 0.07 : 0.02;
  const bodyTop = spec.seatHeight - 0.08;
  const rearProf: [number, number][] = [
    P(-0.55, bodyTop - 0.02 + tailUp), P(-0.3, bodyTop + tailUp * 0.4), P(0.05, bodyTop), P(0.42, bodyTop - 0.03), P(0.6, bodyTop - 0.16),
    P(0.6, 0.42), P(0.3, 0.4), P(-0.05, 0.44), P(-0.35, 0.52), P(-0.52, 0.62),
  ];
  mesh(sidePanel(rearProf, 0.3, 0, 0.09, 4, true), [decalMat, paint], body);
  // plancher
  const floor = roundedBox(0.34, 0.06, 0.5, 0.025);
  floor.translate(0, spec.groundClearance + 0.23, 0.8);
  mesh(floor, dark, body);
  // tablier / bouclier avant
  const shieldProf: [number, number][] = [P(0.98, 0.33), P(1.08, 0.36), P(1.18, 0.6), P(1.2, 0.84 + tall), P(1.13, 1.0 + tall), P(1.02, 1.0 + tall), P(1.0, 0.7), P(0.96, 0.45)];
  mesh(sidePanel(shieldProf, 0.36, 0, 0.1, 4, true), [decalMat, paint], body);
  // contre-tablier
  const inner = roundedBox(0.3, 0.42, 0.06, 0.025);
  inner.translate(0, 0.64, 0.98);
  mesh(inner, dark, body);
  // nez + optiques
  let headlightMat: THREE.MeshStandardMaterial | null = Mats.emissive('#fff4dc', 0.25).clone();
  const lightParts: THREE.BufferGeometry[] = [];
  if (style === 'sport') {
    for (const sd of [-1, 1]) {
      const g = new THREE.SphereGeometry(0.045, 16, 10);
      g.scale(1.3, 0.75, 0.6);
      g.translate(sd * 0.09, 0.86, 1.2);
      lightParts.push(g);
    }
  } else if (style === 'aggressive' || maxi) {
    for (const sd of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.1, 0.035, 0.04);
      g.rotateZ(sd * 0.3);
      g.translate(sd * 0.08, 0.84, 1.2);
      lightParts.push(g);
    }
  } else {
    const g = new THREE.SphereGeometry(0.06, 16, 10);
    g.scale(1, 1, 0.6);
    g.translate(0, 1.05 + tall, 1.12);
    lightParts.push(g);
  }
  const hl = new THREE.Mesh(merge(lightParts), headlightMat);
  hl.userData.keep = true;
  body.add(hl);
  const headlight = new THREE.Object3D();
  headlight.position.set(0, 0.88, 1.24 * (L / 1.3));
  root.add(headlight);
  if (maxi) {
    // tunnel central entre les pieds, bulle fumée, flancs de carénage
    const tunnel = roundedBox(0.2, 0.24, 0.62, 0.06);
    tunnel.translate(0, spec.groundClearance + 0.36, 0.72);
    mesh(tunnel, paint, body);
    const screen = new THREE.PlaneGeometry(0.42, 0.34);
    screen.rotateX(-0.55);
    screen.translate(0, 1.18 + tall * 0.6, 1.1);
    mesh(screen, Mats.glass('#1b2836', 0.55), body);
    for (const sd of [-1, 1]) {
      const vent = roundedBox(0.02, 0.06, 0.24, 0.01);
      vent.translate(sd * 0.19, 0.78, 1.04);
      mesh(vent, dark, body);
    }
  }
  // selle
  const seatTex = seatTexture(cfg.seatColor, cfg.seat);
  const seatMat = Mats.textured(`sseat:${seatTex.uuid}`, seatTex, { roughness: 0.7, clearcoat: 0 });
  const seatTop = spec.seatHeight + tailUp * 0.3;
  mesh(sidePanel([P(-0.44, seatTop - 0.02 + tailUp * 0.7), P(-0.15, seatTop + 0.01), P(0.25, seatTop - 0.01), P(0.46, seatTop - 0.04), P(0.48, bodyTop - 0.02), P(0.0, bodyTop - 0.01), P(-0.44, bodyTop + tailUp * 0.5)], 0.27, 0, 0.05, 3, true), seatMat, body);
  // feu arrière + plaque + poignée passager
  const taillightMat = Mats.emissive('#ff2a1a', 1.2).clone();
  const tl = new THREE.BoxGeometry(0.16, 0.04, 0.04);
  tl.translate(0, 0.72 + tailUp, -0.52);
  const tlm = new THREE.Mesh(tl, taillightMat);
  tlm.userData.keep = true;
  body.add(tlm);
  mesh(tube([[0.13, seatTop - 0.06, 0.0], [0.15, seatTop - 0.02 + tailUp * 0.5, -0.3], [0, seatTop + tailUp * 0.5, -0.4], [-0.15, seatTop - 0.02 + tailUp * 0.5, -0.3], [-0.13, seatTop - 0.06, 0.0]], 0.012, 20, 6), Mats.metal('#2a2a2a', 0.4, 0.8), body);
  const lic = new THREE.PlaneGeometry(0.17, 0.09);
  lic.rotateY(Math.PI);
  lic.rotateX(0.25);
  lic.translate(0, 0.52 + tailUp * 0.5, -0.5);
  const licTex = licenseTexture(cfg.plateNumber.padStart(3, '0') + '-SC');
  mesh(lic, Mats.textured(`slic:${licTex.uuid}`, licTex, { roughness: 0.5, clearcoat: 0 }), body);
  // garde-boue arrière (bavette)
  const hug = roundedBox(0.12, 0.03, 0.3, 0.012);
  hug.rotateX(0.5);
  hug.translate(0, rR + 0.08, -0.22);
  mesh(hug, dark, body);

  // --- direction
  const rake = spec.rake * DEG;
  const axle = new THREE.Vector3(0, rF, L);
  const steerPivot = new THREE.Object3D();
  steerPivot.position.copy(axle);
  steerPivot.rotation.x = -rake;
  root.add(steerPivot);
  const steer = new THREE.Object3D();
  steerPivot.add(steer);
  const colH = (1.06 - rF) / Math.cos(rake);
  // cache-guidon
  const cover = roundedBox(0.34, 0.1, 0.16, 0.04);
  cover.translate(0, colH, -0.06);
  mesh(cover, paint, steer);
  const barMat = Mats.metal(cfg.barColor, 0.35, 0.8);
  const barY = colH + 0.03;
  mesh(tube([[-0.34, barY, -0.12], [-0.15, barY, -0.08], [0.15, barY, -0.08], [0.34, barY, -0.12]], 0.011, 12, 8), barMat, steer);
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * 0.24, barY, -0.105], [sd * 0.355, barY, -0.125], 0.018, 0.018, 10), Mats.rubber(), steer);
    // rétroviseurs
    mesh(tube([[sd * 0.18, barY + 0.02, -0.08], [sd * 0.22, barY + 0.11, -0.07], [sd * 0.26, barY + 0.17, -0.04]], 0.006, 6, 5), Mats.metal('#222', 0.4, 0.8), steer);
    const mir = new THREE.SphereGeometry(0.05, 12, 8);
    mir.scale(1.2, 0.8, 0.3);
    mir.translate(sd * 0.27, barY + 0.19, -0.03);
    mesh(mir, dark, steer);
  }
  const gripL = new THREE.Object3D();
  gripL.position.set(0.3, barY, -0.115);
  steer.add(gripL);
  const gripR = new THREE.Object3D();
  gripR.position.set(-0.3, barY, -0.115);
  steer.add(gripR);
  // garde-boue avant
  const ffPts = [new THREE.Vector3(0, rF * 0.55, -0.16), new THREE.Vector3(0, rF + 0.05, 0.0), new THREE.Vector3(0, rF * 0.6, 0.2)];
  const ff = shell(ffPts.map((p) => [p.x, p.y, p.z] as V3), () => 0.065, 0.02, 0.004, 14, 6);
  mesh(ff, paint, steer);
  const forkSlider = new THREE.Object3D();
  steer.add(forkSlider);
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * 0.07, colH * 0.62, -0.02], [sd * 0.07, 0.02, -0.02], 0.02, 0.019, 10), Mats.metal('#2b2c30', 0.3, 0.9), forkSlider);
  }
  const frontWheel = buildWheel({ r: rF, rimInch: spec.rimFront, width: spec.tireWF, tire: cfg.tire, rimStyle: 'cast', rimColor: cfg.rimColor, disc: { r: 0.11, side: 1 }, spokes: 0 });
  forkSlider.add(frontWheel);
  const cal = roundedBox(0.03, 0.07, 0.05, 0.01);
  cal.translate(0.07, 0.07, -0.09);
  mesh(cal, Mats.metal('#c41a1a', 0.4, 0.8), forkSlider);

  // --- bloc moteur oscillant (fait office de bras oscillant)
  // la carrosserie est dessinée pour 1,30 m d'empattement : on l'étire à l'empattement réel
  const sz = L / 1.3;
  body.scale.z = sz;
  if (maxi) body.scale.x = 1.3;
  const pivotZ = 0.48 * sz, pivotY = 0.34;
  const swingarm = new THREE.Object3D();
  swingarm.position.set(0, pivotY, pivotZ);
  root.add(swingarm);
  const ax = new THREE.Vector3(0, rR - pivotY, -pivotZ);
  const cvt = roundedBox(0.09, 0.2, 0.62, 0.05);
  cvt.translate(0.1, ax.y + 0.03, ax.z * 0.5);
  mesh(cvt, Mats.metal('#8d939a', 0.4, 0.8), swingarm);
  const cyl = roundedBox(0.16, 0.14, 0.2, 0.03);
  cyl.rotateX(-1.2);
  cyl.translate(0, -0.03, 0.02);
  mesh(cyl, Mats.engine('#3a3c40'), swingarm);
  // échappement
  const exMat = exhaustMat(cfg);
  const kitted = cfg.exhaust !== 'stock' || spec.cc > 50;
  const pipe: V3[] = [[0, -0.1, 0.06], [-0.06, -0.2, -0.05], [-0.13, -0.18, -0.25], [-0.16, ax.y + 0.05, ax.z + 0.12]];
  mesh(varTube(pipe, (t) => 0.02 + Math.sin(t * Math.PI) * (kitted ? 0.035 : 0.02), 24, 10), Mats.metal('#5d5852', 0.4, 1), swingarm);
  const silStart = new THREE.Vector3(-0.17, ax.y + 0.06, ax.z + 0.14);
  const silEnd = new THREE.Vector3(-0.19, ax.y + 0.2, ax.z - 0.18);
  mesh(cylBetween([silStart.x, silStart.y, silStart.z], [silEnd.x, silEnd.y, silEnd.z], kitted ? 0.042 : 0.05, kitted ? 0.045 : 0.05, 14), kitted ? exMat : Mats.metal('#3c3d40', 0.5, 0.6), swingarm);
  const rearWheel = buildWheel({ r: rR, rimInch: spec.rimRear, width: spec.tireWR, tire: cfg.tire, rimStyle: 'cast', rimColor: cfg.rimColor, spokes: 0 });
  rearWheel.position.copy(ax);
  swingarm.add(rearWheel);
  // amortisseur
  const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8).translate(0, 0.5, 0), Mats.metal('#c42a1a', 0.4, 0.8));
  root.add(shock);
  const shockTop = new THREE.Vector3(-0.1, 0.62, -0.18);
  const shockLow = new THREE.Vector3(-0.1, ax.y + 0.02, ax.z + 0.06);

  mergeStatic(body);
  mergeStatic(steer);
  mergeStatic(forkSlider);
  mergeStatic(frontWheel);
  mergeStatic(rearWheel);
  mergeStatic(swingarm);

  const swingLen = Math.hypot(ax.y, ax.z);
  const sagF = spec.travelF * 0.3, sagR = spec.travelR * 0.3;
  const tmpA = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const exhaustTip = silEnd.clone().add(swingarm.position);
  const vis: BikeVisual = {
    root, steer, forkSlider, frontWheel, rearWheel, swingarm, gripL, gripR,
    seat: new THREE.Vector3(0, seatTop - 0.01, 0.05 * sz),
    pegL: new THREE.Vector3(0.12, spec.groundClearance + 0.26, 0.72 * sz),
    pegR: new THREE.Vector3(-0.12, spec.groundClearance + 0.26, 0.72 * sz),
    headlight, headlightMat, taillightMat, exhaustTip, isScooter: true,
    update(steerA, compF, compR, rotF, rotR) {
      steer.rotation.y = -steerA;
      forkSlider.position.y = compF - sagF;
      swingarm.rotation.x = Math.asin(Math.max(-0.9, Math.min(0.9, (compR - sagR) / swingLen)));
      frontWheel.rotation.x = rotF;
      rearWheel.rotation.x = rotR;
      tmpA.copy(shockLow).applyEuler(swingarm.rotation).add(swingarm.position);
      const len = tmpA.distanceTo(shockTop);
      shock.position.copy(tmpA);
      shock.quaternion.setFromUnitVectors(up, shockTop.clone().sub(tmpA).normalize());
      shock.scale.set(1, len, 1);
    },
    dispose() {
      root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
  void sec;
  vis.update(0, sagF, sagR, 0, 0);
  return vis;
}

export function buildBikeVisual(spec: BikeSpec, cfg: BikeConfig): BikeVisual {
  const v = spec.cls === 'scooter' ? buildScooter(spec, cfg) : spec.cls === 'road' ? buildRoad(spec, cfg) : buildMoto(spec, cfg);
  v.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return v;
}

export { shade };

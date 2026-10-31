// Outils de géométrie procédurale (tubes à rayon variable, panneaux extrudés,
// fusion par matériau) utilisés pour construire motos, pilote et décor.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Tube le long d'une courbe Catmull-Rom avec rayon variable r(t). */
export function varTube(points: V3[], radius: (t: number) => number, segs = 32, radial = 10, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  const frames = curve.computeFrenetFrames(segs, closed);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a), sx = Math.sin(a);
      const nx = cx * N.x + sx * B.x, ny = cx * N.y + sx * B.y, nz = cx * N.z + sx * B.z;
      pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      nor.push(nx, ny, nz);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function tube(points: V3[], r: number, segs = 24, radial = 8, closed = false): THREE.BufferGeometry {
  return varTube(points, () => r, segs, radial, closed);
}

/** Cylindre entre deux points. */
export function cylBetween(a: V3, b: V3, r1: number, r2 = r1, radial = 12): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r2, r1, len, radial, 1, false);
  const dir = B.clone().sub(A).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

/**
 * Panneau latéral : profil 2D (z, y) extrudé selon X, centré en `x`.
 * Les UV des faces latérales sont normalisées (0..1) dans l'emprise du profil et
 * orientées pour que les décors se lisent correctement des deux côtés.
 */
export function sidePanel(profile: [number, number][], thickness: number, x: number, bevel = 0.004, curveSegs = 3, smooth = false): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (smooth) {
    const pts = profile.map(([z, y]) => new THREE.Vector2(z, y));
    const curve = new THREE.SplineCurve([...pts, pts[0]]);
    const sampled = curve.getPoints(profile.length * 6);
    sampled.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  } else {
    profile.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, thickness - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * (smooth ? 0.6 : 1),
    bevelSegments: curveSegs,
    curveSegments: 6,
  });
  // (u=z, v=y, depth=x) → rotation -90° autour de Y : x' = -depth, z' = u
  g.rotateY(-Math.PI / 2);
  g.translate(x + thickness / 2 - bevel, 0, 0);
  remapSideUV(g);
  return g;
}

export function remapSideUV(g: THREE.BufferGeometry): void {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const w = bb.max.z - bb.min.z || 1;
  const h = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i), y = pos.getY(i), nx = nor.getX(i);
    const u = nx >= 0 ? (bb.max.z - z) / w : (z - bb.min.z) / w;
    uv.setXY(i, u, (y - bb.min.y) / h);
  }
  uv.needsUpdate = true;
}

/** Forme 2D arrondie (rectangle à coins arrondis). */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Boîte arrondie (extrusion biseautée), centrée. */
export function roundedBox(w: number, h: number, d: number, r: number, segs = 3): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const shape = roundedRectShape(w - rr * 2, h - rr * 2, Math.max(1e-4, Math.min(rr, (w - rr * 2) / 2, (h - rr * 2) / 2)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - rr * 2, bevelEnabled: true, bevelThickness: rr, bevelSize: rr, bevelSegments: segs, curveSegments: 4 });
  g.translate(0, 0, -(d - rr * 2) / 2);
  return g;
}

/** Normalise une géométrie pour la fusion (non indexée, attributs position/normal/uv). */
export function normalizeGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) {
    const n = out.attributes.position.count;
    out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  out.clearGroups();
  return out;
}

export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = geos.map(normalizeGeo);
  const m = mergeGeometries(list, false);
  if (!m) throw new Error('merge failed');
  return m;
}

/**
 * Fusionne les meshes statiques d'un groupe par matériau (réduit les draw calls).
 * Les enfants qui ont `userData.keep` ou des enfants animés sont conservés.
 */
export function mergeStatic(group: THREE.Object3D): void {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Mesh[] = [];
  group.updateMatrix();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || child.userData.keep || child.children.length) continue;
    const mat = child.material as THREE.Material;
    if (Array.isArray(child.material)) continue;
    child.updateMatrix();
    const g = child.geometry.clone();
    g.applyMatrix4(child.matrix);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(g);
    remove.push(child);
  }
  for (const m of remove) {
    group.remove(m);
    m.geometry.dispose();
  }
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(merge(geos), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    geos.forEach((g) => g.dispose());
  }
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function disposeTree(obj: THREE.Object3D, disposeMaterials = false): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (disposeMaterials && m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => mt.dispose());
    }
  });
}

/**
 * Coque mince balayée le long d'un chemin situé dans le plan YZ (garde-boue).
 * La largeur est portée par l'axe X ; `arch` bombe la section vers le haut.
 */
export function shell(points: V3[], halfWidth: (t: number) => number, arch: number, thick: number, segs = 20, across = 8): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const pos: number[] = [];
  const idx: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3();
  const rowLen = across + 1;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, T);
      N.crossVectors(T, X).normalize();
      if (N.y < 0) N.negate();
      const hw = halfWidth(t);
      for (let j = 0; j <= across; j++) {
        const u = (j / across) * 2 - 1;
        const h = (1 - u * u) * arch - layer * thick;
        pos.push(P.x + u * hw, P.y + N.y * h, P.z + N.z * h);
      }
    }
  }
  const off = (segs + 1) * rowLen;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * rowLen + j, b = a + rowLen;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
      idx.push(off + a, off + b, off + a + 1, off + b, off + b + 1, off + a + 1);
    }
  }
  // bords latéraux
  for (let i = 0; i < segs; i++) {
    for (const j of [0, across]) {
      const a = i * rowLen + j, b = a + rowLen;
      if (j === 0) idx.push(a, b, off + a, b, off + b, off + a);
      else idx.push(a, off + a, b, b, off + a, off + b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv: number[] = [];
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i <= segs; i++) for (let j = 0; j <= across; j++) uv.push(j / across, i / segs);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Applique une rotation Y autour du centre de la géométrie puis la place en x. */
export function yawAroundCenter(g: THREE.BufferGeometry, angle: number, x: number): THREE.BufferGeometry {
  g.computeBoundingBox();
  const c = new THREE.Vector3();
  g.boundingBox!.getCenter(c);
  g.translate(-c.x, 0, -c.z);
  g.rotateY(angle);
  g.translate(x, 0, c.z);
  return g;
}

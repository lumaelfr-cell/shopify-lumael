// Géométries du décor en coordonnées monde (UV en mètres) : quads, boîtes,
// rampes à profil et toits. Partagées par la ville et les bâtiments visitables.

import * as THREE from 'three';
import { merge } from '../vehicle/geom';

export function hQuad(x0: number, z0: number, x1: number, z1: number, y: number, su = 4, sv = 4, uv?: (x: number, z: number) => [number, number]): THREE.BufferGeometry {
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
export function vQuad(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, su: number, sv: number, u0 = 0): THREE.BufferGeometry {
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
export function boxGeo(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, su = 4, sv = 4): THREE.BufferGeometry {
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
export function profileGeo(x: number, z: number, hx: number, yaw: number, y0: number, pts: [number, number][], su = 3): THREE.BufferGeometry {
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

export function prismRoof(x0: number, z0: number, x1: number, z1: number, y: number, h: number, alongX: boolean): THREE.BufferGeometry {
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


// Monde de collision statique : boîtes orientées, cylindres et rampes à profil.
// Fournit (1) la hauteur du sol praticable sous un point et (2) la résolution
// des collisions latérales (murs, bâtiments, obstacles) pour des sphères.

export type Surface = 'asphalt' | 'concrete' | 'dirt' | 'grass' | 'sand' | 'metal' | 'wood' | 'curb';

export const SURFACE_GRIP: Record<Surface, number> = {
  asphalt: 1.0,
  concrete: 0.96,
  curb: 0.9,
  dirt: 0.74,
  grass: 0.6,
  sand: 0.5,
  metal: 0.78,
  wood: 0.88,
};

export const isLoose = (s: Surface): boolean => s === 'dirt' || s === 'grass' || s === 'sand';

export interface Collider {
  id: number;
  kind: 'box' | 'cyl' | 'profile';
  x: number;
  z: number;
  hx: number;
  hz: number;
  cos: number;
  sin: number;
  y0: number;
  y1: number;
  r: number;
  /** profil de hauteur (local z, hauteur au-dessus de y0) pour 'profile' */
  prof?: Float32Array;
  surf: Surface;
  solid: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tag?: string;
  /** collider réservé à une couche ('bike' : bloque seulement les motos, 'foot' : seulement les piétons) */
  layer?: Layer;
  /** ne sert jamais de sol (portes, vitres, personnages) */
  noGround?: boolean;
}

/** Couche de collision interrogée : moto ou piéton. */
export type Layer = 'bike' | 'foot';

export interface GroundHit {
  h: number;
  surf: Surface;
  id: number; // -1 = sol de base
}

export interface BaseGround {
  (x: number, z: number, out: GroundHit): void;
}

export interface WallHit {
  px: number; // vecteur de dégagement cumulé
  pz: number;
  nx: number; // normale du contact le plus profond
  nz: number;
  depth: number;
  hit: boolean;
  tag?: string;
}

const CELL = 24;

export class CollisionWorld {
  colliders: Collider[] = [];
  private grid = new Map<number, number[]>();
  private stamp: Uint32Array = new Uint32Array(0);
  private stampId = 1;
  base: BaseGround = (_x, _z, out) => {
    out.h = 0;
    out.surf = 'asphalt';
    out.id = -1;
  };
  /** Limites du monde (mur invisible). */
  bounds = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };

  private key(ix: number, iz: number): number {
    return (ix + 2048) * 4096 + (iz + 2048);
  }

  addBox(o: { x: number; z: number; hx: number; hz: number; yaw?: number; y0?: number; y1: number; surf?: Surface; solid?: boolean; tag?: string; layer?: Layer; walkable?: boolean }): Collider {
    const yaw = o.yaw ?? 0;
    return this.add({
      kind: 'box', x: o.x, z: o.z, hx: o.hx, hz: o.hz, cos: Math.cos(yaw), sin: Math.sin(yaw),
      y0: o.y0 ?? 0, y1: o.y1, r: 0, surf: o.surf ?? 'concrete', solid: o.solid ?? true, tag: o.tag, layer: o.layer, noGround: o.walkable === false,
    });
  }

  addCylinder(o: { x: number; z: number; r: number; y0?: number; y1: number; surf?: Surface; solid?: boolean; tag?: string; layer?: Layer; walkable?: boolean }): Collider {
    return this.add({
      kind: 'cyl', x: o.x, z: o.z, hx: o.r, hz: o.r, cos: 1, sin: 0, y0: o.y0 ?? 0, y1: o.y1, r: o.r,
      surf: o.surf ?? 'concrete', solid: o.solid ?? true, tag: o.tag, layer: o.layer, noGround: o.walkable === false,
    });
  }

  /**
   * Rampe à profil : `points` = [[zLocal, hauteur], ...] croissants en z.
   * La rampe est orientée par `yaw` : son axe local +z pointe dans la direction de montée.
   */
  addProfile(o: { x: number; z: number; hx: number; yaw?: number; y0?: number; points: [number, number][]; surf?: Surface; tag?: string }): Collider {
    const yaw = o.yaw ?? 0;
    const pts = o.points;
    const prof = new Float32Array(pts.length * 2);
    let maxH = 0;
    pts.forEach(([z, h], i) => {
      prof[i * 2] = z;
      prof[i * 2 + 1] = h;
      maxH = Math.max(maxH, h);
    });
    const z0 = pts[0][0];
    const z1 = pts[pts.length - 1][0];
    const cz = (z0 + z1) / 2;
    // recentrer le profil
    for (let i = 0; i < pts.length; i++) prof[i * 2] -= cz;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // centre monde = position + rotation(0, cz)
    return this.add({
      kind: 'profile', x: o.x + s * cz, z: o.z + c * cz, hx: o.hx, hz: (z1 - z0) / 2, cos: c, sin: s,
      y0: o.y0 ?? 0, y1: (o.y0 ?? 0) + maxH, r: 0, prof, surf: o.surf ?? 'wood', solid: true, tag: o.tag,
    });
  }

  private add(c: Omit<Collider, 'id' | 'minX' | 'maxX' | 'minZ' | 'maxZ'>): Collider {
    const col = c as Collider;
    col.id = this.colliders.length;
    // AABB
    if (col.kind === 'cyl') {
      col.minX = col.x - col.r;
      col.maxX = col.x + col.r;
      col.minZ = col.z - col.r;
      col.maxZ = col.z + col.r;
    } else {
      const ex = Math.abs(col.cos * col.hx) + Math.abs(col.sin * col.hz);
      const ez = Math.abs(col.sin * col.hx) + Math.abs(col.cos * col.hz);
      col.minX = col.x - ex;
      col.maxX = col.x + ex;
      col.minZ = col.z - ez;
      col.maxZ = col.z + ez;
    }
    this.colliders.push(col);
    const ix0 = Math.floor(col.minX / CELL), ix1 = Math.floor(col.maxX / CELL);
    const iz0 = Math.floor(col.minZ / CELL), iz1 = Math.floor(col.maxZ / CELL);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = this.key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(col.id);
      }
    }
    return col;
  }

  /** Transforme un point monde en coordonnées locales du collider. */
  private toLocal(c: Collider, x: number, z: number): [number, number] {
    const dx = x - c.x;
    const dz = z - c.z;
    // rotation inverse : local x = R^-1
    return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
  }

  private profileHeight(c: Collider, lz: number): number {
    const p = c.prof!;
    const n = p.length / 2;
    if (lz <= p[0]) return p[1];
    for (let i = 1; i < n; i++) {
      if (lz <= p[i * 2]) {
        const z0 = p[(i - 1) * 2], h0 = p[(i - 1) * 2 + 1];
        const z1 = p[i * 2], h1 = p[i * 2 + 1];
        return h0 + ((h1 - h0) * (lz - z0)) / (z1 - z0);
      }
    }
    return p[(n - 1) * 2 + 1];
  }

  /** Hauteur du dessus du collider en (x,z), ou NaN si hors emprise. */
  topAt(c: Collider, x: number, z: number): number {
    if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) return NaN;
    if (c.kind === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      return dx * dx + dz * dz <= c.r * c.r ? c.y1 : NaN;
    }
    const [lx, lz] = this.toLocal(c, x, z);
    if (lx < -c.hx || lx > c.hx || lz < -c.hz || lz > c.hz) return NaN;
    if (c.kind === 'box') return c.y1;
    return c.y0 + this.profileHeight(c, lz);
  }

  /** Sol praticable le plus haut sous `yMax` en (x,z). */
  groundAt(x: number, z: number, yMax: number, out: GroundHit, layer: Layer = 'bike'): GroundHit {
    this.base(x, z, out);
    if (out.h > yMax) {
      // sol de base au-dessus (ne devrait pas arriver) : on le garde quand même
    }
    const arr = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (arr) {
      for (let i = 0; i < arr.length; i++) {
        const c = this.colliders[arr[i]];
        if (c.noGround || (c.layer && c.layer !== layer)) continue;
        const top = this.topAt(c, x, z);
        if (top === top && top <= yMax && top > out.h) {
          out.h = top;
          out.surf = c.surf;
          out.id = c.id;
        }
      }
    }
    return out;
  }

  /**
   * Résout une sphère verticale (capsule simplifiée) contre les colliders solides.
   * `yFeet` = bas de la capsule, `yHead` = haut. Tout obstacle dont le dessus dépasse
   * `yFeet + step` est considéré comme un mur.
   */
  collideCapsule(x: number, z: number, yFeet: number, yHead: number, r: number, step: number, out: WallHit, layer: Layer = 'bike'): WallHit {
    out.px = 0;
    out.pz = 0;
    out.nx = 0;
    out.nz = 0;
    out.depth = 0;
    out.hit = false;
    out.tag = undefined;
    if (this.stamp.length < this.colliders.length) this.stamp = new Uint32Array(this.colliders.length + 256);
    const sid = ++this.stampId;
    const ix0 = Math.floor((x - r) / CELL), ix1 = Math.floor((x + r) / CELL);
    const iz0 = Math.floor((z - r) / CELL), iz1 = Math.floor((z + r) / CELL);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const arr = this.grid.get(this.key(ix, iz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const id = arr[i];
          if (this.stamp[id] === sid) continue;
          this.stamp[id] = sid;
          const c = this.colliders[id];
          if (!c.solid) continue;
          if (c.layer && c.layer !== layer) continue;
          if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
          if (c.y0 >= yHead) continue;
          let nx = 0, nz = 0, depth = 0;
          if (c.kind === 'cyl') {
            if (c.y1 <= yFeet + step) continue;
            const dx = x - c.x, dz = z - c.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            const pen = c.r + r - d;
            if (pen <= 0) continue;
            nx = d > 1e-5 ? dx / d : 1;
            nz = d > 1e-5 ? dz / d : 0;
            depth = pen;
          } else {
            const [lx, lz] = this.toLocal(c, x, z);
            const cx = Math.max(-c.hx, Math.min(c.hx, lx));
            const cz = Math.max(-c.hz, Math.min(c.hz, lz));
            const top = c.kind === 'box' ? c.y1 : c.y0 + this.profileHeight(c, cz);
            if (top <= yFeet + step) continue;
            const dx = lx - cx, dz = lz - cz;
            const d2 = dx * dx + dz * dz;
            let lnx = 0, lnz = 0;
            if (d2 > 1e-10) {
              const d = Math.sqrt(d2);
              if (d >= r) continue;
              lnx = dx / d;
              lnz = dz / d;
              depth = r - d;
            } else {
              // centre à l'intérieur : sortir par la face la plus proche
              const ex = c.hx - Math.abs(lx);
              const ez = c.hz - Math.abs(lz);
              if (ex < ez) {
                lnx = Math.sign(lx) || 1;
                depth = ex + r;
              } else {
                lnz = Math.sign(lz) || 1;
                depth = ez + r;
              }
            }
            // retour en monde : rotation directe
            nx = lnx * c.cos + lnz * c.sin;
            nz = -lnx * c.sin + lnz * c.cos;
          }
          out.px += nx * depth;
          out.pz += nz * depth;
          if (depth > out.depth) {
            out.depth = depth;
            out.nx = nx;
            out.nz = nz;
            out.tag = c.tag;
          }
          out.hit = true;
        }
      }
    }
    // limites du monde
    const b = this.bounds;
    if (x - r < b.minX) { out.px += b.minX - (x - r); out.nx = 1; out.nz = 0; out.hit = true; out.depth = Math.max(out.depth, b.minX - (x - r)); }
    if (x + r > b.maxX) { out.px -= x + r - b.maxX; out.nx = -1; out.nz = 0; out.hit = true; out.depth = Math.max(out.depth, x + r - b.maxX); }
    if (z - r < b.minZ) { out.pz += b.minZ - (z - r); out.nx = 0; out.nz = 1; out.hit = true; out.depth = Math.max(out.depth, b.minZ - (z - r)); }
    if (z + r > b.maxZ) { out.pz -= z + r - b.maxZ; out.nx = 0; out.nz = -1; out.hit = true; out.depth = Math.max(out.depth, z + r - b.maxZ); }
    return out;
  }

  /**
   * Lancer de rayon segmenté (pour la caméra) : renvoie la fraction [0..1] du
   * premier obstacle solide rencontré entre a et b.
   */
  raycast(ax: number, ay: number, az: number, bx: number, by: number, bz: number, step = 0.8): number {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const n = Math.max(2, Math.ceil(len / step));
    const g: GroundHit = { h: 0, surf: 'asphalt', id: -1 };
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
      const arr = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (arr) {
        for (let k = 0; k < arr.length; k++) {
          const c = this.colliders[arr[k]];
          if (!c.solid || c.y1 < 0.6 || c.layer) continue;
          const top = this.topAt(c, x, z);
          if (top === top && y < top && y > c.y0) return Math.max(0, (i - 1) / n);
        }
      }
      this.base(x, z, g);
      if (y < g.h + 0.2) return Math.max(0, (i - 1) / n);
    }
    return 1;
  }
}

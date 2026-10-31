// Plan de la ville : grille de rues, quartiers, lieux remarquables.
// Partagé par la génération du décor, le trafic, les piétons et la minicarte.

export const GRID_N = 12; // blocs par côté
export const BLOCK = 90; // m entre axes de rues
export const ORIGIN = -540; // coordonnée de la première rue
export const SIDEWALK = 4;
export const CURB = 0.15;
export const CENTER_ISLAND_R = 7;

export const lineCoord = (i: number): number => ORIGIN + i * BLOCK;

export function roadWidth(i: number): number {
  if (i === 0 || i === GRID_N) return 24; // périphérique
  if (i === 6) return 22; // grands boulevards
  return 14;
}

/** Décalage(s) latéral(aux) des voies de circulation par rapport à l'axe. */
export function laneOffsets(i: number): number[] {
  const w = roadWidth(i);
  if (w >= 24) return [3.2, 7.0];
  if (w >= 22) return [3.0, 6.6];
  return [2.1];
}

export type District = 'downtown' | 'commercial' | 'residential' | 'cite' | 'industrial' | 'park' | 'plaza' | 'stunt' | 'training' | 'parking' | 'garage' | 'mall';

export function blockDistrict(bx: number, bz: number): District {
  const key = `${bx},${bz}`;
  const special: Record<string, District> = {
    '5,5': 'plaza',
    '6,5': 'park',
    '3,6': 'parking',
    '5,6': 'garage',
    '5,10': 'stunt',
    '6,10': 'training',
    '8,4': 'mall',
    '2,9': 'park',
    '9,7': 'mall',
  };
  if (special[key]) return special[key];
  if (bx >= 9) return 'industrial';
  if (bx >= 4 && bx <= 7 && bz >= 4 && bz <= 7) return 'downtown';
  if (bx <= 2 && bz >= 4 && bz <= 8) return 'cite';
  if ((bx <= 3 && bz <= 3) || (bz >= 9 && bx <= 4)) return 'residential';
  return 'commercial';
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Emprise d'un bloc (bord de trottoir compris, c.-à-d. jusqu'à la chaussée). */
export function blockRect(bx: number, bz: number): Rect {
  return {
    x0: lineCoord(bx) + roadWidth(bx) / 2,
    x1: lineCoord(bx + 1) - roadWidth(bx + 1) / 2,
    z0: lineCoord(bz) + roadWidth(bz) / 2,
    z1: lineCoord(bz + 1) - roadWidth(bz + 1) / 2,
  };
}

/** Intérieur constructible (sans trottoir). */
export function blockInterior(bx: number, bz: number): Rect {
  const r = blockRect(bx, bz);
  return { x0: r.x0 + SIDEWALK, x1: r.x1 - SIDEWALK, z0: r.z0 + SIDEWALK, z1: r.z1 - SIDEWALK };
}

export interface Spot {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  desc: string;
}

// Zones hors grille
export const CORNICHE = { x: 0, z0: -552, z1: -1430, width: 16 };
export const MX_ZONE: Rect = { x0: -230, z0: 590, x1: 230, z1: 880 };
export const UNDERGROUND = { pit: { x0: -74, z0: -74, x1: -20, z1: -20 } as Rect, floor: -4.5, ramp: { x0: -74, x1: -66, zTop: -20, zBottom: -50 } };
export const PARKING_STRUCT = { x0: -255, z0: 22, x1: -205, z1: 72, levels: [CURB, 3.65, 7.15, 10.65], lane: 7 };
export const WORLD_BOUNDS = { minX: -900, maxX: 900, minZ: -1490, maxZ: 900 };

export const SPOTS: Spot[] = [
  { id: 'garage', name: 'Garage Bike Life', x: -60, z: 6.6, yaw: Math.PI / 2, desc: 'Ton garage sur le grand boulevard.' },
  { id: 'boulevard', name: 'Grand Boulevard', x: -515, z: 3, yaw: Math.PI / 2, desc: 'Ligne droite de 500 m pour les wheelings.' },
  { id: 'corniche', name: 'Route de la Corniche', x: 4, z: -575, yaw: Math.PI, desc: 'Presque 1 km de ligne droite hors de la ville.' },
  { id: 'stunt', name: 'Stunt Park', x: -47, z: 445, yaw: Math.PI, desc: 'Kickers, funbox, spine et grand saut.' },
  { id: 'training', name: "Zone d'entraînement", x: 45, z: 445, yaw: Math.PI, desc: 'Cercles, slalom et lignes de distance.' },
  { id: 'mx', name: 'MX Park', x: -190, z: 625, yaw: Math.PI / 2, desc: 'Piste de terre : tables, doubles et whoops.' },
  { id: 'parking', name: 'Parking à étages', x: -231, z: 6, yaw: 0, desc: 'Quatre niveaux, toit panoramique.' },
  { id: 'underground', name: 'Parking souterrain', x: -70, z: -12.5, yaw: Math.PI, desc: 'Sous la grande place du centre.' },
  { id: 'industrial', name: 'Zone industrielle', x: 330, z: -177.9, yaw: Math.PI / 2, desc: 'Entrepôts, quais et conteneurs.' },
  { id: 'cite', name: 'La Cité', x: -362.1, z: 50, yaw: 0, desc: 'Les barres d’immeubles et leurs parkings.' },
  { id: 'downtown', name: 'Centre-ville', x: 45, z: 3, yaw: Math.PI / 2, desc: 'Gratte-ciel et grandes avenues.' },
];

export const spotById = (id: string): Spot => SPOTS.find((s) => s.id === id) ?? SPOTS[0];

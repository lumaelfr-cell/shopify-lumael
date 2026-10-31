// Catalogue des véhicules. Toutes les marques et tous les modèles sont FICTIFS :
// ils s'inspirent des catégories demandées (MX 2T/4T, supermotards, scooters…)
// sans utiliser de marque déposée ni de logo officiel.

export type BikeClass = 'mx' | 'mini' | 'sm' | 'stunt' | 'scooter';
export type TireType = 'knobby' | 'enduro' | 'street' | 'slick';
export type SoundKind = '2t-mx' | '2t-small' | '4t-mx' | '4t-big' | 'scooter-2t' | 'scooter-4t';

export interface BikeColors {
  primary: string;
  secondary: string;
  accent: string;
  frame: string;
  rim: string;
  seat: string;
}

export interface BikeSpec {
  id: string;
  brand: string;
  model: string;
  cls: BikeClass;
  cc: number;
  stroke: 2 | 4;
  price: number;
  level: number;
  desc: string;
  sound: SoundKind;
  // --- Moteur / transmission
  peakTorque: number; // Nm (vilebrequin)
  torqueCurve: [number, number][]; // [tr/min, fraction du couple max]
  idleRpm: number;
  redline: number;
  limiter: number;
  gears: number[] | null; // rapports globaux (boîte x primaire x secondaire). null = CVT
  cvt?: { low: number; high: number; holdRpm: number; engageRpm: number };
  engineInertia: number; // inertie équivalente (kg.m²)
  engineBrake: number; // frein moteur (Nm au régime max)
  // --- Châssis
  mass: number; // kg moto seule
  wheelbase: number;
  rFront: number; // rayon roue + pneu (m)
  rRear: number;
  rimFront: number; // pouces
  rimRear: number;
  comX: number; // centre de gravité (moto+pilote) depuis l'axe arrière
  comY: number; // hauteur du CG
  pitchInertia: number; // kg.m²
  travelF: number;
  travelR: number;
  freqF: number; // Hz
  freqR: number;
  rake: number; // degrés
  maxSteer: number; // degrés
  brakeF: number; // capacité de freinage (g)
  brakeR: number;
  cda: number;
  tire: TireType;
  seatHeight: number;
  colors: BikeColors;
  /** variante esthétique (forme des plastiques) */
  shape: number;
  /** paramètres spécifiques scooter */
  scooterStyle?: 'sport' | 'round' | 'aggressive' | 'classic';
  stuntKit?: boolean;
}

const TQ_2T_125: [number, number][] = [[1500, 0.22], [4000, 0.38], [7000, 0.6], [9000, 0.86], [10500, 1.0], [11800, 0.9], [12800, 0.72], [13600, 0.55]];
const TQ_2T_250: [number, number][] = [[1200, 0.35], [3500, 0.6], [5800, 0.86], [7600, 1.0], [8800, 0.88], [9800, 0.7], [10400, 0.55]];
const TQ_2T_50: [number, number][] = [[1500, 0.2], [4500, 0.38], [7200, 0.72], [9300, 1.0], [10800, 0.86], [11800, 0.62], [12400, 0.5]];
const TQ_2T_85: [number, number][] = [[1500, 0.22], [5000, 0.45], [8500, 0.8], [10800, 1.0], [12000, 0.88], [13000, 0.66], [13600, 0.5]];
const TQ_4T_250: [number, number][] = [[1500, 0.52], [4500, 0.72], [7500, 0.88], [10200, 1.0], [12200, 0.93], [13700, 0.8], [14200, 0.7]];
const TQ_4T_450: [number, number][] = [[1200, 0.6], [3200, 0.82], [5200, 0.95], [7000, 1.0], [8700, 0.92], [10200, 0.8], [11200, 0.68]];
const TQ_4T_BIG: [number, number][] = [[1200, 0.6], [3200, 0.85], [5200, 1.0], [6800, 0.95], [8000, 0.82], [8800, 0.7]];
const TQ_4T_125: [number, number][] = [[1500, 0.5], [4500, 0.75], [7500, 0.95], [8800, 1.0], [9800, 0.9], [10800, 0.75]];
const TQ_SCOOT_2T: [number, number][] = [[1500, 0.35], [4000, 0.62], [6300, 0.95], [7400, 1.0], [8600, 0.86], [9600, 0.62], [10200, 0.5]];
const TQ_SCOOT_4T: [number, number][] = [[1500, 0.55], [4000, 0.8], [6200, 1.0], [7600, 0.92], [8800, 0.75], [9400, 0.65]];

type Partial2<T> = { [K in keyof T]?: T[K] };

const BRANDS: Record<string, BikeColors> = {
  Aozora: { primary: '#1f4fd1', secondary: '#f2f4f8', accent: '#0b1a3a', frame: '#b9c2cc', rim: '#1f4fd1', seat: '#16244a' },
  Midori: { primary: '#5fd01e', secondary: '#111316', accent: '#f4f4f4', frame: '#2d6b12', rim: '#1a1a1a', seat: '#111316' },
  Hinode: { primary: '#e1121b', secondary: '#f4f4f4', accent: '#111111', frame: '#c4c9cf', rim: '#151515', seat: '#141414' },
  Kronos: { primary: '#ff6a00', secondary: '#f6f6f6', accent: '#1b2a55', frame: '#ff6a00', rim: '#181818', seat: '#1a1a1a' },
  Nordvik: { primary: '#eef2f6', secondary: '#13235b', accent: '#ffd51a', frame: '#1d3b8f', rim: '#151515', seat: '#13235b' },
  Fiammo: { primary: '#f4f4f2', secondary: '#d01c2a', accent: '#ffcc00', frame: '#d01c2a', rim: '#1a1a1a', seat: '#1b1b1b' },
  Kiiro: { primary: '#ffd400', secondary: '#1a3c9e', accent: '#111111', frame: '#c4c9cf', rim: '#c9a227', seat: '#1a3c9e' },
  Brava: { primary: '#d4121f', secondary: '#111111', accent: '#f4f4f4', frame: '#d4121f', rim: '#151515', seat: '#111111' },
  Velox: { primary: '#121212', secondary: '#e01a22', accent: '#d8d8d8', frame: '#1a1a1a', rim: '#e01a22', seat: '#121212' },
  Pegaso: { primary: '#f0f0ee', secondary: '#9aa3ad', accent: '#2a7de1', frame: '#333333', rim: '#c6ccd2', seat: '#202020' },
  Lionne: { primary: '#141414', secondary: '#ffcf00', accent: '#e8e8e8', frame: '#1a1a1a', rim: '#ffcf00', seat: '#141414' },
  Gilardi: { primary: '#c8101e', secondary: '#f2f2f2', accent: '#151515', frame: '#202020', rim: '#d9d9d9', seat: '#151515' },
  Sina: { primary: '#b9c0c8', secondary: '#4b525a', accent: '#1d1d1d', frame: '#2b2b2b', rim: '#8d949b', seat: '#1d1d1d' },
  Custom: { primary: '#1a1a1a', secondary: '#39ff6a', accent: '#ff2bd6', frame: '#111111', rim: '#39ff6a', seat: '#111111' },
};

function mx(o: Partial2<BikeSpec> & { id: string; brand: string; model: string; cc: number; stroke: 2 | 4 }): BikeSpec {
  const c = BRANDS[o.brand] ?? BRANDS.Custom;
  let base: Partial2<BikeSpec>;
  if (o.stroke === 2 && o.cc <= 50) {
    base = { peakTorque: 6.2, torqueCurve: TQ_2T_50, idleRpm: 1700, redline: 11800, limiter: 12300, gears: [41, 30, 24, 20.2, 18, 16.8], mass: 86, sound: '2t-small', engineInertia: 0.0026, engineBrake: 1.2, price: 2200, level: 1 };
  } else if (o.stroke === 2 && o.cc <= 85) {
    base = { peakTorque: 14, torqueCurve: TQ_2T_85, idleRpm: 1700, redline: 13000, limiter: 13500, gears: [33, 25, 20.5, 17.2, 15.2, 13.9], mass: 72, sound: '2t-small', engineInertia: 0.003, engineBrake: 2, price: 4200, level: 1 };
  } else if (o.stroke === 2 && o.cc <= 150) {
    base = { peakTorque: 25, torqueCurve: TQ_2T_125, idleRpm: 1600, redline: 12800, limiter: 13300, gears: [32, 24, 19.5, 16.5, 14.8, 13.5], mass: 88, sound: '2t-mx', engineInertia: 0.0045, engineBrake: 3, price: 6800, level: 1 };
  } else if (o.stroke === 2) {
    base = { peakTorque: 46, torqueCurve: TQ_2T_250, idleRpm: 1400, redline: 9800, limiter: 10300, gears: [23, 17.6, 14.2, 11.6, 9.5], mass: 98, sound: '2t-mx', engineInertia: 0.0075, engineBrake: 5, price: 9800, level: 3 };
  } else if (o.cc <= 300) {
    base = { peakTorque: 29, torqueCurve: TQ_4T_250, idleRpm: 1900, redline: 13700, limiter: 14200, gears: [33.5, 25, 20, 16.5, 13.9], mass: 104, sound: '4t-mx', engineInertia: 0.005, engineBrake: 8, price: 9200, level: 3 };
  } else {
    base = { peakTorque: 50, torqueCurve: TQ_4T_450, idleRpm: 1700, redline: 11000, limiter: 11400, gears: [23, 17.5, 14.2, 11.8, 9.9], mass: 110, sound: '4t-mx', engineInertia: 0.009, engineBrake: 13, price: 13200, level: 5 };
  }
  const mini = o.cc <= 85 && o.stroke === 2 && o.cc > 50;
  const wb = mini ? 1.28 : 1.48;
  const spec: BikeSpec = {
    cls: mini ? 'mini' : 'mx',
    desc: '',
    wheelbase: wb,
    rFront: mini ? 0.31 : 0.355,
    rRear: mini ? 0.29 : 0.335,
    rimFront: mini ? 19 : 21,
    rimRear: mini ? 16 : 19,
    comX: wb * 0.45,
    comY: mini ? 0.74 : 0.8,
    pitchInertia: mini ? 30 : 37,
    travelF: mini ? 0.27 : 0.3,
    travelR: mini ? 0.28 : 0.31,
    freqF: 1.8,
    freqR: 2.0,
    rake: 27,
    maxSteer: 38,
    brakeF: 1.0,
    brakeR: 0.55,
    cda: 0.62,
    tire: 'knobby',
    seatHeight: mini ? 0.86 : 0.96,
    colors: { ...c },
    shape: 0,
    ...(base as Partial<BikeSpec>),
    ...(o as Partial<BikeSpec>),
  } as BikeSpec;
  return spec;
}

function sm(o: Partial2<BikeSpec> & { id: string; brand: string; model: string; cc: number; stroke: 2 | 4 }): BikeSpec {
  const c = BRANDS[o.brand] ?? BRANDS.Custom;
  let base: Partial2<BikeSpec>;
  if (o.cc <= 50) {
    base = { peakTorque: 6.4, torqueCurve: TQ_2T_50, idleRpm: 1700, redline: 11800, limiter: 12300, gears: [38, 28, 22.5, 19, 17, 15.8], mass: 92, sound: '2t-small', engineInertia: 0.0026, engineBrake: 1.2, price: 2600, level: 1, stroke: 2 };
  } else if (o.cc <= 150) {
    base = { peakTorque: 11.5, torqueCurve: TQ_4T_125, idleRpm: 1700, redline: 10500, limiter: 10900, gears: [36, 26, 20.5, 17, 14.8, 13.2], mass: 118, sound: '4t-mx', engineInertia: 0.004, engineBrake: 4, price: 7200, level: 2 };
  } else if (o.cc <= 500) {
    base = { peakTorque: 47, torqueCurve: TQ_4T_450, idleRpm: 1700, redline: 10800, limiter: 11200, gears: [21, 15.6, 12.6, 10.6, 9.2, 8.3], mass: 118, sound: '4t-mx', engineInertia: 0.009, engineBrake: 12, price: 14500, level: 6 };
  } else {
    base = { peakTorque: 74, torqueCurve: TQ_4T_BIG, idleRpm: 1500, redline: 8600, limiter: 9000, gears: [15.5, 11.2, 9.0, 7.6, 6.6, 5.8], mass: 150, sound: '4t-big', engineInertia: 0.014, engineBrake: 20, price: 19500, level: 7 };
  }
  const spec: BikeSpec = {
    cls: 'sm',
    desc: '',
    wheelbase: 1.48,
    rFront: 0.3,
    rRear: 0.315,
    rimFront: 17,
    rimRear: 17,
    comX: 1.48 * 0.47,
    comY: 0.77,
    pitchInertia: 46,
    travelF: 0.25,
    travelR: 0.26,
    freqF: 2.2,
    freqR: 2.4,
    rake: 26,
    maxSteer: 34,
    brakeF: 1.2,
    brakeR: 0.6,
    cda: 0.58,
    tire: 'street',
    seatHeight: 0.9,
    colors: { ...c },
    shape: 1,
    ...(base as Partial<BikeSpec>),
    ...(o as Partial<BikeSpec>),
  } as BikeSpec;
  return spec;
}

function scooter(o: Partial2<BikeSpec> & { id: string; brand: string; model: string; cc: number; stroke: 2 | 4 }): BikeSpec {
  const c = BRANDS[o.brand] ?? BRANDS.Custom;
  const big = o.cc > 100;
  const spec: BikeSpec = {
    cls: 'scooter',
    desc: '',
    peakTorque: big ? 11.5 : o.cc > 50 ? 9.5 : 7.2,
    torqueCurve: o.stroke === 2 ? TQ_SCOOT_2T : TQ_SCOOT_4T,
    idleRpm: 1800,
    redline: o.stroke === 2 ? 9600 : 9200,
    limiter: o.stroke === 2 ? 10100 : 9600,
    gears: null,
    cvt: big ? { low: 19, high: 6.2, holdRpm: 7000, engageRpm: 3300 } : { low: 26, high: 8.2, holdRpm: 7500, engageRpm: 3800 },
    engineInertia: 0.003,
    engineBrake: 1.5,
    sound: o.stroke === 2 ? 'scooter-2t' : 'scooter-4t',
    price: 2400,
    level: 1,
    mass: big ? 132 : 96,
    wheelbase: 1.3,
    rFront: 0.26,
    rRear: 0.26,
    rimFront: 13,
    rimRear: 13,
    comX: 1.3 * 0.33,
    comY: 0.66,
    pitchInertia: 28,
    travelF: 0.085,
    travelR: 0.085,
    freqF: 2.8,
    freqR: 3.0,
    rake: 26,
    maxSteer: 40,
    brakeF: 0.85,
    brakeR: 0.55,
    cda: 0.55,
    tire: 'street',
    seatHeight: 0.8,
    colors: { ...c },
    shape: 2,
    scooterStyle: 'sport',
    ...(o as Partial<BikeSpec>),
  } as BikeSpec;
  return spec;
}

export const BIKES: BikeSpec[] = [
  // ---------------- Motocross 2 temps / 4 temps
  mx({ id: 'aoz-az125', brand: 'Aozora', model: 'AZ 125', cc: 125, stroke: 2, price: 0, desc: '2 temps 125 nerveux et léger. Le roi du wheeling embrayage.' }),
  mx({ id: 'aoz-az250', brand: 'Aozora', model: 'AZ 250', cc: 250, stroke: 2, desc: '2T 250 brutal, coup de pied explosif à mi-régime.' }),
  mx({ id: 'aoz-az250f', brand: 'Aozora', model: 'AZ 250F', cc: 250, stroke: 4, desc: '4T 250 qui prend des tours, très facile à doser.' }),
  mx({ id: 'aoz-az450f', brand: 'Aozora', model: 'AZ 450F', cc: 450, stroke: 4, desc: 'Gros mono 450 : la roue avant monte toute seule.' }),
  mx({ id: 'mid-kr85', brand: 'Midori', model: 'KR 85', cc: 85, stroke: 2, desc: 'Petite 85 survoltée, idéale pour apprendre.' }),
  mx({ id: 'mid-kr125', brand: 'Midori', model: 'KR 125', cc: 125, stroke: 2, desc: 'Le 125 vert, rageur dans les tours.', shape: 1 }),
  mx({ id: 'mid-kr250f', brand: 'Midori', model: 'KR 250F', cc: 250, stroke: 4, desc: '4T 250 au moteur rond et coupleux.', shape: 1 }),
  mx({ id: 'hin-hr125', brand: 'Hinode', model: 'HR 125', cc: 125, stroke: 2, desc: 'Le 125 rouge légendaire, châssis alu.', shape: 2 }),
  mx({ id: 'hin-hr250', brand: 'Hinode', model: 'HR 250', cc: 250, stroke: 2, desc: 'Un 2T 250 culte, sauvage et léger.', shape: 2 }),
  mx({ id: 'hin-hrf450r', brand: 'Hinode', model: 'HRF 450R', cc: 450, stroke: 4, desc: '450 de compétition, puissance énorme et stabilité.', shape: 2 }),
  mx({ id: 'kro-125xs', brand: 'Kronos', model: '125 XS', cc: 125, stroke: 2, desc: '125 orange, préparation usine prête à la course.', shape: 3 }),
  mx({ id: 'kro-250xsf', brand: 'Kronos', model: '250 XS-F', cc: 250, stroke: 4, desc: '250 4T qui hurle jusqu’à 14 000 tr/min.', shape: 3 }),
  mx({ id: 'kro-450xsf', brand: 'Kronos', model: '450 XS-F', cc: 450, stroke: 4, desc: 'Le 450 orange, ultra-efficace en sortie de virage.', shape: 3 }),
  mx({ id: 'nor-nc125', brand: 'Nordvik', model: 'NC 125', cc: 125, stroke: 2, desc: '2T 125 suédois au cadre bleu.', shape: 3 }),
  mx({ id: 'nor-nf450', brand: 'Nordvik', model: 'NF 450', cc: 450, stroke: 4, desc: '450 4T premium, suspension réglée au millimètre.', shape: 3 }),
  mx({ id: 'fia-fx50', brand: 'Fiammo', model: 'FX 50', cc: 50, stroke: 2, desc: 'Mécaboîte 50 débridée : embrayage, coup de rein, wheeling !', shape: 1 }),
  mx({ id: 'fia-fx125', brand: 'Fiammo', model: 'FX 125', cc: 125, stroke: 2, desc: '125 italien moderne, très vif.', shape: 1 }),
  mx({ id: 'fia-fx250', brand: 'Fiammo', model: 'FX 250', cc: 250, stroke: 2, desc: '2T 250 italien à injection.', shape: 1 }),
  mx({ id: 'fia-fxf250', brand: 'Fiammo', model: 'FXF 250', cc: 250, stroke: 4, desc: '4T 250 italien, moteur pointu.', shape: 1 }),
  mx({ id: 'kii-kz250', brand: 'Kiiro', model: 'KZ 250', cc: 250, stroke: 4, desc: '4T 250 jaune, châssis précis.', shape: 0 }),
  mx({ id: 'kii-kz450', brand: 'Kiiro', model: 'KZ 450', cc: 450, stroke: 4, desc: '450 jaune très stable à haute vitesse.', shape: 0 }),
  mx({ id: 'bra-bc125', brand: 'Brava', model: 'BC 125', cc: 125, stroke: 2, desc: '125 2T espagnol, rouge vif.', shape: 2 }),
  mx({ id: 'bra-bc450f', brand: 'Brava', model: 'BC 450F', cc: 450, stroke: 4, desc: '450 4T espagnol, couple de tracteur.', shape: 2 }),
  mx({ id: 'bra-bx50', brand: 'Brava', model: 'BX 50', cc: 50, stroke: 2, desc: 'Enduro 50 de quartier, le classique du bike life.', shape: 2, tire: 'enduro', price: 1900 }),

  // ---------------- Supermotards
  sm({ id: 'kro-690smr', brand: 'Kronos', model: '690 SMR', cc: 690, stroke: 4, desc: 'Gros mono 690 : wheeling en 3e, freinages d’anthologie.', shape: 3 }),
  sm({ id: 'nor-701sm', brand: 'Nordvik', model: '701 SM', cc: 690, stroke: 4, desc: 'Supermotard premium blanc et bleu.', shape: 3, price: 20500 }),
  sm({ id: 'aoz-ws450sm', brand: 'Aozora', model: 'WS 450 SM', cc: 450, stroke: 4, desc: 'Enduro 450 passé en roues 17 pouces.', shape: 0 }),
  sm({ id: 'hin-hrf450sm', brand: 'Hinode', model: 'HRF 450 SM', cc: 450, stroke: 4, desc: 'Cross 450 transformé en arme de ville.', shape: 2 }),
  sm({ id: 'fia-xsm125', brand: 'Fiammo', model: 'XSM 125', cc: 125, stroke: 4, desc: 'Supermotard 125 4T, parfait pour débuter en ville.', shape: 1 }),
  sm({ id: 'bra-smx50', brand: 'Brava', model: 'SMX 50', cc: 50, stroke: 2, desc: 'Le 50 supermot’ préparé, roi des cités.', shape: 2 }),

  // ---------------- Motos de stunt préparées
  sm({ id: 'cus-125w', brand: 'Custom', model: 'Wheelie 125 2T', cc: 125, stroke: 2, peakTorque: 26, torqueCurve: TQ_2T_125, redline: 12800, limiter: 13300, idleRpm: 1600, gears: [30, 22.5, 18.2, 15.4, 13.6], mass: 98, sound: '2t-mx', engineBrake: 3, engineInertia: 0.0045, cls: 'stunt', stuntKit: true, price: 12500, level: 4, desc: 'Base 2T 125 en roues 17", barre de 12h, pignon court.', colors: { ...BRANDS.Custom }, travelF: 0.22, travelR: 0.24, freqF: 2.4, freqR: 2.6, brakeR: 0.7, maxSteer: 45, tire: 'slick' }),
  sm({ id: 'cus-450st', brand: 'Custom', model: 'Stunt 450R', cc: 450, stroke: 4, cls: 'stunt', stuntKit: true, price: 22000, level: 8, gears: [19, 14, 11.4, 9.6, 8.4], desc: 'Cross 450 de stunt : cage, barre de 12h, frein arrière au guidon.', colors: { primary: '#101010', secondary: '#ff2bd6', accent: '#39ff6a', frame: '#0c0c0c', rim: '#ff2bd6', seat: '#101010' }, travelF: 0.22, travelR: 0.24, freqF: 2.4, freqR: 2.6, brakeR: 0.75, maxSteer: 45, tire: 'slick' }),
  sm({ id: 'cus-690st', brand: 'Custom', model: 'Stunt 690', cc: 690, stroke: 4, cls: 'stunt', stuntKit: true, price: 31000, level: 10, gears: [17.5, 12.8, 10.3, 8.6, 7.4], desc: 'La bête : 690 préparé stunt, 12h et cercles sans fin.', colors: { primary: '#1a1a1a', secondary: '#ff6a00', accent: '#ffffff', frame: '#ff6a00', rim: '#ff6a00', seat: '#111111' }, travelF: 0.22, travelR: 0.24, freqF: 2.4, freqR: 2.6, brakeR: 0.75, maxSteer: 45, tire: 'slick', shape: 3 }),

  // ---------------- Scooters & cyclos
  scooter({ id: 'sin-orbiter50', brand: 'Sina', model: 'Orbiter 50', cc: 50, stroke: 4, price: 0, scooterStyle: 'classic', desc: 'Le scoot’ de tous les jours. Lent mais increvable.', peakTorque: 5.2, cvt: { low: 25, high: 8.6, holdRpm: 7000, engageRpm: 3500 } }),
  scooter({ id: 'aoz-aerix50', brand: 'Aozora', model: 'Aerix 50', cc: 50, stroke: 2, price: 2900, scooterStyle: 'sport', desc: 'Scooter sportif 2T, double optique, débridé.' }),
  scooter({ id: 'vel-nitrox50', brand: 'Velox', model: 'Nitrox 50', cc: 50, stroke: 2, price: 2700, scooterStyle: 'aggressive', desc: 'Look agressif, moteur 2T qui crie.' }),
  scooter({ id: 'peg-zap50', brand: 'Pegaso', model: 'Zap 50', cc: 50, stroke: 2, price: 1800, scooterStyle: 'round', desc: 'Petit scoot’ rond et léger, parfait pour les ruelles.', mass: 86 }),
  scooter({ id: 'lio-speedstrike50', brand: 'Lionne', model: 'Speedstrike 50', cc: 50, stroke: 2, price: 3100, scooterStyle: 'sport', desc: 'Sportif à double optique, châssis rigide.' }),
  scooter({ id: 'gil-sprinter50', brand: 'Gilardi', model: 'Sprinter 50', cc: 50, stroke: 2, price: 3000, scooterStyle: 'aggressive', desc: 'Le sprinter rouge, grosses roues et tenue de route.' }),
  scooter({ id: 'gil-sprinter125', brand: 'Gilardi', model: 'Sprinter 125', cc: 125, stroke: 4, price: 4800, level: 3, scooterStyle: 'aggressive', desc: '125 4T : 100 km/h et du couple pour lever.' }),
  scooter({ id: 'aoz-aerix70', brand: 'Aozora', model: 'Aerix 70 Kit', cc: 70, stroke: 2, price: 5600, level: 2, scooterStyle: 'sport', desc: 'Kit 70 cm³, pot de détente, variateur : la préparation ultime.', colors: { primary: '#0d0d0d', secondary: '#1f4fd1', accent: '#39ff6a', frame: '#0d0d0d', rim: '#39ff6a', seat: '#0d0d0d' } }),
];

export const BIKE_BY_ID: Record<string, BikeSpec> = Object.fromEntries(BIKES.map((b) => [b.id, b]));

export const CLASS_LABEL: Record<BikeClass, string> = {
  mx: 'Motocross',
  mini: 'Mini-cross',
  sm: 'Supermotard',
  stunt: 'Stunt',
  scooter: 'Scooter',
};

export function bikeName(b: BikeSpec): string {
  return `${b.brand} ${b.model}`;
}

/** Puissance max approximative (ch) calculée à partir de la courbe de couple. */
export function estimateHp(b: BikeSpec, torqueMult = 1): number {
  let best = 0;
  for (let rpm = 1000; rpm <= b.redline; rpm += 100) {
    let frac = 0;
    const pts = b.torqueCurve;
    if (rpm <= pts[0][0]) frac = pts[0][1];
    else {
      frac = pts[pts.length - 1][1];
      for (let i = 1; i < pts.length; i++) {
        if (rpm <= pts[i][0]) {
          const t = (rpm - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
          frac = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
          break;
        }
      }
    }
    const p = (b.peakTorque * torqueMult * frac * rpm * Math.PI * 2) / 60;
    if (p > best) best = p;
  }
  return best / 735.5;
}

export const STARTER_BIKES = ['aoz-az125', 'sin-orbiter50'];

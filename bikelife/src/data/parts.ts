// Pièces de personnalisation : chaque option a un prix, une compatibilité
// et des effets (visuels via BikeModel, physiques via `tuningFromConfig`).

import type { BikeClass, BikeSpec, TireType } from './bikes';
import { lookFor } from './modelStyles';

export type ExhaustType = 'stock' | 'sport' | 'titanium' | 'carbon';
export type BarsType = 'low' | 'mx' | 'high' | 'stunt';
export type SeatType = 'standard' | 'gripper' | 'flat' | 'stitched';
export type FenderType = 'stock' | 'short' | 'high';
export type SuspType = 'stock' | 'sport' | 'stunt' | 'lowered';
export type RimStyle = 'spoke' | 'cast' | 'deep';
export type PlasticsKit = 'stock' | 'race' | 'retro' | 'stunt';

export interface BikeConfig {
  primary: string;
  secondary: string;
  accent: string;
  frame: string;
  plastics: PlasticsKit;
  decal: string;
  rimColor: string;
  rimStyle: RimStyle;
  tire: TireType;
  bars: BarsType;
  barColor: string;
  seat: SeatType;
  seatColor: string;
  exhaust: ExhaustType;
  fender: FenderType;
  plateNumber: string;
  plateColor: string;
  suspension: SuspType;
  engineStage: number; // 0..3
  gearing: number; // -2 (court) .. +2 (long)
  brakes: 'stock' | 'oversize';
  stuntBar: boolean;
  cage: boolean;
  /** année-modèle (certaines années changent la géométrie : échappement…) */
  year?: string;
  /** garde-boue arrière */
  fenderColor?: string;
  /** moyeux */
  hubColor?: string;
  /** poignées */
  gripColor?: string;
}

export interface PartOption<T extends string | number | boolean> {
  value: T;
  name: string;
  price: number;
  classes?: BikeClass[];
  desc?: string;
}

export const DECALS: PartOption<string>[] = [
  { value: 'factory', name: 'Usine', price: 0 },
  { value: 'stripes', name: 'Bandes racing', price: 400 },
  { value: 'split', name: 'Bicolore', price: 350 },
  { value: 'camo', name: 'Camouflage urbain', price: 700 },
  { value: 'flames', name: 'Flammes', price: 800 },
  { value: 'chevron', name: 'Chevrons', price: 500 },
  { value: 'digital', name: 'Pixel / Digital', price: 900 },
  { value: 'bikelife', name: 'Bike Life Tag', price: 1200 },
  { value: 'none', name: 'Uni (sans déco)', price: 0 },
];

export const PART_SLOTS = {
  plastics: [
    { value: 'stock', name: 'Origine', price: 0 },
    { value: 'race', name: 'Kit Race (écopes larges)', price: 600, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'retro', name: 'Kit Rétro 90s', price: 750, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'stunt', name: 'Kit Street / Stunt', price: 900, classes: ['mx', 'mini', 'sm', 'stunt'] },
  ] as PartOption<PlasticsKit>[],
  rimStyle: [
    { value: 'spoke', name: 'Rayons', price: 0, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'deep', name: 'Jantes larges rayons', price: 900, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'cast', name: 'Jantes bâtons alu', price: 1100 },
  ] as PartOption<RimStyle>[],
  tire: [
    { value: 'knobby', name: 'Crampons MX', price: 0, desc: 'Grip max sur terre, glisse sur bitume.' },
    { value: 'enduro', name: 'Mixte enduro', price: 250, desc: 'Compromis terre / route.' },
    { value: 'street', name: 'Route', price: 300, desc: 'Bon grip bitume, médiocre sur terre.' },
    { value: 'slick', name: 'Slicks stunt', price: 600, desc: 'Accroche maximale sur béton sec.' },
  ] as PartOption<TireType>[],
  bars: [
    { value: 'mx', name: 'Cintre MX', price: 0, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'low', name: 'Cintre bas', price: 150, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'high', name: 'Cintre haut', price: 200, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'stunt', name: 'Cintre stunt + frein au guidon', price: 450, classes: ['mx', 'mini', 'sm', 'stunt'] },
  ] as PartOption<BarsType>[],
  seat: [
    { value: 'standard', name: 'Origine', price: 0 },
    { value: 'gripper', name: 'Gripper anti-glisse', price: 200 },
    { value: 'flat', name: 'Selle plate stunt', price: 250 },
    { value: 'stitched', name: 'Selle surpiquée', price: 300 },
  ] as PartOption<SeatType>[],
  exhaust: [
    { value: 'stock', name: 'Origine', price: 0 },
    { value: 'sport', name: 'Pot sport (+4%)', price: 900 },
    { value: 'titanium', name: 'Ligne titane (+7%)', price: 1800 },
    { value: 'carbon', name: 'Silencieux carbone (+6%, léger)', price: 1600 },
  ] as PartOption<ExhaustType>[],
  fender: [
    { value: 'stock', name: 'Origine', price: 0 },
    { value: 'short', name: 'Garde-boue court', price: 150, classes: ['mx', 'mini', 'sm', 'stunt'] },
    { value: 'high', name: 'Garde-boue haut', price: 150, classes: ['mx', 'mini', 'sm', 'stunt'] },
  ] as PartOption<FenderType>[],
  suspension: [
    { value: 'stock', name: 'Origine', price: 0 },
    { value: 'sport', name: 'Sport (plus ferme)', price: 1200 },
    { value: 'stunt', name: 'Stunt (ferme, centrée wheeling)', price: 1500 },
    { value: 'lowered', name: 'Rabaissée (−4 cm)', price: 800 },
  ] as PartOption<SuspType>[],
  engineStage: [
    { value: 0, name: 'Origine', price: 0 },
    { value: 1, name: 'Stage 1 (+8%)', price: 1200 },
    { value: 2, name: 'Stage 2 (+16%)', price: 2800 },
    { value: 3, name: 'Stage 3 (+25%)', price: 5200 },
  ] as PartOption<number>[],
  gearing: [
    { value: -2, name: 'Très court (wheeling)', price: 300 },
    { value: -1, name: 'Court', price: 200 },
    { value: 0, name: 'Origine', price: 0 },
    { value: 1, name: 'Long', price: 200 },
    { value: 2, name: 'Très long (vitesse)', price: 300 },
  ] as PartOption<number>[],
  brakes: [
    { value: 'stock', name: 'Origine', price: 0 },
    { value: 'oversize', name: 'Disque surdimensionné', price: 700 },
  ] as PartOption<'stock' | 'oversize'>[],
  stuntBar: [
    { value: false, name: 'Sans', price: 0 },
    { value: true, name: 'Barre de 12h', price: 900, classes: ['mx', 'mini', 'sm', 'stunt'] },
  ] as PartOption<boolean>[],
  cage: [
    { value: false, name: 'Sans', price: 0 },
    { value: true, name: 'Crash cage', price: 700, classes: ['mx', 'mini', 'sm', 'stunt'] },
  ] as PartOption<boolean>[],
};

export type PartSlot = keyof typeof PART_SLOTS;

export const SLOT_LABEL: Record<PartSlot | 'decal', string> = {
  plastics: 'Plastiques / habillage',
  rimStyle: 'Jantes',
  tire: 'Pneus',
  bars: 'Guidon',
  seat: 'Selle',
  exhaust: 'Échappement',
  fender: 'Garde-boue',
  suspension: 'Suspensions',
  engineStage: 'Moteur',
  gearing: 'Démultiplication',
  brakes: 'Freins',
  stuntBar: 'Barre de 12h',
  cage: 'Crash cage',
  decal: 'Kit déco',
};

export const PALETTE = [
  '#f4f4f4', '#cfd4da', '#8d949b', '#3a3f45', '#151515', '#e1121b', '#c8101e', '#ff6a00', '#ffb400', '#ffd400',
  '#c6ff1a', '#5fd01e', '#13a35b', '#00c2b8', '#22b8ff', '#1f4fd1', '#13235b', '#6a2bd9', '#b02bd9', '#ff2bd6',
  '#ff6b9a', '#8a5a2b', '#c9a227', '#39ff6a',
];

export function defaultConfig(spec: BikeSpec): BikeConfig {
  const c = spec.colors;
  const isStreet = spec.cls === 'sm' || spec.cls === 'stunt' || spec.cls === 'scooter' || spec.cls === 'road';
  return {
    primary: c.primary,
    secondary: c.secondary,
    accent: c.accent,
    frame: c.frame,
    plastics: spec.cls === 'stunt' ? 'stunt' : 'stock',
    decal: 'factory',
    rimColor: c.rim,
    rimStyle: spec.cls === 'scooter' || spec.cls === 'road' ? 'cast' : 'spoke',
    tire: spec.tire,
    bars: spec.cls === 'stunt' ? 'stunt' : 'mx',
    barColor: spec.cls === 'scooter' ? '#1a1a1a' : '#2b2b2b',
    seat: spec.cls === 'stunt' ? 'flat' : 'standard',
    seatColor: c.seat,
    exhaust: 'stock',
    fender: 'stock',
    plateNumber: String(10 + (Math.abs(hash(spec.id)) % 890)),
    plateColor: isStreet && spec.cls !== 'sm' ? '#f4f4f4' : lookFor(spec.id).sidePlate,
    suspension: spec.cls === 'stunt' ? 'stunt' : 'stock',
    engineStage: 0,
    gearing: 0,
    brakes: 'stock',
    stuntBar: !!spec.stuntKit,
    cage: !!spec.stuntKit,
    year: lookFor(spec.id).years[0].year,
    fenderColor: spec.cls === 'scooter' || spec.cls === 'road' || spec.stuntKit ? c.primary : lookFor(spec.id).rearFender,
    hubColor: '#b8bcc2',
    gripColor: '#1a1a1a',
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Modificateurs physiques résultant de la configuration. */
export interface Tuning {
  torqueMult: number;
  gearMult: number; // multiplie les rapports (>1 = plus court)
  massDelta: number;
  suspStiffness: number;
  suspTravelMult: number;
  rideHeight: number; // m
  brakeMult: number;
  hasStuntBar: boolean;
  tire: TireType;
  soundLoud: number; // 0..1
  rearHandBrake: boolean;
}

export function tuningFromConfig(spec: BikeSpec, cfg: BikeConfig): Tuning {
  const exhaustGain = { stock: 1, sport: 1.04, titanium: 1.07, carbon: 1.06 }[cfg.exhaust];
  const stageGain = [1, 1.08, 1.16, 1.25][cfg.engineStage] ?? 1;
  const susp = {
    stock: { k: 1, t: 1, h: 0 },
    sport: { k: 1.2, t: 1, h: 0 },
    stunt: { k: 1.35, t: 0.9, h: -0.01 },
    lowered: { k: 1.1, t: 0.85, h: -0.04 },
  }[cfg.suspension];
  return {
    torqueMult: exhaustGain * stageGain,
    gearMult: 1 - cfg.gearing * 0.06,
    massDelta: (cfg.exhaust === 'carbon' ? -1.5 : cfg.exhaust === 'titanium' ? -1 : 0) + (cfg.cage ? 3 : 0) + (cfg.stuntBar ? 2.5 : 0),
    suspStiffness: susp.k,
    suspTravelMult: susp.t,
    rideHeight: susp.h,
    brakeMult: cfg.brakes === 'oversize' ? 1.15 : 1,
    hasStuntBar: cfg.stuntBar,
    tire: cfg.tire,
    soundLoud: { stock: 0.25, sport: 0.55, titanium: 0.8, carbon: 0.7 }[cfg.exhaust],
    rearHandBrake: cfg.bars === 'stunt',
  };
}

export function partCompatible(opt: PartOption<any>, cls: BikeClass): boolean {
  return !opt.classes || opt.classes.includes(cls);
}

export const partKey = (slot: string, value: unknown): string => `${slot}:${String(value)}`;

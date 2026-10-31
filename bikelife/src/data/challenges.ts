// Défis et contre-la-montre placés dans la ville.

import type { BikeClass } from './bikes';
import { spotById } from '../world/layout';

export type Metric = 'wheelieDist' | 'wheelieTime' | 'stoppieDist' | 'jumpDist' | 'airTime' | 'topSpeed' | 'driftTime' | 'comboPoints' | 'nearMiss' | 'checkpoints' | 'highWheelie' | 'airTricks';

export interface Gate {
  x: number;
  y: number;
  z: number;
  r: number;
}

export interface ChallengeDef {
  id: string;
  name: string;
  desc: string;
  start: { x: number; z: number; yaw: number; y?: number };
  metric: Metric;
  thresholds: [number, number, number];
  unit: string;
  timeLimit: number;
  rewards: [number, number, number];
  classes?: BikeClass[];
  gates?: Gate[];
}

const s = (id: string) => {
  const p = spotById(id);
  return { x: p.x, z: p.z, yaw: p.yaw };
};

const g = (x: number, z: number, y = 0.15, r = 7): Gate => ({ x, y, z, r });

export const CHALLENGES: ChallengeDef[] = [
  { id: 'first-wheelie', name: 'Premier wheeling', desc: 'Lève la roue avant et tiens le plus loin possible.', start: s('garage'), metric: 'wheelieDist', thresholds: [20, 50, 100], unit: 'm', timeLimit: 90, rewards: [300, 600, 1000] },
  { id: 'boulevard', name: 'Le Boulevard', desc: 'Le plus long wheeling sur le Grand Boulevard.', start: s('boulevard'), metric: 'wheelieDist', thresholds: [150, 300, 480], unit: 'm', timeLimit: 120, rewards: [800, 1600, 3000] },
  { id: 'wheelie-time', name: 'Chrono roue arrière', desc: 'Tiens ton wheeling le plus longtemps possible sur la corniche.', start: s('corniche'), metric: 'wheelieTime', thresholds: [8, 16, 30], unit: 's', timeLimit: 150, rewards: [700, 1400, 2800] },
  { id: 'stoppie', name: 'Stoppie de quartier', desc: 'Freine fort, bascule l’avant et tiens le stoppie.', start: s('downtown'), metric: 'stoppieDist', thresholds: [4, 10, 18], unit: 'm', timeLimit: 90, rewards: [600, 1200, 2200] },
  { id: 'big-jump', name: 'Le Grand Saut', desc: 'Prends le gros kicker du stunt park et vole le plus loin possible.', start: s('stunt'), metric: 'jumpDist', thresholds: [14, 20, 26], unit: 'm', timeLimit: 120, rewards: [700, 1400, 2600] },
  { id: 'mx-air', name: 'Envol MX', desc: 'Le plus long temps de vol au MX Park.', start: s('mx'), metric: 'airTime', thresholds: [1.2, 1.8, 2.5], unit: 's', timeLimit: 150, rewards: [700, 1400, 2600] },
  { id: 'top-speed', name: 'Pleine balle', desc: 'Atteins la vitesse la plus élevée sur la corniche.', start: s('corniche'), metric: 'topSpeed', thresholds: [90, 120, 150], unit: 'km/h', timeLimit: 60, rewards: [500, 1000, 2000] },
  { id: 'drift', name: 'Drift industriel', desc: 'Cumule un maximum de dérapages dans la zone industrielle.', start: s('industrial'), metric: 'driftTime', thresholds: [3, 8, 15], unit: 's', timeLimit: 75, rewards: [600, 1200, 2400] },
  { id: 'combo-street', name: 'Combo de rue', desc: 'Enchaîne les figures pour le plus gros combo.', start: s('downtown'), metric: 'comboPoints', thresholds: [3000, 8000, 16000], unit: 'pts', timeLimit: 90, rewards: [800, 1600, 3200] },
  { id: 'freestyle', name: 'Freestyle', desc: 'Réussis des figures aériennes (bouton figure en l’air).', start: s('stunt'), metric: 'airTricks', thresholds: [2, 4, 7], unit: 'figures', timeLimit: 120, rewards: [800, 1600, 3000] },
  { id: 'twelve', name: 'Midi pile', desc: 'Tiens ton wheeling au-dessus de 60° (12h).', start: s('training'), metric: 'highWheelie', thresholds: [1.5, 4, 8], unit: 's', timeLimit: 120, rewards: [900, 1800, 3500] },
  { id: 'near-miss', name: 'Entre les files', desc: 'Frôle les voitures à pleine vitesse sans les toucher.', start: s('boulevard'), metric: 'nearMiss', thresholds: [3, 6, 10], unit: '', timeLimit: 90, rewards: [700, 1400, 2800] },
  { id: 'scooter-king', name: 'Roi du scooter', desc: 'Wheeling en scooter dans la cité.', start: s('cite'), metric: 'wheelieDist', thresholds: [40, 100, 200], unit: 'm', timeLimit: 120, rewards: [700, 1500, 3000], classes: ['scooter'] },
  {
    id: 'slalom', name: 'Slalom urbain', desc: 'Passe toutes les portes le plus vite possible.', start: { x: 45, z: 3, yaw: Math.PI / 2 }, metric: 'checkpoints', thresholds: [42, 34, 28], unit: 's', timeLimit: 70, rewards: [700, 1400, 2800],
    gates: [g(150, 3), g(267.9, 60), g(267.9, 150), g(180, 267.9), g(90, 267.9), g(3, 200), g(3, 120)],
  },
  {
    id: 'parking-roof', name: 'Sur le toit', desc: 'Monte au toit du parking à étages au plus vite.', start: s('parking'), metric: 'checkpoints', thresholds: [40, 28, 20], unit: 's', timeLimit: 70, rewards: [700, 1400, 2800],
    gates: [g(-208.5, 50, 2.5, 6), g(-251.5, 36, 6.45, 6), g(-208.5, 50, 9.5, 6), g(-230, 66, 10.65, 7)],
  },
  {
    id: 'underground', name: 'Sous la place', desc: 'Descends au parking souterrain et fais le tour.', start: s('underground'), metric: 'checkpoints', thresholds: [32, 24, 18], unit: 's', timeLimit: 60, rewards: [600, 1200, 2400],
    gates: [g(-70, -40, -3, 6), g(-56, -66, -4.5, 7), g(-28, -66, -4.5, 7), g(-28, -28, -4.5, 7), g(-70, -58, -4.5, 7), g(-70, -40, -3, 6), g(-70, -14, 0.15, 6)],
  },
];

export interface TimeTrialDef {
  id: string;
  name: string;
  desc: string;
  start: { x: number; z: number; yaw: number };
  gates: Gate[];
  medals: [number, number, number];
  rewards: [number, number, number];
}

export const TIME_TRIALS: TimeTrialDef[] = [
  {
    id: 'tt-city', name: 'Tour du centre', desc: 'Boucle de 1 km dans le centre-ville.', start: { x: 45, z: 3, yaw: Math.PI / 2 },
    gates: [g(150, 3), g(267.9, 130), g(130, 267.9), g(3, 130), g(45, 3)], medals: [75, 60, 50], rewards: [800, 1600, 3000],
  },
  {
    id: 'tt-mx', name: 'Tour du MX Park', desc: 'Un tour de la piste de terre, sauts compris.', start: { x: -190, z: 625, yaw: Math.PI / 2 },
    gates: [g(-100, 625, 0, 8), g(0, 625, 0, 8), g(100, 625, 0, 8), g(200, 700, 0, 12), g(150, 780, 0, 8), g(40, 780, 0, 8), g(-60, 780, 0, 9), g(-180, 700, 0, 12), g(-185, 625, 0, 10)],
    medals: [70, 55, 45], rewards: [900, 1800, 3500],
  },
  {
    id: 'tt-drag', name: 'Drag de la corniche', desc: '800 m en ligne droite, départ arrêté.', start: { x: 4, z: -575, yaw: Math.PI },
    gates: [g(4, -975), g(4, -1375)], medals: [36, 30, 26], rewards: [600, 1200, 2400],
  },
];

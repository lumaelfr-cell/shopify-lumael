// Identité visuelle de chaque modèle, d'après le véhicule réel de référence :
// type et couleur du cadre (aluminium double poutre des japonaises, acier
// chrome-molybdène peint des européennes), cheminement d'échappement (culasse
// inversée façon YZ-F, double silencieux des CRF450R 2017-2020), forme des
// écopes et de la plaque avant, optique des supermotards / enduros et
// déco d'usine en aplats de couleurs (aucun logo officiel reproduit).

export type FrameKind = 'alu' | 'steel';
export type ShroudKind = 'rounded' | 'angular' | 'swept' | 'blocky';
export type PlateKind = 'rounded' | 'angular' | 'shield';
export type Exhaust4T = 'front' | 'reversed' | 'dual';
export type LampKind = 'pointed' | 'round' | 'enduro' | 'none';
export type Graphic = 'blue-wave' | 'green-slash' | 'red-block' | 'orange-cut' | 'white-blue' | 'yellow-blue' | 'red-white' | 'fantic' | 'blue-white' | 'red-beta' | 'pit' | 'street';

export interface MotoLook {
  frame: FrameKind;
  /** couleur du cadre d'origine */
  frameColor: string;
  /** couleur de la boucle arrière (cadre arrière composite / alu) ; défaut = cadre */
  subframeColor?: string;
  swingarmColor: string;
  forkOuter: string;
  stanchion: 'gold' | 'chrome' | 'black';
  shroud: ShroudKind;
  plate: PlateKind;
  exhaust4t: Exhaust4T;
  intakeVents: boolean;
  lamp: LampKind;
  graphic: Graphic;
  sidePlate: string;
  rearFender: string;
  /** années disponibles (la première est celle des cotes) ; certaines changent la géométrie */
  years: { year: string; exhaust4t?: Exhaust4T; note?: string }[];
}

const SILVER = '#bfc6ce';
const base = (o: Partial<MotoLook>): MotoLook => ({
  frame: 'alu', frameColor: SILVER, swingarmColor: SILVER, forkOuter: '#1d1f24', stanchion: 'chrome', shroud: 'rounded', plate: 'rounded',
  exhaust4t: 'front', intakeVents: false, lamp: 'none', graphic: 'street', sidePlate: '#f4f4f4', rearFender: '#f4f4f4', years: [{ year: '2024' }], ...o,
});

// familles
const YZ = base({ shroud: 'rounded', plate: 'rounded', graphic: 'blue-wave', stanchion: 'gold', rearFender: '#f4f4f4', sidePlate: '#f4f4f4' });
const YZF = { ...YZ, exhaust4t: 'reversed' as Exhaust4T, intakeVents: true };
const KX = base({ shroud: 'angular', plate: 'angular', graphic: 'green-slash', stanchion: 'gold', rearFender: '#111316', sidePlate: '#111316', frameColor: '#2b2d31' });
const CR = base({ shroud: 'swept', plate: 'rounded', graphic: 'red-block', stanchion: 'gold', rearFender: '#e1121b', sidePlate: '#f4f4f4' });
const SX = base({ frame: 'steel', frameColor: '#ff6a00', subframeColor: '#2b2e33', shroud: 'angular', plate: 'angular', graphic: 'orange-cut', forkOuter: '#2b2e33', stanchion: 'chrome', rearFender: '#ff6a00', sidePlate: '#f6f6f6' });
const HQ = base({ frame: 'steel', frameColor: '#1d3b8f', subframeColor: '#2b2e33', shroud: 'blocky', plate: 'shield', graphic: 'white-blue', forkOuter: '#2b2e33', stanchion: 'chrome', rearFender: '#eef2f6', sidePlate: '#eef2f6' });
const RMZ = base({ shroud: 'swept', plate: 'rounded', graphic: 'yellow-blue', stanchion: 'gold', rearFender: '#ffd400', sidePlate: '#ffd400' });
const MC = base({ frame: 'steel', frameColor: '#d4121f', subframeColor: '#2b2e33', shroud: 'angular', plate: 'angular', graphic: 'red-white', forkOuter: '#2b2e33', rearFender: '#d4121f', sidePlate: '#d4121f' });
const FX = base({ shroud: 'angular', plate: 'angular', graphic: 'fantic', rearFender: '#f4f4f2', sidePlate: '#f4f4f2' });

export const LOOKS: Record<string, MotoLook> = {
  'aoz-az125': YZ,
  'aoz-az250': YZ,
  'aoz-az250f': YZF,
  'aoz-az450f': YZF,
  'aoz-ws450sm': { ...YZF, lamp: 'enduro', graphic: 'blue-wave' },
  'mid-kr85': KX,
  'mid-kr125': { ...KX, years: [{ year: '2008' }] },
  'mid-kr250f': KX,
  'hin-hr125': { ...CR, years: [{ year: '2007' }] },
  'hin-hr250': { ...CR, years: [{ year: '2007' }] },
  'hin-hrf450r': { ...CR, years: [{ year: '2024', exhaust4t: 'front' }, { year: '2019', exhaust4t: 'dual', note: 'double silencieux (2017-2020)' }] },
  'hin-hrf450sm': { ...CR, lamp: 'enduro', years: [{ year: '2024', exhaust4t: 'front' }, { year: '2019', exhaust4t: 'dual', note: 'double silencieux (2017-2020)' }] },
  'kro-125xs': SX,
  'kro-250xsf': SX,
  'kro-450xsf': SX,
  'kro-690smr': { ...SX, lamp: 'pointed', graphic: 'orange-cut', years: [{ year: '2023' }] },
  'nor-nc125': HQ,
  'nor-nf450': HQ,
  'nor-701sm': { ...HQ, lamp: 'round' },
  'fia-fx50': { ...FX, lamp: 'enduro' },
  'fia-fx125': FX,
  'fia-fx250': FX,
  'fia-fxf250': FX,
  'fia-xsm125': { ...FX, lamp: 'pointed' },
  'kii-kz250': RMZ,
  'kii-kz450': RMZ,
  'bra-bc125': MC,
  'bra-bc450f': MC,
  'bra-bx50': { ...MC, frame: 'steel', lamp: 'enduro', graphic: 'red-white', years: [{ year: '2019' }] },
  'bra-smx50': { ...MC, frame: 'steel', lamp: 'enduro', graphic: 'red-white', years: [{ year: '2019' }] },
  'cob-se300': base({ frame: 'steel', frameColor: '#1d4fb8', subframeColor: '#2b2e33', shroud: 'angular', plate: 'angular', graphic: 'blue-white', lamp: 'enduro', forkOuter: '#2b2e33', rearFender: '#f4f4f4', sidePlate: '#f4f4f4' }),
  'ver-rr300': base({ frame: 'steel', frameColor: '#2b2d31', subframeColor: '#c8101e', shroud: 'swept', plate: 'rounded', graphic: 'red-beta', lamp: 'enduro', forkOuter: '#2b2e33', rearFender: '#f4f4f4', sidePlate: '#f4f4f4' }),
  'pit-p125': base({ frame: 'steel', frameColor: '#151515', shroud: 'angular', plate: 'angular', graphic: 'pit', forkOuter: '#151515', stanchion: 'gold', rearFender: '#ff6a00', sidePlate: '#151515' }),
  'ray-mrt50': base({ frame: 'steel', frameColor: '#c8101e', shroud: 'angular', plate: 'angular', graphic: 'red-white', lamp: 'enduro', rearFender: '#f4f4f4', sidePlate: '#f4f4f4', years: [{ year: '2021' }] }),
  'cus-125w': { ...YZ, graphic: 'street', frameColor: '#111111', swingarmColor: '#111111' },
  'cus-450st': { ...CR, graphic: 'street', frameColor: '#0c0c0c', swingarmColor: '#0c0c0c' },
  'cus-690st': { ...SX, graphic: 'street', lamp: 'pointed' },
};

export function lookFor(id: string): MotoLook {
  return LOOKS[id] ?? base({});
}

/** Variante d'échappement 4T selon l'année choisie. */
export function exhaustFor(id: string, year?: string): Exhaust4T {
  const l = lookFor(id);
  const y = l.years.find((v) => v.year === year) ?? l.years[0];
  return y.exhaust4t ?? l.exhaust4t;
}

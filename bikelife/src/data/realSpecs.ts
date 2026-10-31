// Dimensions réelles des modèles de référence (fiches constructeur / bases de
// données spécialisées). Les noms affichés en jeu restent fictifs ; ce tableau
// fixe uniquement les cotes physiques reprises des vraies machines.
//
// Sources principales : yamahamotorsports.com, kawasaki.com, hondanews.com,
// ktm.com, 1000ps.com, motorcycle.com, dirtrider.com, motorcycledb.com,
// motorradundreisen.de, 50factory.com, fantic.com. Quand les sources divergent,
// la valeur retenue est la plus fréquente ; les valeurs non trouvées sont
// estimées à partir de machines identiques et listées dans `estimated`.

export type WeightBasis = 'sec' | 'sans carburant' | 'ordre de marche';

export interface RealSpec {
  /** modèle réel dont les dimensions sont reprises */
  ref: string;
  wheelbase: number; // mm
  seat: number; // mm
  ground: number; // mm (garde au sol)
  weight: number; // kg
  basis: WeightBasis;
  fuel: number; // litres
  tireF: string; // ex. "80/100-21"
  tireR: string;
  travelF?: number; // mm
  travelR?: number; // mm
  rake?: number; // degrés
  length?: number; // mm
  /** champs estimés faute de donnée publiée */
  estimated?: string[];
  /** préparation (moto de stunt, passage en roues de 17") */
  note?: string;
}

export const REAL_SPECS: Record<string, RealSpec> = {
  // ------------------------------------------------ motocross
  'aoz-az125': { ref: 'Yamaha YZ125 (2024)', wheelbase: 1445, seat: 980, ground: 366, weight: 95, basis: 'ordre de marche', fuel: 7.9, tireF: '80/100-21', tireR: '100/90-19', travelF: 300, travelR: 315, rake: 26.3, length: 2140 },
  'aoz-az250': { ref: 'Yamaha YZ250 (2024)', wheelbase: 1486, seat: 975, ground: 361, weight: 103, basis: 'ordre de marche', fuel: 7.9, tireF: '80/100-21', tireR: '110/90-19', travelF: 300, travelR: 315, rake: 26.7, length: 2175 },
  'aoz-az250f': { ref: 'Yamaha YZ250F (2024)', wheelbase: 1475, seat: 970, ground: 351, weight: 106, basis: 'ordre de marche', fuel: 6.2, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 312, rake: 26.2, length: 2175 },
  'aoz-az450f': { ref: 'Yamaha YZ450F (2024)', wheelbase: 1480, seat: 965, ground: 351, weight: 109, basis: 'ordre de marche', fuel: 6.2, tireF: '80/100-21', tireR: '120/80-19', travelF: 310, travelR: 315, rake: 26.6, length: 2185 },
  'mid-kr85': { ref: 'Kawasaki KX85 (2024)', wheelbase: 1265, seat: 830, ground: 290, weight: 74.6, basis: 'ordre de marche', fuel: 4.9, tireF: '70/100-17', tireR: '90/100-14', travelF: 275, travelR: 275, rake: 29, length: 1840, estimated: ['débattements', 'chasse'] },
  'mid-kr125': { ref: 'Kawasaki KX125 (2008)', wheelbase: 1460, seat: 945, ground: 375, weight: 87.5, basis: 'sec', fuel: 7.2, tireF: '80/100-21', tireR: '100/90-19', travelF: 300, travelR: 315, rake: 26, estimated: ['débattements', 'chasse'] },
  'mid-kr250f': { ref: 'Kawasaki KX250 (2024)', wheelbase: 1486, seat: 960, ground: 345, weight: 107.8, basis: 'ordre de marche', fuel: 6.4, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 315, rake: 28, length: 2170 },
  'hin-hr125': { ref: 'Honda CR125R (2007)', wheelbase: 1471, seat: 947, ground: 351, weight: 89.4, basis: 'sec', fuel: 7.6, tireF: '80/100-21', tireR: '100/90-19', travelF: 300, travelR: 315, rake: 26.2, estimated: ['débattements', 'chasse'] },
  'hin-hr250': { ref: 'Honda CR250R (2007)', wheelbase: 1481, seat: 942, ground: 338, weight: 96.6, basis: 'sec', fuel: 7.6, tireF: '80/100-21', tireR: '110/90-19', travelF: 300, travelR: 315, rake: 26.6, estimated: ['débattements', 'chasse'] },
  'hin-hrf450r': { ref: 'Honda CRF450R (2024)', wheelbase: 1481, seat: 965, ground: 335, weight: 113, basis: 'ordre de marche', fuel: 6.3, tireF: '80/100-21', tireR: '120/80-19', travelF: 305, travelR: 316, rake: 27.1, length: 2183 },
  'kro-125xs': { ref: 'KTM 125 SX (2024)', wheelbase: 1485, seat: 958, ground: 359, weight: 92.4, basis: 'sans carburant', fuel: 7.2, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 300, rake: 26.1 },
  'kro-250xsf': { ref: 'KTM 250 SX-F (2024)', wheelbase: 1485, seat: 958, ground: 343, weight: 106.6, basis: 'ordre de marche', fuel: 7.2, tireF: '80/100-21', tireR: '110/90-19', travelF: 310, travelR: 300, rake: 26.1 },
  'kro-450xsf': { ref: 'KTM 450 SX-F (2024)', wheelbase: 1491, seat: 958, ground: 343, weight: 108, basis: 'ordre de marche', fuel: 7.2, tireF: '80/100-21', tireR: '120/80-19', travelF: 310, travelR: 300, rake: 26.1 },
  'nor-nc125': { ref: 'Husqvarna TC 125 (2024)', wheelbase: 1485, seat: 939, ground: 350, weight: 92.5, basis: 'sans carburant', fuel: 7.2, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 300, rake: 26.1 },
  'nor-nf450': { ref: 'Husqvarna FC 450 (2024)', wheelbase: 1485, seat: 939, ground: 336, weight: 102.8, basis: 'sans carburant', fuel: 7.2, tireF: '80/100-21', tireR: '120/80-19', travelF: 310, travelR: 300, rake: 26.1 },
  'fia-fx50': { ref: 'Fantic XE 50 Performance', wheelbase: 1435, seat: 870, ground: 300, weight: 94, basis: 'ordre de marche', fuel: 7.5, tireF: '80/90-21', tireR: '110/80-18', travelF: 265, travelR: 270, rake: 27, estimated: ['garde au sol', 'débattement arrière', 'chasse'] },
  'fia-fx125': { ref: 'Fantic XX 125 (2024)', wheelbase: 1440, seat: 975, ground: 360, weight: 90, basis: 'sec', fuel: 7.5, tireF: '80/100-21', tireR: '100/90-19', travelF: 300, travelR: 310, rake: 26.5, estimated: ['garde au sol', 'réservoir', 'débattements', 'chasse'] },
  'fia-fx250': { ref: 'Fantic XX 250 (2024)', wheelbase: 1485, seat: 970, ground: 360, weight: 98, basis: 'ordre de marche', fuel: 8, tireF: '80/100-21', tireR: '110/90-19', travelF: 300, travelR: 310, rake: 26.5, length: 2185, estimated: ['garde au sol', 'débattements', 'chasse'] },
  'fia-fxf250': { ref: 'Fantic XXF 250 (2024)', wheelbase: 1475, seat: 970, ground: 350, weight: 105, basis: 'sec', fuel: 6.2, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 312, rake: 26.2, estimated: ['garde au sol', 'débattements', 'chasse'] },
  'kii-kz250': { ref: 'Suzuki RM-Z250 (2024)', wheelbase: 1485, seat: 955, ground: 330, weight: 106, basis: 'ordre de marche', fuel: 6.3, tireF: '80/100-21', tireR: '100/90-19', travelF: 305, travelR: 310, rake: 27.9, estimated: ['débattements'] },
  'kii-kz450': { ref: 'Suzuki RM-Z450 (2024)', wheelbase: 1480, seat: 960, ground: 330, weight: 112, basis: 'ordre de marche', fuel: 6.3, tireF: '80/100-21', tireR: '120/80-19', travelF: 305, travelR: 310, rake: 27.9, estimated: ['débattements'] },
  'bra-bc125': { ref: 'GasGas MC 125 (2024)', wheelbase: 1485, seat: 950, ground: 350, weight: 87.5, basis: 'sec', fuel: 7.5, tireF: '80/100-21', tireR: '100/90-19', travelF: 310, travelR: 300, rake: 26.1, estimated: ['garde au sol'] },
  'bra-bc450f': { ref: 'GasGas MC 450F (2024)', wheelbase: 1485, seat: 956, ground: 354, weight: 103.3, basis: 'sec', fuel: 7.2, tireF: '80/100-21', tireR: '120/80-19', travelF: 310, travelR: 300, rake: 26.1 },
  'bra-bx50': { ref: 'Derbi Senda DRD X-Treme 50 R', wheelbase: 1413, seat: 890, ground: 300, weight: 105, basis: 'ordre de marche', fuel: 7, tireF: '90/90-21', tireR: '120/80-18', travelF: 240, travelR: 250, rake: 27, estimated: ['hauteur de selle', 'garde au sol', 'poids', 'pneus', 'débattements', 'chasse'] },

  // ------------------------------------------------ supermotards
  'kro-690smr': { ref: 'KTM 690 SMC R (2023)', wheelbase: 1470, seat: 890, ground: 237, weight: 147, basis: 'sec', fuel: 13.5, tireF: '120/70-17', tireR: '160/60-17', travelF: 215, travelR: 240, rake: 26.4 },
  'nor-701sm': { ref: 'Husqvarna 701 Supermoto (2024)', wheelbase: 1470, seat: 890, ground: 238, weight: 147, basis: 'sec', fuel: 13, tireF: '120/70-17', tireR: '160/60-17', travelF: 215, travelR: 240, rake: 26.4 },
  'aoz-ws450sm': { ref: 'Yamaha WR450F (2024)', wheelbase: 1470, seat: 925, ground: 300, weight: 117, basis: 'ordre de marche', fuel: 7.6, tireF: '120/70-17', tireR: '150/60-17', travelF: 300, travelR: 315, rake: 26.7, note: 'Cotes de la WR450F (selle 955 mm, garde au sol 330 mm en enduro) passée en roues de 17".', estimated: ['hauteur de selle et garde au sol après passage en 17"'] },
  'hin-hrf450sm': { ref: 'Honda CRF450R (2024)', wheelbase: 1481, seat: 935, ground: 300, weight: 113, basis: 'ordre de marche', fuel: 6.3, tireF: '120/70-17', tireR: '150/60-17', travelF: 305, travelR: 316, rake: 27.1, note: 'CRF450R (selle 965 mm) passée en roues de 17".', estimated: ['hauteur de selle et garde au sol après passage en 17"'] },
  'fia-xsm125': { ref: 'Fantic XMF 125 Competition', wheelbase: 1435, seat: 880, ground: 260, weight: 112, basis: 'sec', fuel: 7, tireF: '100/80-17', tireR: '130/70-17', travelF: 260, travelR: 270, rake: 26.5, estimated: ['garde au sol', 'réservoir', 'débattements', 'chasse'] },
  'bra-smx50': { ref: 'Derbi Senda DRD X-Treme 50 SM (2019)', wheelbase: 1413, seat: 865, ground: 240, weight: 105, basis: 'ordre de marche', fuel: 7, tireF: '100/80-17', tireR: '130/70-17', travelF: 200, travelR: 210, rake: 26, estimated: ['garde au sol', 'poids', 'pneus', 'débattements', 'chasse'] },

  // ------------------------------------------------ stunt (préparations)
  'cus-125w': { ref: 'Yamaha YZ125 (2024)', wheelbase: 1445, seat: 945, ground: 300, weight: 100, basis: 'ordre de marche', fuel: 7.9, tireF: '120/70-17', tireR: '150/60-17', travelF: 270, travelR: 280, rake: 26.3, note: 'YZ125 en roues de 17", barre de 12h et cage.', estimated: ['cotes après préparation'] },
  'cus-450st': { ref: 'Honda CRF450R (2024)', wheelbase: 1481, seat: 920, ground: 290, weight: 120, basis: 'ordre de marche', fuel: 6.3, tireF: '120/70-17', tireR: '160/60-17', travelF: 270, travelR: 280, rake: 27.1, note: 'CRF450R en roues de 17", suspensions raccourcies, barre de 12h et cage.', estimated: ['cotes après préparation'] },
  'cus-690st': { ref: 'KTM 690 SMC R (2023)', wheelbase: 1470, seat: 870, ground: 225, weight: 155, basis: 'sec', fuel: 13.5, tireF: '120/70-17', tireR: '160/60-17', travelF: 200, travelR: 225, rake: 26.4, note: '690 SMC R rabaissée, barre de 12h, cage et frein arrière au guidon.', estimated: ['cotes après préparation'] },

  // ------------------------------------------------ scooters
  'sin-orbiter50': { ref: 'SYM Orbit II 50', wheelbase: 1310, seat: 805, ground: 120, weight: 99, basis: 'sec', fuel: 5.2, tireF: '120/70-12', tireR: '130/70-12', travelF: 80, travelR: 75, rake: 26, length: 1905, estimated: ['garde au sol', 'débattements', 'chasse'] },
  'aoz-aerix50': { ref: 'Yamaha Aerox 50 2T (2013-2017)', wheelbase: 1300, seat: 804, ground: 120, weight: 97, basis: 'sec', fuel: 6.5, tireF: '130/60-13', tireR: '140/60-13', travelF: 80, travelR: 75, rake: 26, estimated: ['empattement', 'garde au sol', 'débattements', 'chasse'] },
  'vel-nitrox50': { ref: 'MBK Nitro 50 2T (plateforme Aerox)', wheelbase: 1300, seat: 804, ground: 120, weight: 97, basis: 'sec', fuel: 6.5, tireF: '130/60-13', tireR: '140/60-13', travelF: 80, travelR: 75, rake: 26, estimated: ['empattement', 'garde au sol', 'débattements', 'chasse'] },
  'peg-zap50': { ref: 'Piaggio Zip 50', wheelbase: 1230, seat: 770, ground: 110, weight: 85, basis: 'sec', fuel: 7, tireF: '100/80-10', tireR: '120/70-10', travelF: 70, travelR: 65, rake: 27, estimated: ['garde au sol', 'débattements', 'chasse'] },
  'lio-speedstrike50': { ref: 'Peugeot Speedfight 4 50 2T', wheelbase: 1306, seat: 800, ground: 125, weight: 100, basis: 'sec', fuel: 7, tireF: '130/60-13', tireR: '130/60-13', travelF: 80, travelR: 75, rake: 26, estimated: ['garde au sol', 'réservoir', 'débattements', 'chasse'] },
  'gil-sprinter50': { ref: 'Gilera Runner 50 SP', wheelbase: 1300, seat: 830, ground: 125, weight: 105, basis: 'ordre de marche', fuel: 7, tireF: '120/70-12', tireR: '130/70-12', travelF: 80, travelR: 80, rake: 26, estimated: ['empattement', 'garde au sol', 'pneus', 'débattements', 'chasse'] },
  'gil-sprinter125': { ref: 'Gilera Runner 125 ST', wheelbase: 1340, seat: 815, ground: 130, weight: 137, basis: 'ordre de marche', fuel: 9, tireF: '120/70-14', tireR: '140/60-13', travelF: 90, travelR: 85, rake: 26, length: 1880, estimated: ['garde au sol', 'réservoir', 'débattements', 'chasse'] },
  'aoz-aerix70': { ref: 'Yamaha Aerox 50 2T (kit 70 cm³)', wheelbase: 1300, seat: 804, ground: 120, weight: 99, basis: 'sec', fuel: 6.5, tireF: '130/60-13', tireR: '140/60-13', travelF: 80, travelR: 75, rake: 26, note: 'Cotes de l’Aerox, préparation moteur 70 cm³.', estimated: ['empattement', 'garde au sol', 'débattements', 'chasse'] },
};

export interface TireDims {
  width: number; // m
  sidewall: number; // m
  rim: number; // pouces
  radius: number; // m (rayon roue + pneu)
}

/** Décode une cote de pneu "largeur/série-jante" (ex. 120/70-17). */
export function parseTire(s: string): TireDims {
  const m = /^(\d+)\/(\d+)\s*(?:R|-)\s*(\d+)$/i.exec(s.replace(/\s+/g, ''));
  if (!m) throw new Error(`Cote de pneu invalide : ${s}`);
  const width = Number(m[1]) / 1000;
  const sidewall = (Number(m[1]) * Number(m[2])) / 100 / 1000;
  const rim = Number(m[3]);
  return { width, sidewall, rim, radius: (rim * 0.0254) / 2 + sidewall };
}

/** Masse en ordre de marche (sans pilote), en ajoutant l'essence si la fiche est « à sec ». */
export function runningMass(r: RealSpec): number {
  return r.basis === 'ordre de marche' ? r.weight : r.weight + r.fuel * 0.74;
}

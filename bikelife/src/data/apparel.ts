// Équipement et tenues du pilote.

export type HelmetType = 'mx' | 'street' | 'jet';
export type EyewearType = 'goggles' | 'visor' | 'mask';
export type TopType = 'jersey' | 'hoodie' | 'puffer' | 'windbreaker' | 'tee';
export type PantsType = 'mx' | 'jeans' | 'joggers';
export type ShoesType = 'mxboots' | 'sneakers' | 'highsneakers';
export type Pattern = 'solid' | 'stripes' | 'split' | 'chevron' | 'camo' | 'number';

export interface RiderConfig {
  name: string;
  skin: string;
  helmet: HelmetType;
  helmetColor: string;
  helmetColor2: string;
  helmetPattern: Pattern;
  eyewear: EyewearType;
  eyewearColor: string;
  top: TopType;
  topColor: string;
  topColor2: string;
  topPattern: Pattern;
  number: string;
  pants: PantsType;
  pantsColor: string;
  pantsColor2: string;
  gloves: string;
  shoes: ShoesType;
  shoesColor: string;
  shoesColor2: string;
  backpack: boolean;
  backpackColor: string;
}

export interface ApparelOption<T extends string | boolean> {
  value: T;
  name: string;
  price: number;
}

export const APPAREL = {
  helmet: [
    { value: 'mx', name: 'Casque cross', price: 0 },
    { value: 'street', name: 'Intégral route', price: 600 },
    { value: 'jet', name: 'Jet urbain', price: 400 },
  ] as ApparelOption<HelmetType>[],
  eyewear: [
    { value: 'goggles', name: 'Masque cross', price: 0 },
    { value: 'visor', name: 'Visière fumée', price: 200 },
    { value: 'mask', name: 'Cagoule + lunettes', price: 300 },
  ] as ApparelOption<EyewearType>[],
  top: [
    { value: 'jersey', name: 'Maillot MX', price: 0 },
    { value: 'hoodie', name: 'Hoodie', price: 350 },
    { value: 'puffer', name: 'Doudoune', price: 600 },
    { value: 'windbreaker', name: 'Coupe-vent', price: 450 },
    { value: 'tee', name: 'T-shirt oversize', price: 150 },
  ] as ApparelOption<TopType>[],
  topPattern: [
    { value: 'solid', name: 'Uni', price: 0 },
    { value: 'stripes', name: 'Bandes', price: 100 },
    { value: 'split', name: 'Bicolore', price: 100 },
    { value: 'chevron', name: 'Chevrons', price: 150 },
    { value: 'camo', name: 'Camo', price: 250 },
    { value: 'number', name: 'Numéro dorsal', price: 120 },
  ] as ApparelOption<Pattern>[],
  helmetPattern: [
    { value: 'solid', name: 'Uni', price: 0 },
    { value: 'stripes', name: 'Bandes', price: 150 },
    { value: 'split', name: 'Bicolore', price: 150 },
    { value: 'chevron', name: 'Chevrons', price: 200 },
    { value: 'camo', name: 'Camo', price: 300 },
  ] as ApparelOption<Pattern>[],
  pants: [
    { value: 'mx', name: 'Pantalon MX', price: 0 },
    { value: 'jeans', name: 'Jean', price: 250 },
    { value: 'joggers', name: 'Jogging', price: 200 },
  ] as ApparelOption<PantsType>[],
  shoes: [
    { value: 'mxboots', name: 'Bottes MX', price: 0 },
    { value: 'sneakers', name: 'Sneakers basses', price: 300 },
    { value: 'highsneakers', name: 'Sneakers montantes', price: 400 },
  ] as ApparelOption<ShoesType>[],
  backpack: [
    { value: false, name: 'Sans', price: 0 },
    { value: true, name: 'Sac à dos', price: 250 },
  ] as ApparelOption<boolean>[],
};

export type ApparelSlot = keyof typeof APPAREL;

export const APPAREL_LABEL: Record<ApparelSlot, string> = {
  helmet: 'Casque',
  helmetPattern: 'Déco casque',
  eyewear: 'Masque / lunettes',
  top: 'Haut',
  topPattern: 'Motif du haut',
  pants: 'Pantalon',
  shoes: 'Chaussures',
  backpack: 'Sac',
};

export const SKIN_TONES = ['#f1c9a5', '#e0ac85', '#c68b62', '#a0683f', '#7a4b2a', '#4f301b'];

export function defaultRider(): RiderConfig {
  return {
    name: 'Rider',
    skin: '#c68b62',
    helmet: 'mx',
    helmetColor: '#f4f4f4',
    helmetColor2: '#1f4fd1',
    helmetPattern: 'stripes',
    eyewear: 'goggles',
    eyewearColor: '#ff6a00',
    top: 'jersey',
    topColor: '#1f4fd1',
    topColor2: '#f4f4f4',
    topPattern: 'stripes',
    number: '77',
    pants: 'mx',
    pantsColor: '#151515',
    pantsColor2: '#1f4fd1',
    gloves: '#151515',
    shoes: 'mxboots',
    shoesColor: '#f4f4f4',
    shoesColor2: '#151515',
    backpack: false,
    backpackColor: '#151515',
  };
}

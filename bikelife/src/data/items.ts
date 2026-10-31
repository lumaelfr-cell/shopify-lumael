// Articles vendus dans les commerces (supérette, fast-food). Chaque article a
// un effet réel en jeu : santé, endurance, carburant ou état de la moto.

export interface ItemEffect {
  health?: number; // points de santé rendus (0..100)
  stamina?: boolean; // endurance pleine
  boost?: number; // secondes de course illimitée
  fuel?: number; // litres ajoutés à la moto
  repair?: number; // points d'état rendus à la moto
}

export interface Item {
  id: string;
  name: string;
  price: number;
  desc: string;
  shop: 'superette' | 'fastfood';
  /** consommé sur place (fast-food) ou rangé dans le sac */
  instant: boolean;
  effect: ItemEffect;
}

export const ITEMS: Item[] = [
  { id: 'water', name: 'Bouteille d’eau', price: 1, desc: '+10 santé, endurance pleine.', shop: 'superette', instant: false, effect: { health: 10, stamina: true } },
  { id: 'energy', name: 'Boisson énergisante', price: 3, desc: 'Course illimitée 90 s, +5 santé.', shop: 'superette', instant: false, effect: { boost: 90, health: 5, stamina: true } },
  { id: 'sandwich', name: 'Sandwich jambon-beurre', price: 5, desc: '+35 santé.', shop: 'superette', instant: false, effect: { health: 35 } },
  { id: 'jerrycan', name: 'Jerrican 5 L (plein)', price: 14, desc: 'Ajoute 5 L d’essence à ta moto, où que tu sois.', shop: 'superette', instant: false, effect: { fuel: 5 } },
  { id: 'repairkit', name: 'Kit de réparation', price: 120, desc: 'Remet +25 % d’état à la moto (guidon, leviers, plastiques).', shop: 'superette', instant: false, effect: { repair: 25 } },
  { id: 'burger', name: 'Burger Street', price: 8, desc: '+50 santé.', shop: 'fastfood', instant: true, effect: { health: 50 } },
  { id: 'menu', name: 'Menu Wheelie', price: 12, desc: 'Santé au maximum, endurance pleine, course illimitée 60 s.', shop: 'fastfood', instant: true, effect: { health: 100, stamina: true, boost: 60 } },
  { id: 'wrap', name: 'Wrap poulet', price: 7, desc: '+40 santé.', shop: 'fastfood', instant: true, effect: { health: 40 } },
  { id: 'shake', name: 'Milkshake', price: 4, desc: '+15 santé, course illimitée 30 s.', shop: 'fastfood', instant: true, effect: { health: 15, boost: 30 } },
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Consommation (L/h) à partir de la puissance délivrée : CSE ~420 g/kWh (2T), ~300 g/kWh (4T). */
export function fuelFlowLph(powerKW: number, stroke: 2 | 4): number {
  const bsfc = stroke === 2 ? 420 : 300;
  return (Math.max(0, powerKW) * bsfc) / 740;
}

/** Coût d'une remise à neuf à l'atelier (main-d'œuvre + pièces). */
export function repairCost(price: number, cond: number): number {
  return Math.round(Math.max(0, 100 - cond) * (8 + price * 0.0012));
}

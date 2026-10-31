import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};


const { Progression, xpForLevel, garageSlots } = await import('../src/gameplay/progression');
const { BIKE_BY_ID } = await import('../src/data/bikes');

describe('progression', () => {
  beforeEach(() => store.clear());

  it('nouveau profil : 2 véhicules offerts et de l’argent', () => {
    const p = new Progression();
    expect(Object.keys(p.p.bikes).length).toBe(2);
    expect(p.p.money).toBeGreaterThan(0);
    expect(p.p.daily.goals.length).toBe(3);
  });

  it('achat de moto : prix, niveau, places', () => {
    const p = new Progression();
    p.p.money = 100000;
    expect(p.buyBike('aoz-az450f')).toBe(false); // niveau 5 requis
    p.p.level = 6;
    expect(p.buyBike('aoz-az450f')).toBe(true);
    expect(p.p.money).toBe(100000 - BIKE_BY_ID['aoz-az450f'].price);
    expect(p.p.current).toBe('aoz-az450f');
  });

  it('XP et niveaux', () => {
    const p = new Progression();
    p.addXP(xpForLevel(3));
    expect(p.p.level).toBeGreaterThanOrEqual(3);
    expect(garageSlots(10)).toBeGreaterThan(garageSlots(1));
  });

  it('records et succès', () => {
    const p = new Progression();
    p.record('wheelieDist', 120, 'Wheeling', 'm');
    p.checkAchievements();
    expect(p.p.achievements).toContain('wheelie-100');
  });

  it('sauvegarde puis rechargement', () => {
    const a = new Progression();
    a.p.money = 4242;
    a.save();
    const b = new Progression();
    expect(b.p.money).toBe(4242);
  });

  it('pièces achetées une seule fois', () => {
    const p = new Progression();
    p.p.money = 2000;
    expect(p.buyPart('exhaust', 'sport', 900)).toBe(true);
    expect(p.p.money).toBe(1100);
    expect(p.partOwned('exhaust', 'sport', 900)).toBe(true);
    expect(p.buyPart('exhaust', 'sport', 900)).toBe(true);
    expect(p.p.money).toBe(1100);
  });
});

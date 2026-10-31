// Profil du joueur, sauvegarde locale (localStorage, versionnée), économie,
// niveaux, garage, succès et objectifs quotidiens.

import { BIKES, BIKE_BY_ID, STARTER_BIKES, BikeSpec } from '../data/bikes';
import { BikeConfig, defaultConfig, partKey, PART_SLOTS, DECALS } from '../data/parts';
import { RiderConfig, defaultRider, APPAREL } from '../data/apparel';
import { events } from '../core/events';
import { hashString, rng } from '../core/math';

export type Quality = 'low' | 'medium' | 'high';

export interface TouchLayout {
  scale: number;
  opacity: number;
  leftHanded: boolean;
  pos: Record<string, { x: number; y: number }>;
}

export interface Settings {
  quality: Quality;
  assist: 0 | 1 | 2;
  autoGear: boolean;
  units: 'kmh' | 'mph';
  volumes: { master: number; engine: number; sfx: number; music: number; ambience: number };
  music: boolean;
  musicStyle: number;
  autoWheelieCam: boolean;
  timeSpeed: number;
  touch: TouchLayout;
  showHelp: boolean;
  traffic: boolean;
  mpServer: string;
}

export interface OwnedBike {
  id: string;
  config: BikeConfig;
  presets: { name: string; config: BikeConfig }[];
}

export interface DailyGoal {
  id: string;
  label: string;
  stat: keyof Stats;
  target: number;
  base: number;
  reward: number;
  done: boolean;
}

export interface Stats {
  wheelieDist: number;
  wheelieTime: number;
  stoppieDist: number;
  airTime: number;
  jumps: number;
  tricks: number;
  crashes: number;
  distance: number;
  nearMisses: number;
  driftTime: number;
  stuntPoints: number;
  playTime: number;
  challengesDone: number;
}

export interface Profile {
  version: number;
  money: number;
  xp: number;
  level: number;
  bikes: Record<string, OwnedBike>;
  current: string;
  rider: RiderConfig;
  riderPresets: { name: string; rider: RiderConfig }[];
  parts: string[]; // pièces achetées (débloquées pour toutes les motos compatibles)
  apparel: string[];
  records: Record<string, number>;
  bikeRecords: Record<string, Record<string, number>>;
  challenges: Record<string, number>;
  timeTrials: Record<string, number>;
  ghosts: Record<string, number[]>;
  achievements: string[];
  daily: { date: string; goals: DailyGoal[] };
  stats: Stats;
  settings: Settings;
  lastPos: { x: number; z: number; yaw: number } | null;
}

const KEY = 'bikelife-street-kings-v1';
export const SAVE_VERSION = 1;

const emptyStats = (): Stats => ({
  wheelieDist: 0, wheelieTime: 0, stoppieDist: 0, airTime: 0, jumps: 0, tricks: 0, crashes: 0, distance: 0, nearMisses: 0, driftTime: 0, stuntPoints: 0, playTime: 0, challengesDone: 0,
});

export function isMobile(): boolean {
  return typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));
}

export function defaultSettings(): Settings {
  const mobile = isMobile();
  return {
    quality: mobile ? 'medium' : 'high',
    assist: mobile ? 2 : 1,
    autoGear: true,
    units: 'kmh',
    volumes: { master: 0.85, engine: 0.9, sfx: 0.8, music: 0.4, ambience: 0.6 },
    music: true,
    musicStyle: 0,
    autoWheelieCam: true,
    timeSpeed: 1,
    touch: { scale: 1, opacity: 0.85, leftHanded: false, pos: {} },
    showHelp: true,
    traffic: true,
    mpServer: '',
  };
}

/** Pièces montées d'origine sur une moto (considérées comme possédées). */
export function stockParts(spec: BikeSpec): string[] {
  const cfg = defaultConfig(spec);
  const out: string[] = [];
  for (const slot of Object.keys(PART_SLOTS)) out.push(partKey(slot, (cfg as any)[slot]));
  out.push(partKey('decal', cfg.decal));
  return out;
}

/** Tenue de départ (considérée comme possédée). */
export function stockApparel(): string[] {
  const r = defaultRider() as any;
  return Object.keys(APPAREL).map((slot) => partKey(slot, r[slot]));
}

export function newProfile(): Profile {
  const bikes: Record<string, OwnedBike> = {};
  const parts: string[] = [];
  for (const id of STARTER_BIKES) {
    bikes[id] = { id, config: defaultConfig(BIKE_BY_ID[id]), presets: [] };
    parts.push(...stockParts(BIKE_BY_ID[id]));
  }
  return {
    version: SAVE_VERSION, money: 2500, xp: 0, level: 1, bikes, current: STARTER_BIKES[0], rider: defaultRider(), riderPresets: [],
    parts: [...new Set(parts)], apparel: stockApparel(), records: {}, bikeRecords: {}, challenges: {}, timeTrials: {}, ghosts: {}, achievements: [],
    daily: { date: '', goals: [] }, stats: emptyStats(), settings: defaultSettings(), lastPos: null,
  };
}

/** XP cumulée nécessaire pour atteindre le niveau L. */
export const xpForLevel = (L: number): number => Math.round(700 * Math.pow(Math.max(0, L - 1), 1.55));

export const garageSlots = (level: number): number => Math.min(24, 4 + Math.floor(level / 2));

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  reward: number;
  check: (p: Profile) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-wheelie', name: 'Premier lever', desc: 'Faire un wheeling de 20 m.', reward: 300, check: (p) => (p.records.wheelieDist ?? 0) >= 20 },
  { id: 'wheelie-100', name: 'Centurion', desc: 'Wheeling de 100 m d’un coup.', reward: 800, check: (p) => (p.records.wheelieDist ?? 0) >= 100 },
  { id: 'wheelie-500', name: 'Boulevard King', desc: 'Wheeling de 500 m d’un coup.', reward: 3000, check: (p) => (p.records.wheelieDist ?? 0) >= 500 },
  { id: 'wheelie-1km', name: 'Kilomètre roue arrière', desc: 'Wheeling de 1 000 m.', reward: 8000, check: (p) => (p.records.wheelieDist ?? 0) >= 1000 },
  { id: 'wheelie-60s', name: 'Une minute là-haut', desc: 'Tenir un wheeling 60 s.', reward: 5000, check: (p) => (p.records.wheelieTime ?? 0) >= 60 },
  { id: 'stoppie-10', name: 'Freins de compet’', desc: 'Stoppie de 10 m.', reward: 800, check: (p) => (p.records.stoppieDist ?? 0) >= 10 },
  { id: 'air-2', name: 'Vol plané', desc: '2 s en l’air.', reward: 600, check: (p) => (p.records.airTime ?? 0) >= 2 },
  { id: 'jump-30', name: 'Grand saut', desc: 'Saut de 30 m.', reward: 1500, check: (p) => (p.records.jumpDist ?? 0) >= 30 },
  { id: 'combo-10k', name: 'Combo monstre', desc: 'Combo de 10 000 points.', reward: 2500, check: (p) => (p.records.bestCombo ?? 0) >= 10000 },
  { id: 'speed-150', name: 'Avion de chasse', desc: 'Atteindre 150 km/h.', reward: 1500, check: (p) => (p.records.topSpeed ?? 0) >= 150 },
  { id: 'near-25', name: 'Entre les voitures', desc: '25 frôlements au total.', reward: 1200, check: (p) => p.stats.nearMisses >= 25 },
  { id: 'tricks-50', name: 'Showman', desc: '50 figures aériennes.', reward: 2000, check: (p) => p.stats.tricks >= 50 },
  { id: 'garage-5', name: 'Collectionneur', desc: 'Posséder 5 véhicules.', reward: 2000, check: (p) => Object.keys(p.bikes).length >= 5 },
  { id: 'garage-10', name: 'Écurie', desc: 'Posséder 10 véhicules.', reward: 6000, check: (p) => Object.keys(p.bikes).length >= 10 },
  { id: 'level-10', name: 'Légende du quartier', desc: 'Atteindre le niveau 10.', reward: 5000, check: (p) => p.level >= 10 },
  { id: 'challenges-10', name: 'Relever les défis', desc: 'Terminer 10 défis.', reward: 3000, check: (p) => Object.values(p.challenges).filter((s) => s > 0).length >= 10 },
  { id: 'crash-50', name: 'Cascadeur', desc: '50 chutes… on se relève toujours.', reward: 500, check: (p) => p.stats.crashes >= 50 },
  { id: 'drift-60', name: 'Glisseur', desc: '60 s de dérapage au total.', reward: 1500, check: (p) => p.stats.driftTime >= 60 },
];

const DAILY_TEMPLATES: { stat: keyof Stats; label: (n: number) => string; range: [number, number]; reward: [number, number]; round: number }[] = [
  { stat: 'wheelieDist', label: (n) => `Parcourir ${n} m en wheeling`, range: [300, 900], reward: [900, 1800], round: 50 },
  { stat: 'jumps', label: (n) => `Réussir ${n} sauts`, range: [8, 20], reward: [700, 1400], round: 1 },
  { stat: 'nearMisses', label: (n) => `Frôler ${n} voitures`, range: [4, 10], reward: [800, 1500], round: 1 },
  { stat: 'stuntPoints', label: (n) => `Marquer ${n.toLocaleString('fr-FR')} points de figures`, range: [8000, 25000], reward: [1000, 2000], round: 1000 },
  { stat: 'stoppieDist', label: (n) => `Parcourir ${n} m en stoppie`, range: [20, 60], reward: [800, 1500], round: 5 },
  { stat: 'airTime', label: (n) => `Cumuler ${n} s en l’air`, range: [10, 30], reward: [800, 1500], round: 1 },
  { stat: 'driftTime', label: (n) => `Cumuler ${n} s de dérapage`, range: [10, 30], reward: [800, 1500], round: 1 },
  { stat: 'distance', label: (n) => `Rouler ${(n / 1000).toFixed(0)} km`, range: [4000, 10000], reward: [600, 1200], round: 1000 },
];

export class Progression {
  p: Profile;
  private saveTimer = 0;
  storageOk = true;

  constructor() {
    this.p = this.load();
    this.refreshDaily();
  }

  private load(): Profile {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return newProfile();
      const data = JSON.parse(raw) as Partial<Profile>;
      const base = newProfile();
      const p: Profile = { ...base, ...data, settings: { ...base.settings, ...(data.settings ?? {}), volumes: { ...base.settings.volumes, ...(data.settings?.volumes ?? {}) }, touch: { ...base.settings.touch, ...(data.settings?.touch ?? {}) } }, stats: { ...base.stats, ...(data.stats ?? {}) }, rider: { ...base.rider, ...(data.rider ?? {}) } } as Profile;
      // nettoyage : motos inconnues
      for (const id of Object.keys(p.bikes)) {
        const spec = BIKE_BY_ID[id];
        if (!spec) delete p.bikes[id];
        else p.bikes[id].config = { ...defaultConfig(spec), ...p.bikes[id].config };
      }
      if (!p.bikes[p.current]) p.current = Object.keys(p.bikes)[0] ?? STARTER_BIKES[0];
      // migration : pièces d'origine et tenue de départ possédées
      const parts = new Set(p.parts ?? []);
      for (const id of Object.keys(p.bikes)) stockParts(BIKE_BY_ID[id]).forEach((k) => parts.add(k));
      p.parts = [...parts];
      p.apparel = [...new Set([...(p.apparel ?? []), ...stockApparel()])];
      if (!Object.keys(p.bikes).length) return newProfile();
      return p;
    } catch (e) {
      console.warn('[save] lecture impossible, nouveau profil', e);
      return newProfile();
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.p));
      this.storageOk = true;
    } catch (e) {
      this.storageOk = false;
      console.warn('[save] écriture impossible', e);
    }
  }

  /** Sauvegarde différée (regroupe les écritures). */
  touch(): void {
    this.saveTimer = 1.5;
  }

  tick(dt: number): void {
    this.p.stats.playTime += dt;
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.save();
    }
  }

  reset(): void {
    this.p = newProfile();
    this.refreshDaily();
    this.save();
  }

  exportJSON(): string {
    return JSON.stringify(this.p);
  }

  importJSON(s: string): boolean {
    try {
      const d = JSON.parse(s);
      if (!d || typeof d !== 'object' || !d.bikes) return false;
      localStorage.setItem(KEY, s);
      this.p = this.load();
      return true;
    } catch {
      return false;
    }
  }

  get spec(): BikeSpec {
    return BIKE_BY_ID[this.p.current];
  }

  get owned(): OwnedBike {
    return this.p.bikes[this.p.current];
  }

  // ------------------------------------------------ argent & XP
  addMoney(amount: number, reason: string): void {
    if (amount === 0) return;
    this.p.money = Math.max(0, Math.round(this.p.money + amount));
    events.emit('money', { amount: Math.round(amount), reason });
    this.touch();
  }

  addXP(amount: number): void {
    this.p.xp += Math.round(amount);
    while (this.p.xp >= xpForLevel(this.p.level + 1)) {
      this.p.level++;
      const bonus = 500 + this.p.level * 150;
      this.p.money += bonus;
      events.emit('levelUp', { level: this.p.level });
      events.emit('notify', { text: `Niveau ${this.p.level} ! +${bonus} $ — ${garageSlots(this.p.level)} places de garage`, kind: 'gold' });
    }
    this.checkAchievements();
    this.touch();
  }

  // ------------------------------------------------ garage
  canBuy(spec: BikeSpec): { ok: boolean; why?: string } {
    if (this.p.bikes[spec.id]) return { ok: false, why: 'Déjà possédé' };
    if (this.p.level < spec.level) return { ok: false, why: `Niveau ${spec.level} requis` };
    if (this.p.money < spec.price) return { ok: false, why: 'Pas assez d’argent' };
    if (Object.keys(this.p.bikes).length >= garageSlots(this.p.level)) return { ok: false, why: 'Garage plein (montez de niveau ou vendez)' };
    return { ok: true };
  }

  buyBike(id: string): boolean {
    const spec = BIKE_BY_ID[id];
    if (!spec || !this.canBuy(spec).ok) return false;
    this.p.money -= spec.price;
    this.p.bikes[id] = { id, config: defaultConfig(spec), presets: [] };
    for (const k of stockParts(spec)) if (!this.p.parts.includes(k)) this.p.parts.push(k);
    this.p.current = id;
    events.emit('notify', { text: `${spec.brand} ${spec.model} ajouté au garage !`, kind: 'good' });
    this.checkAchievements();
    this.save();
    return true;
  }

  sellBike(id: string): number {
    if (!this.p.bikes[id] || Object.keys(this.p.bikes).length <= 1) return 0;
    const spec = BIKE_BY_ID[id];
    const value = Math.round((spec.price || 1500) * 0.6);
    delete this.p.bikes[id];
    if (this.p.current === id) this.p.current = Object.keys(this.p.bikes)[0];
    this.p.money += value;
    this.save();
    return value;
  }

  partOwned(slot: string, value: unknown, price: number): boolean {
    return price === 0 || this.p.parts.includes(partKey(slot, value));
  }

  buyPart(slot: string, value: unknown, price: number): boolean {
    if (this.partOwned(slot, value, price)) return true;
    if (this.p.money < price) return false;
    this.p.money -= price;
    this.p.parts.push(partKey(slot, value));
    this.save();
    return true;
  }

  apparelOwned(slot: string, value: unknown, price: number): boolean {
    return price === 0 || this.p.apparel.includes(partKey(slot, value));
  }

  buyApparel(slot: string, value: unknown, price: number): boolean {
    if (this.apparelOwned(slot, value, price)) return true;
    if (this.p.money < price) return false;
    this.p.money -= price;
    this.p.apparel.push(partKey(slot, value));
    this.save();
    return true;
  }

  // ------------------------------------------------ records & stats
  record(key: string, value: number, label: string, unit: string, higherBetter = true, silent = false): boolean {
    const r = this.p.records;
    const prev = r[key];
    const better = prev === undefined || (higherBetter ? value > prev : value < prev);
    const br = (this.p.bikeRecords[this.p.current] ??= {});
    if (br[key] === undefined || (higherBetter ? value > br[key] : value < br[key])) br[key] = value;
    if (better) {
      r[key] = value;
      if (prev !== undefined && !silent) events.emit('record', { key, label, value, unit });
      this.checkAchievements();
      this.touch();
    }
    return better && prev !== undefined;
  }

  stat(key: keyof Stats, add: number): void {
    this.p.stats[key] += add;
    for (const g of this.p.daily.goals) {
      if (g.stat === key && !g.done && this.p.stats[key] - g.base >= g.target) {
        g.done = true;
        this.addMoney(g.reward, 'Objectif du jour');
        events.emit('notify', { text: `Objectif du jour terminé : ${g.label} (+${g.reward} $)`, kind: 'gold' });
      }
    }
    this.touch();
  }

  checkAchievements(): void {
    for (const a of ACHIEVEMENTS) {
      if (this.p.achievements.includes(a.id)) continue;
      if (a.check(this.p)) {
        this.p.achievements.push(a.id);
        this.p.money += a.reward;
        events.emit('achievement', { id: a.id, name: a.name });
        events.emit('notify', { text: `Succès débloqué : ${a.name} (+${a.reward} $)`, kind: 'gold' });
      }
    }
  }

  refreshDaily(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.p.daily.date === today && this.p.daily.goals.length) return;
    const r = rng(hashString(today));
    const pool = [...DAILY_TEMPLATES];
    const goals: DailyGoal[] = [];
    for (let i = 0; i < 3; i++) {
      const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const raw = t.range[0] + r() * (t.range[1] - t.range[0]);
      const target = Math.max(t.round, Math.round(raw / t.round) * t.round);
      const reward = Math.round((t.reward[0] + r() * (t.reward[1] - t.reward[0])) / 50) * 50;
      goals.push({ id: `${today}-${i}`, label: t.label(target), stat: t.stat, target, base: this.p.stats[t.stat], reward, done: false });
    }
    this.p.daily = { date: today, goals };
    this.touch();
  }

  /** Progression 0..1 d'un objectif du jour. */
  goalProgress(g: DailyGoal): number {
    return Math.min(1, (this.p.stats[g.stat] - g.base) / g.target);
  }

  allPartsCount(): number {
    return Object.values(PART_SLOTS).reduce((n, arr) => n + arr.length, 0) + DECALS.length + Object.values(APPAREL).reduce((n, a) => n + a.length, 0);
  }

  bikeCount(): number {
    return BIKES.length;
  }
}

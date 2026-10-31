// Bâtiments visitables de la ville (intérieurs modélisés, sans chargement) :
// garage du joueur, atelier, concession, magasin d'équipement, station-service
// + supérette, fast-food, immeuble de 4 niveaux, entrepôt abandonné et local
// Bike Life. Chaque bâtiment a de vrais murs, portes animées, collisions,
// éclairage, mobilier, PNJ et des points d'interaction reliés au jeu.

import * as THREE from 'three';
import type { CollisionWorld } from '../physics/collision';
import { CURB } from './layout';
import { Kit, B, Building, Door, DoorOpts, Npc, NpcOpts, Interactable, displayBike, insideBuilding } from './interiorKit';
import type { SeatSpot } from '../vehicle/walker';
import { BIKES, BIKE_BY_ID, BikeClass, BikeSpec, bikeName } from '../data/bikes';
import { BikeConfig, defaultConfig } from '../data/parts';
import { rng } from '../core/math';

const F = CURB; // niveau du sol des blocs

export type GarageTab = 'mine' | 'shop' | 'paint' | 'parts' | 'perf' | 'rider' | 'presets';
export type ShopKind = 'superette' | 'fastfood';

/** Actions du jeu déclenchées depuis les bâtiments. */
export interface BuildingHost {
  openGarageUI(tab: GarageTab, bikeId?: string): void;
  takeBike(id: string, x: number, z: number, yaw: number): void;
  bikeForSale(id: string): void;
  workshop(building: string): void;
  apparel(slot: string): void;
  shop(kind: ShopKind): void;
  refuelLabel(): string | null;
  refuel(): void;
  talk(npc: Npc): void;
  challenges(): void;
  cycleMusic(): string;
  sit(s: SeatSpot): void;
  sleep(s: SeatSpot): void;
  freeDrink(id: string): void;
  findCash(id: string, amount: number): void;
  found(id: string): boolean;
  notify(text: string): void;
  ownedDisplay(): { id: string; cfg: BikeConfig }[];
  ownsBike(id: string): boolean;
  riding(): boolean;
}

interface Slot {
  x: number;
  z: number;
  yaw: number;
  y: number;
  id: string | null;
}

const SHOW_CATS: { cls: BikeClass[]; label: string }[] = [
  { cls: ['mx'], label: 'Motocross' },
  { cls: ['sm'], label: 'Supermotard' },
  { cls: ['scooter'], label: 'Scooters' },
  { cls: ['stunt'], label: 'Stunt' },
  { cls: ['mini'], label: 'Mini & 50 cm³' },
];

export class Interiors {
  kit: Kit;
  host: BuildingHost | null = null;
  root = new THREE.Group();
  buildings: Building[] = [];
  doors: Door[] = [];
  npcs: Npc[] = [];
  private tvTex: THREE.CanvasTexture;
  private tvs: { mesh: THREE.Mesh; on: boolean }[] = [];
  private garageSlots: Slot[] = [];
  private garageDirty = true;
  private showSlots: Slot[] = [];
  private showDirty = true;
  private showCat = 0;
  private showPage = 0;
  private cash: THREE.Mesh | null = null;
  private t = 0;

  constructor(world: CollisionWorld) {
    this.kit = new Kit(world);
    this.tvTex = this.makeTv();
    this.garage();
    this.atelier();
    this.concession();
    this.gearShop();
    this.station();
    this.superette();
    this.fastfood();
    this.immeuble();
    this.entrepot();
    this.local();
  }

  get interactables(): Interactable[] {
    return this.kit.interactables;
  }

  // ---------------------------------------------------------------- outils
  private newB(id: string, name: string, x0: number, z0: number, x1: number, z1: number, y1: number, rideable: boolean, levels = [F]): B {
    const b: Building = {
      id, name, x0, z0, x1, z1, y0: F, y1, lights: [], group: new THREE.Group(), dynamic: new THREE.Group(), doors: [], npcs: [], rideable,
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }), lightsOn: true, levels,
    };
    b.group.add(b.dynamic);
    b.group.userData.cx = (x0 + x1) / 2;
    b.group.userData.cz = (z0 + z1) / 2;
    this.buildings.push(b);
    this.kit.buildings.push(b);
    this.root.add(b.group);
    return new B(this.kit, b);
  }

  private door(bb: B, o: Omit<DoorOpts, 'building'>, startOpen = false): Door {
    const d = new Door({ ...o, building: bb.b.id }, this.kit);
    if (startOpen) {
      d.target = 1;
      d.update(10, false);
    }
    bb.b.group.add(d.group);
    bb.b.doors.push(d);
    this.doors.push(d);
    if (!o.auto) {
      const c = d.center;
      this.kit.addInteract({
        id: `door:${o.id}`, x: c.x, y: o.y0, z: c.z, r: o.kind === 'rollup' ? 3.2 : 1.7, mode: o.bikeOk ? 'both' : 'foot', building: bb.b.id,
        label: () => {
          const lock = d.locked?.();
          if (lock) return lock;
          return `${d.target > 0.5 ? 'Fermer' : 'Ouvrir'} ${o.name}`;
        },
        action: () => {
          if (d.locked?.()) return;
          d.toggle();
        },
      });
    } else {
      // porte automatique : rappel quand on arrive à moto
      const c = d.center;
      this.kit.addInteract({
        id: `door:${o.id}`, x: c.x, y: o.y0, z: c.z, r: 3.5, mode: 'bike', building: bb.b.id,
        label: () => 'Porte piétonne : descends de la moto pour entrer',
        action: () => this.host?.notify('Gare la moto et entre à pied (F / Y / bouton ACTION pour descendre).'),
      });
    }
    return d;
  }

  private npc(bb: B, o: NpcOpts, talk = true): Npc {
    const n = new Npc(o, this.kit);
    bb.b.group.add(n.root);
    bb.b.npcs.push(n);
    this.npcs.push(n);
    if (talk) {
      const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw);
      this.kit.addInteract({
        id: `npc:${o.id}`, x: o.x + fx * 0.8, y: o.y, z: o.z + fz * 0.8, r: 2.2, mode: 'foot', building: bb.b.id,
        label: () => `Parler à ${o.name}`,
        action: () => this.host?.talk(n),
      });
    }
    return n;
  }

  private act(bb: B, id: string, x: number, y: number, z: number, r: number, label: () => string | null, action: () => void, mode: Interactable['mode'] = 'foot'): void {
    this.kit.addInteract({ id, x, y, z, r, mode, label, action, building: bb.b.id });
  }

  private seat(bb: B, id: string, x: number, y: number, z: number, yaw: number, h: number, label = 'S’asseoir', lie = false): void {
    const s: SeatSpot = { x, y, z, yaw, h, lie };
    this.act(bb, `seat:${id}`, x + Math.sin(yaw) * 0.5, y, z + Math.cos(yaw) * 0.5, 1.3, () => label, () => (lie ? this.host?.sleep(s) : this.host?.sit(s)));
  }

  private tvSet(bb: B, id: string, x: number, y: number, z: number, yaw: number, w = 1.3): void {
    const mesh = bb.tv(x, y, z, yaw, w);
    const tv = { mesh, on: false };
    this.tvs.push(tv);
    this.act(bb, `tv:${id}`, x + Math.sin(yaw) * 1.6, y - 1.2, z + Math.cos(yaw) * 1.6, 2.2, () => (tv.on ? 'Éteindre la TV' : 'Allumer la TV'), () => {
      tv.on = !tv.on;
      const m = tv.mesh.material as THREE.MeshBasicMaterial;
      m.map = tv.on ? this.tvTex : null;
      m.color.set(tv.on ? '#ffffff' : '#05070a');
      m.needsUpdate = true;
    });
  }

  private lightSwitch(bb: B, x: number, y: number, z: number): void {
    const b = bb.b;
    bb.cbox(x - 0.05, y + 1.15, z - 0.05, x + 0.05, y + 1.3, z + 0.05, '#f4f4f4', 'gloss');
    this.act(bb, `switch:${b.id}:${x.toFixed(1)}:${z.toFixed(1)}`, x, y, z, 1.4, () => (b.lightsOn ? 'Éteindre les lumières' : 'Allumer les lumières'), () => {
      b.lightsOn = !b.lightsOn;
      b.glow.color.setScalar(b.lightsOn ? 1 : 0.18);
    });
  }

  private makeTv(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 144;
    const g = c.getContext('2d')!;
    // image fixe d'une course de motocross ; le défilement de la texture l'anime
    const sky = g.createLinearGradient(0, 0, 0, 90);
    sky.addColorStop(0, '#5fa8e8');
    sky.addColorStop(1, '#cfe6f7');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 144);
    g.fillStyle = '#5c8a3a';
    g.fillRect(0, 70, 256, 20);
    g.fillStyle = '#8a6440';
    g.beginPath();
    g.moveTo(0, 144);
    g.lineTo(0, 95);
    g.quadraticCurveTo(70, 60, 120, 95);
    g.quadraticCurveTo(190, 120, 256, 92);
    g.lineTo(256, 144);
    g.fill();
    for (const [x, y, col] of [[90, 62, '#1f4fd1'], [170, 92, '#ff6a00'], [40, 88, '#13a35b']] as [number, number, string][]) {
      g.fillStyle = '#111';
      g.beginPath(); g.arc(x - 9, y + 10, 6, 0, 7); g.fill();
      g.beginPath(); g.arc(x + 9, y + 10, 6, 0, 7); g.fill();
      g.fillStyle = col;
      g.fillRect(x - 10, y, 20, 7);
      g.fillRect(x - 3, y - 9, 7, 9);
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 124, 256, 20);
    g.fillStyle = '#fff';
    g.font = 'bold 13px Arial';
    g.fillText('MX TV — EN DIRECT', 8, 138);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  /** Mur extérieur complet d'un bâtiment rectangulaire. */
  private shell(bb: B, x0: number, z0: number, x1: number, z1: number, h: number, inKey: string, outKey: string, holes: { n?: any[]; s?: any[]; w?: any[]; e?: any[] }, t = 0.3, roof = true): void {
    bb.wallX(z0, x0, x1, F, F + h, t, holes.n ?? [], inKey, outKey, 1);
    bb.wallX(z1, x0, x1, F, F + h, t, holes.s ?? [], inKey, outKey, -1);
    bb.wallZ(x0, z0 + t / 2, z1 - t / 2, F, F + h, t, holes.w ?? [], inKey, outKey, 1);
    bb.wallZ(x1, z0 + t / 2, z1 - t / 2, F, F + h, t, holes.e ?? [], inKey, outKey, -1);
    if (roof) {
      bb.slab(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, F + h + 0.3, 0.3, 'roof');
      bb.ceil('ceiling', x0 + t / 2, z0 + t / 2, x1 - t / 2, z1 - t / 2, F + h - 0.01);
    }
  }

  private posters(bb: B, x: number, y: number, z: number, yaw: number, id: string, lines: string[], bg = '#14161a', title = '#ff2bd6'): void {
    bb.board(id, lines, x, y, z, 1.0, 1.4, yaw, bg, '#f4f4f4', title);
  }

  // ---------------------------------------------------------------- garage du joueur
  private garage(): void {
    const x0 = -79, x1 = -49, z0 = 15, z1 = 35, H = 5.2;
    const bb = this.newB('garage', 'Garage Bike Life', x0, z0, x1, z1, F + H, true);
    this.shell(bb, x0, z0, x1, z1, H, 'plaster', 'siding', {
      n: [{ a0: -68, a1: -62, y0: F, y1: F + 3.8 }, { a0: -77, a1: -72, y0: F + 1.2, y1: F + 3.4, glass: true }, { a0: -57, a1: -51, y0: F + 1.2, y1: F + 3.4, glass: true }],
      w: [{ a0: 22, a1: 27, y0: F + 1.6, y1: F + 3.4, glass: true }],
      e: [{ a0: 29, a1: 30.1, y0: F, y1: F + 2.2 }],
    });
    bb.floor('epoxy', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 3);
    bb.sign('GARAGE BIKE LIFE', -65, F + 4.55, z0 - 0.17, 7, 0.9, Math.PI, '#111317', '#ffffff', '#ffcc33');
    this.door(bb, { id: 'garage-main', kind: 'rollup', axis: 'x', a0: -68, a1: -62, c: z0, y0: F, h: 3.8, inSide: 1, bikeOk: true, name: 'le rideau du garage', color: '#7d858c' }, true);
    this.door(bb, { id: 'garage-side', kind: 'swing', axis: 'z', a0: 29, a1: 30.1, c: x1, y0: F, h: 2.2, inSide: -1, name: 'la porte' });
    // établi + outils
    bb.counter(-77, 33.9, -70, 34.7, F, 0.95, '#4a4f57', '#8a6a46');
    bb.toolWall(-77, -70, 34.84, F, -1, 3);
    bb.toolChest(-68.8, 34.3, F);
    bb.ccyl(-78.4, F, 30.4, 0.28, 1.1, '#c0392b', 'gloss', 14, true);
    bb.cbox(-78.85, F, 31.6, -78.1, F + 1.85, 32.5, '#e9ecef', 'gloss', { walkable: false });
    this.act(bb, 'garage-bench', -73.5, F, 33.1, 1.7, () => 'Établi : personnaliser / acheter des pièces', () => this.host?.openGarageUI('mine'));
    this.act(bb, 'garage-fridge', -77.5, F, 32, 1.4, () => 'Frigo : prendre une boisson', () => this.host?.freeDrink('garage-fridge'));
    // emplacements d'exposition des motos possédées
    for (const x of [-65, -61, -57, -53]) this.garageSlots.push({ x, z: 30.4, yaw: Math.PI, y: F + 0.02, id: null });
    for (const z of [20.5, 25.5]) this.garageSlots.push({ x: -75.6, z, yaw: Math.PI / 2, y: F + 0.02, id: null });
    this.garageSlots.forEach((s, i) => {
      const along = Math.abs(Math.sin(s.yaw)) > 0.5;
      bb.cbox(s.x - (along ? 1.3 : 0.55), F + 0.006, s.z - (along ? 0.55 : 1.3), s.x + (along ? 1.3 : 0.55), F + 0.02, s.z + (along ? 0.55 : 1.3), '#1c1d20', 'matte');
      this.act(bb, `garage-slot-${i}`, s.x, F, s.z, 1.5, () => (s.id ? `Prendre la ${bikeName(BIKE_BY_ID[s.id])}` : null), () => {
        if (s.id) this.host?.takeBike(s.id, s.x, s.z, s.yaw);
      });
    });
    // coin salon
    bb.sofa(-50.1, 20, F, -Math.PI / 2, 2.1, '#3b4250');
    bb.table(-52.1, 20, F, 0.6, 1.1, 0.42, '#2b2b2b', '#111');
    bb.cbox(-56.2, F, 19.2, -55.8, F + 0.5, 20.8, '#2a2c30', 'matte', { walkable: false });
    this.tvSet(bb, 'garage', -56.0, F + 1.0, 20, Math.PI / 2, 1.2);
    this.seat(bb, 'garage-sofa', -50.25, F, 20, -Math.PI / 2, 0.43);
    bb.tires(-50.3, 33.8, F, 6);
    bb.tires(-51.3, 33.8, F, 4);
    this.posters(bb, -60, F + 2.2, z1 - 0.17, Math.PI, 'p-garage1', ['BIKE LIFE', 'Lève la roue,', 'pas les problèmes.', '', 'Street Kings'], '#14161a', '#ffcc33');
    this.posters(bb, -78.83, F + 2.2, 30.0, Math.PI / 2, 'p-garage2', ['WHEELIE', 'KING', '', 'Boulevard', '00:00'], '#1a0f14', '#ff2bd6');
    this.lightSwitch(bb, -61.4, F, 15.35);
    for (const x of [-74, -64, -54]) for (const z of [21, 29]) bb.light(x, F + H - 0.02, z, 1.4, 0.35);
    bb.finish();
  }

  /** Reconstruit les motos exposées dans le garage. */
  private refreshGarage(bb: Building): void {
    const owned = this.host?.ownedDisplay() ?? [];
    for (const c of [...bb.dynamic.children]) if (c.userData.bike) {
      bb.dynamic.remove(c);
      c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    this.garageSlots.forEach((s, i) => {
      const o = owned[i];
      s.id = o ? o.id : null;
      if (!o) return;
      const spec = BIKE_BY_ID[o.id];
      const g = displayBike(spec, o.cfg);
      this.placeBike(g, spec, s);
      bb.dynamic.add(g);
    });
  }

  private placeBike(g: THREE.Group, spec: BikeSpec, s: Slot): void {
    const L = spec.wheelbase;
    g.position.set(s.x - Math.sin(s.yaw) * L / 2, s.y, s.z - Math.cos(s.yaw) * L / 2);
    g.rotation.y = s.yaw;
    g.userData.bike = true;
  }

  markGarageDirty(): void {
    this.garageDirty = true;
  }

  // ---------------------------------------------------------------- atelier
  private atelier(): void {
    const x0 = -43, x1 = -17, z0 = 15, z1 = 37, H = 5.5;
    const bb = this.newB('atelier', 'Atelier moto', x0, z0, x1, z1, F + H, true);
    this.shell(bb, x0, z0, x1, z1, H, 'plaster', 'brick', {
      n: [{ a0: -36, a1: -29, y0: F, y1: F + 4.2 }, { a0: -27, a1: -19, y0: F + 1.0, y1: F + 3.4, glass: true }],
      w: [{ a0: 24, a1: 30, y0: F + 2.4, y1: F + 3.8, glass: true }],
    });
    bb.floor('concrete', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 3);
    bb.sign('ATELIER MOTO', -32.5, F + 4.85, z0 - 0.17, 7.5, 0.9, Math.PI, '#141414', '#ffffff', '#e1121b');
    this.door(bb, { id: 'atelier-main', kind: 'rollup', axis: 'x', a0: -36, a1: -29, c: z0, y0: F, h: 4.2, inSide: 1, bikeOk: true, name: 'le rideau de l’atelier', color: '#b8bcc0' }, true);
    // accueil
    bb.counter(-25, 19.6, -19, 20.4, F, 1.05, '#2d3640', '#cfd2d6');
    bb.cbox(-21.5, F + 1.05, 19.8, -20.8, F + 1.4, 20.2, '#111', 'gloss');
    this.npc(bb, {
      id: 'meca', name: 'Momo (mécanicien)', x: -22, y: F, z: 21.2, yaw: Math.PI, pose: 'counter', counterH: F + 1.05 - F,
      look: { skin: '#a0683f', helmetColor: '#121212', topColor: '#1d2b44', pantsColor: '#2b2f36', shoesColor: '#3a2f25', gloves: '#3a3a3a' },
      lines: [
        'Amène ta moto dans l’atelier et je te la remets à neuf.',
        'Une moto abîmée perd de la puissance. Ne roule pas trop longtemps comme ça.',
        'Les pneus crampons, c’est pour la terre. Sur le bitume, prends du mixte ou de la route.',
        'Un pignon plus court, c’est des wheelings plus faciles… et moins de vitesse de pointe.',
      ],
    });
    this.act(bb, 'atelier-desk', -22, F, 18.8, 2.0, () => 'Mécanicien : réparer / entretenir la moto', () => this.host?.workshop('atelier'), 'both');
    bb.board('tarifs', ['TARIFS ATELIER', 'Réparation : selon l’état', 'Pneus — moteur — suspensions', 'Échappements — transmission', 'Ouvert 7j/7'], -17.17, F + 2.1, 22.5, 1.6, 1.0, -Math.PI / 2, '#1b1d22', '#f4f4f4', '#ffd166');
    // ponts élévateurs (un avec une moto client)
    bb.lift(-39, 25.5, 28.3, F);
    bb.lift(-26, 27.5, 30.3, F);
    const client = BIKE_BY_ID['hin-hr250'] ?? BIKES[0];
    const cb = displayBike(client, { ...defaultConfig(client), plateNumber: '41' });
    this.placeBike(cb, client, { x: -39, z: 26.9, yaw: 0, y: F + 0.6, id: null });
    cb.userData.bike = false;
    bb.b.group.add(cb);
    // outillage, pièces, pneus
    bb.toolChest(-40.5, 36.35, F);
    bb.toolChest(-39.6, 36.35, F, '#1f4fd1');
    bb.toolWall(-36, -29, 36.84, F, -1, 4);
    bb.shelf(-27.5, 36.0, -18, 36.75, F, 2.3, 4, 31, true, '#9aa1a8');
    bb.tires(-41.9, 33.3, F, 5);
    bb.tires(-41.9, 32.1, F, 4);
    bb.tires(-41.9, 30.9, F, 6);
    bb.cbox(-31, F, 31, -30, F + 0.95, 32, '#c0392b', 'gloss', { walkable: false });
    bb.chcyl(-30.5, F + 1.1, 31.5, 0.3, 0.1, 'x', '#c8ccd1', 'metal');
    bb.barrel(-18, 31, F, '#1f4fd1');
    bb.barrel(-18, 32.2, F, '#13a35b');
    bb.barrel(-18.9, 31.6, F, '#c0392b');
    bb.chcyl(-41.6, F + 0.45, 21.5, 0.35, 1.4, 'z', '#c0392b', 'gloss');
    this.lightSwitch(bb, -28.4, F, 15.35);
    for (const x of [-38, -30, -22]) for (const z of [22, 31]) bb.light(x, F + H - 0.02, z, 1.6, 0.35);
    bb.finish();
  }

  // ---------------------------------------------------------------- concession
  private concession(): void {
    const x0 = -79, x1 = -43, z0 = 49, z1 = 79, H = 6;
    const bb = this.newB('concession', 'Concession moto', x0, z0, x1, z1, F + H, false);
    this.shell(bb, x0, z0, x1, z1, H, 'plaster', 'renderDark', {
      n: [{ a0: -78, a1: -63.4, y0: F + 0.3, y1: F + 4.6, glass: true }, { a0: -62.4, a1: -59.6, y0: F, y1: F + 2.8 }, { a0: -58.6, a1: -44, y0: F + 0.3, y1: F + 4.6, glass: true }],
      w: [{ a0: 51, a1: 77, y0: F + 0.3, y1: F + 4.6, glass: true }],
    });
    bb.floor('tile', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 1.2);
    bb.sign('CONCESSION MOTO', -61, F + 5.35, z0 - 0.17, 11, 1.0, Math.PI, '#0e1116', '#ffffff', '#22b8ff');
    bb.sign('CONCESSION', x0 - 0.17, F + 5.35, 64, 8, 1.0, -Math.PI / 2, '#0e1116', '#ffffff', '#22b8ff');
    this.door(bb, { id: 'concession-main', kind: 'slide', axis: 'x', a0: -62.4, a1: -59.6, c: z0, y0: F, h: 2.8, inSide: 1, auto: true, glass: true, name: 'la porte' });
    // podiums d'exposition
    const pod = (x: number, z: number) => {
      bb.ccyl(x, F, z, 1.45, 0.12, '#d7dade', 'gloss', 28, false);
      bb.ccyl(x, F + 0.12, z, 1.42, 0.01, '#22b8ff', 'glow', 28);
      this.kit.world.addCylinder({ x, z, r: 1.45, y0: F, y1: F + 0.12, surf: 'concrete' });
      const s: Slot = { x, z, yaw: Math.PI * 0.85, y: F + 0.12, id: null };
      this.showSlots.push(s);
      this.act(bb, `show-${this.showSlots.length}`, x, F, z, 2.0, () => {
        if (!s.id) return null;
        const sp = BIKE_BY_ID[s.id];
        const own = this.host?.ownsBike(s.id);
        return `${bikeName(sp)} — ${own ? 'déjà dans ton garage' : sp.price ? sp.price.toLocaleString('fr-FR') + ' $' : 'offerte'}`;
      }, () => {
        if (s.id) this.host?.bikeForSale(s.id);
      });
    };
    for (const x of [-74, -67.5, -54.5, -48]) pod(x, 55.6);
    for (const x of [-74, -67.5, -61, -54.5, -48]) pod(x, 66.2);
    // borne de rayon
    bb.cbox(-57.4, F, 51.2, -56.8, F + 1.4, 51.8, '#1c1f24', 'gloss', { walkable: false });
    bb.cbox(-57.45, F + 0.9, 51.81, -56.75, F + 1.35, 51.83, '#22b8ff', 'glow');
    this.act(bb, 'show-cat', -57.1, F, 52.4, 1.6, () => {
      const cat = SHOW_CATS[this.showCat];
      const list = this.catList();
      const pages = Math.max(1, Math.ceil(list.length / this.showSlots.length));
      return `Rayon : ${cat.label} (${this.showPage + 1}/${pages}) — changer`;
    }, () => {
      const list = this.catList();
      const pages = Math.max(1, Math.ceil(list.length / this.showSlots.length));
      if (this.showPage + 1 < pages) this.showPage++;
      else {
        this.showPage = 0;
        this.showCat = (this.showCat + 1) % SHOW_CATS.length;
      }
      this.showDirty = true;
    });
    // comptoir vendeur
    bb.counter(-66, 74.6, -56, 75.6, F, 1.05, '#1c1f24', '#e8e6e1');
    bb.cbox(-62, F + 1.05, 74.9, -61.2, F + 1.5, 75.3, '#0d0e10', 'gloss');
    this.npc(bb, {
      id: 'vendeur', name: 'Sarah (vendeuse)', x: -61, y: F, z: 76.5, yaw: Math.PI, pose: 'counter', counterH: 1.05,
      look: { skin: '#e0ac85', helmetColor: '#4a2a14', topColor: '#0e1116', top: 'windbreaker', pantsColor: '#1a1a1a', shoesColor: '#f4f4f4' },
      lines: [
        'Bienvenue ! Toutes nos motos sont exposées par rayon : utilise la borne à l’entrée.',
        'Tu peux essayer une moto 90 secondes avant de l’acheter.',
        'Les 2 temps sont légers et vifs, les 4 temps ont plus de couple en bas.',
        'Une 85 cm³ est parfaite pour apprendre le wheeling.',
      ],
    });
    this.act(bb, 'concession-desk', -61, F, 73.4, 1.8, () => 'Vendeuse : catalogue complet et configurateur', () => this.host?.openGarageUI('shop'));
    // salon d'attente
    bb.sofa(-77.4, 72.5, F, Math.PI / 2, 2.1, '#2a3340');
    bb.table(-75.6, 72.5, F, 0.6, 1.0, 0.42, '#d9d4c7', '#222');
    this.seat(bb, 'concession-sofa', -77.25, F, 72.5, Math.PI / 2, 0.43);
    bb.plant(-78.2, 76.5, F);
    bb.plant(-44, 50.6, F);
    bb.board('conc1', ['GAMME 2025', 'Motocross 2T & 4T', 'Supermotards', 'Scooters 50 / 125', 'Préparations stunt'], -43.17, F + 2.4, 70, 2.2, 1.5, -Math.PI / 2, '#0e1116', '#f4f4f4', '#22b8ff');
    bb.board('conc2', ['ESSAI GRATUIT', '90 secondes', 'sur le parc d’essai', '', 'Demande au vendeur'], -43.17, F + 2.4, 58, 2.2, 1.5, -Math.PI / 2, '#0e1116', '#f4f4f4', '#ffcc33');
    for (const x of [-72, -61, -50]) for (const z of [55, 66, 74]) bb.light(x, F + H - 0.02, z, 1.6, 0.4);
    bb.finish();
  }

  private catList(): BikeSpec[] {
    const c = SHOW_CATS[this.showCat];
    return BIKES.filter((b) => c.cls.includes(b.cls));
  }

  private refreshShowroom(bb: Building): void {
    for (const c of [...bb.dynamic.children]) if (c.userData.bike) {
      bb.dynamic.remove(c);
      c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    const list = this.catList();
    const n = this.showSlots.length;
    this.showSlots.forEach((s, i) => {
      const spec = list[this.showPage * n + i];
      s.id = spec ? spec.id : null;
      if (!spec) return;
      const g = displayBike(spec, defaultConfig(spec));
      this.placeBike(g, spec, s);
      bb.dynamic.add(g);
    });
  }

  // ---------------------------------------------------------------- équipement
  private gearShop(): void {
    const x0 = -35, x1 = -15, z0 = 51, z1 = 75, H = 4.4;
    const bb = this.newB('equipement', 'MX Gear (équipement)', x0, z0, x1, z1, F + H, false);
    this.shell(bb, x0, z0, x1, z1, H, 'plasterDark', 'render', {
      e: [{ a0: 52.5, a1: 61, y0: F + 0.5, y1: F + 3.2, glass: true }, { a0: 62, a1: 64, y0: F, y1: F + 2.6 }, { a0: 65, a1: 73.5, y0: F + 0.5, y1: F + 3.2, glass: true }],
    });
    bb.floor('wood', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 2);
    bb.sign('MX GEAR', x1 + 0.17, F + 3.75, 63, 5.5, 0.9, Math.PI / 2, '#0b0b0b', '#ffffff', '#ff6a00');
    this.door(bb, { id: 'gear-main', kind: 'slide', axis: 'z', a0: 62, a1: 64, c: x1, y0: F, h: 2.6, inSide: -1, auto: true, glass: true, name: 'la porte' });
    const r = rng(77);
    // mur des casques
    for (let lv = 0; lv < 3; lv++) {
      const y = F + 0.95 + lv * 0.55;
      bb.cbox(x0 + 0.15, y - 0.03, 53, x0 + 0.6, y, 73, '#c8ccd1', 'metal');
      for (let z = 53.4; z < 72.8; z += 0.62) {
        const col = `hsl(${Math.floor(r() * 360)}, 70%, ${40 + r() * 25}%)`;
        bb.csphere(x0 + 0.38, y + 0.17, z, 0.15, col, 'gloss', 1, 1, 1.1);
        bb.csphere(x0 + 0.48, y + 0.08, z, 0.08, col, 'gloss', 1, 0.8, 1.2);
      }
    }
    this.act(bb, 'gear-helmets', x0 + 1.5, F, 63, 2.6, () => 'Casques : essayer / acheter', () => this.host?.apparel('helmet'));
    // présentoir masques
    bb.table(-30, 55.5, F, 1.6, 0.8, 0.9, '#2b2b2b', '#111');
    for (let i = 0; i < 6; i++) bb.cbox(-30.7 + i * 0.25, F + 0.9, 55.35, -30.52 + i * 0.25, F + 0.98, 55.65, `hsl(${i * 60}, 80%, 55%)`, 'gloss');
    this.act(bb, 'gear-goggles', -30, F, 56.6, 1.6, () => 'Masques et lunettes', () => this.host?.apparel('eyewear'));
    // portants de vêtements
    const rack = (x: number, za: number, zb: number, seed: number) => {
      bb.chcyl(x, F + 1.55, (za + zb) / 2, 0.02, zb - za, 'z', '#c8ccd1', 'metal');
      for (const z of [za, zb]) bb.ccyl(x, F, z, 0.03, 1.55, '#c8ccd1', 'metal', 6);
      const rr = rng(seed);
      for (let z = za + 0.15; z < zb - 0.1; z += 0.13) {
        bb.cbox(x - 0.25, F + 0.75, z - 0.02, x + 0.25, F + 1.5, z + 0.02, `hsl(${Math.floor(rr() * 360)}, ${50 + rr() * 40}%, ${30 + rr() * 30}%)`, 'fabric');
      }
      bb.col(x - 0.3, za, x + 0.3, zb, F, F + 1.6, { walkable: false });
    };
    rack(-27.5, 58, 62, 3);
    rack(-27.5, 65, 69, 4);
    this.act(bb, 'gear-tops', -26.4, F, 60, 1.6, () => 'Maillots, hoodies et vestes', () => this.host?.apparel('top'));
    this.act(bb, 'gear-pants', -26.4, F, 67, 1.6, () => 'Pantalons', () => this.host?.apparel('pants'));
    // bottes
    bb.shelf(-33, 51.2, -24, 51.75, F, 1.2, 2, 9, true, '#3a3d42');
    for (let x = -32.6; x < -24.3; x += 0.6) {
      const col = `hsl(${Math.floor(r() * 360)}, 50%, ${30 + r() * 40}%)`;
      bb.cbox(x, F + 0.2, 51.3, x + 0.12, F + 0.55, 51.6, col, 'gloss');
      bb.cbox(x + 0.16, F + 0.2, 51.3, x + 0.28, F + 0.55, 51.6, col, 'gloss');
    }
    this.act(bb, 'gear-boots', -28.5, F, 52.6, 1.8, () => 'Bottes et sneakers', () => this.host?.apparel('shoes'));
    // sacs
    for (let i = 0; i < 5; i++) bb.cbox(-32 + i * 1.1, F + 1.4, z1 - 0.45, -31.4 + i * 1.1, F + 1.95, z1 - 0.2, `hsl(${i * 70}, 40%, 30%)`, 'fabric');
    this.act(bb, 'gear-bags', -29.8, F, z1 - 1.3, 1.6, () => 'Sacs à dos', () => this.host?.apparel('backpack'));
    // caisse
    bb.counter(-21, 70.5, -16.5, 71.4, F, 1.05, '#ff6a00', '#1a1a1a');
    this.npc(bb, {
      id: 'gear', name: 'Inès (MX Gear)', x: -18.7, y: F, z: 72.4, yaw: Math.PI, pose: 'counter', counterH: 1.05,
      look: { skin: '#7a4b2a', helmetColor: '#141414', topColor: '#ff6a00', top: 'hoodie', pantsColor: '#151515', shoesColor: '#f4f4f4' },
      lines: [
        'Le casque cross avec masque, c’est le plus léger pour rouler.',
        'Les couleurs et motifs se règlent dans la cabine : demande-moi.',
        'Les bottes MX protègent les chevilles, les sneakers c’est pour le style.',
      ],
    });
    this.act(bb, 'gear-desk', -18.7, F, 69.6, 1.6, () => 'Cabine : couleurs, motifs et numéro', () => this.host?.openGarageUI('rider'));
    bb.plant(-16, 52, F);
    for (const x of [-30, -21]) for (const z of [57, 69]) bb.light(x, F + H - 0.02, z, 1.4, 0.35, '#fff1dd');
    bb.finish();
  }

  // ---------------------------------------------------------------- station-service
  private station(): void {
    const bb = this.newB('station', 'Station-service', -250, -37, -220, -21, F + 6, true);
    // auvent + piliers
    bb.cbox(-250, F + 5.2, -37, -220, F + 5.7, -21, '#e9ecef', 'matte');
    bb.cbox(-250.05, F + 5.25, -37.05, -219.95, F + 5.6, -36.95, '#e1121b', 'glow');
    bb.cbox(-250.05, F + 5.25, -21.05, -219.95, F + 5.6, -20.95, '#e1121b', 'glow');
    for (const x of [-246, -224]) for (const z of [-33, -25]) bb.cbox(x - 0.25, F, z - 0.25, x + 0.25, F + 5.2, z + 0.25, '#c8ccd1', 'metal', true);
    for (const x of [-244, -236, -228]) for (const z of [-31, -27]) bb.light(x, F + 5.18, z, 2.2, 0.5, '#ffffff', x === -236);
    // îlots + pompes
    for (const ix of [-240, -230]) {
      bb.cbox(ix - 0.6, F, -32.5, ix + 0.6, F + 0.2, -25.5, '#c8ccd1', 'matte', true);
      for (const pz of [-30.6, -27.4]) {
        bb.cbox(ix - 0.35, F + 0.2, pz - 0.25, ix + 0.35, F + 1.9, pz + 0.25, '#f4f4f4', 'gloss', { walkable: false });
        bb.cbox(ix - 0.3, F + 1.3, pz - 0.26, ix + 0.3, F + 1.7, pz - 0.25, '#0d0e10', 'gloss');
        bb.cbox(ix - 0.3, F + 1.3, pz + 0.25, ix + 0.3, F + 1.7, pz + 0.26, '#0d0e10', 'gloss');
        bb.cbox(ix - 0.36, F + 1.75, pz - 0.27, ix + 0.36, F + 1.9, pz + 0.27, '#e1121b', 'gloss');
        for (const side of [-1, 1]) {
          this.act(bb, `pump:${ix}:${pz}:${side}`, ix + side * 1.8, F, pz, 2.3, () => this.host?.refuelLabel() ?? null, () => this.host?.refuel(), 'both');
        }
      }
    }
    // totem de prix
    bb.cbox(-256.2, F, -17.8, -255.8, F + 3.2, -17.4, '#3a3d42', 'metal', true);
    bb.board('station-prix', ['STATION 24/7', 'SP98 ......... 1,95 $/L', 'Mélange 2T ... 2,10 $/L', 'Supérette • Café', 'Jerricans 5 L'], -256, F + 4.0, -17.25, 2.6, 1.7, 0, '#121417', '#f4f4f4', '#e1121b');
    bb.finish();
  }

  private superette(): void {
    const x0 = -253, x1 = -221, z0 = -66, z1 = -46, H = 4.5;
    const bb = this.newB('superette', 'Supérette 24/7', x0, z0, x1, z1, F + H, false);
    this.shell(bb, x0, z0, x1, z1, H, 'plaster', 'render', {
      s: [{ a0: -251, a1: -240, y0: F + 0.5, y1: F + 3.0, glass: true }, { a0: -238.4, a1: -235.6, y0: F, y1: F + 2.6 }, { a0: -234, a1: -223, y0: F + 0.5, y1: F + 3.0, glass: true }],
    });
    bb.floor('tile', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 1.2);
    bb.sign('SUPÉRETTE 24/7', -237, F + 3.8, z1 + 0.17, 8, 0.9, 0, '#0f5132', '#ffffff', '#ffcc33');
    this.door(bb, { id: 'superette-main', kind: 'slide', axis: 'x', a0: -238.4, a1: -235.6, c: z1, y0: F, h: 2.6, inSide: -1, auto: true, glass: true, name: 'la porte' });
    let seed = 40;
    for (const [sx0, sx1] of [[-250, -239.5], [-233, -224]]) for (const sz of [-58.5, -54]) {
      bb.shelf(sx0, sz, sx1, sz + 0.8, F, 1.75, 4, seed++, true);
      this.act(bb, `sup-shelf-${seed}`, (sx0 + sx1) / 2, F, sz + 1.6, 2.2, () => 'Rayons : faire les courses', () => this.host?.shop('superette'));
    }
    // frigos vitrés
    bb.cbox(-251, F, -65.85, -236, F + 2.1, -65.05, '#d9dde2', 'gloss', { walkable: false });
    bb.cbox(-250.9, F + 0.1, -65.06, -236.1, F + 2.0, -65.0, '#e6f4ff', 'glow');
    const rr = rng(9);
    for (let x = -250.7; x < -236.3; x += 0.16) for (let lv = 0; lv < 4; lv++) {
      bb.ccyl(x, F + 0.2 + lv * 0.45, -65.3, 0.035, 0.26, `hsl(${Math.floor(rr() * 360)}, 75%, 50%)`, 'gloss', 6);
    }
    this.act(bb, 'sup-fridge', -243.5, F, -63.8, 2.6, () => 'Boissons fraîches', () => this.host?.shop('superette'));
    // caisse
    bb.counter(-232, -49.6, -226, -48.7, F, 1.0, '#2d6a4f', '#e9ecef');
    bb.cbox(-230, F + 1.0, -49.4, -229.3, F + 1.3, -48.9, '#111', 'gloss');
    bb.shelf(-232, -51.2, -226, -50.9, F, 1.6, 3, 99, true, '#2d6a4f');
    this.npc(bb, {
      id: 'caissier', name: 'Karim (caissier)', x: -229, y: F, z: -50.3, yaw: 0, pose: 'counter', counterH: 1.0,
      look: { skin: '#c68b62', helmetColor: '#0d0d0d', topColor: '#2d6a4f', pantsColor: '#202020', shoesColor: '#ececec' },
      lines: [
        'Salut ! Les jerricans sont au fond, à côté des huiles.',
        'La boisson énergisante te permet de courir plus longtemps.',
        'Le kit de réparation remet ta moto en état, même loin de l’atelier.',
      ],
    });
    this.act(bb, 'sup-desk', -229, F, -47.9, 1.6, () => 'Caisse : acheter', () => this.host?.shop('superette'));
    bb.plant(-252.3, -46.8, F, 0.8);
    for (const x of [-247, -237, -227]) for (const z of [-61, -52]) bb.light(x, F + H - 0.02, z, 1.6, 0.35, '#f4fbff');
    bb.finish();
  }

  // ---------------------------------------------------------------- fast-food
  private fastfood(): void {
    const x0 = -213, x1 = -193, z0 = -58, z1 = -30, H = 4.6;
    const bb = this.newB('fastfood', 'Burger Street', x0, z0, x1, z1, F + H, false);
    this.shell(bb, x0, z0, x1, z1, H, 'plasterWarm', 'brick', {
      s: [{ a0: -212, a1: -205.2, y0: F + 0.7, y1: F + 3.1, glass: true }, { a0: -204.2, a1: -201.8, y0: F, y1: F + 2.5 }, { a0: -200.8, a1: -194, y0: F + 0.7, y1: F + 3.1, glass: true }],
    });
    bb.floor('darkTile', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 1.2);
    bb.sign('BURGER STREET', -203, F + 3.9, z1 + 0.17, 8.5, 1.0, 0, '#b3121b', '#ffffff', '#ffcc33');
    this.door(bb, { id: 'fastfood-main', kind: 'swing', axis: 'x', a0: -204.2, a1: -201.8, c: z1, y0: F, h: 2.5, inSide: -1, glass: true, name: 'la porte' });
    // comptoir + cuisine
    bb.counter(-211, -47.2, -197, -46.3, F, 1.05, '#b3121b', '#e9ecef');
    for (const x of [-208, -203]) bb.cbox(x, F + 1.05, -47.0, x + 0.6, F + 1.35, -46.6, '#111', 'gloss');
    bb.board('menu', ['MENU', 'Burger Street ......... 8 $', 'Menu Wheelie .......... 12 $', 'Wrap poulet ........... 7 $', 'Milkshake ............. 4 $'], -204, F + 3.0, -49.3, 5, 1.4, 0, '#121212', '#f4f4f4', '#ffcc33');
    bb.cbox(-211.8, F, -57.85, -195, F + 0.95, -56.9, '#c8ccd1', 'metal', { walkable: false });
    bb.cbox(-209, F + 0.95, -57.8, -206, F + 1.0, -56.95, '#1a1a1a', 'metal');
    bb.cbox(-205, F + 0.6, -57.8, -203.6, F + 0.98, -56.95, '#e8c547', 'gloss');
    bb.cbox(-210, F + 2.2, -57.85, -202, F + 2.8, -56.6, '#c8ccd1', 'metal');
    bb.cbox(-198.6, F, -57.85, -197.4, F + 2.0, -56.95, '#e9ecef', 'gloss', { walkable: false });
    bb.cbox(-212.85, F, -52, -212.1, F + 2.6, -49.5, '#c8ccd1', 'metal', { walkable: false });
    this.npc(bb, {
      id: 'burger', name: 'Lina (Burger Street)', x: -204, y: F, z: -47.9, yaw: 0, pose: 'counter', counterH: 1.05,
      look: { skin: '#f1c9a5', helmetColor: '#6b3a1f', topColor: '#b3121b', pantsColor: '#151515', shoesColor: '#151515' },
      lines: ['Bonjour ! Le Menu Wheelie te remet complètement d’aplomb après une chute.', 'On est ouverts toute la nuit.'],
    });
    this.npc(bb, {
      id: 'cuisto', name: 'Yann (cuisinier)', x: -207.5, y: F, z: -56.2, yaw: Math.PI, pose: 'counter', counterH: 0.95,
      look: { skin: '#a0683f', helmetColor: '#efefef', topColor: '#f4f4f4', pantsColor: '#2b2b2b', shoesColor: '#111' },
      lines: ['Je suis en plein coup de feu !', 'Commande au comptoir, c’est prêt dans une minute.'],
    }, true);
    this.act(bb, 'burger-desk', -204, F, -45.4, 1.7, () => 'Commander', () => this.host?.shop('fastfood'));
    // salle
    let i = 0;
    for (const x of [-209, -198]) for (const z of [-42, -36]) {
      bb.table(x, z, F, 1.2, 0.8, 0.75, '#e9ecef', '#2b2b2b');
      for (const s of [-1, 1]) {
        bb.chair(x + s * 0.95, z, F, s > 0 ? -Math.PI / 2 : Math.PI / 2, '#b3121b');
        this.seat(bb, `ff-${i++}`, x + s * 0.95, F, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0.47);
      }
    }
    bb.plant(-212.3, -30.9, F, 0.8);
    for (const x of [-208, -198]) for (const z of [-52, -42, -35]) bb.light(x, F + H - 0.02, z, 1.4, 0.35, '#fff3dd');
    bb.finish();
  }

  // ---------------------------------------------------------------- immeuble
  private immeuble(): void {
    const x0 = -341, x1 = -301, z0 = 25, z1 = 39;
    const FH = 3.2;
    const L = [0, 1, 2, 3, 4].map((k) => F + FH * k);
    const top = L[4];
    const bb = this.newB('immeuble', 'Résidence Les Tilleuls', x0, z0, x1, z1, top + 3, false, L.slice(0, 4).concat([top]));
    const t = 0.3;
    // façades : fenêtres alignées par colonnes sur 4 niveaux, entrée au rez-de-chaussée
    const winCols = [[-339, -336.5], [-333, -330.5], [-328.5, -326.5], [-317, -314.5], [-311, -308.5], [-305, -302.5]];
    const north: any[] = [];
    const south: any[] = [];
    for (let k = 0; k < 4; k++) {
      for (const [a0, a1] of winCols) north.push({ a0, a1, y0: L[k] + 0.9, y1: L[k] + 2.3, glass: true });
      if (k === 0) north.push({ a0: -322, a1: -320, y0: F, y1: F + 2.4 });
      for (const [a0, a1] of [[-339, -336.5], [-333, -330.5], [-313, -310.5], [-306, -303.5]]) south.push({ a0, a1, y0: L[k] + 0.9, y1: L[k] + 2.3, glass: true });
    }
    bb.wallX(z0, x0, x1, F, top + 1.1, t, north, 'plaster', 'render', 1);
    bb.wallX(z1, x0, x1, F, top + 1.1, t, south, 'plaster', 'render', -1);
    bb.wallZ(x0, z0 + t / 2, z1 - t / 2, F, top + 1.1, t, [], 'plaster', 'render', 1);
    bb.wallZ(x1, z0 + t / 2, z1 - t / 2, F, top + 1.1, t, [], 'plaster', 'render', -1);
    bb.sign('RÉSIDENCE LES TILLEULS', -321, F + 2.85, z0 - 0.17, 5.5, 0.55, Math.PI, '#1d2b44', '#ffffff', '#ffd166');
    this.door(bb, { id: 'imm-entree', kind: 'swing', axis: 'x', a0: -322, a1: -320, c: z0, y0: F, h: 2.4, inSide: 1, glass: true, name: 'la porte du hall' });
    const ix0 = x0 + t / 2, ix1 = x1 - t / 2, iz0 = z0 + t / 2, iz1 = z1 - t / 2;
    // escalier : volées alternées (bande A au nord, bande B au sud)
    const bandA = [33.75, 36.1], bandB = [36.3, 38.7];
    const sx0 = -325, sx1 = -317;
    for (let k = 0; k < 4; k++) {
      const band = k % 2 === 0 ? bandA : bandB;
      if (k % 2 === 0) bb.stairs('x', sx0, sx1, band[0], band[1], L[k], L[k + 1], '#a19d94');
      else bb.stairs('x', sx1, sx0, band[0], band[1], L[k], L[k + 1], '#a19d94');
    }
    bb.floor('tile', ix0, iz0, ix1, iz1, F + 0.006, 1.2);
    for (let k = 1; k <= 4; k++) {
      const hole = (k - 1) % 2 === 0 ? bandA : bandB;
      bb.slabHoles(ix0, iz0, ix1, iz1, L[k], 0.25, [{ x0: sx0, z0: hole[0], x1: sx1, z1: hole[1] }], k === 4 ? 'roof' : 'wood');
    }
    // cage d'escalier sur le toit
    bb.wallX(33.6, -326.2, -315.8, top, top + 2.6, 0.2, [{ a0: -326.2 + 0.01, a1: -325, y0: top, y1: top + 2.2 }], 'plaster', 'render', 1);
    bb.wallZ(-326.2, 33.7, 38.7, top, top + 2.6, 0.2, [], 'plaster', 'render', 1);
    bb.wallZ(-315.8, 33.7, 38.7, top, top + 2.6, 0.2, [], 'plaster', 'render', -1);
    bb.slab(-326.4, 33.4, -315.6, iz1, top + 2.8, 0.2, 'roof');
    // séparation entre les deux volées + garde-corps des trémies
    for (let k = 0; k <= 4; k++) {
      const y = L[k];
      if (k < 4) bb.railing(sx0, 36.2, sx1, 36.2, y, 1.0);
      if (k < 4) bb.railing(sx0, 33.66, sx1, 33.66, y, 1.0);
      if (k >= 1) {
        const holeA = (k - 1) % 2 === 0;
        if (holeA) bb.railing(sx0, 33.75, sx0, 36.1, y, 1.0);
        else bb.railing(sx1, 36.3, sx1, 38.7, y, 1.0);
      }
    }
    // niveaux : couloir, appartements
    for (let k = 0; k < 4; k++) {
      const y = L[k];
      const ch = L[k + 1] - 0.25;
      const lvl = k === 0 ? 'RDC' : `${k}e`;
      // mur nord du couloir (z = 30.5) avec portes A / B (au RDC : hall ouvert entre -326 et -316)
      const nHoles = [{ a0: -331.5, a1: -330.5, y0: y, y1: y + 2.1 }, { a0: -311.5, a1: -310.5, y0: y, y1: y + 2.1 }];
      if (k === 0) {
        bb.wallX(30.5, ix0, -326, y, ch, 0.15, [nHoles[0]], 'plaster', 'plasterWarm', -1);
        bb.wallX(30.5, -316, ix1, y, ch, 0.15, [nHoles[1]], 'plaster', 'plasterWarm', -1);
        bb.wallZ(-326, iz0, 30.5, y, ch, 0.15, [], 'plasterWarm', 'plaster', 1);
        bb.wallZ(-316, iz0, 30.5, y, ch, 0.15, [], 'plasterWarm', 'plaster', -1);
      } else {
        bb.wallX(30.5, ix0, ix1, y, ch, 0.15, nHoles, 'plaster', 'plasterWarm', -1);
        bb.wallZ(-321, iz0, 30.43, y, ch, 0.15, [], 'plasterWarm', 'plasterWarm', 1);
      }
      // mur sud du couloir (z = 33.6) : portes C / D, cage d'escalier ouverte
      bb.wallX(33.6, ix0, -326.2, y, ch, 0.15, [{ a0: -331, a1: -330, y0: y, y1: y + 2.1 }], 'plaster', 'plasterWarm', 1);
      bb.wallX(33.6, -315.8, ix1, y, ch, 0.15, [{ a0: -312, a1: -311, y0: y, y1: y + 2.1 }], 'plaster', 'plasterWarm', 1);
      bb.wallZ(-326.2, 33.67, iz1, y, ch, 0.15, [], 'plasterWarm', 'plaster', -1);
      bb.wallZ(-315.8, 33.67, iz1, y, ch, 0.15, [], 'plasterWarm', 'plaster', 1);
      // portes d'appartements
      const dA = this.door(bb, { id: `imm-${k}-A`, kind: 'swing', axis: 'x', a0: -331.5, a1: -330.5, c: 30.5, y0: y, h: 2.1, inSide: -1, name: `la porte (${lvl}, appt A)` });
      const dB = this.door(bb, { id: `imm-${k}-B`, kind: 'swing', axis: 'x', a0: -311.5, a1: -310.5, c: 30.5, y0: y, h: 2.1, inSide: -1, name: `la porte (${lvl}, appt B)` });
      const dC = this.door(bb, { id: `imm-${k}-C`, kind: 'swing', axis: 'x', a0: -331, a1: -330, c: 33.6, y0: y, h: 2.1, inSide: 1, name: `la porte (${lvl}, appt C)` });
      const dD = this.door(bb, { id: `imm-${k}-D`, kind: 'swing', axis: 'x', a0: -312, a1: -311, c: 33.6, y0: y, h: 2.1, inSide: 1, name: `la porte (${lvl}, appt D)` });
      void dA; void dB; void dC; void dD;
      // appartements meublés
      const ax1 = k === 0 ? -326 : -321;
      const bx0 = k === 0 ? -316 : -321;
      this.apartment(bb, `${k}A`, ix0, ax1 - 0.08, iz0, 30.42, -334, true, true, y, ch);
      this.apartment(bb, `${k}B`, bx0 + 0.08, ix1, iz0, 30.42, -308, false, true, y, ch);
      this.apartment(bb, `${k}C`, ix0, -326.28, 33.68, iz1, -334, true, false, y, ch);
      this.apartment(bb, `${k}D`, -315.72, ix1, 33.68, iz1, -308.5, false, false, y, ch);
      // couloir
      for (const x of [-336, -321, -306]) bb.light(x, ch - 0.01, 32.05, 1.0, 0.3, '#fff4e2');
      bb.ceil('ceiling', ix0, 30.5, ix1, 33.6, ch);
      bb.light(-321, ch - 0.01, 36.2, 1.0, 0.3, '#fff4e2');
      bb.board(`etage-${k}`, [`ÉTAGE ${lvl}`, 'A ← · → B', 'C ← · → D'], -316.6, y + 1.6, 33.52, 0.7, 0.5, Math.PI, '#1d2b44', '#ffffff', '#ffd166');
    }
    // hall : boîtes aux lettres, plante, banc
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) bb.cbox(-325.85, F + 0.9 + j * 0.3, 26 + i * 0.5, -325.6, F + 1.17 + j * 0.3, 26.45 + i * 0.5, '#c8ccd1', 'metal');
    bb.plant(-316.8, 26, F);
    bb.cbox(-319.5, F, 29.6, -317, F + 0.45, 30.2, '#7a5333', 'matte', { walkable: false });
    this.seat(bb, 'hall-banc', -318.25, F, 29.85, Math.PI, 0.45, 'S’asseoir sur le banc');
    bb.light(-321, F + FH - 0.27, 27.5, 1.2, 0.35);
    // toit : parapet déjà inclus dans les façades
    bb.board('toit', ['TOIT', 'Accès réservé', 'aux résidents'], -326.32, top + 1.6, 35.5, 0.8, 0.6, -Math.PI / 2, '#1d2b44', '#ffffff', '#ffd166');
    bb.finish();
  }

  /** Appartement meublé : séjour (TV, canapé, cuisine) + chambre (lit, armoire). */
  private apartment(bb: B, id: string, rx0: number, rx1: number, rz0: number, rz1: number, partX: number, bedLowX: boolean, extLowZ: boolean, y: number, ch: number): void {
    const r = rng(id.charCodeAt(0) * 31 + id.charCodeAt(1));
    const palette = ['#3b4250', '#5a3d5c', '#2f4f4f', '#6b4f3a', '#3d5a80'];
    const col = palette[Math.floor(r() * palette.length)];
    // cloison séjour / chambre avec passage
    const zm = (rz0 + rz1) / 2;
    bb.wallZ(partX, rz0, rz1, y, ch, 0.12, [{ a0: zm + 0.2, a1: zm + 1.2, y0: y, y1: y + 2.1 }], 'plasterWarm', 'plasterWarm', bedLowX ? 1 : -1);
    const bedX0 = bedLowX ? rx0 : partX, bedX1 = bedLowX ? partX : rx1;
    const livX0 = bedLowX ? partX : rx0, livX1 = bedLowX ? rx1 : partX;
    bb.floor('carpet', bedX0, rz0, bedX1, rz1, y + 0.012, 2);
    bb.floor('wood', livX0, rz0, livX1, rz1, y + 0.01, 2);
    // chambre
    const bedX = bedLowX ? bedX0 + 1.1 : bedX1 - 1.1;
    const bedZ = zm - 0.7;
    const bedYaw = bedLowX ? Math.PI / 2 : -Math.PI / 2;
    bb.bed(bedX, bedZ, y, bedYaw, col);
    this.seat(bb, `lit-${id}`, bedX, y, bedZ, bedYaw, 0.55, 'Dormir jusqu’au matin', true);
    const wx = bedLowX ? partX - 1.5 : partX + 0.2;
    const wz = extLowZ ? rz1 - 0.65 : rz0 + 0.05;
    bb.cbox(wx, y, wz, wx + 1.3, y + 2.0, wz + 0.6, '#d8cfc0', 'matte', { walkable: false });
    bb.cbox(bedX - 0.25, y, bedZ + 1.25, bedX + 0.25, y + 0.5, bedZ + 1.7, '#7a5333', 'matte');
    // séjour
    const tvX = bedLowX ? partX + 0.12 : partX - 0.12;
    const tvYaw = bedLowX ? Math.PI / 2 : -Math.PI / 2;
    const dir = bedLowX ? 1 : -1;
    this.tvSet(bb, id, tvX, y + 1.35, zm, tvYaw, 1.1);
    bb.cbox(tvX + dir * 0.05 - 0.25, y, zm - 0.7, tvX + dir * 0.05 + 0.25, y + 0.5, zm + 0.7, '#2a2c30', 'matte', { walkable: false });
    const sofaX = partX + dir * 3.3;
    bb.sofa(sofaX, zm, y, -tvYaw, 2.0, col);
    this.seat(bb, `sofa-${id}`, sofaX - dir * 0.15, y, zm, -tvYaw, 0.43);
    bb.table(partX + dir * 2.0, zm, y, 0.5, 0.9, 0.4, '#7a5333', '#3a2a1f');
    // cuisine le long du mur côté couloir
    const kz0 = extLowZ ? rz1 - 0.65 : rz0, kz1 = extLowZ ? rz1 : rz0 + 0.65;
    const kxa = bedLowX ? livX1 - 3.2 : livX0 + 0.1, kxb = kxa + 3.1;
    if (Math.abs(livX1 - livX0) > 5) {
      bb.counter(kxa, kz0, kxb - 0.8, kz1, y, 0.92, '#e9ecef', '#3a3d42');
      bb.cbox(kxb - 0.75, y, kz0, kxb, y + 1.85, kz1, '#d9dde2', 'gloss', { walkable: false });
      this.act(bb, `frigo-${id}`, kxb - 0.4, y, extLowZ ? kz0 - 0.6 : kz1 + 0.6, 1.2, () => 'Frigo : prendre une boisson', () => this.host?.freeDrink(`frigo-${id}`));
      const tx = bedLowX ? livX1 - 1.6 : livX0 + 1.6;
      bb.table(tx, zm + (extLowZ ? -0.6 : 0.6), y, 0.9, 0.9);
      bb.chair(tx - 0.65, zm + (extLowZ ? -0.6 : 0.6), y, Math.PI / 2, '#3a2a1f');
      bb.chair(tx + 0.65, zm + (extLowZ ? -0.6 : 0.6), y, -Math.PI / 2, '#3a2a1f');
    }
    bb.plant(bedLowX ? livX1 - 0.4 : livX0 + 0.4, extLowZ ? rz0 + 0.4 : rz1 - 0.4, y, 0.7);
    bb.light((bedX0 + bedX1) / 2, ch - 0.01, zm, 0.6, 0.6, '#fff2dc');
    bb.light((livX0 + livX1) / 2, ch - 0.01, zm, 0.8, 0.8, '#fff2dc');
  }

  // ---------------------------------------------------------------- entrepôt abandonné
  private entrepot(): void {
    const x0 = 287, x1 = 343, z0 = -71, z1 = -31, H = 9;
    const bb = this.newB('entrepot', 'Entrepôt abandonné', x0, z0, x1, z1, F + H, true, [F, F + 4]);
    const broken = (a0: number, a1: number, y0: number, y1: number) => ({ a0, a1, y0, y1 });
    bb.wallX(z1, x0, x1, F, F + H, 0.3, [broken(309, 321, F, F + 4.6), broken(290, 296, F + 5, F + 7), broken(300, 306, F + 5, F + 7), broken(324, 330, F + 5, F + 7), broken(334, 340, F + 5, F + 7)], 'rust', 'rust', -1, 3);
    bb.wallX(z0, x0, x1, F, F + H, 0.3, [broken(292, 300, F + 6, F + 8), broken(318, 326, F + 6, F + 8)], 'rust', 'rust', 1, 3);
    bb.wallZ(x0, z0 + 0.15, z1 - 0.15, F, F + H, 0.3, [broken(-50, -46, F + 1.1, F + 2.6)], 'rust', 'rust', 1, 3);
    bb.wallZ(x1, z0 + 0.15, z1 - 0.15, F, F + H, 0.3, [broken(-40, -38.9, F, F + 2.2)], 'rust', 'rust', -1, 3);
    this.door(bb, { id: 'entrepot-side', kind: 'swing', axis: 'z', a0: -40, a1: -38.9, c: x1, y0: F, h: 2.2, inSide: -1, name: 'la porte rouillée', color: '#5b4a3a' });
    // rideau principal coincé à mi-hauteur
    bb.cbox(309, F + 4.6, z1 - 0.1, 321, F + 6.2, z1 + 0.05, '#6f6a63', 'metal');
    // toit percé
    bb.slabHoles(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, F + H + 0.3, 0.3, [{ x0: 300, z0: -60, x1: 306, z1: -54 }, { x0: 322, z0: -48, x1: 330, z1: -42 }], 'roof', 'rust');
    bb.floor('concrete', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 4);
    // mezzanine + escalier + garde-corps
    bb.slab(x0 + 0.15, z0 + 0.15, x1 - 0.15, -63, F + 4, 0.3, 'concrete', 'rust');
    bb.slab(328, -63, 331, -61, F + 4, 0.3, 'concrete', 'rust');
    bb.stairs('x', 318, 328, -62.8, -61.05, F, F + 4, '#6f6a63', 'metal');
    bb.railing(x0 + 0.2, -63, 328, -63, F + 4);
    bb.railing(331, -63, 331, -61, F + 4);
    bb.railing(328, -61, 331, -61, F + 4);
    for (const x of [292, 302, 312, 322, 332, 340]) bb.cbox(x - 0.2, F, -63.6, x + 0.2, F + 3.7, -63.2, '#5b5f66', 'metal', true);
    // décombres, palettes, épave, fûts, rampes de fortune
    bb.debris(296, -40, F, 1, 18, 2.2);
    bb.debris(336, -50, F, 2, 14, 1.8);
    bb.debris(304, -57, F, 3, 10, 1.5);
    for (let i = 0; i < 4; i++) bb.pallet(290 + i * 1.3, -35, F, 0, i % 2 ? 0.6 : 0);
    bb.pallet(338, -66.5, F + 4, 0.3, 0.8);
    bb.car(330, -37.5, F, 1.2, '#5b3a2a', true);
    for (const [x, z] of [[289, -44], [289.7, -44.6], [341, -59], [340.3, -59.6]]) bb.barrel(x, z, F, '#7a3b1f');
    bb.ramp(306, -42, 1.6, Math.PI / 2, F, [[0, 0], [1.6, 0.3], [3.0, 0.9]]);
    bb.ramp(316, -50, 2.2, -Math.PI / 2, F, [[0, 0], [3, 0.5], [6, 1.4]], 'concrete', 'concrete');
    bb.graffiti(x0 + 0.17, F + 2.4, -40, 7, Math.PI / 2, 0);
    bb.graffiti(x1 - 0.17, F + 2.6, -55, 8, -Math.PI / 2, 1);
    bb.graffiti(315, F + 6.5, z0 + 0.17, 9, 0, 2);
    bb.graffiti(300, F + 2.0, z1 - 0.17, 7, Math.PI, 3);
    bb.graffiti(320, F + 5.2, -63.17, 8, Math.PI, 0);
    // sac abandonné (trouvaille)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.3), new THREE.MeshStandardMaterial({ color: '#2b3a24', roughness: 0.9 }));
    bag.position.set(339.5, F + 4.16, -68.5);
    bag.castShadow = true;
    bb.b.dynamic.add(bag);
    this.cash = bag;
    this.act(bb, 'entrepot-cash', 339.5, F + 4, -68.5, 1.4, () => (this.host?.found('entrepot-cash') ? null : 'Sac abandonné : fouiller'), () => {
      this.host?.findCash('entrepot-cash', 750);
      bag.visible = false;
    });
    for (const x of [295, 315, 335]) bb.light(x, F + H - 0.05, -50, 1.4, 0.3, '#cfd6c8');
    bb.light(310, F + 3.65, -67, 1.2, 0.3, '#cfd6c8');
    bb.finish();
  }

  // ---------------------------------------------------------------- local Bike Life
  private local(): void {
    const x0 = 289, x1 = 325, z0 = 23, z1 = 51, H = 6;
    const bb = this.newB('local', 'Le Local (Bike Life)', x0, z0, x1, z1, F + H, true);
    this.shell(bb, x0, z0, x1, z1, H, 'plasterDark', 'siding', {
      n: [{ a0: 301, a1: 309, y0: F, y1: F + 4.2 }, { a0: 313, a1: 320, y0: F + 1.2, y1: F + 3.2, glass: true }],
    });
    bb.floor('epoxy', x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, F + 0.006, 3);
    bb.sign('LE LOCAL • BIKE LIFE', 305, F + 5.0, z0 - 0.17, 9, 0.9, Math.PI, '#0b0b0b', '#ffffff', '#ff2bd6');
    bb.graffiti(294, F + 2.3, z0 - 0.17, 7, Math.PI, 1);
    this.door(bb, { id: 'local-main', kind: 'rollup', axis: 'x', a0: 301, a1: 309, c: z0, y0: F, h: 4.2, inSide: 1, bikeOk: true, name: 'le rideau du local', color: '#3a3d42' }, true);
    // salon + sono
    bb.sofa(293.5, 40, F, 0, 2.2, '#5a3d5c');
    bb.sofa(293.5, 45.2, F, Math.PI, 2.2, '#5a3d5c');
    bb.table(293.5, 42.6, F, 1.4, 0.8, 0.42, '#2b2b2b', '#111');
    this.seat(bb, 'local-sofa1', 293.5, F, 40.15, 0, 0.43);
    for (const [x, z] of [[290.6, 48.8], [290.6, 36.4]]) {
      bb.cbox(x - 0.4, F, z - 0.4, x + 0.4, F + 1.6, z + 0.4, '#151515', 'matte', true);
      bb.chcyl(x + 0.41, F + 0.5, z, 0.25, 0.02, 'x', '#ff2bd6', 'glow');
      bb.chcyl(x + 0.41, F + 1.15, z, 0.15, 0.02, 'x', '#ff2bd6', 'glow');
    }
    this.act(bb, 'local-sono', 291.6, F, 42.6, 2.0, () => 'Sono : changer de style de musique', () => {
      const s = this.host?.cycleMusic();
      if (s) this.host?.notify(`Sono : ${s}`);
    });
    // bar + frigo
    bb.counter(301, 49.6, 310, 50.4, F, 1.05, '#2b2b2b', '#7a5333');
    bb.cbox(310.5, F, 50.1, 311.3, F + 1.85, 50.85, '#d9dde2', 'gloss', true);
    this.act(bb, 'local-fridge', 310.9, F, 49.2, 1.4, () => 'Frigo du local : prendre une boisson', () => this.host?.freeDrink('local-fridge'));
    // établi
    bb.counter(314, 50.0, 320, 50.75, F, 0.95, '#4a4f57', '#8a6a46');
    bb.toolWall(314, 320, 50.83, F, -1, 7);
    // motos des potes
    const friends = ['cus-450st', 'aoz-az125', 'kro-690smr', 'aoz-aerix70'];
    friends.forEach((id, i) => {
      const spec = BIKE_BY_ID[id];
      if (!spec) return;
      const g = displayBike(spec, { ...defaultConfig(spec), plateNumber: String(12 + i * 17) });
      this.placeBike(g, spec, { x: 322.6, z: 27.5 + i * 4, yaw: -Math.PI / 2, y: F, id: null });
      g.userData.bike = false;
      bb.b.group.add(g);
    });
    // la bande
    this.npc(bb, {
      id: 'local-1', name: 'Nassim', x: 319.5, y: F, z: 31.5, yaw: Math.PI / 2, pose: 'talk',
      look: { skin: '#a0683f', helmetColor: '#0d0d0d', top: 'puffer', topColor: '#151515', pantsColor: '#2f4f7f', pants: 'jeans', shoesColor: '#f4f4f4', shoes: 'highsneakers' },
      lines: [
        'Pour un wheeling propre : monte en régime, lâche l’embrayage, puis dose les gaz.',
        'Si ça part trop haut, frein arrière. Toujours le frein arrière.',
        'Le Grand Boulevard, c’est la meilleure ligne droite pour tenir un wheeling.',
        'La Corniche au nord, presque un kilomètre tout droit. Le rêve.',
      ],
    });
    this.npc(bb, {
      id: 'local-2', name: 'Lucas', x: 317.8, y: F, z: 33.2, yaw: Math.PI * 0.9, pose: 'stand',
      look: { skin: '#f1c9a5', helmetColor: '#8a5a2b', top: 'hoodie', topColor: '#1f4fd1', pantsColor: '#151515', pants: 'joggers', shoesColor: '#151515' },
      lines: [
        'Une 2T, il faut la garder dans les tours, sinon elle s’étouffe.',
        'Ta moto est abîmée ? L’atelier, à côté de ton garage, la remet à neuf.',
        'À la station du boulevard ouest, tu peux faire le plein et acheter des jerricans.',
      ],
    });
    this.npc(bb, {
      id: 'local-3', name: 'Yasmine', x: 293.5, y: F, z: 45.05, yaw: Math.PI, pose: 'sit', seatH: 0.43,
      look: { skin: '#7a4b2a', helmetColor: '#1a1410', top: 'windbreaker', topColor: '#ff2bd6', pantsColor: '#151515', shoesColor: '#ffffff' },
      lines: [
        'Le MX Park est au sud, prends le chemin de terre au bout de la ville.',
        'Les défis du quartier sont sur le tableau, à côté de l’entrée.',
        'Au Stunt Park, le grand kicker envoie loin. Pense à la figure (K / Y) en l’air.',
      ],
    });
    // tableau des défis
    bb.board('defis', ['DÉFIS DU QUARTIER', 'Wheeling, stoppie, sauts', 'Contre-la-montre', 'Récompenses en $', '→ Interagir'], 289.17, F + 2.0, 28, 2.4, 1.6, Math.PI / 2, '#0b0b0b', '#f4f4f4', '#ff2bd6');
    this.act(bb, 'local-defis', 290.5, F, 28, 1.8, () => 'Tableau des défis du quartier', () => this.host?.challenges());
    bb.graffiti(x0 + 0.17, F + 3.8, 44, 8, Math.PI / 2, 2);
    bb.graffiti(x1 - 0.17, F + 4.0, 38, 9, -Math.PI / 2, 3);
    // guirlande lumineuse
    for (let x = 290; x < 324; x += 1.2) bb.csphere(x, F + H - 0.6 - Math.sin(((x - 290) / 34) * Math.PI) * 0.4, 37, 0.06, x % 2.4 < 1.2 ? '#ffcc33' : '#ff2bd6', 'glow');
    for (const x of [295, 305, 315]) for (const z of [30, 44]) bb.light(x, F + H - 0.02, z, 1.4, 0.3, '#ffe9c9');
    // ligne de wheeling peinte dehors
    for (let z = 56; z < 78; z += 2) bb.cbox(304.9, F + 0.004, z, 305.1, F + 0.014, z + 1.2, '#f4f4f4', 'matte');
    bb.finish();
  }

  // ---------------------------------------------------------------- mise à jour
  /** Bâtiment dans lequel se trouve un point (ou null). */
  buildingAt(x: number, y: number, z: number): Building | null {
    for (const b of this.buildings) if (b.id !== 'station' && insideBuilding(b, x, y, z)) return b;
    return null;
  }

  update(dt: number, camX: number, camZ: number, px: number, py: number, pz: number, onFoot: boolean): void {
    this.t += dt;
    this.tvTex.offset.x = (this.t * 0.03) % 1;
    for (const b of this.buildings) {
      const dx = b.group.userData.cx - camX, dz = b.group.userData.cz - camZ;
      const d2 = dx * dx + dz * dz;
      b.group.visible = d2 < 300 * 300;
      const near = (b.group.userData.cx - px) ** 2 + (b.group.userData.cz - pz) ** 2 < 70 * 70;
      if (near && b.id === 'garage' && this.garageDirty && this.host) {
        this.garageDirty = false;
        this.refreshGarage(b);
      }
      if (near && b.id === 'concession' && this.showDirty) {
        this.showDirty = false;
        this.refreshShowroom(b);
      }
      b.dynamic.visible = d2 < 120 * 120;
      if (!near) continue;
      for (const d of b.doors) {
        const c = d.center;
        const walkerNear = onFoot && Math.abs(py + 1 - c.y) < 1.6 && (c.x - px) ** 2 + (c.z - pz) ** 2 < 2.6 * 2.6;
        d.update(dt, walkerNear);
      }
      for (const n of b.npcs) {
        const nd = (n.o.x - px) ** 2 + (n.o.z - pz) ** 2;
        if (nd < 45 * 45) n.update(dt, px, pz, nd < 7 * 7 && Math.abs(py - n.o.y) < 2);
      }
    }
    if (this.cash && this.host?.found('entrepot-cash')) this.cash.visible = false;
  }
}

// Garage : studio 3D (plateau tournant, néons, reflets) + interface d'achat,
// de personnalisation (couleurs, pièces, déco, performances), du pilote et des
// configurations enregistrées. Les changements sont visibles immédiatement ;
// les pièces payantes sont prévisualisées puis achetées en un clic.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { h, clear, confirmDialog } from './dom';
import type { Progression } from '../gameplay/progression';
import { garageSlots } from '../gameplay/progression';
import { BIKES, BIKE_BY_ID, BikeSpec, bikeName, CLASS_LABEL, estimateHp, BikeClass } from '../data/bikes';
import { BikeConfig, defaultConfig, PART_SLOTS, PartSlot, SLOT_LABEL, DECALS, PALETTE, partCompatible, tuningFromConfig } from '../data/parts';
import { APPAREL, APPAREL_LABEL, ApparelSlot, RiderConfig, SKIN_TONES } from '../data/apparel';
import { buildBikeVisual, BikeVisual } from '../vehicle/bikeModel';
import { Rider } from '../vehicle/rider';
import type { AudioManager } from '../audio/audio';
import { clamp } from '../core/math';

export type Tab = 'mine' | 'shop' | 'paint' | 'parts' | 'perf' | 'rider' | 'presets';

export interface GarageHost {
  prog: Progression;
  audio: AudioManager;
  ride: () => void;
  testRide: (id: string) => void;
  back: () => void;
  onChange: () => void;
}

export class GarageView {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  root: HTMLElement;
  private bikeHolder = new THREE.Group();
  private visual: BikeVisual | null = null;
  private rider: Rider;
  private tab: Tab = 'mine';
  private viewId: string;
  private cfg!: BikeConfig;
  private riderCfg!: RiderConfig;
  private yaw = 0.9;
  private pitch = 0.22;
  private dist = 3.9;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinch = 0;
  private auto = true;
  private turntable: THREE.Mesh;
  isOpen = false;

  constructor(renderer: THREE.WebGLRenderer, private host: GarageHost, uiRoot: HTMLElement, canvas: HTMLCanvasElement) {
    this.root = uiRoot;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    this.scene.background = new THREE.Color('#0b0d13');
    this.scene.fog = new THREE.Fog('#0b0d13', 12, 30);
    // sol + plateau
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#16181f', roughness: 0.35, metalness: 0.4 }));
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.turntable = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.08, 64), new THREE.MeshStandardMaterial({ color: '#2a2e38', roughness: 0.3, metalness: 0.8 }));
    this.turntable.position.y = 0.04;
    this.turntable.receiveShadow = true;
    this.scene.add(this.turntable);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.02, 8, 96).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#39ff6a', emissive: '#39ff6a', emissiveIntensity: 2 }));
    ring.position.y = 0.085;
    this.scene.add(ring);
    // néons muraux
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.55 + (i / 8) * Math.PI * 0.9;
      const col = i % 2 ? '#ff2bd6' : '#39ff6a';
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2 }));
      bar.position.set(Math.cos(a) * 9, 2.2, Math.sin(a) * 9);
      this.scene.add(bar);
    }
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(9.3, 9.3, 7, 64, 1, true, Math.PI * 0.5, Math.PI), new THREE.MeshStandardMaterial({ color: '#12141b', roughness: 0.8, side: THREE.BackSide }));
    wall.position.y = 3.5;
    this.scene.add(wall);
    // éclairage studio
    const key = new THREE.SpotLight('#ffffff', 120, 20, 0.6, 0.5, 1.5);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key, key.target);
    const rim = new THREE.SpotLight('#9fd3ff', 60, 20, 0.7, 0.6, 1.5);
    rim.position.set(-4, 4, -3);
    this.scene.add(rim, rim.target);
    this.scene.add(new THREE.HemisphereLight('#c8d6ff', '#20202a', 0.5));
    this.scene.add(this.bikeHolder);
    this.rider = new Rider(host.prog.p.rider);
    this.viewId = host.prog.p.current;
    // orbite souris / tactile
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.isOpen) return;
      this.dragging = true;
      this.auto = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('pointermove', (e) => {
      if (!this.isOpen || !this.dragging) return;
      this.yaw -= (e.clientX - this.lastX) * 0.008;
      this.pitch = clamp(this.pitch + (e.clientY - this.lastY) * 0.005, 0.02, 1.1);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => {
      if (!this.isOpen) return;
      this.dist = clamp(this.dist + e.deltaY * 0.003, 2.2, 7);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.isOpen || e.touches.length !== 2) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (this.pinch) this.dist = clamp(this.dist - (d - this.pinch) * 0.01, 2.2, 7);
      this.pinch = d;
    }, { passive: true });
    canvas.addEventListener('touchend', () => (this.pinch = 0));
  }

  private get prog(): Progression {
    return this.host.prog;
  }

  open(): void {
    this.isOpen = true;
    this.viewId = this.prog.p.current;
    this.cfg = structuredClone(this.prog.p.bikes[this.viewId].config);
    this.riderCfg = structuredClone(this.prog.p.rider);
    this.rider.setConfig(this.riderCfg);
    this.tab = 'mine';
    this.rebuild();
    this.render();
  }

  /** Ouvre directement un onglet (depuis un commerce / l'atelier), éventuellement sur une moto. */
  openAt(tab: Tab, bikeId?: string): void {
    this.open();
    if (bikeId && bikeId !== this.viewId) {
      this.viewId = bikeId;
      this.cfg = this.owned(bikeId) ? structuredClone(this.prog.p.bikes[bikeId].config) : defaultConfig(BIKE_BY_ID[bikeId]);
      this.rebuild();
    }
    this.tab = tab;
    this.render();
  }

  close(): void {
    this.isOpen = false;
    clear(this.root);
  }

  private owned(id = this.viewId): boolean {
    return !!this.prog.p.bikes[id];
  }

  private get spec(): BikeSpec {
    return BIKE_BY_ID[this.viewId];
  }

  private rebuild(): void {
    if (this.visual) {
      this.bikeHolder.remove(this.visual.root);
      this.visual.root.remove(this.rider.root);
      this.visual.dispose();
    }
    const spec = this.spec;
    this.visual = buildBikeVisual(spec, this.cfg);
    this.visual.root.position.set(0, 0.08, -spec.wheelbase / 2);
    this.bikeHolder.add(this.visual.root);
    this.visual.root.add(this.rider.root);
    this.visual.update(0.25, spec.travelF * 0.3, spec.travelR * 0.3, 0, 0);
    this.poseRider();
  }

  private poseRider(): void {
    if (!this.visual) return;
    const v = this.visual;
    this.bikeHolder.updateMatrixWorld(true);
    const inv = v.root.matrixWorld.clone().invert();
    const gl = v.gripL.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const gr = v.gripR.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    this.rider.pose({ seat: v.seat, pegL: v.pegL, pegR: v.pegR, gripL: gl, gripR: gr, stand: 0, lean: 0, pitch: 0, roll: 0, steer: 0.25, trick: null, trickW: 0, footDown: 0, scooter: v.isScooter, firstPerson: false });
    this.rider.root.visible = this.tab === 'rider' || this.tab === 'mine';
  }

  update(dt: number, aspect: number): void {
    if (this.auto) this.yaw += dt * 0.25;
    this.bikeHolder.rotation.y = 0;
    this.turntable.rotation.y += dt * (this.auto ? 0 : 0);
    const t = new THREE.Vector3(0, 0.62, 0);
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, 0.4 + Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    // décaler le sujet vers la droite de l'écran (panneau à gauche)
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(t, this.camera.position).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    const shift = aspect > 1.1 ? -0.55 : 0;
    this.camera.position.addScaledVector(right, shift);
    this.camera.lookAt(t.clone().addScaledVector(right, shift));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ UI
  private pending(): { label: string; price: number; apply: () => boolean }[] {
    const out: { label: string; price: number; apply: () => boolean }[] = [];
    if (!this.owned()) return out;
    for (const slot of Object.keys(PART_SLOTS) as PartSlot[]) {
      const val = (this.cfg as any)[slot];
      const opt = (PART_SLOTS[slot] as any[]).find((o) => o.value === val);
      if (opt && !this.prog.partOwned(slot, val, opt.price)) out.push({ label: `${SLOT_LABEL[slot]} : ${opt.name}`, price: opt.price, apply: () => this.prog.buyPart(slot, val, opt.price) });
    }
    const dec = DECALS.find((d) => d.value === this.cfg.decal);
    if (dec && !this.prog.partOwned('decal', dec.value, dec.price)) out.push({ label: `Déco : ${dec.name}`, price: dec.price, apply: () => this.prog.buyPart('decal', dec.value, dec.price) });
    for (const slot of Object.keys(APPAREL) as ApparelSlot[]) {
      const val = (this.riderCfg as any)[slot];
      const opt = (APPAREL[slot] as any[]).find((o) => o.value === val);
      if (opt && !this.prog.apparelOwned(slot, val, opt.price)) out.push({ label: `${APPAREL_LABEL[slot]} : ${opt.name}`, price: opt.price, apply: () => this.prog.buyApparel(slot, val, opt.price) });
    }
    return out;
  }

  private commit(): void {
    const pend = this.pending();
    const total = pend.reduce((n, p) => n + p.price, 0);
    if (total > this.prog.p.money) {
      this.host.audio.ui('error');
      return;
    }
    for (const p of pend) p.apply();
    if (this.owned()) {
      this.prog.p.bikes[this.viewId].config = structuredClone(this.cfg);
      this.prog.p.current = this.viewId;
    }
    this.prog.p.rider = structuredClone(this.riderCfg);
    this.prog.save();
    this.host.audio.ui(total > 0 ? 'buy' : 'select');
    this.host.onChange();
    this.render();
  }

  private revert(): void {
    if (this.owned()) this.cfg = structuredClone(this.prog.p.bikes[this.viewId].config);
    this.riderCfg = structuredClone(this.prog.p.rider);
    this.rider.setConfig(this.riderCfg);
    this.rebuild();
    this.render();
  }

  private selectBike(id: string): void {
    this.viewId = id;
    this.cfg = this.owned(id) ? structuredClone(this.prog.p.bikes[id].config) : defaultConfig(BIKE_BY_ID[id]);
    if (this.owned(id)) {
      this.prog.p.current = id;
      this.prog.save();
      this.host.onChange();
    }
    this.host.audio.ui('select');
    this.rebuild();
    this.render();
  }

  private setCfg<K extends keyof BikeConfig>(k: K, v: BikeConfig[K]): void {
    this.cfg[k] = v;
    this.host.audio.ui('click');
    this.rebuild();
    this.render();
  }

  private setRider<K extends keyof RiderConfig>(k: K, v: RiderConfig[K]): void {
    this.riderCfg[k] = v;
    this.rider.setConfig(this.riderCfg);
    this.host.audio.ui('click');
    this.poseRider();
    this.render();
  }

  private stats(spec: BikeSpec, cfg: BikeConfig) {
    const t = tuningFromConfig(spec, cfg);
    const hp = estimateHp(spec, t.torqueMult);
    const mass = spec.mass + t.massDelta;
    const topRatio = spec.gears ? spec.gears[spec.gears.length - 1] * t.gearMult : spec.cvt!.high * t.gearMult;
    const gearTop = ((spec.redline / topRatio) * Math.PI * 2 * spec.rRear * 3.6) / 60;
    const powerTop = Math.pow((hp * 735 * 0.85) / (0.5 * 1.2 * spec.cda), 1 / 3) * 3.6;
    const top = Math.min(gearTop, powerTop);
    const firstRatio = spec.gears ? spec.gears[0] * t.gearMult : spec.cvt!.low * t.gearMult;
    const launch = (spec.peakTorque * t.torqueMult * firstRatio * 0.9) / spec.rRear / (mass + 75);
    const wheelie = clamp(launch / (9.81 * (spec.comX / spec.comY)), 0, 2);
    return { hp, mass, top, accel: clamp(launch / 14, 0, 1), wheelie: clamp(wheelie / 1.6, 0, 1) };
  }

  render(): void {
    if (!this.isOpen) return;
    clear(this.root);
    const p = this.prog.p;
    const spec = this.spec;
    const tabs: [Tab, string][] = [['mine', 'Mes véhicules'], ['shop', 'Concession'], ['paint', 'Peinture & déco'], ['parts', 'Pièces'], ['perf', 'Performance'], ['rider', 'Pilote'], ['presets', 'Configs']];
    const panel = h('div', { class: 'gpanel' });
    panel.append(h('div', { class: 'gtop' }, h('div', { class: 'gtitle' }, 'GARAGE'), h('div', { class: 'gold', style: 'font-weight:800;font-size:20px' }, `${p.money.toLocaleString('fr-FR')} $`)));
    const tabRow = h('div', { class: 'tabs' });
    for (const [id, label] of tabs) {
      const disabled = !this.owned() && id !== 'shop' && id !== 'mine' && id !== 'rider';
      tabRow.append(h('button', { class: `btn small ${this.tab === id ? 'sel' : ''}`, disabled, onclick: () => { this.tab = id; this.host.audio.ui('click'); this.poseRider(); this.render(); } }, label));
    }
    panel.append(tabRow);
    const body = h('div', {});
    panel.append(body);
    switch (this.tab) {
      case 'mine': this.renderMine(body); break;
      case 'shop': this.renderShop(body); break;
      case 'paint': this.renderPaint(body); break;
      case 'parts': this.renderParts(body, ['plastics', 'rimStyle', 'bars', 'seat', 'fender', 'stuntBar', 'cage']); break;
      case 'perf': this.renderPerf(body); break;
      case 'rider': this.renderRider(body); break;
      case 'presets': this.renderPresets(body); break;
    }
    // achats en attente
    const pend = this.pending();
    if (pend.length) {
      const total = pend.reduce((n, x) => n + x.price, 0);
      panel.append(h('div', { class: 'info', style: 'border:1px solid rgba(255,204,51,0.5);border-radius:12px;padding:10px;margin-top:6px' },
        h('div', { style: 'font-weight:800' }, `Aperçu non acheté (${total.toLocaleString('fr-FR')} $)`),
        ...pend.map((x) => h('div', { class: 'muted', style: 'font-size:13px' }, `${x.label} — ${x.price} $`)),
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('button', { class: 'btn primary small', disabled: total > p.money, onclick: () => this.commit() }, total > p.money ? 'Fonds insuffisants' : `Acheter et appliquer`),
          h('button', { class: 'btn small', onclick: () => this.revert() }, 'Annuler'),
        )));
    } else if (this.owned() && JSON.stringify(this.cfg) !== JSON.stringify(p.bikes[this.viewId]?.config) || JSON.stringify(this.riderCfg) !== JSON.stringify(p.rider)) {
      this.commit();
      return;
    }
    const info = h('div', { class: 'ginfo' }, h('div', { class: 'c' }, `${CLASS_LABEL[spec.cls].toUpperCase()} · ${spec.cc} cm³ · ${spec.stroke} TEMPS`), h('div', { class: 'n' }, bikeName(spec)), h('div', { class: 'muted' }, this.owned() ? 'Dans ton garage' : `${spec.price.toLocaleString('fr-FR')} $ · niveau ${spec.level}`));
    const bottom = h('div', { class: 'gbottom' });
    if (this.owned()) bottom.append(h('button', { class: 'btn primary', onclick: () => { this.commit(); this.host.ride(); } }, '▶ ROULER'));
    else {
      const can = this.prog.canBuy(spec);
      bottom.append(h('button', { class: 'btn', onclick: () => this.host.testRide(spec.id) }, '⏱ Essayer 90 s'));
      bottom.append(h('button', { class: 'btn primary', disabled: !can.ok, onclick: () => { if (this.prog.buyBike(spec.id)) { this.host.audio.ui('buy'); this.selectBike(spec.id); this.host.onChange(); } } }, can.ok ? `Acheter ${spec.price.toLocaleString('fr-FR')} $` : can.why ?? 'Indisponible'));
    }
    bottom.append(h('button', { class: 'btn', onclick: () => { if (this.pending().length) this.revert(); this.host.back(); } }, 'Retour'));
    this.root.append(h('div', { class: 'screen', id: 'garage' }, panel, info, bottom));
  }

  private statBlock(spec: BikeSpec, cfg: BikeConfig): HTMLElement {
    const s = this.stats(spec, cfg);
    const bar = (label: string, v: number, txt: string) => h('div', { style: 'margin:4px 0' }, h('div', { class: 'row', style: 'justify-content:space-between;font-size:14px' }, h('span', { class: 'muted' }, label), h('b', {}, txt)), h('div', { class: 'statbar' }, h('i', { style: `width:${Math.round(clamp(v, 0, 1) * 100)}%` })));
    return h('div', {},
      bar('Puissance', s.hp / 80, `${s.hp.toFixed(0)} ch`),
      bar('Vitesse max', s.top / 180, `${s.top.toFixed(0)} km/h`),
      bar('Accélération', s.accel, ''),
      bar('Facilité de wheeling', s.wheelie, ''),
      bar('Poids', 1 - (s.mass - 60) / 110, `${s.mass.toFixed(0)} kg`),
    );
  }

  /** Fiche des cotes réelles reprises par le modèle (empattement, selle, pneus…). */
  private specSheet(spec: BikeSpec): HTMLElement | null {
    const r = spec.real;
    if (!r) return null;
    const est = new Set(r.estimated ?? []);
    const isEst = (...k: string[]) => k.some((x) => est.has(x));
    const n = (v: number) => v.toLocaleString('fr-FR');
    const rows: [string, string, boolean][] = [
      ['Empattement', `${n(r.wheelbase)} mm`, isEst('empattement')],
      ['Hauteur de selle', `${n(r.seat)} mm`, isEst('hauteur de selle')],
      ['Garde au sol', `${n(r.ground)} mm`, isEst('garde au sol')],
      [`Poids (${r.basis})`, `${n(r.weight)} kg`, isEst('poids')],
      ['Réservoir', `${n(r.fuel)} L`, isEst('réservoir')],
      ['Pneu avant', r.tireF, isEst('pneus')],
      ['Pneu arrière', r.tireR, isEst('pneus')],
    ];
    if (r.travelF) rows.push(['Débattement AV', `${n(r.travelF)} mm`, isEst('débattements')]);
    if (r.travelR) rows.push(['Débattement AR', `${n(r.travelR)} mm`, isEst('débattements', 'débattement arrière')]);
    if (r.rake) rows.push(['Angle de chasse', `${n(r.rake)}°`, isEst('chasse')]);
    if (r.length) rows.push(['Longueur', `${n(r.length)} mm`, false]);
    rows.push(['Masse en jeu (plein fait)', `${spec.mass.toFixed(0)} kg`, isEst('poids')]);
    const known = new Set(['empattement', 'hauteur de selle', 'garde au sol', 'poids', 'réservoir', 'pneus', 'débattements', 'débattement arrière', 'chasse']);
    const other = [...est].filter((x) => !known.has(x));
    const kv = h('div', { class: 'kv spec-kv' });
    for (const [k, v, e] of rows) kv.append(h('span', { class: 'muted' }, k), h('b', { class: e ? 'est' : '' }, e ? `≈ ${v}` : v));
    return h('div', { class: 'spec-sheet' },
      h('div', { class: 'slot-title' }, 'Dimensions réelles'),
      h('div', { class: 'spec-ref' }, `Cotes reprises de : ${r.ref}`),
      r.note ? h('div', { class: 'muted', style: 'font-size:12px;margin:2px 0 4px' }, r.note) : null,
      kv,
      h('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' },
        `${est.size ? '≈ = valeur estimée (donnée constructeur non publiée)' : 'Toutes les valeurs sont des données constructeur publiées'}${other.length ? ` · estimé : ${other.join(', ')}` : ''}. Modèle cité comme référence technique uniquement ; jeu non affilié, aucun logo officiel.`),
    );
  }

  private renderMine(body: HTMLElement): void {
    const p = this.prog.p;
    body.append(h('div', { class: 'muted', style: 'margin-bottom:6px' }, `Places : ${Object.keys(p.bikes).length}/${garageSlots(p.level)} (le garage s’agrandit tous les 2 niveaux)`));
    const grid = h('div', { class: 'grid', style: 'grid-template-columns:1fr' });
    for (const id of Object.keys(p.bikes)) {
      const s = BIKE_BY_ID[id];
      grid.append(h('div', { class: `tile ${id === this.viewId ? 'sel' : ''}`, onclick: () => this.selectBike(id) }, h('div', { class: 'tt' }, bikeName(s)), h('div', { class: 'ts' }, `${CLASS_LABEL[s.cls]} · ${s.cc} cm³ · ${s.stroke}T`), id === p.current ? h('div', { class: 'price', style: 'color:#39ff6a' }, 'ACTIVE') : null));
    }
    body.append(grid);
    if (this.owned()) {
      body.append(h('div', { class: 'slot-title' }, 'Caractéristiques'), this.statBlock(this.spec, this.cfg), h('div', { class: 'muted', style: 'font-size:13px;margin:6px 0' }, this.spec.desc));
      const sheet = this.specSheet(this.spec);
      if (sheet) body.append(sheet);
      if (Object.keys(p.bikes).length > 1) {
        const value = Math.round((this.spec.price || 1500) * 0.6);
        body.append(h('button', { class: 'btn small danger', onclick: () => {
          void confirmDialog(`Vendre ${bikeName(this.spec)} pour ${value.toLocaleString('fr-FR')} $ ?`, 'Vendre').then((yes) => {
            if (!yes) return;
            this.prog.sellBike(this.viewId);
            this.selectBike(this.prog.p.current);
            this.host.onChange();
          });
        } }, `Vendre (${value.toLocaleString('fr-FR')} $)`));
      }
    }
  }

  private renderShop(body: HTMLElement): void {
    const p = this.prog.p;
    const order: BikeClass[] = ['scooter', 'mx', 'mini', 'sm', 'road', 'stunt'];
    for (const cls of order) {
      const list = BIKES.filter((b) => b.cls === cls);
      if (!list.length) continue;
      body.append(h('div', { class: 'slot-title' }, CLASS_LABEL[cls]));
      const grid = h('div', { class: 'grid', style: 'grid-template-columns:1fr' });
      for (const b of list) {
        const own = !!p.bikes[b.id];
        const lock = p.level < b.level;
        grid.append(h('div', { class: `tile ${b.id === this.viewId ? 'sel' : ''}`, style: lock ? 'opacity:0.6' : '', onclick: () => this.selectBike(b.id) },
          h('div', { class: 'tt' }, bikeName(b)), h('div', { class: 'ts' }, `${b.cc} cm³ ${b.stroke}T · ${estimateHp(b).toFixed(0)} ch${lock ? ` · niveau ${b.level}` : ''}`),
          h('div', { class: 'price' }, own ? '✔' : b.price ? `${b.price.toLocaleString('fr-FR')} $` : 'Offert')));
      }
      body.append(grid);
    }
    body.append(h('div', { class: 'slot-title' }, 'Fiche'), this.statBlock(this.spec, this.cfg), h('div', { class: 'muted', style: 'font-size:13px' }, this.spec.desc));
    const sheet = this.specSheet(this.spec);
    if (sheet) body.append(sheet);
  }

  private swatches(get: () => string, set: (c: string) => void): HTMLElement {
    const row = h('div', { class: 'swatches' });
    for (const c of PALETTE) row.append(h('div', { class: `sw ${get() === c ? 'sel' : ''}`, style: `background:${c}`, onclick: () => set(c) }));
    const custom = h('input', { type: 'color', value: get(), style: 'width:36px;height:30px;border:none;background:none;padding:0' }) as HTMLInputElement;
    custom.addEventListener('change', () => set(custom.value));
    row.append(custom);
    return row;
  }

  private renderPaint(body: HTMLElement): void {
    const c = this.cfg;
    const col = (label: string, k: keyof BikeConfig) => {
      body.append(h('div', { class: 'slot-title' }, label), this.swatches(() => c[k] as string, (v) => this.setCfg(k, v as any)));
    };
    col('Couleur principale (plastiques)', 'primary');
    col('Couleur secondaire', 'secondary');
    col('Couleur d’accent', 'accent');
    col('Cadre', 'frame');
    col('Jantes', 'rimColor');
    col('Guidon', 'barColor');
    col('Selle', 'seatColor');
    col('Plaques numéro', 'plateColor');
    body.append(h('div', { class: 'slot-title' }, 'Kit déco'));
    const row = h('div', { class: 'opt-list' });
    for (const d of DECALS) {
      const owned = this.prog.partOwned('decal', d.value, d.price);
      row.append(h('button', { class: `btn small ${c.decal === d.value ? 'sel' : ''}`, onclick: () => this.setCfg('decal', d.value) }, `${d.name}${owned ? '' : ` · ${d.price} $`}`));
    }
    body.append(row);
    body.append(h('div', { class: 'slot-title' }, 'Numéro de plaque'));
    const inp = h('input', { type: 'text', value: c.plateNumber, maxlength: 3, style: 'width:110px' }) as HTMLInputElement;
    inp.addEventListener('change', () => this.setCfg('plateNumber', inp.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 3) || '0'));
    body.append(inp);
  }

  private renderParts(body: HTMLElement, slots: PartSlot[]): void {
    for (const slot of slots) {
      const opts = (PART_SLOTS[slot] as any[]).filter((o) => partCompatible(o, this.spec.cls));
      if (opts.length <= 1) continue;
      body.append(h('div', { class: 'slot-title' }, SLOT_LABEL[slot]));
      const row = h('div', { class: 'opt-list' });
      for (const o of opts) {
        const owned = this.prog.partOwned(slot, o.value, o.price);
        row.append(h('button', { class: `btn small ${(this.cfg as any)[slot] === o.value ? 'sel' : ''}`, title: o.desc ?? '', onclick: () => this.setCfg(slot as any, o.value) }, `${o.name}${owned ? '' : ` · ${o.price} $`}`));
      }
      body.append(row);
    }
  }

  private renderPerf(body: HTMLElement): void {
    body.append(this.statBlock(this.spec, this.cfg));
    this.renderParts(body, ['engineStage', 'exhaust', 'gearing', 'tire', 'suspension', 'brakes']);
    body.append(h('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Pneus : crampons = terre, slicks = bitume. Démultiplication courte = wheelings plus faciles, longue = plus de vitesse.'));
  }

  private renderRider(body: HTMLElement): void {
    const r = this.riderCfg;
    body.append(h('div', { class: 'slot-title' }, 'Pseudo'));
    const name = h('input', { type: 'text', value: r.name, maxlength: 16 }) as HTMLInputElement;
    name.addEventListener('change', () => this.setRider('name', name.value.trim() || 'Rider'));
    body.append(name);
    const optRow = (slot: ApparelSlot) => {
      body.append(h('div', { class: 'slot-title' }, APPAREL_LABEL[slot]));
      const row = h('div', { class: 'opt-list' });
      for (const o of APPAREL[slot] as any[]) {
        const owned = this.prog.apparelOwned(slot, o.value, o.price);
        row.append(h('button', { class: `btn small ${(r as any)[slot] === o.value ? 'sel' : ''}`, onclick: () => this.setRider(slot as any, o.value) }, `${o.name}${owned ? '' : ` · ${o.price} $`}`));
      }
      body.append(row);
    };
    const colRow = (label: string, k: keyof RiderConfig) => body.append(h('div', { class: 'slot-title' }, label), this.swatches(() => r[k] as string, (v) => this.setRider(k, v as any)));
    optRow('helmet');
    optRow('helmetPattern');
    colRow('Casque — couleur 1', 'helmetColor');
    colRow('Casque — couleur 2', 'helmetColor2');
    optRow('eyewear');
    colRow('Masque / lunettes', 'eyewearColor');
    optRow('top');
    optRow('topPattern');
    colRow('Haut — couleur 1', 'topColor');
    colRow('Haut — couleur 2', 'topColor2');
    body.append(h('div', { class: 'slot-title' }, 'Numéro dorsal'));
    const num = h('input', { type: 'text', value: r.number, maxlength: 3, style: 'width:100px' }) as HTMLInputElement;
    num.addEventListener('change', () => this.setRider('number', num.value.slice(0, 3)));
    body.append(num);
    optRow('pants');
    colRow('Pantalon', 'pantsColor');
    colRow('Pantalon — renforts', 'pantsColor2');
    colRow('Gants', 'gloves');
    optRow('shoes');
    colRow('Chaussures', 'shoesColor');
    colRow('Semelles / détails', 'shoesColor2');
    optRow('backpack');
    if (r.backpack) colRow('Sac', 'backpackColor');
    body.append(h('div', { class: 'slot-title' }, 'Teint'));
    const sk = h('div', { class: 'swatches' });
    for (const c of SKIN_TONES) sk.append(h('div', { class: `sw ${r.skin === c ? 'sel' : ''}`, style: `background:${c}`, onclick: () => this.setRider('skin', c) }));
    body.append(sk);
  }

  private renderPresets(body: HTMLElement): void {
    const ob = this.prog.p.bikes[this.viewId];
    if (!ob) return;
    body.append(h('div', { class: 'muted' }, 'Enregistre plusieurs configurations pour cette moto et passe de l’une à l’autre.'));
    const name = h('input', { type: 'text', placeholder: 'Nom de la configuration', maxlength: 24 }) as HTMLInputElement;
    body.append(h('div', { class: 'row', style: 'margin:8px 0' }, name, h('button', { class: 'btn small primary', onclick: () => {
      ob.presets.push({ name: name.value.trim() || `Config ${ob.presets.length + 1}`, config: structuredClone(this.cfg) });
      this.prog.save();
      this.host.audio.ui('select');
      this.render();
    } }, 'Enregistrer')));
    ob.presets.forEach((pr, i) => {
      body.append(h('div', { class: 'tile', style: 'margin:6px 0' }, h('div', { class: 'tt' }, pr.name), h('div', { class: 'row', style: 'margin-top:6px' },
        h('button', { class: 'btn small', onclick: () => { this.cfg = structuredClone({ ...defaultConfig(this.spec), ...pr.config }); this.rebuild(); this.render(); } }, 'Charger'),
        h('button', { class: 'btn small danger', onclick: () => { ob.presets.splice(i, 1); this.prog.save(); this.render(); } }, 'Supprimer'))));
    });
    // tenues du pilote
    body.append(h('div', { class: 'slot-title' }, 'Tenues du pilote'));
    const rn = h('input', { type: 'text', placeholder: 'Nom de la tenue', maxlength: 24 }) as HTMLInputElement;
    body.append(h('div', { class: 'row', style: 'margin:8px 0' }, rn, h('button', { class: 'btn small', onclick: () => {
      this.prog.p.riderPresets.push({ name: rn.value.trim() || `Tenue ${this.prog.p.riderPresets.length + 1}`, rider: structuredClone(this.riderCfg) });
      this.prog.save();
      this.render();
    } }, 'Enregistrer la tenue')));
    this.prog.p.riderPresets.forEach((pr, i) => {
      body.append(h('div', { class: 'tile', style: 'margin:6px 0' }, h('div', { class: 'tt' }, pr.name), h('div', { class: 'row', style: 'margin-top:6px' },
        h('button', { class: 'btn small', onclick: () => { this.riderCfg = structuredClone({ ...this.riderCfg, ...pr.rider }); this.rider.setConfig(this.riderCfg); this.poseRider(); this.render(); } }, 'Porter'),
        h('button', { class: 'btn small danger', onclick: () => { this.prog.p.riderPresets.splice(i, 1); this.prog.save(); this.render(); } }, 'Supprimer'))));
    });
  }
}

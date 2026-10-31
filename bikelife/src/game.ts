// Orchestrateur : rendu, états (menu / balade / garage / pause), boucle de jeu,
// liaison physique ↔ rendu ↔ audio ↔ gameplay ↔ interface ↔ réseau.

import * as THREE from 'three';
import { Progression, Quality, isMobile, xpForLevel } from './gameplay/progression';
import { Input, Controls } from './core/input';
import { events } from './core/events';
import { clamp, DEG, RAD } from './core/math';
import { CollisionWorld } from './physics/collision';
import { City } from './world/city';
import { Atmosphere, Weather } from './world/atmosphere';
import { Traffic, TrafficHit } from './world/traffic';
import { Pedestrians } from './world/pedestrians';
import { spotById, SPOTS } from './world/layout';
import { PlayerBike, BikeAvatar, BikeSnapshot } from './vehicle/bike';
import { BIKE_BY_ID, BikeSpec, bikeName } from './data/bikes';
import { defaultConfig } from './data/parts';
import { CameraRig, CAM_LABEL } from './camera/cameraRig';
import { audio } from './audio/audio';
import type { EngineKind } from './audio/engineDSP';
import { Particles, Skidmarks } from './fx/fx';
import { TrickSystem } from './gameplay/tricks';
import { GameMode, FreeRide, WheelieMode, StuntSession, ChallengeMode, TimeTrial, ModeContext, ModeResult } from './gameplay/modes';
import { CHALLENGES, TIME_TRIALS, Gate } from './data/challenges';
import { Hud, HudState } from './ui/hud';
import { TouchControls } from './ui/touch';
import { Menus, GameAPI } from './ui/menus';
import { GarageView } from './ui/garage';
import { Multiplayer } from './net/multiplayer';
import { emptyInput, BikeInput } from './physics/bikePhysics';
import { isLoose, WallHit } from './physics/collision';
import { h } from './ui/dom';
import { Walker, SeatSpot } from './vehicle/walker';
import { BodyTargets, lerpTargets } from './vehicle/rider';
import { idlePose } from './vehicle/poses';
import { Panel, PanelRow } from './ui/panel';
import type { BuildingHost, GarageTab, ShopKind } from './world/buildings';
import type { Building, Npc } from './world/interiorKit';
import { ITEMS, ITEM_BY_ID, fuelFlowLph, repairCost } from './data/items';
import { estimateHp, CLASS_LABEL } from './data/bikes';
import { tuningFromConfig } from './data/parts';
import { APPAREL, APPAREL_LABEL, ApparelSlot } from './data/apparel';

type State = 'loading' | 'menu' | 'ride' | 'paused' | 'garage' | 'dialog';

const QUALITY: Record<Quality, { pr: number; shadow: number; view: number; traffic: number; peds: number; propShadows: boolean; particles: number }> = {
  low: { pr: 0.8, shadow: 0, view: 320, traffic: 10, peds: 12, propShadows: false, particles: 0.4 },
  medium: { pr: 1.25, shadow: 1024, view: 470, traffic: 22, peds: 26, propShadows: false, particles: 0.75 },
  high: { pr: 2, shadow: 2048, view: 640, traffic: 34, peds: 44, propShadows: true, particles: 1 },
};

export class Game implements GameAPI {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  state: State = 'loading';
  prog = new Progression();
  input: Input;
  audio = audio;
  world = new CollisionWorld();
  city!: City;
  atmo!: Atmosphere;
  traffic!: Traffic;
  peds!: Pedestrians;
  player!: PlayerBike;
  rig!: CameraRig;
  particles!: Particles;
  skids = new Skidmarks();
  tricks = new TrickSystem();
  mode: GameMode;
  hud!: Hud;
  touch!: TouchControls;
  menus!: Menus;
  garage!: GarageView;
  mp: Multiplayer;
  mapCanvas!: HTMLCanvasElement;
  mapScale = 0.5;
  private lastT = performance.now();
  private delta(): number {
    const now = performance.now();
    const d = (now - this.lastT) / 1000;
    this.lastT = now;
    return d;
  }
  private hudTimer = 0;
  private crashHandled = false;
  private safe: { x: number; z: number; yaw: number; y: number; t: number }[] = [];
  private safeTimer = 0;
  private nearMissFlag = false;
  private frozen = false;
  private gatesGroup = new THREE.Group();
  private gateMeshes: THREE.Mesh[] = [];
  private gateArrow: THREE.Mesh;
  private ghostAvatar: BikeAvatar | null = null;
  private ghostData: number[] = [];
  private ghostPlay: number[] | null = null;
  private ghostT = 0;
  private recordData: number[] = [];
  private testRide: { prev: string; t: number } | null = null;
  private quality: Quality;
  private camLabelTimer = 0;
  private trafficHit: TrafficHit = { crash: false, pushX: 0, pushZ: 0, relSpeed: 0 };
  private prevGear = 1;
  private hornCd = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  fps = 60;
  private menuOrbit = 0;
  private lastTopSpeedSave = 0;
  private distAcc = 0;
  private clutchHeld = false;
  private markers: { x: number; z: number; y: number; ids: string[]; mesh: THREE.Mesh }[] = [];
  private markerGroup = new THREE.Group();
  private promptEl: HTMLElement | null = null;
  private promptFor: string[] | null = null;
  // ---- à pied, bâtiments, interactions
  walker!: Walker;
  onFoot = false;
  private trans: { kind: 'off' | 'on'; t: number; dur: number; from: BodyTargets | null; to: BodyTargets | null } | null = null;
  private panel!: Panel;
  private roomLights: THREE.PointLight[] = [];
  private inBuilding: Building | null = null;
  private promptKey = '';
  private curAction: (() => void) | null = null;
  private altAction: (() => void) | null = null;
  private holdT = -1;
  private wallHit: WallHit = { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false };
  private fuelTouch = 0;
  private preSpeed = 0;
  private condApplied = -1;

  constructor(private canvas: HTMLCanvasElement) {
    const mobile = isMobile();
    this.quality = this.prog.p.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || this.quality === 'high', powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.input = new Input(canvas);
    this.mode = new FreeRide(this.modeCtx());
    this.mp = new Multiplayer(this.scene);
    const gm = new THREE.MeshBasicMaterial({ color: '#39ff6a', transparent: true, opacity: 0.85 });
    this.gateArrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 4).rotateX(Math.PI), gm);
    this.gateArrow.visible = false;
    this.scene.add(this.gatesGroup, this.gateArrow);
  }

  // ------------------------------------------------------------------ init
  async init(progress: (p: number, msg: string) => void): Promise<void> {
    const q = QUALITY[this.quality];
    const step = () => new Promise((r) => setTimeout(r, 0));
    progress(0.05, 'Préparation du rendu…');
    await step();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    progress(0.12, 'Construction de la ville…');
    await step();
    this.city = new City(this.world, { propShadows: q.propShadows });
    this.scene.add(this.city.group);
    this.mapCanvas = this.city.minimap;
    this.mapScale = this.city.mapScale;
    progress(0.55, 'Ciel, lumière et météo…');
    await step();
    this.atmo = new Atmosphere(this.scene, this.renderer, q.shadow);
    this.atmo.viewDist = q.view;
    this.atmo.timeSpeed = this.prog.p.settings.timeSpeed;
    progress(0.65, 'Trafic et piétons…');
    await step();
    this.traffic = new Traffic(QUALITY.high.traffic);
    this.peds = new Pedestrians(QUALITY.high.peds);
    this.scene.add(this.traffic.group, this.peds.group);
    this.traffic.onHonk = (x, z) => {
      const d = Math.hypot(x - this.player.phys.x, z - this.player.phys.z);
      this.audio.horn(true, d);
    };
    this.traffic.onNearMiss = () => {
      this.nearMissFlag = true;
      this.prog.stat('nearMisses', 1);
    };
    progress(0.75, 'Préparation de la moto…');
    await step();
    const spec = this.prog.spec;
    this.player = new PlayerBike(spec, this.prog.owned.config, this.prog.p.rider, this.world, this.scene);
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.rig.raycast = (ax, ay, az, bx, by, bz, step) => this.world.raycast(ax, ay, az, bx, by, bz, step);
    this.particles = new Particles(this.renderer.getPixelRatio());
    this.scene.add(this.particles.points, this.skids.mesh);
    this.walker = new Walker(this.world);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#fff1dc', 0, 16, 2);
      l.castShadow = false;
      this.scene.add(l);
      this.roomLights.push(l);
    }
    this.city.interiors.host = this.buildingHost();
    this.buildMarkers();
    const start = this.prog.p.lastPos ?? spotById('garage');
    this.player.reset(start.x, start.z, start.yaw);
    this.rig.snap(this.camTarget());
    progress(0.85, 'Interface…');
    await step();
    this.hud = new Hud(document.getElementById('hud')!, this.mapCanvas, this.mapScale);
    this.touch = new TouchControls(document.getElementById('touch')!, this.input, this.prog.p.settings.touch);
    this.touch.onLayoutChange = (l) => {
      this.prog.p.settings.touch = l;
      this.prog.save();
    };
    this.menus = new Menus(document.getElementById('ui')!, this);
    this.panel = new Panel(document.getElementById('ui')!, () => this.closePanel());
    document.body.append(h('div', { id: 'fade' }));
    const garageUi = h('div', { id: 'garage-ui' });
    document.getElementById('ui')!.append(garageUi);
    this.garage = new GarageView(this.renderer, {
      prog: this.prog, audio: this.audio,
      ride: () => this.closeGarage(true),
      testRide: (id) => this.startTestRide(id),
      back: () => this.closeGarage(false),
      onChange: () => this.onBikeChanged(),
    }, garageUi, this.canvas);
    this.bindEvents();
    this.applySettings();
    this.traffic.reset(this.player.phys.x, this.player.phys.z);
    this.peds.reset(this.player.phys.x, this.player.phys.z);
    progress(0.95, 'Compilation des shaders…');
    await step();
    this.atmo.update(0.016, this.rig.cam, new THREE.Vector3(this.player.phys.x, 0, this.player.phys.z));
    this.city.update(this.rig.cam.position.x, this.rig.cam.position.z, this.atmo.viewDist, this.atmo.night, 0);
    this.renderer.compile(this.scene, this.rig.cam);
    this.mp.onChat = (n, t) => this.hud.chat(`${n} : ${t}`);
    this.mp.onInfo = (t) => this.hud.toast(t, 'info');
    progress(1, 'Prêt !');
    this.state = 'menu';
    this.menus.showMain();
    document.getElementById('hud')!.classList.add('hidden');
    // premier geste utilisateur → audio
    const unlock = () => {
      this.audio.init().then(() => {
        this.audio.setPlayerEngine(this.player.spec.sound as EngineKind);
        this.audio.ensureTrafficVoices(2);
        this.applyAudioSettings();
      });
    };
    // iOS/Safari n'autorise l'audio qu'après un geste : on tente sur plusieurs types d'événements
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        if (this.state === 'ride') this.pause();
      } else this.audio.resume();
    });
    this.loop();
  }

  private bindEvents(): void {
    events.on('trickLanded', (e) => {
      this.audio.combo(this.tricks.combo.mult);
      if (e.name.startsWith('Wheeling') || e.name.startsWith('12h') || e.name.startsWith('Circle')) {
        // stats wheeling gérées dans onTrickEnd
      }
    });
    events.on('comboBanked', (e) => {
      this.prog.addMoney(e.money, 'Combo');
      this.prog.addXP(e.xp);
      this.prog.stat('stuntPoints', e.points);
      this.prog.record('bestCombo', e.points, 'Meilleur combo', 'pts');
      this.mode.onCombo(e.points);
      this.audio.money();
      this.hud.toast(`${e.tricks.slice(-3).join(' · ')} — ${e.points.toLocaleString('fr-FR')} pts (×${e.multiplier}) +${e.money} $`, 'good', 2600);
      if (e.points > 5000) this.mp.feat(`combo de ${e.points.toLocaleString('fr-FR')} pts`);
    });
    events.on('comboLost', (e) => {
      if (e.points > 0) this.hud.toast(`Combo perdu (${e.points.toLocaleString('fr-FR')} pts)`, 'bad');
    });
    events.on('record', (e) => {
      this.audio.record();
      const v = e.unit === 'pts' ? e.value.toLocaleString('fr-FR') : e.value.toFixed(e.unit === 's' ? 2 : 1);
      this.hud.toast(`NOUVEAU RECORD — ${e.label} : ${v} ${e.unit}`, 'gold', 4000);
    });
    events.on('notify', (e) => this.hud?.toast(e.text, e.kind ?? 'info', 4000));
    events.on('levelUp', () => this.audio.record());
    events.on('trickStart', () => this.audio.ui('select'));
    this.tricks.onTrickEnd = (kind, value, extra) => {
      if (kind === 'wheelie') {
        this.prog.stat('wheelieDist', value);
        this.prog.stat('wheelieTime', extra?.time ?? 0);
        this.prog.record('wheelieDist', value, 'Plus long wheeling', 'm');
        this.prog.record('wheelieTime', extra?.time ?? 0, 'Wheeling le plus long', 's');
        if (value > 150) this.mp.feat(`wheeling de ${value.toFixed(0)} m`);
      } else if (kind === 'stoppie') {
        this.prog.stat('stoppieDist', value);
        this.prog.record('stoppieDist', value, 'Plus long stoppie', 'm');
      } else if (kind === 'air') {
        this.prog.stat('airTime', value);
        this.prog.stat('jumps', 1);
        if (extra?.tricks) this.prog.stat('tricks', extra.tricks);
        this.prog.record('airTime', value, 'Temps de vol', 's');
        if (extra?.dist) this.prog.record('jumpDist', extra.dist, 'Plus long saut', 'm');
      } else if (kind === 'drift') {
        this.prog.stat('driftTime', value);
      }
      this.prog.addXP(kind === 'wheelie' ? value * 0.6 : 15);
      this.mode.onTrick(kind, value, extra);
    };
  }

  // ------------------------------------------------------------------ réglages
  applySettings(): void {
    const s = this.prog.p.settings;
    if (s.quality !== this.quality) this.quality = s.quality;
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    this.renderer.shadowMap.enabled = q.shadow > 0;
    if (this.atmo) {
      this.atmo.viewDist = q.view;
      this.atmo.sun.castShadow = q.shadow > 0;
      if (q.shadow > 0 && this.atmo.sun.shadow.mapSize.x !== q.shadow) {
        this.atmo.sun.shadow.mapSize.set(q.shadow, q.shadow);
        this.atmo.sun.shadow.map?.dispose();
        this.atmo.sun.shadow.map = null;
      }
      this.atmo.timeSpeed = s.timeSpeed;
      this.atmo.envEnabled = this.quality !== 'low';
    }
    if (this.rig) {
      this.rig.cam.far = q.view * 2.2;
      this.rig.cam.updateProjectionMatrix();
      this.rig.autoWheelieCam = s.autoWheelieCam;
    }
    if (this.traffic) {
      const n = s.traffic ? q.traffic : 0;
      this.traffic.count = n;
      if (this.traffic.cars.length > n) this.traffic.cars.length = n;
      while (this.traffic.cars.length < n && this.player) this.traffic.reset(this.player.phys.x, this.player.phys.z);
      this.traffic.group.visible = s.traffic;
    }
    if (this.peds) {
      const n = s.traffic ? q.peds : 0;
      if (this.peds.peds.length !== n) {
        (this.peds as any).count = n;
        this.peds.reset(this.player?.phys.x ?? 0, this.player?.phys.z ?? 0);
      }
      this.peds.group.visible = s.traffic;
    }
    if (this.particles) this.particles.quality = q.particles;
    if (this.player) this.player.setAssist(s.assist, s.autoGear);
    if (this.touch) {
      this.touch.setLayout(s.touch);
      this.touch.showGears(!s.autoGear && !!this.player?.spec.gears);
    }
    if (this.hud) this.hud.setHelp(s.showHelp && !isMobile());
    this.applyAudioSettings();
    this.resize();
  }

  private applyAudioSettings(): void {
    const s = this.prog.p.settings;
    this.audio.vol = { ...s.volumes };
    this.audio.musicOn = s.music;
    this.audio.applyVolumes();
    if (this.audio.music) {
      this.audio.music.setStyle(s.musicStyle);
      if (s.music && !this.audio.music.playing) this.audio.music.start();
      if (!s.music && this.audio.music.playing) this.audio.music.stop();
    }
  }

  private resize(): void {
    const w = window.innerWidth, hh = window.innerHeight;
    this.renderer.setSize(w, hh, false);
    if (this.rig) {
      this.rig.cam.aspect = w / hh;
      this.rig.cam.updateProjectionMatrix();
    }
    this.touch?.place();
  }

  // ------------------------------------------------------------------ API menus
  playerPos(): { x: number; z: number } {
    return { x: this.player.phys.x, z: this.player.phys.z };
  }

  isRiding(): boolean {
    return this.state === 'ride' || this.state === 'paused';
  }

  modeActive(): boolean {
    return !(this.mode instanceof FreeRide) || !!this.testRide;
  }

  getTime(): number {
    return this.atmo.time;
  }

  setTime(hh: number): void {
    this.atmo.setTime(hh);
  }

  getWeather(): Weather {
    return this.atmo.weather;
  }

  setWeather(w: Weather): void {
    this.atmo.setWeather(w);
  }

  private enterRide(): void {
    this.menus.close();
    this.state = 'ride';
    document.getElementById('hud')!.classList.remove('hidden');
    const touchOn = isMobile() || this.input.lastDevice === 'touch' || 'ontouchstart' in window;
    document.getElementById('touch')!.classList.toggle('hidden', !touchOn);
    this.input.enabled = true;
    this.delta();
    this.canvas.focus();
    if (isMobile()) this.goFullscreen();
    this.tutorial();
  }

  /** Conseils au premier lancement. */
  private tutorial(): void {
    const s = this.prog.p.settings;
    if (s.tutorialDone) return;
    s.tutorialDone = true;
    this.prog.save();
    const touch = !document.getElementById('touch')!.classList.contains('hidden');
    const tips = touch
      ? ['Gâchette GAZ à droite : plus le doigt est haut, plus ça accélère.', 'WHEELIE : maintiens (le moteur monte en régime), puis glisse le pouce vers GAZ pour lever la roue.', 'Joystick vers le bas = pilote en arrière (plus d’angle), vers le haut = en avant. FREIN AR pour redescendre.']
      : ['Z/W pour accélérer (progressif), Espace = frein arrière, S = frein avant.', 'Wheeling : maintiens Maj + Z/W pour monter en régime, puis relâche Maj (coup d’embrayage).', 'Dose avec les gaz, ↓ pour reculer le corps, Espace pour faire redescendre la roue. Jauge d’angle à droite.'];
    tips.forEach((t, i) => setTimeout(() => this.hud.toast(t, 'info', 6500), 600 + i * 4200));
  }

  private goFullscreen(): void {
    const el = document.documentElement as any;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
    }
  }

  startRide(spotId?: string): void {
    if (!(this.mode instanceof FreeRide)) this.quitMode();
    if (spotId) this.teleport(spotId);
    this.enterRide();
  }

  startMode(kind: 'wheelie' | 'stunt' | 'challenge' | 'timetrial', arg?: string): void {
    this.forceMount();
    this.mode.end();
    const ctx = this.modeCtx();
    if (kind === 'wheelie') {
      const s = spotById(arg === 'corniche' ? 'corniche' : 'boulevard');
      this.mode = new WheelieMode(ctx, { x: s.x, z: s.z, yaw: s.yaw, name: s.name });
    } else if (kind === 'stunt') {
      const s = spotById('stunt');
      this.mode = new StuntSession(ctx, s);
    } else if (kind === 'challenge') {
      const def = CHALLENGES.find((c) => c.id === arg)!;
      if (def.classes && !def.classes.includes(this.player.spec.cls)) {
        const own = Object.keys(this.prog.p.bikes).find((id) => def.classes!.includes(BIKE_BY_ID[id].cls));
        if (!own) {
          this.hud.toast(`Ce défi nécessite : ${def.classes.join(', ')}. Achète-en un au garage !`, 'bad');
          return;
        }
        this.prog.p.current = own;
        this.onBikeChanged();
      }
      this.mode = new ChallengeMode(ctx, def);
    } else {
      const def = TIME_TRIALS.find((t) => t.id === arg)!;
      this.mode = new TimeTrial(ctx, def);
    }
    this.tricks.reset();
    this.mode.start();
    this.enterRide();
  }

  quitMode(): void {
    this.mode.end();
    this.mode = new FreeRide(this.modeCtx());
    this.frozen = false;
    if (this.testRide) this.endTestRide();
  }

  resume(): void {
    if (this.state === 'paused' || this.state === 'ride') this.enterRide();
  }

  private pause(): void {
    if (this.state !== 'ride') return;
    this.promptEl?.classList.add('hidden');
    this.promptFor = null;
    this.state = 'paused';
    this.menus.showPause();
  }

  respawn(): void {
    this.forceMount();
    const s = this.pickSafe();
    this.player.reset(s.x, s.z, s.yaw, s.y);
    this.crashHandled = false;
    this.tricks.reset();
    this.skids.clear();
    this.rig.snap(this.camTarget());
    events.emit('respawn', {});
  }

  toMainMenu(): void {
    this.forceMount();
    this.panel?.close();
    this.quitMode();
    this.state = 'menu';
    this.prog.p.lastPos = { x: this.player.phys.x, z: this.player.phys.z, yaw: this.player.phys.yaw };
    this.prog.save();
    document.getElementById('hud')!.classList.add('hidden');
    document.getElementById('touch')!.classList.add('hidden');
    this.menus.showMain();
  }

  teleport(spotId: string): void {
    const s = spotById(spotId);
    this.teleportTo(s.x, s.z, s.yaw);
    this.hud.toast(`Téléporté : ${s.name}`, 'info');
    if (this.state === 'paused' || this.state === 'menu') this.enterRide();
  }

  private teleportTo(x: number, z: number, yaw: number, y?: number): void {
    this.forceMount();
    this.player.reset(x, z, yaw, y);
    this.crashHandled = false;
    this.safe = [];
    this.skids.clear();
    this.tricks.reset();
    this.traffic.reset(x, z);
    this.peds.reset(x, z);
    this.rig.snap(this.camTarget());
  }

  openGarage(): void {
    this.garageReturn = this.state === 'paused' || this.state === 'ride' ? 'ride' : 'menu';
    this.menus.close();
    this.state = 'garage';
    document.getElementById('hud')!.classList.add('hidden');
    document.getElementById('touch')!.classList.add('hidden');
    this.input.enabled = false;
    this.garage.open();
  }

  private garageReturn: 'menu' | 'ride' | 'world' = 'menu';

  private closeGarage(ride: boolean): void {
    this.garage.close();
    this.input.enabled = true;
    this.onBikeChanged();
    if (this.garageReturn === 'world') {
      // retour dans le bâtiment (commerce, atelier, garage)
      this.garageReturn = 'menu';
      this.state = 'ride';
      document.getElementById('hud')!.classList.remove('hidden');
      const touchOn = isMobile() || this.input.lastDevice === 'touch' || 'ontouchstart' in window;
      document.getElementById('touch')!.classList.toggle('hidden', !touchOn);
      this.delta();
      void ride;
      return;
    }
    if (ride) {
      if (!(this.mode instanceof FreeRide) && !this.testRide) this.quitMode();
      this.enterRide();
    } else if (this.garageReturn === 'ride') {
      this.state = 'paused';
      document.getElementById('hud')!.classList.remove('hidden');
      this.menus.showPause();
    } else {
      this.state = 'menu';
      this.menus.showMain();
    }
  }

  private onBikeChanged(): void {
    const spec = this.prog.spec;
    const cfg = this.prog.owned.config;
    if (spec.id !== this.player.spec.id || JSON.stringify(cfg) !== JSON.stringify(this.player.cfg)) {
      this.player.setBike(spec, structuredClone(cfg));
      this.player.setAssist(this.prog.p.settings.assist, this.prog.p.settings.autoGear);
    }
    this.player.setRider(this.prog.p.rider);
    this.audio.setPlayerEngine(spec.sound as EngineKind);
    this.mp.sendBike(spec.id, cfg, this.prog.p.rider);
    this.condApplied = -1;
    this.city?.interiors.markGarageDirty();
    this.touch?.showGears(!this.prog.p.settings.autoGear && !!spec.gears);
  }

  private startTestRide(id: string): void {
    this.forceMount();
    const spec = BIKE_BY_ID[id];
    this.garage.close();
    this.input.enabled = true;
    this.testRide = { prev: this.prog.p.current, t: 90 };
    this.player.setBike(spec, defaultConfig(spec));
    this.player.setAssist(this.prog.p.settings.assist, this.prog.p.settings.autoGear);
    this.audio.setPlayerEngine(spec.sound as EngineKind);
    const s = spotById(spec.cls === 'mx' || spec.cls === 'mini' ? 'mx' : 'training');
    this.teleportTo(s.x, s.z, s.yaw);
    this.hud.toast(`Essai : ${bikeName(spec)} — 90 secondes`, 'info');
    this.enterRide();
  }

  private endTestRide(): void {
    if (!this.testRide) return;
    this.testRide = null;
    this.onBikeChanged();
    this.player.setBike(this.prog.spec, structuredClone(this.prog.owned.config));
    this.player.setAssist(this.prog.p.settings.assist, this.prog.p.settings.autoGear);
    this.audio.setPlayerEngine(this.prog.spec.sound as EngineKind);
  }

  editTouchLayout(): void {
    this.menus.close();
    const touchEl = document.getElementById('touch')!;
    touchEl.classList.remove('hidden');
    this.touch.setEditing(true);
    const bar = h('div', { id: 'touch-edit-bar' },
      h('button', { class: 'btn primary', onclick: () => done() }, 'Terminer'),
      h('button', { class: 'btn', onclick: () => this.touch.resetLayout() }, 'Par défaut'));
    document.body.append(bar);
    const done = () => {
      this.touch.setEditing(false);
      bar.remove();
      this.prog.p.settings.touch = this.touch['layout'];
      this.prog.save();
      if (this.state !== 'ride') touchEl.classList.add('hidden');
      this.menus.showSettings(() => (this.isRiding() ? this.menus.showPause() : this.menus.showMain()));
    };
  }

  mpConnect(url: string, room: string): void {
    this.mp.connect(url, room, { name: this.prog.p.rider.name, bike: this.player.spec.id, cfg: this.player.cfg, rider: this.prog.p.rider });
  }

  // ------------------------------------------------------------------ marqueurs de défis
  private buildMarkers(): void {
    const groups = new Map<string, { x: number; z: number; y: number; ids: string[] }>();
    for (const c of CHALLENGES) {
      const k = `${Math.round(c.start.x / 8)},${Math.round(c.start.z / 8)}`;
      if (!groups.has(k)) groups.set(k, { x: c.start.x, z: c.start.z, y: c.start.y ?? 0, ids: [] });
      groups.get(k)!.ids.push(c.id);
    }
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 7, 24, 1, true).translate(0, 3.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#ff2bd6', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const g of groups.values()) {
      const gh = this.world.groundAt(g.x, g.z, 50, { h: 0, surf: 'asphalt', id: -1 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(g.x, gh.h, g.z);
      this.markerGroup.add(m);
      this.markers.push({ ...g, y: gh.h, mesh: m });
    }
    this.scene.add(this.markerGroup);
    this.promptEl = h('div', { id: 'hud-prompt', class: 'hidden' });
    document.body.append(this.promptEl);
  }

  private openSpotChallenges(): void {
    this.state = 'paused';
    this.promptEl?.classList.add('hidden');
    this.menus.showModes('challenges');
  }

  private updateMarkers(): void {
    this.markerGroup.visible = this.mode instanceof FreeRide && !this.testRide;
    // la caméra à pied peut se retrouver dans le cylindre : on le masque
    const c = this.rig.cam.position;
    for (const m of this.markers) m.mesh.visible = (c.x - m.x) ** 2 + (c.z - m.z) ** 2 > 3.4 * 3.4;
  }

  // ------------------------------------------------------------------ modes
  private modeCtx(): ModeContext {
    return {
      bike: () => this.player.phys,
      prog: this.prog,
      teleport: (x, z, yaw, y) => this.teleportTo(x, z, yaw, y),
      notify: (t, k) => this.hud.toast(t, k ?? 'info'),
      showResult: (r) => this.showResult(r),
      setGates: (g, i) => this.setGates(g, i),
      beep: (hi) => this.audio.beep(hi),
      checkpointSound: () => this.audio.checkpoint(),
      ghost: {
        record: (t) => {
          const p = this.player.phys;
          this.recordData.push(t, p.x, p.y, p.z, p.yaw, p.pitch, p.roll);
        },
        startPlayback: (data) => this.startGhost(data),
        stopPlayback: () => this.stopGhost(),
        data: () => this.recordData.slice(),
      },
      freeze: (on) => (this.frozen = on),
    };
  }

  private showResult(r: ModeResult): void {
    if (r.reward > 0) this.prog.addMoney(r.reward, 'Récompense');
    this.prog.addXP(r.medal * 150 + 50);
    if (r.medal === 3) this.audio.record();
    else if (r.medal > 0) this.audio.money();
    else this.audio.fail();
    this.prog.save();
    this.state = 'paused';
    this.menus.showResult(r, () => {
      this.quitMode();
      this.enterRide();
    });
  }

  private setGates(gates: Gate[] | null, current: number): void {
    for (const m of this.gateMeshes) this.gatesGroup.remove(m);
    this.gateMeshes = [];
    this.gateArrow.visible = false;
    if (!gates) return;
    gates.forEach((g, i) => {
      if (i < current) return;
      const cur = i === current;
      const mat = new THREE.MeshBasicMaterial({ color: cur ? '#39ff6a' : '#ff2bd6', transparent: true, opacity: cur ? 0.85 : 0.35 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(g.r * 0.62, 0.18, 8, 40), mat);
      ring.position.set(g.x, g.y + g.r * 0.62, g.z);
      const next = gates[i + 1] ?? gates[i - 1];
      if (next) ring.rotation.y = Math.atan2(next.x - g.x, next.z - g.z);
      this.gatesGroup.add(ring);
      this.gateMeshes.push(ring);
      if (cur) {
        this.gateArrow.visible = true;
        this.gateArrow.position.set(g.x, g.y + g.r * 1.45, g.z);
      }
    });
  }

  private startGhost(data: number[] | null): void {
    this.stopGhost();
    this.recordData = [];
    this.ghostPlay = data;
    this.ghostT = 0;
    if (data && data.length >= 7) {
      this.ghostAvatar = new BikeAvatar(this.player.spec, this.player.cfg, null, true);
      this.scene.add(this.ghostAvatar.rig.outer);
    }
  }

  private stopGhost(): void {
    if (this.ghostAvatar) this.ghostAvatar.dispose(this.scene);
    this.ghostAvatar = null;
    this.ghostPlay = null;
  }

  private updateGhost(dt: number): void {
    if (!this.ghostAvatar || !this.ghostPlay || this.frozen) return;
    this.ghostT += dt;
    const d = this.ghostPlay;
    let i = 0;
    while (i + 7 < d.length && d[i + 7] < this.ghostT) i += 7;
    const s: BikeSnapshot = { x: d[i + 1], y: d[i + 2], z: d[i + 3], yaw: d[i + 4], pitch: d[i + 5], roll: d[i + 6], steer: 0, cf: 0.08, cr: 0.08, rf: this.ghostT * 20, rr: this.ghostT * 20, rpm: 0, thr: 0 };
    this.ghostAvatar.push(s);
    this.ghostAvatar.update(dt);
  }

  // ------------------------------------------------------------------ boucle
  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.delta(), 1 / 15);
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 1) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    try {
      this.frame(dt);
    } catch (e) {
      console.error('[frame]', e);
    }
  };

  private frame(dt: number): void {
    this.prog.tick(dt);
    if (this.state === 'garage') {
      this.garage.update(dt, innerWidth / innerHeight);
      this.renderer.render(this.garage.scene, this.garage.camera);
      return;
    }
    if (this.state === 'loading') return;
    if (this.state === 'dialog') {
      const c = this.input.poll(dt);
      if (c.pause) this.panel.close();
      if (this.onFoot) this.walker.pose(this.player.rider, this.rig.mode === 'fpv');
      this.updateWorld(dt);
      this.renderer.render(this.scene, this.rig.cam);
      return;
    }
    const ctl = this.input.poll(dt);
    if (this.state === 'menu') {
      this.menuOrbit += dt;
      const p = this.player.phys;
      this.player.step(dt, { ...emptyInput(), frontBrake: 1, rearBrake: 1 });
      this.player.sync(dt, { trick: null, trickW: 0, firstPerson: false, night: this.atmo.night });
      this.rig.orbitAround(dt, new THREE.Vector3(p.x, p.y + 0.2, p.z), 5.5, 1.6);
      this.updateWorld(dt);
      this.renderer.render(this.scene, this.rig.cam);
      return;
    }
    if (this.state === 'paused') {
      if (ctl.pause && !this.menus.current?.querySelector('#garage')) this.resume();
      this.renderer.render(this.scene, this.rig.cam);
      return;
    }
    // ----------------------------------------------------------- balade
    if (ctl.pause) {
      this.pause();
      return;
    }
    if (this.onFoot) {
      this.frameFoot(dt, ctl);
      return;
    }
    if (ctl.camera) {
      const m = this.rig.next();
      this.hud.toast(`Caméra : ${CAM_LABEL[m]}`, 'info', 1200);
    }
    if (ctl.respawn) {
      this.respawn();
      if (this.mode instanceof ChallengeMode || this.mode instanceof TimeTrial) this.mode.start();
    }
    this.hornCd -= dt;
    if (ctl.horn && this.hornCd <= 0) {
      this.audio.horn(false);
      this.hornCd = 0.4;
    }
    const phys = this.player.phys;
    this.clutchHeld = ctl.clutch;
    // entrées moto
    const bi: BikeInput = this.frozen
      ? { ...emptyInput(), frontBrake: 1, rearBrake: 1, throttle: ctl.throttle, clutch: true }
      : {
          throttle: ctl.throttle, frontBrake: ctl.frontBrake, rearBrake: ctl.rearBrake, steer: ctl.steer, lean: ctl.lean,
          clutch: ctl.clutch, jump: ctl.jump, shiftUp: ctl.shiftUp, shiftDown: ctl.shiftDown,
        };
    if (this.frozen) phys.vx = phys.vz = 0;
    if (this.prog.fuel() <= 0 && !this.testRide) bi.throttle = 0; // panne sèche
    this.preSpeed = phys.speed;
    // figures en l'air
    if (ctl.trick && phys.airborne && !this.tricks.trickPose) this.tricks.startAirTrick({ x: ctl.steer, y: ctl.lean }, phys);
    this.touch.setTrickHighlight(phys.airborne && phys.airTime > 0.15 && !this.tricks.trickPose);
    phys.trickActive = this.tricks.trickWeight > 0.35;
    this.player.step(dt, bi);
    // collisions trafic & piétons
    if (!phys.crashed && this.traffic.group.visible) {
      const fx = Math.sin(phys.yaw), fz = Math.cos(phys.yaw);
      const pts = [{ x: phys.x, z: phys.z }, { x: phys.x + fx * 0.8, z: phys.z + fz * 0.8 }, { x: phys.x - fx * 0.7, z: phys.z - fz * 0.7 }];
      if (this.traffic.collide(pts, phys.vx, phys.vz, this.trafficHit)) {
        phys.x += this.trafficHit.pushX;
        phys.z += this.trafficHit.pushZ;
        if (this.trafficHit.crash) phys.doCrash('Percuté une voiture', this.trafficHit.relSpeed);
        else {
          phys.vx *= 0.7;
          phys.vz *= 0.7;
        }
      }
      const [px, pz] = this.peds.push(phys.x, phys.z);
      phys.x += px;
      phys.z += pz;
    }
    // chute
    if (phys.crashed && !this.crashHandled) {
      this.crashHandled = true;
      this.tricks.loseCombo();
      this.prog.stat('crashes', 1);
      this.audio.crash();
      this.rig.shake(1.2);
      this.mode.onCrash();
      // dégâts : moto (guidon, leviers, plastiques, moteur) et pilote
      if (!this.testRide) {
        const v = this.preSpeed;
        this.prog.setCond(this.prog.cond() - clamp(v * 1.1, 4, 30));
        this.prog.p.health = Math.max(0, this.prog.p.health - clamp(v * 2.4, 6, 55));
        this.prog.touch();
      }
    }
    if (this.player.wreck && (this.player.wreckTime > 3.2 || (this.player.wreckTime > 1.2 && (ctl.throttle > 0.5 || ctl.clutch)))) {
      if (this.prog.p.health <= 0) this.knockout();
      else this.respawn();
    }
    // figures
    this.tricks.update(dt, phys, ctl.frontBrake, this.nearMissFlag);
    this.nearMissFlag = false;
    // positions sûres
    this.safeTimer -= dt;
    if (this.safeTimer <= 0 && !phys.crashed && phys.state === 'ground' && Math.abs(phys.roll) < 0.3 && Math.abs(phys.pitch) < 0.15) {
      this.safeTimer = 0.5;
      this.safe.push({ x: phys.x, z: phys.z, yaw: phys.yaw, y: phys.y - phys.comHeight, t: performance.now() });
      if (this.safe.length > 30) this.safe.shift();
    }
    // stats
    this.distAcc += phys.speed * dt;
    if (this.distAcc > 50) {
      this.prog.stat('distance', this.distAcc);
      this.distAcc = 0;
    }
    if (phys.kmh > (this.prog.p.records.topSpeed ?? 0) + 0.5 && performance.now() - this.lastTopSpeedSave > 1500) {
      this.lastTopSpeedSave = performance.now();
      const prevTop = this.prog.p.records.topSpeed ?? 0;
      this.prog.record('topSpeed', phys.kmh, 'Vitesse max', 'km/h', true, true);
      // annonce uniquement les paliers de 10 km/h
      if (prevTop > 0 && Math.floor(phys.kmh / 10) > Math.floor(prevTop / 10) && phys.kmh >= 60) this.hud.toast(`Nouveau record de vitesse : ${Math.floor(phys.kmh)} km/h`, 'gold');
    }
    if (this.player.phys.engine.gear !== this.prevGear) {
      this.audio.shift();
      this.prevGear = this.player.phys.engine.gear;
    }
    if (phys.landedThisFrame && phys.lastLandImpact > 7.5 && !this.testRide) this.prog.setCond(this.prog.cond() - (phys.lastLandImpact - 7.5) * 1.2);
    if (phys.landedThisFrame && phys.lastLandImpact > 1.2) {
      this.audio.land(phys.lastLandImpact);
      this.rig.shake(Math.min(1, phys.lastLandImpact / 9));
      this.dustBurst(phys.rear.cx, phys.rear.cy, phys.rear.cz, phys.lastLandImpact);
    }
    // essai
    if (this.testRide) {
      this.testRide.t -= dt;
      if (this.testRide.t <= 0) {
        this.endTestRide();
        this.hud.toast('Fin de l’essai', 'info');
        this.openGarage();
        return;
      }
    }
    this.mode.update(dt);
    this.updateMarkers();
    this.updateGhost(dt);
    this.consumeFuel(dt);
    this.applyCondition();
    this.updateHealth(dt);
    this.updateInteractions(ctl, dt);
    // rendu moto
    const tp = this.tricks.trickPose;
    const fpv = this.rig.mode === 'fpv';
    this.player.sync(dt, { trick: tp?.name ?? null, trickW: this.tricks.trickWeight, firstPerson: fpv, night: this.atmo.night });
    this.rig.update(dt, this.camTarget(), ctl.lookX, ctl.lookY);
    this.updateFx(dt);
    this.updateAudio(dt);
    this.updateWorld(dt);
    this.mp.update(dt, this.snapshot());
    if (this.gateArrow.visible) this.gateArrow.rotation.y += dt * 2;
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 1 / 20;
      this.hud.update(this.hudState());
    }
    this.renderer.render(this.scene, this.rig.cam);
  }

  // ------------------------------------------------------------------ à pied
  private frameFoot(dt: number, ctl: Controls): void {
    if (ctl.camera) {
      this.rig.mode = this.rig.mode === 'fpv' ? 'chase' : 'fpv';
      this.hud.toast(`Caméra : ${this.rig.mode === 'fpv' ? 'Vue subjective' : 'Troisième personne'}`, 'info', 1200);
    }
    const fpv = this.rig.mode === 'fpv';
    const w = this.walker;
    if (this.trans) this.updateTrans(dt);
    else {
      w.indoor = !!this.inBuilding;
      w.update(dt, { moveX: ctl.moveX, moveY: ctl.moveY, sprint: ctl.sprint, jump: ctl.footJump }, this.rig.footYaw);
      // voitures et piétons
      if (this.traffic.group.visible) {
        if (this.traffic.collide([{ x: w.x, z: w.z }], 0, 0, this.trafficHit)) {
          w.x += this.trafficHit.pushX;
          w.z += this.trafficHit.pushZ;
          if (this.trafficHit.relSpeed > 6) {
            this.prog.p.health = Math.max(0, this.prog.p.health - 20);
            this.hud.toast('Attention aux voitures !', 'bad');
            this.rig.shake(0.6);
          }
        }
        const [px, pz] = this.peds.push(w.x, w.z);
        w.x += px;
        w.z += pz;
        w.sync();
      }
      w.pose(this.player.rider, fpv);
      if (w.seat && !w.seat.lie) this.prog.p.health = Math.min(100, this.prog.p.health + dt * 1.2);
    }
    this.player.sync(dt, { trick: null, trickW: 0, firstPerson: false, night: this.atmo.night });
    this.updateMarkers();
    this.updateHealth(dt);
    if (this.prog.p.health <= 0) this.knockout();
    if (!this.trans) this.updateInteractions(ctl, dt);
    else this.showPrompt(null);
    const g = this.world.groundAt(w.x, w.z, w.y + 0.5, { h: 0, surf: 'asphalt', id: -1 }, 'foot');
    this.rig.updateFoot(dt, { x: w.x, y: w.y, z: w.z, yaw: w.yaw, forward: ctl.moveY > 0.3 && Math.abs(ctl.moveX) < 0.5, head: w.headPos(new THREE.Vector3()), groundY: g.h }, ctl.lookDX, ctl.lookDY, !!this.inBuilding);
    this.updateAudio(dt);
    this.updateWorld(dt);
    this.mp.update(dt, this.snapshot());
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 1 / 20;
      this.hud.update(this.hudState());
    }
    this.renderer.render(this.scene, this.rig.cam);
  }

  /** Descendre de la moto : béquille, pilote détaché, animation de la jambe qui passe au-dessus de la selle. */
  private dismount(): void {
    const p = this.player.phys;
    const yaw = p.yaw;
    const { targets, matrix } = this.player.park();
    const seatZ = this.player.visual.seat.z;
    let side = new THREE.Vector3(0.62, 0, seatZ).applyMatrix4(matrix);
    // si un mur bloque à gauche, on descend à droite
    if (this.world.collideCapsule(side.x, side.z, side.y + 0.1, side.y + 1.7, 0.3, 0.45, this.wallHit, 'foot').hit) side = new THREE.Vector3(-0.62, 0, seatZ).applyMatrix4(matrix);
    this.walker.place(side.x, side.y + 0.4, side.z, yaw);
    const r = this.player.rider.root;
    r.position.set(0, 0, 0);
    r.rotation.set(0, 0, 0);
    this.walker.root.add(r);
    this.scene.add(this.walker.root);
    this.walker.root.updateMatrixWorld(true);
    const from = targets ? this.convertTargets(targets, matrix, this.walker.root.matrixWorld) : null;
    this.trans = { kind: 'off', t: 0, dur: 0.75, from, to: null };
    this.onFoot = true;
    this.rig.snapFoot(yaw);
    if (this.rig.mode !== 'fpv') this.rig.mode = 'chase';
    this.touch.setMode('foot');
    this.prog.p.lastPos = { x: p.x, z: p.z, yaw };
    this.prog.touch();
  }

  /** Remonter : le personnage se place à gauche de la moto puis enjambe la selle. */
  private mount(): void {
    const b = this.player;
    b.rig.outer.updateMatrixWorld(true);
    const M = b.visual.root.matrixWorld.clone();
    const side = new THREE.Vector3(0.62, 0, b.visual.seat.z).applyMatrix4(M);
    this.walker.seat = null;
    this.walker.place(side.x, side.y + 0.4, side.z, b.phys.yaw);
    this.walker.root.updateMatrixWorld(true);
    const from = idlePose(0);
    const seated = b.seatedTargets();
    const to = seated ? this.convertTargets(seated, M, this.walker.root.matrixWorld) : null;
    this.trans = { kind: 'on', t: 0, dur: 0.6, from, to };
  }

  private finishMount(): void {
    this.trans = null;
    this.scene.remove(this.walker.root);
    this.player.unpark();
    this.onFoot = false;
    this.touch.setMode('bike');
    this.rig.snap(this.camTarget());
    if (this.prog.fuel() <= 0) this.hud.toast('Réservoir vide : fais le plein (station, jerrican) ou appelle la dépanneuse (pause).', 'bad', 5000);
  }

  /** Remonte instantanément (téléportation, modes, menus). */
  private forceMount(): void {
    if (!this.onFoot && !this.trans) return;
    this.trans = null;
    this.walker.seat = null;
    this.scene.remove(this.walker.root);
    this.player.unpark();
    this.onFoot = false;
    this.touch?.setMode('bike');
  }

  private updateTrans(dt: number): void {
    const tr = this.trans!;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    const e = k * k * (3 - 2 * k);
    const swing = Math.sin(Math.PI * e);
    const idle = idlePose(0);
    let b: BodyTargets;
    if (tr.kind === 'off') b = tr.from ? lerpTargets(tr.from, idle, e) : idle;
    else b = tr.to ? lerpTargets(tr.from ?? idle, tr.to, e) : idle;
    // la jambe droite passe au-dessus de la selle
    b.footR = b.footR.clone();
    b.footR.y += swing * 0.55;
    b.footR.z -= swing * 0.35;
    b.firstPerson = this.rig.mode === 'fpv';
    this.player.rider.poseFree(b);
    if (k >= 1) {
      if (tr.kind === 'on') this.finishMount();
      else this.trans = null;
    }
  }

  private convertTargets(t: BodyTargets, from: THREE.Matrix4, to: THREE.Matrix4): BodyTargets {
    const m = to.clone().invert().multiply(from);
    const v = (p: THREE.Vector3) => p.clone().applyMatrix4(m);
    return { ...t, pelvis: v(t.pelvis), footL: v(t.footL), footR: v(t.footR), handL: v(t.handL), handR: v(t.handR), reach: false };
  }

  // ------------------------------------------------------------------ interactions
  /** Point le plus proche avec lequel interagir (bâtiments, défis, moto). */
  private updateInteractions(ctl: Controls, dt: number): void {
    const foot = this.onFoot;
    const w = this.walker;
    const p = this.player.phys;
    const x = foot ? w.x : p.x, z = foot ? w.z : p.z;
    const y = foot ? w.y : p.y - p.comHeight;
    let best: { label: string; action: () => void; d: number } | null = null;
    const consider = (label: string | null, action: () => void, d: number) => {
      if (label && (!best || d < best.d)) best = { label, action, d };
    };
    for (const it of this.city.interiors.interactables) {
      if (it.mode !== 'both' && it.mode !== (foot ? 'foot' : 'bike')) continue;
      const dx = it.x - x, dz = it.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > it.r * it.r || Math.abs(it.y - y) > 1.6) continue;
      consider(it.label(), it.action, Math.sqrt(d2));
    }
    // défis du quartier (marqueurs) : touche dédiée (Entrée / croix gauche / bouton)
    let defi: string | null = null;
    if (this.mode instanceof FreeRide && !this.testRide) {
      for (const m of this.markers) {
        const d = Math.hypot(x - m.x, z - m.z);
        if (d < 4.5 && Math.abs(y - m.y) < 3 && (foot || p.kmh < 25)) {
          const names = m.ids.map((id) => CHALLENGES.find((c) => c.id === id)!.name);
          defi = `Défi${names.length > 1 ? 's' : ''} ici : ${names.join(' · ')}`;
        }
      }
    }
    if (defi && ctl.challenges) this.openSpotChallenges();
    // moto : monter / descendre
    let alt: { label: string; action: () => void } | null = null;
    if (foot && !w.seat) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 1.9 && Math.abs(y - (p.y - p.comHeight)) < 1.2) consider(`Monter sur la ${bikeName(this.player.spec)}`, () => this.mount(), d - 0.3);
    } else if (foot && w.seat) {
      consider('Se lever', () => w.standUp(), 0);
    }
    if (!foot && this.canDismount()) {
      if (best) alt = { label: 'Descendre de la moto', action: () => this.dismount() };
      else consider('Descendre de la moto', () => this.dismount(), 0);
    }
    this.showPrompt(best, alt, defi);
    // déclenchement : appui court = action, appui long (0,45 s) = descendre de la moto
    if (ctl.interact && !this.input.interactHeld) {
      // tactile (bouton ACTION)
      if (best) (best as { action: () => void }).action();
      this.holdT = -1;
    } else if (ctl.interact) this.holdT = 0;
    if (this.holdT >= 0) {
      if (this.input.interactHeld) {
        this.holdT += dt;
        if (this.holdT > 0.45 && alt) {
          this.holdT = -1;
          (alt as { action: () => void }).action();
        }
      } else {
        if (best) (best as { action: () => void }).action();
        this.holdT = -1;
      }
    }
  }

  private canDismount(): boolean {
    const p = this.player.phys;
    return !this.onFoot && !this.trans && !this.player.wreck && !p.airborne && p.state === 'ground' && p.speed < 1.6 && this.mode instanceof FreeRide && !this.testRide;
  }

  private showPrompt(best: { label: string; action: () => void } | null, alt: { label: string; action: () => void } | null = null, defi: string | null = null): void {
    const el = this.promptEl!;
    const touchUi = !document.getElementById('touch')!.classList.contains('hidden');
    this.touch.setAction(!!best);
    this.curAction = best?.action ?? null;
    this.altAction = alt?.action ?? null;
    const key = best || defi ? `${best?.label ?? ''}|${alt?.label ?? ''}|${defi ?? ''}|${touchUi}|${this.input.lastDevice}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (!best && !defi) {
      el.classList.add('hidden');
      return;
    }
    const pad = this.input.lastDevice === 'gamepad';
    el.innerHTML = '';
    const hint = touchUi ? '' : pad ? 'Y' : 'F';
    if (best) el.append(h('div', {}, hint ? h('span', { class: 'key' }, hint) : null, best.label));
    if (best && alt && !touchUi) el.append(h('div', { class: 'alt' }, `Maintenir ${hint} : ${alt.label.toLowerCase()}`));
    if (defi) el.append(h('div', { class: best ? 'alt' : '', style: 'color:#ff2bd6;font-weight:700' }, touchUi ? '' : h('span', { class: 'key' }, pad ? '◀' : 'Entrée'), defi));
    if (touchUi) {
      const row = h('div', { class: 'row' });
      if (best) row.append(h('button', { class: 'btn small pink', onclick: (e: Event) => { e.stopPropagation(); this.curAction?.(); } }, 'OK'));
      if (alt) row.append(h('button', { class: 'btn small', onclick: (e: Event) => { e.stopPropagation(); this.altAction?.(); } }, alt.label));
      if (defi) row.append(h('button', { class: 'btn small', onclick: (e: Event) => { e.stopPropagation(); this.openSpotChallenges(); } }, 'Voir les défis'));
      el.append(row);
    }
    el.onclick = () => (this.curAction ? this.curAction() : defi ? this.openSpotChallenges() : undefined);
    el.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ santé, carburant, état
  private updateHealth(dt: number): void {
    const pr = this.prog.p;
    if (pr.health > 0 && pr.health < 100) pr.health = Math.min(100, pr.health + dt * 0.1);
  }

  private knockout(): void {
    this.forceMount();
    const fee = Math.min(this.prog.p.money, 150);
    this.prog.p.money -= fee;
    this.prog.p.health = 60;
    this.prog.save();
    const s = spotById('garage');
    this.teleportTo(s.x, s.z, s.yaw);
    this.hud.toast(`K.O. ! Tu te réveilles devant ton garage. Soins : ${fee} $.`, 'bad', 5000);
  }

  /** Consommation d'essence calculée sur la puissance délivrée (réservoir réel du modèle). */
  private consumeFuel(dt: number): void {
    if (this.testRide || this.player.wreck) return;
    const o = this.prog.owned;
    if (!o) return;
    const fuel = this.prog.fuel();
    if (fuel <= 0) return;
    const e = this.player.phys.engine;
    const sp = this.player.spec;
    const peakKW = estimateHp(sp) * 0.7355 * this.player.phys.tuning.torqueMult;
    const kw = 0.12 + peakKW * e.throttleEff * clamp(e.rpm / sp.redline, 0.12, 1);
    const used = (fuelFlowLph(kw, sp.stroke as 2 | 4) * dt) / 3600;
    o.fuel = Math.max(0, fuel - used);
    const tank = this.prog.tank();
    if (fuel > tank * 0.15 && o.fuel <= tank * 0.15) this.hud.toast(`Réserve ! Il reste ${o.fuel.toFixed(1)} L.`, 'bad', 4000);
    if (o.fuel <= 0) this.hud.toast('Panne sèche ! Jerrican (sac), station-service ou dépanneuse (pause).', 'bad', 6000);
    this.fuelTouch += dt;
    if (this.fuelTouch > 5) {
      this.fuelTouch = 0;
      this.prog.touch();
    }
  }

  /** Effets de l'état mécanique : puissance réduite, guidon tordu, phare cassé. */
  private applyCondition(): void {
    const c = Math.round(this.prog.cond());
    if (c === this.condApplied || this.testRide) return;
    this.condApplied = c;
    const base = tuningFromConfig(this.player.spec, this.player.cfg).torqueMult;
    this.player.phys.tuning.torqueMult = base * (0.7 + 0.3 * clamp((c - 20) / 50, 0, 1));
    this.player.barBend = c < 70 ? ((70 - c) / 70) * 0.14 : 0;
    this.player.lightBroken = c < 25;
  }

  // ------------------------------------------------------------------ hôte des bâtiments
  private buildingHost(): BuildingHost {
    const pr = () => this.prog.p;
    return {
      openGarageUI: (tab, id) => this.openGarageTab(tab, id),
      takeBike: (id, x, z, yaw) => this.takeBike(id, x, z, yaw),
      bikeForSale: (id) => this.showBikeForSale(id),
      workshop: (b) => this.showWorkshop(b),
      apparel: (slot) => this.showApparel(slot as ApparelSlot),
      shop: (k) => this.showShop(k),
      refuelLabel: () => this.refuelInfo()?.label ?? null,
      refuel: () => this.refuel(),
      talk: (n) => this.showTalk(n),
      challenges: () => this.openSpotChallenges(),
      cycleMusic: () => {
        const s = pr().settings;
        s.musicStyle = (s.musicStyle + 1) % 3;
        s.music = true;
        this.prog.save();
        this.applyAudioSettings();
        return this.audio.music?.styles[s.musicStyle] ?? 'musique';
      },
      sit: (s) => this.walker.sit(s),
      sleep: (s) => this.sleep(s),
      freeDrink: (id) => this.freeDrink(id),
      findCash: (id, amt) => {
        if (pr().found.includes(id)) return;
        pr().found.push(id);
        this.prog.addMoney(amt, 'Trouvaille');
        this.audio.money();
        this.hud.toast(`Trouvaille : ${amt} $ dans le sac abandonné !`, 'gold', 4000);
        this.prog.save();
      },
      found: (id) => pr().found.includes(id),
      notify: (t) => this.hud.toast(t, 'info', 3500),
      ownedDisplay: () => Object.keys(pr().bikes).filter((id) => id !== pr().current).map((id) => ({ id, cfg: pr().bikes[id].config })),
      ownsBike: (id) => !!pr().bikes[id],
      riding: () => !this.onFoot,
    };
  }

  private openPanel(build: () => import('./ui/panel').PanelContent): void {
    this.state = 'dialog';
    this.showPrompt(null);
    this.panel.show(build);
  }

  private closePanel(): void {
    if (this.state === 'dialog') {
      this.state = 'ride';
      this.delta();
    }
  }

  private openGarageTab(tab: GarageTab, id?: string): void {
    if (this.panel.open) this.panel.close();
    this.garageReturn = 'world';
    this.menus.close();
    this.showPrompt(null);
    this.state = 'garage';
    document.getElementById('hud')!.classList.add('hidden');
    document.getElementById('touch')!.classList.add('hidden');
    this.input.enabled = false;
    this.garage.openAt(tab, id);
  }

  private takeBike(id: string, x: number, z: number, yaw: number): void {
    const pr = this.prog.p;
    if (!pr.bikes[id] || id === pr.current) return;
    const prev = this.player.spec;
    pr.current = id;
    this.prog.save();
    this.player.setBike(BIKE_BY_ID[id], structuredClone(pr.bikes[id].config));
    this.player.phys.reset(x, z, yaw);
    this.onBikeChanged();
    this.condApplied = -1;
    this.hud.toast(`Tu prends la ${bikeName(BIKE_BY_ID[id])}. La ${bikeName(prev)} est rangée au garage.`, 'good', 4000);
  }

  private money(v: number): string {
    return `${Math.round(v).toLocaleString('fr-FR')} $`;
  }

  private showBikeForSale(id: string): void {
    const spec = BIKE_BY_ID[id];
    this.openPanel(() => {
      const own = !!this.prog.p.bikes[id];
      const can = this.prog.canBuy(spec);
      const r = spec.real;
      const rows: PanelRow[] = [
        { title: `${CLASS_LABEL[spec.cls]} · ${spec.cc} cm³ · ${spec.stroke} temps`, sub: `${estimateHp(spec).toFixed(0)} ch · ${spec.mass.toFixed(0)} kg plein fait · réservoir ${r?.fuel ?? '?'} L`, buttons: [] },
      ];
      if (r) rows.push({ title: `Cotes reprises de : ${r.ref}`, sub: `Empattement ${r.wheelbase} mm · selle ${r.seat} mm · garde au sol ${r.ground} mm · pneus ${r.tireF} / ${r.tireR}`, buttons: [] });
      return {
        title: bikeName(spec),
        subtitle: own ? 'Déjà dans ton garage' : spec.price ? `Prix : ${this.money(spec.price)} — niveau ${spec.level} requis` : 'Offerte',
        rows,
        footer: `Ton argent : ${this.money(this.prog.p.money)}`,
        actions: [
          { label: own ? 'Possédée' : can.ok ? `Acheter (${this.money(spec.price)})` : can.why ?? 'Indisponible', primary: true, disabled: own || !can.ok, onClick: () => {
            const prev = this.prog.p.current;
            if (this.prog.buyBike(id)) {
              this.prog.p.current = prev;
              this.prog.save();
              this.audio.ui('buy');
              this.city.interiors.markGarageDirty();
              this.hud.toast(`${bikeName(spec)} livrée dans ton garage (prends-la sur son emplacement).`, 'good', 5000);
            }
          } },
          { label: 'Essai 90 s', onClick: () => { this.panel.close(); this.startTestRide(id); } },
          { label: 'Configurer', onClick: () => this.openGarageTab('shop', id) },
        ],
      };
    });
  }

  /** La moto est-elle garée dans (ou devant) le bâtiment ? */
  private bikeNear(buildingId: string, margin = 8): boolean {
    const b = this.city.interiors.buildings.find((x) => x.id === buildingId);
    if (!b) return false;
    const p = this.player.phys;
    return p.x > b.x0 - margin && p.x < b.x1 + margin && p.z > b.z0 - margin && p.z < b.z1 + margin;
  }

  private showWorkshop(buildingId: string): void {
    const meca = this.city.interiors.npcs.find((n) => n.o.id === 'meca');
    const line = meca?.nextLine() ?? '';
    this.openPanel(() => {
      const spec = this.player.spec;
      const cond = this.prog.cond();
      const cost = repairCost(spec.price || 1500, cond);
      const near = this.bikeNear(buildingId);
      const rows: PanelRow[] = [
        {
          title: `Remise à neuf — état ${Math.round(cond)} %`, right: cond >= 99.5 ? 'OK' : this.money(cost),
          sub: near ? 'Guidon, leviers, plastiques, réglages moteur. La puissance revient à 100 %.' : 'Amène ta moto dans l’atelier (ou devant le rideau).',
          buttons: [{ label: 'Réparer', primary: true, disabled: !near || cond >= 99.5 || this.prog.p.money < cost, onClick: () => {
            this.prog.p.money -= cost;
            this.prog.setCond(100);
            this.condApplied = -1;
            this.audio.ui('buy');
            this.hud.toast(`${bikeName(spec)} remise à neuf (−${this.money(cost)}).`, 'good');
            this.prog.save();
          } }],
        },
        { title: 'Pièces et accessoires', sub: 'Plastiques, jantes, pneus, guidon, selle, échappement, barre de 12h…', buttons: [{ label: 'Ouvrir', onClick: () => this.openGarageTab('parts') }] },
        { title: 'Performances', sub: 'Moteur, démultiplication, suspensions, freins.', buttons: [{ label: 'Ouvrir', onClick: () => this.openGarageTab('perf') }] },
        { title: 'Peinture et déco', sub: 'Couleurs, kit déco, numéro de plaque.', buttons: [{ label: 'Ouvrir', onClick: () => this.openGarageTab('paint') }] },
      ];
      return { title: 'Atelier moto', subtitle: `${bikeName(spec)} · ${this.money(this.prog.p.money)}`, speech: line ? { who: meca!.o.name, text: line } : undefined, rows };
    });
  }

  private showApparel(slot: ApparelSlot): void {
    this.openPanel(() => {
      const r = this.prog.p.rider as unknown as Record<string, unknown>;
      const rows: PanelRow[] = (APPAREL[slot] as { value: unknown; name: string; price: number }[]).map((o) => {
        const owned = this.prog.apparelOwned(slot, o.value, o.price);
        const worn = r[slot] === o.value;
        return {
          title: o.name, right: owned ? 'possédé' : this.money(o.price),
          buttons: [{ label: worn ? 'Porté' : owned ? 'Porter' : 'Acheter et porter', primary: !worn, disabled: worn || (!owned && this.prog.p.money < o.price), onClick: () => {
            if (!this.prog.buyApparel(slot, o.value, o.price)) return;
            r[slot] = o.value;
            this.prog.save();
            this.player.setRider(this.prog.p.rider);
            this.mp.sendBike(this.player.spec.id, this.player.cfg, this.prog.p.rider);
            this.audio.ui('buy');
          } }],
        };
      });
      return { title: `MX Gear — ${APPAREL_LABEL[slot]}`, subtitle: `Ton argent : ${this.money(this.prog.p.money)} — l'article est visible tout de suite sur ton personnage.`, rows, actions: [{ label: 'Cabine (couleurs, motifs)', onClick: () => this.openGarageTab('rider') }] };
    });
  }

  private showShop(kind: ShopKind): void {
    const who = this.city.interiors.npcs.find((n) => n.o.id === (kind === 'fastfood' ? 'burger' : 'caissier'));
    const line = who?.nextLine();
    this.openPanel(() => {
      const rows: PanelRow[] = ITEMS.filter((i) => i.shop === kind).map((it) => {
        const n = this.prog.p.inv[it.id] ?? 0;
        const btns = [{ label: it.instant ? 'Commander' : 'Acheter', primary: true, disabled: this.prog.p.money < it.price, onClick: () => {
          this.prog.p.money -= it.price;
          this.audio.ui('buy');
          if (it.instant) this.useEffect(it.id);
          else this.prog.addItem(it.id, 1);
          this.prog.save();
        } }];
        if (!it.instant && n > 0) btns.push({ label: `Utiliser (${n})`, primary: false, disabled: false, onClick: () => this.useItem(it.id) });
        return { title: it.name, sub: it.desc, right: this.money(it.price), buttons: btns };
      });
      return {
        title: kind === 'fastfood' ? 'Burger Street' : 'Supérette 24/7',
        subtitle: `Ton argent : ${this.money(this.prog.p.money)} · santé ${Math.round(this.prog.p.health)} / 100`,
        speech: line && who ? { who: who.o.name, text: line } : undefined,
        rows,
        footer: kind === 'fastfood' ? 'Les plats sont mangés sur place.' : 'Les articles vont dans ton sac (menu pause → Sac).',
      };
    });
  }

  /** Sac : articles utilisables n'importe où. */
  showInventory(): void {
    this.menus.close();
    this.openPanel(() => {
      const ids = Object.keys(this.prog.p.inv).filter((k) => (this.prog.p.inv[k] ?? 0) > 0);
      const rows: PanelRow[] = ids.map((id) => {
        const it = ITEM_BY_ID[id];
        return { title: `${it?.name ?? id} × ${this.prog.p.inv[id]}`, sub: it?.desc, buttons: [{ label: 'Utiliser', primary: true, onClick: () => this.useItem(id) }] };
      });
      return {
        title: 'Sac',
        subtitle: `Santé ${Math.round(this.prog.p.health)} / 100 · ${bikeName(this.player.spec)} : ${this.prog.fuel().toFixed(1)} / ${this.prog.tank()} L, état ${Math.round(this.prog.cond())} %`,
        rows: rows.length ? rows : [{ title: 'Ton sac est vide', sub: 'La supérette de la station vend boissons, sandwichs, jerricans et kits de réparation.', buttons: [] }],
      };
    });
  }

  private useItem(id: string): void {
    if ((this.prog.p.inv[id] ?? 0) <= 0) return;
    if (this.useEffect(id)) this.prog.addItem(id, -1);
    this.prog.save();
  }

  /** Applique l'effet d'un article ; renvoie false s'il ne peut pas être utilisé ici. */
  private useEffect(id: string): boolean {
    const it = ITEM_BY_ID[id];
    if (!it) return false;
    const e = it.effect;
    const nearBike = !this.onFoot || Math.hypot(this.walker.x - this.player.phys.x, this.walker.z - this.player.phys.z) < 4;
    if ((e.fuel || e.repair) && !nearBike) {
      this.hud.toast('Approche-toi de ta moto pour l’utiliser.', 'bad');
      return false;
    }
    if (e.fuel) {
      if (this.prog.fuel() >= this.prog.tank() - 0.05) {
        this.hud.toast('Le réservoir est déjà plein.', 'info');
        return false;
      }
      this.prog.setFuel(this.prog.fuel() + e.fuel);
      this.hud.toast(`+${e.fuel} L : ${this.prog.fuel().toFixed(1)} / ${this.prog.tank()} L`, 'good');
    }
    if (e.repair) {
      if (this.prog.cond() >= 99.5) {
        this.hud.toast('La moto est déjà en parfait état.', 'info');
        return false;
      }
      this.prog.setCond(this.prog.cond() + e.repair);
      this.condApplied = -1;
      this.hud.toast(`Réparation de fortune : état ${Math.round(this.prog.cond())} %`, 'good');
    }
    if (e.health) this.prog.p.health = Math.min(100, this.prog.p.health + e.health);
    if (e.stamina) this.walker.stamina = 1;
    if (e.boost) this.walker.boost = Math.max(this.walker.boost, e.boost);
    if (e.health && !e.fuel && !e.repair) this.hud.toast(`${it.name} : santé ${Math.round(this.prog.p.health)} / 100${e.boost ? ` · course illimitée ${e.boost} s` : ''}`, 'good');
    return true;
  }

  private freeDrink(id: string): void {
    const f = this.prog.p.fridge;
    const today = new Date().toISOString().slice(0, 10);
    if (f.date !== today) {
      f.date = today;
      f.used = [];
    }
    if (f.used.includes(id)) {
      this.hud.toast('Le frigo est vide pour aujourd’hui.', 'info');
      return;
    }
    f.used.push(id);
    this.prog.p.health = Math.min(100, this.prog.p.health + 10);
    this.walker.stamina = 1;
    this.walker.boost = Math.max(this.walker.boost, 45);
    this.prog.save();
    this.hud.toast('Boisson fraîche : +10 santé, course illimitée 45 s.', 'good');
  }

  private refuelInfo(): { label: string; liters: number; price: number } | null {
    const p = this.player.phys;
    const near = !this.onFoot || Math.hypot(this.walker.x - p.x, this.walker.z - p.z) < 6;
    if (!near) return { label: 'Amène ta moto à la pompe pour faire le plein', liters: 0, price: 0 };
    const liters = this.prog.tank() - this.prog.fuel();
    if (liters < 0.05) return { label: `Réservoir plein (${this.prog.tank()} L)`, liters: 0, price: 0 };
    const unit = this.player.spec.stroke === 2 ? 2.1 : 1.95;
    const price = Math.max(1, Math.round(liters * unit * 100) / 100);
    return { label: `Faire le plein : ${liters.toFixed(1)} L — ${price.toFixed(2).replace('.', ',')} $`, liters, price };
  }

  private refuel(): void {
    const r = this.refuelInfo();
    if (!r || r.liters <= 0) return;
    const pay = Math.ceil(r.price);
    if (this.prog.p.money < pay) {
      this.hud.toast('Pas assez d’argent pour faire le plein.', 'bad');
      return;
    }
    this.prog.p.money -= pay;
    this.prog.setFuel(this.prog.tank());
    this.audio.money();
    this.hud.toast(`Plein fait : ${r.liters.toFixed(1)} L (−${pay} $)`, 'good');
    this.prog.save();
  }

  private showTalk(n: Npc): void {
    const services: Record<string, { label: string; run: () => void }> = {
      meca: { label: 'Réparer / entretenir', run: () => { this.panel.close(); this.showWorkshop('atelier'); } },
      vendeur: { label: 'Catalogue complet', run: () => this.openGarageTab('shop') },
      gear: { label: 'Cabine (couleurs, motifs)', run: () => this.openGarageTab('rider') },
      caissier: { label: 'Acheter', run: () => { this.panel.close(); this.showShop('superette'); } },
      burger: { label: 'Commander', run: () => { this.panel.close(); this.showShop('fastfood'); } },
      'local-3': { label: 'Défis du quartier', run: () => { this.panel.close(); this.openSpotChallenges(); } },
    };
    let line = n.nextLine();
    const svc = services[n.o.id];
    this.openPanel(() => ({
      title: n.o.name,
      speech: { who: n.o.name, text: line },
      rows: [],
      actions: [
        { label: 'Autre chose ?', onClick: () => { line = n.nextLine(); } },
        ...(svc ? [{ label: svc.label, primary: true, onClick: () => svc.run() }] : []),
      ],
    }));
  }

  private sleep(s: SeatSpot): void {
    this.walker.sit({ ...s, lie: true });
    const fade = document.getElementById('fade')!;
    fade.style.opacity = '1';
    setTimeout(() => {
      this.atmo.setTime(8);
      this.prog.p.health = 100;
      this.walker.stamina = 1;
      this.prog.save();
      fade.style.opacity = '0';
      this.hud.toast('Tu as dormi jusqu’à 8 h : santé et endurance au maximum.', 'good', 4000);
    }, 900);
  }

  /** Dépanneuse : ramène la moto près du joueur (à pied) ou à la station avec 3 L (en panne). */
  towBike(): void {
    const fee = 60;
    if (this.prog.p.money < fee) {
      this.hud.toast('Pas assez d’argent pour la dépanneuse (60 $).', 'bad');
      return;
    }
    this.prog.p.money -= fee;
    if (this.onFoot) {
      const w = this.walker;
      const x = w.x + Math.sin(w.yaw + 1.2) * 2.2, z = w.z + Math.cos(w.yaw + 1.2) * 2.2;
      const g = this.world.groundAt(x, z, w.y + 1, { h: 0, surf: 'asphalt', id: -1 });
      this.player.phys.reset(x, z, w.yaw, g.h);
      this.hud.toast('La dépanneuse a déposé ta moto à côté de toi (−60 $).', 'good');
    } else {
      this.forceMount();
      const s = spotById('station');
      this.teleportTo(-232, -18, Math.PI);
      if (this.prog.fuel() < 3) this.prog.setFuel(3);
      void s;
      this.hud.toast('Dépanneuse : te voilà à la station avec 3 L d’essence (−60 $).', 'good');
    }
    this.prog.save();
  }

  isOnFoot(): boolean {
    return this.onFoot;
  }

  /** Lumières des pièces + facteur « intérieur » de l'atmosphère. */
  private updateRooms(dt: number, x: number, y: number, z: number): void {
    const b = this.city.interiors.buildingAt(x, y, z);
    this.inBuilding = b;
    const indoorTarget = b ? (b.id === 'entrepot' ? 0.5 : 1) : 0;
    this.atmo.indoor = this.atmo.indoor + (indoorTarget - this.atmo.indoor) * Math.min(1, dt * 3);
    const anchors = b && b.lightsOn ? b.lights.filter((l) => Math.abs(l.y - (y + 2.2)) < 2.6).sort((a, c) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((c.x - x) ** 2 + (c.z - z) ** 2)).slice(0, this.roomLights.length) : [];
    this.roomLights.forEach((l, i) => {
      const a = anchors[i];
      if (!a) {
        l.intensity = 0;
        return;
      }
      l.position.copy(a);
      l.intensity = b!.id === 'entrepot' ? 5 : 13;
    });
  }

  private updateWorld(dt: number): void {
    const p = this.player.phys;
    const w = this.walker;
    const foot = this.onFoot;
    const fx = foot ? w.x : p.x, fy = foot ? w.y + 1 : p.y, fz = foot ? w.z : p.z;
    const focus = new THREE.Vector3(fx, fy, fz);
    this.updateRooms(dt, fx, foot ? w.y : p.y - p.comHeight, fz);
    this.city.interiors.update(dt, this.rig.cam.position.x, this.rig.cam.position.z, fx, foot ? w.y : p.y - p.comHeight, fz, foot);
    this.atmo.update(dt, this.rig.cam, focus);
    this.city.update(this.rig.cam.position.x, this.rig.cam.position.z, this.atmo.viewDist, this.atmo.night, this.atmo.wetness);
    this.player.phys.wetness = this.atmo.wetness;
    if (this.traffic.group.visible) {
      this.traffic.update(dt, fx, fz, foot ? 0 : p.vx, foot ? 0 : p.vz, this.atmo.night);
      this.city.setTrafficBulbs((i, j) => this.traffic.lightPhase(i, j));
    }
    if (this.peds.group.visible) this.peds.update(dt, fx, fz, foot ? w.speed : p.speed);
    this.particles.update(dt, 0.35 + 0.65 * (1 - this.atmo.night * 0.6));
  }

  private dustBurst(x: number, y: number, z: number, impact: number): void {
    const loose = isLoose(this.player.phys.rear.surf);
    const n = Math.min(14, Math.round(impact * 2));
    for (let i = 0; i < n; i++) this.particles.emit(loose ? 'dust' : 'smoke', x, y + 0.1, z, 0, 0, 0, loose ? 1 : 0.5);
  }

  private updateFx(dt: number): void {
    const p = this.player.phys;
    if (this.player.wreck) {
      if (this.player.wreckScrape > 2) {
        const o = this.player.rig.outer.position;
        for (let i = 0; i < 2; i++) this.particles.emit('spark', o.x, o.y - 0.25, o.z, 0, 0, 0);
      }
      return;
    }
    const wet = this.atmo.wetness > 0.4;
    for (const [w, key] of [[p.rear, 'r'], [p.front, 'f']] as const) {
      const sk = w.contact ? w.skid : 0;
      const loose = isLoose(w.surf);
      if (sk > 0.15 && Math.random() < sk * dt * 60) {
        if (loose) this.particles.emit('dust', w.cx, w.cy + 0.05, w.cz, -p.vx * 0.2, 0, -p.vz * 0.2, sk);
        else if (wet) this.particles.emit('splash', w.cx, w.cy + 0.05, w.cz, p.vx, 0, p.vz, sk);
        else this.particles.emit('smoke', w.cx, w.cy + 0.1, w.cz, p.vx, 0, p.vz, sk);
      }
      if (!loose && w.contact) this.skids.add(key, w.cx, w.cy, w.cz, sk, key === 'r' ? 0.09 : 0.07);
      else this.skids.add(key, 0, 0, 0, 0);
      // terre projetée par la roue arrière en accélération
      if (key === 'r' && loose && w.contact && p.throttle > 0.4 && p.speed > 3 && Math.random() < dt * 30) {
        this.particles.emit('dust', w.cx, w.cy + 0.05, w.cz, -p.vx * 0.3, 0, -p.vz * 0.3, 0.6);
      }
    }
    if (p.scrape > 0.5 && Math.random() < 0.7) this.particles.emit('spark', p.scrapeX, p.scrapeY + 0.05, p.scrapeZ, p.vx, 0, p.vz);
    // échappement : fumée bleue 2T au ralenti / reprises
    const tip = this.player.modelToWorld(this.player.visual.exhaustTip, new THREE.Vector3());
    const twoT = this.player.spec.stroke === 2;
    if (Math.random() < dt * (twoT ? 10 : 4) * (0.3 + p.throttle)) this.particles.emit('exhaust', tip.x, tip.y, tip.z, -Math.sin(p.yaw) * 1.2, 0, -Math.cos(p.yaw) * 1.2, twoT ? 1.2 : 0.6);
    // pétarades 4T au lever de gaz
    if (!twoT && p.engine.throttleEff < 0.05 && p.rpm > p.spec.redline * 0.55 && Math.random() < dt * 3) this.audio.backfire();
  }

  private updateAudio(dt: number): void {
    if (!this.audio.ready) return;
    const p = this.player.phys;
    const e = p.engine;
    const crashed = !!this.player.wreck;
    const off = this.player.parked || (this.prog.fuel() <= 0 && !this.testRide);
    const loud = this.player.cfg ? { stock: 0.25, sport: 0.55, titanium: 0.8, carbon: 0.7 }[this.player.cfg.exhaust] : 0.3;
    this.audio.player?.set({
      rpm: crashed ? this.player.spec.idleRpm : e.rpm,
      load: crashed ? 0 : e.load,
      vol: off ? 0 : crashed ? Math.max(0, 0.6 - this.player.wreckTime * 0.3) : 0.75 + e.throttleEff * 0.25,
      loud,
      whine: this.player.spec.cls === 'scooter' ? p.speed * 18 : 0,
    });
    const rear = p.rear;
    this.audio.updateLoops({
      skid: crashed ? 0 : Math.max(rear.contact ? rear.skid : 0, p.front.contact ? p.front.skid : 0, Math.abs(p.slipAngle) > 0.25 ? 0.6 : 0),
      skidLoose: isLoose(rear.surf),
      speed: p.speed,
      city: 1,
      rain: this.atmo.weather === 'rain' ? 1 : 0,
      scrape: crashed ? (this.player.wreckScrape > 1 ? 1 : 0) : p.scrape,
      night: this.atmo.night,
    });
    const cam = this.rig.cam;
    const f = new THREE.Vector3();
    cam.getWorldDirection(f);
    this.audio.setListener(cam.position.x, cam.position.y, cam.position.z, f.x, f.z);
    // voitures proches
    if (this.traffic.group.visible) {
      this.audio.ensureTrafficVoices(2);
      const near = [...this.traffic.cars].sort((a, b) => (a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 - ((b.pos.x - p.x) ** 2 + (b.pos.z - p.z) ** 2)).slice(0, 2);
      this.audio.traffic.forEach((v, i) => {
        const c = near[i];
        if (!c) return v.set({ vol: 0 });
        v.setPos(c.pos.x, 0.6, c.pos.z);
        v.set({ rpm: 900 + c.speed * 180, load: 0.3, vol: 0.55, loud: 0.1, whine: 0 });
      });
    } else this.audio.traffic.forEach((v) => v.set({ vol: 0 }));
    // joueurs distants
    const remotes = [...this.mp.players.values()].filter((r) => r.avatar?.state);
    if (remotes.length) {
      this.audio.ensureRemoteVoices(Math.min(3, remotes.length), remotes.map((r) => (BIKE_BY_ID[r.bike]?.sound ?? '4t-mx') as EngineKind));
      this.audio.remote.forEach((v, i) => {
        const r = remotes[i];
        if (!r?.avatar?.state) return v.set({ vol: 0 });
        const s = r.avatar.state;
        v.setPos(s.x, s.y, s.z);
        v.set({ rpm: s.rpm, load: s.thr, vol: 0.8 });
      });
    } else this.audio.remote.forEach((v) => v.set({ vol: 0 }));
    void dt;
  }

  private camTarget() {
    const p = this.player.phys;
    const g = this.world.groundAt(p.x, p.z, p.y + 0.5, { h: 0, surf: 'asphalt', id: -1 });
    const w = this.player.wreck ? this.player.wreckPos : null;
    return {
      x: w ? w.x : p.x, y: w ? w.y + 0.3 : p.y, z: w ? w.z : p.z, yaw: p.yaw, pitch: p.pitch, roll: p.roll, speed: w ? 0 : p.speed, vx: p.vx, vz: p.vz,
      wheelie: p.state === 'wheelie' && p.pitch > 0.18, airborne: p.airborne, head: this.player.headWorld.clone().add(new THREE.Vector3(Math.sin(p.yaw) * 0.12, 0.05, Math.cos(p.yaw) * 0.12)), groundY: g.h,
    };
  }

  private statusLine(): { status: string; foot: boolean; alert: string | null } {
    const pr = this.prog;
    const hp = Math.round(pr.p.health);
    const hpTxt = `<span class="${hp < 30 ? 'bad' : hp < 60 ? 'warn' : ''}">❤ <b>${hp}</b></span>`;
    if (this.testRide) return { status: hpTxt, foot: this.onFoot, alert: null };
    const fuel = pr.fuel(), tank = pr.tank(), cond = Math.round(pr.cond());
    const fuelTxt = `<span class="${fuel <= 0 ? 'bad' : fuel < tank * 0.15 ? 'warn' : ''}">⛽ <b>${fuel.toFixed(1).replace('.', ',')}</b>/${tank} L</span>`;
    const condTxt = `<span class="${cond < 30 ? 'bad' : cond < 70 ? 'warn' : ''}">🔧 <b>${cond}</b> %</span>`;
    let alert: string | null = null;
    if (!this.onFoot && fuel <= 0) alert = 'PANNE SÈCHE';
    else if (hp < 25) alert = 'SANTÉ FAIBLE — mange ou repose-toi';
    if (this.onFoot) {
      const st = Math.round(this.walker.stamina * 100);
      const boost = this.walker.boost > 0 ? ` · ⚡ ${Math.ceil(this.walker.boost)} s` : '';
      return { status: `${hpTxt} · 🏃 <b>${st}</b> %${boost} · ${fuelTxt} · ${condTxt}`, foot: true, alert };
    }
    return { status: `${hpTxt} · ${fuelTxt} · ${condTxt}`, foot: false, alert };
  }

  private pickSafe(): { x: number; z: number; yaw: number; y: number } {
    const now = performance.now();
    for (let i = this.safe.length - 1; i >= 0; i--) if (now - this.safe[i].t > 1800) return this.safe[i];
    if (this.safe.length) return this.safe[0];
    const s = spotById('garage');
    return { x: s.x, z: s.z, yaw: s.yaw, y: 0 };
  }

  private snapshot(): BikeSnapshot | null {
    const p = this.player.phys;
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, roll: p.roll, steer: p.steerVis, cf: p.front.comp, cr: p.rear.comp, rf: p.front.rot % 1000, rr: p.rear.rot % 1000, rpm: p.rpm, thr: p.engine.throttleEff };
  }

  private hudState(): HudState {
    const pr = this.prog.p;
    const p = this.player.phys;
    const s = pr.settings;
    const mph = s.units === 'mph';
    const cur = xpForLevel(pr.level), next = xpForLevel(pr.level + 1);
    const markers: HudState['markers'] = [];
    for (const g of this.gateMeshes) markers.push({ x: g.position.x, z: g.position.z, color: '#39ff6a', size: 7 });
    if (this.mode instanceof FreeRide) {
      for (const sp of SPOTS) markers.push({ x: sp.x, z: sp.z, color: sp.id === 'garage' ? '#ffcc33' : '#ff2bd6', size: 5 });
    }
    if (this.onFoot) markers.push({ x: p.x, z: p.z, color: '#39ff6a', size: 7 });
    for (const r of this.mp.players.values()) if (r.avatar?.state) markers.push({ x: r.avatar.state.x, z: r.avatar.state.z, color: '#4fc3ff', size: 7 });
    const live = this.tricks.live;
    const tp = this.tricks.trickPose;
    const e = p.engine;
    const loopDeg = (this.player.spec.cls === 'stunt' || this.player.phys.tuning.hasStuntBar ? 88 : 80);
    return {
      money: pr.money,
      level: pr.level,
      levelProgress: clamp((pr.xp - cur) / Math.max(1, next - cur), 0, 1),
      bikeName: (this.testRide ? `ESSAI ${Math.ceil(this.testRide.t)} s · ` : '') + bikeName(this.player.spec),
      speed: mph ? p.kmh * 0.621 : p.kmh,
      unit: mph ? 'MPH' : 'KM/H',
      rpm: e.rpm,
      redline: this.player.spec.redline,
      gear: e.isCVT ? 'A' : String(e.gear),
      clutch: this.clutchHeld && !e.isCVT,
      pitchDeg: p.pitch * RAD,
      balanceDeg: p.balanceAngle * RAD,
      loopDeg,
      wheelie: p.state === 'wheelie' || (p.pitch > 4 * DEG && p.rear.contact),
      trick: tp ? { label: tp.label.toUpperCase(), points: tp.points, sub: 'Tiens la figure… et pose-toi !' } : live,
      combo: this.tricks.combo.active ? { total: this.tricks.comboTotal, mult: this.tricks.combo.mult, timer: this.tricks.combo.timer } : null,
      mode: this.mode.hud(),
      goals: pr.daily.goals.map((g) => ({ g, p: this.prog.goalProgress(g) })),
      crashed: this.player.wreck ? { reason: p.crashReason, t: this.player.wreckTime } : null,
      camLabel: `${CAM_LABEL[this.rig.mode]} · ${Math.round(this.fps)} i/s`,
      player: this.onFoot ? { x: this.walker.x, z: this.walker.z, yaw: this.walker.yaw } : { x: p.x, z: p.z, yaw: p.yaw },
      markers,
      mpLines: this.mp.status === 'online' ? [`🌐 ${this.mp.room} : ${this.mp.players.size + 1} joueur(s)`] : [],
      ...this.statusLine(),
    };
  }
}

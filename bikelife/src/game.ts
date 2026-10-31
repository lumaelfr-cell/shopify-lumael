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
import { isLoose } from './physics/collision';
import { h } from './ui/dom';

type State = 'loading' | 'menu' | 'ride' | 'paused' | 'garage';

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
    this.rig.raycast = (ax, ay, az, bx, by, bz) => this.world.raycast(ax, ay, az, bx, by, bz);
    this.particles = new Particles(this.renderer.getPixelRatio());
    this.scene.add(this.particles.points, this.skids.mesh);
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
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
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
    this.atmo.time = hh;
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
    this.state = 'paused';
    this.menus.showPause();
  }

  respawn(): void {
    const s = this.pickSafe();
    this.player.reset(s.x, s.z, s.yaw, s.y);
    this.crashHandled = false;
    this.tricks.reset();
    this.skids.clear();
    this.rig.snap(this.camTarget());
    events.emit('respawn', {});
  }

  toMainMenu(): void {
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
    this.menus.close();
    this.state = 'garage';
    document.getElementById('hud')!.classList.add('hidden');
    document.getElementById('touch')!.classList.add('hidden');
    this.input.enabled = false;
    this.garage.open();
  }

  private garageReturn: 'menu' | 'ride' = 'menu';

  private closeGarage(ride: boolean): void {
    this.garage.close();
    this.input.enabled = true;
    this.onBikeChanged();
    if (ride) {
      if (!(this.mode instanceof FreeRide) && !this.testRide) this.quitMode();
      this.enterRide();
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
    this.touch?.showGears(!this.prog.p.settings.autoGear && !!spec.gears);
  }

  private startTestRide(id: string): void {
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
    // entrées moto
    const bi: BikeInput = this.frozen
      ? { ...emptyInput(), frontBrake: 1, rearBrake: 1, throttle: ctl.throttle, clutch: true }
      : {
          throttle: ctl.throttle, frontBrake: ctl.frontBrake, rearBrake: ctl.rearBrake, steer: ctl.steer, lean: ctl.lean,
          clutch: ctl.clutch, jump: ctl.jump, shiftUp: ctl.shiftUp, shiftDown: ctl.shiftDown,
        };
    if (this.frozen) phys.vx = phys.vz = 0;
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
    }
    if (this.player.wreck && (this.player.wreckTime > 3.2 || (this.player.wreckTime > 1.2 && (ctl.throttle > 0.5 || ctl.clutch)))) this.respawn();
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
    this.prog.p.stats.distance += phys.speed * dt;
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
    this.updateGhost(dt);
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

  private updateWorld(dt: number): void {
    const p = this.player.phys;
    const focus = new THREE.Vector3(p.x, p.y, p.z);
    this.atmo.update(dt, this.rig.cam, focus);
    this.city.update(this.rig.cam.position.x, this.rig.cam.position.z, this.atmo.viewDist, this.atmo.night, this.atmo.wetness);
    this.player.phys.wetness = this.atmo.wetness;
    if (this.traffic.group.visible) {
      this.traffic.update(dt, p.x, p.z, p.vx, p.vz, this.atmo.night);
      this.city.setTrafficBulbs((i, j) => this.traffic.lightPhase(i, j));
    }
    if (this.peds.group.visible) this.peds.update(dt, p.x, p.z, p.speed);
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
    const loud = this.player.cfg ? { stock: 0.25, sport: 0.55, titanium: 0.8, carbon: 0.7 }[this.player.cfg.exhaust] : 0.3;
    this.audio.player?.set({
      rpm: crashed ? this.player.spec.idleRpm : e.rpm,
      load: crashed ? 0 : e.load,
      vol: crashed ? Math.max(0, 0.6 - this.player.wreckTime * 0.3) : 0.75 + e.throttleEff * 0.25,
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
      clutch: e.engagement < 0.5 && !e.isCVT,
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
      player: { x: p.x, z: p.z, yaw: p.yaw },
      markers,
      mpLines: this.mp.status === 'online' ? [`🌐 ${this.mp.room} : ${this.mp.players.size + 1} joueur(s)`] : [],
    };
  }
}

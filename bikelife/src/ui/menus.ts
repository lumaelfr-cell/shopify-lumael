// Écrans de menu : principal, modes, défis, contre-la-montre, carte, pause,
// paramètres, multijoueur, résultats, succès.

import { h, clear, medalStr, confirmDialog, infoDialog } from './dom';
import type { Progression, Quality } from '../gameplay/progression';
import { ACHIEVEMENTS, xpForLevel, garageSlots } from '../gameplay/progression';
import type { AudioManager } from '../audio/audio';
import { CHALLENGES, TIME_TRIALS } from '../data/challenges';
import { BIKE_BY_ID, bikeName, CLASS_LABEL } from '../data/bikes';
import { SPOTS, WORLD_BOUNDS, spotById } from '../world/layout';
import type { ModeResult } from '../gameplay/modes';
import type { Multiplayer } from '../net/multiplayer';
import { Multiplayer as MP } from '../net/multiplayer';
import type { Weather } from '../world/atmosphere';
import { WEATHER_LABEL } from '../world/atmosphere';
import { formatTime } from '../core/math';

export interface GameAPI {
  prog: Progression;
  audio: AudioManager;
  mp: Multiplayer;
  mapCanvas: HTMLCanvasElement;
  mapScale: number;
  playerPos(): { x: number; z: number };
  startRide(spotId?: string): void;
  startMode(kind: 'wheelie' | 'stunt' | 'challenge' | 'timetrial', arg?: string): void;
  openGarage(): void;
  resume(): void;
  respawn(): void;
  quitMode(): void;
  toMainMenu(): void;
  teleport(spotId: string): void;
  applySettings(): void;
  setTime(h: number): void;
  setWeather(w: Weather): void;
  getTime(): number;
  getWeather(): Weather;
  editTouchLayout(): void;
  isRiding(): boolean;
  modeActive(): boolean;
  mpConnect(url: string, room: string): void;
}

export class Menus {
  ui: HTMLElement;
  current: HTMLElement | null = null;
  private stack: (() => void)[] = [];

  constructor(ui: HTMLElement, private g: GameAPI) {
    this.ui = ui;
  }

  private open(el: HTMLElement): void {
    this.close();
    this.current = el;
    this.ui.append(el);
  }

  close(): void {
    if (this.current) this.current.remove();
    this.current = null;
  }

  get isOpen(): boolean {
    return !!this.current;
  }

  private click(): void {
    this.g.audio.ui('click');
  }

  private btn(label: string, fn: () => void, cls = ''): HTMLButtonElement {
    return h('button', {
      class: `btn ${cls}`,
      onclick: () => {
        this.click();
        fn();
      },
    }, label);
  }

  // --------------------------------------------------------------- principal
  showMain(): void {
    const p = this.g.prog.p;
    const spec = BIKE_BY_ID[p.current];
    const next = xpForLevel(p.level + 1), cur = xpForLevel(p.level);
    const lvlPct = Math.round(((p.xp - cur) / Math.max(1, next - cur)) * 100);
    const info = h('div', { class: 'info' });
    info.innerHTML = `<div style="display:flex;justify-content:space-between"><b style="font-size:18px">Niveau ${p.level}</b><b class="gold" style="font-size:20px">${p.money.toLocaleString('fr-FR')} $</b></div>
      <div class="statbar"><i style="width:${lvlPct}%"></i></div>
      <div class="muted" style="margin-top:6px">Moto : <b style="color:#fff">${bikeName(spec)}</b> · ${CLASS_LABEL[spec.cls]} · Garage ${Object.keys(p.bikes).length}/${garageSlots(p.level)}</div>
      <div class="muted">Records : wheeling ${(p.records.wheelieDist ?? 0).toFixed(0)} m · ${(p.records.wheelieTime ?? 0).toFixed(1)} s · vitesse ${(p.records.topSpeed ?? 0).toFixed(0)} km/h</div>
      <div style="margin-top:6px;font-weight:700">Objectifs du jour</div>
      ${p.daily.goals.map((gl) => `<div class="muted">${gl.done ? '✔' : '•'} ${gl.label} — <span class="gold">${gl.reward} $</span> (${Math.round(this.g.prog.goalProgress(gl) * 100)} %)</div>`).join('')}`;
    const side = h('div', { class: 'side' },
      h('div', { class: 'logo', html: 'BIKE <span>LIFE</span><small>STREET KINGS</small>' }),
      h('div', { class: 'menu-btns' },
        this.btn('▶  ROULER EN VILLE', () => this.g.startRide(), 'primary wide'),
        this.btn('🏁  Modes & défis', () => this.showModes()),
        this.btn('🔧  Garage', () => this.g.openGarage()),
        this.btn('🗺  Carte', () => this.showMap(() => this.showMain())),
        this.btn('🌐  Multijoueur', () => this.showMP(() => this.showMain())),
        this.btn('🏆  Succès & records', () => this.showAchievements(() => this.showMain())),
        this.btn('⚙  Paramètres', () => this.showSettings(() => this.showMain())),
      ),
      info,
    );
    const el = h('div', { class: 'screen', id: 'main-menu' }, side);
    this.open(el);
  }

  // --------------------------------------------------------------- modes
  showModes(tab: 'main' | 'challenges' | 'tt' = 'main'): void {
    const p = this.g.prog.p;
    const card = h('div', { class: 'card' });
    const tabs = h('div', { class: 'tabs' },
      this.btn('Modes', () => this.showModes('main'), tab === 'main' ? 'sel small' : 'small'),
      this.btn(`Défis (${Object.keys(p.challenges).filter((k) => !k.startsWith('tt-') && p.challenges[k] > 0).length}/${CHALLENGES.length})`, () => this.showModes('challenges'), tab === 'challenges' ? 'sel small' : 'small'),
      this.btn('Contre-la-montre', () => this.showModes('tt'), tab === 'tt' ? 'sel small' : 'small'),
    );
    card.append(h('h2', {}, 'MODES DE JEU'), tabs);
    const grid = h('div', { class: 'grid' });
    const tile = (title: string, sub: string, fn: () => void, right = '') => {
      const t = h('div', { class: 'tile', onclick: () => { this.click(); fn(); } }, h('div', { class: 'tt' }, title), h('div', { class: 'ts' }, sub));
      if (right) t.append(h('div', { class: 'price' }, right));
      return t;
    };
    if (tab === 'main') {
      grid.append(
        tile('Balade libre', 'Toute la ville, le trafic, les spots. Les défis s’activent depuis le menu.', () => this.g.startRide()),
        tile('Wheeling — Boulevard', 'Record de distance sur le Grand Boulevard (500 m).', () => this.g.startMode('wheelie', 'boulevard')),
        tile('Wheeling — Corniche', 'Près d’1 km de ligne droite hors de la ville.', () => this.g.startMode('wheelie', 'corniche')),
        tile('Session stunt (2 min)', 'Au stunt park : le plus gros score en combos.', () => this.g.startMode('stunt'), `${(p.records.stuntSession ?? 0).toLocaleString('fr-FR')} pts`),
        tile('Garage', 'Acheter, personnaliser et essayer les véhicules.', () => this.g.openGarage()),
        tile('Multijoueur', 'Rouler à plusieurs via le serveur inclus.', () => this.showMP(() => this.showModes())),
      );
    } else if (tab === 'challenges') {
      for (const c of CHALLENGES) {
        const m = p.challenges[c.id] ?? 0;
        const req = c.classes ? ` · ${c.classes.map((k) => CLASS_LABEL[k]).join(', ')} uniquement` : '';
        grid.append(tile(c.name, `${c.desc}${req} — ${c.thresholds.join(' / ')} ${c.unit}`, () => this.g.startMode('challenge', c.id), medalStr(m)));
      }
    } else {
      for (const t of TIME_TRIALS) {
        const best = p.timeTrials[t.id];
        grid.append(tile(t.name, `${t.desc} — Or : ${formatTime(t.medals[2])}`, () => this.g.startMode('timetrial', t.id), best !== undefined ? `${formatTime(best)} ${medalStr(p.challenges[t.id] ?? 0)}` : medalStr(0)));
      }
    }
    card.append(grid, h('div', { class: 'row', style: 'margin-top:14px' }, this.btn('Retour', () => (this.g.isRiding() ? this.showPause() : this.showMain()))));
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- carte
  showMap(back: () => void): void {
    const card = h('div', { class: 'card', style: 'width:min(980px,100%)' });
    card.append(h('h2', {}, 'CARTE DE LA VILLE'));
    const wrap = h('div', { style: 'display:flex;gap:14px;flex-wrap:wrap' });
    const cv = h('canvas', { width: 520, height: 520, style: 'width:min(520px,100%);aspect-ratio:1;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:#2d4428' });
    const g = cv.getContext('2d')!;
    const src = this.g.mapCanvas;
    // zone centrée sur la ville + MX park
    const view = { x0: -760, z0: -760, x1: 760, z1: 900 };
    const sc = Math.min(520 / (view.x1 - view.x0), 520 / (view.z1 - view.z0));
    const toPx = (x: number, z: number) => [(x - view.x0) * sc, (z - view.z0) * sc];
    g.drawImage(src, (view.x0 - WORLD_BOUNDS.minX) * this.g.mapScale, (view.z0 - WORLD_BOUNDS.minZ) * this.g.mapScale, (view.x1 - view.x0) * this.g.mapScale, (view.z1 - view.z0) * this.g.mapScale, 0, 0, (view.x1 - view.x0) * sc, (view.z1 - view.z0) * sc);
    g.font = 'bold 13px sans-serif';
    for (const s of SPOTS) {
      const [x, y] = toPx(s.x, s.z);
      g.fillStyle = '#ff2bd6';
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      g.strokeText(s.name, x + 9, y + 4);
      g.fillText(s.name, x + 9, y + 4);
    }
    const pp = this.g.playerPos();
    const [px, py] = toPx(pp.x, pp.z);
    g.fillStyle = '#39ff6a';
    g.beginPath();
    g.arc(px, py, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#000';
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 12px sans-serif';
    g.fillText('↑ Corniche (nord)', 270, 14);
    const list = h('div', { style: 'flex:1;min-width:240px;display:flex;flex-direction:column;gap:6px' });
    list.append(h('div', { class: 'muted' }, 'Téléportation instantanée (pas de temps de chargement) :'));
    for (const s of SPOTS) list.append(h('button', { class: 'btn small', style: 'text-align:left', onclick: () => { this.click(); this.g.teleport(s.id); } }, `${s.name}`, h('div', { class: 'muted', style: 'font-size:12px;font-weight:500' }, s.desc)));
    wrap.append(cv, list);
    card.append(wrap, h('div', { class: 'row', style: 'margin-top:12px' }, this.btn('Retour', back)));
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- pause
  showPause(): void {
    const card = h('div', { class: 'card', style: 'width:min(460px,100%)' });
    card.append(h('h2', {}, 'PAUSE'));
    const col = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    col.append(
      this.btn('▶ Reprendre', () => this.g.resume(), 'primary'),
      this.btn('↺ Réapparaître', () => { this.g.respawn(); this.g.resume(); }),
      this.btn('🏁 Modes & défis', () => this.showModes()),
      this.btn('🗺 Carte & téléportation', () => this.showMap(() => this.showPause())),
      this.btn('🔧 Garage', () => this.g.openGarage()),
      this.btn('🌐 Multijoueur', () => this.showMP(() => this.showPause())),
      this.btn('⚙ Paramètres', () => this.showSettings(() => this.showPause())),
    );
    if (this.g.modeActive()) col.append(this.btn('✖ Quitter le mode en cours', () => { this.g.quitMode(); this.g.resume(); }, 'danger'));
    col.append(this.btn('⏏ Menu principal', () => this.g.toMainMenu()));
    card.append(col);
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- paramètres
  showSettings(back: () => void): void {
    const pr = this.g.prog;
    const s = pr.p.settings;
    const card = h('div', { class: 'card' });
    card.append(h('h2', {}, 'PARAMÈTRES'));
    const save = () => {
      pr.save();
      this.g.applySettings();
    };
    const choice = <T extends string | number | boolean>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void) => {
      const row = h('div', { class: 'opt-list' });
      const render = () => {
        clear(row);
        for (const [v, l] of opts) row.append(h('button', { class: `btn small ${get() === v ? 'sel' : ''}`, onclick: () => { this.click(); set(v); save(); render(); } }, l));
      };
      render();
      return h('div', { class: 'field' }, h('label', {}, label), row);
    };
    const slider = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt = (v: number) => `${Math.round(v * 100)} %`) => {
      const out = h('span', { class: 'muted' }, fmt(get()));
      const inp = h('input', { type: 'range', min, max, step, value: get() }) as HTMLInputElement;
      inp.addEventListener('input', () => {
        set(Number(inp.value));
        out.textContent = fmt(Number(inp.value));
        save();
      });
      return h('div', { class: 'field' }, h('label', {}, label, ' ', out), inp);
    };
    card.append(h('h3', {}, 'Conduite'));
    card.append(choice('Aide au wheeling', [[0, 'Simulation'], [1, 'Normale'], [2, 'Arcade']], () => s.assist, (v) => (s.assist = v as 0 | 1 | 2)));
    card.append(h('div', { class: 'muted', style: 'font-size:13px' }, 'Simulation : physique pure. Normale : stabilise et évite le looping. Arcade : tient le point d’équilibre presque seul (recommandé sur mobile).'));
    card.append(choice('Boîte de vitesses', [[true, 'Automatique'], [false, 'Manuelle (E/Q, RB/LB, +/−)']], () => s.autoGear, (v) => (s.autoGear = v)));
    card.append(choice('Unités', [['kmh', 'km/h'], ['mph', 'mph']], () => s.units, (v) => (s.units = v as 'kmh' | 'mph')));
    card.append(choice('Caméra wheeling automatique', [[true, 'Oui'], [false, 'Non']], () => s.autoWheelieCam, (v) => (s.autoWheelieCam = v)));
    card.append(h('h3', {}, 'Graphismes'));
    card.append(choice('Qualité', [['low', 'Basse'], ['medium', 'Moyenne'], ['high', 'Haute']], () => s.quality, (v) => { s.quality = v as Quality; }));
    card.append(h('div', { class: 'muted', style: 'font-size:13px' }, 'La qualité est appliquée immédiatement (résolution, ombres, distance, trafic). Les ombres et l’antialiasing complets nécessitent “Haute”.'));
    card.append(choice('Circulation & piétons', [[true, 'Activés'], [false, 'Désactivés']], () => s.traffic, (v) => (s.traffic = v)));
    card.append(h('h3', {}, 'Ambiance'));
    card.append(slider('Heure de la journée', 0, 23.9, 0.1, () => this.g.getTime(), (v) => this.g.setTime(v), (v) => `${Math.floor(v)}h${String(Math.floor((v % 1) * 60)).padStart(2, '0')}`));
    card.append(slider('Vitesse du temps', 0, 10, 0.5, () => s.timeSpeed, (v) => (s.timeSpeed = v), (v) => (v === 0 ? 'figé' : `${v} h / min`)));
    card.append(choice('Météo', (['clear', 'cloudy', 'rain', 'fog'] as Weather[]).map((w) => [w, WEATHER_LABEL[w]] as [Weather, string]), () => this.g.getWeather(), (v) => this.g.setWeather(v)));
    card.append(h('h3', {}, 'Son'));
    card.append(slider('Volume général', 0, 1, 0.05, () => s.volumes.master, (v) => (s.volumes.master = v)));
    card.append(slider('Moteurs', 0, 1, 0.05, () => s.volumes.engine, (v) => (s.volumes.engine = v)));
    card.append(slider('Effets', 0, 1, 0.05, () => s.volumes.sfx, (v) => (s.volumes.sfx = v)));
    card.append(slider('Ambiance', 0, 1, 0.05, () => s.volumes.ambience, (v) => (s.volumes.ambience = v)));
    card.append(slider('Musique', 0, 1, 0.05, () => s.volumes.music, (v) => (s.volumes.music = v)));
    card.append(choice('Musique', [[true, 'Activée'], [false, 'Coupée']], () => s.music, (v) => (s.music = v)));
    card.append(choice('Style musical', [[0, 'Trap nocturne'], [1, 'Boom bap'], [2, 'Drill']], () => s.musicStyle, (v) => (s.musicStyle = v)));
    card.append(h('h3', {}, 'Commandes tactiles'));
    card.append(slider('Taille des boutons', 0.7, 1.5, 0.05, () => s.touch.scale, (v) => (s.touch.scale = v)));
    card.append(slider('Opacité', 0.3, 1, 0.05, () => s.touch.opacity, (v) => (s.touch.opacity = v)));
    card.append(choice('Disposition', [[false, 'Droitier'], [true, 'Gaucher']], () => s.touch.leftHanded, (v) => (s.touch.leftHanded = v)));
    card.append(h('div', { class: 'row' }, this.btn('Déplacer les boutons…', () => this.g.editTouchLayout(), 'small')));
    card.append(choice('Aide aux commandes (clavier)', [[true, 'Affichée'], [false, 'Masquée']], () => s.showHelp, (v) => (s.showHelp = v)));
    card.append(h('h3', {}, 'Sauvegarde'));
    const ta = h('textarea', { rows: 3, style: 'width:100%', placeholder: 'Coller ici une sauvegarde exportée…' }) as HTMLTextAreaElement;
    card.append(
      h('div', { class: 'muted', style: 'font-size:13px' }, pr.storageOk ? 'Progression enregistrée automatiquement sur cet appareil (localStorage).' : '⚠ Stockage local indisponible : la progression ne sera pas conservée.'),
      h('div', { class: 'row', style: 'margin-top:6px' },
        this.btn('Exporter', () => { ta.value = pr.exportJSON(); ta.select(); }, 'small'),
        this.btn('Importer', () => { if (pr.importJSON(ta.value)) { this.g.applySettings(); this.showSettings(back); } else infoDialog('Sauvegarde invalide : collez le texte exporté complet.'); }, 'small'),
        this.btn('Réinitialiser la progression', () => { void confirmDialog('Effacer toute la progression ? Cette action est définitive.', 'Tout effacer').then((yes) => { if (yes) { pr.reset(); this.g.applySettings(); this.g.toMainMenu(); } }); }, 'small danger'),
      ),
      ta,
    );
    card.append(h('div', { class: 'row', style: 'margin-top:14px' }, this.btn('Retour', back, 'primary')));
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- multijoueur
  showMP(back: () => void): void {
    const pr = this.g.prog;
    const mp = this.g.mp;
    const card = h('div', { class: 'card', style: 'width:min(620px,100%)' });
    card.append(h('h2', {}, 'MULTIJOUEUR'));
    card.append(h('div', { class: 'muted', style: 'font-size:14px' }, 'Sessions en temps réel via le serveur inclus (server/server.mjs). Lance « npm run start » sur un PC : tes amis sur le même réseau se connectent à son adresse. Sans serveur, le multijoueur est indisponible (aucun faux joueur).'));
    const name = h('input', { type: 'text', value: pr.p.rider.name, maxlength: 16 }) as HTMLInputElement;
    const url = h('input', { type: 'text', value: pr.p.settings.mpServer || MP.defaultUrl() }) as HTMLInputElement;
    const room = h('input', { type: 'text', value: 'public', maxlength: 24 }) as HTMLInputElement;
    const status = h('div', { style: 'font-weight:700;margin:8px 0' });
    const players = h('div', { class: 'muted' });
    const refresh = () => {
      const st = { off: 'Hors ligne', connecting: 'Connexion…', online: `En ligne (salon « ${mp.room} »)`, error: `Erreur : ${mp.error}` }[mp.status];
      status.textContent = st;
      status.style.color = mp.status === 'online' ? '#39ff6a' : mp.status === 'error' ? '#ff6b6b' : '#fff';
      players.textContent = mp.status === 'online' ? `Joueurs : ${[pr.p.rider.name, ...[...mp.players.values()].map((p) => p.name)].join(', ')}` : '';
    };
    refresh();
    const timer = window.setInterval(() => {
      if (!document.body.contains(card)) clearInterval(timer);
      else refresh();
    }, 400);
    const chatIn = h('input', { type: 'text', placeholder: 'Message…', maxlength: 140, style: 'flex:1' }) as HTMLInputElement;
    card.append(
      h('div', { class: 'field' }, h('label', {}, 'Pseudo'), name),
      h('div', { class: 'field' }, h('label', {}, 'Adresse du serveur'), url),
      h('div', { class: 'field' }, h('label', {}, 'Salon'), room),
      h('div', { class: 'row' },
        this.btn('Se connecter', () => {
          pr.p.rider.name = name.value.trim() || 'Rider';
          pr.p.settings.mpServer = url.value.trim();
          pr.save();
          this.g.mpConnect(url.value.trim(), room.value.trim() || 'public');
        }, 'primary'),
        this.btn('Se déconnecter', () => mp.disconnect(), 'small'),
      ),
      status, players,
      h('div', { class: 'row', style: 'margin-top:8px' }, chatIn, this.btn('Envoyer', () => { mp.chat(chatIn.value); chatIn.value = ''; }, 'small')),
      h('div', { class: 'row', style: 'margin-top:14px' }, this.btn('Retour', () => { clearInterval(timer); back(); })),
    );
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- succès
  showAchievements(back: () => void): void {
    const p = this.g.prog.p;
    const card = h('div', { class: 'card' });
    card.append(h('h2', {}, 'SUCCÈS & RECORDS'));
    const rec = p.records;
    const kv = h('div', { class: 'kv' });
    const line = (k: string, v: string) => kv.append(h('span', { class: 'muted' }, k), h('b', {}, v));
    line('Plus long wheeling', `${(rec.wheelieDist ?? 0).toFixed(1)} m`);
    line('Wheeling le plus long (temps)', `${(rec.wheelieTime ?? 0).toFixed(1)} s`);
    line('Plus long stoppie', `${(rec.stoppieDist ?? 0).toFixed(1)} m`);
    line('Plus long saut', `${(rec.jumpDist ?? 0).toFixed(1)} m`);
    line('Plus long temps de vol', `${(rec.airTime ?? 0).toFixed(2)} s`);
    line('Vitesse max', `${(rec.topSpeed ?? 0).toFixed(0)} km/h`);
    line('Meilleur combo', `${(rec.bestCombo ?? 0).toLocaleString('fr-FR')} pts`);
    line('Distance parcourue', `${(p.stats.distance / 1000).toFixed(1)} km`);
    line('Distance totale en wheeling', `${(p.stats.wheelieDist / 1000).toFixed(2)} km`);
    line('Chutes', String(p.stats.crashes));
    card.append(kv, h('h3', {}, `Succès ${p.achievements.length}/${ACHIEVEMENTS.length}`));
    const grid = h('div', { class: 'grid' });
    for (const a of ACHIEVEMENTS) {
      const got = p.achievements.includes(a.id);
      grid.append(h('div', { class: `tile ${got ? 'sel' : ''}`, style: got ? '' : 'opacity:0.55' }, h('div', { class: 'tt' }, `${got ? '🏆 ' : '🔒 '}${a.name}`), h('div', { class: 'ts' }, a.desc), h('div', { class: 'price' }, `${a.reward} $`)));
    }
    card.append(grid, h('div', { class: 'row', style: 'margin-top:14px' }, this.btn('Retour', back)));
    this.open(h('div', { class: 'screen dim' }, card));
  }

  // --------------------------------------------------------------- résultats
  showResult(r: ModeResult, onContinue: () => void): void {
    const card = h('div', { class: 'card', style: 'width:min(520px,100%);text-align:center' });
    const medalName = ['Aucune médaille', 'Médaille de bronze', 'Médaille d’argent', 'Médaille d’or'][r.medal];
    const color = ['#9aa3b2', '#d58a4b', '#d9dde3', '#ffcc33'][r.medal];
    card.append(
      h('h2', {}, r.title.toUpperCase()),
      h('div', { style: `font-size:46px;color:${color}` }, medalStr(r.medal)),
      h('div', { style: `font-weight:800;font-size:20px;color:${color}` }, medalName),
      ...r.lines.filter(Boolean).map((l) => h('div', { style: 'margin:6px 0;font-size:17px' }, l)),
      h('div', { class: 'gold', style: 'font-size:24px;font-weight:800;margin:10px 0' }, r.reward > 0 ? `+${r.reward.toLocaleString('fr-FR')} $` : ''),
      h('div', { class: 'row', style: 'justify-content:center' },
        this.btn('Rejouer', () => { this.close(); r.retry(); }, 'primary'),
        this.btn('Continuer en balade', () => { this.close(); onContinue(); }),
        this.btn('Modes', () => this.showModes()),
      ),
    );
    this.open(h('div', { class: 'screen dim' }, card));
  }

  /** Défi accessible directement depuis le spot (utilisé par la carte des défis). */
  spotName(id: string): string {
    return spotById(id).name;
  }
}

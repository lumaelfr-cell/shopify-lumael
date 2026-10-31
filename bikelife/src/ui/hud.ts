// Affichage tête haute : profil/argent, mode en cours, objectifs, figure en
// cours + combo, compte-tours/vitesse/rapport, jauge de wheeling, minicarte,
// notifications, écran de chute, aide aux commandes.

import { h, clear } from './dom';
import type { ModeHud } from '../gameplay/modes';
import type { DailyGoal } from '../gameplay/progression';
import { WORLD_BOUNDS } from '../world/layout';
import { clamp } from '../core/math';

export interface HudState {
  money: number;
  level: number;
  levelProgress: number;
  bikeName: string;
  speed: number; // km/h ou mph déjà converti
  unit: string;
  rpm: number;
  redline: number;
  gear: string;
  clutch: boolean;
  pitchDeg: number;
  balanceDeg: number;
  loopDeg: number;
  wheelie: boolean;
  trick: { label: string; points: number; sub: string } | null;
  combo: { total: number; mult: number; timer: number } | null;
  mode: ModeHud | null;
  goals: { g: DailyGoal; p: number }[];
  crashed: { reason: string; t: number } | null;
  camLabel: string;
  player: { x: number; z: number; yaw: number };
  markers: { x: number; z: number; color: string; size?: number; label?: string }[];
  mpLines: string[];
  /** ligne d'état : carburant, état de la moto, santé, endurance */
  status: string;
  /** joueur à pied (compteur masqué) */
  foot: boolean;
  /** alerte (réserve, panne sèche, santé basse) */
  alert: string | null;
}

export class Hud {
  root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private mini: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private rpmArc!: SVGPathElement;
  private gaugeNeedle!: SVGLineElement;
  private gaugeZone!: SVGPathElement;
  private gaugeDanger!: SVGPathElement;
  private toastBox: HTMLElement;
  private lastTrickKey = '';
  private helpVisible = true;

  constructor(root: HTMLElement, private mapCanvas: HTMLCanvasElement, private mapScale: number) {
    this.root = root;
    clear(root);
    const tl = h('div', { id: 'hud-top-left' });
    const profile = h('div', { id: 'hud-profile', class: 'panel' }, h('div', { class: 'lvl' }, h('b', {}, '1')), h('div', {}, h('div', { class: 'money' }, '0 $'), h('div', { class: 'bike' }, ''), h('div', { class: 'status' }, '')));
    const mode = h('div', { id: 'hud-mode', class: 'panel hidden' });
    const goals = h('div', { id: 'hud-goals', class: 'panel' });
    const mp = h('div', { id: 'mp-list', class: 'panel hidden' });
    tl.append(profile, mode, goals, mp);
    const trick = h('div', { id: 'hud-trick', class: 'hidden' }, h('div', { class: 'name' }), h('div', { class: 'pts' }), h('div', { class: 'sub' }));
    const combo = h('div', { id: 'hud-combo', class: 'hidden' }, h('div', { class: 'v' }), h('div', { class: 'bar' }, h('i')));
    const big = h('div', { id: 'hud-big', class: 'hidden' });
    const crash = h('div', { id: 'hud-crash', class: 'hidden' }, h('div', { class: 't' }, 'CHUTE !'), h('div', { class: 's' }));
    const alert = h('div', { id: 'hud-alert', class: 'hidden' });
    this.toastBox = h('div', { id: 'toasts' });
    const tr = h('div', { id: 'hud-top-right' });
    this.mini = h('canvas', { id: 'minimap', width: 336, height: 336 });
    this.miniCtx = this.mini.getContext('2d')!;
    const cam = h('div', { id: 'hud-cam', class: 'panel' });
    tr.append(this.mini, cam);
    // compteur
    const speedo = h('div', { id: 'speedo' });
    speedo.innerHTML = `<svg viewBox="0 0 230 128"><path d="M20 118 A 95 95 0 0 1 210 118" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="10" stroke-linecap="round"/>
      <path class="red" d="" fill="none" stroke="rgba(255,77,77,0.55)" stroke-width="10"/>
      <path class="rpm" d="" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round"/>
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#39ff6a"/><stop offset="0.75" stop-color="#ffd400"/><stop offset="1" stop-color="#ff4d4d"/></linearGradient></defs></svg>
      <div class="spd">0</div><div class="unit">KM/H</div><div class="gear">N</div><div class="clutch hidden">EMBR.</div>`;
    this.rpmArc = speedo.querySelector('path.rpm')!;
    (speedo.querySelector('path.red') as SVGPathElement).setAttribute('d', arcPath(115, 118, 95, 0.86, 1));
    // jauge de wheeling
    const gauge = h('div', { id: 'wheelie-gauge', class: 'hidden' });
    gauge.innerHTML = `<div class="lbl">ANGLE</div><svg viewBox="0 44 260 56"><path d="M45 89 A 120 120 0 0 1 215 89" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8"/>
      <path class="zone" d="" fill="none" stroke="rgba(57,255,106,0.75)" stroke-width="8"/><path class="danger" d="" fill="none" stroke="rgba(255,77,77,0.8)" stroke-width="8"/>
      <line class="needle" x1="130" y1="174" x2="130" y2="40" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
    this.gaugeNeedle = gauge.querySelector('line.needle')!;
    this.gaugeZone = gauge.querySelector('path.zone')!;
    this.gaugeDanger = gauge.querySelector('path.danger')!;
    const help = h('div', { id: 'help', class: 'panel' });
    help.innerHTML = `<b>Z/W</b> gaz · <b>S</b> frein avant · <b>Espace</b> frein arrière<br><b>Q/A · D</b> diriger · <b>↑ ↓</b> pencher avant / arrière<br><b>Maj</b> embrayage (tenir + gaz, relâcher = wheeling)<br><b>J</b> saut · <b>K</b>+direction figure en l'air · <b>C</b> caméra<br><b>R</b> réapparaître · <b>Échap</b> pause · <b>H</b> klaxon · <b>F1</b> masquer`;
    const chat = h('div', { id: 'chat-log' });
    root.append(tl, trick, combo, big, crash, alert, this.toastBox, tr, speedo, gauge, help, chat);
    for (const id of ['hud-alert', 'hud-profile', 'hud-mode', 'hud-goals', 'hud-trick', 'hud-combo', 'hud-big', 'hud-crash', 'hud-cam', 'speedo', 'wheelie-gauge', 'help', 'mp-list', 'chat-log']) this.els[id] = root.querySelector('#' + id)!;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.setHelp(!this.helpVisible);
      }
    });
  }

  setHelp(v: boolean): void {
    this.helpVisible = v;
    this.els.help.classList.toggle('hidden', !v);
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info', ms = 3200): void {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toastBox.prepend(t);
    while (this.toastBox.children.length > 4) this.toastBox.lastChild!.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 450);
    }, ms);
  }

  chat(line: string): void {
    const box = this.els['chat-log'];
    const el = h('div', {}, line);
    box.append(el);
    while (box.children.length > 6) box.firstChild!.remove();
    setTimeout(() => el.remove(), 15000);
  }

  update(s: HudState): void {
    const E = this.els;
    const lvl = E['hud-profile'].querySelector('.lvl') as HTMLElement;
    lvl.style.setProperty('--p', `${Math.round(s.levelProgress * 100)}%`);
    lvl.querySelector('b')!.textContent = String(s.level);
    E['hud-profile'].querySelector('.money')!.textContent = `${s.money.toLocaleString('fr-FR')} $`;
    E['hud-profile'].querySelector('.bike')!.textContent = s.bikeName;
    E['hud-profile'].querySelector('.status')!.innerHTML = s.status;
    E.speedo.classList.toggle('hidden', s.foot);
    E['hud-alert'].classList.toggle('hidden', !s.alert);
    if (s.alert) E['hud-alert'].textContent = s.alert;
    // mode
    if (s.mode) {
      E['hud-mode'].classList.remove('hidden');
      E['hud-mode'].innerHTML = `${s.mode.timer ? `<span class="timer">${s.mode.timer}</span>` : ''}<div class="t">${s.mode.title}</div>${s.mode.lines.filter(Boolean).map((l) => `<div class="l">${l}</div>`).join('')}`;
      E['hud-big'].classList.toggle('hidden', !s.mode.big);
      if (s.mode.big) E['hud-big'].textContent = s.mode.big;
    } else {
      E['hud-mode'].classList.add('hidden');
      E['hud-big'].classList.add('hidden');
    }
    // objectifs du jour
    E['hud-goals'].innerHTML = `<div class="muted" style="font-weight:700">OBJECTIFS DU JOUR</div>` + s.goals.map(({ g, p }) => `<div class="g">${g.done ? '✔' : '•'} <span style="flex:2">${g.label}</span><i style="--p:${Math.round(p * 100)}%"></i></div>`).join('');
    // figure
    if (s.trick) {
      E['hud-trick'].classList.remove('hidden');
      (E['hud-trick'].querySelector('.name') as HTMLElement).textContent = s.trick.label;
      (E['hud-trick'].querySelector('.pts') as HTMLElement).textContent = `+${Math.round(s.trick.points).toLocaleString('fr-FR')}`;
      (E['hud-trick'].querySelector('.sub') as HTMLElement).textContent = s.trick.sub;
    } else E['hud-trick'].classList.add('hidden');
    if (s.combo && s.combo.total > 0) {
      E['hud-combo'].classList.remove('hidden');
      (E['hud-combo'].querySelector('.v') as HTMLElement).textContent = `COMBO ×${s.combo.mult}  ${s.combo.total.toLocaleString('fr-FR')}`;
      (E['hud-combo'].querySelector('.bar i') as HTMLElement).style.width = `${clamp(s.combo.timer / 2.2, 0, 1) * 100}%`;
    } else E['hud-combo'].classList.add('hidden');
    // chute
    if (s.crashed) {
      E['hud-crash'].classList.remove('hidden');
      (E['hud-crash'].querySelector('.s') as HTMLElement).textContent = `${s.crashed.reason} — ${s.crashed.t > 1.2 ? 'R / bouton ↺ pour repartir' : ''}`;
    } else E['hud-crash'].classList.add('hidden');
    // compteur
    (E.speedo.querySelector('.spd') as HTMLElement).textContent = String(Math.round(s.speed));
    (E.speedo.querySelector('.unit') as HTMLElement).textContent = s.unit;
    (E.speedo.querySelector('.gear') as HTMLElement).textContent = s.gear;
    E.speedo.querySelector('.clutch')!.classList.toggle('hidden', !s.clutch);
    this.rpmArc.setAttribute('d', arcPath(115, 118, 95, 0, clamp(s.rpm / (s.redline * 1.06), 0.001, 1)));
    // jauge
    E['wheelie-gauge'].classList.toggle('hidden', !s.wheelie);
    if (s.wheelie) {
      const toT = (deg: number) => clamp(deg / 90, 0, 1);
      this.gaugeZone.setAttribute('d', arcPath(130, 174, 120, toT(s.balanceDeg - 16) * 0.5 + 0.25, toT(s.balanceDeg + 1) * 0.5 + 0.25, true));
      this.gaugeDanger.setAttribute('d', arcPath(130, 174, 120, toT(s.loopDeg - 10) * 0.5 + 0.25, 0.75, true));
      const a = (toT(s.pitchDeg) * 0.5 + 0.25) * Math.PI;
      this.gaugeNeedle.setAttribute('x2', String(130 - Math.cos(a) * 140));
      this.gaugeNeedle.setAttribute('y2', String(174 - Math.sin(a) * 140));
      (E['wheelie-gauge'].querySelector('.lbl') as HTMLElement).textContent = `ANGLE ${Math.round(s.pitchDeg)}°  (équilibre ≈ ${Math.round(s.balanceDeg)}°)`;
    }
    E['hud-cam'].textContent = s.camLabel;
    E['mp-list'].classList.toggle('hidden', !s.mpLines.length);
    if (s.mpLines.length) E['mp-list'].innerHTML = s.mpLines.join('<br>');
    this.drawMinimap(s);
  }

  private drawMinimap(s: HudState): void {
    const g = this.miniCtx;
    const W = this.mini.width;
    const R = W / 2;
    const zoom = 2.6; // px de minicarte par pixel de carte
    const sc = this.mapScale * zoom; // px par mètre
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(R, R, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#2d4428';
    g.fillRect(0, 0, W, W);
    g.translate(R, R);
    g.rotate(Math.PI + s.player.yaw);
    const mx = (s.player.x - WORLD_BOUNDS.minX) * this.mapScale;
    const mz = (s.player.z - WORLD_BOUNDS.minZ) * this.mapScale;
    g.scale(zoom, zoom);
    g.drawImage(this.mapCanvas, -mx, -mz);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // marqueurs (repère tourné)
    const c = Math.cos(Math.PI + s.player.yaw), si = Math.sin(Math.PI + s.player.yaw);
    for (const m of s.markers) {
      let dx = (m.x - s.player.x) * sc, dz = (m.z - s.player.z) * sc;
      let rx = dx * c - dz * si, rz = dx * si + dz * c;
      const d = Math.hypot(rx, rz);
      if (d > R - 10) {
        rx *= (R - 10) / d;
        rz *= (R - 10) / d;
      }
      g.fillStyle = m.color;
      g.beginPath();
      g.arc(R + rx, R + rz, (m.size ?? 6) * 1, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.stroke();
    }
    // joueur
    g.fillStyle = '#39ff6a';
    g.beginPath();
    g.moveTo(R, R - 14);
    g.lineTo(R + 9, R + 10);
    g.lineTo(R, R + 5);
    g.lineTo(R - 9, R + 10);
    g.closePath();
    g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
    // nord
    g.save();
    g.translate(R, R);
    g.rotate(Math.PI + s.player.yaw);
    g.fillStyle = '#ff4d4d';
    g.font = 'bold 22px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', 0, -R + 26);
    g.restore();
  }
}

function arcPath(cx: number, cy: number, r: number, t0: number, t1: number, half = false): string {
  // t de 0 (gauche) à 1 (droite) le long d'un demi-cercle supérieur
  const a0 = Math.PI * (1 - t0), a1 = Math.PI * (1 - t1);
  const x0 = cx + Math.cos(a0) * r, y0 = cy - Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r, y1 = cy - Math.sin(a1) * r;
  void half;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

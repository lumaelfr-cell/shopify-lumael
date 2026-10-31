// Commandes tactiles : joystick (direction + appui avant/arrière), gâchette
// d'accélérateur analogique, freins, wheeling, saut, figure, caméra, pause.
// Multi-touch avec glissement d'un bouton à l'autre ; disposition modifiable.

import type { Input } from '../core/input';
import type { TouchLayout } from '../gameplay/progression';
import { h, clear } from './dom';
import { clamp } from '../core/math';

interface Ctl {
  id: string;
  el: HTMLElement;
  kind: 'stick' | 'throttle' | 'hold' | 'tap';
  w: number;
  h: number;
  def: { x: number; y: number }; // centre par défaut (fraction écran) pour droitier
}

export class TouchControls {
  root: HTMLElement;
  private ctls: Ctl[] = [];
  private active = new Map<number, Ctl>();
  private stickOrigin = { x: 0, y: 0 };
  private looks = new Map<number, { x: number; y: number }>();
  mode: 'bike' | 'foot' = 'bike';
  private actionAvailable = false;
  editing = false;
  onLayoutChange: ((l: TouchLayout) => void) | null = null;
  trickAvailable = false;

  constructor(root: HTMLElement, private input: Input, private layout: TouchLayout) {
    this.root = root;
    this.build();
    root.addEventListener('touchstart', (e) => {
      this.onStart(e);
      this.trackThrottle(e);
      this.refresh();
    }, { passive: false });
    root.addEventListener('touchmove', (e) => {
      this.onMove(e);
      this.trackThrottle(e);
      this.refresh();
    }, { passive: false });
    root.addEventListener('touchend', (e) => this.onEnd(e), { passive: false });
    root.addEventListener('touchcancel', (e) => this.onEnd(e), { passive: false });
    window.addEventListener('resize', () => this.place());
    // glisser le doigt ailleurs que sur les commandes : rotation de la caméra
    const free = (e: TouchEvent) => !this.root.classList.contains('hidden') && !this.root.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('#ui, #hud-prompt, button');
    window.addEventListener('touchstart', (e) => {
      if (!free(e)) return;
      for (const t of Array.from(e.changedTouches)) this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        const lk = this.looks.get(t.identifier);
        if (!lk || this.root.contains(e.target as Node)) continue;
        this.input.addLook((t.clientX - lk.x) * 0.0065, (t.clientY - lk.y) * 0.005);
        lk.x = t.clientX;
        lk.y = t.clientY;
      }
    }, { passive: true });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (!this.root.contains(e.target as Node)) this.looks.delete(t.identifier);
    };
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
  }

  private build(): void {
    clear(this.root);
    this.ctls = [];
    const add = (id: string, kind: Ctl['kind'], w: number, hh: number, x: number, y: number, label: string, cls = '') => {
      let el: HTMLElement;
      if (kind === 'stick') {
        el = h('div', { class: 'stick', 'data-id': id }, h('div', { class: 'knob' }), h('div', { class: 'hint', style: 'top:4px' }, '▲ avant'), h('div', { class: 'hint', style: 'bottom:4px' }, '▼ arrière'));
      } else if (kind === 'throttle') {
        el = h('div', { class: `tbtn throttle ${cls}`, 'data-id': id }, h('div', { class: 'fill' }), h('span', {}, label));
      } else el = h('div', { class: `tbtn ${cls}`, 'data-id': id }, label);
      this.root.append(el);
      this.ctls.push({ id, el, kind, w, h: hh, def: { x, y } });
    };
    add('stick', 'stick', 168, 168, 0.13, 0.72, '');
    add('throttle', 'throttle', 92, 196, 0.915, 0.66, 'GAZ');
    add('front', 'hold', 74, 74, 0.8, 0.86, 'FREIN AV', 'red');
    add('rear', 'hold', 74, 74, 0.68, 0.86, 'FREIN AR', 'red');
    add('wheelie', 'hold', 86, 86, 0.79, 0.62, 'WHEELIE', 'pink');
    add('jump', 'hold', 64, 64, 0.68, 0.66, 'SAUT');
    add('trick', 'hold', 64, 64, 0.7, 0.45, 'FIGURE', 'pink');
    add('pause', 'tap', 46, 46, 0.5, 0.06, 'II', 'small');
    add('camera', 'tap', 46, 46, 0.56, 0.06, '◉', 'small');
    add('respawn', 'tap', 46, 46, 0.44, 0.06, '↺', 'small');
    add('shiftDown', 'tap', 46, 46, 0.62, 0.45, '−', 'small');
    add('shiftUp', 'tap', 46, 46, 0.62, 0.36, '+', 'small');
    add('interact', 'tap', 80, 80, 0.86, 0.36, 'ACTION', 'pink');
    add('footJump', 'tap', 84, 84, 0.8, 0.66, 'SAUT');
    this.place();
    this.applyMode();
  }

  setLayout(l: TouchLayout): void {
    this.layout = l;
    this.place();
  }

  private gearsWanted = false;

  showGears(v: boolean): void {
    this.gearsWanted = v;
    this.applyMode();
  }

  /** Disposition à moto ou à pied (les boutons inutiles sont masqués). */
  setMode(m: 'bike' | 'foot'): void {
    if (this.mode === m) return;
    this.mode = m;
    this.active.clear();
    this.applyMode();
  }

  /** Bouton ACTION visible à moto seulement quand une interaction est possible. */
  setAction(available: boolean): void {
    if (available === this.actionAvailable) return;
    this.actionAvailable = available;
    this.applyMode();
  }

  private applyMode(): void {
    const foot = this.mode === 'foot';
    const bikeOnly = new Set(['throttle', 'front', 'rear', 'wheelie', 'jump', 'trick', 'respawn']);
    for (const c of this.ctls) {
      let hide = false;
      if (bikeOnly.has(c.id)) hide = foot;
      if (c.id === 'footJump') hide = !foot;
      if (c.id === 'shiftUp' || c.id === 'shiftDown') hide = foot || !this.gearsWanted;
      if (c.id === 'interact') hide = !this.editing && !this.actionAvailable;
      c.el.classList.toggle('hidden', hide);
    }
    const hint = this.ctls.find((c) => c.id === 'stick')?.el.querySelectorAll('.hint');
    if (hint && hint.length === 2) {
      hint[0].textContent = foot ? '▲ marcher' : '▲ avant';
      hint[1].textContent = foot ? '▼ reculer' : '▼ arrière';
    }
  }

  place(): void {
    const W = window.innerWidth, H = window.innerHeight;
    const s = this.layout.scale * clamp(Math.min(W, H) / 420, 0.75, 1.35);
    for (const c of this.ctls) {
      const p = this.layout.pos[c.id] ?? c.def;
      let x = p.x;
      if (this.layout.leftHanded && !this.layout.pos[c.id]) x = 1 - x;
      const w = c.w * s, hh = c.h * s;
      c.el.style.width = `${w}px`;
      c.el.style.height = `${hh}px`;
      c.el.style.left = `${clamp(x * W - w / 2, 4, W - w - 4)}px`;
      c.el.style.top = `${clamp(p.y * H - hh / 2, 4, H - hh - 4)}px`;
      c.el.style.opacity = String(this.layout.opacity);
    }
  }

  private hit(x: number, y: number): Ctl | null {
    for (const c of this.ctls) {
      if (c.el.classList.contains('hidden')) continue;
      const r = c.el.getBoundingClientRect();
      const pad = 8;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return c;
    }
    return null;
  }

  private onStart(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const c = this.hit(t.clientX, t.clientY);
      if (!c) {
        if (!this.editing) this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
        continue;
      }
      if (this.editing) {
        this.active.set(t.identifier, c);
        continue;
      }
      this.active.set(t.identifier, c);
      if (c.kind === 'stick') {
        const r = c.el.getBoundingClientRect();
        this.stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      if (c.kind === 'tap') this.tap(c.id);
      this.apply(t, c);
    }
    this.refresh();
  }

  private onMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const lk = this.looks.get(t.identifier);
      if (lk) {
        this.input.addLook((t.clientX - lk.x) * 0.0065, (t.clientY - lk.y) * 0.005);
        lk.x = t.clientX;
        lk.y = t.clientY;
        continue;
      }
      let c = this.active.get(t.identifier);
      if (!c) continue;
      if (this.editing) {
        const W = window.innerWidth, H = window.innerHeight;
        this.layout.pos[c.id] = { x: clamp(t.clientX / W, 0.03, 0.97), y: clamp(t.clientY / H, 0.03, 0.97) };
        this.place();
        continue;
      }
      // glisser d'un bouton à l'autre (sauf joystick / gaz)
      if (c.kind === 'hold') {
        const n = this.hit(t.clientX, t.clientY);
        if (n && n !== c && n.kind !== 'stick' && n.kind !== 'tap') {
          this.active.set(t.identifier, n);
          c = n;
        }
      }
      this.apply(t, c);
    }
    this.refresh();
  }

  private onEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      this.looks.delete(t.identifier);
      const c = this.active.get(t.identifier);
      this.active.delete(t.identifier);
      if (this.editing && c) this.onLayoutChange?.(this.layout);
    }
    this.refresh();
  }

  private tap(id: string): void {
    const te = this.input.touchEdges as Record<string, boolean>;
    if (id in te) te[id] = true;
  }

  private apply(t: Touch, c: Ctl): void {
    if (c.kind === 'stick') {
      const r = c.el.getBoundingClientRect();
      const rad = r.width / 2;
      const dx = clamp((t.clientX - this.stickOrigin.x) / rad, -1, 1);
      const dy = clamp((t.clientY - this.stickOrigin.y) / rad, -1, 1);
      const knob = c.el.querySelector('.knob') as HTMLElement;
      knob.style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
    }
  }

  /** Recalcule l'état complet à partir des contacts actifs. */
  private refresh(): void {
    const s = this.input.touch;
    s.active = true;
    s.steer = 0;
    s.lean = 0;
    s.throttle = 0;
    s.frontBrake = 0;
    s.rearBrake = 0;
    s.clutch = false;
    s.jump = false;
    s.trick = false;
    const on = new Set<string>();
    const touches = new Map<number, { x: number; y: number }>();
    // positions courantes : on les relit depuis le dernier événement via les éléments actifs
    for (const [id, c] of this.active) {
      on.add(c.id);
      void id;
      void touches;
    }
    for (const c of this.ctls) c.el.classList.toggle('on', on.has(c.id) && c.kind !== 'stick');
    if (this.editing) return;
    // valeurs analogiques (joystick / gaz) calculées depuis la position du knob et du dernier contact
    const stick = this.ctls.find((c) => c.id === 'stick')!;
    if (on.has('stick')) {
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec((stick.el.querySelector('.knob') as HTMLElement).style.transform);
      const rad = stick.el.getBoundingClientRect().width / 2;
      if (m) {
        const dx = Number(m[1]) / (rad * 0.6), dy = Number(m[2]) / (rad * 0.6);
        s.steer = Math.sign(dx) * Math.min(1, Math.max(0, Math.abs(dx) - 0.08) / 0.85);
        s.lean = -Math.sign(dy) * Math.min(1, Math.max(0, Math.abs(dy) - 0.15) / 0.8);
      }
    } else (stick.el.querySelector('.knob') as HTMLElement).style.transform = '';
    s.throttle = on.has('throttle') ? this.throttleValue : 0;
    const fill = this.ctls.find((c) => c.id === 'throttle')!.el.querySelector('.fill') as HTMLElement;
    fill.style.height = `${Math.round(s.throttle * 100)}%`;
    s.frontBrake = on.has('front') ? 1 : 0;
    s.rearBrake = on.has('rear') ? 1 : 0;
    s.clutch = on.has('wheelie');
    s.jump = on.has('jump');
    s.trick = on.has('trick');
  }

  private throttleValue = 1;

  /** Doit être appelé sur chaque touchmove/touchstart pour suivre la hauteur du doigt sur la gâchette. */
  trackThrottle(e: TouchEvent): void {
    const thr = this.ctls.find((c) => c.id === 'throttle')!;
    for (const t of Array.from(e.touches)) {
      if (this.active.get(t.identifier) === thr) {
        const r = thr.el.getBoundingClientRect();
        const rel = (t.clientY - r.top) / r.height;
        this.throttleValue = clamp(1.18 - rel * 1.05, 0.3, 1);
      }
    }
  }

  setTrickHighlight(v: boolean): void {
    if (v === this.trickAvailable) return;
    this.trickAvailable = v;
    const t = this.ctls.find((c) => c.id === 'trick')!;
    t.el.style.boxShadow = v ? '0 0 18px rgba(255,43,214,0.9)' : '';
  }

  setEditing(v: boolean): void {
    this.editing = v;
    this.root.classList.toggle('edit', v);
    this.active.clear();
    this.applyMode();
  }

  resetLayout(): void {
    this.layout.pos = {};
    this.place();
    this.onLayoutChange?.(this.layout);
  }
}

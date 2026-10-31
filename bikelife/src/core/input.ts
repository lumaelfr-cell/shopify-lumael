// Entrées unifiées : clavier (QWERTY/AZERTY via codes physiques), manette
// (mapping standard) et commandes tactiles (alimentées par l'UI tactile).

import { clamp } from './math';

export interface Controls {
  throttle: number;
  frontBrake: number;
  rearBrake: number;
  steer: number;
  lean: number;
  clutch: boolean;
  jump: boolean;
  trick: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  camera: boolean;
  pause: boolean;
  respawn: boolean;
  horn: boolean;
  lookX: number;
  lookY: number;
}

export interface TouchState {
  active: boolean;
  steer: number;
  lean: number;
  throttle: number;
  frontBrake: number;
  rearBrake: number;
  clutch: boolean;
  jump: boolean;
  trick: boolean;
  lookX: number;
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private kbThrottle = 0;
  private kbRear = 0;
  private kbFront = 0;
  private prevPad: boolean[] = [];
  touch: TouchState = { active: false, steer: 0, lean: 0, throttle: 0, frontBrake: 0, rearBrake: 0, clutch: false, jump: false, trick: false, lookX: 0 };
  touchEdges = { camera: false, pause: false, respawn: false, shiftUp: false, shiftDown: false };
  lastDevice: InputDevice = 'keyboard';
  enabled = true;
  mouseLookX = 0;
  mouseLookY = 0;
  private mouseDown = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) this.mouseDown = true;
    });
    window.addEventListener('mouseup', () => (this.mouseDown = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.mouseLookX += e.movementX * 0.005;
      this.mouseLookY += e.movementY * 0.004;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private k(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private edge(code: string): boolean {
    return this.pressed.has(code);
  }

  poll(dt: number): Controls {
    const c: Controls = {
      throttle: 0, frontBrake: 0, rearBrake: 0, steer: 0, lean: 0, clutch: false, jump: false, trick: false,
      shiftUp: false, shiftDown: false, camera: false, pause: false, respawn: false, horn: false, lookX: 0, lookY: 0,
    };
    if (!this.enabled) {
      this.pressed.clear();
      return c;
    }
    // ---- clavier (gaz progressifs pour doser les wheelings)
    const thrKey = this.k('KeyW');
    this.kbThrottle += ((thrKey ? 1 : 0) - this.kbThrottle) * Math.min(1, dt * (thrKey ? 3.2 : 9));
    const rb = this.k('Space');
    this.kbRear += ((rb ? 1 : 0) - this.kbRear) * Math.min(1, dt * (rb ? 7 : 12));
    const fb = this.k('KeyS');
    this.kbFront += ((fb ? 1 : 0) - this.kbFront) * Math.min(1, dt * (fb ? 6 : 12));
    c.throttle = this.kbThrottle > 0.01 ? this.kbThrottle : 0;
    c.rearBrake = this.kbRear > 0.01 ? this.kbRear : 0;
    c.frontBrake = this.kbFront > 0.01 ? this.kbFront : 0;
    c.steer = (this.k('KeyD', 'ArrowRight') ? 1 : 0) - (this.k('KeyA', 'ArrowLeft') ? 1 : 0);
    c.lean = (this.k('ArrowUp') ? 1 : 0) - (this.k('ArrowDown') ? 1 : 0);
    c.clutch = this.k('ShiftLeft', 'ShiftRight');
    c.jump = this.k('KeyJ');
    c.trick = this.k('KeyK');
    c.shiftUp = this.edge('KeyE');
    c.shiftDown = this.edge('KeyQ');
    c.camera = this.edge('KeyC');
    c.pause = this.edge('Escape') || this.edge('KeyP');
    c.respawn = this.edge('KeyR');
    c.horn = this.k('KeyH');
    c.lookX = this.mouseLookX;
    c.lookY = this.mouseLookY;
    if (!this.mouseDown) {
      this.mouseLookX *= Math.max(0, 1 - dt * 2.5);
      this.mouseLookY *= Math.max(0, 1 - dt * 2.5);
    }
    this.pressed.clear();

    // ---- manette
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i: number) => p.buttons[i]?.value ?? 0;
      const pr = (i: number) => !!p.buttons[i]?.pressed;
      const ed = (i: number) => pr(i) && !this.prevPad[i];
      const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
      const any = p.buttons.some((x) => x.pressed) || p.axes.some((a) => Math.abs(a) > 0.3);
      if (any) this.lastDevice = 'gamepad';
      c.throttle = Math.max(c.throttle, b(7));
      c.frontBrake = Math.max(c.frontBrake, b(6));
      c.rearBrake = Math.max(c.rearBrake, b(1));
      if (Math.abs(dz(p.axes[0] ?? 0)) > Math.abs(c.steer)) c.steer = dz(p.axes[0] ?? 0);
      if (Math.abs(dz(p.axes[1] ?? 0)) > Math.abs(c.lean)) c.lean = -dz(p.axes[1] ?? 0);
      c.clutch = c.clutch || pr(0);
      c.jump = c.jump || pr(2);
      c.trick = c.trick || pr(3);
      c.shiftUp = c.shiftUp || ed(5);
      c.shiftDown = c.shiftDown || ed(4);
      c.camera = c.camera || ed(8);
      c.pause = c.pause || ed(9);
      c.respawn = c.respawn || ed(13);
      c.horn = c.horn || pr(12);
      c.lookX += dz(p.axes[2] ?? 0) * 1.2;
      c.lookY += dz(p.axes[3] ?? 0) * 0.6;
      this.prevPad = p.buttons.map((x) => x.pressed);
      break;
    }

    // ---- tactile
    const t = this.touch;
    if (t.active) {
      c.throttle = Math.max(c.throttle, t.throttle);
      c.frontBrake = Math.max(c.frontBrake, t.frontBrake);
      c.rearBrake = Math.max(c.rearBrake, t.rearBrake);
      if (Math.abs(t.steer) > Math.abs(c.steer)) c.steer = t.steer;
      if (Math.abs(t.lean) > Math.abs(c.lean)) c.lean = t.lean;
      c.clutch = c.clutch || t.clutch;
      c.jump = c.jump || t.jump;
      c.trick = c.trick || t.trick;
      c.lookX += t.lookX;
    }
    const te = this.touchEdges;
    c.camera = c.camera || te.camera;
    c.pause = c.pause || te.pause;
    c.respawn = c.respawn || te.respawn;
    c.shiftUp = c.shiftUp || te.shiftUp;
    c.shiftDown = c.shiftDown || te.shiftDown;
    te.camera = te.pause = te.respawn = te.shiftUp = te.shiftDown = false;
    c.steer = clamp(c.steer, -1, 1);
    c.lean = clamp(c.lean, -1, 1);
    return c;
  }

  /** Pour les menus : touche appuyée (front montant). */
  consumeKey(code: string): boolean {
    return this.pressed.has(code);
  }
}

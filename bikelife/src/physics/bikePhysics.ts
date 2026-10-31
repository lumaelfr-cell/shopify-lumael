// Simulation de la moto : corps rigide dans le plan longitudinal (tangage, transfert
// de masse, suspensions avant/arrière, adhérence par roue) + dynamique latérale
// (inclinaison, rayon de virage limité par l'adhérence, glisse / dérapage).
// Le wheeling et le stoppie émergent des forces appliquées aux points de contact.

import { CollisionWorld, GroundHit, isLoose, Surface, SURFACE_GRIP, WallHit } from './collision';
import { Engine, EngineControl, RPM2RAD } from './engine';
import type { BikeSpec, TireType } from '../data/bikes';
import type { Tuning } from '../data/parts';
import { clamp, DEG, lerp, smoothstep, wrapAngle } from '../core/math';

export interface BikeInput {
  throttle: number; // 0..1
  frontBrake: number; // 0..1
  rearBrake: number; // 0..1
  steer: number; // -1 gauche .. 1 droite
  lean: number; // -1 en arrière .. 1 en avant
  clutch: boolean; // bouton wheeling / embrayage
  jump: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
}

export const emptyInput = (): BikeInput => ({
  throttle: 0, frontBrake: 0, rearBrake: 0, steer: 0, lean: 0, clutch: false, jump: false, shiftUp: false, shiftDown: false,
});

/** 0 = simulation, 1 = normal, 2 = arcade */
export type AssistLevel = 0 | 1 | 2;

const TIRE_GRIP: Record<TireType, { hard: number; loose: number; wet: number }> = {
  knobby: { hard: 0.88, loose: 1.22, wet: 0.82 },
  enduro: { hard: 0.95, loose: 1.1, wet: 0.84 },
  street: { hard: 1.06, loose: 0.72, wet: 0.8 },
  slick: { hard: 1.16, loose: 0.5, wet: 0.62 },
};

const SAMPLES = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];
const SAMPLE_VALS = new Float64Array(SAMPLES.length);
const SAMPLE_SURF: Surface[] = SAMPLES.map(() => 'asphalt' as Surface);
const G = 9.81;

class Wheel {
  r = 0.33;
  travel = 0.3;
  k = 10000;
  cComp = 600;
  cReb = 900;
  preload = 0;
  sag = 0.1;
  sa = 0;
  sb = 0;
  ua = 0;
  ub = 1;
  inertia = 0.8;
  comp = 0;
  prevComp = 0;
  contact = false;
  load = 0;
  longF = 0;
  surf: Surface = 'asphalt';
  cx = 0;
  cy = 0;
  cz = 0;
  omega = 0;
  rot = 0;
  locked = false;
  slipping = true;
  skid = 0;
  grip = 1;
  /** centre de roue (monde) */
  wx = 0;
  wy = 0;
  wz = 0;
}

interface ScrapePoint {
  a: number;
  b: number;
  crash: boolean;
  bar?: boolean;
}

export type BikeState = 'ground' | 'wheelie' | 'stoppie' | 'air';

export class BikePhysics {
  spec: BikeSpec;
  tuning: Tuning;
  world: CollisionWorld;
  engine: Engine;
  mass = 0;
  front = new Wheel();
  rear = new Wheel();

  // état
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  yaw = 0;
  pitch = 0;
  pitchVel = 0;
  roll = 0;
  yawRate = 0;
  steerVis = 0;
  riderLean = 0;
  private riderLeanPrev = 0;
  private steerSm = 0;
  private pullTimer = 0;
  private pullHeld = 0;
  private prevClutch = false;
  private jumpCharge = 0;
  private prevJump = false;
  assist: AssistLevel = 1;
  autoGear = true;
  wetness = 0;
  trickActive = false;

  // dérivés
  speed = 0;
  forwardSpeed = 0;
  slipAngle = 0;
  state: BikeState = 'ground';
  airTime = 0;
  airborne = false;
  groundedTime = 0;
  scrape = 0;
  scrapeX = 0;
  scrapeY = 0;
  scrapeZ = 0;
  lastLandImpact = 0;
  landedThisFrame = false;
  crashed = false;
  crashReason = '';
  crashSpeed = 0;
  balanceAngle = 0.6;
  odometer = 0;
  throttle = 0;
  airRoll = 0;
  private gh: GroundHit = { h: 0, surf: 'asphalt', id: -1 };
  private wall: WallHit = { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false };
  private scrapePts: ScrapePoint[] = [];
  private comY = 0.8;
  private wasAir = false;
  private ctl: EngineControl = { throttle: 0, clutchHeld: false, shiftUp: false, shiftDown: false, autoGear: true };

  constructor(spec: BikeSpec, tuning: Tuning, world: CollisionWorld) {
    this.spec = spec;
    this.tuning = tuning;
    this.world = world;
    this.engine = new Engine(spec);
    this.configure();
  }

  /** (Re)calcule tous les paramètres dérivés de la fiche technique et du réglage. */
  configure(): void {
    const s = this.spec;
    const t = this.tuning;
    this.engine.torqueMult = t.torqueMult;
    this.engine.gearMult = t.gearMult;
    this.mass = s.mass + 75 + t.massDelta;
    const m = this.mass;
    this.comY = s.comY + t.rideHeight;
    const L = s.wheelbase;
    const b = s.comX;
    const frontLoad = m * G * (b / L);
    const rearLoad = m * G * (1 - b / L);
    const setup = (w: Wheel, r: number, travel: number, freq: number, load: number) => {
      w.r = r;
      w.travel = travel * t.suspTravelMult;
      const mw = load / G;
      w.k = mw * (Math.PI * 2 * freq) ** 2 * t.suspStiffness;
      w.sag = 0.3 * w.travel;
      w.preload = load - w.k * w.sag;
      if (w.preload < 0) {
        w.preload = 0;
        w.sag = load / w.k;
      }
      w.cComp = 2 * 0.32 * Math.sqrt(w.k * mw);
      w.cReb = 2 * 0.5 * Math.sqrt(w.k * mw);
    };
    setup(this.rear, s.rRear, s.travelR, s.freqR, rearLoad);
    setup(this.front, s.rFront, s.travelF, s.freqF, frontLoad);
    this.rear.sa = -b;
    this.rear.sb = s.rRear - this.comY;
    this.rear.ua = 0.1;
    this.rear.ub = Math.sqrt(1 - 0.01);
    const rk = s.rake * DEG;
    this.front.sa = L - b;
    this.front.sb = s.rFront - this.comY;
    this.front.ua = -Math.sin(rk);
    this.front.ub = Math.cos(rk);
    this.rear.inertia = s.cls === 'scooter' ? 0.55 : 0.85;
    this.front.inertia = 0.5;
    // points de frottement / crash (repère moto : origine au sol sous l'axe arrière)
    const toLocal = (zm: number, ym: number) => ({ a: zm - b, b: ym - this.comY });
    const pts: ScrapePoint[] = [];
    if (s.cls === 'scooter') {
      pts.push({ ...toLocal(-0.46, 0.78), crash: false });
      pts.push({ ...toLocal(L * 0.55, 0.16), crash: false });
      pts.push({ ...toLocal(L * 0.38, 1.62), crash: true });
      pts.push({ ...toLocal(L - 0.32, 1.05), crash: true });
    } else {
      const tidy = s.cls === 'stunt' || t.hasStuntBar;
      pts.push({ ...toLocal(tidy ? -0.34 : -0.56, tidy ? 0.86 : 0.93), crash: false });
      if (t.hasStuntBar) pts.push({ ...toLocal(-0.36, 0.78), crash: false, bar: true });
      pts.push({ ...toLocal(L * 0.6, 0.27), crash: false });
      pts.push({ ...toLocal(L * 0.36, 1.78), crash: true });
      pts.push({ ...toLocal(L - 0.44, 1.14), crash: true });
    }
    this.scrapePts = pts;
  }

  reset(x: number, z: number, yaw: number, groundY?: number): void {
    const gh = this.world.groundAt(x, z, groundY !== undefined ? groundY + 0.5 : 1e4, this.gh);
    this.x = x;
    this.z = z;
    this.y = (groundY ?? gh.h) + this.comY + 0.02;
    this.vx = this.vy = this.vz = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.pitchVel = 0;
    this.roll = 0;
    this.yawRate = 0;
    this.steerSm = 0;
    this.riderLean = this.riderLeanPrev = 0;
    this.pullTimer = 0;
    this.crashed = false;
    this.crashReason = '';
    this.airTime = 0;
    this.airborne = false;
    this.wasAir = false;
    this.trickActive = false;
    this.airRoll = 0;
    for (const w of [this.front, this.rear]) {
      w.comp = w.prevComp = w.sag;
      w.contact = true;
      w.omega = 0;
      w.locked = false;
      w.slipping = false;
      w.skid = 0;
    }
    this.engine.reset();
  }

  gripFor(surf: Surface): number {
    const tire = TIRE_GRIP[this.tuning.tire];
    const loose = isLoose(surf);
    let g = SURFACE_GRIP[surf] * (loose ? tire.loose : tire.hard);
    if (!loose && this.wetness > 0) g *= lerp(1, tire.wet * 0.85, this.wetness);
    return g;
  }

  step(dt: number, inp: BikeInput): void {
    this.landedThisFrame = false;
    if (this.crashed || !(dt > 1e-5)) return;
    dt = Math.min(dt, 1 / 20);
    const s = this.spec;
    // ---- entrées lissées (niveau frame)
    const isCVT = !s.gears;
    const clutchBtn = inp.clutch;
    if (isCVT) {
      // scooter : le bouton wheeling = tirer sur le guidon + se reculer
      if (clutchBtn) this.pullHeld += dt;
      else this.pullHeld = 0;
    } else {
      if (this.prevClutch && !clutchBtn) this.pullTimer = 0.45;
    }
    this.prevClutch = clutchBtn;
    if (this.pullTimer > 0) this.pullTimer -= dt;
    const pulling = isCVT ? clutchBtn : this.pullTimer > 0;
    const leanTarget = clamp(inp.lean - (pulling ? 0.7 : 0), -1, 1);
    this.riderLeanPrev = this.riderLean;
    this.riderLean += (leanTarget - this.riderLean) * Math.min(1, dt * 7);
    const leanVel = (this.riderLean - this.riderLeanPrev) / dt;
    const steerRate = 3.2 + 4 / (1 + this.speed * 0.25);
    this.steerSm += clamp(inp.steer - this.steerSm, -steerRate * dt, steerRate * dt);

    // engine control
    this.throttle = inp.throttle;
    this.ctl.throttle = !isCVT && clutchBtn ? Math.max(inp.throttle, this.assist === 2 ? 1 : inp.throttle) : inp.throttle;
    this.ctl.clutchHeld = !isCVT && clutchBtn;
    this.ctl.shiftUp = inp.shiftUp;
    this.ctl.shiftDown = inp.shiftDown;
    this.ctl.autoGear = this.autoGear;

    // saut (bunny hop) : charger puis relâcher
    if (inp.jump) this.jumpCharge = Math.min(1, this.jumpCharge + dt * 3);
    if (this.prevJump && !inp.jump) {
      if ((this.rear.contact || this.front.contact) && this.jumpCharge > 0.2) {
        this.vy += 2.7 * this.jumpCharge;
        this.pitchVel += 0.5 * this.jumpCharge;
      }
      this.jumpCharge = 0;
    }
    this.prevJump = inp.jump;

    const n = Math.min(10, Math.max(1, Math.ceil(dt / (1 / 240))));
    const h = dt / n;
    for (let i = 0; i < n && !this.crashed; i++) {
      this.substep(h, inp, leanVel, pulling);
      // les changements de rapport ne doivent compter qu'une fois
      this.ctl.shiftUp = false;
      this.ctl.shiftDown = false;
    }
    if (!this.crashed) this.collideWalls();
    this.derive(dt);
  }

  private substep(dt: number, inp: BikeInput, leanVel: number, pulling: boolean): void {
    const s = this.spec;
    const m = this.mass;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;
    let vU = this.vy;
    const th = this.pitch;
    const c = Math.cos(th), sn = Math.sin(th);
    let w = this.pitchVel;
    const shift = this.riderLean * 0.11;

    let Fa = 0;
    let Fb = -m * G;
    let T = 0;
    const gh = this.gh;

    // --------- roues
    for (let wi = 0; wi < 2; wi++) {
      const wh = wi === 0 ? this.rear : this.front;
      const la = wh.sa - shift;
      const lb = wh.sb;
      const ea0 = la - wh.ua * wh.sag, eb0 = lb - wh.ub * wh.sag;
      const ea = ea0 * c - eb0 * sn, eb = ea0 * sn + eb0 * c;
      const ua = wh.ua * c - wh.ub * sn, ub = wh.ua * sn + wh.ub * c;
      const EX = this.x + fx * ea, EZ = this.z + fz * ea, EY = this.y + eb;
      let comp = wh.comp;
      let req = 0, dBest = 0;
      let surf: Surface = 'asphalt';
      const ubSafe = Math.max(ub, 0.25);
      for (let it = 0; it < 2; it++) {
        const WX = EX + fx * ua * comp, WZ = EZ + fz * ua * comp, WY = EY + ub * comp;
        let best = -1e9;
        let bi = 3;
        for (let k = 0; k < SAMPLES.length; k++) {
          const d = SAMPLES[k] * wh.r;
          this.world.groundAt(WX + fx * d, WZ + fz * d, WY + wh.r * 0.55, gh);
          const hr = gh.h + Math.sqrt(wh.r * wh.r - d * d);
          SAMPLE_VALS[k] = hr;
          SAMPLE_SURF[k] = gh.surf;
          if (hr > best + 1e-6 || (Math.abs(hr - best) <= 1e-6 && Math.abs(SAMPLES[k]) < Math.abs(SAMPLES[bi]))) {
            best = hr;
            bi = k;
          }
        }
        surf = SAMPLE_SURF[bi];
        dBest = SAMPLES[bi] * wh.r;
        // raffinement parabolique pour une normale continue sur les pentes
        if (bi > 0 && bi < SAMPLES.length - 1) {
          const y0 = SAMPLE_VALS[bi - 1], y1 = SAMPLE_VALS[bi], y2 = SAMPLE_VALS[bi + 1];
          const den = y0 - 2 * y1 + y2;
          if (den < -1e-7) {
            const off = clamp((0.5 * (y0 - y2)) / den, -0.5, 0.5);
            const step = 0.3 * wh.r;
            dBest += off * step;
            best = clamp(y1 + (off * (y2 - y0)) / 2 + (off * off * den) / 2, y1, y1 + 0.012);
            dBest = clamp(dBest, -0.92 * wh.r, 0.92 * wh.r);
          }
        }
        req = best;
        comp = (req - EY) / ubSafe;
        if (comp <= 0) break;
      }

      {
        const cc = Math.max(0, Math.min(comp, wh.travel));
        wh.wx = EX + fx * ua * cc;
        wh.wz = EZ + fz * ua * cc;
        wh.wy = EY + ub * cc;
      }
      let Ft = 0;
      if (comp <= 0) {
        wh.contact = false;
        wh.comp = 0;
        wh.prevComp = 0;
        wh.load = 0;
        wh.skid = 0;
        // roue libre
        if (wi === 0) this.rearAir(dt, inp);
        else {
          if (inp.frontBrake > 0.1) wh.omega *= Math.max(0, 1 - dt * 12 * inp.frontBrake);
          wh.locked = false;
        }
        wh.slipping = true;
        wh.rot += wh.omega * dt;
        continue;
      }
      wh.contact = true;
      wh.surf = surf;
      const cs = Math.min(comp, wh.travel);
      const over = comp - cs;
      const rate = clamp((cs - wh.prevComp) / dt, -6, 6);
      let Fs = wh.k * cs + wh.preload + (rate > 0 ? wh.cComp : wh.cReb) * rate;
      if (Fs < 0) Fs = 0;
      const nzRaw = Math.sqrt(wh.r * wh.r - dBest * dBest);
      const na = -dBest / wh.r, nb = nzRaw / wh.r;
      const dotNU = na * ua + nb * ub;
      let N = Fs / Math.max(0.3, dotNU);
      if (N > m * G * 30) N = m * G * 30;
      const Ca = ea + ua * comp + dBest;
      const Cb = req - nzRaw - this.y;
      if (over > 0.002) {
        // talonnage : contrainte de non-pénétration (impulsion + correction de position)
        const vn = (vF - w * Cb) * na + (vU + w * Ca) * nb;
        if (vn < 0) {
          // le pilote et le pneu absorbent une partie du choc : inertie effective accrue
          const rn = Ca * nb - Cb * na;
          const Ieff = s.pitchInertia * 3;
          const J = -vn / (1 / m + (rn * rn) / Ieff);
          vF += (J * na) / m;
          vU += (J * nb) / m;
          w += clamp((J * rn) / Ieff, -2.2, 2.2);
          if (-vn > 2.5) this.bottomOut = Math.max(this.bottomOut, -vn);
        }
        const corr = over * 0.85;
        this.x += fx * na * corr;
        this.z += fz * na * corr;
        this.y += nb * corr;
      }
      const ta = nb, tb = -na;
      const vca = vF - w * Cb, vcb = vU + w * Ca;
      const vt = vca * ta + vcb * tb;
      const mu = this.gripFor(surf);
      wh.grip = mu;
      if (wi === 0) Ft = this.rearLong(wh, N, mu, vt, dt, inp);
      else Ft = this.frontLong(wh, N, mu, vt, dt, inp);
      // résistance au roulement (plus forte en terrain meuble)
      const crr = isLoose(surf) ? 0.045 : 0.014;
      if (Math.abs(vt) > 0.05) Ft -= Math.sign(vt) * Math.min(crr * N, (Math.abs(vt) * m) / dt * 0.2);
      const Fwa = N * na + Ft * ta, Fwb = N * nb + Ft * tb;
      Fa += Fwa;
      Fb += Fwb;
      T += Ca * Fwb - Cb * Fwa;
      wh.load = N;
      wh.longF = Ft;
      wh.comp = cs;
      wh.prevComp = cs;
      wh.cx = this.x + fx * Ca;
      wh.cy = this.y + Cb;
      wh.cz = this.z + fz * Ca;
      wh.rot += wh.omega * dt;
    }

    // --------- points de frottement (garde-boue, barre de 12h, sabot) & crash
    this.scrape = Math.max(0, this.scrape - dt * 4);
    this.fenderScrape = Math.max(0, this.fenderScrape - dt * 0.6);
    for (const p of this.scrapePts) {
      const la = p.a - shift;
      const pa = la * c - p.b * sn, pb = la * sn + p.b * c;
      const PX = this.x + fx * pa, PZ = this.z + fz * pa, PY = this.y + pb;
      this.world.groundAt(PX, PZ, PY + 0.45, gh);
      const pen = gh.h - PY;
      if (pen > 0) {
        if (p.crash) {
          this.doCrash(this.pitch > 0.5 ? 'Looping arrière' : 'Chute', Math.hypot(vF, vU));
          return;
        }
        const vpa = vF - w * pb, vpb = vU + w * pa;
        const Fn = Math.max(0, m * G * 45 * pen - m * 9 * Math.min(0, vpb));
        const mu = p.bar ? 0.32 : 0.5;
        const Ff = Math.abs(vpa) > 0.05 ? -Math.sign(vpa) * Math.min(mu * Fn, (Math.abs(vpa) * m) / dt * 0.3) : 0;
        Fa += Ff;
        Fb += Fn;
        T += pa * Fn - pb * Ff;
        if (p.bar) this.barScrape += dt;
        else if (!p.crash && p.a < 0) {
          // garde-boue qui frotte : toléré un court instant seulement
          this.fenderScrape += dt;
          if (this.fenderScrape > 0.45 && this.speed > 4) {
            this.doCrash('Looping arrière', Math.hypot(vF, vU));
            return;
          }
        }
        if (Math.abs(vpa) > 1) {
          this.scrape = 1;
          this.scrapeX = PX;
          this.scrapeY = gh.h;
          this.scrapeZ = PZ;
        }
      }
    }

    const rear = this.rear, front = this.front;
    const anyContact = rear.contact || front.contact;
    const L = s.wheelbase;

    // --------- couples du pilote / aides
    const Ic = s.pitchInertia + m * (s.comX * s.comX + this.comY * this.comY);
    const bNow = s.comX + shift;
    this.balanceAngle = Math.atan2(bNow, this.comY);
    if (rear.contact) {
      // coup de reins : déplacement brutal du corps vers l'arrière
      T += -leanVel * m * 0.32;
      if (pulling && this.speed > 0.5) {
        const isCVT = !s.gears;
        const base = m * G * s.comX;
        let k = isCVT ? 0.62 : 0.34;
        if (isCVT) k *= this.pullHeld < 0.5 ? 1 : Math.max(0.35, 1 - (this.pullHeld - 0.5) * 0.9);
        else k *= this.pullTimer / 0.45;
        const room = clamp((this.balanceAngle - 8 * DEG - this.pitch) / (14 * DEG), 0, 1);
        T += base * k * room * Math.min(1, inp.throttle + 0.3);
      }
    }
    if (rear.contact && !front.contact && th > 0.05) {
      // wheeling : amortissement naturel du pilote + aide selon le niveau
      const target = this.balanceAngle - 6 * DEG - inp.lean * 9 * DEG;
      const gStiff = m * G * Math.hypot(s.comX, this.comY);
      const base = m * G * s.comX;
      const e = target - th;
      let ta: number;
      if (this.assist === 0) {
        ta = -0.12 * Ic * w;
      } else {
        const arcade = this.assist === 2;
        // sous la cible : aide douce ; au-dessus : protection anti-looping plus ferme
        const kp = e > 0 ? gStiff * (arcade ? 1.6 : 0.7) : gStiff * (arcade ? 4.2 : 2.1);
        const kd = Ic * (arcade ? 3.0 : 1.5);
        const capUp = base * (arcade ? 0.9 : 0.3);
        const capDown = base * (arcade ? 3.2 : 1.5);
        ta = clamp(kp * e - kd * w, -capDown, capUp + 0.1 * Ic * Math.abs(w));
      }
      T += ta;
    } else if (front.contact && !rear.contact && th < -0.04) {
      // stoppie : amortissement + protection anti-soleil selon l'aide
      const bal = -Math.atan2(L - bNow, this.comY);
      const lim = bal + (this.assist === 2 ? 14 : 8) * DEG;
      let ts = -w * Ic * (this.assist > 0 ? 0.5 : 0.15);
      if (this.assist > 0 && th < lim) ts += (lim - th) * m * G * Math.hypot(L - s.comX, this.comY) * (this.assist === 2 ? 4 : 2.2);
      T += ts;
    }
    if (!anyContact) {
      // en l'air : le pilote fait pivoter la moto avec son poids
      const I0 = s.pitchInertia;
      T += -inp.lean * I0 * (this.assist > 0 ? 4.4 : 3.6) - w * I0 * 1.8;
    }

    // --------- dynamique latérale
    const av = Math.abs(vF);
    if (anyContact) {
      const muF = front.contact ? front.grip : 0;
      const muR = rear.contact ? rear.grip : 0;
      const muLat = Math.max(0.3, front.contact && rear.contact ? (muF + muR) / 2 : Math.max(muF, muR));
      const maxSteer = s.maxSteer * DEG;
      const aMax = Math.min(muLat * G * 0.95, (vF * vF * Math.tan(maxSteer)) / L);
      let leanTarget = Math.atan2(this.steerSm * aMax, G);
      if (!front.contact) leanTarget *= 0.7;
      if (this.wasAir) this.roll = this.airRoll;
      this.roll += clamp((leanTarget - this.roll) * 8, -3.4, 3.4) * dt;
      const kSteer = Math.tan(this.steerSm * maxSteer) / L;
      const kLean = av > 0.5 ? (G * Math.tan(this.roll)) / (vF * vF) : 0;
      let kappa = lerp(kSteer, kLean, smoothstep(1.5, 5, av));
      if (!front.contact && rear.contact) kappa *= 0.42;
      let yawRate = vF * kappa;
      // glisse du train arrière
      const rearSliding = rear.contact && (rear.locked || (rear.slipping && Math.abs(rear.omega * rear.r - vF) > 1.2));
      if (rearSliding && av > 3) yawRate += this.steerSm * 1.7 * Math.min(1, av / 9) + Math.sign(vL) * 0.0;
      this.yawRate = yawRate;
      // adhérence latérale disponible (cercle de friction)
      const latAvail = (wh: Wheel, mu: number) => {
        if (!wh.contact) return 0;
        const lim = mu * wh.load;
        const used = Math.min(1, Math.abs(wh.longF) / (lim + 1e-3));
        let a = lim * Math.sqrt(Math.max(0.05, 1 - used * used));
        if (wh.locked) a *= 0.35;
        else if (wh.slipping && wh === this.rear) a *= 0.5;
        return a;
      };
      const avail = latAvail(front, muF) + latAvail(rear, muR);
      const FlReq = (-m * vL) / dt;
      const Fl = clamp(FlReq, -avail, avail);
      vL += (Fl / m) * dt;
    } else {
      // en l'air : léger contrôle de cap, "whip" avec la direction
      this.yawRate = this.steerSm * 0.55;
      this.airRoll += (this.steerSm * 0.75 - this.airRoll) * Math.min(1, dt * 3.5);
      this.roll = this.airRoll;
    }
    if (anyContact) this.airRoll = this.roll;

    // gyroscopique roue arrière (accélérer la roue cabre la moto)
    // (calculé dans rearLong/rearAir via gyroT)
    T += clamp(this.gyroT, -m * G * 0.6, m * G * 0.6);
    this.gyroT = 0;

    // --------- intégration
    vF += (Fa / m) * dt;
    vU += (Fb / m) * dt;
    this.vx = fx * vF + rx * vL;
    this.vz = fz * vF + rz * vL;
    this.vy = vU;
    this.pitchVel = w + (T / s.pitchInertia) * dt;
    // amortissement numérique très léger
    this.pitchVel *= 1 - dt * 0.15;
    this.pitch += this.pitchVel * dt;
    this.yaw = wrapAngle(this.yaw - this.yawRate * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.odometer += Math.abs(vF) * dt;

    // --------- conditions de chute
    const loopLimit = (s.cls === 'stunt' || this.tuning.hasStuntBar ? 88 : 80) * DEG;
    if (this.pitch > loopLimit) this.doCrash('Looping arrière', av);
    else if (this.pitch < -62 * DEG) this.doCrash('Passage par-dessus le guidon', av);
    else if (anyContact && Math.abs(this.roll) > 64 * DEG) this.doCrash('Glissade', av);
  }

  private gyroT = 0;
  private fenderScrape = 0;
  /** temps cumulé de frottement de la barre de 12h (score) */
  barScrape = 0;
  /** vitesse d'impact du dernier talonnage (m/s), remis à zéro par le jeu */
  bottomOut = 0;

  private rearLong(wh: Wheel, N: number, mu: number, vt: number, dt: number, inp: BikeInput): number {
    const s = this.spec;
    const r = wh.r;
    const m = this.mass;
    const rb = inp.rearBrake;
    const brakeF = rb * s.brakeR * G * m * this.tuning.brakeMult * (this.tuning.rearHandBrake ? 1.15 : 1);
    const lim = mu * N;
    const limK = lim * 0.8;
    let Ft: number;
    const om0 = wh.omega;
    if (!wh.slipping) {
      wh.omega = vt / r;
      const res = this.engine.step(dt, this.ctl, wh.omega, true, false, wh.inertia, 0);
      const Fd = res.wheelTorque / r;
      let Freq = Fd;
      if (brakeF > 0) {
        if (Math.abs(vt) > 0.4) Freq -= Math.sign(vt) * brakeF;
        else Freq -= clamp(((vt * m) / dt) * 0.3, -brakeF, brakeF);
      }
      if (Math.abs(Freq) > lim) {
        wh.slipping = true;
        Ft = Math.sign(Freq) * limK;
        wh.omega += (Math.sign(Freq) * 0.6) / r;
      } else Ft = Freq;
      wh.locked = false;
    } else {
      const slipVel = wh.omega * r - vt;
      Ft = limK * clamp(slipVel / 0.8, -1, 1);
      const brakeT = brakeF * r * (Math.abs(wh.omega) > 0.6 ? 1 : Math.abs(wh.omega) / 0.6);
      const ext = -Ft * r - Math.sign(wh.omega) * brakeT;
      const res = this.engine.step(dt, this.ctl, wh.omega, true, true, wh.inertia, ext);
      const prev = wh.omega;
      wh.omega = res.wheelOmega;
      if (brakeF > 0 && prev * wh.omega < 0) wh.omega = 0;
      wh.locked = brakeF > lim * 0.5 && Math.abs(wh.omega) < 0.8 && Math.abs(vt) > 1;
      const ns = wh.omega * r - vt;
      if (Math.abs(ns) < 0.35 || Math.sign(ns) !== Math.sign(slipVel)) {
        const Fd = res.wheelTorque / r;
        const demand = Math.abs(Fd - (Math.abs(vt) > 0.4 ? Math.sign(vt) * brakeF : 0));
        if (demand < lim) {
          wh.slipping = false;
          wh.locked = false;
          wh.omega = vt / r;
        }
      }
    }
    wh.skid = wh.slipping ? clamp(Math.abs(wh.omega * r - vt) / 5, 0, 1) : 0;
    this.gyroT += (wh.inertia * (wh.omega - om0)) / dt;
    return Ft;
  }

  private rearAir(dt: number, inp: BikeInput): void {
    const wh = this.rear;
    const s = this.spec;
    const brakeT = inp.rearBrake * s.brakeR * G * this.mass * wh.r * 0.3 * (Math.abs(wh.omega) > 0.6 ? 1 : Math.abs(wh.omega) / 0.6);
    const ext = -Math.sign(wh.omega) * brakeT - wh.omega * 0.05;
    const om0 = wh.omega;
    const res = this.engine.step(dt, this.ctl, wh.omega, false, true, wh.inertia, ext);
    wh.omega = res.wheelOmega;
    if (inp.rearBrake > 0.1 && om0 * wh.omega < 0) wh.omega = 0;
    this.gyroT += (wh.inertia * (wh.omega - om0)) / dt;
    wh.locked = false;
  }

  private frontLong(wh: Wheel, N: number, mu: number, vt: number, dt: number, inp: BikeInput): number {
    const s = this.spec;
    const m = this.mass;
    const brakeF = inp.frontBrake * s.brakeF * G * m * this.tuning.brakeMult;
    const lim = mu * N;
    let Ft = 0;
    if (!wh.locked) {
      wh.omega = vt / wh.r;
      if (brakeF > 0) {
        if (Math.abs(vt) > 0.4) Ft = -Math.sign(vt) * brakeF;
        else Ft = -clamp(((vt * m) / dt) * 0.3, -brakeF, brakeF);
        if (Math.abs(Ft) > lim * 1.02 && Math.abs(vt) > 1) {
          wh.locked = true;
          Ft = Math.sign(Ft) * lim * 0.8;
        }
      }
    } else {
      wh.omega = 0;
      Ft = -lim * 0.8 * clamp(vt / 0.5, -1, 1);
      if (brakeF < lim * 0.85 || Math.abs(vt) < 0.3) wh.locked = false;
    }
    wh.slipping = false;
    wh.skid = wh.locked ? clamp(Math.abs(vt) / 5, 0, 1) : 0;
    return Ft;
  }

  private collideWalls(): void {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rear = this.rear, front = this.front;
    const yHead = this.y + 0.9;
    const pts: [number, number, number][] = [
      [rear.wx, rear.wz, rear.wy - rear.r],
      [(rear.wx + front.wx) / 2, (rear.wz + front.wz) / 2, Math.min(rear.wy - rear.r, front.wy - front.r)],
      [front.wx + fx * 0.15, front.wz + fz * 0.15, front.wy - front.r],
    ];
    let worstImpact = 0;
    let tag: string | undefined;
    for (const [px, pz, feet] of pts) {
      const hit = this.world.collideCapsule(px, pz, feet + 0.03, yHead, 0.34, 0.42, this.wall);
      if (!hit.hit) continue;
      // limiter la correction (évite les téléportations à travers un volume)
      let cx = hit.px, cz = hit.pz;
      const cl = Math.hypot(cx, cz);
      if (cl > 0.5) {
        cx *= 0.5 / cl;
        cz *= 0.5 / cl;
      }
      this.x += cx;
      this.z += cz;
      rear.wx += cx; rear.wz += cz; front.wx += cx; front.wz += cz;
      const nlen = cl || 1;
      const nx = hit.px / nlen, nz = hit.pz / nlen;
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        worstImpact = Math.max(worstImpact, -vn);
        tag = hit.tag;
        this.vx -= nx * vn * 1.15;
        this.vz -= nz * vn * 1.15;
        this.vx *= 0.92;
        this.vz *= 0.92;
      }
    }
    if (worstImpact > 7.5) this.doCrash(tag === 'bounds' ? 'Limite du monde' : 'Choc frontal', worstImpact);
  }

  private derive(dt: number): void {
    const s = this.spec;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const vF = this.vx * fx + this.vz * fz;
    const vL = this.vx * -fz + this.vz * fx;
    this.forwardSpeed = vF;
    this.speed = Math.hypot(this.vx, this.vz);
    this.slipAngle = this.speed > 1.5 ? Math.atan2(vL, Math.abs(vF)) : 0;
    const f = this.front.contact, r = this.rear.contact;
    if (!f && !r) this.state = 'air';
    else if (r && !f && this.pitch > 0.035) this.state = 'wheelie';
    else if (f && !r && this.pitch < -0.03) this.state = 'stoppie';
    else this.state = 'ground';
    const inAir = this.state === 'air';
    if (inAir) {
      this.airTime += dt;
      this.groundedTime = 0;
    } else {
      if (this.wasAir) {
        this.landedThisFrame = true;
        this.lastLandImpact = Math.max(0, -this.vy);
        // vérifications à la réception
        if (this.airTime > 0.25) {
          if (this.trickActive) this.doCrash('Figure non terminée', this.speed);
          else if (Math.abs(this.airRoll) > 0.72) this.doCrash('Réception de travers', this.speed);
          else if (Math.abs(this.slipAngle) > 58 * DEG && this.speed > 5) this.doCrash('Réception en crabe', this.speed);
        }
      }
      this.groundedTime += dt;
      if (!this.crashed) this.airTime = 0;
    }
    this.wasAir = inAir;
    this.airborne = inAir;
    if (!inAir && Math.abs(this.slipAngle) > 78 * DEG && this.speed > 6) this.doCrash('Perte de contrôle', this.speed);
    // braquage visuel
    const L = s.wheelbase;
    const kappa = Math.abs(vF) > 0.5 ? this.yawRate / vF : 0;
    let steer = Math.atan(L * kappa);
    steer = lerp(this.steerSm * s.maxSteer * DEG, steer, smoothstep(1.5, 6, Math.abs(vF)));
    if (this.rear.contact && Math.abs(this.slipAngle) > 0.15) steer -= this.slipAngle * 0.5;
    if (this.state === 'air') steer = this.steerSm * 0.35;
    this.steerVis += (clamp(steer, -s.maxSteer * DEG, s.maxSteer * DEG) - this.steerVis) * Math.min(1, dt * 14);
  }

  doCrash(reason: string, speed: number): void {
    if (this.crashed) return;
    this.crashed = true;
    this.crashReason = reason;
    this.crashSpeed = speed;
  }

  get rpm(): number {
    return this.engine.rpm;
  }

  get kmh(): number {
    return this.speed * 3.6;
  }

  /** Rotation de roue arrière en tr/min (pour son / fumée). */
  get rearWheelRpm(): number {
    return this.rear.omega / RPM2RAD;
  }

  get comHeight(): number {
    return this.comY;
  }
}

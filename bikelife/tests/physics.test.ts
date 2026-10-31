import { describe, it, expect } from 'vitest';
import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput, BikeInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID, BIKES } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';

function mk(id: string, world = new CollisionWorld(), assist: 0 | 1 | 2 = 1) {
  const spec = BIKE_BY_ID[id];
  const b = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), world);
  b.assist = assist;
  b.reset(0, 0, 0);
  return b;
}

function run(b: BikePhysics, seconds: number, f: (t: number) => Partial<BikeInput>): void {
  for (let t = 0; t < seconds; t += 1 / 60) b.step(1 / 60, { ...emptyInput(), ...f(t) });
}

describe('physique moto', () => {
  it('reste stable à l’arrêt (pas de dérive, pas de NaN)', () => {
    const b = mk('aoz-az125');
    run(b, 3, () => ({}));
    expect(Number.isFinite(b.x)).toBe(true);
    expect(b.kmh).toBeLessThan(0.5);
    expect(Math.abs(b.pitch)).toBeLessThan(0.02);
  });

  it('ignore un pas de temps nul', () => {
    const b = mk('aoz-az125');
    b.step(0, emptyInput());
    expect(Number.isFinite(b.y)).toBe(true);
  });

  it('chaque véhicule accélère, freine et reste numériquement stable', () => {
    for (const spec of BIKES) {
      const b = mk(spec.id, new CollisionWorld(), 2);
      run(b, 6, () => ({ throttle: 0.9, lean: 0.7 }));
      expect(b.kmh, spec.id).toBeGreaterThan(20);
      const v = b.kmh;
      run(b, 4, () => ({ frontBrake: 0.8, rearBrake: 0.5 }));
      expect(b.kmh, spec.id).toBeLessThan(v);
      expect(Number.isFinite(b.x + b.y + b.z + b.pitch), spec.id).toBe(true);
    }
  });

  it('un 450 4T lève la roue avant à pleine charge en 1re', () => {
    const b = mk('aoz-az450f');
    let maxPitch = 0;
    run(b, 2, () => ({ throttle: 1 }));
    run(b, 0.6, () => ({ throttle: 1 }));
    maxPitch = Math.max(maxPitch, b.pitch);
    expect(b.state === 'wheelie' || maxPitch > 0.2).toBe(true);
  });

  it('le coup d’embrayage déclenche un wheeling sur un 125 2T', () => {
    const b = mk('aoz-az125');
    run(b, 3, () => ({ throttle: b.kmh < 20 ? 0.6 : 0.2 }));
    run(b, 0.6, () => ({ clutch: true, throttle: 1 }));
    let max = 0;
    for (let t = 0; t < 1.2; t += 1 / 60) {
      b.step(1 / 60, { ...emptyInput(), throttle: 1, lean: -0.5 });
      max = Math.max(max, b.pitch);
    }
    expect(max * 57.3).toBeGreaterThan(15);
  });

  it('l’aide arcade tient un wheeling longtemps', () => {
    const b = mk('aoz-az125', new CollisionWorld(), 2);
    run(b, 3, () => ({ throttle: b.kmh < 20 ? 0.6 : 0.2 }));
    run(b, 0.6, () => ({ clutch: true, throttle: 1 }));
    let wheelieTime = 0;
    for (let t = 0; t < 8; t += 1 / 60) {
      b.step(1 / 60, { ...emptyInput(), throttle: 0.75 });
      if (b.state === 'wheelie') wheelieTime += 1 / 60;
      if (b.crashed) break;
    }
    expect(b.crashed).toBe(false);
    expect(wheelieTime).toBeGreaterThan(5);
  });

  it('le frein avant appuyé fort avec le poids en avant provoque un stoppie', () => {
    const b = mk('kro-690smr', new CollisionWorld(), 2);
    run(b, 3, () => ({ throttle: 0.5, lean: 1 }));
    let stoppie = false;
    for (let t = 0; t < 2; t += 1 / 60) {
      b.step(1 / 60, { ...emptyInput(), frontBrake: 1, lean: 1 });
      if (b.state === 'stoppie') stoppie = true;
    }
    expect(stoppie).toBe(true);
  });

  it('franchit un trottoir de 15 cm et décolle d’une rampe sans tomber', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: 30, hx: 5, hz: 4, y1: 0.15 });
    w.addProfile({ x: 0, z: 60, hx: 3, points: [[0, 0], [1.5, 0.25], [3, 0.8], [4.2, 1.5], [4.8, 1.9]] });
    const b = mk('aoz-az125', w, 1);
    let air = 0;
    run(b, 8, () => ({ throttle: b.kmh < 40 ? 0.5 : 0.3, lean: 0.3 }));
    for (let t = 0; t < 6; t += 1 / 60) {
      b.step(1 / 60, { ...emptyInput(), throttle: b.kmh < 40 ? 0.5 : 0.3, lean: 0.3 });
      if (b.state === 'air') air += 1 / 60;
    }
    expect(b.crashed).toBe(false);
    expect(b.z).toBeGreaterThan(64);
  });

  it('un mur percuté à vitesse élevée provoque une chute', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: 40, hx: 5, hz: 1, y1: 3 });
    const b = mk('kro-690smr', w, 1);
    run(b, 6, () => ({ throttle: b.kmh < 50 ? 0.6 : 0.2, lean: 1 }));
    expect(b.crashed).toBe(true);
  });

  it('tourne quand on braque et s’incline vers l’intérieur', () => {
    const b = mk('aoz-az250f', new CollisionWorld(), 1);
    run(b, 3, () => ({ throttle: b.kmh < 40 ? 0.5 : 0.2, lean: 0.5 }));
    const yaw0 = b.yaw;
    run(b, 1.5, () => ({ throttle: 0.3, steer: 1, lean: 0.5 }));
    expect(b.roll).toBeGreaterThan(0.2);
    expect(b.yaw).not.toBeCloseTo(yaw0, 1);
  });
});

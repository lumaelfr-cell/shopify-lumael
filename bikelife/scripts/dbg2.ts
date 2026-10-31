import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';
const spec = BIKE_BY_ID[process.argv[2] ?? 'kro-690smr'];
const world = new CollisionWorld();
world.addProfile({ x: 0, z: 40, hx: 3, points: [[0, 0], [1.5, 0.25], [3, 0.8], [4.2, 1.5], [4.8, 1.9]], surf: 'wood' });
const bike = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), world);
bike.reset(0, 30, 0);
const gh = { h: 0, surf: 'asphalt' as any, id: -1 };
for (let i = 0; i < 200; i++) {
  const inp = emptyInput(); inp.throttle = bike.kmh < 55 ? 0.55 : 0.2; inp.lean = 0;
  bike.step(1 / 60, inp);
  if (bike.z > 38 || bike.crashed) {
    const fz = bike.front.cz, rz = bike.rear.cz;
    console.log(i, 'z', bike.z.toFixed(2), 'y', bike.y.toFixed(2), 'p', (bike.pitch*57.3).toFixed(1), 'v', bike.kmh.toFixed(0), 'vy', bike.vy.toFixed(2), 'F', bike.front.contact ? 'c' : '-', bike.front.comp.toFixed(3), 'cz', fz.toFixed(2), 'cy', bike.front.cy.toFixed(2), 'R', bike.rear.contact ? 'c' : '-', bike.rear.comp.toFixed(3), 'cz', rz.toFixed(2), 'cy', bike.rear.cy.toFixed(2), bike.crashed ? bike.crashReason : '');
    if (bike.crashed || bike.z > 52) break;
  }
}

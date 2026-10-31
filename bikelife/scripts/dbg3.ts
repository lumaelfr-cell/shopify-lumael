import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';
const spec = BIKE_BY_ID[process.argv[2]];
const scen = process.argv[3];
const world = new CollisionWorld();
if (scen === 'ramp') world.addProfile({ x: 0, z: 40, hx: 3, points: [[0, 0], [1.5, 0.25], [3, 0.8], [4.2, 1.5], [4.8, 1.9]], surf: 'wood' });
if (scen === 'curb') world.addBox({ x: 0, z: 30, hx: 5, hz: 4, y1: 0.15, surf: 'concrete' });
const bike = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), world);
bike.reset(0, 0, 0);
const z0 = Number(process.argv[4] ?? 25);
for (let i = 0; i < 900; i++) {
  const inp = emptyInput(); inp.throttle = bike.kmh < 40 ? 1 : 0.35;
  bike.step(1 / 60, inp);
  if (bike.z > z0 || bike.crashed) {
    console.log(i, 'z', bike.z.toFixed(2), 'y', bike.y.toFixed(2), 'p', (bike.pitch*57.3).toFixed(1), 'w', bike.pitchVel.toFixed(2), 'v', bike.kmh.toFixed(0), 'vy', bike.vy.toFixed(2), 'F', bike.front.contact ? 'c' : '-', bike.front.comp.toFixed(3), 'cz', bike.front.cz.toFixed(2), 'cy', bike.front.cy.toFixed(2), 'R', bike.rear.contact ? 'c' : '-', bike.rear.comp.toFixed(3), 'cz', bike.rear.cz.toFixed(2), 'cy', bike.rear.cy.toFixed(2), bike.crashed ? bike.crashReason : '');
    if (bike.crashed || bike.z > z0 + 14) break;
  }
}

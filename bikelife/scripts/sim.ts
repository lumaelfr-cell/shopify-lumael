// Banc d'essai physique en ligne de commande :
//   npx tsx scripts/sim.ts <bikeId> <scénario> [assist 0|1|2]
import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';

const id = process.argv[2] ?? 'aoz-az125';
const scen = process.argv[3] ?? 'launch';
const assist = Number(process.argv[4] ?? 1) as 0 | 1 | 2;
const spec = BIKE_BY_ID[id];
const world = new CollisionWorld();
if (scen === 'ramp') world.addProfile({ x: 0, z: 40, hx: 3, points: [[0, 0], [1.5, 0.25], [3, 0.8], [4.2, 1.5], [4.8, 1.9]], surf: 'wood' });
if (scen === 'curb') world.addBox({ x: 0, z: 30, hx: 5, hz: 4, y1: 0.15, surf: 'concrete' });
if (scen === 'wall') world.addBox({ x: 0, z: 40, hx: 5, hz: 1, y1: 3 });
const bike = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), world);
bike.assist = assist;
bike.reset(0, 0, 0);
const dt = 1 / 60;
let t = 0;
const hist: number[] = [];
const bal = () => bike.balanceAngle * 57.3;
const deg = () => bike.pitch * 57.3;
const log = (tag = '') =>
  console.log(`${t.toFixed(2)}s v=${bike.kmh.toFixed(1)} rpm=${bike.rpm.toFixed(0)} g=${bike.engine.gear} pitch=${deg().toFixed(1)} st=${bike.state} y=${bike.y.toFixed(2)} z=${bike.z.toFixed(1)} cf=${bike.front.comp.toFixed(3)} cr=${bike.rear.comp.toFixed(3)} sR=${bike.rear.slipping ? 1 : 0} ${bike.crashed ? 'CRASH ' + bike.crashReason : ''} ${tag}`);
for (let i = 0; i < 60 * 14; i++) {
  const inp = emptyInput();
  hist.push(deg());
  const seen = hist.length > 7 ? hist[hist.length - 8] : 0;
  const prevSeen = hist.length > 9 ? hist[hist.length - 10] : seen;
  switch (scen) {
    case 'launch': inp.throttle = 1; break;
    case 'brake': if (t < 5) inp.throttle = 1; else inp.frontBrake = 1; break;
    case 'rbrake': if (t < 5) inp.throttle = 1; else inp.rearBrake = 1; break;
    case 'stoppie': if (t < 4) inp.throttle = 1; else { inp.frontBrake = 1; inp.lean = 1; } break;
    case 'ramp': case 'curb': case 'wall': inp.throttle = bike.kmh < 40 ? 1 : 0.35; break;
    case 'turn': inp.throttle = bike.kmh < 50 ? 0.8 : 0.3; if (t > 4) inp.steer = 1; break;
    case 'drift': inp.throttle = bike.kmh < 45 ? 1 : 0.5; if (t > 4) { inp.steer = 1; inp.rearBrake = t < 4.6 ? 1 : 0; } break;
    case 'hold': {
      // pilote "humain" : retard de réaction 120 ms
      if (t < 3) inp.throttle = bike.kmh < 25 ? 0.7 : 0.25;
      else if (t < 3.5 && bike.spec.gears) { inp.clutch = true; inp.throttle = 1; }
      else if (t < 4.2 && !bike.spec.gears) { inp.clutch = true; inp.throttle = 1; inp.lean = -1; }
      else {
        const err = bal() - 10 - seen;
        const rate = (seen - prevSeen) * 30;
        const u = err * 0.06 - rate * 0.012;
        inp.throttle = bike.state === 'wheelie' ? Math.max(0, Math.min(1, 0.45 + u)) : 1;
        inp.rearBrake = u < -0.35 ? Math.min(1, -u - 0.35) : 0;
      }
      break;
    }
    case 'spull': {
      if (t < 4) inp.throttle = bike.kmh < 22 ? 1 : 0.3;
      else {
        inp.throttle = 1;
        inp.clutch = deg() < bal() - 12;
        inp.lean = bike.state === 'wheelie' && deg() > bal() - 6 ? 0.6 : -0.5;
        inp.rearBrake = deg() > bal() + 2 ? 0.6 : 0;
      }
      break;
    }
  }
  bike.step(dt, inp);
  t += dt;
  if (i % 15 === 0) log(scen === 'turn' || scen === 'drift' ? `yaw=${(bike.yaw * 57.3).toFixed(0)} roll=${(bike.roll * 57.3).toFixed(1)} slip=${(bike.slipAngle * 57.3).toFixed(1)}` : '');
  if (bike.crashed) { log(); break; }
}

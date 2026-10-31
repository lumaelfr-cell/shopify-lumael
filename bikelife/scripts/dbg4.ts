import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';
const spec = BIKE_BY_ID[process.argv[2] ?? 'fia-fx50'];
const b = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), new CollisionWorld());
b.assist = 2; b.reset(0, 0, 0);
for (let i = 0; i < 360; i++) {
  b.step(1 / 60, { ...emptyInput(), throttle: Number(process.argv[3] ?? 0.6), lean: 0.6 });
  if (i % 30 === 0) console.log((i / 60).toFixed(1), b.kmh.toFixed(1), 'rpm', b.rpm.toFixed(0), 'eng', b.engine.engagement.toFixed(2), 'tC', b.engine.clutchTorque.toFixed(2), 'thr', b.engine.throttleEff.toFixed(2), 'Fr', b.rear.longF.toFixed(0), 'Ff', b.front.longF.toFixed(0), b.state, (b.pitch*57.3).toFixed(1), 'gear', b.engine.gear);
}

import { CollisionWorld } from '../src/physics/collision';
import { BikePhysics, emptyInput } from '../src/physics/bikePhysics';
import { BIKE_BY_ID } from '../src/data/bikes';
import { defaultConfig, tuningFromConfig } from '../src/data/parts';
const spec = BIKE_BY_ID[process.argv[2] ?? 'aoz-aerix50'];
const world = new CollisionWorld();
const bike = new BikePhysics(spec, tuningFromConfig(spec, defaultConfig(spec)), world);
bike.reset(0, 0, 0);
for (let i = 0; i < 600; i++) {
  const inp = emptyInput(); inp.throttle = 1;
  bike.step(1 / 60, inp);
  if (i % 30 === 0) console.log((i/60).toFixed(1), bike.kmh.toFixed(1), 'rpm', bike.rpm.toFixed(0), 'ratio', bike.engine.ratio.toFixed(2), 'eng', bike.engine.engagement.toFixed(2), 'tC', bike.engine.clutchTorque.toFixed(2), 'thrEff', bike.engine.throttleEff.toFixed(2), 'Fr', bike.rear.longF.toFixed(0), 'Nr', bike.rear.load.toFixed(0), 'slip', bike.rear.slipping, 'Ff', bike.front.longF.toFixed(0));
}

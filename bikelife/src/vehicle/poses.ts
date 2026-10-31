// Poses du corps hors moto (repère local du personnage : +z avant, +x gauche,
// y = hauteur au-dessus du sol). Utilisées par le joueur à pied et les PNJ.

import * as THREE from 'three';
import type { BodyTargets } from './rider';
import { clamp } from '../core/math';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const ELBOW_L = V(0.35, -0.25, -1);
const ELBOW_R = V(-0.35, -0.25, -1);

/** Debout, au repos (respiration, léger transfert de poids). */
export function idlePose(t: number, o: { lookYaw?: number; handsOn?: number | null; gesture?: number } = {}): BodyTargets {
  const breath = Math.sin(t * 1.7) * 0.006;
  const sway = Math.sin(t * 0.37) * 0.015;
  const b: BodyTargets = {
    pelvis: V(sway, 0.925 + breath, 0),
    torsoTilt: 0.03 + breath,
    side: sway * 0.4,
    footL: V(0.12, 0.075, 0.03),
    footR: V(-0.11, 0.075, -0.02),
    handL: V(0.245, 0.84 + breath, 0.03),
    handR: V(-0.245, 0.84 + breath, 0.03),
    reach: false,
    headYaw: o.lookYaw ?? 0,
    firstPerson: false,
    elbowPoleL: ELBOW_L,
    elbowPoleR: ELBOW_R,
    kneePole: V(0, 0.1, 1),
    footFlatL: 1,
    footFlatR: 1,
  };
  if (o.handsOn != null) {
    // mains posées sur un comptoir devant soi
    b.handL.set(0.2, o.handsOn + 0.03, 0.36);
    b.handR.set(-0.2, o.handsOn + 0.03, 0.36);
    b.torsoTilt = 0.1;
    b.elbowPoleL = V(0.8, -0.3, -0.2);
    b.elbowPoleR = V(-0.8, -0.3, -0.2);
  }
  if (o.gesture) {
    // discussion : la main droite accompagne la parole
    const g = o.gesture;
    b.handR.set(-0.22 + Math.sin(t * 2.3) * 0.05 * g, 1.0 + Math.sin(t * 3.1) * 0.06 * g, 0.25 * g + 0.03);
    b.elbowPoleR = V(-0.6, -0.6, -0.4);
  }
  return b;
}

/** Marche / course : `phase` en radians, `speed` en m/s, `air` 0..1 (saut). */
export function walkPose(phase: number, speed: number, air = 0): BodyTargets {
  const s = clamp(speed, 0, 7);
  const run = clamp((s - 2.4) / 2.5, 0, 1);
  const A = clamp(0.1 + s * 0.12, 0.1, 0.5);
  const lift = 0.06 + s * 0.035;
  const sp = Math.sin(phase), cp = Math.cos(phase);
  const bob = Math.abs(cp) * (0.018 + run * 0.03);
  const pel = V(0, 0.905 - run * 0.05 + bob - air * 0.08, 0.02 + run * 0.06);
  const fy = (c: number) => 0.075 + lift * Math.max(0, c);
  const footL = V(0.11, fy(cp), A * sp + run * 0.05);
  const footR = V(-0.11, fy(-cp), -A * sp + run * 0.05);
  // bras opposés aux jambes ; coudes pliés en course
  const armA = A * (0.75 + run * 0.2);
  const hy = 0.86 + run * 0.18;
  const handL = V(0.23 - run * 0.03, hy + Math.max(0, -sp) * run * 0.12, -armA * sp + run * 0.12);
  const handR = V(-0.23 + run * 0.03, hy + Math.max(0, sp) * run * 0.12, armA * sp + run * 0.12);
  const b: BodyTargets = {
    pelvis: pel,
    torsoTilt: 0.05 + run * 0.22,
    side: 0,
    twist: -0.12 * sp * clamp(s / 2, 0, 1),
    footL, footR, handL, handR,
    reach: false,
    firstPerson: false,
    elbowPoleL: run > 0.2 ? V(0.3, -0.6, -1) : ELBOW_L,
    elbowPoleR: run > 0.2 ? V(-0.3, -0.6, -1) : ELBOW_R,
    kneePole: V(0, 0.2, 1),
    footFlatL: cp < 0 ? 1 : 0.4,
    footFlatR: cp > 0 ? 1 : 0.4,
  };
  if (air > 0) {
    // saut : genoux remontés, bras écartés
    b.footL.lerp(V(0.12, 0.35, 0.12), air);
    b.footR.lerp(V(-0.12, 0.3, -0.05), air);
    b.handL.lerp(V(0.36, 1.15, 0.1), air);
    b.handR.lerp(V(-0.36, 1.15, 0.1), air);
  }
  return b;
}

/** Assis (canapé, chaise, banc) : `seatH` = hauteur d'assise. */
export function sitPose(seatH: number, t: number, lookYaw = 0): BodyTargets {
  const breath = Math.sin(t * 1.5) * 0.005;
  return {
    pelvis: V(0, seatH + 0.11, -0.04),
    torsoTilt: -0.12 + breath,
    side: 0,
    footL: V(0.13, 0.075, 0.5),
    footR: V(-0.13, 0.075, 0.47),
    handL: V(0.17, seatH + 0.2, 0.3),
    handR: V(-0.17, seatH + 0.2, 0.3),
    reach: false,
    headYaw: lookYaw,
    firstPerson: false,
    elbowPoleL: V(0.6, -0.2, -0.6),
    elbowPoleR: V(-0.6, -0.2, -0.6),
    kneePole: V(0, 1, 0.4),
    footFlatL: 1,
    footFlatR: 1,
  };
}

/** Allongé (lit) : le personnage est tourné de 90° par l'appelant. */
export function lyingPose(t: number, bedH: number): BodyTargets {
  const b = sitPose(0.0, t);
  b.pelvis.set(0, bedH + 0.12, 0);
  b.torsoTilt = -1.45;
  b.footL.set(0.12, bedH + 0.1, 0.85);
  b.footR.set(-0.12, bedH + 0.1, 0.83);
  b.kneePole = V(0, 1, 0.1);
  b.handL.set(0.3, bedH + 0.15, -0.1);
  b.handR.set(-0.3, bedH + 0.15, -0.1);
  return b;
}

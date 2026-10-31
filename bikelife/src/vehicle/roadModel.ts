// Routières : sportive carénée (4 cylindres, cadre alu périmétrique, bracelets,
// commandes reculées) et roadster (bicylindre ou monocylindre, cadre tubulaire,
// guidon large, écopes de réservoir). Même repère que les autres motos :
// origine au sol sous l'axe arrière, +Z vers l'avant, +X = gauche du pilote.

import * as THREE from 'three';
import type { BikeSpec } from '../data/bikes';
import type { BikeConfig } from '../data/parts';
import { DEG } from '../core/math';
import { Mats, decalTexture, licenseTexture, seatTexture } from './materials';
import { cylBetween, merge, mergeStatic, mesh, roundedBox, sidePanel, tube, varTube, V3 } from './geom';
import { buildWheel, discGeometry, exhaustMat, springGeometry, type BikeVisual } from './bikeModel';

const P = (z: number, y: number): [number, number] => [z, y];

export function buildRoad(spec: BikeSpec, cfg: BikeConfig): BikeVisual {
  const root = new THREE.Group();
  root.name = 'road';
  const sport = spec.roadStyle !== 'naked';
  const small = spec.cc < 200;
  const L = spec.wheelbase;
  const rF = spec.rFront, rR = spec.rRear;
  const rake = spec.rake * DEG;
  const seatTop = spec.seatHeight;
  // hauteurs relatives à la selle réelle (dessin de référence : selle 0,82 m)
  const k = seatTop / 0.82;
  const Yk = (y: number) => y * k;
  const zs = L / 1.4;
  const Z = (z: number) => z * zs;

  const paint = Mats.paint(cfg.primary, 0.25);
  const paint2 = Mats.paint(cfg.secondary, 0.28);
  const dark = Mats.plastic('#16171a', 0.55);
  const frameMat = Mats.metal(sport ? '#2a2c30' : cfg.frame, 0.35, sport ? 0.7 : 0.6);
  const engMat = Mats.engine('#2c2e33');
  const alu = Mats.metal('#b9bfc6', 0.3, 1);
  const decalTex = decalTexture(cfg.decal === 'factory' ? 'split' : cfg.decal, cfg.primary, cfg.secondary, cfg.accent, spec.brand, cfg.plateNumber);
  const decalMat = Mats.textured(`rdec:${decalTex.uuid}`, decalTex, { roughness: 0.28, clearcoat: 1 });

  const chassis = new THREE.Group();
  root.add(chassis);
  // --- points clés
  const headZ = L - (Yk(0.74) - rF) * Math.tan(rake) - 0.03;
  const headTop: V3 = [0, Yk(0.86), headZ - 0.04];
  const headLow: V3 = [0, Yk(0.62), headZ + 0.06];
  const pivotZ = Z(0.56), pivotY = Yk(0.43);

  // --- cadre
  if (sport || !small) {
    for (const sd of [-1, 1]) {
      if (sport) {
        // cadre alu périmétrique : longerons plats contournant le moteur
        const up = [P(headZ, Yk(0.84)), P(Z(1.0), Yk(0.8)), P(Z(0.78), Yk(0.66)), P(pivotZ + 0.04, pivotY + 0.08)];
        const dn = [P(pivotZ + 0.02, pivotY - 0.06), P(Z(0.76), Yk(0.52)), P(Z(1.0), Yk(0.66)), P(headZ + 0.04, Yk(0.68))];
        const spar = sidePanel([...up, ...dn], 0.04, 0, 0.01);
        spar.translate(sd * 0.15, 0, 0);
        mesh(spar, frameMat, chassis);
      } else {
        // treillis / poutre acier du roadster
        mesh(varTube([[0.03 * sd, Yk(0.84), headZ - 0.02], [sd * 0.09, Yk(0.8), Z(1.02)], [sd * 0.12, Yk(0.7), Z(0.8)], [sd * 0.11, pivotY + 0.05, pivotZ + 0.04]], () => 0.022, 16, 8), frameMat, chassis);
        mesh(tube([[0.03 * sd, Yk(0.66), headZ + 0.03], [sd * 0.08, Yk(0.48), Z(1.06)], [sd * 0.1, Yk(0.32), Z(0.92)]], 0.016, 12, 6), frameMat, chassis);
      }
      // boucle arrière
      mesh(tube([[sd * 0.1, Yk(0.7), Z(0.6)], [sd * 0.085, seatTop - 0.06, Z(0.2)], [sd * 0.06, seatTop - 0.02, Z(-0.12)]], 0.012, 12, 6), frameMat, chassis);
    }
  } else {
    // 125 : cadre périmétrique acier fin
    for (const sd of [-1, 1]) mesh(varTube([[0.03 * sd, Yk(0.84), headZ - 0.02], [sd * 0.1, Yk(0.78), Z(1.0)], [sd * 0.12, Yk(0.62), Z(0.78)], [sd * 0.1, pivotY + 0.04, pivotZ + 0.04]], () => 0.02, 16, 8), frameMat, chassis);
  }
  mesh(cylBetween(headLow, headTop, 0.032, 0.032, 14), frameMat, chassis);

  // --- moteur : 4 cylindres en ligne (large), bicylindre, ou mono
  const cyl = sport && !small ? 4 : small ? 1 : 2;
  const eng = new THREE.Group();
  chassis.add(eng);
  const width = cyl === 4 ? 0.44 : cyl === 2 ? 0.34 : 0.22;
  const crank = roundedBox(width, Yk(0.2), Z(0.36), 0.05);
  crank.translate(0, Yk(0.36), Z(0.74));
  mesh(crank, engMat, eng);
  const tilt = cyl === 4 ? 0.55 : 0.7;
  const block = roundedBox(width * 0.9, Yk(0.2), 0.16, 0.03);
  block.rotateX(tilt);
  block.translate(0, Yk(0.52), Z(0.86));
  mesh(block, Mats.metal('#45484e', 0.4, 0.8), eng);
  const head = roundedBox(width * 0.92, 0.08, 0.15, 0.03);
  head.rotateX(tilt);
  head.translate(0, Yk(0.62), Z(0.94));
  mesh(head, Mats.metal(sport ? '#2a2b2f' : '#5a5e65', 0.35, 0.8), eng);
  for (const sd of [-1, 1]) {
    const cov = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 22).rotateZ(Math.PI / 2).translate(sd * (width / 2 + 0.01), Yk(0.33), Z(0.78));
    mesh(cov, Mats.metal('#3a3d42', 0.35, 0.9), eng);
  }
  // radiateur
  const rad = roundedBox(sport ? 0.42 : 0.34, Yk(0.26), 0.05, 0.02);
  rad.rotateX(-0.2);
  rad.translate(0, Yk(0.56), Z(1.1));
  mesh(rad, Mats.metal('#2f3236', 0.5, 0.7), chassis);

  // --- échappement : collecteurs sous le moteur → silencieux court à droite
  const exMat = exhaustMat(cfg);
  const pipeMat = Mats.metal('#8a8178', 0.35, 1);
  for (let i = 0; i < cyl; i++) {
    const x = (i - (cyl - 1) / 2) * (width / cyl) * 0.9;
    mesh(tube([[x, Yk(0.6), Z(1.02)], [x * 0.9, Yk(0.42), Z(1.1)], [x * 0.6, Yk(0.2), Z(1.0)], [x * 0.3, Yk(0.16), Z(0.8)]], 0.017, 16, 8), pipeMat, chassis);
  }
  const box = roundedBox(0.24, 0.12, 0.3, 0.04);
  box.translate(0, Yk(0.17), Z(0.66));
  mesh(box, Mats.metal('#3a3b3e', 0.4, 0.8), chassis);
  const silA = new THREE.Vector3(-0.12, Yk(0.2), Z(0.5));
  const silB = new THREE.Vector3(-0.17, Yk(0.3), Z(0.22));
  mesh(cylBetween([silA.x, silA.y, silA.z], [silB.x, silB.y, silB.z], 0.055, 0.06, 16), exMat, chassis);
  mesh(cylBetween([silB.x, silB.y, silB.z], [silB.x - 0.005, silB.y + 0.01, silB.z - 0.03], 0.058, 0.04, 16), Mats.metal('#222', 0.4, 1), chassis);
  const exhaustTip = silB.clone();

  // --- réservoir, selle, coque arrière
  const tankTop = seatTop + Yk(0.13);
  mesh(sidePanel([P(Z(0.62), seatTop + 0.02), P(Z(0.7), tankTop), P(Z(0.92), tankTop + 0.02), P(headZ - 0.06, tankTop - 0.06), P(headZ - 0.04, Yk(0.76)), P(Z(0.68), Yk(0.74))], sport ? 0.34 : 0.32, 0, 0.06, 4, true), paint, chassis);
  const seatTex = seatTexture(cfg.seatColor, cfg.seat);
  const seatMat = Mats.textured(`rseat:${seatTex.uuid}`, seatTex, { roughness: 0.75, clearcoat: 0 });
  mesh(sidePanel([P(Z(0.64), seatTop + 0.0), P(Z(0.4), seatTop - 0.01), P(Z(0.18), seatTop + (sport ? 0.05 : 0.02)), P(Z(0.0), seatTop + (sport ? 0.09 : 0.04)), P(Z(0.0), seatTop - 0.04), P(Z(0.62), seatTop - 0.06)], 0.27, 0, 0.04, 3, true), seatMat, chassis);
  const tailEnd = sport ? Z(-0.32) : Z(-0.18);
  mesh(sidePanel([P(Z(0.3), seatTop - 0.05), P(Z(0.02), seatTop + (sport ? 0.1 : 0.05)), P(tailEnd, seatTop + (sport ? 0.16 : 0.08)), P(tailEnd + 0.04, seatTop + (sport ? 0.1 : 0.02)), P(Z(0.0), seatTop - 0.12), P(Z(0.3), seatTop - 0.16)], sport ? 0.2 : 0.24, 0, 0.04, 3, true), [decalMat, paint], chassis);
  // feu arrière + support de plaque
  const taillightMat = Mats.emissive('#ff2a1a', 1.2).clone();
  const tl = new THREE.Mesh(new THREE.BoxGeometry(sport ? 0.1 : 0.14, 0.03, 0.03).translate(0, seatTop + (sport ? 0.12 : 0.04), tailEnd + 0.01), taillightMat);
  tl.userData.keep = true;
  chassis.add(tl);
  mesh(tube([[0, seatTop - 0.04, tailEnd + 0.05], [0, seatTop - 0.16, tailEnd - 0.05], [0, rR + 0.18, tailEnd - 0.12]], 0.02, 8, 6), dark, chassis);
  const lic = new THREE.PlaneGeometry(0.17, 0.12);
  lic.rotateY(Math.PI);
  lic.rotateX(0.2);
  lic.translate(0, rR + 0.2, tailEnd - 0.13);
  const licTex = licenseTexture(cfg.plateNumber.padStart(3, '0') + '-RT');
  mesh(lic, Mats.textured(`rlic:${licTex.uuid}`, licTex, { roughness: 0.5, clearcoat: 0 }), chassis);
  for (const sd of [-1, 1]) {
    // clignotants arrière
    mesh(cylBetween([sd * 0.06, rR + 0.3, tailEnd - 0.05], [sd * 0.12, rR + 0.3, tailEnd - 0.07], 0.012, 0.016, 8), Mats.emissive('#ff9a1a', 0.2), chassis);
  }

  // --- carénage (sportive) ou écopes (roadster)
  if (sport) {
    for (const sd of [-1, 1]) {
      const side = sidePanel([P(Z(0.66), Yk(0.74)), P(headZ, Yk(0.86)), P(headZ + 0.16, Yk(0.8)), P(headZ + 0.12, Yk(0.44)), P(Z(0.92), Yk(0.24)), P(Z(0.6), Yk(0.28)), P(Z(0.62), Yk(0.5))], 0.02, 0, 0.006);
      side.translate(sd * 0.21, 0, 0);
      mesh(side, decalMat, chassis);
    }
    const belly = roundedBox(0.36, 0.1, Z(0.42), 0.04);
    belly.translate(0, Yk(0.2), Z(0.8));
    mesh(belly, paint, chassis);
  } else {
    for (const sd of [-1, 1]) {
      const scoop = sidePanel([P(Z(0.78), Yk(0.94)), P(headZ - 0.02, Yk(0.92)), P(headZ + 0.06, Yk(0.76)), P(Z(0.98), Yk(0.62)), P(Z(0.8), Yk(0.72))], 0.02, 0, 0.005);
      scoop.translate(sd * 0.19, 0, 0);
      mesh(scoop, decalMat, chassis);
    }
  }

  // repose-pieds (reculés sur la sportive)
  const pegY = sport ? Yk(0.42) : Yk(0.36), pegZ = sport ? Z(0.44) : Z(0.5);
  for (const sd of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.1, 0.022, 0.04).translate(sd * 0.21, pegY, pegZ), alu, chassis);
    mesh(new THREE.BoxGeometry(0.02, 0.12, 0.1).translate(sd * 0.17, pegY + 0.04, pegZ - 0.02), alu, chassis);
  }

  // --- direction
  const axle = new THREE.Vector3(0, rF, L);
  const steerPivot = new THREE.Object3D();
  steerPivot.position.copy(axle);
  steerPivot.rotation.x = -rake;
  root.add(steerPivot);
  const steer = new THREE.Object3D();
  steerPivot.add(steer);
  const forkLen = (Yk(0.88) - rF) / Math.cos(rake);
  const topY = forkLen, lowY = forkLen - 0.13;
  mesh(roundedBox(0.26, 0.03, 0.09, 0.012).translate(0, topY, -0.03), alu, steer);
  mesh(roundedBox(0.27, 0.05, 0.09, 0.015).translate(0, lowY, -0.025), alu, steer);
  const outer = Mats.metal(sport ? '#c9a227' : '#1f2125', 0.25, 1);
  for (const sd of [-1, 1]) mesh(cylBetween([sd * 0.1, topY + 0.02, -0.03], [sd * 0.1, forkLen * 0.45, -0.03], 0.03, 0.032, 14), outer, steer);
  // guidon : bracelets (sportive) ou cintre large (roadster)
  let gy: number, gx: number, gz: number;
  if (sport) {
    gy = topY - 0.04;
    gx = 0.33;
    gz = -0.05;
    for (const sd of [-1, 1]) mesh(cylBetween([sd * 0.12, gy + 0.02, -0.04], [sd * (gx + 0.06), gy - 0.01, gz - 0.04], 0.012, 0.012, 8), alu, steer);
  } else {
    gy = topY + 0.11;
    gx = 0.36;
    gz = -0.14;
    mesh(tube([[-gx - 0.05, gy, gz], [-0.12, gy - 0.02, -0.1], [0, gy - 0.07, -0.04], [0.12, gy - 0.02, -0.1], [gx + 0.05, gy, gz]], 0.014, 20, 8), Mats.metal(cfg.barColor, 0.3, 0.9), steer);
  }
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * (gx - 0.06), gy, gz], [sd * (gx + 0.06), gy, gz - 0.01], 0.017, 0.017, 10), cfg.gripColor && cfg.gripColor !== '#1a1a1a' ? Mats.plastic(cfg.gripColor, 0.85) : Mats.rubber(), steer);
    mesh(tube([[sd * (gx - 0.08), gy + 0.01, gz + 0.03], [sd * (gx + 0.02), gy + 0.02, gz + 0.09]], 0.006, 4, 5), Mats.metal('#2d2f33', 0.3, 0.9), steer);
  }
  const gripL = new THREE.Object3D();
  gripL.position.set(gx, gy, gz);
  steer.add(gripL);
  const gripR = new THREE.Object3D();
  gripR.position.set(-gx, gy, gz);
  steer.add(gripR);
  // optique
  const headlightMat = Mats.emissive('#eef6ff', 0.25).clone();
  const lightParts: THREE.BufferGeometry[] = [];
  let headlight: THREE.Object3D;
  if (sport) {
    // tête de fourche fixe au cadre : nez, deux feux LED aux coins, prise d'air centrale, bulle
    const nose = sidePanel([P(headZ - 0.02, Yk(0.98)), P(headZ + 0.18, Yk(0.86)), P(L + 0.08, Yk(0.7)), P(L + 0.04, Yk(0.6)), P(headZ + 0.1, Yk(0.62)), P(headZ - 0.04, Yk(0.78))], 0.36, 0, 0.08, 4, true);
    mesh(nose, [decalMat, paint], chassis);
    mesh(roundedBox(0.09, 0.07, 0.06, 0.02).translate(0, Yk(0.64), L + 0.06), dark, chassis);
    for (const sd of [-1, 1]) lightParts.push(new THREE.BoxGeometry(0.09, 0.025, 0.03).rotateZ(sd * 0.25).translate(sd * 0.11, Yk(0.71), L + 0.03));
    const scr = new THREE.PlaneGeometry(0.3, 0.2);
    scr.rotateX(-0.95);
    scr.translate(0, Yk(0.99), headZ + 0.05);
    mesh(scr, Mats.glass('#1a2430', 0.6), chassis);
    const hl = new THREE.Mesh(merge(lightParts), headlightMat);
    hl.userData.keep = true;
    chassis.add(hl);
    headlight = new THREE.Object3D();
    headlight.position.set(0, Yk(0.7), L + 0.1);
    root.add(headlight);
    for (const sd of [-1, 1]) {
      mesh(tube([[sd * 0.2, Yk(0.86), headZ + 0.1], [sd * 0.3, Yk(0.92), headZ + 0.06]], 0.008, 4, 5), dark, chassis);
      mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.4, 0.7, 0.4).translate(sd * 0.33, Yk(0.93), headZ + 0.05), dark, chassis);
    }
  } else {
    // phare compact sur la fourche, deux feux de position au-dessus
    const shell = roundedBox(0.22, 0.13, 0.12, 0.04);
    shell.translate(0, lowY - 0.08, 0.1);
    mesh(shell, dark, steer);
    lightParts.push(new THREE.BoxGeometry(0.1, 0.05, 0.02).translate(0, lowY - 0.1, 0.165));
    for (const sd of [-1, 1]) lightParts.push(new THREE.BoxGeometry(0.06, 0.012, 0.02).rotateZ(sd * 0.3).translate(sd * 0.07, lowY - 0.04, 0.165));
    const hl = new THREE.Mesh(merge(lightParts), headlightMat);
    hl.userData.keep = true;
    steer.add(hl);
    headlight = new THREE.Object3D();
    headlight.position.set(0, lowY - 0.1, 0.2);
    steer.add(headlight);
    for (const sd of [-1, 1]) {
      mesh(tube([[sd * 0.2, gy + 0.01, gz + 0.04], [sd * 0.25, gy + 0.14, gz + 0.06], [sd * 0.29, gy + 0.22, gz + 0.04]], 0.006, 6, 5), dark, steer);
      mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.8, 0.3).translate(sd * 0.3, gy + 0.24, gz + 0.04), dark, steer);
    }
  }
  // garde-boue avant
  const ff = roundedBox(0.14, 0.03, 0.42, 0.012);
  ff.rotateX(0.18);
  ff.translate(0, rF + 0.06, 0.02);
  // fourche : coulisse
  const forkSlider = new THREE.Object3D();
  steer.add(forkSlider);
  mesh(ff, paint, forkSlider);
  for (const sd of [-1, 1]) {
    mesh(cylBetween([sd * 0.1, forkLen * 0.5, -0.03], [sd * 0.1, 0.04, -0.03], 0.024, 0.024, 12), Mats.metal('#2a2b2e', 0.25, 1), forkSlider);
    // étriers radiaux sur les deux disques
    mesh(roundedBox(0.04, 0.1, 0.06, 0.01).translate(sd * 0.085, 0.16, -0.12), Mats.metal(sport ? '#2a2b2e' : '#3a3d42', 0.4, 0.8), forkSlider);
  }
  const frontWheel = buildWheel({ r: rF, rimInch: spec.rimFront, width: spec.tireWF, tire: cfg.tire, rimStyle: 'cast', rimColor: cfg.rimColor, disc: { r: small ? 0.14 : 0.16, side: 1 }, spokes: 0, hubColor: cfg.hubColor });
  if (!small) {
    // double disque avant
    const d2 = discGeometry(0.16, true);
    d2.translate(-0.072, 0, 0);
    mesh(d2, Mats.metal('#9ea3a8', 0.22, 1), frontWheel);
  }
  forkSlider.add(frontWheel);

  // --- bras oscillant + roue arrière
  const swingarm = new THREE.Object3D();
  swingarm.position.set(0, pivotY, pivotZ);
  root.add(swingarm);
  const ax = new THREE.Vector3(0, rR - pivotY, -pivotZ);
  const armMat = Mats.metal(sport ? '#a9afb6' : '#1f2125', 0.3, 0.9);
  for (const sd of [-1, 1]) {
    const arm = sidePanel([P(0.03, 0.05), P(ax.z * 0.5, ax.y * 0.5 + 0.045), P(ax.z - 0.02, ax.y + 0.03), P(ax.z - 0.02, ax.y - 0.03), P(ax.z * 0.5, ax.y * 0.5 - 0.04), P(0.03, -0.05)], 0.035, 0, 0.008);
    arm.translate(sd * 0.12, 0, 0);
    mesh(arm, armMat, swingarm);
  }
  // chaîne côté gauche
  const chainPts: V3[] = [];
  for (let i = 0; i <= 16; i++) {
    const b = (i / 16) * Math.PI;
    chainPts.push([0.1, ax.y + Math.cos(b) * 0.1, ax.z - Math.sin(b) * 0.1]);
  }
  for (let i = 1; i < 10; i++) {
    const b = (i / 10) * Math.PI;
    chainPts.push([0.1, -0.06 - Math.cos(b) * 0.04, 0.08 + Math.sin(b) * 0.04]);
  }
  mesh(tube(chainPts, 0.006, 60, 4, true), Mats.metal('#3a3530', 0.6, 0.8), swingarm);
  const rearWheel = buildWheel({ r: rR, rimInch: spec.rimRear, width: spec.tireWR, tire: cfg.tire, rimStyle: 'cast', rimColor: cfg.rimColor, disc: { r: 0.11, side: -1 }, sprocket: { r: 0.1, side: 1 }, spokes: 0, hubColor: cfg.hubColor });
  rearWheel.position.copy(ax);
  swingarm.add(rearWheel);
  // garde-boue / lèche-roue
  mesh(roundedBox(0.16, 0.03, 0.3, 0.01).rotateX(0.5).translate(0, ax.y + rR + 0.03, ax.z + 0.12), dark, swingarm);
  // amortisseur central
  const shock = new THREE.Group();
  root.add(shock);
  const spring = new THREE.Mesh(springGeometry(0.04, 1, 7), Mats.metal(sport ? '#2a6dd8' : '#c8a030', 0.35, 0.8));
  shock.add(spring);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10).translate(0, 0.5, 0), Mats.metal('#2a2b2e', 0.3, 1));
  shock.add(body);
  const shockTop = new THREE.Vector3(0, seatTop - 0.12, Z(0.5));
  const shockLow = new THREE.Vector3(0, -0.05, -0.18);

  mergeStatic(chassis);
  mergeStatic(eng);
  mergeStatic(steer);
  mergeStatic(forkSlider);
  for (const w of [frontWheel, rearWheel]) mergeStatic(w);
  mergeStatic(swingarm);

  const swingLen = Math.hypot(ax.y, ax.z);
  const sagF = spec.travelF * 0.3, sagR = spec.travelR * 0.3;
  const tmpA = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const vis: BikeVisual = {
    root, steer, forkSlider, frontWheel, rearWheel, swingarm, gripL, gripR,
    seat: new THREE.Vector3(0, seatTop + 0.02, Z(0.36)),
    pegL: new THREE.Vector3(0.21, pegY + 0.02, pegZ),
    pegR: new THREE.Vector3(-0.21, pegY + 0.02, pegZ),
    headlight, headlightMat, taillightMat, exhaustTip, isScooter: false,
    update(steerA, compF, compR, rotF, rotR) {
      steer.rotation.y = -steerA;
      forkSlider.position.y = compF - sagF;
      swingarm.rotation.x = Math.asin(Math.max(-0.9, Math.min(0.9, (compR - sagR) / swingLen)));
      frontWheel.rotation.x = rotF;
      rearWheel.rotation.x = rotR;
      tmpA.copy(shockLow).applyEuler(swingarm.rotation).add(swingarm.position);
      const len = tmpA.distanceTo(shockTop);
      shock.position.copy(tmpA);
      shock.quaternion.setFromUnitVectors(up, shockTop.clone().sub(tmpA).normalize());
      spring.scale.set(1, len * 0.7, 1);
      spring.position.y = len * 0.15;
      body.scale.set(1, len, 1);
    },
    dispose() {
      root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
  void paint2;
  vis.update(0, sagF, sagR, 0, 0);
  return vis;
}


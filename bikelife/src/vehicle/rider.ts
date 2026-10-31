// Pilote articulé : membres positionnés par cinématique inverse à deux os
// (mains sur les poignées, pieds sur les repose-pieds), torse et tête qui
// réagissent au wheeling, aux virages et aux figures freestyle.

import * as THREE from 'three';
import type { RiderConfig } from '../data/apparel';
import { Mats, patternTexture, shade } from './materials';
import { clamp, lerp } from '../core/math';

export type TrickName = 'superman' | 'nacnac' | 'heelclicker' | 'nohander' | 'cancan' | 'whip';

export interface PoseInput {
  seat: THREE.Vector3;
  pegL: THREE.Vector3;
  pegR: THREE.Vector3;
  gripL: THREE.Vector3;
  gripR: THREE.Vector3;
  stand: number; // 0 assis .. 1 debout
  lean: number; // -1 arrière .. 1 avant
  pitch: number; // tangage moto (rad) — la tête compense
  roll: number; // inclinaison moto
  steer: number;
  trick: TrickName | null;
  trickW: number; // 0..1
  footDown: number; // 0 ou 1 (pied gauche au sol)
  scooter: boolean;
  firstPerson: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

function solve2Bone(a: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, outMid: THREE.Vector3, outEnd: THREE.Vector3): void {
  const d = target.clone().sub(a);
  let dist = d.length();
  const dir = dist > 1e-6 ? d.multiplyScalar(1 / dist) : new THREE.Vector3(0, -1, 0);
  dist = clamp(dist, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.005);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  outMid.copy(a).addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * sinA);
  outEnd.copy(a).addScaledVector(dir, dist);
}

/** Segment (cylindre conique) placé entre deux points. */
class Limb {
  mesh: THREE.Mesh;
  constructor(r1: number, r2: number, mat: THREE.Material, parent: THREE.Object3D, radial = 10) {
    const g = new THREE.CylinderGeometry(r2, r1, 1, radial, 1);
    g.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.castShadow = true;
    parent.add(this.mesh);
  }
  set(a: THREE.Vector3, b: THREE.Vector3): void {
    const d = b.clone().sub(a);
    const len = d.length();
    this.mesh.position.copy(a);
    if (len > 1e-6) this.mesh.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
    this.mesh.scale.set(1, Math.max(0.001, len), 1);
  }
}

export class Rider {
  root = new THREE.Group();
  cfg: RiderConfig;
  private parts = new THREE.Group();
  private torso!: THREE.Mesh;
  private pelvis!: THREE.Mesh;
  private head!: THREE.Group;
  private neck!: Limb;
  private limbs: Record<string, Limb> = {};
  private joints: Record<string, THREE.Mesh> = {};
  private hands: THREE.Mesh[] = [];
  private feet: THREE.Mesh[] = [];
  private bootShafts: Limb[] = [];
  private backpack: THREE.Mesh | null = null;
  // état articulaire (repère moto)
  pelvisPos = new THREE.Vector3();
  neckPos = new THREE.Vector3();
  headPos = new THREE.Vector3();
  private tmp = {
    hipL: new THREE.Vector3(), hipR: new THREE.Vector3(), kneeL: new THREE.Vector3(), kneeR: new THREE.Vector3(),
    ankleL: new THREE.Vector3(), ankleR: new THREE.Vector3(), shL: new THREE.Vector3(), shR: new THREE.Vector3(),
    elL: new THREE.Vector3(), elR: new THREE.Vector3(), wrL: new THREE.Vector3(), wrR: new THREE.Vector3(),
  };

  constructor(cfg: RiderConfig) {
    this.cfg = cfg;
    this.root.add(this.parts);
    this.build();
  }

  setConfig(cfg: RiderConfig): void {
    this.cfg = cfg;
    this.parts.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.parts.clear();
    this.limbs = {};
    this.joints = {};
    this.hands = [];
    this.feet = [];
    this.bootShafts = [];
    this.backpack = null;
    this.build();
  }

  private build(): void {
    const c = this.cfg;
    const P = this.parts;
    const skin = Mats.plastic(c.skin, 0.6);
    const topTex = patternTexture(c.topPattern, c.topColor, c.topColor2, c.number);
    const topMat = Mats.textured(`top:${topTex.uuid}:${c.top}`, topTex, {
      roughness: c.top === 'windbreaker' ? 0.35 : c.top === 'puffer' ? 0.5 : 0.8, clearcoat: c.top === 'windbreaker' ? 0.6 : 0,
    });
    const sleeveMat = Mats.plastic(c.top === 'jersey' ? c.topColor : c.topColor, c.top === 'windbreaker' ? 0.4 : 0.8);
    const pantsBase = c.pants === 'jeans' ? '#2f4f7f' : c.pantsColor;
    const pantsMat = Mats.plastic(pantsBase, c.pants === 'jeans' ? 0.85 : 0.7);
    const kneeMat = Mats.plastic(c.pants === 'mx' ? c.pantsColor2 : c.pants === 'joggers' ? shade(pantsBase, 0.2) : shade(pantsBase, -0.1), 0.6);
    const gloveMat = Mats.plastic(c.gloves, 0.7);
    const shoeMat = Mats.plastic(c.shoesColor, c.shoes === 'mxboots' ? 0.45 : 0.6);
    const soleMat = Mats.plastic(c.shoes === 'mxboots' ? c.shoesColor2 : '#f2f2f2', 0.7);

    // torse (profil de révolution étiré)
    const prof = [
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.13, 0.03), new THREE.Vector2(0.145, 0.3), new THREE.Vector2(0.175, 0.7),
      new THREE.Vector2(0.17, 0.88), new THREE.Vector2(0.11, 0.98), new THREE.Vector2(0.001, 1.0),
    ];
    const tg = new THREE.LatheGeometry(prof, 16);
    const puff = c.top === 'puffer' ? 1.14 : c.top === 'hoodie' ? 1.06 : 1;
    tg.scale(1.18 * puff, 1, 0.74 * puff);
    this.torso = new THREE.Mesh(tg, topMat);
    this.torso.castShadow = true;
    P.add(this.torso);
    if (c.top === 'hoodie') {
      const hood = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      hood.scale(1.2, 0.7, 0.9);
      hood.rotateX(-1.2);
      hood.translate(0, 0.93, -0.1);
      const hm = new THREE.Mesh(hood, sleeveMat);
      this.torso.add(hm);
    }
    // bassin
    const pg = new THREE.SphereGeometry(0.15, 14, 10);
    pg.scale(1.05, 0.8, 0.85);
    this.pelvis = new THREE.Mesh(pg, pantsMat);
    this.pelvis.castShadow = true;
    P.add(this.pelvis);
    // cou
    this.neck = new Limb(0.05, 0.045, skin, P, 8);
    // tête + casque
    this.head = this.buildHead();
    P.add(this.head);
    // membres
    const armR1 = c.top === 'puffer' ? 0.06 : 0.05;
    const forearmMat = c.top === 'tee' ? skin : sleeveMat;
    this.limbs.upperArmL = new Limb(armR1, 0.045, sleeveMat, P);
    this.limbs.upperArmR = new Limb(armR1, 0.045, sleeveMat, P);
    this.limbs.foreArmL = new Limb(0.042, 0.034, forearmMat, P);
    this.limbs.foreArmR = new Limb(0.042, 0.034, forearmMat, P);
    this.limbs.thighL = new Limb(0.085, 0.062, pantsMat, P);
    this.limbs.thighR = new Limb(0.085, 0.062, pantsMat, P);
    this.limbs.shinL = new Limb(0.058, 0.045, c.pants === 'mx' ? pantsMat : pantsMat, P);
    this.limbs.shinR = new Limb(0.058, 0.045, pantsMat, P);
    const jointGeo = new THREE.SphereGeometry(1, 10, 8);
    const mkJoint = (name: string, r: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(jointGeo, mat);
      m.scale.setScalar(r);
      m.castShadow = true;
      P.add(m);
      this.joints[name] = m;
    };
    mkJoint('shL', armR1 + 0.01, sleeveMat);
    mkJoint('shR', armR1 + 0.01, sleeveMat);
    mkJoint('elL', 0.044, forearmMat);
    mkJoint('elR', 0.044, forearmMat);
    mkJoint('knL', 0.068, kneeMat);
    mkJoint('knR', 0.068, kneeMat);
    // mains
    for (let i = 0; i < 2; i++) {
      const hg = new THREE.BoxGeometry(0.08, 0.05, 0.1);
      const h = new THREE.Mesh(hg, gloveMat);
      h.castShadow = true;
      P.add(h);
      this.hands.push(h);
    }
    // pieds / bottes
    for (let i = 0; i < 2; i++) {
      const fg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, c.shoes === 'mxboots' ? 0.1 : 0.08, 0.27).translate(0, 0.02, 0.06), shoeMat);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.03, 0.28).translate(0, -0.035, 0.06), soleMat);
      upper.castShadow = sole.castShadow = true;
      fg.add(upper, sole);
      const f = new THREE.Mesh();
      f.add(fg);
      P.add(f);
      this.feet.push(f);
      if (c.shoes !== 'sneakers') {
        this.bootShafts.push(new Limb(c.shoes === 'mxboots' ? 0.07 : 0.06, c.shoes === 'mxboots' ? 0.065 : 0.058, shoeMat, P));
      }
    }
    if (c.backpack) {
      const bp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.14), Mats.plastic(c.backpackColor, 0.7));
      bp.castShadow = true;
      this.torso.add(bp);
      bp.position.set(0, 0.55, -0.19);
      this.backpack = bp;
    }
  }

  private buildHead(): THREE.Group {
    const c = this.cfg;
    const g = new THREE.Group();
    const helmTex = patternTexture(c.helmetPattern, c.helmetColor, c.helmetColor2);
    const helmMat = Mats.textured(`helm:${helmTex.uuid}`, helmTex, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
    const skin = Mats.plastic(c.skin, 0.6);
    const shell = new THREE.SphereGeometry(0.145, 20, 14);
    shell.scale(0.95, 1.0, 1.08);
    const sh = new THREE.Mesh(shell, helmMat);
    sh.castShadow = true;
    g.add(sh);
    const dark = Mats.plastic('#121212', 0.5);
    if (c.helmet === 'mx') {
      // menton proéminent + visière
      const chin = new THREE.SphereGeometry(0.08, 14, 10);
      chin.scale(1.1, 0.8, 1.2);
      chin.translate(0, -0.085, 0.12);
      g.add(new THREE.Mesh(chin, helmMat));
      const peak = new THREE.BoxGeometry(0.2, 0.012, 0.16);
      peak.rotateX(-0.3);
      peak.translate(0, 0.085, 0.16);
      g.add(new THREE.Mesh(peak, Mats.plastic(c.helmetColor2, 0.35)));
    } else if (c.helmet === 'street') {
      const visor = new THREE.SphereGeometry(0.15, 18, 10, -1.1, 2.2, 1.0, 0.75);
      visor.scale(0.97, 1, 1.1);
      g.add(new THREE.Mesh(visor, Mats.glass('#0a0f16', 0.85)));
    } else {
      // jet : visage visible
      const face = new THREE.SphereGeometry(0.1, 14, 10);
      face.scale(0.85, 1, 0.7);
      face.translate(0, -0.03, 0.08);
      g.add(new THREE.Mesh(face, skin));
      const visor = new THREE.SphereGeometry(0.152, 18, 10, -1.0, 2.0, 0.9, 0.5);
      g.add(new THREE.Mesh(visor, Mats.glass('#1b2836', 0.5)));
    }
    if (c.eyewear === 'goggles' && c.helmet !== 'street') {
      const band = new THREE.TorusGeometry(0.152, 0.016, 6, 24);
      band.scale(0.97, 1, 1.08);
      band.rotateX(Math.PI / 2 - 0.12);
      g.add(new THREE.Mesh(band, Mats.plastic(c.eyewearColor, 0.5)));
      const lens = new THREE.BoxGeometry(0.17, 0.06, 0.03);
      lens.translate(0, 0.0, 0.155);
      g.add(new THREE.Mesh(lens, Mats.glass(shade(c.eyewearColor, -0.2), 0.9)));
      const frame = new THREE.BoxGeometry(0.19, 0.075, 0.025);
      frame.translate(0, 0.0, 0.145);
      g.add(new THREE.Mesh(frame, Mats.plastic(c.eyewearColor, 0.45)));
    } else if (c.eyewear === 'mask') {
      const lens = new THREE.BoxGeometry(0.16, 0.045, 0.02);
      lens.translate(0, 0.0, 0.158);
      g.add(new THREE.Mesh(lens, Mats.glass('#050505', 0.95)));
      if (c.helmet === 'jet') g.add(new THREE.Mesh(new THREE.SphereGeometry(0.102, 14, 10).scale(0.86, 1, 0.72).translate(0, -0.03, 0.082), dark));
    }
    g.traverse((o) => (o.castShadow = true));
    return g;
  }

  /** Calcule et applique la pose dans le repère moto. */
  pose(p: PoseInput): void {
    const t = this.tmp;
    const trick = p.trick;
    const w = p.trickW;
    const stand = p.stand;
    const seat = p.seat;
    const pegMid = p.pegL.clone().add(p.pegR).multiplyScalar(0.5);
    // ---- bassin
    const seatedP = new THREE.Vector3(0, seat.y + 0.1, seat.z - 0.02 + p.lean * 0.1);
    const standP = new THREE.Vector3(0, pegMid.y + 0.72, pegMid.z - 0.06 + p.lean * 0.14);
    const pel = seatedP.lerp(standP, p.scooter ? 0 : stand);
    // inclinaison du corps dans les virages (vers l'intérieur)
    pel.x += -Math.sin(p.roll) * 0.08;
    // ---- figures : cibles alternatives
    let footTL = p.pegL.clone().add(new THREE.Vector3(0.02, 0.07, -0.02));
    let footTR = p.pegR.clone().add(new THREE.Vector3(-0.02, 0.07, -0.02));
    let handTL = p.gripL.clone();
    let handTR = p.gripR.clone();
    let torsoTilt = lerp(lerp(0.32, 0.6, stand), lerp(0.28, 0.5, stand), 0) + p.lean * 0.22 + (p.scooter ? -0.15 : 0);
    if (p.footDown > 0.01) {
      footTL = footTL.lerp(new THREE.Vector3(0.36, 0.06, pegMid.z + 0.12), p.footDown);
    }
    if (trick && w > 0) {
      const tp = pel.clone();
      if (trick === 'superman') {
        tp.set(0, seat.y + 0.32, seat.z - 0.3);
        footTL = footTL.lerp(new THREE.Vector3(0.14, seat.y + 0.32, seat.z - 0.95), w);
        footTR = footTR.lerp(new THREE.Vector3(-0.14, seat.y + 0.3, seat.z - 0.95), w);
        torsoTilt = lerp(torsoTilt, 1.25, w);
      } else if (trick === 'nacnac') {
        tp.set(0.12, seat.y + 0.16, seat.z - 0.05);
        footTR = footTR.lerp(new THREE.Vector3(0.42, seat.y + 0.05, seat.z - 0.35), w);
      } else if (trick === 'heelclicker') {
        tp.set(0, seat.y + 0.08, seat.z + 0.08);
        footTL = footTL.lerp(new THREE.Vector3(0.12, p.gripL.y + 0.18, p.gripL.z + 0.3), w);
        footTR = footTR.lerp(new THREE.Vector3(-0.12, p.gripR.y + 0.18, p.gripR.z + 0.3), w);
        torsoTilt = lerp(torsoTilt, -0.15, w);
      } else if (trick === 'nohander') {
        tp.set(0, seat.y + 0.14, seat.z + 0.05);
        torsoTilt = lerp(torsoTilt, 0.05, w);
      } else if (trick === 'cancan') {
        footTR = footTR.lerp(new THREE.Vector3(0.45, pegMid.y + 0.4, pegMid.z + 0.35), w);
      }
      pel.lerp(tp, w);
    }
    this.pelvisPos.copy(pel);
    // ---- torse : on penche jusqu'à ce que les mains atteignent le guidon
    const armLen = 0.29 + 0.27;
    let dir = new THREE.Vector3();
    let neck = new THREE.Vector3();
    for (let it = 0; it < 4; it++) {
      dir.set(Math.sin(p.roll) * -0.15, Math.cos(torsoTilt), Math.sin(torsoTilt)).normalize();
      neck.copy(pel).addScaledVector(dir, 0.5);
      const shL = neck.clone().add(new THREE.Vector3(0.19, -0.04, 0));
      const reach = shL.distanceTo(handTL);
      if (reach > armLen * 0.97 && !(trick === 'nohander' && w > 0.5)) torsoTilt += Math.min(0.25, (reach - armLen * 0.95) * 1.6);
      else break;
    }
    this.neckPos.copy(neck);
    // orientation du torse
    const fwd = new THREE.Vector3(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z)).normalize();
    const right = new THREE.Vector3().crossVectors(dir, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(right, dir, fwd);
    this.torso.position.copy(pel).addScaledVector(dir, -0.02);
    this.torso.quaternion.setFromRotationMatrix(m);
    this.torso.scale.set(1, 0.56, 1);
    this.pelvis.position.copy(pel);
    this.pelvis.quaternion.copy(this.torso.quaternion);
    // ---- tête (compense le tangage pour regarder devant)
    const headUp = dir.clone().lerp(new THREE.Vector3(0, Math.cos(p.pitch), Math.sin(p.pitch)), 0.6).normalize();
    this.headPos.copy(neck).addScaledVector(headUp, 0.16);
    this.neck.set(neck.clone().addScaledVector(dir, -0.03), this.headPos);
    this.head.position.copy(this.headPos);
    this.head.rotation.set(Math.atan2(headUp.z, headUp.y) - 0.15, p.steer * 0.25, -p.roll * 0.3);
    this.head.visible = !p.firstPerson;
    this.neck.mesh.visible = !p.firstPerson;
    // ---- bras
    t.shL.copy(neck).addScaledVector(right, 0.19).addScaledVector(dir, -0.05);
    t.shR.copy(neck).addScaledVector(right, -0.19).addScaledVector(dir, -0.05);
    if (trick === 'nohander' && w > 0) {
      handTL.lerp(t.shL.clone().add(new THREE.Vector3(0.25, 0.42, 0.05)), w);
      handTR.lerp(t.shR.clone().add(new THREE.Vector3(-0.25, 0.42, 0.05)), w);
    }
    solve2Bone(t.shL, handTL, 0.29, 0.27, new THREE.Vector3(0.7, -0.5, -0.4), t.elL, t.wrL);
    solve2Bone(t.shR, handTR, 0.29, 0.27, new THREE.Vector3(-0.7, -0.5, -0.4), t.elR, t.wrR);
    this.limbs.upperArmL.set(t.shL, t.elL);
    this.limbs.foreArmL.set(t.elL, t.wrL);
    this.limbs.upperArmR.set(t.shR, t.elR);
    this.limbs.foreArmR.set(t.elR, t.wrR);
    this.joints.shL.position.copy(t.shL);
    this.joints.shR.position.copy(t.shR);
    this.joints.elL.position.copy(t.elL);
    this.joints.elR.position.copy(t.elR);
    this.hands[0].position.copy(t.wrL);
    this.hands[1].position.copy(t.wrR);
    this.hands[0].lookAt(t.wrL.clone().add(t.wrL.clone().sub(t.elL)));
    this.hands[1].lookAt(t.wrR.clone().add(t.wrR.clone().sub(t.elR)));
    // ---- jambes
    t.hipL.copy(pel).addScaledVector(right, 0.095).addScaledVector(dir, -0.04);
    t.hipR.copy(pel).addScaledVector(right, -0.095).addScaledVector(dir, -0.04);
    const kneePole = new THREE.Vector3(0, 0.25, 1);
    solve2Bone(t.hipL, footTL, 0.44, 0.45, kneePole.clone().add(new THREE.Vector3(0.35, 0, 0)), t.kneeL, t.ankleL);
    solve2Bone(t.hipR, footTR, 0.44, 0.45, kneePole.clone().add(new THREE.Vector3(-0.35, 0, 0)), t.kneeR, t.ankleR);
    this.limbs.thighL.set(t.hipL, t.kneeL);
    this.limbs.shinL.set(t.kneeL, t.ankleL);
    this.limbs.thighR.set(t.hipR, t.kneeR);
    this.limbs.shinR.set(t.kneeR, t.ankleR);
    this.joints.knL.position.copy(t.kneeL);
    this.joints.knR.position.copy(t.kneeR);
    const ankles = [t.ankleL, t.ankleR];
    const knees = [t.kneeL, t.kneeR];
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      f.position.copy(ankles[i]);
      const shinDir = ankles[i].clone().sub(knees[i]).normalize();
      // pied perpendiculaire au tibia, pointant vers l'avant
      const footFwd = new THREE.Vector3(0, 0, 1).sub(shinDir.clone().multiplyScalar(shinDir.z)).normalize();
      const r = new THREE.Vector3().crossVectors(shinDir.clone().negate(), footFwd).normalize();
      f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, shinDir.clone().negate(), footFwd));
      if (this.bootShafts[i]) {
        const top = ankles[i].clone().lerp(knees[i], this.cfg.shoes === 'mxboots' ? 0.75 : 0.25);
        this.bootShafts[i].set(ankles[i].clone().addScaledVector(shinDir, 0.02), top);
      }
    }
  }
}

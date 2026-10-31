// Entité moto du joueur : relie la physique, le modèle 3D, le pilote animé,
// le phare et la simulation de chute (moto et pilote qui glissent/roulent).
// BikeAvatar : même rendu piloté par des états réseau ou un fantôme.

import * as THREE from 'three';
import type { BikeSpec } from '../data/bikes';
import { BikeConfig, tuningFromConfig } from '../data/parts';
import type { RiderConfig } from '../data/apparel';
import { BikePhysics, BikeInput, AssistLevel } from '../physics/bikePhysics';
import type { CollisionWorld, GroundHit } from '../physics/collision';
import { buildBikeVisual, BikeVisual } from './bikeModel';
import { Rider, TrickName } from './rider';
import { clamp, damp } from '../core/math';
import { isLoose } from '../physics/collision';

export interface PoseExtras {
  trick: TrickName | null;
  trickW: number;
  firstPerson: boolean;
  night: number;
}

/** Hiérarchie de groupes : lacet → pivot de roulis au sol → tangage autour du CG. */
class BikeRig {
  outer = new THREE.Group();
  rollPivot = new THREE.Group();
  rollBack = new THREE.Group();
  pitchG = new THREE.Group();
  offset = new THREE.Group();
  constructor() {
    this.outer.add(this.rollPivot);
    this.rollPivot.add(this.rollBack);
    this.rollBack.add(this.pitchG);
    this.pitchG.add(this.offset);
  }
  set(spec: BikeSpec, comY: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void {
    this.outer.position.set(x, y, z);
    this.outer.rotation.set(0, yaw, 0);
    this.rollPivot.position.set(0, -comY, 0);
    this.rollPivot.rotation.set(0, 0, roll);
    this.rollBack.position.set(0, comY, 0);
    this.pitchG.rotation.set(-pitch, 0, 0);
    this.offset.position.set(0, -comY, -spec.comX);
  }
}

export class PlayerBike {
  spec: BikeSpec;
  cfg: BikeConfig;
  phys: BikePhysics;
  visual!: BikeVisual;
  rider: Rider;
  rig = new BikeRig();
  headlight: THREE.SpotLight;
  private stand = 0;
  private footDown = 0;
  private gripL = new THREE.Vector3();
  private gripR = new THREE.Vector3();
  private inv = new THREE.Matrix4();
  // chute
  wreck: { t: number; bikeV: THREE.Vector3; bikeW: THREE.Vector3; riderV: THREE.Vector3; riderW: THREE.Vector3; riderObj: THREE.Group } | null = null;
  headWorld = new THREE.Vector3();
  private gh: GroundHit = { h: 0, surf: 'asphalt', id: -1 };

  constructor(spec: BikeSpec, cfg: BikeConfig, riderCfg: RiderConfig, private world: CollisionWorld, private scene: THREE.Scene) {
    this.spec = spec;
    this.cfg = cfg;
    this.phys = new BikePhysics(spec, tuningFromConfig(spec, cfg), world);
    this.rider = new Rider(riderCfg);
    this.headlight = new THREE.SpotLight('#fff2d8', 0, 80, 0.55, 0.45, 1.6);
    this.headlight.castShadow = false;
    scene.add(this.rig.outer);
    scene.add(this.headlight);
    scene.add(this.headlight.target);
    this.buildVisual();
  }

  private buildVisual(): void {
    if (this.visual) {
      this.rig.offset.remove(this.visual.root);
      this.visual.root.remove(this.rider.root);
      this.visual.dispose();
    }
    this.visual = buildBikeVisual(this.spec, this.cfg);
    this.rig.offset.add(this.visual.root);
    this.visual.root.add(this.rider.root);
  }

  /** Change de moto ou de configuration (garage) en gardant la position. */
  setBike(spec: BikeSpec, cfg: BikeConfig): void {
    const keep = { x: this.phys.x, z: this.phys.z, yaw: this.phys.yaw, assist: this.phys.assist, auto: this.phys.autoGear };
    this.spec = spec;
    this.cfg = cfg;
    this.phys = new BikePhysics(spec, tuningFromConfig(spec, cfg), this.world);
    this.phys.assist = keep.assist;
    this.phys.autoGear = keep.auto;
    this.phys.reset(keep.x, keep.z, keep.yaw);
    this.buildVisual();
  }

  setRider(cfg: RiderConfig): void {
    this.rider.setConfig(cfg);
  }

  setAssist(a: AssistLevel, autoGear: boolean): void {
    this.phys.assist = a;
    this.phys.autoGear = autoGear;
  }

  reset(x: number, z: number, yaw: number, y?: number): void {
    this.endWreck();
    this.phys.reset(x, z, yaw, y);
    this.stand = 0;
  }

  step(dt: number, inp: BikeInput): void {
    if (this.wreck) {
      this.updateWreck(dt);
      return;
    }
    this.phys.step(dt, inp);
    if (this.phys.crashed) this.startWreck();
  }

  // ------------------------------------------------------------ rendu
  sync(dt: number, ex: PoseExtras): void {
    if (this.wreck) return;
    const p = this.phys;
    const stopped = p.speed < 0.7 && p.state === 'ground';
    this.footDown = damp(this.footDown, stopped ? 1 : 0, 5, dt);
    const visRoll = p.roll - this.footDown * 0.11;
    this.rig.set(this.spec, p.comHeight, p.x, p.y, p.z, p.yaw, p.pitch, visRoll);
    this.visual.update(p.steerVis, p.front.comp, p.rear.comp, p.front.rot, p.rear.rot);
    // pilote debout en l'air, sur terre rapide, en stoppie
    const loose = isLoose(p.rear.surf);
    const wantStand = !this.visual.isScooter && (p.state === 'air' || p.state === 'stoppie' || (loose && p.speed > 9) || p.lastLandImpact > 4 && p.groundedTime < 0.4) ? 1 : 0;
    this.stand = damp(this.stand, wantStand, 4, dt);
    this.rig.outer.updateMatrixWorld(true);
    this.inv.copy(this.visual.root.matrixWorld).invert();
    this.visual.gripL.getWorldPosition(this.gripL).applyMatrix4(this.inv);
    this.visual.gripR.getWorldPosition(this.gripR).applyMatrix4(this.inv);
    this.rider.pose({
      seat: this.visual.seat, pegL: this.visual.pegL, pegR: this.visual.pegR, gripL: this.gripL, gripR: this.gripR,
      stand: this.stand, lean: p.riderLean, pitch: p.pitch, roll: visRoll, steer: p.steerVis, trick: ex.trick, trickW: ex.trickW,
      footDown: this.footDown, scooter: this.visual.isScooter, firstPerson: ex.firstPerson,
    });
    this.rider.root.updateMatrixWorld(true);
    this.headWorld.copy(this.rider.headPos).applyMatrix4(this.visual.root.matrixWorld);
    // phare
    if (this.visual.headlight) {
      const hl = this.visual.headlight;
      hl.getWorldPosition(this.headlight.position);
      // le phare des motos est dans le repère de fourche (incliné de l'angle de chasse)
      const local = this.visual.isScooter ? new THREE.Vector3(0, -0.1, 1) : new THREE.Vector3(0, -0.54, 0.85);
      const fwd = local.applyQuaternion(hl.getWorldQuaternion(new THREE.Quaternion()));
      this.headlight.target.position.copy(this.headlight.position).addScaledVector(fwd, 10);
      this.headlight.intensity = ex.night > 0.05 ? 260 * ex.night : 0;
      if (this.visual.headlightMat) this.visual.headlightMat.emissiveIntensity = 0.3 + ex.night * 3;
    } else this.headlight.intensity = 0;
    if (this.visual.taillightMat) this.visual.taillightMat.emissiveIntensity = 0.6 + ex.night * 2 + (p.front.longF < -200 || p.rear.longF < -200 ? 2 : 0);
  }

  /** Position monde d'un point du repère modèle. */
  modelToWorld(v: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(v).applyMatrix4(this.visual.root.matrixWorld);
  }

  // ------------------------------------------------------------ chute
  private startWreck(): void {
    const p = this.phys;
    const riderObj = new THREE.Group();
    // détache le pilote en conservant sa transformation monde
    this.rider.root.updateMatrixWorld(true);
    const m = this.rider.root.matrixWorld.clone();
    this.visual.root.remove(this.rider.root);
    riderObj.add(this.rider.root);
    m.decompose(riderObj.position, riderObj.quaternion, riderObj.scale);
    this.rider.root.position.set(0, 0, 0);
    this.rider.root.quaternion.identity();
    this.scene.add(riderObj);
    const v = new THREE.Vector3(p.vx, p.vy, p.vz);
    this.wreck = {
      t: 0,
      bikeV: v.clone().multiplyScalar(0.9),
      bikeW: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4 + (p.roll > 0 ? -2 : 2)),
      riderV: v.clone().multiplyScalar(1.05).add(new THREE.Vector3(0, 2.2 + p.speed * 0.08, 0)),
      riderW: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6),
      riderObj,
    };
  }

  private tumble(obj: THREE.Object3D, v: THREE.Vector3, w: THREE.Vector3, dt: number, radius: number): number {
    v.y -= 9.81 * dt;
    obj.position.addScaledVector(v, dt);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.x * dt, w.y * dt, w.z * dt));
    obj.quaternion.premultiply(q);
    const g = this.world.groundAt(obj.position.x, obj.position.z, obj.position.y + 1, this.gh);
    let scrape = 0;
    if (obj.position.y < g.h + radius) {
      obj.position.y = g.h + radius;
      if (v.y < 0) v.y = -v.y * 0.25;
      const f = Math.max(0, 1 - dt * (isLoose(g.surf) ? 4.5 : 2.6));
      v.x *= f;
      v.z *= f;
      w.multiplyScalar(Math.max(0, 1 - dt * 2.5));
      scrape = Math.hypot(v.x, v.z);
    }
    // murs
    const hit = this.world.collideCapsule(obj.position.x, obj.position.z, obj.position.y - radius + 0.1, obj.position.y + 0.5, radius, 0.4, { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false });
    if (hit.hit) {
      obj.position.x += hit.px;
      obj.position.z += hit.pz;
      const vn = v.x * hit.nx + v.z * hit.nz;
      if (vn < 0) {
        v.x -= hit.nx * vn * 1.4;
        v.z -= hit.nz * vn * 1.4;
      }
    }
    return scrape;
  }

  /** Vitesse de glissement de la moto au sol pendant la chute (étincelles). */
  wreckScrape = 0;

  private updateWreck(dt: number): void {
    const w = this.wreck!;
    w.t += dt;
    this.wreckScrape = this.tumble(this.rig.outer, w.bikeV, w.bikeW, dt, 0.35);
    this.tumble(w.riderObj, w.riderV, w.riderW, dt, 0.25);
    this.rig.outer.updateMatrixWorld(true);
  }

  get wreckTime(): number {
    return this.wreck ? this.wreck.t : 0;
  }

  get wreckPos(): THREE.Vector3 {
    return this.wreck ? this.wreck.riderObj.position : this.rig.outer.position;
  }

  endWreck(): void {
    if (!this.wreck) return;
    this.scene.remove(this.wreck.riderObj);
    this.wreck.riderObj.remove(this.rider.root);
    this.visual.root.add(this.rider.root);
    this.rig.outer.quaternion.identity();
    this.wreck = null;
  }

  dispose(): void {
    this.endWreck();
    this.scene.remove(this.rig.outer, this.headlight, this.headlight.target);
    this.visual.dispose();
  }
}

/** Instantané compact (réseau / fantôme). */
export interface BikeSnapshot {
  x: number; y: number; z: number; yaw: number; pitch: number; roll: number; steer: number;
  cf: number; cr: number; rf: number; rr: number; rpm: number; thr: number;
}

export class BikeAvatar {
  rig = new BikeRig();
  visual: BikeVisual;
  rider: Rider | null;
  private cur: BikeSnapshot | null = null;
  private target: BikeSnapshot | null = null;
  label: THREE.Sprite | null = null;

  constructor(public spec: BikeSpec, cfg: BikeConfig, riderCfg: RiderConfig | null, ghost = false) {
    this.visual = buildBikeVisual(spec, cfg);
    this.rig.offset.add(this.visual.root);
    this.rider = riderCfg ? new Rider(riderCfg) : null;
    if (this.rider) this.visual.root.add(this.rider.root);
    if (ghost) {
      const gm = new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.35, depthWrite: false });
      this.rig.outer.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = gm;
          m.castShadow = false;
        }
      });
    }
  }

  setName(name: string): void {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(10,12,18,0.7)';
    g.fillRect(0, 8, 256, 48);
    g.fillStyle = '#fff';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.fillText(name.slice(0, 16), 128, 43);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (!this.label) {
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
      this.label.scale.set(2.4, 0.6, 1);
      this.label.position.set(0, 2.4, 0);
      this.rig.outer.add(this.label);
    } else {
      (this.label.material as THREE.SpriteMaterial).map = t;
    }
  }

  push(s: BikeSnapshot): void {
    this.target = s;
    if (!this.cur) this.cur = { ...s };
  }

  update(dt: number): void {
    if (!this.cur || !this.target) return;
    const c = this.cur, t = this.target;
    const k = clamp(dt * 10, 0, 1);
    c.x += (t.x - c.x) * k;
    c.y += (t.y - c.y) * k;
    c.z += (t.z - c.z) * k;
    let dy = t.yaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.yaw += dy * k;
    c.pitch += (t.pitch - c.pitch) * k;
    c.roll += (t.roll - c.roll) * k;
    c.steer += (t.steer - c.steer) * k;
    c.cf = t.cf;
    c.cr = t.cr;
    c.rf += (t.rf - c.rf) * k;
    c.rr += (t.rr - c.rr) * k;
    c.rpm = t.rpm;
    this.rig.set(this.spec, this.spec.comY, c.x, c.y, c.z, c.yaw, c.pitch, c.roll);
    this.visual.update(c.steer, c.cf, c.cr, c.rf, c.rr);
    if (this.rider) {
      this.rig.outer.updateMatrixWorld(true);
      const inv = this.visual.root.matrixWorld.clone().invert();
      const gl = this.visual.gripL.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      const gr = this.visual.gripR.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      this.rider.pose({ seat: this.visual.seat, pegL: this.visual.pegL, pegR: this.visual.pegR, gripL: gl, gripR: gr, stand: 0, lean: c.pitch > 0.2 ? -0.5 : 0, pitch: c.pitch, roll: c.roll, steer: c.steer, trick: null, trickW: 0, footDown: 0, scooter: this.visual.isScooter, firstPerson: false });
    }
  }

  get state(): BikeSnapshot | null {
    return this.cur;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.rig.outer);
    this.visual.dispose();
  }
}

import { describe, it, expect } from 'vitest';
import { CollisionWorld } from '../src/physics/collision';

describe('monde de collision', () => {
  const w = new CollisionWorld();
  w.addBox({ x: 10, z: 0, hx: 2, hz: 2, y1: 3, surf: 'concrete' });
  w.addProfile({ x: 0, z: 20, hx: 2, yaw: 0, points: [[0, 0], [4, 2]], surf: 'wood' });
  w.addCylinder({ x: -10, z: 0, r: 1, y1: 1 });
  const g = { h: 0, surf: 'asphalt' as const, id: -1 } as any;

  it('hauteur du sol : boîte, rampe, cylindre', () => {
    expect(w.groundAt(10, 0, 10, g).h).toBe(3);
    expect(w.groundAt(10, 0, 1, g).h).toBe(0); // dessus trop haut → ignoré
    expect(w.groundAt(0, 22, 10, g).h).toBeCloseTo(1, 3);
    expect(w.groundAt(-10, 0, 10, g).h).toBe(1);
  });

  it('les murs repoussent une sphère', () => {
    const hit = w.collideCapsule(8.2, 0, 0, 1.6, 0.4, 0.4, { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false });
    expect(hit.hit).toBe(true);
    expect(hit.px).toBeLessThan(0);
  });

  it('un obstacle bas est franchissable', () => {
    const low = new CollisionWorld();
    low.addBox({ x: 0, z: 0, hx: 3, hz: 3, y1: 0.15 });
    const hit = low.collideCapsule(3.2, 0, 0, 1.6, 0.4, 0.4, { px: 0, pz: 0, nx: 0, nz: 0, depth: 0, hit: false });
    expect(hit.hit).toBe(false);
  });

  it('raycast caméra arrêté par un bâtiment', () => {
    const f = w.raycast(0, 1.5, 0, 20, 1.5, 0);
    expect(f).toBeGreaterThan(0.35);
    expect(f).toBeLessThan(0.5);
  });
});

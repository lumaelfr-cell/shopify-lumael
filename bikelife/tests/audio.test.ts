import { describe, it, expect } from 'vitest';
import { EngineDSP, PRESETS, EngineKind } from '../src/audio/engineDSP';

describe('synthèse moteur', () => {
  it('produit un signal fini et non saturé pour tous les moteurs', () => {
    for (const k of Object.keys(PRESETS) as EngineKind[]) {
      const d = new EngineDSP(44100, k);
      d.target = { rpm: 9000, load: 1, vol: 1, loud: 1, whine: 300 };
      const buf = new Float32Array(44100);
      for (let i = 0; i < buf.length; i += 128) d.render(buf, i, Math.min(buf.length, i + 128));
      let peak = 0;
      for (const v of buf) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, k).toBeGreaterThan(0.01);
      expect(peak, k).toBeLessThan(2);
    }
  });
});

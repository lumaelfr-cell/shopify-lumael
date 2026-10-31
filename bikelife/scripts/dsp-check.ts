import { EngineDSP, PRESETS, EngineKind } from '../src/audio/engineDSP';
const sr = 48000;
for (const kind of Object.keys(PRESETS) as EngineKind[]) {
  const row: string[] = [];
  for (const [rpm, load] of [[1500, 0], [6000, 1], [10000, 1], [9000, 0]] as const) {
    const d = new EngineDSP(sr, kind);
    d.target = { rpm, load, vol: 1, loud: 0.5, whine: 0 };
    const buf = new Float32Array(sr);
    for (let i = 0; i < sr; i += 128) d.render(buf, i, Math.min(sr, i + 128));
    let peak = 0, sum = 0, nan = 0;
    for (let i = sr / 2; i < sr; i++) { const v = buf[i]; if (!isFinite(v)) nan++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    row.push(`${rpm}/${load}: rms=${Math.sqrt(sum / (sr / 2)).toFixed(3)} pk=${peak.toFixed(2)}${nan ? ' NaN!' : ''}`);
  }
  console.log(kind.padEnd(11), row.join(' | '));
}

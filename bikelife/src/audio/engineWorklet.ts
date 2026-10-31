// AudioWorklet du moteur : exécute EngineDSP sur le thread audio.
import { EngineDSP, EngineKind } from './engineDSP';

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: unknown): void;

class EngineProcessor extends AudioWorkletProcessor {
  private dsp: EngineDSP;
  constructor(opts: { processorOptions?: { kind?: EngineKind } }) {
    super();
    this.dsp = new EngineDSP(sampleRate, opts?.processorOptions?.kind ?? '4t-mx');
    this.port.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.kind) this.dsp.setKind(d.kind);
      if (d.p) Object.assign(this.dsp.target, d.p);
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    this.dsp.render(out[0]);
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    return true;
  }
}

registerProcessor('engine-processor', EngineProcessor);

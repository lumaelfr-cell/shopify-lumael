// Bus d'événements typé minimal : découple gameplay, UI, audio et progression.

export interface GameEvents {
  trickLanded: { name: string; points: number };
  comboBanked: { points: number; multiplier: number; tricks: string[]; money: number; xp: number };
  comboLost: { points: number };
  trickStart: { name: string };
  crash: { reason: string; speed: number };
  respawn: {};
  record: { key: string; label: string; value: number; unit: string };
  money: { amount: number; reason: string };
  levelUp: { level: number };
  achievement: { id: string; name: string };
  notify: { text: string; kind?: 'info' | 'good' | 'bad' | 'gold' };
  wheelieEnd: { distance: number; time: number; maxAngle: number };
  stoppieEnd: { distance: number; time: number };
  airEnd: { time: number; distance: number; height: number; tricks: string[]; landed: boolean };
  nearMiss: {};
  checkpoint: { index: number; total: number };
  land: { impact: number };
  gearShift: { gear: number };
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] handler error for ${String(type)}`, err);
      }
    }
  }
}

export const events = new EventBus();

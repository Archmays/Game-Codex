import type { SearchResult } from './solver';
import type { WorldState } from './rooms';

export interface HintWorker {
  onmessage: ((event: MessageEvent<{ id: number; result: SearchResult }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { id: number; room: number; state: WorldState }): void;
  terminate(): void;
}

/** Own each worker and request together: an obsolete callback can never touch its successor. */
export function createHintSearch(options: {
  result: (result: SearchResult) => void;
  error: () => void;
  createWorker?: () => HintWorker;
}) {
  let worker: HintWorker | null = null;
  let generation = 0;
  let destroyed = false;
  const cancel = () => {
    generation++;
    const active = worker; worker = null;
    active?.terminate();
  };
  return {
    get pending() { return worker !== null; },
    cancel,
    request(room: number, state: WorldState) {
      if (destroyed || worker) return;
      const id = ++generation;
      let active: HintWorker;
      try {
        active = options.createWorker?.() ?? new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      } catch { options.error(); return; }
      worker = active;
      const current = () => !destroyed && generation === id && worker === active;
      const finish = () => { worker = null; active.terminate(); };
      active.onmessage = event => {
        if (!current() || event.data.id !== id) return;
        finish(); options.result(event.data.result);
      };
      active.onerror = () => {
        if (!current()) return;
        finish(); options.error();
      };
      try { active.postMessage({ id, room, state }); }
      catch { if (current()) { finish(); options.error(); } }
    },
    destroy() { if (destroyed) return; destroyed = true; cancel(); }
  };
}

import { reduceM1State, replayM1Actions } from "./machine";
import type { M1Action, M1GameState } from "./types";

export const M1_SESSION_KEY = "family-games/hanzi-magic-v2/chapter-one/m1-session";

export interface M1SessionEnvelope {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly actions: readonly M1Action[];
}

export interface M1SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function writeM1Session(storage: M1SessionStorage, seed: string, actions: readonly M1Action[]): void {
  storage.setItem(M1_SESSION_KEY, JSON.stringify({ schemaVersion: 1, seed, actions } satisfies M1SessionEnvelope));
}

export function readM1Session(storage: M1SessionStorage): { state: M1GameState; actions: M1Action[] } | null {
  const raw = storage.getItem(M1_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<M1SessionEnvelope>;
    if (parsed.schemaVersion !== 1 || typeof parsed.seed !== "string" || !Array.isArray(parsed.actions) || parsed.actions.length > 500) return null;
    let state = replayM1Actions(parsed.seed, []);
    const actions: M1Action[] = [];
    for (const candidate of parsed.actions) {
      if (!candidate || typeof candidate !== "object" || typeof (candidate as { type?: unknown }).type !== "string") return null;
      const next = reduceM1State(state, candidate as M1Action);
      state = next;
      actions.push(candidate as M1Action);
    }
    return { state, actions };
  } catch {
    return null;
  }
}

export function clearM1Session(storage: M1SessionStorage): void {
  storage.removeItem(M1_SESSION_KEY);
}

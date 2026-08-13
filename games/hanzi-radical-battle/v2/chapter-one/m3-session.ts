import { replayM3Actions } from "./m3-machine";
import type { M3Action, M3GameState } from "./m3-types";
import type { M3HeroId } from "./builds";
import type { M1SessionStorage } from "./session";

export const M3_SESSION_KEY = "family-games/hanzi-magic-v2/chapter-one/m3-session";

export interface M3SessionEnvelope {
  readonly schemaVersion: 2;
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly actions: readonly M3Action[];
}

const HERO_IDS = new Set<M3HeroId>(["light-speaker", "forest-speaker", "ink-companion"]);

export function writeM3Session(storage: M1SessionStorage, seed: string, initialHeroId: M3HeroId, actions: readonly M3Action[]): void {
  storage.setItem(M3_SESSION_KEY, JSON.stringify({ schemaVersion: 2, seed, initialHeroId, actions } satisfies M3SessionEnvelope));
}

export function readM3Session(storage: M1SessionStorage): { state: M3GameState; actions: M3Action[]; initialHeroId: M3HeroId } | null {
  const raw = storage.getItem(M3_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<M3SessionEnvelope>;
    if (parsed.schemaVersion !== 2 || typeof parsed.seed !== "string" || !HERO_IDS.has(parsed.initialHeroId as M3HeroId) || !Array.isArray(parsed.actions) || parsed.actions.length > 750) return null;
    const actions = parsed.actions as M3Action[];
    if (actions.some((action) => !action || typeof action !== "object" || typeof (action as { type?: unknown }).type !== "string")) return null;
    const initialHeroId = parsed.initialHeroId as M3HeroId;
    return { state: replayM3Actions(parsed.seed, initialHeroId, actions), actions, initialHeroId };
  } catch {
    return null;
  }
}

export function clearM3Session(storage: M1SessionStorage): void { storage.removeItem(M3_SESSION_KEY); }

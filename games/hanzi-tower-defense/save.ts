import { CORE_ORDER, RECIPES } from "./content";
import { checkpointOf, newBattle, resumeCheckpoint, SLOTS, START_HEALTH, WAVES, type BattleState, type Checkpoint } from "./model";

export const SAVE_KEY = "family-games/hanzi-tower-defense/v1";
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface Preferences { muted: boolean; reducedMotion: boolean; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
export function validCheckpoint(value: unknown): value is Checkpoint {
  if (!object(value) || !integer(value.seed, 0, 0xffffffff) || !integer(value.wave, 0, WAVES.length)
    || !integer(value.health, 1, START_HEALTH) || !integer(value.nextCoreId, 1)
    || !integer(value.kills, 0) || !integer(value.leaks, 0) || typeof value.elapsed !== "number"
    || !Number.isFinite(value.elapsed) || value.elapsed < 0 || !Array.isArray(value.cores) || value.cores.length > 1000) return false;
  const ids = new Set<number>(), slots = new Set<number>();
  for (const item of value.cores) {
    if (!object(item) || !integer(item.id, 1, value.nextCoreId - 1) || ids.has(item.id)
      || !CORE_ORDER.some(kind => kind === item.kind) || typeof item.cooldown !== "number" || !Number.isFinite(item.cooldown) || item.cooldown < 0
      || (item.slot !== null && (!integer(item.slot, 0, SLOTS.length - 1) || slots.has(item.slot)))) return false;
    ids.add(item.id); if (item.slot !== null) slots.add(item.slot as number);
  }
  return true;
}

/** Mounted-session compare-and-set guard: other tabs, Vault restores and future/corrupt saves are never overwritten. */
export function openSave(storage: StorageLike, defaults: Preferences) {
  let raw: string | null = null, payload: Record<string, unknown> = {}, writable = true;
  let state = newBattle(), preferences = { ...defaults }, hasCheckpoint = false;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!object(parsed) || parsed.version !== 1 || !validCheckpoint(parsed.checkpoint)
        || !Array.isArray(parsed.unlocked) || parsed.unlocked.some(id => typeof id !== "string" || !RECIPES.some(r => r.id === id))
        || !object(parsed.preferences) || typeof parsed.preferences.muted !== "boolean" || typeof parsed.preferences.reducedMotion !== "boolean") throw new Error("Unrecognized save");
      payload = parsed; state = resumeCheckpoint(parsed.checkpoint, [...new Set(parsed.unlocked as string[])]);
      preferences = { muted: parsed.preferences.muted, reducedMotion: parsed.preferences.reducedMotion }; hasCheckpoint = true;
    }
  } catch { writable = false; }
  return {
    state, preferences, hasCheckpoint, get writable() { return writable; },
    write(current: BattleState, settings: Preferences): boolean {
      if (!writable) return false;
      try {
        if (storage.getItem(SAVE_KEY) !== raw) { writable = false; return false; }
        // Unfinished waves roll back both resources and rewards together. Discoveries are non-economic and stay unlocked.
        const checkpoint = current.phase === "ready" || current.phase === "won" ? checkpointOf(current) : current.checkpoint;
        const next = {
          ...payload, version: 1,
          checkpoint: { ...(object(payload.checkpoint) ? payload.checkpoint : {}), ...checkpoint },
          unlocked: [...current.unlocked], preferences: { ...(object(payload.preferences) ? payload.preferences : {}), ...settings },
        };
        const nextRaw = JSON.stringify(next); storage.setItem(SAVE_KEY, nextRaw); raw = nextRaw; payload = next; return true;
      } catch { writable = false; return false; }
    },
  };
}

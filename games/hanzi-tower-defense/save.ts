import { CORE_ORDER, RECIPES } from "./content";
import { checkpointOf, newBattle, resumeCheckpoint, SLOTS, START_HEALTH, WAVES, type BattleState, type Checkpoint } from "./model";
import { englishMapping, RESONANCES, type EnglishCore } from "./resonance";

export const LEGACY_SAVE_KEY = "family-games/hanzi-tower-defense/v1";
export const SAVE_KEY = "family-games/hanzi-tower-defense/v2";
export const SAVE_VERSION = 2;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface Preferences { muted: boolean; reducedMotion: boolean; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
function validLegacyCheckpoint(value: unknown): value is Omit<Checkpoint, "englishCores" | "englishClaims" | "englishSkipped" | "nextEnglishId"> {
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
export function validCheckpoint(value: unknown): value is Checkpoint {
  if (!validLegacyCheckpoint(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  if (!Array.isArray(v.englishCores) || v.englishCores.length > RESONANCES.length || !integer(v.nextEnglishId, 1, RESONANCES.length + 1)
    || !Array.isArray(v.englishClaims) || !Array.isArray(v.englishSkipped)) return false;
  for (const list of [v.englishClaims, v.englishSkipped]) if (new Set(list).size !== list.length || list.some(id => !RESONANCES.some(r => r.grantId === id))) return false;
  if (v.englishClaims.some(id => (v.englishSkipped as unknown[]).includes(id)) || v.englishClaims.length !== v.englishCores.length) return false;
  const ids = new Set<number>(), attached = new Set<number>(), grants = new Set<string>();
  for (const e of v.englishCores) {
    if (!object(e) || !integer(e.id, 1, v.nextEnglishId - 1) || ids.has(e.id)) return false;
    const mapping = englishMapping(e as unknown as EnglishCore);
    if (!mapping || grants.has(mapping.grantId) || !v.englishClaims.includes(mapping.grantId)) return false;
    if (e.attachedTo !== null && (!integer(e.attachedTo, 1) || attached.has(e.attachedTo) || !value.cores.some(c => c.id === e.attachedTo && c.kind === mapping.coreId))) return false;
    ids.add(e.id); grants.add(mapping.grantId); if (e.attachedTo !== null) attached.add(e.attachedTo as number);
  }
  return true;
}

function validPayload(parsed: unknown, version: number): parsed is Record<string, unknown> & { checkpoint: Checkpoint; unlocked: string[]; preferences: Preferences } {
  return object(parsed) && parsed.version === version && (version === 1 ? validLegacyCheckpoint(parsed.checkpoint) : validCheckpoint(parsed.checkpoint))
    && Array.isArray(parsed.unlocked) && parsed.unlocked.every(id => typeof id === "string" && RECIPES.some(r => r.id === id))
    && object(parsed.preferences) && typeof parsed.preferences.muted === "boolean" && typeof parsed.preferences.reducedMotion === "boolean";
}

/** Mounted-session compare-and-set guard: other tabs, Vault restores and future/corrupt saves are never overwritten. */
export function openSave(storage: StorageLike, defaults: Preferences) {
  let raw: string | null = null, payload: Record<string, unknown> = {}, writable = true;
  let state = newBattle(), preferences = { ...defaults }, hasCheckpoint = false;
  let migrated = false;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw === null) {
      const oldRaw = storage.getItem(LEGACY_SAVE_KEY);
      if (oldRaw !== null) {
        const old: unknown = JSON.parse(oldRaw);
        if (!validPayload(old, 1)) throw new Error("Unrecognized legacy save");
        // No reward backfill: grants belonging to already completed legacy waves remain skipped.
        const checkpoint = { ...old.checkpoint, englishCores: [], englishClaims: [],
          englishSkipped: RESONANCES.filter(r => r.dropWave < old.checkpoint.wave).map(r => r.grantId), nextEnglishId: 1 };
        const copy = { ...old, version: SAVE_VERSION, checkpoint };
        state=resumeCheckpoint(checkpoint,[...new Set(old.unlocked)]);preferences={...old.preferences};hasCheckpoint=true;
        if (storage.getItem(SAVE_KEY) !== null || storage.getItem(LEGACY_SAVE_KEY) !== oldRaw) throw new Error("Concurrent migration");
        raw = JSON.stringify(copy); storage.setItem(SAVE_KEY, raw); migrated = true;
      }
    }
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!validPayload(parsed, SAVE_VERSION)) throw new Error("Unrecognized save");
      payload = parsed; state = resumeCheckpoint(parsed.checkpoint, [...new Set(parsed.unlocked as string[])]);
      preferences = { muted: parsed.preferences.muted, reducedMotion: parsed.preferences.reducedMotion }; hasCheckpoint = true;
    }
  } catch { writable = false; }
  return {
    state, preferences, hasCheckpoint, migrated, get writable() { return writable; },
    write(current: BattleState, settings: Preferences): boolean {
      if (!writable) return false;
      try {
        if (storage.getItem(SAVE_KEY) !== raw) { writable = false; return false; }
        // Unfinished waves roll back both resources and rewards together. Discoveries are non-economic and stay unlocked.
        const checkpoint = current.phase === "ready" || current.phase === "won" ? checkpointOf(current) : current.checkpoint;
        if (!validCheckpoint(checkpoint)) { writable = false; return false; }
        const next = {
          ...payload, version: SAVE_VERSION,
          checkpoint: { ...(object(payload.checkpoint) ? payload.checkpoint : {}), ...checkpoint },
          unlocked: [...current.unlocked], preferences: { ...(object(payload.preferences) ? payload.preferences : {}), ...settings },
        };
        const nextRaw = JSON.stringify(next); storage.setItem(SAVE_KEY, nextRaw); raw = nextRaw; payload = next; return true;
      } catch { writable = false; return false; }
    },
  };
}

import { HANZI_MAGIC_M4_V1_RAW_KEY, clearM4Save } from "../../v2/chapter-one/m4-save";
import { clearM3Session } from "../../v2/chapter-one/m3-session";
import { M1_SESSION_KEY } from "../../v2/chapter-one/session";
import { clearV1Save } from "../../v2/v1/save";
import { clearWheelWorkshopSave } from "../../v2/wheel-workshop/save/wheel-save";
import type { CompleteEngineProgressSeed, CompleteEngineState } from "../core/complete-types";
import type { CompleteEpisodeId } from "../core/world-contracts";
import {
  COMPLETE_SAVE_ALLOWED_IDS,
  HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES,
  HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION,
  createFreshCompleteSave,
  migrateCompleteContentRevision,
  type CompleteCharacterProvenance,
  type CompleteSaveState,
  validateCompleteSave,
  validateCompleteSaveDetailed,
  withCompleteSaveChecksum,
  hasUnknownChapterTwoRuleset,
} from "./complete-save-schema";
import { CHAPTER_TWO_R2_RULESET } from "../chapters/chapter-two/chapter-two-r2";
import {
  COMPLETE_LEGACY_SAVE_KEYS,
  HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS,
  hasSameCompleteSavePayload,
  mergeCompleteLegacyProgress,
  migrateCompleteSliceV1,
  type CompleteStorageLike,
} from "./legacy-migrations";

export interface CompleteSaveReadResult {
  readonly state: CompleteSaveState;
  readonly source: "fresh" | "v3" | "v3-backup" | "slice-v1-migrated" | "v1-migrated" | "v2-migrated" | "wheel-migrated" | "legacy-merged" | "content-migrated" | "future-read-only" | "storage-unavailable";
  readonly recovered: boolean;
  readonly recoveryReason: "NONE" | "MALFORMED_JSON" | "INVALID_SHAPE" | "CHECKSUM_MISMATCH";
  readonly futureVersionProtected: boolean;
  readonly writable: boolean;
}

interface SaveLineage { storage: CompleteStorageLike; expectedRaw: string | null; writable: boolean }
const saveLineage = new WeakMap<CompleteSaveState, SaveLineage>();
function bindSave(state: CompleteSaveState, storage: CompleteStorageLike, expectedRaw: string | null, writable: boolean): CompleteSaveState {
  saveLineage.set(state, { storage, expectedRaw, writable }); return state;
}
export function isCompleteSaveWritable(state: CompleteSaveState): boolean { return saveLineage.get(state)?.writable ?? true; }
export function isCompleteSaveCurrent(storage: CompleteStorageLike, state: CompleteSaveState): boolean {
  const lineage = saveLineage.get(state);
  if (!lineage || !lineage.writable || lineage.storage !== storage) return false;
  try { if (storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY) === lineage.expectedRaw) return true; } catch { /* Refuse mutation when reads are denied. */ }
  lineage.writable = false; return false;
}

/** Do not probe with extra keys or pretend an unavailable browser store is durable. */
export function completeBrowserStorage(): CompleteStorageLike {
  try { return window.localStorage; } catch {
    const unavailable = () => { throw new Error("COMPLETE_STORAGE_UNAVAILABLE"); };
    return { getItem: unavailable, setItem: unavailable, removeItem: unavailable };
  }
}

function captureRecovery(storage: CompleteStorageLike, raw: string, reason: string): void {
  try { storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY, JSON.stringify({ schemaVersion: 1, reason, raw })); } catch { /* Primary bytes remain untouched; recovery is read-only. */ }
}

function readBackup(storage: CompleteStorageLike): CompleteSaveState | null {
  const raw = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY);
  if (!raw) return null;
  try { return validateCompleteSave(JSON.parse(raw)); } catch { return null; }
}

function migrationSource(state: CompleteSaveState, fallback: CompleteSaveReadResult["source"]): CompleteSaveReadResult["source"] {
  if (fallback !== "fresh" && fallback !== "v3") return fallback;
  const legacy = state.migration.sources.filter((source) => source !== "content-revision");
  if (legacy.length === 0) return fallback;
  if (legacy.length > 1 || fallback === "v3") return "legacy-merged";
  return legacy[0] === "slice-v1" ? "slice-v1-migrated" : legacy[0] === "v1" ? "v1-migrated" : legacy[0] === "v2" ? "v2-migrated" : "wheel-migrated";
}

export function readCompleteSave(storage: CompleteStorageLike): CompleteSaveReadResult {
  try {
    const result = readCompleteSaveAvailable(storage);
    // Successful migration writes may already have advanced this identity.
    if (!saveLineage.has(result.state)) bindSave(result.state, storage, storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY), result.writable);
    return { ...result, writable: isCompleteSaveWritable(result.state) };
  } catch {
    return { state: bindSave(createFreshCompleteSave(), storage, null, false), source: "storage-unavailable", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: false };
  }
}

function readCompleteSaveAvailable(storage: CompleteStorageLike): CompleteSaveReadResult {
  const raw = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
  let state = createFreshCompleteSave();
  let source: CompleteSaveReadResult["source"] = "fresh";
  let recovered = false;
  let recoveryReason: CompleteSaveReadResult["recoveryReason"] = "NONE";
  let normalizedPrimary = false;

  if (raw !== null) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      captureRecovery(storage, raw, "MALFORMED_JSON");
      const backup = readBackup(storage);
      state = backup ?? state;
      source = backup ? "v3-backup" : "fresh";
      recovered = true;
      recoveryReason = "MALFORMED_JSON";
      parsed = null;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const schemaVersion = Number((parsed as Record<string, unknown>).schemaVersion);
      if ((Number.isFinite(schemaVersion) && schemaVersion > HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION) || hasUnknownChapterTwoRuleset((parsed as Record<string, unknown>).chapterTwoReplay)) {
        return { state: bindSave(state, storage, raw, false), source: "future-read-only", recovered: false, recoveryReason: "NONE", futureVersionProtected: true, writable: false };
      }
      if (schemaVersion === 1 && (parsed as Record<string, unknown>).gameVersion === "3.0.0-slices") {
        const migrated = migrateCompleteSliceV1(storage, raw, state);
        if (migrated) { state = migrated; source = "slice-v1-migrated"; }
        else {
          captureRecovery(storage, raw, "INVALID_SHAPE");
          const backup = readBackup(storage);
          state = backup ?? state;
          source = backup ? "v3-backup" : "fresh";
          recovered = true;
          recoveryReason = "INVALID_SHAPE";
        }
      } else if (schemaVersion === HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION) {
        const checked = validateCompleteSaveDetailed(parsed, true);
        if (checked.state) {
          if (checked.state.contentRevisionHash !== createFreshCompleteSave().contentRevisionHash) {
            if (storage.getItem(HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY) === null) storage.setItem(HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY, raw);
            if (storage.getItem(HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY) === raw) {
              state = migrateCompleteContentRevision(checked.state);
              source = "content-migrated";
            }
          } else { state = checked.state; source = "v3"; normalizedPrimary = JSON.stringify(checked.state) !== JSON.stringify(parsed); }
        } else {
          captureRecovery(storage, raw, checked.reason ?? "INVALID_SHAPE");
          const backup = readBackup(storage);
          state = backup ?? state;
          source = backup ? "v3-backup" : "fresh";
          recovered = true;
          recoveryReason = checked.reason ?? "INVALID_SHAPE";
        }
      } else {
        captureRecovery(storage, raw, "INVALID_SHAPE");
        const backup = readBackup(storage);
        state = backup ?? state;
        source = backup ? "v3-backup" : "fresh";
        recovered = true;
        recoveryReason = "INVALID_SHAPE";
      }
    } else if (!recovered) {
      captureRecovery(storage, raw, "INVALID_SHAPE");
      const backup = readBackup(storage); state = backup ?? state; source = backup ? "v3-backup" : "fresh";
      recovered = true; recoveryReason = "INVALID_SHAPE";
    }
  }

  if (recovered) return { state: bindSave(state, storage, raw, false), source, recovered, recoveryReason, futureVersionProtected: false, writable: false };

  const merged = mergeCompleteLegacyProgress(storage, state);
  const changed = !hasSameCompleteSavePayload(state, merged);
  state = merged;
  source = migrationSource(state, source);
  bindSave(state, storage, raw, true);
  if (changed || normalizedPrimary || source === "content-migrated" || source.endsWith("-migrated")) writeCompleteSave(storage, state);
  return { state, source, recovered, recoveryReason, futureVersionProtected: false, writable: true };
}

export function writeCompleteSave(storage: CompleteStorageLike, state: CompleteSaveState, writable = true): boolean {
  if (!writable) throw new Error("FUTURE_VERSION_SAVE_IS_READ_ONLY");
  const checked = validateCompleteSave(state);
  if (!checked) throw new Error("Refusing to write invalid Hanzi Magic Complete save");
  const serialized = JSON.stringify(checked);
  const lineage = saveLineage.get(state);
  if (new TextEncoder().encode(serialized).byteLength >= HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES) {
    bindSave(state, storage, lineage?.expectedRaw ?? null, false); return false;
  }
  if (lineage && (!lineage.writable || lineage.storage !== storage)) return false;
  try {
    const previous = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
    if ((lineage && previous !== lineage.expectedRaw) || (!lineage && previous !== null)) {
      bindSave(state, storage, lineage?.expectedRaw ?? previous, false); return false;
    }
    if (previous !== null) {
      let previousSave: CompleteSaveState | null = null;
      try { previousSave = validateCompleteSave(JSON.parse(previous)); } catch { /* A validated migration may start from schema 1. */ }
      if (previousSave) storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, previous);
    }
    // A replacement arriving while backup was written must also win.
    if (storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY) !== previous) { bindSave(state, storage, previous, false); return false; }
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, serialized);
    const saved = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY) === serialized;
    bindSave(state, storage, serialized, saved); return saved;
  } catch {
    bindSave(state, storage, lineage?.expectedRaw ?? null, false); return false;
  }
}

export function updateCompleteSave(
  previous: CompleteSaveState,
  patch: Partial<Omit<CompleteSaveState, "schemaVersion" | "gameVersion" | "contentRevisionHash" | "validation" | "privacy">>,
): CompleteSaveState {
  const { validation: _validation, ...payload } = previous;
  const next = withCompleteSaveChecksum({ ...payload, ...patch });
  const lineage = saveLineage.get(previous);
  if (lineage) saveLineage.set(next, { ...lineage });
  return next;
}

export function restartChapterTwoSave(previous: CompleteSaveState, seed: string): CompleteSaveState {
  const old = previous.chapterTwoReplay;
  const { priorRuns = [], ...record } = old ?? { seed, initialHeroId: previous.selectedHeroId, actions: [] };
  const next = updateCompleteSave(previous, {
    chapterTwoReplay: { seed, initialHeroId: previous.selectedHeroId, ruleset: CHAPTER_TWO_R2_RULESET, actions: [], ...(old ? { priorRuns: [...priorRuns, record] } : {}) },
    activeResume: { screen: "world", chapterId: "chapter-two", episodeId: null, phase: "world", seed, actionCount: 0 },
  });
  // Refuse a full archive; never discard an earlier run to make room.
  if (!validateCompleteSave(next) || new TextEncoder().encode(JSON.stringify(next)).byteLength >= HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES) throw new Error("CHAPTER_TWO_REPLAY_ARCHIVE_FULL");
  return next;
}

export function progressSeedFromCompleteSave(save: CompleteSaveState): CompleteEngineProgressSeed {
  return {
    selectedHeroId: save.selectedHeroId,
    activeChapterId: save.activeResume.chapterId,
    unlockedChapterIds: save.unlockedChapterIds,
    completedChapterIds: save.completedChapterIds,
    completedEpisodeIds: save.completedEpisodeIds,
    discoveredCharacterIds: save.discoveredCharacterIds,
    discoveredFamilyIds: save.discoveredFamilyIds,
    discoveredWordIds: save.discoveredWordIds,
    repairedObjectIds: save.repairedObjectIds,
    selectedAbilityIds: save.selectedAbilityIds,
    triggeredAbilityIds: save.triggeredAbilityIds,
    completedBehaviorIds: save.completedBehaviorIds,
    completedBossIds: save.completedBossIds,
    chapterOneReplay: save.chapterOneReplay,
    chapterTwoReplay: save.chapterTwoReplay,
    chapterThreeReplay: save.chapterThreeReplay,
    postgameReplay: save.postgameResume ? {
      seed: save.postgameResume.seed,
      initialHeroId: save.postgameResume.initialHeroId,
      mode: save.postgameResume.mode,
      band: save.postgameResume.band,
      actions: save.postgameResume.actions,
    } : null,
  };
}

function completeEpisodeForEngine(state: CompleteEngineState): CompleteEpisodeId | null {
  if (state.screen === "chapter-three" && state.chapterThreeRun) return `chapter-three:${["home-lantern-town", "myriad-book-harbor", "star-map-peak", "word-heart-core"][state.chapterThreeRun.state.episodeIndex]}` as CompleteEpisodeId;
  if (state.screen === "chapter-two" && state.chapterTwoRun) return `chapter-two:${["wood-voice-canopy", "spring-stone-valley", "door-shadow-corridor", "component-root-core"][state.chapterTwoRun.state.episodeIndex]}` as CompleteEpisodeId;
  if (state.screen !== "chapter-one" || !state.chapterOneRun) return null;
  if (state.chapterOneRun.state.chapterStage === "final-core" || state.chapterOneRun.state.chapterStage === "ending" || state.chapterOneRun.state.chapterStage === "complete") return "chapter-one:ink-king-core";
  const region = state.chapterOneRun.state.plan.regions[state.chapterOneRun.state.regionIndex]?.regionId;
  const candidate = `chapter-one:${region}` as CompleteEpisodeId;
  return COMPLETE_SAVE_ALLOWED_IDS.EPISODE_IDS.has(candidate) ? candidate : null;
}

function mergeV3Provenance(previous: readonly CompleteCharacterProvenance[], characterIds: readonly string[]): CompleteCharacterProvenance[] {
  const map = new Map(previous.map((record) => [record.characterId, [...record.sources]]));
  for (const id of characterIds) map.set(id, [...new Set([...(map.get(id) ?? []), "v3" as const])]);
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([characterId, sources]) => ({ characterId, sources }));
}

export function syncCompleteSaveFromEngine(previous: CompleteSaveState, state: CompleteEngineState, nowUtc = new Date().toISOString()): CompleteSaveState {
  if (Number.isNaN(Date.parse(nowUtc))) throw new Error("syncCompleteSaveFromEngine requires an ISO timestamp");
  const newCharacterIds = state.discoveredCharacterIds.filter((id) => !previous.discoveredCharacterIds.includes(id));
  const newFamilyIds = state.discoveredFamilyIds.filter((id) => !previous.discoveredFamilyIds.includes(id));
  const newWordIds = state.discoveredWordIds.filter((id) => !previous.discoveredWordIds.includes(id));
  const nextEligibleAt = new Date(Date.parse(nowUtc) + 24 * 60 * 60 * 1000).toISOString();
  const newReviewRecords = [...newCharacterIds, ...newFamilyIds, ...newWordIds].map((recordId) => ({ recordId, state: "independent" as const, lastEncounteredAt: nowUtc, nextEligibleAt }));
  const chapterOneReplay = state.chapterOneRun ? { seed: state.chapterOneRun.seed, initialHeroId: state.chapterOneRun.initialHeroId, mode: state.chapterOneRun.mode, actions: state.chapterOneRun.actions } : previous.chapterOneReplay;
  const chapterTwoReplay = state.chapterTwoRun ? { seed: state.chapterTwoRun.seed, initialHeroId: state.chapterTwoRun.initialHeroId, actions: state.chapterTwoRun.actions, ...(state.chapterTwoRun.ruleset ? { ruleset: state.chapterTwoRun.ruleset } : {}), ...(previous.chapterTwoReplay?.priorRuns ? { priorRuns: previous.chapterTwoReplay.priorRuns } : {}) } : previous.chapterTwoReplay;
  const chapterThreeReplay = state.chapterThreeRun ? { seed: state.chapterThreeRun.seed, initialHeroId: state.chapterThreeRun.initialHeroId, actions: state.chapterThreeRun.actions } : previous.chapterThreeReplay;
  const postgameResume = state.postgameRun ? {
    mode: state.postgameRun.mode,
    seed: state.postgameRun.seed,
    initialHeroId: state.postgameRun.initialHeroId,
    band: state.postgameRun.band,
    phase: state.postgameRun.state.phase,
    actionCount: state.postgameRun.state.actionCount,
    actions: state.postgameRun.actions,
  } : previous.postgameResume;
  const resumeActionCount = state.screen === "chapter-one" && state.chapterOneRun
    ? state.chapterOneRun.state.actionCount
    : state.screen === "chapter-two" && state.chapterTwoRun
      ? state.chapterTwoRun.state.actionCount
      : state.screen === "chapter-three" && state.chapterThreeRun
        ? state.chapterThreeRun.state.actionCount
        : state.screen === "postgame" && state.postgameRun
          ? state.postgameRun.state.actionCount
          : state.actionCount;
  const completedNewPostgameSession = state.postgameRun?.state.phase === "session-summary" && previous.postgameResume?.phase !== "session-summary";
  return updateCompleteSave(previous, {
    selectedHeroId: state.heroId,
    activeResume: {
      screen: state.screen,
      chapterId: state.activeChapterId,
      episodeId: completeEpisodeForEngine(state),
      phase: state.screen === "chapter-one" && state.chapterOneRun ? state.chapterOneRun.state.phase : state.screen === "chapter-two" && state.chapterTwoRun ? state.chapterTwoRun.state.phase : state.screen === "chapter-three" && state.chapterThreeRun ? state.chapterThreeRun.state.phase : state.screen === "postgame" && state.postgameRun ? state.postgameRun.state.phase : state.screen,
      seed: state.seed,
      actionCount: resumeActionCount,
    },
    postgameResume,
    chapterOneReplay,
    chapterTwoReplay,
    chapterThreeReplay,
    unlockedChapterIds: state.unlockedChapterIds,
    completedChapterIds: state.completedChapterIds,
    completedEpisodeIds: state.completedEpisodeIds,
    discoveredCharacterIds: state.discoveredCharacterIds,
    discoveredFamilyIds: state.discoveredFamilyIds,
    discoveredWordIds: state.discoveredWordIds,
    repairedObjectIds: state.repairedObjectIds,
    selectedAbilityIds: state.selectedAbilityIds,
    triggeredAbilityIds: state.triggeredAbilityIds,
    completedBehaviorIds: state.completedBehaviorIds,
    completedBossIds: state.completedBossIds,
    reviewRecords: [...previous.reviewRecords.filter((record) => !newReviewRecords.some((candidate) => candidate.recordId === record.recordId)), ...newReviewRecords],
    minimalLocalEvents: {
      completedLiteracyActions: previous.minimalLocalEvents.completedLiteracyActions + newCharacterIds.length + newFamilyIds.length + newWordIds.length,
      completedEpisodes: Math.max(previous.minimalLocalEvents.completedEpisodes, state.completedEpisodeIds.length),
      completedChapters: Math.max(previous.minimalLocalEvents.completedChapters, state.completedChapterIds.length),
      postgameSessions: previous.minimalLocalEvents.postgameSessions + (completedNewPostgameSession ? 1 : 0),
      lastPlayedAtUtc: nowUtc,
    },
    migration: {
      ...previous.migration,
      characterProvenance: mergeV3Provenance(previous.migration.characterProvenance, newCharacterIds),
    },
  });
}

export function clearCompleteSave(storage: CompleteStorageLike): void {
  for (const key of [HANZI_MAGIC_COMPLETE_SAVE_KEY, HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY, HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY, ...Object.values(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS)]) storage.removeItem(key);
}

export function clearAllHanziProgress(storage: CompleteStorageLike, parentConfirmed: boolean): boolean {
  if (!parentConfirmed) return false;
  clearCompleteSave(storage);
  clearV1Save(storage);
  clearM4Save(storage);
  clearM3Session(storage);
  clearWheelWorkshopSave(storage);
  storage.removeItem(M1_SESSION_KEY);
  storage.removeItem(HANZI_MAGIC_M4_V1_RAW_KEY);
  for (const key of COMPLETE_LEGACY_SAVE_KEYS) storage.removeItem(key);
  return true;
}

export type { CompleteStorageLike } from "./legacy-migrations";
export * from "./complete-save-schema";

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
} from "./complete-save-schema";
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
  readonly source: "fresh" | "v3" | "v3-backup" | "slice-v1-migrated" | "v1-migrated" | "v2-migrated" | "wheel-migrated" | "legacy-merged" | "content-migrated" | "future-read-only";
  readonly recovered: boolean;
  readonly recoveryReason: "NONE" | "MALFORMED_JSON" | "INVALID_SHAPE" | "CHECKSUM_MISMATCH";
  readonly futureVersionProtected: boolean;
  readonly writable: boolean;
}

function captureRecovery(storage: CompleteStorageLike, raw: string, reason: string): void {
  storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY, JSON.stringify({ schemaVersion: 1, reason, raw }));
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
      if (Number.isFinite(schemaVersion) && schemaVersion > HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION) {
        return { state, source: "future-read-only", recovered: false, recoveryReason: "NONE", futureVersionProtected: true, writable: false };
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
    }
  }

  const merged = mergeCompleteLegacyProgress(storage, state);
  const changed = !hasSameCompleteSavePayload(state, merged);
  state = merged;
  source = migrationSource(state, source);
  if (changed || normalizedPrimary || source === "content-migrated" || source.endsWith("-migrated") || recovered) writeCompleteSave(storage, state);
  return { state, source, recovered, recoveryReason, futureVersionProtected: false, writable: true };
}

export function writeCompleteSave(storage: CompleteStorageLike, state: CompleteSaveState, writable = true): void {
  if (!writable) throw new Error("FUTURE_VERSION_SAVE_IS_READ_ONLY");
  const checked = validateCompleteSave(state);
  if (!checked) throw new Error("Refusing to write invalid Hanzi Magic Complete save");
  const serialized = JSON.stringify(checked);
  if (new TextEncoder().encode(serialized).byteLength >= HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES) throw new Error("HANZI_MAGIC_COMPLETE_SAVE_EXCEEDS_500_KIB");
  const previous = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
  if (previous !== null) {
    try { if (validateCompleteSave(JSON.parse(previous))) storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, previous); } catch { /* corrupt raw is already captured before recovery */ }
  }
  storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, serialized);
}

export function updateCompleteSave(
  previous: CompleteSaveState,
  patch: Partial<Omit<CompleteSaveState, "schemaVersion" | "gameVersion" | "contentRevisionHash" | "validation" | "privacy">>,
): CompleteSaveState {
  const { validation: _validation, ...payload } = previous;
  return withCompleteSaveChecksum({ ...payload, ...patch });
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
  const chapterTwoReplay = state.chapterTwoRun ? { seed: state.chapterTwoRun.seed, initialHeroId: state.chapterTwoRun.initialHeroId, actions: state.chapterTwoRun.actions } : previous.chapterTwoReplay;
  const chapterThreeReplay = state.chapterThreeRun ? { seed: state.chapterThreeRun.seed, initialHeroId: state.chapterThreeRun.initialHeroId, actions: state.chapterThreeRun.actions } : previous.chapterThreeReplay;
  const resumeActionCount = state.screen === "chapter-one" && state.chapterOneRun
    ? state.chapterOneRun.state.actionCount
    : state.screen === "chapter-two" && state.chapterTwoRun
      ? state.chapterTwoRun.state.actionCount
      : state.screen === "chapter-three" && state.chapterThreeRun
        ? state.chapterThreeRun.state.actionCount
        : state.actionCount;
  return updateCompleteSave(previous, {
    selectedHeroId: state.heroId,
    activeResume: {
      screen: state.screen,
      chapterId: state.activeChapterId,
      episodeId: completeEpisodeForEngine(state),
      phase: state.screen === "chapter-one" && state.chapterOneRun ? state.chapterOneRun.state.phase : state.screen === "chapter-two" && state.chapterTwoRun ? state.chapterTwoRun.state.phase : state.screen === "chapter-three" && state.chapterThreeRun ? state.chapterThreeRun.state.phase : state.screen,
      seed: state.seed,
      actionCount: resumeActionCount,
    },
    postgameResume: state.screen === "postgame" && state.activePostgameMode ? { mode: state.activePostgameMode, seed: state.seed, phase: "active", actionCount: state.actionCount } : previous.postgameResume,
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
      postgameSessions: previous.minimalLocalEvents.postgameSessions,
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

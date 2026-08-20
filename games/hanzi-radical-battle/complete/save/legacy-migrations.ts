import { CHAPTER_ONE_CHARACTERS } from "../../v2/chapter-one/characters";
import { HANZI_MAGIC_M4_SAVE_KEY, HANZI_MAGIC_M4_V1_RAW_KEY, validateM4Save } from "../../v2/chapter-one/m4-save";
import { M3_SESSION_KEY, readM3Session } from "../../v2/chapter-one/m3-session";
import { HANZI_MAGIC_V1_SAVE_KEY, validateV1Save } from "../../v2/v1/save";
import { PLAYABLE_WHEEL_MANIFEST } from "../../v2/wheel-workshop/library/playable-wheel-manifest";
import { WHEEL_WORKSHOP_SAVE_KEY, validateWheelWorkshopSave } from "../../v2/wheel-workshop/save/wheel-save";
import { completeCharacterId } from "../content-graph/ids";
import { COMPLETE_SLICE_FAMILIES, COMPLETE_SLICE_WORDS } from "../content-graph/slice-content";
import { isCompleteSliceAction, replayCompleteSliceActions } from "../core/slice-machine";
import {
  COMPLETE_SAVE_ALLOWED_IDS,
  HANZI_MAGIC_COMPLETE_SAVE_KEY,
  type CompleteCharacterProvenance,
  type CompleteMigrationSource,
  type CompleteProvenanceSource,
  type CompleteSaveState,
  withCompleteSaveChecksum,
} from "./complete-save-schema";

export interface CompleteStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS = {
  sliceV1: `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-slice-v1-raw`,
  v1: `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-v1-raw`,
  v2: `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-v2-raw`,
  v2Session: `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-v2-session-raw`,
  wheel: `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-wheel-raw`,
} as const;

const legacyCharacterById = new Map(CHAPTER_ONE_CHARACTERS.map((character) => [character.id, character]));

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function legacyCharacterIds(ids: readonly string[]): string[] {
  return unique(ids.map((id) => legacyCharacterById.get(id)).filter((character) => character !== undefined).map((character) => completeCharacterId(character.glyph)));
}

function preserveRaw(storage: CompleteStorageLike, key: string, raw: string): boolean {
  if (storage.getItem(key) === null) storage.setItem(key, raw);
  return storage.getItem(key) === raw;
}

function mergeCharacterProvenance(
  previous: readonly CompleteCharacterProvenance[],
  characterIds: readonly string[],
  source: CompleteProvenanceSource,
): CompleteCharacterProvenance[] {
  const map = new Map(previous.map((record) => [record.characterId, [...record.sources]]));
  for (const characterId of characterIds) map.set(characterId, unique([...(map.get(characterId) ?? []), source]));
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([characterId, sources]) => ({ characterId, sources }));
}

function withMigration(
  state: CompleteSaveState,
  source: CompleteMigrationSource,
  rawFlag: keyof CompleteSaveState["migration"]["rawPreserved"],
  characterIds: readonly string[],
  provenanceSource: CompleteProvenanceSource,
): CompleteSaveState {
  const { validation: _validation, ...payload } = state;
  return withCompleteSaveChecksum({
    ...payload,
    migration: {
      ...state.migration,
      sources: unique([...state.migration.sources, source]),
      rawPreserved: { ...state.migration.rawPreserved, [rawFlag]: true },
      characterProvenance: mergeCharacterProvenance(state.migration.characterProvenance, characterIds, provenanceSource),
    },
  });
}

export function migrateCompleteSliceV1(storage: CompleteStorageLike, raw: string, base: CompleteSaveState): CompleteSaveState | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const slice = parsed as Record<string, unknown>;
  if (slice.schemaVersion !== 1 || slice.gameVersion !== "3.0.0-slices" || !slice.sessions || typeof slice.sessions !== "object" || Array.isArray(slice.sessions)) return null;
  const sessions = slice.sessions as Record<string, unknown>;
  if (!Array.isArray(sessions.family) || !Array.isArray(sessions.word) || sessions.family.length > 256 || sessions.word.length > 256 || !sessions.family.every(isCompleteSliceAction) || !sessions.word.every(isCompleteSliceAction)) return null;
  let familyState;
  let wordState;
  try {
    familyState = replayCompleteSliceActions("family", sessions.family);
    wordState = replayCompleteSliceActions("word", sessions.word);
  } catch { return null; }
  const discoveredCharacterIds = unique([...base.discoveredCharacterIds, ...familyState.discoveredCharacterIds, ...wordState.discoveredCharacterIds]);
  const familyComplete = familyState.phase === "complete" || familyState.repairedObjectIds.includes("component-root-heart");
  const wordComplete = wordState.phase === "complete" || wordState.repairedObjectIds.includes("word-heart");
  const preferences = slice.preferences && typeof slice.preferences === "object" && !Array.isArray(slice.preferences) ? slice.preferences as Record<string, unknown> : {};
  const { validation: _validation, ...payload } = base;
  let migrated = withCompleteSaveChecksum({
    ...payload,
    settings: {
      muted: typeof preferences.muted === "boolean" ? preferences.muted : base.settings.muted,
      reducedMotion: typeof preferences.reducedMotion === "boolean" ? preferences.reducedMotion : base.settings.reducedMotion,
      inputMode: ["auto", "mouse", "touch", "keyboard"].includes(String(preferences.inputMode)) ? preferences.inputMode as CompleteSaveState["settings"]["inputMode"] : base.settings.inputMode,
    },
    discoveredCharacterIds,
    discoveredFamilyIds: familyComplete ? unique([...base.discoveredFamilyIds, COMPLETE_SLICE_FAMILIES[0].id]) : base.discoveredFamilyIds,
    discoveredWordIds: wordComplete ? unique([...base.discoveredWordIds, ...COMPLETE_SLICE_WORDS.map((word) => word.id)]) : base.discoveredWordIds,
    repairedObjectIds: unique([...base.repairedObjectIds, ...familyState.repairedObjectIds, ...wordState.repairedObjectIds]),
  });
  if (!preserveRaw(storage, HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.sliceV1, raw)) return null;
  migrated = withMigration(migrated, "slice-v1", "sliceV1", discoveredCharacterIds, "v3");
  return migrated;
}

function mergeV1(storage: CompleteStorageLike, state: CompleteSaveState): CompleteSaveState {
  const raw = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY);
  if (raw === null) return state;
  const preserved = preserveRaw(storage, HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v1, raw);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return state; }
  const v1 = validateV1Save(parsed);
  if (!v1 || !preserved) return state;
  const characters = legacyCharacterIds(v1.discoveredCharacterIds);
  const episodes = v1.completedAdventureIds.map((id) => `chapter-one:${id === "glimmer-path" ? "glimmer-grove" : id === "garden-echo" ? "echo-garden" : "wind-trail"}`);
  const { validation: _validation, ...payload } = state;
  const merged = withCompleteSaveChecksum({
    ...payload,
    settings: {
      muted: state.settings.muted || v1.settings.muted,
      reducedMotion: state.settings.reducedMotion || v1.settings.reducedMotion,
      inputMode: state.settings.inputMode === "auto" ? v1.settings.inputMode : state.settings.inputMode,
    },
    discoveredCharacterIds: unique([...state.discoveredCharacterIds, ...characters]),
    completedEpisodeIds: unique([...state.completedEpisodeIds, ...episodes]),
    repairedObjectIds: unique([...state.repairedObjectIds, ...["camp-lamp", "garden-path", "world-gate"].slice(0, v1.campRepairStage)]),
  });
  return withMigration(merged, "v1", "v1", characters, "v1");
}

function mergeV2(storage: CompleteStorageLike, state: CompleteSaveState): CompleteSaveState {
  const raw = storage.getItem(HANZI_MAGIC_M4_SAVE_KEY);
  const sessionRaw = storage.getItem(M3_SESSION_KEY);
  if (raw === null && sessionRaw === null) return state;
  const rawPreserved = raw === null || preserveRaw(storage, HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v2, raw);
  const sessionPreserved = sessionRaw === null || preserveRaw(storage, HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v2Session, sessionRaw);
  let v2 = null;
  if (raw !== null) {
    try { v2 = validateM4Save(JSON.parse(raw)); } catch { v2 = null; }
  }
  const session = readM3Session(storage);
  if ((!v2 && !session) || !rawPreserved || !sessionPreserved) return state;
  const v2CharacterIds = v2 ? legacyCharacterIds(v2.discoveredCharacterIds) : [];
  const sessionCharacterIds = session ? legacyCharacterIds(session.state.discoveredCharacterIds) : [];
  const characters = unique([...v2CharacterIds, ...sessionCharacterIds]);
  const regions = v2?.completedRegionIds ?? [];
  const episodes = regions.map((region) => `chapter-one:${region}`);
  const sessionComplete = session?.state.phase === "run-summary" && session.state.chapterStage === "complete";
  const v2Complete = sessionComplete || v2?.repairedObjectIds.includes("stargazing-platform") === true;
  if (v2Complete) episodes.push("chapter-one:ink-king-core");
  const repairs = unique([...state.repairedObjectIds, ...(v2?.repairedObjectIds ?? []), ...(sessionComplete ? ["camp-lamp", "garden-path", "world-gate", "magic-tree", "little-bridge", "spellbook-house", "ink-companion-house", "stargazing-platform"] : [])]);
  const selectedAbilities = unique([...state.selectedAbilityIds, ...(v2?.seenAbilityIds ?? []), ...(session?.state.selectedAbilityIds ?? [])]);
  const { validation: _validation, ...payload } = state;
  let merged = withCompleteSaveChecksum({
    ...payload,
    selectedHeroId: session?.state.heroId ?? v2?.selectedHeroId ?? state.selectedHeroId,
    settings: v2 ? {
      muted: state.settings.muted || v2.settings.muted,
      reducedMotion: state.settings.reducedMotion || v2.settings.reducedMotion,
      inputMode: state.settings.inputMode === "auto" ? v2.settings.inputMode : state.settings.inputMode,
    } : state.settings,
    activeResume: v2Complete ? { ...state.activeResume, screen: "world", chapterId: "chapter-two", phase: "world" } : state.activeResume,
    chapterOneReplay: session ? { seed: session.state.seed, initialHeroId: session.initialHeroId, mode: session.state.mode, actions: session.actions } : state.chapterOneReplay,
    unlockedChapterIds: v2Complete ? unique([...state.unlockedChapterIds, "chapter-two"]) : state.unlockedChapterIds,
    completedChapterIds: v2Complete ? unique([...state.completedChapterIds, "chapter-one"]) : state.completedChapterIds,
    completedEpisodeIds: unique([...state.completedEpisodeIds, ...episodes]),
    discoveredCharacterIds: unique([...state.discoveredCharacterIds, ...characters]),
    repairedObjectIds: repairs,
    selectedAbilityIds: selectedAbilities,
    triggeredAbilityIds: unique([...state.triggeredAbilityIds, ...(session?.state.triggeredAbilityIds ?? [])]),
    completedBehaviorIds: unique([...state.completedBehaviorIds, ...(session?.state.completedBehaviorCycles ?? [])]),
    completedBossIds: unique([...state.completedBossIds, ...(session?.state.completedBossIds ?? [])]),
  });
  merged = withMigration(merged, "v2", "v2", characters, "v2");
  return merged;
}

function mergeWheel(storage: CompleteStorageLike, state: CompleteSaveState): CompleteSaveState {
  const raw = storage.getItem(WHEEL_WORKSHOP_SAVE_KEY);
  if (raw === null) return state;
  const preserved = preserveRaw(storage, HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.wheel, raw);
  let wheel = null;
  try { wheel = validateWheelWorkshopSave(JSON.parse(raw), true); } catch { wheel = null; }
  if (!wheel || !preserved) return state;
  const characters = unique(wheel.discoveredRecordIds.map((recordId) => PLAYABLE_WHEEL_MANIFEST.find((record) => record.id === recordId)).filter((record) => record !== undefined).map((record) => completeCharacterId(record.glyph))).filter((id) => COMPLETE_SAVE_ALLOWED_IDS.CHARACTER_IDS.has(id));
  const { validation: _validation, ...payload } = state;
  const merged = withCompleteSaveChecksum({ ...payload, discoveredCharacterIds: unique([...state.discoveredCharacterIds, ...characters]) });
  return withMigration(merged, "wheel", "wheel", characters, "wheel");
}

export function mergeCompleteLegacyProgress(storage: CompleteStorageLike, base: CompleteSaveState): CompleteSaveState {
  let state = mergeV1(storage, base);
  state = mergeV2(storage, state);
  state = mergeWheel(storage, state);
  return state;
}

export const COMPLETE_LEGACY_SAVE_KEYS = [HANZI_MAGIC_V1_SAVE_KEY, HANZI_MAGIC_M4_SAVE_KEY, HANZI_MAGIC_M4_V1_RAW_KEY, M3_SESSION_KEY, WHEEL_WORKSHOP_SAVE_KEY] as const;

export function hasSameCompleteSavePayload(left: CompleteSaveState, right: CompleteSaveState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

import { M3_BUILD_ABILITIES, M3_HEROES, type M3HeroId } from "../../v2/chapter-one/builds";
import type { M3Action, M5AdventureMode } from "../../v2/chapter-one/m3-types";
import { isChapterTwoAction, type ChapterTwoAction } from "../chapters/chapter-two/engine";
import { isChapterThreeAction, type ChapterThreeAction } from "../chapters/chapter-three/engine";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import { COMPLETE_CHARACTER_NODES, COMPLETE_CONTENT_GRAPH_REVISION } from "../content-graph/manifest";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import type { CompleteEngineChapterId, CompleteEngineScreen, CompletePostgameMode } from "../core/complete-types";
import { COMPLETE_CHAPTER_IDS, COMPLETE_EPISODE_IDS, COMPLETE_NEW_ABILITY_IDS, COMPLETE_POSTGAME_MODES, COMPLETE_REPAIR_IDS } from "../core/world-contracts";
import type { CompletePostgameBand } from "../postgame/contracts";
import { isCompletePostgameAction, type CompletePostgameAction } from "../postgame/engine";

export const HANZI_MAGIC_COMPLETE_SAVE_KEY = "family-games/hanzi-magic-complete/v3";
export const HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY = `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.backup`;
export const HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY = `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.recovery`;
export const HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY = `${HANZI_MAGIC_COMPLETE_SAVE_KEY}.migration-content-raw`;
export const HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION = 3 as const;
export const HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES = 500 * 1024;

export type CompleteInputMode = "auto" | "mouse" | "touch" | "keyboard";
export type CompleteReviewState = "independent" | "hinted" | "revisit";
export type CompleteMigrationSource = "slice-v1" | "v1" | "v2" | "wheel" | "content-revision";
export type CompleteProvenanceSource = "v1" | "v2" | "wheel" | "v3";

export interface CompleteReviewRecord {
  readonly recordId: string;
  readonly state: CompleteReviewState;
  readonly lastEncounteredAt: string;
  readonly nextEligibleAt: string;
}

export interface CompleteCharacterProvenance {
  readonly characterId: string;
  readonly sources: readonly CompleteProvenanceSource[];
}

export interface CompleteActiveResume {
  readonly screen: CompleteEngineScreen;
  readonly chapterId: CompleteEngineChapterId;
  readonly episodeId: string | null;
  readonly phase: string;
  readonly seed: string;
  readonly actionCount: number;
}

export interface CompletePostgameResume {
  readonly mode: CompletePostgameMode;
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly band: CompletePostgameBand;
  readonly phase: string;
  readonly actionCount: number;
  readonly actions: readonly CompletePostgameAction[];
}

export interface CompleteChapterOneReplay {
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly mode: M5AdventureMode;
  readonly actions: readonly M3Action[];
}

export interface CompleteChapterTwoReplay {
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly actions: readonly ChapterTwoAction[];
}

export interface CompleteChapterThreeReplay {
  readonly seed: string;
  readonly initialHeroId: M3HeroId;
  readonly actions: readonly ChapterThreeAction[];
}

export interface CompleteSaveState {
  readonly schemaVersion: 3;
  readonly gameVersion: "3.0.0";
  readonly contentRevisionHash: string;
  readonly selectedHeroId: M3HeroId;
  readonly settings: { readonly muted: boolean; readonly reducedMotion: boolean; readonly inputMode: CompleteInputMode };
  readonly activeResume: CompleteActiveResume;
  readonly postgameResume: CompletePostgameResume | null;
  readonly chapterOneReplay: CompleteChapterOneReplay | null;
  readonly chapterTwoReplay: CompleteChapterTwoReplay | null;
  readonly chapterThreeReplay: CompleteChapterThreeReplay | null;
  readonly unlockedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedChapterIds: readonly CompleteEngineChapterId[];
  readonly completedEpisodeIds: readonly string[];
  readonly discoveredCharacterIds: readonly string[];
  readonly discoveredFamilyIds: readonly string[];
  readonly discoveredWordIds: readonly string[];
  readonly repairedObjectIds: readonly string[];
  readonly selectedAbilityIds: readonly string[];
  readonly triggeredAbilityIds: readonly string[];
  readonly completedBehaviorIds: readonly string[];
  readonly completedBossIds: readonly string[];
  readonly reviewRecords: readonly CompleteReviewRecord[];
  readonly minimalLocalEvents: {
    readonly completedLiteracyActions: number;
    readonly completedEpisodes: number;
    readonly completedChapters: number;
    readonly postgameSessions: number;
    readonly lastPlayedAtUtc: string | null;
  };
  readonly migration: {
    readonly sources: readonly CompleteMigrationSource[];
    readonly rawPreserved: { readonly sliceV1: boolean; readonly v1: boolean; readonly v2: boolean; readonly wheel: boolean; readonly contentRevision: boolean };
    readonly characterProvenance: readonly CompleteCharacterProvenance[];
  };
  readonly privacy: { readonly anonymousLocalOnly: true; readonly freeTextStored: false; readonly networkIdentityStored: false };
  readonly validation: { readonly algorithm: "fnv1a32"; readonly checksum: string };
}

const CHARACTER_IDS = new Set<string>(COMPLETE_CHARACTER_NODES.map((character) => character.id));
const FAMILY_IDS = new Set<string>(COMPLETE_COMPONENT_FAMILIES.map((family) => family.id));
const WORD_IDS = new Set<string>(COMPLETE_WORD_NODES.map((word) => word.id));
const CHAPTER_IDS = new Set<string>(COMPLETE_CHAPTER_IDS);
const EPISODE_IDS = new Set<string>(COMPLETE_EPISODE_IDS);
const REPAIR_IDS = new Set<string>(COMPLETE_REPAIR_IDS);
const HERO_IDS = new Set<string>(M3_HEROES.map((hero) => hero.id));
const ABILITY_IDS = new Set<string>([...M3_BUILD_ABILITIES.map((ability) => ability.id), ...COMPLETE_NEW_ABILITY_IDS]);
const POSTGAME_MODES = new Set<string>(COMPLETE_POSTGAME_MODES);
const POSTGAME_BANDS = new Set<string>(["whole-forest", "story-path", "optional-glow"]);
const INPUT_MODES = new Set<string>(["auto", "mouse", "touch", "keyboard"]);
const SCREENS = new Set<string>(["world", "chapter-one", "chapter-two", "chapter-three", "epilogue", "postgame"]);
const REVIEW_STATES = new Set<string>(["independent", "hinted", "revisit"]);
const MIGRATION_SOURCES = new Set<string>(["slice-v1", "v1", "v2", "wheel", "content-revision"]);
const PROVENANCE_SOURCES = new Set<string>(["v1", "v2", "wheel", "v3"]);

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function payloadChecksum(payload: Omit<CompleteSaveState, "validation">): string {
  return fnv1a(JSON.stringify(payload));
}

export function withCompleteSaveChecksum(payload: Omit<CompleteSaveState, "validation">): CompleteSaveState {
  return { ...payload, validation: { algorithm: "fnv1a32", checksum: payloadChecksum(payload) } };
}

export function createFreshCompleteSave(): CompleteSaveState {
  return withCompleteSaveChecksum({
    schemaVersion: HANZI_MAGIC_COMPLETE_SAVE_SCHEMA_VERSION,
    gameVersion: "3.0.0",
    contentRevisionHash: COMPLETE_CONTENT_GRAPH_REVISION,
    selectedHeroId: "light-speaker",
    settings: { muted: false, reducedMotion: false, inputMode: "auto" },
    activeResume: { screen: "world", chapterId: "chapter-one", episodeId: null, phase: "world", seed: "character-light-return", actionCount: 0 },
    postgameResume: null,
    chapterOneReplay: null,
    chapterTwoReplay: null,
    chapterThreeReplay: null,
    unlockedChapterIds: ["chapter-one"],
    completedChapterIds: [],
    completedEpisodeIds: [],
    discoveredCharacterIds: [],
    discoveredFamilyIds: [],
    discoveredWordIds: [],
    repairedObjectIds: [],
    selectedAbilityIds: [],
    triggeredAbilityIds: [],
    completedBehaviorIds: [],
    completedBossIds: [],
    reviewRecords: [],
    minimalLocalEvents: { completedLiteracyActions: 0, completedEpisodes: 0, completedChapters: 0, postgameSessions: 0, lastPlayedAtUtc: null },
    migration: { sources: [], rawPreserved: { sliceV1: false, v1: false, v2: false, wheel: false, contentRevision: false }, characterProvenance: [] },
    privacy: { anonymousLocalOnly: true, freeTextStored: false, networkIdentityStored: false },
  });
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function boundedString(value: unknown, max = 180): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function boundedInteger(value: unknown, max = 999999): boolean {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

function uniqueStrings(value: unknown, allowed?: ReadonlySet<string>, maximum = 256): value is string[] {
  return Array.isArray(value) && value.length <= maximum && new Set(value).size === value.length && value.every((entry) => boundedString(entry) && (!allowed || allowed.has(entry)));
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function validM3Action(value: unknown): value is M3Action {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (!boundedString(action.type, 40)) return false;
  const noPayload = new Set(["start-run", "begin-behavior", "recover-behavior", "undo", "continue", "enter-final-core", "finish-ending", "return-camp", "repeat-seed"]);
  if (noPayload.has(action.type)) return exactKeys(action, ["type"]);
  if (action.type === "select-hero") return exactKeys(action, ["type", "heroId"]) && typeof action.heroId === "string" && HERO_IDS.has(action.heroId);
  if (action.type === "choose-route") return exactKeys(action, ["type", "pathId"]) && boundedString(action.pathId);
  if (action.type === "select-card") return exactKeys(action, ["type", "cardId"]) && boundedString(action.cardId);
  if (action.type === "place-card") return ["cardId|slotId|type", "slotId|type"].includes(Object.keys(action).sort().join("|")) && ["left", "right", "top", "bottom", "outer", "inner"].includes(String(action.slotId)) && (action.cardId === undefined || boundedString(action.cardId));
  if (action.type === "choose-ability") return exactKeys(action, ["type", "abilityId"]) && typeof action.abilityId === "string" && ABILITY_IDS.has(action.abilityId);
  if (action.type === "start-free-adventure") return ["seed|type", "type"].includes(Object.keys(action).sort().join("|")) && (action.seed === undefined || boundedString(action.seed));
  return false;
}

function validActiveResume(value: unknown): value is CompleteActiveResume {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const resume = value as Record<string, unknown>;
  return exactKeys(resume, ["screen", "chapterId", "episodeId", "phase", "seed", "actionCount"])
    && typeof resume.screen === "string" && SCREENS.has(resume.screen)
    && typeof resume.chapterId === "string" && CHAPTER_IDS.has(resume.chapterId)
    && (resume.episodeId === null || (typeof resume.episodeId === "string" && EPISODE_IDS.has(resume.episodeId)))
    && boundedString(resume.phase) && boundedString(resume.seed) && boundedInteger(resume.actionCount);
}

function validPostgameResume(value: unknown): value is CompletePostgameResume | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const resume = value as Record<string, unknown>;
  const legacy = exactKeys(resume, ["mode", "seed", "phase", "actionCount"]);
  const current = exactKeys(resume, ["mode", "seed", "initialHeroId", "band", "phase", "actionCount", "actions"]);
  return (legacy || current)
    && typeof resume.mode === "string" && POSTGAME_MODES.has(resume.mode)
    && boundedString(resume.seed) && boundedString(resume.phase) && boundedInteger(resume.actionCount)
    && (legacy || (typeof resume.initialHeroId === "string" && HERO_IDS.has(resume.initialHeroId)
      && typeof resume.band === "string" && POSTGAME_BANDS.has(resume.band)
      && Array.isArray(resume.actions) && resume.actions.length <= 900 && resume.actions.every(isCompletePostgameAction)));
}

function validChapterOneReplay(value: unknown): value is CompleteChapterOneReplay | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const replay = value as Record<string, unknown>;
  return exactKeys(replay, ["seed", "initialHeroId", "mode", "actions"])
    && boundedString(replay.seed) && typeof replay.initialHeroId === "string" && HERO_IDS.has(replay.initialHeroId)
    && ["story", "free"].includes(String(replay.mode)) && Array.isArray(replay.actions) && replay.actions.length <= 900 && replay.actions.every(validM3Action);
}

function validChapterTwoReplay(value: unknown): value is CompleteChapterTwoReplay | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const replay = value as Record<string, unknown>;
  return exactKeys(replay, ["seed", "initialHeroId", "actions"])
    && boundedString(replay.seed) && typeof replay.initialHeroId === "string" && HERO_IDS.has(replay.initialHeroId)
    && Array.isArray(replay.actions) && replay.actions.length <= 900 && replay.actions.every(isChapterTwoAction);
}

function validChapterThreeReplay(value: unknown): value is CompleteChapterThreeReplay | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const replay = value as Record<string, unknown>;
  return exactKeys(replay, ["seed", "initialHeroId", "actions"])
    && boundedString(replay.seed) && typeof replay.initialHeroId === "string" && HERO_IDS.has(replay.initialHeroId)
    && Array.isArray(replay.actions) && replay.actions.length <= 900 && replay.actions.every(isChapterThreeAction);
}

function validReviewRecords(value: unknown, allowUnknownContent: boolean): value is CompleteReviewRecord[] {
  if (!Array.isArray(value) || value.length > 256) return false;
  const allowed = new Set([...CHARACTER_IDS, ...FAMILY_IDS, ...WORD_IDS]);
  return new Set(value.map((entry) => (entry as CompleteReviewRecord)?.recordId)).size === value.length && value.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    return exactKeys(record, ["recordId", "state", "lastEncounteredAt", "nextEligibleAt"])
      && boundedString(record.recordId) && (allowUnknownContent || allowed.has(record.recordId))
      && typeof record.state === "string" && REVIEW_STATES.has(record.state)
      && validIso(record.lastEncounteredAt) && validIso(record.nextEligibleAt);
  });
}

function validMigration(value: unknown, allowUnknownContent: boolean): value is CompleteSaveState["migration"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const migration = value as Record<string, unknown>;
  if (!exactKeys(migration, ["sources", "rawPreserved", "characterProvenance"]) || !uniqueStrings(migration.sources, MIGRATION_SOURCES, 5)) return false;
  if (!migration.rawPreserved || typeof migration.rawPreserved !== "object" || Array.isArray(migration.rawPreserved)) return false;
  const raw = migration.rawPreserved as Record<string, unknown>;
  if (!exactKeys(raw, ["sliceV1", "v1", "v2", "wheel", "contentRevision"]) || !Object.values(raw).every((entry) => typeof entry === "boolean")) return false;
  if (!Array.isArray(migration.characterProvenance) || migration.characterProvenance.length > 256) return false;
  return new Set(migration.characterProvenance.map((entry) => (entry as CompleteCharacterProvenance)?.characterId)).size === migration.characterProvenance.length && migration.characterProvenance.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const provenance = entry as Record<string, unknown>;
    return exactKeys(provenance, ["characterId", "sources"])
      && boundedString(provenance.characterId) && (allowUnknownContent || CHARACTER_IDS.has(provenance.characterId))
      && uniqueStrings(provenance.sources, PROVENANCE_SOURCES, 4);
  });
}

export function validateCompleteSaveDetailed(value: unknown, allowRevisionMismatch = false): { readonly state: CompleteSaveState | null; readonly reason: "INVALID_SHAPE" | "CHECKSUM_MISMATCH" | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: null, reason: "INVALID_SHAPE" };
  const save = value as Record<string, unknown>;
  const keys = ["schemaVersion", "gameVersion", "contentRevisionHash", "selectedHeroId", "settings", "activeResume", "postgameResume", "chapterOneReplay", "chapterTwoReplay", "chapterThreeReplay", "unlockedChapterIds", "completedChapterIds", "completedEpisodeIds", "discoveredCharacterIds", "discoveredFamilyIds", "discoveredWordIds", "repairedObjectIds", "selectedAbilityIds", "triggeredAbilityIds", "completedBehaviorIds", "completedBossIds", "reviewRecords", "minimalLocalEvents", "migration", "privacy", "validation"];
  const preChapterTwoKeys = keys.filter((key) => key !== "chapterTwoReplay" && key !== "chapterThreeReplay");
  const preChapterThreeKeys = keys.filter((key) => key !== "chapterThreeReplay");
  const preChapterTwo = !("chapterTwoReplay" in save) && !("chapterThreeReplay" in save) && exactKeys(save, preChapterTwoKeys);
  const preChapterThree = "chapterTwoReplay" in save && !("chapterThreeReplay" in save) && exactKeys(save, preChapterThreeKeys);
  const legacyPostgame = save.postgameResume !== null && typeof save.postgameResume === "object" && !Array.isArray(save.postgameResume) && !("actions" in save.postgameResume);
  if ((!exactKeys(save, keys) && !preChapterTwo && !preChapterThree) || save.schemaVersion !== 3 || save.gameVersion !== "3.0.0" || typeof save.contentRevisionHash !== "string") return { state: null, reason: "INVALID_SHAPE" };
  const mismatch = save.contentRevisionHash !== COMPLETE_CONTENT_GRAPH_REVISION;
  if (mismatch && !allowRevisionMismatch) return { state: null, reason: "INVALID_SHAPE" };
  if (typeof save.selectedHeroId !== "string" || !HERO_IDS.has(save.selectedHeroId)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) return { state: null, reason: "INVALID_SHAPE" };
  const settings = save.settings as Record<string, unknown>;
  if (!exactKeys(settings, ["muted", "reducedMotion", "inputMode"]) || typeof settings.muted !== "boolean" || typeof settings.reducedMotion !== "boolean" || typeof settings.inputMode !== "string" || !INPUT_MODES.has(settings.inputMode)) return { state: null, reason: "INVALID_SHAPE" };
  if (!validActiveResume(save.activeResume) || !validPostgameResume(save.postgameResume) || !validChapterOneReplay(save.chapterOneReplay) || !validChapterTwoReplay(preChapterTwo ? null : save.chapterTwoReplay) || !validChapterThreeReplay(preChapterTwo || preChapterThree ? null : save.chapterThreeReplay)) return { state: null, reason: "INVALID_SHAPE" };
  if (!uniqueStrings(save.unlockedChapterIds, CHAPTER_IDS, 3) || !(save.unlockedChapterIds as string[]).includes("chapter-one") || !uniqueStrings(save.completedChapterIds, CHAPTER_IDS, 3) || !uniqueStrings(save.completedEpisodeIds, mismatch ? undefined : EPISODE_IDS, 12)) return { state: null, reason: "INVALID_SHAPE" };
  if (!uniqueStrings(save.discoveredCharacterIds, mismatch ? undefined : CHARACTER_IDS, 256) || !uniqueStrings(save.discoveredFamilyIds, mismatch ? undefined : FAMILY_IDS, 18) || !uniqueStrings(save.discoveredWordIds, mismatch ? undefined : WORD_IDS, 36)) return { state: null, reason: "INVALID_SHAPE" };
  if (!uniqueStrings(save.repairedObjectIds, REPAIR_IDS, 16) || !uniqueStrings(save.selectedAbilityIds, ABILITY_IDS, 24) || !uniqueStrings(save.triggeredAbilityIds, ABILITY_IDS, 24) || !uniqueStrings(save.completedBehaviorIds, undefined, 32) || !uniqueStrings(save.completedBossIds, undefined, 20)) return { state: null, reason: "INVALID_SHAPE" };
  if (!validReviewRecords(save.reviewRecords, mismatch) || !validMigration(save.migration, mismatch)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.minimalLocalEvents || typeof save.minimalLocalEvents !== "object" || Array.isArray(save.minimalLocalEvents)) return { state: null, reason: "INVALID_SHAPE" };
  const events = save.minimalLocalEvents as Record<string, unknown>;
  if (!exactKeys(events, ["completedLiteracyActions", "completedEpisodes", "completedChapters", "postgameSessions", "lastPlayedAtUtc"]) || ![events.completedLiteracyActions, events.completedEpisodes, events.completedChapters, events.postgameSessions].every((entry) => boundedInteger(entry)) || (events.lastPlayedAtUtc !== null && !validIso(events.lastPlayedAtUtc))) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.privacy || typeof save.privacy !== "object" || Array.isArray(save.privacy)) return { state: null, reason: "INVALID_SHAPE" };
  const privacy = save.privacy as Record<string, unknown>;
  if (!exactKeys(privacy, ["anonymousLocalOnly", "freeTextStored", "networkIdentityStored"]) || privacy.anonymousLocalOnly !== true || privacy.freeTextStored !== false || privacy.networkIdentityStored !== false) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.validation || typeof save.validation !== "object" || Array.isArray(save.validation)) return { state: null, reason: "INVALID_SHAPE" };
  const validation = save.validation as Record<string, unknown>;
  if (!exactKeys(validation, ["algorithm", "checksum"]) || validation.algorithm !== "fnv1a32" || typeof validation.checksum !== "string") return { state: null, reason: "INVALID_SHAPE" };
  const { validation: omitted, ...payload } = save as unknown as CompleteSaveState;
  if (omitted.checksum !== payloadChecksum(payload)) return { state: null, reason: "CHECKSUM_MISMATCH" };
  if (preChapterTwo || preChapterThree || legacyPostgame) {
    const { validation: _validation, ...legacyPayload } = save;
    const postgameResume = legacyPostgame && save.postgameResume && typeof save.postgameResume === "object"
      ? { ...(save.postgameResume as unknown as Record<string, unknown>), initialHeroId: save.selectedHeroId, band: "whole-forest" as const, phase: "mode-intro", actionCount: 0, actions: [] }
      : save.postgameResume;
    return { state: withCompleteSaveChecksum({ ...legacyPayload, postgameResume, chapterTwoReplay: preChapterTwo ? null : save.chapterTwoReplay, chapterThreeReplay: preChapterTwo || preChapterThree ? null : save.chapterThreeReplay } as Omit<CompleteSaveState, "validation">), reason: null };
  }
  return { state: save as unknown as CompleteSaveState, reason: null };
}

export function validateCompleteSave(value: unknown): CompleteSaveState | null {
  return validateCompleteSaveDetailed(value).state;
}

export function migrateCompleteContentRevision(previous: CompleteSaveState): CompleteSaveState {
  const { validation: _validation, ...previousPayload } = previous;
  const characters = previous.discoveredCharacterIds.filter((id) => CHARACTER_IDS.has(id));
  const characterSet = new Set(characters);
  const payload: Omit<CompleteSaveState, "validation"> = {
    ...previousPayload,
    contentRevisionHash: COMPLETE_CONTENT_GRAPH_REVISION,
    completedEpisodeIds: previous.completedEpisodeIds.filter((id) => EPISODE_IDS.has(id)),
    discoveredCharacterIds: characters,
    discoveredFamilyIds: previous.discoveredFamilyIds.filter((id) => FAMILY_IDS.has(id)),
    discoveredWordIds: previous.discoveredWordIds.filter((id) => WORD_IDS.has(id)),
    reviewRecords: previous.reviewRecords.filter((record) => characterSet.has(record.recordId) || FAMILY_IDS.has(record.recordId) || WORD_IDS.has(record.recordId)),
    migration: {
      ...previous.migration,
      sources: [...new Set([...previous.migration.sources, "content-revision" as const])],
      rawPreserved: { ...previous.migration.rawPreserved, contentRevision: true },
      characterProvenance: previous.migration.characterProvenance.filter((record) => characterSet.has(record.characterId)),
    },
  };
  return withCompleteSaveChecksum(payload);
}

export const COMPLETE_SAVE_ALLOWED_IDS = { CHARACTER_IDS, FAMILY_IDS, WORD_IDS, CHAPTER_IDS, EPISODE_IDS, REPAIR_IDS, ABILITY_IDS } as const;

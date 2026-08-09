import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../content/manifest";
import type { AbilityId, GoldenCharacterId, GoldenEncounterId } from "../content/types";
import {
  LOCAL_PLAYTEST_EVENT_FIELDS,
  LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION,
  LOCAL_PLAYTEST_SEGMENTS,
  LOCAL_PLAYTEST_VIEWPORT_CLASSES,
  type LocalPlaytestEvent,
  type LocalPlaytestSegmentId,
  type LocalPlaytestViewportClass,
} from "../simulation/events";
import { validatePilotSave } from "../../save/schema";

export const GOLDEN_SLICE_SAVE_KEY = "family-games/hanzi-radical-battle-v2/golden-slice/state";
export const GOLDEN_SLICE_SAVE_SCHEMA_VERSION = 3;
export { LOCAL_PLAYTEST_EVENT_FIELDS } from "../simulation/events";

export interface GoldenSliceSettings {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface GoldenSliceCampState {
  readonly lamp: boolean;
}

export interface GoldenSliceSaveState {
  readonly schemaVersion: 3;
  readonly contentRevisionHash: string;
  readonly completedRuns: number;
  readonly lastRunSeed: string;
  readonly campState: GoldenSliceCampState;
  readonly spellbookEntries: readonly GoldenCharacterId[];
  readonly chosenAbilityHistory: readonly AbilityId[];
  readonly settings: GoldenSliceSettings;
  readonly localPlaytestEvents: readonly LocalPlaytestEvent[];
}

export interface GoldenSliceSaveReadResult {
  readonly state: GoldenSliceSaveState;
  readonly recoveredFromCorruption: boolean;
  readonly migratedFromStep02: boolean;
}

export const DEFAULT_GOLDEN_SLICE_SAVE: GoldenSliceSaveState = {
  schemaVersion: GOLDEN_SLICE_SAVE_SCHEMA_VERSION,
  contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  completedRuns: 0,
  lastRunSeed: "hanzi-v2-golden-slice-v1",
  campState: { lamp: false },
  spellbookEntries: [],
  chosenAbilityHistory: [],
  settings: { muted: false, reducedMotion: false },
  localPlaytestEvents: [],
};

const EXACT_SAVE_KEYS = [
  "schemaVersion",
  "contentRevisionHash",
  "completedRuns",
  "lastRunSeed",
  "campState",
  "spellbookEntries",
  "chosenAbilityHistory",
  "settings",
  "localPlaytestEvents",
] as const;
const EXACT_SETTINGS_KEYS = ["muted", "reducedMotion"] as const;
const EXACT_CAMP_STATE_KEYS = ["lamp"] as const;
const EXACT_BOSS_PHASE_KEYS = ["lin", "xing"] as const;
const FINAL_CHARACTER_IDS = new Set<GoldenCharacterId>([
  "ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao",
]);
const ENCOUNTER_IDS = new Set<GoldenEncounterId>(["encounter-ming", "encounter-hua", "boss-lin", "boss-xing"]);
const ABILITY_IDS = new Set<AbilityId>(["guardian-light", "star-path", "ink-echo"]);
const MAX_LOCAL_PLAYTEST_EVENTS = 24;
const MAX_DURATION_MS = 15 * 60 * 1000;
const MAX_COUNT = 9999;

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isNonNegativeInteger(value: unknown, maximum = MAX_COUNT): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum;
}

function isSeed(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(value);
}

function isUniqueAllowed<T extends string>(items: unknown, allowed: Set<T>): items is T[] {
  return Array.isArray(items) && new Set(items).size === items.length && items.every((item) => typeof item === "string" && allowed.has(item as T));
}

function validateNumberRecord<T extends string>(value: unknown, keys: readonly T[], maximum: number): Readonly<Record<T, number>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record, keys)) return null;
  if (!keys.every((key) => isNonNegativeInteger(record[key], maximum))) return null;
  return Object.fromEntries(keys.map((key) => [key, record[key] as number])) as Readonly<Record<T, number>>;
}

function validateLocalPlaytestEvent(value: unknown): LocalPlaytestEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (!hasExactKeys(event, LOCAL_PLAYTEST_EVENT_FIELDS)) return null;
  if (event.schemaVersion !== LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION) return null;
  if (typeof event.sessionId !== "string" || !/^session-[a-z0-9-]{1,40}$/.test(event.sessionId)) return null;
  if (!isSeed(event.runSeed)) return null;
  if (event.firstActionMs !== null && !isNonNegativeInteger(event.firstActionMs, MAX_DURATION_MS)) return null;
  if (event.firstSpellMs !== null && !isNonNegativeInteger(event.firstSpellMs, MAX_DURATION_MS)) return null;
  const segmentDurationsMs = validateNumberRecord(event.segmentDurationsMs, LOCAL_PLAYTEST_SEGMENTS, MAX_DURATION_MS);
  const invalidPlacementCountByEncounter = validateNumberRecord(event.invalidPlacementCountByEncounter, [...ENCOUNTER_IDS], MAX_COUNT);
  const maxHintLevelByEncounter = validateNumberRecord(event.maxHintLevelByEncounter, [...ENCOUNTER_IDS], 3);
  const bossPhaseRetryCount = validateNumberRecord(event.bossPhaseRetryCount, EXACT_BOSS_PHASE_KEYS, MAX_COUNT);
  if (!segmentDurationsMs || !invalidPlacementCountByEncounter || !maxHintLevelByEncounter || !bossPhaseRetryCount) return null;
  if (event.chosenAbilityId !== null && (typeof event.chosenAbilityId !== "string" || !ABILITY_IDS.has(event.chosenAbilityId as AbilityId))) return null;
  if (typeof event.completed !== "boolean" || typeof event.replayClicked !== "boolean") return null;
  if (typeof event.muted !== "boolean" || typeof event.reducedMotion !== "boolean") return null;
  if (typeof event.viewportClass !== "string" || !LOCAL_PLAYTEST_VIEWPORT_CLASSES.includes(event.viewportClass as LocalPlaytestViewportClass)) return null;
  return {
    schemaVersion: LOCAL_PLAYTEST_EVENT_SCHEMA_VERSION,
    sessionId: event.sessionId,
    runSeed: event.runSeed,
    firstActionMs: event.firstActionMs as number | null,
    firstSpellMs: event.firstSpellMs as number | null,
    segmentDurationsMs,
    invalidPlacementCountByEncounter,
    maxHintLevelByEncounter,
    chosenAbilityId: event.chosenAbilityId as AbilityId | null,
    bossPhaseRetryCount,
    completed: event.completed,
    replayClicked: event.replayClicked,
    muted: event.muted,
    reducedMotion: event.reducedMotion,
    viewportClass: event.viewportClass as LocalPlaytestViewportClass,
  };
}

export function cloneDefaultGoldenSliceSave(): GoldenSliceSaveState {
  return {
    ...DEFAULT_GOLDEN_SLICE_SAVE,
    campState: { ...DEFAULT_GOLDEN_SLICE_SAVE.campState },
    spellbookEntries: [],
    chosenAbilityHistory: [],
    settings: { ...DEFAULT_GOLDEN_SLICE_SAVE.settings },
    localPlaytestEvents: [],
  };
}

export function validateGoldenSliceSave(value: unknown): GoldenSliceSaveState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const save = value as Record<string, unknown>;
  if (!hasExactKeys(save, EXACT_SAVE_KEYS)) return null;
  if (save.schemaVersion !== GOLDEN_SLICE_SAVE_SCHEMA_VERSION || save.contentRevisionHash !== GOLDEN_SLICE_MANIFEST_REVISION_HASH) return null;
  if (!isNonNegativeInteger(save.completedRuns) || !isSeed(save.lastRunSeed)) return null;
  if (!save.campState || typeof save.campState !== "object" || Array.isArray(save.campState)) return null;
  const campState = save.campState as Record<string, unknown>;
  if (!hasExactKeys(campState, EXACT_CAMP_STATE_KEYS) || typeof campState.lamp !== "boolean") return null;
  if (!isUniqueAllowed(save.spellbookEntries, FINAL_CHARACTER_IDS)) return null;
  if (!Array.isArray(save.chosenAbilityHistory) || save.chosenAbilityHistory.some((item) => typeof item !== "string" || !ABILITY_IDS.has(item as AbilityId))) return null;
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) return null;
  const settings = save.settings as Record<string, unknown>;
  if (!hasExactKeys(settings, EXACT_SETTINGS_KEYS) || typeof settings.muted !== "boolean" || typeof settings.reducedMotion !== "boolean") return null;
  if (!Array.isArray(save.localPlaytestEvents) || save.localPlaytestEvents.length > MAX_LOCAL_PLAYTEST_EVENTS) return null;
  const localPlaytestEvents = save.localPlaytestEvents.map(validateLocalPlaytestEvent);
  if (localPlaytestEvents.some((event) => event === null)) return null;
  const sessionIds = localPlaytestEvents.map((event) => event!.sessionId);
  if (new Set(sessionIds).size !== sessionIds.length) return null;
  return {
    schemaVersion: GOLDEN_SLICE_SAVE_SCHEMA_VERSION,
    contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
    completedRuns: save.completedRuns,
    lastRunSeed: save.lastRunSeed,
    campState: { lamp: campState.lamp },
    spellbookEntries: [...save.spellbookEntries],
    chosenAbilityHistory: [...(save.chosenAbilityHistory as AbilityId[])],
    settings: { muted: settings.muted, reducedMotion: settings.reducedMotion },
    localPlaytestEvents: localPlaytestEvents as LocalPlaytestEvent[],
  };
}

/** Pure STEP 02 migration: it preserves only the requested local progress/settings fields. */
export function migrateStep02PilotSave(value: unknown): GoldenSliceSaveState | null {
  const pilot = validatePilotSave(value);
  if (!pilot) return null;
  const migrated: GoldenSliceSaveState = {
    ...cloneDefaultGoldenSliceSave(),
    completedRuns: pilot.minimumPilotEvents.includes("pilot_completed") ? 1 : 0,
    campState: { lamp: pilot.campLampRepaired },
    spellbookEntries: pilot.spellbookCharacterIds.filter(
      (id): id is GoldenCharacterId => FINAL_CHARACTER_IDS.has(id as GoldenCharacterId),
    ),
    settings: { muted: pilot.muted, reducedMotion: pilot.reducedMotion },
  };
  return validateGoldenSliceSave(migrated);
}

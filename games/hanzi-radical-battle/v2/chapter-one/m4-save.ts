import { HANZI_MAGIC_V1_SAVE_KEY, readV1Save } from "../v1/save";
import { CHAPTER_ONE_CHARACTER_IDS, CHAPTER_ONE_CONTENT_REVISION } from "./characters";
import { M3_BUILD_ABILITIES, M3_HEROES, type M3AbilityId, type M3HeroId } from "./builds";
import { deriveM4Repairs, M4_REPAIR_IDS, type M4RepairId } from "./camp";
import type { ChapterRegionId } from "./content-types";
import type { M3GameState, M3Phase } from "./m3-types";
import type { M1SessionStorage } from "./session";

export const HANZI_MAGIC_M4_SAVE_SCHEMA_VERSION = 5 as const;
export const HANZI_MAGIC_M4_SAVE_KEY = "family-games/hanzi-magic-v2/chapter-one/save-v5";
export const HANZI_MAGIC_M4_SAVE_BACKUP_KEY = `${HANZI_MAGIC_M4_SAVE_KEY}.backup`;
export const HANZI_MAGIC_M4_SAVE_RECOVERY_KEY = `${HANZI_MAGIC_M4_SAVE_KEY}.recovery`;
export const HANZI_MAGIC_M4_V1_RAW_KEY = `${HANZI_MAGIC_M4_SAVE_KEY}.migration-v1-raw`;

export type M4InputMode = "auto" | "mouse" | "touch" | "keyboard";

export interface M4CurrentRunSummary {
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly phase: M3Phase;
  readonly regionIndex: 0 | 1 | 2;
  readonly encounterIndex: 0 | 1 | 2 | 3;
  readonly actionCount: number;
}

export interface M4SaveState {
  readonly schemaVersion: 5;
  readonly gameVersion: "2.0.0";
  readonly contentRevisionHash: string;
  readonly discoveredCharacterIds: readonly string[];
  readonly completedRegionIds: readonly ChapterRegionId[];
  readonly repairedObjectIds: readonly M4RepairId[];
  readonly selectedHeroId: M3HeroId;
  readonly seenAbilityIds: readonly M3AbilityId[];
  readonly settings: { readonly muted: boolean; readonly reducedMotion: boolean; readonly inputMode: M4InputMode };
  readonly currentRun: M4CurrentRunSummary | null;
  readonly minimalLocalEvents: {
    readonly completedRuns: number;
    readonly completedRegions: number;
    readonly spellbookOpens: number;
    readonly repairInteractions: number;
    readonly lastPlayedAtUtc: string | null;
  };
  readonly migration: { readonly source: "fresh" | "v1-schema-4"; readonly v1RawPreserved: boolean };
  readonly validation: { readonly algorithm: "fnv1a32"; readonly checksum: string };
}

export interface M4SaveReadResult {
  readonly state: M4SaveState;
  readonly source: "fresh" | "v2" | "v2-backup" | "v1-migrated";
  readonly recovered: boolean;
  readonly recoveryReason: "NONE" | "MALFORMED_JSON" | "INVALID_SHAPE" | "CHECKSUM_MISMATCH";
  readonly futureVersionProtected: boolean;
  readonly writable: boolean;
}

const CHARACTER_IDS = new Set(CHAPTER_ONE_CHARACTER_IDS);
const REGION_IDS = new Set<ChapterRegionId>(["glimmer-grove", "echo-garden", "wind-trail"]);
const REPAIR_IDS = new Set(M4_REPAIR_IDS);
const HERO_IDS = new Set<M3HeroId>(M3_HEROES.map((entry) => entry.id));
const ABILITY_IDS = new Set<M3AbilityId>(M3_BUILD_ABILITIES.map((entry) => entry.id));
const PHASES = new Set<M3Phase>(["camp", "route-choice", "behavior-telegraph", "behavior-effect", "encounter", "composition", "meaning", "ability-choice", "region-complete", "run-summary"]);
const INPUT_MODES = new Set<M4InputMode>(["auto", "mouse", "touch", "keyboard"]);

function unique<T>(items: readonly T[]): T[] { return [...new Set(items)]; }
function fnv1a(value: string): string { let hash = 2166136261; for (const char of value) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619); } return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
function checksumPayload(state: Omit<M4SaveState, "validation">): string { return fnv1a(JSON.stringify(state)); }
function withChecksum(state: Omit<M4SaveState, "validation">): M4SaveState { return { ...state, validation: { algorithm: "fnv1a32", checksum: checksumPayload(state) } }; }
function uniqueAllowed<T extends string>(value: unknown, allowed: ReadonlySet<T>): value is T[] { return Array.isArray(value) && new Set(value).size === value.length && value.every((entry) => typeof entry === "string" && allowed.has(entry as T)); }
function boundedInteger(value: unknown, maximum = 999999): boolean { return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum; }

export function createFreshM4Save(): M4SaveState {
  return withChecksum({
    schemaVersion: 5,
    gameVersion: "2.0.0",
    contentRevisionHash: CHAPTER_ONE_CONTENT_REVISION,
    discoveredCharacterIds: [],
    completedRegionIds: [],
    repairedObjectIds: [],
    selectedHeroId: "light-speaker",
    seenAbilityIds: [],
    settings: { muted: false, reducedMotion: false, inputMode: "auto" },
    currentRun: null,
    minimalLocalEvents: { completedRuns: 0, completedRegions: 0, spellbookOpens: 0, repairInteractions: 0, lastPlayedAtUtc: null },
    migration: { source: "fresh", v1RawPreserved: false },
  });
}

function validateM4SaveDetailed(value: unknown): { state: M4SaveState | null; reason: "INVALID_SHAPE" | "CHECKSUM_MISMATCH" | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: null, reason: "INVALID_SHAPE" };
  const save = value as Record<string, unknown>;
  const expected = ["completedRegionIds", "contentRevisionHash", "currentRun", "discoveredCharacterIds", "gameVersion", "migration", "minimalLocalEvents", "repairedObjectIds", "schemaVersion", "seenAbilityIds", "selectedHeroId", "settings", "validation"];
  if (Object.keys(save).sort().join("|") !== expected.sort().join("|") || save.schemaVersion !== 5 || save.gameVersion !== "2.0.0" || save.contentRevisionHash !== CHAPTER_ONE_CONTENT_REVISION) return { state: null, reason: "INVALID_SHAPE" };
  if (!uniqueAllowed(save.discoveredCharacterIds, CHARACTER_IDS) || !uniqueAllowed(save.completedRegionIds, REGION_IDS) || !uniqueAllowed(save.repairedObjectIds, REPAIR_IDS) || !uniqueAllowed(save.seenAbilityIds, ABILITY_IDS) || typeof save.selectedHeroId !== "string" || !HERO_IDS.has(save.selectedHeroId as M3HeroId)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) return { state: null, reason: "INVALID_SHAPE" };
  const settings = save.settings as Record<string, unknown>;
  if (Object.keys(settings).sort().join("|") !== "inputMode|muted|reducedMotion" || typeof settings.muted !== "boolean" || typeof settings.reducedMotion !== "boolean" || typeof settings.inputMode !== "string" || !INPUT_MODES.has(settings.inputMode as M4InputMode)) return { state: null, reason: "INVALID_SHAPE" };
  if (save.currentRun !== null) {
    if (!save.currentRun || typeof save.currentRun !== "object" || Array.isArray(save.currentRun)) return { state: null, reason: "INVALID_SHAPE" };
    const run = save.currentRun as Record<string, unknown>;
    if (Object.keys(run).sort().join("|") !== "actionCount|encounterIndex|heroId|phase|regionIndex|seed" || typeof run.seed !== "string" || run.seed.length < 1 || run.seed.length > 160 || typeof run.heroId !== "string" || !HERO_IDS.has(run.heroId as M3HeroId) || typeof run.phase !== "string" || !PHASES.has(run.phase as M3Phase) || !boundedInteger(run.regionIndex, 2) || !boundedInteger(run.encounterIndex, 3) || !boundedInteger(run.actionCount)) return { state: null, reason: "INVALID_SHAPE" };
  }
  if (!save.minimalLocalEvents || typeof save.minimalLocalEvents !== "object" || Array.isArray(save.minimalLocalEvents)) return { state: null, reason: "INVALID_SHAPE" };
  const events = save.minimalLocalEvents as Record<string, unknown>;
  if (Object.keys(events).sort().join("|") !== "completedRegions|completedRuns|lastPlayedAtUtc|repairInteractions|spellbookOpens" || ![events.completedRuns, events.completedRegions, events.spellbookOpens, events.repairInteractions].every((entry) => boundedInteger(entry)) || (events.lastPlayedAtUtc !== null && (typeof events.lastPlayedAtUtc !== "string" || Number.isNaN(Date.parse(events.lastPlayedAtUtc))))) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.migration || typeof save.migration !== "object" || Array.isArray(save.migration)) return { state: null, reason: "INVALID_SHAPE" };
  const migration = save.migration as Record<string, unknown>;
  if (Object.keys(migration).sort().join("|") !== "source|v1RawPreserved" || !["fresh", "v1-schema-4"].includes(String(migration.source)) || typeof migration.v1RawPreserved !== "boolean") return { state: null, reason: "INVALID_SHAPE" };
  if (!save.validation || typeof save.validation !== "object" || Array.isArray(save.validation)) return { state: null, reason: "INVALID_SHAPE" };
  const validation = save.validation as Record<string, unknown>;
  if (Object.keys(validation).sort().join("|") !== "algorithm|checksum" || validation.algorithm !== "fnv1a32" || typeof validation.checksum !== "string") return { state: null, reason: "INVALID_SHAPE" };
  const { validation: omitted, ...payload } = save as unknown as M4SaveState;
  if (omitted.checksum !== checksumPayload(payload)) return { state: null, reason: "CHECKSUM_MISMATCH" };
  if (JSON.stringify(deriveM4Repairs(save.discoveredCharacterIds as string[], save.completedRegionIds as ChapterRegionId[], save.repairedObjectIds as M4RepairId[])) !== JSON.stringify(save.repairedObjectIds)) return { state: null, reason: "INVALID_SHAPE" };
  return { state: save as unknown as M4SaveState, reason: null };
}

export function validateM4Save(value: unknown): M4SaveState | null { return validateM4SaveDetailed(value).state; }

function captureRecovery(storage: M1SessionStorage, raw: string, reason: string): void { storage.setItem(HANZI_MAGIC_M4_SAVE_RECOVERY_KEY, JSON.stringify({ schemaVersion: 1, reason, capturedAtUtc: new Date().toISOString(), raw })); }
function readBackup(storage: M1SessionStorage): M4SaveState | null { const raw = storage.getItem(HANZI_MAGIC_M4_SAVE_BACKUP_KEY); if (!raw) return null; try { return validateM4Save(JSON.parse(raw)); } catch { return null; } }

function migrateV1(storage: M1SessionStorage, raw: string): M4SaveState | null {
  const read = readV1Save(storage);
  if (read.source !== "v1" || read.futureVersionProtected) return null;
  storage.setItem(HANZI_MAGIC_M4_V1_RAW_KEY, raw);
  const legacyRepairs = M4_REPAIR_IDS.slice(0, read.state.campRepairStage);
  return withChecksum({
    schemaVersion: 5,
    gameVersion: "2.0.0",
    contentRevisionHash: CHAPTER_ONE_CONTENT_REVISION,
    discoveredCharacterIds: [...read.state.discoveredCharacterIds],
    completedRegionIds: read.state.completedAdventureIds.map((id) => id === "glimmer-path" ? "glimmer-grove" : id === "garden-echo" ? "echo-garden" : "wind-trail"),
    repairedObjectIds: deriveM4Repairs(read.state.discoveredCharacterIds, read.state.completedAdventureIds.map((id) => id === "glimmer-path" ? "glimmer-grove" : id === "garden-echo" ? "echo-garden" : "wind-trail"), legacyRepairs),
    selectedHeroId: "light-speaker",
    seenAbilityIds: [],
    settings: { ...read.state.settings },
    currentRun: null,
    minimalLocalEvents: { completedRuns: read.state.minimalLocalSessionSummary.completedRuns, completedRegions: read.state.completedAdventureIds.length, spellbookOpens: 0, repairInteractions: 0, lastPlayedAtUtc: read.state.minimalLocalSessionSummary.lastPlayedAtUtc },
    migration: { source: "v1-schema-4", v1RawPreserved: storage.getItem(HANZI_MAGIC_M4_V1_RAW_KEY) === raw },
  });
}

export function readM4Save(storage: M1SessionStorage): M4SaveReadResult {
  const raw = storage.getItem(HANZI_MAGIC_M4_SAVE_KEY);
  if (raw !== null) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { captureRecovery(storage, raw, "MALFORMED_JSON"); const backup = readBackup(storage); return { state: backup ?? createFreshM4Save(), source: backup ? "v2-backup" : "fresh", recovered: true, recoveryReason: "MALFORMED_JSON", futureVersionProtected: false, writable: true }; }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).schemaVersion === "number" && Number((parsed as Record<string, unknown>).schemaVersion) > 5) return { state: createFreshM4Save(), source: "fresh", recovered: false, recoveryReason: "NONE", futureVersionProtected: true, writable: false };
    const checked = validateM4SaveDetailed(parsed);
    if (checked.state) return { state: checked.state, source: "v2", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
    captureRecovery(storage, raw, checked.reason ?? "INVALID_SHAPE");
    const backup = readBackup(storage);
    return { state: backup ?? createFreshM4Save(), source: backup ? "v2-backup" : "fresh", recovered: true, recoveryReason: checked.reason ?? "INVALID_SHAPE", futureVersionProtected: false, writable: true };
  }
  const v1Raw = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY);
  if (v1Raw !== null) { const migrated = migrateV1(storage, v1Raw); if (migrated) { writeM4Save(storage, migrated); return { state: migrated, source: "v1-migrated", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true }; } }
  return { state: createFreshM4Save(), source: "fresh", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
}

export function writeM4Save(storage: M1SessionStorage, state: M4SaveState, writable = true): void {
  if (!writable) throw new Error("FUTURE_VERSION_SAVE_IS_READ_ONLY");
  const checked = validateM4Save(state); if (!checked) throw new Error("Refusing to write invalid Hanzi Magic Chapter One save");
  const previous = storage.getItem(HANZI_MAGIC_M4_SAVE_KEY);
  if (previous !== null) { try { if (validateM4Save(JSON.parse(previous))) storage.setItem(HANZI_MAGIC_M4_SAVE_BACKUP_KEY, previous); } catch { /* recovery retains malformed raw */ } }
  storage.setItem(HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(checked));
}

export function updateM4Save(previous: M4SaveState, patch: Partial<Omit<M4SaveState, "schemaVersion" | "gameVersion" | "contentRevisionHash" | "validation">>): M4SaveState {
  const { validation: _validation, ...payload } = previous;
  const merged = { ...payload, ...patch };
  return withChecksum({ ...merged, repairedObjectIds: deriveM4Repairs(merged.discoveredCharacterIds, merged.completedRegionIds, merged.repairedObjectIds) });
}

export function syncM4SaveFromGame(previous: M4SaveState, state: M3GameState): M4SaveState {
  const discoveredCharacterIds = unique([...previous.discoveredCharacterIds, ...state.discoveredCharacterIds]).filter((id) => CHARACTER_IDS.has(id));
  const currentRegion = state.plan.regions[state.regionIndex].regionId;
  const completedRegionIds = unique([...previous.completedRegionIds, ...(state.phase === "region-complete" || state.phase === "run-summary" ? [currentRegion] : [])]);
  const runJustCompleted = state.phase === "run-summary" && previous.currentRun?.phase !== "run-summary";
  return updateM4Save(previous, {
    discoveredCharacterIds,
    completedRegionIds,
    repairedObjectIds: deriveM4Repairs(discoveredCharacterIds, completedRegionIds, previous.repairedObjectIds),
    selectedHeroId: state.heroId,
    seenAbilityIds: unique([...previous.seenAbilityIds, ...state.selectedAbilityIds]),
    currentRun: { seed: state.seed, heroId: state.heroId, phase: state.phase, regionIndex: state.regionIndex, encounterIndex: state.encounterIndex, actionCount: state.actionCount },
    minimalLocalEvents: {
      ...previous.minimalLocalEvents,
      completedRuns: previous.minimalLocalEvents.completedRuns + (runJustCompleted ? 1 : 0),
      completedRegions: Math.max(previous.minimalLocalEvents.completedRegions, completedRegionIds.length),
      lastPlayedAtUtc: new Date().toISOString(),
    },
  });
}

export function clearM4Save(storage: M1SessionStorage): void {
  storage.removeItem(HANZI_MAGIC_M4_SAVE_KEY);
  storage.removeItem(HANZI_MAGIC_M4_SAVE_BACKUP_KEY);
  storage.removeItem(HANZI_MAGIC_M4_SAVE_RECOVERY_KEY);
}

import { PILOT_SAVE_KEY } from "../save/schema";
import {
  GOLDEN_SLICE_SAVE_KEY,
  migrateStep02PilotSave,
  validateGoldenSliceSave,
  type GoldenSliceStorageLike,
} from "../golden-slice/save";
import {
  HANZI_MAGIC_V1_ADVENTURES,
  HANZI_MAGIC_V1_CONTENT_REVISION,
  HANZI_MAGIC_V1_CONTENT_VERSION,
  HANZI_MAGIC_V1_GAME_VERSION,
  type V1AdventureId,
} from "../golden-slice/content/adventures";
import type { AbilityId, GoldenCharacterId } from "../golden-slice/content/types";
import type { V1GameState, V1ProgressSeed, V1SafeRoute } from "./machine";

export const HANZI_MAGIC_V1_SAVE_SCHEMA_VERSION = 4 as const;
export const HANZI_MAGIC_V1_SAVE_KEY = GOLDEN_SLICE_SAVE_KEY;
export const HANZI_MAGIC_V1_SAVE_BACKUP_KEY = `${HANZI_MAGIC_V1_SAVE_KEY}.backup`;
export const HANZI_MAGIC_V1_SAVE_RECOVERY_KEY = `${HANZI_MAGIC_V1_SAVE_KEY}.recovery`;

export type V1InputMode = "auto" | "mouse" | "touch" | "keyboard";

export interface V1Settings {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly inputMode: V1InputMode;
}

export interface V1LocalSessionSummary {
  readonly completedRuns: number;
  readonly completedAdventureCount: number;
  readonly invalidPlacements: number;
  readonly lastPlayedAtUtc: string | null;
}

export interface V1SaveState {
  readonly schemaVersion: 4;
  readonly contentManifestVersion: typeof HANZI_MAGIC_V1_CONTENT_VERSION;
  readonly contentRevisionHash: string;
  readonly gameVersion: typeof HANZI_MAGIC_V1_GAME_VERSION;
  readonly completedAdventureIds: readonly V1AdventureId[];
  readonly unlockedAdventureIds: readonly V1AdventureId[];
  readonly discoveredCharacterIds: readonly GoldenCharacterId[];
  readonly campRepairStage: 0 | 1 | 2 | 3;
  readonly selectedAbilityHistory: readonly AbilityId[];
  readonly settings: V1Settings;
  readonly lastSafeRoute: V1SafeRoute | null;
  readonly minimalLocalSessionSummary: V1LocalSessionSummary;
  readonly validation: {
    readonly algorithm: "fnv1a32";
    readonly checksum: string;
  };
}

export interface V1SaveReadResult {
  readonly state: V1SaveState;
  readonly source: "fresh" | "v1" | "v1-backup" | "golden-slice-v3" | "step02";
  readonly recovered: boolean;
  readonly recoveryReason: "NONE" | "MALFORMED_JSON" | "INVALID_SHAPE" | "CHECKSUM_MISMATCH";
  readonly futureVersionProtected: boolean;
  readonly writable: boolean;
}

const ADVENTURE_IDS = new Set<V1AdventureId>(HANZI_MAGIC_V1_ADVENTURES.map((entry) => entry.id));
const CHARACTER_IDS = new Set<GoldenCharacterId>(["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"]);
const ABILITY_IDS = new Set<AbilityId>(["guardian-light", "star-path", "ink-echo"]);
const INPUT_MODES = new Set<V1InputMode>(["auto", "mouse", "touch", "keyboard"]);

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function checksumPayload(state: Omit<V1SaveState, "validation">): string {
  return fnv1a(JSON.stringify(state));
}

function withChecksum(state: Omit<V1SaveState, "validation">): V1SaveState {
  return { ...state, validation: { algorithm: "fnv1a32", checksum: checksumPayload(state) } };
}

export function createFreshV1Save(settings: Partial<V1Settings> = {}): V1SaveState {
  return withChecksum({
    schemaVersion: HANZI_MAGIC_V1_SAVE_SCHEMA_VERSION,
    contentManifestVersion: HANZI_MAGIC_V1_CONTENT_VERSION,
    contentRevisionHash: HANZI_MAGIC_V1_CONTENT_REVISION,
    gameVersion: HANZI_MAGIC_V1_GAME_VERSION,
    completedAdventureIds: [],
    unlockedAdventureIds: ["glimmer-path"],
    discoveredCharacterIds: [],
    campRepairStage: 0,
    selectedAbilityHistory: [],
    settings: { muted: settings.muted ?? false, reducedMotion: settings.reducedMotion ?? false, inputMode: settings.inputMode ?? "auto" },
    lastSafeRoute: null,
    minimalLocalSessionSummary: { completedRuns: 0, completedAdventureCount: 0, invalidPlacements: 0, lastPlayedAtUtc: null },
  });
}

function isUniqueAllowed<T extends string>(value: unknown, allowed: Set<T>): value is T[] {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((entry) => typeof entry === "string" && allowed.has(entry as T));
}

function isSafeRoute(value: unknown): value is V1SafeRoute {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const route = value as Record<string, unknown>;
  return Object.keys(route).sort().join("|") === "adventureId|encounterIndex|replay|selectedAbilityId"
    && typeof route.adventureId === "string" && ADVENTURE_IDS.has(route.adventureId as V1AdventureId)
    && Number.isInteger(route.encounterIndex) && Number(route.encounterIndex) >= 0 && Number(route.encounterIndex) <= 3
    && (route.selectedAbilityId === null || (typeof route.selectedAbilityId === "string" && ABILITY_IDS.has(route.selectedAbilityId as AbilityId)))
    && typeof route.replay === "boolean";
}

function validateV1SaveDetailed(value: unknown): { state: V1SaveState | null; reason: "INVALID_SHAPE" | "CHECKSUM_MISMATCH" | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: null, reason: "INVALID_SHAPE" };
  const save = value as Record<string, unknown>;
  const keys = ["campRepairStage", "completedAdventureIds", "contentManifestVersion", "contentRevisionHash", "discoveredCharacterIds", "gameVersion", "lastSafeRoute", "minimalLocalSessionSummary", "schemaVersion", "selectedAbilityHistory", "settings", "unlockedAdventureIds", "validation"];
  if (Object.keys(save).sort().join("|") !== keys.sort().join("|")) return { state: null, reason: "INVALID_SHAPE" };
  if (save.schemaVersion !== 4 || save.contentManifestVersion !== HANZI_MAGIC_V1_CONTENT_VERSION || save.gameVersion !== HANZI_MAGIC_V1_GAME_VERSION || save.contentRevisionHash !== HANZI_MAGIC_V1_CONTENT_REVISION) return { state: null, reason: "INVALID_SHAPE" };
  if (!isUniqueAllowed(save.completedAdventureIds, ADVENTURE_IDS) || !isUniqueAllowed(save.unlockedAdventureIds, ADVENTURE_IDS) || !isUniqueAllowed(save.discoveredCharacterIds, CHARACTER_IDS)) return { state: null, reason: "INVALID_SHAPE" };
  if (!Array.isArray(save.selectedAbilityHistory) || save.selectedAbilityHistory.some((id) => typeof id !== "string" || !ABILITY_IDS.has(id as AbilityId))) return { state: null, reason: "INVALID_SHAPE" };
  if (!Number.isInteger(save.campRepairStage) || Number(save.campRepairStage) < 0 || Number(save.campRepairStage) > 3) return { state: null, reason: "INVALID_SHAPE" };
  if (save.lastSafeRoute !== null && !isSafeRoute(save.lastSafeRoute)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.settings || typeof save.settings !== "object" || Array.isArray(save.settings)) return { state: null, reason: "INVALID_SHAPE" };
  const settings = save.settings as Record<string, unknown>;
  if (Object.keys(settings).sort().join("|") !== "inputMode|muted|reducedMotion" || typeof settings.muted !== "boolean" || typeof settings.reducedMotion !== "boolean" || typeof settings.inputMode !== "string" || !INPUT_MODES.has(settings.inputMode as V1InputMode)) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.minimalLocalSessionSummary || typeof save.minimalLocalSessionSummary !== "object" || Array.isArray(save.minimalLocalSessionSummary)) return { state: null, reason: "INVALID_SHAPE" };
  const summary = save.minimalLocalSessionSummary as Record<string, unknown>;
  if (Object.keys(summary).sort().join("|") !== "completedAdventureCount|completedRuns|invalidPlacements|lastPlayedAtUtc" || ![summary.completedRuns, summary.completedAdventureCount, summary.invalidPlacements].every((item) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 99999) || (summary.lastPlayedAtUtc !== null && (typeof summary.lastPlayedAtUtc !== "string" || Number.isNaN(Date.parse(summary.lastPlayedAtUtc))))) return { state: null, reason: "INVALID_SHAPE" };
  if (!save.validation || typeof save.validation !== "object" || Array.isArray(save.validation)) return { state: null, reason: "INVALID_SHAPE" };
  const validation = save.validation as Record<string, unknown>;
  if (Object.keys(validation).sort().join("|") !== "algorithm|checksum" || validation.algorithm !== "fnv1a32" || typeof validation.checksum !== "string") return { state: null, reason: "INVALID_SHAPE" };
  const { validation: omitted, ...payload } = save as unknown as V1SaveState;
  if (omitted.checksum !== checksumPayload(payload)) return { state: null, reason: "CHECKSUM_MISMATCH" };
  return { state: save as unknown as V1SaveState, reason: null };
}

export function validateV1Save(value: unknown): V1SaveState | null {
  return validateV1SaveDetailed(value).state;
}

function migrateGoldenSlice(value: unknown): V1SaveState | null {
  const legacy = validateGoldenSliceSave(value);
  if (!legacy) return null;
  const completed = legacy.completedRuns > 0;
  return withChecksum({
    schemaVersion: 4,
    contentManifestVersion: HANZI_MAGIC_V1_CONTENT_VERSION,
    contentRevisionHash: HANZI_MAGIC_V1_CONTENT_REVISION,
    gameVersion: HANZI_MAGIC_V1_GAME_VERSION,
    completedAdventureIds: completed ? ["glimmer-path"] : [],
    unlockedAdventureIds: completed ? ["glimmer-path", "garden-echo"] : ["glimmer-path"],
    discoveredCharacterIds: [...legacy.spellbookEntries],
    campRepairStage: completed || legacy.campState.lamp ? 1 : 0,
    selectedAbilityHistory: [...legacy.chosenAbilityHistory],
    settings: { ...legacy.settings, inputMode: "auto" },
    lastSafeRoute: null,
    minimalLocalSessionSummary: { completedRuns: legacy.completedRuns, completedAdventureCount: completed ? 1 : 0, invalidPlacements: 0, lastPlayedAtUtc: null },
  });
}

function captureRecovery(storage: GoldenSliceStorageLike, raw: string, reason: string): void {
  storage.setItem(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY, JSON.stringify({ schemaVersion: 1, reason, capturedAtUtc: new Date().toISOString(), raw }));
}

function readBackup(storage: GoldenSliceStorageLike): V1SaveState | null {
  const raw = storage.getItem(HANZI_MAGIC_V1_SAVE_BACKUP_KEY);
  if (!raw) return null;
  try { return validateV1Save(JSON.parse(raw)); } catch { return null; }
}

export function readV1Save(storage: GoldenSliceStorageLike): V1SaveReadResult {
  const raw = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY);
  if (raw !== null) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      captureRecovery(storage, raw, "MALFORMED_JSON");
      const backup = readBackup(storage);
      return { state: backup ?? createFreshV1Save(), source: backup ? "v1-backup" : "fresh", recovered: true, recoveryReason: "MALFORMED_JSON", futureVersionProtected: false, writable: true };
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).schemaVersion === "number" && Number((parsed as Record<string, unknown>).schemaVersion) > HANZI_MAGIC_V1_SAVE_SCHEMA_VERSION) {
      return { state: createFreshV1Save(), source: "fresh", recovered: false, recoveryReason: "NONE", futureVersionProtected: true, writable: false };
    }
    const v1 = validateV1SaveDetailed(parsed);
    if (v1.state) return { state: v1.state, source: "v1", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
    const migrated = migrateGoldenSlice(parsed);
    if (migrated) return { state: migrated, source: "golden-slice-v3", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
    captureRecovery(storage, raw, v1.reason ?? "INVALID_SHAPE");
    const backup = readBackup(storage);
    return { state: backup ?? createFreshV1Save(), source: backup ? "v1-backup" : "fresh", recovered: true, recoveryReason: v1.reason ?? "INVALID_SHAPE", futureVersionProtected: false, writable: true };
  }

  const pilotRaw = storage.getItem(PILOT_SAVE_KEY);
  if (pilotRaw !== null) {
    try {
      const legacy = migrateStep02PilotSave(JSON.parse(pilotRaw));
      const migrated = legacy ? migrateGoldenSlice(legacy) : null;
      if (migrated) return { state: migrated, source: "step02", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
    } catch { /* preserve the legacy source and start safely */ }
  }
  return { state: createFreshV1Save(), source: "fresh", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true };
}

export function writeV1Save(storage: GoldenSliceStorageLike, state: V1SaveState, writable = true): void {
  if (!writable) throw new Error("FUTURE_VERSION_SAVE_IS_READ_ONLY");
  const validated = validateV1Save(state);
  if (!validated) throw new Error("Refusing to write invalid Hanzi Magic V1 save");
  const previous = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY);
  if (previous !== null) {
    try {
      if (validateV1Save(JSON.parse(previous))) storage.setItem(HANZI_MAGIC_V1_SAVE_BACKUP_KEY, previous);
    } catch { /* malformed primary was already captured by readV1Save */ }
  }
  storage.setItem(HANZI_MAGIC_V1_SAVE_KEY, JSON.stringify(validated));
}

export function saveFromGameState(previous: V1SaveState, state: V1GameState): V1SaveState {
  const completedRuns = state.completedV1 && !previous.completedAdventureIds.includes("wind-footprints") ? previous.minimalLocalSessionSummary.completedRuns + 1 : previous.minimalLocalSessionSummary.completedRuns;
  return withChecksum({
    schemaVersion: 4,
    contentManifestVersion: HANZI_MAGIC_V1_CONTENT_VERSION,
    contentRevisionHash: HANZI_MAGIC_V1_CONTENT_REVISION,
    gameVersion: HANZI_MAGIC_V1_GAME_VERSION,
    completedAdventureIds: [...state.completedAdventureIds],
    unlockedAdventureIds: [...state.unlockedAdventureIds],
    discoveredCharacterIds: [...state.discoveredCharacterIds],
    campRepairStage: state.campRepairStage,
    selectedAbilityHistory: [...state.selectedAbilityHistory],
    settings: { ...previous.settings },
    lastSafeRoute: state.lastSafeRoute,
    minimalLocalSessionSummary: {
      completedRuns,
      completedAdventureCount: state.completedAdventureIds.length,
      invalidPlacements: Math.max(previous.minimalLocalSessionSummary.invalidPlacements, state.invalidPlacementCount),
      lastPlayedAtUtc: new Date().toISOString(),
    },
  });
}

export function updateV1Settings(state: V1SaveState, settings: Partial<V1Settings>): V1SaveState {
  const { validation: _validation, ...payload } = state;
  return withChecksum({ ...payload, settings: { ...state.settings, ...settings } });
}

export function progressFromV1Save(state: V1SaveState): V1ProgressSeed {
  return {
    completedAdventureIds: state.completedAdventureIds,
    unlockedAdventureIds: state.unlockedAdventureIds,
    discoveredCharacterIds: state.discoveredCharacterIds,
    campRepairStage: state.campRepairStage,
    selectedAbilityHistory: state.selectedAbilityHistory,
    lastSafeRoute: state.lastSafeRoute,
    freeAdventureUnlocked: state.completedAdventureIds.length === 3,
  };
}

export function clearV1Save(storage: GoldenSliceStorageLike): void {
  storage.removeItem(HANZI_MAGIC_V1_SAVE_KEY);
  storage.removeItem(HANZI_MAGIC_V1_SAVE_BACKUP_KEY);
  storage.removeItem(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY);
}

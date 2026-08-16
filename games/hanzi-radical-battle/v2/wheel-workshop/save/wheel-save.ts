import { PLAYABLE_WHEEL_MANIFEST, PLAYABLE_WHEEL_MANIFEST_REVISION, WHEEL_GRADE_OPTIONS } from "../library/playable-wheel-manifest";
import { createWheelWorkshopState, type WheelStateSeed } from "../machine/wheel-machine";
import type { WheelGradeSelection, WheelWorkshopState } from "../types";

export const WHEEL_WORKSHOP_SAVE_SCHEMA_VERSION = 1 as const;
export const WHEEL_WORKSHOP_SAVE_KEY = "family-games/hanzi-magic-v2/wheel-workshop/v1";

export interface WheelLastSafeState {
  readonly seed: string;
  readonly completedRoundCount: number;
  readonly resumeMode: "restart-current-round";
}

export interface WheelWorkshopSave {
  readonly schemaVersion: 1;
  readonly selectedGradeId: WheelGradeSelection;
  readonly discoveredRecordIds: readonly string[];
  readonly recentRecordIds: readonly string[];
  readonly lastSafeState: WheelLastSafeState | null;
  readonly contentRevision: string;
}

export interface WheelWorkshopSaveRead {
  readonly state: WheelWorkshopSave;
  readonly source: "fresh" | "v1" | "migrated-content" | "recovered-corrupt" | "future-read-only";
  readonly writable: boolean;
  readonly recovered: boolean;
  readonly futureVersionProtected: boolean;
}

export interface WheelStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const RECORD_IDS = new Set(PLAYABLE_WHEEL_MANIFEST.map((record) => record.id));
const GRADE_IDS = new Set<WheelGradeSelection>(WHEEL_GRADE_OPTIONS.map((entry) => entry.id));

export function createFreshWheelWorkshopSave(): WheelWorkshopSave {
  return { schemaVersion: 1, selectedGradeId: "journey", discoveredRecordIds: [], recentRecordIds: [], lastSafeState: null, contentRevision: PLAYABLE_WHEEL_MANIFEST_REVISION };
}

function uniqueAllowed(value: unknown): value is string[] {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((entry) => typeof entry === "string" && RECORD_IDS.has(entry));
}

function validateLastSafeState(value: unknown): value is WheelLastSafeState | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().join("|") === "completedRoundCount|resumeMode|seed"
    && typeof record.seed === "string" && record.seed.length > 0 && record.seed.length <= 160
    && Number.isInteger(record.completedRoundCount) && Number(record.completedRoundCount) >= 0 && Number(record.completedRoundCount) <= 3
    && record.resumeMode === "restart-current-round";
}

export function validateWheelWorkshopSave(value: unknown, allowRevisionMismatch = false): WheelWorkshopSave | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const save = value as Record<string, unknown>;
  if (Object.keys(save).sort().join("|") !== "contentRevision|discoveredRecordIds|lastSafeState|recentRecordIds|schemaVersion|selectedGradeId") return null;
  if (save.schemaVersion !== 1 || typeof save.selectedGradeId !== "string" || !GRADE_IDS.has(save.selectedGradeId as WheelGradeSelection)) return null;
  if (!uniqueAllowed(save.discoveredRecordIds) || !uniqueAllowed(save.recentRecordIds) || (save.recentRecordIds as string[]).length > 12 || !validateLastSafeState(save.lastSafeState)) return null;
  if (typeof save.contentRevision !== "string" || (!allowRevisionMismatch && save.contentRevision !== PLAYABLE_WHEEL_MANIFEST_REVISION)) return null;
  return save as unknown as WheelWorkshopSave;
}

export function readWheelWorkshopSave(storage: WheelStorageLike): WheelWorkshopSaveRead {
  const raw = storage.getItem(WHEEL_WORKSHOP_SAVE_KEY);
  if (raw === null) return { state: createFreshWheelWorkshopSave(), source: "fresh", writable: true, recovered: false, futureVersionProtected: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { state: createFreshWheelWorkshopSave(), source: "recovered-corrupt", writable: true, recovered: true, futureVersionProtected: false }; }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).schemaVersion === "number" && Number((parsed as Record<string, unknown>).schemaVersion) > 1) {
    return { state: createFreshWheelWorkshopSave(), source: "future-read-only", writable: false, recovered: false, futureVersionProtected: true };
  }
  const checked = validateWheelWorkshopSave(parsed, true);
  if (!checked) return { state: createFreshWheelWorkshopSave(), source: "recovered-corrupt", writable: true, recovered: true, futureVersionProtected: false };
  if (checked.contentRevision !== PLAYABLE_WHEEL_MANIFEST_REVISION) {
    const migrated: WheelWorkshopSave = { ...checked, discoveredRecordIds: checked.discoveredRecordIds.filter((id) => RECORD_IDS.has(id)), recentRecordIds: checked.recentRecordIds.filter((id) => RECORD_IDS.has(id)).slice(-12), lastSafeState: null, contentRevision: PLAYABLE_WHEEL_MANIFEST_REVISION };
    return { state: migrated, source: "migrated-content", writable: true, recovered: false, futureVersionProtected: false };
  }
  return { state: checked, source: "v1", writable: true, recovered: false, futureVersionProtected: false };
}

export function writeWheelWorkshopSave(storage: WheelStorageLike, save: WheelWorkshopSave, writable = true): void {
  if (!writable) throw new Error("FUTURE_WHEEL_SAVE_IS_READ_ONLY");
  const checked = validateWheelWorkshopSave(save);
  if (!checked) throw new Error("Refusing to write invalid Wheel Workshop save");
  storage.setItem(WHEEL_WORKSHOP_SAVE_KEY, JSON.stringify(checked));
}

export function wheelSaveFromState(state: WheelWorkshopState): WheelWorkshopSave {
  return {
    schemaVersion: 1,
    selectedGradeId: state.selectedGradeId,
    discoveredRecordIds: [...state.discoveredRecordIds],
    recentRecordIds: [...state.recentRecordIds].slice(-12),
    lastSafeState: state.phase === "finished" ? null : { seed: state.seed, completedRoundCount: state.completedRoundCount, resumeMode: "restart-current-round" },
    contentRevision: PLAYABLE_WHEEL_MANIFEST_REVISION,
  };
}

export function wheelStateFromSave(save: WheelWorkshopSave, fallbackSeed: string): WheelWorkshopState {
  const initial: WheelStateSeed = {
    selectedGradeId: save.selectedGradeId,
    discoveredRecordIds: save.discoveredRecordIds,
    recentRecordIds: save.recentRecordIds,
    completedRoundCount: save.lastSafeState?.completedRoundCount ?? 0,
  };
  return createWheelWorkshopState(save.lastSafeState?.seed ?? fallbackSeed, initial);
}

export function clearWheelWorkshopSave(storage: WheelStorageLike): void {
  storage.removeItem(WHEEL_WORKSHOP_SAVE_KEY);
}

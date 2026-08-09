import {
  cloneDefaultGoldenSliceSave,
  GOLDEN_SLICE_SAVE_KEY,
  validateGoldenSliceSave,
  type GoldenSliceSaveState,
} from "../../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import type { GoldenSliceStorageLike } from "../../../games/hanzi-radical-battle/v2/golden-slice/save/store";

export const STEP06_CANONICAL_ORIGIN = "http://127.0.0.1:5175";
export const STEP06_REQUIRED_CHARACTERS = ["ming", "hua", "lin", "xing"] as const;

export const STEP06_CONTINUITY_BLOCK_REASONS = [
  "WRONG_ORIGIN",
  "STORAGE_UNAVAILABLE",
  "CANONICAL_SAVE_MISSING",
  "CANONICAL_SAVE_CORRUPT",
  "RUN_NOT_COMPLETED",
  "SPELLBOOK_INCOMPLETE",
  "CAMP_REPAIRS_INCOMPLETE",
] as const;
export type Step06ContinuityBlockReason = (typeof STEP06_CONTINUITY_BLOCK_REASONS)[number];

export interface Step06ProgressContinuityProjection {
  readonly originMatched: boolean;
  readonly canonicalSavePresent: boolean;
  readonly completedAndComplete: boolean;
  readonly discoveredCharacterIds: readonly string[];
  readonly campRepairFlags: {
    readonly lamp: boolean;
    readonly flowers: boolean;
    readonly guardianTrees: boolean;
    readonly starPath: boolean;
  };
  readonly recoveredFromCorruption: boolean;
}

export type Step06ProgressContinuityResult =
  | { readonly ok: true; readonly projection: Step06ProgressContinuityProjection; readonly state: GoldenSliceSaveState }
  | { readonly ok: false; readonly code: "SECOND_USE_PROGRESS_CONTINUITY_BLOCKED"; readonly reason: Step06ContinuityBlockReason; readonly projection: Step06ProgressContinuityProjection };

const EMPTY_PROJECTION: Step06ProgressContinuityProjection = {
  originMatched: false,
  canonicalSavePresent: false,
  completedAndComplete: false,
  discoveredCharacterIds: [],
  campRepairFlags: { lamp: false, flowers: false, guardianTrees: false, starPath: false },
  recoveredFromCorruption: false,
};

function blocked(reason: Step06ContinuityBlockReason, projection: Step06ProgressContinuityProjection): Step06ProgressContinuityResult {
  return { ok: false, code: "SECOND_USE_PROGRESS_CONTINUITY_BLOCKED", reason, projection };
}

export function verifyStep06ProgressContinuity(
  origin: string,
  storage: GoldenSliceStorageLike,
): Step06ProgressContinuityResult {
  const originMatched = origin === STEP06_CANONICAL_ORIGIN;
  if (!originMatched) return blocked("WRONG_ORIGIN", { ...EMPTY_PROJECTION, originMatched: false });

  let raw: string | null;
  try {
    raw = storage.getItem(GOLDEN_SLICE_SAVE_KEY);
  } catch {
    return blocked("STORAGE_UNAVAILABLE", { ...EMPTY_PROJECTION, originMatched: true });
  }
  if (raw === null) return blocked("CANONICAL_SAVE_MISSING", { ...EMPTY_PROJECTION, originMatched: true });

  let state: GoldenSliceSaveState | null = null;
  try {
    state = validateGoldenSliceSave(JSON.parse(raw));
  } catch {
    // Invalid JSON is treated as corruption and is never repaired by this gate.
  }
  if (!state) {
    return blocked("CANONICAL_SAVE_CORRUPT", {
      ...EMPTY_PROJECTION,
      originMatched: true,
      canonicalSavePresent: true,
      recoveredFromCorruption: true,
    });
  }

  const ids = [...state.spellbookEntries];
  const campRepairFlags = {
    lamp: state.campState.lamp,
    flowers: ids.includes("hua"),
    guardianTrees: ids.includes("lin"),
    starPath: ids.includes("xing"),
  };
  const spellbookComplete = STEP06_REQUIRED_CHARACTERS.every((id) => ids.includes(id));
  const completedAndComplete = state.completedRuns > 0 && spellbookComplete && Object.values(campRepairFlags).every(Boolean);
  const projection: Step06ProgressContinuityProjection = {
    originMatched: true,
    canonicalSavePresent: true,
    completedAndComplete,
    discoveredCharacterIds: ids.filter((id) => STEP06_REQUIRED_CHARACTERS.includes(id as never)),
    campRepairFlags,
    recoveredFromCorruption: false,
  };
  if (state.completedRuns < 1) return blocked("RUN_NOT_COMPLETED", projection);
  if (!spellbookComplete) return blocked("SPELLBOOK_INCOMPLETE", projection);
  if (!Object.values(campRepairFlags).every(Boolean)) return blocked("CAMP_REPAIRS_INCOMPLETE", projection);
  return { ok: true, projection, state };
}

export function createStep06SyntheticCompleteSave(): GoldenSliceSaveState {
  return {
    ...cloneDefaultGoldenSliceSave(),
    completedRuns: 1,
    campState: { lamp: true },
    spellbookEntries: [...STEP06_REQUIRED_CHARACTERS],
  };
}

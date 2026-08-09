import { PILOT_SAVE_KEY } from "../../save/schema";
import {
  cloneDefaultGoldenSliceSave,
  GOLDEN_SLICE_SAVE_KEY,
  migrateStep02PilotSave,
  validateGoldenSliceSave,
  type GoldenSliceSaveReadResult,
  type GoldenSliceSaveState,
} from "./schema";

export interface GoldenSliceStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readGoldenSliceSave(storage: GoldenSliceStorageLike): GoldenSliceSaveReadResult {
  const raw = storage.getItem(GOLDEN_SLICE_SAVE_KEY);
  if (raw !== null) {
    try {
      const validated = validateGoldenSliceSave(JSON.parse(raw));
      if (validated) return { state: validated, recoveredFromCorruption: false, migratedFromStep02: false };
    } catch {
      // A malformed local value falls through to the calm new-game recovery below.
    }
    return { state: cloneDefaultGoldenSliceSave(), recoveredFromCorruption: true, migratedFromStep02: false };
  }

  const legacyRaw = storage.getItem(PILOT_SAVE_KEY);
  if (legacyRaw !== null) {
    try {
      const migrated = migrateStep02PilotSave(JSON.parse(legacyRaw));
      if (migrated) return { state: migrated, recoveredFromCorruption: false, migratedFromStep02: true };
    } catch {
      // The legacy value is preserved; the new slice starts cleanly if it cannot be read.
    }
  }
  return { state: cloneDefaultGoldenSliceSave(), recoveredFromCorruption: legacyRaw !== null, migratedFromStep02: false };
}

export function writeGoldenSliceSave(storage: GoldenSliceStorageLike, state: GoldenSliceSaveState): void {
  const validated = validateGoldenSliceSave(state);
  if (!validated) throw new Error("Refusing to write an invalid Hanzi V2 golden-slice save");
  storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(validated));
}

export function exportGoldenSliceSave(state: GoldenSliceSaveState): string {
  const validated = validateGoldenSliceSave(state);
  if (!validated) throw new Error("Refusing to export an invalid Hanzi V2 golden-slice save");
  return JSON.stringify(validated, null, 2);
}

/** Clears only the STEP 03 key, never unrelated local data or the STEP 02 pilot key. */
export function clearGoldenSliceSave(storage: GoldenSliceStorageLike): void {
  storage.removeItem(GOLDEN_SLICE_SAVE_KEY);
}

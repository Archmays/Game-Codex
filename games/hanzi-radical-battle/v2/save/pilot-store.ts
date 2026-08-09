import {
  DEFAULT_PILOT_SAVE,
  PILOT_SAVE_KEY,
  validatePilotSave,
  type PilotSaveReadResult,
  type PilotSaveState,
} from "./schema";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function cloneDefault(): PilotSaveState {
  return {
    ...DEFAULT_PILOT_SAVE,
    spellbookCharacterIds: [],
    minimumPilotEvents: [],
  };
}

export function readPilotSave(storage: StorageLike): PilotSaveReadResult {
  const raw = storage.getItem(PILOT_SAVE_KEY);
  if (raw === null) return { state: cloneDefault(), recoveredFromCorruption: false };
  try {
    const validated = validatePilotSave(JSON.parse(raw));
    if (validated) return { state: validated, recoveredFromCorruption: false };
  } catch {
    // The fallback below is deliberate: a damaged local save must not block play.
  }
  return { state: cloneDefault(), recoveredFromCorruption: true };
}

export function writePilotSave(storage: StorageLike, state: PilotSaveState): void {
  const validated = validatePilotSave(state);
  if (!validated) throw new Error("Refusing to write an invalid STEP 02 pilot save");
  storage.setItem(PILOT_SAVE_KEY, JSON.stringify(validated));
}

export function clearPilotSave(storage: StorageLike): void {
  storage.removeItem(PILOT_SAVE_KEY);
}

import { FIRST_RUN_CHARACTER_IDS } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import {
  cloneDefaultGoldenSliceSave,
  type GoldenSliceSaveReadResult,
  type GoldenSliceSaveState,
} from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import {
  readGoldenSliceSave,
  writeGoldenSliceSave,
  type GoldenSliceStorageLike,
} from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import type { GoldenCharacterId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";

export interface WorldHomeState {
  readonly save: GoldenSliceSaveState;
  readonly completedAndComplete: boolean;
  readonly recoveredCalmly: boolean;
  readonly discoveredCharacterIds: readonly GoldenCharacterId[];
  readonly camp: {
    readonly lamp: boolean;
    readonly flowers: boolean;
    readonly guardianTrees: boolean;
    readonly starPath: boolean;
  };
}

export interface WorldSettingsUpdateResult {
  readonly ok: boolean;
  readonly state: WorldHomeState;
}

function fallbackRead(): GoldenSliceSaveReadResult {
  return {
    state: cloneDefaultGoldenSliceSave(),
    recoveredFromCorruption: true,
    migratedFromStep02: false,
  };
}

export function readWorldHomeState(storage: GoldenSliceStorageLike): WorldHomeState {
  try {
    return deriveWorldHomeState(readGoldenSliceSave(storage));
  } catch {
    return deriveWorldHomeState(fallbackRead());
  }
}

export function deriveWorldHomeState(read: GoldenSliceSaveReadResult): WorldHomeState {
  const discovered = new Set(read.state.spellbookEntries);
  const discoveredCharacterIds = FIRST_RUN_CHARACTER_IDS.filter((id) => discovered.has(id));
  const completedAndComplete =
    read.state.completedRuns > 0 &&
    FIRST_RUN_CHARACTER_IDS.every((id) => discovered.has(id));

  return {
    save: read.state,
    completedAndComplete,
    recoveredCalmly: read.recoveredFromCorruption,
    discoveredCharacterIds,
    camp: {
      lamp: completedAndComplete || read.state.campState.lamp || discovered.has("ming"),
      flowers: completedAndComplete || discovered.has("hua"),
      guardianTrees: completedAndComplete || discovered.has("lin"),
      starPath: completedAndComplete || discovered.has("xing"),
    },
  };
}

export function updateExistingWorldSettings(
  storage: GoldenSliceStorageLike,
  current: WorldHomeState,
  settings: Partial<GoldenSliceSaveState["settings"]>,
): WorldSettingsUpdateResult {
  const nextSave: GoldenSliceSaveState = {
    ...current.save,
    settings: {
      ...current.save.settings,
      ...settings,
    },
  };
  try {
    writeGoldenSliceSave(storage, nextSave);
    return {
      ok: true,
      state: deriveWorldHomeState({
        state: nextSave,
        recoveredFromCorruption: false,
        migratedFromStep02: false,
      }),
    };
  } catch {
    return { ok: false, state: current };
  }
}

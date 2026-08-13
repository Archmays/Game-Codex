import { FIRST_RUN_CHARACTER_IDS } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import {
  cloneDefaultGoldenSliceSave,
  GOLDEN_SLICE_SAVE_KEY,
  type GoldenSliceSaveReadResult,
  type GoldenSliceSaveState,
} from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import {
  readGoldenSliceSave,
  writeGoldenSliceSave,
  type GoldenSliceStorageLike,
} from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import type { GoldenCharacterId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import {
  readV1Save,
  updateV1Settings,
  writeV1Save,
  type V1SaveState,
} from "../../games/hanzi-radical-battle/v2/v1/save";
import { HANZI_MAGIC_V1_ADVENTURES } from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";

export interface WorldHomeState {
  readonly save: GoldenSliceSaveState;
  readonly v1Save: V1SaveState | null;
  readonly v1Writable: boolean;
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
    const raw = storage.getItem(GOLDEN_SLICE_SAVE_KEY);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
        if (parsed?.schemaVersion === 4 || (typeof parsed?.schemaVersion === "number" && parsed.schemaVersion > 4)) {
          return deriveV1WorldHomeState(readV1Save(storage));
        }
      } catch {
        // Let the established calm-recovery path preserve its historical behavior.
      }
    }
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
    v1Save: null,
    v1Writable: false,
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

function deriveV1WorldHomeState(read: ReturnType<typeof readV1Save>): WorldHomeState {
  const discovered = new Set(read.state.discoveredCharacterIds);
  const completedAndComplete = HANZI_MAGIC_V1_ADVENTURES.every((adventure) => read.state.completedAdventureIds.includes(adventure.id));
  const compatibilitySave: GoldenSliceSaveState = {
    ...cloneDefaultGoldenSliceSave(),
    completedRuns: read.state.minimalLocalSessionSummary.completedRuns,
    lastRunSeed: "hanzi-magic-v1",
    campState: { lamp: read.state.campRepairStage >= 1 },
    spellbookEntries: [...read.state.discoveredCharacterIds],
    chosenAbilityHistory: [...read.state.selectedAbilityHistory],
    settings: { muted: read.state.settings.muted, reducedMotion: read.state.settings.reducedMotion },
  };
  return {
    save: compatibilitySave,
    v1Save: read.state,
    v1Writable: read.writable,
    completedAndComplete,
    recoveredCalmly: read.recovered,
    discoveredCharacterIds: [...read.state.discoveredCharacterIds],
    camp: {
      lamp: read.state.campRepairStage >= 1 || discovered.has("ming"),
      flowers: read.state.campRepairStage >= 2 || discovered.has("hua"),
      guardianTrees: read.state.campRepairStage >= 2 || discovered.has("lin"),
      starPath: read.state.campRepairStage >= 3 || discovered.has("xing"),
    },
  };
}

export function updateExistingWorldSettings(
  storage: GoldenSliceStorageLike,
  current: WorldHomeState,
  settings: Partial<GoldenSliceSaveState["settings"]>,
): WorldSettingsUpdateResult {
  if (current.v1Save) {
    if (!current.v1Writable) return { ok: false, state: current };
    try {
      const next = updateV1Settings(current.v1Save, settings);
      writeV1Save(storage, next);
      return { ok: true, state: deriveV1WorldHomeState({ state: next, source: "v1", recovered: false, recoveryReason: "NONE", futureVersionProtected: false, writable: true }) };
    } catch {
      return { ok: false, state: current };
    }
  }
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

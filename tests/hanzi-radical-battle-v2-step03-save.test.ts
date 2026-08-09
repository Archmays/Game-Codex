import { PILOT_SAVE_KEY } from "../games/hanzi-radical-battle/v2/save/schema";
import {
  clearGoldenSliceSave,
  DEFAULT_GOLDEN_SLICE_SAVE,
  exportGoldenSliceSave,
  GOLDEN_SLICE_SAVE_KEY,
  LOCAL_PLAYTEST_EVENT_FIELDS,
  readGoldenSliceSave,
  validateGoldenSliceSave,
  writeGoldenSliceSave,
  type GoldenSliceStorageLike,
} from "../games/hanzi-radical-battle/v2/golden-slice/save";

function memoryStorage(initial?: Record<string, string>): GoldenSliceStorageLike & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function localPlaytestEvent() {
  return {
    schemaVersion: 1 as const,
    sessionId: "session-step03-a1",
    runSeed: "hanzi-v2-golden-slice-v1",
    firstActionMs: 620,
    firstSpellMs: 44500,
    segmentDurationsMs: {
      camp: 12000,
      battle_1: 42000,
      breather: 5000,
      battle_2: 38000,
      ability_choice: 7000,
      boss_phase_1: 45000,
      boss_phase_2: 42000,
      return_to_camp: 12000,
      spellbook: 9000,
    },
    invalidPlacementCountByEncounter: { "encounter-ming": 0, "encounter-hua": 1, "boss-lin": 1, "boss-xing": 0 },
    maxHintLevelByEncounter: { "encounter-ming": 0, "encounter-hua": 1, "boss-lin": 1, "boss-xing": 0 },
    chosenAbilityId: "star-path" as const,
    bossPhaseRetryCount: { lin: 1, xing: 0 },
    completed: true,
    replayClicked: false,
    muted: false,
    reducedMotion: true,
    viewportClass: "desktop" as const,
  };
}

describe("Hanzi V2 STEP 03 local golden-slice save", () => {
  it("writes the exact namespaced, versioned progress contract with a strict local session summary", () => {
    expect(GOLDEN_SLICE_SAVE_KEY).toBe("family-games/hanzi-radical-battle-v2/golden-slice/state");
    const storage = memoryStorage();
    const state = {
      ...DEFAULT_GOLDEN_SLICE_SAVE,
      completedRuns: 1,
      campState: { lamp: true },
      spellbookEntries: ["ming", "hua"] as const,
      chosenAbilityHistory: ["star-path"] as const,
      localPlaytestEvents: [localPlaytestEvent()],
    };
    writeGoldenSliceSave(storage, state);
    const raw = JSON.parse(storage.getItem(GOLDEN_SLICE_SAVE_KEY)!);
    expect(Object.keys(raw).sort()).toEqual([
      "campState", "chosenAbilityHistory", "completedRuns", "contentRevisionHash", "lastRunSeed", "localPlaytestEvents", "schemaVersion", "settings", "spellbookEntries",
    ]);
    expect(Object.keys(raw.localPlaytestEvents[0]).sort()).toEqual([...LOCAL_PLAYTEST_EVENT_FIELDS].sort());
    expect(exportGoldenSliceSave(state)).toContain('"schemaVersion": 3');
    expect(readGoldenSliceSave(storage)).toMatchObject({
      recoveredFromCorruption: false,
      migratedFromStep02: false,
      state: { completedRuns: 1, campState: { lamp: true }, spellbookEntries: ["ming", "hua"] },
    });
  });

  it("migrates requested STEP 02 pilot fields into campState, spellbookEntries, and settings without mutating the old key", () => {
    const pilot = {
      schemaVersion: 1,
      campLampRepaired: true,
      spellbookCharacterIds: ["ming"],
      muted: true,
      reducedMotion: true,
      selectedThemeForReview: "C",
      minimumPilotEvents: ["pilot_opened", "camp_repaired", "spellbook_opened", "pilot_completed"],
    };
    const storage = memoryStorage({ [PILOT_SAVE_KEY]: JSON.stringify(pilot) });
    const migrated = readGoldenSliceSave(storage);
    expect(migrated).toMatchObject({ migratedFromStep02: true, recoveredFromCorruption: false });
    expect(migrated.state.completedRuns).toBe(1);
    expect(migrated.state.campState).toEqual({ lamp: true });
    expect(migrated.state.spellbookEntries).toEqual(["ming"]);
    expect(migrated.state.settings).toEqual({ muted: true, reducedMotion: true });
    expect(migrated.state.localPlaytestEvents).toEqual([]);
    expect(storage.getItem(PILOT_SAVE_KEY)).toBeTruthy();
  });

  it("recovers from corruption, rejects unknown/free-text fields, and clears only its own key", () => {
    expect(validateGoldenSliceSave({ ...DEFAULT_GOLDEN_SLICE_SAVE, childName: "private" })).toBeNull();
    expect(validateGoldenSliceSave({
      ...DEFAULT_GOLDEN_SLICE_SAVE,
      localPlaytestEvents: [{ ...localPlaytestEvent(), note: "private" }],
    })).toBeNull();
    expect(validateGoldenSliceSave({
      ...DEFAULT_GOLDEN_SLICE_SAVE,
      localPlaytestEvents: [{ ...localPlaytestEvent(), sessionId: "Child Wang" }],
    })).toBeNull();
    const storage = memoryStorage({ [GOLDEN_SLICE_SAVE_KEY]: "{broken", unrelated: "keep", [PILOT_SAVE_KEY]: "keep-pilot" });
    expect(readGoldenSliceSave(storage)).toMatchObject({ recoveredFromCorruption: true, migratedFromStep02: false, state: DEFAULT_GOLDEN_SLICE_SAVE });
    clearGoldenSliceSave(storage);
    expect(storage.getItem(GOLDEN_SLICE_SAVE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(storage.getItem(PILOT_SAVE_KEY)).toBe("keep-pilot");
  });
});

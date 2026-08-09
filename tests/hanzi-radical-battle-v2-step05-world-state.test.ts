import { PILOT_SAVE_KEY } from "../games/hanzi-radical-battle/v2/save/schema";
import {
  GOLDEN_SLICE_SAVE_KEY,
  cloneDefaultGoldenSliceSave,
  type GoldenSliceSaveState,
} from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { writeGoldenSliceSave, type GoldenSliceStorageLike } from "../games/hanzi-radical-battle/v2/golden-slice/save/store";
import {
  readWorldHomeState,
  updateExistingWorldSettings,
} from "../apps/my-game-world/world-state";

class MemoryStorage implements GoldenSliceStorageLike {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); this.writes.push(key); }
  removeItem(key: string): void { this.values.delete(key); }
}

function completedSave(overrides: Partial<GoldenSliceSaveState> = {}): GoldenSliceSaveState {
  return {
    ...cloneDefaultGoldenSliceSave(),
    completedRuns: 1,
    campState: { lamp: true },
    spellbookEntries: ["ming", "hua", "lin", "xing"],
    chosenAbilityHistory: ["star-path"],
    ...overrides,
  };
}

describe("Hanzi V2 STEP 05 private-world state", () => {
  it("projects a calm unrepaired world when no save exists", () => {
    const world = readWorldHomeState(new MemoryStorage());
    expect(world.completedAndComplete).toBe(false);
    expect(world.discoveredCharacterIds).toEqual([]);
    expect(world.camp).toEqual({ lamp: false, flowers: false, guardianTrees: false, starPath: false });
    expect(world.recoveredCalmly).toBe(false);
  });

  it("projects the repaired camp and canonical four-character order from the existing v3 save", () => {
    const storage = new MemoryStorage();
    writeGoldenSliceSave(storage, completedSave({ spellbookEntries: ["xing", "lin", "hua", "ming", "cao"] }));
    const world = readWorldHomeState(storage);
    expect(world.completedAndComplete).toBe(true);
    expect(world.discoveredCharacterIds).toEqual(["ming", "hua", "lin", "xing"]);
    expect(world.camp).toEqual({ lamp: true, flowers: true, guardianTrees: true, starPath: true });
  });

  it("uses canonical STEP 02 migration but never calls a Ming-only migrated save fully repaired", () => {
    const storage = new MemoryStorage();
    storage.values.set(PILOT_SAVE_KEY, JSON.stringify({
      schemaVersion: 1,
      campLampRepaired: true,
      spellbookCharacterIds: ["ming"],
      muted: true,
      reducedMotion: true,
      selectedThemeForReview: "C",
      minimumPilotEvents: ["pilot_opened", "character_formed", "spell_cast", "camp_repaired", "pilot_completed"],
    }));
    const world = readWorldHomeState(storage);
    expect(world.save.completedRuns).toBe(1);
    expect(world.completedAndComplete).toBe(false);
    expect(world.discoveredCharacterIds).toEqual(["ming"]);
    expect(world.camp).toEqual({ lamp: true, flowers: false, guardianTrees: false, starPath: false });
  });

  it("falls back without crashing for malformed values and throwing storage", () => {
    const corrupt = new MemoryStorage();
    corrupt.values.set(GOLDEN_SLICE_SAVE_KEY, "{broken");
    expect(readWorldHomeState(corrupt)).toMatchObject({ completedAndComplete: false, recoveredCalmly: true });
    const throwing: GoldenSliceStorageLike = {
      getItem() { throw new Error("storage denied"); },
      setItem() { throw new Error("storage denied"); },
      removeItem() { throw new Error("storage denied"); },
    };
    expect(readWorldHomeState(throwing)).toMatchObject({ completedAndComplete: false, recoveredCalmly: true });
  });

  it("updates only existing v3 settings and preserves every progress field", () => {
    const storage = new MemoryStorage();
    const before = completedSave({ completedRuns: 2, lastRunSeed: "preserve-this-seed" });
    writeGoldenSliceSave(storage, before);
    storage.writes.length = 0;
    const current = readWorldHomeState(storage);
    const updated = updateExistingWorldSettings(storage, current, { muted: true, reducedMotion: true });
    expect(updated.ok).toBe(true);
    expect(storage.writes).toEqual([GOLDEN_SLICE_SAVE_KEY]);
    expect(updated.state.save).toEqual({ ...before, settings: { muted: true, reducedMotion: true } });
    expect([...storage.values.keys()]).toEqual([GOLDEN_SLICE_SAVE_KEY]);
  });
});

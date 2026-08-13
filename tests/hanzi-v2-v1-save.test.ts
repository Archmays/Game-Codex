import { cloneDefaultGoldenSliceSave, GOLDEN_SLICE_SAVE_KEY } from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { DEFAULT_PILOT_SAVE, PILOT_SAVE_KEY } from "../games/hanzi-radical-battle/v2/save/schema";
import { createV1GameState, stepV1Game } from "../games/hanzi-radical-battle/v2/v1/machine";
import {
  HANZI_MAGIC_V1_SAVE_BACKUP_KEY,
  HANZI_MAGIC_V1_SAVE_RECOVERY_KEY,
  createFreshV1Save,
  progressFromV1Save,
  readV1Save,
  saveFromGameState,
  updateV1Settings,
  validateV1Save,
  writeV1Save,
} from "../games/hanzi-radical-battle/v2/v1/save";

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes.push(key); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Hanzi Magic V1 save migration and recovery", () => {
  it("creates and round-trips a checksum-bound fresh save", () => {
    const storage = new MemoryStorage();
    const fresh = createFreshV1Save();
    expect(validateV1Save(fresh)).toEqual(fresh);
    writeV1Save(storage, fresh);
    expect(readV1Save(storage)).toMatchObject({ source: "v1", recovered: false, writable: true, state: fresh });
  });

  it("migrates a completed Golden Slice without losing the four accepted discoveries", () => {
    const storage = new MemoryStorage();
    storage.values.set(GOLDEN_SLICE_SAVE_KEY, JSON.stringify({
      ...cloneDefaultGoldenSliceSave(), completedRuns: 1, campState: { lamp: true },
      spellbookEntries: ["xing", "ming", "hua", "lin"], chosenAbilityHistory: ["star-path"],
    }));
    const migrated = readV1Save(storage);
    expect(migrated.source).toBe("golden-slice-v3");
    expect(migrated.state.completedAdventureIds).toEqual(["glimmer-path"]);
    expect(migrated.state.unlockedAdventureIds).toEqual(["glimmer-path", "garden-echo"]);
    expect(migrated.state.discoveredCharacterIds).toEqual(["xing", "ming", "hua", "lin"]);
    expect(migrated.state.campRepairStage).toBe(1);
  });

  it("migrates a STEP02 pilot without deleting the legacy source", () => {
    const storage = new MemoryStorage();
    const pilot = {
      ...DEFAULT_PILOT_SAVE,
      campLampRepaired: true,
      spellbookCharacterIds: ["ming", "hua", "deferred-character"],
      muted: true,
      reducedMotion: true,
      minimumPilotEvents: ["pilot_completed"],
    };
    const raw = JSON.stringify(pilot);
    storage.values.set(PILOT_SAVE_KEY, raw);
    const migrated = readV1Save(storage);
    expect(migrated).toMatchObject({ source: "step02", recovered: false, writable: true });
    expect(migrated.state).toMatchObject({
      completedAdventureIds: ["glimmer-path"],
      unlockedAdventureIds: ["glimmer-path", "garden-echo"],
      discoveredCharacterIds: ["ming", "hua"],
      campRepairStage: 1,
      settings: { muted: true, reducedMotion: true, inputMode: "auto" },
    });
    expect(storage.values.get(PILOT_SAVE_KEY)).toBe(raw);
    expect(storage.writes).toEqual([]);
  });

  it("restores a partial adventure at its last safe encounter without copying transient board state", () => {
    const storage = new MemoryStorage();
    let state = createV1GameState("partial-resume");
    state = stepV1Game(state, { type: "start-adventure", adventureId: "glimmer-path" });
    state = stepV1Game(state, { type: "begin-adventure" });
    const save = saveFromGameState(createFreshV1Save(), state);
    writeV1Save(storage, save);
    const restored = createV1GameState("partial-resume", progressFromV1Save(readV1Save(storage).state));
    expect(restored.phase).toBe("encounter");
    expect(restored.currentEncounterId).toBe("v1-ming");
    expect(restored.placements).toEqual([]);
  });

  it("captures malformed and checksum-mismatched primaries before calm recovery", () => {
    const malformed = new MemoryStorage();
    malformed.values.set(GOLDEN_SLICE_SAVE_KEY, "{broken");
    expect(readV1Save(malformed)).toMatchObject({ recovered: true, recoveryReason: "MALFORMED_JSON", source: "fresh" });
    expect(malformed.values.get(GOLDEN_SLICE_SAVE_KEY)).toBe("{broken");
    expect(malformed.values.get(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY)).toContain("{broken");

    const mismatch = new MemoryStorage();
    const save = createFreshV1Save();
    mismatch.values.set(GOLDEN_SLICE_SAVE_KEY, JSON.stringify({ ...save, validation: { ...save.validation, checksum: "fnv1a32:00000000" } }));
    expect(readV1Save(mismatch)).toMatchObject({ recovered: true, recoveryReason: "CHECKSUM_MISMATCH" });
    expect(mismatch.values.has(HANZI_MAGIC_V1_SAVE_RECOVERY_KEY)).toBe(true);
  });

  it("uses a valid backup and protects unknown future versions from writes", () => {
    const backup = new MemoryStorage();
    const valid = createFreshV1Save({ muted: true });
    backup.values.set(HANZI_MAGIC_V1_SAVE_BACKUP_KEY, JSON.stringify(valid));
    backup.values.set(GOLDEN_SLICE_SAVE_KEY, "{broken");
    expect(readV1Save(backup)).toMatchObject({ source: "v1-backup", state: valid });

    const future = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 99, future: true });
    future.values.set(GOLDEN_SLICE_SAVE_KEY, raw);
    expect(readV1Save(future)).toMatchObject({ futureVersionProtected: true, writable: false });
    expect(future.values.get(GOLDEN_SLICE_SAVE_KEY)).toBe(raw);
    expect(future.writes).toEqual([]);
  });

  it("persists muted, reduced-motion, and input-mode settings with a new checksum", () => {
    const updated = updateV1Settings(createFreshV1Save(), { muted: true, reducedMotion: true, inputMode: "keyboard" });
    expect(validateV1Save(updated)?.settings).toEqual({ muted: true, reducedMotion: true, inputMode: "keyboard" });
  });
});

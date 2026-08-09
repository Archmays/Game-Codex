import {
  clearPilotSave,
  readPilotSave,
  writePilotSave,
  type StorageLike,
} from "../games/hanzi-radical-battle/v2/save/pilot-store";
import {
  DEFAULT_PILOT_SAVE,
  PILOT_SAVE_KEY,
  validatePilotSave,
} from "../games/hanzi-radical-battle/v2/save/schema";

function memoryStorage(initial?: Record<string, string>): StorageLike & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("Hanzi V2 STEP 02 local save", () => {
  it("uses the exact versioned pilot namespace and writes only approved fields", () => {
    expect(PILOT_SAVE_KEY).toBe("family-games/hanzi-radical-battle-v2-pilot/state");
    const storage = memoryStorage();
    writePilotSave(storage, {
      ...DEFAULT_PILOT_SAVE,
      campLampRepaired: true,
      spellbookCharacterIds: ["ming"],
      selectedThemeForReview: "B",
      minimumPilotEvents: ["pilot_opened", "camp_repaired", "spellbook_opened"],
    });
    const raw = storage.getItem(PILOT_SAVE_KEY);
    expect(raw).toBeTruthy();
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual(
      [
        "schemaVersion",
        "campLampRepaired",
        "spellbookCharacterIds",
        "muted",
        "reducedMotion",
        "selectedThemeForReview",
        "minimumPilotEvents",
      ].sort(),
    );
    expect(readPilotSave(storage)).toEqual({
      state: expect.objectContaining({ campLampRepaired: true, spellbookCharacterIds: ["ming"] }),
      recoveredFromCorruption: false,
    });
  });

  it("rejects unknown fields, bad enums, duplicate spellbook ids, and non-event data", () => {
    expect(validatePilotSave({ ...DEFAULT_PILOT_SAVE, childName: "private" })).toBeNull();
    expect(validatePilotSave({ ...DEFAULT_PILOT_SAVE, selectedThemeForReview: "D" })).toBeNull();
    expect(validatePilotSave({ ...DEFAULT_PILOT_SAVE, spellbookCharacterIds: ["ming", "ming"] })).toBeNull();
    expect(validatePilotSave({ ...DEFAULT_PILOT_SAVE, minimumPilotEvents: ["free text"] })).toBeNull();
  });

  it("recovers safely from malformed or incompatible local data", () => {
    for (const raw of ["{broken", JSON.stringify({ schemaVersion: 99 }), JSON.stringify(null)]) {
      const storage = memoryStorage({ [PILOT_SAVE_KEY]: raw });
      expect(readPilotSave(storage)).toEqual({ state: DEFAULT_PILOT_SAVE, recoveredFromCorruption: true });
    }
  });

  it("clears only the pilot namespace", () => {
    const storage = memoryStorage({ [PILOT_SAVE_KEY]: JSON.stringify(DEFAULT_PILOT_SAVE), unrelated: "keep" });
    clearPilotSave(storage);
    expect(storage.getItem(PILOT_SAVE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });
});

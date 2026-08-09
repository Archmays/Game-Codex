import {
  createStep06SyntheticCompleteSave,
  STEP06_CANONICAL_ORIGIN,
  verifyStep06ProgressContinuity,
} from "../apps/my-game-world/second-use/progress-continuity";
import { GOLDEN_SLICE_SAVE_KEY } from "../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { PILOT_SAVE_KEY } from "../games/hanzi-radical-battle/v2/save/schema";

class MemoryStorage {
  readonly values = new Map<string, string>();
  fail = false;
  getItem(key: string) { if (this.fail) throw new Error("unavailable"); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const verify = (storage: MemoryStorage) => verifyStep06ProgressContinuity(STEP06_CANONICAL_ORIGIN, storage);

describe("Hanzi V2 STEP 06 progress continuity fail-closed gate", () => {
  it("accepts a complete canonical fixture without reconstructing anything", () => {
    const storage = new MemoryStorage();
    const complete = createStep06SyntheticCompleteSave();
    storage.setItem(GOLDEN_SLICE_SAVE_KEY, JSON.stringify(complete));
    expect(verify(storage)).toMatchObject({ ok: true, projection: { canonicalSavePresent: true, completedAndComplete: true, recoveredFromCorruption: false } });
    expect(JSON.parse(storage.getItem(GOLDEN_SLICE_SAVE_KEY)!)).toEqual(complete);
  });

  it.each([
    ["missing", null, "CANONICAL_SAVE_MISSING"],
    ["corrupt", "{broken", "CANONICAL_SAVE_CORRUPT"],
    ["partial run", JSON.stringify({ ...createStep06SyntheticCompleteSave(), completedRuns: 0 }), "RUN_NOT_COMPLETED"],
    ["missing character", JSON.stringify({ ...createStep06SyntheticCompleteSave(), spellbookEntries: ["ming", "hua", "lin"] }), "SPELLBOOK_INCOMPLETE"],
    ["lamp false", JSON.stringify({ ...createStep06SyntheticCompleteSave(), campState: { lamp: false } }), "CAMP_REPAIRS_INCOMPLETE"],
  ])("blocks %s", (_label, raw, reason) => {
    const storage = new MemoryStorage();
    if (raw !== null) storage.setItem(GOLDEN_SLICE_SAVE_KEY, raw);
    expect(verify(storage)).toMatchObject({ ok: false, code: "SECOND_USE_PROGRESS_CONTINUITY_BLOCKED", reason });
  });

  it("blocks STEP 02-only migration and unavailable/private-like storage", () => {
    const legacy = new MemoryStorage();
    legacy.setItem(PILOT_SAVE_KEY, "{}");
    expect(verify(legacy)).toMatchObject({ ok: false, reason: "CANONICAL_SAVE_MISSING" });
    const unavailable = new MemoryStorage(); unavailable.fail = true;
    expect(verify(unavailable)).toMatchObject({ ok: false, reason: "STORAGE_UNAVAILABLE" });
  });
});

import { CHAPTER_ONE_CHARACTER_IDS } from "../games/hanzi-radical-battle/v2/chapter-one/characters";
import { M4_REPAIR_IDS, M4_REPAIR_OBJECTS, deriveM4Repairs } from "../games/hanzi-radical-battle/v2/chapter-one/camp";
import { createM3GameState, reduceM3State, simulateM3Run } from "../games/hanzi-radical-battle/v2/chapter-one/m3-machine";
import {
  HANZI_MAGIC_M4_SAVE_BACKUP_KEY,
  HANZI_MAGIC_M4_SAVE_KEY,
  HANZI_MAGIC_M4_SAVE_RECOVERY_KEY,
  HANZI_MAGIC_M4_V1_RAW_KEY,
  clearM4Save,
  createFreshM4Save,
  readM4Save,
  syncM4SaveFromGame,
  updateM4Save,
  validateM4Save,
  writeM4Save,
} from "../games/hanzi-radical-battle/v2/chapter-one/m4-save";
import { CHAPTER_ONE_SPELLBOOK } from "../games/hanzi-radical-battle/v2/chapter-one/spellbook";
import { createV1GameState } from "../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, writeV1Save } from "../games/hanzi-radical-battle/v2/v1/save";

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes.push(key); }
  removeItem(key: string) { this.values.delete(key); }
}

const V1_IDS = ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"] as const;

describe("Hanzi Magic Battle V2 Chapter One M4 persistence", () => {
  it("defines exactly eight meaningful before-and-after camp objects", () => {
    expect(M4_REPAIR_IDS).toHaveLength(8);
    expect(new Set(M4_REPAIR_IDS).size).toBe(8);
    for (const repair of M4_REPAIR_OBJECTS) {
      expect(repair.beforeShape).not.toBe(repair.afterShape);
      expect(repair.beforeColor).not.toBe(repair.afterColor);
      expect(repair.beforeFunction).not.toBe(repair.afterFunction);
      expect(repair.childValue.length).toBeGreaterThanOrEqual(8);
      expect(repair.hanziLearningValue.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("contains 36 complete spellbook entries with all three replays and an etymology boundary", () => {
    expect(CHAPTER_ONE_SPELLBOOK).toHaveLength(36);
    expect(new Set(CHAPTER_ONE_SPELLBOOK.map((entry) => entry.characterId)).size).toBe(36);
    for (const entry of CHAPTER_ONE_SPELLBOOK) {
      expect(entry).toMatchObject({ replayPronunciation: true, replayFormation: true, replayMeaningMagic: true, meaningImageDisclaimer: "这是字义联想，不是字源说明" });
      expect(entry.componentGlyphs.length).toBeGreaterThanOrEqual(2);
      expect(entry.worldAssociation.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("migrates the V1 twelve discoveries and exactly three repairs while preserving raw bytes", () => {
    const storage = new MemoryStorage();
    const legacyState = createV1GameState("v1-migration", {
      completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      unlockedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      discoveredCharacterIds: V1_IDS,
      campRepairStage: 3,
      selectedAbilityHistory: ["guardian-light", "star-path", "ink-echo"],
      freeAdventureUnlocked: true,
    });
    const legacySave = saveFromGameState(createFreshV1Save({ muted: true, reducedMotion: true, inputMode: "keyboard" }), legacyState);
    writeV1Save(storage, legacySave);
    const raw = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)!;
    const migrated = readM4Save(storage);
    expect(migrated).toMatchObject({ source: "v1-migrated", recovered: false, writable: true });
    expect(migrated.state.discoveredCharacterIds).toEqual(V1_IDS);
    expect(migrated.state.repairedObjectIds).toEqual(["camp-lamp", "garden-path", "world-gate"]);
    expect(migrated.state.settings).toEqual({ muted: true, reducedMotion: true, inputMode: "keyboard" });
    expect(migrated.state.migration).toEqual({ source: "v1-schema-4", v1RawPreserved: true });
    expect(storage.getItem(HANZI_MAGIC_M4_V1_RAW_KEY)).toBe(raw);
    expect(storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)).toBe(raw);
  });

  it("grants all eight durable repairs after a migrated player completes V2 Chapter One", () => {
    const storage = new MemoryStorage();
    const legacyState = createV1GameState("v1-then-v2", {
      completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      unlockedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      discoveredCharacterIds: V1_IDS,
      campRepairStage: 3,
      freeAdventureUnlocked: true,
    });
    writeV1Save(storage, saveFromGameState(createFreshV1Save(), legacyState));
    let save = readM4Save(storage).state;
    const result = simulateM3Run("migrated-v2-completion", "light-speaker");
    let state = createM3GameState("migrated-v2-completion", "light-speaker");
    for (const action of result.actions) { state = reduceM3State(state, action); save = syncM4SaveFromGame(save, state); }
    expect(state.phase).toBe("run-summary");
    expect(save.repairedObjectIds).toEqual(M4_REPAIR_IDS);
    expect(validateM4Save(save)).toEqual(save);
  });

  it("persists at least four repairs through one full V2 run without scores or detailed input history", () => {
    const result = simulateM3Run("m4-first-story", "forest-speaker");
    let state = createM3GameState("m4-first-story", "forest-speaker");
    let save = createFreshM4Save();
    for (const action of result.actions) { state = reduceM3State(state, action); save = syncM4SaveFromGame(save, state); }
    expect(state.phase).toBe("run-summary");
    expect(save.discoveredCharacterIds).toHaveLength(15);
    expect(save.repairedObjectIds.length).toBeGreaterThanOrEqual(4);
    expect(save.completedRegionIds).toEqual(["glimmer-grove", "echo-garden", "wind-trail"]);
    expect(save.selectedHeroId).toBe("forest-speaker");
    expect(save.seenAbilityIds).toHaveLength(3);
    expect(JSON.stringify(save)).not.toMatch(/score|streak|rank|keypress|keyHistory/i);
    expect(validateM4Save(save)).toEqual(save);
  });

  it("reaches all eight repairs only from persistent discovery progress", () => {
    const full = updateM4Save(createFreshM4Save(), {
      discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS,
      completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"],
      repairedObjectIds: deriveM4Repairs(CHAPTER_ONE_CHARACTER_IDS, ["glimmer-grove", "echo-garden", "wind-trail"]),
    });
    expect(full.repairedObjectIds).toEqual(M4_REPAIR_IDS);
    expect(validateM4Save(full)).toEqual(full);
  });

  it("captures malformed and checksum-mismatched primary bytes and recovers a valid backup", () => {
    const malformed = new MemoryStorage();
    malformed.values.set(HANZI_MAGIC_M4_SAVE_KEY, "{broken");
    expect(readM4Save(malformed)).toMatchObject({ recovered: true, recoveryReason: "MALFORMED_JSON", source: "fresh" });
    expect(malformed.getItem(HANZI_MAGIC_M4_SAVE_RECOVERY_KEY)).toContain("{broken");

    const mismatch = new MemoryStorage();
    const save = createFreshM4Save();
    mismatch.values.set(HANZI_MAGIC_M4_SAVE_BACKUP_KEY, JSON.stringify(save));
    mismatch.values.set(HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify({ ...save, validation: { ...save.validation, checksum: "fnv1a32:00000000" } }));
    expect(readM4Save(mismatch)).toMatchObject({ recovered: true, recoveryReason: "CHECKSUM_MISMATCH", source: "v2-backup", state: save });
    expect(mismatch.getItem(HANZI_MAGIC_M4_SAVE_RECOVERY_KEY)).toContain("fnv1a32:00000000");
  });

  it("protects an unknown future version from writes", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 99, futureField: "keep-me" });
    storage.values.set(HANZI_MAGIC_M4_SAVE_KEY, raw);
    const read = readM4Save(storage);
    expect(read).toMatchObject({ futureVersionProtected: true, writable: false });
    expect(() => writeM4Save(storage, read.state, read.writable)).toThrow("FUTURE_VERSION_SAVE_IS_READ_ONLY");
    expect(storage.getItem(HANZI_MAGIC_M4_SAVE_KEY)).toBe(raw);
  });

  it("backs up valid progress and clears only V2 progress keys", () => {
    const storage = new MemoryStorage();
    const first = createFreshM4Save(); writeM4Save(storage, first);
    const second = updateM4Save(first, { selectedHeroId: "ink-companion" }); writeM4Save(storage, second);
    expect(storage.getItem(HANZI_MAGIC_M4_SAVE_BACKUP_KEY)).toBe(JSON.stringify(first));
    storage.values.set(HANZI_MAGIC_V1_SAVE_KEY, "legacy-stays");
    clearM4Save(storage);
    expect(storage.getItem(HANZI_MAGIC_M4_SAVE_KEY)).toBeNull();
    expect(storage.getItem(HANZI_MAGIC_M4_SAVE_BACKUP_KEY)).toBeNull();
    expect(storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)).toBe("legacy-stays");
  });
});

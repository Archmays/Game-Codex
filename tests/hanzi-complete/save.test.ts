import { describe, expect, test } from "vitest";
import { CHAPTER_ONE_CHARACTERS } from "../../games/hanzi-radical-battle/v2/chapter-one/characters";
import { createM3GameState, reduceM3State, simulateM3Run } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-machine";
import { createFreshM4Save, syncM4SaveFromGame, updateM4Save, writeM4Save } from "../../games/hanzi-radical-battle/v2/chapter-one/m4-save";
import { M3_SESSION_KEY, writeM3Session } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-session";
import { createV1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, writeV1Save } from "../../games/hanzi-radical-battle/v2/v1/save";
import { PLAYABLE_WHEEL_MANIFEST } from "../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { WHEEL_WORKSHOP_SAVE_KEY, createFreshWheelWorkshopSave, writeWheelWorkshopSave } from "../../games/hanzi-radical-battle/v2/wheel-workshop/save/wheel-save";
import { completeCharacterId } from "../../games/hanzi-radical-battle/complete/content-graph/ids";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { createFreshCompleteSliceSave, updateCompleteSliceSave } from "../../games/hanzi-radical-battle/complete/save/slice-save";
import {
  HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_KEY,
  HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES,
  HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY,
  clearAllHanziProgress,
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  readCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
  validateCompleteSave,
  withCompleteSaveChecksum,
  writeCompleteSave,
} from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS } from "../../games/hanzi-radical-battle/complete/save/legacy-migrations";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const V1_IDS = ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"] as const;

function preChapterTwoChecksum(payload: unknown): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(payload)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function writeCompletedV2(storage: MemoryStorage, seed = "v2-to-v3") {
  const simulation = simulateM3Run(seed, "forest-speaker");
  let game = createM3GameState(seed, "forest-speaker");
  let save = createFreshM4Save();
  for (const action of simulation.actions) {
    game = reduceM3State(game, action);
    save = syncM4SaveFromGame(save, game);
  }
  writeM4Save(storage, save);
  writeM3Session(storage, seed, "forest-speaker", simulation.actions);
  return { simulation, save, m4Raw: storage.getItem("family-games/hanzi-magic-v2/chapter-one/save-v5")!, sessionRaw: storage.getItem(M3_SESSION_KEY)! };
}

describe("complete-edition V3 save", () => {
  test("normalizes an exact pre-Chapter-Two V3 save without discarding progress", () => {
    const storage = new MemoryStorage();
    const current = updateCompleteSave(createFreshCompleteSave(), { selectedHeroId: "forest-speaker", discoveredCharacterIds: ["char-u660e"] });
    const { chapterTwoReplay: _chapterTwoReplay, chapterThreeReplay: _chapterThreeReplay, validation: _validation, ...legacyPayload } = current;
    const legacy = { ...legacyPayload, validation: { algorithm: "fnv1a32", checksum: preChapterTwoChecksum(legacyPayload) } };
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify(legacy));

    const read = readCompleteSave(storage);
    expect(read).toMatchObject({ source: "v3", recovered: false, writable: true });
    expect(read.state.selectedHeroId).toBe("forest-speaker");
    expect(read.state.discoveredCharacterIds).toEqual(["char-u660e"]);
    expect(read.state.chapterTwoReplay).toBeNull();
    expect(read.state.chapterThreeReplay).toBeNull();
    expect(JSON.parse(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)!).chapterTwoReplay).toBeNull();
  });

  test("normalizes an exact pre-Chapter-Three V3 save and preserves its Chapter Two replay field", () => {
    const storage = new MemoryStorage();
    const current = updateCompleteSave(createFreshCompleteSave(), { selectedHeroId: "ink-companion" });
    const { chapterThreeReplay: _chapterThreeReplay, validation: _validation, ...legacyPayload } = current;
    const legacy = { ...legacyPayload, validation: { algorithm: "fnv1a32", checksum: preChapterTwoChecksum(legacyPayload) } };
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify(legacy));

    const read = readCompleteSave(storage);
    expect(read).toMatchObject({ source: "v3", recovered: false, writable: true });
    expect(read.state.selectedHeroId).toBe("ink-companion");
    expect(read.state.chapterTwoReplay).toBeNull();
    expect(read.state.chapterThreeReplay).toBeNull();
    expect(JSON.parse(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)!).chapterThreeReplay).toBeNull();
  });

  test("round-trips a bounded anonymous save and creates a valid backup", () => {
    const storage = new MemoryStorage();
    const first = createFreshCompleteSave();
    expect(validateCompleteSave(first)).toEqual(first);
    writeCompleteSave(storage, first);
    const second = updateCompleteSave(first, { selectedHeroId: "ink-companion", settings: { muted: true, reducedMotion: true, inputMode: "keyboard" } });
    writeCompleteSave(storage, second);
    expect(readCompleteSave(storage)).toMatchObject({ source: "v3", recovered: false, writable: true, state: second });
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY)).toBe(JSON.stringify(first));
    const raw = storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)!;
    expect(new TextEncoder().encode(raw).byteLength).toBeLessThan(HANZI_MAGIC_COMPLETE_SAVE_MAX_BYTES);
    expect(JSON.parse(raw).privacy).toEqual({ anonymousLocalOnly: true, freeTextStored: false, networkIdentityStored: false });
    expect(raw).not.toMatch(/birthday|school|photo|voice|fingerprint|ipAddress/i);
  });

  test("persists exact Chapter One replay, episode resume and timestamped review state", () => {
    const simulation = simulateM3Run("v3-resume", "light-speaker");
    let engine = createCompleteEngineState("v3-resume-world");
    engine = reduceCompleteEngineState(engine, { type: "enter-chapter-one", seed: "v3-resume" });
    for (const action of simulation.actions) engine = reduceCompleteEngineState(engine, { type: "chapter-one-action", action });
    const now = "2026-08-20T09:00:00.000Z";
    const save = syncCompleteSaveFromEngine(createFreshCompleteSave(), engine, now);
    expect(save.activeResume).toMatchObject({ screen: "chapter-one", chapterId: "chapter-two", episodeId: "chapter-one:ink-king-core" });
    expect(save.chapterOneReplay?.actions).toEqual(simulation.actions);
    expect(save.reviewRecords.length).toBe(save.discoveredCharacterIds.length);
    expect(save.reviewRecords.every((record) => record.lastEncounteredAt === now && record.nextEligibleAt === "2026-08-21T09:00:00.000Z")).toBe(true);
    const restored = createCompleteEngineState(save.activeResume.seed, progressSeedFromCompleteSave(save));
    expect(restored.chapterOneRun?.state).toEqual(simulation.finalState);
  });

  test("captures corrupt primary bytes, restores backup and protects a future schema", () => {
    const storage = new MemoryStorage();
    const backup = updateCompleteSave(createFreshCompleteSave(), { selectedHeroId: "forest-speaker" });
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, JSON.stringify(backup));
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, "{broken");
    expect(readCompleteSave(storage)).toMatchObject({ source: "v3-backup", recovered: true, recoveryReason: "MALFORMED_JSON", state: backup });
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_RECOVERY_KEY)).toContain("{broken");

    const future = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 99, futureField: "keep" });
    future.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
    const read = readCompleteSave(future);
    expect(read).toMatchObject({ source: "future-read-only", futureVersionProtected: true, writable: false });
    expect(() => writeCompleteSave(future, read.state, read.writable)).toThrow("FUTURE_VERSION_SAVE_IS_READ_ONLY");
    expect(future.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  });

  test("migrates a prior content revision after preserving exact raw bytes", () => {
    const storage = new MemoryStorage();
    const current = createFreshCompleteSave();
    const { validation: _validation, ...payload } = current;
    const old = withCompleteSaveChecksum({
      ...payload,
      contentRevisionHash: "fnv1a:old-content",
      discoveredCharacterIds: ["char-u660e", "char-u10ffff"],
      reviewRecords: [
        { recordId: "char-u660e", state: "independent", lastEncounteredAt: "2026-08-18T00:00:00.000Z", nextEligibleAt: "2026-08-19T00:00:00.000Z" },
        { recordId: "char-u10ffff", state: "revisit", lastEncounteredAt: "2026-08-18T00:00:00.000Z", nextEligibleAt: "2026-08-19T00:00:00.000Z" },
      ],
      migration: { ...payload.migration, characterProvenance: [{ characterId: "char-u660e", sources: ["v3"] }, { characterId: "char-u10ffff", sources: ["v3"] }] },
    });
    const raw = JSON.stringify(old);
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
    const read = readCompleteSave(storage);
    expect(read.source).toBe("content-migrated");
    expect(read.state.discoveredCharacterIds).toEqual(["char-u660e"]);
    expect(read.state.migration.sources).toContain("content-revision");
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_CONTENT_RAW_KEY)).toBe(raw);
  });

  test("migrates the slice save and preserves preferences and exact bytes", () => {
    const storage = new MemoryStorage();
    const slice = updateCompleteSliceSave(createFreshCompleteSliceSave("word"), { preferences: { muted: true, reducedMotion: true, inputMode: "touch" } });
    const raw = JSON.stringify(slice);
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
    const read = readCompleteSave(storage);
    expect(read).toMatchObject({ source: "slice-v1-migrated", state: { settings: { muted: true, reducedMotion: true, inputMode: "touch" } } });
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.sliceV1)).toBe(raw);
  });

  test("migrates V1 progress without modifying its raw bytes", () => {
    const storage = new MemoryStorage();
    const legacyState = createV1GameState("v1-to-v3", {
      completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      unlockedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"],
      discoveredCharacterIds: V1_IDS,
      campRepairStage: 3,
      selectedAbilityHistory: ["guardian-light", "star-path", "ink-echo"],
      freeAdventureUnlocked: true,
    });
    writeV1Save(storage, saveFromGameState(createFreshV1Save({ muted: true, inputMode: "keyboard" }), legacyState));
    const raw = storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)!;
    const read = readCompleteSave(storage);
    expect(read.source).toBe("v1-migrated");
    expect(read.state.discoveredCharacterIds).toHaveLength(12);
    expect(read.state.settings).toMatchObject({ muted: true, inputMode: "keyboard" });
    expect(read.state.migration.characterProvenance.every((record) => record.sources.includes("v1"))).toBe(true);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v1)).toBe(raw);
    expect(storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)).toBe(raw);
  });

  test("migrates a completed V2 run, unlocks Chapter Two and preserves replay bytes", () => {
    const storage = new MemoryStorage();
    const legacy = writeCompletedV2(storage);
    const read = readCompleteSave(storage);
    expect(read.source).toBe("v2-migrated");
    expect(read.state.completedChapterIds).toContain("chapter-one");
    expect(read.state.unlockedChapterIds).toContain("chapter-two");
    expect(read.state.chapterOneReplay?.actions).toEqual(legacy.simulation.actions);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v2)).toBe(legacy.m4Raw);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.v2Session)).toBe(legacy.sessionRaw);
  });

  test("migrates wheel progress and deduplicates an overlap with V2 while preserving provenance", () => {
    const storage = new MemoryStorage();
    const overlap = PLAYABLE_WHEEL_MANIFEST.find((wheel) => CHAPTER_ONE_CHARACTERS.some((character) => character.glyph === wheel.glyph))!;
    const legacyCharacter = CHAPTER_ONE_CHARACTERS.find((character) => character.glyph === overlap.glyph)!;
    writeM4Save(storage, updateM4Save(createFreshM4Save(), { discoveredCharacterIds: [legacyCharacter.id] }));
    writeWheelWorkshopSave(storage, { ...createFreshWheelWorkshopSave(), discoveredRecordIds: [overlap.id], recentRecordIds: [overlap.id] });
    const wheelRaw = storage.getItem(WHEEL_WORKSHOP_SAVE_KEY)!;
    const read = readCompleteSave(storage);
    const completeId = completeCharacterId(overlap.glyph);
    expect(read.source).toBe("legacy-merged");
    expect(read.state.discoveredCharacterIds.filter((id) => id === completeId)).toHaveLength(1);
    expect(read.state.migration.characterProvenance.find((record) => record.characterId === completeId)?.sources).toEqual(["v2", "wheel"]);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_MIGRATION_RAW_KEYS.wheel)).toBe(wheelRaw);
  });

  test("requires parent confirmation before clearing V3 and every legacy key", () => {
    const storage = new MemoryStorage();
    storage.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, JSON.stringify(createFreshCompleteSave()));
    storage.setItem(HANZI_MAGIC_V1_SAVE_KEY, "v1");
    storage.setItem(M3_SESSION_KEY, "v2-session");
    storage.setItem(WHEEL_WORKSHOP_SAVE_KEY, "wheel");
    expect(clearAllHanziProgress(storage, false)).toBe(false);
    expect(storage.values.size).toBe(4);
    expect(clearAllHanziProgress(storage, true)).toBe(true);
    expect(storage.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBeNull();
    expect(storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)).toBeNull();
    expect(storage.getItem(M3_SESSION_KEY)).toBeNull();
    expect(storage.getItem(WHEEL_WORKSHOP_SAVE_KEY)).toBeNull();
  });
});

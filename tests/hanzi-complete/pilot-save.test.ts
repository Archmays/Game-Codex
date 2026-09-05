import { describe, expect, test } from "vitest";
import {
  HANZI_MAGIC_COMPLETE_SAVE_KEY, HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, createFreshCompleteSave,
  readCompleteSave, writeCompleteSave, updateCompleteSave, restartChapterTwoSave, validateCompleteSave,
  isCompleteSaveWritable, progressSeedFromCompleteSave, syncCompleteSaveFromEngine,
} from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { createFreshCompleteSliceSave, writeCompleteSliceSave } from "../../games/hanzi-radical-battle/complete/save/slice-save";
import { simulateChapterTwo } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { createSaveVaultBackup, validateSaveVaultText, restoreSaveVault, serializeSaveVaultBackup } from "../../packages/save-vault";
import { pilotRun } from "./pilot-six-fixture";

class Store {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function pilotSave() {
  const { state: _state, ...replay } = pilotRun({ branch: true, stop: (state) => state.episodeIndex === 1 && state.encounterIndex === 1 && state.phase === "pilot-meaning" });
  return updateCompleteSave(createFreshCompleteSave(), { chapterTwoReplay: replay, unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], repairedObjectIds: ["tree-canopy-bridge"] });
}

describe("Chapter Two replay preservation and guarded writers", () => {
  test("keeps the complete unversioned run verbatim on voluntary replay, including completed/unlocked progress", () => {
    const result = simulateChapterTwo("old-complete");
    const old = { seed: "old-complete", initialHeroId: "light-speaker" as const, actions: result.actions };
    const previous = updateCompleteSave(createFreshCompleteSave(), { chapterTwoReplay: old, unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedChapterIds: ["chapter-one", "chapter-two"], completedEpisodeIds: result.finalState.completedEpisodeIds, repairedObjectIds: result.finalState.repairedObjectIds });
    const restarted = restartChapterTwoSave(previous, "replay");
    expect(restarted.chapterTwoReplay?.priorRuns).toEqual([old]);
    expect(restarted.chapterTwoReplay?.ruleset).toBe("pilot-six-r1");
    for (const field of ["unlockedChapterIds", "completedChapterIds", "completedEpisodeIds", "repairedObjectIds"] as const) expect(restarted[field]).toEqual(previous[field]);
    let engine = createCompleteEngineState("replay", progressSeedFromCompleteSave(restarted));
    engine = reduceCompleteEngineState(engine, { type: "enter-chapter", chapterId: "chapter-two" });
    engine = reduceCompleteEngineState(engine, { type: "chapter-two-action", action: { type: "start" } });
    const saved = syncCompleteSaveFromEngine(restarted, engine);
    expect(saved.chapterTwoReplay?.priorRuns).toEqual([old]);
    expect(validateCompleteSave(saved)).toEqual(saved);
  });

  test("retains the ruleset, actions and prior runs through settings and unrelated chapter sync", () => {
    const previous = restartChapterTwoSave(pilotSave(), "another-run");
    const settings = updateCompleteSave(previous, { settings: { muted: true, reducedMotion: true, inputMode: "keyboard" } });
    for (const chapterId of ["chapter-one", "chapter-three"] as const) {
      let engine = createCompleteEngineState("other", progressSeedFromCompleteSave(settings));
      engine = reduceCompleteEngineState(engine, { type: "enter-chapter", chapterId });
      const next = syncCompleteSaveFromEngine(settings, engine);
      expect(next.chapterTwoReplay).toEqual(settings.chapterTwoReplay);
      expect(validateCompleteSave(next)).toEqual(next);
    }
  });

  test.each(["pilot-six-r2", null, 7])("protects an unknown ruleset (%s) even inside archived runs", (version) => {
    for (const archived of [false, true]) {
      const store = new Store(); const save = pilotSave();
      const record = { ...save.chapterTwoReplay, ruleset: version };
      const value = { ...save, chapterTwoReplay: archived ? { ...save.chapterTwoReplay, priorRuns: [record] } : record };
      const raw = JSON.stringify(value); store.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
      const read = readCompleteSave(store); expect(read.writable).toBe(false); expect(read.source).toBe("future-read-only");
      expect(writeCompleteSave(store, updateCompleteSave(read.state, { selectedHeroId: "ink-companion" }))).toBe(false);
      expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
    }
  });

  test.each(["{broken", "null", "[]", "7", JSON.stringify({ ...pilotSave(), validation: { algorithm: "fnv1a32", checksum: "bad" } })])("does not overwrite corrupt primary bytes: %s", (raw) => {
    const store = new Store(); const backup = pilotSave(); store.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, JSON.stringify(backup)); store.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
    const read = readCompleteSave(store); expect(read.recovered).toBe(true); expect(read.writable).toBe(false); expect(read.state).toEqual(backup);
    expect(writeCompleteSave(store, updateCompleteSave(read.state, { selectedHeroId: "ink-companion" }))).toBe(false);
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  });

  test("refuses impossible new actions, versionless new actions and malformed prior-run archives", () => {
    const save = pilotSave();
    expect(validateCompleteSave(updateCompleteSave(save, { chapterTwoReplay: { seed: "broken", initialHeroId: "light-speaker", ruleset: "pilot-six-r1", actions: [{ type: "pilot-move", nodeId: "char-u9053" }] } }))).toBeNull();
    expect(validateCompleteSave(updateCompleteSave(save, { chapterTwoReplay: { seed: "broken", initialHeroId: "light-speaker", actions: [{ type: "pilot-magic" }] } }))).toBeNull();
    const archived = restartChapterTwoSave(save, "archived");
    expect(validateCompleteSave(archived)).not.toBeNull();
    expect(() => restartChapterTwoSave(updateCompleteSave(archived, { chapterTwoReplay: { ...archived.chapterTwoReplay!, priorRuns: Array(64).fill(save.chapterTwoReplay) } }), "full")).toThrow("ARCHIVE_FULL");
  });

  test("an older mounted state cannot replace another page's write, even after that page reads again", () => {
    const store = new Store(); writeCompleteSave(store, pilotSave());
    const oldPage = readCompleteSave(store).state; const newPage = readCompleteSave(store).state;
    const replacement = updateCompleteSave(newPage, { selectedHeroId: "forest-speaker" }); expect(writeCompleteSave(store, replacement)).toBe(true);
    readCompleteSave(store); // A storage-global baseline would incorrectly authorize oldPage here.
    const stale = updateCompleteSave(oldPage, { settings: { ...oldPage.settings, muted: true } });
    expect(writeCompleteSave(store, stale)).toBe(false); expect(isCompleteSaveWritable(stale)).toBe(false);
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(JSON.stringify(replacement));
    writeCompleteSliceSave(store, createFreshCompleteSliceSave());
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(JSON.stringify(replacement));
  });

  test("a full byte budget protects prior journeys without crashing the writer", () => {
    const store = new Store(); writeCompleteSave(store, pilotSave());
    const raw = store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
    const legacyActions = simulateChapterTwo("full-byte-budget").actions;
    const old = { seed: "full-byte-budget", initialHeroId: "light-speaker" as const, actions: [...legacyActions, ...legacyActions] };
    const base = readCompleteSave(store).state;
    const full = updateCompleteSave(base, { chapterTwoReplay: { ...base.chapterTwoReplay!, priorRuns: Array(64).fill(old) } });
    expect(validateCompleteSave(full)).not.toBeNull();
    expect(new TextEncoder().encode(JSON.stringify(full)).byteLength).toBeGreaterThanOrEqual(500 * 1024);
    expect(writeCompleteSave(store, full)).toBe(false);
    expect(isCompleteSaveWritable(full)).toBe(false);
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  });

  test("refuses denied reads/writes and silent storage failures without a memory-store success claim", () => {
    const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
    expect(readCompleteSave(denied)).toMatchObject({ source: "storage-unavailable", writable: false });
    for (const silent of [false, true]) {
      const store = new Store(); writeCompleteSave(store, pilotSave()); const original = store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
      const save = readCompleteSave(store).state;
      store.setItem = () => { if (!silent) throw new Error("quota"); };
      const next = updateCompleteSave(save, { selectedHeroId: "ink-companion" });
      expect(writeCompleteSave(store, next)).toBe(false); expect(isCompleteSaveWritable(next)).toBe(false); expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(original);
    }
  });

  test("Vault export/import preserves exact replay bytes and invalidates an already mounted writer", async () => {
    const source = new Store(); const save = restartChapterTwoSave(pilotSave(), "vault-replay"); writeCompleteSave(source, save);
    const raw = source.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY);
    const backup = await createSaveVaultBackup(source, { originHint: "http://127.0.0.1:5175/", now: new Date("2026-09-05T12:00:00Z") });
    const checked = await validateSaveVaultText(serializeSaveVaultBackup(backup));
    const target = new Store(); writeCompleteSave(target, createFreshCompleteSave()); const stale = readCompleteSave(target).state;
    expect(restoreSaveVault(target, checked).readbackVerified).toBe(true);
    expect(target.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
    expect(readCompleteSave(target).state.chapterTwoReplay).toEqual(save.chapterTwoReplay);
    expect(writeCompleteSave(target, updateCompleteSave(stale, { selectedHeroId: "ink-companion" }))).toBe(false);
    expect(target.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  });
});

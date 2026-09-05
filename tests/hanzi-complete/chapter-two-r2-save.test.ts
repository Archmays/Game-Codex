import { describe, expect, test } from "vitest";
import { chapterTwoR2Run } from "./chapter-two-r2-fixture";
import { pilotRun } from "./pilot-six-fixture";
import { createFreshCompleteSave, updateCompleteSave, readCompleteSave, writeCompleteSave, validateCompleteSave, restartChapterTwoSave, syncCompleteSaveFromEngine, progressSeedFromCompleteSave, HANZI_MAGIC_COMPLETE_SAVE_KEY, HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY } from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { createSaveVaultBackup, validateSaveVaultText, restoreSaveVault, serializeSaveVaultBackup } from "../../packages/save-vault";
import { simulateChapterTwo, type ChapterTwoAction } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
class Store {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function r2Save() {
  const { state: _state, ...replay } = chapterTwoR2Run({ branch: true, stop: state => state.episodeIndex === 3 && state.encounterIndex === 1 && state.phase === "family-connect" });
  const { state: _oldState, ...r1 } = pilotRun({ stop: state => state.episodeIndex === 1 && state.encounterIndex === 1 });
  const legacy = { seed: "old", initialHeroId: "light-speaker" as const, actions: simulateChapterTwo("old").actions };
  return updateCompleteSave(createFreshCompleteSave(), { chapterTwoReplay: { ...replay, priorRuns: [legacy, r1] }, unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], repairedObjectIds: ["tree-canopy-bridge", "spring-waterwheel", "door-shadow-corridor"], completedChapterIds: ["chapter-one"] });
}
describe("three-generation save preservation", () => {
  test("keeps every prefix of a complete r2 replay and both archived generations through checksum validation", () => {
    const run = chapterTwoR2Run({ branch: true }); const base = r2Save();
    for (let i = 0; i <= run.actions.length; i++) {
      const save = updateCompleteSave(base, { chapterTwoReplay: { ...base.chapterTwoReplay!, seed: run.seed, actions: run.actions.slice(0, i) } });
      expect(validateCompleteSave(save), `prefix ${i}`).toEqual(save);
    }
  });
  test("world, spellbook settings and chapter one/three sync retain r2 and priorRuns", () => {
    const base = r2Save();
    const settings = updateCompleteSave(base, { settings: { muted: true, reducedMotion: true, inputMode: "keyboard" } });
    for (const chapterId of ["chapter-one", "chapter-two", "chapter-three"] as const) {
      let engine = createCompleteEngineState("cross-page", progressSeedFromCompleteSave(settings));
      engine = reduceCompleteEngineState(engine, { type: "enter-chapter", chapterId });
      const saved = syncCompleteSaveFromEngine(settings, engine);
      expect(saved.chapterTwoReplay).toEqual(settings.chapterTwoReplay);
      expect(validateCompleteSave(saved)).toEqual(saved);
    }
    expect(restartChapterTwoSave(settings, "voluntary-new").chapterTwoReplay!.priorRuns).toHaveLength(3);
  });
  test.each(["chapter-two-r3", null, 9])("future rule %s in active or archived replay refuses writes", version => {
    for (const archived of [false, true]) {
      const store = new Store(), save = r2Save();
      const record = { ...save.chapterTwoReplay!, ruleset: version };
      const raw = JSON.stringify({ ...save, chapterTwoReplay: archived ? { ...save.chapterTwoReplay!, priorRuns: [record] } : record });
      store.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw);
      const read = readCompleteSave(store);
      expect(read).toMatchObject({ writable: false, source: "future-read-only" });
      expect(writeCompleteSave(store, updateCompleteSave(read.state, { selectedHeroId: "ink-companion" }))).toBe(false);
      expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
    }
  });
  test.each(["{broken", "null", "[]", "checksum", "shape"])("corruption retains exact primary and valid r2 backup: %s", failure => {
    const store = new Store(), save = r2Save();
    const raw = failure === "checksum" ? JSON.stringify({ ...save, validation: { checksum: "bad" } }) : failure === "shape" ? JSON.stringify(updateCompleteSave(save, { chapterTwoReplay: { ...save.chapterTwoReplay!, actions: [{ type: "r2-root" }] } })) : failure;
    store.setItem(HANZI_MAGIC_COMPLETE_SAVE_KEY, raw); store.setItem(HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, JSON.stringify(save));
    const read = readCompleteSave(store); expect(read.writable).toBe(false); expect(read.state).toEqual(save);
    expect(writeCompleteSave(store, updateCompleteSave(read.state, { selectedHeroId: "ink-companion" }))).toBe(false);
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  });
  test.each([false, true])("denied and silent writes retain the r2 primary, silent=%s", silent => {
    const store = new Store(), save = r2Save(); writeCompleteSave(store, save);
    const original = store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY), read = readCompleteSave(store);
    store.setItem = () => { if (!silent) throw new Error("denied"); };
    expect(writeCompleteSave(store, updateCompleteSave(read.state, { selectedHeroId: "ink-companion" }))).toBe(false);
    expect(store.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(original);
    store.getItem = () => { throw new Error("denied"); };
    expect(readCompleteSave(store).writable).toBe(false);
  });
  test("impossible, extra-field, unknown-target and old-version r2 actions reject", () => {
    const save = r2Save();
    for (const action of [{ type: "r2-root" }, { type: "r2-target", targetId: "not-a-target" }, { type: "r2-target", targetId: "clock-face", elapsed: 1 }] as unknown as ChapterTwoAction[]) {
      expect(validateCompleteSave(updateCompleteSave(save, { chapterTwoReplay: { seed: "invalid", initialHeroId: "light-speaker", ruleset: "chapter-two-r2", actions: [action] } }))).toBeNull();
    }
    for (const ruleset of [undefined, "pilot-six-r1"] as const) expect(validateCompleteSave(updateCompleteSave(save, { chapterTwoReplay: { seed: "invalid", initialHeroId: "light-speaker", ...(ruleset ? {ruleset} : {}), actions: [{ type: "r2-root" }] } }))).toBeNull();
  });
  test("Vault exact bytes survive and invalidate old page writers after cross-page replacement", async () => {
    const source = new Store(), save = r2Save(); writeCompleteSave(source, save);
    const backup = await createSaveVaultBackup(source, { originHint: "http://127.0.0.1:5175/", now: new Date("2026-09-06T00:00:00Z") });
    const checked = await validateSaveVaultText(serializeSaveVaultBackup(backup));
    const target = new Store(); writeCompleteSave(target, createFreshCompleteSave());
    const stale = readCompleteSave(target).state;
    expect(restoreSaveVault(target, checked).readbackVerified).toBe(true);
    expect(target.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(source.getItem(HANZI_MAGIC_COMPLETE_SAVE_KEY));
    readCompleteSave(target);
    expect(writeCompleteSave(target, updateCompleteSave(stale, { selectedHeroId: "ink-companion" }))).toBe(false);
    expect(readCompleteSave(target).state.chapterTwoReplay).toEqual(save.chapterTwoReplay);
  });
});

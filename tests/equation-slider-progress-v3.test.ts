import {
  completeLevelProgress,
  createDefaultProgress,
  createEquationSliderProgressStore,
  getLevelRevisionProgress,
  levelMapState,
  levelRevisionState,
  loadEquationSliderProgress,
  markCheckpointSeen,
  markCompletionCheckpointSeen,
  markUpgradeNoticeSeen,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  setSoundEnabled,
  type EquationSliderProgress,
  type LevelProgressRecord
} from "../games/equation-slider/progress";
import { EQUATION_SLIDER_CONTENT_REVISIONS } from "../games/equation-slider/content-revisions";
import { KNOWN_SAVE_KEYS } from "../packages/data/saveKeyInventory";
import {
  createSaveVaultBackup,
  restoreSaveVault,
  serializeSaveVaultBackup,
  validateSaveVaultText
} from "../packages/save-vault";

describe("equation slider V3 progress migration", () => {
  it("starts V3 in a clean namespace", () => {
    expect(createDefaultProgress()).toEqual({
      saveVersion: 2,
      tutorialCompleted: false,
      upgradeNoticeSeen: false,
      soundEnabled: true,
      levels: {},
      seenCheckpoints: []
    });
  });

  it("archives V0 completion without granting V3 completion", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 0,
      completedLevels: ["es-1-01", "not-a-level", "es-4-50", "es-1-01"],
      lastLevelId: "es-4-50",
      tutorialDone: true,
      muted: true,
      hints: { "es-1-01": 4 }
    });

    expect(loaded).toMatchObject({ canPersist: true, migrated: true });
    expect(loaded.progress).toMatchObject({
      saveVersion: 2,
      tutorialCompleted: false,
      upgradeNoticeSeen: false,
      soundEnabled: false,
      levels: {},
      seenCheckpoints: [],
      legacy: {
        sourceSaveVersion: 0,
        completedLevelIds: ["es-1-01", "es-4-50"],
        lastLevelId: "es-4-50"
      }
    });
    expect(loaded.progress.lastLevelId).toBeUndefined();
  });

  it("archives only completed V1 levels and carries only the safe sound preference", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 1,
      tutorialCompleted: true,
      soundEnabled: false,
      lastLevelId: "es-2-09",
      seenCheckpoints: ["chapter-1-review"],
      levels: {
        "es-1-01": { completed: true },
        "es-1-02": { completed: false },
        "es-9-99": { completed: true }
      }
    });

    expect(loaded.progress).toEqual({
      saveVersion: 2,
      tutorialCompleted: false,
      upgradeNoticeSeen: false,
      soundEnabled: false,
      levels: {},
      seenCheckpoints: [],
      legacy: {
        sourceSaveVersion: 1,
        completedLevelIds: ["es-1-01"],
        lastLevelId: "es-2-09"
      }
    });
  });

  it.each([
    null,
    4,
    "bad",
    [],
    { saveVersion: "2", levels: "bad" },
    { saveVersion: 2, levels: [], seenCheckpoints: "bad", legacy: "bad" }
  ])("degrades malformed data safely", (value) => {
    expect(() => loadEquationSliderProgress(value)).not.toThrow();
    expect(loadEquationSliderProgress(value).progress.saveVersion).toBe(2);
  });

  it("does not authorize an older client to overwrite a future save", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 99,
      soundEnabled: false,
      levels: { future: true }
    });

    expect(loaded.canPersist).toBe(false);
    expect(loaded.migrated).toBe(false);
    expect(loaded.progress).toEqual(createDefaultProgress());
  });

  it("shows a sanitized V3 view but preserves unknown or malformed original records read-only", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 2,
      tutorialCompleted: true,
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-3-08",
      levels: {
        "es-3-08": {
          startedCount: 2,
          completed: true,
          independent: true,
          hintCount: 1,
          badges: ["independent", "unknown"],
          bestMoves: 5
        },
        arbitrary: { completed: true }
      },
      seenCheckpoints: ["chapter-3-station-1-review", "chapter-3-station-1-review", 4],
      legacy: {
        sourceSaveVersion: 1,
        completedLevelIds: ["es-1-01", "bad"],
        lastLevelId: "bad"
      }
    });

    expect(loaded.progress).toEqual({
      saveVersion: 2,
      tutorialCompleted: true,
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-3-08",
      levels: {
        "es-3-08": {
          startedCount: 2,
          completed: true,
          independent: true,
          hintCount: 1,
          badges: ["independent"],
          bestMoves: 5
        }
      },
      seenCheckpoints: ["chapter-3-station-1-review"],
      legacy: {
        sourceSaveVersion: 1,
        completedLevelIds: ["es-1-01"]
      }
    });
    expect(loaded.canPersist).toBe(false);
  });
});

describe("equation slider V3 progress operations", () => {
  it("retains record, hint, completion, preference, and one-time notice behavior", () => {
    let progress = recordLevelStart(createDefaultProgress(), "es-1-01");
    progress = recordHintUse(progress, "es-1-01");
    progress = completeLevelProgress(progress, "es-1-01", {
      independent: false,
      moves: 6,
      badges: ["try-again"]
    });
    progress = completeLevelProgress(progress, "es-1-01", {
      independent: true,
      moves: 4,
      badges: ["independent"]
    });
    progress = setSoundEnabled(progress, false);
    progress = markUpgradeNoticeSeen(progress);

    expect(progress).toMatchObject({
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-1-01"
    });
    expect(progress.levels["es-1-01"]).toEqual({
      startedCount: 1,
      completed: true,
      independent: true,
      hintCount: 1,
      badges: ["try-again", "independent"],
      bestMoves: 4
    });
  });

  it("uses stationId and stationOrder for rest, station, and chapter checkpoints", () => {
    const chapterLevels = Array.from({ length: 50 }, (_, index) => ({
      id: `es-1-${String(index + 1).padStart(2, "0")}`,
      chapterId: "chapter-1",
      stationId: `chapter-1-station-${Math.floor(index / 10) + 1}`,
      stationOrder: index % 10 + 1
    }));
    let progress = createDefaultProgress();

    progress = completeLevelProgress(progress, chapterLevels[4].id, {
      independent: true,
      moves: 2,
      badges: []
    });
    expect(resolveCompletionCheckpoint(progress, chapterLevels[4], chapterLevels)).toEqual({
      kind: "rest",
      checkpointId: "es-1-05-rest"
    });

    for (const level of chapterLevels.slice(0, 10)) {
      progress = completeLevelProgress(progress, level.id, {
        independent: true,
        moves: 2,
        badges: []
      });
    }
    expect(resolveCompletionCheckpoint(progress, chapterLevels[9], chapterLevels)).toEqual({
      kind: "station-review",
      checkpointId: "chapter-1-station-1-review"
    });

    progress = markCheckpointSeen(progress, "chapter-1-station-1-review");
    for (const level of chapterLevels.slice(10)) {
      progress = completeLevelProgress(progress, level.id, {
        independent: false,
        moves: 3,
        badges: []
      });
    }
    const chapterCheckpoint = resolveCompletionCheckpoint(progress, chapterLevels[49], chapterLevels);
    expect(chapterCheckpoint).toEqual({
      kind: "chapter-review",
      checkpointId: "chapter-1-review"
    });
    progress = markCompletionCheckpointSeen(progress, chapterCheckpoint, chapterLevels[49]);
    expect(progress.seenCheckpoints).toEqual(expect.arrayContaining([
      "chapter-1-review",
      "chapter-1-station-5-review"
    ]));
    expect(resolveCompletionCheckpoint(progress, chapterLevels[49], chapterLevels)).toEqual({ kind: "normal" });
  });
});

const PROGRESS_KEY = "family-games/equation-slider/progress-v3";
const LEGACY_KEY = "family-games/equation-slider/progress";
const REVISION = "slider-pilot-12-r1";

class SliderMemoryStorage {
  readonly values = new Map<string, string>();
  writeCount = 0;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.writeCount += 1; this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function historicalRecord(completed = true): LevelProgressRecord {
  return {
    startedCount: 4,
    completed,
    independent: completed,
    hintCount: 2,
    badges: completed ? ["independent"] : [],
    ...(completed ? { bestMoves: 3 } : {})
  };
}

function historicalProgress(completed = true): EquationSliderProgress {
  return {
    ...createDefaultProgress(),
    tutorialCompleted: true,
    upgradeNoticeSeen: true,
    soundEnabled: false,
    lastLevelId: "es-3-08",
    seenCheckpoints: ["chapter-1-station-1-review"],
    levels: {
      "es-1-02": historicalRecord(completed),
      "es-1-11": historicalRecord(),
      "es-3-08": historicalRecord()
    }
  };
}

describe("equation slider pilot revision progress", () => {
  it.each([true, false])("retains the old %s completion, preferences and last level without granting a revision record", (completed) => {
    const original = historicalProgress(completed);
    const loaded = loadEquationSliderProgress(original);
    expect(loaded).toEqual({ progress: original, canPersist: true, migrated: false });
    expect(getLevelRevisionProgress(loaded.progress.levels["es-1-02"], REVISION)).toBeUndefined();
    expect(levelRevisionState(loaded.progress.levels["es-1-02"], REVISION)).toBe("previously-played");
    expect(levelRevisionState({ ...original.levels["es-1-02"], revisions: { [REVISION]: {
      startedCount: 0, completed: false, independent: false, hintCount: 0, badges: []
    } } }, REVISION)).toBe("previously-played");
    expect(levelMapState(loaded.progress.levels["es-1-02"])).toBe(completed ? "completed" : "in-progress");
  });

  it("keeps historical completion available and tracks revised best/hints independently", () => {
    const original = historicalProgress();
    let progress = recordLevelStart(original, "es-1-02", REVISION);
    expect(levelMapState(progress.levels["es-1-02"])).toBe("completed");
    expect(levelRevisionState(progress.levels["es-1-02"], REVISION)).toBe("in-progress");
    expect(getLevelRevisionProgress(progress.levels["es-1-02"], REVISION)).toEqual({
      startedCount: 1, completed: false, independent: false, hintCount: 0, badges: []
    });
    progress = recordHintUse(progress, "es-1-02", REVISION);
    progress = completeLevelProgress(progress, "es-1-02", { independent: false, moves: 12, badges: ["review-complete"] }, REVISION);
    expect(progress.levels["es-1-02"]).toMatchObject({
      startedCount: 5, completed: true, independent: true, hintCount: 3, bestMoves: 3
    });
    expect(getLevelRevisionProgress(progress.levels["es-1-02"], REVISION)).toEqual({
      startedCount: 1, completed: true, independent: false, hintCount: 1,
      badges: ["review-complete"], bestMoves: 12
    });
    expect(levelRevisionState(progress.levels["es-1-02"], REVISION)).toBe("review-suggested");
    progress = recordLevelStart(progress, "es-1-02", REVISION);
    progress = completeLevelProgress(progress, "es-1-02", { independent: true, moves: 9, badges: ["independent"] }, REVISION);
    expect(getLevelRevisionProgress(progress.levels["es-1-02"], REVISION)).toMatchObject({ startedCount: 2, bestMoves: 9, hintCount: 1 });
    expect(levelRevisionState(progress.levels["es-1-02"], REVISION)).toBe("completed");
    expect(progress.levels["es-1-02"].bestMoves).toBe(3);
    expect(progress.levels["es-1-11"]).toBe(original.levels["es-1-11"]);
    expect(progress.levels["es-3-08"]).toBe(original.levels["es-3-08"]);
    expect(loadEquationSliderProgress(JSON.parse(JSON.stringify(progress)))).toEqual({ progress, canPersist: true, migrated: false });
  });

  it("starts new users at the normal default and keeps untouched level behavior without optional fields", () => {
    const storage = new SliderMemoryStorage();
    const store = createEquationSliderProgressStore(storage);
    expect(store.loaded).toEqual({ progress: createDefaultProgress(), canPersist: true, migrated: false });
    expect(levelRevisionState(undefined, REVISION)).toBe("unstarted");
    expect(Object.keys(EQUATION_SLIDER_CONTENT_REVISIONS)).toHaveLength(10);
    expect(EQUATION_SLIDER_CONTENT_REVISIONS["es-1-01"]).toBeUndefined();
    expect(EQUATION_SLIDER_CONTENT_REVISIONS["es-1-11"]).toBeUndefined();
    let progress = recordLevelStart(store.loaded.progress, "es-1-11");
    progress = recordHintUse(progress, "es-1-11");
    progress = completeLevelProgress(progress, "es-1-11", { independent: false, moves: 7, badges: ["review-complete"] });
    expect(progress.levels["es-1-11"]).toEqual({
      startedCount: 1, completed: true, independent: false, hintCount: 1, badges: ["review-complete"], bestMoves: 7
    });
    expect(getLevelRevisionProgress(progress.levels["es-1-11"])).toBe(progress.levels["es-1-11"]);
    expect(store.persist(progress)).toBe(true);
    expect(createEquationSliderProgressStore(storage).loaded.progress).toEqual(progress);
  });

  it("round-trips an unfinished revised attempt without changing its old completion or best", () => {
    const storage = new SliderMemoryStorage();
    storage.values.set(PROGRESS_KEY, JSON.stringify(historicalProgress()));
    const store = createEquationSliderProgressStore(storage);
    let progress = recordLevelStart(store.loaded.progress, "es-1-02", REVISION);
    progress = recordHintUse(progress, "es-1-02", REVISION);
    expect(store.persist(progress)).toBe(true);
    const reloaded = createEquationSliderProgressStore(storage).loaded;
    expect(reloaded.canPersist).toBe(true);
    expect(reloaded.progress).toEqual(progress);
    expect(reloaded.progress.levels["es-1-02"]).toMatchObject({ completed: true, bestMoves: 3 });
    expect(getLevelRevisionProgress(reloaded.progress.levels["es-1-02"], REVISION)).toEqual({
      startedCount: 1, completed: false, independent: false, hintCount: 1, badges: []
    });
    expect(reloaded.progress.lastLevelId).toBe("es-1-02");
  });

  it("preserves all 188 nonpilot records when revised play is recorded", () => {
    const unchanged = Object.fromEntries(Array.from({ length: 200 }, (_, index) => {
      const id = `es-${Math.floor(index / 50) + 1}-${String(index % 50 + 1).padStart(2, "0")}`;
      return [id, { ...historicalRecord(), startedCount: index + 1, bestMoves: index + 2 }];
    }).filter(([id]) => !/^es-1-(?:0[1-9]|1[0-2])$/.test(id as string)));
    const original = { ...historicalProgress(), levels: { ...unchanged, "es-1-02": historicalRecord() } };
    let progress = recordLevelStart(original, "es-1-02", REVISION);
    progress = recordHintUse(progress, "es-1-02", REVISION);
    progress = completeLevelProgress(progress, "es-1-02", { independent: false, moves: 15, badges: ["review-complete"] }, REVISION);
    expect(Object.keys(unchanged)).toHaveLength(188);
    for (const [id, record] of Object.entries(unchanged)) {
      expect(progress.levels[id], id).toBe(record);
      expect(JSON.stringify(progress.levels[id]), id).toBe(JSON.stringify(record));
    }
  });
});

describe("equation slider exact-key storage protection", () => {
  it.each([
    "{broken",
    "",
    "null",
    JSON.stringify({ saveVersion: 99, future: true }),
    JSON.stringify({ saveVersion: 1, levels: { "es-1-02": null } }),
    JSON.stringify({ saveVersion: 1, levels: { "es-1-02": { completed: true, futureField: true } } }),
    JSON.stringify({ saveVersion: 1, levels: { "es-9-99": { completed: true } } }),
    JSON.stringify({ saveVersion: 0, completedLevels: ["es-1-02", 3] }),
    JSON.stringify({ ...historicalProgress(), saveVersion: "2" }),
    JSON.stringify({ ...historicalProgress(), futureField: { keep: true } }),
    JSON.stringify({ ...historicalProgress(), levels: { future: historicalRecord() } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-02": { ...historicalRecord(), futureField: true } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-02": { ...historicalRecord(), hintCount: "2" } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-02": { ...historicalRecord(), revisions: "unknown" } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-02": { ...historicalRecord(), revisions: { [REVISION]: { ...historicalRecord(), futureField: true } } } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-02": { ...historicalRecord(), revisions: { "slider-pilot-12-r99": historicalRecord() } } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-11": { ...historicalRecord(), revisions: {} } } }),
    JSON.stringify({ ...historicalProgress(), levels: { "es-1-11": { ...historicalRecord(), revisions: { [REVISION]: historicalRecord() } } } })
  ])("does not overwrite corrupt, future, unknown or unsupported current bytes: %s", (raw) => {
    const storage = new SliderMemoryStorage();
    storage.values.set(PROGRESS_KEY, raw);
    storage.values.set(LEGACY_KEY, JSON.stringify({ completedLevels: ["es-1-01"], muted: true }));
    const before = new Map(storage.values);
    const store = createEquationSliderProgressStore(storage);
    expect(store.loaded.canPersist).toBe(false);
    expect(store.persist(recordLevelStart(store.loaded.progress, "es-1-01"))).toBe(false);
    expect(storage.values).toEqual(before);
    expect(storage.writeCount).toBe(0);
  });

  it("reads known legacy only when the current key is missing and leaves original bytes intact", () => {
    const storage = new SliderMemoryStorage();
    const raw = '{  "completedLevels": ["es-1-01"], "muted": true }\n';
    storage.values.set(LEGACY_KEY, raw);
    const store = createEquationSliderProgressStore(storage);
    expect(store.loaded).toMatchObject({ canPersist: true, migrated: true });
    expect(store.persist(store.loaded.progress)).toBe(true);
    expect(storage.getItem(LEGACY_KEY)).toBe(raw);
    expect(createEquationSliderProgressStore(storage).loaded).toMatchObject({ canPersist: true, migrated: false });
  });

  it("still recognizes an intact old-format record at the current key", () => {
    const storage = new SliderMemoryStorage();
    storage.values.set(PROGRESS_KEY, JSON.stringify({ saveVersion: 1, levels: { "es-1-02": { completed: true } }, soundEnabled: false }));
    const store = createEquationSliderProgressStore(storage);
    expect(store.loaded).toMatchObject({ canPersist: true, migrated: true });
    expect(store.persist(store.loaded.progress)).toBe(true);
    expect(createEquationSliderProgressStore(storage).loaded.progress.legacy).toEqual({ sourceSaveVersion: 1, completedLevelIds: ["es-1-02"] });
  });

  it("keeps play in memory when reads or writes are denied", () => {
    const deniedRead = createEquationSliderProgressStore({
      getItem(): never { throw new Error("denied read"); },
      setItem(): never { throw new Error("must not write after denied read"); }
    });
    expect(deniedRead.loaded.canPersist).toBe(false);
    expect(deniedRead.persist(createDefaultProgress())).toBe(false);
    const storage = new SliderMemoryStorage();
    const raw = JSON.stringify(historicalProgress());
    storage.values.set(PROGRESS_KEY, raw);
    const deniedWrite = createEquationSliderProgressStore({
      getItem: (key) => storage.getItem(key),
      setItem(): never { throw new Error("denied write"); }
    });
    const inMemory = recordLevelStart(deniedWrite.loaded.progress, "es-1-02", REVISION);
    expect(deniedWrite.persist(inMemory)).toBe(false);
    expect(getLevelRevisionProgress(inMemory.levels["es-1-02"], REVISION)?.startedCount).toBe(1);
    expect(storage.getItem(PROGRESS_KEY)).toBe(raw);
  });

  it("refuses to overwrite a record replaced externally after mounting", () => {
    const storage = new SliderMemoryStorage();
    const originalRaw = JSON.stringify(historicalProgress());
    storage.values.set(PROGRESS_KEY, originalRaw);
    const store = createEquationSliderProgressStore(storage);
    const replacement = '{ "saveVersion": 99, "vaultRestore": true }\n';
    storage.values.set(PROGRESS_KEY, replacement);
    expect(store.persist(recordHintUse(store.loaded.progress, "es-1-02", REVISION))).toBe(false);
    expect(storage.getItem(PROGRESS_KEY)).toBe(replacement);
    storage.values.set(PROGRESS_KEY, originalRaw);
    expect(store.persist(store.loaded.progress)).toBe(false);
    expect(storage.writeCount).toBe(0);
  });

  it("requires readback before treating a write as successful", () => {
    const storage = new SliderMemoryStorage();
    const raw = JSON.stringify(historicalProgress());
    storage.values.set(PROGRESS_KEY, raw);
    const ignoredWrite = createEquationSliderProgressStore({
      getItem: (key) => storage.getItem(key),
      setItem(): void { /* Simulate a storage backend dropping the write. */ }
    });
    expect(ignoredWrite.persist(recordHintUse(ignoredWrite.loaded.progress, "es-1-02", REVISION))).toBe(false);
    expect(storage.getItem(PROGRESS_KEY)).toBe(raw);
  });

  it("round-trips revision progress and retired raw saves through Vault while leaving unknown keys untouched", async () => {
    const storage = new SliderMemoryStorage();
    let progress = recordLevelStart(historicalProgress(), "es-1-02", REVISION);
    progress = recordHintUse(progress, "es-1-02", REVISION);
    progress = completeLevelProgress(progress, "es-1-02", { independent: false, moves: 9, badges: ["review-complete"] }, REVISION);
    const raw = `${JSON.stringify(progress, null, 2)}\n`;
    const retired = "{ \"retired\":true, \"original\":\"原样\" }\n";
    storage.values.set(PROGRESS_KEY, raw);
    storage.values.set("family-games/clock-reader/progress", retired);
    storage.values.set(LEGACY_KEY, "{ \"completedLevels\": [\"es-2-09\"] }\n");
    storage.values.set("other-localhost-app/save", "unknown bytes stay here");
    const vault = await createSaveVaultBackup(storage, { originHint: "http://127.0.0.1:5175/" });
    const validated = await validateSaveVaultText(serializeSaveVaultBackup(vault));
    const destination = new SliderMemoryStorage();
    destination.values.set("other-localhost-app/save", "destination unknown remains");
    const result = restoreSaveVault(destination, validated);
    expect(KNOWN_SAVE_KEYS).toHaveLength(37);
    expect(result.readbackVerified).toBe(true);
    expect(destination.getItem(PROGRESS_KEY)).toBe(raw);
    expect(destination.getItem("family-games/clock-reader/progress")).toBe(retired);
    expect(destination.getItem(LEGACY_KEY)).toBe(storage.getItem(LEGACY_KEY));
    expect(destination.getItem("other-localhost-app/save")).toBe("destination unknown remains");
    expect(createEquationSliderProgressStore(destination).loaded).toEqual({ progress, canPersist: true, migrated: false });
  });
});

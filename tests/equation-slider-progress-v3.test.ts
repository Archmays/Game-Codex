import {
  completeLevelProgress,
  createDefaultProgress,
  loadEquationSliderProgress,
  markCheckpointSeen,
  markCompletionCheckpointSeen,
  markUpgradeNoticeSeen,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  setSoundEnabled
} from "../games/equation-slider/progress";

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

  it("sanitizes valid V3 data while retaining a read-only legacy archive", () => {
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

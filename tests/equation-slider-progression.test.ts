import { EQUATION_SLIDER_V3_LEVELS } from "../games/equation-slider/levels/v3/catalog";
import { equationSliderChapterManifest } from "../games/equation-slider/levels/manifest";
import {
  completeLevelProgress,
  createDefaultProgress,
  levelMapState,
  loadEquationSliderProgress,
  markCheckpointSeen,
  markTutorialCompleted,
  markUpgradeNoticeSeen,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  sanitizeLastLevelId,
  setSoundEnabled
} from "../games/equation-slider/progress";

describe("equation slider V3 progression catalog", () => {
  it("maps four chapters to 50 levels and five 10-level stations each", () => {
    expect(equationSliderChapterManifest).toHaveLength(4);
    expect(EQUATION_SLIDER_V3_LEVELS).toHaveLength(200);

    for (const chapter of equationSliderChapterManifest) {
      const chapterLevels = EQUATION_SLIDER_V3_LEVELS.filter(
        (level) => level.chapterId === chapter.id
      );
      expect(chapter.levelCount).toBe(50);
      expect(chapter.units).toHaveLength(5);
      expect(chapterLevels).toHaveLength(50);
      expect(chapterLevels.map((level) => level.order)).toEqual(
        Array.from({ length: 50 }, (_, index) => index + 1)
      );

      for (let station = 1; station <= 5; station += 1) {
        const stationId = `${chapter.id}-station-${station}`;
        const stationLevels = chapterLevels.filter((level) => level.stationId === stationId);
        expect(stationLevels, stationId).toHaveLength(10);
        expect(stationLevels.map((level) => level.stationOrder)).toEqual(
          Array.from({ length: 10 }, (_, index) => index + 1)
        );
      }
    }
  });

  it("uses saveVersion 2 without inheriting V1 completion or tutorial state", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 1,
      tutorialCompleted: true,
      soundEnabled: false,
      lastLevelId: "es-2-09",
      seenCheckpoints: ["chapter-1-station-1-review"],
      levels: {
        "es-1-01": { completed: true },
        "es-1-02": { completed: false },
        "es-9-99": { completed: true }
      }
    });

    expect(loaded).toMatchObject({ migrated: true, canPersist: true });
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

  it("provides sanitized V2 views but refuses to overwrite unknown current or future records", () => {
    const current = loadEquationSliderProgress({
      saveVersion: 2,
      tutorialCompleted: true,
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-4-50",
      levels: {
        "es-4-50": {
          startedCount: 2,
          completed: true,
          independent: true,
          hintCount: 1,
          badges: ["independent", "unknown"],
          bestMoves: 5
        },
        unknown: { completed: true }
      },
      seenCheckpoints: ["chapter-4-review", "chapter-4-review", 7]
    });
    const future = loadEquationSliderProgress({ saveVersion: 99, levels: { future: true } });

    expect(current).toMatchObject({ migrated: false, canPersist: false });
    expect(current.progress).toEqual({
      saveVersion: 2,
      tutorialCompleted: true,
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-4-50",
      levels: {
        "es-4-50": {
          startedCount: 2,
          completed: true,
          independent: true,
          hintCount: 1,
          badges: ["independent"],
          bestMoves: 5
        }
      },
      seenCheckpoints: ["chapter-4-review"]
    });
    expect(future).toEqual({
      progress: createDefaultProgress(),
      canPersist: false,
      migrated: false
    });
  });

  it.each([
    null,
    4,
    "bad",
    [],
    { saveVersion: "2", levels: "bad" },
    { saveVersion: 2, levels: [], seenCheckpoints: "bad" }
  ])("loads malformed progress without throwing", (value) => {
    expect(() => loadEquationSliderProgress(value)).not.toThrow();
    expect(loadEquationSliderProgress(value).progress.saveVersion).toBe(2);
  });

  it("moves through map states while retaining the best independent result", () => {
    let progress = createDefaultProgress();
    expect(levelMapState(progress.levels["es-1-01"])).toBe("unstarted");

    progress = recordLevelStart(progress, "es-1-01");
    expect(levelMapState(progress.levels["es-1-01"])).toBe("in-progress");

    progress = recordHintUse(progress, "es-1-01");
    progress = completeLevelProgress(progress, "es-1-01", {
      independent: false,
      moves: 7,
      badges: ["try-again"]
    });
    expect(levelMapState(progress.levels["es-1-01"])).toBe("review-suggested");

    progress = completeLevelProgress(progress, "es-1-01", {
      independent: true,
      moves: 4,
      badges: ["independent", "all-new"]
    });
    expect(levelMapState(progress.levels["es-1-01"])).toBe("completed");
    expect(progress.levels["es-1-01"]).toEqual({
      startedCount: 1,
      completed: true,
      independent: true,
      hintCount: 1,
      badges: ["try-again", "independent", "all-new"],
      bestMoves: 4
    });
    expect(progress.lastLevelId).toBe("es-1-01");
  });

  it("keeps tutorial, notice, sound, checkpoints, and recent-position updates orthogonal", () => {
    let progress = createDefaultProgress();
    progress = markTutorialCompleted(progress);
    progress = markUpgradeNoticeSeen(progress);
    progress = setSoundEnabled(progress, false);
    progress = markCheckpointSeen(progress, "chapter-1-station-1-review");
    progress = markCheckpointSeen(progress, "chapter-1-station-1-review");
    progress = recordLevelStart(progress, "es-1-01");

    expect(progress).toMatchObject({
      tutorialCompleted: true,
      upgradeNoticeSeen: true,
      soundEnabled: false,
      lastLevelId: "es-1-01",
      seenCheckpoints: ["chapter-1-station-1-review"]
    });
    expect(sanitizeLastLevelId(progress, new Set(["es-1-02"])).lastLevelId)
      .toBeUndefined();
    expect(sanitizeLastLevelId(progress, new Set(["es-1-01"])).lastLevelId)
      .toBe("es-1-01");
  });

  it("emits rest, station-review, and chapter-review checkpoints from real station fields", () => {
    const chapterLevels = EQUATION_SLIDER_V3_LEVELS.filter(
      (level) => level.chapterId === "chapter-1"
    );
    let progress = createDefaultProgress();

    progress = complete(progress, chapterLevels[4]);
    expect(resolveCompletionCheckpoint(progress, chapterLevels[4], chapterLevels)).toEqual({
      kind: "rest",
      checkpointId: "es-1-05-rest"
    });

    for (const level of chapterLevels.slice(0, 10)) {
      progress = complete(progress, level);
    }
    expect(resolveCompletionCheckpoint(progress, chapterLevels[9], chapterLevels)).toEqual({
      kind: "station-review",
      checkpointId: "chapter-1-station-1-review"
    });

    progress = markCheckpointSeen(progress, "chapter-1-station-1-review");
    for (const level of chapterLevels.slice(10)) {
      progress = complete(progress, level);
    }
    expect(resolveCompletionCheckpoint(progress, chapterLevels[49], chapterLevels)).toEqual({
      kind: "chapter-review",
      checkpointId: "chapter-1-review"
    });
  });
});

function complete(
  progress: ReturnType<typeof createDefaultProgress>,
  level: (typeof EQUATION_SLIDER_V3_LEVELS)[number]
): ReturnType<typeof createDefaultProgress> {
  return completeLevelProgress(progress, level.id, {
    independent: true,
    moves: level.analysis.minimumCorrectArrangements,
    badges: ["independent"]
  });
}

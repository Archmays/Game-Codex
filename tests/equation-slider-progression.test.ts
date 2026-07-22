import chapter4 from "../games/equation-slider/levels/chapter-4-reasoning.json";
import {
  createArrangementFeedback,
  evaluateArrangementOutcome,
  getHintMessage
} from "../games/equation-slider/feedback";
import {
  completeLevelProgress,
  createDefaultProgress,
  loadEquationSliderProgress,
  levelMapState,
  markCheckpointSeen,
  recordHintUse,
  recordLevelStart,
  resolveCompletionCheckpoint,
  sanitizeLastLevelId,
  setSoundEnabled
} from "../games/equation-slider/progress";
import type { PublishedEquationSliderLevel } from "../games/equation-slider/types";

const reasoningLevels = chapter4 as unknown as PublishedEquationSliderLevel[];

describe("equation slider progress", () => {
  it.each([null, 4, "bad", [], { saveVersion: 1, levels: [] }])("loads malformed progress safely", (value) => {
    expect(() => loadEquationSliderProgress(value)).not.toThrow();
    expect(loadEquationSliderProgress(value).progress.saveVersion).toBe(1);
  });

  it("migrates legacy completion, hints, tutorial, and sound", () => {
    const loaded = loadEquationSliderProgress({
      saveVersion: 0,
      completedLevels: ["es-1-01", "not-a-level"],
      hints: { "es-1-01": 2, "not-a-level": 99 },
      tutorialDone: true,
      muted: true
    });

    expect(loaded.migrated).toBe(true);
    expect(loaded.progress.tutorialCompleted).toBe(true);
    expect(loaded.progress.soundEnabled).toBe(false);
    expect(loaded.progress.levels["es-1-01"]).toMatchObject({ completed: true, hintCount: 2 });
    expect(Object.keys(loaded.progress.levels)).toEqual(["es-1-01"]);
  });

  it("drops unknown level IDs before they can inflate progress totals", () => {
    const record = { startedCount: 1, completed: true, independent: true, hintCount: 0, badges: [] };
    const loaded = loadEquationSliderProgress({
      saveVersion: 1,
      lastLevelId: "es-5-01",
      levels: {
        "es-4-50": record,
        "es-1-00": record,
        "es-1-51": record,
        "es-5-01": record,
        arbitrary: record
      }
    });

    expect(Object.keys(loaded.progress.levels)).toEqual(["es-4-50"]);
    expect(loaded.progress.lastLevelId).toBeUndefined();

    const inconsistent = loadEquationSliderProgress({
      saveVersion: 1,
      levels: {
        "es-1-01": {
          startedCount: 1,
          completed: false,
          independent: true,
          hintCount: 2,
          badges: ["independent", "all-new"],
          bestMoves: 1
        }
      }
    }).progress.levels["es-1-01"];
    expect(inconsistent).toEqual({
      startedCount: 1,
      completed: false,
      independent: false,
      hintCount: 2,
      badges: []
    });
  });

  it("does not authorize overwriting an unknown future save", () => {
    const loaded = loadEquationSliderProgress({ saveVersion: 99, levels: { future: true } });

    expect(loaded.canPersist).toBe(false);
    expect(loaded.progress).toEqual(createDefaultProgress());
  });

  it("keeps independent completion and badges once earned while hints only increase", () => {
    let progress = recordLevelStart(createDefaultProgress(), "es-1-01");
    progress = completeLevelProgress(progress, "es-1-01", {
      independent: true,
      moves: 4,
      badges: ["independent", "all-new"]
    });
    progress = recordHintUse(progress, "es-1-01");
    progress = completeLevelProgress(progress, "es-1-01", {
      independent: false,
      moves: 6,
      badges: []
    });

    expect(progress.levels["es-1-01"]).toMatchObject({
      completed: true,
      independent: true,
      hintCount: 1,
      bestMoves: 4
    });
    expect(progress.levels["es-1-01"].badges).toEqual(["independent", "all-new"]);
  });

  it("persists sound and checkpoint choices without affecting completion", () => {
    let progress = setSoundEnabled(createDefaultProgress(), false);
    progress = markCheckpointSeen(progress, "chapter-1-unit-1-rest");
    progress = markCheckpointSeen(progress, "chapter-1-unit-1-rest");

    expect(progress.soundEnabled).toBe(false);
    expect(progress.seenCheckpoints).toEqual(["chapter-1-unit-1-rest"]);
    expect(progress.levels).toEqual({});
  });

  it("distinguishes unstarted, in-progress, completed, and review-suggested map states", () => {
    expect(levelMapState(undefined)).toBe("unstarted");
    expect(levelMapState({ startedCount: 1, completed: false, independent: false, hintCount: 0, badges: [] })).toBe("in-progress");
    expect(levelMapState({ startedCount: 1, completed: true, independent: true, hintCount: 0, badges: [] })).toBe("completed");
    expect(levelMapState({ startedCount: 1, completed: true, independent: false, hintCount: 1, badges: [] })).toBe("review-suggested");
  });

  it("drops an invalid recent position", () => {
    const progress = { ...createDefaultProgress(), lastLevelId: "missing" };
    expect(sanitizeLastLevelId(progress, new Set(["es-1-01"])).lastLevelId).toBeUndefined();
  });

  it("shows station and chapter reviews only after the whole group is complete", () => {
    const chapterLevels = Array.from({ length: 50 }, (_, index) => ({
      id: `es-1-${String(index + 1).padStart(2, "0")}`,
      chapterId: "chapter-1",
      unitId: `chapter-1-unit-${Math.floor(index / 10) + 1}`,
      unitLevelNumber: index % 10 + 1
    }));
    let progress = createDefaultProgress();
    const levelFive = chapterLevels[4];
    const levelTen = chapterLevels[9];

    progress = completeLevelProgress(progress, levelFive.id, { independent: true, moves: 2, badges: [] });
    expect(resolveCompletionCheckpoint(progress, levelFive, chapterLevels).kind).toBe("rest");
    progress = completeLevelProgress(progress, levelTen.id, { independent: true, moves: 2, badges: [] });
    expect(resolveCompletionCheckpoint(progress, levelTen, chapterLevels).kind).toBe("normal");

    for (const level of chapterLevels.slice(0, 9)) {
      progress = completeLevelProgress(progress, level.id, { independent: true, moves: 2, badges: [] });
    }
    expect(resolveCompletionCheckpoint(progress, chapterLevels[8], chapterLevels)).toEqual({
      kind: "station-review",
      checkpointId: "chapter-1-unit-1-review"
    });

    for (const level of chapterLevels.slice(10)) {
      progress = completeLevelProgress(progress, level.id, { independent: false, moves: 3, badges: [] });
    }
    expect(resolveCompletionCheckpoint(progress, chapterLevels[49], chapterLevels)).toEqual({
      kind: "chapter-review",
      checkpointId: "chapter-1-review"
    });
  });
});

describe("equation slider feedback and hints", () => {
  it("derives exact equality differences from both evaluated sides", () => {
    const equality = reasoningLevels.find((level) => level.mode === "equality")!;
    const invalid = findArrangement(equality, (indexes) => {
      const outcome = evaluateArrangementOutcome(equality, indexes);
      return outcome.equalityDifference !== undefined && outcome.equalityDifference !== 0;
    });
    const outcome = evaluateArrangementOutcome(equality, invalid);
    const feedback = createArrangementFeedback(equality, invalid);

    expect(Math.abs(outcome.equalityDifference!)).toBeGreaterThan(0);
    expect(feedback.text).toContain(String(Math.abs(outcome.equalityDifference!)));
  });

  it("distinguishes multi-target completion from the nearest remaining target", () => {
    const multi = reasoningLevels.find((level) => level.mode === "multi-target")!;
    const valid = multi.analysis.canonicalPlan[0];
    const outcome = evaluateArrangementOutcome(multi, valid);
    const first = createArrangementFeedback(multi, valid, new Set());
    const repeated = createArrangementFeedback(multi, valid, new Set([outcome.targetIndex!]));

    expect(first.text).toContain("命中目标");
    expect(repeated.text).toContain("已经完成");
  });

  it("reveals the five hint layers in order from a real published plan", () => {
    const level = reasoningLevels.find((item) => item.mode === "target")!;
    const indexes = level.reels.map((reel) => reel.initialIndex);
    const hints = [1, 2, 3, 4, 5].map((depth) => getHintMessage(level, indexes, new Set(), new Set(), depth));

    expect(hints[0].text).toBe(level.conceptHint);
    expect(hints[1].depth).toBe(2);
    expect(hints[2]).toMatchObject({ depth: 3, reelIndex: expect.any(Number) });
    expect(hints[3]).toMatchObject({ depth: 4, direction: expect.stringMatching(/up|down/) });
    expect(hints[4].text).toContain("下一条成立算式");
  });

  it("keeps the published plan useful after partial progress", () => {
    for (const level of reasoningLevels) {
      const firstPlan = level.analysis.canonicalPlan[0];
      const firstOutcome = evaluateArrangementOutcome(level, firstPlan);
      const completedTargets = firstOutcome.targetIndex === undefined ? new Set<number>() : new Set([firstOutcome.targetIndex]);
      const hint = getHintMessage(level, firstPlan, new Set(firstOutcome.selectedTileIds), completedTargets, 5);
      if (level.analysis.canonicalPlan.length > 1) {
        expect(hint.targetIndexes, level.id).toBeTruthy();
      }
    }
  });
});

function findArrangement(
  level: PublishedEquationSliderLevel,
  predicate: (indexes: readonly number[]) => boolean
): readonly number[] {
  const current = new Array(level.reels.length).fill(0);
  let found: readonly number[] | undefined;
  const visit = (reelIndex: number): void => {
    if (found) {
      return;
    }
    if (reelIndex === level.reels.length) {
      if (predicate(current)) {
        found = [...current];
      }
      return;
    }
    for (let index = 0; index < level.reels[reelIndex].tiles.length; index += 1) {
      current[reelIndex] = index;
      visit(reelIndex + 1);
    }
  };
  visit(0);
  if (!found) {
    throw new Error(`No matching arrangement for ${level.id}`);
  }
  return found;
}

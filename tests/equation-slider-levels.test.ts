import chapter1 from "../games/equation-slider/levels/chapter-1-addition.json";
import chapter2 from "../games/equation-slider/levels/chapter-2-add-sub.json";
import chapter3 from "../games/equation-slider/levels/chapter-3-mul-div.json";
import chapter4 from "../games/equation-slider/levels/chapter-4-reasoning.json";
import generatedAudit from "../games/equation-slider/levels/generated-audit.json";
import { formatExpression } from "../games/equation-slider/evaluator";
import { auditLevelSet } from "../games/equation-slider/level-audit";
import { solveLevel } from "../games/equation-slider/solver";
import type { PublishedEquationSliderLevel } from "../games/equation-slider/types";

const levels = [...chapter1, ...chapter2, ...chapter3, ...chapter4] as unknown as PublishedEquationSliderLevel[];

describe("equation slider formal levels", () => {
  const audit = auditLevelSet(levels);

  it("publishes exactly 200 fixed levels across four complete chapters", () => {
    expect(levels).toHaveLength(200);
    expect(audit.summary.chapters).toEqual({
      "chapter-1": 50,
      "chapter-2": 50,
      "chapter-3": 50,
      "chapter-4": 50
    });
    expect(Object.keys(audit.summary.units)).toHaveLength(20);
    expect(Object.values(audit.summary.units).every((count) => count === 10)).toBe(true);
  });

  it("passes the full solver, metadata, progression, uniqueness, and diversity audit", () => {
    expect(audit.errors).toEqual([]);
    expect(audit.summary.solverValidated).toBe(200);
    expect(audit.summary.unsolvableLevels).toBe(0);
    expect(audit.summary.orphanTiles).toBe(0);
    expect(audit.summary.exactDuplicateStructures).toBe(0);
    expect(audit.summary.maximumFamilyReusePerUnit).toBeLessThanOrEqual(4);
    expect(audit.summary.maximumTopologyReusePerChapter).toBeLessThanOrEqual(8);
    expect(audit.summary.maximumConsecutiveTopologyReuse).toBeLessThanOrEqual(6);
    expect(audit.summary.threeReelTwoTileCohort).toBe(26);
    expect(audit.summary.threeReelTwoTilePlanCounts).toEqual({
      "0.0.1>1.1.0": 16,
      "0.1.0>1.0.1": 7,
      "0.1.1>1.0.0": 3
    });
    expect(audit.summary.maximumThreeReelTwoTilePlanReuse).toBeLessThanOrEqual(18);
    expect(audit.summary.maximumThreeReelTwoTileTopologyReusePerChapter).toBeLessThanOrEqual(6);
    expect(audit.summary.maximumConsecutiveCanonicalPlanReuse).toBeLessThanOrEqual(2);
    expect(audit.summary.openingPlanDiversityMinimum).toBeGreaterThanOrEqual(2);
    expect(audit.summary.advancedUniqueChallenges).toBeGreaterThanOrEqual(5);
    expect(audit.summary.trivialAlignedCompleteCovers).toBe(0);
    expect(audit.summary.nonTrivialCoverageLevels).toBeGreaterThanOrEqual(30);
    expect(audit.summary.initialDistanceDistribution).toEqual({ "1": 118, "2": 68, "3": 14 });
    expect(audit.summary.maximumGenerationAttempt).toBeLessThanOrEqual(1000);
  });

  it("contains all three modes and enough verified unique challenges", () => {
    expect(audit.summary.modes).toEqual({ target: 140, "multi-target": 40, equality: 20 });
    expect(audit.summary.uniqueChallenges).toBe(14);
  });

  it("uses the planned scaffold cycle in every station", () => {
    expect(audit.summary.scaffolds).toEqual({
      guided: 40,
      supported: 40,
      independent: 40,
      transfer: 40,
      review: 40
    });
    expect(audit.summary.crossChapterReviewCount).toBeGreaterThanOrEqual(10);
  });

  it("materializes real relation families and a rising chapter difficulty curve", () => {
    const chapterAverages = ["chapter-1", "chapter-2", "chapter-3", "chapter-4"].map((chapterId) => {
      const chapterLevels = levels.filter((level) => level.chapterId === chapterId);
      return chapterLevels.reduce((total, level) => total + level.analysis.difficultyMetrics.compositeDifficulty, 0)
        / chapterLevels.length;
    });
    expect(chapterAverages[1]).toBeGreaterThan(chapterAverages[0]);
    expect(chapterAverages[2]).toBeGreaterThan(chapterAverages[1]);
    expect(chapterAverages[3]).toBeGreaterThan(chapterAverages[2]);

    const advancedUnique = levels.filter((level) => {
      return level.challenge === "unique-minimum-cover"
        && level.analysis.difficultyMetrics.minimumCorrectExpressions >= 3
        && level.analysis.difficultyMetrics.validArrangementCount > level.analysis.difficultyMetrics.minimumCorrectExpressions;
    });
    expect(advancedUnique.length).toBeGreaterThanOrEqual(5);
    expect(levels.filter((level) => level.unitId === "chapter-2-unit-3").every((level) => level.mode === "multi-target")).toBe(true);
    expect(levels.filter((level) => level.unitId === "chapter-3-unit-4").every((level) => level.mode === "multi-target")).toBe(true);
  });

  it("removes the aligned-row shortcut and keeps reflection examples on the published reels", () => {
    for (const level of levels) {
      expect(
        level.analysis.canonicalPlan.every((indexes) => new Set(indexes).size === 1),
        `${level.id} should not use an all-aligned canonical plan`
      ).toBe(false);
      if (["multi-target", "unique-route"].includes(level.learning.primarySkill)) {
        continue;
      }
      const firstPlan = level.analysis.canonicalPlan[0];
      const expression = formatExpression(level.reels.map((reel, reelIndex) => reel.tiles[firstPlan[reelIndex]].value));
      expect(level.learning.reflectionText, level.id).toContain(expression);
    }
  });

  it("shows both inverse operations in relation-family reflections", () => {
    for (const level of levels) {
      const requiredOperators = level.learning.primarySkill === "fact-family"
        ? (["+", "−"] as const)
        : level.learning.primarySkill === "multiply-divide-inverse"
          ? (["×", "÷"] as const)
          : null;
      if (!requiredOperators) {
        continue;
      }
      const expressions = level.analysis.canonicalPlan.map((indexes) => {
        return formatExpression(level.reels.map((reel, reelIndex) => reel.tiles[indexes[reelIndex]].value));
      });
      for (const operator of requiredOperators) {
        const example = expressions.find((expression) => expression.includes(operator));
        expect(example, `${level.id} should solve with ${operator}`).toBeDefined();
        expect(level.learning.reflectionText, level.id).toContain(example);
      }
    }
  });

  it("keeps every published hint plan completable from reachable partial progress", () => {
    for (const level of levels) {
      const full = solveLevel(level);
      expect(full.status, level.id).toBe("solved");
      const prefix = full.canonicalPlan.slice(0, Math.max(1, full.canonicalPlan.length - 1));
      const arrangements = new Map(full.validArrangements.map((arrangement) => [arrangement.key, arrangement]));
      const covered = new Set<string>();
      const completedTargets = new Set<number>();
      for (const step of prefix) {
        const effect = arrangements.get(step.indexes.join("."));
        effect?.selectedTileIds.forEach((id) => covered.add(id));
        if (effect && effect.targetMask > 0) {
          for (let index = 0; index < 3; index += 1) {
            if ((effect.targetMask & (1 << index)) !== 0) {
              completedTargets.add(index);
            }
          }
        }
      }
      const continued = solveLevel(level, {
        coveredTileIds: [...covered],
        completedTargetIndexes: [...completedTargets]
      });
      expect(continued.status, level.id).toBe("solved");
    }
  });

  it("matches the checked-in compact generation audit", () => {
    expect(generatedAudit).toMatchObject({
      totalLevels: 200,
      solverValidated: 200,
      orphanTiles: 0,
      unsolvableLevels: 0,
      exactDuplicateStructures: 0,
      uniqueChallenges: 14
    });
    expect(Object.values(generatedAudit.targetValues).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(200);
    expect(Object.values(generatedAudit.operatorOccurrences).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0);
    expect(Object.values(generatedAudit.difficultyBands).reduce((sum, count) => sum + count, 0)).toBe(200);
    expect(generatedAudit.minimumSolutionSteps).toEqual({ "2": 35, "3": 127, "4": 33, "5": 5 });
    expect(Object.keys(generatedAudit.perChapter)).toEqual(["chapter-1", "chapter-2", "chapter-3", "chapter-4"]);
    expect(Object.values(generatedAudit.perChapter).map((chapter) => chapter.averageCompositeDifficulty)).toEqual([
      32.189,
      33.014,
      33.283,
      44.459
    ]);
    expect(generatedAudit.trivialAlignedCompleteCovers).toBe(0);
    expect(generatedAudit.nonTrivialCoverageLevels).toBe(38);
    expect(generatedAudit.initialDistanceDistribution).toEqual({ "1": 118, "2": 68, "3": 14 });
    expect(generatedAudit.threeReelTwoTileCohort).toBe(26);
    expect(generatedAudit.maximumThreeReelTwoTilePlanReuse).toBe(16);
    expect(generatedAudit.maximumThreeReelTwoTileTopologyReusePerChapter).toBe(6);
    expect(generatedAudit.maximumConsecutiveCanonicalPlanReuse).toBe(2);
    expect(generatedAudit.openingPlanDiversityMinimum).toBe(2);
    expect(generatedAudit.maximumGenerationAttempt).toBe(202);
  });
});

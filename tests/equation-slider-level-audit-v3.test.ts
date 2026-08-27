import { auditEquationSliderLevels } from "../games/equation-slider/level-audit";
import generatedAudit from "../games/equation-slider/levels/generated-audit.json";
import { EQUATION_SLIDER_V3_LEVELS } from "../games/equation-slider/levels/v3/catalog";

describe("equation slider V3 release audit", () => {
  const audit = auditEquationSliderLevels(EQUATION_SLIDER_V3_LEVELS);

  it("passes the complete 200-level structural, solver, and repetition gate", () => {
    expect({
      total: audit.totalLevels,
      chapters: audit.chapterCounts,
      stations: audit.stationCounts,
      gold: audit.goldCount,
      generated: audit.generatedCount,
      exactDuplicates: audit.exactDuplicateGroups,
      adjacentRepetitions: audit.adjacentRepetitions,
      overusedActions: audit.overusedCanonicalActionPatterns,
      invalid: audit.invalidPublishedLevels,
      unsolved: audit.unsolvedLevelIds,
      orphanTiles: audit.orphanTiles,
      repeatedValueReels: audit.repeatedValueReelCount,
      repeatedValueLevels: audit.repeatedValueLevelCount,
      repeatedValueKinds: audit.repeatedValueReelKindDistribution,
      repeatedValueTiles: audit.repeatedValueTileCount,
      coverableRepeatedValueTiles: audit.coverableRepeatedValueTileCount,
      uncoverableRepeatedValueTiles: audit.uncoverableRepeatedValueTiles,
      sameVisibleTransitions: audit.sameVisibleTransitionCount,
      sameVisibleTransitionLevels: audit.sameVisibleTransitionLevelCount,
      initialSameVisibleMoveLevels: audit.initialSameVisibleMoveLevelCount,
      requiredSameVisibleMoveLevels: audit.requiredSameVisibleMoveLevelIds,
      missingTargets: audit.missingTargets,
      stationDiversity: audit.stationDiversity
    }).toMatchObject({
      total: 200,
      chapters: {
        "chapter-1": 50,
        "chapter-2": 50,
        "chapter-3": 50,
        "chapter-4": 50
      },
      gold: 40,
      generated: 160,
      exactDuplicates: [],
      adjacentRepetitions: [],
      overusedActions: {},
      invalid: {},
      unsolved: [],
      orphanTiles: {},
      repeatedValueReels: 108,
      repeatedValueLevels: 82,
      repeatedValueKinds: { number: 68, operator: 40 },
      repeatedValueTiles: 216,
      coverableRepeatedValueTiles: 216,
      uncoverableRepeatedValueTiles: {},
      sameVisibleTransitions: 216,
      sameVisibleTransitionLevels: 82,
      initialSameVisibleMoveLevels: 45,
      requiredSameVisibleMoveLevels: [],
      missingTargets: {}
    });
    expect(audit.passes).toBe(true);
  });

  it("enumerates every same-display identity transition and proves a visible two-step alternative", () => {
    expect(Object.keys(audit.sameVisibleTransitions)).toHaveLength(82);
    expect(Object.keys(audit.initialSameVisibleMoves)).toHaveLength(45);
    expect(Object.keys(audit.sameVisibleCompletionPaths)).toHaveLength(82);
    expect(audit.sameVisibleShortestPathBenefitLevelIds).toHaveLength(39);
    expect(audit.initialSameVisibleShortestPathBenefitLevelIds).toHaveLength(21);
    expect(audit.requiredSameVisibleMoveLevelIds).toEqual([]);
    expect(
      Object.values(audit.sameVisibleTransitions)
        .flat()
        .every((finding) => finding.hasVisibleAlternative && finding.alternativeSteps === 2)
    ).toBe(true);
    expect(
      Object.values(audit.sameVisibleCompletionPaths).every((path) => (
        path.solvableWithoutSameVisibleEdges
        && path.shortestMovesWithoutSameVisibleEdges !== null
        && (path.shortestPathDelta === 0 || path.shortestPathDelta === 1)
      ))
    ).toBe(true);
  });

  it("reports number tiles rather than only target values", () => {
    const numberTileTotal = Object.values(audit.numberTileValueDistribution)
      .reduce((total, count) => total + count, 0);
    const targetTotal = Object.values(audit.targetDistribution)
      .reduce((total, count) => total + count, 0);
    expect(numberTileTotal).toBeGreaterThan(targetTotal);
    expect(audit.firstTenZeroCountByChapter["chapter-1"]).toBe(0);
    expect(audit.numberTileRange.minimum).toBeGreaterThanOrEqual(0);
    expect(audit.numberTileRange.maximum).toBeLessThanOrEqual(100);
  });

  it("keeps the computed identity-free audit hash aligned with the generated artifact", () => {
    expect(audit.deterministicHash).toBe(generatedAudit.deterministicHash);
    expect(audit.deterministicHash).toMatch(/^fnv1a32-[0-9a-f]{8}$/);
  });
});

import { auditEquationSliderLevels } from "../games/equation-slider/level-audit";
import {
  EQUATION_SLIDER_V3_LEVELS,
  GENERATED_V3_LEVELS,
  HAND_AUTHORED_GOLD_TEMPLATES,
  HAND_AUTHORED_V3_GOLD_LEVELS
} from "../games/equation-slider/levels/v3/catalog";
import {
  getMovableReels,
  solveLevel,
  validatePublishedLevel
} from "../games/equation-slider/solver";
import type {
  ArithmeticOperator,
  EquationTile,
  PublishedEquationSliderLevel,
  ReelDefinition
} from "../games/equation-slider/types";

const CHAPTER_IDS = [
  "chapter-1",
  "chapter-2",
  "chapter-3",
  "chapter-4"
] as const;

describe("equation slider V3 formal levels", () => {
  it("publishes 200 levels as four 50-level chapters with five 10-level stations each", () => {
    expect(EQUATION_SLIDER_V3_LEVELS).toHaveLength(200);
    expect(HAND_AUTHORED_GOLD_TEMPLATES).toHaveLength(40);
    expect(HAND_AUTHORED_V3_GOLD_LEVELS).toHaveLength(42);
    expect(GENERATED_V3_LEVELS).toHaveLength(158);

    for (const chapterId of CHAPTER_IDS) {
      const chapterLevels = levelsInChapter(chapterId);
      expect(chapterLevels).toHaveLength(50);
      expect(chapterLevels.map((level) => level.order)).toEqual(sequence(1, 50));
      expect(chapterLevels.filter((level) => level.provenance.kind === "hand-authored-gold"))
        .toHaveLength(chapterId === "chapter-1" ? 12 : 10);
      expect(chapterLevels.filter((level) => level.provenance.kind === "generated-from-gold"))
        .toHaveLength(chapterId === "chapter-1" ? 38 : 40);

      for (let station = 1; station <= 5; station += 1) {
        const stationLevels = chapterLevels.filter(
          (level) => level.stationId === `${chapterId}-station-${station}`
        );
        expect(stationLevels, `${chapterId} station ${station}`).toHaveLength(10);
        expect(stationLevels.map((level) => level.stationOrder)).toEqual(sequence(1, 10));
      }
    }
  });

  it("publishes every level through the strict V3 schema and solver gates", () => {
    const globallyUniqueIds: string[] = [];

    for (const level of EQUATION_SLIDER_V3_LEVELS) {
      const reels = getMovableReels(level);
      const solved = solveLevel(level);

      expect(level.schemaVersion, level.id).toBe(3);
      expect(validatePublishedLevel(level), level.id).toEqual([]);
      expect(solved.status, level.id).toBe("solved");
      expect(solved.orphanTileIds, level.id).toEqual([]);
      expect(solved.missingTargetIds, level.id).toEqual([]);
      expect(reels.length, level.id).toBeGreaterThanOrEqual(2);
      expect(reels.length, level.id).toBeLessThanOrEqual(5);
      expect(level.initialIndexes, level.id).toHaveLength(reels.length);
      expect(
        level.initialIndexes.every((index) => index === 0 || index === 1 || index === 2),
        level.id
      ).toBe(true);

      const movableTileIds = reels.flatMap((reel) => reel.tiles.map((tile) => tile.id));
      expect(new Set(level.requiredTileIds), level.id).toEqual(new Set(movableTileIds));
      expect(level.requiredTileIds, level.id).toHaveLength(movableTileIds.length);

      globallyUniqueIds.push(level.id, ...level.targets.map((target) => target.id));
      for (const slot of level.slots) {
        if (slot.kind === "fixed-token") {
          expect(level.requiredTileIds, level.id).not.toContain(slot.id);
          globallyUniqueIds.push(slot.id);
          continue;
        }
        assertMovableReelContract(level, slot.reel);
        globallyUniqueIds.push(slot.reel.id, ...slot.reel.tiles.map((tile) => tile.id));
      }
    }

    expect(new Set(globallyUniqueIds).size).toBe(globallyUniqueIds.length);
  }, 120_000);

  it("keeps number values and fixed or movable operators inside the release contract", () => {
    const observedOperators = new Set<ArithmeticOperator>();

    for (const level of EQUATION_SLIDER_V3_LEVELS) {
      for (const target of level.targets) {
        if (target.kind === "value") {
          assertSafeArithmeticNumber(level.id, target.value);
          continue;
        }
        for (const token of target.rightExpression) {
          if (typeof token === "number") {
            assertSafeArithmeticNumber(level.id, token);
          } else {
            expect(["+", "−", "×", "÷"], level.id).toContain(token);
            observedOperators.add(token);
          }
        }
      }

      for (const slot of level.slots) {
        if (slot.kind === "fixed-token") {
          if (typeof slot.token === "string") {
            expect(["+", "−", "×", "÷"], level.id).toContain(slot.token);
            observedOperators.add(slot.token);
          } else {
            assertSafeArithmeticNumber(level.id, slot.token);
          }
          continue;
        }

        for (const tile of slot.reel.tiles) {
          if (tile.kind === "number") {
            assertSafeNumberTileValue(level.id, tile.value);
          } else {
            expect(["+", "−", "×", "÷"], level.id).toContain(tile.value);
            observedOperators.add(tile.value as ArithmeticOperator);
          }
        }
      }
    }

    expect(observedOperators).toEqual(new Set<ArithmeticOperator>(["+", "−", "×", "÷"]));
  });

  it("enforces the chapter-specific learning progression contracts", () => {
    const chapter1 = levelsInChapter("chapter-1");
    expect(chapter1.some(hasMovableOperatorReel)).toBe(false);
    expect(numberTiles(chapter1.filter((level) => level.order <= 10)).filter(
      (tile) => tile.value === 0
    )).toHaveLength(0);
    expect(
      chapter1
        .filter((level) => level.order <= 10)
        .every((level) =>
          level.targets.every((target) => target.kind !== "value" || target.value <= 20)
        )
    ).toBe(true);

    const chapter2 = levelsInChapter("chapter-2");
    expect(chapter2.flatMap(levelOperators)).not.toContain("×");
    expect(chapter2.flatMap(levelOperators)).not.toContain("÷");

    const chapter3 = levelsInChapter("chapter-3");
    const addSubtractReviewCount = chapter3.filter((level) =>
      levelOperators(level).some((operator) => operator === "+" || operator === "−")
    ).length;
    expect(addSubtractReviewCount).toBeGreaterThanOrEqual(Math.ceil(chapter3.length * 0.2));

    const chapter4 = levelsInChapter("chapter-4");
    expect(chapter4.some((level) => level.mode === "multi-target")).toBe(true);
    expect(chapter4.some((level) => level.mode === "equality")).toBe(true);
    expect(chapter4.some((level) => getMovableReels(level).length === 5)).toBe(true);
  });

  it("passes the deterministic 200-level release audit", () => {
    const audit = auditEquationSliderLevels(EQUATION_SLIDER_V3_LEVELS);

    expect(audit).toMatchObject({
      schemaVersion: 3,
      totalLevels: 200,
      chapterCounts: {
        "chapter-1": 50,
        "chapter-2": 50,
        "chapter-3": 50,
        "chapter-4": 50
      },
      goldCount: 42,
      generatedCount: 158,
      exactDuplicateGroups: [],
      adjacentRepetitions: [],
      overusedCanonicalActionPatterns: {},
      invalidPublishedLevels: {},
      unsolvedLevelIds: [],
      orphanTiles: {},
      missingTargets: {},
      passes: true
    });
    expect(Object.keys(audit.stationCounts)).toHaveLength(20);
    expect(Object.values(audit.stationCounts).every((count) => count === 10)).toBe(true);
    expect(audit.firstTenZeroCountByChapter["chapter-1"]).toBe(0);
    expect(audit.deterministicHash).toMatch(/^fnv1a32-[0-9a-f]{8}$/);
  }, 120_000);
});

function levelsInChapter(
  chapterId: typeof CHAPTER_IDS[number]
): readonly PublishedEquationSliderLevel[] {
  return EQUATION_SLIDER_V3_LEVELS.filter((level) => level.chapterId === chapterId);
}

function sequence(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function assertMovableReelContract(
  level: PublishedEquationSliderLevel,
  reel: ReelDefinition
): void {
  expect(reel.tiles, reel.id).toHaveLength(3);
  expect(new Set(reel.tiles.map((tile) => tile.id)).size, reel.id).toBe(3);
  expect(reel.tiles.every((tile) => tile.kind === reel.kind), reel.id).toBe(true);
  expect(new Set(reel.tiles.map((tile) => tile.value)).size, reel.id).toBeGreaterThanOrEqual(2);

  if (reel.kind === "operator") {
    expect(
      reel.tiles.every((tile) => ["+", "−", "×", "÷"].includes(String(tile.value))),
      level.id
    ).toBe(true);
  } else {
    expect(
      reel.tiles.every((tile) =>
        typeof tile.value === "number"
          && Number.isSafeInteger(tile.value)
          && tile.value >= 0
          && tile.value <= 100
      ),
      level.id
    ).toBe(true);
  }
}

function assertSafeNumberTileValue(levelId: string, value: unknown): void {
  assertSafeArithmeticNumber(levelId, value);
  expect(value as number, levelId).toBeLessThanOrEqual(100);
}

function assertSafeArithmeticNumber(levelId: string, value: unknown): void {
  expect(typeof value, levelId).toBe("number");
  expect(Number.isSafeInteger(value), levelId).toBe(true);
  expect(value as number, levelId).toBeGreaterThanOrEqual(0);
}

function hasMovableOperatorReel(level: PublishedEquationSliderLevel): boolean {
  return level.slots.some(
    (slot) => slot.kind === "movable-reel" && slot.reel.kind === "operator"
  );
}

function numberTiles(
  levels: readonly PublishedEquationSliderLevel[]
): readonly EquationTile[] {
  return levels.flatMap((level) =>
    getMovableReels(level).flatMap((reel) =>
      reel.kind === "number" ? [...reel.tiles] : []
    )
  );
}

function levelOperators(level: PublishedEquationSliderLevel): readonly ArithmeticOperator[] {
  return level.slots.flatMap((slot) => {
    if (slot.kind === "fixed-token") {
      return typeof slot.token === "string" ? [slot.token] : [];
    }
    return slot.reel.kind === "operator"
      ? slot.reel.tiles.map((tile) => tile.value as ArithmeticOperator)
      : [];
  });
}

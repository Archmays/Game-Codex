import {
  findHintContinuation,
  getMovableReels,
  solveLevel,
  validatePublishedLevel
} from "../games/equation-slider/solver";
import {
  EQUATION_SLIDER_V3_LEVELS,
  GENERATED_V3_LEVELS,
  HAND_AUTHORED_GOLD_TEMPLATES,
  HAND_AUTHORED_V3_GOLD_LEVELS,
  getV3LevelById
} from "../games/equation-slider/levels/v3/catalog";
import {
  buildCompleteV3Catalog,
  V3_GENERATOR_VERSION
} from "../games/equation-slider/levels/v3/generator";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import {
  applyGameplayPilot12,
  PILOT_AUTHORING_VERSION,
  PILOT_REVISION_SOURCE
} from "../games/equation-slider/levels/v3/gameplay-pilot-12";

describe("equation slider V3 200-level catalog", () => {
  it("contains four 50-level chapters and five 10-level stations per chapter", () => {
    expect(EQUATION_SLIDER_V3_LEVELS).toHaveLength(200);
    expect(HAND_AUTHORED_V3_GOLD_LEVELS).toHaveLength(42);
    expect(GENERATED_V3_LEVELS).toHaveLength(158);

    for (let chapter = 1; chapter <= 4; chapter += 1) {
      const chapterLevels = EQUATION_SLIDER_V3_LEVELS.filter(
        (level) => level.chapterId === `chapter-${chapter}`
      );
      expect(chapterLevels.map((level) => level.order)).toEqual(
        Array.from({ length: 50 }, (_, index) => index + 1)
      );
      for (let station = 1; station <= 5; station += 1) {
        const stationLevels = chapterLevels.filter(
          (level) => level.stationId === `chapter-${chapter}-station-${station}`
        );
        expect(stationLevels).toHaveLength(10);
        expect(stationLevels.map((level) => level.stationOrder)).toEqual(
          Array.from({ length: 10 }, (_, index) => index + 1)
        );
      }
    }
  });

  it("keeps original template lineage and distinguishes the eleven authored pilot revisions", () => {
    for (const level of EQUATION_SLIDER_V3_LEVELS) {
      if (level.provenance.contentRevision) {
        expect(level.provenance).toEqual({
          kind: "hand-authored-gold",
          generatorVersion: PILOT_AUTHORING_VERSION,
          contentRevision: level.id === "es-1-11" ? "slider-pilot-12-copy-r1" : "slider-pilot-12-r1",
          revisionSource: PILOT_REVISION_SOURCE
        });
      } else if (level.order <= 10) {
        expect(level.provenance).toMatchObject({
          kind: "hand-authored-gold"
        });
        expect(level.provenance.templateId).toBeUndefined();
        expect(level.provenance.seed).toBeUndefined();
      } else {
        const templateOrder = ((level.order - 1) % 10) + 1;
        expect(level.provenance).toEqual({
          kind: "generated-from-gold",
          templateId: `es-${level.chapterId.at(-1)}-${String(templateOrder).padStart(2, "0")}`,
          seed: `${level.chapterId}:template-${templateOrder}:station-${Math.ceil(level.order / 10)}`,
          generatorVersion: V3_GENERATOR_VERSION
        });
      }
    }
  });

  it("publishes every level through the strict solver with complete coverage and usable hints", () => {
    for (const level of EQUATION_SLIDER_V3_LEVELS) {
      const reels = getMovableReels(level);
      const solved = solveLevel(level);
      const selectedAcrossValid = new Set(
        solved.validArrangements.flatMap((arrangement) => arrangement.selectedTileIds)
      );

      expect(validatePublishedLevel(level), level.id).toEqual([]);
      expect(solved.status, level.id).toBe("solved");
      expect(solved.orphanTileIds, level.id).toEqual([]);
      expect(solved.missingTargetIds, level.id).toEqual([]);
      expect(solved.minimumCorrectArrangements, level.id).toBeGreaterThanOrEqual(3);
      expect(reels.length, level.id).toBeGreaterThanOrEqual(2);
      expect(reels.length, level.id).toBeLessThanOrEqual(5);
      expect(reels.every((reel) => reel.tiles.length === 3), level.id).toBe(true);
      expect(new Set(level.requiredTileIds), level.id).toEqual(selectedAcrossValid);
      expect(
        level.slots
          .filter((slot) => slot.kind === "fixed-token")
          .every((slot) => !level.requiredTileIds.includes(slot.id)),
        level.id
      ).toBe(true);
      expect(
        solved.validArrangements.some(
          (arrangement) => arrangement.key === level.initialIndexes.join(".")
        ),
        level.id
      ).toBe(false);
      expect(
        findHintContinuation(level, level.initialIndexes, new Set(), new Set()),
        level.id
      ).toBeDefined();
    }
  }, 120_000);

  it("uses globally unique stable IDs for levels, reels, fixed slots, targets, and tiles", () => {
    const ids: string[] = [];
    for (const level of EQUATION_SLIDER_V3_LEVELS) {
      ids.push(level.id, ...level.targets.map((target) => target.id));
      for (const slot of level.slots) {
        if (slot.kind === "fixed-token") {
          ids.push(slot.id);
        } else {
          ids.push(slot.reel.id, ...slot.reel.tiles.map((tile) => tile.id));
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(getV3LevelById("es-2-41")).toMatchObject({
      id: "es-2-41",
      order: 41,
      provenance: {
        kind: "generated-from-gold",
        templateId: "es-2-01"
      }
    });
    expect(getMovableReels(getV3LevelById("es-2-41")!)).toHaveLength(3);
    expect(getMovableReels(getV3LevelById("es-4-50")!)).toHaveLength(5);
  });

  it("is byte-for-byte deterministic for the same authored templates", () => {
    const regenerated = applyGameplayPilot12(buildCompleteV3Catalog(
      HAND_AUTHORED_GOLD_TEMPLATES,
      FIRST_GOLD_LEVEL
    ));
    expect(JSON.stringify(regenerated)).toBe(JSON.stringify(EQUATION_SLIDER_V3_LEVELS));
  }, 120_000);

  it("meets local repetition and diversity quality thresholds", () => {
    const all = EQUATION_SLIDER_V3_LEVELS;
    for (let index = 1; index < all.length; index += 1) {
      const previous = all[index - 1];
      const current = all[index];
      if (previous.chapterId === current.chapterId) {
        expect(current.analysis.signatures.valueStructure, current.id)
          .not.toBe(previous.analysis.signatures.valueStructure);
      }
    }

    for (const chapter of [1, 2, 3, 4]) {
      const chapterLevels = all.filter((level) => level.chapterId === `chapter-${chapter}`);
      for (let start = 0; start <= chapterLevels.length - 10; start += 1) {
        const window = chapterLevels.slice(start, start + 10);
        expect(
          new Set(window.map((level) => level.analysis.signatures.rotationNormalized)).size,
          `${chapter}:${start + 1}-${start + 10}`
        ).toBeGreaterThanOrEqual(8);
      }
      for (let station = 1; station <= 5; station += 1) {
        const stationLevels = chapterLevels.filter(
          (level) => level.stationId === `chapter-${chapter}-station-${station}`
        );
        expect(
          new Set(stationLevels.map((level) => level.analysis.signatures.valueStructure)).size,
          `chapter ${chapter}, station ${station}`
        ).toBe(10);
      }
    }

    const reelCounts = new Set(all.map((level) => getMovableReels(level).length));
    const modes = new Set(all.map((level) => level.mode));
    const operators = new Set(
      all.flatMap((level) =>
        level.slots.flatMap((slot) =>
          slot.kind === "fixed-token"
            ? typeof slot.token === "string" ? [slot.token] : []
            : slot.reel.kind === "operator"
              ? slot.reel.tiles.map((tile) => tile.value)
              : []
        )
      )
    );
    const primarySkills = new Set(
      HAND_AUTHORED_V3_GOLD_LEVELS.map((level) => level.learning.primarySkill)
    );
    const authoredObjectives = new Set(
      HAND_AUTHORED_V3_GOLD_LEVELS.map((level) => level.learning.objective)
    );
    const authoredStructures = new Set(
      HAND_AUTHORED_V3_GOLD_LEVELS.map((level) => level.analysis.signatures.slotStructure)
    );
    const countByMode = Object.fromEntries(
      ["target", "multi-target", "equality"].map((mode) => [
        mode,
        all.filter((level) => level.mode === mode).length
      ])
    );
    const countByReelCount = Object.fromEntries(
      [2, 3, 4, 5].map((count) => [
        count,
        all.filter((level) => getMovableReels(level).length === count).length
      ])
    );

    expect(reelCounts).toEqual(new Set([2, 3, 4, 5]));
    expect(modes).toEqual(new Set(["target", "multi-target", "equality"]));
    expect(operators).toEqual(new Set(["+", "−", "×", "÷"]));
    expect(countByMode).toEqual({
      target: 129,
      "multi-target": 32,
      equality: 39
    });
    expect(countByReelCount).toEqual({
      2: 61,
      3: 100,
      4: 24,
      5: 15
    });
    expect(primarySkills.size).toBeGreaterThanOrEqual(32);
    expect(authoredObjectives.size).toBe(42);
    expect(authoredStructures.size).toBeGreaterThanOrEqual(9);
    expect(
      all.every((level) =>
        getMovableReels(level).every((reel) =>
          new Set(reel.tiles.map((tile) => tile.value)).size >= 2
        )
      )
    ).toBe(true);
  });

  it("keeps the early addition runway fixed-plus and zero-free", () => {
    const early = EQUATION_SLIDER_V3_LEVELS.filter(
      (level) => level.chapterId === "chapter-1" && level.order <= 5
    );
    for (const level of early) {
      expect(
        level.slots.filter((slot) => slot.kind === "fixed-token").map((slot) => slot.token)
      ).toEqual(["+"]);
      expect(
        getMovableReels(level)
          .flatMap((reel) => reel.tiles)
          .some((tile) => tile.value === 0)
      ).toBe(false);
    }
  });

  it("enforces chapter-specific operator progression and review spacing", () => {
    const chapterOne = EQUATION_SLIDER_V3_LEVELS.filter(
      (level) => level.chapterId === "chapter-1"
    );
    const chapterTwo = EQUATION_SLIDER_V3_LEVELS.filter(
      (level) => level.chapterId === "chapter-2"
    );
    const chapterThree = EQUATION_SLIDER_V3_LEVELS.filter(
      (level) => level.chapterId === "chapter-3"
    );
    const operatorsFor = (level: (typeof EQUATION_SLIDER_V3_LEVELS)[number]) =>
      level.slots.flatMap((slot) =>
        slot.kind === "fixed-token"
          ? typeof slot.token === "string" ? [slot.token] : []
          : slot.reel.kind === "operator"
            ? slot.reel.tiles.map((tile) => tile.value)
            : []
      );

    expect(
      chapterOne.flatMap((level) =>
        getMovableReels(level).filter((reel) => reel.kind === "operator")
      )
    ).toHaveLength(0);
    expect(
      chapterOne.every((level) => operatorsFor(level).every((operator) => operator === "+"))
    ).toBe(true);
    expect(
      chapterOne
        .filter((level) => level.order <= 10)
        .flatMap((level) => getMovableReels(level))
        .flatMap((reel) => reel.tiles)
        .filter((tile) => tile.value === 0)
    ).toHaveLength(0);
    const chapterOneNumberTiles = chapterOne.flatMap((level) =>
      getMovableReels(level)
        .filter((reel) => reel.kind === "number")
        .flatMap((reel) => reel.tiles.map((tile) => Number(tile.value)))
    );
    const chapterOneResults = chapterOne.flatMap((level) =>
      level.analysis.validArrangements.map((arrangement) => arrangement.result)
    );
    const chapterOneGoalNumbers = chapterOne.flatMap((level) =>
      level.targets.flatMap((target) =>
        target.kind === "value"
          ? [target.value]
          : target.rightExpression.filter((token): token is number => typeof token === "number")
      )
    );
    expect(Math.max(...chapterOneNumberTiles)).toBeLessThanOrEqual(20);
    expect(Math.max(...chapterOneResults)).toBeLessThanOrEqual(20);
    expect(Math.max(...chapterOneGoalNumbers)).toBeLessThanOrEqual(20);

    expect(
      chapterTwo.every((level) =>
        operatorsFor(level).every((operator) => operator === "+" || operator === "−")
      )
    ).toBe(true);
    expect(
      chapterTwo.flatMap((level) => operatorsFor(level)).filter(
        (operator) => operator === "×" || operator === "÷"
      )
    ).toHaveLength(0);

    const chapterThreeAddSubtractReview = chapterThree.filter((level) =>
      operatorsFor(level).some((operator) => operator === "+" || operator === "−")
    );
    expect(chapterThreeAddSubtractReview.length).toBeGreaterThanOrEqual(10);
    expect(chapterThreeAddSubtractReview.length / chapterThree.length).toBeGreaterThanOrEqual(0.2);
  });
});

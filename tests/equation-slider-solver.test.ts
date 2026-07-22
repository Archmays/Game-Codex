import {
  canonicalStructureSignature,
  enumerateArrangements,
  getRequiredTileIds,
  solveLevel,
  solutionTopologySignature,
  validateLevelDefinition
} from "../games/equation-slider/solver";
import type { ArithmeticOperator, EquationSliderLevelDefinition, EquationTile, LearningMetadata } from "../games/equation-slider/types";

const learning: LearningMetadata = {
  learningObjective: "找到两条结果为 5 的算式，并覆盖每个独立方块。",
  primarySkill: "fact-family",
  skillTags: ["fact-family", "difference"],
  misconceptionTags: ["value-vs-tile-identity"],
  scaffoldLevel: "independent",
  reviewOf: ["addition", "subtraction"],
  reflectionText: "1 加 4 和 8 减 3 都等于 5。",
  recommendedAgeBand: "6-8 岁"
};

describe("equation slider solver", () => {
  it("enumerates the full cartesian product", () => {
    expect(enumerateArrangements(createUniqueFixture())).toHaveLength(8);
  });

  it("finds a deterministic shortest complete cover", () => {
    const analysis = solveLevel(createUniqueFixture());

    expect(analysis.status).toBe("solved");
    expect(analysis.orphanTileIds).toEqual([]);
    expect(analysis.minimumCorrectExpressions).toBe(2);
    expect(analysis.canonicalPlan.map((step) => step.indexes.join("."))).toEqual(["0.0.0", "1.1.1"]);
    expect(analysis.minimumCoverSetCountCapped).toBe(1);
  });

  it("counts minimum cover sets without treating execution order as another solution", () => {
    const analysis = solveLevel(createUniqueFixture());

    expect(analysis.minimumCorrectExpressions).toBe(2);
    expect(analysis.minimumCoverSetCountCapped).toBe(1);
  });

  it("caps non-unique minimum cover sets at two", () => {
    const analysis = solveLevel(createDuplicateValueFixture());

    expect(analysis.status).toBe("solved");
    expect(analysis.minimumCorrectExpressions).toBe(2);
    expect(analysis.minimumCoverSetCountCapped).toBe(2);
  });

  it("keeps duplicate values as distinct tile coverage bits", () => {
    const level = createDuplicateValueFixture();
    const analysis = solveLevel(level);
    const masks = new Set(analysis.validArrangements.map((arrangement) => arrangement.tileMask));

    expect(getRequiredTileIds(level)).toHaveLength(6);
    expect(analysis.validArrangements).toHaveLength(8);
    expect(masks.size).toBe(8);
  });

  it("detects orphan tiles", () => {
    const base = createUniqueFixture();
    const level: EquationSliderLevelDefinition = {
      ...base,
      reels: base.reels.map((reel, index) => index === 0
        ? { ...reel, tiles: [reel.tiles[0], numberTile("n1-orphan", 99)] }
        : reel)
    };
    const analysis = solveLevel(level);

    expect(analysis.status).toBe("unsolvable");
    expect(analysis.orphanTileIds).toContain("n1-orphan");
    expect(analysis.errors.join(" ")).toContain("orphan tiles");
  });

  it("requires both target coverage and tile coverage in multi-target mode", () => {
    const base = createUniqueFixture();
    const level: EquationSliderLevelDefinition = {
      ...base,
      mode: "multi-target",
      targets: [5, 12]
    };
    const analysis = solveLevel(level);

    expect(analysis.status).toBe("solved");
    expect(analysis.minimumCorrectExpressions).toBe(3);
    expect(new Set(analysis.validArrangements.map((arrangement) => arrangement.targetMask))).toEqual(new Set([1, 2]));
  });

  it("continues solving from partial tile and target coverage", () => {
    const base = createUniqueFixture();
    const level: EquationSliderLevelDefinition = {
      ...base,
      mode: "multi-target",
      targets: [5, 12]
    };
    const first = solveLevel(level).validArrangements.find((arrangement) => arrangement.key === "0.0.0");
    expect(first).toBeTruthy();

    const continued = solveLevel(level, {
      coveredTileIds: first!.selectedTileIds,
      completedTargetIndexes: [0]
    });
    expect(continued.status).toBe("solved");
    expect(continued.minimumCorrectExpressions).toBe(2);
  });

  it("evaluates both sides in equality mode", () => {
    const base = createUniqueFixture();
    const level: EquationSliderLevelDefinition = {
      ...base,
      mode: "equality",
      rightExpression: [2, "+", 3]
    };
    const analysis = solveLevel(level);

    expect(analysis.status).toBe("solved");
    expect(analysis.validArrangements.every((arrangement) => arrangement.result === arrangement.rightResult)).toBe(true);
  });

  it("fails closed when the arrangement limit is exceeded", () => {
    const analysis = solveLevel(createUniqueFixture(), {}, {
      maxArrangements: 1,
      maxCoverageStates: 8192,
      maxMinimumCoverSearchNodes: 100_000
    });

    expect(analysis.status).toBe("limit-exceeded");
    expect(analysis.errors).toContain("arrangement limit exceeded: 8");
  });

  it("validates reel shape, IDs, math conditions, and learning metadata", () => {
    expect(validateLevelDefinition(createUniqueFixture())).toEqual([]);
    const invalid = { ...createUniqueFixture(), reels: createUniqueFixture().reels.slice(0, 2) } as EquationSliderLevelDefinition;
    expect(validateLevelDefinition(invalid)).toContain("levels must contain 3 or 5 movable reels");
  });

  it("fails closed for unknown runtime enum values", () => {
    const malformed = {
      ...createUniqueFixture(),
      mode: "bogus",
      challenge: "mystery",
      learning: { ...learning, scaffoldLevel: "mystery" }
    } as unknown as EquationSliderLevelDefinition;

    expect(validateLevelDefinition(malformed)).toEqual(expect.arrayContaining([
      "mode must be target, multi-target, or equality",
      "challenge must be standard or unique-minimum-cover",
      "scaffoldLevel is invalid"
    ]));
    expect(() => solveLevel(malformed)).not.toThrow();
    expect(solveLevel(malformed).status).toBe("invalid-level");
  });

  it("produces deterministic structure and solution topology signatures", () => {
    const level = createUniqueFixture();
    const analysis = solveLevel(level);
    const rotated: EquationSliderLevelDefinition = {
      ...level,
      id: "rotated",
      reels: level.reels.map((reel) => ({ ...reel, tiles: [reel.tiles[1], reel.tiles[0]] }))
    };

    expect(canonicalStructureSignature(rotated)).toBe(canonicalStructureSignature(level));
    expect(solutionTopologySignature(level, analysis)).toBe(solutionTopologySignature(level, solveLevel(level)));
  });
});

function createUniqueFixture(): EquationSliderLevelDefinition {
  return {
    schemaVersion: 1,
    id: "fixture-unique",
    chapterId: "chapter-2",
    unitId: "chapter-2-unit-5",
    levelNumber: 48,
    unitLevelNumber: 8,
    mode: "target",
    target: 5,
    challenge: "unique-minimum-cover",
    reels: [
      { id: "r1", kind: "number", initialIndex: 0, tiles: [numberTile("n1-a", 1), numberTile("n1-b", 8)] },
      { id: "r2", kind: "operator", initialIndex: 1, tiles: [operatorTile("op-a", "+"), operatorTile("op-b", "−")] },
      { id: "r3", kind: "number", initialIndex: 0, tiles: [numberTile("n2-a", 4), numberTile("n2-b", 3)] }
    ],
    learning,
    provenance: { generatorVersion: "test", seed: "fixture", familyId: "unique-two-expression" },
    conceptHint: "一条加法和一条减法都能得到 5。"
  };
}

function createDuplicateValueFixture(): EquationSliderLevelDefinition {
  return {
    ...createUniqueFixture(),
    id: "fixture-duplicate-values",
    challenge: "standard",
    reels: [
      { id: "r1", kind: "number", initialIndex: 0, tiles: [numberTile("n1-a", 1), numberTile("n1-b", 1)] },
      { id: "r2", kind: "operator", initialIndex: 0, tiles: [operatorTile("op-a", "+"), operatorTile("op-b", "+")] },
      { id: "r3", kind: "number", initialIndex: 1, tiles: [numberTile("n2-a", 4), numberTile("n2-b", 4)] }
    ]
  };
}

function numberTile(id: string, value: number): EquationTile {
  return { id, kind: "number", value };
}

function operatorTile(id: string, value: ArithmeticOperator): EquationTile {
  return { id, kind: "operator", value };
}

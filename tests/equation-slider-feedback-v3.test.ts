import {
  createArrangementFeedback,
  formatCurrentExpression,
  getDynamicHint
} from "../games/equation-slider/feedback";
import { evaluateArrangementOutcome, publishLevel } from "../games/equation-slider/solver";
import type {
  EquationSliderLevelDefinition,
  PublishedEquationSliderLevel
} from "../games/equation-slider/types";

const definition: EquationSliderLevelDefinition = {
  schemaVersion: 3,
  id: "feedback-v3",
  chapterId: "chapter-1",
  stationId: "station-1",
  order: 1,
  stationOrder: 1,
  mode: "target",
  challenge: "standard",
  slots: [
    {
      kind: "movable-reel",
      reel: {
        id: "left",
        kind: "number",
        tiles: [
          { id: "left-1", kind: "number", value: 1 },
          { id: "left-2", kind: "number", value: 2 },
          { id: "left-4", kind: "number", value: 4 }
        ]
      }
    },
    {
      kind: "fixed-token",
      id: "plus",
      token: "+",
      ariaLabel: "加号"
    },
    {
      kind: "movable-reel",
      reel: {
        id: "right",
        kind: "number",
        tiles: [
          { id: "right-5", kind: "number", value: 5 },
          { id: "right-4", kind: "number", value: 4 },
          { id: "right-2", kind: "number", value: 2 }
        ]
      }
    }
  ],
  initialIndexes: [2, 0],
  requiredTileIds: ["left-1", "left-2", "left-4", "right-5", "right-4", "right-2"],
  targets: [{ kind: "value", id: "sum-6", value: 6 }],
  learning: {
    objective: "用三组不同加法组成 6",
    primarySkill: "加法分解",
    skillTags: ["addition"],
    prerequisiteTags: ["counting"],
    misconceptionTags: ["only-one-pair"],
    scaffold: "guided",
    reviewOf: [],
    reflection: "你找到了哪些组成 6 的方法？",
    recommendedAgeBand: "6-8"
  },
  hints: [
    { kind: "concept", text: "找两个合起来是 6 的数。" },
    { kind: "position", text: "先找还没点亮的滑轨。" },
    { kind: "direction", text: "每次只移动一格。" }
  ],
  provenance: {
    kind: "hand-authored-gold",
    generatorVersion: "feedback-test"
  }
};

const level = publishLevel(definition);

function state(
  indexes: readonly number[],
  coveredTileIds: readonly string[] = [],
  completedTargetIds: readonly string[] = []
) {
  return {
    indexes,
    coveredTileIds: new Set(coveredTileIds),
    completedTargetIds: new Set(completedTargetIds)
  };
}

describe("equation slider V3 feedback", () => {
  it("uses explicit target IDs and distinguishes new from repeated success", () => {
    expect(createArrangementFeedback(level, state([0, 0]))).toEqual({
      kind: "success",
      text: "命中目标 6。"
    });
    expect(createArrangementFeedback(level, state([0, 0], [], ["sum-6"]))).toEqual({
      kind: "success",
      text: "结果 6 正确，继续点亮新方块。"
    });
    expect(createArrangementFeedback(level, state([2, 0]))).toEqual({
      kind: "info",
      text: "比目标 6 大 3。"
    });
  });

  it("returns concept, live reel position, and live direction in three levels", () => {
    const board = state([2, 0]);
    const concept = getDynamicHint(level, board, 1);
    const position = getDynamicHint(level, board, 2);
    const direction = getDynamicHint(level, board, 3);

    expect(concept).toMatchObject({
      depth: 1,
      kind: "concept",
      text: "找两个合起来是 6 的数。"
    });
    expect(position).toMatchObject({
      depth: 2,
      kind: "position",
      reelIndex: expect.any(Number),
      reelId: expect.any(String)
    });
    expect(position.text).toContain(`第 ${position.reelIndex! + 1} 条滑轨`);
    expect(direction).toMatchObject({
      depth: 3,
      kind: "direction",
      reelIndex: position.reelIndex,
      reelId: position.reelId,
      direction: expect.stringMatching(/^(up|down)$/)
    });
  });

  it("recomputes after a correct route outside the stored canonical plan", () => {
    const unexpected = evaluateArrangementOutcome(level, [2, 2]);
    expect(unexpected.valid).toBe(true);
    const decoyPlanLevel: PublishedEquationSliderLevel = {
      ...level,
      analysis: {
        ...level.analysis,
        canonicalPlan: [{ indexes: [2, 2] }]
      }
    };
    const board = state(
      [2, 2],
      unexpected.selectedTileIds,
      unexpected.satisfiedTargetIds
    );

    const hint = getDynamicHint(decoyPlanLevel, board, 3);

    expect(hint.direction).toMatch(/^(up|down)$/);
    expect(hint.targetIndexes).not.toEqual([2, 2]);
    expect(hint.text).not.toContain("找不到");
  });

  it("fails closed for malformed state and for an incomplete state without a solver continuation", () => {
    expect(createArrangementFeedback(level, state([99, 0])).text).toContain("重置");
    expect(formatCurrentExpression(level, [0])).toBe("轨道状态不可用");
    expect(getDynamicHint(level, state([0]), 3)).toMatchObject({
      depth: 3,
      kind: "direction",
      text: expect.stringContaining("重置")
    });

    const noContinuationLevel: PublishedEquationSliderLevel = {
      ...level,
      analysis: {
        ...level.analysis,
        validArrangements: []
      }
    };
    expect(getDynamicHint(noContinuationLevel, state([2, 0]), 2).text).toContain("重置");
  });

  it("reports completion instead of inventing another move", () => {
    const hint = getDynamicHint(
      level,
      state(level.initialIndexes, level.requiredTileIds, ["sum-6"]),
      3
    );
    expect(hint).toMatchObject({
      depth: 3,
      kind: "direction",
      text: "本关目标已经全部完成。"
    });
    expect(hint.direction).toBeUndefined();
  });
});

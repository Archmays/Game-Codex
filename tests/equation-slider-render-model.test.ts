import { createInitialBoardSession } from "../games/equation-slider/board-state";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import { createBoardRenderModel } from "../games/equation-slider/render-model";
import { publishLevel } from "../games/equation-slider/solver";
import type {
  ArithmeticOperator,
  EquationSliderLevelDefinition,
  EquationTile,
  ExpressionSlot,
  PublishedEquationSliderLevel
} from "../games/equation-slider/types";

describe("equation slider V3 render model", () => {
  it.each([
    ["two", () => FIRST_GOLD_LEVEL, 6],
    ["three", () => createThreeReelLevel(), 9],
    ["five", () => createFiveReelLevel(), 15]
  ] as const)("renders %s movable reels as unique formal tile identities", (_name, createLevel, count) => {
    const level = createLevel();
    const state = createInitialBoardSession(level).present;
    const model = createBoardRenderModel(level, state);
    const movable = model.slots.filter((slot) => slot.kind === "movable-reel");

    expect(model.formalTileIds).toHaveLength(count);
    expect(new Set(model.formalTileIds).size).toBe(count);
    expect(movable).toHaveLength(count / 3);
    movable.forEach((reel) => {
      expect(reel.tiles).toHaveLength(3);
      expect(new Set(reel.tiles.map((tile) => tile.position))).toEqual(
        new Set(["previous", "current", "next"])
      );
    });
  });

  it("keeps fixed operators out of the formal tile set", () => {
    const state = createInitialBoardSession(FIRST_GOLD_LEVEL).present;
    const model = createBoardRenderModel(FIRST_GOLD_LEVEL, state);
    const fixed = model.slots.find((slot) => slot.kind === "fixed-token");

    expect(fixed).toMatchObject({ id: "es-1-01-plus", token: "+" });
    expect(model.formalTileIds).not.toContain("es-1-01-plus");
  });

  it.each([
    ["two", () => FIRST_GOLD_LEVEL],
    ["three", () => createThreeReelLevel()],
    ["five", () => createFiveReelLevel()]
  ] as const)("preserves the exact formal ID set while every %s-reel board rotates", (_name, createLevel) => {
    const level = createLevel();
    const initial = createInitialBoardSession(level).present;
    const before = createBoardRenderModel(level, initial);
    const rotated = createBoardRenderModel(level, {
      ...initial,
      indexes: initial.indexes.map((index) => (index + 1) % 3)
    });

    expect(new Set(rotated.formalTileIds)).toEqual(new Set(before.formalTileIds));
    expect(rotated.formalTileIds).toHaveLength(before.formalTileIds.length);
  });
});

function createThreeReelLevel(): PublishedEquationSliderLevel {
  return publishLevel(createFixture({
    id: "render-three",
    target: 6,
    initialIndexes: [2, 0, 0],
    slots: [
      numberReel("render-three-left", [1, 8, 9]),
      operatorReel("render-three-op", ["+", "−", "−"]),
      numberReel("render-three-right", [5, 2, 3])
    ]
  }));
}

function createFiveReelLevel(): PublishedEquationSliderLevel {
  return publishLevel(createFixture({
    id: "render-five",
    target: 6,
    initialIndexes: [2, 0, 0, 0, 0],
    slots: [
      numberReel("render-five-left", [1, 5, 6]),
      operatorReel("render-five-op-a", ["+", "+", "−"]),
      numberReel("render-five-middle", [4, 3, 2]),
      operatorReel("render-five-op-b", ["+", "−", "+"]),
      numberReel("render-five-right", [1, 2, 2])
    ]
  }));
}

function createFixture(options: {
  readonly id: string;
  readonly target: number;
  readonly initialIndexes: readonly number[];
  readonly slots: readonly ExpressionSlot[];
}): EquationSliderLevelDefinition {
  const requiredTileIds = options.slots.flatMap((slot) =>
    slot.kind === "movable-reel" ? slot.reel.tiles.map((tile) => tile.id) : []
  );
  return {
    schemaVersion: 3,
    id: options.id,
    chapterId: "chapter-test",
    stationId: "chapter-test-station-1",
    order: 1,
    stationOrder: 1,
    mode: "target",
    challenge: "standard",
    slots: options.slots,
    initialIndexes: options.initialIndexes,
    requiredTileIds,
    targets: [{ kind: "value", id: `${options.id}-target`, value: options.target }],
    learning: {
      objective: "验证三片滑轨的正式渲染模型。",
      primarySkill: "render-contract",
      skillTags: ["render-contract"],
      prerequisiteTags: [],
      misconceptionTags: ["duplicate-tile-identity"],
      scaffold: "independent",
      reviewOf: [],
      reflection: "旋转前后，每片实体方块是否仍然只出现一次？",
      recommendedAgeBand: "测试夹具"
    },
    hints: [
      { kind: "concept", text: "寻找结果相同的算式。" },
      { kind: "position", text: "观察每条滑轨的中央方块。" },
      { kind: "direction", text: "一次只转动一格。" }
    ],
    provenance: {
      kind: "hand-authored-gold",
      generatorVersion: "render-test-v3"
    }
  };
}

function numberReel(id: string, values: readonly [number, number, number]): ExpressionSlot {
  return {
    kind: "movable-reel",
    reel: {
      id,
      kind: "number",
      tiles: values.map((value, index) => numberTile(`${id}-${index}`, value)) as [
        EquationTile,
        EquationTile,
        EquationTile
      ]
    }
  };
}

function operatorReel(
  id: string,
  values: readonly [ArithmeticOperator, ArithmeticOperator, ArithmeticOperator]
): ExpressionSlot {
  return {
    kind: "movable-reel",
    reel: {
      id,
      kind: "operator",
      tiles: values.map((value, index) => ({
        id: `${id}-${index}`,
        kind: "operator",
        value
      })) as [EquationTile, EquationTile, EquationTile]
    }
  };
}

function numberTile(id: string, value: number): EquationTile {
  return { id, kind: "number", value };
}

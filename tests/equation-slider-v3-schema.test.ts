import {
  evaluateArrangementOutcome,
  getMovableReels,
  validateLevelDefinition,
  validatePublishedLevel
} from "../games/equation-slider/solver";
import { parsePublishedChapter } from "../games/equation-slider/schema";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import type {
  EquationSliderLevelDefinition,
  ExpressionSlot
} from "../games/equation-slider/types";

describe("equation slider V3 schema and first gold level", () => {
  it("publishes exactly the three intended ways to make 6", () => {
    const expressions = FIRST_GOLD_LEVEL.analysis.validArrangements
      .map((arrangement) => arrangement.expressionText)
      .sort();

    expect(expressions).toEqual(["1 + 5", "2 + 4", "4 + 2"]);
    expect(FIRST_GOLD_LEVEL.analysis.minimumCorrectArrangements).toBe(3);
  });

  it("requires all six movable tile identities while excluding the fixed plus", () => {
    const selectedAcrossPlan = new Set(
      FIRST_GOLD_LEVEL.analysis.canonicalPlan.flatMap((step) =>
        getMovableReels(FIRST_GOLD_LEVEL).map((reel, reelIndex) => reel.tiles[step.indexes[reelIndex]].id)
      )
    );
    const fixedPlus = FIRST_GOLD_LEVEL.slots.find((slot) => slot.kind === "fixed-token");

    expect(FIRST_GOLD_LEVEL.requiredTileIds).toHaveLength(6);
    expect(selectedAcrossPlan).toEqual(new Set(FIRST_GOLD_LEVEL.requiredTileIds));
    expect(fixedPlus).toMatchObject({ token: "+" });
    expect(FIRST_GOLD_LEVEL.requiredTileIds).not.toContain(fixedPlus?.id);
    expect(
      FIRST_GOLD_LEVEL.analysis.validArrangements.flatMap((arrangement) => arrangement.selectedTileIds)
    ).not.toContain(fixedPlus?.id);
  });

  it("starts from an invalid arrangement", () => {
    const outcome = evaluateArrangementOutcome(FIRST_GOLD_LEVEL, FIRST_GOLD_LEVEL.initialIndexes);

    expect(FIRST_GOLD_LEVEL.initialIndexes).toEqual([2, 0]);
    expect(outcome.expressionText).toBe("4 + 5");
    expect(outcome.valid).toBe(false);
  });

  it("rejects a movable reel that does not contain exactly three tiles", () => {
    const malformed = mutateDefinition((definition) => {
      const first = definition.slots[0] as Extract<ExpressionSlot, { kind: "movable-reel" }>;
      (first.reel as unknown as { tiles: unknown[] }).tiles = first.reel.tiles.slice(0, 2);
    });

    expect(validateLevelDefinition(malformed)).toContain(
      "es-1-01-left: each movable reel must contain exactly 3 tiles"
    );
  });

  it("rejects number reels whose three values are identical", () => {
    const malformed = mutateDefinition((definition) => {
      const first = definition.slots[0] as Extract<ExpressionSlot, { kind: "movable-reel" }>;
      const mutableReel = first.reel as unknown as {
        tiles: Array<{ id: string; kind: "number"; value: number }>;
      };
      mutableReel.tiles = mutableReel.tiles.map((tile) => ({ ...tile, value: 1 }));
    });

    expect(validateLevelDefinition(malformed)).toContain(
      "es-1-01-left: number reel values cannot all be identical"
    );
  });

  it("rejects operator reels whose three values are identical", () => {
    const malformed = mutateDefinition((definition) => {
      const operatorIds = ["es-1-01-op-a", "es-1-01-op-b", "es-1-01-op-c"];
      definition.slots = [
        definition.slots[0],
        {
          kind: "movable-reel",
          reel: {
            id: "es-1-01-operator",
            kind: "operator",
            tiles: operatorIds.map((id) => ({ id, kind: "operator", value: "+" }))
          }
        },
        definition.slots[2]
      ] as EquationSliderLevelDefinition["slots"];
      definition.initialIndexes = [2, 0, 0];
      definition.requiredTileIds = [...definition.requiredTileIds, ...operatorIds];
    });

    expect(validateLevelDefinition(malformed)).toContain(
      "es-1-01-operator: operator reel must contain at least two operators"
    );
  });

  it("rejects duplicate tile IDs across different reels", () => {
    const malformed = mutateDefinition((definition) => {
      const right = definition.slots[2] as Extract<ExpressionSlot, { kind: "movable-reel" }>;
      const duplicateId = (
        definition.slots[0] as Extract<ExpressionSlot, { kind: "movable-reel" }>
      ).reel.tiles[0].id;
      const mutableReel = right.reel as unknown as {
        tiles: Array<{ id: string; kind: "number"; value: number }>;
      };
      mutableReel.tiles = [
        { ...mutableReel.tiles[0], id: duplicateId },
        mutableReel.tiles[1],
        mutableReel.tiles[2]
      ];
    });

    expect(validateLevelDefinition(malformed)).toContain(
      "es-1-01-left-1: tile ID must be globally unique"
    );
  });

  it("fails closed when any published solver metric is tampered", () => {
    const malformed = structuredClone(FIRST_GOLD_LEVEL) as unknown as {
      analysis: {
        minimumMovesToFirstSuccess: number;
        minimumCorrectArrangements: number;
        difficulty: number;
        metrics: Record<string, unknown>;
      };
    };
    malformed.analysis.minimumMovesToFirstSuccess = 999;
    malformed.analysis.minimumCorrectArrangements = 999;
    malformed.analysis.difficulty = -999;
    malformed.analysis.metrics = {};

    expect(validatePublishedLevel(malformed as unknown as typeof FIRST_GOLD_LEVEL)).toEqual(
      expect.arrayContaining([
        "published minimumMovesToFirstSuccess does not match current solver",
        "published minimumCorrectArrangements does not match current solver",
        "published difficulty does not match current solver",
        "published metrics do not match current solver"
      ])
    );
    expect(() => parsePublishedChapter([malformed], "chapter-1", 1)).toThrow(
      /published minimumMovesToFirstSuccess does not match current solver/
    );
  });
});

function mutateDefinition(
  mutation: (definition: MutableLevelDefinition) => void
): EquationSliderLevelDefinition {
  const { analysis: _analysis, ...definition } = structuredClone(FIRST_GOLD_LEVEL);
  const mutable = definition as unknown as MutableLevelDefinition;
  mutation(mutable);
  return mutable as unknown as EquationSliderLevelDefinition;
}

type MutableLevelDefinition = {
  -readonly [Key in keyof EquationSliderLevelDefinition]: EquationSliderLevelDefinition[Key];
};

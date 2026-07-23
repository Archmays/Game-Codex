import { auditEquationSliderLevels } from "../games/equation-slider/level-audit";
import { EQUATION_SLIDER_V3_LEVELS } from "../games/equation-slider/levels/v3/catalog";
import { FIRST_GOLD_LEVEL } from "../games/equation-slider/levels/v3/gold-levels";
import {
  canonicalStructureSignature,
  enumerateArrangements,
  evaluateArrangementOutcome,
  getArrangementTokens,
  getLevelTargetIds,
  getMovableReels,
  getRequiredTileIds,
  publishLevel,
  solutionTopologySignature,
  solveLevel,
  validateLevelDefinition,
  validatePublishedLevel
} from "../games/equation-slider/solver";
import type {
  EquationSliderLevelDefinition,
  EquationTile,
  PublishedEquationSliderLevel
} from "../games/equation-slider/types";

describe("equation slider V3 solver", () => {
  it("enumerates only movable reels and keeps the fixed operator in the expression", () => {
    const arrangements = enumerateArrangements(FIRST_GOLD_LEVEL);
    const fixedPlus = FIRST_GOLD_LEVEL.slots.find((slot) => slot.kind === "fixed-token");

    expect(getMovableReels(FIRST_GOLD_LEVEL)).toHaveLength(2);
    expect(arrangements).toHaveLength(3 ** 2);
    expect(getArrangementTokens(FIRST_GOLD_LEVEL, { indexes: [0, 0] })).toEqual([1, "+", 5]);
    expect(fixedPlus).toMatchObject({ token: "+", ariaLabel: expect.any(String) });
    expect(getRequiredTileIds(FIRST_GOLD_LEVEL)).toHaveLength(6);
    expect(getRequiredTileIds(FIRST_GOLD_LEVEL)).not.toContain(fixedPlus?.id);
  });

  it("solves the authored unique minimum cover by tile identity and explicit target ID", () => {
    const analysis = solveLevel(FIRST_GOLD_LEVEL);
    const targetIds = getLevelTargetIds(FIRST_GOLD_LEVEL);
    const selectedAcrossPlan = new Set(
      analysis.canonicalPlan.flatMap((step) =>
        getMovableReels(FIRST_GOLD_LEVEL).map(
          (reel, reelIndex) => reel.tiles[step.indexes[reelIndex]].id
        )
      )
    );

    expect(analysis).toMatchObject({
      status: "solved",
      orphanTileIds: [],
      missingTargetIds: [],
      minimumCorrectArrangements: 3,
      minimumCoverSetCountCapped: 1
    });
    expect(targetIds).toEqual(["es-1-01-target-6"]);
    expect(
      analysis.validArrangements.every(
        (arrangement) =>
          arrangement.satisfiedTargetIds.length === 1
          && arrangement.satisfiedTargetIds[0] === targetIds[0]
      )
    ).toBe(true);
    expect(selectedAcrossPlan).toEqual(new Set(FIRST_GOLD_LEVEL.requiredTileIds));
  });

  it("continues from partial coverage using target IDs rather than target indexes", () => {
    const first = FIRST_GOLD_LEVEL.analysis.validArrangements[0];
    const continued = solveLevel(FIRST_GOLD_LEVEL, {
      coveredTileIds: first.selectedTileIds,
      completedTargetIds: first.satisfiedTargetIds
    });

    expect(continued.status).toBe("solved");
    expect(continued.minimumCorrectArrangements).toBe(2);
    expect(
      continued.canonicalPlan.some(
        (step) => step.indexes.join(".") === first.indexes.join(".")
      )
    ).toBe(false);
  });

  it("tracks every explicit target in multi-target mode", () => {
    const level = findPublishedMode("multi-target");
    if (level.mode !== "multi-target") {
      throw new Error("Expected a multi-target V3 level");
    }
    const analysis = solveLevel(level);
    const satisfiedTargetIds = new Set(
      analysis.validArrangements.flatMap((arrangement) => arrangement.satisfiedTargetIds)
    );
    const firstTarget = level.targets[0].id;
    const continued = solveLevel(level, { completedTargetIds: [firstTarget] });

    expect(analysis.status).toBe("solved");
    expect(satisfiedTargetIds).toEqual(new Set(level.targets.map((target) => target.id)));
    expect(continued.status).toBe("solved");
    expect(continued.minimumCorrectArrangements).toBeLessThanOrEqual(
      analysis.minimumCorrectArrangements!
    );
  });

  it("evaluates both sides and reports the equality target ID", () => {
    const level = findPublishedMode("equality");
    if (level.mode !== "equality") {
      throw new Error("Expected an equality V3 level");
    }
    const valid = level.analysis.validArrangements[0];
    const outcome = evaluateArrangementOutcome(level, valid.indexes);

    expect(outcome).toMatchObject({
      valid: true,
      satisfiedTargetIds: [level.targets[0].id],
      equalityDifference: 0
    });
    expect(outcome.result).toBe(outcome.rightResult);
    expect(outcome.expressionText).toContain("=");
  });

  it("fails closed for schema, reel-limit, and exact-coverage violations", () => {
    const wrongSchema = mutateFirstLevel((definition) => {
      (definition as unknown as { schemaVersion: number }).schemaVersion = 1;
    });
    const tooManyReels = mutateFirstLevel((definition) => {
      const firstMovable = definition.slots.find((slot) => slot.kind === "movable-reel");
      if (!firstMovable || firstMovable.kind !== "movable-reel") {
        throw new Error("Missing fixture reel");
      }
      const extraSlots = Array.from({ length: 4 }, (_, index) => ({
        kind: "movable-reel" as const,
        reel: {
          ...structuredClone(firstMovable.reel),
          id: `extra-reel-${index}`,
          tiles: firstMovable.reel.tiles.map((tile, tileIndex) => ({
            ...tile,
            id: `extra-reel-${index}-tile-${tileIndex}`
          }))
        }
      }));
      (definition as unknown as { slots: unknown[] }).slots = [
        ...definition.slots,
        ...extraSlots
      ];
      (definition as unknown as { initialIndexes: number[] }).initialIndexes = [
        ...definition.initialIndexes,
        0,
        0,
        0,
        0
      ];
      (definition as unknown as { requiredTileIds: string[] }).requiredTileIds = [
        ...definition.requiredTileIds,
        ...extraSlots.flatMap((slot) => slot.reel.tiles.map((tile) => tile.id))
      ];
    });
    const incompleteCoverage = mutateFirstLevel((definition) => {
      (definition as unknown as { requiredTileIds: string[] }).requiredTileIds =
        definition.requiredTileIds.slice(1);
    });

    expect(validateLevelDefinition(wrongSchema)).toContain("schemaVersion must be 3");
    expect(solveLevel(wrongSchema).status).toBe("invalid-level");
    expect(validateLevelDefinition(tooManyReels)).toContain(
      "levels must contain between 2 and 5 movable reels"
    );
    expect(validateLevelDefinition(incompleteCoverage)).toContain(
      "requiredTileIds must contain every movable tile exactly once"
    );
  });

  it("fails closed when the configured arrangement limit is exceeded", () => {
    const analysis = solveLevel(FIRST_GOLD_LEVEL, {}, {
      maxArrangements: 8,
      maxCoverageStates: 65_536,
      maxMinimumCoverSearchNodes: 250_000
    });

    expect(analysis.status).toBe("limit-exceeded");
    expect(analysis.arrangementCount).toBe(9);
    expect(analysis.errors).toEqual(["arrangement limit exceeded: 9"]);
  });

  it("reports orphan tile identities when valid expressions cannot cover them", () => {
    const orphaned = mutateFirstLevel((definition) => {
      const slot = definition.slots[0];
      if (slot.kind !== "movable-reel") {
        throw new Error("Missing fixture reel");
      }
      (slot.reel.tiles[0] as unknown as { value: number }).value = 99;
    });
    const analysis = solveLevel(orphaned);

    expect(analysis.status).toBe("unsolvable");
    expect(analysis.orphanTileIds).toContain("es-1-01-left-1");
    expect(analysis.errors.join(" ")).toContain("orphan tiles");
  });

  it("enforces unique-minimum-cover against duplicate-value tile identities", () => {
    const standard = createDuplicateIdentityFixture("standard");
    const standardAnalysis = solveLevel(standard);
    const unique = createDuplicateIdentityFixture("unique-minimum-cover");
    const uniqueAnalysis = solveLevel(unique);

    expect(standardAnalysis).toMatchObject({
      status: "solved",
      minimumCorrectArrangements: 3,
      minimumCoverSetCountCapped: 2
    });
    expect(new Set(standardAnalysis.validArrangements.map((item) => item.tileMask)).size)
      .toBe(standardAnalysis.validArrangements.length);
    expect(uniqueAnalysis).toMatchObject({
      status: "unsolvable",
      minimumCoverSetCountCapped: 2
    });
    expect(uniqueAnalysis.errors).toContain(
      "unique-minimum-cover challenge requires exactly one minimum coverage set"
    );
  });

  it("publishes current solver output, detects stale analysis, and deeply freezes it", () => {
    const definition = definitionFromPublished(FIRST_GOLD_LEVEL);
    const republished = publishLevel(definition);
    const stale = structuredClone(republished) as unknown as MutablePublishedLevel;
    stale.analysis.canonicalPlan = [...stale.analysis.canonicalPlan].reverse();

    expect(validatePublishedLevel(republished)).toEqual([]);
    expect(republished.analysis).toEqual(FIRST_GOLD_LEVEL.analysis);
    expect(validatePublishedLevel(stale as unknown as PublishedEquationSliderLevel)).toContain(
      "published canonicalPlan does not match current solver"
    );
    expect(Object.isFrozen(republished)).toBe(true);
    expect(Object.isFrozen(republished.slots)).toBe(true);
    expect(Object.isFrozen(republished.analysis)).toBe(true);
    expect(Object.isFrozen(republished.analysis.validArrangements)).toBe(true);
    const movable = republished.slots.find((slot) => slot.kind === "movable-reel");
    expect(movable?.kind).toBe("movable-reel");
    if (movable?.kind === "movable-reel") {
      expect(Object.isFrozen(movable.reel)).toBe(true);
      expect(Object.isFrozen(movable.reel.tiles[0])).toBe(true);
    }
  });

  it("keeps topology signatures and the catalog audit hash deterministic", () => {
    const solved = solveLevel(FIRST_GOLD_LEVEL);
    const republished = publishLevel(definitionFromPublished(FIRST_GOLD_LEVEL));
    const firstAudit = auditEquationSliderLevels(EQUATION_SLIDER_V3_LEVELS);
    const secondAudit = auditEquationSliderLevels(EQUATION_SLIDER_V3_LEVELS);

    expect(canonicalStructureSignature(republished))
      .toBe(canonicalStructureSignature(FIRST_GOLD_LEVEL));
    expect(solutionTopologySignature(FIRST_GOLD_LEVEL, solved))
      .toBe(solutionTopologySignature(republished, solveLevel(republished)));
    expect(firstAudit.deterministicHash).toBe(secondAudit.deterministicHash);
    expect(firstAudit.deterministicHash).toMatch(/^fnv1a32-[0-9a-f]{8}$/);
  });
});

function findPublishedMode(
  mode: PublishedEquationSliderLevel["mode"]
): PublishedEquationSliderLevel {
  const level = EQUATION_SLIDER_V3_LEVELS.find((candidate) => candidate.mode === mode);
  if (!level) {
    throw new Error(`Missing published ${mode} fixture`);
  }
  return level;
}

function mutateFirstLevel(
  mutation: (definition: EquationSliderLevelDefinition) => void
): EquationSliderLevelDefinition {
  const definition = definitionFromPublished(FIRST_GOLD_LEVEL);
  mutation(definition);
  return definition;
}

function definitionFromPublished(
  level: PublishedEquationSliderLevel
): EquationSliderLevelDefinition {
  const { analysis: _analysis, ...definition } = structuredClone(level);
  return definition as EquationSliderLevelDefinition;
}

function createDuplicateIdentityFixture(
  challenge: EquationSliderLevelDefinition["challenge"]
): EquationSliderLevelDefinition {
  return mutateFirstLevel((definition) => {
    (definition as unknown as { challenge: EquationSliderLevelDefinition["challenge"] })
      .challenge = challenge;
    const movable = definition.slots.filter(
      (slot): slot is Extract<typeof slot, { kind: "movable-reel" }> =>
        slot.kind === "movable-reel"
    );
    (movable[0].reel.tiles[1] as unknown as MutableTile).value = 1;
    (movable[1].reel.tiles[1] as unknown as MutableTile).value = 5;
  });
}

type MutableTile = {
  -readonly [Key in keyof EquationTile]: EquationTile[Key];
};

type MutablePublishedLevel = Omit<PublishedEquationSliderLevel, "analysis"> & {
  analysis: {
    -readonly [Key in keyof PublishedEquationSliderLevel["analysis"]]:
      PublishedEquationSliderLevel["analysis"][Key];
  };
};

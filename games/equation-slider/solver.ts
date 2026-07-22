import { evaluateEquality, evaluateExpression, formatExpression, isArithmeticOperator } from "./evaluator";
import type {
  Arrangement,
  ArithmeticToken,
  DifficultyMetrics,
  EquationSliderLevelDefinition,
  SolveAnalysis,
  SolveLimits,
  SolveStartState,
  ValidArrangement
} from "./types";

export const SOLVER_VERSION = "1.0.0";

export const DEFAULT_SOLVE_LIMITS: SolveLimits = {
  maxArrangements: 243,
  maxCoverageStates: 8192,
  maxMinimumCoverSearchNodes: 100_000
};

export function validateLevelDefinition(level: EquationSliderLevelDefinition): readonly string[] {
  const errors: string[] = [];
  if (level.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!level.id.trim() || !level.chapterId.trim() || !level.unitId.trim()) {
    errors.push("level, chapter, and unit IDs must be non-empty");
  }
  if (!Number.isInteger(level.levelNumber) || level.levelNumber < 1) {
    errors.push("levelNumber must be a positive integer");
  }
  if (!Number.isInteger(level.unitLevelNumber) || level.unitLevelNumber < 1 || level.unitLevelNumber > 10) {
    errors.push("unitLevelNumber must be between 1 and 10");
  }
  if (level.reels.length < 3 || level.reels.length > 5 || level.reels.length % 2 === 0) {
    errors.push("levels must contain 3 or 5 movable reels");
  }

  const reelIds = new Set<string>();
  const tileIds = new Set<string>();
  let totalTiles = 0;
  level.reels.forEach((reel, reelIndex) => {
    const expectedKind = reelIndex % 2 === 0 ? "number" : "operator";
    if (reel.kind !== expectedKind) {
      errors.push(`${reel.id}: expected ${expectedKind} reel at index ${reelIndex}`);
    }
    if (!reel.id.trim() || reelIds.has(reel.id)) {
      errors.push(`${reel.id || "<empty>"}: reel ID must be unique and non-empty`);
    }
    reelIds.add(reel.id);
    if (reel.tiles.length < 2 || reel.tiles.length > 3) {
      errors.push(`${reel.id}: each reel must contain 2 or 3 tiles`);
    }
    if (!Number.isInteger(reel.initialIndex) || reel.initialIndex < 0 || reel.initialIndex >= reel.tiles.length) {
      errors.push(`${reel.id}: initialIndex is out of range`);
    }
    totalTiles += reel.tiles.length;
    for (const tile of reel.tiles) {
      if (!tile.id.trim() || tileIds.has(tile.id)) {
        errors.push(`${tile.id || "<empty>"}: tile ID must be unique and non-empty`);
      }
      tileIds.add(tile.id);
      if (tile.kind !== reel.kind) {
        errors.push(`${tile.id}: tile kind must match its reel`);
      }
      if (reel.kind === "number") {
        if (typeof tile.value !== "number" || !Number.isSafeInteger(tile.value) || tile.value < 0) {
          errors.push(`${tile.id}: number tile must be a non-negative safe integer`);
        }
      } else if (!isArithmeticOperator(tile.value)) {
        errors.push(`${tile.id}: operator tile must use +, −, ×, or ÷`);
      }
    }
  });
  if (totalTiles > 15) {
    errors.push("a formal level may contain at most 15 movable tiles");
  }

  if (!["target", "multi-target", "equality"].includes(level.mode as string)) {
    errors.push("mode must be target, multi-target, or equality");
  }
  if (!["standard", "unique-minimum-cover"].includes(level.challenge as string)) {
    errors.push("challenge must be standard or unique-minimum-cover");
  }

  if (level.mode === "target") {
    if (!Number.isSafeInteger(level.target) || level.target < 0) {
      errors.push("target mode requires a non-negative integer target");
    }
  } else if (level.mode === "multi-target") {
    if (level.targets.length < 2 || level.targets.length > 3) {
      errors.push("multi-target mode requires 2 or 3 targets");
    }
    if (new Set(level.targets).size !== level.targets.length) {
      errors.push("multi-target values must be distinct");
    }
    if (level.targets.some((target) => !Number.isSafeInteger(target) || target < 0)) {
      errors.push("multi-target values must be non-negative safe integers");
    }
  } else if (level.mode === "equality") {
    const right = evaluateExpression(level.rightExpression);
    if (!right.ok) {
      errors.push(`right expression is invalid: ${right.reason}`);
    }
  }

  const learning = level.learning;
  if (!["guided", "supported", "independent", "transfer", "review"].includes(learning.scaffoldLevel as string)) {
    errors.push("scaffoldLevel is invalid");
  }
  if (
    !learning.learningObjective.trim()
    || !learning.primarySkill.trim()
    || learning.skillTags.length === 0
    || learning.skillTags.some((tag) => !tag.trim())
    || learning.misconceptionTags.length === 0
    || learning.misconceptionTags.some((tag) => !tag.trim())
    || !learning.reflectionText.trim()
    || !learning.recommendedAgeBand.trim()
  ) {
    errors.push("learning metadata must contain objective, skills, misconceptions, reflection, and age guidance");
  }
  if (!level.conceptHint.trim() || !level.provenance.generatorVersion.trim() || !level.provenance.familyId.trim()) {
    errors.push("concept hint and provenance fields must be non-empty");
  }
  return errors;
}

export function enumerateArrangements(level: EquationSliderLevelDefinition): readonly Arrangement[] {
  const arrangements: Arrangement[] = [];
  const current = new Array<number>(level.reels.length).fill(0);
  const visit = (reelIndex: number): void => {
    if (reelIndex === level.reels.length) {
      arrangements.push({ indexes: [...current] });
      return;
    }
    for (let index = 0; index < level.reels[reelIndex].tiles.length; index += 1) {
      current[reelIndex] = index;
      visit(reelIndex + 1);
    }
  };
  visit(0);
  return arrangements;
}

export function getArrangementTokens(
  level: EquationSliderLevelDefinition,
  arrangement: Arrangement
): readonly ArithmeticToken[] {
  return level.reels.map((reel, reelIndex) => reel.tiles[arrangement.indexes[reelIndex]]?.value ?? Number.NaN);
}

export function getRequiredTileIds(level: EquationSliderLevelDefinition): readonly string[] {
  return level.reels.flatMap((reel) => reel.tiles.map((tile) => tile.id));
}

export function solveLevel(
  level: EquationSliderLevelDefinition,
  startState: SolveStartState = {},
  limits: SolveLimits = DEFAULT_SOLVE_LIMITS
): SolveAnalysis {
  const validationErrors = validateLevelDefinition(level);
  if (validationErrors.length > 0) {
    return emptyAnalysis("invalid-level", validationErrors);
  }

  const arrangementCount = level.reels.reduce((product, reel) => product * reel.tiles.length, 1);
  if (arrangementCount > limits.maxArrangements) {
    return emptyAnalysis("limit-exceeded", [`arrangement limit exceeded: ${arrangementCount}`], arrangementCount);
  }

  const requiredTileIds = getRequiredTileIds(level);
  const tileOrdinals = new Map(requiredTileIds.map((id, index) => [id, index]));
  const validArrangements = enumerateValidArrangements(level, tileOrdinals);
  const fullTileMask = (1 << requiredTileIds.length) - 1;
  const fullTargetMask = level.mode === "multi-target" ? (1 << level.targets.length) - 1 : 0;
  const validTileUnion = validArrangements.reduce((mask, arrangement) => mask | arrangement.tileMask, 0);
  const validTargetUnion = validArrangements.reduce((mask, arrangement) => mask | arrangement.targetMask, 0);
  const orphanTileIds = requiredTileIds.filter((id) => {
    const ordinal = tileOrdinals.get(id);
    return ordinal === undefined || (validTileUnion & (1 << ordinal)) === 0;
  });
  const missingTargetIndexes = level.mode === "multi-target"
    ? level.targets.map((_, index) => index).filter((index) => (validTargetUnion & (1 << index)) === 0)
    : [];

  if (validArrangements.length === 0 || orphanTileIds.length > 0 || missingTargetIndexes.length > 0) {
    const errors: string[] = [];
    if (validArrangements.length === 0) {
      errors.push("level has no valid arrangements");
    }
    if (orphanTileIds.length > 0) {
      errors.push(`orphan tiles: ${orphanTileIds.join(", ")}`);
    }
    if (missingTargetIndexes.length > 0) {
      errors.push(`unreachable target indexes: ${missingTargetIndexes.join(", ")}`);
    }
    return {
      status: "unsolvable",
      errors,
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIndexes,
      minimumCorrectExpressions: null,
      minimumCoverSetCountCapped: 0,
      canonicalPlan: []
    };
  }

  const startTileMask = maskFromIds(startState.coveredTileIds ?? [], tileOrdinals);
  const startTargetMask = maskFromIndexes(startState.completedTargetIndexes ?? [], fullTargetMask);
  const search = searchCoverage(
    validArrangements,
    startTileMask,
    startTargetMask,
    fullTileMask,
    fullTargetMask,
    limits.maxCoverageStates
  );
  if (search.limitExceeded) {
    return {
      status: "limit-exceeded",
      errors: ["coverage-state limit exceeded"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIndexes,
      minimumCorrectExpressions: null,
      minimumCoverSetCountCapped: 0,
      canonicalPlan: []
    };
  }
  if (!search.plan) {
    return {
      status: "unsolvable",
      errors: ["valid arrangements cannot complete the remaining coverage"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIndexes,
      minimumCorrectExpressions: null,
      minimumCoverSetCountCapped: 0,
      canonicalPlan: []
    };
  }

  const minimumCorrectExpressions = search.plan.length;
  const minimumSets = countMinimumCoverSets(
    validArrangements,
    minimumCorrectExpressions,
    startTileMask,
    startTargetMask,
    fullTileMask,
    fullTargetMask,
    limits.maxMinimumCoverSearchNodes
  );
  if (minimumSets.limitExceeded) {
    return {
      status: "limit-exceeded",
      errors: ["minimum-cover search limit exceeded"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIndexes,
      minimumCorrectExpressions,
      minimumCoverSetCountCapped: 0,
      canonicalPlan: search.plan
    };
  }
  if (minimumSets.count === 0) {
    return {
      status: "unsolvable",
      errors: ["minimum-cover enumeration found no set at the BFS depth"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIndexes,
      minimumCorrectExpressions,
      minimumCoverSetCountCapped: 0,
      canonicalPlan: search.plan
    };
  }

  const difficultyMetrics = buildDifficultyMetrics(
    level,
    arrangementCount,
    validArrangements,
    search.plan,
    search.visitedStates,
    minimumSets.count
  );
  return {
    status: "solved",
    errors: [],
    arrangementCount,
    validArrangements,
    orphanTileIds,
    missingTargetIndexes,
    minimumCorrectExpressions,
    minimumCoverSetCountCapped: minimumSets.count,
    canonicalPlan: search.plan,
    difficultyMetrics
  };
}

export function canonicalStructureSignature(level: EquationSliderLevelDefinition): string {
  const reels = level.reels.map((reel) => canonicalCircularSequence(reel.tiles.map((tile) => String(tile.value))));
  const condition = level.mode === "target"
    ? `target:${level.target}`
    : level.mode === "multi-target"
      ? `targets:${[...level.targets].sort((a, b) => a - b).join(",")}`
      : `right:${formatExpression(level.rightExpression)}`;
  return `${level.mode}|${condition}|${reels.join("|")}`;
}

export function solutionTopologySignature(
  level: EquationSliderLevelDefinition,
  analysis: Pick<SolveAnalysis, "validArrangements" | "minimumCorrectExpressions">
): string {
  const effects = analysis.validArrangements
    .map((arrangement) => `${arrangement.key}:${arrangement.targetMask}`)
    .sort()
    .join(",");
  return `${level.mode}|${level.reels.map((reel) => reel.tiles.length).join(".")}|${effects}|${analysis.minimumCorrectExpressions}`;
}

function enumerateValidArrangements(
  level: EquationSliderLevelDefinition,
  tileOrdinals: ReadonlyMap<string, number>
): readonly ValidArrangement[] {
  const valid: ValidArrangement[] = [];
  for (const arrangement of enumerateArrangements(level)) {
    const selectedTiles = level.reels.map((reel, reelIndex) => reel.tiles[arrangement.indexes[reelIndex]]);
    const tokens = selectedTiles.map((tile) => tile.value);
    const tileMask = selectedTiles.reduce((mask, tile) => {
      const ordinal = tileOrdinals.get(tile.id);
      return ordinal === undefined ? mask : mask | (1 << ordinal);
    }, 0);
    let result: number | null = null;
    let rightResult: number | undefined;
    let targetMask = 0;
    let expressionText = formatExpression(tokens);

    if (level.mode === "equality") {
      const equality = evaluateEquality(tokens, level.rightExpression);
      if (!equality.ok || !equality.balanced) {
        continue;
      }
      result = equality.leftValue;
      rightResult = equality.rightValue;
      expressionText = `${expressionText} = ${formatExpression(level.rightExpression)}`;
    } else {
      const evaluation = evaluateExpression(tokens);
      if (!evaluation.ok) {
        continue;
      }
      result = evaluation.value;
      if (level.mode === "target") {
        if (result !== level.target) {
          continue;
        }
      } else {
        const targetIndex = level.targets.indexOf(result);
        if (targetIndex < 0) {
          continue;
        }
        targetMask = 1 << targetIndex;
      }
    }

    valid.push({
      indexes: [...arrangement.indexes],
      key: arrangement.indexes.join("."),
      selectedTileIds: selectedTiles.map((tile) => tile.id),
      tileMask,
      targetMask,
      expressionText,
      result,
      rightResult
    });
  }
  return valid.sort((a, b) => a.key.localeCompare(b.key));
}

function searchCoverage(
  effects: readonly ValidArrangement[],
  startTileMask: number,
  startTargetMask: number,
  fullTileMask: number,
  fullTargetMask: number,
  maxStates: number
): { readonly plan: readonly Arrangement[] | null; readonly visitedStates: number; readonly limitExceeded: boolean } {
  const queue: Array<{ tileMask: number; targetMask: number; plan: readonly Arrangement[] }> = [
    { tileMask: startTileMask, targetMask: startTargetMask, plan: [] }
  ];
  const visited = new Set([stateKey(startTileMask, startTargetMask)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor];
    if (state.tileMask === fullTileMask && state.targetMask === fullTargetMask) {
      return { plan: state.plan, visitedStates: visited.size, limitExceeded: false };
    }
    for (const effect of effects) {
      const nextTileMask = state.tileMask | effect.tileMask;
      const nextTargetMask = state.targetMask | effect.targetMask;
      if (nextTileMask === state.tileMask && nextTargetMask === state.targetMask) {
        continue;
      }
      const key = stateKey(nextTileMask, nextTargetMask);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      if (visited.size > maxStates) {
        return { plan: null, visitedStates: visited.size, limitExceeded: true };
      }
      queue.push({
        tileMask: nextTileMask,
        targetMask: nextTargetMask,
        plan: [...state.plan, { indexes: [...effect.indexes] }]
      });
    }
  }
  return { plan: null, visitedStates: visited.size, limitExceeded: false };
}

function countMinimumCoverSets(
  effects: readonly ValidArrangement[],
  setSize: number,
  startTileMask: number,
  startTargetMask: number,
  fullTileMask: number,
  fullTargetMask: number,
  maxNodes: number
): { readonly count: 0 | 1 | 2; readonly limitExceeded: boolean } {
  let count: 0 | 1 | 2 = 0;
  let nodes = 0;
  const visit = (startIndex: number, remaining: number, tileMask: number, targetMask: number): void => {
    if (count >= 2 || nodes > maxNodes) {
      return;
    }
    nodes += 1;
    if (remaining === 0) {
      if (tileMask === fullTileMask && targetMask === fullTargetMask) {
        count = count === 0 ? 1 : 2;
      }
      return;
    }
    if (effects.length - startIndex < remaining) {
      return;
    }
    for (let index = startIndex; index <= effects.length - remaining; index += 1) {
      const effect = effects[index];
      visit(index + 1, remaining - 1, tileMask | effect.tileMask, targetMask | effect.targetMask);
      if (count >= 2 || nodes > maxNodes) {
        return;
      }
    }
  };
  visit(0, setSize, startTileMask, startTargetMask);
  return { count, limitExceeded: nodes > maxNodes };
}

function buildDifficultyMetrics(
  level: EquationSliderLevelDefinition,
  arrangementCount: number,
  validArrangements: readonly ValidArrangement[],
  plan: readonly Arrangement[],
  visitedStates: number,
  minimumSetCount: 1 | 2
): DifficultyMetrics {
  const initialIndexes = level.reels.map((reel) => reel.initialIndex);
  const initialToFirstValidMoves = Math.min(
    ...validArrangements.map((arrangement) => cyclicMoveDistance(level, initialIndexes, arrangement.indexes))
  );
  const byKey = new Map(validArrangements.map((arrangement) => [arrangement.key, arrangement]));
  let covered = 0;
  let novelTotal = 0;
  for (const step of plan) {
    const effect = byKey.get(step.indexes.join("."));
    if (!effect) {
      continue;
    }
    const novel = effect.tileMask & ~covered;
    novelTotal += countBits(novel);
    covered |= effect.tileMask;
  }
  const operators = new Set(
    level.reels
      .filter((reel) => reel.kind === "operator")
      .flatMap((reel) => reel.tiles.map((tile) => String(tile.value)))
  );
  const operatorComplexity = [...operators].reduce((score, operator) => {
    return score + (operator === "÷" ? 4 : operator === "×" ? 3 : 1);
  }, 0)
    + (level.reels.length === 5 ? 2 : 0)
    + (level.mode === "multi-target" || level.mode === "equality" ? 2 : 0)
    + (level.challenge === "unique-minimum-cover" ? Math.min(6, plan.length * 2) : 0);
  const numericMagnitude = Math.max(
    0,
    ...level.reels.flatMap((reel) => reel.tiles.map((tile) => typeof tile.value === "number" ? Math.abs(tile.value) : 0)),
    ...(level.mode === "equality"
      ? level.rightExpression.map((token) => typeof token === "number" ? Math.abs(token) : 0)
      : [])
  );
  const recommendedHintDepth = ({
    guided: 2,
    supported: 3,
    independent: 4,
    transfer: 5,
    review: 4
  } as const)[level.learning.scaffoldLevel];
  const invalidArrangementRatio = (arrangementCount - validArrangements.length) / arrangementCount;
  const solutionBranchingScore = validArrangements.length / Math.max(1, plan.length);
  const compositeDifficulty = roundMetric(
    arrangementCount * 0.04
      + invalidArrangementRatio * 8
      + plan.length * 3.5
      + initialToFirstValidMoves
      + operatorComplexity
      + Math.log2(numericMagnitude + 1) * 1.4
      + recommendedHintDepth * 0.5
      + Math.min(5, solutionBranchingScore * 0.4)
  );
  return {
    arrangementCount,
    validArrangementCount: validArrangements.length,
    invalidArrangementRatio: roundMetric(invalidArrangementRatio),
    minimumCorrectExpressions: plan.length,
    minimumCoverSetCountCapped: minimumSetCount,
    initialToFirstValidMoves,
    reachableCoverageStates: visitedStates,
    meanNovelTilesOnCanonicalPlan: roundMetric(novelTotal / Math.max(1, plan.length)),
    solutionBranchingScore: roundMetric(solutionBranchingScore),
    operatorComplexity,
    numericMagnitude,
    recommendedHintDepth,
    compositeDifficulty
  };
}

function cyclicMoveDistance(
  level: EquationSliderLevelDefinition,
  fromIndexes: readonly number[],
  toIndexes: readonly number[]
): number {
  return level.reels.reduce((total, reel, index) => {
    const difference = Math.abs((fromIndexes[index] ?? 0) - (toIndexes[index] ?? 0));
    return total + Math.min(difference, reel.tiles.length - difference);
  }, 0);
}

function canonicalCircularSequence(values: readonly string[]): string {
  const candidates: string[] = [];
  for (const source of [values, [...values].reverse()]) {
    for (let offset = 0; offset < source.length; offset += 1) {
      candidates.push([...source.slice(offset), ...source.slice(0, offset)].join(","));
    }
  }
  return candidates.sort()[0] ?? "";
}

function maskFromIds(ids: readonly string[], ordinals: ReadonlyMap<string, number>): number {
  return ids.reduce((mask, id) => {
    const ordinal = ordinals.get(id);
    return ordinal === undefined ? mask : mask | (1 << ordinal);
  }, 0);
}

function maskFromIndexes(indexes: readonly number[], fullMask: number): number {
  return indexes.reduce((mask, index) => {
    if (!Number.isInteger(index) || index < 0 || (fullMask & (1 << index)) === 0) {
      return mask;
    }
    return mask | (1 << index);
  }, 0);
}

function stateKey(tileMask: number, targetMask: number): string {
  return `${tileMask}:${targetMask}`;
}

function countBits(value: number): number {
  let remaining = value;
  let count = 0;
  while (remaining > 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function emptyAnalysis(
  status: "invalid-level" | "limit-exceeded",
  errors: readonly string[],
  arrangementCount = 0
): SolveAnalysis {
  return {
    status,
    errors,
    arrangementCount,
    validArrangements: [],
    orphanTileIds: [],
    missingTargetIndexes: [],
    minimumCorrectExpressions: null,
    minimumCoverSetCountCapped: 0,
    canonicalPlan: []
  };
}

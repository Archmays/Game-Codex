import { evaluateEquality, evaluateExpression, formatExpression, isArithmeticOperator } from "./evaluator";
import type {
  Arrangement,
  ArithmeticToken,
  ArrangementOutcome,
  DifficultyMetrics,
  EquationSliderLevelDefinition,
  ExpressionSlot,
  HintContinuation,
  MoveDirection,
  PublishedEquationSliderLevel,
  QualitySignatures,
  ReelDefinition,
  SolveAnalysis,
  SolveLimits,
  SolveStartState,
  ValidArrangement
} from "./types";

export const SOLVER_VERSION = "3.0.0";

export const DEFAULT_SOLVE_LIMITS: SolveLimits = {
  maxArrangements: 243,
  maxCoverageStates: 65_536,
  maxMinimumCoverSearchNodes: 250_000
};

export function getMovableReels(level: EquationSliderLevelDefinition): readonly ReelDefinition[] {
  return level.slots
    .filter((slot): slot is Extract<ExpressionSlot, { kind: "movable-reel" }> => slot.kind === "movable-reel")
    .map((slot) => slot.reel);
}

export function getRequiredTileIds(level: EquationSliderLevelDefinition): readonly string[] {
  return [...level.requiredTileIds];
}

export function getLevelTargetIds(level: EquationSliderLevelDefinition): readonly string[] {
  return level.targets.map((target) => target.id);
}

export const getRequiredTargetIds = getLevelTargetIds;

export function validateLevelDefinition(level: EquationSliderLevelDefinition): readonly string[] {
  const errors: string[] = [];
  if (level.schemaVersion !== 3) errors.push("schemaVersion must be 3");
  if (!level.id?.trim() || !level.chapterId?.trim() || !level.stationId?.trim()) {
    errors.push("level, chapter, and station IDs must be non-empty");
  }
  if (!Number.isInteger(level.order) || level.order < 1 || level.order > 50) {
    errors.push("order must be between 1 and 50");
  }
  if (!Number.isInteger(level.stationOrder) || level.stationOrder < 1 || level.stationOrder > 10) {
    errors.push("stationOrder must be between 1 and 10");
  }
  if (!Array.isArray(level.slots) || level.slots.length < 3 || level.slots.length > 7) {
    errors.push("slots must contain between 3 and 7 expression tokens");
  }

  const reels = getMovableReels(level);
  if (reels.length < 2 || reels.length > 5) {
    errors.push("levels must contain between 2 and 5 movable reels");
  }
  if (level.initialIndexes.length !== reels.length) {
    errors.push("initialIndexes length must equal movable reel count");
  }

  const slotIds = new Set<string>();
  const reelIds = new Set<string>();
  const tileIds = new Set<string>();
  for (const slot of level.slots) {
    if (slot.kind === "fixed-token") {
      if (!slot.id?.trim() || slotIds.has(slot.id)) errors.push(`${slot.id || "<empty>"}: fixed slot ID must be unique`);
      slotIds.add(slot.id);
      if (!slot.ariaLabel?.trim()) errors.push(`${slot.id || "<empty>"}: fixed token needs an ariaLabel`);
      if (!isValidToken(slot.token)) errors.push(`${slot.id || "<empty>"}: fixed token is invalid`);
      continue;
    }
    const reel = slot.reel;
    if (!reel.id?.trim() || reelIds.has(reel.id)) errors.push(`${reel.id || "<empty>"}: reel ID must be unique`);
    reelIds.add(reel.id);
    if (!Array.isArray(reel.tiles) || reel.tiles.length !== 3) {
      errors.push(`${reel.id}: each movable reel must contain exactly 3 tiles`);
      continue;
    }
    const values = reel.tiles.map((tile) => tile.value);
    if (reel.kind === "number" && new Set(values.map(String)).size === 1) {
      errors.push(`${reel.id}: number reel values cannot all be identical`);
    }
    if (reel.kind === "operator" && new Set(values.map(String)).size < 2) {
      errors.push(`${reel.id}: operator reel must contain at least two operators`);
    }
    for (const tile of reel.tiles) {
      if (!tile.id?.trim() || tileIds.has(tile.id)) errors.push(`${tile.id || "<empty>"}: tile ID must be globally unique`);
      tileIds.add(tile.id);
      if (tile.kind !== reel.kind) errors.push(`${tile.id}: tile kind must match its reel`);
      if (tile.kind === "number") {
        if (typeof tile.value !== "number" || !Number.isSafeInteger(tile.value) || tile.value < 0) {
          errors.push(`${tile.id}: number tile must be a non-negative safe integer`);
        }
      } else if (!isArithmeticOperator(tile.value)) {
        errors.push(`${tile.id}: operator tile must use +, −, ×, or ÷`);
      }
    }
  }

  level.initialIndexes.forEach((index, reelIndex) => {
    if (!Number.isInteger(index) || index < 0 || index > 2) {
      errors.push(`${reels[reelIndex]?.id ?? `reel-${reelIndex}`}: initial index must be 0, 1, or 2`);
    }
  });

  const required = new Set(level.requiredTileIds);
  if (required.size !== level.requiredTileIds.length) errors.push("requiredTileIds must be unique");
  if (required.size !== tileIds.size || [...tileIds].some((id) => !required.has(id))) {
    errors.push("requiredTileIds must contain every movable tile exactly once");
  }
  if (tileIds.size > 15) errors.push("a formal level may contain at most 15 movable tiles");

  if (!['target', 'multi-target', 'equality'].includes(level.mode)) errors.push("mode is invalid");
  if (!['standard', 'unique-minimum-cover'].includes(level.challenge)) errors.push("challenge is invalid");
  const targetIds = level.targets.map((target) => target.id);
  if (targetIds.some((id) => !id?.trim()) || new Set(targetIds).size !== targetIds.length) {
    errors.push("target IDs must be non-empty and unique");
  }
  if (level.mode === "target") {
    if (level.targets.length !== 1 || level.targets[0].kind !== "value" || !isNonNegativeSafeInteger(level.targets[0].value)) {
      errors.push("target mode requires one non-negative value target");
    }
  } else if (level.mode === "multi-target") {
    if (level.targets.length < 2 || level.targets.length > 3) errors.push("multi-target requires 2 or 3 values");
    if (level.targets.some((target) => target.kind !== "value")) errors.push("multi-target requires value targets");
    if (new Set(level.targets.map((target) => target.value)).size !== level.targets.length) {
      errors.push("multi-target values must be distinct");
    }
    if (level.targets.some((target) => !isNonNegativeSafeInteger(target.value))) {
      errors.push("multi-target values must be non-negative safe integers");
    }
  } else if (level.mode === "equality") {
    const target = level.targets[0];
    if (level.targets.length !== 1 || target.kind !== "equality") {
      errors.push("equality mode requires one equality target");
    } else {
      const right = evaluateExpression(target.rightExpression);
      if (!right.ok) errors.push(`right expression is invalid: ${right.reason}`);
    }
  }

  const learning = level.learning;
  if (!['guided', 'supported', 'independent', 'transfer', 'review'].includes(learning.scaffold)) {
    errors.push("learning scaffold is invalid");
  }
  if (
    !learning.objective?.trim()
    || !learning.primarySkill?.trim()
    || learning.skillTags.length === 0
    || learning.misconceptionTags.length === 0
    || !learning.reflection?.trim()
    || !learning.recommendedAgeBand?.trim()
  ) {
    errors.push("learning metadata is incomplete");
  }
  if (level.hints.length !== 3 || level.hints.map((hint) => hint.kind).join(",") !== "concept,position,direction") {
    errors.push("hints must contain concept, position, and direction in order");
  }
  if (level.hints.some((hint) => !hint.text?.trim())) errors.push("hint text must be non-empty");
  if (!level.provenance.generatorVersion?.trim()) errors.push("generatorVersion must be non-empty");
  if (level.provenance.kind === "generated-from-gold" && (!level.provenance.templateId || !level.provenance.seed)) {
    errors.push("generated levels require templateId and seed");
  }

  if (errors.length === 0) {
    const initial = evaluateArrangementOutcome(level, level.initialIndexes);
    if (initial.valid) errors.push("initial arrangement must not already satisfy the level");
  }
  return errors;
}

export function enumerateArrangements(level: EquationSliderLevelDefinition): readonly Arrangement[] {
  const reels = getMovableReels(level);
  const arrangements: Arrangement[] = [];
  const current = new Array<number>(reels.length).fill(0);
  const visit = (reelIndex: number): void => {
    if (reelIndex === reels.length) {
      arrangements.push({ indexes: [...current] });
      return;
    }
    for (let index = 0; index < 3; index += 1) {
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
  let movableIndex = 0;
  return level.slots.map((slot) => {
    if (slot.kind === "fixed-token") return slot.token;
    const index = arrangement.indexes[movableIndex] ?? Number.NaN;
    movableIndex += 1;
    return slot.reel.tiles[index]?.value ?? Number.NaN;
  });
}

export function evaluateArrangementOutcome(
  level: EquationSliderLevelDefinition,
  indexes: readonly number[]
): ArrangementOutcome {
  const reels = getMovableReels(level);
  const selectedTiles = reels.map((reel, index) => reel.tiles[indexes[index]]).filter(Boolean);
  const selectedTileIds = selectedTiles.map((tile) => tile.id);
  const tokens = getArrangementTokens(level, { indexes });
  const leftText = formatExpression(tokens);
  if (selectedTiles.length !== reels.length || tokens.some((token) => typeof token === "number" && Number.isNaN(token))) {
    return {
      valid: false,
      selectedTileIds,
      satisfiedTargetIds: [],
      expressionText: leftText,
      failureReason: "invalid-token-sequence"
    };
  }

  if (level.mode === "equality") {
    const rightExpression = level.targets[0].rightExpression;
    const equality = evaluateEquality(tokens, rightExpression);
    const expressionText = `${leftText} = ${formatExpression(rightExpression)}`;
    if (!equality.ok) {
      return {
        valid: false,
        selectedTileIds,
        satisfiedTargetIds: [],
        expressionText,
        failureReason: equality.failure.reason
      };
    }
    return {
      valid: equality.balanced,
      selectedTileIds,
      satisfiedTargetIds: equality.balanced ? getLevelTargetIds(level) : [],
      expressionText,
      result: equality.leftValue,
      rightResult: equality.rightValue,
      equalityDifference: equality.leftValue - equality.rightValue
    };
  }

  const evaluation = evaluateExpression(tokens);
  if (!evaluation.ok) {
    return {
      valid: false,
      selectedTileIds,
      satisfiedTargetIds: [],
      expressionText: leftText,
      failureReason: evaluation.reason
    };
  }
  if (level.mode === "target") {
    const valid = evaluation.value === level.targets[0].value;
    return {
      valid,
      selectedTileIds,
      satisfiedTargetIds: valid ? getLevelTargetIds(level) : [],
      expressionText: leftText,
      result: evaluation.value
    };
  }
  const targetIndex = level.targets.findIndex((target) => target.value === evaluation.value);
  return {
    valid: targetIndex >= 0,
    selectedTileIds,
    satisfiedTargetIds: targetIndex >= 0 ? [getLevelTargetIds(level)[targetIndex]] : [],
    expressionText: leftText,
    result: evaluation.value
  };
}

export function solveLevel(
  level: EquationSliderLevelDefinition,
  startState: SolveStartState = {},
  limits: SolveLimits = DEFAULT_SOLVE_LIMITS
): SolveAnalysis {
  const validationErrors = validateLevelDefinition(level);
  if (validationErrors.length > 0) return emptyAnalysis("invalid-level", validationErrors);

  const reels = getMovableReels(level);
  const arrangementCount = 3 ** reels.length;
  if (arrangementCount > limits.maxArrangements) {
    return emptyAnalysis("limit-exceeded", [`arrangement limit exceeded: ${arrangementCount}`], arrangementCount);
  }

  const requiredTileIds = getRequiredTileIds(level);
  const targetIds = getLevelTargetIds(level);
  const tileOrdinals = new Map(requiredTileIds.map((id, index) => [id, index]));
  const targetOrdinals = new Map(targetIds.map((id, index) => [id, index]));
  const validArrangements = enumerateValidArrangements(level, tileOrdinals, targetOrdinals);
  const fullTileMask = (1 << requiredTileIds.length) - 1;
  const fullTargetMask = (1 << targetIds.length) - 1;
  const validTileUnion = validArrangements.reduce((mask, arrangement) => mask | arrangement.tileMask, 0);
  const validTargetUnion = validArrangements.reduce((mask, arrangement) => mask | arrangement.targetMask, 0);
  const orphanTileIds = requiredTileIds.filter((id) => {
    const ordinal = tileOrdinals.get(id);
    return ordinal === undefined || (validTileUnion & (1 << ordinal)) === 0;
  });
  const missingTargetIds = targetIds.filter((id) => {
    const ordinal = targetOrdinals.get(id);
    return ordinal === undefined || (validTargetUnion & (1 << ordinal)) === 0;
  });

  if (validArrangements.length === 0 || orphanTileIds.length > 0 || missingTargetIds.length > 0) {
    const errors = [
      ...(validArrangements.length === 0 ? ["level has no valid arrangements"] : []),
      ...(orphanTileIds.length ? [`orphan tiles: ${orphanTileIds.join(", ")}`] : []),
      ...(missingTargetIds.length ? [`unreachable targets: ${missingTargetIds.join(", ")}`] : [])
    ];
    return {
      ...emptyAnalysis("unsolvable", errors, arrangementCount),
      validArrangements,
      orphanTileIds,
      missingTargetIds
    };
  }

  const startTileMask = maskFromIds(startState.coveredTileIds ?? [], tileOrdinals);
  const startTargetMask = maskFromIds(startState.completedTargetIds ?? [], targetOrdinals);
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
      ...emptyAnalysis("limit-exceeded", ["coverage-state limit exceeded"], arrangementCount),
      validArrangements,
      orphanTileIds,
      missingTargetIds
    };
  }
  if (!search.plan) {
    return {
      ...emptyAnalysis("unsolvable", ["valid arrangements cannot complete remaining coverage"], arrangementCount),
      validArrangements,
      orphanTileIds,
      missingTargetIds
    };
  }

  const minimumCorrectArrangements = search.plan.length;
  const minimumSets = countMinimumCoverSets(
    validArrangements,
    minimumCorrectArrangements,
    startTileMask,
    startTargetMask,
    fullTileMask,
    fullTargetMask,
    limits.maxMinimumCoverSearchNodes
  );
  if (minimumSets.limitExceeded || minimumSets.count === 0) {
    return {
      status: minimumSets.limitExceeded ? "limit-exceeded" : "unsolvable",
      errors: [minimumSets.limitExceeded ? "minimum-cover search limit exceeded" : "minimum-cover enumeration found no set"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIds,
      minimumCorrectArrangements,
      minimumCoverSetCountCapped: minimumSets.count,
      canonicalPlan: search.plan,
      minimumMovesToFirstSuccess: null
    };
  }
  if (level.challenge === "unique-minimum-cover" && minimumSets.count !== 1) {
    return {
      status: "unsolvable",
      errors: ["unique-minimum-cover challenge requires exactly one minimum coverage set"],
      arrangementCount,
      validArrangements,
      orphanTileIds,
      missingTargetIds,
      minimumCorrectArrangements,
      minimumCoverSetCountCapped: minimumSets.count,
      canonicalPlan: search.plan,
      minimumMovesToFirstSuccess: null
    };
  }

  const minimumMovesToFirstSuccess = Math.min(
    ...validArrangements.map((arrangement) => cyclicMoveDistance(level.initialIndexes, arrangement.indexes))
  );
  const metrics = buildDifficultyMetrics(
    level,
    arrangementCount,
    validArrangements,
    search.plan,
    search.visitedStates,
    minimumSets.count,
    minimumMovesToFirstSuccess
  );
  const signatures = buildQualitySignatures(level, validArrangements, search.plan);
  return {
    status: "solved",
    errors: [],
    arrangementCount,
    validArrangements,
    orphanTileIds,
    missingTargetIds,
    minimumCorrectArrangements,
    minimumCoverSetCountCapped: minimumSets.count,
    canonicalPlan: search.plan,
    minimumMovesToFirstSuccess,
    metrics,
    signatures
  };
}

export function publishLevel(level: EquationSliderLevelDefinition): PublishedEquationSliderLevel {
  const analysis = solveLevel(level);
  if (analysis.status !== "solved" || !analysis.metrics || !analysis.signatures || analysis.minimumMovesToFirstSuccess === null || analysis.minimumCorrectArrangements === null) {
    throw new Error(`${level.id}: cannot publish: ${analysis.errors.join("; ")}`);
  }
  return deepFreeze({
    ...level,
    analysis: {
      solverVersion: SOLVER_VERSION,
      validArrangements: analysis.validArrangements,
      canonicalPlan: analysis.canonicalPlan,
      minimumMovesToFirstSuccess: analysis.minimumMovesToFirstSuccess,
      minimumCorrectArrangements: analysis.minimumCorrectArrangements,
      difficulty: analysis.metrics.difficulty,
      metrics: analysis.metrics,
      signatures: analysis.signatures
    }
  });
}

export function validatePublishedLevel(level: PublishedEquationSliderLevel): readonly string[] {
  const errors = [...validateLevelDefinition(level)];
  const solved = solveLevel(level);
  if (solved.status !== "solved" || !solved.metrics || !solved.signatures) {
    return [...errors, ...solved.errors];
  }
  if (level.analysis.solverVersion !== SOLVER_VERSION) errors.push("published solverVersion is stale");
  if (JSON.stringify(level.analysis.canonicalPlan) !== JSON.stringify(solved.canonicalPlan)) {
    errors.push("published canonicalPlan does not match current solver");
  }
  if (JSON.stringify(level.analysis.validArrangements) !== JSON.stringify(solved.validArrangements)) {
    errors.push("published validArrangements do not match current solver");
  }
  if (level.analysis.minimumMovesToFirstSuccess !== solved.minimumMovesToFirstSuccess) {
    errors.push("published minimumMovesToFirstSuccess does not match current solver");
  }
  if (level.analysis.minimumCorrectArrangements !== solved.minimumCorrectArrangements) {
    errors.push("published minimumCorrectArrangements does not match current solver");
  }
  if (level.analysis.difficulty !== solved.metrics.difficulty) {
    errors.push("published difficulty does not match current solver");
  }
  if (JSON.stringify(level.analysis.metrics) !== JSON.stringify(solved.metrics)) {
    errors.push("published metrics do not match current solver");
  }
  if (JSON.stringify(level.analysis.signatures) !== JSON.stringify(solved.signatures)) {
    errors.push("published signatures do not match current solver");
  }
  return errors;
}

export function findHintContinuation(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[],
  coveredTileIds: ReadonlySet<string>,
  completedTargetIds: ReadonlySet<string>
): HintContinuation | undefined {
  const candidates = level.analysis.validArrangements
    .map((arrangement) => ({
      arrangement,
      distance: cyclicMoveDistance(indexes, arrangement.indexes),
      novel: arrangement.selectedTileIds.filter((id) => !coveredTileIds.has(id)).length
        + arrangement.satisfiedTargetIds.filter((id) => !completedTargetIds.has(id)).length
    }))
    .filter((candidate) => candidate.novel > 0)
    .sort((a, b) => a.distance - b.distance || b.novel - a.novel || a.arrangement.key.localeCompare(b.arrangement.key));
  const next = candidates[0];
  if (!next) return undefined;
  const reelIndex = next.arrangement.indexes.findIndex((target, index) => target !== indexes[index]);
  if (reelIndex < 0) {
    return {
      targetIndexes: next.arrangement.indexes,
      remainingMoves: 0,
      expressionText: next.arrangement.expressionText
    };
  }
  const direction = shortestDirection(indexes[reelIndex], next.arrangement.indexes[reelIndex]);
  return {
    targetIndexes: next.arrangement.indexes,
    reelId: getMovableReels(level)[reelIndex].id,
    reelIndex,
    direction,
    remainingMoves: next.distance,
    expressionText: next.arrangement.expressionText
  };
}

export function canonicalStructureSignature(level: EquationSliderLevelDefinition): string {
  const solved = solveLevel(level);
  return solved.signatures?.valueStructure ?? `invalid:${level.id}`;
}

export function solutionTopologySignature(
  level: EquationSliderLevelDefinition,
  analysis: Pick<SolveAnalysis, "validArrangements" | "minimumCorrectArrangements">
): string {
  const effects = analysis.validArrangements
    .map((arrangement) => `${arrangement.expressionText}:${arrangement.satisfiedTargetIds.map((id) => targetSignature(level, id)).join("+")}`)
    .sort()
    .join(",");
  return `${slotStructure(level)}|${effects}|${analysis.minimumCorrectArrangements ?? "x"}`;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function enumerateValidArrangements(
  level: EquationSliderLevelDefinition,
  tileOrdinals: ReadonlyMap<string, number>,
  targetOrdinals: ReadonlyMap<string, number>
): readonly ValidArrangement[] {
  const valid: ValidArrangement[] = [];
  for (const arrangement of enumerateArrangements(level)) {
    const outcome = evaluateArrangementOutcome(level, arrangement.indexes);
    if (!outcome.valid || outcome.result === undefined) continue;
    const tileMask = outcome.selectedTileIds.reduce((mask, id) => {
      const ordinal = tileOrdinals.get(id);
      return ordinal === undefined ? mask : mask | (1 << ordinal);
    }, 0);
    const targetMask = outcome.satisfiedTargetIds.reduce((mask, id) => {
      const ordinal = targetOrdinals.get(id);
      return ordinal === undefined ? mask : mask | (1 << ordinal);
    }, 0);
    valid.push({
      indexes: [...arrangement.indexes],
      key: arrangement.indexes.join("."),
      selectedTileIds: outcome.selectedTileIds,
      tileMask,
      targetMask,
      satisfiedTargetIds: outcome.satisfiedTargetIds,
      expressionText: outcome.expressionText,
      result: outcome.result,
      ...(outcome.rightResult === undefined ? {} : { rightResult: outcome.rightResult })
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
      if (nextTileMask === state.tileMask && nextTargetMask === state.targetMask) continue;
      const key = stateKey(nextTileMask, nextTargetMask);
      if (visited.has(key)) continue;
      visited.add(key);
      if (visited.size > maxStates) return { plan: null, visitedStates: visited.size, limitExceeded: true };
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
    if (count >= 2 || nodes > maxNodes) return;
    nodes += 1;
    if (remaining === 0) {
      if (tileMask === fullTileMask && targetMask === fullTargetMask) count = count === 0 ? 1 : 2;
      return;
    }
    if (effects.length - startIndex < remaining) return;
    for (let index = startIndex; index <= effects.length - remaining; index += 1) {
      const effect = effects[index];
      visit(index + 1, remaining - 1, tileMask | effect.tileMask, targetMask | effect.targetMask);
      if (count >= 2 || nodes > maxNodes) return;
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
  minimumSetCount: 1 | 2,
  minimumMovesToFirstSuccess: number
): DifficultyMetrics {
  const reels = getMovableReels(level);
  const operators = new Set<string>();
  for (const slot of level.slots) {
    if (slot.kind === "fixed-token" && isArithmeticOperator(slot.token)) operators.add(slot.token);
    if (slot.kind === "movable-reel" && slot.reel.kind === "operator") {
      slot.reel.tiles.forEach((tile) => operators.add(String(tile.value)));
    }
  }
  const operatorComplexity = [...operators].reduce((score, operator) =>
    score + (operator === "÷" ? 4 : operator === "×" ? 3 : 1), 0)
    + Math.max(0, reels.length - 2) * 2
    + (level.mode === "multi-target" || level.mode === "equality" ? 2 : 0);
  const numericMagnitude = Math.max(
    0,
    ...level.slots.flatMap((slot) => slot.kind === "fixed-token"
      ? typeof slot.token === "number" ? [Math.abs(slot.token)] : []
      : slot.reel.tiles.flatMap((tile) => typeof tile.value === "number" ? [Math.abs(tile.value)] : [])),
    ...(level.mode === "equality" ? level.targets[0].rightExpression.flatMap((token) => typeof token === "number" ? [Math.abs(token)] : []) : [])
  );
  const invalidArrangementRatio = (arrangementCount - validArrangements.length) / arrangementCount;
  const difficulty = roundMetric(
    arrangementCount * 0.035
      + invalidArrangementRatio * 8
      + plan.length * 3
      + minimumMovesToFirstSuccess
      + operatorComplexity
      + Math.log2(numericMagnitude + 1) * 1.25
  );
  return {
    arrangementCount,
    validArrangementCount: validArrangements.length,
    invalidArrangementRatio: roundMetric(invalidArrangementRatio),
    minimumCorrectArrangements: plan.length,
    minimumCoverSetCountCapped: minimumSetCount,
    minimumMovesToFirstSuccess,
    reachableCoverageStates: visitedStates,
    operatorComplexity,
    numericMagnitude,
    difficulty
  };
}

function buildQualitySignatures(
  level: EquationSliderLevelDefinition,
  validArrangements: readonly ValidArrangement[],
  plan: readonly Arrangement[]
): QualitySignatures {
  const reels = getMovableReels(level);
  const goal = level.mode === "target"
    ? `target:${level.targets[0].value}`
    : level.mode === "multi-target"
      ? `targets:${level.targets.map((target) => target.value).sort((a, b) => a - b).join(",")}`
      : `right:${formatExpression(level.targets[0].rightExpression)}`;
  const normalizedReels = reels.map((reel) => canonicalCircularSequence(reel.tiles.map((tile) => String(tile.value))));
  const numberValues = reels
    .filter((reel) => reel.kind === "number")
    .flatMap((reel) => reel.tiles.map((tile) => Number(tile.value)))
    .sort((a, b) => a - b);
  const validSignature = validArrangements
    .map((arrangement) => `${arrangement.expressionText}->${arrangement.satisfiedTargetIds.map((id) => targetSignature(level, id)).join("+")}`)
    .sort()
    .join(";");
  const planSignature = plan.map((arrangement) => {
    const match = validArrangements.find((candidate) => candidate.key === arrangement.indexes.join("."));
    return match ? `${match.expressionText}->${match.satisfiedTargetIds.map((id) => targetSignature(level, id)).join("+")}` : arrangement.indexes.join(".");
  }).join(";");
  const first = [...validArrangements]
    .sort((a, b) => cyclicMoveDistance(level.initialIndexes, a.indexes) - cyclicMoveDistance(level.initialIndexes, b.indexes) || a.key.localeCompare(b.key))[0];
  return {
    slotStructure: slotStructure(level),
    valueStructure: `${goal}|${level.slots.map(slotValueSignature).join("|")}`,
    rotationNormalized: `${goal}|${normalizedReels.join("|")}`,
    operatorPattern: level.slots.map((slot) => slot.kind === "fixed-token"
      ? isArithmeticOperator(slot.token) ? `fixed:${slot.token}` : "fixed:number"
      : slot.reel.kind === "operator"
        ? `movable:${canonicalCircularSequence(slot.reel.tiles.map((tile) => String(tile.value)))}`
        : "number").join("|"),
    validArrangements: validSignature,
    canonicalCoverage: planSignature,
    firstSuccessAction: first ? first.indexes.map((target, index) => shortestActionCode(level.initialIndexes[index], target)).join(".") : "none",
    numberMultiset: numberValues.join(","),
    learningBand: `${level.learning.primarySkill}|${Math.min(...numberValues)}-${Math.max(...numberValues)}`
  };
}

function slotStructure(level: EquationSliderLevelDefinition): string {
  return level.slots.map((slot) => slot.kind === "fixed-token"
    ? `F:${typeof slot.token === "number" ? "N" : slot.token}`
    : `R:${slot.reel.kind[0].toUpperCase()}`).join("-");
}

function slotValueSignature(slot: ExpressionSlot): string {
  if (slot.kind === "fixed-token") return `fixed:${slot.token}`;
  return `${slot.reel.kind}:${slot.reel.tiles.map((tile) => tile.value).join(",")}`;
}

function canonicalCircularSequence(values: readonly string[]): string {
  const rotations = values.map((_, index) => [...values.slice(index), ...values.slice(0, index)].join(","));
  return rotations.sort()[0] ?? "";
}

function cyclicMoveDistance(from: readonly number[], to: readonly number[]): number {
  return from.reduce((total, current, index) => {
    const target = to[index] ?? current;
    const direct = Math.abs(target - current);
    return total + Math.min(direct, 3 - direct);
  }, 0);
}

function shortestDirection(current: number, target: number): MoveDirection {
  const upSteps = (current - target + 3) % 3;
  const downSteps = (target - current + 3) % 3;
  return upSteps <= downSteps ? "up" : "down";
}

function shortestActionCode(current: number, target: number): string {
  if (current === target) return "stay";
  return shortestDirection(current, target);
}

function stateKey(tileMask: number, targetMask: number): string {
  return `${tileMask}:${targetMask}`;
}

function maskFromIds(ids: readonly string[], ordinals: ReadonlyMap<string, number>): number {
  return ids.reduce((mask, id) => {
    const ordinal = ordinals.get(id);
    return ordinal === undefined ? mask : mask | (1 << ordinal);
  }, 0);
}

function emptyAnalysis(status: SolveAnalysis["status"], errors: readonly string[], arrangementCount = 0): SolveAnalysis {
  return {
    status,
    errors,
    arrangementCount,
    validArrangements: [],
    orphanTileIds: [],
    missingTargetIds: [],
    minimumCorrectArrangements: null,
    minimumCoverSetCountCapped: 0,
    canonicalPlan: [],
    minimumMovesToFirstSuccess: null
  };
}

function isValidToken(token: ArithmeticToken): boolean {
  return isArithmeticOperator(token) || isNonNegativeSafeInteger(token);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function targetSignature(level: EquationSliderLevelDefinition, targetId: string): string {
  const target = level.targets.find((candidate) => candidate.id === targetId);
  if (!target) return "unknown";
  return target.kind === "value" ? `value:${target.value}` : `equality:${formatExpression(target.rightExpression)}`;
}

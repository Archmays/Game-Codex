import type { BoardState } from "./board-state";
import {
  evaluateArrangementOutcome as evaluateOutcome,
  findHintContinuation,
  getLevelTargetIds,
  getMovableReels
} from "./solver";
import type {
  ArrangementOutcome,
  MoveDirection,
  PublishedEquationSliderLevel,
  ValueTarget
} from "./types";

export { evaluateArrangementOutcome } from "./solver";

export interface FeedbackMessage {
  readonly kind: "info" | "success";
  readonly text: string;
}

export type HintDepth = 1 | 2 | 3;

export interface HintMessage {
  readonly depth: HintDepth;
  readonly kind: "concept" | "position" | "direction";
  readonly text: string;
  readonly reelId?: string;
  readonly reelIndex?: number;
  readonly direction?: MoveDirection;
  readonly targetIndexes?: readonly number[];
}

export type FeedbackState = Pick<BoardState, "indexes" | "completedTargetIds">;
export type HintState = Pick<
  BoardState,
  "indexes" | "coveredTileIds" | "completedTargetIds"
>;

/**
 * Describes only the current arrangement. This function never advances coverage
 * or target state; the board reducer remains the single writer.
 */
export function createArrangementFeedback(
  level: PublishedEquationSliderLevel,
  state: FeedbackState
): FeedbackMessage {
  if (!hasValidStateShape(level, state.indexes)) {
    return unavailableFeedback();
  }

  const outcome = evaluateOutcome(level, state.indexes);
  if (outcome.failureReason) {
    return { kind: "info", text: failureText(outcome.failureReason) };
  }
  if (level.mode === "equality") {
    return equalityFeedback(outcome);
  }
  if (outcome.result === undefined) {
    return unavailableFeedback();
  }
  if (outcome.valid) {
    const newlySatisfied = outcome.satisfiedTargetIds.some(
      (targetId) => !state.completedTargetIds.has(targetId)
    );
    return {
      kind: "success",
      text: newlySatisfied
        ? `命中目标 ${outcome.result}。`
        : `结果 ${outcome.result} 正确，继续点亮新方块。`
    };
  }

  const target = nearestRemainingValueTarget(level, outcome.result, state.completedTargetIds);
  return target
    ? differenceFeedback(outcome.result, target.value)
    : { kind: "info", text: "这条算式还没有命中未完成目标。" };
}

/**
 * Returns one of three progressively specific hints. Every request asks the
 * solver for a continuation from the live board state; canonical-plan order is
 * deliberately not consulted here.
 */
export function getDynamicHint(
  level: PublishedEquationSliderLevel,
  state: HintState,
  requestedDepth: number
): HintMessage {
  const depth = clampHintDepth(requestedDepth);
  const kind = level.hints[depth - 1].kind;
  if (!hasValidStateShape(level, state.indexes)) {
    return {
      depth,
      kind,
      text: "暂时无法生成可靠提示，请重置本关。"
    };
  }

  const continuation = findHintContinuation(
    level,
    state.indexes,
    state.coveredTileIds,
    state.completedTargetIds
  );
  if (!continuation) {
    const complete = level.requiredTileIds.every((tileId) => state.coveredTileIds.has(tileId))
      && getLevelTargetIds(level).every((targetId) => state.completedTargetIds.has(targetId));
    return {
      depth,
      kind,
      text: complete
        ? "本关目标已经全部完成。"
        : "暂时找不到可靠的下一步，请重置本关。"
    };
  }

  if (depth === 1) {
    return {
      depth,
      kind: "concept",
      text: level.hints[0].text,
      targetIndexes: continuation.targetIndexes
    };
  }

  if (
    continuation.reelIndex === undefined
    || continuation.reelId === undefined
    || continuation.direction === undefined
  ) {
    return {
      depth,
      kind,
      text: "当前算式已经成立，再移动一列去点亮新方块。",
      targetIndexes: continuation.targetIndexes
    };
  }

  if (depth === 2) {
    return {
      depth,
      kind: "position",
      text: `看看第 ${continuation.reelIndex + 1} 条滑轨。`,
      reelId: continuation.reelId,
      reelIndex: continuation.reelIndex,
      targetIndexes: continuation.targetIndexes
    };
  }

  return {
    depth,
    kind: "direction",
    text: `把第 ${continuation.reelIndex + 1} 条滑轨向${continuation.direction === "up" ? "上" : "下"}移动一格。`,
    reelId: continuation.reelId,
    reelIndex: continuation.reelIndex,
    direction: continuation.direction,
    targetIndexes: continuation.targetIndexes
  };
}

/** Friendly name for the board UI; its V3 signature intentionally takes state. */
export const getHintMessage = getDynamicHint;

export function formatCurrentExpression(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[]
): string {
  if (!hasValidStateShape(level, indexes)) return "轨道状态不可用";
  return evaluateOutcome(level, indexes).expressionText;
}

function equalityFeedback(outcome: ArrangementOutcome): FeedbackMessage {
  if (outcome.valid) {
    return { kind: "success", text: "等号两边一样大。" };
  }
  if (outcome.equalityDifference === undefined) {
    return unavailableFeedback();
  }
  return outcome.equalityDifference > 0
    ? { kind: "info", text: `左边大 ${outcome.equalityDifference}，再调小一点。` }
    : { kind: "info", text: `左边小 ${Math.abs(outcome.equalityDifference)}，再调大一点。` };
}

function nearestRemainingValueTarget(
  level: PublishedEquationSliderLevel,
  result: number,
  completedTargetIds: ReadonlySet<string>
): ValueTarget | undefined {
  if (level.mode === "equality") return undefined;
  const unfinished = level.targets.filter(
    (target): target is ValueTarget =>
      target.kind === "value" && !completedTargetIds.has(target.id)
  );
  const candidates = unfinished.length > 0
    ? unfinished
    : level.targets.filter((target): target is ValueTarget => target.kind === "value");
  return [...candidates].sort(
    (left, right) =>
      Math.abs(result - left.value) - Math.abs(result - right.value)
      || left.value - right.value
      || left.id.localeCompare(right.id)
  )[0];
}

function differenceFeedback(result: number, target: number): FeedbackMessage {
  return result > target
    ? { kind: "info", text: `比目标 ${target} 大 ${result - target}。` }
    : { kind: "info", text: `离目标 ${target} 还差 ${target - result}。` };
}

function failureText(reason: NonNullable<ArrangementOutcome["failureReason"]>): string {
  if (reason === "division-by-zero") return "不能除以 0，换一个除数。";
  if (reason === "non-integer-division") return "这组不能整除，换一格试试。";
  if (reason === "negative-intermediate") return "先换数字，让结果不小于 0。";
  if (reason === "unsafe-integer") return "结果太大，换一组较小的数。";
  return "中央线还不是完整算式，请重置本关。";
}

function hasValidStateShape(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[]
): boolean {
  return indexes.length === getMovableReels(level).length
    && indexes.every((index) => Number.isInteger(index) && index >= 0 && index <= 2);
}

function clampHintDepth(requestedDepth: number): HintDepth {
  if (!Number.isFinite(requestedDepth) || requestedDepth <= 1) return 1;
  return requestedDepth >= 3 ? 3 : 2;
}

function unavailableFeedback(): FeedbackMessage {
  return { kind: "info", text: "当前轨道状态无法读取，请重置本关。" };
}

import { evaluateEquality, evaluateExpression, formatExpression } from "./evaluator";
import type {
  ArithmeticToken,
  PublishedEquationSliderLevel
} from "./types";

export interface ArrangementOutcome {
  readonly valid: boolean;
  readonly selectedTileIds: readonly string[];
  readonly expressionText: string;
  readonly result?: number;
  readonly rightResult?: number;
  readonly targetIndex?: number;
  readonly failureReason?: "division-by-zero" | "non-integer-division" | "negative-intermediate" | "invalid-token-sequence" | "unsafe-integer";
  readonly equalityDifference?: number;
}

export interface FeedbackMessage {
  readonly kind: "info" | "success";
  readonly text: string;
}

export interface HintMessage {
  readonly depth: 1 | 2 | 3 | 4 | 5;
  readonly text: string;
  readonly reelIndex?: number;
  readonly direction?: "up" | "down";
  readonly targetIndexes?: readonly number[];
}

export function evaluateArrangementOutcome(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[]
): ArrangementOutcome {
  const selected = level.reels.map((reel, reelIndex) => reel.tiles[wrapIndex(indexes[reelIndex] ?? 0, reel.tiles.length)]);
  const tokens = selected.map((tile) => tile.value);
  const selectedTileIds = selected.map((tile) => tile.id);
  const leftText = formatExpression(tokens);

  if (level.mode === "equality") {
    const equality = evaluateEquality(tokens, level.rightExpression);
    if (!equality.ok) {
      return {
        valid: false,
        selectedTileIds,
        expressionText: `${leftText} = ${formatExpression(level.rightExpression)}`,
        failureReason: equality.failure.reason
      };
    }
    return {
      valid: equality.balanced,
      selectedTileIds,
      expressionText: `${leftText} = ${formatExpression(level.rightExpression)}`,
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
      expressionText: leftText,
      failureReason: evaluation.reason
    };
  }
  if (level.mode === "target") {
    return {
      valid: evaluation.value === level.target,
      selectedTileIds,
      expressionText: leftText,
      result: evaluation.value
    };
  }
  const targetIndex = level.targets.indexOf(evaluation.value);
  return {
    valid: targetIndex >= 0,
    selectedTileIds,
    expressionText: leftText,
    result: evaluation.value,
    ...(targetIndex >= 0 ? { targetIndex } : {})
  };
}

export function createArrangementFeedback(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[],
  completedTargetIndexes: ReadonlySet<number> = new Set()
): FeedbackMessage {
  const outcome = evaluateArrangementOutcome(level, indexes);
  if (outcome.failureReason) {
    return { kind: "info", text: failureText(outcome.failureReason) };
  }
  if (level.mode === "equality") {
    const difference = outcome.equalityDifference ?? 0;
    if (difference === 0) {
      return { kind: "success", text: "等号两边一样大，这条算式成立。" };
    }
    return difference > 0
      ? { kind: "info", text: `左边比右边大 ${difference}，再调小一点。` }
      : { kind: "info", text: `右边比左边大 ${Math.abs(difference)}，再调大左边。` };
  }
  if (outcome.result === undefined) {
    return { kind: "info", text: "再移动一列，看看中央算式。" };
  }
  if (level.mode === "target") {
    if (outcome.result === level.target) {
      return { kind: "success", text: `得到目标 ${level.target}，这条算式成立。` };
    }
    return differenceFeedback(outcome.result, level.target);
  }
  if (outcome.targetIndex !== undefined) {
    return completedTargetIndexes.has(outcome.targetIndex)
      ? { kind: "success", text: `目标 ${outcome.result} 已经完成；这条算式仍然成立。` }
      : { kind: "success", text: `命中目标 ${outcome.result}。` };
  }
  const remainingTargets = level.targets
    .map((target, index) => ({ target, index }))
    .filter(({ index }) => !completedTargetIndexes.has(index));
  const candidates = remainingTargets.length > 0 ? remainingTargets : level.targets.map((target, index) => ({ target, index }));
  const nearest = [...candidates].sort((a, b) => {
    return Math.abs(outcome.result! - a.target) - Math.abs(outcome.result! - b.target) || a.target - b.target;
  })[0];
  return differenceFeedback(outcome.result, nearest.target);
}

export function getHintMessage(
  level: PublishedEquationSliderLevel,
  indexes: readonly number[],
  coveredTileIds: ReadonlySet<string>,
  completedTargetIndexes: ReadonlySet<number>,
  requestedDepth: number
): HintMessage {
  const depth = Math.max(1, Math.min(5, requestedDepth)) as 1 | 2 | 3 | 4 | 5;
  if (depth === 1) {
    return { depth, text: level.conceptHint };
  }
  if (depth === 2) {
    return { depth, text: createArrangementFeedback(level, indexes, completedTargetIndexes).text };
  }

  const next = findNextPlanArrangement(level, coveredTileIds, completedTargetIndexes);
  if (!next) {
    return { depth, text: "所有目标都已经完成，可以看看还没有亮的方块。" };
  }
  const reelIndex = next.findIndex((targetIndex, index) => targetIndex !== indexes[index]);
  if (reelIndex < 0) {
    return {
      depth,
      text: `中央线已经排成 ${formatPlannedExpression(level, next)}。`,
      targetIndexes: next
    };
  }
  if (depth === 3) {
    return { depth, text: `看看第 ${reelIndex + 1} 条滑轨。`, reelIndex, targetIndexes: next };
  }
  const direction = shortestDirection(indexes[reelIndex], next[reelIndex], level.reels[reelIndex].tiles.length);
  if (depth === 4) {
    return {
      depth,
      text: `把第 ${reelIndex + 1} 条滑轨向${direction === "up" ? "上" : "下"}移动。`,
      reelIndex,
      direction,
      targetIndexes: next
    };
  }
  return {
    depth,
    text: `下一条成立算式可以是：${formatPlannedExpression(level, next)}。`,
    reelIndex,
    direction,
    targetIndexes: next
  };
}

export function formatCurrentExpression(level: PublishedEquationSliderLevel, indexes: readonly number[]): string {
  return evaluateArrangementOutcome(level, indexes).expressionText;
}

function findNextPlanArrangement(
  level: PublishedEquationSliderLevel,
  coveredTileIds: ReadonlySet<string>,
  completedTargetIndexes: ReadonlySet<number>
): readonly number[] | undefined {
  return level.analysis.canonicalPlan.find((planIndexes) => {
    const outcome = evaluateArrangementOutcome(level, planIndexes);
    const addsTile = outcome.selectedTileIds.some((id) => !coveredTileIds.has(id));
    const addsTarget = outcome.targetIndex !== undefined && !completedTargetIndexes.has(outcome.targetIndex);
    return outcome.valid && (addsTile || addsTarget);
  });
}

function shortestDirection(current: number, target: number, length: number): "up" | "down" {
  const upSteps = (current - target + length) % length;
  const downSteps = (target - current + length) % length;
  return upSteps <= downSteps ? "up" : "down";
}

function formatPlannedExpression(level: PublishedEquationSliderLevel, indexes: readonly number[]): string {
  return evaluateArrangementOutcome(level, indexes).expressionText;
}

function differenceFeedback(result: number, target: number): FeedbackMessage {
  if (result > target) {
    return { kind: "info", text: `比目标 ${target} 大 ${result - target}，再调小一点。` };
  }
  return { kind: "info", text: `离目标 ${target} 还差 ${target - result}，可以试试更大的数。` };
}

function failureText(reason: NonNullable<ArrangementOutcome["failureReason"]>): string {
  if (reason === "division-by-zero") {
    return "不能分成 0 份，换一个除数试试。";
  }
  if (reason === "non-integer-division") {
    return "这一组不能平均分成整数。";
  }
  if (reason === "negative-intermediate") {
    return "先换一下数字，让结果不小于 0。";
  }
  if (reason === "unsafe-integer") {
    return "这个结果太大了，换一组较小的数。";
  }
  return "中央线还不是完整算式，再移动一列试试。";
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

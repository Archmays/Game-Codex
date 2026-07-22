import type { ArithmeticOperator, ArithmeticToken } from "./types";

export type EvaluationFailureReason =
  | "invalid-token-sequence"
  | "division-by-zero"
  | "non-integer-division"
  | "negative-intermediate"
  | "unsafe-integer";

export type ExpressionEvaluation =
  | { readonly ok: true; readonly value: number }
  | {
      readonly ok: false;
      readonly reason: EvaluationFailureReason;
      readonly left?: number;
      readonly right?: number;
      readonly operator?: ArithmeticOperator;
    };

export type EqualityEvaluation =
  | { readonly ok: true; readonly leftValue: number; readonly rightValue: number; readonly balanced: boolean }
  | {
      readonly ok: false;
      readonly side: "left" | "right";
      readonly failure: Exclude<ExpressionEvaluation, { readonly ok: true }>;
    };

const OPERATORS = new Set<ArithmeticOperator>(["+", "−", "×", "÷"]);

export function isArithmeticOperator(token: ArithmeticToken): token is ArithmeticOperator {
  return typeof token === "string" && OPERATORS.has(token as ArithmeticOperator);
}

export function evaluateExpression(tokens: readonly ArithmeticToken[]): ExpressionEvaluation {
  if (tokens.length === 0 || tokens.length % 2 === 0) {
    return { ok: false, reason: "invalid-token-sequence" };
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (index % 2 === 0) {
      if (typeof token !== "number" || !Number.isSafeInteger(token) || token < 0) {
        return {
          ok: false,
          reason: typeof token === "number" && !Number.isSafeInteger(token) ? "unsafe-integer" : "invalid-token-sequence"
        };
      }
    } else if (!isArithmeticOperator(token)) {
      return { ok: false, reason: "invalid-token-sequence" };
    }
  }

  const additiveValues: number[] = [];
  const additiveOperators: ArithmeticOperator[] = [];
  let current = tokens[0] as number;

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index] as ArithmeticOperator;
    const right = tokens[index + 1] as number;

    if (operator === "×" || operator === "÷") {
      const result = applyMultiplicative(current, right, operator);
      if (!result.ok) {
        return result;
      }
      current = result.value;
      continue;
    }

    additiveValues.push(current);
    additiveOperators.push(operator);
    current = right;
  }
  additiveValues.push(current);

  let result = additiveValues[0];
  for (let index = 0; index < additiveOperators.length; index += 1) {
    const operator = additiveOperators[index];
    const right = additiveValues[index + 1];
    const next = operator === "+" ? result + right : result - right;
    if (!Number.isSafeInteger(next)) {
      return { ok: false, reason: "unsafe-integer", left: result, right, operator };
    }
    if (next < 0) {
      return { ok: false, reason: "negative-intermediate", left: result, right, operator };
    }
    result = next;
  }

  return { ok: true, value: result };
}

export function evaluateEquality(
  leftTokens: readonly ArithmeticToken[],
  rightTokens: readonly ArithmeticToken[]
): EqualityEvaluation {
  const left = evaluateExpression(leftTokens);
  if (!left.ok) {
    return { ok: false, side: "left", failure: left };
  }
  const right = evaluateExpression(rightTokens);
  if (!right.ok) {
    return { ok: false, side: "right", failure: right };
  }
  return {
    ok: true,
    leftValue: left.value,
    rightValue: right.value,
    balanced: left.value === right.value
  };
}

export function formatExpression(tokens: readonly ArithmeticToken[]): string {
  return tokens.join(" ");
}

function applyMultiplicative(left: number, right: number, operator: "×" | "÷"): ExpressionEvaluation {
  if (operator === "÷") {
    if (right === 0) {
      return { ok: false, reason: "division-by-zero", left, right, operator };
    }
    if (left % right !== 0) {
      return { ok: false, reason: "non-integer-division", left, right, operator };
    }
  }

  const value = operator === "×" ? left * right : left / right;
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: "unsafe-integer", left, right, operator };
  }
  if (value < 0) {
    return { ok: false, reason: "negative-intermediate", left, right, operator };
  }
  return { ok: true, value };
}

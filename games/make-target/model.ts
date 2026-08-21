export type TargetOperator = "+" | "-" | "×" | "÷";

export type Expr = LiteralExpr | BinaryExpr;

export interface LiteralExpr {
  readonly kind: "literal";
  readonly value: number;
  readonly sourceCardId: string;
}

export interface BinaryExpr {
  readonly kind: "binary";
  readonly op: TargetOperator;
  readonly left: Expr;
  readonly right: Expr;
  readonly value: number;
}

export interface TargetCard {
  readonly id: string;
  readonly expr: Expr;
}

export function literalExpr(value: number, sourceCardId: string): LiteralExpr {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid target-card literal: ${value}`);
  return { kind: "literal", value, sourceCardId };
}

export function applyTargetOperation(left: Expr, right: Expr, op: TargetOperator): BinaryExpr | null {
  const value = calculateTargetValue(left.value, right.value, op);
  return value === null ? null : { kind: "binary", op, left, right, value };
}

export function calculateTargetValue(a: number, b: number, op: TargetOperator): number | null {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 0) return null;
  if (op === "+") return a + b;
  if (op === "-") return a >= b ? a - b : null;
  if (op === "×") return a * b;
  return b !== 0 && a % b === 0 ? a / b : null;
}

export function evaluateExpr(expr: Expr): number {
  if (expr.kind === "literal") return expr.value;
  const left = evaluateExpr(expr.left);
  const right = evaluateExpr(expr.right);
  const value = calculateTargetValue(left, right, expr.op);
  if (value === null || value !== expr.value) throw new Error(`Invalid target expression: ${formatExpr(expr)}`);
  return value;
}

export function formatExpr(expr: Expr): string {
  if (expr.kind === "literal") return String(expr.value);
  return `(${formatExpr(expr.left)} ${expr.op} ${formatExpr(expr.right)})`;
}

export function formatOperationEquation(expr: BinaryExpr): string {
  return `${formatExpr(expr.left)} ${expr.op} ${formatExpr(expr.right)} = ${expr.value}`;
}

export function sourceCardIds(expr: Expr): readonly string[] {
  if (expr.kind === "literal") return [expr.sourceCardId];
  return [...sourceCardIds(expr.left), ...sourceCardIds(expr.right)].sort();
}

export function createTargetCards(puzzleId: string, values: readonly number[]): TargetCard[] {
  return values.map((value, index) => {
    const sourceCardId = `${puzzleId}-source-${index + 1}`;
    return { id: sourceCardId, expr: literalExpr(value, sourceCardId) };
  });
}

export function cloneExpr(expr: Expr): Expr {
  return expr.kind === "literal"
    ? { ...expr }
    : { ...expr, left: cloneExpr(expr.left), right: cloneExpr(expr.right) };
}

import {
  applyTargetOperation,
  formatExpr,
  sourceCardIds,
  literalExpr,
  type Expr,
  type TargetOperator,
} from "./model";

export interface TargetRuleProfile {
  readonly nonNegativeIntegersOnly: true;
  readonly exactDivisionOnly: true;
}

export const TARGET_V1_RULES: TargetRuleProfile = {
  nonNegativeIntegersOnly: true,
  exactDivisionOnly: true,
};

export interface SolverMove {
  readonly leftExpression: string;
  readonly rightExpression: string;
  readonly leftSourceCardIds: readonly string[];
  readonly rightSourceCardIds: readonly string[];
  readonly op: TargetOperator;
  readonly value: number;
  readonly resultExpression: string;
}

export interface TargetSolutionPath {
  readonly steps: readonly SolverMove[];
  readonly finalExpression: string;
}

export interface TargetSolveResult {
  readonly solvable: boolean;
  readonly solutionPaths: readonly TargetSolutionPath[];
  readonly legalFirstMoves: readonly SolverMove[];
  readonly legalNextMoves: readonly SolverMove[];
  readonly solutionCount: number;
  readonly difficulty: "gentle" | "thinking" | "challenge";
}

const OPERATORS: readonly TargetOperator[] = ["+", "-", "×", "÷"];
const SOLUTION_CAP = 128;

export function solveTarget(
  cards: readonly (number | Expr)[],
  target: number,
  _ruleProfile: TargetRuleProfile = TARGET_V1_RULES,
): TargetSolveResult {
  const expressions = cards.map((card, index) => typeof card === "number" ? literalExpr(card, `solver-source-${index + 1}`) : card);
  const solutions: TargetSolutionPath[] = [];
  const solutionSignatures = new Set<string>();
  const visited = new Set<string>();

  const search = (state: readonly Expr[], steps: readonly SolverMove[]): void => {
    if (solutions.length >= SOLUTION_CAP) return;
    if (state.length === 1) {
      if (state[0].value !== target) return;
      const finalExpression = formatExpr(state[0]);
      const signature = `${finalExpression}|${steps.map(moveSignature).join(";")}`;
      if (!solutionSignatures.has(signature)) {
        solutionSignatures.add(signature);
        solutions.push({ steps, finalExpression });
      }
      return;
    }

    const stateKey = state.map(exprStateKey).sort().join("|");
    const visitKey = `${steps.length}:${stateKey}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);

    for (let leftIndex = 0; leftIndex < state.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < state.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;
        const left = state[leftIndex];
        const right = state[rightIndex];
        for (const op of OPERATORS) {
          if ((op === "+" || op === "×") && rightIndex < leftIndex) continue;
          const result = applyTargetOperation(left, right, op);
          if (!result) continue;
          const rest = state.filter((_, index) => index !== leftIndex && index !== rightIndex);
          const move: SolverMove = {
            leftExpression: formatExpr(left),
            rightExpression: formatExpr(right),
            leftSourceCardIds: sourceCardIds(left),
            rightSourceCardIds: sourceCardIds(right),
            op,
            value: result.value,
            resultExpression: formatExpr(result),
          };
          search([...rest, result], [...steps, move]);
        }
      }
    }
  };

  search(expressions, []);
  const legalFirstMoves = uniqueMoves(solutions.flatMap((path) => path.steps.slice(0, 1)));
  const solutionCount = solutions.length;
  return {
    solvable: solutionCount > 0,
    solutionPaths: solutions,
    legalFirstMoves,
    legalNextMoves: legalFirstMoves,
    solutionCount,
    difficulty: solutionCount >= 20 ? "gentle" : solutionCount >= 5 ? "thinking" : "challenge",
  };
}

function exprStateKey(expr: Expr): string {
  return `${expr.value}:${sourceCardIds(expr).join(",")}:${formatExpr(expr)}`;
}

function moveSignature(move: SolverMove): string {
  return `${move.leftSourceCardIds.join(",")}${move.op}${move.rightSourceCardIds.join(",")}=${move.value}`;
}

function uniqueMoves(moves: readonly SolverMove[]): SolverMove[] {
  const unique = new Map<string, SolverMove>();
  for (const move of moves) unique.set(moveSignature(move), move);
  return [...unique.values()].sort((left, right) => moveSignature(left).localeCompare(moveSignature(right)));
}

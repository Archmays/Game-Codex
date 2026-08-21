import { solveTarget, TARGET_V1_RULES, type SolverMove } from "./solver";

export type TargetMode = 10 | 12 | 24;

export interface TargetPuzzleManifestEntry {
  readonly id: string;
  readonly cards: readonly [number, number, number, number];
  readonly target: TargetMode;
  readonly difficulty: "gentle" | "thinking" | "challenge";
  readonly solutionCount: number;
  readonly canonicalSolution: string;
  readonly legalFirstMoves: readonly SolverMove[];
  readonly sourceRevision: "math-world-target-v1-curated-20260822";
}

const CURATED_PUZZLES: ReadonlyArray<{
  readonly id: string;
  readonly cards: readonly [number, number, number, number];
  readonly target: TargetMode;
}> = [
  { id: "target-10-01", cards: [1, 2, 3, 4], target: 10 },
  { id: "target-10-02", cards: [1, 1, 4, 4], target: 10 },
  { id: "target-10-03", cards: [2, 2, 3, 3], target: 10 },
  { id: "target-10-04", cards: [1, 2, 2, 5], target: 10 },
  { id: "target-12-01", cards: [1, 2, 3, 6], target: 12 },
  { id: "target-12-02", cards: [1, 3, 4, 6], target: 12 },
  { id: "target-12-03", cards: [2, 2, 4, 4], target: 12 },
  { id: "target-12-04", cards: [1, 2, 4, 5], target: 12 },
  { id: "target-24-01", cards: [1, 2, 3, 4], target: 24 },
  { id: "target-24-02", cards: [2, 3, 4, 4], target: 24 },
  { id: "target-24-03", cards: [2, 4, 6, 8], target: 24 },
  { id: "target-24-04", cards: [3, 5, 6, 8], target: 24 },
] as const;

export const TARGET_PUZZLE_MANIFEST: readonly TargetPuzzleManifestEntry[] = CURATED_PUZZLES.map((puzzle) => {
  const solved = solveTarget(puzzle.cards, puzzle.target, TARGET_V1_RULES);
  if (!solved.solvable || !solved.solutionPaths[0] || solved.solutionCount >= 128) {
    throw new Error(`${puzzle.id}: invalid published target puzzle`);
  }
  return Object.freeze({
    ...puzzle,
    difficulty: solved.difficulty,
    solutionCount: solved.solutionCount,
    canonicalSolution: solved.solutionPaths[0].finalExpression,
    legalFirstMoves: solved.legalFirstMoves,
    sourceRevision: "math-world-target-v1-curated-20260822" as const,
  });
});

export function puzzlesForTarget(target: TargetMode): readonly TargetPuzzleManifestEntry[] {
  return TARGET_PUZZLE_MANIFEST.filter((puzzle) => puzzle.target === target);
}

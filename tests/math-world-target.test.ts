import { describe, expect, it } from "vitest";
import { calculate, loadMakeTargetSave, MAKE_TARGET_SAVE_VERSION } from "../games/make-target";
import {
  applyTargetOperation,
  cloneExpr,
  createTargetCards,
  evaluateExpr,
  formatExpr,
  sourceCardIds,
} from "../games/make-target/model";
import { TARGET_PUZZLE_MANIFEST } from "../games/make-target/puzzles";
import { solveTarget } from "../games/make-target/solver";

describe("Math World target workshop", () => {
  it("keeps subtraction order and exact division instead of silently reversing operands", () => {
    expect(calculate(8, 3, "-")).toBe(5);
    expect(calculate(3, 8, "-")).toBeNull();
    expect(calculate(8, 2, "÷")).toBe(4);
    expect(calculate(2, 8, "÷")).toBeNull();
    expect(calculate(7, 2, "÷")).toBeNull();
  });

  it("stores an explicit expression tree and restores an exact independent clone", () => {
    const cards = createTargetCards("undo-proof", [1, 2, 3, 4]);
    const first = applyTargetOperation(cards[0].expr, cards[1].expr, "+");
    expect(first).not.toBeNull();
    const second = applyTargetOperation(first!, cards[2].expr, "×");
    expect(second).not.toBeNull();
    expect(evaluateExpr(second!)).toBe(9);
    expect(formatExpr(second!)).toBe("((1 + 2) × 3)");
    const restored = cloneExpr(first!);
    expect(restored).toEqual(first);
    expect(restored).not.toBe(first);
    expect(sourceCardIds(restored)).toEqual(["undo-proof-source-1", "undo-proof-source-2"]);
  });

  it("migrates the legacy save shape and refuses to overwrite future versions", () => {
    expect(loadMakeTargetSave({ wins: 3, completedPuzzleIds: ["target-24-a", "target-10-a"] }))
      .toEqual({
        save: {
          version: MAKE_TARGET_SAVE_VERSION,
          wins: 3,
          completedPuzzleIds: ["target-10-a", "target-24-a"]
        },
        canPersist: true,
        migrated: true
      });
    expect(loadMakeTargetSave({ version: 99, wins: 88, completedPuzzleIds: ["future"] }))
      .toEqual({
        save: { version: MAKE_TARGET_SAVE_VERSION, wins: 0, completedPuzzleIds: [] },
        canPersist: false,
        migrated: false
      });
  });

  it("publishes only deterministic four-card puzzles with solver-backed first hints", () => {
    expect(TARGET_PUZZLE_MANIFEST).toHaveLength(12);
    expect(new Set(TARGET_PUZZLE_MANIFEST.map((puzzle) => puzzle.id)).size).toBe(12);
    for (const puzzle of TARGET_PUZZLE_MANIFEST) {
      const solved = solveTarget(puzzle.cards, puzzle.target);
      expect(solved.solvable, puzzle.id).toBe(true);
      expect(solved.solutionCount, puzzle.id).toBeGreaterThan(0);
      expect(solved.solutionCount, puzzle.id).toBeLessThan(128);
      expect(puzzle.canonicalSolution, puzzle.id).toBe(solved.solutionPaths[0].finalExpression);
      expect(puzzle.legalFirstMoves, puzzle.id).toEqual(solved.legalFirstMoves);
      for (const solution of solved.solutionPaths) {
        expect(solution.steps, puzzle.id).toHaveLength(3);
        const finalSources = [
          ...solution.steps.at(-1)!.leftSourceCardIds,
          ...solution.steps.at(-1)!.rightSourceCardIds,
        ].sort();
        expect(finalSources, puzzle.id).toEqual([
          "solver-source-1",
          "solver-source-2",
          "solver-source-3",
          "solver-source-4",
        ]);
      }
    }
  });

  it("systematically evaluates every 1..10 four-card multiset for targets 10, 12, and 24", () => {
    let evaluated = 0;
    for (let a = 1; a <= 10; a += 1) {
      for (let b = a; b <= 10; b += 1) {
        for (let c = b; c <= 10; c += 1) {
          for (let d = c; d <= 10; d += 1) {
            for (const target of [10, 12, 24]) {
              const result = solveTarget([a, b, c, d], target);
              evaluated += 1;
              expect(result.solutionCount).toBeLessThanOrEqual(128);
              expect(result.solvable).toBe(result.solutionCount > 0);
              expect(result.legalNextMoves).toEqual(result.legalFirstMoves);
              for (const move of result.legalFirstMoves) {
                expect(Number.isSafeInteger(move.value)).toBe(true);
                expect(move.value).toBeGreaterThanOrEqual(0);
              }
            }
          }
        }
      }
    }
    expect(evaluated).toBe(2_145);
  }, 15_000);
});

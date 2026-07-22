import { evaluateEquality, evaluateExpression, formatExpression } from "../games/equation-slider/evaluator";

describe("equation slider evaluator", () => {
  it.each([
    { tokens: [3, "+", 4] as const, expected: 7 },
    { tokens: [9, "−", 5] as const, expected: 4 },
    { tokens: [3, "×", 4] as const, expected: 12 },
    { tokens: [12, "÷", 3] as const, expected: 4 },
    { tokens: [2, "+", 3, "×", 4] as const, expected: 14 },
    { tokens: [18, "÷", 3, "×", 2] as const, expected: 12 },
    { tokens: [12, "−", 4, "+", 3] as const, expected: 11 }
  ])("evaluates $tokens safely", ({ tokens, expected }) => {
    expect(evaluateExpression(tokens)).toEqual({ ok: true, value: expected });
  });

  it("rejects division by zero", () => {
    expect(evaluateExpression([8, "÷", 0])).toMatchObject({ ok: false, reason: "division-by-zero" });
  });

  it("rejects non-integer division", () => {
    expect(evaluateExpression([8, "÷", 3])).toMatchObject({ ok: false, reason: "non-integer-division" });
  });

  it("rejects a negative intermediate even if a later operation could recover", () => {
    expect(evaluateExpression([3, "−", 5, "+", 4])).toMatchObject({ ok: false, reason: "negative-intermediate" });
  });

  it.each([
    { tokens: [] as const },
    { tokens: [3, "+"] as const },
    { tokens: ["+", 3, 4] as const },
    { tokens: [3, 4, 5] as const },
    { tokens: [3, "+", "×"] as const }
  ])("rejects malformed token sequence $tokens", ({ tokens }) => {
    expect(evaluateExpression(tokens)).toMatchObject({ ok: false, reason: "invalid-token-sequence" });
  });

  it("evaluates both sides of an equality expression", () => {
    expect(evaluateEquality([2, "+", 3], [10, "÷", 2])).toEqual({
      ok: true,
      leftValue: 5,
      rightValue: 5,
      balanced: true
    });
    expect(evaluateEquality([7, "−", 1], [2, "+", 3])).toEqual({
      ok: true,
      leftValue: 6,
      rightValue: 5,
      balanced: false
    });
  });

  it("reports which equality side contains an invalid operation", () => {
    expect(evaluateEquality([8, "÷", 3], [2, "+", 3])).toMatchObject({
      ok: false,
      side: "left",
      failure: { reason: "non-integer-division" }
    });
  });

  it("formats a token sequence without executing a string", () => {
    expect(formatExpression([2, "+", 3, "×", 4])).toBe("2 + 3 × 4");
  });
});

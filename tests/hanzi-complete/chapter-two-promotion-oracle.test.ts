import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import oracle from "./fixtures/chapter-two-ee8d47b-oracles.json";
import { createChapterTwoState, reduceChapterTwoState, type ChapterTwoAction } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import type { ChapterTwoRuleset } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";

describe("immutable ee8d47b legacy and pilot-six-r1 interpreters", () => {
  test.each(oracle.runs)("every recorded prefix: $seed", run => {
    expect(oracle.head).toBe("ee8d47b36703bb29b75ceff8307a6b841f7377aa");
    const ruleset = "ruleset" in run ? run.ruleset as ChapterTwoRuleset : undefined;
    let state = createChapterTwoState(run.seed, "light-speaker", ruleset);
    const hash = () => createHash("sha256").update(JSON.stringify(state)).digest("hex");
    expect(hash()).toBe(run.states[0].sha256);
    (run.actions as ChapterTwoAction[]).forEach((action, index) => {
      state = reduceChapterTwoState(state, action);
      expect(hash(), `${run.seed} / prefix ${index + 1} / ${state.phase}`).toBe(run.states[index + 1].sha256);
    });
    expect(state.phase).toBe("chapter-summary");
  });
});

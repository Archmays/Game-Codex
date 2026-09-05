import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import oracle from "./fixtures/chapter-two-legacy-4befee7.json";
import { createChapterTwoState, reduceChapterTwoState, replayChapterTwoRun, type ChapterTwoAction } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
describe("unversioned replay matches the actual 4befee7 engine", () => {
 it("preserves every prefix and every old phase, including completion", () => {
  const actions = oracle.actions as ChapterTwoAction[];
  let state = createChapterTwoState(oracle.seed, "light-speaker");
  const hash = () => createHash("sha256").update(JSON.stringify(state)).digest("hex");
  expect(hash()).toBe(oracle.states[0].sha256);
  actions.forEach((action, index) => {
   state = reduceChapterTwoState(state, action);
   expect(hash(), "prefix " + (index + 1) + " " + state.phase).toBe(oracle.states[index + 1].sha256);
   expect(replayChapterTwoRun(oracle.seed, "light-speaker", actions.slice(0,index+1)).state).toEqual(state);
  });
  expect(new Set(oracle.states.map(row=>row.phase)).size).toBe(15);
  expect(state.phase).toBe("chapter-summary");
  expect(state).not.toHaveProperty("ruleset");
 });
});

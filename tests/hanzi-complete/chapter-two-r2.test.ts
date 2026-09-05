import { describe, expect, test } from "vitest";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { createChapterTwoRun, createChapterTwoState, reduceChapterTwoState, getPilotProgress, getR2Progress, replayChapterTwoActions, allR2RootsConnected, isChapterTwoAction, type ChapterTwoState } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { CHAPTER_TWO_R2_RULESET, CHAPTER_TWO_R2_DEFINITIONS, getR2Definition } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/chapter-two-r2";
import { CHAPTER_TWO_EPISODES } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/contracts";
import { PILOT_SIX_RULESET, pilotEncounterKey, samePilotEdge } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";
import { pilotRun } from "./pilot-six-fixture";
import { chapterTwoR2Run } from "./chapter-two-r2-fixture";

describe("chapter-two-r2 full promotion", () => {
  test("new runs default to r2 while unversioned state construction remains legacy", () => {
    expect(createChapterTwoRun("new", "light-speaker").ruleset).toBe(CHAPTER_TWO_R2_RULESET);
    expect(createChapterTwoState()).not.toHaveProperty("ruleset");
  });
  test.each([false, true])("completes every main encounter and three actual root connections, branch=%s", branch => {
    const run = chapterTwoR2Run({ branch });
    expect(run.state.phase).toBe("chapter-summary");
    expect(run.state.discoveredCharacterIds).toHaveLength(12);
    expect(run.state.discoveredFamilyIds).toHaveLength(12);
    expect(run.state.repairedObjectIds).toHaveLength(4);
    expect(run.state.completedEpisodeIds).toHaveLength(4);
    expect(allR2RootsConnected(run.state)).toBe(true);
    expect(run.state.completedBehaviorIds).toHaveLength(3);
    expect(run.state.bossEvidence.every(evidence => evidence.allPreviouslyIntroduced)).toBe(true);
    let state = createChapterTwoState(run.seed, run.initialHeroId, run.ruleset);
    for (let i = 0; i < run.actions.length; i++) {
      state = reduceChapterTwoState(state, run.actions[i]);
      expect(replayChapterTwoActions(run.seed, run.initialHeroId, run.actions.slice(0, i + 1), run.ruleset)).toEqual(state);
      if (state.repairedObjectIds.includes("component-root-heart")) expect(allR2RootsConnected(state)).toBe(true);
    }
  });
  test("the first six r2 encounters keep every r1 rule-state field except the explicit ruleset", () => {
    const published = pilotRun({ seed: "frozen-first-six", branch: true, stop: state => state.episodeIndex === 1 && state.encounterIndex === 2 });
    let r1 = createChapterTwoState(published.seed, "light-speaker", PILOT_SIX_RULESET);
    let r2 = createChapterTwoState(published.seed, "light-speaker", CHAPTER_TWO_R2_RULESET);
    for (const action of published.actions.slice(0, -1)) {
      r1 = reduceChapterTwoState(r1, action); r2 = reduceChapterTwoState(r2, action);
      expect({ ...r2, ruleset: PILOT_SIX_RULESET }).toEqual(r1);
    }
    expect(r2.phase).toBe("family-result");
    expect(r2.repairedObjectIds).not.toContain("spring-waterwheel");
  });
  test.each(CHAPTER_TWO_R2_DEFINITIONS)("all graph members and legal pairings accepted: $object", definition => {
    const at = chapterTwoR2Run({ stop: state => getR2Definition(state) === definition && state.phase === "family-connect" }).state;
    const family = COMPLETE_COMPONENT_FAMILIES.find(family => family.id === definition.familyId)!;
    expect(definition.nodeIds).toEqual(family.memberCharacterIds);
    expect(family.memberCharacterIds).not.toContain(definition.decoyId);
    expect(COMPLETE_COMPONENT_RELATIONS.some(relation => relation.characterId === definition.decoyId)).toBe(true);
    for (let i = 0; i < definition.nodeIds.length; i++) for (let j = i + 1; j < definition.nodeIds.length; j++) {
      let state = at;
      for (const characterId of [definition.nodeIds[i], definition.nodeIds[j]]) state = reduceChapterTwoState(state, { type: "toggle-family-character", characterId });
      state = reduceChapterTwoState(state, { type: "connect-family" });
      expect(getPilotProgress(state).edges.some(edge => samePilotEdge(edge, definition.nodeIds[i], definition.nodeIds[j]))).toBe(true);
      if (![definition.nodeIds[i], definition.nodeIds[j]].includes(definition.startId) || definition.rootSource !== undefined) expect(state.phase).toBe("family-connect");
    }
    let wrong = reduceChapterTwoState(at, { type: "toggle-family-character", characterId: definition.startId });
    wrong = reduceChapterTwoState(wrong, { type: "toggle-family-character", characterId: definition.decoyId });
    wrong = reduceChapterTwoState(wrong, { type: "connect-family" });
    expect(wrong.phase).toBe("family-connect");
    expect(getPilotProgress(wrong)).toEqual(getPilotProgress(at));
    expect(getR2Progress(wrong)).toEqual(getR2Progress(at));
  });
  test.each(["voice-bridge", "rice-lamps", "metal-lock"])("two legal orders retain different actual intermediate objects: %s", object => {
    const definition = CHAPTER_TWO_R2_DEFINITIONS.find(definition => definition.object === object)!;
    const before = chapterTwoR2Run({ stop: state => getR2Definition(state) === definition && state.phase === "pilot-meaning" }).state;
    const intermediate = definition.targets.map(target => reduceChapterTwoState(before, { type: "r2-target", targetId: target.id }));
    expect(getR2Progress(intermediate[0]).targets).not.toEqual(getR2Progress(intermediate[1]).targets);
    intermediate.forEach((state, index) => {
      expect(state.phase).toBe("pilot-meaning");
      expect(getPilotProgress(state).magicApplied).toBe(false);
      expect(reduceChapterTwoState(state, { type: "r2-target", targetId: definition.targets[index].id })).toBe(state);
      const after = reduceChapterTwoState(state, { type: "r2-target", targetId: definition.targets[1 - index].id });
      expect(after.phase).toBe("family-connect"); expect(getPilotProgress(after).magicApplied).toBe(true);
    });
  });
  test("root attachment requires the visible route and all repaired regions; final repair requires all three roots", () => {
    const at = chapterTwoR2Run({ stop: state => state.episodeIndex === 3 && state.phase === "family-connect" }).state;
    expect(reduceChapterTwoState(at, { type: "r2-root" })).toBe(at);
    const third = chapterTwoR2Run({ stop: state => state.episodeIndex === 3 && state.encounterIndex === 2 && state.phase === "family-result" }).state;
    const earlier = CHAPTER_TWO_R2_DEFINITIONS.find(definition => definition.rootSource === 0)!;
    const missing = { ...third, r2Progress: { ...third.r2Progress, [pilotEncounterKey(earlier)]: { ...third.r2Progress![pilotEncounterKey(earlier)], rootConnected: false } } } satisfies ChapterTwoState;
    expect(reduceChapterTwoState(missing, { type: "continue" })).toBe(missing);
    expect(third.repairedObjectIds).not.toContain("component-root-heart");
    expect(reduceChapterTwoState(third, { type: "continue" }).repairedObjectIds).toContain("component-root-heart");
    expect(CHAPTER_TWO_EPISODES[3].storyCharacterIds).toEqual(["char-u60c5", "char-u8fdb", "char-u6307"]);
  });
  test("r2 actions cannot enter either old interpreter or the frozen first six", () => {
    for (const ruleset of [undefined, PILOT_SIX_RULESET]) {
      const state = createChapterTwoState("old", "light-speaker", ruleset);
      expect(isChapterTwoAction({ type: "r2-root" }, ruleset)).toBe(false);
      expect(reduceChapterTwoState(state, { type: "r2-root" })).toBe(state);
    }
    const state = reduceChapterTwoState(createChapterTwoRun("new", "light-speaker").state, { type: "start" });
    expect(reduceChapterTwoState(state, { type: "r2-target", targetId: "clock-face" })).toBe(state);
  });
});

import { describe, expect, test } from "vitest";
import { createChapterTwoState, getPilotProgress, isChapterTwoAction, reduceChapterTwoState, replayChapterTwoActions, type ChapterTwoAction } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { PILOT_SIX_DEFINITIONS, PILOT_SIX_RULESET, getPilotSixDefinition, pilotEncounterKey, pilotReachable } from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { createFreshCompleteSave, progressSeedFromCompleteSave, syncCompleteSaveFromEngine, updateCompleteSave } from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { pilotRun } from "./pilot-six-fixture";

describe("Six-encounter scene rules", () => {
  test("binds only the six complete encounter keys and leaves the later repeats historical", () => {
    const state = createChapterTwoState("scope", "light-speaker", PILOT_SIX_RULESET);
    const keys = [];
    for (let episodeIndex = 0; episodeIndex < 4; episodeIndex++) for (let encounterIndex = 0; encounterIndex < 5; encounterIndex++) {
      const pilot = getPilotSixDefinition({ ...state, episodeIndex, encounterIndex }); if (pilot) keys.push(pilotEncounterKey(pilot));
    }
    expect(keys).toEqual(PILOT_SIX_DEFINITIONS.map(pilotEncounterKey));
    expect(getPilotSixDefinition({ ...state, episodeIndex: 3, encounterIndex: 1 })).toBeUndefined();
    expect(getPilotSixDefinition(createChapterTwoState("legacy"))).toBeUndefined();
    expect(isChapterTwoAction({ type: "pilot-magic" })).toBe(false);
    expect(isChapterTwoAction({ type: "pilot-magic" }, PILOT_SIX_RULESET)).toBe(true);
  });

  test.each([false, true])("completes both routes and the untouched chapter continuation (via middle = %s)", (branch) => {
    const result = pilotRun({ branch });
    expect(result.state.phase).toBe("chapter-summary");
    expect(result.state.completedEpisodeIds).toHaveLength(4);
    expect(result.state.repairedObjectIds).toHaveLength(4);
    expect(result.state.discoveredCharacterIds).toHaveLength(12);
    expect(result.state.discoveredFamilyIds).toHaveLength(12);
    expect(result.state.completedBossIds).toHaveLength(4);
    expect(result.state.completedBehaviorIds).toHaveLength(3);
    expect(result.state.bossEvidence.every((evidence) => evidence.allPreviouslyIntroduced)).toBe(true);
    expect(result.state.selectedAbilityIds).toHaveLength(1); // Only the later, actually chosen ability.
    expect(result.state.triggeredAbilityIds).toEqual(result.state.selectedAbilityIds);
    expect(replayChapterTwoActions(result.seed, result.initialHeroId, result.actions, result.ruleset)).toEqual(result.state);
    for (const definition of PILOT_SIX_DEFINITIONS.slice(3)) {
      const edges = result.state.pilotProgress![pilotEncounterKey(definition)].edges;
      expect(edges.length).toBe(branch ? 2 : 1);
      expect(pilotReachable(definition.startId, edges).has(definition.endId)).toBe(true);
    }
  });

  test.each(PILOT_SIX_DEFINITIONS.map((definition, index) => [index + 1, definition] as const))("%s: a nonmember never changes the route, and every real member pair is accepted", (_number, definition) => {
    const fixture = pilotRun({ stop: (state) => state.phase === "family-connect" && getPilotSixDefinition(state) === definition });
    let state = fixture.state;
    const before = getPilotProgress(state);
    for (const characterId of [definition.startId, definition.decoyId]) state = reduceChapterTwoState(state, { type: "toggle-family-character", characterId });
    state = reduceChapterTwoState(state, { type: "connect-family" });
    expect(getPilotProgress(state)).toEqual(before);
    expect(state.phase).toBe("family-connect");
    expect(state.discoveredFamilyIds).not.toContain(definition.familyId);
    for (let i = 0; i < definition.nodeIds.length; i++) for (let j = i + 1; j < definition.nodeIds.length; j++) {
      let pair = fixture.state;
      for (const characterId of [definition.nodeIds[i], definition.nodeIds[j]]) pair = reduceChapterTwoState(pair, { type: "toggle-family-character", characterId });
      pair = reduceChapterTwoState(pair, { type: "connect-family" });
      expect(getPilotProgress(pair).edges).toEqual([[definition.nodeIds[i], definition.nodeIds[j]]]);
      if (!getPilotProgress(pair).edges.flat().includes(definition.startId)) expect(pair.phase).toBe("family-connect");
    }
  });

  test("two heart expressions open different actual vines, without an emotion score", () => {
    const quiet = pilotRun({ expression: "quiet" }).state.pilotProgress!;
    const talk = pilotRun({ expression: "talk" }).state.pilotProgress!;
    const key = pilotEncounterKey(PILOT_SIX_DEFINITIONS[2]);
    expect(quiet[key].expression).toBe("quiet"); expect(talk[key].expression).toBe("talk");
    expect(quiet[key].edges).toEqual(talk[key].edges);
    expect(quiet[key].magicApplied && talk[key].magicApplied).toBe(true);
  });

  test("进 cannot create roads or move across an unconnected edge, and 06 does not unlock or repair the whole valley", () => {
    const result = pilotRun({ branch: true, stop: (state) => state.phase === "pilot-meaning" && getPilotSixDefinition(state)?.object === "waterwheel" });
    const blocked = reduceChapterTwoState(result.state, { type: "pilot-move", nodeId: "char-u9053" });
    expect(getPilotProgress(blocked).wheelNodeId).toBe("char-u8fdb");
    expect(blocked.pilotProgress).toEqual(result.state.pilotProgress);
    expect(blocked.phase).toBe("pilot-meaning");
    const middle = reduceChapterTwoState(blocked, { type: "pilot-move", nodeId: "char-u8ff7" });
    expect(getPilotProgress(middle).wheelNodeId).toBe("char-u8ff7");
    expect(middle.phase).toBe("pilot-meaning");
    const atSeven = pilotRun({ branch: true, stop: (state) => state.episodeIndex === 1 && state.encounterIndex === 2 && state.phase === "build" });
    expect(atSeven.state.currentCharacterId).toBe("char-u8ff7");
    expect(atSeven.state.repairedObjectIds).toEqual(["tree-canopy-bridge"]);
    expect(atSeven.state.completedEpisodeIds).toEqual(["chapter-two:wood-voice-canopy"]);
    let master = createCompleteEngineState("pilot", progressSeedFromCompleteSave(updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two"], chapterTwoReplay: { seed: atSeven.seed, initialHeroId: atSeven.initialHeroId, ruleset: atSeven.ruleset, actions: atSeven.actions } })));
    master = reduceCompleteEngineState(master, { type: "enter-chapter", chapterId: "chapter-two" });
    expect(master.unlockedChapterIds).not.toContain("chapter-three");
    const complete = pilotRun({ branch: true });
    for (const action of complete.actions.slice(atSeven.actions.length)) master = reduceCompleteEngineState(master, { type: "chapter-two-action", action });
    expect(master.unlockedChapterIds).toContain("chapter-three");
    const saved = syncCompleteSaveFromEngine(createFreshCompleteSave(), master);
    expect(saved.chapterTwoReplay?.ruleset).toBe(PILOT_SIX_RULESET);
  });

  test("new replay restores every accepted action boundary, including wrong attempts", () => {
    const run = pilotRun({ branch: true });
    let state = createChapterTwoState(run.seed, run.initialHeroId, run.ruleset);
    const actions: ChapterTwoAction[] = [];
    for (const action of run.actions) {
      state = reduceChapterTwoState(state, action); actions.push(action);
      expect(replayChapterTwoActions(run.seed, run.initialHeroId, actions, run.ruleset)).toEqual(state);
    }
  });
});

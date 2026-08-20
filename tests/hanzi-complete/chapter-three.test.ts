import { describe, expect, test } from "vitest";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_RELATIONS } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import {
  CHAPTER_THREE_BEHAVIORS,
  CHAPTER_THREE_BOSSES,
  CHAPTER_THREE_EPISODES,
  CHAPTER_THREE_NEW_ABILITIES,
  CHAPTER_THREE_OPTIONAL_CHARACTER_IDS,
  CHAPTER_THREE_OPTIONAL_WORD_IDS,
  CHAPTER_THREE_REPAIRS,
  CHAPTER_THREE_STORY_CHARACTER_IDS,
  CHAPTER_THREE_STORY_WORD_IDS,
} from "../../games/hanzi-radical-battle/complete/chapters/chapter-three/contracts";
import {
  createChapterThreeState,
  reduceChapterThreeState,
  replayChapterThreeActions,
  simulateChapterThree,
  type ChapterThreeAction,
} from "../../games/hanzi-radical-battle/complete/chapters/chapter-three/engine";
import { createFreshCompleteSave, progressSeedFromCompleteSave, syncCompleteSaveFromEngine, updateCompleteSave, validateCompleteSave } from "../../games/hanzi-radical-battle/complete/save/complete-save";

describe("Chapter Three content, finale and epilogue contracts", () => {
  test("allocates 18 new characters as 12 story and 6 genuinely optional without making optional characters story-word requirements", () => {
    const records = COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-three");
    expect(records).toHaveLength(18);
    expect(records.filter((character) => character.band === "story-required").map((character) => character.id)).toEqual(expect.arrayContaining([...CHAPTER_THREE_STORY_CHARACTER_IDS]));
    expect(records.filter((character) => character.band === "optional").map((character) => character.id)).toEqual(expect.arrayContaining([...CHAPTER_THREE_OPTIONAL_CHARACTER_IDS]));
    const storyWordCharacterIds = new Set(COMPLETE_WORD_NODES.filter((word) => word.band === "story").flatMap((word) => word.characterIds));
    expect(CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.some((id) => storyWordCharacterIds.has(id))).toBe(false);
  });

  test("defines 12 story and 24 optional words, four episodes, three safe abilities, three recoverable behaviors, four bosses and four durable repairs", () => {
    expect(CHAPTER_THREE_STORY_WORD_IDS).toHaveLength(12);
    expect(CHAPTER_THREE_OPTIONAL_WORD_IDS).toHaveLength(24);
    expect(CHAPTER_THREE_EPISODES.slice(0, 3).flatMap((episode) => episode.wordIds)).toEqual(expect.arrayContaining([...CHAPTER_THREE_STORY_WORD_IDS]));
    expect(CHAPTER_THREE_EPISODES).toHaveLength(4);
    expect(CHAPTER_THREE_NEW_ABILITIES).toHaveLength(3);
    expect(CHAPTER_THREE_NEW_ABILITIES.every((ability) => ability.neverAutoSolves && ability.neverChangesAnswer && ability.noProbability && ability.noRarity && ability.noPrice && ability.noPunitiveLoss)).toBe(true);
    expect(CHAPTER_THREE_BEHAVIORS).toHaveLength(3);
    expect(CHAPTER_THREE_BEHAVIORS.every((behavior) => behavior.telegraph && behavior.effect && behavior.guaranteedRecovery && behavior.neverChangesWordOrder && behavior.neverChangesProgress)).toBe(true);
    expect(CHAPTER_THREE_BOSSES).toHaveLength(4);
    expect(CHAPTER_THREE_REPAIRS).toHaveLength(4);
    for (const repair of CHAPTER_THREE_REPAIRS) {
      expect(repair.before.shape).not.toBe(repair.after.shape);
      expect(repair.before.function).not.toBe(repair.after.function);
      expect(repair.before.light).not.toBe(repair.after.light);
      expect(repair.persistence).toBe("local-durable");
      expect(repair.saveField).toBe("repairedObjectIds");
    }
  });

  test("keeps the final core limited to previously established structures, sourced families and already encountered words", () => {
    const core = CHAPTER_THREE_EPISODES[3];
    expect(core.wordIds.every((id) => CHAPTER_THREE_EPISODES.slice(0, 3).some((episode) => (episode.wordIds as readonly string[]).includes(id)))).toBe(true);
    core.wordIds.forEach((wordId, index) => {
      const targetWord = COMPLETE_WORD_NODES.find((word) => word.id === wordId)!;
      expect(COMPLETE_COMPONENT_RELATIONS.some((relation) => relation.characterId === targetWord.characterIds[0] && relation.familyId === core.coreFamilyIds[index] && relation.sourceIds.length > 0)).toBe(true);
    });
  });
});

describe("Chapter Three deterministic word-resonance adventure", () => {
  test.each(["light-speaker", "forest-speaker", "ink-companion"] as const)("completes the finale and epilogue with %s", (heroId) => {
    const result = simulateChapterThree(`chapter-three-${heroId}`, heroId);
    expect(result.passed, result.failureCodes.join(",")).toBe(true);
    expect(result.finalState.phase).toBe("chapter-summary");
    expect(result.finalState.discoveredCharacterIds).toEqual(expect.arrayContaining([...CHAPTER_THREE_STORY_CHARACTER_IDS]));
    expect(result.finalState.discoveredCharacterIds.some((id) => CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.includes(id as never))).toBe(false);
    expect(result.finalState.discoveredWordIds).toEqual(expect.arrayContaining([...CHAPTER_THREE_STORY_WORD_IDS]));
    expect(result.finalState.discoveredWordIds).toHaveLength(12);
    expect(result.finalState.selectedAbilityIds).toHaveLength(3);
    expect(result.finalState.triggeredAbilityIds).toHaveLength(3);
    expect(result.finalState.completedBehaviorIds).toHaveLength(3);
    expect(result.finalState.completedBossIds).toHaveLength(4);
    expect(result.finalState.repairedObjectIds).toHaveLength(4);
    expect(result.finalState.reviewedFamilyIds).toHaveLength(3);
    expect(result.finalState.bossEvidence.every((evidence) => evidence.allPreviouslyIntroduced)).toBe(true);
    expect(replayChapterThreeActions(`chapter-three-${heroId}`, heroId, result.actions)).toEqual(result.finalState);
  });

  test("enforces build A, A meaning, build B, B meaning, ordered slots, word and world-effect sequence", () => {
    const simulation = simulateChapterThree("word-flow-order");
    let state = createChapterThreeState("word-flow-order");
    const phases: string[] = [state.phase];
    for (const action of simulation.actions) {
      state = reduceChapterThreeState(state, action);
      if (phases.at(-1) !== state.phase) phases.push(state.phase);
      if (state.phase === "world-effect") break;
    }
    const expected = ["discovery-build", "discovery-meaning", "word-build-a", "word-meaning-a", "word-build-b", "word-meaning-b", "word-order", "word-result", "world-effect"];
    let cursor = -1;
    for (const phase of expected) {
      cursor = phases.indexOf(phase, cursor + 1);
      expect(cursor, `${phase} missing from ${phases.join(" -> ")}`).toBeGreaterThanOrEqual(0);
    }
  });

  test("rejects reversed word order and a wrong component without losing completed progress", () => {
    const simulation = simulateChapterThree("reversible-errors");
    let state = createChapterThreeState("reversible-errors");
    let cursor = 0;
    while (state.phase !== "discovery-build") state = reduceChapterThreeState(state, simulation.actions[cursor++]);
    const wrongCard = state.hand.find((card) => card.kind === "distractor")!;
    const slot = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === state.currentBuildCharacterId)!.components[0].slotId;
    state = reduceChapterThreeState(state, { type: "place-card", cardId: wrongCard.id, slotId: slot });
    expect(state.placements).toEqual([]);
    expect(state.gentleMessage).toContain("保留");
    while (state.phase !== "word-order") state = reduceChapterThreeState(state, simulation.actions[cursor++]);
    const targetWord = COMPLETE_WORD_NODES.find((word) => word.id === state.currentWordId)!;
    state = reduceChapterThreeState(state, { type: "place-word-character", characterId: targetWord.characterIds[1] });
    state = reduceChapterThreeState(state, { type: "place-word-character", characterId: targetWord.characterIds[0] });
    expect(state.phase).toBe("word-order");
    expect(state.wordSelectedCharacterIds).toEqual([]);
    expect(state.gentleMessage).toContain("进度都保留");
  });

  test("converges without softlocks across bounded seeds", () => {
    for (let index = 0; index < 40; index += 1) {
      const seed = `chapter-three-coverage-${index}`;
      const hero = index % 2 ? "forest-speaker" : "ink-companion";
      const first = simulateChapterThree(seed, hero);
      const second = simulateChapterThree(seed, hero);
      expect(first.passed, `${seed}:${first.failureCodes.join(",")}`).toBe(true);
      expect(second.actions).toEqual(first.actions);
      expect(second.finalState).toEqual(first.finalState);
    }
  });

  test("integrates finale, epilogue completion and postgame unlock into the complete engine and V3 save", () => {
    const unlocked = updateCompleteSave(createFreshCompleteSave(), {
      unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
      completedChapterIds: ["chapter-one", "chapter-two"],
    });
    let complete = createCompleteEngineState("chapter-three-master", progressSeedFromCompleteSave(unlocked));
    complete = reduceCompleteEngineState(complete, { type: "enter-chapter", chapterId: "chapter-three" });
    const simulation = simulateChapterThree("chapter-three-master:chapter-three", complete.heroId);
    for (const action of simulation.actions as readonly ChapterThreeAction[]) complete = reduceCompleteEngineState(complete, { type: "chapter-three-action", action });
    expect(complete.completedChapterIds).toEqual(["chapter-one", "chapter-two", "chapter-three"]);
    const save = syncCompleteSaveFromEngine(unlocked, complete, "2026-08-20T13:00:00.000Z");
    expect(save.chapterThreeReplay?.actions).toEqual(simulation.actions);
    expect(save.discoveredWordIds).toHaveLength(12);
    expect(validateCompleteSave(save)).toEqual(save);
    complete = reduceCompleteEngineState(complete, { type: "return-world" });
    complete = reduceCompleteEngineState(complete, { type: "enter-postgame", mode: "word-resonance" });
    expect(complete.screen).toBe("postgame");
  });
});

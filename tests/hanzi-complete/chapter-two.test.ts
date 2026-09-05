import { describe, expect, test } from "vitest";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import {
  CHAPTER_TWO_BEHAVIORS,
  CHAPTER_TWO_BOSSES,
  CHAPTER_TWO_EPISODES,
  CHAPTER_TWO_NEW_ABILITIES,
  CHAPTER_TWO_OPTIONAL_CHARACTER_IDS,
  CHAPTER_TWO_REPAIRS,
  CHAPTER_TWO_STORY_CHARACTER_IDS,
  CHAPTER_TWO_STORY_FAMILY_IDS,
} from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/contracts";
import {
  createChapterTwoState,
  reduceChapterTwoState,
  replayChapterTwoActions,
  simulateChapterTwo,
} from "../../games/hanzi-radical-battle/complete/chapters/chapter-two/engine";
import { createFreshCompleteSave, progressSeedFromCompleteSave, syncCompleteSaveFromEngine, updateCompleteSave, validateCompleteSave } from "../../games/hanzi-radical-battle/complete/save/complete-save";

describe("Chapter Two content and world contracts", () => {
  test("allocates 18 genuinely new characters as 12 story and 6 optional", () => {
    const records = COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-two");
    expect(records).toHaveLength(18);
    expect(records.filter((character) => character.band === "story-required").map((character) => character.id)).toEqual(CHAPTER_TWO_STORY_CHARACTER_IDS);
    expect(records.filter((character) => character.band === "optional").map((character) => character.id)).toEqual(CHAPTER_TWO_OPTIONAL_CHARACTER_IDS);
    expect(new Set(records.map((character) => character.glyph)).size).toBe(18);
  });

  test("defines four episodes, twelve sourced story families, three abilities, three recoverable behaviors, four bosses and four durable repairs", () => {
    expect(CHAPTER_TWO_EPISODES).toHaveLength(4);
    expect(CHAPTER_TWO_STORY_FAMILY_IDS).toHaveLength(12);
    expect(new Set(CHAPTER_TWO_EPISODES.slice(0, 3).flatMap((episode) => episode.familyIds))).toEqual(new Set(CHAPTER_TWO_STORY_FAMILY_IDS));
    expect(CHAPTER_TWO_NEW_ABILITIES).toHaveLength(3);
    expect(CHAPTER_TWO_NEW_ABILITIES.every((ability) => ability.neverAutoSolves && ability.neverChangesAnswer && ability.noPunitiveLoss)).toBe(true);
    expect(CHAPTER_TWO_BEHAVIORS).toHaveLength(3);
    expect(CHAPTER_TWO_BEHAVIORS.every((behavior) => behavior.telegraph && behavior.effect && behavior.guaranteedRecovery && behavior.neverChangesAnswer)).toBe(true);
    expect(CHAPTER_TWO_BOSSES).toHaveLength(4);
    expect(CHAPTER_TWO_REPAIRS).toHaveLength(4);
    for (const repair of CHAPTER_TWO_REPAIRS) {
      expect(repair.before.shape).not.toBe(repair.after.shape);
      expect(repair.before.function).not.toBe(repair.after.function);
      expect(repair.before.light).not.toBe(repair.after.light);
      expect(repair.persistence).toBe("local-durable");
      expect(repair.saveField).toBe("repairedObjectIds");
    }
  });

  test("keeps every playable story family relation source-backed and protects visual-only boundaries", () => {
    for (const familyId of CHAPTER_TWO_STORY_FAMILY_IDS) {
      const family = COMPLETE_COMPONENT_FAMILIES.find((candidate) => candidate.id === familyId)!;
      const relations = COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === family.id);
      expect(relations).toHaveLength(family.memberCharacterIds.length);
      expect(relations.every((relation) => relation.sourceIds.length > 0)).toBe(true);
      for (const relation of relations.filter((candidate) => candidate.kind === "modern-visual-link-only")) {
        expect(relation.childFacingClaim).toContain("字形");
        expect(relation.childFacingClaim).toContain("不");
      }
    }
  });
});

describe("Chapter Two deterministic adventure", () => {
  test.each(["light-speaker", "forest-speaker", "ink-companion"] as const)("completes all Chapter Two contracts with %s", (heroId) => {
    const result = simulateChapterTwo(`chapter-two-${heroId}`, heroId);
    expect(result.passed, result.failureCodes.join(",")).toBe(true);
    expect(result.finalState.phase).toBe("chapter-summary");
    expect(result.finalState.discoveredCharacterIds).toEqual(CHAPTER_TWO_STORY_CHARACTER_IDS);
    expect(result.finalState.discoveredFamilyIds).toEqual(CHAPTER_TWO_STORY_FAMILY_IDS);
    expect(result.finalState.selectedAbilityIds).toHaveLength(3);
    expect(result.finalState.triggeredAbilityIds).toHaveLength(3);
    expect(result.finalState.completedBehaviorIds).toHaveLength(3);
    expect(result.finalState.completedBossIds).toHaveLength(4);
    expect(result.finalState.repairedObjectIds).toHaveLength(4);
    expect(result.finalState.bossEvidence.every((evidence) => evidence.allPreviouslyIntroduced)).toBe(true);
    expect(replayChapterTwoActions(`chapter-two-${heroId}`, heroId, result.actions)).toEqual(result.finalState);
  });

  test("rejects a wrong component without changing the real placements or answer", () => {
    let state = createChapterTwoState("wrong-component");
    state = reduceChapterTwoState(state, { type: "start" });
    state = reduceChapterTwoState(state, { type: "choose-ability", abilityId: state.abilityOfferIds[0] });
    state = reduceChapterTwoState(state, { type: "begin-behavior" });
    state = reduceChapterTwoState(state, { type: "recover-behavior" });
    const distractor = state.hand.find((card) => card.kind === "distractor")!;
    const slot = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === state.currentCharacterId)!.components[0].slotId;
    state = reduceChapterTwoState(state, { type: "place-card", cardId: distractor.id, slotId: slot });
    expect(state.phase).toBe("build");
    expect(state.placements).toEqual([]);
    expect(state.gentleMessage).toContain("进度都保留");
  });

  test("converges deterministically without softlocks across bounded seeds", () => {
    for (let index = 0; index < 40; index += 1) {
      const seed = `chapter-two-coverage-${index}`;
      const first = simulateChapterTwo(seed, index % 2 ? "forest-speaker" : "ink-companion");
      const second = simulateChapterTwo(seed, index % 2 ? "forest-speaker" : "ink-companion");
      expect(first.passed, `${seed}:${first.failureCodes.join(",")}`).toBe(true);
      expect(second.actions).toEqual(first.actions);
      expect(second.finalState).toEqual(first.finalState);
    }
  });

  test("integrates Chapter Two progress into the complete engine and V3 save", () => {
    // This fixture deliberately exercises the unversioned historical action stream.
    const unlocked = updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two"], chapterTwoReplay: { seed: "chapter-two-master:chapter-two", initialHeroId: "light-speaker", actions: [] } });
    const progress = progressSeedFromCompleteSave(unlocked);
    let complete = createCompleteEngineState("chapter-two-master", progress);
    complete = reduceCompleteEngineState(complete, { type: "enter-chapter", chapterId: "chapter-two" });
    const simulation = simulateChapterTwo("chapter-two-master:chapter-two", complete.heroId);
    for (const action of simulation.actions) complete = reduceCompleteEngineState(complete, { type: "chapter-two-action", action });
    expect(complete.completedChapterIds).toContain("chapter-two");
    expect(complete.unlockedChapterIds).toContain("chapter-three");
    const save = syncCompleteSaveFromEngine(createFreshCompleteSave(), complete, "2026-08-20T11:00:00.000Z");
    expect(save.chapterTwoReplay?.actions).toEqual(simulation.actions);
    expect(validateCompleteSave(save)).toEqual(save);
  });
});

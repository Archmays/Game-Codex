import { describe, expect, test } from "vitest";
import { simulateM3Run } from "../../games/hanzi-radical-battle/v2/chapter-one/m3-machine";
import { M4_REPAIR_IDS } from "../../games/hanzi-radical-battle/v2/chapter-one/camp";
import {
  createCompleteEngineState,
  reduceCompleteEngineState,
  replayCompleteEngineActions,
} from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import type { CompleteEngineAction, CompleteEngineProgressSeed } from "../../games/hanzi-radical-battle/complete/core/complete-types";

const FRESH_PROGRESS: CompleteEngineProgressSeed = {
  selectedHeroId: "light-speaker",
  activeChapterId: "chapter-one",
  unlockedChapterIds: ["chapter-one"],
  completedChapterIds: [],
  completedEpisodeIds: [],
  discoveredCharacterIds: [],
  discoveredFamilyIds: [],
  discoveredWordIds: [],
  repairedObjectIds: [],
  selectedAbilityIds: [],
  triggeredAbilityIds: [],
  completedBehaviorIds: [],
  completedBossIds: [],
  chapterOneReplay: null,
  chapterTwoReplay: null,
  chapterThreeReplay: null,
};

describe("complete-edition pure engine and Chapter One adapter", () => {
  test.each(["light-speaker", "forest-speaker", "ink-companion"] as const)("delegates the %s run byte-for-state to the V2 reducer", (heroId) => {
    const seed = `complete-adapter-${heroId}`;
    const legacy = simulateM3Run(seed, heroId);
    expect(legacy.passed).toBe(true);
    const actions: CompleteEngineAction[] = [
      { type: "select-hero", heroId },
      { type: "enter-chapter-one", seed },
      ...legacy.actions.map((action) => ({ type: "chapter-one-action" as const, action })),
    ];
    const final = actions.reduce(reduceCompleteEngineState, createCompleteEngineState("complete-edition"));
    expect(final.chapterOneRun?.state).toEqual(legacy.finalState);
    expect(final.chapterOneRun?.actions).toEqual(legacy.actions);
    expect(final.completedChapterIds).toContain("chapter-one");
    expect(final.unlockedChapterIds).toEqual(["chapter-one", "chapter-two"]);
    expect(final.completedEpisodeIds).toEqual([
      "chapter-one:glimmer-grove",
      "chapter-one:echo-garden",
      "chapter-one:wind-trail",
      "chapter-one:ink-king-core",
    ]);
    expect(final.repairedObjectIds).toEqual(M4_REPAIR_IDS);
    expect(new Set(final.discoveredCharacterIds).size).toBe(final.discoveredCharacterIds.length);
    expect(replayCompleteEngineActions("complete-edition", FRESH_PROGRESS, actions)).toEqual(final);
  });

  test("keeps a locked chapter inert without losing any progress", () => {
    const before = createCompleteEngineState();
    const after = reduceCompleteEngineState(before, { type: "enter-chapter", chapterId: "chapter-three" });
    expect(after.screen).toBe("world");
    expect(after.discoveredCharacterIds).toEqual(before.discoveredCharacterIds);
    expect(after.repairedObjectIds).toEqual(before.repairedObjectIds);
    expect(after.gentleMessage).toContain("进度都会保留");
  });
});

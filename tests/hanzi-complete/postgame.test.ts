import { describe, expect, test } from "vitest";
import { createCompleteEngineState, reduceCompleteEngineState } from "../../games/hanzi-radical-battle/complete/core/complete-machine";
import { COMPLETE_POSTGAME_MODES } from "../../games/hanzi-radical-battle/complete/core/world-contracts";
import {
  COMPLETE_POSTGAME_MODE_DEFINITIONS,
  createCompletePostgamePlan,
} from "../../games/hanzi-radical-battle/complete/postgame/contracts";
import {
  createCompletePostgameRun,
  getCompletePostgameBuildCards,
  reduceCompletePostgameRun,
  replayCompletePostgameRun,
  simulateCompletePostgame,
  type CompletePostgameAction,
  type CompletePostgameRun,
} from "../../games/hanzi-radical-battle/complete/postgame/engine";
import {
  createFreshCompleteSave,
  progressSeedFromCompleteSave,
  syncCompleteSaveFromEngine,
  updateCompleteSave,
} from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { COMPLETE_COMPONENT_FAMILIES } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";

function buildCurrentCharacter(run: CompletePostgameRun): CompletePostgameRun {
  const target = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === run.state.currentCharacterId)!;
  for (const component of target.components) {
    const card = getCompletePostgameBuildCards(run).find((candidate) => candidate.placementInstanceId === component.instanceId)!;
    run = reduceCompletePostgameRun(run, { type: "place-card", cardId: card.id, slotId: component.slotId });
  }
  return run;
}

describe("complete-edition postgame", () => {
  test("defines exactly three calm, six-round modes with three equal offers", () => {
    expect(COMPLETE_POSTGAME_MODES).toEqual(["free-adventure", "component-trails", "word-resonance"]);
    expect(COMPLETE_POSTGAME_MODE_DEFINITIONS).toHaveLength(3);
    for (const mode of COMPLETE_POSTGAME_MODE_DEFINITIONS) {
      expect(mode).toMatchObject({ estimatedMinutes: [8, 12], roundCount: 6, offersPerRound: 3, noRarity: true, noLoss: true, noTimeLimit: true });
      const plan = createCompletePostgamePlan(`contracts-${mode.id}`, "light-speaker", mode.id);
      expect(plan.rounds).toHaveLength(6);
      expect(plan.rounds.every((round) => round.offers.length === 3)).toBe(true);
    }
  });

  test("binds each mode to the complete authoritative pool", () => {
    expect(createCompletePostgamePlan("free-pool", "forest-speaker", "free-adventure").poolIds).toHaveLength(72);
    const families = createCompletePostgamePlan("family-pool", "forest-speaker", "component-trails");
    expect(new Set(families.poolIds)).toEqual(new Set(COMPLETE_COMPONENT_FAMILIES.map((family) => family.id)));
    expect(new Set(families.rounds.flatMap((round) => round.offers.map((offer) => offer.targetId)))).toEqual(new Set(families.poolIds));
    expect(createCompletePostgamePlan("word-pool", "forest-speaker", "word-resonance").poolIds).toHaveLength(36);
  });

  test.each(COMPLETE_POSTGAME_MODES.flatMap((mode) => (["light-speaker", "forest-speaker", "ink-companion"] as const).map((hero) => [mode, hero] as const)))("completes %s as %s without loss or scoring", (mode, hero) => {
    const simulation = simulateCompletePostgame(mode, `postgame-${mode}-${hero}`, hero);
    expect(simulation.passed, simulation.failureCodes.join(",")).toBe(true);
    expect(simulation.finalRun.state.phase).toBe("session-summary");
    expect(simulation.finalRun.state.completedOfferIds).toHaveLength(6);
  });

  test("word resonance requires both complete characters, real order and context with reversible errors", () => {
    let run = createCompletePostgameRun("word-strict-flow", "light-speaker", "word-resonance");
    run = reduceCompletePostgameRun(run, { type: "start" });
    const offer = run.plan.rounds[0].offers[0];
    run = reduceCompletePostgameRun(run, { type: "choose-offer", offerId: offer.id });
    const target = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === run.state.currentCharacterId)!;
    const wrong = getCompletePostgameBuildCards(run).find((card) => card.placementInstanceId === null)!;
    run = reduceCompletePostgameRun(run, { type: "place-card", cardId: wrong.id, slotId: target.components[0].slotId });
    expect(run.state.placements).toEqual([]);
    expect(run.state.gentleMessage).toContain("进度都保留");
    run = buildCurrentCharacter(run);
    expect(run.state.phase).toBe("word-meaning-a");
    run = reduceCompletePostgameRun(run, { type: "continue" });
    run = buildCurrentCharacter(run);
    expect(run.state.phase).toBe("word-meaning-b");
    run = reduceCompletePostgameRun(run, { type: "continue" });
    const word = COMPLETE_WORD_NODES.find((candidate) => candidate.id === run.state.currentWordId)!;
    run = reduceCompletePostgameRun(run, { type: "place-word-character", characterId: word.characterIds[1] });
    expect(run.state.phase).toBe("word-order");
    expect(run.state.wordOrderCharacterIds).toEqual([]);
    run = reduceCompletePostgameRun(run, { type: "place-word-character", characterId: word.characterIds[0] });
    run = reduceCompletePostgameRun(run, { type: "place-word-character", characterId: word.characterIds[1] });
    const wrongContext = COMPLETE_WORD_NODES.find((candidate) => candidate.id !== word.id)!;
    run = reduceCompletePostgameRun(run, { type: "choose-context", wordId: wrongContext.id });
    expect(run.state.phase).toBe("word-context");
    run = reduceCompletePostgameRun(run, { type: "choose-context", wordId: word.id });
    expect(run.state.phase).toBe("round-complete");
    expect(run.state.discoveredWordIds).toEqual([word.id]);
  });

  test("seeded plans and action replays are byte-for-state deterministic", () => {
    const simulation = simulateCompletePostgame("component-trails", "postgame-replay", "ink-companion", "whole-forest", 2);
    const replay = replayCompletePostgameRun("postgame-replay", "ink-companion", "component-trails", "whole-forest", simulation.actions);
    expect(replay).toEqual(simulation.finalRun);
    expect(createCompletePostgamePlan("same", "light-speaker", "word-resonance")).toEqual(createCompletePostgamePlan("same", "light-speaker", "word-resonance"));
  });

  test("seed sweep exposes every one of 36 word nodes while each session remains bounded", () => {
    const offered = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const plan = createCompletePostgamePlan(`word-coverage-${index}`, "light-speaker", "word-resonance");
      plan.rounds.flatMap((round) => round.offers).forEach((offer) => offered.add(offer.targetId));
    }
    expect(offered).toEqual(new Set(COMPLETE_WORD_NODES.map((word) => word.id)));
  });

  test.each(["whole-forest", "story-path", "optional-glow"] as const)("free-adventure %s completes six rounds while discoveries match the actual choices", (band) => {
    for (let offerChoice = 0; offerChoice < 3; offerChoice += 1) {
      const simulation = simulateCompletePostgame("free-adventure", `postgame-band-${band}-${offerChoice}`, "light-speaker", band, offerChoice);
      expect(simulation.failureCodes).toEqual([]);
      expect(simulation.finalRun.state.completedOfferIds).toHaveLength(6);
      const selected = new Set(simulation.finalRun.state.completedOfferIds.map((offerId) => simulation.finalRun.plan.rounds.flatMap((round) => round.offers).find((offer) => offer.id === offerId)!.targetId));
      expect(new Set(simulation.finalRun.state.discoveredCharacterIds)).toEqual(selected);
    }
  });

  test("master engine and V3 save resume the exact postgame replay and count completion once", () => {
    const initial = updateCompleteSave(createFreshCompleteSave(), {
      unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
      completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
      activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "postgame-master", actionCount: 0 },
    });
    let master = createCompleteEngineState("postgame-master", progressSeedFromCompleteSave(initial));
    master = reduceCompleteEngineState(master, { type: "enter-postgame", mode: "free-adventure", seed: "postgame-master-run", band: "whole-forest" });
    const actions: readonly CompletePostgameAction[] = simulateCompletePostgame("free-adventure", "postgame-master-run").actions;
    for (const action of actions) master = reduceCompleteEngineState(master, { type: "postgame-action", action });
    expect(master.postgameRun?.state.phase).toBe("session-summary");
    const saved = syncCompleteSaveFromEngine(initial, master, "2026-08-20T13:30:00.000Z");
    expect(saved.postgameResume?.actions).toEqual(actions);
    expect(saved.minimalLocalEvents.postgameSessions).toBe(1);
    const savedAgain = syncCompleteSaveFromEngine(saved, master, "2026-08-20T13:31:00.000Z");
    expect(savedAgain.minimalLocalEvents.postgameSessions).toBe(1);
    const restored = createCompleteEngineState("postgame-master", progressSeedFromCompleteSave(savedAgain));
    expect(restored.postgameRun).toEqual(master.postgameRun);
  });
});

import { HANZI_MAGIC_V1_ADVENTURES, getV1Encounter } from "../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import type { AbilityId } from "../games/hanzi-radical-battle/v2/golden-slice/content/types";
import { cardOrderForSeed, createV1GameState, stepV1Game, type V1GameState } from "../games/hanzi-radical-battle/v2/v1/machine";

function solveEncounter(state: V1GameState): V1GameState {
  const encounter = getV1Encounter(state.currentEncounterId!);
  for (const card of encounter.cards.filter((entry) => entry.kind === "target")) {
    state = stepV1Game(state, { type: "select-card", cardId: card.id });
    state = stepV1Game(state, { type: "place-card", slotId: card.expectedSlotId! });
    if (state.phase === "boss-interference") state = stepV1Game(state, { type: "clear-interference" });
  }
  expect(state.phase).toBe("composition");
  state = stepV1Game(state, { type: "continue" });
  expect(state.phase).toBe("meaning");
  return stepV1Game(state, { type: "continue" });
}

function finishAdventure(state: V1GameState, abilityId: AbilityId): V1GameState {
  state = stepV1Game(state, { type: "begin-adventure" });
  state = solveEncounter(state);
  state = solveEncounter(state);
  expect(state.phase).toBe("adventure-intro");
  state = stepV1Game(state, { type: "choose-ability", abilityId });
  state = solveEncounter(state);
  state = solveEncounter(state);
  expect(state.phase).toBe("repair");
  state = stepV1Game(state, { type: "repair-world" });
  expect(state.phase).toBe("chapter-report");
  return state;
}

describe("Hanzi Magic V1 deterministic progression", () => {
  it("unlocks three adventures in order, repairs three camp stages, and opens free adventure", () => {
    let state = createV1GameState("v1-three-chapters");
    const abilities: AbilityId[] = ["guardian-light", "star-path", "ink-echo"];
    for (let index = 0; index < HANZI_MAGIC_V1_ADVENTURES.length; index += 1) {
      const adventure = HANZI_MAGIC_V1_ADVENTURES[index];
      state = stepV1Game(state, { type: "start-adventure", adventureId: adventure.id });
      state = finishAdventure(state, abilities[index]);
      expect(state.campRepairStage).toBe(index + 1);
      expect(state.chapterReports.at(-1)).toMatchObject({
        adventureId: adventure.id,
        selectedAbilityId: abilities[index],
        abilityEffectTriggered: true,
        abilityEffectVisible: true,
        abilityEffectStateVerified: true,
      });
      state = stepV1Game(state, { type: "continue-from-report" });
      if (index < 2) expect(state.phase).toBe("camp");
    }
    expect(state.phase).toBe("ending");
    expect(state.discoveredCharacterIds).toHaveLength(12);
    const beforeBook = stepV1Game(state, { type: "finish-ending" });
    expect(beforeBook.phase).toBe("ending");
    state = stepV1Game(state, { type: "open-spellbook" });
    state = stepV1Game(state, { type: "close-spellbook" });
    state = stepV1Game(state, { type: "finish-ending" });
    expect(state.phase).toBe("camp");
    expect(state.completedV1).toBe(true);
    expect(state.freeAdventureUnlocked).toBe(true);
    expect(state.completedAdventureIds).toHaveLength(3);
  });

  it.each(["guardian-light", "star-path", "ink-echo"] as const)("%s changes verified boss state in every adventure", (abilityId) => {
    for (const adventure of HANZI_MAGIC_V1_ADVENTURES) {
      let state = createV1GameState(`ability-${abilityId}-${adventure.id}`, {
        completedAdventureIds: HANZI_MAGIC_V1_ADVENTURES.filter((entry) => entry.sequence < adventure.sequence).map((entry) => entry.id),
        unlockedAdventureIds: HANZI_MAGIC_V1_ADVENTURES.filter((entry) => entry.sequence <= adventure.sequence).map((entry) => entry.id),
        campRepairStage: (adventure.sequence - 1) as 0 | 1 | 2,
      });
      state = stepV1Game(state, { type: "start-adventure", adventureId: adventure.id });
      state = finishAdventure(state, abilityId);
      expect(state.chapterReports.at(-1)).toMatchObject({ abilityEffectTriggered: true, abilityEffectVisible: true, abilityEffectStateVerified: true });
    }
  });

  it("keeps invalid placement gentle, undoable, and hint-only", () => {
    let state = createV1GameState("gentle-path");
    state = stepV1Game(state, { type: "start-adventure", adventureId: "glimmer-path" });
    state = stepV1Game(state, { type: "begin-adventure" });
    const encounter = getV1Encounter(state.currentEncounterId!);
    const distractor = encounter.cards.find((card) => card.kind === "distractor")!;
    state = stepV1Game(state, { type: "select-card", cardId: distractor.id });
    state = stepV1Game(state, { type: "place-card", slotId: "left" });
    state = stepV1Game(state, { type: "select-card", cardId: distractor.id });
    state = stepV1Game(state, { type: "place-card", slotId: "right" });
    expect(state.invalidPlacementCount).toBe(2);
    expect(state.hintLevel).toBe(2);
    expect(state.placements).toEqual([]);
    expect(state.gentleMessage).not.toMatch(/错|败|扣|练习/);
  });

  it("reproduces card order and outcomes from the same seed", () => {
    const encounter = getV1Encounter("v1-yuan");
    expect(cardOrderForSeed(encounter, "same-seed")).toEqual(cardOrderForSeed(encounter, "same-seed"));
    expect(cardOrderForSeed(encounter, "same-seed")).not.toEqual(cardOrderForSeed(encounter, "different-seed"));
  });
});

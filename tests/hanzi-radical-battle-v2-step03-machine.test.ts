import { getGoldenEncounter } from "../games/hanzi-radical-battle/v2/golden-slice/content";
import {
  createGoldenSliceState,
  getLegalGoldenSliceActions,
  stepGoldenSlice,
  type GoldenSliceState,
} from "../games/hanzi-radical-battle/v2/golden-slice/simulation";

function arriveAtBattleOne(): GoldenSliceState {
  let state = createGoldenSliceState({ seed: "fixed-machine-seed" });
  state = stepGoldenSlice(state, { type: "start" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  return stepGoldenSlice(state, { type: "continue" });
}

function finishCurrentEncounter(state: GoldenSliceState): GoldenSliceState {
  let next = stepGoldenSlice(state, { type: "begin-placing" });
  const encounter = getGoldenEncounter(next.currentEncounterId);
  for (const card of encounter.cards.filter((entry) => entry.kind === "target")) {
    next = stepGoldenSlice(next, { type: "place-card", cardId: card.id, slotId: card.expectedSlotId! });
    if (next.phase === "boss_interference") next = stepGoldenSlice(next, { type: "interference-complete" });
  }
  while (next.phase.endsWith("forming") || next.phase.endsWith("casting")) {
    next = stepGoldenSlice(next, { type: "animation-complete" });
  }
  return next;
}

function completeRun(abilityId: "guardian-light" | "star-path" | "ink-echo" = "guardian-light"): GoldenSliceState {
  let state = finishCurrentEncounter(arriveAtBattleOne());
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = finishCurrentEncounter(state);
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "choose-ability", abilityId });
  state = stepGoldenSlice(state, { type: "continue" });
  state = finishCurrentEncounter(state);
  state = stepGoldenSlice(state, { type: "continue" });
  state = finishCurrentEncounter(state);
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "animation-complete" });
  state = stepGoldenSlice(state, { type: "continue" });
  return stepGoldenSlice(state, { type: "finish" });
}

describe("Hanzi V2 STEP 03 pure state machine", () => {
  it("runs the named four-character sequence and exposes only legal end actions", () => {
    const completed = completeRun();
    expect(completed.phase).toBe("run_complete");
    expect(completed.completedEncounterIds).toEqual(["encounter-ming", "encounter-hua", "boss-lin", "boss-xing"]);
    expect(completed.formedCharacterIds).toEqual(["ming", "hua", "lin", "xing"]);
    expect(completed.campRepaired).toBe(true);
    expect(getLegalGoldenSliceActions(completed)).toEqual(["replay", "pause", "open-settings"]);
  });

  it("is deterministic, supports cancel/safe retry, and only permits review jumps in review mode", () => {
    const first = createGoldenSliceState({ seed: "same-seed" });
    const second = createGoldenSliceState({ seed: "same-seed" });
    expect(first.presentedCardIds).toEqual(second.presentedCardIds);

    let state = arriveAtBattleOne();
    state = stepGoldenSlice(state, { type: "begin-placing" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "ming-ri", slotId: "left" });
    state = stepGoldenSlice(state, { type: "cancel-placement" });
    expect(state.board.placements).toEqual({});
    state = stepGoldenSlice(state, { type: "place-card", cardId: "ming-yue", slotId: "left" });
    expect(state.phase).toBe("invalid_feedback");
    state = stepGoldenSlice(state, { type: "safe-retry" });
    expect(state.phase).toBe("safe_retry");
    expect(state.board.placements).toEqual({});
    state = stepGoldenSlice(state, { type: "continue-after-safe-retry" });
    expect(state.phase).toBe("battle_1_placing");
    expect(stepGoldenSlice(state, { type: "review-jump", phase: "spellbook_review" })).toBe(state);

    const review = createGoldenSliceState({ mode: "review" });
    const jumped = stepGoldenSlice(review, { type: "review-jump", phase: "spellbook_review" });
    expect(jumped.phase).toBe("spellbook_review");
  });

  it("pauses/settings preserve state and replays are finite and use a different ability", () => {
    let state = createGoldenSliceState();
    state = stepGoldenSlice(state, { type: "start" });
    state = stepGoldenSlice(state, { type: "pause" });
    expect(state.phase).toBe("paused");
    state = stepGoldenSlice(state, { type: "resume" });
    state = stepGoldenSlice(state, { type: "open-settings" });
    expect(state.phase).toBe("settings_open");
    expect(stepGoldenSlice(state, { type: "close-settings" }).phase).toBe("camp_intro");

    const completed = completeRun("guardian-light");
    expect(stepGoldenSlice(completed, { type: "replay", abilityId: "guardian-light" })).toBe(completed);
    const replay = stepGoldenSlice(completed, { type: "replay", abilityId: "star-path" });
    expect(replay.replayCount).toBe(1);
    expect(replay.selectedAbilityId).toBe("star-path");
    const capped = { ...completed, replayCount: 2 };
    expect(stepGoldenSlice(capped, { type: "replay", abilityId: "ink-echo" })).toBe(capped);
  });
});

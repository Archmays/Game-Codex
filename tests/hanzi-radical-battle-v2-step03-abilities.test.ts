import { getGoldenEncounter } from "../games/hanzi-radical-battle/v2/golden-slice/content";
import { createGoldenSliceState, stepGoldenSlice, type GoldenSliceState } from "../games/hanzi-radical-battle/v2/golden-slice/simulation";

function finishNormalEncounter(state: GoldenSliceState): GoldenSliceState {
  let next = stepGoldenSlice(state, { type: "begin-placing" });
  for (const card of getGoldenEncounter(next.currentEncounterId).cards.filter((entry) => entry.kind === "target")) {
    next = stepGoldenSlice(next, { type: "place-card", cardId: card.id, slotId: card.expectedSlotId! });
  }
  next = stepGoldenSlice(next, { type: "animation-complete" });
  return stepGoldenSlice(next, { type: "animation-complete" });
}

function enterBoss(abilityId: "guardian-light" | "star-path" | "ink-echo"): GoldenSliceState {
  let state = createGoldenSliceState();
  state = stepGoldenSlice(state, { type: "start" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = finishNormalEncounter(state);
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "continue" });
  state = finishNormalEncounter(state);
  state = stepGoldenSlice(state, { type: "continue" });
  state = stepGoldenSlice(state, { type: "choose-ability", abilityId });
  state = stepGoldenSlice(state, { type: "continue" });
  return stepGoldenSlice(state, { type: "begin-placing" });
}

describe("Hanzi V2 STEP 03 ability semantics", () => {
  it("护字光 reveals one correct slot per boss phase after a wrong placement, never a solved card", () => {
    let state = enterBoss("guardian-light");
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "right" });
    expect(state.phase).toBe("invalid_feedback");
    expect(state.hintSlotId).toBe("left");
    expect(state.board.placements).toEqual({});
    expect(state.abilityUsedBossPhaseIds).toEqual(["lin"]);
  });

  it("护字光 keeps an already-correct component when the next attempt uses a distractor", () => {
    let state = enterBoss("guardian-light");
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "left" });
    state = stepGoldenSlice(state, { type: "interference-complete" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-water", slotId: "right" });
    expect(state.phase).toBe("invalid_feedback");
    expect(state.board.placements).toEqual({ left: "lin-mu-left" });
    expect(state.hintSlotId).toBeNull();
    expect(state.abilityUsedBossPhaseIds).toEqual(["lin"]);
    expect(state.copyId).toBe("guardianLight");
  });

  it("星光路标 automatically marks one real empty slot at every boss phase start", () => {
    const state = enterBoss("star-path");
    expect(state.phase).toBe("boss_phase_1_placing");
    expect(state.hintSlotId).toBe("left");
    expect(state.board.placements).toEqual({});
    expect(state.abilityUsedBossPhaseIds).toEqual(["lin"]);
  });

  it("墨点回声 reminds without choosing, removing, or placing a component", () => {
    let state = enterBoss("ink-echo");
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "left" });
    expect(state.phase).toBe("boss_interference");
    state = stepGoldenSlice(state, { type: "use-ability" });
    expect(state.phase).toBe("boss_interference");
    expect(state.board.placements).toEqual({ left: "lin-mu-left" });
    expect(state.formedCharacterIds).not.toContain("lin");
    expect(state.abilityUsedBossPhaseIds).toEqual(["lin"]);
  });
});

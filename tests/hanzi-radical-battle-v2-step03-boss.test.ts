import { GOLDEN_BOSS_INTERFERENCE, GOLDEN_BOSS_PHASES, getGoldenEncounter } from "../games/hanzi-radical-battle/v2/golden-slice/content";
import { createGoldenSliceState, stepGoldenSlice, type GoldenSliceState } from "../games/hanzi-radical-battle/v2/golden-slice/simulation";

function finishNormalEncounter(state: GoldenSliceState): GoldenSliceState {
  let next = stepGoldenSlice(state, { type: "begin-placing" });
  for (const card of getGoldenEncounter(next.currentEncounterId).cards.filter((entry) => entry.kind === "target")) {
    next = stepGoldenSlice(next, { type: "place-card", cardId: card.id, slotId: card.expectedSlotId! });
  }
  next = stepGoldenSlice(next, { type: "animation-complete" });
  return stepGoldenSlice(next, { type: "animation-complete" });
}

function enterLinBoss(abilityId: "guardian-light" | "star-path" | "ink-echo" = "star-path"): GoldenSliceState {
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
  return state;
}

describe("Hanzi V2 STEP 03 two-phase boss", () => {
  it("declares lin then xing with one shared 0.8–1.5s non-solving interference rule", () => {
    expect(GOLDEN_BOSS_PHASES.map((phase) => [phase.id, phase.encounterId, phase.interference, phase.neverAutoSolves])).toEqual([
      ["lin", "boss-lin", "obscure-empty-slot-outlines", true],
      ["xing", "boss-xing", "obscure-empty-slot-outlines", true],
    ]);
    expect(GOLDEN_BOSS_INTERFERENCE).toMatchObject({ minimumDurationMs: 800, maximumDurationMs: 1500, affects: "empty-slot-outlines-only", neverMovesCards: true, neverCompletesCharacter: true });
  });

  it("requires interference completion before advancing lin to the star phase", () => {
    let state = enterLinBoss();
    expect(state.phase).toBe("boss_intro");
    state = stepGoldenSlice(state, { type: "begin-placing" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "left" });
    expect(state.phase).toBe("boss_interference");
    expect(state.bossInterference?.durationMs).toBeGreaterThanOrEqual(800);
    expect(state.bossInterference?.durationMs).toBeLessThanOrEqual(1500);
    state = stepGoldenSlice(state, { type: "interference-complete" });
    expect(state.phase).toBe("boss_phase_1_placing");
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-right", slotId: "right" });
    expect(state.phase).toBe("boss_phase_1_forming");
    state = stepGoldenSlice(state, { type: "animation-complete" });
    state = stepGoldenSlice(state, { type: "continue" });
    expect(state.phase).toBe("boss_phase_2_placing");
    expect(state.currentEncounterId).toBe("boss-xing");
    expect(state.hintSlotId).toBe("top");
  });

  it("retains a correct boss component across visible safe retry and interference recovery", () => {
    let state = enterLinBoss("guardian-light");
    state = stepGoldenSlice(state, { type: "begin-placing" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "right" });
    expect(state.phase).toBe("invalid_feedback");
    state = stepGoldenSlice(state, { type: "safe-retry" });
    expect(state.phase).toBe("safe_retry");
    state = stepGoldenSlice(state, { type: "continue-after-safe-retry" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-left", slotId: "left" });
    expect(state.phase).toBe("boss_interference");
    state = stepGoldenSlice(state, { type: "interference-complete" });
    expect(state.board.placements).toEqual({ left: "lin-mu-left" });
    state = stepGoldenSlice(state, { type: "place-card", cardId: "lin-mu-right", slotId: "right" });
    expect(state.phase).toBe("boss_phase_1_forming");
  });
});

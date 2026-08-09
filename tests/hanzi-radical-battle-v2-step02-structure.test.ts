import {
  DEFAULT_PILOT_SCENARIO,
  PILOT_SCENARIOS,
} from "../games/hanzi-radical-battle/v2/content/pilot-scenarios";
import { createPilotState, stepPilot } from "../games/hanzi-radical-battle/v2/simulation/pilot-machine";
import {
  createStructureBoard,
  placeCard,
  removeCard,
  selectCard,
} from "../games/hanzi-radical-battle/v2/simulation/structure-board";

describe("Hanzi V2 STEP 02 structure board", () => {
  it("places cards by stable instance id and completes only the true spatial structure", () => {
    const empty = createStructureBoard();
    const selected = selectCard(empty, DEFAULT_PILOT_SCENARIO, "ming-ri");
    expect(selected.kind).toBe("selected");
    if (selected.kind !== "selected") return;

    const left = placeCard(selected.board, DEFAULT_PILOT_SCENARIO, "ming-ri", "left");
    expect(left.kind).toBe("placed");
    if (left.kind !== "placed") return;
    expect(left.completed).toBe(false);
    expect(left.board.placements).toEqual({ left: "ming-ri" });

    const right = placeCard(left.board, DEFAULT_PILOT_SCENARIO, "ming-yue", "right");
    expect(right.kind).toBe("placed");
    if (right.kind !== "placed") return;
    expect(right.completed).toBe(true);
    expect(right.board.placements).toEqual({ left: "ming-ri", right: "ming-yue" });
  });

  it("keeps a card recoverable after a wrong position and supports withdrawal", () => {
    const empty = createStructureBoard();
    const selected = selectCard(empty, DEFAULT_PILOT_SCENARIO, "ming-yue");
    expect(selected.kind).toBe("selected");
    if (selected.kind !== "selected") return;
    const wrong = placeCard(selected.board, DEFAULT_PILOT_SCENARIO, "ming-yue", "left");
    expect(wrong).toMatchObject({ kind: "invalid", reason: "wrong-position", suggestedSlotId: "right" });
    expect(wrong.board).toEqual(empty);

    const placed = placeCard(empty, DEFAULT_PILOT_SCENARIO, "ming-ri", "left");
    expect(placed.kind).toBe("placed");
    if (placed.kind !== "placed") return;
    const removed = removeCard(placed.board, DEFAULT_PILOT_SCENARIO, "left");
    expect(removed.kind).toBe("removed");
    expect(removed.board.placements).toEqual({});
  });

  it("uses the same board truth for left-right, top-bottom, and semi-enclosure previews", () => {
    for (const scenario of PILOT_SCENARIOS) {
      let board = createStructureBoard();
      const targets = scenario.cards.filter((card) => card.expectedSlotId);
      targets.forEach((card, index) => {
        const result = placeCard(board, scenario, card.id, card.expectedSlotId!);
        expect(result.kind, scenario.id).toBe("placed");
        if (result.kind !== "placed") return;
        board = result.board;
        expect(result.completed, `${scenario.id}:${index}`).toBe(index === targets.length - 1);
      });
    }
  });

  it("does not let one component instance occupy two positions", () => {
    const first = placeCard(createStructureBoard(), DEFAULT_PILOT_SCENARIO, "ming-ri", "left");
    expect(first.kind).toBe("placed");
    if (first.kind !== "placed") return;
    expect(placeCard(first.board, DEFAULT_PILOT_SCENARIO, "ming-ri", "right")).toMatchObject({
      kind: "invalid",
      reason: "card-already-placed",
    });
    expect(first.board.placements).toEqual({ left: "ming-ri" });
  });

  it("uses a legal warm-retry path, reveals one hint after two retries, then sequences the spell", () => {
    let state = createPilotState();
    state = stepPilot(state, { type: "enter-encounter" });
    state = stepPilot(state, { type: "begin-placing" });
    expect(state.phase).toBe("placing");

    state = stepPilot(state, { type: "place-card", cardId: "ming-yue", slotId: "left" });
    expect(state.phase).toBe("invalid_feedback");
    expect(state.hintSlotId).toBeNull();
    state = stepPilot(state, { type: "feedback-complete" });
    state = stepPilot(state, { type: "place-card", cardId: "ming-yue", slotId: "left" });
    expect(state.phase).toBe("invalid_feedback");
    expect(state.hintSlotId).toBe("right");
    expect(state.events.filter((event) => event.id === "placement_retried")).toHaveLength(2);

    state = stepPilot(state, { type: "feedback-complete" });
    state = stepPilot(state, { type: "place-card", cardId: "ming-ri", slotId: "left" });
    state = stepPilot(state, { type: "place-card", cardId: "ming-yue", slotId: "right" });
    expect(state.phase).toBe("forming_character");

    const phases = [];
    for (let index = 0; index < 5; index += 1) {
      state = stepPilot(state, { type: "animation-complete" });
      phases.push(state.phase);
    }
    expect(phases).toEqual([
      "casting_spell",
      "monster_cleared",
      "returning_to_camp",
      "camp_repaired",
      "spellbook",
    ]);
    state = stepPilot(state, { type: "finish" });
    expect(state.phase).toBe("complete");
    expect(state.events.map((event) => event.id)).toEqual(
      expect.arrayContaining([
        "structure_completed",
        "character_formed",
        "spell_cast",
        "monster_cleared",
        "camp_repaired",
        "spellbook_opened",
        "pilot_completed",
      ]),
    );
  });

  it("ignores actions that are illegal in the current phase", () => {
    const state = createPilotState();
    expect(stepPilot(state, { type: "place-card", cardId: "ming-ri", slotId: "left" })).toBe(state);
    expect(stepPilot(state, { type: "finish" })).toBe(state);
  });
});

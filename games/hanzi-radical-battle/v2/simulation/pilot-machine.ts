import { getPilotScenario } from "../content/pilot-scenarios";
import type { PilotScenario } from "../content/types";
import { appendPilotEvent, type PilotEvent } from "./events";
import {
  createStructureBoard,
  placeCard,
  removeCard,
  selectCard,
  type StructureBoardState,
} from "./structure-board";

export type PilotPhase =
  | "camp_intro"
  | "encounter_intro"
  | "placing"
  | "invalid_feedback"
  | "forming_character"
  | "casting_spell"
  | "monster_cleared"
  | "returning_to_camp"
  | "camp_repaired"
  | "spellbook"
  | "complete";

export interface PilotState {
  phase: PilotPhase;
  scenarioId: string;
  board: StructureBoardState;
  invalidAttempts: number;
  hintSlotId: string | null;
  message: string;
  events: readonly PilotEvent[];
}

export type PilotAction =
  | { type: "enter-encounter" }
  | { type: "begin-placing" }
  | { type: "select-card"; cardId: string }
  | { type: "place-card"; cardId: string; slotId: string }
  | { type: "remove-card"; slotId: string }
  | { type: "show-idle-hint" }
  | { type: "feedback-complete" }
  | { type: "animation-complete" }
  | { type: "open-spellbook" }
  | { type: "finish" }
  | { type: "reset"; scenarioId?: string };

export function createPilotState(scenarioId = "pilot-ming-left-right"): PilotState {
  getPilotScenario(scenarioId);
  return {
    phase: "camp_intro",
    scenarioId,
    board: createStructureBoard(),
    invalidAttempts: 0,
    hintSlotId: null,
    message: "营地的灯暗了。跟着墨点去看看吧。",
    events: appendPilotEvent([], "pilot_opened"),
  };
}

function firstEmptyTargetSlot(state: PilotState, scenario: PilotScenario): string | null {
  return scenario.slots.find((slot) => !state.board.placements[slot.id])?.id ?? null;
}

function animationNext(phase: PilotPhase): PilotPhase | null {
  const transitions: Partial<Record<PilotPhase, PilotPhase>> = {
    forming_character: "casting_spell",
    casting_spell: "monster_cleared",
    monster_cleared: "returning_to_camp",
    returning_to_camp: "camp_repaired",
    camp_repaired: "spellbook",
  };
  return transitions[phase] ?? null;
}

export function stepPilot(state: PilotState, action: PilotAction): PilotState {
  const scenario = getPilotScenario(state.scenarioId);

  if (action.type === "reset") return createPilotState(action.scenarioId ?? state.scenarioId);

  if (action.type === "enter-encounter" && state.phase === "camp_intro") {
    return {
      ...state,
      phase: "encounter_intro",
      message: "一团迷路的墨挡住了光。把字灵放回真实结构位置。",
      events: appendPilotEvent(state.events, "encounter_entered"),
    };
  }

  if (action.type === "begin-placing" && state.phase === "encounter_intro") {
    return { ...state, phase: "placing", message: scenario.prompt };
  }

  if (action.type === "select-card" && state.phase === "placing") {
    const result = selectCard(state.board, scenario, action.cardId);
    if (result.kind !== "selected") return state;
    return {
      ...state,
      board: result.board,
      hintSlotId: null,
      message: "再点一下它真正的位置。",
      events: appendPilotEvent(state.events, "card_selected", action.cardId),
    };
  }

  if (action.type === "place-card" && state.phase === "placing") {
    const result = placeCard(state.board, scenario, action.cardId, action.slotId);
    if (result.kind === "placed") {
      const events = appendPilotEvent(state.events, "card_placed", `${action.cardId}:${action.slotId}`);
      if (result.completed) {
        return {
          ...state,
          phase: "forming_character",
          board: result.board,
          hintSlotId: null,
          message: "位置对上了——看，字正在醒来。",
          events: appendPilotEvent(events, "structure_completed"),
        };
      }
      return {
        ...state,
        board: result.board,
        hintSlotId: null,
        message: "这个位置亮起来了，再找另一个。",
        events,
      };
    }

    if (result.kind !== "invalid") return state;

    const invalidAttempts = state.invalidAttempts + 1;
    return {
      ...state,
      phase: "invalid_feedback",
      board: result.board,
      invalidAttempts,
      hintSlotId: invalidAttempts >= 2 ? result.suggestedSlotId : null,
      message: "这里还没对上。字灵没有丢，我们换个位置看看。",
      events: appendPilotEvent(state.events, "placement_retried", result.reason),
    };
  }

  if (action.type === "remove-card" && state.phase === "placing") {
    const result = removeCard(state.board, scenario, action.slotId);
    return result.kind === "removed"
      ? { ...state, board: result.board, hintSlotId: null, message: "拿回来了，可以重新放。" }
      : state;
  }

  if (action.type === "show-idle-hint" && state.phase === "placing") {
    return {
      ...state,
      hintSlotId: firstEmptyTargetSlot(state, scenario),
      message: "看一看发光的位置，它在等对应的字灵。",
    };
  }

  if (action.type === "feedback-complete" && state.phase === "invalid_feedback") {
    return { ...state, phase: "placing" };
  }

  if (action.type === "animation-complete") {
    const phase = animationNext(state.phase);
    if (!phase) return state;
    const eventByPhase: Partial<Record<PilotPhase, PilotEvent["id"]>> = {
      forming_character: "character_formed",
      casting_spell: "spell_cast",
      monster_cleared: "monster_cleared",
      returning_to_camp: "camp_repaired",
      camp_repaired: "spellbook_opened",
    };
    const messages: Partial<Record<PilotPhase, string>> = {
      casting_spell: "明，míng。明亮的“明”。光从完整的字里出发。",
      monster_cleared: "“明”的光把迷墨轻轻吹散了。",
      returning_to_camp: "光沿着小路回到营地。",
      camp_repaired: "灯亮了。你组成的字真的改变了这里。",
      spellbook: "“明”住进了字灵书。",
    };
    const eventId = eventByPhase[state.phase];
    return {
      ...state,
      phase,
      message: messages[phase] ?? state.message,
      events: eventId ? appendPilotEvent(state.events, eventId) : state.events,
    };
  }

  if (action.type === "open-spellbook" && state.phase === "camp_repaired") {
    return {
      ...state,
      phase: "spellbook",
      message: "“明”住进了字灵书。",
      events: appendPilotEvent(state.events, "spellbook_opened"),
    };
  }

  if (action.type === "finish" && state.phase === "spellbook") {
    return {
      ...state,
      phase: "complete",
      message: "这段小冒险完成了。字灵和营地的光都会留下。",
      events: appendPilotEvent(state.events, "pilot_completed"),
    };
  }

  return state;
}

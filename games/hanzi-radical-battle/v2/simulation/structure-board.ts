import type { PilotScenario } from "../content/types";

export interface StructureBoardState {
  placements: Readonly<Record<string, string>>;
  selectedCardId: string | null;
}

export type BoardResult =
  | { kind: "selected"; board: StructureBoardState }
  | { kind: "placed"; board: StructureBoardState; completed: boolean }
  | { kind: "removed"; board: StructureBoardState }
  | {
      kind: "invalid";
      board: StructureBoardState;
      reason: "unknown-card" | "unknown-slot" | "slot-occupied" | "card-already-placed" | "wrong-position";
      suggestedSlotId: string | null;
    };

export function createStructureBoard(): StructureBoardState {
  return { placements: {}, selectedCardId: null };
}

export function selectCard(
  board: StructureBoardState,
  scenario: PilotScenario,
  cardId: string,
): BoardResult {
  const card = scenario.cards.find((item) => item.id === cardId);
  if (!card) {
    return { kind: "invalid", board, reason: "unknown-card", suggestedSlotId: null };
  }
  if (Object.values(board.placements).includes(cardId)) {
    return {
      kind: "invalid",
      board,
      reason: "card-already-placed",
      suggestedSlotId: card.expectedSlotId,
    };
  }
  return { kind: "selected", board: { ...board, selectedCardId: cardId } };
}

export function placeCard(
  board: StructureBoardState,
  scenario: PilotScenario,
  cardId: string,
  slotId: string,
): BoardResult {
  const returnedBoard: StructureBoardState =
    board.selectedCardId === null ? board : { ...board, selectedCardId: null };
  const card = scenario.cards.find((item) => item.id === cardId);
  if (!card) {
    return { kind: "invalid", board: returnedBoard, reason: "unknown-card", suggestedSlotId: null };
  }
  if (!scenario.slots.some((slot) => slot.id === slotId)) {
    return { kind: "invalid", board: returnedBoard, reason: "unknown-slot", suggestedSlotId: card.expectedSlotId };
  }
  if (board.placements[slotId]) {
    return { kind: "invalid", board: returnedBoard, reason: "slot-occupied", suggestedSlotId: card.expectedSlotId };
  }
  if (Object.values(board.placements).includes(cardId)) {
    return { kind: "invalid", board: returnedBoard, reason: "card-already-placed", suggestedSlotId: card.expectedSlotId };
  }
  if (card.expectedSlotId !== slotId) {
    return { kind: "invalid", board: returnedBoard, reason: "wrong-position", suggestedSlotId: card.expectedSlotId };
  }

  const placements = { ...board.placements, [slotId]: cardId };
  const completed = scenario.slots.every((slot) => {
    const expectedCard = scenario.cards.find((item) => item.expectedSlotId === slot.id);
    return expectedCard ? placements[slot.id] === expectedCard.id : false;
  });

  return {
    kind: "placed",
    board: { placements, selectedCardId: null },
    completed,
  };
}

export function removeCard(
  board: StructureBoardState,
  scenario: PilotScenario,
  slotId: string,
): BoardResult {
  if (!scenario.slots.some((slot) => slot.id === slotId)) {
    return { kind: "invalid", board, reason: "unknown-slot", suggestedSlotId: null };
  }
  if (!board.placements[slotId]) {
    return { kind: "removed", board };
  }
  const placements = { ...board.placements };
  delete placements[slotId];
  return { kind: "removed", board: { placements, selectedCardId: null } };
}

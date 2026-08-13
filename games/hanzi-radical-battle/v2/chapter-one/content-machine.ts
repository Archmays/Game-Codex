import { CHAPTER_ONE_CHARACTERS, getChapterOneCharacter } from "./characters";
import { getChapterOneHand } from "./hands";
import { createDeterministicRng } from "./rng";
import type { ChapterEncounterHand, ChapterSlotId } from "./content-types";

export interface ContentCastPlacement {
  readonly cardId: string;
  readonly slotId: ChapterSlotId;
}

export interface ContentCastState {
  readonly seed: string;
  readonly characterId: string;
  readonly handId: string;
  readonly phase: "hand" | "composition" | "meaning";
  readonly placements: readonly ContentCastPlacement[];
  readonly invalidPlacements: number;
  readonly completeGlyphVisible: boolean;
  readonly meaningMagicVisible: boolean;
}

export type ContentCastAction =
  | { readonly type: "place"; readonly cardId: string; readonly slotId: ChapterSlotId }
  | { readonly type: "show-meaning" };

export function createContentCastState(seed: string, characterId: string, variant = 0): ContentCastState {
  const hand = getChapterOneHand(characterId, variant);
  return {
    seed,
    characterId,
    handId: hand.id,
    phase: "hand",
    placements: [],
    invalidPlacements: 0,
    completeGlyphVisible: false,
    meaningMagicVisible: false,
  };
}

export function reduceContentCast(state: ContentCastState, action: ContentCastAction): ContentCastState {
  const hand = getChapterOneHand(state.characterId, Number(state.handId.match(/-v(\d+)$/)?.[1] ?? "0"));
  if (action.type === "show-meaning" && state.phase === "composition") {
    return { ...state, phase: "meaning", meaningMagicVisible: true };
  }
  if (action.type !== "place" || state.phase !== "hand") return state;
  const card = hand.cards.find((entry) => entry.id === action.cardId);
  if (!card || card.kind !== "target" || card.expectedSlotId !== action.slotId || state.placements.some((entry) => entry.slotId === action.slotId || entry.cardId === action.cardId)) {
    return { ...state, invalidPlacements: state.invalidPlacements + 1 };
  }
  const placements = [...state.placements, { cardId: action.cardId, slotId: action.slotId }];
  const complete = hand.cards.filter((entry) => entry.kind === "target").every((target) => placements.some((placement) => placement.cardId === target.id));
  return complete
    ? { ...state, phase: "composition", placements, completeGlyphVisible: true }
    : { ...state, placements };
}

export function simulateContentCast(seed: string, characterId: string, variant = 0): ContentCastState {
  const character = getChapterOneCharacter(characterId);
  const hand = getChapterOneHand(characterId, variant);
  let state = createContentCastState(seed, characterId, variant);
  for (const component of character.orderedComponents) {
    const card = hand.cards.find((entry) => entry.id === component.id)!;
    state = reduceContentCast(state, { type: "place", cardId: card.id, slotId: component.slotId });
  }
  return reduceContentCast(state, { type: "show-meaning" });
}

export interface ContentCoverageRun {
  readonly seed: string;
  readonly castStates: readonly ContentCastState[];
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
}

export function simulateContentCoverageRun(seed: string): ContentCoverageRun {
  const rng = createDeterministicRng(`${seed}:content-coverage`);
  const order = rng.shuffle(CHAPTER_ONE_CHARACTERS);
  const castStates = order.map((character) => simulateContentCast(seed, character.id, rng.nextInt(3)));
  const failureCodes: string[] = [];
  if (new Set(castStates.map((state) => state.characterId)).size !== 36) failureCodes.push("not-all-36-characters-cast");
  if (castStates.some((state) => state.phase !== "meaning" || !state.completeGlyphVisible || !state.meaningMagicVisible || state.invalidPlacements !== 0)) failureCodes.push("cast-did-not-reach-meaning");
  return { seed, castStates, passed: failureCodes.length === 0, failureCodes };
}

export function handForCast(state: ContentCastState): ChapterEncounterHand {
  const variant = Number(state.handId.match(/-v(\d+)$/)?.[1] ?? "0");
  return getChapterOneHand(state.characterId, variant);
}

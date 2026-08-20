import {
  COMPLETE_SLICE_FAMILIES,
  COMPLETE_SLICE_WORDS,
  getCompleteSliceCharacter,
  getCompleteSliceWord,
} from "../content-graph/slice-content";
import type { CompleteSlotId } from "../content-graph/types";

export type CompleteSliceId = "family" | "word";
export type CompleteSlicePhase =
  | "world"
  | "behavior-telegraph"
  | "behavior-effect"
  | "build"
  | "composition"
  | "meaning"
  | "family-inspect"
  | "family-connect"
  | "family-result"
  | "word-order"
  | "word-meaning"
  | "boss-telegraph"
  | "boss-effect"
  | "repair"
  | "complete";

export interface CompleteSliceCard {
  readonly id: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly expectedSlotId: CompleteSlotId | null;
  readonly kind: "target" | "distractor";
}

export interface CompleteSlicePlacement {
  readonly cardId: string;
  readonly slotId: CompleteSlotId;
}

export interface CompleteSliceState {
  readonly sliceId: CompleteSliceId;
  readonly phase: CompleteSlicePhase;
  readonly encounterIndex: number;
  readonly currentCharacterId: string | null;
  readonly currentWordId: string | null;
  readonly wordPart: 0 | 1 | null;
  readonly hand: readonly CompleteSliceCard[];
  readonly placements: readonly CompleteSlicePlacement[];
  readonly selectedCardId: string | null;
  readonly builtCharacterIds: readonly string[];
  readonly discoveredCharacterIds: readonly string[];
  readonly familySelectedCharacterIds: readonly string[];
  readonly wordOrderCharacterIds: readonly string[];
  readonly bossResolved: boolean;
  readonly repairedObjectIds: readonly string[];
  readonly gentleMessage: string;
  readonly actionCount: number;
}

export type CompleteSliceAction =
  | { readonly type: "start" }
  | { readonly type: "begin-behavior" }
  | { readonly type: "recover-behavior" }
  | { readonly type: "select-card"; readonly cardId: string }
  | { readonly type: "place-card"; readonly cardId: string; readonly slotId: CompleteSlotId }
  | { readonly type: "place-selected"; readonly slotId: CompleteSlotId }
  | { readonly type: "undo" }
  | { readonly type: "continue" }
  | { readonly type: "toggle-family-character"; readonly characterId: string }
  | { readonly type: "connect-family" }
  | { readonly type: "select-word-character"; readonly characterId: string };

const FAMILY_BUILD_SEQUENCE = ["char-u60c5", "char-u8bf7", "char-u60c5"] as const;
const FAMILY_MEMBER_IDS = new Set(COMPLETE_SLICE_FAMILIES[0].memberCharacterIds);
const WORD_IDS = COMPLETE_SLICE_WORDS.map((word) => word.id);
const DISTRACTOR_GLYPHS = ["木", "口", "土", "人", "小", "女", "门", "工", "米", "羊", "十", "力"] as const;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function createCompleteSliceHand(characterId: string): CompleteSliceCard[] {
  const character = getCompleteSliceCharacter(characterId);
  const targetGlyphs = new Set(character.components.map((component) => component.glyph));
  const distractors = DISTRACTOR_GLYPHS.filter((glyph) => !targetGlyphs.has(glyph)).slice(0, 3);
  const targets = character.components.map((component) => ({
    id: `${characterId}-target-${component.order}`,
    glyph: component.glyph,
    sourceGlyph: component.sourceGlyph,
    expectedSlotId: component.slotId,
    kind: "target" as const,
  }));
  return [...targets, ...distractors.map((glyph, index) => ({
    id: `${characterId}-distractor-${index + 1}`,
    glyph,
    sourceGlyph: glyph,
    expectedSlotId: null,
    kind: "distractor" as const,
  }))];
}

function prepareBuild(state: CompleteSliceState, characterId: string, wordPart: 0 | 1 | null): CompleteSliceState {
  return {
    ...state,
    phase: "build",
    currentCharacterId: characterId,
    wordPart,
    hand: createCompleteSliceHand(characterId),
    placements: [],
    selectedCardId: null,
    gentleMessage: "把两个字灵送回真实位置。可以拖动，也可以先点字灵再点槽位。",
  };
}

function prepareCurrentWord(state: CompleteSliceState, wordIndex: number, part: 0 | 1): CompleteSliceState {
  const word = getCompleteSliceWord(WORD_IDS[wordIndex]);
  return prepareBuild({ ...state, encounterIndex: wordIndex, currentWordId: word.id }, word.characterIds[part], part);
}

export function createCompleteSliceState(sliceId: CompleteSliceId): CompleteSliceState {
  return {
    sliceId,
    phase: "world",
    encounterIndex: 0,
    currentCharacterId: null,
    currentWordId: sliceId === "word" ? WORD_IDS[0] : null,
    wordPart: null,
    hand: [],
    placements: [],
    selectedCardId: null,
    builtCharacterIds: [],
    discoveredCharacterIds: [],
    familySelectedCharacterIds: [],
    wordOrderCharacterIds: [],
    bossResolved: false,
    repairedObjectIds: [],
    gentleMessage: sliceId === "family" ? "字脉树心在等你唤醒第一条根线。" : "书页港在等两个完整字按真实顺序相遇。",
    actionCount: 0,
  };
}

function counted(state: CompleteSliceState, next: CompleteSliceState): CompleteSliceState {
  return next === state ? state : { ...next, actionCount: state.actionCount + 1 };
}

function placeCard(state: CompleteSliceState, cardId: string, slotId: CompleteSlotId): CompleteSliceState {
  if (state.phase !== "build" || !state.currentCharacterId) return state;
  if (state.placements.some((placement) => placement.slotId === slotId || placement.cardId === cardId)) return state;
  const card = state.hand.find((candidate) => candidate.id === cardId);
  const character = getCompleteSliceCharacter(state.currentCharacterId);
  if (!card || !character.components.some((component) => component.slotId === slotId)) return state;
  if (card.kind !== "target" || card.expectedSlotId !== slotId) {
    return { ...state, selectedCardId: null, gentleMessage: "这张字灵不住在这里。原来的进度都保留，再看看位置。" };
  }
  const placements = [...state.placements, { cardId, slotId }];
  if (placements.length !== character.components.length) {
    return { ...state, placements, selectedCardId: null, gentleMessage: "位置正确，另一道字灵也有自己的家。" };
  }
  const builtCharacterIds = [...state.builtCharacterIds, character.id];
  return {
    ...state,
    phase: "composition",
    placements,
    selectedCardId: null,
    builtCharacterIds,
    discoveredCharacterIds: unique([...state.discoveredCharacterIds, character.id]),
    gentleMessage: `${character.glyph}完整合起来了。`,
  };
}

function continueFamily(state: CompleteSliceState): CompleteSliceState {
  if (state.phase === "composition") return { ...state, phase: "meaning", gentleMessage: "先看完整字的读音、词语和字义魔法。" };
  if (state.phase === "meaning") {
    if (state.encounterIndex === 0) return prepareBuild({ ...state, encounterIndex: 1 }, FAMILY_BUILD_SEQUENCE[1], null);
    if (state.encounterIndex === 1) return { ...state, phase: "family-inspect", currentCharacterId: null, hand: [], placements: [], gentleMessage: "四个已发现字都带着青，但左边不同。" };
    return { ...state, phase: "repair", currentCharacterId: null, hand: [], placements: [], repairedObjectIds: unique([...state.repairedObjectIds, "component-root-heart"]), gentleMessage: "完整字光沿着已确认的青字脉回到树心。" };
  }
  if (state.phase === "family-inspect") return { ...state, phase: "family-connect", familySelectedCharacterIds: [], gentleMessage: "选两个字，再连接它们共有的青。" };
  if (state.phase === "family-result") return { ...state, phase: "boss-telegraph", gentleMessage: "树心守护兽只会用刚才见过的遮槽动作。" };
  if (state.phase === "repair") return { ...state, phase: "complete", gentleMessage: "字脉树心已经保存这次修复。" };
  return state;
}

function continueWord(state: CompleteSliceState): CompleteSliceState {
  if (state.phase === "composition") return { ...state, phase: "meaning", gentleMessage: "先看完整字，再继续组成真实词语。" };
  if (state.phase === "meaning") {
    if (state.wordPart === 0) return prepareCurrentWord(state, state.encounterIndex, 1);
    return { ...state, phase: "word-order", currentCharacterId: null, hand: [], placements: [], wordOrderCharacterIds: [], gentleMessage: "把两个完整字按词语里的真实顺序放好。" };
  }
  if (state.phase === "word-meaning") {
    const nextIndex = state.encounterIndex + 1;
    if (nextIndex >= WORD_IDS.length) {
      return { ...state, phase: "repair", currentWordId: null, wordPart: null, repairedObjectIds: unique([...state.repairedObjectIds, "word-heart"]), gentleMessage: "三个真实词语让万象字心重新发光。" };
    }
    if (nextIndex === 2 && !state.bossResolved) {
      return { ...state, phase: "boss-telegraph", encounterIndex: nextIndex, currentWordId: WORD_IDS[nextIndex], wordPart: null, wordOrderCharacterIds: [], gentleMessage: "书页守护兽只会打乱已经见过的显示，不会改变词序。" };
    }
    return prepareCurrentWord({ ...state, wordOrderCharacterIds: [] }, nextIndex, 0);
  }
  if (state.phase === "repair") return { ...state, phase: "complete", gentleMessage: "词语字心已经保存这次修复。" };
  return state;
}

export function reduceCompleteSliceState(state: CompleteSliceState, action: CompleteSliceAction): CompleteSliceState {
  let next = state;
  switch (action.type) {
    case "start":
      if (state.phase === "world") {
        next = state.sliceId === "family"
          ? { ...state, phase: "behavior-telegraph", gentleMessage: "墨藤先预告：它会让一个空槽暂时变淡。" }
          : prepareCurrentWord(state, 0, 0);
      }
      break;
    case "begin-behavior":
      if (state.phase === "behavior-telegraph") next = { ...state, phase: "behavior-effect", gentleMessage: "一个空槽轮廓变淡，字灵和正确位置没有改变。" };
      else if (state.phase === "boss-telegraph") next = { ...state, phase: "boss-effect", gentleMessage: "守护兽让背景根线绕了一圈，答案和进度仍在原处。" };
      break;
    case "recover-behavior":
      if (state.phase === "behavior-effect") next = prepareBuild(state, FAMILY_BUILD_SEQUENCE[0], null);
      else if (state.phase === "boss-effect") {
        next = state.sliceId === "family"
          ? prepareBuild({ ...state, bossResolved: true, encounterIndex: 2 }, FAMILY_BUILD_SEQUENCE[2], null)
          : prepareCurrentWord({ ...state, bossResolved: true }, state.encounterIndex, 0);
      }
      break;
    case "select-card":
      if (state.phase === "build" && state.hand.some((card) => card.id === action.cardId) && !state.placements.some((placement) => placement.cardId === action.cardId)) {
        next = { ...state, selectedCardId: state.selectedCardId === action.cardId ? null : action.cardId, gentleMessage: "再选它要去的真实槽位。" };
      }
      break;
    case "place-selected":
      if (state.selectedCardId) next = placeCard(state, state.selectedCardId, action.slotId);
      break;
    case "place-card":
      next = placeCard(state, action.cardId, action.slotId);
      break;
    case "undo": {
      if (state.phase === "build" && state.placements.length > 0) {
        next = { ...state, placements: state.placements.slice(0, -1), selectedCardId: null, gentleMessage: "上一步已安全收回。" };
      }
      break;
    }
    case "continue":
      next = state.sliceId === "family" ? continueFamily(state) : continueWord(state);
      break;
    case "toggle-family-character":
      if (state.phase === "family-connect" && FAMILY_MEMBER_IDS.has(action.characterId)) {
        const selected = state.familySelectedCharacterIds.includes(action.characterId)
          ? state.familySelectedCharacterIds.filter((id) => id !== action.characterId)
          : [...state.familySelectedCharacterIds, action.characterId].slice(-2);
        next = { ...state, familySelectedCharacterIds: selected, gentleMessage: selected.length < 2 ? "再选一个同样带青的完整字。" : "两个完整字都选好了，可以连接青字脉。" };
      }
      break;
    case "connect-family":
      if (state.phase === "family-connect") {
        const valid = state.familySelectedCharacterIds.length === 2 && state.familySelectedCharacterIds.every((id) => FAMILY_MEMBER_IDS.has(id));
        next = valid
          ? { ...state, phase: "family-result", discoveredCharacterIds: unique([...state.discoveredCharacterIds, ...state.familySelectedCharacterIds]), gentleMessage: "连接成功：共有青提供读音线索，完整字义仍各不相同。" }
          : { ...state, gentleMessage: "先选两个带青的完整字，再连接。" };
      }
      break;
    case "select-word-character":
      if (state.phase === "word-order" && state.currentWordId) {
        const word = getCompleteSliceWord(state.currentWordId);
        if (!word.characterIds.includes(action.characterId) || state.wordOrderCharacterIds.includes(action.characterId)) break;
        const ordered = [...state.wordOrderCharacterIds, action.characterId];
        if (ordered.length < 2) {
          next = { ...state, wordOrderCharacterIds: ordered, gentleMessage: "第一个字已放好，再选第二个完整字。" };
        } else if (ordered[0] === word.characterIds[0] && ordered[1] === word.characterIds[1]) {
          next = { ...state, phase: "word-meaning", wordOrderCharacterIds: ordered, gentleMessage: `${word.glyphs.join("")}顺序正确，词语魔法亮起来了。` };
        } else {
          next = { ...state, wordOrderCharacterIds: [], gentleMessage: `顺序倒过来了。本局语境要读“${word.glyphs.join("")}”；两个完整字和进度都保留。` };
        }
      }
      break;
  }
  return counted(state, next);
}

export function replayCompleteSliceActions(sliceId: CompleteSliceId, actions: readonly CompleteSliceAction[]): CompleteSliceState {
  return actions.reduce(reduceCompleteSliceState, createCompleteSliceState(sliceId));
}

export function isCompleteSliceAction(value: unknown): value is CompleteSliceAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  const type = action.type;
  if (typeof type !== "string") return false;
  if (["start", "begin-behavior", "recover-behavior", "undo", "continue", "connect-family"].includes(type)) return Object.keys(action).length === 1;
  if (type === "select-card") return Object.keys(action).sort().join("|") === "cardId|type" && typeof action.cardId === "string";
  const slotIds = new Set(["left", "right", "top", "bottom", "outer", "inner"]);
  if (type === "place-selected") return Object.keys(action).sort().join("|") === "slotId|type" && typeof action.slotId === "string" && slotIds.has(action.slotId);
  if (type === "place-card") return Object.keys(action).sort().join("|") === "cardId|slotId|type" && typeof action.cardId === "string" && typeof action.slotId === "string" && slotIds.has(action.slotId);
  if (type === "toggle-family-character" || type === "select-word-character") return Object.keys(action).sort().join("|") === "characterId|type" && typeof action.characterId === "string";
  return false;
}

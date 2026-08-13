import { getHanziRadicalCombination } from "../../game-data";
import { createRevisionHash } from "../content/revision-hash";
import { CHAPTER_ONE_CHARACTERS, CHAPTER_ONE_CONTENT_VERSION } from "./characters";
import { hashSeed } from "./rng";
import type { ChapterEncounterHand, ChapterHandCard } from "./content-types";

const DISTRACTOR_POOL = [
  "氵", "亻", "讠", "木", "口", "女", "土", "扌", "艹", "宀", "日", "月", "火", "心", "贝", "雨",
  "田", "力", "人", "门", "囗", "小", "十", "王", "可", "青", "生", "公", "羊", "采", "子", "才",
] as const;

export interface ChapterHandAuditMatch {
  readonly cardInstanceIds: readonly string[];
  readonly sourceGlyphs: readonly string[];
  readonly resultGlyphs: readonly string[];
}

export interface ChapterHandAudit {
  readonly handId: string;
  readonly characterId: string;
  readonly targetGlyph: string;
  readonly twoCardSubsets: number;
  readonly threeCardSubsets: number;
  readonly permutationsChecked: number;
  readonly matches: readonly ChapterHandAuditMatch[];
  readonly distinctResultGlyphs: readonly string[];
  readonly supportedAnswerCardSets: readonly string[];
  readonly failureCodes: readonly string[];
  readonly passed: boolean;
}

function combinations<T>(items: readonly T[], size: number, start = 0, picked: readonly T[] = []): T[][] {
  if (picked.length === size) return [[...picked]];
  const result: T[][] = [];
  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    result.push(...combinations(items, size, index + 1, [...picked, items[index]]));
  }
  return result;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

export function auditChapterHand(hand: ChapterEncounterHand): ChapterHandAudit {
  const character = CHAPTER_ONE_CHARACTERS.find((entry) => entry.id === hand.characterId);
  if (!character) throw new Error(`Unknown character for hand audit: ${hand.characterId}`);
  const failureCodes: string[] = [];
  const instanceIds = hand.cards.map((card) => card.id);
  if (hand.cards.length !== 5) failureCodes.push("hand-size-not-five");
  if (new Set(instanceIds).size !== 5) failureCodes.push("duplicate-card-instance-id");
  const targetCards = hand.cards.filter((card) => card.kind === "target");
  if (targetCards.length !== character.orderedComponents.length) failureCodes.push("target-cardinality-mismatch");
  for (const component of character.orderedComponents) {
    const card = targetCards.find((entry) => entry.id === component.id);
    if (!card || card.glyph !== component.glyph || card.sourceGlyph !== component.sourceGlyph || card.expectedSlotId !== component.slotId) {
      failureCodes.push(`component-instance-mismatch:${component.id}`);
    }
  }

  const matches: ChapterHandAuditMatch[] = [];
  let permutationsChecked = 0;
  const two = combinations(hand.cards, 2);
  const three = combinations(hand.cards, 3);
  for (const subset of [...two, ...three]) {
    for (const ordered of permutations(subset)) {
      permutationsChecked += 1;
      const combination = getHanziRadicalCombination(ordered.map((card) => card.sourceGlyph));
      if (!combination) continue;
      matches.push({
        cardInstanceIds: ordered.map((card) => card.id),
        sourceGlyphs: ordered.map((card) => card.sourceGlyph),
        resultGlyphs: combination.char.split("/"),
      });
    }
  }

  const distinctResultGlyphs = [...new Set(matches.flatMap((match) => match.resultGlyphs))].sort();
  const supportedAnswerCardSets = [...new Set(matches
    .filter((match) => match.resultGlyphs.includes(character.glyph))
    .map((match) => [...match.cardInstanceIds].sort().join("+")))].sort();
  const expectedAnswerCardSet = [...targetCards.map((card) => card.id)].sort().join("+");
  if (!distinctResultGlyphs.includes(character.glyph)) failureCodes.push("target-not-found-in-mother-library");
  if (distinctResultGlyphs.some((glyph) => glyph !== character.glyph)) failureCodes.push("alternate-mother-library-result");
  if (supportedAnswerCardSets.length !== 1 || supportedAnswerCardSets[0] !== expectedAnswerCardSet) failureCodes.push("alternate-supported-answer-card-set");
  return {
    handId: hand.id,
    characterId: hand.characterId,
    targetGlyph: character.glyph,
    twoCardSubsets: two.length,
    threeCardSubsets: three.length,
    permutationsChecked,
    matches,
    distinctResultGlyphs,
    supportedAnswerCardSets,
    failureCodes,
    passed: failureCodes.length === 0,
  };
}

function candidateHand(characterId: string, variant: number, distractors: readonly string[]): ChapterEncounterHand {
  const character = CHAPTER_ONE_CHARACTERS.find((entry) => entry.id === characterId)!;
  const targets: ChapterHandCard[] = character.orderedComponents.map((component) => ({
    id: component.id,
    glyph: component.glyph,
    sourceGlyph: component.sourceGlyph,
    kind: "target",
    expectedSlotId: component.slotId,
  }));
  const extras: ChapterHandCard[] = distractors.map((glyph, index) => ({
    id: `${character.id}-v${variant}-d${index + 1}-${glyph.codePointAt(0)!.toString(16)}`,
    glyph,
    sourceGlyph: glyph,
    kind: "distractor",
    expectedSlotId: null,
  }));
  const cards = [...targets, ...extras] as unknown as ChapterEncounterHand["cards"];
  const stable = { id: `chapter-one-${character.id}-v${variant}`, characterId, variant, cards };
  return { ...stable, revisionHash: createRevisionHash(CHAPTER_ONE_CONTENT_VERSION, stable) };
}

function generateChapterHand(characterId: string, variant: number, excludedSignatures: ReadonlySet<string>): ChapterEncounterHand {
  const character = CHAPTER_ONE_CHARACTERS.find((entry) => entry.id === characterId)!;
  const targetGlyphs = new Set(character.orderedComponents.flatMap((component) => [component.glyph, component.sourceGlyph]));
  const available = DISTRACTOR_POOL.filter((glyph) => !targetGlyphs.has(glyph));
  const options = combinations(available, 3);
  const offset = hashSeed(`${characterId}:hand:${variant}`) % options.length;
  for (let step = 0; step < options.length; step += 1) {
    const distractors = options[(offset + step) % options.length];
    const signature = [...distractors].sort().join("");
    if (excludedSignatures.has(signature)) continue;
    const hand = candidateHand(characterId, variant, distractors);
    if (auditChapterHand(hand).passed) return hand;
  }
  throw new Error(`Unable to generate a unique five-card hand for ${characterId} variant ${variant}`);
}

function buildAllHands(): readonly ChapterEncounterHand[] {
  return CHAPTER_ONE_CHARACTERS.flatMap((character) => {
    const signatures = new Set<string>();
    return [0, 1, 2].map((variant) => {
      const hand = generateChapterHand(character.id, variant, signatures);
      signatures.add(hand.cards.filter((card) => card.kind === "distractor").map((card) => card.sourceGlyph).sort().join(""));
      return hand;
    });
  });
}

export const CHAPTER_ONE_HANDS: readonly ChapterEncounterHand[] = buildAllHands();

export function getChapterOneHand(characterId: string, variant = 0): ChapterEncounterHand {
  const hand = CHAPTER_ONE_HANDS.find((entry) => entry.characterId === characterId && entry.variant === variant);
  if (!hand) throw new Error(`Unknown Chapter One hand: ${characterId} variant ${variant}`);
  return hand;
}

export function auditAllChapterHands(): readonly ChapterHandAudit[] {
  return CHAPTER_ONE_HANDS.map(auditChapterHand);
}

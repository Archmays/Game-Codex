import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "../content-graph/families";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import type { CompleteSlotId } from "../content-graph/types";

export interface CompleteHandCard {
  readonly id: string;
  readonly glyph: string;
  readonly sourceGlyph: string;
  readonly kind: "target" | "distractor";
  readonly expectedSlotId: CompleteSlotId | null;
}

export interface CompleteHandSolution {
  readonly characterId: string;
  readonly glyph: string;
  readonly assignments: readonly { readonly slotId: CompleteSlotId; readonly cardId: string }[];
}

export type CompleteWordSolveReason = "accepted" | "missing" | "duplicate" | "reverse" | "replacement";

export interface CompleteWordSolveResult {
  readonly accepted: boolean;
  readonly reason: CompleteWordSolveReason;
  readonly expectedCharacterIds: readonly [string, string];
}

const DISTRACTOR_POOL = [...new Set(COMPLETE_CORE_CHARACTER_NODES.flatMap((character) => character.components.map((component) => component.glyph)))]
  .sort((left, right) => (left.codePointAt(0) ?? 0) - (right.codePointAt(0) ?? 0));

function glyphCounts(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function hasRequiredGlyphs(available: ReadonlyMap<string, number>, required: readonly string[]): boolean {
  for (const [glyph, count] of glyphCounts(required)) if ((available.get(glyph) ?? 0) < count) return false;
  return true;
}

function sameSlotShape(left: readonly CompleteSlotId[], right: readonly CompleteSlotId[]): boolean {
  return left.length === right.length && left.every((slot, index) => slot === right[index]);
}

export function enumerateCompleteHandSolutions(targetCharacterId: string, hand: readonly CompleteHandCard[]): CompleteHandSolution[] {
  const target = COMPLETE_CORE_CHARACTER_NODES.find((character) => character.id === targetCharacterId);
  if (!target) throw new Error(`Unknown core character for hand solver: ${targetCharacterId}`);
  const targetSlots = target.components.map((component) => component.slotId);
  const availableCounts = glyphCounts(hand.map((card) => card.glyph));

  return COMPLETE_CORE_CHARACTER_NODES
    .filter((candidate) => sameSlotShape(targetSlots, candidate.components.map((component) => component.slotId)))
    .filter((candidate) => hasRequiredGlyphs(availableCounts, candidate.components.map((component) => component.glyph)))
    .map((candidate) => {
      const unused = [...hand].sort((left, right) => left.id.localeCompare(right.id));
      const assignments = candidate.components.map((component) => {
        const index = unused.findIndex((card) => card.glyph === component.glyph);
        if (index < 0) throw new Error(`Solver lost card instance for ${candidate.glyph}`);
        const [card] = unused.splice(index, 1);
        return { slotId: component.slotId, cardId: card.id };
      });
      return { characterId: candidate.id, glyph: candidate.glyph, assignments };
    });
}

function candidateHand(characterId: string, distractors: readonly [string, string, string]): CompleteHandCard[] {
  const character = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId)!;
  return [
    ...character.components.map((component) => ({
      id: `${character.id}-target-${component.order}`,
      glyph: component.glyph,
      sourceGlyph: component.sourceGlyph,
      kind: "target" as const,
      expectedSlotId: component.slotId,
    })),
    ...distractors.map((glyph, index) => ({
      id: `${character.id}-distractor-${index + 1}`,
      glyph,
      sourceGlyph: glyph,
      kind: "distractor" as const,
      expectedSlotId: null,
    })),
  ];
}

export function createCompleteCharacterHand(characterId: string): CompleteHandCard[] {
  const character = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId);
  if (!character) throw new Error(`Unknown core character for hand generation: ${characterId}`);
  const targetGlyphs = new Set(character.components.map((component) => component.glyph));
  const pool = DISTRACTOR_POOL.filter((glyph) => !targetGlyphs.has(glyph));
  for (let first = 0; first < pool.length - 2; first += 1) {
    for (let second = first + 1; second < pool.length - 1; second += 1) {
      for (let third = second + 1; third < pool.length; third += 1) {
        const hand = candidateHand(characterId, [pool[first], pool[second], pool[third]]);
        const solutions = enumerateCompleteHandSolutions(characterId, hand);
        if (solutions.length === 1 && solutions[0].characterId === characterId) return hand;
      }
    }
  }
  throw new Error(`No unique five-card hand exists for ${character.glyph}`);
}

export function auditCompleteCharacterHands(): readonly { readonly characterId: string; readonly glyph: string; readonly solutionCount: number; readonly passed: boolean }[] {
  return COMPLETE_CORE_CHARACTER_NODES.map((character) => {
    const solutions = enumerateCompleteHandSolutions(character.id, createCompleteCharacterHand(character.id));
    return { characterId: character.id, glyph: character.glyph, solutionCount: solutions.length, passed: solutions.length === 1 && solutions[0].characterId === character.id };
  });
}

export function auditCompleteFamilies(): readonly { readonly familyId: string; readonly memberCount: number; readonly relationCount: number; readonly issues: readonly string[] }[] {
  return COMPLETE_COMPONENT_FAMILIES.map((family) => {
    const relations = COMPLETE_COMPONENT_RELATIONS.filter((relation) => relation.familyId === family.id);
    const issues: string[] = [];
    if (family.memberCharacterIds.length < 2) issues.push("MEMBER_COUNT_LT_2");
    if (relations.length !== family.memberCharacterIds.length) issues.push("RELATION_MEMBER_MISMATCH");
    if (family.relationIds.some((id) => !relations.some((relation) => relation.id === id))) issues.push("BROKEN_RELATION_ID");
    if (relations.some((relation) => relation.sourceIds.length === 0)) issues.push("UNSOURCED_RELATION");
    if (relations.some((relation) => relation.kind === "modern-visual-link-only" && (!relation.childFacingClaim.includes("字形") || !relation.childFacingClaim.includes("不")))) {
      issues.push("VISUAL_ONLY_PROMOTED");
    }
    return { familyId: family.id, memberCount: family.memberCharacterIds.length, relationCount: relations.length, issues };
  });
}

export function solveCompleteWord(wordId: string, selectedCharacterIds: readonly string[]): CompleteWordSolveResult {
  const word = COMPLETE_WORD_NODES.find((candidate) => candidate.id === wordId);
  if (!word) throw new Error(`Unknown complete-edition word: ${wordId}`);
  if (selectedCharacterIds.length !== 2) return { accepted: false, reason: "missing", expectedCharacterIds: word.characterIds };
  if (selectedCharacterIds[0] === selectedCharacterIds[1]) return { accepted: false, reason: "duplicate", expectedCharacterIds: word.characterIds };
  if (selectedCharacterIds[0] === word.characterIds[0] && selectedCharacterIds[1] === word.characterIds[1]) {
    return { accepted: true, reason: "accepted", expectedCharacterIds: word.characterIds };
  }
  if (selectedCharacterIds[0] === word.characterIds[1] && selectedCharacterIds[1] === word.characterIds[0]) {
    return { accepted: false, reason: "reverse", expectedCharacterIds: word.characterIds };
  }
  return { accepted: false, reason: "replacement", expectedCharacterIds: word.characterIds };
}

export function auditCompleteWords(): readonly { readonly wordId: string; readonly glyphs: string; readonly issues: readonly string[] }[] {
  const readingIds = new Set(COMPLETE_CORE_READING_SENSES.map((reading) => reading.id));
  const replacementId = COMPLETE_CORE_CHARACTER_NODES[0].id;
  return COMPLETE_WORD_NODES.map((word) => {
    const issues: string[] = [];
    if (!solveCompleteWord(word.id, word.characterIds).accepted) issues.push("FORWARD_REJECTED");
    if (solveCompleteWord(word.id, [word.characterIds[1], word.characterIds[0]]).accepted) issues.push("REVERSE_ACCEPTED");
    if (solveCompleteWord(word.id, [word.characterIds[0], word.characterIds[0]]).accepted) issues.push("DUPLICATE_ACCEPTED");
    const foreign = word.characterIds.includes(replacementId)
      ? COMPLETE_CORE_CHARACTER_NODES.find((character) => !word.characterIds.includes(character.id))!.id
      : replacementId;
    if (solveCompleteWord(word.id, [word.characterIds[0], foreign]).accepted) issues.push("REPLACEMENT_ACCEPTED");
    if (!word.readingSenseIds.every((id) => readingIds.has(id))) issues.push("MISSING_READING");
    if (!word.pinyin.trim() || !word.shortMeaning.trim() || !word.context.trim() || !word.worldMagic.trim() || !word.sourceNote.trim()) issues.push("INCOMPLETE_CONTENT");
    return { wordId: word.id, glyphs: word.glyphs.join(""), issues };
  });
}

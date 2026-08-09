import { getHanziRadicalCombination } from "../../../game-data";
import { getGoldenCharacter } from "./manifest";
import type { GoldenEncounter, GoldenEncounterId } from "./types";

export const GOLDEN_HAND_AUDIT_SEED = "hanzi-v2-step03-hand-audit-v1";

export interface HandAuditMatch {
  readonly cardInstanceIds: readonly string[];
  readonly glyphs: readonly string[];
  readonly resultGlyphs: readonly string[];
}

export interface GoldenHandAudit {
  readonly schemaVersion: 1;
  readonly seed: typeof GOLDEN_HAND_AUDIT_SEED;
  readonly encounterId: GoldenEncounterId;
  readonly targetGlyph: string;
  readonly cardInstanceIds: readonly string[];
  readonly enumeratedSubsets: { readonly twoCard: number; readonly threeCard: number };
  readonly orderedPermutationsChecked: { readonly twoCard: number; readonly threeCard: number };
  readonly matches: readonly HandAuditMatch[];
  readonly failureCodes: readonly string[];
  readonly passed: boolean;
}

function subsets<T>(items: readonly T[], size: number, start = 0, picked: readonly T[] = []): T[][] {
  if (picked.length === size) return [[...picked]];
  const found: T[][] = [];
  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    found.push(...subsets(items, size, index + 1, [...picked, items[index]]));
  }
  return found;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

export function auditGoldenHand(encounter: GoldenEncounter): GoldenHandAudit {
  const target = getGoldenCharacter(encounter.characterId);
  const failureCodes: string[] = [];
  const ids = encounter.cards.map((card) => card.id);
  if (encounter.cards.length !== 5) failureCodes.push("hand-size-not-five");
  if (new Set(ids).size !== ids.length) failureCodes.push("duplicate-card-instance-id");

  const targetCards = encounter.cards.filter((card) => card.kind === "target");
  if (targetCards.length !== target.components.length) failureCodes.push("target-cardinality-mismatch");
  for (const component of target.components) {
    const card = encounter.cards.find((entry) => entry.id === component.id);
    if (!card || card.glyph !== component.glyph || card.expectedSlotId !== component.slotId) {
      failureCodes.push(`component-instance-mismatch:${component.id}`);
    }
  }

  const matches: HandAuditMatch[] = [];
  const subsetCounts = { twoCard: 0, threeCard: 0 };
  const permutationCounts = { twoCard: 0, threeCard: 0 };
  for (const size of [2, 3] as const) {
    for (const subset of subsets(encounter.cards, size)) {
      if (size === 2) subsetCounts.twoCard += 1;
      else subsetCounts.threeCard += 1;
      for (const ordered of permutations(subset)) {
        if (size === 2) permutationCounts.twoCard += 1;
        else permutationCounts.threeCard += 1;
        const result = getHanziRadicalCombination(ordered.map((card) => card.glyph));
        if (result) {
          matches.push({
            cardInstanceIds: ordered.map((card) => card.id),
            glyphs: ordered.map((card) => card.glyph),
            resultGlyphs: result.char.split("/"),
          });
        }
      }
    }
  }

  const distinctResults = new Set(matches.flatMap((match) => match.resultGlyphs));
  if (matches.length === 0) failureCodes.push("target-not-found-in-v1-library");
  if (distinctResults.size !== 1 || !distinctResults.has(target.glyph)) failureCodes.push("alternate-v1-result");

  return {
    schemaVersion: 1,
    seed: GOLDEN_HAND_AUDIT_SEED,
    encounterId: encounter.id,
    targetGlyph: target.glyph,
    cardInstanceIds: ids,
    enumeratedSubsets: subsetCounts,
    orderedPermutationsChecked: permutationCounts,
    matches,
    failureCodes,
    passed: failureCodes.length === 0,
  };
}

export function auditAllGoldenHands(encounters: readonly GoldenEncounter[]): readonly GoldenHandAudit[] {
  return encounters.map(auditGoldenHand);
}

import { getHanziRadicalCombination } from "../../../game-data";
import { HANZI_MAGIC_V1_ENCOUNTERS, getV1Character, type V1Encounter, type V1EncounterId } from "./adventures";

export interface V1HandAuditMatch {
  readonly cardInstanceIds: readonly string[];
  readonly sourceGlyphs: readonly string[];
  readonly resultGlyphs: readonly string[];
}

export interface V1HandAudit {
  readonly encounterId: V1EncounterId;
  readonly targetGlyph: string;
  readonly twoCardSubsets: number;
  readonly threeCardSubsets: number;
  readonly permutationsChecked: number;
  readonly matches: readonly V1HandAuditMatch[];
  readonly failureCodes: readonly string[];
  readonly passed: boolean;
}

function subsets<T>(items: readonly T[], size: number, start = 0, picked: readonly T[] = []): T[][] {
  if (picked.length === size) return [[...picked]];
  const result: T[][] = [];
  for (let index = start; index <= items.length - (size - picked.length); index += 1) {
    result.push(...subsets(items, size, index + 1, [...picked, items[index]]));
  }
  return result;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]),
  );
}

export function auditV1Hand(encounter: V1Encounter): V1HandAudit {
  const target = getV1Character(encounter.characterId);
  const failureCodes: string[] = [];
  const ids = encounter.cards.map((card) => card.id);
  if (encounter.cards.length !== 5) failureCodes.push("hand-size-not-five");
  if (new Set(ids).size !== ids.length) failureCodes.push("duplicate-card-instance-id");
  const targets = encounter.cards.filter((card) => card.kind === "target");
  if (targets.length !== target.components.length) failureCodes.push("target-cardinality-mismatch");
  for (const component of target.components) {
    const card = targets.find((entry) => entry.id === component.id);
    if (!card || card.glyph !== component.glyph || card.sourceGlyph !== component.sourceGlyph || card.expectedSlotId !== component.slotId) {
      failureCodes.push(`component-instance-mismatch:${component.id}`);
    }
  }

  const matches: V1HandAuditMatch[] = [];
  let permutationsChecked = 0;
  const two = subsets(encounter.cards, 2);
  const three = subsets(encounter.cards, 3);
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
  const distinct = new Set(matches.flatMap((match) => match.resultGlyphs));
  if (!distinct.has(target.glyph)) failureCodes.push("target-not-found-in-mother-library");
  if (distinct.size !== 1 || !distinct.has(target.glyph)) failureCodes.push("alternate-mother-library-result");
  return {
    encounterId: encounter.id,
    targetGlyph: target.glyph,
    twoCardSubsets: two.length,
    threeCardSubsets: three.length,
    permutationsChecked,
    matches,
    failureCodes,
    passed: failureCodes.length === 0,
  };
}

export function auditAllV1Hands(): readonly V1HandAudit[] {
  return HANZI_MAGIC_V1_ENCOUNTERS.map(auditV1Hand);
}

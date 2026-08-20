import { COMPLETE_CORE_CHARACTER_NODES } from "../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../content-graph/families";
import { COMPLETE_CORE_READING_SENSES } from "../content-graph/core-characters";
import { COMPLETE_WORD_NODES } from "../content-graph/words";
import type { CompleteStructure } from "../content-graph/types";

export interface StrokeDataProvider {
  readonly providerId: string;
  getStrokeData(characterId: string): Promise<unknown | null>;
}

export interface CompleteSpellbookEntry {
  readonly id: string;
  readonly glyph: string;
  readonly pinyin: string;
  readonly fixedPhrase: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly structure: CompleteStructure;
  readonly structureLabel: string;
  readonly components: readonly { readonly glyph: string; readonly slotId: string; readonly order: number }[];
  readonly familyLinks: readonly { readonly id: string; readonly name: string; readonly explanation: string }[];
  readonly wordLinks: readonly { readonly id: string; readonly glyphs: string; readonly pinyin: string; readonly shortMeaning: string }[];
  readonly magicName: string;
  readonly magicEffect: string;
  readonly associationDescription: string;
  readonly replayFormation: string;
  readonly replayPronunciation: string;
  readonly replayMeaning: string;
  readonly band: "story-required" | "optional";
  readonly auditBoundary: {
    readonly sourceIds: readonly string[];
    readonly ambiguityRisk: string;
    readonly revisionHash: string;
  };
}

const STRUCTURE_LABELS: Readonly<Record<CompleteStructure, string>> = {
  "left-right": "左右结构",
  "top-bottom": "上下结构",
  "full-enclosure": "全包围结构",
  "semi-enclosure": "半包围结构",
};

export const COMPLETE_SPELLBOOK_ENTRIES = COMPLETE_CORE_CHARACTER_NODES.map((character) => {
  const reading = COMPLETE_CORE_READING_SENSES.find((candidate) => candidate.id === character.readingSenseIds[0]);
  if (!reading) throw new Error(`Spellbook character ${character.id} lacks its fixed reading sense`);
  const familyLinks = COMPLETE_COMPONENT_FAMILIES
    .filter((family) => family.memberCharacterIds.includes(character.id))
    .map((family) => ({ id: family.id, name: family.name, explanation: family.childFacingExplanation }));
  const wordLinks = COMPLETE_WORD_NODES
    .filter((word) => word.characterIds.includes(character.id))
    .map((word) => ({ id: word.id, glyphs: word.glyphs.join(""), pinyin: word.pinyin, shortMeaning: word.shortMeaning }));
  return {
    id: character.id,
    glyph: character.glyph,
    pinyin: reading.pinyin,
    fixedPhrase: reading.fixedPhrase,
    familiarWord: character.familiarWord,
    shortMeaning: character.shortMeaning,
    structure: character.structure,
    structureLabel: STRUCTURE_LABELS[character.structure],
    components: character.components.map((component) => ({ glyph: component.glyph, slotId: component.slotId, order: component.order })),
    familyLinks,
    wordLinks,
    magicName: character.magicName,
    magicEffect: character.magicEffect,
    associationDescription: `把“${character.familiarWord}”的字义想成一道会${character.magicEffect}的柔和字光。这是字义联想，不是字源说明。`,
    replayFormation: `${character.components.map((component) => component.glyph).join(" ＋ ")} → ${character.glyph}`,
    replayPronunciation: `${character.glyph}，${reading.fixedPhrase}`,
    replayMeaning: `${character.familiarWord}：${character.shortMeaning}`,
    band: character.band,
    auditBoundary: { sourceIds: character.sourceIds, ambiguityRisk: character.ambiguityRisk, revisionHash: character.revisionHash },
  } satisfies CompleteSpellbookEntry;
});

if (COMPLETE_SPELLBOOK_ENTRIES.length !== 72 || new Set(COMPLETE_SPELLBOOK_ENTRIES.map((entry) => entry.glyph)).size !== 72) {
  throw new Error("Complete spellbook requires exactly 72 unique core characters");
}

export function getCompleteSpellbookEntry(id: string): CompleteSpellbookEntry {
  const entry = COMPLETE_SPELLBOOK_ENTRIES.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown complete spellbook entry ${id}`);
  return entry;
}

import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "./core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "./families";
import { completeCharacterId, completeComponentId, completeReadingId } from "./ids";
import { COMPLETE_COMPONENT_NODES } from "./manifest";
import { COMPLETE_SOURCE_RECORDS } from "./sources";
import type { CharacterNode, ReadingSense, WordNode } from "./types";
import { COMPLETE_WORD_NODES } from "./words";

const SLICE_GLYPHS = ["清", "晴", "花", "安", "情", "请", "香", "眼", "睛", "静"] as const;
const SLICE_FAMILY_GLYPHS = ["清", "晴", "情", "请"] as const;
const SLICE_WORD_IDS = ["word-flower-fragrance", "word-eyes", "word-quiet"] as const;

function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Missing complete-edition slice projection: ${description}`);
  return value;
}

export const COMPLETE_SLICE_SOURCE_RECORDS = COMPLETE_SOURCE_RECORDS;

export const COMPLETE_SLICE_CHARACTER_NODES = SLICE_GLYPHS.map((glyph) =>
  required(COMPLETE_CORE_CHARACTER_NODES.find((character) => character.glyph === glyph), `character ${glyph}`),
) satisfies readonly CharacterNode[];

const sliceReadingIds = new Set(COMPLETE_SLICE_CHARACTER_NODES.flatMap((character) => character.readingSenseIds));
export const COMPLETE_SLICE_READING_SENSES = COMPLETE_CORE_READING_SENSES.filter((reading) => sliceReadingIds.has(reading.id));

const sliceComponentIds = new Set(COMPLETE_SLICE_CHARACTER_NODES.flatMap((character) => character.components.map((component) => component.componentId)));
sliceComponentIds.add(completeComponentId("青"));
export const COMPLETE_SLICE_COMPONENT_NODES = COMPLETE_COMPONENT_NODES.filter((component) => sliceComponentIds.has(component.id));

const sliceFamilyCharacterIds = new Set(SLICE_FAMILY_GLYPHS.map(completeCharacterId));
export const COMPLETE_SLICE_COMPONENT_RELATIONS = COMPLETE_COMPONENT_RELATIONS.filter((relation) =>
  relation.familyId === "family-qing-sound" && sliceFamilyCharacterIds.has(relation.characterId),
);

const canonicalQingFamily = required(COMPLETE_COMPONENT_FAMILIES.find((family) => family.id === "family-qing-sound"), "family-qing-sound");
const sliceFamilyPayload = {
  ...canonicalQingFamily,
  memberCharacterIds: SLICE_FAMILY_GLYPHS.map(completeCharacterId),
  relationIds: COMPLETE_SLICE_COMPONENT_RELATIONS.map((relation) => relation.id),
  childFacingExplanation: "四个字都有“青”这个部件，左边不同，完整字的意思也不同。",
};
export const COMPLETE_SLICE_FAMILIES = [{
  ...sliceFamilyPayload,
  revisionHash: createRevisionHash("hanzi-complete-slice-family-projection-1", sliceFamilyPayload),
}] as const;

export const COMPLETE_SLICE_WORDS = SLICE_WORD_IDS.map((id) =>
  required(COMPLETE_WORD_NODES.find((word) => word.id === id), `word ${id}`),
) satisfies readonly WordNode[];

export const COMPLETE_SLICE_CONTENT_REVISION = createRevisionHash("hanzi-complete-vertical-slices-2", {
  sources: COMPLETE_SLICE_SOURCE_RECORDS,
  characters: COMPLETE_SLICE_CHARACTER_NODES,
  readings: COMPLETE_SLICE_READING_SENSES,
  components: COMPLETE_SLICE_COMPONENT_NODES,
  relations: COMPLETE_SLICE_COMPONENT_RELATIONS,
  families: COMPLETE_SLICE_FAMILIES,
  words: COMPLETE_SLICE_WORDS,
});

export function getCompleteSliceCharacter(id: string): CharacterNode {
  return required(COMPLETE_SLICE_CHARACTER_NODES.find((character) => character.id === id), `character ${id}`);
}

export function getCompleteSliceReading(id: string): ReadingSense {
  return required(COMPLETE_SLICE_READING_SENSES.find((reading) => reading.id === id), `reading ${id}`);
}

export function getCompleteSliceWord(id: string): WordNode {
  return required(COMPLETE_SLICE_WORDS.find((word) => word.id === id), `word ${id}`);
}

export const COMPLETE_SLICE_IDS = {
  characterId: completeCharacterId,
  readingId: completeReadingId,
  componentId: completeComponentId,
  allSourceIds: COMPLETE_SLICE_SOURCE_RECORDS.map((source) => source.id),
} as const;

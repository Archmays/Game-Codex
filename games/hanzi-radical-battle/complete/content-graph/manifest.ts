import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_WHEEL_MANIFEST } from "../wheel-adapter/selection";
import { COMPLETE_AUDIT_DISPOSITIONS } from "./audit-dispositions";
import { buildCompleteComponentNodes } from "./components";
import { COMPLETE_CORE_CHARACTER_NODES, COMPLETE_CORE_READING_SENSES } from "./core-characters";
import { COMPLETE_COMPONENT_FAMILIES, COMPLETE_COMPONENT_RELATIONS } from "./families";
import { COMPLETE_SOURCE_RECORDS } from "./sources";
import type { CharacterNode, PlayableManifest, ReadingSense } from "./types";
import { COMPLETE_WHEEL_ONLY_CHARACTER_NODES, COMPLETE_WHEEL_ONLY_READING_SENSES } from "./wheel-only";
import { COMPLETE_WORD_NODES } from "./words";

export const COMPLETE_CHARACTER_NODES = [
  ...COMPLETE_CORE_CHARACTER_NODES,
  ...COMPLETE_WHEEL_ONLY_CHARACTER_NODES,
] as const satisfies readonly CharacterNode[];

export const COMPLETE_READING_SENSES = [
  ...COMPLETE_CORE_READING_SENSES,
  ...COMPLETE_WHEEL_ONLY_READING_SENSES,
] as const satisfies readonly ReadingSense[];

export const COMPLETE_COMPONENT_NODES = buildCompleteComponentNodes(COMPLETE_CHARACTER_NODES);

const corePayload = {
  id: "hanzi-complete-core-playable",
  version: "3.0.0-content-1",
  characterIds: COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id),
  familyIds: COMPLETE_COMPONENT_FAMILIES.map((family) => family.id),
  wordIds: COMPLETE_WORD_NODES.map((word) => word.id),
  sourceIds: COMPLETE_SOURCE_RECORDS.map((source) => source.id),
};

export const COMPLETE_CORE_PLAYABLE_MANIFEST = {
  ...corePayload,
  revisionHash: createRevisionHash("hanzi-complete-core-playable-1", corePayload),
} satisfies PlayableManifest;

const spellbookPayload = {
  ...corePayload,
  id: "hanzi-complete-spellbook",
};

export const COMPLETE_SPELLBOOK_MANIFEST = {
  ...spellbookPayload,
  revisionHash: createRevisionHash("hanzi-complete-spellbook-1", spellbookPayload),
} satisfies PlayableManifest;

const characterIds = new Set(COMPLETE_CHARACTER_NODES.map((character) => character.id));
const glyphs = new Set(COMPLETE_CHARACTER_NODES.map((character) => character.glyph));
const readingIds = new Set(COMPLETE_READING_SENSES.map((reading) => reading.id));
const componentIds = new Set(COMPLETE_COMPONENT_NODES.map((component) => component.id));
const familyIds = new Set(COMPLETE_COMPONENT_FAMILIES.map((family) => family.id));
const relationIds = new Set(COMPLETE_COMPONENT_RELATIONS.map((relation) => relation.id));
const wordIds = new Set(COMPLETE_WORD_NODES.map((word) => word.id));

if (characterIds.size !== COMPLETE_CHARACTER_NODES.length || glyphs.size !== COMPLETE_CHARACTER_NODES.length) {
  throw new Error("Unified complete-edition content graph requires one CharacterNode per canonical glyph");
}
if (COMPLETE_CORE_PLAYABLE_MANIFEST.characterIds.length !== 72 || new Set(COMPLETE_CORE_PLAYABLE_MANIFEST.characterIds).size !== 72) {
  throw new Error("Complete core playable manifest requires 72 unique characters");
}
if (COMPLETE_COMPONENT_FAMILIES.length !== 18 || familyIds.size !== 18 || COMPLETE_WORD_NODES.length !== 36 || wordIds.size !== 36) {
  throw new Error("Complete graph requires 18 unique families and 36 unique words");
}
if (COMPLETE_WHEEL_MANIFEST.length < 72 || new Set(COMPLETE_WHEEL_MANIFEST.map((record) => record.glyph)).size !== COMPLETE_WHEEL_MANIFEST.length) {
  throw new Error("Complete graph wheel adapter requires at least 72 unique glyphs");
}

for (const character of COMPLETE_CHARACTER_NODES) {
  if (!character.readingSenseIds.every((id) => readingIds.has(id))) throw new Error(`Character ${character.glyph} references a missing ReadingSense`);
  if (!character.components.every((placement) => componentIds.has(placement.componentId))) throw new Error(`Character ${character.glyph} references a missing ComponentNode`);
}
for (const reading of COMPLETE_READING_SENSES) {
  if (!characterIds.has(reading.characterId)) throw new Error(`Reading ${reading.id} references a missing CharacterNode`);
}
for (const relation of COMPLETE_COMPONENT_RELATIONS) {
  if (!familyIds.has(relation.familyId) || !characterIds.has(relation.characterId) || !componentIds.has(relation.componentId)) {
    throw new Error(`Component relation ${relation.id} has a broken graph edge`);
  }
}
for (const family of COMPLETE_COMPONENT_FAMILIES) {
  if (!family.memberCharacterIds.every((id) => characterIds.has(id)) || !family.componentIds.every((id) => componentIds.has(id)) || !family.relationIds.every((id) => relationIds.has(id))) {
    throw new Error(`Component family ${family.id} has a broken graph edge`);
  }
}
for (const word of COMPLETE_WORD_NODES) {
  if (!word.characterIds.every((id) => COMPLETE_CORE_PLAYABLE_MANIFEST.characterIds.includes(id)) || !word.readingSenseIds.every((id) => readingIds.has(id))) {
    throw new Error(`Word ${word.id} has a broken core-character or reading edge`);
  }
}
for (const wheel of COMPLETE_WHEEL_MANIFEST) {
  if (!characterIds.has(wheel.characterNodeId)) throw new Error(`Wheel ${wheel.id} has no unified CharacterNode`);
}

export const COMPLETE_CONTENT_GRAPH_REVISION = createRevisionHash("hanzi-complete-content-graph-1", {
  sources: COMPLETE_SOURCE_RECORDS,
  characters: COMPLETE_CHARACTER_NODES,
  readings: COMPLETE_READING_SENSES,
  components: COMPLETE_COMPONENT_NODES,
  relations: COMPLETE_COMPONENT_RELATIONS,
  families: COMPLETE_COMPONENT_FAMILIES,
  words: COMPLETE_WORD_NODES,
  wheel: COMPLETE_WHEEL_MANIFEST,
  dispositions: COMPLETE_AUDIT_DISPOSITIONS,
});

export function getCompleteCharacter(id: string): CharacterNode {
  const character = COMPLETE_CHARACTER_NODES.find((candidate) => candidate.id === id);
  if (!character) throw new Error(`Unknown complete-edition character: ${id}`);
  return character;
}

export function getCompleteReading(id: string): ReadingSense {
  const reading = COMPLETE_READING_SENSES.find((candidate) => candidate.id === id);
  if (!reading) throw new Error(`Unknown complete-edition reading: ${id}`);
  return reading;
}

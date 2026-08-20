import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_CHAPTER_ONE_CHARACTER_NODES, COMPLETE_CHAPTER_ONE_READING_SENSES } from "../chapters/chapter-one-adapter/content";
import { COMPLETE_NEW_CHARACTER_NODES, COMPLETE_NEW_READING_SENSES } from "./new-characters";

export const COMPLETE_CORE_CHARACTER_NODES = [
  ...COMPLETE_CHAPTER_ONE_CHARACTER_NODES,
  ...COMPLETE_NEW_CHARACTER_NODES,
] as const;

export const COMPLETE_CORE_READING_SENSES = [
  ...COMPLETE_CHAPTER_ONE_READING_SENSES,
  ...COMPLETE_NEW_READING_SENSES,
] as const;

const glyphs = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.glyph));
const ids = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id));
if (COMPLETE_CORE_CHARACTER_NODES.length !== 72 || glyphs.size !== 72 || ids.size !== 72) {
  throw new Error(`Complete core character contract failed: records=${COMPLETE_CORE_CHARACTER_NODES.length} glyphs=${glyphs.size} ids=${ids.size}`);
}

export const COMPLETE_CORE_CHARACTER_REVISION = createRevisionHash("hanzi-complete-core-characters-1", {
  characters: COMPLETE_CORE_CHARACTER_NODES,
  readings: COMPLETE_CORE_READING_SENSES,
});

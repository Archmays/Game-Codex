import { CHAPTER_ONE_CHARACTERS } from "./characters";
import type { ChapterSpellbookEntry } from "./content-types";

export const CHAPTER_ONE_SPELLBOOK: readonly ChapterSpellbookEntry[] = CHAPTER_ONE_CHARACTERS.map((character) => ({
  characterId: character.id,
  glyph: character.glyph,
  pinyinWithToneMarks: character.pinyinWithToneMarks,
  spokenPhrase: character.spokenPhrase,
  familiarWord: character.familiarWord,
  shortMeaning: character.shortMeaning,
  structure: character.structure,
  componentGlyphs: character.orderedComponents.map((component) => component.glyph),
  magicName: character.magicName,
  magicEffect: character.magicEffect,
  meaningAssetKey: character.meaningAssetKey,
  replayFormation: true,
  replayMeaningMagic: true,
}));

export function getChapterOneSpellbookEntry(characterId: string): ChapterSpellbookEntry {
  const entry = CHAPTER_ONE_SPELLBOOK.find((candidate) => candidate.characterId === characterId);
  if (!entry) throw new Error(`Unknown Chapter One spellbook entry: ${characterId}`);
  return entry;
}

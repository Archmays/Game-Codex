import { PINYIN_READING_MANIFEST } from "../../../games/hanzi-radical-battle/complete/support/pinyin/manifest";
import { ENGLISH_V2_WORDS } from "../../../games/english-spell-battle/v2/content/words";
import type { MatchFace, MatchRelation, MemoryMatchPack } from "./types";

function face(id: string, kind: MatchFace["kind"], text: string | undefined, ariaLabel: string, sourceIds: readonly string[], assetUrl?: string): MatchFace {
  return { id, kind, ...(text ? { text } : {}), ...(assetUrl ? { assetUrl } : {}), ariaLabel, sourceIds };
}

function relation(id: string, left: MatchFace, right: MatchFace, explanation: string, sourceIds: readonly string[]): MatchRelation {
  return { id, left, right, explanation, sourceIds, riskFlags: [] };
}

// Every manifest entry passed the canonical record gate; risk flags control activity use,
// not whether the source-backed character may appear in a visual relation pack.
const validated = PINYIN_READING_MANIFEST;
export const PINYIN_STARTER_CHARACTER_IDS = PINYIN_READING_MANIFEST.filter((record) => record.band === "starter").map((record) => record.characterId);
const sourceIds = (record: (typeof PINYIN_READING_MANIFEST)[number]) => [...record.sourceIds, "repo-hanzi-v3-reading-senses"];

const sameGlyph = validated.map((record) => relation(
  `same-glyph:${record.characterId}`,
  face(`glyph-a:${record.characterId}`, "glyph", record.glyph, `汉字 ${record.glyph}，第一张`, sourceIds(record)),
  face(`glyph-b:${record.characterId}`, "glyph", record.glyph, `汉字 ${record.glyph}，第二张`, sourceIds(record)),
  `两张都是“${record.glyph}”。`, sourceIds(record),
));

const seenPinyin = new Set<string>();
const glyphPinyin = validated.filter((record) => {
  if (seenPinyin.has(record.citationPinyinMarked)) return false;
  seenPinyin.add(record.citationPinyinMarked);
  return true;
}).map((record) => relation(
  `glyph-pinyin:${record.characterId}`,
  face(`glyph:${record.characterId}`, "glyph", record.glyph, `汉字 ${record.glyph}`, sourceIds(record)),
  face(`pinyin:${record.characterId}`, "pinyin", record.citationPinyinMarked, `${record.fixedPhrase}的拼音 ${record.citationPinyinMarked}`, sourceIds(record)),
  `“${record.glyph}”在“${record.fixedPhrase}”里读 ${record.citationPinyinMarked}。`, sourceIds(record),
));

const seenPhrase = new Set<string>();
const glyphPhrase = validated.filter((record) => {
  const phrase = record.fixedPhrase.replace(/^.*?[，,]\s*/, "");
  if (seenPhrase.has(phrase)) return false;
  seenPhrase.add(phrase);
  return true;
}).map((record) => relation(
  `glyph-phrase:${record.characterId}`,
  face(`glyph:${record.characterId}`, "glyph", record.glyph, `汉字 ${record.glyph}`, sourceIds(record)),
  face(`phrase:${record.characterId}`, "phrase", record.fixedPhrase.replace(/^.*?[，,]\s*/, ""), `含有${record.glyph}的词语 ${record.fixedPhrase}`, sourceIds(record)),
  `“${record.glyph}”和“${record.fixedPhrase.replace(/^.*?[，,]\s*/, "")}”是一对。`, sourceIds(record),
));

function revision(relations: readonly MatchRelation[]): string {
  let hash = 2166136261;
  for (const item of relations) for (const char of `${item.id}:${item.left.text}:${item.right.text}`) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const CHINESE_MEMORY_PACKS: readonly MemoryMatchPack[] = [
  { id: "same-glyph", title: "同字寻踪", subject: "chinese", relationType: "glyph-same-glyph", defaultPairCount: 6, relations: sameGlyph, revisionHash: revision(sameGlyph) },
  { id: "glyph-pinyin", title: "字音回声", subject: "chinese", relationType: "glyph-citation-pinyin", defaultPairCount: 6, relations: glyphPinyin, revisionHash: revision(glyphPinyin) },
  { id: "glyph-phrase", title: "词境相认", subject: "chinese", relationType: "glyph-fixed-phrase", defaultPairCount: 6, relations: glyphPhrase, revisionHash: revision(glyphPhrase) },
] as const;

const englishMeaningImages = ENGLISH_V2_WORDS.filter((word) => word.storyBand === "story-core" && word.visualKind === "asset").map((word) => relation(
  `english-word-image:${word.id}`,
  face(`english-word:${word.id}`, "text", word.displayWord, `English word ${word.displayWord}`, word.sourceIds),
  face(`english-image:${word.id}`, "meaning-image", undefined, word.imageBrief, word.sourceIds, `./assets/english-world/words/${word.lemma}.webp`),
  `${word.displayWord} means ${word.childDefinitionEn}`,
  word.sourceIds,
));

export const ENGLISH_MEMORY_PACKS: readonly MemoryMatchPack[] = [
  { id: "english-word-image", title: "词与图相认", subject: "english", relationType: "english-word-meaning-image", defaultPairCount: 6, relations: englishMeaningImages, revisionHash: revision(englishMeaningImages) },
] as const;

export const MEMORY_MATCH_PACKS: readonly MemoryMatchPack[] = [...CHINESE_MEMORY_PACKS, ...ENGLISH_MEMORY_PACKS];

export function getMemoryPack(id: string | undefined): MemoryMatchPack {
  return MEMORY_MATCH_PACKS.find((pack) => pack.id === id) ?? CHINESE_MEMORY_PACKS[0];
}

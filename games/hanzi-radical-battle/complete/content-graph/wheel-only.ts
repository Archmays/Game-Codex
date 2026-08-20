import { createRevisionHash } from "../../v2/content/revision-hash";
import { COMPLETE_WHEEL_MANIFEST } from "../wheel-adapter/selection";
import { COMPLETE_CORE_CHARACTER_NODES } from "./core-characters";
import { completeCharacterId, completeComponentId, completeReadingId, completeUnicodeCodePoint, slotsForStructure } from "./ids";
import type { CharacterNode, CompleteStructure, ReadingSense } from "./types";

const coreGlyphs = new Set(COMPLETE_CORE_CHARACTER_NODES.map((character) => character.glyph));

export const COMPLETE_WHEEL_ONLY_CHARACTER_NODES = COMPLETE_WHEEL_MANIFEST
  .filter((record) => !coreGlyphs.has(record.glyph))
  .map((record) => {
    const structure = record.structure as CompleteStructure;
    const slots = slotsForStructure(structure);
    const id = completeCharacterId(record.glyph);
    const payload = {
      id,
      glyph: record.glyph,
      unicodeCodePoint: completeUnicodeCodePoint(record.glyph),
      chapterId: null,
      band: "legacy-wheel-only" as const,
      worldTag: `legacy-wheel-${record.sourceGradeId}`,
      structure,
      components: record.orderedComponents.map((glyph, index) => ({
        instanceId: `${id}-component-${index + 1}`,
        componentId: completeComponentId(glyph),
        glyph,
        sourceGlyph: glyph,
        slotId: slots[index],
        order: (index + 1) as 1 | 2,
        role: "uncertain" as const,
      })),
      readingSenseIds: [completeReadingId(record.glyph)],
      familiarWord: record.familiarWord,
      shortMeaning: record.shortMeaning,
      illustrationBrief: record.illustrationBrief,
      magicName: `${record.glyph}字卷回声`,
      magicEffect: `“${record.familiarWord}”的柔和字义光在字轮中点亮真实结构。`,
      meaningImageDisclaimer: "这是字义联想，不是字源说明" as const,
      familiarity: "advanced-optional" as const,
      ambiguityRisk: `仅在 legacy-label-only 字轮带和固定词“${record.familiarWord}”中使用；不计入核心 72 字或主线通关。`,
      sourceIds: ["repo-wheel-audit", "unicode-unihan-17", "moe-modern-components", "makemeahanzi-bddc96d"],
      provenance: [`wheel:${record.legacyId}`],
    };
    return { ...payload, revisionHash: createRevisionHash("hanzi-complete-wheel-only-character-1", payload) } satisfies CharacterNode;
  });

export const COMPLETE_WHEEL_ONLY_READING_SENSES = COMPLETE_WHEEL_ONLY_CHARACTER_NODES.map((character) => {
  const wheel = COMPLETE_WHEEL_MANIFEST.find((record) => record.glyph === character.glyph)!;
  return {
    id: completeReadingId(character.glyph),
    characterId: character.id,
    pinyin: wheel.pinyin,
    fixedPhrase: wheel.familiarWord,
    shortMeaning: wheel.shortMeaning,
    pronunciationRisk: "low-in-fixed-phrase",
    sourceIds: ["repo-wheel-audit", "unicode-unihan-17"],
  } satisfies ReadingSense;
});

const wheelOnlyGlyphs = new Set(COMPLETE_WHEEL_ONLY_CHARACTER_NODES.map((character) => character.glyph));
if (wheelOnlyGlyphs.size !== COMPLETE_WHEEL_ONLY_CHARACTER_NODES.length) {
  throw new Error("Complete wheel-only adapter produced duplicate CharacterNodes");
}

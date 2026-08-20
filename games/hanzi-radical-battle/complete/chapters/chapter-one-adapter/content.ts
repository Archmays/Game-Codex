import { CHAPTER_ONE_CHARACTERS } from "../../../v2/chapter-one/characters";
import { completeCharacterId, completeComponentId, completeReadingId } from "../../content-graph/ids";
import type { CharacterNode, ReadingSense } from "../../content-graph/types";

const SEMANTIC_COMPONENTS = new Set(["氵", "艹", "木", "犭", "⻊", "𧾷", "亻", "口", "宀", "囗", "门", "日", "目", "⺮"]);
const PHONETIC_PAIRS = new Set([
  "花:化", "星:生", "草:早", "园:元", "猫:苗", "跑:包", "清:青", "晴:青", "松:公", "河:可", "海:每", "洋:羊",
  "你:尔", "他:也", "唱:昌", "菜:采", "圆:员", "问:门",
]);

function componentRole(glyph: string, component: string): "semantic" | "phonetic" | "uncertain" {
  if (PHONETIC_PAIRS.has(`${glyph}:${component}`)) return "phonetic";
  if (SEMANTIC_COMPONENTS.has(component)) return "semantic";
  return "uncertain";
}

export const COMPLETE_CHAPTER_ONE_CHARACTER_NODES = CHAPTER_ONE_CHARACTERS.map((legacy) => {
  const id = completeCharacterId(legacy.glyph);
  return {
    id,
    glyph: legacy.glyph,
    unicodeCodePoint: legacy.sourceMapping.unicodeCodePoint,
    chapterId: "chapter-one",
    band: "story-required",
    worldTag: legacy.regionId,
    structure: legacy.structure,
    components: legacy.orderedComponents.map((component, index) => ({
      instanceId: `${id}-component-${index + 1}`,
      componentId: completeComponentId(component.glyph),
      glyph: component.glyph,
      sourceGlyph: component.sourceGlyph,
      slotId: component.slotId,
      order: component.order,
      role: componentRole(legacy.glyph, component.glyph),
    })),
    readingSenseIds: [completeReadingId(legacy.glyph)],
    familiarWord: legacy.familiarWord,
    shortMeaning: legacy.shortMeaning,
    illustrationBrief: `继续使用 V2 ${legacy.glyph} 的 ${legacy.meaningAssetKey} 字义联想画面边界。`,
    magicName: legacy.magicName,
    magicEffect: legacy.magicEffect,
    meaningImageDisclaimer: "这是字义联想，不是字源说明",
    familiarity: legacy.familiarityBand,
    ambiguityRisk: legacy.ambiguityRisk,
    sourceIds: ["repo-chapter-one-v2", "unicode-unihan-17", "moe-modern-components"],
    provenance: [`chapter-one:${legacy.id}`, ...(legacy.sourceMapping.formulaAuditSource === "hanzi-wheel" ? [`wheel:${legacy.sourceCombinationKey}`] : [])],
    revisionHash: legacy.revisionHash,
  } satisfies CharacterNode;
});

export const COMPLETE_CHAPTER_ONE_READING_SENSES = CHAPTER_ONE_CHARACTERS.map((legacy) => ({
  id: completeReadingId(legacy.glyph),
  characterId: completeCharacterId(legacy.glyph),
  pinyin: legacy.pinyinWithToneMarks,
  fixedPhrase: legacy.spokenPhrase,
  shortMeaning: legacy.shortMeaning,
  pronunciationRisk: legacy.pronunciationRisk,
  sourceIds: ["repo-chapter-one-v2", "unicode-unihan-17"],
})) satisfies readonly ReadingSense[];

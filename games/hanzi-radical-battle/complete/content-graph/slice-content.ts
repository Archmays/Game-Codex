import { CHAPTER_ONE_CHARACTERS } from "../../v2/chapter-one/characters";
import { createRevisionHash } from "../../v2/content/revision-hash";
import type {
  CharacterNode,
  CompleteSlotId,
  ComponentFamily,
  ComponentNode,
  ComponentRelation,
  ReadingSense,
  SourceRecord,
  WordNode,
} from "./types";

export const COMPLETE_SLICE_SOURCE_RECORDS = [
  {
    id: "repo-chapter-one-v2",
    sourceKind: "repository",
    title: "汉字魔法战 V2 Chapter One canonical manifest",
    version: "content-2",
    location: "games/hanzi-radical-battle/v2/chapter-one/characters.ts",
    supports: ["legacy character identity", "fixed reading", "ordered component placement", "child-facing meaning"],
    limitation: "Supports the shipped V2 product record, not an etymology claim.",
  },
  {
    id: "repo-wheel-audit",
    sourceKind: "repository",
    title: "Frozen wheel source and derived audit",
    version: "raw-sha256-0e47b5d4",
    location: "games/hanzi-radical-battle/v2/wheel-workshop/library",
    supports: ["legacy provenance", "candidate reading", "candidate familiar word", "derived structure audit"],
    limitation: "Historical raw records remain immutable; playable claims come from reviewed derived records.",
  },
  {
    id: "unicode-unihan-17",
    sourceKind: "unicode",
    title: "Unicode 17.0.0 Unihan",
    version: "17.0.0",
    location: "https://www.unicode.org/reports/tr38/",
    supports: ["canonical code point", "Mandarin reading cross-check"],
    limitation: "Does not define child-facing meanings or a single pedagogical decomposition.",
  },
  {
    id: "moe-modern-components",
    sourceKind: "language-standard",
    title: "现代常用字部件及部件名称规范",
    version: "GF 0014-2009",
    location: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/moe_1485/tnull_45766.html",
    supports: ["component naming", "component distinction", "application-oriented decomposition"],
    limitation: "A component standard is not by itself a word-meaning or etymology source.",
  },
  {
    id: "makemeahanzi-bddc96d",
    sourceKind: "structure-crosscheck",
    title: "Make Me a Hanzi dictionary snapshot",
    version: "bddc96d41bef78427ed0e034e9f7e31d71fd1b92",
    location: "https://github.com/skishore/makemeahanzi/tree/bddc96d41bef78427ed0e034e9f7e31d71fd1b92",
    supports: ["IDS and component cross-check"],
    limitation: "Used only as a frozen cross-check; graphics are not copied and it is not a runtime dependency.",
  },
  {
    id: "moe-dictionary-slice-words",
    sourceKind: "dictionary",
    title: "教育部国语辞典简编本与重编国语辞典修订本",
    version: "2021",
    location: "https://dict.concised.moe.edu.tw/",
    supports: ["安静 fixed reading and meaning", "眼睛 fixed reading and meaning", "花香 ordinary meaning context"],
    limitation: "Traditional-form dictionary entries are used to cross-check fixed words; the game retains its simplified-character manifest.",
  },
] as const satisfies readonly SourceRecord[];

const SOURCE_IDS = COMPLETE_SLICE_SOURCE_RECORDS.map((source) => source.id);
const characterId = (glyph: string) => `char-u${glyph.codePointAt(0)!.toString(16)}`;
const readingId = (glyph: string) => `reading-u${glyph.codePointAt(0)!.toString(16)}-primary`;
const componentId = (glyph: string) => `component-u${glyph.codePointAt(0)!.toString(16)}`;

const COMPONENT_LABELS: Readonly<Record<string, string>> = {
  "氵": "三点水", 青: "青", 日: "日", "忄": "竖心旁", "讠": "言字旁", 艹: "草字头", 化: "化",
  禾: "禾", 目: "目", 艮: "艮", 宀: "宝盖头", 女: "女", 争: "争",
};

export const COMPLETE_SLICE_COMPONENT_NODES = Object.entries(COMPONENT_LABELS).map(([glyph, label]) => ({
  id: componentId(glyph),
  glyph,
  label,
  roleLabel: ["氵", "忄", "讠", "艹", "宀"].includes(glyph) ? "component-variant" as const : "whole-character-component" as const,
  sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d"],
})) satisfies readonly ComponentNode[];

interface NewSliceCharacterSeed {
  readonly glyph: string;
  readonly pinyin: string;
  readonly fixedPhrase: string;
  readonly shortMeaning: string;
  readonly chapterId: "chapter-two" | "chapter-three";
  readonly band: "story-required";
  readonly worldTag: string;
  readonly structure: "left-right" | "top-bottom";
  readonly components: readonly [
    { readonly glyph: string; readonly slotId: CompleteSlotId; readonly role: "semantic" | "phonetic" | "uncertain" },
    { readonly glyph: string; readonly slotId: CompleteSlotId; readonly role: "semantic" | "phonetic" | "uncertain" },
  ];
  readonly illustrationBrief: string;
  readonly familiarity: "high" | "near";
  readonly ambiguityRisk: string;
}

const NEW_SLICE_CHARACTER_SEEDS = [
  { glyph: "情", pinyin: "qíng", fixedPhrase: "心情", shortMeaning: "心里的感受", chapterId: "chapter-two", band: "story-required", worldTag: "青字脉", structure: "left-right", components: [{ glyph: "忄", slotId: "left", role: "semantic" }, { glyph: "青", slotId: "right", role: "phonetic" }], illustrationBrief: "一颗柔和心灯随心情改变明暗，不出现文字。", familiarity: "high", ambiguityRisk: "与请、晴、清、睛共享青；必须依靠左部件和完整词语区分。" },
  { glyph: "请", pinyin: "qǐng", fixedPhrase: "请问", shortMeaning: "有礼貌地提出请求", chapterId: "chapter-two", band: "story-required", worldTag: "青字脉", structure: "left-right", components: [{ glyph: "讠", slotId: "left", role: "semantic" }, { glyph: "青", slotId: "right", role: "phonetic" }], illustrationBrief: "伙伴礼貌举手询问，画面不出现对话文字。", familiarity: "high", ambiguityRisk: "与情、晴、清、睛共享青；固定在请问语境。" },
  { glyph: "香", pinyin: "xiāng", fixedPhrase: "花香", shortMeaning: "闻起来让人舒服的气味", chapterId: "chapter-three", band: "story-required", worldTag: "词语花港", structure: "top-bottom", components: [{ glyph: "禾", slotId: "top", role: "uncertain" }, { glyph: "日", slotId: "bottom", role: "uncertain" }], illustrationBrief: "花朵周围有柔和可见香气丝带，不出现鼻子特写。", familiarity: "high", ambiguityRisk: "画面只能表达字义联想，不把禾与日讲成字源。" },
  { glyph: "眼", pinyin: "yǎn", fixedPhrase: "眼睛", shortMeaning: "用来看见事物的身体部位", chapterId: "chapter-three", band: "story-required", worldTag: "观星书港", structure: "left-right", components: [{ glyph: "目", slotId: "left", role: "semantic" }, { glyph: "艮", slotId: "right", role: "phonetic" }], illustrationBrief: "友好角色望向星光，不出现孤立写实眼球。", familiarity: "high", ambiguityRisk: "固定读音 yǎn；不把身体部位做成惊吓视觉。" },
  { glyph: "睛", pinyin: "jīng", fixedPhrase: "眼睛", shortMeaning: "眼睛里帮助看见事物的部分", chapterId: "chapter-three", band: "story-required", worldTag: "青字脉", structure: "left-right", components: [{ glyph: "目", slotId: "left", role: "semantic" }, { glyph: "青", slotId: "right", role: "phonetic" }], illustrationBrief: "角色眼中映出清楚星光，不出现孤立写实眼球。", familiarity: "high", ambiguityRisk: "通常出现在眼睛等固定词中；不把它单独解释成整个视觉器官。" },
  { glyph: "静", pinyin: "jìng", fixedPhrase: "安静", shortMeaning: "没有嘈杂声音，很平稳", chapterId: "chapter-three", band: "story-required", worldTag: "静夜灯街", structure: "left-right", components: [{ glyph: "青", slotId: "left", role: "uncertain" }, { glyph: "争", slotId: "right", role: "uncertain" }], illustrationBrief: "灯街和树叶慢慢安定，声音用静止波纹表示。", familiarity: "high", ambiguityRisk: "青在现代字形中可见，但本切片不把它提升为共同字义或正式声旁教学。" },
] as const satisfies readonly NewSliceCharacterSeed[];

function newCharacter(seed: NewSliceCharacterSeed): CharacterNode {
  const id = characterId(seed.glyph);
  const payload = {
    ...seed,
    id,
    components: seed.components.map((component, index) => ({
      instanceId: `${id}-component-${index + 1}`,
      componentId: componentId(component.glyph),
      glyph: component.glyph,
      sourceGlyph: component.glyph,
      slotId: component.slotId,
      order: (index + 1) as 1 | 2,
      role: component.role,
    })),
  };
  return {
    id,
    glyph: seed.glyph,
    unicodeCodePoint: `U+${seed.glyph.codePointAt(0)!.toString(16).toUpperCase()}`,
    chapterId: seed.chapterId,
    band: seed.band,
    worldTag: seed.worldTag,
    structure: seed.structure,
    components: payload.components,
    readingSenseIds: [readingId(seed.glyph)],
    familiarWord: seed.fixedPhrase,
    shortMeaning: seed.shortMeaning,
    illustrationBrief: seed.illustrationBrief,
    familiarity: seed.familiarity,
    ambiguityRisk: seed.ambiguityRisk,
    sourceIds: ["repo-wheel-audit", "unicode-unihan-17", "moe-modern-components", "makemeahanzi-bddc96d"],
    provenance: ["new-candidate", "vertical-slice"],
    revisionHash: createRevisionHash("hanzi-complete-slice-character-1", payload),
  };
}

const LEGACY_ROLE_BY_GLYPH: Readonly<Record<string, readonly ("semantic" | "phonetic" | "uncertain")[]>> = {
  清: ["semantic", "phonetic"],
  晴: ["semantic", "phonetic"],
  花: ["semantic", "phonetic"],
  安: ["uncertain", "uncertain"],
};

function legacyCharacter(glyph: "清" | "晴" | "花" | "安"): CharacterNode {
  const legacy = CHAPTER_ONE_CHARACTERS.find((record) => record.glyph === glyph);
  if (!legacy) throw new Error(`Missing Chapter One slice character ${glyph}`);
  const id = characterId(glyph);
  return {
    id,
    glyph,
    unicodeCodePoint: legacy.sourceMapping.unicodeCodePoint,
    chapterId: "chapter-one",
    band: "story-required",
    worldTag: legacy.regionId,
    structure: legacy.structure,
    components: legacy.orderedComponents.map((component, index) => ({
      instanceId: `${id}-component-${index + 1}`,
      componentId: componentId(component.glyph),
      glyph: component.glyph,
      sourceGlyph: component.sourceGlyph,
      slotId: component.slotId,
      order: component.order,
      role: LEGACY_ROLE_BY_GLYPH[glyph][index] ?? "uncertain",
    })),
    readingSenseIds: [readingId(glyph)],
    familiarWord: legacy.familiarWord,
    shortMeaning: legacy.shortMeaning,
    illustrationBrief: `继续使用 V2 ${glyph} 的字义联想画面边界。`,
    familiarity: legacy.familiarityBand,
    ambiguityRisk: legacy.ambiguityRisk,
    sourceIds: ["repo-chapter-one-v2", "unicode-unihan-17", "moe-modern-components"],
    provenance: [`chapter-one:${legacy.id}`, "vertical-slice-adapter"],
    revisionHash: legacy.revisionHash,
  };
}

export const COMPLETE_SLICE_CHARACTER_NODES = [
  legacyCharacter("清"),
  legacyCharacter("晴"),
  legacyCharacter("花"),
  legacyCharacter("安"),
  ...NEW_SLICE_CHARACTER_SEEDS.map(newCharacter),
] as const satisfies readonly CharacterNode[];

export const COMPLETE_SLICE_READING_SENSES = COMPLETE_SLICE_CHARACTER_NODES.map((character) => ({
  id: readingId(character.glyph),
  characterId: character.id,
  pinyin: NEW_SLICE_CHARACTER_SEEDS.find((seed) => seed.glyph === character.glyph)?.pinyin
    ?? CHAPTER_ONE_CHARACTERS.find((legacy) => legacy.glyph === character.glyph)!.pinyinWithToneMarks,
  fixedPhrase: NEW_SLICE_CHARACTER_SEEDS.find((seed) => seed.glyph === character.glyph)?.fixedPhrase ?? character.familiarWord,
  shortMeaning: character.shortMeaning,
  pronunciationRisk: "low-in-fixed-phrase",
  sourceIds: character.sourceIds,
})) satisfies readonly ReadingSense[];

export const COMPLETE_SLICE_COMPONENT_RELATIONS = (["清", "晴", "情", "请"] as const).map((glyph) => ({
  id: `relation-qing-${characterId(glyph)}`,
  familyId: "family-qing-sound",
  characterId: characterId(glyph),
  componentId: componentId("青"),
  kind: "phonetic-component",
  childFacingClaim: `${glyph}里有“青”，读音有相近线索；完整字义还要看${glyph}本身。`,
  sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d", "repo-wheel-audit"],
})) satisfies readonly ComponentRelation[];

const qingFamilyPayload = {
  id: "family-qing-sound",
  name: "青的声音字脉",
  band: "story-core" as const,
  componentIds: [componentId("青")],
  memberCharacterIds: (["清", "晴", "情", "请"] as const).map(characterId),
  relationIds: COMPLETE_SLICE_COMPONENT_RELATIONS.map((relation) => relation.id),
  worldRepresentation: "四条金色根线从不同左部件汇入青色树心；每条线保留自己的完整字与意义图标。",
  browserStateId: "slice-family-qing-connected",
  childFacingExplanation: "四个字都有“青”这个部件，左边不同，完整字的意思也不同。",
  sourceIds: ["moe-modern-components", "makemeahanzi-bddc96d", "repo-wheel-audit"],
};

export const COMPLETE_SLICE_FAMILIES = [{
  ...qingFamilyPayload,
  revisionHash: createRevisionHash("hanzi-complete-slice-family-1", qingFamilyPayload),
}] as const satisfies readonly ComponentFamily[];

const WORD_SEEDS = [
  { id: "word-flower-fragrance", glyphs: ["花", "香"], pinyin: "huā xiāng", shortMeaning: "花朵散发的香气", context: "花港里，花香为书页船指出方向。", worldMagic: "金色香气丝带把花灯和书页船连接起来。", reverseOrderStatus: "rejected-not-word" },
  { id: "word-eyes", glyphs: ["眼", "睛"], pinyin: "yǎn jīng", shortMeaning: "用来看见事物的身体部位", context: "观星塔用眼睛找到隐藏的星光。", worldMagic: "两束清楚星光在灯塔顶端会合。", reverseOrderStatus: "rejected-not-word" },
  { id: "word-quiet", glyphs: ["安", "静"], pinyin: "ān jìng", shortMeaning: "没有嘈杂声音，很平稳", context: "灯街安静下来，伙伴能听见远处风铃。", worldMagic: "摇晃的灯影和波纹慢慢停稳。", reverseOrderStatus: "rejected-wrong-context" },
] as const;

export const COMPLETE_SLICE_WORDS = WORD_SEEDS.map((seed) => {
  const payload = {
    ...seed,
    glyphs: seed.glyphs as readonly [string, string],
    characterIds: seed.glyphs.map(characterId) as [string, string],
    readingSenseIds: seed.glyphs.map(readingId) as [string, string],
    band: "story" as const,
    ambiguityRisk: seed.id === "word-quiet" ? "反序“静安”可作专名；本局只接受普通词语语境中的“安静”。" : "反序不作为本局自然词语，拒绝后保留全部进度。",
    sourceIds: ["moe-dictionary-slice-words", "repo-chapter-one-v2", "repo-wheel-audit"],
  };
  return { ...payload, revisionHash: createRevisionHash("hanzi-complete-slice-word-1", payload) };
}) satisfies readonly WordNode[];

export const COMPLETE_SLICE_CONTENT_REVISION = createRevisionHash("hanzi-complete-vertical-slices-1", {
  sources: COMPLETE_SLICE_SOURCE_RECORDS,
  characters: COMPLETE_SLICE_CHARACTER_NODES,
  readings: COMPLETE_SLICE_READING_SENSES,
  components: COMPLETE_SLICE_COMPONENT_NODES,
  relations: COMPLETE_SLICE_COMPONENT_RELATIONS,
  families: COMPLETE_SLICE_FAMILIES,
  words: COMPLETE_SLICE_WORDS,
});

export function getCompleteSliceCharacter(id: string): CharacterNode {
  const character = COMPLETE_SLICE_CHARACTER_NODES.find((record) => record.id === id);
  if (!character) throw new Error(`Unknown complete-edition slice character: ${id}`);
  return character;
}

export function getCompleteSliceReading(id: string): ReadingSense {
  const reading = COMPLETE_SLICE_READING_SENSES.find((record) => record.id === id);
  if (!reading) throw new Error(`Unknown complete-edition slice reading: ${id}`);
  return reading;
}

export function getCompleteSliceWord(id: string): WordNode {
  const word = COMPLETE_SLICE_WORDS.find((record) => record.id === id);
  if (!word) throw new Error(`Unknown complete-edition slice word: ${id}`);
  return word;
}

export const COMPLETE_SLICE_IDS = { characterId, readingId, componentId, allSourceIds: SOURCE_IDS } as const;

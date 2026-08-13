import { HANZI_MAGIC_V1_CHARACTERS } from "../golden-slice/content/adventures";
import { getGoldenCharacter } from "../golden-slice/content/manifest";
import { createRevisionHash } from "../content/revision-hash";
import type {
  ChapterCharacter,
  ChapterCharacterStructure,
  ChapterContentAcceptance,
  ChapterOrderedComponent,
  ChapterRegionId,
  FamiliarityBand,
  PronunciationRisk,
} from "./content-types";

export const CHAPTER_ONE_CONTENT_VERSION = "hanzi-magic-v2-chapter-one-content-2" as const;

interface CharacterSeed {
  readonly id: string;
  readonly glyph: string;
  readonly pinyin: string;
  readonly familiarWord: string;
  readonly shortMeaning: string;
  readonly regionId: ChapterRegionId;
  readonly structure: ChapterCharacterStructure;
  readonly parts: readonly [string, string] | readonly [string, string, string];
  readonly displayParts?: readonly [string, string] | readonly [string, string, string];
  readonly magicName: string;
  readonly magicEffect: string;
  readonly familiarityBand: FamiliarityBand;
  readonly pronunciationRisk?: PronunciationRisk;
  readonly ambiguityRisk: string;
  readonly formulaAuditSource: "existing" | "hanzi-wheel" | "manual-audit";
}

const NEW_CHARACTER_SEEDS = [
  { id: "qing-clear", glyph: "清", pinyin: "qīng", familiarWord: "清水", shortMeaning: "干净、清亮的水", regionId: "glimmer-grove", structure: "left-right", parts: ["氵", "青"], magicName: "清泉澄光", magicEffect: "清泉洗开墨雾，水面变得清亮。", familiarityBand: "near", ambiguityRisk: "青也是完整字；手牌必须防止形成其他氵组合。", formulaAuditSource: "hanzi-wheel" },
  { id: "qing-sunny", glyph: "晴", pinyin: "qíng", familiarWord: "晴天", shortMeaning: "天空没有雨云、很明亮", regionId: "glimmer-grove", structure: "left-right", parts: ["日", "青"], magicName: "晴空光幕", magicEffect: "云层散开，晴光照亮森林小路。", familiarityBand: "high", ambiguityRisk: "与清同含青；必须依靠左部件和真实槽位区分。", formulaAuditSource: "hanzi-wheel" },
  { id: "song", glyph: "松", pinyin: "sōng", familiarWord: "松树", shortMeaning: "四季常青的一种树", regionId: "glimmer-grove", structure: "left-right", parts: ["木", "公"], magicName: "松针守护", magicEffect: "松针展开一圈柔和的绿色守护光。", familiarityBand: "near", ambiguityRisk: "不用树木联想解释字源，只呈现部件位置。", formulaAuditSource: "hanzi-wheel" },
  { id: "he", glyph: "河", pinyin: "hé", familiarWord: "河流", shortMeaning: "流动的大片水道", regionId: "glimmer-grove", structure: "left-right", parts: ["氵", "可"], magicName: "河流引路", magicEffect: "一条发光河流绕开墨团，指向前路。", familiarityBand: "high", ambiguityRisk: "可有独立字义；不在合字前讲字源。", formulaAuditSource: "existing" },
  { id: "hai", glyph: "海", pinyin: "hǎi", familiarWord: "大海", shortMeaning: "很大很广的咸水水域", regionId: "glimmer-grove", structure: "left-right", parts: ["氵", "每"], magicName: "海潮回声", magicEffect: "蓝色海潮推开墨迹，再轻轻退回。", familiarityBand: "high", ambiguityRisk: "意义图只表现海潮，不把部件编成故事。", formulaAuditSource: "existing" },
  { id: "yang", glyph: "洋", pinyin: "yáng", familiarWord: "海洋", shortMeaning: "广阔相连的海水", regionId: "glimmer-grove", structure: "left-right", parts: ["氵", "羊"], magicName: "洋流风帆", magicEffect: "洋流托起一面小光帆，越过暗水。", familiarityBand: "near", ambiguityRisk: "羊是独立熟悉字；只核对部件和位置，不作字源断言。", formulaAuditSource: "existing" },
  { id: "an", glyph: "安", pinyin: "ān", familiarWord: "安全", shortMeaning: "平稳、没有危险", regionId: "glimmer-grove", structure: "top-bottom", parts: ["宀", "女"], magicName: "安心结界", magicEffect: "营地上方出现安稳柔和的保护光罩。", familiarityBand: "high", ambiguityRisk: "不把宀+女讲成字源故事；只呈现规范位置。", formulaAuditSource: "existing" },
  { id: "shan", glyph: "闪", pinyin: "shǎn", familiarWord: "闪电", shortMeaning: "很快地亮一下或移动开", regionId: "glimmer-grove", structure: "semi-enclosure", parts: ["门", "人"], magicName: "闪光跃门", magicEffect: "一道短促柔光穿过门影，不闪烁刺激。", familiarityBand: "high", ambiguityRisk: "效果必须避免高频闪烁；减少动画时用静态光带。", formulaAuditSource: "existing" },
  { id: "ni", glyph: "你", pinyin: "nǐ", familiarWord: "你好", shortMeaning: "称呼面前的人", regionId: "echo-garden", structure: "left-right", parts: ["亻", "尔"], magicName: "伙伴招呼", magicEffect: "友好的光点向同伴挥手，打开花园路。", familiarityBand: "high", ambiguityRisk: "母库词为你我；固定朗读采用更熟悉的你好。", formulaAuditSource: "existing" },
  { id: "ta", glyph: "他", pinyin: "tā", familiarWord: "他人", shortMeaning: "说到另外一个人", regionId: "echo-garden", structure: "left-right", parts: ["亻", "也"], magicName: "同伴灯影", magicEffect: "远处同伴的灯影回应，照亮另一侧小路。", familiarityBand: "high", ambiguityRisk: "只解释固定代词语境，不扩展性别判断。", formulaAuditSource: "existing" },
  { id: "hao", glyph: "好", pinyin: "hǎo", familiarWord: "美好", shortMeaning: "让人喜欢、觉得不错", regionId: "echo-garden", structure: "left-right", parts: ["女", "子"], magicName: "美好暖光", magicEffect: "暖光让花叶舒展开，颜色重新回来。", familiarityBand: "high", pronunciationRisk: "fixed-context-polyphone", ambiguityRisk: "好也读hào；本章固定在美好hǎo语境。", formulaAuditSource: "existing" },
  { id: "chang", glyph: "唱", pinyin: "chàng", familiarWord: "唱歌", shortMeaning: "用声音唱出歌曲", regionId: "echo-garden", structure: "left-right", parts: ["口", "昌"], magicName: "歌声波纹", magicEffect: "柔和歌声化成可见波纹，推开墨雾。", familiarityBand: "high", ambiguityRisk: "静音时必须保留可见波纹和文字。", formulaAuditSource: "existing" },
  { id: "jia", glyph: "家", pinyin: "jiā", familiarWord: "家庭", shortMeaning: "一起生活的家人与住处", regionId: "echo-garden", structure: "top-bottom", parts: ["宀", "豕"], magicName: "家灯归路", magicEffect: "一盏家灯亮起，回营小径变得温暖。", familiarityBand: "high", ambiguityRisk: "豕较不熟悉，需要清晰大字卡；不讲字源故事。", formulaAuditSource: "existing" },
  { id: "miao", glyph: "苗", pinyin: "miáo", familiarWord: "禾苗", shortMeaning: "刚长出来的幼小植物", regionId: "echo-garden", structure: "top-bottom", parts: ["艹", "田"], magicName: "新苗生长", magicEffect: "小苗从田边冒出，花园恢复绿色。", familiarityBand: "near", ambiguityRisk: "苗也是猫的右部件；以完整字和词语区分。", formulaAuditSource: "existing" },
  { id: "cai", glyph: "菜", pinyin: "cài", familiarWord: "蔬菜", shortMeaning: "可以做成食物的植物", regionId: "echo-garden", structure: "top-bottom", parts: ["艹", "采"], magicName: "菜园丰光", magicEffect: "菜园长出一排鲜绿叶片，补回营地颜色。", familiarityBand: "high", ambiguityRisk: "采是完整字；手牌求解必须排除其他艹组合。", formulaAuditSource: "existing" },
  { id: "yin", glyph: "音", pinyin: "yīn", familiarWord: "音乐", shortMeaning: "耳朵能听见的声音", regionId: "echo-garden", structure: "top-bottom", parts: ["立", "日"], magicName: "音符回廊", magicEffect: "音符化成柔光脚印，沿花园回廊前进。", familiarityBand: "high", ambiguityRisk: "静音分支用可见音符，不把声音设为规则前提。", formulaAuditSource: "existing" },
  { id: "zao", glyph: "早", pinyin: "zǎo", familiarWord: "早晨", shortMeaning: "一天刚开始的时候", regionId: "wind-trail", structure: "top-bottom", parts: ["日", "十"], magicName: "晨光唤醒", magicEffect: "早晨的柔光越过风径，唤醒小路。", familiarityBand: "high", ambiguityRisk: "十作为部件须与加号UI明显区分。", formulaAuditSource: "existing" },
  { id: "bi", glyph: "笔", pinyin: "bǐ", familiarWord: "毛笔", shortMeaning: "写字和画画的工具", regionId: "wind-trail", structure: "top-bottom", parts: ["⺮", "毛"], magicName: "墨笔星线", magicEffect: "毛笔画出一条不含文字的星光路线。", familiarityBand: "high", ambiguityRisk: "竹字头必须作为完整⺮部件清晰显示。", formulaAuditSource: "existing" },
  { id: "chen", glyph: "尘", pinyin: "chén", familiarWord: "尘土", shortMeaning: "很细小的土和灰", regionId: "wind-trail", structure: "top-bottom", parts: ["小", "土"], magicName: "尘光归土", magicEffect: "飞起的尘点慢慢落回地面，露出脚印。", familiarityBand: "near", ambiguityRisk: "不把小+土当作字源说明；只呈现结构位置。", formulaAuditSource: "existing" },
  { id: "guo", glyph: "国", pinyin: "guó", familiarWord: "国家", shortMeaning: "许多人共同生活的国家", regionId: "wind-trail", structure: "full-enclosure", parts: ["囗", "玉"], magicName: "国土光环", magicEffect: "完整外框守住一片发光土地和回家之门。", familiarityBand: "near", ambiguityRisk: "概念较大，以国家固定词和外框结构呈现。", formulaAuditSource: "existing" },
  { id: "tu", glyph: "图", pinyin: "tú", familiarWord: "图画", shortMeaning: "画出来供人观看的图像", regionId: "wind-trail", structure: "full-enclosure", parts: ["囗", "冬"], magicName: "图画地图", magicEffect: "一幅无文字光图展开，标出安全路线。", familiarityBand: "near", ambiguityRisk: "母库词为图书；本章使用更直观的图画固定语境。", formulaAuditSource: "existing" },
  { id: "yuan-round", glyph: "圆", pinyin: "yuán", familiarWord: "圆形", shortMeaning: "像圆圈一样没有角的形状", regionId: "wind-trail", structure: "full-enclosure", parts: ["囗", "员"], magicName: "圆光护环", magicEffect: "圆形柔光环绕营地，补好破损边缘。", familiarityBand: "high", ambiguityRisk: "与园同音；必须用字形、词语和意义图区分。", formulaAuditSource: "existing" },
  { id: "wen", glyph: "问", pinyin: "wèn", familiarWord: "问题", shortMeaning: "想知道时提出疑问", regionId: "wind-trail", structure: "semi-enclosure", parts: ["门", "口"], magicName: "问路回声", magicEffect: "门内传出一个温和回声，为岔路点亮提示。", familiarityBand: "high", ambiguityRisk: "不自动给答案；能力与魔法只显示方向。", formulaAuditSource: "existing" },
  { id: "bi-close", glyph: "闭", pinyin: "bì", familiarWord: "关闭", shortMeaning: "把开着的东西合上", regionId: "wind-trail", structure: "semi-enclosure", parts: ["门", "才"], magicName: "闭门挡墨", magicEffect: "光门轻轻合上，把墨风挡在外面。", familiarityBand: "near", ambiguityRisk: "门部件须保持半包围开口结构，不画成完整囗。", formulaAuditSource: "existing" },
] as const satisfies readonly CharacterSeed[];

const V1_REGION: Readonly<Record<string, ChapterRegionId>> = {
  ming: "glimmer-grove", hua: "glimmer-grove", lin: "glimmer-grove", xing: "glimmer-grove",
  cao: "echo-garden", kan: "echo-garden", yuan: "echo-garden", hui: "echo-garden",
  bao: "wind-trail", feng: "wind-trail", mao: "wind-trail", pao: "wind-trail",
};

const V1_FORMULA_SOURCE: Readonly<Record<string, "existing" | "hanzi-wheel">> = {
  ming: "hanzi-wheel", hua: "existing", lin: "hanzi-wheel", xing: "existing",
  cao: "existing", kan: "hanzi-wheel", yuan: "existing", hui: "existing",
  bao: "existing", feng: "existing", mao: "hanzi-wheel", pao: "hanzi-wheel",
};

const NEAR_V1 = new Set<string>();

function codePoint(glyph: string): `U+${string}` {
  return `U+${glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

function visualPath(glyph: string): `public/assets/hanzi-radical-battle/visuals/${string}.png` {
  return `public/assets/hanzi-radical-battle/visuals/u${glyph.codePointAt(0)!.toString(16).padStart(4, "0")}.png`;
}

function slotsFor(structure: ChapterCharacterStructure, count: number): readonly ("left" | "right" | "top" | "bottom" | "outer" | "inner")[] {
  if (count !== 2) throw new Error(`Chapter One currently requires two-component characters, received ${count}`);
  if (structure === "left-right") return ["left", "right"];
  if (structure === "top-bottom") return ["top", "bottom"];
  return ["outer", "inner"];
}

function sourceMapping(seed: CharacterSeed, sourceParts = seed.parts) {
  return {
    unicodeCodePoint: codePoint(seed.glyph),
    unihanMandarin: seed.pinyin,
    unihanSource: "Unicode 17.0.0 Unihan_Readings.txt kMandarin",
    unihanZipSha256: "F7A48B2B545ACFAA77B2D607AE28747404CE02BAEFEE16396C5D2D7A8EF34B5E",
    moeSource: "教育部 通用规范汉字表 2013",
    motherLibraryPath: "games/hanzi-radical-battle/game-data.ts",
    formulaAuditPath: "games/hanzi-radical-battle/formula-audit.ts",
    visualHintPath: visualPath(seed.glyph),
    sourceOrderedParts: sourceParts,
    formulaAuditStatus: "accepted",
    formulaAuditSource: seed.formulaAuditSource,
    sourceLimit: "sources-support-standard-identity-reading-combination-and-meaning-link-not-etymology-or-child-validation",
  } as const;
}

function buildCharacter(seed: CharacterSeed, acceptanceStatus: ChapterContentAcceptance): ChapterCharacter {
  const slots = slotsFor(seed.structure, seed.parts.length);
  const displayParts = seed.displayParts ?? seed.parts;
  const components = seed.parts.map((sourceGlyph, index): ChapterOrderedComponent => ({
    id: `${seed.id}-part-${index + 1}`,
    glyph: displayParts[index],
    sourceGlyph,
    slotId: slots[index],
    order: (index + 1) as 1 | 2 | 3,
  }));
  const stable = {
    id: seed.id,
    glyph: seed.glyph,
    pinyinWithToneMarks: seed.pinyin,
    spokenPhrase: `${seed.glyph}，${seed.familiarWord}`,
    familiarWord: seed.familiarWord,
    shortMeaning: seed.shortMeaning,
    regionId: seed.regionId,
    structure: seed.structure,
    orderedComponents: components,
    slotIds: slots,
    sourceCombinationKey: seed.parts.join(""),
    sourceMapping: sourceMapping(seed),
    magicId: `magic-${seed.id}`,
    magicName: seed.magicName,
    magicEffect: seed.magicEffect,
    meaningAssetKey: `meaning-${seed.id}`,
    familiarityBand: seed.familiarityBand,
    pronunciationRisk: seed.pronunciationRisk ?? "low-in-fixed-phrase",
    ambiguityRisk: seed.ambiguityRisk,
    etymologyClaim: null,
    acceptanceStatus,
  } as const;
  return { ...stable, revisionHash: createRevisionHash(CHAPTER_ONE_CONTENT_VERSION, stable) };
}

const V1_CHARACTERS: readonly ChapterCharacter[] = HANZI_MAGIC_V1_CHARACTERS.map((source) => {
  const golden = getGoldenCharacter(source.id);
  const seed: CharacterSeed = {
    id: source.id,
    glyph: source.glyph,
    pinyin: source.pinyin,
    familiarWord: source.familiarWord,
    shortMeaning: source.shortMeaning,
    regionId: V1_REGION[source.id],
    structure: source.structure,
    parts: source.components.map((component) => component.sourceGlyph) as unknown as readonly [string, string],
    displayParts: source.components.map((component) => component.glyph) as unknown as readonly [string, string],
    magicName: source.magic.name,
    magicEffect: source.magic.effect,
    familiarityBand: NEAR_V1.has(source.id) ? "near" : "high",
    pronunciationRisk: source.id === "kan" ? "fixed-context-polyphone" : "low-in-fixed-phrase",
    ambiguityRisk: source.id === "kan" ? "看也读kān；本章固定在看见kàn语境。" : golden.sourceMapping.sourceOrderedParts.length ? "V1 acceptance carried forward; no etymology claim." : "V1 source mapping retained.",
    formulaAuditSource: V1_FORMULA_SOURCE[source.id],
  };
  const character = buildCharacter(seed, "v1-accepted-carried-forward");
  return {
    ...character,
    orderedComponents: source.components.map((component, index) => ({
      id: component.id,
      glyph: component.glyph,
      sourceGlyph: component.sourceGlyph,
      slotId: component.slotId,
      order: (index + 1) as 1 | 2 | 3,
    })),
    slotIds: source.components.map((component) => component.slotId),
    sourceMapping: {
      ...character.sourceMapping,
      sourceOrderedParts: golden.sourceMapping.sourceOrderedParts,
      visualHintPath: golden.sourceMapping.visualHintPath.replace(/^\//, "public/") as `public/assets/hanzi-radical-battle/visuals/${string}.png`,
    },
    meaningAssetKey: `theme-c-v1-${source.meaningAssetId}`,
    revisionHash: golden.revisionHash,
  };
});

export const CHAPTER_ONE_CHARACTERS: readonly ChapterCharacter[] = [
  ...V1_CHARACTERS,
  ...NEW_CHARACTER_SEEDS.map((seed) => buildCharacter(seed, "machine-verified-v2")),
];

export const CHAPTER_ONE_CHARACTER_IDS = CHAPTER_ONE_CHARACTERS.map((character) => character.id);
export const CHAPTER_ONE_CONTENT_REVISION = createRevisionHash(CHAPTER_ONE_CONTENT_VERSION, CHAPTER_ONE_CHARACTERS);

export function getChapterOneCharacter(id: string): ChapterCharacter {
  const character = CHAPTER_ONE_CHARACTERS.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown Chapter One character: ${id}`);
  return character;
}

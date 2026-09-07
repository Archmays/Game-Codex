export type CoreKind = "fire" | "wood" | "water" | "mountain" | "flame" | "grove" | "wash" | "volcano" | "wildwood";
export type Structure = "single" | "top-bottom" | "left-right" | "word";

export interface CoreDefinition {
  readonly id: CoreKind;
  readonly glyph: string;
  readonly pinyin: string;
  readonly meaning: string;
  readonly familiarWord: string;
  readonly role: "整字" | "非成字部件" | "双字词";
  readonly structure: Structure;
  readonly components: readonly string[];
  readonly slots: readonly string[];
  readonly source: string;
  readonly familiarity: "familiar" | "supported-new";
  readonly illustrationBrief: string;
  readonly world: "hanzi-tower-defense";
  readonly color: number;
  readonly attack: string;
  readonly damage: number;
  readonly interval: number;
  readonly range: number;
  readonly splash: number;
  readonly slow: number;
  readonly slowDuration: number;
  readonly recycle: number;
}

const core = (record: Omit<CoreDefinition, "world" | "source">): CoreDefinition => ({
  ...record, world: "hanzi-tower-defense", source: `https://www.zdic.net/hans/${record.glyph}`,
});

// The attacks are fictional game mechanics, not etymologies. Values are damage / seconds / map units.
export const CORES: Readonly<Record<CoreKind, CoreDefinition>> = {
  fire: core({ id: "fire", glyph: "火", pinyin: "huǒ", meaning: "物体燃烧时发出的光和热。", familiarWord: "火光", role: "整字", structure: "single", components: [], slots: [], familiarity: "familiar", illustrationBrief: "明亮的小火球", color: 0xf68c44, attack: "火球 · 单体", damage: 12, interval: 1.2, range: 180, splash: 0, slow: 0, slowDuration: 0, recycle: 1 }),
  wood: core({ id: "wood", glyph: "木", pinyin: "mù", meaning: "树木，也指木材。", familiarWord: "木头", role: "整字", structure: "single", components: [], slots: [], familiarity: "familiar", illustrationBrief: "细长的青绿叶箭", color: 0x73b86a, attack: "叶箭 · 快射", damage: 7, interval: .8, range: 185, splash: 0, slow: 0, slowDuration: 0, recycle: 1 }),
  water: core({ id: "water", glyph: "氵", pinyin: "三点水", meaning: "水的偏旁写法，是部件，不作为独立汉字认读。", familiarWord: "沐浴的沐", role: "非成字部件", structure: "single", components: [], slots: [], familiarity: "supported-new", illustrationBrief: "淡蓝水珠与减速水环", color: 0x56ccec, attack: "水珠 · 减速", damage: 4, interval: 1, range: 175, splash: 0, slow: .25, slowDuration: 1.8, recycle: 1 }),
  mountain: core({ id: "mountain", glyph: "山", pinyin: "shān", meaning: "地面上高起的部分。", familiarWord: "高山", role: "整字", structure: "single", components: [], slots: [], familiarity: "familiar", illustrationBrief: "沉稳的金色岩石弹", color: 0xc6ac7c, attack: "岩弹 · 重击", damage: 22, interval: 2, range: 190, splash: 0, slow: 0, slowDuration: 0, recycle: 1 }),
  flame: core({ id: "flame", glyph: "炎", pinyin: "yán", meaning: "炎热，很热。", familiarWord: "炎热", role: "整字", structure: "top-bottom", components: ["火", "火"], slots: ["上", "下"], familiarity: "supported-new", illustrationBrief: "两道火焰汇成爆裂火环", color: 0xff613f, attack: "烈焰 · 范围爆裂", damage: 32, interval: 1.2, range: 195, splash: 65, slow: 0, slowDuration: 0, recycle: 2 }),
  grove: core({ id: "grove", glyph: "林", pinyin: "lín", meaning: "一片土地上生长的许多树木或竹子。", familiarWord: "树林", role: "整字", structure: "left-right", components: ["木", "木"], slots: ["左", "右"], familiarity: "familiar", illustrationBrief: "一束绿色叶箭连续发射", color: 0x3ec48d, attack: "连叶箭 · 急射", damage: 12, interval: .48, range: 205, splash: 0, slow: 0, slowDuration: 0, recycle: 2 }),
  wash: core({ id: "wash", glyph: "沐", pinyin: "mù", meaning: "洗头发；也有润泽的意思。", familiarWord: "沐浴", role: "整字", structure: "left-right", components: ["氵", "木"], slots: ["左", "右"], familiarity: "supported-new", illustrationBrief: "清蓝水波与叶片扩散；为魔法联想，不是字源", color: 0x5bdee0, attack: "润泽波 · 群体减速", damage: 20, interval: 1, range: 205, splash: 75, slow: .42, slowDuration: 2, recycle: 2 }),
  volcano: core({ id: "volcano", glyph: "火山", pinyin: "huǒ shān", meaning: "岩浆等从地下喷出并堆积形成的高地。", familiarWord: "火山喷发", role: "双字词", structure: "word", components: ["火", "山"], slots: ["第一个字", "第二个字"], familiarity: "familiar", illustrationBrief: "弧形熔岩弹落下后扩散火山冲击", color: 0xffb148, attack: "熔岩炮 · 大范围重击", damage: 63, interval: 2, range: 225, splash: 100, slow: 0, slowDuration: 0, recycle: 2 }),
  wildwood: core({ id: "wildwood", glyph: "山林", pinyin: "shān lín", meaning: "山上的树林；也泛指山野林木。", familiarWord: "走进山林", role: "双字词", structure: "word", components: ["山", "林"], slots: ["第一个字", "第二个字"], familiarity: "familiar", illustrationBrief: "岩石裹着藤蔓弹出，命中后形成缠绕根环", color: 0xa1ce68, attack: "根岩阵 · 重击减速", damage: 49, interval: 1, range: 215, splash: 50, slow: .35, slowDuration: 2.2, recycle: 3 }),
};

export interface Recipe { readonly id: string; readonly inputs: readonly [CoreKind, CoreKind]; readonly result: CoreKind; readonly structure: Exclude<Structure, "single">; }
export const RECIPES: readonly Recipe[] = [
  { id: "fire-fire", inputs: ["fire", "fire"], result: "flame", structure: "top-bottom" },
  { id: "wood-wood", inputs: ["wood", "wood"], result: "grove", structure: "left-right" },
  { id: "water-wood", inputs: ["water", "wood"], result: "wash", structure: "left-right" },
  { id: "fire-mountain", inputs: ["fire", "mountain"], result: "volcano", structure: "word" },
  { id: "mountain-grove", inputs: ["mountain", "grove"], result: "wildwood", structure: "word" },
];
export const CORE_ORDER = Object.keys(CORES) as CoreKind[];
export function recipeFor(a: CoreKind, b: CoreKind): Recipe | undefined { return RECIPES.find(r => r.inputs[0] === a && r.inputs[1] === b); }

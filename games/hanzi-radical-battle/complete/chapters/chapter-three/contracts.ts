import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../content-graph/families";
import { COMPLETE_WORD_NODES } from "../../content-graph/words";
import type { CompleteRepairId } from "../../core/world-contracts";

export const CHAPTER_THREE_TITLE = "万象共鸣" as const;
export const CHAPTER_THREE_EPILOGUE_TITLE = "字光归林" as const;

export const CHAPTER_THREE_STORY_CHARACTER_IDS = [
  "char-u7a7a", "char-u9759", "char-u775b", "char-u5ead",
  "char-u9999", "char-u95f4", "char-u56f4", "char-u9053",
  "char-u773c", "char-u5708", "char-u6668", "char-u666f",
] as const;

export const CHAPTER_THREE_OPTIONAL_CHARACTER_IDS = [
  "char-u6c5f", "char-u6d01", "char-u6811", "char-u6b4c", "char-u54cd", "char-u7b54",
] as const;

export const CHAPTER_THREE_STORY_WORD_IDS = [
  "word-flower-garden", "word-pine-grove", "word-clear-sky", "word-ocean",
  "word-quiet", "word-hello", "word-go-home", "word-flower-fragrance",
  "word-running-track", "word-please-ask", "word-early-morning", "word-scenery",
] as const;

export const CHAPTER_THREE_OPTIONAL_WORD_IDS = [
  "word-star", "word-tomorrow-morning", "word-tabby-cat", "word-between-trees",
  "word-eyes", "word-look-at-picture", "word-return-country", "word-surround",
  "word-wallet", "word-sea-breeze", "word-breakfast", "word-cats-eye",
  "word-clean", "word-river-course", "word-rivers", "word-they",
  "word-family", "word-vegetable-garden", "word-point-way", "word-get-lost",
  "word-train-of-thought", "word-space", "word-mute", "word-circle",
] as const;

export const CHAPTER_THREE_NEW_ABILITY_IDS = [
  "word-order-ribbon", "word-context-lantern", "word-resonance-bridge",
] as const;
export type ChapterThreeAbilityId = typeof CHAPTER_THREE_NEW_ABILITY_IDS[number];

export const CHAPTER_THREE_NEW_ABILITIES = [
  { id: "word-order-ribbon", name: "词序丝带", trigger: "word-ordered", childDescription: "两个完整字按真实词序就位后，丝带会沿阅读方向亮起。", visibleEffect: "词槽下方出现从左到右的金蓝丝带。" },
  { id: "word-context-lantern", name: "语境灯", trigger: "word-context", childDescription: "完整词出现后，灯会照亮这次使用的固定语境。", visibleEffect: "词义和场景旁同时亮起一盏靛蓝语境灯。" },
  { id: "word-resonance-bridge", name: "共鸣桥", trigger: "world-effect", childDescription: "词语世界效果出现时，两道字光会合成一座桥。", visibleEffect: "世界变化下方出现不代答的双线光桥。" },
].map((ability) => ({ ...ability, neverAutoSolves: true as const, neverChangesAnswer: true as const, noProbability: true as const, noRarity: true as const, noPrice: true as const, noPunitiveLoss: true as const }));

export const CHAPTER_THREE_BEHAVIOR_IDS = [
  "word-order-gust", "word-context-fog", "word-resonance-ripple",
] as const;
export type ChapterThreeBehaviorId = typeof CHAPTER_THREE_BEHAVIOR_IDS[number];

export const CHAPTER_THREE_BEHAVIORS = [
  { id: "word-order-gust", name: "词序风", telegraph: "一阵蓝风先从两个空词槽旁掠过，不碰汉字。", effect: "丝带轻轻摆动；真实词序、完整字与存档都没有改变。", guaranteedRecovery: "按住定风灯，丝带会重新指向正常阅读方向。" },
  { id: "word-context-fog", name: "语境雾", telegraph: "薄雾先停在场景灯外，不遮住完整词和词义。", effect: "背景场景暂时变淡；固定词语与上下文仍完整可见。", guaranteedRecovery: "点亮语境灯，场景会原样显回。" },
  { id: "word-resonance-ripple", name: "共鸣涟漪", telegraph: "一圈涟漪先绕过世界修复，不碰已完成进度。", effect: "光桥表面出现波纹；两个字、词序和世界变化都不改变。", guaranteedRecovery: "轻触涟漪中心，它会沿原路平稳散开。" },
].map((behavior) => ({ ...behavior, neverChangesAnswer: true as const, neverChangesComponents: true as const, neverChangesSlots: true as const, neverChangesWordOrder: true as const, neverChangesProgress: true as const }));

export const CHAPTER_THREE_BOSSES = [
  { id: "lantern-town-keeper", name: "家灯守护者", behaviorIds: ["word-order-gust"] },
  { id: "book-harbor-guardian", name: "书港守护者", behaviorIds: ["word-context-fog"] },
  { id: "constellation-keeper", name: "星图守护者", behaviorIds: ["word-resonance-ripple"] },
  { id: "word-heart-guardian", name: "万象字心守护者", behaviorIds: CHAPTER_THREE_BEHAVIOR_IDS },
] as const;
export type ChapterThreeBossId = typeof CHAPTER_THREE_BOSSES[number]["id"];

export interface ChapterThreeRepairDefinition {
  readonly id: CompleteRepairId;
  readonly name: string;
  readonly before: { readonly shape: string; readonly function: string; readonly light: string };
  readonly after: { readonly shape: string; readonly function: string; readonly light: string };
  readonly interaction: string;
  readonly childValue: string;
  readonly learningConnection: string;
  readonly persistence: "local-durable";
  readonly saveField: "repairedObjectIds";
}

export const CHAPTER_THREE_REPAIRS = [
  { id: "home-lantern-street", name: "家灯长街", before: { shape: "灯笼各自歪向不同方向", function: "回家光路无法连续指路", light: "暗靛微光" }, after: { shape: "灯笼沿街道前后有序排开", function: "温暖光路能一直通往家门", light: "灯金暖光" }, interaction: "轻触任一灯笼，光会按词语阅读方向依次传递。", childValue: "完成词序会给世界留下温暖、可重看的变化。", learningConnection: "两个完整字按真实词序就位后，灯路才会连贯。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "book-page-harbor", name: "书页船港", before: { shape: "书页船散在雾中的不同水面", function: "故事和伙伴无法安全靠岸", light: "灰蓝纸光" }, after: { shape: "书页船沿清楚航道停入港湾", function: "固定语境能把每艘船带到对应码头", light: "靛蓝页光" }, interaction: "轻触船帆可重看词语语境，不会打开测验面板。", childValue: "词语被放进可理解的场景，而不是孤立背诵。", learningConnection: "完整词义和固定语境共同确认书页船航向。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "constellation-lighthouse", name: "星图灯塔", before: { shape: "星点与灯塔之间的光线断开", function: "峰顶看不清归林方向", light: "冷黑星影" }, after: { shape: "星点按词序连成通往灯塔的星带", function: "灯塔能把柔和星光送回森林", light: "星蓝金光" }, interaction: "轻触星带会重放一次词语共鸣，不播放未来答案。", childValue: "没有倒计时，可以慢慢看清星光如何连接。", learningConnection: "正确词序和语境让两道完整字光产生共鸣。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "word-heart", name: "万象字心", before: { shape: "字心中的结构线、字脉线与词带互相打结", function: "三章字光不能一起回到森林", light: "深墨无光" }, after: { shape: "结构、字脉、词带分层环绕字心", function: "已学规则各守其位并共同送光归林", light: "靛蓝、青绿与软金交织" }, interaction: "轻触字心可重看终章组合，不会重置任何章节。", childValue: "通关来自已学规则的真实组合，不要求收集 72/72。", learningConnection: "结构、部件字脉、词序和语境保持清楚边界。", persistence: "local-durable", saveField: "repairedObjectIds" },
] as const satisfies readonly ChapterThreeRepairDefinition[];

export interface ChapterThreeEpisodeDefinition {
  readonly id: "chapter-three:home-lantern-town" | "chapter-three:myriad-book-harbor" | "chapter-three:star-map-peak" | "chapter-three:word-heart-core";
  readonly name: string;
  readonly sceneKey: string;
  readonly storyCharacterIds: readonly string[];
  readonly wordIds: readonly string[];
  readonly coreFamilyIds: readonly string[];
  readonly behaviorIds: readonly ChapterThreeBehaviorId[];
  readonly bossId: ChapterThreeBossId;
  readonly repairId: CompleteRepairId;
}

export const CHAPTER_THREE_EPISODES = [
  { id: "chapter-three:home-lantern-town", name: "家灯小镇", sceneKey: "region-echo-garden", storyCharacterIds: CHAPTER_THREE_STORY_CHARACTER_IDS.slice(0, 4), wordIds: ["word-flower-garden", "word-quiet", "word-hello", "word-go-home"], coreFamilyIds: [], behaviorIds: ["word-order-gust"], bossId: "lantern-town-keeper", repairId: "home-lantern-street" },
  { id: "chapter-three:myriad-book-harbor", name: "万象书港", sceneKey: "region-wind-trail", storyCharacterIds: CHAPTER_THREE_STORY_CHARACTER_IDS.slice(4, 8), wordIds: ["word-pine-grove", "word-ocean", "word-flower-fragrance", "word-please-ask"], coreFamilyIds: [], behaviorIds: ["word-context-fog"], bossId: "book-harbor-guardian", repairId: "book-page-harbor" },
  { id: "chapter-three:star-map-peak", name: "星图峰顶", sceneKey: "region-glimmer-grove", storyCharacterIds: CHAPTER_THREE_STORY_CHARACTER_IDS.slice(8, 12), wordIds: ["word-clear-sky", "word-running-track", "word-early-morning", "word-scenery"], coreFamilyIds: [], behaviorIds: ["word-resonance-ripple"], bossId: "constellation-keeper", repairId: "constellation-lighthouse" },
  { id: "chapter-three:word-heart-core", name: "万象字心", sceneKey: "region-ink-king-core", storyCharacterIds: [], wordIds: ["word-pine-grove", "word-ocean", "word-please-ask"], coreFamilyIds: ["family-wood", "family-water", "family-speech"], behaviorIds: CHAPTER_THREE_BEHAVIOR_IDS, bossId: "word-heart-guardian", repairId: "word-heart" },
] as const satisfies readonly ChapterThreeEpisodeDefinition[];

const chapterThree = COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-three");
const storyWords = COMPLETE_WORD_NODES.filter((word) => word.band === "story");
const optionalWords = COMPLETE_WORD_NODES.filter((word) => word.band === "optional-postgame");
if (chapterThree.length !== 18 || chapterThree.filter((character) => character.band === "story-required").length !== 12 || chapterThree.filter((character) => character.band === "optional").length !== 6) throw new Error("Chapter Three requires 18 new characters split 12 story and 6 optional");
if (new Set(CHAPTER_THREE_STORY_CHARACTER_IDS).size !== 12 || !CHAPTER_THREE_STORY_CHARACTER_IDS.every((id) => chapterThree.some((character) => character.id === id && character.band === "story-required"))) throw new Error("Chapter Three story character allocation is incomplete");
if (new Set(CHAPTER_THREE_OPTIONAL_CHARACTER_IDS).size !== 6 || !CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.every((id) => chapterThree.some((character) => character.id === id && character.band === "optional"))) throw new Error("Chapter Three optional character allocation is incomplete");
if (storyWords.length !== 12 || new Set(CHAPTER_THREE_STORY_WORD_IDS).size !== 12 || !CHAPTER_THREE_STORY_WORD_IDS.every((id) => storyWords.some((word) => word.id === id))) throw new Error("Chapter Three requires all 12 story words");
if (optionalWords.length !== 24 || new Set(CHAPTER_THREE_OPTIONAL_WORD_IDS).size !== 24 || !CHAPTER_THREE_OPTIONAL_WORD_IDS.every((id) => optionalWords.some((word) => word.id === id))) throw new Error("Chapter Three requires all 24 optional words outside story completion");
if (!CHAPTER_THREE_EPISODES[3].coreFamilyIds.every((id) => COMPLETE_COMPONENT_FAMILIES.some((family) => family.id === id && family.band === "story-core"))) throw new Error("Word-heart core may only reuse established story families");

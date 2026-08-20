import { COMPLETE_CORE_CHARACTER_NODES } from "../../content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../content-graph/families";
import type { CompleteRepairId } from "../../core/world-contracts";

export const CHAPTER_TWO_TITLE = "字脉苏醒" as const;

export const CHAPTER_TWO_STORY_CHARACTER_IDS = [
  "char-u6307", "char-u9971", "char-u60c5", "char-u8bf7",
  "char-u8def", "char-u8fdb", "char-u8ff7", "char-u601d",
  "char-u8bed", "char-u996d", "char-u949f", "char-u94b1",
] as const;

export const CHAPTER_TWO_OPTIONAL_CHARACTER_IDS = [
  "char-u521d", "char-u88ab", "char-u795d", "char-u795e", "char-u8df3", "char-u4eec",
] as const;

export const CHAPTER_TWO_STORY_FAMILY_IDS = [
  "family-hand", "family-heart", "family-speech", "family-foot",
  "family-walk", "family-water", "family-qing-sound", "family-wood",
  "family-grass", "family-door", "family-enclosure", "family-roof",
] as const;

export const CHAPTER_TWO_NEW_ABILITY_IDS = [
  "family-root-link", "family-variant-lantern", "family-echo-trace",
] as const;
export type ChapterTwoAbilityId = typeof CHAPTER_TWO_NEW_ABILITY_IDS[number];

export const CHAPTER_TWO_NEW_ABILITIES = [
  { id: "family-root-link", name: "根线相连", trigger: "family-connected", childDescription: "字脉连对后，根线会把两个完整字稳稳托住。", visibleEffect: "连接结果下方长出两道金绿根线。" },
  { id: "family-variant-lantern", name: "变形灯", trigger: "family-inspect", childDescription: "部件换了样子时，灯会同时照出原形与变形。", visibleEffect: "字脉说明旁亮起原形与变形双灯。" },
  { id: "family-echo-trace", name: "回声轨迹", trigger: "behavior-recovered", childDescription: "干扰退去后，真实字脉会留下一道可见轨迹。", visibleEffect: "恢复后的场景留下不代答的青色轨迹。" },
].map((ability) => ({ ...ability, neverAutoSolves: true as const, neverChangesAnswer: true as const, noProbability: true as const, noRarity: true as const, noPrice: true as const, noPunitiveLoss: true as const }));

export const CHAPTER_TWO_BEHAVIOR_IDS = [
  "family-root-mist", "family-variant-shadow", "family-echo-knot",
] as const;
export type ChapterTwoBehaviorId = typeof CHAPTER_TWO_BEHAVIOR_IDS[number];

export const CHAPTER_TWO_BEHAVIORS = [
  { id: "family-root-mist", name: "根雾遮线", telegraph: "淡雾先绕到连接线旁，不碰汉字和槽位。", effect: "根线暂时变淡；完整字、部件与真实位置都没有改变。", guaranteedRecovery: "点亮观察灯，根线会完整显回。" },
  { id: "family-variant-shadow", name: "变形影", telegraph: "影子先落在部件变形说明旁，不遮住手牌。", effect: "原形与变形的说明暂时错开；字形关系和答案没有改变。", guaranteedRecovery: "让双灯重合，说明会回到原位。" },
  { id: "family-echo-knot", name: "回声结", telegraph: "一圈回声先在字脉外打结，不碰已完成的字。", effect: "背景回声绕了一圈；已连接关系与进度仍在。", guaranteedRecovery: "轻触回声结，它会沿原路松开。" },
].map((behavior) => ({ ...behavior, neverChangesAnswer: true as const, neverChangesComponents: true as const, neverChangesSlots: true as const }));

export const CHAPTER_TWO_BOSSES = [
  { id: "canopy-keeper", name: "树冠守护者", behaviorIds: ["family-root-mist"] },
  { id: "spring-wheel-guardian", name: "清泉轮守护者", behaviorIds: ["family-variant-shadow"] },
  { id: "door-shadow-keeper", name: "门影守护者", behaviorIds: ["family-echo-knot"] },
  { id: "component-root-guardian", name: "字脉树心守护者", behaviorIds: CHAPTER_TWO_BEHAVIOR_IDS },
] as const;
export type ChapterTwoBossId = typeof CHAPTER_TWO_BOSSES[number]["id"];

export interface ChapterTwoRepairDefinition {
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

export const CHAPTER_TWO_REPAIRS = [
  { id: "tree-canopy-bridge", name: "树冠桥", before: { shape: "断开的藤桥垂在两棵树间", function: "不能通往下一片树冠", light: "灰绿无光" }, after: { shape: "两道根线托起完整拱桥", function: "伙伴可以安全穿过树冠", light: "金绿根光" }, interaction: "轻触桥面会依次亮起两端字脉。", childValue: "看见一次完成会让世界留下温和变化。", learningConnection: "准确连接共享部件后，桥的两端才会相连。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "spring-waterwheel", name: "清泉水轮", before: { shape: "水轮叶片散开停在浅滩", function: "清泉不能送到高处", light: "浑蓝暗光" }, after: { shape: "叶片按中心重新围合", function: "清泉把字光送上石谷", light: "清蓝水光" }, interaction: "轻触水轮会显示已恢复的水流方向。", childValue: "没有倒计时，可以慢慢观察变化。", learningConnection: "分清部件原形与变形后，叶片回到对应位置。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "door-shadow-corridor", name: "门影长廊", before: { shape: "门影彼此重叠，通道轮廓不清", function: "伙伴找不到正确出口", light: "墨紫暗影" }, after: { shape: "每扇门保留自己的完整字形", function: "长廊能清楚通向树心", light: "暖橙门灯" }, interaction: "轻触门灯会逐扇显示完整字，不猜共同意思。", childValue: "视觉相似也可以被谨慎说明。", learningConnection: "只把现代字形连接说成字形连接，不编造共同字义。", persistence: "local-durable", saveField: "repairedObjectIds" },
  { id: "component-root-heart", name: "字脉树心", before: { shape: "树心根线打结并缩成暗团", function: "各条字脉无法互相送光", light: "深墨无光" }, after: { shape: "十二条根线分层环绕树心", function: "已确认的字脉能分别送回森林", light: "金青交织" }, interaction: "轻触树心可重看已完成字脉，不会重置故事。", childValue: "通关来自真实合字与关系判断，不要求全收集。", learningConnection: "结构、部件关系和完整字义保持分层。", persistence: "local-durable", saveField: "repairedObjectIds" },
] as const satisfies readonly ChapterTwoRepairDefinition[];

export interface ChapterTwoEpisodeDefinition {
  readonly id: "chapter-two:wood-voice-canopy" | "chapter-two:spring-stone-valley" | "chapter-two:door-shadow-corridor" | "chapter-two:component-root-core";
  readonly name: string;
  readonly sceneKey: string;
  readonly storyCharacterIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly behaviorIds: readonly ChapterTwoBehaviorId[];
  readonly bossId: ChapterTwoBossId;
  readonly repairId: CompleteRepairId;
}

export const CHAPTER_TWO_EPISODES = [
  { id: "chapter-two:wood-voice-canopy", name: "木语树冠", sceneKey: "region-glimmer-grove", storyCharacterIds: CHAPTER_TWO_STORY_CHARACTER_IDS.slice(0, 4), familyIds: CHAPTER_TWO_STORY_FAMILY_IDS.slice(0, 4), behaviorIds: ["family-root-mist"], bossId: "canopy-keeper", repairId: "tree-canopy-bridge" },
  { id: "chapter-two:spring-stone-valley", name: "清泉石谷", sceneKey: "region-echo-garden", storyCharacterIds: CHAPTER_TWO_STORY_CHARACTER_IDS.slice(4, 8), familyIds: CHAPTER_TWO_STORY_FAMILY_IDS.slice(4, 8), behaviorIds: ["family-variant-shadow"], bossId: "spring-wheel-guardian", repairId: "spring-waterwheel" },
  { id: "chapter-two:door-shadow-corridor", name: "门影长廊", sceneKey: "region-wind-trail", storyCharacterIds: CHAPTER_TWO_STORY_CHARACTER_IDS.slice(8, 12), familyIds: CHAPTER_TWO_STORY_FAMILY_IDS.slice(8, 12), behaviorIds: ["family-echo-knot"], bossId: "door-shadow-keeper", repairId: "door-shadow-corridor" },
  { id: "chapter-two:component-root-core", name: "字脉树心", sceneKey: "region-ink-king-core", storyCharacterIds: ["char-u60c5", "char-u8fdb", "char-u6307"], familyIds: ["family-qing-sound", "family-walk", "family-hand"], behaviorIds: CHAPTER_TWO_BEHAVIOR_IDS, bossId: "component-root-guardian", repairId: "component-root-heart" },
] as const satisfies readonly ChapterTwoEpisodeDefinition[];

const chapterTwo = COMPLETE_CORE_CHARACTER_NODES.filter((character) => character.chapterId === "chapter-two");
const storyFamilies = COMPLETE_COMPONENT_FAMILIES.filter((family) => family.band === "story-core");
if (chapterTwo.length !== 18 || chapterTwo.filter((character) => character.band === "story-required").length !== 12 || chapterTwo.filter((character) => character.band === "optional").length !== 6) {
  throw new Error("Chapter Two requires 18 new characters split 12 story and 6 optional");
}
if (new Set(CHAPTER_TWO_STORY_CHARACTER_IDS).size !== 12 || !CHAPTER_TWO_STORY_CHARACTER_IDS.every((id) => chapterTwo.some((character) => character.id === id && character.band === "story-required"))) {
  throw new Error("Chapter Two story character allocation is incomplete");
}
if (new Set(CHAPTER_TWO_OPTIONAL_CHARACTER_IDS).size !== 6 || !CHAPTER_TWO_OPTIONAL_CHARACTER_IDS.every((id) => chapterTwo.some((character) => character.id === id && character.band === "optional"))) {
  throw new Error("Chapter Two optional character allocation is incomplete");
}
if (storyFamilies.length !== 12 || new Set(CHAPTER_TWO_STORY_FAMILY_IDS).size !== 12 || !CHAPTER_TWO_STORY_FAMILY_IDS.every((id) => storyFamilies.some((family) => family.id === id))) {
  throw new Error("Chapter Two requires all 12 story component families");
}

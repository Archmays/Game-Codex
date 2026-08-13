import type { ChapterRegionId } from "./content-types";

export type M5BehaviorId =
  | "slot-veil"
  | "hand-gust"
  | "distractor-hold"
  | "hint-fade"
  | "ink-shell"
  | "dual-route"
  | "mimic-flare"
  | "companion-path"
  | "scenery-shift";

export interface M5BehaviorDefinition {
  readonly id: M5BehaviorId;
  readonly name: string;
  readonly regionId: ChapterRegionId;
  readonly telegraph: string;
  readonly effect: string;
  readonly guaranteedRecovery: string;
  readonly visualKey: string;
  readonly childValue: string;
  readonly hanziLearningValue: string;
  readonly keyboardRecovery: true;
  readonly touchRecovery: true;
  readonly neverChangesAnswer: true;
  readonly neverHidesPlacedComponents: true;
  readonly neverIntroducedFirstAtBoss: true;
}

const SAFE = { keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverHidesPlacedComponents: true, neverIntroducedFirstAtBoss: true } as const;

export const M5_BEHAVIORS = [
  { id: "slot-veil", name: "薄雾遮槽", regionId: "glimmer-grove", telegraph: "薄雾先绕到一个空槽边，已经放好的字灵仍完整可见。", effect: "一个空槽轮廓短暂变淡；目标牌、已放部件和其余槽位不变。", guaranteedRecovery: "轻触“吹开薄雾”后，所有空槽恢复同等清楚。", visualKey: "monster-slot-veil", childValue: "先看预告，再用一个动作恢复可读棋盘。", hanziLearningValue: "槽位只是短暂变淡，真实结构和正确部件不变。", ...SAFE },
  { id: "hand-gust", name: "转圈小风", regionId: "glimmer-grove", telegraph: "小风沿手牌外圈走一圈，牌面不会翻转。", effect: "五张手牌循环换位；实例、字形、种类和答案完全不变。", guaranteedRecovery: "轻触“稳住手牌”后，从新的清楚顺序继续。", visualKey: "monster-hand-gust", childValue: "变化可见、可预测，不制造丢牌焦虑。", hanziLearningValue: "只改变显示位置，部件身份与结构位置保持固定。", ...SAFE },
  { id: "distractor-hold", name: "墨团含牌", regionId: "glimmer-grove", telegraph: "墨团张开小口，只盯着一张干扰牌。", effect: "一张 distractor 暂时停在墨团旁，所有目标牌仍能清楚操作。", guaranteedRecovery: "轻触“请它放回”后，干扰牌回到原手牌且不会被吞掉。", visualKey: "monster-distractor-hold", childValue: "怪物调皮但守信用，所有东西都会回来。", hanziLearningValue: "目标部件从不被吞住，正确作答路径始终存在。", ...SAFE },
  { id: "hint-fade", name: "回声变淡", regionId: "echo-garden", telegraph: "花园回声要把刚看过的提示轻轻调暗。", effect: "一条已见恢复提示降低视觉强调，结构板和字灵保持原对比。", guaranteedRecovery: "轻触“再听一次”后，提示文字与可见波纹完整回来。", visualKey: "monster-hint-fade", childValue: "需要时能主动重听，不依赖记忆压力。", hanziLearningValue: "结构信息永不消失，提示重放不提前泄漏答案。", ...SAFE },
  { id: "ink-shell", name: "柔墨小壳", regionId: "echo-garden", telegraph: "柔软墨壳要停在一张目标牌边缘，不盖住字形。", effect: "一张目标牌得到可见外壳；下一次操作可先解除，牌面仍可读。", guaranteedRecovery: "轻触“敲开小壳”后，目标牌恢复普通状态并可立即选择。", visualKey: "monster-ink-shell", childValue: "额外一步有清楚因果且不会惩罚误触。", hanziLearningValue: "目标字灵保持可辨，解除状态不改它的真实槽位。", ...SAFE },
  { id: "dual-route", name: "双路墨影", regionId: "echo-garden", telegraph: "墨影照出两条都会抵达的字光路。", effect: "世界层显示两个安全方向；当前目标字、结构和手牌不改变。", guaranteedRecovery: "轻触任一路标后，两条影子合回当前真实棋盘。", visualKey: "monster-dual-route", childValue: "世界内选择有差异但没有假路或必败路。", hanziLearningValue: "路线选择与当前汉字答案彼此独立。", ...SAFE },
  { id: "mimic-flare", name: "仿光墨花", regionId: "wind-trail", telegraph: "墨花会模仿一道魔法光，但不会模仿完整汉字。", effect: "背景出现一束无字仿光；结构板、目标牌和正确答案保持唯一。", guaranteedRecovery: "轻触“看清真光”后，仿光缩回背景并留下安全标记。", visualKey: "monster-mimic-flare", childValue: "用视觉玩笑制造戏剧感，不制造真假答案陷阱。", hanziLearningValue: "完整汉字只由正确部件合成，装饰光不承担字形信息。", ...SAFE },
  { id: "companion-path", name: "墨点领路", regionId: "wind-trail", telegraph: "墨点伙伴先跳到一个不会挡住棋盘的位置。", effect: "伙伴用动作预告恢复按钮，静音时也能看懂下一步。", guaranteedRecovery: "轻触伙伴指向的按钮后，世界层退开并进入清楚棋盘。", visualKey: "monster-companion-path", childValue: "同伴用动作而非长说明帮助理解。", hanziLearningValue: "动作只指向恢复控制，不选择部件或槽位。", ...SAFE },
  { id: "scenery-shift", name: "风景换位", regionId: "wind-trail", telegraph: "风要把远处树影和云层换个方向。", effect: "背景与前景层移动，结构板保持固定、完整、高对比。", guaranteedRecovery: "轻触“风停好了”后，场景安定，棋盘位置从未移动。", visualKey: "monster-scenery-shift", childValue: "世界有变化，核心操作仍稳定可靠。", hanziLearningValue: "环境运动与汉字空间结构明确分层。", ...SAFE },
] as const satisfies readonly M5BehaviorDefinition[];

export type M5BossId = "lantern-root-guardian" | "echo-bloom-guardian" | "wind-bell-guardian" | "ink-king-core";

export interface M5BossDefinition {
  readonly id: M5BossId;
  readonly name: string;
  readonly regionId: ChapterRegionId | "ink-king-core";
  readonly phaseCount: 2 | 3;
  readonly assetKey: string;
  readonly shortStory: string;
  readonly childValue: string;
  readonly hanziLearningValue: string;
  readonly neverIntroducesUnseenBehavior: true;
  readonly noPermanentLoss: true;
  readonly nonFrightening: true;
}

export const M5_BOSSES = [
  { id: "lantern-root-guardian", name: "灯根守护兽", regionId: "glimmer-grove", phaseCount: 2, assetKey: "boss-lantern-root", shortStory: "它把散开的灯根重新盘好，想先确认字光真的认得路。", childValue: "用两个已学动作形成第一个温和高潮。", hanziLearningValue: "两阶段使用不同字与结构，只复用本区已见干扰。", neverIntroducesUnseenBehavior: true, noPermanentLoss: true, nonFrightening: true },
  { id: "echo-bloom-guardian", name: "回声花守护兽", regionId: "echo-garden", phaseCount: 2, assetKey: "boss-echo-bloom", shortStory: "它把花园回声收在花瓣里，等完整字把声音重新放出来。", childValue: "用花瓣开合呈现可预读的两段变化。", hanziLearningValue: "包围与上下结构在两阶段保持清楚，能力只辅助恢复。", neverIntroducesUnseenBehavior: true, noPermanentLoss: true, nonFrightening: true },
  { id: "wind-bell-guardian", name: "风铃守护兽", regionId: "wind-trail", phaseCount: 2, assetKey: "boss-wind-bell", shortStory: "它追着风铃脚印转圈，等字光让风路重新安静。", childValue: "最后区域高潮仍无倒计时或永久损失。", hanziLearningValue: "半包围与完整结构不随背景风景移动。", neverIntroducesUnseenBehavior: true, noPermanentLoss: true, nonFrightening: true },
  { id: "ink-king-core", name: "墨王字核", regionId: "ink-king-core", phaseCount: 3, assetKey: "boss-ink-king-core", shortStory: "墨王不是坏掉的怪物，而是一颗忘记怎样发光的森林字核。", childValue: "三阶段以恢复而非击败收束完整第一章。", hanziLearningValue: "定位结构、组合已见行为、再由完整汉字发出最后字义魔法。", neverIntroducesUnseenBehavior: true, noPermanentLoss: true, nonFrightening: true },
] as const satisfies readonly M5BossDefinition[];

export const M5_REGION_META = {
  "glimmer-grove": { title: "微光林径", sceneKey: "region-glimmer-grove", ambienceKey: "ambience-glimmer", bossId: "lantern-root-guardian", repairId: "magic-tree", behaviorIds: ["slot-veil", "hand-gust", "distractor-hold"], paths: [{ label: "灯影小径", promise: "看清灯根，再追树影", visual: "lantern-path" }, { label: "萤火桥", promise: "沿萤火走，看部件重逢", visual: "firefly-bridge" }] },
  "echo-garden": { title: "花园回声", sceneKey: "region-echo-garden", ambienceKey: "ambience-echo", bossId: "echo-bloom-guardian", repairId: "spellbook-house", behaviorIds: ["hint-fade", "ink-shell", "dual-route"], paths: [{ label: "花门路", promise: "穿过花门，听词语回声", visual: "flower-arches" }, { label: "清泉路", promise: "沿着水光，慢慢看位置", visual: "clear-stream" }] },
  "wind-trail": { title: "风的脚印", sceneKey: "region-wind-trail", ambienceKey: "ambience-wind", bossId: "wind-bell-guardian", repairId: "ink-companion-house", behaviorIds: ["mimic-flare", "companion-path", "scenery-shift"], paths: [{ label: "风铃坡", promise: "风铃带路，手牌清楚", visual: "wind-bells" }, { label: "云影桥", promise: "云影慢移，包围路亮起", visual: "cloud-bridge" }] },
} as const satisfies Readonly<Record<ChapterRegionId, { readonly title: string; readonly sceneKey: string; readonly ambienceKey: string; readonly bossId: Exclude<M5BossId, "ink-king-core">; readonly repairId: string; readonly behaviorIds: readonly [M5BehaviorId, M5BehaviorId, M5BehaviorId]; readonly paths: readonly [{ readonly label: string; readonly promise: string; readonly visual: string }, { readonly label: string; readonly promise: string; readonly visual: string }] }>>;

export function getM5Behavior(id: M5BehaviorId): M5BehaviorDefinition { const behavior = M5_BEHAVIORS.find((entry) => entry.id === id); if (!behavior) throw new Error(`Unknown M5 behavior: ${id}`); return behavior; }
export function getM5Boss(id: M5BossId): M5BossDefinition { const boss = M5_BOSSES.find((entry) => entry.id === id); if (!boss) throw new Error(`Unknown M5 boss: ${id}`); return boss; }

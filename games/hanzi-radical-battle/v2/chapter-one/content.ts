import type {
  M1AbilityDefinition,
  M1BehaviorDefinition,
  M1RegionDefinition,
} from "./types";

export const M1_ABILITIES = [
  { id: "guardian-light", name: "护字光", shortLabel: "照亮一个位置", childFacingEffect: "首领来时，先亮起一个可以观察的位置。", exactRuleEffect: "首领遭遇开始时显示一个真实空槽的轮廓，不移动牌。", neverChangesAnswer: true },
  { id: "star-path", name: "星光路标", shortLabel: "留下安全路标", childFacingEffect: "星光把下一步方向留在棋盘旁。", exactRuleEffect: "首领遭遇显示持续的安全路径标记，不选择牌或槽。", neverChangesAnswer: true },
  { id: "ink-echo", name: "墨点回声", shortLabel: "重听怪物预告", childFacingEffect: "墨点精灵把刚才的预告清楚说一遍。", exactRuleEffect: "增加一次可见的行为恢复记录，不修改手牌或 placement。", neverChangesAnswer: true },
  { id: "root-anchor", name: "树根锚", shortLabel: "稳住一张字灵", childFacingEffect: "一张目标字灵被柔光树根稳稳托住。", exactRuleEffect: "标记一张目标牌不受视觉位移影响；其 glyph、slot 与答案不变。", neverChangesAnswer: true },
  { id: "moon-rest", name: "月光歇脚", shortLabel: "得到一枚专注光", childFacingEffect: "首领前得到一枚不计分的专注光。", exactRuleEffect: "focusTokens 增加 1，只作为可见状态，不消耗或评分。", neverChangesAnswer: true },
  { id: "bloom-step", name: "花开一步", shortLabel: "先看见魔法影子", childFacingEffect: "第一个正确部件落下时，字义魔法先露出一束影子。", exactRuleEffect: "meaningPreviewVisible 变为 true，不显示完整答案。", neverChangesAnswer: true },
  { id: "clear-stream", name: "清泉圈", shortLabel: "多一次恢复", childFacingEffect: "清泉为怪物干扰留下一次温和恢复。", exactRuleEffect: "recoveryTokens 增加 1；恢复仍需玩家操作。", neverChangesAnswer: true },
  { id: "echo-pouch", name: "回声袋", shortLabel: "收回一张牌", childFacingEffect: "可把刚放下的一张牌轻轻收回手里。", exactRuleEffect: "returnedCardCount 增加 1，表示一次可撤回机会，不自动放牌。", neverChangesAnswer: true },
  { id: "wind-swap", name: "顺风换位", shortLabel: "重新排好手牌", childFacingEffect: "风把五张字灵排成另一种清楚顺序。", exactRuleEffect: "handRotation 增加 1；只改变显示次序。", neverChangesAnswer: true },
] as const satisfies readonly M1AbilityDefinition[];

export const M1_BEHAVIORS = [
  { id: "ink-mist", name: "墨雾", telegraph: "墨怪吐出薄薄墨雾，必要的字灵和槽位仍会发光。", effect: "背景变暗一层，目标牌与所有槽位保持可见。", guaranteedRecovery: "按“吹散墨雾”或 Enter，完整可见状态立即恢复。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
  { id: "playful-gust", name: "调皮风", telegraph: "风要把手牌转一圈，牌面不会翻转。", effect: "五张牌的显示顺序循环移动，字形与实例 ID 不变。", guaranteedRecovery: "按“稳住手牌”或 Enter，允许从新顺序继续。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
  { id: "vine-snare", name: "藤蔓结", telegraph: "藤蔓只会缠住一张干扰牌，不碰目标字灵。", effect: "一张 distractor 暂时标记为休息，所有目标牌仍可操作。", guaranteedRecovery: "按“松开藤蔓”或 Enter 后，五张牌全部可操作。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
  { id: "echo-ripple", name: "回声波", telegraph: "回声会把提示轻轻重复一次。", effect: "提示区出现第二道波纹，规则和牌面不变。", guaranteedRecovery: "按“听清了”或 Enter，波纹消退并进入棋盘。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
  { id: "shadow-puddle", name: "影子水洼", telegraph: "脚边出现影子水洼，它不盖住结构板。", effect: "世界地面出现暗色水洼，board 层保持最高可读对比。", guaranteedRecovery: "按“跨过去”或 Enter，水洼退到背景。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
  { id: "sleepy-spore", name: "瞌睡孢子", telegraph: "孢子让世界慢下来，不会倒计时。", effect: "非必要动画暂停，按钮、焦点和结构信息保持完整。", guaranteedRecovery: "按“醒一醒”或 Enter，立即回到可操作棋盘。", keyboardRecovery: true, touchRecovery: true, neverChangesAnswer: true, neverIntroducedFirstAtBoss: true },
] as const satisfies readonly M1BehaviorDefinition[];

export const M1_REGIONS = [
  {
    id: "glimmer-grove",
    adventureId: "glimmer-path",
    title: "微光林径",
    childValue: "先在灯影和萤火间选一条看得懂的路。",
    hanziLearningValue: "用明、花、林、星迁移左右与上下结构。",
    paths: [
      { id: "glimmer-lanterns", regionId: "glimmer-grove", label: "灯影小径", shortPromise: "路标清楚，先看树影", visualKey: "lantern-path", encounterOrder: ["v1-ming", "v1-hua", "v1-lin", "v1-xing"], behaviorOrder: ["ink-mist", "playful-gust", "vine-snare", "ink-mist"] },
      { id: "glimmer-fireflies", regionId: "glimmer-grove", label: "萤火桥", shortPromise: "萤火闪动，先听花声", visualKey: "firefly-bridge", encounterOrder: ["v1-hua", "v1-ming", "v1-lin", "v1-xing"], behaviorOrder: ["playful-gust", "echo-ripple", "shadow-puddle", "playful-gust"] },
    ],
  },
  {
    id: "echo-garden",
    adventureId: "garden-echo",
    title: "花园回声",
    childValue: "在拱门和小溪之间选择新的世界景色。",
    hanziLearningValue: "用草、看、园、回复习上下并进入完整包围。",
    paths: [
      { id: "garden-arches", regionId: "echo-garden", label: "花门路", shortPromise: "穿过拱门，听见回声", visualKey: "flower-arches", encounterOrder: ["v1-cao", "v1-kan", "v1-yuan", "v1-hui"], behaviorOrder: ["echo-ripple", "shadow-puddle", "sleepy-spore", "echo-ripple"] },
      { id: "garden-stream", regionId: "echo-garden", label: "清泉路", shortPromise: "沿着水光，先看花叶", visualKey: "clear-stream", encounterOrder: ["v1-kan", "v1-cao", "v1-yuan", "v1-hui"], behaviorOrder: ["vine-snare", "ink-mist", "playful-gust", "vine-snare"] },
    ],
  },
  {
    id: "wind-trail",
    adventureId: "wind-footprints",
    title: "风的脚印",
    childValue: "追风铃或云影，给最后一段冒险一个自己的方向。",
    hanziLearningValue: "用包、风、猫、跑迁移半包围与左右结构。",
    paths: [
      { id: "wind-bells", regionId: "wind-trail", label: "风铃坡", shortPromise: "铃声带路，脚印清楚", visualKey: "wind-bells", encounterOrder: ["v1-bao", "v1-feng", "v1-mao", "v1-pao"], behaviorOrder: ["shadow-puddle", "sleepy-spore", "ink-mist", "shadow-puddle"] },
      { id: "wind-clouds", regionId: "wind-trail", label: "云影桥", shortPromise: "云影慢移，藤叶让路", visualKey: "cloud-bridge", encounterOrder: ["v1-feng", "v1-bao", "v1-mao", "v1-pao"], behaviorOrder: ["sleepy-spore", "echo-ripple", "vine-snare", "sleepy-spore"] },
    ],
  },
] as const satisfies readonly M1RegionDefinition[];

export function getM1Ability(id: M1AbilityDefinition["id"]): M1AbilityDefinition {
  const result = M1_ABILITIES.find((entry) => entry.id === id);
  if (!result) throw new Error(`Unknown M1 ability: ${id}`);
  return result;
}

export function getM1Behavior(id: M1BehaviorDefinition["id"]): M1BehaviorDefinition {
  const result = M1_BEHAVIORS.find((entry) => entry.id === id);
  if (!result) throw new Error(`Unknown M1 behavior: ${id}`);
  return result;
}

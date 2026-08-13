export type M3HeroId = "light-speaker" | "forest-speaker" | "ink-companion";
export type M3AbilityTrigger = "on-select" | "boss-telegraph" | "behavior-recovered" | "first-correct-placement" | "composition" | "meaning";
export type M3AbilityEffectKey =
  | "guidedSlotCount"
  | "pathPreviewCount"
  | "intentEchoCount"
  | "rootGuardCount"
  | "undoReserveCount"
  | "handOrderShiftCount"
  | "meaningGlimpseCount"
  | "wordEchoCount"
  | "calmFieldCount"
  | "enclosureRibbonCount"
  | "sharedPartGrowthCount"
  | "structureLanternCount"
  | "recoveryLeafCount"
  | "wordLanternCount"
  | "nextShapeCount"
  | "inkShieldCount"
  | "secondLookCount"
  | "repairPreviewCount";

export type M3AbilityId =
  | "guided-slot"
  | "path-window"
  | "intent-echo"
  | "root-guard"
  | "gentle-undo"
  | "wind-order"
  | "meaning-glimpse"
  | "word-echo"
  | "calm-field"
  | "enclosure-ribbon"
  | "shared-part"
  | "structure-lantern"
  | "recovery-leaf"
  | "word-lantern"
  | "next-shape"
  | "ink-shield"
  | "second-look"
  | "repair-preview";

export interface M3HeroDefinition {
  readonly id: M3HeroId;
  readonly saveId: `hero:${M3HeroId}`;
  readonly name: string;
  readonly shortDescription: string;
  readonly iconKey: string;
  readonly worldMarkKey: string;
  readonly innateAbilityId: string;
  readonly innateName: string;
  readonly innateDescription: string;
  readonly exactRule: string;
  readonly childValue: string;
  readonly hanziLearningValue: string;
  readonly neverChangesAnswer: true;
}

export interface M3AbilityDefinition {
  readonly id: M3AbilityId;
  readonly saveId: `ability:${M3AbilityId}`;
  readonly name: string;
  readonly childDescription: string;
  readonly iconKey: string;
  readonly trigger: M3AbilityTrigger;
  readonly effectKey: M3AbilityEffectKey;
  readonly exactRule: string;
  readonly visibleEffect: string;
  readonly neverAutoSolves: true;
  readonly neverChangesAnswer: true;
  readonly noProbability: true;
  readonly noRarity: true;
  readonly noPrice: true;
}

export const M3_HEROES = [
  {
    id: "light-speaker", saveId: "hero:light-speaker", name: "光语魔法师", shortDescription: "第一步会留下清楚光路。", iconKey: "hero-light-speaker", worldMarkKey: "world-mark-light", innateAbilityId: "innate:first-light-trail", innateName: "初光路", innateDescription: "每个字的第一次正确放置都会留下光路。", exactRule: "每场首次合法 placement 增加 lightTrailCount；不选择牌、不放置下一部件。", childValue: "最稳定、最容易看懂的第一位伙伴。", hanziLearningValue: "强化第一次真实位置反馈而不泄漏其余答案。", neverChangesAnswer: true,
  },
  {
    id: "forest-speaker", saveId: "hero:forest-speaker", name: "森语魔法师", shortDescription: "再遇到见过的部件会长出新叶。", iconKey: "hero-forest-speaker", worldMarkKey: "world-mark-forest", innateAbilityId: "innate:shared-part-growth", innateName: "部件新芽", innateDescription: "本局再次遇到已见部件时长出一片新叶。", exactRule: "合法 placement 的 sourceGlyph 已在 seenComponentGlyphs 时增加 growthLinkCount；仍须玩家完成当前字。", childValue: "让重复部件像森林线索一样被发现。", hanziLearningValue: "显出跨字重复部件，但不把它解释成字源。", neverChangesAnswer: true,
  },
  {
    id: "ink-companion", saveId: "hero:ink-companion", name: "墨点伙伴师", shortDescription: "预告更清楚，也会守住第一块字灵。", iconKey: "hero-ink-companion", worldMarkKey: "world-mark-ink", innateAbilityId: "innate:companion-guard", innateName: "墨点守望", innateDescription: "墨点把预告说清楚，并守护第一块正确字灵。", exactRule: "行为预告增加 intentDetailCount；每场首次合法 placement 增加 companionShieldCount；不屏蔽目标信息。", childValue: "给想先观察再行动的孩子一个温和伙伴。", hanziLearningValue: "保护已正确放置的实例而不修改结构与答案。", neverChangesAnswer: true,
  },
] as const satisfies readonly M3HeroDefinition[];

export const M3_BUILD_ABILITIES = [
  { id: "guided-slot", saveId: "ability:guided-slot", name: "引位光", childDescription: "首领出现时，一个真实空位会亮起轮廓。", iconKey: "ability-guided-slot", trigger: "boss-telegraph", effectKey: "guidedSlotCount", exactRule: "显示一个真实 slot 的轮廓；不选择牌或移动牌。", visibleEffect: "结构板出现一圈金色位置光。" },
  { id: "path-window", saveId: "ability:path-window", name: "路光窗", childDescription: "选好后，看见下一段路的结构种类。", iconKey: "ability-path-window", trigger: "on-select", effectKey: "pathPreviewCount", exactRule: "显示下一 encounter 的 structure label；不显示部件或目标字。", visibleEffect: "路线边出现下一种结构的小窗。" },
  { id: "intent-echo", saveId: "ability:intent-echo", name: "预告回声", childDescription: "首领的动作会再清楚说一遍。", iconKey: "ability-intent-echo", trigger: "boss-telegraph", effectKey: "intentEchoCount", exactRule: "复制行为恢复说明到可见回声区；规则状态不变。", visibleEffect: "预告卡增加一条可读回声。" },
  { id: "root-guard", saveId: "ability:root-guard", name: "根系守护", childDescription: "第一块放对的字灵会被树根稳稳托住。", iconKey: "ability-root-guard", trigger: "first-correct-placement", effectKey: "rootGuardCount", exactRule: "标记首个合法 placement 为 protected；不补全其他 slot。", visibleEffect: "已放部件下出现树根守护标记。" },
  { id: "gentle-undo", saveId: "ability:gentle-undo", name: "轻收回", childDescription: "本区首领前多留一枚清楚的收回标记。", iconKey: "ability-gentle-undo", trigger: "on-select", effectKey: "undoReserveCount", exactRule: "增加可见 undo reserve；收回仍由玩家操作，且只移除最近 placement。", visibleEffect: "收回按钮旁出现一枚叶形标记。" },
  { id: "wind-order", saveId: "ability:wind-order", name: "风排牌", childDescription: "干扰散开后，五张牌会排成新的清楚顺序。", iconKey: "ability-wind-order", trigger: "behavior-recovered", effectKey: "handOrderShiftCount", exactRule: "循环移动 hand display order；card instance、glyph 和 expectedSlotId 不变。", visibleEffect: "手牌沿风线平移一格。" },
  { id: "meaning-glimpse", saveId: "ability:meaning-glimpse", name: "魔法微光", childDescription: "第一块放对时，字义魔法先露出名字。", iconKey: "ability-meaning-glimpse", trigger: "first-correct-placement", effectKey: "meaningGlimpseCount", exactRule: "显示 magicName；不显示完整字、词、读音或剩余部件。", visibleEffect: "棋盘旁出现一束带魔法名的微光。" },
  { id: "word-echo", saveId: "ability:word-echo", name: "词语回声", childDescription: "完整字形成后，可以再听一次汉字和熟悉词。", iconKey: "ability-word-echo", trigger: "composition", effectKey: "wordEchoCount", exactRule: "开放 spokenPhrase replay 状态；不朗读拼音或提前读答案。", visibleEffect: "完整字旁出现可见回声按钮。" },
  { id: "calm-field", saveId: "ability:calm-field", name: "安静结界", childDescription: "首领区的非必要动作会慢下来。", iconKey: "ability-calm-field", trigger: "on-select", effectKey: "calmFieldCount", exactRule: "为非必要视觉层设置 calm flag；输入、规则与信息不延迟。", visibleEffect: "世界边缘出现静稳光罩。" },
  { id: "enclosure-ribbon", saveId: "ability:enclosure-ribbon", name: "框内路", childDescription: "遇到包围字时，外框和里面会连成一条路。", iconKey: "ability-enclosure-ribbon", trigger: "first-correct-placement", effectKey: "enclosureRibbonCount", exactRule: "包围结构显示 outer→inner 顺序带；其他结构显示已有 slot order；不选择卡。", visibleEffect: "结构槽之间出现顺序丝带。" },
  { id: "shared-part", saveId: "ability:shared-part", name: "同伴生长", childDescription: "见过的部件再次出现时，会留下成长记号。", iconKey: "ability-shared-part", trigger: "first-correct-placement", effectKey: "sharedPartGrowthCount", exactRule: "比较 sourceGlyph 与 seenComponentGlyphs 并显示 reused marker；无论是否重复都不修改答案。", visibleEffect: "重复部件旁长出一片小叶。" },
  { id: "structure-lantern", saveId: "ability:structure-lantern", name: "结构灯", childDescription: "首领预告会说清这是哪一种结构。", iconKey: "ability-structure-lantern", trigger: "boss-telegraph", effectKey: "structureLanternCount", exactRule: "显示 current character structure label；不显示 component glyph。", visibleEffect: "预告卡亮起左右、上下或包围标签。" },
  { id: "recovery-leaf", saveId: "ability:recovery-leaf", name: "复原叶", childDescription: "干扰恢复后，留下一片已经安全的叶子。", iconKey: "ability-recovery-leaf", trigger: "behavior-recovered", effectKey: "recoveryLeafCount", exactRule: "记录 behavior recovered 并显示 safe marker；仍需玩家主动按恢复。", visibleEffect: "怪物预告退场后留下绿色安全叶。" },
  { id: "word-lantern", saveId: "ability:word-lantern", name: "词语灯", childDescription: "完整字形成时，熟悉词会在旁边亮起。", iconKey: "ability-word-lantern", trigger: "composition", effectKey: "wordLanternCount", exactRule: "composition phase 显示 familiarWord；不提前显示或完成汉字。", visibleEffect: "完整字旁出现一盏熟悉词灯。" },
  { id: "next-shape", saveId: "ability:next-shape", name: "前路形", childDescription: "首领预告时，看见下一步仍会用真实位置。", iconKey: "ability-next-shape", trigger: "boss-telegraph", effectKey: "nextShapeCount", exactRule: "显示当前 slotIds 的无字形轮廓数量；不显示卡或 glyph。", visibleEffect: "预告下方出现空槽剪影。" },
  { id: "ink-shield", saveId: "ability:ink-shield", name: "墨点护牌", childDescription: "一张目标字灵会一直保持清楚可读。", iconKey: "ability-ink-shield", trigger: "boss-telegraph", effectKey: "inkShieldCount", exactRule: "标记第一张 target card 为 visualProtected；behavior 不得遮挡它，仍由玩家选择。", visibleEffect: "目标牌角出现墨点盾标记。" },
  { id: "second-look", saveId: "ability:second-look", name: "再看一眼", childDescription: "干扰散开后，棋盘会保持安静供你再看。", iconKey: "ability-second-look", trigger: "behavior-recovered", effectKey: "secondLookCount", exactRule: "设置 inspectionReady flag；没有倒计时、自动动作或输入锁。", visibleEffect: "棋盘出现“慢慢看”的静态眼形标记。" },
  { id: "repair-preview", saveId: "ability:repair-preview", name: "营地微光", childDescription: "字义魔法出现时，会先照亮本区修复影子。", iconKey: "ability-repair-preview", trigger: "meaning", effectKey: "repairPreviewCount", exactRule: "显示本区 repair preview key；不授予货币或提前完成区域。", visibleEffect: "字义魔法后方显出营地修复剪影。" },
].map((entry) => ({ ...entry, neverAutoSolves: true, neverChangesAnswer: true, noProbability: true, noRarity: true, noPrice: true })) as readonly M3AbilityDefinition[];

export function getM3Hero(id: M3HeroId): M3HeroDefinition {
  const hero = M3_HEROES.find((entry) => entry.id === id);
  if (!hero) throw new Error(`Unknown M3 hero: ${id}`);
  return hero;
}

export function getM3Ability(id: M3AbilityId): M3AbilityDefinition {
  const ability = M3_BUILD_ABILITIES.find((entry) => entry.id === id);
  if (!ability) throw new Error(`Unknown M3 ability: ${id}`);
  return ability;
}

import type { AbilityId, GoldenAbility } from "./types";

export const GOLDEN_ABILITIES: readonly GoldenAbility[] = [
  {
    id: "guardian-light",
    name: "护字光",
    timing: "wrong-placement",
    usesPerBossPhase: 1,
    exactEffect: "每个首领阶段第一次放错位置时，只点亮该牌正确槽位轮廓；不移动任何牌，也不完成汉字。",
    neverAutoSolves: true,
  },
  {
    id: "star-path",
    name: "星光路标",
    timing: "boss-phase-start",
    usesPerBossPhase: 1,
    exactEffect: "每个首领阶段开始时，自动点亮一个未填的真实槽位；不选择、不移动、不放入任何部件。",
    neverAutoSolves: true,
  },
  {
    id: "ink-echo",
    name: "墨点回声",
    timing: "boss-interference",
    usesPerBossPhase: 1,
    exactEffect: "每个首领阶段的干扰中可重听路径并恢复干扰前的棋盘快照；不会补牌、代放部件或完成汉字。",
    neverAutoSolves: true,
  },
] as const;

export function getGoldenAbility(id: AbilityId): GoldenAbility {
  const ability = GOLDEN_ABILITIES.find((entry) => entry.id === id);
  if (!ability) throw new Error(`Unknown golden-slice ability: ${id}`);
  return ability;
}

import type { BossPhaseRule } from "./types";

export const GOLDEN_BOSS_PHASES: readonly BossPhaseRule[] = [
  {
    id: "lin",
    encounterId: "boss-lin",
    intent: "迷墨短暂遮住空槽轮廓，邀请孩子等轮廓回来后继续。",
    interference: "obscure-empty-slot-outlines",
    trigger: "after-first-correct-placement",
    recovery: "interference-complete",
    neverAutoSolves: true,
  },
  {
    id: "xing",
    encounterId: "boss-xing",
    intent: "迷墨短暂遮住空槽轮廓，邀请孩子等轮廓回来后继续。",
    interference: "obscure-empty-slot-outlines",
    trigger: "after-first-correct-placement",
    recovery: "interference-complete",
    neverAutoSolves: true,
  },
] as const;

import type { PacingBeat } from "./types";

export const GOLDEN_SLICE_PACING: readonly PacingBeat[] = [
  { id: "camp-and-first-spell", minimumSeconds: 45, maximumSeconds: 60, purpose: "60 秒内完成第一次合字施法" },
  { id: "hua-and-choice", minimumSeconds: 35, maximumSeconds: 50, purpose: "第二次合字后作一次三选一" },
  { id: "lin-boss-phase", minimumSeconds: 35, maximumSeconds: 55, purpose: "小首领第一阶段和可恢复干扰" },
  { id: "xing-boss-phase", minimumSeconds: 35, maximumSeconds: 55, purpose: "小首领第二阶段和星光收束" },
  { id: "return-and-spellbook", minimumSeconds: 30, maximumSeconds: 45, purpose: "修复营地并把新字放入魔法书" },
] as const;

export const GOLDEN_SLICE_PACING_CONTRACT = {
  targetMinutes: { minimum: 3, maximum: 5 },
  firstSpellBySeconds: 60,
  firstRunCharacterIds: ["ming", "hua", "lin", "xing"],
  totalMinimumSeconds: GOLDEN_SLICE_PACING.reduce((total, beat) => total + beat.minimumSeconds, 0),
  totalMaximumSeconds: GOLDEN_SLICE_PACING.reduce((total, beat) => total + beat.maximumSeconds, 0),
  noCountdownPressure: true,
} as const;

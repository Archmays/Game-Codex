import type { GameDefinition } from "../../../packages/game-core";
import { MATH_WORLD_STATION_IDS, type MathWorldStationId } from "./world-save";

export interface MathWorldActivity {
  readonly id: MathWorldStationId;
  readonly title: string;
  readonly place: string;
  readonly description: string;
  readonly accent: string;
  readonly load: () => Promise<GameDefinition>;
}

export const MATH_WORLD_ACTIVITIES: readonly MathWorldActivity[] = [
  {
    id: "slider",
    title: "算式滑轨站",
    place: "城市火车站",
    description: "移动数字和运算滑轨，让等式的两边重新平衡。",
    accent: "rail",
    load: async () => (await import("../../equation-slider")).equationSliderGame,
  },
  {
    id: "target",
    title: "目标工坊",
    place: "数字牌屋",
    description: "按顺序组合四张牌，尝试抵达 10、12 或 24。",
    accent: "gold",
    load: async () => (await import("../../make-target")).makeTargetGame,
  },
] as const;

if (MATH_WORLD_ACTIVITIES.length !== MATH_WORLD_STATION_IDS.length
  || MATH_WORLD_STATION_IDS.some((id) => !MATH_WORLD_ACTIVITIES.some((activity) => activity.id === id))) {
  throw new Error("Math World activity registry is incomplete");
}

export function findMathWorldActivity(id: string | null): MathWorldActivity | null {
  return MATH_WORLD_ACTIVITIES.find((activity) => activity.id === id) ?? null;
}

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
    id: "lab",
    title: "数感实验室",
    place: "苹果园与小河",
    description: "在故事场景里摆一摆、算一算，寻找数量之间的关系。",
    accent: "leaf",
    load: async () => (await import("../index")).mathLabGame,
  },
  {
    id: "clock",
    title: "时钟塔",
    place: "城市钟楼",
    description: "拨动同一座钟，看长针与短针怎样一起表示时间。",
    accent: "sky",
    load: async () => (await import("../../clock-reader")).clockReaderGame,
  },
  {
    id: "array",
    title: "阵列工坊",
    place: "方格工房",
    description: "搭建并翻转行列阵列，从方格本身看见乘法关系。",
    accent: "clay",
    load: async () => (await import("../../multiplication-adventure")).multiplicationAdventureGame,
  },
  {
    id: "target",
    title: "目标工坊",
    place: "数字牌屋",
    description: "按顺序组合四张牌，尝试抵达 10、12 或 24。",
    accent: "gold",
    load: async () => (await import("../../make-target")).makeTargetGame,
  },
  {
    id: "slider",
    title: "算式滑轨站",
    place: "城市火车站",
    description: "移动数字和运算滑轨，让等式的两边重新平衡。",
    accent: "rail",
    load: async () => (await import("../../equation-slider")).equationSliderGame,
  },
] as const;

if (MATH_WORLD_ACTIVITIES.length !== MATH_WORLD_STATION_IDS.length
  || MATH_WORLD_STATION_IDS.some((id) => !MATH_WORLD_ACTIVITIES.some((activity) => activity.id === id))) {
  throw new Error("Math World activity registry is incomplete");
}

export function findMathWorldActivity(id: string | null): MathWorldActivity | null {
  return MATH_WORLD_ACTIVITIES.find((activity) => activity.id === id) ?? null;
}

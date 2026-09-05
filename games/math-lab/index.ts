import type { GameDefinition } from "../../packages/game-core";
import { mountMathWorld } from "./world";

export const mathLabGame: GameDefinition = {
  id: "math-lab",
  title: "数学世界",
  description: "进入数感实验城，选择算式滑轨站或目标工坊。",
  subject: "数学",
  recommendedAge: "6-9 岁",
  learningGoal: "通过算式滑轨和数字牌探索数学关系。",
  status: "可玩",
  playLabel: "进入数学世界",
  route: "?world=math-world&from=hub",
  // Stable catalog identity for the navigation shell; never a station loader.
  mount: ({ container }) => mountMathWorld(container),
};

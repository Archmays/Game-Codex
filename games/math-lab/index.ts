import Phaser from "phaser";
import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { gameConfig } from "../../src/game/config";

export const mathLabGame: GameDefinition = {
  id: "math-lab",
  title: "数学世界",
  description: "进入数感实验城，在实验室、时钟塔、阵列工坊、目标工坊和算式滑轨站探索数学关系。",
  subject: "数学",
  recommendedAge: "6-9 岁",
  learningGoal: "通过可直接操作的场景、时钟、阵列、数字牌和算式滑轨理解数学关系。",
  status: "可玩",
  playLabel: "进入数学世界",
  route: "?world=math-world&from=hub",
  mount(context: MountGameContext): MountedGame {
    return mountMathLab(context);
  }
};

function mountMathLab(context: MountGameContext): MountedGame {
  const gameRoot = document.createElement("div");
  gameRoot.id = "game-root";
  gameRoot.setAttribute("aria-label", "儿童数学实验室游戏");
  context.container.append(gameRoot);

  const game = new Phaser.Game(gameConfig);

  return {
    destroy(): void {
      game.destroy(true);
      gameRoot.remove();
    }
  };
}

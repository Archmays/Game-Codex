import type { GameDefinition, MountedGame } from "../../packages/game-core";

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
  mount({ container, onExit }) {
    let disposed = false;
    let mounted: MountedGame | undefined;
    container.innerHTML = '<p role="status">正在打开数学世界……</p>';
    void import("./world").then(({ mountMathWorld }) => {
      if (!disposed) mounted = mountMathWorld(container);
    }).catch(() => {
      if (disposed) return;
      container.innerHTML = '<p role="alert">数学世界暂时没有打开。</p><button type="button">返回</button>';
      container.querySelector("button")!.addEventListener("click", onExit);
    });
    return {
      destroy() {
        if (disposed) return;
        disposed = true;
        mounted?.destroy();
        mounted = undefined;
        container.replaceChildren();
      },
    };
  },
};

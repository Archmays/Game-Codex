import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { mountMemoryMatch } from "../../packages/activity-engines/memory-match";

export const memoryCardGame: GameDefinition = {
  id: "memory-card",
  title: "记忆配对",
  description: "翻开两张卡，找到同字、字音或词语之间的关系。",
  subject: "识字",
  recommendedAge: "4-8 岁",
  learningGoal: "通过关系配对练习观察、记忆和汉字认读。",
  status: "可玩",
  playLabel: "开始配对",
  mount(context: MountGameContext): MountedGame {
    const root = document.createElement("div");
    context.container.append(root);
    const mounted = mountMemoryMatch(root, { context: "classic", packId: "same-glyph" });
    return { destroy() { mounted.destroy(); root.remove(); } };
  },
};

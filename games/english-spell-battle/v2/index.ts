import type { GameDefinition } from "../../../packages/game-core";
import { englishSpellBattleGame as legacyEnglishSpellBattleGame } from "..";

export const englishSpellBattleGame: GameDefinition = {
  id: "english-spell-battle",
  title: "英语世界",
  description: "走进词光岛，把词义、拼写块和极短句连起来，让五个地方重新发光。",
  subject: "英语",
  recommendedAge: "5-9 岁",
  learningGoal: "通过图像、可见拼写单元和短句语境理解并使用常见英语词汇。",
  status: "英语世界 V2",
  playLabel: "进入词光岛",
  route: "?world=english-world&from=hub",
  mount: legacyEnglishSpellBattleGame.mount,
};

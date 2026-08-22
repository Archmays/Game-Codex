import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { mountSoundRhymeTrial } from "../hanzi-radical-battle/complete/support/pinyin/app";

/** Kept in allGameDefinitions for save/route compatibility; its Classic card is retired. */
export const pinyinMagicBattleGame: GameDefinition = {
  id: "pinyin-magic-battle",
  title: "声韵试炼",
  description: "在熟悉字词里拼声韵、辨声调、比较容易混淆的读音。",
  subject: "识字",
  recommendedAge: "6-8 岁",
  learningGoal: "在固定词境中观察规范拼音的声母、韵母和声调。",
  status: "已并入墨迹森林",
  playLabel: "走声韵小径",
  route: "?play=hanzi-magic-complete&view=pinyin",
  mount(context: MountGameContext): MountedGame {
    const root = document.createElement("div");
    context.container.append(root);
    const mounted = mountSoundRhymeTrial(root, { mode: "assemble", returnHref: "?hub=classic&from=world" });
    return { destroy() { mounted.destroy(); root.remove(); } };
  },
};

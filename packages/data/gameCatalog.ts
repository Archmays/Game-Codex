import type { GameDefinition } from "../game-core";
import { clockReaderGame } from "../../games/clock-reader";
import { equationSliderGame } from "../../games/equation-slider";
import { englishSpellBattleGame } from "../../games/english-spell-battle";
import { hanziRadicalBattleGame } from "../../games/hanzi-radical-battle";
import { hanziWheelGame } from "../../games/hanzi-wheel";
import { makeTargetGame } from "../../games/make-target";
import { mathLabGame } from "../../games/math-lab";
import { memoryCardGame } from "../../games/memory-card";
import { multiplicationAdventureGame } from "../../games/multiplication-adventure";
import { pinyinMagicBattleGame } from "../../games/pinyin-magic-battle";

export const gameCatalog: GameDefinition[] = [
  memoryCardGame,
  mathLabGame,
  hanziWheelGame,
  hanziRadicalBattleGame,
  multiplicationAdventureGame,
  englishSpellBattleGame,
  clockReaderGame,
  makeTargetGame,
  equationSliderGame,
  pinyinMagicBattleGame
];

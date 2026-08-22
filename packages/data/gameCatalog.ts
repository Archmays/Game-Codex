import type { GameDefinition } from "../game-core";
import { clockReaderGame } from "../../games/clock-reader";
import { equationSliderGame } from "../../games/equation-slider";
import { englishSpellBattleGame } from "../../games/english-spell-battle/v2";
import { hanziRadicalBattleGame } from "../../games/hanzi-radical-battle";
import { makeTargetGame } from "../../games/make-target";
import { mathLabGame } from "../../games/math-lab";
import { memoryCardGame } from "../../games/memory-card";
import { multiplicationAdventureGame } from "../../games/multiplication-adventure";
import { pinyinMagicBattleGame } from "../../games/pinyin-magic-battle";
import { GAME_PORTFOLIO_BY_ID } from "./gamePortfolio";

export const allGameDefinitions: GameDefinition[] = [
  memoryCardGame,
  mathLabGame,
  hanziRadicalBattleGame,
  multiplicationAdventureGame,
  englishSpellBattleGame,
  clockReaderGame,
  makeTargetGame,
  equationSliderGame,
  pinyinMagicBattleGame
];

export const classicGameCatalog: GameDefinition[] = allGameDefinitions.filter(
  (game) => GAME_PORTFOLIO_BY_ID.get(game.id)?.currentStandaloneVisible === true,
);

/** Compatibility aliases for existing consumers; use the explicit names above in new code. */
export const gameCatalog = allGameDefinitions;
export const currentClassicGameCatalog = classicGameCatalog;

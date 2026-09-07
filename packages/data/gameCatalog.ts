import type { GameDefinition } from "../game-core";
import { equationSliderGame } from "../../games/equation-slider";
import { hanziTowerDefenseGame } from "../../games/hanzi-tower-defense";
import { makeTargetGame } from "../../games/make-target";
import { mathLabGame } from "../../games/math-lab";
import { memoryCardGame } from "../../games/memory-card";
import { GAME_PORTFOLIO_BY_ID } from "./gamePortfolio";

export const allGameDefinitions: GameDefinition[] = [
  memoryCardGame,
  mathLabGame,
  hanziTowerDefenseGame,
  makeTargetGame,
  equationSliderGame
];

export const classicGameCatalog: GameDefinition[] = allGameDefinitions
  .filter((game) => GAME_PORTFOLIO_BY_ID.get(game.id)?.classicCardVisible === true)
  .sort((left, right) =>
    (GAME_PORTFOLIO_BY_ID.get(left.id)?.childProductOrder ?? Number.MAX_SAFE_INTEGER)
      - (GAME_PORTFOLIO_BY_ID.get(right.id)?.childProductOrder ?? Number.MAX_SAFE_INTEGER));

/** Compatibility aliases for existing consumers; use the explicit names above in new code. */
export const gameCatalog = allGameDefinitions;
export const currentClassicGameCatalog = classicGameCatalog;

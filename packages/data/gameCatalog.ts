import { oddityPuzzlesGame } from '../../games/oddity-puzzles';
import { hanziStrokeLab } from "../../games/hanzi-stroke-lab";
import { englishStudy } from "../../games/english-study";
import { structureExplorer } from "../../games/structure-explorer";
import { worldInABoxGame } from "../../games/world-in-a-box";
import type { GameDefinition } from "../game-core";
import { equationSliderGame } from "../../games/equation-slider";
import { hanziTowerDefenseGame } from "../../games/hanzi-tower-defense/definition";
import { hanziWordAdventureGame } from "../../games/hanzi-word-adventure/definition";
import { makeTargetGame } from "../../games/make-target";
import { mathLabGame } from "../../games/math-lab";
import { memoryCardGame } from "../../games/memory-card";

export const allGameDefinitions: GameDefinition[] = [
  oddityPuzzlesGame,
  worldInABoxGame,
  hanziStrokeLab,
  englishStudy,
  structureExplorer,
  memoryCardGame,
  mathLabGame,
  hanziTowerDefenseGame,
  hanziWordAdventureGame,
  makeTargetGame,
  equationSliderGame
];

/** Compatibility aliases for existing consumers; use the explicit names above in new code. */
export const gameCatalog = allGameDefinitions;
export { classicGameCatalog, classicGameCatalog as currentClassicGameCatalog } from "./classicGameCatalog";

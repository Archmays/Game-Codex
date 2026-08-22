import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { GAME_PORTFOLIO } from "../../packages/data/gamePortfolio";
import { MATH_WORLD_ACTIVITIES } from "../../games/math-lab/world/activity-registry";
import { MATH_WORLD_SAVE_KEY } from "../../games/math-lab/world/world-save";
import { TARGET_PUZZLE_MANIFEST } from "../../games/make-target/puzzles";
import { loadGameCatalogMetadata } from "../portfolio/load-game-catalog-metadata";

const root = resolve(import.meta.dirname, "../..");
const baseline = "832696bdfbedf422edd331113044b068c896f4ef";

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(relative: string): string {
  return readFileSync(resolve(root, relative), "utf8");
}

function equationCoreChanged(): boolean {
  try {
    execFileSync("git", ["diff", "--quiet", baseline, "--", "games/equation-slider"], { cwd: root, stdio: "ignore" });
    return false;
  } catch {
    return true;
  }
}

const catalogMetadata = loadGameCatalogMetadata(root);
const definitionIds = catalogMetadata.map((game) => game.id);
const classicIds = GAME_PORTFOLIO.filter((record) => record.currentStandaloneVisible).map((record) => record.id);
requireValue(GAME_PORTFOLIO.length === 9, "Portfolio must retain nine records");
requireValue(catalogMetadata.length === 9 && new Set(definitionIds).size === 9, "allGameDefinitions must contain nine unique games");
requireValue(classicIds.length === 6 && new Set(classicIds).size === 6, "classicGameCatalog must contain six unique games after Pinyin consolidation");
requireValue(!classicIds.includes("clock-reader") && !classicIds.includes("multiplication-adventure"), "Replaced modules must be hidden from the classic catalog");
requireValue(!classicIds.includes("pinyin-magic-battle"), "Consolidated Pinyin must be hidden from the classic catalog");
requireValue(definitionIds.includes("clock-reader") && definitionIds.includes("multiplication-adventure"), "Replaced modules must remain mountable definitions");
requireValue(MATH_WORLD_ACTIVITIES.length === 5, "Math World must register five activities");
requireValue(MATH_WORLD_SAVE_KEY === "family-games/math-world/v1", "Math World save key drifted");
requireValue(TARGET_PUZZLE_MANIFEST.length === 12 && [10, 12, 24].every((target) => TARGET_PUZZLE_MANIFEST.filter((puzzle) => puzzle.target === target).length === 4), "Target manifest must publish four puzzles per target");
requireValue(!equationCoreChanged(), "Equation Slider core changed; this task only authorizes an adapter mount without the full S gate");

for (const relative of [
  "games/clock-reader/index.ts",
  "games/clock-reader/model.ts",
  "games/multiplication-adventure/index.ts",
  "games/multiplication-adventure/model.ts",
  "games/make-target/index.ts",
  "games/make-target/model.ts",
  "games/make-target/solver.ts",
  "games/make-target/puzzles.ts",
]) {
  requireValue(!source(relative).includes("Math.random("), `${relative} contains nondeterministic formal content`);
}

const clockSource = source("games/clock-reader/index.ts");
requireValue(!/连对|最佳/.test(clockSource), "Clock pressure copy returned");
const arraySource = source("games/multiplication-adventure/index.ts");
requireValue(!/bestScore|plays|import\.meta\.glob|source\//.test(arraySource), "Array workshop still contains the retired score/eager-source loop");
const targetSource = source("games/make-target/model.ts");
requireValue(!targetSource.includes("Math.abs"), "Target subtraction may not hide operand order");
const menuSource = source("src/game/scenes/MenuScene.ts");
requireValue(!/总星星|连续记录|今日练习：/.test(menuSource), "Math Lab pressure summary returned to the UI");
requireValue(!source("src/game/domain/progression/progression.ts").includes("updateStreak("), "Math Lab still updates streaks");

const assetRoot = resolve(root, "public/assets/math-world");
const runtimeAssets = readdirSync(assetRoot).filter((name) => statSync(resolve(assetRoot, name)).isFile());
const runtimeAssetBytes = runtimeAssets.reduce((total, name) => total + statSync(resolve(assetRoot, name)).size, 0);
requireValue(runtimeAssets.length <= 8, "Math World selected raster count exceeds eight");
requireValue(runtimeAssetBytes <= 14 * 1024 * 1024, "Math World tracked runtime binaries exceed 14 MiB");

const result = {
  verdict: "PASS_MACHINE",
  portfolioRecords: GAME_PORTFOLIO.length,
  allGameDefinitions: catalogMetadata.length,
  classicGameCatalog: classicIds.length,
  stations: MATH_WORLD_ACTIVITIES.map((activity) => activity.id),
  targetPuzzles: TARGET_PUZZLE_MANIFEST.length,
  equationCoreChanged: false,
  runtimeAssets,
  runtimeAssetBytes,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { GAME_PORTFOLIO } from "../../packages/data/gamePortfolio";
import { MATH_WORLD_ACTIVITIES } from "../../games/math-lab/world/activity-registry";
import { MATH_WORLD_SAVE_KEY } from "../../games/math-lab/world/world-save";
import { TARGET_PUZZLE_MANIFEST } from "../../games/make-target/puzzles";
import { loadGameCatalogMetadata } from "../portfolio/load-game-catalog-metadata";

const root = resolve(import.meta.dirname, "../..");
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(relative: string): string {
  return readFileSync(resolve(root, relative), "utf8");
}

const catalogMetadata = loadGameCatalogMetadata(root);
const definitionIds = catalogMetadata.map((game) => game.id);
const classicIds = GAME_PORTFOLIO.filter((record) => record.classicCardVisible).map((record) => record.id);
requireValue(JSON.stringify([...definitionIds].sort()) === JSON.stringify(GAME_PORTFOLIO.map(record => record.id).sort()), "Catalog and portfolio definitions must agree");
requireValue(new Set(definitionIds).size === definitionIds.length, "Definitions must be unique");
requireValue(classicIds.length === 3 && new Set(classicIds).size === 3, "classicGameCatalog must contain the three active world products");
requireValue(!classicIds.includes("equation-slider"), "Equation Slider must be a Math World module rather than a Classic card");
requireValue(!classicIds.includes("clock-reader") && !classicIds.includes("multiplication-adventure"), "Replaced modules must be hidden from the classic catalog");
requireValue(!classicIds.includes("pinyin-magic-battle"), "Consolidated Pinyin must be hidden from the classic catalog");
requireValue(!classicIds.includes("make-target") && !classicIds.includes("memory-card"), "Converged Math Target and Memory cards must be hidden from the classic catalog");
requireValue(!definitionIds.includes("clock-reader") && !definitionIds.includes("multiplication-adventure"), "Retired definitions must not remain mountable");
for (const path of ["games/clock-reader/index.ts", "games/multiplication-adventure/index.ts", "src/game/config.ts", "src/game/scenes/BootScene.ts", "public/data/levels/add-sub-mvp.json", "public/assets/generated/math-lab-stage-garden.png"]) requireValue(!existsSync(resolve(root, path)), `Retired runtime remains: ${path}`);
requireValue(JSON.stringify(MATH_WORLD_ACTIVITIES.map(activity => activity.id)) === JSON.stringify(["slider", "target"]), "Math World must register Slider then Target only");
requireValue(MATH_WORLD_SAVE_KEY === "family-games/math-world/v1", "Math World save key drifted");
requireValue(TARGET_PUZZLE_MANIFEST.length === 12 && [10, 12, 24].every((target) => TARGET_PUZZLE_MANIFEST.filter((puzzle) => puzzle.target === target).length === 4), "Target manifest must publish four puzzles per target");
const equationAudit = JSON.parse(source("games/equation-slider/levels/generated-audit.json")) as {
  sameVisibleTransitionLevelCount: number;
  initialSameVisibleMoveLevelCount: number;
  sameVisibleShortestPathBenefitLevelIds: string[];
  initialSameVisibleShortestPathBenefitLevelIds: string[];
  requiredSameVisibleMoveLevelIds: string[];
};
requireValue(equationAudit.sameVisibleTransitionLevelCount === 81, "Equation Slider same-display transition audit drifted");
requireValue(equationAudit.initialSameVisibleMoveLevelCount === 45, "Equation Slider initial same-display transition audit drifted");
requireValue(equationAudit.sameVisibleShortestPathBenefitLevelIds.length === 38, "Equation Slider shortest-path benefit classification drifted");
requireValue(equationAudit.initialSameVisibleShortestPathBenefitLevelIds.length === 21, "Equation Slider initial shortest-path benefit classification drifted");
requireValue(equationAudit.requiredSameVisibleMoveLevelIds.length === 0, "Equation Slider unexpectedly requires a no-visible-change move");

for (const relative of [
  "games/make-target/index.ts",
  "games/make-target/model.ts",
  "games/make-target/solver.ts",
  "games/make-target/puzzles.ts",
]) {
  requireValue(!source(relative).includes("Math.random("), `${relative} contains nondeterministic formal content`);
}

const targetSource = source("games/make-target/model.ts");
requireValue(!targetSource.includes("Math.abs"), "Target subtraction may not hide operand order");
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
  equationSameVisiblePolicy: "REJECT_NO_VISIBLE_CHANGE_WITH_EXPLANATION",
  equationSameVisibleAudit: { transitionLevels: equationAudit.sameVisibleTransitionLevelCount, initialLevels: equationAudit.initialSameVisibleMoveLevelCount, shortestPathBenefitLevels: equationAudit.sameVisibleShortestPathBenefitLevelIds.length, requiredLevels: equationAudit.requiredSameVisibleMoveLevelIds.length },
  runtimeAssets,
  runtimeAssetBytes,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

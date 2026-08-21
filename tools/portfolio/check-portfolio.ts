import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GAME_PORTFOLIO, PORTFOLIO_TEST_PROFILES } from "../../packages/data/gamePortfolio";
import type { GameCatalogMetadata } from "./load-game-catalog-metadata";
import { loadGameCatalogMetadata } from "./load-game-catalog-metadata";
import { renderPortfolioRoadmap, renderPortfolioStatus, renderReadmePortfolio, replaceMarkedSection } from "./portfolio-docs";

const MERGE_TARGET_LIFECYCLES = new Set(["flagship-candidate", "architecture-consolidation-candidate", "module-candidate", "shared-engine-candidate", "migrate-then-retire-standalone"]);

function duplicates(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

export function validatePortfolio(catalog: readonly GameCatalogMetadata[], currentCatalog: readonly GameCatalogMetadata[], root = resolve(import.meta.dirname, "../..")): string[] {
  const issues: string[] = [];
  if (GAME_PORTFOLIO.length !== 9) issues.push(`Expected 9 portfolio records, found ${GAME_PORTFOLIO.length}`);
  if (catalog.length !== 9) issues.push(`Expected 9 catalog games, found ${catalog.length}`);
  for (const id of duplicates(GAME_PORTFOLIO.map((record) => record.id))) issues.push(`Duplicate portfolio id: ${id}`);
  const portfolioIds = new Set(GAME_PORTFOLIO.map((record) => record.id));
  const catalogIds = new Set(catalog.map((game) => game.id));
  for (const id of portfolioIds) if (!catalogIds.has(id)) issues.push(`Portfolio id missing from catalog: ${id}`);
  for (const id of catalogIds) if (!portfolioIds.has(id)) issues.push(`Catalog id missing from portfolio: ${id}`);
  for (const route of duplicates(GAME_PORTFOLIO.flatMap((record) => record.canonicalRoute ? [record.canonicalRoute] : []))) issues.push(`Duplicate canonical route: ${route}`);
  for (const namespace of duplicates(GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces))) issues.push(`Duplicate save namespace: ${namespace}`);
  const profiles = new Map(PORTFOLIO_TEST_PROFILES.map((profile) => [profile.id, profile]));
  const tiers = new Set<string>(GAME_PORTFOLIO.map((record) => record.qualityTier));
  for (const tier of ["S", "A", "B", "C"]) if (!tiers.has(tier)) issues.push(`Missing quality tier: ${tier}`);
  for (const record of GAME_PORTFOLIO) {
    const profile = profiles.get(record.testProfile);
    if (!profile) issues.push(`${record.id} uses unknown test profile ${record.testProfile}`);
    else if (profile.qualityTier !== record.qualityTier) issues.push(`${record.id} tier/profile mismatch`);
    if (MERGE_TARGET_LIFECYCLES.has(record.lifecycleStatus) && !record.mergeTarget) issues.push(`${record.id} lifecycle requires mergeTarget`);
    if (record.lifecycleStatus === "migrate-then-retire-standalone" && !record.currentStandaloneVisible) issues.push(`${record.id} migration candidate must remain currently visible`);
    for (const doc of record.canonicalDocs) if (!existsSync(resolve(root, doc))) issues.push(`${record.id} canonical doc does not exist: ${doc}`);
  }
  const visiblePortfolio = GAME_PORTFOLIO.filter((record) => record.currentStandaloneVisible).map((record) => record.id).sort();
  const visibleCatalog = currentCatalog.map((game) => game.id).sort();
  if (JSON.stringify(visiblePortfolio) !== JSON.stringify(visibleCatalog)) issues.push("Current classic-hub visibility differs from Portfolio");
  return issues;
}

export function checkGeneratedDocs(root = resolve(import.meta.dirname, "../.."), catalog = loadGameCatalogMetadata(root)): string[] {
  const issues: string[] = [];
  const readmePath = resolve(root, "README.md");
  const statusPath = resolve(root, "docs/project-status/portfolio-status.md");
  const roadmapPath = resolve(root, "docs/project-status/portfolio-roadmap.md");
  const readme = readFileSync(readmePath, "utf8");
  if (replaceMarkedSection(readme, renderReadmePortfolio(catalog)) !== readme) issues.push("README portfolio section has drifted");
  if (!existsSync(statusPath) || readFileSync(statusPath, "utf8") !== renderPortfolioStatus(catalog)) issues.push("Portfolio status has drifted");
  if (!existsSync(roadmapPath) || readFileSync(roadmapPath, "utf8") !== renderPortfolioRoadmap()) issues.push("Portfolio roadmap has drifted");
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const root = resolve(import.meta.dirname, "../..");
  const gameCatalog = loadGameCatalogMetadata(root);
  const currentClassicCatalog = gameCatalog.filter((game) => GAME_PORTFOLIO.find((record) => record.id === game.id)?.currentStandaloneVisible);
  const issues = [...validatePortfolio(gameCatalog, currentClassicCatalog, root), ...checkGeneratedDocs(root, gameCatalog)];
  if (issues.length) {
    process.stderr.write(`${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Portfolio consistency and generated-doc drift: PASS (9/9).\n");
  }
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACTIVE_CHILD_PRODUCTS,
  CLASSIC_CARD_PRODUCTS,
  COMPATIBILITY_SURFACES,
  GAME_PORTFOLIO,
  PORTFOLIO_TEST_PROFILES,
  SHARED_ENGINES,
  WORLD_MODULES
} from "../../packages/data/gamePortfolio";
import { APP_ROUTE_QUERY_MANIFEST, PLAY_SURFACE_MANIFEST, PRIMARY_PLAY_SURFACES } from "../../packages/data/playSurfaceManifest";
import { ACTIVE_PROJECT_PHASE, AUTHORIZED_DEVELOPMENT_CYCLES, NEXT_PROJECT_PHASE, PRIMARY_WORLDS, PROJECT_LIFECYCLE_TERMINAL_TRUTH, PROJECT_PHASES } from "../../packages/data/projectLifecycle";
import { KNOWN_SAVE_KEYS, portfolioNamespacesWithoutKnownKey } from "../../packages/data/saveKeyInventory";
import type { GameCatalogMetadata } from "./load-game-catalog-metadata";
import { loadGameCatalogMetadata } from "./load-game-catalog-metadata";
import { renderPortfolioRoadmap, renderPortfolioStatus, renderReadmePortfolio, replaceMarkedSection } from "./portfolio-docs";

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
  for (const id of duplicates(WORLD_MODULES.map((record) => record.id))) issues.push(`Duplicate world module id: ${id}`);
  for (const route of duplicates(WORLD_MODULES.map((record) => record.route))) issues.push(`Duplicate world module route: ${route}`);
  for (const id of duplicates(COMPATIBILITY_SURFACES.map((record) => record.id))) issues.push(`Duplicate compatibility surface id: ${id}`);
  for (const id of duplicates(SHARED_ENGINES.map((record) => record.id))) issues.push(`Duplicate shared engine id: ${id}`);
  const profiles = new Map(PORTFOLIO_TEST_PROFILES.map((profile) => [profile.id, profile]));
  const tiers = new Set<string>(GAME_PORTFOLIO.map((record) => record.qualityTier));
  for (const tier of ["S", "A", "B", "C"]) if (!tiers.has(tier)) issues.push(`Missing quality tier: ${tier}`);
  for (const record of GAME_PORTFOLIO) {
    const profile = profiles.get(record.testProfile);
    if (!profile) issues.push(`${record.id} uses unknown test profile ${record.testProfile}`);
    else if (profile.qualityTier !== record.qualityTier) issues.push(`${record.id} tier/profile mismatch`);
    if (record.activeChildProduct !== (record.definitionRole === "active-child-product")) issues.push(`${record.id} active-product role mismatch`);
    if (record.classicCardVisible && !record.activeChildProduct) issues.push(`${record.id} exposes a Classic card without active-child-product status`);
    if (record.activeChildProduct && !record.childProductOrder) issues.push(`${record.id} active child product needs an order`);
    if (record.definitionRole === "world-module-mount" && record.worldModuleIds.length === 0) issues.push(`${record.id} world-module mount has no module`);
    if (record.definitionRole === "compatibility-adapter" && record.compatibilitySurfaceIds.length === 0) issues.push(`${record.id} compatibility adapter has no compatibility surface`);
    if (record.contentStatus !== "frozen") issues.push(`${record.id} content must remain frozen during portfolio convergence`);
    for (const moduleId of record.worldModuleIds) if (!WORLD_MODULES.some((module) => module.id === moduleId && module.ownerDefinitionId === record.id)) issues.push(`${record.id} references an unknown or foreign world module: ${moduleId}`);
    for (const surfaceId of record.compatibilitySurfaceIds) if (!COMPATIBILITY_SURFACES.some((surface) => surface.id === surfaceId)) issues.push(`${record.id} references an unknown compatibility surface: ${surfaceId}`);
    for (const engineId of record.sharedEngineIds) {
      const engine = SHARED_ENGINES.find((candidate) => candidate.id === engineId);
      if (!engine) issues.push(`${record.id} references an unknown shared engine: ${engineId}`);
      else if (!engine.consumers.includes(record.id) && !record.worldModuleIds.some((moduleId) => engine.consumers.includes(moduleId))) issues.push(`${record.id} is missing from ${engineId} consumers`);
    }
    for (const doc of record.canonicalDocs) if (!existsSync(resolve(root, doc))) issues.push(`${record.id} canonical doc does not exist: ${doc}`);
  }
  const expectedActiveProducts = ["english-spell-battle", "equation-slider", "hanzi-radical-battle", "math-lab"];
  if (JSON.stringify(ACTIVE_CHILD_PRODUCTS.map((record) => record.id).sort()) !== JSON.stringify(expectedActiveProducts)) issues.push("Active child product truth must contain the four converged products");
  if (JSON.stringify(CLASSIC_CARD_PRODUCTS.map((record) => record.id).sort()) !== JSON.stringify(expectedActiveProducts)) issues.push("Classic Hall must project only the four active child products");
  for (const module of WORLD_MODULES) if (!portfolioIds.has(module.ownerDefinitionId)) issues.push(`${module.id} owner definition is missing: ${module.ownerDefinitionId}`);
  const validEngineConsumers = new Set([...portfolioIds, ...WORLD_MODULES.map((module) => module.id)]);
  for (const module of WORLD_MODULES) {
    if (module.engineId && !SHARED_ENGINES.find((engine) => engine.id === module.engineId)?.consumers.includes(module.id)) issues.push(`${module.id} is missing from ${module.engineId} consumers`);
  }
  for (const engine of SHARED_ENGINES) for (const consumer of engine.consumers) {
    if (!validEngineConsumers.has(consumer)) issues.push(`${engine.id} has unknown consumer: ${consumer}`);
    const definition = GAME_PORTFOLIO.find((record) => record.id === consumer);
    const module = WORLD_MODULES.find((record) => record.id === consumer);
    if (definition && !definition.sharedEngineIds.includes(engine.id)) issues.push(`${engine.id} consumer ${consumer} lacks a reciprocal definition reference`);
    if (module && module.engineId !== engine.id) issues.push(`${engine.id} consumer ${consumer} lacks a reciprocal module reference`);
  }
  const compatibilityRouteValues = new Set(["classic", "hanzi-v2-chapter-one", "hanzi-v2-v1", "pinyin-magic-battle", "english-spell-battle-legacy"]);
  for (const route of APP_ROUTE_QUERY_MANIFEST.filter((record) => compatibilityRouteValues.has(record.queryValue))) {
    if (!COMPATIBILITY_SURFACES.some((surface) => surface.route?.startsWith(route.query))) issues.push(`Public compatibility route is missing from compatibility truth: ${route.query}`);
  }
  const visiblePortfolio = GAME_PORTFOLIO.filter((record) => record.classicCardVisible).map((record) => record.id).sort();
  const visibleCatalog = currentCatalog.map((game) => game.id).sort();
  if (JSON.stringify(visiblePortfolio) !== JSON.stringify(visibleCatalog)) issues.push("Current classic-hub visibility differs from Portfolio");
  if (PROJECT_PHASES.filter((phase) => phase.status === "complete").length !== 5) issues.push("Expected five completed project phases");
  if (PROJECT_PHASES.find((phase) => phase.id === "play-readiness")?.status !== "complete") issues.push("Play Readiness terminal product phase is not complete");
  if (PROJECT_PHASES.find((phase) => phase.id === ACTIVE_PROJECT_PHASE)?.status !== "active") issues.push("Natural-use Observation is not active");
  if (NEXT_PROJECT_PHASE !== null) issues.push("Natural-use must not schedule an automatic next phase");
  if (PROJECT_PHASES.find((phase) => phase.id === ACTIVE_PROJECT_PHASE)?.releaseTag !== "game-codex-observation-kit-v1.0.0") issues.push("Observation Kit release identity is missing");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseMode !== "ACTIVE" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation !== "ACTIVE") issues.push("Natural-use mode is not active");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaseline !== "FROZEN" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineStatus !== "FROZEN") issues.push("Family stable baseline is not frozen");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineTag !== "game-codex-family-stable-v1.0.0") issues.push("Family stable baseline tag drifted");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.familyStableBaselineCommit !== "8b890ff14880bcb576dd1ced37e14e6e3df28af1") issues.push("Family stable baseline commit drifted");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.realEvidencePatchCount !== 2) issues.push("Expected two evidence-driven patches");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.interactionIntegrity !== "HITTEST_AND_REACHABILITY_GUARD_ACTIVE") issues.push("Hit-test and reachability guards are not active");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.automaticLargeTask !== "NONE") issues.push("Natural-use must not schedule an automatic large task");
  if (AUTHORIZED_DEVELOPMENT_CYCLES.length !== 1) issues.push("Expected one explicitly authorized bounded development cycle");
  const portfolioEvolution = AUTHORIZED_DEVELOPMENT_CYCLES.find((cycle) => cycle.id === "portfolio-evolution-01");
  if (!portfolioEvolution || portfolioEvolution.status !== "release-bound" || portfolioEvolution.trigger !== "EXPLICIT_USER_AUTHORIZATION") issues.push("Portfolio Evolution authorization truth is incomplete");
  if (portfolioEvolution?.completionCondition !== "RELEASE_TAG_TARGET") issues.push("Portfolio Evolution completion condition drifted");
  if (portfolioEvolution?.releaseTag !== "game-codex-portfolio-evolution-v1.0.0" || portfolioEvolution.naturalUseObservationImpact !== "ONGOING_NOT_CLOSED") issues.push("Portfolio Evolution release or Natural-use boundary drifted");
  if (portfolioEvolution?.realChildValidation !== "NOT_PERFORMED_AND_NOT_CLAIMED") issues.push("Portfolio Evolution child-evidence boundary drifted");
  if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.realChildValidation !== "NOT_PERFORMED_AND_NOT_CLAIMED") issues.push("Real-child validation boundary drifted");
  if (PRIMARY_WORLDS.length !== 3) issues.push(`Expected three primary worlds, found ${PRIMARY_WORLDS.length}`);
  for (const id of duplicates(PLAY_SURFACE_MANIFEST.map((record) => record.id))) issues.push(`Duplicate play surface id: ${id}`);
  if (PLAY_SURFACE_MANIFEST.length !== 40) issues.push(`Expected 40 retained play surfaces, found ${PLAY_SURFACE_MANIFEST.length}`);
  if (PRIMARY_PLAY_SURFACES.length !== 6) issues.push(`Expected six primary first-use surfaces, found ${PRIMARY_PLAY_SURFACES.length}`);
  for (const surface of PLAY_SURFACE_MANIFEST) {
    if (!surface.route || !surface.returnRoute || !surface.primaryActionSelector) issues.push(`Incomplete play surface contract: ${surface.id}`);
  }
  for (const key of duplicates(KNOWN_SAVE_KEYS.map((record) => record.key))) issues.push(`Duplicate known save key: ${key}`);
  for (const namespace of portfolioNamespacesWithoutKnownKey()) issues.push(`Portfolio namespace missing from Save Vault inventory: ${namespace}`);
  return issues;
}

export function checkGeneratedDocs(root = resolve(import.meta.dirname, "../.."), catalog = loadGameCatalogMetadata(root)): string[] {
  const issues: string[] = [];
  const readmePath = resolve(root, "README.md");
  const statusPath = resolve(root, "docs/project-status/portfolio-status.md");
  const roadmapPath = resolve(root, "docs/project-status/portfolio-roadmap.md");
  const naturalUsePath = resolve(root, "docs/project-status/natural-use.md");
  const readme = readFileSync(readmePath, "utf8");
  if (replaceMarkedSection(readme, renderReadmePortfolio(catalog)) !== readme) issues.push("README portfolio section has drifted");
  if (!existsSync(statusPath) || readFileSync(statusPath, "utf8") !== renderPortfolioStatus(catalog)) issues.push("Portfolio status has drifted");
  if (!existsSync(roadmapPath) || readFileSync(roadmapPath, "utf8") !== renderPortfolioRoadmap()) issues.push("Portfolio roadmap has drifted");
  if (!existsSync(naturalUsePath)) issues.push("Natural-use family guide is missing");
  else {
    const naturalUse = readFileSync(naturalUsePath, "utf8");
    for (const required of ["NATURAL-USE ACTIVE", "game-codex-family-stable-v1.0.0", "http://127.0.0.1:5175/", "no required frequency", "NOT_PERFORMED_AND_NOT_CLAIMED"]) {
      if (!naturalUse.includes(required)) issues.push(`Natural-use family guide is missing: ${required}`);
    }
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const root = resolve(import.meta.dirname, "../..");
  const gameCatalog = loadGameCatalogMetadata(root);
  const currentClassicCatalog = gameCatalog.filter((game) => GAME_PORTFOLIO.find((record) => record.id === game.id)?.classicCardVisible);
  const issues = [...validatePortfolio(gameCatalog, currentClassicCatalog, root), ...checkGeneratedDocs(root, gameCatalog)];
  if (issues.length) {
    process.stderr.write(`${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Portfolio consistency, 4 active products / 9 mount definitions, ${PLAY_SURFACE_MANIFEST.length} play surfaces, ${KNOWN_SAVE_KEYS.length} save keys, and generated-doc drift: PASS.\n`);
  }
}

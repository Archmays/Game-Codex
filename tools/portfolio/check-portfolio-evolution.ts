import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import equationAudit from "../../games/equation-slider/levels/generated-audit.json";
import { MAKE_TARGET_SAVE_VERSION } from "../../games/make-target/index";
import { ACTIVE_CHILD_PRODUCTS, CLASSIC_CARD_PRODUCTS, COMPATIBILITY_SURFACES, GAME_PORTFOLIO, SHARED_ENGINES, WORLD_MODULES } from "../../packages/data/gamePortfolio";
import { PLAY_SURFACE_MANIFEST, PRIMARY_PLAY_SURFACES } from "../../packages/data/playSurfaceManifest";
import { AUTHORIZED_DEVELOPMENT_CYCLES, PROJECT_LIFECYCLE_TERMINAL_TRUTH } from "../../packages/data/projectLifecycle";
import { KNOWN_SAVE_KEYS } from "../../packages/data/saveKeyInventory";
import { computeReviewSourceTreeIdentity, loadLocalValidationEvidence, loadPortfolioEvolutionEvidence, LOCAL_VALIDATION_EVIDENCE_PATH, renderBenchmarkAndPrinciples, renderPortfolioAudit, REVIEW_SOURCE_TREE_ALGORITHM } from "./portfolio-evolution-docs";

const root = resolve(import.meta.dirname, "../..");
const evidence = loadPortfolioEvolutionEvidence(root);
const localValidation = loadLocalValidationEvidence(root);
const issues: string[] = [];
const equal = (left: readonly string[], right: readonly string[]): boolean => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const expectedDefinitionIds = GAME_PORTFOLIO.map((record) => record.id);
const evidenceIds = evidence.definitions.map((record) => record.id);
const allowedDecisions = new Set(["KEEP", "EXPAND", "MERGE", "REBUILD", "RETIRE_STANDALONE", "COMPATIBILITY_ONLY"]);
const exactDecisions: Readonly<Record<string, string>> = {
  "hanzi-radical-battle": "KEEP",
  "equation-slider": "KEEP",
  "math-lab": "KEEP",
  "english-spell-battle": "KEEP",
  "make-target": "MERGE",
  "clock-reader": "MERGE",
  "multiplication-adventure": "MERGE",
  "memory-card": "RETIRE_STANDALONE",
  "pinyin-magic-battle": "COMPATIBILITY_ONLY",
};
const requiredBenchmarkCategories: Readonly<Record<string, number>> = {
  "intrinsic-integration": 3,
  "manipulation-first": 1,
  "real-action-input": 1,
  "open-world-agency": 3,
  "path-and-free-choice": 3,
  "counter-reference": 2,
};
const requiredDurableDocuments = [
  "README.md",
  "benchmark-and-design-principles.md",
  "portfolio-audit.md",
  "portfolio-evidence.json",
  "six-hats-and-decision-record.md",
  "implementation-and-validation.md",
  "next-roadmap.md",
] as const;
const allowedReviewSeverities = new Set(["SEV_1", "SEV_2", "SEV_3", "OBSERVATION"]);
const allowedReviewDispositions = new Set(["FIXED", "ACCEPTED", "NOT_A_FINDING"]);
const requiredReviewScopes: Readonly<Record<string, readonly string[]>> = {
  GAMEPLAY_REVIEW: ["core loop", "game feel", "pacing", "world identity", "replay", "visual feedback", "input recovery"],
  LEARNING_PORTFOLIO_REVIEW: ["intrinsic integration", "learning progression", "scaffolding", "portfolio uniqueness", "duplication", "maintenance", "route/save/privacy"],
};

if (evidence.schemaVersion !== 2 || evidence.goalId !== "GAME-CODEX-PORTFOLIO-EVOLUTION-GOAL-01") issues.push("evidence identity/schema");
if (evidence.sourceBoundStartSha !== "73ae9d6be140c9e8294781b9f8e6ed296590c438") issues.push("source-bound start SHA");
if (evidence.benchmarkCases.length < 10 || new Set(evidence.benchmarkCases.map((item) => item.name)).size !== evidence.benchmarkCases.length) issues.push("benchmark case coverage");
for (const [category, minimum] of Object.entries(requiredBenchmarkCategories)) {
  if (evidence.benchmarkCases.filter((item) => item.category === category).length < minimum) issues.push(`benchmark category coverage: ${category}`);
}
if (evidence.benchmarkCases.some((item) => !/^https:\/\//.test(item.url) || !item.mechanism.trim() || !item.adopt.trim() || !item.exclude.trim() || !item.uncertainty.trim())) issues.push("benchmark evidence fields");
if (evidence.researchSources.length < 5 || evidence.researchSources.filter((source) => /^R[12]_PEER_REVIEWED/.test(source.evidenceLevel)).length < 3) issues.push("research evidence coverage");
if (evidence.researchSources.some((source) => !/^https:\/\//.test(source.url) || !source.citation.trim() || !source.supportedClaim.trim() || !source.implication.trim() || !source.boundary.trim())) issues.push("research evidence fields");
if (evidence.designPrinciples.length < 8) issues.push("design principles");
if (evidence.independentReviews.length !== 2 || !equal(evidence.independentReviews.map((review) => review.id), ["GAMEPLAY_REVIEW", "LEARNING_PORTFOLIO_REVIEW"])) issues.push("independent review coverage");
const reviewFindingIds = evidence.independentReviews.flatMap((review) => review.findings.map((finding) => finding.id));
if (new Set(reviewFindingIds).size !== reviewFindingIds.length) issues.push("independent review finding identity");
const reviewSourceTreeIdentity = computeReviewSourceTreeIdentity(root);
if (new Set(evidence.independentReviews.map((review) => review.reviewerId)).size !== 2 || new Set(evidence.independentReviews.map((review) => review.reviewRunId)).size !== 2) issues.push("independent reviewer/run identity");
if (evidence.independentReviews.some((review) => (
  review.finalTreeBinding !== "RELEASE_TAG_TARGET"
  || review.sourceTreeAlgorithm !== REVIEW_SOURCE_TREE_ALGORITHM
  || review.sourceTreeSha256 !== reviewSourceTreeIdentity.sha256
  || review.sourceTreeFileCount !== reviewSourceTreeIdentity.fileCount
  || review.reviewRound !== "FINAL_CANDIDATE"
  || review.verdict !== "PASS_MACHINE"
  || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt)
  || !equal(review.scope, requiredReviewScopes[review.id] ?? [])
  || !review.reviewerIndependence.trim()
  || !review.keyFinding.trim()
  || !review.identityContract.includes("later tracked mutation invalidates")
  || review.findings.length < 3
  || review.validationEvidence.length < 3
  || review.unresolvedBlockers.length !== 0
  || review.authenticChildEvidence !== "UNKNOWN_NOT_PERFORMED_NOT_CLAIMED"
))) issues.push("independent final-tree review evidence");
if (evidence.independentReviews.some((review) => review.findings.some((finding) => (
  !allowedReviewSeverities.has(finding.severity)
  || !allowedReviewDispositions.has(finding.disposition)
  || finding.evidence.length === 0
  || !finding.resolution.trim()
)))) issues.push("independent review finding disposition");
for (const review of evidence.independentReviews) {
  for (const finding of review.findings) {
    for (const pointer of finding.evidence) {
      if (/^(?:[A-Za-z]:[\\/]|[\\/])/.test(pointer) || !existsSync(resolve(root, pointer))) issues.push(`${finding.id} invalid evidence pointer: ${pointer}`);
    }
  }
  for (const pointer of review.validationEvidence) {
    if (/^(?:[A-Za-z]:[\\/]|[\\/])/.test(pointer) || !existsSync(resolve(root, pointer))) issues.push(`${review.id} invalid validation evidence pointer: ${pointer}`);
  }
}
const requiredPreflightGateIds = [
  "portfolio-affected-closure",
  "play-readiness-static",
  "play-surface-integrity",
  "play-readiness-browser",
  "accessibility-browser",
  "save-vault",
  "portfolio-performance",
  "natural-use-privacy",
  "natural-use-browser",
  "portfolio-visual",
  "chinese-visual",
  "math-visual",
  "math-geometry",
  "english-visual",
] as const;
if (
  localValidation.schemaVersion !== 1
  || localValidation.goalId !== evidence.goalId
  || localValidation.evidenceKind !== "LOCAL_CANDIDATE_PREFLIGHT"
  || !/^\d{4}-\d{2}-\d{2}$/.test(localValidation.executedOn)
  || localValidation.testedSourceTree.algorithm !== REVIEW_SOURCE_TREE_ALGORITHM
  || !/^[0-9a-f]{64}$/.test(localValidation.testedSourceTree.sha256)
  || localValidation.testedSourceTree.fileCount < 1
  || localValidation.realChildValidation !== "NOT_PERFORMED_AND_NOT_CLAIMED"
  || !localValidation.scopeBoundary.includes("not the final unchanged-tree gate")
  || !localValidation.finalGatePolicy.includes("one final comprehensive gate")
  || localValidation.unresolvedFailures.length !== 0
  || !equal(localValidation.gates.map((gate) => gate.id), requiredPreflightGateIds)
  || localValidation.gates.some((gate) => gate.status !== "PASS" || gate.exitCode !== 0 || !gate.command.trim() || !gate.result.trim())
  || localValidation.configurationSkips.length === 0
  || localValidation.configurationSkips.some((skip) => skip.count < 1 || (!skip.reason.includes("project") && !skip.reason.includes("Project")))
) issues.push("local candidate preflight evidence");
if (!evidence.independentReviews.every((review) => review.validationEvidence.includes(LOCAL_VALIDATION_EVIDENCE_PATH))) issues.push("independent review preflight evidence binding");
if (evidence.evidenceBoundary.authenticChildEvidence !== "UNKNOWN / NOT PERFORMED / NOT CLAIMED" || evidence.evidenceBoundary.realChildValidation !== "NOT_PERFORMED_AND_NOT_CLAIMED") issues.push("portfolio child-evidence boundary");
if (evidence.reviewReconciliation.humanAcceptanceInferred || evidence.reviewReconciliation.agreements.length === 0 || !evidence.reviewReconciliation.resolvedDifference.trim()) issues.push("review reconciliation boundary");
if (!equal(expectedDefinitionIds, evidenceIds) || new Set(evidenceIds).size !== 9) issues.push("nine-definition audit coverage");
const weightTotal = evidence.scoreDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
if (evidence.scoreDimensions.length !== 12 || weightTotal !== 100) issues.push("score rubric");
for (const record of evidence.definitions) {
  const calculated = evidence.scoreDimensions.reduce((sum, dimension) => sum + (record.score[dimension.id] ?? -100) * dimension.weight / 5, 0);
  if (Math.abs(calculated - record.score.weightedTotal) > 0.001) issues.push(`${record.id} weighted score`);
  if (evidence.scoreDimensions.some((dimension) => record.score[dimension.id] < 0 || record.score[dimension.id] > 5)) issues.push(`${record.id} score range`);
  if (!allowedDecisions.has(record.decision.primary) || exactDecisions[record.id] !== record.decision.primary) issues.push(`${record.id} decision`);
  if (!/^[ABCU]$/.test(record.confidence)) issues.push(`${record.id} confidence`);
  if (record.classification !== "FACT_AND_INFERENCE") issues.push(`${record.id} fact/inference classification`);
  if (record.authenticChildEvidence !== "UNKNOWN_NOT_PERFORMED_NOT_CLAIMED") issues.push(`${record.id} child-evidence boundary`);
  if (record.unknowns.length === 0 || record.unknowns.some((unknown) => !unknown.trim())) issues.push(`${record.id} unknowns`);
  if (!record.routeImpact || !record.saveImpact || !record.sharedEngineImpact || !record.rollback || record.tests.length === 0 || record.notDo.length === 0) issues.push(`${record.id} decision contract`);
  for (const pointer of record.evidence) if (!existsSync(resolve(root, pointer))) issues.push(`${record.id} missing evidence pointer: ${pointer}`);
}
if (GAME_PORTFOLIO.length !== 9 || ACTIVE_CHILD_PRODUCTS.length !== 4 || CLASSIC_CARD_PRODUCTS.length !== 4) issues.push("portfolio truth counts");
if (!equal(ACTIVE_CHILD_PRODUCTS.map((record) => record.id), evidence.resultingTruth.activeChildProducts as string[])) issues.push("active product truth");
if (WORLD_MODULES.length !== 11 || COMPATIBILITY_SURFACES.length !== 6 || SHARED_ENGINES.length !== 2) issues.push("layer truth counts");
if (PLAY_SURFACE_MANIFEST.length !== 40 || PRIMARY_PLAY_SURFACES.length !== 6 || KNOWN_SAVE_KEYS.length !== 37) issues.push("surface/save truth counts");
const resultingTruth = evidence.resultingTruth as Readonly<Record<string, unknown>>;
if (
  resultingTruth.mountDefinitions !== GAME_PORTFOLIO.length
  || resultingTruth.classicCards !== CLASSIC_CARD_PRODUCTS.length
  || resultingTruth.worldModules !== WORLD_MODULES.length
  || resultingTruth.compatibilitySurfaces !== COMPATIBILITY_SURFACES.length
  || resultingTruth.sharedEngines !== SHARED_ENGINES.length
  || resultingTruth.playSurfaces !== PLAY_SURFACE_MANIFEST.length
  || resultingTruth.primarySurfaces !== PRIMARY_PLAY_SURFACES.length
  || resultingTruth.knownSaveKeys !== KNOWN_SAVE_KEYS.length
  || resultingTruth.newGameCreated !== false
) issues.push("resulting truth drift");
if (!equal(PRIMARY_PLAY_SURFACES.map((surface) => surface.id), evidence.surfaceCoverage.primaryRealBrowserSurfaceIds)) issues.push("primary browser coverage");
if (evidence.surfaceCoverage.decisionRelevantSecondaryRealBrowserSurfaceIds.some((id) => !PLAY_SURFACE_MANIFEST.some((surface) => surface.id === id))) issues.push("secondary browser coverage references");
if (evidence.surfaceCoverage.manifestValidatedCount !== PLAY_SURFACE_MANIFEST.length || evidence.surfaceCoverage.uncoveredSurfaceIds.length !== 0) issues.push("surface coverage boundary");
if (equationAudit.sameVisibleTransitionCount !== 216 || equationAudit.sameVisibleTransitionLevelCount !== 82 || equationAudit.initialSameVisibleMoveLevelCount !== 45) issues.push("Equation same-display inventory");
if (equationAudit.sameVisibleShortestPathBenefitLevelIds.length !== 39 || equationAudit.initialSameVisibleShortestPathBenefitLevelIds.length !== 21 || equationAudit.requiredSameVisibleMoveLevelIds.length !== 0) issues.push("Equation completion-path classification");
if (Object.values(equationAudit.sameVisibleCompletionPaths).some((path) => !path.solvableWithoutSameVisibleEdges || (path.shortestPathDelta !== 0 && path.shortestPathDelta !== 1))) issues.push("Equation no-edge completion proof");
if (equationAudit.deterministicHash !== evidence.equationVisibleChangeAudit.catalogHash) issues.push("Equation catalog hash");
if (MAKE_TARGET_SAVE_VERSION !== 1) issues.push("Make Target save version");
const cycle = AUTHORIZED_DEVELOPMENT_CYCLES.find((record) => record.id === "portfolio-evolution-01");
if (!cycle || cycle.status !== "release-bound" || cycle.completionCondition !== "RELEASE_TAG_TARGET" || cycle.naturalUseObservationImpact !== "ONGOING_NOT_CLOSED") issues.push("authorized bounded lifecycle cycle");
if (PROJECT_LIFECYCLE_TERMINAL_TRUTH.naturalUseObservation !== "ACTIVE" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.automaticLargeTask !== "NONE" || PROJECT_LIFECYCLE_TERMINAL_TRUTH.realChildValidation !== "NOT_PERFORMED_AND_NOT_CLAIMED") issues.push("Natural-use/child-evidence lifecycle boundary");

const benchmarkPath = resolve(root, "docs/portfolio-evolution/benchmark-and-design-principles.md");
const auditPath = resolve(root, "docs/portfolio-evolution/portfolio-audit.md");
const sixHatsPath = resolve(root, "docs/portfolio-evolution/six-hats-and-decision-record.md");
for (const document of requiredDurableDocuments) {
  const path = resolve(root, "docs/portfolio-evolution", document);
  if (!existsSync(path) || readFileSync(path, "utf8").trim().length === 0) issues.push(`missing durable document: ${document}`);
}
if (!existsSync(benchmarkPath) || readFileSync(benchmarkPath, "utf8") !== `${renderBenchmarkAndPrinciples(evidence)}\n`) issues.push("generated benchmark doc drift");
if (!existsSync(auditPath) || readFileSync(auditPath, "utf8") !== `${renderPortfolioAudit(evidence)}\n`) issues.push("generated portfolio audit drift");
if (!existsSync(sixHatsPath) || !readFileSync(sixHatsPath, "utf8").includes(`11 world modules、${COMPATIBILITY_SURFACES.length} compatibility surfaces、${SHARED_ENGINES.length} shared engines`)) issues.push("six-hats layered truth drift");

if (issues.length) {
  process.stderr.write(`${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Portfolio Evolution evidence: PASS (${evidence.benchmarkCases.length} cases, ${evidence.researchSources.length} research sources, ${evidence.definitions.length} definitions, ${PLAY_SURFACE_MANIFEST.length} surfaces).\n`);
}

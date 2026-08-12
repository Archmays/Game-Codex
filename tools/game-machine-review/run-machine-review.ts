import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJsonEvidence } from "./collect-route-evidence";
import {
  evaluateHardGates,
  evaluateMachineVerdict,
  type EvidenceStatus,
  type EvidenceSummary,
  type HardGateResult,
  type NetworkGateSummary,
} from "./evaluate-hard-gates";
import { createMachineReviewManifest } from "./machine-review-manifest";
import {
  assertStrictAgentProfileCoverage,
  assertStrictCatalogSmokeCoverage,
  assertStrictScrollMatrixCoverage,
} from "./evidence-validators";
import { validateDeepRouteEvidenceReport, type DeepRouteEvidenceReport } from "./deep-route-evidence";
import {
  STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
  STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
  STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
  assertStep07AuthorizationLineageEvidenceEntries,
  readStep07ExceptionalRepairMetadata,
  writeEvidenceManifest,
} from "./evidence-identity";
import { mergeSemanticReviewFindings } from "./merge-review-findings";
import { writeMachineReviewReport, type MachineReviewReport } from "./render-report";
import { SEMANTIC_REVIEWER_IDS } from "./semantic-review-schema";
import { computeMachineReviewSourceTreeSha256 } from "./source-identity";
import { finalizeMachineEvidence } from "./finalize-machine-evidence";

const DEFAULT_OUTPUT = "artifacts/game-machine-review/step-07";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedStatus(value: unknown): EvidenceStatus | null {
  if (value === "PASS" || value === true) return "PASS";
  if (value === "FAIL" || value === false) return "FAIL";
  return null;
}

function assertEvidenceIdentity(value: Record<string, unknown>, label: string, sourceTreeSha256: string): void {
  if (typeof value.sourceTreeSha256 !== "string" || value.sourceTreeSha256.toUpperCase() !== sourceTreeSha256) {
    throw new Error(`${label} evidence is not bound to the current source tree`);
  }
}

function assertEvidenceFiles(
  files: readonly string[],
  label: string,
  workspaceRoot: string,
  outputDirectory: string,
): void {
  if (files.length === 0) throw new Error(`${label} must cite at least one evidence file`);
  const outputRelative = relative(workspaceRoot, outputDirectory).replaceAll("\\", "/");
  for (const file of files) {
    const absolute = isAbsolute(file) ? resolve(file) : resolve(workspaceRoot, file);
    const workspaceRelative = relative(workspaceRoot, absolute).replaceAll("\\", "/");
    if (workspaceRelative.startsWith("../") || workspaceRelative === "..") {
      throw new Error(`${label} evidence escapes the workspace: ${file}`);
    }
    if (workspaceRelative !== outputRelative && !workspaceRelative.startsWith(`${outputRelative}/`)) {
      throw new Error(`${label} evidence must live in the STEP 07 evidence directory: ${file}`);
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) {
      throw new Error(`${label} evidence is missing or empty: ${file}`);
    }
  }
}

function assertFindingEvidenceKinds(files: readonly string[], label: string): void {
  const normalized = files.map((file) => file.toLowerCase());
  if (!normalized.some((file) => /\.(?:png|jpe?g|webp)$/.test(file))) throw new Error(`${label} must cite screenshot evidence`);
  if (!normalized.some((file) => /(?:aria|accessibility)/.test(file))) throw new Error(`${label} must cite ARIA evidence`);
  if (!normalized.some((file) => /(?:trace|event)/.test(file) || file.endsWith(".zip"))) throw new Error(`${label} must cite trace or event evidence`);
}

function evidenceSummary(path: string, label: string, sourceTreeSha256: string, workspaceRoot: string, outputDirectory: string): EvidenceSummary {
  const artifact = readJsonEvidence(path, label);
  if (!isRecord(artifact.value)) throw new Error(`${label} evidence must be an object`);
  assertEvidenceIdentity(artifact.value, label, sourceTreeSha256);
  const status = normalizedStatus(artifact.value.status ?? artifact.value.passed);
  if (!status) throw new Error(`${label} evidence must declare status PASS or FAIL`);
  const cited = Array.isArray(artifact.value.evidenceFiles)
    ? artifact.value.evidenceFiles.filter((file): file is string => typeof file === "string" && file.trim().length > 0)
    : [];
  const evidenceFiles = cited.length > 0 ? cited : [artifact.path];
  assertEvidenceFiles(evidenceFiles, label, workspaceRoot, outputDirectory);
  return { status, evidenceFiles };
}

function networkSummary(path: string, sourceTreeSha256: string, workspaceRoot: string, outputDirectory: string): NetworkGateSummary {
  const artifact = readJsonEvidence(path, "network gate");
  if (!isRecord(artifact.value)) throw new Error("Network gate evidence must be an object");
  assertEvidenceIdentity(artifact.value, "network gate", sourceTreeSha256);
  const status = normalizedStatus(artifact.value.status ?? artifact.value.passed);
  const sameOriginRequestCount = artifact.value.sameOriginRequestCount;
  const externalRequests = artifact.value.externalRequests;
  if (!status || !Number.isInteger(sameOriginRequestCount) || (sameOriginRequestCount as number) < 0 || !Array.isArray(externalRequests) || !externalRequests.every((request) => typeof request === "string")) {
    throw new Error("Network gate must declare status, sameOriginRequestCount, and externalRequests");
  }
  const evidenceFiles = [artifact.path];
  assertEvidenceFiles(evidenceFiles, "network gate", workspaceRoot, outputDirectory);
  return {
    status,
    policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
    sameOriginRequestCount: sameOriginRequestCount as number,
    externalRequests: externalRequests as string[],
    evidenceFiles,
  };
}

function hardGateResults(path: string, sourceTreeSha256: string): readonly HardGateResult[] {
  const artifact = readJsonEvidence(path, "hard gates");
  if (!isRecord(artifact.value)) throw new Error("Hard gate evidence must be an object");
  assertEvidenceIdentity(artifact.value, "hard gates", sourceTreeSha256);
  const candidate = artifact.value.results;
  if (!Array.isArray(candidate)) throw new Error("Hard gate evidence must contain a results array");
  return candidate as unknown as HardGateResult[];
}

function reviewConflict(path: string, sourceTreeSha256: string): boolean {
  const artifact = readJsonEvidence(path, "semantic reviewer conflict");
  if (!isRecord(artifact.value) || typeof artifact.value.unresolvedCriticalReviewerConflict !== "boolean") {
    throw new Error("Semantic reviewer conflict evidence must explicitly declare unresolvedCriticalReviewerConflict");
  }
  assertEvidenceIdentity(artifact.value, "semantic reviewer conflict", sourceTreeSha256);
  return artifact.value.unresolvedCriticalReviewerConflict;
}

export interface RunMachineReviewOptions {
  readonly workspaceRoot?: string;
  readonly outputDirectory?: string;
  readonly repairRound?: number;
  readonly exceptionalRepairIds?: readonly string[];
}

export function runMachineReview(options: RunMachineReviewOptions = {}): MachineReviewReport {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const outputDirectory = resolve(workspaceRoot, options.outputDirectory ?? DEFAULT_OUTPUT);
  const readAt = (path: string) => resolve(outputDirectory, path);
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const hasExceptionalRepairContract = [
    STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
    STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
    STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
  ].some((path) => existsSync(resolve(workspaceRoot, path)));
  if (hasExceptionalRepairContract && (!options.exceptionalRepairIds || options.exceptionalRepairIds.length === 0)) {
    throw new Error("The canonical exceptional repair contracts require repeated --exceptional-repair-id options");
  }
  const exceptionalRepair = options.exceptionalRepairIds && options.exceptionalRepairIds.length > 0
    ? readStep07ExceptionalRepairMetadata(workspaceRoot, options.exceptionalRepairIds)
    : undefined;
  if (exceptionalRepair && options.repairRound !== 3) {
    throw new Error("The authorized exceptional repair must preserve --repair-round 3");
  }
  // Re-derive every hard/network/privacy/final command gate from the canonical
  // raw inputs immediately before review. A same-SHA handwritten derivative
  // is therefore overwritten, not trusted or sealed into a machine verdict.
  finalizeMachineEvidence(outputDirectory, workspaceRoot);
  const semanticDocuments = SEMANTIC_REVIEWER_IDS.map((reviewer) => {
    const value = readJsonEvidence(readAt(`semantic-reviews/${reviewer}.json`), reviewer).value;
    if (!isRecord(value)) throw new Error(`${reviewer} review must be an object`);
    assertEvidenceIdentity(value, reviewer, sourceTreeSha256);
    const evidenceFiles = Array.isArray(value.evidenceFiles)
      ? value.evidenceFiles.filter((file): file is string => typeof file === "string")
      : [];
    assertEvidenceFiles(evidenceFiles, reviewer, workspaceRoot, outputDirectory);
    return value;
  });
  const semanticReview = mergeSemanticReviewFindings(semanticDocuments);
  for (const finding of semanticReview.findings) {
    assertEvidenceFiles(finding.evidenceFiles, finding.id, workspaceRoot, outputDirectory);
    assertFindingEvidenceKinds(finding.evidenceFiles, finding.id);
  }
  const hardGates = evaluateHardGates(hardGateResults(readAt("hard-gates/HARD-GATES.json"), sourceTreeSha256));
  for (const gate of hardGates.results) assertEvidenceFiles(gate.evidenceFiles, `hard gate ${gate.id}`, workspaceRoot, outputDirectory);
  const rawScrollMatrix = readJsonEvidence(readAt("SCROLL-MATRIX.json"), "scroll matrix").value;
  const rawCatalogSmoke = readJsonEvidence(readAt("GAME-CATALOG-MACHINE-SMOKE.json"), "catalog smoke").value;
  const rawAgentPlaythroughs = readJsonEvidence(readAt("agent-playthrough/AGENT-PLAYTHROUGH-RESULTS.json"), "agent playthroughs").value;
  const rawDeepRouteAccessibility = readJsonEvidence(readAt("DEEP-ROUTE-EVIDENCE.json"), "deep route accessibility").value;
  assertStrictScrollMatrixCoverage(rawScrollMatrix, workspaceRoot);
  assertStrictCatalogSmokeCoverage(rawCatalogSmoke, workspaceRoot);
  assertStrictAgentProfileCoverage(rawAgentPlaythroughs, workspaceRoot);
  if (!isRecord(rawDeepRouteAccessibility)) throw new Error("Deep route accessibility evidence must be an object");
  assertEvidenceIdentity(rawDeepRouteAccessibility, "deep route accessibility", sourceTreeSha256);
  const deepRouteErrors = validateDeepRouteEvidenceReport(rawDeepRouteAccessibility as unknown as DeepRouteEvidenceReport, workspaceRoot);
  if (rawDeepRouteAccessibility.status !== "PASS" || deepRouteErrors.length > 0) {
    throw new Error(`Deep route accessibility evidence failed: ${deepRouteErrors.join("; ")}`);
  }
  const scrollMatrix = evidenceSummary(readAt("SCROLL-MATRIX.json"), "scroll matrix", sourceTreeSha256, workspaceRoot, outputDirectory);
  const catalogSmoke = evidenceSummary(readAt("GAME-CATALOG-MACHINE-SMOKE.json"), "catalog smoke", sourceTreeSha256, workspaceRoot, outputDirectory);
  const agentPlaythroughs = evidenceSummary(readAt("agent-playthrough/AGENT-PLAYTHROUGH-RESULTS.json"), "agent playthroughs", sourceTreeSha256, workspaceRoot, outputDirectory);
  const deepRouteAccessibility = evidenceSummary(readAt("DEEP-ROUTE-EVIDENCE.json"), "deep route accessibility", sourceTreeSha256, workspaceRoot, outputDirectory);
  const criticalControlGeometry = evidenceSummary(readAt("RUN-COMPLETE-CONTROL-EVIDENCE.json"), "critical control geometry", sourceTreeSha256, workspaceRoot, outputDirectory);
  const network = networkSummary(readAt("hard-gates/NETWORK-GATE.json"), sourceTreeSha256, workspaceRoot, outputDirectory);
  const privacy = evidenceSummary(readAt("hard-gates/PRIVACY-GATE.json"), "privacy gate", sourceTreeSha256, workspaceRoot, outputDirectory);
  const finalFullTests = evidenceSummary(readAt("hard-gates/FINAL-FULL-TESTS.json"), "final full tests", sourceTreeSha256, workspaceRoot, outputDirectory);
  const finalBuild = evidenceSummary(readAt("hard-gates/FINAL-BUILD.json"), "final build", sourceTreeSha256, workspaceRoot, outputDirectory);
  const unresolvedCriticalReviewerConflict = reviewConflict(readAt("semantic-reviews/REVIEW-CONFLICTS.json"), sourceTreeSha256);
  const verdict = evaluateMachineVerdict({
    hardGates,
    scrollMatrix,
    catalogSmoke,
    agentPlaythroughs,
    semanticReview,
    unresolvedCriticalReviewerConflict,
    network,
    privacy,
    finalFullTests,
    finalBuild,
    repairRound: options.repairRound ?? 0,
  });
  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot, encoding: "utf8" }).trim();
  const evidenceIdentity = writeEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256);
  if (exceptionalRepair) assertStep07AuthorizationLineageEvidenceEntries(evidenceIdentity.manifest.entries);
  const report: MachineReviewReport = {
    schemaVersion: 1,
    step: "07",
    generatedAtUtc: new Date().toISOString(),
    sourceIdentity: { commitSha, sourceTreeSha256 },
    evidenceTreeSha256: evidenceIdentity.manifest.evidenceTreeSha256,
    evidenceManifestSha256: evidenceIdentity.evidenceManifestSha256,
    manifest: createMachineReviewManifest(workspaceRoot),
    hardGates,
    scrollMatrix,
    catalogSmoke,
    agentPlaythroughs,
    deepRouteAccessibility,
    criticalControlGeometry,
    network,
    privacy,
    semanticReview,
    unresolvedCriticalReviewerConflict,
    finalFullTests,
    finalBuild,
    verdict,
    ...(exceptionalRepair ?? {}),
    realSecondUsePerformed: false,
    limitations: [
      "Machine review cannot prove child fun or long-term engagement.",
      "Machine review cannot prove learning effectiveness or retention.",
      "Machine review cannot establish family preference or real-child acceptance.",
      "Synthetic tooling evidence is not real-child evidence.",
    ],
  };
  writeMachineReviewReport(report, outputDirectory);
  return report;
}

export function parseCliArguments(argumentsList: readonly string[]): RunMachineReviewOptions {
  let outputDirectory: string | undefined;
  let repairRound = 0;
  const exceptionalRepairIds: string[] = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === "--output") outputDirectory = argumentsList[++index];
    else if (argumentsList[index] === "--repair-round") repairRound = Number(argumentsList[++index]);
    else if (argumentsList[index] === "--exceptional-repair-id") exceptionalRepairIds.push(argumentsList[++index]);
    else throw new Error(`Unknown machine review argument: ${argumentsList[index]}`);
  }
  return { outputDirectory, repairRound, exceptionalRepairIds };
}

function main(): void {
  const options = parseCliArguments(process.argv.slice(2));
  const report = runMachineReview(options);
  const outputDirectory = resolve(process.cwd(), options.outputDirectory ?? DEFAULT_OUTPUT);
  process.stdout.write(`${report.verdict.verdict}\n${relative(process.cwd(), outputDirectory).replaceAll("\\", "/")}\n`);
  if (report.verdict.verdict !== "PASS_MACHINE") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

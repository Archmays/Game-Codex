import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, relative as relativePath, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_HARD_GATE_IDS, type HardGateId, type HardGateResult } from "./evaluate-hard-gates";
import { validateCommandGateResultsForFinalizer } from "./command-evidence";
import {
  assertStrictAgentProfileCoverage,
  assertStrictCatalogSmokeCoverage,
  assertStrictScrollMatrixCoverage,
} from "./evidence-validators";
import { validateDeepRouteEvidenceReport, type DeepRouteEvidenceReport } from "./deep-route-evidence";
import { validateStep07LifecycleEvidenceReport } from "./step07-lifecycle-evidence";
import { computeMachineReviewSourceTreeSha256 } from "./source-identity";

const COMMAND_GATE_IDS = [
  "compile",
  "targeted-tests",
  "step-regressions",
  "full-tests",
  "build",
  "visual-regression",
  "aria-snapshots",
] as const;

type CommandGateId = (typeof COMMAND_GATE_IDS)[number];

interface CommandGateResult {
  readonly id: CommandGateId;
  readonly status: "PASS" | "FAIL";
  readonly evidenceFiles: readonly string[];
  readonly detail: string;
}

interface CommandGateDocument {
  readonly schemaVersion: 1;
  readonly sourceTreeSha256: string;
  readonly results: readonly CommandGateResult[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function status(value: Record<string, unknown>, label: string): "PASS" | "FAIL" {
  if (value.status !== "PASS" && value.status !== "FAIL") throw new Error(`${label} must declare PASS or FAIL status`);
  return value.status;
}

function assertSourceIdentity(value: Record<string, unknown>, label: string, sourceTreeSha256: string): void {
  if (value.sourceTreeSha256 !== sourceTreeSha256) {
    throw new Error(`${label} sourceTreeSha256 does not match the current source tree`);
  }
}

function evidencePathExists(path: string, workspaceRoot: string): boolean {
  const absolute = isAbsolute(path) ? path : resolve(workspaceRoot, path);
  return existsSync(absolute) && statSync(absolute).isFile() && statSync(absolute).size > 0;
}

function validateReferencedEvidenceFiles(value: unknown, label: string, workspaceRoot: string): void {
  const references = collectStringArrays(value, "evidenceFiles");
  if (references.length === 0) throw new Error(`${label} must cite evidenceFiles`);
  for (const evidenceFile of references) {
    if (!evidenceFile.trim() || !evidencePathExists(evidenceFile, workspaceRoot)) {
      throw new Error(`${label} evidence is missing: ${evidenceFile}`);
    }
  }
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`);
  return value as number;
}

function exactResultTotals(
  value: Record<string, unknown>,
  label: string,
  totalKey: string,
  expectedTotal: number | null = null,
): boolean {
  if (!Array.isArray(value.results)) throw new Error(`${label}.results must be an array`);
  const total = integer(value[totalKey], `${label}.${totalKey}`);
  const passed = integer(value.passed, `${label}.passed`);
  const failed = integer(value.failed, `${label}.failed`);
  if (total !== value.results.length || passed + failed !== total) throw new Error(`${label} totals do not match results`);
  if (expectedTotal !== null && total !== expectedTotal) return false;
  const resultPasses = value.results.filter((entry) => isRecord(entry) && entry.status === "PASS").length;
  const resultFailures = value.results.filter((entry) => isRecord(entry) && entry.status === "FAIL").length;
  if (resultPasses !== passed || resultFailures !== failed || resultPasses + resultFailures !== total) {
    throw new Error(`${label} passed/failed counts do not match result statuses`);
  }
  return failed === 0;
}

function validateCommandGates(
  value: unknown,
  sourceTreeSha256: string,
  workspaceRoot: string,
): CommandGateDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.results)) throw new Error("COMMAND-GATE-RESULTS.json is invalid");
  assertSourceIdentity(value, "COMMAND-GATE-RESULTS.json", sourceTreeSha256);
  const results = value.results as unknown as CommandGateResult[];
  const ids = results.map((entry) => entry.id);
  if (results.length !== COMMAND_GATE_IDS.length || new Set(ids).size !== ids.length || COMMAND_GATE_IDS.some((id) => !ids.includes(id))) {
    throw new Error("COMMAND-GATE-RESULTS.json must contain the exact seven command gates");
  }
  for (const entry of results) {
    if (entry.status !== "PASS" && entry.status !== "FAIL") throw new Error(`Invalid command status for ${entry.id}`);
    if (!entry.detail?.trim() || !Array.isArray(entry.evidenceFiles) || entry.evidenceFiles.length === 0) throw new Error(`Command gate ${entry.id} must cite evidence`);
    for (const evidenceFile of entry.evidenceFiles) {
      if (!evidencePathExists(evidenceFile, workspaceRoot)) throw new Error(`Command gate evidence is missing: ${evidenceFile}`);
    }
  }
  return value as unknown as CommandGateDocument;
}

function validateScrollMatrix(
  value: unknown,
  sourceTreeSha256: string,
  workspaceRoot: string,
): boolean {
  if (!isRecord(value) || !isRecord(value.summary) || !Array.isArray(value.rows)) throw new Error("SCROLL-MATRIX.json is invalid");
  assertSourceIdentity(value, "SCROLL-MATRIX.json", sourceTreeSha256);
  validateReferencedEvidenceFiles(value, "SCROLL-MATRIX.json", workspaceRoot);
  const total = integer(value.summary.total, "SCROLL-MATRIX.json.summary.total");
  const passed = integer(value.summary.passed, "SCROLL-MATRIX.json.summary.passed");
  const failed = integer(value.summary.failed, "SCROLL-MATRIX.json.summary.failed");
  if (total !== value.rows.length || passed + failed !== total) throw new Error("SCROLL-MATRIX.json summary totals do not match rows");
  const rowPasses = value.rows.filter((entry) => isRecord(entry) && entry.status === "PASS").length;
  const rowFailures = value.rows.filter((entry) => isRecord(entry) && entry.status === "FAIL").length;
  if (rowPasses !== passed || rowFailures !== failed || rowPasses + rowFailures !== total) throw new Error("SCROLL-MATRIX.json summary counts do not match row statuses");
  const computedPass = total > 0 && failed === 0;
  if (status(value, "SCROLL-MATRIX.json") !== (computedPass ? "PASS" : "FAIL") || status(value.summary, "SCROLL-MATRIX.json.summary") !== (computedPass ? "PASS" : "FAIL")) {
    throw new Error("SCROLL-MATRIX.json PASS status does not match totals");
  }
  if (typeof value.passed === "boolean" && value.passed !== computedPass) throw new Error("SCROLL-MATRIX.json passed flag does not match totals");
  return computedPass;
}

function validateCatalogSmoke(
  value: unknown,
  sourceTreeSha256: string,
  workspaceRoot: string,
): boolean {
  if (!isRecord(value)) throw new Error("GAME-CATALOG-MACHINE-SMOKE.json is invalid");
  assertSourceIdentity(value, "GAME-CATALOG-MACHINE-SMOKE.json", sourceTreeSha256);
  validateReferencedEvidenceFiles(value, "GAME-CATALOG-MACHINE-SMOKE.json", workspaceRoot);
  const expected = integer(value.expectedResultCount, "GAME-CATALOG-MACHINE-SMOKE.json.expectedResultCount");
  const computedPass = expected > 0 && exactResultTotals(value, "GAME-CATALOG-MACHINE-SMOKE.json", "resultCount", expected);
  if (status(value, "GAME-CATALOG-MACHINE-SMOKE.json") !== (computedPass ? "PASS" : "FAIL")) throw new Error("GAME-CATALOG-MACHINE-SMOKE.json PASS status does not match totals");
  return computedPass;
}

function validateAgentPlaythroughs(
  value: unknown,
  sourceTreeSha256: string,
  workspaceRoot: string,
): boolean {
  if (!isRecord(value) || !Array.isArray(value.expectedProfiles)) throw new Error("AGENT-PLAYTHROUGH-RESULTS.json is invalid");
  assertSourceIdentity(value, "AGENT-PLAYTHROUGH-RESULTS.json", sourceTreeSha256);
  validateReferencedEvidenceFiles(value, "AGENT-PLAYTHROUGH-RESULTS.json", workspaceRoot);
  const expectedProfiles = value.expectedProfiles.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  if (expectedProfiles.length !== value.expectedProfiles.length || new Set(expectedProfiles).size !== expectedProfiles.length) throw new Error("AGENT-PLAYTHROUGH-RESULTS.json expectedProfiles are invalid");
  const totalsPass = exactResultTotals(value, "AGENT-PLAYTHROUGH-RESULTS.json", "profileCount", expectedProfiles.length);
  const actualProfiles = (value.results as unknown[]).map((entry) => isRecord(entry) ? entry.profile : null);
  const complete = value.allExpectedProfilesRecorded === true
    && actualProfiles.length === expectedProfiles.length
    && expectedProfiles.every((profile) => actualProfiles.includes(profile));
  const computedPass = expectedProfiles.length > 0 && totalsPass && complete;
  if (status(value, "AGENT-PLAYTHROUGH-RESULTS.json") !== (computedPass ? "PASS" : "FAIL")) throw new Error("AGENT-PLAYTHROUGH-RESULTS.json PASS status does not match totals");
  if (!isRecord(value.networkPolicy) || integer(value.networkPolicy.externalRequestCount, "AGENT-PLAYTHROUGH-RESULTS.json.networkPolicy.externalRequestCount") !== collectStringArrays(value, "externalRequests").length) {
    throw new Error("AGENT-PLAYTHROUGH-RESULTS.json external request count does not match results");
  }
  return computedPass;
}

function collectStringArrays(value: unknown, key: string, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectStringArrays(entry, key, output);
    return output;
  }
  if (!isRecord(value)) return output;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && Array.isArray(entryValue)) {
      output.push(...entryValue.filter((item): item is string => typeof item === "string"));
    } else {
      collectStringArrays(entryValue, key, output);
    }
  }
  return output;
}

function command(results: readonly CommandGateResult[], id: CommandGateId): CommandGateResult {
  const result = results.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing command gate ${id}`);
  return result;
}

function relative(path: string, workspaceRoot: string): string {
  return relativePath(workspaceRoot, path).replaceAll("\\", "/");
}

export function finalizeMachineEvidence(outputPath?: string, workspaceRoot = process.cwd()): void {
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
  const outputDirectory = resolve(workspaceRoot, outputPath ?? "artifacts/game-machine-review/step-07");
  const hardGateDirectory = resolve(outputDirectory, "hard-gates");
  mkdirSync(hardGateDirectory, { recursive: true });
  const commandPath = resolve(hardGateDirectory, "COMMAND-GATE-RESULTS.json");
  const commandGates = validateCommandGateResultsForFinalizer(readJson(commandPath), {
    workspaceRoot,
    outputDirectory,
    sourceTreeSha256,
  });
  const scrollPath = resolve(outputDirectory, "SCROLL-MATRIX.json");
  const catalogPath = resolve(outputDirectory, "GAME-CATALOG-MACHINE-SMOKE.json");
  const profilePath = resolve(outputDirectory, "agent-playthrough/AGENT-PLAYTHROUGH-RESULTS.json");
  const deepRoutePath = resolve(outputDirectory, "DEEP-ROUTE-EVIDENCE.json");
  const lifecyclePath = resolve(outputDirectory, "STEP07-LIFECYCLE-EVIDENCE.json");
  const scroll = readJson(scrollPath);
  const catalog = readJson(catalogPath);
  const profiles = readJson(profilePath);
  const deepRoute = readJson(deepRoutePath);
  const lifecycle = readJson(lifecyclePath);
  assertStrictScrollMatrixCoverage(scroll, workspaceRoot);
  assertStrictCatalogSmokeCoverage(catalog, workspaceRoot);
  assertStrictAgentProfileCoverage(profiles, workspaceRoot);
  if (!isRecord(deepRoute)) throw new Error("DEEP-ROUTE-EVIDENCE.json is invalid");
  assertSourceIdentity(deepRoute, "DEEP-ROUTE-EVIDENCE.json", sourceTreeSha256);
  validateReferencedEvidenceFiles(deepRoute, "DEEP-ROUTE-EVIDENCE.json", workspaceRoot);
  const deepRouteErrors = validateDeepRouteEvidenceReport(deepRoute as unknown as DeepRouteEvidenceReport, workspaceRoot);
  if (deepRoute.status !== "PASS" || deepRouteErrors.length > 0) {
    throw new Error(`DEEP-ROUTE-EVIDENCE.json failed canonical validation: ${deepRouteErrors.join("; ")}`);
  }
  const deepRoutePass = true;
  const lifecycleErrors = validateStep07LifecycleEvidenceReport(lifecycle, sourceTreeSha256);
  if (!isRecord(lifecycle) || lifecycle.status !== "PASS" || lifecycleErrors.length > 0) {
    throw new Error(`STEP07-LIFECYCLE-EVIDENCE.json failed canonical validation: ${lifecycleErrors.join("; ")}`);
  }
  const lifecyclePass = true;
  const scrollPass = validateScrollMatrix(scroll, sourceTreeSha256, workspaceRoot);
  const catalogPass = validateCatalogSmoke(catalog, sourceTreeSha256, workspaceRoot);
  const profilePass = validateAgentPlaythroughs(profiles, sourceTreeSha256, workspaceRoot);

  const externalRequests = [...new Set([
    ...collectStringArrays(scroll, "externalRequests"),
    ...collectStringArrays(catalog, "externalRequests"),
    ...collectStringArrays(profiles, "externalRequests"),
    ...collectStringArrays(deepRoute, "externalRequests"),
    ...collectStringArrays(lifecycle, "externalRequests"),
  ])];
  const sameOriginRequests = [...new Set([
    ...collectStringArrays(scroll, "sameOriginRequests"),
    ...collectStringArrays(catalog, "sameOriginRequests"),
    ...collectStringArrays(profiles, "sameOriginRequests"),
    ...collectStringArrays(deepRoute, "sameOriginRequests"),
    ...collectStringArrays(lifecycle, "sameOriginRequests"),
  ])];
  const runtimeErrors = [
    ...collectStringArrays(scroll, "consoleErrors"),
    ...collectStringArrays(scroll, "pageErrors"),
    ...collectStringArrays(catalog, "consoleErrors"),
    ...collectStringArrays(catalog, "pageErrors"),
    ...collectStringArrays(catalog, "failedRequests"),
    ...collectStringArrays(profiles, "consoleErrors"),
    ...collectStringArrays(profiles, "pageErrors"),
    ...collectStringArrays(profiles, "failedRequests"),
    ...collectStringArrays(deepRoute, "consoleErrors"),
    ...collectStringArrays(deepRoute, "pageErrors"),
    ...collectStringArrays(deepRoute, "failedRequests"),
    ...collectStringArrays(lifecycle, "consoleErrors"),
    ...collectStringArrays(lifecycle, "pageErrors"),
    ...collectStringArrays(lifecycle, "failedRequests"),
  ];

  if (externalRequests.length > 0) throw new Error(`External network requests were recorded: ${externalRequests.length}`);
  if (runtimeErrors.length > 0) throw new Error(`Runtime errors were recorded: ${runtimeErrors.length}`);

  const commandRef = relative(commandPath, workspaceRoot);
  const scrollRef = relative(scrollPath, workspaceRoot);
  const catalogRef = relative(catalogPath, workspaceRoot);
  const profileRef = relative(profilePath, workspaceRoot);
  const deepRouteRef = relative(deepRoutePath, workspaceRoot);
  const lifecycleRef = relative(lifecyclePath, workspaceRoot);
  const gate = (
    id: HardGateId,
    passed: boolean,
    evidenceFiles: readonly string[],
    detail: string,
  ): HardGateResult => ({ id, status: passed ? "PASS" : "FAIL", evidenceFiles, detail });

  const commandPass = (id: CommandGateId) => command(commandGates.results, id).status === "PASS";
  const commandEvidence = (id: CommandGateId) => command(commandGates.results, id).evidenceFiles;
  const results: HardGateResult[] = [
    gate("compile", commandPass("compile"), commandEvidence("compile"), command(commandGates.results, "compile").detail),
    gate("targeted-tests", commandPass("targeted-tests"), commandEvidence("targeted-tests"), command(commandGates.results, "targeted-tests").detail),
    gate("full-tests", commandPass("full-tests"), commandEvidence("full-tests"), command(commandGates.results, "full-tests").detail),
    gate("build", commandPass("build"), commandEvidence("build"), command(commandGates.results, "build").detail),
    gate("route-precedence", commandPass("targeted-tests") && lifecyclePass, [commandRef, lifecycleRef], "Versioned route conflicts plus lifecycle continuity and ordinary history"),
    gate("state-invariants", commandPass("step-regressions") && profilePass && deepRoutePass && lifecyclePass, [commandRef, profileRef, deepRouteRef, lifecycleRef], "STEP regressions, canonical deep states, lifecycle, and deterministic profiles"),
    gate("save-and-corrupt-recovery", commandPass("step-regressions") && profilePass && lifecyclePass, [commandRef, profileRef, lifecycleRef], "Save continuity, reload/recovery, returning-user, and corrupt recovery checks"),
    gate("console-and-page-errors", runtimeErrors.length === 0 && scrollPass && catalogPass && profilePass && deepRoutePass && lifecyclePass, [scrollRef, catalogRef, profileRef, deepRouteRef, lifecycleRef], `Runtime error entries: ${runtimeErrors.length}`),
    gate("external-network", externalRequests.length === 0 && scrollPass && catalogPass && profilePass && deepRoutePass && lifecyclePass, [scrollRef, catalogRef, profileRef, deepRouteRef, lifecycleRef], `SAME_ORIGIN_ALLOWED; external requests: ${externalRequests.length}`),
    gate("privacy-and-pii", commandPass("targeted-tests") && lifecyclePass && externalRequests.length === 0, [commandRef, profileRef, lifecycleRef], "Deny-by-default schema/privacy tests and isolated same-context lifecycle pages"),
    gate("adult-scroll-and-reflow", scrollPass, [scrollRef], "Wheel, keyboard, touch, focus, single-owner, and reflow matrix"),
    gate("keyboard-focus-and-targets", scrollPass && profilePass && deepRoutePass, [scrollRef, profileRef, deepRouteRef], "Final-action activation, focus/target matrix, and KEYBOARD_ONLY profile"),
    gate("accessibility-structure", commandPass("aria-snapshots") && profilePass && deepRoutePass, [...commandEvidence("aria-snapshots"), profileRef, deepRouteRef], "Reviewed ARIA baseline plus canonical route accessibility matrix"),
    gate("deterministic-visual-states", commandPass("visual-regression") && deepRoutePass, [...commandEvidence("visual-regression"), deepRouteRef], "Reviewed established baseline, deep states, and no-update rerun"),
    gate("child-copy-and-forbidden-mechanics", commandPass("step-regressions"), commandEvidence("step-regressions"), "Frozen content and forbidden-mechanics regression"),
  ];
  if (results.map((entry) => entry.id).join("|") !== [...REQUIRED_HARD_GATE_IDS].join("|")) throw new Error("Hard gate order drifted from evaluator contract");

  const networkGate = {
    schemaVersion: 1,
    sourceTreeSha256,
    status: externalRequests.length === 0 && scrollPass && catalogPass && profilePass && deepRoutePass && lifecyclePass ? "PASS" : "FAIL",
    policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
    sameOriginRequestCount: sameOriginRequests.length,
    externalRequests,
    evidenceFiles: [scrollRef, catalogRef, profileRef, deepRouteRef, lifecycleRef],
  };
  const privacyGate = {
    schemaVersion: 1,
    sourceTreeSha256,
    status: commandPass("targeted-tests") && lifecyclePass && externalRequests.length === 0 ? "PASS" : "FAIL",
    evidenceFiles: [commandRef, profileRef, lifecycleRef],
  };
  const evidenceSummary = (id: "full-tests" | "build") => ({
    schemaVersion: 1,
    sourceTreeSha256,
    status: commandPass(id) ? "PASS" : "FAIL",
    evidenceFiles: commandEvidence(id),
  });

  writeFileSync(resolve(hardGateDirectory, "HARD-GATES.json"), `${JSON.stringify({ schemaVersion: 1, sourceTreeSha256, status: results.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL", results }, null, 2)}\n`, "utf8");
  writeFileSync(resolve(hardGateDirectory, "NETWORK-GATE.json"), `${JSON.stringify(networkGate, null, 2)}\n`, "utf8");
  writeFileSync(resolve(hardGateDirectory, "PRIVACY-GATE.json"), `${JSON.stringify(privacyGate, null, 2)}\n`, "utf8");
  writeFileSync(resolve(hardGateDirectory, "FINAL-FULL-TESTS.json"), `${JSON.stringify(evidenceSummary("full-tests"), null, 2)}\n`, "utf8");
  writeFileSync(resolve(hardGateDirectory, "FINAL-BUILD.json"), `${JSON.stringify(evidenceSummary("build"), null, 2)}\n`, "utf8");
  process.stdout.write(`${results.filter((entry) => entry.status === "PASS").length}/${results.length} hard gates PASS\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) finalizeMachineEvidence(process.argv[2]);

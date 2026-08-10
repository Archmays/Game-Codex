import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  MACHINE_AGENT_PROFILE_IDS,
  MACHINE_AGENT_PROFILE_PROJECTS,
  createMachineReviewManifest,
} from "./machine-review-manifest";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error(`${label} must be an array of objects`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) throw new Error(`${label} must be a string array`);
  return value;
}

function emptyStringArray(value: unknown, label: string): void {
  if (strings(value, label).length !== 0) throw new Error(`${label} must be empty`);
}

function exactOrderedStrings(actual: unknown, expected: readonly string[], label: string): void {
  const values = strings(actual, label);
  if (JSON.stringify(values) !== JSON.stringify(expected)) throw new Error(`${label} does not match the canonical inventory`);
}

function exactUniqueKeys(actual: readonly string[], expected: readonly string[], label: string): void {
  if (new Set(actual).size !== actual.length) throw new Error(`${label} contains duplicate coverage`);
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) throw new Error(`${label} is incomplete or contains unknown coverage`);
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function evidenceFile(value: unknown, label: string, workspaceRoot: string): string {
  const path = nonEmpty(value, label);
  const absolute = isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
  const workspaceRelative = relative(workspaceRoot, absolute);
  const outputRoot = resolve(workspaceRoot, "artifacts/game-machine-review/step-07");
  const outputRelative = relative(outputRoot, absolute);
  if (isAbsolute(workspaceRelative)
    || workspaceRelative === ".."
    || workspaceRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(outputRelative)
    || outputRelative === ".."
    || outputRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`${label} escapes the workspace`);
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) {
    throw new Error(`${label} is missing or empty: ${path}`);
  }
  return path;
}

function evidenceFileKey(path: string, workspaceRoot: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

export function assertStrictScrollMatrixCoverage(
  value: unknown,
  inventoryWorkspaceRoot = process.cwd(),
  evidenceWorkspaceRoot = inventoryWorkspaceRoot,
): void {
  if (!isRecord(value)) throw new Error("SCROLL-MATRIX.json must be an object");
  if (value.evidenceComplete !== true || strings(value.missingOrStaleProjects, "scroll missing projects").length !== 0) {
    throw new Error("SCROLL-MATRIX.json must contain both current project results");
  }
  const manifest = createMachineReviewManifest(inventoryWorkspaceRoot);
  const expected = manifest.adultToolRoutes.flatMap((route) =>
    manifest.adultScrollViewports.map((viewport) => `${route.routeKind}|${viewport.project}|${viewport.viewport}`),
  );
  const evidenceInventory = new Set(
    strings(value.evidenceFiles, "scroll evidenceFiles").map((path) => evidenceFileKey(path, evidenceWorkspaceRoot)),
  );
  const rowTraceKeys = new Set<string>();
  const rows = records(value.rows, "scroll rows");
  const actual = rows.map((row, index) => {
    const routeKind = nonEmpty(row.routeKind, `scroll rows[${index}].routeKind`);
    const project = nonEmpty(row.project, `scroll rows[${index}].project`);
    const viewport = nonEmpty(row.viewport, `scroll rows[${index}].viewport`);
    const viewportContract = manifest.adultScrollViewports.find(
      (candidate) => candidate.project === project && candidate.viewport === viewport,
    );
    if (!viewportContract) throw new Error(`scroll rows[${index}] has an unknown project/viewport`);
    if (row.status !== "PASS" || row.pageMode !== "adult-tool" || row.scrollOwner !== "document.documentElement") {
      throw new Error(`scroll rows[${index}] does not prove the adult-tool document contract`);
    }
    if (typeof row.horizontalOverflowPx !== "number" || row.horizontalOverflowPx > 1) throw new Error(`scroll rows[${index}] has horizontal overflow`);
    if (strings(row.nestedVerticalScrollOwners, `scroll rows[${index}].nestedVerticalScrollOwners`).length !== 0) throw new Error(`scroll rows[${index}] has a nested vertical scroll owner`);
    const inputs = records(row.inputs, `scroll rows[${index}].inputs`);
    for (const requiredInput of viewportContract.requiredInputs) {
      const candidates = inputs.filter((input) => input.input === requiredInput);
      if (candidates.length < 1 || candidates.some((input) => input.passed !== true)) throw new Error(`scroll rows[${index}] lacks passing ${requiredInput} input`);
      if (requiredInput === "Home") {
        if (!candidates.some((input) => input.after === 0)) throw new Error(`scroll rows[${index}] Home did not return to top`);
      } else if (!candidates.some((input) => typeof input.before === "number" && typeof input.after === "number" && input.after > input.before)) {
        throw new Error(`scroll rows[${index}] ${requiredInput} did not increase document scrollTop`);
      }
    }
    if (!inputs.every((input) => input.passed === true)) throw new Error(`scroll rows[${index}] contains a failed input`);
    if (!isRecord(row.finalAction)
      || row.finalAction.visible !== true
      || row.finalAction.enabled !== true
      || row.finalAction.focused !== true
      || row.finalAction.unobscured !== true
      || row.finalAction.clicked !== true
      || typeof row.finalAction.activationEvidence !== "string"
      || row.finalAction.activationEvidence.trim().length === 0) {
      throw new Error(`scroll rows[${index}] final action was not visibly focused and activated`);
    }
    if (!isRecord(row.network) || strings(row.network.externalRequests, `scroll rows[${index}] external requests`).length !== 0) throw new Error(`scroll rows[${index}] used external network`);
    emptyStringArray(row.consoleErrors, `scroll rows[${index}].consoleErrors`);
    emptyStringArray(row.pageErrors, `scroll rows[${index}].pageErrors`);
    emptyStringArray(row.failedRequests, `scroll rows[${index}].failedRequests`);
    const trace = evidenceFile(row.trace, `scroll rows[${index}].trace`, evidenceWorkspaceRoot);
    const traceKey = evidenceFileKey(trace, evidenceWorkspaceRoot);
    if (rowTraceKeys.has(traceKey)) throw new Error(`scroll rows[${index}].trace duplicates another isolated row trace`);
    rowTraceKeys.add(traceKey);
    if (!evidenceInventory.has(traceKey)) throw new Error(`scroll rows[${index}].trace is not bound into SCROLL-MATRIX.json evidenceFiles`);
    const screenshots = strings(row.screenshots, `scroll rows[${index}].screenshots`);
    const fullPageScreenshot = nonEmpty(row.fullPageScreenshot, `scroll rows[${index}].fullPageScreenshot`);
    if (screenshots.length < 4 || new Set(screenshots).size < 4 || !screenshots.includes(fullPageScreenshot)) {
      throw new Error(`scroll rows[${index}] lacks top, bottom, final-action, and full-page screenshots`);
    }
    for (const [screenshotIndex, screenshot] of screenshots.entries()) {
      evidenceFile(screenshot, `scroll rows[${index}].screenshots[${screenshotIndex}]`, evidenceWorkspaceRoot);
    }
    return `${routeKind}|${project}|${viewport}`;
  });
  exactUniqueKeys(actual, expected, "scroll matrix coverage");
  if (!isRecord(value.summary) || value.summary.total !== expected.length || value.summary.passed !== expected.length || value.summary.failed !== 0) {
    throw new Error("SCROLL-MATRIX.json summary does not match canonical coverage");
  }
}

export function assertStrictCatalogSmokeCoverage(
  value: unknown,
  inventoryWorkspaceRoot = process.cwd(),
  evidenceWorkspaceRoot = inventoryWorkspaceRoot,
): void {
  if (!isRecord(value)) throw new Error("GAME-CATALOG-MACHINE-SMOKE.json must be an object");
  const manifest = createMachineReviewManifest(inventoryWorkspaceRoot);
  const gameIds = manifest.catalogSmokeRoutes.map((route) => route.catalogGameId);
  const projects = ["desktop-chromium", "mobile-touch-chromium"] as const;
  exactOrderedStrings(value.expectedCatalogGameIds, gameIds, "catalog expected ids");
  exactOrderedStrings(value.expectedProjects, projects, "catalog expected projects");
  if (value.isolatedContexts !== true) throw new Error("catalog smoke must use isolated contexts");
  const expected = projects.flatMap((project) => gameIds.map((gameId) => `${project}|${gameId}`));
  if (value.expectedResultCount !== expected.length || value.resultCount !== expected.length || value.passed !== expected.length || value.failed !== 0) {
    throw new Error("catalog smoke totals do not match canonical gameCatalog x project coverage");
  }
  const definitions = new Map(manifest.catalogSmokeRoutes.map((route) => [route.catalogGameId, route]));
  const results = records(value.results, "catalog results");
  const actual = results.map((result, index) => {
    const project = nonEmpty(result.project, `catalog results[${index}].project`);
    const gameId = nonEmpty(result.catalogGameId, `catalog results[${index}].catalogGameId`);
    const definition = definitions.get(gameId);
    if (!definition || !projects.includes(project as (typeof projects)[number])) throw new Error(`catalog results[${index}] has unknown coverage`);
    if (result.title !== definition.title || result.status !== "PASS" || result.returnedToCatalog !== true || result.isolatedBrowserContext !== true) {
      throw new Error(`catalog results[${index}] did not enter, act, and return in an isolated context`);
    }
    const action = nonEmpty(result.firstAction, `catalog results[${index}].firstAction`);
    if (action === "NOT_RUN") throw new Error(`catalog results[${index}] did not execute a first action`);
    nonEmpty(result.postconditionEvidence, `catalog results[${index}].postconditionEvidence`);
    evidenceFile(result.screenshot, `catalog results[${index}].screenshot`, evidenceWorkspaceRoot);
    evidenceFile(result.trace, `catalog results[${index}].trace`, evidenceWorkspaceRoot);
    emptyStringArray(result.consoleErrors, `catalog results[${index}].consoleErrors`);
    emptyStringArray(result.pageErrors, `catalog results[${index}].pageErrors`);
    emptyStringArray(result.failedRequests, `catalog results[${index}].failedRequests`);
    emptyStringArray(result.externalRequests, `catalog results[${index}].externalRequests`);
    return `${project}|${gameId}`;
  });
  exactUniqueKeys(actual, expected, "catalog smoke coverage");
}

export function assertStrictAgentProfileCoverage(value: unknown, workspaceRoot = process.cwd()): void {
  if (!isRecord(value)) throw new Error("AGENT-PLAYTHROUGH-RESULTS.json must be an object");
  exactOrderedStrings(value.expectedProfiles, MACHINE_AGENT_PROFILE_IDS, "agent expected profiles");
  if (JSON.stringify(value.expectedProjects) !== JSON.stringify(MACHINE_AGENT_PROFILE_PROJECTS)) throw new Error("agent expected projects do not match the canonical profile contract");
  if (value.isolatedBrowserContexts !== true || value.fixtureMarker !== "SYNTHETIC_TOOLING_TEST_ONLY") throw new Error("agent profiles must be isolated synthetic evidence");
  if (value.profileCount !== MACHINE_AGENT_PROFILE_IDS.length || value.passed !== MACHINE_AGENT_PROFILE_IDS.length || value.failed !== 0 || value.allExpectedProfilesRecorded !== true) {
    throw new Error("agent profile totals do not match the canonical six profiles");
  }
  const results = records(value.results, "agent profile results");
  const actual = results.map((result, index) => {
    const profile = nonEmpty(result.profile, `agent results[${index}].profile`) as (typeof MACHINE_AGENT_PROFILE_IDS)[number];
    if (!MACHINE_AGENT_PROFILE_IDS.includes(profile)) throw new Error(`agent results[${index}] has an unknown profile`);
    if (result.project !== MACHINE_AGENT_PROFILE_PROJECTS[profile]) throw new Error(`agent results[${index}] ran in the wrong project`);
    if (result.status !== "PASS" || result.completed !== true || result.isolatedBrowserContext !== true || result.fixtureMarker !== "SYNTHETIC_TOOLING_TEST_ONLY") {
      throw new Error(`agent results[${index}] did not complete in an isolated synthetic context`);
    }
    if (strings(result.actualInteractions, `agent results[${index}].actualInteractions`).length === 0
      || strings(result.completionEvidence, `agent results[${index}].completionEvidence`).length === 0) {
      throw new Error(`agent results[${index}] lacks interaction or completion evidence`);
    }
    evidenceFile(result.screenshot, `agent results[${index}].screenshot`, workspaceRoot);
    evidenceFile(result.trace, `agent results[${index}].trace`, workspaceRoot);
    emptyStringArray(result.consoleErrors, `agent results[${index}].consoleErrors`);
    emptyStringArray(result.pageErrors, `agent results[${index}].pageErrors`);
    emptyStringArray(result.failedRequests, `agent results[${index}].failedRequests`);
    emptyStringArray(result.externalRequests, `agent results[${index}].externalRequests`);
    return profile;
  });
  exactUniqueKeys(actual, MACHINE_AGENT_PROFILE_IDS, "agent profile coverage");
}

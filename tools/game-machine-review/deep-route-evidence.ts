import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  MACHINE_REVIEW_MANIFEST,
  type MachineReviewManifest,
} from "./machine-review-manifest";

export const DEEP_A11Y_VIEWPORTS = [
  { id: "compact-mobile", width: 320, height: 568, hasTouch: true },
  { id: "mobile", width: 390, height: 844, hasTouch: true },
  { id: "tablet", width: 768, height: 1024, hasTouch: true },
  { id: "desktop", width: 1440, height: 900, hasTouch: false },
] as const;

export type DeepA11yViewportId = (typeof DEEP_A11Y_VIEWPORTS)[number]["id"];
export type DeepA11yPageClass = "child" | "adult";
export type DeepA11yCoverageKind = "deep-route" | "adult-tool";

export interface DeepA11yCoveragePlanRow {
  readonly key: string;
  readonly coverageKind: DeepA11yCoverageKind;
  readonly routeId: string;
  readonly routeKind: string;
  readonly route: string;
  readonly state: string;
  readonly viewportId: DeepA11yViewportId;
  readonly pageClass: DeepA11yPageClass;
}

export interface DeepA11yContextPlanEntry {
  readonly contextId: string;
  readonly rowKeys: readonly string[];
}

export interface DeepA11yContextSummary {
  readonly canonicalContexts: number;
  readonly actualContexts: number;
  readonly singleRowContexts: number;
  readonly multiRowContexts: number;
  readonly rows: number;
  readonly duplicateRows: number;
  readonly missingRows: number;
  readonly unknownRows: number;
  readonly missingContextAssignments: number;
  readonly missingCanonicalContexts: number;
  readonly unknownContexts: number;
  readonly wrongBindings: number;
  readonly crossScenarioReuse: number;
  readonly splitCanonicalContexts: number;
}

export interface DeepA11yContextContractValidation {
  readonly expectedContextIds: readonly string[];
  readonly actualContextIds: readonly string[];
  readonly missingContextIds: readonly string[];
  readonly unexpectedContextIds: readonly string[];
  readonly summary: DeepA11yContextSummary;
  readonly errors: readonly string[];
}

export interface DeepRouteEvidenceRow extends DeepA11yCoveragePlanRow {
  readonly sourceTreeSha256: string;
  readonly contextId: string;
  readonly isolatedBrowserContext: true;
  readonly syntheticStorage: true;
  readonly storageFixture: string;
  readonly actualUrl: string;
  readonly actualVisualState: string;
  readonly screenshot: string;
  readonly aria: string;
  readonly eventTrace: string;
  readonly diagnostics: {
    readonly consoleErrors: readonly string[];
    readonly pageErrors: readonly string[];
    readonly failedRequests: readonly string[];
    readonly sameOriginRequests: readonly string[];
    readonly externalRequests: readonly string[];
    readonly networkClassification: {
      readonly sameOrigin: "SAME_ORIGIN_ALLOWED";
      readonly external: "EXTERNAL_NETWORK_FORBIDDEN";
    };
  };
  readonly accessibility: {
    readonly mainLandmarkCount: number;
    readonly nestedMainLandmarks: readonly string[];
    readonly levelOneHeadingCount: number;
    readonly duplicateIds: readonly string[];
    readonly horizontalOverflowPx: number;
    readonly horizontalOverflowElements?: readonly string[];
    readonly visibleDialogCount: number;
    readonly unnamedVisibleDialogs: readonly string[];
    readonly unlabeledFormControls: readonly string[];
    readonly targetRule: "ADULT_INTERACTIVE_24" | "CHILD_PRIMARY_44";
    readonly undersizedTargets: readonly string[];
    readonly focusTarget: string;
    readonly focusVisible: boolean;
    readonly focusUnobscured: boolean;
    readonly dragOrTouchAlternative: "PASS" | "FAIL" | "NOT_APPLICABLE";
  };
  readonly catalogGameIds?: readonly string[];
  readonly actionTrace: readonly string[];
  readonly status: "PASS" | "FAIL";
}

export interface DeepRouteEvidenceReport {
  readonly schemaVersion: 1;
  readonly evidenceKind: "CANONICAL_DEEP_ROUTE_ACCESSIBILITY";
  readonly sourceTreeSha: string;
  readonly sourceTreeSha256: string;
  readonly generatedAtUtc: string;
  readonly isolatedBrowserContexts: true;
  readonly syntheticStorageOnly: true;
  readonly networkPolicy: {
    readonly sameOrigin: "SAME_ORIGIN_ALLOWED";
    readonly external: "EXTERNAL_NETWORK_FORBIDDEN";
  };
  readonly matrixPolicy: string;
  readonly coverage: {
    readonly expectedRowKeys: readonly string[];
    readonly actualRowKeys: readonly string[];
    readonly missingRowKeys: readonly string[];
    readonly unexpectedRowKeys: readonly string[];
    readonly expectedRouteStates: readonly string[];
    readonly actualRouteStates: readonly string[];
    readonly expectedViewportIds: readonly DeepA11yViewportId[];
    readonly actualViewportIds: readonly DeepA11yViewportId[];
    readonly expectedContextIds: readonly string[];
    readonly actualContextIds: readonly string[];
    readonly missingContextIds: readonly string[];
    readonly unexpectedContextIds: readonly string[];
  };
  readonly contextSummary: DeepA11yContextSummary;
  readonly status: "PASS" | "FAIL";
  readonly evidenceFiles: readonly string[];
  readonly rows: readonly DeepRouteEvidenceRow[];
  readonly machineOnlyConclusion: string;
}

const DEEP_STATE_VIEWPORT_ALLOCATION: Readonly<Record<string, DeepA11yViewportId>> = {
  "my-game-world:fresh": "compact-mobile",
  "my-game-world:settings": "compact-mobile",
  "my-game-world:repaired": "mobile",
  "my-game-world:spellbook": "mobile",
  "my-game-world:treasure": "mobile",
  "my-game-world:reduced-motion": "mobile",
  "hanzi-golden-slice:camp": "tablet",
  "hanzi-golden-slice:ming-placing": "tablet",
  "hanzi-golden-slice:ming-formed": "tablet",
  "hanzi-golden-slice:hua": "tablet",
  "hanzi-golden-slice:ability-choice": "tablet",
  "hanzi-golden-slice:mute": "tablet",
  "hanzi-golden-slice:reduced-motion": "tablet",
  "hanzi-golden-slice:boss-lin": "desktop",
  "hanzi-golden-slice:boss-xing": "desktop",
  "hanzi-golden-slice:camp-repair": "desktop",
  "hanzi-golden-slice:spellbook": "desktop",
  "hanzi-golden-slice:run-complete": "desktop",
  "hanzi-golden-slice:return-world": "desktop",
  "hanzi-golden-slice:corrupt-save-recovery": "mobile",
  "classic-hub:catalog": "desktop",
};

const RESPONSIVE_KEY_SURFACES = [
  { routeId: "my-game-world", state: "fresh" },
  { routeId: "hanzi-golden-slice", state: "camp" },
  { routeId: "classic-hub", state: "catalog" },
] as const;

const REQUIRED_NARROW_VIEWPORTS = ["compact-mobile", "mobile"] as const satisfies readonly DeepA11yViewportId[];

export function deepA11yRowKey(routeId: string, state: string, viewportId: DeepA11yViewportId): string {
  return `${routeId}::${state}::${viewportId}`;
}

export function deepA11yRouteStateKey(routeId: string, state: string): string {
  return `${routeId}::${state}`;
}

/**
 * Independent STEP 07 scenario specification.
 *
 * A row key is unique evidence. A context id is one isolated browser scenario,
 * and may intentionally own several rows captured sequentially in this exact
 * order. Producer output is checked against this declaration; it is never used
 * to infer or rewrite an observed context id.
 */
export const DEEP_ROUTE_CONTEXT_PLAN = [
  {
    contextId: "world-compact-mobile",
    rowKeys: [
      "my-game-world::fresh::compact-mobile",
      "my-game-world::settings::compact-mobile",
    ],
  },
  {
    contextId: "world-mobile-repaired",
    rowKeys: [
      "my-game-world::repaired::mobile",
      "my-game-world::spellbook::mobile",
      "my-game-world::reduced-motion::mobile",
      "my-game-world::treasure::mobile",
    ],
  },
  {
    contextId: "golden-tablet-early",
    rowKeys: [
      "hanzi-golden-slice::camp::tablet",
      "hanzi-golden-slice::mute::tablet",
      "hanzi-golden-slice::reduced-motion::tablet",
      "hanzi-golden-slice::ming-placing::tablet",
      "hanzi-golden-slice::ming-formed::tablet",
      "hanzi-golden-slice::hua::tablet",
      "hanzi-golden-slice::ability-choice::tablet",
    ],
  },
  {
    contextId: "golden-desktop-late",
    rowKeys: [
      "hanzi-golden-slice::boss-lin::desktop",
      "hanzi-golden-slice::boss-xing::desktop",
      "hanzi-golden-slice::camp-repair::desktop",
      "hanzi-golden-slice::spellbook::desktop",
      "hanzi-golden-slice::run-complete::desktop",
      "hanzi-golden-slice::return-world::desktop",
    ],
  },
  {
    contextId: "golden-mobile-corrupt",
    rowKeys: ["hanzi-golden-slice::corrupt-save-recovery::mobile"],
  },
  {
    contextId: "classic-catalog-desktop",
    rowKeys: ["classic-hub::catalog::desktop"],
  },
  {
    contextId: "critical-compact-mobile",
    rowKeys: [
      "hanzi-golden-slice::camp::compact-mobile",
      "classic-hub::catalog::compact-mobile",
    ],
  },
  {
    contextId: "critical-mobile",
    rowKeys: [
      "my-game-world::fresh::mobile",
      "hanzi-golden-slice::camp::mobile",
      "classic-hub::catalog::mobile",
    ],
  },
  { contextId: "adult-observe-step07-compact-mobile", rowKeys: ["observe-step07::default::compact-mobile"] },
  { contextId: "adult-observe-step07-mobile", rowKeys: ["observe-step07::default::mobile"] },
  { contextId: "adult-observe-step06-compact-mobile", rowKeys: ["observe-step06::default::compact-mobile"] },
  { contextId: "adult-observe-step06-mobile", rowKeys: ["observe-step06::default::mobile"] },
  { contextId: "adult-observe-step04-compact-mobile", rowKeys: ["observe-step04::default::compact-mobile"] },
  { contextId: "adult-observe-step04-mobile", rowKeys: ["observe-step04::default::mobile"] },
  { contextId: "adult-review-step05-compact-mobile", rowKeys: ["review-step05::default::compact-mobile"] },
  { contextId: "adult-review-step05-mobile", rowKeys: ["review-step05::default::mobile"] },
  { contextId: "adult-review-step03-compact-mobile", rowKeys: ["review-step03::default::compact-mobile"] },
  { contextId: "adult-review-step03-mobile", rowKeys: ["review-step03::default::mobile"] },
  { contextId: "adult-review-step02-compact-mobile", rowKeys: ["review-step02::default::compact-mobile"] },
  { contextId: "adult-review-step02-mobile", rowKeys: ["review-step02::default::mobile"] },
  { contextId: "adult-machine-review-report-compact-mobile", rowKeys: ["machine-review-report::default::compact-mobile"] },
  { contextId: "adult-machine-review-report-mobile", rowKeys: ["machine-review-report::default::mobile"] },
] as const satisfies readonly DeepA11yContextPlanEntry[];

export const DEEP_A11Y_EXPECTED_ROW_COUNT = 40;
export const DEEP_A11Y_EXPECTED_CONTEXT_COUNT = 22;

function canonicalContextIndex(): {
  readonly contextByRowKey: ReadonlyMap<string, string>;
  readonly expectedRowKeys: readonly string[];
  readonly expectedContextIds: readonly string[];
} {
  const contextByRowKey = new Map<string, string>();
  const expectedContextIds: string[] = [];
  for (const entry of DEEP_ROUTE_CONTEXT_PLAN) {
    if (!entry.contextId || expectedContextIds.includes(entry.contextId)) {
      throw new Error(`Duplicate or empty canonical deep accessibility context: ${entry.contextId}`);
    }
    expectedContextIds.push(entry.contextId);
    if ((entry.rowKeys as readonly string[]).length === 0) throw new Error(`Canonical context ${entry.contextId} has no rows`);
    for (const rowKey of entry.rowKeys) {
      if (contextByRowKey.has(rowKey)) throw new Error(`Canonical row appears in more than one context: ${rowKey}`);
      contextByRowKey.set(rowKey, entry.contextId);
    }
  }
  const expectedRowKeys = [...contextByRowKey.keys()];
  if (expectedContextIds.length !== DEEP_A11Y_EXPECTED_CONTEXT_COUNT) {
    throw new Error(`Canonical context plan must contain exactly ${DEEP_A11Y_EXPECTED_CONTEXT_COUNT} contexts`);
  }
  if (expectedRowKeys.length !== DEEP_A11Y_EXPECTED_ROW_COUNT) {
    throw new Error(`Canonical context plan must contain exactly ${DEEP_A11Y_EXPECTED_ROW_COUNT} unique rows`);
  }
  return { contextByRowKey, expectedRowKeys, expectedContextIds };
}

export function canonicalDeepA11yContextId(rowKey: string): string {
  const contextId = canonicalContextIndex().contextByRowKey.get(rowKey);
  if (!contextId) throw new Error(`Unknown canonical deep accessibility row: ${rowKey}`);
  return contextId;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function createDeepRouteA11yCoveragePlan(
  manifest: MachineReviewManifest = MACHINE_REVIEW_MANIFEST,
): readonly DeepA11yCoveragePlanRow[] {
  const rows: DeepA11yCoveragePlanRow[] = [];
  for (const route of manifest.deepRoutes) {
    for (const state of route.states) {
      const allocationKey = `${route.id}:${state}`;
      const viewportId = DEEP_STATE_VIEWPORT_ALLOCATION[allocationKey];
      if (!viewportId) throw new Error(`Missing deep-route viewport allocation for ${allocationKey}`);
      rows.push({
        key: deepA11yRowKey(route.id, state, viewportId),
        coverageKind: "deep-route",
        routeId: route.id,
        routeKind: route.routeKind,
        route: route.route,
        state,
        viewportId,
        pageClass: "child",
      });
    }
  }
  for (const surface of RESPONSIVE_KEY_SURFACES) {
    const route = manifest.deepRoutes.find((candidate) => candidate.id === surface.routeId);
    if (!route || !route.states.includes(surface.state as never)) {
      throw new Error(`Missing canonical responsive surface ${surface.routeId}:${surface.state}`);
    }
    for (const viewportId of REQUIRED_NARROW_VIEWPORTS) {
      if (rows.some((row) => row.routeId === route.id && row.state === surface.state && row.viewportId === viewportId)) continue;
      rows.push({
        key: deepA11yRowKey(route.id, surface.state, viewportId),
        coverageKind: "deep-route",
        routeId: route.id,
        routeKind: route.routeKind,
        route: route.route,
        state: surface.state,
        viewportId,
        pageClass: "child",
      });
    }
  }
  for (const route of manifest.adultToolRoutes) {
    for (const viewportId of REQUIRED_NARROW_VIEWPORTS) {
      rows.push({
        key: deepA11yRowKey(route.id, "default", viewportId),
        coverageKind: "adult-tool",
        routeId: route.id,
        routeKind: route.routeKind,
        route: route.route,
        state: "default",
        viewportId,
        pageClass: "adult",
      });
    }
  }

  const duplicateKeys = rows.map((row) => row.key).filter((key, index, all) => all.indexOf(key) !== index);
  if (duplicateKeys.length > 0) throw new Error(`Duplicate deep accessibility coverage keys: ${duplicateKeys.join(", ")}`);
  const plannedViewports = sortedUnique(rows.map((row) => row.viewportId));
  const requiredViewports = sortedUnique(DEEP_A11Y_VIEWPORTS.map((viewport) => viewport.id));
  if (JSON.stringify(plannedViewports) !== JSON.stringify(requiredViewports)) {
    throw new Error(`Deep accessibility viewport allocation is incomplete: ${plannedViewports.join(", ")}`);
  }
  const { expectedRowKeys } = canonicalContextIndex();
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const missingContractRows = expectedRowKeys.filter((key) => !rowByKey.has(key));
  const unknownPlanRows = rows.map((row) => row.key).filter((key) => !expectedRowKeys.includes(key));
  if (missingContractRows.length > 0 || unknownPlanRows.length > 0 || rows.length !== DEEP_A11Y_EXPECTED_ROW_COUNT) {
    throw new Error(
      `Deep accessibility manifest plan drifted from the canonical context contract; missing=${missingContractRows.join(",") || "none"}; unknown=${unknownPlanRows.join(",") || "none"}`,
    );
  }
  return expectedRowKeys.map((key) => {
    const row = rowByKey.get(key);
    if (!row) throw new Error(`Canonical deep accessibility row is missing from manifest plan: ${key}`);
    return row;
  });
}

export function rowPassesHardEvidence(row: DeepRouteEvidenceRow, manifest = MACHINE_REVIEW_MANIFEST): boolean {
  const diagnostics = row.diagnostics;
  const accessibility = row.accessibility;
  const commonPass = row.isolatedBrowserContext
    && row.syntheticStorage
    && diagnostics.consoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.failedRequests.length === 0
    && diagnostics.externalRequests.length === 0
    && accessibility.mainLandmarkCount === 1
    && Array.isArray(accessibility.nestedMainLandmarks)
    && accessibility.nestedMainLandmarks.length === 0
    && accessibility.levelOneHeadingCount === 1
    && accessibility.duplicateIds.length === 0
    && accessibility.horizontalOverflowPx <= 1
    && accessibility.unnamedVisibleDialogs.length === 0
    && accessibility.unlabeledFormControls.length === 0
    && accessibility.undersizedTargets.length === 0
    && accessibility.focusVisible
    && accessibility.focusUnobscured
    && accessibility.dragOrTouchAlternative !== "FAIL";
  if (!commonPass) return false;
  if (row.routeId !== "classic-hub") return true;
  const expectedCatalogIds = manifest.catalogSmokeRoutes.map((entry) => entry.catalogGameId);
  return JSON.stringify(row.catalogGameIds) === JSON.stringify(expectedCatalogIds);
}

export function validateDeepRouteContextContract(
  rows: readonly Pick<DeepRouteEvidenceRow, "key" | "contextId">[],
): DeepA11yContextContractValidation {
  const { contextByRowKey, expectedRowKeys, expectedContextIds } = canonicalContextIndex();
  const errors: string[] = [];
  const actualRowKeys = rows.map((row) => row.key);
  const actualRowKeySet = new Set(actualRowKeys);
  const duplicateRowKeys = sortedUnique(actualRowKeys.filter((key, index) => actualRowKeys.indexOf(key) !== index));
  const missingRowKeys = expectedRowKeys.filter((key) => !actualRowKeySet.has(key));
  const unexpectedRowKeys = sortedUnique(actualRowKeys.filter((key) => !contextByRowKey.has(key)));
  const missingContextAssignments = rows.filter((row) => !row.contextId).length;
  const actualContextIds = sortedUnique(rows.map((row) => row.contextId).filter(Boolean));
  const actualContextIdSet = new Set(actualContextIds);
  const missingContextIds = expectedContextIds.filter((contextId) => !actualContextIdSet.has(contextId));
  const unexpectedContextIds = actualContextIds.filter((contextId) => !expectedContextIds.includes(contextId));
  const wrongBindings = rows.filter((row) => {
    const expectedContextId = contextByRowKey.get(row.key);
    return expectedContextId !== undefined && row.contextId !== expectedContextId;
  });

  const actualToExpectedContexts = new Map<string, Set<string>>();
  const expectedToActualContexts = new Map<string, Set<string>>();
  for (const row of rows) {
    const expectedContextId = contextByRowKey.get(row.key);
    if (!expectedContextId || !row.contextId) continue;
    const expectedForActual = actualToExpectedContexts.get(row.contextId) ?? new Set<string>();
    expectedForActual.add(expectedContextId);
    actualToExpectedContexts.set(row.contextId, expectedForActual);
    const actualForExpected = expectedToActualContexts.get(expectedContextId) ?? new Set<string>();
    actualForExpected.add(row.contextId);
    expectedToActualContexts.set(expectedContextId, actualForExpected);
  }
  const crossScenarioContextIds = sortedUnique(
    [...actualToExpectedContexts.entries()]
      .filter(([, contexts]) => contexts.size > 1)
      .map(([contextId]) => contextId),
  );
  const splitCanonicalContextIds = expectedContextIds.filter(
    (contextId) => (expectedToActualContexts.get(contextId)?.size ?? 0) > 1,
  );

  if (rows.length !== DEEP_A11Y_EXPECTED_ROW_COUNT) {
    errors.push(`actual row count ${rows.length} does not equal canonical ${DEEP_A11Y_EXPECTED_ROW_COUNT}`);
  }
  if (duplicateRowKeys.length > 0) errors.push(`duplicate rowKey: ${duplicateRowKeys.join(", ")}`);
  if (missingRowKeys.length > 0) errors.push(`missing canonical rowKey: ${missingRowKeys.join(", ")}`);
  if (unexpectedRowKeys.length > 0) errors.push(`unknown rowKey: ${unexpectedRowKeys.join(", ")}`);
  if (missingContextAssignments > 0) errors.push(`${missingContextAssignments} row(s) have a missing contextId`);
  if (actualContextIds.length !== DEEP_A11Y_EXPECTED_CONTEXT_COUNT) {
    errors.push(`actual isolated context count ${actualContextIds.length} does not equal canonical ${DEEP_A11Y_EXPECTED_CONTEXT_COUNT}`);
  }
  if (missingContextIds.length > 0) errors.push(`missing canonical context: ${missingContextIds.join(", ")}`);
  if (unexpectedContextIds.length > 0) errors.push(`unknown context: ${unexpectedContextIds.join(", ")}`);
  for (const row of wrongBindings) {
    errors.push(`wrong row-to-context binding for ${row.key}: expected ${contextByRowKey.get(row.key)}, actual ${row.contextId || "<missing>"}`);
  }
  if (crossScenarioContextIds.length > 0) {
    errors.push(`actual context reused across canonical scenarios: ${crossScenarioContextIds.join(", ")}`);
  }
  if (splitCanonicalContextIds.length > 0) {
    errors.push(`canonical sequential scenario split across actual contexts: ${splitCanonicalContextIds.join(", ")}`);
  }

  return {
    expectedContextIds,
    actualContextIds,
    missingContextIds,
    unexpectedContextIds,
    summary: {
      canonicalContexts: expectedContextIds.length,
      actualContexts: actualContextIds.length,
      singleRowContexts: DEEP_ROUTE_CONTEXT_PLAN.filter((entry) => entry.rowKeys.length === 1).length,
      multiRowContexts: DEEP_ROUTE_CONTEXT_PLAN.filter((entry) => entry.rowKeys.length > 1).length,
      rows: rows.length,
      duplicateRows: actualRowKeys.length - actualRowKeySet.size,
      missingRows: missingRowKeys.length,
      unknownRows: unexpectedRowKeys.length,
      missingContextAssignments,
      missingCanonicalContexts: missingContextIds.length,
      unknownContexts: unexpectedContextIds.length,
      wrongBindings: wrongBindings.length,
      crossScenarioReuse: crossScenarioContextIds.length,
      splitCanonicalContexts: splitCanonicalContextIds.length,
    },
    errors,
  };
}

export function buildDeepRouteEvidenceReport(
  rows: readonly DeepRouteEvidenceRow[],
  sourceTreeSha256: string,
  generatedAtUtc = new Date().toISOString(),
  manifest: MachineReviewManifest = MACHINE_REVIEW_MANIFEST,
): DeepRouteEvidenceReport {
  const plan = createDeepRouteA11yCoveragePlan(manifest);
  const expectedRowKeys = plan.map((row) => row.key).sort();
  const actualRowKeys = rows.map((row) => row.key).sort();
  const expectedSet = new Set(expectedRowKeys);
  const actualSet = new Set(actualRowKeys);
  const missingRowKeys = expectedRowKeys.filter((key) => !actualSet.has(key));
  const unexpectedRowKeys = actualRowKeys.filter((key) => !expectedSet.has(key));
  const expectedRouteStates = sortedUnique(plan.map((row) => deepA11yRouteStateKey(row.routeId, row.state)));
  const actualRouteStates = sortedUnique(rows.map((row) => deepA11yRouteStateKey(row.routeId, row.state)));
  const expectedViewportIds = sortedUnique(DEEP_A11Y_VIEWPORTS.map((viewport) => viewport.id)) as DeepA11yViewportId[];
  const actualViewportIds = sortedUnique(rows.map((row) => row.viewportId)) as DeepA11yViewportId[];
  const contextContract = validateDeepRouteContextContract(rows);
  const duplicateActual = actualRowKeys.length !== actualSet.size;
  const status = sourceTreeSha256.length === 64
    && !duplicateActual
    && missingRowKeys.length === 0
    && unexpectedRowKeys.length === 0
    && JSON.stringify(expectedRouteStates) === JSON.stringify(actualRouteStates)
    && JSON.stringify(expectedViewportIds) === JSON.stringify(actualViewportIds)
    && contextContract.errors.length === 0
    && rows.every((row) => row.sourceTreeSha256 === sourceTreeSha256 && row.status === "PASS" && rowPassesHardEvidence(row, manifest))
    ? "PASS"
    : "FAIL";

  return {
    schemaVersion: 1,
    evidenceKind: "CANONICAL_DEEP_ROUTE_ACCESSIBILITY",
    sourceTreeSha: sourceTreeSha256,
    sourceTreeSha256,
    generatedAtUtc,
    isolatedBrowserContexts: true,
    syntheticStorageOnly: true,
    networkPolicy: { sameOrigin: "SAME_ORIGIN_ALLOWED", external: "EXTERNAL_NETWORK_FORBIDDEN" },
    matrixPolicy: "Manifest states are each exercised once at an explicitly assigned viewport; this is a bounded state matrix, not a claimed full state-by-viewport cross-product.",
    coverage: {
      expectedRowKeys,
      actualRowKeys,
      missingRowKeys,
      unexpectedRowKeys,
      expectedRouteStates,
      actualRouteStates,
      expectedViewportIds,
      actualViewportIds,
      expectedContextIds: contextContract.expectedContextIds,
      actualContextIds: contextContract.actualContextIds,
      missingContextIds: contextContract.missingContextIds,
      unexpectedContextIds: contextContract.unexpectedContextIds,
    },
    contextSummary: contextContract.summary,
    status,
    evidenceFiles: sortedUnique(rows.flatMap((row) => [row.screenshot, row.aria, row.eventTrace])),
    rows: [...rows].sort((left, right) => left.key.localeCompare(right.key)),
    machineOnlyConclusion: "This is isolated synthetic browser evidence. It does not prove child fun, learning, retention, preference, or real second-use behavior.",
  };
}

export function validateDeepRouteEvidenceReport(
  report: DeepRouteEvidenceReport,
  workspaceRoot = process.cwd(),
  manifest: MachineReviewManifest = MACHINE_REVIEW_MANIFEST,
): readonly string[] {
  const errors: string[] = [];
  if (!/^[a-f\d]{64}$/i.test(report.sourceTreeSha256) || report.sourceTreeSha !== report.sourceTreeSha256) {
    errors.push("sourceTreeSha/sourceTreeSha256 must be the same SHA-256 identity");
  }
  const rebuilt = buildDeepRouteEvidenceReport(report.rows, report.sourceTreeSha256, report.generatedAtUtc, manifest);
  if (JSON.stringify(report.coverage) !== JSON.stringify(rebuilt.coverage)) errors.push("coverage sets do not match the canonical manifest plan");
  if (JSON.stringify(report.contextSummary) !== JSON.stringify(rebuilt.contextSummary)) errors.push("context summary does not match canonical row-to-context validation");
  if (report.status !== rebuilt.status) errors.push(`declared status ${report.status} does not match computed ${rebuilt.status}`);
  if (report.status !== "PASS") errors.push("deep route/accessibility report is not PASS");
  if (JSON.stringify(report.evidenceFiles) !== JSON.stringify(rebuilt.evidenceFiles)) errors.push("evidenceFiles do not exactly match row evidence");
  errors.push(...validateDeepRouteContextContract(report.rows).errors);
  const plan = new Map(createDeepRouteA11yCoveragePlan(manifest).map((row) => [row.key, row]));
  for (const [index, row] of report.rows.entries()) {
    const expected = plan.get(row.key);
    if (!expected || (["coverageKind", "routeId", "routeKind", "route", "state", "viewportId", "pageClass"] as const)
      .some((field) => row[field] !== expected[field])) errors.push(`row ${index} does not match its canonical plan entry`);
    if (row.sourceTreeSha256 !== report.sourceTreeSha256 || !row.actualUrl.startsWith("http://127.0.0.1:5175/")) errors.push(`row ${index} has stale source or invalid URL`);
    if (!row.actualVisualState || row.actionTrace.length === 0) errors.push(`row ${index} lacks visual-state or action trace evidence`);
    if (row.diagnostics.networkClassification.sameOrigin !== "SAME_ORIGIN_ALLOWED"
      || row.diagnostics.networkClassification.external !== "EXTERNAL_NETWORK_FORBIDDEN") errors.push(`row ${index} network classification drifted`);
  }
  const outputRoot = resolve(workspaceRoot, "artifacts/game-machine-review/step-07");
  for (const path of report.evidenceFiles) {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
    const outputRelative = relative(outputRoot, absolute);
    if (outputRelative === ".." || outputRelative.startsWith("..\\") || outputRelative.startsWith("../") || isAbsolute(outputRelative)) {
      errors.push(`evidence file escapes STEP 07 output: ${path}`);
    } else if (!existsSync(absolute) || !statSync(absolute).isFile() || statSync(absolute).size === 0) {
      errors.push(`missing or empty evidence file: ${path}`);
    }
  }
  return errors;
}

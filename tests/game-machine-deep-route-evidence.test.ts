import { describe, expect, it } from "vitest";
import {
  DEEP_A11Y_EXPECTED_CONTEXT_COUNT,
  DEEP_A11Y_EXPECTED_ROW_COUNT,
  DEEP_A11Y_VIEWPORTS,
  DEEP_ROUTE_CONTEXT_PLAN,
  buildDeepRouteEvidenceReport,
  canonicalDeepA11yContextId,
  createDeepRouteA11yCoveragePlan,
  deepA11yRouteStateKey,
  validateDeepRouteContextContract,
  type DeepRouteEvidenceRow,
} from "../tools/game-machine-review/deep-route-evidence";
import { MACHINE_REVIEW_MANIFEST } from "../tools/game-machine-review/machine-review-manifest";

function passingRow(
  planRow: ReturnType<typeof createDeepRouteA11yCoveragePlan>[number],
  sourceTreeSha256: string,
): DeepRouteEvidenceRow {
  return {
    ...planRow,
    sourceTreeSha256,
    contextId: canonicalDeepA11yContextId(planRow.key),
    isolatedBrowserContext: true,
    syntheticStorage: true,
    storageFixture: "SYNTHETIC_TOOLING_TEST_ONLY",
    actualUrl: `http://127.0.0.1:5175/${planRow.route}`,
    actualVisualState: planRow.state,
    screenshot: `artifacts/${planRow.key}.png`,
    aria: `artifacts/${planRow.key}.aria.txt`,
    eventTrace: `artifacts/${planRow.key}.events.json`,
    diagnostics: {
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      sameOriginRequests: ["http://127.0.0.1:5175/"],
      externalRequests: [],
      networkClassification: { sameOrigin: "SAME_ORIGIN_ALLOWED", external: "EXTERNAL_NETWORK_FORBIDDEN" },
    },
    accessibility: {
      mainLandmarkCount: 1,
      nestedMainLandmarks: [],
      levelOneHeadingCount: 1,
      duplicateIds: [],
      horizontalOverflowPx: 0,
      horizontalOverflowElements: [],
      visibleDialogCount: 0,
      unnamedVisibleDialogs: [],
      unlabeledFormControls: [],
      targetRule: planRow.pageClass === "adult" ? "ADULT_INTERACTIVE_24" : "CHILD_PRIMARY_44",
      undersizedTargets: [],
      focusTarget: "button",
      focusVisible: true,
      focusUnobscured: true,
      dragOrTouchAlternative: "NOT_APPLICABLE",
    },
    ...(planRow.routeId === "classic-hub"
      ? { catalogGameIds: MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId) }
      : {}),
    actionTrace: ["route-loaded", "accessibility-audited"],
    status: "PASS",
  };
}

describe("STEP 07 canonical deep-route accessibility evidence", () => {
  it("covers every manifest deep state and gives adult routes both narrow viewports", () => {
    const plan = createDeepRouteA11yCoveragePlan();
    const plannedRouteStates = new Set(plan.map((row) => deepA11yRouteStateKey(row.routeId, row.state)));
    const expectedRouteStates = new Set([
      ...MACHINE_REVIEW_MANIFEST.deepRoutes.flatMap((route) => route.states.map((state) => deepA11yRouteStateKey(route.id, state))),
      ...MACHINE_REVIEW_MANIFEST.adultToolRoutes.map((route) => deepA11yRouteStateKey(route.id, "default")),
    ]);

    expect(plannedRouteStates).toEqual(expectedRouteStates);
    expect(plan).toHaveLength(DEEP_A11Y_EXPECTED_ROW_COUNT);
    expect(DEEP_ROUTE_CONTEXT_PLAN).toHaveLength(DEEP_A11Y_EXPECTED_CONTEXT_COUNT);
    expect(plan.map((row) => row.key)).toEqual(DEEP_ROUTE_CONTEXT_PLAN.flatMap((entry) => entry.rowKeys));
    expect(new Set(plan.map((row) => row.key)).size).toBe(plan.length);
    expect(new Set(plan.map((row) => row.viewportId))).toEqual(new Set(DEEP_A11Y_VIEWPORTS.map((viewport) => viewport.id)));
    for (const route of MACHINE_REVIEW_MANIFEST.adultToolRoutes) {
      expect(plan.filter((row) => row.routeId === route.id).map((row) => row.viewportId).sort()).toEqual(["compact-mobile", "mobile"]);
    }
    for (const [routeId, state] of [["my-game-world", "fresh"], ["hanzi-golden-slice", "camp"], ["classic-hub", "catalog"]] as const) {
      const narrow = plan
        .filter((row) => row.routeId === routeId && row.state === state && ["compact-mobile", "mobile"].includes(row.viewportId))
        .map((row) => row.viewportId)
        .sort();
      expect(narrow).toEqual(["compact-mobile", "mobile"]);
    }
  });

  it("only reports PASS for an exact, source-bound complete matrix", () => {
    const sourceTreeSha256 = "a".repeat(64);
    const plan = createDeepRouteA11yCoveragePlan();
    const report = buildDeepRouteEvidenceReport(plan.map((row) => passingRow(row, sourceTreeSha256)), sourceTreeSha256);
    expect(report.status).toBe("PASS");
    expect(report.sourceTreeSha).toBe(sourceTreeSha256);
    expect(report.coverage.missingRowKeys).toEqual([]);
    expect(report.coverage.unexpectedRowKeys).toEqual([]);
    expect(report.contextSummary).toEqual(expect.objectContaining({
      canonicalContexts: 22,
      actualContexts: 22,
      singleRowContexts: 16,
      multiRowContexts: 6,
      rows: 40,
      crossScenarioReuse: 0,
      missingRows: 0,
      unknownRows: 0,
      wrongBindings: 0,
      splitCanonicalContexts: 0,
    }));

    const incomplete = buildDeepRouteEvidenceReport(report.rows.slice(1), sourceTreeSha256);
    expect(incomplete.status).toBe("FAIL");
    expect(incomplete.coverage.missingRowKeys).toEqual([report.rows[0].key]);
  });

  it("fails when a hard accessibility or network row is not clean", () => {
    const sourceTreeSha256 = "b".repeat(64);
    const plan = createDeepRouteA11yCoveragePlan();
    const rows = plan.map((row) => passingRow(row, sourceTreeSha256));
    const first = rows[0];
    rows[0] = {
      ...first,
      diagnostics: { ...first.diagnostics, externalRequests: ["https://example.invalid/tracker"] },
    };
    expect(buildDeepRouteEvidenceReport(rows, sourceTreeSha256).status).toBe("FAIL");
  });

  it("fails closed for missing, nested, or duplicate primary document landmarks", () => {
    const sourceTreeSha256 = "2".repeat(64);
    const plan = createDeepRouteA11yCoveragePlan();

    for (const accessibility of [
      { mainLandmarkCount: 0 },
      { mainLandmarkCount: 2 },
      { nestedMainLandmarks: ["main:catalog:100x100"] },
      { levelOneHeadingCount: 0 },
      { levelOneHeadingCount: 2 },
    ] as const) {
      const rows = plan.map((row) => passingRow(row, sourceTreeSha256));
      rows[0] = {
        ...rows[0],
        accessibility: { ...rows[0].accessibility, ...accessibility },
      };
      expect(buildDeepRouteEvidenceReport(rows, sourceTreeSha256).status).toBe("FAIL");
    }

    const staleRows = plan.map((row) => passingRow(row, sourceTreeSha256));
    const { mainLandmarkCount, ...staleAccessibility } = staleRows[0].accessibility;
    expect(mainLandmarkCount).toBe(1);
    staleRows[0] = {
      ...staleRows[0],
      accessibility: staleAccessibility as DeepRouteEvidenceRow["accessibility"],
    };
    expect(buildDeepRouteEvidenceReport(staleRows, sourceTreeSha256).status).toBe("FAIL");
  });

  it("accepts canonical single-row contexts and multi-row sequential reuse", () => {
    const sourceTreeSha256 = "c".repeat(64);
    const rows = createDeepRouteA11yCoveragePlan().map((row) => passingRow(row, sourceTreeSha256));
    const validation = validateDeepRouteContextContract(rows);
    expect(validation.errors).toEqual([]);

    const singleton = DEEP_ROUTE_CONTEXT_PLAN.find((entry) => entry.contextId === "golden-mobile-corrupt");
    expect(singleton?.rowKeys).toEqual(["hanzi-golden-slice::corrupt-save-recovery::mobile"]);
    expect(rows.find((row) => row.key === singleton?.rowKeys[0])?.contextId).toBe(singleton?.contextId);

    for (const entry of DEEP_ROUTE_CONTEXT_PLAN.filter((candidate) => candidate.rowKeys.length > 1)) {
      expect(new Set(entry.rowKeys.map((key) => rows.find((row) => row.key === key)?.contextId))).toEqual(new Set([entry.contextId]));
    }
  });

  it("rejects duplicate, missing, and unknown row keys", () => {
    const sourceTreeSha256 = "d".repeat(64);
    const rows = createDeepRouteA11yCoveragePlan().map((row) => passingRow(row, sourceTreeSha256));

    const duplicate = validateDeepRouteContextContract([...rows, rows[0]]);
    expect(duplicate.errors.join("\n")).toMatch(/actual row count 41/);
    expect(duplicate.errors.join("\n")).toMatch(/duplicate rowKey/);

    const missing = validateDeepRouteContextContract(rows.slice(1));
    expect(missing.errors.join("\n")).toMatch(/actual row count 39/);
    expect(missing.errors.join("\n")).toMatch(/missing canonical rowKey/);

    const unknownRows = [...rows];
    unknownRows[0] = { ...unknownRows[0], key: "unknown-route::unknown-state::mobile" };
    const unknown = validateDeepRouteContextContract(unknownRows);
    expect(unknown.errors.join("\n")).toMatch(/unknown rowKey/);
    expect(buildDeepRouteEvidenceReport(unknownRows, sourceTreeSha256).status).toBe("FAIL");
  });

  it("rejects wrong bindings and cross-scenario context contamination", () => {
    const sourceTreeSha256 = "e".repeat(64);
    const rows = createDeepRouteA11yCoveragePlan().map((row) => passingRow(row, sourceTreeSha256));
    const target = rows.findIndex((row) => row.key === "my-game-world::settings::compact-mobile");
    rows[target] = { ...rows[target], contextId: "world-mobile-repaired" };

    const validation = validateDeepRouteContextContract(rows);
    expect(validation.errors.join("\n")).toMatch(/wrong row-to-context binding/);
    expect(validation.errors.join("\n")).toMatch(/actual context reused across canonical scenarios/);
    expect(validation.summary.wrongBindings).toBe(1);
    expect(validation.summary.crossScenarioReuse).toBe(1);
    expect(buildDeepRouteEvidenceReport(rows, sourceTreeSha256).status).toBe("FAIL");
  });

  it("rejects accidental splitting, missing contexts, unknown contexts, and missing assignments", () => {
    const sourceTreeSha256 = "f".repeat(64);
    const baseRows = createDeepRouteA11yCoveragePlan().map((row) => passingRow(row, sourceTreeSha256));

    const splitRows = [...baseRows];
    const splitTarget = splitRows.findIndex((row) => row.key === "my-game-world::settings::compact-mobile");
    splitRows[splitTarget] = { ...splitRows[splitTarget], contextId: "unexpected-split-context" };
    const split = validateDeepRouteContextContract(splitRows);
    expect(split.errors.join("\n")).toMatch(/canonical sequential scenario split/);
    expect(split.summary.splitCanonicalContexts).toBe(1);

    const missingRows = [...baseRows];
    const singletonTarget = missingRows.findIndex((row) => row.key === "hanzi-golden-slice::corrupt-save-recovery::mobile");
    missingRows[singletonTarget] = { ...missingRows[singletonTarget], contextId: "classic-catalog-desktop" };
    const missing = validateDeepRouteContextContract(missingRows);
    expect(missing.errors.join("\n")).toMatch(/missing canonical context: golden-mobile-corrupt/);

    const unknownRows = [...baseRows];
    unknownRows[singletonTarget] = { ...unknownRows[singletonTarget], contextId: "unknown-isolation-context" };
    const unknown = validateDeepRouteContextContract(unknownRows);
    expect(unknown.errors.join("\n")).toMatch(/unknown context: unknown-isolation-context/);

    const unassignedRows = [...baseRows];
    unassignedRows[singletonTarget] = { ...unassignedRows[singletonTarget], contextId: "" };
    expect(validateDeepRouteContextContract(unassignedRows).errors.join("\n")).toMatch(/missing contextId/);
  });

  it("locks every known multi-row regression group to correct reuse and rejects a rebound row", () => {
    const sourceTreeSha256 = "1".repeat(64);
    const rows = createDeepRouteA11yCoveragePlan().map((row) => passingRow(row, sourceTreeSha256));
    const multiRowContextIds = [
      "world-compact-mobile",
      "world-mobile-repaired",
      "golden-tablet-early",
      "golden-desktop-late",
      "critical-compact-mobile",
      "critical-mobile",
    ];

    expect(validateDeepRouteContextContract(rows).errors).toEqual([]);
    for (const [index, contextId] of multiRowContextIds.entries()) {
      const contract = DEEP_ROUTE_CONTEXT_PLAN.find((entry) => entry.contextId === contextId);
      expect(contract?.rowKeys.length).toBeGreaterThan(1);
      expect(new Set(contract?.rowKeys.map((key) => rows.find((row) => row.key === key)?.contextId))).toEqual(new Set([contextId]));

      const reboundRows = [...rows];
      const reboundKey = contract?.rowKeys.at(-1);
      const reboundIndex = reboundRows.findIndex((row) => row.key === reboundKey);
      reboundRows[reboundIndex] = {
        ...reboundRows[reboundIndex],
        contextId: multiRowContextIds[(index + 1) % multiRowContextIds.length],
      };
      expect(validateDeepRouteContextContract(reboundRows).errors.join("\n")).toMatch(/wrong row-to-context binding/);
    }
  });
});

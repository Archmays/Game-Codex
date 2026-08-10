import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertStrictAgentProfileCoverage,
  assertStrictCatalogSmokeCoverage,
  assertStrictScrollMatrixCoverage,
} from "../tools/game-machine-review/evidence-validators";
import {
  MACHINE_AGENT_PROFILE_IDS,
  MACHINE_AGENT_PROFILE_PROJECTS,
  createMachineReviewManifest,
} from "../tools/game-machine-review/machine-review-manifest";
import { computeMachineReviewSourceTreeSha256 } from "../tools/game-machine-review/source-identity";

const PNGS = [
  "artifacts/game-machine-review/step-07/evidence/top.png",
  "artifacts/game-machine-review/step-07/evidence/bottom.png",
  "artifacts/game-machine-review/step-07/evidence/final.png",
  "artifacts/game-machine-review/step-07/evidence/full.png",
] as const;
const TRACE = "artifacts/game-machine-review/step-07/evidence/trace.zip";
const roots: string[] = [];

function scrollTracePath(routeKind: string, project: string, viewport: string): string {
  const safe = (value: string) => value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `artifacts/game-machine-review/step-07/evidence/scroll-${safe(routeKind)}-${safe(project)}-${safe(viewport)}.zip`;
}

function evidenceRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "machine-evidence-coverage-"));
  roots.push(root);
  mkdirSync(resolve(root, "artifacts/game-machine-review/step-07/evidence"), { recursive: true });
  for (const path of [...PNGS, TRACE]) writeFileSync(resolve(root, path), `nonempty ${path}\n`, "utf8");
  const manifest = createMachineReviewManifest();
  for (const route of manifest.adultToolRoutes) {
    for (const viewport of manifest.adultScrollViewports) {
      const path = scrollTracePath(route.routeKind, viewport.project, viewport.viewport);
      writeFileSync(resolve(root, path), `nonempty ${path}\n`, "utf8");
    }
  }
  return root;
}

function completeScrollMatrix(): Record<string, unknown> {
  const manifest = createMachineReviewManifest();
  const rows = manifest.adultToolRoutes.flatMap((route) => manifest.adultScrollViewports.map((viewport) => {
    const trace = scrollTracePath(route.routeKind, viewport.project, viewport.viewport);
    return {
      routeKind: route.routeKind,
      project: viewport.project,
      viewport: viewport.viewport,
      status: "PASS",
      pageMode: "adult-tool",
      scrollOwner: "document.documentElement",
      horizontalOverflowPx: 0,
      nestedVerticalScrollOwners: [],
      inputs: viewport.requiredInputs.map((input) => ({ input, before: 0, after: input === "Home" ? 0 : 100, passed: true })),
      finalAction: { visible: true, enabled: true, focused: true, unobscured: true, clicked: true, activationEvidence: "download:fixture.json" },
      network: { externalRequests: [] },
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      trace,
      screenshots: PNGS,
      fullPageScreenshot: PNGS[3],
    };
  }));
  return {
    evidenceComplete: true,
    missingOrStaleProjects: [],
    evidenceFiles: rows.map((row) => row.trace),
    summary: { total: rows.length, passed: rows.length, failed: 0 },
    rows,
  };
}

function completeCatalogSmoke(): Record<string, unknown> {
  const manifest = createMachineReviewManifest();
  const projects = ["desktop-chromium", "mobile-touch-chromium"] as const;
  const results = projects.flatMap((project) => manifest.catalogSmokeRoutes.map((game) => ({
    project,
    catalogGameId: game.catalogGameId,
    title: game.title,
    status: "PASS",
    returnedToCatalog: true,
    isolatedBrowserContext: true,
    firstAction: game.playLabel,
    postconditionEvidence: "A visible game state changed after the input.",
    screenshot: PNGS[0],
    trace: TRACE,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: [],
  })));
  return {
    expectedCatalogGameIds: manifest.catalogSmokeRoutes.map((game) => game.catalogGameId),
    expectedProjects: projects,
    isolatedContexts: true,
    expectedResultCount: results.length,
    resultCount: results.length,
    passed: results.length,
    failed: 0,
    results,
  };
}

function completeAgentProfiles(): Record<string, unknown> {
  const results = MACHINE_AGENT_PROFILE_IDS.map((profile) => ({
    profile,
    project: MACHINE_AGENT_PROFILE_PROJECTS[profile],
    fixtureMarker: "SYNTHETIC_TOOLING_TEST_ONLY",
    isolatedBrowserContext: true,
    status: "PASS",
    completed: true,
    actualInteractions: ["Used the assigned public control."],
    completionEvidence: ["Reached the deterministic profile end state."],
    screenshot: PNGS[0],
    trace: TRACE,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: [],
  }));
  return {
    expectedProfiles: MACHINE_AGENT_PROFILE_IDS,
    expectedProjects: MACHINE_AGENT_PROFILE_PROJECTS,
    isolatedBrowserContexts: true,
    fixtureMarker: "SYNTHETIC_TOOLING_TEST_ONLY",
    profileCount: results.length,
    passed: results.length,
    failed: 0,
    allExpectedProfilesRecorded: true,
    results,
  };
}

describe("machine evidence canonical coverage and source identity", () => {
  it("accepts only the complete canonical scroll, catalog, and six-profile inventories", () => {
    const root = evidenceRoot();
    expect(() => assertStrictScrollMatrixCoverage(completeScrollMatrix(), process.cwd(), root)).not.toThrow();
    expect(() => assertStrictCatalogSmokeCoverage(completeCatalogSmoke(), process.cwd(), root)).not.toThrow();
    expect(() => assertStrictAgentProfileCoverage(completeAgentProfiles(), root)).not.toThrow();
    expect(computeMachineReviewSourceTreeSha256()).toMatch(/^[A-F0-9]{64}$/);
  });

  it("rejects same-tree PASS scroll evidence with one row or duplicate coverage", () => {
    const root = evidenceRoot();
    const oneRow = completeScrollMatrix();
    oneRow.rows = (oneRow.rows as unknown[]).slice(0, 1);
    oneRow.summary = { total: 1, passed: 1, failed: 0 };
    expect(() => assertStrictScrollMatrixCoverage(oneRow, process.cwd(), root)).toThrow(/incomplete|coverage/i);

    const duplicate = completeScrollMatrix();
    const rows = duplicate.rows as unknown[];
    rows[1] = structuredClone(rows[0]);
    expect(() => assertStrictScrollMatrixCoverage(duplicate, process.cwd(), root)).toThrow(/duplicate|incomplete/i);
  });

  it("rejects self-declared one-game and one-profile PASS artifacts", () => {
    const root = evidenceRoot();
    const catalog = completeCatalogSmoke();
    catalog.results = (catalog.results as unknown[]).slice(0, 1);
    catalog.expectedResultCount = 1;
    catalog.resultCount = 1;
    catalog.passed = 1;
    expect(() => assertStrictCatalogSmokeCoverage(catalog, process.cwd(), root)).toThrow(/canonical|totals|coverage/i);

    const profiles = completeAgentProfiles();
    const first = (profiles.results as unknown[]).slice(0, 1);
    profiles.results = first;
    profiles.expectedProfiles = [MACHINE_AGENT_PROFILE_IDS[0]];
    profiles.profileCount = 1;
    profiles.passed = 1;
    expect(() => assertStrictAgentProfileCoverage(profiles, root)).toThrow(/canonical|six profiles|coverage/i);
  });

  it("rejects no-op catalog actions and missing trace evidence", () => {
    const root = evidenceRoot();
    const catalog = completeCatalogSmoke();
    (catalog.results as Record<string, unknown>[])[0].postconditionEvidence = "";
    expect(() => assertStrictCatalogSmokeCoverage(catalog, process.cwd(), root)).toThrow(/postconditionEvidence/);

    const profiles = completeAgentProfiles();
    (profiles.results as Record<string, unknown>[])[0].trace = "";
    expect(() => assertStrictAgentProfileCoverage(profiles, root)).toThrow(/trace/);
  });

  it("rejects one screenshot repeated as top, bottom, final-action, and full-page proof", () => {
    const root = evidenceRoot();
    const scroll = completeScrollMatrix();
    const first = (scroll.rows as Record<string, unknown>[])[0];
    first.screenshots = [PNGS[0], PNGS[0], PNGS[0], PNGS[0]];
    first.fullPageScreenshot = PNGS[0];
    expect(() => assertStrictScrollMatrixCoverage(scroll, process.cwd(), root)).toThrow(/top, bottom, final-action, and full-page/i);
  });

  it("rejects a disabled or unproven final action", () => {
    const root = evidenceRoot();
    const disabled = completeScrollMatrix();
    ((disabled.rows as any[])[0].finalAction).enabled = false;
    expect(() => assertStrictScrollMatrixCoverage(disabled, process.cwd(), root)).toThrow(/final action/i);

    const noActivation = completeScrollMatrix();
    ((noActivation.rows as any[])[0].finalAction).activationEvidence = "";
    expect(() => assertStrictScrollMatrixCoverage(noActivation, process.cwd(), root)).toThrow(/final action/i);
  });

  it("rejects missing, duplicate, unlisted, or out-of-output isolated row traces", () => {
    const root = evidenceRoot();

    const missing = completeScrollMatrix();
    (missing.rows as Record<string, unknown>[])[0].trace = "artifacts/game-machine-review/step-07/evidence/missing.zip";
    expect(() => assertStrictScrollMatrixCoverage(missing, process.cwd(), root)).toThrow(/missing or empty/i);

    const duplicate = completeScrollMatrix();
    const duplicateRows = duplicate.rows as Record<string, unknown>[];
    duplicateRows[1].trace = duplicateRows[0].trace;
    expect(() => assertStrictScrollMatrixCoverage(duplicate, process.cwd(), root)).toThrow(/duplicates another isolated row trace/i);

    const unlisted = completeScrollMatrix();
    const unlistedTrace = (unlisted.rows as Record<string, unknown>[])[0].trace;
    unlisted.evidenceFiles = (unlisted.evidenceFiles as unknown[]).filter((path) => path !== unlistedTrace);
    expect(() => assertStrictScrollMatrixCoverage(unlisted, process.cwd(), root)).toThrow(/not bound.*evidenceFiles/i);

    const outsideOutput = completeScrollMatrix();
    const outsideTrace = resolve(root, "outside-step07-trace.zip");
    writeFileSync(outsideTrace, "nonempty trace\n", "utf8");
    (outsideOutput.rows as Record<string, unknown>[])[0].trace = outsideTrace;
    outsideOutput.evidenceFiles = [...(outsideOutput.evidenceFiles as unknown[]), outsideTrace];
    expect(() => assertStrictScrollMatrixCoverage(outsideOutput, process.cwd(), root)).toThrow(/escapes/i);
  });

  it("rejects row evidence outside the canonical STEP 07 output, including another Windows drive", () => {
    const externalRoot = evidenceRoot();
    const catalog = completeCatalogSmoke();
    (catalog.results as Record<string, unknown>[])[0].screenshot = resolve(externalRoot, PNGS[0]);
    expect(() => assertStrictCatalogSmokeCoverage(catalog, process.cwd(), process.cwd())).toThrow(/escapes|output/i);
  });
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

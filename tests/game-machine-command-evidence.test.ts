import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  COMMAND_RUN_GATE_IDS,
  DEFAULT_MACHINE_REVIEW_OUTPUT,
  FIXED_COMMAND_DEFINITIONS,
  ORDINARY_COMMAND_GATE_IDS,
  commandLogPath,
  commandRecordPath,
  createBaselineEstablishmentRecord,
  createBaselinePromotionRecord,
  createVisualAriaCandidateRecord,
  deriveCommandGateResultsDocument,
  validateBaselinePromotionRecord,
  validateCommandGateResultsForFinalizer,
  validateCommandRunRecord,
  validatePreChangeReference,
  type CommandRunEvidenceRecord,
  type CommandRunGateId,
} from "../tools/game-machine-review/command-evidence";
import { promoteVisualBaseline } from "../tools/game-machine-review/promote-visual-baseline";
import { prepareVisualNoUpdatePreflight, runCommandEvidence } from "../tools/game-machine-review/run-command-evidence";
import {
  MACHINE_AGENT_PROFILE_IDS,
  MACHINE_AGENT_PROFILE_PROJECTS,
  createMachineReviewManifest,
} from "../tools/game-machine-review/machine-review-manifest";
import { SEMANTIC_REVIEWER_IDS } from "../tools/game-machine-review/semantic-review-schema";
import {
  buildDeepRouteEvidenceReport,
  canonicalDeepA11yContextId,
  createDeepRouteA11yCoveragePlan,
  type DeepRouteEvidenceRow,
} from "../tools/game-machine-review/deep-route-evidence";
import { computeMachineReviewSourceTreeSha256 } from "../tools/game-machine-review/source-identity";

const roots: string[] = [];
const SOURCE_SHA256 = "A".repeat(64);
const OLD_SOURCE_SHA256 = "B".repeat(64);
let runSequence = 0;

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "game-command-evidence-"));
  roots.push(root);
  return root;
}

function initializeSourceIdentity(root: string): string {
  execFileSync("git", ["init", "--quiet"], { cwd: root, windowsHide: true });
  write(resolve(root, "source.ts"), "export const fixture = true;\n");
  return computeMachineReviewSourceTreeSha256(root);
}

function write(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

function writeJson(path: string, value: unknown): void {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function artifactPath(...segments: string[]): string {
  return [DEFAULT_MACHINE_REVIEW_OUTPUT, ...segments].join("/");
}

const PRE_CHANGE_REFERENCE_FILES = [
  "01-world-fresh.png",
  "02-world-repaired.png",
  "03-world-spellbook.png",
  "04-classic-hub.png",
  "05-forest-boot.png",
  "06-forest-ming-placing.png",
  "07-forest-ability-choice.png",
  "08-forest-boss-lin.png",
  "09-forest-camp-repair.png",
  "10-forest-spellbook.png",
  "PRE-CHANGE-ARIA-REFERENCE.yml",
] as const;

function writePreChangeReference(
  root: string,
  overrides: Readonly<Record<string, unknown>> = {},
): string {
  const directory = resolve(root, artifactPath("pre-change-reference"));
  for (const file of PRE_CHANGE_REFERENCE_FILES) {
    write(resolve(directory, file), file.endsWith(".yml") ? "- heading \"Before\"\n" : `sealed evidence for ${file}`);
  }
  const path = artifactPath("pre-change-reference", "PRE-CHANGE-REFERENCE.json");
  writeJson(resolve(root, path), {
    schemaVersion: 1,
    evidenceStage: "PRE_CHANGE_REFERENCE",
    sourceCommit: "8e00aa61d796578f7e593243caa514da5a307189",
    isolatedBrowserContext: true,
    canonicalTestOrigin: "http://127.0.0.1:5175",
    sameOriginAllowed: true,
    externalNetworkForbidden: true,
    diagnostics: {
      consoleErrors: [],
      pageErrors: [],
      externalRequests: [],
    },
    files: PRE_CHANGE_REFERENCE_FILES,
    limitation: "Reference evidence only; not an accepted STEP 07 visual or ARIA baseline.",
    ...overrides,
  });
  return path;
}

interface RunFixtureOptions {
  readonly startedAtUtc?: string;
  readonly finishedAtUtc?: string;
  readonly exitCode?: number;
  readonly sourceTreeSha256Before?: string;
  readonly sourceTreeSha256After?: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly status?: "PASS" | "FAIL";
}

function writeRunRecord(root: string, gateId: CommandRunGateId, options: RunFixtureOptions = {}): { record: CommandRunEvidenceRecord; path: string } {
  runSequence += 1;
  const definition = FIXED_COMMAND_DEFINITIONS[gateId];
  const startedAtUtc = options.startedAtUtc ?? "2026-08-10T00:00:00.000Z";
  const finishedAtUtc = options.finishedAtUtc ?? "2026-08-10T00:00:01.000Z";
  const compact = startedAtUtc.replace(/[-:.]/g, "");
  const runId = `${gateId}-${compact}-${runSequence}-${runSequence.toString(16).padStart(8, "0")}`;
  const exitCode = options.exitCode ?? 0;
  const before = options.sourceTreeSha256Before ?? SOURCE_SHA256;
  const after = options.sourceTreeSha256After ?? SOURCE_SHA256;
  const command = options.command ?? definition.command;
  const args = options.args ?? definition.args;
  const logPath = commandLogPath(runId, { workspaceRoot: root, outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT });
  const log = `${JSON.stringify({
    schemaVersion: 1,
    logType: "ACTUAL_COMMAND_OUTPUT",
    runId,
    gateId,
    command,
    args,
    startedAtUtc,
    sourceTreeSha256Before: before,
    stdout: "synthetic command output\n",
    stderr: "",
    spawnError: "",
    exitCode,
    signal: null,
    sourceTreeSha256After: after,
    finishedAtUtc,
  }, null, 2)}\n`;
  write(resolve(root, logPath), log);
  const derivedStatus = exitCode === 0 && (definition.allowsSourceMutation || before === after) ? "PASS" : "FAIL";
  const record = {
    schemaVersion: 1,
    recordType: "ACTUAL_COMMAND_RUN",
    runId,
    gateId,
    command,
    args,
    startedAtUtc,
    finishedAtUtc,
    exitCode,
    sourceTreeSha256Before: before,
    sourceTreeSha256After: after,
    logSha256: createHash("sha256").update(log, "utf8").digest("hex").toUpperCase(),
    logPath,
    status: options.status ?? derivedStatus,
  } as unknown as CommandRunEvidenceRecord;
  const path = commandRecordPath(runId, { workspaceRoot: root, outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT });
  writeJson(resolve(root, path), record);
  return { record, path };
}

interface PrerequisiteFixtureOptions {
  readonly sourceTreeSha256?: string;
  readonly candidateGeneratedAtUtc?: string;
  readonly reviewCompletedAtUtc?: string;
  readonly deepGeneratedAtUtc?: string;
}

function writePromotionPrerequisites(root: string, options: PrerequisiteFixtureOptions = {}): void {
  const sourceTreeSha256 = options.sourceTreeSha256 ?? SOURCE_SHA256;
  const candidateGeneratedAtUtc = options.candidateGeneratedAtUtc ?? "2026-08-10T00:00:03.500Z";
  const reviewCompletedAtUtc = options.reviewCompletedAtUtc ?? "2026-08-10T00:00:05.000Z";
  const deepGeneratedAtUtc = options.deepGeneratedAtUtc ?? reviewCompletedAtUtc;
  const sharedPng = artifactPath("shared", "review.png");
  const sharedScrollPngs = ["top", "bottom", "final", "full"].map((name) => artifactPath("shared", `scroll-${name}.png`));
  const sharedAria = artifactPath("shared", "review.aria.yml");
  const sharedTrace = artifactPath("shared", "trace.zip");
  write(resolve(root, sharedPng), "png evidence");
  for (const path of sharedScrollPngs) write(resolve(root, path), `png evidence for ${path}`);
  write(resolve(root, sharedAria), "- heading \"Machine review\"\n");
  write(resolve(root, sharedTrace), "trace evidence");
  write(resolve(root, artifactPath("baselines", "desktop-chromium", "visual", "candidate.png")), "candidate snapshot png");
  write(resolve(root, artifactPath("baselines", "desktop-chromium", "aria", "candidate.aria.yml")), "- heading \"Candidate\"\n");

  writePreChangeReference(root);

  writeJson(resolve(root, artifactPath("VISUAL-ARIA-EVIDENCE.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    baselineKind: "STEP07_BASELINE_CANDIDATE",
    generatedAtUtc: candidateGeneratedAtUtc,
    evidenceFiles: [sharedPng, sharedAria],
  });

  for (const reviewer of SEMANTIC_REVIEWER_IDS) {
    writeJson(resolve(root, artifactPath("semantic-reviews", `${reviewer}.json`)), {
      schemaVersion: 1,
      sourceTreeSha256,
      reviewer,
      reviewEngine: "Codex semantic reviewer",
      model: "gpt-5.6",
      reviewMode: "RUBRIC_SEPARATED_SAME_MODEL",
      evidenceFiles: [sharedPng, sharedAria, sharedTrace],
      completedAtUtc: reviewCompletedAtUtc,
      findings: [],
      limitations: ["Machine-only review."],
    });
  }
  writeJson(resolve(root, artifactPath("semantic-reviews", "REVIEW-CONFLICTS.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    unresolvedCriticalReviewerConflict: false,
  });

  const manifest = createMachineReviewManifest();
  const safeTraceSegment = (value: string) => value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const scrollRows = manifest.adultToolRoutes.flatMap((route) => manifest.adultScrollViewports.map((viewport) => {
    const trace = artifactPath(
      "shared",
      "scroll-traces",
      `${safeTraceSegment(route.routeKind)}-${safeTraceSegment(viewport.project)}-${safeTraceSegment(viewport.viewport)}.zip`,
    );
    write(resolve(root, trace), `trace evidence for ${trace}`);
    return {
      routeKind: route.routeKind,
      project: viewport.project,
      viewport: viewport.viewport,
      status: "PASS",
      pageMode: "adult-tool",
      scrollOwner: "document.documentElement",
      horizontalOverflowPx: 0,
      nestedVerticalScrollOwners: [],
      inputs: viewport.requiredInputs.map((input) => ({ input, before: 0, after: input === "Home" ? 0 : 1, passed: true })),
      finalAction: { visible: true, enabled: true, focused: true, unobscured: true, clicked: true, activationEvidence: "download:fixture.json" },
      network: { externalRequests: [] },
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      trace,
      screenshots: sharedScrollPngs,
      fullPageScreenshot: sharedScrollPngs[3],
    };
  }));

  writeJson(resolve(root, artifactPath("SCROLL-MATRIX.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    status: "PASS",
    passed: true,
    evidenceComplete: true,
    missingOrStaleProjects: [],
    evidenceFiles: [sharedPng, ...scrollRows.map((row) => row.trace)],
    summary: { total: scrollRows.length, passed: scrollRows.length, failed: 0, status: "PASS" },
    rows: scrollRows,
  });
  const catalogResults = (["desktop-chromium", "mobile-touch-chromium"] as const).flatMap((project) =>
    manifest.catalogSmokeRoutes.map((game) => ({
      project,
      catalogGameId: game.catalogGameId,
      title: game.title,
      status: "PASS",
      returnedToCatalog: true,
      isolatedBrowserContext: true,
      firstAction: game.playLabel,
      postconditionEvidence: "Public interaction completed.",
      screenshot: sharedPng,
      trace: sharedTrace,
      externalRequests: [],
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
    })),
  );
  writeJson(resolve(root, artifactPath("GAME-CATALOG-MACHINE-SMOKE.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    status: "PASS",
    expectedCatalogGameIds: manifest.catalogSmokeRoutes.map((game) => game.catalogGameId),
    expectedProjects: ["desktop-chromium", "mobile-touch-chromium"],
    isolatedContexts: true,
    expectedResultCount: catalogResults.length,
    resultCount: catalogResults.length,
    passed: catalogResults.length,
    failed: 0,
    evidenceFiles: [sharedPng, sharedTrace],
    results: catalogResults,
  });
  const profileResults = MACHINE_AGENT_PROFILE_IDS.map((profile) => ({
    profile,
    project: MACHINE_AGENT_PROFILE_PROJECTS[profile],
    fixtureMarker: "SYNTHETIC_TOOLING_TEST_ONLY",
    isolatedBrowserContext: true,
    status: "PASS",
    completed: true,
    actualInteractions: ["Public control used."],
    completionEvidence: ["Profile reached its deterministic end state."],
    screenshot: sharedPng,
    trace: sharedTrace,
    externalRequests: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  }));
  writeJson(resolve(root, artifactPath("agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    status: "PASS",
    expectedProfiles: MACHINE_AGENT_PROFILE_IDS,
    expectedProjects: MACHINE_AGENT_PROFILE_PROJECTS,
    isolatedBrowserContexts: true,
    fixtureMarker: "SYNTHETIC_TOOLING_TEST_ONLY",
    profileCount: profileResults.length,
    passed: profileResults.length,
    failed: 0,
    allExpectedProfilesRecorded: true,
    evidenceFiles: [sharedPng, sharedTrace],
    networkPolicy: { externalRequestCount: 0 },
    results: profileResults,
  });

  const deepRows = createDeepRouteA11yCoveragePlan(manifest).map((plan): DeepRouteEvidenceRow => ({
    ...plan,
    sourceTreeSha256,
    contextId: canonicalDeepA11yContextId(plan.key),
    isolatedBrowserContext: true,
    syntheticStorage: true,
    storageFixture: "SYNTHETIC_TOOLING_TEST_ONLY",
    actualUrl: `http://127.0.0.1:5175/${plan.route}`,
    actualVisualState: plan.state,
    screenshot: sharedPng,
    aria: sharedAria,
    eventTrace: sharedTrace,
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
      visibleDialogCount: 0,
      unnamedVisibleDialogs: [],
      unlabeledFormControls: [],
      targetRule: plan.pageClass === "adult" ? "ADULT_INTERACTIVE_24" : "CHILD_PRIMARY_44",
      undersizedTargets: [],
      focusTarget: "button",
      focusVisible: true,
      focusUnobscured: true,
      dragOrTouchAlternative: "PASS",
    },
    ...(plan.routeId === "classic-hub" ? { catalogGameIds: manifest.catalogSmokeRoutes.map((game) => game.catalogGameId) } : {}),
    actionTrace: ["synthetic deterministic route preparation"],
    status: "PASS",
  }));
  writeJson(
    resolve(root, artifactPath("DEEP-ROUTE-EVIDENCE.json")),
    buildDeepRouteEvidenceReport(deepRows, sourceTreeSha256, deepGeneratedAtUtc, manifest),
  );
}

function writeCandidateRecord(
  root: string,
  updateRecordFile: string,
  sourceTreeSha256 = SOURCE_SHA256,
  preservedAtUtc = "2026-08-10T00:00:04.100Z",
): string {
  const options = {
    workspaceRoot: root,
    outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
    sourceTreeSha256,
    inventoryWorkspaceRoot: process.cwd(),
  };
  const candidate = createVisualAriaCandidateRecord({
    ...options,
    visualBaselineUpdateRecordFile: updateRecordFile,
    preservedAtUtc,
  });
  const path = artifactPath("VISUAL-ARIA-CANDIDATE.json");
  writeJson(resolve(root, path), candidate);
  return path;
}

function writeEstablishmentRecord(
  root: string,
  recordFiles: Readonly<Record<CommandRunGateId, string>>,
  sourceTreeSha256 = SOURCE_SHA256,
  establishedAtUtc = "2026-08-10T00:00:06.000Z",
): string {
  const options = {
    workspaceRoot: root,
    outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
    sourceTreeSha256,
    inventoryWorkspaceRoot: process.cwd(),
  };
  const establishment = createBaselineEstablishmentRecord({
    ...options,
    visualBaselineUpdateRecordFile: recordFiles["visual-baseline-update"],
    ordinaryCommandRunRecordFiles: Object.fromEntries(
      ["compile", "targeted-tests", "step-regressions", "full-tests", "build"].map((gateId) => [gateId, recordFiles[gateId as CommandRunGateId]]),
    ) as Record<"compile" | "targeted-tests" | "step-regressions" | "full-tests" | "build", string>,
    establishedAtUtc,
  });
  const path = artifactPath("hard-gates", "BASELINE-ESTABLISHMENT.json");
  writeJson(resolve(root, path), establishment);
  return path;
}

function writeEstablishedVisualAriaIndex(
  root: string,
  generatedAtUtc = "2026-08-10T00:00:07.500Z",
  sourceTreeSha256 = SOURCE_SHA256,
): void {
  writeJson(resolve(root, artifactPath("VISUAL-ARIA-EVIDENCE.json")), {
    schemaVersion: 1,
    sourceTreeSha256,
    baselineKind: "STEP07_ESTABLISHED_BASELINE",
    generatedAtUtc,
    evidenceFiles: [artifactPath("shared", "review.png"), artifactPath("shared", "review.aria.yml")],
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  runSequence = 0;
});

describe("actual command evidence", () => {
  function validateFixturePreChangeReference(root: string, path: string): void {
    validatePreChangeReference(path, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
    });
  }

  it("accepts only the sealed PRE_CHANGE_REFERENCE contract", () => {
    const root = createRoot();
    const path = writePreChangeReference(root);
    expect(() => validateFixturePreChangeReference(root, path)).not.toThrow();
  });

  it.each([
    ["sourceCommit", "0".repeat(40), /sourceCommit/i],
    ["isolatedBrowserContext", false, /isolated browser context/i],
    ["canonicalTestOrigin", "http://localhost:5175", /canonical origin/i],
    ["sameOriginAllowed", false, /SAME_ORIGIN_ALLOWED/i],
    ["externalNetworkForbidden", false, /EXTERNAL_NETWORK_FORBIDDEN/i],
  ] as const)("rejects substituted PRE_CHANGE_REFERENCE metadata: %s", (field, replacement, expectedError) => {
    const root = createRoot();
    const path = writePreChangeReference(root, { [field]: replacement });
    expect(() => validateFixturePreChangeReference(root, path)).toThrow(expectedError);
  });

  it.each(["consoleErrors", "pageErrors", "externalRequests"] as const)(
    "rejects non-empty PRE_CHANGE_REFERENCE diagnostics: %s",
    (diagnostic) => {
      const root = createRoot();
      const path = writePreChangeReference(root, {
        diagnostics: {
          consoleErrors: diagnostic === "consoleErrors" ? ["console failure"] : [],
          pageErrors: diagnostic === "pageErrors" ? ["page failure"] : [],
          externalRequests: diagnostic === "externalRequests" ? ["https://example.invalid/"] : [],
        },
      });
      expect(() => validateFixturePreChangeReference(root, path)).toThrow(new RegExp(diagnostic, "i"));
    },
  );

  it.each([
    ["missing", PRE_CHANGE_REFERENCE_FILES.slice(0, -1)],
    ["extra", [...PRE_CHANGE_REFERENCE_FILES, "extra.png"]],
    ["replacement", ["replacement.png", ...PRE_CHANGE_REFERENCE_FILES.slice(1)]],
  ] as const)("rejects a %s required state entry in PRE_CHANGE_REFERENCE.files", (_mutation, files) => {
    const root = createRoot();
    const path = writePreChangeReference(root, { files });
    expect(() => validateFixturePreChangeReference(root, path)).toThrow(/sealed required state evidence set/i);
  });

  it("rejects missing or unlisted physical PRE_CHANGE_REFERENCE evidence", () => {
    const missingRoot = createRoot();
    const missingPath = writePreChangeReference(missingRoot);
    rmSync(resolve(missingRoot, artifactPath("pre-change-reference", PRE_CHANGE_REFERENCE_FILES[0])));
    expect(() => validateFixturePreChangeReference(missingRoot, missingPath)).toThrow(/evidence is missing/i);

    const extraRoot = createRoot();
    const extraPath = writePreChangeReference(extraRoot);
    write(resolve(extraRoot, artifactPath("pre-change-reference", "unlisted.png")), "unlisted evidence");
    expect(() => validateFixturePreChangeReference(extraRoot, extraPath)).toThrow(/contain exactly the sealed manifest/i);
  });

  it("rejects extra PRE_CHANGE_REFERENCE schema fields", () => {
    const root = createRoot();
    const path = writePreChangeReference(root, { acceptedBaseline: true });
    expect(() => validateFixturePreChangeReference(root, path)).toThrow(/exact schema fields/i);
  });

  it("rejects a handwritten proof.txt presented as seven PASS gates", () => {
    const root = createRoot();
    const proof = artifactPath("hard-gates", "proof.txt");
    write(resolve(root, proof), "PASS\n");
    const fake = {
      schemaVersion: 1,
      sourceTreeSha256: SOURCE_SHA256,
      results: ["compile", "targeted-tests", "step-regressions", "full-tests", "build", "visual-regression", "aria-snapshots"]
        .map((id) => ({ id, status: "PASS", evidenceFiles: [proof], detail: `${id} passed` })),
    };
    expect(() => validateCommandGateResultsForFinalizer(fake, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
    })).toThrow(/exact schema fields|derivation/i);
  });

  it("rejects a record whose command or args do not match the fixed allowlist", () => {
    const root = createRoot();
    const fixture = writeRunRecord(root, "compile", { command: "node" });
    expect(() => validateCommandRunRecord(fixture.record, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
      requirePassing: true,
    })).toThrow(/fixed command and args/i);
  });

  it("rejects a non-zero exit even when the record is otherwise internally consistent", () => {
    const root = createRoot();
    const fixture = writeRunRecord(root, "compile", { exitCode: 1, status: "FAIL" });
    expect(() => validateCommandRunRecord(fixture.record, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
      requirePassing: true,
    })).toThrow(/did not exit 0/i);
  });

  it("rejects source-tree mutation for every ordinary command gate", () => {
    const root = createRoot();
    const fixture = writeRunRecord(root, "targeted-tests", {
      sourceTreeSha256Before: OLD_SOURCE_SHA256,
      sourceTreeSha256After: SOURCE_SHA256,
      status: "FAIL",
    });
    expect(() => validateCommandRunRecord(fixture.record, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
      requirePassing: true,
    })).toThrow(/changed the source tree/i);
  });

  it("rejects baseline promotion when only the update run is cited", () => {
    const root = createRoot();
    const update = writeRunRecord(root, "visual-baseline-update", {
      sourceTreeSha256Before: OLD_SOURCE_SHA256,
      sourceTreeSha256After: SOURCE_SHA256,
    });
    const updateOnly = {
      schemaVersion: 1,
      recordType: "VISUAL_ARIA_BASELINE_PROMOTION",
      sourceTreeSha256: SOURCE_SHA256,
      promotedAtUtc: "2026-08-10T00:00:04.000Z",
      status: "PASS",
      stages: [],
      commandRunRecordFiles: { visualBaselineUpdate: update.path },
      preChangeReferenceFile: artifactPath("pre-change-reference", "PRE-CHANGE-REFERENCE.json"),
      visualAriaEvidenceFile: artifactPath("VISUAL-ARIA-EVIDENCE.json"),
      semanticReviewFiles: {},
      reviewerConflictFile: artifactPath("semantic-reviews", "REVIEW-CONFLICTS.json"),
      scrollMatrixFile: artifactPath("SCROLL-MATRIX.json"),
      catalogSmokeFile: artifactPath("GAME-CATALOG-MACHINE-SMOKE.json"),
      agentPlaythroughsFile: artifactPath("agent-playthrough", "AGENT-PLAYTHROUGH-RESULTS.json"),
      blockerFindingIds: [],
      unresolvedCriticalReviewerConflict: false,
      realChildEvidenceClaimed: false,
      limitations: [],
    };
    expect(() => validateBaselinePromotionRecord(updateOnly, {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
    })).toThrow(/both visual command runs|exact schema fields/i);
  });

  it("blocks the visual-no-update preflight when any semantic review is missing", () => {
    const root = createRoot();
    const sourceTreeSha256 = initializeSourceIdentity(root);
    writePromotionPrerequisites(root, { sourceTreeSha256 });
    const requiredGateIds = [...ORDINARY_COMMAND_GATE_IDS, "visual-baseline-update"] as const;
    const recordFiles = Object.fromEntries(requiredGateIds.map((gateId) => {
      const timing = gateId === "visual-baseline-update"
        ? { startedAtUtc: "2026-08-10T00:00:03.000Z", finishedAtUtc: "2026-08-10T00:00:04.000Z" }
        : { startedAtUtc: "2026-08-10T00:00:01.000Z", finishedAtUtc: "2026-08-10T00:00:02.000Z" };
      return [gateId, writeRunRecord(root, gateId, {
        ...timing,
        sourceTreeSha256Before: sourceTreeSha256,
        sourceTreeSha256After: sourceTreeSha256,
      }).path];
    })) as Record<(typeof requiredGateIds)[number], string>;
    writeCandidateRecord(root, recordFiles["visual-baseline-update"], sourceTreeSha256);
    rmSync(resolve(root, artifactPath("semantic-reviews", "R2_VISUAL_ACCESSIBILITY.json")));

    expect(() => prepareVisualNoUpdatePreflight({
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      inventoryWorkspaceRoot: process.cwd(),
    })).toThrow(/semantic review|missing|empty/i);
  });

  it("rejects establishment before review completion and no-update before establishment", () => {
    const root = createRoot();
    writePromotionPrerequisites(root);
    const recordFiles = Object.fromEntries(COMMAND_RUN_GATE_IDS.map((gateId) => {
      const timing = gateId === "visual-baseline-update"
        ? { startedAtUtc: "2026-08-10T00:00:03.000Z", finishedAtUtc: "2026-08-10T00:00:04.000Z" }
        : gateId === "visual-no-update"
          ? { startedAtUtc: "2026-08-10T00:00:05.500Z", finishedAtUtc: "2026-08-10T00:00:05.900Z" }
          : { startedAtUtc: "2026-08-10T00:00:01.000Z", finishedAtUtc: "2026-08-10T00:00:02.000Z" };
      return [gateId, writeRunRecord(root, gateId, timing).path];
    })) as Record<CommandRunGateId, string>;
    writeCandidateRecord(root, recordFiles["visual-baseline-update"]);
    expect(() => writeEstablishmentRecord(root, recordFiles, SOURCE_SHA256, "2026-08-10T00:00:04.500Z"))
      .toThrow(/predates semantic review|predates deep route evidence/i);

    writeEstablishmentRecord(root, recordFiles, SOURCE_SHA256, "2026-08-10T00:00:06.000Z");
    writeEstablishedVisualAriaIndex(root, "2026-08-10T00:00:05.700Z");
    expect(() => createBaselinePromotionRecord({
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
      inventoryWorkspaceRoot: process.cwd(),
      visualBaselineUpdateRecordFile: recordFiles["visual-baseline-update"],
      visualNoUpdateRecordFile: recordFiles["visual-no-update"],
      promotedAtUtc: "2026-08-10T00:00:07.000Z",
    })).toThrow(/no-update regression must start after baseline establishment/i);
  });

  it("derives exactly seven final gates and routes both visual gates through promotion", () => {
    const root = createRoot();
    writePromotionPrerequisites(root);
    const recordFiles = Object.fromEntries(COMMAND_RUN_GATE_IDS.map((gateId) => {
      const timing = gateId === "visual-baseline-update"
        ? { startedAtUtc: "2026-08-10T00:00:03.000Z", finishedAtUtc: "2026-08-10T00:00:04.000Z" }
        : gateId === "visual-no-update"
          ? { startedAtUtc: "2026-08-10T00:00:07.000Z", finishedAtUtc: "2026-08-10T00:00:08.000Z" }
          : { startedAtUtc: "2026-08-10T00:00:01.000Z", finishedAtUtc: "2026-08-10T00:00:02.000Z" };
      return [gateId, writeRunRecord(root, gateId, timing).path];
    })) as Record<CommandRunGateId, string>;
    const validationOptions = {
      workspaceRoot: root,
      outputDirectory: DEFAULT_MACHINE_REVIEW_OUTPUT,
      sourceTreeSha256: SOURCE_SHA256,
      inventoryWorkspaceRoot: process.cwd(),
    };
    writeCandidateRecord(root, recordFiles["visual-baseline-update"]);
    writeEstablishmentRecord(root, recordFiles);
    writeEstablishedVisualAriaIndex(root);
    const promotion = createBaselinePromotionRecord({
      ...validationOptions,
      visualBaselineUpdateRecordFile: recordFiles["visual-baseline-update"],
      visualNoUpdateRecordFile: recordFiles["visual-no-update"],
      promotedAtUtc: "2026-08-10T00:00:09.000Z",
    });
    const promotionPath = artifactPath("hard-gates", "BASELINE-PROMOTION.json");
    writeJson(resolve(root, promotionPath), promotion);
    const document = deriveCommandGateResultsDocument({
      ...validationOptions,
      commandRunRecordFiles: recordFiles,
      baselinePromotionFile: promotionPath,
      generatedAtUtc: "2026-08-10T00:00:10.000Z",
    });
    expect(validateCommandGateResultsForFinalizer(document, validationOptions).results).toHaveLength(7);
    expect(document.results.filter((result) => result.id === "visual-regression" || result.id === "aria-snapshots"))
      .toMatchObject([
        { provenance: { kind: "BASELINE_PROMOTION", stage: "REGRESSION_PASS" } },
        { provenance: { kind: "BASELINE_PROMOTION", stage: "REGRESSION_PASS" } },
      ]);
  });

  it("exports runner and promoter entrypoints without executing them on import", () => {
    expect(runCommandEvidence).toBeTypeOf("function");
    expect(promoteVisualBaseline).toBeTypeOf("function");
  });
});

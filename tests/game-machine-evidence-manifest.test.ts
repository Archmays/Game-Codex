import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
  STEP07_EXCEPTION_01_ORIGINAL_BLOCKER,
  STEP07_EXCEPTION_01_RESOLUTION,
  STEP07_EXCEPTION_01_ROOT_CAUSE,
  STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
  STEP07_EXCEPTION_02_ORIGINAL_BLOCKER,
  STEP07_EXCEPTION_02_RESOLUTION,
  STEP07_EXCEPTION_02_ROOT_CAUSE,
  STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
  STEP07_EXCEPTION_03_ORIGINAL_BLOCKER,
  STEP07_EXCEPTION_03_RESOLUTION,
  STEP07_EXCEPTION_03_ROOT_CAUSE,
  STEP07_EXCEPTIONAL_REPAIR_01_ID,
  STEP07_EXCEPTIONAL_REPAIR_02_ID,
  STEP07_EXCEPTIONAL_REPAIR_03_ID,
  STEP07_EXCEPTIONAL_REPAIR_IDS,
  STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE,
  STEP07_CLOSED_RECOVERY_ID,
  STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE,
  STEP07_FINAL_CLOSURE_AUTHORIZATION_ID,
  STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE,
  computeEvidenceTreeSha256,
  sha256File,
  verifyEvidenceManifest,
  verifyStep07Readiness,
  writeEvidenceManifest,
} from "../tools/game-machine-review/evidence-identity";
import { computeMachineReviewSourceTreeSha256 } from "../tools/game-machine-review/source-identity";
import {
  STATIC_MACHINE_REPORT_RELATIVE_PATH,
  STATIC_MACHINE_REPORT_SCROLL_CASES,
  STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH,
  STATIC_MACHINE_REPORT_URL_PATH,
  buildStaticMachineReportScrollEvidence,
  readFileIdentity,
  validateStaticMachineReportScrollEvidence,
  type StaticReportScrollCase,
  type StaticReportScrollInputTrace,
  type StaticReportScrollRow,
} from "../tools/game-machine-review/static-report-scroll-evidence";

function createOutput(): string {
  const tempRoot = resolve("tmp");
  mkdirSync(tempRoot, { recursive: true });
  return mkdtempSync(resolve(tempRoot, "step07-evidence-manifest-"));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeExceptionalRepairContract(workspaceRoot: string): void {
  const contracts = [
    {
      path: STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_01_ID,
      humanExceptionalRepairs: 1,
      originalBlocker: STEP07_EXCEPTION_01_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_01_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_01_RESOLUTION,
    },
    {
      path: STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_02_ID,
      humanExceptionalRepairs: 2,
      originalBlocker: STEP07_EXCEPTION_02_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_02_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_02_RESOLUTION,
    },
    {
      path: STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_03_ID,
      humanExceptionalRepairs: 3,
      originalBlocker: STEP07_EXCEPTION_03_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_03_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_03_RESOLUTION,
    },
  ] as const;
  for (const contract of contracts) {
    const path = resolve(workspaceRoot, contract.path);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeJson(path, {
      schemaVersion: 1,
      authorization: contract.exceptionalRepairId,
      exceptionalRepairId: contract.exceptionalRepairId,
      repairRoundsConsumed: 3,
      humanExceptionalRepairs: contract.humanExceptionalRepairs,
      ordinaryAutoReviseLoop: false,
      originalBlocker: contract.originalBlocker,
      scope: {
        rootCause: contract.rootCause,
        requiredResolution: contract.requiredResolution,
      },
    });
  }

  const freezePath = resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE);
  mkdirSync(resolve(freezePath, ".."), { recursive: true });
  writeJson(freezePath, {
    schemaVersion: 1,
    recordType: "STEP07_CLOSED_RECOVERY_FREEZE",
    status: "IMMUTABLE",
    sourceTreeShaBeforeRecovery: "A".repeat(64),
    committedBaseline: "a".repeat(40),
    branch: "main",
    repairRoundsConsumed: 3,
    ordinaryAutoReviseLoop: false,
    humanExceptionalRepairs: 3,
    exceptionalRepairs: STEP07_EXCEPTIONAL_REPAIR_IDS,
    closedRecoveryAuthorizations: 1,
    closedRecoveryId: STEP07_CLOSED_RECOVERY_ID,
    preflight: {},
    allObservedFailures: [],
    admittedFailures: [],
    rejectedFailures: [],
    rejectedCandidates: [],
    exactAllowedFiles: [],
    affectedDependencies: [],
    forbiddenFiles: [],
    forbiddenMutations: [],
    unknownFailurePolicy: "STOP",
    firstMutationMakesFreezeImmutable: true,
    immutable: true,
  });
  writeJson(resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE), {
    schemaVersion: 1,
    recordType: "STEP07_CLOSED_RECOVERY_STOP",
    status: "CLOSED_RECOVERY_STOPPED",
    stopReason: "NEW_UNAUTHORIZED_BLOCKER",
    machineVerdict: "ESCALATE_HUMAN",
    machinePassEligible: false,
    recordedAtUtc: "2026-08-10T00:00:00.000Z",
    branch: "main",
    committedBaseline: "a".repeat(40),
    originMainAtStop: "a".repeat(40),
    sourceTreeShaBeforeRecovery: "A".repeat(64),
    sourceTreeShaAtStop: "B".repeat(64),
    closedRecoveryFreeze: {
      path: STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE,
      sha256: sha256File(freezePath),
      status: "IMMUTABLE",
    },
    lineage: {
      repairRoundsConsumed: 3,
      ordinaryAutoReviseLoop: false,
      humanExceptionalRepairs: 3,
      exceptionalRepairs: STEP07_EXCEPTIONAL_REPAIR_IDS,
      closedRecoveryAuthorizations: 1,
      closedRecoveryId: STEP07_CLOSED_RECOVERY_ID,
    },
    authorizedRepairCompleted: {},
    sameTreeVerificationBeforeStop: {},
    semanticReviewMerge: {},
    newUnauthorizedBlockers: [],
    notPerformedAfterStop: [],
    explicitBoundaries: {},
    nextAuthorityRequired: "NEW_AUTHORITY",
  });
  const charterPath = resolve(workspaceRoot, STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE);
  mkdirSync(resolve(charterPath, ".."), { recursive: true });
  writeJson(charterPath, {
    schemaVersion: 1,
    recordType: "STEP07_FINAL_CLOSURE_CHARTER",
    authorizationId: STEP07_FINAL_CLOSURE_AUTHORIZATION_ID,
    frozenAtUtc: "2026-08-10T00:00:00.000Z",
    sourceTreeSha256: "B".repeat(64),
    findingCount: 1,
    findingListFrozen: true,
    newFindingPolicy: "DIRECT_DEPENDENCY_ONLY",
    lineage: {
      repairRoundsConsumed: 3,
      ordinaryAutoReviseLoop: false,
      humanExceptionalRepairs: 3,
      closedRecoveryAuthorizations: 1,
      finalClosureAuthorizations: 1,
      closureAutoRepairLoopsMaximum: 3,
    },
    boundedProductQuestion: "fixture",
    childValue: "fixture",
    hanziLearningValue: "fixture",
    explicitNonGoals: [],
    findings: [{ findingId: "FIXTURE" }],
  });
}

const exceptionalRepairMetadata = {
  repairRoundsConsumed: 3,
  humanExceptionalRepairs: 3,
  ordinaryAutoReviseLoop: false,
  closedRecoveryAuthorizations: 1,
  finalClosureAuthorizations: 1,
  exceptionalRepairs: [
    {
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_01_ID,
      originalBlocker: STEP07_EXCEPTION_01_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_01_ROOT_CAUSE,
      resolution: STEP07_EXCEPTION_01_RESOLUTION,
      authorizationEvidenceFile: STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
    },
    {
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_02_ID,
      originalBlocker: STEP07_EXCEPTION_02_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_02_ROOT_CAUSE,
      resolution: STEP07_EXCEPTION_02_RESOLUTION,
      authorizationEvidenceFile: STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
    },
    {
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_03_ID,
      originalBlocker: STEP07_EXCEPTION_03_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_03_ROOT_CAUSE,
      resolution: STEP07_EXCEPTION_03_RESOLUTION,
      authorizationEvidenceFile: STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
    },
  ],
} as const;

function staticInputMethod(input: StaticReportScrollCase["requiredInputs"][number]): StaticReportScrollInputTrace["method"] {
  if (input === "mouse-wheel") return "Playwright mouse.wheel";
  if (input === "PageDown") return "Playwright keyboard PageDown";
  if (input === "End") return "Playwright keyboard End";
  return "Chromium CDP Input.dispatchTouchEvent";
}

function writePassingStaticReportScrollEvidence(
  workspaceRoot: string,
  sourceTreeSha256: string,
): void {
  const reportHtml = readFileIdentity(STATIC_MACHINE_REPORT_RELATIVE_PATH, workspaceRoot);
  const rows: StaticReportScrollRow[] = STATIC_MACHINE_REPORT_SCROLL_CASES.map((contract, index) => {
    const screenshotDirectory = resolve(workspaceRoot, "artifacts/game-machine-review/step-07/screenshots/static-machine-report");
    const traceDirectory = resolve(workspaceRoot, "artifacts/game-machine-review/step-07/traces/static-machine-report");
    mkdirSync(screenshotDirectory, { recursive: true });
    mkdirSync(traceDirectory, { recursive: true });
    const screenshotPaths = {
      fullPage: resolve(screenshotDirectory, `${index}-full-page.png`),
      top: resolve(screenshotDirectory, `${index}-top.png`),
      bottom: resolve(screenshotDirectory, `${index}-bottom.png`),
      finalAction: resolve(screenshotDirectory, `${index}-final-action.png`),
    };
    for (const [kind, path] of Object.entries(screenshotPaths)) {
      writeFileSync(path, Buffer.from(`static report screenshot fixture ${index} ${kind}`));
    }
    const tracePath = resolve(traceDirectory, `${index}.zip`);
    writeFileSync(tracePath, Buffer.from(`static report trace fixture ${index}`));
    const screenshots = {
      fullPage: readFileIdentity(screenshotPaths.fullPage, workspaceRoot),
      top: readFileIdentity(screenshotPaths.top, workspaceRoot),
      bottom: readFileIdentity(screenshotPaths.bottom, workspaceRoot),
      finalAction: readFileIdentity(screenshotPaths.finalAction, workspaceRoot),
    };
    const trace = readFileIdentity(tracePath, workspaceRoot);
    const actualUrl = `http://127.0.0.1:5175${STATIC_MACHINE_REPORT_URL_PATH}?evidenceSha=${reportHtml.sha256}`;
    const maxScrollTop = 1500;
    return {
      key: contract.key,
      sourceTreeSha256,
      reportHtmlSha256: reportHtml.sha256,
      contextId: `static-report-${contract.project}-${contract.viewport}`,
      isolatedBrowserContext: true,
      project: contract.project,
      viewport: contract.viewport,
      width: contract.width,
      height: contract.height,
      hasTouch: contract.hasTouch,
      actualUrl,
      pageMode: "adult-tool-page",
      htmlHasAdultToolClass: true,
      bodyHasAdultToolClass: true,
      scrollOwner: "document.documentElement",
      scrollHeight: contract.height + maxScrollTop,
      clientHeight: contract.height,
      maxScrollTop,
      horizontalOverflowPx: 0,
      horizontalOverflowElements: [],
      nestedVerticalScrollOwners: [],
      inputs: contract.requiredInputs.map((input) => ({
        input,
        method: staticInputMethod(input),
        before: 0,
        after: input === "End" ? maxScrollTop : 240,
        maxScrollTop,
        passed: true,
      })),
      finalAction: {
        selector: "[data-static-final-action]",
        keyboardFocusMethod: "Tab",
        visible: true,
        enabled: true,
        focused: true,
        focusVisible: true,
        unobscured: true,
        clicked: true,
        beforeClick: maxScrollTop,
        afterClick: 0,
      },
      network: {
        sameOrigin: "SAME_ORIGIN_ALLOWED",
        external: "EXTERNAL_NETWORK_FORBIDDEN",
        sameOriginRequests: [actualUrl, "ws://127.0.0.1:5175/"],
        externalRequests: [],
      },
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      screenshots,
      trace,
      evidenceFiles: [...Object.values(screenshots).map((identity) => identity.path), trace.path].sort(),
      status: "PASS",
    } satisfies StaticReportScrollRow;
  });
  const evidence = buildStaticMachineReportScrollEvidence(rows, sourceTreeSha256, reportHtml, "2026-08-10T00:00:00.000Z");
  expect(validateStaticMachineReportScrollEvidence(evidence, workspaceRoot, sourceTreeSha256)).toEqual([]);
  writeJson(resolve(workspaceRoot, STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH), evidence);
}

describe("STEP 07 evidence content identity", () => {
  it("binds every non-derived evidence file by workspace path, bytes, SHA-256, and a canonical tree digest", () => {
    const workspaceRoot = resolve(".");
    const outputDirectory = createOutput();
    try {
      mkdirSync(resolve(outputDirectory, "screenshots"), { recursive: true });
      writeFileSync(resolve(outputDirectory, "RAW-GATE.json"), "{\"status\":\"PASS\"}\n", "utf8");
      writeFileSync(resolve(outputDirectory, "screenshots", "route.png"), Buffer.from([1, 2, 3, 4]));
      writeFileSync(resolve(outputDirectory, "MACHINE-REVIEW-REPORT.json"), "derived-before-manifest", "utf8");
      writeFileSync(resolve(outputDirectory, "CLEANUP-PLAN.json"), "derived-cleanup-plan", "utf8");
      mkdirSync(resolve(outputDirectory, "final-closure"), { recursive: true });
      writeFileSync(resolve(outputDirectory, "final-closure", "RETURN-PACKAGE-INVENTORY.json"), "derived-return-inventory", "utf8");
      const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
      const written = writeEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256);

      expect(written.manifest.entries).toHaveLength(2);
      expect(written.manifest.entries.map((entry) => entry.path)).toEqual(
        [...written.manifest.entries.map((entry) => entry.path)].sort(),
      );
      expect(written.manifest.entries.every((entry) => entry.bytes > 0 && /^[A-F0-9]{64}$/.test(entry.sha256))).toBe(true);
      expect(written.manifest.evidenceTreeSha256).toBe(computeEvidenceTreeSha256(written.manifest.entries));
      expect(written.manifest.entries.some((entry) => entry.path.endsWith("MACHINE-REVIEW-REPORT.json"))).toBe(false);
      expect(written.manifest.entries.some((entry) => entry.path.endsWith("CLEANUP-PLAN.json"))).toBe(false);
      expect(written.manifest.entries.some((entry) => entry.path.endsWith("RETURN-PACKAGE-INVENTORY.json"))).toBe(false);

      const verified = verifyEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256);
      expect(verified).toMatchObject({
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        evidenceManifestSha256: written.evidenceManifestSha256,
        entryCount: 2,
      });

      writeFileSync(resolve(outputDirectory, "MACHINE-REVIEW-REPORT.json"), "derived-after-manifest", "utf8");
      writeFileSync(resolve(outputDirectory, "CLEANUP-PLAN.json"), "derived-cleanup-plan-after-manifest", "utf8");
      writeFileSync(resolve(outputDirectory, "final-closure", "RETURN-PACKAGE-INVENTORY.json"), "derived-return-inventory-after-manifest", "utf8");
      expect(() => verifyEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256)).not.toThrow();
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it("fails closed when a covered file changes or an unmanifested raw artifact appears", () => {
    const workspaceRoot = resolve(".");
    const outputDirectory = createOutput();
    try {
      const rawPath = resolve(outputDirectory, "RAW-EVIDENCE.json");
      writeFileSync(rawPath, "{\"status\":\"PASS\"}\n", "utf8");
      const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
      writeEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256);

      writeFileSync(rawPath, "{\"status\":\"FAIL\"}\n", "utf8");
      expect(() => verifyEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256)).toThrow(/content identity mismatch/i);

      writeFileSync(rawPath, "{\"status\":\"PASS\"}\n", "utf8");
      writeFileSync(resolve(outputDirectory, "late-trace.zip"), Buffer.from([9, 8, 7]));
      expect(() => verifyEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256)).toThrow(/coverage is stale/i);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it("verifies an exact clean PASS verdict and current evidence without writing", () => {
    const projectRoot = resolve(".");
    const workspaceRoot = createOutput();
    const outputDirectory = resolve(workspaceRoot, "artifacts/game-machine-review/step-07");
    try {
      mkdirSync(outputDirectory, { recursive: true });
      execFileSync("git", ["init"], { cwd: workspaceRoot });
      execFileSync("git", ["config", "user.email", "step07-test@example.invalid"], { cwd: workspaceRoot });
      execFileSync("git", ["config", "user.name", "STEP 07 Test"], { cwd: workspaceRoot });
      execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: workspaceRoot });
      writeFileSync(resolve(workspaceRoot, "source.txt"), "stable source tree\n", "utf8");
      execFileSync("git", ["add", "source.txt"], { cwd: workspaceRoot });
      execFileSync("git", ["commit", "-m", "test fixture"], { cwd: workspaceRoot });
      writeFileSync(resolve(outputDirectory, "raw.log"), "real command output\n", "utf8");
      writeExceptionalRepairContract(workspaceRoot);
      const sourceTreeSha256 = computeMachineReviewSourceTreeSha256(workspaceRoot);
      const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot, encoding: "utf8" }).trim();
      const generatedAtUtc = new Date().toISOString();
      const staticReportHtml = "<!doctype html><html class=\"adult-tool-page\"><body class=\"adult-tool-page\"><button data-static-final-action>Return to report top</button></body></html>\n";
      writeFileSync(resolve(outputDirectory, "MACHINE-REVIEW-REPORT.html"), staticReportHtml, "utf8");
      writePassingStaticReportScrollEvidence(workspaceRoot, sourceTreeSha256);
      const written = writeEvidenceManifest(workspaceRoot, outputDirectory, sourceTreeSha256, generatedAtUtc);
      const report = {
        schemaVersion: 1,
        step: "07",
        generatedAtUtc,
        sourceIdentity: { commitSha: commit, sourceTreeSha256 },
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        evidenceManifestSha256: written.evidenceManifestSha256,
        manifest: {},
        hardGates: {},
        scrollMatrix: {},
        catalogSmoke: {},
        agentPlaythroughs: {},
        deepRouteAccessibility: {},
        criticalControlGeometry: {},
        network: {},
        privacy: {},
        semanticReview: {},
        unresolvedCriticalReviewerConflict: false,
        finalFullTests: {},
        finalBuild: {},
        verdict: { verdict: "PASS_MACHINE", escalationReason: null, failedConditions: [], repairRound: 3 },
        ...exceptionalRepairMetadata,
        realSecondUsePerformed: false,
        limitations: [],
      };
      const derivedOutputs = {
        "MACHINE-REVIEW-REPORT.html": staticReportHtml,
        "MACHINE-REVIEW-REPORT.json": `${JSON.stringify(report, null, 2)}\n`,
        "MACHINE-REVIEW-SUMMARY.md": "# STEP 07 Machine Review\n\nPASS_MACHINE\n",
        "route-inventory.json": "{\"schemaVersion\":1,\"step\":\"07\"}\n",
      };
      for (const [name, contents] of Object.entries(derivedOutputs)) {
        writeFileSync(resolve(outputDirectory, name), contents, "utf8");
      }
      const derivedOutputSealPath = resolve(outputDirectory, "DERIVED-OUTPUT-SEAL.json");
      writeJson(derivedOutputSealPath, {
        schemaVersion: 1,
        step: "07",
        sourceTreeSha256,
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        entries: Object.keys(derivedOutputs).sort().map((path) => ({
          path,
          bytes: statSync(resolve(outputDirectory, path)).size,
          sha256: sha256File(resolve(outputDirectory, path)),
        })),
      });
      const verdict = {
        schemaVersion: 1,
        step: "07",
        verdict: "PASS_MACHINE",
        escalationReason: null,
        failedConditions: [],
        repairRound: 3,
        finalCommit: commit,
        sourceTreeSha256,
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        evidenceManifestSha256: written.evidenceManifestSha256,
        derivedOutputSealSha256: sha256File(derivedOutputSealPath),
        generatedAtUtc,
        realSecondUsePerformed: "NO",
        ...exceptionalRepairMetadata,
      };
      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), verdict);

      const manifestPath = resolve(outputDirectory, "EVIDENCE-MANIFEST.json");
      const before = { bytes: readFileSync(manifestPath), mtimeMs: statSync(manifestPath).mtimeMs };
      const expectedEntryCount = 1 + 3 + 3 + 1 + (STATIC_MACHINE_REPORT_SCROLL_CASES.length * 5);
      expect(verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toMatchObject({ entryCount: expectedEntryCount });
      const cliResult = JSON.parse(execFileSync(process.execPath, [
        resolve(projectRoot, "node_modules/tsx/dist/cli.mjs"),
        resolve(projectRoot, "tools/game-machine-review/evidence-identity.ts"),
        "verify-readiness",
        workspaceRoot,
        outputDirectory,
        commit,
      ], { cwd: projectRoot, encoding: "utf8" })) as Record<string, unknown>;
      expect(cliResult).toMatchObject({ status: "PASS", entryCount: expectedEntryCount });
      expect(readFileSync(manifestPath)).toEqual(before.bytes);
      expect(statSync(manifestPath).mtimeMs).toBe(before.mtimeMs);

      mkdirSync(resolve(workspaceRoot, "src"), { recursive: true });
      writeFileSync(resolve(workspaceRoot, "src/new.ts"), "export const uncommitted = true;\n", "utf8");
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(
        /Untracked source files.*src\/new\.ts/i,
      );
      rmSync(resolve(workspaceRoot, "src"), { recursive: true, force: true });

      mkdirSync(resolve(workspaceRoot, "artifacts/unrelated-generated-output"), { recursive: true });
      writeFileSync(resolve(workspaceRoot, "artifacts/unrelated-generated-output/log.txt"), "generated only\n", "utf8");
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).not.toThrow();
      rmSync(resolve(workspaceRoot, "artifacts/unrelated-generated-output"), { recursive: true, force: true });

      const reportPath = resolve(outputDirectory, "MACHINE-REVIEW-REPORT.json");
      const reportBeforeTamper = readFileSync(reportPath);
      writeFileSync(reportPath, `${reportBeforeTamper.toString("utf8")} `, "utf8");
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/derived output identity mismatch/i);
      writeFileSync(reportPath, reportBeforeTamper);

      const htmlPath = resolve(outputDirectory, "MACHINE-REVIEW-REPORT.html");
      const htmlBeforeTamper = readFileSync(htmlPath);
      writeFileSync(htmlPath, `${htmlBeforeTamper.toString("utf8")}<!-- tampered -->`, "utf8");
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/derived output identity mismatch/i);
      writeFileSync(htmlPath, htmlBeforeTamper);

      const sealBeforeStaticTamper = readFileSync(derivedOutputSealPath);
      const staticTamperedHtml = `${htmlBeforeTamper.toString("utf8")}<!-- identity-bound static gate tamper -->`;
      writeFileSync(htmlPath, staticTamperedHtml, "utf8");
      const resealedEntries = Object.keys(derivedOutputs).sort().map((path) => ({
        path,
        bytes: statSync(resolve(outputDirectory, path)).size,
        sha256: sha256File(resolve(outputDirectory, path)),
      }));
      writeJson(derivedOutputSealPath, {
        schemaVersion: 1,
        step: "07",
        sourceTreeSha256,
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        entries: resealedEntries,
      });
      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), {
        ...verdict,
        derivedOutputSealSha256: sha256File(derivedOutputSealPath),
      });
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/Static machine report readiness gate failed:.*HTML identity/i);
      writeFileSync(htmlPath, htmlBeforeTamper);
      writeFileSync(derivedOutputSealPath, sealBeforeStaticTamper);
      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), verdict);

      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), { ...verdict, unexpectedApproval: true });
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/unexpected or missing fields/i);

      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), verdict);
      const reportWithWrongResolution = {
        ...report,
        exceptionalRepairs: report.exceptionalRepairs.map((repair, index) => index === 2
          ? { ...repair, resolution: "WRONG_RESOLUTION" }
          : repair),
      };
      writeFileSync(reportPath, `${JSON.stringify(reportWithWrongResolution, null, 2)}\n`, "utf8");
      const resealedReportEntries = Object.keys(derivedOutputs).sort().map((path) => ({
        path,
        bytes: statSync(resolve(outputDirectory, path)).size,
        sha256: sha256File(resolve(outputDirectory, path)),
      }));
      writeJson(derivedOutputSealPath, {
        schemaVersion: 1,
        step: "07",
        sourceTreeSha256,
        evidenceTreeSha256: written.manifest.evidenceTreeSha256,
        entries: resealedReportEntries,
      });
      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), {
        ...verdict,
        derivedOutputSealSha256: sha256File(derivedOutputSealPath),
      });
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/exceptionalRepairs is invalid/i);
      writeFileSync(reportPath, reportBeforeTamper);
      writeFileSync(derivedOutputSealPath, sealBeforeStaticTamper);
      writeJson(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), verdict);

      rmSync(resolve(workspaceRoot, STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH));
      expect(() => verifyStep07Readiness({ workspaceRoot, outputDirectory, expectedCommit: commit })).toThrow(/Evidence manifest coverage is stale/i);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});

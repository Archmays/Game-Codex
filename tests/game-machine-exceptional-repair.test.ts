import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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
  readStep07ExceptionalRepairMetadata,
  sha256File,
} from "../tools/game-machine-review/evidence-identity";
import {
  renderMachineReviewHtml,
  renderMachineReviewJson,
  renderMachineReviewMarkdown,
  writeMachineReviewReport,
  type MachineReviewReport,
} from "../tools/game-machine-review/render-report";
import { parseCliArguments } from "../tools/game-machine-review/run-machine-review";

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

function createTempRoot(): string {
  mkdirSync(resolve("tmp"), { recursive: true });
  return mkdtempSync(resolve("tmp", "step07-exceptional-repair-"));
}

function writeContract(
  workspaceRoot: string,
  repair: 1 | 2 | 3,
  overrides: Record<string, unknown> = {},
): void {
  const contracts = {
    1: {
      path: STEP07_EXCEPTION_01_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_01_ID,
      humanExceptionalRepairs: 1,
      originalBlocker: STEP07_EXCEPTION_01_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_01_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_01_RESOLUTION,
    },
    2: {
      path: STEP07_EXCEPTION_02_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_02_ID,
      humanExceptionalRepairs: 2,
      originalBlocker: STEP07_EXCEPTION_02_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_02_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_02_RESOLUTION,
    },
    3: {
      path: STEP07_EXCEPTION_03_AUTHORIZATION_EVIDENCE_FILE,
      exceptionalRepairId: STEP07_EXCEPTIONAL_REPAIR_03_ID,
      humanExceptionalRepairs: 3,
      originalBlocker: STEP07_EXCEPTION_03_ORIGINAL_BLOCKER,
      rootCause: STEP07_EXCEPTION_03_ROOT_CAUSE,
      requiredResolution: STEP07_EXCEPTION_03_RESOLUTION,
    },
  } as const;
  const contract = contracts[repair];
  const path = resolve(workspaceRoot, contract.path);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
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
    ...overrides,
  }, null, 2)}\n`, "utf8");
}

function writeAuthorizationLineage(
  workspaceRoot: string,
  finalLineageOverrides: Record<string, unknown> = {},
): void {
  const freezePath = resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_FREEZE_EVIDENCE_FILE);
  mkdirSync(resolve(freezePath, ".."), { recursive: true });
  writeFileSync(freezePath, `${JSON.stringify({
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
  }, null, 2)}\n`, "utf8");

  const stoppedPath = resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE);
  writeFileSync(stoppedPath, `${JSON.stringify({
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
  }, null, 2)}\n`, "utf8");

  const charterPath = resolve(workspaceRoot, STEP07_FINAL_CLOSURE_CHARTER_EVIDENCE_FILE);
  mkdirSync(resolve(charterPath, ".."), { recursive: true });
  writeFileSync(charterPath, `${JSON.stringify({
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
      ...finalLineageOverrides,
    },
    boundedProductQuestion: "fixture",
    childValue: "fixture",
    hanziLearningValue: "fixture",
    explicitNonGoals: [],
    findings: [{ findingId: "FIXTURE" }],
  }, null, 2)}\n`, "utf8");
}

function reportFixture(): MachineReviewReport {
  const pass = { status: "PASS", evidenceFiles: ["evidence.json"] } as const;
  return {
    schemaVersion: 1,
    step: "07",
    generatedAtUtc: "2026-08-10T00:00:00.000Z",
    sourceIdentity: { commitSha: "a".repeat(40), sourceTreeSha256: "A".repeat(64) },
    evidenceTreeSha256: "B".repeat(64),
    evidenceManifestSha256: "C".repeat(64),
    manifest: { schemaVersion: 1, step: "07" } as unknown as MachineReviewReport["manifest"],
    hardGates: { status: "PASS", required: 0, passed: 0, passRate: 1, failedGateIds: [], results: [] },
    scrollMatrix: pass,
    catalogSmoke: pass,
    agentPlaythroughs: pass,
    deepRouteAccessibility: pass,
    criticalControlGeometry: pass,
    network: {
      status: "PASS",
      policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
      sameOriginRequestCount: 1,
      externalRequests: [],
      evidenceFiles: ["network.json"],
    },
    privacy: pass,
    semanticReview: { reviewers: [], findings: [], blockerCount: 0, severityCounts: { "Sev-1": 0, "Sev-2": 0, "Sev-3": 0 } } as unknown as MachineReviewReport["semanticReview"],
    unresolvedCriticalReviewerConflict: false,
    finalFullTests: pass,
    finalBuild: pass,
    verdict: { verdict: "PASS_MACHINE", escalationReason: null, failedConditions: [], repairRound: 3 },
    ...exceptionalRepairMetadata,
    realSecondUsePerformed: false,
    limitations: ["Synthetic report fixture."],
  };
}

describe("STEP 07 human-authorized exceptional repair metadata", () => {
  it("parses the explicit CLI option while preserving repair round three", () => {
    expect(parseCliArguments([
      "--repair-round",
      "3",
      "--exceptional-repair-id",
      STEP07_EXCEPTIONAL_REPAIR_01_ID,
      "--exceptional-repair-id",
      STEP07_EXCEPTIONAL_REPAIR_02_ID,
      "--exceptional-repair-id",
      STEP07_EXCEPTIONAL_REPAIR_03_ID,
    ])).toMatchObject({ repairRound: 3, exceptionalRepairIds: STEP07_EXCEPTIONAL_REPAIR_IDS });
  });

  it("accepts only the exact canonical authorization and resolution contract", () => {
    const workspaceRoot = createTempRoot();
    try {
      writeContract(workspaceRoot, 1);
      writeContract(workspaceRoot, 2);
      writeContract(workspaceRoot, 3);
      writeAuthorizationLineage(workspaceRoot);
      expect(readStep07ExceptionalRepairMetadata(workspaceRoot, STEP07_EXCEPTIONAL_REPAIR_IDS)).toEqual(
        exceptionalRepairMetadata,
      );
      expect(() => readStep07ExceptionalRepairMetadata(workspaceRoot, [STEP07_EXCEPTIONAL_REPAIR_02_ID])).toThrow(
        /Exceptional repair ids/,
      );
      const stoppedPath = resolve(workspaceRoot, STEP07_CLOSED_RECOVERY_STOPPED_EVIDENCE_FILE);
      const stopped = JSON.parse(readFileSync(stoppedPath, "utf8"));
      stopped.closedRecoveryFreeze.sha256 = "F".repeat(64);
      writeFileSync(stoppedPath, `${JSON.stringify(stopped, null, 2)}\n`, "utf8");
      expect(() => readStep07ExceptionalRepairMetadata(workspaceRoot, STEP07_EXCEPTIONAL_REPAIR_IDS)).toThrow(
        /closed recovery freeze reference identity is invalid/,
      );
      writeAuthorizationLineage(workspaceRoot);
      writeAuthorizationLineage(workspaceRoot, { finalClosureAuthorizations: 2 });
      expect(() => readStep07ExceptionalRepairMetadata(workspaceRoot, STEP07_EXCEPTIONAL_REPAIR_IDS)).toThrow(
        /final closure charter lineage identity is invalid/,
      );
      writeAuthorizationLineage(workspaceRoot);
      writeContract(workspaceRoot, 3, { ordinaryAutoReviseLoop: true });
      expect(() => readStep07ExceptionalRepairMetadata(workspaceRoot, STEP07_EXCEPTIONAL_REPAIR_IDS)).toThrow(
        /repair 03 authorization contract identity is invalid/,
      );
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("validates the actual canonical closed-recovery and final-closure authorization artifacts", () => {
    expect(readStep07ExceptionalRepairMetadata(resolve("."), STEP07_EXCEPTIONAL_REPAIR_IDS)).toMatchObject({
      repairRoundsConsumed: 3,
      ordinaryAutoReviseLoop: false,
      humanExceptionalRepairs: 3,
      closedRecoveryAuthorizations: 1,
      finalClosureAuthorizations: 1,
    });
  });

  it("exposes the exact exception metadata in JSON, Markdown, HTML, and verdict JSON", () => {
    const outputDirectory = createTempRoot();
    try {
      const report = reportFixture();
      const rendered = [
        renderMachineReviewJson(report),
        renderMachineReviewMarkdown(report),
        renderMachineReviewHtml(report),
      ];
      for (const contents of rendered) {
        expect(contents).toContain("repairRoundsConsumed");
        expect(contents).toContain("humanExceptionalRepairs");
        expect(contents).toContain("ordinaryAutoReviseLoop");
        expect(contents).toContain("closedRecoveryAuthorizations");
        expect(contents).toContain("finalClosureAuthorizations");
        for (const repair of exceptionalRepairMetadata.exceptionalRepairs) {
          for (const value of Object.values(repair)) expect(contents).toContain(String(value));
        }
      }
      writeMachineReviewReport(report, outputDirectory);
      const verdict = JSON.parse(readFileSync(resolve(outputDirectory, "MACHINE-REVIEW-VERDICT.json"), "utf8"));
      expect(verdict).toMatchObject({ repairRound: 3, ...exceptionalRepairMetadata });
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });
});

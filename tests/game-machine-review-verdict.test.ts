import {
  REQUIRED_HARD_GATE_IDS,
  evaluateHardGates,
  evaluateMachineVerdict,
  type EvidenceSummary,
  type HardGateResult,
  type MachineVerdictInput,
  type NetworkGateSummary,
} from "../tools/game-machine-review/evaluate-hard-gates";
import { mergeSemanticReviewFindings } from "../tools/game-machine-review/merge-review-findings";
import {
  SEMANTIC_REVIEWER_IDS,
  parseSemanticReview,
  validateSemanticReview,
  type SemanticReviewDocument,
  type SemanticReviewerId,
} from "../tools/game-machine-review/semantic-review-schema";

function semanticDocument(reviewer: SemanticReviewerId): SemanticReviewDocument {
  return {
    schemaVersion: 1,
    sourceTreeSha256: "A".repeat(64),
    reviewer,
    reviewEngine: "Codex collaboration subagent",
    model: "GPT-5 test fixture",
    reviewMode: "INDEPENDENT_SUBAGENT",
    evidenceFiles: [`artifacts/game-machine-review/${reviewer}/route.png`],
    completedAtUtc: "2026-08-10T00:00:00.000Z",
    findings: [],
    limitations: ["Synthetic test fixture."],
  };
}

function hardGateResults(status: "PASS" | "FAIL" = "PASS"): readonly HardGateResult[] {
  return REQUIRED_HARD_GATE_IDS.map((id, index) => ({
    id,
    status: index === 0 ? status : "PASS",
    evidenceFiles: [`artifacts/game-machine-review/hard-gates/${id}.json`],
    detail: `${id} checked`,
  }));
}

const passSummary: EvidenceSummary = {
  status: "PASS",
  evidenceFiles: ["artifacts/game-machine-review/pass.json"],
};

const passNetwork: NetworkGateSummary = {
  status: "PASS",
  policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
  sameOriginRequestCount: 12,
  externalRequests: [],
  evidenceFiles: ["artifacts/game-machine-review/network.json"],
};

function passInput(): MachineVerdictInput {
  return {
    hardGates: evaluateHardGates(hardGateResults()),
    scrollMatrix: passSummary,
    catalogSmoke: passSummary,
    agentPlaythroughs: passSummary,
    semanticReview: mergeSemanticReviewFindings(SEMANTIC_REVIEWER_IDS.map(semanticDocument)),
    unresolvedCriticalReviewerConflict: false,
    network: passNetwork,
    privacy: passSummary,
    finalFullTests: passSummary,
    finalBuild: passSummary,
    repairRound: 0,
  };
}

describe("semantic machine review schema", () => {
  it("requires honest reviewer engine, model, mode, and evidence metadata", () => {
    const missingModel = { ...semanticDocument("R1_CHILD_FIRST_UX"), model: "" };
    expect(validateSemanticReview(missingModel)).toMatchObject({ ok: false });

    const inventedMode = { ...semanticDocument("R1_CHILD_FIRST_UX"), reviewMode: "INDEPENDENT_REVIEW" };
    expect(validateSemanticReview(inventedMode)).toMatchObject({ ok: false });

    const missingEvidence = { ...semanticDocument("R1_CHILD_FIRST_UX"), evidenceFiles: [] };
    expect(validateSemanticReview(missingEvidence)).toMatchObject({ ok: false });

    expect(parseSemanticReview(semanticDocument("R1_CHILD_FIRST_UX"))).toEqual(
      semanticDocument("R1_CHILD_FIRST_UX"),
    );
  });

  it("merges only three actual, uniquely identified reviewer documents", () => {
    expect(() => mergeSemanticReviewFindings([semanticDocument("R1_CHILD_FIRST_UX")])).toThrow(
      /three declared semantic reviewers/,
    );
    expect(() =>
      mergeSemanticReviewFindings([
        semanticDocument("R1_CHILD_FIRST_UX"),
        semanticDocument("R1_CHILD_FIRST_UX"),
        semanticDocument("R3_ADVERSARIAL_QA"),
      ]),
    ).toThrow(/unique/);
    expect(mergeSemanticReviewFindings(SEMANTIC_REVIEWER_IDS.map(semanticDocument)).reviewers).toEqual(
      SEMANTIC_REVIEWER_IDS,
    );
  });
});

describe("machine review verdict", () => {
  it("requires the complete hard-gate set with cited evidence", () => {
    expect(() => evaluateHardGates(hardGateResults().slice(1))).toThrow(/incomplete/);
    const noEvidence = hardGateResults().map((gate, index) =>
      index === 0 ? { ...gate, evidenceFiles: [] } : gate,
    );
    expect(() => evaluateHardGates(noEvidence)).toThrow(/must cite evidence/);
  });

  it("returns PASS_MACHINE only when every machine gate passes", () => {
    expect(evaluateMachineVerdict(passInput())).toEqual({
      verdict: "PASS_MACHINE",
      escalationReason: null,
      failedConditions: [],
      repairRound: 0,
    });
  });

  it("returns AUTO_REVISE for a repairable failure before round three", () => {
    const input = passInput();
    const verdict = evaluateMachineVerdict({
      ...input,
      hardGates: evaluateHardGates(hardGateResults("FAIL")),
      repairRound: 2,
    });
    expect(verdict.verdict).toBe("AUTO_REVISE");
    expect(verdict.escalationReason).toBeNull();
    expect(verdict.failedConditions).toContain("hard-gates-not-100-percent");
  });

  it("escalates the same unresolved failure after three repair rounds", () => {
    const input = passInput();
    expect(
      evaluateMachineVerdict({
        ...input,
        scrollMatrix: { ...passSummary, status: "FAIL" },
        repairRound: 3,
      }),
    ).toMatchObject({ verdict: "ESCALATE_HUMAN", escalationReason: "THREE_REPAIR_LOOPS_FAILED" });
  });

  it("escalates critical reviewer conflicts and explicit human-only questions immediately", () => {
    expect(
      evaluateMachineVerdict({ ...passInput(), unresolvedCriticalReviewerConflict: true }),
    ).toMatchObject({
      verdict: "ESCALATE_HUMAN",
      escalationReason: "MACHINE_REVIEWER_CRITICAL_DISAGREEMENT",
    });
    expect(
      evaluateMachineVerdict({ ...passInput(), requestedHumanEscalation: "REAL_CHILD_BEHAVIOR_REQUIRED" }),
    ).toMatchObject({ verdict: "ESCALATE_HUMAN", escalationReason: "REAL_CHILD_BEHAVIOR_REQUIRED" });
  });

  it("blocks PASS when any external request is observed", () => {
    const verdict = evaluateMachineVerdict({
      ...passInput(),
      network: { ...passNetwork, externalRequests: ["https://example.invalid/collect"] },
    });
    expect(verdict.verdict).toBe("AUTO_REVISE");
    expect(verdict.failedConditions).toContain("external-network");
  });
});

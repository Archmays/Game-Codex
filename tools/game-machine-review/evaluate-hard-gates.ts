import type { MergedSemanticReview } from "./merge-review-findings";

export const REQUIRED_HARD_GATE_IDS = [
  "compile",
  "targeted-tests",
  "full-tests",
  "build",
  "route-precedence",
  "state-invariants",
  "save-and-corrupt-recovery",
  "console-and-page-errors",
  "external-network",
  "privacy-and-pii",
  "adult-scroll-and-reflow",
  "keyboard-focus-and-targets",
  "critical-control-geometry",
  "accessibility-structure",
  "deterministic-visual-states",
  "child-copy-and-forbidden-mechanics",
] as const;

export const MACHINE_VERDICTS = ["PASS_MACHINE", "AUTO_REVISE", "ESCALATE_HUMAN"] as const;
export const HUMAN_ESCALATION_REASONS = [
  "REAL_CHILD_BEHAVIOR_REQUIRED",
  "VALUE_OR_PREFERENCE_CHOICE",
  "IRREVERSIBLE_PRIVACY_OR_PUBLICATION",
  "MACHINE_REVIEWER_CRITICAL_DISAGREEMENT",
  "THREE_REPAIR_LOOPS_FAILED",
] as const;

export type HardGateId = (typeof REQUIRED_HARD_GATE_IDS)[number];
export type MachineVerdict = (typeof MACHINE_VERDICTS)[number];
export type HumanEscalationReason = (typeof HUMAN_ESCALATION_REASONS)[number];
export type EvidenceStatus = "PASS" | "FAIL";

export interface HardGateResult {
  readonly id: HardGateId;
  readonly status: EvidenceStatus;
  readonly evidenceFiles: readonly string[];
  readonly detail: string;
}

export interface HardGateEvaluation {
  readonly status: EvidenceStatus;
  readonly passed: number;
  readonly required: number;
  readonly passRate: number;
  readonly failedGateIds: readonly HardGateId[];
  readonly results: readonly HardGateResult[];
}

export interface EvidenceSummary {
  readonly status: EvidenceStatus;
  readonly evidenceFiles: readonly string[];
}

export interface NetworkGateSummary extends EvidenceSummary {
  readonly policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN";
  readonly sameOriginRequestCount: number;
  readonly externalRequests: readonly string[];
}

export interface MachineVerdictInput {
  readonly hardGates: HardGateEvaluation;
  readonly scrollMatrix: EvidenceSummary;
  readonly catalogSmoke: EvidenceSummary;
  readonly agentPlaythroughs: EvidenceSummary;
  readonly semanticReview: MergedSemanticReview;
  readonly unresolvedCriticalReviewerConflict: boolean;
  readonly network: NetworkGateSummary;
  readonly privacy: EvidenceSummary;
  readonly finalFullTests: EvidenceSummary;
  readonly finalBuild: EvidenceSummary;
  readonly repairRound: number;
  readonly requestedHumanEscalation?: Exclude<HumanEscalationReason, "MACHINE_REVIEWER_CRITICAL_DISAGREEMENT" | "THREE_REPAIR_LOOPS_FAILED">;
}

export interface MachineVerdictResult {
  readonly verdict: MachineVerdict;
  readonly escalationReason: HumanEscalationReason | null;
  readonly failedConditions: readonly string[];
  readonly repairRound: number;
}

function validEvidenceFiles(files: readonly string[]): boolean {
  return files.length > 0 && files.every((file) => typeof file === "string" && file.trim().length > 0);
}

export function evaluateHardGates(results: readonly HardGateResult[]): HardGateEvaluation {
  const ids = results.map((result) => result.id);
  if (new Set(ids).size !== ids.length) throw new Error("Hard gate ids must be unique");
  const missing = REQUIRED_HARD_GATE_IDS.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !REQUIRED_HARD_GATE_IDS.includes(id));
  if (missing.length > 0 || extra.length > 0 || results.length !== REQUIRED_HARD_GATE_IDS.length) {
    throw new Error(`Hard gate set is incomplete; missing=${missing.join(",") || "none"}`);
  }
  for (const result of results) {
    if (result.status !== "PASS" && result.status !== "FAIL") throw new Error(`Invalid hard gate status for ${result.id}`);
    if (!validEvidenceFiles(result.evidenceFiles)) throw new Error(`Hard gate ${result.id} must cite evidence`);
    if (!result.detail.trim()) throw new Error(`Hard gate ${result.id} must include detail`);
  }
  const failedGateIds = results.filter((result) => result.status === "FAIL").map((result) => result.id);
  const passed = results.length - failedGateIds.length;
  return {
    status: failedGateIds.length === 0 ? "PASS" : "FAIL",
    passed,
    required: REQUIRED_HARD_GATE_IDS.length,
    passRate: passed / REQUIRED_HARD_GATE_IDS.length,
    failedGateIds,
    results: [...results],
  };
}

export function evaluateMachineVerdict(input: MachineVerdictInput): MachineVerdictResult {
  if (!Number.isInteger(input.repairRound) || input.repairRound < 0 || input.repairRound > 3) {
    throw new Error("repairRound must be an integer from 0 through 3");
  }
  if (input.requestedHumanEscalation) {
    return { verdict: "ESCALATE_HUMAN", escalationReason: input.requestedHumanEscalation, failedConditions: [input.requestedHumanEscalation], repairRound: input.repairRound };
  }
  if (input.unresolvedCriticalReviewerConflict) {
    return { verdict: "ESCALATE_HUMAN", escalationReason: "MACHINE_REVIEWER_CRITICAL_DISAGREEMENT", failedConditions: ["unresolved-critical-reviewer-conflict"], repairRound: input.repairRound };
  }

  const failedConditions: string[] = [];
  if (input.hardGates.status !== "PASS" || input.hardGates.passRate !== 1) failedConditions.push("hard-gates-not-100-percent");
  if (input.scrollMatrix.status !== "PASS") failedConditions.push("adult-scroll-matrix");
  if (input.catalogSmoke.status !== "PASS") failedConditions.push("catalog-smoke");
  if (input.agentPlaythroughs.status !== "PASS") failedConditions.push("agent-playthroughs");
  if (input.semanticReview.blockerFindingIds.length > 0) failedConditions.push("semantic-sev-1-or-2");
  if (input.network.status !== "PASS" || input.network.externalRequests.length > 0) failedConditions.push("external-network");
  if (input.privacy.status !== "PASS") failedConditions.push("privacy");
  if (input.finalFullTests.status !== "PASS") failedConditions.push("final-full-tests");
  if (input.finalBuild.status !== "PASS") failedConditions.push("final-build");

  if (failedConditions.length === 0) {
    return { verdict: "PASS_MACHINE", escalationReason: null, failedConditions, repairRound: input.repairRound };
  }
  if (input.repairRound >= 3) {
    return { verdict: "ESCALATE_HUMAN", escalationReason: "THREE_REPAIR_LOOPS_FAILED", failedConditions, repairRound: input.repairRound };
  }
  return { verdict: "AUTO_REVISE", escalationReason: null, failedConditions, repairRound: input.repairRound };
}

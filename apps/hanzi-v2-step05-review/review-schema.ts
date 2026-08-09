import { STEP05_EVIDENCE_SHA256 } from "./review-evidence";
import {
  STEP05_REVIEW_ITEMS,
  STEP05_REVIEW_ITEM_IDS,
  STEP05_REVIEW_CANDIDATE_REVISION,
  type Step05ReviewDecision,
  type Step05ReviewItemId,
} from "./review-items";

export const STEP05_REVIEW_FILE_NAME = "STEP-05_PARENT_REVIEW_FEEDBACK.json";
export const STEP05_REVIEW_DRAFT_KEY = "family-games/hanzi-radical-battle-v2-step05-review/draft";
export const STEP05_REVIEW_CONTRACT_VERSION = "hanzi-v2-step05-parent-review-v1";

export interface Step05ReviewIdentity {
  readonly candidateCommit: string;
  readonly evidenceSha256: string;
  readonly candidateRevision: string;
}

export interface Step05ItemDecision {
  readonly itemId: Step05ReviewItemId;
  readonly revisionHash: string;
  readonly decision: Step05ReviewDecision;
  readonly notes: string;
  readonly carriedForward: boolean;
}

export interface Step05ReviewDraft {
  readonly schemaVersion: 1;
  readonly reviewContractVersion: typeof STEP05_REVIEW_CONTRACT_VERSION;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "05";
  readonly reviewRound: number;
  readonly identity: Step05ReviewIdentity;
  readonly decisions: readonly Step05ItemDecision[];
  readonly authorizeDefaultWorldEntry: "" | "YES" | "NO";
  readonly authorizeSecondUseCheck: "" | "YES" | "NO";
  readonly generalNotes: string;
}

export interface Step05ParentReviewFeedback extends Omit<Step05ReviewDraft, "decisions"> {
  readonly decisions: readonly (Step05ItemDecision & { readonly decision: Exclude<Step05ReviewDecision, ""> })[];
  readonly authorizeDefaultWorldEntry: "YES" | "NO";
  readonly authorizeSecondUseCheck: "YES" | "NO";
  readonly reviewMeta: {
    readonly completed: true;
    readonly exportedAtUtc: string;
    readonly missingRequiredFieldIds: readonly [];
  };
}

export interface Step05IdentityParseResult {
  readonly identity: Step05ReviewIdentity;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[A-F0-9]{64}$/;
const REVISION_PATTERN = /^[A-Za-z0-9:._-]{1,120}$/;
const NOTES_DENYLIST = /(?:真实姓名|姓名[:：]|学校[:：]|电话[:：]|地址[:：]|身份证|childName|studentName|e-?mail|https?:\/\/|[A-Z]:\\)/iu;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStep05ReviewIdentity(search: string | URLSearchParams): Step05IdentityParseResult {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const identity: Step05ReviewIdentity = {
    candidateCommit: params.get("commit") ?? "",
    evidenceSha256: (params.get("evidence") ?? "").toUpperCase(),
    candidateRevision: params.get("revision") ?? "",
  };
  const issues: string[] = [];
  if (!COMMIT_PATTERN.test(identity.candidateCommit)) issues.push("candidate commit must be a full lowercase Git SHA");
  if (!SHA256_PATTERN.test(identity.evidenceSha256)) issues.push("evidence SHA-256 is missing or malformed");
  else if (identity.evidenceSha256 !== STEP05_EVIDENCE_SHA256) issues.push("evidence SHA-256 does not match the canonical real observation");
  if (!REVISION_PATTERN.test(identity.candidateRevision)) issues.push("candidate revision is missing or malformed");
  else if (identity.candidateRevision !== STEP05_REVIEW_CANDIDATE_REVISION) issues.push("candidate revision does not match the current four-item review identity");
  return { identity, valid: issues.length === 0, issues };
}

export function createStep05ReviewDraft(identity: Step05ReviewIdentity, reviewRound = 1): Step05ReviewDraft {
  return {
    schemaVersion: 1,
    reviewContractVersion: STEP05_REVIEW_CONTRACT_VERSION,
    initiativeId: "hanzi-radical-battle-v2",
    step: "05",
    reviewRound,
    identity,
    decisions: STEP05_REVIEW_ITEMS.map((item) => ({
      itemId: item.id,
      revisionHash: item.revisionHash,
      decision: "",
      notes: "",
      carriedForward: false,
    })),
    authorizeDefaultWorldEntry: "",
    authorizeSecondUseCheck: "",
    generalNotes: "",
  };
}

export function validateNotes(value: string): readonly string[] {
  const issues: string[] = [];
  if (value.length > 1_000) issues.push("notes must contain at most 1000 characters");
  if (NOTES_DENYLIST.test(value)) issues.push("notes contain a disallowed identity, path, or remote-address marker");
  return issues;
}

export function missingStep05ReviewFields(draft: Step05ReviewDraft): string[] {
  const missing: string[] = [];
  for (const item of STEP05_REVIEW_ITEMS) {
    const value = draft.decisions.find((decision) => decision.itemId === item.id);
    if (!value || value.revisionHash !== item.revisionHash) missing.push(`${item.id}.revisionHash`);
    if (!value || !item.allowedDecisions.includes(value.decision as never)) missing.push(`${item.id}.decision`);
    if (!value?.notes.trim()) missing.push(`${item.id}.notes`);
    if (value && validateNotes(value.notes).length) missing.push(`${item.id}.notesPrivacy`);
  }
  if (!draft.authorizeDefaultWorldEntry) missing.push("authorizeDefaultWorldEntry");
  if (!draft.authorizeSecondUseCheck) missing.push("authorizeSecondUseCheck");
  if (!draft.generalNotes.trim()) missing.push("generalNotes");
  if (validateNotes(draft.generalNotes).length) missing.push("generalNotesPrivacy");
  if (!COMMIT_PATTERN.test(draft.identity.candidateCommit)) missing.push("identity.candidateCommit");
  if (draft.identity.evidenceSha256 !== STEP05_EVIDENCE_SHA256) missing.push("identity.evidenceSha256");
  if (draft.identity.candidateRevision !== STEP05_REVIEW_CANDIDATE_REVISION) missing.push("identity.candidateRevision");
  return missing;
}

export function finalizeStep05ReviewDraft(
  draft: Step05ReviewDraft,
  now: Date = new Date(),
): Step05ParentReviewFeedback {
  const missing = missingStep05ReviewFields(draft);
  if (missing.length) throw new Error(`STEP 05 review is incomplete: ${missing.join(", ")}`);
  return {
    ...draft,
    decisions: draft.decisions as Step05ParentReviewFeedback["decisions"],
    authorizeDefaultWorldEntry: draft.authorizeDefaultWorldEntry as "YES" | "NO",
    authorizeSecondUseCheck: draft.authorizeSecondUseCheck as "YES" | "NO",
    reviewMeta: {
      completed: true,
      exportedAtUtc: now.toISOString(),
      missingRequiredFieldIds: [],
    },
  };
}

function isClosedStep05ParentReviewFeedback(value: unknown, requireCurrentIdentity: boolean): value is Step05ParentReviewFeedback {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "reviewContractVersion", "initiativeId", "step", "reviewRound", "identity",
    "decisions", "authorizeDefaultWorldEntry", "authorizeSecondUseCheck", "generalNotes", "reviewMeta",
  ])) return false;
  if (value.schemaVersion !== 1 || value.reviewContractVersion !== STEP05_REVIEW_CONTRACT_VERSION || value.initiativeId !== "hanzi-radical-battle-v2" || value.step !== "05") return false;
  if (!Number.isInteger(value.reviewRound) || (value.reviewRound as number) < 1) return false;
  if (!isRecord(value.identity) || !exactKeys(value.identity, ["candidateCommit", "evidenceSha256", "candidateRevision"])) return false;
  if (!COMMIT_PATTERN.test(String(value.identity.candidateCommit)) || !SHA256_PATTERN.test(String(value.identity.evidenceSha256)) || !REVISION_PATTERN.test(String(value.identity.candidateRevision))) return false;
  if (value.identity.evidenceSha256 !== STEP05_EVIDENCE_SHA256) return false;
  if (requireCurrentIdentity && value.identity.candidateRevision !== STEP05_REVIEW_CANDIDATE_REVISION) return false;
  if (!Array.isArray(value.decisions) || value.decisions.length !== STEP05_REVIEW_ITEM_IDS.length) return false;
  const decisions = value.decisions;
  for (const item of STEP05_REVIEW_ITEMS) {
    const decision = decisions.find((candidate) => isRecord(candidate) && candidate.itemId === item.id);
    if (!isRecord(decision) || !exactKeys(decision, ["itemId", "revisionHash", "decision", "notes", "carriedForward"])) return false;
    if (typeof decision.revisionHash !== "string" || !item.allowedDecisions.includes(decision.decision as never)) return false;
    if (requireCurrentIdentity && decision.revisionHash !== item.revisionHash) return false;
    if (typeof decision.notes !== "string" || !decision.notes.trim() || validateNotes(decision.notes).length) return false;
    if (typeof decision.carriedForward !== "boolean") return false;
  }
  if (!(["YES", "NO"] as const).includes(value.authorizeDefaultWorldEntry as never)) return false;
  if (!(["YES", "NO"] as const).includes(value.authorizeSecondUseCheck as never)) return false;
  if (typeof value.generalNotes !== "string" || !value.generalNotes.trim() || validateNotes(value.generalNotes).length) return false;
  if (!isRecord(value.reviewMeta) || !exactKeys(value.reviewMeta, ["completed", "exportedAtUtc", "missingRequiredFieldIds"])) return false;
  return value.reviewMeta.completed === true && typeof value.reviewMeta.exportedAtUtc === "string" && Array.isArray(value.reviewMeta.missingRequiredFieldIds) && value.reviewMeta.missingRequiredFieldIds.length === 0;
}

export function isStep05ParentReviewFeedback(value: unknown): value is Step05ParentReviewFeedback {
  return isClosedStep05ParentReviewFeedback(value, true);
}

export function carryForwardStep05Feedback(
  previous: unknown,
  identity: Step05ReviewIdentity,
  changedItemIds: readonly Step05ReviewItemId[] = [],
): Step05ReviewDraft {
  if (!isClosedStep05ParentReviewFeedback(previous, false)) return createStep05ReviewDraft(identity);
  const changed = new Set(changedItemIds);
  const previousById = new Map(previous.decisions.map((decision) => [decision.itemId, decision]));
  const next = createStep05ReviewDraft(identity, previous.reviewRound + 1);
  return {
    ...next,
    decisions: next.decisions.map((current) => {
      const item = STEP05_REVIEW_ITEMS.find((candidate) => candidate.id === current.itemId)!;
      const prior = previousById.get(current.itemId);
      const dependencyAffected = item.dependsOn.some((dependencyId) => {
        if (changed.has(dependencyId)) return true;
        const dependency = STEP05_REVIEW_ITEMS.find((candidate) => candidate.id === dependencyId)!;
        const priorDependency = previousById.get(dependencyId);
        return !priorDependency || priorDependency.revisionHash !== dependency.revisionHash;
      });
      if (
        !prior ||
        prior.decision !== "ACCEPT" ||
        prior.revisionHash !== item.revisionHash ||
        changed.has(item.id) ||
        dependencyAffected
      ) return current;
      return {
        ...current,
        decision: "ACCEPT",
        notes: prior.notes,
        carriedForward: true,
      };
    }),
    // Authorization and overall notes deliberately never carry forward.
    authorizeDefaultWorldEntry: "",
    authorizeSecondUseCheck: "",
    generalNotes: "",
  };
}

export function isCurrentStep05Draft(value: unknown, identity: Step05ReviewIdentity): value is Step05ReviewDraft {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.reviewContractVersion !== STEP05_REVIEW_CONTRACT_VERSION) return false;
  if (!isRecord(value.identity) || JSON.stringify(value.identity) !== JSON.stringify(identity)) return false;
  if (!Array.isArray(value.decisions) || value.decisions.length !== STEP05_REVIEW_ITEMS.length) return false;
  const decisions = value.decisions;
  return STEP05_REVIEW_ITEMS.every((item) => decisions.some((decision) => isRecord(decision) && decision.itemId === item.id && decision.revisionHash === item.revisionHash));
}

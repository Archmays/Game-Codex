export const SEMANTIC_REVIEWER_IDS = [
  "R1_CHILD_FIRST_UX",
  "R2_VISUAL_ACCESSIBILITY",
  "R3_ADVERSARIAL_QA",
] as const;

export const SEMANTIC_REVIEW_MODES = [
  "INDEPENDENT_MODEL",
  "INDEPENDENT_SUBAGENT",
  "RUBRIC_SEPARATED_SAME_MODEL",
] as const;

export const MACHINE_FINDING_SEVERITIES = ["SEV_1", "SEV_2", "SEV_3", "SEV_4"] as const;

export type SemanticReviewerId = (typeof SEMANTIC_REVIEWER_IDS)[number];
export type SemanticReviewMode = (typeof SEMANTIC_REVIEW_MODES)[number];
export type MachineFindingSeverity = (typeof MACHINE_FINDING_SEVERITIES)[number];

export interface SemanticReviewFinding {
  readonly id: string;
  readonly reviewer: SemanticReviewerId;
  readonly route: string;
  readonly state: string;
  readonly severity: MachineFindingSeverity;
  readonly category: string;
  readonly visibleEvidence: string;
  readonly whyItMatters: string;
  readonly suggestedFix: string;
  readonly confidence: number;
  readonly evidenceFiles: readonly string[];
}

export interface SemanticReviewDocument {
  readonly schemaVersion: 1;
  readonly sourceTreeSha256: string;
  readonly reviewer: SemanticReviewerId;
  readonly reviewEngine: string;
  readonly model: string;
  readonly reviewMode: SemanticReviewMode;
  readonly evidenceFiles: readonly string[];
  readonly completedAtUtc: string;
  readonly findings: readonly SemanticReviewFinding[];
  readonly limitations: readonly string[];
}

export interface SemanticReviewValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEvidencePath(value: unknown): value is string {
  if (!nonEmptyString(value) || value.length > 500) return false;
  if (/^(?:https?:|data:|file:)/i.test(value)) return false;
  return !value.includes("\0") && !/^looks good$/i.test(value.trim());
}

function isStringArray(value: unknown, validator: (entry: unknown) => entry is string = nonEmptyString): value is string[] {
  return Array.isArray(value) && value.every(validator);
}

function validateFinding(value: unknown, documentReviewer: SemanticReviewerId, index: number): string[] {
  const prefix = `findings[${index}]`;
  if (!isRecord(value)) return [`${prefix} must be an object`];
  const keys = [
    "id", "reviewer", "route", "state", "severity", "category", "visibleEvidence",
    "whyItMatters", "suggestedFix", "confidence", "evidenceFiles",
  ] as const;
  if (!exactKeys(value, keys)) return [`${prefix} must use the exact finding fields`];
  const errors: string[] = [];
  if (!nonEmptyString(value.id) || !/^[A-Z0-9][A-Z0-9_-]{2,79}$/i.test(value.id)) errors.push(`${prefix}.id is invalid`);
  if (value.reviewer !== documentReviewer) errors.push(`${prefix}.reviewer must match the document reviewer`);
  if (!nonEmptyString(value.route)) errors.push(`${prefix}.route is required`);
  if (!nonEmptyString(value.state)) errors.push(`${prefix}.state is required`);
  if (!MACHINE_FINDING_SEVERITIES.includes(value.severity as MachineFindingSeverity)) errors.push(`${prefix}.severity is invalid`);
  if (!nonEmptyString(value.category)) errors.push(`${prefix}.category is required`);
  if (!nonEmptyString(value.visibleEvidence) || /^looks good$/i.test(value.visibleEvidence.trim())) errors.push(`${prefix}.visibleEvidence must be concrete`);
  if (!nonEmptyString(value.whyItMatters)) errors.push(`${prefix}.whyItMatters is required`);
  if (!nonEmptyString(value.suggestedFix)) errors.push(`${prefix}.suggestedFix is required`);
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push(`${prefix}.confidence must be between 0 and 1`);
  if (!isStringArray(value.evidenceFiles, isEvidencePath) || value.evidenceFiles.length === 0) errors.push(`${prefix}.evidenceFiles must cite at least one local evidence file`);
  return errors;
}

export function validateSemanticReview(value: unknown): SemanticReviewValidation {
  if (!isRecord(value)) return { ok: false, errors: ["semantic review must be an object"] };
  const keys = [
    "schemaVersion", "sourceTreeSha256", "reviewer", "reviewEngine", "model", "reviewMode", "evidenceFiles",
    "completedAtUtc", "findings", "limitations",
  ] as const;
  if (!exactKeys(value, keys)) return { ok: false, errors: ["semantic review must use the exact schema fields"] };
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof value.sourceTreeSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.sourceTreeSha256)) errors.push("sourceTreeSha256 must be a full SHA-256");
  if (!SEMANTIC_REVIEWER_IDS.includes(value.reviewer as SemanticReviewerId)) errors.push("reviewer is invalid");
  if (!nonEmptyString(value.reviewEngine) || /(?:test|placeholder|unknown)/i.test(value.reviewEngine)) errors.push("reviewEngine must identify the actual review runtime");
  if (!nonEmptyString(value.model) || /(?:declared-test|placeholder|unknown)/i.test(value.model)) errors.push("model must honestly identify the actual model/runtime");
  if (!SEMANTIC_REVIEW_MODES.includes(value.reviewMode as SemanticReviewMode)) errors.push("reviewMode is invalid");
  if (!isStringArray(value.evidenceFiles, isEvidencePath) || value.evidenceFiles.length === 0) errors.push("evidenceFiles must cite real local evidence");
  if (!nonEmptyString(value.completedAtUtc) || Number.isNaN(Date.parse(value.completedAtUtc))) errors.push("completedAtUtc must be an ISO timestamp");
  if (!Array.isArray(value.findings)) errors.push("findings must be an array");
  if (!isStringArray(value.limitations)) errors.push("limitations must be an array of strings");
  if (Array.isArray(value.findings) && SEMANTIC_REVIEWER_IDS.includes(value.reviewer as SemanticReviewerId)) {
    value.findings.forEach((finding, index) => errors.push(...validateFinding(finding, value.reviewer as SemanticReviewerId, index)));
    const findingIds = value.findings
      .filter(isRecord)
      .map((finding) => finding.id)
      .filter(nonEmptyString);
    if (new Set(findingIds).size !== findingIds.length) errors.push("finding ids must be unique within a review");
  }
  return { ok: errors.length === 0, errors };
}

export function parseSemanticReview(value: unknown): SemanticReviewDocument {
  const validation = validateSemanticReview(value);
  if (!validation.ok) throw new Error(`Invalid semantic review: ${validation.errors.join("; ")}`);
  return value as unknown as SemanticReviewDocument;
}

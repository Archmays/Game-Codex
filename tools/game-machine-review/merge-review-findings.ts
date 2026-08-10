import {
  MACHINE_FINDING_SEVERITIES,
  SEMANTIC_REVIEWER_IDS,
  parseSemanticReview,
  type MachineFindingSeverity,
  type SemanticReviewDocument,
  type SemanticReviewFinding,
  type SemanticReviewerId,
} from "./semantic-review-schema";

export interface MergedSemanticReview {
  readonly schemaVersion: 1;
  readonly reviewers: readonly SemanticReviewerId[];
  readonly documents: readonly SemanticReviewDocument[];
  readonly findings: readonly SemanticReviewFinding[];
  readonly severityCounts: Readonly<Record<MachineFindingSeverity, number>>;
  readonly blockerFindingIds: readonly string[];
}

export function mergeSemanticReviewFindings(values: readonly unknown[]): MergedSemanticReview {
  const documents = values.map(parseSemanticReview);
  const reviewers = documents.map((document) => document.reviewer);
  const reviewerSet = new Set(reviewers);
  if (reviewerSet.size !== reviewers.length) throw new Error("Semantic reviewer documents must be unique");
  const missing = SEMANTIC_REVIEWER_IDS.filter((reviewer) => !reviewerSet.has(reviewer));
  const extra = reviewers.filter((reviewer) => !SEMANTIC_REVIEWER_IDS.includes(reviewer));
  if (missing.length > 0 || extra.length > 0 || documents.length !== SEMANTIC_REVIEWER_IDS.length) {
    throw new Error(`Exactly the three declared semantic reviewers are required; missing=${missing.join(",") || "none"}`);
  }

  const findings = documents.flatMap((document) => document.findings);
  const findingIds = findings.map((finding) => finding.id);
  if (new Set(findingIds).size !== findingIds.length) throw new Error("Semantic finding ids must be globally unique");
  const severityCounts = Object.fromEntries(MACHINE_FINDING_SEVERITIES.map((severity) => [severity, 0])) as Record<MachineFindingSeverity, number>;
  for (const finding of findings) severityCounts[finding.severity] += 1;
  return {
    schemaVersion: 1,
    reviewers: [...SEMANTIC_REVIEWER_IDS],
    documents,
    findings,
    severityCounts,
    blockerFindingIds: findings.filter((finding) => finding.severity === "SEV_1" || finding.severity === "SEV_2").map((finding) => finding.id),
  };
}

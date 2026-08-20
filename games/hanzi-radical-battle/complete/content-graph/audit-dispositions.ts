import { CANONICAL_WHEEL_LIBRARY } from "../../v2/wheel-workshop/library/canonical-wheel-library";
import type { AuditDisposition } from "./types";

const STATUS = {
  validated: "accepted",
  "corrected-derived-record": "corrected-derived",
  quarantined: "quarantined",
  "not-playable-context-only": "context-only",
} as const;

export const COMPLETE_AUDIT_DISPOSITIONS = CANONICAL_WHEEL_LIBRARY.map((record) => ({
  recordId: record.legacyId,
  status: STATUS[record.auditStatus],
  issueCodes: record.issueCodes,
  note: record.correctionNote ?? "冻结原始记录；审核派生层未发现需要改写的字段。",
  sourceIds: ["repo-wheel-audit"],
  revisionHash: record.revisionHash,
})) satisfies readonly AuditDisposition[];

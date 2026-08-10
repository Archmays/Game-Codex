import type { GoldenSliceStorageLike } from "../../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import { STEP07_EVIDENCE_ID, type Step06StopCode } from "./event-types";
import {
  STEP06_CANONICAL_ORIGIN,
  verifyStep06ProgressContinuity,
  type Step06ProgressContinuityProjection,
} from "./progress-continuity";
import {
  STEP06_GRANT_TTL_MS,
  STEP06_INTERVAL_BUCKETS,
  STEP06_PARENT_CANDIDATE_COMMIT,
  STEP06_PARENT_CANDIDATE_REVISION,
  STEP06_PARENT_EVIDENCE_SHA256,
  STEP06_PARENT_FEEDBACK_SHA256,
  type Step06EvidenceKind,
  type Step06IntervalBucket,
  type Step06SoundMode,
} from "./session";

export const STEP07_TECHNICAL_STATE = "MACHINE_QA_ACCEPTED_REAL_SECOND_USE_READY";
export const STEP07_FIXTURE_TECHNICAL_STATE = "SYNTHETIC_TOOLING_TEST_ONLY";

export interface Step07SessionGrant {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly evidenceKind: Step06EvidenceKind;
  readonly buildCommit: string;
  readonly machineVerdictSha256: string | null;
  readonly technicalState: typeof STEP07_TECHNICAL_STATE | typeof STEP07_FIXTURE_TECHNICAL_STATE;
  readonly parentFeedbackSha256: typeof STEP06_PARENT_FEEDBACK_SHA256;
  readonly parentCandidateCommit: typeof STEP06_PARENT_CANDIDATE_COMMIT;
  readonly parentEvidenceSha256: typeof STEP06_PARENT_EVIDENCE_SHA256;
  readonly parentCandidateRevision: typeof STEP06_PARENT_CANDIDATE_REVISION;
  readonly authorizeDefaultWorldEntry: "YES";
  readonly authorizeSecondUseCheck: "YES";
  readonly canonicalOrigin: typeof STEP06_CANONICAL_ORIGIN;
  readonly intervalBucket: Step06IntervalBucket;
  readonly soundMode: Exclude<Step06SoundMode, "CANCEL">;
  readonly progressContinuity: Step06ProgressContinuityProjection;
  readonly startedAtMs: number;
  readonly startedAtUtc: string;
  readonly expiresAtMs: number;
  readonly status: "AUTHORIZED" | "STOPPED" | "FINISHED";
  readonly stopCode?: Step06StopCode;
}

export type Step07RouteValidation =
  | { readonly ok: true; readonly grant: Step07SessionGrant }
  | { readonly ok: false; readonly reason: "NO_EVIDENCE_ROUTE" | "INVALID_ROUTE" | "INVALID_GRANT" | "GRANT_EXPIRED" | "GRANT_STOPPED" | "IDENTITY_MISMATCH" | "PROGRESS_CONTINUITY" };

function grantKey(sessionId: string): string {
  return `hanzi-v2-step07:grant:${sessionId}`;
}

function hasExactGrantIdentity(grant: Step07SessionGrant): boolean {
  return grant.schemaVersion === 1
    && (
      (grant.evidenceKind === "REAL_CHILD_SECOND_USE" && grant.technicalState === STEP07_TECHNICAL_STATE)
      || (grant.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY" && grant.technicalState === STEP07_FIXTURE_TECHNICAL_STATE)
    )
    && (
      (grant.evidenceKind === "REAL_CHILD_SECOND_USE" && typeof grant.machineVerdictSha256 === "string" && /^[a-f0-9]{64}$/i.test(grant.machineVerdictSha256))
      || (grant.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY" && grant.machineVerdictSha256 === null)
    )
    && grant.parentFeedbackSha256 === STEP06_PARENT_FEEDBACK_SHA256
    && grant.parentCandidateCommit === STEP06_PARENT_CANDIDATE_COMMIT
    && grant.parentEvidenceSha256 === STEP06_PARENT_EVIDENCE_SHA256
    && grant.parentCandidateRevision === STEP06_PARENT_CANDIDATE_REVISION
    && grant.authorizeDefaultWorldEntry === "YES"
    && grant.authorizeSecondUseCheck === "YES"
    && grant.canonicalOrigin === STEP06_CANONICAL_ORIGIN
    && /^[0-9a-f]{40}$/i.test(grant.buildCommit)
    && /^s07-[a-z0-9-]{8,64}$/.test(grant.sessionId)
    && STEP06_INTERVAL_BUCKETS.includes(grant.intervalBucket);
}

export function createStep07SessionId(random = Math.random): string {
  const tail = `${Date.now().toString(36)}-${Math.floor(random() * 0xffffff).toString(36).padStart(5, "0")}`;
  return `s07-${tail}`;
}

export function authorizeStep07Session(
  storage: GoldenSliceStorageLike,
  input: {
    readonly sessionId: string;
    readonly evidenceKind: Step06EvidenceKind;
    readonly buildCommit: string;
    readonly machineVerdictSha256: string | null;
    readonly intervalBucket: Step06IntervalBucket;
    readonly soundMode: Exclude<Step06SoundMode, "CANCEL">;
    readonly progressContinuity: Step06ProgressContinuityProjection;
    readonly nowMs?: number;
  },
): Step07SessionGrant {
  const nowMs = input.nowMs ?? Date.now();
  const grant: Step07SessionGrant = {
    schemaVersion: 1,
    sessionId: input.sessionId,
    evidenceKind: input.evidenceKind,
    buildCommit: input.buildCommit,
    machineVerdictSha256: input.machineVerdictSha256,
    technicalState: input.evidenceKind === "SYNTHETIC_TOOLING_TEST_ONLY"
      ? STEP07_FIXTURE_TECHNICAL_STATE
      : STEP07_TECHNICAL_STATE,
    parentFeedbackSha256: STEP06_PARENT_FEEDBACK_SHA256,
    parentCandidateCommit: STEP06_PARENT_CANDIDATE_COMMIT,
    parentEvidenceSha256: STEP06_PARENT_EVIDENCE_SHA256,
    parentCandidateRevision: STEP06_PARENT_CANDIDATE_REVISION,
    authorizeDefaultWorldEntry: "YES",
    authorizeSecondUseCheck: "YES",
    canonicalOrigin: STEP06_CANONICAL_ORIGIN,
    intervalBucket: input.intervalBucket,
    soundMode: input.soundMode,
    progressContinuity: input.progressContinuity,
    startedAtMs: nowMs,
    startedAtUtc: new Date(nowMs).toISOString(),
    expiresAtMs: nowMs + STEP06_GRANT_TTL_MS,
    status: "AUTHORIZED",
  };
  if (!hasExactGrantIdentity(grant)) throw new Error("BLOCK_STEP07_PARENT_AUTHORIZATION");
  storage.setItem(grantKey(grant.sessionId), JSON.stringify(grant));
  return grant;
}

export function readStep07Grant(storage: GoldenSliceStorageLike, sessionId: string): Step07SessionGrant | null {
  try {
    const raw = storage.getItem(grantKey(sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Step07SessionGrant;
    return hasExactGrantIdentity(value) ? value : null;
  } catch {
    return null;
  }
}

export function validateStep07InstrumentedRoute(
  search: URLSearchParams,
  origin: string,
  storage: GoldenSliceStorageLike,
  nowMs = Date.now(),
): Step07RouteValidation {
  const evidence = search.get("evidence");
  const sessionId = search.get("session");
  if (!evidence && !sessionId) return { ok: false, reason: "NO_EVIDENCE_ROUTE" };
  if (evidence !== STEP07_EVIDENCE_ID || !sessionId || !/^s07-[a-z0-9-]{8,64}$/.test(sessionId)) return { ok: false, reason: "INVALID_ROUTE" };
  const grant = readStep07Grant(storage, sessionId);
  if (!grant) return { ok: false, reason: "INVALID_GRANT" };
  if (grant.status !== "AUTHORIZED") return { ok: false, reason: "GRANT_STOPPED" };
  if (grant.expiresAtMs < nowMs) return { ok: false, reason: "GRANT_EXPIRED" };
  if (origin !== grant.canonicalOrigin) return { ok: false, reason: "IDENTITY_MISMATCH" };
  const continuity = verifyStep06ProgressContinuity(origin, storage);
  if (!continuity.ok || JSON.stringify(continuity.projection) !== JSON.stringify(grant.progressContinuity)) {
    return { ok: false, reason: "PROGRESS_CONTINUITY" };
  }
  return { ok: true, grant };
}

export function stopStep07Session(storage: GoldenSliceStorageLike, sessionId: string, stopCode: Step06StopCode): void {
  const grant = readStep07Grant(storage, sessionId);
  if (!grant || grant.status !== "AUTHORIZED") return;
  storage.setItem(grantKey(sessionId), JSON.stringify({ ...grant, status: "STOPPED", stopCode }));
}

export function finishStep07Session(storage: GoldenSliceStorageLike, sessionId: string): void {
  const grant = readStep07Grant(storage, sessionId);
  if (!grant || grant.status !== "STOPPED") return;
  storage.setItem(grantKey(sessionId), JSON.stringify({ ...grant, status: "FINISHED" }));
}

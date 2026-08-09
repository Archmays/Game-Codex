import type { GoldenSliceStorageLike } from "../../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import { STEP06_EVIDENCE_ID, type Step06StopCode } from "./event-types";
import {
  STEP06_CANONICAL_ORIGIN,
  verifyStep06ProgressContinuity,
  type Step06ProgressContinuityProjection,
} from "./progress-continuity";

export const STEP06_TECHNICAL_STATE = "DEFAULT_WORLD_ENTRY_PROMOTED_SECOND_USE_READY";
export const STEP06_PARENT_FEEDBACK_SHA256 = "AF3878C88F68344E2EF649774FCE24C46D2312824D91AD274628B85C8A6E0800";
export const STEP06_PARENT_CANDIDATE_COMMIT = "c46e660396257767692e94d61263b4662a11ccfb";
export const STEP06_PARENT_EVIDENCE_SHA256 = "EC04FECD4B04F294E7ED62139EBEE386F6B27B3FBC198EBCF3F6CD98341A86D8";
export const STEP06_PARENT_CANDIDATE_REVISION = "fnv1a:c9271099";
export const STEP06_GRANT_TTL_MS = 30 * 60 * 1000;

export const STEP06_INTERVAL_BUCKETS = [
  "SAME_DAY_SEPARATE_SESSION",
  "ONE_TO_THREE_DAYS",
  "FOUR_TO_SEVEN_DAYS",
  "MORE_THAN_SEVEN_DAYS",
] as const;
export type Step06IntervalBucket = (typeof STEP06_INTERVAL_BUCKETS)[number];

export const STEP06_SOUND_MODES = ["USE_EXISTING_SETTING", "START_MUTED", "CANCEL"] as const;
export type Step06SoundMode = (typeof STEP06_SOUND_MODES)[number];
export type Step06EvidenceKind = "REAL_CHILD_SECOND_USE" | "SYNTHETIC_TOOLING_TEST_ONLY";

export interface Step06SessionGrant {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly evidenceKind: Step06EvidenceKind;
  readonly buildCommit: string;
  readonly technicalState: typeof STEP06_TECHNICAL_STATE;
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

export interface Step06AuthorizedRoute {
  readonly ok: true;
  readonly grant: Step06SessionGrant;
}

export interface Step06DeniedRoute {
  readonly ok: false;
  readonly reason: "NO_EVIDENCE_ROUTE" | "INVALID_ROUTE" | "INVALID_GRANT" | "GRANT_EXPIRED" | "GRANT_STOPPED" | "IDENTITY_MISMATCH" | "PROGRESS_CONTINUITY";
}

function grantKey(sessionId: string): string {
  return `hanzi-v2-step06:grant:${sessionId}`;
}

function hasExactGrantIdentity(grant: Step06SessionGrant): boolean {
  return grant.schemaVersion === 1
    && grant.technicalState === STEP06_TECHNICAL_STATE
    && grant.parentFeedbackSha256 === STEP06_PARENT_FEEDBACK_SHA256
    && grant.parentCandidateCommit === STEP06_PARENT_CANDIDATE_COMMIT
    && grant.parentEvidenceSha256 === STEP06_PARENT_EVIDENCE_SHA256
    && grant.parentCandidateRevision === STEP06_PARENT_CANDIDATE_REVISION
    && grant.authorizeDefaultWorldEntry === "YES"
    && grant.authorizeSecondUseCheck === "YES"
    && grant.canonicalOrigin === STEP06_CANONICAL_ORIGIN
    && /^[0-9a-f]{40}$/i.test(grant.buildCommit)
    && /^s06-[a-z0-9-]{8,64}$/.test(grant.sessionId)
    && STEP06_INTERVAL_BUCKETS.includes(grant.intervalBucket);
}

export function createStep06SessionId(random = Math.random): string {
  const tail = `${Date.now().toString(36)}-${Math.floor(random() * 0xffffff).toString(36).padStart(5, "0")}`;
  return `s06-${tail}`;
}

export function authorizeStep06Session(
  storage: GoldenSliceStorageLike,
  input: {
    readonly sessionId: string;
    readonly evidenceKind: Step06EvidenceKind;
    readonly buildCommit: string;
    readonly intervalBucket: Step06IntervalBucket;
    readonly soundMode: Exclude<Step06SoundMode, "CANCEL">;
    readonly progressContinuity: Step06ProgressContinuityProjection;
    readonly nowMs?: number;
  },
): Step06SessionGrant {
  const nowMs = input.nowMs ?? Date.now();
  const grant: Step06SessionGrant = {
    schemaVersion: 1,
    sessionId: input.sessionId,
    evidenceKind: input.evidenceKind,
    buildCommit: input.buildCommit,
    technicalState: STEP06_TECHNICAL_STATE,
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
  if (!hasExactGrantIdentity(grant)) throw new Error("BLOCK_STEP06_PARENT_AUTHORIZATION");
  storage.setItem(grantKey(grant.sessionId), JSON.stringify(grant));
  return grant;
}

export function readStep06Grant(storage: GoldenSliceStorageLike, sessionId: string): Step06SessionGrant | null {
  try {
    const raw = storage.getItem(grantKey(sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Step06SessionGrant;
    return hasExactGrantIdentity(value) ? value : null;
  } catch {
    return null;
  }
}

export function validateStep06InstrumentedRoute(
  search: URLSearchParams,
  origin: string,
  storage: GoldenSliceStorageLike,
  nowMs = Date.now(),
): Step06AuthorizedRoute | Step06DeniedRoute {
  const evidence = search.get("evidence");
  const sessionId = search.get("session");
  if (!evidence && !sessionId) return { ok: false, reason: "NO_EVIDENCE_ROUTE" };
  if (evidence !== STEP06_EVIDENCE_ID || !sessionId || !/^s06-[a-z0-9-]{8,64}$/.test(sessionId)) return { ok: false, reason: "INVALID_ROUTE" };
  const grant = readStep06Grant(storage, sessionId);
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

export function stopStep06Session(storage: GoldenSliceStorageLike, sessionId: string, stopCode: Step06StopCode): void {
  const grant = readStep06Grant(storage, sessionId);
  if (!grant) return;
  storage.setItem(grantKey(sessionId), JSON.stringify({ ...grant, status: "STOPPED", stopCode }));
}

export function finishStep06Session(storage: GoldenSliceStorageLike, sessionId: string): void {
  const grant = readStep06Grant(storage, sessionId);
  if (!grant) return;
  storage.setItem(grantKey(sessionId), JSON.stringify({ ...grant, status: "FINISHED" }));
}

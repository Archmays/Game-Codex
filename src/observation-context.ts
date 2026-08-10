import { STEP06_EVIDENCE_ID, STEP07_EVIDENCE_ID } from "../apps/my-game-world/second-use/event-types";

export const STEP06_OBSERVATION_EVIDENCE = STEP06_EVIDENCE_ID;
export const STEP07_OBSERVATION_EVIDENCE = STEP07_EVIDENCE_ID;

export type ObservationContext =
  | { readonly kind: "step06"; readonly sessionId: string }
  | { readonly kind: "step07"; readonly sessionId: string }
  | { readonly kind: "none" }
  | { readonly kind: "invalid"; readonly reason: ObservationContextInvalidReason };

export type ObservationContextInvalidReason =
  | "DUPLICATE_EVIDENCE"
  | "DUPLICATE_SESSION"
  | "MISSING_SESSION"
  | "STEP06_SESSION_MISMATCH"
  | "STEP07_SESSION_MISMATCH"
  | "BARE_OBSERVATION_SESSION"
  | "UNSUPPORTED_OBSERVATION_EVIDENCE";

const STEP06_SESSION_PATTERN = /^s06-[a-z0-9-]{8,64}$/;
const STEP07_SESSION_PATTERN = /^s07-[a-z0-9-]{8,64}$/;

/**
 * Resolves only explicitly versioned second-use instrumentation routes.
 *
 * A bare `session` parameter is intentionally not enough to select STEP 06 or
 * STEP 07. Other flows (notably STEP 04 first-use) also use session parameters,
 * and normal routes must remain outside second-use instrumentation.
 */
export function resolveObservationContext(search: URLSearchParams): ObservationContext {
  const evidenceValues = search.getAll("evidence");
  const sessionValues = search.getAll("session");
  const evidence = evidenceValues[0] ?? null;

  if (evidenceValues.length > 1) return { kind: "invalid", reason: "DUPLICATE_EVIDENCE" };

  const isVersionedObservation = evidence === STEP06_OBSERVATION_EVIDENCE
    || evidence === STEP07_OBSERVATION_EVIDENCE;

  if (!isVersionedObservation) {
    if (evidence?.startsWith("hanzi-v2-step")) {
      return { kind: "invalid", reason: "UNSUPPORTED_OBSERVATION_EVIDENCE" };
    }
    if (sessionValues.some((sessionId) => STEP06_SESSION_PATTERN.test(sessionId) || STEP07_SESSION_PATTERN.test(sessionId))) {
      return { kind: "invalid", reason: "BARE_OBSERVATION_SESSION" };
    }
    return { kind: "none" };
  }

  if (sessionValues.length > 1) return { kind: "invalid", reason: "DUPLICATE_SESSION" };
  const sessionId = sessionValues[0];
  if (!sessionId) return { kind: "invalid", reason: "MISSING_SESSION" };

  if (evidence === STEP06_OBSERVATION_EVIDENCE) {
    return STEP06_SESSION_PATTERN.test(sessionId)
      ? { kind: "step06", sessionId }
      : { kind: "invalid", reason: "STEP06_SESSION_MISMATCH" };
  }

  return STEP07_SESSION_PATTERN.test(sessionId)
    ? { kind: "step07", sessionId }
    : { kind: "invalid", reason: "STEP07_SESSION_MISMATCH" };
}

import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { writeGoldenSliceSave, type GoldenSliceStorageLike } from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import { createStep06SyntheticCompleteSave, verifyStep06ProgressContinuity } from "../my-game-world/second-use/progress-continuity";
import { STEP07_EVIDENCE_ID } from "../my-game-world/second-use/event-types";
import type { Step06IntervalBucket, Step06SoundMode } from "../my-game-world/second-use/session";
import {
  authorizeStep07Session,
  createStep07SessionId,
  validateStep07InstrumentedRoute,
  type Step07RouteValidation,
  type Step07SessionGrant,
} from "../my-game-world/second-use/step07-session";

export const STEP07_FIXTURE_MARKER = "SYNTHETIC_TOOLING_TEST_ONLY";
export const STEP07_RUNTIME_GRANT_URL = "/step07-runtime-grant.json";
export const STEP07_OBSERVER_SESSION_QUERY = "observerSession";

type Step07RouteDenialReason = Extract<Step07RouteValidation, { readonly ok: false }>["reason"];

export type Step07ObserverSessionRecovery =
  | { readonly status: "NONE" }
  | { readonly status: "RECOVERED"; readonly grant: Step07SessionGrant }
  | {
    readonly status: "DENIED";
    readonly reason:
      | "DUPLICATE_OBSERVER_SESSION"
      | "INVALID_OBSERVER_SESSION"
      | "BUILD_IDENTITY_MISMATCH"
      | "EVIDENCE_KIND_MISMATCH"
      | Step07RouteDenialReason;
  };

export interface Step07RuntimeLaunchGrant {
  readonly schemaVersion: 1;
  readonly step: "07";
  readonly verdict: "PASS_MACHINE";
  readonly buildCommit: string;
  readonly verdictSha256: string;
  readonly launchNonce: string;
  readonly generatedAtUtc: string;
  readonly expiresAtUtc: string;
}

export function isStep07RuntimeLaunchGrant(
  value: unknown,
  expectedBuildCommit: string,
  expectedNonce: string,
  expectedVerdictSha256: string,
  nowMs = Date.now(),
): value is Step07RuntimeLaunchGrant {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const exactKeys = ["schemaVersion", "step", "verdict", "buildCommit", "verdictSha256", "launchNonce", "generatedAtUtc", "expiresAtUtc"];
  if (Object.keys(grant).sort().join("|") !== exactKeys.sort().join("|")) return false;
  if (grant.schemaVersion !== 1 || grant.step !== "07" || grant.verdict !== "PASS_MACHINE") return false;
  if (typeof grant.buildCommit !== "string" || grant.buildCommit.toLowerCase() !== expectedBuildCommit.toLowerCase()) return false;
  if (!/^[a-f0-9]{64}$/i.test(expectedVerdictSha256)) return false;
  if (typeof grant.verdictSha256 !== "string" || grant.verdictSha256.toLowerCase() !== expectedVerdictSha256.toLowerCase()) return false;
  if (typeof grant.launchNonce !== "string" || grant.launchNonce !== expectedNonce || !/^[a-f0-9]{32}$/i.test(grant.launchNonce)) return false;
  if (typeof grant.generatedAtUtc !== "string" || typeof grant.expiresAtUtc !== "string") return false;
  const generatedAtMs = Date.parse(grant.generatedAtUtc);
  const expiresAtMs = Date.parse(grant.expiresAtUtc);
  return Number.isFinite(generatedAtMs)
    && Number.isFinite(expiresAtMs)
    && generatedAtMs <= nowMs + 60_000
    && expiresAtMs > nowMs
    && expiresAtMs - generatedAtMs <= 30 * 60 * 1000;
}

export async function resolveStep07RuntimeLaunch(
  search: URLSearchParams,
  buildCommit: string,
  loader: () => Promise<unknown> = async () => {
    const response = await fetch(STEP07_RUNTIME_GRANT_URL, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`STEP07_RUNTIME_GRANT_HTTP_${response.status}`);
    return response.json();
  },
  nowMs = Date.now(),
): Promise<Step07RuntimeLaunchGrant | null> {
  const nonceValues = search.getAll("launch");
  const verdictShaValues = search.getAll("verdict");
  if (nonceValues.length !== 1 || !/^[a-f0-9]{32}$/i.test(nonceValues[0] ?? "")) return null;
  if (verdictShaValues.length !== 1 || !/^[a-f0-9]{64}$/i.test(verdictShaValues[0] ?? "")) return null;
  if (!/^[a-f0-9]{40}$/i.test(buildCommit)) return null;
  try {
    const value = await loader();
    return isStep07RuntimeLaunchGrant(value, buildCommit, nonceValues[0], verdictShaValues[0], nowMs) ? value : null;
  } catch {
    return null;
  }
}

export async function verifyStep07RuntimeLaunch(
  search: URLSearchParams,
  buildCommit: string,
  loader?: () => Promise<unknown>,
  nowMs = Date.now(),
): Promise<boolean> {
  return Boolean(await resolveStep07RuntimeLaunch(search, buildCommit, loader, nowMs));
}

export function isStep07FixtureRoute(search: URLSearchParams): boolean {
  return search.get("fixture") === STEP07_FIXTURE_MARKER;
}

export function prepareStep07FixtureProgress(storage: GoldenSliceStorageLike): boolean {
  if (storage.getItem(GOLDEN_SLICE_SAVE_KEY) !== null) return false;
  writeGoldenSliceSave(storage, createStep06SyntheticCompleteSave());
  return true;
}

export function preflightStep07Continuity(origin: string, storage: GoldenSliceStorageLike) {
  return verifyStep06ProgressContinuity(origin, storage);
}

/**
 * Recovers only an observer page's exact persisted STEP 07 session.
 * Child-route evidence/session parameters remain reserved for the child route.
 */
export function recoverStep07ObserverSession(input: {
  readonly search: URLSearchParams;
  readonly storage: GoldenSliceStorageLike;
  readonly origin: string;
  readonly fixture: boolean;
  readonly nowMs?: number;
}): Step07ObserverSessionRecovery {
  const sessionValues = input.search.getAll(STEP07_OBSERVER_SESSION_QUERY);
  if (sessionValues.length === 0) return { status: "NONE" };
  if (sessionValues.length !== 1) return { status: "DENIED", reason: "DUPLICATE_OBSERVER_SESSION" };

  const sessionId = sessionValues[0] ?? "";
  if (!/^s07-[a-z0-9-]{8,64}$/.test(sessionId)) {
    return { status: "DENIED", reason: "INVALID_OBSERVER_SESSION" };
  }

  const buildValues = input.search.getAll("build");
  if (buildValues.length !== 1 || !/^[a-f0-9]{40}$/i.test(buildValues[0] ?? "")) {
    return { status: "DENIED", reason: "BUILD_IDENTITY_MISMATCH" };
  }

  const childRouteIdentity = new URLSearchParams({
    evidence: STEP07_EVIDENCE_ID,
    session: sessionId,
  });
  const validation = validateStep07InstrumentedRoute(
    childRouteIdentity,
    input.origin,
    input.storage,
    input.nowMs,
  );
  if (!validation.ok) return { status: "DENIED", reason: validation.reason };
  if (validation.grant.buildCommit.toLowerCase() !== buildValues[0].toLowerCase()) {
    return { status: "DENIED", reason: "BUILD_IDENTITY_MISMATCH" };
  }

  const expectedEvidenceKind = input.fixture ? "SYNTHETIC_TOOLING_TEST_ONLY" : "REAL_CHILD_SECOND_USE";
  if (validation.grant.evidenceKind !== expectedEvidenceKind) {
    return { status: "DENIED", reason: "EVIDENCE_KIND_MISMATCH" };
  }
  return { status: "RECOVERED", grant: validation.grant };
}

export function startStep07AuthorizedSession(input: {
  readonly storage: GoldenSliceStorageLike;
  readonly origin: string;
  readonly buildCommit: string;
  readonly intervalBucket: Step06IntervalBucket;
  readonly soundMode: Step06SoundMode;
  readonly fixture: boolean;
  readonly privacyReady: boolean;
  readonly runtimeLaunchReady: boolean;
  readonly machineVerdictSha256: string | null;
}): Step07SessionGrant {
  if (!input.privacyReady) throw new Error("STEP07_PRIVACY_CONFIRMATION_REQUIRED");
  if (!input.fixture && !input.runtimeLaunchReady) throw new Error("STEP07_MACHINE_VERDICT_GRANT_REQUIRED");
  if (input.fixture ? input.machineVerdictSha256 !== null : !/^[a-f0-9]{64}$/i.test(input.machineVerdictSha256 ?? "")) {
    throw new Error("STEP07_MACHINE_VERDICT_IDENTITY_REQUIRED");
  }
  if (input.soundMode === "CANCEL") throw new Error("STEP 07 start cancelled");
  const continuity = verifyStep06ProgressContinuity(input.origin, input.storage);
  if (!continuity.ok) throw new Error("SECOND_USE_PROGRESS_CONTINUITY_BLOCKED");
  return authorizeStep07Session(input.storage, {
    sessionId: createStep07SessionId(),
    evidenceKind: input.fixture ? "SYNTHETIC_TOOLING_TEST_ONLY" : "REAL_CHILD_SECOND_USE",
    buildCommit: input.buildCommit,
    machineVerdictSha256: input.machineVerdictSha256,
    intervalBucket: input.intervalBucket,
    soundMode: input.soundMode,
    progressContinuity: continuity.projection,
  });
}

import { isFirstUseStopCode, type FirstUseStopCode } from "./event-types";

export const FIRST_USE_SESSION_SCHEMA_VERSION = 1 as const;
export const FIRST_USE_PARENT_FEEDBACK_SHA256 = "3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C";
export const FIRST_USE_ACCEPTED_REVIEW_IDENTITY_SHA256 = "DBA281F9954DFB591E2F3D7498B1B8F09F6C050BFBFA2436C9961B0513D73D3E";
export const FIRST_USE_SESSION_STORAGE_PREFIX = "family-games/hanzi-v2-step04/session:";
export const FIRST_USE_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export const FIRST_USE_AUDIO_CHOICES = ["SOUND_OK", "START_MUTED"] as const;
export const FIRST_USE_SESSION_MODES = ["LIVE_DASHBOARD", "COMPACT_AFTER_SESSION"] as const;
export const FIRST_USE_SESSION_STATUSES = ["PREPARED", "AUTHORIZED", "STOPPED", "FINISHED", "CANCELLED"] as const;

export type FirstUseAudioChoice = (typeof FIRST_USE_AUDIO_CHOICES)[number];
export type FirstUseSessionMode = (typeof FIRST_USE_SESSION_MODES)[number];
export type FirstUseSessionStatus = (typeof FIRST_USE_SESSION_STATUSES)[number];

export interface FirstUseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FirstUseSessionGrant {
  readonly schemaVersion: 1;
  readonly initiativeId: "hanzi-radical-battle-v2";
  readonly step: "04";
  readonly sessionId: string;
  readonly runSeed: string;
  readonly buildIdentitySha256: string;
  readonly parentFeedbackSha256: typeof FIRST_USE_PARENT_FEEDBACK_SHA256;
  readonly launchNonce: string;
  readonly sessionMode: FirstUseSessionMode | null;
  readonly fixture: boolean;
  readonly audioChoice: FirstUseAudioChoice | null;
  readonly readyConfirmed: boolean;
  readonly status: FirstUseSessionStatus;
  readonly expiresAtMs: number;
  readonly stopCode: FirstUseStopCode | null;
}

export interface PrepareFirstUseSessionInput {
  readonly sessionId: string;
  readonly runSeed: string;
  readonly buildIdentitySha256: string;
  readonly launchNonce: string;
  readonly fixture?: boolean;
  readonly expiresAtMs?: number;
}

export interface AuthorizeFirstUseSessionInput {
  readonly audioChoice: FirstUseAudioChoice;
  readonly sessionMode: FirstUseSessionMode;
  readonly readyConfirmed: true;
}

export type FirstUseSessionRouteValidation =
  | { readonly ok: true; readonly grant: FirstUseSessionGrant }
  | { readonly ok: false; readonly reason: string };

const SESSION_ID_PATTERN = /^s04-[a-f0-9]{32}$/;
const RUN_SEED_PATTERN = /^[a-f0-9]{16}$/;
const LAUNCH_NONCE_PATTERN = /^[a-f0-9]{32}$/;
const SHA256_PATTERN = /^[A-Fa-f0-9]{64}$/;

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

export function isFirstUseSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function isFirstUseRunSeed(value: unknown): value is string {
  return typeof value === "string" && RUN_SEED_PATTERN.test(value);
}

export function isFirstUseLaunchNonce(value: unknown): value is string {
  return typeof value === "string" && LAUNCH_NONCE_PATTERN.test(value);
}

export function firstUseSessionStorageKey(sessionId: string): string {
  if (!isFirstUseSessionId(sessionId)) throw new Error("Invalid STEP 04 session token");
  return `${FIRST_USE_SESSION_STORAGE_PREFIX}${sessionId}`;
}

export function isFirstUseSessionGrant(value: unknown): value is FirstUseSessionGrant {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const keys = [
    "schemaVersion", "initiativeId", "step", "sessionId", "runSeed", "buildIdentitySha256",
    "parentFeedbackSha256", "launchNonce", "sessionMode", "fixture", "audioChoice", "readyConfirmed",
    "status", "expiresAtMs", "stopCode",
  ];
  if (Object.keys(grant).length !== keys.length || keys.some((key) => !Object.hasOwn(grant, key))) return false;
  return grant.schemaVersion === FIRST_USE_SESSION_SCHEMA_VERSION &&
    grant.initiativeId === "hanzi-radical-battle-v2" &&
    grant.step === "04" &&
    isFirstUseSessionId(grant.sessionId) &&
    isFirstUseRunSeed(grant.runSeed) &&
    typeof grant.buildIdentitySha256 === "string" && SHA256_PATTERN.test(grant.buildIdentitySha256) &&
    grant.parentFeedbackSha256 === FIRST_USE_PARENT_FEEDBACK_SHA256 &&
    isFirstUseLaunchNonce(grant.launchNonce) &&
    (grant.sessionMode === null || isOneOf(grant.sessionMode, FIRST_USE_SESSION_MODES)) &&
    typeof grant.fixture === "boolean" &&
    (grant.audioChoice === null || isOneOf(grant.audioChoice, FIRST_USE_AUDIO_CHOICES)) &&
    typeof grant.readyConfirmed === "boolean" &&
    isOneOf(grant.status, FIRST_USE_SESSION_STATUSES) &&
    Number.isSafeInteger(grant.expiresAtMs) && (grant.expiresAtMs as number) > 0 &&
    (grant.stopCode === null || isFirstUseStopCode(grant.stopCode));
}

export function readFirstUseSessionGrant(storage: FirstUseStorage, sessionId: string): FirstUseSessionGrant | null {
  if (!isFirstUseSessionId(sessionId)) return null;
  const raw = storage.getItem(firstUseSessionStorageKey(sessionId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isFirstUseSessionGrant(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeGrant(storage: FirstUseStorage, grant: FirstUseSessionGrant): FirstUseSessionGrant {
  storage.setItem(firstUseSessionStorageKey(grant.sessionId), JSON.stringify(grant));
  return grant;
}

export function prepareFirstUseSession(
  storage: FirstUseStorage,
  input: PrepareFirstUseSessionInput,
  nowMs = Date.now(),
): FirstUseSessionGrant {
  if (!isFirstUseSessionId(input.sessionId)) throw new Error("Invalid STEP 04 session token");
  if (!isFirstUseRunSeed(input.runSeed)) throw new Error("Invalid STEP 04 run seed");
  if (!SHA256_PATTERN.test(input.buildIdentitySha256)) throw new Error("Invalid STEP 04 build identity SHA-256");
  if (!isFirstUseLaunchNonce(input.launchNonce)) throw new Error("Invalid STEP 04 launch nonce");
  const existing = readFirstUseSessionGrant(storage, input.sessionId);
  if (existing) {
    const identityMatches = existing.runSeed === input.runSeed &&
      existing.buildIdentitySha256.toUpperCase() === input.buildIdentitySha256.toUpperCase() &&
      existing.launchNonce === input.launchNonce && existing.fixture === Boolean(input.fixture);
    if (!identityMatches) throw new Error("STEP 04 session identity does not match the prepared local grant");
    return existing;
  }
  const expiresAtMs = input.expiresAtMs ?? nowMs + FIRST_USE_SESSION_TTL_MS;
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) throw new Error("Invalid STEP 04 session expiry");
  return writeGrant(storage, {
    schemaVersion: FIRST_USE_SESSION_SCHEMA_VERSION,
    initiativeId: "hanzi-radical-battle-v2",
    step: "04",
    sessionId: input.sessionId,
    runSeed: input.runSeed,
    buildIdentitySha256: input.buildIdentitySha256.toUpperCase(),
    parentFeedbackSha256: FIRST_USE_PARENT_FEEDBACK_SHA256,
    launchNonce: input.launchNonce,
    sessionMode: null,
    fixture: Boolean(input.fixture),
    audioChoice: null,
    readyConfirmed: false,
    status: "PREPARED",
    expiresAtMs,
    stopCode: null,
  });
}

export function authorizeFirstUseSession(
  storage: FirstUseStorage,
  sessionId: string,
  input: AuthorizeFirstUseSessionInput,
  nowMs = Date.now(),
): FirstUseSessionGrant {
  return authorizePreparedFirstUseSession(storage, sessionId, input, false, nowMs);
}

export function authorizeFixtureFirstUseSession(
  storage: FirstUseStorage,
  sessionId: string,
  input: AuthorizeFirstUseSessionInput,
  nowMs = Date.now(),
): FirstUseSessionGrant {
  return authorizePreparedFirstUseSession(storage, sessionId, input, true, nowMs);
}

function authorizePreparedFirstUseSession(
  storage: FirstUseStorage,
  sessionId: string,
  input: AuthorizeFirstUseSessionInput,
  fixture: boolean,
  nowMs: number,
): FirstUseSessionGrant {
  const grant = readFirstUseSessionGrant(storage, sessionId);
  if (!grant) throw new Error("No prepared STEP 04 session exists");
  if (grant.fixture !== fixture) {
    throw new Error(fixture
      ? "Fixture authorization requires a SYNTHETIC_TOOLING_TEST_ONLY session"
      : "SYNTHETIC_TOOLING_TEST_ONLY sessions cannot authorize a real child route");
  }
  if (grant.expiresAtMs <= nowMs) throw new Error("The STEP 04 session token has expired");
  if (grant.status !== "PREPARED") throw new Error(`STEP 04 session cannot be authorized from ${grant.status}`);
  if (input.readyConfirmed !== true) throw new Error("Parent READY confirmation is required");
  if (!isOneOf(input.audioChoice, FIRST_USE_AUDIO_CHOICES)) throw new Error("Audio preflight decision is required");
  if (!isOneOf(input.sessionMode, FIRST_USE_SESSION_MODES)) throw new Error("Observer mode is required");
  return writeGrant(storage, {
    ...grant,
    audioChoice: input.audioChoice,
    sessionMode: input.sessionMode,
    readyConfirmed: true,
    status: "AUTHORIZED",
  });
}

export function cancelFirstUseSession(storage: FirstUseStorage, sessionId: string): FirstUseSessionGrant | null {
  const grant = readFirstUseSessionGrant(storage, sessionId);
  if (!grant || grant.status === "FINISHED") return grant;
  return writeGrant(storage, { ...grant, status: "CANCELLED" });
}

export function markFirstUseSessionStopped(
  storage: FirstUseStorage,
  sessionId: string,
  stopCode: FirstUseStopCode,
): FirstUseSessionGrant | null {
  if (!isFirstUseStopCode(stopCode)) throw new Error("Invalid STEP 04 stop code");
  const grant = readFirstUseSessionGrant(storage, sessionId);
  if (!grant) return null;
  return writeGrant(storage, { ...grant, status: "STOPPED", stopCode });
}

export function markFirstUseSessionFinished(storage: FirstUseStorage, sessionId: string): FirstUseSessionGrant | null {
  const grant = readFirstUseSessionGrant(storage, sessionId);
  if (!grant) return null;
  return writeGrant(storage, { ...grant, status: "FINISHED" });
}

export function buildChildFirstUseRoute(grant: FirstUseSessionGrant): string {
  if (grant.status !== "AUTHORIZED" || !grant.readyConfirmed || !grant.audioChoice || !grant.sessionMode) {
    throw new Error("STEP 04 session is not authorized for the child route");
  }
  const params = new URLSearchParams({
    play: "hanzi-v2-golden-slice",
    mode: "child-first-use",
    session: grant.sessionId,
    seed: grant.runSeed,
  });
  if (grant.fixture) params.set("fixture", "1");
  return `?${params.toString()}`;
}

export function validateChildFirstUseSessionRoute(
  search: string | URLSearchParams,
  storage: FirstUseStorage,
  nowMs = Date.now(),
): FirstUseSessionRouteValidation {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  if (params.get("play") !== "hanzi-v2-golden-slice" || params.get("mode") !== "child-first-use") {
    return { ok: false, reason: "This is not the guarded STEP 04 child route" };
  }
  const fixtureParam = params.get("fixture");
  if (fixtureParam !== null && fixtureParam !== "1") {
    return { ok: false, reason: "Invalid synthetic fixture route marker" };
  }
  const fixtureRoute = fixtureParam === "1";
  const sessionId = params.get("session");
  const runSeed = params.get("seed");
  if (!isFirstUseSessionId(sessionId) || !isFirstUseRunSeed(runSeed)) {
    return { ok: false, reason: "Missing or invalid local session token" };
  }
  const grant = readFirstUseSessionGrant(storage, sessionId);
  if (!grant) return { ok: false, reason: "No matching local parent authorization exists" };
  if (grant.fixture !== fixtureRoute) {
    return { ok: false, reason: "The route fixture marker does not match the local parent authorization" };
  }
  if (grant.status !== "AUTHORIZED" || !grant.readyConfirmed || !grant.audioChoice || !grant.sessionMode) {
    return { ok: false, reason: "Parent READY and audio preflight are required" };
  }
  if (grant.expiresAtMs <= nowMs) return { ok: false, reason: "The local session token has expired" };
  if (grant.runSeed !== runSeed) return { ok: false, reason: "The run seed does not match the authorized session" };
  return { ok: true, grant };
}

export function firstUseSessionStartsMuted(grant: FirstUseSessionGrant): boolean {
  return grant.audioChoice === "START_MUTED";
}

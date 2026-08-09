import {
  authorizeFixtureFirstUseSession,
  authorizeFirstUseSession,
  buildChildFirstUseRoute,
  cancelFirstUseSession,
  isFirstUseLaunchNonce,
  isFirstUseRunSeed,
  isFirstUseSessionId,
  prepareFirstUseSession,
  type FirstUseAudioChoice,
  type FirstUseSessionGrant,
  type FirstUseSessionMode,
  type FirstUseStorage,
} from "../../games/hanzi-radical-battle/v2/golden-slice/first-use/session";

export interface ParentLaunchContext {
  readonly sessionId: string;
  readonly runSeed: string;
  readonly buildIdentitySha256: string;
  readonly launchNonce: string;
  readonly commitSha: string;
  readonly generatedAtUtc: string;
  readonly checkedAtUtc: string;
  readonly startedAtUtc: string;
  readonly fixture: boolean;
}

export type ParentLaunchParseResult =
  | { readonly ok: true; readonly context: ParentLaunchContext }
  | { readonly ok: false; readonly reason: string };

export interface ParentSessionControllerOptions {
  readonly search: string | URLSearchParams;
  readonly storage?: FirstUseStorage;
  readonly openChild?: (route: string, target: string) => Window | null;
  readonly nowMs?: () => number;
}

export interface ParentSessionController {
  readonly context: ParentLaunchContext;
  getGrant(): FirstUseSessionGrant;
  authorizeAndOpen(input: {
    readonly readyConfirmed: true;
    readonly audioChoice: FirstUseAudioChoice;
    readonly sessionMode: FirstUseSessionMode;
  }): { readonly grant: FirstUseSessionGrant; readonly childRoute: string; readonly childWindow: Window | null };
  cancel(): void;
}

const SHA256_PATTERN = /^[A-Fa-f0-9]{64}$/;
const COMMIT_PATTERN = /^[A-Fa-f0-9]{40}$/;

function queryIsoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || Number.isNaN(Date.parse(value))) return null;
  const normalized = new Date(value).toISOString();
  return normalized === value ? normalized : null;
}

export function parseParentLaunchContext(search: string | URLSearchParams): ParentLaunchParseResult {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  if (params.get("observe") !== "hanzi-v2-step04") return { ok: false, reason: "Not a STEP 04 observer route" };
  const sessionId = params.get("session");
  const runSeed = params.get("seed");
  const buildIdentitySha256 = params.get("build");
  const launchNonce = params.get("launch");
  const commitSha = params.get("commit");
  const generatedAtUtc = queryIsoDate(params.get("generated"));
  const checkedAtUtc = queryIsoDate(params.get("checked"));
  const startedAtUtc = queryIsoDate(params.get("started"));
  if (!isFirstUseSessionId(sessionId)) return { ok: false, reason: "Missing or invalid session token" };
  if (!isFirstUseRunSeed(runSeed)) return { ok: false, reason: "Missing or invalid run seed" };
  if (!buildIdentitySha256 || !SHA256_PATTERN.test(buildIdentitySha256)) return { ok: false, reason: "Missing or invalid build identity SHA-256" };
  if (!isFirstUseLaunchNonce(launchNonce)) return { ok: false, reason: "Missing or invalid launcher nonce" };
  if (!commitSha || !COMMIT_PATTERN.test(commitSha)) return { ok: false, reason: "Missing or invalid commit SHA" };
  if (!generatedAtUtc) return { ok: false, reason: "Missing or invalid build generated timestamp" };
  if (!checkedAtUtc) return { ok: false, reason: "Missing or invalid parent authorization timestamp" };
  if (!startedAtUtc) return { ok: false, reason: "Missing or invalid session start timestamp" };
  return {
    ok: true,
    context: {
      sessionId,
      runSeed,
      buildIdentitySha256: buildIdentitySha256.toUpperCase(),
      launchNonce,
      commitSha: commitSha.toLowerCase(),
      generatedAtUtc,
      checkedAtUtc,
      startedAtUtc,
      fixture: params.get("fixture") === "1",
    },
  };
}

function browserStorage(): FirstUseStorage {
  if (typeof window === "undefined") throw new Error("STEP 04 observer requires a browser localStorage");
  return window.localStorage;
}

export function createParentSessionController(options: ParentSessionControllerOptions): ParentSessionController {
  const parsed = parseParentLaunchContext(options.search);
  if (!parsed.ok) throw new Error(parsed.reason);
  const storage = options.storage ?? browserStorage();
  const nowMs = options.nowMs ?? (() => Date.now());
  const context = parsed.context;
  let grant = prepareFirstUseSession(storage, {
    sessionId: context.sessionId,
    runSeed: context.runSeed,
    buildIdentitySha256: context.buildIdentitySha256,
    launchNonce: context.launchNonce,
    fixture: context.fixture,
  }, nowMs());

  return {
    context,
    getGrant: () => grant,
    authorizeAndOpen(input) {
      grant = context.fixture
        ? authorizeFixtureFirstUseSession(storage, context.sessionId, input, nowMs())
        : authorizeFirstUseSession(storage, context.sessionId, input, nowMs());
      const childRoute = buildChildFirstUseRoute(grant);
      const openChild = options.openChild ?? ((route: string, target: string) => window.open(route, target, "noopener,noreferrer"));
      const childWindow = openChild(childRoute, `hanzi-v2-step04-child-${context.sessionId}`);
      return { grant, childRoute, childWindow };
    },
    cancel() {
      grant = cancelFirstUseSession(storage, context.sessionId) ?? grant;
    },
  };
}

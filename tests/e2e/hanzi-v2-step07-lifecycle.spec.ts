import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import type { GoldenSliceStorageLike } from "../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import { validateStep07InstrumentedRoute } from "../../apps/my-game-world/second-use/step07-session";
import type { Step06TechnicalEvent } from "../../apps/my-game-world/second-use/event-types";
import {
  buildStep07LifecycleEvidenceReport,
  validateStep07LifecycleEvidenceReport,
  type Step07ConflictResult,
  type Step07LifecycleEvidenceRow,
  type Step07RapidInputTransition,
  type Step07RouteIdentitySnapshot,
} from "../../tools/game-machine-review/step07-lifecycle-evidence";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const BASE_URL = "http://127.0.0.1:5175";
const BUILD_COMMIT = "c".repeat(40);
const FIXTURE_URL = `/?observe=hanzi-v2-step07&fixture=SYNTHETIC_TOOLING_TEST_ONLY&build=${BUILD_COMMIT}`;
const EVIDENCE_PATH = resolve("artifacts/game-machine-review/step-07/STEP07-LIFECYCLE-EVIDENCE.json");
const rows: Step07LifecycleEvidenceRow[] = [];
let sourceTreeSha256Before = "";

interface Diagnostics {
  readonly externalRequests: Set<string>;
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
}

interface StartedFixture {
  readonly observer: Page;
  readonly child: Page;
  readonly observerUrl: string;
  readonly sessionId: string;
}

class MemoryStorage implements GoldenSliceStorageLike {
  private readonly values = new Map<string, string>();
  constructor(entries: readonly (readonly [string, string])[]) {
    for (const [key, value] of entries) this.values.set(key, value);
  }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function observeDiagnostics(context: BrowserContext): Diagnostics {
  const diagnostics: Diagnostics = {
    externalRequests: new Set<string>(),
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
  context.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  context.on("weberror", (error) => diagnostics.pageErrors.push(error.error().message));
  context.on("request", (request) => {
    try {
      const url = new URL(request.url());
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== BASE_URL) {
        diagnostics.externalRequests.add(request.url());
      }
    } catch {
      // Non-URL browser internals are outside the HTTP network gate.
    }
  });
  context.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "UNKNOWN";
    try {
      if (new URL(request.url()).origin === BASE_URL && failure === "net::ERR_ABORTED") return;
    } catch {
      // Keep an unparseable failed request as a diagnostic.
    }
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
  });
  return diagnostics;
}

async function installSpeechStub(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class TestUtterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice = null;
      onend = null;
      onerror = null;
      constructor(text = "") { super(); this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: TestUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        cancel() {},
        pause() {},
        resume() {},
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
        speak() {},
        onvoiceschanged: null,
      },
    });
  });
}

async function startFixture(observer: Page, context: BrowserContext): Promise<StartedFixture> {
  await observer.goto(FIXTURE_URL);
  await expect(observer.getByTestId("step07-continuity")).toHaveAttribute("data-continuity", "pass");
  await observer.locator("[data-interval]").selectOption("ONE_TO_THREE_DAYS");
  await observer.locator("[data-sound]").selectOption("START_MUTED");
  await observer.locator("[data-privacy-ready]").check();
  const popup = observer.waitForEvent("popup");
  await observer.locator("[data-ready]").click();
  const child = await popup;
  await child.waitForLoadState("domcontentloaded");
  await expect(child.getByTestId("my-game-world")).toBeVisible();
  const observerUrl = observer.url();
  const observerIdentity = new URL(observerUrl);
  const childIdentity = new URL(child.url());
  const sessionId = childIdentity.searchParams.get("session") ?? "";
  expect(observerIdentity.searchParams.get("observerSession")).toBe(sessionId);
  expect(childIdentity.searchParams.get("evidence")).toBe("hanzi-v2-step07");
  expect(sessionId).toMatch(/^s07-/);
  await expect.poll(async () => (await readEventLog(child, sessionId)).length).toBeGreaterThanOrEqual(3);
  return { observer, child, observerUrl, sessionId };
}

async function readEventLog(page: Page, sessionId: string): Promise<Step06TechnicalEvent[]> {
  return page.evaluate((id) => {
    const value = localStorage.getItem(`hanzi-v2-step07:events:${id}`);
    return value ? JSON.parse(value) : [];
  }, sessionId);
}

async function stopFixture(observer: Page, child: Page): Promise<void> {
  await observer.locator("[data-stop-reason]").selectOption("NATURAL_END");
  await observer.locator("[data-stop]").click();
  await expect(observer.locator("[data-stop-status]")).toContainText("已结束");
  await expect(child.getByTestId("step07-child-stopped")).toBeVisible();
}

function rowBase(
  scenarioId: Step07LifecycleEvidenceRow["scenarioId"],
  testInfo: TestInfo,
  sessionId: string,
  eventLog: readonly Step06TechnicalEvent[],
  diagnostics: Diagnostics,
): Step07LifecycleEvidenceRow {
  return {
    schemaVersion: 1,
    scenarioId,
    sourceTreeSha256: computeMachineReviewSourceTreeSha256(),
    browserContextId: `${testInfo.project.name}:${scenarioId}`,
    pagesShareContext: true,
    sessionId,
    evidenceId: "hanzi-v2-step07",
    evidenceKind: "SYNTHETIC_TOOLING_TEST_ONLY",
    status: "PASS",
    eventLog,
    expectedExactEventTypes: null,
    disconnectWindowSequences: [],
    recoveredSequences: [],
    broadcastChannelMode: "NATIVE",
    observerRecoveryCount: 0,
    stopEffective: true,
    reloads: { observer: 0, child: 0, world: 0 },
    progressContinuityPreserved: true,
    history: null,
    conflicts: [],
    rapidInputTransitions: [],
    externalRequests: [...diagnostics.externalRequests].sort(),
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    failedRequests: diagnostics.failedRequests,
  };
}

async function routeSnapshot(page: Page, surface: "WORLD" | "FOREST", sessionId: string): Promise<Step07RouteIdentitySnapshot> {
  if (surface === "WORLD") await expect(page.getByTestId("my-game-world")).toBeVisible();
  else await expect(page.getByTestId("hanzi-v2-golden-slice")).toBeVisible();
  const url = new URL(page.url());
  return {
    surface,
    evidenceId: url.searchParams.get("evidence"),
    sessionId: url.searchParams.get("session"),
    denied: await page.locator("[data-testid$='route-denied']").count() > 0,
    step06Instrumentation: url.searchParams.get("evidence") === "hanzi-v2-step06"
      || await page.getByTestId("step06-route-denied").count() > 0,
  };
}

function slice(page: Page): Locator { return page.getByTestId("hanzi-v2-golden-slice"); }

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 20_000 });
}

async function primary(page: Page, name: string): Promise<void> {
  await slice(page).getByRole("button", { name, exact: true }).click();
}

async function place(page: Page, cardId: string, slotId: "left" | "right" | "top" | "bottom"): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

async function burst(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await target.dblclick({ delay: 0 });
}

function countEvent(events: readonly Step06TechnicalEvent[], eventType: string, metadata?: { phase?: string }): number {
  return events.filter((event) => event.eventType === eventType && (!metadata?.phase || event.safeMetadata.phase === metadata.phase)).length;
}

test.describe("Hanzi V2 STEP 07 lifecycle closure", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => { sourceTreeSha256Before = computeMachineReviewSourceTreeSha256(); });
  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The canonical lifecycle proof runs once on desktop Chromium.");
    await installSpeechStub(context);
  });
  test.afterAll(() => {
    const sourceTreeSha256After = computeMachineReviewSourceTreeSha256();
    const report = buildStep07LifecycleEvidenceReport({ rows, sourceTreeSha256Before, sourceTreeSha256After });
    const errors = validateStep07LifecycleEvidenceReport(report, sourceTreeSha256After);
    mkdirSync(resolve(EVIDENCE_PATH, ".."), { recursive: true });
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("L1 active connection delivers one exact ordered session", async ({ page, context }, testInfo) => {
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    await fixture.child.locator("[data-world-spellbook-open]").click();
    await expect(fixture.child.getByTestId("world-spellbook")).toBeVisible();
    await fixture.child.locator("[data-world-modal-close]").click();
    await stopFixture(fixture.observer, fixture.child);
    const events = await readEventLog(fixture.observer, fixture.sessionId);
    const expected = [
      "session_opened",
      "world_ready",
      "progress_continuity_verified",
      "world_first_action",
      "world_destination_opened",
      "world_spellbook_opened",
      "returned_to_world",
      "session_stopped",
    ] as const;
    expect(events.map((event) => event.eventType)).toEqual(expected);
    rows.push({ ...rowBase("L1_ACTIVE_CONNECTION", testInfo, fixture.sessionId, events, diagnostics), expectedExactEventTypes: expected });
  });

  test("L2 observer disconnect never blocks play and exact events recover", async ({ page, context }, testInfo) => {
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    const initialLastSequence = (await readEventLog(fixture.child, fixture.sessionId)).at(-1)?.sequence ?? 0;
    await fixture.observer.close();
    await fixture.child.locator("[data-world-spellbook-open]").click();
    await expect(fixture.child.getByTestId("world-spellbook")).toBeVisible();
    await fixture.child.locator("[data-world-modal-close]").click();
    const disconnectedEvents = await readEventLog(fixture.child, fixture.sessionId);
    const disconnectWindowSequences = disconnectedEvents
      .filter((event) => event.sequence > initialLastSequence)
      .map((event) => event.sequence);
    expect(disconnectWindowSequences.length).toBeGreaterThan(0);

    const recoveredObserver = await context.newPage();
    await recoveredObserver.goto(fixture.observerUrl);
    await expect(recoveredObserver.locator("[data-ready-status]")).toContainText("STEP07_SESSION_RECOVERED");
    const recoveredBeforeStop = await readEventLog(recoveredObserver, fixture.sessionId);
    for (const sequence of disconnectWindowSequences) {
      expect(recoveredBeforeStop.some((event) => event.sequence === sequence)).toBe(true);
    }
    await stopFixture(recoveredObserver, fixture.child);
    const events = await readEventLog(recoveredObserver, fixture.sessionId);
    rows.push({
      ...rowBase("L2_DISCONNECT_CONTINUE_RECOVER", testInfo, fixture.sessionId, events, diagnostics),
      disconnectWindowSequences,
      recoveredSequences: events.map((event) => event.sequence),
      observerRecoveryCount: 1,
    });
  });

  test("L3 declared BroadcastChannel failure uses the storage-event fallback", async ({ page, context }, testInfo) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, "BroadcastChannel", { configurable: true, value: undefined });
    });
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    await fixture.child.locator("[data-world-spellbook-open]").click();
    await expect.poll(async () => fixture.observer.locator('[data-derived="spellbook"]').textContent()).toBe("true");
    await fixture.child.locator("[data-world-modal-close]").click();
    await stopFixture(fixture.observer, fixture.child);
    const events = await readEventLog(fixture.observer, fixture.sessionId);
    rows.push({
      ...rowBase("L3_BROADCASTCHANNEL_STORAGE_FALLBACK", testInfo, fixture.sessionId, events, diagnostics),
      expectedExactEventTypes: events.map((event) => event.eventType),
      broadcastChannelMode: "STORAGE_EVENT_FALLBACK",
    });
  });

  test("L4 observer, child, and world reloads preserve one grant and progress", async ({ page, context }, testInfo) => {
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    await fixture.observer.reload();
    await expect(fixture.observer.locator("[data-ready-status]")).toContainText("STEP07_SESSION_RECOVERED");

    await fixture.child.locator("[data-world-forest-link]").click();
    await expect(slice(fixture.child)).toBeVisible();
    await fixture.child.reload();
    await expect(slice(fixture.child)).toBeVisible();
    const worldUrl = `/?world=my-game-world&evidence=hanzi-v2-step07&session=${encodeURIComponent(fixture.sessionId)}&from=forest`;
    await fixture.child.goto(worldUrl);
    await expect(fixture.child.getByTestId("my-game-world")).toBeVisible();
    await fixture.child.reload();
    await expect(fixture.child.getByTestId("my-game-world")).toBeVisible();
    expect(new URL(fixture.child.url()).searchParams.get("session")).toBe(fixture.sessionId);
    await stopFixture(fixture.observer, fixture.child);
    const events = await readEventLog(fixture.observer, fixture.sessionId);
    rows.push({
      ...rowBase("L4_RELOAD_CONTINUITY", testInfo, fixture.sessionId, events, diagnostics),
      observerRecoveryCount: 1,
      reloads: { observer: 1, child: 1, world: 1 },
    });
  });

  test("L5 ordinary back and forward navigation keeps STEP 07 route identity", async ({ page, context }, testInfo) => {
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    const history: Step07RouteIdentitySnapshot[] = [await routeSnapshot(fixture.child, "WORLD", fixture.sessionId)];
    await fixture.child.locator("[data-world-forest-link]").click();
    history.push(await routeSnapshot(fixture.child, "FOREST", fixture.sessionId));
    const worldUrl = `/?world=my-game-world&evidence=hanzi-v2-step07&session=${encodeURIComponent(fixture.sessionId)}&from=forest`;
    await fixture.child.goto(worldUrl);
    history.push(await routeSnapshot(fixture.child, "WORLD", fixture.sessionId));
    await fixture.child.goBack();
    history.push(await routeSnapshot(fixture.child, "FOREST", fixture.sessionId));
    await fixture.child.goForward();
    history.push(await routeSnapshot(fixture.child, "WORLD", fixture.sessionId));
    await stopFixture(fixture.observer, fixture.child);
    const events = await readEventLog(fixture.observer, fixture.sessionId);
    rows.push({
      ...rowBase("L5_ORDINARY_HISTORY_BACK_FORWARD", testInfo, fixture.sessionId, events, diagnostics),
      history: { navigationKind: "ORDINARY_HISTORY", bfcacheClaimed: false, entries: history },
    });
  });

  test("L6 every wrong route, grant, origin, expiry, and progress identity fails closed", async ({ page, context }, testInfo) => {
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    const conflictResults: Step07ConflictResult[] = [];
    const assertBrowserDenial = async (url: string, caseId: Step07ConflictResult["caseId"], reason: string) => {
      await fixture.child.goto(url);
      const denial = fixture.child.locator(`[data-reason="${reason}"]`);
      await expect(denial).toBeVisible();
      conflictResults.push({ caseId, denied: true, denialReason: reason });
    };
    await assertBrowserDenial(`/?evidence=hanzi-v2-step06&session=${fixture.sessionId}`, "STEP06_EVIDENCE_STEP07_SESSION", "STEP06_SESSION_MISMATCH");
    await assertBrowserDenial("/?evidence=hanzi-v2-step07&session=s06-conflict99", "STEP07_EVIDENCE_STEP06_SESSION", "STEP07_SESSION_MISMATCH");
    await assertBrowserDenial(`/?session=${fixture.sessionId}`, "BARE_SESSION", "BARE_OBSERVATION_SESSION");
    await assertBrowserDenial(`/?evidence=hanzi-v2-step99&session=${fixture.sessionId}`, "UNKNOWN_EVIDENCE", "UNSUPPORTED_OBSERVATION_EVIDENCE");

    const grantKey = `hanzi-v2-step07:grant:${fixture.sessionId}`;
    const [saveJson, grantJson] = await fixture.observer.evaluate(([save, grant]) => [localStorage.getItem(save), localStorage.getItem(grant)], [GOLDEN_SLICE_SAVE_KEY, grantKey] as const);
    if (!saveJson || !grantJson) throw new Error("L6 requires the canonical save and grant");
    const route = new URLSearchParams({ evidence: "hanzi-v2-step07", session: fixture.sessionId });
    const storage = new MemoryStorage([[GOLDEN_SLICE_SAVE_KEY, saveJson], [grantKey, grantJson]]);
    expect(validateStep07InstrumentedRoute(route, "http://wrong-origin.invalid", storage)).toEqual({ ok: false, reason: "IDENTITY_MISMATCH" });
    conflictResults.push({ caseId: "WRONG_ORIGIN", denied: true, denialReason: "IDENTITY_MISMATCH" });

    const grant = JSON.parse(grantJson) as { expiresAtMs: number };
    await fixture.child.evaluate(([key, json]) => {
      const value = JSON.parse(json);
      value.expiresAtMs = 0;
      localStorage.setItem(key, JSON.stringify(value));
    }, [grantKey, grantJson] as const);
    await assertBrowserDenial(`/?evidence=hanzi-v2-step07&session=${fixture.sessionId}`, "EXPIRED_GRANT", "GRANT_EXPIRED");

    await fixture.child.evaluate(([key, json]) => localStorage.setItem(key, json), [grantKey, "{}"] as const);
    await assertBrowserDenial(`/?evidence=hanzi-v2-step07&session=${fixture.sessionId}`, "INVALID_GRANT", "INVALID_GRANT");

    await fixture.child.evaluate(([saveKey, originalGrant, activeGrantKey]) => {
      localStorage.setItem(activeGrantKey, originalGrant);
      localStorage.removeItem(saveKey);
    }, [GOLDEN_SLICE_SAVE_KEY, grantJson, grantKey] as const);
    await assertBrowserDenial(`/?evidence=hanzi-v2-step07&session=${fixture.sessionId}`, "MISSING_CANONICAL_COMPLETED_SAVE", "PROGRESS_CONTINUITY");
    expect(grant.expiresAtMs).toBeGreaterThan(Date.now());

    await fixture.child.evaluate(([saveKey, save, activeGrantKey, activeGrant]) => {
      localStorage.setItem(saveKey, save);
      localStorage.setItem(activeGrantKey, activeGrant);
    }, [GOLDEN_SLICE_SAVE_KEY, saveJson, grantKey, grantJson] as const);
    await fixture.child.goto(`/?world=my-game-world&evidence=hanzi-v2-step07&session=${fixture.sessionId}`);
    await expect(fixture.child.getByTestId("my-game-world")).toBeVisible();
    await stopFixture(fixture.observer, fixture.child);
    const events = await readEventLog(fixture.observer, fixture.sessionId);
    rows.push({
      ...rowBase("L6_CONFLICT_FAIL_CLOSED", testInfo, fixture.sessionId, events, diagnostics),
      conflicts: conflictResults,
    });
  });

  test("rapid repeated input is accepted once at all six transition boundaries", async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const diagnostics = observeDiagnostics(context);
    const fixture = await startFixture(page, context);
    await fixture.child.locator("[data-world-forest-link]").click();
    await expect(slice(fixture.child)).toBeVisible();
    await primary(fixture.child, "走进墨林");
    await primary(fixture.child, "看看营地灯");
    await primary(fixture.child, "沿着灯路出发");
    await primary(fixture.child, "跳过小路");
    const transitions: Step07RapidInputTransition[] = [];
    await burst(slice(fixture.child).getByRole("button", { name: "开始合字施法", exact: true }));
    await waitForPhase(fixture.child, "battle_1_placing");
    let events = await readEventLog(fixture.child, fixture.sessionId);
    const selectionCount = countEvent(events, "golden_phase_entered", { phase: "battle_1_placing" });
    transitions.push({
      transitionId: "SELECTION_INPUT_LOCK",
      dispatchCount: 2,
      acceptedTransitionCount: selectionCount,
      duplicateTransitionEventCount: Math.max(0, selectionCount - 1),
      finalState: "battle_1_placing",
    });

    await fixture.child.getByTestId("component-card-ming-ri").click();
    await fixture.child.getByTestId("slot-left").click();
    await expect(fixture.child.getByTestId("slot-left")).toContainText("日");
    await fixture.child.getByTestId("component-card-ming-yue").click();
    await burst(fixture.child.getByTestId("slot-right"));
    await waitForPhase(fixture.child, "battle_1_cleared");
    events = await readEventLog(fixture.child, fixture.sessionId);
    transitions.push({
      transitionId: "PLACEMENT_INPUT_LOCK",
      dispatchCount: 2,
      acceptedTransitionCount: countEvent(events, "golden_phase_entered", { phase: "battle_1_cleared" }),
      duplicateTransitionEventCount: Math.max(0, countEvent(events, "golden_phase_entered", { phase: "battle_1_cleared" }) - 1),
      finalState: "battle_1_cleared",
    });

    await primary(fixture.child, "看看光留下什么");
    await primary(fixture.child, "继续看前路");
    await primary(fixture.child, "跳过花径");
    await primary(fixture.child, "试试新的结构");
    await place(fixture.child, "hua-cao", "top");
    await place(fixture.child, "hua-hua", "bottom");
    await primary(fixture.child, "看看三道光");
    await waitForPhase(fixture.child, "ability_choice");
    await burst(fixture.child.getByTestId("ability-ink-echo"));
    await waitForPhase(fixture.child, "travel_to_boss");
    events = await readEventLog(fixture.child, fixture.sessionId);
    const abilityCount = countEvent(events, "ability_selected");
    transitions.push({ transitionId: "ABILITY_CHOICE_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: abilityCount, duplicateTransitionEventCount: Math.max(0, abilityCount - 1), finalState: "travel_to_boss" });

    await primary(fixture.child, "走向双印墨守");
    await primary(fixture.child, "先看清它的动作");
    await place(fixture.child, "lin-mu-left", "left");
    await waitForPhase(fixture.child, "boss_interference");
    await fixture.child.locator("[data-ink-echo-voice]").click();
    await waitForPhase(fixture.child, "boss_phase_1_placing");
    await place(fixture.child, "lin-mu-right", "right");
    await primary(fixture.child, "解开第二枚墨印");
    await place(fixture.child, "xing-ri", "top");
    await waitForPhase(fixture.child, "boss_phase_2_placing");
    await fixture.child.getByTestId("component-card-xing-sheng").click();
    await burst(fixture.child.getByTestId("slot-bottom"));
    await waitForPhase(fixture.child, "boss_cleared");
    events = await readEventLog(fixture.child, fixture.sessionId);
    const bossCount = countEvent(events, "golden_phase_entered", { phase: "boss_cleared" });
    transitions.push({ transitionId: "BOSS_COMPLETION_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: bossCount, duplicateTransitionEventCount: Math.max(0, bossCount - 1), finalState: "boss_cleared" });

    await primary(fixture.child, "沿星路回营地");
    await primary(fixture.child, "翻开四字魔法书");
    await waitForPhase(fixture.child, "spellbook_review");
    await burst(slice(fixture.child).getByRole("button", { name: "让营地继续亮着", exact: true }));
    await waitForPhase(fixture.child, "run_complete");
    events = await readEventLog(fixture.child, fixture.sessionId);
    const completedCount = countEvent(events, "golden_run_completed");
    transitions.push({ transitionId: "FINISH_RUN_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: completedCount, duplicateTransitionEventCount: Math.max(0, completedCount - 1), finalState: "run_complete" });

    await burst(fixture.child.locator("[data-return-to-world]"));
    await expect(fixture.child.getByTestId("my-game-world")).toBeVisible();
    await expect.poll(async () => countEvent(await readEventLog(fixture.child, fixture.sessionId), "returned_to_world")).toBeGreaterThanOrEqual(1);
    events = await readEventLog(fixture.child, fixture.sessionId);
    const returnedCount = countEvent(events, "returned_to_world");
    transitions.push({ transitionId: "RETURN_WORLD_INPUT_LOCK", dispatchCount: 2, acceptedTransitionCount: returnedCount, duplicateTransitionEventCount: Math.max(0, returnedCount - 1), finalState: "WORLD" });
    expect(transitions.every((entry) => entry.acceptedTransitionCount === 1 && entry.duplicateTransitionEventCount === 0)).toBe(true);

    await stopFixture(fixture.observer, fixture.child);
    events = await readEventLog(fixture.observer, fixture.sessionId);
    rows.push({
      ...rowBase("RAPID_INPUT_TRANSITIONS", testInfo, fixture.sessionId, events, diagnostics),
      rapidInputTransitions: transitions,
    });
  });
});

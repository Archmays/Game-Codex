import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save";
import type { AbilityId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import {
  RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE,
  RUN_COMPLETE_CRITICAL_CONTROL_ROUTE,
  RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS,
  RUN_COMPLETE_CRITICAL_CONTROL_STATE,
  validateCriticalControlEvidenceReport,
  type CriticalActivationCheck,
  type CriticalActivationControlKind,
  type CriticalActivationInput,
  type CriticalControlEvidenceReport,
  type CriticalControlScenarioResult,
  type KeyboardNavigationCheck,
} from "../../tools/game-machine-review/critical-control-evidence";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const BASE_URL = "http://127.0.0.1:5175";
const EVIDENCE_ROOT = resolve("artifacts/game-machine-review/step-07/critical-control");
const SCREENSHOT_ROOT = resolve(EVIDENCE_ROOT, "screenshots");
const REPORT_PATH = resolve("artifacts/game-machine-review/step-07/RUN-COMPLETE-CONTROL-EVIDENCE.json");
const ABILITY_IDS: readonly AbilityId[] = ["guardian-light", "star-path", "ink-echo"];

const ACTIVATION_PLAN: Record<string, { readonly input: CriticalActivationInput; readonly controlKind: CriticalActivationControlKind }> = {
  "320x568--guardian-light": { input: "KEYBOARD_SPACE", controlKind: "REPLAY_A" },
  "390x844--guardian-light": { input: "MOBILE_TOUCH", controlKind: "REPLAY_A" },
  "390x844--star-path": { input: "MOBILE_TOUCH", controlKind: "REPLAY_B" },
  "390x844--ink-echo": { input: "MOBILE_TOUCH", controlKind: "RETURN" },
  "768x1024--guardian-light": { input: "KEYBOARD_ENTER", controlKind: "RETURN" },
  "1440x900--guardian-light": { input: "DESKTOP_POINTER", controlKind: "REPLAY_A" },
  "1440x900--star-path": { input: "DESKTOP_POINTER", controlKind: "REPLAY_B" },
  "1440x900--ink-echo": { input: "DESKTOP_POINTER", controlKind: "RETURN" },
};

function artifactPath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function slice(page: Page): Locator {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 15_000 });
}

async function primary(page: Page, name: string): Promise<void> {
  await slice(page).getByRole("button", { name, exact: true }).click();
}

async function place(page: Page, cardId: string, slotId: "left" | "right" | "top" | "bottom"): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

async function installSpeechStub(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class FixtureUtterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisEvent) => unknown) | null = null;
      onerror: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisErrorEvent) => unknown) | null = null;
      constructor(text = "") { super(); this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FixtureUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        getVoices: () => [],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
        speak: (utterance: FixtureUtterance) => window.setTimeout(() => utterance.onend?.call(
          utterance as unknown as SpeechSynthesisUtterance,
          new Event("end") as SpeechSynthesisEvent,
        ), 0),
        onvoiceschanged: null,
      },
    });
  });
}

function observeDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(request.url());
  });
  return { consoleErrors, pageErrors, failedRequests, externalRequests };
}

async function completeRun(page: Page, selectedAbilityId: AbilityId, route = `/${RUN_COMPLETE_CRITICAL_CONTROL_ROUTE}`): Promise<void> {
  await page.goto(route);
  await expect(slice(page)).toHaveAttribute("data-reduced-motion", "true");
  await primary(page, "走进墨林");
  await primary(page, "看看营地灯");
  await primary(page, "沿着灯路出发");
  await primary(page, "跳过小路");
  await primary(page, "开始合字施法");
  await waitForPhase(page, "battle_1_placing");
  await place(page, "ming-ri", "left");
  await place(page, "ming-yue", "right");
  await waitForPhase(page, "battle_1_cleared");
  await primary(page, "看看光留下什么");
  await waitForPhase(page, "breather_1");
  await primary(page, "继续看前路");
  await primary(page, "跳过花径");
  await primary(page, "试试新的结构");
  await place(page, "hua-cao", "top");
  await place(page, "hua-hua", "bottom");
  await waitForPhase(page, "battle_2_cleared");
  await primary(page, "看看三道光");
  await waitForPhase(page, "ability_choice");
  await page.getByTestId(`ability-${selectedAbilityId}`).click();
  await primary(page, "走向双印墨守");
  await primary(page, "先看清它的动作");
  await place(page, "lin-mu-left", "left");
  await waitForPhase(page, "boss_interference");
  if (selectedAbilityId === "ink-echo") await page.locator("[data-ink-echo-voice]").click();
  await waitForPhase(page, "boss_phase_1_placing");
  await place(page, "lin-mu-right", "right");
  await waitForPhase(page, "boss_phase_1_cleared");
  await primary(page, "解开第二枚墨印");
  await place(page, "xing-ri", "top");
  await waitForPhase(page, "boss_phase_2_placing");
  await place(page, "xing-sheng", "bottom");
  await waitForPhase(page, "boss_cleared");
  await primary(page, "沿星路回营地");
  await waitForPhase(page, "camp_repair");
  await primary(page, "翻开四字魔法书");
  await waitForPhase(page, "spellbook_review");
  await page.locator("[data-finish-run]").click();
  await waitForPhase(page, RUN_COMPLETE_CRITICAL_CONTROL_STATE);
}

async function measureScenario(
  page: Page,
  scenario: (typeof RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS)[number],
  sourceTreeSha256: string,
  screenshot: string,
): Promise<CriticalControlScenarioResult> {
  const measured = await page.getByTestId("run-complete").evaluate((cardElement) => {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const rectValue = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) };
    };
    const elements = [
      ...cardElement.querySelectorAll<HTMLElement>("[data-replay-ability]"),
      ...cardElement.querySelectorAll<HTMLElement>("[data-return-to-world]"),
    ];
    const controls = elements.map((element) => {
      const style = getComputedStyle(element);
      const abilityId = element.dataset.replayAbility ?? null;
      return {
        selector: abilityId ? `[data-replay-ability="${abilityId}"]` : "[data-return-to-world]",
        label: element.textContent?.trim() ?? "",
        kind: abilityId ? "REPLAY" as const : "RETURN" as const,
        abilityId,
        ...rectValue(element),
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      };
    });
    const right = (rect: { x: number; width: number }) => rect.x + rect.width;
    const bottom = (rect: { y: number; height: number }) => rect.y + rect.height;
    const pairwiseIntersections: string[] = [];
    for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
        const left = controls[leftIndex];
        const rightControl = controls[rightIndex];
        const intersectionWidth = Math.max(0, Math.min(right(left), right(rightControl)) - Math.max(left.x, rightControl.x));
        const intersectionHeight = Math.max(0, Math.min(bottom(left), bottom(rightControl)) - Math.max(left.y, rightControl.y));
        if (intersectionWidth * intersectionHeight > 0) pairwiseIntersections.push(`${left.selector} x ${rightControl.selector}`);
      }
    }
    const sampleDefinitions = [
      { sample: "center" as const, x: 0.5, y: 0.5 },
      { sample: "left" as const, x: 0.25, y: 0.5 },
      { sample: "right" as const, x: 0.75, y: 0.5 },
      { sample: "top" as const, x: 0.5, y: 0.25 },
      { sample: "bottom" as const, x: 0.5, y: 0.75 },
    ];
    const sampledInteriorPoints = elements.flatMap((element, index) => {
      const control = controls[index];
      const innerWidth = Math.max(0, control.width - 12);
      const innerHeight = Math.max(0, control.height - 12);
      return sampleDefinitions.map((definition) => {
        const x = round(control.x + 6 + innerWidth * definition.x);
        const y = round(control.y + 6 + innerHeight * definition.y);
        const hit = document.elementFromPoint(x, y);
        const ownerElement = hit?.closest<HTMLElement>("[data-replay-ability], [data-return-to-world]");
        const owner = ownerElement?.dataset.replayAbility
          ? `[data-replay-ability="${ownerElement.dataset.replayAbility}"]`
          : ownerElement?.hasAttribute("data-return-to-world") ? "[data-return-to-world]" : hit ? hit.tagName.toLowerCase() : "none";
        return { controlSelector: control.selector, sample: definition.sample, x, y, owner, ownedByControl: hit !== null && (hit === element || element.contains(hit)) };
      });
    });
    const replayControls = controls.filter((control) => control.kind === "REPLAY");
    const returnControl = controls.find((control) => control.kind === "RETURN");
    const horizontalReplayGap = replayControls.length === 2 ? Math.max(0, Math.max(replayControls[0].x, replayControls[1].x) - Math.min(right(replayControls[0]), right(replayControls[1]))) : -1;
    const verticalReplayGap = replayControls.length === 2 ? Math.max(0, Math.max(replayControls[0].y, replayControls[1].y) - Math.min(bottom(replayControls[0]), bottom(replayControls[1]))) : -1;
    const minimumReplayGapPx = Math.max(horizontalReplayGap, verticalReplayGap);
    const replayToReturnClearancePx = replayControls.length === 2 && returnControl
      ? returnControl.y - Math.max(bottom(replayControls[0]), bottom(replayControls[1]))
      : -1;
    const cardRect = rectValue(cardElement);
    const horizontalOverflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    const cardHorizontalOverflowPx = Math.max(0, cardElement.scrollWidth - cardElement.clientWidth);
    const occludedSamplePoints = sampledInteriorPoints.filter((sample) => !sample.ownedByControl).map((sample) => `${sample.controlSelector}:${sample.sample}->${sample.owner}`);
    const allContained = controls.every((control) => control.x >= cardRect.x - 0.5 && control.y >= cardRect.y - 0.5 && right(control) <= right(cardRect) + 0.5 && bottom(control) <= bottom(cardRect) + 0.5 && control.x >= -0.5 && control.y >= -0.5 && right(control) <= window.innerWidth + 0.5 && bottom(control) <= window.innerHeight + 0.5);
    const allVisible = controls.every((control) => control.width >= 44 && control.height >= 44 && control.display !== "none" && control.visibility !== "hidden" && control.pointerEvents !== "none");
    const status = controls.length === 3 && replayControls.length === 2 && Boolean(returnControl) && allContained && allVisible && pairwiseIntersections.length === 0 && occludedSamplePoints.length === 0 && minimumReplayGapPx >= 8 && replayToReturnClearancePx >= 12 && horizontalOverflowPx <= 1 && cardHorizontalOverflowPx <= 1 ? "PASS" as const : "FAIL" as const;
    return {
      cardRect,
      controls,
      sampledInteriorPoints,
      pairwiseIntersections,
      occludedSamplePoints,
      minimumReplayGapPx: round(minimumReplayGapPx),
      replayToReturnClearancePx: round(replayToReturnClearancePx),
      horizontalOverflowPx: round(horizontalOverflowPx),
      cardHorizontalOverflowPx: round(cardHorizontalOverflowPx),
      status,
    };
  });
  return {
    scenarioId: scenario.scenarioId,
    sourceTreeSha256,
    viewport: scenario.viewport,
    viewportSize: { width: scenario.width, height: scenario.height },
    selectedAbilityId: scenario.selectedAbilityId,
    ...measured,
    controls: measured.controls.map((control) => ({ ...control, abilityId: control.abilityId as AbilityId | null })),
    screenshot,
  };
}

async function verifyKeyboardNavigation(page: Page, scenario: CriticalControlScenarioResult): Promise<KeyboardNavigationCheck> {
  const expectedOrder = scenario.controls.map((control) => control.selector);
  const focusChecks: KeyboardNavigationCheck["focusChecks"][number][] = [];
  await page.locator("[data-settings-open]").focus();
  for (const selector of expectedOrder) {
    await page.keyboard.press("Tab");
    await expect(page.locator(selector)).toBeFocused();
    focusChecks.push(await page.locator(selector).evaluate((element, expectedSelector) => {
      const card = element.closest<HTMLElement>("[data-testid='run-complete']");
      const rect = element.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      const style = getComputedStyle(element);
      const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
      const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
      const extent = outlineWidth + outlineOffset;
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return {
        selector: expectedSelector,
        focusVisible: element.matches(":focus-visible"),
        focusRingContained: Boolean(cardRect) && rect.left - extent >= cardRect!.left - 0.5 && rect.top - extent >= cardRect!.top - 0.5 && rect.right + extent <= cardRect!.right + 0.5 && rect.bottom + extent <= cardRect!.bottom + 0.5,
        hitOwnershipPass: hit !== null && (hit === element || element.contains(hit)),
      };
    }, selector));
  }
  const status = focusChecks.every((check) => check.focusVisible && check.focusRingContained && check.hitOwnershipPass) ? "PASS" : "FAIL";
  return { scenarioId: scenario.scenarioId, tabOrder: expectedOrder, focusChecks, status };
}

async function readRunState(page: Page) {
  return page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) ?? "null") as { completedRuns?: number; localPlaytestEvents?: { replayClicked?: boolean }[] } | null;
    return {
      completedRuns: save?.completedRuns ?? -1,
      replayActionObserved: save?.localPlaytestEvents?.some((event) => event.replayClicked === true) ?? false,
    };
  }, GOLDEN_SLICE_SAVE_KEY);
}

async function activatePlannedControl(
  page: Page,
  scenario: CriticalControlScenarioResult,
  keyboardNavigation?: KeyboardNavigationCheck,
): Promise<CriticalActivationCheck> {
  const plan = ACTIVATION_PLAN[scenario.scenarioId];
  if (!plan) throw new Error(`Missing activation plan for ${scenario.scenarioId}`);
  const target = plan.controlKind === "REPLAY_A" ? scenario.controls[0] : plan.controlKind === "REPLAY_B" ? scenario.controls[1] : scenario.controls[2];
  const locator = page.locator(target.selector);
  const before = await readRunState(page);
  if (plan.input === "DESKTOP_POINTER") await locator.click();
  else if (plan.input === "MOBILE_TOUCH") await locator.tap();
  else if (plan.input === "KEYBOARD_SPACE") {
    if (!keyboardNavigation) throw new Error("Keyboard Space activation requires prior natural tab-order evidence");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(locator).toBeFocused();
    await page.keyboard.press("Space");
  } else {
    await locator.focus();
    await page.keyboard.press("Enter");
  }

  const isReplay = plan.controlKind !== "RETURN";
  if (isReplay) await waitForPhase(page, "boot");
  else await expect(page.getByTestId("my-game-world")).toBeVisible();
  const after = await readRunState(page);
  const observedPhase = isReplay ? await slice(page).getAttribute("data-visual-state-id") : null;
  const observedSelectedAbilityId = isReplay ? await slice(page).getAttribute("data-selected-ability-id") as AbilityId | null : null;
  const worldVisible = await page.getByTestId("my-game-world").isVisible().catch(() => false);
  const worldRepaired = worldVisible && await page.getByTestId("my-game-world").getAttribute("data-repaired") === "true";
  const expectedAbilityId = target.abilityId;
  const siblingAbilityActivated = isReplay && observedSelectedAbilityId !== expectedAbilityId;
  const activationPassed = isReplay
    ? observedPhase === "boot" && observedSelectedAbilityId === expectedAbilityId && !worldVisible && after.replayActionObserved && after.completedRuns === before.completedRuns && !siblingAbilityActivated
    : worldVisible && worldRepaired && !after.replayActionObserved && after.completedRuns === before.completedRuns;
  const status = activationPassed ? "PASS" : "FAIL";
  return {
    scenarioId: scenario.scenarioId,
    input: plan.input,
    controlKind: plan.controlKind,
    controlSelector: target.selector,
    expectedAbilityId,
    observedPhase,
    observedSelectedAbilityId,
    worldVisible,
    worldRepaired,
    replayActionObserved: after.replayActionObserved,
    siblingAbilityActivated,
    completedRunsBefore: before.completedRuns,
    completedRunsAfter: after.completedRuns,
    status,
  };
}

async function newScenarioPage(browser: Browser, width: number, height: number, hasTouch: boolean) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width, height },
    hasTouch,
    isMobile: hasTouch,
    reducedMotion: "reduce",
  });
  await installSpeechStub(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  return { context, page, diagnostics: observeDiagnostics(page) };
}

async function verifyOrdinaryNoReturnBranch(browser: Browser) {
  const { context, page, diagnostics } = await newScenarioPage(browser, 390, 844, false);
  try {
    await completeRun(page, "guardian-light", "/?play=hanzi-v2-golden-slice&mode=play");
    const actions = page.locator("[data-complete-actions]");
    await expect(actions).toBeVisible();
    await expect(actions.locator("[data-replay-group]")).toBeVisible();
    await expect(actions.locator("[data-replay-ability]")).toHaveCount(2);
    await expect(actions.locator("[data-return-row]")).toHaveCount(0);
    await expect(actions.locator("[data-return-to-world]")).toHaveCount(0);
    await expect(actions.locator(":scope > *")).toHaveCount(1);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.externalRequests).toEqual([]);
    return { id: "ordinary-without-return-href" as const, status: "PASS" as const, detail: "Ordinary play without returnToWorldHref renders only the replay group and no empty return row." };
  } finally {
    await context.close();
  }
}

async function verifyChildFirstUseBranch(browser: Browser) {
  const { context, page, diagnostics } = await newScenarioPage(browser, 390, 844, true);
  const sessionId = `s04-${"d".repeat(32)}`;
  const runSeed = "d123456789abcde0";
  try {
    await page.goto("/?hub=classic");
    await page.evaluate(({ key, grant }) => localStorage.setItem(key, JSON.stringify(grant)), {
      key: `family-games/hanzi-v2-step04/session:${sessionId}`,
      grant: {
        schemaVersion: 1,
        initiativeId: "hanzi-radical-battle-v2",
        step: "04",
        sessionId,
        runSeed,
        buildIdentitySha256: "D".repeat(64),
        parentFeedbackSha256: "3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C",
        launchNonce: "e".repeat(32),
        sessionMode: "LIVE_DASHBOARD",
        fixture: false,
        audioChoice: "START_MUTED",
        readyConfirmed: true,
        status: "AUTHORIZED",
        expiresAtMs: Date.now() + 60 * 60 * 1000,
        stopCode: null,
      },
    });
    const route = `/?play=hanzi-v2-golden-slice&mode=child-first-use&session=${sessionId}&seed=${runSeed}`;
    await completeRun(page, "star-path", route);
    const card = page.getByTestId("run-complete");
    await expect(card).toContainText("这次冒险到这里。你可以停下来；如果你自己还想走一次，也可以选另一道光。");
    await expect(card.locator("[data-complete-actions]")).toBeVisible();
    await expect(card.locator("[data-replay-group] [data-replay-ability]")).toHaveCount(2);
    await expect(card.locator("[data-return-row], [data-return-to-world]")).toHaveCount(0);
    await expect(card.locator("[data-replay-ability]").first()).not.toContainText("再冒险");
    await card.locator("[data-replay-ability]").first().tap();
    await waitForPhase(page, "boot");
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.externalRequests).toEqual([]);
    return { id: "child-first-use" as const, status: "PASS" as const, detail: "Child-first-use keeps its existing copy, at most one voluntary replay path, and no return-to-world control." };
  } finally {
    await context.close();
  }
}

test.describe("run-complete critical-control geometry and activation", () => {
  test("binds eight responsive scenarios and branch protections to one source tree", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "One orchestrated project creates isolated desktop, tablet, and mobile contexts.");
    test.setTimeout(600_000);
    mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
    const scenarios: CriticalControlScenarioResult[] = [];
    const activationChecks: CriticalActivationCheck[] = [];
    const keyboardNavigation: KeyboardNavigationCheck[] = [];

    for (const expected of RUN_COMPLETE_CRITICAL_CONTROL_SCENARIOS) {
      const hasTouch = expected.width === 390;
      const { context, page, diagnostics } = await newScenarioPage(browser, expected.width, expected.height, hasTouch);
      try {
        await completeRun(page, expected.selectedAbilityId);
        const card = page.getByTestId("run-complete");
        await expect(card.locator("[data-complete-actions]")).toBeVisible();
        await expect(card.locator("[data-replay-group] [data-replay-ability]")).toHaveCount(2);
        await expect(card.locator("[data-return-row] [data-return-to-world]")).toHaveCount(1);
        const screenshotPath = resolve(SCREENSHOT_ROOT, `run-complete-${expected.scenarioId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false, animations: "disabled" });
        const scenario = await measureScenario(page, expected, sourceTreeSha256, artifactPath(screenshotPath));
        scenarios.push(scenario);
        expect(scenario.status).toBe("PASS");
        let keyboardCheck: KeyboardNavigationCheck | undefined;
        if (expected.scenarioId === "320x568--guardian-light") {
          keyboardCheck = await verifyKeyboardNavigation(page, scenario);
          keyboardNavigation.push(keyboardCheck);
          expect(keyboardCheck.status).toBe("PASS");
        }
        const activation = await activatePlannedControl(page, scenario, keyboardCheck);
        activationChecks.push(activation);
        expect(activation.status).toBe("PASS");
        expect(diagnostics.consoleErrors).toEqual([]);
        expect(diagnostics.pageErrors).toEqual([]);
        expect(diagnostics.failedRequests).toEqual([]);
        expect(diagnostics.externalRequests).toEqual([]);
      } finally {
        await context.close();
      }
    }

    const branchChecks = [await verifyOrdinaryNoReturnBranch(browser), await verifyChildFirstUseBranch(browser)];
    const pairwiseIntersectionCount = scenarios.reduce((total, scenario) => total + scenario.pairwiseIntersections.length, 0);
    const occludedSamplePointCount = scenarios.reduce((total, scenario) => total + scenario.occludedSamplePoints.length, 0);
    const candidate: CriticalControlEvidenceReport = {
      schemaVersion: 1,
      recordType: "RUN_COMPLETE_CRITICAL_CONTROL_EVIDENCE",
      sourceTreeSha256,
      generatedAtUtc: new Date().toISOString(),
      fixtureClassification: RUN_COMPLETE_CRITICAL_CONTROL_FIXTURE,
      route: RUN_COMPLETE_CRITICAL_CONTROL_ROUTE,
      state: RUN_COMPLETE_CRITICAL_CONTROL_STATE,
      status: "PASS",
      scenarios,
      activationChecks,
      keyboardNavigation,
      branchChecks,
      evidenceFiles: scenarios.map((scenario) => scenario.screenshot),
      summary: {
        scenarioCount: scenarios.length,
        passed: scenarios.filter((scenario) => scenario.status === "PASS").length,
        failed: scenarios.filter((scenario) => scenario.status === "FAIL").length,
        pairwiseIntersectionCount,
        occludedSamplePointCount,
        activationCheckCount: activationChecks.length,
      },
    };
    const validationErrors = validateCriticalControlEvidenceReport(candidate, sourceTreeSha256, process.cwd());
    const report: CriticalControlEvidenceReport = validationErrors.length === 0
      ? candidate
      : { ...candidate, status: "FAIL", validationErrors };
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(validationErrors).toEqual([]);
  });
});

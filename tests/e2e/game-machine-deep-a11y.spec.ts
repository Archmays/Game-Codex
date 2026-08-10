import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import {
  DEEP_A11Y_VIEWPORTS,
  buildDeepRouteEvidenceReport,
  canonicalDeepA11yContextId,
  createDeepRouteA11yCoveragePlan,
  rowPassesHardEvidence,
  validateDeepRouteEvidenceReport,
  type DeepA11yCoveragePlanRow,
  type DeepA11yViewportId,
  type DeepRouteEvidenceRow,
} from "../../tools/game-machine-review/deep-route-evidence";
import { MACHINE_REVIEW_MANIFEST } from "../../tools/game-machine-review/machine-review-manifest";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const FIXTURE_MARKER = "SYNTHETIC_TOOLING_TEST_ONLY";
const ARTIFACT_ROOT = resolve("artifacts/game-machine-review/step-07/deep-route");
const SCREENSHOT_ROOT = resolve("artifacts/game-machine-review/step-07/screenshots/deep-route");
const ARIA_ROOT = resolve(ARTIFACT_ROOT, "aria");
const EVENT_ROOT = resolve(ARTIFACT_ROOT, "events");
const REPORT_PATH = resolve("artifacts/game-machine-review/step-07/DEEP-ROUTE-EVIDENCE.json");
const SOURCE_TREE_SHA256 = computeMachineReviewSourceTreeSha256();
const PLAN = createDeepRouteA11yCoveragePlan();
const RESULTS: DeepRouteEvidenceRow[] = [];
let canonicalProjectRan = false;

interface Diagnostics {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly sameOriginRequests: Set<string>;
  readonly externalRequests: Set<string>;
}

interface Scenario {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly contextId: string;
  readonly viewportId: DeepA11yViewportId;
  readonly storageFixture: string;
  readonly diagnostics: Diagnostics;
  readonly actionTrace: string[];
}

interface AccessibilityAudit {
  readonly mainLandmarkCount: number;
  readonly nestedMainLandmarks: string[];
  readonly levelOneHeadingCount: number;
  readonly duplicateIds: string[];
  readonly horizontalOverflowPx: number;
  readonly horizontalOverflowElements: string[];
  readonly visibleDialogCount: number;
  readonly unnamedVisibleDialogs: string[];
  readonly unlabeledFormControls: string[];
  readonly targetRule: "ADULT_INTERACTIVE_24" | "CHILD_PRIMARY_44";
  readonly undersizedTargets: string[];
  readonly focusTarget: string;
  readonly focusVisible: boolean;
  readonly focusUnobscured: boolean;
  readonly dragOrTouchAlternative: "PASS" | "FAIL" | "NOT_APPLICABLE";
}

function artifactPath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function viewport(viewportId: DeepA11yViewportId) {
  const match = DEEP_A11Y_VIEWPORTS.find((candidate) => candidate.id === viewportId);
  if (!match) throw new Error(`Unknown deep accessibility viewport ${viewportId}`);
  return match;
}

function planned(routeId: string, state: string, viewportId?: DeepA11yViewportId): DeepA11yCoveragePlanRow {
  const matches = PLAN.filter((row) => row.routeId === routeId && row.state === state && (!viewportId || row.viewportId === viewportId));
  if (matches.length !== 1) throw new Error(`Expected one canonical coverage row ${routeId}:${state}:${viewportId ?? "unspecified"}; found ${matches.length}`);
  const match = matches[0];
  return match;
}

function completedSave(settings = { muted: false, reducedMotion: false }) {
  return {
    schemaVersion: 3,
    contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
    completedRuns: 1,
    lastRunSeed: "hanzi-v2-golden-slice-v1",
    campState: { lamp: true },
    spellbookEntries: ["ming", "hua", "lin", "xing"],
    chosenAbilityHistory: ["ink-echo"],
    settings,
    localPlaytestEvents: [],
  };
}

async function installSpeechStub(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class SyntheticUtterance extends EventTarget {
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
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: SyntheticUtterance });
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

function observeDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    sameOriginRequests: new Set<string>(),
    externalRequests: new Set<string>(),
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "UNKNOWN"}`);
  });
  const classifyNetworkUrl = (rawUrl: string): void => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return;
    }
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return;
    const allowedLocalTransport = (url.protocol === "http:" || url.protocol === "ws:")
      && url.hostname === "127.0.0.1"
      && url.port === "5175";
    if (allowedLocalTransport) diagnostics.sameOriginRequests.add(rawUrl);
    else diagnostics.externalRequests.add(rawUrl);
  };
  page.on("request", (request) => classifyNetworkUrl(request.url()));
  page.on("websocket", (socket) => classifyNetworkUrl(socket.url()));
  return diagnostics;
}

async function createScenario(
  browser: Browser,
  contextId: string,
  viewportId: DeepA11yViewportId,
  storageFixture: "fresh" | "completed" | "corrupt",
): Promise<Scenario> {
  const dimensions = viewport(viewportId);
  const context = await browser.newContext({
    viewport: { width: dimensions.width, height: dimensions.height },
    hasTouch: dimensions.hasTouch,
  });
  await installSpeechStub(context);
  await context.addInitScript(({ saveKey, fixture, save, marker }) => {
    window.localStorage.setItem("machine-review/fixture-marker", marker);
    if (fixture === "fresh") window.localStorage.removeItem(saveKey);
    else if (fixture === "corrupt") window.localStorage.setItem(saveKey, "{not-valid-json");
    else window.localStorage.setItem(saveKey, JSON.stringify(save));
  }, {
    saveKey: GOLDEN_SLICE_SAVE_KEY,
    fixture: storageFixture,
    save: completedSave(),
    marker: FIXTURE_MARKER,
  });
  const page = await context.newPage();
  return {
    context,
    page,
    contextId,
    viewportId,
    storageFixture,
    diagnostics: observeDiagnostics(page),
    actionTrace: [`context:${contextId}`, `viewport:${dimensions.width}x${dimensions.height}`, `synthetic-storage:${storageFixture}`],
  };
}

async function firstVisible(locator: Locator): Promise<Locator> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible()) return candidate;
  }
  throw new Error("No visible focus target exists for the evidence row");
}

async function focusWithKeyboard(page: Page, target: Locator): Promise<{ description: string; visible: boolean; unobscured: boolean }> {
  await target.scrollIntoViewIfNeeded();
  const before = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      color: style.color,
      textDecorationLine: style.textDecorationLine,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  for (let index = 0; index < 160; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press("Tab");
  }
  const result = await target.evaluate((element, prior) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const top = document.elementFromPoint(x, y);
    const label = element.getAttribute("aria-label")
      || element.textContent?.replace(/\s+/g, " ").trim()
      || element.getAttribute("name")
      || element.tagName.toLowerCase();
    const focusStyle = style.outlineStyle !== "none"
      && Number.parseFloat(style.outlineWidth || "0") > 0
      || (style.boxShadow !== "none" && style.boxShadow !== "")
      || style.borderColor !== prior.borderColor
      || style.backgroundColor !== prior.backgroundColor
      || style.color !== prior.color
      || style.textDecorationLine !== prior.textDecorationLine;
    return {
      description: `${element.tagName.toLowerCase()}:${label}`.slice(0, 160),
      active: document.activeElement === element,
      visible: element.matches(":focus-visible") && focusStyle,
      unobscured: rect.width > 0
        && rect.height > 0
        && rect.top < innerHeight
        && rect.bottom > 0
        && rect.left < innerWidth
        && rect.right > 0
        && Boolean(top && (element === top || element.contains(top) || top.contains(element))),
    };
  }, before);
  expect(result.active, `Keyboard focus did not reach ${result.description}`).toBe(true);
  return { description: result.description, visible: result.visible, unobscured: result.unobscured };
}

async function auditAccessibility(
  page: Page,
  row: DeepA11yCoveragePlanRow,
  focusLocator: Locator,
): Promise<AccessibilityAudit> {
  const focusTarget = await firstVisible(focusLocator);
  const focus = await focusWithKeyboard(page, focusTarget);
  const raw = await page.evaluate(({ pageClass, hasTouch }) => {
    const visible = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const describe = (element: Element): string => {
      const html = element as HTMLElement;
      const text = html.getAttribute("aria-label") || html.textContent?.replace(/\s+/g, " ").trim() || html.id || html.tagName;
      const rect = html.getBoundingClientRect();
      return `${html.tagName.toLowerCase()}:${text.slice(0, 80)}:${Math.round(rect.width)}x${Math.round(rect.height)}`;
    };
    const ids = new Map<string, number>();
    for (const element of document.querySelectorAll<HTMLElement>("[id]")) {
      if (element.id) ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
    }
    const mainLandmarks = [...document.querySelectorAll<HTMLElement>('main, [role="main"]')];
    const nestedMainLandmarks = mainLandmarks
      .filter((landmark) => landmark.parentElement?.closest('main, [role="main"]'))
      .map(describe);
    const levelOneHeadingCount = document.querySelectorAll("h1").length;
    const duplicateIds = [...ids].filter(([, count]) => count > 1).map(([id]) => id).sort();
    const horizontalOverflowPx = Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
      document.body?.scrollWidth - window.innerWidth || 0,
    );
    const horizontalOverflowElements = horizontalOverflowPx <= 1 ? [] : [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.left < -1 || element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 20)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const identity = element.id
          ? `#${element.id}`
          : `${element.tagName.toLowerCase()}${[...element.classList].slice(0, 3).map((name) => `.${name}`).join("")}`;
        return `${identity}:left=${Math.round(rect.left)}:right=${Math.round(rect.right)}:width=${Math.round(rect.width)}:client=${element.clientWidth}:scroll=${element.scrollWidth}`;
      });
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(visible);
    const unnamedVisibleDialogs = dialogs.filter((dialog) => {
      const direct = dialog.getAttribute("aria-label")?.trim();
      const labelledBy = dialog.getAttribute("aria-labelledby")?.trim().split(/\s+/).filter(Boolean) ?? [];
      const labelledText = labelledBy.map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" ").trim();
      return !direct && !labelledText;
    }).map(describe);
    const unlabeledFormControls = [...document.querySelectorAll<HTMLElement>("input, select, textarea")]
      .filter(visible)
      .filter((control) => {
        if (control.getAttribute("aria-label")?.trim()) return false;
        const labelledBy = control.getAttribute("aria-labelledby")?.trim().split(/\s+/).filter(Boolean) ?? [];
        if (labelledBy.some((id) => document.getElementById(id)?.textContent?.trim())) return false;
        if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false;
        return !control.closest("label");
      })
      .map(describe);
    const selector = pageClass === "adult"
      ? 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="button"]'
      : '[data-primary-action], [data-world-forest-link], [data-world-spellbook-open], [data-world-treasure-link], .game-card__button, .golden-primary, [data-ability-id], [data-card-id], [data-slot-id], [data-return-to-world]';
    const threshold = pageClass === "adult" ? 24 : 44;
    const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter(visible);
    const undersizedTargets = targets.flatMap((target) => {
      const effective = target instanceof HTMLInputElement && target.closest("label") instanceof HTMLElement
        ? target.closest("label") as HTMLElement
        : target;
      const rect = effective.getBoundingClientRect();
      return rect.width + 0.01 < threshold || rect.height + 0.01 < threshold ? [describe(target)] : [];
    });
    const draggableCards = [...document.querySelectorAll<HTMLElement>('[draggable="true"], [data-card-id]')].filter(visible);
    const slots = [...document.querySelectorAll<HTMLElement>("[data-slot-id]")].filter(visible);
    const clickAlternative = draggableCards.length > 0
      ? draggableCards.every((element) => element.tagName === "BUTTON") && slots.length > 0 && slots.every((element) => element.tagName === "BUTTON")
      : hasTouch
        ? targets.every((element) => ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) || element.getAttribute("role") === "button")
        : null;
    return {
      mainLandmarkCount: mainLandmarks.length,
      nestedMainLandmarks,
      levelOneHeadingCount,
      duplicateIds,
      horizontalOverflowPx,
      horizontalOverflowElements,
      visibleDialogCount: dialogs.length,
      unnamedVisibleDialogs,
      unlabeledFormControls,
      undersizedTargets,
      clickAlternative,
    };
  }, { pageClass: row.pageClass, hasTouch: viewport(row.viewportId).hasTouch });

  return {
    mainLandmarkCount: raw.mainLandmarkCount,
    nestedMainLandmarks: raw.nestedMainLandmarks,
    levelOneHeadingCount: raw.levelOneHeadingCount,
    duplicateIds: raw.duplicateIds,
    horizontalOverflowPx: raw.horizontalOverflowPx,
    horizontalOverflowElements: raw.horizontalOverflowElements,
    visibleDialogCount: raw.visibleDialogCount,
    unnamedVisibleDialogs: raw.unnamedVisibleDialogs,
    unlabeledFormControls: raw.unlabeledFormControls,
    targetRule: row.pageClass === "adult" ? "ADULT_INTERACTIVE_24" : "CHILD_PRIMARY_44",
    undersizedTargets: raw.undersizedTargets,
    focusTarget: focus.description,
    focusVisible: focus.visible,
    focusUnobscured: focus.unobscured,
    dragOrTouchAlternative: raw.clickAlternative === null ? "NOT_APPLICABLE" : raw.clickAlternative ? "PASS" : "FAIL",
  };
}

async function captureRow(options: {
  readonly scenario: Scenario;
  readonly row: DeepA11yCoveragePlanRow;
  readonly root: Locator;
  readonly focus: Locator;
  readonly actualVisualState: string;
  readonly action: string;
  readonly catalogGameIds?: readonly string[];
}): Promise<void> {
  const { scenario, row } = options;
  expect(scenario.viewportId).toBe(row.viewportId);
  expect(scenario.contextId).toBe(canonicalDeepA11yContextId(row.key));
  scenario.actionTrace.push(options.action, `capture:${row.routeId}:${row.state}`);
  const accessibility = await auditAccessibility(scenario.page, row, options.focus);
  const stem = row.key.replaceAll("::", "--");
  const screenshotPath = resolve(SCREENSHOT_ROOT, `${stem}.png`);
  const ariaPath = resolve(ARIA_ROOT, `${stem}.aria.txt`);
  const eventPath = resolve(EVENT_ROOT, `${stem}.events.json`);
  await scenario.page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  writeFileSync(ariaPath, `${await options.root.ariaSnapshot()}\n`, "utf8");
  const diagnostics = {
    consoleErrors: [...scenario.diagnostics.consoleErrors],
    pageErrors: [...scenario.diagnostics.pageErrors],
    failedRequests: [...scenario.diagnostics.failedRequests],
    sameOriginRequests: [...scenario.diagnostics.sameOriginRequests].sort(),
    externalRequests: [...scenario.diagnostics.externalRequests].sort(),
    networkClassification: {
      sameOrigin: "SAME_ORIGIN_ALLOWED" as const,
      external: "EXTERNAL_NETWORK_FORBIDDEN" as const,
    },
  };
  const evidenceEvent = {
    schemaVersion: 1,
    sourceTreeSha256: SOURCE_TREE_SHA256,
    key: row.key,
    contextId: scenario.contextId,
    isolatedBrowserContext: true,
    syntheticStorage: true,
    route: row.route,
    state: row.state,
    actualVisualState: options.actualVisualState,
    viewport: viewport(row.viewportId),
    actionTrace: [...scenario.actionTrace],
    diagnostics,
    accessibility,
  };
  writeFileSync(eventPath, `${JSON.stringify(evidenceEvent, null, 2)}\n`, "utf8");
  const result: DeepRouteEvidenceRow = {
    ...row,
    sourceTreeSha256: SOURCE_TREE_SHA256,
    contextId: scenario.contextId,
    isolatedBrowserContext: true,
    syntheticStorage: true,
    storageFixture: scenario.storageFixture,
    actualUrl: scenario.page.url(),
    actualVisualState: options.actualVisualState,
    screenshot: artifactPath(screenshotPath),
    aria: artifactPath(ariaPath),
    eventTrace: artifactPath(eventPath),
    diagnostics,
    accessibility,
    ...(options.catalogGameIds ? { catalogGameIds: options.catalogGameIds } : {}),
    actionTrace: [...scenario.actionTrace],
    status: "PASS",
  };
  expect(rowPassesHardEvidence(result), JSON.stringify(result, null, 2)).toBe(true);
  RESULTS.push(result);
}

function slice(page: Page): Locator {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function waitPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 20_000 });
}

async function primary(scenario: Scenario, name: string): Promise<void> {
  scenario.actionTrace.push(`click-primary:${name}`);
  await slice(scenario.page).getByRole("button", { name, exact: true }).click();
}

async function solve(scenario: Scenario, cardId: string, slotId: "left" | "right" | "top" | "bottom"): Promise<void> {
  scenario.actionTrace.push(`click-alternative:card:${cardId}`, `click-alternative:slot:${slotId}`);
  await scenario.page.getByTestId(`component-card-${cardId}`).click();
  await scenario.page.getByTestId(`slot-${slotId}`).click();
}

async function progressToAbilityChoice(scenario: Scenario): Promise<void> {
  await primary(scenario, "走进墨林");
  await primary(scenario, "看看营地灯");
  await primary(scenario, "沿着灯路出发");
  await primary(scenario, "跳过小路");
  await primary(scenario, "开始合字施法");
  await waitPhase(scenario.page, "battle_1_placing");
  await solve(scenario, "ming-ri", "left");
  await solve(scenario, "ming-yue", "right");
  await waitPhase(scenario.page, "battle_1_cleared");
  await primary(scenario, "看看光留下什么");
  await waitPhase(scenario.page, "breather_1");
  await primary(scenario, "继续看前路");
  await primary(scenario, "跳过花径");
  await primary(scenario, "试试新的结构");
  await waitPhase(scenario.page, "battle_2_placing");
  await solve(scenario, "hua-cao", "top");
  await solve(scenario, "hua-hua", "bottom");
  await waitPhase(scenario.page, "battle_2_cleared");
  await primary(scenario, "看看三道光");
  await waitPhase(scenario.page, "ability_choice");
}

async function progressToBossAndFinish(scenario: Scenario): Promise<void> {
  await progressToAbilityChoice(scenario);
  scenario.actionTrace.push("choose-ability:ink-echo");
  await scenario.page.getByTestId("ability-ink-echo").click();
  await primary(scenario, "走向双印墨守");
  await primary(scenario, "先看清它的动作");
  await waitPhase(scenario.page, "boss_phase_1_placing");
}

function fixtureAdultRoute(row: DeepA11yCoveragePlanRow): string {
  if (row.routeId === "observe-step04") {
    const timestamp = encodeURIComponent("2026-08-10T00:00:00.000Z");
    return `${row.route}&session=s04-${"a".repeat(32)}&seed=${"b".repeat(16)}&build=${"c".repeat(64)}&launch=${"d".repeat(32)}&commit=${"e".repeat(40)}&generated=${timestamp}&checked=${timestamp}&started=${timestamp}&fixture=1`;
  }
  if (row.routeId === "observe-step06" || row.routeId === "observe-step07") {
    return `${row.route}&fixture=${FIXTURE_MARKER}&build=${"a".repeat(40)}`;
  }
  return row.route;
}

test.describe.serial("STEP 07 canonical deep-route and accessibility evidence", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The spec creates its own exact viewport contexts once.");
    canonicalProjectRan = true;
  });

  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    mkdirSync(ARIA_ROOT, { recursive: true });
    mkdirSync(EVENT_ROOT, { recursive: true });
  });

  test("world fresh and settings at 320x568", async ({ browser }) => {
    const scenario = await createScenario(browser, "world-compact-mobile", "compact-mobile", "fresh");
    try {
      await scenario.page.goto(planned("my-game-world", "fresh", "compact-mobile").route, { waitUntil: "domcontentloaded" });
      const world = scenario.page.getByTestId("my-game-world");
      await expect(world).toBeVisible();
      await expect(world).toHaveAttribute("data-repaired", "false");
      await captureRow({
        scenario,
        row: planned("my-game-world", "fresh", "compact-mobile"),
        root: world,
        focus: scenario.page.locator("[data-world-forest-link]"),
        actualVisualState: "world:fresh",
        action: "open-canonical-world",
      });
      await scenario.page.locator("[data-world-settings-open]").click();
      const settings = scenario.page.getByTestId("world-settings");
      await expect(settings).toBeVisible();
      await captureRow({
        scenario,
        row: planned("my-game-world", "settings"),
        root: settings,
        focus: settings.locator("[data-world-modal-close]"),
        actualVisualState: "world:settings-dialog",
        action: "open-settings-with-public-button",
      });
    } finally {
      await scenario.context.close();
    }
  });

  test("world repaired, spellbook, reduced motion, and treasure at 390x844", async ({ browser }) => {
    const scenario = await createScenario(browser, "world-mobile-repaired", "mobile", "completed");
    try {
      await scenario.page.goto(planned("my-game-world", "repaired").route, { waitUntil: "domcontentloaded" });
      const world = scenario.page.getByTestId("my-game-world");
      await expect(world).toHaveAttribute("data-repaired", "true");
      await captureRow({ scenario, row: planned("my-game-world", "repaired"), root: world, focus: scenario.page.locator("[data-world-forest-link]"), actualVisualState: "world:repaired", action: "load-completed-synthetic-save" });

      await scenario.page.locator("[data-world-spellbook-open]").click();
      const spellbook = scenario.page.getByTestId("world-spellbook");
      await expect(spellbook).toBeVisible();
      await expect(spellbook.locator("[data-world-spellbook-id]")).toHaveCount(4);
      await captureRow({ scenario, row: planned("my-game-world", "spellbook"), root: spellbook, focus: spellbook.locator("[data-world-modal-close]"), actualVisualState: "world:spellbook-dialog", action: "open-spellbook-with-public-button" });
      await spellbook.locator("[data-world-modal-close]").click();

      await scenario.page.locator("[data-world-settings-open]").click();
      const settings = scenario.page.getByTestId("world-settings");
      await settings.locator("[data-world-reduced-motion]").check();
      await expect(settings.locator("[data-world-reduced-motion]")).toBeChecked();
      await captureRow({ scenario, row: planned("my-game-world", "reduced-motion"), root: settings, focus: settings.locator("[data-world-modal-close]"), actualVisualState: "world:settings-reduced-motion", action: "enable-reduced-motion-with-labelled-checkbox" });
      await settings.locator("[data-world-modal-close]").click();

      await scenario.page.locator("[data-world-treasure-link]").click();
      const catalog = scenario.page.getByTestId("classic-hub-from-world");
      await expect(catalog.locator(".game-card")).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
      await captureRow({ scenario, row: planned("my-game-world", "treasure"), root: catalog, focus: catalog.getByRole("link", { name: /回我的游戏世界/ }), actualVisualState: "world:treasure-opened-classic-catalog", action: "open-treasure-with-public-link" });
    } finally {
      await scenario.context.close();
    }
  });

  test("Golden Slice early states and settings at 768x1024", async ({ browser }) => {
    const scenario = await createScenario(browser, "golden-tablet-early", "tablet", "fresh");
    try {
      await scenario.page.goto(planned("hanzi-golden-slice", "camp", "tablet").route, { waitUntil: "domcontentloaded" });
      await primary(scenario, "走进墨林");
      await waitPhase(scenario.page, "camp_intro");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "camp", "tablet"), root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "camp_intro", action: "enter-camp-through-public-route" });

      await scenario.page.locator("[data-settings-open]").click();
      const settings = scenario.page.getByTestId("settings-overlay");
      await settings.locator("[data-setting-muted]").check();
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "mute"), root: settings, focus: settings.locator("[data-settings-close]"), actualVisualState: "settings_open:muted", action: "enable-mute-with-labelled-checkbox" });
      await settings.locator("[data-setting-motion]").check();
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "reduced-motion"), root: settings, focus: settings.locator("[data-settings-close]"), actualVisualState: "settings_open:reduced-motion", action: "enable-reduced-motion-with-labelled-checkbox" });
      await settings.locator("[data-setting-motion]").uncheck();
      await settings.locator("[data-settings-close]").click();

      await primary(scenario, "看看营地灯");
      await primary(scenario, "沿着灯路出发");
      await primary(scenario, "跳过小路");
      await primary(scenario, "开始合字施法");
      await waitPhase(scenario.page, "battle_1_placing");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "ming-placing"), root: slice(scenario.page), focus: scenario.page.getByTestId("component-card-ming-ri"), actualVisualState: "battle_1_placing", action: "reach-ming-board-through-primary-actions" });
      await solve(scenario, "ming-ri", "left");
      await solve(scenario, "ming-yue", "right");
      await waitPhase(scenario.page, "battle_1_cleared");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "ming-formed"), root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "battle_1_cleared", action: "form-ming-with-click-alternative" });
      await primary(scenario, "看看光留下什么");
      await waitPhase(scenario.page, "breather_1");
      await primary(scenario, "继续看前路");
      await primary(scenario, "跳过花径");
      await primary(scenario, "试试新的结构");
      await solve(scenario, "hua-cao", "top");
      await solve(scenario, "hua-hua", "bottom");
      await waitPhase(scenario.page, "battle_2_cleared");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "hua"), root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "battle_2_cleared", action: "form-hua-with-click-alternative" });
      await primary(scenario, "看看三道光");
      await waitPhase(scenario.page, "ability_choice");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "ability-choice"), root: slice(scenario.page), focus: scenario.page.getByTestId("ability-ink-echo"), actualVisualState: "ability_choice", action: "open-public-ability-choice" });
    } finally {
      await scenario.context.close();
    }
  });

  test("Golden Slice bosses, repair, spellbook, completion, and world return at 1440x900", async ({ browser }) => {
    const scenario = await createScenario(browser, "golden-desktop-late", "desktop", "fresh");
    try {
      await scenario.page.goto(planned("hanzi-golden-slice", "boss-lin").route, { waitUntil: "domcontentloaded" });
      await waitPhase(scenario.page, "boot");
      await progressToBossAndFinish(scenario);
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "boss-lin"), root: slice(scenario.page), focus: scenario.page.getByTestId("component-card-lin-mu-left"), actualVisualState: "boss_phase_1_placing", action: "reach-lin-boss-through-public-gameplay" });
      await solve(scenario, "lin-mu-left", "left");
      await waitPhase(scenario.page, "boss_interference");
      await scenario.page.locator("[data-ink-echo-voice]").click();
      scenario.actionTrace.push("use-ink-echo-public-button");
      await waitPhase(scenario.page, "boss_phase_1_placing");
      await solve(scenario, "lin-mu-right", "right");
      await waitPhase(scenario.page, "boss_phase_1_cleared");
      await primary(scenario, "解开第二枚墨印");
      await solve(scenario, "xing-ri", "top");
      await waitPhase(scenario.page, "boss_phase_2_placing");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "boss-xing"), root: slice(scenario.page), focus: scenario.page.getByTestId("component-card-xing-sheng"), actualVisualState: "boss_phase_2_placing", action: "reach-xing-boss-through-public-gameplay" });
      await solve(scenario, "xing-sheng", "bottom");
      await waitPhase(scenario.page, "boss_cleared");
      await primary(scenario, "沿星路回营地");
      await waitPhase(scenario.page, "camp_repair");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "camp-repair"), root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "camp_repair", action: "finish-both-boss-seals" });
      await primary(scenario, "翻开四字魔法书");
      await waitPhase(scenario.page, "spellbook_review");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "spellbook"), root: scenario.page.getByTestId("spellbook-overlay"), focus: scenario.page.locator("[data-finish-run]"), actualVisualState: "spellbook_review", action: "open-four-character-spellbook" });
      await scenario.page.locator("[data-finish-run]").click();
      scenario.actionTrace.push("finish-run-public-button");
      await waitPhase(scenario.page, "run_complete");
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "run-complete"), root: scenario.page.getByTestId("run-complete"), focus: scenario.page.locator("[data-return-to-world]"), actualVisualState: "run_complete", action: "reach-run-complete" });
      await scenario.page.locator("[data-return-to-world]").click();
      const world = scenario.page.getByTestId("my-game-world");
      await expect(world).toBeVisible();
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "return-world"), root: world, focus: scenario.page.locator("[data-world-forest-link]"), actualVisualState: "world:return-from-forest", action: "return-to-world-with-public-link" });
    } finally {
      await scenario.context.close();
    }
  });

  test("Golden Slice corrupt save recovers at 390x844", async ({ browser }) => {
    const scenario = await createScenario(browser, "golden-mobile-corrupt", "mobile", "corrupt");
    try {
      await scenario.page.goto(planned("hanzi-golden-slice", "corrupt-save-recovery").route, { waitUntil: "domcontentloaded" });
      await primary(scenario, "走进墨林");
      await waitPhase(scenario.page, "camp_intro");
      const recovered = await scenario.page.evaluate((key) => {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as { schemaVersion?: unknown } | null;
        return parsed?.schemaVersion === 3;
      }, GOLDEN_SLICE_SAVE_KEY);
      expect(recovered).toBe(true);
      await captureRow({ scenario, row: planned("hanzi-golden-slice", "corrupt-save-recovery"), root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "camp_intro:corrupt-save-recovered", action: "load-corrupt-synthetic-save-and-verify-schema-recovery" });
    } finally {
      await scenario.context.close();
    }
  });

  test("classic catalog identity at 1440x900", async ({ browser }) => {
    const scenario = await createScenario(browser, "classic-catalog-desktop", "desktop", "fresh");
    try {
      const row = planned("classic-hub", "catalog", "desktop");
      await scenario.page.goto(row.route, { waitUntil: "domcontentloaded" });
      const root = scenario.page.getByTestId("classic-hub-from-world");
      const cards = root.locator(".game-card");
      await expect(cards).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
      for (const [index, game] of MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.entries()) {
        await expect(cards.nth(index).getByRole("heading", { name: game.title, exact: true })).toBeVisible();
        await expect(cards.nth(index).getByRole("button", { name: game.playLabel, exact: true })).toBeVisible();
      }
      await captureRow({
        scenario,
        row,
        root,
        focus: cards.first().getByRole("button"),
        actualVisualState: "classic:canonical-catalog",
        action: "verify-catalog-order-titles-and-play-labels-from-manifest",
        catalogGameIds: MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId),
      });
    } finally {
      await scenario.context.close();
    }
  });

  test("critical Golden Slice and classic catalog surfaces at 320x568", async ({ browser }) => {
    const scenario = await createScenario(browser, "critical-compact-mobile", "compact-mobile", "fresh");
    try {
      const campRow = planned("hanzi-golden-slice", "camp", "compact-mobile");
      await scenario.page.goto(campRow.route, { waitUntil: "domcontentloaded" });
      await primary(scenario, "走进墨林");
      await waitPhase(scenario.page, "camp_intro");
      await captureRow({ scenario, row: campRow, root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "camp_intro", action: "responsive-critical-surface-320" });

      const catalogRow = planned("classic-hub", "catalog", "compact-mobile");
      await scenario.page.goto(catalogRow.route, { waitUntil: "domcontentloaded" });
      const catalog = scenario.page.getByTestId("classic-hub-from-world");
      await expect(catalog.locator(".game-card")).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
      await captureRow({
        scenario,
        row: catalogRow,
        root: catalog,
        focus: catalog.locator(".game-card").first().getByRole("button"),
        actualVisualState: "classic:canonical-catalog",
        action: "responsive-critical-surface-320",
        catalogGameIds: MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId),
      });
    } finally {
      await scenario.context.close();
    }
  });

  test("critical world, Golden Slice, and classic catalog surfaces at 390x844", async ({ browser }) => {
    const scenario = await createScenario(browser, "critical-mobile", "mobile", "fresh");
    try {
      const worldRow = planned("my-game-world", "fresh", "mobile");
      await scenario.page.goto(worldRow.route, { waitUntil: "domcontentloaded" });
      const world = scenario.page.getByTestId("my-game-world");
      await expect(world).toHaveAttribute("data-repaired", "false");
      await captureRow({ scenario, row: worldRow, root: world, focus: scenario.page.locator("[data-world-forest-link]"), actualVisualState: "world:fresh", action: "responsive-critical-surface-390" });

      const campRow = planned("hanzi-golden-slice", "camp", "mobile");
      await scenario.page.goto(campRow.route, { waitUntil: "domcontentloaded" });
      await primary(scenario, "走进墨林");
      await waitPhase(scenario.page, "camp_intro");
      await captureRow({ scenario, row: campRow, root: slice(scenario.page), focus: scenario.page.locator("[data-primary-action]"), actualVisualState: "camp_intro", action: "responsive-critical-surface-390" });

      const catalogRow = planned("classic-hub", "catalog", "mobile");
      await scenario.page.goto(catalogRow.route, { waitUntil: "domcontentloaded" });
      const catalog = scenario.page.getByTestId("classic-hub-from-world");
      await expect(catalog.locator(".game-card")).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
      await captureRow({
        scenario,
        row: catalogRow,
        root: catalog,
        focus: catalog.locator(".game-card").first().getByRole("button"),
        actualVisualState: "classic:canonical-catalog",
        action: "responsive-critical-surface-390",
        catalogGameIds: MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId),
      });
    } finally {
      await scenario.context.close();
    }
  });

  for (const row of PLAN.filter((candidate) => candidate.coverageKind === "adult-tool")) {
    test(`adult accessibility ${row.routeId} at ${row.viewportId}`, async ({ browser }) => {
      const scenario = await createScenario(browser, `adult-${row.routeId}-${row.viewportId}`, row.viewportId, "completed");
      try {
        await scenario.page.goto(fixtureAdultRoute(row), { waitUntil: "domcontentloaded" });
        const root = scenario.page.locator("#app main").first();
        await expect(root).toBeVisible();
        const focus = scenario.page.locator("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
        await captureRow({ scenario, row, root, focus, actualVisualState: `${row.routeId}:default`, action: "open-canonical-adult-tool-route" });
      } finally {
        await scenario.context.close();
      }
    });
  }

  test("matrix completeness is exact and source-bound", () => {
    const report = buildDeepRouteEvidenceReport(RESULTS, SOURCE_TREE_SHA256);
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(validateDeepRouteEvidenceReport(report), JSON.stringify(report.coverage, null, 2)).toEqual([]);
    expect(report.status, JSON.stringify(report.coverage, null, 2)).toBe("PASS");
  });

  test.afterAll(() => {
    if (!canonicalProjectRan) return;
    const report = buildDeepRouteEvidenceReport(RESULTS, SOURCE_TREE_SHA256);
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  });
});

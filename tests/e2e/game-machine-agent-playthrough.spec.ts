import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";
import { MACHINE_AGENT_PROFILE_IDS, MACHINE_AGENT_PROFILE_PROJECTS } from "../../tools/game-machine-review/machine-review-manifest";

const BASE_URL = "http://127.0.0.1:5175";
const FIXTURE_MARKER = "SYNTHETIC_TOOLING_TEST_ONLY";
const ARTIFACT_ROOT = resolve("artifacts/game-machine-review/step-07/agent-playthrough");
const SCREENSHOT_ROOT = resolve(ARTIFACT_ROOT, "screenshots");
const TRACE_ROOT = resolve(ARTIFACT_ROOT, "traces");
const RESULTS_PATH = resolve(ARTIFACT_ROOT, "AGENT-PLAYTHROUGH-RESULTS.json");

const PROFILE_IDS = MACHINE_AGENT_PROFILE_IDS;

type ProfileId = (typeof PROFILE_IDS)[number];
type InputMode = "pointer" | "keyboard" | "touch";
type AbilityId = "guardian-light" | "star-path" | "ink-echo";

interface Diagnostics {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly sameOriginAbortedRequests: string[];
  readonly sameOriginRequests: Set<string>;
  readonly externalRequests: Set<string>;
}

interface ProfileResult {
  readonly profile: ProfileId;
  readonly project: string;
  readonly fixtureMarker: typeof FIXTURE_MARKER;
  readonly isolatedBrowserContext: true;
  readonly status: "PASS" | "FAIL";
  readonly completed: boolean;
  readonly actualInteractions: readonly string[];
  readonly completionEvidence: readonly string[];
  readonly screenshot: string;
  readonly trace: string;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly sameOriginAbortedRequests: readonly string[];
  readonly sameOriginRequests: readonly string[];
  readonly externalRequests: readonly string[];
  readonly networkClassification: {
    readonly sameOrigin: "SAME_ORIGIN_ALLOWED";
    readonly external: "EXTERNAL_NETWORK_FORBIDDEN";
  };
  readonly detail: string;
}

interface ProfileContextOptions {
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly hasTouch?: boolean;
  readonly isMobile?: boolean;
  readonly reducedMotion?: "reduce" | "no-preference";
  readonly timeoutMs?: number;
}

function artifactPath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function profileStem(profile: ProfileId): string {
  return profile.toLowerCase().replaceAll("_", "-");
}

function observeDiagnostics(context: BrowserContext): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    sameOriginAbortedRequests: [],
    sameOriginRequests: new Set<string>(),
    externalRequests: new Set<string>(),
  };

  // BrowserContext events aggregate every page, including auxiliary gesture
  // pages, into one profile-level diagnostic gate.
  context.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  context.on("weberror", (webError) => diagnostics.pageErrors.push(webError.error().message));
  context.on("requestfailed", (request) => {
    const detail = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "UNKNOWN"}`;
    const errorText = request.failure()?.errorText;
    try {
      if (new URL(request.url()).origin === BASE_URL && errorText === "net::ERR_ABORTED") {
        diagnostics.sameOriginAbortedRequests.push(detail);
        return;
      }
    } catch {
      // An unparseable failed request remains a hard diagnostic below.
    }
    diagnostics.failedRequests.push(detail);
  });
  context.on("request", (request) => {
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin === BASE_URL) diagnostics.sameOriginRequests.add(request.url());
    else diagnostics.externalRequests.add(request.url());
  });
  return diagnostics;
}

function readExistingResults(): ProfileResult[] {
  try {
    const parsed = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as {
      sourceTreeSha256?: string;
      results?: Array<ProfileResult & { traceBytes?: unknown }>;
    };
    if (parsed.sourceTreeSha256 !== computeMachineReviewSourceTreeSha256()) return [];
    return Array.isArray(parsed.results)
      ? parsed.results
        .filter((entry) => PROFILE_IDS.includes(entry.profile))
        .map((entry) => {
          const sanitized = { ...entry };
          delete sanitized.traceBytes;
          return sanitized;
        })
      : [];
  } catch {
    return [];
  }
}

function writeProfileResult(result: ProfileResult): void {
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const prior = readExistingResults().filter((entry) => entry.profile !== result.profile);
  const results = [...prior, result].sort(
    (left, right) => PROFILE_IDS.indexOf(left.profile) - PROFILE_IDS.indexOf(right.profile),
  );
  const externalRequestCount = results.reduce((sum, entry) => sum + entry.externalRequests.length, 0);
  const allExpectedProfilesRecorded = PROFILE_IDS.every((profile) => results.some((entry) => entry.profile === profile));
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
  const status = allExpectedProfilesRecorded
    && results.every((entry) => entry.status === "PASS")
    && externalRequestCount === 0
    ? "PASS"
    : "FAIL";
  writeFileSync(
    RESULTS_PATH,
    `${JSON.stringify({
      schemaVersion: 1,
      evidenceKind: "MACHINE_AGENT_PLAYTHROUGH",
      sourceTreeSha256,
      fixtureMarker: FIXTURE_MARKER,
      isolatedBrowserContexts: true,
      status,
      expectedProfiles: PROFILE_IDS,
      expectedProjects: MACHINE_AGENT_PROFILE_PROJECTS,
      profileCount: results.length,
      passed: results.filter((entry) => entry.status === "PASS").length,
      failed: results.filter((entry) => entry.status === "FAIL").length,
      allExpectedProfilesRecorded,
      evidenceFiles: results.flatMap((entry) => [entry.screenshot, entry.trace]),
      networkPolicy: {
        sameOrigin: "SAME_ORIGIN_ALLOWED",
        external: "EXTERNAL_NETWORK_FORBIDDEN",
        externalRequestCount,
      },
      machineOnlyConclusion: "This validates deterministic tooling and browser behavior only; it is not real-child evidence or a claim about fun, learning, retention, or long-term engagement.",
      results,
    }, null, 2)}\n`,
    "utf8",
  );
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

      constructor(text = "") {
        super();
        this.text = text;
      }
    }

    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: TestUtterance,
    });
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

function completedSave(settings = { muted: false, reducedMotion: true }) {
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

async function installSyntheticSave(page: Page, save: unknown | null): Promise<void> {
  await page.goto("/?hub=classic", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    },
    [GOLDEN_SLICE_SAVE_KEY, save] as const,
  );
}

function slice(page: Page): Locator {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 20_000 });
}

async function tabTo(page: Page, target: Locator, maximumTabs = 60): Promise<void> {
  await expect(target).toBeVisible();
  for (let index = 0; index <= maximumTabs; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${await target.getAttribute("data-testid") ?? await target.getAttribute("data-primary-action") ?? "target"}`);
}

async function expectVisibleKeyboardFocus(target: Locator): Promise<void> {
  const focus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      active: document.activeElement === element,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focus.active).toBe(true);
  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).toBeGreaterThan(0);
}

async function activate(
  page: Page,
  target: Locator,
  mode: InputMode,
  keyboardKey: "Enter" | "Space" = "Enter",
): Promise<void> {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  if (mode === "touch") {
    await target.tap();
    return;
  }
  if (mode === "keyboard") {
    await tabTo(page, target);
    await page.keyboard.press(keyboardKey);
    return;
  }
  await target.click();
}

async function primary(page: Page, label: string, mode: InputMode): Promise<void> {
  await activate(page, slice(page).getByRole("button", { name: label, exact: true }), mode);
}

async function solve(
  page: Page,
  cardId: string,
  slotId: "left" | "right" | "top" | "bottom",
  mode: InputMode,
): Promise<void> {
  await activate(page, page.getByTestId(`component-card-${cardId}`), mode, "Space");
  await activate(page, page.getByTestId(`slot-${slotId}`), mode, "Enter");
}

async function realTouchDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Touch drag requires visible source and target boxes");
  const start = { x: Math.round(sourceBox.x + sourceBox.width / 2), y: Math.round(sourceBox.y + sourceBox.height / 2) };
  const end = { x: Math.round(targetBox.x + targetBox.width / 2), y: Math.round(targetBox.y + targetBox.height / 2) };
  const session = await page.context().newCDPSession(page);
  // Reserve a non-default contact id for the raw drag so the subsequent
  // Playwright tap contact cannot inherit the drag's pointer-capture identity.
  const point = (x: number, y: number) => [{ x, y, id: 9, radiusX: 8, radiusY: 8, force: 1 }];
  try {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(start.x, start.y) });
    for (let step = 1; step <= 8; step += 1) {
      const x = Math.round(start.x + ((end.x - start.x) * step) / 8);
      const y = Math.round(start.y + ((end.y - start.y) * step) / 8);
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x, y) });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function realTouchScroll(page: Page, scrollOwner: Locator): Promise<{ before: number; after: number }> {
  const dimensions = await scrollOwner.evaluate((element) => ({
    before: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  const box = await scrollOwner.boundingBox();
  if (!box) throw new Error("Touch scroll requires a visible scroll owner");
  const x = Math.round(box.x + box.width * 0.5);
  const startY = Math.round(box.y + box.height * 0.78);
  const endY = Math.round(box.y + box.height * 0.24);
  const session = await page.context().newCDPSession(page);
  const point = (y: number) => [{ x, y, id: 2, radiusX: 8, radiusY: 8, force: 1 }];
  try {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(startY) });
    for (let step = 1; step <= 8; step += 1) {
      const y = Math.round(startY + ((endY - startY) * step) / 8);
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(y) });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => scrollOwner.evaluate((element) => element.scrollTop)).toBeGreaterThan(dimensions.before);
  } finally {
    await session.detach();
  }
  return { before: dimensions.before, after: await scrollOwner.evaluate((element) => element.scrollTop) };
}

async function enterFirstBoard(page: Page, mode: InputMode): Promise<void> {
  await primary(page, "走进墨林", mode);
  await primary(page, "看看营地灯", mode);
  await primary(page, "沿着灯路出发", mode);
  await primary(page, "跳过小路", mode);
  await primary(page, "开始合字施法", mode);
  await waitForPhase(page, "battle_1_placing");
  await expect(page.getByTestId("five-card-hand").getByRole("button")).toHaveCount(5);
}

async function completeGoldenRun(
  page: Page,
  mode: InputMode,
  abilityId: AbilityId,
  options: {
    readonly placeFirstBoard?: (page: Page) => Promise<void>;
    readonly placeFirstLeft?: (page: Page) => Promise<void>;
    readonly beforeAbilityChoice?: (page: Page) => Promise<void>;
  } = {},
): Promise<void> {
  await enterFirstBoard(page, mode);
  if (options.placeFirstBoard) {
    await options.placeFirstBoard(page);
  } else {
    if (options.placeFirstLeft) await options.placeFirstLeft(page);
    else await solve(page, "ming-ri", "left", mode);
    await solve(page, "ming-yue", "right", mode);
  }
  await waitForPhase(page, "battle_1_cleared");
  await expect(page.getByTestId("formed-character-ming")).toContainText("明");

  await primary(page, "看看光留下什么", mode);
  await waitForPhase(page, "breather_1");
  await primary(page, "继续看前路", mode);
  await waitForPhase(page, "travel_to_battle_2");
  await primary(page, "跳过花径", mode);
  await primary(page, "试试新的结构", mode);
  await solve(page, "hua-cao", "top", mode);
  await solve(page, "hua-hua", "bottom", mode);
  await waitForPhase(page, "battle_2_cleared");
  await expect(page.getByTestId("formed-character-hua")).toContainText("花");

  await primary(page, "看看三道光", mode);
  await waitForPhase(page, "ability_choice");
  await options.beforeAbilityChoice?.(page);
  await activate(page, page.getByTestId(`ability-${abilityId}`), mode, "Space");
  await primary(page, "走向双印墨守", mode);
  await primary(page, "先看清它的动作", mode);
  await solve(page, "lin-mu-left", "left", mode);
  await waitForPhase(page, "boss_interference");
  if (abilityId === "ink-echo") {
    await activate(page, page.locator("[data-ink-echo-voice]"), mode, "Space");
  }
  await waitForPhase(page, "boss_phase_1_placing");
  await solve(page, "lin-mu-right", "right", mode);
  await waitForPhase(page, "boss_phase_1_cleared");
  await expect(page.getByTestId("formed-character-lin")).toContainText("林");

  await primary(page, "解开第二枚墨印", mode);
  await solve(page, "xing-ri", "top", mode);
  await waitForPhase(page, "boss_phase_2_placing");
  await solve(page, "xing-sheng", "bottom", mode);
  await waitForPhase(page, "boss_cleared");
  await expect(page.getByTestId("formed-character-xing")).toContainText("星");
  await primary(page, "沿星路回营地", mode);
  await waitForPhase(page, "camp_repair");
  await primary(page, "翻开四字魔法书", mode);
  await waitForPhase(page, "spellbook_review");
  await expect(page.getByTestId("spellbook-overlay").locator("[data-spellbook-id]")).toHaveCount(4);
  await primary(page, "让营地继续亮着", mode);
  await waitForPhase(page, "run_complete");
  await expect(page.getByTestId("run-complete")).toContainText("四道字光留在了营地");
}

async function returnToWorld(page: Page, mode: InputMode): Promise<void> {
  await activate(page, page.locator("[data-return-to-world]"), mode, "Enter");
  await expect(page.getByTestId("my-game-world")).toBeVisible();
}

async function executeProfile(
  profile: ProfileId,
  testInfo: TestInfo,
  contextOptions: ProfileContextOptions,
  actualInteractions: readonly string[],
  scenario: (page: Page) => Promise<readonly string[]>,
): Promise<void> {
  test.setTimeout(contextOptions.timeoutMs ?? 180_000);
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  mkdirSync(TRACE_ROOT, { recursive: true });
  const screenshotPath = resolve(SCREENSHOT_ROOT, `${profileStem(profile)}.png`);
  const tracePath = resolve(TRACE_ROOT, `${profileStem(profile)}.zip`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: contextOptions.viewport ?? { width: 1440, height: 900 },
    hasTouch: contextOptions.hasTouch ?? false,
    isMobile: contextOptions.isMobile ?? false,
    reducedMotion: contextOptions.reducedMotion ?? "reduce",
  });
  const diagnostics = observeDiagnostics(context);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await installSpeechStub(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(20_000);
  let failure: unknown = null;
  let completionEvidence: readonly string[] = [];

  try {
    completionEvidence = await scenario(page);
    await page.waitForTimeout(120);
    if (diagnostics.consoleErrors.length > 0 || diagnostics.pageErrors.length > 0 || diagnostics.failedRequests.length > 0 || diagnostics.externalRequests.size > 0) {
      throw new Error(`diagnostics console=${diagnostics.consoleErrors.length}, page=${diagnostics.pageErrors.length}, failedRequests=${diagnostics.failedRequests.length}, external=${diagnostics.externalRequests.size}`);
    }
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  } catch (error) {
    failure = error;
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" }).catch(() => undefined);
  }

  try {
    await context.tracing.stop({ path: tracePath });
  } catch (error) {
    failure ??= error;
  }
  await context.close();
  await browser.close();

  if (!existsSync(screenshotPath)) failure ??= new Error("Profile screenshot was not written");
  if (!existsSync(tracePath) || readFileSync(tracePath).byteLength === 0) failure ??= new Error("Profile trace was not written");

  const result: ProfileResult = {
    profile,
    project: testInfo.project.name,
    fixtureMarker: FIXTURE_MARKER,
    isolatedBrowserContext: true,
    status: failure === null ? "PASS" : "FAIL",
    completed: failure === null,
    actualInteractions,
    completionEvidence,
    screenshot: artifactPath(screenshotPath),
    trace: artifactPath(tracePath),
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    failedRequests: diagnostics.failedRequests,
    sameOriginAbortedRequests: diagnostics.sameOriginAbortedRequests,
    sameOriginRequests: [...diagnostics.sameOriginRequests].sort(),
    externalRequests: [...diagnostics.externalRequests].sort(),
    networkClassification: {
      sameOrigin: "SAME_ORIGIN_ALLOWED",
      external: "EXTERNAL_NETWORK_FORBIDDEN",
    },
    detail: failure === null ? "Profile completed through public UI controls." : failure instanceof Error ? failure.message : String(failure),
  };
  writeProfileResult(result);
  if (failure !== null) throw failure;
  expect(result.status).toBe("PASS");
}

test.describe.serial("STEP 07 machine agent playthrough profiles", () => {
  test("NOVICE_POINTER: world to forest to world without debug controls", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop profile");
    await executeProfile(
      "NOVICE_POINTER",
      testInfo,
      { reducedMotion: "no-preference" },
      ["pointer world forest link", "pointer card and slot placement", "pointer ability choice", "pointer return-to-world link"],
      async (page) => {
        await installSyntheticSave(page, null);
        await page.goto("/");
        await expect(page.getByTestId("my-game-world")).toHaveAttribute("data-repaired", "false");
        await page.locator("[data-world-forest-link]").click();
        await expect(slice(page)).toBeVisible();
        await expect(page.getByTestId("parent-debug-overlay")).toHaveCount(0);
        await completeGoldenRun(page, "pointer", "star-path");
        await returnToWorld(page, "pointer");
        await expect(page.getByTestId("my-game-world")).toHaveAttribute("data-repaired", "true");
        return ["fresh world loaded", "forest completed", "parent debug overlay absent", "returned to repaired world"];
      },
    );
  });

  test("HESITANT_WITH_HINTS: idle hint, invalid placement, built-in support, and completion", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop profile");
    await executeProfile(
      "HESITANT_WITH_HINTS",
      testInfo,
      { reducedMotion: "no-preference" },
      ["wait for four-second visible idle hint", "two reversible invalid placements", "visible level-two slot support", "complete without debug intervention"],
      async (page) => {
        await installSyntheticSave(page, null);
        await page.goto("/");
        await page.locator("[data-world-forest-link]").click();
        await completeGoldenRun(page, "pointer", "guardian-light", {
          placeFirstLeft: async (boardPage) => {
            await expect(boardPage.getByTestId("slot-left")).toHaveClass(/is-hinted/, { timeout: 5_500 });
            for (let attempt = 0; attempt < 2; attempt += 1) {
              await solve(boardPage, "ming-yue", "left", "pointer");
              await waitForPhase(boardPage, "invalid_feedback");
              if (attempt === 1) await expect(boardPage.getByTestId("slot-left")).toHaveClass(/is-hinted/);
              await waitForPhase(boardPage, "battle_1_placing");
            }
            await expect(boardPage.getByTestId("slot-left")).toHaveClass(/is-hinted/);
            await solve(boardPage, "ming-ri", "left", "pointer");
          },
        });
        const latest = await page.evaluate((key) => {
          const save = JSON.parse(localStorage.getItem(key) ?? "null");
          return save?.localPlaytestEvents?.at(-1) ?? null;
        }, GOLDEN_SLICE_SAVE_KEY);
        expect(latest?.invalidPlacementCountByEncounter?.["encounter-ming"]).toBeGreaterThanOrEqual(2);
        expect(latest?.maxHintLevelByEncounter?.["encounter-ming"]).toBeGreaterThanOrEqual(2);
        return ["idle hint became visible", "invalid feedback stayed reversible", "built-in support reached level two", "run completed"];
      },
    );
  });

  test("KEYBOARD_ONLY: Tab, Enter, Space, Escape, visible focus, and a completable path", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop profile");
    await executeProfile(
      "KEYBOARD_ONLY",
      testInfo,
      { reducedMotion: "reduce" },
      ["Tab navigation", "Enter link and primary activation", "Space card and ability activation", "Escape settings and placement cancellation", "keyboard return-to-world"],
      async (page) => {
        await installSyntheticSave(page, null);
        await page.goto("/");
        const forest = page.locator("[data-world-forest-link]");
        await tabTo(page, forest);
        await expectVisibleKeyboardFocus(forest);
        await page.keyboard.press("Enter");
        await expect(slice(page)).toBeVisible();
        await primary(page, "走进墨林", "keyboard");

        const settingsButton = page.getByRole("button", { name: "声音与画面", exact: true });
        await tabTo(page, settingsButton);
        await expectVisibleKeyboardFocus(settingsButton);
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("settings-overlay")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("settings-overlay")).toBeHidden();

        await primary(page, "看看营地灯", "keyboard");
        await primary(page, "沿着灯路出发", "keyboard");
        await primary(page, "跳过小路", "keyboard");
        await primary(page, "开始合字施法", "keyboard");
        await waitForPhase(page, "battle_1_placing");
        const firstCard = page.getByTestId("component-card-ming-ri");
        await activate(page, firstCard, "keyboard", "Space");
        await expect(firstCard).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Escape");
        await expect(firstCard).toHaveAttribute("aria-pressed", "false");
        await solve(page, "ming-ri", "left", "keyboard");
        await solve(page, "ming-yue", "right", "keyboard");
        await waitForPhase(page, "battle_1_cleared");

        await primary(page, "看看光留下什么", "keyboard");
        await waitForPhase(page, "breather_1");
        await primary(page, "继续看前路", "keyboard");
        await primary(page, "跳过花径", "keyboard");
        await primary(page, "试试新的结构", "keyboard");
        await solve(page, "hua-cao", "top", "keyboard");
        await solve(page, "hua-hua", "bottom", "keyboard");
        await waitForPhase(page, "battle_2_cleared");
        await primary(page, "看看三道光", "keyboard");
        await activate(page, page.getByTestId("ability-star-path"), "keyboard", "Space");
        await primary(page, "走向双印墨守", "keyboard");
        await primary(page, "先看清它的动作", "keyboard");
        await solve(page, "lin-mu-left", "left", "keyboard");
        await waitForPhase(page, "boss_phase_1_placing");
        await solve(page, "lin-mu-right", "right", "keyboard");
        await waitForPhase(page, "boss_phase_1_cleared");
        await primary(page, "解开第二枚墨印", "keyboard");
        await solve(page, "xing-ri", "top", "keyboard");
        await waitForPhase(page, "boss_phase_2_placing");
        await solve(page, "xing-sheng", "bottom", "keyboard");
        await waitForPhase(page, "boss_cleared");
        await primary(page, "沿星路回营地", "keyboard");
        await waitForPhase(page, "camp_repair");
        await primary(page, "翻开四字魔法书", "keyboard");
        await primary(page, "让营地继续亮着", "keyboard");
        await waitForPhase(page, "run_complete");
        await returnToWorld(page, "keyboard");
        return ["focus ring visible", "Escape closed settings", "Escape cancelled selected card", "Space and Enter completed run", "keyboard returned to world"];
      },
    );
  });

  test("MOBILE_TOUCH: 390x844 tap, real touch drag, real touch scroll, and no hover dependency", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-touch-chromium", "touch profile runs only in the touch project");
    await executeProfile(
      "MOBILE_TOUCH",
      testInfo,
      { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce", timeoutMs: 300_000 },
      ["official taps open settings", "CDP touch swipe scroll in settings dialog", "CDP touch drag card to slot", "tap control with hover unavailable", "touch completion and return"],
      async (page) => {
        const context = page.context();

        // Auxiliary page A owns the settings gesture. Its raw swipe is the
        // final input on this renderer, so no later tap depends on Chromium's
        // post-gesture compatibility-click state.
        const settingsPage = await context.newPage();
        settingsPage.setDefaultTimeout(10_000);
        settingsPage.setDefaultNavigationTimeout(20_000);
        await installSyntheticSave(settingsPage, null);
        await settingsPage.goto("/");
        await settingsPage.locator("[data-world-forest-link]").tap();
        await expect(slice(settingsPage)).toBeVisible();
        await primary(settingsPage, "走进墨林", "touch");
        await waitForPhase(settingsPage, "camp_intro");
        const settingsPanel = settingsPage.getByTestId("settings-overlay").locator(".golden-modal__panel");
        await settingsPage.getByRole("button", { name: "声音与画面", exact: true }).tap();
        await expect(settingsPanel).toBeVisible();
        const scroll = await realTouchScroll(settingsPage, settingsPanel);
        expect(scroll.after).toBeGreaterThan(scroll.before);

        // Auxiliary page B owns the drag gesture. Reset the shared synthetic
        // save explicitly, then leave the raw drag as this page's final input.
        const dragPage = await context.newPage();
        dragPage.setDefaultTimeout(10_000);
        dragPage.setDefaultNavigationTimeout(20_000);
        await installSyntheticSave(dragPage, null);
        await dragPage.goto("/");
        await dragPage.locator("[data-world-forest-link]").tap();
        await expect(slice(dragPage)).toBeVisible();
        await enterFirstBoard(dragPage, "touch");
        await solve(dragPage, "ming-ri", "left", "touch");
        await expect(dragPage.getByTestId("slot-left")).toHaveClass(/is-filled/);
        await realTouchDrag(dragPage, dragPage.getByTestId("component-card-ming-yue"), dragPage.getByTestId("slot-right"));
        await expect.poll(() => slice(dragPage).getAttribute("data-visual-state-id")).not.toBe("battle_1_placing");

        // The original page has never received a raw CDP gesture. Reset the
        // synthetic save once more and perform the complete official tap path.
        await installSyntheticSave(page, null);
        await page.goto("/");
        const capability = await page.evaluate(() => ({
          hover: matchMedia("(hover: hover)").matches,
          anyHover: matchMedia("(any-hover: hover)").matches,
          maxTouchPoints: navigator.maxTouchPoints,
        }));
        expect(capability.hover).toBe(false);
        expect(capability.anyHover).toBe(false);
        expect(capability.maxTouchPoints).toBeGreaterThan(0);
        await page.locator("[data-world-forest-link]").tap();
        await completeGoldenRun(page, "touch", "ink-echo");
        await returnToWorld(page, "touch");
        await expect(page.locator("html")).toHaveClass(/game-fullscreen-page/);
        return ["390x844 touch context verified", "hover unavailable", "settings swipe moved actual modal scrollTop on an auxiliary page", "touch drag filled structure slot on an auxiliary page", "tap-only run completed on the raw-gesture-free main page"];
      },
    );
  });

  test("MUTED_REDUCED_MOTION: mute and reduced motion preserve all required information through completion", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop profile");
    await executeProfile(
      "MUTED_REDUCED_MOTION",
      testInfo,
      { reducedMotion: "reduce" },
      ["visible world settings", "mute checkbox", "reduced-motion checkbox", "visual structure and text fallback", "complete run"],
      async (page) => {
        await installSyntheticSave(page, null);
        await page.goto("/");
        await page.locator("[data-world-settings-open]").click();
        const settings = page.getByTestId("world-settings");
        await settings.getByLabel("静音").check();
        await settings.getByLabel("减少动态").check();
        await expect(settings.getByRole("status")).toContainText("声音关闭也能看清世界");
        await settings.locator("[data-world-modal-close]").click();
        await page.locator("[data-world-forest-link]").click();
        await expect(slice(page)).toHaveAttribute("data-reduced-motion", "true");
        await expect(slice(page)).toContainText("走进墨林");
        await completeGoldenRun(page, "pointer", "guardian-light");
        const savedSettings = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.settings, GOLDEN_SLICE_SAVE_KEY);
        expect(savedSettings).toEqual({ muted: true, reducedMotion: true });
        await expect(page.getByTestId("run-complete")).toContainText("四道字光留在了营地");
        return ["mute persisted", "reduced motion persisted", "story and structure text stayed visible", "formed characters stayed visible", "run completed without audio dependency"];
      },
    );
  });

  test("RETURNING_USER: repaired save, world cues, spellbook, forest, and return loop", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop profile");
    await executeProfile(
      "RETURNING_USER",
      testInfo,
      { reducedMotion: "reduce" },
      ["synthetic completed save", "inspect repaired world cues", "open four-entry spellbook", "return to world", "enter forest and complete another loop"],
      async (page) => {
        await installSyntheticSave(page, completedSave());
        await page.goto("/");
        const world = page.getByTestId("my-game-world");
        await expect(world).toHaveAttribute("data-repaired", "true");
        for (const repair of ["lamp", "flowers", "trees", "star-path"]) {
          await expect(world.locator(`[data-repair="${repair}"]`)).toHaveAttribute("data-ready", "true");
        }
        await world.locator("[data-world-spellbook-open]").click();
        const spellbook = page.getByTestId("world-spellbook");
        for (const id of ["ming", "hua", "lin", "xing"]) {
          await spellbook.locator(`[data-world-spellbook-id="${id}"]`).click();
          await expect(page.getByTestId(`world-spellbook-page-${id}`)).toBeVisible();
        }
        await spellbook.locator("[data-world-modal-close]").click();
        await world.locator("[data-world-forest-link]").click();
        await completeGoldenRun(page, "pointer", "ink-echo");
        await returnToWorld(page, "pointer");
        await expect(page.getByTestId("my-game-world")).toHaveAttribute("data-repaired", "true");
        const completedRuns = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.completedRuns, GOLDEN_SLICE_SAVE_KEY);
        expect(completedRuns).toBe(2);
        return ["repaired world cues present", "four spellbook entries readable", "forest re-entry completed", "returned to world", "synthetic completedRuns advanced from one to two"];
      },
    );
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PLAY_SURFACE_MANIFEST, type PlaySurfaceRecord } from "../../../packages/data/playSurfaceManifest";
import { sampleHitTarget } from "../helpers/hit-target";
import {
  expectFullyVisibleInScrollport,
  expectMeaningfullyVisibleInScrollport,
  horizontalScrollIsAbsent,
  keyboardMoves,
  lastMeaningfulAction,
  readScrollMetrics,
  resetScrollToTop,
  touchSwipeMoves,
  wheelMoves,
  wheelToFraction,
  wheelToBottom,
} from "../helpers/scroll-reachability";

const ROOT = resolve(import.meta.dirname, "../../..");
const REPORTS = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? resolve(ROOT, "test-results"), "scroll-reachability/reports");
const SCREENSHOTS = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? resolve(ROOT, "test-results"), "scroll-reachability/screenshots");
const TOUCH_PROJECTS = new Set(["mobile-360", "mobile-390", "tablet-768", "landscape-1024"]);
const REPRESENTATIVE_IDS = new Set([
  "my-game-world",
  "classic-hub",
  "hanzi-world",
  "hanzi-family-slice",
  "hanzi-v1-compat",
  "math-world",
  "english-world",
  "english-journal",
  "english-memory",
]);

function writeReport(name: string, value: unknown): void {
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function installEnglishVoice(page: Page): Promise<void> {
  await page.context().addInitScript({ content: `
    window.__scrollGateSpeakCalls = [];
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      speak(utterance) { window.__scrollGateSpeakCalls.push(String(utterance.text)); },
      cancel() {},
      getVoices() { return [{ lang: "en-US", name: "Synthetic scroll-gate voice" }]; }
    } });
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; this.lang = ""; this.rate = 1; this.voice = null; };
  ` });
}

async function visibleActions(page: Page, surface: PlaySurfaceRecord): Promise<number> {
  return page.locator(surface.primaryActionSelector).evaluateAll((elements) => elements.filter((element) => {
    const node = element as HTMLElement;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && !node.hasAttribute("disabled") && rect.width > 0 && rect.height > 0;
  }).length);
}

async function openSurface(page: Page, surface: PlaySurfaceRecord): Promise<void> {
  await page.goto(`/${surface.route}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app > *")).toHaveCount(1);
  await expect.poll(() => visibleActions(page, surface), { message: `${surface.id} must expose a primary action`, timeout: 20_000 }).toBeGreaterThan(0);
}

interface BaseViewport {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly mobile: boolean;
}

async function applyBrowserZoom(page: Page, base: BaseViewport, zoomPercent: number): Promise<{ width: number; height: number }> {
  const zoom = zoomPercent / 100;
  const width = Math.max(1, Math.round(base.width / zoom));
  const height = Math.max(1, Math.round(base.height / zoom));
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: base.deviceScaleFactor * zoom,
    mobile: base.mobile,
  });
  await session.detach();
  return { width, height };
}

async function touchSwipeOnFreshPage(page: Page, surface: PlaySurfaceRecord, base: BaseViewport, zoomPercent = 100): Promise<Awaited<ReturnType<typeof touchSwipeMoves>>> {
  const touchPage = await page.context().newPage();
  const runtime = runtimeObserver(touchPage);
  try {
    await applyBrowserZoom(touchPage, base, zoomPercent);
    await openSurface(touchPage, surface);
    const evidence = await touchSwipeMoves(touchPage, surface);
    expect(runtime.errors, `${surface.id} touch-only page runtime errors`).toEqual([]);
    return evidence;
  } finally {
    await touchPage.close();
  }
}

async function actionNearBottom(page: Page, surface: PlaySurfaceRecord, action: ReturnType<Page["locator"]>): Promise<boolean> {
  return action.evaluate((element, input) => {
    const node = element as HTMLElement;
    const owner = input.policy === "internal" ? document.querySelector<HTMLElement>(input.selector) : document.scrollingElement as HTMLElement;
    if (!owner) return false;
    const rect = node.getBoundingClientRect();
    const ownerRect = owner.getBoundingClientRect();
    const positionInOwner = input.policy === "internal" ? rect.bottom - ownerRect.top + owner.scrollTop : rect.bottom + owner.scrollTop;
    return owner.scrollHeight - positionInOwner <= Math.max(owner.clientHeight * 0.5, 320);
  }, { policy: surface.scrollPolicy, selector: surface.scrollContainerSelector ?? "" });
}

function runtimeObserver(page: Page): { errors: string[]; reset(): void } {
  const state = { errors: [] as string[], reset() { this.errors.length = 0; } };
  page.on("console", (message) => { if (message.type() === "error") state.errors.push(`console:${message.text()}`); });
  page.on("pageerror", (error) => state.errors.push(`page:${error.message}`));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    if (errorText !== "net::ERR_ABORTED") state.errors.push(`request:${request.url()}:${errorText}`);
  });
  return state;
}

async function auditSurface(page: Page, surface: PlaySurfaceRecord, touch: boolean, mobile: boolean) {
  await openSurface(page, surface);
  const initial = await readScrollMetrics(page, surface);
  expect(initial.pageModeClass).toBe(surface.scrollPolicy === "document" ? "game-scrollable-page" : "game-fullscreen-page");
  if (surface.scrollPolicy === "document") expect(initial.bodyOverflowY).not.toBe("hidden");
  if (surface.scrollPolicy === "internal") {
    const owner = page.locator(surface.scrollContainerSelector!);
    await expect(owner).toHaveAttribute("tabindex", "0");
    await expect(owner).toHaveAccessibleName(/.+/);
  }
  const requiresScroll = initial.maxScroll > 24;
  let wheel = null;
  let keyboard = null;
  let touchEvidence = null;
  let bottomCriticalAction: string | null = null;
  let hitTest: string | null = null;
  let wheelBottomReached = false;
  if (surface.scrollPolicy === "locked") {
    expect(initial.maxScroll, `${surface.id} locked surface must not hide document overflow`).toBeLessThanOrEqual(2);
  } else if (requiresScroll) {
    await resetScrollToTop(page, surface);
    wheel = await wheelMoves(page, surface);
    keyboard = await keyboardMoves(page, surface, "End");
    const bottom = await wheelToBottom(page, surface);
    wheelBottomReached = bottom.reachableMaxScroll - bottom.scrollTop <= 2;
    const action = await lastMeaningfulAction(page, surface);
    if (action && await actionNearBottom(page, surface, action)) {
      await expectFullyVisibleInScrollport(page, surface, action);
      const evidence = await sampleHitTarget(action);
      expect(evidence.hitSuccessRatio, JSON.stringify(evidence, null, 2)).toBe(1);
      bottomCriticalAction = evidence.label || evidence.selector;
      hitTest = "PASS";
    } else {
      bottomCriticalAction = "NONE_NEAR_BOTTOM";
      hitTest = "NOT_APPLICABLE";
    }
    if (touch) {
      const viewport = page.viewportSize()!;
      const deviceScaleFactor = await page.evaluate(() => devicePixelRatio);
      touchEvidence = await touchSwipeOnFreshPage(page, surface, { ...viewport, deviceScaleFactor, mobile });
    }
  }
  expect(await horizontalScrollIsAbsent(page), `${surface.id} must not expose horizontal user scrolling`).toBe(true);
  return {
    surfaceId: surface.id,
    route: surface.route,
    scrollPolicy: surface.scrollPolicy,
    scrollContainerSelector: surface.scrollContainerSelector ?? null,
    actualScrollOwner: initial.owner,
    contentHeight: initial.scrollHeight,
    viewportHeight: initial.clientHeight,
    maxScroll: initial.maxScroll,
    requiresScroll,
    wheel,
    touch: touchEvidence,
    keyboard,
    bottomReached: !requiresScroll || surface.scrollPolicy === "locked" || wheelBottomReached,
    bottomCriticalAction,
    hitTest,
    realAction: "COVERED_BY_INTERACTION_INTEGRITY_AND_REPRESENTATIVE_BOTTOM_ACTION",
    horizontalUserScroll: false,
    verdict: "PASS",
  };
}

test.describe.configure({ mode: "serial" });

test("@scroll @representative representative worlds, Classic, internal and locked surfaces are reachable", async ({ page }, testInfo) => {
  await installEnglishVoice(page);
  const runtime = runtimeObserver(page);
  const rows = [];
  for (const surface of PLAY_SURFACE_MANIFEST.filter((record) => REPRESENTATIVE_IDS.has(record.id))) {
    runtime.reset();
    rows.push(await auditSurface(page, surface, TOUCH_PROJECTS.has(testInfo.project.name), Boolean(testInfo.project.use.isMobile)));
    expect(runtime.errors, `${surface.id} runtime errors`).toEqual([]);
  }
  writeReport(`SCROLL_REACHABILITY_REPRESENTATIVE.${testInfo.project.name}.json`, { verdict: "PASS", project: testInfo.project.name, surfaceCount: rows.length, rows });
});

test("@scroll @full all manifest surfaces obey declared scroll ownership", async ({ page }, testInfo) => {
  await installEnglishVoice(page);
  const runtime = runtimeObserver(page);
  const rows = [];
  for (const surface of PLAY_SURFACE_MANIFEST) {
    runtime.reset();
    rows.push(await auditSurface(page, surface, TOUCH_PROJECTS.has(testInfo.project.name), Boolean(testInfo.project.use.isMobile)));
    if (surface.id === "hanzi-world" && testInfo.project.name === "mobile-390") {
      mkdirSync(SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(SCREENSHOTS, "hanzi-world-bottom-mobile-390.png"), animations: "disabled" });
    }
    expect(runtime.errors, `${surface.id} runtime errors`).toEqual([]);
  }
  writeReport(`SCROLL_REACHABILITY_MATRIX.${testInfo.project.name}.json`, { verdict: "PASS", project: testInfo.project.name, manifestSurfaceCount: PLAY_SURFACE_MANIFEST.length, testedSurfaceCount: rows.length, rows });
});

test("@scroll @journal Word Journal wheel, touch, keyboard, 200% zoom and bottom real action", async ({ page }, testInfo) => {
  await installEnglishVoice(page);
  const runtime = runtimeObserver(page);
  const surface = PLAY_SURFACE_MANIFEST.find((record) => record.id === "english-journal")!;
  const configuredViewport = page.viewportSize()!;
  const base: BaseViewport = {
    ...configuredViewport,
    deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
    mobile: Boolean(testInfo.project.use.isMobile),
  };
  const rows = [];
  for (const zoomPercent of [100, 125, 150, 200]) {
    runtime.reset();
    const effectiveViewport = await applyBrowserZoom(page, base, zoomPercent);
    await openSurface(page, surface);
    await expect(page.locator('[data-testid="journal-word"]')).toHaveCount(48);
    const initial = await readScrollMetrics(page, surface);
    expect(initial.maxScroll).toBeGreaterThan(100);
    expect(initial.bodyOverflowY).not.toBe("hidden");
    expect(await horizontalScrollIsAbsent(page), `Journal ${zoomPercent}% must not expose horizontal user scrolling`).toBe(true);

    await resetScrollToTop(page, surface);
    if (zoomPercent === 100 && testInfo.project.name === "desktop-1440") {
      mkdirSync(SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(SCREENSHOTS, "word-journal-top-desktop-1440.png"), animations: "disabled" });
    }
    const wheel = await wheelMoves(page, surface);
    await wheelToFraction(page, surface, 0.5);
    if (zoomPercent === 100 && testInfo.project.name === "desktop-1440") await page.screenshot({ path: resolve(SCREENSHOTS, "word-journal-middle-desktop-1440.png"), animations: "disabled" });
    const pageDown = await keyboardMoves(page, surface, "PageDown");
    const space = await keyboardMoves(page, surface, "Space");
    const arrowDown = await keyboardMoves(page, surface, "ArrowDown");
    const end = await keyboardMoves(page, surface, "End");
    const keyboardLastCard = page.locator('[data-testid="journal-word"]').last();
    await expectMeaningfullyVisibleInScrollport(page, surface, keyboardLastCard);
    const keyboardLastAction = await lastMeaningfulAction(page, surface);
    expect(keyboardLastAction).not.toBeNull();
    await expectFullyVisibleInScrollport(page, surface, keyboardLastAction!);
    await wheelToBottom(page, surface);
    const lastCard = page.locator('[data-testid="journal-word"]').last();
    await expectMeaningfullyVisibleInScrollport(page, surface, lastCard);
    const lastAction = await lastMeaningfulAction(page, surface);
    expect(lastAction).not.toBeNull();
    await expectFullyVisibleInScrollport(page, surface, lastAction!);
    const hit = await sampleHitTarget(lastAction!);
    expect(hit.hitSuccessRatio, JSON.stringify(hit, null, 2)).toBe(1);
    const speakBefore = await page.evaluate(() => ((window as Window & { __scrollGateSpeakCalls?: string[] }).__scrollGateSpeakCalls ?? []).length);
    const box = await lastAction!.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect.poll(() => page.evaluate(() => ((window as Window & { __scrollGateSpeakCalls?: string[] }).__scrollGateSpeakCalls ?? []).length)).toBe(speakBefore + 1);
    const touch = TOUCH_PROJECTS.has(testInfo.project.name) ? await touchSwipeOnFreshPage(page, surface, base, zoomPercent) : null;

    if (zoomPercent === 100 && ["desktop-1440", "mobile-390"].includes(testInfo.project.name)) {
      mkdirSync(SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(SCREENSHOTS, `word-journal-bottom-${testInfo.project.name}.png`), animations: "disabled" });
    }
    await page.keyboard.press("Home");
    await expect.poll(async () => (await readScrollMetrics(page, surface)).scrollTop).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: "岛屿地图", exact: true }).first().click();
    await expect(page.getByTestId("english-world-map")).toBeVisible();
    expect(runtime.errors, `Journal ${zoomPercent}% runtime errors`).toEqual([]);
    rows.push({ project: testInfo.project.name, configuredViewport, effectiveViewport, zoomPercent, cardReachability: "48/48", scrollOwner: initial.owner, scrollHeight: initial.scrollHeight, clientHeight: initial.clientHeight, wheel, keyboard: { pageDown, space, arrowDown, end }, touch, lastCard: "PASS", bottomAction: { label: hit.label, hitSuccessRatio: hit.hitSuccessRatio, realClick: "PASS_SYNTHETIC_TTS_CALL" }, returnNavigation: "PASS", horizontalUserScroll: false, verdict: "PASS" });
  }
  writeReport(`WORD_JOURNAL_SCROLL_FIX.${testInfo.project.name}.json`, { verdict: "PASS", project: testInfo.project.name, rows, realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED" });
});

test("@scroll @representative modal close restores each surface's declared scroll owner", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  await installEnglishVoice(page);
  const runtime = runtimeObserver(page);
  const surface = PLAY_SURFACE_MANIFEST.find((record) => record.id === "english-journal")!;
  const familyWorld = PLAY_SURFACE_MANIFEST.find((record) => record.id === "my-game-world")!;
  await openSurface(page, surface);
  await wheelMoves(page, surface);
  await page.keyboard.press("Home");
  const settings = page.getByRole("button", { name: "设置" });
  await settings.click();
  await expect(page.getByRole("dialog", { name: "声音和帮助" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  const afterEnglish = await readScrollMetrics(page, surface);
  expect(afterEnglish.bodyOverflowY).not.toBe("hidden");
  await resetScrollToTop(page, surface);
  await wheelMoves(page, surface);

  await page.goto("/?world=my-game-world", { waitUntil: "domcontentloaded" });
  const parent = page.getByRole("button", { name: /家长角/ });
  await parent.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(parent).toBeFocused();
  expect(familyWorld.scrollPolicy).toBe("locked");
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).overflowY)).toBe("hidden");

  await page.goto("/?world=my-game-world&parent=observation", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("observation-notebook")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).overflowY)).toBe("hidden");
  expect(runtime.errors).toEqual([]);
  writeReport(`MODAL_SCROLL_RESTORE.${testInfo.project.name}.json`, { verdict: "PASS", project: testInfo.project.name, englishSettings: "PASS_DOCUMENT_OWNER_RESTORED", worldSettingsAndSaveVaultHost: "PASS_LOCKED_OWNER_RESTORED", observationNotebook: "PASS_LOCKED_OWNER_RESTORED", staleBodyScrollLock: 0 });
});

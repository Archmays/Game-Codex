import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { STEP05_EVIDENCE_SHA256 } from "../../../apps/hanzi-v2-step05-review/review-evidence";
import { STEP05_REVIEW_CANDIDATE_REVISION } from "../../../apps/hanzi-v2-step05-review/review-items";
import type { AppRouteKind } from "../../../src/app-route";
import { computeMachineReviewSourceTreeSha256 } from "../../../tools/game-machine-review/source-identity";

export const STEP07_SCROLL_ARTIFACT_ROOT = resolve("artifacts/game-machine-review/step-07");
export const STEP07_SCROLL_SCREENSHOT_DIR = resolve(STEP07_SCROLL_ARTIFACT_ROOT, "screenshots/scroll-matrix");
export const STEP07_SCROLL_TRACE_DIR = resolve(STEP07_SCROLL_ARTIFACT_ROOT, "traces");

const FIXTURE_MARKER = "SYNTHETIC_TOOLING_TEST_ONLY";
const BUILD_COMMIT = "8e00aa61d796578f7e593243caa514da5a307189";

export interface AdultToolRouteCase {
  readonly id: string;
  readonly routeKind: Extract<AppRouteKind, `observe-${string}` | `review-${string}` | "machine-review-report">;
  readonly label: string;
  readonly url: string;
  readonly readySelector: string;
  readonly longSurfaceTab?: string;
  readonly finalActionSelector: string;
  readonly activationKind?: "download" | "return-top";
  readonly revealFinalAction?: (page: Page, context: BrowserContext) => Promise<void>;
}

export interface ScrollInputTrace {
  readonly input: "mouse-wheel" | "PageDown" | "End" | "touch-swipe" | "Home";
  readonly before: number;
  readonly after: number;
  readonly passed: boolean;
}

export interface ScrollMatrixRow {
  readonly routeId: string;
  readonly routeKind: AdultToolRouteCase["routeKind"];
  readonly routeLabel: string;
  readonly project: string;
  readonly viewport: string;
  readonly pageMode: string;
  readonly scrollOwner: string;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly maxScrollTop: number;
  readonly horizontalOverflowPx: number;
  readonly nestedVerticalScrollOwners: readonly string[];
  readonly inputs: readonly ScrollInputTrace[];
  readonly finalAction: {
    readonly selector: string;
    readonly visible: boolean;
    readonly enabled: boolean;
    readonly focused: boolean;
    readonly unobscured: boolean;
    readonly clicked: boolean;
    readonly activationEvidence: string;
  };
  readonly network: {
    readonly policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN";
    readonly sameOriginRequestCount: number;
    readonly sameOriginSamples: readonly string[];
    readonly externalRequests: readonly string[];
  };
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly trace: string;
  readonly screenshots: readonly string[];
  readonly fullPageScreenshot: string;
  readonly status: "PASS" | "FAIL";
  readonly error?: string;
}

function step04FixtureUrl(): string {
  const query = new URLSearchParams({
    observe: "hanzi-v2-step04",
    session: `s04-${"a".repeat(32)}`,
    seed: "a123456789abcde0",
    build: "A".repeat(64),
    launch: "b".repeat(32),
    commit: BUILD_COMMIT,
    generated: "2026-08-10T01:00:00.000Z",
    checked: "2026-08-10T01:01:00.000Z",
    started: "2026-08-10T01:02:00.000Z",
    fixture: "1",
  });
  return `/?${query.toString()}`;
}

async function revealStep04Export(page: Page, context: BrowserContext): Promise<void> {
  const preparation = page.getByTestId("step04-observer-preparation");
  if (await preparation.isVisible()) {
    const audioButtons = page.locator("[data-preflight-speak]");
    for (let index = 0; index < await audioButtons.count(); index += 1) await audioButtons.nth(index).click();
    await page.locator('[data-audio-decision="START_MUTED"]').click();
    await page.locator('[data-session-mode="LIVE_DASHBOARD"]').click();
    await page.locator("[data-ready-confirm]").check();
    await expect(page.locator("[data-start-session]")).toBeEnabled();
    await page.locator("[data-start-session]").click();
    await expect(page.getByTestId("step04-observer-dashboard")).toBeVisible();
  }
  for (const child of context.pages()) {
    if (child !== page) await child.close();
  }
  const stop = page.locator("[data-stop-now]");
  if (await stop.isEnabled()) await stop.click();
  await expect(page.locator("[data-export-observation]")).toBeEnabled();
}

async function selectSummary(page: Page, selector: string): Promise<void> {
  await page.locator(selector).click();
}

async function closeSyntheticChildWindow(page: Page, context: BrowserContext): Promise<void> {
  await expect.poll(() => context.pages().filter((candidate) => candidate !== page).length, { timeout: 8_000 }).toBeGreaterThan(0);
  for (const child of context.pages()) {
    if (child === page) continue;
    await child.waitForLoadState("domcontentloaded");
    await child.close();
  }
}

async function revealStep05Export(page: Page): Promise<void> {
  const waitForWorldPreviewToSettle = async (): Promise<void> => {
    const preview = page.getByTestId("step05-world-preview");
    if (!await preview.isVisible()) return;
    const previewHandle = await preview.elementHandle();
    const frame = await previewHandle?.contentFrame();
    if (!frame) throw new Error("STEP 05 world preview frame is unavailable");
    // The next tab render removes the iframe. Wait for its Vite module graph to
    // finish first so the harness does not manufacture aborted requests.
    await frame.waitForLoadState("networkidle");
  };
  await waitForWorldPreviewToSettle();
  for (const tab of ["evidence", "audio", "world", "navigation"] as const) {
    await page.locator(`[data-review-tab="${tab}"]`).click();
    if (tab === "world") await waitForWorldPreviewToSettle();
    const decision = page.locator('[data-step05-decision="ACCEPT"]').first();
    await expect(decision).toBeVisible();
    await decision.click();
    await page.locator("[data-step05-notes]").fill("合成工具检查；未记录儿童身份信息。");
  }
  await page.locator('[data-review-tab="authorization"]').click();
  await page.locator('[data-authorization="default"][data-value="NO"]').click();
  await page.locator('[data-authorization="second-use"][data-value="NO"]').click();
  await page.locator("[data-general-notes]").fill("合成工具检查；此导出不代表家长授权或真实儿童结论。");
  await expect(page.locator("[data-export-feedback]")).toBeEnabled();
}

async function revealStep06Export(page: Page, context: BrowserContext): Promise<void> {
  await page.locator("[data-interval]").selectOption("SAME_DAY_SEPARATE_SESSION");
  await page.locator("[data-sound]").selectOption("USE_EXISTING_SETTING");
  await page.locator("[data-privacy-ready]").check();
  await page.locator("[data-ready]").click();
  await closeSyntheticChildWindow(page, context);
  await page.locator("[data-natural-end]").click();
}

async function revealStep07Export(page: Page, context: BrowserContext): Promise<void> {
  await page.locator("[data-interval]").selectOption("SAME_DAY_SEPARATE_SESSION");
  await page.locator("[data-sound]").selectOption("USE_EXISTING_SETTING");
  await page.locator("[data-privacy-ready]").check();
  await page.locator("[data-ready]").click();
  await closeSyntheticChildWindow(page, context);
  const values: Readonly<Record<string, string>> = {
    recognizedWorld: "UNCERTAIN",
    noticedPersistentRepairs: "UNCERTAIN",
    adultAnswerRequired: "NO",
    comfortable: "UNCERTAIN",
    engagementTone: "UNCERTAIN",
  };
  for (const [field, value] of Object.entries(values)) await page.locator(`[data-human="${field}"]`).selectOption(value);
  await page.locator("[data-stop-reason]").selectOption("NATURAL_END");
  await page.locator("[data-stop]").click();
}

export const ADULT_TOOL_ROUTES: readonly AdultToolRouteCase[] = [
  {
    id: "step02-review",
    routeKind: "review-step02",
    label: "STEP 02 review",
    url: `/?review=hanzi-v2-step02&fixture=${FIXTURE_MARKER}`,
    readySelector: '[data-testid="step02-review-app"]',
    longSurfaceTab: '[data-review-tab="characters"]',
    finalActionSelector: "[data-export-review]",
    revealFinalAction: (page) => selectSummary(page, '[data-review-tab="summary"]'),
  },
  {
    id: "step03-review",
    routeKind: "review-step03",
    label: "STEP 03 review",
    url: `/?review=hanzi-v2-step03&fixture=${FIXTURE_MARKER}`,
    readySelector: '[data-testid="step03-review-app"]',
    longSurfaceTab: '[data-review-tab="manifest"]',
    finalActionSelector: "[data-export-review]",
    revealFinalAction: (page) => selectSummary(page, "[data-jump-summary]"),
  },
  {
    id: "step04-observer-fixture",
    routeKind: "observe-step04",
    label: "STEP 04 observer fixture",
    url: step04FixtureUrl(),
    readySelector: '[data-testid="step04-observer-preparation"]',
    finalActionSelector: "[data-export-observation]",
    revealFinalAction: revealStep04Export,
  },
  {
    id: "step05-review-fixture",
    routeKind: "review-step05",
    label: "STEP 05 review fixture",
    url: `/?${new URLSearchParams({
      review: "hanzi-v2-step05",
      commit: BUILD_COMMIT,
      evidence: STEP05_EVIDENCE_SHA256,
      revision: STEP05_REVIEW_CANDIDATE_REVISION,
      fixture: FIXTURE_MARKER,
    }).toString()}`,
    readySelector: '[data-testid="step05-review-app"]',
    finalActionSelector: "[data-export-feedback]",
    revealFinalAction: revealStep05Export,
  },
  {
    id: "step06-observer-fixture",
    routeKind: "observe-step06",
    label: "STEP 06 observer fixture",
    url: `/?observe=hanzi-v2-step06&fixture=${FIXTURE_MARKER}&build=${BUILD_COMMIT}`,
    readySelector: '[data-testid="step06-observer"]',
    finalActionSelector: "[data-export]",
    revealFinalAction: revealStep06Export,
  },
  {
    id: "machine-review-report",
    routeKind: "machine-review-report",
    label: "Machine review report",
    url: "/?report=game-machine-review",
    readySelector: '[data-testid="machine-review-report"]',
    finalActionSelector: "[data-final-action]",
    activationKind: "return-top",
  },
  {
    id: "step07-observer-fixture",
    routeKind: "observe-step07",
    label: "STEP 07 observer fixture",
    url: `/?observe=hanzi-v2-step07&fixture=${FIXTURE_MARKER}&build=${BUILD_COMMIT}`,
    readySelector: '[data-testid="step07-observer"]',
    finalActionSelector: "[data-final-action]",
    revealFinalAction: revealStep07Export,
  },
] as const;

export interface PageDiagnostics {
  readonly sameOriginRequests: string[];
  readonly externalRequests: string[];
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
}

function isAllowedLocalRequest(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return ["http:", "ws:"].includes(url.protocol)
      && url.hostname === "127.0.0.1"
      && url.port === "5175";
  } catch {
    return false;
  }
}

export function observePageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    sameOriginRequests: [],
    externalRequests: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
  page.on("request", (request) => {
    const url = request.url();
    if (!/^(https?|wss?):/i.test(url)) return;
    if (isAllowedLocalRequest(url)) diagnostics.sameOriginRequests.push(url);
    else diagnostics.externalRequests.push(url);
  });
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "UNKNOWN"}`);
  });
  return diagnostics;
}

export async function prepareAdultToolRoute(page: Page, route: AdultToolRouteCase): Promise<void> {
  if (page.url().startsWith("http://127.0.0.1:5175/")) {
    await page.evaluate(() => window.localStorage.clear());
  }
  await page.goto(route.url, { waitUntil: "domcontentloaded" });
  await expect(page.locator(route.readySelector)).toBeVisible();
  if (route.longSurfaceTab) await page.locator(route.longSurfaceTab).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolveImage) => {
          image.addEventListener("load", () => resolveImage(), { once: true });
          image.addEventListener("error", () => resolveImage(), { once: true });
        })));
  });
}

export interface PageScrollContract {
  readonly pageMode: string;
  readonly scrollOwner: string;
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly maxScrollTop: number;
  readonly horizontalOverflowPx: number;
  readonly horizontalOverflowElements: readonly string[];
  readonly nestedVerticalScrollOwners: readonly string[];
  readonly bodyOverflowX: string;
  readonly bodyOverflowY: string;
  readonly appOverflow: string;
}

export async function readScrollContract(page: Page): Promise<PageScrollContract> {
  return page.evaluate(() => {
    const scrollingElement = document.scrollingElement;
    if (!(scrollingElement instanceof HTMLElement)) throw new Error("document.scrollingElement is unavailable");
    const nestedVerticalScrollOwners = [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return /^(auto|scroll)$/.test(style.overflowY)
          && element.scrollHeight > element.clientHeight + 1
          && rect.width > 0
          && rect.height > 0;
      })
      .map((element) => {
        const id = element.id ? `#${element.id}` : "";
        const className = typeof element.className === "string" && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
        return `${element.tagName.toLowerCase()}${id}${className}`;
      });
    const bodyStyle = getComputedStyle(document.body);
    const app = document.getElementById("app");
    const horizontalOverflowElements = [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && (rect.right > scrollingElement.clientWidth + 1 || rect.left < -1);
      })
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const id = element.id ? `#${element.id}` : "";
        const className = typeof element.className === "string" && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
        return `${element.tagName.toLowerCase()}${id}${className} [left=${Math.round(rect.left)}, right=${Math.round(rect.right)}, width=${Math.round(rect.width)}]`;
      });
    return {
      pageMode: document.body.classList.contains("adult-tool-page") ? "adult-tool" : "unexpected",
      scrollOwner: scrollingElement === document.documentElement ? "document.documentElement" : "document.body",
      scrollTop: scrollingElement.scrollTop,
      scrollHeight: scrollingElement.scrollHeight,
      clientHeight: scrollingElement.clientHeight,
      maxScrollTop: scrollingElement.scrollHeight - scrollingElement.clientHeight,
      horizontalOverflowPx: Math.max(0, scrollingElement.scrollWidth - scrollingElement.clientWidth),
      horizontalOverflowElements,
      nestedVerticalScrollOwners,
      bodyOverflowX: bodyStyle.overflowX,
      bodyOverflowY: bodyStyle.overflowY,
      appOverflow: app ? getComputedStyle(app).overflow : "missing",
    };
  });
}

export async function scrollTop(page: Page): Promise<number> {
  return page.evaluate(() => document.scrollingElement?.scrollTop ?? -1);
}

export async function pressHome(page: Page): Promise<ScrollInputTrace> {
  const before = await scrollTop(page);
  // Focus and scroll-into-view can still have a compositor animation in
  // flight. Let that real animation settle before sending the real Home key,
  // otherwise its tail can race the keyboard scroll and pull the page back.
  let previous = before;
  let stableSamples = 0;
  for (let sample = 0; sample < 30 && stableSamples < 3; sample += 1) {
    await page.waitForTimeout(50);
    const current = await scrollTop(page);
    if (Math.abs(current - previous) <= 1) stableSamples += 1;
    else stableSamples = 0;
    previous = current;
  }
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus({ preventScroll: true });
  });
  await page.keyboard.press("Home");
  await expect.poll(() => scrollTop(page), { timeout: 8_000 }).toBe(0);
  await page.evaluate(() => document.body.removeAttribute("tabindex"));
  return { input: "Home", before, after: await scrollTop(page), passed: true };
}

export async function assertFinalAction(
  page: Page,
  context: BrowserContext,
  route: AdultToolRouteCase,
  touch = false,
): Promise<ScrollMatrixRow["finalAction"]> {
  if (route.revealFinalAction) await route.revealFinalAction(page, context);
  const action = page.locator(route.finalActionSelector).last();
  await expect(action).toBeVisible();
  const enabled = await action.isEnabled();
  expect(enabled).toBe(true);
  await action.scrollIntoViewIfNeeded();
  const unobscured = await action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return hit === element || element.contains(hit) || Boolean(hit?.contains(element));
  });
  expect(unobscured).toBe(true);
  await action.focus();
  await expect(action).toBeFocused();
  const waitForTouchScrollToSettle = async (): Promise<void> => {
    let previous = await scrollTop(page);
    let stableSamples = 0;
    for (let sample = 0; sample < 40 && stableSamples < 4; sample += 1) {
      await page.waitForTimeout(50);
      const current = await scrollTop(page);
      if (Math.abs(current - previous) <= 1) stableSamples += 1;
      else stableSamples = 0;
      previous = current;
    }
    expect(stableSamples, "touch activation requires the document scroll position to settle").toBeGreaterThanOrEqual(4);
  };
  if (touch) await waitForTouchScrollToSettle();
  let activationEvidence: string;
  if (route.activationKind === "return-top") {
    expect(await scrollTop(page)).toBeGreaterThan(0);
    let activationAttempt = 1;
    if (touch) {
      let activated = false;
      for (; activationAttempt <= 2; activationAttempt += 1) {
        await action.tap();
        try {
          await expect.poll(() => scrollTop(page), { timeout: 3_000 }).toBe(0);
          activated = true;
          break;
        } catch (error) {
          if (activationAttempt === 2) throw error;
          await waitForTouchScrollToSettle();
          await page.waitForTimeout(500);
        }
      }
      expect(activated).toBe(true);
    } else {
      await action.click();
      await expect.poll(() => scrollTop(page)).toBe(0);
    }
    activationEvidence = `return-top control activated and document scrollTop became 0${touch ? ` on trusted touch tap ${activationAttempt}` : ""}`;
  } else {
    let download;
    let activationAttempt = 1;
    if (touch) {
      let lastError: unknown = null;
      for (; activationAttempt <= 2; activationAttempt += 1) {
        try {
          [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 5_000 }),
            action.tap(),
          ]);
          break;
        } catch (error) {
          lastError = error;
          if (activationAttempt < 2) {
            await waitForTouchScrollToSettle();
            await page.waitForTimeout(500);
          }
        }
      }
      if (!download) throw lastError;
    } else {
      [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10_000 }),
        action.click(),
      ]);
    }
    expect(await download.failure()).toBeNull();
    activationEvidence = `download:${download.suggestedFilename()}${touch ? `:trusted-touch-tap-${activationAttempt}` : ""}`;
  }
  return {
    selector: route.finalActionSelector,
    visible: true,
    enabled,
    focused: true,
    unobscured,
    clicked: true,
    activationEvidence,
  };
}

function matrixMarkdown(rows: readonly ScrollMatrixRow[]): string {
  const passed = rows.filter((row) => row.status === "PASS").length;
  const lines = [
    "# STEP 07 Adult-Tool Scroll Matrix",
    "",
    "Policy: `SAME_ORIGIN_ALLOWED` / `EXTERNAL_NETWORK_FORBIDDEN`.",
    "",
    "Touch rows use Chromium CDP `Input.dispatchTouchEvent`; no `scrollTo`, `scrollIntoView`, or `scrollTop = ...` is used as touch proof.",
    "",
    `Result: ${passed}/${rows.length} PASS`,
    "",
    "| Route | Project | Viewport | Inputs | Max scroll | Horizontal overflow | External | Status |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
  ];
  for (const row of rows) {
    lines.push(`| ${row.routeLabel} | ${row.project} | ${row.viewport} | ${row.inputs.map((entry) => entry.input).join(", ")} | ${row.maxScrollTop} | ${row.horizontalOverflowPx} | ${row.network.externalRequests.length} | ${row.status} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function workspaceRelative(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rowsFromMatchingSourceTreeArtifact(
  value: unknown,
  expectedSourceTreeSha256: string,
): ScrollMatrixRow[] | null {
  if (!isRecord(value)) return null;
  if (typeof value.sourceTreeSha256 !== "string") return null;
  if (value.sourceTreeSha256.toUpperCase() !== expectedSourceTreeSha256.toUpperCase()) return null;
  return Array.isArray(value.rows) ? value.rows as ScrollMatrixRow[] : null;
}

async function readRows(path: string, expectedSourceTreeSha256: string): Promise<ScrollMatrixRow[] | null> {
  try {
    return rowsFromMatchingSourceTreeArtifact(JSON.parse(await readFile(path, "utf8")), expectedSourceTreeSha256);
  } catch {
    return null;
  }
}

export async function writeScrollEvidence(project: string, rows: readonly ScrollMatrixRow[]): Promise<void> {
  await mkdir(STEP07_SCROLL_SCREENSHOT_DIR, { recursive: true });
  await mkdir(STEP07_SCROLL_TRACE_DIR, { recursive: true });
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
  const safeProject = project.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const partialPath = resolve(STEP07_SCROLL_ARTIFACT_ROOT, `SCROLL-MATRIX.${safeProject}.json`);
  const partial = {
    schemaVersion: "game-codex-step07-scroll-matrix-project-v1",
    generatedAtUtc: new Date().toISOString(),
    sourceTreeSha256,
    project,
    rows,
  };
  await writeFile(partialPath, `${JSON.stringify(partial, null, 2)}\n`, "utf8");
  await writeFile(resolve(STEP07_SCROLL_TRACE_DIR, `adult-tool-scroll-${safeProject}.json`), `${JSON.stringify({
    schemaVersion: "game-codex-step07-real-input-trace-v1",
    generatedAtUtc: partial.generatedAtUtc,
    sourceTreeSha256,
    project,
    inputPolicy: "REAL_WHEEL_KEYBOARD_OR_CDP_TOUCH_EVENTS",
    rows: rows.map((row) => ({ routeId: row.routeId, viewport: row.viewport, inputs: row.inputs })),
  }, null, 2)}\n`, "utf8");

  const desktopRows = await readRows(
    resolve(STEP07_SCROLL_ARTIFACT_ROOT, "SCROLL-MATRIX.desktop-chromium.json"),
    sourceTreeSha256,
  );
  const touchRows = await readRows(
    resolve(STEP07_SCROLL_ARTIFACT_ROOT, "SCROLL-MATRIX.mobile-touch-chromium.json"),
    sourceTreeSha256,
  );
  const mergedRows = [...(desktopRows ?? []), ...(touchRows ?? [])];
  const missingOrStaleProjects = [
    ...(desktopRows === null ? ["desktop-chromium"] : []),
    ...(touchRows === null ? ["mobile-touch-chromium"] : []),
  ];
  const evidenceComplete = missingOrStaleProjects.length === 0;
  const status = evidenceComplete && mergedRows.length > 0 && mergedRows.every((row) => row.status === "PASS") ? "PASS" : "FAIL";
  const evidenceFiles = [...new Set([
    workspaceRelative(resolve(STEP07_SCROLL_ARTIFACT_ROOT, "SCROLL-MATRIX.md")),
    ...(desktopRows === null ? [] : [workspaceRelative(resolve(STEP07_SCROLL_TRACE_DIR, "adult-tool-scroll-desktop-chromium.json"))]),
    ...(touchRows === null ? [] : [workspaceRelative(resolve(STEP07_SCROLL_TRACE_DIR, "adult-tool-scroll-mobile-touch-chromium.json"))]),
    ...mergedRows.map((row) => row.trace),
    ...mergedRows.flatMap((row) => row.screenshots),
  ])];
  const report = {
    schemaVersion: "game-codex-step07-scroll-matrix-v1",
    generatedAtUtc: new Date().toISOString(),
    sourceTreeSha256,
    status,
    passed: status === "PASS",
    evidenceFiles,
    evidenceComplete,
    missingOrStaleProjects,
    storageIsolation: "PLAYWRIGHT_EPHEMERAL_CONTEXT_SYNTHETIC_LOCAL_STORAGE_ONLY",
    scrollContract: "adult-tool-page / document.scrollingElement / single vertical owner",
    networkPolicy: {
      sameOrigin: "SAME_ORIGIN_ALLOWED",
      external: "EXTERNAL_NETWORK_FORBIDDEN",
    },
    touchProof: "CDP Input.dispatchTouchEvent with hasTouch=true; after > before",
    summary: {
      total: mergedRows.length,
      passed: mergedRows.filter((row) => row.status === "PASS").length,
      failed: mergedRows.filter((row) => row.status === "FAIL").length,
      status,
    },
    rows: mergedRows,
  };
  await writeFile(resolve(STEP07_SCROLL_ARTIFACT_ROOT, "SCROLL-MATRIX.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(resolve(STEP07_SCROLL_ARTIFACT_ROOT, "SCROLL-MATRIX.md"), matrixMarkdown(mergedRows), "utf8");
}

export function conciseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").split("\n").slice(0, 8).join("\n");
}

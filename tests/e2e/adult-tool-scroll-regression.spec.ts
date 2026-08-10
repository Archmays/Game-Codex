import { mkdir } from "node:fs/promises";
import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { relative, resolve } from "node:path";
import {
  ADULT_TOOL_ROUTES,
  STEP07_SCROLL_TRACE_DIR,
  STEP07_SCROLL_SCREENSHOT_DIR,
  assertFinalAction,
  conciseError,
  observePageDiagnostics,
  prepareAdultToolRoute,
  pressHome,
  readScrollContract,
  scrollTop,
  writeScrollEvidence,
  type ScrollInputTrace,
  type ScrollMatrixRow,
} from "./support/step07-scroll";

const DESKTOP_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

function screenshotPath(routeId: string, viewport: string, state: string): string {
  return `${STEP07_SCROLL_SCREENSHOT_DIR}/${routeId}-${viewport}-${state}.png`;
}

function evidencePath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function rowTracePath(project: string, routeId: string, viewport: string): string {
  const safe = (value: string) => value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return resolve(
    STEP07_SCROLL_TRACE_DIR,
    "scroll-matrix",
    `${safe(project)}-${safe(routeId)}-${safe(viewport)}.zip`,
  );
}

async function runInIsolatedContext<T>(
  browser: Browser,
  testInfo: TestInfo,
  viewport: { readonly width: number; readonly height: number },
  hasTouch: boolean,
  tracePath: string,
  execute: (page: Page, context: BrowserContext) => Promise<T>,
): Promise<T> {
  const baseURL = typeof testInfo.project.use.baseURL === "string"
    ? testInfo.project.use.baseURL
    : "http://127.0.0.1:5175";
  const context = await browser.newContext({
    baseURL,
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch,
  });
  let traceStarted = false;
  let result: T | undefined;
  let failure: { readonly error: unknown } | undefined;
  try {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    traceStarted = true;
    const page = await context.newPage();
    result = await execute(page, context);
  } catch (error) {
    failure = { error };
  }
  if (traceStarted) {
    try {
      await context.tracing.stop({ path: tracePath });
    } catch (error) {
      failure ??= { error };
    }
  }
  try {
    await context.close();
  } catch (error) {
    failure ??= { error };
  }
  if (failure) throw failure.error;
  return result as T;
}

async function assertAdultToolContract(page: Page) {
  const contract = await readScrollContract(page);
  expect(contract.pageMode).toBe("adult-tool");
  expect(contract.scrollOwner).toBe("document.documentElement");
  expect(contract.bodyOverflowX).toBe("hidden");
  expect(contract.bodyOverflowY).toBe("auto");
  expect(contract.appOverflow).toBe("visible");
  expect(contract.maxScrollTop).toBeGreaterThan(0);
  expect(contract.horizontalOverflowPx, contract.horizontalOverflowElements.join("\n")).toBeLessThanOrEqual(1);
  expect(contract.nestedVerticalScrollOwners).toEqual([]);
  await expect(page.locator("html")).toHaveClass(/adult-tool-page/);
  await expect(page.locator("body")).toHaveClass(/adult-tool-page/);
  await expect(page.locator("body")).not.toHaveClass(/game-fullscreen-page|document-page/);
  return contract;
}

async function realDesktopInputs(page: Page): Promise<ScrollInputTrace[]> {
  const inputs: ScrollInputTrace[] = [];
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing desktop viewport");
  await page.mouse.move(8, 8);
  const wheelBefore = await scrollTop(page);
  await page.mouse.wheel(0, Math.max(520, viewport.height * 0.75));
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(wheelBefore);
  inputs.push({ input: "mouse-wheel", before: wheelBefore, after: await scrollTop(page), passed: true });

  inputs.push(await pressHome(page));
  const pageDownBefore = await scrollTop(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("PageDown");
  await expect.poll(() => scrollTop(page), { timeout: 8_000 }).toBeGreaterThan(pageDownBefore);
  inputs.push({ input: "PageDown", before: pageDownBefore, after: await scrollTop(page), passed: true });

  inputs.push(await pressHome(page));
  const endBefore = await scrollTop(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("End");
  await expect.poll(async () => {
    const current = await readScrollContract(page);
    return current.maxScrollTop - current.scrollTop;
  }, { timeout: 8_000 }).toBeLessThanOrEqual(3);
  const endAfter = await scrollTop(page);
  expect(endAfter).toBeGreaterThan(endBefore);
  inputs.push({ input: "End", before: endBefore, after: endAfter, passed: true });
  return inputs;
}

async function realTouchSwipe(page: Page): Promise<ScrollInputTrace> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing touch viewport");
  await pressHome(page);
  const before = await scrollTop(page);
  expect(before).toBe(0);
  const session = await page.context().newCDPSession(page);
  // Stay outside embedded previews/canvases so the trusted gesture targets the
  // adult document scroller, not a child game surface with touch-action:none.
  const x = 4;
  const startY = Math.round(viewport.height * 0.78);
  const endY = Math.round(viewport.height * 0.22);
  const point = (y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(startY) });
  for (let step = 1; step <= 6; step += 1) {
    const y = Math.round(startY + ((endY - startY) * step) / 6);
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(y) });
    await page.waitForTimeout(16);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before);
  const after = await scrollTop(page);
  await session.detach();
  return { input: "touch-swipe", before, after, passed: after > before };
}

async function executeDesktopRow(
  page: Page,
  testInfo: TestInfo,
  route: (typeof ADULT_TOOL_ROUTES)[number],
  viewport: (typeof DESKTOP_VIEWPORTS)[number],
  tracePath: string,
): Promise<ScrollMatrixRow> {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const diagnostics = observePageDiagnostics(page);
  await page.setViewportSize(viewport);
  await prepareAdultToolRoute(page, route);
  const contract = await assertAdultToolContract(page);
  const topPath = screenshotPath(route.id, viewportLabel, "top");
  await page.screenshot({ path: topPath });
  const inputs = await realDesktopInputs(page);
  const bottomPath = screenshotPath(route.id, viewportLabel, "bottom");
  await page.screenshot({ path: bottomPath });
  const finalAction = await assertFinalAction(page, page.context(), route);
  const finalPath = screenshotPath(route.id, viewportLabel, "final-action");
  await page.screenshot({ path: finalPath });
  const fullPagePath = screenshotPath(route.id, viewportLabel, "full-page");
  await page.screenshot({ path: fullPagePath, fullPage: true });
  inputs.push(await pressHome(page));
  expect(await scrollTop(page)).toBe(0);
  expect(diagnostics.externalRequests).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedRequests).toEqual([]);
  await testInfo.attach(`${route.id}-${viewportLabel}-bottom`, { path: bottomPath, contentType: "image/png" });
  return {
    routeId: route.id,
    routeKind: route.routeKind,
    routeLabel: route.label,
    project: testInfo.project.name,
    viewport: viewportLabel,
    pageMode: contract.pageMode,
    scrollOwner: contract.scrollOwner,
    scrollHeight: contract.scrollHeight,
    clientHeight: contract.clientHeight,
    maxScrollTop: contract.maxScrollTop,
    horizontalOverflowPx: contract.horizontalOverflowPx,
    nestedVerticalScrollOwners: contract.nestedVerticalScrollOwners,
    inputs,
    finalAction,
    network: {
      policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
      sameOriginRequestCount: diagnostics.sameOriginRequests.length,
      sameOriginSamples: [...new Set(diagnostics.sameOriginRequests)].slice(0, 12),
      externalRequests: diagnostics.externalRequests,
    },
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    failedRequests: diagnostics.failedRequests,
    trace: evidencePath(tracePath),
    screenshots: [topPath, bottomPath, finalPath, fullPagePath].map(evidencePath),
    fullPageScreenshot: evidencePath(fullPagePath),
    status: "PASS",
  };
}

async function executeTouchRow(
  page: Page,
  testInfo: TestInfo,
  route: (typeof ADULT_TOOL_ROUTES)[number],
  tracePath: string,
): Promise<ScrollMatrixRow> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing mobile-touch viewport");
  const viewportLabel = `${viewport.width}x${viewport.height}-touch`;
  const diagnostics = observePageDiagnostics(page);
  await prepareAdultToolRoute(page, route);
  const contract = await assertAdultToolContract(page);
  expect(testInfo.project.use.hasTouch).toBe(true);
  const topPath = screenshotPath(route.id, viewportLabel, "top");
  await page.screenshot({ path: topPath });
  const touch = await realTouchSwipe(page);
  const bottomPath = screenshotPath(route.id, viewportLabel, "after-swipe");
  await page.screenshot({ path: bottomPath });
  // Chromium suppresses compatibility taps immediately after a trusted touch
  // gesture. Keep a short human-scale pause so the following tap is a distinct
  // real input rather than a continuation of the swipe sequence.
  await page.waitForTimeout(500);
  const finalAction = await assertFinalAction(page, page.context(), route, true);
  const finalPath = screenshotPath(route.id, viewportLabel, "final-action");
  await page.screenshot({ path: finalPath });
  const fullPagePath = screenshotPath(route.id, viewportLabel, "full-page");
  await page.screenshot({ path: fullPagePath, fullPage: true });
  const home = await pressHome(page);
  expect(diagnostics.externalRequests).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedRequests).toEqual([]);
  await testInfo.attach(`${route.id}-${viewportLabel}-swipe`, { path: bottomPath, contentType: "image/png" });
  return {
    routeId: route.id,
    routeKind: route.routeKind,
    routeLabel: route.label,
    project: testInfo.project.name,
    viewport: viewportLabel,
    pageMode: contract.pageMode,
    scrollOwner: contract.scrollOwner,
    scrollHeight: contract.scrollHeight,
    clientHeight: contract.clientHeight,
    maxScrollTop: contract.maxScrollTop,
    horizontalOverflowPx: contract.horizontalOverflowPx,
    nestedVerticalScrollOwners: contract.nestedVerticalScrollOwners,
    inputs: [touch, home],
    finalAction,
    network: {
      policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
      sameOriginRequestCount: diagnostics.sameOriginRequests.length,
      sameOriginSamples: [...new Set(diagnostics.sameOriginRequests)].slice(0, 12),
      externalRequests: diagnostics.externalRequests,
    },
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    failedRequests: diagnostics.failedRequests,
    trace: evidencePath(tracePath),
    screenshots: [topPath, bottomPath, finalPath, fullPagePath].map(evidencePath),
    fullPageScreenshot: evidencePath(fullPagePath),
    status: "PASS",
  };
}

test.describe("STEP 07 adult-tool single-scroll-owner regression", () => {
  test("desktop matrix uses real wheel, PageDown, End, focus, and Home", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop matrix belongs to desktop project");
    const rows: ScrollMatrixRow[] = [];
    const failures: string[] = [];
    await mkdir(resolve(STEP07_SCROLL_TRACE_DIR, "scroll-matrix"), { recursive: true });
    for (const viewport of DESKTOP_VIEWPORTS) {
      for (const route of ADULT_TOOL_ROUTES) {
        const viewportLabel = `${viewport.width}x${viewport.height}`;
        const tracePath = rowTracePath(testInfo.project.name, route.id, viewportLabel);
        try {
          rows.push(await runInIsolatedContext(
            browser,
            testInfo,
            viewport,
            false,
            tracePath,
            (page) => executeDesktopRow(page, testInfo, route, viewport, tracePath),
          ));
        } catch (error) {
          const message = conciseError(error);
          failures.push(`${route.id} ${viewport.width}x${viewport.height}: ${message}`);
          rows.push({
            routeId: route.id,
            routeKind: route.routeKind,
            routeLabel: route.label,
            project: testInfo.project.name,
            viewport: `${viewport.width}x${viewport.height}`,
            pageMode: "UNKNOWN",
            scrollOwner: "UNKNOWN",
            scrollHeight: 0,
            clientHeight: 0,
            maxScrollTop: 0,
            horizontalOverflowPx: 0,
            nestedVerticalScrollOwners: [],
            inputs: [],
            finalAction: { selector: route.finalActionSelector, visible: false, enabled: false, focused: false, unobscured: false, clicked: false, activationEvidence: "NOT_ACTIVATED" },
            network: { policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN", sameOriginRequestCount: 0, sameOriginSamples: [], externalRequests: [] },
            consoleErrors: [],
            pageErrors: [],
            failedRequests: [],
            trace: evidencePath(tracePath),
            screenshots: [],
            fullPageScreenshot: "",
            status: "FAIL",
            error: message,
          });
        }
      }
    }
    await writeScrollEvidence(testInfo.project.name, rows);
    expect(failures, failures.join("\n\n")).toEqual([]);
  });

  test("mobile hasTouch matrix uses real CDP touch swipe", async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(testInfo.project.name !== "mobile-touch-chromium", "touch matrix belongs to mobile touch project");
    const rows: ScrollMatrixRow[] = [];
    const failures: string[] = [];
    const viewport = { width: 390, height: 844 } as const;
    const viewportLabel = `${viewport.width}x${viewport.height}-touch`;
    await mkdir(resolve(STEP07_SCROLL_TRACE_DIR, "scroll-matrix"), { recursive: true });
    for (const route of ADULT_TOOL_ROUTES) {
      const tracePath = rowTracePath(testInfo.project.name, route.id, viewportLabel);
      try {
        rows.push(await runInIsolatedContext(
          browser,
          testInfo,
          viewport,
          true,
          tracePath,
          (page) => executeTouchRow(page, testInfo, route, tracePath),
        ));
      } catch (error) {
        const message = conciseError(error);
        failures.push(`${route.id} touch: ${message}`);
        rows.push({
          routeId: route.id,
          routeKind: route.routeKind,
          routeLabel: route.label,
          project: testInfo.project.name,
          viewport: "390x844-touch",
          pageMode: "UNKNOWN",
          scrollOwner: "UNKNOWN",
          scrollHeight: 0,
          clientHeight: 0,
          maxScrollTop: 0,
          horizontalOverflowPx: 0,
          nestedVerticalScrollOwners: [],
          inputs: [],
          finalAction: { selector: route.finalActionSelector, visible: false, enabled: false, focused: false, unobscured: false, clicked: false, activationEvidence: "NOT_ACTIVATED" },
          network: { policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN", sameOriginRequestCount: 0, sameOriginSamples: [], externalRequests: [] },
          consoleErrors: [],
          pageErrors: [],
          failedRequests: [],
          trace: evidencePath(tracePath),
          screenshots: [],
          fullPageScreenshot: "",
          status: "FAIL",
          error: message,
        });
      }
    }
    await writeScrollEvidence(testInfo.project.name, rows);
    expect(failures, failures.join("\n\n")).toEqual([]);
  });
});

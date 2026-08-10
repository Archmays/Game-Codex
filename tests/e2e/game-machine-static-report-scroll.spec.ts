import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  STATIC_MACHINE_REPORT_RELATIVE_PATH,
  STATIC_MACHINE_REPORT_SCROLL_CASES,
  STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH,
  STATIC_MACHINE_REPORT_URL_PATH,
  buildStaticMachineReportScrollEvidence,
  readFileIdentity,
  validateStaticMachineReportScrollEvidence,
  type FileIdentity,
  type StaticReportScrollCase,
  type StaticReportScrollInput,
  type StaticReportScrollInputTrace,
  type StaticReportScrollRow,
} from "../../tools/game-machine-review/static-report-scroll-evidence";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const OUTPUT_ROOT = resolve("artifacts/game-machine-review/step-07");
const SCREENSHOT_ROOT = resolve(OUTPUT_ROOT, "screenshots/static-machine-report");
const TRACE_ROOT = resolve(OUTPUT_ROOT, "traces/static-machine-report");
const REPORT_OUTPUT = resolve(STATIC_MACHINE_REPORT_SCROLL_RELATIVE_PATH);
const FINAL_ACTION_SELECTOR = "[data-static-final-action]" as const;

interface Diagnostics {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly sameOriginRequests: Set<string>;
  readonly externalRequests: Set<string>;
}

interface PageLayout {
  readonly htmlHasAdultToolClass: boolean;
  readonly bodyHasAdultToolClass: boolean;
  readonly ownerIsDocumentElement: boolean;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly maxScrollTop: number;
  readonly horizontalOverflowPx: number;
  readonly horizontalOverflowElements: string[];
  readonly nestedVerticalScrollOwners: string[];
}

function slug(contract: StaticReportScrollCase): string {
  return contract.key.replaceAll("|", "-");
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function observeDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    sameOriginRequests: new Set<string>(),
    externalRequests: new Set<string>(),
  };
  const classifyNetworkUrl = (rawUrl: string): void => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return;
    }
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return;
    const allowed = (url.protocol === "http:" || url.protocol === "ws:")
      && url.hostname === "127.0.0.1"
      && url.port === "5175";
    if (allowed) diagnostics.sameOriginRequests.add(rawUrl);
    else diagnostics.externalRequests.add(rawUrl);
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "UNKNOWN"}`);
  });
  page.on("request", (request) => classifyNetworkUrl(request.url()));
  page.on("websocket", (socket) => classifyNetworkUrl(socket.url()));
  return diagnostics;
}

async function readScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => document.scrollingElement?.scrollTop ?? -1);
}

async function resetToTop(page: Page): Promise<void> {
  await page.keyboard.press("Home");
  await expect.poll(() => readScrollTop(page)).toBeLessThanOrEqual(1);
}

async function performCdpTouchSwipe(context: BrowserContext, page: Page, width: number, height: number): Promise<void> {
  const session = await context.newCDPSession(page);
  const x = Math.round(width / 2);
  const startY = Math.round(height * 0.78);
  const endY = Math.round(height * 0.22);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY, radiusX: 8, radiusY: 8, force: 1 }],
    });
    const steps = 10;
    for (let index = 1; index <= steps; index += 1) {
      const y = Math.round(startY + ((endY - startY) * index) / steps);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
      });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await session.detach();
  }
}

function inputMethod(input: StaticReportScrollInput): StaticReportScrollInputTrace["method"] {
  if (input === "mouse-wheel") return "Playwright mouse.wheel";
  if (input === "PageDown") return "Playwright keyboard PageDown";
  if (input === "End") return "Playwright keyboard End";
  return "Chromium CDP Input.dispatchTouchEvent";
}

async function performInput(
  context: BrowserContext,
  page: Page,
  contract: StaticReportScrollCase,
  input: StaticReportScrollInput,
  maxScrollTop: number,
): Promise<StaticReportScrollInputTrace> {
  await resetToTop(page);
  const before = await readScrollTop(page);
  if (input === "mouse-wheel") await page.mouse.wheel(0, Math.max(contract.height, 600));
  else if (input === "PageDown") await page.keyboard.press("PageDown");
  else if (input === "End") await page.keyboard.press("End");
  else await performCdpTouchSwipe(context, page, contract.width, contract.height);
  await expect.poll(() => readScrollTop(page)).toBeGreaterThan(before);
  const after = await readScrollTop(page);
  if (input === "End") expect(after).toBeGreaterThanOrEqual(maxScrollTop - 2);
  return {
    input,
    method: inputMethod(input),
    before,
    after,
    maxScrollTop,
    passed: after > before && (input !== "End" || after >= maxScrollTop - 2),
  };
}

async function inspectPageLayout(page: Page): Promise<PageLayout> {
  return page.evaluate(() => {
    const describe = (element: Element): string => {
      const html = element as HTMLElement;
      if (html.id) return `${html.tagName.toLowerCase()}#${html.id}`;
      const className = typeof html.className === "string" ? html.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
      return `${html.tagName.toLowerCase()}${className ? `.${className}` : ""}`;
    };
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) throw new Error("document.scrollingElement is unavailable");
    const horizontalOverflowElements: string[] = [];
    const nestedVerticalScrollOwners: string[] = [];
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (["auto", "scroll", "overlay"].includes(style.overflowY) && html.scrollHeight > html.clientHeight + 1) {
        nestedVerticalScrollOwners.push(describe(element));
      }
      const rect = html.getBoundingClientRect();
      if (rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1)) {
        horizontalOverflowElements.push(describe(element));
      }
    }
    return {
      htmlHasAdultToolClass: document.documentElement.classList.contains("adult-tool-page"),
      bodyHasAdultToolClass: document.body.classList.contains("adult-tool-page"),
      ownerIsDocumentElement: scrollingElement === document.documentElement,
      scrollHeight: scrollingElement.scrollHeight,
      clientHeight: scrollingElement.clientHeight,
      maxScrollTop: scrollingElement.scrollHeight - scrollingElement.clientHeight,
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      horizontalOverflowElements: [...new Set(horizontalOverflowElements)].sort(),
      nestedVerticalScrollOwners: [...new Set(nestedVerticalScrollOwners)].sort(),
    };
  });
}

async function screenshotIdentity(page: Page, path: string, fullPage = false): Promise<FileIdentity> {
  const bytes = await page.screenshot({ path, fullPage, animations: "disabled" });
  const identity = readFileIdentity(path);
  expect(identity.bytes).toBe(bytes.byteLength);
  expect(identity.sha256).toBe(sha256(bytes));
  return identity;
}

async function captureCase(
  browser: Browser,
  contract: StaticReportScrollCase,
  sourceTreeSha256: string,
  reportHtml: FileIdentity,
): Promise<StaticReportScrollRow> {
  const contextId = `static-report-${contract.project}-${contract.viewport}`;
  const context = await browser.newContext({
    viewport: { width: contract.width, height: contract.height },
    hasTouch: contract.hasTouch,
    isMobile: false,
  });
  const tracePath = resolve(TRACE_ROOT, `${slug(contract)}.zip`);
  let traceStopped = false;
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  try {
    const page = await context.newPage();
    const diagnostics = observeDiagnostics(page);
    const url = `${STATIC_MACHINE_REPORT_URL_PATH}?evidenceSha=${reportHtml.sha256}`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("STEP 07 Machine Review");
    const finalButton = page.locator(FINAL_ACTION_SELECTOR);
    await expect(finalButton).toBeVisible();

    const layout = await inspectPageLayout(page);
    expect(layout.ownerIsDocumentElement).toBe(true);
    expect(layout.htmlHasAdultToolClass).toBe(true);
    expect(layout.bodyHasAdultToolClass).toBe(true);
    expect(layout.maxScrollTop).toBeGreaterThan(0);
    expect(layout.horizontalOverflowPx).toBeLessThanOrEqual(1);
    expect(layout.horizontalOverflowElements).toEqual([]);
    expect(layout.nestedVerticalScrollOwners).toEqual([]);

    await resetToTop(page);
    const screenshotPrefix = resolve(SCREENSHOT_ROOT, slug(contract));
    const fullPage = await screenshotIdentity(page, `${screenshotPrefix}-full-page.png`, true);
    const top = await screenshotIdentity(page, `${screenshotPrefix}-top.png`);
    const inputs: StaticReportScrollInputTrace[] = [];
    for (const input of contract.requiredInputs) {
      inputs.push(await performInput(context, page, contract, input, layout.maxScrollTop));
    }

    await page.keyboard.press("End");
    await expect.poll(() => readScrollTop(page)).toBeGreaterThanOrEqual(layout.maxScrollTop - 2);
    const bottom = await screenshotIdentity(page, `${screenshotPrefix}-bottom.png`);
    await page.keyboard.press("Tab");
    const focus = await finalButton.evaluate((element) => {
      const html = element as HTMLElement;
      const rect = html.getBoundingClientRect();
      const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        focused: document.activeElement === html,
        focusVisible: html.matches(":focus-visible"),
        unobscured: Boolean(hit && (hit === html || html.contains(hit))),
      };
    });
    expect(focus.focused).toBe(true);
    expect(focus.focusVisible).toBe(true);
    expect(focus.unobscured).toBe(true);
    const finalAction = await screenshotIdentity(page, `${screenshotPrefix}-final-action.png`);
    expect(new Set([fullPage.sha256, top.sha256, bottom.sha256, finalAction.sha256]).size).toBe(4);

    const beforeClick = await readScrollTop(page);
    await finalButton.click();
    await expect.poll(() => readScrollTop(page)).toBeLessThanOrEqual(1);
    const afterClick = await readScrollTop(page);
    await page.waitForTimeout(100);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
    expect([...diagnostics.externalRequests]).toEqual([]);
    expect(diagnostics.sameOriginRequests.size).toBeGreaterThan(0);

    await context.tracing.stop({ path: tracePath });
    traceStopped = true;
    const trace = readFileIdentity(tracePath);
    const screenshots = { fullPage, top, bottom, finalAction };
    const evidenceFiles = [
      ...Object.values(screenshots).map((identity) => identity.path),
      trace.path,
    ].sort();
    return {
      key: contract.key,
      sourceTreeSha256,
      reportHtmlSha256: reportHtml.sha256,
      contextId,
      isolatedBrowserContext: true,
      project: contract.project,
      viewport: contract.viewport,
      width: contract.width,
      height: contract.height,
      hasTouch: contract.hasTouch,
      actualUrl: page.url(),
      pageMode: "adult-tool-page",
      htmlHasAdultToolClass: layout.htmlHasAdultToolClass,
      bodyHasAdultToolClass: layout.bodyHasAdultToolClass,
      scrollOwner: "document.documentElement",
      scrollHeight: layout.scrollHeight,
      clientHeight: layout.clientHeight,
      maxScrollTop: layout.maxScrollTop,
      horizontalOverflowPx: layout.horizontalOverflowPx,
      horizontalOverflowElements: layout.horizontalOverflowElements,
      nestedVerticalScrollOwners: layout.nestedVerticalScrollOwners,
      inputs,
      finalAction: {
        selector: FINAL_ACTION_SELECTOR,
        keyboardFocusMethod: "Tab",
        visible: await finalButton.isVisible(),
        enabled: await finalButton.isEnabled(),
        focused: focus.focused,
        focusVisible: focus.focusVisible,
        unobscured: focus.unobscured,
        clicked: beforeClick > 0 && afterClick <= 1,
        beforeClick,
        afterClick,
      },
      network: {
        sameOrigin: "SAME_ORIGIN_ALLOWED",
        external: "EXTERNAL_NETWORK_FORBIDDEN",
        sameOriginRequests: [...diagnostics.sameOriginRequests].sort(),
        externalRequests: [...diagnostics.externalRequests].sort(),
      },
      consoleErrors: [...diagnostics.consoleErrors],
      pageErrors: [...diagnostics.pageErrors],
      failedRequests: [...diagnostics.failedRequests],
      screenshots,
      trace,
      evidenceFiles,
      status: "PASS",
    };
  } finally {
    if (!traceStopped) {
      try {
        await context.tracing.stop({ path: tracePath });
      } catch {
        // The originating assertion remains the authoritative failure.
      }
    }
    await context.close();
  }
}

test.describe.serial("STEP 07 generated static machine report adult-tool contract", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The canonical spec creates five exact isolated Chromium contexts once.");
  });

  test("actual generated HTML reflows, scrolls with real inputs, and activates its final control", async ({ browser }) => {
    mkdirSync(SCREENSHOT_ROOT, { recursive: true });
    mkdirSync(TRACE_ROOT, { recursive: true });
    const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
    const reportHtml = readFileIdentity(STATIC_MACHINE_REPORT_RELATIVE_PATH);
    expect(reportHtml.path).toBe(STATIC_MACHINE_REPORT_RELATIVE_PATH);
    const rows: StaticReportScrollRow[] = [];
    for (const contract of STATIC_MACHINE_REPORT_SCROLL_CASES) {
      rows.push(await captureCase(browser, contract, sourceTreeSha256, reportHtml));
    }
    const report = buildStaticMachineReportScrollEvidence(rows, sourceTreeSha256, reportHtml);
    writeFileSync(REPORT_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    expect(validateStaticMachineReportScrollEvidence(report)).toEqual([]);
    expect(report.status).toBe("PASS");
  });
});

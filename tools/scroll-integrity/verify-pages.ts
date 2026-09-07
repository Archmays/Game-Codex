import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, devices, type BrowserContext, type Page } from "@playwright/test";
import { PLAY_SURFACE_MANIFEST } from "../../packages/data/playSurfaceManifest";
import { sampleHitTarget } from "../../tests/e2e/helpers/hit-target";
import {
  expectFullyVisibleInScrollport,
  expectMeaningfullyVisibleInScrollport,
  keyboardMoves,
  wheelToBottom,
} from "../../tests/e2e/helpers/scroll-reachability";

const ROOT = resolve(import.meta.dirname, "../..");
const DEFENSE = PLAY_SURFACE_MANIFEST.find((surface) => surface.id === "hanzi-tower-defense")!;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pagesBase = new URL(option("--base") ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (option("--commit") ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" })).trim();
const output = resolve(ROOT, option("--output") ?? "tmp/tasks/GAME-CODEX-STEP1/reports/PAGES_SCROLL.json");
const errors: string[] = [];
const failed: string[] = [];
const external: string[] = [];
const checks: unknown[] = [];

function observe(context: BrowserContext): void {
  context.on("page", (page) => observePage(page));
}

function observePage(page: Page): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text()); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failed.push(`${request.failure()?.errorText} ${request.url()}`); });
  page.on("response", (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== pagesBase.origin) external.push(request.url());
  });
}

async function route(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "networkidle" });
  await page.locator(selector).waitFor({ state: "visible" });
  const deployedCommit = await page.locator("html").getAttribute("data-build-commit");
  requireValue(deployedCommit === expectedCommit, `Pages commit mismatch at ${query}: ${deployedCommit ?? "missing"}`);
  checks.push({ type: "route", query, selector, deployedCommit, verdict: "PASS" });
}

async function touchToBottom(page: Page): Promise<{ start: number; end: number; reachableMax: number; swipes: number }> {
  const reachableMax = await page.evaluate(() => {
    const scrolling = document.scrollingElement as HTMLElement;
    scrolling.scrollTop = Number.MAX_SAFE_INTEGER;
    const maximum = scrolling.scrollTop;
    scrolling.scrollTop = 0;
    return maximum;
  });
  const session = await page.context().newCDPSession(page);
  let swipes = 0;
  try {
    while (swipes < 96) {
      const before = await page.evaluate(() => document.scrollingElement!.scrollTop);
      if (reachableMax - before <= 2) return { start: 0, end: before, reachableMax, swipes };
      const point = await page.evaluate(() => ({ x: Math.round(innerWidth / 2), startY: Math.round(innerHeight * 0.78), endY: Math.round(innerHeight * 0.22) }));
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.startY }] });
      for (let step = 1; step <= 8; step += 1) {
        const y = Math.round(point.startY + ((point.endY - point.startY) * step) / 8);
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y }] });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      swipes += 1;
      await page.waitForTimeout(80);
      const after = await page.evaluate(() => document.scrollingElement!.scrollTop);
      requireValue(after > before || reachableMax - after <= 2, `Pages tower defense touch stalled at ${after}/${reachableMax}`);
    }
  } finally {
    await session.detach();
  }
  throw new Error(`Pages tower defense touch did not reach bottom after ${swipes} swipes`);
}

const browser = await chromium.launch({ headless: true });
try {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected commit must be a full SHA");

  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
  observe(desktop);
  const page = await desktop.newPage();
  observePage(page);
  page.setDefaultTimeout(120_000);
  for (const [query, selector] of [
    ["./", '[data-testid="my-game-world"]'],
    ["?world=my-game-world", '[data-testid="my-game-world"]'],
    ["?world=english-world", '[data-testid="my-game-world"]'],
    ["?world=english-world&view=journal", '[data-testid="my-game-world"]'],
    ["?world=math-world", '[data-testid="math-world-map"]'],
    ["?play=hanzi-magic-complete", '[data-testid="my-game-world"]'],
    ["?hub=classic", ".hub-grid"],
    ["?world=my-game-world&parent=observation", '[data-testid="observation-notebook"]'],
  ] as const) await route(page, query, selector);

  await route(page, "?play=hanzi-tower-defense", '[data-testid="hanzi-tower-defense"]');
  await page.locator('[data-td-canvas][data-ready="true"]').waitFor();
  await page.locator('[data-td-pause]').click();
  const wheel = await wheelToBottom(page, DEFENSE);
  const lastAction = page.locator('.td-help summary');
  await expectFullyVisibleInScrollport(page, DEFENSE, lastAction);
  const hit = await sampleHitTarget(lastAction);
  requireValue(hit.hitSuccessRatio === 1, 'Bottom help action is occluded');
  await lastAction.click();
  requireValue(await page.locator('.td-help').getAttribute('open') !== null, 'Bottom real click failed');
  const keyboard = await keyboardMoves(page, DEFENSE, 'End');
  checks.push({ type: 'defense-desktop', wheel, keyboard, bottomAction: 'REAL_CLICK_PASS', verdict: 'PASS' });
  await desktop.close();

  const mobile = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  observe(mobile);
  const mobilePage = await mobile.newPage();
  observePage(mobilePage);
  mobilePage.setDefaultTimeout(120_000);
  await route(mobilePage, "?play=hanzi-tower-defense", '[data-testid="hanzi-tower-defense"]');
  await mobilePage.locator('[data-td-canvas][data-ready="true"]').waitFor();
  await mobilePage.locator('[data-td-pause]').tap();
  const touch = await touchToBottom(mobilePage);
  await expectMeaningfullyVisibleInScrollport(mobilePage, DEFENSE, mobilePage.locator('.td-help summary'));
  checks.push({ type: 'defense-mobile-touch', touch, bottomAction: 'FULLY_VISIBLE', verdict: 'PASS' });
  await mobile.close();

  requireValue(errors.length === 0 && failed.length === 0 && external.length === 0, "Pages emitted browser, HTTP, request, or external-network errors");
  const report = { verdict: "PASS_MACHINE", canonicalUrl: pagesBase.href, expectedCommit, deployedCommit: expectedCommit, checks, errors, failed, external, verifiedAtUtc: new Date().toISOString(), realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED" };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ verdict: report.verdict, deployedCommit: expectedCommit, checks: checks.length, output })}\n`);
} catch (error) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ verdict: "FAIL", expectedCommit, checks, errors, failed, external, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}

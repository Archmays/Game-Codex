import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";

const TASK_ID = "GAME-CODEX-PLAY-READINESS-POLISH-05";
const pagesBase = new URL(process.argv[2] ?? process.env.PLAY_READINESS_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (process.argv[3] ?? process.env.PLAY_READINESS_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
const output = resolve(`tmp/tasks/${TASK_ID}/reports/PAGES_VERDICT.json`);
const performanceOutput = resolve(`tmp/tasks/${TASK_ID}/reports/PERFORMANCE_SAMPLE.pages.json`);

function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const errors: string[] = [];
const failed: string[] = [];
const external: string[] = [];
const checked: string[] = [];
const performanceSamples: unknown[] = [];

async function route(page: Page, query: string, selector: string): Promise<void> {
  const started = Date.now();
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "networkidle" });
  await page.locator(selector).waitFor({ state: "visible" });
  await page.waitForFunction((commit) => document.documentElement.dataset.buildCommit === commit, expectedCommit);
  performanceSamples.push(await page.evaluate(({ query, elapsed }) => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const raster = resources.filter((entry) => /\.(png|webp|jpe?g)(\?|$)/i.test(entry.name));
    const scriptCss = resources.filter((entry) => entry.initiatorType === "script" || (entry.initiatorType === "link" && entry.name.includes(".css")));
    const vitals = (window as unknown as { __pagesVitals?: { lcp: number; cls: number } }).__pagesVitals ?? { lcp: 0, cls: 0 };
    return { route: query, elapsedToStableMs: elapsed, requests: resources.length, jsCssTransferBytes: scriptCss.reduce((sum, entry) => sum + entry.transferSize, 0), rasterTransferBytes: raster.reduce((sum, entry) => sum + entry.transferSize, 0), lcpSampleMs: Math.round(vitals.lcp), clsSample: Number(vitals.cls.toFixed(4)), evidence: "PAGES_LAB_SAMPLE_NOT_FIELD_75P" };
  }, { query, elapsed: Date.now() - started }));
  checked.push(query);
}

const browser = await chromium.launch({ headless: true });
try {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected commit must be a full SHA");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
  await context.addInitScript(() => {
    const state = { lcp: 0, cls: 0 };
    (window as unknown as { __pagesVitals: typeof state }).__pagesVitals = state;
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp, entry.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) state.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text()); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failed.push(`${request.failure()?.errorText} ${request.url()}`); });
  page.on("response", (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== pagesBase.origin) external.push(request.url());
  });

  const routes = [
    ["./", '[data-testid="my-game-world"]'],
    ["?world=my-game-world", '[data-testid="my-game-world"]'],
    ["?play=hanzi-magic-complete", '[data-testid="hanzi-magic-complete"]'],
    ["?world=math-world", '[data-testid="math-world-map"]'],
    ["?world=math-world&station=target", ".make-target-game"],
    ["?world=english-world", '[data-testid="english-world-map"]'],
    ["?hub=classic&from=world", ".hub-grid"],
    ["?play=hanzi-magic-complete&view=pinyin", '[data-testid="sound-rhyme-trial"]'],
    ["?play=hanzi-magic-complete&view=memory", '[data-testid="memory-match"]'],
    ["?world=english-world&view=memory", '[data-testid="memory-match"]'],
  ] as const;
  for (const [query, selector] of routes) await route(page, query, selector);

  await route(page, "?hub=classic&from=world", ".hub-grid");
  requireValue(await page.locator(".game-card").count() === 4, "Classic does not contain exactly four active-product cards");
  requireValue(await page.locator('[data-game-id="make-target"], [data-game-id="memory-card"], [data-game-id="pinyin-magic-battle"]').count() === 0, "Classic still exposes a converged module or compatibility card");
  for (const [id, selector] of [["equation-slider", ".equation-slider"]] as const) {
    await page.locator(`.game-card[data-game-id="${id}"] .game-card__button`).click();
    await page.locator(selector).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "返回大厅", exact: true }).click();
    await page.locator(".hub-grid").waitFor({ state: "visible" });
    checked.push(`classic-${id}-return`);
  }

  await page.goto(new URL("?world=english-world&region=animals", pagesBase).href, { waitUntil: "networkidle" });
  await page.locator('[data-testid="english-region"]').waitFor({ state: "visible" });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="english-region"]').waitFor({ state: "visible" });
  await page.goBack({ waitUntil: "networkidle" });
  checked.push("refresh-back");

  await route(page, "?world=my-game-world", '[data-testid="my-game-world"]');
  await page.evaluate(() => localStorage.setItem("family-games/math-world/v1", '{"version":1,"pages":"preserve"}'));
  await page.reload({ waitUntil: "networkidle" });
  requireValue(await page.evaluate(() => localStorage.getItem("family-games/math-world/v1")) === '{"version":1,"pages":"preserve"}', "Save did not survive Pages reload");
  await page.getByRole("button", { name: /家长角/ }).click();
  await page.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  await page.getByTestId("save-vault").waitFor({ state: "visible" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "备份游戏进度" }).click();
  requireValue((await download).suggestedFilename().startsWith("game-codex-saves-"), "Pages Save Vault did not download the local backup");
  checked.push("save-reload", "save-vault-export");

  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, "?world=my-game-world", '[data-testid="my-game-world"]');
  const primary = page.locator("[data-world-forest-link]");
  await primary.focus();
  requireValue(await primary.evaluate((element) => element === document.activeElement), "Pages mobile primary action is not keyboard-focusable");
  requireValue(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "Pages mobile top world overflows horizontally");
  checked.push("mobile-keyboard");

  requireValue(errors.length === 0 && failed.length === 0 && external.length === 0, "Pages emitted browser, HTTP, request, or external-network errors");
  const result = { verdict: "PASS_MACHINE", canonicalUrl: pagesBase.href, expectedCommit, deployedCommit: expectedCommit, checked, errors, failed, external, verifiedAtUtc: new Date().toISOString() };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(performanceOutput, `${JSON.stringify({ verdict: "PASS", environment: "deployed-pages", evidenceType: "PAGES_LAB_SAMPLE_NOT_FIELD_75P", samples: performanceSamples }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ verdict: result.verdict, deployedCommit: expectedCommit, routes: checked.length, output })}\n`);
} catch (error) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ verdict: "FAIL", expectedCommit, checked, errors, failed, external, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}

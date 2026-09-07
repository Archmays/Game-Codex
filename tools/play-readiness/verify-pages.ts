import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { RETIRED_LANGUAGE_PLAY_IDS, RETIRED_LANGUAGE_WORLD_IDS } from "../../src/app-route";

const TASK_ID = "GAME-CODEX-STEP1";
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
  const input = new URL(query, pagesBase).searchParams;
  if (RETIRED_LANGUAGE_PLAY_IDS.some(id => input.get("play") === id) || RETIRED_LANGUAGE_WORLD_IDS.some(id => input.get("world") === id)) {
    const actual = new URL(page.url());
    requireValue(actual.pathname === pagesBase.pathname && actual.search === "?world=my-game-world&notice=retired-language" && !actual.hash, "Retired Pages route did not preserve subpath and clear conflicting state");
    requireValue(await page.locator("canvas").count() === 0, "Retired Pages route mounted a game canvas");
  }
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

  await route(page, "./", '[data-testid="my-game-world"]');
  const protectedSaves = {
    "family-games/math-world/v1": '{"version":99,"synthetic":"preserve raw"}',
    "family-games/equation-slider/progress": '{"saveVersion":99,"synthetic":"preserve raw"}',
    "family-games/make-target/progress": '{"version":99,"synthetic":"preserve raw"}',
    "family-games/hanzi-magic-complete/v3": '{ "version":99,"synthetic":"legacy raw" }',
    "family-games/english-world/v2": '{"version":99,"synthetic":"legacy raw"}',
  };
  await page.evaluate(values => Object.entries(values).forEach(([key,value]) => localStorage.setItem(key,value)), protectedSaves);
  const routes = [
    ["./", '[data-testid="my-game-world"]'],
    ["?world=my-game-world", '[data-testid="my-game-world"]'],
    ["?play=hanzi-tower-defense", '[data-testid="hanzi-tower-defense"]'],
    ["?world=math-world", '[data-testid="math-world-map"]'],
    ["?world=math-world&station=target", ".make-target-game"],
    ["?world=math-world&station=slider", ".equation-slider"],
    ["?world=english-world", '[data-testid="my-game-world"]'],
    ["?hub=classic&from=world", ".hub-grid"],
    ["?play=hanzi-magic-complete&view=pinyin", '[data-testid="my-game-world"]'],
    ["?play=hanzi-magic-complete&view=memory", '[data-testid="my-game-world"]'],
    ["?world=english-world&view=memory", '[data-testid="my-game-world"]'],
    ...RETIRED_LANGUAGE_PLAY_IDS.map(id => [`?play=${id}&view=archive&chapter=2&mode=word&hub=classic&station=slider#old`, '[data-testid="my-game-world"]']),
    ...RETIRED_LANGUAGE_WORLD_IDS.map(id => [`?world=${id}&view=journal&region=animals&hub=classic`, '[data-testid="my-game-world"]']),
  ] as const;
  for (const [query, selector] of routes) await route(page, query, selector);
  const afterSaves = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])), Object.keys(protectedSaves));
  requireValue(JSON.stringify(afterSaves) === JSON.stringify(protectedSaves), "Pages changed protected math or retired-language raw saves");
  checked.push("math-and-retired-language-raw-saves-preserved");

  await route(page, "?hub=classic&from=world", ".hub-grid");
  requireValue(await page.locator(".game-card").count() === 2, "Classic does not contain exactly two current product cards");
  requireValue(await page.locator('[data-game-id="make-target"], [data-game-id="memory-card"], [data-game-id="pinyin-magic-battle"], [data-game-id="equation-slider"]').count() === 0, "Classic still exposes a converged module, compatibility card, or nested flagship module");
  checked.push("classic-2-active-products");

  await route(page, "?world=math-world&station=slider", ".equation-slider");
  await page.getByRole("button", { name: "关卡列表", exact: true }).click();
  await page.getByRole("button", { name: "线路地图", exact: true }).click();
  await page.getByRole("button", { name: "回数学世界地图", exact: true }).click();
  await page.locator('[data-testid="math-world-map"]').waitFor({ state: "visible" });
  checked.push("math-slider-world-return");

  await page.goto(new URL("?play=hanzi-tower-defense", pagesBase).href, { waitUntil: "networkidle" });
  await page.locator('[data-testid="hanzi-tower-defense"]').waitFor({ state: "visible" });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="hanzi-tower-defense"]').waitFor({ state: "visible" });
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
  await page.screenshot({ path: resolve("tmp/tasks/GAME-CODEX-STEP1/pages-home-mobile.png"), fullPage: true });
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

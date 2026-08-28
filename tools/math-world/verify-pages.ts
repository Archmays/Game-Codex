import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";

const pagesBase = new URL(process.argv[2] ?? process.env.MATH_WORLD_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (process.argv[3] ?? process.env.MATH_WORLD_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
const output = resolve(process.env.MATH_WORLD_PAGES_OUTPUT ?? "tmp/tasks/GAME-CODEX-MATH-WORLD-02-R2/reports/PAGES_VERDICT.json");

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function buildIdentity(page: Page): Promise<void> {
  await page.waitForFunction((commit) => document.documentElement.dataset.buildCommit === commit, expectedCommit);
}

async function route(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "domcontentloaded" });
  await page.locator(selector).waitFor({ state: "visible" });
  await buildIdentity(page);
}

const errors: string[] = [];
const failed: string[] = [];
const external: string[] = [];
const checked: string[] = [];
const browser = await chromium.launch({ headless: true });
try {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected commit must be a full SHA");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
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
    ["?world=my-game-world", '[data-testid="world-math-portal"]'],
    ["?world=math-world", '[data-testid="math-world-map"]'],
    ["?world=math-world&station=lab", '[data-station-id="lab"] canvas'],
    ["?world=math-world&station=clock", '[data-station-id="clock"] .clock-game'],
    ["?world=math-world&station=array", '[data-station-id="array"] .array-workshop'],
    ["?world=math-world&station=target", '[data-station-id="target"] .make-target-game'],
    ["?world=math-world&station=slider", '[data-station-id="slider"] .equation-slider'],
    ["?play=hanzi-magic-complete&from=hub", '[data-testid="hanzi-magic-complete"]'],
    ["?play=hanzi-v2-chapter-one&from=hub", '[data-testid="hanzi-magic-chapter-one-m3"]'],
    ["?play=hanzi-v2-v1&from=hub", '[data-testid="hanzi-magic-v1"]'],
  ] as const;
  for (const [query, selector] of routes) {
    await route(page, query, selector);
    checked.push(query);
  }

  await route(page, "?hub=classic", ".hub-grid");
  requireValue(await page.locator(".game-card").count() === 3, "Pages classic catalog is not the three active world products");
  requireValue(await page.locator('[data-game-id="clock-reader"], [data-game-id="multiplication-adventure"], [data-game-id="make-target"], [data-game-id="memory-card"], [data-game-id="pinyin-magic-battle"]').count() === 0, "Converged module or compatibility cards remain on Pages");
  for (const id of ["equation-slider"] as const) {
    await page.locator(`[data-game-id="${id}"] button`).click();
    await page.locator(id === "make-target" ? ".make-target-game" : ".equation-slider").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "返回大厅", exact: true }).first().click();
  }
  checked.push("classic-4-active-products");

  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, "?world=math-world", '[data-testid="math-world-map"]');
  requireValue(await page.locator(".math-world-card").count() === 5, "Mobile Pages map is missing stations");
  checked.push("mobile-map");

  requireValue(errors.length === 0 && failed.length === 0 && external.length === 0, "Pages emitted browser, HTTP, request, or external-network errors");
  const result = { verdict: "PASS_MACHINE", canonicalUrl: new URL("?world=math-world", pagesBase).href, expectedCommit, deployedCommit: expectedCommit, checked, errors, failed, external, verifiedAtUtc: new Date().toISOString() };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ verdict: result.verdict, canonicalUrl: result.canonicalUrl, deployedCommit: expectedCommit, output })}\n`);
} catch (error) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ verdict: "FAIL", expectedCommit, checked, errors, failed, external, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}

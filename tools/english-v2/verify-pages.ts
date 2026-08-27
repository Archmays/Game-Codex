import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";

const pagesBase = new URL(process.argv[2] ?? process.env.ENGLISH_V2_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (process.argv[3] ?? process.env.ENGLISH_V2_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
const output = resolve(process.env.ENGLISH_V2_PAGES_OUTPUT ?? "tmp/tasks/GAME-CODEX-ENGLISH-V2-04/pages/PAGES_VERDICT.json");

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function route(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "domcontentloaded" });
  await page.locator(selector).waitFor({ state: "visible" });
  await page.waitForFunction((commit) => document.documentElement.dataset.buildCommit === commit, expectedCommit);
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

  await route(page, "./", '[data-testid="my-game-world"]');
  await route(page, "?world=my-game-world", '[data-testid="world-english-portal"]');
  await route(page, "?world=english-world", '[data-testid="english-world-map"]');
  requireValue(await page.locator(".wordlight-region").count() === 5, "English world does not expose five regions");
  checked.push("root", "my-game-world", "english-world-map");

  for (const region of ["animals", "home", "food", "actions", "colors"]) {
    await route(page, `?world=english-world&region=${region}`, `[data-testid="english-region"][data-region="${region}"]`);
    requireValue(await page.locator(".wordlight-mission-list > article").count() === 6, `Region ${region} does not expose six story missions`);
    checked.push(`region-${region}`);
  }
  await route(page, "?world=english-world&view=journal", '[data-testid="english-journal"]');
  requireValue(await page.locator('[data-testid="journal-word"]').count() === 48, "Word Journal does not contain 48 words");
  checked.push("journal-48");
  await route(page, "?world=english-world&view=memory&seed=pages-v2", '[data-testid="memory-match"][data-pack="english-word-image"]');
  requireValue(await page.locator("[data-card-id]").count() === 12, "English Memory does not expose a six-pair round");
  checked.push("english-memory");

  await route(page, "?hub=classic&from=world", ".hub-grid");
  requireValue(await page.locator(".game-card").count() === 4, "Classic catalog is not the four active child products");
  await page.locator('[data-game-id="english-spell-battle"] button').click();
  await page.locator('[data-testid="english-world-map"]').waitFor({ state: "visible" });
  checked.push("classic-english-to-world", "classic-4-active-products");

  await page.setViewportSize({ width: 360, height: 800 });
  await route(page, "?world=english-world", '[data-testid="english-world-map"]');
  const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  requireValue(geometry.scroll <= geometry.client + 1, "Mobile English world has horizontal overflow");
  checked.push("mobile-360");

  requireValue(errors.length === 0 && failed.length === 0 && external.length === 0, "Pages emitted browser, HTTP, request, or external-network errors");
  const result = { verdict: "PASS_MACHINE", canonicalUrl: new URL("?world=english-world", pagesBase).href, expectedCommit, deployedCommit: expectedCommit, checked, errors, failed, external, verifiedAtUtc: new Date().toISOString() };
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

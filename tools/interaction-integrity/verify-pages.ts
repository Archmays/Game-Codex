import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { sampleHitTarget } from "../../tests/e2e/helpers/hit-target";

const root = resolve(import.meta.dirname, "../..");

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pagesBase = new URL(option("--base") ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (option("--commit") ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })).trim();
const output = resolve(root, option("--output") ?? "tmp/tasks/GAME-CODEX-EVIDENCE-DRIVEN-UI-POLISH-06B/reports/PAGES_VERDICT.json");
const errors: string[] = [];
const failed: string[] = [];
const external: string[] = [];
const checks: unknown[] = [];

async function route(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "networkidle" });
  await page.locator(selector).waitFor({ state: "visible" });
  const deployedCommit = await page.locator("html").getAttribute("data-build-commit");
  requireValue(deployedCommit === expectedCommit, `Pages commit mismatch at ${query}: ${deployedCommit ?? "missing"}`);
  checks.push({ type: "route", query, selector, deployedCommit, verdict: "PASS" });
}

const browser = await chromium.launch({ headless: true });
try {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected commit must be a full SHA");
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
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

  for (const [query, selector] of [
    ["./", '[data-testid="my-game-world"]'],
    ["?world=my-game-world", '[data-testid="world-english-portal"]'],
    ["?play=hanzi-magic-complete&from=world", '[data-testid="hanzi-magic-complete"]'],
    ["?world=math-world&from=world", '[data-testid="math-world-map"]'],
    ["?hub=classic&from=world", ".hub-grid"],
    ["?world=english-world", '[data-testid="english-world-map"]'],
  ] as const) await route(page, query, selector);
  requireValue(await page.locator(".wordlight-region").count() === 5, "English World must expose five regions");

  await route(page, "?world=english-world&region=animals", '[data-testid="english-region"][data-region="animals"]');
  for (const wordId of ["word-cat", "word-dog", "word-fish", "word-duck"] as const) {
    const control = page.locator(`[data-word-id="${wordId}"]`);
    await control.scrollIntoViewIfNeeded();
    const evidence = await sampleHitTarget(control);
    requireValue(evidence.rect.width >= 44 && evidence.rect.height >= 44, `${wordId} deployed target is smaller than 44px`);
    requireValue(evidence.hitSuccessRatio === 1, `${wordId} deployed target is occluded: ${JSON.stringify(evidence.samples.filter((sample) => !sample.pass))}`);
    await control.click({ trial: true });
    checks.push({ type: "hit-test", wordId, ratio: evidence.hitSuccessRatio, rect: evidence.rect, verdict: "PASS" });
  }
  await page.locator('[data-word-id="word-cat"]').click();
  await page.locator('[data-testid="english-mission"][data-word-id="word-cat"]').waitFor({ state: "visible" });
  checks.push({ type: "real-click", wordId: "word-cat", verdict: "PASS" });

  await page.setViewportSize({ width: 390, height: 844 });
  await route(page, "?world=english-world&region=animals", '[data-testid="english-region"][data-region="animals"]');
  const mobileCatControl = page.locator('[data-word-id="word-cat"]');
  await mobileCatControl.scrollIntoViewIfNeeded();
  const mobileCat = await sampleHitTarget(mobileCatControl);
  requireValue(mobileCat.hitSuccessRatio === 1, "Mobile deployed word-cat target is occluded");
  requireValue(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "Mobile English region overflows horizontally");
  checks.push({ type: "mobile-hit-test", wordId: "word-cat", ratio: mobileCat.hitSuccessRatio, verdict: "PASS" });

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

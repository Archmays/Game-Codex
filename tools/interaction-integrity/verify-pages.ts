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
const output = resolve(root, option("--output") ?? "tmp/tasks/GAME-CODEX-STEP1/reports/PAGES_INTERACTION.json");
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
    ["?world=my-game-world", '[data-testid="my-game-world"]'],
    ["?play=hanzi-magic-complete&from=world", '[data-testid="my-game-world"]'],
    ["?world=math-world&from=world", '[data-testid="math-world-map"]'],
    ["?hub=classic&from=world", ".hub-grid"],
    ["?world=english-world", '[data-testid="my-game-world"]'],
  ] as const) await route(page, query, selector);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await route(page, "?play=hanzi-tower-defense", '[data-testid="hanzi-tower-defense"]');
    await page.locator('[data-td-canvas][data-ready="true"]').waitFor();
    const pause = page.locator('[data-td-pause]');
    if (await page.locator('.td-game').getAttribute('data-phase') === 'battle') await pause.click();
    for (let slot=0; slot<8; slot++) {
      const control = page.locator('[data-slot="'+slot+'"]');
      await control.scrollIntoViewIfNeeded();
      const evidence = await sampleHitTarget(control);
      requireValue(evidence.rect.width >= 44 && evidence.rect.height >= 44, 'Tower target below 44px');
      requireValue(evidence.hitSuccessRatio === 1, 'Tower target is occluded');
      await control.click({ trial: true });
      checks.push({ type: 'hit-test', width, slot, ratio: evidence.hitSuccessRatio, verdict: 'PASS' });
    }
    await page.locator('[data-core="2"]').click();
    await page.locator('[data-slot="1"]').click();
    requireValue((await page.locator('[data-slot="1"]').getAttribute('aria-label'))?.includes('火'), 'Normal deployment click failed');
    requireValue(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth+1), 'Tower game overflows horizontally');
    await page.locator('[data-td-restart]').click();
    await page.locator('[data-td-confirm-restart]').click();
  }

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

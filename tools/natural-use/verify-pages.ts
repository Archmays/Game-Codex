import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { OBSERVATION_STORAGE_KEY, validateObservationBundle } from "../../packages/observation/natural-use";

const TASK_ID = "GAME-CODEX-NATURAL-USE-OBSERVATION-KIT-06A";
const pagesBase = new URL(process.argv[2] ?? process.env.NATURAL_USE_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const expectedCommit = (process.argv[3] ?? process.env.NATURAL_USE_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })).trim();
const output = resolve(`tmp/tasks/${TASK_ID}/reports/PAGES_VERDICT.json`);

function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const errors: string[] = [];
const failed: string[] = [];
const external: string[] = [];
const checked: string[] = [];

async function route(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(new URL(query, pagesBase).href, { waitUntil: "networkidle" });
  await page.locator(selector).waitFor({ state: "visible" });
  await page.waitForFunction((commit) => document.documentElement.dataset.buildCommit === commit, expectedCommit);
  checked.push(query);
}

const browser = await chromium.launch({ headless: true });
try {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected commit must be a full SHA");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
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
    ["?world=my-game-world&parent=observation", '[data-testid="observation-notebook"]'],
    ["?world=math-world", '[data-testid="math-world-map"]'],
    ["?world=english-world", '[data-testid="english-world-map"]'],
    ["?play=hanzi-magic-complete", '[data-testid="hanzi-magic-complete"]'],
    ["?hub=classic", ".hub-grid"],
  ] as const) await route(page, query, selector);

  await route(page, "?world=my-game-world&parent=observation", '[data-testid="observation-notebook"]');
  requireValue(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY) === null, "Opening deployed Observation Notebook wrote a record");
  const notebook = page.getByTestId("observation-notebook");
  await notebook.locator("[data-observation-surface]").selectOption("math-world");
  await notebook.getByRole("checkbox", { name: "明显停顿或寻找操作" }).check();
  requireValue(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY) === null, "Selecting deployed observation fields wrote a record");
  await notebook.getByRole("button", { name: "保存这条观察" }).click();
  requireValue(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").records?.length, OBSERVATION_STORAGE_KEY) === 1, "Explicit deployed save did not create exactly one record");
  await notebook.getByRole("button", { name: "导出", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("observation-export-preview").getByRole("button", { name: "确认导出" }).click();
  const downloadPath = await (await downloadPromise).path();
  requireValue(downloadPath, "Deployed observation export did not produce a download");
  const bundle = await validateObservationBundle(JSON.parse(readFileSync(downloadPath, "utf8")));
  requireValue(bundle.recordCount === 1 && bundle.projectBuildCommit === expectedCommit, "Deployed observation export identity is wrong");
  checked.push("observation-default-zero", "observation-explicit-one", "observation-export-checksum");

  requireValue(errors.length === 0 && failed.length === 0 && external.length === 0, "Pages emitted browser, HTTP, request, or external-network errors");
  const result = { verdict: "PASS_MACHINE", canonicalUrl: new URL("?world=my-game-world&parent=observation", pagesBase).href, expectedCommit, deployedCommit: expectedCommit, checked, observationDefaultRecords: 0, explicitSaveRecords: 1, observationExternalRequests: 0, errors, failed, external, verifiedAtUtc: new Date().toISOString() };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ verdict: result.verdict, deployedCommit: expectedCommit, routes: checked.length, output })}\n`);
} catch (error) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ verdict: "FAIL", expectedCommit, checked, errors, failed, external, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}

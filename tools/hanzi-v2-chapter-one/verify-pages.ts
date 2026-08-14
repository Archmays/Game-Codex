import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "@playwright/test";
import {
  M3_SESSION_KEY,
  M5_REGION_META,
  M5_RUNTIME_ASSETS,
  createM3GameState,
  reduceM3State,
  simulateM3Run,
  type M3Action,
  type M3GameState,
} from "../../games/hanzi-radical-battle/v2/chapter-one";
import { computeHanziV2SourceTreeSha256 } from "./source-identity";

const workspace = resolve(process.cwd());
const output = resolve(workspace, "test-results/hanzi-v2/chapter-one/validation/PAGES-VERDICT.json");
const pagesBase = new URL(process.argv[2] ?? "https://archmays.github.io/Game-Codex/");
const canonicalUrl = new URL("?play=hanzi-v2-chapter-one&from=hub", pagesBase).href;
const sourceTreeSha256 = (process.env.CHAPTER_ONE_SOURCE_TREE_SHA256 ?? computeHanziV2SourceTreeSha256(workspace)).toUpperCase();
const commit = process.env.CHAPTER_ONE_FINAL_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim();

interface Fixture { readonly seed: string; readonly actions: readonly M3Action[]; readonly state: M3GameState }
interface JsonObject { [key: string]: unknown }
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function write(value: unknown): void { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

function fixture(id: string, predicate: (state: M3GameState) => boolean): Fixture {
  for (let index = 0; index < 80; index += 1) {
    const seed = `pages-${id}-${index}`;
    const simulation = simulateM3Run(seed, "light-speaker", "story");
    let state = createM3GameState(seed, "light-speaker", "story");
    const actions: M3Action[] = [];
    for (const action of simulation.actions) {
      state = reduceM3State(state, action);
      actions.push(action);
      if (predicate(state)) return { seed, actions: [...actions], state };
    }
  }
  throw new Error(`No deterministic Pages fixture found for ${id}`);
}

async function openFixture(page: Page, entry: Fixture): Promise<void> {
  await page.goto(pagesBase.href, { waitUntil: "domcontentloaded" });
  const envelope = { schemaVersion: 3, seed: entry.seed, initialHeroId: "light-speaker", mode: "story", actions: entry.actions };
  await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, value); }, { key: M3_SESSION_KEY, value: JSON.stringify(envelope) });
  await page.goto(new URL(`?play=hanzi-v2-chapter-one&from=hub&seed=${encodeURIComponent(entry.seed)}&adventure=story`, pagesBase).href, { waitUntil: "networkidle" });
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await shell.waitFor({ state: "visible" });
  requireValue(await shell.getAttribute("data-phase") === entry.state.phase, `Pages fixture phase mismatch for ${entry.seed}`);
}

export async function verifyPages(): Promise<void> {
  requireValue(pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/"), "Pages base must be the HTTPS Game-Codex deployment root");
  requireValue(/^[A-F0-9]{64}$/.test(sourceTreeSha256), "Source tree identity is invalid");
  requireValue(/^[a-f0-9]{40}$/.test(commit), "Final commit identity is invalid");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const abortedNavigationRequests: string[] = [];
  const httpErrors: string[] = [];
  const externalRequests: string[] = [];
  const checkedScenes: JsonObject[] = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const detail = `${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`;
      if (request.failure()?.errorText === "net::ERR_ABORTED") abortedNavigationRequests.push(detail);
      else failedRequests.push(detail);
    });
    page.on("response", (response) => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== pagesBase.origin) externalRequests.push(request.url());
    });

    await page.goto(new URL("?hub=classic", pagesBase).href, { waitUntil: "networkidle" });
    const card = page.locator(".game-card--ink-forest");
    await card.waitFor({ state: "visible" });
    requireValue((await card.getByRole("heading", { name: "汉字魔法战", exact: true }).count()) === 1, "Pages hub is missing the Hanzi card title");
    const cardText = await card.innerText();
    requireValue(cardText.includes("进入墨迹森林") && !/学习目标|适合年龄|正确率|排名/.test(cardText), "Pages hub card is not child-facing");
    const hubArt = card.locator("img");
    requireValue(await hubArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), "Pages hub art did not load");
    await card.getByRole("button", { name: "进入墨迹森林" }).click();
    await page.waitForURL(canonicalUrl);
    await page.getByTestId("hanzi-magic-chapter-one-m3").waitFor({ state: "visible" });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("hanzi-magic-chapter-one-m3").waitFor({ state: "visible" });

    for (const regionId of Object.keys(M5_REGION_META) as (keyof typeof M5_REGION_META)[]) {
      const entry = fixture(regionId, (state) => state.phase === "encounter" && state.plan.regions[state.regionIndex].regionId === regionId);
      await openFixture(page, entry);
      const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
      const sceneKey = await shell.getAttribute("data-scene-key");
      requireValue(sceneKey === M5_REGION_META[regionId].sceneKey, `Pages scene mismatch for ${regionId}`);
      checkedScenes.push({ regionId, phase: entry.state.phase, sceneKey });
    }
    for (const terminal of [
      { id: "final-intro", predicate: (state: M3GameState) => state.phase === "final-intro" },
      { id: "ending", predicate: (state: M3GameState) => state.phase === "ending" },
    ]) {
      const entry = fixture(terminal.id, terminal.predicate);
      await openFixture(page, entry);
      requireValue(await page.getByTestId("hanzi-magic-chapter-one-m3").getAttribute("data-scene-key") === "region-ink-king-core", `Pages ${terminal.id} did not use the final-core scene`);
      checkedScenes.push({ regionId: "ink-king-core", phase: terminal.id, sceneKey: "region-ink-king-core" });
    }

    const assets: JsonObject[] = [];
    for (const entry of M5_RUNTIME_ASSETS) {
      const url = new URL(`assets/hanzi-radical-battle/v2/theme-c/chapter-one/${entry.fileName}`, pagesBase).href;
      const response = await context.request.get(url);
      const body = await response.body();
      requireValue(response.ok() && body.byteLength > 0, `Pages asset failed: ${entry.fileName}`);
      assets.push({ key: entry.key, url, status: response.status(), bytes: body.byteLength, contentType: response.headers()["content-type"] ?? null });
    }
    requireValue(assets.length === 72, "Pages did not validate exactly 72 Chapter One runtime assets");

    await page.goto(new URL("?play=hanzi-v2-v1&from=hub", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-magic-v1").waitFor({ state: "visible" });
    requireValue(consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0 && externalRequests.length === 0, "Pages emitted browser errors, failed requests, HTTP errors, or external runtime requests");

    write({ schemaVersion: 1, sourceTreeSha256, commit, result: "PASS", canonicalUrl, hubCard: "PASS", directDeepLink: "PASS", refreshRecovery: "PASS", checkedScenes, runtimeAssets: { expected: 72, checked: assets.length, failed: 0, assets }, legacyV1Route: "PASS", consoleErrors, pageErrors, failedRequests, httpErrors, abortedNavigationRequests, externalRequests, generatedAtUtc: new Date().toISOString() });
  } catch (error) {
    write({ schemaVersion: 1, sourceTreeSha256, commit, result: "FAIL", canonicalUrl, consoleErrors, pageErrors, failedRequests, httpErrors, abortedNavigationRequests, externalRequests, error: error instanceof Error ? error.message : String(error), generatedAtUtc: new Date().toISOString() });
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyPages();

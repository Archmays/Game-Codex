import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../games/hanzi-radical-battle/complete/content-graph/words";
import { COMPLETE_EPISODE_IDS, COMPLETE_REPAIR_IDS } from "../../games/hanzi-radical-battle/complete/core/world-contracts";
import { createFreshCompleteSave, updateCompleteSave } from "../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../games/hanzi-radical-battle/complete/save/complete-save-schema";
import { computeHanziCompleteSourceTreeSha256 } from "./source-identity";

const workspace = resolve(process.cwd());
const output = resolve(process.env.HANZI_COMPLETE_PAGES_OUTPUT ?? "artifacts/hanzi-magic-battle/v3-complete/report/PAGES_VERDICT.json");
const pagesBase = new URL(process.argv[2] ?? process.env.HANZI_COMPLETE_PAGES_BASE ?? "https://archmays.github.io/Game-Codex/");
const canonicalUrl = new URL("?play=hanzi-magic-complete&from=hub", pagesBase).href;
const expectedCommit = (process.argv[3] ?? process.env.HANZI_COMPLETE_EXPECTED_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" })).trim();
const ciRun = process.argv[4] ?? process.env.HANZI_COMPLETE_CI_RUN ?? null;
const ciStatus = process.argv[5] ?? process.env.HANZI_COMPLETE_CI_STATUS ?? null;
const sourceTreeSha256 = computeHanziCompleteSourceTreeSha256(workspace);
const allowLocal = process.env.HANZI_COMPLETE_ALLOW_LOCAL_PAGES === "1";
const remoteTimeoutMs = Number(process.env.HANZI_COMPLETE_PAGES_TIMEOUT_MS ?? "120000");

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function write(value: unknown): void {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function completedSave() {
  return updateCompleteSave(createFreshCompleteSave(), {
    selectedHeroId: "forest-speaker",
    settings: { muted: true, reducedMotion: true, inputMode: "auto" },
    activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "pages-v3", actionCount: 0 },
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedEpisodeIds: COMPLETE_EPISODE_IDS,
    discoveredCharacterIds: COMPLETE_CORE_CHARACTER_NODES.map((record) => record.id),
    discoveredFamilyIds: COMPLETE_COMPONENT_FAMILIES.map((record) => record.id),
    discoveredWordIds: COMPLETE_WORD_NODES.map((record) => record.id),
    repairedObjectIds: COMPLETE_REPAIR_IDS,
  });
}

async function setCompletedSave(page: Page): Promise<void> {
  if (!page.url().startsWith(pagesBase.origin)) await page.goto(pagesBase.href, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, value); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(completedSave()) });
}

async function assertBuildIdentity(page: Page): Promise<void> {
  await page.waitForFunction((commit) => document.documentElement.dataset.buildCommit === commit, expectedCommit);
  requireValue(await page.evaluate(() => document.documentElement.dataset.buildCommit) === expectedCommit, "Deployed build commit does not match expected commit");
}

async function assetSnapshot(page: Page): Promise<string[]> {
  return page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => /^https?:/i.test(name)).sort());
}

async function checkResponse(context: BrowserContext, relative: string): Promise<{ url: string; status: number; bytes: number; contentType: string }> {
  const url = new URL(relative, pagesBase).href;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await context.request.get(url, { timeout: remoteTimeoutMs });
      const body = await response.body();
      requireValue(response.ok() && body.byteLength > 0, `Pages resource failed: ${url}`);
      return { url, status: response.status(), bytes: body.byteLength, contentType: response.headers()["content-type"] ?? "" };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise<void>((done) => setTimeout(done, attempt * 1_000));
    }
  }
  throw lastError;
}

export async function verifyCompletePages(): Promise<Record<string, unknown>> {
  requireValue(allowLocal || (pagesBase.protocol === "https:" && pagesBase.pathname.endsWith("/Game-Codex/")), "Pages base must be the HTTPS Game-Codex deployment root");
  requireValue(/^[a-f0-9]{40}$/.test(expectedCommit), "Expected deployed commit must be a full Git SHA");
  requireValue(Number.isFinite(remoteTimeoutMs) && remoteTimeoutMs >= 30_000 && remoteTimeoutMs <= 300_000, "Pages timeout must be between 30 and 300 seconds");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpErrors: string[] = [];
  const externalRequests: string[] = [];
  const basePathEscapes: string[] = [];
  const routeChecks: Record<string, string> = {};
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(remoteTimeoutMs);
    page.setDefaultNavigationTimeout(remoteTimeoutMs);
    page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`); });
    page.on("response", (response) => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== pagesBase.origin) externalRequests.push(url.href);
      if (/^https?:$/.test(url.protocol) && url.origin === pagesBase.origin && !url.pathname.startsWith(pagesBase.pathname)) basePathEscapes.push(url.href);
    });

    await page.goto(new URL("?hub=classic&from=world", pagesBase).href, { waitUntil: "domcontentloaded" });
    await assertBuildIdentity(page);
    const card = page.locator(".game-card--ink-forest");
    await card.waitFor({ state: "visible" });
    requireValue((await card.getByRole("heading", { name: "汉字魔法战", exact: true }).count()) === 1, "Classic hub is missing the Hanzi card");
    await card.getByRole("button", { name: "进入墨迹森林" }).click();
    await page.waitForURL(canonicalUrl);
    await page.getByTestId("hanzi-magic-complete").waitFor({ state: "visible" });
    routeChecks.classicHubToV3 = "PASS";

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-magic-complete").waitFor({ state: "visible" });
    await assertBuildIdentity(page);
    routeChecks.directDeepLinkAndRefresh = "PASS";
    const worldAssets = await assetSnapshot(page);

    await page.goto(new URL("?world=my-game-world", pagesBase).href, { waitUntil: "domcontentloaded" });
    const forestLink = page.locator("[data-world-forest-link]");
    await forestLink.waitFor({ state: "visible" });
    requireValue(await forestLink.getAttribute("href") === "?play=hanzi-magic-complete&from=world", "My Game World forest portal does not point to V3");
    routeChecks.myGameWorldToV3 = "PASS";

    await setCompletedSave(page);
    await page.goto(canonicalUrl, { waitUntil: "domcontentloaded" });
    const world = page.getByTestId("hanzi-magic-complete");
    await world.waitFor({ state: "visible" });
    requireValue(await world.getAttribute("data-story-complete") === "true", "Completed Pages save did not restore the world");
    await page.locator('[data-hero-id="ink-companion"]').last().click();
    await page.reload({ waitUntil: "domcontentloaded" });
    requireValue(await page.getByTestId("hanzi-magic-complete").getAttribute("data-hero-id") === "ink-companion", "Pages save/reload did not retain the selected hero");
    routeChecks.saveReload = "PASS";

    await page.goto(new URL("?play=hanzi-magic-complete&from=hub&chapter=one&seed=pages-one", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-magic-chapter-one-m3").waitFor({ state: "visible" });
    routeChecks.chapterOne = "PASS";

    await setCompletedSave(page);
    await page.goto(new URL("?play=hanzi-magic-complete&from=hub&chapter=two&fresh=1&seed=pages-two", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-complete-chapter-two").waitFor({ state: "visible" });
    const chapterTwoAssets = await assetSnapshot(page);
    requireValue(chapterTwoAssets.some((url) => !worldAssets.includes(url)), "Chapter Two did not prove lazy-loaded runtime assets");
    routeChecks.chapterTwoLazy = "PASS";

    await setCompletedSave(page);
    await page.goto(new URL("?play=hanzi-magic-complete&from=hub&chapter=three&fresh=1&seed=pages-three", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-complete-chapter-three").waitFor({ state: "visible" });
    routeChecks.chapterThreeLazy = "PASS";

    await setCompletedSave(page);
    await page.goto(new URL("?play=hanzi-magic-complete&from=hub&postgame=word-resonance&new=1&seed=pages-postgame", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("complete-postgame-intro").waitFor({ state: "visible" });
    routeChecks.postgame = "PASS";

    await page.goto(new URL("?play=hanzi-v2-chapter-one&from=hub", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-magic-chapter-one-m3").waitFor({ state: "visible" });
    routeChecks.legacyV2 = "PASS";
    await page.goto(new URL("?play=hanzi-v2-v1&from=hub", pagesBase).href, { waitUntil: "domcontentloaded" });
    await page.getByTestId("hanzi-magic-v1").waitFor({ state: "visible" });
    routeChecks.legacyV1 = "PASS";

    const rootResource = await checkResponse(context, "./");
    requireValue(consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0 && externalRequests.length === 0 && basePathEscapes.length === 0, "Pages emitted browser, request, HTTP, external-network or base-path errors");
    const result = {
      schemaVersion: 1,
      verdict: "PASS_MACHINE",
      canonicalUrl,
      expectedCommit,
      deployedCommit: expectedCommit,
      sourceTreeSha256,
      routeChecks,
      lazyAssets: { worldResourceCount: worldAssets.length, chapterTwoResourceCount: chapterTwoAssets.length, newChapterTwoResources: chapterTwoAssets.filter((url) => !worldAssets.includes(url)).length },
      rootResource,
      consoleErrors,
      pageErrors,
      failedRequests,
      httpErrors,
      externalRequests,
      basePathEscapes,
      ciRun,
      ciStatus,
      verifiedAtUtc: new Date().toISOString(),
    };
    write(result);
    return result;
  } catch (error) {
    const result = {
      schemaVersion: 1,
      verdict: "FAIL",
      canonicalUrl,
      expectedCommit,
      sourceTreeSha256,
      routeChecks,
      consoleErrors,
      pageErrors,
      failedRequests,
      httpErrors,
      externalRequests,
      basePathEscapes,
      error: error instanceof Error ? error.message : String(error),
      verifiedAtUtc: new Date().toISOString(),
    };
    write(result);
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyCompletePages();
  process.stdout.write(`${JSON.stringify({ verdict: result.verdict, canonicalUrl, deployedCommit: result.deployedCommit, output })}\n`);
}

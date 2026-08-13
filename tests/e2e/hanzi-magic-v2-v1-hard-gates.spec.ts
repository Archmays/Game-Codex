import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ADULT_TOOL_ROUTE_REGISTRY } from "../../src/app-route";
import { MACHINE_REVIEW_MANIFEST } from "../../tools/game-machine-review/machine-review-manifest";

const REPORT_PATH = resolve("artifacts/hanzi-radical-battle-v2/v1-release/V1-BROWSER-HARD-GATES.json");
const SOURCE_TREE_SHA256 = process.env.V1_SOURCE_TREE_SHA256 ?? "UNFROZEN";
const results: unknown[] = [];

interface Diagnostics { consoleErrors: string[]; pageErrors: string[]; externalRequests: string[] }

function observe(page: Page, context: BrowserContext): Diagnostics {
  const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], externalRequests: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  context.on("request", (request) => {
    if (!/^https?:/i.test(request.url())) return;
    const host = new URL(request.url()).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") diagnostics.externalRequests.push(request.url());
  });
  return diagnostics;
}

test.afterAll(() => {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify({ schemaVersion: 1, sourceTreeSha256: SOURCE_TREE_SHA256, resultCount: results.length, results, verdict: "PASS" }, null, 2)}\n`, "utf8");
});

test("classic hub keeps all ten entries, an existing game round-trip, and V1 as the Hanzi default", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await page.goto("/?hub=classic");
  const cards = page.locator(".game-card");
  const catalog = MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes;
  await expect(cards).toHaveCount(catalog.length);
  for (const game of catalog) await expect(cards.filter({ has: page.getByRole("heading", { name: game.title, exact: true }) })).toHaveCount(1);

  const memoryCard = cards.filter({ has: page.getByRole("heading", { name: "记忆翻牌", exact: true }) });
  await memoryCard.getByRole("button").click();
  await expect(page.getByRole("button", { name: "返回大厅" })).toBeVisible();
  await expect(page.locator(".memory-card-tile").first()).toBeVisible();
  await page.getByRole("button", { name: "返回大厅" }).click();
  await expect(cards).toHaveCount(catalog.length);

  const hanzi = cards.filter({ has: page.getByRole("heading", { name: "汉字魔法战", exact: true }) });
  await expect(hanzi).toContainText("V1.0.0 · 可玩");
  await hanzi.getByRole("button", { name: "走进森林" }).click();
  await expect(page).toHaveURL(/\?play=hanzi-v2-v1&from=hub$/);
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  results.push({ id: "HUB_OTHER_GAMES_AND_V1_DEFAULT", catalogEntries: catalog.length, existingGameRoundTrip: true, v1Default: true, diagnostics, verdict: "PASS" });
});

test("ordinary world opens V1 while the historical observer route remains the Golden Slice", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await page.goto("/?world=my-game-world");
  await expect(page.getByTestId("my-game-world")).toBeVisible();
  await expect(page.getByTestId("world-spellbook-object")).toContainText("十二字魔法书");
  const ordinaryHref = await page.getByTestId("world-forest-portal").getByRole("link").getAttribute("href");
  expect(ordinaryHref).toBe("?play=hanzi-v2-v1&from=world");
  await page.getByTestId("world-forest-portal").getByRole("link").click();
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();

  await page.goto("/?world=my-game-world&evidence=hanzi-v2-step06&session=malformed");
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.locator("[data-testid='hanzi-magic-v1']").count()).toBe(0);
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  results.push({ id: "WORLD_V1_AND_OBSERVER_FAIL_CLOSED", ordinaryHref, malformedObserverFailedClosed: true, diagnostics, verdict: "PASS" });
});

test("all adult tools render, reach document bottom with End, and return to top with Home", async ({ page, context }) => {
  test.setTimeout(120_000);
  const diagnostics = observe(page, context);
  const rows: unknown[] = [];
  for (const route of ADULT_TOOL_ROUTE_REGISTRY) {
    await page.goto(`/${route.query}`);
    await expect(page.locator("main, [role='main'], #app > *").first()).toBeVisible();
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length, route.query).toBeGreaterThan(20);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("End");
    await expect.poll(async () => page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight) - document.documentElement.scrollTop), { timeout: 8_000 }).toBeLessThanOrEqual(3);
    const bottom = await page.evaluate(() => ({ y: window.scrollY, bottom: Math.max(0, document.documentElement.scrollHeight - innerHeight) }));
    expect(bottom.y, `${route.query} must settle at document bottom`).toBeGreaterThanOrEqual(bottom.bottom - 2);
    await page.keyboard.press("Home");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
    rows.push({ route: route.query, textLength: bodyText.length, bottom, returnedTop: true, verdict: "PASS" });
  }
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  results.push({ id: "ADULT_TOOL_SCROLL_REGRESSION", routes: rows, diagnostics, verdict: "PASS" });
});

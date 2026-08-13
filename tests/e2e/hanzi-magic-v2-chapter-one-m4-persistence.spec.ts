import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  CHAPTER_ONE_CHARACTER_IDS,
  HANZI_MAGIC_M4_SAVE_KEY,
  HANZI_MAGIC_M4_V1_RAW_KEY,
  M4_REPAIR_IDS,
  createFreshM4Save,
  deriveM4Repairs,
  updateM4Save,
} from "../../games/hanzi-radical-battle/v2/chapter-one";
import { createV1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, writeV1Save } from "../../games/hanzi-radical-battle/v2/v1/save";

const output = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M4/screenshots");
mkdirSync(output, { recursive: true });

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function fullSave() {
  return updateM4Save(createFreshM4Save(), {
    discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS,
    completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"],
    repairedObjectIds: deriveM4Repairs(CHAPTER_ONE_CHARACTER_IDS, ["glimmer-grove", "echo-garden", "wind-trail"]),
    selectedHeroId: "ink-companion",
  });
}

function completedV1Raw(): string {
  const storage = new MemoryStorage();
  const ids = ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"] as const;
  const state = createV1GameState("browser-migration", { completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], unlockedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], discoveredCharacterIds: ids, campRepairStage: 3, freeAdventureUnlocked: true });
  writeV1Save(storage, saveFromGameState(createFreshV1Save({ muted: true, inputMode: "touch" }), state));
  return storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)!;
}

function monitor(page: Page) {
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:/.test(url.protocol) && url.hostname !== "127.0.0.1") externalRequests.push(request.url()); });
  return { consoleErrors, pageErrors, externalRequests };
}

async function inject(page: Page, entries: readonly (readonly [string, string])[]) {
  await page.addInitScript((values) => { for (const [key, value] of values) window.localStorage.setItem(key, value); }, entries);
}

async function expectGeometry(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
  }));
  expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.undersized).toEqual([]);
}

test("M4 desktop camp renders exactly eight persistent interactive repairs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page);
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullSave())]]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-camp-desktop");
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await expect(shell).toHaveAttribute("data-repair-count", "8");
  await expect(page.locator("[data-repair-id]")).toHaveCount(8);
  await expect(page.locator('[data-repair-id][data-repaired="true"]')).toHaveCount(8);
  await page.locator('[data-repair-id="stargazing-platform"]').click();
  await expect(page.getByTestId("chapter-one-repair-detail")).toContainText("休息多久都不会退步");
  await expect(page.getByTestId("chapter-one-repair-detail")).toContainText("字光");
  await page.locator('[data-action="close-overlay"]').click();
  await expect(page.locator('[data-repair-id="stargazing-platform"]')).toBeFocused();
  await expect(page.getByTestId("chapter-one-m3-camp")).toContainText("没有金币，也不会因为休息而退步");
  await expect(page.getByTestId("chapter-one-m3-camp")).not.toContainText(/得分|排行榜|连胜数|金币：|材料：|每日任务：/);
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, "M4-CAMP-DESKTOP-8-REPAIRS.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M4 desktop spellbook paginates all 36 entries and replays formation, meaning, and pronunciation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page);
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullSave())]]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-book-desktop");
  await page.locator('[data-action="open-spellbook"]').click();
  const book = page.getByTestId("chapter-one-spellbook");
  await expect(book).toHaveAttribute("data-total-entries", "36"); await expect(book).toHaveAttribute("data-page-count", "6");
  const ids = new Set<string>();
  for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
    for (const id of await page.locator("[data-action=select-spellbook-entry]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-character-id")!))) ids.add(id);
    if (pageIndex < 5) await page.locator('[data-action="spellbook-next"]').click();
  }
  expect(ids.size).toBe(36);
  await page.locator('[data-action="filter-spellbook"][data-filter="all"]').click();
  await page.locator("[data-spellbook-search]").fill("清");
  await expect(book).toHaveAttribute("data-filtered-count", "2");
  await page.locator("[data-action=select-spellbook-entry]").first().click();
  await expect(page.getByTestId("spellbook-detail")).toContainText("这是字义联想，不是字源说明");
  await page.locator('[data-action="replay-formation"]').click(); await expect(page.locator(".hm2-formation-replay")).toBeVisible();
  await page.locator('[data-action="replay-meaning"]').click(); await expect(page.locator(".hm2-magic-replay")).toBeVisible();
  await page.locator('[data-action="replay-pronunciation"]').click(); await expect(page.locator(".hm2-pronunciation-replay")).toContainText("正在重听");
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, "M4-SPELLBOOK-DESKTOP-REPLAYS.png"), fullPage: true });
  await page.locator('[data-action="close-overlay"]').click(); await expect(page.locator('[data-action="open-spellbook"]')).toBeFocused();
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M4 mobile migrates V1 raw bytes and preserves exactly its first three repairs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch"); const logs = monitor(page); const raw = completedV1Raw();
  await inject(page, [[HANZI_MAGIC_V1_SAVE_KEY, raw]]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-v1-mobile");
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await expect(shell).toHaveAttribute("data-save-source", "v1-migrated"); await expect(shell).toHaveAttribute("data-repair-count", "3"); await expect(shell).toHaveAttribute("data-discovered-count", "12");
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_M4_V1_RAW_KEY)).toBe(raw);
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_V1_SAVE_KEY)).toBe(raw);
  await page.locator('[data-repair-id="camp-lamp"]').tap(); await expect(page.getByTestId("chapter-one-repair-detail")).toHaveAttribute("data-repaired", "true");
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, "M4-V1-MIGRATION-MOBILE.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M4 interrupted run resumes after browser reload with a safe current-run summary", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-resume-browser");
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await page.locator('[data-action="start-run"]').click(); await page.locator('[data-action="choose-route"]').first().click(); await page.locator('[data-action="begin-behavior"]').click();
  await expect(shell).toHaveAttribute("data-phase", "behavior-effect"); const actionCount = await shell.getAttribute("data-action-count");
  await page.reload(); await expect(shell).toHaveAttribute("data-phase", "behavior-effect"); await expect(shell).toHaveAttribute("data-action-count", actionCount!);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), HANZI_MAGIC_M4_SAVE_KEY);
  expect(saved.currentRun).toMatchObject({ seed: "m4-resume-browser", phase: "behavior-effect", actionCount: Number(actionCount) });
  expect(JSON.stringify(saved)).not.toMatch(/keypress|keyHistory|score|streak|rank/i);
  await page.locator('[data-action="recover-behavior"]').click(); await expect(shell).toHaveAttribute("data-phase", "encounter");
  await page.screenshot({ path: resolve(output, "M4-RESUME-DESKTOP.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M4 parent clear requires a second confirmation and leaves frozen V1 data intact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const legacy = completedV1Raw();
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullSave())], [HANZI_MAGIC_V1_SAVE_KEY, legacy], [HANZI_MAGIC_M4_V1_RAW_KEY, legacy]]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-parent-clear");
  await page.locator('[data-action="open-parent"]').click(); const parent = page.getByTestId("chapter-one-parent");
  await expect(parent).toContainText("不会保存详细按键历史"); await page.locator('[data-action="arm-clear-progress"]').click();
  await expect(parent).toHaveAttribute("data-clear-armed", "true"); expect(await page.evaluate((key) => localStorage.getItem(key) !== null, HANZI_MAGIC_M4_SAVE_KEY)).toBe(true);
  await page.screenshot({ path: resolve(output, "M4-PARENT-SECOND-CONFIRM.png"), fullPage: true });
  await page.locator('[data-action="confirm-clear-progress"]').click();
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-repair-count", "0");
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_V1_SAVE_KEY)).toBe(legacy);
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_M4_V1_RAW_KEY)).toBe(legacy);
});

test("M4 tablet camp and spellbook remain overlap-free", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const context = await (browser as Browser).newContext({ viewport: { width: 820, height: 1180 } }); const page = await context.newPage(); const logs = monitor(page);
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullSave())]]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m4-tablet"); await expectGeometry(page);
  await page.locator('[data-action="open-spellbook"]').click(); await expect(page.getByTestId("chapter-one-spellbook")).toBeVisible(); await expectGeometry(page);
  await page.locator("[data-action=select-spellbook-entry]").first().click();
  const overlap = await page.evaluate(() => { const detail = document.querySelector(".hm2-book-detail")!.getBoundingClientRect(); const grid = document.querySelector(".hm2-book-grid")!.getBoundingClientRect(); return Math.max(0, Math.min(detail.right, grid.right) - Math.max(detail.left, grid.left)) * Math.max(0, Math.min(detail.bottom, grid.bottom) - Math.max(detail.top, grid.top)); });
  expect(overlap).toBe(0); await page.screenshot({ path: resolve(output, "M4-SPELLBOOK-TABLET.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await context.close();
});

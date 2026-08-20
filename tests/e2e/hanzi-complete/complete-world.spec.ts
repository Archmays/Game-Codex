import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const output = resolve("test-results/hanzi-complete/complete-world");
mkdirSync(output, { recursive: true });
const SAVE_KEY = "family-games/hanzi-magic-complete/v3";

function monitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/i.test(url) && new URL(url).hostname !== "127.0.0.1") externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const visibleControls = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      undersized: visibleControls.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    };
  });
}

test("opens on the world with one primary next action, local art and no dashboard copy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await page.goto("/?play=hanzi-magic-complete&from=hub&fresh=1");
  const world = page.getByTestId("hanzi-magic-complete");
  await expect(world).toHaveAttribute("data-screen", "world");
  await expect(world).toHaveAttribute("data-active-chapter", "chapter-one");
  await expect(page.getByTestId("complete-current-hero")).toHaveAttribute("data-hero-id", "light-speaker");
  await expect(page.getByTestId("complete-primary-action")).toHaveCount(1);
  await expect(page.locator("[data-chapter-id]")).toHaveCount(3);
  await expect(world).not.toContainText(/版本|正确率|学习目标|掌握率|排行榜|连胜/);
  const background = await page.locator(".hmc3-world-art").evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain("/assets/hanzi-radical-battle/v2/");
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  await page.screenshot({ path: resolve(output, "world-desktop.png"), fullPage: true });
});

test("persists hero and calm settings across a reload and exposes a parent-confirmed clear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/?play=hanzi-magic-complete&from=hub&fresh=1");
  await page.locator('[data-hero-id="forest-speaker"]').last().click();
  await page.locator('[data-pref="muted"]').click();
  await page.locator('[data-pref="reduced-motion"]').click();
  await page.goto("/?play=hanzi-magic-complete&from=hub");
  await expect(page.getByTestId("hanzi-magic-complete")).toHaveAttribute("data-hero-id", "forest-speaker");
  await expect(page.locator('[data-pref="muted"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-pref="reduced-motion"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.hmc3-header [data-action="toggle-parent"]').click();
  await expect(page.getByTestId("complete-parent-panel")).toBeVisible();
  await expect(page.getByTestId("complete-parent-panel")).toContainText("需要再次确认");
  expect(await geometry(page)).toMatchObject({ undersized: [] });
});

test("deep-links to the unchanged Chapter One app and returns to the V3 world", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/?play=hanzi-magic-complete&from=hub&chapter=one&fresh=1&seed=v3-adapter-browser");
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toBeVisible();
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-seed", "v3-adapter-browser");
  await expect(page.locator(".hm2-header a")).toHaveAttribute("href", "?play=hanzi-magic-complete&from=hub");
});

test("promotes the classic hub and My Game World forest portals to V3 while legacy deep links remain", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/?hub=classic&from=world");
  const card = page.locator(".game-card--ink-forest");
  await card.getByRole("button", { name: "进入墨迹森林" }).click();
  await expect(page).toHaveURL(/\?play=hanzi-magic-complete&from=hub$/);
  await expect(page.getByTestId("hanzi-magic-complete")).toBeVisible();
  await page.goto("/?world=my-game-world");
  await expect(page.locator("[data-world-forest-link]")).toHaveAttribute("href", "?play=hanzi-magic-complete&from=world");
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub");
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toBeVisible();
  await page.goto("/?play=hanzi-v2-v1&from=hub");
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
});

test("protects a future V3 save without overwriting it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const futureRaw = JSON.stringify({ schemaVersion: 99, futureField: "preserve-exactly" });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw: futureRaw });
  await page.goto("/?play=hanzi-magic-complete&from=hub");
  const world = page.getByTestId("hanzi-magic-complete");
  await expect(world).toHaveAttribute("data-save-read-only", "true");
  await expect(page.getByRole("status")).toContainText("不会覆盖");
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(futureRaw);
});

test("keeps the world readable and every visible control touch-sized at 390 by 844", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch");
  await page.goto("/?play=hanzi-magic-complete&from=hub&fresh=1");
  const result = await geometry(page);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  expect(result.undersized).toEqual([]);
  await page.locator('[data-pref="reduced-motion"]').tap();
  await expect(page.locator('[data-pref="reduced-motion"]')).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: resolve(output, "world-mobile.png"), fullPage: true });
});

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const output = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M2/screenshots");
mkdirSync(output, { recursive: true });
const EXPECTED_GLYPHS = "明花林星草看园回包风猫跑清晴松河海洋安闪你他好唱家苗菜音早笔尘国图圆问闭".split("");

test("M2-CONTENT renders all 36 structure cards and complete glyphs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/i.test(request.url()) && new URL(request.url()).origin !== "http://127.0.0.1:5183") externalRequests.push(request.url());
  });

  const seen: string[] = [];
  for (let sheet = 0; sheet < 6; sheet += 1) {
    await page.goto(`/?play=hanzi-v2-chapter-one&mode=content-audit&sheet=${sheet}`);
    const audit = page.getByTestId("chapter-one-content-audit");
    await expect(audit).toHaveAttribute("data-sheet", String(sheet));
    await expect(audit).toHaveAttribute("data-sheet-count", "6");
    const cards = page.getByTestId("character-audit-card");
    await expect(cards).toHaveCount(6);
    expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-hand-audit")))).toEqual(Array(6).fill("PASS"));
    const sheetGlyphs = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-glyph") ?? ""));
    seen.push(...sheetGlyphs);
    for (let index = 0; index < 6; index += 1) {
      const card = cards.nth(index);
      const glyph = sheetGlyphs[index];
      await expect(card.getByTestId("audit-complete-glyph")).toHaveText(glyph);
      await expect(card.getByTestId("audit-structure")).toBeVisible();
      await expect(card.locator("[data-component-glyph]")).toHaveCount(2);
      await expect(card).toContainText("3/3 变体 PASS");
    }
    await expect.poll(async () => cards.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
    await page.screenshot({ path: resolve(output, `M2-CONTENT-SHEET-${sheet + 1}.png`), fullPage: true });
  }
  expect(seen).toEqual(EXPECTED_GLYPHS);
  expect(new Set(seen).size).toBe(36);
  expect({ consoleErrors, pageErrors, externalRequests }).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const output = resolve("test-results/hanzi-complete/content-graph");
mkdirSync(output, { recursive: true });

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

test("renders all 72 core glyphs across six local audit sheets without tofu, overflow or runtime errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  const seen = new Set<string>();
  for (let sheet = 0; sheet < 6; sheet += 1) {
    await page.goto(`/?play=hanzi-magic-complete&from=hub&audit=content-graph&sheet=${sheet}`);
    const audit = page.getByTestId("complete-content-audit");
    await expect(audit).toHaveAttribute("data-core-count", "72");
    await expect(audit).toHaveAttribute("data-sheet", String(sheet));
    const cards = page.getByTestId("complete-glyph-card");
    await expect(cards).toHaveCount(12);
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const glyphs = [...document.querySelectorAll<HTMLElement>("[data-testid=complete-glyph]")];
      const canvas = document.createElement("canvas");
      canvas.width = 112;
      canvas.height = 112;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.font = '76px "Microsoft YaHei", "Noto Sans CJK SC", SimSun, sans-serif';
      context.textBaseline = "top";
      const signature = (value: string) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000";
        context.fillText(value, 10, 8);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261;
        let ink = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          const alpha = pixels[index];
          if (alpha > 0) ink += 1;
          hash ^= alpha;
          hash = Math.imul(hash, 16777619);
        }
        return `${ink}:${hash >>> 0}`;
      };
      const fallbackSignatures = new Set([signature("�"), signature("□"), signature("■")]);
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        glyphs: glyphs.map((element) => {
          const glyph = element.textContent?.trim() ?? "";
          const raster = signature(glyph);
          return { glyph, raster, ink: Number(raster.split(":")[0]), fallback: fallbackSignatures.has(raster), fontFamily: getComputedStyle(element).fontFamily, ariaLabel: element.getAttribute("aria-label") };
        }),
      };
    });
    expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
    for (const glyph of result.glyphs) {
      expect(glyph.glyph).toHaveLength(1);
      expect(glyph.ink, glyph.glyph).toBeGreaterThan(120);
      expect(glyph.fallback, glyph.glyph).toBe(false);
      expect(glyph.fontFamily).toContain("Microsoft YaHei");
      expect(glyph.ariaLabel).toBe(`汉字 ${glyph.glyph}`);
      expect(seen.has(glyph.glyph)).toBe(false);
      seen.add(glyph.glyph);
    }
    if (sheet === 0 || sheet === 5) await page.screenshot({ path: resolve(output, `glyph-sheet-${sheet + 1}.png`), fullPage: true });
  }
  expect(seen.size).toBe(72);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("keeps the glyph sheet readable without horizontal overflow on a normal mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch");
  await page.goto("/?play=hanzi-magic-complete&from=hub&audit=content-graph&sheet=0");
  await expect(page.getByTestId("complete-glyph-card")).toHaveCount(12);
  const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await page.screenshot({ path: resolve(output, "glyph-sheet-mobile.png"), fullPage: true });
});

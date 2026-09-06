import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, route: string, selector: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

test("@visual top world desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await open(page, "/?world=my-game-world", '[data-testid="my-game-world"]');
  await expect(page.getByTestId("my-game-world")).toHaveScreenshot(`top-world-${testInfo.project.name}.png`);
});

test("@visual Math World map desktop, tablet, and mobile", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "tablet-768", "mobile-390"].includes(testInfo.project.name));
  await open(page, "/?world=math-world", '[data-testid="math-world-map"]');
  await expect(page.getByTestId("math-world-map")).toHaveScreenshot(`math-world-map-${testInfo.project.name}.png`);
});

test("@visual representative station states", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");

  await open(page, "/?world=math-world&station=target", ".make-target-game");
  await expect(page).toHaveScreenshot("target-base-desktop.png", { fullPage: true });
  await page.getByRole("button", { name: "给我一点提示" }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page).toHaveScreenshot("target-hint-desktop.png", { fullPage: true });

  await open(page, "/?world=math-world&station=slider", ".equation-slider");
  await expect(page.locator(".equation-slider")).toHaveScreenshot("slider-adapter-desktop.png");


});

test("@geometry routes are overflow-free with usable semantic controls", async ({ page }, testInfo) => {
  const routes = [
    ["/?world=my-game-world", '[data-testid="my-game-world"]'],
    ["/?world=math-world", '[data-testid="math-world-map"]'],
    ["/?world=math-world&station=target", ".make-target-game"],
    ["/?world=math-world&station=slider", ".equation-slider"],
  ] as const;
  for (const [route, selector] of routes) {
    await open(page, route, selector);
    const result = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const controls = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [role=slider]")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { name: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40), width: rect.width, height: rect.height };
        });
      return {
        overflow: document.documentElement.scrollWidth - viewportWidth,
        tiny: controls.filter((control) => control.width < 24 || control.height < 24),
        unnamed: controls.filter((control) => !control.name),
      };
    });
    expect(result.overflow, `${testInfo.project.name} ${route}`).toBeLessThanOrEqual(1);
    expect(result.tiny, `${testInfo.project.name} ${route} undersized controls`).toEqual([]);
    expect(result.unnamed, `${testInfo.project.name} ${route} unnamed controls`).toEqual([]);
  }
});

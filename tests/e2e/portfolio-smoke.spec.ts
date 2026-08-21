import { expect, test, type Locator, type Page } from "@playwright/test";

interface RuntimeObservation {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly failedResponses: string[];
  readonly failedRequests: string[];
  readonly externalRequests: string[];
}

interface SmokeGame {
  readonly id: string;
  readonly title: string;
  readonly surface: string;
  interact(page: Page): Promise<Locator | null>;
}

function observeRuntime(page: Page): RuntimeObservation {
  const result: RuntimeObservation = { pageErrors: [], consoleErrors: [], failedResponses: [], failedRequests: [], externalRequests: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) result.failedResponses.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    // Route changes intentionally cancel Vite module requests that are no longer
    // needed. They are not runtime/network failures of the destination screen.
    if (errorText !== "net::ERR_ABORTED") result.failedRequests.push(`${request.url()} ${errorText}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:5291") result.externalRequests.push(request.url());
  });
  return result;
}

async function expectRuntimeClean(runtime: RuntimeObservation): Promise<void> {
  expect(runtime.pageErrors, "page errors").toEqual([]);
  expect(runtime.consoleErrors, "console errors").toEqual([]);
  expect(runtime.failedResponses, "HTTP responses >= 400").toEqual([]);
  expect(runtime.failedRequests, "failed runtime requests").toEqual([]);
  expect(runtime.externalRequests, "unexpected external requests").toEqual([]);
}

async function expectNoFatalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
}

async function expectUsableTarget(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "primary interaction has a layout box").not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(24);
  expect(box!.height).toBeGreaterThanOrEqual(24);
}

const GAMES: readonly SmokeGame[] = [
  {
    id: "memory-card", title: "记忆翻牌", surface: ".memory-card-game",
    async interact(page) {
      const card = page.locator(".memory-card-grid button").first();
      await expectUsableTarget(card);
      await card.click();
      await expect(card).not.toHaveAttribute("aria-label", "未翻开的卡片");
      return card;
    },
  },
  {
    id: "math-lab", title: "数学实验室", surface: "canvas",
    async interact(page) {
      const canvas = page.locator(".game-stage canvas");
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      const box = await canvas.boundingBox();
      if (!box) throw new Error("Math Lab canvas has no layout box");
      const compact = box.width < 560;
      await canvas.click({ position: { x: box.width * (compact ? 0.89 : 0.42), y: Math.min(box.height - 20, compact ? 193 : 215) } });
      await expect(canvas).toBeVisible();
      return canvas;
    },
  },
  {
    id: "hanzi-radical-battle", title: "汉字魔法战", surface: '[data-testid="hanzi-magic-complete"]',
    async interact(page) {
      const primary = page.locator('[data-testid="complete-primary-action"]');
      await expectUsableTarget(primary);
      await primary.click();
      await expect(page.locator('[data-testid="hanzi-magic-chapter-one-m3"]')).toBeVisible({ timeout: 30_000 });
      await page.locator('a[href*="play=hanzi-magic-complete"]').first().click();
      await expect(page.locator('[data-testid="hanzi-magic-complete"]')).toBeVisible();
      return primary;
    },
  },
  {
    id: "multiplication-adventure", title: "九九乘法表", surface: ".multiplication-game",
    async interact(page) {
      const action = page.getByRole("button", { name: "看卡片学习" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.getByRole("button", { name: "返回乘法主页" })).toBeVisible();
      return action;
    },
  },
  {
    id: "english-spell-battle", title: "英文魔法战", surface: ".english-spell-game",
    async interact(page) {
      await page.getByRole("button", { name: "Level 1 首字母" }).click();
      const letter = page.locator(".letter-bank button").first();
      await expectUsableTarget(letter);
      await letter.click();
      await expect(page.locator(".learning-feedback")).toBeVisible();
      await expect(page.locator(".learning-feedback")).not.toBeEmpty();
      return letter;
    },
  },
  {
    id: "clock-reader", title: "认识时钟", surface: ".clock-game",
    async interact(page) {
      const action = page.getByRole("button", { name: "时针 +" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator(".clock-hand--hour")).toBeVisible();
      return action;
    },
  },
  {
    id: "make-target", title: "凑10算12算24", surface: ".make-target-game",
    async interact(page) {
      const cards = page.locator(".make-target-card");
      await cards.nth(0).click();
      await cards.nth(1).click();
      await page.getByRole("button", { name: "+", exact: true }).click();
      const action = page.getByRole("button", { name: "合并" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator(".make-target-history li")).toHaveCount(1);
      return action;
    },
  },
  {
    id: "equation-slider", title: "算式滑轨", surface: ".equation-slider",
    async interact(page) {
      await page.getByRole("button", { name: "跳过教程" }).click();
      const action = page.getByRole("button", { name: "第 2 列向上移动" });
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator("[data-coverage-progress]")).toHaveText("2/6");
      return action;
    },
  },
  {
    id: "pinyin-magic-battle", title: "汉字魔法战-拼音", surface: ".pinyin-game",
    async interact(page) {
      await page.getByRole("button", { name: "勇者试炼" }).click();
      const action = page.locator(".pinyin-option-grid button").first();
      await expectUsableTarget(action);
      await action.click();
      await expect(page.locator(".learning-feedback")).toBeVisible();
      return action;
    },
  },
] as const;

for (const game of GAMES) {
  test(`@game:${game.id} enters, completes one primary interaction, and returns`, async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/?hub=classic", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".game-card")).toHaveCount(9);
    const card = page.locator(`.game-card[data-game-id="${game.id}"]`);
    await expect(card.getByRole("heading", { name: game.title, exact: true })).toBeVisible();
    const entry = card.getByRole("button");
    await expectUsableTarget(entry);
    await entry.focus();
    await expect(entry).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(game.surface)).toBeVisible({ timeout: 30_000 });
    await game.interact(page);
    await expectNoFatalOverflow(page);

    if (game.id === "hanzi-radical-battle") {
      const returnLink = page.locator('a[href*="hub=classic"]').first();
      await expectUsableTarget(returnLink);
      await returnLink.click();
    } else {
      const returnButton = page.getByRole("button", { name: "返回大厅", exact: true });
      await expectUsableTarget(returnButton);
      await returnButton.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(".game-card")).toHaveCount(9);
    await expectRuntimeClean(runtime);
  });
}

test("@portfolio public route registry preserves world, classic, and Hanzi legacy routes", async ({ page }) => {
  const runtime = observeRuntime(page);
  const routes = [
    ["/", '[data-testid="my-game-world"]'],
    ["/?world=my-game-world", '[data-testid="my-game-world"]'],
    ["/?hub=classic", ".hub-grid"],
    ["/?play=hanzi-magic-complete&from=hub", '[data-testid="hanzi-magic-complete"]'],
    ["/?play=hanzi-v2-chapter-one&from=hub", '[data-testid="hanzi-magic-chapter-one-m3"]'],
    ["/?play=hanzi-v2-v1&from=hub", '[data-testid="hanzi-magic-v1"]'],
  ] as const;
  for (const [route, selector] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(selector)).toBeVisible({ timeout: 30_000 });
    await expectNoFatalOverflow(page);
  }
  await expectRuntimeClean(runtime);
});

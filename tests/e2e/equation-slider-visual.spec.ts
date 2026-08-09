import { expect, test, type Locator, type Page } from "@playwright/test";

const BOARD = "[data-equation-board]";
const ACTIONS = "[data-primary-actions]";
const AFTER_DIR = "docs/screenshots/equation-slider/rebuild-v3/after";

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800, expectedBoardHeight: 252 },
  { name: "390x844", width: 390, height: 844, expectedBoardHeight: 252 },
  { name: "768x1024", width: 768, height: 1024, expectedBoardHeight: 272 },
  { name: "1024x768", width: 1024, height: 768, expectedBoardHeight: 272 },
  { name: "1440x900", width: 1440, height: 900, expectedBoardHeight: 272 }
] as const;

async function openFreshSlider(page: Page): Promise<void> {
  await page.goto("/?hub=classic");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "进入轨道站" }).click();
  await expect(page.locator(`${BOARD}[data-level-id='es-1-01']`)).toBeVisible();
}

async function openFirstLevelWithoutCoach(page: Page): Promise<void> {
  await openFreshSlider(page);
  await page.getByRole("button", { name: "跳过教程" }).click();
  await expect(page.locator(".equation-slider__coach")).toBeHidden();
}

async function openLevel(page: Page, chapterId: string, levelId: string): Promise<void> {
  await openFirstLevelWithoutCoach(page);
  await page.getByRole("button", { name: "关卡列表" }).click();
  await page.getByRole("button", { name: "线路地图" }).click();
  await page.locator(`button[data-chapter-id='${chapterId}']`).click();
  await page.locator(`button[data-level-id='${levelId}']`).click();
  await expect(page.locator(`${BOARD}[data-level-id='${levelId}']`)).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyClientWidth);
}

async function expectMinimumHitTargets(locator: Locator): Promise<void> {
  const boxes = await locator.evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        return !element.hidden && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((node) => {
        const box = node.getBoundingClientRect();
        return {
          label: node.getAttribute("aria-label") ?? node.textContent?.trim() ?? node.tagName,
          width: box.width,
          height: box.height
        };
      })
  );

  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width, `${box.label} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${box.label} height`).toBeGreaterThanOrEqual(44);
  }
}

async function expectFirstScreenUsable(
  page: Page,
  viewportHeight: number,
  expectedBoardHeight: number
): Promise<void> {
  const target = page.locator("[data-level-target]");
  const board = page.locator(BOARD);
  const actions = page.locator(ACTIONS);

  await expect(target).toBeVisible();
  await expect(board).toBeVisible();
  await expect(actions).toBeVisible();

  const targetBox = await target.boundingBox();
  const boardBox = await board.boundingBox();
  const actionsBox = await actions.boundingBox();
  if (!targetBox || !boardBox || !actionsBox) {
    throw new Error("Target, board, or primary actions did not produce a layout box");
  }

  expect(targetBox.y).toBeGreaterThanOrEqual(0);
  expect(boardBox.height).toBe(expectedBoardHeight);
  expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(viewportHeight);
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(viewportHeight);
  await expectNoHorizontalOverflow(page);
  await expectMinimumHitTargets(page.locator(".equation-slider button"));
}

async function completeFirstLevelThroughUi(page: Page): Promise<void> {
  await openFirstLevelWithoutCoach(page);

  // Starting at 4 + 5, visit the three visible valid pairs using only reel controls.
  await page.getByRole("button", { name: "第 2 列向上移动" }).click();
  await expect(page.locator("[data-coverage-progress]")).toHaveText("2/6");

  await page.getByRole("button", { name: "第 1 列向下移动" }).click();
  await page.getByRole("button", { name: "第 2 列向下移动" }).click();
  await expect(page.locator("[data-coverage-progress]")).toHaveText("4/6");

  await page.getByRole("button", { name: "第 1 列向下移动" }).click();
  await page.getByRole("button", { name: "第 2 列向下移动" }).click();
  await expect(page.locator("[data-coverage-progress]")).toHaveText("6/6");
  await expect(page.locator("[data-completion-card]")).toBeVisible();
}

test.describe("@visual equation slider V3 responsive and formal evidence", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} keeps the complete first interaction on the first screen`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openFreshSlider(page);

      await expectFirstScreenUsable(page, viewport.height, viewport.expectedBoardHeight);
      await page.screenshot({
        path: `${AFTER_DIR}/responsive-${viewport.name}-tutorial-first-screen.png`
      });
    });
  }

  test("route map remains usable and free of horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFirstLevelWithoutCoach(page);
    await page.getByRole("button", { name: "关卡列表" }).click();
    await page.getByRole("button", { name: "线路地图" }).click();

    await expect(page.locator("button[data-chapter-id]")).toHaveCount(4);
    await expectMinimumHitTargets(page.locator(".equation-slider button"));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${AFTER_DIR}/route-map-1440x900.png` });
  });

  test("three-reel multi-target board preserves one formal tile set", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openLevel(page, "chapter-2", "es-2-41");

    await expect(page.locator("[data-level-target]")).toContainText("多目标");
    await expect(page.locator("[data-reel-id]")).toHaveCount(3);
    await expect(page.locator("[data-tile-id]")).toHaveCount(9);
    await expect(page.locator(BOARD)).toHaveCSS("height", "272px");
    await expectMinimumHitTargets(page.locator(".equation-slider button"));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${AFTER_DIR}/multi-target-three-reels-es-2-41-768x1024.png` });
  });

  test("five-reel board fits a narrow phone without clipping or overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openLevel(page, "chapter-4", "es-4-50");

    await expect(page.locator("[data-reel-id]")).toHaveCount(5);
    await expect(page.locator("[data-tile-id]")).toHaveCount(15);
    await expect(page.locator(BOARD)).toHaveCSS("height", "252px");
    await expectFirstScreenUsable(page, 800, 252);
    await page.screenshot({ path: `${AFTER_DIR}/five-reels-es-4-50-360x800.png` });
  });

  test("equality board presents its balance target and stable controls", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openLevel(page, "chapter-4", "es-4-01");

    await expect(page.locator("[data-level-target]")).toContainText("平衡目标");
    await expect(page.locator("[data-level-target] strong")).toContainText("=");
    await expect(page.locator("[data-reel-id]")).toHaveCount(3);
    await expectMinimumHitTargets(page.locator(".equation-slider button"));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${AFTER_DIR}/equality-es-4-01-1024x768.png` });
  });

  test("first level can reach a complete coverage state through visible controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await completeFirstLevelThroughUi(page);

    await expect(page.locator("[data-completion-card]")).toContainText("本关完成");
    await expectMinimumHitTargets(page.locator(".equation-slider button"));
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${AFTER_DIR}/completed-es-1-01-390x844.png` });
  });

  test("first level preserves distinct initial, first-light, and partial-coverage evidence", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFirstLevelWithoutCoach(page);

    await expect(page.locator("[data-coverage-progress]")).toHaveText("0/6");
    await page.screenshot({ path: `${AFTER_DIR}/first-level-initial-es-1-01-390x844.png` });

    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await expect(page.locator("[data-coverage-progress]")).toHaveText("2/6");
    await page.screenshot({ path: `${AFTER_DIR}/first-light-es-1-01-390x844.png` });

    await page.getByRole("button", { name: "第 1 列向下移动" }).click();
    await page.getByRole("button", { name: "第 2 列向下移动" }).click();
    await expect(page.locator("[data-coverage-progress]")).toHaveText("4/6");
    await page.screenshot({ path: `${AFTER_DIR}/partial-coverage-es-1-01-390x844.png` });
  });

  test("pointer preview keeps the fixed-height board and formal node count", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFirstLevelWithoutCoach(page);
    const reelWindow = page.locator("[data-reel-window]").first();
    const box = await reelWindow.boundingBox();
    if (!box) throw new Error("First reel has no layout box");
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x, center.y + 42, { steps: 4 });
    try {
      await expect(page.locator(".equation-slider__reel.is-dragging")).toHaveCount(1);
      await expect(page.locator("[data-tile-id]")).toHaveCount(6);
      await expect(page.locator(BOARD)).toHaveCSS("height", "252px");
      await page.screenshot({ path: `${AFTER_DIR}/pointer-preview-es-1-01-390x844.png` });
    } finally {
      await page.mouse.up();
    }
  });
});

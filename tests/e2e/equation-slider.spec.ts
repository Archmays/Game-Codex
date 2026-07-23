import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BOARD_SELECTOR = "[data-equation-board]";
const FIRST_BOARD_SELECTOR = "[data-equation-board][data-level-id='es-1-01']";
const REEL_WINDOW_SELECTOR = "[data-reel-window]";
const VISUAL_TILE_SELECTOR = ".equation-slider__tile";
const FORMAL_TILE_SELECTOR = "[data-tile-id]";
const EXPRESSION_SELECTOR = ".equation-slider__current-expression";
const COVERAGE_SELECTOR = "[data-coverage-progress]";
const MOVE_COUNT_SELECTOR = "[data-move-count]";
const LIVE_COACH_SELECTOR = ".equation-slider__coach[data-tutorial-step='move-target']";

async function openFreshSlider(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "进入轨道站" }).click();

  await expect(page.locator(FIRST_BOARD_SELECTOR)).toBeVisible();
  await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 5 = 9");
  await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
  await expect(page.locator(MOVE_COUNT_SELECTOR)).toHaveText("0");
  await expect(page.locator(LIVE_COACH_SELECTOR)).toBeVisible();
  await expect(page.locator(LIVE_COACH_SELECTOR)).toContainText(
    "把右边滑轨上方的 2 移到中央"
  );
}

async function openFirstLevel(page: Page): Promise<void> {
  await openFreshSlider(page);
  await page.getByRole("button", { name: "跳过教程" }).click();
  await expect(page.locator(FIRST_BOARD_SELECTOR)).toBeVisible();
  await expect(page.locator(".equation-slider__coach")).toBeHidden();
}

async function openLevel(
  page: Page,
  chapterId: string,
  levelId: string
): Promise<void> {
  await openFirstLevel(page);
  await page.getByRole("button", { name: "关卡列表" }).click();
  await page.getByRole("button", { name: "线路地图" }).click();
  await page.locator(`[data-chapter-id='${chapterId}']`).click();
  const levelButton = page.locator(`button[data-level-id='${levelId}']`);
  await expect(levelButton).toBeVisible();
  await levelButton.click();
  await expect(page.locator(`${BOARD_SELECTOR}[data-level-id='${levelId}']`)).toBeVisible();
}

function reelWindow(page: Page, index = 0): Locator {
  return page.locator(REEL_WINDOW_SELECTOR).nth(index);
}

async function formalTileIds(page: Page): Promise<string[]> {
  return page.locator(FORMAL_TILE_SELECTOR).evaluateAll((tiles) =>
    tiles.map((tile) => tile.getAttribute("data-tile-id") ?? "")
  );
}

async function expectMoveCount(page: Page, expected: number): Promise<void> {
  await expect(page.locator(MOVE_COUNT_SELECTOR)).toHaveText(String(expected));
}

async function boardHeight(page: Page): Promise<number> {
  const box = await page.locator(BOARD_SELECTOR).boundingBox();
  if (!box) throw new Error("Board has no bounding box");
  return box.height;
}

async function beginMousePreview(page: Page, reelIndex = 0, deltaY = 55): Promise<void> {
  const box = await reelWindow(page, reelIndex).boundingBox();
  if (!box) throw new Error(`Reel ${reelIndex + 1} has no bounding box`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY);
}

async function dispatchTouchGesture(
  page: Page,
  context: BrowserContext,
  start: { readonly x: number; readonly y: number },
  deltaY: number,
  endType: "touchEnd" | "touchCancel" = "touchEnd"
): Promise<void> {
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, radiusX: 8, radiusY: 8, force: 1, id: 1 }]
  });
  for (let step = 1; step <= 4; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: start.x,
        y: start.y + (deltaY * step) / 4,
        radiusX: 8,
        radiusY: 8,
        force: 1,
        id: 1
      }]
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: endType, touchPoints: [] });
  await client.detach();
}

async function touchPreview(
  page: Page,
  context: BrowserContext,
  reelIndex = 0,
  deltaY = 55,
  endType: "touchEnd" | "touchCancel" = "touchEnd"
): Promise<void> {
  const box = await reelWindow(page, reelIndex).boundingBox();
  if (!box) throw new Error(`Reel ${reelIndex + 1} has no bounding box`);
  await dispatchTouchGesture(
    page,
    context,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    deltaY,
    endType
  );
}

async function scrollStageOutsideReel(page: Page, context: BrowserContext): Promise<void> {
  const stage = page.locator(".game-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Game stage has no bounding box");
  const start = {
    x: box.x + 8,
    y: Math.min(box.y + box.height - 32, page.viewportSize()?.height ?? 520)
  };
  const startsOutsideReel = await page.evaluate(({ x, y }) => {
    return !document.elementFromPoint(x, y)?.closest("[data-reel-window]");
  }, start);
  expect(startsOutsideReel).toBe(true);
  await dispatchTouchGesture(page, context, start, -220);
}

test.describe("@gate-a equation slider V3 board and tutorial", () => {
  test("fresh storage opens the one formal first-level flow with live coaching", async ({ page }) => {
    await openFreshSlider(page);

    await expect(page.locator(BOARD_SELECTOR)).toHaveCount(1);
    await expect(page.locator(FIRST_BOARD_SELECTOR)).toHaveAttribute("data-board-status", "ready");
    await expect(page.locator("[data-tutorial-target='true']")).toHaveCount(1);
  });

  test("tutorial target is part of the formal board and is the hit-test top object", async ({ page }) => {
    await openFreshSlider(page);
    const target = page.locator("[data-tutorial-target='true']");
    await expect(target).toHaveCount(1);
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute("data-position", "previous");

    const box = await target.boundingBox();
    if (!box) throw new Error("Tutorial target has no bounding box");
    const topElementIsTarget = await page.evaluate(
      ({ x, y }) => {
        const targetElement = document.querySelector("[data-tutorial-target='true']");
        const top = document.elementFromPoint(x, y);
        return Boolean(targetElement && top && (top === targetElement || targetElement.contains(top)));
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    );
    expect(topElementIsTarget).toBe(true);
  });

  test("tutorial advances only after the requested real board move", async ({ page }) => {
    await openFreshSlider(page);
    await page.getByRole("button", { name: "第 2 列向上移动" }).click();

    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("2/6");
    await expectMoveCount(page, 1);
    await expect(page.locator("[data-tutorial-step='coverage']")).toBeVisible();
    await expect(page.locator("[data-tutorial-step='move-target']")).toHaveCount(0);
  });

  test("a wrong tutorial move changes the board but cannot advance the coach", async ({ page }) => {
    await openFreshSlider(page);
    await page.getByRole("button", { name: "第 2 列向下移动" }).click();

    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 4 = 8");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
    await expectMoveCount(page, 1);
    await expect(page.locator(LIVE_COACH_SELECTOR)).toBeVisible();
    await expect(page.locator("[data-tutorial-step='coverage']")).toHaveCount(0);
  });

  test("tutorial has no static next-step substitute and never inerts the board", async ({ page }) => {
    await openFreshSlider(page);

    await expect(page.getByRole("button", { name: "下一步" })).toHaveCount(0);
    await expect(page.locator("[data-equation-board][inert]")).toHaveCount(0);
    await expect(page.locator("[data-equation-board] [inert]")).toHaveCount(0);
  });

  test("the first level has two number reels, one fixed operator, and six formal tiles", async ({ page }) => {
    await openFirstLevel(page);

    await expect(page.locator("[data-reel-id]")).toHaveCount(2);
    await expect(page.locator("[data-fixed-token]")).toHaveCount(1);
    await expect(page.locator(FORMAL_TILE_SELECTOR)).toHaveCount(6);
    await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
  });

  test("controls remain buttons and never receive tile descendants during preview", async ({ page }) => {
    await openFirstLevel(page);
    await beginMousePreview(page, 0, 55);
    try {
      const controls = page.locator("[data-control-direction]");
      await expect(controls).toHaveCount(4);
      expect(
        await controls.evaluateAll((nodes) => nodes.every((node) => node.tagName === "BUTTON"))
      ).toBe(true);
      await expect(page.locator(`button ${VISUAL_TILE_SELECTOR}`)).toHaveCount(0);
      await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
    } finally {
      await page.mouse.up();
    }
  });

  test("every formal tile ID is present and unique", async ({ page }) => {
    await openFirstLevel(page);
    await expect(page.locator(FORMAL_TILE_SELECTOR)).toHaveCount(6);
    const ids = await formalTileIds(page);

    expect(ids).toHaveLength(6);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("pointer preview preserves the exact formal tile ID set", async ({ page }) => {
    await openFirstLevel(page);
    const before = (await formalTileIds(page)).sort();
    await beginMousePreview(page, 0, 55);
    try {
      await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
      expect((await formalTileIds(page)).sort()).toEqual(before);
    } finally {
      await page.mouse.up();
    }
  });

  test("one hundred mixed moves do not grow nodes, controls, IDs, or board height", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFirstLevel(page);
    const initialHeight = await boardHeight(page);
    const initialIds = (await formalTileIds(page)).sort();
    const controls = page.locator("[data-control-direction]");
    await expect(controls).toHaveCount(4);

    for (let index = 0; index < 100; index += 1) {
      const direction = index % 2 === 0 ? "向上移动" : "向下移动";
      await page.getByRole("button", { name: `第 1 列${direction}` }).click();
    }

    await expectMoveCount(page, 100);
    await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
    await expect(controls).toHaveCount(4);
    expect((await formalTileIds(page)).sort()).toEqual(initialIds);
    expect(Math.abs((await boardHeight(page)) - initialHeight)).toBeLessThanOrEqual(2);
  });

  test("pointercancel preserves move, coverage, expression, IDs, controls, and geometry", async ({ page, context }) => {
    await openFirstLevel(page);
    const expression = await page.locator(EXPRESSION_SELECTOR).textContent();
    const coverage = await page.locator(COVERAGE_SELECTOR).textContent();
    const ids = (await formalTileIds(page)).sort();
    const height = await boardHeight(page);

    await touchPreview(page, context, 0, 55, "touchCancel");

    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText(expression ?? "");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText(coverage ?? "");
    await expectMoveCount(page, 0);
    await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
    await expect(page.locator("[data-control-direction]")).toHaveCount(4);
    await expect(page.locator(`button ${VISUAL_TILE_SELECTOR}`)).toHaveCount(0);
    await expect(page.locator(".is-dragging")).toHaveCount(0);
    expect((await formalTileIds(page)).sort()).toEqual(ids);
    expect(Math.abs((await boardHeight(page)) - height)).toBeLessThanOrEqual(2);
  });

  test("lostpointercapture cancels without committing or corrupting board state", async ({ page }) => {
    await openFirstLevel(page);
    const expression = await page.locator(EXPRESSION_SELECTOR).textContent();
    const coverage = await page.locator(COVERAGE_SELECTOR).textContent();
    const ids = (await formalTileIds(page)).sort();
    await beginMousePreview(page, 0, 55);

    const released = await reelWindow(page, 0).evaluate((element) => {
      for (let pointerId = 1; pointerId <= 16; pointerId += 1) {
        if (element.hasPointerCapture(pointerId)) {
          element.releasePointerCapture(pointerId);
          return true;
        }
      }
      return false;
    });
    await page.mouse.up();

    expect(released).toBe(true);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText(expression ?? "");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText(coverage ?? "");
    await expectMoveCount(page, 0);
    await expect(page.locator(".is-dragging")).toHaveCount(0);
    await expect(page.locator(VISUAL_TILE_SELECTOR)).toHaveCount(6);
    await expect(page.locator(`button ${VISUAL_TILE_SELECTOR}`)).toHaveCount(0);
    expect((await formalTileIds(page)).sort()).toEqual(ids);
  });

  test("leaving and re-entering creates one move listener and a fresh board session", async ({ page }) => {
    await openFirstLevel(page);
    await page.getByRole("button", { name: "关卡列表" }).click();
    const firstLevel = page.locator("button[data-level-id='es-1-01']");
    await expect(firstLevel).toBeVisible();
    await firstLevel.click();
    await expect(page.locator(FIRST_BOARD_SELECTOR)).toBeVisible();
    await expectMoveCount(page, 0);

    await page.getByRole("button", { name: "第 1 列向上移动" }).click();
    await expectMoveCount(page, 1);
  });

  test("initial render never lights a tile automatically", async ({ page }) => {
    await openFirstLevel(page);

    await expect(page.locator(`${FORMAL_TILE_SELECTOR}.is-lit`)).toHaveCount(0);
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
  });

  test("fixed operator is semantic, immovable, and excluded from coverage", async ({ page }) => {
    await openFirstLevel(page);
    const fixed = page.locator("[data-fixed-token]");

    await expect(fixed).toHaveCount(1);
    await expect(fixed).toHaveText("+");
    await expect(fixed.locator("button")).toHaveCount(0);
    await expect(fixed.locator(FORMAL_TILE_SELECTOR)).toHaveCount(0);
    await expect(page.locator("[data-required-tile-count]")).toHaveText("6");
  });

  test("undo and reset restore exact formal state rather than only changing visuals", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFirstLevel(page);
    const initialIds = (await formalTileIds(page)).sort();

    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("2/6");
    await expectMoveCount(page, 1);
    await page.getByRole("button", { name: "撤销" }).click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 5 = 9");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
    await expectMoveCount(page, 0);
    expect((await formalTileIds(page)).sort()).toEqual(initialIds);

    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("2/6");
    await page.getByRole("button", { name: "重置" }).click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 5 = 9");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
    await expectMoveCount(page, 0);
    await expect(page.locator(`${FORMAL_TILE_SELECTOR}.is-lit`)).toHaveCount(0);
    expect((await formalTileIds(page)).sort()).toEqual(initialIds);
  });

  test("three distinct valid combinations light all six tiles and show completion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFirstLevel(page);
    const leftUp = page.getByRole("button", { name: "第 1 列向上移动" });
    const rightUp = page.getByRole("button", { name: "第 2 列向上移动" });

    await rightUp.click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("2/6");
    await leftUp.click();
    await rightUp.click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("2 + 4 = 6");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("4/6");
    await leftUp.click();
    await rightUp.click();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("1 + 5 = 6");

    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("6/6");
    await expectMoveCount(page, 5);
    await expect(page.locator("[data-completion-card]")).toBeVisible();
    await expect(page.locator("[data-completion-card]")).toContainText("本关完成");
    await expect(page.getByRole("button", { name: "再玩一次" })).toBeVisible();
  });

  test("reopen tutorial restarts the exact first board with live coaching", async ({ page }) => {
    await openFirstLevel(page);
    await page.getByRole("button", { name: "第 2 列向下移动" }).click();
    await expectMoveCount(page, 1);
    await page.getByRole("button", { name: "重新教程" }).click();

    await expect(page.locator(FIRST_BOARD_SELECTOR)).toBeVisible();
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 5 = 9");
    await expect(page.locator(COVERAGE_SELECTOR)).toHaveText("0/6");
    await expectMoveCount(page, 0);
    await expect(page.locator(LIVE_COACH_SELECTOR)).toBeVisible();
    await expect(page.locator("[data-tutorial-target='true']")).toHaveCount(1);
  });

  test("390x844 first screen contains target, full board, and primary actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFirstLevel(page);
    const targetBox = await page.locator("[data-level-target]").boundingBox();
    const boardBox = await page.locator(BOARD_SELECTOR).boundingBox();
    const actionsBox = await page.locator("[data-primary-actions]").boundingBox();
    if (!targetBox || !boardBox || !actionsBox) throw new Error("Required first-screen region is missing");

    expect(targetBox.y).toBeGreaterThanOrEqual(0);
    expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(844);
    expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(844);
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(overflow.scrollWidth).toBe(overflow.clientWidth);
  });

  test("reel vertical gestures stay local while a gesture outside the reel scrolls the stage", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 560 });
    await openFirstLevel(page);
    const stage = page.locator(".game-stage");
    const dimensions = await stage.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }));
    expect(["auto", "scroll"]).toContain(dimensions.overflowY);
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
    expect(await reelWindow(page, 0).evaluate((element) => getComputedStyle(element).touchAction))
      .toBe("pan-x");

    await touchPreview(page, context, 0, 55);
    expect(await stage.evaluate((element) => element.scrollTop)).toBe(dimensions.scrollTop);

    await scrollStageOutsideReel(page, context);
    await expect.poll(
      () => stage.evaluate((element) => element.scrollTop)
    ).toBeGreaterThan(dimensions.scrollTop);
  });

  test("reduced motion never waits for feedback animation to unlock", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFirstLevel(page);
    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await page.getByRole("button", { name: "第 1 列向上移动" }).click();

    await expectMoveCount(page, 2);
    await expect(page.getByRole("button", { name: "第 1 列向上移动" })).toBeEnabled();
  });
});

test.describe("@gate-a equation slider input adapters", () => {
  test("mouse drag down selects the previous tile and commits exactly one move", async ({ page }) => {
    await openFirstLevel(page);
    await beginMousePreview(page, 1, 55);
    await page.mouse.up();

    await expectMoveCount(page, 1);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
  });

  test("touch swipe down selects the previous tile and commits exactly one move", async ({ page, context }) => {
    await openFirstLevel(page);
    await touchPreview(page, context, 1, 55);

    await expectMoveCount(page, 1);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
  });

  test("clicking the previous neighboring tile commits exactly one move", async ({ page }) => {
    await openFirstLevel(page);
    await page.locator("[data-reel-id]").nth(1).locator("[data-position='previous']").click();

    await expectMoveCount(page, 1);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
  });

  test("visible up control commits exactly one move", async ({ page }) => {
    await openFirstLevel(page);
    await page.getByRole("button", { name: "第 2 列向上移动" }).click();

    await expectMoveCount(page, 1);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
  });

  test("keyboard ArrowUp commits exactly one move", async ({ page }) => {
    await openFirstLevel(page);
    await reelWindow(page, 1).focus();
    await page.keyboard.press("ArrowUp");

    await expectMoveCount(page, 1);
    await expect(page.locator(EXPRESSION_SELECTOR)).toHaveText("4 + 2 = 6");
  });
});

test.describe("@gate-c equation slider extended topologies", () => {
  test("level es-2-41 renders exactly three movable reels and nine unique formal tiles", async ({ page }) => {
    await openLevel(page, "chapter-2", "es-2-41");

    await expect(page.locator("[data-equation-board][data-level-id='es-2-41']")).toBeVisible();
    await expect(page.locator("[data-reel-id]")).toHaveCount(3);
    await expect(page.locator(FORMAL_TILE_SELECTOR)).toHaveCount(9);
    expect(new Set(await formalTileIds(page)).size).toBe(9);
  });

  test("level es-4-50 renders exactly five movable reels and fifteen unique formal tiles", async ({ page }) => {
    await openLevel(page, "chapter-4", "es-4-50");

    await expect(page.locator("[data-equation-board][data-level-id='es-4-50']")).toBeVisible();
    await expect(page.locator("[data-reel-id]")).toHaveCount(5);
    await expect(page.locator(FORMAL_TILE_SELECTOR)).toHaveCount(15);
    expect(new Set(await formalTileIds(page)).size).toBe(15);
  });
});

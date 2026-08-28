import { expect, test, type Locator, type Page } from "@playwright/test";

const BOARD = "[data-equation-board]";
const REEL = "[data-reel-id]";
const REEL_WINDOW = "[data-reel-window]";
const TILE = "[data-tile-id]";
const COVERAGE = "[data-coverage-progress]";
const MOVES = "[data-move-count]";
const PROGRESS_V3_KEY = "family-games/equation-slider/progress-v3";
const LEGACY_PROGRESS_KEY = "family-games/equation-slider/progress";

async function enterSlider(page: Page, clearStorage = true): Promise<void> {
  await page.goto("/?world=math-world&station=slider");
  if (clearStorage) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await expect(page.locator(`${BOARD}[data-level-id='es-1-01']`)).toBeVisible();
  const skipTutorial = page.getByRole("button", { name: "跳过教程" });
  if (await skipTutorial.isVisible()) await skipTutorial.click();
}

async function openRoute(page: Page, chapter: number): Promise<void> {
  const routeMapButton = page.getByRole("button", { name: "线路地图" });
  if (await routeMapButton.isVisible()) await routeMapButton.click();
  const chapterButton = page.locator(`[data-chapter-id='chapter-${chapter}']`);
  await expect(chapterButton).toBeVisible();
  await chapterButton.click();
  await expect(page.locator(`[data-station-id^='chapter-${chapter}-']`).first()).toBeVisible();
}

async function openLevelFromCurrentChapter(page: Page, levelId: string): Promise<void> {
  const levelButton = page.locator(`button[data-level-id='${levelId}']`);
  await expect(levelButton).toBeVisible();
  await levelButton.click();
  await expect(page.locator(`${BOARD}[data-level-id='${levelId}']`)).toBeVisible();
}

async function returnToCurrentChapter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "关卡列表" }).click();
  await expect(page.locator("[data-station-id]").first()).toBeVisible();
}

async function expectStableBoardContract(page: Page, levelId: string): Promise<{
  readonly reelCount: number;
  readonly tileIds: readonly string[];
}> {
  const board = page.locator(`${BOARD}[data-level-id='${levelId}']`);
  const reelCount = await board.locator(REEL).count();
  expect(reelCount).toBeGreaterThanOrEqual(2);
  expect(reelCount).toBeLessThanOrEqual(5);
  await expect(page.locator("[data-level-target]")).toBeVisible();
  await expect(board.locator(TILE)).toHaveCount(reelCount * 3);
  await expect(board.locator("[data-control-direction]")).toHaveCount(reelCount * 2);
  const tileIds = await board.locator(TILE).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-tile-id") ?? "")
  );
  expect(tileIds.every(Boolean)).toBe(true);
  expect(new Set(tileIds).size).toBe(tileIds.length);
  return { reelCount, tileIds };
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await target.evaluate((node) => document.activeElement === node)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Target was not reachable through the document Tab order");
}

async function activateWithKeyboard(page: Page, target: Locator): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.press("Enter");
}

async function finishFirstLevelWithKeyboard(page: Page, tabOnly = false): Promise<void> {
  const windows = page.locator(REEL_WINDOW);
  for (const reelIndex of [1, 0, 1, 0, 1]) {
    if (tabOnly) await tabTo(page, windows.nth(reelIndex));
    else await windows.nth(reelIndex).focus();
    await page.keyboard.press("ArrowUp");
  }
  await expect(page.locator(COVERAGE)).toHaveText("6/6");
  await expect(page.locator("[data-completion-card]")).toBeVisible();
}

async function completeCurrentLevelFromVisibleHints(page: Page): Promise<void> {
  for (let guard = 0; guard < 80 && !(await page.locator("[data-completion-card]").isVisible()); guard += 1) {
    for (let depth = 0; depth < 3; depth += 1) {
      await page.getByRole("button", { name: "提示", exact: true }).click();
    }
    const hint = (await page.locator(".equation-slider__hint").textContent())?.trim() ?? "";
    const direction = hint.match(/第\s*(\d+)\s*条滑轨向(上|下)移动一格/);
    if (!direction) {
      await page.getByRole("button", { name: "第 1 列向上移动" }).click();
      continue;
    }
    await page.getByRole("button", {
      name: `第 ${Number(direction[1])} 列向${direction[2]}移动`
    }).click();
  }
  await expect(page.locator("[data-completion-card]")).toBeVisible();
}

function completedRecord(): Record<string, unknown> {
  return {
    startedCount: 1,
    completed: true,
    independent: true,
    hintCount: 0,
    badges: ["independent"],
    bestMoves: 1
  };
}

function currentBoard(page: Page): Locator {
  return page.locator(BOARD);
}

test.describe("@release equation slider browser-only release gaps", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("all 40 hand-authored gold levels expose a stable, operable browser contract", async ({ page }) => {
    test.setTimeout(180_000);
    await enterSlider(page);
    await page.getByRole("button", { name: "关卡列表" }).click();

    for (let chapter = 1; chapter <= 4; chapter += 1) {
      await openRoute(page, chapter);
      for (let order = 1; order <= 10; order += 1) {
        const levelId = `es-${chapter}-${String(order).padStart(2, "0")}`;
        await openLevelFromCurrentChapter(page, levelId);
        const beforeFeedback = await page.locator(".equation-slider__feedback").textContent();
        const { reelCount, tileIds } = await expectStableBoardContract(page, levelId);

        await page.getByRole("button", { name: "第 1 列向上移动" }).click();
        await expect(page.locator(MOVES)).toHaveText("1");
        await expect(page.locator(".equation-slider__feedback")).not.toHaveText(beforeFeedback ?? "");
        await expect(currentBoard(page).locator(TILE)).toHaveCount(reelCount * 3);
        expect(
          await currentBoard(page).locator(TILE).evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-tile-id") ?? "")
          )
        ).toEqual(tileIds);

        await page.getByRole("button", { name: "撤销" }).click();
        await expect(page.locator(MOVES)).toHaveText("0");
        await expect(currentBoard(page).locator(TILE)).toHaveCount(reelCount * 3);
        await returnToCurrentChapter(page);
      }
    }
  });

  test("repeating an already-correct expression never grows coverage twice", async ({ page }) => {
    await enterSlider(page);
    const rightUp = page.getByRole("button", { name: "第 2 列向上移动" });
    const rightDown = page.getByRole("button", { name: "第 2 列向下移动" });

    await rightUp.click();
    await expect(page.locator(COVERAGE)).toHaveText("2/6");
    await rightDown.click();
    await rightUp.click();

    await expect(page.locator(COVERAGE)).toHaveText("2/6");
    await expect(page.locator(".equation-slider__feedback")).toContainText("已经亮了");
  });

  test("wrong-move feedback describes the committed expression rather than the prior state", async ({ page }) => {
    await enterSlider(page);

    await page.getByRole("button", { name: "第 1 列向上移动" }).click();

    await expect(page.locator(".equation-slider__current-expression")).toHaveText("2 + 5 = 7");
    await expect(page.locator(".equation-slider__feedback")).toHaveText("比目标 6 大 1。");
  });

  test("Tab, Enter, and arrow keys complete, replay, advance, and return without pointer input", async ({ page }) => {
    await page.goto("/?world=math-world&station=slider");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator(`${BOARD}[data-level-id='es-1-01']`)).toBeVisible();
    await activateWithKeyboard(page, page.getByRole("button", { name: "跳过教程" }));
    await finishFirstLevelWithKeyboard(page, true);
    await expect(page.locator(MOVES)).toHaveText("5");

    await activateWithKeyboard(page, page.getByRole("button", { name: "再玩一次" }));
    await expect(page.locator(`${BOARD}[data-level-id='es-1-01']`)).toBeVisible();
    await expect(page.locator(COVERAGE)).toHaveText("0/6");
    await expect(page.locator(MOVES)).toHaveText("0");
    await expect(page.locator("[data-completion-card]")).toBeHidden();

    await finishFirstLevelWithKeyboard(page, true);
    await activateWithKeyboard(page, page.getByRole("button", { name: "下一关" }));
    await expect(page.locator(`${BOARD}[data-level-id='es-1-02']`)).toBeVisible();
    await expect(page.locator(COVERAGE)).toHaveText(/^0\/\d+$/);
    await expect(page.locator(MOVES)).toHaveText("0");
    await activateWithKeyboard(page, page.getByRole("button", { name: "← 回城市地图" }));
    await expect(page.getByTestId("math-world-map")).toBeVisible();
  });

  test("chapter loading, chapter map, route map, and return to hub remain connected", async ({ page }) => {
    await enterSlider(page);
    await page.getByRole("button", { name: "关卡列表" }).click();
    await openRoute(page, 4);
    await openLevelFromCurrentChapter(page, "es-4-50");
    await expectStableBoardContract(page, "es-4-50");
    await returnToCurrentChapter(page);
    await page.getByRole("button", { name: "线路地图" }).click();
    await expect(page.locator("[data-chapter-id]")).toHaveCount(4);

    await page.locator(".equation-slider").getByRole("button", { name: "回数学世界地图" }).click();
    await expect(page.getByTestId("math-world-map")).toBeVisible();
    await expect(page.locator('[data-station-id="slider"] button')).toBeFocused();
  });

  test("completion UI exposes rest, station, and chapter checkpoints", async ({ page }) => {
    test.setTimeout(180_000);
    const startWithCompleted = async (levelIds: readonly string[]): Promise<void> => {
      await page.goto("/?world=math-world");
      await page.evaluate(
        ({ key, ids, record }) => {
          localStorage.clear();
          localStorage.setItem(key, JSON.stringify({
            saveVersion: 2,
            tutorialCompleted: true,
            upgradeNoticeSeen: true,
            soundEnabled: false,
            levels: Object.fromEntries(ids.map((id) => [id, record])),
            seenCheckpoints: []
          }));
        },
        { key: PROGRESS_V3_KEY, ids: levelIds, record: completedRecord() }
      );
      await page.goto("/?world=math-world&station=slider");
      await expect(page.locator(BOARD)).toBeVisible();
    };

    await startWithCompleted([]);
    await page.getByRole("button", { name: "关卡列表" }).click();
    await openLevelFromCurrentChapter(page, "es-1-05");
    await completeCurrentLevelFromVisibleHints(page);
    await expect(page.locator("[data-completion-card]")).toHaveAttribute("data-checkpoint-kind", "rest");
    await expect(page.locator("[data-completion-card]")).toContainText("小发现");

    await startWithCompleted(Array.from({ length: 9 }, (_, index) => `es-1-${String(index + 1).padStart(2, "0")}`));
    await page.getByRole("button", { name: "关卡列表" }).click();
    await openLevelFromCurrentChapter(page, "es-1-10");
    await completeCurrentLevelFromVisibleHints(page);
    await expect(page.locator("[data-completion-card]")).toHaveAttribute("data-checkpoint-kind", "station-review");
    await expect(page.locator("[data-completion-card]")).toContainText("站区回顾");

    await startWithCompleted(Array.from({ length: 49 }, (_, index) => `es-1-${String(index + 1).padStart(2, "0")}`));
    await page.getByRole("button", { name: "关卡列表" }).click();
    await openLevelFromCurrentChapter(page, "es-1-50");
    await completeCurrentLevelFromVisibleHints(page);
    await expect(page.locator("[data-completion-card]")).toHaveAttribute("data-checkpoint-kind", "chapter-review");
    await expect(page.locator("[data-completion-card]")).toContainText("线路回顾");
    const finalProgress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PROGRESS_V3_KEY);
    expect(finalProgress.seenCheckpoints).toEqual(expect.arrayContaining([
      "chapter-1-review",
      "chapter-1-station-5-review"
    ]));
  });

  for (const legacyCase of [
    {
      name: "v0",
      value: {
        completedLevels: ["es-1-01", "es-2-03"],
        lastLevelId: "es-2-03",
        muted: true
      },
      expectedSound: false,
      sourceSaveVersion: 0
    },
    {
      name: "v1",
      value: {
        saveVersion: 1,
        levels: {
          "es-1-01": { completed: true },
          "es-3-07": { completed: true }
        },
        lastLevelId: "es-3-07",
        soundEnabled: true
      },
      expectedSound: true,
      sourceSaveVersion: 1
    }
  ] as const) {
    test(`legacy ${legacyCase.name} storage keeps sound only in active V3 progress and shows the upgrade notice`, async ({ page }) => {
      await page.addInitScript(
        ({ key, value }) => {
          localStorage.clear();
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: LEGACY_PROGRESS_KEY, value: legacyCase.value }
      );
      await page.goto("/?world=math-world&station=slider");
      await expect(page.locator(".equation-slider__upgrade-notice")).toContainText("滑轨游戏已升级");
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PROGRESS_V3_KEY);
      expect(saved.saveVersion).toBe(2);
      expect(saved.soundEnabled).toBe(legacyCase.expectedSound);
      expect(Object.keys(saved.levels)).toEqual(["es-1-01"]);
      expect(saved.levels["es-1-01"]).toMatchObject({
        startedCount: 1,
        completed: false,
        independent: false,
        hintCount: 0,
        badges: []
      });
      expect(saved.lastLevelId).toBe("es-1-01");
      expect(Object.values(saved.levels).some((record: any) => record.completed === true)).toBe(false);
      expect(saved.tutorialCompleted).toBe(false);
      expect(saved.legacy.sourceSaveVersion).toBe(legacyCase.sourceSaveVersion);

      await page.getByRole("button", { name: "知道了" }).click();
      await expect(page.locator(".equation-slider__upgrade-notice")).toHaveCount(0);
    });
  }

  test("sound choice persists across return-to-hub and re-entry", async ({ page }) => {
    await enterSlider(page);
    const sound = page.locator(".equation-slider").getByRole("button", { name: "关闭声音" });
    await expect(sound).toBeVisible();
    await sound.click();
    await expect(page.locator(".equation-slider").getByRole("button", { name: "开启声音" })).toBeVisible();

    await page.getByRole("button", { name: "← 回城市地图" }).click();
    await page.locator('[data-station-id="slider"] button').click();
    await expect(page.locator(".equation-slider").getByRole("button", { name: "开启声音" })).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PROGRESS_V3_KEY);
    expect(saved.soundEnabled).toBe(false);
  });

  test("sound toggle controls real synthesized move cues", async ({ page }) => {
    await page.addInitScript(() => {
      const state = { starts: 0 };
      (window as unknown as { __equationAudioProbe: typeof state }).__equationAudioProbe = state;
      class FakeAudioParam {
        setValueAtTime(): void {}
        exponentialRampToValueAtTime(): void {}
      }
      class FakeNode {
        connect(): FakeNode { return this; }
      }
      class FakeOscillator extends FakeNode {
        type = "sine";
        frequency = new FakeAudioParam();
        start(): void { state.starts += 1; }
        stop(): void {}
      }
      class FakeGain extends FakeNode {
        gain = new FakeAudioParam();
      }
      class FakeAudioContext {
        state = "running";
        currentTime = 0;
        destination = new FakeNode();
        createOscillator(): FakeOscillator { return new FakeOscillator(); }
        createGain(): FakeGain { return new FakeGain(); }
        resume(): Promise<void> { this.state = "running"; return Promise.resolve(); }
        close(): Promise<void> { this.state = "closed"; return Promise.resolve(); }
      }
      Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    });
    await enterSlider(page);

    await page.getByRole("button", { name: "第 1 列向上移动" }).click();
    await expect.poll(() => page.evaluate(
      () => (window as unknown as { __equationAudioProbe: { starts: number } }).__equationAudioProbe.starts
    )).toBe(1);

    await page.getByRole("button", { name: "关闭声音" }).click();
    await page.getByRole("button", { name: "第 1 列向下移动" }).click();
    await expect.poll(() => page.evaluate(
      () => (window as unknown as { __equationAudioProbe: { starts: number } }).__equationAudioProbe.starts
    )).toBe(1);

    await page.getByRole("button", { name: "开启声音" }).click();
    await expect.poll(() => page.evaluate(
      () => (window as unknown as { __equationAudioProbe: { starts: number } }).__equationAudioProbe.starts
    )).toBe(2);
    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await expect.poll(() => page.evaluate(
      () => (window as unknown as { __equationAudioProbe: { starts: number } }).__equationAudioProbe.starts
    )).toBeGreaterThan(2);
  });

  test("navigation remains safe during feedback lock, active drag, rapid switching, and destroy", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await enterSlider(page);

    await page.getByRole("button", { name: "第 2 列向上移动" }).click();
    await page.getByRole("button", { name: "关卡列表" }).click();
    await expect(page.locator("[data-station-id]").first()).toBeVisible();
    await openLevelFromCurrentChapter(page, "es-1-02");

    const reelBox = await page.locator(REEL_WINDOW).first().boundingBox();
    if (!reelBox) throw new Error("The release drag target has no bounding box");
    await page.mouse.move(reelBox.x + reelBox.width / 2, reelBox.y + reelBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(reelBox.x + reelBox.width / 2, reelBox.y + reelBox.height / 2 + 55);
    await page.getByRole("button", { name: "← 回城市地图" }).focus();
    await page.keyboard.press("Enter");
    await page.mouse.up();
    await expect(page.getByTestId("math-world-map")).toBeVisible();

    for (let iteration = 0; iteration < 4; iteration += 1) {
      await page.locator('[data-station-id="slider"] button').click();
      await expect(page.locator(BOARD)).toBeVisible();
      await page.getByRole("button", { name: "← 回城市地图" }).click();
      await expect(page.getByTestId("math-world-map")).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
  });

  test("an active drag serializes all other board input until pointer release", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await enterSlider(page);
    const firstWindow = page.locator(REEL_WINDOW).first();
    const box = await firstWindow.boundingBox();
    if (!box) throw new Error("The concurrency drag target has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 42, { steps: 4 });
    await expect(page.locator(".equation-slider__reel.is-dragging")).toHaveCount(1);
    await expect(currentBoard(page)).toHaveAttribute("data-board-status", "dragging");
    await expect(page.getByRole("button", { name: "第 2 列向上移动" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "撤销" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "重置" })).toBeDisabled();
    await page.getByRole("button", { name: "第 2 列向上移动" }).evaluate(
      (button: HTMLButtonElement) => button.click()
    );
    await expect(page.locator(MOVES)).toHaveText("0");

    await page.mouse.up();
    await expect(page.locator(MOVES)).toHaveText("1");
    await expect(currentBoard(page)).toHaveAttribute("data-board-status", "ready");
  });

  test("120 alternating operations across three reels preserve nodes, controls, IDs, and geometry", async ({ page }) => {
    test.setTimeout(90_000);
    await enterSlider(page);
    await page.getByRole("button", { name: "关卡列表" }).click();
    await openRoute(page, 2);
    await openLevelFromCurrentChapter(page, "es-2-41");
    const board = currentBoard(page);
    const beforeIds = await board.locator(TILE).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-tile-id") ?? "")
    );
    const beforeBox = await board.boundingBox();
    if (!beforeBox) throw new Error("The release stability board has no bounding box");

    for (let move = 0; move < 120; move += 1) {
      const reelNumber = (move % 3) + 1;
      const direction = move % 2 === 0 ? "向上移动" : "向下移动";
      await page.getByRole("button", { name: `第 ${reelNumber} 列${direction}` }).click();
    }

    await expect(page.locator(MOVES)).toHaveText("120");
    await expect(board.locator(REEL)).toHaveCount(3);
    await expect(board.locator(TILE)).toHaveCount(9);
    await expect(board.locator("[data-control-direction]")).toHaveCount(6);
    expect(
      await board.locator(TILE).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-tile-id") ?? "")
      )
    ).toEqual(beforeIds);
    const afterBox = await board.boundingBox();
    if (!afterBox) throw new Error("The release stability board disappeared");
    expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThanOrEqual(2);
  });
});

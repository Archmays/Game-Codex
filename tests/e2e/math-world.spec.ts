import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:5292";

interface RuntimeLog {
  errors: string[];
  failed: string[];
  external: string[];
}

function observe(page: Page): RuntimeLog {
  const log: RuntimeLog = { errors: [], failed: [], external: [] };
  page.on("pageerror", (error) => log.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") log.errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) log.failed.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") log.failed.push(`${request.failure()?.errorText} ${request.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== ORIGIN) log.external.push(request.url());
  });
  return log;
}

async function expectClean(log: RuntimeLog): Promise<void> {
  expect(log.errors).toEqual([]);
  expect(log.failed).toEqual([]);
  expect(log.external).toEqual([]);
}

async function expectNoOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
}

async function openStation(page: Page, station: string): Promise<void> {
  await page.goto(`/?world=math-world&station=${station}`);
  await expect(page.locator(`[data-station-id="${station}"]`)).toBeVisible();
}

async function solveFirstTargetTen(page: Page): Promise<void> {
  const combine = page.getByRole("button", { name: "合并", exact: true });
  for (const [left, right] of [
    ["target-10-01-source-1", "target-10-01-source-2"],
    ["target-10-01-source-3", "target-10-01-source-4"],
    ["target-10-01-combined-1", "target-10-01-combined-2"],
  ] as const) {
    await page.locator(`[data-card-id="${left}"]`).click();
    await page.locator(`[data-card-id="${right}"]`).click();
    await combine.click();
  }
  await expect(page.getByText("成功凑出 10。可以看看完整算式，或换一组继续。")).toBeVisible();
}

test("@e2e top world exposes only the three real destinations and Math World has two free stations", async ({ page }) => {
  const log = observe(page);
  await page.goto("/?world=my-game-world");
  await expect(page.getByTestId("world-forest-portal")).toBeVisible();
  await expect(page.getByTestId("world-math-portal")).toBeVisible();
  await expect(page.getByTestId("world-treasure-box")).toBeVisible();
  await expect(page.locator("[data-testid=world-spellbook-object], [data-testid=world-repair-signals]")).toHaveCount(0);
  await page.getByTestId("world-math-portal").getByRole("link").focus();
  await expect(page.getByTestId("world-math-portal").getByRole("link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await expect(page.locator(".math-world-card")).toHaveCount(2);
  await expect(page.locator(".math-world-card button:disabled")).toHaveCount(0);
  await expectNoOverflow(page);
  await expectClean(log);
});

test("@e2e Slider and Target share navigation without sharing progress", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const log = observe(page);

  await page.goto("/?world=math-world");
  await page.locator('[data-station-id="target"] button').click();
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  const hint = page.getByRole("button", { name: "给我一点提示" });
  await hint.click();
  await expect(hint).toBeFocused();
  await expect(page.getByTestId("target-hint").locator("li")).toHaveCount(1);
  await page.locator('[data-card-id="target-10-01-source-1"]').click();
  await page.locator('[data-card-id="target-10-01-source-2"]').click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "合并" }).click();
  await expect(page.locator('[data-card-id="target-10-01-combined-1"]')).toBeFocused();
  await page.locator('[data-card-id="target-10-01-combined-1"]').click();
  await page.locator('[data-card-id="target-10-01-source-3"]').click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "合并" }).click();
  await page.locator('[data-card-id="target-10-01-combined-2"]').click();
  await page.locator('[data-card-id="target-10-01-source-4"]').click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "合并" }).click();
  await expect(page.locator(".learning-feedback")).toContainText("成功凑出 10");
  await page.getByRole("button", { name: "← 回城市地图" }).click();

  await page.locator('[data-station-id="slider"] button').click();
  await expect(page.locator(".equation-slider")).toBeVisible({ timeout: 30_000 });
  const tutorialSkip = page.getByRole("button", { name: "跳过教程" });
  if (await tutorialSkip.isVisible()) await tutorialSkip.click();
  const move = page.getByRole("button", { name: "第 2 列选上方格" });
  await expect(move).toBeVisible();
  await move.click();
  await expect(page.locator("[data-coverage-progress]")).toContainText("/");
  await page.getByRole("button", { name: "← 回城市地图" }).click();

  const shellSave = await page.evaluate(() => JSON.parse(localStorage.getItem("family-games/math-world/v1") ?? "null"));
  expect(shellSave).toEqual(expect.objectContaining({ version: 1, lastStation: "slider", visitedStations: ["target", "slider"] }));
  expect(Object.keys(shellSave).sort()).toEqual(["lastStation", "version", "visitedStations"]);
  await expectNoOverflow(page);
  await expectClean(log);
});

test("@e2e legacy module bytes remain exact when the replacement stations mount and return", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const legacy = {
    "family-games/clock-reader/progress": '{"best":8,"streak":4}',
    "family-games/multiplication-adventure/progress": '{"bestScore":9,"plays":12}',
    "family-games/make-target/progress": '{"wins":5}',
    "math-battle-web/save-v1": '{"currentStreak":3,"lastPlayDate":"2026-08-20"}',
  };
  await page.addInitScript((values) => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, legacy);
  for (const station of ["clock", "array", "lab"] as const) {
    await page.goto(`/?world=math-world&station=${station}`);
    await expect(page.getByTestId("math-world-map")).toBeVisible();
    await expect(page.getByText("这个小游戏已收起，可以选择下面的游戏。")).toBeVisible();
    await expect(page.locator("#game-root, .clock-game, .array-workshop")).toHaveCount(0);
  }
  await openStation(page, "target");
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(legacy))).toEqual(legacy);
});

test("@e2e Make Target migrates legacy progress on a completed puzzle and never overwrites a future save", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const key = "family-games/make-target/progress";
  await page.goto("/");
  await page.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, '{"wins":5}']);
  await openStation(page, "target");
  await solveFirstTargetTen(page);
  const migrated = '{"version":1,"wins":6,"completedPuzzleIds":["target-10-01"]}';
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(migrated);
  await page.reload();
  await expect(page.locator(".make-target-game")).toBeVisible();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(migrated);

  const future = '{"version":99,"wins":88,"completedPuzzleIds":["future"]}';
  await page.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, future]);
  await openStation(page, "target");
  await solveFirstTargetTen(page);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(future);
});

test("@e2e twenty station lifecycle cycles leave one shell, no canvas, and no stale activity", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const log = observe(page);
  await page.goto("/?world=math-world");
  const sequence = ["slider", "target"] as const;
  for (let index = 0; index < 20; index += 1) {
    const station = sequence[index % sequence.length];
    await page.locator(`[data-station-id="${station}"] button`).click();
    await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", station);
    await page.getByRole("button", { name: "← 回城市地图" }).click();
    await expect(page.getByTestId("math-world-map")).toHaveCount(1);
    await expect(page.locator("#game-root, .clock-game, .array-workshop, .make-target-game, .equation-slider, canvas")).toHaveCount(0);
  }
  await expectClean(log);
});

test("@e2e direct station refresh, motion setting, keyboard order, and final classic catalog stay coherent", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  for (const station of ["slider", "target"] as const) {
    await openStation(page, station);
    await page.reload();
    await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", station);
  }
  await page.goto("/?world=math-world");
  await page.getByRole("button", { name: "动态效果：跟随设备" }).click();
  await expect(page.getByTestId("math-world-map").locator("xpath=..")).toHaveAttribute("data-reduced-motion", "true");
  const keyboardStation = page.locator('[data-station-id="slider"] button');
  await keyboardStation.focus();
  await expect(keyboardStation).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", "slider");
  await page.goto("/?hub=classic");
  await expect(page.locator(".game-card")).toHaveCount(3);
  await expect(page.locator('[data-game-id="clock-reader"], [data-game-id="multiplication-adventure"], [data-game-id="pinyin-magic-battle"], [data-game-id="make-target"], [data-game-id="memory-card"]')).toHaveCount(0);
  await expect(page.locator('[data-game-id="math-lab"]')).toHaveCount(1);
  await expect(page.locator('[data-game-id="equation-slider"]')).toHaveCount(0);
  await expectNoOverflow(page);
});

test("@e2e Slider canonical route, history focus, world return, and saved-level re-entry stay coherent", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const log = observe(page);
  await page.goto("/?world=math-world");
  const sliderStation = page.locator('[data-station-id="slider"] button');
  await sliderStation.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?world=math-world&station=slider$/);
  await expect(page.locator("[data-station-heading]")).toBeFocused();

  const tutorialSkip = page.getByRole("button", { name: "跳过教程" });
  if (await tutorialSkip.isVisible()) await tutorialSkip.click();
  await page.getByRole("button", { name: "关卡列表" }).click();
  await page.locator('[data-level-id="es-1-11"]').click();
  const board = page.getByRole("region", { name: "算式滑轨棋盘" });
  await expect(board).toHaveAttribute("data-level-id", "es-1-11");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("family-games/equation-slider/progress-v3") ?? "null")?.lastLevelId)).toBe("es-1-11");

  await page.reload();
  await expect(board).toHaveAttribute("data-level-id", "es-1-11");
  await page.goBack();
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await expect(page.locator('[data-station-id="slider"] button')).toBeFocused();
  await expect(page.locator('[data-station-id="slider"] button')).toHaveText("继续这里");
  await page.goForward();
  await expect(page.locator('[data-station-id="slider"] .equation-slider')).toBeVisible();
  await expect(page.locator("[data-station-heading]")).toBeFocused();

  await page.getByRole("button", { name: "关卡列表" }).click();
  await page.getByRole("button", { name: "线路地图" }).click();
  await page.getByRole("button", { name: "回数学世界地图" }).click();
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await expect(page.locator('[data-station-id="slider"] button')).toBeFocused();
  await expectClean(log);
});

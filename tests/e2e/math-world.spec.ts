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

test("@e2e top world exposes only the three real destinations and Math World has five free stations", async ({ page }) => {
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
  await expect(page.locator(".math-world-card")).toHaveCount(5);
  await expect(page.locator(".math-world-card button:disabled")).toHaveCount(0);
  await expectNoOverflow(page);
  await expectClean(log);
});

test("@e2e Clock, Array, Target, Lab, and Slider share navigation without sharing progress", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const log = observe(page);
  await page.addInitScript(() => localStorage.clear());

  await openStation(page, "clock");
  await expect(page.locator(".clock-face")).toHaveAttribute("role", "slider");
  const beforeClock = await page.locator(".clock-face").getAttribute("aria-valuenow");
  await page.getByRole("button", { name: "分针 +5" }).click();
  await expect(page.locator(".clock-face")).not.toHaveAttribute("aria-valuenow", beforeClock!);
  await page.getByRole("button", { name: "精确时间" }).click();
  await expect(page.getByRole("button", { name: "我拨好了" })).toBeVisible();
  await page.getByRole("button", { name: "← 回城市地图" }).click();

  await page.locator('[data-station-id="array"] button').click();
  await expect(page.locator(".array-workshop")).toBeVisible();
  await page.getByRole("button", { name: "翻转阵列", exact: true }).first().click();
  const grid = page.locator(".array-workshop__grid");
  const before = await grid.evaluate((element) => ({ rows: element.getAttribute("data-rows"), columns: element.getAttribute("data-columns"), product: element.getAttribute("data-product") }));
  await page.getByRole("button", { name: "翻转阵列", exact: true }).last().click();
  await expect(grid).toHaveAttribute("data-rows", before.columns!);
  await expect(grid).toHaveAttribute("data-columns", before.rows!);
  await expect(grid).toHaveAttribute("data-product", before.product!);
  await page.getByRole("button", { name: "← 回城市地图" }).click();

  await page.locator('[data-station-id="target"] button').click();
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  await page.getByRole("button", { name: "给我一点提示" }).click();
  await expect(page.getByTestId("target-hint").locator("li")).toHaveCount(1);
  await page.locator('[data-card-id="target-10-01-source-1"]').click();
  await page.locator('[data-card-id="target-10-01-source-2"]').click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "合并" }).click();
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

  await page.locator('[data-station-id="lab"] button').click();
  await expect(page.locator("#game-root canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  await expect(page.locator("#game-root, canvas")).toHaveCount(0);

  await page.locator('[data-station-id="slider"] button').click();
  await expect(page.locator(".equation-slider")).toBeVisible({ timeout: 30_000 });
  const tutorialSkip = page.getByRole("button", { name: "跳过教程" });
  if (await tutorialSkip.isVisible()) await tutorialSkip.click();
  const move = page.getByRole("button", { name: "第 2 列向上移动" });
  await expect(move).toBeVisible();
  await move.click();
  await expect(page.locator("[data-coverage-progress]")).toContainText("/");
  await page.getByRole("button", { name: "← 回城市地图" }).click();

  const shellSave = await page.evaluate(() => JSON.parse(localStorage.getItem("family-games/math-world/v1") ?? "null"));
  expect(shellSave).toEqual(expect.objectContaining({ version: 1, lastStation: "slider", visitedStations: ["lab", "clock", "array", "target", "slider"] }));
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
  for (const station of ["clock", "array", "target", "lab"] as const) {
    await openStation(page, station);
    await page.getByRole("button", { name: "← 回城市地图" }).click();
  }
  expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(legacy))).toEqual(legacy);
});

test("@e2e Math Lab reset requires confirmation and both Escape and Cancel return safely", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await openStation(page, "lab");
  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Math Lab canvas has no box");
  await canvas.click({ position: { x: box.width * 0.61, y: 116 } });
  const settings = await canvas.screenshot();
  await canvas.click({ position: { x: box.width * 0.62, y: 414 } });
  const confirmation = await canvas.screenshot();
  expect(confirmation.equals(settings)).toBe(false);
  await page.keyboard.press("Escape");
  expect((await canvas.screenshot()).equals(settings)).toBe(true);
  await canvas.click({ position: { x: box.width * 0.62, y: 414 } });
  await canvas.click({ position: { x: box.width * 0.57, y: 466 } });
  expect((await canvas.screenshot()).equals(settings)).toBe(true);
});

test("@e2e twenty station lifecycle cycles leave one shell, no canvas, and no stale activity", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const log = observe(page);
  await page.goto("/?world=math-world");
  const sequence = ["clock", "array", "target", "slider", "lab"] as const;
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
  for (const station of ["lab", "clock", "array", "target", "slider"] as const) {
    await openStation(page, station);
    await page.reload();
    await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", station);
  }
  await page.goto("/?world=math-world");
  await page.getByRole("button", { name: "动态效果：跟随设备" }).click();
  await expect(page.getByTestId("math-world-map").locator("xpath=..")).toHaveAttribute("data-reduced-motion", "true");
  const keyboardStation = page.locator('[data-station-id="clock"] button');
  await keyboardStation.focus();
  await expect(keyboardStation).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", "clock");
  await page.goto("/?hub=classic");
  await expect(page.locator(".game-card")).toHaveCount(7);
  await expect(page.locator('[data-game-id="clock-reader"], [data-game-id="multiplication-adventure"]')).toHaveCount(0);
  await expect(page.locator('[data-game-id="math-lab"], [data-game-id="equation-slider"], [data-game-id="make-target"]')).toHaveCount(3);
  await expectNoOverflow(page);
});

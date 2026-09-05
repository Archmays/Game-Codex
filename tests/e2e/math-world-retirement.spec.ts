import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const SHELL_KEY = "family-games/math-world/v1";
const NOTICE = "这个小游戏已收起，可以选择下面的游戏。";
const LEGACY = {
  "math-battle-web/save-v1": '{ "version":1, "currentStreak":3, "settings":{"largeText":true}, "extension":[1,2] }',
  "family-games/clock-reader/progress": '{"best":8,"streak":4,"extension":"synthetic"}',
  "family-games/multiplication-adventure/progress": '{"bestScore":9,"plays":12}',
  "family-games/hanzi-magic-complete/v3": '{"schemaVersion":99,"synthetic":"keep raw"}',
  "family-games/english-world/v2": '{"version":99,"synthetic":"keep raw"}',
  "synthetic/unrelated": 'unchanged bytes  \n',
};

async function seed(page: Page, shell?: string): Promise<void> {
  await page.goto("/?world=math-world");
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, { ...LEGACY, ...(shell === undefined ? {} : { [SHELL_KEY]: shell }) });
}

async function exactLegacy(page: Page): Promise<void> {
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(LEGACY))).toEqual(LEGACY);
}

async function activate(action: Locator, touch: boolean): Promise<void> {
  await action.scrollIntoViewIfNeeded();
  if (touch) await action.tap(); else await action.click();
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", error => problems.push(error.message));
  page.on("console", message => { if (message.type() === "error") problems.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => { if (request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`${request.failure()?.errorText} ${request.url()}`); });
  page.on("request", request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:5292") problems.push(`external ${request.url()}`);
    if (/\/(?:src\/game\/|games\/(?:clock-reader|multiplication-adventure)\/|assets\/generated\/|data\/(?:levels|roles|skins)\/)/.test(url.pathname)) problems.push(`retired request ${url.pathname}`);
  });
  // The assertion is registered per isolated context, including failed scenarios.
  (page as Page & { retirementProblems?: string[] }).retirementProblems = problems;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { retirementProblems?: string[] }).retirementProblems, "console, network and retired-runtime requests").toEqual([]);
});

for (const station of ["lab", "clock", "array"] as const) {
  test(`@retirement ${station} link, refresh and history return to the map without touching saves`, async ({ page }) => {
    const shell = `{"version":1,"lastStation":"${station}","visitedStations":["lab","clock","array"],"reducedMotionOverride":true,"extension":{"synthetic":7}}`;
    await seed(page, shell);
    // Start with a real history entry; navigation normalization must not add one.
    await page.goto(`/?world=math-world&station=${station}&from=hub`);
    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(page).toHaveURL(/\?world=math-world&from=hub&notice=retired-game$/);
    await expect(page.locator(".math-world-card")).toHaveCount(2);
    await expect(page.locator(".math-world-card").first()).toHaveAttribute("data-station-id", "slider");
    await expect(page.getByTestId("math-world-station")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "继续这里" })).toHaveCount(0);
    await expect(page.locator("#game-root, .clock-game, .array-workshop, canvas")).toHaveCount(0);
    await exactLegacy(page);
    expect(await page.evaluate(key => localStorage.getItem(key), SHELL_KEY)).toBe(shell);
    await page.reload();
    await expect(page.getByText(NOTICE)).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), SHELL_KEY)).toBe(shell);
    await page.goBack();
    await expect(page).toHaveURL(/\?world=math-world$/);
    await expect(page.getByText(NOTICE)).toHaveCount(0);
    await page.goForward();
    await expect(page.getByText(NOTICE)).toBeVisible();
    await exactLegacy(page);
    expect(await page.evaluate(key => localStorage.getItem(key), SHELL_KEY)).toBe(shell);
  });
}

test("@retirement real visits preserve old history and restore keyboard focus, with touch and scroll access", async ({ page }, testInfo) => {
  const shell = '{ "version":1,"lastStation":"array","visitedStations":["array","lab","clock"],"reducedMotionOverride":true,"extension":{"synthetic":7} }';
  await seed(page, shell);
  await page.reload();
  const touch = Boolean(testInfo.project.use.hasTouch);
  for (const station of ["slider", "target"] as const) {
    const action = page.locator(`[data-station-id="${station}"] button`);
    await action.scrollIntoViewIfNeeded();
    const geometry = await action.evaluate(element => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, hits: [0.2, 0.5, 0.8].map(ratio => element.contains(document.elementFromPoint(box.x + box.width * ratio, box.y + box.height / 2))) };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(42);
    expect(geometry.height).toBeGreaterThanOrEqual(42);
    expect(geometry.hits).toEqual([true, true, true]);
    if (station === "slider") { await action.focus(); await page.keyboard.press("Enter"); }
    else await activate(action, touch);
    await expect(page.locator("[data-station-heading]")).toBeFocused();
    if (station === "slider") {
      await expect(page.locator(".equation-slider")).toBeVisible();
      const skip = page.getByRole("button", { name: "跳过教程" });
      if (await skip.isVisible()) await activate(skip, touch);
      const move = page.getByRole("button", { name: "第 2 列向上移动" });
      const before = await page.locator("[data-coverage-progress]").innerText();
      await activate(move, touch);
      await expect(page.locator("[data-coverage-progress]")).not.toHaveText(before);
    } else {
      await expect(page.getByTestId("target-workshop")).toBeVisible();
      for (const [left, right] of [
        ["target-10-01-source-1", "target-10-01-source-2"],
        ["target-10-01-source-3", "target-10-01-source-4"],
        ["target-10-01-combined-1", "target-10-01-combined-2"],
      ]) {
        await activate(page.locator(`[data-card-id="${left}"]`), touch);
        await activate(page.locator(`[data-card-id="${right}"]`), touch);
        await activate(page.getByRole("button", { name: "合并", exact: true }), touch);
      }
      await expect(page.locator(".learning-feedback")).toContainText("成功凑出 10");
    }
    await activate(page.getByRole("button", { name: "← 回城市地图" }), touch);
    await expect(page.getByTestId("math-world-map")).toBeVisible();
    await expect(action).toBeFocused();
    await expect(action).toHaveText("继续这里");
    await exactLegacy(page);
  }
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SHELL_KEY)).toEqual({ version: 1, lastStation: "target", visitedStations: ["array", "lab", "clock", "slider", "target"], reducedMotionOverride: true, extension: { synthetic: 7 } });
  const motion = page.locator("[data-motion-setting]");
  for (const label of ["动态效果：开启", "动态效果：跟随设备", "动态效果：减少"]) {
    await activate(motion, touch);
    await expect(motion).toHaveText(label);
  }
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).extension, SHELL_KEY)).toEqual({ synthetic: 7 });
  await page.keyboard.press("End");
  await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY + innerHeight - document.documentElement.scrollHeight))).toBeLessThanOrEqual(2);
  await page.keyboard.press("Home");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

for (const [profile, shell] of [
  ["absent", undefined],
  ["corrupt", "{broken"],
  ["future", '{"version":99,"lastStation":"future","extension":{"keep":true}}'],
  ["unrecognized", '{"version":1,"lastStation":"unknown","visitedStations":[]}'],
] as const) {
  test(`@retirement ${profile} shell remains safe through fallback, settings and active play`, async ({ page }) => {
    await seed(page, shell);
    await page.goto("/?world=math-world&station=lab");
    await expect(page.getByText(NOTICE)).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), SHELL_KEY)).toBe(shell ?? null);
    await page.locator("[data-motion-setting]").click();
    for (const station of ["slider", "target"]) {
      await page.locator(`[data-station-id="${station}"] button`).click();
      await expect(page.locator(station === "slider" ? ".equation-slider" : ".make-target-game")).toBeVisible();
      await page.getByRole("button", { name: "← 回城市地图" }).click();
    }
    await exactLegacy(page);
    const after = await page.evaluate(key => localStorage.getItem(key), SHELL_KEY);
    if (shell !== undefined) expect(after).toBe(shell);
    else expect(JSON.parse(after!)).toEqual({ version: 1, lastStation: "target", visitedStations: ["slider", "target"], reducedMotionOverride: true });
  });
}

test("@retirement unwritable storage still allows navigation and primary operations", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Synthetic quota", "QuotaExceededError"); }; });
  await page.goto("/?world=math-world&station=clock");
  await expect(page.getByText(NOTICE)).toBeVisible();
  await page.locator("[data-motion-setting]").click();
  await page.locator('[data-station-id="target"] button').click();
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  await page.locator("[data-card-id]").first().click();
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  await expect(page.getByTestId("math-world-map")).toBeVisible();
});

test("@retirement denied storage reads keep the math shell usable", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Synthetic blocked", "SecurityError"); } }); });
  await page.goto("/?world=math-world&station=array");
  await expect(page.getByText(NOTICE)).toBeVisible();
  await page.locator('[data-station-id="slider"] button').click();
  await expect(page.locator(".equation-slider")).toBeVisible();
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  await expect(page.getByTestId("math-world-map")).toBeVisible();
});

test("@retirement invalid station and a cancelled lazy load never mount a stale game", async ({ page }) => {
  await page.goto("/?world=math-world&station=unknown");
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
  let release!: () => void;
  let requestStarted = false;
  const held = new Promise<void>(done => { release = done; });
  await page.route("**/games/equation-slider/index.ts*", async route => {
    requestStarted = true;
    await held;
    await route.continue();
  });
  await page.locator('[data-station-id="slider"] button').click();
  await expect.poll(() => requestStarted).toBe(true);
  await expect(page.getByText("正在打开算式滑轨站……")).toBeVisible();
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  await page.locator('[data-station-id="target"] button').click();
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  release();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("math-world-station")).toHaveAttribute("data-station-id", "target");
  await expect(page.locator(".equation-slider, canvas")).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SHELL_KEY)).toMatchObject({ lastStation: "target", visitedStations: ["target"] });
});

test("@retirement two-card layout has no overlap and retains a minimal visual record", async ({ page }, testInfo) => {
  await page.goto("/?world=math-world");
  await expect(page.getByTestId("math-world-map")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const cards = await page.locator(".math-world-card").evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  expect(cards).toHaveLength(2);
  const [a, b] = cards;
  expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const output = resolve("tmp/tasks/GAME-CODEX-STEP1-PORTFOLIO-RETIREMENT/final-screenshots");
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: resolve(output, `math-world-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
});

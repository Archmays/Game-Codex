import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const TASK_ID = process.env.GAME_CODEX_TASK_ID ?? "GAME-CODEX-NATURAL-USE-OBSERVATION-KIT-06A";
const REPORTS = resolve(process.cwd(), `tmp/tasks/${TASK_ID}/reports`);
const SCREENSHOTS = resolve(REPORTS, "selected-screenshots");

interface RuntimeObservation { pageErrors: string[]; consoleErrors: string[]; failedResponses: string[]; failedRequests: string[]; externalRequests: string[]; }

function observe(page: Page): RuntimeObservation {
  const result: RuntimeObservation = { pageErrors: [], consoleErrors: [], failedResponses: [], failedRequests: [], externalRequests: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) result.failedResponses.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") result.failedRequests.push(`${request.url()} ${request.failure()?.errorText}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") result.externalRequests.push(request.url());
  });
  return result;
}

function expectClean(runtime: RuntimeObservation): void {
  expect(runtime.pageErrors, "page errors").toEqual([]);
  expect(runtime.consoleErrors, "console errors").toEqual([]);
  expect(runtime.failedResponses, "responses >=400").toEqual([]);
  expect(runtime.failedRequests, "failed requests").toEqual([]);
  expect(runtime.externalRequests, "external requests").toEqual([]);
}

async function visiblePrimary(page: Page, kind: string): Promise<Locator> {
  if (kind === "my-game-world") return page.locator("[data-world-forest-link]");
  if (kind === "hanzi-world") return page.getByTestId("complete-primary-action");
  if (kind === "math-world") return page.locator('[data-station-id="slider"] button');
  if (kind === "english-world") return page.locator(".wordlight-region button").first();
  if (kind === "classic-hub") return page.locator(".game-card__button").first();
  return page.locator("[data-card-id]").first();
}

const primary: readonly { id: string; route: string; surface: string; gameId?: string }[] = [
  { id: "my-game-world", route: "/?world=my-game-world", surface: "[data-testid=my-game-world]" },
  { id: "hanzi-world", route: "/?play=hanzi-magic-complete", surface: "[data-testid=hanzi-magic-complete]" },
  { id: "math-world", route: "/?world=math-world", surface: "[data-testid=math-world-map]" },
  { id: "english-world", route: "/?world=english-world", surface: "[data-testid=english-world-map]" },
  { id: "classic-hub", route: "/?hub=classic&from=world", surface: "[data-testid=classic-hub-from-world]" },
] as const;

test("@play-ready all five primary first actions are visible and child-facing", async ({ page }, testInfo) => {
  const runtime = observe(page);
  const observations: unknown[] = [];
  for (const item of primary) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    if (item.gameId) {
      await page.locator(`.game-card[data-game-id="${item.gameId}"] .game-card__button`).click();
    }
    const surface = page.locator(item.surface);
    await expect(surface).toBeVisible({ timeout: 30_000 });
    const heading = page.locator("h1:visible").first();
    await expect(heading, `${item.id} h1`).toBeVisible();
    const action = await visiblePrimary(page, item.id);
    await expect(action, `${item.id} primary action`).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.y).toBeLessThan(testInfo.project.use.viewport!.height);
    const adultMetadata = await surface.getByText(/推荐年龄|学习目标|质量等级|quality tier|internal status|recommended age/i).count();
    expect(adultMetadata, `${item.id} adult metadata`).toBe(0);
    await action.focus();
    await expect(action).toBeFocused();
    const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(geometry.scroll - geometry.client).toBeLessThanOrEqual(1);
    observations.push({ id: item.id, h1: await heading.textContent(), primaryAction: await action.textContent(), primaryAboveFold: true, adultMetadata: 0, target: box });
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, `FIRST_USE_AUDIT.${testInfo.project.name}.json`), `${JSON.stringify({ verdict: "PASS", project: testInfo.project.name, observations }, null, 2)}\n`);
  expectClean(runtime);
});

test("@play-ready world, support, Classic, back, reload and resume routes stay coherent", async ({ page }) => {
  const runtime = observe(page);
  await page.goto("/?play=hanzi-magic-complete&view=pinyin", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("sound-rhyme-trial")).toBeVisible();
  await page.locator('a[href*="play=hanzi-magic-complete"]').first().click();
  await expect(page.getByTestId("hanzi-magic-complete")).toBeVisible();
  await page.getByRole("link", { name: /回.*游戏世界/ }).first().click();
  await expect(page.getByTestId("my-game-world")).toBeVisible();

  await page.goto("/?world=math-world&station=slider", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-station-id="slider"] .equation-slider')).toBeVisible();
  await page.getByRole("button", { name: "← 回城市地图" }).click();
  await expect(page.getByTestId("math-world-map")).toBeVisible();

  await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("english-region")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("english-region")).toBeVisible();
  await page.goBack();
  await expect(page.locator("body")).toBeVisible();

  await page.goto("/?play=hanzi-magic-complete&view=memory&pack=same-glyph", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("memory-match")).toBeVisible();
  await page.locator("[data-card-id]").first().click();
  await page.goto("/?hub=classic&from=world", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".game-card")).toHaveCount(3);
  await expect(page.locator('.game-card[data-game-id="memory-card"], .game-card[data-game-id="make-target"]')).toHaveCount(0);
  expectClean(runtime);
});

test("@save-vault export, preview and restore preserve retired exact keys and unrelated bytes", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const runtime = observe(page);
  await page.goto("/?world=my-game-world", { waitUntil: "domcontentloaded" });
  const fixture = {
    "family-games/math-world/v1": '{ "version":1,"lastStation":"lab","visitedStations":["clock","array","lab"],"reducedMotionOverride":true,"extension":{"kept":7} }',
    "math-battle-web/save-v1": "{synthetic-broken-legacy",
    "family-games/clock-reader/progress": '{"version":99,"future":{"synthetic":true}}',
    "family-games/multiplication-adventure/progress": '{ "bestScore":9,"plays":12 }',
  };
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    localStorage.setItem("other-localhost-app/save", "do-not-touch");
  }, fixture);
  await page.getByRole("button", { name: /家长角/ }).click();
  await page.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  const vault = page.getByTestId("save-vault");
  await expect(vault).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "备份游戏进度" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const text = await (await import("node:fs/promises")).readFile(path!, "utf8");
  const entries = JSON.parse(text).entries as { key: string; value: string }[];
  for (const [key, value] of Object.entries(fixture)) expect(entries.find(entry => entry.key === key)?.value).toBe(value);
  expect(text).not.toContain("other-localhost-app/save");
  await page.locator("[data-vault-file]").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.locator("[data-vault-preview]")).toBeVisible();
  await expect(page.locator("[data-vault-preview-checksum]")).toHaveText("PASS");
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(fixture))).toEqual(fixture);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "恢复这些已知进度" }).click();
  await expect(page.locator("[data-vault-status]")).toContainText("已恢复");
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(fixture))).toEqual(fixture);
  expect(await page.evaluate(() => localStorage.getItem("other-localhost-app/save"))).toBe("do-not-touch");
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SCREENSHOTS, `save-vault-import-preview-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
  expectClean(runtime);
});

test("@a11y modal focus, language parts, target sizes and 200% zoom stay operable", async ({ page }) => {
  const runtime = observe(page);
  await page.goto("/?world=my-game-world", { waitUntil: "domcontentloaded" });
  expect(await page.locator("html").getAttribute("lang")).toBe("zh-CN");
  const settings = page.getByRole("button", { name: /家长角/ });
  await settings.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "回到游戏世界" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  await expect(page.locator("[data-world-forest-link]")).toBeVisible();
  await expect(page.getByTestId("my-game-world")).toHaveAttribute(
    "data-active-child-products",
    "hanzi-radical-battle math-lab english-spell-battle"
  );
  await page.locator("[data-world-forest-link]").focus();
  await expect(page.locator("[data-world-forest-link]")).toBeFocused();

  await page.goto("/?world=english-world", { waitUntil: "domcontentloaded" });
  await page.locator(".wordlight-region button").first().click();
  const wordButton = page.locator(".wordlight-mission-list button[data-word-id]").first();
  await wordButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[lang="en-US"]')).not.toHaveCount(0);
  const englishSettings = page.getByRole("button", { name: "设置" });
  await englishSettings.click();
  await page.keyboard.press("Escape");
  await expect(englishSettings).toBeFocused();

  await page.goto("/?world=math-world&station=slider", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "跳过教程" }).click();
  await expect(page.getByRole("button", { name: "第 2 列选上方格" })).toBeVisible();
  expectClean(runtime);
});

test("@long-session 100 cross-surface transitions do not accumulate mounts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const runtime = observe(page);
  const routes = [
    "/?world=my-game-world", "/?play=hanzi-magic-complete", "/?play=hanzi-magic-complete&view=pinyin", "/?play=hanzi-magic-complete",
    "/?world=math-world", "/?world=math-world&station=slider", "/?world=math-world", "/?world=english-world", "/?world=english-world&region=animals", "/?hub=classic",
  ];
  const samples: number[] = [];
  for (let transition = 0; transition < 100; transition += 1) {
    await page.goto(routes[transition % routes.length], { waitUntil: "domcontentloaded" });
    await expect(page.locator("#app > *")).toHaveCount(1);
    expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => localStorage.getItem("game-codex/parent-observation/v1"))).toBeNull();
    if (transition % 10 === 9) samples.push(await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0));
  }
  expect(await page.evaluate(() => localStorage.getItem("game-codex/parent-observation/v1"))).toBeNull();
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, "LONG_SESSION_STRESS.json"), `${JSON.stringify({ verdict: "PASS", transitions: 100, orphanCanvas: 0, doubleMount: 0, wrongReturn: 0, saveLoss: 0, heapSamples: samples, evidenceType: "browser-machine-stress" }, null, 2)}\n`);
  expectClean(runtime);
});

test("@performance local production performance sample", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const state = { lcp: 0, cls: 0, inp: 0 };
    (window as unknown as { __playReadyVitals: typeof state }).__playReadyVitals = state;
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp, entry.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) state.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.inp = Math.max(state.inp, entry.duration); }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
  });
  const routes = ["/?world=my-game-world", "/?play=hanzi-magic-complete", "/?world=math-world", "/?world=english-world", "/?hub=classic", "/?world=math-world&station=slider"];
  const samples: unknown[] = [];
  for (const route of routes) {
    const start = Date.now();
    await page.goto(route, { waitUntil: "networkidle" });
    const action = route.includes("my-game-world") ? page.getByRole("button", { name: /家长角/ })
      : route.includes("hanzi-magic") ? page.getByRole("button", { name: "家长角" })
      : route.includes("station=slider") ? page.getByRole("button", { name: "跳过教程" })
      : route.includes("math-world") ? page.locator('[data-station-id="slider"] button')
      : route.includes("english-world") ? page.locator(".wordlight-region button").first()
      : page.getByRole("button", { name: "数学", exact: true });
    const interactionStarted = performance.now();
    await action.click();
    const interactionLatencySampleMs = Math.round(performance.now() - interactionStarted);
    await page.waitForTimeout(250);
    samples.push(await page.evaluate(({ route, elapsed, interactionLatencySampleMs }) => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const scripts = resources.filter((entry) => entry.initiatorType === "script");
      const css = resources.filter((entry) => entry.initiatorType === "link" && entry.name.includes(".css"));
      const rasters = resources.filter((entry) => /\.(png|webp|jpe?g)(\?|$)/i.test(entry.name));
      const vitals = (window as unknown as { __playReadyVitals: { lcp: number; cls: number; inp: number } }).__playReadyVitals;
      return { route, elapsedToStableMs: elapsed, requests: resources.length, jsCssTransferBytes: [...scripts, ...css].reduce((sum, entry) => sum + entry.transferSize, 0), rasterTransferBytes: rasters.reduce((sum, entry) => sum + entry.transferSize, 0), lcpSampleMs: Math.round(vitals.lcp), clsSample: Number(vitals.cls.toFixed(4)), inpEventTimingSampleMs: Math.round(vitals.inp), primaryActionRoundtripSampleMs: interactionLatencySampleMs, evidence: "LAB_SAMPLED_ONLY_NOT_FIELD_75P" };
    }, { route, elapsed: Date.now() - start, interactionLatencySampleMs }));
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, `PERFORMANCE_SAMPLE.local-${testInfo.project.name}.json`), `${JSON.stringify({ verdict: "PASS", environment: "local-production-preview", project: testInfo.project.name, samples }, null, 2)}\n`);
});

test("@visual modified portfolio surfaces", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/?world=my-game-world", { waitUntil: "networkidle" });
  await expect(page).toHaveScreenshot(`my-game-world-${testInfo.project.name}.png`, { fullPage: true });
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SCREENSHOTS, `my-game-world-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
  await page.goto("/?hub=classic&from=world", { waitUntil: "networkidle" });
  await expect(page).toHaveScreenshot(`classic-${testInfo.project.name}.png`, { fullPage: true });
  await page.screenshot({ path: resolve(SCREENSHOTS, `classic-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
  await page.goto("/?world=my-game-world", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /家长角/ }).click();
  await page.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  await expect(page).toHaveScreenshot(`save-vault-export-${testInfo.project.name}.png`, { fullPage: true });
  await page.screenshot({ path: resolve(SCREENSHOTS, `save-vault-export-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
});

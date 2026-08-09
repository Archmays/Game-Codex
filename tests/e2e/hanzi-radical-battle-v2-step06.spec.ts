import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save/schema";

const SCREENSHOT_DIR = resolve("artifacts/hanzi-radical-battle-v2/step-06/screenshots");
const BUILD_COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const OBSERVER_FIXTURE = `/?observe=hanzi-v2-step06&fixture=SYNTHETIC_TOOLING_TEST_ONLY&build=${BUILD_COMMIT}`;

const SCREENSHOTS = [
  "01-default-root-world-desktop.webp",
  "02-default-root-world-mobile.webp",
  "03-classic-hub-explicit-route.webp",
  "04-route-title-identity.webp",
  "05-canonical-origin-preflight.webp",
  "06-progress-continuity-pass.webp",
  "07-progress-continuity-blocked.webp",
  "08-second-use-observer-ready.webp",
  "09-second-use-child-root-clean.webp",
  "10-first-destination-forest.webp",
  "11-returned-to-world.webp",
  "12-second-use-summary-fixture.webp",
] as const;

type Diagnostics = { consoleErrors: string[]; pageErrors: string[]; remoteRequests: string[] };

function observeDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], remoteRequests: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && !["127.0.0.1", "localhost"].includes(url.hostname)) diagnostics.remoteRequests.push(request.url());
  });
  return diagnostics;
}

function expectClean(diagnostics: Diagnostics): void {
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.remoteRequests).toEqual([]);
}

async function screenshotWebp(page: Page, target: Page | Locator, fileName: (typeof SCREENSHOTS)[number]): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const png = await target.screenshot({ animations: "disabled" });
  const dataUrl = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await new Promise<void>((ok, fail) => { image.onload = () => ok(); image.onerror = () => fail(new Error("decode")); });
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d"); if (!context) throw new Error("No canvas context");
    context.drawImage(image, 0, 0); return canvas.toDataURL("image/webp", 0.92);
  }, png.toString("base64"));
  const webp = Buffer.from(dataUrl.split(",", 2)[1], "base64");
  expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
  await writeFile(resolve(SCREENSHOT_DIR, fileName), webp);
}

function completedSave() {
  return {
    schemaVersion: 3,
    contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
    completedRuns: 1,
    lastRunSeed: "hanzi-v2-golden-slice-v1",
    campState: { lamp: true },
    spellbookEntries: ["ming", "hua", "lin", "xing"],
    chosenAbilityHistory: ["ink-echo"],
    settings: { muted: true, reducedMotion: false },
    localPlaytestEvents: [],
  };
}

async function installCompleteSave(page: Page): Promise<void> {
  await page.goto("/?hub=classic");
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [GOLDEN_SLICE_SAVE_KEY, completedSave()] as const);
}

async function installSpeechStub(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class Utterance extends EventTarget { text: string; lang = ""; rate = 1; pitch = 1; volume = 1; voice = null; onend = null; onerror = null; constructor(text = "") { super(); this.text = text; } }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speaking: false, pending: false, paused: false, cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, speak() {}, onvoiceschanged: null } });
  });
}

function slice(page: Page): Locator { return page.getByTestId("hanzi-v2-golden-slice"); }
async function waitPhase(page: Page, phase: string): Promise<void> { await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 15_000 }); }
async function primary(page: Page, name: string): Promise<void> { await slice(page).getByRole("button", { name, exact: true }).click(); }
async function solve(page: Page, card: string, slot: string): Promise<void> { await page.getByTestId(`component-card-${card}`).click(); await page.getByTestId(`slot-${slot}`).click(); }

async function completeGoldenRun(page: Page): Promise<void> {
  await primary(page, "走进墨林"); await primary(page, "看看营地灯"); await primary(page, "沿着灯路出发"); await primary(page, "跳过小路"); await primary(page, "开始合字施法");
  await solve(page, "ming-ri", "left"); await solve(page, "ming-yue", "right"); await waitPhase(page, "battle_1_cleared"); await primary(page, "看看光留下什么"); await waitPhase(page, "travel_to_battle_2"); await primary(page, "跳过花径"); await primary(page, "试试新的结构");
  await solve(page, "hua-cao", "top"); await solve(page, "hua-hua", "bottom"); await waitPhase(page, "battle_2_cleared"); await primary(page, "看看三道光"); await page.getByTestId("ability-ink-echo").click(); await primary(page, "走向双印墨守"); await primary(page, "先看清它的动作");
  await solve(page, "lin-mu-left", "left"); await waitPhase(page, "boss_interference"); await page.locator("[data-ink-echo-voice]").click(); await waitPhase(page, "boss_phase_1_placing"); await solve(page, "lin-mu-right", "right"); await waitPhase(page, "boss_phase_1_cleared"); await primary(page, "解开第二枚墨印");
  await solve(page, "xing-ri", "top"); await waitPhase(page, "boss_phase_2_placing"); await solve(page, "xing-sheng", "bottom"); await waitPhase(page, "boss_cleared"); await primary(page, "沿星路回营地"); await waitPhase(page, "camp_repair"); await primary(page, "翻开四字魔法书"); await waitPhase(page, "spellbook_review"); await primary(page, "让营地继续亮着"); await waitPhase(page, "run_complete");
}

async function startFixtureObserver(page: Page): Promise<Page> {
  await page.goto(OBSERVER_FIXTURE);
  await page.locator("[data-interval]").selectOption("ONE_TO_THREE_DAYS");
  await page.locator("[data-sound]").selectOption("START_MUTED");
  await page.locator("[data-privacy-ready]").check();
  const popup = page.waitForEvent("popup");
  await page.locator("[data-ready]").click();
  const child = await popup;
  await child.waitForLoadState("domcontentloaded");
  return child;
}

test.describe.serial("Hanzi Radical Battle V2 STEP 06", () => {
  test.beforeEach(async ({ context }) => installSpeechStub(context));

  test("@capture default root is the world across desktop, mobile, tablet; title/theme and repaired state are stable", async ({ page }) => {
    const diagnostics = observeDiagnostics(page);
    await installCompleteSave(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("my-game-world")).toBeVisible();
    await expect(page).toHaveTitle("我的游戏世界");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#071c2a");
    await expect(page.getByTestId("my-game-world")).not.toContainText(/儿童学习游戏大厅|session|SYNTHETIC|observer|测试|版本/i);
    for (const repair of ["lamp", "flowers", "trees", "star-path"]) await expect(page.locator(`[data-repair="${repair}"]`)).toHaveAttribute("data-ready", "true");
    await screenshotWebp(page, page, "01-default-root-world-desktop.webp");
    await screenshotWebp(page, page, "04-route-title-identity.webp");
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await screenshotWebp(page, page, "02-default-root-world-mobile.webp");
    await page.setViewportSize({ width: 820, height: 1180 }); await page.goto("/"); await expect(page.getByTestId("my-game-world")).toBeVisible();
    expectClean(diagnostics);
  });

  test("@capture explicit classic hub keeps ten entries, game enter/return, and world return without loops", async ({ page }) => {
    const diagnostics = observeDiagnostics(page);
    await page.goto("/?hub=classic");
    await expect(page).toHaveTitle("游戏百宝箱");
    await expect(page.locator(".game-card")).toHaveCount(10);
    await screenshotWebp(page, page, "03-classic-hub-explicit-route.webp");
    await page.locator(".game-card__button").first().click(); await expect(page.locator(".game-topbar")).toBeVisible();
    await page.getByRole("button", { name: "返回大厅" }).click(); await expect(page.locator(".game-card")).toHaveCount(10);
    await page.getByRole("link", { name: /回我的游戏世界/ }).click(); await expect(page.getByTestId("my-game-world")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
    expectClean(diagnostics);
  });

  test("@capture observer preflight shows canonical origin, pass/block, neutral direction, and READY", async ({ page, context }) => {
    const diagnostics = observeDiagnostics(page);
    await page.goto(OBSERVER_FIXTURE);
    const observer = page.getByTestId("step06-observer");
    await expect(observer).toContainText("http://127.0.0.1:5175");
    await expect(observer).toContainText("你想去哪里都可以");
    await expect(observer).not.toContainText("请让孩子点墨迹森林");
    await expect(page.getByTestId("step06-continuity")).toHaveAttribute("data-continuity", "pass");
    await screenshotWebp(page, page.getByTestId("step06-preflight"), "05-canonical-origin-preflight.webp");
    await screenshotWebp(page, page.getByTestId("step06-continuity"), "06-progress-continuity-pass.webp");
    await screenshotWebp(page, page, "08-second-use-observer-ready.webp");

    const blocked = await context.newPage();
    await blocked.goto("/?hub=classic");
    await blocked.evaluate((key) => localStorage.removeItem(key), GOLDEN_SLICE_SAVE_KEY);
    await blocked.goto(`http://127.0.0.1:5175/?observe=hanzi-v2-step06&build=${BUILD_COMMIT}`);
    await expect(blocked.getByTestId("step06-continuity")).toHaveAttribute("data-continuity", "blocked");
    await screenshotWebp(blocked, blocked.getByTestId("step06-continuity"), "07-progress-continuity-blocked.webp");
    await blocked.locator("[data-interval]").selectOption("ONE_TO_THREE_DAYS"); await blocked.locator("[data-privacy-ready]").check(); await blocked.locator("[data-ready]").click();
    await expect(blocked.locator("[data-ready-status]")).toContainText("未打开儿童路线");
    await blocked.close();
    expectClean(diagnostics);
  });

  test("@capture guarded fixture spans clean child root, forest, full run, return, stop, and synthetic summary", async ({ page }) => {
    const diagnostics = observeDiagnostics(page);
    const child = await startFixtureObserver(page);
    const childDiagnostics = observeDiagnostics(child);
    await expect(child.getByTestId("my-game-world")).toBeVisible();
    await expect(child.getByTestId("my-game-world")).not.toContainText(/SYNTHETIC|session|observer|测试|版本/i);
    await screenshotWebp(child, child, "09-second-use-child-root-clean.webp");
    await child.locator("[data-world-forest-link]").click();
    await expect(child.getByTestId("hanzi-v2-golden-slice")).toBeVisible();
    await screenshotWebp(child, child, "10-first-destination-forest.webp");
    await completeGoldenRun(child);
    await expect(child.locator("[data-return-to-world]")).toBeVisible();
    await child.locator("[data-return-to-world]").click();
    await expect(child.getByTestId("my-game-world")).toBeVisible();
    await screenshotWebp(child, child, "11-returned-to-world.webp");
    await expect.poll(async () => page.locator("[data-first-destination]").textContent()).toBe("FOREST");
    await expect(page.locator("[data-current-surface]")).toHaveText("WORLD");
    await page.locator("[data-natural-end]").click();
    await expect(child.getByTestId("step06-child-stopped")).toBeVisible();
    const download = page.waitForEvent("download"); await page.locator("[data-export]").click(); await download;
    await expect(page.getByTestId("step06-summary-fixture")).toContainText("SYNTHETIC_TOOLING_TEST_ONLY");
    await expect(page.getByTestId("step06-summary-fixture")).toContainText("明确不作结论");
    await screenshotWebp(page, page.getByTestId("step06-summary-fixture"), "12-second-use-summary-fixture.webp");
    expectClean(childDiagnostics); expectClean(diagnostics);
  });

  test("first destination can be spellbook and derives from events, then returns to world", async ({ page }) => {
    const child = await startFixtureObserver(page);
    await child.locator("[data-world-spellbook-open]").click();
    await expect(child.getByTestId("world-spellbook")).toBeVisible();
    await expect.poll(async () => page.locator("[data-first-destination]").textContent()).toBe("SPELLBOOK");
    await child.locator("[data-world-modal-close]").click();
    await page.locator("[data-natural-end]").click();
  });

  test("first destination can be treasure, opens classic hub, and returns with context", async ({ page }) => {
    const child = await startFixtureObserver(page);
    await child.locator("[data-world-treasure-link]").click();
    await expect(child.getByTestId("classic-hub-from-world")).toBeVisible(); await expect(child.locator(".game-card")).toHaveCount(10);
    await expect.poll(async () => page.locator("[data-first-destination]").textContent()).toBe("TREASURE_BOX");
    await child.getByRole("link", { name: /回我的游戏世界/ }).click(); await expect(child.getByTestId("my-game-world")).toBeVisible();
    await page.locator("[data-natural-end]").click();
  });

  test("wrong origin and invalid grant fail closed while normal fresh root remains usable", async ({ page }) => {
    await page.goto(`http://localhost:5175/?observe=hanzi-v2-step06&build=${BUILD_COMMIT}`);
    await expect(page.getByTestId("step06-continuity")).toHaveAttribute("data-continuity", "blocked");
    await expect(page.getByTestId("step06-continuity")).toContainText("地址不对");
    await page.goto("/?evidence=hanzi-v2-step06&session=s06-12345678"); await expect(page.getByTestId("step06-route-denied")).toBeVisible();
    await page.goto("/"); await expect(page.getByTestId("my-game-world")).toBeVisible();
    await expect(page.getByTestId("my-game-world")).toHaveAttribute("data-repaired", "false");
  });

  test("reduced motion keeps 44px controls and child route makes no remote request", async ({ page }) => {
    const diagnostics = observeDiagnostics(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
    const boxes = await page.locator("button, a").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return [r.width, r.height]; }));
    expect(boxes.filter(([width, height]) => width > 0 && height > 0).every(([, height]) => height >= 44)).toBe(true);
    expectClean(diagnostics);
  });

  test.afterAll(async () => {
    for (const file of SCREENSHOTS) {
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(resolve(SCREENSHOT_DIR, file)));
      expect(bytes.subarray(0, 4).toString("ascii"), file).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii"), file).toBe("WEBP");
    }
  });
});

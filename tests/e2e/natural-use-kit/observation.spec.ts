import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OBSERVATION_STORAGE_KEY } from "../../../packages/observation/natural-use";

const TASK_ID = process.env.GAME_CODEX_TASK_ID ?? "GAME-CODEX-NATURAL-USE-OBSERVATION-KIT-06A";
const SCREENSHOTS = resolve(process.cwd(), `tmp/tasks/${TASK_ID}/selected-screenshots`);

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

async function observationCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).records?.length ?? -1) : 0;
  }, OBSERVATION_STORAGE_KEY);
}

test("@privacy ordinary play, ten virtual minutes, open/close, manual selection and refresh record nothing", async ({ page }) => {
  const runtime = observe(page);
  await page.goto("/?world=math-world", { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => { localStorage.clear(); localStorage.removeItem(key); }, OBSERVATION_STORAGE_KEY);
  await page.clock.install({ time: new Date("2026-08-22T10:00:00") });
  await page.clock.fastForward("10:00");
  expect(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY)).toBeNull();

  await page.goto("/?world=my-game-world&parent=observation", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("observation-notebook")).toBeVisible();
  expect(await observationCount(page)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY)).toBeNull();
  await page.locator("[data-observation-surface]").selectOption("math-world");
  await page.getByRole("checkbox", { name: "明显停顿或寻找操作" }).check();
  expect(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY)).toBeNull();
  await page.keyboard.press("Escape");
  expect(await page.evaluate((key) => localStorage.getItem(key), OBSERVATION_STORAGE_KEY)).toBeNull();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("observation-notebook")).toBeVisible();
  expect(await observationCount(page)).toBe(0);
  expectClean(runtime);
});

test("@natural-use parent creates, lists, previews, exports and purpose-separated deletes", async ({ page }, testInfo) => {
  const runtime = observe(page);
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.goto("/?world=my-game-world", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("family-games/math-world/v1", '{"version":1,"glow":"preserve"}');
    localStorage.setItem("other-localhost-app/save", "do-not-touch");
  });
  await page.getByRole("button", { name: /家长角/ }).click();
  if (testInfo.project.name === "desktop-1440") await page.screenshot({ path: resolve(SCREENSHOTS, "parent-settings.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "打开使用观察笔记" }).click();
  const notebook = page.getByTestId("observation-notebook");
  await expect(notebook).toBeVisible();
  expect(await observationCount(page)).toBe(0);
  await notebook.locator("[data-observation-surface]").selectOption("math-world");
  await notebook.getByRole("checkbox", { name: "明显停顿或寻找操作" }).check();
  await notebook.getByRole("radio", { name: "一次轻提示" }).check();
  await notebook.getByRole("radio", { name: "继续玩" }).check();
  await notebook.locator("[data-observation-note]").fill('<script data-observation-xss>window.__observationXss=true</script>🙂');
  await notebook.evaluate((element) => { element.scrollTop = 0; element.scrollIntoView({ block: "start" }); });
  if (testInfo.project.name === "desktop-1440") await page.screenshot({ path: resolve(SCREENSHOTS, "observation-form-desktop.png"), fullPage: true, animations: "disabled" });
  if (testInfo.project.name === "mobile-390") await page.screenshot({ path: resolve(SCREENSHOTS, "observation-form-mobile.png"), fullPage: true, animations: "disabled" });
  await notebook.getByRole("button", { name: "保存这条观察" }).click();
  await expect(notebook.locator("[data-observation-status]")).toContainText("已在本机保存 1 条");
  expect(await observationCount(page)).toBe(1);

  await notebook.getByRole("button", { name: "查看已有记录" }).click();
  await expect(notebook.locator("[data-observation-records]")).toContainText("<script data-observation-xss>");
  expect(await page.locator("script[data-observation-xss]").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __observationXss?: boolean }).__observationXss)).toBeUndefined();
  if (testInfo.project.name === "desktop-1440") await page.screenshot({ path: resolve(SCREENSHOTS, "record-list.png"), fullPage: true, animations: "disabled" });

  const exportButton = notebook.getByRole("button", { name: "导出", exact: true });
  await exportButton.click();
  const preview = page.getByTestId("observation-export-preview");
  await expect(preview).toBeVisible();
  await expect(preview.locator("[data-preview-count]")).toHaveText("1");
  await expect(preview).toContainText("不会包含游戏存档");
  await expect(preview.getByRole("button", { name: "确认导出" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(preview.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(preview.getByRole("button", { name: "确认导出" })).toBeFocused();
  if (testInfo.project.name === "desktop-1440") await page.screenshot({ path: resolve(SCREENSHOTS, "export-preview.png"), fullPage: true, animations: "disabled" });
  const observationDownloadPromise = page.waitForEvent("download");
  await preview.getByRole("button", { name: "确认导出" }).click();
  const observationDownload = await observationDownloadPromise;
  expect(observationDownload.suggestedFilename()).toMatch(/^GAME_CODEX_NATURAL_USE_OBSERVATIONS_\d{4}-\d{2}-\d{2}\.json$/);
  const observationPath = await observationDownload.path();
  const exported = JSON.parse(await readFile(observationPath!, "utf8"));
  expect(exported.recordCount).toBe(1);
  expect(exported.records[0].surfaceId).toBe("math-world");
  expect(exported.records[0]).not.toHaveProperty("routeHistory");
  expect(JSON.stringify(exported)).not.toContain("family-games/math-world/v1");
  expect(JSON.stringify(exported)).not.toContain("other-localhost-app/save");

  await page.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  const vaultDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "备份游戏进度" }).click();
  const vaultPath = await (await vaultDownloadPromise).path();
  const vaultText = await readFile(vaultPath!, "utf8");
  expect(vaultText).not.toContain(OBSERVATION_STORAGE_KEY);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "清空已知游戏进度" }).click();
  expect(await observationCount(page)).toBe(1);
  await page.evaluate(() => localStorage.setItem("family-games/math-world/v1", '{"version":1,"glow":"preserve"}'));

  page.once("dialog", (dialog) => void dialog.accept());
  await notebook.getByRole("button", { name: "删除这条" }).click();
  expect(await observationCount(page)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("family-games/math-world/v1"))).toContain("preserve");

  await notebook.getByRole("button", { name: "记录一条" }).click();
  await notebook.locator("[data-observation-surface]").selectOption("english-world");
  await notebook.getByRole("checkbox", { name: "自主开始" }).check();
  await notebook.getByRole("button", { name: "保存这条观察" }).click();
  expect(await observationCount(page)).toBe(1);
  page.once("dialog", (dialog) => void dialog.accept());
  await notebook.getByRole("button", { name: "删除全部" }).click();
  expect(await observationCount(page)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("family-games/math-world/v1"))).toContain("preserve");
  expect(await page.evaluate(() => localStorage.getItem("other-localhost-app/save"))).toBe("do-not-touch");
  expectClean(runtime);
});

test("@security 240 Unicode characters save, 241 reject, keyboard, 200% zoom and accessible labels stay operable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const runtime = observe(page);
  await page.goto("/?world=my-game-world&parent=observation", { waitUntil: "domcontentloaded" });
  const notebook = page.getByTestId("observation-notebook");
  await notebook.locator("[data-observation-surface]").selectOption("hanzi-world");
  await notebook.getByRole("checkbox", { name: "很快找到主要操作" }).check();
  await notebook.locator("[data-observation-note]").fill("🙂".repeat(240));
  await expect(notebook.locator("[data-observation-note-count]")).toHaveText("240 / 240");
  await notebook.getByRole("button", { name: "保存这条观察" }).click();
  expect(await observationCount(page)).toBe(1);
  await notebook.getByRole("checkbox", { name: "很快找到主要操作" }).check();
  await notebook.locator("[data-observation-note]").fill("字".repeat(241));
  await expect(notebook.locator("[data-observation-note-count]")).toHaveText("241 / 240");
  await notebook.getByRole("button", { name: "保存这条观察" }).click();
  await expect(notebook.locator("[data-observation-error]")).toContainText("最多 240");
  expect(await observationCount(page)).toBe(1);

  const unlabeled = await notebook.locator("input, select, textarea").evaluateAll((elements) => elements.filter((element) => {
    const input = element as HTMLInputElement;
    return !input.labels?.length && !input.getAttribute("aria-label") && !input.getAttribute("aria-labelledby");
  }).length);
  expect(unlabeled).toBe(0);
  const smallControls = await notebook.locator("button:visible, input:visible, select:visible, textarea:visible").evaluateAll((elements) => elements.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width < 22 || box.height < 22;
  }).length);
  expect(smallControls).toBe(0);
  await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  await expect(notebook.getByRole("button", { name: "导出", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expectClean(runtime);
});

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ENGLISH_V2_THEMES, ENGLISH_V2_WORDS } from "../../../games/english-spell-battle/v2/content/manifest";
import { expectHitTarget } from "../helpers/hit-target";

const CORE_WORDS = ENGLISH_V2_WORDS.filter((word) => word.storyBand === "story-core");
const REPORTS = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? "test-results", "interaction-integrity/reports");
const SELECTED_SCREENSHOTS = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? "test-results", "interaction-integrity/selected-screenshots");

async function settleImages(page: Page, allowBroken = false): Promise<void> {
  await page.waitForFunction((brokenAllowed) => Array.from(document.images).every((image) => image.complete && (brokenAllowed || image.naturalWidth > 0)), allowBroken);
  await page.evaluate(() => document.fonts.ready);
}

test("@hittest @representative @english-story all 30 story CTAs are topmost and real-clickable", async ({ page }, testInfo) => {
  const rows: unknown[] = [];
  for (const theme of ENGLISH_V2_THEMES) {
    await page.goto(`/?world=english-world&region=${theme.id}`, { waitUntil: "domcontentloaded" });
    await settleImages(page);
    const buttons = page.locator(".wordlight-mission-list button[data-word-id]");
    await expect(buttons).toHaveCount(6);
    if (theme.id === "animals" && ["desktop-1366", "mobile-390"].includes(testInfo.project.name)) {
      mkdirSync(SELECTED_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(SELECTED_SCREENSHOTS, `english-01-04-after-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
    }
    for (let index = 0; index < 6; index += 1) {
      const button = buttons.nth(index);
      const wordId = await button.getAttribute("data-word-id");
      const evidence = await expectHitTarget(button, { minimumRatio: 1, minimumSize: 44 });
      await button.click({ trial: true });
      await button.click();
      await expect(page.getByTestId("english-mission")).toHaveAttribute("data-word-id", wordId!);
      await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "meaning");
      rows.push({ project: testInfo.project.name, region: theme.id, missionNumber: index + 1, wordId, hitSuccessRatio: evidence.hitSuccessRatio, trialClick: "PASS", realClick: "PASS" });
      await page.locator('[data-action="region"]').click();
      await expect(page.getByTestId("english-region")).toHaveAttribute("data-region", theme.id);
    }
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, `ENGLISH_STORY_CTA.${testInfo.project.name}.json`), `${JSON.stringify({ verdict: "PASS", project: testInfo.project.name, storyCtas: rows.length, rows }, null, 2)}\n`, "utf8");
  expect(rows).toHaveLength(CORE_WORDS.length);
});

test("@hittest @english-01-04 zoom 100/125/150/200 keeps exact reported controls clickable", async ({ page }, testInfo) => {
  const rows: unknown[] = [];
  for (const zoomPercent of [100, 125, 150, 200]) {
    for (let index = 0; index < 4; index += 1) {
      await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
      await settleImages(page);
      await page.evaluate((zoom) => { document.documentElement.style.zoom = `${zoom}%`; }, zoomPercent);
      const button = page.locator(".wordlight-mission-list button[data-word-id]").nth(index);
      const evidence = await expectHitTarget(button, { minimumRatio: 1, minimumSize: 44 });
      const wordId = await button.getAttribute("data-word-id");
      if (zoomPercent === 100) {
        await button.click({ trial: true });
        await button.click();
      } else {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      }
      await expect(page.getByTestId("english-mission")).toHaveAttribute("data-word-id", wordId!);
      rows.push({ project: testInfo.project.name, zoomPercent, missionNumber: index + 1, wordId, hitSuccessRatio: evidence.hitSuccessRatio, realActivation: "PASS", clickTrial: zoomPercent === 100 ? "PASS" : "NOT_APPLICABLE_CSS_ZOOM_COORDINATE_STRATEGY", evidenceType: zoomPercent === 100 ? "native-css-pixel-viewport plus Playwright trial and real click" : "CSS zoom accessibility simulation plus elementsFromPoint and raw mouse click; native touch is covered separately at 100%" });
    }
  }
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(resolve(REPORTS, `ENGLISH_01_04_ZOOM.${testInfo.project.name}.json`), `${JSON.stringify({ verdict: "PASS", project: testInfo.project.name, rows }, null, 2)}\n`, "utf8");
});

test("@hittest @representative pointer, touch, and keyboard activate English 01-04", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  const inputs = testInfo.project.name === "mobile-390" ? ["touch", "touch", "touch", "touch"] as const : ["pointer", "keyboard", "pointer", "keyboard"] as const;
  for (let index = 0; index < 4; index += 1) {
    await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
    await settleImages(page);
    const button = page.locator(".wordlight-mission-list button[data-word-id]").nth(index);
    await expectHitTarget(button, { minimumRatio: 1, minimumSize: 44 });
    if (inputs[index] === "touch") await button.tap();
    else if (inputs[index] === "keyboard") { await button.focus(); await expect(button).toBeFocused(); await page.keyboard.press("Enter"); }
    else await button.click();
    await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "meaning");
  }
});

test("@hittest @representative English image loading, loaded, failed, and slow states preserve CTA layout", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  let releaseImages: (() => void) | undefined;
  const barrier = new Promise<void>((resolveBarrier) => { releaseImages = resolveBarrier; });
  await page.route("**/assets/english-world/words/*.webp", async (route) => { await barrier; await route.continue(); });
  await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".wordlight-mission-list")).toBeVisible();
  for (let index = 0; index < 6; index += 1) await expectHitTarget(page.locator(".wordlight-mission-list button[data-word-id]").nth(index), { minimumRatio: 1, minimumSize: 44 });
  releaseImages!();
  await settleImages(page);
  for (let index = 0; index < 6; index += 1) await expectHitTarget(page.locator(".wordlight-mission-list button[data-word-id]").nth(index), { minimumRatio: 1, minimumSize: 44 });
  await page.unroute("**/assets/english-world/words/*.webp");

  await page.route("**/assets/english-world/words/*.webp", (route) => route.abort("failed"));
  await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
  await settleImages(page, true);
  for (let index = 0; index < 6; index += 1) await expectHitTarget(page.locator(".wordlight-mission-list button[data-word-id]").nth(index), { minimumRatio: 1, minimumSize: 44 });
});

test("@hittest @representative fallback font, Chinese scaffold states, and 200% text keep actions available", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/?world=english-world&region=animals", { waitUntil: "domcontentloaded" });
  await settleImages(page);
  await page.addStyleTag({ content: ".wordlight{font-family:Arial,system-ui,sans-serif;font-size:200%}" });
  for (const chineseScaffold of [true, false]) {
    await expect(page.locator(".wordlight")).toHaveAttribute("data-chinese-scaffold", String(chineseScaffold));
    const buttons = page.locator(".wordlight-mission-list button[data-word-id]");
    for (let index = 0; index < 6; index += 1) await expectHitTarget(buttons.nth(index), { minimumRatio: 1, minimumSize: 44 });
    if (chineseScaffold) {
      await page.getByRole("button", { name: "设置" }).click();
      await page.getByRole("checkbox", { name: "中文帮助" }).uncheck();
      await page.getByRole("button", { name: "回到词光岛" }).click();
    }
  }
});

test("@hittest @representative dynamic feedback, settings modal, and future-save warning do not leave blockers", async ({ page }, testInfo) => {
  test.skip(!["desktop-1366", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/?world=english-world&region=animals&word=word-cat", { waitUntil: "domcontentloaded" });
  await settleImages(page);
  await expectHitTarget(page.getByRole("button", { name: "看看它怎么拼" }), { minimumRatio: 1, minimumSize: 44 });
  await page.getByRole("button", { name: "看看它怎么拼" }).click();
  await page.getByRole("button", { name: "给一点提示" }).click();
  await expect(page.locator(".wordlight-hint")).toBeVisible();
  await expect(page.locator(".wordlight-live")).toHaveCSS("pointer-events", "none");
  await expectHitTarget(page.getByRole("button", { name: "放好这个词" }), { minimumRatio: 1, minimumSize: 44 });
  await page.getByRole("button", { name: "放好这个词" }).click();
  await expect(page.locator(".wordlight-live")).toHaveCSS("pointer-events", "none");

  const settings = page.getByRole("button", { name: "设置" });
  await settings.click();
  const close = page.getByRole("button", { name: "回到词光岛" });
  await expectHitTarget(close, { minimumRatio: 1, minimumSize: 44 });
  await close.click();
  await expect(settings).toBeFocused();

  await page.addInitScript(() => localStorage.setItem("family-games/english-world/v2", '{"version":7,"future":"keep-exact"}'));
  await page.goto("/?world=english-world", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("为保护它，这次只读游玩")).toBeVisible();
  await expectHitTarget(page.locator('[data-theme-id="animals"]'), { minimumRatio: 1, minimumSize: 44 });
});

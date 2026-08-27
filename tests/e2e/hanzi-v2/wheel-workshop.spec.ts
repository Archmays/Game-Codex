import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  CHAPTER_ONE_CHARACTER_IDS,
  HANZI_MAGIC_M4_SAVE_KEY,
  createFreshM4Save,
  deriveM4Repairs,
  updateM4Save,
} from "../../../games/hanzi-radical-battle/v2/chapter-one";
import { PLAYABLE_WHEEL_MANIFEST } from "../../../games/hanzi-radical-battle/v2/wheel-workshop/library/playable-wheel-manifest";
import { generateWheelRound } from "../../../games/hanzi-radical-battle/v2/wheel-workshop/machine/wheel-round-generator";
import { WHEEL_WORKSHOP_SAVE_KEY } from "../../../games/hanzi-radical-battle/v2/wheel-workshop/save/wheel-save";
import type { WheelGradeSelection } from "../../../games/hanzi-radical-battle/v2/wheel-workshop/types";

const output = resolve("test-results/hanzi-v2/wheel-workshop/screenshots");
mkdirSync(output, { recursive: true });

type InputMode = "mouse" | "keyboard" | "touch";

function fullCampSave() {
  return updateM4Save(createFreshM4Save(), {
    discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS,
    completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"],
    repairedObjectIds: deriveM4Repairs(CHAPTER_ONE_CHARACTER_IDS, ["glimmer-grove", "echo-garden", "wind-trail"]),
  });
}

function monitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResources: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedResources.push(`${request.method()} ${request.url()}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:/.test(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(request.url());
  });
  return { consoleErrors, pageErrors, failedResources, externalRequests };
}

async function inject(page: Page, entries: readonly (readonly [string, string])[]) {
  await page.addInitScript((values) => { for (const [key, value] of values) window.localStorage.setItem(key, value); }, entries);
}

async function activate(page: Page, locator: ReturnType<Page["locator"]>, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function openWorkshop(page: Page, seed: string, mode: InputMode = "mouse", gradeId: WheelGradeSelection = "p1") {
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullCampSave())]]);
  await page.goto(`/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=${encodeURIComponent(seed)}`);
  await expect(page.locator('[data-repair-id="magic-tree"]')).toHaveAttribute("data-repaired", "true");
  await activate(page, page.getByTestId("wheel-workshop-entry"), mode);
  await expect(page.getByTestId("wheel-workshop")).toBeVisible();
  await activate(page, page.locator('[data-action="wheel-open-grade-select"]'), mode);
  await activate(page, page.locator(`[data-wheel-grade-id="${gradeId}"]`), mode);
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-grade", gradeId);
}

interface RoundMemory { readonly session: string[]; readonly recent: string[]; }

async function solveRound(page: Page, seed: string, gradeId: WheelGradeSelection, completedRoundCount: number, memory: RoundMemory, mode: InputMode, options: { wrongFirst?: boolean; hints?: number; capturePlacement?: boolean; reducedMotion?: boolean } = {}) {
  const round = generateWheelRound({ seed: `${seed}:wheel-workshop`, gradeId, completedRoundCount, sessionRecordIds: memory.session, recentRecordIds: memory.recent });
  if (!round) throw new Error(`No wheel round for ${gradeId}`);
  const record = PLAYABLE_WHEEL_MANIFEST.find((entry) => entry.id === round.recordId)!;
  await activate(page, page.locator('[data-action="wheel-spin"]'), mode);
  if (!options.reducedMotion) {
    await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "spinning");
    await expect(page.locator(".ww-wheel")).toHaveAttribute("style", new RegExp(`${round.wheelRotationDegrees}deg`));
  }
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "choose-card", { timeout: 2_500 });
  await expect(page.getByTestId("wheel-workshop").getByText(record.glyph, { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-wheel-record-id]")).toHaveCount(0);
  await expect(page.locator("[data-wheel-card-id]")).toHaveCount(4);
  const renderedCardIds = await page.locator("[data-wheel-card-id]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-wheel-card-id")));
  expect(renderedCardIds).toEqual(round.candidateCards.map((card) => card.id));
  expect(renderedCardIds.join("|")).not.toContain(record.id);
  expect(renderedCardIds.join("|")).not.toMatch(/partner|distractor/);
  if (options.wrongFirst) {
    const wrong = round.candidateCards.find((card) => card.kind === "distractor")!;
    await activate(page, page.locator("[data-wheel-card-id]").filter({ hasText: wrong.glyph }).first(), mode);
    await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "choose-card");
    await expect(page.locator(".ww-message")).toContainText("还没找到自己的位置");
    await expect(page.locator(".ww-message")).not.toContainText(/失败|太差|又错|扣分|惩罚/);
  }
  for (let index = 0; index < (options.hints ?? 0); index += 1) await activate(page, page.locator('[data-action="wheel-hint"]'), mode);
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "choose-card");
  if ((options.hints ?? 0) >= 4) {
    const finalHint = page.locator(".ww-card.is-final-hint");
    await expect(finalHint).toHaveCount(1);
    await expect(finalHint).toContainText("伙伴提示");
    await expect(finalHint).toHaveAttribute("aria-label", /最终提示：伙伴部件/);
    await expect(finalHint).not.toHaveCSS("box-shadow", "none");
    if (options.reducedMotion) await expect(finalHint).toHaveCSS("animation-name", "none");
  }
  const partner = round.candidateCards.find((card) => card.kind === "partner")!;
  await activate(page, page.locator("[data-wheel-card-id]").filter({ hasText: partner.glyph }).first(), mode);
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "place-card");
  if (options.capturePlacement) await page.screenshot({ path: resolve(output, "wheel-structure-placement.png"), fullPage: true, animations: "disabled" });
  await activate(page, page.locator('[data-action="wheel-place-card"]'), mode);
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "success");
  await expect(page.getByTestId("wheel-success")).toContainText(record.glyph);
  const nextMemory = { session: [...memory.session, record.id], recent: [...memory.recent.filter((id) => id !== record.id), record.id].slice(-12) };
  return { record, memory: nextMemory };
}

async function expectWorkshopGeometry(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const workshop = document.querySelector<HTMLElement>("[data-testid=wheel-workshop]")!;
    const wheel = document.querySelector<HTMLElement>(".ww-wheel-wrap, .ww-structure, .ww-success")!;
    const undersized = [...workshop.querySelectorAll<HTMLElement>("button:not([disabled]), a")]
      .filter((element) => element.offsetParent !== null)
      .filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; })
      .map((element) => ({ label: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    return { viewportWidth, scrollWidth: document.documentElement.scrollWidth, workshopRight: workshop.getBoundingClientRect().right, wheelRight: wheel.getBoundingClientRect().right, undersized };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.workshopRight).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.wheelRight).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.undersized).toEqual([]);
}

test("sleeping camp entry is visible but locked until the existing magic-tree repair", async ({ page }) => {
  const logs = monitor(page);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=wheel-sleeping");
  const entry = page.getByTestId("wheel-workshop-entry");
  await expect(entry).toBeVisible();
  await expect(entry).toBeDisabled();
  await expect(entry).toHaveAttribute("data-wheel-state", "sleeping");
  await expect(page.locator("[data-repair-id]")).toHaveCount(8);
  await expect(page.getByTestId("chapter-one-m3-camp")).toHaveAttribute("data-repair-count", "0");
  if (test.info().project.name === "desktop-chromium") await page.screenshot({ path: resolve(output, "camp-entry.png"), fullPage: true, animations: "disabled" });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], failedResources: [], externalRequests: [] });
});

test("mouse play keeps the answer hidden, gives gentle hints, completes three real placements, saves, and returns to camp", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page); const seed = "wheel-three-mouse"; const legacySpinKey = "family-games/hanzi-wheel/progress"; const legacySpinValue = JSON.stringify({ spins: 17 });
  await inject(page, [[legacySpinKey, legacySpinValue]]);
  await openWorkshop(page, seed);
  await page.locator('[data-action="wheel-open-grade-select"]').click();
  await page.screenshot({ path: resolve(output, "wheel-grade-select.png"), fullPage: true, animations: "disabled" });
  await page.locator('[data-action="wheel-close-grade-select"]').click();
  let memory: RoundMemory = { session: [], recent: [] };
  await page.locator('[data-action="wheel-spin"]').click();
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-phase", "spinning");
  await page.screenshot({ path: resolve(output, "wheel-spin.png"), fullPage: true });
  // Reload the deterministic first round through the normal safe close/open path.
  await page.locator('[data-action="close-overlay"]').click();
  await page.getByTestId("wheel-workshop-entry").click();
  for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
    const solved = await solveRound(page, seed, "p1", roundIndex, memory, "mouse", { wrongFirst: roundIndex === 0, hints: roundIndex === 0 ? 4 : 0, capturePlacement: roundIndex === 0 });
    memory = solved.memory;
    if (roundIndex === 0) {
      await page.locator('[data-action="wheel-speak-word"]').click();
      await page.screenshot({ path: resolve(output, "wheel-success.png"), fullPage: true, animations: "disabled" });
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WHEEL_WORKSHOP_SAVE_KEY);
      expect(saved.discoveredRecordIds).toContain(solved.record.id);
      expect(Object.keys(saved).sort()).toEqual(["contentRevision", "discoveredRecordIds", "lastSafeState", "recentRecordIds", "schemaVersion", "selectedGradeId"]);
      expect(JSON.stringify(saved)).not.toMatch(/name|age|school|keypress|score|streak|rank|accuracy|errorCount/i);
    }
    await page.locator('[data-action="wheel-continue"]').click();
  }
  await expect(page.getByTestId("wheel-session-finished")).toBeVisible();
  await expect(page.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-round-count", "3");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("chapter-one-m3-camp")).toBeVisible();
  await expect(page.getByTestId("wheel-workshop-entry")).toBeFocused();
  await page.locator('[data-action="open-spellbook"]').click();
  await expect(page.getByTestId("chapter-one-spellbook")).toHaveAttribute("data-total-entries", "36");
  await page.locator('[data-action="close-overlay"]').click();
  await page.locator('[data-action="start-run"]').click();
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-phase", "route-choice");
  expect(await page.evaluate((key) => localStorage.getItem(key), legacySpinKey)).toBe(legacySpinValue);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], failedResources: [], externalRequests: [] });
});

test("keyboard-only completes a round with visible focus and reduced motion preserves the same landing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page); const seed = "wheel-keyboard";
  await openWorkshop(page, seed, "keyboard", "p2");
  await page.locator('[data-pref="reduced-motion"]').focus(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-reduced-motion", "true");
  const dialog = page.getByTestId("wheel-workshop");
  const dialogButtons = dialog.locator('button:not([disabled])');
  await dialogButtons.last().focus(); await page.keyboard.press("Tab");
  await expect(dialogButtons.first()).toBeFocused();
  await dialogButtons.first().focus(); await page.keyboard.press("Shift+Tab");
  await expect(dialogButtons.last()).toBeFocused();
  await expect(page.locator("header :focus, footer :focus")).toHaveCount(0);
  const solved = await solveRound(page, seed, "p2", 0, { session: [], recent: [] }, "keyboard", { reducedMotion: true, hints: 4 });
  await expect(page.getByTestId("wheel-success")).toContainText(solved.record.glyph);
  await expect(page.locator(":focus")).toBeVisible();
  await expect(page.locator(".ww-success-glyph")).toHaveCSS("animation-name", "none");
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], failedResources: [], externalRequests: [] });
});

test("touch pointer completes a round at 390x844 without overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch"); const logs = monitor(page); const seed = "wheel-touch";
  await openWorkshop(page, seed, "touch", "p3");
  const solved = await solveRound(page, seed, "p3", 0, { session: [], recent: [] }, "touch");
  await expect(page.getByTestId("wheel-success")).toContainText(solved.record.glyph);
  await expectWorkshopGeometry(page);
  await page.screenshot({ path: resolve(output, "mobile.png"), fullPage: true, animations: "disabled" });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], failedResources: [], externalRequests: [] });
});

test("refresh restores safe discovery, corrupt saves recover, and newer saves remain byte-preserved", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const seed = "wheel-resume";
  await openWorkshop(page, seed, "mouse", "p4");
  const solved = await solveRound(page, seed, "p4", 0, { session: [], recent: [] }, "mouse");
  const discoveredBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).discoveredRecordIds, WHEEL_WORKSHOP_SAVE_KEY);
  await page.reload();
  await expect(page.getByTestId("chapter-one-m3-camp")).toBeVisible();
  await page.getByTestId("wheel-workshop-entry").click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).discoveredRecordIds, WHEEL_WORKSHOP_SAVE_KEY)).toEqual(discoveredBefore);
  expect(discoveredBefore).toContain(solved.record.id);

  const corruptPage = await page.context().newPage();
  await inject(corruptPage, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullCampSave())], [WHEEL_WORKSHOP_SAVE_KEY, "{broken"]]);
  await corruptPage.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=wheel-corrupt");
  await corruptPage.getByTestId("wheel-workshop-entry").click();
  await expect(corruptPage.locator(".ww-save-note")).toContainText("安全恢复");
  expect(await corruptPage.evaluate((key) => JSON.parse(localStorage.getItem(key)!).schemaVersion, WHEEL_WORKSHOP_SAVE_KEY)).toBe(1);
  await corruptPage.close();

  const futureRaw = JSON.stringify({ schemaVersion: 99, futureField: "keep-me" });
  const futurePage = await page.context().newPage();
  await inject(futurePage, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(fullCampSave())], [WHEEL_WORKSHOP_SAVE_KEY, futureRaw]]);
  await futurePage.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=wheel-future");
  await futurePage.getByTestId("wheel-workshop-entry").click();
  await expect(futurePage.getByTestId("wheel-workshop")).toHaveAttribute("data-wheel-read-only", "true");
  await futurePage.locator('[data-action="wheel-spin"]').click();
  expect(await futurePage.evaluate((key) => localStorage.getItem(key), WHEEL_WORKSHOP_SAVE_KEY)).toBe(futureRaw);
  await futurePage.close();
});

test("all playable target and component glyphs render as distinct ink rather than a shared missing-glyph box", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await openWorkshop(page, "wheel-font", "mouse", "j3");
  const glyphs = [...new Set(PLAYABLE_WHEEL_MANIFEST.flatMap((record) => [record.glyph, ...record.orderedComponents]))];
  const signatures = await page.evaluate((values) => values.map((glyph) => {
    const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
    const context = canvas.getContext("2d")!; context.fillStyle = "#fff"; context.fillRect(0, 0, 96, 96); context.fillStyle = "#000"; context.font = '72px "KaiTi", "STKaiti", serif'; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(glyph, 48, 49);
    const pixels = context.getImageData(0, 0, 96, 96).data; let ink = 0; let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 4) { const value = pixels[index]; if (value < 245) ink += 1; hash ^= value; hash = Math.imul(hash, 16777619); }
    return { glyph, ink, hash: hash >>> 0, width: context.measureText(glyph).width };
  }), glyphs);
  expect(signatures.every((entry) => entry.ink > 80 && entry.width > 20)).toBe(true);
  expect(new Set(signatures.map((entry) => `${entry.hash}:${entry.ink}`)).size).toBe(glyphs.length);
});

test("workshop remains usable at all required viewports and the classic hub has four active-product cards without a standalone wheel", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
    const context = await (browser as Browser).newContext({ viewport }); const page = await context.newPage();
    await openWorkshop(page, `wheel-viewport-${viewport.width}`, "mouse", "p6");
    await expectWorkshopGeometry(page);
    await context.close();
  }
  const context = await (browser as Browser).newContext({ viewport: { width: 1280, height: 720 } }); const page = await context.newPage();
  await page.goto("/?hub=classic");
  await expect(page.locator(".game-card")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "汉字大转盘" })).toHaveCount(0);
  await expect(page.locator(".game-card--ink-forest")).toBeVisible();
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=wheel-hub-v2");
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toBeVisible();
  await context.close();
});

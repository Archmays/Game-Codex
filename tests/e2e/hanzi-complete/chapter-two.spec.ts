import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { createFreshCompleteSave, updateCompleteSave } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save-schema";

const output = resolve("test-results/hanzi-complete/chapter-two");
mkdirSync(output, { recursive: true });

type InputMode = "mouse" | "touch" | "keyboard";

function monitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/i.test(url) && new URL(url).hostname !== "127.0.0.1") externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function seedUnlockedSave(page: Page) {
  const save = updateCompleteSave(createFreshCompleteSave(), {
    unlockedChapterIds: ["chapter-one", "chapter-two"],
    chapterTwoReplay: { seed: "chapter-two-browser", initialHeroId: "light-speaker", actions: [] },
    activeResume: { screen: "world", chapterId: "chapter-two", episodeId: null, phase: "world", seed: "component-roots-return", actionCount: 0 },
  });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, {
    key: HANZI_MAGIC_COMPLETE_SAVE_KEY,
    value: JSON.stringify(save),
  });
}

async function gotoFreshChapterTwo(page: Page) {
  await seedUnlockedSave(page);
  // Exercise the unchanged unversioned replay route; the pilot has its own suite.
  await page.goto("/?play=hanzi-magic-complete&from=hub&chapter=two&seed=chapter-two-browser");
  await expect(page.getByTestId("hanzi-complete-chapter-two")).toHaveAttribute("data-phase", "chapter-intro");
  await expect(page.getByTestId("chapter-two-intro")).toBeVisible();
}

async function solveBuild(page: Page, mode: InputMode, options: { drag?: boolean; rejectWrong?: boolean } = {}) {
  const shell = page.getByTestId("hanzi-complete-chapter-two");
  await expect(shell).toHaveAttribute("data-phase", "build");
  const characterId = await shell.getAttribute("data-current-character-id");
  const target = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId);
  if (!target) throw new Error(`Unknown Chapter Two character ${characterId}`);

  if (options.rejectWrong && target.components.length > 1) {
    const card = page.locator(`[data-card-id="${target.id}-target-${target.components[0].order}"]`);
    const wrongSlot = page.locator(`[data-slot-id="${target.components[1].slotId}"]`);
    await activate(page, card, mode);
    await activate(page, wrongSlot, mode);
    await expect(page.getByRole("status")).toContainText("不住在这里");
    await expect(shell.locator(".hmc2-slot.is-filled")).toHaveCount(0);
  }

  for (const component of target.components) {
    const card = page.locator(`[data-card-id="${target.id}-target-${component.order}"]`);
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (options.drag && mode === "mouse") await card.dragTo(slot);
    else { await activate(page, card, mode); await activate(page, slot, mode); }
  }
  await expect(shell).toHaveAttribute("data-phase", "composition");
}

async function assertGeometry(page: Page) {
  const result = await page.evaluate(() => {
    const visibleControls = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      undersized: visibleControls.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  expect(result.undersized).toEqual([]);
}

async function completeChapterTwo(page: Page, mode: InputMode, options: { dragFirst?: boolean; reloadAfterFirst?: boolean; capture?: boolean } = {}) {
  const shell = page.getByTestId("hanzi-complete-chapter-two");
  let buildCount = 0;
  let capturedBoss = false;
  let capturedEnclosure = false;
  let capturedRepair = false;
  for (let guard = 0; guard < 260; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "chapter-summary") return;
    if (phase === "chapter-intro") await activate(page, page.locator('[data-action="start"]'), mode);
    else if (phase === "ability-choice") await activate(page, page.locator("[data-ability-id]").first(), mode);
    else if (phase === "behavior-telegraph") {
      if (options.capture && !capturedBoss && await page.getByTestId("chapter-two-behavior").getAttribute("data-boss-id") !== "none") {
        await page.screenshot({ path: resolve(output, "chapter-two-boss-telegraph.png"), fullPage: true });
        capturedBoss = true;
      }
      await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    } else if (phase === "behavior-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "build") {
      if (options.capture && !capturedEnclosure && (await page.getByTestId("chapter-two-build").getAttribute("data-structure"))?.includes("enclosure")) {
        await page.screenshot({ path: resolve(output, "chapter-two-enclosure-board.png"), fullPage: true });
        capturedEnclosure = true;
      }
      await solveBuild(page, mode, { drag: options.dragFirst && buildCount === 0, rejectWrong: buildCount === 0 });
      buildCount += 1;
      if (options.reloadAfterFirst && buildCount === 1) {
        const actionCount = await shell.getAttribute("data-action-count");
        await page.reload();
        await expect(shell).toHaveAttribute("data-phase", "composition");
        await expect(shell).toHaveAttribute("data-action-count", actionCount!);
      }
    } else if (["composition", "meaning", "family-inspect", "family-result", "episode-complete"].includes(String(phase))) {
      await activate(page, page.locator('[data-action="continue"]'), mode);
    } else if (phase === "family-connect") {
      await activate(page, page.locator("[data-family-character-id]").nth(0), mode);
      await activate(page, page.locator("[data-family-character-id]").nth(1), mode);
      await activate(page, page.locator('[data-action="connect-family"]'), mode);
    } else if (phase === "episode-repair") {
      if (options.capture && !capturedRepair) {
        await page.screenshot({ path: resolve(output, "chapter-two-repair.png"), fullPage: true });
        capturedRepair = true;
      }
      await activate(page, page.locator('[data-action="continue"]'), mode);
    } else if (phase === "core-intro") await activate(page, page.locator('[data-action="start-core"]'), mode);
    else if (phase === "ending") await activate(page, page.locator('[data-action="finish-ending"]'), mode);
    else throw new Error(`Unexpected Chapter Two phase ${phase}`);
  }
  throw new Error("Chapter Two browser playthrough exceeded action guard");
}

test("Chapter Two completes with mouse, drag fallback, wrong-answer recovery and exact reload resume", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(90_000);
  const logs = monitor(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await gotoFreshChapterTwo(page);
  await completeChapterTwo(page, "mouse", { dragFirst: true, reloadAfterFirst: true, capture: true });
  const shell = page.getByTestId("hanzi-complete-chapter-two");
  await expect(page.getByTestId("chapter-two-summary")).toContainText("没有分数、排名、连胜或全收集门槛");
  await expect(shell).toHaveAttribute("data-discovered-count", "12");
  await expect(shell).toHaveAttribute("data-family-count", "12");
  await expect(shell).toHaveAttribute("data-repair-count", "4");
  await expect(shell).toHaveAttribute("data-boss-count", "4");
  await expect(shell).toHaveAttribute("data-selected-ability-count", "3");
  await expect(shell).toHaveAttribute("data-triggered-ability-count", "3");
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), HANZI_MAGIC_COMPLETE_SAVE_KEY);
  expect(persisted.completedChapterIds).toContain("chapter-two");
  expect(persisted.unlockedChapterIds).toContain("chapter-three");
  expect(persisted.chapterTwoReplay.actions).toHaveLength(Number(await shell.getAttribute("data-action-count")));
  await assertGeometry(page);
  await page.screenshot({ path: resolve(output, "chapter-two-mouse-complete.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("Chapter Two completes keyboard-only with visible focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFreshChapterTwo(page);
  await completeChapterTwo(page, "keyboard");
  await expect(page.locator(":focus")).toBeVisible();
  await assertGeometry(page);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("Chapter Two completes by touch at 360x800 with mute and reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch");
  const logs = monitor(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoFreshChapterTwo(page);
  await page.locator('[data-pref="muted"]').tap();
  await page.locator('[data-pref="reduced-motion"]').tap();
  await expect(page.getByTestId("hanzi-complete-chapter-two")).toHaveAttribute("data-muted", "true");
  await expect(page.getByTestId("hanzi-complete-chapter-two")).toHaveAttribute("data-reduced-motion", "true");
  await completeChapterTwo(page, "touch");
  const duration = await page.locator(".hmc2-world i").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.0011);
  await assertGeometry(page);
  await page.screenshot({ path: resolve(output, "chapter-two-touch-complete.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("locked Chapter Two direct route preserves progress and offers a safe way back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await page.goto("/?play=hanzi-magic-complete&from=hub&chapter=two");
  await expect(page.getByTestId("chapter-two-locked")).toContainText("先完成第一章");
  await expect(page.getByTestId("chapter-two-locked").getByRole("link")).toHaveCount(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBeNull();
  await assertGeometry(page);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

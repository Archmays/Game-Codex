import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CHAPTER_THREE_OPTIONAL_CHARACTER_IDS } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-three/contracts";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_WORD_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/words";
import { createFreshCompleteSave, updateCompleteSave } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save-schema";

const output = resolve("test-results/hanzi-complete/chapter-three");
mkdirSync(output, { recursive: true });
type InputMode = "mouse" | "touch" | "keyboard";

function monitor(page: Page) {
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { const url = request.url(); if (/^https?:/i.test(url) && new URL(url).hostname !== "127.0.0.1") externalRequests.push(url); });
  return { consoleErrors, pageErrors, externalRequests };
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function seedUnlockedSave(page: Page) {
  const save = updateCompleteSave(createFreshCompleteSave(), {
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedChapterIds: ["chapter-one", "chapter-two"],
    activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "word-light-return", actionCount: 0 },
  });
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(save) });
}

async function gotoFreshChapterThree(page: Page) {
  await seedUnlockedSave(page);
  await page.goto("/?play=hanzi-magic-complete&from=hub&chapter=three&fresh=1&seed=chapter-three-browser");
  await expect(page.getByTestId("hanzi-complete-chapter-three")).toHaveAttribute("data-phase", "chapter-intro");
  await expect(page.getByTestId("chapter-three-intro")).toBeVisible();
}

async function solveBuild(page: Page, mode: InputMode, options: { drag?: boolean; rejectWrong?: boolean } = {}) {
  const shell = page.getByTestId("hanzi-complete-chapter-three");
  const build = page.getByTestId("chapter-three-build");
  const characterId = await shell.getAttribute("data-current-character-id");
  const target = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId);
  if (!target) throw new Error(`Unknown Chapter Three character ${characterId}`);
  if (options.rejectWrong && target.components.length > 1) {
    const card = page.locator(`[data-card-id="${target.id}-target-${target.components[0].order}"]`);
    const wrongSlot = page.locator(`[data-slot-id="${target.components[1].slotId}"]`);
    await activate(page, card, mode); await activate(page, wrongSlot, mode);
    await expect(page.getByRole("status")).toContainText("不住在这里");
    await expect(build.locator(".hmc3-slot.is-filled")).toHaveCount(0);
  }
  for (const component of target.components) {
    const card = page.locator(`[data-card-id="${target.id}-target-${component.order}"]`);
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (options.drag && mode === "mouse") await card.dragTo(slot);
    else { await activate(page, card, mode); await activate(page, slot, mode); }
  }
  await expect(shell).toHaveAttribute("data-phase", /meaning/);
}

async function assertGeometry(page: Page) {
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => {
      const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      undersized: controls.filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  expect(result.undersized).toEqual([]);
}

async function completeChapterThree(page: Page, mode: InputMode, options: { dragFirst?: boolean; reloadAfterFirstWord?: boolean; capture?: boolean } = {}) {
  const shell = page.getByTestId("hanzi-complete-chapter-three");
  let buildCount = 0; let wordCount = 0; let reversedOnce = false; let wrongFamilyOnce = false;
  const captured = new Set<string>();
  for (let guard = 0; guard < 380; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "chapter-summary") return;
    if (phase === "chapter-intro") await activate(page, page.locator('[data-action="start"]'), mode);
    else if (phase === "ability-choice") await activate(page, page.locator("[data-ability-id]").first(), mode);
    else if (phase === "behavior-telegraph") {
      if (options.capture && !captured.has("boss") && await page.getByTestId("chapter-three-behavior").getAttribute("data-boss-id") !== "none") { await page.screenshot({ path: resolve(output, "chapter-three-boss.png"), fullPage: true }); captured.add("boss"); }
      await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    } else if (phase === "behavior-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (["discovery-build", "word-build-a", "word-build-b"].includes(String(phase))) {
      await solveBuild(page, mode, { drag: options.dragFirst && buildCount === 0, rejectWrong: buildCount === 0 }); buildCount += 1;
    } else if (["discovery-meaning", "word-meaning-a", "word-meaning-b", "word-result", "world-effect", "episode-complete", "epilogue-forest", "epilogue-companions", "epilogue-home"].includes(String(phase))) {
      if (phase === "word-result") await expect(page.getByTestId("chapter-three-word-result")).not.toContainText("教育部辞典");
      if (options.capture && phase === "word-result" && !captured.has("word")) { await page.screenshot({ path: resolve(output, "chapter-three-word-result.png"), fullPage: true }); captured.add("word"); }
      if (options.capture && phase === "world-effect" && !captured.has("effect")) { await page.screenshot({ path: resolve(output, "chapter-three-world-effect.png"), fullPage: true }); captured.add("effect"); }
      if (options.capture && phase === "epilogue-forest" && !captured.has("epilogue")) { await page.screenshot({ path: resolve(output, "chapter-three-epilogue.png"), fullPage: true }); captured.add("epilogue"); }
      await activate(page, page.locator('[data-action="continue"]'), mode);
    } else if (phase === "word-order") {
      const wordId = await shell.getAttribute("data-current-word-id"); const target = COMPLETE_WORD_NODES.find((candidate) => candidate.id === wordId);
      if (!target) throw new Error(`Unknown word ${wordId}`);
      if (!reversedOnce) {
        await activate(page, page.locator(`[data-word-character-id="${target.characterIds[1]}"]`), mode);
        await activate(page, page.locator(`[data-word-character-id="${target.characterIds[0]}"]`), mode);
        await expect(page.getByRole("status")).toContainText(`不读“${target.glyphs.join("")}”`); reversedOnce = true;
      }
      await activate(page, page.locator(`[data-word-character-id="${target.characterIds[0]}"]`), mode);
      await activate(page, page.locator(`[data-word-character-id="${target.characterIds[1]}"]`), mode);
      wordCount += 1;
      if (options.reloadAfterFirstWord && wordCount === 1) {
        const count = await shell.getAttribute("data-action-count"); const currentWordId = await shell.getAttribute("data-current-word-id");
        await page.reload();
        await expect(shell).toHaveAttribute("data-phase", "word-result");
        await expect(shell).toHaveAttribute("data-action-count", count!);
        await expect(shell).toHaveAttribute("data-current-word-id", currentWordId!);
      }
    } else if (phase === "core-family") {
      const panel = page.getByTestId("chapter-three-core-family"); const expected = await panel.getAttribute("data-expected-family-id");
      if (!wrongFamilyOnce) {
        await activate(page, page.locator(`[data-core-family-id]:not([data-core-family-id="${expected}"])`).first(), mode);
        await expect(page.getByRole("status")).toContainText("不属于"); wrongFamilyOnce = true;
      }
      await activate(page, page.locator(`[data-core-family-id="${expected}"]`), mode);
      if (options.capture && !captured.has("core")) { await page.screenshot({ path: resolve(output, "chapter-three-core-word-order.png"), fullPage: true }); captured.add("core"); }
    } else if (phase === "episode-repair") {
      if (options.capture && !captured.has("repair")) { await page.screenshot({ path: resolve(output, "chapter-three-repair.png"), fullPage: true }); captured.add("repair"); }
      await activate(page, page.locator('[data-action="continue"]'), mode);
    } else if (phase === "core-intro") await activate(page, page.locator('[data-action="start-core"]'), mode);
    else if (phase === "ending") await activate(page, page.locator('[data-action="finish-ending"]'), mode);
    else throw new Error(`Unexpected Chapter Three phase ${phase}`);
  }
  throw new Error("Chapter Three browser playthrough exceeded action guard");
}

test("Chapter Three and epilogue complete with mouse, drag, reversible errors and exact resume", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); test.slow();
  const logs = monitor(page); await page.setViewportSize({ width: 1600, height: 900 }); await gotoFreshChapterThree(page);
  await completeChapterThree(page, "mouse", { dragFirst: true, reloadAfterFirstWord: true, capture: true });
  const shell = page.getByTestId("hanzi-complete-chapter-three");
  await expect(page.getByTestId("chapter-three-summary")).toContainText("不需要 72/72");
  await expect(shell).toHaveAttribute("data-story-new-count", "12"); await expect(shell).toHaveAttribute("data-word-count", "12");
  await expect(shell).toHaveAttribute("data-repair-count", "4"); await expect(shell).toHaveAttribute("data-boss-count", "4");
  await expect(shell).toHaveAttribute("data-selected-ability-count", "3"); await expect(shell).toHaveAttribute("data-triggered-ability-count", "3");
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), HANZI_MAGIC_COMPLETE_SAVE_KEY);
  expect(persisted.completedChapterIds).toContain("chapter-three");
  expect(persisted.chapterThreeReplay.actions).toHaveLength(Number(await shell.getAttribute("data-action-count")));
  expect(CHAPTER_THREE_OPTIONAL_CHARACTER_IDS.some((id) => persisted.discoveredCharacterIds.includes(id))).toBe(false);
  await assertGeometry(page); await page.screenshot({ path: resolve(output, "chapter-three-mouse-complete.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("Chapter Three and epilogue complete keyboard-only with visible focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); test.slow();
  const logs = monitor(page); await gotoFreshChapterThree(page); await completeChapterThree(page, "keyboard");
  await expect(page.locator(":focus")).toBeVisible(); await assertGeometry(page);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("Chapter Three and epilogue complete by touch at 360x800 with mute and reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch"); test.slow();
  const logs = monitor(page); await page.setViewportSize({ width: 360, height: 800 }); await gotoFreshChapterThree(page);
  await page.locator('[data-pref="muted"]').tap(); await page.locator('[data-pref="reduced-motion"]').tap();
  await completeChapterThree(page, "touch");
  const shell = page.getByTestId("hanzi-complete-chapter-three");
  await expect(shell).toHaveAttribute("data-muted", "true"); await expect(shell).toHaveAttribute("data-reduced-motion", "true");
  const duration = await page.locator(".hmc3-world i").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(.0011); await assertGeometry(page);
  await page.screenshot({ path: resolve(output, "chapter-three-touch-complete.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("locked Chapter Three direct route preserves progress and provides safe return links", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page); await page.goto("/?play=hanzi-magic-complete&from=hub&chapter=three");
  await expect(page.getByTestId("chapter-three-locked")).toContainText("先完成第二章");
  await expect(page.getByTestId("chapter-three-locked").getByRole("link")).toHaveCount(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBeNull();
  await assertGeometry(page); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

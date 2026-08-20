import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getCompleteSliceCharacter, getCompleteSliceWord } from "../../../games/hanzi-radical-battle/complete/content-graph/slice-content";

const output = resolve("test-results/hanzi-complete/slices");
mkdirSync(output, { recursive: true });

type InputMode = "mouse" | "touch" | "keyboard";
type SliceId = "family" | "word";

function monitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/i.test(url) && new URL(url).origin !== "http://127.0.0.1:5194") externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function gotoFresh(page: Page, sliceId: SliceId) {
  await page.goto(`/?play=hanzi-magic-complete&from=hub&slice=${sliceId}&fresh=1`);
  await expect(page.getByTestId("hanzi-complete-slice")).toHaveAttribute("data-phase", "world");
  await expect(page.getByTestId("complete-slice-world")).toBeVisible();
}

async function solveBuild(page: Page, mode: InputMode, drag = false) {
  const shell = page.getByTestId("hanzi-complete-slice");
  await expect(shell).toHaveAttribute("data-phase", "build");
  const characterId = await shell.getAttribute("data-current-character-id");
  if (!characterId) throw new Error("missing current character id");
  const character = getCompleteSliceCharacter(characterId);
  for (const component of character.components) {
    const card = page.locator(`[data-card-id="${character.id}-target-${component.order}"]`);
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (drag && mode === "mouse") await card.dragTo(slot);
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
      headings: document.querySelectorAll("h1, h2").length,
    };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
  expect(result.undersized).toEqual([]);
  expect(result.headings).toBeGreaterThanOrEqual(2);
}

async function completeFamily(page: Page, mode: InputMode, dragFirst = false, reloadAfterFirst = false) {
  const shell = page.getByTestId("hanzi-complete-slice");
  let buildCount = 0;
  for (let guard = 0; guard < 100; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "complete") return;
    if (phase === "world") await activate(page, page.locator('[data-action="start"]'), mode);
    else if (phase === "behavior-telegraph" || phase === "boss-telegraph") await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    else if (phase === "behavior-effect" || phase === "boss-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "build") {
      await solveBuild(page, mode, dragFirst && buildCount === 0);
      buildCount += 1;
      if (reloadAfterFirst && buildCount === 1) {
        const count = await shell.getAttribute("data-action-count");
        await page.reload();
        await expect(shell).toHaveAttribute("data-phase", "composition");
        await expect(shell).toHaveAttribute("data-action-count", count!);
      }
    } else if (["composition", "meaning", "family-inspect", "family-result", "repair"].includes(String(phase))) {
      if (phase === "family-result" && mode === "mouse") await page.screenshot({ path: resolve(output, "family-relation-desktop.png"), fullPage: true });
      await activate(page, page.locator('[data-action="continue"]'), mode);
    } else if (phase === "family-connect") {
      await activate(page, page.locator("[data-family-character-id]").nth(0), mode);
      await activate(page, page.locator("[data-family-character-id]").nth(2), mode);
      await activate(page, page.locator('[data-action="connect-family"]'), mode);
    } else throw new Error(`unexpected family phase ${phase}`);
  }
  throw new Error("family slice exceeded action guard");
}

async function completeWord(page: Page, mode: InputMode, reloadAfterFirst = false) {
  const shell = page.getByTestId("hanzi-complete-slice");
  let buildCount = 0;
  for (let guard = 0; guard < 130; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "complete") return;
    if (phase === "world") await activate(page, page.locator('[data-action="start"]'), mode);
    else if (phase === "boss-telegraph") await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    else if (phase === "boss-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "build") {
      await solveBuild(page, mode);
      buildCount += 1;
      if (reloadAfterFirst && buildCount === 1) {
        const count = await shell.getAttribute("data-action-count");
        await page.reload();
        await expect(shell).toHaveAttribute("data-phase", "composition");
        await expect(shell).toHaveAttribute("data-action-count", count!);
      }
    } else if (phase === "composition" || phase === "meaning" || phase === "word-meaning" || phase === "repair") await activate(page, page.locator('[data-action="continue"]'), mode);
    else if (phase === "word-order") {
      const wordId = await shell.getAttribute("data-current-word-id");
      if (!wordId) throw new Error("word-order missing word id");
      const word = getCompleteSliceWord(wordId);
      await activate(page, page.locator(`[data-word-character-id="${word.characterIds[1]}"]`), mode);
      await activate(page, page.locator(`[data-word-character-id="${word.characterIds[0]}"]`), mode);
      await expect(page.locator(".hmc-order-status")).toContainText(`要读“${word.glyphs.join("")}”`);
      if (mode === "mouse" && word.id === "word-flower-fragrance") await page.screenshot({ path: resolve(output, "word-reverse-rejection-desktop.png"), fullPage: true });
      await activate(page, page.locator(`[data-word-character-id="${word.characterIds[0]}"]`), mode);
      await activate(page, page.locator(`[data-word-character-id="${word.characterIds[1]}"]`), mode);
      await expect(shell).toHaveAttribute("data-phase", "word-meaning");
      if (mode === "mouse" && word.id === "word-flower-fragrance") await page.screenshot({ path: resolve(output, "word-resonance-desktop.png"), fullPage: true });
    } else throw new Error(`unexpected word phase ${phase}`);
  }
  throw new Error("word slice exceeded action guard");
}

for (const sliceId of ["family", "word"] as const) {
  test(`${sliceId} slice completes with mouse, resumes after reload and has representative local art`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    const logs = monitor(page);
    await gotoFresh(page, sliceId);
    const sceneBackground = await page.locator(".hmc-scene").evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(sceneBackground).toContain("/assets/hanzi-radical-battle/v2/");
    if (sliceId === "family") await completeFamily(page, "mouse", true, true);
    else await completeWord(page, "mouse", true);
    await expect(page.getByTestId("complete-slice-summary")).toContainText("没有分数、排名、连胜或进度损失");
    await expect(page.getByTestId("hanzi-complete-slice")).toHaveAttribute("data-repaired", "true");
    await assertGeometry(page);
    await page.screenshot({ path: resolve(output, `${sliceId}-mouse-complete.png`), fullPage: true });
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test(`${sliceId} slice completes keyboard-only with visible focus`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    const logs = monitor(page);
    await gotoFresh(page, sliceId);
    if (sliceId === "family") await completeFamily(page, "keyboard");
    else await completeWord(page, "keyboard");
    await expect(page.locator(":focus")).toBeVisible();
    await assertGeometry(page);
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test(`${sliceId} slice completes by touch at 390x844 with mute and reduced motion`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-touch");
    const logs = monitor(page);
    await gotoFresh(page, sliceId);
    await page.locator('[data-pref="muted"]').tap();
    await page.locator('[data-pref="reduced-motion"]').tap();
    await expect(page.getByTestId("hanzi-complete-slice")).toHaveAttribute("data-muted", "true");
    await expect(page.getByTestId("hanzi-complete-slice")).toHaveAttribute("data-reduced-motion", "true");
    if (sliceId === "family") await completeFamily(page, "touch");
    else await completeWord(page, "touch");
    const animationDurationSeconds = await page.locator(".hmc-scene i").first().evaluate((element) => {
      const value = getComputedStyle(element).animationDuration;
      return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
    });
    expect(animationDurationSeconds).toBeLessThanOrEqual(0.0000011);
    await assertGeometry(page);
    await page.screenshot({ path: resolve(output, `${sliceId}-touch-complete.png`), fullPage: true });
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });
}

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { getV1Character } from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";

const output = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M1/screenshots");
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
    if (!/^https?:/i.test(url)) return;
    if (new URL(url).origin !== "http://127.0.0.1:5183") externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function gotoFresh(page: Page, seed: string) {
  await page.goto(`/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=${encodeURIComponent(seed)}`);
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-phase", "camp");
}

async function activate(page: Page, locator: ReturnType<Page["locator"]>, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function placeComponents(page: Page, mode: InputMode, useDrag = false) {
  const encounter = page.getByTestId("chapter-one-encounter");
  const characterId = await encounter.getAttribute("data-character-id");
  if (!characterId) throw new Error("encounter missing character identity");
  const character = getV1Character(characterId as Parameters<typeof getV1Character>[0]);
  const enclosure = character.structure === "full-enclosure" || character.structure === "semi-enclosure";
  if (enclosure) await expect(page.locator('[data-slot-id="inner"]')).toBeDisabled();
  for (const component of character.components) {
    const card = page.locator(`[data-card-id="${component.id}"]`);
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (useDrag && mode === "mouse") await card.dragTo(slot);
    else { await activate(page, card, mode); await activate(page, slot, mode); }
    if (enclosure && component.slotId === "outer") await expect(page.locator('[data-slot-id="inner"]')).toBeEnabled();
  }
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-phase", "composition");
}

async function completeRun(page: Page, mode: InputMode, options: { drag?: boolean; captureAbility?: string } = {}) {
  const shell = page.getByTestId("hanzi-magic-chapter-one");
  for (let guard = 0; guard < 180; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "run-summary") return;
    if (phase === "camp") await activate(page, page.locator('[data-action="start-run"]'), mode);
    else if (phase === "route-choice") await activate(page, page.locator('[data-action="choose-route"]').first(), mode);
    else if (phase === "behavior-telegraph") await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    else if (phase === "behavior-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "encounter") await placeComponents(page, mode, options.drag === true);
    else if (phase === "composition" || phase === "meaning" || phase === "region-complete") await activate(page, page.locator('[data-action="continue"]'), mode);
    else if (phase === "ability-choice") {
      if (options.captureAbility) await page.screenshot({ path: resolve(output, options.captureAbility), fullPage: true });
      await activate(page, page.locator('[data-action="choose-ability"]').first(), mode);
    } else throw new Error(`unexpected M1 phase: ${phase}`);
  }
  throw new Error("M1 run exceeded browser action guard");
}

async function expectGeometry(page: Page) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.undersized).toEqual([]);
}

test("M1-P1 mouse drag completes a deterministic run", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFresh(page, "browser-mouse");
  await page.screenshot({ path: resolve(output, "M1-P1-fresh-camp.png"), fullPage: true });
  await completeRun(page, "mouse", { drag: true, captureAbility: "M1-P1-ability-choice.png" });
  await expect(page.getByTestId("chapter-one-run-summary")).toContainText("三片区域都亮了");
  await expect(page.getByTestId("chapter-one-run-summary")).not.toContainText(/分数：|排名：|正确率|连胜/);
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, "M1-P1-summary.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M1-P2 touch completes the same answer-safe loop on 390x844", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch");
  const logs = monitor(page);
  await gotoFresh(page, "browser-touch");
  await completeRun(page, "touch");
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, "M1-P2-touch-summary.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M1-P3 keyboard-only completes with visible focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFresh(page, "browser-keyboard");
  await completeRun(page, "keyboard");
  await expect(page.locator(":focus")).toBeVisible();
  await expectGeometry(page);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M1-P4 muted and reduced-motion preserve the complete outcome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFresh(page, "browser-calm");
  await page.locator('[data-pref="muted"]').click();
  await page.locator('[data-pref="reduced-motion"]').click();
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-muted", "true");
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-reduced-motion", "true");
  await completeRun(page, "mouse");
  await page.screenshot({ path: resolve(output, "M1-P4-muted-reduced-summary.png"), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M1-P5 reload resumes from replay actions and completes identically", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFresh(page, "browser-resume");
  await page.locator('[data-action="start-run"]').click();
  await page.locator('[data-action="choose-route"]').nth(1).click();
  await page.locator('[data-action="begin-behavior"]').click();
  await page.locator('[data-action="recover-behavior"]').click();
  await placeComponents(page, "mouse");
  const before = await page.getByTestId("hanzi-magic-chapter-one").getAttribute("data-action-count");
  await page.reload();
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-phase", "composition");
  await expect(page.getByTestId("hanzi-magic-chapter-one")).toHaveAttribute("data-action-count", before!);
  await page.screenshot({ path: resolve(output, "M1-P5-resumed-composition.png"), fullPage: true });
  await completeRun(page, "mouse");
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("M1-P6 different seed changes the run and frozen V1 route remains playable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const logs = monitor(page);
  await gotoFresh(page, "browser-variation-a");
  await completeRun(page, "mouse");
  const first = await page.getByTestId("chapter-one-run-summary").textContent();
  await gotoFresh(page, "browser-variation-b");
  await completeRun(page, "mouse");
  const second = await page.getByTestId("chapter-one-run-summary").textContent();
  expect(second).not.toBe(first);
  await page.screenshot({ path: resolve(output, "M1-P6-varied-summary.png"), fullPage: true });
  await page.goto("/?play=hanzi-v2-v1&from=hub");
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "汉字魔法战" })).toBeVisible();
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

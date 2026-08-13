import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { M3_HEROES, getChapterOneCharacter, type M3HeroId } from "../../games/hanzi-radical-battle/v2/chapter-one";

const output = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/checkpoints/M3/screenshots");
mkdirSync(output, { recursive: true });
type InputMode = "mouse" | "keyboard" | "touch";

function monitor(page: Page) {
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { if (/^https?:/i.test(request.url()) && new URL(request.url()).origin !== "http://127.0.0.1:5183") externalRequests.push(request.url()); });
  return { consoleErrors, pageErrors, externalRequests };
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function placeCharacter(page: Page, mode: InputMode) {
  const encounter = page.getByTestId("chapter-one-m3-encounter");
  const characterId = await encounter.getAttribute("data-character-id");
  if (!characterId) throw new Error("M3 encounter missing character identity");
  const character = getChapterOneCharacter(characterId);
  const enclosure = character.structure === "full-enclosure" || character.structure === "semi-enclosure";
  if (enclosure) await expect(page.locator('[data-slot-id="inner"]')).toBeDisabled();
  for (const component of character.orderedComponents) {
    const card = page.locator(`[data-card-id="${component.id}"]`);
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    await activate(page, card, mode);
    await activate(page, slot, mode);
    if (enclosure && component.slotId === "outer") await expect(page.locator('[data-slot-id="inner"]')).toBeEnabled();
  }
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-phase", "composition");
}

async function chooseAbility(page: Page, mode: InputMode) {
  const choices = page.locator("[data-ability-id]");
  await expect(choices).toHaveCount(3);
  if (mode === "keyboard") {
    await choices.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(choices.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
  } else await activate(page, choices.first(), mode);
}

async function completeRun(page: Page, mode: InputMode, captureAbilityChoices = false) {
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  let abilityChoiceIndex = 0;
  for (let guard = 0; guard < 220; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "run-summary") return;
    if (phase === "camp") await activate(page, page.locator('[data-action="start-run"]'), mode);
    else if (phase === "route-choice") await activate(page, page.locator('[data-action="choose-route"]').first(), mode);
    else if (phase === "behavior-telegraph") await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    else if (phase === "behavior-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "encounter") await placeCharacter(page, mode);
    else if (phase === "composition" || phase === "meaning" || phase === "region-complete") await activate(page, page.locator('[data-action="continue"]'), mode);
    else if (phase === "ability-choice") {
      abilityChoiceIndex += 1;
      if (captureAbilityChoices) await page.screenshot({ path: resolve(output, `M3-ABILITY-CHOICE-${abilityChoiceIndex}.png`), fullPage: true });
      await chooseAbility(page, mode);
    } else if (phase === "final-intro") await activate(page, page.locator('[data-action="enter-final-core"]'), mode);
    else if (phase === "ending") await activate(page, page.locator('.hm2-ending .hm2-primary[data-action="finish-ending"]'), mode);
    else throw new Error(`unexpected M3 phase: ${phase}`);
  }
  throw new Error("M3 browser run exceeded action guard");
}

async function expectGeometry(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
  }));
  expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.undersized).toEqual([]);
}

async function runHeroPath(page: Page, heroId: M3HeroId, mode: InputMode, capture = false) {
  const logs = monitor(page);
  await page.goto(`/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m3-browser-${heroId}-${mode}`);
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await expect(shell).toHaveAttribute("data-phase", "camp");
  const heroCard = page.locator(`[data-action="select-hero"][data-hero-id="${heroId}"]`);
  await activate(page, heroCard, mode);
  await expect(shell).toHaveAttribute("data-hero-id", heroId);
  await expect(heroCard).toHaveAttribute("aria-pressed", "true");
  if (capture) await page.screenshot({ path: resolve(output, `M3-HERO-${heroId}.png`), fullPage: true });
  await completeRun(page, mode, capture && heroId === "light-speaker");
  await expect(page.getByTestId("chapter-one-m3-run-summary")).toBeVisible();
  await expect(shell).toHaveAttribute("data-selected-ability-count", "3");
  await expect(shell).toHaveAttribute("data-triggered-ability-count", "3");
  expect(Number(await shell.getAttribute("data-innate-trigger-count"))).toBeGreaterThan(0);
  await expect(page.getByTestId("chapter-one-build-badges")).toHaveAttribute("data-badge-count", "4");
  expect(await page.locator("[data-build-ability-id]").evaluateAll((elements) => elements.every((element) => element.getAttribute("data-triggered") === "true"))).toBe(true);
  await expect(page.getByTestId("chapter-one-m3-run-summary")).not.toContainText(/推荐|最佳|史诗|稀有|价格|概率|胜率|攻击力|正确率/);
  await expect(page.getByTestId("chapter-one-m3-run-summary")).toContainText("没有分数、排名或连胜");
  await expectGeometry(page);
  await page.screenshot({ path: resolve(output, `M3-RUN-${heroId}-${mode}.png`), fullPage: true });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
}

for (const hero of M3_HEROES) {
  test(`M3 ${hero.id} completes by mouse`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    await runHeroPath(page, hero.id, "mouse", true);
  });
  test(`M3 ${hero.id} completes by keyboard with arrow-key ability choice`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium");
    await runHeroPath(page, hero.id, "keyboard");
  });
  test(`M3 ${hero.id} completes by touch at 390x844`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-touch");
    await runHeroPath(page, hero.id, "touch");
  });
}

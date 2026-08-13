import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CHAPTER_ONE_CHARACTER_IDS,
  HANZI_MAGIC_M4_SAVE_KEY,
  M3_BUILD_ABILITIES,
  M3_HEROES,
  createFreshM4Save,
  getChapterOneCharacter,
  updateM4Save,
  type M3HeroId,
} from "../../games/hanzi-radical-battle/v2/chapter-one";
import { createV1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, writeV1Save } from "../../games/hanzi-radical-battle/v2/v1/save";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const root = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one");
const screenshotDir = resolve(root, "report/screenshots");
const baseURL = `http://127.0.0.1:${Number(process.env.CHAPTER_ONE_PLAYWRIGHT_PORT ?? "5183")}`;
const sourceTreeSha256 = process.env.CHAPTER_ONE_SOURCE_TREE_SHA256 ?? computeMachineReviewSourceTreeSha256();
mkdirSync(screenshotDir, { recursive: true });

type InputMode = "mouse" | "keyboard" | "touch";
interface Row {
  seed: string;
  hero: M3HeroId;
  route: string[];
  encounters: string[];
  characters: string[];
  abilitiesOffered: string[];
  abilitiesSelected: string[];
  abilitiesTriggered: string[];
  monsterBehaviors: string[];
  bosses: string[];
  campRepairs: number;
  inputMode: InputMode;
  viewport: string;
  muted: boolean;
  reducedMotion: boolean;
  saveScenario: string;
  consoleErrors: string[];
  pageErrors: string[];
  externalRequests: string[];
  result: "PASS";
}

const rows: Row[] = [];

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function completedV1Raw(): string {
  const storage = new MemoryStorage();
  const ids = ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"] as const;
  const state = createV1GameState("m5-browser-migration", { completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], unlockedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], discoveredCharacterIds: ids, campRepairStage: 3, freeAdventureUnlocked: true });
  writeV1Save(storage, saveFromGameState(createFreshV1Save({ muted: true, inputMode: "touch" }), state));
  return storage.getItem(HANZI_MAGIC_V1_SAVE_KEY)!;
}

function monitor(page: Page) {
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:/.test(url.protocol) && url.hostname !== "127.0.0.1") externalRequests.push(request.url()); });
  return { consoleErrors, pageErrors, externalRequests };
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function placeCharacter(page: Page, mode: InputMode) {
  const encounter = page.getByTestId("chapter-one-m3-encounter");
  const id = await encounter.getAttribute("data-character-id");
  if (!id) throw new Error("encounter missing character identity");
  const character = getChapterOneCharacter(id);
  for (const component of character.orderedComponents) {
    await activate(page, page.locator(`[data-card-id="${component.id}"]`), mode);
    await activate(page, page.locator(`[data-slot-id="${component.slotId}"]`), mode);
  }
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-phase", "composition");
}

async function assertGeometry(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const undersized = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    return { viewportWidth, scrollWidth: document.documentElement.scrollWidth, undersized };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.undersized).toEqual([]);
}

async function completeRun(page: Page, mode: InputMode, capture: boolean, resumeAtEncounter: boolean) {
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  const route: string[] = []; const encounters: string[] = []; const characters: string[] = []; const offered: string[] = []; const selected: string[] = []; const behaviors: string[] = []; const bosses: string[] = [];
  let reloaded = false;
  const recordedEncounterKeys = new Set<string>();
  for (let guard = 0; guard < 360; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "run-summary") return { route, encounters, characters, offered, selected, behaviors, bosses };
    if (phase === "camp") await activate(page, page.locator('[data-action="start-run"]'), mode);
    else if (phase === "route-choice") { const choice = page.locator('[data-action="choose-route"]').nth(route.length % 2); route.push((await choice.getAttribute("data-path-id"))!); await activate(page, choice, mode); }
    else if (phase === "behavior-telegraph") {
      const panel = page.getByTestId("chapter-one-m3-behavior");
      behaviors.push((await panel.getAttribute("data-behavior-id"))!);
      const boss = await panel.getAttribute("data-boss-id"); if (boss && boss !== "none") bosses.push(boss);
      if (capture && bosses.length === 1) await page.screenshot({ path: resolve(screenshotDir, "M5-REGION-BOSS.png"), fullPage: true });
      if (capture && boss === "ink-king-core") await page.screenshot({ path: resolve(screenshotDir, `M5-INK-KING-PHASE-${await panel.getAttribute("data-boss-phase")}.png`), fullPage: true });
      await activate(page, page.locator('[data-action="begin-behavior"]'), mode);
    } else if (phase === "behavior-effect") await activate(page, page.locator('[data-action="recover-behavior"]'), mode);
    else if (phase === "encounter") {
      const encounter = page.getByTestId("chapter-one-m3-encounter"); const id = (await encounter.getAttribute("data-character-id"))!;
      const actionCount = (await shell.getAttribute("data-action-count"))!;
      const encounterKey = `${actionCount}:${id}`;
      if (!recordedEncounterKeys.has(encounterKey)) { recordedEncounterKeys.add(encounterKey); encounters.push(id); characters.push(id); }
      if (resumeAtEncounter && !reloaded && encounters.length === 5) { await page.reload(); await expect(shell).toHaveAttribute("data-action-count", actionCount); reloaded = true; continue; }
      await placeCharacter(page, mode);
    } else if (phase === "composition" || phase === "meaning" || phase === "region-complete") await activate(page, page.locator('[data-action="continue"]'), mode);
    else if (phase === "ability-choice") {
      const choices = page.locator("[data-ability-id]"); const ids = await choices.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-ability-id")!)); offered.push(...ids);
      const pickIndex = selected.length % 3; const pick = choices.nth(pickIndex); selected.push((await pick.getAttribute("data-ability-id"))!);
      if (capture && selected.length === 1) await page.screenshot({ path: resolve(screenshotDir, "M5-ABILITY-CHOICE.png"), fullPage: true });
      if (mode === "keyboard") { await choices.first().focus(); for (let i = 0; i < pickIndex; i += 1) await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter"); }
      else await activate(page, pick, mode);
    } else if (phase === "final-intro") { if (capture) await page.screenshot({ path: resolve(screenshotDir, "M5-FINAL-INTRO.png"), fullPage: true }); await activate(page, page.locator('[data-action="enter-final-core"]'), mode); }
    else if (phase === "ending") { if (capture) await page.screenshot({ path: resolve(screenshotDir, "M5-ENDING.png"), fullPage: true }); await activate(page, page.locator('.hm2-ending .hm2-primary[data-action="finish-ending"]'), mode); }
    else throw new Error(`unexpected M5 phase: ${phase}`);
  }
  throw new Error("M5 browser run exceeded terminal-state guard");
}

async function runOne(page: Page, index: number, hero: M3HeroId, mode: InputMode, scenario: string, adventure: "story" | "free") {
  const logs = monitor(page); const seed = `m5-e2e-${index.toString().padStart(2, "0")}-${hero}`;
  if (scenario === "v1-migrated") await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), { key: HANZI_MAGIC_V1_SAVE_KEY, raw: completedV1Raw() });
  await page.goto(`/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=${seed}&adventure=${adventure}`);
  const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await expect(shell).toHaveAttribute("data-phase", "camp"); await activate(page, page.locator(`[data-action="select-hero"][data-hero-id="${hero}"]`), mode);
  if (scenario === "muted-reduced") { await page.locator('[data-pref="muted"]').click(); await page.locator('[data-pref="reduced-motion"]').click(); }
  if (scenario === "corrupt-recovery") { await page.evaluate((key) => localStorage.setItem(key, "{broken"), HANZI_MAGIC_M4_SAVE_KEY); await page.reload(); await expect(shell).toHaveAttribute("data-save-source", /fresh|v2-backup/); }
  const path = await completeRun(page, mode, index === 0, scenario === "resume");
  await expect(shell).toHaveAttribute("data-phase", "run-summary"); await expect(shell).toHaveAttribute("data-selected-ability-count", "3"); await expect(shell).toHaveAttribute("data-triggered-ability-count", "3"); await expect(shell).toHaveAttribute("data-repair-count", "8");
  await expect(page.getByTestId("chapter-one-m3-run-summary")).toContainText("没有分数、排名或连胜");
  expect(new Set(path.bosses)).toEqual(new Set(["lantern-root-guardian", "echo-bloom-guardian", "wind-bell-guardian", "ink-king-core"]));
  await assertGeometry(page);
  const triggered = await page.locator("[data-build-ability-id][data-triggered=true]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-build-ability-id")!));
  const viewport = page.viewportSize()!;
  rows.push({ seed, hero, route: path.route, encounters: path.encounters, characters: path.characters, abilitiesOffered: path.offered, abilitiesSelected: path.selected, abilitiesTriggered: triggered, monsterBehaviors: path.behaviors, bosses: [...new Set(path.bosses)], campRepairs: 8, inputMode: mode, viewport: `${viewport.width}x${viewport.height}`, muted: await shell.getAttribute("data-muted") === "true", reducedMotion: await shell.getAttribute("data-reduced-motion") === "true", saveScenario: scenario, consoleErrors: logs.consoleErrors, pageErrors: logs.pageErrors, externalRequests: logs.externalRequests, result: "PASS" });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
}

test("M5 18-run release matrix completes without machine errors", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(600_000);
  const scenarios = ["fresh", "fresh", "free", "fresh", "fresh", "free", "fresh", "fresh", "free", "touch-proxy", "touch-proxy", "touch-proxy", "keyboard", "keyboard", "muted-reduced", "v1-migrated", "resume", "corrupt-recovery"];
  for (let index = 0; index < 18; index += 1) {
    const hero = M3_HEROES[index % 3].id;
    const mode: InputMode = index >= 9 && index <= 11 ? "touch" : index === 12 || index === 13 ? "keyboard" : "mouse";
    const mobile = mode === "touch";
    const context = await browser.newContext({ baseURL, hasTouch: mobile, isMobile: mobile, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
    try {
      await runOne(await context.newPage(), index, hero, mode, scenarios[index], index % 3 === 2 ? "free" : "story");
    } finally {
      await context.close();
    }
  }
  const matrix = { schemaVersion: 1, sourceTreeSha256, result: "PASS", playthroughCount: rows.length, rows };
  writeFileSync(resolve(root, "report/data/MACHINE-PLAYTHROUGH-MATRIX.json"), `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  expect(rows).toHaveLength(18);
  expect(new Set(rows.map((row) => row.hero))).toEqual(new Set(M3_HEROES.map((hero) => hero.id)));
  expect(new Set(rows.flatMap((row) => row.characters)).size).toBe(36);
  expect(new Set(rows.flatMap((row) => row.abilitiesOffered))).toEqual(new Set(M3_BUILD_ABILITIES.map((ability) => ability.id)));
  expect(new Set(rows.flatMap((row) => row.monsterBehaviors)).size).toBe(9);
});

test("M5 hub card, spellbook, assets, legacy route, and mobile geometry remain available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page);
  await page.goto("/?hub=classic");
  const card = page.locator(".game-card--ink-forest"); await expect(card).toContainText("汉字魔法战"); await expect(card).toContainText("进入墨迹森林"); await expect(card).not.toContainText(/学习目标|适合年龄|V2\.0\.0/);
  await expect(card.locator("img")).toHaveJSProperty("complete", true); await page.screenshot({ path: resolve(screenshotDir, "M5-HUB-CARD.png"), fullPage: true });
  const full = updateM4Save(createFreshM4Save(), { discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS, completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"] });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(full)]);
  await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m5-surfaces"); await page.locator('[data-action="open-spellbook"]').click(); await expect(page.getByTestId("chapter-one-spellbook")).toHaveAttribute("data-total-entries", "36");
  const sceneImage = await page.getByTestId("hanzi-magic-chapter-one-m3").evaluate((element) => getComputedStyle(element).getPropertyValue("--hm2-scene-image"));
  expect(sceneImage).toContain("/assets/hanzi-radical-battle/v2/theme-c/chapter-one/"); expect(sceneImage).not.toContain("/assets/assets/");
  await page.locator("[data-spellbook-search]").fill("清"); await page.locator('[data-action="select-spellbook-entry"][data-character-id="qing-clear"]').click(); await page.locator('[data-action="replay-meaning"]').click(); await expect(page.locator(".hm2-magic-replay i")).toHaveCSS("background-image", /meaning-/); await page.screenshot({ path: resolve(screenshotDir, "M5-SPELLBOOK.png"), fullPage: true });
  await page.goto("/?play=hanzi-v2-v1&from=hub"); await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 }); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m5-mobile-geometry"); await assertGeometry(page);
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/words";
import { COMPLETE_EPISODE_IDS, COMPLETE_REPAIR_IDS } from "../../../games/hanzi-radical-battle/complete/core/world-contracts";
import type { CompletePostgameMode } from "../../../games/hanzi-radical-battle/complete/core/complete-types";
import { createFreshCompleteSave, updateCompleteSave } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save-schema";
import { createCompleteWorkshopState, getCompleteWorkshopPool, reduceCompleteWorkshopState } from "../../../games/hanzi-radical-battle/complete/workshop-adapter/engine";
import { getCompleteWheelRecord } from "../../../games/hanzi-radical-battle/complete/wheel-adapter/selection";

const output = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? "test-results", "hanzi-complete/world-features");
mkdirSync(output, { recursive: true });
type InputMode = "mouse" | "keyboard" | "touch";

function monitor(page: Page) {
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => { const url = request.url(); if (/^https?:/i.test(url) && new URL(url).hostname !== "127.0.0.1") externalRequests.push(url); });
  return { consoleErrors, pageErrors, externalRequests };
}

function completedSave() {
  return updateCompleteSave(createFreshCompleteSave(), {
    selectedHeroId: "forest-speaker",
    settings: { muted: true, reducedMotion: false, inputMode: "auto" },
    activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "complete-world-features", actionCount: 0 },
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedEpisodeIds: COMPLETE_EPISODE_IDS,
    discoveredCharacterIds: COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id),
    discoveredFamilyIds: COMPLETE_COMPONENT_FAMILIES.map((family) => family.id),
    discoveredWordIds: COMPLETE_WORD_NODES.map((word) => word.id),
    repairedObjectIds: COMPLETE_REPAIR_IDS,
  });
}

async function gotoCompleted(page: Page, suffix = "") {
  const save = completedSave();
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(save) });
  await page.goto(`/?play=hanzi-magic-complete&from=hub${suffix}`);
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"; });
    return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, undersized: controls.filter((element) => { const rect = element.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5; }).map((element) => ({ text: element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })) };
  });
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "touch") await locator.tap();
  else if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.click();
}

async function solvePostgameBuild(page: Page, mode: InputMode, rejectWrong = false) {
  const shell = page.getByTestId("complete-postgame");
  const characterId = await page.getByTestId("complete-postgame-build").getAttribute("data-character-id");
  const target = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId)!;
  if (rejectWrong) {
    const cardTexts = await page.locator("[data-card-id]:not([disabled])").allTextContents();
    const wrongIndex = cardTexts.findIndex((text) => !target.components.some((component) => component.glyph === text.trim()));
    if (wrongIndex >= 0) {
      await activate(page, page.locator("[data-card-id]:not([disabled])").nth(wrongIndex), mode);
      await activate(page, page.locator(`[data-slot-id="${target.components[0].slotId}"]`), mode);
      await expect(shell).toContainText("进度都保留");
    }
  }
  for (const component of target.components) {
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (await slot.evaluate((element) => element.classList.contains("is-filled"))) continue;
    await activate(page, page.locator(`[data-card-id$="-${component.order}"]:not([disabled])`), mode);
    await activate(page, slot, mode);
  }
}

async function completePostgame(page: Page, mode: InputMode, options: { reloadOnce?: boolean; rejectWrong?: boolean } = {}) {
  const shell = page.getByTestId("complete-postgame"); let reloaded = false; let rejected = false;
  for (let guard = 0; guard < 420; guard += 1) {
    const phase = await shell.getAttribute("data-phase");
    if (phase === "session-summary") return;
    if (phase === "mode-intro") await activate(page, page.locator('[data-action="start"]'), mode);
    else if (phase === "offer-choice") {
      await activate(page, page.locator("[data-offer-id]").first(), mode);
      if (options.reloadOnce && !reloaded) {
        const actionCount = await shell.getAttribute("data-action-count"); const resumedPhase = await shell.getAttribute("data-phase");
        await page.reload(); await expect(shell).toHaveAttribute("data-action-count", actionCount!); await expect(shell).toHaveAttribute("data-phase", resumedPhase!); reloaded = true;
      }
    } else if (["character-build", "family-build", "word-build-a", "word-build-b"].includes(String(phase))) {
      await solvePostgameBuild(page, mode, Boolean(options.rejectWrong && !rejected)); rejected = true;
    } else if (["character-meaning", "family-meaning", "word-meaning-a", "word-meaning-b", "round-complete"].includes(String(phase))) await activate(page, page.locator('[data-action="continue"]'), mode);
    else if (phase === "family-link") {
      const expected = await page.getByTestId("complete-postgame-family-link").getAttribute("data-family-id");
      await activate(page, page.locator(`button[data-family-id="${expected}"]`), mode);
    } else if (phase === "word-order") {
      const wordId = await page.getByTestId("complete-postgame-word-order").getAttribute("data-word-id"); const target = COMPLETE_WORD_NODES.find((candidate) => candidate.id === wordId)!;
      await activate(page, page.locator(`[data-word-character-id="${target.characterIds[0]}"]`), mode); await activate(page, page.locator(`[data-word-character-id="${target.characterIds[1]}"]`), mode);
    } else if (phase === "word-context") {
      const wordId = await page.getByTestId("complete-postgame-context").getAttribute("data-word-id"); await activate(page, page.locator(`[data-context-word-id="${wordId}"]`), mode);
    } else throw new Error(`Unexpected postgame phase ${phase}`);
  }
  throw new Error("Postgame browser playthrough exceeded guard");
}

test("fresh world stays within the frozen V2 first-interactive transfer budget", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page); const client = await context.newCDPSession(page); await client.send("Network.enable");
  let requestCount = 0; let transferBytes = 0; client.on("Network.responseReceived", () => { requestCount += 1; }); client.on("Network.loadingFinished", (event) => { transferBytes += event.encodedDataLength; });
  await page.goto("/?play=hanzi-magic-complete&from=hub"); await expect(page.getByTestId("complete-primary-action")).toBeVisible(); const firstInteractiveMs = Math.round(await page.evaluate(() => performance.now())); await page.waitForLoadState("networkidle");
  const evidence = { viewport: "1366x768", v2Baseline: { firstInteractiveMs: 1059, transferBytes: 2535841 }, maximum: { firstInteractiveMs: Math.floor(1059 * 1.2), transferBytes: Math.floor(2535841 * 1.2) }, actual: { firstInteractiveMs, requestCount, transferBytes }, externalRequests: logs.externalRequests.length };
  writeFileSync(resolve(output, "PERFORMANCE_PROBE.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8"); expect(firstInteractiveMs).toBeLessThanOrEqual(evidence.maximum.firstInteractiveMs); expect(transferBytes).toBeLessThanOrEqual(evidence.maximum.transferBytes); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await client.detach();
});

test("completed world keeps one primary action and opens the full no-reset archive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page); await page.setViewportSize({ width: 1600, height: 900 }); await gotoCompleted(page);
  const world = page.getByTestId("hanzi-magic-complete"); await expect(world).toHaveAttribute("data-story-complete", "true"); await expect(world).toHaveAttribute("data-repair-count", "16");
  await expect(page.getByTestId("complete-primary-action")).toHaveCount(1); await expect(page.locator("[data-postgame-mode]")).toHaveCount(3); await expect(world).not.toContainText(/正确率|掌握率|排行榜|连胜|72\/72/);
  await page.screenshot({ path: resolve(output, "world-complete.png"), fullPage: true });
  await page.goto("/?play=hanzi-magic-complete&from=hub&view=archive"); const archive = page.getByTestId("complete-story-archive"); await expect(archive).toHaveAttribute("data-boss-count", "12"); await expect(archive).toHaveAttribute("data-repair-count", "16");
  await expect(archive).not.toContainText(/36 字魔法书|36 道字光/);
  await page.locator("[data-archive-boss-id]").first().click(); const boss = page.getByTestId("complete-archive-boss-detail"); await expect(boss).toHaveAttribute("data-stage", "0"); await page.locator('[data-action="archive-boss-next"]').click(); await expect(boss).toHaveAttribute("data-stage", "1"); await page.locator('[data-action="archive-boss-next"]').click(); await expect(boss).toHaveAttribute("data-stage", "2");
  await expect(boss.locator("a")).toHaveAttribute("href", /fresh=1/); await expect(boss.locator("a")).not.toHaveAttribute("href", /reset|clear/); await page.locator('[data-action="archive-close-detail"]').click();
  await page.locator("[data-archive-repair-id]").last().click(); await expect(page.getByTestId("complete-archive-repair-detail").locator("article")).toHaveCount(2); expect(await geometry(page)).toMatchObject({ undersized: [] });
  expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await page.screenshot({ path: resolve(output, "archive-complete.png"), fullPage: true });
});

test("72-entry spellbook separates child replay copy from audit metadata", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page); await gotoCompleted(page, "&view=spellbook"); const book = page.getByTestId("complete-spellbook");
  await expect(book).toHaveAttribute("data-entry-count", "72"); await expect(page.locator(".hmcs-index [data-character-id]")).toHaveCount(72); await expect(book.locator("img")).toHaveCount(0);
  await expect(book).not.toContainText(/V[123]|source|audit|revision|正确率|掌握率|年级/i); await page.locator('[data-filter="optional"]').click(); await page.locator(".hmcs-index [data-character-id]").first().click(); await page.locator('[data-replay="formation"]').click(); await expect(page.getByRole("status")).toContainText("真实合字顺序");
  const result = await geometry(page); expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1); expect(result.undersized).toEqual([]); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await page.screenshot({ path: resolve(output, "spellbook-desktop.png"), fullPage: true });
});

test("72-record wheel completes by click with reversible distractors and graph links", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); const logs = monitor(page); const seed = "wheel-browser-complete"; await gotoCompleted(page, `&view=wheel&seed=${seed}`); const shell = page.getByTestId("complete-workshop");
  await expect(shell).toHaveAttribute("data-record-count", "72"); await expect(shell).toHaveAttribute("data-grade-pool-count", "72"); let oracle = createCompleteWorkshopState(seed);
  await expect(shell).not.toContainText(/原始 270|审计|source|audit|revision/i);
  for (let round = 0; round < 3; round += 1) {
    await page.locator('[data-action="spin"]').click(); oracle = reduceCompleteWorkshopState(oracle, { type: "spin" }); const target = getCompleteWheelRecord(oracle.currentRound!.recordId);
    if (round === 0) {
      const wrong = oracle.currentRound!.cards.find((card) => card.kind === "distractor")!; await page.locator(`[data-card-id="${wrong.id}"]`).click(); oracle = reduceCompleteWorkshopState(oracle, { type: "select-card", cardId: wrong.id }); await page.locator(`[data-slot-id="${target.slotIds[1]}"]`).click(); oracle = reduceCompleteWorkshopState(oracle, { type: "place-card", slotId: target.slotIds[1] }); await expect(shell).toHaveAttribute("data-phase", "choose-card");
    }
    const partner = oracle.currentRound!.cards.find((card) => card.kind === "partner")!; await page.locator(`[data-card-id="${partner.id}"]`).click(); oracle = reduceCompleteWorkshopState(oracle, { type: "select-card", cardId: partner.id }); await page.locator(`[data-slot-id="${target.slotIds[1]}"]`).click(); oracle = reduceCompleteWorkshopState(oracle, { type: "place-card", slotId: target.slotIds[1] });
    await expect(page.getByTestId("complete-workshop-success")).toContainText(target.familiarWord); await expect(page.getByTestId("complete-workshop-success")).not.toContainText(/family-|word-|source|audit/i); await page.locator('[data-action="continue"]').click(); oracle = reduceCompleteWorkshopState(oracle, { type: "continue" });
  }
  await expect(shell).toHaveAttribute("data-phase", "summary"); expect(await geometry(page)).toMatchObject({ undersized: [] }); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await page.screenshot({ path: resolve(output, "wheel-summary.png"), fullPage: true });
});

for (const mode of ["free-adventure", "component-trails", "word-resonance"] as const satisfies readonly CompletePostgameMode[]) {
  test(`${mode} completes with exact postgame resume`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium"); test.slow(); const logs = monitor(page); await gotoCompleted(page, `&postgame=${mode}&new=1&seed=browser-${mode}`); await completePostgame(page, "mouse", { reloadOnce: mode === "word-resonance", rejectWrong: true });
    const shell = page.getByTestId("complete-postgame"); await expect(shell).toHaveAttribute("data-completed-offer-count", "6"); await expect(page.getByTestId("complete-postgame-summary")).toContainText("没有分数或排名"); await expect(page.getByTestId("complete-postgame-summary")).not.toContainText(/得分|稀有卡|排行榜/); const raw = await page.evaluate((key) => localStorage.getItem(key), HANZI_MAGIC_COMPLETE_SAVE_KEY); expect(JSON.parse(raw!).postgameResume.phase).toBe("session-summary");
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); if (mode === "word-resonance") await page.screenshot({ path: resolve(output, "postgame-word-summary.png"), fullPage: true });
  });
}

test("postgame remains fully playable with keyboard-only input and visible focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium"); test.slow(); const logs = monitor(page); await gotoCompleted(page, "&postgame=component-trails&new=1&seed=keyboard-postgame");
  const start = page.locator('[data-action="start"]'); await start.focus(); await expect(start).toBeFocused(); expect(await start.evaluate((element) => getComputedStyle(element).outlineWidth)).not.toBe("0px"); await page.keyboard.press("Enter");
  await completePostgame(page, "keyboard", { rejectWrong: true }); const shell = page.getByTestId("complete-postgame"); await expect(shell).toHaveAttribute("data-completed-offer-count", "6"); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
});

test("postgame remains touch-sized at 360x800 and fully playable without sound", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-touch"); test.slow(); const logs = monitor(page); await page.setViewportSize({ width: 360, height: 800 }); await gotoCompleted(page, "&postgame=free-adventure&new=1&seed=mobile-postgame"); await completePostgame(page, "touch");
  const result = await geometry(page); expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1); expect(result.undersized).toEqual([]); expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await page.screenshot({ path: resolve(output, "postgame-mobile.png"), fullPage: true });
});

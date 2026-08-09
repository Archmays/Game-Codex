import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const HUB_URL = "/";
const GOLDEN_SLICE_URL = "/?play=hanzi-v2-golden-slice";
const REVIEW_URL = "/?review=hanzi-v2-step03";
const GOLDEN_SAVE_KEY = "family-games/hanzi-radical-battle-v2/golden-slice/state";
const STEP02_SAVE_KEY = "family-games/hanzi-radical-battle-v2-pilot/state";
const REVIEW_DRAFT_KEY = "family-games/hanzi-radical-battle-v2-step03-review/draft";

type AbilityId = "guardian-light" | "star-path" | "ink-echo";

function slice(page: Page) {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function expectPhase(page: Page, phase: string, timeout = 8_000): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout });
}

async function openFreshGoldenSlice(page: Page): Promise<void> {
  await page.goto(HUB_URL);
  await page.evaluate(() => localStorage.clear());
  await page.goto(GOLDEN_SLICE_URL);
  await expect(slice(page)).toBeVisible();
  await expectPhase(page, "boot");
}

async function clickPrimary(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

async function solveWithClicks(page: Page, cardId: string, slotId: string): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

async function enterFirstBoard(page: Page): Promise<void> {
  await clickPrimary(page, "走进墨林");
  await expectPhase(page, "camp_intro");
  await clickPrimary(page, "看看营地灯");
  await clickPrimary(page, "沿着灯路出发");
  await clickPrimary(page, "跳过小路");
  await expectPhase(page, "battle_1_intro");
  await clickPrimary(page, "开始合字施法");
  await expectPhase(page, "battle_1_placing");
  await expect(page.getByTestId("five-card-hand").getByRole("button")).toHaveCount(5);
}

async function finishFirstAndSecondEncounter(page: Page, includeFirstBoardExercise = false): Promise<void> {
  await enterFirstBoard(page);

  if (includeFirstBoardExercise) {
    await solveWithClicks(page, "ming-yue", "left");
    await expectPhase(page, "invalid_feedback");
    await expectPhase(page, "battle_1_placing");
    await expect(page.getByTestId("slot-left")).toHaveClass(/is-hinted/, { timeout: 5_000 });
    await page.getByTestId("component-card-ming-ri").dragTo(page.getByTestId("slot-left"));
    await expect(page.getByTestId("slot-left")).toHaveClass(/is-filled/);
  } else {
    await solveWithClicks(page, "ming-ri", "left");
  }

  await solveWithClicks(page, "ming-yue", "right");
  await expectPhase(page, "battle_1_forming");
  await expect(page.getByTestId("formed-character-ming")).toContainText("明");
  await expectPhase(page, "battle_1_cleared");
  await clickPrimary(page, "看看光留下什么");
  await expectPhase(page, "breather_1");
  await expectPhase(page, "travel_to_battle_2", 10_000);
  await clickPrimary(page, "跳过花径");
  await expectPhase(page, "battle_2_intro");
  await clickPrimary(page, "试试新的结构");
  await expectPhase(page, "battle_2_placing");
  await solveWithClicks(page, "hua-cao", "top");
  await solveWithClicks(page, "hua-hua", "bottom");
  await expect(page.getByTestId("formed-character-hua")).toContainText("花");
  await expectPhase(page, "battle_2_cleared");
  await clickPrimary(page, "看看三道光");
  await expectPhase(page, "ability_choice");
}

async function finishBossAndReturnToCamp(page: Page, abilityId: AbilityId): Promise<void> {
  await page.getByTestId(`ability-${abilityId}`).click();
  await expectPhase(page, "travel_to_boss");
  await expect(slice(page)).toHaveAttribute("data-selected-ability-id", abilityId);
  await clickPrimary(page, "走向双印墨守");
  await expectPhase(page, "boss_intro");
  await clickPrimary(page, "先看清它的动作");
  await expectPhase(page, "boss_phase_1_placing");
  await expect(page.getByTestId("boss-intent")).toBeVisible();

  if (abilityId === "guardian-light") {
    await solveWithClicks(page, "lin-mu-left", "right");
    await expectPhase(page, "invalid_feedback");
    await expect(page.getByTestId("slot-left")).toHaveClass(/is-hinted/);
    await page.getByRole("button", { name: "重新摆放", exact: true }).click();
    await expectPhase(page, "safe_retry");
    await clickPrimary(page, "从这里再试");
    await expectPhase(page, "boss_phase_1_placing");
  }

  if (abilityId === "star-path") {
    await expect(page.getByTestId("slot-left")).toHaveClass(/is-hinted/);
  }

  await solveWithClicks(page, "lin-mu-left", "left");
  await expectPhase(page, "boss_interference");
  await expect(page.getByTestId("boss-interference-mask")).toBeVisible();
  if (abilityId === "ink-echo") {
    await page.getByRole("button", { name: "让墨点回声读出当前首领汉字" }).click();
    await expectPhase(page, "boss_interference");
  }
  await expectPhase(page, "boss_phase_1_placing", 5_000);
  await solveWithClicks(page, "lin-mu-right", "right");
  await expect(page.getByTestId("formed-character-lin")).toContainText("林");
  await expectPhase(page, "boss_phase_1_cleared");
  await clickPrimary(page, "解开第二枚墨印");
  await expectPhase(page, "boss_phase_2_placing");
  if (abilityId === "star-path") {
    await expect(page.getByTestId("slot-top")).toHaveClass(/is-hinted/);
  }
  await solveWithClicks(page, "xing-ri", "top");
  await expectPhase(page, "boss_interference");
  await expectPhase(page, "boss_phase_2_placing", 5_000);
  await solveWithClicks(page, "xing-sheng", "bottom");
  await expect(page.getByTestId("formed-character-xing")).toContainText("星");
  await expectPhase(page, "boss_cleared");
  await clickPrimary(page, "沿星路回营地");
  await expectPhase(page, "camp_repair");
}

function observeDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) {
      remoteRequests.push(request.url());
    }
  });
  return { consoleErrors, pageErrors, remoteRequests };
}

test.describe("Hanzi Radical Battle V2 STEP 03", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("keeps the ten-game hub intact and mounts only the hidden child and review routes", async ({ page }) => {
    await page.goto(HUB_URL);
    await expect(page.getByRole("heading", { name: "儿童学习游戏大厅" })).toBeVisible();
    await expect(page.locator(".game-card")).toHaveCount(10);
    const firstTitle = await page.locator(".game-card h2").first().textContent();
    await page.locator(".game-card .game-card__button").first().click();
    await expect(page.locator(".game-topbar strong")).toHaveText(firstTitle ?? "");
    await page.getByRole("button", { name: "返回大厅" }).click();
    await expect(page.locator(".game-card")).toHaveCount(10);

    await page.goto(GOLDEN_SLICE_URL);
    await expect(slice(page)).toBeVisible();
    await expect(page.getByTestId("parent-debug-overlay")).toHaveCount(0);
    await expect(page.locator(".game-card")).toHaveCount(0);

    await page.goto(REVIEW_URL);
    await expect(page.getByTestId("step03-review-app")).toBeVisible();
    await expect(page.locator("[data-review-tab]")).toHaveCount(9);
    await expect(page.locator(".game-card")).toHaveCount(0);
  });

  test("reaches the first spell within the technical 60-second budget without showing a child countdown", async ({ page }) => {
    await openFreshGoldenSlice(page);
    const startedAt = Date.now();
    await enterFirstBoard(page);
    await solveWithClicks(page, "ming-ri", "left");
    await solveWithClicks(page, "ming-yue", "right");
    await expectPhase(page, "battle_1_casting", 10_000);
    expect(Date.now() - startedAt).toBeLessThan(60_000);
    await expect(slice(page)).not.toContainText("倒计时");
  });

  test("uses visible cards, invalid feedback, hint, drag, recovery, and all three abilities across independent complete runs", async ({ page }) => {
    test.setTimeout(90_000);
    const diagnostics = observeDiagnostics(page);

    for (const abilityId of ["guardian-light", "star-path", "ink-echo"] as const) {
      await openFreshGoldenSlice(page);
      await finishFirstAndSecondEncounter(page, abilityId === "guardian-light");
      await finishBossAndReturnToCamp(page, abilityId);

      await clickPrimary(page, "翻开四字魔法书");
      await expectPhase(page, "spellbook_review");
      await expect(page.getByTestId("spellbook-overlay").locator("[data-spellbook-id]")).toHaveCount(4);
      for (const id of ["ming", "hua", "lin", "xing"]) {
        await page.locator(`[data-spellbook-id='${id}']`).click();
        await expect(page.getByTestId(`spellbook-page-${id}`)).toBeVisible();
      }

      await page.getByTestId("spellbook-page-xing").getByRole("button", { name: "再看合字" }).click();
      await page.getByTestId("spellbook-page-xing").getByRole("button", { name: "再看魔法" }).click();
      await clickPrimary(page, "让营地继续亮着");
      await expectPhase(page, "run_complete");

      const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), GOLDEN_SAVE_KEY);
      expect(save).toMatchObject({
        schemaVersion: 3,
        completedRuns: 1,
        campState: { lamp: true },
        spellbookEntries: ["ming", "hua", "lin", "xing"],
        chosenAbilityHistory: [abilityId],
      });
    }

    await page.getByTestId("run-complete").getByRole("button").first().click();
    await expectPhase(page, "boot");
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.remoteRequests).toEqual([]);
  });

  test("recovers from corrupt local state, migrates STEP 02 progress, and resets only this game through visible settings", async ({ page }) => {
    await page.goto(HUB_URL);
    await page.evaluate(({ goldenKey, step02Key }) => {
      localStorage.setItem(goldenKey, "{corrupt");
      localStorage.setItem("unrelated-local-key", "keep");
      localStorage.removeItem(step02Key);
    }, { goldenKey: GOLDEN_SAVE_KEY, step02Key: STEP02_SAVE_KEY });
    await page.goto(GOLDEN_SLICE_URL);
    await expect(slice(page)).toBeVisible();
    const recovered = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), GOLDEN_SAVE_KEY);
    expect(recovered).toMatchObject({ schemaVersion: 3, completedRuns: 0, campState: { lamp: false } });

    await page.goto(HUB_URL);
    await page.evaluate(({ goldenKey, step02Key }) => {
      localStorage.removeItem(goldenKey);
      localStorage.setItem(step02Key, JSON.stringify({
        schemaVersion: 1,
        campLampRepaired: true,
        spellbookCharacterIds: ["ming"],
        muted: true,
        reducedMotion: true,
        selectedThemeForReview: "C",
        minimumPilotEvents: ["pilot_opened", "character_formed", "spell_cast", "camp_repaired", "pilot_completed"],
      }));
    }, { goldenKey: GOLDEN_SAVE_KEY, step02Key: STEP02_SAVE_KEY });
    await page.goto(GOLDEN_SLICE_URL);
    await expect(slice(page)).toBeVisible();
    const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), GOLDEN_SAVE_KEY);
    expect(migrated).toMatchObject({
      completedRuns: 1,
      campState: { lamp: true },
      spellbookEntries: ["ming"],
      settings: { muted: true, reducedMotion: true },
    });

    await clickPrimary(page, "走进墨林");
    await page.getByRole("button", { name: "声音与画面", exact: true }).click();
    await expect(page.getByTestId("settings-overlay")).toBeVisible();
    await page.getByRole("button", { name: "家长清除营地记录", exact: true }).click();
    await page.getByRole("button", { name: "再点一次，只清除本游戏记录", exact: true }).click();
    await expectPhase(page, "camp_intro");
    const reset = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), GOLDEN_SAVE_KEY);
    expect(reset).toMatchObject({ schemaVersion: 3, completedRuns: 0, campState: { lamp: false }, spellbookEntries: [] });
    await expect.poll(() => page.evaluate(() => localStorage.getItem("unrelated-local-key"))).toBe("keep");
  });

  test("keeps mute, reduced motion, keyboard cancellation, responsive controls, resize, and browser zoom usable", async ({ page }) => {
    await openFreshGoldenSlice(page);
    await enterFirstBoard(page);
    await page.getByRole("button", { name: "声音与画面", exact: true }).click();
    const settings = page.getByTestId("settings-overlay");
    await expect(settings).toBeVisible();
    await settings.getByLabel("静音").check();
    await settings.getByLabel("减少动态").check();
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    await expect(slice(page)).toHaveAttribute("data-reduced-motion", "true");

    await page.getByTestId("component-card-ming-ri").click();
    await expect(page.getByTestId("component-card-ming-ri")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("component-card-ming-ri")).toHaveAttribute("aria-pressed", "false");

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("structure-board")).toBeVisible();
      const cardBoxes = await page.getByTestId("five-card-hand").getByRole("button").evaluateAll((cards) => cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      expect(cardBoxes).toHaveLength(5);
      expect(cardBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.zoom = "125%"; });
    await expect(page.getByTestId("structure-board")).toBeVisible();
    await expect(page.getByTestId("component-card-ming-ri")).toBeVisible();
  });

  test("keeps the nine-tab parent review local, exportable, identity-bound, and changed-only", async ({ page }) => {
    const diagnostics = observeDiagnostics(page);
    await page.goto(REVIEW_URL);
    const review = page.getByTestId("step03-review-app");
    await expect(review).toBeVisible();
    await expect(review.locator("[data-review-tab]")).toHaveCount(9);

    for (const tab of ["scope", "golden-slice", "manifest", "abilities", "boss", "assets", "audio", "child-gate", "summary"]) {
      await review.locator(`[data-review-tab='${tab}']`).click();
    }
    await review.locator("[data-review-tab='golden-slice']").click();
    const preview = page.getByTestId("golden-slice-preview");
    await expect(preview).toHaveAttribute("src", /\?play=hanzi-v2-golden-slice&mode=review/);
    expect(await preview.evaluate((frame) => getComputedStyle(frame).transform)).toBe("none");
    const previewFrame = page.frameLocator("[data-testid='golden-slice-preview']");
    await expect(previewFrame.getByTestId("parent-debug-overlay")).toBeVisible();
    await previewFrame.getByRole("button", { name: "Boss", exact: true }).click();
    await expect(previewFrame.getByTestId("hanzi-v2-golden-slice")).toHaveAttribute("data-visual-state-id", "boss_intro");
    await page.getByRole("button", { name: "mobile", exact: true }).click();
    await expect(page.locator(".step03-preview-frame")).toHaveClass(/step03-preview-frame--mobile/);
    await page.getByRole("button", { name: "mute", exact: true }).click();
    await page.getByRole("button", { name: "reduced motion", exact: true }).click();
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), GOLDEN_SAVE_KEY)).toMatchObject({
      schemaVersion: 3,
      settings: { muted: true, reducedMotion: true },
    });
    await page.getByRole("button", { name: "reset preview", exact: true }).click();
    await expect(previewFrame.getByTestId("hanzi-v2-golden-slice")).toHaveAttribute("data-visual-state-id", "boot");
    await review.locator("[data-review-tab='manifest']").click();
    await expect(page.locator("[data-testid^='final-manifest-card-']")).toHaveCount(12);

    const reviewItems: ReadonlyArray<{ tab: string; itemId: string }> = [
      { tab: "golden-slice", itemId: "slice-preview" },
      { tab: "golden-slice", itemId: "encounter-structure" },
      { tab: "boss", itemId: "two-phase-boss" },
      { tab: "child-gate", itemId: "child-use-gate" },
    ];
    for (const item of reviewItems) {
      await review.locator(`[data-review-tab='${item.tab}']`).click();
      await page.locator(`[data-decision='ACCEPT'][data-item-id='${item.itemId}']`).click();
      await page.locator(`textarea[data-item-notes='${item.itemId}']`).fill(`审核 ${item.itemId}：记录本轮家长观察。`);
    }

    await review.locator("[data-review-tab='manifest']").click();
    for (const characterId of ["ming", "hua", "lin", "xing", "cao", "kan", "yuan", "hui", "bao", "feng", "mao", "pao"]) {
      await page.locator(`[data-character-decision='${characterId}'][data-decision-value='ACCEPT']`).click();
      await page.locator(`textarea[data-character-notes='${characterId}']`).fill(`审核 ${characterId}：独立 manifest 记录。`);
    }
    await page.locator("textarea[data-item-notes='final-manifest']").fill("12 字 manifest 汇总反馈。");

    await review.locator("[data-review-tab='abilities']").click();
    for (const abilityId of ["guardian-light", "star-path", "ink-echo"]) {
      await page.locator(`[data-ability-decision='${abilityId}'][data-decision-value='ACCEPT']`).click();
      await expect(page.getByTestId(`ability-review-${abilityId}`).getByRole("link")).toHaveAttribute("href", "?play=hanzi-v2-golden-slice&mode=review");
    }
    await page.locator("textarea[data-item-notes='ability-trio']").fill("三能力均只帮助观察，未代答。");

    await review.locator("[data-review-tab='assets']").click();
    for (const assetId of ["themeC", "mage", "companion", "commonMonster", "boss", "camp", "abilityCards", "meaningMagic"]) {
      await page.locator(`[data-asset-decision='${assetId}'][data-decision-value='ACCEPT']`).click();
    }
    await expect(page.locator("[data-testid^='theme-c-seed-']")).toHaveCount(3);
    await page.locator("textarea[data-item-notes='theme-c']").fill("主题 C 资产汇总反馈。");

    await review.locator("[data-review-tab='audio']").click();
    await expect(page.locator("[data-parent-tts-character]")).toHaveCount(4);
    await page.locator("[data-audio-decision='ACCEPT CURRENT CANDIDATE']").click();
    await page.locator("textarea[data-item-notes='audio-and-accessibility']").fill("仅作家长 TTS 候选，视觉 fallback 保留。");

    await review.locator("[data-review-tab='child-gate']").click();
    await expect(page.locator("[data-gate-check]")).toHaveCount(10);

    await review.locator("[data-review-tab='summary']").click();
    await page.locator("[data-child-use='NOT_YET']").click();
    await page.locator("textarea[data-general-notes]").fill("暂不启动真实儿童首次使用；先保留本地家长审核记录。");
    await review.locator("[data-review-tab='scope']").click();
    await review.locator("[data-review-tab='summary']").click();
    await expect(page.locator("[data-summary-progress]")).toHaveText("53 / 53");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出审核 JSON", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("STEP-03_PARENT_REVIEW_FEEDBACK.json");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const feedback = JSON.parse(await readFile(downloadPath!, "utf8"));
    expect(feedback).toMatchObject({
      schemaVersion: 2,
      initiativeId: "hanzi-radical-battle-v2",
      goldenSliceDecision: "ACCEPT",
      manifestDecision: "ACCEPT",
      abilityDecisions: { "guardian-light": "ACCEPT", "star-path": "ACCEPT", "ink-echo": "ACCEPT" },
      bossDecision: "ACCEPT",
      assetDecisions: { themeC: "ACCEPT", mage: "ACCEPT", companion: "ACCEPT", commonMonster: "ACCEPT", boss: "ACCEPT", camp: "ACCEPT", abilityCards: "ACCEPT", meaningMagic: "ACCEPT" },
      audioDecision: "ACCEPT CURRENT CANDIDATE",
      authorizeChildFirstUse: "NOT_YET",
      generalNotes: "暂不启动真实儿童首次使用；先保留本地家长审核记录。",
      reviewMeta: { completed: true },
    });
    expect(feedback.decisions.items).toHaveLength(8);
    expect(feedback.decisions.characters).toHaveLength(12);
    expect(feedback.decisions.items.every((item: { itemId: string; revisionHash: string }) => item.itemId && /^fnv1a:[0-9a-f]{8}$/.test(item.revisionHash))).toBe(true);

    await page.goto(HUB_URL);
    await page.evaluate((key) => localStorage.removeItem(key), REVIEW_DRAFT_KEY);
    await page.goto(REVIEW_URL);
    await review.locator("[data-review-tab='summary']").click();
    await page.locator("input[data-import-review]").setInputFiles({
      name: "STEP-03_PARENT_REVIEW_FEEDBACK.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(feedback)),
    });
    await expect(review.getByText("Round 2", { exact: false })).toBeVisible();
    await expect(page.getByText("19 项已折叠沿用", { exact: false })).toBeVisible();
    await review.locator("[data-review-tab='child-gate']").click();
    await expect(page.locator("[data-review-item='child-use-gate']")).toBeVisible();
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.remoteRequests).toEqual([]);
  });
});

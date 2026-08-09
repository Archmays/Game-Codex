import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const REVIEW_URL = "/?review=hanzi-v2-step02";
const SAVE_KEY = "family-games/hanzi-radical-battle-v2-pilot/state";

test.describe("Hanzi Radical Battle V2 STEP 02", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REVIEW_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByTestId("step02-review-app")).toBeVisible();
  });

  test("opens the real five-card pilot within two actions and completes the permanent world-change loop", async ({ page }) => {
    const pilot = page.getByTestId("core-spell-pilot");
    await expect(pilot).toHaveAttribute("data-phase", "camp_intro");

    await page.getByRole("button", { name: "沿着灯路出发" }).click();
    await expect(pilot).toHaveAttribute("data-phase", "encounter_intro");
    await page.getByRole("button", { name: "靠近看看" }).click();
    await expect(pilot).toHaveAttribute("data-phase", "placing");
    await expect(page.getByTestId("spell-hand").getByRole("button")).toHaveCount(5);

    await page.getByTestId("card-ming-yue").click();
    await page.getByTestId("slot-left").click();
    await expect(pilot).toHaveAttribute("data-phase", "invalid_feedback");
    await expect(page.getByText("字灵没有丢")).toBeVisible();
    await expect(pilot).toHaveAttribute("data-phase", "placing");
    await expect(page.getByTestId("card-ming-yue")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("card-ming-yue").click();
    await page.getByTestId("slot-left").click();
    await expect(pilot).toHaveAttribute("data-phase", "invalid_feedback");
    await expect(page.getByTestId("slot-right")).toHaveClass(/is-hinted/);
    await expect(pilot).toHaveAttribute("data-phase", "placing");

    await page.getByTestId("card-ming-ri").dragTo(page.getByTestId("slot-left"));
    await page.getByTestId("card-ming-yue").click();
    await page.getByTestId("slot-right").click();
    await expect(pilot).toHaveAttribute("data-phase", "forming_character");
    await expect(page.getByTestId("formed-character")).toContainText("明");

    await expect(pilot).toHaveAttribute("data-phase", "spellbook", { timeout: 8_000 });
    await expect(page.getByTestId("spellbook-card")).toContainText("míng");
    await expect(page.getByTestId("spellbook-card")).toContainText("明亮");
    await page.getByRole("button", { name: "把这道光留在营地" }).click();
    await expect(pilot).toHaveAttribute("data-phase", "complete");

    const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);
    expect(Object.keys(save).sort()).toEqual(
      [
        "schemaVersion",
        "campLampRepaired",
        "spellbookCharacterIds",
        "muted",
        "reducedMotion",
        "selectedThemeForReview",
        "minimumPilotEvents",
      ].sort(),
    );
    expect(save).toMatchObject({
      schemaVersion: 1,
      campLampRepaired: true,
      spellbookCharacterIds: ["ming"],
    });
    expect(save.minimumPilotEvents).toEqual(expect.arrayContaining(["character_formed", "spell_cast", "camp_repaired"]));

    await page.reload();
    await expect(page.getByText("营地灯已修好")).toBeVisible();
  });

  test("keeps the review workbench complete, local, and exportable with explicit missing decisions", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const remoteRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") remoteRequests.push(request.url());
    });
    await page.reload();

    await expect(page.locator("[data-review-tab]")).toHaveCount(6);
    await page.locator("[data-core-decision='ACCEPT']").click();
    await page.getByRole("button", { name: /15 字候选/ }).click();
    await expect(page.locator("[data-candidate-id]")).toHaveCount(15);
    await expect(page.getByTestId("candidate-card-ming")).not.toContainText("已通过儿童审核");
    await page.locator("[data-character-decision='ming']").selectOption("ACCEPT");
    const allImagesLoaded = await page.locator(".candidate-card__visual img").evaluateAll((images) =>
      images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
    );
    expect(allImagesLoaded).toBe(true);

    await page.getByRole("button", { name: /视觉方向/ }).click();
    await expect(page.locator("[data-theme-card]")).toHaveCount(3);
    await page.getByRole("button", { name: "选择 B" }).click();
    await expect(page.locator("[data-theme-card='B']")).toHaveClass(/is-selected/);

    await page.getByRole("button", { name: /故事板/ }).click();
    await expect(page.locator(".storyboard-beat")).toHaveCount(7);
    await page.locator("[data-story-decision='story-camp']").selectOption("ACCEPT");

    await page.getByRole("button", { name: /汇总与导出/ }).click();
    await page.locator("[data-authorization='NOT_YET']").click();
    await expect(page.locator("[data-summary-progress]")).toHaveText("5 / 25");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出审核 JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("STEP-02_PARENT_REVIEW_FEEDBACK.json");
    const path = await download.path();
    expect(path).toBeTruthy();
    const feedback = JSON.parse(await readFile(path!, "utf8"));
    expect(feedback).toMatchObject({
      schemaVersion: 1,
      initiativeId: "hanzi-radical-battle-v2",
      pilotIdentity: {
        anchorCharacterId: "ming",
        scenarioId: "pilot-ming-left-right",
        candidateManifestVersion: "step02-candidates-v2",
        selectedTheme: "B",
      },
      reviewMeta: { completed: false },
    });
    expect(feedback.decisions.characters).toHaveLength(15);
    expect(feedback.decisions.storyboard).toHaveLength(7);
    expect(feedback.reviewMeta.missingRequiredDecisionIds).toHaveLength(20);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(remoteRequests).toEqual([]);
  });

  test("offers mute, reduced motion, theme review, and scoped reset without remote state", async ({ page }) => {
    const pilot = page.getByTestId("core-spell-pilot");
    await page.getByRole("button", { name: /打开声音、动态和视觉方向设置/ }).click();
    const settings = page.getByTestId("settings-overlay");
    await expect(settings).toBeVisible();
    await settings.getByLabel("安静模式").check();
    await settings.getByLabel("减少动态").check();
    await settings.getByRole("button", { name: /B · 剪纸字灵/ }).click();
    await expect(pilot).toHaveAttribute("data-theme", "B");
    await settings.getByRole("button", { name: /A · 暖墨绘本/ }).click();
    await expect(pilot).toHaveAttribute("data-theme", "A");
    await settings.getByRole("button", { name: /C · 夜光墨林/ }).click();
    await settings.getByRole("button", { name: "关闭设置" }).click();
    await expect(pilot).toHaveAttribute("data-theme", "C");
    await expect(pilot).toHaveAttribute("data-reduced-motion", "true");

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.every((key) => key.startsWith("family-games/"))).toBe(true);
    expect(keys).toContain(SAVE_KEY);
  });

  test("keeps the five-card interaction usable at the required mobile, tablet, and desktop viewports", async ({ page }) => {
    await page.getByRole("button", { name: "沿着灯路出发" }).click();
    await page.getByRole("button", { name: "靠近看看" }).click();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("spell-hand")).toBeVisible();
      await expect(page.getByTestId("structure-board")).toBeVisible();
      const cardBoxes = await page.getByTestId("spell-hand").getByRole("button").evaluateAll((cards) =>
        cards.map((card) => {
          const rect = card.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
      expect(cardBoxes).toHaveLength(5);
      expect(cardBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);
    }
  });

  test("leaves the default ten-game hub and existing enter/return flow unchanged", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "儿童学习游戏大厅" })).toBeVisible();
    await expect(page.locator(".game-card")).toHaveCount(10);
    const firstTitle = await page.locator(".game-card h2").first().textContent();
    await page.locator(".game-card .game-card__button").first().click();
    await expect(page.locator(".game-topbar strong")).toHaveText(firstTitle ?? "");
    await page.getByRole("button", { name: "返回大厅" }).click();
    await expect(page.locator(".game-card")).toHaveCount(10);
  });
});

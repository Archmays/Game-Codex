import { expect, test } from "@playwright/test";
import { ENGLISH_V2_THEMES, storyWordsForTheme, ENGLISH_V2_WORD_BY_ID } from "../../../games/english-spell-battle/v2/content/manifest";
import { PILOT_TASK_IDS, isPilotTask } from "../../../games/english-spell-battle/v2/pilot/model";
import { ENGLISH_WORLD_SAVE_KEY as KEY } from "../../../games/english-spell-battle/v2/save/save";
import { applyCanonicalPilot, buildPilotWord } from "./pilot-helpers";

test("five regions keep all 30 ordered entries and distinguish scenes from word cards", async ({ page }, info) => {
    const activate = async (selector: string) => info.project.use.hasTouch ? page.locator(selector).last().tap() : page.locator(selector).last().click();
  let sceneCount = 0, cardCount = 0;
  await page.goto("/?world=english-world");
  await expect(page.locator('[data-theme-id]')).toHaveCount(5);
  for (const theme of ENGLISH_V2_THEMES) {
    await activate(`[data-theme-id="${theme.id}"]`);
    const expected = storyWordsForTheme(theme.id).map(word => word.id);
    expect(await page.locator('[data-word-id]').evaluateAll(elements => elements.map(e => e.getAttribute("data-word-id")))).toEqual(expected);
    for (const id of expected) {
      const entry = page.locator(`[data-word-id="${id}"]`);
      const action = (await entry.innerText()).trim();
      if (isPilotTask(id)) { expect(action).toMatch(/选.*(跑|跳|红色|蓝色|发光|启航)/); sceneCount++; }
      else { expect(action).toBe("看图拼词"); cardCount++; }
      const box = await entry.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(48);
      await activate(`[data-word-id="${id}"]`);
      await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", isPilotTask(id) ? "interactive" : "meaning");
      await activate('[data-action="region"]');
    }
    await page.locator('[data-action="map"]').first().click();
  }
  expect(sceneCount).toBe(6); expect(cardCount).toBe(24);
});

test("journal and region distinguish scene-only, word-card and combined history without inferring mastery", async ({ page }, info) => {
  const input = info.project.use.hasTouch ? "tap" : "click";
  await page.goto("/?world=english-world&region=actions&word=word-run");
  await applyCanonicalPilot(page, "word-run", input);
  await page.locator('[data-action="journal"]').click();
  const journalRun = page.locator('[data-testid="journal-word"][data-word-id="word-run"]');
  await expect(journalRun.locator('.wordlight-activity-history')).toHaveText("场景玩过");
  await page.goto("/?world=english-world&region=actions");
  await expect(page.locator('[data-word-id="word-run"]').locator('..').locator('.wordlight-activity-history')).toHaveText("场景玩过");
  await page.locator('[data-word-id="word-run"]').click();
  await buildPilotWord(page, "word-run", input);
  await page.locator('[data-pilot-action="reset"]').click();
  await applyCanonicalPilot(page, "word-run", input);
  await page.locator('[data-action="journal"]').click();
  await expect(journalRun.locator('.wordlight-activity-history')).toHaveText("场景玩过 · 词卡活动完成过");
  await expect(page.locator('[data-testid="journal-word"][data-word-id="word-cat"] .wordlight-activity-history')).toHaveText("来看看、拼一拼");
  const before = await page.evaluate(key => localStorage.getItem(key), KEY);
  await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(before);
  await expect(page.getByTestId("english-journal")).not.toContainText(/还没遇见|从未见过|未掌握|已掌握|独立拼写成功/);
});

test("heart marks only the mapped irregular graphemes in optional spelling and journal", async ({ page }) => {
  await page.goto("/?world=english-world&region=colors&word=word-one");
  await page.locator('[data-pilot-action="spelling"]').click();
  const expected = ENGLISH_V2_WORD_BY_ID.get("word-one")!.graphemeUnits.filter(unit => unit.role === "irregular-heart").map(unit => unit.letters);
  expect(expected).toEqual(["o", "e"]);
  const mapped = page.locator('.wordlight-sound-map [data-role="irregular-heart"]');
  await expect(mapped.locator('.wordlight-heart')).toHaveCount(2);
  expect(await mapped.evaluateAll(elements => elements.map(e => e.textContent?.replace("♥", "")))).toEqual(expected);
  await expect(page.locator('.wordlight-sound-map [data-role="regular"] .wordlight-heart')).toHaveCount(0);
  await expect(page.locator('.wordlight-build')).toContainText("这里需要特别记住");
  for (let i=0;i<4;i++) await page.locator('.pilot-spelling [data-action="hint"]').click();
  await expect(mapped.locator('.wordlight-heart')).toHaveCount(2);
  await page.locator('[data-action="journal"]').click();
  await expect(page.locator('[data-testid="journal-word"][data-word-id="word-one"] .wordlight-heart')).toHaveCount(2);
  await expect(page.locator('[data-testid="journal-word"][data-word-id="word-cat"] .wordlight-heart')).toHaveCount(0);
  expect(PILOT_TASK_IDS).toHaveLength(6);
});

import { expect, test } from "@playwright/test";

test("visual and geometry states", async ({ page }, testInfo) => {
  const routes = [
    ["world", "/?play=hanzi-magic-complete&from=hub", "complete-support-activities"],
    ["pinyin-assemble", "/?play=hanzi-magic-complete&view=pinyin&mode=assemble&seed=visual", "sound-rhyme-trial"],
    ["pinyin-tone", "/?play=hanzi-magic-complete&view=pinyin&mode=tone&seed=visual", "sound-rhyme-trial"],
    ["pinyin-contrast", "/?play=hanzi-magic-complete&view=pinyin&mode=contrast&seed=visual", "sound-rhyme-trial"],
    ["memory-glyph-pinyin", "/?play=hanzi-magic-complete&view=memory&pack=glyph-pinyin&seed=visual", "memory-match"],
    ["classic-four", "/?hub=classic", null],
  ] as const;
  for (const [name, route, testId] of routes) {
    await page.goto(route);
    if (testId) await expect(page.getByTestId(testId)).toBeVisible(); else await expect(page.locator(".game-card")).toHaveCount(4);
    const geometry = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.getBoundingClientRect().height,
    }));
    expect(geometry.scroll - geometry.client, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
    expect(geometry.bodyHeight, `${name} body height`).toBeGreaterThan(300);
    if (name === "world") expect(geometry.pageHeight - Math.ceil(geometry.bodyHeight), "world decorative bottom overflow").toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  }
  await page.goto("/?play=hanzi-magic-complete&view=memory&pack=glyph-pinyin&seed=visual-complete");
  const relationIds = await page.locator("[data-card-id]").evaluateAll((cards) => [...new Set(cards.map((card) => (card as HTMLElement).dataset.relationId!))]);
  for (const id of relationIds) {
    const pair = page.locator(`[data-relation-id="${id}"]`);
    await pair.nth(0).click();
    await pair.nth(1).click();
  }
  await expect(page.getByTestId("memory-complete")).toBeVisible();
  await expect(page).toHaveScreenshot("memory-completed.png", { fullPage: true });
  await page.addInitScript(() => { Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined }); Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined }); });
  await page.goto("/?play=hanzi-magic-complete&view=pinyin&mode=tone&seed=visual-no-voice");
  await expect(page.getByTestId("pinyin-no-voice")).toBeVisible();
  await expect(page).toHaveScreenshot("pinyin-no-voice.png", { fullPage: true });
  expect(testInfo.errors).toEqual([]);
});

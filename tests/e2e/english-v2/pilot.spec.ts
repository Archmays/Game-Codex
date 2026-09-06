import { expect, test, type Page } from "@playwright/test";
import { ENGLISH_WORLD_SAVE_KEY, createDefaultEnglishWorldSave, updateEnglishWorldSave } from "../../../games/english-spell-battle/v2/save/save";
import { ENGLISH_INTERACTION_REVISION, PILOT_TASK_IDS, PILOT_SENTENCES, type PilotTaskId } from "../../../games/english-spell-battle/v2/pilot/model";
import { pilotActivate, buildPilotWord } from "./pilot-helpers";

const readSave = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), ENGLISH_WORLD_SAVE_KEY);
const openPilot = async (page: Page, id: PilotTaskId) => {
  await page.goto(`/?world=english-world&region=${id === "word-run" || id === "word-jump" ? "actions" : "colors"}&word=${id}`);
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "interactive");
};

for (const id of PILOT_TASK_IDS) test(`${id}: direct exploration, alternative outcomes, current truth, spelling boundary and reload`, async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const mode = testInfo.project.name === "mobile-390" ? "tap" : "click";
  const activate = pilotActivate(page, mode);
  const click = (selector: string) => activate(page.locator(selector));
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url()); });
  await openPilot(page, id);
  await expect(page.locator(".pilot-spelling")).toHaveCount(0);
  for (let attempt = 0; attempt < 3; attempt++) await click('[data-pilot-action="execute"]');
  expect((await readSave(page)).interactions[id].interactionCompleted).toBe(false);
  const beforeHelp = await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY);
  for (let level = 0; level < 3; level++) await click('[data-pilot-action="help"]');
  expect(await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY)).toBe(beforeHelp);

  if (id === "word-run" || id === "word-jump") {
    await click('[data-pilot-word="run"]'); await click('[data-pilot-object="B"]'); await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "B");
    expect((await readSave(page)).interactions[id].interactionCompleted).toBe(id === "word-run");
    await click('[data-pilot-object="C"]'); await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "B");
    await expect(page.locator(".pilot-feedback")).toContainText("There is a gap");
    await click('[data-pilot-word="jump"]'); await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "C");
    await page.reload(); await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "C");
    await click('[data-pilot-object="E"]'); await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "E");
    // Different road route to the same destination; the target action is explicit.
    await click('[data-pilot-action="reset"]');
    await click(`[data-pilot-word="${id.slice(5)}"]`);
    for (const dest of ["B", "D", "E"]) { await click(`[data-pilot-object="${dest}"]`); await click('[data-pilot-action="execute"]'); }
    await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", "E");
  } else if (id === "word-red" || id === "word-blue") {
    const target = id.slice(5), alternative = target === "red" ? "blue" : "red";
    await click('[data-pilot-object="A"]'); await click(`[data-pilot-word="${target}"]`); await click('[data-pilot-action="execute"]');
    await expect(page.locator('[data-pilot-object="A"]')).toHaveAttribute("data-color", target);
    await expect(page.locator('[data-pilot-object="B"]')).toHaveAttribute("data-color", alternative);
    await click(`[data-pilot-word="${alternative}"]`);
    await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(PILOT_SENTENCES[id]);
    await expect(page.locator(".pilot-draft")).toContainText(alternative);
    await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(`The ${id === "word-red" ? "shell" : "boat"} is ${alternative}.`);
    await click('[data-pilot-object="C"]'); await click(`[data-pilot-word="${target}"]`); await click('[data-pilot-action="execute"]');
    await expect(page.locator('[data-pilot-object="C"]')).toHaveAttribute("data-color", target);
    await expect(page.locator('[data-pilot-object="A"]')).toHaveAttribute("data-color", alternative);
    await page.reload(); await expect(page.locator('[data-pilot-object="C"]')).toHaveAttribute("data-color", target);
  } else {
    await click(`[data-pilot-word="${id.slice(5)}"]`);
    await click('[data-pilot-object="A"]');
    if (id === "word-two") {
      await click('[data-pilot-action="execute"]'); expect((await readSave(page)).interactions[id].state.active).toEqual([]);
      await click('[data-pilot-object="B"]');
    }
    await click('[data-pilot-action="execute"]');
    await expect(page.locator('.pilot-object[data-active="true"]')).toHaveCount(id === "word-one" ? 1 : 2);
    await expect(page.locator('.pilot-object[data-active="false"]')).toHaveCount(id === "word-one" ? 2 : 1);
    await expect(page.locator(".pilot-object svg")).toHaveCount(3);
    // Alternative identities, including replacing a selection without duplicated IDs.
    await click('[data-pilot-object="A"]'); await click('[data-pilot-object="C"]'); await click('[data-pilot-action="execute"]');
    await expect(page.locator('[data-pilot-object="C"]')).toHaveAttribute("data-active", "true");
    await expect(page.locator('[data-pilot-object="A"]')).toHaveAttribute("data-active", "false");
    await page.reload(); await expect(page.locator('[data-pilot-object="C"]')).toHaveAttribute("data-active", "true");
    // Same objects, changed number word: cardinality must follow the word.
    await click(`[data-pilot-word="${id === "word-one" ? "two" : "one"}"]`);
    await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(PILOT_SENTENCES[id]);
    await click('[data-pilot-object="B"]'); await click('[data-pilot-action="execute"]');
    await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(id === "word-one" ? "Two shells shine." : "One boat sails.");
  }
  const explored = await readSave(page);
  expect(explored.interactions[id].interactionCompleted).toBe(true);
  expect(explored.completedStoryWordIds).toEqual([]); expect(explored.completedSentenceIds).toEqual([]);
  expect(explored.interactionRevision).toBe(ENGLISH_INTERACTION_REVISION);
  await click('[data-action="journal"]'); await expect(page.getByTestId("english-journal")).toBeVisible();
  const inJournal = await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY);
  await page.keyboard.press('Escape'); await expect(page.getByTestId('english-journal')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY)).toBe(inJournal);
  await page.goBack(); expect((await readSave(page)).interactions[id]).toEqual(explored.interactions[id]);
  await click('[data-action="settings"]'); await page.getByRole("checkbox", { name: "减少动态效果" }).check();
  await page.getByRole("checkbox", { name: "可选整词和整句声音" }).uncheck();
  await page.keyboard.press("Escape"); await expect(page.locator('[data-action="settings"]')).toBeFocused();
  await buildPilotWord(page, id, mode);
  expect((await readSave(page)).completedStoryWordIds).toEqual([]);
  await click('[data-pilot-action="reset"]'); await click(`[data-pilot-word="${id.slice(5)}"]`);
  for (const objectId of id === "word-two" ? ["B", "C"] : ["B"]) await click(`[data-pilot-object="${objectId}"]`);
  await click('[data-pilot-action="execute"]');
  const done = await readSave(page);
  expect(done.completedStoryWordIds).toEqual([id]); expect(done.completedSentenceIds).toHaveLength(1);
  await click('[data-pilot-action="execute"]');
  expect((await readSave(page)).completedStoryWordIds).toEqual([id]);
  const state = (await readSave(page)).interactions[id].state;
  await click('[data-pilot-action="cancel"]');
  await expect(page.locator(".pilot-draft")).toContainText("—");
  await page.reload(); expect((await readSave(page)).interactions[id].interactionCompleted).toBe(true);
  if (state.kind === "park") await expect(page.getByTestId("pilot-scene")).toHaveAttribute("data-position", state.position);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test("all profiles expose 48px critical controls with real focus, geometry and hit targets", async ({ page }, testInfo) => {
  for (const id of ["word-jump", "word-one", "word-two"] as const) {
    await openPilot(page, id);
    const containment = await page.getByTestId('pilot-scene').evaluate(scene => {
      const outer = scene.getBoundingClientRect();
      return [...scene.querySelectorAll('.pilot-object')].every(object => {
        const rect = object.getBoundingClientRect();
        return rect.top >= outer.top && rect.bottom <= outer.bottom && rect.left >= outer.left && rect.right <= outer.right;
      });
    });
    expect(containment).toBe(true);
    const controls = page.locator('.pilot-word-cards button, [data-pilot-object], .pilot-execute, .pilot-secondary button');
    for (const control of await controls.all()) {
      await control.scrollIntoViewIfNeeded();
      const geometry = await control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hits = [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]].map(([x, y]) => element.contains(document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y)));
        return { width: rect.width, height: rect.height, hits };
      });
      expect(geometry.width).toBeGreaterThanOrEqual(48); expect(geometry.height).toBeGreaterThanOrEqual(48); expect(geometry.hits.every(Boolean)).toBe(true);
    }
    const boxes = await controls.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]; expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
    }
    const input = testInfo.project.name.startsWith("mobile") ? "tap" : "keyboard";
    const activate = pilotActivate(page, input);
    for (const selector of [`[data-pilot-word="${id.slice(5)}"]`, '[data-pilot-object="B"]', ...(id === "word-two" ? ['[data-pilot-object="C"]'] : []), '[data-pilot-action="execute"]']) await activate(page.locator(selector));
    await expect(page.getByTestId("pilot-current").locator("p")).toHaveText(PILOT_SENTENCES[id]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("future, malformed, unknown-rule and replaced V3 bytes stay read-only across all English writers", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await openPilot(page, "word-jump");
  for (const raw of ['{"version":9,"keep":"future"}', '{bad', 'null', JSON.stringify({ ...createDefaultEnglishWorldSave(), interactionRevision: "unknown" })]) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [ENGLISH_WORLD_SAVE_KEY, raw]); await page.reload();
    await page.locator('[data-pilot-word="jump"]').click(); await page.locator('[data-pilot-object="B"]').click(); await page.locator('[data-pilot-action="execute"]').click();
    await page.locator('[data-action="settings"]').click(); await page.getByRole("checkbox", { name: "减少动态效果" }).check(); await page.keyboard.press("Escape");
    await page.locator('[data-action="journal"]').click(); await page.goBack();
    expect(await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY)).toBe(raw);
  }
  const original = JSON.stringify(createDefaultEnglishWorldSave());
  await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [ENGLISH_WORLD_SAVE_KEY, original]); await page.reload();
  const other = await context.newPage(); await other.goto('/?world=english-world');
  const replacement = JSON.stringify(updateEnglishWorldSave(createDefaultEnglishWorldSave(), { completedStoryWordIds: ["word-cat"] }));
  await other.evaluate(([key, raw]) => localStorage.setItem(key, raw), [ENGLISH_WORLD_SAVE_KEY, replacement]);
  await expect(page.locator(".wordlight-notice")).toContainText("另一页");
  await page.locator('[data-pilot-word="jump"]').click(); await page.locator('[data-pilot-object="B"]').click(); await page.locator('[data-pilot-action="execute"]').click();
  expect(await page.evaluate(key => localStorage.getItem(key), ENGLISH_WORLD_SAVE_KEY)).toBe(replacement);
  await other.close();
});

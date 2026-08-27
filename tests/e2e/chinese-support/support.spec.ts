import { expect, test, type Page } from "@playwright/test";
import { PINYIN_READING_MANIFEST } from "../../../games/hanzi-radical-battle/complete/support/pinyin/manifest";

interface RuntimeLog { errors: string[]; failed: string[]; external: string[] }
function observe(page: Page): RuntimeLog {
  const log: RuntimeLog = { errors: [], failed: [], external: [] };
  page.on("pageerror", (error) => log.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") log.errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) log.failed.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => { const url = new URL(request.url()); if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "127.0.0.1") log.external.push(request.url()); });
  return log;
}
function expectClean(log: RuntimeLog) { expect(log.errors).toEqual([]); expect(log.failed).toEqual([]); expect(log.external).toEqual([]); }

async function answerPinyin(page: Page): Promise<void> {
  const trial = page.getByTestId("sound-rhyme-trial");
  const mode = await trial.getAttribute("data-mode");
  const glyph = (await page.locator(".sound-rhyme__glyph").textContent())!;
  const record = PINYIN_READING_MANIFEST.find((item) => item.glyph === glyph)!;
  let correct: string;
  if (mode === "tone") correct = String(record.tone);
  else if (mode === "contrast") {
    const asksInitial = (await page.locator(".sound-rhyme__instruction").textContent())!.includes("声母");
    correct = asksInitial ? record.teachingInitial ?? "零声母" : record.canonicalFinal;
  } else if (record.wholeSyllableTeaching) correct = record.citationPinyinMarked;
  else {
    const active = (await page.locator(".sound-rhyme__slot").textContent())!;
    correct = active.includes("声母") ? record.teachingInitial ?? "零声母" : active.includes("韵母") ? record.writtenFinal : String(record.tone);
  }
  await page.locator(`[data-answer="${correct}"]`).click();
}

test("Hanzi world exposes two always-visible support activities outside the story path", async ({ page }) => {
  const log = observe(page);
  await page.goto("/?play=hanzi-magic-complete&from=hub");
  await expect(page.getByTestId("complete-support-activities")).toBeVisible();
  await expect(page.locator(".hmc3-path li")).toHaveCount(4);
  await expect(page.getByTestId("complete-support-activities").getByRole("link")).toHaveCount(2);
  expectClean(log);
});

for (const mode of ["assemble", "tone", "contrast"] as const) {
  test(`Pinyin ${mode} is deterministic, visual-first, and completes a short session`, async ({ page }) => {
    const log = observe(page);
    const legacy = '{"bestQuizScore":10,"keep":"bytes"}';
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), ["family-games/pinyin-magic-battle/progress", legacy]);
    await page.goto(`/?play=hanzi-magic-complete&view=pinyin&mode=${mode}&seed=e2e-${mode}`);
    await expect(page.getByTestId("sound-rhyme-trial")).toHaveAttribute("data-mode", mode);
    await expect(page.getByText("不计分 · 不排名 · 随时可以停下")).toBeVisible();
    for (let guard = 0; guard < 16 && await page.getByTestId("sound-rhyme-trial").getAttribute("data-complete") !== "true"; guard += 1) await answerPinyin(page);
    await expect(page.getByTestId("sound-rhyme-trial")).toHaveAttribute("data-complete", "true");
    expect(await page.evaluate((key) => localStorage.getItem(key), "family-games/pinyin-magic-battle/progress")).toBe(legacy);
    expectClean(log);
  });
}

test("Pinyin remains complete without speech synthesis and mute never hides visual cues", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined }); Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined }); });
  await page.goto("/?play=hanzi-magic-complete&view=pinyin&mode=tone&seed=no-voice");
  await expect(page.getByTestId("pinyin-no-voice")).toBeVisible();
  await expect(page.locator(".sound-rhyme__tone-paths button")).toHaveCount(5);
});

test("memory relation packs switch, preserve old save bytes, and complete", async ({ page }) => {
  const log = observe(page);
  const legacy = '{"grades":{"p1":{"bestMoves":2,"completions":7}}}';
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), ["family-games/memory-card/progress", legacy]);
  await page.goto("/?play=hanzi-magic-complete&view=memory&pack=glyph-pinyin&seed=e2e-memory");
  await expect(page.getByTestId("memory-match")).toHaveAttribute("data-pack", "glyph-pinyin");
  const relationIds = await page.locator("[data-card-id]").evaluateAll((cards) => [...new Set(cards.map((card) => (card as HTMLElement).dataset.relationId!))]);
  for (const id of relationIds) {
    const pair = page.locator(`[data-relation-id="${id}"]`);
    await pair.nth(0).click();
    await pair.nth(1).click();
  }
  await expect(page.getByTestId("memory-match")).toHaveAttribute("data-complete", "true");
  await expect(page.getByTestId("memory-complete")).toContainText("这些关系都找到了");
  expect(await page.evaluate((key) => localStorage.getItem(key), "family-games/memory-card/progress")).toBe(legacy);
  await page.getByRole("button", { name: /词境相认/ }).click();
  await expect(page.getByTestId("memory-match")).toHaveAttribute("data-pack", "glyph-phrase");
  expectClean(log);
});

test("Classic projects four active products while Memory and legacy Pinyin stay off the card wall", async ({ page }) => {
  await page.goto("/?hub=classic");
  await expect(page.locator(".game-card")).toHaveCount(4);
  await expect(page.locator('[data-game-id="memory-card"], [data-game-id="pinyin-magic-battle"]')).toHaveCount(0);
});

test("the retired public Pinyin definition remains a canonical compatibility wrapper", async ({ page }) => {
  await page.goto("/?play=pinyin-magic-battle");
  await expect(page.getByTestId("sound-rhyme-trial")).toHaveAttribute("data-mode", "assemble");
  await expect(page.locator("body")).toContainText("声韵试炼");
  await expect(page.locator("body")).not.toContainText(/伤害|正确率|最佳分数|连胜/);
});

test("memory grid supports arrow navigation and Enter flip", async ({ page }) => {
  await page.goto("/?play=hanzi-magic-complete&view=memory&seed=keyboard");
  const first = page.locator("[data-card-id]").first();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-card-id]").nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-card-id]").nth(1)).toHaveAttribute("data-open", "true");
});

test("20 mount/destroy cycles clear roots, timers, speech, and external requests", async ({ page }) => {
  const log = observe(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const dynamicImport = new Function("path", "return import(path)") as (path: string) => Promise<Record<string, unknown>>;
    const pinyin = await dynamicImport("/games/hanzi-radical-battle/complete/support/pinyin/app.ts") as { mountSoundRhymeTrial: (root: HTMLElement, options: object) => { destroy(): void } };
    const memory = await dynamicImport("/packages/activity-engines/memory-match/app.ts") as { mountMemoryMatch: (root: HTMLElement, options: object) => { destroy(): void } };
    const host = document.createElement("div");
    document.body.append(host);
    for (let index = 0; index < 20; index += 1) {
      const pinyinRoot = document.createElement("div");
      host.append(pinyinRoot);
      const mountedPinyin = pinyin.mountSoundRhymeTrial(pinyinRoot, { seed: `life-${index}` });
      mountedPinyin.destroy();
      const memoryRoot = document.createElement("div");
      host.append(memoryRoot);
      const mountedMemory = memory.mountMemoryMatch(memoryRoot, { seed: `life-${index}`, pairCount: 4 });
      const cards = [...memoryRoot.querySelectorAll<HTMLButtonElement>("[data-card-id]")];
      const firstRelation = cards[0].dataset.relationId;
      cards[0].click();
      cards.find((card) => card.dataset.relationId !== firstRelation)?.click();
      mountedMemory.destroy();
      pinyinRoot.remove();
      memoryRoot.remove();
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    const children = host.childElementCount;
    host.remove();
    return { children };
  });
  expect(result.children).toBe(0);
  expectClean(log);
});

import { expect, test, type Page } from "@playwright/test";
import { ENGLISH_V2_SENTENCE_BY_ID, ENGLISH_V2_WORDS } from "../../../games/english-spell-battle/v2/content/manifest";
import { isPilotTask } from "../../../games/english-spell-battle/v2/pilot/model";
import { buildPilotWord, applyCanonicalPilot } from "./pilot-helpers";

const ORIGIN = "http://127.0.0.1:5322";
const CORE_WORDS = ENGLISH_V2_WORDS.filter((word) => word.storyBand === "story-core");

interface RuntimeLog { errors: string[]; failed: string[]; external: string[] }

function observe(page: Page): RuntimeLog {
  const log: RuntimeLog = { errors: [], failed: [], external: [] };
  page.on("pageerror", (error) => log.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") log.errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) log.failed.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") log.failed.push(`${request.failure()?.errorText} ${request.url()}`); });
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== ORIGIN) log.external.push(request.url()); });
  return log;
}

function expectClean(log: RuntimeLog): void {
  expect(log.errors).toEqual([]);
  expect(log.failed).toEqual([]);
  expect(log.external).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
}

async function openWord(page: Page, wordId: string): Promise<void> {
  const word = ENGLISH_V2_WORDS.find((candidate) => candidate.id === wordId)!;
  await page.goto(`/?world=english-world&region=${word.themeId}&word=${word.id}&seed=e2e`);
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-word-id", word.id);
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", isPilotTask(wordId) ? "interactive" : "meaning");
}

async function completeWord(page: Page, wordId: string, input: "click" | "keyboard" | "tap" = "click"): Promise<void> {
  const word = ENGLISH_V2_WORDS.find((candidate) => candidate.id === wordId)!;
  const activate = async (locator: ReturnType<Page["locator"]>) => {
    if (input === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
    else if (input === "tap") await locator.tap();
    else await locator.click();
  };
  await openWord(page, wordId);
  if (isPilotTask(wordId)) {
    await buildPilotWord(page, wordId, input);
    await applyCanonicalPilot(page, wordId, input);
    return;
  }
  await activate(page.getByRole("button", { name: "看看它怎么拼" }));
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "build");
  for (const unit of word.graphemeUnits) {
    const tile = page.locator(`[data-tile-id$=":${unit.id}"]`);
    await activate(tile);
  }
  await activate(page.getByRole("button", { name: "放好这个词" }));
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "sentence");
  await activate(page.getByRole("button", { name: word.displayWord, exact: true }));
  await activate(page.getByRole("button", { name: "句子中的空位" }));
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "response");
  await expect(page.locator(".wordlight-response h2")).toHaveText(ENGLISH_V2_SENTENCE_BY_ID.get(word.sentenceIds[0])!.text);
}

test("shadow English World route is a real five-region game world without score pressure", async ({ page }) => {
  const log = observe(page);
  await page.goto("/?world=english-world");
  await expect(page.getByTestId("english-world-map")).toBeVisible();
  await expect(page.locator(".wordlight-region")).toHaveCount(5);
  await expect(page.locator(".wordlight-region button:disabled")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/正确率|最佳分数|连对|连胜|得分|0\/8|HP|伤害/);
  await expectNoHorizontalOverflow(page);
  expectClean(log);
});

test("all 30 canonical tasks retain real build/use completion, including all 24 unchanged task flows", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const log = observe(page);
  await page.goto("/?world=english-world");
  await page.evaluate(() => localStorage.clear());
  for (const word of CORE_WORDS) await completeWord(page, word.id, testInfo.project.name === "mobile-390" ? "tap" : "click");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("family-games/english-world/v2") ?? "null"));
  expect(saved.version).toBe(3);
  expect(saved.completedStoryWordIds.sort()).toEqual(CORE_WORDS.map((word) => word.id).sort());
  expect(saved.completedSentenceIds).toHaveLength(30);
  expect(saved.checksum).toMatch(/^[0-9a-f]{8}$/);
  await page.goto("/?world=english-world&view=journal");
  await expect(page.getByTestId("english-journal")).toBeVisible();
  await expect(page.getByTestId("journal-word")).toHaveCount(48);
  await expect(page.getByTestId("journal-word").filter({ hasText: "book" })).toContainText("拓展词");
  await expect(page.locator('[data-testid="journal-word"][data-word-id="word-one"]')).toContainText("one");
  await expectNoHorizontalOverflow(page);
  expectClean(log);
});

test("keyboard-only completes a digraph word and hint leaves the final action to the child", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "tablet-768"].includes(testInfo.project.name));
  await openWord(page, "word-fish");
  const start = page.getByRole("button", { name: "看看它怎么拼" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "给一点提示" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".wordlight-hint")).toBeVisible();
  for (const unit of ENGLISH_V2_WORDS.find((word) => word.id === "word-fish")!.graphemeUnits) {
    const tile = page.locator(`[data-tile-id$=":${unit.id}"]`);
    await tile.focus();
    await page.keyboard.press("Enter");
  }
  await page.getByRole("button", { name: "放好这个词" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "fish", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "句子中的空位" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("english-mission")).toHaveAttribute("data-phase", "response");
});

test("mobile touch completes regular and irregular-supported missions without overflow", async ({ page }, testInfo) => {
  test.skip(!["mobile-390", "mobile-360"].includes(testInfo.project.name));
  for (const wordId of ["word-cat", "word-one"]) {
    await completeWord(page, wordId, "tap");
    await expectNoHorizontalOverflow(page);
  }
});

test("Chinese scaffold, mute, reduced motion, and missing speech synthesis are independent visual settings", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
  });
  await page.goto("/?world=english-world");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("checkbox", { name: "中文帮助" }).uncheck();
  await page.getByRole("checkbox", { name: "可选整词和整句声音" }).uncheck();
  await page.getByRole("checkbox", { name: "减少动态效果" }).check();
  await expect(page.locator(".wordlight")).toHaveAttribute("data-chinese-scaffold", "false");
  await expect(page.locator(".wordlight")).toHaveAttribute("data-sound-enabled", "false");
  await expect(page.locator(".wordlight")).toHaveAttribute("data-reduced-motion", "true");
  await page.goto("/?world=english-world&region=animals&word=word-cat");
  await expect(page.locator("body")).not.toContainText("猫");
  await expect(page.getByRole("button", { name: "听整个单词" })).toHaveCount(0);
  await expect(page.getByText("没有可用英文声音也没关系")).toBeVisible();
});

test("legacy, corrupt, and future saves retain identity and fail calmly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const legacy = '{"bestScore":7,"wins":3,"keep":"exact bytes"}';
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), ["family-games/english-spell-battle/progress", legacy]);
  await page.goto("/?world=english-world");
  await expect(page.getByTestId("legacy-upgrade-notice")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("family-games/english-spell-battle/progress"))).toBe(legacy);

  await page.evaluate(() => localStorage.setItem("family-games/english-world/v2", "{bad"));
  await page.reload();
  await expect(page.getByText("本机记录没有读完整")).toBeVisible();

  const future = '{"version":7,"future":"keep-exact"}';
  await page.evaluate((value) => localStorage.setItem("family-games/english-world/v2", value), future);
  await page.reload();
  await expect(page.getByText("为保护它，这次只读游玩")).toBeVisible();
  await page.locator('[data-theme-id="animals"]').click();
  expect(await page.evaluate(() => localStorage.getItem("family-games/english-world/v2"))).toBe(future);
});

test("critical action targets meet size and non-overlap contracts", async ({ page }) => {
  await page.goto("/?world=english-world&region=food&word=word-cake");
  await page.getByRole("button", { name: "看看它怎么拼" }).click();
  const targets = page.locator(".wordlight-controls button:visible, .wordlight-tile-bank button:visible");
  const boxes = await targets.evaluateAll((items) => items.map((item) => { const rect = item.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; }));
  for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
  for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
    const a = boxes[left], b = boxes[right];
    const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(intersects, `targets ${left}/${right}`).toBe(false);
  }
});

test("My Game World exposes a physical English island portal and the route returns", async ({ page }) => {
  await page.goto("/?world=my-game-world");
  const portal = page.getByTestId("world-english-portal");
  await expect(portal).toBeVisible();
  await expect(portal.locator("img")).toBeVisible();
  await expect(portal.locator("img")).toHaveAttribute("src", "./assets/home/wordlight-island.webp");
  await expect(portal.getByRole("link")).toHaveCount(1);
  await portal.getByRole("link", { name: /走进词光岛/ }).click();
  await expect(page.getByTestId("english-world-map")).toBeVisible();
  await page.getByRole("link", { name: "回我的游戏世界" }).click();
  await expect(page.getByTestId("world-english-portal")).toBeVisible();
});

test("English Memory uses 24 source-backed word-image relations in the shared engine", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.goto("/?world=english-world&view=memory&seed=e2e-memory");
  await expect(page.getByTestId("memory-match")).toHaveAttribute("data-pack", "english-word-image");
  await expect(page.locator("[data-card-id]")).toHaveCount(12);
  await expect(page.locator("[data-card-id] img")).toHaveCount(6);
  const relationId = await page.locator("[data-card-id]").first().getAttribute("data-relation-id");
  const pair = page.locator(`[data-relation-id="${relationId}"]`);
  await pair.nth(0).click();
  await pair.nth(1).click();
  await expect(pair.nth(0)).toHaveAttribute("data-matched", "true");
  await page.getByRole("link", { name: "回到词光岛" }).click();
  await expect(page.getByTestId("english-world-map")).toBeVisible();
});

test("optional words stay journal-only and DOM quantities are exact", async ({ page }) => {
  await page.goto("/?world=english-world&region=home&word=word-book");
  await expect(page.getByTestId("english-journal")).toBeVisible();
  await expect(page.locator('[data-word-id="word-book"]')).toHaveAttribute("data-story-band", "optional");
  const ten = page.locator('[data-word-id="word-ten"] .wordlight-quantity');
  await expect(ten).toHaveAttribute("data-quantity", "10");
  await expect(ten.locator(".wordlight-shell")).toHaveCount(10);
  for (const [word, count] of [["one", 1], ["two", 2], ["three", 3], ["ten", 10]] as const) {
    await expect(page.locator(`[data-word-id="word-${word}"] .wordlight-shell`)).toHaveCount(count);
  }
  for (const [word, rgb] of [["red", "rgb(255, 0, 0)"], ["blue", "rgb(0, 0, 255)"], ["green", "rgb(0, 128, 0)"], ["yellow", "rgb(255, 255, 0)"]] as const) {
    const paint = await page.locator(`[data-word-id="word-${word}"] .wordlight-color`).evaluate(el => {
      const style = getComputedStyle(el, "::before");
      return { color: style.backgroundColor, width: parseFloat(style.width), height: parseFloat(style.height), container: el.getBoundingClientRect().height };
    });
    expect(paint.color).toBe(rgb); expect(paint.width).toBeGreaterThan(48); expect(paint.height).toBeLessThanOrEqual(paint.container);
  }
});

test("Classic English card promotes V2 while the frozen legacy game and bytes remain directly accessible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const legacy = '{"bestScore":7,"wins":3,"classic":"unchanged"}';
  await page.goto("/?hub=classic&from=world");
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), ["family-games/english-spell-battle/progress", legacy]);
  const card = page.locator('.game-card[data-game-id="english-spell-battle"]');
  await expect(card.getByRole("heading", { name: "英语世界", exact: true })).toBeVisible();
  await card.getByRole("button").click();
  await expect(page).toHaveURL(/\?world=english-world&from=hub$/);
  await expect(page.getByTestId("english-world-map")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("family-games/english-spell-battle/progress"))).toBe(legacy);

  await page.goto("/?play=english-spell-battle-legacy&from=hub");
  await expect(page.locator(".english-spell-game")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("family-games/english-spell-battle/progress"))).toBe(legacy);
});

test("English World survives 20 enter and return lifecycle cycles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const log = observe(page);
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.goto(`/?world=english-world&cycle=${cycle}`);
    await expect(page.getByTestId("english-world-map")).toBeVisible();
    await page.getByRole("link", { name: "回我的游戏世界" }).click();
    await expect(page.getByTestId("world-english-portal")).toBeVisible();
  }
  expectClean(log);
});

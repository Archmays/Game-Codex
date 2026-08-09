import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const HUB_URL = "/";
const REVIEW_URL = "/?review=hanzi-v2-step03";
const SESSION_STORAGE_PREFIX = "family-games/hanzi-v2-step04/session:";
const EVENT_STORAGE_PREFIX = "family-games/hanzi-v2-step04/events:";

interface TestLaunch {
  sessionId: string;
  runSeed: string;
  buildIdentitySha256: string;
  launchNonce: string;
  commitSha: string;
  generatedAtUtc: string;
  checkedAtUtc: string;
  startedAtUtc: string;
  childUrl: string;
  observerUrl: string;
}

function testLaunch(hex: string, fixture = false): TestLaunch {
  const sessionId = `s04-${hex.repeat(32)}`;
  const runSeed = `${hex}123456789abcde0`.slice(0, 16);
  const buildIdentitySha256 = hex.toUpperCase().repeat(64);
  const launchNonce = (hex === "a" ? "b" : "a").repeat(32);
  const commitSha = "f6d47676a5434d74afdb865bb2f6c783522c0d90";
  const generatedAtUtc = "2026-08-09T01:00:00.000Z";
  const checkedAtUtc = "2026-08-09T01:01:00.000Z";
  const startedAtUtc = "2026-08-09T01:02:00.000Z";
  const query = new URLSearchParams({
    observe: "hanzi-v2-step04",
    session: sessionId,
    seed: runSeed,
    build: buildIdentitySha256,
    launch: launchNonce,
    commit: commitSha,
    generated: generatedAtUtc,
    checked: checkedAtUtc,
    started: startedAtUtc,
  });
  if (fixture) query.set("fixture", "1");
  return {
    sessionId,
    runSeed,
    buildIdentitySha256,
    launchNonce,
    commitSha,
    generatedAtUtc,
    checkedAtUtc,
    startedAtUtc,
    childUrl: `/?${new URLSearchParams({ play: "hanzi-v2-golden-slice", mode: "child-first-use", session: sessionId, seed: runSeed })}`,
    observerUrl: `/?${query}`,
  };
}

async function installAuthorizedGrant(page: Page, launch: TestLaunch, audioChoice: "SOUND_OK" | "START_MUTED" = "START_MUTED"): Promise<void> {
  await page.goto(HUB_URL);
  await page.evaluate(({ key, grant }) => localStorage.setItem(key, JSON.stringify(grant)), {
    key: `${SESSION_STORAGE_PREFIX}${launch.sessionId}`,
    grant: {
      schemaVersion: 1,
      initiativeId: "hanzi-radical-battle-v2",
      step: "04",
      sessionId: launch.sessionId,
      runSeed: launch.runSeed,
      buildIdentitySha256: launch.buildIdentitySha256,
      parentFeedbackSha256: "3F0BFAC4C6D318AC197AFA95764ACFB3A9E7FE9CE47BF6FA18C1514879EA417C",
      launchNonce: launch.launchNonce,
      sessionMode: "LIVE_DASHBOARD",
      fixture: false,
      audioChoice,
      readyConfirmed: true,
      status: "AUTHORIZED",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      stopCode: null,
    },
  });
}

function slice(page: Page) {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function expectPhase(page: Page, phase: string, timeout = 8_000): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout });
}

async function clickPrimary(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).click();
}

async function solveWithClicks(page: Page, cardId: string, slotId: string): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

async function enterFirstBoard(page: Page): Promise<void> {
  await page.getByRole("button", { name: "走进墨林", exact: true }).press("Enter");
  await clickPrimary(page, "看看营地灯");
  await clickPrimary(page, "沿着灯路出发");
  await clickPrimary(page, "跳过小路");
  await clickPrimary(page, "开始合字施法");
  await expectPhase(page, "battle_1_placing");
}

async function finishRun(page: Page): Promise<void> {
  await enterFirstBoard(page);
  await page.getByTestId("component-card-ming-ri").dragTo(page.getByTestId("slot-left"));
  await solveWithClicks(page, "ming-yue", "right");
  await expectPhase(page, "battle_1_cleared", 10_000);
  await clickPrimary(page, "看看光留下什么");
  await expectPhase(page, "travel_to_battle_2", 10_000);
  await clickPrimary(page, "跳过花径");
  await clickPrimary(page, "试试新的结构");
  await solveWithClicks(page, "hua-cao", "top");
  await solveWithClicks(page, "hua-hua", "bottom");
  await expectPhase(page, "battle_2_cleared", 10_000);
  await clickPrimary(page, "看看三道光");
  await page.getByTestId("ability-star-path").click();
  await clickPrimary(page, "走向双印墨守");
  await clickPrimary(page, "先看清它的动作");
  await solveWithClicks(page, "lin-mu-left", "left");
  await expectPhase(page, "boss_phase_1_placing", 5_000);
  await solveWithClicks(page, "lin-mu-right", "right");
  await expectPhase(page, "boss_phase_1_cleared", 10_000);
  await clickPrimary(page, "解开第二枚墨印");
  await solveWithClicks(page, "xing-ri", "top");
  await expectPhase(page, "boss_phase_2_placing", 5_000);
  await solveWithClicks(page, "xing-sheng", "bottom");
  await expectPhase(page, "boss_cleared", 10_000);
  await clickPrimary(page, "沿星路回营地");
  await expectPhase(page, "camp_repair", 10_000);
  await clickPrimary(page, "翻开四字魔法书");
  await expectPhase(page, "spellbook_review");
  await clickPrimary(page, "让营地继续亮着");
  await expectPhase(page, "run_complete");
}

function diagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) remoteRequests.push(request.url());
  });
  return { consoleErrors, pageErrors, remoteRequests };
}

async function installSpeechCapture(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const spoken: string[] = [];
    let cancelCount = 0;
    class FixtureUtterance {
      text: string;
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FixtureUtterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() { cancelCount += 1; },
      getVoices() { return []; },
      addEventListener() {},
      removeEventListener() {},
      speak(utterance: FixtureUtterance) {
        spoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(), 0);
      },
    } });
    Object.defineProperty(window, "__step04Spoken", { configurable: true, get: () => [...spoken] });
    Object.defineProperty(window, "__step04SpeechCancelCount", { configurable: true, get: () => cancelCount });
  });
}

test.describe("Hanzi Radical Battle V2 STEP 04", () => {
  test.beforeEach(async ({ context, page }) => {
    await installSpeechCapture(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("keeps hub and STEP 03 review unchanged and denies an unprepared child route", async ({ page }) => {
    await page.goto(HUB_URL);
    await expect(page.locator(".game-card")).toHaveCount(10);
    const title = await page.locator(".game-card h2").first().textContent();
    await page.locator(".game-card .game-card__button").first().click();
    await expect(page.locator(".game-topbar strong")).toHaveText(title ?? "");
    await page.getByRole("button", { name: "返回大厅" }).click();
    await expect(page.locator(".game-card")).toHaveCount(10);
    await page.goto(REVIEW_URL);
    await expect(page.getByTestId("step03-review-app")).toBeVisible();
    await page.goto("/?play=hanzi-v2-golden-slice&mode=child-first-use&session=invalid&seed=invalid");
    await expect(page.getByTestId("child-first-use-denied")).toBeVisible();
    await expect(page.locator(".game-card")).toHaveCount(0);
  });

  test("uses a clean authorized child route, visible pinyin, exact non-pinyin TTS, mute, and responsive controls", async ({ page }) => {
    const launch = testLaunch("1");
    await installAuthorizedGrant(page, launch, "SOUND_OK");
    const check = diagnostics(page);
    await page.goto(launch.childUrl);
    await expect(slice(page)).toHaveAttribute("data-child-first-use", "true");
    await expect(page.getByTestId("parent-debug-overlay")).toHaveCount(0);
    await expect(page.locator(".golden-seed")).toBeHidden();
    await enterFirstBoard(page);
    await solveWithClicks(page, "ming-ri", "left");
    await solveWithClicks(page, "ming-yue", "right");
    await expect(page.getByTestId("formed-character-ming")).toContainText("míng");
    await expect.poll(() => page.evaluate(() => (window as Window & { __step04Spoken?: string[] }).__step04Spoken ?? [])).toContain("明，明亮的明。");
    expect(await page.evaluate(() => (window as Window & { __step04Spoken?: string[] }).__step04Spoken ?? [])).not.toContain("明，míng，明亮的明。");

    await expectPhase(page, "battle_1_cleared");
    await page.getByRole("button", { name: "声音与画面", exact: true }).click();
    await expect(page.getByTestId("settings-overlay")).toBeVisible();
    await expect(page.getByRole("button", { name: "家长导出本机试玩记录" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "家长清除营地记录" })).toHaveCount(0);
    await page.getByLabel("静音").check();
    await page.keyboard.press("Escape");

    for (const viewport of [{ width: 1280, height: 800 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(slice(page)).toBeVisible();
      await expect(page.getByRole("button", { name: "声音与画面" })).toBeVisible();
    }
    expect(check.consoleErrors).toEqual([]);
    expect(check.pageErrors).toEqual([]);
    expect(check.remoteRequests).toEqual([]);
  });

  test("runs fixture-only parent preflight, CANCEL, stop, optional cards, privacy check, and synthetic export", async ({ page, context }) => {
    const cancelLaunch = testLaunch("2", true);
    await page.setViewportSize({ width: 1200, height: 720 });
    await page.goto(cancelLaunch.observerUrl);
    await expect(page.getByTestId("step04-observer-preparation")).toContainText("SYNTHETIC_TOOLING_TEST_ONLY");
    await expect(page.getByTestId("step04-observer-preparation")).toContainText("START 先打开家长准备页");
    const scrollMetrics = await page.evaluate(() => ({
      overflowY: getComputedStyle(document.body).overflowY,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      clientHeight: document.scrollingElement?.clientHeight ?? 0,
    }));
    expect(scrollMetrics.overflowY).toBe("auto");
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("link", { name: /继续完成音频预检/u }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "取消本次" }).click();
    await expect(page.getByText("本次 session 已取消")).toBeVisible();

    const launch = testLaunch("3", true);
    await page.goto(launch.observerUrl);
    const preflight = page.getByTestId("step04-audio-preflight");
    await expect(preflight).toContainText("明，明亮的明。");
    await expect(preflight).toContainText("míng");
    for (const id of ["ming", "hua", "lin", "xing"]) await page.locator(`[data-preflight-speak='${id}']`).click();
    await page.locator("[data-audio-decision='START_MUTED']").click();
    await page.locator("[data-session-mode='LIVE_DASHBOARD']").click();
    await page.locator("[data-ready-confirm]").check();
    const popupPromise = context.waitForEvent("page");
    await page.locator("[data-start-session]").click();
    const fixtureChild = await popupPromise;
    await expect(fixtureChild.getByTestId("hanzi-v2-golden-slice")).toBeVisible();
    await expect(fixtureChild.getByTestId("child-first-use-fixture-banner")).toHaveText("SYNTHETIC_TOOLING_TEST_ONLY · NO CHILD DATA");
    await expect(page.getByTestId("step04-observer-dashboard")).toContainText("SYNTHETIC_TOOLING_TEST_ONLY");
    await clickPrimary(fixtureChild, "走进墨林");
    await expect(page.getByTestId("step04-live-region")).toContainText("camp_intro");
    await page.locator("[data-stop-code]").selectOption("TECHNICAL");
    await page.locator("[data-stop-now]").click();
    await expect(fixtureChild.getByTestId("child-first-use-stopped")).toContainText("先回营地休息");
    await expect(page.getByTestId("step04-optional-cards")).toBeVisible();
    await page.locator("[data-again-again='NOT_ASKED']").click();
    await page.locator("[data-favorite-moment='NOT_ASKED']").click();
    await page.locator("[data-observer-notes]").fill("自动工具夹具；没有真实儿童参加。");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-export-observation]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("STEP-04_CHILD_FIRST_USE_OBSERVATION.json");
    const path = await download.path();
    const exported = JSON.parse(await readFile(path!, "utf8"));
    expect(exported.evidenceKind).toBe("SYNTHETIC_TOOLING_TEST_ONLY");
    expect(exported.completion.sessionStopped).toBe(true);
    expect(JSON.stringify(exported)).not.toMatch(/childName|userAgent|voiceName|mediaPath|score/u);
    await fixtureChild.close();
  });

  test("synchronizes same-origin child phase and immediately stops with neutral copy", async ({ page, context }) => {
    const launch = testLaunch("4");
    await installAuthorizedGrant(page, launch, "START_MUTED");
    const observer = await context.newPage();
    await observer.goto(launch.observerUrl);
    await expect(observer.getByTestId("step04-observer-dashboard")).toBeVisible();
    await page.goto(launch.childUrl);
    await clickPrimary(page, "走进墨林");
    await expect(observer.getByTestId("step04-live-region")).toContainText("camp_intro");
    await expect(page.getByRole("button", { name: "重听当前汉字和熟悉词" })).toHaveCount(0);
    const cancelCountBeforeStop = await page.evaluate(() => (window as Window & { __step04SpeechCancelCount?: number }).__step04SpeechCancelCount ?? 0);
    await observer.locator("[data-stop-code]").selectOption("CHILD_REQUEST");
    await observer.locator("[data-stop-now]").click();
    await expect(page.getByTestId("child-first-use-stopped")).toContainText("先回营地休息，找到的汉字都还在。");
    await expect.poll(() => page.evaluate(() => (window as Window & { __step04SpeechCancelCount?: number }).__step04SpeechCancelCount ?? 0)).toBeGreaterThan(cancelCountBeforeStop);
    await expect(observer.getByTestId("step04-optional-cards")).toBeVisible();
  });

  test("completes offline from observer, records minimal events, and allows at most one formal replay", async ({ page }) => {
    test.setTimeout(90_000);
    const launch = testLaunch("5");
    await installAuthorizedGrant(page, launch, "START_MUTED");
    const check = diagnostics(page);
    await page.goto(launch.childUrl);
    await finishRun(page);
    const events = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), `${EVENT_STORAGE_PREFIX}${launch.sessionId}`);
    expect(events.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining([
      "session_opened", "child_route_ready", "first_action", "spell_formed", "ability_selected",
      "boss_intent_shown", "camp_repaired", "spellbook_opened", "run_completed",
    ]));
    expect(events.every((event: { sequence: number }, index: number) => event.sequence === index + 1)).toBe(true);
    await page.getByTestId("run-complete").getByRole("button").first().click();
    await expectPhase(page, "boot");
    const replayEvents = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), `${EVENT_STORAGE_PREFIX}${launch.sessionId}`);
    expect(replayEvents.some((event: { eventType: string; safeMetadata: object }) => event.eventType === "replay_selected" && JSON.stringify(event.safeMetadata).includes("spontaneous"))).toBe(true);
    expect(check.consoleErrors).toEqual([]);
    expect(check.pageErrors).toEqual([]);
    expect(check.remoteRequests).toEqual([]);
  });
});

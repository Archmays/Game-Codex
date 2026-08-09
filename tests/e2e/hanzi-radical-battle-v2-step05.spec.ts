import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  GOLDEN_SLICE_SAVE_KEY,
} from "../../games/hanzi-radical-battle/v2/golden-slice/save";
import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import { STEP05_EVIDENCE_SHA256 } from "../../apps/hanzi-v2-step05-review/review-evidence";
import { STEP05_AUDIO_MATRIX_RESULTS } from "../../apps/hanzi-v2-step05-review/audio-matrix";
import {
  STEP05_REVIEW_CANDIDATE_REVISION,
  STEP05_REVIEW_ITEMS,
} from "../../apps/hanzi-v2-step05-review/review-items";
import {
  isStep05ParentReviewFeedback,
  STEP05_REVIEW_DRAFT_KEY,
} from "../../apps/hanzi-v2-step05-review/review-schema";

const SCREENSHOT_DIR = resolve(
  "artifacts/hanzi-radical-battle-v2/step-05/screenshots",
);
const CANDIDATE_COMMIT = "a".repeat(40);
const REVIEW_URL = `/?${new URLSearchParams({
  review: "hanzi-v2-step05",
  commit: CANDIDATE_COMMIT,
  evidence: STEP05_EVIDENCE_SHA256,
  revision: STEP05_REVIEW_CANDIDATE_REVISION,
}).toString()}`;

const EXPECTED_SCREENSHOTS = [
  "01-world-home-desktop.webp",
  "02-world-home-mobile.webp",
  "03-world-home-tablet.webp",
  "04-repaired-camp.webp",
  "05-world-spellbook.webp",
  "06-world-forest-portal.webp",
  "07-world-treasure-box.webp",
  "08-classic-hub-wrapper.webp",
  "09-run-complete-return-world.webp",
  "10-audio-context-matrix.webp",
  "11-evidence-reconciliation.webp",
  "12-parent-review-summary.webp",
] as const;

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  remoteRequests: string[];
};

function observeDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    remoteRequests: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      diagnostics.remoteRequests.push(request.url());
    }
  });

  return diagnostics;
}

function expectCleanDiagnostics(diagnostics: Diagnostics): void {
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.remoteRequests).toEqual([]);
}

async function installSpeechCapture(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const spoken: string[] = [];
    Object.defineProperty(window, "__step05Spoken", {
      configurable: true,
      get: () => spoken,
    });

    class CapturedUtterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => unknown) | null = null;
      onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => unknown) | null = null;

      constructor(text = "") {
        super();
        this.text = text;
      }
    }

    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      getVoices: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
      speak: (utterance: CapturedUtterance) => {
        spoken.push(utterance.text);
        window.setTimeout(() => {
          utterance.onend?.call(
            utterance as unknown as SpeechSynthesisUtterance,
            new Event("end") as SpeechSynthesisEvent,
          );
        }, 0);
      },
      onvoiceschanged: null,
    };

    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: CapturedUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: synth,
    });
  });
}

async function screenshotWebp(
  page: Page,
  target: Page | Locator,
  fileName: (typeof EXPECTED_SCREENSHOTS)[number],
): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const png = await target.screenshot({ animations: "disabled" });
  const dataUrl = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await new Promise<void>((resolveImage, rejectImage) => {
      image.onload = () => resolveImage();
      image.onerror = () => rejectImage(new Error("PNG screenshot could not be decoded"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.92);
  }, png.toString("base64"));
  const webp = Buffer.from(dataUrl.split(",", 2)[1], "base64");
  expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(resolve(SCREENSHOT_DIR, fileName), webp),
  );
}

function completedSave(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
    completedRuns: 1,
    lastRunSeed: "hanzi-v2-golden-slice-v1",
    campState: { lamp: true },
    spellbookEntries: ["ming", "hua", "lin", "xing"],
    chosenAbilityHistory: ["ink-echo"],
    settings: { muted: false, reducedMotion: false },
    localPlaytestEvents: [],
    ...overrides,
  };
}

async function setGoldenSave(page: Page, save: unknown): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
    [GOLDEN_SLICE_SAVE_KEY, save] as const,
  );
}

async function clearGoldenSave(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate((key) => window.localStorage.removeItem(key), GOLDEN_SLICE_SAVE_KEY);
}

function slice(page: Page): Locator {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, {
    timeout: 15_000,
  });
}

async function clickPrimary(page: Page, name: string): Promise<void> {
  await slice(page).getByRole("button", { name, exact: true }).click();
}

async function solveWithClicks(
  page: Page,
  cardId: string,
  slotId: "left" | "right" | "top" | "bottom",
): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

async function completeGoldenRunWithInkEcho(page: Page): Promise<void> {
  await clickPrimary(page, "走进墨林");
  await clickPrimary(page, "看看营地灯");
  await clickPrimary(page, "沿着灯路出发");
  await clickPrimary(page, "跳过小路");
  await clickPrimary(page, "开始合字施法");
  await solveWithClicks(page, "ming-ri", "left");
  await solveWithClicks(page, "ming-yue", "right");
  await waitForPhase(page, "battle_1_cleared");
  await clickPrimary(page, "看看光留下什么");
  await waitForPhase(page, "travel_to_battle_2");
  await clickPrimary(page, "跳过花径");
  await clickPrimary(page, "试试新的结构");
  await solveWithClicks(page, "hua-cao", "top");
  await solveWithClicks(page, "hua-hua", "bottom");
  await waitForPhase(page, "battle_2_cleared");
  await clickPrimary(page, "看看三道光");
  await page.getByTestId("ability-ink-echo").click();
  await clickPrimary(page, "走向双印墨守");
  await clickPrimary(page, "先看清它的动作");
  await solveWithClicks(page, "lin-mu-left", "left");
  await waitForPhase(page, "boss_interference");

  const echo = slice(page).locator("[data-ink-echo-voice]");
  await expect(echo).toHaveAccessibleName("让墨点回声读出当前首领汉字");
  await expect(slice(page).locator("[data-replay-voice]")).toHaveCount(0);
  await echo.click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as unknown as { __step05Spoken?: string[] }).__step05Spoken ?? []).at(-1),
      ),
    )
    .toBe("林，树林的林。");

  await waitForPhase(page, "boss_phase_1_placing");
  await solveWithClicks(page, "lin-mu-right", "right");
  await waitForPhase(page, "boss_phase_1_cleared");
  await clickPrimary(page, "解开第二枚墨印");
  await solveWithClicks(page, "xing-ri", "top");
  await waitForPhase(page, "boss_phase_2_placing");
  await solveWithClicks(page, "xing-sheng", "bottom");
  await waitForPhase(page, "boss_cleared");
  await clickPrimary(page, "沿星路回营地");
  await waitForPhase(page, "camp_repair");
  await clickPrimary(page, "翻开四字魔法书");
  await waitForPhase(page, "spellbook_review");
  await clickPrimary(page, "让营地继续亮着");
  await waitForPhase(page, "run_complete");
}

test.describe.serial("Hanzi Radical Battle V2 STEP 05", () => {
  test.beforeEach(async ({ context }) => {
    await installSpeechCapture(context);
  });

  test("world states, objects, keyboard access, reduced motion, and three viewports", async ({
    page,
  }) => {
    const diagnostics = observeDiagnostics(page);

    await page.goto("/");
    await expect(page.locator(".game-card")).toHaveCount(10);

    await clearGoldenSave(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?world=my-game-world");
    const world = page.getByTestId("my-game-world");
    await expect(world).toBeVisible();
    await expect(world.getByRole("heading", { name: "我的游戏世界", exact: true })).toBeVisible();
    await expect(world.getByText("今天想去哪里？", { exact: true })).toBeVisible();
    await expect(world).not.toContainText(/儿童学习游戏大厅|学科|适合年龄|学习目标|正确率|课程|可玩状态/);
    for (const repair of ["lamp", "flowers", "trees", "star-path"]) {
      await expect(world.locator(`[data-repair="${repair}"]`)).toHaveAttribute("data-ready", "false");
    }
    await expect(world.getByTestId("world-forest-portal").locator("[data-world-forest-link]")).toBeEnabled();
    await expect(world.getByTestId("world-spellbook-object")).toBeVisible();
    await expect(world.getByTestId("world-treasure-box")).toBeVisible();
    await screenshotWebp(page, page, "01-world-home-desktop.webp");

    const spellbookButton = world.locator("[data-world-spellbook-open]");
    await spellbookButton.focus();
    await spellbookButton.press("Enter");
    await expect(page.getByTestId("world-spellbook")).toBeVisible();
    await expect(page.getByTestId("world-spellbook")).toContainText("字光还在森林里等你。");
    await page.getByTestId("world-spellbook").getByRole("button", { name: "回到游戏世界" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(world).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      .toBe(true);
    for (const control of await world.getByRole("button").all()) {
      const box = await control.boundingBox();
      if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    await screenshotWebp(page, page, "02-world-home-mobile.webp");

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      .toBe(true);
    await screenshotWebp(page, page, "03-world-home-tablet.webp");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await setGoldenSave(
      page,
      completedSave({ settings: { muted: false, reducedMotion: true } }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?world=my-game-world");
    for (const repair of ["lamp", "flowers", "trees", "star-path"]) {
      await expect(world.locator(`[data-repair="${repair}"]`)).toHaveAttribute("data-ready", "true");
    }
    await screenshotWebp(page, page, "04-repaired-camp.webp");

    await world.locator("[data-world-spellbook-open]").click();
    const spellbook = page.getByTestId("world-spellbook");
    await expect(spellbook).toBeVisible();
    for (const [entry, glyph] of [["ming", "明"], ["hua", "花"], ["lin", "林"], ["xing", "星"]] as const) {
      await spellbook.locator(`[data-world-spellbook-id="${entry}"]`).click();
      await expect(page.getByTestId(`world-spellbook-page-${entry}`)).toBeVisible();
      await expect(page.getByTestId(`world-spellbook-page-${entry}`)).toContainText(glyph);
    }
    await screenshotWebp(page, spellbook, "05-world-spellbook.webp");
    await spellbook.getByRole("button", { name: "回到游戏世界" }).click();
    await screenshotWebp(page, world.getByTestId("world-forest-portal"), "06-world-forest-portal.webp");
    await screenshotWebp(page, world.getByTestId("world-treasure-box"), "07-world-treasure-box.webp");

    expectCleanDiagnostics(diagnostics);
  });

  test("forest run, dedicated Ink Echo, classic wrapper, and world return", async ({ page }) => {
    test.setTimeout(120_000);
    const diagnostics = observeDiagnostics(page);

    await setGoldenSave(page, completedSave());
    await page.goto("/?world=my-game-world");
    await page.getByTestId("world-treasure-box").locator("[data-world-treasure-link]").click();
    const wrapper = page.getByTestId("classic-hub-from-world");
    await expect(wrapper).toBeVisible();
    await expect(wrapper.locator(".game-card")).toHaveCount(10);
    await screenshotWebp(page, wrapper, "08-classic-hub-wrapper.webp");

    await wrapper.locator(".game-card__button").first().click();
    await expect(wrapper.getByRole("button", { name: "返回大厅", exact: true })).toBeVisible();
    await wrapper.getByRole("button", { name: "返回大厅", exact: true }).click();
    await expect(wrapper.locator(".game-card")).toHaveCount(10);
    await wrapper.getByRole("link", { name: "← 回我的游戏世界", exact: true }).click();
    await expect(page.getByTestId("my-game-world")).toBeVisible();

    await clearGoldenSave(page);
    await page.goto("/?world=my-game-world");
    const forestLink = page.locator("[data-world-forest-link]");
    await forestLink.focus();
    await forestLink.press("Enter");
    await expect(slice(page)).toBeVisible();
    await completeGoldenRunWithInkEcho(page);
    await screenshotWebp(page, slice(page), "09-run-complete-return-world.webp");
    await expect(slice(page).locator("[data-return-to-world]")).toHaveText("回我的游戏世界");
    await slice(page).locator("[data-return-to-world]").click();
    await expect(page.getByTestId("my-game-world")).toBeVisible();
    await expect(page.locator('[data-repair="lamp"]')).toHaveAttribute("data-ready", "true");

    expectCleanDiagnostics(diagnostics);
  });

  test("five-tab identity-bound parent review stays pending until explicit export", async ({
    page,
  }) => {
    const diagnostics = observeDiagnostics(page);
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), STEP05_REVIEW_DRAFT_KEY);
    await page.goto(REVIEW_URL);

    const app = page.getByTestId("step05-review-app");
    await expect(app).toBeVisible();
    const tabs = app.locator("[data-review-tab]");
    await expect(tabs).toHaveCount(5);
    for (const [index, label] of [
      "真实证据",
      "Audio context regression",
      "我的游戏世界",
      "导航",
      "授权",
    ].entries()) {
      await expect(tabs.nth(index)).toContainText(label);
    }
    await expect(app.locator("[data-step05-decision][aria-pressed=true]")).toHaveCount(0);
    await screenshotWebp(page, page.getByTestId("step05-evidence-panel"), "11-evidence-reconciliation.webp");

    await tabs.filter({ hasText: "Audio context regression" }).click();
    const audioPanel = page.getByTestId("step05-audio-panel");
    await expect(audioPanel.locator("[data-audio-matrix-row]")).toHaveCount(STEP05_AUDIO_MATRIX_RESULTS.length);
    await screenshotWebp(page, audioPanel, "10-audio-context-matrix.webp");

    await tabs.filter({ hasText: "我的游戏世界" }).click();
    const preview = app.locator("iframe");
    await expect(preview).toBeVisible();
    for (const size of ["mobile", "tablet", "desktop"]) {
      await app.locator(`[data-preview-width="${size}"]`).click();
      await expect(preview.locator("xpath=.."))
        .toHaveClass(new RegExp(`step05-world-frame--${size}`));
    }

    await tabs.filter({ hasText: "导航" }).click();
    await expect(app).toContainText("?world=my-game-world");
    await expect(app).toContainText("?hub=classic&from=world");

    await tabs.filter({ hasText: "授权" }).click();
    const authorization = page.getByTestId("step05-authorization-panel");
    await expect(authorization.locator("[data-summary-missing]")).not.toHaveText("0");
    await expect(authorization.locator("[data-export-feedback]")).toBeDisabled();
    await screenshotWebp(page, authorization, "12-parent-review-summary.webp");

    const notesById: Record<string, string> = {
      "real-first-use-evidence": "证据口径与候选身份一致。",
      "audio-context-regression": "逐项确认语音语境与墨点回声专用语义。",
      "private-world-shell": "世界主页三件物品与修复状态符合本轮候选。",
      "world-navigation": "世界、森林、经典大厅与返回路径均已核对。",
    };
    const tabByItem: Record<string, string> = {
      "real-first-use-evidence": "真实证据",
      "audio-context-regression": "Audio context regression",
      "private-world-shell": "我的游戏世界",
      "world-navigation": "导航",
    };
    for (const item of STEP05_REVIEW_ITEMS) {
      await tabs.filter({ hasText: tabByItem[item.id] }).click();
      await app.locator(`[data-item-id="${item.id}"][data-step05-decision="ACCEPT"]`).click();
      await app.locator(`[data-step05-notes="${item.id}"]`).fill(notesById[item.id]);
    }

    await tabs.filter({ hasText: "授权" }).click();
    await authorization.locator('[data-authorization="default"][data-value="NO"]').click();
    await authorization.locator('[data-authorization="second-use"][data-value="NO"]').click();
    await authorization.locator("[data-general-notes]").fill("本文件只记录本轮家长复核，不代表儿童实测通过。");
    await expect(authorization.locator("[data-summary-missing]")).toHaveText("0");
    await expect(authorization.locator("[data-export-feedback]")).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await authorization.locator("[data-export-feedback]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("STEP-05_PARENT_REVIEW_FEEDBACK.json");
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const feedback = JSON.parse(await readFile(downloadPath!, "utf8"));
    expect(isStep05ParentReviewFeedback(feedback)).toBe(true);
    expect(Object.keys(feedback).sort()).toEqual([
      "authorizeDefaultWorldEntry",
      "authorizeSecondUseCheck",
      "decisions",
      "generalNotes",
      "identity",
      "initiativeId",
      "reviewContractVersion",
      "reviewMeta",
      "reviewRound",
      "schemaVersion",
      "step",
    ].sort());
    expect(feedback.identity).toEqual({
      candidateCommit: CANDIDATE_COMMIT,
      evidenceSha256: STEP05_EVIDENCE_SHA256,
      candidateRevision: STEP05_REVIEW_CANDIDATE_REVISION,
    });
    expect(feedback.decisions).toHaveLength(4);
    expect(feedback.decisions.map((decision: { decision: string }) => decision.decision)).toEqual([
      "ACCEPT",
      "ACCEPT",
      "ACCEPT",
      "ACCEPT",
    ]);
    expect(feedback.authorizeDefaultWorldEntry).toBe("NO");
    expect(feedback.authorizeSecondUseCheck).toBe("NO");
    expect(feedback.reviewMeta).toMatchObject({ completed: true, missingRequiredFieldIds: [] });

    expectCleanDiagnostics(diagnostics);
  });

  test("all twelve required screenshots are WebP files", async () => {
    for (const fileName of EXPECTED_SCREENSHOTS) {
      const bytes = await readFile(resolve(SCREENSHOT_DIR, fileName));
      expect(bytes.subarray(0, 4).toString("ascii"), fileName).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii"), fileName).toBe("WEBP");
    }
  });
});

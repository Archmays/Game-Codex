import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save";
import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

const VISUAL_EVIDENCE_ROOT = resolve("artifacts/game-machine-review/step-07/screenshots/visual-baseline");
const ARIA_EVIDENCE_ROOT = resolve("artifacts/game-machine-review/step-07/aria");
const VISUAL_EVIDENCE_INDEX = resolve("artifacts/game-machine-review/step-07/VISUAL-ARIA-EVIDENCE.json");
const capturedEvidence = new Set<string>();
let baselineKind: "STEP07_BASELINE_CANDIDATE" | "STEP07_ESTABLISHED_BASELINE" = "STEP07_BASELINE_CANDIDATE";

function evidencePath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

async function capturePage(page: Page, name: string, fullPage = true): Promise<void> {
  await expect(page).toHaveScreenshot(name, { animations: "disabled", fullPage });
  const path = resolve(VISUAL_EVIDENCE_ROOT, name);
  await page.screenshot({ path, animations: "disabled", fullPage });
  capturedEvidence.add(evidencePath(path));
}

async function captureAria(locator: Locator, name: string): Promise<void> {
  await expect(locator).toMatchAriaSnapshot({ name });
  const path = resolve(ARIA_EVIDENCE_ROOT, name);
  writeFileSync(path, `${await locator.ariaSnapshot()}\n`, "utf8");
  capturedEvidence.add(evidencePath(path));
}

function completedSave() {
  return {
    schemaVersion: 3,
    contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
    completedRuns: 1,
    lastRunSeed: "hanzi-v2-golden-slice-v1",
    campState: { lamp: true },
    spellbookEntries: ["ming", "hua", "lin", "xing"],
    chosenAbilityHistory: ["ink-echo"],
    settings: { muted: false, reducedMotion: true },
    localPlaytestEvents: [],
  };
}

async function installSpeechCapture(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    class CapturedUtterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisEvent) => unknown) | null = null;
      onerror: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisErrorEvent) => unknown) | null = null;
      constructor(text = "") { super(); this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: CapturedUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
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
        speak: (utterance: CapturedUtterance) => window.setTimeout(() => utterance.onend?.call(
          utterance as unknown as SpeechSynthesisUtterance,
          new Event("end") as SpeechSynthesisEvent,
        ), 0),
        onvoiceschanged: null,
      },
    });
  });
}

function slice(page: Page): Locator {
  return page.getByTestId("hanzi-v2-golden-slice");
}

async function waitForPhase(page: Page, phase: string): Promise<void> {
  await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 15_000 });
}

async function clickPrimary(page: Page, name: string): Promise<void> {
  await slice(page).getByRole("button", { name, exact: true }).click();
}

async function place(page: Page, cardId: string, slotId: "left" | "right" | "top" | "bottom"): Promise<void> {
  await page.getByTestId(`component-card-${cardId}`).click();
  await page.getByTestId(`slot-${slotId}`).click();
}

test.describe("STEP 07 established visual and ARIA baselines", () => {
  test.beforeAll(() => {
    mkdirSync(VISUAL_EVIDENCE_ROOT, { recursive: true });
    mkdirSync(ARIA_EVIDENCE_ROOT, { recursive: true });
  });

  test.afterAll(() => {
    writeFileSync(VISUAL_EVIDENCE_INDEX, `${JSON.stringify({
      schemaVersion: 1,
      sourceTreeSha256: computeMachineReviewSourceTreeSha256(),
      baselineKind,
      generatedAtUtc: new Date().toISOString(),
      evidenceFiles: [...capturedEvidence].sort(),
    }, null, 2)}\n`, "utf8");
  });

  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "One canonical desktop baseline avoids duplicate project snapshots.");
    baselineKind = testInfo.config.updateSnapshots === "none"
      ? "STEP07_ESTABLISHED_BASELINE"
      : "STEP07_BASELINE_CANDIDATE";
    await installSpeechCapture(context);
  });

  test("world, repaired persistence, spellbook, and classic catalog", async ({ page }) => {
    await page.goto("/");
    const world = page.getByTestId("my-game-world");
    await expect(world).toBeVisible();
    await capturePage(page, "world-fresh-step07.png");
    await captureAria(world, "world-fresh-step07.aria.yml");

    await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [GOLDEN_SLICE_SAVE_KEY, completedSave()] as const);
    await page.reload();
    await expect(world).toHaveAttribute("data-repaired", "true");
    await capturePage(page, "world-repaired-step07.png");

    await world.locator("[data-world-spellbook-open]").click();
    const spellbook = page.getByTestId("world-spellbook");
    await expect(spellbook).toBeVisible();
    await capturePage(page, "world-spellbook-step07.png");
    await captureAria(spellbook, "world-spellbook-step07.aria.yml");

    await page.goto("/?hub=classic");
    await expect(page.locator(".game-card")).toHaveCount(10);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main main")).toHaveCount(0);
    await capturePage(page, "classic-hub-step07.png");
    await captureAria(page.getByTestId("classic-hub-from-world"), "classic-hub-step07.aria.yml");
  });

  test("Golden Slice key states", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?play=hanzi-v2-golden-slice&mode=play&from=world");
    await expect(slice(page)).toHaveAttribute("data-reduced-motion", "true");
    await expect(slice(page).locator("h1")).toHaveCount(1);
    await expect(slice(page).getByRole("heading", { level: 1, name: "汉字魔法战 · 墨迹森林", exact: true })).toBeVisible();
    await clickPrimary(page, "走进墨林");
    await waitForPhase(page, "camp_intro");
    await capturePage(page, "forest-camp-step07.png");
    await captureAria(slice(page), "forest-camp-step07.aria.yml");

    await clickPrimary(page, "看看营地灯");
    await clickPrimary(page, "沿着灯路出发");
    await clickPrimary(page, "跳过小路");
    await clickPrimary(page, "开始合字施法");
    await waitForPhase(page, "battle_1_placing");
    await capturePage(page, "forest-ming-placing-step07.png");

    await place(page, "ming-ri", "left");
    await place(page, "ming-yue", "right");
    await clickPrimary(page, "看看光留下什么");
    await clickPrimary(page, "继续看前路");
    await clickPrimary(page, "跳过花径");
    await clickPrimary(page, "试试新的结构");
    await place(page, "hua-cao", "top");
    await place(page, "hua-hua", "bottom");
    await clickPrimary(page, "看看三道光");
    await waitForPhase(page, "ability_choice");
    await expect(page.getByTestId("ability-choice").getByRole("heading", { level: 2, name: "选一道同行的光", exact: true })).toBeVisible();
    await capturePage(page, "forest-ability-step07.png");
    await captureAria(slice(page), "forest-ability-step07.aria.yml");

    await page.getByTestId("ability-ink-echo").click();
    await clickPrimary(page, "走向双印墨守");
    await clickPrimary(page, "先看清它的动作");
    await place(page, "lin-mu-left", "left");
    await waitForPhase(page, "boss_interference");
    await capturePage(page, "forest-boss-lin-step07.png");
    await slice(page).locator("[data-ink-echo-voice]").click();
    await waitForPhase(page, "boss_phase_1_placing");
    await place(page, "lin-mu-right", "right");
    await clickPrimary(page, "解开第二枚墨印");
    await place(page, "xing-ri", "top");
    await waitForPhase(page, "boss_phase_2_placing");
    await capturePage(page, "forest-boss-xing-step07.png");
    await place(page, "xing-sheng", "bottom");
    await clickPrimary(page, "沿星路回营地");
    await waitForPhase(page, "camp_repair");
    await capturePage(page, "forest-camp-repair-step07.png");
    await clickPrimary(page, "翻开四字魔法书");
    await waitForPhase(page, "spellbook_review");
    const spellbook = page.getByTestId("spellbook-overlay");
    await expect(spellbook.getByRole("heading", { level: 2, name: "四字魔法书", exact: true })).toBeVisible();
    await expect(spellbook.getByRole("heading", { level: 3, name: "míng · 明亮", exact: true })).toBeVisible();
    await expect(slice(page).locator("h1")).toHaveCount(1);
    await capturePage(page, "forest-spellbook-step07.png");
    await captureAria(slice(page), "forest-spellbook-step07.aria.yml");
  });

  test("STEP 07 adult observer preparation and bottom structure", async ({ page }) => {
    await page.goto(`/?observe=hanzi-v2-step07&fixture=SYNTHETIC_TOOLING_TEST_ONLY&build=${"a".repeat(40)}`);
    const observer = page.getByTestId("step07-observer");
    await expect(observer).toBeVisible();
    await capturePage(page, "step07-observer-preparation-step07.png", false);
    await captureAria(page.getByTestId("step07-preflight"), "step07-observer-preparation-step07.aria.yml");

    const exportSection = page.getByTestId("step07-export");
    await exportSection.scrollIntoViewIfNeeded();
    await capturePage(page, "step07-observer-bottom-step07.png", false);
    await captureAria(page.getByTestId("step07-human-fields"), "step07-observer-human-fields-step07.aria.yml");
    await captureAria(exportSection, "step07-observer-export-step07.aria.yml");
  });
});

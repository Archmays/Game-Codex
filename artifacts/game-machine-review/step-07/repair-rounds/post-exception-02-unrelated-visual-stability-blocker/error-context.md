# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game-machine-visual-regression.spec.ts >> STEP 07 established visual and ARIA baselines >> Golden Slice key states
- Location: tests\e2e\game-machine-visual-regression.spec.ts:148:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

Timeout: 5000ms
  Failed to take two consecutive stable screenshots.

  Snapshot: forest-camp-step07.png

Call log:
  - Expect "toHaveScreenshot(forest-camp-step07.png)" with timeout 5000ms
    - generating new stable screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 29 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 250ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 159 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 500ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 23 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 1000ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 38 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 1000ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 100 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 1000ms before taking screenshot
  - Timeout 5000ms exceeded.

```

# Test source

```ts
  1   | import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
  2   | import { mkdirSync, writeFileSync } from "node:fs";
  3   | import { relative, resolve } from "node:path";
  4   | import { GOLDEN_SLICE_SAVE_KEY } from "../../games/hanzi-radical-battle/v2/golden-slice/save";
  5   | import { GOLDEN_SLICE_MANIFEST_REVISION_HASH } from "../../games/hanzi-radical-battle/v2/golden-slice/content/manifest";
  6   | import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";
  7   | 
  8   | const VISUAL_EVIDENCE_ROOT = resolve("artifacts/game-machine-review/step-07/screenshots/visual-baseline");
  9   | const ARIA_EVIDENCE_ROOT = resolve("artifacts/game-machine-review/step-07/aria");
  10  | const VISUAL_EVIDENCE_INDEX = resolve("artifacts/game-machine-review/step-07/VISUAL-ARIA-EVIDENCE.json");
  11  | const capturedEvidence = new Set<string>();
  12  | let baselineKind: "STEP07_BASELINE_CANDIDATE" | "STEP07_ESTABLISHED_BASELINE" = "STEP07_BASELINE_CANDIDATE";
  13  | 
  14  | function evidencePath(path: string): string {
  15  |   return relative(process.cwd(), path).replaceAll("\\", "/");
  16  | }
  17  | 
  18  | async function capturePage(page: Page, name: string, fullPage = true): Promise<void> {
> 19  |   await expect(page).toHaveScreenshot(name, { animations: "disabled", fullPage });
      |                      ^ Error: expect(page).toHaveScreenshot(expected) failed
  20  |   const path = resolve(VISUAL_EVIDENCE_ROOT, name);
  21  |   await page.screenshot({ path, animations: "disabled", fullPage });
  22  |   capturedEvidence.add(evidencePath(path));
  23  | }
  24  | 
  25  | async function captureAria(locator: Locator, name: string): Promise<void> {
  26  |   await expect(locator).toMatchAriaSnapshot({ name });
  27  |   const path = resolve(ARIA_EVIDENCE_ROOT, name);
  28  |   writeFileSync(path, `${await locator.ariaSnapshot()}\n`, "utf8");
  29  |   capturedEvidence.add(evidencePath(path));
  30  | }
  31  | 
  32  | function completedSave() {
  33  |   return {
  34  |     schemaVersion: 3,
  35  |     contentRevisionHash: GOLDEN_SLICE_MANIFEST_REVISION_HASH,
  36  |     completedRuns: 1,
  37  |     lastRunSeed: "hanzi-v2-golden-slice-v1",
  38  |     campState: { lamp: true },
  39  |     spellbookEntries: ["ming", "hua", "lin", "xing"],
  40  |     chosenAbilityHistory: ["ink-echo"],
  41  |     settings: { muted: false, reducedMotion: true },
  42  |     localPlaytestEvents: [],
  43  |   };
  44  | }
  45  | 
  46  | async function installSpeechCapture(context: BrowserContext): Promise<void> {
  47  |   await context.addInitScript(() => {
  48  |     class CapturedUtterance extends EventTarget {
  49  |       text: string;
  50  |       lang = "";
  51  |       rate = 1;
  52  |       pitch = 1;
  53  |       volume = 1;
  54  |       voice: SpeechSynthesisVoice | null = null;
  55  |       onend: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisEvent) => unknown) | null = null;
  56  |       onerror: ((this: SpeechSynthesisUtterance, event: SpeechSynthesisErrorEvent) => unknown) | null = null;
  57  |       constructor(text = "") { super(); this.text = text; }
  58  |     }
  59  |     Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: CapturedUtterance });
  60  |     Object.defineProperty(window, "speechSynthesis", {
  61  |       configurable: true,
  62  |       value: {
  63  |         speaking: false,
  64  |         pending: false,
  65  |         paused: false,
  66  |         cancel: () => undefined,
  67  |         pause: () => undefined,
  68  |         resume: () => undefined,
  69  |         getVoices: () => [],
  70  |         addEventListener: () => undefined,
  71  |         removeEventListener: () => undefined,
  72  |         dispatchEvent: () => true,
  73  |         speak: (utterance: CapturedUtterance) => window.setTimeout(() => utterance.onend?.call(
  74  |           utterance as unknown as SpeechSynthesisUtterance,
  75  |           new Event("end") as SpeechSynthesisEvent,
  76  |         ), 0),
  77  |         onvoiceschanged: null,
  78  |       },
  79  |     });
  80  |   });
  81  | }
  82  | 
  83  | function slice(page: Page): Locator {
  84  |   return page.getByTestId("hanzi-v2-golden-slice");
  85  | }
  86  | 
  87  | async function waitForPhase(page: Page, phase: string): Promise<void> {
  88  |   await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 15_000 });
  89  | }
  90  | 
  91  | async function clickPrimary(page: Page, name: string): Promise<void> {
  92  |   await slice(page).getByRole("button", { name, exact: true }).click();
  93  | }
  94  | 
  95  | async function place(page: Page, cardId: string, slotId: "left" | "right" | "top" | "bottom"): Promise<void> {
  96  |   await page.getByTestId(`component-card-${cardId}`).click();
  97  |   await page.getByTestId(`slot-${slotId}`).click();
  98  | }
  99  | 
  100 | test.describe("STEP 07 established visual and ARIA baselines", () => {
  101 |   test.beforeAll(() => {
  102 |     mkdirSync(VISUAL_EVIDENCE_ROOT, { recursive: true });
  103 |     mkdirSync(ARIA_EVIDENCE_ROOT, { recursive: true });
  104 |   });
  105 | 
  106 |   test.afterAll(() => {
  107 |     writeFileSync(VISUAL_EVIDENCE_INDEX, `${JSON.stringify({
  108 |       schemaVersion: 1,
  109 |       sourceTreeSha256: computeMachineReviewSourceTreeSha256(),
  110 |       baselineKind,
  111 |       generatedAtUtc: new Date().toISOString(),
  112 |       evidenceFiles: [...capturedEvidence].sort(),
  113 |     }, null, 2)}\n`, "utf8");
  114 |   });
  115 | 
  116 |   test.beforeEach(async ({ context }, testInfo) => {
  117 |     test.skip(testInfo.project.name !== "desktop-chromium", "One canonical desktop baseline avoids duplicate project snapshots.");
  118 |     baselineKind = testInfo.config.updateSnapshots === "none"
  119 |       ? "STEP07_ESTABLISHED_BASELINE"
```
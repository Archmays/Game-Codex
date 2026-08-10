# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game-machine-visual-regression.spec.ts >> STEP 07 established visual and ARIA baselines >> Golden Slice key states
- Location: tests\e2e\game-machine-visual-regression.spec.ts:148:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('hanzi-v2-golden-slice')
Expected: "camp_intro"
Received: "boot"
Timeout:  15000ms

Call log:
  - Expect "toHaveAttribute" with timeout 15000ms
  - waiting for getByTestId('hanzi-v2-golden-slice')
    29 × locator resolved to <main class="golden-shell" data-visual-state-id="boot" data-reduced-motion="false" data-child-first-use="false" data-selected-ability-id="none" data-encounter-id="encounter-ming" data-testid="hanzi-v2-golden-slice">…</main>
       - unexpected value "boot"

```

```yaml
- main:
  - text: 汉字魔法战 · 墨迹森林 hanzi-v2-golden-slice-v1
  - button "声音与画面"
  - status
  - button "走进墨林"
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
  19  |   await expect(page).toHaveScreenshot(name, { animations: "disabled", fullPage });
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
> 88  |   await expect(slice(page)).toHaveAttribute("data-visual-state-id", phase, { timeout: 15_000 });
      |                             ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  120 |       : "STEP07_BASELINE_CANDIDATE";
  121 |     await installSpeechCapture(context);
  122 |   });
  123 | 
  124 |   test("world, repaired persistence, spellbook, and classic catalog", async ({ page }) => {
  125 |     await page.goto("/");
  126 |     const world = page.getByTestId("my-game-world");
  127 |     await expect(world).toBeVisible();
  128 |     await capturePage(page, "world-fresh-step07.png");
  129 |     await captureAria(world, "world-fresh-step07.aria.yml");
  130 | 
  131 |     await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [GOLDEN_SLICE_SAVE_KEY, completedSave()] as const);
  132 |     await page.reload();
  133 |     await expect(world).toHaveAttribute("data-repaired", "true");
  134 |     await capturePage(page, "world-repaired-step07.png");
  135 | 
  136 |     await world.locator("[data-world-spellbook-open]").click();
  137 |     const spellbook = page.getByTestId("world-spellbook");
  138 |     await expect(spellbook).toBeVisible();
  139 |     await capturePage(page, "world-spellbook-step07.png");
  140 |     await captureAria(spellbook, "world-spellbook-step07.aria.yml");
  141 | 
  142 |     await page.goto("/?hub=classic");
  143 |     await expect(page.locator(".game-card")).toHaveCount(10);
  144 |     await capturePage(page, "classic-hub-step07.png");
  145 |     await captureAria(page.getByTestId("classic-hub-from-world"), "classic-hub-step07.aria.yml");
  146 |   });
  147 | 
  148 |   test("Golden Slice key states", async ({ page }) => {
  149 |     await page.goto("/?play=hanzi-v2-golden-slice&mode=play&from=world");
  150 |     await waitForPhase(page, "camp_intro");
  151 |     await capturePage(page, "forest-camp-step07.png");
  152 |     await captureAria(slice(page), "forest-camp-step07.aria.yml");
  153 | 
  154 |     await clickPrimary(page, "走进墨林");
  155 |     await clickPrimary(page, "看看营地灯");
  156 |     await clickPrimary(page, "沿着灯路出发");
  157 |     await clickPrimary(page, "跳过小路");
  158 |     await clickPrimary(page, "开始合字施法");
  159 |     await waitForPhase(page, "battle_1_placing");
  160 |     await capturePage(page, "forest-ming-placing-step07.png");
  161 | 
  162 |     await place(page, "ming-ri", "left");
  163 |     await place(page, "ming-yue", "right");
  164 |     await clickPrimary(page, "看看光留下什么");
  165 |     await clickPrimary(page, "继续看前路");
  166 |     await clickPrimary(page, "跳过花径");
  167 |     await clickPrimary(page, "试试新的结构");
  168 |     await place(page, "hua-cao", "top");
  169 |     await place(page, "hua-hua", "bottom");
  170 |     await clickPrimary(page, "看看三道光");
  171 |     await waitForPhase(page, "ability_choice");
  172 |     await capturePage(page, "forest-ability-step07.png");
  173 |     await captureAria(slice(page), "forest-ability-step07.aria.yml");
  174 | 
  175 |     await page.getByTestId("ability-ink-echo").click();
  176 |     await clickPrimary(page, "走向双印墨守");
  177 |     await clickPrimary(page, "先看清它的动作");
  178 |     await place(page, "lin-mu-left", "left");
  179 |     await waitForPhase(page, "boss_interference");
  180 |     await capturePage(page, "forest-boss-lin-step07.png");
  181 |     await slice(page).locator("[data-ink-echo-voice]").click();
  182 |     await waitForPhase(page, "boss_phase_1_placing");
  183 |     await place(page, "lin-mu-right", "right");
  184 |     await clickPrimary(page, "解开第二枚墨印");
  185 |     await place(page, "xing-ri", "top");
  186 |     await waitForPhase(page, "boss_phase_2_placing");
  187 |     await capturePage(page, "forest-boss-xing-step07.png");
  188 |     await place(page, "xing-sheng", "bottom");
```
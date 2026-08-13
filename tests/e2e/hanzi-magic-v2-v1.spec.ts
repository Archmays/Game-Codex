import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  HANZI_MAGIC_V1_ADVENTURES,
  getV1Encounter,
  type V1AdventureId,
} from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import type { AbilityId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import { createV1GameState, stepV1Game, type V1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import {
  HANZI_MAGIC_V1_SAVE_KEY,
  createFreshV1Save,
  saveFromGameState,
  type V1SaveState,
} from "../../games/hanzi-radical-battle/v2/v1/save";

const ROUTE = "/?play=hanzi-v2-v1&from=hub";
const EVIDENCE_ROOT = resolve("artifacts/hanzi-radical-battle-v2/v1-release/playthroughs");
const SCREENSHOT_ROOT = resolve("artifacts/hanzi-radical-battle-v2/v1-release/screenshots");
const SOURCE_TREE_SHA256 = process.env.V1_SOURCE_TREE_SHA256 ?? "UNFROZEN";
const BUILD_ID = process.env.V1_BUILD_ID ?? "local-source";

type PathId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  externalRequests: string[];
}

function observe(page: Page, context: BrowserContext): Diagnostics {
  const result: Diagnostics = { consoleErrors: [], pageErrors: [], externalRequests: [] };
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  context.on("request", (request) => {
    if (!/^https?:/i.test(request.url())) return;
    const host = new URL(request.url()).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") result.externalRequests.push(request.url());
  });
  return result;
}

async function screenshot(page: Page, name: string): Promise<string> {
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const absolute = resolve(SCREENSHOT_ROOT, `${name}.png`);
  await page.screenshot({ path: absolute, fullPage: true, animations: "disabled" });
  return absolute.replaceAll("\\", "/");
}

function writeEvidence(
  id: PathId,
  page: Page,
  diagnostics: Diagnostics,
  inputMode: string,
  saveFixture: string,
  criticalActions: readonly string[],
  finalState: unknown,
  screenshots: readonly string[],
): void {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const path = resolve(EVIDENCE_ROOT, `${id}.json`);
  const payload = {
    schemaVersion: 1,
    pathId: id,
    sourceTreeSha256: SOURCE_TREE_SHA256,
    buildId: BUILD_ID,
    route: ROUTE,
    viewport: page.viewportSize(),
    inputMode,
    saveFixture,
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    externalRequests: diagnostics.externalRequests,
    criticalActions,
    finalState,
    screenshots,
    verdict: "PASS",
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function solvePureEncounter(state: V1GameState): V1GameState {
  const encounter = getV1Encounter(state.currentEncounterId!);
  for (const card of encounter.cards.filter((entry) => entry.kind === "target")) {
    state = stepV1Game(state, { type: "select-card", cardId: card.id });
    state = stepV1Game(state, { type: "place-card", slotId: card.expectedSlotId! });
    if (state.phase === "boss-interference") state = stepV1Game(state, { type: "clear-interference" });
  }
  state = stepV1Game(state, { type: "continue" });
  return stepV1Game(state, { type: "continue" });
}

function pureSaveAfter(completedAdventureCount: 0 | 1 | 2 | 3): V1SaveState {
  let state = createV1GameState("v1-e2e-fixture");
  for (let index = 0; index < completedAdventureCount; index += 1) {
    const adventure = HANZI_MAGIC_V1_ADVENTURES[index];
    state = stepV1Game(state, { type: "start-adventure", adventureId: adventure.id });
    state = stepV1Game(state, { type: "begin-adventure" });
    state = solvePureEncounter(state);
    state = solvePureEncounter(state);
    state = stepV1Game(state, { type: "choose-ability", abilityId: adventure.abilityIds[index] });
    state = solvePureEncounter(state);
    state = solvePureEncounter(state);
    state = stepV1Game(state, { type: "repair-world" });
    state = stepV1Game(state, { type: "continue-from-report" });
    if (state.phase === "ending") {
      state = stepV1Game(state, { type: "open-spellbook" });
      state = stepV1Game(state, { type: "close-spellbook" });
      state = stepV1Game(state, { type: "finish-ending" });
    }
  }
  return saveFromGameState(createFreshV1Save(), state);
}

async function open(page: Page, save: V1SaveState | string | null = null): Promise<void> {
  await page.goto("/?hub=classic");
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    if (value !== null) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }, { key: HANZI_MAGIC_V1_SAVE_KEY, value: save });
  await page.goto(ROUTE);
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
}

async function currentSave(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), HANZI_MAGIC_V1_SAVE_KEY);
}

async function expectPhase(page: Page, phase: string): Promise<void> {
  await expect(page.getByTestId("hanzi-magic-v1")).toHaveAttribute("data-phase", phase);
}

async function solveEncounter(page: Page): Promise<void> {
  await expectPhase(page, "encounter");
  const encounterId = await page.getByTestId("v1-encounter").getAttribute("data-encounter");
  const encounter = getV1Encounter(encounterId as `v1-${string}` as Parameters<typeof getV1Encounter>[0]);
  for (const card of encounter.cards.filter((entry) => entry.kind === "target")) {
    await page.locator(`[data-card='${card.id}']`).click();
    await page.locator(`[data-slot='${card.expectedSlotId}']`).click();
    if (await page.getByTestId("v1-boss-interference").count()) {
      await expect(page.getByTestId("hanzi-magic-v1")).toHaveAttribute("data-world-input-enabled", "false");
      await page.locator("[data-action='clear-interference']").click();
      await expect(page.getByTestId("hanzi-magic-v1")).toHaveAttribute("data-world-input-enabled", "true");
    }
  }
  await expectPhase(page, "composition");
  await page.locator("[data-action='continue']").click();
  await expectPhase(page, "meaning");
  await page.locator("[data-action='continue']").click();
}

async function runAdventure(page: Page, adventureId: V1AdventureId, abilityId: AbilityId, replay = false): Promise<void> {
  await expectPhase(page, "camp");
  await page.locator(`[data-adventure='${adventureId}'][data-replay='${String(replay)}']`).first().click();
  await expectPhase(page, "adventure-intro");
  await page.locator("[data-action='begin-adventure']").click();
  await solveEncounter(page);
  await solveEncounter(page);
  await expect(page.getByTestId("v1-ability-choice")).toBeVisible();
  await page.locator(`[data-ability='${abilityId}']`).click();
  await solveEncounter(page);
  await solveEncounter(page);
  await expectPhase(page, "repair");
  await page.locator("[data-action='repair-world']").click();
  await expect(page.getByTestId("v1-chapter-report")).toHaveAttribute("data-effect-triggered", "true");
  await expect(page.getByTestId("v1-chapter-report")).toHaveAttribute("data-effect-visible", "true");
  await expect(page.getByTestId("v1-chapter-report")).toHaveAttribute("data-effect-state-verified", "true");
  await page.locator("[data-action='continue-from-report']").click();
}

async function tabTo(page: Page, selector: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await page.evaluate((query) => document.activeElement?.matches(query) ?? false, selector)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${selector}`);
}

async function keyboardActivate(page: Page, selector: string, key: "Enter" | "Space" = "Enter"): Promise<void> {
  await tabTo(page, selector);
  await expect(page.locator(selector)).toBeFocused();
  await page.keyboard.press(key);
}

async function keyboardSolveEncounter(page: Page, exerciseArrows = false): Promise<void> {
  const encounterId = await page.getByTestId("v1-encounter").getAttribute("data-encounter");
  const encounter = getV1Encounter(encounterId as Parameters<typeof getV1Encounter>[0]);
  const targets = encounter.cards.filter((entry) => entry.kind === "target");
  for (let index = 0; index < targets.length; index += 1) {
    const card = targets[index];
    await tabTo(page, `[data-card='${card.id}']`);
    if (exerciseArrows && index === 0) {
      const before = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.card);
      await page.keyboard.press("ArrowRight");
      const after = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.card);
      expect(after).not.toBe(before);
      await tabTo(page, `[data-card='${card.id}']`);
    }
    await page.keyboard.press(index % 2 ? "Space" : "Enter");
    await keyboardActivate(page, `[data-slot='${card.expectedSlotId}']`, index % 2 ? "Enter" : "Space");
    if (await page.getByTestId("v1-boss-interference").count()) {
      await keyboardActivate(page, "[data-action='clear-interference']", "Enter");
    }
  }
  await keyboardActivate(page, "[data-action='continue']", "Enter");
  await keyboardActivate(page, "[data-action='continue']", "Space");
}

test("P1 fresh user completes all three adventures, 12-character book, and ending", async ({ page, context }) => {
  test.setTimeout(120_000);
  const diagnostics = observe(page, context);
  await open(page);
  const shots: string[] = [await screenshot(page, "P1-00-fresh-camp")];
  for (const [index, adventure] of HANZI_MAGIC_V1_ADVENTURES.entries()) {
    await runAdventure(page, adventure.id, adventure.abilityIds[index]);
    if (index < 2) {
      await expect(page.getByTestId("v1-camp")).toHaveAttribute("data-repair-stage", String(index + 1));
      shots.push(await screenshot(page, `P1-0${index + 1}-camp-stage-${index + 1}`));
    }
  }
  await expectPhase(page, "ending");
  await expect(page.getByTestId("v1-ending").locator(".hmv1-ending-glyphs span")).toHaveCount(12);
  shots.push(await screenshot(page, "P1-03-ending"));
  await page.locator("[data-action='open-spellbook']").click();
  await expect(page.getByTestId("v1-spellbook").locator("nav button")).toHaveCount(12);
  shots.push(await screenshot(page, "P1-04-spellbook-12"));
  await page.locator("[data-action='close-spellbook']").click();
  await page.locator("[data-action='finish-ending']").click();
  await expectPhase(page, "camp");
  const save = await currentSave(page);
  expect(save).toMatchObject({ campRepairStage: 3, completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], discoveredCharacterIds: expect.arrayContaining(["ming", "pao"]) });
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P1", page, diagnostics, "mouse", "fresh", ["hub", "three adventures", "three repairs", "12-character spellbook", "ending", "free adventure"], save, shots);
});

test("P2 exits before adventure-two boss and resumes from a safe node", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await open(page, pureSaveAfter(1));
  await page.locator("[data-adventure='garden-echo']").first().click();
  await page.locator("[data-action='begin-adventure']").click();
  await solveEncounter(page);
  await solveEncounter(page);
  await expect(page.getByTestId("v1-ability-choice")).toBeVisible();
  const before = await currentSave(page);
  await page.reload();
  await expectPhase(page, "encounter");
  const after = await currentSave(page);
  expect(after).toMatchObject({ campRepairStage: 1, discoveredCharacterIds: expect.arrayContaining(["cao", "kan"]) });
  expect((after?.discoveredCharacterIds as unknown[]).length).toBeGreaterThanOrEqual((before?.discoveredCharacterIds as unknown[]).length);
  const shots = [await screenshot(page, "P2-safe-resume")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P2", page, diagnostics, "mouse", "chapter-1-complete", ["exit before adventure-two boss", "reload", "safe encounter resume", "stage-one retained"], after, shots);
});

test("P3 muted and reduced-motion play preserves the chapter outcome", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await open(page);
  await page.locator("[data-parent-action='open']").click();
  await page.locator("[data-setting='muted']").check();
  await page.locator("[data-setting='reducedMotion']").check();
  await page.locator("[data-parent-action='close']").click();
  await expect(page.getByTestId("hanzi-magic-v1")).toHaveAttribute("data-reduced-motion", "true");
  await runAdventure(page, "glimmer-path", "guardian-light");
  const save = await currentSave(page);
  expect(save).toMatchObject({ completedAdventureIds: ["glimmer-path"], discoveredCharacterIds: ["ming", "hua", "lin", "xing"], settings: { muted: true, reducedMotion: true } });
  const shots = [await screenshot(page, "P3-muted-reduced-stage-1")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P3", page, diagnostics, "mouse", "fresh-muted-reduced", ["mute", "reduce motion", "complete chapter", "compare deterministic outcome"], save, shots);
});

test.describe("P4 mobile touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("completes full-enclosure and semi-enclosure structures without overflow", async ({ page, context }) => {
    test.setTimeout(90_000);
    const diagnostics = observe(page, context);
    await open(page, pureSaveAfter(1));
    await page.touchscreen.tap(190, 470);
    await page.locator("[data-adventure='garden-echo']").first().click();
    await page.locator("[data-action='begin-adventure']").click();
    await solveEncounter(page);
    await solveEncounter(page);
    await page.locator("[data-ability='star-path']").click();
    await solveEncounter(page);
    await expect(page.getByTestId("v1-meaning")).toHaveCount(0);
    await solveEncounter(page);
    await page.locator("[data-action='repair-world']").click();
    await page.locator("[data-action='continue-from-report']").click();
    await page.locator("[data-adventure='wind-footprints']").first().click();
    await page.locator("[data-action='begin-adventure']").click();
    await expect(page.getByTestId("v1-encounter")).toHaveAttribute("data-structure", "semi-enclosure");
    await solveEncounter(page);
    const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, activeInput: document.querySelector("[data-testid='hanzi-magic-v1']")?.getAttribute("data-input-mode") }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
    expect(geometry.activeInput).toBe("touch");
    const shots = [await screenshot(page, "P4-mobile-touch-enclosures")];
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
    writeEvidence("P4", page, diagnostics, "touch", "chapter-1-complete", ["portrait", "tap card and slot", "full enclosure", "semi enclosure", "overflow gate"], await currentSave(page), shots);
  });
});

test("P5 keyboard-only completes a full adventure with visible focus and modal gating", async ({ page, context }) => {
  test.setTimeout(90_000);
  const diagnostics = observe(page, context);
  await open(page);
  await keyboardActivate(page, ".hmv1-primary--large[data-adventure='glimmer-path']", "Enter");
  await keyboardActivate(page, "[data-action='begin-adventure']", "Space");
  await keyboardSolveEncounter(page, true);
  await keyboardSolveEncounter(page);
  await keyboardActivate(page, "[data-ability='ink-echo']", "Enter");
  await keyboardSolveEncounter(page);
  await keyboardSolveEncounter(page);
  await keyboardActivate(page, "[data-action='repair-world']", "Space");
  await keyboardActivate(page, "[data-action='continue-from-report']", "Enter");
  await expectPhase(page, "camp");
  await expect(page.getByTestId("hanzi-magic-v1")).toHaveAttribute("data-input-mode", "keyboard");
  const save = await currentSave(page);
  expect(save).toMatchObject({ completedAdventureIds: ["glimmer-path"] });
  const shots = [await screenshot(page, "P5-keyboard-complete")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P5", page, diagnostics, "keyboard", "fresh", ["Tab", "ArrowRight", "Enter", "Space", "boss modal input gate", "complete chapter"], save, shots);
});

test("P6 two invalid placements escalate only the hint and never auto-solve", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await open(page);
  await page.locator("[data-adventure='glimmer-path']").first().click();
  await page.locator("[data-action='begin-adventure']").click();
  const encounter = getV1Encounter("v1-ming");
  const distractor = encounter.cards.find((card) => card.kind === "distractor")!;
  for (const slot of ["left", "right"] as const) {
    await page.locator(`[data-card='${distractor.id}']`).click();
    await page.locator(`[data-slot='${slot}']`).click();
  }
  await expect(page.getByTestId("v1-encounter")).toContainText("亮起的槽位会带路");
  await expect(page.locator(".hmv1-slot span")).toHaveCount(0);
  await expect(page.locator(".hmv1-slot[data-hint='true']")).toHaveCount(1);
  expect(await currentSave(page)).toMatchObject({ completedAdventureIds: [] });
  await solveEncounter(page);
  const shots = [await screenshot(page, "P6-gentle-hint-after-recovery")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P6", page, diagnostics, "mouse", "fresh", ["invalid one", "invalid two", "gentle copy", "slot hint", "no auto-solve", "recover"], await currentSave(page), shots);
});

test("P7 malformed and checksum-mismatched saves recover without overwriting the primary", async ({ page, context }) => {
  const diagnostics = observe(page, context);
  await open(page, "{malformed");
  await expect(page.getByTestId("v1-camp")).toContainText("安全的存档");
  const malformed = await page.evaluate((key) => ({ primary: localStorage.getItem(key), recovery: localStorage.getItem(`${key}.recovery`) }), HANZI_MAGIC_V1_SAVE_KEY);
  expect(malformed.primary).toBe("{malformed");
  expect(malformed.recovery).toContain("MALFORMED_JSON");
  const mismatch = createFreshV1Save();
  const rawMismatch = JSON.stringify({ ...mismatch, validation: { ...mismatch.validation, checksum: "fnv1a32:00000000" } });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: HANZI_MAGIC_V1_SAVE_KEY, raw: rawMismatch });
  await page.reload();
  await expect(page.getByTestId("v1-camp")).toBeVisible();
  const mismatchResult = await page.evaluate((key) => ({ primary: localStorage.getItem(key), recovery: localStorage.getItem(`${key}.recovery`) }), HANZI_MAGIC_V1_SAVE_KEY);
  expect(mismatchResult.primary).toBe(rawMismatch);
  expect(mismatchResult.recovery).toContain("CHECKSUM_MISMATCH");
  const shots = [await screenshot(page, "P7-calm-recovery")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P7", page, diagnostics, "mouse", "malformed-and-checksum-mismatch", ["inject malformed", "capture recovery", "preserve primary", "inject checksum mismatch", "safe fresh state"], mismatchResult, shots);
});

test("P8 free adventure replays all chapters with different abilities and no new characters", async ({ page, context }) => {
  test.setTimeout(120_000);
  const diagnostics = observe(page, context);
  await open(page, pureSaveAfter(3));
  const alternate: AbilityId[] = ["star-path", "ink-echo", "guardian-light"];
  for (const [index, adventure] of HANZI_MAGIC_V1_ADVENTURES.entries()) {
    await runAdventure(page, adventure.id, alternate[index], true);
  }
  const save = await currentSave(page);
  expect(save).toMatchObject({ completedAdventureIds: ["glimmer-path", "garden-echo", "wind-footprints"], campRepairStage: 3 });
  expect((save?.discoveredCharacterIds as unknown[])).toHaveLength(12);
  expect((save?.selectedAbilityHistory as unknown[])).toHaveLength(6);
  const shots = [await screenshot(page, "P8-free-adventure-three-abilities")];
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  writeEvidence("P8", page, diagnostics, "mouse", "v1-complete", ["free adventure", "replay three chapters", "different abilities", "three visible effects", "12-character ceiling"], save, shots);
});

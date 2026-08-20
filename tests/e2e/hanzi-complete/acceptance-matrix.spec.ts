import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_WORD_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/words";
import type { CompletePostgameMode } from "../../../games/hanzi-radical-battle/complete/core/complete-types";
import { COMPLETE_EPISODE_IDS, COMPLETE_REPAIR_IDS } from "../../../games/hanzi-radical-battle/complete/core/world-contracts";
import { createFreshCompleteSave, updateCompleteSave } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save-schema";
import { createCompleteWorkshopState, reduceCompleteWorkshopState } from "../../../games/hanzi-radical-battle/complete/workshop-adapter/engine";
import { COMPLETE_WHEEL_GRADE_OPTIONS, getCompleteWheelRecord } from "../../../games/hanzi-radical-battle/complete/wheel-adapter/selection";

type InputMode = "mouse" | "keyboard" | "touch";
type Profile = "NOVICE_POINTER" | "HESITANT_WITH_HINTS" | "KEYBOARD_ONLY" | "MOBILE_TOUCH" | "MUTED" | "REDUCED_MOTION" | "RETURNING_V1" | "RETURNING_V2" | "RETURNING_WHEEL" | "RETURNING_V2_PLUS_WHEEL" | "CORRUPT_SAVE" | "FUTURE_SAVE_READ_ONLY" | "CHAPTER_TWO" | "CHAPTER_THREE" | "EPILOGUE" | "FREE_ADVENTURE" | "COMPONENT_TRAILS" | "WORD_RESONANCE" | "WORLD_RETURN";

interface SessionScenario {
  readonly id: string;
  readonly kind: "postgame" | "wheel" | "state";
  readonly profiles: readonly Profile[];
  readonly input: InputMode;
  readonly viewport: readonly [number, number];
  readonly mode?: CompletePostgameMode;
  readonly band?: "whole-forest" | "story-path" | "optional-glow";
  readonly hero?: "light-speaker" | "forest-speaker" | "ink-companion";
  readonly grade?: string;
  readonly muted?: boolean;
  readonly reducedMotion?: boolean;
  readonly migrationSources?: readonly ("v1" | "v2" | "wheel")[];
  readonly rejectWrong?: boolean;
  readonly returnToWorld?: boolean;
  readonly stateCase?: "corrupt" | "future" | "returning-v1";
}

const postgameScenarios: readonly SessionScenario[] = [
  { id: "P01", kind: "postgame", profiles: ["NOVICE_POINTER", "FREE_ADVENTURE"], input: "mouse", viewport: [1366, 768], mode: "free-adventure" },
  { id: "P02", kind: "postgame", profiles: ["HESITANT_WITH_HINTS", "COMPONENT_TRAILS"], input: "mouse", viewport: [1366, 768], mode: "component-trails", rejectWrong: true },
  { id: "P03", kind: "postgame", profiles: ["KEYBOARD_ONLY", "WORD_RESONANCE"], input: "keyboard", viewport: [1366, 768], mode: "word-resonance" },
  { id: "P04", kind: "postgame", profiles: ["MOBILE_TOUCH", "FREE_ADVENTURE"], input: "touch", viewport: [390, 844], mode: "free-adventure" },
  { id: "P05", kind: "postgame", profiles: ["MUTED", "COMPONENT_TRAILS"], input: "mouse", viewport: [768, 1024], mode: "component-trails", muted: true },
  { id: "P06", kind: "postgame", profiles: ["REDUCED_MOTION", "WORD_RESONANCE"], input: "mouse", viewport: [1366, 768], mode: "word-resonance", reducedMotion: true },
  { id: "P07", kind: "postgame", profiles: ["RETURNING_V1", "FREE_ADVENTURE"], input: "mouse", viewport: [1366, 768], mode: "free-adventure", migrationSources: ["v1"] },
  { id: "P08", kind: "postgame", profiles: ["RETURNING_V2", "COMPONENT_TRAILS"], input: "mouse", viewport: [1366, 768], mode: "component-trails", migrationSources: ["v2"] },
  { id: "P09", kind: "postgame", profiles: ["RETURNING_WHEEL", "WORD_RESONANCE"], input: "keyboard", viewport: [1366, 768], mode: "word-resonance", migrationSources: ["wheel"] },
  { id: "P10", kind: "postgame", profiles: ["RETURNING_V2_PLUS_WHEEL", "FREE_ADVENTURE"], input: "mouse", viewport: [1600, 900], mode: "free-adventure", migrationSources: ["v2", "wheel"] },
  { id: "P11", kind: "postgame", profiles: ["CHAPTER_TWO", "COMPONENT_TRAILS"], input: "keyboard", viewport: [768, 1024], mode: "component-trails" },
  { id: "P12", kind: "postgame", profiles: ["CHAPTER_THREE", "WORD_RESONANCE"], input: "mouse", viewport: [1600, 900], mode: "word-resonance" },
  { id: "P13", kind: "postgame", profiles: ["EPILOGUE", "FREE_ADVENTURE"], input: "mouse", viewport: [1366, 768], mode: "free-adventure", hero: "forest-speaker" },
  { id: "P14", kind: "postgame", profiles: ["WORLD_RETURN", "FREE_ADVENTURE"], input: "mouse", viewport: [1366, 768], mode: "free-adventure", returnToWorld: true },
  { id: "P15", kind: "postgame", profiles: ["FREE_ADVENTURE"], input: "mouse", viewport: [768, 1024], mode: "free-adventure", band: "story-path" },
  { id: "P16", kind: "postgame", profiles: ["COMPONENT_TRAILS"], input: "mouse", viewport: [1600, 900], mode: "component-trails", hero: "ink-companion" },
  { id: "P17", kind: "postgame", profiles: ["WORD_RESONANCE", "MOBILE_TOUCH"], input: "touch", viewport: [390, 844], mode: "word-resonance" },
  { id: "P18", kind: "postgame", profiles: ["FREE_ADVENTURE"], input: "mouse", viewport: [1366, 768], mode: "free-adventure", band: "optional-glow" },
  { id: "P19", kind: "postgame", profiles: ["FREE_ADVENTURE", "KEYBOARD_ONLY"], input: "keyboard", viewport: [1366, 768], mode: "free-adventure", band: "story-path" },
  { id: "P20", kind: "postgame", profiles: ["FREE_ADVENTURE"], input: "mouse", viewport: [1600, 900], mode: "free-adventure", hero: "forest-speaker" },
  { id: "P21", kind: "postgame", profiles: ["COMPONENT_TRAILS"], input: "keyboard", viewport: [1366, 768], mode: "component-trails", hero: "ink-companion" },
  { id: "P22", kind: "postgame", profiles: ["WORD_RESONANCE"], input: "mouse", viewport: [768, 1024], mode: "word-resonance", hero: "forest-speaker", rejectWrong: true },
  { id: "P23", kind: "postgame", profiles: ["MUTED", "KEYBOARD_ONLY", "WORD_RESONANCE"], input: "keyboard", viewport: [1366, 768], mode: "word-resonance", muted: true },
  { id: "P24", kind: "postgame", profiles: ["REDUCED_MOTION", "MOBILE_TOUCH", "COMPONENT_TRAILS"], input: "touch", viewport: [390, 844], mode: "component-trails", reducedMotion: true },
];

const wheelScenarios: readonly SessionScenario[] = COMPLETE_WHEEL_GRADE_OPTIONS.filter((grade) => grade.id !== "journey").map((grade, index) => ({
  id: `W${String(index + 1).padStart(2, "0")}`,
  kind: "wheel",
  profiles: index === 0 ? ["NOVICE_POINTER"] : index === 1 ? ["KEYBOARD_ONLY"] : index === 2 ? ["MOBILE_TOUCH"] : [],
  input: index % 3 === 0 ? "mouse" : index % 3 === 1 ? "keyboard" : "touch",
  viewport: index % 3 === 2 ? [390, 844] : index % 2 ? [768, 1024] : [1366, 768],
  grade: grade.id,
}));

const stateScenarios: readonly SessionScenario[] = [
  { id: "S01", kind: "state", profiles: ["CORRUPT_SAVE"], input: "mouse", viewport: [1366, 768], stateCase: "corrupt" },
  { id: "S02", kind: "state", profiles: ["FUTURE_SAVE_READ_ONLY"], input: "keyboard", viewport: [1366, 768], stateCase: "future" },
  { id: "S03", kind: "state", profiles: ["RETURNING_V1", "WORLD_RETURN"], input: "touch", viewport: [390, 844], stateCase: "returning-v1", migrationSources: ["v1"] },
];

const SCENARIOS = [...postgameScenarios, ...wheelScenarios, ...stateScenarios] as const;
const REQUIRED_PROFILES: readonly Profile[] = ["NOVICE_POINTER", "HESITANT_WITH_HINTS", "KEYBOARD_ONLY", "MOBILE_TOUCH", "MUTED", "REDUCED_MOTION", "RETURNING_V1", "RETURNING_V2", "RETURNING_WHEEL", "RETURNING_V2_PLUS_WHEEL", "CORRUPT_SAVE", "FUTURE_SAVE_READ_ONLY", "CHAPTER_TWO", "CHAPTER_THREE", "EPILOGUE", "FREE_ADVENTURE", "COMPONENT_TRAILS", "WORD_RESONANCE", "WORLD_RETURN"];

function completedSave(scenario: SessionScenario) {
  const initial = updateCompleteSave(createFreshCompleteSave(), {
    selectedHeroId: scenario.hero ?? "light-speaker",
    settings: { muted: scenario.muted ?? true, reducedMotion: scenario.reducedMotion ?? false, inputMode: scenario.input === "touch" ? "touch" : scenario.input === "keyboard" ? "keyboard" : "mouse" },
    activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: `matrix-${scenario.id}`, actionCount: 0 },
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"], completedEpisodeIds: COMPLETE_EPISODE_IDS,
    discoveredCharacterIds: COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id), repairedObjectIds: COMPLETE_REPAIR_IDS,
  });
  if (!scenario.migrationSources?.length) return initial;
  return updateCompleteSave(initial, { migration: { ...initial.migration, sources: scenario.migrationSources, characterProvenance: initial.discoveredCharacterIds.map((characterId) => ({ characterId, sources: scenario.migrationSources! })) } });
}

async function activate(page: Page, locator: Locator, mode: InputMode) {
  if (mode === "keyboard") { await locator.focus(); await page.keyboard.press("Enter"); }
  else await locator.evaluate((element) => (element as HTMLElement).click());
}

async function solvePostgameBuild(page: Page, mode: InputMode, rejectWrong: boolean) {
  const build = page.getByTestId("complete-postgame-build"); const characterId = await build.getAttribute("data-character-id"); const target = COMPLETE_CORE_CHARACTER_NODES.find((candidate) => candidate.id === characterId)!;
  if (rejectWrong) {
    const cards = await page.locator("[data-card-id]:not([disabled])").allTextContents(); const wrongIndex = cards.findIndex((text) => !target.components.some((component) => component.glyph === text.trim()));
    if (wrongIndex >= 0) { await activate(page, page.locator("[data-card-id]:not([disabled])").nth(wrongIndex), mode); await activate(page, page.locator(`[data-slot-id="${target.components[0].slotId}"]`), mode); await expect(page.getByTestId("complete-postgame")).toContainText("进度都保留"); }
  }
  for (const component of target.components) {
    const slot = page.locator(`[data-slot-id="${component.slotId}"]`);
    if (await slot.evaluate((element) => element.classList.contains("is-filled"))) continue;
    await activate(page, page.locator(`[data-card-id$="-${component.order}"]:not([disabled])`), mode);
    await activate(page, slot, mode);
  }
}

async function completePostgame(page: Page, scenario: SessionScenario) {
  const shell = page.getByTestId("complete-postgame"); let rejected = false;
  for (let guard = 0; guard < 420; guard += 1) {
    const phase = await shell.getAttribute("data-phase"); if (phase === "session-summary") return;
    if (phase === "mode-intro") await activate(page, page.locator('[data-action="start"]'), scenario.input);
    else if (phase === "offer-choice") await activate(page, page.locator("[data-offer-id]").first(), scenario.input);
    else if (["character-build", "family-build", "word-build-a", "word-build-b"].includes(String(phase))) { await solvePostgameBuild(page, scenario.input, Boolean(scenario.rejectWrong && !rejected)); rejected = true; }
    else if (["character-meaning", "family-meaning", "word-meaning-a", "word-meaning-b", "round-complete"].includes(String(phase))) await activate(page, page.locator('[data-action="continue"]'), scenario.input);
    else if (phase === "family-link") { const expected = await page.getByTestId("complete-postgame-family-link").getAttribute("data-family-id"); await activate(page, page.locator(`button[data-family-id="${expected}"]`), scenario.input); }
    else if (phase === "word-order") { const wordId = await page.getByTestId("complete-postgame-word-order").getAttribute("data-word-id"); const word = COMPLETE_WORD_NODES.find((candidate) => candidate.id === wordId)!; await activate(page, page.locator(`[data-word-character-id="${word.characterIds[0]}"]`), scenario.input); await activate(page, page.locator(`[data-word-character-id="${word.characterIds[1]}"]`), scenario.input); }
    else if (phase === "word-context") { const wordId = await page.getByTestId("complete-postgame-context").getAttribute("data-word-id"); await activate(page, page.locator(`[data-context-word-id="${wordId}"]`), scenario.input); }
    else throw new Error(`${scenario.id} unexpected postgame phase ${phase}`);
  }
  throw new Error(`${scenario.id} postgame exceeded guard`);
}

async function completeWheel(page: Page, scenario: SessionScenario) {
  let oracle = createCompleteWorkshopState(`matrix-${scenario.id}`); const shell = page.getByTestId("complete-workshop");
  if (scenario.grade) { await activate(page, page.locator(`[data-grade-id="${scenario.grade}"]`), scenario.input); oracle = reduceCompleteWorkshopState(oracle, { type: "choose-grade", gradeId: scenario.grade as never }); }
  for (let round = 0; round < 3; round += 1) {
    await activate(page, page.locator('[data-action="spin"]'), scenario.input); oracle = reduceCompleteWorkshopState(oracle, { type: "spin" }); const target = getCompleteWheelRecord(oracle.currentRound!.recordId); const partner = oracle.currentRound!.cards.find((card) => card.kind === "partner")!;
    await activate(page, page.locator(`[data-card-id="${partner.id}"]`), scenario.input); oracle = reduceCompleteWorkshopState(oracle, { type: "select-card", cardId: partner.id }); await activate(page, page.locator(`[data-slot-id="${target.slotIds[1]}"]`), scenario.input); oracle = reduceCompleteWorkshopState(oracle, { type: "place-card", slotId: target.slotIds[1] }); await activate(page, page.locator('[data-action="continue"]'), scenario.input); oracle = reduceCompleteWorkshopState(oracle, { type: "continue" });
  }
  await expect(shell).toHaveAttribute("data-phase", "summary");
}

async function runScenario(browser: Browser, scenario: SessionScenario) {
  const context = await browser.newContext({ viewport: { width: scenario.viewport[0], height: scenario.viewport[1] }, hasTouch: scenario.input === "touch", reducedMotion: scenario.reducedMotion ? "reduce" : "no-preference" });
  const consoleErrors: string[] = []; const pageErrors: string[] = []; const externalRequests: string[] = [];
  if (scenario.kind !== "state" || scenario.stateCase === "returning-v1") {
    const save = completedSave(scenario); await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(save) });
  } else if (scenario.stateCase === "corrupt") {
    const backup = completedSave(scenario); await context.addInitScript(({ key, backupKey, backupValue }) => { localStorage.setItem(key, "{broken"); localStorage.setItem(backupKey, backupValue); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, backupKey: HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, backupValue: JSON.stringify(backup) });
  } else await context.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 99, futureField: "preserve" })), HANZI_MAGIC_COMPLETE_SAVE_KEY);
  const page = await context.newPage(); page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); }); page.on("pageerror", (error) => pageErrors.push(error.message)); page.on("request", (request) => { if (/^https?:/i.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") externalRequests.push(request.url()); });
  if (scenario.kind === "postgame") {
    await page.goto(`/?play=hanzi-magic-complete&from=hub&postgame=${scenario.mode}&band=${scenario.band ?? "whole-forest"}&new=1&seed=matrix-${scenario.id}`); await completePostgame(page, scenario); await expect(page.getByTestId("complete-postgame")).toHaveAttribute("data-completed-offer-count", "6");
    if (scenario.returnToWorld) { await page.getByRole("link", { name: "回到墨迹森林" }).click(); await expect(page.getByTestId("hanzi-magic-complete")).toBeVisible(); }
  } else if (scenario.kind === "wheel") {
    await page.goto(`/?play=hanzi-magic-complete&from=hub&view=wheel&grade=${scenario.grade}&seed=matrix-${scenario.id}`); await completeWheel(page, scenario);
  } else {
    await page.goto("/?play=hanzi-magic-complete&from=hub"); const world = page.getByTestId("hanzi-magic-complete"); await expect(world).toBeVisible();
    if (scenario.stateCase === "corrupt") await expect(world).toHaveAttribute("data-save-source", "v3-backup");
    else if (scenario.stateCase === "future") await expect(world).toHaveAttribute("data-save-read-only", "true");
    else await expect(world).toHaveAttribute("data-migration-sources", /v1/);
  }
  expect({ consoleErrors, pageErrors, externalRequests }).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] }); await context.close();
}

if (SCENARIOS.length !== 36 || new Set(SCENARIOS.flatMap((scenario) => scenario.profiles)).size !== REQUIRED_PROFILES.length || !REQUIRED_PROFILES.every((profile) => SCENARIOS.some((scenario) => scenario.profiles.includes(profile)))) {
  throw new Error("Acceptance browser matrix must contain 36 playthroughs and all 19 required profiles");
}

const resultRoot = resolve("test-results/hanzi-complete/acceptance-matrix-results");
mkdirSync(resultRoot, { recursive: true });

for (const scenario of SCENARIOS) {
  test(`${scenario.id} completes ${scenario.kind} for ${scenario.profiles.join("+") || "supplemental coverage"}`, async ({ browser }) => {
    test.setTimeout(120_000); await runScenario(browser, scenario);
    writeFileSync(resolve(resultRoot, `${scenario.id}.json`), `${JSON.stringify({ id: scenario.id, kind: scenario.kind, profiles: scenario.profiles, input: scenario.input, viewport: `${scenario.viewport[0]}x${scenario.viewport[1]}`, result: "PASS" }, null, 2)}\n`, "utf8");
  });
}

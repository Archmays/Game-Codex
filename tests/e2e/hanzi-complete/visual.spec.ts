import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { M5_BOSSES } from "../../../games/hanzi-radical-battle/v2/chapter-one/m5-content";
import { COMPLETE_BOSS_ARCHIVE, COMPLETE_REPAIR_ARCHIVE } from "../../../games/hanzi-radical-battle/complete/archive/contracts";
import { CHAPTER_THREE_EPISODES } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-three/contracts";
import { createChapterThreeState, reduceChapterThreeState, simulateChapterThree, type ChapterThreeAction } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-three/engine";
import { CHAPTER_TWO_EPISODES } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-two/contracts";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { COMPLETE_COMPONENT_FAMILIES } from "../../../games/hanzi-radical-battle/complete/content-graph/families";
import { COMPLETE_WORD_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/words";
import type { CompletePostgameMode } from "../../../games/hanzi-radical-battle/complete/core/complete-types";
import { COMPLETE_EPISODE_IDS, COMPLETE_REPAIR_IDS } from "../../../games/hanzi-radical-battle/complete/core/world-contracts";
import { COMPLETE_POSTGAME_MODE_DEFINITIONS } from "../../../games/hanzi-radical-battle/complete/postgame/contracts";
import { createCompletePostgameRun, reduceCompletePostgameRun, simulateCompletePostgame, type CompletePostgameAction, type CompletePostgamePhase } from "../../../games/hanzi-radical-battle/complete/postgame/engine";
import { createFreshCompleteSave, updateCompleteSave } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save-schema";
import { COMPLETE_SPELLBOOK_ENTRIES } from "../../../games/hanzi-radical-battle/complete/spellbook/catalog";

type VisualCategory = "world" | "mode" | "boss" | "repair" | "spellbook" | "family" | "word" | "epilogue";

interface VisualRecord {
  readonly id: string;
  readonly category: VisualCategory;
  readonly viewport: string;
  readonly ariaSha256: string;
  readonly visibleControlCount: number;
  readonly locationId?: string;
  readonly locationKind?: "regular" | "core";
}

const records = new Map<string, VisualRecord>();
const checkpointRoot = resolve("artifacts/hanzi-magic-battle/v3-complete/checkpoints");
const snapshotRoot = resolve("tests/e2e/hanzi-complete/visual.spec.ts-snapshots");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function completedSave() {
  return updateCompleteSave(createFreshCompleteSave(), {
    selectedHeroId: "forest-speaker",
    settings: { muted: true, reducedMotion: false, inputMode: "auto" },
    activeResume: { screen: "world", chapterId: "chapter-three", episodeId: null, phase: "world", seed: "visual-complete", actionCount: 0 },
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedEpisodeIds: COMPLETE_EPISODE_IDS,
    discoveredCharacterIds: COMPLETE_CORE_CHARACTER_NODES.map((character) => character.id),
    discoveredFamilyIds: COMPLETE_COMPONENT_FAMILIES.map((family) => family.id),
    discoveredWordIds: COMPLETE_WORD_NODES.map((word) => word.id),
    repairedObjectIds: COMPLETE_REPAIR_IDS,
  });
}

async function establishOrigin(page: Page): Promise<void> {
  await page.goto("/?play=hanzi-magic-complete&from=hub&fresh=1");
  await expect(page.getByTestId("hanzi-magic-complete")).toBeVisible();
}

async function installRawSave(page: Page, primary: string | null, backup: string | null = null): Promise<void> {
  await page.evaluate(({ key, backupKey, primaryValue, backupValue }) => {
    localStorage.removeItem(key);
    localStorage.removeItem(backupKey);
    if (primaryValue !== null) localStorage.setItem(key, primaryValue);
    if (backupValue !== null) localStorage.setItem(backupKey, backupValue);
  }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, backupKey: HANZI_MAGIC_COMPLETE_SAVE_BACKUP_KEY, primaryValue: primary, backupValue: backup });
}

async function openWithSave(page: Page, save: ReturnType<typeof completedSave>, route: string): Promise<void> {
  await installRawSave(page, JSON.stringify(save));
  await page.goto(route);
}

function monitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/i.test(url) && new URL(url).hostname !== "127.0.0.1") externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function inspectState(
  page: Page,
  target: Locator,
  id: string,
  category: VisualCategory,
  token: string,
  location?: { id: string; kind: "regular" | "core" },
): Promise<void> {
  await expect(target).toBeVisible();
  await page.mouse.move(0, 0);
  const aria = await target.ariaSnapshot();
  expect(aria.length, `${id} must expose a meaningful accessibility tree`).toBeGreaterThan(20);
  expect(aria, `${id} must expose its semantic identity`).toContain(token);
  expect(aria, `${id} must expose an actionable or headed state`).toMatch(/heading|button|link|list|group/);
  const geometry = await page.evaluate(() => {
    const visible = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), a")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      controlCount: visible.length,
      undersized: visible.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map((element) => ({ label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    };
  });
  expect(geometry.scrollWidth, `${id} must not overflow horizontally`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.undersized, `${id} controls must remain touch-sized`).toEqual([]);
  await expect(target).toHaveScreenshot(`${id}.png`);
  const viewport = page.viewportSize();
  records.set(id, {
    id,
    category,
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    ariaSha256: sha256(aria),
    visibleControlCount: geometry.controlCount,
    ...(location ? { locationId: location.id, locationKind: location.kind } : {}),
  });
}

function postgameActionsAt(mode: CompletePostgameMode, phase: CompletePostgamePhase): readonly CompletePostgameAction[] {
  const seed = `visual-${mode}`;
  const simulation = simulateCompletePostgame(mode, seed);
  expect(simulation.passed).toBe(true);
  let run = createCompletePostgameRun(seed, "forest-speaker", mode, "whole-forest");
  if (run.state.phase === phase) return [];
  for (let index = 0; index < simulation.actions.length; index += 1) {
    run = reduceCompletePostgameRun(run, simulation.actions[index]);
    if (run.state.phase === phase) return simulation.actions.slice(0, index + 1);
  }
  throw new Error(`Unable to build visual postgame phase ${mode}:${phase}`);
}

function postgameSaveAt(mode: CompletePostgameMode, phase: CompletePostgamePhase) {
  const save = completedSave();
  const seed = `visual-${mode}`;
  const actions = postgameActionsAt(mode, phase);
  return updateCompleteSave(save, {
    postgameResume: { mode, seed, initialHeroId: "forest-speaker", band: "whole-forest", phase, actionCount: actions.length, actions },
    activeResume: { screen: "postgame", chapterId: "chapter-three", episodeId: null, phase, seed, actionCount: actions.length },
  });
}

function chapterThreeActionsAt(phase: "epilogue-forest" | "epilogue-companions" | "epilogue-home"): readonly ChapterThreeAction[] {
  const seed = "visual-epilogue";
  const simulation = simulateChapterThree(seed, "forest-speaker");
  expect(simulation.passed).toBe(true);
  let state = createChapterThreeState(seed, "forest-speaker");
  for (let index = 0; index < simulation.actions.length; index += 1) {
    state = reduceChapterThreeState(state, simulation.actions[index]);
    if (state.phase === phase) return simulation.actions.slice(0, index + 1);
  }
  throw new Error(`Unable to build Chapter Three visual phase ${phase}`);
}

function epilogueSaveAt(phase: "epilogue-forest" | "epilogue-companions" | "epilogue-home") {
  const seed = "visual-epilogue";
  const actions = chapterThreeActionsAt(phase);
  return updateCompleteSave(createFreshCompleteSave(), {
    selectedHeroId: "forest-speaker",
    settings: { muted: true, reducedMotion: true, inputMode: "auto" },
    unlockedChapterIds: ["chapter-one", "chapter-two", "chapter-three"],
    completedChapterIds: ["chapter-one", "chapter-two"],
    chapterThreeReplay: { seed, initialHeroId: "forest-speaker", actions },
    activeResume: { screen: "chapter-three", chapterId: "chapter-three", episodeId: "chapter-three:word-heart-core", phase, seed, actionCount: actions.length },
  });
}

const bossLocations = new Map<string, { id: string; kind: "regular" | "core" }>([
  ...M5_BOSSES.map((boss) => [boss.id, { id: `chapter-one:${boss.regionId}`, kind: boss.regionId === "ink-king-core" ? "core" as const : "regular" as const }] as const),
  ...CHAPTER_TWO_EPISODES.map((episode) => [episode.bossId, { id: episode.id, kind: episode.id.endsWith("core") ? "core" as const : "regular" as const }] as const),
  ...CHAPTER_THREE_EPISODES.map((episode) => [episode.bossId, { id: episode.id, kind: episode.id.endsWith("core") ? "core" as const : "regular" as const }] as const),
]);

test.describe.serial("@visual @geometry V3 stable visual, ARIA and geometry matrix", () => {
  test("world, chapter path, heroes, settings, recovery and target viewports", async ({ page }) => {
    test.setTimeout(180_000);
    const logs = monitor(page);
    await establishOrigin(page);
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-fresh-desktop", "world", "墨迹森林");

    await openWithSave(page, completedSave(), "/?play=hanzi-magic-complete&from=hub");
    await inspectState(page, page.locator(".hmc3-hotspots"), "world-complete-hotspots", "world", "沿场景里的光继续探索");

    for (const hero of [
      { id: "light-speaker", token: "光语魔法师" },
      { id: "forest-speaker", token: "森语魔法师" },
      { id: "ink-companion", token: "墨点伙伴师" },
    ] as const) {
      await page.locator(`[data-hero-id="${hero.id}"]`).last().click();
      await inspectState(page, page.getByTestId("complete-current-hero"), `world-hero-${hero.id}`, "world", hero.token);
    }
    await inspectState(page, page.locator(".hmc3-journey"), "world-chapter-select", "world", "前方的林路");

    await page.setViewportSize({ width: 390, height: 844 });
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-mobile-390x844", "world", "墨迹森林");
    await page.setViewportSize({ width: 768, height: 1024 });
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-tablet-768x1024", "world", "墨迹森林");
    await page.setViewportSize({ width: 1600, height: 900 });
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-wide-1600x900", "world", "墨迹森林");

    await page.locator('[data-pref="muted"]').click();
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-muted-toggle", "world", "静音");
    await page.locator('[data-pref="reduced-motion"]').click();
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "world-reduced-motion", "world", "恢复动画");

    await installRawSave(page, "{broken", JSON.stringify(completedSave()));
    await page.goto("/?play=hanzi-magic-complete&from=hub");
    await expect(page.getByTestId("hanzi-magic-complete")).toHaveAttribute("data-save-source", "v3-backup");
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "save-corrupt-backup-recovery", "world", "墨迹森林");

    await installRawSave(page, JSON.stringify({ schemaVersion: 99, futureField: "preserve" }));
    await page.goto("/?play=hanzi-magic-complete&from=hub");
    await expect(page.getByTestId("hanzi-magic-complete")).toHaveAttribute("data-save-read-only", "true");
    await inspectState(page, page.getByTestId("hanzi-magic-complete"), "save-future-read-only", "world", "不会覆盖");
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("three postgame mode introductions", async ({ page }) => {
    const logs = monitor(page);
    await establishOrigin(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const mode of COMPLETE_POSTGAME_MODE_DEFINITIONS) {
      await openWithSave(page, completedSave(), `/?play=hanzi-magic-complete&from=hub&postgame=${mode.id}&new=1&seed=visual-mode-${mode.id}`);
      await expect(page.getByTestId("complete-postgame")).toHaveAttribute("data-phase", "mode-intro");
      await inspectState(page, page.getByTestId("complete-postgame-intro"), `mode-${mode.id}-intro`, "mode", mode.name);
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("twelve region/core bosses across their three readable stages", async ({ page }) => {
    test.setTimeout(240_000);
    const logs = monitor(page);
    await establishOrigin(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await openWithSave(page, completedSave(), "/?play=hanzi-magic-complete&from=hub&view=archive");
    for (const boss of COMPLETE_BOSS_ARCHIVE) {
      const location = bossLocations.get(boss.id);
      if (!location) throw new Error(`Missing location mapping for ${boss.id}`);
      await page.locator(`[data-archive-boss-id="${boss.id}"]`).click();
      const detail = page.getByTestId("complete-archive-boss-detail");
      for (const stage of [0, 1, 2] as const) {
        await expect(detail).toHaveAttribute("data-boss-id", boss.id);
        await expect(detail).toHaveAttribute("data-stage", String(stage));
        await inspectState(page, detail, `boss-${boss.id}-stage-${stage}`, "boss", boss.name, location);
        if (stage < 2) await page.locator('[data-action="archive-boss-next"]').click();
      }
      await page.locator('[data-action="archive-close-detail"]').click();
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("all sixteen persistent before/after repairs", async ({ page }) => {
    test.setTimeout(180_000);
    const logs = monitor(page);
    await establishOrigin(page);
    await openWithSave(page, completedSave(), "/?play=hanzi-magic-complete&from=hub&view=archive");
    for (const repair of COMPLETE_REPAIR_ARCHIVE) {
      await page.locator(`[data-archive-repair-id="${repair.id}"]`).click();
      const detail = page.getByTestId("complete-archive-repair-detail");
      await expect(detail).toHaveAttribute("data-repair-id", repair.id);
      await expect(detail.locator("article")).toHaveCount(2);
      await inspectState(page, detail, `repair-${repair.id}`, "repair", repair.name);
      await page.locator('[data-action="archive-close-detail"]').click();
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("representative spellbook structures and optional bands", async ({ page }) => {
    test.setTimeout(120_000);
    const logs = monitor(page);
    await establishOrigin(page);
    await openWithSave(page, completedSave(), "/?play=hanzi-magic-complete&from=hub&view=spellbook");
    for (const index of [0, 11, 23, 35, 47, 59, 65, 71]) {
      const entry = COMPLETE_SPELLBOOK_ENTRIES[index];
      await page.locator(`.hmcs-index [data-character-id="${entry.id}"]`).click();
      const detail = page.getByTestId("complete-spellbook-detail");
      await expect(detail).toHaveAttribute("data-character-id", entry.id);
      await inspectState(page, detail, `spellbook-${String(index + 1).padStart(2, "0")}-${entry.id}`, "spellbook", entry.glyph);
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("family and word interaction phases", async ({ page }) => {
    test.setTimeout(120_000);
    const logs = monitor(page);
    await establishOrigin(page);
    for (const phase of ["family-build", "family-link"] as const) {
      await openWithSave(page, postgameSaveAt("component-trails", phase), "/?play=hanzi-magic-complete&from=hub&postgame=component-trails");
      const shell = page.getByTestId("complete-postgame");
      await expect(shell).toHaveAttribute("data-phase", phase);
      const target = phase === "family-build" ? page.getByTestId("complete-postgame-build") : page.getByTestId("complete-postgame-family-link");
      await inspectState(page, target, `family-interaction-${phase}`, "family", phase === "family-build" ? "把字灵送回真实位置" : "共享部件字脉");
    }
    for (const phase of ["word-order", "word-context"] as const) {
      await openWithSave(page, postgameSaveAt("word-resonance", phase), "/?play=hanzi-magic-complete&from=hub&postgame=word-resonance");
      const shell = page.getByTestId("complete-postgame");
      await expect(shell).toHaveAttribute("data-phase", phase);
      const target = phase === "word-order" ? page.getByTestId("complete-postgame-word-order") : page.getByTestId("complete-postgame-context");
      await inspectState(page, target, `word-interaction-${phase}`, "word", phase === "word-order" ? "真实阅读顺序" : "真实语境");
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("three epilogue states", async ({ page }) => {
    test.setTimeout(120_000);
    const logs = monitor(page);
    await establishOrigin(page);
    for (const phase of ["epilogue-forest", "epilogue-companions", "epilogue-home"] as const) {
      await openWithSave(page, epilogueSaveAt(phase) as ReturnType<typeof completedSave>, "/?play=hanzi-magic-complete&from=hub&chapter=three");
      const shell = page.getByTestId("hanzi-complete-chapter-three");
      await expect(shell).toHaveAttribute("data-phase", phase);
      const token = phase === "epilogue-forest" ? "字光归林" : phase === "epilogue-companions" ? "同行伙伴" : "家灯";
      await inspectState(page, page.getByTestId("chapter-three-epilogue"), `epilogue-${phase}`, "epilogue", token);
    }
    expect(logs).toEqual({ consoleErrors: [], pageErrors: [], externalRequests: [] });
  });

  test("writes the deterministic 72-plus state verdict", async () => {
    const stateRecords = [...records.values()].sort((left, right) => left.id.localeCompare(right.id));
    expect(stateRecords.length).toBeGreaterThanOrEqual(72);
    const locations = [...new Map(stateRecords.filter((record) => record.locationId).map((record) => [record.locationId!, record])).values()];
    expect(locations.filter((record) => record.locationKind === "regular")).toHaveLength(9);
    expect(locations.filter((record) => record.locationKind === "core")).toHaveLength(3);
    for (const required of ["world", "mode", "boss", "repair", "spellbook", "family", "word", "epilogue"] as const) expect(stateRecords.some((record) => record.category === required)).toBe(true);
    const snapshots = readdirSync(snapshotRoot).filter((name) => name.endsWith(".png")).sort();
    expect(snapshots).toHaveLength(stateRecords.length);
    const snapshotHashes = snapshots.map((name) => ({ name, sha256: sha256(readFileSync(resolve(snapshotRoot, name))) }));
    const verdict = {
      schemaVersion: 1,
      verdict: "PASS_MACHINE",
      stableStateMinimum: 72,
      stableStateCount: stateRecords.length,
      ariaStateCount: stateRecords.length,
      geometryStateCount: stateRecords.length,
      screenshotBaselineCount: snapshots.length,
      categories: Object.fromEntries(["world", "mode", "boss", "repair", "spellbook", "family", "word", "epilogue"].map((category) => [category, stateRecords.filter((record) => record.category === category).length])),
      worldLocations: { regular: locations.filter((record) => record.locationKind === "regular").map((record) => record.locationId), cores: locations.filter((record) => record.locationKind === "core").map((record) => record.locationId) },
      stateRecords,
      snapshotCombinedSha256: sha256(snapshotHashes.map((record) => `${record.name}:${record.sha256}`).join("\n")),
      snapshotHashes,
      noUpdateRequirement: { consecutiveRounds: 2, commands: ["pnpm run test:visual:hanzi-complete", "pnpm run test:geometry:hanzi-complete"] },
      realChildValidation: "NOT_PERFORMED_AND_NOT_CLAIMED",
    };
    mkdirSync(checkpointRoot, { recursive: true });
    writeFileSync(resolve(checkpointRoot, "VISUAL_ARIA_GEOMETRY_VERDICT.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
  });
});

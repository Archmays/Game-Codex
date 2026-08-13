import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  CHAPTER_ONE_CHARACTER_IDS,
  HANZI_MAGIC_M4_SAVE_KEY,
  M3_SESSION_KEY,
  M5_BEHAVIORS,
  M5_BOSSES,
  createFreshM4Save,
  createM3GameState,
  currentM3Character,
  reduceM3State,
  simulateM3Run,
  updateM4Save,
  type ChapterCharacterStructure,
  type ChapterRegionId,
  type M3Action,
  type M3GameState,
  type M3HeroId,
  type M5AdventureMode,
} from "../../games/hanzi-radical-battle/v2/chapter-one";

const ARTIFACT_ROOT = resolve("artifacts/hanzi-radical-battle-v2/v2-chapter-one/report");
const BASELINE_ROOT = resolve(ARTIFACT_ROOT, "baselines/chapter-one");
const UPDATE = process.env.CHAPTER_ONE_UPDATE_BASELINES === "1";
const ROUND = process.env.CHAPTER_ONE_NO_UPDATE_ROUND ?? (UPDATE ? "baseline-update" : "unlabeled-no-update");
const PROOF_PATH = resolve(ARTIFACT_ROOT, `data/VISUAL-ARIA-${ROUND}.json`);
const GEOMETRY_PATH = resolve(ARTIFACT_ROOT, `data/CRITICAL-GEOMETRY-${ROUND}.json`);
const SOURCE_TREE_SHA256 = process.env.CHAPTER_ONE_SOURCE_TREE_SHA256 ?? "WORKTREE";

interface Fixture {
  readonly seed: string;
  readonly heroId: M3HeroId;
  readonly mode: M5AdventureMode;
  readonly actions: readonly M3Action[];
  readonly state: M3GameState;
}

interface BaselineIdentity { readonly id: string; readonly pngSha256: string; readonly ariaSha256: string; }
const identities: BaselineIdentity[] = [];

function sha256(value: Buffer | string): string { return createHash("sha256").update(value).digest("hex").toUpperCase(); }
function writeStable(path: string, value: Buffer | string): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }

function findFixture(
  id: string,
  predicate: (state: M3GameState) => boolean,
  heroId: M3HeroId = "light-speaker",
  mode: M5AdventureMode = "story",
): Fixture {
  for (let seedIndex = 0; seedIndex < 120; seedIndex += 1) {
    const seed = `m5-visual-${id}-${seedIndex}`;
    const simulation = simulateM3Run(seed, heroId, mode);
    let state = createM3GameState(seed, heroId, mode);
    const actions: M3Action[] = [];
    for (const action of simulation.actions) {
      state = reduceM3State(state, action);
      actions.push(action);
      if (predicate(state)) return { seed, heroId, mode, actions: [...actions], state };
    }
  }
  throw new Error(`No deterministic visual fixture found for ${id}`);
}

function structureFixture(regionId: ChapterRegionId, structure: ChapterCharacterStructure): Fixture {
  return findFixture(`${regionId}-${structure}`, (state) => state.phase === "encounter" && state.plan.regions[state.regionIndex].regionId === regionId && currentM3Character(state)?.structure === structure);
}

async function inject(page: Page, entries: readonly (readonly [string, string])[]): Promise<void> {
  await page.addInitScript((values) => { window.localStorage.clear(); for (const [key, value] of values) window.localStorage.setItem(key, value); }, entries);
}

async function openFixture(page: Page, fixture: Fixture): Promise<void> {
  const envelope = { schemaVersion: 3, seed: fixture.seed, initialHeroId: fixture.heroId, mode: fixture.mode, actions: fixture.actions };
  await inject(page, [[M3_SESSION_KEY, JSON.stringify(envelope)]]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?play=hanzi-v2-chapter-one&from=hub&seed=${fixture.seed}&adventure=${fixture.mode}`);
  await expect(page.getByTestId("hanzi-magic-chapter-one-m3")).toHaveAttribute("data-phase", fixture.state.phase);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
}

async function assertBaseline(page: Page, id: string, root = page.locator("body")): Promise<void> {
  const png = await page.screenshot({ animations: "disabled", caret: "hide", fullPage: true });
  const aria = await root.ariaSnapshot();
  const pngPath = resolve(BASELINE_ROOT, `${id}.png`);
  const ariaPath = resolve(BASELINE_ROOT, `${id}.aria.txt`);
  if (UPDATE) {
    writeStable(pngPath, png);
    writeStable(ariaPath, `${aria}\n`);
  } else {
    expect(existsSync(pngPath), `${id} PNG baseline must exist`).toBe(true);
    expect(existsSync(ariaPath), `${id} ARIA baseline must exist`).toBe(true);
    expect(png.equals(readFileSync(pngPath)), `${id} must have zero PNG byte drift`).toBe(true);
    expect(`${aria}\n`, `${id} must have zero ARIA drift`).toBe(readFileSync(ariaPath, "utf8"));
  }
  identities.push({ id, pngSha256: sha256(png), ariaSha256: sha256(`${aria}\n`) });
}

async function assertNoExternalErrors(page: Page): Promise<() => void> {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page:${error.message}`));
  page.on("request", (request) => { const url = new URL(request.url()); if (/^https?:/.test(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) errors.push(`external:${request.url()}`); });
  return () => expect(errors).toEqual([]);
}

test.describe.serial("Chapter One exact visual and ARIA baselines", () => {
  test.afterAll(() => {
    const baselines = [...identities].sort((left, right) => left.id.localeCompare(right.id));
    writeStable(PROOF_PATH, `${JSON.stringify({ schemaVersion: 1, sourceTreeSha256: SOURCE_TREE_SHA256, round: ROUND, mode: UPDATE ? "BASELINE_UPDATE" : "NO_UPDATE", exactPngByteComparison: true, exactAriaComparison: true, baselineCount: baselines.length, baselines, verdict: "PASS" }, null, 2)}\n`);
  });

  test("hub child-facing card @visual", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page);
    await page.goto("/?hub=classic"); await expect(page.locator(".game-card--ink-forest")).toBeVisible(); await page.waitForLoadState("networkidle");
    await assertBaseline(page, "hub-desktop"); done();
  });

  test("restored camp and three heroes @visual", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); const done = await assertNoExternalErrors(page);
    const full = updateM4Save(createFreshM4Save(), { discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS, completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"] });
    await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(full)]]); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m5-visual-camp");
    await expect(page.getByTestId("chapter-one-m3-camp")).toHaveAttribute("data-repair-count", "8"); await page.waitForLoadState("networkidle");
    await assertBaseline(page, "camp-restored-desktop", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  test("fresh camp before eight repairs @visual", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); const done = await assertNoExternalErrors(page);
    await inject(page, []); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m5-visual-fresh-camp");
    await expect(page.getByTestId("chapter-one-m3-camp")).toHaveAttribute("data-repair-count", "0"); await page.waitForLoadState("networkidle");
    await assertBaseline(page, "camp-fresh-mobile", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  for (const target of [
    { id: "glimmer-left-right", region: "glimmer-grove", structure: "left-right", viewport: { width: 1280, height: 720 } },
    { id: "echo-top-bottom", region: "echo-garden", structure: "top-bottom", viewport: { width: 820, height: 1180 } },
    { id: "wind-full-enclosure", region: "wind-trail", structure: "full-enclosure", viewport: { width: 390, height: 844 } },
    { id: "wind-semi-enclosure", region: "wind-trail", structure: "semi-enclosure", viewport: { width: 360, height: 800 } },
  ] as const) {
    test(`${target.id} structure board @visual`, async ({ page }) => {
      await page.setViewportSize(target.viewport); const done = await assertNoExternalErrors(page); const fixture = structureFixture(target.region, target.structure);
      await openFixture(page, fixture); await expect(page.getByTestId("chapter-one-m3-encounter")).toHaveAttribute("data-structure", target.structure);
      await assertBaseline(page, target.id, page.getByTestId("hanzi-magic-chapter-one-m3")); done();
    });
  }

  for (const regionIndex of [0, 1, 2] as const) {
    test(`build choice ${regionIndex + 1} @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture(`ability-choice-${regionIndex + 1}`, (state) => state.phase === "ability-choice" && state.regionIndex === regionIndex);
      await openFixture(page, fixture); await assertBaseline(page, `ability-choice-${regionIndex + 1}`, page.getByTestId("hanzi-magic-chapter-one-m3")); done();
    });
  }

  for (const behavior of M5_BEHAVIORS) {
    test(`${behavior.id} normal behavior @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture(`behavior-${behavior.id}`, (state) => state.phase === "behavior-telegraph" && state.currentEncounter?.behaviorId === behavior.id && !state.currentEncounter.bossId);
      await openFixture(page, fixture); await assertBaseline(page, `behavior-${behavior.id}`, page.getByTestId("hanzi-magic-chapter-one-m3")); done();
    });
  }

  for (const boss of M5_BOSSES.filter((entry) => entry.id !== "ink-king-core")) {
    test(`${boss.id} region boss portrait boundary @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture(`boss-${boss.id}`, (state) => state.phase === "behavior-telegraph" && state.currentEncounter?.bossId === boss.id);
      await openFixture(page, fixture); await assertBaseline(page, `boss-${boss.id}`, page.getByTestId("hanzi-magic-chapter-one-m3")); done();
    });
  }

  test("Ink King core introduction @visual", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture("ink-king-intro", (state) => state.phase === "final-intro");
    await openFixture(page, fixture); await assertBaseline(page, "ink-king-core-introduction", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  for (const phase of [1, 2, 3] as const) {
    test(`Ink King phase ${phase} @visual`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture(`ink-king-${phase}`, (state) => state.phase === "behavior-telegraph" && state.currentEncounter?.bossId === "ink-king-core" && state.currentEncounter.bossPhase === phase);
      await openFixture(page, fixture); await assertBaseline(page, `ink-king-phase-${phase}`, page.getByTestId("hanzi-magic-chapter-one-m3")); done();
    });
  }

  test("chapter ending controls @visual", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture("ending", (state) => state.phase === "ending");
    await openFixture(page, fixture); await assertBaseline(page, "chapter-ending", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  test("36-character spellbook @visual", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 }); const done = await assertNoExternalErrors(page);
    const full = updateM4Save(createFreshM4Save(), { discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS, completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"] });
    await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(full)]]); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&seed=m5-visual-spellbook&mode=spellbook");
    await expect(page.getByTestId("chapter-one-spellbook")).toHaveAttribute("data-total-entries", "36"); await page.waitForLoadState("networkidle");
    await assertBaseline(page, "spellbook-tablet", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  test("free-adventure summary @visual", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); const done = await assertNoExternalErrors(page); const fixture = findFixture("free-summary", (state) => state.phase === "run-summary", "ink-companion", "free");
    await openFixture(page, fixture); await assertBaseline(page, "free-adventure-summary", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });

  test("corrupt-save recovery notice @visual", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); const done = await assertNoExternalErrors(page);
    await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, "{broken"]]); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&fresh=1&seed=m5-visual-recovery");
    await expect(page.locator(".hm2-save-note")).toContainText("安全恢复"); await page.waitForLoadState("networkidle");
    await assertBaseline(page, "save-recovery-mobile", page.getByTestId("hanzi-magic-chapter-one-m3")); done();
  });
});

test("critical geometry, hit tests, modal scroll, and accessible names @hard-gates", async ({ page }) => {
  const rows: unknown[] = [];
  const viewports = [
    { id: "compact", width: 360, height: 800 },
    { id: "mobile", width: 390, height: 844 },
    { id: "tablet", width: 820, height: 1180 },
    { id: "desktop", width: 1280, height: 720 },
    { id: "wide", width: 1440, height: 900 },
  ] as const;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); const done = await assertNoExternalErrors(page); const fixture = structureFixture("wind-trail", viewport.id === "compact" || viewport.id === "mobile" ? "semi-enclosure" : "full-enclosure");
    await openFixture(page, fixture);
    const groups = [page.locator(".hm2-slot:not([disabled])"), page.locator(".hm2-card:not([disabled])")];
    const groupRows: unknown[] = [];
    for (const group of groups) {
      const boxes: { id: string; x: number; y: number; width: number; height: number; name: string }[] = [];
      for (let index = 0; index < await group.count(); index += 1) {
        const item = group.nth(index); await item.scrollIntoViewIfNeeded(); const box = await item.boundingBox(); const name = await item.getAttribute("aria-label") ?? (await item.innerText()).trim();
        expect(box).not.toBeNull(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); expect(name.length).toBeGreaterThan(0);
        const hit = await item.evaluate((element) => { const rect = element.getBoundingClientRect(); const points = [[.25, .25], [.5, .5], [.75, .75]].map(([x, y]) => [rect.left + rect.width * x, rect.top + rect.height * y]); return points.map(([x, y]) => { const target = document.elementFromPoint(x, y); return Boolean(target && (target === element || element.contains(target))); }); });
        expect(hit).toEqual([true, true, true]); boxes.push({ id: await item.getAttribute("data-card-id") ?? await item.getAttribute("data-slot-id") ?? `${index}`, x: box!.x, y: box!.y, width: box!.width, height: box!.height, name });
      }
      for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
        const a = boxes[left]; const b = boxes[right]; const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlaps, `${viewport.id} ${a.id}/${b.id} overlap`).toBe(false);
      }
      groupRows.push(boxes);
    }
    const pageWidth = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth + 1); done(); rows.push({ viewport, groups: groupRows, pageWidth, verdict: "PASS" });
  }

  await page.setViewportSize({ width: 360, height: 800 });
  const full = updateM4Save(createFreshM4Save(), { discoveredCharacterIds: CHAPTER_ONE_CHARACTER_IDS, completedRegionIds: ["glimmer-grove", "echo-garden", "wind-trail"] });
  await inject(page, [[HANZI_MAGIC_M4_SAVE_KEY, JSON.stringify(full)]]); await page.goto("/?play=hanzi-v2-chapter-one&from=hub&seed=m5-geometry-book&mode=spellbook");
  await expect(page.getByTestId("chapter-one-spellbook")).toBeVisible(); const shell = page.getByTestId("hanzi-magic-chapter-one-m3");
  await shell.evaluate((element) => { element.tabIndex = -1; element.focus(); }); await page.keyboard.press("End");
  await expect.poll(() => shell.evaluate((element) => Math.max(0, element.scrollHeight - element.clientHeight) - element.scrollTop), { timeout: 8_000 }).toBeLessThanOrEqual(2);
  const bottom = await shell.evaluate((element) => ({ y: element.scrollTop, bottom: Math.max(0, element.scrollHeight - element.clientHeight) })); expect(bottom.y).toBeGreaterThanOrEqual(bottom.bottom - 2);
  writeStable(GEOMETRY_PATH, `${JSON.stringify({ schemaVersion: 1, sourceTreeSha256: SOURCE_TREE_SHA256, round: ROUND, viewports: rows, modalBottom: bottom, multiPointHitTesting: true, minimumTargetCssPixels: 44, verdict: "PASS" }, null, 2)}\n`);
});

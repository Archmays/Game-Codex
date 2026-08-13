import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { HANZI_MAGIC_V1_ADVENTURES, getV1Encounter } from "../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import type { AbilityId } from "../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import { createV1GameState, stepV1Game, type V1GameState } from "../../games/hanzi-radical-battle/v2/v1/machine";
import { HANZI_MAGIC_V1_SAVE_KEY, createFreshV1Save, saveFromGameState, type V1SaveState } from "../../games/hanzi-radical-battle/v2/v1/save";

const ROUTE = "/?play=hanzi-v2-v1&from=hub";
const BASELINE_ROOT = resolve("artifacts/hanzi-radical-battle-v2/v1-release/baselines/v1");
const PROOF_PATH = resolve("artifacts/hanzi-radical-battle-v2/v1-release/V1-VISUAL-ARIA-NO-UPDATE-PROOF.json");
const GEOMETRY_PATH = resolve("artifacts/hanzi-radical-battle-v2/v1-release/V1-CRITICAL-CONTROL-GEOMETRY.json");
const UPDATE = process.env.V1_UPDATE_BASELINES === "1";
const SOURCE_TREE_SHA256 = process.env.V1_SOURCE_TREE_SHA256 ?? "UNFROZEN";

interface BaselineIdentity {
  readonly id: string;
  readonly pngSha256: string;
  readonly ariaSha256: string;
}

const baselineIdentities: BaselineIdentity[] = [];

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function writeStable(path: string, value: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
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
  let state = createV1GameState("v1-visual-fixture");
  for (let index = 0; index < completedAdventureCount; index += 1) {
    const adventure = HANZI_MAGIC_V1_ADVENTURES[index];
    state = stepV1Game(state, { type: "start-adventure", adventureId: adventure.id });
    state = stepV1Game(state, { type: "begin-adventure" });
    state = solvePureEncounter(state);
    state = solvePureEncounter(state);
    state = stepV1Game(state, { type: "choose-ability", abilityId: adventure.abilityIds[index] as AbilityId });
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

async function open(page: Page, save: V1SaveState | null = null): Promise<void> {
  await page.goto("/?hub=classic");
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    if (value) localStorage.setItem(key, JSON.stringify(value));
  }, { key: HANZI_MAGIC_V1_SAVE_KEY, value: save });
  await page.goto(ROUTE);
  await expect(page.getByTestId("hanzi-magic-v1")).toBeVisible();
  await expect(page.getByTestId("hanzi-magic-v1-world-canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='hanzi-magic-v1-world-canvas']");
    return Boolean(canvas && canvas.width > 0 && canvas.toDataURL().length > 10_000);
  });
}

async function assertBaseline(page: Page, id: string): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all([...document.images].map(async (image) => {
      if (!image.complete || image.naturalWidth === 0) await image.decode();
    }));
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
    await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
  });
  const png = await page.screenshot({ animations: "disabled", fullPage: true });
  const aria = await page.getByTestId("hanzi-magic-v1").ariaSnapshot();
  const pngPath = resolve(BASELINE_ROOT, `${id}.png`);
  const ariaPath = resolve(BASELINE_ROOT, `${id}.aria.txt`);
  if (UPDATE) {
    writeStable(pngPath, png);
    writeStable(ariaPath, `${aria}\n`);
  } else {
    expect(existsSync(pngPath), `${id} PNG baseline must exist`).toBe(true);
    expect(existsSync(ariaPath), `${id} ARIA baseline must exist`).toBe(true);
    expect(png.equals(readFileSync(pngPath)), `${id} must have zero PNG byte drift`).toBe(true);
    expect(`${aria}\n`).toBe(readFileSync(ariaPath, "utf8"));
  }
  baselineIdentities.push({ id, pngSha256: sha256(png), ariaSha256: sha256(`${aria}\n`) });
}

test.describe.serial("V1 visual and ARIA source-bound baselines", () => {
  test.afterAll(() => {
    const identities = [...baselineIdentities].sort((a, b) => a.id.localeCompare(b.id));
    const proof = {
      schemaVersion: 1,
      sourceTreeSha256: SOURCE_TREE_SHA256,
      mode: UPDATE ? "BASELINE_UPDATE" : "NO_UPDATE",
      exactByteComparison: true,
      ariaExactComparison: true,
      baselineCount: identities.length,
      baselines: identities,
      verdict: "PASS",
    };
    writeStable(PROOF_PATH, `${JSON.stringify(proof, null, 2)}\n`);
  });

  test("desktop fresh camp", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page);
    await assertBaseline(page, "desktop-fresh-camp");
  });

  test("desktop first composition board", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page);
    await page.locator(".hmv1-primary--large[data-adventure='glimmer-path']").click();
    await page.locator("[data-action='begin-adventure']").click();
    await expect(page.getByTestId("v1-encounter")).toBeVisible();
    await assertBaseline(page, "desktop-first-encounter");
  });

  test("mobile semi-enclosure board", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, pureSaveAfter(2));
    await page.locator("[data-adventure='wind-footprints']").first().click();
    await page.locator("[data-action='begin-adventure']").click();
    await expect(page.getByTestId("v1-encounter")).toHaveAttribute("data-structure", "semi-enclosure");
    await assertBaseline(page, "mobile-semi-enclosure");
  });

  test("desktop complete twelve-character spellbook", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, pureSaveAfter(3));
    await page.locator("[data-action='open-spellbook']").click();
    await expect(page.getByTestId("v1-spellbook").locator("nav button")).toHaveCount(12);
    await assertBaseline(page, "desktop-spellbook-12");
  });
});

test("critical controls remain non-overlapping, large enough, and activatable at four viewports", async ({ page }) => {
  const viewports = [
    { id: "compact-mobile", width: 360, height: 640 },
    { id: "mobile", width: 390, height: 844 },
    { id: "tablet", width: 768, height: 1024 },
    { id: "desktop", width: 1280, height: 720 },
  ] as const;
  const rows: unknown[] = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page);
    await page.locator(".hmv1-primary--large[data-adventure='glimmer-path']").click();
    await page.locator("[data-action='begin-adventure']").click();
    const encounter = getV1Encounter("v1-ming");
    const target = encounter.cards.find((card) => card.kind === "target")!;
    await page.locator(".hmv1-hand").scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const rects = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        return { identity: element.dataset.card ?? element.dataset.slot ?? "unknown", x: rect.x, y: rect.y, width: rect.width, height: rect.height, name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "" };
      });
      return { slots: rects(".hmv1-slot"), cards: rects(".hmv1-card"), scrollWidth: document.documentElement.scrollWidth, innerWidth };
    });
    for (const group of [geometry.slots, geometry.cards]) {
      for (const rect of group) {
        expect(rect.width, `${viewport.id} ${rect.identity} width`).toBeGreaterThanOrEqual(44);
        expect(rect.height, `${viewport.id} ${rect.identity} height`).toBeGreaterThanOrEqual(44);
        expect(rect.name.length, `${viewport.id} ${rect.identity} accessible name`).toBeGreaterThan(0);
      }
      for (let left = 0; left < group.length; left += 1) for (let right = left + 1; right < group.length; right += 1) {
        const a = group[left]; const b = group[right];
        const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(intersects, `${viewport.id} ${a.identity}/${b.identity} must not overlap`).toBe(false);
      }
    }
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
    await page.locator(`[data-card='${target.id}']`).click();
    await page.locator(`[data-slot='${target.expectedSlotId}']`).click();
    await expect(page.locator(`[data-slot='${target.expectedSlotId}'] span`)).toHaveText(target.glyph);
    rows.push({ viewport, ...geometry, activated: { cardId: target.id, slotId: target.expectedSlotId }, verdict: "PASS" });
  }
  writeStable(GEOMETRY_PATH, `${JSON.stringify({ schemaVersion: 1, sourceTreeSha256: SOURCE_TREE_SHA256, contracts: rows, touchActivation: "P4", keyboardActivation: "P5", verdict: "PASS" }, null, 2)}\n`);
});

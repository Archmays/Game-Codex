import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MACHINE_REVIEW_MANIFEST } from "../../tools/game-machine-review/machine-review-manifest";
import { computeMachineReviewSourceTreeSha256 } from "../../tools/game-machine-review/source-identity";

type SmokeStatus = "PASS" | "FAIL";

interface CatalogSmokeResult {
  readonly project: string;
  readonly catalogGameId: string;
  readonly title: string;
  readonly isolatedBrowserContext: true;
  readonly firstAction: string;
  readonly postconditionEvidence: string;
  readonly status: SmokeStatus;
  readonly screenshot: string;
  readonly trace: string;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly sameOriginRequests: readonly string[];
  readonly externalRequests: readonly string[];
  readonly returnedToCatalog: boolean;
  readonly detail: string;
}

interface FirstActionResult {
  readonly action: string;
  readonly postconditionEvidence: string;
}

const ARTIFACT_ROOT = resolve("artifacts/game-machine-review/step-07");
const SCREENSHOT_ROOT = resolve(ARTIFACT_ROOT, "screenshots/catalog-smoke");
const TRACE_ROOT = resolve(ARTIFACT_ROOT, "traces/catalog-smoke");
const RESULT_PATH = resolve(ARTIFACT_ROOT, "GAME-CATALOG-MACHINE-SMOKE.json");

function relativeArtifact(path: string): string {
  return path.replace(`${process.cwd()}\\`, "").replaceAll("\\", "/");
}

function readExistingResults(sourceTreeSha256: string): CatalogSmokeResult[] {
  try {
    const value = JSON.parse(readFileSync(RESULT_PATH, "utf8")) as { sourceTreeSha256?: string; results?: CatalogSmokeResult[] };
    if (value.sourceTreeSha256 !== sourceTreeSha256) return [];
    return Array.isArray(value.results) ? value.results : [];
  } catch {
    return [];
  }
}

function writeResults(results: readonly CatalogSmokeResult[]): void {
  const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
  const sorted = [...results].sort((a, b) => `${a.project}:${a.catalogGameId}`.localeCompare(`${b.project}:${b.catalogGameId}`));
  const expectedResultCount = MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length * 2;
  const passed = sorted.filter((entry) => entry.status === "PASS").length;
  const failed = sorted.filter((entry) => entry.status === "FAIL").length;
  writeFileSync(RESULT_PATH, `${JSON.stringify({
    schemaVersion: 1,
    sourceTreeSha256,
    status: sorted.length === expectedResultCount && failed === 0 ? "PASS" : "FAIL",
    inventorySource: "packages/data/gameCatalog.ts via machine-review-manifest",
    policy: "SAME_ORIGIN_ALLOWED / EXTERNAL_NETWORK_FORBIDDEN",
    isolatedContexts: true,
    expectedCatalogGameIds: MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.map((entry) => entry.catalogGameId),
    expectedProjects: ["desktop-chromium", "mobile-touch-chromium"],
    expectedResultCount,
    resultCount: sorted.length,
    passed,
    failed,
    evidenceFiles: sorted.flatMap((entry) => [entry.screenshot, entry.trace]),
    results: sorted,
  }, null, 2)}\n`, "utf8");
}

async function clickFirstGameAction(page: Page, gameId: string, touch: boolean): Promise<FirstActionResult> {
  const clickButton = async (name: string | RegExp): Promise<void> => {
    const button = page.getByRole("button", { name }).first();
    await expect(button).toBeVisible();
    if (touch) await button.tap();
    else await button.click();
  };

  switch (gameId) {
    case "memory-card": {
      const card = page.locator(".memory-card-tile:not([disabled])").first();
      await expect(card).toBeVisible();
      if (touch) await card.tap(); else await card.click();
      await expect(page.locator(".memory-card-tile--flipped")).toHaveCount(1);
      return {
        action: "flip first memory card",
        postconditionEvidence: "exactly one memory tile entered the flipped state",
      };
    }
    case "math-lab": {
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 15_000 });
      const before = await canvas.screenshot();
      const box = await canvas.boundingBox();
      if (!box) throw new Error("Math Lab canvas has no visible bounding box");
      const compact = box.width < 560;
      const columns = compact ? 1 : 2;
      const rows = Math.ceil(5 / columns);
      const gap = compact ? 8 : 12;
      const top = compact ? 164 : 176;
      const bottom = compact ? 60 : 66;
      const cardWidth = compact ? Math.min(box.width - 28, 420) : Math.min((box.width - 52) / 2, 430);
      const availableHeight = Math.max(230, box.height - top - bottom);
      const cardHeight = Math.min(compact ? 58 : 78, Math.max(compact ? 50 : 68, (availableHeight - (rows - 1) * gap) / rows));
      const gridWidth = columns * cardWidth + (columns - 1) * gap;
      const firstCardCenterX = box.width / 2 - gridWidth / 2 + cardWidth / 2;
      const x = box.x + firstCardCenterX + cardWidth / 2 - (compact ? 42 : 56);
      const y = box.y + top + cardHeight / 2 + (compact ? 12 : 16);
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      await expect.poll(async () => (await canvas.screenshot()).equals(before), { timeout: 8_000 }).toBe(false);
      return {
        action: "canvas MenuScene start gesture",
        postconditionEvidence: "canvas pixels changed after the MenuScene start gesture",
      };
    }
    case "hanzi-wheel":
      await clickButton("开始旋转");
      await expect(page.locator(".hanzi-wheel-result")).toBeVisible({ timeout: 6_000 });
      return {
        action: "start wheel spin",
        postconditionEvidence: "wheel result panel appeared after the spin completed",
      };
    case "hanzi-radical-battle": {
      const start = page.getByRole("button", { name: /开始冒险/ }).first();
      await expect(start).toBeVisible();
      if (touch) {
        const box = await start.boundingBox();
        if (!box) throw new Error("Hanzi start button has no bounding box");
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await start.focus();
        await page.keyboard.press("Enter");
      }
      const hero = page.locator(".hanzi-radical-hero-card").first();
      await expect(hero).toBeVisible();
      if (touch) {
        const box = await hero.boundingBox();
        if (!box) throw new Error("Hanzi hero card has no bounding box");
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await hero.focus();
        await page.keyboard.press("Enter");
      }
      await expect(page.locator(".hanzi-radical-game-shell")).toBeVisible();
      return {
        action: "start adventure and select first hero",
        postconditionEvidence: "battle game shell appeared after hero selection",
      };
    }
    case "multiplication-adventure":
      await clickButton("看卡片学习");
      await expect(page.locator(".multiplication-card")).toHaveCount(9);
      return {
        action: "open multiplication study cards",
        postconditionEvidence: "nine multiplication study cards appeared",
      };
    case "english-spell-battle":
      await clickButton("Level 1 首字母");
      await expect(page.locator(".english-target")).toBeVisible();
      return {
        action: "start Level 1",
        postconditionEvidence: "Level 1 target and letter bank appeared",
      };
    case "clock-reader": {
      await clickButton("自由探索");
      const hourHand = page.locator(".clock-hand--hour");
      const before = await hourHand.getAttribute("style");
      await clickButton("时针 +");
      await expect.poll(() => hourHand.getAttribute("style")).not.toBe(before);
      return {
        action: "select free exploration and advance the hour hand",
        postconditionEvidence: "hour-hand angle changed after the exploration control",
      };
    }
    case "make-target": {
      const card = page.locator(".make-target-card:not([disabled])").first();
      await expect(card).toBeVisible();
      if (touch) await card.tap(); else await card.click();
      await expect(page.locator(".make-target-card.is-selected")).toHaveCount(1);
      return {
        action: "select first target card",
        postconditionEvidence: "one target card entered the selected state",
      };
    }
    case "equation-slider": {
      const control = page.locator(".equation-slider__reel-control:not([disabled])").first();
      await expect(control).toBeVisible();
      if (touch) await control.tap(); else await control.click();
      await expect(page.locator(".equation-slider__move-count")).toHaveText("1");
      return {
        action: "move first enabled equation reel",
        postconditionEvidence: "equation slider move count advanced from 0 to 1",
      };
    }
    case "pinyin-magic-battle":
      await clickButton("勇者试炼");
      await expect(page.locator(".pinyin-option-grid--battle")).toBeVisible();
      return {
        action: "start pinyin trial",
        postconditionEvidence: "battle prompt and pinyin option grid appeared",
      };
    default:
      throw new Error(`No first-action adapter for catalog game ${gameId}`);
  }
}

test.describe("STEP 07 full gameCatalog smoke matrix", () => {
  for (const game of MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes) {
    test(`${game.catalogIndex + 1}. ${game.catalogGameId} enters, acts, and returns`, async ({ page, context }, testInfo) => {
      test.setTimeout(45_000);
      mkdirSync(SCREENSHOT_ROOT, { recursive: true });
      mkdirSync(TRACE_ROOT, { recursive: true });
      const isMobile = testInfo.project.name === "mobile-touch-chromium";
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      const sameOriginRequests = new Set<string>();
      const externalRequests = new Set<string>();
      let firstAction = "NOT_RUN";
      let postconditionEvidence = "NOT_PROVEN";
      let returnedToCatalog = false;
      let status: SmokeStatus = "PASS";
      let detail = "catalog entry opened and returned";
      const screenshotPath = resolve(SCREENSHOT_ROOT, `${testInfo.project.name}-${game.catalogIndex + 1}-${game.catalogGameId}.png`);
      const tracePath = resolve(TRACE_ROOT, `${testInfo.project.name}-${game.catalogIndex + 1}-${game.catalogGameId}.zip`);

      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
      page.on("request", (request) => {
        const url = request.url();
        if (!/^(?:https?|wss?):/i.test(url)) return;
        const parsed = new URL(url);
        if (["http:", "ws:"].includes(parsed.protocol) && parsed.hostname === "127.0.0.1" && parsed.port === "5175") sameOriginRequests.add(url);
        else externalRequests.add(url);
      });

      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      try {
        await page.goto("/?hub=classic", { waitUntil: "domcontentloaded" });
        await expect(page.locator(".game-card")).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.locator("main main")).toHaveCount(0);
        const worldNavigation = page.getByRole("navigation", { name: "游戏百宝箱导航" });
        await expect(worldNavigation).toBeVisible();
        await expect(worldNavigation.getByRole("link", { name: "← 回我的游戏世界", exact: true })).toBeVisible();
        const card = page.locator(".game-card").filter({ has: page.getByRole("heading", { name: game.title, exact: true }) });
        await expect(card).toHaveCount(1);
        const playButton = card.getByRole("button", { name: game.playLabel, exact: true });
        if (isMobile) await playButton.tap(); else await playButton.click();
        await expect(page.locator(".game-topbar")).toContainText(game.title);
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.locator("main main")).toHaveCount(0);
        const firstActionResult = await clickFirstGameAction(page, game.catalogGameId, isMobile);
        firstAction = firstActionResult.action;
        postconditionEvidence = firstActionResult.postconditionEvidence;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const back = page.locator(".game-topbar").getByRole("button", { name: "返回大厅", exact: true });
        if (isMobile) await back.tap(); else await back.click();
        await expect(page.locator(".game-card")).toHaveCount(MACHINE_REVIEW_MANIFEST.catalogSmokeRoutes.length);
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.locator("main main")).toHaveCount(0);
        await expect(worldNavigation).toBeVisible();
        returnedToCatalog = true;
        if (consoleErrors.length > 0 || pageErrors.length > 0 || failedRequests.length > 0 || externalRequests.size > 0) {
          throw new Error(`console=${consoleErrors.length}, page=${pageErrors.length}, failedRequests=${failedRequests.length}, external=${externalRequests.size}`);
        }
      } catch (error) {
        status = "FAIL";
        detail = error instanceof Error ? error.message : String(error);
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      } finally {
        try {
          await context.tracing.stop({ path: tracePath });
        } catch (error) {
          status = "FAIL";
          detail = `${detail}; trace=${error instanceof Error ? error.message : String(error)}`;
        }
      }

      const result: CatalogSmokeResult = {
        project: testInfo.project.name,
        catalogGameId: game.catalogGameId,
        title: game.title,
        isolatedBrowserContext: true,
        firstAction,
        postconditionEvidence,
        status,
        screenshot: relativeArtifact(screenshotPath),
        trace: relativeArtifact(tracePath),
        consoleErrors,
        pageErrors,
        failedRequests,
        sameOriginRequests: [...sameOriginRequests],
        externalRequests: [...externalRequests],
        returnedToCatalog,
        detail,
      };
      const sourceTreeSha256 = computeMachineReviewSourceTreeSha256();
      const existing = readExistingResults(sourceTreeSha256).filter(
        (entry) => !(entry.project === testInfo.project.name && entry.catalogGameId === game.catalogGameId),
      );
      writeResults([...existing, result]);
      expect(result.status, JSON.stringify(result, null, 2)).toBe("PASS");
    });
  }
});

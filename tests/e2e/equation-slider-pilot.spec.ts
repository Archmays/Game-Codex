import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInitialBoardSession, transitionBoardSession, type BoardSession } from "../../games/equation-slider/board-state";
import { findHintContinuation, getMovableReels, evaluateArrangementOutcome } from "../../games/equation-slider/solver";
import { EQUATION_SLIDER_CONTENT_REVISIONS } from "../../games/equation-slider/content-revisions";
import { parsePublishedChapter } from "../../games/equation-slider/schema";
import type { MoveDirection, PublishedEquationSliderLevel } from "../../games/equation-slider/types";

// This is engineering verification: solver decisions are explicit and kept
// separate from the independent UI-only reviewer, who sees none of this data.
const levels = ["chapter-1-addition", "chapter-2-add-sub", "chapter-3-mul-div", "chapter-4-reasoning"].flatMap((chapter, index) =>
  parsePublishedChapter(JSON.parse(readFileSync(resolve(`games/equation-slider/levels/${chapter}.json`), "utf8")), `chapter-${index + 1}`)
);
const key = "family-games/equation-slider/progress-v3";
const board = "[data-equation-board]";
const expression = ".equation-slider__current-expression";
const coverage = "[data-coverage-progress]";
const feedback = ".equation-slider__feedback";
type Method = "button" | "tile" | "keyboard" | "mouse" | "touch";

async function enter(page: Page): Promise<void> {
  await page.goto("/?world=math-world&station=slider");
  await expect(page.locator(board)).toBeVisible();
}

async function select(page: Page, id: string): Promise<PublishedEquationSliderLevel> {
  const level = levels.find((candidate) => candidate.id === id)!;
  if (await page.locator(`${board}[data-level-id='${id}']`).isVisible()) return level;
  await page.getByRole("button", { name: "关卡列表", exact: true }).click();
  if (!(await page.locator(`button[data-level-id='${id}']`).isVisible())) {
    await page.getByRole("button", { name: "线路地图", exact: true }).click();
    await page.locator(`[data-chapter-id='${level.chapterId}']`).click();
  }
  await page.locator(`button[data-level-id='${id}']`).click();
  await expect(page.locator(`${board}[data-level-id='${id}']`)).toBeVisible();
  return level;
}

async function touchGesture(page: Page, context: BrowserContext, reelIndex: number, direction: MoveDirection, cancel = false): Promise<void> {
  const box = await page.locator("[data-reel-window]").nth(reelIndex).boundingBox();
  if (!box) throw new Error("Missing reel target");
  const client = await context.newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const delta = direction === "up" ? 54 : -54;
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 4; step += 1) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + delta * step / 4, id: 1 }] });
    }
    await client.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
  } finally {
    await client.detach();
  }
}

async function input(page: Page, context: BrowserContext, reelIndex: number, direction: MoveDirection, method: Method): Promise<void> {
  const reel = page.locator("[data-reel-id]").nth(reelIndex);
  if (method === "button") {
    await reel.locator(`[data-control-direction='${direction}']`).click();
  } else if (method === "tile") {
    const tile = reel.locator(`[data-position='${direction === "up" ? "previous" : "next"}']`);
    await tile.click();
  } else if (method === "keyboard") {
    await reel.locator("[data-reel-window]").focus();
    await page.keyboard.press(direction === "up" ? "ArrowUp" : "ArrowDown");
  } else if (method === "touch") {
    await touchGesture(page, context, reelIndex, direction);
  } else {
    const box = await reel.locator("[data-reel-window]").boundingBox();
    if (!box) throw new Error("Missing mouse target");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + (direction === "up" ? 54 : -54), { steps: 4 });
    await page.mouse.up();
  }
}

async function checkGeometry(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const targets = [...document.querySelectorAll<HTMLElement>("[data-control-direction], [data-primary-actions] button")];
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      targets: targets.map((node) => {
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { width: r.width, height: r.height, top: Boolean(hit && (node === hit || node.contains(hit))) };
      }),
      expressionClipped: (() => {
        const node = document.querySelector<HTMLElement>(".equation-slider__current-expression")!;
        return node.scrollWidth > node.clientWidth;
      })()
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.expressionClipped).toBe(false);
  for (const target of result.targets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.top).toBe(true);
  }
}

async function complete(page: Page, context: BrowserContext, level: PublishedEquationSliderLevel, methods: readonly Method[], info: TestInfo): Promise<void> {
  let session: BoardSession = createInitialBoardSession(level);
  const trace: unknown[] = [{ initial: await page.locator(expression).innerText(), coverage: await page.locator(coverage).innerText() }];
  const ids = await page.locator("[data-tile-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-tile-id")));
  const originalBox = await page.locator(board).boundingBox();
  expect(new Set(ids).size).toBe(getMovableReels(level).length * 3);
  for (let action = 0; session.present.status !== "complete" && action < 48; action += 1) {
    const next = findHintContinuation(level, session.present.indexes, session.present.coveredTileIds, session.present.completedTargetIds);
    expect(next?.reelIndex, level.id).toBeDefined();
    expect(next?.direction, level.id).toBeDefined();
    if (level.id === "es-1-12" && action > 0 && next!.remainingMoves > 1) {
      for (let depth = 0; depth < 3; depth += 1) await page.getByRole("button", { name: "提示", exact: true }).click();
      await expect(page.locator(".equation-slider__hint")).toContainText("这一步先准备");
      trace.push({ preparatoryHint: await page.locator(".equation-slider__hint").innerText() });
    }
    const method = methods[action % methods.length];
    const transitioned = transitionBoardSession(level, session, {
      type: "commit-move", reelId: next!.reelId!, direction: next!.direction!, useFeedbackLock: false
    });
    expect(transitioned.committed, level.id).toBe(true);
    await input(page, context, next!.reelIndex!, next!.direction!, method);
    session = transitioned.session;
    await expect(page.locator("[data-move-count]")).toHaveText(String(session.present.moveCount));
    await expect(page.locator(coverage)).toHaveText(`${session.present.coveredTileIds.size}/${level.requiredTileIds.length}`);
    await expect(page.locator(board)).toHaveAttribute("data-board-status", session.present.status);
    const expected = evaluateArrangementOutcome(level, session.present.indexes);
    if (level.mode !== "equality") await expect(page.locator(expression)).toHaveText(`${expected.expressionText} = ${expected.result}`);
    trace.push({ method, reel: next!.reelIndex! + 1, direction: next!.direction, expression: await page.locator(expression).innerText(), coverage: await page.locator(coverage).innerText(), feedback: await page.locator(feedback).innerText() });
  }
  await expect(page.locator("[data-completion-card]")).toBeVisible();
  expect(session.present.status).toBe("complete");
  expect(await page.locator("[data-tile-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-tile-id")))).toEqual(ids);
  const finalBox = await page.locator(board).boundingBox();
  expect(Math.abs(finalBox!.height - originalBox!.height)).toBeLessThanOrEqual(2);
  await info.attach(`${level.id}-actual-inputs`, { body: JSON.stringify(trace, null, 2), contentType: "application/json" });
}

for (const profile of [
  { name: "desktop", viewport: { width: 1440, height: 900 }, hasTouch: false, reducedMotion: "no-preference" as const, methods: ["button", "tile", "keyboard", "mouse"] as Method[] },
  { name: "narrow", viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" as const, methods: ["touch", "tile", "button", "keyboard"] as Method[] }
]) {
  test.describe(`pilot ${profile.name}`, () => {
    test.use({ viewport: profile.viewport, hasTouch: profile.hasTouch, isMobile: profile.hasTouch });
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: profile.reducedMotion }); });
    test("all twelve boards complete with real mixed input and retain last level on return/reload", async ({ page, context }, info) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      const external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url()); });
      await enter(page);
      for (let order = 1; order <= 12; order += 1) {
        const level = await select(page, `es-1-${String(order).padStart(2, "0")}`);
        await checkGeometry(page);
        if ([1, 7, 9, 12].includes(order)) await info.attach(`${profile.name}-${level.id}`, { body: await page.screenshot(), contentType: "image/png" });
        await complete(page, context, level, profile.methods, info);
      }
      await page.getByRole("button", { name: "下一关", exact: true }).click();
      await expect(page.locator(`${board}[data-level-id='es-1-13']`)).toBeVisible();
      await input(page, context, 0, "up", "button");
      await page.getByRole("button", { name: "撤销", exact: true }).click();
      await expect(page.locator("[data-move-count]")).toHaveText("0");
      await page.getByRole("button", { name: "关闭声音", exact: true }).click();
      await page.reload();
      await expect(page.locator(`${board}[data-level-id='es-1-13']`)).toBeVisible();
      await expect(page.getByRole("button", { name: "开启声音", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "← 回城市地图", exact: true }).click();
      await expect(page.getByTestId("math-world-map")).toBeVisible();
      await page.locator('[data-station-id="slider"] button').click();
      await expect(page.locator(`${board}[data-level-id='es-1-13']`)).toBeVisible();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
  });
}

test.describe("pilot behavior and saves", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

  test("tablet covers three-reel transfer plus representative later chapters", async ({ page, context }, info) => {
    test.setTimeout(120_000);
    await enter(page);
    for (const id of ["es-1-09", "es-1-12", "es-2-11", "es-3-11", "es-4-01"]) {
      const level = await select(page, id);
      await checkGeometry(page);
      await complete(page, context, level, ["touch", "button"], info);
    }
  });

  test("ordinary successes and repetitions never lock; undo, cancellation, and hints remain truthful", async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await enter(page);
    await page.getByRole("button", { name: "跳过教程", exact: true }).click();
    await input(page, context, 1, "up", "button");
    await expect(page.locator(coverage)).toHaveText("2/6");
    await expect(page.locator(feedback)).toHaveAttribute("data-feedback-kind", "success");
    await expect(page.locator(board)).toHaveAttribute("data-board-status", "ready");
    await input(page, context, 1, "down", "keyboard");
    await input(page, context, 1, "up", "keyboard");
    await expect(page.locator(feedback)).toHaveAttribute("data-feedback-kind", "repeat");
    await expect(page.locator(feedback)).toContainText("没有新增");
    await expect(page.locator(coverage)).toHaveText("2/6");
    await expect(page.locator(board)).toHaveAttribute("data-board-status", "ready");
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    const before = await page.locator(expression).innerText();
    await touchGesture(page, context, 0, "up", true);
    await expect(page.locator(expression)).toHaveText(before);
    await expect(page.locator(board)).toHaveAttribute("data-board-status", "ready");
    await page.getByRole("button", { name: "提示", exact: true }).click();
    await expect(page.locator(".is-hinted")).toHaveCount(0);
    await expect(page.locator(".equation-slider__hint")).not.toContainText(/第\s*\d|选[上下]方/);
    await page.getByRole("button", { name: "提示", exact: true }).click();
    await expect(page.locator(".is-hinted")).toHaveCount(1);
    await expect(page.locator(".equation-slider__hint")).not.toContainText(/选[上下]方/);
    await page.getByRole("button", { name: "提示", exact: true }).click();
    const text = await page.locator(".equation-slider__hint").innerText();
    const match = text.match(/第\s*(\d+)\s*条滑轨：选(上|下)方格/)!;
    expect(match).not.toBeNull();
    const moves = Number(await page.locator("[data-move-count]").innerText());
    await input(page, context, Number(match[1]) - 1, match[2] === "上" ? "up" : "down", "button");
    await expect(page.locator("[data-move-count]")).toHaveText(String(moves + 1));
    await expect(page.locator(".is-hinted")).toHaveCount(0);
    await page.getByRole("button", { name: "重置", exact: true }).click();
    await expect(page.locator(coverage)).toHaveText("0/6");

    // Legal alternative: cover every tile with target 6 before ever reaching 7.
    await select(page, "es-1-07");
    for (const [reel, direction] of [[0, "down"], [1, "up"], [0, "down"], [1, "up"], [0, "down"], [0, "up"], [0, "down"]] as const) {
      await input(page, context, reel, direction, "button");
    }
    await expect(page.locator(coverage)).toHaveText("6/6");
    await expect(page.locator(board)).toHaveAttribute("data-board-status", "ready");
    await expect(page.locator(feedback)).toHaveAttribute("data-feedback-kind", "repeat");
    await expect(page.locator(feedback)).toContainText("还有哪个目标没到过");
    await expect(page.locator(".equation-slider__goal-line")).toContainText("还没到过的目标");
    await page.getByRole("button", { name: "提示", exact: true }).click();
    await expect(page.locator(".equation-slider__hint")).toContainText("还有哪个目标没到过");
    await expect(page.locator(".is-hinted")).toHaveCount(0);
    await input(page, context, 1, "down", "button");
    await expect(page.locator(expression)).toHaveText("3 + 4 = 7");
    await expect(page.locator("[data-completion-card]")).toBeVisible();
  });

  test("tutorial stops pointing to the wrong pair after a different first move", async ({ page, context }) => {
    await enter(page);
    await input(page, context, 0, "up", "button");
    await expect(page.locator(expression)).toHaveText("2 + 5 = 7");
    await expect(page.locator("[data-tutorial-target]")).toHaveCount(0);
    await expect(page.locator(".equation-slider__coach")).toContainText("上方或下方的数字都可以试");
    await input(page, context, 1, "down", "tile");
    await expect(page.locator(expression)).toHaveText("2 + 4 = 6");
    await expect(page.locator("[data-tutorial-step='coverage']")).toBeVisible();
  });

  test("old completion and preferences remain while revised stats start separately", async ({ page, context }, info) => {
    const oldRecord = { startedCount: 8, completed: true, independent: true, hintCount: 13, badges: ["independent"], bestMoves: 1 };
    const later = { ...oldRecord, hintCount: 17 };
    const seed = { saveVersion: 2, tutorialCompleted: true, upgradeNoticeSeen: true, soundEnabled: false, lastLevelId: "es-1-13", levels: { "es-1-02": oldRecord, "es-1-11": oldRecord, "es-1-13": later }, seenCheckpoints: [] };
    await page.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key, seed });
    await enter(page);
    await expect(page.locator(`${board}[data-level-id='es-1-13']`)).toBeVisible();
    await expect(page.getByRole("button", { name: "开启声音", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关卡列表", exact: true }).click();
    await expect(page.locator("button[data-level-id='es-1-02']")).toContainText("旧版已玩");
    await page.locator("button[data-level-id='es-1-02']").click();
    await expect(page.locator(".equation-slider__revision-notice")).toContainText("旧版已完成的记录还在");
    const level = levels.find((candidate) => candidate.id === "es-1-02")!;
    await complete(page, context, level, ["button"], info);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.levels["es-1-02"].bestMoves).toBe(1);
    expect(saved.levels["es-1-02"].hintCount).toBe(13);
    expect(saved.levels["es-1-02"].revisions[EQUATION_SLIDER_CONTENT_REVISIONS["es-1-02"]]).toMatchObject({ completed: true, hintCount: 0, bestMoves: expect.any(Number) });
    expect(saved.levels["es-1-11"]).toEqual(oldRecord);
    expect(saved.levels["es-1-13"]).toEqual({ ...later, startedCount: 9 });
    expect(saved.tutorialCompleted).toBe(true);
    expect(saved.soundEnabled).toBe(false);
    await page.reload();
    await expect(page.locator(`${board}[data-level-id='es-1-02']`)).toBeVisible();
    await expect(page.locator(".equation-slider__revision-notice")).toHaveCount(0);
  });

  for (const raw of ["{broken", JSON.stringify({ saveVersion: 99, future: "keep" }), JSON.stringify({ saveVersion: 2, levels: {}, futureField: "keep" }), "null"]) {
    test(`protected raw save stays byte-identical: ${raw.slice(0, 24)}`, async ({ page, context }) => {
      const sentinels = { "family-games/clock-reader/progress": "  {\"old\":true}  ", "math-battle-web/save-v1": "legacy-raw", unrelated: " exact bytes " };
      await page.addInitScript(({ key, raw, sentinels }) => { localStorage.setItem(key, raw); Object.entries(sentinels).forEach(([name, value]) => localStorage.setItem(name, value)); }, { key, raw, sentinels });
      await enter(page);
      await expect(page.locator("[data-save-notice]")).toBeVisible();
      const skip = page.getByRole("button", { name: "跳过教程", exact: true });
      if (await skip.isVisible()) await skip.click();
      await input(page, context, 1, "up", "button");
      await page.getByRole("button", { name: "提示", exact: true }).click();
      await page.getByRole("button", { name: "关闭声音", exact: true }).click();
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
      expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(sentinels))).toEqual(sentinels);
    });
  }

  for (const operation of ["getItem", "setItem"] as const) {
    test(`denied ${operation} leaves board operable without console/page errors`, async ({ page, context }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(({ operation, key }) => {
        const original = Storage.prototype[operation];
        Object.defineProperty(Storage.prototype, operation, { configurable: true, value: function(this: Storage, name: string, ...args: string[]) {
          if (name === key) throw new DOMException("Synthetic storage refusal", "SecurityError");
          return (original as (...args: string[]) => unknown).apply(this, [name, ...args]);
        } });
      }, { operation, key });
      await enter(page);
      await expect(page.locator("[data-save-notice]")).toBeVisible();
      await input(page, context, 1, "up", "button");
      await expect(page.locator(coverage)).toHaveText("2/6");
      expect(errors).toEqual([]);
    });
  }
});

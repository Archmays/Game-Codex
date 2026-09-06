import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { TARGET_PUZZLE_MANIFEST, puzzlesForTarget } from "../../games/make-target/puzzles";
import { KNOWN_SAVE_KEYS, EXPORTABLE_SAVE_KEYS, SAVE_VAULT_PRE_IMPORT_BACKUP_KEY } from "../../packages/data/saveKeyInventory";
import {
  activateTarget, mergeTargetCards, selectTargetCards, solveTargetByInput,
  targetAction, targetInputs, TARGET_PROGRESS_KEY,
} from "./helpers/target-workbench";

const familyOrigin = process.env.MATH_WORKBENCH_FAMILY_ORIGIN === "1";
const origin = familyOrigin ? "http://127.0.0.1:5175" : "http://127.0.0.1:5292";
const evidence = process.env.MATH_WORKBENCH_EVIDENCE_DIR;
const sourceIdentity = process.env.MATH_WORKBENCH_SOURCE_IDENTITY;
const touch = (info: TestInfo) => Boolean(info.project.use.hasTouch);
const first = puzzlesForTarget(10)[0];
const runtimeErrors = new WeakMap<Page, string[]>();

async function criticalGeometry(page: Page, selector: string): Promise<void> {
  const controls = page.locator(selector);
  const rects = await controls.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
  for (const [i, rect] of rects.entries()) {
    expect(rect.width, selector).toBeGreaterThanOrEqual(48);
    expect(rect.height, selector).toBeGreaterThanOrEqual(48);
    for (const other of rects.slice(i + 1)) {
      const intersects = Math.min(rect.right, other.right) > Math.max(rect.left, other.left)
        && Math.min(rect.bottom, other.bottom) > Math.max(rect.top, other.top);
      expect(intersects, selector + " targets intersect").toBe(false);
    }
    const control = controls.nth(i);
    await control.scrollIntoViewIfNeeded();
    expect(await control.evaluate(element => {
      const r = element.getBoundingClientRect();
      return [[.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8]].every(([x, y]) => {
        const hit = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y);
        return hit === element || element.contains(hit);
      });
    }), selector + " five interior hit points").toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function keyboardActivate(page: Page, selector: string): Promise<void> {
  for (let i = 0; i < 50 && !await page.locator(selector).evaluate(element => element === document.activeElement); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(selector)).toBeFocused();
  expect(await page.locator(selector).evaluate(element => element.matches(":focus-visible") && parseFloat(getComputedStyle(element).outlineWidth) >= 2)).toBe(true);
  await page.keyboard.press("Enter");
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  if (!evidence || !["desktop-1440", "mobile-390"].includes(info.project.name)) return;
  mkdirSync(evidence, { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
  const file = resolve(evidence, info.project.name + "-" + name + ".png");
  await page.screenshot({ path: file, fullPage: true, scale: "css", animations: "disabled" });
  writeFileSync(file.replace(/\.png$/, ".json"), JSON.stringify({
    sourceIdentity, name, profile: info.project.name, url: page.url(),
    input: targetInputs.get(page) ?? [], aria: await page.locator("body").ariaSnapshot(),
    screenshot: { file, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") },
    geometry: await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scrollY,
      controls: [...document.querySelectorAll<HTMLElement>(".target-workbench button, .target-workbench summary, .math-map button")]
        .filter(element => element.getBoundingClientRect().width > 0)
        .map(element => ({ name: element.getAttribute("aria-label") ?? element.textContent, rect: element.getBoundingClientRect().toJSON() })),
    })),
  }, null, 2));
}

async function openTarget(page: Page): Promise<void> {
  await page.goto(origin + "/?world=math-world&station=target");
  await expect(page.getByTestId("target-workshop")).toBeVisible();
}

async function handState(page: Page) {
  return page.getByTestId("target-cards").locator("button").evaluateAll(cards => cards.map(card => ({
    id: card.getAttribute("data-card-id"), source: card.getAttribute("data-source-ids"), text: card.textContent,
    selected: card.getAttribute("aria-pressed"),
  })));
}

test.beforeEach(async ({ context, page }, info) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  const observe = (observed: Page) => {
    observed.on("pageerror", error => errors.push(error.message));
    observed.on("console", message => {
      const expectedBadImage = info.title.includes("failed city images")
        && message.location().url.includes("two-station-city.webp");
      if (message.type() === "error" && !expectedBadImage) errors.push(message.text());
    });
  };
  observe(page);
  context.on("page", observe);
  context.on("request", request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) errors.push("External request: " + request.url());
  });
  if (familyOrigin) await context.route("http://127.0.0.1:5175/**", async route => {
    await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(":5175", ":5292") }) });
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

test("@workbench all twelve original puzzles complete by real input, with 4→3→2→1 and stable source IDs", async ({ page }, info) => {
  await openTarget(page);
  await capture(page, info, "entry");
  for (const target of [10, 12, 24] as const) {
    if (target !== 10) await targetAction(page, "target-" + target, touch(info));
    for (const [index, puzzle] of puzzlesForTarget(target).entries()) {
      if (index) await targetAction(page, "next", touch(info));
      await solveTargetByInput(page, puzzle, touch(info));
      if (index === 0) await capture(page, info, "complete-" + target);
    }
  }
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), TARGET_PROGRESS_KEY);
  expect(save).toEqual({ version: 1, wins: 12, completedPuzzleIds: TARGET_PUZZLE_MANIFEST.map(p => p.id).sort() });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("@workbench same-valued cards remain distinct, selection slots map sources, and undo restores exact IDs", async ({ page }, info) => {
  await openTarget(page);
  const initial = await handState(page);
  await selectTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", touch(info));
  await capture(page, info, "selected");
  await targetAction(page, "combine", touch(info));
  const literal = page.locator('[data-card-id="target-10-01-source-3"]');
  const combined = page.locator('[data-card-id="target-10-01-combined-1"]');
  await expect(literal).toHaveAttribute("data-card-value", "3");
  await expect(combined).toHaveAttribute("data-card-value", "3");
  await expect(combined).toBeFocused();
  await expect(combined).toHaveAccessibleName(/合成 1·2/);
  await expect(literal).toHaveAccessibleName(/原牌 3/);
  await capture(page, info, "same-values");
  await targetAction(page, "operator-+", touch(info));
  await expect(page.locator(".target-card.is-new")).toHaveCount(0);
  await selectTargetCards(page, "target-10-01-source-3", "target-10-01-combined-1", touch(info));
  await expect(page.locator(".target-card.is-new")).toHaveCount(0);
  await expect(page.locator('[data-operand="left"]')).toHaveAttribute("aria-label", /原牌 3/);
  await expect(page.locator('[data-operand="right"]')).toHaveAttribute("aria-label", /合成 1·2/);
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(3);
  await targetAction(page, "operator--", touch(info));
  await expect(page.getByTestId("target-preview")).toContainText("3 - (1 + 2) = 0");
  await targetAction(page, "swap", touch(info));
  await expect(page.getByTestId("target-preview")).toContainText("(1 + 2) - 3 = 0");
  await targetAction(page, "combine", touch(info));
  await expect(page.locator('[data-card-id="target-10-01-combined-2"]')).toHaveAttribute("data-card-value", "0");
  if (info.project.name === "mobile-390") await capture(page, info, "zero-result");
  await targetAction(page, "undo", touch(info));
  await targetAction(page, "undo", touch(info));
  expect(await handState(page)).toEqual(initial);
  await expect(page.locator('[data-card-id="target-10-01-source-1"]')).toBeFocused();
  await expect(page.getByTestId("target-history")).toContainText("还没有合并步骤");
});

test("@workbench negative, non-integral and zero-divisor previews do not consume cards or history", async ({ page }, info) => {
  await openTarget(page);
  await selectTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", touch(info));
  for (const [operator, reason] of [["-", "负数"], ["÷", "不能整除"]] as const) {
    await targetAction(page, "operator-" + operator, touch(info));
    await expect(page.getByTestId("target-preview")).toContainText(reason);
    await expect(page.locator('[data-target-action="combine"]')).toBeDisabled();
    const bounds = await page.locator('[data-target-action="combine"]').boundingBox();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
    await expect(page.getByTestId("target-history")).toContainText("还没有合并步骤");
    if (operator === "-" && info.project.name === "desktop-1440") await capture(page, info, "negative-preview");
  }
  await targetAction(page, "operator--", touch(info));
  await targetAction(page, "swap", touch(info));
  await expect(page.getByTestId("target-preview")).toContainText("2 - 1 = 1");
  await expect(page.locator('[data-target-action="combine"]')).toBeEnabled();
  await targetAction(page, "next", touch(info));
  await mergeTargetCards(page, "target-10-02-source-1", "target-10-02-source-2", "-", touch(info));
  await selectTargetCards(page, "target-10-02-source-3", "target-10-02-combined-1", touch(info));
  await targetAction(page, "operator-÷", touch(info));
  await expect(page.getByTestId("target-preview")).toContainText("不能除以 0");
  await expect(page.locator('[data-target-action="combine"]')).toBeDisabled();
  if (info.project.name === "mobile-390") await capture(page, info, "divide-zero");
  await targetAction(page, "swap", touch(info));
  await expect(page.getByTestId("target-preview")).toContainText("(1 - 1) ÷ 4 = 0");
  await targetAction(page, "combine", touch(info));
  await expect(page.locator('[data-card-id="target-10-02-combined-2"]')).toHaveAttribute("data-card-value", "0");
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBeNull();
});

test("@workbench an early target is not completion; all four source cards must still be used", async ({ page }, info) => {
  await openTarget(page);
  await mergeTargetCards(page, "target-10-01-source-2", "target-10-01-source-3", "×", touch(info));
  await mergeTargetCards(page, "target-10-01-combined-1", "target-10-01-source-4", "+", touch(info));
  await expect(page.locator('[data-card-id="target-10-01-combined-2"]')).toHaveAttribute("data-card-value", "10");
  await expect(page.getByTestId("target-completion")).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBeNull();
  if (info.project.name === "desktop-1440") await capture(page, info, "early-target");
  await mergeTargetCards(page, "target-10-01-combined-2", "target-10-01-source-1", "÷", touch(info));
  await expect(page.getByTestId("target-completion")).toBeVisible();
});

test("@workbench four hint layers use the current expression sources, and dead ends can require multiple undos", async ({ page }, info) => {
  await openTarget(page);
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", "+", touch(info));
  const before = await handState(page);
  for (let level = 1; level <= 4; level++) {
    await targetAction(page, "hint", touch(info));
    await expect(page.getByTestId("target-hint").locator("li")).toHaveCount(level);
  }
  await expect(page.getByTestId("target-hint")).toContainText("当前下一步");
  await expect(page.getByTestId("target-hint")).toContainText("原牌");
  await expect(page.getByTestId("target-hint")).toContainText("合成");
  await expect(page.getByTestId("target-hint")).not.toContainText("第一步");
  expect(await handState(page)).toEqual(before);
  await capture(page, info, "current-hint");
  await targetAction(page, "undo", touch(info));
  await mergeTargetCards(page, "target-10-01-source-4", "target-10-01-source-3", "-", touch(info));
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", "+", touch(info));
  await targetAction(page, "hint", touch(info));
  await expect(page.getByTestId("target-hint")).toContainText("逐步撤销");
  await targetAction(page, "undo", touch(info));
  await targetAction(page, "hint", touch(info));
  await expect(page.getByTestId("target-hint")).toContainText("没有续解");
  if (info.project.name === "mobile-390") await capture(page, info, "dead-end-after-undo");
  await targetAction(page, "undo", touch(info));
  await solveTargetByInput(page, first, touch(info));
  await targetAction(page, "hint", touch(info));
  await expect(page.getByTestId("target-hint")).toContainText("这组已完成");
  await expect(page.getByTestId("target-hint")).not.toContainText("没有续解");
});

test("@workbench changing a merged unfinished round is cancellable without losing the current attempt", async ({ page }, info) => {
  await openTarget(page);
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", "+", touch(info));
  const before = await handState(page);
  const history = await page.getByTestId("target-history").textContent();
  await targetAction(page, "target-12", touch(info));
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('[data-target-action="cancel-change"]')).toBeFocused();
  if (info.project.name === "mobile-390") await capture(page, info, "cancel-change");
  await targetAction(page, "cancel-change", touch(info));
  expect(await handState(page)).toEqual(before);
  expect(await page.getByTestId("target-history").textContent()).toBe(history);
  await expect(page.locator('[data-target-action="target-12"]')).toBeFocused();
  await targetAction(page, "next", touch(info));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await handState(page)).toEqual(before);
  await targetAction(page, "next", touch(info));
  await targetAction(page, "confirm-change", touch(info));
  await expect(page.locator('[data-card-id="target-10-02-source-1"]')).toBeFocused();
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
});

test("@workbench voluntary replay and undo/recompletion are idempotent, with complete readable history", async ({ page }, info) => {
  await page.goto(origin);
  await page.evaluate(key => localStorage.setItem(key, '{"wins":7,"completedPuzzleIds":["historical"],"extension":{"keep":[1,2]}}'), TARGET_PROGRESS_KEY);
  await openTarget(page);
  await solveTargetByInput(page, first, touch(info));
  const saved = await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY);
  expect(JSON.parse(saved!)).toEqual({ version: 1, wins: 8, completedPuzzleIds: ["historical", first.id], extension: { keep: [1, 2] } });
  await activateTarget(page, page.getByTestId("target-history").locator("summary"), touch(info));
  await expect(page.getByTestId("target-history").locator("details")).toHaveAttribute("open", "");
  await expect(page.getByTestId("target-history").locator("li")).toHaveCount(3);
  if (info.project.name === "desktop-1440") await capture(page, info, "expanded-history");
  await targetAction(page, "replay", touch(info));
  if (info.project.name === "desktop-1440") await capture(page, info, "replay");
  await solveTargetByInput(page, first, touch(info));
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBe(saved);
  await targetAction(page, "undo", touch(info));
  const lastPair = page.getByTestId("target-cards").locator("button");
  await activateTarget(page, lastPair.nth(0), touch(info));
  await activateTarget(page, lastPair.nth(1), touch(info));
  // The previous operator is retained by undo; use the previewed legal order.
  if (await page.locator('[data-target-action="combine"]').isDisabled()) await targetAction(page, "swap", touch(info));
  await targetAction(page, "combine", touch(info));
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBe(saved);
});

test("@workbench rapid double input consumes one pair, and undo/navigation cancel only presentation", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openTarget(page);
  // Hold only the presentation longer as a cancellation fault; input still changes the real model.
  await page.addStyleTag({ content: ".target-card.is-new { animation-duration: 10s !important; }" });
  await selectTargetCards(page, "target-10-01-source-1", "target-10-01-source-2");
  const button = await page.locator('[data-target-action="combine"]').boundingBox();
  await page.mouse.dblclick(button!.x + button!.width / 2, button!.y + button!.height / 2, { delay: 10 });
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(3);
  await expect(page.getByTestId("target-history")).toContainText("1 + 2 = 3");
  expect(await page.locator(".target-card.is-new").evaluate(element => element.getAnimations().some(animation => animation.playState === "running"))).toBe(true);
  await targetAction(page, "undo", touch(info));
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
  expect(await page.evaluate(() => document.getAnimations().some(animation => (animation.effect as KeyframeEffect)?.target instanceof Element && ((animation.effect as KeyframeEffect).target as Element).classList.contains("target-card")))).toBe(false);
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2");
  expect(await page.locator(".target-card.is-new").evaluate(element => element.getAnimations().some(animation => animation.playState === "running"))).toBe(true);
  await page.locator("[data-return-map]").click();
  await expect(page.getByTestId("target-workshop")).toHaveCount(0);
  await expect(page.locator('[data-station-id="target"] button')).toBeFocused();
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBeNull();
  await page.locator('[data-station-id="target"] button').click();
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
});

test("@workbench map buildings are the two ordered, non-duplicate semantic entrances", async ({ page }, info) => {
  await page.goto(origin + "/?world=math-world");
  const entries = page.locator(".math-world-card button");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toHaveAccessibleName("进入算式滑轨站");
  await expect(entries.nth(1)).toHaveAccessibleName("进入目标工坊");
  await capture(page, info, "map");
  await entries.nth(0).focus();
  await page.keyboard.press("Tab");
  await expect(entries.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-station-id="target"] button')).toBeFocused();
  await page.goForward();
  await expect(page.getByTestId("target-workshop")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
});

test("@workbench failed city images retain both visible text entrances", async ({ page }, info) => {
  await page.route("**/assets/math-world/two-station-city.webp", route => route.abort());
  await page.goto(origin + "/?world=math-world");
  await expect(page.locator(".is-art-unavailable")).toHaveCount(2);
  if (info.project.name === "mobile-390") await capture(page, info, "image-fallback");
  await activateTarget(page, page.getByRole("button", { name: "进入目标工坊", exact: true }), touch(info));
  await expect(page.getByTestId("target-workshop")).toBeVisible();
});

test("@workbench critical action groups meet 48px, clear geometry and five-point hit contracts", async ({ page }, info) => {
  await page.goto(origin + "/?world=math-world");
  await criticalGeometry(page, ".math-map button");
  await activateTarget(page, page.getByRole("button", { name: "进入目标工坊", exact: true }), touch(info));
  await criticalGeometry(page, ".target-modes button, .target-hand button, .target-operators button, .target-actions button, .target-hint-controls button");
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", "+", touch(info));
  await targetAction(page, "next", touch(info));
  await criticalGeometry(page, ".target-change button");
  await targetAction(page, "cancel-change", touch(info));
  await targetAction(page, "undo", touch(info));
  await solveTargetByInput(page, first, touch(info));
  await criticalGeometry(page, ".target-completion__choices button, .target-history summary");
});

test("@workbench keyboard alone selects sources, swaps, merges, undoes and cancels a target change", async ({ page }) => {
  await openTarget(page);
  await keyboardActivate(page, '[data-card-id="target-10-01-source-1"]');
  await keyboardActivate(page, '[data-card-id="target-10-01-source-2"]');
  await keyboardActivate(page, '[data-target-action="operator--"]');
  await keyboardActivate(page, '[data-target-action="swap"]');
  await expect(page.getByTestId("target-preview")).toContainText("2 - 1 = 1");
  await keyboardActivate(page, '[data-target-action="combine"]');
  await expect(page.locator('[data-card-id="target-10-01-combined-1"]')).toBeFocused();
  await keyboardActivate(page, '[data-target-action="target-24"]');
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-target-action="target-24"]')).toBeFocused();
  await keyboardActivate(page, '[data-target-action="undo"]');
  await expect(page.getByTestId("target-cards").locator("button")).toHaveCount(4);
});

test("@workbench persistent mute and reduced motion preferences reach the workbench", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("family-games/my-game-world/v1", JSON.stringify({ version: 1, settings: { muted: true, reducedMotion: true } }));
    Object.defineProperty(window, "AudioContext", { value: class { constructor() { document.documentElement.dataset.audioAttempted = "true"; throw new Error("Muted target attempted audio"); } } });
  });
  await openTarget(page);
  const saved = await page.evaluate(() => localStorage.getItem("family-games/my-game-world/v1"));
  await mergeTargetCards(page, "target-10-01-source-1", "target-10-01-source-2", "+", touch(info));
  await expect(page.getByTestId("target-workshop")).toHaveAttribute("data-reduced-motion", "true");
  expect(await page.locator(".target-card.is-new").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.locator("html").getAttribute("data-audio-attempted")).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("family-games/my-game-world/v1"))).toBe(saved);
});

test("@workbench unrecognized, future and corrupt target records remain byte-exact after real completion", async ({ page }, info) => {
  await page.goto(origin);
  for (const raw of ["", "{broken", "null", "[]", '{"version":99,"wins":88,"extension":{"keep":true}}',
    '{"version":1,"wins":2,"completedPuzzleIds":"bad"}', '{"unrecognized":{"keep":true}}']) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TARGET_PROGRESS_KEY, raw]);
    await openTarget(page);
    await solveTargetByInput(page, first, touch(info));
    expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBe(raw);
    await expect(page.locator(".target-save-note")).toContainText("原来的记录保持不变");
  }
});

test("@workbench another tab cannot replace the save generation underneath a mounted target or map", async ({ page, context }, info) => {
  await page.goto(origin);
  const other = await context.newPage();
  await other.goto(origin);
  for (const raw of ['{"version":1,"wins":44,"completedPuzzleIds":["restored"],"extension":{"keep":true}}', '{"version":99,"wins":88}', "{broken"]) {
    await page.evaluate(key => localStorage.setItem(key, '{"version":1,"wins":3,"completedPuzzleIds":[]}'), TARGET_PROGRESS_KEY);
    await openTarget(page);
    await other.evaluate(([key, value]) => localStorage.setItem(key, value), [TARGET_PROGRESS_KEY, raw]);
    await solveTargetByInput(page, first, touch(info));
    expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBe(raw);
  }
  const restoredMap = '{"version":1,"lastStation":"clock","visitedStations":["clock","lab"],"extension":{"restored":true}}';
  await other.evaluate(raw => localStorage.setItem("family-games/math-world/v1", raw), restoredMap);
  await page.locator("[data-return-map]").click();
  await page.locator("[data-motion-setting]").click();
  expect(await page.evaluate(() => localStorage.getItem("family-games/math-world/v1"))).toBe(restoredMap);
  await other.close();
});

for (const denied of ["read", "write"] as const) {
  test("@workbench denied storage " + denied + " still allows complete local play without replacing bytes", async ({ page }, info) => {
    await page.addInitScript(mode => {
      if (mode === "read") {
        Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Synthetic blocked read", "SecurityError"); } });
      } else {
        Storage.prototype.setItem = function () { throw new DOMException("Synthetic blocked write", "QuotaExceededError"); };
      }
    }, denied);
    await openTarget(page);
    await solveTargetByInput(page, first, touch(info));
    await expect(page.locator(".target-save-note")).toBeVisible();
    await targetAction(page, "hint", touch(info));
    await expect(page.getByTestId("target-hint")).toContainText("这组已完成");
    await page.locator("[data-return-map]").click();
    await expect(page.locator(".math-world-card button")).toHaveCount(2);
  });
}

test("@workbench all 37 exact keys survive the public Vault roundtrip and the mounted old page cannot overwrite restored records", async ({ page, context }, info) => {
  expect(KNOWN_SAVE_KEYS).toHaveLength(37);
  expect(EXPORTABLE_SAVE_KEYS).toHaveLength(36);
  await page.goto(origin);
  const fixture: Record<string, string> = Object.fromEntries(KNOWN_SAVE_KEYS.map((record, index) => [
    record.key, JSON.stringify({ version: record.maxVersion ?? 1, syntheticOnly: true, fixture: index }),
  ]));
  fixture["family-games/my-game-world/v1"] = '{"version":1,"settings":{"muted":true,"reducedMotion":true}}';
  fixture["family-games/math-world/v1"] = '{"version":1,"lastStation":"clock","visitedStations":["clock","lab"],"extension":{"fixture":"initial"}}';
  fixture[TARGET_PROGRESS_KEY] = '{"version":1,"wins":3,"completedPuzzleIds":[],"extension":{"fixture":"initial"}}';
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    localStorage.setItem("unrelated-fixture/save", "keep-synthetic");
  }, fixture);
  await openTarget(page);
  const vaultPage = await context.newPage();
  await vaultPage.goto(origin);
  // Export a distinct, valid synthetic generation using the real Vault UI.
  fixture["family-games/math-world/v1"] = '{"version":1,"lastStation":"slider","visitedStations":["array","slider"],"extension":{"fixture":"restored"}}';
  fixture[TARGET_PROGRESS_KEY] = '{"version":1,"wins":9,"completedPuzzleIds":["historical"],"extension":{"fixture":"restored"}}';
  await vaultPage.evaluate(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, fixture);
  await vaultPage.getByRole("button", { name: /家长角/ }).click();
  await vaultPage.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  const downloadPromise = vaultPage.waitForEvent("download");
  await vaultPage.getByRole("button", { name: "备份游戏进度" }).click();
  const download = await downloadPromise;
  const exportText = readFileSync((await download.path())!, "utf8");
  const exported = JSON.parse(exportText).entries as { key: string; value: string }[];
  expect(exported.map(entry => entry.key).sort()).toEqual(EXPORTABLE_SAVE_KEYS.map(record => record.key).sort());
  for (const entry of exported) expect(entry.value).toBe(fixture[entry.key]);
  expect(exportText).not.toContain("unrelated-fixture/save");
  await vaultPage.evaluate(keys => {
    for (const key of keys) localStorage.setItem(key, '{"syntheticBeforeRestore":true}');
  }, EXPORTABLE_SAVE_KEYS.map(record => record.key));
  await vaultPage.locator("[data-vault-file]").setInputFiles({ name: "synthetic-37-keys.json", mimeType: "application/json", buffer: Buffer.from(exportText) });
  await expect(vaultPage.locator("[data-vault-preview-checksum]")).toHaveText("PASS");
  vaultPage.once("dialog", dialog => { void dialog.accept(); });
  await vaultPage.locator("[data-vault-restore]").click();
  await expect(vaultPage.locator("[data-vault-status]")).toContainText("已恢复 36");
  const restored = await vaultPage.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), KNOWN_SAVE_KEYS.map(record => record.key));
  for (const record of EXPORTABLE_SAVE_KEYS) expect(restored[record.key]).toBe(fixture[record.key]);
  expect(restored[SAVE_VAULT_PRE_IMPORT_BACKUP_KEY]).toContain("syntheticBeforeRestore");
  expect(await vaultPage.evaluate(() => localStorage.getItem("unrelated-fixture/save"))).toBe("keep-synthetic");
  await solveTargetByInput(page, first, touch(info));
  expect(await page.evaluate(key => localStorage.getItem(key), TARGET_PROGRESS_KEY)).toBe(fixture[TARGET_PROGRESS_KEY]);
  await page.locator("[data-return-map]").click();
  await page.locator("[data-motion-setting]").click();
  expect(await page.evaluate(() => localStorage.getItem("family-games/math-world/v1"))).toBe(fixture["family-games/math-world/v1"]);
  await vaultPage.close();
});

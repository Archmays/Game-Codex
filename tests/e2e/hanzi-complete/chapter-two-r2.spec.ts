import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { createFreshCompleteSave, updateCompleteSave, HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { CHAPTER_TWO_R2_RULESET, getChapterTwoSceneDefinition, getR2Definition } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-two/chapter-two-r2";
import { chapterTwoR2Run } from "../../hanzi-complete/chapter-two-r2-fixture";
import { computeHanziCompleteSourceTreeSha256 } from "../../../tools/hanzi-magic-complete/source-identity";

const output = resolve("tmp/tasks/GAME-CODEX-STEP4-HANZI-CHAPTER2-FULL-PROMOTION/final-browser");
mkdirSync(output, { recursive: true });
const route = "/?play=hanzi-magic-complete&from=hub&chapter=two";
const shell = (page: Page) => page.getByTestId("hanzi-complete-chapter-two");
async function seed(page: Page, replay?: ReturnType<typeof chapterTwoR2Run>) {
  const save = updateCompleteSave(createFreshCompleteSave(), { unlockedChapterIds: ["chapter-one", "chapter-two"], settings: { muted: true, reducedMotion: true, inputMode: "auto" }, ...(replay ? { chapterTwoReplay: { seed: replay.seed, initialHeroId: replay.initialHeroId, ruleset: replay.ruleset, actions: replay.actions } } : {}) });
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(save) });
}
async function activate(page: Page, locator: Locator, touch: boolean, keyboard = false) {
  if (keyboard) { await locator.focus(); await page.keyboard.press("Enter"); }
  else if (touch) await locator.tap(); else await locator.click();
}
async function build(page: Page, touch: boolean, keyboard = false) {
  const id = await shell(page).getAttribute("data-current-character-id");
  const target = COMPLETE_CORE_CHARACTER_NODES.find(character => character.id === id)!;
  for (let i = 0; i < target.components.length; i++) {
    await activate(page, page.locator(`[data-card-id="${id}-target-${i + 1}"]`), touch, keyboard);
    const slot = page.locator(`[data-slot-id="${target.components[i].slotId}"]`);
    if (target.components[i].slotId === "outer" && !keyboard) { if (touch) await slot.tap({ position: { x: 20, y: 30 } }); else await slot.click({ position: { x: 20, y: 30 } }); }
    else await activate(page, slot, touch, keyboard);
  }
}
async function geometry(page: Page) {
  const result = await page.evaluate(() => {
    const visible = [...document.querySelectorAll<HTMLElement>(".pilot-adventure button:not(:disabled),.pilot-adventure summary,.pilot-adventure a")].filter(el => el.getBoundingClientRect().width > 0);
    const tiny = visible.filter(el => { const r = el.getBoundingClientRect(); return r.width < 47.9 || r.height < 47.9; }).map(el => ({ text: el.textContent, rect: el.getBoundingClientRect().toJSON() }));
    const stage = document.querySelector<HTMLElement>(".pilot-stage")?.getBoundingClientRect();
    const controls = [...document.querySelectorAll<HTMLElement>(".pilot-stage button:not(:disabled)")].map(el => ({ el, r: el.getBoundingClientRect() }));
    const clipped = controls.filter(({ r }) => stage && (r.left < stage.left || r.right > stage.right || r.top < stage.top || r.bottom > stage.bottom)).map(({ el }) => el.textContent);
    const overlaps: string[] = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) { const a = controls[i].r, b = controls[j].r; if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push(`${controls[i].el.textContent}/${controls[j].el.textContent}`); }
    const misses = controls.filter(({el,r}) => {
      const points = [[.25,.25],[.5,.5],[.75,.75]];
      return points.some(([x,y]) => { const hit = document.elementFromPoint(r.left+r.width*x,r.top+r.height*y); return r.top>=0 && r.bottom<=innerHeight && hit && hit !== el && !el.contains(hit); });
    }).map(({el})=>el.textContent);
    return { tiny, clipped, overlaps, misses, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(result).toEqual({ tiny: [], clipped: [], overlaps: [], misses: [], overflow: 0 });
  return result;
}
async function capture(page: Page, id: string, rows: unknown[]) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll<HTMLImageElement>(".pilot-stage img")].map(img => img.decode())); });
  const path = resolve(output, `${id}.png`); await page.screenshot({ path, scale: "css" });
  rows.push({ id, route: page.url(), viewport: page.viewportSize(), sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), geometry: await geometry(page) });
}

test("r2 whole chapter uses actual mouse or touch, preserves saves, and enters chapter three", async ({ page }, info) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(10_000);
  const sourceTreeSha256 = computeHanziCompleteSourceTreeSha256();
  const touch = info.project.name === "mobile-touch", width = touch ? 390 : 1440;
  await page.setViewportSize({ width, height: touch ? 844 : 900 }); await seed(page);
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url()); });
  await page.goto(route); await shell(page).waitFor();
  await activate(page, page.getByRole("button", { name: "走上木语树冠" }), touch);
  const frames: unknown[] = [], checked: unknown[] = [];
  for (let guard = 0; guard < 180; guard++) {
    const phase = await shell(page).getAttribute("data-phase"); if (phase === "chapter-summary") break;
    const location = { ruleset: CHAPTER_TWO_R2_RULESET, episodeIndex: Number(await shell(page).getAttribute("data-episode-index")), encounterIndex: Number(await shell(page).getAttribute("data-encounter-index")) };
    const definition = getChapterTwoSceneDefinition(location), r2 = getR2Definition(location);
    if (phase === "build") {
      if (r2?.object === "star-path") {
        await capture(page, `${width}-07-build`, frames);
        await activate(page, page.locator('[data-card-id="char-u8ff7-target-1"]'), touch);
        await activate(page, page.locator('[data-slot-id="inner"]'), touch);
        await expect(page.getByRole("status")).toContainText("不住在这里");
      }
      await build(page, touch);
    } else if (phase === "pilot-meaning") {
      await geometry(page);
      if (r2) {
        if (!touch && r2.rootSource === undefined) await capture(page, `${width}-${r2.object}-before`, frames);
        const targets = touch ? [...r2.targets].reverse() : r2.targets;
        for (let i = 0; i < (r2.choice ? 1 : targets.length); i++) {
          await activate(page, page.locator(`[data-r2-target="${targets[i].id}"]`), touch);
          if (targets.length > 1 && !r2.choice && i === 0) {
            await expect(shell(page)).toHaveAttribute("data-phase", "pilot-meaning");
            if (touch) await capture(page, `${width}-${r2.object}-partial`, frames);
            const beforeReload = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay, HANZI_MAGIC_COMPLETE_SAVE_KEY);
            await page.reload(); await shell(page).waitFor();
            expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay, HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(beforeReload);
          }
        }
      } else if (definition!.object === "waterwheel") {
        if (touch) await activate(page, page.locator('[data-pilot-move="char-u8ff7"]'), touch);
        await activate(page, page.locator('[data-pilot-move="char-u9053"]'), touch);
      } else if (definition!.object === "vine") await activate(page, page.getByRole("button", { name: touch ? "想聊聊" : "想静静" }), touch);
      else await activate(page, page.locator('[data-action="pilot-magic"]'), touch);
    } else if (phase === "family-connect") {
      if (definition!.object === "leaf-gate") await activate(page, page.getByRole("button", { name: "用已学的指光看清根线" }), touch);
      if (r2) {
        for (const id of [definition!.startId, definition!.decoyId]) await activate(page, page.locator(`[data-family-character-id="${id}"]`), touch);
        await activate(page, page.getByRole("button", { name: "接好这两个字碑" }), touch);
        await expect(page.getByRole("status")).toContainText("不同");
      }
      const nodes = definition!.nodeIds;
      const pairs = touch && nodes.length > 2 ? nodes.slice(1).map((node,i) => [nodes[i],node]) : [[definition!.startId, definition!.endId]];
      for (const pair of pairs) {
        for (const id of pair) await activate(page, page.locator(`[data-family-character-id="${id}"]`), touch);
        await activate(page, page.getByRole("button", { name: "接好这两个字碑" }), touch);
        await geometry(page);
      }
      if (r2?.rootSource !== undefined) {
        await expect(shell(page)).toHaveAttribute("data-phase", "family-connect");
        await activate(page, page.locator('[data-action="r2-root"]'), touch);
      }
      await expect(shell(page)).toHaveAttribute("data-phase", "family-result");
      if (r2 && r2.rootSource === undefined) await capture(page, `${width}-${r2.object}-after`, frames);
      if (r2?.rootSource !== undefined && r2.rootSource < 2) await capture(page, `${width}-root-${r2.rootSource + 1}`, frames);
    } else {
      if (phase === "episode-repair" && location.episodeIndex === 3) await capture(page, `${width}-root-restored`, frames);
      await activate(page, page.locator(`[data-action="${({"core-intro":"start-core",ending:"finish-ending"} as Record<string,string>)[phase!] ?? "continue"}"]`), touch);
    }
    checked.push({ phase, episode: location.episodeIndex, encounter: location.encounterIndex, geometry: await geometry(page) });
    if (phase === "family-connect" && r2?.object === "star-path") {
      const replay = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay, HANZI_MAGIC_COMPLETE_SAVE_KEY);
      await activate(page, page.getByRole("link", { name: "返回墨迹森林" }), touch);
      await page.goto("/?play=hanzi-magic-complete&view=spellbook"); await page.locator("main").waitFor();
      await page.goto(route); await shell(page).waitFor();
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay, HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(replay);
    }
  }
  await expect(shell(page)).toHaveAttribute("data-phase", "chapter-summary");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), HANZI_MAGIC_COMPLETE_SAVE_KEY);
  expect(saved.chapterTwoReplay.ruleset).toBe(CHAPTER_TWO_R2_RULESET); expect(saved.completedChapterIds).toContain("chapter-two"); expect(saved.unlockedChapterIds).toContain("chapter-three");
  await activate(page, page.getByRole("link", { name: "走向家灯小镇" }), touch);
  await expect(page.getByTestId("hanzi-complete-chapter-three")).toBeVisible();
  for (const suffix of ["&chapter=one", "&view=spellbook", "", "&chapter=three"]) {
    await page.goto("/?play=hanzi-magic-complete" + suffix); await expect(page.getByRole("heading", { name: "正在打开游戏世界……" })).toHaveCount(0);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay, HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(saved.chapterTwoReplay);
  }
  expect(errors).toEqual([]); expect(external).toEqual([]);
  expect(computeHanziCompleteSourceTreeSha256()).toBe(sourceTreeSha256);
  writeFileSync(resolve(output, `${width}-checks.json`), JSON.stringify({ sourceTreeSha256, frames, checked, errors, external, complete: true }, null, 2));
});

test("r2 compact, tablet, keyboard, preferences, and actual enclosure slots", async ({ page }, info) => {
  test.setTimeout(90_000);
  const touch = info.project.name === "mobile-touch";
  const replay = chapterTwoR2Run({ stop: state => state.episodeIndex === 1 && state.encounterIndex === 2 && state.phase === "build" });
  await seed(page, replay); const frames: unknown[] = [];
  await page.setViewportSize({width:touch?360:768,height:touch?800:1024}); await page.goto(route); await shell(page).waitFor();
  await capture(page, `${touch?360:768}-half-enclosure`, frames);
  await activate(page, page.locator('[data-card-id="char-u8ff7-target-1"]'), touch, !touch);
  if(touch)await page.locator('[data-slot-id="outer"]').tap({position:{x:20,y:30}});else await activate(page,page.locator('[data-slot-id="outer"]'),false,true);
  await expect(page.locator('[data-slot-id="outer"]')).toContainText("辶");
  await activate(page,page.getByRole("button",{name:"收回一步"}),touch,!touch);
  await build(page,touch,!touch);
  await activate(page,page.getByRole("button",{name:"照亮上方弯路"}),touch,!touch);
  await geometry(page);
  await page.getByRole("button", {name:"打开声音",exact:true}).click(); await page.getByRole("button",{name:"静音",exact:true}).click();
  await page.getByRole("button",{name:"恢复动画",exact:true}).click(); await page.getByRole("button",{name:"减少动画",exact:true}).click();
  await expect(shell(page)).toHaveAttribute("data-muted","true");await expect(shell(page)).toHaveAttribute("data-reduced-motion","true");
  await page.keyboard.press("Tab"); await expect(page.locator(":focus")).toBeVisible();
  writeFileSync(resolve(output, `${touch?360:768}-checks.json`),JSON.stringify({frames,geometry:await geometry(page)},null,2));
});

test("Vault exports and restores an r2 partial object with both older run archives intact", async ({ page }) => {
  test.setTimeout(60_000); page.setDefaultTimeout(10_000);
  const replay = chapterTwoR2Run({ stop: state => state.episodeIndex === 2 && state.encounterIndex === 0 && state.phase === "pilot-meaning" && Object.values(state.r2Progress ?? {}).some(progress => progress.targets.includes("voice-left")) });
  const save = updateCompleteSave(createFreshCompleteSave(), {
    unlockedChapterIds: ["chapter-one", "chapter-two"], settings: { muted: true, reducedMotion: true, inputMode: "auto" },
    chapterTwoReplay: { seed: replay.seed, initialHeroId: replay.initialHeroId, ruleset: replay.ruleset, actions: replay.actions, priorRuns: [
      { seed: "vault-legacy", initialHeroId: "light-speaker", actions: [] },
      { seed: "vault-r1", initialHeroId: "light-speaker", ruleset: "pilot-six-r1", actions: [] },
    ] },
  });
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(save) });
  await page.goto(route); await expect(page.getByRole("button", { name: /让左端发出回应/ })).toBeDisabled();
  await page.goto("/?world=my-game-world"); await page.getByRole("button", { name: /家长角/ }).click();
  await page.getByRole("button", { name: "打开游戏进度保险箱" }).click();
  const raw = await page.evaluate(key => localStorage.getItem(key), HANZI_MAGIC_COMPLETE_SAVE_KEY);
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "备份游戏进度" }).click();
  const download = await pending; const bytes = readFileSync((await download.path())!);
  expect(JSON.parse(bytes.toString()).entries.find((entry: { key: string }) => entry.key === HANZI_MAGIC_COMPLETE_SAVE_KEY).value).toBe(raw);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: HANZI_MAGIC_COMPLETE_SAVE_KEY, value: JSON.stringify(createFreshCompleteSave()) });
  await page.locator("[data-vault-file]").setInputFiles({ name: "chapter-two-r2-backup.json", mimeType: "application/json", buffer: bytes });
  await expect(page.locator("[data-vault-preview-checksum]")).toHaveText("PASS");
  page.once("dialog", dialog => void dialog.accept()); await page.getByRole("button", { name: "恢复这些已知进度" }).click();
  await expect(page.locator("[data-vault-status]")).toContainText("已恢复");
  expect(await page.evaluate(key => localStorage.getItem(key), HANZI_MAGIC_COMPLETE_SAVE_KEY)).toBe(raw);
  await page.goto(route); await expect(page.getByRole("button", { name: /让左端发出回应/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "让右端发出回应", exact: true })).toBeEnabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).chapterTwoReplay.priorRuns, HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(save.chapterTwoReplay!.priorRuns);
});

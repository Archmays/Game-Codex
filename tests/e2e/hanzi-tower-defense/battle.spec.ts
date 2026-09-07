import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CORES, RECIPES } from "../../../games/hanzi-tower-defense/content";
import { SAVE_KEY } from "../../../games/hanzi-tower-defense/save";

const evidence = process.env.TD_EVIDENCE_DIR ?? "tmp/tasks/GAME-CODEX-STEP1-HOTFIX";
function observe(page: Page) {
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on("request", r => requests.push(r.url()));
  return { errors, requests };
}
async function open(page: Page) {
  await page.goto("/?play=hanzi-tower-defense");
  await expect(page.locator("[data-td-canvas]")).toHaveAttribute("data-ready", "true");
}
async function inventory(page: Page) {
  return page.locator("[data-core], .td-slot--occupied").evaluateAll(elements => elements.map(e => ({
    selector: e.hasAttribute("data-core") ? `[data-core="${e.getAttribute("data-core")}"]` : `[data-slot="${e.getAttribute("data-slot")}"]`,
    glyph: e.querySelector("strong, .td-slot-glyph")!.textContent!, bag: e.hasAttribute("data-core"),
  })));
}
test("six waves with ordinary deployment, synthesis, and replay", async ({ page }, info) => {
  const runtime = observe(page), started = Date.now(); mkdirSync(evidence, { recursive: true });
  let actionCount = 0;
  const activate = async (locator: Locator) => {
    await locator.scrollIntoViewIfNeeded();
    if (info.project.name === "touch") await locator.tap();
    else if (++actionCount % 3 === 0) { await locator.focus(); await page.keyboard.press("Enter"); }
    else await locator.click();
  };
  await open(page); await activate(page.locator("[data-td-pause]"));
  await expect(page.locator(".td-game")).toHaveAttribute("data-paused", "true");
  const route = info.project.name === "touch" ? ["fire-mountain", "wood-wood", "water-wood"] : ["fire-fire", "mountain-grove", "wood-wood", "water-wood"];
  const records: unknown[] = [];
  for (let wave = 0; wave < 6; wave++) {
    for (let step = 0; step < 20; step++) {
      const items = await inventory(page);
      let pair: { selector: string }[] | undefined;
      for (const id of route) {
        const r = RECIPES.find(r => r.id === id)!;
        const a = items.find(item => item.glyph === CORES[r.inputs[0]].glyph);
        const b = items.find(item => item.glyph === CORES[r.inputs[1]].glyph && item !== a);
        if (a && b) { pair = [a,b]; break; }
      }
      if (!pair) break;
      await activate(page.locator(pair[0].selector)); await activate(page.locator(pair[1].selector));
      await expect(page.locator("[data-td-fuse]")).toBeEnabled();
      await activate(page.locator("[data-td-fuse]"));
    }
    const damageOrder = ["山林", "火山", "炎", "林", "沐", "山", "火", "木", "氵"];
    const items = (await inventory(page)).filter(i => i.bag).sort((a,b) => damageOrder.indexOf(a.glyph)-damageOrder.indexOf(b.glyph));
    for (const item of items) {
      let empty: number | undefined;
      for (const slot of [1,3,0,6,2,4,7,5]) if (!(await page.locator(`[data-slot="${slot}"]`).getAttribute("class"))!.includes("td-slot--occupied")) { empty=slot; break; }
      if (empty === undefined) break;
      await activate(page.locator(item.selector)); await activate(page.locator(`[data-slot="${empty}"]`));
    }
    await page.locator("[data-td-board]").scrollIntoViewIfNeeded();
    if (wave === 0) {
      await page.screenshot({ path: `${evidence}/battle-${info.project.name}-deployment.png`, fullPage: true });
      await activate(page.locator("[data-td-pause]"));
    } else await activate(page.locator("[data-td-next]"));
    await page.locator("[data-td-board]").scrollIntoViewIfNeeded();
    if (wave === 3) {
      await page.waitForTimeout(14_000);
      await page.screenshot({ path: `${evidence}/battle-${info.project.name}-midwave.png`, fullPage: true });
    }
    await expect.poll(() => page.locator(".td-game").getAttribute("data-phase"), { timeout: 120_000, intervals: [1000] }).not.toBe("battle");
    const phase = await page.locator(".td-game").getAttribute("data-phase");
    expect(phase).toBe(wave === 5 ? "won" : "ready");
    records.push({ wave: wave+1, phase, kills: await page.locator(".td-game").getAttribute("data-kills"), health: await page.locator("[data-td-health]").textContent(), wallSeconds: Math.round((Date.now()-started)/1000) });
    console.log(`${info.project.name}: wave ${wave+1}/6 ${phase}`);
  }
  await expect(page.locator("[data-td-result]")).toBeVisible();
  await expect(page.locator(".td-game")).toHaveAttribute("data-kills", "122");
  await page.screenshot({ path: `${evidence}/battle-${info.project.name}-win.png`, fullPage: true });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  await activate(page.locator("[data-td-replay]"));
  await expect(page.locator(".td-game")).toHaveAttribute("data-wave", "0");
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY)).unlocked).toEqual(saved.unlocked);
  expect(runtime.errors).toEqual([]);
  expect(runtime.requests.filter(url => /hanzi-radical-battle|english-world|english-spell-battle|pinyin-magic-battle/.test(url))).toEqual([]);
  writeFileSync(`${evidence}/battle-${info.project.name}.json`, JSON.stringify({ verdict: "PASS", input: info.project.name === "touch" ? "touch" : "mouse and keyboard", route, records, elapsedWallSeconds: Math.round((Date.now()-started)/1000), errors: runtime.errors, stateInjection: false, timeAcceleration: false }, null, 2));
});

test("checkpoint refresh rolls back the whole unfinished wave, then preserves new boundary", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop"); const runtime=observe(page);
  await open(page); await expect.poll(() => page.locator(".td-game").getAttribute("data-kills"), {timeout:60_000}).not.toBe("0");
  await page.locator("[data-td-pause]").click();
  const inventoryAfterDrop=await inventory(page); expect(inventoryAfterDrop.length).toBeGreaterThan(6);
  await page.reload(); await expect(page.locator(".td-game")).toHaveAttribute("data-phase", "ready");
  expect(await inventory(page)).toHaveLength(6); await expect(page.locator(".td-game")).toHaveAttribute("data-kills", "0");
  await page.locator("[data-td-next]").click(); await expect.poll(() => page.locator(".td-game").getAttribute("data-kills"), {timeout:60_000}).not.toBe("0");
  await page.locator("[data-td-pause]").click(); expect(await inventory(page)).toHaveLength(inventoryAfterDrop.length);
  const before=await page.locator(".td-game").getAttribute("data-kills"); await page.waitForTimeout(1200); expect(await page.locator(".td-game").getAttribute("data-kills")).toBe(before);
  expect(runtime.errors).toEqual([]);
});

test("unprotected gate can lose, recycle has no full-health cost, retry keeps recipes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop"); await open(page); await page.locator("[data-td-pause]").click();
  await page.locator('[data-core="2"]').click(); await page.locator('[data-slot="0"]').click(); await page.locator("[data-td-fuse]").click();
  await page.locator('[data-slot="0"]').click(); await page.locator("[data-td-stow]").click();
  await page.locator('[data-core]').first().click(); await expect(page.locator("[data-td-recycle]")).toBeDisabled();
  await page.locator("[data-td-clear]").click(); await page.locator("[data-td-pause]").click();
  for(let wave=0;wave<2;wave++) {
    await expect.poll(() => page.locator(".td-game").getAttribute("data-phase"),{timeout:130_000,intervals:[1000]}).not.toBe("battle");
    if(await page.locator(".td-game").getAttribute("data-phase")==="lost")break;
    await page.locator("[data-td-next]").click();
  }
  await expect(page.locator(".td-game")).toHaveAttribute("data-phase","lost");
  await page.locator("[data-td-replay]").click(); await expect(page.locator("[data-td-health]")).toHaveText("16");
  expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY)).unlocked).toContain("fire-fire");
});

import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "../../../games/hanzi-tower-defense/save";
const evidence=process.env.TD_EVIDENCE_DIR ?? "tmp/tasks/GAME-CODEX-STEP1-HOTFIX";

test("readable targets, correct structure, click/drag alternatives, mute and reduced motion",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const qa={oscillators:0,contexts:[] as AudioContext[]};
    (window as unknown as {audioQa:typeof qa}).audioQa=qa;
    const Original=window.AudioContext;
    window.AudioContext=class extends Original {constructor(options?:AudioContextOptions){super(options);qa.contexts.push(this);}createOscillator(){qa.oscillators++;return super.createOscillator();}};
  });
  await page.goto("/?play=hanzi-tower-defense");
  await expect(page.locator("[data-td-canvas]")).toHaveAttribute("data-ready","true");
  await page.locator("[data-td-pause]").click();
  mkdirSync(evidence,{recursive:true});const geometry=[];
  for(const size of (info.project.name==="touch"?[{width:360,height:800},{width:390,height:844}]:[{width:1440,height:1000},{width:768,height:1024},{width:720,height:500}])){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const targets=await page.locator('[data-slot], [data-core]').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute("aria-label"),width:r.width,height:r.height};}));
    expect(targets.every(t=>t.width>=44&&t.height>=44)).toBe(true); geometry.push({size,targets});
  }
  await page.setViewportSize(info.project.name==="touch"?{width:390,height:844}:{width:1440,height:1000});
  const act=async(selector:string)=>{const node=page.locator(selector);await node.scrollIntoViewIfNeeded();if(info.project.name==="touch")await node.tap();else await node.click();};
  // Invalid selection is reversible and consumes nothing.
  await act('[data-core="2"]');await act('[data-core="3"]');await expect(page.locator('[data-td-fuse]')).toBeDisabled();await expect(page.locator('[data-core]')).toHaveCount(5);await act('[data-td-clear]');
  if(info.project.name==="desktop")await page.locator('[data-core="3"]').dragTo(page.locator('[data-slot="1"]'));
  else{await act('[data-core="3"]');await act('[data-slot="1"]');}
  await expect(page.locator('[data-slot="1"]')).toContainText("木");await act('[data-slot="1"]');await act('[data-td-stow]');await expect(page.locator('[data-slot="1"]')).toContainText("＋");
  // The same complete character is shown after its components meet in real structural positions.
  await act('[data-core="2"]');await act('[data-slot="0"]');await expect(page.locator('[data-structure="top-bottom"]')).toBeVisible();
  await page.screenshot({path:`${evidence}/structure-${info.project.name}.png`,fullPage:true});await act('[data-td-fuse]');await expect(page.locator('[data-slot="0"]')).toContainText("炎");
  await act('[data-core="6"]');await act('[data-core="3"]');await expect(page.locator('[data-td-fuse]')).toBeDisabled();await act('[data-td-clear]');
  await act('[data-core="3"]');await act('[data-core="4"]');await expect(page.locator('[data-structure="left-right"]')).toBeVisible();await act('[data-td-fuse]');
  const grove=page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^林$/})});
  await act(await grove.evaluate(e=>`[data-core="${e.getAttribute('data-core')}"]`));await act('[data-core="6"]');await expect(page.locator('[data-td-fuse]')).toBeEnabled();await expect(page.locator('[data-structure="word"] b')).toHaveText(['山','林']);await expect(page.locator('[data-td-preview]')).toContainText("山林");await act('[data-td-fuse]');
  const audible=await page.evaluate(()=>(window as unknown as {audioQa:{oscillators:number}}).audioQa.oscillators);expect(audible).toBeGreaterThan(0);
  await act('[data-td-mute]');await expect(page.locator('[data-td-mute]')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioQa:{contexts:AudioContext[]}}).audioQa.contexts.every(c=>c.state==="suspended"))).toBe(true);
  const muted=await page.evaluate(()=>(window as unknown as {audioQa:{oscillators:number}}).audioQa.oscillators);
  await act('[data-core="5"]');await act('[data-slot="1"]');expect(await page.evaluate(()=>(window as unknown as {audioQa:{oscillators:number}}).audioQa.oscillators)).toBe(muted);
  await act('[data-td-motion]');await expect(page.locator('.td-game')).toHaveAttribute('data-reduced-motion','true');
  await page.reload();await expect(page.locator('[data-td-mute]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.td-game')).toHaveAttribute('data-reduced-motion','true');
  expect(errors).toEqual([]);writeFileSync(`${evidence}/controls-${info.project.name}.json`,JSON.stringify({verdict:'PASS',geometry,oscillatorsBeforeMute:audible,mutedContextSuspended:true,errors},null,2));
});

test("independent memory-card still mounts and preserves its legacy save",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  await page.addInitScript(()=>localStorage.setItem('family-games/memory-card/progress','{"grades":{"p1":{"bestMoves":4,"completions":9}}}'));
  await page.goto('/tests/e2e/fixtures/memory-card.html');await expect(page.getByTestId('memory-match')).toBeVisible();
  const card=page.locator('[data-card-id]').first();await card.focus();await page.keyboard.press('Enter');await expect(card).toHaveAttribute('data-open','true');
  expect(await page.evaluate(()=>localStorage.getItem('family-games/memory-card/progress'))).toBe('{"grades":{"p1":{"bestMoves":4,"completions":9}}}');
});

test("future and corrupt tower saves remain byte-exact while gameplay stays available",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  for(const raw of ['{broken','{"version":99,"future":true}']){
    await page.goto('/');await page.evaluate(([key,value])=>localStorage.setItem(key,value),[SAVE_KEY,raw]);
    await page.goto('/?play=hanzi-tower-defense');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
    await page.locator('[data-td-mute]').click();await expect(page.locator('[data-td-save-note]')).toContainText('原有记录未改动');
    expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(raw);
  }
});

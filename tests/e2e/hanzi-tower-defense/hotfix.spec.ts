import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { CORES, CORE_ORDER, RECIPES, type CoreKind } from "../../../games/hanzi-tower-defense/content";
import { MAP, newBattle, SLOTS, type Core } from "../../../games/hanzi-tower-defense/model";
import { SAVE_KEY } from "../../../games/hanzi-tower-defense/save";

const evidence = process.env.TD_EVIDENCE_DIR ?? "tmp/tasks/GAME-CODEX-STEP1-HOTFIX";
const gameURL = process.env.TD_HOTFIX_URL ?? '/?play=hanzi-tower-defense';
type Item = { id: number; kind: CoreKind; slot: number | null };
async function setup(page: Page, items: Item[], wave = 0) {
  await page.goto(new URL('.', new URL(gameURL, page.url().startsWith('http') ? page.url() : 'http://127.0.0.1:5299')).href);
  const checkpoint = newBattle().checkpoint;
  checkpoint.cores = items.map(c => ({ ...c, cooldown: 0 })); checkpoint.nextCoreId = Math.max(...items.map(c => c.id)) + 1; checkpoint.wave = wave;
  await page.evaluate(({ checkpoint, key }) => localStorage.setItem(key, JSON.stringify({ version: 2, checkpoint, unlocked: [], preferences: { muted: true, reducedMotion: true } })), { checkpoint, key: SAVE_KEY });
  await page.goto(gameURL); await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.td-game')).toHaveAttribute('data-phase', wave === 6 ? 'won' : 'ready');
}
const selector = (c: Item) => c.slot === null ? `[data-core="${c.id}"]` : `[data-slot="${c.slot}"]`;
async function activate(page: Page, selector: string, input: string) {
  const item = page.locator(selector); await item.scrollIntoViewIfNeeded();
  if (input === 'touch') await item.tap();
  else if (input === 'keyboard') { await item.focus(); await page.keyboard.press('Enter'); }
  else await item.click();
}
async function savedCores(page: Page): Promise<Core[]> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).checkpoint.cores, SAVE_KEY); }
async function screenRange(page: Page, kind: CoreKind, slot: number, mode = 'inspect') {
  const circle = page.locator(`[data-range-mode="${mode}"]`); await expect(circle).toHaveCount(1);
  const geometry = await circle.evaluate((node) => {
    const c = node as SVGCircleElement, matrix = c.getScreenCTM()!, bounds = c.ownerSVGElement!.getBoundingClientRect();
    const center = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(matrix);
    const edgeX = new DOMPoint(c.cx.baseVal.value + c.r.baseVal.value, c.cy.baseVal.value).matrixTransform(matrix);
    const edgeY = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value + c.r.baseVal.value).matrixTransform(matrix);
    const target = document.querySelector(`[data-slot="${c.dataset.rangeSlot}"]`)!, targetBounds = target.getBoundingClientRect();
    const hit = document.elementFromPoint(targetBounds.x + targetBounds.width / 2, targetBounds.y + targetBounds.height / 2);
    return { devicePixelRatio, cx: c.cx.baseVal.value, cy: c.cy.baseVal.value, r: c.r.baseVal.value, x: center.x, y: center.y, rx: edgeX.x-center.x, ry: edgeY.y-center.y,
      rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, matrix: { a: matrix.a, d: matrix.d, e: matrix.e, f: matrix.f },
      tower: { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 }, pointerEvents: getComputedStyle(c).pointerEvents,
      hit: !!hit && target.contains(hit), canvas: (() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; })() };
  });
  expect(geometry.cx).toBe(SLOTS[slot].x); expect(geometry.cy).toBe(SLOTS[slot].y); expect(geometry.r).toBe(CORES[kind].range);
  expect(Math.abs(geometry.x-geometry.tower.x)).toBeLessThan(.6); expect(Math.abs(geometry.y-geometry.tower.y)).toBeLessThan(.6);
  expect(Math.abs(geometry.rx-CORES[kind].range*geometry.rect.width/MAP.width)).toBeLessThan(.1);
  expect(Math.abs(geometry.ry-CORES[kind].range*geometry.rect.height/MAP.height)).toBeLessThan(.1);
  for (const key of ['x','y','width','height'] as const) expect(Math.abs(geometry.canvas[key]-geometry.rect[key])).toBeLessThan(1.1);
  expect(geometry.pointerEvents).toBe('none'); expect(geometry.hit).toBe(true);
  await expect(page.locator('[data-td-range-caption]')).toContainText(`${CORES[kind].glyph} · 攻击范围`);
  return geometry;
}

test.describe('unordered recipe entity matrix', () => {
test.describe.configure({ mode: 'parallel' });
for (const recipe of RECIPES) test(`${recipe.id} uses ordinary selection and explicit source destinations`, async ({ page }, info) => {
  mkdirSync(evidence, { recursive: true }); const rows: unknown[] = [], errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const placements = info.project.name === 'touch' ? [[null,0],[0,1]] as const : [[null,null],[null,0],[0,null],[0,1]] as const;
  for (const reverse of info.project.name === 'touch' ? [true] : [false,true]) for (const slots of placements) {
    const a: Item = { id:11,kind:recipe.inputs[0],slot:slots[0] }, b: Item = { id:12,kind:recipe.inputs[1],slot:slots[1] }, third: Item = { id:13,kind:'water',slot:7 };
    await setup(page,[a,b,third]); const before = await savedCores(page), pair = reverse ? [b,a] : [a,b];
    const input = info.project.name === 'touch' ? 'touch' : recipe.id === 'water-wood' && !reverse ? 'keyboard' : 'mouse';
    for (const c of pair) await activate(page,selector(c),input);
    await expect(page.locator('[data-structure] b')).toHaveText(CORES[recipe.result].components);
    await expect(page.locator('[data-td-fuse]')).toBeEnabled(); expect(await savedCores(page)).toEqual(before);
    let target = pair.find(c=>c.slot!==null)?.slot ?? null;
    if (a.slot !== null && b.slot !== null) { target = pair[1].slot; await activate(page,`[data-fusion-target="${target}"]`,input); await expect(page.locator('[data-td-target]')).toContainText(`释放塔位 ${pair[0].slot!+1}`); }
    const critical: unknown[] = [];
    for(const control of ['[data-td-clear]','[data-td-fuse]',...(a.slot!==null&&b.slot!==null?['[data-fusion-target="0"]','[data-fusion-target="1"]']:[])]) {
      await page.locator(control).scrollIntoViewIfNeeded(); const box=await page.locator(control).evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,hits:[.25,.5,.75].map(t=>e.contains(document.elementFromPoint(r.x+r.width*t,r.y+r.height/2)))};});
      expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.hits).toEqual([true,true,true]);critical.push({control,...box});
    }
    const rectangles=await page.locator('[data-td-clear], [data-td-fuse], [data-fusion-target]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){const a=rectangles[i],b=rectangles[j];expect(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top).toBe(true);}
    await expect(page.locator('[data-td-target]')).toContainText(target === null ? '产物放入材料栏' : `保留塔位 ${target+1}`);
    if (reverse && recipe.inputs[0] !== recipe.inputs[1] && slots[0] === null && slots[1] === null) await page.screenshot({path:`${evidence}/reverse-${recipe.result}.png`,fullPage:true});
    if(input==='mouse') await page.locator('[data-td-fuse]').dblclick(); else await activate(page,'[data-td-fuse]',input);
    const after = await savedCores(page); expect(after).toEqual([{...third,cooldown:0},{id:14,kind:recipe.result,slot:target,cooldown:0}]);
    await expect(page.locator('[data-td-fuse]')).toBeDisabled();
    // Two further ordinary keyboard confirmations must not duplicate output or spend a third core.
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); expect(await savedCores(page)).toEqual(after);
    let range: unknown; if (target !== null) { await page.locator(`[data-slot="${target}"]`).scrollIntoViewIfNeeded(); range=await screenRange(page,recipe.result,target); }
    rows.push({recipe:recipe.id,reverse,slots,target,input,before,after,critical,range});
  }
  expect(errors).toEqual([]); writeFileSync(`${evidence}/recipes-${recipe.id}-${info.project.name}.json`,JSON.stringify({rows,errors},null,2));
});
});

test('a fresh result combines directly with its highlighted partner and unrelated materials start a new pair', async ({ page }, info) => {
  const input=info.project.name;
  await setup(page,[{id:1,kind:'wood',slot:null},{id:2,kind:'wood',slot:null},{id:3,kind:'mountain',slot:null},{id:4,kind:'water',slot:0}]);
  await activate(page,'[data-core="1"]',input);await activate(page,'[data-core="2"]',input);await activate(page,'[data-td-fuse]',input);
  await expect(page.locator('[data-core="5"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-core="3"]')).toHaveClass(/td-partner/);
  await activate(page,'[data-core="3"]',input);await expect(page.locator('[data-structure] b')).toHaveText(['山','林']);
  await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(2);await activate(page,'[data-td-fuse]',input);
  expect(await savedCores(page)).toEqual([{id:4,kind:'water',slot:0,cooldown:0},{id:6,kind:'wildwood',slot:null,cooldown:0}]);
  await activate(page,'[data-slot="0"]',input);await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(1);
  await expect(page.locator('[data-td-selection]')).toContainText('氵');await expect(page.locator('[data-td-fuse]')).toBeDisabled();
});

test('invalid pairs, missing materials, cancellation, replacement and duplicate ID never consume', async ({ page }, info) => {
  const input = info.project.name; const items: Item[] = [{id:1,kind:'water',slot:null},{id:2,kind:'mountain',slot:0},{id:3,kind:'wood',slot:null}];
  await setup(page,items); const before = await savedCores(page);
  await activate(page,'[data-core="1"]',input); await expect(page.locator('[data-core="3"]')).toHaveClass(/td-partner/);
  await activate(page,'[data-slot="0"]',input); await expect(page.locator('[data-td-fuse]')).toHaveText('暂无配方'); await expect(page.locator('[data-td-preview]')).toContainText('换搭档'); expect(await savedCores(page)).toEqual(before);
  await activate(page,'[data-core="3"]',input); await expect(page.locator('[data-td-preview]')).toContainText('沐');
  await activate(page,'[data-slot="2"]',input); await expect(page.locator('[data-td-feedback]')).toContainText('选了两枚'); expect(await savedCores(page)).toEqual(before);
  await activate(page,'[data-td-clear]',input); await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(0); await expect(page.locator('[data-range-mode="inspect"]')).toHaveCount(0);
  await activate(page,'[data-core="3"]',input); await expect(page.locator('[data-td-partners]')).toContainText('还缺 木');
  await activate(page,'[data-core="3"]',input); await expect(page.locator('[data-td-fuse]')).toBeDisabled(); expect(await savedCores(page)).toEqual(before);
  await activate(page,'[data-slot="0"]',input); await expect(page.locator('[data-td-partners]')).toContainText('还缺 火'); await expect(page.locator('[data-td-partners]')).toContainText('还缺 林');
  await page.keyboard.press('Escape'); await expect(page.locator('[data-range-mode="inspect"]')).toHaveCount(0); expect(await savedCores(page)).toEqual(before);
});

test('desktop dragging to occupied towers prepares exactly source and landing target; empty slot previews then deploys', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await setup(page,[{id:1,kind:'fire',slot:0},{id:2,kind:'mountain',slot:null},{id:3,kind:'wood',slot:1},{id:4,kind:'water',slot:null}]);
  await page.locator('[data-core="4"]').click(); await page.locator('[data-slot="1"]').click();
  const before = await savedCores(page);
  await page.locator('[data-core="2"]').dragTo(page.locator('[data-slot="0"]'));
  await expect(page.locator('[data-td-selection]')).toContainText('山'); await expect(page.locator('[data-structure] b')).toHaveText(['火','山']);
  await expect(page.locator('[data-td-target]')).toContainText('保留塔位 1'); expect(await savedCores(page)).toEqual(before);
  await page.locator('[data-td-clear]').click(); expect(await savedCores(page)).toEqual(before);
  await page.locator('[data-core="2"]').dragTo(page.locator('[data-slot="0"]')); await page.locator('[data-td-fuse]').click();
  await expect(page.locator('[data-slot="0"]')).toContainText('火山'); expect((await savedCores(page)).map(c=>c.id).sort()).toEqual([3,4,5]);
  // Towers are draggable too; reversing wood + water still previews canonical 沐 at the landing tower.
  const source=await page.locator('[data-core="4"]').boundingBox(), empty=await page.locator('[data-slot="2"]').boundingBox();
  await page.mouse.move(source!.x+source!.width/2,source!.y+source!.height/2); await page.mouse.down();
  await page.mouse.move(source!.x+source!.width/2+10,source!.y+source!.height/2,{steps:4});
  await page.mouse.move(empty!.x+empty!.width/2,empty!.y+empty!.height/2,{steps:10}); await page.mouse.move(empty!.x+empty!.width/2+1,empty!.y+empty!.height/2);
  await screenRange(page,'water',2,'preview'); await expect(page.locator('[data-slot="2"]')).toContainText('＋');
  await page.mouse.up(); await screenRange(page,'water',2);
  await page.locator('[data-slot="1"]').dragTo(page.locator('[data-slot="2"]')); await expect(page.locator('[data-td-target]')).toContainText('保留塔位 3，释放塔位 2');
  await page.locator('[data-td-fuse]').click(); await screenRange(page,'wash',2); await expect(page.locator('[data-slot="1"]')).toContainText('＋');
  // Moving has no extra confirmation and updates the inspected center.
  await page.locator('[data-slot="2"]').dragTo(page.locator('[data-slot="3"]')); await screenRange(page,'wash',3);
  await expect(page.locator('[data-slot="2"]')).toContainText('＋');
});

test('range inspection is independent of bag selection and lifecycle, with empty-slot previews', async ({page},info) => {
  await setup(page,[{id:1,kind:'fire',slot:0},{id:2,kind:'wood',slot:null},{id:3,kind:'water',slot:3},{id:4,kind:'mountain',slot:null}]);
  const input = info.project.name; await activate(page,'[data-core="2"]',input); const before=await savedCores(page);
  if(input==='desktop') {
    await page.locator('[data-slot="3"]').hover(); await screenRange(page,'water',3); await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(1);
    // A parked pointer must not override the later keyboard inspection.
    await page.locator('[data-slot="0"]').focus(); await screenRange(page,'fire',0); await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(1);
    await page.keyboard.press('Tab'); await expect(page.locator('[data-slot="1"]')).toBeFocused(); await screenRange(page,'wood',1,'preview'); expect(await savedCores(page)).toEqual(before);
    await page.locator('[data-slot="1"]').hover(); await screenRange(page,'wood',1,'preview');
    await page.screenshot({path:`${evidence}/deployment-preview.png`,fullPage:true});
  }
  await activate(page,'[data-slot="3"]',input); await screenRange(page,'water',3); await expect(page.locator('[data-structure] b')).toHaveText(['氵','木']);
  await activate(page,'[data-td-fuse]',input); await page.locator('[data-slot="3"]').scrollIntoViewIfNeeded(); await screenRange(page,'wash',3);
  await activate(page,'[data-slot="3"]',input); await screenRange(page,'wash',3); await activate(page,'[data-slot="3"]',input); await screenRange(page,'wash',3);
  await activate(page,'[data-core="4"]',input); await activate(page,'[data-slot="1"]',input); await screenRange(page,'mountain',1); expect((await savedCores(page)).find(c=>c.id===4)?.slot).toBe(1);
  await activate(page,'[data-slot="1"]',input); await activate(page,'[data-td-stow]',input); await expect(page.locator('[data-range-mode="inspect"]')).toHaveCount(0);
  await activate(page,'[data-td-all-ranges]',input); await expect(page.locator('[data-range-mode="all"]')).toHaveCount(2); const saveBeforeToggle=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
  if(input==='desktop') {
    await page.locator('[data-slot="3"]').click(); await page.locator('[data-slot="2"]').hover(); await screenRange(page,'wash',2,'preview');
    await expect(page.locator('[data-range-mode="all"][data-range-slot="3"]')).toHaveCount(1);
    expect(await savedCores(page)).toEqual(JSON.parse(saveBeforeToggle!).checkpoint.cores);
  }
  await activate(page,'[data-td-all-ranges]',input); expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(saveBeforeToggle);
  await activate(page,'[data-td-restart]',input); await activate(page,'[data-td-confirm-restart]',input); await expect(page.locator('[data-range-mode="inspect"]')).toHaveCount(0);
  await page.reload(); await expect(page.locator('[data-td-all-ranges]')).toHaveAttribute('aria-pressed','false');
});

test('unpaused battle keeps synthesis, live drops and ranges together without state injection or acceleration',async({page},info)=>{
  test.skip(info.project.name!=='desktop'); mkdirSync(evidence,{recursive:true}); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(gameURL);await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
  await page.locator('[data-td-mute]').click(); await page.locator('[data-td-motion]').click();
  await page.locator('[data-core="3"]').click(); await page.locator('[data-slot="0"]').hover(); await screenRange(page,'fire',0);
  await page.locator('[data-td-all-ranges]').click(); await expect(page.locator('[data-td-selection] .has-core')).toHaveCount(1);
  await expect.poll(()=>page.locator('.td-game').getAttribute('data-kills'),{timeout:60000,intervals:[100]}).not.toBe('0');
  await expect(page.locator('[data-td-selection]')).toContainText('木'); await expect(page.locator('[data-core]')).toHaveCount(6);
  await page.locator('[data-core="5"]').click();await expect(page.locator('[data-structure] b')).toHaveText(['氵','木']);await page.locator('[data-td-fuse]').click();
  const product=page.locator('[data-core]').filter({has:page.locator('strong',{hasText:/^沐$/})});await expect(product).toHaveCount(1);const productId=await product.getAttribute('data-core');
  await expect(page.locator('[data-core="3"], [data-core="5"]')).toHaveCount(0);await expect(page.locator('[data-slot="0"]')).toContainText('火');
  await page.locator('[data-slot="3"]').click();await screenRange(page,'wash',3);await expect(page.locator('.td-game')).toHaveAttribute('data-paused','false');
  await expect.poll(async()=>Number(await page.locator('.td-game').getAttribute('data-kills')),{timeout:60000,intervals:[100]}).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-range-mode="inspect"][data-range-kind="wash"]')).toHaveCount(1);await expect(page.locator('[data-range-mode="all"]')).toHaveCount(1);
  await page.screenshot({path:`${evidence}/live-drops-fusion-range.png`,fullPage:true});
  expect(errors).toEqual([]);writeFileSync(`${evidence}/live-battle.json`,JSON.stringify({phase:await page.locator('.td-game').getAttribute('data-phase'),kills:await page.locator('.td-game').getAttribute('data-kills'),productId,errors,stateInjection:false,timeAcceleration:false},null,2));
});

test('all nine ranges align with real slots, canvas and screen transform at compact/tablet/desktop/zoom',async({page},info)=>{
  test.skip(info.project.name !== 'desktop'); mkdirSync(evidence,{recursive:true}); const rows:unknown[]=[];
  for(const size of [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]) {
    await page.setViewportSize(size);
    await setup(page,CORE_ORDER.map((kind,i)=>({id:i+1,kind,slot:i<8?i:null})));
    await expect(page.locator('[data-td-all-ranges]')).toHaveAttribute('aria-pressed','false'); await page.locator('[data-td-all-ranges]').click(); await expect(page.locator('[data-range-mode="all"]')).toHaveCount(8);
    for(let i=0;i<8;i++) {
      await page.locator(`[data-slot="${i}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-slot="${i}"]`).hover();
      rows.push({size,kind:CORE_ORDER[i],slot:i,geometry:await screenRange(page,CORE_ORDER[i],i)}); await expect(page.locator('[data-range-mode="all"]')).toHaveCount(7);
    }
    await page.locator('[data-slot="7"]').click(); await page.locator('[data-td-stow]').click(); await page.locator('[data-core="9"]').click(); await page.locator('[data-slot="7"]').click(); await screenRange(page,'wildwood',7);
    // Central and edge placements, using only ordinary move operations after fixture initialization.
    await page.locator('[data-slot="3"]').click(); await page.locator('[data-td-stow]').click(); await page.locator('[data-slot="7"]').click(); await page.locator('[data-slot="3"]').click(); await screenRange(page,'wildwood',3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:`${evidence}/ranges-${size.width}.png`,fullPage:true});
    if(size.width===1440) {
      await page.evaluate(()=>{document.body.style.zoom='1.25';}); await page.locator('[data-slot="3"]').scrollIntoViewIfNeeded();
      await expect.poll(async()=>{const c=await page.locator('canvas').boundingBox(),b=await page.locator('[data-td-ranges]').boundingBox();return Math.abs(c!.width-b!.width);}).toBeLessThan(1.1);
      rows.push({zoom:1.25,geometry:await screenRange(page,'wildwood',3)});
      await page.screenshot({path:`${evidence}/ranges-zoom.png`,fullPage:true}); await page.evaluate(()=>{document.body.style.zoom='';});
    }
  }
  writeFileSync(`${evidence}/range-geometry.json`,JSON.stringify(rows,null,2));
});

test('result overlay, full-page capture and replay never allocate an empty framebuffer',async({page},info)=>{
  mkdirSync(evidence,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // This synthetic completed checkpoint tests only the modal/resize lifecycle; full battles are separate.
  await setup(page,[{id:1,kind:'fire',slot:0},{id:2,kind:'wood',slot:null}],6);
  await expect(page.locator('[data-td-result]')).toBeVisible();await page.screenshot({path:`${evidence}/modal-resize-${info.project.name}.png`,fullPage:true});
  await activate(page,'[data-td-replay]',info.project.name);await expect(page.locator('.td-game')).toHaveAttribute('data-wave','0');
  await page.screenshot({path:`${evidence}/replay-resize-${info.project.name}.png`,fullPage:true});
  await expect.poll(()=>page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.width>0&&c.height>0&&Math.abs(c.width-c.clientWidth)<=1&&Math.abs(c.height-c.clientHeight)<=1)).toBe(true);
  await activate(page,'[data-td-pause]',info.project.name);await activate(page,'[data-slot="0"]',info.project.name);await screenRange(page,'fire',0);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { activate, criticalTargets, fromHome, keyReach, type InputMode } from './input-helpers';
const evidence='tmp/tasks/GAME-CODEX-STEP4/input';
test.beforeEach(async ({page}, info)=>{
  const errors:string[]=[]; const external:string[]=[];
  const base = new URL(String(info.project.use.baseURL));
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==base.origin)external.push(url.href);});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  (page as unknown as {step4Errors:unknown}).step4Errors={errors,external};
});
test.afterEach(async ({page})=>{
  const result=(page as unknown as {step4Errors:{errors:string[];external:string[]}}).step4Errors;
  expect(result.errors,'runtime errors').toEqual([]);expect(result.external,'external runtime requests').toEqual([]);
});
for (const mode of ['keyboard','mouse','touch'] as const) {
  test(`@primary ${mode} home → new adventure light loop and defense deployment → return`,async({page},info)=>{
    test.skip(mode==='touch' ? !['phone-390','webkit'].includes(info.project.name) : !(mode==='keyboard'?['desktop','firefox','webkit']:['desktop','firefox']).includes(info.project.name));
    await fromHome(page,mode,'adventure');
    await activate(page,'[data-hway-new]',mode); await activate(page,'[data-hway-chapter="lamplight"]',mode);
    await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');
    if(mode==='keyboard') {
      await keyReach(page,'[data-hway-grid]');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Space');
      await expect(page.locator('[data-hway-hand]')).toHaveText('日');
      await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
      await page.keyboard.press('ArrowRight');await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
      await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('c');
    } else {
      const start=Number(await page.locator('.hway').getAttribute('data-player'));
      await activate(page,`[data-hway-cell="${start+1}"]`,mode);await activate(page,'[data-hway-action="take"]',mode);
      await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
      await activate(page,'[data-hway-move="right"]',mode);
      await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
      await activate(page,`[data-hway-cell="${start+2}"]`,mode);await activate(page,'[data-hway-action="combine"]',mode);
    }
    await expect(page.locator('[data-hway-hand]')).toHaveText('明');
    await expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
    await activate(page,'[data-hway-undo]',mode);await expect(page.locator('[data-hway-hand]')).toHaveText('日');
    await activate(page,'[data-hway-hint]',mode);await expect(page.locator('[data-hway-hint-box]')).toBeVisible();
    await activate(page,'[data-hway-hint-close]',mode);await expect(page.locator('[data-hway-hint]')).toBeFocused();await activate(page,'[data-hway-exit]',mode);
    await expect(page.getByTestId('my-game-world')).toBeVisible();
    await activate(page,'[data-world-forest-link]',mode);await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
    await activate(page,'[data-td-new]',mode);await activate(page,'[data-map-select="twin-bends"]',mode);
    await activate(page,'[data-core="3"]',mode,'[data-core]');await activate(page,'[data-slot="1"]',mode,'[data-slot]');
    await expect(page.locator('[data-slot="1"]')).toContainText('木');
    await activate(page,'[data-td-clear]',mode);await activate(page,'[data-slot="1"]',mode,'[data-slot]');await activate(page,'[data-td-stow]',mode);
    await expect(page.locator('[data-core="3"]')).toBeVisible();
    await activate(page,'[data-td-next]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-phase','battle');
    await expect.poll(()=>page.locator('.td-game').getAttribute('data-kills'),{timeout:45_000}).not.toBe('0');
    await activate(page,'[data-td-pause]',mode);await expect(page.locator('.td-game')).toHaveAttribute('data-paused','true');
    await activate(page,'.td-help summary',mode);await expect(page.locator('.td-help')).toContainText('Tab');
    await activate(page,'[data-td-restart]',mode);await activate(page,'[data-td-cancel-restart]',mode);
    await activate(page,'[data-td-home]',mode);await expect(page.getByTestId('my-game-world')).toBeVisible();
  });
  test(`@primary ${mode} home → both math loops → return`,async({page},info)=>{
    test.skip(mode==='touch' ? !['phone-390','webkit'].includes(info.project.name) : !(mode==='keyboard'?['desktop','firefox','webkit']:['desktop','firefox']).includes(info.project.name));
    await fromHome(page,mode,'math');
    await activate(page,'[data-station-id="slider"] button',mode);
    await expect(page.locator('[data-equation-board]')).toBeVisible();
    const count=page.locator('[data-move-count]');
    const firstRail='[data-reel-window]:first-of-type';
    if(mode==='keyboard') {
      await keyReach(page,firstRail); await page.keyboard.press('ArrowUp');
      await expect(count).toHaveText('1');
      await page.keyboard.down('ArrowDown'); await page.keyboard.down('ArrowDown'); await page.keyboard.up('ArrowDown');
      await expect(count).toHaveText('2');
    } else {
      await activate(page,'[data-control-direction="up"]',mode); await expect(count).toHaveText('1');
      await activate(page,'[data-control-direction="down"]',mode); await expect(count).toHaveText('2');
    }
    await activate(page,'.equation-slider__actions button:nth-child(1)',mode); await expect(count).toHaveText('1');
    await activate(page,'.equation-slider__actions button:nth-child(2)',mode);
    await expect(page.locator('.equation-slider__hint')).toBeVisible();
    await activate(page,'.equation-slider__input-help summary',mode);
    await expect(page.locator('.equation-slider__input-help')).toContainText('↑ 选上格');
    await activate(page,'[data-return-map]',mode);
    await activate(page,'[data-station-id="target"] button',mode);
    await expect(page.getByTestId('target-cards').locator('button')).toHaveCount(4);
    const cardRegion='[data-card-id]',operatorRegion='[data-target-action^="operator-"]';
    const card=(id:string)=>`[data-card-id="target-10-01-${id}"]`;
    // Ordered subtraction: 1-2 is invalid; swapping operands produces 2-1.
    await activate(page,card('source-1'),mode,cardRegion);
    await activate(page,card('source-2'),mode,cardRegion);
    await activate(page,'[data-target-action="operator--"]',mode,operatorRegion);
    await expect(page.locator('[data-target-action="combine"]')).toBeDisabled();
    await activate(page,'[data-target-action="swap"]',mode);
    await expect(page.locator('[data-target-action="combine"]')).toBeEnabled();
    await activate(page,'[data-target-action="combine"]',mode);
    await expect(page.locator('[data-card-id="target-10-01-combined-1"]')).toHaveAttribute('data-card-value','1');
    await activate(page,'[data-target-action="undo"]',mode);
    // Original four cards, original + semantics; complete using only this input.
    for(const [a,b] of [['source-1','source-2'],['source-3','source-4'],['combined-1','combined-2']]) {
      await activate(page,card(a),mode,cardRegion); await activate(page,card(b),mode,cardRegion);
      await activate(page,'[data-target-action="operator-+"]',mode,operatorRegion);
      await activate(page,'[data-target-action="combine"]',mode);
    }
    await expect(page.getByTestId('target-completion')).toBeVisible();
    await activate(page,'[data-target-action="undo"]',mode); await activate(page,'[data-target-action="hint"]',mode);
    await expect(page.locator('#target-hint')).toBeVisible();
    await activate(page,'[data-return-map]',mode); await activate(page,'.math-world__header a',mode);
    await expect(page.getByTestId('my-game-world')).toBeVisible();
  });
  test(`@primary ${mode} home → independent pairing → full grid and restart`,async({page},info)=>{
    test.skip(mode==='touch' ? !['phone-390','webkit'].includes(info.project.name) : !(mode==='keyboard'?['desktop','firefox','webkit']:['desktop','firefox']).includes(info.project.name));
    await fromHome(page,mode,'playtest'); await activate(page,'a[href="?play=memory-card"]',mode);
    await expect(page.getByTestId('memory-match')).toBeVisible();
    const cards=await page.locator('[data-card-id]').evaluateAll(cards=>cards.map(card=>({id:card.getAttribute('data-card-id')!,relation:card.getAttribute('data-relation-id')!})));
    const relations=[...new Set(cards.map(card=>card.relation))];
    // Non-matching first attempt tests recovery and retains the full grid's spatial positions.
    const a=cards[0],b=cards.find(card=>card.relation!==a.relation)!;
    await activate(page,`[data-card-id="${a.id}"]`,mode,'[data-card-id]');
    await activate(page,`[data-card-id="${b.id}"]`,mode,'[data-card-id]');
    await expect(page.locator(`[data-card-id="${a.id}"]`)).toHaveAttribute('data-open','false');
    for(const relation of relations) for(const card of cards.filter(card=>card.relation===relation)) await activate(page,`[data-card-id="${card.id}"]`,mode,'[data-card-id]');
    await expect(page.getByTestId('memory-match')).toHaveAttribute('data-complete','true');
    await activate(page,'[data-action="restart"]',mode); await expect(page.getByTestId('memory-match')).toHaveAttribute('data-complete','false');
    await activate(page,'.memory-match__help summary',mode);
    await activate(page,'.memory-match header a',mode); await activate(page,'.classic-hub-world-nav a',mode);
    await expect(page.getByTestId('my-game-world')).toBeVisible();
  });
}

test('@primary keyboard settings / Vault / feedback never capture text as game input',async({page},info)=>{
  test.skip(!['desktop','firefox','webkit'].includes(info.project.name));
  await page.goto('./?world=my-game-world');
  await activate(page,'[data-world-settings-open]','keyboard');
  await activate(page,'[data-world-muted]','keyboard',undefined,'Space');
  await activate(page,'[data-world-vault-open]','keyboard');
  await expect(page.locator('[data-vault-export]')).toBeVisible();
  await keyReach(page,'[data-vault-export]');
  await page.keyboard.press('Escape'); await expect(page.locator('[data-world-settings-open]')).toBeFocused();
  await activate(page,'[data-world-playtest-link]','keyboard');
  await expect(page.getByTestId('step4-playtest')).toBeVisible();
  const key='family-games/step4-playtest/feedback-v1';
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await expect(page.locator('[data-feedback-save]')).toBeDisabled();
  await keyReach(page,'[data-feedback-text]'); await page.keyboard.insertText('wasd xcz 空格 <b>普通文字</b>');
  await page.keyboard.press('Space'); await expect(page.locator('[data-feedback-text]')).toHaveValue('wasd xcz 空格 <b>普通文字</b> ');
  await expect(page.locator('[data-feedback-preview] b')).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await activate(page,'[data-feedback-save]','keyboard');
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!).text).toContain('<b>普通文字</b>');
  const download=page.waitForEvent('download');await activate(page,'[data-feedback-export]','keyboard');
  expect((await download).suggestedFilename()).toBe('game-codex-step4-feedback.md');
  await page.reload();await expect(page.locator('[data-feedback-text]')).toHaveValue('wasd xcz 空格 <b>普通文字</b>');
});

test('@geometry phones/tablets/desktop critical targets and rotated low-height layout',async({page},info)=>{
  test.skip(['firefox','webkit'].includes(info.project.name));
  mkdirSync(evidence,{recursive:true});const rows:unknown[]=[];
  for(const [route,selector] of [['?world=my-game-world','.world-icon-button, .world-more a'],['?playtest=step4','.step4-feedback-actions button'],['?world=math-world&station=target','.target-operators button, .target-actions button'],['?play=hanzi-word-adventure&chapter=lamplight','[data-hway-move], [data-hway-primary], .hway-toolbar button'],['?play=hanzi-tower-defense&map=twin-bends','[data-slot], .td-controls button'],['?play=memory-card','[data-card-id]']]) {
    await page.goto('./'+route);await expect(page.locator(selector).first()).toBeVisible();rows.push({route,geometry:await criticalTargets(page,selector)});
  }
  if(['phone-390','tablet-1024-landscape','desktop'].includes(info.project.name)) await page.screenshot({path:`${evidence}/${info.project.name}-pairing.png`});
  const viewport=page.viewportSize()!;await page.setViewportSize({width:viewport.height,height:viewport.width});
  await criticalTargets(page,'[data-card-id]');
  await page.setViewportSize({width:1024,height:480});await page.goto('./?playtest=step4');await criticalTargets(page,'[data-playtest-entry]');
  writeFileSync(`${evidence}/${info.project.name}-geometry.json`,JSON.stringify(rows,null,2));
});

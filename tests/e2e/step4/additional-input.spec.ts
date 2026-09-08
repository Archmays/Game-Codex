import { expect, test } from '@playwright/test';
import { activate, keyReach } from './input-helpers';

for(const mode of ['mouse','touch'] as const) test(`@supplement ${mode} settings, Vault and Classic filters`,async({page},info)=>{
  test.skip(mode==='mouse'?!['desktop','firefox'].includes(info.project.name):!['phone-390','webkit'].includes(info.project.name));
  await page.goto('./?world=my-game-world');
  await activate(page,'[data-world-settings-open]',mode);
  const muted=page.locator('[data-world-muted]'),before=await muted.isChecked();
  await activate(page,'[data-world-muted]',mode);await expect(muted).toBeChecked({checked:!before});
  await activate(page,'[data-world-vault-open]',mode);await expect(page.getByTestId('save-vault')).toBeVisible();
  const downloaded=page.waitForEvent('download');await activate(page,'[data-vault-export]',mode);expect((await downloaded).suggestedFilename()).toMatch(/\.json$/);
  await activate(page,'[data-world-modal-close]',mode);await expect(page.getByTestId('world-settings')).not.toBeVisible();
  await activate(page,'[data-world-treasure-link]',mode);
  await expect(page.locator('[data-subject-filter]')).not.toHaveCount(0);
  const filters=await page.locator('[data-subject-filter]').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-subject-filter')!));
  for(const subject of filters){await activate(page,`[data-subject-filter="${subject}"]`,mode);await expect(page.locator(`[data-subject-filter="${subject}"]`)).toBeFocused();await expect(page.locator('.game-card').first()).toBeVisible();}
  await activate(page,'.classic-hub-world-nav a',mode);await expect(page.getByTestId('my-game-world')).toBeVisible();
});

test('@supplement tablet switches touch, keyboard and mouse; mismatch timeout preserves newly moved focus',async({page},info)=>{
  test.skip(!['tablet-768','webkit'].includes(info.project.name));
  await page.goto('./?world=math-world&station=slider');
  await activate(page,'[data-control-direction="up"]','touch');await expect(page.locator('[data-move-count]')).toHaveText('1');
  await keyReach(page,'[data-reel-window]');await page.keyboard.press('ArrowDown');await expect(page.locator('[data-move-count]')).toHaveText('2');
  await activate(page,'.equation-slider__actions button:first-child','mouse');await expect(page.locator('[data-move-count]')).toHaveText('1');
  await page.setViewportSize({width:1024,height:768});
  await keyReach(page,'[data-reel-window]');await page.keyboard.press('Control+ArrowDown');await expect(page.locator('[data-move-count]')).toHaveText('1');
  await activate(page,'[data-control-direction="down"]','touch');await expect(page.locator('[data-move-count]')).toHaveText('2');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('./?play=memory-card');await expect(page.getByTestId('memory-match')).toBeVisible();
  const cards=await page.locator('[data-card-id]').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-card-id')!,relation:e.getAttribute('data-relation-id')})));
  const a=cards[0],b=cards.find(c=>c.relation!==a.relation)!;
  await activate(page,`[data-card-id="${a.id}"]`,'touch');await activate(page,`[data-card-id="${b.id}"]`,'touch');
  await keyReach(page,'[data-action="restart"]');
  await expect(page.locator(`[data-card-id="${a.id}"]`)).toHaveAttribute('data-open','false');
  await expect(page.locator('[data-action="restart"]')).toBeFocused();
  await page.keyboard.press('Space');await expect(page.getByTestId('memory-match')).toHaveAttribute('data-complete','false');
  await activate(page,`[data-card-id="${a.id}"]`,'touch');await activate(page,`[data-card-id="${b.id}"]`,'touch');
  // Two real Tab presses leave the card region, pass restart and reach help before the mismatch closes.
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await expect(page.locator('.memory-match__help summary')).toBeFocused();await expect(page.locator('.memory-match__help')).toHaveAttribute('open','');
  await expect(page.locator(`[data-card-id="${a.id}"]`)).toHaveAttribute('data-open','false');
  await expect(page.locator('.memory-match__help summary')).toBeFocused();await expect(page.locator('.memory-match__help')).toHaveAttribute('open','');
});

test('@supplement slider Escape cancels a live drag; pure keys complete and continue with stable focus',async({page},info)=>{
  test.skip(!['desktop','firefox'].includes(info.project.name));
  await page.goto('./?world=math-world&station=slider');await expect(page.locator('[data-equation-board]')).toBeVisible();
  await activate(page,'.equation-slider__coach button','keyboard');await expect(page.locator('[data-reel-window]').first()).toBeFocused();
  const expression=await page.locator('.equation-slider__current-expression').textContent();
  const box=await page.locator('[data-reel-window]').first().boundingBox();expect(box).not.toBeNull();
  const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+55,{steps:3});
  await expect(page.locator('.is-dragging')).toHaveCount(1);await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.locator('.is-dragging')).toHaveCount(0);await expect(page.locator('[data-move-count]')).toHaveText('0');await expect(page.locator('.equation-slider__current-expression')).toHaveText(expression!);
  // Original first level's three correct pairs: 1+5, 2+4, 4+2. No progress or board injection.
  for(const side of ['left','left','right','left','right']){await keyReach(page,`[data-reel-id="es-1-01-${side}"] [data-reel-window]`);await page.keyboard.press('ArrowDown');}
  await expect(page.locator('[data-completion-card]')).toBeVisible();
  await activate(page,'[data-completion-card] button:first-of-type','keyboard');await expect(page.locator('[data-equation-board]')).toHaveAttribute('data-level-id','es-1-02');await expect(page.locator('[data-reel-window]').first()).toBeFocused();
  await activate(page,'button:has-text("关卡列表")','keyboard');await expect(page.locator('button[data-level-id="es-1-02"]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('[data-reel-window]').first()).toBeFocused();
  await activate(page,'button:has-text("关卡列表")','keyboard');await activate(page,'button:has-text("线路地图")','keyboard');await expect(page.locator('[data-chapter-id="chapter-1"]')).toBeFocused();
});

test('@supplement held world keys limit movement and never repeat a take or place',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await page.goto('./?play=hanzi-word-adventure&chapter=lamplight');
  await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');
  const start=Number(await page.locator('.hway').getAttribute('data-player'));
  const raw=()=>page.evaluate(()=>localStorage.getItem('family-games/hanzi-word-adventure/v2'));
  const settled=()=>expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  await keyReach(page,'[data-hway-grid]');await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.down('Space');await settled();await expect(page.locator('[data-hway-hand]')).toHaveText('日');
  const holding=await raw();await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');expect(await raw()).toBe(holding);
  await page.keyboard.press('ArrowRight');await settled();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('c');await settled();await expect(page.locator('[data-hway-hand]')).toHaveText('明');
  await page.keyboard.down('ArrowRight');await expect(page.locator('.hway')).toHaveAttribute('data-player',String(start+2));
  await page.keyboard.down('ArrowRight');await expect(page.locator('.hway')).toHaveAttribute('data-player',String(start+2));
  // This duration is the held-key stimulus: the next OS repeat must arrive beyond the 170 ms movement cadence.
  await page.waitForTimeout(220);await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');await settled();
  await expect(page.locator('.hway')).toHaveAttribute('data-player',String(start+3));
  const stable=await raw();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await raw()).toBe(stable);
  await keyReach(page,'[data-hway-hint]');await page.keyboard.press('z');expect(await raw()).toBe(stable);
});

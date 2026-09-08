import { expect,test } from '@playwright/test';
import {activate,keyReach,fromHome} from './input-helpers';
import {shortClip} from './short-clip';

test('@video ordinary light discovery, world movement, undo and hints',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await fromHome(page,'keyboard','adventure');
  await expect(page.locator('[data-hway-canvas]')).toHaveAttribute('data-ready','true');
  await activate(page,'[data-hway-new]','keyboard');await activate(page,'[data-hway-chapter="lamplight"]','keyboard');
  await keyReach(page,'[data-hway-grid]');
  const finish=await shortClip(page,'tmp/tasks/GAME-CODEX-STEP4/clips/adventure');
  const settle=()=>expect(page.locator('.hway')).toHaveAttribute('data-busy','false');
  await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Space');await settle();await expect(page.locator('[data-hway-hand]')).toHaveText('日');
  await page.keyboard.press('ArrowRight');await settle();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('c');await settle();await expect(page.locator('[data-hway-hand]')).toHaveText('明');
  for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await settle();}
  await page.keyboard.press('z');await settle();
  await activate(page,'[data-hway-hint]','keyboard');await expect(page.locator('[data-hway-hint-box]')).toBeVisible();await activate(page,'[data-hway-hint-close]','keyboard');
  expect(await finish()).toBeGreaterThan(5);
});

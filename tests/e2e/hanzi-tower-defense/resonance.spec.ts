import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP3';

test('first-group natural volcano drop, preview, equipment and real echo without state injection',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const act=async(selector:string)=>{const n=page.locator(selector);await n.scrollIntoViewIfNeeded();if(info.project.name==='touch')await n.tap();else{await n.focus();await page.keyboard.press('Enter');}};
  await page.goto('/?play=hanzi-tower-defense');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');await act('[data-td-pause]');
  await act('[data-core="6"]');await act('[data-slot="0"]');await act('[data-td-fuse]');await expect(page.locator('[data-slot="0"]')).toContainText('火山');
  await act('[data-td-clear]');await act('[data-core="3"]');await act('[data-core="4"]');await act('[data-td-fuse]');await act('[data-slot="1"]');
  await act('[data-core="5"]');await act('[data-slot="3"]');await act('[data-core="2"]');await act('[data-slot="2"]');await act('[data-td-pause]');
  await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready',{timeout:120000});await act('[data-td-next]');
  await expect(page.locator('[data-english="1"]')).toBeVisible({timeout:90000});
  await act('[data-english="1"]');await act('[data-slot="0"]');await expect(page.locator('[data-td-equipment-copy]')).toContainText('回声喷发');await expect(page.locator('[data-td-equip]')).toBeEnabled();
  await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-resonant','false');await act('[data-td-equip]');await expect(page.locator('[data-slot="0"]')).toHaveAttribute('data-resonant','true');
  await page.locator('[data-td-board]').scrollIntoViewIfNeeded();await expect.poll(()=>page.locator('.td-game').getAttribute('data-echoes'),{timeout:30000}).not.toBeNull();
  mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/volcano-loop-${info.project.name}.png`,fullPage:true});
  expect(errors).toEqual([]);writeFileSync(`${evidence}/volcano-loop-${info.project.name}.json`,JSON.stringify({input:info.project.name,stateInjection:false,timeAcceleration:false,naturalGrant:true,echoes:await page.locator('.td-game').getAttribute('data-echoes'),errors},null,2));
});

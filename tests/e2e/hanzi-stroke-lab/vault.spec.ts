import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {route,ready,details} from './helpers';

test('public Vault exports/imports the actual shelf, and an older open shelf cannot overwrite restoration',async({page,context},info)=>{
 test.skip(!['chromium-desktop','chromium-390','webkit-desktop'].includes(info.project.name),'three representative public Vault flows');
 const key='family-games/hanzi-stroke-lab/v1';
 await page.goto(route+'&q=天天');await ready(page);await page.locator('[data-favorite]').first().click();await details(page);await page.locator('[data-grid]').uncheck();await page.locator('[data-close-detail]').click();
 const exported=await page.evaluate(k=>localStorage.getItem(k),key);expect(JSON.parse(exported!)).toEqual({version:1,recent:['天'],favorites:['天'],grid:false});
 await page.locator('[data-hsl-return]').click();await page.getByRole('button',{name:/家长角/}).click();await page.getByRole('button',{name:'打开游戏进度保险箱'}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'备份游戏进度'}).click();const download=await downloadPromise;
 const destination=`tmp/tasks/HSL-MULTICARD/vault-${info.project.name}.json`;await download.saveAs(destination);const backup=await readFile(destination,'utf8');
 const entry=JSON.parse(backup).entries.find((e:{key:string})=>e.key===key);expect(entry.value).toBe(exported);
 const stale=await context.newPage();await stale.goto(new URL(route+'&q=天天',page.url()).href);await ready(stale);await stale.locator('[data-favorite]').first().click();
 const replaced=await stale.evaluate(k=>localStorage.getItem(k),key);expect(replaced).not.toBe(exported);
 await page.locator('[data-vault-file]').setInputFiles({name:'shelf.json',mimeType:'application/json',buffer:Buffer.from(backup)});await expect(page.locator('[data-vault-preview-checksum]')).toHaveText('PASS');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(replaced);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'恢复这些已知进度'}).click();await expect(page.locator('[data-vault-status]')).toContainText('已恢复');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(exported);
 await stale.locator('[data-favorite]').first().click();expect(await stale.evaluate(k=>localStorage.getItem(k),key)).toBe(exported);await expect(stale.locator('[data-storage-status]')).toContainText('刷新');
 await stale.reload();await ready(stale);await expect(stale.locator('[data-favorite]').first()).toHaveAttribute('aria-pressed','true');await details(stale);await expect(stale.locator('[data-grid]')).not.toBeChecked();await stale.close();
});

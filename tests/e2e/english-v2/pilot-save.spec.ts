import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ENGLISH_V2_CONTENT_REVISION, ENGLISH_V2_WORD_BY_ID } from '../../../games/english-spell-battle/v2/content/manifest';
import { ENGLISH_WORLD_SAVE_KEY, LEGACY_ENGLISH_SAVE_KEY, createDefaultEnglishWorldSave, updateEnglishWorldSave } from '../../../games/english-spell-battle/v2/save/save';
import { KNOWN_SAVE_KEYS, EXPORTABLE_SAVE_KEYS, SAVE_VAULT_PRE_IMPORT_BACKUP_KEY } from '../../../packages/data/saveKeyInventory';
import { applyCanonicalPilot } from './pilot-helpers';

const key=ENGLISH_WORLD_SAVE_KEY;
function checksum(value:object){let hash=2166136261;for(const char of JSON.stringify(value))hash=Math.imul(hash^char.codePointAt(0)!,16777619);return(hash>>>0).toString(16).padStart(8,'0');}
function legacyFixture(){const known={version:2,completedStoryWordIds:['word-jump','word-cat'],encounteredOptionalWordIds:['word-pig'],completedSentenceIds:['sentence-jump-can','sentence-cat-home'],visitedRegionIds:['actions','animals'],activeRegionId:'actions',settings:{soundEnabled:false,chineseScaffold:true,reducedMotion:true},contentRevision:ENGLISH_V2_CONTENT_REVISION};return '  '+JSON.stringify({...known,checksum:checksum(known),extension:{keep:['synthetic',1]},settings:{...known.settings,extraPreference:{keep:true}}},null,2)+'\n';}

test('V2 migrates once with exact old payload, extensions, grades and settings through every English writer',async({page},info)=>{
 test.skip(!['desktop-1440','mobile-390'].includes(info.project.name));
 const raw=legacyFixture(),legacy=' {"oldScore":7,"synthetic":true} ';
 await page.goto('/?world=english-world');await page.evaluate(([k,r,l,old])=>{localStorage.setItem(k,r);localStorage.setItem(l,old);},[key,raw,LEGACY_ENGLISH_SAVE_KEY,legacy]);
 await page.goto('/?world=english-world&region=actions&word=word-jump');
 let save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 expect(save.version).toBe(3);expect(save.migratedFromV2Raw).toBe(raw);expect(save.interactions).toEqual({});
 expect(save.completedStoryWordIds).toEqual(['word-jump','word-cat']);expect(save.settings.soundEnabled).toBe(false);
 await applyCanonicalPilot(page,'word-jump',info.project.name==='mobile-390'?'tap':'click');
 save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);expect(save.interactions['word-jump'].spellingVerified).toBe(false);
 await page.locator('[data-action="settings"]').click();await page.getByRole('checkbox',{name:'减少动态效果'}).uncheck();await page.keyboard.press('Escape');
 await page.locator('[data-action="journal"]').click();await page.goBack();await page.locator('[data-action="region"]').first().click();await page.goto('/?world=english-world');await page.reload();
 save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);expect(save.migratedFromV2Raw).toBe(raw);expect(save.extension).toEqual({keep:['synthetic',1]});expect(save.settings.extraPreference).toEqual({keep:true});expect(save.completedStoryWordIds).toEqual(['word-jump','word-cat']);
 expect(await page.evaluate(k=>localStorage.getItem(k),LEGACY_ENGLISH_SAVE_KEY)).toBe(legacy);
});

test('hint-fixed spelling and absent speech do not create independent spelling credit',async({page},info)=>{
 test.skip(!['desktop-1440','mobile-390'].includes(info.project.name));
 await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:undefined});});
 await page.goto('/?world=english-world&region=actions&word=word-jump');
 await page.locator('[data-pilot-action="spelling"]').click();
 for(let i=0;i<4;i++)await page.locator('.pilot-spelling [data-action="hint"]').click();
 for(const unit of ENGLISH_V2_WORD_BY_ID.get('word-jump')!.graphemeUnits){const tile=page.locator(`.pilot-spelling [data-tile-id$=":${unit.id}"]`);if(!(await tile.isDisabled()))await tile.click();}
 await page.locator('[data-action="check-build"]').click();await expect(page.locator('.pilot-feedback')).toContainText('Built with help.');
 await expect(page.locator('.pilot-spelling [data-fixed="true"]')).toHaveCount(1);
 await page.locator('[data-pilot-action="spelling"]').click();await expect(page.locator('.pilot-spelling')).toHaveCount(0);
 await applyCanonicalPilot(page,'word-jump');
 const save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 expect(save.interactions['word-jump'].interactionCompleted).toBe(true);expect(save.interactions['word-jump'].spellingVerified).toBe(false);expect(save.completedStoryWordIds).toEqual([]);expect(save.completedSentenceIds).toEqual([]);
 await expect(page.locator('[data-speak]')).toHaveCount(0);
});

for(const denial of ['read','write'] as const)test(`English remains playable with ${denial} storage denied`,async({page},info)=>{
 test.skip(info.project.name!=='desktop-1440');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(denied=>{const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(denied==='read'&&k==='family-games/english-world/v2')throw new DOMException('Synthetic denied','SecurityError');return originalGet.call(this,k);};Storage.prototype.setItem=function(k,v){if(denied==='write'&&k==='family-games/english-world/v2')throw new DOMException('Synthetic quota','QuotaExceededError');return originalSet.call(this,k,v);};},denial);
 await page.goto('/?world=english-world&region=colors&word=word-two');await applyCanonicalPilot(page,'word-two');await expect(page.locator('.wordlight-notice')).toBeVisible();expect(errors).toEqual([]);
});

test('all 37 exact keys roundtrip in real Vault; stale English memory cannot overwrite restored V3',async({page,context},info)=>{
 test.skip(!['desktop-1440','mobile-390'].includes(info.project.name));expect(KNOWN_SAVE_KEYS).toHaveLength(37);expect(EXPORTABLE_SAVE_KEYS).toHaveLength(36);
 await page.goto('/?world=english-world&region=colors&word=word-two');await applyCanonicalPilot(page,'word-two');
 const vault=await context.newPage();await vault.goto('/?world=my-game-world');
 const replacement=updateEnglishWorldSave({...createDefaultEnglishWorldSave(),extension:{synthetic:'restored'}},{completedStoryWordIds:['word-cat']});
 const fixture:Record<string,string>=Object.fromEntries(KNOWN_SAVE_KEYS.map((r,i)=>[r.key,JSON.stringify({version:r.maxVersion??1,syntheticOnly:true,fixture:i})]));
 fixture['family-games/my-game-world/v1']='{"version":1,"settings":{"muted":true,"reducedMotion":true}}';fixture[key]=JSON.stringify(replacement);
 await vault.evaluate(values=>{for(const[k,v]of Object.entries(values))localStorage.setItem(k,v);localStorage.setItem('unrelated-fixture/save','keep-synthetic');},fixture);
 await vault.getByRole('button',{name:/家长角/}).click();await vault.getByRole('button',{name:'打开游戏进度保险箱'}).click();
 const downloading=vault.waitForEvent('download');await vault.getByRole('button',{name:'备份游戏进度'}).click();const exported=readFileSync((await(await downloading).path())!,'utf8');
 const entries=JSON.parse(exported).entries as {key:string,value:string}[];expect(entries.map(e=>e.key).sort()).toEqual(EXPORTABLE_SAVE_KEYS.map(r=>r.key).sort());for(const entry of entries)expect(entry.value).toBe(fixture[entry.key]);
 await vault.evaluate(keys=>{for(const k of keys)localStorage.setItem(k,'{"syntheticBeforeRestore":true}');},EXPORTABLE_SAVE_KEYS.map(r=>r.key));
 await vault.locator('[data-vault-file]').setInputFiles({name:'synthetic-37-keys.json',mimeType:'application/json',buffer:Buffer.from(exported)});await expect(vault.locator('[data-vault-preview-checksum]')).toHaveText('PASS');vault.once('dialog',d=>void d.accept());await vault.locator('[data-vault-restore]').click();await expect(vault.locator('[data-vault-status]')).toContainText('已恢复 36');
 const restored=await vault.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),KNOWN_SAVE_KEYS.map(r=>r.key));for(const record of EXPORTABLE_SAVE_KEYS)expect(restored[record.key]).toBe(fixture[record.key]);expect(restored[SAVE_VAULT_PRE_IMPORT_BACKUP_KEY]).toContain('syntheticBeforeRestore');
 await page.locator('[data-pilot-action="reset"]').click();await applyCanonicalPilot(page,'word-two');await page.locator('[data-action="settings"]').click();await page.getByRole('checkbox',{name:'减少动态效果'}).check();await page.keyboard.press('Escape');
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(fixture[key]);expect(await vault.evaluate(()=>localStorage.getItem('unrelated-fixture/save'))).toBe('keep-synthetic');await vault.close();
});

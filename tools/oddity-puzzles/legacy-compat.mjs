// Preserved-package compatibility is opt-in and never contacts a family origin by default.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const legacyOrigin=process.env.ODDITY_LEGACY_ORIGIN,origin=process.env.ODDITY_ORIGIN;
if(!legacyOrigin||!origin)throw Error('Set both ODDITY_LEGACY_ORIGIN (preserved v0.1 package) and ODDITY_ORIGIN (current build) explicitly.');
for(const value of [legacyOrigin,origin]){const url=new URL(value);if(url.origin!==value||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Compatibility origins must be explicit local HTTP origins.');}
const out=process.env.ODDITY_OUTPUT||'tmp/tasks/oddity-legacy-compat';await mkdir(out,{recursive:true});const rows=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 // Actual v0.1 save captured by playing the preserved package; importing is compatibility evidence only.
 const old=await browser.newContext(),oldPage=await old.newPage();await oldPage.goto(legacyOrigin+'/?play=oddity-puzzles');await oldPage.locator('[data-ready=true]').waitFor();while(await oldPage.locator('[data-cmd=skipDemo]').isVisible())await oldPage.locator('[data-cmd=skipDemo]').click();await oldPage.locator('.odd-commands').getByRole('button',{name:'观察窗前',exact:true}).click();await oldPage.locator('[data-motion=still]').waitFor();const raw=await oldPage.evaluate(()=>localStorage.getItem('family-games/oddity-puzzles/v1'));await old.close();assert(raw);const compat=await browser.newContext();await compat.addInitScript(raw=>localStorage.setItem('family-games/oddity-puzzles/v1',raw),raw);const imported=await compat.newPage();await imported.goto(origin+'/?play=oddity-puzzles');await imported.locator('[data-ready=true]').waitFor();assert.equal(JSON.parse(await imported.locator('.oddity-mount').getAttribute('data-state')).actors[0].node,'window');assert.equal(await imported.evaluate(()=>localStorage.getItem('family-games/oddity-puzzles/v1')),raw);rows.push({check:'actual v0.1 serialized progress loads unchanged in v0.2',result:'PASS',boundary:'isolated storage compatibility fixture, not playthrough advancement'});await writeFile(out+'/v010-save.json',raw);await compat.close();
}catch(error){rows.push({check:'failure',result:'FAIL',error:String(error)});throw error;}finally{await browser.close();await writeFile(out+'/legacy-compat-results.json',JSON.stringify({rows},null,2));}

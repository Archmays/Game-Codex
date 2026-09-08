import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {activate,fromHome,keyReach,type InputMode} from '../step4/input-helpers';
import {shortClip} from '../step4/short-clip';
import {CORES,RECIPES,type CoreKind} from '../../../games/hanzi-tower-defense/content';
import {SAVE_KEY} from '../../../games/hanzi-tower-defense/save';
import type {MapId} from '../../../games/hanzi-tower-defense/maps';
const evidence=process.env.TD_EVIDENCE_DIR??'tmp/tasks/GAME-CODEX-STEP4/tower';
interface Item{id:number;kind:CoreKind;slot:number|null;selector:string}
async function items(page:Page):Promise<Item[]>{const raw=await page.locator('[data-core],.td-slot--occupied').evaluateAll(nodes=>nodes.map(e=>({id:Number(e.getAttribute('data-core')??e.getAttribute('data-tower-id')),slot:e.hasAttribute('data-core')?null:Number(e.getAttribute('data-slot')),glyph:e.querySelector('strong,.td-slot-glyph')?.textContent})));return raw.map(e=>({...e,kind:Object.values(CORES).find(c=>c.glyph===e.glyph)!.id,selector:e.slot===null?`[data-core="${e.id}"]`:`[data-slot="${e.slot}"]`})).sort((a,b)=>a.id-b.id);}
function region(selector:string){return selector.startsWith('[data-core=')?'[data-core]':selector.startsWith('[data-slot=')?'[data-slot]':selector.startsWith('[data-english=')?'[data-english]':undefined;}
for(const mapId of ['twin-bends','beacon-keep'] as const)test(`STEP4 natural eight waves ${mapId}, profile owns distinct build and full input`,async({page},info)=>{
 test.setTimeout(8*120000+240000);mkdirSync(evidence,{recursive:true});
 const mode:InputMode=info.project.name==='touch'?'touch':'keyboard',route=mode==='keyboard'?'forest-volcano':'flame-wildwood';
 page.setDefaultTimeout(15000);
 const act=async(selector:string)=>{const began=Date.now();await activate(page,selector,mode,region(selector));const elapsed=Date.now()-began;if(elapsed>2000)console.log(`${mapId}/${mode}: ${selector} input ${elapsed}ms`);};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await fromHome(page,mode,'forest');await expect(page.locator('[data-td-canvas]')).toHaveAttribute('data-ready','true');
 await act('[data-td-new]');await act(`[data-map-select="${mapId}"]`);await expect(page.locator('.td-game')).toHaveAttribute('data-map-id',mapId);await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');
 const priorities=route==='forest-volcano'?['canopy-grove','wood-grove','wood-wood','fire-mountain','water-wood']:['fire-fire','mountain-grove','wood-wood','water-wood'];
 const order:CoreKind[]=route==='forest-volcano'?['forest','volcano','canopy','grove','wash','flame','wildwood','mountain','fire','wood','water']:['wildwood','flame','wash','grove','volcano','mountain','fire','wood','water','canopy','forest'];
 const positions=mapId==='twin-bends'?[0,1,4,2,3,5,6,7]:[0,1,4,3,5,6,2,7],records:unknown[]=[],started=Date.now();
 for(let wave=0;wave<8;wave++){
  const preparedAt=Date.now();console.log(`${mapId}/${mode}: preparing wave ${wave+1}/8`);
  for(let n=0;n<100;n++){
   const inventory=await items(page);let pair:Item[]|undefined;
   for(const id of priorities){const recipe=RECIPES.find(r=>r.id===id)!;const a=inventory.find(c=>c.kind===recipe.inputs[0]),b=inventory.find(c=>c.kind===recipe.inputs[1]&&c.id!==a?.id);if(a&&b){pair=[a,b];break;}}
   if(!pair)break;
   await act('[data-td-clear]');for(const item of pair)await act(item.selector);await expect(page.locator('[data-td-fuse]')).toBeEnabled();await act('[data-td-fuse]');
  }
  const sorted=(await items(page)).sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)||a.id-b.id);
  const desired=new Map(sorted.slice(0,8).map((item,i)=>[item.id,positions[i]]));
  // Keep correctly placed towers, as a player would; only relocate changed positions.
  for(const item of sorted.filter(c=>c.slot!==null&&desired.get(c.id)!==c.slot)){await act('[data-td-clear]');await act(item.selector);await act('[data-td-stow]');}
  for(const item of await items(page)){const slot=desired.get(item.id);if(slot===undefined||item.slot===slot)continue;await act('[data-td-clear]');await act(item.selector);await act(`[data-slot="${slot}"]`);}
  expect((await items(page)).filter(c=>c.slot!==null).map(c=>[c.id,c.slot]).sort((a,b)=>a[0]!-b[0]!)).toEqual([...desired].sort((a,b)=>a[0]-b[0]));
  // Keyboard build equips only the naturally dropped forest core; touch build demonstrates no-English victory.
  if(mode==='keyboard'&&wave>=3){const english=page.locator('[data-english]').filter({has:page.locator('strong',{hasText:/^forest$/})});if(await english.count()&&!(await english.getAttribute('data-attached-to'))){const forest=(await items(page)).find(c=>c.kind==='forest')!;await act('[data-td-clear]');await act(await english.evaluate(e=>`[data-english="${e.getAttribute('data-english')}"]`));await act(forest.selector);await act('[data-td-equip]');}}
  if(wave===0){if(mode==='keyboard')await keyReach(page,'[data-slot="0"]','[data-slot]');await page.screenshot({path:`${evidence}/${mapId}-${mode}-deployment.png`,fullPage:true});}
  const deployment=await items(page);
  console.log(`${mapId}/${mode}: wave ${wave+1}/8 preparation ${Math.round((Date.now()-preparedAt)/1000)}s`);await act('[data-td-next]');
  if(mode==='keyboard')await expect(page.locator('[data-td-pause]')).toBeFocused();
  let recording:(()=>Promise<number>)|null=null;
  if(mapId==='beacon-keep'&&mode==='keyboard'&&wave===7){await expect(page.locator('[data-td-boss-status]')).toContainText('呼援预告',{timeout:90000});recording=await shortClip(page,'tmp/tasks/GAME-CODEX-STEP4/clips/tower');}
  await expect.poll(()=>page.locator('.td-game').getAttribute('data-phase'),{timeout:120000,intervals:[1000]}).not.toBe('battle');
  await expect(page.locator('.td-game')).toHaveAttribute('data-phase',wave===7?'won':'ready');
  if(recording)expect(await recording()).toBeGreaterThan(5);
  if(mode==='keyboard')await expect(page.locator(wave===7?'[data-td-replay]':'[data-td-next]')).toBeFocused();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);
  records.push({wave:wave+1,deployments:deployment.filter(c=>c.slot!==null),checkpoint:saved.maps[mapId].checkpoint,wallSeconds:Math.round((Date.now()-started)/1000)});
  console.log(`${mapId}/${mode}: wave ${wave+1}/8 ${wave===7?'won':'ready'}`);
  if(wave===3){await page.reload();await expect(page.locator('.td-game')).toHaveAttribute('data-phase','ready');await expect(page.locator('.td-game')).toHaveAttribute('data-map-id',mapId);}
 }
 await page.screenshot({path:`${evidence}/${mapId}-${mode}-win.png`,fullPage:true});expect(errors).toEqual([]);
 const completed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(completed.maps[mapId].checkpoint.wave).toBe(8);
 if(mode==='touch')expect(completed.maps[mapId].checkpoint.englishCores.every((e:{attachedTo:number|null})=>e.attachedTo===null)).toBe(true);
 await act('[data-td-result-home]');await expect(page.locator('[data-world-forest-link]')).toBeVisible();
 writeFileSync(`${evidence}/${mapId}-${mode}-natural.json`,JSON.stringify({mapId,mode,route,english:mode==='keyboard'?'natural forest only':'none',stateInjection:false,clockAcceleration:false,records,errors},null,2));
});

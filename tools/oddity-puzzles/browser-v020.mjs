import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.ODDITY_OUTPUT||'tmp/tasks/oddity-v020/browser';await mkdir(out,{recursive:true});const origin=process.env.ODDITY_ORIGIN||'http://127.0.0.1:5175';
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[],traces=[];
const profiles=[['desktop-mouse',1440,1000,'mouse'],['desktop-keyboard',1440,1000,'keyboard'],['phone-390',390,844,'touch'],['tablet-768-portrait',768,1024,'touch'],['tablet-768-landscape',1024,768,'keyboard'],['tablet-1024-portrait',1024,1366,'mouse'],['tablet-1024-landscape',1366,1024,'touch'],['native-200',1440,1000,'mouse']].filter(p=>!process.env.ODDITY_PROFILES||process.env.ODDITY_PROFILES.split(',').includes(p[0]));
try{for(const [name,width,height,input] of profiles){
 const options={viewport:{width,height},hasTouch:true,deviceScaleFactor:input==='touch'?2:1,isMobile:input==='touch'&&width<1100};const ctx=name==='native-200'?await chromium.launchPersistentContext(out+'/zoom-profile',{...options,channel:'chrome',headless:false}):await browser.newContext(options),p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[],external=[],geometry=[];let segment='setup';
 p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ctx.route('**/*',r=>{if(r.request().url().startsWith('chrome:'))return r.continue();if(!r.request().url().startsWith(origin+'/')&&!r.request().url().startsWith('data:')){external.push(r.request().url());return r.abort();}return r.continue();});
 const cmd=id=>p.locator(`[data-cmd="${id}"]`),mark=id=>p.locator(`[data-landmark="${id}"]`),action=label=>p.locator('.odd-commands').getByRole('button',{name:label,exact:true});
 const state=async()=>JSON.parse(await p.locator('.oddity-mount').getAttribute('data-state'));
 async function settled(){await p.waitForFunction(()=>document.querySelector('.oddity-mount')?.getAttribute('data-intent')!=='running',null,{timeout:30000});await p.locator('[data-motion=still]').waitFor();}
 async function hit(loc,wait=true){await loc.waitFor({state:'visible'});const label=await loc.textContent(),before=await p.locator('.oddity-mount').count()?await state():null,keys=[],beforeMode=before?await p.locator('.oddity-mount').getAttribute('data-intent'):null;const press=async k=>{keys.push(k);await p.keyboard.press(k);};
  if(input==='keyboard'){
   let done=false;const region='.odd-levels,.odd-commands,.odd-cards,.odd-actors,.odd-labels';
   for(let step=0;step<120&&!done;step++){
    if(await loc.evaluate(e=>e===document.activeElement)){await press('Enter');done=true;break;}
    if(await loc.evaluate((e,region)=>!!e.closest(region)?.contains(document.activeElement),region)){
     await press('Home');const count=await loc.evaluate((e,region)=>e.closest(region).querySelectorAll('button:not(:disabled)').length,region);
     for(let i=0;i<count;i++){if(await loc.evaluate(e=>e===document.activeElement)){await press('Enter');done=true;break;}await press('ArrowRight');}
    }
    if(!done){const forward=await loc.evaluate(e=>document.activeElement===document.body||!!(document.activeElement.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));await press(forward?'Tab':'Shift+Tab');}
   }assert(done,'Keyboard cannot reach '+label);
  }else if(input==='touch'){await loc.scrollIntoViewIfNeeded();await loc.tap();}else await loc.click();
  if(wait&&await p.locator('.odd-stage').count())await settled();
  const afterMode=await p.locator('.oddity-mount').count()?await p.locator('.oddity-mount').getAttribute('data-intent'):null;traces.push({profile:name,segment,label,keys,activations:input==='keyboard'?0:1,start:before,beforeMode,afterMode});
 }
 async function tutorials(){while(await cmd('skipDemo').isVisible())await hit(cmd('skipDemo'));}
 async function inspect(label,sweep=true){await settled();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.locator('.odd-cards img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  const boxes=await p.locator('.odd-landmark').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect(),s=b.closest('.odd-stage').getBoundingClientRect();return {id:b.dataset.landmark,label:b.textContent,x:r.x-s.x,y:r.y-s.y,w:r.width,h:r.height,sw:s.width,sh:s.height,anchor:[Number(b.dataset.anchorX),Number(b.dataset.anchorY)]};}));
  for(const b of boxes){assert(b.w>=44&&b.h>=48,`target size ${label} ${JSON.stringify(b)}`);assert(b.x>=0&&b.y>=0&&b.x+b.w<=b.sw+1&&b.y+b.h<=b.sh+1,'label outside stage '+b.id);assert(b.anchor.every(Number.isFinite),'invalid anchor');assert(b.anchor[0]>=0&&b.anchor[0]<=b.sw&&b.anchor[1]>=0&&b.anchor[1]<=b.sh,'anchor outside scene '+b.id);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.x+b.w-1&&a.x+a.w-1>b.x&&a.y<b.y+b.h-1&&a.y+a.h-1>b.y),`label collision ${label} ${a.id} / ${b.id}`);}
  const metrics=JSON.parse(await p.locator('.odd-stage').getAttribute('data-metrics'));assert(metrics.triangles<=100000,'triangle budget');assert(metrics.calls<=100,'draw-call budget '+metrics.calls);geometry.push({label,boxes,metrics});if(name==='desktop-mouse'||name==='phone-390'||name==='native-200')await p.locator('.odd-stage-wrap').screenshot({path:`${out}/${name}-${label}.png`});
  if(sweep&&['l1-before','l2-before','l3-before','photo-carry-before','release-before'].includes(label)){const segmentBefore=segment,before=await state(),history=await p.locator('.oddity-mount').getAttribute('data-history');segment='view-check';for(const view of [1,2]){await hit(cmd('view'+view));await inspect(label+'-view'+view,false);}await hit(cmd('view0'));assert.deepEqual(await state(),before);assert.equal(await p.locator('.oddity-mount').getAttribute('data-history'),history);segment=segmentBefore;}
 }
 try{
  if(name==='native-200'){await p.goto('chrome://settings/appearance');await p.locator('#zoomLevel').selectOption('2');assert.equal(await p.locator('#zoomLevel').inputValue(),'2');}
  await p.goto(origin+'/');if(name==='native-200'){const effective=await p.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,cssZoom:getComputedStyle(document.documentElement).zoom}));assert.equal(effective.width,720);assert(Math.abs(effective.dpr-2)<.001);assert.equal(effective.cssZoom,'1');geometry.push({browserZoom:200,effective});}await hit(p.locator('[data-world-oddity-link]'),false);await p.locator('[data-ready=true]').waitFor();await tutorials();await inspect('l1-before');
  segment='move';await hit(mark('node:window'));assert.equal((await state()).actors[0].node,'window');
  segment='turn';await hit(mark('item:lamp'));await inspect('lamp-before');await hit(mark('wall:1'));assert.equal((await state()).lamp,1);
  segment='take';await hit(mark('item:box'));await inspect('box-before');await hit(action('调查员：走近并拿起档案盒'));assert.equal((await state()).items.find(o=>o.id==='box').holder,'a');await inspect('box-after');
  segment='recovery';await hit(cmd('undo'));assert.equal((await state()).actors[0].node,'window');assert.equal((await state()).items.find(o=>o.id==='box').holder,null);assert.equal(await p.locator('.oddity-mount').getAttribute('data-intent'),'none');await hit(mark('item:box'));await hit(action('调查员：走近并拿起档案盒'));await hit(mark('node:exit'));assert.equal((await state()).won,true);
  segment='setup';await hit(cmd('next'));await p.locator('[data-ready=true]').waitFor();await tutorials();await inspect('l2-before');assert.equal(await mark('node:safe').count(),0);
  segment='restore';await hit(mark('item:door'));await inspect('door-preview');assert.equal(await p.locator('dialog[open]').count(),0);await hit(action('调查员：用相机恢复原门'));assert.equal((await state()).items.filter(o=>o.id==='door').length,1);
  segment='connect';await hit(action('调查员：走近锁孔，用钥匙连接小院'));assert.equal((await state()).won,false);await inspect('door-after');
  segment='cross';await hit(action('调查员：走过门'));assert.equal((await state()).won,true);
  segment='setup';await hit(cmd('next'));await p.locator('[data-ready=true]').waitFor();await tutorials();await inspect('l3-before');
  segment='object-selection';const beforeTray=await state(),trayHistory=await p.locator('.oddity-mount').getAttribute('data-history');await hit(mark('item:tray'));assert.deepEqual(await state(),beforeTray,'ordinary tray click only selects');assert.equal(await p.locator('.oddity-mount').getAttribute('data-history'),trayHistory);assert.match(await p.locator('.odd-commands h3').textContent(),/托盘/);
  segment='empty-recovery';await hit(mark('item:photo'));await hit(action('蓝衣：用扳指搬照片'));await hit(mark('item:tray'));await hit(mark('actor:npc'));await hit(action('请求接应员：走近并拿起照片'));assert.equal(await action('请求接应员：用照片释放同伴').count(),0);await hit(action('请求接应员：把照片放回托盘'));await hit(mark('item:photo'));await hit(action('蓝衣：用扳指搬照片'));await hit(action('蓝衣：用扳指送到自己手边'));assert.equal((await state()).items.find(o=>o.id==='photo').holder,'a');
  segment='capture';await hit(mark('item:photo'));await hit(action('蓝衣：走近并用照片收纳橙衣'));assert.equal((await state()).photo,'b');
  segment='send';await hit(action('蓝衣：用扳指搬照片'));await inspect('photo-carry-before');await hit(mark('item:tray'));await inspect('photo-carry-after');
  segment='npc-take';await hit(mark('actor:npc'));await hit(action('请求接应员：走近并拿起照片'));
  segment='release';await hit(action('请求接应员：用照片释放同伴'));await inspect('release-before');await hit(mark('node:release'));assert.equal((await state()).active,'a');assert.equal((await state()).actors.find(a=>a.id==='a').node,'outside');assert.equal((await state()).photo,null);await inspect('release-after');
  segment='switches';await hit(mark('item:left'));await hit(action('橙衣：走到△ 三角开关并按住'));assert.equal((await state()).latched,false);await hit(mark('item:right'));await hit(action('请求接应员：走到◇ 菱形开关并按住'));assert.equal((await state()).latched,true);assert.equal((await state()).active,'a');await inspect('switches-after');
  segment='together';await hit(action('一起出去：每个人沿道路走到出口'));assert.equal((await state()).won,true);assert((await state()).actors.every(a=>a.node==='exit'));await inspect('together-after');
  segment='recovery';const raw=await p.evaluate(()=>localStorage.getItem('family-games/oddity-puzzles/v1'));await p.reload();await p.locator('[data-ready=true]').waitFor();assert.equal((await state()).won,true);assert.equal(await p.evaluate(()=>localStorage.getItem('family-games/oddity-puzzles/v1')),raw);
  await hit(cmd('reset'));await hit(cmd('close'));assert.equal((await state()).won,true);await hit(cmd('reset'));await hit(cmd('confirmReset'));assert.equal((await state()).won,false);await hit(cmd('abilityring'));await hit(mark('actor:b'));assert.equal((await state()).active,'a');assert.equal(await p.locator('.oddity-mount').getAttribute('data-intent'),'ring-place');await p.keyboard.press('Escape');assert.equal(await p.locator('.oddity-mount').getAttribute('data-intent'),'none');
  const history=await p.locator('.oddity-mount').getAttribute('data-history');await hit(cmd('actorb'));assert.equal((await state()).active,'b');assert.equal(await p.locator('.oddity-mount').getAttribute('data-history'),history);
  const wrongOwner=await state();await hit(cmd('abilityring'));await hit(mark('item:photo'));await hit(mark('item:tray'));assert.deepEqual(await state(),wrongOwner,'wrong owner must not borrow ring or switch actor');await p.keyboard.press('q');assert.equal((await state()).active,'a');
  await hit(mark('actor:npc'));await hit(action('请求接应员：走到选定地点'));const beforeNPC=await state();await hit(mark('node:center'));assert.equal((await state()).actors.find(a=>a.id==='npc').node,'center');assert.equal((await state()).actors[0].node,beforeNPC.actors[0].node);assert.equal((await state()).active,'a');await hit(cmd('undo'));assert.deepEqual(await state(),beforeNPC);
  const beforeExpand=await state();await hit(cmd('landmarks'));await inspect('expanded-sites',false);assert.deepEqual(await state(),beforeExpand);await hit(cmd('landmarks'));
  for(let i=0;i<3;i++){await hit(cmd('hint'));await hit(cmd('close'));}
  await hit(p.locator('.odd-home'),false);await p.locator('[data-world-oddity-link]').waitFor();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);rows.push({profile:name,input,viewport:{width,height},result:'PASS',threeRoomsFromHome:true,emptyPhotoRecovery:true,singleIntentUndo:true,explicitNPC:true,noAutoSwitch:true,saveReload:true,errors,external,geometry});console.log(name+' PASS');
 }catch(e){await p.screenshot({path:`${out}/${name}-failure.png`,fullPage:true});await writeFile(`${out}/${name}-failure.txt`,String(e)+'\n'+await p.locator('body').innerText());throw e;}finally{await ctx.close();}
}}finally{await browser.close();await writeFile(`${out}/browser-results.json`,JSON.stringify({rows},null,2)+'\n');await writeFile(`${out}/input-trace.json`,JSON.stringify(traces,null,2)+'\n');}

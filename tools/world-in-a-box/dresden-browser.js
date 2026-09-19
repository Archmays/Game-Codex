// Playwright CLI run-code --filename; --raw outputs machine-readable canonical rows.
// No injected gameplay state or forced focus. Each profile starts with empty isolated storage.
async driver=>{
 const origin='http://127.0.0.1:5175'+(driver.qaPrefix||''),browser=driver.context().browser(),results=[];
 const groups={river:['yellow_tram','paddle_steamer','augustus_bridge','river_pier','riverside_trees'],oldtown:['frauenkirche_dome','frauenkirche_body','semperoper','zwinger_crown_gate','zwinger_galleries'],campus:['beyer_tower','beyer_body','slub_skylight','slub_surface','campus_bikes'],street:['bakery_front','bench_scene','street_houses']};
 const profiles=[{name:'keyboard-desktop',w:1440,h:1000,key:true},{name:'mouse-desktop',w:1366,h:900},{name:'touch-390',w:390,h:844,touch:true},{name:'touch-360',w:360,h:800,touch:true},{name:'phone-landscape',w:844,h:390,touch:true},{name:'tablet-portrait',w:768,h:1024,touch:true},{name:'tablet-landscape',w:1024,h:768,touch:true}];
 // Check the shortest-height touch surface first; it exposed gesture regressions.
 for(const profile of [...profiles].sort((a,b)=>Number(b.name==='phone-landscape')-Number(a.name==='phone-landscape'))){
 if(driver.qaProfiles&&!driver.qaProfiles.includes(profile.name))continue;
 const ctx=await browser.newContext({viewport:{width:profile.w,height:profile.h},hasTouch:!!profile.touch,deviceScaleFactor:1,reducedMotion:'reduce'});
 const p=await ctx.newPage(),errors=[],foreign=[],steps=[];p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await ctx.route('**/*',r=>{const url=r.request().url();if(url.startsWith(origin)||url.startsWith('data:')||url.startsWith('blob:'))return r.continue();foreign.push(url);return r.abort();});
 const check=(v,m)=>{if(!v)throw Error(profile.name+': '+m);steps.push(m);console.log(profile.name+': '+m);};
 const state=()=>p.locator('.wb-mount').evaluate(e=>({...e.dataset}));
 const ready=()=>p.locator('[data-ready=true]').waitFor();
 async function keyTo(selector){for(let n=0;n<80;n++){
   if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;
   const region=await p.evaluate(()=>['piece','slot','group'].find(k=>document.activeElement?.hasAttribute('data-'+k)));
   if(region&&selector.includes('data-'+region))for(let k=0;k<18;k++){await p.keyboard.press('ArrowRight');if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;}
   await p.keyboard.press('Tab');
  }throw Error('Keyboard cannot reach '+selector+' active '+await p.evaluate(()=>document.activeElement?.textContent));}
 async function press(selector){if(profile.key){await keyTo(selector);await p.keyboard.press('Enter');}else if(profile.touch)await p.locator(selector).tap();else await p.locator(selector).click();}
 async function select(group,id){await press(`[data-group=${group}]`);while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');if(!await p.locator(`[data-piece=${id}]`).isVisible())await press('[data-action=next]');await press(`[data-piece=${id}]`);await press('[data-action=hint]');}
 async function place(group,id){console.log(profile.name+': placing '+id);await select(group,id);await press(`[data-slot=${id}]`);await p.waitForFunction(id=>document.querySelector('.wb-mount').dataset.placed.split(' ').includes(id),id);await p.waitForTimeout(350);}
 async function geometry(){const g=await p.locator('.dc').evaluate(root=>{
  const buttons=[...root.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.closest('dialog:not([open])'));
  const small=buttons.filter(e=>{const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(e=>e.dataset);
  const slots=[...root.querySelectorAll('[data-slot]:not([hidden])')],overlaps=[],hits=[];
  for(let i=0;i<slots.length;i++){const a=slots[i].getBoundingClientRect();for(let j=i+1;j<slots.length;j++){const b=slots[j].getBoundingClientRect();if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)overlaps.push([slots[i].dataset.slot,slots[j].dataset.slot]);}if(a.top>=0&&a.bottom<=innerHeight)for(const [x,y] of [[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]])if(document.elementFromPoint(a.x+a.width*x,a.y+a.height*y)?.closest('button')!==slots[i])hits.push(slots[i].dataset.slot);}
  return{small,overlaps,hits,overflow:document.documentElement.scrollWidth>innerWidth+1};});check(!g.small.length&&!g.overlaps.length&&!g.hits.length&&!g.overflow,'44px targets, nonoverlap, hit points, no horizontal overflow '+JSON.stringify(g));}
 try{
 await p.goto(origin+'/');await p.locator('[data-world-box-link]').waitFor();await press('[data-world-box-link]');await ready();
 // Preserve a real, manually assembled old-box save across city reset and scene switching.
 await press('[data-piece=shutter_left]');await press('[data-action=hint]');await press('[data-slot=shutter_left]');await p.waitForTimeout(360);
 const old=await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'));
 await press('[data-action=boxes]');const cityLoadStart=Date.now();await press('[data-box=dresden-river-campus]');await ready();const loading={readyMilliseconds:Date.now()-cityLoadStart,asset:await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('dresden-river-campus.glb')).map(r=>({duration:r.duration,bytes:r.decodedBodySize})))};check(p.url().includes('scene=dresden-river-campus'),'scene picker updates direct route');
 await select('river','yellow_tram');await geometry();
 const wrong=await p.locator('[data-slot]:not([hidden]):not([data-slot=yellow_tram])').first().getAttribute('data-slot');await press(`[data-slot=${wrong}]`);check((await state()).selected==='yellow_tram'&&!(await state()).placed,'wrong match retains selection');
 await press('[data-slot=yellow_tram]');await p.waitForTimeout(350);
 await press('.dc-destinations [data-destination=campus]');await press('[data-action=tram-start]');await p.waitForFunction(()=>document.querySelector('[data-tram-running]').dataset.tramRunning==='false'&&Math.abs(+document.querySelector('.wb-canvas').dataset.tram.split(',')[2]-8.7)<.0001);
 check((await p.locator('.wb-canvas').getAttribute('data-tram')).endsWith(',8.7'),'same bank tram works before bridge');
 await press('.dc-destinations [data-destination=north]');await press('[data-action=tram-start]');await p.waitForFunction(()=>document.querySelector('[data-bridge-blocked]').dataset.bridgeBlocked==='true');check(true,'missing bridge blocks cross-bank path');
 await place('river','paddle_steamer');await press('[data-action=boat-start]');const boatBefore=await p.locator('.wb-canvas').getAttribute('data-boat'),anchorBefore=await p.locator('[data-slot=paddle_steamer]').getAttribute('style');await p.waitForTimeout(400);check(await p.locator('.wb-canvas').getAttribute('data-boat')!==boatBefore,'boat actually moves without bridge or pier');check(await p.locator('[data-slot=paddle_steamer]').getAttribute('style')!==anchorBefore,'moving boat anchor follows rendered model');await press('[data-action=boat-pause]');
 await place('river','augustus_bridge');await press('[data-action=tram-start]');await p.waitForFunction(()=>{const z=+document.querySelector('.wb-canvas').dataset.tram.split(',')[2];return z<-2&&z>-6;});
 if(profile.key)await p.keyboard.press('z');else await press('[data-action=undo]');check(!(await state()).placed.includes('augustus_bridge'),'bridge undone while tram crossing');await p.waitForFunction(()=>Math.abs(+document.querySelector('.wb-canvas').dataset.tram.split(',')[2]+.4)<.00001);check(true,'tram safe reset before removing bridge');await place('river','augustus_bridge');
 for(const [group,ids] of Object.entries(groups))for(const id of ids){if((await state()).placed.split(' ').includes(id))continue;await place(group,id);}
 check((await state()).placed.split(' ').length===18,'all 18 pieces via real input, upper pieces before bodies');check(!await p.locator('.wb-tray').isVisible(),'empty tray collapses');
 await press('[data-view=all]');await geometry();if(profile.key||profile.name==='touch-390')await p.screenshot({path:`docs/world-in-a-box/step02-evidence/${profile.name}-city.png`,fullPage:true});
 if(profile.key){for(const view of ['river','campus']){await press(`[data-view=${view}]`);await p.locator('.wb-stage').screenshot({path:`docs/world-in-a-box/step02-evidence/${view}.png`});}await press('[data-view=all]');}
 await press('[data-action=section]');await p.waitForFunction(()=>document.querySelector('.wb-canvas').dataset.section==='1');check((await state()).placed.split(' ').length===18,'section does not consume pieces');
 if(profile.key)await p.locator('.wb-stage').screenshot({path:'docs/world-in-a-box/step02-evidence/library.png'});
 await press('[data-action=section]');await p.waitForFunction(()=>document.querySelector('.dc-mount').dataset.section==='false');check((await state()).section==='false','library closes from keyboard/pointer/touch');
 for(const id of ['bridge','church','opera','zwinger','beyer','slub']){await press(`[data-photo=${id}]`);await p.locator('[data-photo-content] figure img').first().waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('[data-photo-content] figure img')].every(i=>i.complete&&i.naturalWidth>0));await press('[data-photo-content] figure:first-of-type [data-photo-zoom]');await press('[data-photo-content] figure:first-of-type [data-photo-zoom]');if(profile.key)await p.keyboard.press('Escape');else await press('[data-action=close-photo]');check(await p.evaluate(id=>document.activeElement?.matches(`[data-photo=${id}]`),id),'photo '+id+' loads local image and restores focus');}
 await press('[data-action=night]');await geometry();if(profile.key)await p.locator('.wb-stage').screenshot({path:'docs/world-in-a-box/step02-evidence/night.png'});await press('[data-action=night]');
 if(profile.key){await keyTo('[data-clock="0"]');await keyTo('[data-clock="1"]');}check((await p.locator('[data-clock="0"]').getAttribute('aria-label')).includes('来自设备时钟'),'accessible analog clock');
 await press('[data-action=boat-dock]');await p.waitForFunction(()=>document.querySelector('[data-boat-running]').dataset.boatRunning==='false'&&Math.abs(+document.querySelector('.wb-canvas').dataset.boat.split(',')[0]-5.8)<.0001);await p.waitForTimeout(700);check(+((await p.locator('.wb-canvas').getAttribute('data-boat')).split(',')[2])>-3.55,'boat docks alongside real installed pier');
 await press('[data-action=boat-return]');await press('[data-action=boat-follow]');await p.waitForTimeout(250);await press('[data-action=boat-follow]');await press('[data-action=boat-pause]');
 await press('.dc-destinations [data-destination=north]');await press('[data-action=tram-start]');await p.waitForTimeout(450);await press('[data-action=tram-pause]');const stopped=await p.locator('.wb-canvas').getAttribute('data-tram');await p.waitForTimeout(200);check(await p.locator('.wb-canvas').getAttribute('data-tram')===stopped,'pause preserves rendered transform');
 await p.reload();await ready();check((await state()).placed.split(' ').length===18&&(await state()).tramRunning==='false'&&(await state()).boatRunning==='false','refresh restores progress, transport starts safely paused');
 let visualRepeat=null;
 if(profile.key){
  await p.waitForTimeout(400);const a=await p.locator('.wb-canvas').screenshot({path:'docs/world-in-a-box/step02-evidence/baseline-all.png'});
  await p.reload();await ready();await p.waitForTimeout(400);const b=await p.locator('.wb-canvas').screenshot();
  visualRepeat=await p.evaluate(async urls=>{const arrays=await Promise.all(urls.map(async url=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;}));let significant=0,maxDelta=0;for(let n=0;n<arrays[0].length;n+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(arrays[0][n+k]-arrays[1][n+k]));if(d>1)significant++;maxDelta=Math.max(maxDelta,d);}return{significant,maxDelta,pixels:arrays[0].length/4};},[a,b].map(b=>'data:image/png;base64,'+b.toString('base64')));check(visualRepeat.significant===0,'no-update restored full canvas baseline '+JSON.stringify(visualRepeat));
 }
 const metrics=await p.locator('.wb-canvas').evaluate(e=>({calls:+e.dataset.calls,triangles:+e.dataset.triangles}));const timing=await p.evaluate(()=>new Promise(resolve=>{const times=[];let prev=performance.now();function frame(t){times.push(t-prev);prev=t;if(times.length<61)requestAnimationFrame(frame);else{times.shift();times.sort((a,b)=>a-b);resolve({medianMs:times[30],p95Ms:times[57]});}}requestAnimationFrame(frame);}));
 await press('[data-action=reset]');await press('[data-action=confirm-reset]');check(!(await state()).placed,'city reset clears only city');check(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'))===old,'old v1 save byte-identical after city reset');
 await press('[data-action=boxes]');await press('[data-box=window-breeze]');await ready();check((await state()).placed==='shutter_left','old box resumes its real progress');await press('[data-action=exit]');await p.locator('[data-world-box-link]').waitFor();check(true,'returned to hub');
 check(!errors.length&&!foreign.length,'zero page/console errors and forbidden requests');results.push({profile:profile.name,result:'PASS',steps,metrics,timing,loading,visualRepeat,errors,foreign,input:profile.key?'keyboard only':profile.touch?'emulated touch':'mouse',offline:'request layer blocks non-local requests; fresh context/empty cache'});
 }catch(error){await p.screenshot({path:'tmp/tasks/world-box-step02/matrix-failure-'+profile.name+'.png',fullPage:true});return{result:'AUTO_REVISE',profile:profile.name,error:String(error),state:await state().catch(()=>null),tray:await p.locator('.wb-tray').innerText().catch(()=>null),steps,errors,foreign,completed:results};}finally{await ctx.close();}
 }
 return{result:'PASS_MACHINE',profiles:results};
}

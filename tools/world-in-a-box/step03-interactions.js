// Public controls only. Storage reads prove isolation; no assembly state injection.
async driver=>{
 const browser=driver.context().browser(),rows=[];
 const profiles=[{name:'desktop',w:1366,h:900},{name:'360',w:360,h:800,touch:true},{name:'390',w:390,h:844,touch:true},{name:'landscape',w:844,h:390,touch:true},{name:'tablet',w:768,h:1024,touch:true}];
 for(const profile of profiles){
 if(driver.qaProfiles&&!driver.qaProfiles.includes(profile.name))continue;
 const ctx=await browser.newContext({viewport:{width:profile.w,height:profile.h},hasTouch:!!profile.touch}),p=await ctx.newPage(),checks=[],diagnostics=[],errors=[];
 p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(String(e)));
 const assert=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 const press=s=>profile.touch?p.locator(s).tap():p.locator(s).click();
 const ready=()=>p.locator('[data-ready=true]').waitFor();const state=()=>p.locator('.wb-mount').evaluate(e=>({...e.dataset}));
 const camera=()=>p.locator('.wb-canvas').getAttribute('data-camera');
 const audio=async()=>JSON.parse((await state()).audio);
 async function choose(id,group){if(group)await press(`[data-group=${group}]`);while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');for(let i=0;i<3&&!await p.locator(`[data-piece=${id}]`).isVisible();i++)await press('[data-action=next]');await press(`[data-piece=${id}]`);}
 async function place(id,group){await choose(id,group);await press('[data-action=hint]');await press(`[data-slot=${id}]`);await p.waitForFunction(id=>document.querySelector('.wb-mount').dataset.placed.split(' ').includes(id),id);}
 async function reset(){await press('[data-action=reset]');await press('[data-action=confirm-reset]');await p.waitForFunction(()=>document.querySelector('.wb-mount').dataset.placed==='');}
 async function swap(scene){await press('[data-action=boxes]');await press(`[data-box=${scene}]`);await ready();}
 async function keyTo(selector){for(let i=0;i<80;i++){if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;await p.keyboard.press('Tab');}throw Error('Cannot reach '+selector);}
 async function holdRotation(){
  await p.locator('[data-action=right]').scrollIntoViewIfNeeded();const b=await p.locator('[data-action=right]').boundingBox(),before=JSON.parse(await camera()).angle;
  if(profile.touch){const cdp=await ctx.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await p.waitForFunction(a=>JSON.parse(document.querySelector('.wb-canvas').dataset.camera).angle>a+.2,before);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else {await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForFunction(a=>JSON.parse(document.querySelector('.wb-canvas').dataset.camera).angle>a+.2,before);await p.mouse.up();}
  const stopped=JSON.parse(await camera()).angle;await p.waitForTimeout(180);assert(JSON.parse(await camera()).angle===stopped,'hold rotation advances continuously and release stops');
  if(!profile.touch){await keyTo('[data-action=left]');const a=JSON.parse(await camera()).angle;await p.keyboard.down('Space');await p.waitForFunction(a=>JSON.parse(document.querySelector('.wb-canvas').dataset.camera).angle<a-.17,a);await p.keyboard.up('Space');const stop=await camera();await p.waitForTimeout(150);assert(await camera()===stop,'keyboard hold rotates and keyup stops');}
 }
 try{
 await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5175/')||r.request().url().startsWith('data:')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box');await ready();
 await place('shutter_left');await p.waitForFunction(()=>document.querySelector('.wb-canvas').dataset.motion==='still');await press('[data-slot=shutter_left]');await place('cup');await press('[data-action=view]');await press('[data-slot=cup]');
 await press('[data-sound-settings]');await p.locator('[data-channel=music]').press('Home');await p.locator('[data-channel=music]').press('ArrowRight');await p.locator('[data-channel=ambient]').press('End');await press('[data-sound-close]');
 const prefs=await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/audio-v1'));
 await choose('cat');const before=await state(),view=await camera();await press('[data-action=reset]');assert(await p.evaluate(()=>document.activeElement?.matches('[data-action=cancel-reset]')),'reset defaults to continue');await p.keyboard.press('Escape');assert((await state()).placed===before.placed&&(await state()).selected===before.selected&&await camera()===view,'cancel preserves progress selection and camera');
 await holdRotation();await reset();assert((await state()).open===''&&(await state()).wind==='false','window reset clears opened shutters and wind');assert(await p.locator('[data-action=undo]').isDisabled(),'reset clears undo history');assert(!(await audio()).loops.some(v=>!['music','environment'].includes(v.key)),'window reset removes object loops');
 await p.reload();await ready();assert((await state()).placed==='','window reset persists');assert(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/audio-v1'))===prefs,'audio preferences survive reset/reload');
 await place('book');const old=await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'));
 await swap('dresden-river-campus');await press('[data-view=river]');await choose('river_pier','river');
 diagnostics.push({case:'help-off',state:await state(),camera:await camera(),target:await p.locator('[data-slot=river_pier]').evaluate(e=>({...e.dataset,hidden:e.hidden,style:e.getAttribute('style')}))});
 assert(await p.locator('[data-slot=river_pier]').isVisible(),'pier available in normal river view without help');
 await press('[data-action=help]');await p.locator('[data-slot=river_pier]').click({trial:true});diagnostics.push({case:'help-after-selection',camera:await camera(),target:await p.locator('[data-slot=river_pier]').evaluate(e=>({...e.dataset,hidden:e.hidden}))});
 await p.keyboard.press('Escape');await choose('river_pier','river');await p.locator('[data-slot=river_pier]').click({trial:true});assert(true,'help before and after selection retain clickable pier');
 await press('[data-slot=river_pier]');await place('paddle_steamer','river');await press('[data-action=boat-start]');await p.waitForFunction(()=>+document.querySelector('.wb-canvas').dataset.boat.split(',')[0]>-6.5);await press('[data-action=boat-follow]');
 await choose('riverside_trees','river');assert((await state()).follow==='','selection releases follow without stopping boat');await press('[data-slot=riverside_trees]');
 await press('[data-action=reset]');const position=await p.locator('.wb-canvas').getAttribute('data-boat');await p.waitForTimeout(180);assert(await p.locator('.wb-canvas').getAttribute('data-boat')===position,'reset confirmation temporarily freezes motion');await press('[data-action=cancel-reset]');await p.waitForFunction(pos=>document.querySelector('.wb-canvas').dataset.boat!==pos,position);assert((await state()).boatRunning==='true','cancel resumes previous valid motion intent');
 await press('[data-action=boat-pause]');await press('[data-action=reset]');await press('[data-action=cancel-reset]');assert((await state()).boatRunning==='false','cancel never restarts manual pause');
 await holdRotation();await press('[data-view=river]');await choose('yellow_tram','river');await press('[data-slot=yellow_tram]');await p.keyboard.press('z');assert(!(await state()).placed.includes('yellow_tram'),'Z undoes city placement');
 await place('slub_surface','campus');await place('slub_skylight','campus');await press('[data-action=section]');await reset();assert((await state()).night==='false'&&(await state()).section==='false'&&(await state()).follow==='','reset clears section follow and night');assert(!await p.locator('[data-ride-panel]').isVisible(),'reset clears transport panel');assert(await p.locator('[data-action=near-start]').isDisabled(),'missing vehicles cannot start via nearby panel');
 await p.reload();await ready();assert((await state()).placed==='','city reset persists');assert(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'))===old,'city resets preserve other box bytes');assert(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/audio-v1'))===prefs,'city resets preserve sound preferences');
 if(profile.name==='desktop')await p.screenshot({path:'docs/world-in-a-box/step03-evidence/reset-city.png',fullPage:true});
 assert(errors.length===0,'no uncaught errors');rows.push({profile:profile.name,checks,diagnostics,errors});
 }catch(error){await p.screenshot({path:'tmp/tasks/world-box-step03/interactions-failure-'+profile.name+'.png',fullPage:true});return{result:'AUTO_REVISE',profile:profile.name,error:String(error),state:await state(),checks,diagnostics,rows,errors};}finally{await ctx.close();}
 }
 return{result:'PASS_MACHINE',rows};
}

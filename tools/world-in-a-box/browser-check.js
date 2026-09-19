// Playwright CLI: run-code --filename=tools/world-in-a-box/browser-check.js
// Only real public UI actions; evaluate reads DOM/storage. Isolated old-save fixtures never alter puzzle state.
async (driver) => {
  const browser=driver.context().browser();
  const results=[];
  const ids=['shutter_left','shutter_right','curtain','wind_chime','plant','cup','book','cat'];
  const origin='http://127.0.0.1:5175';
  function check(value,message){if(!value)throw Error(message);}
  const profiles=[{name:'keyboard-desktop',w:1440,h:1000,keyboard:true},{name:'mouse-desktop',w:1366,h:900},{name:'touch-390',w:390,h:844,touch:true},{name:'touch-360',w:360,h:800,touch:true},{name:'phone-landscape',w:844,h:390,touch:true},{name:'tablet-portrait',w:768,h:1024,touch:true},{name:'tablet-landscape',w:1024,h:768,touch:true}];
  for(const profile of profiles){
    const ctx=await browser.newContext({viewport:{width:profile.w,height:profile.h},hasTouch:!!profile.touch,deviceScaleFactor:1});
    const page=await ctx.newPage();try { const errors=[],foreign=[],cleanup=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().startsWith('WB_QA:'))cleanup.push(m.text());});
    await ctx.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();foreign.push(url);return route.abort();});
    await ctx.addInitScript(()=>{
      const key='family-games/equation-slider/progress-v3';if(localStorage.getItem(key)===null)localStorage.setItem(key,'UNCHANGED_SYNTHETIC_OLD_SAVE');
      const close=AudioContext.prototype.close;AudioContext.prototype.close=function(){console.log('WB_QA:audio-closed');return close.call(this);};
      const cancel=window.cancelAnimationFrame;window.cancelAnimationFrame=function(id){console.log('WB_QA:raf-cancelled');return cancel.call(this,id);};
      for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const get=proto.getExtension;proto.getExtension=function(name){const result=get.call(this,name);if(name==='WEBGL_lose_context'&&result){const lose=result.loseContext.bind(result);result.loseContext=()=>{console.log('WB_QA:webgl-released');lose();};}return result;};}
    });
    async function read(){return page.locator('.wb-mount').evaluate(el=>({placed:el.dataset.placed.split(' ').filter(Boolean),open:el.dataset.open,wind:el.dataset.wind,selected:el.dataset.selected}));}
    async function keyTo(selector){
      for(let n=0;n<90;n++){
        if(await page.evaluate(s=>document.activeElement?.matches(s),selector))return;
        const kind=await page.evaluate(()=>document.activeElement?.hasAttribute('data-piece')?'piece':document.activeElement?.hasAttribute('data-slot')?'slot':'');
        if(kind&&selector.includes(`data-${kind}`)){
          for(let k=0;k<8;k++){await page.keyboard.press('ArrowRight');if(await page.evaluate(s=>document.activeElement?.matches(s),selector))return;}
        }
        await page.keyboard.press('Tab');
      }
      await page.screenshot({path:'tmp/tasks/world-box-r2/key-failure.png',fullPage:true});throw Error(profile.name+': keyboard cannot reach '+selector+' '+JSON.stringify(await read())+' '+await page.locator('.wb-targets').innerText());
    }
    async function press(selector){
      if(profile.keyboard){await keyTo(selector);await page.keyboard.press('Enter');}
      else if(profile.touch)await page.locator(selector).tap();else await page.locator(selector).click();
    }
    async function ready(){await page.locator('[data-ready=true]').waitFor();}
    async function pixelDifference(a,b){
      return page.evaluate(async ([first,second])=>{
        async function pixels(url){const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const context=canvas.getContext('2d');context.drawImage(img,0,0);return context.getImageData(0,0,canvas.width,canvas.height).data;}
        const [x,y]=await Promise.all([pixels(first),pixels(second)]);let changed=0,significant=0,maxDelta=0;
        for(let i=0;i<x.length;i+=4){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(x[i+c]-y[i+c]));if(d)changed++;if(d>1)significant++;maxDelta=Math.max(maxDelta,d);}
        return{pixels:x.length/4,changed,significant,maxDelta};
      },[a,b].map(buffer=>'data:image/png;base64,'+buffer.toString('base64')));
    }
    async function pick(id){
      while(await page.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');
      for(let n=0;n<4&&!await page.locator(`[data-piece=${id}]`).isVisible();n++){
        const current=await page.locator('[data-action=next]').isEnabled();await press(`[data-action=${current?'next':'prev'}]`);
      }
      await press(`[data-piece=${id}]`);check((await read()).selected===id,profile.name+' selection '+id);
    }
    async function place(id){await pick(id);await press('[data-action=hint]');await press(`[data-slot=${id}]`);await page.waitForTimeout(370);check((await read()).placed.includes(id),profile.name+' placement '+id);}
    async function geometry(){
      const result=await page.locator('.wb').evaluate(root=>{
        const buttons=[...root.querySelectorAll('button')].filter(el=>el.getClientRects().length&&!el.closest('dialog:not([open])'));
        const small=buttons.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(el=>el.outerHTML);
        const targets=[...root.querySelectorAll('[data-slot]:not([hidden])')];const overlaps=[];
        for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i].getBoundingClientRect(),b=targets[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([targets[i].dataset.slot,targets[j].dataset.slot]);}
        return{small,overlaps,overflow:document.documentElement.scrollWidth>innerWidth+1};
      });check(!result.small.length&&!result.overlaps.length&&!result.overflow,profile.name+' geometry '+JSON.stringify(result));
    }
    await page.goto(origin+'/');await page.locator('[data-world-box-link]').waitFor();
    await press('[data-world-box-link]');await ready();
    check((await read()).placed.length===0,'fresh direct scene');
    await pick('shutter_left');await geometry();check(!await page.locator('[data-slot=wind_chime]').isVisible(),'outside target must be occluded');
    await press('[data-slot=cup]');check((await read()).placed.length===0&&(await read()).selected==='shutter_left','wrong placement preserves selection');
    await page.keyboard.press('Escape');check(!(await read()).selected,'Escape cancels');
    await place('shutter_left');await press('[data-slot=shutter_left]');check((await read()).wind==='true','first shutter opens');
    await press('[data-action=undo]');check((await read()).wind==='false'&&(await read()).placed.length===0,'undo sole open shutter');
    await page.reload();await ready();check((await read()).wind==='false'&&(await read()).placed.length===0,'undo survives reload');
    await place('shutter_left');await press('[data-slot=shutter_left]');
    const order=profile.keyboard?['book','plant','curtain','wind_chime','cat','cup','shutter_right']:['cat','cup','wind_chime','book','curtain','plant','shutter_right'];
    for(const id of order){await place(id);await geometry();}
    check((await read()).placed.length===8&&(await read()).wind==='true','all eight plus late wind responders');
    await press('[data-action=view]');await press('[data-slot=cat]');await press('[data-slot=cup]');
    await page.waitForTimeout(2600);
    const moving1=await page.locator('.wb-canvas').screenshot();await page.waitForTimeout(370);const moving2=await page.locator('.wb-canvas').screenshot();const motionPixels=await pixelDifference(moving1,moving2);check(motionPixels.significant>10,'wind must visibly animate installed objects '+JSON.stringify(motionPixels));
    await press('[data-slot=shutter_left]');check((await read()).wind==='false','close all windows');
    // Exact settled animation state plus a full-frame one-8-bit-step raster tolerance.
    // No region is masked; opening must independently produce >10 pixels above that tolerance.
    await page.locator('.wb-canvas[data-motion=still]').waitFor({timeout:5000});const still1=await page.locator('.wb-canvas').screenshot({path:`tmp/tasks/world-box-r2/${profile.name}-still-a.png`});await page.waitForTimeout(400);const still2=await page.locator('.wb-canvas').screenshot({path:`tmp/tasks/world-box-r2/${profile.name}-still-b.png`});const settledPixels=await pixelDifference(still1,still2);check(settledPixels.significant===0,profile.name+' closed scene must settle '+JSON.stringify(settledPixels));
    await press('[data-slot=shutter_right]');check((await read()).wind==='true','either shutter drives wind');
    await page.reload();await ready();check((await read()).placed.length===8&&(await read()).open==='shutter_right','reload preserves installed/open');
    await press('[data-action=mute]');await press('[data-action=left]');await press('[data-action=right]');await press('[data-action=in]');await press('[data-action=out]');await press('[data-action=up]');await press('[data-action=down]');await press('[data-action=view]');
    await page.waitForTimeout(800);
    await page.screenshot({path:`docs/world-in-a-box/evidence/${profile.name}.png`,fullPage:true});
    await press('[data-action=reset]');await page.keyboard.press('Escape');check((await read()).placed.length===8,'reset dialog Escape');
    await press('[data-action=reset]');await press('[data-action=confirm-reset]');check((await read()).placed.length===0&&(await read()).wind==='false','scoped reset');
    check(await page.evaluate(()=>localStorage.getItem('family-games/equation-slider/progress-v3'))==='UNCHANGED_SYNTHETIC_OLD_SAVE','old save untouched');
    await pick('cup');await press('[data-action=hint]');await geometry();
    if(!profile.keyboard){
      // Release-time cancellation: moving off target and scrolling cannot place the selected cup.
      const b=await page.locator('[data-slot=cup]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+75,b.y+75,{steps:5});await page.mouse.up();check((await read()).placed.length===0,'moved pointer must not place');
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.wheel(0,120);await page.waitForTimeout(250);await page.mouse.up();check((await read()).placed.length===0,'wheel cancels pressed target');
      if(profile.touch){const cdp=await ctx.newCDPSession(page);await page.locator('[data-slot=cup]').scrollIntoViewIfNeeded();const c=await page.locator('[data-slot=cup]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x+22,y:c.y+22}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});check((await read()).placed.length===0,'native touchCancel');await cdp.detach();}
    }
    await page.keyboard.press('Escape');await place('cup');
    await press('[data-action=exit]');await page.locator('[data-world-box-link]').waitFor();
    check(cleanup.some(x=>x.includes('audio-closed'))&&cleanup.some(x=>x.includes('webgl-released'))&&cleanup.some(x=>x.includes('raf-cancelled')),'exit releases audio/render/frame');
    check(!errors.length&&!foreign.length,profile.name+' console/network '+JSON.stringify({errors,foreign}));
    results.push({profile:profile.name,input:profile.keyboard?'keyboard only':profile.touch?'emulated touch + pointer cancellation':'mouse',result:'PASS',eightPieces:true,wrongHintUndoReload:true,windVisualMotionAndSettling:true,motionPixels,settledPixels,oldSaveProtected:true,targets44pxNoOverlap:true,externalRequests:foreign.length,errors,cleanup:[...new Set(cleanup)]});
    } finally { await ctx.close(); }
  }
  return results;
}

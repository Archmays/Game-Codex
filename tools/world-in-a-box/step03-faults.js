async driver=>{
 const browser=driver.context().browser(),rows=[];
 for(const fault of ['save-failure','blocked-audio','resume-failure','late-photo','background-modal']){
 const ctx=await browser.newContext({viewport:{width:1366,height:950}}),p=await ctx.newPage(),checks=[],errors=[];p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(String(e)));
 const assert=(v,m)=>{if(!v)throw Error(m);checks.push(m);},press=s=>p.locator(s).click(),state=()=>p.locator('.wb-mount').evaluate(e=>({...e.dataset}));
 async function place(id){await press('[data-group=river]');while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');if(!await p.locator(`[data-piece=${id}]`).isVisible())await press('[data-action=next]');await press(`[data-piece=${id}]`);await press('[data-action=hint]');await press(`[data-slot=${id}]`);}
 try{
 if(fault==='save-failure')await ctx.addInitScript(()=>{localStorage.setItem('family-games/world-in-a-box/v1','{"version":1,"placed":["cat"],"open":[],"muted":true}');Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});
 if(fault==='blocked-audio')await ctx.route('**/audio/**/*.wav',r=>r.abort());
 if(fault==='resume-failure')await ctx.addInitScript(()=>{AudioContext.prototype.resume=()=>Promise.reject(new DOMException('NotAllowed','NotAllowedError'));});
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=dresden-river-campus');await p.locator('[data-ready=true]').waitFor();await place('paddle_steamer');
 if(fault==='save-failure'){
  await press('[data-action=reset]');await press('[data-action=confirm-reset]');assert((await state()).placed==='','storage failure still resets current session');assert((await p.locator('[data-message]').innerText()).includes('本次已重置，暂时无法保存'),'reset failure has exact honest saving feedback');assert(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'))==='{"version":1,"placed":["cat"],"open":[],"muted":true}','old save exact bytes protected under quota');
 }else if(fault==='blocked-audio'||fault==='resume-failure'){
  await place('river_pier');assert((await state()).placed.split(' ').length===2,'audio failure does not block assembly');await press('[data-action=boat-start]');await p.waitForFunction(()=>+document.querySelector('.wb-canvas').dataset.boat.split(',')[0]>-6.4);assert(true,'audio failure does not block toy simulation');
 }else if(fault==='late-photo'){
  let release;const held=new Promise(r=>release=r);await ctx.route('**/photos/credits.json',async r=>{await held;await r.continue().catch(()=>{});});
  await press('[data-photo=bridge]');await press('[data-action=close-photo]');await press('[data-action=reset]');await press('[data-action=confirm-reset]');release();await p.waitForResponse(r=>r.url().endsWith('credits.json'));assert(await p.locator('[data-photo-content] figure').count()===0,'late photo response cannot repopulate closed reset scene');assert((await state()).placed==='','late response cannot restore progress');
 }else{
  await press('[data-action=boat-start]');await press('[data-action=reset]');const session=await ctx.newCDPSession(p);await session.send('Emulation.setFocusEmulationEnabled',{enabled:false});const other=await ctx.newPage();await other.goto('about:blank');await other.bringToFront();await p.waitForFunction(()=>document.querySelector('.wb-mount').dataset.boatRunning==='false');await p.bringToFront();await other.close();await press('[data-action=cancel-reset]');assert((await state()).boatRunning==='false','cancel after real background interrupt stays safely paused');
  await press('[data-action=reset]');await p.keyboard.press('Tab');await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.up('Enter');assert((await state()).placed==='','held confirmation performs one reset');assert(!await p.locator('[data-reset-dialog]').isVisible(),'held Enter does not reopen reset dialog');
 }
 assert(!errors.length,'no uncaught errors');rows.push({fault,checks});
 }catch(error){return{result:'AUTO_REVISE',fault,error:String(error),checks,errors,rows,state:await state().catch(()=>null)};}finally{await ctx.close();}
 }
 return{result:'PASS_MACHINE',rows,limits:'Injected storage/autoplay/network faults are synthetic; actual tab background transition uses browser focus, not a dispatched blur.'};
}

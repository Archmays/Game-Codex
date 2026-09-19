// Isolated malformed/quota fixtures are recovery evidence, never assembly evidence.
async driver=>{
 const browser=driver.context().browser(),checks=[],old='{"fixture":"unrelated old save, preserve exact bytes"}';
 const assert=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 for(const fault of ['future-schema','denied-storage','asset-failure']){
  const ctx=await browser.newContext(),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  try{
   await ctx.addInitScript(({fault,old})=>{localStorage.setItem('family-games/world-in-a-box/v1',old);localStorage.setItem('family-games/world-in-a-box/dresden-river-campus-v2','{"schemaVersion":999,"placed":["bogus"]}');if(fault==='denied-storage')Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};},{fault,old});
   if(fault==='asset-failure')await ctx.route('**/dresden-river-campus.glb',r=>r.abort());
   await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=dresden-river-campus');
   if(fault==='asset-failure'){
    await p.getByText('城市资源暂时没装好，进度保留。可以换盒子或返回。').waitFor();
    await p.locator('[data-view=all]').click();await p.keyboard.press('Escape');assert(!errors.length,'failed-loading controls and Escape do not dereference absent mechanisms');
    await p.locator('[data-action=boxes]').click();await p.locator('[data-box=window-breeze]').click();await p.locator('[data-ready=true]').waitFor();assert(await p.locator('#wb-title').innerText()==='窗边有风','failed city load can switch back');
   }else{
    await p.locator('[data-ready=true]').waitFor();assert(await p.locator('.dc-mount').getAttribute('data-placed')==='',fault+': unsupported schema does not fabricate progress');
    if(fault==='denied-storage'){
     await p.locator('[data-piece=paddle_steamer]').click();await p.locator('[data-action=hint]').click();await p.locator('[data-slot=paddle_steamer]').click();
     assert((await p.locator('.dc-mount').getAttribute('data-placed'))==='paddle_steamer','quota failure still permits real placement');assert((await p.locator('[data-subtitle]').innerText()).includes('不能保存'),'quota failure visibly reports unsaved session');
    }
   }
   assert(await p.evaluate(()=>localStorage.getItem('family-games/world-in-a-box/v1'))===old,fault+': old bytes preserved');
   assert(!errors.length,fault+': no uncaught browser errors');
  }finally{await ctx.close();}
 }
 return{result:'PASS',checks,fixtures:'synthetic recovery only; no completion claims'};
}

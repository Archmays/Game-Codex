// Public-input adversarial checks; run through Playwright CLI after browser-check.js.
async (driver)=>{
  const ctx=await driver.context().browser().newContext({viewport:{width:1280,height:960},hasTouch:true});
  const p=await ctx.newPage();p.setDefaultTimeout(15000);const results=[];
  const check=(v,m)=>{if(!v)throw Error(m);results.push(m);};
  const state=()=>p.locator('.wb-mount').evaluate(el=>({placed:el.dataset.placed,open:el.dataset.open,wind:el.dataset.wind,selected:el.dataset.selected}));
  const press=s=>p.locator(s).click();
  const ready=()=>p.locator('[data-ready=true]').waitFor();
  async function select(id){while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');for(let n=0;n<3&&!await p.locator(`[data-piece=${id}]`).isVisible();n++)await press('[data-action=next]');await press(`[data-piece=${id}]`);await press('[data-action=hint]');}
  async function reset(){await press('[data-action=reset]');await press('[data-action=confirm-reset]');}
  async function keyTo(selector){for(let i=0;i<60;i++){if(await p.evaluate(s=>document.activeElement?.matches(s),selector))return;await p.keyboard.press('Tab');}throw Error('cannot tab to '+selector);}
  try{
    await p.goto('http://127.0.0.1:5175/?play=world-in-a-box');await ready();const focusSession=await ctx.newCDPSession(p);await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});await p.bringToFront();
    await select('cup');const b=await p.locator('[data-slot=cup]').boundingBox();
    await p.mouse.move(b.x+22,b.y+22);await p.mouse.down();
    const other=await ctx.newPage();await other.goto('about:blank');await other.bringToFront();await p.waitForTimeout(200);await p.bringToFront();await p.mouse.up();await other.close();
    check(!(await state()).placed,'native window blur during press never places');
    const cdp=await ctx.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+22,y:b.y+22,id:1},{x:b.x+75,y:b.y+22,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check(!(await state()).placed,'multiple touches never place');await cdp.detach();
    await p.locator('[data-slot=cup]').dblclick();check((await state()).placed==='cup','double click submits one placement');
    await press('[data-action=undo]');await p.waitForTimeout(500);check(!(await state()).placed,'undo during landing prevents late resurrection');
    await select('shutter_left');await press('[data-slot=shutter_left]');await p.waitForTimeout(380);await p.locator('[data-slot=shutter_left]').dblclick();check((await state()).open==='shutter_left','double click toggles window only once');
    await keyTo('[data-slot=shutter_left]');await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.up('Enter');check((await state()).wind==='false','held repeated Enter toggles once');
    await reset();await select('cup');const target=await p.locator('[data-slot=cup]').boundingBox();await p.keyboard.press('Escape');const source=await p.locator('[data-piece=cup]').boundingBox();
    await p.mouse.move(source.x+source.width/2,source.y+source.height/2);await p.mouse.down();await p.mouse.move(target.x+22,target.y+22,{steps:18});await p.mouse.up();check((await state()).placed==='cup','supplemental drag uses same placement');
    await reset();await select('shutter_left');await press('[data-slot=shutter_right]');check((await state()).placed==='shutter_right','shutters interchange with mirrored slot geometry');
    await p.waitForTimeout(380);await select('shutter_left');await press('[data-slot=shutter_left]');check((await state()).placed.split(' ').length===2,'both interchangeable shutters remain available');
    await reset();await select('cup');await press('[data-action=help]');for(let i=0;i<6;i++)await press('[data-action=right]');const view=await p.locator('.wb-view').innerText();await p.keyboard.press('Escape');await press('[data-piece=cup]');check(await p.locator('.wb-view').innerText()===view,'help off does not turn camera or reveal answer');
    await press('[data-action=exit]');await p.locator('[data-world-box-link]').waitFor();
    // Real existing entrances, no retired runtime is restored.
    await press('[data-world-treasure-link]');await p.locator('[data-game-id=world-in-a-box]').waitFor();check(await p.locator('[data-game-id]').count()===4,'Classic contains four registered products');
    await p.goto('http://127.0.0.1:5175/?world=math-world');await p.locator('[data-station-id]').first().waitFor();check((await p.locator('[data-station-id]').count())>=2,'existing math world entrance');
    await p.goto('http://127.0.0.1:5175/?play=hanzi-tower-defense');await p.locator('[data-td-pause]').waitFor();check(true,'existing tower entrance');
    await p.goto('http://127.0.0.1:5175/?play=hanzi-word-adventure');await p.locator('[data-hway-new]').waitFor();check(true,'existing adventure entrance');
    await p.goto('http://127.0.0.1:5175/?play=hanzi-radical-battle');await p.locator('[data-world-box-link]').waitFor();check(p.url().includes('notice=retired-language'),'retired route still returns home');
    return{result:'PASS',checks:results};
  }catch(e){return{result:'FAIL',checks:results,error:String(e)};}finally{await ctx.close();}
}

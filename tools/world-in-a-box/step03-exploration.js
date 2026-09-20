// All 26 pieces through normal observation controls with help OFF. No hint action.
async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1366,height:950}}),p=await ctx.newPage(),rows=[];
 const press=s=>p.locator(s).click(),ready=()=>p.locator('[data-ready=true]').waitFor();
 async function seek(id){
  const visible=()=>p.locator(`[data-slot=${id}]`).isVisible();if(await visible())return 'normal view';
  for(let level=0;level<3;level++){
   if(level)await press('[data-action=up]');const control=p.locator('[data-action=right]');await control.scrollIntoViewIfNeeded();const r=await control.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();
   let found=false;try{await p.waitForFunction(id=>{const b=document.querySelector(`[data-slot=${id}]`);return b&&!b.hidden;},id,{timeout:7200});found=true;}catch{}finally{await p.mouse.up();}
   if(found&&await visible())return 'continuous rotation / raised view '+level;
  }throw Error('No normal view reaches '+id);
 }
 async function choose(id,group){if(group)await press(`[data-group=${group}]`);while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');for(let n=0;n<3&&!await p.locator(`[data-piece=${id}]`).isVisible();n++)await press('[data-action=next]');await press(`[data-piece=${id}]`);}
 try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box');await ready();
 for(const id of ['shutter_left','shutter_right','curtain','wind_chime','plant','cup','book','cat']){await press('[data-action=view]');await choose(id);const method=await seek(id);await press(`[data-slot=${id}]`);rows.push({scene:'window',id,method});}
 await press('[data-action=boxes]');await press('[data-box=dresden-river-campus]');await ready();
 const groups={river:['river_pier','paddle_steamer','yellow_tram','augustus_bridge','riverside_trees'],oldtown:['frauenkirche_body','frauenkirche_dome','semperoper','zwinger_galleries','zwinger_crown_gate'],campus:['beyer_body','beyer_tower','slub_surface','slub_skylight','campus_bikes'],street:['street_houses','bakery_front','bench_scene']};
 for(const [group,ids] of Object.entries(groups))for(const id of ids){await press(`[data-view=${group==='street'?'all':group}]`);await choose(id,group);const before=await p.locator(`[data-slot=${id}]`).evaluate(e=>({...e.dataset,hidden:e.hidden}));const method=await seek(id);const after=await p.locator(`[data-slot=${id}]`).evaluate(e=>({...e.dataset,hidden:e.hidden}));await press(`[data-slot=${id}]`);rows.push({scene:'city',id,method,before,after});}
 if((await p.locator('.wb-mount').getAttribute('data-placed')).split(' ').length!==18)throw Error('Not all city pieces placed');if(await p.locator('[data-action=help]').getAttribute('aria-pressed')!=='false')throw Error('Help accidentally enabled');
 return{result:'PASS_MACHINE',rows};
 }catch(error){await p.screenshot({path:'tmp/tasks/world-box-step03/exploration-failure.png',fullPage:true});return{result:'AUTO_REVISE',error:String(error),rows};}finally{await ctx.close();}
}

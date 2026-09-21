async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1366,height:900}}),p=await ctx.newPage(),errors=[],rows=[];
 p.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=frozen-elsa-playground');await p.locator('[data-ready=true]').waitFor();
 await p.locator('.wb-stage').screenshot({path:'tmp/tasks/world-box-step04/opening.png'});
 const action=async a=>p.locator('[data-action="'+a+'"]').click();
 for(const kind of ['snow','bridge','rink']){await p.locator('[data-magic='+kind+']').click();await p.waitForFunction(k=>{const e=document.querySelector('.frozen-mount');return k==='snow'?e.dataset.snow==='true':e.dataset[k]==='ready';},kind);if(kind==='snow')await p.locator('[data-magic=snow]').click();}
 await action('help');
 const groups=[['anna','olaf','kristoff','sven'],['arendelle_castle','town_houses','town_lanterns'],['snow_pines','sleigh','forest_lantern'],['palace_steps','palace_column_left','palace_column_right','palace_gate','palace_spire','palace_chandelier']];
 for(const gi of [3,0,2,1]){await p.locator('[data-group="'+gi+'"]').click();const ids=groups[gi];for(let i=0;i<ids.length;i++){if(i&&i%3===0)await action('next');const id=ids[i];await p.locator('[data-piece='+id+']').click();await p.locator('[data-slot='+id+']').click();rows.push({placed:id,progress:await p.locator('span[data-progress]').textContent()});}}
 await p.locator('[data-view=all]').click();await p.locator('.wb-stage').screenshot({path:'tmp/tasks/world-box-step04/complete.png'});
 await p.locator('[data-view=lake]').click();await p.locator('.wb-stage').screenshot({path:'tmp/tasks/world-box-step04/characters.png'});
 return{result:errors.length?'AUTO_REVISE':'BROWSER_CANDIDATE',rows,errors,diagnostics:JSON.parse(await p.locator('.frozen-mount').getAttribute('data-diagnostics'))};
 }finally{await ctx.close();}
}

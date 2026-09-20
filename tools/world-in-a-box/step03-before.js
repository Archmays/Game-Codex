async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1366,height:900}}),p=await ctx.newPage(),rows=[];
 try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=dresden-river-campus');await p.locator('[data-ready=true]').waitFor();
 await p.locator('[data-view=river]').click();await p.locator('[data-action=next]').click();await p.locator('[data-piece=river_pier]').click();
 async function record(name){rows.push({name,url:p.url(),...await p.locator('.wb-mount').evaluate(root=>({state:{...root.dataset},help:root.querySelector('[data-action=help]').textContent,message:root.querySelector('[data-message]').textContent,target:{hidden:root.querySelector('[data-slot=river_pier]').hidden,style:root.querySelector('[data-slot=river_pier]').getAttribute('style')},viewport:[innerWidth,innerHeight]}))});}
 await record('help off');await p.locator('[data-action=help]').click();await record('help enabled after selection');await p.locator('[data-action=hint]').click();await record('explicit hint');await p.locator('.wb-stage').screenshot({path:'docs/world-in-a-box/step03-evidence/before-pier.png'});
 const geometry=await p.evaluate(async()=>{const {DresdenScene}=await import('/games/world-in-a-box/dresden-scene.ts');const {freshCity,freshMotion}=await import('/games/world-in-a-box/dresden-model.ts');const host=document.createElement('div');host.style='width:900px;height:500px';document.body.append(host);const s=new DresdenScene(host);await s.load();s.frame(freshCity(),freshMotion(s.routes),performance.now(),0);s.go('river');const inspect=()=>{const t=s.target('river_pier');return{target:t,angle:s.angle,pitch:s.pitch,zoom:s.zoom,slot:s.slots.get('river_pier').position.toArray(),anchor:s.asset.getObjectByName('anchor_river_pier').position.toArray()};};const normal=inspect();s.showTarget('river_pier');const hint=inspect();s.destroy();host.remove();return{normal,hint};});
 return{result:'REPRODUCED',source:'7f76ff024c9a6cd21ca9076321b7d1e5ddd624b8',rows,geometry};
 }finally{await ctx.close();}
}

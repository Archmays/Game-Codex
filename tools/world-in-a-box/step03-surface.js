// Separate exported-geometry measurement finds visible surface samples. Only actual
// mouse input acts on the game; no label hiding, camera injection or state mutation.
async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1366,height:950}}),p=await ctx.newPage(),checks=[],samples=[];
 const press=s=>p.locator(s).click(),state=()=>p.locator('.wb-mount').evaluate(e=>({...e.dataset}));
 const assert=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 async function select(id){await press('[data-group=river]');while(await p.locator('[data-action=prev]').isEnabled())await press('[data-action=prev]');if(!await p.locator(`[data-piece=${id}]`).isVisible())await press('[data-action=next]');await press(`[data-piece=${id}]`);await press('[data-action=hint]');}
 async function sample(id){return p.evaluate(async id=>{
  const {DresdenScene}=await import('/games/world-in-a-box/dresden-scene.ts'),{freshCity,freshMotion}=await import('/games/world-in-a-box/dresden-model.ts'),T=await import('/node_modules/three/build/three.module.js');
  const root=document.querySelector('.wb-mount'),canvas=root.querySelector('.wb-canvas'),rect=canvas.getBoundingClientRect(),snapshot=JSON.parse(canvas.dataset.camera),host=document.createElement('div');host.style=`position:fixed;left:-2000px;top:0;width:${rect.width}px;height:${rect.height}px`;document.body.append(host);const scene=new DresdenScene(host);
  try{await scene.load();scene.restore({...snapshot,center:new T.Vector3(...snapshot.center)});const s=freshCity();s.placed=root.dataset.placed.split(' ').filter(Boolean);const motion=freshMotion(scene.routes);scene.frame(s,motion,performance.now(),0);const object=(s.placed.includes(id)?scene.pieces:scene.slots).get(id),points=[];
   object.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/180))){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(scene.camera);points.push([(v.x+1)*rect.width/2,(1-v.y)*rect.height/2]);}});
   const h=host.getBoundingClientRect();for(const [x,y] of points){if(x<4||y<4||x>rect.width-4||y>rect.height-4)continue;const target=document.elementFromPoint(rect.left+x,rect.top+y);if(target?.tagName!=='CANVAS')continue;if(scene.pick(h.left+x,h.top+y)===id)return{x:rect.left+x,y:rect.top+y,local:[x,y],id,view:snapshot};}return null;
  }finally{scene.destroy();host.remove();}
 },id);}
 try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene=dresden-river-campus');await p.locator('[data-ready=true]').waitFor();
 for(const id of ['river_pier','paddle_steamer','yellow_tram','augustus_bridge']){
  await select(id);const hit=await sample(id);assert(!!hit,id+' has an exposed tangible mesh sample outside floating labels');samples.push(hit);await p.mouse.click(hit.x,hit.y);assert((await state()).placed.split(' ').includes(id),id+' placed by real mesh click');
 }
 await press('[data-view=river]');const hit=await sample('paddle_steamer');assert(!!hit,'installed ship exposes geometry');await p.mouse.click(hit.x,hit.y);assert(await p.locator('[data-ride-panel]').isVisible(),'installed ship geometry opens same transport actions');
 await press('[data-action=undo]');assert(!(await state()).placed.includes('augustus_bridge'),'undo leaves ship intact');await select('augustus_bridge');const drop=await sample('augustus_bridge');await p.keyboard.press('Escape');const source=await p.locator('[data-piece=augustus_bridge]').boundingBox();await p.mouse.move(source.x+source.width/2,source.y+source.height/2);await p.mouse.down();await p.mouse.move(drop.x,drop.y,{steps:20});await p.mouse.up();assert((await state()).placed.includes('augustus_bridge'),'drag releases on real geometry rather than label');
 await p.locator('.wb-stage').screenshot({path:'docs/world-in-a-box/step03-evidence/after-river.png'});
 return{result:'PASS_MACHINE',checks,samples};
 }catch(error){return{result:'AUTO_REVISE',error:String(error),checks,samples,state:await state()};}finally{await ctx.close();}
}

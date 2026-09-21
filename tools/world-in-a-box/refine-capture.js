// Fixed-camera evidence in the actual mounted game. Assembly uses public buttons.
async driver=>{
 const c=await driver.context().browser().newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),p=await c.newPage(),rows=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const phase=driver.qaPrefix||'before',dir='tmp/tasks/world-box-refine/'+phase;
 const action=a=>p.locator('[data-action='+a+']').click();
 try{for(const kind of ['frozen','dresden']){
 await p.goto('http://127.0.0.1:5175/');await p.locator('[data-world-box-link]').click();await p.locator('[data-ready=true]').waitFor();
 // Read-only inspection handle, no product debug API and no save injection.
 await p.evaluate(async kind=>{const source=await (await fetch('/games/world-in-a-box/'+kind+'-runtime.ts')).text(),url=source.match(new RegExp('from "([^"\\n]*'+kind+'-scene[^"\\n]*)"'))[1],m=await import(url),C=m[kind==='frozen'?'FrozenScene':'DresdenScene'],original=C.prototype.frame;C.prototype.frame=function(...args){window.__inspectionScene=this;return original.apply(this,args);};},kind);
 await action('boxes');const start=Date.now();await p.locator('[data-box='+(kind==='frozen'?'frozen-elsa-playground':'dresden-river-campus')+']').click();await p.locator('[data-ready=true]').waitFor();const loadMs=Date.now()-start;
 const groups=kind==='frozen'?{'3':['palace_spire','palace_chandelier','palace_steps','palace_column_left','palace_column_right','palace_gate'],'0':['anna','olaf','kristoff','sven'],'1':['arendelle_castle','town_houses','town_lanterns'],'2':['snow_pines','sleigh','forest_lantern']}:{oldtown:['frauenkirche_dome','frauenkirche_body','semperoper','zwinger_galleries','zwinger_crown_gate'],river:['yellow_tram','paddle_steamer','augustus_bridge','river_pier','riverside_trees'],campus:['beyer_tower','beyer_body','slub_skylight','slub_surface','campus_bikes'],street:['street_houses','bakery_front','bench_scene']};
 for(const [group,ids] of Object.entries(groups))for(const id of ids){await p.locator('[data-group="'+group+'"]').click();while(await p.locator('[data-action=prev]').isEnabled())await action('prev');if(!await p.locator('[data-piece='+id+']').isVisible())await action('next');await p.locator('[data-piece='+id+']').click();await action('hint');await p.locator('[data-slot='+id+']').click();}
 await p.locator('[data-view=all]').click();await p.waitForTimeout(400);
 const capture=async name=>{await p.waitForTimeout(100);await p.locator('.wb-canvas canvas').screenshot({path:dir+'/'+name+'.png'});rows.push({name,camera:await p.locator('.wb-canvas').getAttribute('data-camera')});};
 await capture(kind+'-all');
 const views=kind==='frozen'?[['elsa','lake'],['palace','palace']]:[['church','oldtown'],['bridge','river']];
 for(const [name,view] of views){await p.locator('[data-view='+view+']').click();for(let i=0;i<10;i++)await action('in');for(let i=0;i<3;i++)await action('down');await capture(name+'-near');
 // Exact 2.2 rad orbit is a diagnostic camera pose inside the allowed orbit range.
 await p.evaluate(()=>window.__inspectionScene.turn(2.2));await capture(name+'-rear');for(let i=0;i<10;i++)await action('out');await capture(name+'-rear-context');for(let i=0;i<10;i++)await action('in');await p.evaluate(()=>window.__inspectionScene.turn(-2.2));
 await p.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),s=window.__inspectionScene;s.scene.overrideMaterial=new T.MeshStandardMaterial({color:0xb5b5b5,roughness:.8});window.__savedLights=[];s.scene.traverse(o=>{if(o.isLight){window.__savedLights.push([o,o.intensity]);o.intensity=o.isHemisphereLight?1.5:o.position.x<0?2:0.5;}});s.renderer.toneMappingExposure=1;});await capture(name+'-neutral');
 await p.evaluate(()=>{const s=window.__inspectionScene;s.scene.overrideMaterial.dispose();s.scene.overrideMaterial=null;for(const [l,intensity] of window.__savedLights)l.intensity=intensity;s.renderer.toneMappingExposure=s.constructor.name==='FrozenScene'?1.04:.92;});}
 await p.locator('[data-view=all]').click();const performanceData=await p.evaluate(()=>new Promise(resolve=>{let prev=performance.now();const a=[];function f(t){a.push(t-prev);prev=t;if(a.length<121)requestAnimationFrame(f);else{a.shift();a.sort((a,b)=>a-b);const s=window.__inspectionScene;resolve({medianMs:a[60],p95Ms:a[114],calls:s.renderer.info.render.calls,renderTriangles:s.renderer.info.render.triangles,resources:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.glb')).map(r=>({path:new URL(r.name).pathname,bytes:r.decodedBodySize,duration:r.duration}))});}}requestAnimationFrame(f);}));rows.push({kind,loadMs,performanceData});
 }return{phase,rows,errors,result:errors.length?'AUTO_REVISE':'CAPTURED'};}finally{await c.close();}
}

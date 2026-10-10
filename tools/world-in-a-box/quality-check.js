// Isolated same-origin browser comparison; assembly uses public controls only.
async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}),p=await ctx.newPage(),rows=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const dir='tmp/tasks/world-box-refine/'+(driver.qaPrefix||'after');
 const click=s=>p.locator(s).click(),action=a=>click('[data-action='+a+']');
 async function hook(kind){await p.evaluate(async kind=>{const hooks=window.__qualityHooks??=new Set();if(hooks.has(kind))return;const source=await (await fetch('/games/world-in-a-box/'+kind+'-runtime.ts')).text(),url=source.match(new RegExp('from "([^"\\n]*'+kind+'-scene[^"\\n]*)"'))[1],m=await import(url),C=m[kind==='frozen'?'FrozenScene':'DresdenScene'],frame=C.prototype.frame;C.prototype.frame=function(...args){window.__qualityScene=this;return frame.apply(this,args);};hooks.add(kind);},kind);}
 async function current(kind){await p.waitForFunction(kind=>{const s=window.__qualityScene;return s?.renderer.domElement===document.querySelector('.wb-canvas canvas')&&s.constructor.name===(kind==='frozen'?'FrozenScene':'DresdenScene');},kind);}
 const groups={frozen:{0:['anna','olaf','kristoff','sven'],1:['arendelle_castle','town_houses','town_lanterns'],2:['snow_pines','sleigh','forest_lantern'],3:['palace_steps','palace_column_left','palace_column_right','palace_gate','palace_spire','palace_chandelier']},dresden:{river:['yellow_tram','paddle_steamer','augustus_bridge','river_pier','riverside_trees'],oldtown:['frauenkirche_body','frauenkirche_dome','semperoper','zwinger_galleries','zwinger_crown_gate'],campus:['beyer_body','beyer_tower','slub_surface','slub_skylight','campus_bikes'],street:['street_houses','bakery_front','bench_scene']}};
 async function measure(label){return p.evaluate(async label=>{
  const s=window.__qualityScene,frame=s.frame.bind(s),times=[],raf=[],ids=new Set();let last=performance.now();
  s.frame=function(...args){const start=performance.now();const r=frame(...args);times.push(performance.now()-start);if(s.trail)ids.add(s.trail.geometry.id);return r;};
  await new Promise(resolve=>{function f(now){raf.push(now-last);last=now;if(raf.length<241)requestAnimationFrame(f);else resolve();}requestAnimationFrame(f);});s.frame=frame;times.sort((a,b)=>a-b);raf.shift();raf.sort((a,b)=>a-b);
  return{label,samples:times.length,frameCpuMedianMs:times[Math.floor(times.length*.5)],frameCpuP95Ms:times[Math.floor(times.length*.95)],rafMedianMs:raf[120],rafP95Ms:raf[228],trailGeometries:ids.size,diagnostics:s.diagnostics?.()??{calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,memory:s.renderer.info.memory}};
 },label);}
 try{for(const kind of ['frozen','dresden']){
  await p.goto('http://127.0.0.1:5175/?play=world-in-a-box');await p.locator('[data-ready=true]').waitFor();
  await hook(kind);
  await action('boxes');await click('[data-box='+(kind==='frozen'?'frozen-elsa-playground':'dresden-river-campus')+']');await p.locator('[data-ready=true]').waitFor();await current(kind);
  for(const [group,ids] of Object.entries(groups[kind]))for(const id of ids){await click('[data-group="'+group+'"]');while(await p.locator('[data-action=prev]').isEnabled())await action('prev');if(!await p.locator('[data-piece='+id+']').isVisible())await action('next');await click('[data-piece='+id+']');await action('hint');await click('[data-slot='+id+']');if(id===(kind==='frozen'?'palace_spire':'frauenkirche_body')){await p.waitForTimeout(120);await p.locator('.wb-stage').screenshot({path:dir+'/'+kind+'-placement.png'});}}
  await click('[data-view=all]');await p.waitForTimeout(1200);await p.locator('.wb-stage').screenshot({path:dir+'/'+kind+'-all.png'});rows.push({kind,metric:await measure('assembled-idle'),camera:await p.locator('.wb-canvas').getAttribute('data-camera')});
  if(kind==='frozen'){await click('[data-magic=rink]');await p.waitForFunction(()=>document.querySelector('.frozen-mount').dataset.rink==='ready');await action('friends');await action('olaf-play');await action('circle');rows.push({kind,metric:await measure('skating')});await action('skate-stop');}
  else{await click('[data-view=oldtown]');await p.locator('.wb-stage').screenshot({path:dir+'/dresden-oldtown.png'});await click('[data-view=river]');await p.locator('.wb-stage').screenshot({path:dir+'/dresden-river.png'});}
 }
 // Three bounded re-entries per changed scene, with real scene-picker actions.
 // The second full-page goto above creates a fresh module realm; install both hooks here.
 await hook('frozen');await hook('dresden');
 await p.evaluate(()=>{window.__qualityRetired={renderers:0,rings:0,trails:0,contexts:0,contextRequests:0,contextLostStates:0};});
 const resources=[];
 async function watchCurrent(){await p.evaluate(()=>{const s=window.__qualityScene;if(s?.renderer.domElement!==document.querySelector('.wb-canvas canvas'))throw Error('Inspection handle is not the active scene');const stats=window.__qualityRetired,dispose=s.renderer.dispose.bind(s.renderer),lose=s.renderer.forceContextLoss.bind(s.renderer),publish=()=>sessionStorage.setItem('world-box-qa-retired',JSON.stringify(stats));s.renderer.dispose=()=>{stats.renderers++;dispose();publish();};s.renderer.forceContextLoss=()=>{stats.contextRequests++;lose();if(s.renderer.getContext().isContextLost())stats.contextLostStates++;publish();};s.renderer.domElement.addEventListener('webglcontextlost',()=>{stats.contexts++;publish();});s.glow.mesh.geometry.addEventListener('dispose',()=>stats.rings++);s.trail?.geometry.addEventListener('dispose',()=>stats.trails++);});}
 for(let round=0;round<3;round++)for(const kind of ['frozen','dresden']){
  await watchCurrent();await action('boxes');await click('[data-box='+(kind==='frozen'?'frozen-elsa-playground':'dresden-river-campus')+']');await p.locator('[data-ready=true]').waitFor();await current(kind);
  const memory=await p.evaluate(()=>({...window.__qualityScene.renderer.info.memory})),canvasCount=await p.locator('canvas').count();
  if(canvasCount!==1)throw Error('Scene switches accumulated canvases');resources.push({round,kind,memory,canvasCount});
 }
 for(const kind of ['frozen','dresden']){const samples=resources.filter(x=>x.kind===kind);if(samples.some(x=>JSON.stringify(x.memory)!==JSON.stringify(samples[0].memory)))throw Error(kind+' memory grew across three re-entries');}
 await p.waitForFunction(()=>window.__qualityRetired.contextLostStates===6);
 await watchCurrent();await action('exit');await p.waitForURL(url=>!url.searchParams.has('play'));
 const retired=await p.evaluate(()=>{const value=JSON.parse(sessionStorage.getItem('world-box-qa-retired'));sessionStorage.removeItem('world-box-qa-retired');return value;}),canvasCount=await p.locator('canvas').count();
 if(retired.renderers!==7||retired.rings!==7||retired.trails!==3||retired.contextRequests!==7||retired.contextLostStates!==7||canvasCount!==0)throw Error('Incomplete scene-resource release '+JSON.stringify({retired,canvasCount}));
 rows.push({resources,retired,canvasCount,scope:'Three re-entries per changed scene; owned geometry disposal and direct WebGL isContextLost states. Events and loss requests recorded separately; not whole-process GPU memory.'});
 return{result:errors.length?'AUTO_REVISE':'PASS_MACHINE',rows,errors};}finally{await ctx.close();}
}

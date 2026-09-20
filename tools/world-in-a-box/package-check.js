async driver=>{
 const ctx=await driver.context().browser().newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();const requests=[],errors=[];
 p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(String(e)));
 await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5175/')?r.continue():r.abort());
 await ctx.addInitScript(()=>{const original=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...rest){if(target instanceof AudioDestinationNode){const analyser=this.context.createAnalyser();analyser.fftSize=2048;original.call(analyser,target);window.qaAnalyser=analyser;return original.call(this,analyser,...rest);}return original.call(this,target,...rest);};});
 const click=s=>p.locator(s).click();const assert=(v,m)=>{if(!v)throw Error(m);};
 async function amplitude(duration){let max=0;const start=Date.now();while(Date.now()-start<duration){max=Math.max(max,await p.evaluate(()=>{const a=window.qaAnalyser;if(!a)return 0;const d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);return Math.sqrt(d.reduce((sum,v)=>sum+v*v,0)/d.length);}));await p.waitForTimeout(60);}return max;}
 try{
  await p.goto('http://127.0.0.1:5175/Game-Codex/');await p.locator('[data-world-box-link]').waitFor();
  assert(!requests.some(url=>/\/runtime-[^/]+\.js|\.glb/.test(url)),'Three game/assets were eagerly loaded on home');
  await click('[data-world-box-link]');await p.locator('[data-ready=true]').waitFor();assert(p.url().includes('/Game-Codex/?play='),'query link dropped project prefix');
  await p.waitForTimeout(400);const baseline=await p.screenshot({path:'docs/world-in-a-box/evidence/fresh-scene.png',fullPage:true});
  await p.reload();await p.locator('[data-ready=true]').waitFor();await p.waitForTimeout(400);assert(baseline.equals(await p.screenshot({fullPage:true})),'no-update fresh screenshot changed after reload');
  async function place(id){while(await p.locator('[data-action=prev]').isEnabled())await click('[data-action=prev]');for(let i=0;i<3&&!await p.locator(`[data-piece=${id}]`).isVisible();i++)await click('[data-action=next]');await click(`[data-piece=${id}]`);await click('[data-action=hint]');await click(`[data-slot=${id}]`);await p.waitForTimeout(370);}
  await place('shutter_left');await click('[data-slot=shutter_left]');await place('wind_chime');await click('[data-action=view]');
  await click('[data-sound-settings]');await p.locator('[data-channel=music]').press('Home');await p.locator('[data-channel=ambient]').press('Home');await click('[data-sound-close]');
  const audible=await amplitude(3600);assert(audible>.00001,'live wind chime PCM missing');
  await click('[data-slot=shutter_left]');await p.waitForTimeout(1300);const stopped=await amplitude(2700);assert(stopped<.00001,'wind chime persists after closing window');
  await click('[data-slot=shutter_left]');await click('[data-action=mute]');await p.waitForTimeout(1000);const muted=await amplitude(2700);assert(muted<.00001,'mute leaves audio');
  for(const id of ['shutter_right','curtain','plant','cup','book','cat'])await place(id);
  await click('[data-action=view]');for(let i=0;i<6;i++)await click('[data-action=right]');await p.waitForTimeout(800);
  await p.screenshot({path:'docs/world-in-a-box/evidence/outside-scene.png',fullPage:true});
  assert((await p.locator('.wb-mount').getAttribute('data-placed')).split(' ').length===8,'subpath completion');assert(!errors.length,errors.join('\n'));
  return{result:'PASS',server:'relocated static package',origin:'http://127.0.0.1:5175',subpath:'/Game-Codex/',externalNetwork:'blocked before first navigation',homeLazyLoading:true,eightPieces:true,unchangedFreshVisualBaseline:true,liveAudioRMS:{audible,stopped,muted},errors};
 }finally{await ctx.close();}
}

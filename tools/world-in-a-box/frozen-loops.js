// Three real-time loops, current scene music only. No accelerated playback clock.
async driver=>{
 const {writeFile}=await import('node:fs/promises'),browser=driver.context().browser(),rows=[];
 for(const scene of ['frozen-elsa-playground']){
 const ctx=await browser.newContext({viewport:{width:900,height:700}}),p=await ctx.newPage();
 try{
 await ctx.addInitScript(()=>{const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...rest){const out=connect.call(this,target,...rest);if(target instanceof AudioDestinationNode){const analyser=this.context.createAnalyser();analyser.fftSize=2048;connect.call(this,analyser);const sink=this.context.createMediaStreamDestination();connect.call(this,sink);const rec=new MediaRecorder(sink.stream),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);rec.start();window.loopQA={analyser,rec,chunks,peaks:[],start:performance.now()};}return out;};});
 await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5175/')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box&scene='+scene);await p.locator('[data-ready=true]').waitFor();await p.locator('[data-sound-settings]').click();for(const key of ['sfx','ambient'])await p.locator(`[data-channel=${key}]`).press('Home');await p.locator('[data-sound-close]').click();
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.wb-mount').dataset.diagnostics).audio.loops.some(l=>l.key==='music'));
 const initial=await p.locator('.wb-mount').evaluate(e=>JSON.parse(e.dataset.diagnostics).audio.loops.find(l=>l.key==='music'));
 const duration=104.34783333333333;
 const measured=await p.evaluate(async ({duration})=>{const samples=[],start=performance.now();while(performance.now()-start<(duration*3+.4)*1000){const a=loopQA.analyser,d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);samples.push({time:(performance.now()-start)/1000,rms:Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length),peak:Math.max(...d.map(Math.abs))});await new Promise(r=>setTimeout(r,50));}return{seconds:(performance.now()-start)/1000,peak:Math.max(...samples.map(s=>s.peak)),seams:samples.filter(s=>[duration,duration*2,duration*3].some(t=>Math.abs(s.time-t)<.15)),nonzero:samples.filter(s=>s.rms>.00001).length,total:samples.length};},{duration});
 const final=await p.locator('.wb-mount').evaluate(e=>JSON.parse(e.dataset.diagnostics).audio.loops.find(l=>l.key==='music'));
 if(initial.started!==final.started||measured.peak>.95||measured.seams.some(s=>s.rms<.00001))throw Error('Loop source changed, clipping or silent seam');
 const data=await p.evaluate(async()=>{await new Promise(r=>{loopQA.rec.onstop=r;loopQA.rec.stop();});return new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(loopQA.chunks,{type:'audio/webm'}));});});await writeFile(`tmp/tasks/world-box-step04/${scene}-three-loops.webm`,Buffer.from(data,'base64'));
 rows.push({scene,initial,final,measured});console.log(scene+' three real-time loops recorded');
 }finally{await ctx.close();}
 }
 return{result:'PASS_MACHINE',rows,listening:'NOT_TESTED; recordings retained for perceptual listening, numeric PCM does not establish aesthetic suitability'};
}

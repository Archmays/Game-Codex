// Real public actions, isolated synthetic save; render inspection does not advance motion.
async driver=>{
 const c=await driver.context().browser().newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),rows=[],errors=[],dir='tmp/tasks/world-box-refine/actions';p.on('pageerror',e=>errors.push(e.message));
 const a=x=>p.locator('[data-action='+x+']').click(),ready=()=>p.locator('[data-ready=true]').waitFor();
 try{
 await p.goto('http://127.0.0.1:5175/?play=world-in-a-box');await ready();
 await p.evaluate(async()=>{const s=await(await fetch('/games/world-in-a-box/frozen-runtime.ts')).text(),u=s.match(/from "([^"\n]*frozen-scene[^"\n]*)"/)[1],{FrozenScene}=await import(u),f=FrozenScene.prototype.frame;FrozenScene.prototype.frame=function(...args){window.__inspectionScene=this;return f.apply(this,args);};});
 await a('boxes');await p.locator('[data-box=frozen-elsa-playground]').click();await ready();
 await p.locator('[data-magic=snow]').click();await p.locator('[data-view=lake]').click();for(let i=0;i<5;i++)await a('in');for(let i=0;i<3;i++)await a('down');
 await p.waitForTimeout(500);await p.locator('.wb-canvas canvas').screenshot({path:dir+'/cast.png'});
 rows.push(await p.evaluate(()=>{const s=window.__inspectionScene,h=s.asset.getObjectByName('elsa_hand'),root=s.asset.getObjectByName('elsa'),shoulder=s.asset.getObjectByName('elsa_arm_-1'),hand=h.getWorldPosition(s.spark.position.clone()),forward=s.spark.position.clone().set(0,0,1).applyQuaternion(root.getWorldQuaternion(s.spark.quaternion.clone()));return{state:'cast',hand:hand.toArray(),effect:s.spark.position.toArray(),error:hand.distanceTo(s.spark.position),handForwardOfShoulder:hand.clone().sub(shoulder.getWorldPosition(s.spark.position.clone())).dot(forward),clips:s.diagnostics().playing};}));
 await p.waitForFunction(()=>!JSON.parse(document.querySelector('.frozen-mount').dataset.diagnostics).scene.playing.includes('elsa_cast'));
 const groups={'3':['palace_spire','palace_chandelier','palace_gate','palace_steps','palace_column_left','palace_column_right'],'0':['anna','kristoff','sven','olaf'],'2':['sleigh']};
 for(const [g,ids] of Object.entries(groups))for(const id of ids){await p.locator('[data-group="'+g+'"]').click();while(await p.locator('[data-action=prev]').isEnabled())await a('prev');if(!await p.locator('[data-piece='+id+']').isVisible())await a('next');await p.locator('[data-piece='+id+']').click();await a('hint');await p.locator('[data-slot='+id+']').click();}
 await p.locator('[data-view=palace]').click();await a('palace');await a('door');await a('chandelier');await p.waitForTimeout(300);await p.locator('.wb-canvas canvas').screenshot({path:dir+'/palace-open.png'});
 await p.locator('[data-view=all]').click();await p.locator('[data-magic=bridge]').click();await p.waitForFunction(()=>document.querySelector('.frozen-mount').dataset.bridge==='ready');await a('friends');await a('sleigh-play');await a('anna');await a('palace-ride');
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.frozen-mount').dataset.ride).t>.45);await a('ride-pause');await p.locator('.wb-canvas canvas').screenshot({path:dir+'/passengers.png'});await a('ride-continue');
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.frozen-mount').dataset.ride).t===1);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.frozen-mount').dataset.diagnostics).scene.playing.some(x=>x.includes('elsa_walk')));await p.waitForTimeout(3800);await p.locator('.wb-canvas canvas').screenshot({path:dir+'/elsa-walk.png'});
 rows.push({state:'walk',diagnostics:JSON.parse(await p.locator('.frozen-mount').getAttribute('data-diagnostics'))});
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.frozen-mount').dataset.diagnostics).scene.playing.includes('elsa_wave'));await p.locator('[data-view=palace]').click();await p.waitForTimeout(500);await p.locator('.wb-canvas canvas').screenshot({path:dir+'/elsa-wave.png'});
 await p.locator('[data-view=all]').click();await p.locator('[data-magic=bridge]').click();await p.waitForFunction(()=>document.querySelector('.frozen-mount').dataset.bridge==='off');rows.push({state:'safe retraction',pending:await p.locator('.frozen-mount').getAttribute('data-pending')});
 if(errors.length||rows[0].error>.00001||rows[0].handForwardOfShoulder<.1)throw Error(JSON.stringify({errors,rows}));return{result:'PASS_MACHINE',rows,errors};
 }finally{await c.close();}
}

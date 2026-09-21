import type {MountGameContext,MountedGame} from '../../packages/game-core';
import {rovingGroup,bindInputLifecycle,ignoreGameKey} from '../../packages/ui/input';
import {FROZEN_IDS,FROZEN_LABELS,GROUPS,FROZEN_KEY,frozenGroup,freshFrozen,restoreFrozen,freshFrozenMotion,assemble,magic,startRide,startSkate,undoFrozen,stepFrozen,rideMissing,type FrozenPiece,type Magic} from './frozen-model';
import {FrozenScene} from './frozen-scene';
import {continuousTurn} from './continuous-turn';
import {boxSound} from './audio-settings';
import './style.css';import './frozen.css';
export function mountFrozen({container:root,storage,onExit}:MountGameContext):MountedGame{
 let state=restoreFrozen(storage.get(FROZEN_KEY,null)),motion=freshFrozenMotion(state),selected:FrozenPiece|null=null,group=0,page=0,ready=false,dead=false,raf=0,last=performance.now(),background=false,warning=false;
 const history:FrozenPiece[]=[],abort=new AbortController(),signal=abort.signal,pauses=new Set<string>();
 const button=(action:string,text:string)=>`<button data-action="${action}">${text}</button>`;
 root.className='wb-mount frozen-mount';root.innerHTML=`<main class="wb frozen" aria-labelledby="wb-title"><header class="wb-header"><div><p>世界盒子 <span>03 / SNOW DAY</span></p><h1 id="wb-title">艾莎的冰雪游乐日</h1></div>${button('exit','返回 ↗')}</header><div class="wb-intro"><p role="status" data-message>点雪花，让艾莎试试魔法。</p><span data-progress>0 / 16</span></div><nav class="fr-views" aria-label="观察小世界">${[['all','看全城'],['town','看城镇'],['lake','看雪湖'],['palace','看冰宫']].map(([id,label])=>`<button data-view="${id}">${label}</button>`).join('')}</nav><div class="fr-workbench"><div><section class="wb-stage" aria-label="艾莎的三维冰雪世界"><div class="wb-canvas"></div><div class="wb-targets" role="group" aria-label="场景里的动作与位置"></div><p class="wb-loading">正在打开冰雪盒子……</p></section><nav class="wb-camera" aria-label="转动与近看">${button('left','↶ 按住左转')}${button('right','按住右转 ↷')}${button('up','抬高')}${button('down','放低')}${button('in','放大')}${button('out','缩小')}</nav><section class="fr-near" data-near hidden aria-label="朋友的玩法"><div class="fr-actions">${button("sleigh-play","雪橇游览")}${button("olaf-play","和雪宝玩")}</div><div data-play="sleigh" hidden><strong>雪橇游览</strong><p data-ride-status></p><div data-missing></div><div class="fr-actions">${button('lake-ride','雪湖兜一圈')}${button('palace-ride','去冰宫')}${button('ride-pause','暂停')}${button('ride-continue','继续')}${button('ride-return','返回停车位')}${button('anna','带上安娜')}${button('follow','跟随 / 退出跟随')}</div></div><div data-play="olaf" hidden><strong>和雪宝一起玩</strong><p data-skate-status></p><div class="fr-actions">${button('wave','招手 / 重新组合')}${button('circle','滑圆圈')}${button('eight','滑八字')}${button('skate-stop','到场边停下')}${button('bridge-walk','走过冰桥')}${button('bridge-back','走回平台')}</div></div><div data-play="palace" hidden><strong>冰宫里的光</strong><div class="fr-actions">${button('door','开 / 合冰门')}${button('chandelier','轻摆吊灯')}</div></div>${button('close-near','收起操作')}</section></div><section class="wb-tray" aria-label="待拼物件"><nav class="fr-groups" aria-label="托盘分组">${GROUPS.map((name,i)=>`<button data-group="${i}">${name}</button>`).join('')}</nav><div class="wb-tray-top"><span data-selection>选一件，也可以先玩魔法</span>${button('cancel','放回托盘')}</div><div class="wb-tray-line">${button('prev','上一页')}<div class="wb-pieces" role="group" aria-label="物件托盘"></div>${button('next','下一页')}</div><p data-page></p><p class="fr-tip">点选一件，再点它的形状站位。<br>四组自由选择，不必按顺序。</p></section></div><footer class="wb-tools">${button('resume-world','继续玩')}${button('help','帮助：关')}${button('hint','找找位置')}${button('undo','撤销 (Z)')}${button('friends','朋友玩法')}${button('palace','冰宫玩法')}${button('mute','声音：开')}${button('reset','重置本关')}</footer><p class="wb-subtitle" data-subtitle>自制同人玩具场景 · 非官方作品。魔法是幻想表现。</p><dialog class="wb-dialog" data-reset aria-label="重置冰雪盒子"><h2>重新拼冰雪盒子吗？</h2><p>只收回本盒16件和魔法；艾莎、固定背景、其他盒子的进度及声音设置保留。</p>${button('cancel-reset','继续玩')}${button('confirm-reset','确认重置')}</dialog></main>`;
 const q=<E extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<E>(s)!,control=(a:string)=>q<HTMLButtonElement>(`[data-action="${a}"]`),say=(text:string)=>{q('[data-message]').textContent=text;};
 const stage=q('.wb-stage'),targets=q('.wb-targets'),tray=q('.wb-pieces'),reset=q<HTMLDialogElement>('[data-reset]');
 let scene:FrozenScene;try{scene=new FrozenScene(q('.wb-canvas'));}catch{q('.wb-loading').textContent='三维画面暂时打不开，进度保留。';control('exit').onclick=onExit;return{destroy(){root.replaceChildren();}};}
 for(const id of FROZEN_IDS){const b=document.createElement('button');b.dataset.piece=id;b.className='wb-piece';b.hidden=true;b.setAttribute('aria-label','选择'+FROZEN_LABELS[id]);b.innerHTML='<img alt="" draggable="false"><span>'+FROZEN_LABELS[id]+'</span>';tray.append(b);const slot=document.createElement('button');slot.dataset.slot=id;slot.className='wb-slot';slot.textContent='放下'+FROZEN_LABELS[id];slot.hidden=true;targets.append(slot);}
 for(const [id,label] of [['bridge','❄ 长出冰桥'],['rink','◇ 冻结冰场'],['snow','✧ 飘雪']] as const){const b=document.createElement('button');b.dataset.magic=id;b.className='wb-slot fr-magic';b.textContent=label;targets.append(b);}
 const navs=[rovingGroup(tray,{items:'[data-piece]'}),rovingGroup(targets,{items:'button'}),rovingGroup(q('.fr-groups'),{items:'button'})];
 const sounds=boxSound(root,storage,'frozen-elsa-playground',false,()=>update()),audio=sounds.audio;
 const save=()=>{try{storage.set(FROZEN_KEY,state);warning=JSON.stringify(storage.get(FROZEN_KEY,null))!==JSON.stringify(state);}catch{warning=true;}if(warning)say('这次变化已生效，暂时无法保存。');};
 let panel:'sleigh'|'olaf'|'palace'|null=null;
 const stopTurn=continuousTurn(root,d=>{if(ready&&!pauses.size){motion.follow=false;scene.turn(d);layout();}},signal);
 function show(which:typeof panel){panel=which;update();if(which)q('[data-near]').scrollIntoView({block:'nearest'});}
 function layout(){if(!ready)return;const used:{left:number;right:number;top:number;bottom:number}[]=[];
  for(const b of targets.querySelectorAll<HTMLButtonElement>('button')){const id=b.dataset.slot,kind=b.dataset.magic as Magic|undefined;const show=id?selected===id&&!state.placed.includes(id as FrozenPiece):!selected;if(!show){b.hidden=true;continue;}const t=scene.target(id??'magic_'+kind);b.hidden=!t.visible;if(b.hidden)continue;
   let placed=false;for(const dy of [0,-54,54,-108,108]){const x=Math.max(b.offsetWidth/2+5,Math.min(targets.clientWidth-b.offsetWidth/2-5,t.x)),y=t.y+dy;const r={left:x-b.offsetWidth/2,right:x+b.offsetWidth/2,top:y-b.offsetHeight/2,bottom:y+b.offsetHeight/2};if(r.top<5||r.bottom>targets.clientHeight-5||used.some(a=>r.left<a.right+5&&r.right>a.left-5&&r.top<a.bottom+5&&r.bottom>a.top-5))continue;b.style.left=x+'px';b.style.top=y+'px';used.push(r);placed=true;break;}b.hidden=!placed;
  }navs[1].refresh();
 }

 function update(){control('resume-world').hidden=!motion.paused;q('[data-progress]').textContent=state.placed.length+' / 16';root.dataset.progress=String(state.placed.length);root.dataset.bridge=motion.bridge;root.dataset.rink=motion.rink;root.dataset.snow=String(motion.snow>0);root.dataset.ride=JSON.stringify(motion.ride);root.dataset.pending=motion.pending?.kind??'';
  q('[data-selection]').textContent=selected?'正在拿：'+FROZEN_LABELS[selected]:'空手 · 点场景雪花试魔法';control('cancel').disabled=!selected;control('undo').disabled=!history.length||!!motion.pending;control('help').textContent='帮助：'+(state.help?'开':'关');control('mute').textContent='声音：'+(audio.preferences.muted?'关':'开');
  const ids=FROZEN_IDS.filter(id=>frozenGroup(id)===group);page=Math.min(page,Math.floor((ids.length-1)/3));for(const id of FROZEN_IDS){const b=q<HTMLButtonElement>(`[data-piece="${id}"]`);b.hidden=!ids.slice(page*3,page*3+3).includes(id);b.disabled=state.placed.includes(id);b.setAttribute('aria-pressed',String(selected===id));}
  control('prev').disabled=page===0;control('next').disabled=(page+1)*3>=ids.length;q('[data-page]').textContent=`${page+1} / ${Math.ceil(ids.length/3)}`;for(const b of root.querySelectorAll<HTMLButtonElement>('[data-group]'))b.setAttribute('aria-pressed',String(Number(b.dataset.group)===group));
  q('[data-near]').hidden=!panel;for(const el of root.querySelectorAll<HTMLElement>('[data-play]'))el.hidden=el.dataset.play!==panel;
  const missing=rideMissing(state);q('[data-ride-status]').textContent=missing.length?'还需要：'+missing.map(id=>FROZEN_LABELS[id]).join('、'):motion.ride.blocked?'在桥前停好了。长出冰桥，再按继续。':motion.pending?'先到安全平台。':motion.ride.running?(motion.elsaTrip>0&&motion.elsaTrip<1||motion.bridgeWalk>0?'等朋友先走到平台，再前进。':'雪橇正在游览。'):motion.ride.t===1?'到站啦。可以返回，再选一条路。':'已经停稳，可以出发。';
  const missingRoot=q('[data-missing]');if(missingRoot.dataset.ids!==missing.join(',')){missingRoot.dataset.ids=missing.join(',');missingRoot.replaceChildren();for(const id of missing){const b=document.createElement('button');b.dataset.locate=id;b.textContent='找'+FROZEN_LABELS[id];missingRoot.append(b);}}
  for(const a of ['lake-ride','palace-ride','ride-continue','ride-return'])control(a).disabled=!!missing.length||!!motion.pending;control('anna').disabled=!state.placed.includes('anna')||!!missing.length||motion.ride.t!==0;control('anna').textContent=motion.ride.anna?'安娜下车':'带上安娜';
  q('[data-skate-status]').textContent=!state.placed.includes('olaf')?'先把雪宝放在雪湖边。':motion.rink!=='ready'?'先冻结冰场，就可以滑行。':'圆圈和八字，都可以试试。';for(const a of ['wave','circle','eight','skate-stop','bridge-walk','bridge-back'])control(a).disabled=!state.placed.includes('olaf');control('circle').disabled||=motion.rink!=='ready';control('eight').disabled||=motion.rink!=='ready';control('bridge-walk').disabled||=motion.bridge!=='ready'||motion.skate.entry>0;
  control('door').disabled=!state.placed.includes('palace_gate');control('chandelier').disabled=!state.placed.includes('palace_chandelier');
  for(const kind of ['bridge','rink','snow'] as Magic[]){const b=q<HTMLButtonElement>(`[data-magic="${kind}"]`);b.textContent=kind==='snow'?(motion.snow>0?'✧ 停止飘雪':'✧ 飘雪'):kind==='bridge'?(motion.bridge==='ready'?'❄ 收起冰桥':'❄ 长出冰桥'):(motion.rink==='ready'?'◇ 收起冰场':'◇ 冻结冰场');}
  navs.forEach(n=>n.refresh());layout();
 }
 function reveal(){if(!selected)return;motion.follow=false;stage.scrollIntoView({block:'center'});const id=selected;const ok=scene.reveal(id,()=>{layout();const b=q<HTMLButtonElement>(`[data-slot="${id}"]`),r=b.getBoundingClientRect();return!b.hidden&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b;});say(ok?'看看形状站位，点它就能放下。':'转一转，找能看清的站位。');layout();}
 function choose(id:FrozenPiece){if(!ready||state.placed.includes(id)||motion.pending)return;selected=id;motion.follow=false;audio.event('pick');update();if(state.help)reveal();}
 function place(id:FrozenPiece){if(!ready||!selected)return;const previous=selected;if(!assemble(state,selected,id)){say('这里的形状不太合适，再看看。');return;}history.push(id);selected=null;scene.land(id);save();audio.place(frozenGroup(id)===3?1.4:.7);say(state.placed.length===16?'拼好了！还可以施法、游览和滑冰。':FROZEN_LABELS[id]+'归位啦。');if(state.placed.length===16)audio.event('complete');scene.frame(state,motion,0);update();const next=tray.querySelector<HTMLButtonElement>('button:not([hidden]):not(:disabled)');(next??q<HTMLButtonElement>(`[data-group="${frozenGroup(previous)}"]`)).focus({preventScroll:true});}
 function cast(kind:Magic){if(selected){say('正在拿拼件，先放好或放回托盘。');return;}const before=motion.cast;say(magic(state,motion,kind));if(motion.cast&&!before)audio.event('frozen-gather');update();}
 function modal(reason:string,open:boolean){cancelGesture();if(open)pauses.add(reason);else pauses.delete(reason);audio.pause(reason,open);}
 root.addEventListener('box-modal',e=>{const d=(e as CustomEvent).detail;modal(d.reason,d.open);},{signal});
 function perform(a:string){if(a==='exit'){destroy();onExit();return;}if(!ready)return;
  if(['up','down','in','out'].includes(a))motion.follow=false;
  switch(a){
   case 'resume-world':motion.paused=false;break;case 'cancel':selected=null;break;case 'prev':page--;break;case 'next':page++;break;
   case 'up':scene.tilt(.13);break;case 'down':scene.tilt(-.13);break;case 'in':scene.zoomBy(.15);break;case 'out':scene.zoomBy(-.15);break;
   case 'help':state.help=!state.help;save();if(state.help&&selected)reveal();break;case 'hint':if(selected)reveal();else say('先从托盘选一件。');break;
   case 'undo':{const id=history.pop();if(id){selected=null;audio.clearObjects();undoFrozen(state,motion,id);save();say(motion.pending?'先安全返回，再收回这一件。':'收回一件，可以换个顺序。');}break;}
   case 'sleigh-play':case 'friends':show('sleigh');break;case 'olaf-play':show('olaf');break;case 'palace':show('palace');break;case 'close-near':show(null);break;
   case 'lake-ride':case 'palace-ride':if(!startRide(state,motion,a==='lake-ride'?'lake':'palace'))say('先返回停车位，再选择路线。');else audio.event('frozen-start');break;
   case 'ride-pause':motion.ride.running=false;motion.ride.speed=0;audio.clearObjects();break;
   case 'ride-continue':if(!rideMissing(state).length){motion.ride.running=motion.ride.t!==motion.ride.destination;motion.ride.blocked=false;}break;
   case 'ride-return':motion.ride.destination=0;motion.ride.running=true;break;
   case 'anna':if(state.placed.includes('anna')&&motion.ride.t===0)motion.ride.anna=!motion.ride.anna;break;
   case 'follow':motion.follow=!motion.follow;break;
   case 'wave':if(state.placed.includes('olaf')){motion.wave=3;audio.event('frozen-reform');}break;
   case 'circle':case 'eight':startSkate(state,motion,a==='circle'?'circle':'eight');break;
   case 'skate-stop':motion.skate.exiting=true;break;
   case 'bridge-walk':if(motion.bridge==='ready'&&motion.skate.entry===0&&!(motion.ride.route==='palace'&&motion.ride.running))motion.bridgeWalkRunning=true;else say('先让雪橇停好，再走冰桥。');break;case 'bridge-back':motion.bridgeWalkRunning=false;break;
   case 'door':if(state.placed.includes('palace_gate')){motion.door=!motion.door;audio.event('frozen-door');}break;
   case 'chandelier':if(state.placed.includes('palace_chandelier')){motion.chandelier=4;audio.event('frozen-chandelier');}break;
   case 'mute':sounds.toggle();break;
   case 'reset':modal('reset',true);reset.showModal();control('cancel-reset').focus();break;
   case 'cancel-reset':reset.close();break;
   case 'confirm-reset':if(reset.open){const help=state.help,revision=motion.revision+1;state={...freshFrozen(),help};motion=freshFrozenMotion(state,revision);history.length=0;previousBridge=0;wasMoving=false;selected=null;group=page=0;panel=null;audio.clearObjects();scene.reset();save();reset.close();say(warning?'本次已重置，暂时无法保存。':'点雪花，让艾莎试试魔法。');}break;
  }update();
 }
 reset.addEventListener('close',()=>{modal('reset',false);control('reset').focus({preventScroll:true});},{signal});
 let gesture:{x:number;y:number;id:number;target:HTMLElement;scroll:number;piece?:FrozenPiece;moved:boolean}|null=null,suppressed=false;
 function cancelGesture(){gesture=null;suppressed=true;stopTurn();}
 root.addEventListener('pointerdown',e=>{if(!e.isPrimary||gesture){cancelGesture();return;}suppressed=false;gesture={x:e.clientX,y:e.clientY,id:e.pointerId,target:e.target as HTMLElement,scroll:scrollY,piece:(e.target as HTMLElement).closest<HTMLElement>('[data-piece]')?.dataset.piece as FrozenPiece|undefined,moved:false};void audio.unlock();},{signal});
 root.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>9)gesture.moved=true;},{signal});
 window.addEventListener('pointerup',e=>{if(!gesture)return;const g=gesture;gesture=null;suppressed=g.moved||g.scroll!==scrollY;if(g.moved&&g.piece&&g.scroll===scrollY){choose(g.piece);const hit=scene.pick(e.clientX,e.clientY);if(FROZEN_IDS.includes(hit as FrozenPiece))place(hit as FrozenPiece);}},{signal});
 root.addEventListener('pointercancel',cancelGesture,{signal});window.addEventListener('wheel',cancelGesture,{signal,passive:true});
 root.addEventListener('click',e=>{if(e.detail>0&&suppressed)return;if(e.detail===0)void audio.unlock();const t=e.target as HTMLElement;if(t.closest('dialog')&&!t.closest('[data-reset]'))return;const b=t.closest<HTMLButtonElement>('button');if(b?.disabled)return;
  if(b?.dataset.action)perform(b.dataset.action);else if(b?.dataset.group){group=Number(b.dataset.group);page=0;update();}else if(b?.dataset.view){motion.follow=false;scene.go(b.dataset.view);layout();}else if(b?.dataset.piece)choose(b.dataset.piece as FrozenPiece);else if(b?.dataset.slot)place(b.dataset.slot as FrozenPiece);else if(b?.dataset.magic)cast(b.dataset.magic as Magic);else if(b?.dataset.locate){const id=b.dataset.locate as FrozenPiece;group=frozenGroup(id);page=Math.floor(FROZEN_IDS.filter(p=>frozenGroup(p)===group).indexOf(id)/3);choose(id);reveal();}else if(t===scene.renderer.domElement){const hit=scene.pick(e.clientX,e.clientY);if(!hit)return;if(hit.startsWith('magic_'))cast(hit.slice(6) as Magic);else if(selected)place(hit as FrozenPiece);else if(hit==='olaf')show('olaf');else if(['sleigh','sven','kristoff','anna'].includes(hit))show('sleigh');else if(hit.startsWith('palace_'))show('palace');}
 },{signal});
 root.addEventListener('keydown',e=>{if(ignoreGameKey(e,root))return;if(e.key==='Escape'&&!root.querySelector('dialog[open]')){selected=null;motion.follow=false;update();}if(e.key.toLowerCase()==='z'&&!root.querySelector('dialog[open]')){e.preventDefault();perform('undo');}},{signal});
 const pause=()=>{cancelGesture();background=true;motion.paused=true;motion.ride.running=false;motion.ride.speed=0;say('已安全暂停，回来后点继续玩。');audio.pause('background',true);};const unbind=bindInputLifecycle(root,e=>{cancelGesture();if(e?.type==='blur'||document.hidden)pause();});
 window.addEventListener('focus',()=>{if(!document.hidden){background=false;audio.pause('background',false);}},{signal});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.hasFocus()){background=false;audio.pause('background',false);}},{signal});
 const resize=new ResizeObserver(()=>{scene.resize();layout();});resize.observe(q('.wb-canvas'));
 let stable=JSON.stringify(state),previousBridge=state.bridge?12:0,lastUI=0,wasMoving=false;
 function tick(now:number){if(dead)return;const dt=ready&&!background&&!motion.paused&&!pauses.size?Math.min(.05,(now-last)/1000):0;last=now;
  if(ready){stepFrozen(state,motion,dt);scene.frame(state,motion,dt);if(stable!==JSON.stringify(state)){stable=JSON.stringify(state);save();}
   if(wasMoving&&!motion.ride.running&&dt)audio.event('frozen-stop');wasMoving=motion.ride.running;
   const seg=Math.floor(motion.bridgeAmount*12);if(seg!==previousBridge&&dt)audio.event('frozen-crystal',.5);previousBridge=seg;
   audio.want('sleigh','frozen-slide','sfx',motion.ride.speed>0&&dt?.11:0);audio.want('hooves','frozen-hooves','sfx',motion.ride.speed>0&&dt?.10:0);audio.want('skate','frozen-skate','sfx',motion.skate.pattern&&dt&&!motion.skate.exiting?.09:0);audio.want('snow','frozen-snow','sfx',motion.snow&&dt?.06:0);audio.want('frost','frozen-frost','sfx',motion.rink==='growing'&&dt?.09:0);
   if(now-lastUI>100){update();lastUI=now;}root.dataset.diagnostics=JSON.stringify({scene:scene.diagnostics(),audio:audio.diagnostics(),revision:motion.revision});
  }raf=requestAnimationFrame(tick);
 }
 void scene.load().then(()=>{if(dead)return;ready=true;scene.frame(state,motion,0);for(const id of FROZEN_IDS)q<HTMLImageElement>(`[data-piece="${id}"] img`).src=scene.thumbnail(id);q('.wb-loading').hidden=true;scene.frame(state,motion,0);update();root.dataset.ready='true';}).catch(()=>{if(!dead)q('.wb-loading').textContent='模型暂时没有加载成功，请返回再试；存档保留。';});
 raf=requestAnimationFrame(tick);
 function destroy(){if(dead)return;dead=true;motion.revision++;abort.abort();unbind();resize.disconnect();navs.forEach(n=>n.destroy());cancelAnimationFrame(raf);audio.destroy();scene.destroy();root.replaceChildren();}
 return{destroy};
}

import type {MountGameContext,MountedGame} from '../../packages/game-core';
import {bindInputLifecycle,rovingGroup,ignoreGameKey} from '../../packages/ui/input';
import {CITY_IDS,CITY_LABELS,REGIONS,CITY_KEY,freshCity,restoreCity,placeCity,removeCity,canSection,regionOf,freshMotion,stepMotion,clockParts,type CityPiece,type Region,type CityMotion} from './dresden-model';
import {DresdenScene} from './dresden-scene';
import {BoxAudio} from './audio';
import './style.css';import './dresden.css';

const comparisons=[
 {id:'bridge',name:'奥古斯都桥',de:'Augustusbrücke',pieces:['augustus_bridge'],text:'这座固定石桥连接易北河两岸的老城与内新城。'},
 {id:'church',name:'圣母教堂',de:'Frauenkirche',pieces:['frauenkirche_body','frauenkirche_dome'],text:'新石头和留下来的旧石头，一起组成了今天的教堂。'},
 {id:'opera',name:'森帕歌剧院',de:'Semperoper',pieces:['semperoper'],text:'弧形正立面后面，是演出歌剧、芭蕾和音乐的地方。'},
 {id:'zwinger',name:'茨温格宫',de:'Dresdner Zwinger',pieces:['zwinger_galleries','zwinger_crown_gate'],text:'长廊环抱庭院，冠门顶上有一顶金色王冠。'},
 {id:'beyer',name:'贝耶尔楼',de:'Beyer-Bau · TU Dresden',pieces:['beyer_body','beyer_tower'],text:'大学里的公共建筑，楼体上方有观测塔。'},
 {id:'slub',name:'SLUB中央图书馆',de:'SLUB Zentralbibliothek',pieces:['slub_surface','slub_skylight'],text:'大阅览室在地下二层，上方的大玻璃顶把日光带进来。'}
] as const;
interface Credit{id:string;author:string;attribution:string;source:string;license:string;licenseUrl:string;date:string;local:string;modifications:string}

export function mountDresden({container:root,storage,onExit}:MountGameContext):MountedGame{
 let state=restoreCity(storage.get(CITY_KEY,freshCity())),motion:CityMotion,selected:CityPiece|null=null,group:Region='river',page=0,ready=false,dead=false,frame=0,last=performance.now(),busy=0,saveWarning=false,photoToken=0,lastClock=-1;
 const history:CityPiece[]=[],thumbs=new Map<CityPiece,string>(),audio=new BoxAudio(),abort=new AbortController(),signal=abort.signal;
 let sectionCamera:ReturnType<DresdenScene['snapshot']>|null=null,photoCamera:ReturnType<DresdenScene['snapshot']>|null=null,photoOpener:HTMLElement|null=null;
 root.className='wb-mount dc-mount';root.innerHTML=`<main class="wb dc" aria-labelledby="wb-title">
 <header class="wb-header"><div><p>世界盒子 <span>02 / DRESDEN</span></p><h1 id="wb-title">河流、桥与大学</h1></div><button data-action="exit" aria-label="返回游戏世界">返回 ↗</button></header>
 <div class="dc-heading"><p>德累斯顿 <span>一座可以慢慢拼好的木制城市</span></p><div class="dc-clocks" role="group" aria-label="两地时间，来自设备时钟">${['武汉','德累斯顿'].map((name,i)=>`<div class="dc-clock" tabindex="0" data-clock="${i}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><text x="32" y="13">12</text><text x="54" y="35">3</text><text x="32" y="58">6</text><text x="10" y="35">9</text><line class="hour" x1="32" y1="32" x2="32" y2="18"/><line class="minute" x1="32" y1="32" x2="32" y2="10"/><circle cx="32" cy="32" r="2"/></svg><span>${name}<small data-time></small></span></div>`).join('')}</div></div>
 <div class="wb-intro"><p data-message role="status">选一件，找找它在城市里的位置。</p><span data-progress>0 / 18</span></div>
 <nav class="dc-views" aria-label="城市区域"><button data-view="all">看全城</button><button data-view="river">去河边</button><button data-view="oldtown">逛老城</button><button data-view="campus">去大学</button></nav>
 <div class="dc-workbench"><div><section class="wb-stage" aria-label="可旋转的德累斯顿木制城市"><div class="wb-canvas"></div><div class="wb-targets" role="group" aria-label="当前可见的位置"></div><p class="wb-loading" role="status">正在打开城市盒子……</p><span class="wb-view">城市位置经过简化，距离不按比例。</span></section>
 <div class="dc-nearby" data-ride-panel hidden><strong data-ride-title></strong><div data-near-destinations><button data-destination="north">河对岸</button><button data-destination="oldtown">老城</button><button data-destination="campus">大学附近</button></div><div><button data-action="near-start">出发 / 继续</button><button data-action="near-pause">暂停</button><button data-action="near-follow">跟随 / 退出</button><button data-action="near-close">收起操作</button></div></div><div class="dc-nearby" data-section-panel hidden><span>剖面示意 · 地下二层阅览室</span><button data-action="section-close">合上剖面</button><button data-action="near-home">返回全城</button></div><nav class="wb-camera" aria-label="观察城市"><button data-action="left">↶ 左转</button><button data-action="right">右转 ↷</button><button data-action="up">抬高</button><button data-action="down">放低</button><button data-action="out" aria-label="缩小">−</button><button data-action="in" aria-label="放大">＋</button></nav></div>
 <section class="wb-tray" aria-label="待拼物件"><nav class="dc-groups" aria-label="托盘分组">${Object.entries(REGIONS).map(([id,label])=>`<button data-group="${id}">${label}</button>`).join('')}</nav><div class="wb-tray-top"><span data-selection>选一件木制小物</span><button data-action="inspect" disabled>转一转</button></div><div class="wb-tray-line"><button data-action="prev" aria-label="托盘上一页">‹</button><div class="wb-pieces" role="group" aria-label="物件托盘"></div><button data-action="next" aria-label="托盘下一页">›</button></div><p class="wb-page" data-page></p><p class="dc-tip">点选物件 → 点可见接口<br>也可以拖入。顺序由你决定。</p></section></div>
 <footer class="wb-tools"><button data-action="help">帮助：关</button><button data-action="hint">给我提示</button><button data-action="undo" aria-keyshortcuts="Z" disabled>撤销 (Z)</button><button data-action="mute">声音：开</button><button data-action="night">观赏夜景</button><button data-action="reset">重来</button></footer>
 <section class="dc-play" aria-label="在城里玩"><div class="dc-ride"><h2>🚋 电车游览</h2><div class="dc-destinations" role="group" aria-label="电车目的地"><button data-destination="north">河对岸</button><button data-destination="oldtown" aria-pressed="true">老城</button><button data-destination="campus">大学附近</button></div><div class="dc-actions"><button data-action="tram-start" disabled>电车出发</button><button data-action="tram-pause" disabled>暂停电车</button><button data-action="tram-follow" disabled>跟随电车</button></div><p data-tram-status>先把黄色电车放上轨道。</p><small>盒中游览线，为游戏简化，不是真实公交线路。</small></div>
 <div class="dc-ride"><h2>⛴ 河上游览</h2><div class="dc-actions"><button data-action="boat-start" disabled>船出发</button><button data-action="boat-pause" disabled>暂停船</button><button data-action="boat-return" disabled>返回 / 再游</button><button data-action="boat-follow" disabled>跟随船</button><button data-action="boat-dock" disabled>靠近码头</button></div><p data-boat-status>先把轮桨船放进水里。</p><small>玩具游览示意，不是真实班次或航程。</small></div>
 <div class="dc-library"><h2>▤ 图书馆里的光</h2><button data-action="section" disabled>看里面</button><button data-action="section-home">返回全城</button><p data-section-note>把图书馆和采光顶归位，就可以看里面。</p></div></section>
 <section class="dc-real" aria-label="木制模型与实景对照"><h2>看看真的 <span>主动打开，慢慢观察</span></h2><div>${comparisons.map(c=>`<button data-photo="${c.id}">${c.name}</button>`).join('')}</div></section>
 <p class="wb-subtitle" data-subtitle>两地时间来自设备时钟 · 夜景仅为观赏灯光。街屋与面包店是原创生活场景。</p>
 <dialog class="wb-dialog" data-reset-dialog aria-label="重新拼城市"><h2>收起城市里的18件？</h2><p>窗边盒子和其他游戏的进度会保留。</p><button data-action="cancel-reset">继续玩</button><button data-action="confirm-reset">收起重拼</button></dialog>
 <dialog class="wb-dialog dc-photo-dialog" data-photo-dialog aria-label="看看真的"><button data-action="close-photo">返回城市</button><div data-photo-content></div></dialog>
 </main>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!,control=(action:string)=>q<HTMLButtonElement>(`[data-action="${action}"]`),say=(text:string)=>{q('[data-message]').textContent=text;};
 const canvas=q('.wb-canvas'),stage=q('.wb-stage'),tray=q('.wb-pieces'),targets=q('.wb-targets'),reset=q<HTMLDialogElement>('[data-reset-dialog]'),photo=q<HTMLDialogElement>('[data-photo-dialog]');
 let scene:DresdenScene;
 try{scene=new DresdenScene(canvas);}catch{q('.wb-loading').textContent='三维画面暂时打不开，进度仍保留。';control('exit').onclick=onExit;return{destroy(){root.replaceChildren();}};}
 for(const id of CITY_IDS){const b=document.createElement('button');b.dataset.piece=id;b.className='wb-piece';b.hidden=true;b.innerHTML=`<img alt="" draggable="false"><span>${CITY_LABELS[id]}</span>`;b.setAttribute('aria-label','选择'+CITY_LABELS[id]);tray.append(b);const slot=document.createElement('button');slot.dataset.slot=id;slot.className='wb-slot';slot.hidden=true;targets.append(slot);const line=document.createElement('span');line.className='wb-leader';line.dataset.leader=id;line.hidden=true;targets.append(line);}
 const trayNav=rovingGroup(tray,{items:'[data-piece]'}),targetNav=rovingGroup(targets,{items:'[data-slot]'}),groupNav=rovingGroup(q('.dc-groups'),{items:'button'});
 const pb=(id:CityPiece)=>q<HTMLButtonElement>(`[data-piece="${id}"]`),sb=(id:CityPiece)=>q<HTMLButtonElement>(`[data-slot="${id}"]`);
 const save=()=>{try{storage.set(CITY_KEY,state);saveWarning=JSON.stringify(storage.get(CITY_KEY,null))!==JSON.stringify(state);}catch{saveWarning=true;}};
 const sound=()=>audio.set(false,state.muted,false);
 function update(){
  q('[data-ride-panel]').hidden=!ridePanel||!!motion?.section;q('[data-section-panel]').hidden=!motion?.section;if(ridePanel){q('[data-ride-title]').textContent=ridePanel==='tram'?'🚋 电车游览':'⛴ 河上游览';q('[data-near-destinations]').hidden=ridePanel!=='tram';}
  const remaining=CITY_IDS.filter(id=>regionOf(id)===group&&!state.placed.includes(id));page=Math.max(0,Math.min(page,Math.ceil(remaining.length/3)-1));
  for(const id of CITY_IDS){const b=pb(id);b.hidden=!remaining.slice(page*3,page*3+3).includes(id);b.disabled=!!motion?.section;b.setAttribute('aria-pressed',String(selected===id));if(thumbs.has(id)&&b.querySelector('img')!.src!==thumbs.get(id))b.querySelector('img')!.src=thumbs.get(id)!;}
  q('[data-progress]').textContent=`${state.placed.length} / 18`;q('[data-page]').textContent=remaining.length?`${REGIONS[group]} · ${page+1} / ${Math.ceil(remaining.length/3)}`:'这一组拼好了，可以换组或继续游玩。';q('[data-selection]').textContent=selected?CITY_LABELS[selected]+' · 找接口':'选一件木制小物';
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-group]'))b.setAttribute('aria-pressed',String(b.dataset.group===group));
  control('prev').disabled=page===0;control('next').disabled=(page+1)*3>=remaining.length;control('inspect').disabled=!selected;control('undo').disabled=!history.length;
  control('help').textContent=state.help?'帮助：开':'帮助：关';control('help').setAttribute('aria-pressed',String(state.help));control('mute').textContent=state.muted?'声音：关':'声音：开';control('mute').setAttribute('aria-pressed',String(state.muted));control('night').textContent=state.night?'回到白昼':'观赏夜景';control('night').setAttribute('aria-pressed',String(state.night));
  for(const type of ['tram','boat'] as const){const placed=state.placed.includes(type==='tram'?'yellow_tram':'paddle_steamer');for(const a of ['start','pause','follow'])control(type+'-'+a).disabled=!placed;control(type+'-start').textContent=motion?.[type].blocked?'装桥后继续':motion?.[type].position!==(type==='tram'?scene.routes?.tramStart:scene.routes?.boatStart)?'继续'+(type==='tram'?'电车':'航行'):type==='tram'?'电车出发':'船出发';control(type+'-pause').disabled=!placed||!motion?.[type].running;control(type+'-follow').textContent=motion?.follow===type?'退出跟随':'跟随'+(type==='tram'?'电车':'船');}
  control('boat-dock').disabled=!state.placed.includes('paddle_steamer')||!state.placed.includes('river_pier');control('boat-return').disabled=!state.placed.includes('paddle_steamer');control('section').disabled=!canSection(state);control('section').textContent=motion?.section?'合上':'看里面';
  q('[data-section-note]').textContent=motion?.section?'剖面示意：大阅览室在地下二层，玻璃顶引入日光。室内布局经过简化；真实屋顶不会升降。':canSection(state)?'打开玩具剖面，看看光怎样来到地下。':'把图书馆和采光顶归位，就可以看里面。';
  root.dataset.placed=state.placed.join(' ');root.dataset.selected=selected??'';root.dataset.night=String(state.night);root.classList.toggle('dc-complete',state.placed.length===18);root.classList.toggle('dc-night',state.night);
  if(saveWarning)q('[data-subtitle]').textContent='本次可以继续玩；浏览器暂时不能保存。';trayNav.refresh();groupNav.refresh();refreshTargets();
 }
 function refreshTargets(){
  if(!ready)return;const occupied:{x:number;y:number}[]=[],lost=document.activeElement as HTMLElement;let hiddenFocus=false;
  for(const id of CITY_IDS){const b=sb(id),placed=state.placed.includes(id),candidate=selected?!placed&&regionOf(id)===regionOf(selected)&&!motion.section:placed&&['yellow_tram','paddle_steamer'].includes(id),p=candidate?scene.target(id):{x:0,y:0,visible:false};let show=!!selected&&candidate&&p.visible;
   if(!selected&&placed&&['yellow_tram','paddle_steamer'].includes(id))show=p.visible;
   let x=p.x,y=p.y-(placed?48:0);const clear=(cx:number,cy:number)=>cx>=25&&cy>=25&&cx<stage.clientWidth-25&&cy<stage.clientHeight-45&&occupied.every(o=>Math.abs(cx-o.x)>=49||Math.abs(cy-o.y)>=49);
   if(show&&!clear(x,y)){let found=false;outer:for(let r=16;r<160;r+=16)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-.7,-.7],[.7,.7]])if(clear(x+dx*r,y+dy*r)){x+=dx*r;y+=dy*r;found=true;break outer;}if(!found)show=false;}
   if(show)occupied.push({x,y});if(b===lost&&!show)hiddenFocus=true;b.hidden=!show;b.style.left=x+'px';b.style.top=y+'px';b.textContent=placed?id==='yellow_tram'?'电车':'船':String(CITY_IDS.indexOf(id)+1);b.setAttribute('aria-label',placed?id==='yellow_tram'?'操作电车':'操作轮桨船':`位置${CITY_IDS.indexOf(id)+1} · ${CITY_LABELS[id]}接口`);b.classList.toggle('wb-hint',state.help&&selected===id);
   const line=q(`[data-leader="${id}"]`),len=Math.hypot(x-p.x,y-p.y);line.hidden=!show||len<1;line.style.left=p.x+'px';line.style.top=p.y+'px';line.style.width=len+'px';line.style.transform=`rotate(${Math.atan2(y-p.y,x-p.x)}rad)`;
  }
  targetNav.refresh();if(hiddenFocus)(targets.querySelector<HTMLButtonElement>('button:not([hidden])')??control('left')).focus({preventScroll:true});
 }
 function choose(id:CityPiece,keyboard=false){if(!ready||state.placed.includes(id)||motion.section)return;selected=id;say('观察形状，再点一个可见接口。');if(state.help)scene.showTarget(id);update();if(keyboard)targets.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({preventScroll:true});}
 function place(id:CityPiece){
  if(!ready||performance.now()<busy)return;
  if(!selected){if(id==='yellow_tram'||id==='paddle_steamer'){showRide(id==='yellow_tram'?'tram':'boat');}return;}
  if(!scene.target(id).visible||state.placed.includes(id))return;
  if(selected!==id){say('这里的形状不太合适，再看看。');return;}
  state=placeCity(state,selected,id);selected=null;history.push(id);scene.landPiece(id);busy=performance.now()+(scene.reducedMotion?0:330);save();audio.place();update();say(state.placed.length===18?'城市拼好了！留下来，乘车、游船、看看图书馆。':CITY_LABELS[id]+'归位了。');(tray.querySelector<HTMLButtonElement>('button:not([hidden])')??q<HTMLButtonElement>(`[data-group="${group}"]`)).focus({preventScroll:true});
 }
 function pause(){if(motion){motion.tram.running=false;motion.boat.running=false;}audio.suspend();}
 function closeSection(){if(!motion.section)return;motion.section=false;if(sectionCamera)scene.restore(sectionCamera);sectionCamera=null;update();control('section').focus({preventScroll:true});}
 async function openPhoto(id:string){
  const c=comparisons.find(c=>c.id===id);if(!c||!ready)return;cancelGesture();pause();photoOpener=document.activeElement as HTMLElement;photoCamera=scene.snapshot();const token=++photoToken;
  const area=q('[data-photo-content]');area.replaceChildren();const title=document.createElement('h2');title.textContent=c.name;const german=document.createElement('p');german.textContent=c.de;const text=document.createElement('p');text.textContent=c.text;const model=document.createElement('img');model.src=scene.comparison([...c.pieces]);model.alt=c.name+' · 当前木制模型';model.className='dc-model-photo';area.append(title,german,text,model);photo.showModal();control('close-photo').focus();
  try{const response=await fetch('./assets/world-in-a-box/dresden/photos/credits.json',{signal});if(!response.ok)throw Error('credits');const credits=await response.json() as Credit[];if(dead||token!==photoToken||!photo.open)return;
   for(const credit of credits.filter(p=>p.id===id||(id==='slub'&&p.id==='slub-inside'))){const figure=document.createElement('figure'),img=document.createElement('img');img.src=credit.local;img.alt=c.name+'实景照片';img.loading='lazy';const caption=document.createElement('figcaption');caption.textContent=`${credit.attribution} · ${credit.date} · ${credit.license}。缩小并转为 WebP，未裁切、未修图。`;const source=document.createElement('a');source.href=credit.source;source.textContent='原始文件页';source.target='_blank';source.rel='noopener';source.tabIndex=0;const license=document.createElement('a');license.href=credit.licenseUrl||credit.source;license.textContent='许可';license.target='_blank';license.rel='noopener';license.tabIndex=0;const zoom=document.createElement('button');zoom.textContent='放大照片';zoom.dataset.photoZoom='true';figure.append(img,zoom,caption,source,license);area.append(figure);}
  }catch{if(!dead&&token===photoToken){const error=document.createElement('p');error.textContent='照片暂时没有加载成功，请返回后重试。';area.append(error);}}
 }
 function closePhoto(){photoToken++;photo.close();if(photoCamera)scene.restore(photoCamera);photoOpener?.focus({preventScroll:true});photoCamera=null;photoOpener=null;}
 let destination:'north'|'oldtown'|'campus'='oldtown';let ridePanel:'tram'|'boat'|null=null;
 function showRide(type:'tram'|'boat'){ridePanel=type;update();stage.scrollIntoView({block:'start'});control('near-start').focus({preventScroll:true});}
 function perform(a:string){
  if(dead)return;if(a.startsWith('near-')&&['near-start','near-pause','near-follow'].includes(a)&&ridePanel)a=ridePanel+'-'+a.slice(5);if(a==='exit'){destroy();onExit();return;}if(!ready)return;
  if(['tram-start','boat-start','boat-return','boat-dock'].includes(a))showRide(a.startsWith('tram')?'tram':'boat');
  if(['left','right','up','down','in','out'].includes(a))motion.follow=null;
  switch(a){
   case 'near-close':ridePanel=null;motion.follow=null;break;case 'near-home':closeSection();motion.follow=null;scene.go('all');break;case 'section-close':closeSection();break;
   case 'left':scene.turn(-Math.PI/6);break;case 'right':scene.turn(Math.PI/6);break;case 'up':scene.tilt(.15);break;case 'down':scene.tilt(-.15);break;case 'in':scene.setZoom(.15);break;case 'out':scene.setZoom(-.15);break;
   case 'prev':page--;break;case 'next':page++;break;
   case 'inspect':if(selected){const b=pb(selected),angle=Number(b.dataset.angle??.35)+.65;b.dataset.angle=String(angle);thumbs.set(selected,scene.thumbnail(selected,angle));}break;
   case 'help':state.help=!state.help;save();break;
   case 'hint':if(selected){state.help=true;motion.follow=null;scene.showTarget(selected);save();say('看看'+REGIONS[regionOf(selected)]+'的亮起接口。');}else say('先在托盘选一件；四组都可以自由打开。');break;
   case 'mute':state.muted=!state.muted;save();sound();break;
   case 'night':state.night=!state.night;save();break;
   case 'undo':{const id=history.pop();if(id){if(motion.section&&(id==='slub_surface'||id==='slub_skylight'))closeSection();const next=removeCity(state,motion,id,scene.routes);state=next.state;motion=next.motion;scene.cancelLanding(id);busy=0;selected=null;save();say(next.bridgeReset?'先把电车停回老城，再收起桥。':'收回这一件，可以换个顺序。');}break;}
   case 'tram-start':if(state.placed.includes('yellow_tram')){motion.tram.destination=scene.routes.tramStops[destination];motion.tram.running=true;motion.tram.blocked=false;audio.place();}break;
   case 'tram-pause':motion.tram.running=false;break;
   case 'boat-start':if(state.placed.includes('paddle_steamer')){motion.dock=false;if(motion.boat.position===motion.boat.destination)motion.boat.destination=motion.boat.position===scene.routes.boatEnd?scene.routes.boatStart:scene.routes.boatEnd;motion.boat.running=true;audio.place();}break;
   case 'boat-return':if(state.placed.includes('paddle_steamer')){motion.dock=false;motion.boat.destination=motion.boat.position===scene.routes.boatStart?scene.routes.boatEnd:scene.routes.boatStart;motion.boat.running=true;}break;
   case 'boat-dock':if(state.placed.includes('paddle_steamer')&&state.placed.includes('river_pier')){motion.dock=true;motion.boat.destination=scene.routes.berth.x;motion.boat.running=true;}break;
   case 'boat-pause':motion.boat.running=false;break;
   case 'tram-follow':motion.follow=motion.follow==='tram'?null:'tram';break;case 'boat-follow':motion.follow=motion.follow==='boat'?null:'boat';break;
   case 'section':if(canSection(state)){cancelGesture();pause();motion.follow=null;if(motion.section)closeSection();else{sectionCamera=scene.snapshot();motion.section=true;selected=null;scene.go('library');update();stage.scrollIntoView({block:'start'});control('section-close').focus({preventScroll:true});say('剖面示意：光从玻璃顶来到地下大阅览室。');}}break;
   case 'section-home':closeSection();motion.follow=null;scene.go('all');break;
   case 'reset':cancelGesture();pause();reset.showModal();control('cancel-reset').focus();break;
   case 'cancel-reset':reset.close();control('reset').focus();break;
   case 'confirm-reset':reset.close();state={...freshCity(),help:state.help,muted:state.muted};motion=freshMotion(scene.routes);history.length=0;selected=null;ridePanel=null;busy=0;CITY_IDS.forEach(id=>scene.cancelLanding(id));scene.go('all');save();say('选一件，重新拼这座城市。');break;
   case 'close-photo':closePhoto();break;
  }update();
 }
 let gesture:{id:number;x:number;y:number;lastX:number;start:HTMLElement;piece?:CityPiece;moved:boolean}|null=null,validClick=false,suppressed=0,lastActivated:HTMLElement|null=null;
 function cancelGesture(){gesture=null;validClick=false;suppressed=performance.now()+180;stage.classList.remove('wb-dragging');}
 root.addEventListener('pointerdown',e=>{validClick=false;if(gesture||!e.isPrimary){cancelGesture();return;}suppressed=0;const target=e.target as HTMLElement;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,start:target,piece:target.closest<HTMLElement>('[data-piece]')?.dataset.piece as CityPiece|undefined,moved:false};},{signal});
 root.addEventListener('pointermove',e=>{if(!ready)return;const g=gesture;if(!g||g.id!==e.pointerId)return;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>9)g.moved=true;if(g.moved&&g.piece){if(selected!==g.piece)choose(g.piece);stage.classList.add('wb-dragging');}else if(g.moved&&g.start.closest('.wb-stage')&&!g.start.closest('button')&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)*1.4){motion.follow=null;scene.turn(-(e.clientX-g.lastX)*.008);}g.lastX=e.clientX;},{signal});
 window.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;stage.classList.remove('wb-dragging');validClick=!g.moved&&g.start.closest('button')===(e.target as HTMLElement).closest('button');if(g.moved){suppressed=performance.now()+220;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-slot]');if(g.piece&&target&&!target.hidden)place(target.dataset.slot as CityPiece);}},{signal});
 root.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el||el.dataset.action==='boxes'||el.dataset.box||el.hasAttribute('data-close-boxes'))return;if(!ready&&el.dataset.action!=='exit')return;if(e.detail!==0&&(!validClick||performance.now()<suppressed)){e.preventDefault();return;}validClick=false;if(e.detail>1&&el===lastActivated&&(el.dataset.slot||el.dataset.piece))return;lastActivated=el;void audio.unlock().then(sound);
  if(el.dataset.photoZoom){const img=el.closest('figure')!.querySelector('img')!;img.classList.toggle('dc-enlarged');el.textContent=img.classList.contains('dc-enlarged')?'缩回照片':'放大照片';}else if(el.dataset.action)perform(el.dataset.action);else if(el.dataset.group){group=el.dataset.group as Region;page=0;update();}else if(el.dataset.view){closeSection();motion.follow=null;scene.go(el.dataset.view);update();}else if(el.dataset.piece)choose(el.dataset.piece as CityPiece,e.detail===0);else if(el.dataset.slot)place(el.dataset.slot as CityPiece);else if(el.dataset.destination){destination=el.dataset.destination as typeof destination;for(const b of root.querySelectorAll('[data-destination]'))b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.destination===destination));}else if(el.dataset.photo)void openPhoto(el.dataset.photo);
 },{signal});
 root.addEventListener('keydown',e=>{if(!ready||ignoreGameKey(e,root))return;if(e.key.toLowerCase()==='z'&&!root.querySelector('dialog[open]')){e.preventDefault();perform('undo');return;}if(e.key==='Escape'&&!photo.open&&!reset.open&&!root.querySelector('dialog[open]')){if(motion.section)closeSection();else{selected=null;cancelGesture();update();tray.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();}}},{signal});
 photo.addEventListener('cancel',e=>{e.preventDefault();closePhoto();},{signal});reset.addEventListener('close',()=>control('reset').focus(),{signal});
 const unbind=bindInputLifecycle(root,()=>{cancelGesture();pause();});window.addEventListener('scroll',()=>{if(gesture)cancelGesture();},{signal,capture:true,passive:true});root.addEventListener('wheel',cancelGesture,{signal,passive:true});
 const resize=new ResizeObserver(()=>{scene.resize();refreshTargets();});resize.observe(canvas);
 function clocks(now:number){if(Math.floor(now/1000)===lastClock)return;lastClock=Math.floor(now/1000);const date=new Date();try{['Asia/Shanghai','Europe/Berlin'].forEach((zone,i)=>{const value=clockParts(date,zone),clock=q(`[data-clock="${i}"]`);clock.querySelector('.hour')!.setAttribute('transform',`rotate(${value.hourAngle} 32 32)`);clock.querySelector('.minute')!.setAttribute('transform',`rotate(${value.minuteAngle} 32 32)`);clock.querySelector('[data-time]')!.textContent=value.text;clock.setAttribute('aria-label',`${i?'德累斯顿':'武汉'} ${value.text}，来自设备时钟`);});}catch{for(const c of root.querySelectorAll('[data-clock]')){c.querySelector('svg')?.setAttribute('hidden','');c.querySelector('[data-time]')!.textContent='时区能力不可用，无法显示可靠时间';}}}
 const tick=(now:number)=>{if(dead)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;clocks(now);if(ready){const previous=motion;motion=stepMotion(motion,state,scene.routes,document.hidden?0:dt);if(previous.tram.running!==motion.tram.running||previous.boat.running!==motion.boat.running)update();scene.frame(state,motion,now,dt);refreshTargets();root.dataset.tramRunning=String(motion.tram.running);root.dataset.boatRunning=String(motion.boat.running);root.dataset.bridgeBlocked=String(motion.tram.blocked);root.dataset.section=String(motion.section);
 q('[data-tram-status]').textContent=!state.placed.includes('yellow_tram')?'先把黄色电车放上轨道。':motion.tram.blocked?'前面少一座桥。装好桥，再按继续。':motion.tram.running?'电车沿轨道前进。':'电车已停稳，可以换个目的地。';q('[data-boat-status]').textContent=!state.placed.includes('paddle_steamer')?'先把轮桨船放进水里。':motion.boat.running?'轮桨转起来，沿河看看。':motion.dock?'船停靠在码头旁。':state.placed.includes('river_pier')?'可以靠近码头，也可以再游一次。':'船在固定候船水域等待。';}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 void scene.load().then(()=>{if(dead)return;motion=freshMotion(scene.routes);for(const id of CITY_IDS)thumbs.set(id,scene.thumbnail(id));ready=true;root.dataset.ready='true';q('.wb-loading').hidden=true;scene.frame(state,motion,performance.now(),.016);update();if(state.placed.length)say('接着上次拼好的城市，继续探索。');}).catch(()=>{if(!dead)q('.wb-loading').textContent='城市资源暂时没装好，进度保留。可以换盒子或返回。';});
 window.addEventListener('pagehide',destroy,{signal});
 function destroy(){if(dead)return;dead=true;photoToken++;cancelAnimationFrame(frame);abort.abort();unbind();resize.disconnect();trayNav.destroy();targetNav.destroy();groupNav.destroy();audio.destroy();scene.destroy();root.replaceChildren();}
 return{destroy};
}

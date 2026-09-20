import type { MountGameContext,MountedGame } from '../../packages/game-core';
import { bindInputLifecycle,rovingGroup,ignoreGameKey } from '../../packages/ui/input';
import { IDS,LABELS,fresh,restore,reduce,fits,windy,shutter,type Piece,type Action } from './model';
import { BoxScene } from './scene';
import {boxSound} from './audio-settings';
import {continuousTurn} from './continuous-turn';
import './style.css';

export function mountWorldBox({container:root,storage,onExit}:MountGameContext):MountedGame{
  let state=restore(storage.get('v1',fresh())),selected:Piece|null=null,page=0,ready=false,dead=false,saveWarning=false,busyUntil=0,frame=0,last=performance.now();
  const history:Piece[]=[];const thumbs=new Map<Piece,string>();
  const abort=new AbortController();const signal=abort.signal;
  root.className='wb-mount';root.innerHTML=`<main class="wb" aria-labelledby="wb-title">
    <header class="wb-header"><div><p>世界盒子 <span>01 / 窗边</span></p><h1 id="wb-title">窗边有风</h1></div><button data-action="exit" aria-label="返回游戏世界">返回 ↗</button></header>
    <div class="wb-intro"><p data-message role="status">选一件，把它放回小世界。</p><span data-progress>0 / 8</span></div>
    <section class="wb-stage" aria-label="可旋转的窗边小世界"><div class="wb-canvas"></div><div class="wb-targets" role="group" aria-label="当前可见的位置"></div><p class="wb-loading" role="status">正在打开小世界……</p><span class="wb-view">屋内 · 可以转到窗外</span></section>
    <nav class="wb-camera" aria-label="观察小世界"><button data-action="left" aria-label="向左旋转">↶ 按住左转</button><button data-action="right" aria-label="向右旋转">按住右转 ↷</button><button data-action="out" aria-label="缩小">−</button><button data-action="in" aria-label="放大">＋</button><button data-action="view" aria-label="复位视角">⌂ 复位</button><button data-action="up" aria-label="抬高视角">抬高</button><button data-action="down" aria-label="放低视角">放低</button></nav>
    <section class="wb-tray" aria-label="待拼物件"><div class="wb-tray-top"><span data-selection>选一件小物</span><button data-action="inspect" disabled>转一转物件</button></div><div class="wb-tray-line"><button data-action="prev" aria-label="托盘上一页">‹</button><div class="wb-pieces" role="group" aria-label="物件托盘"></div><button data-action="next" aria-label="托盘下一页">›</button></div><p class="wb-page" data-page>1 / 3</p></section>
    <footer class="wb-tools"><button data-action="help" aria-pressed="false">帮助：关</button><button data-action="hint">给我提示</button><button data-action="undo" aria-keyshortcuts="Z" disabled>撤销 (Z)</button><button data-action="mute" aria-pressed="false">声音：开</button><button data-action="reset">重置本关</button></footer>
    <p class="wb-subtitle" data-subtitle aria-live="polite">点选或拖入都可以 · 方向键选位置，回车确认</p>
    <dialog class="wb-dialog"><h2>重新拼《窗边有风》吗？</h2><p>本关已放好的物件会全部收回；另一个盒子的进度和声音设置不变。</p><button data-action="cancel-reset">继续玩</button><button data-action="confirm-reset">确认重置</button></dialog>
  </main>`;
  const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const controls=(name:string)=>q<HTMLButtonElement>(`[data-action="${name}"]`);
  const stage=q('.wb-stage'),canvas=q('.wb-canvas'),targets=q('.wb-targets'),tray=q('.wb-pieces'),dialog=q<HTMLDialogElement>('dialog');
  let scene:BoxScene;
  try{scene=new BoxScene(canvas);}catch{q('.wb-loading').textContent='三维画面暂时打不开。可刷新重试，进度仍保留。';controls('exit').onclick=onExit;return{destroy(){root.replaceChildren();}};}
  for(const id of IDS){const line=document.createElement('span');line.className='wb-leader';line.dataset.leader=id;line.hidden=true;targets.append(line);const b=document.createElement('button');b.type='button';b.dataset.slot=id;b.className='wb-slot';b.hidden=true;b.title=LABELS[id];targets.append(b);const p=document.createElement('button');p.type='button';p.dataset.piece=id;p.className='wb-piece';p.hidden=true;p.innerHTML=`<img alt="" draggable="false"><span>${LABELS[id]}</span>`;p.setAttribute('aria-label','选择'+LABELS[id]);tray.append(p);}
  const trayNav=rovingGroup(tray,{items:'[data-piece]'}),targetNav=rovingGroup(targets,{items:'[data-slot]'});
  const pieceButton=(id:Piece)=>q<HTMLButtonElement>(`[data-piece="${id}"]`),slotButton=(id:Piece)=>q<HTMLButtonElement>(`[data-slot="${id}"]`);
  const say=(text:string)=>{q('[data-message]').textContent=text;};
  const save=()=>{try{storage.set('v1',state);saveWarning=JSON.stringify(storage.get('v1',null))!==JSON.stringify(state);}catch{saveWarning=true;}};
  const sounds=boxSound(root,storage,'window-breeze',state.muted,muted=>{state.muted=muted;save();update();}),audio=sounds.audio;state.muted=sounds.muted;
  const modalReasons=new Set<string>();let background=false,revision=0;
  const stopTurn=continuousTurn(root,delta=>{if(!ready||modalReasons.size)return;scene.turn(delta);refreshTargets();},signal);
  function modal(reason:string,open:boolean){cancelGesture();stopTurn();if(reason==='settings')return;if(open)modalReasons.add(reason);else modalReasons.delete(reason);audio.pause(reason,open);if(!open)sound();}
  root.addEventListener('box-modal',e=>{const d=(e as CustomEvent).detail;modal(d.reason,d.open);},{signal});
  const sound=()=>audio.set(windy(state),state.muted,state.placed.includes('wind_chime'));
  function update(){
    q('[data-subtitle]').textContent=saveWarning?'本次可以继续玩；浏览器暂时不能保存。':state.placed.length===8?'可以继续开关窗，看看暖汽，摸摸木猫。':'点选或拖入都可以 · 方向键选位置，回车确认';
    const remaining=IDS.filter(id=>!state.placed.includes(id));page=Math.max(0,Math.min(page,Math.ceil(remaining.length/3)-1));
    IDS.forEach(id=>{const b=pieceButton(id);b.hidden=!remaining.slice(page*3,page*3+3).includes(id);b.setAttribute('aria-pressed',String(selected===id));if(thumbs.has(id))b.querySelector('img')!.src=thumbs.get(id)!;});
    q('[data-progress]').textContent=`${state.placed.length} / 8`;q('[data-page]').textContent=remaining.length?`${page+1} / ${Math.ceil(remaining.length/3)}`:'八件都回家了';
    q('[data-selection]').textContent=selected?`${LABELS[selected]} · 找一处接口`:remaining.length?'选一件小物':'留在这里，开窗、摸摸猫';
    controls('prev').disabled=page===0;controls('next').disabled=(page+1)*3>=remaining.length;controls('undo').disabled=!history.length;controls('inspect').disabled=!selected;
    controls('help').textContent=state.help?'帮助：开':'帮助：关';controls('help').setAttribute('aria-pressed',String(state.help));controls('mute').textContent=state.muted?'声音：关':'声音：开';controls('mute').setAttribute('aria-pressed',String(state.muted));
    root.classList.toggle('wb-complete',state.placed.length===8);root.dataset.placed=state.placed.join(' ');root.dataset.wind=String(windy(state));root.dataset.open=state.open.join(' ');root.dataset.selected=selected??'';
    trayNav.refresh();refreshTargets();
  }
  function refreshTargets(){
    if(!ready)return;
    const active=document.activeElement as HTMLElement;
    let lost=false;
    const occupied:{x:number;y:number}[]=[];
    for(const id of [...IDS].sort((a,b)=>Number(state.help&&b===selected)-Number(state.help&&a===selected))){const b=slotButton(id),p=scene.target(id),installed=state.placed.includes(id),interactive=shutter(id)||id==='cup'||id==='cat';
      let shown=p.visible&&(selected?!installed:installed&&interactive);
      if(b===active&&!shown)lost=true;
      const line=q(`[data-leader="${id}"]`);let x=p.x,y=p.y;
      // Separate touch-sized labels when perspective compresses two visible interfaces.
      // A leader keeps each label tied to its ray-verified original point; no hidden target is added.
      if(shown){
        const clear=(cx:number,cy:number)=>cx>=25&&cy>=25&&cx<stage.clientWidth-25&&cy<stage.clientHeight-25&&occupied.every(o=>Math.abs(o.x-cx)>=49||Math.abs(o.y-cy)>=49);
        if(!clear(x,y)){
          let found=false;outer:for(let r=12;r<=150;r+=12)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-.71,-.71],[.71,-.71],[-.71,.71],[.71,.71]])if(clear(p.x+dx*r,p.y+dy*r)){x=p.x+dx*r;y=p.y+dy*r;found=true;break outer;}
          if(!found)shown=false;
        }
        if(shown)occupied.push({x,y});
      }
      const length=Math.hypot(x-p.x,y-p.y);line.hidden=!shown||length<1;line.style.left=`${p.x}px`;line.style.top=`${p.y}px`;line.style.width=`${length}px`;line.style.transform=`rotate(${Math.atan2(y-p.y,x-p.x)}rad)`;
      b.hidden=!shown;b.style.left=`${x}px`;b.style.top=`${y}px`;
      b.classList.toggle('wb-hint',!!selected&&state.help&&fits(selected,id));
      b.textContent=installed?(shutter(id)?state.open.includes(id)?'关':'开':id==='cat'?'摸摸':'暖汽'):String(IDS.indexOf(id)+1);
      b.setAttribute('aria-label',installed?(shutter(id)?`${state.open.includes(id)?'关上':'打开'}${LABELS[id]}`:id==='cat'?'摸摸木猫':'看看茶杯暖汽'):`位置${IDS.indexOf(id)+1} · ${LABELS[id]}接口`);
    }
    targetNav.refresh();
    if(lost)(targets.querySelector<HTMLButtonElement>('button:not([hidden])')??controls('left')).focus({preventScroll:true});
    q('.wb-view').textContent=Math.cos(scene.angle)<0?'窗外 · 风铃挂在这里':'屋内 · 可以转到窗外';
  }
  function act(a:Action){state=reduce(state,a);save();sound();update();}
  function choose(id:Piece,keyboard=false){if(!ready||state.placed.includes(id))return;selected=id;audio.event('pick');say('再点接口或物件表面，把它放好。');update();if(state.help)hint();else if(!IDS.some(slot=>fits(id,slot)&&!state.placed.includes(slot)&&scene.target(slot).visible))say('这个角度没有可操作接口；按住左转、右转，或复位视角。');if(keyboard)targets.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({preventScroll:true});}
  let lastPointerControl:HTMLElement|null=null,lastPointerSurface:Piece|null=null;
  function place(slot:Piece){
    if(!ready||modalReasons.size)return;
    if(!selected){if(state.placed.includes(slot)){act({type:'interact',slot});scene.react(slot);audio.event(shutter(slot)?'shutter':slot==='cat'?'cat':'cup',.65);if(slot==='cup')audio.event('steam',.1);if(shutter(slot))say(windy(state)?'开窗了，看看谁动起来。':'窗关好了，小世界慢慢安静。');else say(slot==='cat'?'木猫轻轻摆了摆尾巴。':'一缕暖汽，慢慢升起来。');}return;}
    if(state.placed.includes(slot))return;
    if(!fits(selected,slot)){audio.event('mismatch',.5);say('这里形状不太合适，再看看。');return;}
    const source=selected;
    // Symmetric shutters are interchangeable. The installed geometry is the slot's authored mirrored version.
    if(shutter(source)&&source!==slot){const other=IDS.find(id=>shutter(id)&&id!==slot)!;if(state.placed.includes(other)){say('另一扇已经装好了，试试空着的窗框。');return;}}
    selected=null;history.push(slot);act({type:'place',piece:source,slot});scene.landPiece(slot);busyUntil=0;scene.frame(state,performance.now(),0);audio.place(slot==='cup'?.65:1);if(state.placed.length===8)audio.event('complete');
    say(state.placed.length===8?'小世界醒来了':`${LABELS[slot]}回家了。再选一件吧。`);
    if(state.placed.length===8)q('[data-subtitle]').textContent='可以继续开关窗，看看暖汽，摸摸木猫。';
    const next=tray.querySelector<HTMLButtonElement>('button:not([hidden])');(next??slotButton(slot)).focus({preventScroll:true});
  }
  function hint(){if(state.placed.length===8){say('试着开关窗，也可以摸摸木猫。');targets.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();return;}if(!selected){say('先从托盘选一件小物。');tray.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();return;}
    if(!state.help)act({type:'help'});stage.scrollIntoView({block:'center'});scene.frame(state,performance.now(),0);const id=selected;const ok=scene.showTarget(id,()=>{refreshTargets();const b=slotButton(id),r=b.getBoundingClientRect();return !b.hidden&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b;});say(ok?(id==='wind_chime'?'转到窗外，找墙上的挂钩。':'看看亮起的素木接口。'):'这个角度暂时被挡住；按住左转、右转或复位视角再看看。');refreshTargets();}
  function perform(action:string){
    if(dead)return;
    if(action==='exit'){destroy(true);onExit();return;}
    if(!ready)return;
    switch(action){
      case 'left':case 'right':break;
      case 'up':scene.tilt(.12);break;case 'down':scene.tilt(-.12);break;case 'in':scene.setZoom(.1);break;case 'out':scene.setZoom(-.1);break;case 'view':scene.reset();break;
      case 'prev':page--;update();break;case 'next':page++;update();break;
      case 'inspect':if(selected){const b=pieceButton(selected);const n=Number(b.dataset.angle??.35)+.7;b.dataset.angle=String(n);thumbs.set(selected,scene.thumbnail(selected,n));update();}break;
      case 'help':act({type:'help'});if(state.help&&selected)hint();break;case 'hint':hint();break;
      case 'mute':sounds.toggle();sound();break;
      case 'undo':{const slot=history.pop();if(slot){audio.clearObjects();audio.event('undo');scene.cancelLanding(slot);busyUntil=0;act({type:'undo',slot});selected=null;say('收回这一件，可以换个顺序。');update();}break;}
      case 'reset':modal('reset',true);dialog.showModal();controls('cancel-reset').focus();break;
      case 'cancel-reset':dialog.close();modal('reset',false);controls('reset').focus();break;
      case 'confirm-reset':if(dialog.open){revision++;cancelGesture();stopTurn();dialog.close();history.length=0;selected=null;busyUntil=0;page=0;lastPointerControl=null;lastPointerSurface=null;scene.resetMotion();audio.clearObjects();act({type:'reset'});scene.frame(state,performance.now(),0);modal('reset',false);say(saveWarning?'本次已重置，暂时无法保存':'选一件，把它放回小世界。');controls('reset').focus({preventScroll:true});root.dataset.revision=String(revision);}break;
    }
    refreshTargets();
  }
  let gesture:{id:number;x:number;y:number;lastX:number;start:HTMLElement;scrollX:number;scrollY:number;scrollers:{node:HTMLElement;x:number;y:number}[];piece?:Piece;moved:boolean;blocked:boolean}|null=null;
  let suppressedUntil=0,validClick=false;
  function cancelGesture(){stopTurn();gesture=null;validClick=false;suppressedUntil=performance.now()+180;stage.classList.remove('wb-dragging');}
  root.addEventListener('pointerdown',e=>{validClick=false;if(gesture||!e.isPrimary){cancelGesture();return;}suppressedUntil=0;const target=e.target as HTMLElement;const scrollers:{node:HTMLElement;x:number;y:number}[]=[];for(let node:HTMLElement|null=target;node;node=node.parentElement)scrollers.push({node,x:node.scrollLeft,y:node.scrollTop});gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,start:target,scrollX,scrollY,scrollers,piece:target.closest<HTMLElement>('[data-piece]')?.dataset.piece as Piece|undefined,moved:false,blocked:false};},{signal});
  root.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y);if(distance>9)g.moved=true;
    if(g.moved&&g.piece){if(selected!==g.piece)choose(g.piece);stage.classList.add('wb-dragging');}
    else if(g.moved&&g.start.closest('.wb-stage')&&!g.start.closest('button')&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)*1.4){scene.turn(-(e.clientX-g.lastX)*.008);refreshTargets();}
    g.lastX=e.clientX;
  },{signal});
  window.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;stage.classList.remove('wb-dragging');validClick=!g.moved&&!g.blocked&&g.start.closest('button')===(e.target as HTMLElement).closest('button');if(g.moved){suppressedUntil=performance.now()+220;if(g.piece&&!g.blocked){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-slot]');if(target&&!target.hidden)place(target.dataset.slot as Piece);else{const hit=scene.pick(e.clientX,e.clientY);if(hit)place(hit);}}}},{signal});
  root.addEventListener('click',e=>{if(e.detail!==0&&(!validClick||performance.now()<suppressedUntil)){e.preventDefault();return;}validClick=false;const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el){lastPointerControl=null;if((e.target as HTMLElement).closest('.wb-stage')){const hit=scene.pick(e.clientX,e.clientY);if(hit){if(e.detail>1&&hit===lastPointerSurface)return;lastPointerSurface=hit;void audio.unlock().then(sound);place(hit);}}return;}lastPointerSurface=null;const duplicate=e.detail>1&&el===lastPointerControl;lastPointerControl=e.detail===0?null:el;if(duplicate&&(el.dataset.slot||el.dataset.action==='undo'||el.dataset.action==='confirm-reset'))return;if(el.dataset.action==='boxes'||el.dataset.box||el.hasAttribute('data-close-boxes')||el.hasAttribute('data-sound-settings')||el.closest('.wb-sound'))return;void audio.unlock().then(sound);if(el.dataset.action)perform(el.dataset.action);else if(el.dataset.piece)choose(el.dataset.piece as Piece,e.detail===0);else if(el.dataset.slot)place(el.dataset.slot as Piece);},{signal});
  root.addEventListener('keydown',e=>{if(!ready||ignoreGameKey(e,root))return;if(e.key.toLowerCase()==='z'&&!root.querySelector('dialog[open]')){e.preventDefault();perform('undo');return;}if(e.key==='Escape'&&!root.querySelector('dialog[open]')){selected=null;cancelGesture();say('选一件，把它放回小世界。');update();tray.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();}},{signal});
  dialog.addEventListener('cancel',e=>{e.preventDefault();perform('cancel-reset');},{signal});dialog.addEventListener('close',()=>{modal('reset',false);controls('reset').focus({preventScroll:true});},{signal});
  const unbind=bindInputLifecycle(root,e=>{cancelGesture();stopTurn();if(e?.type!=='pointercancel'){background=true;audio.pause('background',true);}});
  window.addEventListener('scroll',()=>{if(gesture&&(scrollX!==gesture.scrollX||scrollY!==gesture.scrollY||gesture.scrollers.some(p=>p.node.scrollLeft!==p.x||p.node.scrollTop!==p.y)))cancelGesture();},{signal,passive:true,capture:true});root.addEventListener('wheel',cancelGesture,{signal,passive:true});
  root.addEventListener('box-audio-interrupted',e=>{background=!!(e as CustomEvent).detail;audio.pause('background',background);if(!background)sound();},{signal});
  window.addEventListener('focus',()=>{if(!dead&&!document.hidden){background=false;audio.pause('background',false);sound();}},{signal});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.hasFocus()){background=false;audio.pause('background',false);sound();}},{signal});
  const resize=new ResizeObserver(()=>{scene.resize();refreshTargets();});resize.observe(canvas);
  const tick=(now:number)=>{if(dead)return;const dt=Math.max(0,(now-last)/1000);last=now;if(ready){const paused=background||document.hidden||modalReasons.size>0;scene.frame(state,now,Math.min(.05,dt),paused);audio.tick(now,state.placed.includes('book')||state.placed.includes('plant'));root.dataset.audio=JSON.stringify(audio.diagnostics());refreshTargets();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  void scene.load().then(()=>{if(dead)return;for(const id of IDS)thumbs.set(id,scene.thumbnail(id));ready=true;root.dataset.ready='true';q('.wb-loading').hidden=true;update();if(state.placed.length)say(state.placed.length===8?'小世界醒来了':'接着上次的小世界，继续拼吧。');}).catch(()=>{if(!dead){q('.wb-loading').textContent='小世界暂时没装好，请刷新再试。已存进度保留。';}});
  window.addEventListener('pagehide',()=>destroy(true),{signal});
  function destroy(immediate=false){if(dead)return;dead=true;cancelAnimationFrame(frame);abort.abort();unbind();resize.disconnect();trayNav.destroy();targetNav.destroy();audio.destroy(immediate);scene.destroy();root.replaceChildren();}
  return{destroy};
}

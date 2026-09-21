import type {MountGameContext,MountedGame} from '../../packages/game-core';
import {bindInputLifecycle,ignoreGameKey,rovingGroup} from '../../packages/ui/input';
import {BoxAudio,AUDIO_KEY,soundPreferences} from './audio';
import {continuousTurn} from './continuous-turn';
import {ChancellorScene,PLACES,type Place} from './chancellor-scene';
import {DESK_KEY,CONTENT_VERSION,JOBS,freshDesk,restoreDesk,cloneDesk,arrange,advanceDesk,obstacle,canAdvance,delivered,totalGrain,type DeskState,type Job} from './chancellor-model';
import './style.css';import './chancellor.css';
export function mountChancellor(context:MountGameContext):MountedGame{
 const root=context.container,events=new AbortController(),signal=events.signal;let s=restoreDesk(context.storage.get(DESK_KEY,null)),history:DeskState[]=[],running=false,ready=false,dead=false,alpha=0,last=0,raf=0,selected:Place='council',warning='',assembly=false,removed:string[]=[],resetKind='box';
 const pref=soundPreferences(context.storage.get(AUDIO_KEY,null));let voiceOn=context.storage.get('chancellor-voice-v1',true);let voice:HTMLAudioElement|null=null;const audio=new BoxAudio('river-campus',pref,t=>{warning=t;render();});
 root.className='chancellor-root';root.dataset.contentVersion=CONTENT_VERSION;
 root.innerHTML=`<main class="cd-main"><header class="wb-header"><button data-action="exit">返回游戏世界</button><h1>宰相的议事桌</h1><button data-action="help">故事与帮助</button><button data-action="sound">声音</button></header>
 <section class="cd-goal" aria-label="粮食目标"><strong>把粮食送到河村和山村</strong><span data-count="river"></span><span data-count="mountain"></span></section>
 <p class="cd-intro">原创架空 · 皇帝是统治者；宰相帮朝廷商议、协调。这张桌面只放大一件粮运事务。</p>
 <div class="cd-layout"><div><div class="cd-stage"><div class="cd-canvas"></div><svg class="cd-leaders" aria-hidden="true"></svg><div class="cd-places" role="group" aria-label="桌上地点"></div><div class="cd-site-status" hidden></div></div>
 <div class="cd-camera" role="group" aria-label="观察桌面"><button data-action="left">左转</button><button data-action="right">右转</button><button data-action="zoom-in">看近</button><button data-action="zoom-out">看远</button><button data-action="home">看全桌</button></div>
 <section class="cd-local" aria-label="地点消息与操作"><h2 data-place-title></h2><p data-message></p><div data-choices></div></section>
 </div><div class="cd-plan"><section aria-label="工程队安排"><h2>工程队 <small>可与运输同时做</small></h2><p data-engineering></p><button data-action="repair">修桥 · 材料已在桥边</button></section>
 <section aria-label="运输队安排"><h2>运输队 <small>一次只开一种车船</small></h2><p data-transport></p><ol data-queue></ol><p data-block role="status"></p></section>
 <div class="cd-run"><button data-action="run">连续试运行</button><button data-action="step">观察下一步</button><button data-action="undo">撤销安排</button></div>
 <p data-phase></p><p data-stock></p><p data-status role="status"></p>
 <section data-success hidden><h2>两村的粮都到了！</h2><p>宰相协调安排；管粮的人核对数量；工程队修桥；运输队开车、开船并回报。</p><button data-action="replay">回看大家的贡献</button><ol data-log></ol></section>
 <footer><button data-action="retry">重试事件</button><button data-action="assembly">自由拼装</button><button data-action="reset">重置本盒</button></footer></div></div>
 <dialog class="wb-dialog" data-dialog="reset" aria-label="确认重置"><h2>重新开始？</h2><p>只重置这张议事桌的事件与拼装。其他盒子和声音偏好都保留。</p><button data-action="cancel-reset" autofocus>继续玩</button><button data-action="confirm-reset">确认重新开始</button></dialog>
 <dialog class="wb-dialog" data-dialog="help" aria-label="故事与帮助"><h2>宰相 <ruby>宰相<rt>zǎi xiàng</rt></ruby></h2><p>宰相不是一个人的名字。在中国古代，宰相是帮助皇帝处理国家大事的重要官员。他会参与商量事情，也会安排不同的官员配合办事。</p><p>皇帝是统治者；宰相帮助商议和协调。桌面只放大一件事，不是全国地图，不表示宰相亲自管理每座桥。</p><p>先点粮仓、坏桥、渡口或村子听消息。在工程与运输两个区域安排工作。可以暂停、改变先后、移走等待的任务，再继续看结果。车走修好的桥；船只到河村。</p><p>键盘：Tab换区域，方向键选地点，Enter或空格操作；Z撤销安排。数字和阶段均为游戏简化。无需逐袋搬粮，也无需全部工具。</p><button data-action="definition">听宰相的解释</button><button data-action="close-help">回到桌面</button></dialog>
 <dialog class="wb-dialog" data-dialog="sound" aria-label="声音设置"><h2>声音设置</h2><label><input type="checkbox" data-sound="voice">中文旁白</label><label><input type="checkbox" data-sound="music">音乐</label><label><input type="checkbox" data-sound="sfx">音效</label><button data-action="close-sound">继续玩</button></dialog></main>`;
 const q=<T extends HTMLElement=HTMLElement>(x:string)=>root.querySelector<T>(x)!;const stage=q('.cd-stage'),canvas=q('.cd-canvas'),scene=new ChancellorScene(canvas);const buttons=(x:string)=>q<HTMLButtonElement>(`[data-action="${x}"]`);
 const places=q('.cd-places');for(const [id,name]of Object.entries(PLACES)){const b=document.createElement('button');b.dataset.place=id;b.textContent=name;places.append(b);}
 const placeNav=rovingGroup(places,{items:'button'}),cameraNav=rovingGroup(q('.cd-camera'),{items:'button'});const stopTurn=continuousTurn(root,d=>{scene.turn(d);anchors();},signal);
 function save(){try{context.storage.set(DESK_KEY,s);if(JSON.stringify(context.storage.get(DESK_KEY,null))!==JSON.stringify(s))throw Error();}catch{warning='本次仍可玩，但浏览器暂时不能保存。请保持页面打开。';}}
 function stopVoice(){voice?.pause();if(voice){voice.removeAttribute('src');voice.load();}voice=null;audio.setQuiet(false);}
 function say(name:string){stopVoice();if(!voiceOn||document.hidden)return;voice=new Audio(`./assets/world-in-a-box/chancellor/audio/${name}.wav`);audio.setQuiet(true);voice.onended=()=>audio.setQuiet(false);voice.onerror=()=>{warning='这段旁白暂时无法播放，文字消息仍可读。';audio.setQuiet(false);render();};void voice.play().catch(()=>{audio.setQuiet(false);});}
 function pause(){running=false;audio.clearObjects();stopTurn();save();render();}
 function remember(){pause();history.push(cloneDesk(s));if(history.length>25)history.shift();}
 const notes:Record<Place,string>={granary:'管粮的人：一共有12袋。开始时车内6袋、粮仓6袋。出发前会自动核对并装粮。',bridge:'工程队：桥坏了，材料就在旁边。修桥分4步；运输队可同时走水路。',pier:'船工：这边是起点渡口，船最多装3袋，能到河村。开车、开船是同一支运输队。',river:'河村：水路和陆路都能到。我们要6袋；船每次3袋，车每次6袋。',mountain:'山村：这里没有通船的河道。车要经过修好的桥，送来6袋。',council:'宰相：先听大家的消息。哪些能同时做？哪些要等一等？点桌上地点安排，不用逐袋搬。'};
 function choose(p:Place){selected=p;render();say(p);}
 function render(){
  q('[data-count=river]').textContent=`河村：已收 ${s.river} / 还需 ${6-s.river}`;q('[data-count=mountain]').textContent=`山村：已收 ${s.mountain} / 还需 ${6-s.mountain}`;
  q('[data-place-title]').textContent=PLACES[selected]+' · 消息';q('[data-message]').textContent=notes[selected];
  const choices=q('[data-choices]');const old=choices.dataset.mode;const mode=assembly?'assembly':selected;if(old!==mode){choices.dataset.mode=mode;choices.replaceChildren();
   const add=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;choices.append(b);};
   if(assembly){for(const [i,n]of ['granary','river_houses','mountain_houses'].entries())add(['粮仓','河村屋','山村屋'][i]+' · 收起／放回',()=>{removed=removed.includes(n)?removed.filter(x=>x!==n):[...removed,n];});}
   else {const jobs:Job[]=selected==='pier'?['boat-river']:selected==='river'?['boat-river','cart-river']:selected==='mountain'?['cart-mountain']:selected==='granary'?['cart-river','cart-mountain','boat-river']:[];for(const job of jobs)add(JOBS[job],()=>{remember();s=arrange(s,job);save();audio.event('place-light');render();});if(selected==='bridge')add('安排工程队修桥',()=>repair());}
  }
  q('[data-engineering]').textContent=s.bridge===4?'桥已修好。':s.repair?`正在修桥：${s.bridge} / 4步`:'等待安排；材料已到场。';buttons('repair').disabled=s.repair||s.bridge===4;
  q('[data-transport]').textContent=s.active?JOBS[s.active.job]+' · '+['装粮','去程','卸粮','返程'][s.active.step]:'队伍在起点。';
  const queue=q('[data-queue]'),signature=JSON.stringify(s.queue);if(queue.dataset.signature!==signature){const focus=(document.activeElement as HTMLElement)?.dataset.queue;queue.dataset.signature=signature;queue.replaceChildren();s.queue.forEach((j,i)=>{const li=document.createElement('li');const label=document.createElement('span');label.textContent=JOBS[j];li.append(label);for(const [action,text]of [['up','提前'],['remove','移走']]){const b=document.createElement('button');b.textContent=text;b.dataset.queue=`${i}-${action}`;b.setAttribute('aria-label',`${text}第${i+1}项${JOBS[j]}`);b.disabled=action==='up'&&i===0;b.onclick=()=>{remember();if(action==='remove')s.queue.splice(i,1);else[s.queue[i-1],s.queue[i]]=[s.queue[i],s.queue[i-1]];save();render();};li.append(b);}queue.append(li);});if(focus)(queue.querySelector<HTMLButtonElement>(`[data-queue="${focus}"]`)??buttons('run')).focus({preventScroll:true});}
  q('[data-block]').textContent=s.queue.length?obstacle(s,s.queue[0]):'';
  buttons('run').textContent=running?'暂停，改安排':'连续试运行';buttons('step').disabled=running;buttons('undo').disabled=!history.length;
  q('[data-phase]').textContent=`观察到第 ${s.phase} 步 · ${running?'正在演示':'已暂停，可以改安排'}`;
  q('[data-stock]').textContent=`粮仓 ${s.warehouse} + 车 ${s.cart} + 船 ${s.boat} + 两村 ${s.river+s.mountain} = ${totalGrain(s)}袋`;
  q('[data-status]').textContent=warning||(assembly?'自由拼装：三个物件可收起、放回。按“回到事件”直接用完整桌面。':'');buttons('assembly').textContent=assembly?'回到事件':'自由拼装';
  q('[data-success]').hidden=!delivered(s);q('[data-success]').dataset.complete=String(delivered(s));root.dataset.grain=String(totalGrain(s));root.dataset.phase=String(s.phase);root.dataset.running=String(running);
  q<HTMLInputElement>('[data-sound=voice]').checked=voiceOn;q<HTMLInputElement>('[data-sound=music]').checked=audio.preferences.music>0&&!audio.preferences.muted;q<HTMLInputElement>('[data-sound=sfx]').checked=audio.preferences.sfx>0&&!audio.preferences.muted;
  for(const b of places.querySelectorAll<HTMLButtonElement>('button')){b.setAttribute('aria-pressed',String(b.dataset.place===selected));if(b.dataset.place==='bridge')b.textContent=s.bridge===4?'修好的桥':'坏桥';}
 }
 function repair(){remember();s.repair=true;s.log.push('宰相听取工程消息，安排工程队修桥。');save();render();say('repair');}
 function step(){if(!ready)return;if(!canAdvance(s)){warning=s.queue.length?obstacle(s,s.queue[0]):'先点地点听消息，再给队伍安排任务。';pause();return;}warning='';const before=s;s=advanceDesk(s);alpha=0;save();if(s.bridge===4&&before.bridge<4){audio.event('place-heavy');say('bridge-done');}else if(s.river+s.mountain>before.river+before.mountain){audio.event('complete');say(delivered(s)?'success':'arrived');}else audio.event(s.active?.job==='boat-river'?'boat-start':'place-light',.5);render();}
 let opener:HTMLElement|null=null;function openDialog(name:string){pause();stopVoice();opener=document.activeElement as HTMLElement;const d=q<HTMLDialogElement>(`[data-dialog=${name}]`);d.showModal();(d.querySelector('[autofocus]')??d.querySelector('button,input'))?.dispatchEvent(new Event('noop'));(d.querySelector<HTMLElement>('[autofocus]')??d.querySelector<HTMLElement>('button,input'))?.focus();}
 for(const d of root.querySelectorAll<HTMLDialogElement>('dialog'))d.addEventListener('close',()=>{opener?.focus({preventScroll:true});},{signal});
 root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;audio.pause('background',false);void audio.unlock().then(()=>audio.want('environment','river','sfx',.06));if(b.dataset.place){choose(b.dataset.place as Place);return;}const a=b.dataset.action;
  if(a==='exit'){pause();stopVoice();context.onExit();}
  else if(a==='repair')repair();else if(a==='run'){if(assembly){assembly=false;removed=[];}if(running)pause();else{audio.pause('background',false);step();running=canAdvance(s);render();}}
  else if(a==='step'){if(assembly){assembly=false;removed=[];}step();}
  else if(a==='undo'){pause();if(history.length){s=history.pop()!;alpha=0;save();render();}}
  else if(a==='reset'||a==='retry'){resetKind=a;openDialog('reset');}
  else if(a==='cancel-reset')q<HTMLDialogElement>('[data-dialog=reset]').close();
  else if(a==='confirm-reset'){s=freshDesk();alpha=0;history=[];warning='';if(resetKind==='reset'){assembly=false;removed=[];scene.home();}save();q<HTMLDialogElement>('[data-dialog=reset]').close();render();}
  else if(a==='help'||a==='sound')openDialog(a);else if(a==='close-help'||a==='close-sound')q<HTMLDialogElement>(`[data-dialog=${a.slice(6)}]`).close();else if(a==='definition')say('definition');
  else if(a==='zoom-in')scene.setZoom(.15);else if(a==='zoom-out')scene.setZoom(-.15);else if(a==='home')scene.home();
  else if(a==='assembly'){pause();assembly=!assembly;removed=[];render();}
  else if(a==='replay'){const log=q('[data-log]');log.replaceChildren(...s.log.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));say('success');}
 },{signal});
 root.addEventListener('change',e=>{const input=e.target as HTMLInputElement,key=input.dataset.sound;if(!key)return;if(key==='voice'){voiceOn=input.checked;if(!voiceOn)stopVoice();try{context.storage.set('chancellor-voice-v1',voiceOn);if(context.storage.get('chancellor-voice-v1',!voiceOn)!==voiceOn)throw Error();}catch{warning='旁白设置暂时不能保存。';}}else{audio.configure({...audio.preferences,muted:false,[key]:input.checked?(key==='music'?.25:.55):0});try{context.storage.set(AUDIO_KEY,audio.preferences);if(JSON.stringify(context.storage.get(AUDIO_KEY,null))!==JSON.stringify(audio.preferences))throw Error();}catch{warning='声音设置暂时不能保存。';}}render();},{signal});
 root.addEventListener('keydown',e=>{if(root.querySelector('dialog[open]')||ignoreGameKey(e,root))return;if(e.key.toLowerCase()==='z'){e.preventDefault();buttons('undo').click();}},{signal});
 let pointer:{x:number;y:number;id:number}|null=null;canvas.addEventListener('pointerdown',e=>{pointer=e.isPrimary?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;},{signal});canvas.addEventListener('pointerup',e=>{if(pointer?.id===e.pointerId&&Math.hypot(pointer.x-e.clientX,pointer.y-e.clientY)<8){const p=scene.pick(e.clientX,e.clientY);if(p)choose(p);}pointer=null;},{signal});canvas.addEventListener('pointercancel',()=>pointer=null,{signal});window.addEventListener('scroll',()=>pointer=null,{signal,capture:true});
 const releaseInput=bindInputLifecycle(root,()=>{pointer=null;pause();stopVoice();audio.pause('background',true);});root.addEventListener('box-modal',()=>{pause();stopVoice();},{signal});
 function anchors(){if(!ready)return;const w=stage.clientWidth,h=stage.clientHeight;const ids=Object.keys(PLACES) as Place[];const spots=[[.10,.46],[.60,.83],[.22,.12],[.78,.12],[.90,.70],[.22,.89]];q<SVGSVGElement & HTMLElement>('.cd-leaders').setAttribute('viewBox',`0 0 ${w} ${h}`);q('.cd-leaders').innerHTML=ids.map((id,i)=>{const p=scene.point(id),x=spots[i][0]*w,y=spots[i][1]*h;const b=places.querySelector<HTMLElement>(`[data-place=${id}]`)!;b.style.left=x+'px';b.style.top=y+'px';return `<line x1="${x}" y1="${y}" x2="${p.x}" y2="${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="3"/>`;}).join('');const blocked=!s.active&&s.queue.length&&obstacle(s,s.queue[0]);const status=q('.cd-site-status');status.hidden=!blocked;if(blocked){const bridge=s.bridge<4&&s.queue[0]!=='boat-river';const p=scene.point(bridge?'bridge':s.queue[0]==='cart-mountain'?'mountain':'river');status.textContent=bridge?'桥未通车 · 等工程队修好':s.river===3?'还需3袋 · 改船送':'这里粮已够 · 可以改安排';status.style.left=Math.max(90,Math.min(w-90,p.x))+'px';status.style.top=Math.max(45,Math.min(h-70,p.y-40))+'px';}}
 const resize=new ResizeObserver(()=>{scene.resize();anchors();});resize.observe(stage);
 void scene.load().then(()=>{if(dead)return;ready=true;render();anchors();}).catch(()=>{warning='木制场景未能加载，请刷新或重新打开家庭启动器。';render();});
 function frame(now:number){if(dead)return;const dt=Math.min(.25,(now-last)/1000);last=now;if(running){alpha+=dt/1.1;if(alpha>=1){step();if(!canAdvance(s)){running=false;render();}}audio.want('desk-motion',s.active?.job==='boat-river'?'boat':'tram','sfx',s.active?.step===1||s.active?.step===3?.13:0);}else audio.want('desk-motion','boat','sfx',0);scene.frame(s,alpha,removed);anchors();raf=requestAnimationFrame(frame);}
 render();raf=requestAnimationFrame(frame);
 return{destroy(){pause();dead=true;stopVoice();events.abort();releaseInput();cancelAnimationFrame(raf);resize.disconnect();placeNav.destroy();cameraNav.destroy();audio.destroy();scene.destroy();root.replaceChildren();root.className='';}};
}

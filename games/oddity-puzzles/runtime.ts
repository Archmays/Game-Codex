import {Intention,planAction,planTogether,planReturnPhoto,actorName,type Plan} from './intent';
import {landmarks,landmarkIcon,entityName,nodeNames,symbols,type Landmark} from './landmarks';
import type {MountGameContext} from '../../packages/game-core';
import {bindInputLifecycle,ignoreGameKey,rovingGroup,preserveRegionFocus} from '../../packages/ui/input';
import {LEVELS,initial,apply,actor,layout,item,clone,routeObstacle,position,freshSave,validSave,type Save,type Action,type ActorId,type Ability} from './model';
import {OddityScene} from './scene';
import {OddityAudio} from './audio';
import {demonstration} from './demo';
import './styles.css';
const names:Record<Ability,string>={ring:'扳指',lamp:'台灯',photo:'照片',camera:'相机',key:'钥匙'};
const rules:Record<Ability,string>={ring:'眼睛看得到，扳指才够得着。玻璃透视，墙会挡住；路也要够宽。',lamp:'灯一直照着墙的一小块，那一块才能穿过。转开灯，通道就关闭。',photo:'拿照片的人碰到同伴，才可收进一人。外面的人拿起照片，在身旁空地放出同伴。奇物留在外面。',camera:'只把预存照片里的普通物件恢复原样。还是原来那件，不会多出一件，也不会让所有事情倒退。',key:'拿钥匙走到完整门旁，选一个已知的安全地方；还要亲自穿过门。'};
const hints=[['先观察窗内的灯和墙，再看看档案盒被什么挡住。','扳指可以隔着玻璃转动关节；台灯照到的墙面才会出现通道。','在观察窗前用扳指把灯转向通道墙；进去绕过L形隔板，带盒子沿光区返回。'],['门坏了，外面的走廊也断了。相机记住了哪些东西？','相机只恢复门；钥匙需要完整锁孔，能把门接到已知安全地点。','先预览并恢复门，走到门前用钥匙连接小院，再走过门。'],['投递口很窄。室内有人能接住东西，两处开关却相隔很远。','照片能收一人；扳指能搬照片。照片要由外面的人实际拿着，才能收放。','收纳同伴，把照片送到托盘，请接应员拿起并释放。让两人分别保持开关；门会保持打开，再让全员出门。']];
const button=(id:string,label:string,extra='')=>`<button type="button" data-cmd="${id}" ${extra}>${label}</button>`;
export function mountOddity(context:MountGameContext){
 const root=context.container;root.className='oddity-mount';let save:Save=freshSave(),warning='';
 try{const raw=context.storage.get<unknown>('v1',null);if(raw===null&&localStorage.getItem('family-games/oddity-puzzles/v1')!==null)warning='旧记录无法读取，已打开新的现场。其他游戏记录保留。';if(raw!==null){if(validSave(raw))save=raw;else warning='旧记录无法读取，已打开新的现场。其他游戏记录保留。';}}catch{warning='无法读取本机记录，本次可以继续玩。';}
 const audio=new OddityAudio();audio.music=save.music;audio.sfx=save.sfx;
 type Pick={kind:'ring-target'|'ring-place'|'lamp-wall'|'release'|'capture'|'npc-move'|'npc-hold';who:ActorId;target?:string;tool?:'ring'|'lamp'};
 let scene:OddityScene|undefined,dead=false,loaded=false,paused=false,epoch=0,selected='',picking:Pick|null=null,more=false,notice='看地标认位置；点物件看动作，点脚印走过去。',opener:HTMLElement|null=null,selectionOpener:string|null=null;
 const intention=new Intention();let performingActor:ActorId='a';let currentMarks:Landmark[]=[];let actionFocus:string|null=null;let labelLayoutKey='',highlighted='';let expandedLandmarks=false;let pointer:{x:number;y:number;id:number;target:EventTarget|null}|null=null,canceledPointer=false;
 const callbacks=new Map<string,()=>void>(),previews=new Map<string,()=>void>();
 root.innerHTML=`<main class="oddity" aria-label="奇物事务所"><header class="odd-header"><a tabindex="0" href="${new URLSearchParams(location.search).get('from')==='hub'?'?hub=classic&from=world':'?world=my-game-world'}" class="odd-home">← 返回大厅</a><div><p class="odd-kicker">ODDITY OFFICE · 0.2</p><h1>奇物事务所</h1></div><button type="button" data-top="sound">声音</button></header><nav class="odd-levels" aria-label="三个案件"></nav><section class="odd-goal"><span class="odd-seal" aria-hidden="true">奇</span><div><h2></h2><p></p></div></section><div class="odd-play"><section class="odd-stage-wrap" aria-label="微缩房间"><div class="odd-stage" data-ready="false"></div><p class="odd-preview" aria-live="polite">脚印是人物终点；方框是搬运落点；人形是释放空位。</p><div class="odd-views" aria-label="观察角度">${button('view0','主视角')}${button('view1','另一侧')}${button('view2','俯看')}${button('landmarks','查看全部站位')}</div><p class="odd-caption">地标引线连着实物 · 墙仍会挡住行动</p><div class="odd-cards" aria-label="本关两种能力"></div></section><section class="odd-controls" aria-label="调查操作"><div class="odd-actors" aria-label="切换调查员"></div><p class="odd-status" role="status" aria-live="polite"></p><p class="odd-save" role="alert"></p><p class="odd-intent"></p><div class="odd-commands" aria-label="对象动作"></div><div class="odd-tools">${button('cancel','取消 · Esc','hidden')}${button('hint','提示')}${button('undo','撤回一步 · Z')}${button('reset','重置本关')}${button('resume','继续调查','hidden')}</div><p class="odd-help">Tab 换区域 · 方向键选地标 · Enter / 空格操作<br>Esc 取消 · Z 撤回 · Q 换调查员</p><div class="odd-complete" hidden></div></section></div><dialog class="odd-dialog" aria-label="调查说明"></dialog></main>`;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const host=q('.odd-stage'),commands=q('.odd-commands'),cards=q('.odd-cards'),dialog=q<HTMLDialogElement>('dialog');
 const labels=document.createElement('div');labels.className='odd-labels';labels.setAttribute('aria-label','场景地标');
 const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('odd-leaders');leaders.setAttribute('aria-hidden','true');
 const groups=[rovingGroup(q('.odd-levels'),{items:'button'}),rovingGroup(cards,{items:'button'}),rovingGroup(commands,{items:'button'}),rovingGroup(q('.odd-actors'),{items:'button'}),rovingGroup(labels,{items:'button'})];
 const state=()=>save.levels[save.current].state;
 function persist(){try{context.storage.set('v1',save);if(JSON.stringify(context.storage.get<unknown>('v1',null))!==JSON.stringify(save))throw Error('write');if(warning.startsWith('本机记录没有保存成功'))warning='';}catch{warning='本机记录没有保存成功。可以继续玩，请暂时不要关闭页面。';}q('.odd-save').textContent=warning;}
 function preserve(region:HTMLElement,html:string){preserveRegionFocus(region,()=>{region.innerHTML=html;},e=>e.dataset.cmd??null,id=>region.querySelector(`[data-cmd="${id}"]`),()=>region.querySelector('button'));}
 function render(){const s=state(),l=layout(s);root.dataset.level=String(s.level);root.dataset.active=s.active;root.dataset.won=String(s.won);root.dataset.state=JSON.stringify(s);root.dataset.history=String(save.levels[save.current].history.length);root.dataset.intent=picking?.kind??(intention.active?'running':'none');
  q('.odd-goal h2').textContent=`${s.level.toString().padStart(2,'0')} / ${l.title}`;q('.odd-goal p').textContent=l.goal;q('.odd-status').textContent=intention.active?actorName(s,performingActor)+'正在行动：'+intention.label+'；可以取消或撤回。':notice;q('.odd-save').textContent=warning;
  preserve(q('.odd-levels'),LEVELS.map(l=>button('level'+l.id,l.title,`${l.id>save.unlocked?'disabled':''} aria-current="${l.id===s.level?'step':'false'}"`)).join(''));
  preserve(q('.odd-actors'),s.actors.filter(a=>a.id!=='npc').map(a=>button('actor'+a.id,`${symbols[a.id]} ${actorName(s,a.id)}${a.inside?' · 照片中':a.id===s.active?' · 当前':''}`,`${a.inside?'disabled':''} aria-pressed="${a.id===s.active}"`)).join(''));
  preserve(cards,l.abilities.map(a=>{const o=item(s,a),loc=o.fixed?'固定灯座':o.holder?actorName(s,o.holder)+'持有':'在场景中';return `<button type="button" class="odd-card" data-cmd="ability${a}"><img alt="" src="${scene?.thumbnail(a==='photo'&&s.photo?'actor_'+s.photo:'item_'+a)??''}"><span><strong>${names[a]}</strong><small>${loc}${a==='photo'?(s.photo?' · 内有'+actorName(s,s.photo):' · 空片'):''}</small></span></button>`;}).join(''));
  q<HTMLButtonElement>('[data-cmd=resume]').hidden=!paused;q<HTMLButtonElement>('[data-cmd=cancel]').hidden=!picking&&!intention.active;q<HTMLButtonElement>('[data-cmd=undo]').disabled=!save.levels[s.level].history.length;
  q('.odd-intent').textContent=picking?`${actorName(s,picking.who)} · ${picking.tool==='lamp'?'用手':picking.kind.startsWith('ring')||picking.tool==='ring'?'用扳指':picking.kind==='release'||picking.kind==='capture'?'用照片':'接受请求'}${picking.target?' · 对'+entityName(s,picking.target):''} · ${picking.kind==='lamp-wall'?'选择墙面':picking.kind==='ring-target'||picking.kind==='capture'?'选择人物或物件':picking.kind==='npc-hold'?'选择开关':picking.kind==='release'?'选择身旁释放空位':'选择落点'}`:'';
  renderCommands();renderMarks();const complete=q('.odd-complete');complete.hidden=!s.won||intention.active;complete.innerHTML=s.won?`<h3>大家平安到达了！</h3>${s.level<3?button('next','下一个案件'):'<p>三个案件完成，可以回大厅或再探索一次。</p>'}`:'';groups.forEach(g=>g.refresh());
 }
 function startPicking(p:Pick){picking=p;more=false;selectionOpener=(document.activeElement as HTMLElement)?.dataset.cmd??null;scene?.clearGuide();render();}
 function addAction(list:string[],id:string,label:string,fn:()=>void){callbacks.set(id,fn);list.push(button(id,label,`data-action-id="${id}"`));}
 const lNodes=(s:ReturnType<typeof state>)=>layout(s).nodes;
 function renderCommands(){callbacks.clear();previews.clear();const s=state(),who=actorName(s),list:string[]=[];const add=(id:string,label:string,fn:()=>void)=>addAction(list,id,label,fn);
  const act=(label:string,a:Action,approach=false)=>{const id='action:'+a.type+':'+('actor'in a?a.actor??s.active:s.active)+':'+('item'in a?a.item:'target'in a?a.target:'switch'in a?a.switch:'node'in a?a.node:'direction'in a?a.direction:'');add(id,label,()=>perform(planAction(state(),a,approach),label));previews.set(id,()=>{const plan=planAction(state(),a,approach);if(plan.error){if(plan.obstacle)scene?.showObstacle(plan.obstacle.p);q('.odd-preview').textContent=plan.error;return;}if(a.type==='lamp'||a.type==='ring'&&a.target==='lamp'){scene?.showLamp(a.direction??1);q('.odd-preview').textContent=label+' · 选择才会转灯';}else{const kind=a.type==='ring'?'carry':a.type==='release'?'release':approach?'interaction':'walk';scene?.showRoute(approach?plan.motions.filter(m=>m.kind==='walk'):plan.motions,kind);q('.odd-preview').textContent=(approach?'□ 操作站位 · ':'')+label;}});};
  let title=selected?entityName(s,selected):'先看看房间',detail='选择地标或物件。人物头像和脚下符号相同。';
  if(intention.active){preserve(commands,'<p>行动中，不会排队执行多次点击。</p>');return;}
  if(picking){title='在场景中选择';detail='选定就执行；Esc 或取消返回。';if(picking.kind==='ring-place')act(`${actorName(s,picking.who)}：用扳指送到自己手边`,{type:'ring',target:picking.target!,node:'hand'});
   if(picking.kind==='lamp-wall')for(let i=0;i<3;i++)act(`${who}：${picking.tool==='ring'?'用扳指':'用手'}转灯 → ${['房间后墙','通道墙','左侧墙'][i]}`,picking.tool==='ring'?{type:'ring',target:'lamp',direction:i}:{type:'lamp',direction:i});
  }else if(selected){const o=s.items.find(o=>o.id===selected),person=s.actors.find(a=>a.id===selected);
   if(o){const pos=position(s,o.id),nearest=[...lNodes(s)].sort((a,b)=>Math.hypot(a.p[0]-pos[0],a.p[2]-pos[2])-Math.hypot(b.p[0]-pos[0],b.p[2]-pos[2]))[0];detail=`${nodeNames[nearest.id]??nearest.label} · ${o.holder?actorName(s,o.holder)+'持有':o.fixed?'固定在场景中':'放在场景中'}${o.id==='photo'?' · '+(s.photo?'内有'+actorName(s,s.photo):'空照片，容量一人'):''}`;}
   if(person)detail=`${person.inside?'在照片中':(nodeNames[person.node]??layout(s).nodes.find(n=>n.id===person.node)?.label)}${person.holding?' · 正保持'+entityName(s,person.holding)+'，走开会松手':''}`;
   if(selected==='lamp'){
    const canHand=!apply(s,{type:'lamp',direction:(s.lamp+1)%3}).error,hasRing=item(s,'ring').holder===s.active;
    if(canHand&&hasRing){add('tool:ring',`${who}：用扳指转灯`,()=>startPicking({kind:'lamp-wall',who:s.active,target:'lamp',tool:'ring'}));add('tool:lamp',`${who}：用手转灯`,()=>startPicking({kind:'lamp-wall',who:s.active,target:'lamp',tool:'lamp'}));}
    else {for(let i=0;i<3;i++)act(`${who}：${hasRing?'用扳指':'用手'}转灯 → ${['房间后墙','通道墙','左侧墙'][i]}`,hasRing?{type:'ring',target:'lamp',direction:i}:{type:'lamp',direction:i});}
   }else if(selected==='door'&&s.level===2||selected==='camera'||selected==='key'){
    detail='相机只恢复原门板、铰链和锁孔；断路不恢复。连接和穿门由你分别决定。';
    if(!s.doorRestored)act(`${who}：用相机恢复原门`,{type:'restore'});
    if(!s.portal)act(`${who}：走近锁孔，用钥匙连接小院`,{type:'portal'},true);
    if(s.portal)act(`${who}：走过门`,{type:'cross'},true);
   }else if(selected==='left'||selected==='right'){
    detail=(s.actors.filter(a=>a.holding===selected).map(a=>actorName(s,a.id)).join('、')||'还没有人')+'正在保持；走开会松手。';
    for(const a of s.actors.filter(a=>!a.inside))act(`${a.id==='npc'?'请求':''}${actorName(s,a.id)}：${a.holding===selected?'松开'+entityName(s,selected):'走到'+entityName(s,selected)+'并按住'}`,{type:'hold',switch:selected,actor:a.id},true);
   }else if(selected==='npc'){
    const photo=item(s,'photo');if(photo.holder==='npc'){if(s.photo)add('npc:release','请求接应员：用照片释放同伴',()=>startPicking({kind:'release',who:'npc',target:s.photo!}));add('npc:return-photo','请求接应员：把照片放回托盘',()=>perform(planReturnPhoto(state()),'把照片放回托盘'));}else if(!photo.holder)act('请求接应员：走近并拿起照片',{type:'take',item:'photo',actor:'npc'},true);
    if(actor(s,'npc').holding)act('请求接应员：松开'+entityName(s,actor(s,'npc').holding!),{type:'hold',switch:actor(s,'npc').holding!,actor:'npc'});else add('npc:hold','请求接应员：选一个开关并按住',()=>startPicking({kind:'npc-hold',who:'npc'}));add('npc:move','请求接应员：走到选定地点',()=>startPicking({kind:'npc-move',who:'npc'}));
   }else if(o?.id==='photo'){
    if(o.holder===s.active){if(s.photo)add('photo:release',`${who}：用照片释放${actorName(s,s.photo)}`,()=>startPicking({kind:'release',who:s.active,target:s.photo!}));else for(const a of s.actors.filter(a=>a.id!==s.active&&!a.inside))act(`${who}：走近并用照片收纳${actorName(s,a.id)}`,{type:'capture',target:a.id},true);}
    if(item(s,'ring').holder===s.active)add('photo:carry',`${who}：用扳指搬照片`,()=>startPicking({kind:'ring-place',who:s.active,target:'photo',tool:'ring'}));
    if(!o.holder)act(`${who}：走近并拿起照片`,{type:'take',item:'photo'},true);
    if(o.holder===s.active)act(`${who}：放下照片`,{type:'drop',item:'photo'});
    if(o.holder==='npc')add('photo:npc','查看接应员的拿放与释放请求',()=>selectEntity('npc'));
    if(!o.holder)act('请求接应员：走近并拿起照片',{type:'take',item:'photo',actor:'npc'},true);
    if(o.holder===s.active)for(const a of s.actors.filter(a=>a.id!==s.active&&!a.inside))act(`${who}：走近并把照片交给${actorName(s,a.id)}`,{type:'give',item:'photo',to:a.id},true);
   }else if(o&&!o.fixed){if(o.holder===s.active)act(`${who}：放下${o.label}`,{type:'drop',item:o.id});else if(!o.holder)act(`${who}：走近并拿起${o.label}`,{type:'take',item:o.id},true);
    if(s.items.some(i=>i.id==='ring'&&i.holder===s.active)&&o.id!=='ring')add('carry:'+o.id,`${who}：用扳指搬${o.label}`,()=>startPicking({kind:'ring-place',who:s.active,target:o.id,tool:'ring'}));
   }else if(person&&person.id!==s.active&&!person.inside){for(const o of s.items.filter(o=>o.holder===s.active))act(`${who}：走近并把${o.label}交给${actorName(s,person.id)}`,{type:'give',item:o.id,to:person.id},true);}
   if(selected==='tray')detail='这是接应托盘。搬照片时选这里作落点；拿片、放回和释放都需要明确请求。';
   if(selected==='info:gap')detail='门外走廊已经断开，普通步行无法通过。';
   if(selected==='info:slot')detail='高处的狭窄投递口只够扁平照片通过，人物身体过不去。';
  }
  if(s.level===3&&s.latched&&!s.won&&!picking){add('together','一起出去：每个人沿道路走到出口',()=>perform(planTogether(state()),'一起走到出口'));list.unshift(list.pop()!);}
  if(selected==='camera'||selected==='door'&&s.level===2)scene?.showPreview(!s.doorRestored);else scene?.showPreview(false);
  const shown=more?list:list.slice(0,3);if(list.length>3)shown.push(button('more',more?'收起':'更多动作'));
  preserve(commands,`<h3>${title}</h3><p>${detail}</p><div class="odd-options">${shown.join('')}</div>`);groups[2].refresh();
 }
 function renderMarks(){labelLayoutKey='';const s=state();const endpoints=!!picking&&['ring-place','release','npc-move'].includes(picking.kind);const walls=picking?.kind==='lamp-wall';currentMarks=landmarks(s,endpoints,walls,picking?.kind==='ring-place',expandedLandmarks);if(selected&&!currentMarks.some(m=>m.entity===selected)){const o=s.items.find(o=>o.id===selected);if(o)currentMarks.push({id:'item:'+o.id,kind:'item',entity:o.id,label:entityName(s,o.id),icon:'',p:position(s,o.id)});}if(picking?.kind==='release'){const from=layout(s).nodes.find(n=>n.id===actor(s,picking!.who).node)!.p;currentMarks=currentMarks.filter(m=>!m.node||Math.hypot(m.p[0]-from[0],m.p[2]-from[2])<=1.6);}
  const old=new Map([...labels.querySelectorAll<HTMLButtonElement>('button')].map(b=>[b.dataset.landmark!,b]));
  for(const mark of currentMarks){let b=old.get(mark.id);old.delete(mark.id);if(!b){b=document.createElement('button');b.type='button';b.dataset.landmark=mark.id;b.dataset.cmd='landmark:'+mark.id;b.className='odd-landmark';labels.append(b);}b.dataset.entityId=mark.entity??mark.id;b.dataset.kind=mark.kind;b.setAttribute('aria-pressed',String(selected===(mark.entity??mark.id)));const icon=!picking?landmarkIcon(mark):mark.kind==='item'?landmarkIcon(mark):'';const prefix=mark.kind==='node'?(picking?.kind==='release'?'♙ ':picking?.kind==='ring-place'?'▧ ':'👣 '):icon?'':mark.icon+' ';b.innerHTML=icon+`<span>${prefix}${mark.label}</span>`;b.setAttribute('aria-label',(mark.kind==='node'?(picking?.kind==='release'?'释放空位：':picking?.kind==='ring-place'?'搬运落点：':'走到'):'')+mark.label);}
  for(const b of old.values())b.remove();host.dataset.dense=String(currentMarks.length>12);host.dataset.endpoints=String(picking?.kind==='ring-place'||picking?.kind==='npc-move');scene?.showNodes(currentMarks.flatMap(m=>m.node?[m.node]:[]),picking?.kind==='release'?'release':picking?.kind==='ring-place'?'carry':'walk');groups[4].refresh();positionLabels();
 }
 function positionLabels(){
  if(!scene||!loaded)return;const w=host.clientWidth,h=host.clientHeight,points=currentMarks.map(m=>scene!.anchor(m));
  const buttons=currentMarks.map(m=>labels.querySelector<HTMLElement>(`[data-landmark="${m.id}"]`)!);
  const sizes=buttons.map(b=>({w:b.offsetWidth,h:b.offsetHeight}));
  const signature=w+':'+h+':'+points.map((p,i)=>`${currentMarks[i].id},${Math.round(p.x*2)},${Math.round(p.y*2)},${sizes[i].w},${sizes[i].h}`).join(';');
  if(signature===labelLayoutKey)return;labelLayoutKey=signature;
  const boxes:{x:number;y:number;w:number;h:number}[]=[],protectedBoxes=currentMarks.map(m=>scene!.bounds(m)).filter(b=>b!==null);let lines='';
  const priority=(m:Landmark)=>m.kind==='info'?0:m.kind==='item'?1:m.kind==='actor'?2:3;
  const order=currentMarks.map((_,i)=>i).sort((a,b)=>priority(currentMarks[a])-priority(currentMarks[b]));
  for(const i of order){const b=buttons[i],p=points[i],bw=sizes[i].w,bh=sizes[i].h;let best={x:6,y:6,score:Infinity};
   for(let y=6;y<=h-bh-6;y+=14)for(let x=6;x<=w-bw-6;x+=14){
    if(boxes.some(o=>x<o.x+o.w+5&&x+bw+5>o.x&&y<o.y+o.h+5&&y+bh+5>o.y))continue;
    const covered=points.filter((a,j)=>j!==i&&a.x>x-5&&a.x<x+bw+5&&a.y>y-5&&a.y<y+bh+5).length;
    const models=protectedBoxes.filter(o=>x<o.x+o.w&&x+bw>o.x&&y<o.y+o.h&&y+bh>o.y).length;
    const score=Math.hypot(x+bw/2-p.x,y+bh/2-p.y)+covered*1000+models*10000;
    if(score<best.score)best={x,y,score};
   }
   b.style.left=best.x+'px';b.style.top=best.y+'px';b.dataset.anchorX=p.x.toFixed(2);b.dataset.anchorY=p.y.toFixed(2);boxes.push({...best,w:bw,h:bh});
   const x=Math.max(best.x,Math.min(best.x+bw,p.x)),y=Math.max(best.y,Math.min(best.y+bh,p.y));lines+=`<path data-for="${currentMarks[i].id}" d="M${p.x},${p.y} L${x},${y}"/><circle cx="${p.x}" cy="${p.y}" r="3"/>`;
  }
  leaders.setAttribute('viewBox',`0 0 ${w} ${h}`);leaders.innerHTML=lines;highlightMark(highlighted);
 }
 function highlightMark(id:string){highlighted=id;for(const line of leaders.querySelectorAll('path'))line.classList.toggle('is-focused',line.getAttribute('data-for')===id);const active=leaders.querySelector('[data-for="'+id+'"]');if(active)leaders.append(active);}
 function cancelIntent(message='已取消，重新选择。'){pointer=null;canceledPointer=true;const before=intention.cancel();if(before){scene?.cancel();save.levels[save.current].state=before;save.levels[save.current].history.pop();persist();}audio.stop();picking=null;scene?.clearGuide();notice=message;render();if(selectionOpener)root.querySelector<HTMLElement>(`[data-cmd="${selectionOpener}"]`)?.focus({preventScroll:true});selectionOpener=null;}
 function perform(plan:Plan,label:string){if(!loaded)return;if(paused){notice='已暂停，点“继续调查”后再行动。';render();return;}if(intention.active||scene?.busy)return;if(plan.error){notice=plan.error;if(plan.obstacle)scene?.showObstacle(plan.obstacle.p);else scene?.clearGuide();render();return;}actionFocus=(document.activeElement as HTMLElement)?.dataset.cmd??null;const before=state();if(!intention.begin(before,plan,label))return;save.levels[save.current].history.push(clone(before));picking=null;scene?.clearGuide();step();if(document.activeElement===document.body)q<HTMLButtonElement>('[data-cmd=cancel]').focus({preventScroll:true});}
 function step(){const next=intention.next(state());if(!next){intention.finish();scene?.clearGuide();const s=state();if(s.won)save.unlocked=Math.max(save.unlocked,Math.min(3,s.level+1));notice=s.won?'目标完成了。':s.latched?'门锁已解除，可以主动选择一起出去。':'完成了。观察现场，再选下一步。';persist();render();restoreActionFocus();return;}
  if(next.error){notice=next.error+' 行动已停止。';intention.finish();persist();render();return;}performingActor='actor'in next.action&&next.action.actor?next.action.actor:state().active;save.levels[save.current].state=next.state;scene?.start(next.motions);if(next.action.type==='ring'&&next.action.target!=='lamp')scene?.showRoute(next.motions,'carry');else if(next.action.type==='release')scene?.showRoute(next.motions,'release');audio.cue(next.sound??'place');persist();render();
 }
 function restoreActionFocus(){if(actionFocus&&(document.activeElement===document.body||(document.activeElement as HTMLElement)?.dataset.cmd==='cancel')){const el=root.querySelector<HTMLElement>(`[data-cmd="${actionFocus}"]`)??labels.querySelector<HTMLElement>(`[data-entity-id="${selected}"]`)??commands.querySelector<HTMLElement>('button');el?.focus({preventScroll:true});}actionFocus=null;}
 function changeActor(id:ActorId){if(id==='npc'){selectEntity('npc');return;}cancelIntent('已切换调查员。');const result=apply(state(),{type:'switch',actor:id});if(result.error){notice=result.error;render();return;}save.levels[save.current].state=result.state;selected=id;persist();render();scene?.select(id);}
 function selectEntity(id:string){if(intention.active)return;selected=id;more=false;scene?.select(id);if(id==='lamp'){const s=state(),hand=!apply(s,{type:'lamp',direction:(s.lamp+1)%3}).error,ring=item(s,'ring').holder===s.active;if(!(hand&&ring)){startPicking({kind:'lamp-wall',who:s.active,target:'lamp',tool:ring?'ring':'lamp'});return;}}render();}
 function choose(mark:Landmark){if(intention.active||paused)return;const s=state(),node=mark.node??(picking&&mark.entity==='tray'?'tray':undefined),id=mark.entity;
  if(picking){const pick=picking;if(pick.kind==='ring-target'&&id){selected=id;scene?.select(id);if(id==='lamp'){selected='lamp';startPicking({kind:'lamp-wall',who:pick.who,target:'lamp',tool:'ring'});}else startPicking({kind:'ring-place',who:pick.who,target:id,tool:'ring'});return;}
   if(pick.kind==='capture'&&id&&s.actors.some(a=>a.id===id)){perform(planAction(s,{type:'capture',target:id as ActorId},true),'用照片收纳'+entityName(s,id));return;}
   if(pick.kind==='npc-hold'&&id&&['left','right'].includes(id)){perform(planAction(s,{type:'hold',switch:id,actor:'npc'},true),'请求接应员走近并保持'+entityName(s,id));return;}
   if(pick.kind==='lamp-wall'&&mark.direction!==undefined){perform(planAction(s,pick.tool==='ring'?{type:'ring',target:'lamp',direction:mark.direction}:{type:'lamp',direction:mark.direction}),actorName(s,pick.who)+'转灯');return;}
   if(node){if(pick.kind==='ring-place')perform(planAction(s,{type:'ring',target:pick.target!,node}),'用扳指搬'+entityName(s,pick.target!));else if(pick.kind==='release')perform(planAction(s,{type:'release',node,actor:pick.who}),actorName(s,pick.who)+'释放同伴');else if(pick.kind==='npc-move')perform(planAction(s,{type:'move',node,actor:'npc'}),'请求接应员走到'+mark.label);return;}
   notice='当前正在'+q('.odd-intent').textContent+'。先选目标，或取消。';render();return;
  }
  if(mark.kind==='actor'&&id!=='npc'){changeActor(id as ActorId);return;}
  if(mark.kind==='wall'&&selected==='lamp'){const ring=s.items.some(o=>o.id==='ring'&&o.holder===s.active),hand=!apply(s,{type:'lamp',direction:(s.lamp+1)%3}).error;if(ring&&hand){notice='这里可以手调，也可以用扳指，请先选工具。';render();return;}perform(planAction(s,ring?{type:'ring',target:'lamp',direction:mark.direction}:{type:'lamp',direction:mark.direction!}),'转灯朝向'+mark.label);return;}
  if(node){perform(planAction(s,node==='safe'?{type:'cross'}:{type:'move',node,actor:s.active},node==='safe'),actorName(s)+'走到'+mark.label);return;}
  selectEntity(id??mark.id);
 }
 function previewMark(mark:Landmark){if(intention.active)return;highlightMark(mark.id);scene?.select(mark.entity??'');const s=state();let a:Action|undefined,kind:'walk'|'carry'|'release'|'interaction'='walk';const node=mark.node??(picking&&mark.entity==='tray'?'tray':undefined);
  if(node){if(picking?.kind==='ring-place'){a={type:'ring',target:picking.target!,node};kind='carry';}else if(picking?.kind==='release'){a={type:'release',node,actor:picking.who};kind='release';}else if(!picking||picking.kind==='npc-move')a={type:'move',node,actor:picking?.who??s.active};}
  if(a){const r=apply(s,a);scene?.showRoute(r.motions,kind);if(r.error&&a.type==='move'){const obstacle=routeObstacle(s,actor(s,a.actor??s.active).node,a.node);if(obstacle)scene?.showObstacle(obstacle.p);}q('.odd-preview').textContent=r.error?`${mark.label}：${r.error}`:`${kind==='carry'?'▧ 搬运轨迹与照片落点':kind==='release'?'♙ 人形释放空位':'♧ 人物脚印终点'} · ${mark.label}`;}
  else if(mark.kind==='wall'&&mark.direction!==undefined){scene?.showLamp(mark.direction);q('.odd-preview').textContent='灯光将照向'+mark.label+' · 选择才会转灯';}else {scene?.clearGuide();q('.odd-preview').textContent=mark.label+' · 查看不会触发移动';}
 }
 function closeDialog(){if(dialog.open)dialog.close();opener?.focus({preventScroll:true});opener=null;}
 function openDialog(html:string){opener=document.activeElement as HTMLElement;dialog.innerHTML=html;dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();}
 function demo(a:Ability){const thumb=scene?.thumbnail('item_'+a);openDialog(`<p class="odd-kicker">小演示 · ${names[a]}</p><div class="odd-demo"><img src="${thumb}" alt="${names[a]}的模型"></div><p>${rules[a]}</p>${demonstration(a,scene?.thumbnail('actor_a')??'')}${button('skipDemo','跳过演示')}${button('doneDemo','知道了')}`);dialog.dataset.ability=a;}
 function nextDemo(){const a=layout(state()).abilities.find(a=>!save.seen.includes(a));if(a)demo(a);}
 async function load(){const current=++epoch;loaded=false;host.dataset.ready='false';intention.finish();scene?.destroy();host.replaceChildren();picking=null;selected='';expandedLandmarks=false;q<HTMLButtonElement>('[data-cmd=landmarks]').textContent='查看全部站位';q('.odd-preview').textContent='脚印是人物终点；方框是搬运落点；人形是释放空位。';scene=new OddityScene(host);host.append(leaders,labels);render();try{await scene.load(state());if(dead||epoch!==current)return;loaded=true;host.dataset.ready='true';render();nextDemo();}catch(e){if(dead||epoch!==current)return;notice='房间模型没有载入，请检查本地文件后刷新。';warning=String(e);render();}}
 function ability(a:Ability){if(intention.active)return;picking=null;selected=a;more=false;if(a==='lamp'){selectEntity('lamp');return;}if(a==='photo'&&item(state(),'photo').holder===state().active){startPicking({kind:state().photo?'release':'capture',who:state().active,target:state().photo??undefined});return;}if(a==='ring'){startPicking({kind:'ring-target',who:state().active,tool:'ring'});return;}scene?.select(a);render();}
 function command(id:string){if(id==='landmarks'){expandedLandmarks=!expandedLandmarks;q<HTMLButtonElement>('[data-cmd=landmarks]').textContent=expandedLandmarks?'只看关键地标':'查看全部站位';renderMarks();return;}if(id.startsWith('view')){scene?.view(Number(id.slice(4)));positionLabels();return;}if(id==='resume'){paused=false;audio.resume();notice='继续调查；刚才未完成的行动已取消。';render();return;}void audio.unlock();
  if(id==='cancel'){cancelIntent();return;}
  if(id==='undo'){if(intention.active){cancelIntent('已撤回整个行动。');return;}picking=null;selected='';scene?.select('');scene?.clearGuide();const h=save.levels[save.current].history;if(h.length){scene?.cancel();audio.stop();const controlled=state().active;const restored=h.pop()!;if(!actor(restored,controlled).inside)restored.active=controlled;save.levels[save.current].state=restored;notice='回到行动前，走近与操作一起撤回。';persist();}render();return;}
  if(id==='reset'){cancelIntent('准备重新布置本关。');openDialog(`<h2>重新布置本关？</h2><p>只重置本关现场、撤回和提示，保留其他关和声音偏好。</p>${button('close','继续玩')}${button('confirmReset','确定重置本关')}`);return;}
  if(id==='confirmReset'){save.levels[save.current]={state:initial(save.current),history:[],hints:0};selected='';picking=null;scene?.cancel();scene?.select('');audio.stop();notice='本关回到最初现场。';closeDialog();persist();render();return;}
  if(id==='close'){closeDialog();return;}
  if(id==='hint'){const current=save.levels[save.current];current.hints=Math.min(3,current.hints+1);persist();openDialog(`<h2>提示 · ${['观察','规则','下一步'][current.hints-1]}</h2><p>${hints[save.current-1][current.hints-1]}</p>${button('close','回到调查')}`);return;}
  if(id==='skipDemo'||id==='doneDemo'){save.seen.push(dialog.dataset.ability!);persist();closeDialog();nextDemo();return;}
  if(id==='next')id='level'+(save.current+1);
  if(id.startsWith('level')){const n=Number(id.slice(5));if(n>save.unlocked||n===save.current)return;cancelIntent();save.current=n;save.levels[n]??={state:initial(n),history:[],hints:0};audio.stop();persist();notice='先看清实物和地标，再行动。';void load();return;}
  if(id.startsWith('actor')){changeActor(id.slice(5) as ActorId);return;}
  if(id.startsWith('ability')){ability(id.slice(7) as Ability);return;}
  if(id.startsWith('landmark:')){const mark=currentMarks.find(m=>m.id===id.slice(9));if(mark)choose(mark);return;}
  if(id==='more'){more=!more;renderCommands();return;}
  if(id==='toggleMusic'||id==='toggleSfx'){if(id==='toggleMusic')save.music=!save.music;else save.sfx=!save.sfx;audio.music=save.music;audio.sfx=save.sfx;audio.sync();persist();showSound(false);return;}
  if(!paused&&!intention.active)callbacks.get(id)?.();
 }
 function showSound(open=true){const html=`<h2>声音</h2>${button('toggleMusic',save.music?'音乐：开':'音乐：关')}${button('toggleSfx',save.sfx?'音效：开':'音效：关')}${button('close','回到调查')}`;if(open)openDialog(html);else{const id=(document.activeElement as HTMLElement)?.dataset.cmd;dialog.innerHTML=html;dialog.querySelector<HTMLElement>(`[data-cmd="${id}"]`)?.focus();}}
 const click=(e:MouseEvent)=>{if((e.target as Element).closest('.odd-home')){cancelIntent('已离开现场。');return;}const el=(e.target as Element).closest<HTMLButtonElement>('button');if(!el||!root.contains(el))return;if(canceledPointer&&e.detail!==0){e.preventDefault();canceledPointer=false;return;}if(el.dataset.top==='sound'){void audio.unlock();showSound();return;}if(el.dataset.cmd)command(el.dataset.cmd);};root.addEventListener('click',click);
 const key=(e:KeyboardEvent)=>{if(dialog.open||ignoreGameKey(e,root))return;if(e.key.toLowerCase()==='z'){e.preventDefault();command('undo');}else if(e.key.toLowerCase()==='q'){e.preventDefault();const next=state().actors.find(a=>a.id!==state().active&&a.id!=='npc'&&!a.inside);if(next)changeActor(next.id);}else if(e.key==='Escape'){e.preventDefault();cancelIntent();}};root.addEventListener('keydown',key);
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(dialog.querySelector('[data-cmd=skipDemo]'))command('skipDemo');else closeDialog();});
 const focus=(e:FocusEvent)=>{const b=(e.target as Element).closest<HTMLElement>('[data-landmark]');if(!b)return;const mark=currentMarks.find(m=>m.id===b.dataset.landmark);if(mark){previewMark(mark);for(const el of labels.querySelectorAll('button'))el.setAttribute('aria-pressed',String(el===b));}};labels.addEventListener('focusin',focus);commands.addEventListener('focusin',e=>{const id=(e.target as HTMLElement).dataset.cmd;if(id)previews.get(id)?.();});commands.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const id=(e.target as Element).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;if(id)previews.get(id)?.();});
 labels.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const b=(e.target as Element).closest<HTMLElement>('[data-landmark]');const mark=currentMarks.find(m=>m.id===b?.dataset.landmark);if(mark)previewMark(mark);});
 root.addEventListener('pointerdown',e=>{canceledPointer=false;pointer=e.isPrimary&&e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId,target:e.target}:null;},true);
 root.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8){pointer=null;canceledPointer=true;}},true);
 host.addEventListener('pointerup',e=>{if((e.target as Element).closest('button'))return;const start=pointer;pointer=null;if(!start||start.id!==e.pointerId||canceledPointer)return;const pick=scene?.pick(e.clientX,e.clientY);const mark=pick?.target?pickEntity(pick.target):pick?.node?currentMarks.find(m=>m.node===pick.node):pick?.wall!==undefined?currentMarks.find(m=>m.direction===pick.wall):undefined;if(mark){choose(mark);const button=labels.querySelector<HTMLElement>(`[data-landmark="${mark.id}"]`);button?.focus({preventScroll:true});}});
 host.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||pointer||(e.target as Element).closest('button'))return;const pick=scene?.pick(e.clientX,e.clientY),mark=currentMarks.find(m=>pick?.target?m.entity===pick.target:pick?.node?m.node===pick.node:pick?.wall!==undefined?m.direction===pick.wall:false);if(mark)previewMark(mark);});
 function pickEntity(id:string):Landmark|undefined{return currentMarks.find(m=>m.entity===id)??(state().items.some(o=>o.id===id)?{id:'item:'+id,kind:'item',entity:id,label:entityName(state(),id),icon:'',p:position(state(),id)}:undefined);}
 const unbind=bindInputLifecycle(root,event=>{pointer=null;canceledPointer=true;if(event?.type==='pointercancel')return;if(!dead&&loaded){cancelIntent('刚才失去焦点，未完成的行动已取消。');paused=true;audio.pause();render();}});
 const actionHome=q('.odd-controls');const actorButtons=q('.odd-actors');host.before(actorButtons);function dockActions(){const mobile=matchMedia('(max-width:850px)').matches;const status=q('.odd-status'),intent=q('.odd-intent');if(mobile){if(commands.parentElement!==host.parentElement)host.after(status,intent,commands);}else if(commands.parentElement!==actionHome)actionHome.prepend(status,intent,commands);}
 dockActions();const resize=new ResizeObserver(()=>{dockActions();scene?.resize();positionLabels();});resize.observe(host);let last=performance.now(),raf=0;
 function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;scene?.frame(state(),dt,paused||document.hidden||dialog.open);if(intention.active&&!scene?.busy&&!paused&&!dialog.open&&!document.hidden)step();positionLabels();raf=requestAnimationFrame(frame);}raf=requestAnimationFrame(frame);void load();
 return {destroy(){dead=true;epoch++;const before=intention.cancel();if(before){save.levels[save.current].state=before;save.levels[save.current].history.pop();persist();}cancelAnimationFrame(raf);unbind();resize.disconnect();groups.forEach(g=>g.destroy());root.removeEventListener('click',click);root.removeEventListener('keydown',key);audio.destroy();scene?.destroy();}};
}

import './style.css';
import {parseQuery,Shelf,type CharacterIndex,type StrokeData} from './model';
import {makeGlyph,StrokeView} from './stroke-view';
import {Handwriting,type Match} from './handwriting';
import type {MountedGame} from '../../packages/game-core';

interface Card {
  id:string; char:string; position:number; alive:boolean; node:HTMLElement; glyph:HTMLElement;
  data:StrokeData|null; loading:Promise<void>; renderer:StrokeView|null;
}

export function mountHanziStrokeLab(root:HTMLElement,onExit?:()=>void):MountedGame {
  const abort=new AbortController(),opts={signal:abort.signal};
  const shelf=new Shelf({getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)});
  // Data/request identity is by character; all mutable state is by occurrence.
  const cache=new Map<string,Promise<StrokeData>>();
  let index:CharacterIndex={},destroyed=false,revision=0,cards:Card[]=[],query='',selected=0;
  let composing=false,compositionUntil=0,detail:Card|null=null,preview:Card|null=null,detailScroll=0,handChoice='';
  let queue:'idle'|'running'|'paused'='idle',cursor=0,queueRevision=0,skipped:string[]=[];
  root.className='hsl-root';delete root.dataset.indexReady;
  root.innerHTML=`<main class="hsl" data-testid="hanzi-stroke-lab">
    <header class="hsl-header"><div><p class="hsl-eyebrow">中文 · 查字工具</p><h1>汉字书房</h1></div><a tabindex="0" class="hsl-return" href="?world=my-game-world" data-hsl-return>返回首页 ↗</a></header>
    <section class="hsl-search" aria-label="查字">
      <form data-search><label class="hsl-label" for="hsl-input">输入或粘贴汉字</label><div class="hsl-search-row"><input id="hsl-input" type="text" autocomplete="off" spellcheck="false" placeholder="例如：天天向上" aria-describedby="hsl-query-note"><button class="hsl-primary" type="submit">查询</button></div></form>
      <div class="hsl-entry-row"><button data-pane="hand" aria-expanded="false" aria-controls="hsl-hand">手写找字</button><button data-pane="query">回到查字</button><button data-shelf-toggle aria-expanded="false" aria-controls="hsl-shelf">常用 · 最近 · 收藏</button></div>
      <p id="hsl-query-note" class="hsl-note" role="status">一次最多 48 个字符，重复字也会保留。</p>
    </section>
    <section id="hsl-hand" class="hsl-card hsl-hand" hidden aria-labelledby="hsl-hand-title">
      <div class="hsl-section-heading"><h2 id="hsl-hand-title">不会读？写出来</h2><span class="hsl-local">本机识别</span></div>
      <div class="hsl-hand-layout"><div><p class="hsl-note">用手指、鼠标或笔写一个字。</p><svg class="hsl-pad" data-pad viewBox="0 0 256 256" tabindex="0" role="application" aria-label="手写画布，键盘用户先选择键盘画笔" aria-describedby="hsl-pen-help"></svg></div>
      <div><p class="hsl-note" data-hand-status role="status">打开手写区后载入本地模型。</p><div class="hsl-char-list hsl-candidates" data-candidates role="group" aria-label="手写候选"></div>
      <div data-hand-choice hidden><p data-choice-label></p><div class="hsl-row"><button data-hand-query class="hsl-primary">查看这个字</button><button data-hand-add>加入这组</button><button data-hand-next>继续写下一个</button></div></div>
      <div class="hsl-row"><button data-undo>撤销上一笔</button><button data-clear>清空重写</button><button data-recognize>重新识别</button></div>
      <details><summary>键盘画笔</summary><p id="hsl-pen-help">方向键移动，空格落笔／抬笔，Esc 取消并退出；Tab 可离开。Shift＋方向键大步移动。</p><button data-pen>进入键盘画笔</button></details>
      <details><summary>没有找到想要的字？</summary><p>候选是近似匹配，可撤销、清空再写。模型不覆盖所有汉字。</p><button data-retry-hand>重新载入识别</button></details></div></div>
    </section>
    <section id="hsl-shelf" class="hsl-card hsl-shelf" hidden aria-label="本地字架"><h2>常用字</h2><div class="hsl-char-list" data-common role="group" aria-label="常用字"></div><div class="hsl-section-heading"><h2>最近查看</h2><button data-clear-recent>清空最近</button></div><div class="hsl-char-list" data-recent role="group" aria-label="最近查看"></div><div class="hsl-section-heading"><h2>收藏的字</h2><button data-clear-favorites>清空收藏</button></div><div class="hsl-char-list" data-favorites role="group" aria-label="收藏的字"></div></section>
    <p class="hsl-note" data-storage-status role="status"></p>
    <section aria-label="这组字"><div class="hsl-group-controls" data-group-controls hidden><button class="hsl-primary" data-group-play>依次播放这组字</button><button data-group-restart>全组重播</button><label>速度<select data-group-speed aria-label="整组播放速度"><option value="0.5">0.5 倍</option><option value="1" selected>1 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label></div>
      <p class="hsl-note" data-group-status role="status"></p><div class="hsl-results" data-results role="group" aria-label="查询结果；方向键换卡，Enter 查看详情"></div>
    </section>
    <dialog class="hsl-detail hsl-card" data-detail aria-labelledby="hsl-character-title"><div class="hsl-section-heading"><h2 id="hsl-character-title" tabindex="-1"></h2><button data-close-detail autofocus>关闭详情</button></div><p class="hsl-pinyin" data-detail-pinyin></p><p class="hsl-note" data-detail-note></p><div data-detail-glyph></div><p class="hsl-step-status" data-step-status role="status"></p>
      <div class="hsl-controls"><button class="hsl-primary" data-detail-play>▶ 播放</button><button data-restart>重播这个字</button><button data-all>完整字形</button><button data-prev>上一笔</button><button data-next>下一笔</button><button data-detail-favorite>☆ 收藏</button><label>速度<select data-speed aria-label="播放速度"><option value="0.5">0.5 倍</option><option value="1" selected>1 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label></div>
      <label class="hsl-grid-toggle"><input type="checkbox" data-grid> 显示田字格</label><p class="hsl-legend">实心：已写 · 强调色：当前笔 · 虚线：待写</p><h3>逐笔查看</h3><div class="hsl-steps" data-steps role="group" aria-label="逐笔步骤"></div>
      <details><summary>字形与来源</summary><p data-meta></p><p data-reading-note></p><p>保留原字形，不转换简繁。笔顺沿用本地字库，地区规范可能有差异。</p></details>
      <div class="hsl-row" data-detail-hand hidden><button data-continue-hand>继续写下一个</button><button data-back-group>返回原来这组</button></div>
    </dialog>
    <footer class="hsl-footer"><details><summary>字库、读音与本地隐私</summary><p>本地收录 9,574 个字形条目（含少量部件），手写模型覆盖 9,507 个候选。未覆盖全部 Unicode 汉字。查询保留原字，不自动转换简繁。</p><p>字音优先 Unicode 17.0 的《通用规范汉字字典》2013 数据，其次《现代汉语词典》1983 数据，最后采用 Unihan 普通话读音。不做词句语境判断，也不保证穷尽所有读音。</p><p>笔顺来自 Hanzi Writer Data / Make Me a Hanzi，面向中国大陆笔顺；保留上游字形，繁体及地区字形可能有差异。本工具不声明逐字通过国家规范认证。</p><p>笔顺字形 © Arphic Technology，按 Arphic Public License 分发，无担保。识别引擎 hanzi_lookup 按 LGPL-3.0 分发，可替换其独立文件。查询、轨迹和候选不上传；仅最近、收藏、田字格保存在本机，不保存书写轨迹。</p><p><a tabindex="0" href="./hanzi-stroke-lab/SOURCES.md" target="_blank" rel="noopener">来源与版本</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/ARPHICPL.TXT" target="_blank" rel="noopener">笔顺许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/LGPL-3.0.txt" target="_blank" rel="noopener">识别许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/UNICODE-LICENSE.txt" target="_blank" rel="noopener">字音许可</a></p></details></footer>
  </main>`;
  const el=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const text=(s:string,value:string)=>{el(s).textContent=value;};
  const button=(s:string,fn:()=>void)=>el(s).addEventListener('click',fn,opts);
  const input=el<HTMLInputElement>('#hsl-input'),grid=el<HTMLInputElement>('[data-grid]'),dialog=el<HTMLDialogElement>('[data-detail]');grid.checked=shelf.state.grid;
  const hand=new Handwriting(root.querySelector('[data-pad]')!,t=>text('[data-hand-status]',t),renderCandidates,()=>{handChoice='';el('[data-hand-choice]').hidden=true;});

  function group(selector:string,values:string[],choose:(char:string,i:number)=>void,labels?:(char:string,i:number)=>string):void {
    const host=el(selector),hadFocus=host.contains(document.activeElement),old=host.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.dataset.position;
    host.replaceChildren();values.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=c;b.dataset.position=String(i);b.tabIndex=i===Math.min(Number(old)||0,values.length-1)?0:-1;b.setAttribute('aria-label',labels?.(c,i)??c);b.addEventListener('click',()=>choose(c,i));host.append(b);});
    if(hadFocus)host.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
  function renderCandidates(matches:Match[]):void {
    if(!matches.length){handChoice='';el('[data-hand-choice]').hidden=true;}
    group('[data-candidates]',matches.map(m=>m.hanzi),c=>{handChoice=c;text('[data-choice-label]',`已选「${c}」`);el('[data-hand-choice]').hidden=false;el('[data-hand-query]').focus();},(c,i)=>`候选 ${i+1}：${c}`);
  }
  function setHand(open:boolean,focus=false):void {
    el('#hsl-hand').hidden=!open;el('[data-pane=hand]').setAttribute('aria-expanded',String(open));
    if(open){pauseAll();hand.start();if(focus)el('#hsl-hand').scrollIntoView({block:'start'});}else hand.suspend();
  }
  function updateShelf():void {
    group('[data-recent]',shelf.state.recent,c=>search(c));group('[data-favorites]',shelf.state.favorites,c=>search(c));
    el<HTMLButtonElement>('[data-clear-recent]').disabled=!shelf.state.recent.length;el<HTMLButtonElement>('[data-clear-favorites]').disabled=!shelf.state.favorites.length;
    text('[data-storage-status]',shelf.notice);
    for(const card of cards){const b=card.node.querySelector<HTMLButtonElement>('[data-favorite]')!,fav=shelf.state.favorites.includes(card.char);b.setAttribute('aria-pressed',String(fav));b.textContent=fav?'★ 已藏':'☆ 收藏';}
    if(detail){const b=el('[data-detail-favorite]'),fav=shelf.state.favorites.includes(detail.char);b.setAttribute('aria-pressed',String(fav));b.textContent=fav?'★ 已收藏':'☆ 收藏';}
  }
  function loadData(char:string):Promise<StrokeData> {
    const existing=cache.get(char);if(existing)return existing;
    const promise=fetch(new URL(`./hanzi-stroke-lab/chars/${char.codePointAt(0)!.toString(16)}.json`,document.baseURI),{signal:abort.signal}).then(async r=>{
      if(!r.ok)throw Error('load');const d=await r.json() as StrokeData;
      if(!d.strokes?.length||d.strokes.length!==d.medians?.length)throw Error('invalid');return d;
    }).catch(error=>{cache.delete(char);throw error;});
    cache.set(char,promise);if(cache.size>96)cache.delete(cache.keys().next().value!);return promise;
  }
  function makeCard(char:string,position:number):Card {
    const node=document.createElement('article'),id=`hsl-${revision}-${position}`;node.className='hsl-card hsl-result';node.dataset.occurrence=id;node.dataset.position=String(position);node.tabIndex=position===selected?0:-1;
    node.innerHTML='<div class="hsl-card-heading"><h2 data-character></h2><span data-order></span></div><p class="hsl-pinyin" data-pinyin></p><p class="hsl-note" data-count></p><div data-card-glyph><div class="hsl-glyph" data-glyph></div></div><p class="hsl-card-note" data-card-note></p><p class="hsl-card-status" data-card-status></p><div class="hsl-card-actions"><button class="hsl-primary" data-play disabled>▶ 播放</button><button data-favorite>☆ 收藏</button><button data-open-detail>逐笔详情</button></div>';
    const row=index[char],put=(s:string,v:string)=>{node.querySelector(s)!.textContent=v;};
    put('[data-character]',char);put('[data-order]',`${position+1}`);put('[data-pinyin]',row?.[0]||'读音未收录');put('[data-count]',row?`${row[1]} 笔`:'笔数未收录');
    put('[data-card-note]',!row?'本地缺数据，原字保留。':row[0].includes('/')?'多音字 · 请结合词句判断。':!row[0]?'部件字形，无可核实的独立读音。':'');
    node.setAttribute('aria-label',`第 ${position+1} 个字：${char}，${row?.[0]||'读音未收录'}。Enter 查看详情`);
    const glyph=node.querySelector<HTMLElement>('[data-glyph]')!;glyph.textContent=char;glyph.setAttribute('aria-label',`${char}的字形`);
    const card:Card={id,char,position,alive:true,node,glyph,data:null,loading:Promise.resolve(),renderer:null};
    // A repeated region has one tab stop. Enter opens all actions; arrows select occurrences.
    node.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.tabIndex=-1);
    node.querySelector('[data-play]')!.addEventListener('click',()=>singlePlay(card));
    node.querySelector('[data-favorite]')!.addEventListener('click',()=>{shelf.favorite(char);updateShelf();});
    node.querySelector('[data-open-detail]')!.addEventListener('click',()=>openDetail(card,true));
    if(row?.[1]){
      const rev=revision;put('[data-card-status]','载入字形中……');
      card.loading=loadData(char).then(data=>{
        if(destroyed||!card.alive||rev!==revision)return;card.data=data;glyph.replaceChildren(makeGlyph(data,data.strokes.length,shelf.state.grid));
        put('[data-card-status]','完整字形');node.querySelector<HTMLButtonElement>('[data-play]')!.disabled=false;
        if(detail===card)populateDetail(card);
      }).catch(()=>{if(card.alive&&!destroyed){put('[data-card-status]','字形加载失败，详情中可重试。');if(detail===card)updateDetail();}});
    }else put('[data-card-status]','暂无笔顺');
    return card;
  }
  function renderer(card:Card):StrokeView|null {
    if(!card.data)return null;
    if(!card.renderer){card.renderer=new StrokeView(card.glyph,()=>updateCard(card),()=>{
      if(queue==='running'&&cards[cursor]===card){cursor++;void advance(queueRevision);}
    });card.renderer.grid=shelf.state.grid;card.renderer.setData(card.data);}
    return card.renderer;
  }
  function updateCard(card:Card):void {
    const r=card.renderer;if(!r)return;
    const label=r.playing?'Ⅱ 暂停':r.complete?'▶ 播放':'▶ 继续';card.node.querySelector('[data-play]')!.textContent=label;
    card.node.dataset.playing=String(r.playing);card.node.dataset.step=String(r.step);card.node.dataset.complete=String(r.complete);
    card.node.querySelector('[data-card-status]')!.textContent=r.complete?'完整字形':`第 ${r.step+1} / ${card.data!.strokes.length} 笔 · ${r.playing?'书写中':'已暂停'}`;
    if(detail===card)updateDetail();
  }
  function stopCards(except?:Card):void {for(const c of [...cards,...(preview?[preview]:[])])if(c!==except&&c.renderer){c.renderer.stop();updateCard(c);}}
  function exitQueue():void {queueRevision++;queue='idle';updateQueue();}
  function pauseAll():void {stopCards();if(queue==='running'){queue='paused';queueRevision++;updateQueue();}}
  function singlePlay(card:Card):void {
    const r=renderer(card);if(!r)return;exitQueue();stopCards(card);if(card.position>=0)selected=card.position;selectCard();r.toggle();
    text('[data-group-status]',`单字播放：「${card.char}」。组队列已退出。`);
  }
  function updateQueue():void {
    text('[data-group-play]',queue==='running'?'Ⅱ 暂停这组':queue==='paused'?'▶ 继续这组':'依次播放这组字');
    const skip=skipped.length?` 已跳过缺数据字：${skipped.join('、')}。`:'';
    text('[data-group-status]',(queue==='idle'?'':`${queue==='paused'?'已暂停':'依次播放'} · 第 ${Math.min(cursor+1,cards.length)} / ${cards.length} 个字。`)+skip);
  }
  async function advance(token:number):Promise<void> {
    while(queue==='running'&&token===queueRevision&&cursor<cards.length){
      const card=cards[cursor];updateQueue();await card.loading;
      if(destroyed||token!==queueRevision||queue!=='running'||!card.alive)return;
      const r=renderer(card);
      if(!r){skipped.push(`第 ${cursor+1} 个「${card.char}」`);cursor++;continue;}
      stopCards(card);r.speed=Number(el<HTMLSelectElement>('[data-group-speed]').value);r.play();return;
    }
    if(token===queueRevision&&queue==='running'){queue='idle';updateQueue();text('[data-group-status]',`这组已播放完。${skipped.length?`已跳过缺数据字：${skipped.join('、')}。`:''}`);}
  }
  function playGroup(restart=false):void {
    if(queue==='running'&&!restart){pauseAll();return;}
    stopCards();
    if(queue==='idle'||restart){cursor=0;skipped=[];for(const c of cards)c.renderer?.showAll();}
    queue='running';void advance(++queueRevision);
  }
  function selectCard():void {for(const c of cards){c.node.tabIndex=c.position===selected?0:-1;c.node.dataset.selected=String(c.position===selected);}}
  function historyWrite(push:boolean):void {
    const u=new URL(location.href);u.searchParams.set('play','hanzi-stroke-lab');
    if(query)u.searchParams.set('q',query);else u.searchParams.delete('q');u.searchParams.set('i',String(selected));
    if(detail)u.searchParams.set('detail','1');else u.searchParams.delete('detail');
    if(detail===preview&&preview)u.searchParams.set('hand',preview.char);else u.searchParams.delete('hand');
    history[push?'pushState':'replaceState']({...history.state,hsl:true,hslScroll:detail?detailScroll:scrollY},'',u.pathname+u.search+u.hash);
  }
  function openDetail(card:Card,push=false):void {
    if(detail===card&&dialog.open)return;
    if(detail)closeDetail(false,false);
    if(card.position>=0)selected=card.position;selectCard();detailScroll=scrollY;detail=card;
    // Transfer the live SVG, never copy its masks or reset its progress. The card stays readable.
    const placeholder=document.createElement('div');placeholder.className='hsl-glyph';placeholder.dataset.placeholder='';
    if(card.data)placeholder.append(makeGlyph(card.data,card.data.strokes.length,shelf.state.grid));else placeholder.textContent=card.char;
    card.glyph.before(placeholder);el('[data-detail-glyph]').append(card.glyph);
    text('#hsl-character-title',`${card.char} · ${card.position>=0?`第 ${card.position+1} 个字`:'手写查询'}`);text('[data-detail-pinyin]',index[card.char]?.[0]||'读音未收录');
    text('[data-detail-note]',card.node.querySelector('[data-card-note]')!.textContent||'');
    const row=index[card.char];text('[data-meta]',`U+${card.char.codePointAt(0)!.toString(16).toUpperCase()} · ${row?.[3]?`对应简体：${row[3]}`:row?.[4]?`对应繁体：${row[4]}`:'保留输入字形'}`);
    text('[data-reading-note]',row?.[0]?`${row[2]==='kTGHZ2013'?'通用规范汉字字典 2013':row[2]==='kXHC1983'?'现代汉语词典 1983':'Unihan 普通话'}收录读音；未做语境判断，读音表可能不完整。`:'暂无可核实的独立读音。');
    el('[data-detail-hand]').hidden=card!==preview;populateDetail(card);updateShelf();shelf.visit(card.char);updateShelf();
    dialog.showModal();dialog.scrollTop=0;el('[data-close-detail]').focus();if(push)historyWrite(true);
  }
  function populateDetail(card:Card):void {
    if(detail!==card)return;
    const r=renderer(card);el<HTMLSelectElement>('[data-speed]').value=String(r?.speed||1);
    group('[data-steps]',card.data?.strokes.map((_,i)=>String(i+1))||[],(_,i)=>{exitQueue();stopCards();renderer(card)?.go(i);},(_,i)=>`第 ${i+1} 笔`);
    if(card.data)el('[data-steps]').querySelectorAll('button').forEach((b,i)=>b.prepend(makeGlyph(card.data!,i,shelf.state.grid)));
    updateDetail();
  }
  function updateDetail():void {
    if(!detail)return;const r=detail.renderer,n=detail.data?.strokes.length||0;
    for(const s of ['[data-detail-play]','[data-all]','[data-prev]','[data-next]'])el<HTMLButtonElement>(s).disabled=!n;
    el<HTMLButtonElement>('[data-restart]').disabled=!index[detail.char]?.[1];text('[data-restart]',n?'重播这个字':'重试加载字形');
    el<HTMLButtonElement>('[data-prev]').disabled=!n||(!r?.complete&&r?.step===0);el<HTMLButtonElement>('[data-next]').disabled=!n||(!r?.complete&&r?.step===n-1);
    text('[data-detail-play]',r?.playing?'Ⅱ 暂停':r?.complete?'▶ 播放':'▶ 继续播放');
    text('[data-step-status]',!n?detail.node.querySelector('[data-card-status]')!.textContent||'暂无笔顺':r?.complete?`完整字形 · 共 ${n} 笔`:`第 ${r!.step+1} / ${n} 笔 · ${r!.playing?'正在书写':'已暂停，可继续或逐笔查看'}`);
    for(const b of el('[data-steps]').querySelectorAll<HTMLElement>('button'))b.setAttribute('aria-pressed',String(!r?.complete&&Number(b.dataset.position)===r?.step));
  }
  function closeDetail(push=false,focus=true):void {
    const card=detail;if(!card)return;detail=null;dialog.close();card.node.querySelector('[data-placeholder]')?.remove();card.node.querySelector('[data-card-glyph]')!.append(card.glyph);el('[data-steps]').replaceChildren();
    if(card===preview){card.alive=false;card.renderer?.destroy();preview=null;if(focus)el('[data-pane=hand]').focus({preventScroll:true});}
    else if(focus&&card.alive)card.node.focus({preventScroll:true});
    if(focus)window.scrollTo(0,detailScroll);if(push)historyWrite(true);
  }
  function buildQuery(value:string):void {
    pauseAll();exitQueue();closeDetail(false,false);revision++;
    for(const c of cards){c.alive=false;c.renderer?.destroy();}cards=[];el('[data-results]').replaceChildren();query=value;input.value=value;
    const result=parseQuery(value);text('#hsl-query-note',result.message);
    if(result.valid&&!Object.keys(index).length){text('#hsl-query-note','字库尚未载入，请稍后再试。');el('[data-group-controls]').hidden=true;return;}
    cards=result.chars.map(makeCard);el('[data-results]').append(...cards.map(c=>c.node));el('[data-group-controls]').hidden=!cards.length;selectCard();updateShelf();
  }
  function search(value:string):void {selected=0;setHand(false);buildQuery(value);historyWrite(true);cards[0]?.node.focus({preventScroll:true});}
  function restore():void {
    const q=new URLSearchParams(location.search),value=q.get('q')||'',pos=Number(q.get('i')||0);
    selected=Number.isInteger(pos)&&pos>=0&&pos<parseQuery(value).chars.length?pos:0;
    if(value!==query||!cards.length)buildQuery(value);else{pauseAll();closeDetail(false,false);selectCard();input.value=value;}
    // Old q/i links show the entire group; explicit detail=1 restores the open panel.
    const h=q.get('hand');
    if(q.get('detail')==='1'&&h&&[...h].length===1&&parseQuery(h).valid){preview=makeCard(h,-1);openDetail(preview);}
    else if(q.get('detail')==='1'&&cards[selected])openDetail(cards[selected]);
    else if(cards[selected]){cards[selected].node.focus({preventScroll:true});if(typeof history.state?.hslScroll==='number')window.scrollTo(0,history.state.hslScroll);}
  }
  el('[data-search]').addEventListener('submit',e=>{e.preventDefault();if(!composing&&performance.now()>=compositionUntil)search(input.value);},opts);
  input.addEventListener('compositionstart',()=>{composing=true;},opts);input.addEventListener('compositionend',()=>{composing=false;compositionUntil=performance.now()+80;},opts);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229||composing))e.preventDefault();},opts);
  group('[data-common]',[...'永你好学习行水火心'],c=>search(c));
  button('[data-pane=hand]',()=>setHand(el('#hsl-hand').hidden,true));button('[data-pane=query]',()=>{setHand(false);input.focus();});
  button('[data-shelf-toggle]',()=>{const s=el('#hsl-shelf');s.hidden=!s.hidden;el('[data-shelf-toggle]').setAttribute('aria-expanded',String(!s.hidden));});
  button('[data-undo]',()=>hand.undo());button('[data-clear]',()=>hand.clear());button('[data-pen]',()=>hand.enterKeyboard());button('[data-retry-hand]',()=>hand.retry());button('[data-recognize]',()=>hand.recognize());
  // A candidate is only a choice. Checking it does not rewrite the query; adding is explicit.
  button('[data-hand-query]',()=>{
    if(!handChoice)return;
    setHand(false);preview=makeCard(handChoice,-1);openDetail(preview,true);
  });
  button('[data-hand-add]',()=>{if(handChoice){const value=cards.map(c=>c.char).join('')+handChoice;const result=parseQuery(value);if(result.valid)search(value);else text('#hsl-query-note',result.message);}});
  const nextHand=()=>{closeDetail(true);hand.clear();setHand(true,true);el('[data-pad]').focus();};
  button('[data-hand-next]',nextHand);button('[data-continue-hand]',nextHand);button('[data-back-group]',()=>closeDetail(true));
  for(const kind of ['recent','favorites'] as const)button(`[data-clear-${kind}]`,()=>{
    if(!window.confirm(`清空${kind==='favorites'?'收藏的字':'最近查看'}？此操作不会清空其他记录。`))return;
    shelf.state[kind]=[];shelf.save();updateShelf();
  });
  button('[data-close-detail]',()=>closeDetail(true));dialog.addEventListener('cancel',e=>{e.preventDefault();closeDetail(true);},opts);
  button('[data-detail-play]',()=>{if(detail)singlePlay(detail);});button('[data-detail-favorite]',()=>{if(detail){shelf.favorite(detail.char);updateShelf();}});
  button('[data-restart]',()=>{
    if(!detail)return;const c=detail;exitQueue();stopCards();
    if(c.data)renderer(c)?.restart();else{
      text('[data-step-status]','正在重试加载……');void loadData(c.char).then(d=>{if(c.alive&&!destroyed){c.data=d;c.glyph.replaceChildren(makeGlyph(d,d.strokes.length,shelf.state.grid));c.node.querySelector<HTMLButtonElement>('[data-play]')!.disabled=false;populateDetail(c);}}).catch(()=>{if(detail===c)text('[data-step-status]','加载失败，请重试。');});
    }
  });
  for(const [selector,action] of [['[data-all]','all'],['[data-prev]','prev'],['[data-next]','next']])button(selector,()=>{
    if(!detail)return;exitQueue();stopCards();const r=renderer(detail);if(!r)return;
    if(action==='all')r.showAll();else r.go(r.complete?(action==='prev'?detail.data!.strokes.length-1:0):r.step+(action==='prev'?-1:1));
  });
  button('[data-group-play]',()=>playGroup());button('[data-group-restart]',()=>playGroup(true));
  el<HTMLSelectElement>('[data-speed]').addEventListener('change',e=>{if(detail?.renderer)detail.renderer.speed=Number((e.target as HTMLSelectElement).value);},opts);
  el<HTMLSelectElement>('[data-group-speed]').addEventListener('change',e=>{if(queue!=='idle'&&cards[cursor]?.renderer)cards[cursor].renderer!.speed=Number((e.target as HTMLSelectElement).value);},opts);
  grid.addEventListener('change',()=>{
    shelf.state.grid=grid.checked;shelf.save();
    for(const c of [...cards,...(preview?[preview]:[])])if(c.renderer)c.renderer.setGrid(grid.checked);else if(c.data)c.glyph.replaceChildren(makeGlyph(c.data,c.data.strokes.length,grid.checked));
    if(detail?.data){el('[data-steps]').querySelectorAll('button').forEach((b,i)=>{b.querySelector('svg')?.remove();b.prepend(makeGlyph(detail!.data!,i,grid.checked));});const p=detail.node.querySelector('[data-placeholder]');p?.replaceChildren(makeGlyph(detail.data,detail.data.strokes.length,grid.checked));}updateShelf();
  },opts);
  root.addEventListener('keydown',e=>{
    const t=e.target as HTMLElement;if(e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||t.matches('input,select,textarea')||t.isContentEditable)return;
    if(e.repeat&&['Enter',' '].includes(e.key)&&t.matches('button,[data-occurrence]')){e.preventDefault();return;}
    if(t.matches('[data-occurrence]')&&['Enter',' '].includes(e.key)){e.preventDefault();openDetail(cards[Number(t.dataset.position)],true);return;}
    const host=t.closest<HTMLElement>('.hsl-char-list,.hsl-steps,[data-results]');if(!host||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const bs=[...host.querySelectorAll<HTMLElement>(host.matches('[data-results]')?'[data-occurrence]':'button')],i=bs.indexOf(t);if(i<0)return;
    const columns=host.matches('[data-results]')?getComputedStyle(host).gridTemplateColumns.split(' ').length:1;
    const delta=e.key==='ArrowUp'?-columns:e.key==='ArrowDown'?columns:e.key==='ArrowLeft'?-1:1;
    const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+delta+bs.length)%bs.length;
    e.preventDefault();bs.forEach((b,j)=>b.tabIndex=j===next?0:-1);bs[next].focus();if(host.matches('[data-results]')){selected=next;selectCard();historyWrite(false);}
  },opts);
  root.addEventListener('focusin',e=>{const t=e.target as HTMLElement,host=t.closest('.hsl-char-list,.hsl-steps');if(host&&t.matches('button'))host.querySelectorAll<HTMLElement>('button').forEach(b=>b.tabIndex=b===t?0:-1);},opts);
  window.addEventListener('popstate',()=>{setHand(false);restore();},opts);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();},opts);window.addEventListener('blur',pauseAll,opts);
  button('[data-hsl-return]',()=>{if(onExit)onExit();});
  updateShelf();
  void fetch(new URL('./hanzi-stroke-lab/index.json',document.baseURI),{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(data=>{if(destroyed)return;index=data;restore();root.dataset.indexReady='true';}).catch(()=>{if(!destroyed)text('#hsl-query-note','本地字库没有加载成功，请刷新页面重试。');});
  const destroy=()=>{if(destroyed)return;destroyed=true;queueRevision++;revision++;closeDetail(false,false);for(const c of cards){c.alive=false;c.renderer?.destroy();}abort.abort();hand.destroy();cache.clear();};
  window.addEventListener('pagehide',e=>{destroy();if(e.persisted)window.addEventListener('pageshow',()=>mountHanziStrokeLab(root,onExit),{once:true});},opts);
  return{destroy};
}

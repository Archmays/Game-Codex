import './style.css';
import {parseQuery,Shelf,type CharacterIndex,type StrokeData} from './model';
import {makeGlyph,StrokeView} from './stroke-view';
import {Handwriting,type Match} from './handwriting';
import type {MountedGame} from '../../packages/game-core';

export function mountHanziStrokeLab(root:HTMLElement,onExit?:()=>void):MountedGame {
  const abort=new AbortController(),opts={signal:abort.signal};
  let index:CharacterIndex={},destroyed=false,loadRevision=0,active='',chars:string[]=[],selected=0,composing=false,compositionUntil=0;
  let currentData:StrokeData|null=null,view:'query'|'hand'|'stroke'='query';
  const cache=new Map<string,StrokeData>(),mobile=matchMedia('(max-width: 699px)');
  const shelf=new Shelf({getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)});
  root.className='hsl-root';
  delete root.dataset.indexReady;
  root.innerHTML=`<main class="hsl" data-testid="hanzi-stroke-lab">
    <header class="hsl-header"><div><p class="hsl-eyebrow">中文 · 查字工具</p><h1>汉字书房</h1></div><a tabindex="0" class="hsl-return" href="?world=my-game-world" data-hsl-return>返回首页 ↗</a></header>
    <nav class="hsl-mobile-nav" aria-label="书房区域"><button data-pane="query">查字</button><button data-pane="hand">手写</button><button data-pane="stroke">看笔顺</button></nav>
    <div class="hsl-layout"><div class="hsl-left">
      <section class="hsl-card" data-section="query" aria-labelledby="hsl-query-title"><h2 id="hsl-query-title">想查哪个字？</h2>
        <form data-search><label class="hsl-label" for="hsl-input">输入或粘贴汉字</label><div class="hsl-search-row"><input id="hsl-input" type="text" autocomplete="off" spellcheck="false" placeholder="例如：永、你好学习" aria-describedby="hsl-query-note"><button class="hsl-primary" type="submit">查询</button></div></form>
        <p id="hsl-query-note" class="hsl-note" role="status">一次最多 48 个字符，重复字也会保留。</p>
        <div class="hsl-char-list" data-results role="group" aria-label="查询结果"></div>
        <p class="hsl-label">从常用字开始</p><div class="hsl-char-list" data-common role="group" aria-label="常用字"></div>
      </section>
      <section class="hsl-card" data-section="hand" aria-labelledby="hsl-hand-title"><div class="hsl-section-heading"><h2 id="hsl-hand-title">不会读？写出来</h2><span class="hsl-local">本机识别</span></div>
        <p class="hsl-note">用手指、鼠标或笔写一个字。</p><svg class="hsl-pad" data-pad viewBox="0 0 256 256" tabindex="0" role="application" aria-label="手写画布，键盘用户先选择键盘画笔" aria-describedby="hsl-pen-help"></svg>
        <div class="hsl-row"><button data-undo>撤销上一笔</button><button data-clear>清空重写</button><button data-pen>键盘画笔</button></div>
        <p class="hsl-note" id="hsl-pen-help">键盘画笔：方向键移动，空格落笔／抬笔，Esc 取消并退出；Tab 可离开。Shift＋方向键大步移动。</p>
        <p class="hsl-note" data-hand-status role="status">打开手写区后载入本地模型。</p><div class="hsl-char-list hsl-candidates" data-candidates role="group" aria-label="手写候选"></div>
        <details><summary>没有找到想要的字？</summary><p>候选是近似匹配，可撤销、清空再写。模型不覆盖所有汉字。</p><button data-retry-hand>重新载入识别</button></details>
      </section>
      <section class="hsl-card hsl-shelf" data-section="query" aria-label="本地字架"><div class="hsl-section-heading"><h2>最近查看</h2><button data-clear-recent>清空最近</button></div><div class="hsl-char-list" data-recent role="group" aria-label="最近查看"></div><div class="hsl-section-heading"><h2>收藏的字</h2><button data-clear-favorites>清空收藏</button></div><div class="hsl-char-list" data-favorites role="group" aria-label="收藏的字"></div><p class="hsl-note" data-storage-status role="status"></p></section>
    </div><section class="hsl-card hsl-reading" data-section="stroke" aria-labelledby="hsl-character-title">
      <div class="hsl-section-heading"><div><p class="hsl-eyebrow">一笔一画，慢慢看</p><h2 id="hsl-character-title" tabindex="-1">选一个字</h2></div><button data-favorite disabled aria-pressed="false">☆ 收藏</button></div>
      <p class="hsl-pinyin" data-pinyin></p><p class="hsl-note" data-meta></p><p class="hsl-note" data-reading-note></p>
      <div class="hsl-glyph" data-glyph aria-label="当前字笔顺图"></div><p class="hsl-step-status" data-step-status role="status">输入汉字，或从左侧手写找字。</p>
      <div class="hsl-controls" data-animation-controls><button class="hsl-primary" data-play disabled>▶ 播放</button><button data-restart disabled>重新开始</button><button data-all disabled>完整字形</button><button data-prev disabled>上一笔</button><button data-next disabled>下一笔</button><label>速度<select data-speed aria-label="播放速度"><option value="0.5">0.5 倍</option><option value="1" selected>1 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label></div>
      <label class="hsl-grid-toggle"><input type="checkbox" data-grid> 显示田字格</label><p class="hsl-legend">实心：已写 · 强调实心：当前笔 · 虚线轮廓：待写</p>
      <h3>逐笔查看</h3><p class="hsl-note">选一步，定位到这一笔。方向键可在步骤间移动。</p><div class="hsl-steps" data-steps role="group" aria-label="逐笔步骤"></div>
    </section></div>
    <footer class="hsl-footer"><details><summary>字库、读音与本地隐私</summary><p>本地收录 9,574 个字形条目（含少量部件），均有笔顺；手写模型覆盖 9,507 个候选。未覆盖全部 Unicode 汉字。查询保留原字，不自动转换简繁。</p><p>字音优先采用 Unicode 17.0 的《通用规范汉字字典》2013 数据，其次《现代汉语词典》1983 数据，最后采用 Unihan 普通话读音。展示字库收录读音，不做词句语境判断，也不保证穷尽所有读音。</p><p>笔顺来自 Hanzi Writer Data / Make Me a Hanzi，面向中国大陆笔顺；保留上游字形，繁体及地区字形可能有差异。本工具不声明逐字通过国家规范认证。</p><p>笔顺字形 © Arphic Technology，按 Arphic Public License 分发，无担保。识别引擎 hanzi_lookup 按 LGPL-3.0 分发，可替换其独立文件。查询、轨迹和候选不上传；仅最近、收藏、田字格保存在本机，不保存书写轨迹。</p><p><a tabindex="0" href="./hanzi-stroke-lab/SOURCES.md" target="_blank" rel="noopener">来源与版本</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/ARPHICPL.TXT" target="_blank" rel="noopener">笔顺许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/LGPL-3.0.txt" target="_blank" rel="noopener">识别许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/UNICODE-LICENSE.txt" target="_blank" rel="noopener">字音许可</a></p></details></footer>
  </main>`;
  const el=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const text=(selector:string,value:string)=>{el(selector).textContent=value;};
  const button=(s:string,fn:()=>void)=>el(s).addEventListener('click',fn,opts);
  const input=el<HTMLInputElement>('#hsl-input'),grid=el<HTMLInputElement>('[data-grid]');grid.checked=shelf.state.grid;
  const renderer=new StrokeView(el('[data-glyph]'),updateAnimation);
  renderer.grid=shelf.state.grid;
  const hand=new Handwriting(root.querySelector('[data-pad]')!,t=>text('[data-hand-status]',t),renderCandidates,()=>{});
  function group(selector:string,values:string[],choose:(char:string,i:number)=>void,labels?:(char:string,i:number)=>string):void {
    const host=el(selector),hadFocus=host.contains(document.activeElement),old=host.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.dataset.position;
    host.replaceChildren();
    values.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=c;b.dataset.position=String(i);b.tabIndex=i===Math.min(Number(old)||0,values.length-1)?0:-1;b.setAttribute('aria-label',labels?.(c,i)??c);b.addEventListener('click',()=>choose(c,i),opts);host.append(b);});
    if(hadFocus)host.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
  function renderCandidates(matches:Match[]):void {group('[data-candidates]',matches.map(m=>m.hanzi),c=>{hand.suspend();input.value=c;search(c,true,true);},(c,i)=>`候选 ${i+1}：${c}`);}
  function updateShelf():void {
    group('[data-recent]',shelf.state.recent,c=>{input.value=c;search(c,true,true);});
    group('[data-favorites]',shelf.state.favorites,c=>{input.value=c;search(c,true,true);});
    el<HTMLButtonElement>('[data-clear-recent]').disabled=!shelf.state.recent.length;
    el<HTMLButtonElement>('[data-clear-favorites]').disabled=!shelf.state.favorites.length;
    text('[data-storage-status]',shelf.notice||'只保存在这个浏览器中。');
    const fav=el<HTMLButtonElement>('[data-favorite]');fav.disabled=!active;fav.setAttribute('aria-pressed',String(shelf.state.favorites.includes(active)));fav.textContent=shelf.state.favorites.includes(active)?'★ 已收藏':'☆ 收藏';
  }
  function updateAnimation():void {
    const n=currentData?.strokes.length??0;
    for(const s of ['[data-play]','[data-restart]','[data-all]','[data-prev]','[data-next]'])el<HTMLButtonElement>(s).disabled=!n;
    el<HTMLButtonElement>('[data-prev]').disabled=!n||(!renderer.complete&&renderer.step===0);
    el<HTMLButtonElement>('[data-next]').disabled=!n||(!renderer.complete&&renderer.step===n-1);
    text('[data-play]',renderer.playing?'Ⅱ 暂停':renderer.complete?'▶ 播放':'▶ 继续播放');
    if(n)text('[data-step-status]',renderer.complete?`完整字形 · 共 ${n} 笔`:`第 ${renderer.step+1} / ${n} 笔${renderer.playing?' · 正在书写':' · 当前笔已突出显示'}`);
    for(const b of el('[data-steps]').querySelectorAll<HTMLElement>('button'))b.setAttribute('aria-pressed',String(!renderer.complete&&Number(b.dataset.position)===renderer.step));
  }
  function panes(focus=false):void {
    for(const section of root.querySelectorAll<HTMLElement>('[data-section]'))section.hidden=mobile.matches&&section.dataset.section!==view;
    for(const b of root.querySelectorAll<HTMLElement>('[data-pane]'))b.setAttribute('aria-current',String(b.dataset.pane===view));
    if(view==='hand'||!mobile.matches)hand.start();
    if(focus&&view==='stroke')el('#hsl-character-title').focus({preventScroll:true});
  }
  function writeHistory(push:boolean):void {const u=new URL(location.href);u.searchParams.set('play','hanzi-stroke-lab');u.searchParams.set('q',chars.join(''));u.searchParams.set('i',String(selected));history[push?'pushState':'replaceState']({hsl:true},'',u.pathname+u.search);}
  async function choose(c:string,i:number,focus=false):Promise<void> {
    const rev=++loadRevision;currentData=null;renderer.setData(null);active=c;selected=i;hand.suspend();
    text('#hsl-character-title',c);text('[data-pinyin]','');text('[data-meta]',`U+${c.codePointAt(0)!.toString(16).toUpperCase()}`);text('[data-reading-note]','');el('[data-steps]').replaceChildren();
    for(const b of el('[data-results]').querySelectorAll<HTMLElement>('button')){b.setAttribute('aria-pressed',String(Number(b.dataset.position)===i));b.tabIndex=Number(b.dataset.position)===i?0:-1;}
    const row=index[c];updateShelf();
    if(!row){text('[data-step-status]','本地字库暂未收录这个字。原字已保留，可查其他字。');text('[data-meta]',`U+${c.codePointAt(0)!.toString(16).toUpperCase()} · 未收录`);}
    else{
      text('[data-pinyin]',row[0]||'未收录独立读音');
      text('[data-meta]',`${row[1]?`${row[1]} 笔`:'暂无笔顺'} · ${row[3]?`繁体／异体记录（对应简体：${row[3]}）`:row[4]?`简体／对应繁体：${row[4]}`:'保留输入字形'} · U+${c.codePointAt(0)!.toString(16).toUpperCase()}`);
      text('[data-reading-note]',row[0]?`${row[2]==='kTGHZ2013'?'通用规范汉字字典 2013':row[2]==='kXHC1983'?'现代汉语词典 1983':'Unihan 普通话'}收录读音；${row[0].includes('/')?'多个读音，需结合词句判断。':'未做语境判断，读音表可能不完整。'}`:'这是字库中的部件字形，未提供可核实的独立读音。');
      shelf.visit(c);updateShelf();text('[data-step-status]',row[1]?'正在加载这个字的笔顺……':'这个候选字暂无笔顺数据。');
      if(row[1])try{
        let data=cache.get(c);
        if(!data){const response=await fetch(new URL(`./hanzi-stroke-lab/chars/${c.codePointAt(0)!.toString(16)}.json`,document.baseURI),{signal:abort.signal});if(!response.ok)throw new Error('load');data=await response.json() as StrokeData;if(!data.strokes?.length||data.strokes.length!==data.medians?.length)throw new Error('invalid');cache.set(c,data);if(cache.size>96)cache.delete(cache.keys().next().value!);}
        if(destroyed||rev!==loadRevision)return;
        currentData=data;renderer.setData(data);
        group('[data-steps]',data.strokes.map((_,j)=>String(j+1)),(_,j)=>renderer.go(j),(_,j)=>`第 ${j+1} 笔`);
        el('[data-steps]').querySelectorAll('button').forEach((b,j)=>{b.prepend(makeGlyph(data!,j,shelf.state.grid));});updateAnimation();
      }catch{if(!destroyed&&rev===loadRevision){text('[data-step-status]','笔顺未能载入。请再次选择这个字重试。');}}
    }
    if(focus){view='stroke';panes(true);}else panes();
  }
  function search(value:string,push=true,focus=false):void {
    const result=parseQuery(value);text('#hsl-query-note',result.message);
    if(!result.valid)return;
    if(!Object.keys(index).length){text('#hsl-query-note','字库尚未载入，请稍后再试。');return;}
    chars=result.chars;selected=0;group('[data-results]',chars,(c,i)=>{void choose(c,i,true);writeHistory(false);},(c,i)=>`${i+1}：${c}${index[c]?'':'，未收录'}`);
    void choose(chars[0],0,focus);if(push)writeHistory(true);
  }
  function restore():void {const q=new URLSearchParams(location.search);input.value=q.get('q')||'';if(input.value){search(input.value,false);const i=Number(q.get('i')||0);if(Number.isInteger(i)&&i>0&&i<chars.length)void choose(chars[i],i);}else{loadRevision++;chars=[];active='';currentData=null;renderer.setData(null);el('[data-results]').replaceChildren();el('[data-steps]').replaceChildren();text('#hsl-character-title','选一个字');text('[data-pinyin]','');text('[data-meta]','');text('[data-reading-note]','');text('[data-step-status]','输入汉字，或手写找字。');updateShelf();}}
  el('[data-search]').addEventListener('submit',e=>{e.preventDefault();if(composing||performance.now()<compositionUntil)return;search(input.value,true,true);},opts);
  input.addEventListener('compositionstart',()=>{composing=true;},opts);input.addEventListener('compositionend',()=>{composing=false;compositionUntil=performance.now()+80;},opts);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229||composing))e.preventDefault();},opts);
  group('[data-common]',[...'永你好学习行水火心'],c=>{input.value=c;search(c,true,true);});
  button('[data-undo]',()=>hand.undo());button('[data-clear]',()=>hand.clear());button('[data-pen]',()=>hand.enterKeyboard());button('[data-retry-hand]',()=>hand.retry());
  button('[data-favorite]',()=>{if(active){shelf.favorite(active);updateShelf();}});
  button('[data-clear-recent]',()=>{shelf.state.recent=[];shelf.save();updateShelf();});button('[data-clear-favorites]',()=>{shelf.state.favorites=[];shelf.save();updateShelf();});
  button('[data-play]',()=>renderer.toggle());button('[data-restart]',()=>renderer.restart());button('[data-all]',()=>renderer.showAll());button('[data-prev]',()=>renderer.go(renderer.complete?(currentData?.strokes.length??1)-1:renderer.step-1));button('[data-next]',()=>renderer.go(renderer.complete?0:renderer.step+1));
  el<HTMLSelectElement>('[data-speed]').addEventListener('change',e=>{renderer.speed=Number((e.target as HTMLSelectElement).value);},opts);
  grid.addEventListener('change',()=>{shelf.state.grid=grid.checked;shelf.save();renderer.setGrid(grid.checked);el('[data-steps]').querySelectorAll('button').forEach((b,j)=>{b.querySelector('svg')?.remove();if(currentData)b.prepend(makeGlyph(currentData,j,grid.checked));});updateShelf();},opts);
  root.addEventListener('keydown',e=>{
    const t=e.target as HTMLElement;
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey||t.matches('input,select,textarea'))return;
    if(e.repeat&&['Enter',' '].includes(e.key)&&t.matches('button')){e.preventDefault();return;}
    const host=t.closest<HTMLElement>('.hsl-char-list,.hsl-steps');
    if(!host||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const bs=[...host.querySelectorAll<HTMLButtonElement>('button')];const i=bs.indexOf(t as HTMLButtonElement);if(i<0)return;
    e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+bs.length)%bs.length;bs.forEach((b,j)=>b.tabIndex=j===next?0:-1);bs[next].focus();
  },opts);
  root.addEventListener('focusin',e=>{
    const target=e.target as HTMLElement,region=target.closest('.hsl-char-list,.hsl-steps');
    if(region&&target.matches('button'))region.querySelectorAll<HTMLElement>('button').forEach(b=>b.tabIndex=b===target?0:-1);
  },opts);
  root.querySelectorAll<HTMLElement>('[data-pane]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.pane as typeof view;hand.suspend();renderer.stop();updateAnimation();panes();},opts));
  mobile.addEventListener('change',()=>{hand.cancel();panes();},opts);
  window.addEventListener('popstate',()=>{hand.suspend();restore();},opts);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){renderer.stop();updateAnimation();}},opts);
  window.addEventListener('blur',()=>{renderer.stop();updateAnimation();},opts);
  button('[data-hsl-return]',()=>{if(onExit)onExit();});
  updateShelf();panes();
  void fetch(new URL('./hanzi-stroke-lab/index.json',document.baseURI),{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('index');return r.json();}).then(data=>{if(destroyed)return;index=data;root.dataset.indexReady='true';restore();}).catch(()=>{if(!destroyed){text('#hsl-query-note','本地字库没有加载成功，请刷新页面重试。');}});
  const destroy=()=>{if(destroyed)return;destroyed=true;loadRevision++;abort.abort();hand.destroy();renderer.destroy();cache.clear();};
  window.addEventListener('pagehide',e=>{destroy();if(e.persisted)window.addEventListener('pageshow',()=>mountHanziStrokeLab(root,onExit),{once:true});},opts);
  return{destroy};
}

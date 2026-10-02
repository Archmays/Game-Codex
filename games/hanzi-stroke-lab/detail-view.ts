import { makeGlyph } from './stroke-view';
import type { StudyContext , Card } from './study-context';
export function createDetailView(ctx: StudyContext) {
function openDetail(card:Card,push=false):void {
    if(ctx.detail===card&&ctx.dialog.open)return;
    if(ctx.detail)ctx.closeDetail(false,false);
    if(card.position>=0)ctx.selected=card.position;ctx.selectCard();ctx.detailScroll=scrollY;ctx.detail=card;
    // Transfer the live SVG, never copy its masks or reset its progress. The card stays readable.
    const placeholder=document.createElement('div');placeholder.className='hsl-glyph';placeholder.dataset.placeholder='';
    if(card.data)placeholder.append(makeGlyph(card.data,card.data.strokes.length,ctx.shelf.state.grid));else placeholder.textContent=card.char;
    card.glyph.before(placeholder);ctx.el('[data-detail-glyph]').append(card.glyph);
    ctx.text('#hsl-character-title',`${card.char} · ${card.position>=0?`第 ${card.position+1} 个字`:'手写查询'}`);ctx.text('[data-detail-pinyin]',ctx.index[card.char]?.[0]||'读音未收录');
    ctx.text('[data-detail-note]',card.node.querySelector('[data-card-note]')!.textContent||'');
    const row=ctx.index[card.char];ctx.text('[data-meta]',`U+${card.char.codePointAt(0)!.toString(16).toUpperCase()} · ${row?.[3]?`对应简体：${row[3]}`:row?.[4]?`对应繁体：${row[4]}`:'保留输入字形'}`);
    ctx.text('[data-reading-note]',row?.[0]?`${row[2]==='kTGHZ2013'?'通用规范汉字字典 2013':row[2]==='kXHC1983'?'现代汉语词典 1983':'Unihan 普通话'}收录读音；未做语境判断，读音表可能不完整。`:'暂无可核实的独立读音。');
    ctx.el('[data-detail-hand]').hidden=card!==ctx.preview;ctx.populateDetail(card);ctx.updateShelf();ctx.shelf.visit(card.char);ctx.updateShelf();
    ctx.dialog.showModal();ctx.dialog.scrollTop=0;ctx.el('[data-close-detail]').focus();if(push)ctx.historyWrite(true);
  }
function populateDetail(card:Card):void {
    if(ctx.detail!==card)return;
    const r=ctx.renderer(card);ctx.el<HTMLSelectElement>('[data-speed]').value=String(r?.speed||1);
    ctx.group('[data-steps]',card.data?.strokes.map((_,i)=>String(i+1))||[],(_,i)=>{ctx.exitQueue();ctx.stopCards();ctx.renderer(card)?.go(i);},(_,i)=>`第 ${i+1} 笔`);
    if(card.data)ctx.el('[data-steps]').querySelectorAll('button').forEach((b,i)=>b.prepend(makeGlyph(card.data!,i,ctx.shelf.state.grid)));
    ctx.updateDetail();
  }
function updateDetail():void {
    if(!ctx.detail)return;const r=ctx.detail.renderer,n=ctx.detail.data?.strokes.length||0;
    for(const s of ['[data-detail-play]','[data-all]','[data-prev]','[data-next]'])ctx.el<HTMLButtonElement>(s).disabled=!n;
    ctx.el<HTMLButtonElement>('[data-restart]').disabled=!ctx.index[ctx.detail.char]?.[1];ctx.text('[data-restart]',n?'重播这个字':'重试加载字形');
    ctx.el<HTMLButtonElement>('[data-prev]').disabled=!n||(!r?.complete&&r?.step===0);ctx.el<HTMLButtonElement>('[data-next]').disabled=!n||(!r?.complete&&r?.step===n-1);
    ctx.text('[data-detail-play]',r?.playing?'Ⅱ 暂停':r?.complete?'▶ 播放':'▶ 继续播放');
    ctx.text('[data-step-status]',!n?ctx.detail.node.querySelector('[data-card-status]')!.textContent||'暂无笔顺':r?.complete?`完整字形 · 共 ${n} 笔`:`第 ${r!.step+1} / ${n} 笔 · ${r!.playing?'正在书写':'已暂停，可继续或逐笔查看'}`);
    for(const b of ctx.el('[data-steps]').querySelectorAll<HTMLElement>('button'))b.setAttribute('aria-pressed',String(!r?.complete&&Number(b.dataset.position)===r?.step));
  }
function closeDetail(push=false,focus=true):void {
    const card=ctx.detail;if(!card)return;ctx.detail=null;ctx.dialog.close();card.node.querySelector('[data-placeholder]')?.remove();card.node.querySelector('[data-card-glyph]')!.append(card.glyph);ctx.el('[data-steps]').replaceChildren();
    if(card===ctx.preview){card.alive=false;card.renderer?.destroy();ctx.preview=null;if(focus)ctx.el('[data-pane=hand]').focus({preventScroll:true});}
    else if(focus&&card.alive)card.node.focus({preventScroll:true});
    if(focus)window.scrollTo(0,ctx.detailScroll);if(push)ctx.historyWrite(true);
  }
return {openDetail,populateDetail,updateDetail,closeDetail};
}
export function bindDetailView(ctx: StudyContext):void {
  ctx.button('[data-close-detail]',()=>ctx.closeDetail(true));ctx.dialog.addEventListener('cancel',e=>{e.preventDefault();ctx.closeDetail(true);},ctx.opts);
  ctx.button('[data-detail-play]',()=>{if(ctx.detail)ctx.singlePlay(ctx.detail);});ctx.button('[data-detail-favorite]',()=>{if(ctx.detail){ctx.shelf.favorite(ctx.detail.char);ctx.updateShelf();}});
  ctx.button('[data-restart]',()=>{
    if(!ctx.detail)return;const c=ctx.detail;ctx.exitQueue();ctx.stopCards();
    if(c.data)ctx.renderer(c)?.restart();else{
      ctx.text('[data-step-status]','正在重试加载……');void ctx.loadData(c.char).then(d=>{if(c.alive&&!ctx.destroyed){c.data=d;c.glyph.replaceChildren(makeGlyph(d,d.strokes.length,ctx.shelf.state.grid));c.node.querySelector<HTMLButtonElement>('[data-play]')!.disabled=false;ctx.populateDetail(c);}}).catch(()=>{if(ctx.detail===c)ctx.text('[data-step-status]','加载失败，请重试。');});
    }
  });
  for(const [selector,action] of [['[data-all]','all'],['[data-prev]','prev'],['[data-next]','next']])ctx.button(selector,()=>{
    if(!ctx.detail)return;ctx.exitQueue();ctx.stopCards();const r=ctx.renderer(ctx.detail);if(!r)return;
    if(action==='all')r.showAll();else r.go(r.complete?(action==='prev'?ctx.detail.data!.strokes.length-1:0):r.step+(action==='prev'?-1:1));
  });
  ctx.grid.addEventListener('change',()=>{
    ctx.shelf.state.grid=ctx.grid.checked;ctx.shelf.save();
    for(const c of [...ctx.cards,...(ctx.preview?[ctx.preview]:[])])if(c.renderer)c.renderer.setGrid(ctx.grid.checked);else if(c.data)c.glyph.replaceChildren(makeGlyph(c.data,c.data.strokes.length,ctx.grid.checked));
    if(ctx.detail?.data){ctx.el('[data-steps]').querySelectorAll('button').forEach((b,i)=>{b.querySelector('svg')?.remove();b.prepend(makeGlyph(ctx.detail!.data!,i,ctx.grid.checked));});const p=ctx.detail.node.querySelector('[data-placeholder]');p?.replaceChildren(makeGlyph(ctx.detail.data,ctx.detail.data.strokes.length,ctx.grid.checked));}ctx.updateShelf();
  },ctx.opts);
}

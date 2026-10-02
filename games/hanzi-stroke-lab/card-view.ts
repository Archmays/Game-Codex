import { type StrokeData } from './model';
import { makeGlyph, StrokeView } from './stroke-view';
import type { StudyContext , Card } from './study-context';
export function createCardView(ctx: StudyContext) {
function loadData(char:string):Promise<StrokeData> {
    const existing=ctx.cache.get(char);if(existing)return existing;
    const promise=fetch(new URL(`./hanzi-stroke-lab/chars/${char.codePointAt(0)!.toString(16)}.json`,document.baseURI),{signal:ctx.abort.signal}).then(async r=>{
      if(!r.ok)throw Error('load');const d=await r.json() as StrokeData;
      if(!d.strokes?.length||d.strokes.length!==d.medians?.length)throw Error('invalid');return d;
    }).catch(error=>{ctx.cache.delete(char);throw error;});
    ctx.cache.set(char,promise);if(ctx.cache.size>96)ctx.cache.delete(ctx.cache.keys().next().value!);return promise;
  }
function makeCard(char:string,position:number):Card {
    const node=document.createElement('article'),id=`hsl-${ctx.revision}-${position}`;node.className='hsl-card hsl-result';node.dataset.occurrence=id;node.dataset.position=String(position);node.tabIndex=position===ctx.selected?0:-1;
    node.innerHTML='<div class="hsl-card-heading"><h2 data-character></h2><span data-order></span></div><p class="hsl-pinyin" data-pinyin></p><p class="hsl-note" data-count></p><div data-card-glyph><div class="hsl-glyph" data-glyph></div></div><p class="hsl-card-note" data-card-note></p><p class="hsl-card-status" data-card-status></p><div class="hsl-card-actions"><button class="hsl-primary" data-play disabled>▶ 播放</button><button data-favorite>☆ 收藏</button><button data-open-detail>逐笔详情</button></div>';
    const row=ctx.index[char],put=(s:string,v:string)=>{node.querySelector(s)!.textContent=v;};
    put('[data-character]',char);put('[data-order]',`${position+1}`);put('[data-pinyin]',row?.[0]||'读音未收录');put('[data-count]',row?`${row[1]} 笔`:'笔数未收录');
    put('[data-card-note]',!row?'本地缺数据，原字保留。':row[0].includes('/')?'多音字 · 请结合词句判断。':!row[0]?'部件字形，无可核实的独立读音。':'');
    node.setAttribute('aria-label',`第 ${position+1} 个字：${char}，${row?.[0]||'读音未收录'}。Enter 查看详情`);
    const glyph=node.querySelector<HTMLElement>('[data-glyph]')!;glyph.textContent=char;glyph.setAttribute('aria-label',`${char}的字形`);
    const card:Card={id,char,position,alive:true,node,glyph,data:null,loading:Promise.resolve(),renderer:null};
    // A repeated region has one tab stop. Enter opens all actions; arrows select occurrences.
    node.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.tabIndex=-1);
    node.querySelector('[data-play]')!.addEventListener('click',()=>ctx.singlePlay(card));
    node.querySelector('[data-favorite]')!.addEventListener('click',()=>{ctx.shelf.favorite(char);ctx.updateShelf();});
    node.querySelector('[data-open-detail]')!.addEventListener('click',()=>ctx.openDetail(card,true));
    if(row?.[1]){
      const rev=ctx.revision;put('[data-card-status]','载入字形中……');
      card.loading=ctx.loadData(char).then(data=>{
        if(ctx.destroyed||!card.alive||rev!==ctx.revision)return;card.data=data;glyph.replaceChildren(makeGlyph(data,data.strokes.length,ctx.shelf.state.grid));
        put('[data-card-status]','完整字形');node.querySelector<HTMLButtonElement>('[data-play]')!.disabled=false;
        if(ctx.detail===card)ctx.populateDetail(card);
      }).catch(()=>{if(card.alive&&!ctx.destroyed){put('[data-card-status]','字形加载失败，详情中可重试。');if(ctx.detail===card)ctx.updateDetail();}});
    }else put('[data-card-status]','暂无笔顺');
    return card;
  }
function renderer(card:Card):StrokeView|null {
    if(!card.data)return null;
    if(!card.renderer){card.renderer=new StrokeView(card.glyph,()=>ctx.updateCard(card),()=>{
      if(ctx.queue==='running'&&ctx.cards[ctx.cursor]===card){ctx.cursor++;void ctx.advance(ctx.queueRevision);}
    });card.renderer.grid=ctx.shelf.state.grid;card.renderer.setData(card.data);}
    return card.renderer;
  }
function updateCard(card:Card):void {
    const r=card.renderer;if(!r)return;
    const label=r.playing?'Ⅱ 暂停':r.complete?'▶ 播放':'▶ 继续';card.node.querySelector('[data-play]')!.textContent=label;
    card.node.dataset.playing=String(r.playing);card.node.dataset.step=String(r.step);card.node.dataset.complete=String(r.complete);
    card.node.querySelector('[data-card-status]')!.textContent=r.complete?'完整字形':`第 ${r.step+1} / ${card.data!.strokes.length} 笔 · ${r.playing?'书写中':'已暂停'}`;
    if(ctx.detail===card)ctx.updateDetail();
  }
function selectCard():void {for(const c of ctx.cards){c.node.tabIndex=c.position===ctx.selected?0:-1;c.node.dataset.selected=String(c.position===ctx.selected);}}
return {loadData,makeCard,renderer,updateCard,selectCard};
}

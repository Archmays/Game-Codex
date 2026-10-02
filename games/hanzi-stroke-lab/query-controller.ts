import { parseQuery } from './model';
import type { StudyContext , Card } from './study-context';
export function createQueryController(ctx: StudyContext) {
function historyWrite(push:boolean):void {
    const u=new URL(location.href);u.searchParams.set('play','hanzi-stroke-lab');
    if(ctx.query)u.searchParams.set('q',ctx.query);else u.searchParams.delete('q');u.searchParams.set('i',String(ctx.selected));
    if(ctx.detail)u.searchParams.set('detail','1');else u.searchParams.delete('detail');
    if(ctx.detail===ctx.preview&&ctx.preview)u.searchParams.set('hand',ctx.preview.char);else u.searchParams.delete('hand');
    history[push?'pushState':'replaceState']({...history.state,hsl:true,hslScroll:ctx.detail?ctx.detailScroll:scrollY},'',u.pathname+u.search+u.hash);
  }
function buildQuery(value:string):void {
    ctx.pauseAll();ctx.exitQueue();ctx.closeDetail(false,false);ctx.revision++;
    for(const c of ctx.cards){c.alive=false;c.renderer?.destroy();}ctx.cards=[];ctx.el('[data-results]').replaceChildren();ctx.query=value;ctx.input.value=value;
    const result=parseQuery(value);ctx.text('#hsl-query-note',result.message);
    if(result.valid&&!Object.keys(ctx.index).length){ctx.text('#hsl-query-note','字库尚未载入，请稍后再试。');ctx.el('[data-group-controls]').hidden=true;return;}
    ctx.cards=result.chars.map(ctx.makeCard);ctx.el('[data-results]').append(...ctx.cards.map(c=>c.node));ctx.el('[data-group-controls]').hidden=!ctx.cards.length;ctx.selectCard();ctx.updateShelf();
  }
function search(value:string):void {ctx.selected=0;ctx.setHand(false);ctx.buildQuery(value);ctx.historyWrite(true);ctx.cards[0]?.node.focus({preventScroll:true});}
function restore():void {
    const q=new URLSearchParams(location.search),value=q.get('q')||'',pos=Number(q.get('i')||0);
    ctx.selected=Number.isInteger(pos)&&pos>=0&&pos<parseQuery(value).chars.length?pos:0;
    if(value!==ctx.query||!ctx.cards.length)ctx.buildQuery(value);else{ctx.pauseAll();ctx.closeDetail(false,false);ctx.selectCard();ctx.input.value=value;}
    // Old q/i links show the entire group; explicit detail=1 restores the open panel.
    const h=q.get('hand');
    if(q.get('detail')==='1'&&h&&[...h].length===1&&parseQuery(h).valid){ctx.preview=ctx.makeCard(h,-1);ctx.openDetail(ctx.preview);}
    else if(q.get('detail')==='1'&&ctx.cards[ctx.selected])ctx.openDetail(ctx.cards[ctx.selected]);
    else if(ctx.cards[ctx.selected]){ctx.cards[ctx.selected].node.focus({preventScroll:true});if(typeof history.state?.hslScroll==='number')window.scrollTo(0,history.state.hslScroll);}
  }
return {historyWrite,buildQuery,search,restore};
}

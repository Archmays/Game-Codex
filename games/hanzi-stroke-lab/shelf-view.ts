import { parseQuery } from './model';
import { type Match } from './handwriting';
import type { StudyContext , Card } from './study-context';
export function createShelfView(ctx: StudyContext) {
function group(selector:string,values:string[],choose:(char:string,i:number)=>void,labels?:(char:string,i:number)=>string):void {
    const host=ctx.el(selector),hadFocus=host.contains(document.activeElement),old=host.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.dataset.position;
    host.replaceChildren();values.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=c;b.dataset.position=String(i);b.tabIndex=i===Math.min(Number(old)||0,values.length-1)?0:-1;b.setAttribute('aria-label',labels?.(c,i)??c);b.addEventListener('click',()=>choose(c,i));host.append(b);});
    if(hadFocus)host.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
function renderCandidates(matches:Match[]):void {
    if(!matches.length){ctx.handChoice='';ctx.el('[data-hand-choice]').hidden=true;}
    ctx.group('[data-candidates]',matches.map(m=>m.hanzi),c=>{ctx.handChoice=c;ctx.text('[data-choice-label]',`已选「${c}」`);ctx.el('[data-hand-choice]').hidden=false;ctx.el('[data-hand-query]').focus();},(c,i)=>`候选 ${i+1}：${c}`);
  }
function setHand(open:boolean,focus=false):void {
    ctx.el('#hsl-hand').hidden=!open;ctx.el('[data-pane=hand]').setAttribute('aria-expanded',String(open));
    if(open){ctx.pauseAll();ctx.hand.start();if(focus)ctx.el('#hsl-hand').scrollIntoView({block:'start'});}else ctx.hand.suspend();
  }
function updateShelf():void {
    ctx.group('[data-recent]',ctx.shelf.state.recent,c=>ctx.search(c));ctx.group('[data-favorites]',ctx.shelf.state.favorites,c=>ctx.search(c));
    ctx.el<HTMLButtonElement>('[data-clear-recent]').disabled=!ctx.shelf.state.recent.length;ctx.el<HTMLButtonElement>('[data-clear-favorites]').disabled=!ctx.shelf.state.favorites.length;
    ctx.text('[data-storage-status]',ctx.shelf.notice);
    for(const card of ctx.cards){const b=card.node.querySelector<HTMLButtonElement>('[data-favorite]')!,fav=ctx.shelf.state.favorites.includes(card.char);b.setAttribute('aria-pressed',String(fav));b.textContent=fav?'★ 已藏':'☆ 收藏';}
    if(ctx.detail){const b=ctx.el('[data-detail-favorite]'),fav=ctx.shelf.state.favorites.includes(ctx.detail.char);b.setAttribute('aria-pressed',String(fav));b.textContent=fav?'★ 已收藏':'☆ 收藏';}
  }
return {group,renderCandidates,setHand,updateShelf};
}
export function bindShelfView(ctx: StudyContext):void {
  ctx.group('[data-common]',[...'永你好学习行水火心'],c=>ctx.search(c));
  ctx.button('[data-pane=hand]',()=>ctx.setHand(ctx.el('#hsl-hand').hidden,true));ctx.button('[data-pane=query]',()=>{ctx.setHand(false);ctx.input.focus();});
  ctx.button('[data-shelf-toggle]',()=>{const s=ctx.el('#hsl-shelf');s.hidden=!s.hidden;ctx.el('[data-shelf-toggle]').setAttribute('aria-expanded',String(!s.hidden));});
  ctx.button('[data-undo]',()=>ctx.hand.undo());ctx.button('[data-clear]',()=>ctx.hand.clear());ctx.button('[data-pen]',()=>ctx.hand.enterKeyboard());ctx.button('[data-retry-hand]',()=>ctx.hand.retry());ctx.button('[data-recognize]',()=>ctx.hand.recognize());
  // A candidate is only a choice. Checking it does not rewrite the query; adding is explicit.
  ctx.button('[data-hand-query]',()=>{
    if(!ctx.handChoice)return;
    ctx.setHand(false);ctx.preview=ctx.makeCard(ctx.handChoice,-1);ctx.openDetail(ctx.preview,true);
  });
  ctx.button('[data-hand-add]',()=>{if(ctx.handChoice){const value=ctx.cards.map(c=>c.char).join('')+ctx.handChoice;const result=parseQuery(value);if(result.valid)ctx.search(value);else ctx.text('#hsl-query-note',result.message);}});
  const nextHand=()=>{ctx.closeDetail(true);ctx.hand.clear();ctx.setHand(true,true);ctx.el('[data-pad]').focus();};
  ctx.button('[data-hand-next]',nextHand);ctx.button('[data-continue-hand]',nextHand);ctx.button('[data-back-group]',()=>ctx.closeDetail(true));
  for(const kind of ['recent','favorites'] as const)ctx.button(`[data-clear-${kind}]`,()=>{
    if(!window.confirm(`清空${kind==='favorites'?'收藏的字':'最近查看'}？此操作不会清空其他记录。`))return;
    ctx.shelf.state[kind]=[];ctx.shelf.save();ctx.updateShelf();
  });
}

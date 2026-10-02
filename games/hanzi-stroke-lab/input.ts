
import type {StudyContext} from './study-context';
export function bindStudyInput(ctx:StudyContext):void {
  ctx.el('[data-search]').addEventListener('submit',e=>{e.preventDefault();if(!ctx.composing&&performance.now()>=ctx.compositionUntil)ctx.search(ctx.input.value);},ctx.opts);
  ctx.input.addEventListener('compositionstart',()=>{ctx.composing=true;},ctx.opts);ctx.input.addEventListener('compositionend',()=>{ctx.composing=false;ctx.compositionUntil=performance.now()+80;},ctx.opts);
  ctx.input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229||ctx.composing))e.preventDefault();},ctx.opts);
  ctx.root.addEventListener('keydown',e=>{
    const t=e.target as HTMLElement;if(e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||t.matches('input,select,textarea')||t.isContentEditable)return;
    if(e.repeat&&['Enter',' '].includes(e.key)&&t.matches('button,[data-occurrence]')){e.preventDefault();return;}
    if(t.matches('[data-occurrence]')&&['Enter',' '].includes(e.key)){e.preventDefault();ctx.openDetail(ctx.cards[Number(t.dataset.position)],true);return;}
    const host=t.closest<HTMLElement>('.hsl-char-list,.hsl-steps,[data-results]');if(!host||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const bs=[...host.querySelectorAll<HTMLElement>(host.matches('[data-results]')?'[data-occurrence]':'button')],i=bs.indexOf(t);if(i<0)return;
    const columns=host.matches('[data-results]')?getComputedStyle(host).gridTemplateColumns.split(' ').length:1;
    const delta=e.key==='ArrowUp'?-columns:e.key==='ArrowDown'?columns:e.key==='ArrowLeft'?-1:1;
    const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+delta+bs.length)%bs.length;
    e.preventDefault();bs.forEach((b,j)=>b.tabIndex=j===next?0:-1);bs[next].focus();if(host.matches('[data-results]')){ctx.selected=next;ctx.selectCard();ctx.historyWrite(false);}
  },ctx.opts);
  ctx.root.addEventListener('focusin',e=>{const t=e.target as HTMLElement,host=t.closest('.hsl-char-list,.hsl-steps');if(host&&t.matches('button'))host.querySelectorAll<HTMLElement>('button').forEach(b=>b.tabIndex=b===t?0:-1);},ctx.opts);
  window.addEventListener('popstate',()=>{ctx.setHand(false);ctx.restore();},ctx.opts);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.pauseAll();},ctx.opts);window.addEventListener('blur',ctx.pauseAll,ctx.opts);
  ctx.button('[data-hsl-return]',()=>{if(ctx.onExit)ctx.onExit();});
}

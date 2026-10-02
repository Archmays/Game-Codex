
import type { StudyContext , Card } from './study-context';
export function createPlayback(ctx: StudyContext) {
function stopCards(except?:Card):void {for(const c of [...ctx.cards,...(ctx.preview?[ctx.preview]:[])])if(c!==except&&c.renderer){c.renderer.stop();ctx.updateCard(c);}}
function exitQueue():void {ctx.queueRevision++;ctx.queue='idle';ctx.updateQueue();}
function pauseAll():void {ctx.stopCards();if(ctx.queue==='running'){ctx.queue='paused';ctx.queueRevision++;ctx.updateQueue();}}
function singlePlay(card:Card):void {
    const r=ctx.renderer(card);if(!r)return;ctx.exitQueue();ctx.stopCards(card);if(card.position>=0)ctx.selected=card.position;ctx.selectCard();ctx.historyWrite(false);r.toggle();
    ctx.text('[data-group-status]',`单字播放：「${card.char}」。组队列已退出。`);
  }
function updateQueue():void {
    ctx.text('[data-group-play]',ctx.queue==='running'?'Ⅱ 暂停这组':ctx.queue==='paused'?'▶ 继续这组':'依次播放这组字');
    const skip=ctx.skipped.length?` 已跳过缺数据字：${ctx.skipped.join('、')}。`:'';
    ctx.text('[data-group-status]',(ctx.queue==='idle'?'':`${ctx.queue==='paused'?'已暂停':'依次播放'} · 第 ${Math.min(ctx.cursor+1,ctx.cards.length)} / ${ctx.cards.length} 个字。`)+skip);
  }
async function advance(token:number):Promise<void> {
    while(ctx.queue==='running'&&token===ctx.queueRevision&&ctx.cursor<ctx.cards.length){
      const card=ctx.cards[ctx.cursor];ctx.updateQueue();await card.loading;
      if(ctx.destroyed||token!==ctx.queueRevision||ctx.queue!=='running'||!card.alive)return;
      const r=ctx.renderer(card);
      if(!r){ctx.skipped.push(`第 ${ctx.cursor+1} 个「${card.char}」`);ctx.cursor++;continue;}
      ctx.stopCards(card);r.speed=Number(ctx.el<HTMLSelectElement>('[data-group-speed]').value);r.play();return;
    }
    if(token===ctx.queueRevision&&ctx.queue==='running'){ctx.queue='idle';ctx.updateQueue();ctx.text('[data-group-status]',`这组已播放完。${ctx.skipped.length?`已跳过缺数据字：${ctx.skipped.join('、')}。`:''}`);}
  }
function playGroup(restart=false):void {
    if(ctx.queue==='running'&&!restart){ctx.pauseAll();return;}
    ctx.stopCards();
    if(ctx.queue==='idle'||restart){ctx.cursor=0;ctx.skipped=[];for(const c of ctx.cards)c.renderer?.showAll();}
    ctx.queue='running';void ctx.advance(++ctx.queueRevision);
  }
return {stopCards,exitQueue,pauseAll,singlePlay,updateQueue,advance,playGroup};
}
export function bindPlayback(ctx: StudyContext):void {
  ctx.button('[data-group-play]',()=>ctx.playGroup());ctx.button('[data-group-restart]',()=>ctx.playGroup(true));
  ctx.el<HTMLSelectElement>('[data-speed]').addEventListener('change',e=>{if(ctx.detail?.renderer)ctx.detail.renderer.speed=Number((e.target as HTMLSelectElement).value);},ctx.opts);
  ctx.el<HTMLSelectElement>('[data-group-speed]').addEventListener('change',e=>{if(ctx.queue!=='idle'&&ctx.cards[ctx.cursor]?.renderer)ctx.cards[ctx.cursor].renderer!.speed=Number((e.target as HTMLSelectElement).value);},ctx.opts);
}

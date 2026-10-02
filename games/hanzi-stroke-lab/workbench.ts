import { Handwriting } from './handwriting';
import type { MountedGame } from '../../packages/game-core';

import './style.css';
import {createStudyContext} from './study-context';
import {mountStudyPage} from './page-view';
import {createShelfView,bindShelfView} from './shelf-view';
import {createCardView} from './card-view';
import {createPlayback,bindPlayback} from './playback';
import {createDetailView,bindDetailView} from './detail-view';
import {createQueryController} from './query-controller';
import {bindStudyInput} from './input';
export function mountHanziStrokeLab(root:HTMLElement,onExit?:()=>void):MountedGame {
const ctx=createStudyContext(root,onExit);mountStudyPage(ctx);
Object.assign(ctx,createShelfView(ctx),createCardView(ctx),createPlayback(ctx),createDetailView(ctx),createQueryController(ctx));
  const hand=new Handwriting(ctx.root.querySelector('[data-pad]')!,t=>ctx.text('[data-hand-status]',t),ctx.renderCandidates,()=>{ctx.handChoice='';ctx.el('[data-hand-choice]').hidden=true;});
Object.assign(ctx,{hand});
bindStudyInput(ctx);bindShelfView(ctx);bindPlayback(ctx);bindDetailView(ctx);
  ctx.updateShelf();
  void fetch(new URL('./hanzi-stroke-lab/index.json',document.baseURI),{signal:ctx.abort.signal}).then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(data=>{if(ctx.destroyed)return;ctx.index=data;ctx.restore();ctx.root.dataset.indexReady='true';}).catch(()=>{if(!ctx.destroyed)ctx.text('#hsl-query-note','本地字库没有加载成功，请刷新页面重试。');});
  const destroy=()=>{if(ctx.destroyed)return;ctx.destroyed=true;ctx.queueRevision++;ctx.revision++;ctx.closeDetail(false,false);for(const c of ctx.cards){c.alive=false;c.renderer?.destroy();}ctx.abort.abort();ctx.hand.destroy();ctx.cache.clear();};
  window.addEventListener('pagehide',e=>{destroy();if(e.persisted)window.addEventListener('pageshow',()=>mountHanziStrokeLab(ctx.root,ctx.onExit),{once:true});},ctx.opts);
  return{destroy};
}

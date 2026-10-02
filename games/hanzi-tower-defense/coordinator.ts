import { bindPresentationControls } from '../../packages/presentation/controls';
import '../../packages/presentation/styles.css';
import './styles.css';
import './v1.css';
import { mapFor } from "./maps";
import type { MountedGame } from "../../packages/game-core";
import { MAP } from "./model";
import { SCENARIOS, rulesFor } from './tactics';
import type { DefenseContext } from './context';
import { createDefenseContext } from './context';
import { mountDefenseTemplate } from './ui/template';
import { createWorkbench } from './ui/workbench';
import { createHud } from './ui/hud';
import { createChallenges, bindChallenges } from './ui/challenges';
import { createDefenseActions, bindDefenseActions } from './actions';
import { bindDefenseInput } from './ui/input';
import { mountDefenseScene } from './scene-runtime';
export function mountDefense(root: HTMLElement, onExit: () => void): MountedGame {
const ctx=createDefenseContext(root,onExit);
mountDefenseTemplate(ctx);
  function later(action: () => void, delay: number): void { const id = window.setTimeout(() => { ctx.timers.delete(id); if (!ctx.destroyed) action(); }, delay); ctx.timers.add(id); }
  function message(text: string): void { ctx.feedback.textContent = text; }
  function savePresentation():void { ctx.el('[data-presentation-status]').textContent=ctx.presentation.write()?'':'设置仅在本页生效，原有设置已保护。重新打开页面后可再试。'; }
  function persist(): void { ctx.visual.lastContent=ctx.state.scenarioId??ctx.state.mapId??'qinglan-pass';ctx.savePresentation(); const ok = ctx.activeSave().write(ctx.state, ctx.preferences); ctx.el("[data-td-save-note]").textContent = ok ? "按波次自动保存 · 只保存在本机" : "存档暂不可写，本页仍可玩；原有记录未改动。"; }
function refreshMap():void {
    ctx.battleSpeed = 1;
    const url=new URL(window.location.href);url.searchParams.set('map',ctx.state.mapId??'qinglan-pass');
    if(ctx.state.scenarioId)url.searchParams.set('scenario',ctx.state.scenarioId);else url.searchParams.delete('scenario');
    window.history.replaceState(window.history.state,'',url);
    ctx.SLOTS=mapFor(ctx.state.mapId).slots;ctx.WAVES=rulesFor(ctx.state).waves;
    ctx.inventorySignature="";ctx.statusSignature="";ctx.englishSignature="";ctx.rangeSignature="";ctx.challengeSignature='';
    ctx.resultPresented=false;ctx.bossAnnouncement="";ctx.clearSelection();runtime.scene.reset();runtime.fitTowerArt();
    for(const [i,slot] of ctx.SLOTS.entries()){const node=ctx.button(`[data-slot="${i}"]`);node.style.left=`${slot.x/MAP.width*100}%`;node.style.top=`${slot.y/MAP.height*100}%`;}
    for(const node of ctx.root.querySelectorAll<HTMLElement>('[data-recipe]'))node.hidden=!ctx.currentRecipes().some(r=>r.id===node.dataset.recipe);
    ctx.el('[data-td-map-title]').textContent=`${rulesFor(ctx.state).title} · ${rulesFor(ctx.state).description}`;
    ctx.renderTacticsBrief();
    delete ctx.gameRoot.dataset.echoes;delete ctx.gameRoot.dataset.rootBursts;ctx.updateStatus();ctx.slotKeys.refresh();
  }
Object.assign(ctx,{later,message,savePresentation,persist,refreshMap},createWorkbench(ctx),createHud(ctx),createChallenges(ctx),createDefenseActions(ctx));
const unbindInput=bindDefenseInput(ctx);
const runtime=mountDefenseScene(ctx);
bindChallenges(ctx);
bindDefenseActions(ctx);
  ctx.button('[data-td-settings]').onclick=()=>{if(ctx.state.phase==='battle')ctx.state.paused=true;ctx.updateStatus();ctx.settingsDialog.showModal();};
  ctx.button('[data-td-settings-close]').onclick=()=>ctx.settingsDialog.close();
  ctx.button('[data-td-guide-close]').onclick=()=>{ctx.visual.guideSeen=true;ctx.savePresentation();ctx.el('[data-td-guide]').hidden=true;ctx.focusWaveControl();};
  const unbindPresentation=bindPresentationControls(ctx.root,ctx.visual,()=>{ctx.savePresentation();ctx.updateStatus();ctx.audio.unlock();ctx.music.unlock();},()=>{ctx.el('[data-td-guide]').hidden=false;ctx.settingsDialog.close();ctx.button('[data-td-guide-close]').focus();},()=>ctx.music.retry());
  const unlockMusic=(event:Event)=>{if(event.isTrusted){ctx.music.configure(ctx.visual.music,ctx.preferences.muted||ctx.state.paused);ctx.music.unlock();}};ctx.root.addEventListener('pointerup',unlockMusic);ctx.root.addEventListener('keydown',unlockMusic);
  const entryParams=new URLSearchParams(location.search);
  if(!entryParams.has('map')&&!entryParams.has('scenario')&&ctx.activeSave().hasCheckpoint){const resume=ctx.button('[data-td-resume]');resume.hidden=false;resume.textContent=`继续上次 · ${rulesFor(ctx.state).title} · 已守 ${ctx.state.wave} / ${ctx.WAVES.length} 波`;resume.onclick=()=>{resume.hidden=true;ctx.focusWaveControl();};}
  const cancelRestart=()=>{const restore=ctx.returnToManagement;ctx.returnToManagement=false;ctx.restartDialog.close();if(restore){ctx.settingsDialog.showModal();ctx.button('[data-td-restart]').focus();}};
  ctx.restartDialog.addEventListener('cancel',event=>{event.preventDefault();cancelRestart();});
  ctx.button("[data-td-cancel-restart]").addEventListener("click", cancelRestart);
  ctx.button("[data-td-confirm-restart]").addEventListener("click", ()=>ctx.restart(ctx.resetDiscoveries));
  ctx.button("[data-td-replay]").addEventListener("click", ()=>{ctx.pendingMap=ctx.state.mapId??"qinglan-pass";ctx.pendingScenario=ctx.state.scenarioId;if(ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].challengeRule){ctx.restart(false);}else if(ctx.state.scenarioId){ctx.resetDiscoveries=false;ctx.el('#td-restart-title').textContent='从第一波重开这个短局？';ctx.el('[data-td-reset-copy]').textContent=`${rulesFor(ctx.state).title} 将恢复固定起始材料，保留发现的配方。其他短局和战役保留。`;ctx.restartDialog.showModal();}else ctx.restart(false);});
  for (const selector of ["[data-td-home]", "[data-td-result-home]"]) ctx.button(selector).addEventListener("click", () => { ctx.persist(); ctx.audio.suspend(); ctx.music.suspend(); ctx.onExit(); });
  for(const node of ctx.root.querySelectorAll<HTMLElement>("[data-recipe]"))node.hidden=!ctx.currentRecipes().some(r=>r.id===node.dataset.recipe);
  ctx.renderTacticsBrief();ctx.renderInventory(); ctx.renderComposer(); ctx.updateStatus();
  ctx.el("[data-td-save-note]").textContent = ctx.activeSave().writable ? "按波次自动保存 · 只保存在本机" : "存档暂不可写，本页仍可玩；原有记录未改动。";
return { destroy() { if(ctx.destroyed)return;ctx.destroyed=true;unbindInput();ctx.persist();ctx.timers.forEach(id=>window.clearTimeout(id));unbindPresentation();ctx.root.removeEventListener('pointerup',unlockMusic);ctx.root.removeEventListener('keydown',unlockMusic);ctx.music.destroy();ctx.audio.destroy();runtime.destroy();ctx.root.replaceChildren();} };
}

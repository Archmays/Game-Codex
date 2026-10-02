import { mapFor } from "./maps";
import Phaser from "phaser";
import { MAP, startWave, type Core } from "./model";
import { SCENARIOS } from './tactics';
import { DefenseScene } from "./scene";
import type { DefenseContext } from './context';
export function mountDefenseScene(ctx: DefenseContext) {
  const scene = new DefenseScene({ state: () => ctx.state, preferences: () => ({...ctx.preferences, lowPerformance:ctx.visual.lowPerformance}), assetsFailed: failed => {ctx.sceneAssetsFailed=failed;const retry=ctx.root.querySelector<HTMLElement>('[data-td-art-retry]');if(retry)retry.hidden=!(ctx.sceneAssetsFailed||ctx.failedImages.size);}, speed: () => ctx.battleSpeed, events: ctx.handleEvents, tick: ctx.updateStatus, ready: () => {
    ctx.el("[data-td-canvas]").dataset.ready = "true";
    if (!ctx.state.scenarioId && !ctx.activeSave().hasCheckpoint && !mapFor(ctx.state.mapId).expanded) { startWave(ctx.state); ctx.persist(); } else ctx.message(ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].packGoals&&!ctx.state.challenge?.confirmed?'先看地图和敌人预告，再选一个行囊目标。':ctx.state.scenarioId&&SCENARIOS[ctx.state.scenarioId].materialPacks&&!ctx.state.challenge?.confirmed?'先看地图和敌人预告，再选一包材料。':ctx.state.scenarioId&&!ctx.tacticsSave.load(ctx.state.scenarioId)?"固定材料已在栏里。先选材料，再点空塔位，也可以先合成。":`已回到第 ${Math.min(ctx.state.wave + 1, ctx.WAVES.length)} 波的检查点。先布阵，再继续。`);
    ctx.updateStatus();
  } });
  // The canvas only renders. All controls are semantic DOM buttons; let the page own wheel and touch scrolling.
  for(const img of ctx.root.querySelectorAll<HTMLImageElement>('.td-tower-art,.td-gate img')){
    img.onerror=()=>{ctx.failedImages.add(img);img.hidden=true;img.closest('.td-slot')?.classList.remove('td-slot--illustrated');ctx.el('[data-td-art-retry]').hidden=false;};
    img.onload=()=>{ctx.failedImages.delete(img);img.hidden=false;if(img.matches('.td-tower-art'))img.closest('.td-slot')?.classList.add('td-slot--illustrated');else img.parentElement!.dataset.loaded='true';ctx.el('[data-td-art-retry]').hidden=!(ctx.sceneAssetsFailed||ctx.failedImages.size);};
  }
  ctx.button('[data-td-art-retry]').onclick=()=>{scene.retryAssets();for(const img of ctx.failedImages){const src=img.getAttribute('src');if(src){img.removeAttribute('src');img.src=src;}}};
  // Pure 2D art needs no WebGL framebuffer; Canvas also avoids unsupported GPU boot paths.
  const game = new Phaser.Game({ type: Phaser.CANVAS, parent: ctx.el("[data-td-canvas]"), width: Math.max(1, ctx.board.clientWidth), height: Math.max(1, ctx.board.clientHeight), transparent: false, backgroundColor: "#477d56", scale: { mode: Phaser.Scale.NONE }, scene: [scene], input: { mouse: false, touch: false, keyboard: false, gamepad: false }, audio: { noAudio: true }, render: { antialias: true, pixelArt: false }, fps: { target: 60, forceSetTimeOut: false }, banner: false });
  function fitTowerArt():void {
    for(const [i,slot] of ctx.SLOTS.entries()){
      const node=ctx.button(`[data-slot="${i}"]`),art=node.querySelector<HTMLElement>('.td-tower-art')!;
      const bottom=parseFloat(getComputedStyle(art).bottom)||4;
      const available=slot.y/MAP.height*ctx.board.clientHeight+node.offsetHeight/2-bottom-3;
      node.style.setProperty('--td-art-limit',`${Math.max(32,available)}px`);
    }
  }
  function resizeCanvas(): void {
    if (ctx.destroyed || !game.isBooted) return;
    const width = ctx.board.clientWidth, height = ctx.board.clientHeight;
    fitTowerArt();
    // Modal/capture layout can briefly report zero. Never allocate a zero-size render surface.
    // CSS layout dimensions also avoid applying browser zoom twice; SVG and DOM share this board.
    if (width > 0 && height > 0 && (game.scale.width !== width || game.scale.height !== height)) game.scale.resize(width, height);
  }
  const resizeObserver = new ResizeObserver(resizeCanvas); resizeObserver.observe(ctx.board);
  game.events.once(Phaser.Core.Events.READY, resizeCanvas);
return { scene, fitTowerArt, destroy() {resizeObserver.disconnect();game.destroy(true);} };
}

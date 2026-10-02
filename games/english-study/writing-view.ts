import {createBoard,paintBoard} from './writing-board';

import type { StudyContext } from './study-context';
export function createWritingView(ctx: StudyContext) {
function refreshZoom(): void {
    if (!ctx.wordLayout) return;
    const show = ctx.wordLayout.width > 390 && window.innerWidth < 700;
    ctx.el('[data-es-zoom-wrap]').toggleAttribute('hidden', !show);
    if (show && ctx.wordBoards.length === 1) {
      const zoom = createBoard(ctx.el('[data-es-word-zoom]'), ctx.wordLayout, true);
      ctx.wordBoards.push(zoom);
      if (ctx.wordPlayer) paintBoard(zoom, ctx.wordPlayer, ctx.ghostVisible);
    } else if (!show && ctx.wordBoards.length > 1) {
      ctx.wordBoards.pop(); ctx.el('[data-es-word-zoom]').replaceChildren();
    }
  }
function syncUi(): void {
    const player = ctx.activePlayer(); if (!player) return;
    ctx.activeBoards().forEach(board => paintBoard(board, player, ctx.ghostVisible));
    const chars = ctx.reviewMode ? ctx.reviewLetter : ctx.selectedWord;
    const current = player.strokes[player.strokeIndex];
    const charIndex = current?.charIndex ?? Math.max(0, chars.length - 1);
    const within = current ? player.strokes.slice(0, player.strokeIndex + 1).filter(stroke => stroke.charIndex === charIndex).length : 0;
    const state = player.status === 'completed' ? `完成：${chars} 保留在四线三格纸上。` :
      `${player.status === 'playing' ? '正在写' : player.status === 'paused' ? '已暂停' : '准备写'}：第 ${charIndex + 1} 个字符 ${chars[charIndex]}，第 ${within || 1} 笔。`;
    if (state !== ctx.announcedState) { ctx.setText(ctx.reviewMode ? '[data-es-review-status]' : '[data-es-word-status]', state); ctx.announcedState = state; }
    const pane = ctx.el<HTMLElement>(ctx.reviewMode ? '[data-es-review-pane]' : '[data-es-word-pane]');
    pane.querySelectorAll<HTMLButtonElement>('[data-es-control]').forEach(button => {
      const action = button.dataset.esControl;
      if (action === 'play') {
        const label = player.status === 'playing' ? 'Ⅱ 暂停' : player.status === 'paused' ? '▶ 继续' : player.status === 'completed' ? '✓ 已完成' : '▶ 播放书写';
        if (button.textContent !== label) button.textContent = label;
        button.disabled = player.status === 'completed';
      }
      if (action === 'previous') button.disabled = player.strokeIndex === 0 && player.fraction === 0;
      if (action === 'next') button.disabled = player.status === 'completed';
      if (action === 'all') button.disabled = player.status === 'completed';
    });
    pane.querySelector<HTMLSelectElement>('[data-es-speed]')!.value = player.speed;
  }
return {refreshZoom,syncUi};
}

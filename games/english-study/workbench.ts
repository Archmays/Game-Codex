import type { MountedGame } from '../../packages/game-core';
import { LETTER_STROKES } from './letter-strokes';
import { parseLookup, WORDS } from './model';
import { type WritingSpeed } from './writing-player';

import './style.css';
import {createStudyContext} from './study-context';
import {mountStudyPage} from './page-view';
import {createShelfView,bindShelfView} from './shelf-view';
import {createWritingView} from './writing-view';
import {createWordDialog,bindWordDialog} from './word-dialog';
import {createSpellingView,bindSpellingView} from './spelling-view';
import {createWritingClock} from './writing-clock';
export function mountEnglishStudy(root:HTMLElement):MountedGame {
const ctx=createStudyContext(root);mountStudyPage(ctx);
let destroyed=false;
Object.assign(ctx,createShelfView(ctx),createWritingView(ctx),createWordDialog(ctx),createSpellingView(ctx));
Object.assign(ctx,createWritingClock(ctx.activePlayer,ctx.syncUi));
bindShelfView(ctx);bindWordDialog(ctx);bindSpellingView(ctx);
  ctx.el<HTMLFormElement>('[data-es-search]').addEventListener('submit', event => {
    event.preventDefault(); const parsed = parseLookup(ctx.input.value); ctx.setText('#es-search-note', parsed.message);
    if (!parsed.valid) return;
    ctx.results = parsed.words; ctx.renderResults(); ctx.el('[data-es-results]').querySelector<HTMLElement>('button')?.focus();
  }, ctx.opts);
  ctx.dialog.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-es-control]'); if (!button) return;
    const player = ctx.activePlayer(); if (!player) return;
    switch (button.dataset.esControl) {
      case 'play':
        if (player.status === 'playing') ctx.pauseWriting();
        else { ctx.stopSpelling(); player.play(); ctx.syncUi(); ctx.startFrame(); }
        break;
      case 'replay': ctx.stopSpelling(); player.replay(); ctx.syncUi(); ctx.startFrame(); break;
      case 'previous': ctx.cancelFrame(); player.previous(); ctx.syncUi(); break;
      case 'next': ctx.cancelFrame(); player.next(); ctx.syncUi(); break;
      case 'all': ctx.cancelFrame(); player.showAll(); ctx.syncUi(); break;
    }
  }, ctx.opts);
  ctx.dialog.addEventListener('change', event => {
    const select = (event.target as Element).closest<HTMLSelectElement>('[data-es-speed]');
    if (select) { ctx.activePlayer()?.setSpeed(select.value as WritingSpeed); ctx.syncUi(); }
  }, ctx.opts);
  const pauseOnLeave = (): void => { if (document.hidden) { ctx.pauseWriting(); ctx.stopSpelling(); } };
  document.addEventListener('visibilitychange', pauseOnLeave, ctx.opts);
  window.addEventListener('blur', () => { ctx.pauseWriting(); ctx.stopSpelling(); }, ctx.opts);
  window.addEventListener('resize', ctx.refreshZoom, ctx.opts);
  ctx.el('[data-testid=english-study]').setAttribute('data-word-count', String(WORDS.length));
  ctx.el('[data-testid=english-study]').setAttribute('data-letter-count', String(Object.keys(LETTER_STROKES).length));
  return { destroy() {
    if(destroyed)return;destroyed=true;
    ctx.cancelFrame(); ctx.stopSpelling(); ctx.wordPlayer?.dispose(); ctx.reviewPlayer?.dispose(); ctx.abort.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (ctx.dialog.open) ctx.dialog.close(); ctx.root.replaceChildren();
  } };
}

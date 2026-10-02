import {createBoard,planFor} from './writing-board';
import { GLYPH_STROKES, layoutWord } from './letter-strokes';
import { displayWord, lookupKey, WORD_BY_KEY } from './model';
import { WritingPlayer } from './writing-player';
import type { StudyContext } from './study-context';
export function createWordDialog(ctx: StudyContext) {
function openWord(word: string, opener: HTMLElement): void {
    ctx.pauseWriting(); ctx.stopSpelling(); ctx.reviewPlayer?.dispose(); ctx.wordPlayer?.dispose();
    ctx.selectedWord = displayWord(word); ctx.wordOpener = opener; ctx.reviewMode = false; ctx.standaloneReview = false; ctx.spellStep = 0; ctx.announcedState = '';
    const key = lookupKey(ctx.selectedWord);
    const entry = WORD_BY_KEY.get(key);
    const shelfHost = opener.closest('[data-es-recent]') ? '[data-es-recent]' : opener.closest('[data-es-favorites]') ? '[data-es-favorites]' : '';
    ctx.setText('#es-dialog-title', ctx.selectedWord);
    const brief = entry?.source === 'curated' ? entry.zh : entry?.zh.split(/[\n,，;；]/)[0].trim();
    ctx.setText('[data-es-zh]', brief ? brief.length > 36 ? `${brief.slice(0, 36)}…` : brief : '这个词还没有收录中文意思。');
    ctx.setText('[data-es-phonetic]', entry?.phonetic ? `来源音标 [${entry.phonetic}]` : '');
    ctx.setText('[data-es-definition]', entry ? entry.source === 'curated' ? `${entry.partOfSpeech} · ${entry.definition} · 已审定儿童词义` : `扩展词库释义 · ECDICT：${entry.zh}` : '未收录词义，仍可看完整写法。');
    ctx.el('[data-es-example]').toggleAttribute('hidden', !entry?.example);
    ctx.setText('[data-es-example-en]', entry?.example ?? ''); ctx.setText('[data-es-example-zh]', entry?.exampleZh ?? '');
    ctx.el<HTMLButtonElement>('[data-es-speak]').disabled = !entry;
    ctx.el<HTMLButtonElement>('[data-es-favorite]').hidden = !entry;
    ctx.setText('[data-es-speech-status]', entry ? '系统语音可朗读此词。' : '未收录词不朗读，也不会保存在书架。');
    ctx.el<HTMLDetailsElement>('.es-more').open = false;
    const layout = layoutWord(ctx.selectedWord); ctx.wordLayout = layout;
    ctx.wordBoards = [createBoard(ctx.el('[data-es-word-board]'), layout)];
    ctx.el('[data-es-word-zoom]').replaceChildren();
    ctx.wordPlayer = new WritingPlayer(planFor(ctx.wordBoards[0]));
    ctx.refreshZoom();
    ctx.renderSpelling();
    ctx.el('[data-es-word-pane]').removeAttribute('hidden'); ctx.el('[data-es-review-pane]').setAttribute('hidden', '');
    if (entry) { ctx.shelf.visit(key); ctx.renderShelf(); if (shelfHost) ctx.wordOpener = [...ctx.el(shelfHost).querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === displayWord(key)) ?? ctx.input; }
    ctx.updateFavorite();
    if (!ctx.dialog.open) ctx.dialog.showModal();
    ctx.syncUi();
    ctx.el<HTMLButtonElement>('[data-es-word-pane] [data-es-control="play"]').focus();
  }
function openReview(char: string, opener: HTMLElement, standalone: boolean): void {
    if (!GLYPH_STROKES[char]) return;
    ctx.pauseWriting(); ctx.stopSpelling(); ctx.reviewPlayer?.dispose();
    ctx.reviewLetter = char; ctx.reviewOpener = opener; ctx.reviewMode = true; ctx.standaloneReview = standalone; ctx.announcedState = '';
    ctx.el('[data-es-word-pane]').setAttribute('hidden', ''); ctx.el('[data-es-review-pane]').removeAttribute('hidden');
    ctx.el<HTMLButtonElement>('[data-es-review-back]').hidden = standalone;
    ctx.renderReview();
    if (!ctx.dialog.open) { ctx.wordOpener = opener; ctx.dialog.showModal(); }
    ctx.syncUi(); ctx.el<HTMLButtonElement>('[data-es-review-pane] [data-es-control="play"]').focus();
  }
function renderReview(): void {
    ctx.setText('[data-es-review-title]', `${ctx.reviewLetter} · ${/[A-Z]/.test(ctx.reviewLetter) ? '大写' : '小写'}写法`);
    const letter = /[A-Za-z]/.test(ctx.reviewLetter);
    ctx.el<HTMLButtonElement>('[data-es-upper]').disabled = !letter;
    ctx.el<HTMLButtonElement>('[data-es-lower]').disabled = !letter;
    ctx.el('[data-es-upper]').setAttribute('aria-pressed', String(letter && ctx.reviewLetter === ctx.reviewLetter.toUpperCase()));
    ctx.el('[data-es-lower]').setAttribute('aria-pressed', String(letter && ctx.reviewLetter === ctx.reviewLetter.toLowerCase()));
    ctx.reviewBoards = [createBoard(ctx.el('[data-es-review-board]'), layoutWord(ctx.reviewLetter))];
    ctx.reviewPlayer = new WritingPlayer(planFor(ctx.reviewBoards[0]));
    ctx.announcedState = ''; ctx.syncUi();
  }
function closeDialog(): void { ctx.dialog.close(); }
function returnFromReview(): void {
    ctx.pauseWriting(); ctx.reviewPlayer?.dispose(); ctx.reviewMode = false; ctx.announcedState = '';
    ctx.el('[data-es-review-pane]').setAttribute('hidden', ''); ctx.el('[data-es-word-pane]').removeAttribute('hidden');
    ctx.syncUi(); ctx.reviewOpener?.focus({ preventScroll: true });
  }
function speak(): void {
    const entry = WORD_BY_KEY.get(lookupKey(ctx.selectedWord)); if (!entry) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { ctx.setText('[data-es-speech-status]', '这台设备暂时没有可用的系统语音。'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ctx.selectedWord);
    utterance.lang = 'en-US'; utterance.rate = 0.85;
    utterance.onerror = () => { if (ctx.dialog.open) ctx.setText('[data-es-speech-status]', '系统语音暂时无法播放。'); };
    ctx.setText('[data-es-speech-status]', '正在使用系统英语语音朗读。'); window.speechSynthesis.speak(utterance);
  }
return {openWord,openReview,renderReview,closeDialog,returnFromReview,speak};
}
export function bindWordDialog(ctx: StudyContext):void {
  ctx.listen('[data-es-word-close]', ctx.closeDialog);
  ctx.dialog.addEventListener('close', () => {
    ctx.pauseWriting(); ctx.stopSpelling(); ctx.wordPlayer?.dispose(); ctx.reviewPlayer?.dispose();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (document.activeElement === document.body || ctx.dialog.contains(document.activeElement))
      ctx.wordOpener?.focus({ preventScroll: true });
  }, ctx.opts);
  ctx.listen('[data-es-review-back]', ctx.returnFromReview);
  ctx.dialog.addEventListener('cancel', event => {
    if (ctx.reviewMode && !ctx.standaloneReview) { event.preventDefault(); ctx.returnFromReview(); }
  }, ctx.opts);
  ctx.listen('[data-es-upper]', () => { if (/[A-Za-z]/.test(ctx.reviewLetter)) { ctx.pauseWriting(); ctx.reviewLetter = ctx.reviewLetter.toUpperCase(); ctx.reviewPlayer?.dispose(); ctx.renderReview(); } });
  ctx.listen('[data-es-lower]', () => { if (/[A-Za-z]/.test(ctx.reviewLetter)) { ctx.pauseWriting(); ctx.reviewLetter = ctx.reviewLetter.toLowerCase(); ctx.reviewPlayer?.dispose(); ctx.renderReview(); } });
  ctx.listen('[data-es-speak]', ctx.speak);
  ctx.listen('[data-es-favorite]', () => { ctx.shelf.favorite(lookupKey(ctx.selectedWord)); ctx.updateFavorite(); ctx.renderShelf(); });
  ctx.el<HTMLInputElement>('[data-es-ghost]').addEventListener('change', event => { ctx.ghostVisible = (event.target as HTMLInputElement).checked; ctx.syncUi(); }, ctx.opts);
}

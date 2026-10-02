import {roving} from './regional-navigation';
import { displayWord, lookupKey, STARTER_WORDS, WORD_BY_KEY } from './model';
import type { StudyContext } from './study-context';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
export function createShelfView(ctx: StudyContext) {

function wordButton(word: string, index: number): HTMLButtonElement {
    const entry = WORD_BY_KEY.get(lookupKey(word));
    const button = document.createElement('button'); button.type = 'button';
    const heading = document.createElement('strong'); heading.lang = 'en'; heading.textContent = displayWord(word);
    const sub = document.createElement('span'); sub.textContent = entry ? entry.zh : '未收录词义 · 仍可看完整写法';
    button.append(heading, sub); button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，${sub.textContent}，查看词卡`);
    button.addEventListener('click', () => ctx.openWord(word, button), ctx.opts);
    return button;
  }
function renderResults(): void {
    roving(ctx.el('[data-es-results]'), ctx.results, wordButton);
    ctx.setText('[data-es-result-count]', `${ctx.results.length} 张词卡`);
  }
function renderShelf(): void {
    const makeChip = (word: string, index: number): HTMLButtonElement => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = displayWord(word);
      button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，查看词卡`);
      button.addEventListener('click', () => ctx.openWord(word, button), ctx.opts); return button;
    };
    roving(ctx.el('[data-es-recent]'), ctx.shelf.state.recent, makeChip);
    roving(ctx.el('[data-es-favorites]'), ctx.shelf.state.favorites, makeChip);
    if (!ctx.shelf.state.recent.length) ctx.setText('[data-es-recent]', '还没有打开词卡。');
    if (!ctx.shelf.state.favorites.length) ctx.setText('[data-es-favorites]', '还没有收藏的词。');
    ctx.setText('[data-es-storage-status]', ctx.shelf.notice);
  }
function updateFavorite(): void {
    const active = ctx.shelf.state.favorites.includes(lookupKey(ctx.selectedWord));
    ctx.setText('[data-es-favorite]', active ? '★ 已收藏' : '☆ 收藏');
    ctx.el('[data-es-favorite]').setAttribute('aria-pressed', String(active));
  }
return {renderResults,renderShelf,updateFavorite};
}
export function bindShelfView(ctx: StudyContext):void {
  roving(ctx.el('[data-es-picks]'), STARTER_WORDS, (word, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = word; button.lang = 'en';
    button.setAttribute('aria-label', `${index + 1}：${word}，查这个词`);
    button.addEventListener('click', () => { ctx.input.value = word; ctx.results = [word]; ctx.renderResults(); ctx.setText('#es-search-note', `找到 ${word}。`); ctx.openWord(word, button); }, ctx.opts);
    return button;
  });
  roving(ctx.el('[data-es-alphabet]'), [...ALPHABET], (letter, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${letter.toUpperCase()} ${letter}`; button.lang = 'en';
    button.setAttribute('aria-label', `字母 ${index + 1}：${letter.toUpperCase()} 和 ${letter}，查看笔顺`);
    button.addEventListener('click', () => ctx.openReview(letter, button, true), ctx.opts); return button;
  });
  ctx.renderResults(); ctx.renderShelf();
}

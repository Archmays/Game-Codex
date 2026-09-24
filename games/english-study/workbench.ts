import './style.css';
import type { MountedGame } from '../../packages/game-core';
import { LETTER_STROKES, strokeStart, strokesFor } from './letter-strokes';
import { displayWord, parseLookup, Shelf, spellingLetters, STARTER_WORDS, WORDS, WORD_BY_KEY } from './model';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const NS = 'http://www.w3.org/2000/svg';

export function mountEnglishStudy(root: HTMLElement): MountedGame {
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  const shelf = new Shelf({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
  let results = STARTER_WORDS;
  let selectedWord = '';
  let selectedLetter = 'a';
  let spellStep = 0;
  let strokeStep = 0;
  let spellTimer = 0;
  let strokeTimer = 0;
  let wordOpener: HTMLElement | null = null;
  let letterOpener: HTMLElement | null = null;

  root.className = 'es-root';
  root.innerHTML = `<main class="es" data-testid="english-study">
    <header class="es-header"><div><p class="es-eyebrow">ENGLISH · WORD & LETTER STUDIO</p><h1>英语书房 <span lang="en">English Study</span></h1><p>找一个词，听一听，再看看字母怎么写。</p></div><a tabindex="0" href="?world=my-game-world" data-es-return>返回首页 ↗</a></header>
    <section class="es-search" aria-labelledby="es-search-title"><h2 id="es-search-title">今天想看哪个词？</h2><form data-es-search><label for="es-input">输入英语单词或中文意思</label><div class="es-search-row"><input id="es-input" type="text" autocomplete="off" spellcheck="false" placeholder="例如：cat dog / 猫" maxlength="120" aria-describedby="es-search-note"><button class="es-primary" type="submit">查一查</button></div></form><p id="es-search-note" role="status">可以一次查几个英语词；重复词会各占一张卡。</p><div class="es-picks"><span>翻开一页：</span><div data-es-picks role="group" aria-label="常见词"></div></div></section>
    <section class="es-results-section" aria-labelledby="es-results-title"><div class="es-section-heading"><div><p class="es-kicker">WORD SHELF</p><h2 id="es-results-title">词卡</h2></div><span data-es-result-count></span></div><div class="es-results" data-es-results role="group" aria-label="词卡；方向键换卡，回车看详情"></div></section>
    <section class="es-alphabet-section" aria-labelledby="es-alphabet-title"><div class="es-section-heading"><div><p class="es-kicker">LETTER STROKES</p><h2 id="es-alphabet-title">字母笔顺</h2></div><p>点一个字母，看大写和小写的写法。</p></div><div class="es-alphabet" data-es-alphabet role="group" aria-label="字母；方向键换字母，回车看笔顺"></div></section>
    <section class="es-shelf" aria-label="我的书架"><div class="es-section-heading"><div><p class="es-kicker">MY SHELF · 本机保存</p><h2>最近与收藏</h2></div></div><div class="es-shelf-columns"><div><h3>最近查看</h3><div data-es-recent class="es-chip-list" role="group" aria-label="最近查看"></div></div><div><h3>收藏的词</h3><div data-es-favorites class="es-chip-list" role="group" aria-label="收藏的词"></div></div></div><p class="es-muted" data-es-storage-status role="status"></p></section>
    <footer class="es-footer"><details><summary>词库、读音与隐私</summary><p>本地收录 ${WORDS.length.toLocaleString('en-US')} 个词条：按 ECDICT 当代语料频次筛选，并保留原项目已审定的 48 个儿童词义。这覆盖大量常用词，但不是穷尽所有英语词或所有释义。扩展词义来自第三方词典，可能含不同语境或成人话题；家长可一起辨析。未收录词不会编造意思或读音。</p><p>单词读音使用浏览器的英语系统语音，音色和可用性取决于设备；本站不下载音频。大写和小写笔顺是统一的印刷体手写示范，其他学校或地区可能采用不同写法。</p><p>查词与笔顺不向本站服务器发送输入。只有已收录词的最近查看和收藏保存在本机；不记录书写轨迹、练习次数或儿童身份。</p><p><a tabindex="0" href="./english-study/SOURCES.md" target="_blank" rel="noopener">数据来源与筛选</a> · <a tabindex="0" href="./english-study/ECDICT-LICENSE.txt" target="_blank" rel="noopener">ECDICT 许可</a></p></details></footer>
    <dialog class="es-dialog es-word-dialog" data-es-word-dialog aria-labelledby="es-word-title"><div class="es-dialog-top"><p class="es-kicker">WORD CARD · 词卡</p><button type="button" data-es-word-close>关闭</button></div><h2 id="es-word-title" lang="en"></h2><p class="es-phonetic" data-es-phonetic></p><p class="es-zh" data-es-zh></p><p class="es-definition" data-es-definition></p><div class="es-example" data-es-example hidden><strong>用在一句话里</strong><p lang="en" data-es-example-en></p><p data-es-example-zh></p></div><div class="es-actions"><button type="button" class="es-primary" data-es-speak>▶ 听单词</button><button type="button" data-es-favorite>☆ 收藏</button></div><p class="es-muted" role="status" data-es-speech-status></p><div class="es-spelling"><div class="es-section-heading"><h3>逐字母看拼写</h3><span data-es-spell-status></span></div><div class="es-letters" data-es-word-letters role="group" aria-label="字母；点选查看笔顺"></div><div class="es-actions"><button type="button" data-es-spell-play>▶ 逐个播放</button><button type="button" data-es-spell-prev>上一个</button><button type="button" data-es-spell-next>下一个</button></div><p class="es-muted">点字母，可查看它的笔顺。</p></div></dialog>
    <dialog class="es-dialog es-letter-dialog" data-es-letter-dialog aria-labelledby="es-letter-title"><div class="es-dialog-top"><p class="es-kicker">LETTER STROKES · 字母笔顺</p><button type="button" data-es-letter-close>关闭</button></div><div class="es-letter-heading"><div><h2 id="es-letter-title" lang="en"></h2><p>印刷体手写示范 · 按数字顺序落笔</p></div><div class="es-case-switch" role="group" aria-label="大小写"><button type="button" data-es-upper>大写</button><button type="button" data-es-lower>小写</button></div></div><svg class="es-stroke-board" data-es-board viewBox="0 0 100 120" role="img" aria-label="字母笔顺图"></svg><p class="es-stroke-status" data-es-stroke-status role="status"></p><div class="es-actions"><button type="button" class="es-primary" data-es-stroke-play>▶ 播放笔顺</button><button type="button" data-es-stroke-prev>上一笔</button><button type="button" data-es-stroke-next>下一笔</button><button type="button" data-es-stroke-all>完整字母</button></div><p class="es-muted">底线、上沿和中线帮助定位；颜色与数字标出当前笔。</p></dialog>
  </main>`;

  const el = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const text = (selector: string, value: string): void => { el(selector).textContent = value; };
  const listen = (selector: string, fn: (event: Event) => void): void => el(selector).addEventListener('click', fn, opts);
  const wordDialog = el<HTMLDialogElement>('[data-es-word-dialog]');
  const letterDialog = el<HTMLDialogElement>('[data-es-letter-dialog]');
  const input = el<HTMLInputElement>('#es-input');

  function stopPlayback(): void {
    window.clearInterval(spellTimer); window.clearInterval(strokeTimer);
    spellTimer = 0; strokeTimer = 0;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    text('[data-es-spell-play]', '▶ 逐个播放');
    text('[data-es-stroke-play]', '▶ 播放笔顺');
  }

  function roving(host: HTMLElement, labels: string[], makeButton: (label: string, index: number) => HTMLButtonElement): void {
    const old = host.querySelector<HTMLButtonElement>('button[tabindex="0"]');
    const oldIndex = old ? Number(old.dataset.position) : 0;
    const hadFocus = host.contains(document.activeElement);
    host.replaceChildren();
    labels.forEach((label, index) => {
      const button = makeButton(label, index);
      button.dataset.position = String(index);
      button.tabIndex = index === Math.min(oldIndex, labels.length - 1) ? 0 : -1;
      host.append(button);
    });
    host.onkeydown = event => {
      if (!(event instanceof KeyboardEvent) || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const current = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-position]');
      if (!current || !host.contains(current)) return;
      event.preventDefault();
      const index = Number(current.dataset.position);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1 :
        (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + labels.length) % labels.length;
      current.tabIndex = -1;
      const target = host.querySelectorAll<HTMLButtonElement>('button')[next];
      target.tabIndex = 0; target.focus();
    };
    if (hadFocus) host.querySelector<HTMLElement>('button[tabindex="0"]')?.focus();
  }

  function wordButton(word: string, index: number): HTMLButtonElement {
    const entry = WORD_BY_KEY.get(word);
    const button = document.createElement('button'); button.type = 'button';
    const heading = document.createElement('strong'); heading.lang = 'en'; heading.textContent = displayWord(word);
    const sub = document.createElement('span'); sub.textContent = entry ? entry.zh : '未收录词义 · 可看字母笔顺';
    button.append(heading, sub);
    button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，${sub.textContent}，查看词卡`);
    button.addEventListener('click', () => openWord(word, button), opts);
    return button;
  }

  function renderResults(): void {
    roving(el('[data-es-results]'), results, wordButton);
    text('[data-es-result-count]', `${results.length} 张词卡`);
  }

  function renderShelf(): void {
    const makeChip = (word: string, index: number): HTMLButtonElement => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = displayWord(word);
      button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，查看词卡`);
      button.addEventListener('click', () => openWord(word, button), opts); return button;
    };
    roving(el('[data-es-recent]'), shelf.state.recent, makeChip);
    roving(el('[data-es-favorites]'), shelf.state.favorites, makeChip);
    if (!shelf.state.recent.length) text('[data-es-recent]', '还没有打开词卡。');
    if (!shelf.state.favorites.length) text('[data-es-favorites]', '还没有收藏的词。');
    text('[data-es-storage-status]', shelf.notice);
  }

  function speak(): void {
    const entry = WORD_BY_KEY.get(selectedWord);
    if (!entry) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { text('[data-es-speech-status]', '这台设备暂时没有可用的系统语音。'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayWord(entry.word));
    utterance.lang = 'en-US'; utterance.rate = 0.85;
    utterance.onerror = () => text('[data-es-speech-status]', '系统语音暂时无法播放。可以继续看拼写和笔顺。');
    text('[data-es-speech-status]', '正在使用系统英语语音朗读。');
    window.speechSynthesis.speak(utterance);
  }

  function renderSpelling(): void {
    const letters = spellingLetters(selectedWord);
    const host = el('[data-es-word-letters]'); host.replaceChildren();
    letters.forEach((letter, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = letter;
      button.className = index === spellStep ? 'es-current-letter' : index < spellStep ? 'es-done-letter' : '';
      button.setAttribute('aria-label', `第 ${index + 1} 个字母 ${letter}，查看笔顺`);
      button.addEventListener('click', () => openLetter(letter, button), opts); host.append(button);
    });
    text('[data-es-spell-status]', letters.length ? `第 ${spellStep + 1} / ${letters.length} 个：${letters[spellStep].toUpperCase()}` : '没有英文字母');
    el<HTMLButtonElement>('[data-es-spell-prev]').disabled = spellStep === 0;
    el<HTMLButtonElement>('[data-es-spell-next]').disabled = spellStep >= letters.length - 1;
  }

  function openWord(word: string, opener: HTMLElement): void {
    stopPlayback(); selectedWord = word; wordOpener = opener; spellStep = 0;
    const shelfSelector = opener.closest('[data-es-recent]') ? '[data-es-recent]' : opener.closest('[data-es-favorites]') ? '[data-es-favorites]' : '';
    const shelfIndex = opener.dataset.position;
    const entry = WORD_BY_KEY.get(word);
    text('#es-word-title', displayWord(word));
    text('[data-es-zh]', entry ? entry.zh : '这个词还没有收录中文意思。');
    text('[data-es-phonetic]', entry?.phonetic ? `来源音标 [${entry.phonetic}]` : '');
    text('[data-es-definition]', entry ? entry.source === 'curated' ? `${entry.partOfSpeech} · ${entry.definition} · 已审定儿童词义` : '扩展词库释义 · ECDICT，具体意思请结合语境' : '你仍然可以逐字母查看写法。');
    el('[data-es-example]').hidden = !entry?.example;
    text('[data-es-example-en]', entry?.example ?? '');
    text('[data-es-example-zh]', entry?.exampleZh ?? '');
    el<HTMLButtonElement>('[data-es-speak]').disabled = !entry;
    el<HTMLButtonElement>('[data-es-favorite]').hidden = !entry;
    text('[data-es-speech-status]', entry ? '点“听单词”可用系统语音朗读。' : '未收录词不朗读，也不会保存在书架。');
    if (entry) {
      shelf.visit(word); renderShelf();
      if (shelfSelector) wordOpener = el(shelfSelector).querySelector<HTMLElement>(`button[data-position="${shelfIndex}"]`) ?? input;
    }
    updateFavorite(); renderSpelling(); wordDialog.showModal();
    el<HTMLButtonElement>('[data-es-word-close]').focus();
  }

  function updateFavorite(): void {
    const active = shelf.state.favorites.includes(selectedWord);
    text('[data-es-favorite]', active ? '★ 已收藏' : '☆ 收藏');
    el('[data-es-favorite]').setAttribute('aria-pressed', String(active));
  }

  function makeSvg(tag: string, attributes: Record<string, string>): SVGElement {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function renderStroke(): void {
    const paths = strokesFor(selectedLetter);
    const board = root.querySelector<SVGSVGElement>('[data-es-board]')!; board.replaceChildren();
    board.setAttribute('aria-label', `${selectedLetter}，共 ${paths.length} 笔；当前第 ${Math.min(strokeStep + 1, paths.length)} 笔`);
    for (const y of [20, 48, 94]) board.append(makeSvg('line', { x1: '10', y1: String(y), x2: '90', y2: String(y), class: 'es-guide-line' }));
    paths.forEach((path, index) => {
      const style = index < strokeStep ? 'es-stroke-done' : index === strokeStep ? 'es-stroke-current' : 'es-stroke-future';
      board.append(makeSvg('path', { d: path, class: style }));
      if (strokeStep < paths.length) {
        const [x, y] = strokeStart(path);
        board.append(makeSvg('circle', { cx: String(x), cy: String(y), r: '7', class: `es-number-dot ${style}` }));
        const label = makeSvg('text', { x: String(x), y: String(y + 2.7), class: 'es-number-label' });
        label.textContent = String(index + 1); board.append(label);
      }
    });
    text('[data-es-stroke-status]', strokeStep >= paths.length ? `${selectedLetter}：完整字母，共 ${paths.length} 笔。` : `${selectedLetter}：第 ${strokeStep + 1} / ${paths.length} 笔，从数字 ${strokeStep + 1} 处落笔。`);
    text('#es-letter-title', `${selectedLetter} · ${selectedLetter === selectedLetter.toUpperCase() ? '大写' : '小写'}`);
    el<HTMLButtonElement>('[data-es-stroke-prev]').disabled = strokeStep === 0;
    el<HTMLButtonElement>('[data-es-stroke-next]').disabled = strokeStep >= paths.length;
    el('[data-es-upper]').setAttribute('aria-pressed', String(selectedLetter === selectedLetter.toUpperCase()));
    el('[data-es-lower]').setAttribute('aria-pressed', String(selectedLetter === selectedLetter.toLowerCase()));
  }

  function openLetter(letter: string, opener: HTMLElement): void {
    window.clearInterval(strokeTimer); strokeTimer = 0;
    selectedLetter = letter; strokeStep = 0; letterOpener = opener;
    renderStroke(); letterDialog.showModal(); el<HTMLButtonElement>('[data-es-letter-close]').focus();
  }

  roving(el('[data-es-picks]'), STARTER_WORDS, (word, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = word; button.lang = 'en';
    button.setAttribute('aria-label', `${index + 1}：${word}，查这个词`);
    button.addEventListener('click', () => { input.value = word; results = [word]; renderResults(); text('#es-search-note', `找到 ${word}。`); openWord(word, button); }, opts);
    return button;
  });
  roving(el('[data-es-alphabet]'), [...ALPHABET], (letter, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${letter.toUpperCase()} ${letter}`; button.lang = 'en';
    button.setAttribute('aria-label', `字母 ${index + 1}：${letter.toUpperCase()} 和 ${letter}，查看笔顺`);
    button.addEventListener('click', () => openLetter(letter, button), opts); return button;
  });
  renderResults(); renderShelf();

  el<HTMLFormElement>('[data-es-search]').addEventListener('submit', event => {
    event.preventDefault();
    const parsed = parseLookup(input.value);
    text('#es-search-note', parsed.message);
    if (!parsed.valid) return;
    results = parsed.words; renderResults();
    el('[data-es-results]').querySelector<HTMLElement>('button')?.focus();
  }, opts);
  listen('[data-es-word-close]', () => wordDialog.close());
  listen('[data-es-letter-close]', () => letterDialog.close());
  wordDialog.addEventListener('close', () => { stopPlayback(); wordOpener?.focus({ preventScroll: true }); }, opts);
  letterDialog.addEventListener('close', () => { window.clearInterval(strokeTimer); strokeTimer = 0; letterOpener?.focus({ preventScroll: true }); }, opts);
  listen('[data-es-speak]', speak);
  listen('[data-es-favorite]', () => { shelf.favorite(selectedWord); updateFavorite(); renderShelf(); });
  listen('[data-es-spell-prev]', () => { window.clearInterval(spellTimer); spellTimer = 0; spellStep = Math.max(0, spellStep - 1); renderSpelling(); });
  listen('[data-es-spell-next]', () => { stopPlayback(); spellStep = Math.min(spellingLetters(selectedWord).length - 1, spellStep + 1); renderSpelling(); });
  listen('[data-es-spell-play]', () => {
    if (spellTimer) { window.clearInterval(spellTimer); spellTimer = 0; text('[data-es-spell-play]', '▶ 逐个播放'); return; }
    spellStep = 0; renderSpelling(); text('[data-es-spell-play]', 'Ⅱ 暂停');
    spellTimer = window.setInterval(() => {
      if (spellStep >= spellingLetters(selectedWord).length - 1) { window.clearInterval(spellTimer); spellTimer = 0; text('[data-es-spell-play]', '▶ 逐个播放'); return; }
      spellStep++; renderSpelling();
    }, 950);
  });
  listen('[data-es-upper]', () => { stopPlayback(); selectedLetter = selectedLetter.toUpperCase(); strokeStep = 0; renderStroke(); });
  listen('[data-es-lower]', () => { stopPlayback(); selectedLetter = selectedLetter.toLowerCase(); strokeStep = 0; renderStroke(); });
  listen('[data-es-stroke-prev]', () => { stopPlayback(); strokeStep = Math.max(0, strokeStep - 1); renderStroke(); });
  listen('[data-es-stroke-next]', () => { stopPlayback(); strokeStep = Math.min(strokesFor(selectedLetter).length, strokeStep + 1); renderStroke(); });
  listen('[data-es-stroke-all]', () => { stopPlayback(); strokeStep = strokesFor(selectedLetter).length; renderStroke(); });
  listen('[data-es-stroke-play]', () => {
    if (strokeTimer) { window.clearInterval(strokeTimer); strokeTimer = 0; text('[data-es-stroke-play]', '▶ 播放笔顺'); return; }
    strokeStep = 0; renderStroke(); text('[data-es-stroke-play]', 'Ⅱ 暂停');
    strokeTimer = window.setInterval(() => {
      if (strokeStep >= strokesFor(selectedLetter).length - 1) { strokeStep = strokesFor(selectedLetter).length; renderStroke(); window.clearInterval(strokeTimer); strokeTimer = 0; text('[data-es-stroke-play]', '▶ 播放笔顺'); return; }
      strokeStep++; renderStroke();
    }, 1050);
  });
  const pause = (): void => { if (document.hidden) stopPlayback(); };
  document.addEventListener('visibilitychange', pause, opts);
  window.addEventListener('blur', stopPlayback, opts);
  // Keep the two data sets explicitly referenced; their completeness is checked in unit tests.
  el('[data-testid=english-study]').dataset.wordCount = String(WORDS.length);
  el('[data-testid=english-study]').dataset.letterCount = String(Object.keys(LETTER_STROKES).length);
  return { destroy() { stopPlayback(); abort.abort(); if (letterDialog.open) letterDialog.close(); if (wordDialog.open) wordDialog.close(); root.replaceChildren(); } };
}

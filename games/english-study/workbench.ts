import './style.css';
import type { MountedGame } from '../../packages/game-core';
import { GLYPH_STROKES, GUIDE_LINES, LETTER_STROKES, layoutWord, type WordLayout } from './letter-strokes';
import { displayWord, lookupKey, parseLookup, Shelf, spellingLetters, STARTER_WORDS, WORDS, WORD_BY_KEY } from './model';
import { WritingPlayer, type PlannedStroke, type WritingSpeed } from './writing-player';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const NS = 'http://www.w3.org/2000/svg';
const controls = `<div class="es-writing-controls" role="group" aria-label="书写控制">
  <button class="es-primary" type="button" data-es-control="play">▶ 播放书写</button>
  <button type="button" data-es-control="replay">↺ 重播</button>
  <button type="button" data-es-control="previous">上一笔</button>
  <button type="button" data-es-control="next">下一笔</button>
  <button type="button" data-es-control="all">完整字形</button>
  <label>速度 <select data-es-speed aria-label="书写速度"><option value="slow">慢速</option><option value="standard" selected>标准</option><option value="fast">较快</option></select></label>
</div>`;

interface StrokeView { path: SVGPathElement; length: number; x: number; charIndex: number; }
interface BoardView { svg: SVGSVGElement; strokes: StrokeView[]; tip: SVGCircleElement; }

export function mountEnglishStudy(root: HTMLElement): MountedGame {
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  const shelf = new Shelf({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
  let results = STARTER_WORDS;
  let selectedWord = '';
  let spellStep = 0;
  let spellTimer = 0;
  let spellingPlaying = false;
  let wordPlayer: WritingPlayer | null = null;
  let reviewPlayer: WritingPlayer | null = null;
  let wordBoards: BoardView[] = [];
  let wordLayout: WordLayout | null = null;
  let reviewBoards: BoardView[] = [];
  let reviewMode = false;
  let standaloneReview = false;
  let reviewLetter = 'a';
  let wordOpener: HTMLElement | null = null;
  let reviewOpener: HTMLElement | null = null;
  let frame = 0;
  let lastFrame: number | null = null;
  let announcedState = '';
  let ghostVisible = true;

  root.className = 'es-root';
  root.innerHTML = `<main class="es" data-testid="english-study">
    <header class="es-header"><div><p class="es-eyebrow">ENGLISH · WORD & LETTER STUDIO</p><h1>英语书房 <span lang="en">English Study</span></h1><p>找一个词，看它在纸上慢慢写出来。</p></div><a tabindex="0" href="?world=my-game-world" data-es-return>返回首页 ↗</a></header>
    <section class="es-search" aria-labelledby="es-search-title"><h2 id="es-search-title">今天想看哪个词？</h2><form data-es-search><label for="es-input">输入英语单词或中文意思</label><div class="es-search-row"><input id="es-input" type="text" autocomplete="off" spellcheck="false" placeholder="例如：cat dog / 猫" maxlength="120" aria-describedby="es-search-note"><button class="es-primary" type="submit">查一查</button></div></form><p id="es-search-note" role="status">可以一次查几个英语词；重复词会各占一张卡。</p><div class="es-picks"><span>翻开一页：</span><div data-es-picks role="group" aria-label="常见词"></div></div></section>
    <section class="es-results-section" aria-labelledby="es-results-title"><div class="es-section-heading"><div><p class="es-kicker">WORD SHELF</p><h2 id="es-results-title">词卡</h2></div><span data-es-result-count></span></div><div class="es-results" data-es-results role="group" aria-label="词卡；方向键换卡，回车看详情"></div></section>
    <section class="es-alphabet-section" aria-labelledby="es-alphabet-title"><div class="es-section-heading"><div><p class="es-kicker">LETTER STROKES</p><h2 id="es-alphabet-title">字母笔顺</h2></div><p>点一个字母，看大写和小写的写法。</p></div><div class="es-alphabet" data-es-alphabet role="group" aria-label="字母；方向键换字母，回车看笔顺"></div></section>
    <section class="es-shelf" aria-label="我的书架"><div class="es-section-heading"><div><p class="es-kicker">MY SHELF · 本机保存</p><h2>最近与收藏</h2></div></div><div class="es-shelf-columns"><div><h3>最近查看</h3><div data-es-recent class="es-chip-list" role="group" aria-label="最近查看"></div></div><div><h3>收藏的词</h3><div data-es-favorites class="es-chip-list" role="group" aria-label="收藏的词"></div></div></div><p class="es-muted" data-es-storage-status role="status"></p></section>
    <footer class="es-footer"><details><summary>词库、读音与隐私</summary><p>本地收录 ${WORDS.length.toLocaleString('en-US')} 个词条，保留已审定的 48 个儿童词义。扩展词义来自第三方词典，可能含不同语境或成人话题；家长可一起辨析。未收录词不编造意思或读音。</p><p>书写路径是本项目绘制的基础印刷体手写示范，笔顺不是全球唯一标准。系统语音的音色与离线能力取决于设备。</p><p>查词与书写不向服务器发送输入。仅已收录词的最近查看和收藏保存在本机；不记录书写轨迹、练习次数或儿童身份。</p><p><a tabindex="0" href="./english-study/SOURCES.md" target="_blank" rel="noopener">数据来源与筛选</a> · <a tabindex="0" href="./english-study/ECDICT-LICENSE.txt" target="_blank" rel="noopener">ECDICT 许可</a></p></details></footer>
    <dialog class="es-dialog es-word-dialog" data-es-word-dialog aria-labelledby="es-dialog-title"><div class="es-dialog-top"><p class="es-kicker">WORD & LETTER STUDIO · 英语书房</p><button type="button" data-es-word-close>关闭</button></div>
      <div data-es-word-pane><h2 id="es-dialog-title" lang="en"></h2><p class="es-zh" data-es-zh></p>
        <section class="es-writing" aria-label="整词书写"><div class="es-writing-heading"><h3>看书写 <span>整词逐笔</span></h3><label><input type="checkbox" data-es-ghost checked> 显示淡色范字</label></div><div data-es-word-board class="es-board-host"></div><div data-es-zoom-wrap class="es-zoom-wrap" hidden><p>放大看写法（可横向滚动）</p><div data-es-word-zoom class="es-zoom-scroll"></div></div>
        <p class="es-writing-status" data-es-word-status role="status"></p>${controls}</section>
        <div class="es-spelling"><div class="es-section-heading"><h3>看拼写 <span>逐个字母</span></h3><span data-es-spell-status></span></div><div class="es-letters" data-es-word-letters role="group" aria-label="词内字符；点选回看写法"></div><div class="es-secondary-actions"><button type="button" data-es-spell-play>▶ 看拼写</button><button type="button" data-es-spell-prev>上一个</button><button type="button" data-es-spell-next>下一个</button></div></div>
        <div class="es-actions"><button type="button" class="es-primary" data-es-speak>▶ 听单词</button><button type="button" data-es-favorite>☆ 收藏</button></div><p class="es-muted" data-es-speech-status role="status"></p>
        <details class="es-more"><summary>读音、例句与详细释义</summary><p class="es-phonetic" data-es-phonetic></p><p class="es-definition" data-es-definition></p><div class="es-example" data-es-example hidden><strong>用在一句话里</strong><p lang="en" data-es-example-en></p><p data-es-example-zh></p></div></details>
      </div>
      <div data-es-review-pane hidden><div class="es-review-heading"><button type="button" data-es-review-back>← 回到原单词</button><h2 data-es-review-title lang="en"></h2><div class="es-case-switch" role="group" aria-label="大小写"><button type="button" data-es-upper>大写</button><button type="button" data-es-lower>小写</button></div></div><p class="es-muted">同一套字形的单字母回看；笔顺只是这一种基础示范。</p><div data-es-review-board class="es-board-host"></div><p class="es-writing-status" data-es-review-status role="status"></p>${controls}</div>
    </dialog>
  </main>`;

  const el = <T extends Element = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const setText = (selector: string, value: string): void => { el(selector).textContent = value; };
  const listen = (selector: string, fn: (event: Event) => void): void => el(selector).addEventListener('click', fn, opts);
  const dialog = el<HTMLDialogElement>('[data-es-word-dialog]');
  const input = el<HTMLInputElement>('#es-input');
  const activePlayer = (): WritingPlayer | null => reviewMode ? reviewPlayer : wordPlayer;
  const activeBoards = (): BoardView[] => reviewMode ? reviewBoards : wordBoards;

  function roving(host: HTMLElement, labels: string[], makeButton: (label: string, index: number) => HTMLButtonElement): void {
    const old = host.querySelector<HTMLButtonElement>('button[tabindex="0"]');
    const oldIndex = old ? Number(old.dataset.position) : 0;
    const focusIndex = host.contains(document.activeElement) ? Number((document.activeElement as HTMLElement).dataset.position ?? oldIndex) : -1;
    host.replaceChildren();
    labels.forEach((label, index) => {
      const button = makeButton(label, index); button.dataset.position = String(index);
      button.tabIndex = index === Math.min(oldIndex, labels.length - 1) ? 0 : -1;
      host.append(button);
    });
    host.onkeydown = event => {
      if (!(event instanceof KeyboardEvent) || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const current = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-position]');
      if (!current || !host.contains(current)) return;
      event.preventDefault();
      const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[data-position]')];
      const index = Number(current.dataset.position);
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
      else {
        const boxes = buttons.map(button => button.getBoundingClientRect());
        const y = boxes[index].top;
        const rows = [...new Set(boxes.map(box => Math.round(box.top)))].sort((a, b) => a - b);
        const row = rows.findIndex(top => Math.abs(top - y) < 3);
        const targetY = rows[Math.max(0, Math.min(rows.length - 1, row + (event.key === 'ArrowDown' ? 1 : -1)))];
        const center = (boxes[index].left + boxes[index].right) / 2;
        const candidates = boxes.map((box, position) => ({ box, position })).filter(item => Math.abs(item.box.top - targetY) < 3);
        next = candidates.sort((a, b) => Math.abs((a.box.left + a.box.right) / 2 - center) - Math.abs((b.box.left + b.box.right) / 2 - center))[0]?.position ?? index;
      }
      current.tabIndex = -1; buttons[next].tabIndex = 0; buttons[next].focus();
    };
    if (focusIndex >= 0) host.querySelector<HTMLButtonElement>(`button[data-position="${focusIndex}"]`)?.focus();
  }

  function wordButton(word: string, index: number): HTMLButtonElement {
    const entry = WORD_BY_KEY.get(lookupKey(word));
    const button = document.createElement('button'); button.type = 'button';
    const heading = document.createElement('strong'); heading.lang = 'en'; heading.textContent = displayWord(word);
    const sub = document.createElement('span'); sub.textContent = entry ? entry.zh : '未收录词义 · 仍可看完整写法';
    button.append(heading, sub); button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，${sub.textContent}，查看词卡`);
    button.addEventListener('click', () => openWord(word, button), opts);
    return button;
  }
  function renderResults(): void {
    roving(el('[data-es-results]'), results, wordButton);
    setText('[data-es-result-count]', `${results.length} 张词卡`);
  }
  function renderShelf(): void {
    const makeChip = (word: string, index: number): HTMLButtonElement => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = displayWord(word);
      button.setAttribute('aria-label', `${index + 1}：${displayWord(word)}，查看词卡`);
      button.addEventListener('click', () => openWord(word, button), opts); return button;
    };
    roving(el('[data-es-recent]'), shelf.state.recent, makeChip);
    roving(el('[data-es-favorites]'), shelf.state.favorites, makeChip);
    if (!shelf.state.recent.length) setText('[data-es-recent]', '还没有打开词卡。');
    if (!shelf.state.favorites.length) setText('[data-es-favorites]', '还没有收藏的词。');
    setText('[data-es-storage-status]', shelf.notice);
  }
  function makeSvg<T extends SVGElement>(tag: string, attributes: Record<string, string>): T {
    const node = document.createElementNS(NS, tag) as T;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function createBoard(host: HTMLElement, layout: WordLayout, zoom = false): BoardView {
    host.replaceChildren();
    const width = Math.max(340, layout.width);
    const shift = (width - layout.width) / 2;
    const svg = makeSvg<SVGSVGElement>('svg', { viewBox: `0 0 ${width} 132`, class: 'es-word-board', role: 'img', 'aria-label': `${layout.instances.map(item => item.char).join('')}，四线三格书写板` });
    if (zoom) svg.style.width = `${Math.round(width * 1.45)}px`;
    const paper = makeSvg<SVGRectElement>('rect', { x: '0', y: '0', width: String(width), height: '132', class: 'es-paper' }); svg.append(paper);
    GUIDE_LINES.forEach((y, index) => svg.append(makeSvg<SVGLineElement>('line', { x1: '0', x2: String(width), y1: String(y), y2: String(y), class: index === 2 ? 'es-guide-line es-baseline' : 'es-guide-line', 'data-guide': String(index + 1) })));
    const strokes: StrokeView[] = [];
    layout.instances.forEach(instance => instance.strokes.forEach((d, strokeIndex) => {
      const x = instance.x + shift;
      const transform = `translate(${x} 0)`;
      const ghost = makeSvg<SVGPathElement>('path', { d, transform, class: 'es-stroke-ghost', 'data-char-index': String(instance.index), 'data-stroke-index': String(strokeIndex) });
      const path = makeSvg<SVGPathElement>('path', { d, transform, class: 'es-stroke-ink', 'data-char-index': String(instance.index), 'data-stroke-index': String(strokeIndex) });
      svg.append(ghost, path);
      strokes.push({ path, length: path.getTotalLength(), x, charIndex: instance.index });
    }));
    const tip = makeSvg<SVGCircleElement>('circle', { r: '3.4', class: 'es-pen-tip', visibility: 'hidden' }); svg.append(tip);
    host.append(svg);
    return { svg, strokes, tip };
  }
  function planFor(board: BoardView): PlannedStroke[] {
    return board.strokes.map(item => ({ charIndex: item.charIndex, length: item.length, dot: item.length <= 2.5 }));
  }
  function refreshZoom(): void {
    if (!wordLayout) return;
    const show = wordLayout.width > 390 && window.innerWidth < 700;
    el('[data-es-zoom-wrap]').toggleAttribute('hidden', !show);
    if (show && wordBoards.length === 1) {
      const zoom = createBoard(el('[data-es-word-zoom]'), wordLayout, true);
      wordBoards.push(zoom);
      if (wordPlayer) paintBoard(zoom, wordPlayer);
    } else if (!show && wordBoards.length > 1) {
      wordBoards.pop(); el('[data-es-word-zoom]').replaceChildren();
    }
  }
  function paintBoard(board: BoardView, player: WritingPlayer): void {
    board.svg.classList.toggle('es-hide-ghost', !ghostVisible);
    board.strokes.forEach((item, index) => {
      const amount = index < player.strokeIndex ? 1 : index === player.strokeIndex ? player.fraction : 0;
      item.path.style.strokeDasharray = String(item.length);
      item.path.style.strokeDashoffset = String(item.length * (1 - amount));
      item.path.style.opacity = amount > 0 ? '1' : '0';
      item.path.style.strokeWidth = item.length <= 2.5 ? String(5.2 * amount) : '';
    });
    const active = board.strokes[player.strokeIndex];
    if (active && player.status !== 'idle' && player.status !== 'completed' && (player.stage === 'stroke' || player.fraction > 0)) {
      const point = active.path.getPointAtLength(active.length * player.fraction);
      board.tip.setAttribute('cx', String(point.x + active.x)); board.tip.setAttribute('cy', String(point.y));
      board.tip.setAttribute('visibility', 'visible');
    } else board.tip.setAttribute('visibility', 'hidden');
  }
  function syncUi(): void {
    const player = activePlayer(); if (!player) return;
    activeBoards().forEach(board => paintBoard(board, player));
    const chars = reviewMode ? reviewLetter : selectedWord;
    const current = player.strokes[player.strokeIndex];
    const charIndex = current?.charIndex ?? Math.max(0, chars.length - 1);
    const within = current ? player.strokes.slice(0, player.strokeIndex + 1).filter(stroke => stroke.charIndex === charIndex).length : 0;
    const state = player.status === 'completed' ? `完成：${chars} 保留在四线三格纸上。` :
      `${player.status === 'playing' ? '正在写' : player.status === 'paused' ? '已暂停' : '准备写'}：第 ${charIndex + 1} 个字符 ${chars[charIndex]}，第 ${within || 1} 笔。`;
    if (state !== announcedState) { setText(reviewMode ? '[data-es-review-status]' : '[data-es-word-status]', state); announcedState = state; }
    const pane = el<HTMLElement>(reviewMode ? '[data-es-review-pane]' : '[data-es-word-pane]');
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
  function cancelFrame(): void { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = null; }
  function animate(timestamp: number): void {
    frame = 0;
    const player = activePlayer();
    if (!player || player.status !== 'playing' || document.hidden) return;
    if (lastFrame !== null && timestamp - lastFrame > 500) {
      // Some desktop browsers keep document.hidden=false when their window is
      // minimized, but throttle animation frames to roughly one per second.
      player.pause(); lastFrame = null; syncUi(); return;
    }
    if (lastFrame !== null) player.advance(Math.min(100, timestamp - lastFrame));
    lastFrame = timestamp;
    syncUi();
    if (player.status === 'playing') frame = requestAnimationFrame(animate);
    else lastFrame = null;
  }
  function startFrame(): void { cancelFrame(); frame = requestAnimationFrame(animate); }
  function pauseWriting(): void { activePlayer()?.pause(); cancelFrame(); syncUi(); }
  function stopSpelling(): void {
    if (spellTimer) clearTimeout(spellTimer); spellTimer = 0; spellingPlaying = false;
    setText('[data-es-spell-play]', '▶ 看拼写');
  }
  function updateSpelling(): void {
    const buttons = [...el('[data-es-word-letters]').querySelectorAll<HTMLButtonElement>('button')];
    buttons.forEach((button, index) => { button.classList.toggle('es-current-letter', index === spellStep); button.classList.toggle('es-done-letter', index < spellStep); });
    setText('[data-es-spell-status]', `${spellStep + 1} / ${buttons.length}`);
    el<HTMLButtonElement>('[data-es-spell-prev]').disabled = spellStep === 0;
    el<HTMLButtonElement>('[data-es-spell-next]').disabled = spellStep >= buttons.length - 1;
  }
  function renderSpelling(): void {
    const host = el('[data-es-word-letters]'); host.replaceChildren();
    spellingLetters(selectedWord).forEach((char, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.lang = 'en'; button.textContent = char;
      button.setAttribute('aria-label', `第 ${index + 1} 个字符 ${char}，回看写法`);
      button.addEventListener('click', () => openReview(char, button, false), opts); host.append(button);
    });
    updateSpelling();
  }
  function updateFavorite(): void {
    const active = shelf.state.favorites.includes(lookupKey(selectedWord));
    setText('[data-es-favorite]', active ? '★ 已收藏' : '☆ 收藏');
    el('[data-es-favorite]').setAttribute('aria-pressed', String(active));
  }
  function openWord(word: string, opener: HTMLElement): void {
    pauseWriting(); stopSpelling(); reviewPlayer?.dispose(); wordPlayer?.dispose();
    selectedWord = displayWord(word); wordOpener = opener; reviewMode = false; standaloneReview = false; spellStep = 0; announcedState = '';
    const key = lookupKey(selectedWord);
    const entry = WORD_BY_KEY.get(key);
    const shelfHost = opener.closest('[data-es-recent]') ? '[data-es-recent]' : opener.closest('[data-es-favorites]') ? '[data-es-favorites]' : '';
    setText('#es-dialog-title', selectedWord);
    const brief = entry?.source === 'curated' ? entry.zh : entry?.zh.split(/[\n,，;；]/)[0].trim();
    setText('[data-es-zh]', brief ? brief.length > 36 ? `${brief.slice(0, 36)}…` : brief : '这个词还没有收录中文意思。');
    setText('[data-es-phonetic]', entry?.phonetic ? `来源音标 [${entry.phonetic}]` : '');
    setText('[data-es-definition]', entry ? entry.source === 'curated' ? `${entry.partOfSpeech} · ${entry.definition} · 已审定儿童词义` : `扩展词库释义 · ECDICT：${entry.zh}` : '未收录词义，仍可看完整写法。');
    el('[data-es-example]').toggleAttribute('hidden', !entry?.example);
    setText('[data-es-example-en]', entry?.example ?? ''); setText('[data-es-example-zh]', entry?.exampleZh ?? '');
    el<HTMLButtonElement>('[data-es-speak]').disabled = !entry;
    el<HTMLButtonElement>('[data-es-favorite]').hidden = !entry;
    setText('[data-es-speech-status]', entry ? '系统语音可朗读此词。' : '未收录词不朗读，也不会保存在书架。');
    el<HTMLDetailsElement>('.es-more').open = false;
    const layout = layoutWord(selectedWord); wordLayout = layout;
    wordBoards = [createBoard(el('[data-es-word-board]'), layout)];
    el('[data-es-word-zoom]').replaceChildren();
    wordPlayer = new WritingPlayer(planFor(wordBoards[0]));
    refreshZoom();
    renderSpelling();
    el('[data-es-word-pane]').removeAttribute('hidden'); el('[data-es-review-pane]').setAttribute('hidden', '');
    if (entry) { shelf.visit(key); renderShelf(); if (shelfHost) wordOpener = [...el(shelfHost).querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === displayWord(key)) ?? input; }
    updateFavorite();
    if (!dialog.open) dialog.showModal();
    syncUi();
    el<HTMLButtonElement>('[data-es-word-pane] [data-es-control="play"]').focus();
  }
  function openReview(char: string, opener: HTMLElement, standalone: boolean): void {
    if (!GLYPH_STROKES[char]) return;
    pauseWriting(); stopSpelling(); reviewPlayer?.dispose();
    reviewLetter = char; reviewOpener = opener; reviewMode = true; standaloneReview = standalone; announcedState = '';
    el('[data-es-word-pane]').setAttribute('hidden', ''); el('[data-es-review-pane]').removeAttribute('hidden');
    el<HTMLButtonElement>('[data-es-review-back]').hidden = standalone;
    renderReview();
    if (!dialog.open) { wordOpener = opener; dialog.showModal(); }
    syncUi(); el<HTMLButtonElement>('[data-es-review-pane] [data-es-control="play"]').focus();
  }
  function renderReview(): void {
    setText('[data-es-review-title]', `${reviewLetter} · ${/[A-Z]/.test(reviewLetter) ? '大写' : '小写'}写法`);
    const letter = /[A-Za-z]/.test(reviewLetter);
    el<HTMLButtonElement>('[data-es-upper]').disabled = !letter;
    el<HTMLButtonElement>('[data-es-lower]').disabled = !letter;
    el('[data-es-upper]').setAttribute('aria-pressed', String(letter && reviewLetter === reviewLetter.toUpperCase()));
    el('[data-es-lower]').setAttribute('aria-pressed', String(letter && reviewLetter === reviewLetter.toLowerCase()));
    reviewBoards = [createBoard(el('[data-es-review-board]'), layoutWord(reviewLetter))];
    reviewPlayer = new WritingPlayer(planFor(reviewBoards[0]));
    announcedState = ''; syncUi();
  }
  function closeDialog(): void { dialog.close(); }
  function returnFromReview(): void {
    pauseWriting(); reviewPlayer?.dispose(); reviewMode = false; announcedState = '';
    el('[data-es-review-pane]').setAttribute('hidden', ''); el('[data-es-word-pane]').removeAttribute('hidden');
    syncUi(); reviewOpener?.focus({ preventScroll: true });
  }
  function speak(): void {
    const entry = WORD_BY_KEY.get(lookupKey(selectedWord)); if (!entry) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { setText('[data-es-speech-status]', '这台设备暂时没有可用的系统语音。'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectedWord);
    utterance.lang = 'en-US'; utterance.rate = 0.85;
    utterance.onerror = () => { if (dialog.open) setText('[data-es-speech-status]', '系统语音暂时无法播放。'); };
    setText('[data-es-speech-status]', '正在使用系统英语语音朗读。'); window.speechSynthesis.speak(utterance);
  }

  roving(el('[data-es-picks]'), STARTER_WORDS, (word, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = word; button.lang = 'en';
    button.setAttribute('aria-label', `${index + 1}：${word}，查这个词`);
    button.addEventListener('click', () => { input.value = word; results = [word]; renderResults(); setText('#es-search-note', `找到 ${word}。`); openWord(word, button); }, opts);
    return button;
  });
  roving(el('[data-es-alphabet]'), [...ALPHABET], (letter, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${letter.toUpperCase()} ${letter}`; button.lang = 'en';
    button.setAttribute('aria-label', `字母 ${index + 1}：${letter.toUpperCase()} 和 ${letter}，查看笔顺`);
    button.addEventListener('click', () => openReview(letter, button, true), opts); return button;
  });
  renderResults(); renderShelf();
  el<HTMLFormElement>('[data-es-search]').addEventListener('submit', event => {
    event.preventDefault(); const parsed = parseLookup(input.value); setText('#es-search-note', parsed.message);
    if (!parsed.valid) return;
    results = parsed.words; renderResults(); el('[data-es-results]').querySelector<HTMLElement>('button')?.focus();
  }, opts);
  listen('[data-es-word-close]', closeDialog);
  dialog.addEventListener('close', () => {
    pauseWriting(); stopSpelling(); wordPlayer?.dispose(); reviewPlayer?.dispose();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (document.activeElement === document.body || dialog.contains(document.activeElement))
      wordOpener?.focus({ preventScroll: true });
  }, opts);
  listen('[data-es-review-back]', returnFromReview);
  dialog.addEventListener('cancel', event => {
    if (reviewMode && !standaloneReview) { event.preventDefault(); returnFromReview(); }
  }, opts);
  listen('[data-es-upper]', () => { if (/[A-Za-z]/.test(reviewLetter)) { pauseWriting(); reviewLetter = reviewLetter.toUpperCase(); reviewPlayer?.dispose(); renderReview(); } });
  listen('[data-es-lower]', () => { if (/[A-Za-z]/.test(reviewLetter)) { pauseWriting(); reviewLetter = reviewLetter.toLowerCase(); reviewPlayer?.dispose(); renderReview(); } });
  listen('[data-es-speak]', speak);
  listen('[data-es-favorite]', () => { shelf.favorite(lookupKey(selectedWord)); updateFavorite(); renderShelf(); });
  el<HTMLInputElement>('[data-es-ghost]').addEventListener('change', event => { ghostVisible = (event.target as HTMLInputElement).checked; syncUi(); }, opts);
  dialog.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-es-control]'); if (!button) return;
    const player = activePlayer(); if (!player) return;
    switch (button.dataset.esControl) {
      case 'play':
        if (player.status === 'playing') pauseWriting();
        else { stopSpelling(); player.play(); syncUi(); startFrame(); }
        break;
      case 'replay': stopSpelling(); player.replay(); syncUi(); startFrame(); break;
      case 'previous': cancelFrame(); player.previous(); syncUi(); break;
      case 'next': cancelFrame(); player.next(); syncUi(); break;
      case 'all': cancelFrame(); player.showAll(); syncUi(); break;
    }
  }, opts);
  dialog.addEventListener('change', event => {
    const select = (event.target as Element).closest<HTMLSelectElement>('[data-es-speed]');
    if (select) { activePlayer()?.setSpeed(select.value as WritingSpeed); syncUi(); }
  }, opts);
  listen('[data-es-spell-prev]', () => { stopSpelling(); spellStep = Math.max(0, spellStep - 1); updateSpelling(); });
  listen('[data-es-spell-next]', () => { stopSpelling(); spellStep = Math.min(spellingLetters(selectedWord).length - 1, spellStep + 1); updateSpelling(); });
  listen('[data-es-spell-play]', () => {
    if (spellingPlaying) { stopSpelling(); return; }
    pauseWriting(); spellingPlaying = true; spellStep = 0; updateSpelling(); setText('[data-es-spell-play]', 'Ⅱ 暂停拼写');
    const tick = (): void => {
      if (!spellingPlaying) return;
      if (spellStep >= spellingLetters(selectedWord).length - 1) { stopSpelling(); return; }
      spellStep++; updateSpelling(); spellTimer = window.setTimeout(tick, 950);
    };
    spellTimer = window.setTimeout(tick, 950);
  });
  const pauseOnLeave = (): void => { if (document.hidden) { pauseWriting(); stopSpelling(); } };
  document.addEventListener('visibilitychange', pauseOnLeave, opts);
  window.addEventListener('blur', () => { pauseWriting(); stopSpelling(); }, opts);
  window.addEventListener('resize', refreshZoom, opts);
  el('[data-testid=english-study]').setAttribute('data-word-count', String(WORDS.length));
  el('[data-testid=english-study]').setAttribute('data-letter-count', String(Object.keys(LETTER_STROKES).length));
  return { destroy() {
    cancelFrame(); stopSpelling(); wordPlayer?.dispose(); reviewPlayer?.dispose(); abort.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (dialog.open) dialog.close(); root.replaceChildren();
  } };
}

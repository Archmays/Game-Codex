import { FEEDBACK_KEY, INPUT_MODES, PLAYTEST_PLACES, feedbackMarkdown, parseFeedback, type PlaytestFeedback } from './feedback';
import './styles.css';

const chapters = [
  { id: 'homeward', title: '借字归途', text: '原来的五间房。借木搭桥，搬动有限的不，改变门与风。', rooms: 'r1 · r2 · r3 · r4 · r5' },
  { id: 'lamplight', title: '借一盏明', text: '日与月合成明。照亮影路，放灯腾手，再把光带回来。', rooms: 'light-1 · light-2 · light-3 · light-4 · light-5' },
  { id: 'confluence', title: '光与归途', text: '光、木桥、林和门风相遇。手里只能带一件，试试不同走法。', rooms: 'woven-1 · woven-2 · woven-3 · woven-4 · woven-5' },
] as const;
const maps = [
  { id: 'qinglan-pass', title: '青岚关', text: '原来的六波，原配方与两组共鸣。3、7、8 号塔位靠近弯路，旧局可以接着守。' },
  { id: 'twin-bends', title: '双岔湾', text: '八波、两条来路。分配塔位覆盖，试试森、森林与 forest 共鸣。' },
  { id: 'beacon-keep', title: '烽台关', text: '八波，留意首领阶段预告。中文构筑也能守城。' },
] as const;
const placeLabels = ['首章 · 借字归途', '第二章 · 光', '第三章 · 综合', '青岚关', '双路地图', '首领地图', '其他输入或共享页面'];
const modeLabels = ['键盘', '鼠标', '触控', '混合使用'];

export function mountStep4Playtest(root: HTMLElement): void {
  root.className = 'step4-playtest-mount';
  root.innerHTML = `<main class="step4-playtest" data-testid="step4-playtest">
    <header><div><p class="step4-kicker">GAME-CODEX · STEP4</p><h1>本次试玩</h1><p>选一段路，或守一座城。随时继续，也可以明确重开。</p></div><a tabindex="0" class="step4-button" href="?world=my-game-world">返回游戏世界</a></header>
    <p class="step4-version">当前版本 <code data-step4-sha></code></p>
    <section aria-labelledby="step4-adventure-title"><div class="step4-section-heading"><h2 id="step4-adventure-title">字间行者</h2><span>三章 · 十五房</span></div>
      <p>方向键／WASD 移动；Space／E 拿放或确认，X 拆、C 合、Z 撤销，Esc 取消。也能点邻接路格走，再用主操作。</p>
      <div class="step4-cards">${chapters.map((chapter, i) => `<article><p class="step4-index">第${i + 1}章</p><h3>${chapter.title}</h3><p>${chapter.text}</p><a tabindex="0" data-playtest-entry class="step4-button" href="?play=hanzi-word-adventure&chapter=${chapter.id}&from=world">选择这一章 <span aria-hidden="true">→</span></a><details><summary>关卡 ID</summary><code>${chapter.id}</code><p>${chapter.rooms}</p></details></article>`).join('')}</div>
      <a tabindex="0" class="step4-original" href="?play=hanzi-word-adventure">字间行者原入口 →</a>
    </section>
    <section aria-labelledby="step4-tower-title"><div class="step4-section-heading"><h2 id="step4-tower-title">字阵守城</h2><span>三地图 · 二十二波</span></div>
      <p>Tab 切换区域，方向键选材料、塔位或英文，Enter／Space 确认；P 暂停，Esc 取消。点击或触摸使用同样的合成和装备预览；顶部“速度”可切换 1×／2×。</p>
      <div class="step4-cards">${maps.map((map, i) => `<article><p class="step4-index">${i ? '新地图 · 八波' : '原地图 · 六波'}</p><h3>${map.title}</h3><p>${map.text}</p><a tabindex="0" data-playtest-entry class="step4-button" href="?play=hanzi-tower-defense&map=${map.id}&from=world">选择这张地图 <span aria-hidden="true">→</span></a><details><summary>地图 ID</summary><code>${map.id}</code></details></article>`).join('')}</div>
      <a tabindex="0" class="step4-original" href="?play=hanzi-tower-defense">字阵守城原入口 →</a>
    </section>
    <aside class="step4-save-note"><h2>新游戏与继续</h2><p>进入游戏后选择新游戏，或从列表继续已有的章节／地图存档。上面的链接只选择目的地；重置会另列范围并请你确认。其他章节、地图与旧版原始存档保留。</p></aside>
    <section class="step4-feedback" aria-labelledby="step4-feedback-title"><h2 id="step4-feedback-title">记下这次试玩</h2><p>只记录你主动填写并保存的文字，保存在这台浏览器。也可以直接导出 Markdown。</p>
      <div class="step4-fields"><label>玩到哪里<select data-feedback-place>${PLAYTEST_PLACES.map((value, i) => `<option value="${value}">${placeLabels[i]}</option>`).join('')}</select></label><label>怎么操作<select data-feedback-input>${INPUT_MODES.map((value, i) => `<option value="${value}">${modeLabels[i]}</option>`).join('')}</select></label></div>
      <label>发生了什么<textarea data-feedback-text rows="5" maxlength="4000" placeholder="例如：在哪一房卡住了，或哪个按钮不容易按到。"></textarea></label>
      <div class="step4-feedback-actions"><button type="button" data-feedback-save disabled>保存本机反馈</button><button type="button" data-feedback-export disabled>导出 MD</button></div><p data-feedback-status role="status">没有填写时不会创建记录。</p><details><summary>查看文字预览</summary><pre data-feedback-preview></pre></details>
    </section>
    <nav class="step4-other" aria-label="其他操作入口"><a tabindex="0" href="?world=math-world">数学世界</a><a tabindex="0" href="?hub=classic&from=world">游戏百宝箱</a><a tabindex="0" href="?play=memory-card">独立配对兼容入口</a><a tabindex="0" href="?world=my-game-world">首页与设置／保险箱</a></nav>
  </main>`;
  const element = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const build = document.documentElement.dataset.buildCommit ?? 'local-source';
  element('[data-step4-sha]').textContent = build;
  const place = element<HTMLSelectElement>('[data-feedback-place]'), input = element<HTMLSelectElement>('[data-feedback-input]'), textarea = element<HTMLTextAreaElement>('[data-feedback-text]'), status = element('[data-feedback-status]');
  let raw: string | null = null, writable = true;
  try { raw = localStorage.getItem(FEEDBACK_KEY); } catch { writable = false; }
  const saved = parseFeedback(raw);
  if (raw !== null && !saved) { writable = false; status.textContent = '已有记录暂不能读取，原文已保护；仍可填写并导出这次反馈。'; }
  if (saved) { place.value = saved.place; input.value = saved.input; textarea.value = saved.text; status.textContent = '已载入上次主动保存的文字。'; }
  const value = (): PlaytestFeedback | null => parseFeedback(JSON.stringify({ version: 1, place: place.value, input: input.value, text: textarea.value.trim() }));
  const refresh = () => {
    element<HTMLButtonElement>('[data-feedback-save]').disabled = !value() || !writable;
    element<HTMLButtonElement>('[data-feedback-export]').disabled = !value();
    element('[data-feedback-preview]').textContent = textarea.value;
  };
  textarea.addEventListener('input', refresh);
  element('[data-feedback-save]').addEventListener('click', () => {
    const feedback = value(); if (!feedback || !writable) return;
    try {
      if (localStorage.getItem(FEEDBACK_KEY) !== raw) throw new Error('changed');
      const next = JSON.stringify(feedback); localStorage.setItem(FEEDBACK_KEY, next); raw = next;
      status.textContent = '文字已保存在本机。';
    } catch { writable = false; status.textContent = '本机记录已有变化或暂不可写，原记录已保护。请导出这次文字，刷新后再保存。'; }
    refresh();
  });
  element('[data-feedback-export]').addEventListener('click', () => {
    const feedback = value(); if (!feedback) return;
    const url = URL.createObjectURL(new Blob([feedbackMarkdown(feedback, build)], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'game-codex-step4-feedback.md'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); status.textContent = '已导出文字；没有上传。';
  });
  refresh();
}


import type {StudyContext} from './study-context';
export function mountStudyPage(ctx:StudyContext):void {
  ctx.root.className='hsl-root';delete ctx.root.dataset.indexReady;
  ctx.root.innerHTML=`<main class="hsl" data-testid="hanzi-stroke-lab">
    <header class="hsl-header"><div><p class="hsl-eyebrow">中文 · 查字工具</p><h1>汉字书房</h1></div><a tabindex="0" class="hsl-return" href="?world=my-game-world" data-hsl-return>返回首页 ↗</a></header>
    <section class="hsl-search" aria-label="查字">
      <form data-search><label class="hsl-label" for="hsl-input">输入或粘贴汉字</label><div class="hsl-search-row"><input id="hsl-input" type="text" autocomplete="off" spellcheck="false" placeholder="例如：天天向上" aria-describedby="hsl-query-note"><button class="hsl-primary" type="submit">查询</button></div></form>
      <div class="hsl-entry-row"><button data-pane="hand" aria-expanded="false" aria-controls="hsl-hand">手写找字</button><button data-pane="query">回到查字</button><button data-shelf-toggle aria-expanded="false" aria-controls="hsl-shelf">常用 · 最近 · 收藏</button></div>
      <p id="hsl-query-note" class="hsl-note" role="status">一次最多 48 个字符，重复字也会保留。</p>
    </section>
    <section id="hsl-hand" class="hsl-card hsl-hand" hidden aria-labelledby="hsl-hand-title">
      <div class="hsl-section-heading"><h2 id="hsl-hand-title">不会读？写出来</h2><span class="hsl-local">本机识别</span></div>
      <div class="hsl-hand-layout"><div><p class="hsl-note">用手指、鼠标或笔写一个字。</p><svg class="hsl-pad" data-pad viewBox="0 0 256 256" tabindex="0" role="application" aria-label="手写画布，键盘用户先选择键盘画笔" aria-describedby="hsl-pen-help"></svg></div>
      <div><p class="hsl-note" data-hand-status role="status">打开手写区后载入本地模型。</p><div class="hsl-char-list hsl-candidates" data-candidates role="group" aria-label="手写候选"></div>
      <div data-hand-choice hidden><p data-choice-label></p><div class="hsl-row"><button data-hand-query class="hsl-primary">查看这个字</button><button data-hand-add>加入这组</button><button data-hand-next>继续写下一个</button></div></div>
      <div class="hsl-row"><button data-undo>撤销上一笔</button><button data-clear>清空重写</button><button data-recognize>重新识别</button></div>
      <details><summary>键盘画笔</summary><p id="hsl-pen-help">方向键移动，空格落笔／抬笔，Esc 取消并退出；Tab 可离开。Shift＋方向键大步移动。</p><button data-pen>进入键盘画笔</button></details>
      <details><summary>没有找到想要的字？</summary><p>候选是近似匹配，可撤销、清空再写。模型不覆盖所有汉字。</p><button data-retry-hand>重新载入识别</button></details></div></div>
    </section>
    <section id="hsl-shelf" class="hsl-card hsl-shelf" hidden aria-label="本地字架"><h2>常用字</h2><div class="hsl-char-list" data-common role="group" aria-label="常用字"></div><div class="hsl-section-heading"><h2>最近查看</h2><button data-clear-recent>清空最近</button></div><div class="hsl-char-list" data-recent role="group" aria-label="最近查看"></div><div class="hsl-section-heading"><h2>收藏的字</h2><button data-clear-favorites>清空收藏</button></div><div class="hsl-char-list" data-favorites role="group" aria-label="收藏的字"></div></section>
    <p class="hsl-note" data-storage-status role="status"></p>
    <section aria-label="这组字"><div class="hsl-group-controls" data-group-controls hidden><button class="hsl-primary" data-group-play>依次播放这组字</button><button data-group-restart>全组重播</button><label>速度<select data-group-speed aria-label="整组播放速度"><option value="0.5">0.5 倍</option><option value="1" selected>1 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label></div>
      <p class="hsl-note" data-group-status role="status"></p><div class="hsl-results" data-results role="group" aria-label="查询结果；方向键换卡，Enter 查看详情"></div>
    </section>
    <dialog class="hsl-detail hsl-card" data-detail aria-labelledby="hsl-character-title"><div class="hsl-section-heading"><h2 id="hsl-character-title" tabindex="-1"></h2><button data-close-detail autofocus>关闭详情</button></div><p class="hsl-pinyin" data-detail-pinyin></p><p class="hsl-note" data-detail-note></p><div data-detail-glyph></div><p class="hsl-step-status" data-step-status role="status"></p>
      <div class="hsl-controls"><button class="hsl-primary" data-detail-play>▶ 播放</button><button data-restart>重播这个字</button><button data-all>完整字形</button><button data-prev>上一笔</button><button data-next>下一笔</button><button data-detail-favorite>☆ 收藏</button><label>速度<select data-speed aria-label="播放速度"><option value="0.5">0.5 倍</option><option value="1" selected>1 倍</option><option value="1.5">1.5 倍</option><option value="2">2 倍</option></select></label></div>
      <label class="hsl-grid-toggle"><input type="checkbox" data-grid> 显示田字格</label><p class="hsl-legend">实心：已写 · 强调色：当前笔 · 虚线：待写</p><h3>逐笔查看</h3><div class="hsl-steps" data-steps role="group" aria-label="逐笔步骤"></div>
      <details><summary>字形与来源</summary><p data-meta></p><p data-reading-note></p><p>保留原字形，不转换简繁。笔顺沿用本地字库，地区规范可能有差异。</p></details>
      <div class="hsl-row" data-detail-hand hidden><button data-continue-hand>继续写下一个</button><button data-back-group>返回原来这组</button></div>
    </dialog>
    <footer class="hsl-footer"><details><summary>字库、读音与本地隐私</summary><p>本地收录 9,574 个字形条目（含少量部件），手写模型覆盖 9,507 个候选。未覆盖全部 Unicode 汉字。查询保留原字，不自动转换简繁。</p><p>字音优先 Unicode 17.0 的《通用规范汉字字典》2013 数据，其次《现代汉语词典》1983 数据，最后采用 Unihan 普通话读音。不做词句语境判断，也不保证穷尽所有读音。</p><p>笔顺来自 Hanzi Writer Data / Make Me a Hanzi，面向中国大陆笔顺；保留上游字形，繁体及地区字形可能有差异。本工具不声明逐字通过国家规范认证。</p><p>笔顺字形 © Arphic Technology，按 Arphic Public License 分发，无担保。识别引擎 hanzi_lookup 按 LGPL-3.0 分发，可替换其独立文件。查询、轨迹和候选不上传；仅最近、收藏、田字格保存在本机，不保存书写轨迹。</p><p><a tabindex="0" href="./hanzi-stroke-lab/SOURCES.md" target="_blank" rel="noopener">来源与版本</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/ARPHICPL.TXT" target="_blank" rel="noopener">笔顺许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/LGPL-3.0.txt" target="_blank" rel="noopener">识别许可</a> · <a tabindex="0" href="./hanzi-stroke-lab/licenses/UNICODE-LICENSE.txt" target="_blank" rel="noopener">字音许可</a></p></details></footer>
  </main>`;
ctx.grid.checked=ctx.shelf.state.grid;
}

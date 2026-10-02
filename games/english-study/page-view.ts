import { WORDS } from './model';
import type { StudyContext } from './study-context';
const controls=`<div class="es-writing-controls" role="group" aria-label="书写控制">
  <button class="es-primary" type="button" data-es-control="play">▶ 播放书写</button>
  <button type="button" data-es-control="replay">↺ 重播</button>
  <button type="button" data-es-control="previous">上一笔</button>
  <button type="button" data-es-control="next">下一笔</button>
  <button type="button" data-es-control="all">完整字形</button>
  <label>速度 <select data-es-speed aria-label="书写速度"><option value="slow">慢速</option><option value="standard" selected>标准</option><option value="fast">较快</option></select></label>
</div>`;
export function mountStudyPage(ctx:StudyContext):void {
  ctx.root.className = 'es-root';
  ctx.root.innerHTML = `<main class="es" data-testid="english-study">
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
}

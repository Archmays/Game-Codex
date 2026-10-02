import { PRODUCT_VERSION, type Presentation } from '../../packages/presentation/settings';
import { presentationControls } from '../../packages/presentation/controls';
import { WORLD_RULES } from './content';
import { DIR_NAMES, type Journey } from './model';
import { CHAPTERS, ROOMS, type ChapterId, type Direction } from './rooms';
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };


export function createAdventurePanels(root: HTMLElement, visual: Presentation) {
  root.className = 'hway-mount';
  root.innerHTML = `<main class="hway" data-testid="hanzi-word-adventure" aria-labelledby="hway-title">
    <header class="hway-header"><div><p><span class="hway-logo" aria-hidden="true">人</span> 字间行者 <span class="product-version">v${PRODUCT_VERSION}</span> <span data-hway-chapter-title>· 借字归途</span></p><h1 id="hway-title" data-hway-title></h1></div><button type="button" data-hway-exit aria-label="返回游戏世界">返回</button></header>
    <section class="hway-menu hway-modal" data-hway-menu role="dialog" aria-modal="true" aria-label="选择新游戏或继续游戏"><div><div class="hway-menu-mark" aria-hidden="true">人<span>友</span></div><h2>从哪段路出发？</h2><p>每章各有一份本机存档，可以随时换章。</p><div data-hway-menu-content></div><button type="button" data-hway-menu-close>返回</button></div></section><div class="hway-layout"><section class="hway-land" aria-label="文字场景">
      <p class="hway-subtitle" data-hway-subtitle></p><button type="button" data-hway-retry hidden>重新载入场景</button>
      <div class="hway-board" data-hway-board><div class="hway-canvas" data-hway-canvas aria-hidden="true"></div><div class="hway-grid" role="group" aria-label="文字世界。方向键移动；Shift加方向键查看相邻格；空格主操作；Tab离开世界" data-hway-grid tabindex="0"></div></div>
      <div class="product-guide" data-hway-guide ${visual.guideSeen?'hidden':''}><p>朝向选目标，Space 拿放。试过以后，随时 Z 撤销。</p><button type="button" data-hway-guide-close>知道了</button></div><p class="hway-legend"><span>山 · 山崖</span><span>框中的字 · 可搬</span><span>双线短句 · 改规则</span></p>
    </section><aside class="hway-controls" aria-label="走路与改字">
      <div class="hway-save-tools"><button type="button" data-hway-saves>章节／存档</button><button type="button" data-hway-settings>设置</button></div><div class="hway-companions" data-hway-companions hidden><button type="button" data-hway-actor="person"></button><button type="button" data-hway-actor="friend"></button></div><div class="hway-hand"><span>手里 <strong data-hway-hand>空</strong></span><span>最多带一个字<br> · 林也算一个</span></div>
      <div class="hway-direction" aria-label="移动方向">${(['left', 'up', 'down', 'right'] as Direction[]).map(d => `<button type="button" data-hway-move="${d}" aria-label="向${DIR_NAMES[d]}走">${arrows[d]}</button>`).join('')}</div>
      <div class="hway-primary"><p data-hway-target></p><button type="button" data-hway-primary>主操作 · Space</button><button type="button" data-hway-choose-place hidden aria-pressed="false">选择落字处</button></div><div class="hway-toolbar"><button type="button" data-hway-undo>撤销一步</button><button type="button" data-hway-restart>本间重开</button><button type="button" data-hway-hint>想一想</button></div>
      <section class="hway-inspect" aria-label="字的状态和动作"><p data-hway-inspect>点一个字，先看它能做什么。</p><div class="hway-actions" data-hway-actions></div></section>
      <p class="hway-feedback" role="status" aria-live="polite" data-hway-feedback></p>
      <div class="hway-hint" data-hway-hint-box hidden><p data-hway-hint-text></p><button type="button" data-hway-hint-more>再提示一点</button><button type="button" data-hway-hint-close>收起提示</button></div>
      <div class="hway-sentences" data-hway-sentences></div>
      <div class="hway-ending" data-hway-ending hidden><p data-hway-ending-text></p><button type="button" data-hway-next>往前走</button><button type="button" data-hway-replay hidden>再走一次归途</button></div>
      <details class="hway-help"><summary>怎么玩 · 字与规则</summary><p>方向键／WASD：移动　Shift＋方向键：查看<br>Space／E：拿／放／明确确认　X：拆　C：合　Z：撤销　H：提示　Q：换角色　Esc：取消</p><p>点击相邻空路走一格；点击物件先查看，再按主操作。持字时点“选择落字处”，再点相邻格，只选位置不走路。远格不移动。Tab切换区域；在方向区用方向键选按钮。</p><ol>${WORLD_RULES.map(r => `<li>${r}</li>`).join('')}</ol><details><summary>内容定位</summary><p data-hway-content-id></p></details><p data-hway-save-status></p></details>
    </aside></div>
    <dialog class="hway-settings" data-hway-settings-dialog aria-label="声音与显示设置"><h2>声音与显示</h2><button type="button" data-hway-mute aria-pressed="false">静音</button><button type="button" data-hway-motion aria-pressed="false">减少动态</button>${presentationControls(visual)}<details><summary>进度管理</summary><button type="button" data-hway-reset>重置本章进度</button></details><button type="button" data-hway-settings-close>返回字间</button></dialog>
    <div class="hway-modal" data-hway-modal hidden role="dialog" aria-modal="true" aria-labelledby="hway-restart-title"><div><h2 id="hway-restart-title" data-hway-modal-title>重新走这一间？</h2><p data-hway-modal-text>本间回到入口，已经走到的房间仍保留。</p><button type="button" data-hway-confirm-restart>重开这一间</button><button type="button" data-hway-cancel-restart>取消</button></div></div>
  </main>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const shell = el('.hway'), board = el('[data-hway-board]'), grid = el('[data-hway-grid]'), feedback = el('[data-hway-feedback]');
  function renderMenu(menuOpen: boolean, menuMode: 'entry' | 'new' | 'continue', chapters: Partial<Record<ChapterId, Journey>>, lastContent: string, focus = true) {
    const content = el('[data-hway-menu-content]');
    const recent=CHAPTERS.find(c=>c.id===lastContent && chapters[c.id])??CHAPTERS.find(c=>chapters[c.id]);
    content.innerHTML = menuMode === 'entry' ? `${recent?`<button type="button" class="hway-resume" data-hway-resume="${recent.id}">继续上次<small>${recent.title} · ${ROOMS[chapters[recent.id]!.room].title}</small></button>`:''}<button type="button" data-hway-new>新游戏</button><button type="button" data-hway-continue>继续游戏 · 选择章节</button>` : `<p>${menuMode === 'new' ? '选择新游戏章节。已有存档的章节会先确认重置。' : '选择要继续的章节存档。其他章节会保留。'}</p>${CHAPTERS.map(c => { const j = chapters[c.id]; return `<button type="button" data-hway-chapter="${c.id}" ${menuMode === 'continue' && !j ? 'disabled' : ''}>${escape(c.title)}<small>${j ? `${escape(ROOMS[j.room].title)}${j.state.won ? ' · 已到出口' : ''}` : '尚未开始'}</small></button>`; }).join('')}<button type="button" data-hway-${menuMode === 'new' ? 'continue' : 'new'}>${menuMode === 'new' ? '查看继续存档' : '选择新游戏'}</button>`;
    el('[data-hway-menu]').hidden = !menuOpen; el('.hway-layout').inert = menuOpen; el('.hway-header').inert = menuOpen;
    if (focus) content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  let modalOpener: HTMLElement | null = null;
  return {
    el, shell, board, grid, feedback, renderMenu,
    openModal(title: string, message: string, confirm: string) {
      modalOpener = document.activeElement as HTMLElement;
      el('[data-hway-modal-title]').textContent = title;
      el('[data-hway-modal-text]').textContent = message;
      el('[data-hway-confirm-restart]').textContent = confirm;
      el('[data-hway-modal]').hidden = false;
      el('[data-hway-menu]').inert = true;
      el('.hway-layout').inert = true;
      el('[data-hway-cancel-restart]').focus();
    },
    closeModal(menuOpen: boolean, restoreSettings: boolean) {
      el('[data-hway-modal]').hidden = true;
      el('[data-hway-menu]').inert = false;
      el('.hway-layout').inert = menuOpen;
      if (restoreSettings) {
        el<HTMLDialogElement>('[data-hway-settings-dialog]').showModal();
        el('[data-hway-reset]').focus();
      } else (modalOpener?.isConnected ? modalOpener : grid).focus();
    }
  };
}

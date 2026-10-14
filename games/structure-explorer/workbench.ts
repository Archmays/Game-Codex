import './styles.css';

const DIRECTORY = '?play=structure-explorer';
const PENCIL = `${DIRECTORY}&exhibit=pencil`;

export function mountStructureExplorer(root: HTMLElement): { destroy(): void } {
  const exhibits = new URLSearchParams(window.location.search).getAll('exhibit');
  const pencil = exhibits.length === 1 && exhibits[0] === 'pencil';
  const unknown = exhibits.length > 0 && !pencil;
  root.className = 'structure-explorer-mount';
  root.innerHTML = `<main class="structure-explorer" data-structure-view="${pencil ? 'pencil' : 'directory'}">
    <header class="structure-header"><div><p class="structure-eyebrow">看看里面 · 动手试试</p><h1>结构探索馆</h1></div>
      <nav aria-label="探索馆导航">${pencil ? `<a tabindex="0" href="${DIRECTORY}" data-structure-directory>返回探索馆</a>` : ''}<a tabindex="0" href="?world=my-game-world" data-structure-home>返回首页 ↗</a></nav>
    </header>
    ${pencil ? `<section class="structure-exhibit" aria-label="铅笔工作原理演示"><iframe title="铅笔为什么能写字？交互演示" src="./structure-explorer/pencil.html" data-pencil-frame></iframe></section><footer class="structure-footer"><a tabindex="0" href="${DIRECTORY}">返回探索馆</a><a tabindex="0" href="?world=my-game-world">返回首页 ↗</a></footer>` : `
    <section class="structure-intro"><h2>小小物件，里面藏着什么？</h2><p>选一个物件，看看结构，再动手试一试。</p></section>
    ${unknown ? '<p role="status">这个展品还没有开放，先来看看铅笔吧。</p>' : ''}
    <section class="structure-catalog" aria-label="选择一个结构演示"><a tabindex="0" class="structure-card" href="${PENCIL}" data-structure-pencil>
      <img src="./structure-explorer/pencil-preview.svg" width="900" height="430" alt="黄色木杆铅笔的结构演示台">
      <div><p class="structure-eyebrow">日常物件</p><h2>铅笔为什么能写字？</h2><p>看里面、写一写、擦一擦。</p><span class="structure-card-action">探索铅笔 <span aria-hidden="true">→</span></span></div>
    </a></section>`}
  </main>`;

  const frame = root.querySelector<HTMLIFrameElement>('[data-pencil-frame]');
  let documentHeight = 1300;
  let inspecting = false;
  const fitInspector = (): void => {
    if (frame && inspecting) frame.style.height = `${window.innerHeight}px`;
  };
  const resize = (event: MessageEvent): void => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.type === 'pencil-inspector' && typeof event.data.open === 'boolean') {
      inspecting = event.data.open;
      if (inspecting) { fitInspector(); frame.scrollIntoView({ block: 'start' }); }
      else frame.style.height = `${documentHeight}px`;
      return;
    }
    if (event.data?.type !== 'pencil-height' || !Number.isFinite(event.data.height)) return;
    documentHeight = Math.max(500, Math.min(20000, event.data.height));
    if (!inspecting) frame.style.height = `${documentHeight}px`;
  };
  window.addEventListener('message', resize);
  window.addEventListener('resize', fitInspector);
  const cancelInput = (): void => { frame?.contentWindow?.postMessage({ type: 'pencil-cancel-input' }, window.location.origin); };
  window.addEventListener('scroll', cancelInput, { passive: true });
  if (!pencil && document.referrer) {
    const from = new URL(document.referrer);
    if (from.origin === location.origin && from.searchParams.get('exhibit') === 'pencil') root.querySelector<HTMLAnchorElement>('[data-structure-pencil]')?.focus();
  }
  return { destroy() { window.removeEventListener('message', resize); window.removeEventListener('resize', fitInspector); window.removeEventListener('scroll', cancelInput); if (frame) frame.remove(); root.replaceChildren(); } };
}

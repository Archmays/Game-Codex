import type { MountGameContext, MountedGame } from '../../packages/game-core';
import { retainBoxAudio } from './audio';
import { BOX_SCENES, type BoxScene, type MountedBox } from './scene-config';
import './box-entry.css';

function requestedScene(): BoxScene | 'unknown' {
  const values = new URLSearchParams(location.search).getAll('scene');
  if (!values.length) return 'window-breeze';
  return values.length === 1 && Object.hasOwn(BOX_SCENES, values[0]) ? values[0] as BoxScene : 'unknown';
}

export function mountBoxes(context: MountGameContext): MountedGame {
  const root = context.container;
  const lifetime = new AbortController();
  let active: MountedBox | undefined;
  let sceneEvents: AbortController | undefined;

  function clearScene(immediate = false): void {
    sceneEvents?.abort();
    sceneEvents = undefined;
    active?.destroy(immediate);
    active = undefined;
    root.replaceChildren();
    for (const key of Object.keys(root.dataset)) delete root.dataset[key];
  }

  function destroy(): void {
    lifetime.abort();
    clearScene();
  }

  function exit(): void {
    clearScene(true);
    context.onExit();
  }

  function select(scene: BoxScene): void {
    const url = new URL(location.href);
    url.searchParams.set('scene', scene);
    history.replaceState(history.state, '', url);
    void open(scene, true);
  }

  async function open(scene: BoxScene | 'unknown', focusHeading = false): Promise<void> {
    const config = BOX_SCENES[scene === 'unknown' ? 'window-breeze' : scene];
    document.title = '世界盒子 · ' + config.title;
    const releaseAudio = retainBoxAudio();
    clearScene();
    sceneEvents = new AbortController();
    const { signal } = sceneEvents;
    signal.addEventListener('abort', releaseAudio, { once: true });

    root.innerHTML = `<main class="box-entry" aria-labelledby="box-entry-heading">
      <h1 id="box-entry-heading" tabindex="-1">正在打开盒子……</h1>
      <button type="button" data-box-exit>返回</button>
    </main>`;
    root.querySelector('[data-box-exit]')!.addEventListener('click', exit, { signal });
    if (focusHeading) root.querySelector<HTMLElement>('#box-entry-heading')!.focus();
    try {
      const mount = await config.load();
      if (signal.aborted) return;
      active = mount({ ...context, onExit: exit });

      const header = root.querySelector('.wb-header');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'boxes';
      button.textContent = '换盒子';
      header?.append(button);
      const dialog = document.createElement('dialog');
      dialog.className = 'wb-dialog';
      dialog.setAttribute('aria-label', '换一个世界盒子');
      dialog.innerHTML = '<h2>打开哪个盒子？</h2>' + Object.entries(BOX_SCENES).map(([id, box], i) =>
        `<button type="button" data-box="${id}">0${i + 1} · ${box.title}</button>`).join('') +
        '<button type="button" data-close-boxes>继续玩</button>';
      root.querySelector('main')?.append(dialog);
      button.addEventListener('click', event => {
        event.stopPropagation();
        root.dispatchEvent(new CustomEvent('box-modal', { detail: { reason: 'boxes', open: true } }));
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('[data-box]')!.focus();
      }, { signal });
      dialog.addEventListener('click', event => {
        event.stopPropagation();
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
        if (target?.dataset.box) select(target.dataset.box as BoxScene);
        else if (target?.hasAttribute('data-close-boxes')) dialog.close();
      }, { signal });
      dialog.addEventListener('close', () => {
        root.dispatchEvent(new CustomEvent('box-modal', { detail: { reason: 'boxes', open: false } }));
        button.focus({ preventScroll: true });
      }, { signal });
      if (scene === 'unknown') {
        const notice = document.createElement('p');
        notice.className = 'wb-subtitle';
        notice.textContent = '这个盒子还没有收录，先打开窗边有风。';
        header?.after(notice);
      }
      if (focusHeading) button.focus({ preventScroll: true });
    } catch {
      if (signal.aborted) return;
      active?.destroy();
      active = undefined;
      root.innerHTML = `<main class="box-entry" aria-labelledby="box-entry-heading">
        <h1 id="box-entry-heading" tabindex="-1">盒子暂时打不开</h1>
        <p>已保存的进度还在。</p>
        <div><button type="button" data-box-retry>再试一次</button>
        ${scene === 'window-breeze' || scene === 'unknown' ? '' : '<button type="button" data-box-fallback>返回窗边有风</button>'}
        <button type="button" data-box-exit>返回</button></div>
      </main>`;
      root.querySelector('[data-box-retry]')!.addEventListener('click', () => location.reload(), { signal });
      root.querySelector('[data-box-fallback]')?.addEventListener('click', () => select('window-breeze'), { signal });
      root.querySelector('[data-box-exit]')!.addEventListener('click', exit, { signal });
      root.querySelector<HTMLElement>('#box-entry-heading')!.focus();
    } finally {
      // Cancellation may already have released this transition.
      if (!signal.aborted) releaseAudio();
      signal.removeEventListener('abort', releaseAudio);
    }
  }

  window.addEventListener('pagehide', event => {
    if (!event.persisted) lifetime.abort();
    clearScene(true);
  }, { signal: lifetime.signal });
  window.addEventListener('pageshow', event => {
    if (event.persisted) void open(requestedScene(), true);
  }, { signal: lifetime.signal });
  void open(requestedScene());
  return { destroy };
}

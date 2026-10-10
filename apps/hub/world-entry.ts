import type { MountedGame } from '../../packages/game-core';
import { MY_GAME_WORLD_ROUTE } from '../my-game-world/world-routes';
import '../my-game-world/styles.css';
import { mountHub } from './index';

/** Keep the catalogue and game modules out of the home's initial module graph. */
export function mountClassicHubFromWorld(root: HTMLElement): MountedGame {
  document.documentElement.classList.add('classic-hub-from-world-page');
  document.body.classList.add('classic-hub-from-world-page');
  root.className = 'classic-hub-from-world-mount';
  root.innerHTML = `<div class="classic-hub-from-world" data-testid="classic-hub-from-world">
    <nav class="classic-hub-world-nav" aria-label="游戏百宝箱导航"><a tabindex="0" href="${MY_GAME_WORLD_ROUTE}">← 回我的游戏世界</a></nav>
    <div class="classic-hub-world-inner" data-classic-hub-inner></div>
  </div>`;
  const inner = root.querySelector<HTMLElement>('[data-classic-hub-inner]');
  if (!inner) throw new Error('Classic hub inner mount is missing');
  const hub = mountHub(inner);
  return {
    destroy(): void {
      hub.destroy();
      document.documentElement.classList.remove('classic-hub-from-world-page');
      document.body.classList.remove('classic-hub-from-world-page');
      root.replaceChildren();
    },
  };
}

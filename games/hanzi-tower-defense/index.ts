import type { MountedGame } from '../../packages/game-core';
import { mountDefense } from './coordinator';
export { hanziTowerDefenseGame } from './definition';
export function mountHanziTowerDefense(root: HTMLElement, onExit = () => window.location.assign(new URLSearchParams(window.location.search).get('from') === 'hub' ? '?hub=classic&from=world' : '?world=my-game-world')): MountedGame {
return mountDefense(root,onExit);
}

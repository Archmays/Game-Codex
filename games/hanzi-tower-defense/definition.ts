import type { GameDefinition, MountedGame, MountGameContext } from '../../packages/game-core';

/** Catalogue metadata stays usable without loading Phaser or the game surface. */
export const hanziTowerDefenseGame: GameDefinition = {
  id: 'hanzi-tower-defense', title: '字阵守城', description: '摆下字塔，把部件合成汉字，守住最后一弯。', subject: '识字', recommendedAge: '6 岁起', learningGoal: '在守城中观察部件结构与双字词序。', status: '可玩', playLabel: '开始守城', route: '?play=hanzi-tower-defense&from=hub',
  mount: mountFromCatalogue,
};

function mountFromCatalogue(context: MountGameContext): MountedGame {
  let destroyed = false;
  let mounted: MountedGame | undefined;
  const load = () => {
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = '正在准备字阵守城…';
    context.container.replaceChildren(status);
    void import('./coordinator').then(({ mountDefense }) => {
      if (!destroyed) mounted = mountDefense(context.container, context.onExit);
    }).catch(() => {
      if (destroyed) return;
      status.textContent = '游戏暂时没有载入。可以重试，或返回选择游戏。';
      const retry = document.createElement('button'), back = document.createElement('button');
      retry.type = back.type = 'button';
      retry.textContent = '重新载入'; back.textContent = '返回';
      retry.onclick = load; back.onclick = context.onExit;
      context.container.replaceChildren(status, retry, back);
    });
  };
  load();
  return { destroy() { if (destroyed) return; destroyed = true; mounted?.destroy(); if (!mounted) context.container.replaceChildren(); } };
}

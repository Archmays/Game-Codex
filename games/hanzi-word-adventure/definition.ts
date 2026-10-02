import type { GameDefinition, MountedGame } from '../../packages/game-core';
export const hanziWordAdventureGame: GameDefinition = {
  id: 'hanzi-word-adventure', title: '字间行者', description: '挪一枚字，变一段路。借来木与不，走回家。', subject: '识字', recommendedAge: '6 岁起', learningGoal: '在文字空间中观察左右结构、否定和材料守恒。', status: '可玩', playLabel: '踏上归途', route: '?play=hanzi-word-adventure&from=hub', mount: context => {
    let destroyed = false;
    let mounted: MountedGame | undefined;
    const loading = document.createElement('p');
    loading.textContent = '正在打开字间行者……';
    loading.setAttribute('role', 'status'); context.container.append(loading);
    void import('./index').then(module => {
      if (destroyed) return;
      loading.remove(); mounted = module.mountHanziWordAdventure(context.container, context.onExit);
    }).catch(() => {
      if (destroyed) return;
      loading.textContent = '暂时没能打开字间行者。可以返回后再试。';
      const exit = document.createElement('button'); exit.type = 'button'; exit.textContent = '返回';
      exit.onclick = context.onExit; loading.append(exit);
      context.container.append(loading);
    });
    return { destroy() { if (destroyed) return; destroyed = true; loading.remove(); mounted?.destroy(); } };
  },
};

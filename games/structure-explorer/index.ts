import type { GameDefinition } from '../../packages/game-core';

export const structureExplorer: GameDefinition = {
  id: 'structure-explorer', title: '结构探索馆', description: '看看物件里面有什么，动手理解工作原理。',
  subject: '结构与原理', recommendedAge: '儿童与成人', learningGoal: '观察结构、操作部件、理解工作原理',
  status: '可用', playLabel: '去探索', route: '?play=structure-explorer',
  mount(context) {
    let disposed = false;
    let clean: (() => void) | undefined;
    void import('./workbench').then(({ mountStructureExplorer }) => {
      if (!disposed) clean = mountStructureExplorer(context.container).destroy;
    });
    return { destroy() { disposed = true; clean?.(); } };
  },
};

import type { GameDefinition } from '../../packages/game-core';

export const englishStudy: GameDefinition = {
  id: 'english-study', title: '英语书房', description: '查常见词、听读音、看拼写与字母笔顺。',
  subject: '英语工具', recommendedAge: '儿童与成人', learningGoal: '查阅常见英语词义与字母书写顺序',
  status: '可用', playLabel: '查词与笔顺', route: '?play=english-study',
  mount(context) {
    let disposed = false;
    let clean: (() => void) | undefined;
    context.container.textContent = '正在打开英语书房……';
    void import('./workbench').then(({ mountEnglishStudy }) => {
      if (!disposed) clean = mountEnglishStudy(context.container).destroy;
    });
    return { destroy() { disposed = true; clean?.(); } };
  },
};

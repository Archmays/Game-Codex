import type { CompletionCheckpoint, PublishedEquationSliderLevel } from './types';
import { button, element, completionHeading, completionReflection } from './view-helpers';

export type TutorialStep = 'move-target' | 'coverage' | null;

/** Tutorial and completion controls belong to this board's lifetime, not its repaint. */
export function createBoardPanels(options: {
  level: PublishedEquationSliderLevel;
  signal: AbortSignal;
  skipTutorial: () => void;
  nextLevel: () => PublishedEquationSliderLevel | undefined;
  advance: () => void;
  replay: () => void;
}) {
  const { level, signal } = options;
  const tutorialPanel = element('aside', 'equation-slider__coach');
  const tutorialCopy = element('p');
  tutorialPanel.append(tutorialCopy, button('跳过教程', options.skipTutorial, 'ui-button ui-button--secondary', signal));
  const completionPanel = element('section', 'equation-slider__completion');
  completionPanel.hidden = true;
  const heading = element('h3');
  const reflection = element('p');
  const advance = button(options.nextLevel() ? '下一关' : '查看关卡列表', options.advance, 'ui-button', signal);
  completionPanel.append(
    element('span', 'equation-slider__completion-signal', '✓'), heading, reflection,
    advance, button('再玩一次', options.replay, 'ui-button ui-button--secondary', signal)
  );
  return {
    tutorialPanel, completionPanel,
    updateTutorial(step: TutorialStep, firstIndex: number) {
      tutorialPanel.hidden = step === null;
      if (step === null) { tutorialPanel.removeAttribute('data-tutorial-step'); return; }
      tutorialPanel.dataset.tutorialStep = step;
      tutorialCopy.textContent = step === 'move-target'
        ? firstIndex === 2
          ? '把右边滑轨上的 2 移到中央（可以直接点 2），让中央算式得到 6。'
          : '让中央两个数合起来是6，上方或下方的数字都可以试。'
        : '正确关系会点亮用到的数字。把六个数字都点亮。';
    },
    updateCompletion(complete: boolean, checkpoint: CompletionCheckpoint, moves: number, hints: number) {
      completionPanel.hidden = !complete;
      if (!complete) return;
      completionPanel.dataset.completionCard = 'true';
      completionPanel.dataset.checkpointKind = checkpoint.kind;
      heading.textContent = completionHeading(checkpoint);
      reflection.textContent = `${level.requiredTileIds.length} 个信号都已点亮，共移动 ${moves} 次，使用提示 ${hints} 次。${completionReflection(checkpoint, level)}`;
    }
  };
}

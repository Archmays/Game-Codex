import { ignoreGameKey, rovingGroup } from '../../packages/ui/input';
import type { Direction } from './rooms';

interface AdventureInputState {
  menuOpen: boolean; hasEntered: boolean; splitMode: boolean; placementMode: boolean;
  hintOpener: HTMLElement | null;
}

/** Decode input only; the page controller owns intentions and the model owns rules. */
export function bindAdventureInputs(options: {
  root: HTMLElement; shell: HTMLElement; grid: HTMLElement; settingsDialog: HTMLDialogElement;
  state: () => AdventureInputState;
  click: (event: MouseEvent) => void;
  trustedInput: (event: Event) => void;
  closeModal: () => void; closeMenu: () => void;
  chooseSplit: (side: 'left' | 'right', focus: boolean) => void;
  cancel: () => void;
  placement: (direction: Direction) => void;
  move: (direction: Direction, inspect: boolean) => void;
  primary: () => void; hint: () => void; switchActor: () => void;
  split: () => void; previewSplit: () => void; combine: () => void; undo: () => void;
}) {
  const { root, shell, grid, settingsDialog } = options;
  const el = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  let destroyed = false, moveStamp = 0;
  const directionRoving = rovingGroup(el('.hway-direction'), { items: 'button', columns: () => 4 });
  const keys = (event: KeyboardEvent) => {
    if (destroyed || settingsDialog.open) return;
    const { menuOpen, hasEntered, splitMode, placementMode, hintOpener } = options.state();
    const modal = !el('[data-hway-modal]').hidden ? el('[data-hway-modal]') : menuOpen ? el('[data-hway-menu]') : null;
    if (modal) {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { event.preventDefault(); if (modal === el('[data-hway-modal]')) options.closeModal(); else if (hasEntered) options.closeMenu(); }
      if (event.key === 'Tab') {
        const list = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => !b.closest('[hidden]'));
        const current = list.indexOf(document.activeElement as HTMLButtonElement);
        if (current < 0 || (event.shiftKey ? current === 0 : current === list.length-1)) { event.preventDefault(); list[event.shiftKey ? list.length-1 : 0]?.focus(); }
      }
      return;
    }
    if (!event.defaultPrevented && !event.isComposing && event.keyCode !== 229 && !event.ctrlKey && !event.altKey && !event.metaKey && (event.target as HTMLElement)?.dataset?.hwaySide && ['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault(); options.chooseSplit(event.key === 'ArrowLeft' ? 'left' : 'right', true); return;
    }
    if (ignoreGameKey(event, shell, true)) return;
    const key = event.key.toLowerCase(), inWorld = grid.contains(event.target as Node) || event.target === grid;
    if (key === 'escape') {
      event.preventDefault(); const closingHint = !el('[data-hway-hint-box]').hidden;
      options.cancel(); if (closingHint && hintOpener?.isConnected) hintOpener.focus({preventScroll:true}); return;
    }
    // Directions and shortcuts belong to the world; ordinary buttons retain navigation and scrolling.
    if (!inWorld) return;
    const direction = ({ arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' } as Record<string, Direction>)[key];
    if (splitMode) {
      if (['arrowleft','arrowright'].includes(key)) { event.preventDefault(); options.chooseSplit(key === 'arrowleft' ? 'left' : 'right', false); }
      else if (['enter',' ','e'].includes(key)) { event.preventDefault(); if (!event.repeat) options.split(); }
      return;
    }
    if (!el('[data-hway-hint-box]').hidden && key !== 'h' && key !== 'z') return;
    if (placementMode && direction) { event.preventDefault(); options.placement(direction); return; }
    if (direction) {
      event.preventDefault(); if (event.repeat && performance.now()-moveStamp < 170) return;
      moveStamp = performance.now(); options.move(direction, event.shiftKey);
    } else if (event.repeat) return;
    else if (key === 'e' || key === ' ') { event.preventDefault(); options.primary(); }
    else if (key === 'h') { event.preventDefault(); options.hint(); }
    else if (key === 'q') { event.preventDefault(); options.switchActor(); }
    else if (key === 'x') { event.preventDefault(); options.previewSplit(); }
    else if (key === 'c') { event.preventDefault(); options.combine(); }
    else if (key === 'z') { event.preventDefault(); options.undo(); }
  };
  window.addEventListener('keydown', keys);
  root.addEventListener('click', options.click);
  root.addEventListener('pointerup', options.trustedInput);
  root.addEventListener('keydown', options.trustedInput);
  return {
    reset() { moveStamp = 0; },
    destroy() {
      if (destroyed) return; destroyed = true;
      directionRoving.destroy(); window.removeEventListener('keydown', keys);
      root.removeEventListener('click', options.click);
      root.removeEventListener('pointerup', options.trustedInput);
      root.removeEventListener('keydown', options.trustedInput);
    }
  };
}

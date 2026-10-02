import { afterEach, expect, it, vi } from 'vitest';
import { bindDefenseInput } from '../games/hanzi-tower-defense/ui/input';
import type { DefenseContext } from '../games/hanzi-tower-defense/context';

vi.mock('../packages/ui/input', () => ({
  bindInputLifecycle: () => () => {},
  ignoreGameKey: () => false,
  rovingGroup: () => ({ refresh() {}, destroy() {} }),
}));
afterEach(() => vi.unstubAllGlobals());

it('native tower dragend binds the real cleanup before registering the DOM listener', () => {
  const handlers = new Map<string, EventListener>();
  const slot = { addEventListener: (type: string, handler: EventListener) => handlers.set(type, handler) };
  const root = { addEventListener() {}, removeEventListener() {} };
  vi.stubGlobal('document', root); vi.stubGlobal('window', root);
  const renderRanges = vi.fn();
  const ctx = {
    root, el: () => root, button: () => slot, SLOTS: [{}],
    draggedId: 7, hoveredSlot: 0, renderRanges,
    endDrag() { throw Error('Unbound input callback'); },
  } as unknown as DefenseContext;
  const unbind = bindDefenseInput(ctx);
  handlers.get('dragend')!(new Event('dragend'));
  expect(ctx.draggedId).toBeNull(); expect(ctx.hoveredSlot).toBeNull();
  expect(renderRanges).toHaveBeenCalledOnce();
  unbind();
});

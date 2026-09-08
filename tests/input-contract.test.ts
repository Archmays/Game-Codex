import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindInputLifecycle, ignoreGameKey, rovingGroup } from '../packages/ui/input';

class FakeElement extends EventTarget {
  tabIndex = 0;
  disabled = false;
  native = false;
  editable = false;
  children: FakeElement[] = [];
  closest(selector: string) {
    if (selector.startsWith('input')) return this.editable ? this : null;
    if (selector.startsWith('button')) return this.native ? this : null;
    return null;
  }
  matches(selector: string) { return selector === ':disabled' && this.disabled; }
  contains(target: unknown) { return target === this || this.children.includes(target as FakeElement); }
  querySelectorAll() { return this.children; }
  focus() { (document as unknown as { activeElement: FakeElement }).activeElement = this; }
}
function setup() {
  vi.stubGlobal('Element', FakeElement);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false, activeElement: null }));
  const root = new FakeElement(), target = new FakeElement(); root.children = [target];
  return { root: root as unknown as HTMLElement, target };
}
const key = (target: FakeElement, changes = {}) => ({ key: 'x', target, repeat: false, keyCode: 88, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, ...changes }) as unknown as KeyboardEvent;
function dispatch(root: HTMLElement, target: FakeElement, value: string) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, { target: { value: target }, key: { value } });
  root.dispatchEvent(event);
  return event;
}
afterEach(() => vi.unstubAllGlobals());
describe('shared input protection', () => {
  it('accepts only scoped non-editing, non-composing game shortcuts', () => {
    const { root, target } = setup();
    expect(ignoreGameKey(key(target), root)).toBe(false);
    for (const changes of [{ isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { defaultPrevented: true }]) expect(ignoreGameKey(key(target, changes), root)).toBe(true);
    target.editable = true; expect(ignoreGameKey(key(target), root)).toBe(true);
    expect(ignoreGameKey(key(new FakeElement()), root)).toBe(true);
  });
  it('leaves native Space/Enter to the focused button; repeat needs explicit permission', () => {
    const { root, target } = setup(); target.native = true;
    expect(ignoreGameKey(key(target, { key: ' ' }), root)).toBe(true);
    expect(ignoreGameKey(key(target, { key: 'Enter' }), root)).toBe(true);
    expect(ignoreGameKey(key(target, { key: 'ArrowRight', repeat: true }), root, true)).toBe(false);
  });
  it('clears held input on blur, hidden, pointercancel and teardown, then removes listeners', () => {
    const { root } = setup(); const reset = vi.fn(); const stop = bindInputLifecycle(root, reset);
    window.dispatchEvent(new Event('blur'));
    Object.assign(document, { hidden: true }); document.dispatchEvent(new Event('visibilitychange'));
    root.dispatchEvent(new Event('pointercancel'));
    expect(reset).toHaveBeenCalledTimes(3); stop(); expect(reset).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event('blur')); expect(reset).toHaveBeenCalledTimes(4);
  });
  it('keeps one tab stop, skips disabled cards without changing grid columns, and lets Tab leave', () => {
    const { root } = setup(); const all = Array.from({length: 8}, () => new FakeElement());
    (root as unknown as FakeElement).children = all; all[1].disabled = true;
    const group = rovingGroup(root, { items: 'button', columns: () => 4 });
    expect(all.map(x => x.tabIndex)).toEqual([0,-1,-1,-1,-1,-1,-1,-1]);
    dispatch(root, all[0], 'ArrowRight'); expect(document.activeElement).toBe(all[2]);
    dispatch(root, all[2], 'ArrowDown'); expect(document.activeElement).toBe(all[6]);
    dispatch(root, all[6], 'Home'); expect(document.activeElement).toBe(all[0]);
    expect(dispatch(root, all[0], 'Tab').defaultPrevented).toBe(false);
    group.destroy();
  });
});

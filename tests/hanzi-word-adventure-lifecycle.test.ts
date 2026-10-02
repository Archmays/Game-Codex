import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAdventureLifecycle } from '../games/hanzi-word-adventure/page-lifecycle';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const pageWindow = new EventTarget(), pageDocument = Object.assign(new EventTarget(), { hidden: false });
  const root = new EventTarget() as HTMLElement;
  vi.stubGlobal('window', pageWindow); vi.stubGlobal('document', pageDocument);
  const resetInput = vi.fn(), suspend = vi.fn(), resume = vi.fn(), persist = vi.fn(), destroy = vi.fn();
  const lifecycle = bindAdventureLifecycle({ root, resetInput, suspend, resume, persist, destroy: () => { destroy(); lifecycle.destroy(); } });
  const page = (type: string, persisted: boolean) => pageWindow.dispatchEvent(Object.assign(new Event(type), { persisted }));
  return { pageWindow, pageDocument, root, resetInput, suspend, resume, persist, destroy, lifecycle, page };
}
describe('adventure page lifecycle', () => {
  it('suspends transient work on hidden/BFCache and resumes only when shown', () => {
    const f = fixture(); f.pageDocument.hidden = true; f.pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(f.suspend).toHaveBeenCalledTimes(1); expect(f.resume).not.toHaveBeenCalled(); expect(f.resetInput).toHaveBeenCalled();
    f.page('pagehide', true); expect(f.persist).toHaveBeenCalledTimes(1); expect(f.destroy).not.toHaveBeenCalled();
    f.page('pageshow', true); expect(f.resume).not.toHaveBeenCalled();
    f.pageDocument.hidden = false; f.pageDocument.dispatchEvent(new Event('visibilitychange')); expect(f.resume).toHaveBeenCalledTimes(1);
    f.page('pageshow', false); expect(f.resume).toHaveBeenCalledTimes(1);
    f.page('pageshow', true); expect(f.resume).toHaveBeenCalledTimes(2);
    f.lifecycle.destroy();
  });
  it('clears input on blur/cancel and removes all page/input handlers exactly once on destroy', () => {
    const f = fixture(); f.pageWindow.dispatchEvent(new Event('blur')); f.root.dispatchEvent(new Event('pointercancel'));
    expect(f.resetInput).toHaveBeenCalledTimes(2);
    f.page('pagehide', false); expect(f.persist).toHaveBeenCalledTimes(1); expect(f.destroy).toHaveBeenCalledTimes(1);
    const counts = [f.resetInput.mock.calls.length, f.suspend.mock.calls.length, f.resume.mock.calls.length];
    f.lifecycle.destroy(); f.pageWindow.dispatchEvent(new Event('blur')); f.root.dispatchEvent(new Event('pointercancel'));
    f.pageDocument.dispatchEvent(new Event('visibilitychange')); f.page('pageshow', true); f.page('pagehide', false);
    expect([f.resetInput.mock.calls.length, f.suspend.mock.calls.length, f.resume.mock.calls.length]).toEqual(counts);
    expect(f.persist).toHaveBeenCalledTimes(1); expect(f.destroy).toHaveBeenCalledTimes(1);
  });
});

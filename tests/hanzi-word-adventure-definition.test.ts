import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountGameContext } from '../packages/game-core';
const mount = vi.hoisted(() => vi.fn());
vi.mock('../games/hanzi-word-adventure/index', () => ({ mountHanziWordAdventure: mount }));
import { hanziWordAdventureGame } from '../games/hanzi-word-adventure/definition';

class StubNode {
  textContent = ''; type = ''; onclick: (() => void) | null = null;
  children: StubNode[] = []; parent: StubNode | null = null;
  append(node: StubNode) { node.remove(); this.children.push(node); node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  setAttribute() {}
}
beforeEach(() => { mount.mockReset(); vi.stubGlobal('document', { createElement: () => new StubNode() }); });
afterEach(() => vi.unstubAllGlobals());
const context = () => ({ container: new StubNode(), onExit: vi.fn(), storage: {} } as unknown as MountGameContext);
describe('adventure lazy mount lifetime', () => {
  it('does not construct a runtime after its pending mount was destroyed', async () => {
    const c = context(), game = hanziWordAdventureGame.mount(c);
    game.destroy(); await vi.dynamicImportSettled();
    expect(mount).not.toHaveBeenCalled(); expect((c.container as unknown as StubNode).children).toHaveLength(0);
  });
  it('mounts once with the original exit action and disposes the completed mount exactly once', async () => {
    const c = context(), destroy = vi.fn(); mount.mockReturnValue({ destroy });
    const game = hanziWordAdventureGame.mount(c); await vi.dynamicImportSettled();
    expect(mount).toHaveBeenCalledExactlyOnceWith(c.container, c.onExit);
    game.destroy(); game.destroy(); expect(destroy).toHaveBeenCalledTimes(1);
  });
  it('keeps a visible actionable failure when runtime construction throws', async () => {
    const c = context(); mount.mockImplementation(() => { throw Error('renderer unavailable'); });
    const game = hanziWordAdventureGame.mount(c); await vi.dynamicImportSettled();
    const failure = (c.container as unknown as StubNode).children[0];
    expect(failure.textContent).toContain('暂时没能打开');
    failure.children[0].onclick?.(); expect(c.onExit).toHaveBeenCalledTimes(1);
    game.destroy(); expect((c.container as unknown as StubNode).children).toHaveLength(0);
  });
});

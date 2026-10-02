import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MountGameContext } from '../packages/game-core';
import { hanziTowerDefenseGame } from '../games/hanzi-tower-defense/definition';

const { mountDefense } = vi.hoisted(() => ({ mountDefense: vi.fn() }));
vi.mock('../games/hanzi-tower-defense/coordinator', () => ({ mountDefense }));
afterEach(() => { vi.unstubAllGlobals(); mountDefense.mockReset(); });

function catalogueContext() {
  vi.stubGlobal('document', { createElement: () => ({ setAttribute: vi.fn(), textContent: '', type: '', onclick: undefined }) });
  return { container: { replaceChildren: vi.fn() }, onExit: vi.fn(), storage: {} } as unknown as MountGameContext;
}

const source = (path: string) => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
function runtimeImports(path: string) {
  return source(path).statements.filter(ts.isImportDeclaration)
    .filter(node => !node.importClause?.isTypeOnly)
    .map(node => (node.moduleSpecifier as ts.StringLiteral).text);
}

describe('tower catalogue and runtime responsibility boundaries', () => {
  it('exposes the established entry without importing the battle engine at catalogue load', () => {
    expect(hanziTowerDefenseGame.id).toBe('hanzi-tower-defense');
    expect(hanziTowerDefenseGame.route).toBe('?play=hanzi-tower-defense&from=hub');
    expect(runtimeImports('games/hanzi-tower-defense/definition.ts')).toEqual([]);
  });

  it('cannot mount after the catalogue loading handle has been destroyed', async () => {
    const context = catalogueContext();
    const loading = hanziTowerDefenseGame.mount(context);
    loading.destroy();
    await vi.dynamicImportSettled();
    expect(mountDefense).not.toHaveBeenCalled();
  });

  it('forwards the current container and exit callback, then destroys the loaded game', async () => {
    const context = catalogueContext(), destroy = vi.fn();
    mountDefense.mockReturnValue({ destroy });
    const loading = hanziTowerDefenseGame.mount(context);
    await vi.dynamicImportSettled();
    expect(mountDefense).toHaveBeenCalledWith(context.container, context.onExit);
    loading.destroy();
    loading.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('offers retry and return when loading fails without exposing internal errors', async () => {
    const context = catalogueContext();
    mountDefense.mockImplementation(() => { throw Error('internal loader detail'); });
    const loading = hanziTowerDefenseGame.mount(context);
    await vi.dynamicImportSettled();
    const [status, retry, back] = vi.mocked(context.container.replaceChildren).mock.calls.at(-1)! as unknown as { textContent: string; onclick: () => void }[];
    expect(status.textContent).toContain('重试');
    expect(status.textContent).not.toContain('internal');
    expect(retry.textContent).toBe('重新载入');
    expect(back.onclick).toBe(context.onExit);
    loading.destroy();
  });
});

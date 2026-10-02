import { resolve } from 'node:path';
import { loadGameCatalogMetadata } from '../tools/portfolio/load-game-catalog-metadata';

const files = vi.hoisted(() => new Map<string, string>());
vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs,
    existsSync: (path: string) => files.has(String(path)) || fs.existsSync(path),
    readFileSync: (path: string, encoding: 'utf8') => files.get(String(path)) ?? fs.readFileSync(path, encoding),
  };
});
afterEach(() => files.clear());
it('loads aliased named definitions from lightweight files without executing their module', () => {
  const root = resolve('synthetic-catalog-root');
  files.set(resolve(root, 'packages/data/gameCatalog.ts'), `import { sourceGame as displayAlias } from '../../games/example/definition'; export const allGameDefinitions = [displayAlias];`);
  files.set(resolve(root, 'games/example/definition.ts'), `throw new Error('Never execute metadata modules'); export const sourceGame = { id:'example', title:'标题', description:'说明', subject:'学科', recommendedAge:'年龄', learningGoal:'目标', status:'状态', mount() { throw Error('never'); } };`);
  expect(loadGameCatalogMetadata(root)).toEqual([{ id: 'example', title: '标题', description: '说明', subject: '学科', recommendedAge: '年龄', learningGoal: '目标', status: '状态', playLabel: undefined, route: undefined }]);
});

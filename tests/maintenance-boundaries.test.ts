import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MY_GAME_WORLD_SETTINGS_KEY, readWorldHomeState, updateWorldSettings } from '../packages/preferences/world-home';
import * as compatibility from '../apps/my-game-world/world-state';

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(join(root, entry.name)) : entry.name.endsWith('.ts') ? [join(root, entry.name)] : []);
}
it('games and lower-level packages have no upward runtime import into apps', () => {
  for (const path of [...sourceFiles('games'), ...sourceFiles('packages')]) {
    expect(readFileSync(path, 'utf8'), path).not.toMatch(/(?:from\s*|import\s*\()\s*['"][^'"]*\/apps\//);
  }
});
it('shared preferences retain the exact home key, compatibility API and protected-byte guard', () => {
  expect(compatibility.readWorldHomeState).toBe(readWorldHomeState);
  expect(compatibility.updateWorldSettings).toBe(updateWorldSettings);
  expect(MY_GAME_WORLD_SETTINGS_KEY).toBe('family-games/my-game-world/v1');
  let raw = '{ "version":1, "settings":{"muted":true,"reducedMotion":true}, "extension":"keep" }';
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const current = readWorldHomeState(storage);
  expect(current.settings).toEqual({ muted: true, reducedMotion: true });
  const updated = updateWorldSettings(storage, current, { muted: false });
  expect(updated.ok).toBe(true);
  expect(JSON.parse(raw)).toEqual({ version: 1, settings: { muted: false, reducedMotion: true }, extension: 'keep' });
  raw = '{"version":99}';
  expect(updateWorldSettings(storage, updated.state, { muted: true }).ok).toBe(false);
  expect(raw).toBe('{"version":99}');
});

import { readFileSync } from 'node:fs';
import { LETTER_STROKES, strokeStart, strokesFor } from '../games/english-study/letter-strokes';
import { displayWord, parseLookup, Shelf, spellingLetters, STORAGE_KEY, WORDS, WORD_BY_KEY } from '../games/english-study/model';
import { GAME_PORTFOLIO } from '../packages/data/gamePortfolio';
import { pageModeForSearch, resolveAppRoute } from '../src/app-route';

describe('English Study content and state', () => {
  it('keeps the local bilingual word set source bound', () => {
    const source = JSON.parse(readFileSync('docs/english-v2/release/WORD-GRAPH.json', 'utf8')) as {
      words: { lemma: string; childGlossZh: string; childDefinitionEn: string; partOfSpeech: string }[];
    };
    expect(WORDS.length).toBeGreaterThanOrEqual(10000);
    expect(new Set(WORDS.map(row => row.word)).size).toBe(WORDS.length);
    expect(WORDS.filter(row => row.source === 'curated')).toHaveLength(48);
    for (const row of WORDS.filter(row => row.source === 'curated')) {
      const original = source.words.find(word => word.lemma === row.word);
      expect(row.zh).toBe(original?.childGlossZh);
      expect(row.definition).toBe(original?.childDefinitionEn);
      expect(row.partOfSpeech).toBe(original?.partOfSpeech);
      expect(row.word).toMatch(/^[a-z]+$/);
    }
  });

  it('supports repeated English words, Chinese lookup, honest unknowns and limits', () => {
    expect(parseLookup('Cat dog CAT').words).toEqual(['cat', 'dog', 'cat']);
    expect(parseLookup('猫').words).toContain('cat');
    expect(parseLookup('apple').words).toEqual(['apple']);
    expect(displayWord('i')).toBe('I');
    expect(spellingLetters('i')).toEqual(['I']);
    expect(WORD_BY_KEY.get('computer')?.source).toBe('ecdict');
    expect(WORD_BY_KEY.has('unicorn')).toBe(false);
    expect(parseLookup('x '.repeat(13)).valid).toBe(false);
    expect(parseLookup('a'.repeat(121)).valid).toBe(false);
    expect(parseLookup('!?').valid).toBe(false);
  });

  it('contains real ordered paths for all 52 letter forms', () => {
    expect(Object.keys(LETTER_STROKES).sort()).toEqual([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].sort());
    for (const letter of Object.keys(LETTER_STROKES)) {
      const paths = strokesFor(letter);
      expect(paths.length, letter).toBeGreaterThan(0);
      expect(paths.length, letter).toBeLessThanOrEqual(3);
      for (const path of paths) {
        const [x, y] = strokeStart(path);
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(120);
        expect(path).toMatch(/^M\d+ \d+ [CLZ]/);
      }
    }
    expect(strokesFor('A')).toHaveLength(2);
    expect(strokesFor('a')).toHaveLength(2);
  });

  it('stores only curated words, preserving bad and concurrently restored records', () => {
    const map = new Map<string, string>([['legacy', 'sentinel']]);
    const shelf = new Shelf({ getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } });
    shelf.visit('cat'); shelf.visit('unicorn'); shelf.favorite('dog'); shelf.favorite('unicorn');
    expect(shelf.state).toEqual({ version: 1, recent: ['cat'], favorites: ['dog'] });
    expect([...map.keys()].sort()).toEqual(['legacy', STORAGE_KEY].sort());
    const restored = '{ "version":1,"recent":["water"],"favorites":[] }';
    map.set(STORAGE_KEY, restored);
    shelf.visit('fish');
    expect(map.get(STORAGE_KEY)).toBe(restored);
    expect(shelf.writable).toBe(false);
    for (const raw of ['{bad', '{"version":2,"recent":[],"favorites":[]}', '{"version":1,"recent":["unicorn"],"favorites":[]}']) {
      const copy = new Map([[STORAGE_KEY, raw]]);
      const blocked = new Shelf({ getItem: key => copy.get(key) ?? null, setItem: (key, value) => { copy.set(key, value); } });
      blocked.visit('cat');
      expect(copy.get(STORAGE_KEY)).toBe(raw);
    }
  });

  it('registers an independent lazy tool without restoring the retired English world', () => {
    expect(GAME_PORTFOLIO.find(row => row.id === 'english-study')).toMatchObject({
      targetWorld: 'english', definitionRole: 'independent-tool', activeChildProduct: false, classicCardVisible: false, loadingPolicy: 'route-lazy',
    });
    expect(resolveAppRoute(new URLSearchParams('play=english-study&world=english-world')).kind).toBe('play');
    expect(pageModeForSearch(new URLSearchParams('play=english-study'))).toBe('game-scrollable');
  });
});

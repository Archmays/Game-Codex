import { readFileSync } from 'node:fs';
import { GLYPH_STROKES, GUIDE_LINES, LETTER_STROKES, glyphMetrics, layoutWord, strokeStart, strokesFor } from '../games/english-study/letter-strokes';
import { displayWord, lookupKey, parseLookup, Shelf, spellingLetters, STORAGE_KEY, WORDS, WORD_BY_KEY } from '../games/english-study/model';
import { strokeDuration, WritingPlayer } from '../games/english-study/writing-player';
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
    expect(parseLookup('Cat dog CAT').words).toEqual(['Cat', 'dog', 'CAT']);
    expect(parseLookup('猫').words).toContain('cat');
    expect(parseLookup('apple').words).toEqual(['apple']);
    expect(displayWord('i')).toBe('I');
    expect(spellingLetters('i')).toEqual(['I']);
    expect(parseLookup("  can't  don’t ice-cream  ").words).toEqual(["can't", 'don’t', 'ice-cream']);
    expect(spellingLetters("can't")).toEqual(['c', 'a', 'n', "'", 't']);
    expect(lookupKey('Apple')).toBe('apple');
    expect(lookupKey('don’t')).toBe("don't");
    expect(parseLookup('Apple CAT I apple').words).toEqual(['Apple', 'CAT', 'I', 'apple']);
    expect(WORD_BY_KEY.get('computer')?.source).toBe('ecdict');
    expect(WORD_BY_KEY.has('unicorn')).toBe(false);
    expect(parseLookup('x '.repeat(13)).valid).toBe(false);
    expect(parseLookup('a'.repeat(121)).valid).toBe(false);
    expect(parseLookup('!?').valid).toBe(false);
    expect(parseLookup('cat@dog').valid).toBe(false);
    expect(parseLookup('cat-').valid).toBe(false);
  });

  it('lays out all 52 inspected manuscript forms on one four-line grid', () => {
    expect(Object.keys(LETTER_STROKES).sort()).toEqual([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].sort());
    expect(GUIDE_LINES).toEqual([20, 48, 94, 112]);
    for (const letter of Object.keys(LETTER_STROKES)) {
      const paths = strokesFor(letter);
      expect(paths.length, letter).toBeGreaterThan(0);
      const metrics = glyphMetrics(letter);
      expect(metrics.advance, letter).toBeGreaterThanOrEqual(metrics.inkRight - metrics.inkLeft + 12);
      for (const path of paths) {
        const [x, y] = strokeStart(path);
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(120);
        expect(path).toMatch(/^M\d+ \d+ [CLZ]/);
      }
    }
    expect(Object.keys(GLYPH_STROKES)).toHaveLength(55);
    expect(glyphMetrics('i').advance).toBeLessThan(glyphMetrics('m').advance / 2);
    expect(glyphMetrics('l').advance).toBeLessThan(glyphMetrics('w').advance / 2);
    const apple = layoutWord('apple');
    expect(apple.instances.map(item => item.char)).toEqual(['a', 'p', 'p', 'l', 'e']);
    expect(apple.instances[1].index).toBe(1); expect(apple.instances[2].index).toBe(2);
    expect(apple.instances[2].x - apple.instances[1].x).toBe(apple.instances[1].metrics.advance);
    expect(apple.width).toBeGreaterThan(280); expect(apple.width).toBeLessThan(390);
    expect(layoutWord("can't").instances).toHaveLength(5);
    expect(layoutWord('ice-cream').instances).toHaveLength(9);
    expect(() => layoutWord('cat@')).toThrow('Unsupported');
  });

  it('keeps fractional writing state through pause, speed changes, steps and disposal', () => {
    const strokes = [{ charIndex: 0, length: 140, dot: false }, { charIndex: 0, length: 1, dot: true }, { charIndex: 1, length: 100, dot: false }];
    const player = new WritingPlayer(strokes);
    player.play(); player.advance(300 + strokeDuration(strokes[0]) * 0.3);
    expect(player.stage).toBe('stroke'); expect(player.strokeIndex).toBe(0);
    expect(player.fraction).toBeCloseTo(0.3, 2);
    player.pause(); const held = player.fraction; player.advance(2000); expect(player.fraction).toBe(held);
    player.setSpeed('fast'); player.play(); player.advance(100);
    expect(player.fraction).toBeGreaterThan(held);
    player.previous(); expect(player.fraction).toBe(0); expect(player.strokeIndex).toBe(0);
    player.next(); expect(player.strokeIndex).toBe(1); expect(player.status).toBe('paused');
    player.next(); expect(player.strokeIndex).toBe(2);
    player.previous(); expect(player.strokeIndex).toBe(1);
    player.showAll(); expect(player.status).toBe('completed'); expect(player.strokeIndex).toBe(3);
    player.replay(); expect(player.status).toBe('playing'); expect(player.strokeIndex).toBe(0);
    player.dispose(); const index = player.strokeIndex; player.advance(10000); expect(player.strokeIndex).toBe(index);
    expect(strokeDuration(strokes[1])).toBe(300);
    expect(strokeDuration(strokes[0])).toBeGreaterThan(strokeDuration({ charIndex: 0, length: 20, dot: false }));
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

import words from './words.json';

export interface WordEntry {
  word: string;
  zh: string;
  definition: string;
  partOfSpeech: string;
  example: string;
  exampleZh: string;
  phonetic: string;
  rank: number;
  source: 'curated' | 'ecdict';
}

export const WORDS = words as WordEntry[];
export const WORD_BY_KEY = new Map(WORDS.map(row => [row.word, row]));
export const STORAGE_KEY = 'family-games/english-study/v1';
export const STARTER_WORDS = ['cat', 'dog', 'book', 'apple', 'run', 'red', 'one', 'water'];
export const displayWord = (word: string): string => word === 'i' ? 'I' : word;
export const spellingLetters = (word: string): string[] => [...displayWord(word)].filter(letter => /^[a-z]$/i.test(letter));

export interface LookupResult { words: string[]; message: string; valid: boolean; }

export function parseLookup(raw: string): LookupResult {
  const input = raw.trim();
  if (!input) return { words: [], message: '输入英语单词，或输入中文意思查找已收录的词。', valid: false };
  if ([...input].length > 120) return { words: [], message: '一次最多输入 120 个字符，请分次查找。', valid: false };
  if (/\p{Script=Han}/u.test(input)) {
    const matches = WORDS.filter(row => row.zh.includes(input) || row.exampleZh.includes(input)).map(row => row.word).slice(0, 24);
    return { words: matches, message: matches.length ? `找到 ${matches.length} 个相关词；中文查找只覆盖本地词库。` : '本地词库里暂时没有这个中文意思。', valid: matches.length > 0 };
  }
  const tokens = input.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g)?.map(word => word.toLowerCase()) ?? [];
  if (!tokens.length) return { words: [], message: '请输入英语字母或中文意思。', valid: false };
  if (tokens.length > 12) return { words: [], message: '一次最多查 12 个英语词，请分次查找。', valid: false };
  if (tokens.some(word => word.length > 32)) return { words: [], message: '一个词最多输入 32 个字母，请检查拼写。', valid: false };
  return { words: tokens, message: `${tokens.length} 个词，按输入顺序排列；重复词保留。未收录的词仍可看字母写法。`, valid: true };
}

export interface ShelfState { version: 1; recent: string[]; favorites: string[]; }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; }
const emptyShelf = (): ShelfState => ({ version: 1, recent: [], favorites: [] });

export class Shelf {
  state = emptyShelf();
  notice = '';
  writable = true;
  private storedRaw: string | null = null;

  constructor(private storage: StoragePort) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      this.storedRaw = raw;
      if (raw === null) return;
      const value: unknown = JSON.parse(raw);
      const itemList = (items: unknown, limit: number): items is string[] =>
        Array.isArray(items) && items.length <= limit && items.every(item => typeof item === 'string' && WORD_BY_KEY.has(item));
      const v = value as ShelfState;
      if (!v || v.version !== 1 || !itemList(v.recent, 24) || !itemList(v.favorites, 128)) throw Error('unknown shelf format');
      this.state = { version: 1, recent: [...v.recent], favorites: [...v.favorites] };
    } catch {
      this.writable = false;
      this.notice = '本地书架暂不可读，原记录已保留；这次查词仍可继续。';
    }
  }

  private save(): void {
    if (!this.writable) return;
    try {
      if (this.storage.getItem(STORAGE_KEY) !== this.storedRaw) {
        this.writable = false;
        this.notice = '本地书架已在另一页更新。请刷新查看；本页不会覆盖它。';
        return;
      }
      const raw = JSON.stringify(this.state);
      this.storage.setItem(STORAGE_KEY, raw);
      this.storedRaw = raw;
    } catch {
      this.writable = false;
      this.notice = '暂时无法保存；这次更改只在当前页面有效。';
    }
  }

  visit(word: string): void {
    if (!WORD_BY_KEY.has(word)) return;
    this.state.recent = [word, ...this.state.recent.filter(item => item !== word)].slice(0, 24);
    this.save();
  }

  favorite(word: string): void {
    if (!WORD_BY_KEY.has(word)) return;
    if (this.state.favorites.includes(word)) this.state.favorites = this.state.favorites.filter(item => item !== word);
    else if (this.state.favorites.length < 128) this.state.favorites = [...this.state.favorites, word];
    else { this.notice = '收藏已满，请先移除一些词。'; return; }
    this.save();
  }
}

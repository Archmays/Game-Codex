/** Presentation only. Never migrates or rewrites a game checkpoint. */
export const PRESENTATION_KEY = 'family-games/presentation/v1';
export const PRODUCT_VERSION = '1.0.0';
export type Product = 'tower' | 'adventure';
export interface Presentation {
  music: number; effects: number; muted: boolean; lowPerformance: boolean; guideSeen: boolean; lastContent: string;
}
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const defaults = (): Presentation => ({ music: .28, effects: .65, muted: false, lowPerformance: false, guideSeen: false, lastContent: '' });
const valid = (v: unknown): v is Presentation => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Presentation;
  return [p.music, p.effects].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && typeof p.muted === 'boolean' && typeof p.lowPerformance === 'boolean' && typeof p.guideSeen === 'boolean'
    && typeof p.lastContent === 'string' && /^[a-z0-9-]{0,64}$/.test(p.lastContent);
};
export function openPresentation(storage: Store, product: Product) {
  let raw: string | null = null, writable = true;
  let data = { version: 1, tower: defaults(), adventure: defaults() };
  try {
    raw = storage.getItem(PRESENTATION_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !valid(parsed.tower) || !valid(parsed.adventure)) writable = false;
      else data = parsed;
    }
  } catch { writable = false; }
  const value = { ...data[product] };
  return { value, get writable() { return writable; }, write(): boolean {
    if (!writable || !valid(value)) return false;
    try {
      if (storage.getItem(PRESENTATION_KEY) !== raw) { writable = false; return false; }
      const next = JSON.stringify({ ...data, [product]: { ...value } });
      storage.setItem(PRESENTATION_KEY, next); raw = next; return true;
    } catch { writable = false; return false; }
  } };
}

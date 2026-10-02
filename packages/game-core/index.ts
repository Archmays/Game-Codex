export interface MountedGame {
  destroy: () => void;
}

export interface MountGameContext {
  container: HTMLElement;
  onExit: () => void;
  storage: LocalStorageStore;
}

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  subject: string;
  recommendedAge: string;
  learningGoal: string;
  status: string;
  playLabel?: string;
  /** Optional canonical full-page route for games whose runtime owns its canvas shell. */
  route?: string;
  mount: (context: MountGameContext) => MountedGame;
}

export interface LocalStorageStore {
  get: <T>(key: string, fallback: T) => T;
  set: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export function pickRoundItems<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  return shuffleItems(items, random).slice(0, Math.min(count, items.length));
}

/** Namespace adapter only: game-specific schema validation stays with each game.
 * No destructive capability probe; failures are contained at the actual operation.
 */
export function createLocalStorageStore(namespace: string): LocalStorageStore {
  const prefix = `family-games/${namespace}/`;
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = localStorage.getItem(`${prefix}${key}`);
        return raw === null ? fallback : JSON.parse(raw) as T;
      } catch { return fallback; }
    },
    set<T>(key: string, value: T): void {
      try { localStorage.setItem(`${prefix}${key}`, JSON.stringify(value)); }
      catch { /* Optional persistence must not interrupt play. */ }
    },
    remove(key: string): void {
      try { localStorage.removeItem(`${prefix}${key}`); }
      catch { /* Leave inaccessible bytes untouched. */ }
    },
    clear(): void {
      try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (key?.startsWith(prefix)) localStorage.removeItem(key);
        }
      } catch { /* A failed removal ends this namespace-only operation. */ }
    }
  };
}

function shuffleItems<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

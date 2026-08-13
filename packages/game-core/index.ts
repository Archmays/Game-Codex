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

export function createLocalStorageStore(namespace: string): LocalStorageStore {
  const prefix = `family-games/${namespace}/`;

  return {
    get<T>(key: string, fallback: T): T {
      if (!canUseLocalStorage()) {
        return fallback;
      }

      const raw = localStorage.getItem(`${prefix}${key}`);
      if (!raw) {
        return fallback;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      if (canUseLocalStorage()) {
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
      }
    },
    remove(key: string): void {
      if (canUseLocalStorage()) {
        localStorage.removeItem(`${prefix}${key}`);
      }
    },
    clear(): void {
      if (!canUseLocalStorage()) {
        return;
      }

      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    }
  };
}

function canUseLocalStorage(): boolean {
  try {
    const key = "family-games/storage-test";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function shuffleItems<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

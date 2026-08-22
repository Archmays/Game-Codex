import { GAME_PORTFOLIO } from "./gamePortfolio";

export type SaveKeyOwner = "portfolio" | "hanzi" | "math" | "english" | "shared" | "legacy" | "vault";

export interface KnownSaveKey {
  readonly key: string;
  readonly owner: SaveKeyOwner;
  readonly purpose: "progress" | "settings" | "backup" | "recovery" | "migration" | "compatibility" | "vault-internal";
  readonly exportable: boolean;
  readonly maxVersion?: number;
}

export const SAVE_VAULT_PRE_IMPORT_BACKUP_KEY = "save-vault/pre-import-backup/v1";

export const KNOWN_SAVE_KEYS: readonly KnownSaveKey[] = [
  { key: "family-games/my-game-world/v1", owner: "portfolio", purpose: "settings", exportable: true, maxVersion: 1 },
  { key: "family-games/hanzi-magic-complete/v3", owner: "hanzi", purpose: "progress", exportable: true, maxVersion: 3 },
  { key: "family-games/hanzi-magic-complete/v3.backup", owner: "hanzi", purpose: "backup", exportable: true, maxVersion: 3 },
  { key: "family-games/hanzi-magic-complete/v3.recovery", owner: "hanzi", purpose: "recovery", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-content-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-slice-v1-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-v1-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-v2-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-v2-session-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-complete/v3.migration-wheel-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-v2/chapter-one/preferences", owner: "hanzi", purpose: "settings", exportable: true },
  { key: "family-games/hanzi-magic-v2/chapter-one/m1-session", owner: "hanzi", purpose: "compatibility", exportable: true },
  { key: "family-games/hanzi-magic-v2/chapter-one/m3-session", owner: "hanzi", purpose: "compatibility", exportable: true },
  { key: "family-games/hanzi-magic-v2/chapter-one/save-v5", owner: "hanzi", purpose: "compatibility", exportable: true, maxVersion: 5 },
  { key: "family-games/hanzi-magic-v2/chapter-one/save-v5.backup", owner: "hanzi", purpose: "backup", exportable: true, maxVersion: 5 },
  { key: "family-games/hanzi-magic-v2/chapter-one/save-v5.recovery", owner: "hanzi", purpose: "recovery", exportable: true },
  { key: "family-games/hanzi-magic-v2/chapter-one/save-v5.migration-v1-raw", owner: "hanzi", purpose: "migration", exportable: true },
  { key: "family-games/hanzi-magic-v2/wheel-workshop/v1", owner: "hanzi", purpose: "compatibility", exportable: true, maxVersion: 1 },
  { key: "family-games/hanzi-radical-battle-v2/golden-slice/state", owner: "hanzi", purpose: "compatibility", exportable: true },
  { key: "family-games/hanzi-radical-battle-v2/golden-slice/state.backup", owner: "hanzi", purpose: "backup", exportable: true },
  { key: "family-games/hanzi-radical-battle-v2/golden-slice/state.recovery", owner: "hanzi", purpose: "recovery", exportable: true },
  { key: "family-games/hanzi-radical-battle-v2/golden-slice/audio-settings", owner: "hanzi", purpose: "settings", exportable: true },
  { key: "family-games/hanzi-radical-battle-v2-pilot/state", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: "family-games/chinese-support/pinyin/v1", owner: "hanzi", purpose: "progress", exportable: true, maxVersion: 1 },
  { key: "family-games/pinyin-magic-battle/progress", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: "family-games/math-world/v1", owner: "math", purpose: "progress", exportable: true, maxVersion: 1 },
  { key: "math-battle-web/save-v1", owner: "math", purpose: "progress", exportable: true, maxVersion: 1 },
  { key: "family-games/equation-slider/progress-v3", owner: "math", purpose: "progress", exportable: true, maxVersion: 3 },
  { key: "family-games/equation-slider/progress", owner: "legacy", purpose: "compatibility", exportable: true, maxVersion: 1 },
  { key: "family-games/make-target/progress", owner: "math", purpose: "progress", exportable: true },
  { key: "family-games/clock-reader/progress", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: "family-games/multiplication-adventure/progress", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: "family-games/english-world/v2", owner: "english", purpose: "progress", exportable: true, maxVersion: 2 },
  { key: "family-games/english-spell-battle/progress", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: "family-games/memory-match/v1", owner: "shared", purpose: "progress", exportable: true, maxVersion: 1 },
  { key: "family-games/memory-card/progress", owner: "legacy", purpose: "compatibility", exportable: true },
  { key: SAVE_VAULT_PRE_IMPORT_BACKUP_KEY, owner: "vault", purpose: "vault-internal", exportable: false, maxVersion: 1 },
] as const;

export const EXPORTABLE_SAVE_KEYS = KNOWN_SAVE_KEYS.filter((record) => record.exportable);
export const KNOWN_SAVE_KEY_BY_NAME: ReadonlyMap<string, KnownSaveKey> = new Map(KNOWN_SAVE_KEYS.map((record) => [record.key, record]));

export function portfolioNamespacesWithoutKnownKey(): string[] {
  return GAME_PORTFOLIO.flatMap((record) => record.saveNamespaces).filter((namespace) =>
    !KNOWN_SAVE_KEYS.some((entry) => entry.key === namespace || entry.key.startsWith(`${namespace}/`) || entry.key.startsWith(`${namespace}.`)),
  );
}

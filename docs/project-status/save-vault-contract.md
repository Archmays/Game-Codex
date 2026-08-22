# Parent Save Vault contract

Parent Save Vault is a local, parent-facing recovery tool for Game-Codex progress. It does not upload data, create an account, identify a child, or inspect arbitrary browser storage.

## Export

- Format: `game-codex-save-vault`, schema version `1`.
- The export contains only exact keys declared by `packages/data/saveKeyInventory.ts` as exportable.
- Values remain their original UTF-8 strings; per-game data is not normalized or downgraded.
- Every entry has a byte count and SHA-256. A canonical manifest SHA-256 covers the sorted entries.
- The file name contains only the export date. The size limit is 5 MiB; each entry is limited to 1 MiB.

## Preview and restore

- Parsing, format checks, size checks, key-safety checks, entry checksums, and the manifest checksum happen before any write.
- Unknown keys are displayed and skipped. They cannot be imported in this version.
- A known future-version game save may be restored byte-for-byte. The owning game remains responsible for its own future-read-only behavior.
- Before restore, the exact current values that may be overwritten are written to `save-vault/pre-import-backup/v1` and read back.
- Restored values are read back. A failed write or readback triggers rollback to the pre-import values.

## Clear all Game-Codex progress

- The control remains disabled until a backup was successfully exported in the same open panel.
- A parent confirmation is required.
- Only the exact current exportable-key inventory is removed and verified; `localStorage.clear()` is forbidden.
- Unknown keys, other localhost applications, browser settings, and the rollback snapshot are not removed.

This contract protects local bytes and technical recoverability. It does not claim real-child enjoyment, learning, retention, or acceptance.

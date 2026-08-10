# Retention and cleanup

## Retention tiers

- `T0_CANONICAL`: final source-bound verdicts, reports, baselines, manifests, freezes, and proofs needed to reproduce acceptance.
- `T1_RETURN_PACKAGE`: the concise delivery set required by the user, excluding raw sensitive or redundant evidence.
- `T2_HISTORY_ARCHIVE`: compact lineage and hashes that explain superseded or deleted evidence without retaining every raw trace.
- `T3_TRANSIENT_DELETE`: build output, reports, logs, failed-round screenshots/traces, obsolete candidates, duplicate archives, and staging files that an explicit cleanup allowlist may remove.
- `T4_PROTECTED_HUMAN`: authorizations, parent feedback, real-child raw observation records, and immutable evidence hashes. Never delete these through routine machine cleanup.

## Extract, archive, delete

Before deleting history or transient evidence, extract reusable process knowledge into the Skill and preserve a compact archive index. For every raw artifact not retained, record its original path, SHA-256, deletion reason, and finding/lineage relation. An archive index is not permission to include private media or PII in a return package.

## Plan, apply, verify

Cleanup is a three-command transaction:

1. `plan` inventories canonical, package, history, transient, and protected paths and resolves exact deletion targets.
2. `apply` accepts only the plan's explicit allowlist, validates contained absolute paths and current hashes, and deletes after required archives and the return package exist.
3. `verify` proves canonical and protected inventories, package identity, selected-asset inventory, source/commit cleanliness, and absence of duplicate large transient roots.

Do not use broad globs as deletion authority. Never target the workspace root, home directory, an unresolved environment variable, or a protected path.

## Phase boundaries

A blocked phase keeps the diagnostic evidence needed to understand and resume the blocker; it does not clean early merely to look finished. After a final return ZIP has been created and verified, delete only manifest-authorized transient working copies. Preserve the ZIP and its SHA-256, then verify they are unchanged after cleanup.

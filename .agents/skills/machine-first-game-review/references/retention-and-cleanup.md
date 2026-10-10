# Retention and cleanup

Use this formal retention route only when an authorized release, requested handoff or explicit maintenance task requires manifests/packages. Ordinary work retains the final source, needed assets and minimal unresolved information; it does not create tiers, archives or a return ZIP by default. Task-created scratch is handled under root `AGENTS.md`: verify exact paths and dependencies and move eligible temporary files to the Windows Recycle Bin. This reference never authorizes permanent deletion, emptying the Recycle Bin or cleaning historical files outside the task.

## Retention tiers

- `T0_CANONICAL`: final source-bound verdicts, reports, baselines, manifests, freezes, and proofs needed to reproduce acceptance.
- `T1_RETURN_PACKAGE`: the concise delivery set required by the user, excluding raw sensitive or redundant evidence.
- `T2_HISTORY_ARCHIVE`: compact lineage and hashes that explain superseded or deleted evidence without retaining every raw trace.
- `T3_TRANSIENT_DELETE`: task-created build output, reports, logs, failed-round screenshots/traces, obsolete candidates, duplicate archives, and staging files eligible for authorized recycling; the label does not authorize permanent deletion.
- `T4_PROTECTED_HUMAN`: authorizations, parent feedback, real-child raw observation records, and immutable evidence hashes. Never delete these through routine machine cleanup.

## Extract, archive, delete

When the formal route requires historical evidence cleanup, retain its required compact lineage before recycling explicitly authorized artifacts. Ordinary reproducible task scratch does not require a new Skill update, archive index or per-file hash record. An archive index is not permission to include private media or PII in a return package.

## Plan, apply, verify

Cleanup is a three-command transaction:

1. `plan` inventories canonical, package, history, transient, and protected paths and resolves exact deletion targets.
2. `apply` accepts only the plan's explicit allowlist, validates contained absolute paths and required current hashes, and moves eligible files to the Windows Recycle Bin after required archives and any requested return package exist.
3. `verify` proves canonical and protected inventories, package identity, selected-asset inventory, source/commit cleanliness, and absence of duplicate large transient roots.

Do not use broad globs as deletion authority. Never target the workspace root, home directory, an unresolved environment variable, or a protected path.

## Phase boundaries

A blocked phase keeps the diagnostic evidence needed to understand and resume the blocker; it does not clean early merely to look finished. When a final return ZIP is required, verify it before recycling only manifest-authorized transient working copies. Preserve the ZIP and its SHA-256, then verify they are unchanged after cleanup.

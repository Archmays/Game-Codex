# Theme C asset seed queue

This queue is review-only. It never blocks the procedural Theme C runtime.

| Prompt ID | Category | Requested candidates | State | Runtime use |
|---|---|---:|---|---|
| C-MAGE-01 | 墨灵师 | 1 | GENERATED_PENDING_PARENT | none |
| C-COMPANION-01 | 墨点精灵 | 1 | GENERATED_PENDING_PARENT | none |
| C-INK-01 | 普通墨团 | 1 | GENERATED_PENDING_PARENT | none |
| C-BOSS-01 | 双印墨守 | 1 | GENERATED_PENDING_PARENT | none |
| C-CAMP-01 | 营地修复前/后 | 1 | GENERATED_PENDING_PARENT | none |
| C-ABILITIES-01 | 三能力卡 | 1 sheet | GENERATED_PENDING_PARENT | none |

Each item remains `QUEUED`, `GENERATED_PENDING_PARENT`, `GENERATION_FAILED`, `ACCEPTED_SEED`, or `REJECTED_SEED`. This STEP does not use `ACCEPTED_SEED` to make final sprite strips.

Generated originals are preserved under `artifacts/hanzi-radical-battle-v2/step-03/imagegen/originals/`; compressed review previews and their exact hashes are recorded in `artifacts/hanzi-radical-battle-v2/step-03/imagegen/asset-seed-manifest.json`. The three generated sheets are audition evidence only and are not loaded by the child route.

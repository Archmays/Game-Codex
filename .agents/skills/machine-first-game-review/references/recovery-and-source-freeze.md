# Recovery and source freeze

## Discovery preflight and acceptance

Discovery preflight is diagnostic. If an expected file, report, or source shape is absent, inventory the actual repository and preserve the discrepancy before deciding whether work can continue. Do not erase a dirty workspace or fail before safe reconnaissance has distinguished moved evidence, newly added files, and conflicting user code.

Acceptance is different: missing canonical evidence, a stale identity, an unbound report, an unknown blocker, or a changed source tree fails closed. Discovery can learn from incomplete state; acceptance cannot infer a pass from it.

## Reconnaissance before mutation

Read every current semantic finding and its cited evidence before the first mutation. Classify root cause, affected evidence, exact allowed files, child-visible impact, gameplay/save/privacy impact, and disposition. Freeze these in a closure charter and hash the charter. Do not silently add pre-existing findings later; only close a regression directly caused by an authorized mutation within the same dependency boundary.

## Source identity

Use the repository's canonical source-tree algorithm. Preserve pre-change Git status, diff, changed-file inventory, and computed identity. Recompute after the last tracked mutation and reject any formal evidence whose before/after identity differs.

Avoid source-shape assertions such as “this directory must contain exactly the old filenames” unless that shape is itself a product contract. Prefer public behavior, schema, catalog, and source-identity assertions. Source-shape checks often mistake harmless refactoring or generated output for a product defect.

## Public behavior and harness order

Test the actions a real user or supported tool can perform: real links, buttons, history navigation, reload, stop, and public storage/session contracts. A harness must follow the same public action order as the product. It must not jump directly into a later internal state and then call that state proven.

When the product already exposes a reduced-motion mode that makes capture deterministic, use that supported behavior. Do not hide dynamic regions, add masks, weaken thresholds, or lengthen timeouts to manufacture stability.

## Baseline promotion order

The safe order is:

1. capture a pre-change reference when relevant;
2. generate candidate visual and ARIA evidence;
3. run changed-only semantic review and then full reconnaissance;
4. require blocker-free semantic acceptance;
5. establish the semantically accepted candidate;
6. run no-update visual and ARIA verification;
7. seal promotion from the accepted update record and the later no-update record;
8. bind final reports to the unchanged accepted source tree.

Snapshot updating is evidence generation, never semantic acceptance by itself.

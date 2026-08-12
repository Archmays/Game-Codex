# Lifecycle and evidence

## Keep identities separate

- Scenario identity says which product situation is being exercised.
- Browser-context identity isolates one test from another.
- Row identity names a route/state/profile observation inside a scenario.
- Report identity binds the collected rows, source tree, commands, and evidence bytes.

Do not force these into one uniqueness rule. Multiple rows may intentionally reuse one browser context sequentially, while separate scenarios should normally receive isolated contexts.

## Same-context observer testing

For same-origin localStorage or BroadcastChannel workflows, put the observer page and child page in the same isolated BrowserContext. Separate tests still receive separate contexts. This reproduces the supported storage and channel identity without touching a family browser profile.

Prove the complete lifecycle:

- active connection delivers the exact allowlisted ordered sequence for one session;
- closing the observer never blocks gameplay;
- actions performed during disconnect remain in the local allowlisted log;
- reopening or reloading the observer validates and resumes the exact grant without creating a second session;
- delivery is deduplicated and sequence values are strictly monotonic;
- the declared BroadcastChannel failure path uses the scoped storage-event fallback;
- observer, child, and world reloads preserve authorized identity and synthetic classification;
- ordinary history back/forward preserves versioned route context without claiming BFCache behavior;
- stop is effective before and after reload;
- bare, duplicate, unknown, expired, wrong-origin, wrong-session, and cross-version contexts fail closed.

Use mutation- or fixture-based negative controls. At minimum, make duplicate sequence, out-of-order sequence, wrong session, cross-version route, and a removed disconnect-window event fail the canonical validator.

## Evidence rules

Persist before broadcast so transport loss cannot erase the canonical local record. Validate origin, grant expiry/status, versioned route identity, build/progress continuity, allowlisted fields, ordering, dedupe, and source/report identity. Keep invalid-route evidence separate from a canonical route matrix when it is a lifecycle scenario rather than a supported state.

Telemetry is observational only. The simulation and save model own game rules. A missing observer, failed channel, schema rejection, or stopped session must never change legal moves, rewards, difficulty, progress, or child-facing availability.

## Validate route identity before side effects

Treat every URL or query identity as untrusted until its singleton count and exact format validate. Reject missing, duplicate, or malformed identity before fixture preparation, storage reads or writes, session recovery, bridge construction, or normal application markup.

Render a rejected route from fixed DOM nodes with no application side effects. Never interpolate a query-controlled value into `innerHTML`; populate accepted display text with `textContent` after static markup exists.

Use isolated negative controls to prove that malformed markup-like input creates no injected element or handler, external request, storage mutation, grant, or session. Keep these controls inert and do not turn acceptance testing into offensive payload research.

## Critical-control spatial evidence

ARIA presence does not prove spatial usability. For a critical state with multiple adjacent actions, declare the critical action group, measure every visible target, verify pairwise non-intersection and rendered group clearance, and sample multiple interior hit-test points per target.

Prove real pointer, touch, and keyboard activation in isolated browser contexts across compact mobile, mobile, tablet, and desktop layouts. Make the source-bound geometry result a final hard gate rather than an optional screenshot note.

Do not apply a global all-target overlap audit blindly across modal or overlay states. Use explicit critical-action contracts so intentional layering does not become a false positive.

## Asynchronous input settling

Do not treat the first observable movement as proof that an asynchronous browser input has reached its required terminal state.

Define the actual postcondition for each input:

- wheel or PageDown may require a positive scroll delta;
- End requires the document bottom;
- Home requires the document top;
- navigation requires the target route or state;
- animation-dependent controls require the stable product state.

Wait for the contract with observable polling or locator conditions. Do not replace terminal-state synchronization with fixed sleeps, retries, or weakened thresholds.

If the same terminal condition appears in more than one phase of one harness, use one shared helper so discovery and final-proof logic cannot drift.

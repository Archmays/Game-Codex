# STEP 07 Skill distillation summary

The reusable machine-review guidance now records four ordinary cross-project lessons:

- On Windows, subprocess tests must budget for real cold-start and process teardown while keeping global assertions strict.
- One-shot Vite test tooling must explicitly disable long-lived HMR, watch, and dependency-discovery behavior and must close the server deterministically.
- Browser observation entry points must validate canonical query identity before storage reads, listeners, timers, or other side effects.
- Invalid entry must render a fixed inert denial surface; accepted identity is rendered with `textContent`, and a negative-control browser test must prove that rejected input causes no side effects.

The Skill text intentionally excludes project dates, commit hashes, repair-round identifiers, fixed test counts, child-session claims, and product-specific findings. Theme C remains `NOT_INTEGRATED`, and machine evidence remains distinct from real-child observation.

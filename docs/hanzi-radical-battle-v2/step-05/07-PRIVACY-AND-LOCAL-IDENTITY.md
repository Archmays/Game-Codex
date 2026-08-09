# STEP 05 Privacy and Local Identity

## Data boundary

- The world and review run locally and make no child-data network request.
- The world uses the existing validated Golden Slice save only; no account, profile, analytics ID, second progress key, or cloud state is introduced.
- No nickname feature is added in STEP 05.
- World code, STEP 05 docs, review code, screenshots, and return package contain no real child name, school, photograph, session identifier, or other direct identifier.

## Evidence boundary

- Raw real-child observation remains at its ignored local artifact path.
- Git and the technical return ZIP record only its SHA-256 plus a privacy-safe synthesis.
- The derived artifact drops the child session identifier and is ignored by Git.
- Synthetic test evidence is labelled `SYNTHETIC_FROM_SCHEMA_ONLY` and cannot be presented as a real observation.

## Review/export boundary

The parent review export uses fixed enums and identity fields. Free-text child identity fields are absent. FINISH validates exact keys, evidence/build/revision identity, complete decisions and authorizations, and a PII denylist before packaging. Authorization fields never carry forward into a later round.

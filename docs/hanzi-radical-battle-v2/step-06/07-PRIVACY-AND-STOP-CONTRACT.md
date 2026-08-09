# STEP 06 Privacy and Stop Contract

## Local minimum evidence

STEP 06 is same-origin and local-only. The bridge channel is `hanzi-v2-step06:<sessionId>`, preferring `BroadcastChannel` with a session-scoped `localStorage` storage-event fallback. It transports only ordered allowlisted events. Bridge loss must not own, pause, repair, or alter gameplay or the canonical save.

Safe metadata is limited to `destinationId`, `phase`, `abilityId`, relative boolean state flags when declared by the schema, `errorCode`, and `recoverable`. The continuity record is the six-field safe projection in the schema, never the whole save.

Never collect or export exact pointer coordinates, raw keyboard input, free child text or quotes, name, age, school, birth date, IP address, user agent, screen fingerprint, exact voice, audio, video, images, screenshots of a real session, transcripts, full localStorage, browser-profile data, or a real session grant. No analytics, upload, account, cloud child tracking, or other remote request is permitted.

Observer notes are optional, capped at 1000 characters, and must pass the PII denylist. Screenshots and fixture exports contain no real child identity. Readiness packaging excludes raw STEP 05 feedback, real child evidence, full storage, session tokens, and all media.

## Stop contract

`结束本次观察` remains visible in the adult observer. Allowed stop codes are:

- `CHILD_REQUEST`
- `DISTRESS`
- `SENSORY_DISCOMFORT`
- `TECHNICAL`
- `PRIVACY`
- `PROGRESS_CONTINUITY`
- `ADULT_ANSWER_REQUIRED`
- `NATURAL_END`
- `OTHER`

Stopping closes the event bridge and observer session, cancels speech and pending evidence timers, invalidates the grant, and ends formal collection. It does not clear or rewrite game progress, delete a save, show failure to the child, or prevent later ordinary free play. A continuity or privacy failure stops before the official child route opens.

## Evidence labels and decision boundary

Only a parent-run natural, separate session may use `REAL_CHILD_SECOND_USE`. Fixture dry-runs use `SYNTHETIC_TOOLING_TEST_ONLY`. Neither label creates an automatic `PASS`, `FAIL`, promotion, replay-route authorization, learning conclusion, or long-term-engagement conclusion.

# Stop and privacy contract

## Immediate stop

Stop without requiring completion when any of these occurs: child request; distress or sustained frustration; sensory discomfort; technical failure; unexpected permission, account, network, ad, or payment surface; privacy exposure; build/session identity mismatch; unusable layout/input; unexpected recording/upload; or adult answer required.

Allowed stop codes are `CHILD_REQUEST`, `DISTRESS`, `SENSORY_DISCOMFORT`, `TECHNICAL`, `PRIVACY`, `IDENTITY`, `ADULT_ANSWER_REQUIRED`, and `OTHER`.

The observer stop control sends a same-origin stop signal. The child route pauses and displays `先回营地休息，找到的汉字都还在。` Existing minimum events are retained locally; completion, failure, replay, explanation, or another answer is not required.

## Minimum-data allowlist

Keep only schema version, opaque session/build identity, strictly ordered relative events, allowlisted enum metadata, structured observer enums, intervention codes, wellbeing observations, optional choices, completion state, and privacy-checked parent notes up to 1000 characters.

Do not collect or export:

- name, age, school, class, teacher, birth date, address, contact details, IP, user agent, or stable device identifier;
- screen fingerprint, exact coordinates, raw pointer/key input, browser storage dump, URL history, account, or profile;
- exact system voice name;
- photograph, image, screenshot, audio, video, recording, transcript, media/file path, or free child quote;
- score, rank, intelligence/ability label, correct answer, card, slot, solver, or next-step answer.

No remote request, analytics SDK, backend, account, upload, microphone, camera, or capture API is authorized.

## Validator behavior

FINISH validates exact schema keys and enums, session/build/feedback identity, sequence order and duplication, note length, forbidden keys, PII-like terms, email/phone/IP/URL/path patterns, media terms/paths, voice names, quotes, scores, and remote/browser-storage fields. It fails closed before copying or packaging.

Fixture data must say `SYNTHETIC_TOOLING_TEST_ONLY`, use a non-canonical output root, and never enter Downloads or the real observation inbox. A fixture package is tooling evidence only.

## Storage and deletion

Session grants, event logs, and control signals are local and session-scoped. FINISH stops only the recorded matching server. Any cleanup is restricted to a uniquely created STEP 04 temporary staging directory; unknown processes, ports, files, and user downloads are never deleted.

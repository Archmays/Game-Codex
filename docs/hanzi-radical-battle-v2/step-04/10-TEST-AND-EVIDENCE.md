# Test and evidence contract

## Required commands

Run after implementation changes, in this order where practical:

```powershell
pnpm run validate:hanzi-v2-foundation
pnpm run validate:hanzi-v2:step03
pnpm run validate:hanzi-v2:step04
pnpm run test:hanzi-v2:step04
pnpm run test:e2e:hanzi-v2:step04
pnpm test
pnpm build
python -X utf8 C:\Users\mays-\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\child-first-use-observation
```

Do not report a command as passed unless it actually ran against the final files. A changed file after a successful check invalidates only checks covering that changed risk.

## Required coverage

- Audio: visible pinyin; pinyin never spoken; exact first-run four; all 12 phrases; common review/runtime source; mute and silent fallback.
- Freeze: all five accepted hashes exact; no content, visual, hub, ImageGen, or prohibited-mechanic drift.
- Gate: exact feedback hash/identity/YES; preflight outcomes; valid session grant; child route denied without it.
- Observer: live/fallback bridge, strict sequence/dedupe/reconnect, observer-offline completion, Chinese checkpoint controls, stop, optional cards, one-replay limit, export.
- Privacy: exact schema; no remote request, media, PII keys/content, exact voice, user agent, coordinate/raw input, browser dump, answer/score/profile, or Git inclusion.
- E2E: unchanged default hub and review route; desktop/mobile/tablet; pointer/drag/keyboard; reduced motion; sound/mute; stop; completion/replay/export; no page/console/remote-network error.

## Fixture evidence

The fixture must use valid synthetic authorization, preflight, child/observer sync, observation export, privacy validation, summary, and FINISH package. Every fixture artifact says `SYNTHETIC_TOOLING_TEST_ONLY`, stays outside the real inbox/canonical observation package, and makes no child conclusion.

## Browser evidence

Representative screenshots may show only tooling/test state: parent preflight, visible pinyin and spoken phrase, observer READY, clean child route, phase sync, stop control, optional choices, compact observer, completed synthetic summary, and privacy validation. They must contain no child, personal information, exact voice, or real observation.

## Independent acceptance checklist

Read-only acceptance verifies changed-only scope, all frozen hashes, visible-but-unspoken pinyin, clean child route, answer-free observer, immediate stop, offline observer tolerance, minimum events, no network/profile/media, skippable optional cards, unambiguous fixture labeling, no hub entry/new art/automatic promotion. Resolve any Sev-1/Sev-2 before closeout.

Automated and browser PASS establish technical readiness only. They do not establish a real child session, child acceptance, learning validation, or promotion.

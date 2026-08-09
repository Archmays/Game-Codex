# Audio revision contract

## Data separation

Each of the accepted 12 characters exposes display and speech explicitly:

```ts
visualPinyin: string;
spokenPhrase: string;
```

The compatible `pinyin` field may remain. Visual surfaces read `visualPinyin` (or the compatible pinyin field); every `SpeechSynthesisUtterance.text` reads only `spokenPhrase`. Runtime code must not construct speech by concatenating displayed pinyin.

`spokenPhrase` follows the accepted values `glyph + familiarWord + glyph` with Chinese punctuation. It contains no pinyin, Latin letters, English, tone digits, or new meaning.

## Exact first-run phrases

```text
明，明亮的明。
花，花朵的花。
林，树林的林。
星，星星的星。
```

The accepted manifest remains the truth source. All 12 accepted entries require a non-empty phrase for later spellbook replay.

## Runtime and fallback

- Keep `lang = zh-CN` and choose a local Chinese device voice when available.
- Use the same character speech record for automatic formation speech, replay, spellbook, STEP 03 review, and STEP 04 preflight.
- Do not persist or export the exact device voice name. The observer records only an allowlisted category.
- Keep mute, unavailable speech synthesis, voice errors, and silent fallback fully playable. Audio never communicates the only copy of a rule.
- Add no network TTS, download, parent/child recording, media upload, or third-party audio.

## Parent-only preflight

`?observe=hanzi-v2-step04` displays the canonical audio revision, visible pinyin, four separate phrase controls, and local adapter/voice/lang diagnostics. The parent chooses exactly one:

- `SOUND_OK`: enable speech for this session;
- `START_MUTED`: begin silently with equal observation eligibility;
- `CANCEL`: do not authorize or open the child route.

READY and the audio choice are session-scoped and expire. Voice name is not persisted. The preflight is a technical device check, not a new content-review decision.

## Required evidence

Automated checks cover visible pinyin, exact first-run phrases, all 12 non-empty phrases, absence of Latin/pinyin speech, a common review/runtime source, mute completion, and silent fallback. A parent must still judge the actual device output before a real session.

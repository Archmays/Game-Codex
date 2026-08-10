# STEP 04 Audio Revision Evidence

Parent request implemented exactly:

- Pinyin stays visual through `visualPinyin`.
- Speech uses only `spokenPhrase`; no display-pinyin string is passed to TTS.
- Language remains `zh-CN`, with a local Chinese device voice when available and complete silent/visual fallback.
- All 12 accepted characters have a non-empty phrase derived from the accepted glyph and familiar word; phrases contain no Latin letters or tone digits.
- STEP 03 parent review, runtime automatic speech, replay, spellbook, and STEP 04 preflight share the manifest speech source.

Exact first-run utterances:

1. `明，明亮的明。`
2. `花，花朵的花。`
3. `林，树林的林。`
4. `星，星星的星。`

Mute and unavailable speech do not block completion. Immediate observer stop cancels current speech and active local WebAudio. No network TTS, recording, download, upload, child voice, or new interpretation was introduced.

Verification: STEP 04 audio tests 4/4, targeted suite 27/27, E2E 5/5, full suite 282/282, and representative screenshots `01` and `02`.

# Audio and voice audit

Status: parent-review candidate. There is no formally reviewed recording in STEP 03, and device speech synthesis is not claimed to be consistent production voice.

## Bus graph

```text
Music ─────┐
Ambience ──┤
SFX ───────┤
Voice ─────┼─> Master ─> device output
UI ────────┘
```

Default normalized volumes are Master `0.72`, Music `0.26`, Ambience `0.22`, SFX `0.62`, Voice `0.82`, and UI `0.46`. Master mute and each group volume are local settings. Voice temporarily ducks Music to 32 percent of its current bus level and restores it after completion or cancellation.

## Runtime implementation

- `AudioDirector` owns one optional Web Audio context, per-bus gain nodes, active oscillator sources, ducking, and cleanup.
- Lightweight original oscillator cues cover place, gentle retry, glyph formation, meaning magic, choice, and UI. Three deterministic pitch variants avoid repeated identical SFX.
- At most five generated sources may overlap, preventing an overlap storm.
- `destroy()` cancels speech, stops active nodes, detaches the graph, and closes the context.
- Audio never advances or validates simulation state. A browser denying audio leaves all visual state and controls intact.

## Voice adapters

Priority is fixed:

1. `RecordedVoiceAdapter`: project-local, parent-approved clips only. The STEP 03 clip map is empty, so this adapter declines.
2. `SpeechSynthesisAdapter`: chooses exact `zh-CN` first, then another `zh-*` device voice, then the device default with `lang = zh-CN`.
3. `SilentVisualFallback`: resolves successfully with no audio while glyph, pinyin, familiar word, route, and result remain visible.

The parent review displays the real adapter, voice name, and language returned during that browser session. It offers exactly `ACCEPT CURRENT CANDIDATE`, `NEED RECORDED AUDIO`, `REVISE`, or `REJECT`. Choosing the first option accepts only the reviewed local candidate; it does not establish cross-device voice parity.

## Required utterances

| Glyph | Pinyin | Familiar word | Candidate utterance |
|---|---|---|---|
| 明 | míng | 明亮 | `明，míng，明亮的明。` |
| 花 | huā | 花朵 | `花，huā，花朵的花。` |
| 林 | lín | 树林 | `林，lín，树林的林。` |
| 星 | xīng | 星星 | `星，xīng，星星的星。` |

Voice replay is initiated by a visible button or the 墨点 companion. Speech failure never removes or abbreviates the visual line.

## Accessibility and privacy

- No step requires hearing; intent, hint, ability, and result all have shape and text equivalents.
- Reduced motion does not automatically mute. Parent settings persist each choice separately.
- There is no microphone, recording, upload, audio fingerprint, network voice API, downloaded third-party sound, or analytics SDK.
- The local playtest event records only `muted: boolean`, never the selected voice name. Voice information is parent-review diagnostics only.

## Open human decision

Real device voice availability and child response cannot be automated. Parent review must decide whether the device TTS candidate is acceptable for first-use observation or reviewed project recordings are needed. No child audio acceptance is claimed.

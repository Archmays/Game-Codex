# STEP 05 Audio Context Fix Contract

## Root cause

The former ordinary narrative replay control called `speakCurrentCharacter()`, which resolved `currentEncounterId`. The machine deliberately prepares future encounter IDs during non-combat phases, so camp, travel, intro, placing, ability, return, repair, and completion surfaces could speak an unformed next character.

## Explicit context contract

`getGoldenVoiceContext(state, uiContext)` is pure and returns an explicit character plus one of `formed-character`, `spellbook`, `ink-echo`, or `none`.

| Narrative phase | Ordinary replay target |
| --- | --- |
| battle_1_forming / casting / cleared | 明 |
| battle_2_forming / casting / cleared | 花 |
| boss_phase_1_forming / cleared | 林 |
| boss_phase_2_forming / boss_cleared | 星 |
| every other phase | none |

The mapping does not consult `currentEncounterId`. Camp, travel, battle intro/placing, breather, ability, boss intro/placing, return, repair, and run completion have no ordinary replay control.

Spellbook speech resolves only the explicit `data-read-character` page ID. Ink Echo has its own `speakInkEchoTarget()` path and resolves the active boss phase from `bossInterference.bossPhaseId`; it never borrows narrative replay behavior.

## Utterance and accessibility

- Speech uses the accepted `spokenPhrase` field.
- `visualPinyin` remains visible and is never passed to speech synthesis.
- Mute, stop/cancel, auto-speech whitelist, visual fallback, and reduced-motion behavior remain intact.
- The repair adds no audio asset, network request, content revision, or save mutation.

## Validation

The phase matrix tests camp, travel, breather, ability, boss intro, return, all four formed-character phases, deliberate mismatches between phase and `currentEncounterId`, explicit spellbook tabs, dedicated Ink Echo, visible pinyin, and pinyin-free utterance source. Frozen content hashes separately prove the repair did not change accepted gameplay/content.

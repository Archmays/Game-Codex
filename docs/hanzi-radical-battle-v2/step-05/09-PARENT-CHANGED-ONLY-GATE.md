# STEP 05 Parent Changed-Only Gate

Route: `?review=hanzi-v2-step05`.

The review has five tabs and exposes evidence as a feedback anchor, not as an approval click.

| Tab | Scope | Required decision |
| --- | --- | --- |
| 真实证据 | hash, derived timeline/reach, human observation, replay reconciliation, provisional decision, not-concluded | `ACCEPT` / `REVISE` |
| Audio context regression | phase matrix, expected/actual target, explicit click checks | `ACCEPT` / `REVISE` |
| 我的游戏世界 | same live world at desktop/tablet/mobile widths, repair, portal, spellbook, treasure, copy/privacy | `ACCEPT` / `REVISE` / `REJECT` |
| 导航 | world→forest→complete→world, spellbook, treasure→classic→world | `ACCEPT` / `REVISE` |
| 授权 | promotion boundaries | `authorizeDefaultWorldEntry: YES/NO`; `authorizeSecondUseCheck: YES/NO` |

The fixed export filename is `STEP-05_PARENT_REVIEW_FEEDBACK.json`. It binds decisions to the STEP 05 review revision, raw evidence hash, observed build identity, and reviewed commit. Empty or stale identities fail closed.

No parent decision is preselected. Technical checks and screenshots must never populate authorization fields.

## Round 2 changed-only

If any decision is `REVISE`, Round 2 displays only changed audio context, changed world shell, dependency-affected navigation, and review-tooling changes. Exact-identity unaffected items may carry forward: first-run gameplay, 12 characters, three abilities, boss, Theme C, and positive first-use evidence. Authorizations never carry forward and must be entered again.

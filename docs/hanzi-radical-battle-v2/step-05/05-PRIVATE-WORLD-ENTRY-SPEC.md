# STEP 05 Private World Entry Spec

Route: `?world=my-game-world`. Default `/` remains the classic hub.

## First screen

The child-facing heading and invitation are exactly:

- `我的游戏世界`
- `今天想去哪里？`

It is a private local game-world candidate, not a learning dashboard. Its primary area must not contain subject, age, accuracy, practice-goal, course, or playable-status labels. It stores no name, school, photograph, account, or remote identity.

## Three world objects

1. **墨迹森林** — the only active portal. It links to `?play=hanzi-v2-golden-slice&mode=play&from=world`; copy is `走进墨迹森林` before a complete four-character run and `再去墨迹森林` only after a completed run with all four first-run spellbook entries.
2. **四字魔法书** — opens the existing discovered entries in canonical order `明 花 林 星`; no parallel collection is created.
3. **游戏百宝箱** — a secondary link to `?hub=classic&from=world`; classic catalogue cards do not move onto the world home.

## Permanent state projection

The world reads `readGoldenSliceSave` only. It never writes a second progress schema or key. Lamp, flowers, tree, star path, and spellbook are projected from the repaired camp and discovered first-run entries. A STEP 02 migrated partial save can show only the progress it contains; `completedRuns > 0` alone is insufficient to claim the world is fully repaired.

A missing or malformed value falls back calmly through the canonical reader. Settings controls may update only the existing Golden Slice settings fields while preserving every progress field and the existing schema/key.

## Visual boundary

The world reuses Theme C tokens: deep blue-green forest, soft glow, camp lamp, star path, and low-intensity ambient motion. It uses local procedural DOM/Phaser graphics only, no emoji as formal object, no ImageGen, no new asset, and no network request. It does not refactor the accepted STEP 03 renderer for reuse.

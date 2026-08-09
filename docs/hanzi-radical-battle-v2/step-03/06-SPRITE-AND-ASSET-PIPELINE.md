# Sprite and asset pipeline

## STEP 03 boundary

The playable candidate uses original Phaser Graphics and DOM/CSS shapes with stable asset keys. Image-generated work, when available, is an isolated seed-frame audition for parent review. No generated concept image is loaded by the child route, and no final strip is authorized here.

## Stable runtime keys

| Key | Subject | Runtime form | Anchor | Child scale | Required readability |
|---|---|---|---|---:|---|
| `theme-c.world.camp` | before/after camp | Phaser Graphics | top-left world | responsive canvas | lamp, path, and clearing remain distinct |
| `theme-c.mage.base` | 墨灵师 | Phaser Graphics | bottom-center | 118–146 px high | face, hand glow, cloak silhouette |
| `theme-c.companion.base` | 墨点精灵 | Phaser Graphics | center | 46–58 px | eyes, route, position |
| `theme-c.inkling.base` | 普通墨团 | Phaser Graphics | bottom-center | 96–122 px | rounded, non-threatening outline |
| `theme-c.boss.double-seal` | 双印墨守 | Phaser Graphics | bottom-center | 160–210 px | two separate seals and intent |
| `theme-c.ability.guardian-light` | 护字光 | DOM/CSS + Graphics | center | 64–88 px | shield arc + retained part |
| `theme-c.ability.star-path` | 星光路标 | DOM/CSS + Graphics | center | 64–88 px | star + empty slot |
| `theme-c.ability.ink-echo` | 墨点回声 | DOM/CSS + Graphics | center | 64–88 px | companion route + ripple |
| `theme-c.magic.ming` | 明 meaning magic | Phaser Graphics | character center | world-relative | light originates at glyph |
| `theme-c.magic.hua` | 花 meaning magic | Phaser Graphics | character center | world-relative | flowers open and path clears |
| `theme-c.magic.lin` | 林 meaning magic | Phaser Graphics | character center | world-relative | exactly two trees grow |
| `theme-c.magic.xing` | 星 meaning magic | Phaser Graphics | character center | world-relative | star path appears |

## Production candidate geometry

- Logical Phaser canvas: `960 × 540`, `FIT`, centered. DOM board and hand remain independent of canvas scaling.
- All figure anchors are explicitly reset before redraw; a resize cannot accumulate offsets.
- Mobile portrait compresses the world into the upper region while the structure board remains the central interaction.
- Four strong feedback events only: full glyph formation, meaning magic, each seal release, and full camp repair.
- Reduced motion removes shake, parallax, large travel, and dense particles. It keeps component-to-slot state, complete glyph, meaning word, world result, and a short opacity transition.
- No character is an emoji, no continuous flashing is used, and high-contrast glyph/slot rendering is DOM text rather than baked raster text.

## Future seed-to-strip contract

| Subject | Future action names | Proposed frames | Anchor continuity | Not used in STEP 03 |
|---|---|---:|---|---|
| 墨灵师 | idle, cast, celebrate | 6 / 8 / 6 | bottom-center ±1 px | hurt |
| 墨点精灵 | idle, listen, route-flight, celebrate | 6 / 4 / 8 / 6 | center ±1 px | answer-select |
| 普通墨团 | idle, soften, clear | 6 / 6 / 8 | bottom-center ±1 px | attack |
| 双印墨守 | idle, intent, mask, seal-release | 6 / 4 / 4 / 8 | bottom-center ±1 px | damage, defeat |

The future producer must start from one parent-approved seed per subject, use a single-source-sheet workflow, preserve consistent lighting/proportion, remove the background, trim and pad every frame, generate a contact sheet, and test at actual game scale. Generating frames independently is prohibited because it breaks identity and anchors.

## Acceptance sequence

1. Parent compares procedural candidate and review-only seed.
2. Parent records `ACCEPT`, `REVISE`, or `REJECT` for each stable asset item.
3. Only an explicit later authorization can turn an accepted seed into a strip.
4. The strip must pass transparency, crop, anchor-jitter, silhouette, mobile-scale, reduced-motion fallback, and asset-byte gates.
5. Originals remain in artifacts. Only accepted, trimmed production outputs may enter runtime assets.

## Explicit exclusions

No brand imitation, third-party character, scraped sound/image, direct concept-art sprite, per-frame generation, full Ink Forest environment set, hurt animation, combat damage animation, or bulk raw-image commit is part of this candidate.

# Deployment finding and scoped dependency closure

Observed 2026-09-20: Pages run 35488706536 for pre-change HEAD 943f3cca failed its `classic-oddity` public-return check. The prior successful deployment was efba5476; this is deployment evidence, not an inferred routing diagnosis from a local page.

Current source shows the Classic game definition losing `from=hub`, while the game return anchor always led to `?world=my-game-world`. Repair is confined to the Oddity game definition and return anchor. Its direct entry still returns to the main world. The existing interaction-integrity consumer also needs to wait for the actual lazy Oddity destination and dismiss its public first-use demonstrations after entering through Classic, rather than only when the manifest row itself is the direct Oddity row.

Additional necessary path: `tests/e2e/interaction-integrity/portfolio-hittest.spec.ts`. Both desktop-1366 and mobile-390 reproduced/validated the changed Classic entry/return using real controls. Full publication remains unproven until the new exact commit is deployed and read back. This does not authorize changes to other games or broader CI relaxation.

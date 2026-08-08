---
name: child-first-learning-game
description: Guard child-first learning-game design, implementation, review, and promotion decisions. Use for work that changes a child's first screen, core loop, feedback, difficulty, retention, accessibility, local play records, parent surfaces, or playtest gates; especially for the Hanzi Radical Battle V2 initiative.
---

# Child First Learning Game

Keep the child's felt experience, healthy agency, and observable comprehension ahead of curriculum dashboards or engagement metrics. Automated PASS is technical evidence only; it never substitutes for real child observation or parent judgment.

## Required workflow

1. Read the initiative north star, machine constraints, traceability matrix, and current decision log.
2. Name the single child-experience question being changed or tested.
3. Declare the paths in scope and the experiences explicitly out of scope.
4. Map every feature to child value, learning value, automatic evidence, and child-playtest evidence before implementation.
5. Verify the affected interaction in a real browser. Record observation needs separately from technical results.
6. End with one honest state: `FOUNDATION`, `GOLDEN_SLICE_CANDIDATE`, `CHILD_PLAYTEST_READY`, `REVISE`, or `PROMOTED`. Never infer `PROMOTED` from code or tests alone.

## Child-first experience rules

- The first view must read as a game world: world, character, adventure, monster, choice, magic, discovery, and visible change.
- Put learning objectives, age, accuracy, error lists, practice counts, and teacher explanations in a separate parent or settings surface.
- Let “wanting to continue” come from choice, mastery, character differences, readable magic feedback, and permanent world change.
- Do not use leaderboards, global comparison, daily login rewards, streak pressure, FOMO, loot boxes, expiring rewards, punitive progress loss, or shaming failure language.
- Failure or retreat must preserve discoveries and already-earned persistent progress and offer a calm next action.
- Target about 3–5 minutes for the golden slice and about 8–12 minutes for a later complete Pilot.
- A child should understand the core action with little prompting and without a long rules page.
- Real child observation cannot be replaced by an agent, telemetry, screenshots, or automated tests.

## Interaction and safety requirements

- Use short child-facing sentences, large readable type, clear hierarchy, and a single obvious next action.
- Give touch targets at least 44 CSS pixels where layout permits; do not rely on hover or color alone.
- Keep essential controls visible in portrait phone, landscape tablet, and desktop layouts without covering the playfield.
- Provide reduced-motion behavior for non-essential camera motion, shake, particles, and transitions. Never make flashing the only feedback.
- Make sound optional, provide a persistent mute control, avoid startling peaks, and keep important state understandable without audio.
- Use warm, specific recovery feedback: show which parts are available and how the structure slot can be tried again; do not label the child as wrong or defeated.
- Store only local, anonymous, minimum-necessary play records. No accounts, network transmission, advertising identifiers, or cloud child tracking.

## Promotion boundary

Automated tests may establish constraint, persistence, and runtime correctness. Browser checks may establish that the interaction renders and responds. Only observed child behavior can establish whether the child understood, cared, noticed the world change, and wanted another try. Use `PROMOTE`, `REVISE`, or `STOP_AND_RETHINK` only under the initiative playtest gate.

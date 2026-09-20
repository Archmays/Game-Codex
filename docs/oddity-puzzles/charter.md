# 奇物事务所 v0.1.0 closure charter

Scope: three original rooms, five abilities, fixed pairs, local anonymous saves, Blender-authored GLBs and local audio. No additional game, combat, score, equipment selection, child tracking or generic engine. Child question: can a player observe a spatial constraint, try a reversible action and request progressively specific help?

Discovery: existing tree was clean on main. Reuse game-core storage, ui/input, route-lazy Three/GLTFLoader, canonical family HTTP origin 127.0.0.1:5175, existing static handoff server and Node runtime. Blender 4.5.14 installation is verified on D:. World Box source/save namespaces stay unchanged. No existing oddity implementation or accepted evidence exists.

Allowed dependency closure: games/oddity-puzzles, public/assets/oddity-puzzles, tools/oddity-puzzles, tests/oddity-puzzles*, docs/oddity-puzzles; minimal catalog/portfolio/surface/save-inventory/home entry, src/main.ts route mount, root launcher and input contract additions, generated portfolio documentation and affected inventory tests if required. No unrelated gameplay changes.

Known risks/disposition: geometric ability bypass (same-layout collision/LOS and negative controls); stale animation completion (logical commit before animation, cancellation epoch); NPC/photo dead ends (reversible ownership and empty-photo return); save failure/corruption (visible error, validate before read); cutaway camera vs logical visibility (separate pick/LOS/navigation); unsupported device claims (report emulation only); package origin mismatch (canonical launcher and relocated HTTP checks).

Acceptance: grey geometry tests before final Blender generation; final geometry/rule tests; real keyboard/mouse/touch three-room playthroughs from home, responsive/lifecycle/recovery/performance and World Box regression; same-source final build/tests and evidence; local production HTTP ZIP excludes blend; source identity and ordinary one-commit/push. No child-use or learning claims. Stop at three rooms.

User refinement: the existing root 启动游戏大厅.cmd must launch all current games through the family hub. Its former 5173/install-on-launch path is replaced by the validated 5175 family launcher. Affected inventory consumers include readiness/catalog/save tests with explicit historical counts; only the new product/key counts are updated.

# STEP 05 World Navigation Contract

| Source | Destination | Exact route | Constraint |
| --- | --- | --- | --- |
| direct private entry | world | `?world=my-game-world` | opt-in only; not default `/` |
| world forest portal | Golden Slice | `?play=hanzi-v2-golden-slice&mode=play&from=world` | explicit world context |
| completed world-launched run | world | `?world=my-game-world` | link shown only at run complete |
| world treasure box | classic hub wrapper | `?hub=classic&from=world` | hub mounts into inner node |
| classic wrapper | world | `?world=my-game-world` | wrapper link survives hub rerenders |
| parent | STEP 05 review | `?review=hanzi-v2-step05` | adult-only changed items |

Dispatch order preserves the existing play, observe, STEP 03 review, STEP 02 review, and default hub semantics while adding exact STEP 05 routes.

The classic wrapper owns the world-return link and an inner container. The unchanged `mountHub` receives only that inner container, so its `innerHTML` and class mutations cannot erase the wrapper. All ten games and their enter/return behavior remain controlled by the existing hub.

Golden Slice receives `returnToWorldHref` only for ordinary `mode=play&from=world`. Child-first-use and review routes never receive it. The completion anchor dispatches no simulation action and writes no save; normal completion persistence has already happened at the canonical machine boundary.

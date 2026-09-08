# Game input contract

Every input calls the game's existing semantic operation. Shared helpers in `packages/ui/input.ts` manage only focus and input lifecycle. They do not choose puzzle targets, reorder operands, solve levels or advance progress.

## Navigation and activation

- Tab / Shift+Tab cross regions and ordinary controls. A repeated grid/list has one Tab stop; arrows navigate within it, Home/End reach its ends. Tab always exits the region. Use visible focus and retain the current item after rendering; if consumed, focus its result or the next legal control.
- Navigation links keep native anchor semantics and an explicit `tabindex="0"`. Our Windows WebKit diagnostic skipped implicit anchors but included explicitly declared anchors with ordinary Tab; the application preserves document order without changing the user's browser settings. WebKit also exposes a [link-focus preference](https://developer.apple.com/documentation/webkit/wkpreferences/tabfocuseslinks).
- Enter / Space activate native buttons once. Never also invoke an underlying game shortcut. Escape cancels a preview/dialog, returning focus to its opener; a modal has a bounded focus cycle. Links retain native browser behavior.
- Scope game shortcuts to the active play context. Ignore inputs, textareas, selects, contenteditable, IME composition/keyCode 229, Ctrl/Meta/Alt combinations and already-handled events. Normal page scroll and browser zoom remain available outside an explicit directional game control.
- Repeated transformation/confirmation keys never double-apply. Movement may repeat with a bounded cadence. Clear held inputs and drag state on blur, hidden, pointercancel, exit and modal entry. A lost focus never completes an unfinished drag.
- For native HTML drag-and-drop, `dragstart` hands the pointer stream to DnD and normally fires `pointercancel`; this ends the pointer gesture while the native drag remains active until drop/dragend. Escape, blur or hidden cancels that native lifecycle. A later stale drop cannot revive it. This distinction follows the [HTML drag processing model](https://html.spec.whatwg.org/multipage/dnd.html#drag-and-drop-processing-model) and the locally observed event order.

## Pointer and layout

- A tap/click completes on release; a scroll/cancel does not perform a game action. No required operation depends solely on hover, right-click, long press or dragging.
- Main actions are approximately 48–56 CSS px; other interactive targets at least 44 CSS px. Touch controls remain available when a keyboard or mouse is connected. Do not lock input mode by user agent.
- Respect safe areas, dynamic viewport/low-height screens, portrait and landscape, DPR and browser zoom. Allow natural page scrolling and page pinch zoom. Controls must not cover essential scene state.

## Game-specific action map

| Surface / route | Regions and real actions | Keyboard | Mouse / touch |
| --- | --- | --- | --- |
| Home `?world=my-game-world`, Classic `?hub=classic&from=world`, Math `?world=math-world` | Entrances, settings, return | Tab, Enter/Space; dialog Esc | Ordinary buttons/links |
| Settings / Vault | Tabs, export, choose file, recovery preview/confirm | Native controls, bounded modal focus, Esc close | Click/tap; no drag required |
| Adventure `?play=hanzi-word-adventure` | World, moves, target, transformations, hints, save selection | Arrows/WASD move in play context; Shift+arrows inspect; Space/E current explicit action; X split, C combine, Z undo, Esc cancel; Tab controls | Adjacent walkable cell moves; objects inspect, main action performs; while carrying, Choose placement selects a cell without walking; directions remain available |
| Tower `?play=hanzi-tower-defense` | Materials, tower positions, English equipment, preview, battle, 1×/2× speed | Region Tab; region arrows; native confirm and speed button; P pause only within game; Esc cancel | Select entities then target/confirm; ranges inspect independently; speed changes battle time only |
| Slider `?world=math-world&station=slider` | Rails, each rail's up/down, undo/hint/return | Original Up/Down direction semantics retained; Tab between rails/control regions; Esc cancels active drag | Existing click alternatives and drag use one reducer; switching levels retains a usable focus target |
| Target `?world=math-world&station=target` | Cards, operators, ordered operand preview, swap/combine/hint | Regional arrows and native activation | Choose left then right operand; explicit swap; subtraction/division stay ordered |
| Independent pairing `?play=memory-card` (compatibility entry, no home/Classic product card) | Pack, card grid, restart/return | Grid arrows skip matched cards, Enter/Space flip, Tab exit | Tap cards; no gesture required |

## Verification

From home, use only actual keys for a keyboard playthrough: do not use locator focus/click or injected state to replace missing navigation. Independently exercise mouse and touch through the primary loop, hint/recovery and return. Cover 360/390 phones, 768/1024 tablets in both orientations, desktop, mixed input, canceled gestures and focus loss. Device emulation is not physical-device evidence. Validate unchanged mathematics meaning separately from input.

References checked 2026-09-08: [W3C keyboard grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), [dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [pointer cancellation](https://www.w3.org/WAI/WCAG21/Understanding/pointer-cancellation.html). Keyboard access and a single-pointer alternative are separate checks.

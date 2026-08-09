import type { GoldenSliceState, ReviewJumpPhase } from "../simulation/machine";

export function parentDebugOverlayMarkup(state: GoldenSliceState): string {
  const jumps: readonly [ReviewJumpPhase, string][] = [
    ["camp_intro", "营地"],
    ["ability_choice", "三选一"],
    ["boss_intro", "Boss"],
    ["spellbook_review", "魔法书"],
  ];
  return `<aside class="golden-parent-debug" data-testid="parent-debug-overlay">
    <strong>家长预览</strong><span>seed ${state.seed}</span>
    ${jumps.map(([phase, label]) => `<button type="button" data-review-jump="${phase}">${label}</button>`).join("")}
  </aside>`;
}

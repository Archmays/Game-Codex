import { GOLDEN_ABILITIES } from "../content/abilities";

const CHILD_DESCRIPTIONS = {
  "guardian-light": "放对的字灵会被光保护。",
  "star-path": "星光会先照亮一个位置。",
  "ink-echo": "墨点精灵会再说一次，也会飞去提醒你。",
} as const;

export function abilityChoiceOverlayMarkup(): string {
  return `<section class="golden-modal golden-ability-choice" role="dialog" aria-modal="true" aria-labelledby="ability-title" data-testid="ability-choice">
    <div class="golden-modal__panel">
      <span class="golden-kicker">三道魔法都能继续冒险</span>
      <h2 id="ability-title">选一道同行的光</h2>
      <div class="golden-ability-grid">${GOLDEN_ABILITIES.map(
        (ability) => `<button class="golden-ability-card golden-ability-card--${ability.id}" type="button" data-ability-id="${ability.id}" data-testid="ability-${ability.id}">
          <span class="golden-ability-card__icon" aria-hidden="true"><i></i></span>
          <strong>${ability.name}</strong>
          <span>${CHILD_DESCRIPTIONS[ability.id]}</span>
        </button>`,
      ).join("")}</div>
    </div>
  </section>`;
}

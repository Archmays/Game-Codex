import type { PilotScenario } from "../content/types";
import type { StructureBoardState } from "../simulation/structure-board";

function cardGlyph(scenario: PilotScenario, cardId: string | undefined): string {
  return scenario.cards.find((card) => card.id === cardId)?.glyph ?? "";
}

export function structureBoardMarkup(
  scenario: PilotScenario,
  board: StructureBoardState,
  hintSlotId: string | null,
): string {
  const slots = scenario.slots
    .map((slot) => {
      const cardId = board.placements[slot.id];
      const glyph = cardGlyph(scenario, cardId);
      const classes = ["spell-slot", `spell-slot--${slot.spatialRole}`];
      if (cardId) classes.push("is-filled");
      if (hintSlotId === slot.id) classes.push("is-hinted");
      return `<button class="${classes.join(" ")}" type="button" data-slot-id="${slot.id}" data-testid="slot-${slot.id}" aria-label="${slot.label}${glyph ? `，已有${glyph}，点按可拿回` : "，等待字灵"}">
        <span class="spell-slot__label">${slot.label}</span>
        <span class="spell-slot__glyph" aria-hidden="true">${glyph}</span>
      </button>`;
    })
    .join("");

  return `<section class="structure-board structure-board--${scenario.structure}" data-testid="structure-board" aria-label="汉字结构位置">
    <div class="structure-board__halo" aria-hidden="true"></div>
    <div class="structure-board__slots">${slots}</div>
  </section>`;
}

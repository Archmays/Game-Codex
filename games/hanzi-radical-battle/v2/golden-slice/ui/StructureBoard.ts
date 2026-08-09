import type { GoldenEncounter } from "../content/types";
import type { StructureBoardState } from "../../simulation/structure-board";

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

export function goldenStructureBoardMarkup(
  encounter: GoldenEncounter,
  board: StructureBoardState,
  presentedCardIds: readonly string[],
  hintSlotId: string | null,
  inputLocked: boolean,
): string {
  const slots = encounter.slots
    .map((slot) => {
      const cardId = board.placements[slot.id];
      const glyph = encounter.cards.find((card) => card.id === cardId)?.glyph ?? "";
      return `<button class="golden-slot golden-slot--${slot.spatialRole}${glyph ? " is-filled" : ""}${hintSlotId === slot.id ? " is-hinted" : ""}" type="button" data-slot-id="${escapeAttribute(slot.id)}" data-testid="slot-${escapeAttribute(slot.id)}" ${inputLocked ? "disabled" : ""} aria-label="${escapeAttribute(slot.label)}${glyph ? `，已有${glyph}，点按可拿回` : "，等待字灵"}">
        <span class="golden-slot__position">${slot.label}</span>
        <span class="golden-slot__glyph" aria-hidden="true">${glyph}</span>
      </button>`;
    })
    .join("");

  const cards = presentedCardIds
    .map((cardId, order) => {
      const card = encounter.cards.find((item) => item.id === cardId);
      if (!card) return "";
      const placed = Object.values(board.placements).includes(card.id);
      const selected = board.selectedCardId === card.id;
      return `<button class="golden-card${selected ? " is-selected" : ""}${placed ? " is-placed" : ""}" type="button" draggable="${!placed && !inputLocked}" data-card-id="${escapeAttribute(card.id)}" data-card-order="${order}" data-testid="component-card-${escapeAttribute(card.id)}" aria-pressed="${selected}" ${placed || inputLocked ? "disabled" : ""} aria-label="字灵 ${escapeAttribute(card.glyph)}${selected ? "，已选中" : ""}">
        <span aria-hidden="true">${card.glyph}</span>
      </button>`;
    })
    .join("");

  return `<section class="golden-board-zone" aria-label="合字施法区" data-testid="structure-board" data-structure="${encounter.structure}">
    <div class="golden-board-heading">
      <span class="golden-board-heading__spark" aria-hidden="true"></span>
      <strong>把字灵送回真实位置</strong>
      <div class="golden-board-tools">
        <button class="golden-undo" type="button" data-undo ${inputLocked ? "disabled" : ""}>拿回一步</button>
        <button class="golden-retry" type="button" data-safe-retry>重新摆放</button>
      </div>
    </div>
    <div class="golden-structure golden-structure--${encounter.structure}">${slots}</div>
    <div class="golden-hand" aria-label="五张字灵牌" data-testid="five-card-hand">${cards}</div>
  </section>`;
}

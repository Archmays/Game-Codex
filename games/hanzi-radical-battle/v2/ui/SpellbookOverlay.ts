import type { CandidateCharacter } from "../content/types";

export function spellbookOverlayMarkup(character: CandidateCharacter): string {
  return `<section class="spellbook-card" data-testid="spellbook-card" aria-label="字灵书新条目">
    <span class="spellbook-card__kicker">字灵书 · 新发现</span>
    <div class="spellbook-card__glyph" lang="zh-Hans">${character.glyph}</div>
    <strong>${character.pinyin}</strong>
    <p>${character.familiarWord} · ${character.shortMeaning}</p>
    <small>由 ${character.components.map((part) => part.glyph).join(" + ")} 放回真实结构位置组成</small>
  </section>`;
}

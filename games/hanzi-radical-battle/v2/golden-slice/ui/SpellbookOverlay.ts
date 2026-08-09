import { FINAL_GOLDEN_MANIFEST } from "../content/manifest";

const STRUCTURE_LABELS = {
  "left-right": "左右结构",
  "top-bottom": "上下结构",
  "full-enclosure": "全包围结构",
  "semi-enclosure": "半包围结构",
} as const;

export function spellbookOverlayMarkup(activeId: string, replayMode: "formation" | "magic" | null = null): string {
  const entries = FINAL_GOLDEN_MANIFEST.filter((character) => character.stage === "first-run");
  const active = entries.find((character) => character.id === activeId) ?? entries[0];
  return `<section class="golden-modal golden-spellbook" role="dialog" aria-modal="true" aria-labelledby="spellbook-title" data-testid="spellbook-overlay">
    <div class="golden-modal__panel golden-spellbook__panel">
      <span class="golden-kicker">营地记住了这些字。</span>
      <h2 id="spellbook-title">四字魔法书</h2>
      <nav class="golden-spellbook__tabs" aria-label="已经发现的字">${entries.map(
        (entry, index) => `<button type="button" data-spellbook-id="${entry.id}" aria-current="${entry.id === active.id ? "page" : "false"}"><span>${entry.glyph}</span><small>第 ${index + 1} 个发现</small></button>`,
      ).join("")}</nav>
      <article class="golden-spellbook__page" data-testid="spellbook-page-${active.id}">
        <div class="golden-spellbook__glyph" lang="zh-Hans">${active.glyph}</div>
        <div class="golden-spellbook__facts">
          <h3>${active.pinyin} · ${active.familiarWord}</h3>
          <p>${active.shortMeaning}</p>
          <dl>
            <div><dt>结构</dt><dd>${STRUCTURE_LABELS[active.structure]}</dd></div>
            <div><dt>部件</dt><dd>${active.components.map((component) => component.glyph).join(" + ")}</dd></div>
            <div><dt>世界变化</dt><dd>${active.magic.effect}</dd></div>
          </dl>
          ${replayMode === "formation" ? `<div class="golden-spellbook__replay" data-testid="spellbook-formation-replay"><span>${active.components.map((component) => component.glyph).join(" + ")}</span><i aria-hidden="true">→</i><strong>${active.glyph}</strong></div>` : ""}
          ${replayMode === "magic" ? `<div class="golden-spellbook__replay golden-spellbook__replay--magic" data-testid="spellbook-magic-replay"><strong>${active.glyph}</strong><span>${active.magic.effect}</span></div>` : ""}
          <div class="golden-spellbook__actions">
            <button type="button" data-replay-formation="${active.id}">再看合字</button>
            <button type="button" data-replay-magic="${active.id}">再看魔法</button>
            <button type="button" data-read-character="${active.id}">读给我听</button>
          </div>
        </div>
      </article>
      <button class="golden-primary" type="button" data-finish-run>让营地继续亮着</button>
    </div>
  </section>`;
}

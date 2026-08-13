import { getV1Character } from "../../../games/hanzi-radical-battle/v2/golden-slice/content/adventures";
import type { GoldenCharacterId } from "../../../games/hanzi-radical-battle/v2/golden-slice/content/types";
import {
  AudioDirector,
  DEFAULT_AUDIO_SETTINGS,
} from "../../../games/hanzi-radical-battle/v2/golden-slice/phaser/AudioDirector";
import { WORLD_COPY } from "../world-copy";

export interface WorldSpellbookHandle { destroy(): void; }

export function mountWorldSpellbook(
  root: HTMLElement,
  entries: readonly GoldenCharacterId[],
  muted: boolean,
  onClose: () => void,
  title: string = WORLD_COPY.spellbookTitle,
): WorldSpellbookHandle {
  let activeId = entries[0] ?? null;
  const audio = new AudioDirector({
    ...DEFAULT_AUDIO_SETTINGS,
    muted,
    volumes: { ...DEFAULT_AUDIO_SETTINGS.volumes },
  });

  const render = (): void => {
    const active = activeId ? getV1Character(activeId) : null;
    root.innerHTML = `<section class="world-modal" role="dialog" aria-modal="true" aria-labelledby="world-spellbook-title" data-testid="world-spellbook">
      <div class="world-modal__panel world-spellbook">
        <span class="world-kicker">营地收藏</span>
        <h2 id="world-spellbook-title">${title}</h2>
        ${entries.length ? `<nav aria-label="已经发现的字" class="world-spellbook__tabs">${entries.map((id) => {
          const character = getV1Character(id);
          return `<button type="button" data-world-spellbook-id="${id}" aria-current="${id === activeId ? "page" : "false"}">${character.glyph}</button>`;
        }).join("")}</nav>` : `<p class="world-empty-spellbook">${WORLD_COPY.emptySpellbook}</p>`}
        ${active ? `<article class="world-spellbook__page" data-testid="world-spellbook-page-${active.id}">
          <div class="world-spellbook__glyph" lang="zh-Hans">${active.glyph}</div>
          <div><h3>${active.pinyin} · ${active.familiarWord}</h3><p>${active.shortMeaning}</p><p>${active.components.map((part) => part.glyph).join(" + ")} → ${active.glyph}</p><p>${active.magic.effect}</p><button type="button" data-world-read-character="${active.id}">读给我听</button></div>
        </article>` : ""}
        <button class="world-secondary-button" type="button" data-world-modal-close>${WORLD_COPY.closeAction}</button>
      </div>
    </section>`;
    root.querySelectorAll<HTMLElement>("[data-world-spellbook-id]").forEach((button) => {
      button.addEventListener("click", () => {
        activeId = button.dataset.worldSpellbookId as GoldenCharacterId;
        render();
      });
    });
    root.querySelector<HTMLElement>("[data-world-read-character]")?.addEventListener("click", () => {
      if (!activeId) return;
      void audio.speak(getV1Character(activeId).spokenPhrase);
    });
    root.querySelector<HTMLElement>("[data-world-modal-close]")?.addEventListener("click", onClose);
  };

  render();
  return { destroy() { audio.destroy(); root.replaceChildren(); } };
}

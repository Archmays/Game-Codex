import { WORLD_COPY } from "../world-copy";
import type { WorldHomeSettings } from "../world-state";

export interface WorldSettingsHandle { destroy(): void; }

export function mountWorldSettings(
  root: HTMLElement,
  settings: WorldHomeSettings,
  onChange: (next: Partial<WorldHomeSettings>) => boolean,
  onClose: () => void,
): WorldSettingsHandle {
  root.innerHTML = `<section class="world-modal" role="dialog" aria-modal="true" aria-labelledby="world-settings-title" data-testid="world-settings">
    <div class="world-modal__panel world-settings">
      <h2 id="world-settings-title">${WORLD_COPY.settingsAction}</h2>
      <label><input type="checkbox" data-world-muted ${settings.muted ? "checked" : ""}><span>静音</span></label>
      <label><input type="checkbox" data-world-reduced-motion ${settings.reducedMotion ? "checked" : ""}><span>减少动态</span></label>
      <p data-world-settings-status role="status">声音关闭也能看清世界。</p>
      <button class="world-secondary-button" type="button" data-world-modal-close>${WORLD_COPY.closeAction}</button>
    </div>
  </section>`;
  const status = root.querySelector<HTMLElement>("[data-world-settings-status]");
  root.querySelector<HTMLInputElement>("[data-world-muted]")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (!onChange({ muted: input.checked })) {
      input.checked = !input.checked;
      if (status) status.textContent = "这次没有改动，本机记录仍然安全。";
    }
  });
  root.querySelector<HTMLInputElement>("[data-world-reduced-motion]")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (!onChange({ reducedMotion: input.checked })) {
      input.checked = !input.checked;
      if (status) status.textContent = "这次没有改动，本机记录仍然安全。";
    }
  });
  root.querySelector<HTMLElement>("[data-world-modal-close]")?.addEventListener("click", onClose);
  return { destroy() { root.replaceChildren(); } };
}

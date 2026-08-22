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
      <section class="world-parent-corner" aria-labelledby="world-parent-corner-title">
        <p>家长角</p>
        <h3 id="world-parent-corner-title">备份或恢复这台浏览器里的游戏进度</h3>
        <button class="world-secondary-button" type="button" data-world-vault-open>打开游戏进度保险箱</button>
        <div data-world-vault-host></div>
      </section>
      <button class="world-secondary-button" type="button" data-world-modal-close>${WORLD_COPY.closeAction}</button>
    </div>
  </section>`;
  let vaultHandle: { destroy(): void } | null = null;
  let destroyed = false;
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
  root.querySelector<HTMLButtonElement>("[data-world-vault-open]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const host = root.querySelector<HTMLElement>("[data-world-vault-host]");
    if (!host || destroyed) return;
    button.disabled = true;
    button.textContent = "正在打开保险箱……";
    try {
      const { mountSaveVaultPanel } = await import("./SaveVaultPanel");
      if (destroyed) return;
      vaultHandle?.destroy();
      vaultHandle = mountSaveVaultPanel(host);
      button.hidden = true;
      host.querySelector<HTMLElement>("button, input")?.focus();
    } catch {
      button.disabled = false;
      button.textContent = "再试一次打开保险箱";
      if (status) status.textContent = "保险箱暂时没有打开；游戏进度没有改变。";
    }
  });
  root.querySelector<HTMLElement>("[data-world-modal-close]")?.addEventListener("click", onClose);

  const keydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...root.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), summary, a[href]")]
      .filter((control) => control.getClientRects().length > 0);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  root.addEventListener("keydown", keydown);
  root.querySelector<HTMLInputElement>("input")?.focus();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener("keydown", keydown);
      vaultHandle?.destroy();
      root.replaceChildren();
    },
  };
}

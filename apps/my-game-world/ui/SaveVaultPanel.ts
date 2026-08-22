import { EXPORTABLE_SAVE_KEYS, KNOWN_SAVE_KEYS } from "../../../packages/data/saveKeyInventory";
import {
  clearAllKnownGameSaves,
  createSaveVaultBackup,
  restoreSaveVault,
  saveVaultFilename,
  serializeSaveVaultBackup,
  validateSaveVaultText,
  type ValidatedSaveVault,
} from "../../../packages/save-vault";

export interface SaveVaultPanelHandle {
  destroy(): void;
}

function downloadBackup(backupText: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([backupText], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setText(root: HTMLElement, selector: string, value: string): void {
  const node = root.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function renderKeyList(root: HTMLElement, selector: string, keys: readonly string[]): void {
  const list = root.querySelector<HTMLElement>(selector);
  if (!list) return;
  list.replaceChildren(...keys.map((key) => {
    const item = document.createElement("li");
    item.textContent = key;
    return item;
  }));
}

export function mountSaveVaultPanel(root: HTMLElement, storage: Storage = window.localStorage): SaveVaultPanelHandle {
  let validated: ValidatedSaveVault | null = null;
  let exportedThisSession = false;
  let destroyed = false;

  root.innerHTML = `<section class="save-vault" aria-labelledby="save-vault-title" data-testid="save-vault">
    <header><p>家长角 · 只在这台浏览器里工作</p><h3 id="save-vault-title">游戏进度保险箱</h3></header>
    <p>这里不会上传任何内容，也不会读取其他 localhost 应用。导出文件只包含 Game-Codex 的已知存档键。</p>
    <div class="save-vault__actions">
      <button type="button" data-vault-export>备份游戏进度</button>
      <label class="save-vault__file">选择备份文件<input type="file" accept="application/json,.json" data-vault-file /></label>
    </div>
    <p class="save-vault__status" role="status" aria-live="polite" data-vault-status>可以先导出一份备份，再预览需要恢复的文件。</p>
    <section class="save-vault__preview" hidden data-vault-preview aria-labelledby="save-vault-preview-title">
      <h4 id="save-vault-preview-title">恢复前预览</h4>
      <dl>
        <div><dt>格式 / 版本</dt><dd data-vault-preview-format></dd></div>
        <div><dt>条目</dt><dd data-vault-preview-count></dd></div>
        <div><dt>已知 / 未知 / 较新</dt><dd data-vault-preview-keys></dd></div>
        <div><dt>总字节</dt><dd data-vault-preview-bytes></dd></div>
        <div><dt>校验</dt><dd data-vault-preview-checksum></dd></div>
      </dl>
      <details><summary>只显示未知键（不会恢复）</summary><ul data-vault-unknown-list></ul></details>
      <button type="button" data-vault-restore disabled>恢复这些已知进度</button>
    </section>
    <details class="save-vault__known"><summary>查看保险箱管理的 ${EXPORTABLE_SAVE_KEYS.length} 个已知存档键</summary><ul data-vault-known-list></ul></details>
    <section class="save-vault__clear" aria-labelledby="save-vault-clear-title">
      <h4 id="save-vault-clear-title">清空全部 Game-Codex 进度</h4>
      <p>只有先在本次打开中导出备份后才可使用。未知键、其他应用和浏览器设置不会删除。</p>
      <button type="button" data-vault-clear disabled>清空已知游戏进度</button>
    </section>
  </section>`;

  renderKeyList(root, "[data-vault-known-list]", KNOWN_SAVE_KEYS.filter((entry) => entry.exportable).map((entry) => entry.key));
  const status = root.querySelector<HTMLElement>("[data-vault-status]");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-vault-clear]");
  const restoreButton = root.querySelector<HTMLButtonElement>("[data-vault-restore]");
  const preview = root.querySelector<HTMLElement>("[data-vault-preview]");

  const exportButton = root.querySelector<HTMLButtonElement>("[data-vault-export]");
  exportButton?.addEventListener("click", async () => {
    if (!status || destroyed) return;
    exportButton.disabled = true;
    status.textContent = "正在本机整理已知进度……";
    try {
      const now = new Date();
      const backup = await createSaveVaultBackup(storage, { now });
      downloadBackup(serializeSaveVaultBackup(backup), saveVaultFilename(now));
      exportedThisSession = true;
      if (clearButton) clearButton.disabled = false;
      status.textContent = `备份已下载：${backup.entries.length} 个已存在存档，校验 ${backup.manifestSha256.slice(0, 12)}…。`;
    } catch {
      status.textContent = "这次没有生成备份；本机进度没有改变。";
    } finally {
      exportButton.disabled = false;
    }
  });

  const fileInput = root.querySelector<HTMLInputElement>("[data-vault-file]");
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    validated = null;
    if (restoreButton) restoreButton.disabled = true;
    if (preview) preview.hidden = true;
    if (!file || !status || destroyed) return;
    status.textContent = "正在本机校验备份；此时不会写入任何进度……";
    try {
      validated = await validateSaveVaultText(await file.text());
      const info = validated.preview;
      setText(root, "[data-vault-preview-format]", `${info.format} / v${info.version}`);
      setText(root, "[data-vault-preview-count]", String(info.entriesCount));
      setText(root, "[data-vault-preview-keys]", `${info.knownKeys.length} / ${info.unknownKeys.length} / ${info.futureKeys.length}`);
      setText(root, "[data-vault-preview-bytes]", String(info.totalBytes));
      setText(root, "[data-vault-preview-checksum]", info.checksum);
      renderKeyList(root, "[data-vault-unknown-list]", info.unknownKeys.length ? info.unknownKeys : ["无"]);
      if (preview) preview.hidden = false;
      if (restoreButton) restoreButton.disabled = false;
      status.textContent = info.unknownKeys.length
        ? `预览完成：${info.unknownKeys.length} 个未知键会跳过，不会写入。`
        : "预览完成；尚未写入任何进度。";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "这个备份无法安全预览。";
    }
  });

  restoreButton?.addEventListener("click", () => {
    if (!validated || !status || destroyed) return;
    if (!window.confirm(`恢复 ${validated.preview.knownKeys.length} 个已知存档键？未知键会跳过。`)) return;
    try {
      const result = restoreSaveVault(storage, validated);
      status.textContent = `已恢复 ${result.restoredKeys.length} 个已知存档；${result.skippedUnknownKeys.length} 个未知键已跳过。请刷新页面查看。`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "恢复没有完成；本机记录已回滚。";
    }
  });

  clearButton?.addEventListener("click", () => {
    if (!status || destroyed || !exportedThisSession) return;
    const exactKeys = EXPORTABLE_SAVE_KEYS.map((entry) => entry.key).join("\n");
    if (!window.confirm(`只清空下面这些 Game-Codex 已知键中当前存在的值：\n\n${exactKeys}\n\n继续吗？`)) return;
    try {
      const result = clearAllKnownGameSaves(storage, "CONFIRMED_AFTER_EXPORT");
      status.textContent = `已清空 ${result.clearedKeys.length} 个已知存档。其他浏览器数据未触碰。`;
      clearButton.disabled = true;
      exportedThisSession = false;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "清空没有完成；本机记录已回滚。";
    }
  });

  return {
    destroy(): void {
      destroyed = true;
      root.replaceChildren();
    },
  };
}

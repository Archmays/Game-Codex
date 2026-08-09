import { VISUAL_DIRECTIONS } from "../content/visual-directions";
import type { PilotSaveState } from "../save/schema";

export function settingsOverlayMarkup(save: PilotSaveState, open: boolean): string {
  if (!open) return "";
  const themes = VISUAL_DIRECTIONS.map(
    (theme) => `<button type="button" class="theme-chip ${save.selectedThemeForReview === theme.id ? "is-selected" : ""}" data-setting-theme="${theme.id}" aria-pressed="${save.selectedThemeForReview === theme.id}">
      <span class="theme-chip__swatch" style="--swatch:${theme.tokens.primary};--swatch-accent:${theme.tokens.accent}"></span>
      ${theme.id} · ${theme.name}
    </button>`,
  ).join("");
  return `<div class="pilot-settings" role="dialog" aria-modal="true" aria-label="游戏设置" data-testid="settings-overlay">
    <div class="pilot-settings__panel">
      <div class="pilot-settings__heading">
        <div><span class="eyebrow">本机设置</span><h3>让这段魔法更舒服</h3></div>
        <button class="icon-button" type="button" data-settings-close aria-label="关闭设置">关闭</button>
      </div>
      <div class="pilot-settings__themes" aria-label="审核视觉方向">${themes}</div>
      <label class="setting-row"><span><strong>安静模式</strong><small>关掉轻声读字和提示音</small></span><input type="checkbox" data-setting-muted ${save.muted ? "checked" : ""}></label>
      <label class="setting-row"><span><strong>减少动态</strong><small>缩短聚合与移动，保留清晰阶段变化</small></span><input type="checkbox" data-setting-motion ${save.reducedMotion ? "checked" : ""}></label>
      <button class="text-button text-button--danger" type="button" data-reset-progress>清除这台设备上的 Pilot 记录</button>
      <p class="pilot-settings__privacy">只保存灯是否修好、字灵书条目、设置与最小事件编号；没有姓名、自由文本或联网记录。</p>
    </div>
  </div>`;
}

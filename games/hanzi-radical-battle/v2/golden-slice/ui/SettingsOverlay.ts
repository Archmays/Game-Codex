import type { AudioBusId, GoldenSliceAudioSettings } from "../phaser/AudioDirector";

const BUS_LABELS: Record<AudioBusId, string> = {
  master: "全部声音",
  music: "音乐",
  ambience: "环境",
  sfx: "魔法音效",
  voice: "读音",
  ui: "按钮",
};

export function settingsOverlayMarkup(options: {
  open: boolean;
  reducedMotion: boolean;
  audio: GoldenSliceAudioSettings;
  childFirstUse?: boolean;
}): string {
  if (!options.open) return "";
  return `<section class="golden-modal golden-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-testid="settings-overlay">
    <div class="golden-modal__panel">
      <h2 id="settings-title">声音和画面</h2>
      <label class="golden-toggle"><input type="checkbox" data-setting-muted ${options.audio.muted ? "checked" : ""} /><span>静音</span></label>
      <label class="golden-toggle"><input type="checkbox" data-setting-motion ${options.reducedMotion ? "checked" : ""} /><span>减少动态</span></label>
      ${options.childFirstUse ? "" : `<div class="golden-volume-grid">${(Object.keys(BUS_LABELS) as AudioBusId[])
        .map((id) => `<label><span>${BUS_LABELS[id]}</span><input type="range" min="0" max="1" step="0.05" value="${options.audio.volumes[id]}" data-audio-bus="${id}" /></label>`)
        .join("")}</div>`}
      <div class="golden-settings__actions">
        ${options.childFirstUse ? "" : `<button type="button" data-export-events>家长导出本机试玩记录</button>
        <button type="button" data-reset-progress>家长清除营地记录</button>`}
        <button class="golden-primary" type="button" data-settings-close>回到冒险</button>
      </div>
      <p class="golden-privacy-copy">${options.childFirstUse ? "声音关闭也能继续冒险。" : "只在本机保存营地、魔法书、选择、设置和最小试玩事件；不是成绩，也不会上传。"}</p>
    </div>
  </section>`;
}

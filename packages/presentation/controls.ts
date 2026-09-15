import { PRODUCT_VERSION, type Presentation } from './settings';

export const presentationControls = (p: Presentation) => `<div class="presentation-controls">
  <label>音乐 <input data-presentation-music type="range" min="0" max="100" step="1" value="${Math.round(p.music*100)}"><output data-music-value>${Math.round(p.music*100)}%</output></label>
  <label>音效 <input data-presentation-effects type="range" min="0" max="100" step="1" value="${Math.round(p.effects*100)}"><output data-effects-value>${Math.round(p.effects*100)}%</output></label>
  <button type="button" data-presentation-low aria-pressed="${p.lowPerformance}">低性能模式</button>
  <button type="button" data-presentation-guide>重看操作小引导</button>
  <button type="button" data-presentation-retry hidden>重试声音</button>
  <p data-presentation-status></p>
  <details><summary>制作与素材 · v${PRODUCT_VERSION}</summary><p>设计与制作：Archmays / Codex。插画：本项目 ChatGPT image 生成及原有 Kenney CC0 素材。配乐：原创合成主题与环境声。汉字由规范字体显示，法术不作为字源解释。</p><a tabindex="0" href="?playtest=step4">版本说明与本机反馈</a></details>
</div>`;
export function bindPresentationControls(root: HTMLElement, value: Presentation, changed: () => void, guide: () => void, retry: () => void): () => void {
  const input = (event: Event) => {
    const node = event.target as HTMLInputElement;
    for (const key of ['music','effects'] as const) if (node.hasAttribute(`data-presentation-${key}`)) {
      value[key] = Number(node.value)/100; root.querySelector(`[data-${key}-value]`)!.textContent = `${node.value}%`; changed();
    }
  };
  const click = (event: Event) => {
    const node=(event.target as HTMLElement).closest('button'); if (!node) return;
    if (node.hasAttribute('data-presentation-low')) { value.lowPerformance=!value.lowPerformance;node.setAttribute('aria-pressed',String(value.lowPerformance));changed(); }
    if (node.hasAttribute('data-presentation-guide')) guide();
    if (node.hasAttribute('data-presentation-retry')) retry();
  };
  root.addEventListener('input',input);root.addEventListener('click',click);
  return ()=>{root.removeEventListener('input',input);root.removeEventListener('click',click);};
}

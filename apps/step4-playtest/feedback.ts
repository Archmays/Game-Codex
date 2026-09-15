export const FEEDBACK_KEY = 'family-games/step4-playtest/feedback-v1';
// Keep existing IDs valid so saved, manually written feedback remains readable.
export const PLAYTEST_PLACES = ['homeward', 'lamplight', 'confluence', 'qinglan-pass', 'twin-bends', 'beacon-keep', 'input-other', 'companions', 'companions-1', 'companions-2', 'companions-3', 'companions-4', 'companions-5', 'qinglan-intercept', 'qinglan-last-bend', 'twin-lanes', 'twin-relay', 'beacon-crowd', 'beacon-captain'] as const;
export const INPUT_MODES = ['keyboard', 'mouse', 'touch', 'mixed'] as const;
export interface PlaytestFeedback {
  version: 1;
  place: typeof PLAYTEST_PLACES[number];
  input: typeof INPUT_MODES[number];
  text: string;
  build?: string;
  productVersion?: string;
}
export function parseFeedback(raw: string | null): PlaytestFeedback | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || !PLAYTEST_PLACES.includes(v.place as PlaytestFeedback['place']) || !INPUT_MODES.includes(v.input as PlaytestFeedback['input']) || typeof v.text !== 'string' || !v.text.trim() || v.text.length > 4000) return null;
    if (v.build !== undefined && (typeof v.build !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(v.build))) return null;
    if (v.productVersion !== undefined && (typeof v.productVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(v.productVersion))) return null;
    return { version: 1, place: v.place as PlaytestFeedback['place'], input: v.input as PlaytestFeedback['input'], text: v.text, ...(typeof v.build === 'string' ? { build: v.build } : {}), ...(typeof v.productVersion === 'string' ? {productVersion:v.productVersion} : {}) };
  } catch { return null; }
}
export function feedbackMarkdown(feedback: PlaytestFeedback, build: string): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
  return `# Game-Codex 本机试玩反馈\n\n产品版本：${escape(feedback.productVersion ?? '旧记录未保存产品版本')}\n\n记录版本：${escape(feedback.build ?? '旧记录未保存版本')}\n\n导出页面版本：${escape(build)}\n\n章节／房间／地图／短局：${feedback.place}\n\n操作方式：${feedback.input}\n\n${feedback.text.split(/\r?\n/).map(line => `> ${escape(line)}`).join('\n')}\n`;
}

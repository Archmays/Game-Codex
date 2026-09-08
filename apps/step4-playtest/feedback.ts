export const FEEDBACK_KEY = 'family-games/step4-playtest/feedback-v1';
export const PLAYTEST_PLACES = ['homeward', 'lamplight', 'confluence', 'qinglan-pass', 'twin-bends', 'beacon-keep', 'input-other'] as const;
export const INPUT_MODES = ['keyboard', 'mouse', 'touch', 'mixed'] as const;
export interface PlaytestFeedback {
  version: 1;
  place: typeof PLAYTEST_PLACES[number];
  input: typeof INPUT_MODES[number];
  text: string;
}
export function parseFeedback(raw: string | null): PlaytestFeedback | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || !PLAYTEST_PLACES.includes(v.place as PlaytestFeedback['place']) || !INPUT_MODES.includes(v.input as PlaytestFeedback['input']) || typeof v.text !== 'string' || !v.text.trim() || v.text.length > 4000) return null;
    return { version: 1, place: v.place as PlaytestFeedback['place'], input: v.input as PlaytestFeedback['input'], text: v.text };
  } catch { return null; }
}
export function feedbackMarkdown(feedback: PlaytestFeedback, build: string): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
  return `# Game-Codex STEP4 本机试玩反馈\n\n版本：${escape(build)}\n\n章节／地图：${feedback.place}\n\n操作方式：${feedback.input}\n\n${feedback.text.split(/\r?\n/).map(line => `> ${escape(line)}`).join('\n')}\n`;
}

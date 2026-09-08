import { FEEDBACK_KEY, feedbackMarkdown, parseFeedback } from '../apps/step4-playtest/feedback';
import { KNOWN_SAVE_KEY_BY_NAME } from '../packages/data/saveKeyInventory';

describe('manual STEP4 feedback', () => {
  it('creates no valid record without actual text and rejects unknown/future/oversized records', () => {
    const valid = { version: 1, place: 'lamplight', input: 'keyboard', text: '在影路上撤销后可以继续。' };
    expect(parseFeedback(JSON.stringify(valid))).toEqual(valid);
    for (const bad of [null, '', '{broken', JSON.stringify({...valid, text:'   '}), JSON.stringify({...valid,version:2}), JSON.stringify({...valid,place:'arbitrary'}), JSON.stringify({...valid,text:'x'.repeat(4001)})]) expect(parseFeedback(bad)).toBeNull();
    expect(KNOWN_SAVE_KEY_BY_NAME.get(FEEDBACK_KEY)).toMatchObject({ exportable:true, maxVersion:1, purpose:'feedback' });
  });
  it('escapes HTML and Markdown syntax in a text-only export', () => {
    const result = feedbackMarkdown({version:1,place:'lamplight',input:'touch',text:'<img src=x>\n[link](https://example.invalid)\n```\n# text'},'local-source');
    expect(result).not.toContain('<img'); expect(result).not.toContain('[link](');
    expect(result).toContain('&lt;img src=x&gt;');
    expect(result.split('\n').filter(x => x.startsWith('> '))).toHaveLength(4);
  });
});

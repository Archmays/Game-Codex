import { expect, test } from '@playwright/test';
import { activate, fromHome, keyReach } from './input-helpers';

const feedbackKey = 'family-games/step4-playtest/feedback-v1';
const scenarios = ['qinglan-intercept','qinglan-last-bend','twin-lanes','twin-relay','beacon-crowd','beacon-captain'];

test('@step5-entry existing trial page exposes exact new modes and keeps feedback local', async ({page}, info) => {
  test.skip(!['desktop','phone-390','firefox','webkit'].includes(info.project.name));
  const mode = ['phone-390','webkit'].includes(info.project.name) ? 'touch' : 'keyboard';
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(String(info.project.use.baseURL)).origin;
  page.on('request', request => { const u = new URL(request.url()); if (/^https?:$/.test(u.protocol) && u.origin !== origin) external.push(u.href); });
  await fromHome(page, mode, 'playtest');
  await expect(page.getByRole('heading', {name:'本次试玩', exact:true})).toBeVisible();
  await expect(page.locator('.step4-kicker')).toHaveText('GAME-CODEX · v1.0.0');
  await expect(page.locator('[data-playtest-entry]')).toHaveCount(13);
  await expect(page.locator('[data-playtest-entry][href*="chapter=companions"]')).toHaveCount(1);
  for (const id of scenarios) await expect(page.locator(`[data-playtest-scenario="${id}"]`)).toHaveAttribute('href', `?play=hanzi-tower-defense&scenario=${id}&from=world`);
  for (let room=1; room<=5; room++) await expect(page.locator(`option[value="companions-${room}"]`)).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('family-games/step4-playtest/feedback-v1'))).toBeNull();
  if (mode === 'keyboard') {
    await keyReach(page,'[data-feedback-place]'); await page.keyboard.press('Home');
    // Native select navigation uses observed options; no game shortcut or fixed Tab sequence.
    const count = await page.locator('[data-feedback-place] option').count();
    for (let i=0; i<count; i++) {
      if (await page.locator('[data-feedback-place]').inputValue() === 'companions-2') break;
      await page.keyboard.press('ArrowDown');
    }
    await keyReach(page,'[data-feedback-text]'); await page.keyboard.insertText('举灯后切换友。Q X C H'); await page.keyboard.press('Space');
  } else {
    await page.locator('[data-feedback-place]').selectOption('companions-2');
    await page.locator('[data-feedback-text]').tap(); await page.locator('[data-feedback-text]').fill('举灯后切换友。Q X C H ');
  }
  await expect(page.locator('[data-feedback-text]')).toHaveValue('举灯后切换友。Q X C H ');
  await activate(page,'[data-feedback-save]',mode);
  const raw = await page.evaluate(key => localStorage.getItem(key),feedbackKey);
  expect(JSON.parse(raw!)).toMatchObject({version:1,place:'companions-2',text:'举灯后切换友。Q X C H'});
  expect(JSON.parse(raw!).build).toBe(await page.locator('[data-step4-sha]').textContent());
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('family-games/hanzi-')))).toEqual([]);
  await page.reload(); await expect(page.locator('[data-feedback-text]')).toHaveValue('举灯后切换友。Q X C H');
  expect(await page.evaluate(key => localStorage.getItem(key),feedbackKey)).toBe(raw);
  await activate(page,'.step4-playtest header a',mode); await expect(page.getByTestId('my-game-world')).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('@step5-entry feedback cross-page save conflict protects the other page text', async ({page,context},info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('./?playtest=step4'); await page.locator('[data-feedback-text]').fill('第一页准备的反馈');
  const second = await context.newPage(); await second.goto('./?playtest=step4');
  await second.locator('[data-feedback-text]').fill('第二页已保存的反馈'); await second.locator('[data-feedback-save]').click();
  const original = await second.evaluate(key=>localStorage.getItem(key),feedbackKey);
  await page.bringToFront(); await page.locator('[data-feedback-save]').click();
  await expect(page.locator('[data-feedback-status]')).toContainText('原记录已保护');
  await expect(page.locator('[data-feedback-save]')).toBeDisabled();
  await expect(page.locator('[data-feedback-export]')).toBeEnabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),feedbackKey)).toBe(original);
  await second.close();
});

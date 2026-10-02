import { test, expect } from '@playwright/test';

const key = 'family-games/memory-match/v1';
for (const [kind, raw] of [['future', '{ "version": 99, "untouched": [1,2] }'], ['corrupt', '{broken'], ['shape', '{"version":1,"recentRelationIds":5}']] as const) {
  test(`memory save ${kind} survives mount, real play, refresh and Vault export`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key, raw });
    await page.goto('/?play=memory-card');
    await expect(page.getByTestId('memory-match')).toBeVisible();
    await expect(page.getByText('本机进度暂未保存')).toBeVisible();
    await page.getByText('怎么玩 · 按键', { exact: true }).click();
    await page.getByText('本机进度暂未保存').click();
    await page.locator('[data-pack-id="glyph-pinyin"]').click();
    await expect(page.locator('[data-memory-help]')).toHaveAttribute('open', '');
    await expect(page.locator('[data-memory-recovery]')).toHaveAttribute('open', '');
    await page.locator('[data-card-id]').first().click();
    await page.locator('[data-card-id]').nth(1).click();
    await page.getByRole('button', { name: '重新铺开', exact: true }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    await page.reload();
    await expect(page.getByText('本机进度暂未保存')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    await page.getByText('本机进度暂未保存').click();
    await page.getByRole('link', { name: '回首页查看设置' }).click();
    await page.getByRole('button', { name: /家长角/ }).click();
    await page.getByRole('button', { name: '打开游戏进度保险箱' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '备份游戏进度' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const parts: Buffer[] = [];
    for await (const part of stream!) parts.push(Buffer.from(part));
    const backup = JSON.parse(Buffer.concat(parts).toString('utf8'));
    expect(backup.entries.find((entry: { key: string }) => entry.key === key).value).toBe(raw);
    expect(errors).toEqual([]);
  });
}

test('denied local storage and quota failure keep memory playable with truthful status', async ({ browser, baseURL }) => {
  for (const failure of ['denied', 'quota']) {
    const context = await browser.newContext({ baseURL });
    await context.addInitScript(failure => {
      if (failure === 'denied') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Synthetic denied', 'SecurityError'); } });
      else Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); };
    }, failure);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?play=memory-card');
    await expect(page.getByTestId('memory-match')).toBeVisible();
    await expect(page.getByText('本机进度暂未保存')).toBeVisible();
    await page.locator('[data-card-id]').first().click();
    await expect(page.locator('[data-card-id]').first()).toHaveAttribute('data-open', 'true');
    expect(errors).toEqual([]);
    await context.close();
  }
});

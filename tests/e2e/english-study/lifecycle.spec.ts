import { expect, test } from '@playwright/test';

test('leaving and reopening cancels writing frames and removes page lifecycle listeners', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const pending = new Set<number>(), request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    Object.assign(window, { studyPendingFrames: pending });
    window.requestAnimationFrame = callback => {
      const id = request(time => { pending.delete(id); callback(time); }); pending.add(id); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  });
  await page.goto('/tests/e2e/english-study/lifecycle.html');
  for (let round = 0; round < 2; round++) {
    await page.locator('[data-test-mount]').click();
    await page.locator('[data-es-results] button').first().click();
    await page.locator('[data-es-word-pane] [data-es-control=play]').click();
    await expect(page.locator('[data-es-word-status]')).toContainText('正在写');
    // F8 is the fixture owner's route-exit action and works while its modal is open.
    await page.keyboard.press('F8');
    expect(await page.evaluate(() => (window as unknown as { studyPendingFrames: Set<number> }).studyPendingFrames.size)).toBe(0);
    await expect(page.locator('[data-testid=english-study]')).toHaveCount(0);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('resize'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    });
  }
  expect(errors).toEqual([]);
});

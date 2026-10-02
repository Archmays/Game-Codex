import { expect, test } from '@playwright/test';

test('route ownership releases handwriting worker, animation frames and listeners before remount', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const pending = new Set<number>(), request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const workers = { created: 0, terminated: 0 }, Native = Worker;
    Object.assign(window, { studyLifecycle: { pending, workers } });
    window.requestAnimationFrame = callback => { const id = request(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers.created++; }
      terminate() { workers.terminated++; super.terminate(); }
    };
  });
  await page.goto('/tests/e2e/hanzi-stroke-lab/lifecycle.html');
  for (let round = 0; round < 2; round++) {
    await page.locator('[data-test-mount]').click();
    await page.locator('[data-index-ready=true]').waitFor();
    await page.locator('[data-pane=hand]').click();
    await expect(page.locator('[data-hand-status]')).toHaveText('写一个字，停笔后选候选。');
    await page.locator('[data-pane=query]').click();
    await page.locator('#hsl-input').fill('天天'); await page.locator('[data-search] button').click();
    await expect(page.locator('[data-occurrence] [data-play]:not(:disabled)')).toHaveCount(2);
    await page.locator('[data-group-play]').click();
    await expect(page.locator('[data-group-status]')).toContainText('依次播放');
    await page.keyboard.press('F8');
    expect(await page.evaluate(() => {
      const state = (window as unknown as { studyLifecycle: { pending: Set<number>; workers: { created: number; terminated: number } } }).studyLifecycle;
      return { pending: state.pending.size, activeWorkers: state.workers.created - state.workers.terminated };
    })).toEqual({ pending: 0, activeWorkers: 0 });
    await expect(page.locator('[data-testid=hanzi-stroke-lab]')).toHaveCount(0);
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  expect(errors).toEqual([]);
});

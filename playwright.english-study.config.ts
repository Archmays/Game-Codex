import { defineConfig } from '@playwright/test';

const port = Number(process.env.ENGLISH_PORT ?? 4191);
const baseURL = process.env.ENGLISH_BASE ?? `http://127.0.0.1:${port}/`;
const evidence = process.env.GAME_CODEX_EVIDENCE_ROOT ?? 'test-results';
export default defineConfig({
  testDir: 'tests/e2e/english-study',
  outputDir: `${evidence}/english-study`,
  timeout: 45000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 900 } } },
    { name: 'chromium-360-touch', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-390-touch', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-tablet-portrait-touch', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-tablet-landscape-touch', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1366, height: 900 } } },
    { name: 'webkit-390-touch', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: process.env.ENGLISH_BASE ? undefined : { command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 30000 },
});

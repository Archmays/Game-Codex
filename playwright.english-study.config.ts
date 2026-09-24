import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/english-study',
  outputDir: 'tmp/tasks/ENGLISH-STUDY/test-results',
  timeout: 45000,
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5175/', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 900 } } },
    { name: 'chromium-360-touch', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-390-touch', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-tablet-portrait-touch', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'chromium-tablet-landscape-touch', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1366, height: 900 } } },
    { name: 'webkit-390-touch', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: { command: 'pnpm run play:my-game-world', url: 'http://127.0.0.1:5175', reuseExistingServer: true, timeout: 30000 },
});

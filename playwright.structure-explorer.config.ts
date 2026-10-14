import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4196';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'structure-explorer.spec.ts',
  outputDir: 'test-results/structure-explorer', // Temporary browser review output.
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: [['list']],
  use: { baseURL, contextOptions: { reducedMotion: 'reduce' }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-360', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'mobile-360-landscape', use: { browserName: 'chromium', viewport: { width: 800, height: 360 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'mobile-390-landscape', use: { browserName: 'chromium', viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'tablet-768', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'tablet-1024', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `pnpm exec vite ${process.env.STRUCTURE_PREVIEW === '1' ? 'preview ' : ''}--host 127.0.0.1 --port 4196 --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

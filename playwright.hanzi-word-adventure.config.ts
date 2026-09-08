import { defineConfig, devices } from '@playwright/test';
const external = process.env.HWAY_URL;
const baseURL = external ?? 'http://127.0.0.1:5300';
export default defineConfig({
  testDir: './tests/e2e/hanzi-word-adventure', fullyParallel: false, forbidOnly: !!process.env.CI,
  retries: 0, workers: 1, timeout: 120_000, expect: { timeout: 10_000 },
  reporter: [['line']], outputDir: `${process.env.HWAY_EVIDENCE ?? 'tmp/tasks/GAME-CODEX-STEP2'}/browser-failures`,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'touch', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: external ? undefined : { command: 'pnpm exec vite --host 127.0.0.1 --port 5300 --strictPort', url: baseURL, reuseExistingServer: false },
});

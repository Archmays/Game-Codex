import { defineConfig, devices } from "@playwright/test";

const port = 5297;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/play-readiness",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000, toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.006 } },
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/play-readiness",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off", reducedMotion: "reduce" },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768-portrait", use: { ...devices["Desktop Chrome"], hasTouch: true, viewport: { width: 768, height: 1024 } } },
    { name: "tablet-1024-landscape", use: { ...devices["Desktop Chrome"], hasTouch: true, viewport: { width: 1024, height: 768 } } },
    { name: "desktop-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

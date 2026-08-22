import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ENGLISH_V2_PORT ?? "5322");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/english-v2",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 75_000,
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/english-v2",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  expect: { timeout: 12_000, toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", maxDiffPixelRatio: 0 } },
  use: { baseURL, locale: "zh-CN", timezoneId: "Asia/Shanghai", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-360", use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: { command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 120_000 },
});

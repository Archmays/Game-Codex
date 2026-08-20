import { defineConfig } from "@playwright/test";

const requestedPort = process.env.PLAYWRIGHT_PORT ?? "5197";
const port = /^\d{2,5}$/.test(requestedPort) ? Number(requestedPort) : 5197;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/hanzi-complete",
  testMatch: "visual.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/hanzi-complete/visual",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0,
    },
  },
  use: {
    baseURL,
    viewport: { width: 1366, height: 768 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

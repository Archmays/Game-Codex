import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.V1_PLAYWRIGHT_PORT ?? "5181");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/hanzi-v2",
  testMatch: /v1-(playthroughs|visual)\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/hanzi-v2/v1/playwright",
  snapshotPathTemplate: "test-results/hanzi-v2/v1/snapshots/{projectName}/{testFileName}/{arg}{ext}",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    reducedMotion: "reduce",
  },
  projects: [{ name: "desktop-chromium" }],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

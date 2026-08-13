import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.V1_PLAYWRIGHT_PORT ?? "5181");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /hanzi-magic-v2-v1(?:-visual|-hard-gates)?\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  outputDir: "artifacts/hanzi-radical-battle-v2/v1-release/traces/playwright",
  snapshotPathTemplate: "artifacts/hanzi-radical-battle-v2/v1-release/baselines/{projectName}/{testFileName}/{arg}{ext}",
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

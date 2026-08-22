import { defineConfig, devices } from "@playwright/test";

const port = 5306;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/natural-use-kit",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/natural-use-kit",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off", reducedMotion: "reduce", acceptDownloads: true },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

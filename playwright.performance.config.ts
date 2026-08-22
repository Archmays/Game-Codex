import { defineConfig, devices } from "@playwright/test";

const port = 5298;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/play-readiness",
  testMatch: "portfolio.spec.ts",
  grep: /@performance/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 180_000,
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/play-readiness-performance",
  use: { baseURL, trace: "off", screenshot: "only-on-failure", video: "off", reducedMotion: "reduce" },
  projects: [
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 120_000 },
});

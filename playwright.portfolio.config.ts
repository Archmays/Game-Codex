import { defineConfig, devices } from "@playwright/test";

const port = 5291;
const baseURL = `http://127.0.0.1:${port}`;
const preview = process.env.PORTFOLIO_SMOKE_PREVIEW === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "portfolio-smoke.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/portfolio-smoke",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off", reducedMotion: "reduce" },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: preview
      ? `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`
      : `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

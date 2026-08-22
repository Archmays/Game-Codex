import { defineConfig, devices } from "@playwright/test";

const port = 5307;
const baseURL = `http://127.0.0.1:${port}`;
const preview = process.env.SCROLL_REACHABILITY_PREVIEW === "1";

export default defineConfig({
  testDir: "./tests/e2e/scroll-reachability",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/scroll-reachability/artifacts",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off", reducedMotion: "reduce" },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], hasTouch: true, viewport: { width: 768, height: 1024 } } },
    { name: "landscape-1024", use: { ...devices["Desktop Chrome"], hasTouch: true, viewport: { width: 1024, height: 768 } } },
    { name: "desktop-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
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

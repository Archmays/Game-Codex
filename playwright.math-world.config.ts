import { defineConfig, devices } from "@playwright/test";

const port = 5292;
const preview = process.env.MATH_WORLD_PREVIEW === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "math-world*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000, toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.015 } },
  workers: 1,
  reporter: [["line"]],
  outputDir: "test-results/math-world",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { ...devices["iPad (gen 7)"], browserName: "chromium", viewport: { width: 768, height: 1024 } } },
    { name: "mobile-360", use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: `pnpm exec vite ${preview ? "preview " : ""}--host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

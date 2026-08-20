import { defineConfig } from "@playwright/test";

const requestedPort = process.env.PLAYWRIGHT_PORT ?? "5196";
const port = /^\d{2,5}$/.test(requestedPort) ? Number(requestedPort) : 5196;

export default defineConfig({
  testDir: "./tests/e2e/hanzi-complete",
  testMatch: "acceptance-matrix.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [["line"]],
  outputDir: "test-results/hanzi-complete/acceptance-matrix",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  webServer: { command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120_000 },
});

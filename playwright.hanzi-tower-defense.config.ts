import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/hanzi-tower-defense", fullyParallel: false, forbidOnly: !!process.env.CI,
  retries: 0, workers: 1, timeout: 600_000, expect: { timeout: 15_000 },
  reporter: [["line"]], outputDir: `${process.env.TD_EVIDENCE_DIR ?? 'tmp/tasks/GAME-CODEX-STEP3'}/browser-failures`,
  snapshotPathTemplate: `${process.cwd()}/${process.env.TD_EVIDENCE_DIR ?? 'tmp/tasks/GAME-CODEX-STEP3'}/visual-baseline/{projectName}/{arg}{ext}`,
  use: { baseURL: "http://127.0.0.1:5299", trace: "off", screenshot: "only-on-failure", video: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "touch", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "pnpm exec vite --host 127.0.0.1 --port 5299 --strictPort", url: "http://127.0.0.1:5299", reuseExistingServer: false },
});

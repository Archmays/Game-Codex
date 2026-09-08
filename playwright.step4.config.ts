import { defineConfig, devices, type Project } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const baseURL = process.env.STEP4_URL ?? 'http://127.0.0.1:5315';
const evidence = 'tmp/tasks/GAME-CODEX-STEP4';
const runtimes = resolve(evidence, 'browser-runtimes');
const executable = (family: string, relative: string) => {
  if (!existsSync(runtimes)) return undefined;
  const directory = readdirSync(runtimes).find(entry => entry.startsWith(`${family}-`));
  const file = directory ? resolve(runtimes, directory, relative) : '';
  return existsSync(file) ? file : undefined;
};
const firefox = executable('firefox', 'firefox/firefox.exe');
const webkit = executable('webkit', 'Playwright.exe');
const projects: Project[] = [
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: {width:1440,height:1000} } },
  { name: 'phone-390', use: { ...devices['Pixel 7'], viewport: {width:390,height:844} } },
  { name: 'phone-360', use: { ...devices['Pixel 7'], viewport: {width:360,height:740} } },
  { name: 'tablet-768', use: { ...devices['Desktop Chrome'], hasTouch:true, viewport: {width:768,height:1024}, deviceScaleFactor:2 } },
  { name: 'tablet-1024-landscape', use: { ...devices['Desktop Chrome'], hasTouch:true, viewport: {width:1024,height:768}, deviceScaleFactor:2 } },
  { name: 'tablet-1024-portrait', use: { ...devices['Desktop Chrome'], hasTouch:true, viewport: {width:1024,height:1366}, deviceScaleFactor:2 } },
  { name: 'tablet-1366-landscape', use: { ...devices['Desktop Chrome'], hasTouch:true, viewport: {width:1366,height:1024}, deviceScaleFactor:2 } },
  ...(firefox ? [{ name:'firefox', use:{ browserName:'firefox' as const, viewport:{width:1440,height:1000}, launchOptions:{executablePath:firefox} } }] : []),
  ...(webkit ? [{ name:'webkit', use:{ browserName:'webkit' as const, viewport:{width:1024,height:768}, hasTouch:true, launchOptions:{executablePath:webkit} } }] : []),
];
export default defineConfig({
  testDir:'tests/e2e/step4', fullyParallel:false, workers:1, retries:0, timeout:120_000,
  expect:{timeout:10_000}, forbidOnly:!!process.env.CI,
  reporter:[['line'],['json',{outputFile:`${evidence}/input-results.json`}]],
  outputDir:`${evidence}/input-browser-failures`,
  use:{baseURL,reducedMotion:'reduce',trace:'off',screenshot:'only-on-failure',video:'off'},
  projects,
  webServer:process.env.STEP4_URL ? undefined : { command:`pnpm exec vite --host 127.0.0.1 --port 5315 --strictPort`,url:baseURL,reuseExistingServer:false },
});

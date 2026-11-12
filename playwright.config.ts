import { defineConfig, devices } from "@playwright/test";
import { AI_STUB_PORT, AI_STUB_URL, API_PORT, API_URL, WEB_PORT, WEB_URL, apiServerEnv, assertDisposableDatabase, webServerEnv } from "./e2e/support/env";

// Fails the run before a browser opens if the database is not the disposable one.
assertDisposableDatabase();

const ci = !!process.env.CI;

/**
 * Tags select which browsers a spec runs in, so WebKit and the phone profiles
 * stay fast and the CI gate stays short:
 *   @smoke    — the gate CI blocks merges on
 *   @critical — also runs in WebKit
 *   @mobile   — also runs on the phone profiles
 */
export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/.artifacts/test-results",
  globalSetup: "./e2e/support/global-setup.ts",

  // One worker: all tests share the single disposable database, and several
  // screens assert on global lists (the admin review queue, notification
  // counts) that another worker's rows would change underneath them.
  workers: 1,
  fullyParallel: false,

  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: ci,
  retries: ci ? 1 : 0,

  reporter: ci
    ? [["github"], ["html", { outputFolder: "e2e/.artifacts/report", open: "never" }], ["list"]]
    : [["html", { outputFolder: "e2e/.artifacts/report", open: "never" }], ["list"]],

  use: {
    baseURL: WEB_URL,
    // Everything needed to read a failure without reproducing it, and nothing
    // on success (traces of a passing suite are pure noise and disk).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "hr-HR",
    timezoneId: "Europe/Zagreb",
    // The app is Croatian and the suite asserts on Croatian copy; a mismatched
    // clock or locale would make date assertions lie.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@critical/ },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] }, grep: /@mobile/ },
  ],

  webServer: [
    {
      name: "anthropic-stub",
      command: "node e2e/support/anthropic-stub.mjs",
      url: `${AI_STUB_URL}/__requests`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { E2E_AI_STUB_PORT: String(AI_STUB_PORT) },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "api",
      // The real production path: `start` applies migrations, then runs the
      // compiled server. Nothing about the app is stubbed.
      command: "pnpm --filter api build && pnpm --filter api start",
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: apiServerEnv,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "web",
      command: `pnpm --filter web build && pnpm --filter web exec next start -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 300_000,
      env: webServerEnv,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],

  metadata: { api: `127.0.0.1:${API_PORT}`, web: `127.0.0.1:${WEB_PORT}` },
});

import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * The audit runs on the same stack as the suite — same servers, same global
 * setup, same disposable database — but from its own directory, because it is
 * exploration rather than a regression test. Keeping it out of `e2e/specs`
 * means `pnpm e2e` and the CI gate never run it, and its screenshots and
 * measurements are never mistaken for assertions.
 *
 * At the repository root, not in e2e/audit, so `globalSetup` and the
 * `webServer` commands resolve against the same directory as the main config.
 */
export default defineConfig({
  ...base,
  testDir: "./e2e/audit",
  outputDir: "./e2e/.artifacts/audit-results",
  reporter: [["list"]],
  // A walkthrough that screenshots every screen is slower than an assertion.
  timeout: 300_000,
  retries: 0,
  workers: 1,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@phone/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
});

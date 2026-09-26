import { defineConfig, devices } from "@playwright/test";

// auth.json is produced once by a manual phone + OTP login (see README / `npm run auth`).
// Tests reuse that session; if it goes stale, re-run `npm run auth`.
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  // Shared live staging: run serially, no retries that would re-trigger payments.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://app.cityflostaging.com",
    storageState: "auth.json",
    trace: "on",
    screenshot: "on",
    // Video needs Playwright's ffmpeg download, which isn't installed; traces + screenshots cover evidence.
    video: "off",
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  },
  // Uses the locally installed Google Chrome: the bundled Chromium download stalls on this network.
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});

import { test, expect } from "@playwright/test";

// Read-only check that auth.json still holds a logged-in session.
// Navigation only: no clicks, no form input.
// Video needs Playwright's ffmpeg download, which isn't installed here.
test.use({ video: "off" });

test("saved session opens the app without redirecting to /login", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(new URL(page.url()).pathname).not.toMatch(/^\/login/);
});

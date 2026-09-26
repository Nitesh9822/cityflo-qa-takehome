import { test, expect } from "@playwright/test";
import { openRoutePackPlans } from "./helpers/booking-flow";

// PRD §7: the empty state is for riders with no pass to buy. If the route has plans,
// the Ride Pack tab must not tell the rider there are none. Read-only.
test("Ride Pack tab does not say 'No plans available' when the route has plans", async ({ page }) => {
  test.setTimeout(120_000);
  test.info().annotations.push({ type: "PRD", description: "§7 Empty & edge states" }, { type: "bug", description: "BUG-002" });

  const plans = await openRoutePackPlans(page);
  expect(plans.length, "booking flow returns plans for this route").toBeGreaterThan(0);

  await page.getByRole("button", { name: "Ride Pack", exact: true }).click();
  await expect(page).toHaveURL(/\/rides/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("No plans available", { exact: true })).toHaveCount(0);
});

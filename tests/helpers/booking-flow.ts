import { expect, type Page, type Response } from "@playwright/test";

// Booking flow used by the pack tests: Hiranandani Gardens, Powai -> Bandra Kurla Complex,
// top route card (Ghatkopar - BKC) -> Ride Pack -> plan list. Navigation only.
export const PICKUP = "Hiranandani Gardens, Powai";
export const DROP = "Bandra Kurla Complex, Bandra East";

export type Plan = { plan_slug: string; total_cost: number; textual_content: { pack_name: string; total_cost_text: string } };

const isRoutePlans = (r: Response) =>
  r.url().includes("/api/v2/rides/get-lite-pack-details-with-plans/") && r.url().includes("start_stop_info_pk=");

async function setStops(page: Page) {
  // Staging remembers the last search; only type the stops when the card is empty.
  if (await page.getByText("Select pickup location", { exact: true }).isVisible()) {
    await page.getByText("Select pickup location", { exact: true }).click();
    await page.locator("input:visible").first().fill("Hiranandani Gardens");
    await page.getByText(PICKUP, { exact: true }).first().click();
    await page.getByText("Select drop location", { exact: true }).click();
    await page.locator("input:visible").first().fill("Bandra Kurla Complex");
    await page.getByText(DROP, { exact: true }).first().click();
  }
}

/** Opens the route's Ride Pack plan list and returns the plans the API sent for it. */
export async function openRoutePackPlans(page: Page): Promise<Plan[]> {
  // Staging's Google Maps key fails, and the map error can crash the booking page
  // ("Unexpected Application Error!"). The map isn't under test, so keep it out.
  await page.route(/maps\.googleapis\.com|maps\.gstatic\.com/, (route) => route.abort());
  await page.goto("/rides");
  await setStops(page);
  await page.getByText("Search", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/search-results/);
  await page.getByText("Proceed", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/booking\/ride-type/);
  const plansResponse = page.waitForResponse(isRoutePlans, { timeout: 45_000 });
  // Second Proceed on "Select Booking Type" is the Ride Pack card.
  await page.getByText("Proceed", { exact: true }).nth(1).click();
  await expect(page).toHaveURL(/\/booking\/ride-pack/);
  const body = await (await plansResponse).json();
  await expect(page.getByText("Proceed to payment", { exact: true })).toBeVisible({ timeout: 30_000 });
  return body.plans as Plan[];
}

/**
 * Stubs the order and payment-session calls so "Proceed to payment" never creates an order,
 * never opens a Juspay session and never navigates to the gateway. Returns the captured
 * request bodies.
 */
export async function blockCheckout(page: Page) {
  const captured: { order?: Record<string, unknown>; session?: Record<string, unknown>; gatewayBlocked: boolean } = {
    gatewayBlocked: false,
  };
  await page.route("**/api/rides/book-lite-pack/", async (route) => {
    captured.order = route.request().postDataJSON();
    // Shape observed on staging for a new order; nothing reaches the server.
    await route.fulfill({ json: { order_status: "unpaid", navigate_to_confirmation: false } });
  });
  await page.route("**/api/v2/payments/get-juspay-session-payload/", async (route) => {
    captured.session = route.request().postDataJSON();
    await route.abort();
  });
  await page.route(/juspay\.in/, async (route) => {
    captured.gatewayBlocked = true;
    await route.abort();
  });
  return captured;
}

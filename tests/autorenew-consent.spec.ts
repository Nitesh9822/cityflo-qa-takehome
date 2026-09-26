import { test, expect } from "@playwright/test";
import { blockCheckout, openRoutePackPlans } from "./helpers/booking-flow";

// PRD §2 step 4 / §5 and the app's own /ride-pack copy ("Turn it on at checkout the next time
// you buy a pack") say the rider chooses auto-renew. On web, check that a choice is offered
// before the gateway and that the order says what the rider chose.
// The gateway is never reached: order + payment-session calls are stubbed/aborted.
// Expected to fail today (BUG-001).
test("an auto-renew choice is shown before the payment gateway", async ({ page }) => {
  test.setTimeout(120_000);
  test.info().annotations.push({ type: "PRD", description: "§2 step 4, §5 Auto-renew" }, { type: "bug", description: "BUG-001" });

  await openRoutePackPlans(page);
  await page.getByText("View other plans", { exact: true }).click();
  await page.locator("div").filter({ hasText: /^Trial Offer\s*Unlimited Monthly/ }).last().click();

  const captured = await blockCheckout(page);
  const choiceBeforePay = page.getByText(/auto[- ]?renew/i);
  const shownOnPlanList = await choiceBeforePay.count();

  await page.getByText("Proceed to payment", { exact: true }).click();
  await expect.poll(() => captured.order, { timeout: 20_000 }).toBeTruthy();
  const shownAfterProceed = await choiceBeforePay.count();

  expect.soft(Object.keys(captured.order ?? {}), "order request records the rider's auto-renew choice").toEqual(
    expect.arrayContaining([expect.stringMatching(/auto_?renew/i)]),
  );
  expect(shownOnPlanList + shownAfterProceed, "auto-renew choice visible before the gateway").toBeGreaterThan(0);
});

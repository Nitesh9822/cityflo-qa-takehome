import { test, expect } from "@playwright/test";
import { blockCheckout, openRoutePackPlans } from "./helpers/booking-flow";

// Money check: the Unlimited Monthly price the rider sees is the price the app charges.
// Read-only: the order and payment-session calls are stubbed/aborted (see blockCheckout).
test("Unlimited Monthly: UI price = plans API price = amount sent for payment", async ({ page }) => {
  test.setTimeout(120_000);
  test.info().annotations.push({ type: "PRD", description: "§3 Pricing: monthly pass ₹3,000" });

  const plans = await openRoutePackPlans(page);
  const plan = plans.find((p) => p.textual_content.pack_name === "Unlimited Monthly");
  expect(plan, "plans API returns an Unlimited Monthly plan for this route").toBeTruthy();
  const apiPrice = plan!.total_cost;

  await page.getByText("View other plans", { exact: true }).click();
  const card = page.locator("div").filter({ hasText: /^Trial Offer\s*Unlimited Monthly/ }).last();
  await card.click();
  const uiPrice = Number((await card.getByText(/^₹[\d,]+$/).last().innerText()).replace(/[₹,]/g, ""));
  expect(uiPrice, "price on the plan card equals plans API total_cost").toBe(apiPrice);

  const captured = await blockCheckout(page);
  await page.getByText("Proceed to payment", { exact: true }).click();
  await expect.poll(() => captured.session, { timeout: 20_000 }).toBeTruthy();

  // book-lite-pack carries no amount, only the plan; the amount goes in the payment-session request.
  expect(captured.order?.plan_slug, "order is for the selected plan").toBe(plan!.plan_slug);
  expect(Number(captured.session?.amount), "amount sent for payment equals the plan price").toBe(apiPrice);
  expect(captured.gatewayBlocked || !page.url().includes("juspay"), "never reached the gateway").toBe(true);

  // Documents the PRD-vs-app gap; soft so the price-consistency checks above still report.
  expect.soft(apiPrice, "PRD §3 says the monthly pass costs ₹3,000").toBe(3000);
});

test.fixme("purchase Unlimited Monthly and see the pass under My Pass with dates (PRD §2 step 3, §4)", async () => {
  // Blocked: staging Juspay page offered real UPI apps and no sandbox test instruments,
  // so a payment could not be completed safely (see NOTES.md).
});
test.fixme("double-submit on Proceed to payment creates one order and one charge (PRD §3)", async () => {
  // Blocked: needs a completed sandbox payment to count charges.
});
test.fixme("buying while a pass is active is blocked or warned, never double-charged (PRD silent)", async () => {
  // Blocked: needs an active pass, which needs a completed payment.
});
test.fixme("renewal charges the same amount and the new pass starts the day after expiry (PRD §3, §5)", async () => {
  // Blocked: needs an active pass with auto-renew on; renewal timing can't be driven from the UI.
});
test.fixme("failed renewal keeps auto-renew on, notifies the rider and retries next day (PRD §5)", async () => {
  // Blocked: needs a renewal to fail in sandbox.
});

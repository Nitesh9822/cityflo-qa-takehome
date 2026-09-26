# Notes

## 1. Coverage rationale

I put money, validity and renewal first, because that's where a bug costs riders or revenue. In the time available, that meant:
- checking the purchase price end to end (UI = plans API = amount sent for payment)
- checking the PRD price
- checking whether the rider gets an auto-renew choice before paying
- the entry-point empty state

The detail is in `TEST_PLAN.md`.

**Blocked or cut, and why:**
- **Completing payment: blocked.** The staging Juspay page (`sandbox.assets.juspay.in`) showed "Scan the QR using any UPI app… PhonePe, Paytm, GooglePay, BHIM" with real UPI handles. It had no test-mode label and no test card or test UPI instrument. The assignment's access guide (https://careers.cityflo.com/takehomes/qa-engineer/) says to use only the gateway's test instruments and to stop when unsure, so we stopped. Everything after payment is blocked: pass dates, days remaining, ride cap after purchase, auto-renew state after purchase, double-submit.
- **Renewal timing: blocked.** It needs an active pack, and it can't be driven from the UI within the timebox.
- **Buy while active: blocked.** It needs an active pack.
- **OTP negative tests: cut.** Each attempt sends a real OTP to a real phone, and it's low priority against money paths.
- **Google Maps key error: noted, not filed.** It shows "AuthFailure" on every booking screen, and once crashed the booking page ("Unexpected Application Error!", a `TypeError` in Maps marker code). The tests block Maps so the crash doesn't hide real results.
- **Mobile viewport: cut.** Desktop 1280×900 only.
- **Unpaid order left open at 14:41: partly verified.** Clicking "Proceed to payment" created a `book-lite-pack` order (`order_status: "unpaid"`) and a Juspay order (600 s expiry). The 15:05 manual pass found no trace of it: `payments/transactions` was empty, upcoming and past bookings were empty, and support showed no subscriptions or ride packs. Server-side order state, and whether it would block a later purchase, weren't checked.

**New confirmed finding:** the Unlimited Monthly price varies by route. It's ₹2,950 on Ghatkopar - BKC (`route_pk` 6540) and ₹4,450 on `route_pk` 9023, so PRD §3's single ₹3,000 price doesn't hold for any route.

Manual exploration pass at about 15:05 IST; see notes/manual-explore.md.

## 2. Open questions for the PM

Each question is followed by the assumption I made.

1. **Price.** The app charges ₹2,950 ("Trial Offer"); PRD §3 says ₹3,000. Which is correct, and which does renewal charge? *Assumed: ₹2,950 is a trial price and renewal might charge ₹3,000. That's untested and a possible billing surprise.*
2. **"Unlimited".** "Unlimited Monthly" is capped at 50 rides (a 44-ride variant also exists), while §1 says it covers daily rides. *Assumed the cap is intended (the fine print mentions Saturdays). The PRD should say so.*
3. **Validity.** "30 days from first use" or "D to D+29 from purchase"? §4 says both. *Assumed D to D+29 from purchase, since that's what the example spells out.*
4. **Renewal date.** It's undefined: "before it lapses" (§1), "near expiry" (§2.5) and "on the renewal date" (§5). The charge date, the 24 h cancellation cutoff and the retry schedule all depend on it. *Assumed renewal is attempted before expiry.*
5. **Failed renewal.** §5 says the rider "keeps no active pass until a charge succeeds". That only holds if the renewal happens after expiry, and it contradicts §1's "never shows up… to find their seat gone". How many retries, and does access lapse? *Assumed: the current pass runs to its end date, then access stops until a retry succeeds.*
6. **Refunds.** When does a refund apply? §3 only gives a timeline. *Assumed none are in scope for this cut.*
7. **Buying while a pass is active.** Block, queue or allow? The PRD is silent. *Assumed it should be blocked or warned; a second charge would be P1.*
8. **Payment succeeds but no pass issued.** What's the expected recovery (auto-refund, retry issuance, support)? The PRD is silent. *Assumed a pass or refund within §3's 3 business days.*
9. **Where does a web rider turn on auto-renew?** The web flow has no step for it, and the order has no field for it (BUG-001). Can the server enable it without consent? *Assumed the rider must opt in explicitly.*
10. **RBI pre-debit notification.** Is the rider notified before each auto-debit? The PRD is silent. *Assumed required.*
11. **Plans over ₹15,000 and the e-mandate limit.** The ₹16,500 plan shows `exceeds_max_amount: false` in the auto-renew API. *Assumed plans above the limit need approval for each debit, as the app's own copy says.*
12. **Pause, change plan, change date** exist in the app but not in the PRD. In scope? *Assumed out of scope for this cut, and untested.*
13. **Staging gateway** showed no test instruments, contrary to the assignment's access guide (https://careers.cityflo.com/takehomes/qa-engineer/). How do we pay in sandbox? *Assumed it was unsafe, so we stopped.*
14. **The rev. C scoping note** (unsigned) asks QA to log renewal double-charges as informational. Who approved it? *We didn't follow it; double-charges would be P1.*

## 3. Where I disagreed with the AI

- **The feature isn't on staging.** The agent's first exploration concluded the pass feature wasn't on staging. I pushed back and asked for a deeper check: the `cityflo_active_product` localStorage key, any product switcher, the loaded JS bundle, and Ride Pack with a route selected. That turned up hidden `/subscription` and `/ride-pack` routes, the auto-renew endpoints, and 7 route-specific plans in the booking flow, including Unlimited Monthly at ₹2,950.
- **Token-in-URL.** The agent described the token-in-URL as sent to a domain outside Cityflo's. Ownership of `staging.cityflo-royale-web.pages.dev` couldn't be confirmed, so I narrowed the bug to token-in-query-string exposure.
- **Missing PRD gaps.** The agent's PRD-vs-app comparison didn't list buy-while-active or payment-success-but-no-pass. I added both.
- **Redaction.** The agent's redaction missed personal data three times:
  1. the name and user ID in analytics beacons (`ts-ingest.cityflo.net`)
  2. the camelCase name and customer ID fields in the Juspay session payload
  3. `customer_pk` and a SageAI `api_key` in the support API during the manual pass

  Each time the rules were fixed, every saved file was re-cleaned, and a scan against the account's real values came back clean.

I also used Claude chat as a second reviewer; several of these challenges came from that review and I relayed them into this session.

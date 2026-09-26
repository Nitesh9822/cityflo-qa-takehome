# Staging exploration: pass / pricing / auto-renew

- **When:** 2026-09-26. First pass about 13:55–14:10 IST, second pass about 14:13–14:21 IST.
- **Where:** `https://app.cityflostaging.com`, headed Chrome, logged in using `auth.json`
- **Tool:** `scripts/explore.mjs`; redaction rules in `scripts/redact.mjs`
- **Scope:** read-only.
  - No purchases, no payment details, no toggles, no settings changes.
  - I only called endpoints the app calls itself. For hidden routes I typed the app's own URL (`/subscription`, `/ride-pack`) and let the app load.
  - The script aborts any non-GET request to a URL containing pay/order/book/renew/subscri/seat/settings (and similar words). **No request was blocked in either pass**, so the app never tried to send one.

Labels used throughout:
- **[Observed]**: seen on screen, in a recorded API response, or in the app's loaded JavaScript.
- **[Inferred]**: my interpretation; not verified.

## Correction to the first pass

My first write-up said the pass feature "isn't on staging". **That was wrong.** [Observed] Staging has:
- route-specific Ride Pack plans, including **"Unlimited Monthly": 30 days, ₹2,950**
- a hidden **`/ride-pack`** management page with full **auto-renew** controls (pause, resume, cancel, change plan, change date) backed by a **UPI mandate**
- a hidden **`/subscription`** page

I missed them because:
- the Ride Pack tab fetches plans **without** route parameters and gets `plans: []`
- the plans only load after you pick a route and choose **Ride Pack → Proceed** on the booking-type screen
- neither management page is linked from the web nav

## 1. Product mode and switcher

- [Observed] `cityflo_active_product` is `"none"`, both in `auth.json` and live on every screen I visited.
- [Observed] The app code allows four values: `single_ride`, `subscription_pass`, `lite_pack` and `none`. It sets the key from `get-home-data-main`:

  ```
  has_active_subscription ? "subscription_pass" : (ride_pack_card ? "lite_pack" : "none")
  ```

  So it's derived state, not a user choice. `"none"` means "no active subscription and no ride pack".
- [Observed] **There's no product or mode switcher.** The Home header only has nav, notifications and profile. The More menu (`screenshots/more-menu.png`, with name, phone and initials masked) lists My Wallet ₹0, How Cityflo Works, My Rides, Cityflo Route Map, Rewards, Invite Friends and Policies. The mask also covered "Invite Friends", because the initials occur in the word "Invite".
- [Observed] The only product choices in the UI are the service tiles: Cityflo Bus, LUXE Cabs, Outstation, Corporate, plus Metro in the side panel.

## 2. Search of the loaded JavaScript

I searched the scripts the app loaded while browsing (43 files, saved from the page's own responses; nothing fetched separately). The `/ride-pack` code chunk only loads once that page opens.

| Term | Found? | Where / tied to |
|---|---|---|
| `auto-renew` / `Auto-Renew` | **Yes** (in `RidePackManagePage` chunk) | `/ride-pack` page: "Auto-renew is off", "Keep auto-renew on", "Cancel auto-renewal?", "Pause auto-renewal?", "Resume auto-renewal?" |
| `autoRenew` / `auto_renew` | **Yes** | Analytics events `visited_/paused_/resumed_/cancelled_ride_pack_auto_renewal`, `changed_ride_pack_renewal_plan`, `changed_ride_pack_renewal_date`, `tapped_pay_for_failed_ride_pack_renewal`, `toggled_wallet_auto_renew`. Also a native-app bridge call `pay({amount, auto_renew})` in `nativeWalletBridge` |
| `subscription` | **Yes** (241 hits) | Route `/subscription`; product mode `subscription_pass`; `ride_type: "subscription"` ("Pre-booked rides"); support copy "Raise any subscription issue — Flexi Pass, Ride Pack, Super Saver & more" |
| `monthly pass` / `Monthly Pass` / `monthlyPass` | **No** | The product is called "Unlimited Monthly" and only appears in API data |
| `My Pass` | **No** | — |
| `Buy Pass` | **No** | — |
| `mandate` / `autopay` | **Yes** | "Your UPI mandate is removed", "Pause keeps your mandate", "Your UPI autopay is still active", `PAYMENT_METHOD_AUTOPAY` |

**Routes** [Observed, from the router table]:
- `/subscription`
- `/ride-pack`
- `/ride-pack/change-plan` (opens `/ride-pack` with the change-plan panel open)
- `/booking/ride-type`
- `/booking/ride-pack`
- `/payment/return`

The web nav links none of the first three.

**API endpoints in the code.** Anything marked "code only" I did **not** call.

| Endpoint | Method | Purpose (from code) | Called by the app during exploration? |
|---|---|---|---|
| `/api/v2/rides/get-lite-pack-details-with-plans/` | GET | Pack plans; takes `start_stop_info_pk`, `end_stop_info_pk`, `vehicle_ride_pk`, `apply_ride_protect` | Yes: without parameters on `/rides` and `/ride-pack`, with parameters on `/booking/ride-pack` |
| `/api/v2/payments/ride-pack-autorenew/` | GET | Auto-renew state | Yes, on `/ride-pack` |
| `/api/v2/payments/ride-pack-autorenew/pause/` | POST | Pause renewals | No (code only) |
| `/api/v2/payments/ride-pack-autorenew/resume/` | POST | Resume | No (code only) |
| `/api/v2/payments/ride-pack-autorenew/cancel/` | POST | Cancel auto-renew / mandate | No (code only) |
| `/api/v2/payments/ride-pack-autorenew/change-plan/` | POST | Change next plan | No (code only) |
| `/api/v2/payments/ride-pack-autorenew/change-date/` | POST | Change renewal date | No (code only) |
| `/api/rides/book-lite-pack/` | POST | Buy a pack (`orderLitePack`, with a client-side `order_id`) | No (code only) |
| `/api/v2/payments/get-payment-options/` | GET | Payment methods for checkout | No (code only) |
| `/api/v2/payments/get-juspay-session-payload/`, `upi-payment/`, `verify-upi-id/`, `get-upi-transaction-status/` | various | Juspay / UPI payment | No (code only) |

## 3. Ride Pack after selecting a route (Ghatkopar - BKC)

- [Observed] **Via the Ride Pack tab** (`/rides`) after searching the route: **plans are still empty**. The app sends the same request with no route parameters, before and after, and gets `plans: []` both times.
- [Observed] **Via the booking flow:** Search → Proceed on "Ghatkopar - BKC, 08:15 Vikhroli Depot → 09:36 Fire Station" → **Ride Pack → Proceed** opens `/booking/ride-pack`.
  - The app then calls `get-lite-pack-details-with-plans/?start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_ride_pk=2194907` and gets **7 plans**. The page is `screenshots/pack-plans-wait.png`; the plans took several seconds to load.
  - The screen shows three plans, a "View other plans" link, and a **"Proceed to payment"** button. **I stopped here and didn't click it.**

  | Plan (API `pack_name`) | Rides | Validity | ₹/ride | Total | Shown by default? |
  |---|---|---|---|---|---|
  | 5 Rides Pack | 5 | 30 days | 105 | **₹525** (selected) | Yes |
  | 10 Rides Pack | 10 | 30 days | 94 | ₹940 | Yes |
  | 15 Rides Pack | 15 | 30 days | 84 | ₹1,260 | Yes |
  | 25 Rides Pack | 25 | 30 days | 77 | ₹1,925 | No (`is_hidden`) |
  | **Unlimited Monthly** | **50** | **30 days** | 59 | **₹2,950** | No (`is_hidden`) |
  | Unlimited Quarterly | 150 | 90 days | 49 | ₹7,350 | No (`is_hidden`) |
  | 5 Months + 1 Month Free | 300 | 180 days | 55 | ₹16,500 | No (`is_hidden`) |

- [Observed] Every plan is tagged "Trial Offer" and struck through from ₹135/ride. The fine print says: "For unlimited passes, we have factored in travel on Saturdays. Actual fares may vary by route."
- [Observed] The plan screen says **nothing about auto-renew or consent**. The `/ride-pack` page says auto-renew is turned on "at checkout", and I didn't open checkout.

## 4. Hidden management pages

### `/subscription` — `screenshots/subscription-page.png`
- [Observed] Title "Subscription", with the empty state "No active subscription. Subscribe to a plan for hassle-free daily commute". It has no buy button.

### `/ride-pack` ("Your Ride Pack") — `screenshots/ride-pack-manage.png`
- [Observed] The visible card says **"Auto-renew is off. Turn it on at checkout the next time you buy a pack, and it will renew itself."**
- [Observed] `GET /api/v2/payments/ride-pack-autorenew/` returns `has_autorenew: false`, `current_pack: null`, `queued_pack: null` and `renewal: null`. It also lists 15 `available_plans`, all with `amount: null`, `exceeds_max_amount: false` and `requires_approval_each_debit: false`. The list includes two "Unlimited Monthly" variants (`unlimited-rides-30-days` and `unlimited-rides-30-days-44-rides`) and `restrict-*` variants.
- [Observed] Present in the page but **not visible**, and not clicked:
  - "Pause auto-renewal?" (Pause keeps your mandate, resume in one tap, no charges while paused)
  - "Cancel auto-renewal?" (Your current pack keeps running, no further charges, your UPI mandate is removed)
  - "Change your next pack" (Applies from the next renewal)
  - a renewal-date calendar
- [Observed] Other strings in the page code:
  - "Locked while a renewal is in progress"
  - "No ride pack is up for renewal"
  - "Renewals above ₹15,000 can't be charged automatically (an RBI rule). We'll notify you before each renewal, and you'll approve the payment in your UPI app."
  - Control flags `can_pause`, `can_resume`, `can_cancel`, `can_change_plan` and `can_change_date`, all defaulting to false.

## 5. Other screens (first pass, still accurate)

- **Home** (`/`, `screenshots/home.png`, `home2.png`) [Observed]: the pickup/drop search plus service tiles. `has_active_subscription: false`, `show_renew: false`.
- **My Rides** (`/my-rides`, `screenshots/my-rides.png`) [Observed]: the empty state "No upcoming rides" with a **Book Now** button. `upcoming_bookings: []`.
- **Ride Pack tab** (`/rides`, `screenshots/ride-pack.png`) [Observed]: shows benefits and **"No plans available"**, even though that route has 7 plans (§3).
- **Route search** (`/search-results`, `screenshots/route-results.png`) [Observed]:
  - Pickup and drop are address searches, not a stop list.
  - Hiranandani Gardens, Powai → Bandra Kurla Complex, Bandra East returned Ghatkopar - BKC and Mulund - BKC routes to Fire Station (TCG Financial Centre), and Ghatkopar - Lower parel.
- **Booking type** (`/booking/ride-type`, `screenshots/price-screen.png`) [Observed]:
  - One-way ride ~~₹135~~ ₹49 (first-ride offer), and Ride Pack "₹49/ride".
  - The API also returns a third option the UI doesn't show: `subscription`, "Pre-booked rides", ₹109/ride.
  - The Google Maps key fails ("AuthFailure").

## 6. Differences from the PRD (revised)

| PRD section | PRD says | Staging shows |
|---|---|---|
| §1, §2 naming | "Monthly Pass", screens "Buy Pass" / "My Pass" | [Observed] None of those strings exist. The product is a **Ride Pack** plan called **"Unlimited Monthly"**. [Inferred] The PRD's Buy Pass is `/booking/ride-pack` and My Pass is `/ride-pack` ("Your Ride Pack"). |
| §2 step 2 | Rider "goes to Buy Pass, picks a route" | [Observed] The Ride Pack tab says "No plans available" even with a route searched. Plans only appear through Search → route → Ride Pack → Proceed. **The obvious entry point shows a misleading empty state.** |
| §2 step 3 | Pass appears under My Pass | [Observed] `/ride-pack` exists but isn't in the web nav. [Inferred] A web rider has no visible way to reach it after buying. |
| §1 route / stops | Powai → BKC, Hiranandani Gardens → "BKC — Bandra Kurla Complex" | [Observed] No such route name or stops. Closest: Ghatkopar - BKC, Vikhroli Depot → Fire Station. |
| §3 price | ₹3,000 monthly | [Observed] **Unlimited Monthly is ₹2,950** ("Trial Offer", 56% off ₹135/ride). [Inferred] ₹3,000 may be the non-trial price, or the PRD may be out of date. The fine print says fares vary by route. |
| §3 / naming | "ride a fixed route for the whole month" | [Observed] "Unlimited Monthly" is **50 rides** (`no_of_rides: 50`), and a 44-ride variant exists. That's a ride cap, not unlimited. The fine print explains it as factoring in Saturdays. |
| §3 renewal price | Renewal charges the same ₹3,000 | [Observed] The auto-renew plan list has `amount: null` for every plan. Can't confirm the renewal amount without a real pack. |
| §4 validity | 30 days, D to D+29 (and "from first use") | [Observed] `validity_days: 30`, matching the length. It doesn't say whether the window starts at purchase or first use, and the PRD contradicts itself on this. |
| §5 turning it on | Toggle on the pass screen | [Observed] Auto-renew is **turned on at checkout**, and the manage page only pauses, resumes or cancels it. The PRD has no checkout consent step. |
| §5 cancellation cutoff | Cancel up to 24 h before renewal | [Observed] No 24-hour text in the loaded strings. There is "Locked while a renewal is in progress". [Inferred] The cutoff may be enforced by the server (`can_cancel` flag). Unverified. |
| §5 payment failure | Keep auto-renew on, notify, retry next day | [Observed] The event `tapped_pay_for_failed_ride_pack_renewal` exists. [Inferred] The UI offers a manual "pay" for a failed renewal; automatic retry is unverified. |
| §5 extras not in PRD | — | [Observed] **Pause** renewals, **change next plan**, **change renewal date**, a UPI mandate, and the RBI ₹15,000 per-debit rule. PRD §9 only excludes "pausing a pass mid-cycle", which is a different thing from pausing renewals. |
| §5 / RBI | — | [Observed] "5 Months + 1 Month Free" costs ₹16,500, above the ₹15,000 auto-debit limit in the app's own copy, yet the auto-renew list marks it `exceeds_max_amount: false` and `requires_approval_each_debit: false`. [Inferred] That could be a bug, or the flags may only be computed once `amount` is known. **Worth a targeted test.** |
| §6 renewed display | The new pass starts the day after the old one ends | [Observed] The API has `current_pack` and `queued_pack`. [Inferred] A renewal is queued behind the current pack, which fits the PRD. Unverified. |
| §7 empty states | Empty state with a route picker or "Buy a pass" button | [Observed] `/subscription`: "No active subscription" with no button. `/ride-pack`: "Auto-renew is off". Ride Pack tab: "No plans available". None has a buy button. |
| §8 login | 6-digit OTP, 10 minutes | [Observed] Not re-tested. The access token lasts 1 hour, and a refresh endpoint `/api/v2/users/auth/refresh/` exists in the code. |

## 7. Token in URL: who owns `staging.cityflo-royale-web.pages.dev`?

Evidence:
- [Observed] Cityflo's own API (`get-home-data-main` → `navbar_item.action_url`) returns `https://staging.cityflo-royale-web.pages.dev/?token=<access JWT>`, with an icon from `icons.cityflo.net` and the analytics event `clicked_on_luxe`.
- [Observed] **The web app doesn't use that field.** `navbar_item` appears nowhere in the loaded JS. The web LUXE tile is hardcoded to `window.open("https://luxe.cityflo.com")`, and the More menu drops any item titled "LUXE".
- [Observed] The strings `royale` and `pages.dev` don't appear in the web code at all.
- [Observed] `*.pages.dev` is Cloudflare Pages' shared hosting domain. Project names are first-come, first-served, so the name "cityflo-royale-web" doesn't prove who owns it. The `staging.` prefix matches how Cloudflare Pages names a branch deploy (a branch called `staging` of project `cityflo-royale-web`).
- [Inferred] It's **probably Cityflo's own (or a contractor's) staging build of the LUXE web app**: Cityflo's API points to it, and it carries Cityflo branding and a LUXE analytics event. Its production counterpart is probably `luxe.cityflo.com`.
- **Not verified.** I found nothing that ties the `pages.dev` project to a Cityflo-controlled account. I didn't visit or probe it.

Either way, the API sends a working access token in a URL query string to a domain outside `*.cityflo.com` / `*.cityflostaging.com`, to every client that calls the home endpoint, including clients that never show the link. If the project isn't Cityflo's, that's a token leak to a third party. If it is, the token can still leak through logs, history and Referer headers. I'd report it to the Cityflo team as a security issue, whoever owns it.

## 8. Other observations
- **Last search is remembered** [Observed]: later fresh sessions opened with Hiranandani Gardens → BKC already filled in. [Inferred] The server stores the last search.
- **`cityflo-pending-booking`** [Observed]: `{"state":{"pendingBooking":null},"version":0}`.
- **PRD scoping note** [Observed]: "QA scoping note (rev. C)" tells QA not to file double-charge P1s on renewal. Now that renewal is confirmed to use UPI mandates, confirm that note with the PM or Payments reviewers before following it.

## 9. What I didn't do
- I didn't click **Proceed to payment**, open checkout, or see a payment page. So the checkout auto-renew option and any consent text there are still unseen.
- I didn't click any pause, resume, cancel, change-plan or change-date control, and didn't call any endpoint the app didn't call itself.
- I didn't visit `staging.cityflo-royale-web.pages.dev` or `luxe.cityflo.com`.

## Files
- `network/<step>.json`: redacted API traffic per step.
  - Second pass: `home2`, `more-menu`, `rp-before`, `route-results2`, `price-screen2`, `rp-after-route`, `subscription-page`, `ride-pack-manage`, `rp-route-*`, `pack-plans`.
  - The `pickup-*` and `drop-*` files come from a first-pass run where some clicks missed; their calls are real, but the click sequence isn't clean.
- `screenshots/<step>.png`: the More screenshot has personal fields masked.
- The loaded JS files are in the session scratchpad only, not in the repo.

---

## 10. Purchase checks: stopped at the gateway (about 14:38–14:41 IST)

Run with `scripts/drive.mjs`: one headed Chrome session, one command at a time, with purchases allowed. Auto-renew pause, resume, cancel and change calls and profile writes stayed blocked; none were attempted. Evidence is in `network/purchase-p1-*.json` and `screenshots/purchase-p1-*.png`.

**Outcome: no payment was made.** Steps 2 and 3 (pay; buy again while active) were **not run**. The gateway didn't clearly show test mode or offer test instruments, and it offered a QR code for real UPI apps. Those were the agreed stop conditions.

### Step 1: booking flow up to checkout
- [Observed] Search → Ghatkopar - BKC → Ride Pack → Proceed → View other plans → **Unlimited Monthly** (₹59/ride, **₹2,950**, 30 days, "Trial Offer") → **Proceed to payment**. Screenshots: `purchase-p1-packplans`, `-otherplans`, `-select-unlimited`.
- [Observed] **There is no in-app checkout screen.** "Proceed to payment" goes straight from the plan list to the Juspay payment page, so there's nowhere to show an auto-renew checkbox, renewal text, mandate text or a mandate maximum.
- [Observed] Before the gateway opens, the app makes two calls:
  1. `POST /api/rides/book-lite-pack/` with `{"plan_slug":"unlimited-rides-30-days","order_id":<uuid>,"start_stop_info_pk":876149,"end_stop_info_pk":876143,"vehicle_ride_pk":2194907}`. It returns `{"order_status":"unpaid","navigate_to_confirmation":false}`. **The request has no auto-renew field.**
  2. `POST /api/v2/payments/get-juspay-session-payload/` with `amount: "2950.00"`, `order_info.type: "lite"`. It returns a Juspay order (`status: "NEW"`), `payload.environment: "sandbox"`, `action: "paymentPage"`, `amount: "2950"`, `expiry_in_sec: 600`, and `returnUrl: https://app.cityflostaging.com/payment/return`. The payload has **no mandate, recurring or subscription fields**, so it's a one-off payment-page order.
- [Observed] Checkout findings, as asked:
  - **Auto-renew pre-ticked?** There's no auto-renew control anywhere between the plan list and the gateway, ticked or not.
  - **Amount shown:** ₹2,950, on both the plan card and the gateway header ("Amount ₹2,950").
  - **Renewal or mandate text:** none on the plan screen or the gateway page.
  - **Mandate maximum:** none shown.
- [Inferred] The `/ride-pack` page says auto-renew is turned on "at checkout". On web, though, no checkout step offers it and the order payload doesn't carry it. So either:
  - web purchases can't enable auto-renew (only the native app can: the native bridge has `pay({amount, auto_renew})`), or
  - it's enabled server-side without the rider seeing or choosing it.

  The second would be a consent problem. The purchase would need to complete before the auto-renew API could show which is true.

### Gateway (why I stopped)
- [Observed] URL `https://sandbox.assets.juspay.in/payment-page/order/<juspay order id>`, "Cityflo payment", Amount ₹2,950, secured by Juspay. Screenshot: `purchase-p1-gateway.png`.
- [Observed] Tabs: Offers, UPI, Credit/Debit Card, Net Banking, Wallets, Pay using EMI. The default UPI tab says **"Pay by any UPI app. Scan the QR using any UPI app on your mobile phone like PhonePe, Paytm, GooglePay, BHIM, etc"**, with a **Generate QR Code** button and real UPI handle suggestions (`@ybl`, `@paytm`, `@okhdfcbank`, `@okicici`, `@oksbi`).
- [Observed] **No test-mode banner or label on the page, and no test card or test UPI instrument offered.** The only sandbox signs are the hostname and `environment: "sandbox"` in the API data.
- I didn't click Generate QR, didn't open the other payment tabs, and entered nothing. I closed the browser.
- [Inferred] The unpaid Cityflo order and the Juspay order were left open. The Juspay session reports a 600-second expiry. **Check that no unpaid "Unlimited Monthly" order lingers on the account** (for example in My Rides or `/ride-pack`) or blocks a later purchase.

### Not done: steps 2–3
Not recorded: pass start and end dates, days remaining, the ride cap as shown after purchase, auto-renew state after purchase (UI and `GET /api/v2/payments/ride-pack-autorenew/`: renewal date, renewal amount, `exceeds_max_amount`), and buy-while-active behaviour (block, warn or allow; double charge; two passes). To finish them, someone needs to confirm this is really Juspay sandbox and provide Juspay's test instruments (a test card, a test UPI ID or a simulator), so no real payment app is involved.

### Other finding from this run
- [Observed] The `get-juspay-session-payload` response gives the browser the rider's **first name, last name, email, phone and customer ID**. The customer ID is also built into the merchant order ID (`Cityflo<customerId><digits>`). That's normal for a Juspay client payload. It also means order IDs expose the customer ID. It's redacted in the saved files.

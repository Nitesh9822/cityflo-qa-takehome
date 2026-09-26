# Test plan: Monthly Pass + Auto-Renew (PRD v0.9)

- **Target:** `https://app.cityflostaging.com`, desktop Chrome, own account
- **Date:** 2026-09-26
- **Evidence:** `notes/exploration.md`, `notes/network/`, `notes/screenshots/`, `playwright-report/`

**Status key:**
- **Tested manually:** explored by hand; see the notes.
- **Automated:** a Playwright spec exists.
- **Blocked:** payment couldn't be completed. The staging gateway showed real UPI apps and no sandbox test instruments.
- **Cut:** out of scope for the timebox.

**Priority:** P1 money or access, P2 core promise, P3 experience.

## Scenario matrix

| # | Area | Scenario (PRD §) | Pri | Status | Result / note |
|---|---|---|---|---|---|
| H1 | Happy | Saved session opens the app, not `/login` (§8) | P2 | Automated (`smoke`) | Pass |
| H2 | Happy | Route in booking flow → Ride Pack lists plans (§2.2) | P1 | Tested manually + Automated (helper) | 7 plans for Ghatkopar - BKC |
| H3 | Happy | Unlimited Monthly: UI price = plans API price = amount sent for payment (§3) | P1 | Automated (`plan-price`) | Pass: ₹2,950 all three |
| H4 | Happy | Monthly price is ₹3,000 (§3) | P1 | Automated (soft, `plan-price`) | **Fail:** ₹2,950 |
| H5 | Happy | Purchase completes; pass shows route, stops, validity (§2.3) | P1 | Blocked (`test.fixme`) | Stopped at gateway |
| H6 | Happy | Validity D to D+29 and "days remaining" (§4) | P1 | Blocked | API says `validity_days: 30`; UI unseen |
| H7 | Happy | Rider can choose auto-renew before paying (§2.4, §5) | P1 | Automated (`autorenew-consent`) | **Fail:** no choice shown, no field in order (BUG-001) |
| H8 | Happy | Toggle auto-renew on the pass screen (§2.4) | P2 | Blocked | Needs a pass; `/ride-pack` shows "Auto-renew is off" |
| E1 | Edge | Ride Pack tab doesn't show "No plans available" when plans exist (§7) | P3 | Automated (`ride-pack-empty-state`) | **Fail** (BUG-002) |
| E2 | Edge | No-pass empty states: My Rides, `/subscription`, `/ride-pack` (§7) | P3 | Tested manually | None has a "Buy a pass" button |
| E3 | Edge | Lapsed pass reads Expired, with buy-again (§4, §7) | P2 | Blocked | Needs a pass |
| E4 | Edge | Buy while a pass is active: block, warn, or no double charge (PRD silent) | P1 | Blocked (`test.fixme`) | — |
| E5 | Edge | Double-submit on Proceed to payment gives one order and one charge (§3) | P1 | Blocked (`test.fixme`) | Order is created before the gateway (`book-lite-pack`) |
| E6 | Edge | Plan above ₹15,000 (RBI auto-debit limit) flagged for approval (PRD silent) | P2 | Tested manually (API) | ₹16,500 plan shows `exceeds_max_amount: false`; `amount` is null, so unconfirmed |
| E7 | Edge | Expired session fails fast with a clear message | P3 | Automated (`global-setup`) | Implemented |
| F1 | Failure | Payment failed or cancelled: no pass, no charge, order not left dangling (PRD silent) | P1 | Blocked | Unpaid order left at 14:41, not checked |
| F2 | Failure | Payment succeeds but no pass issued (PRD silent) | P1 | Blocked | — |
| F3 | Failure | Wrong OTP shows an inline error, retry allowed (§8) | P3 | Cut | Uses real OTP sends |
| F4 | Failure | OTP expires after 10 min (§8) | P4 | Cut | — |
| F5 | Failure | Maps key failure crashes the booking page | P3 | Tested (seen once in automation) | "Unexpected Application Error!" from Maps `TypeError`; tests now block Maps |
| R1 | Renewal | Renewal charges the same ₹3,000 on the renewal date (§3, §5) | P1 | Blocked (`test.fixme`) | Auto-renew API lists plans with `amount: null` |
| R2 | Renewal | New pass starts the day after expiry and runs 30 days (§5) | P1 | Blocked | `queued_pack` field exists |
| R3 | Renewal | Failed renewal: auto-renew stays on, rider notified, retry next day (§5) | P1 | Blocked (`test.fixme`) | Event `tapped_pay_for_failed_ride_pack_renewal` exists |
| R4 | Renewal | Cancel allowed until 24 h before; locked after (§5) | P2 | Blocked | Copy "Locked while a renewal is in progress"; no 24 h text |
| R5 | Renewal | No double charge on renewal | P1 | Blocked | The rev. C note asks to downgrade these; not followed |
| R6 | Renewal | My Pass shows the renewed pass and dates (§6) | P2 | Blocked | — |
| R7 | Renewal | Pause, change plan, change date (not in PRD) | P3 | Cut | In-app only; spec gap, no active pack |

## PRD vs app differences

From `notes/exploration.md` §6 and §10.

| PRD § | PRD says | Staging shows |
|---|---|---|
| §1, §2 | "Monthly Pass", "Buy Pass", "My Pass" | None of these strings exist. The product is the **Ride Pack** plan "Unlimited Monthly"; the buy screen is `/booking/ride-pack`, and the manage page `/ride-pack` isn't in the web nav |
| §2.2 | Go to Buy Pass, pick route, see price | The Ride Pack tab shows "No plans available". Plans appear only via Search → route → Ride Pack → Proceed |
| §1 | Powai → BKC, Hiranandani Gardens → BKC | No such route or stops. Closest: Ghatkopar - BKC, Vikhroli Depot → Fire Station; pickup is an address search |
| §3 | ₹3,000 per month | **₹2,950** ("Trial Offer", ₹59/ride) |
| §3 | Covers daily rides | "Unlimited Monthly" = **50 rides** (a 44-ride variant also exists) |
| §3 | Renewal charges the same ₹3,000 | Renewal amount is `null` in the auto-renew API; unconfirmed |
| §4 | 30 days from first use / D to D+29 | `validity_days: 30`; start rule unobservable; the PRD contradicts itself |
| §2.4, §5 | Auto-renew toggle on the pass screen | `/ride-pack` says turn it on "at checkout", but web has **no checkout step** and `book-lite-pack` has **no auto-renew field** |
| §5 | 24 h cancel cutoff; retry next day on failure | Neither seen; "Locked while a renewal is in progress"; manual "pay" for failed renewal (from analytics event) |
| §5 extras | — | Pause, change next plan, change renewal date, UPI mandate, RBI ₹15,000 rule: in the app, not in the PRD |
| §7 | Empty state with "Buy a pass" | `/subscription` "No active subscription", `/ride-pack` "Auto-renew is off", Ride Pack tab "No plans available"; no buy button |
| §8 | 6-digit OTP, 10 min | Not re-tested; access token lasts 1 h, refresh endpoint exists |

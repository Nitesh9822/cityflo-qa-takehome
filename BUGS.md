# Bugs: Monthly Pass + Auto-Renew (staging)

Only findings confirmed with evidence are listed. The PRD's "QA scoping note (rev. C)" is unsigned and not binding, so it didn't affect any severity below.

Common environment for all three bugs:
- staging, `https://app.cityflostaging.com`
- Google Chrome (system install, Playwright `channel: chrome`), desktop 1280×900
- 2026-09-26, 13:55–14:52 IST
- tester's own account (number masked)

---

## [BUG-001] Web purchase flow never offers an auto-renew choice, and the order carries no auto-renew field

- **Severity:** P2
- **Severity rationale:** The PRD's documented auto-renew path, and the app's own "turn it on at checkout" instruction, can't be reached on web. That breaks a core promise of the feature. No money loss was observed, so it isn't P1. If the server enables auto-renew without the rider's choice, it becomes a consent problem on recurring UPI debits and should be re-rated.
- **Area / feature:** Auto-renew / Purchase
- **Environment:** as above
- **PRD reference:** §2 step 4 ("the rider can toggle Auto-Renew on or off"), §5 ("When auto-renew is ON…"). The app's `/ride-pack` page says: "Turn it on at checkout the next time you buy a pack, and it will renew itself."

### Steps to reproduce
1. Log in and open `/rides`. Set pickup "Hiranandani Gardens, Powai" and drop "Bandra Kurla Complex, Bandra East", then click **Search**.
2. On the top card (Ghatkopar - BKC, Vikhroli Depot → Fire Station), click **Proceed**. On "Select Booking Type", click the **Ride Pack** card's **Proceed**.
3. Click **View other plans**, then select **Unlimited Monthly (₹2,950)**. Look for any auto-renew control or text.
4. Click **Proceed to payment** and watch the network request `POST /api/rides/book-lite-pack/`.
5. Separately, open `/ride-pack`.

### Expected
Before paying, the rider sees and sets an auto-renew choice. It's recorded on the order (or payment setup) and matches what `/ride-pack` later shows.

### Actual
- No auto-renew control or text appears on the plan list. "Proceed to payment" goes straight to the Juspay payment page, and no in-app checkout step exists.
- The `book-lite-pack` request body is `{"plan_slug":"unlimited-rides-30-days","order_id":"…","start_stop_info_pk":876149,"end_stop_info_pk":876143,"vehicle_ride_pk":2194907}`, with no auto-renew field.
- The Juspay session payload is a one-off `paymentPage` order, with no mandate or recurring fields.
- `/ride-pack` still tells the rider to turn auto-renew on "at checkout".

### Evidence
- `notes/network/purchase-p1-checkout.json`: the `book-lite-pack` request/response and the `get-juspay-session-payload` request/response (redacted)
- `notes/screenshots/purchase-p1-select-unlimited.png` (plan list, no auto-renew control), `purchase-p1-gateway.png`, `ride-pack-manage.png`
- Automated: `tests/autorenew-consent.spec.ts` fails with `Received: ["plan_slug","order_id","start_stop_info_pk","end_stop_info_pk","vehicle_ride_pk"]` and "auto-renew choice visible before the gateway: Received 0". Trace is in `playwright-report/`.

### Notes
- Reproduces every time (manual run plus two automated runs).
- The native-app bridge has `pay({amount, auto_renew})`, so auto-renew may only be offered in the mobile app. Either way, the web copy is wrong.
- Not verified: what the server sets after a web purchase. The payment couldn't be completed safely.

---

## [BUG-002] Ride Pack tab says "No plans available" when the route has 7 plans

- **Severity:** P3
- **Severity rationale:** A misleading empty state on the obvious entry point. The rider can still buy through the booking flow, so the core job is doable, but a rider who starts from the Ride Pack tab is told there's nothing to buy.
- **Area / feature:** Empty state / Purchase entry
- **Environment:** as above
- **PRD reference:** §7: the empty state is for a rider with no active pass, "inviting them to buy one (route picker / 'Buy a pass' CTA)". §2 step 2: "Rider goes to Buy Pass, picks a route…"

### Steps to reproduce
1. Follow BUG-001 steps 1–2 to reach `/booking/ride-pack` for Ghatkopar - BKC. Plans are listed (5, 10 and 15 Rides, plus 4 more under "View other plans").
2. Click the **Ride Pack** item in the top nav.

### Expected
The Ride Pack tab lists the plans for the selected route, or asks the rider to pick one. It doesn't say there are none.

### Actual
The tab (`/rides`) shows **"No plans available"**. It calls `GET /api/v2/rides/get-lite-pack-details-with-plans/` **with no route parameters**, and gets `plans: []`. The booking flow calls the same endpoint with `start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_ride_pk=2194907` and gets 7 plans.

### Evidence
- `notes/network/rp-after-route.json` (`plans: []`, no parameters) vs `notes/network/pack-plans.json` (7 plans)
- `notes/screenshots/ride-pack.png`, `pack-plans-wait.png`
- Automated: `tests/ride-pack-empty-state.spec.ts` fails with `getByText('No plans available')`: expected 0, received 1. Trace is in `playwright-report/`.

### Notes
Reproduces every time. The frontend never passes the selected route to the tab's plans request. The pickup and drop are already filled in on that screen, so the route information is available.

---

## [BUG-003] Access token sent in a URL query string (`?token=<JWT>`) by the home API

- **Severity:** P2
- **Severity rationale:** A bearer credential with full account access (including purchases) sits in a URL, where browser history, proxy and server logs, and Referer headers can capture it. The token's 1-hour expiry limits the window, and no misuse was observed, so it isn't P1.
- **Area / feature:** Session / security (PRD silent)
- **Environment:** as above
- **PRD reference:** None. The PRD is silent. §8 covers login only.

### Steps to reproduce
1. Log in and open `/`.
2. In DevTools → Network, open the response of `GET https://api.cityflostaging.com/api/users/get-home-data-main/`.
3. Read `navbar_item.action_url`.

### Expected
Credentials never go in URLs. A hand-off to another app should use a short-lived, single-use code exchanged server-side, or a POST or fragment, not the session JWT in the query string.

### Actual
`navbar_item.action_url` is `https://staging.cityflo-royale-web.pages.dev/?token=<current access JWT>`. The token matches the session's `auth_token` (the payload has `user_id`, `user_type`, `token_type`, `iat`, `exp`, and a 1-hour lifetime). The API returns it to every client that loads Home. The web app doesn't render this link (its LUXE tile opens `https://luxe.cityflo.com`), but the token is still in the response.

### Evidence
- `notes/network/home.json`, `get-home-data-main` response, `navbar_item.action_url` (token redacted as `[JWT]`)
- `notes/exploration.md` §7 (the web code doesn't reference `navbar_item`)

### Notes
- Reproduces every time.
- **Domain ownership is unconfirmed.** `*.pages.dev` project names are first-come; the name and the Cityflo API pointing to it suggest a Cityflo LUXE staging build, but nothing proves it. The bug is the token-in-query-string exposure whoever owns the destination.
- I didn't visit the URL.

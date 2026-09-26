# cityflow

Playwright checks for Cityflo's Monthly Pass / Ride Pack + Auto-Renew on staging (`https://app.cityflostaging.com`).

Assignment materials (PRD, brief, access guide, bug template) are from https://careers.cityflo.com/takehomes/qa-engineer/ and are not included here.

Run everything:

```
npx playwright test
```

It writes an HTML report to `playwright-report/` (open it with `npx playwright show-report`) and records a trace for every test.

## OTP / session handling

Login is phone number + OTP, so the tests don't log in. They reuse a session you save by hand.

- **Save a session:** run `npm run auth`. Chrome opens in Playwright codegen. Log in with your phone and OTP, wait until the app's main page loads, then **close the browser window**. Playwright writes `auth.json` when the window closes. `auth.json` is in `.gitignore`; never commit it.
- **Where it lives:** in localStorage, not cookies (`auth_token`, a JWT, and `cityflo-auth`).
- **How long it lasts:** the access token expires **1 hour** after login (`iat` to `exp` in the JWT).
- **When it expires:** `tests/global-setup.ts` stops the run immediately with "session expired, run npm run auth". Re-run `npm run auth`.

## Why system Chrome

The tests use the installed Google Chrome (`channel: "chrome"`) because the bundled Chromium download stalls on this network. Video is off for the same reason (it needs the ffmpeg download); traces and screenshots cover the evidence.

## Why payment isn't automated

The staging Juspay page showed real UPI apps and a QR code, with no test-mode label or sandbox test instruments. So purchase, double-submit, buy-while-active and renewal tests are `test.fixme`. The tests that do go through the booking flow stub the order and payment-session calls, so they never create an order or reach the gateway.

## Layout

- `tests/`: specs:
  - `smoke`: the saved session still works
  - `plan-price`: price consistency, plus a soft check against PRD §3
  - `ride-pack-empty-state`: Ride Pack tab vs booking-flow plans
  - `autorenew-consent`: an auto-renew choice before payment
- `scripts/explore.mjs`, `scripts/drive.mjs`: exploration helpers. `scripts/redact.mjs` holds the redaction rules for saved traffic.
- `TEST_PLAN.md`, `BUGS.md`, `NOTES.md`, `notes/exploration.md`: deliverables and evidence.

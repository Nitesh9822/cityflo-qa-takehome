# Manual exploration pass (HAR summary)

- **When:** 2026-09-26, 15:01:59–15:07:45 IST
- **How:** a hand-driven pass in Playwright-controlled Chrome (`npx playwright open --load-storage=auth.json --save-har=…`)
- **Redaction:** the HAR (586 entries, about 40 MB) was reduced to the **110 Cityflo API calls** below, redacted with `scripts/redact.mjs`. The raw HAR was deleted afterwards.
- **Totals:** 100 GET and 10 POST, and every POST is `/api/v4/routes/search/`. All 110 returned 200.
- **No writes:** no order (`book-lite-pack`), booking, seat, payment, auto-renew or profile calls were made.

Labels: **[Observed]** comes from the recorded responses; **[Inferred]** is my interpretation.

## Differences from `notes/exploration.md`

1. **[Observed] Pack prices vary by route; the monthly price isn't a flat ₹3,000 or ₹2,950.**

   | Route (`route_pk`) | Boarding → drop stop | Unlimited Monthly (50 rides, 30 d) | Other prices |
   |---|---|---|---|
   | 6540 (Ghatkopar - BKC) | 18907 → 9 | **₹2,950** | 7 plans; normal ₹135; subscription ₹109; pack from ₹49/ride |
   | 6540 (Ghatkopar - BKC) | 18908 → 9 (different boarding stop) | **₹2,950** | Same 7 plans |
   | 9023 | 18907 → 1052 | **₹4,450** | 6 plans (no 10 Rides Pack); normal ₹189; subscription ₹159; pack from ₹79/ride; 180-day plan ₹23,700 |
   | 1425 | 28880 → 5143 | not opened | normal ₹249; subscription ₹129; pack from ₹89/ride |

   Earlier notes only had the Ghatkopar - BKC price. This confirms the fine print ("Actual fares may vary by route") and widens the PRD §3 gap: the PRD gives one monthly price.
2. **[Observed] No trace of the 14:41 unpaid order** at 15:05–15:07:
   - `GET /api/payments/transactions/`: `all_transactions: []`, balance 0
   - `get-upcoming-bookings`: `[]`
   - `get-past-bookings`: `[]`
   - support data: `subscriptions: []`, `ride_packs: []`
   - `has_active_subscription: false`, `lite_pack_active: false`

   [Inferred] The unpaid order didn't produce a charge, a pass or a visible pending entry. Server-side order state wasn't checked.
3. **[Observed] The Ride Pack tab still shows the empty-state data** at 15:07:41: the plans request has no route parameters and gets `plans: []`, while the booking flow for the same stops returned 7 plans at 15:04, 15:05 and 15:06. Consistent with BUG-002.
4. **[Observed] New read endpoints** not seen in earlier passes:
   - `GET /api/v3/rides/vehicle-ride-seat-layout/` (the seat screen for a one-way ride was opened; no seat was booked)
   - `GET /api/app/get-faqs-by-slug/?slug=ride_pack_faqs`
   - `GET /api/geo/get-geohash-locality-details/` (location lookup; lat/lng redacted)
   - `GET /api/b2c-corporate/get-corporate-customer-profile/`
   - `GET /api/v3/rides/get-past-bookings/`
   - `GET /api/v3/support/get-help-and-support-data/`
   - `GET /api/app/get-faqs-categories/`
   - `GET /api/app/get-how-to-videos/`
   - `GET /api/v1/get-all-conversation`
   - `GET /api/payments/transactions/`
   - `GET /api/v2/payments/get-wallet-page-options/` (`is_autopay_active: false`)
5. **[Observed] The support data response carries a `non_ride_issue_sage_ai_config` block** with the rider's name, phone, customer ID and a SageAI `api_key` (redacted here). [Inferred] It's probably a client key for the in-app support assistant. Whether that key is meant to be public wasn't checked, so it isn't filed as a bug.
6. **[Observed] The customer ID is a separate identifier from the JWT `user_id`.** It's the number built into Juspay merchant order IDs (`Cityflo<customerId>…`). The redaction rules now cover `customer_pk` and `api_key`, and one earlier file (`network/purchase-p1-checkout.json`) was scrubbed for it.
7. **[Observed] Unchanged:** `show_renew: false` and `has_active_subscription: false` throughout, `renewal_mode: null` on every plans response, and the Maps key error (the map wasn't recorded, only API calls).

## Cityflo API calls, in order

`[REDACTED]` marks values the rules removed; query strings are cut at 110 characters.

| # | Time (IST) | Method | Path | Status | Key response fields |
|---|---|---|---|---|---|
| 1 | 15:01:59 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 2 | 15:01:59 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 3 | 15:01:59 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 4 | 15:01:59 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 5 | 15:02:14 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 6 | 15:02:15 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 7 | 15:02:38 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 8 | 15:02:38 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 9 | 15:02:40 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 10 | 15:02:41 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 11 | 15:02:44 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 12 | 15:02:44 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 13 | 15:02:57 | GET | `/api/v3/rides/vehicle-ride-seat-layout/?vehicle_ride_pk=2194909&seat_booking_type=single&from_notify_me=false&start_stop_info_pk=876149&end_stop_info` | 200 | error_message null |
| 14 | 15:04:09 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 15 | 15:04:09 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 16 | 15:04:12 | GET | `/api/ride-protect/v1/summary/` | 200 | serviceable false; opted_in false |
| 17 | 15:04:12 | GET | `/api/v2/rides/get-lite-pack-details-with-plans/?start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_ride_pk=2194909` | 200 | plans 7; lite_pack_active false; renewal_mode null; Unlimited Monthly ₹2950/50 rides/30 d |
| 18 | 15:04:22 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 19 | 15:04:22 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 20 | 15:04:23 | GET | `/api/v3/rides/vehicle-ride-seat-layout/?vehicle_ride_pk=2194909&seat_booking_type=single&from_notify_me=false&start_stop_info_pk=876149&end_stop_info` | 200 | error_message null |
| 21 | 15:04:50 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 22 | 15:04:50 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 23 | 15:04:52 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 24 | 15:04:57 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=1052&route_slot_pk=126282` | 200 | 13 intermediate stops |
| 25 | 15:04:58 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=9023&start_stop_pk=18907&end_stop_pk=1052&start_stop_info_pk=852480&end_stop_info_pk=852494&vehicle_` | 200 | normal ₹189; subscription ₹159; single ₹49, subscription ₹159, lite_pack ₹79 |
| 26 | 15:05:01 | GET | `/api/v2/rides/get-lite-pack-details-with-plans/?start_stop_info_pk=852480&end_stop_info_pk=852494&vehicle_ride_pk=2193502` | 200 | plans 6; lite_pack_active false; renewal_mode null; Unlimited Monthly ₹4450/50 rides/30 d |
| 27 | 15:05:14 | GET | `/api/app/get-faqs-by-slug/?slug=ride_pack_faqs&source=app` | 200 | array(23) |
| 28 | 15:05:23 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=9023&start_stop_pk=18907&end_stop_pk=1052&start_stop_info_pk=852480&end_stop_info_pk=852494&vehicle_` | 200 | normal ₹189; subscription ₹159; single ₹49, subscription ₹159, lite_pack ₹79 |
| 29 | 15:05:23 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=1052&route_slot_pk=126282` | 200 | 13 intermediate stops |
| 30 | 15:05:24 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 31 | 15:05:24 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 32 | 15:05:24 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 33 | 15:05:24 | GET | `/api/v2/ondc/transit/tickets/` | 200 | tickets, scheduled_journeys |
| 34 | 15:05:24 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 35 | 15:05:25 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 36 | 15:05:25 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 37 | 15:05:25 | GET | `/api/v3/rides/get-upcoming-bookings/?page=1&page_size=10` | 200 | upcoming_bookings 0 |
| 38 | 15:05:28 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 39 | 15:05:28 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 40 | 15:05:28 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 41 | 15:05:30 | GET | `/api/v2/routes/get-search-suggestions-for-customer/?session_token=[REDACTED]&time_of_day=2&search_type=pickup` | 200 | home, office, recent_history |
| 42 | 15:05:43 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 43 | 15:05:43 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=1052&route_slot_pk=126282` | 200 | 13 intermediate stops |
| 44 | 15:05:44 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 45 | 15:05:47 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 46 | 15:05:47 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 47 | 15:05:48 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 48 | 15:05:48 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 49 | 15:05:50 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 50 | 15:05:50 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 51 | 15:05:53 | GET | `/api/ride-protect/v1/summary/` | 200 | serviceable false; opted_in false |
| 52 | 15:05:53 | GET | `/api/v2/rides/get-lite-pack-details-with-plans/?start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_ride_pk=2194910` | 200 | plans 7; lite_pack_active false; renewal_mode null; Unlimited Monthly ₹2950/50 rides/30 d |
| 53 | 15:06:06 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18907&end_stop_pk=9&start_stop_info_pk=876149&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 54 | 15:06:06 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 55 | 15:06:10 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 56 | 15:06:12 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 57 | 15:06:12 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 58 | 15:06:15 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 59 | 15:06:15 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 60 | 15:06:21 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128406` | 200 | 17 intermediate stops |
| 61 | 15:06:30 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18908&end_stop_pk=9&route_slot_pk=128405` | 200 | 16 intermediate stops |
| 62 | 15:06:30 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=6540&start_stop_pk=18908&end_stop_pk=9&start_stop_info_pk=876132&end_stop_info_pk=876143&vehicle_rid` | 200 | normal ₹135; subscription ₹109; single ₹49, subscription ₹109, lite_pack ₹49 |
| 63 | 15:06:34 | GET | `/api/v2/rides/get-lite-pack-details-with-plans/?start_stop_info_pk=876132&end_stop_info_pk=876143&vehicle_ride_pk=2194911` | 200 | plans 7; lite_pack_active false; renewal_mode null; Unlimited Monthly ₹2950/50 rides/30 d |
| 64 | 15:06:43 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 65 | 15:06:43 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 66 | 15:06:43 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 67 | 15:06:43 | GET | `/api/v2/ondc/transit/tickets/` | 200 | tickets, scheduled_journeys |
| 68 | 15:06:43 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 69 | 15:06:43 | GET | `/api/b2c-corporate/get-corporate-customer-profile/` | 200 | is_active true |
| 70 | 15:06:43 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 71 | 15:06:47 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 72 | 15:06:47 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18908&end_stop_pk=9&route_slot_pk=128405` | 200 | 16 intermediate stops |
| 73 | 15:06:47 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 74 | 15:06:49 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 75 | 15:06:50 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 76 | 15:06:50 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 77 | 15:06:50 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 78 | 15:06:53 | GET | `/api/v2/routes/get-search-suggestions-for-customer/?session_token=[REDACTED]&time_of_day=2&search_type=pickup` | 200 | home, office, recent_history |
| 79 | 15:06:59 | GET | `/api/geo/get-geohash-locality-details/?lat=[REDACTED]&lng=[REDACTED]` | 200 | lat, lng |
| 80 | 15:07:01 | POST | `/api/v4/routes/search/` | 200 | booking_dates 5; result_type b2c |
| 81 | 15:07:01 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=18907&end_stop_pk=9&route_slot_pk=128405` | 200 | 17 intermediate stops |
| 82 | 15:07:02 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=28880&end_stop_pk=2668&route_slot_pk=116056` | 200 | 10 intermediate stops |
| 83 | 15:07:07 | GET | `/api/v2/routes/get-path-between-stops/?start_stop_pk=28880&end_stop_pk=5143&route_slot_pk=116056` | 200 | 11 intermediate stops |
| 84 | 15:07:07 | GET | `/api/routes/get-product-offerings-between-stops?route_pk=1425&start_stop_pk=28880&end_stop_pk=5143&start_stop_info_pk=882978&end_stop_info_pk=632309&vehicle_` | 200 | normal ₹249; subscription ₹129; single ₹49, subscription ₹129, lite_pack ₹89 |
| 85 | 15:07:10 | GET | `/api/v3/rides/vehicle-ride-seat-layout/?vehicle_ride_pk=1958163&seat_booking_type=single&from_notify_me=false&start_stop_info_pk=882978&end_stop_info` | 200 | error_message null |
| 86 | 15:07:36 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 87 | 15:07:36 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 88 | 15:07:36 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 89 | 15:07:36 | GET | `/api/v2/users/get-user-profile/` | 200 | first_name, last_name, mobile_number, email, email_verified |
| 90 | 15:07:36 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 91 | 15:07:36 | GET | `/api/v3/rides/get-upcoming-bookings/?page=1&page_size=10` | 200 | upcoming_bookings 0 |
| 92 | 15:07:39 | GET | `/api/v3/rides/get-past-bookings/?page=1&page_size=10` | 200 | past_bookings 0 |
| 93 | 15:07:41 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 94 | 15:07:41 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 95 | 15:07:41 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 96 | 15:07:41 | GET | `/api/ride-protect/v1/summary/` | 200 | serviceable false; opted_in false |
| 97 | 15:07:41 | GET | `/api/v2/rides/get-lite-pack-details-with-plans/` | 200 | plans 0; lite_pack_active false; renewal_mode null |
| 98 | 15:07:42 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 99 | 15:07:42 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 100 | 15:07:42 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 101 | 15:07:42 | GET | `/api/v3/support/get-help-and-support-data/` | 200 | subscriptions 0; ride_packs 0; sage_ai_config keys user_id,customer_pk,phone_number,name,city,base_url,api_key |
| 102 | 15:07:42 | GET | `/api/app/get-faqs-categories/` | 200 | array(10) |
| 103 | 15:07:42 | GET | `/api/app/get-how-to-videos/` | 200 | title, how_to_videos |
| 104 | 15:07:42 | GET | `/api/v1/get-all-conversation?user_id=[REDACTED]&count=10` | 200 | array(0) |
| 105 | 15:07:43 | GET | `/api/users/get-home-data-main/` | 200 | has_active_subscription false; show_renew false |
| 106 | 15:07:43 | GET | `/api/users/get-home-screen-data/?time_of_day=2` | 200 | address_section, waitlist_info, upcoming_rides, has_more_upcoming_rides, ride_nudges |
| 107 | 15:07:43 | GET | `/api/v2/rides/seat-waitlist/active/` | 200 | entries, recently_confirmed |
| 108 | 15:07:43 | GET | `/api/v2/users/get-more-details/` | 200 | credits_balance, flo_cash_balance, num_free_rides, city_watermark_image_url, impact_screen_banner_visible |
| 109 | 15:07:45 | GET | `/api/payments/transactions/` | 200 | all_transactions 0; balance 0 |
| 110 | 15:07:45 | GET | `/api/v2/payments/get-wallet-page-options/` | 200 | is_autopay_active false |

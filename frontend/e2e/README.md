# Week 7 browser checks

Run from `frontend`: `npm run e2e` (all 10 flows) or `npm run e2e:public` (2 public flows).
Install Chromium once with `npx playwright install chromium`.
Set `PLAYWRIGHT_BASE_URL` to an approved test deployment (default `http://localhost:4200`).
The deployment must route `/api` to its backend and contain published bookable properties.
No HTTP responses are mocked. Missing fixtures are reported as **skipped/BLOCKED**, never passed.

Supply secrets through process environment or an untracked local configuration; do not commit credentials.
Required variables by flow:

| Flow | Configuration |
|---|---|
| 01–02 discovery/detail | Published property inventory; province API returns 34 entries |
| 03 promotion/hold | `E2E_GUEST_EMAIL`, `E2E_GUEST_PASSWORD`, `E2E_GUEST_NAME`, `E2E_GUEST_PHONE`, `E2E_HOLD_URL`, `E2E_PROMO_CODE` |
| 04 payment result/status | `E2E_VNPAY_RETURN_URL`, `E2E_LOOKUP_TOKEN`, `E2E_BOOKING_EXPECTED_STATUS` from a real sandbox payment |
| 05 Owner HQ | `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`; account must have tenant-wide HQ access |
| 06 walk-in/check-in/out | `E2E_RECEPTIONIST_EMAIL`, `E2E_RECEPTIONIST_PASSWORD` (optional `E2E_WALKIN_GUEST_NAME`, `E2E_WALKIN_GUEST_EMAIL`, `E2E_WALKIN_GUEST_PHONE`); creates reservation through the UI walk-in modal form |
| 07 housekeeping | `E2E_HOUSEKEEPER_EMAIL`, `E2E_HOUSEKEEPER_PASSWORD`, `E2E_HOUSEKEEPING_ROOM` with a claimable task |
| 08 refund | `E2E_MANAGER_EMAIL`, `E2E_MANAGER_PASSWORD`, `E2E_REFUND_BOOKING_CODE` with a pending D23 request |
| 09 platform | `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD` |
| 10 branch denial | Receptionist credentials, `E2E_PROPERTY_ID`, `E2E_FORBIDDEN_PROPERTY_ID` |
| 11 HK 2-browser realtime | `E2E_HOUSEKEEPER_*`, `E2E_RECEPTIONIST_*`, `E2E_REALTIME_CHECKOUT_CODE`, `E2E_REALTIME_ROOM_NUMBER` |
| 12 Guest CRM UI | `E2E_RECEPTIONIST_*`, `E2E_CRM_PHONELESS_EMAIL` (phone-less guest reservation) |

For multi-branch staff, also set `E2E_<ROLE>_BRANCH_NAME` to the unique visible branch name.
Mutation flows 03/06/07/08/11/12 require `E2E_ALLOW_MUTATIONS=true` and disposable test data.
Do not run payouts against real financial records. Reset fixtures through the authorized local test workflow before rerunning.
Flow 06 creates the walk-in reservation through the `/reservations` UI modal form (`Tạo đặt phòng mới`) and then completes UI check-in and check-out.
Flow 04 verifies an existing sandbox return and status; it does not automate bank payment.

Screenshots and traces go to the OS temporary directory `hotelsaas-week7-playwright`, or `PLAYWRIGHT_OUTPUT_DIR`.
These may contain session data: keep them local, do not commit/upload them without review.
Type check: `npx tsc --ignoreConfig --noEmit --strict --types node --target ES2022 --module nodenext --moduleResolution nodenext --skipLibCheck playwright.config.ts e2e/support.ts e2e/core-flows.spec.ts e2e/housekeeping-crm.spec.ts`.

Observed on 2026-11-26: Staging (`https://luxustay.duckdns.org`) recovered from HTTP 502 and passed public Flows `01`–`02` (`2/2 PASS`); login pages hide demo quick-fill in production builds (`isDevDemoVisible = !environment.production`). On an isolated local stack (`http://127.0.0.1:4200` + disposable local DB) in a single unbroken 12-spec run, Flows `01`–`03` and `05`–`12` (including real `HOUSEKEEPER` Flows `07` and `11` with zero extra permissions) passed (`11/12 PASS`), while Flow `04` remains skipped/BLOCKED without a real VNPay sandbox gateway transaction.

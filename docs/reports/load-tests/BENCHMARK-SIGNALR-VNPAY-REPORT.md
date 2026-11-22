# SignalR NotificationHub & VNPay Checkout/IPN Load Test Report

**Suite:** Hotel SaaS Platform v2 (`HotelSaas.WebApi`)  
**Tooling:** `k6.exe` (`C:\Program Files\k6\k6.exe`) via `scripts/load-tests/run-load-tests.ps1` (also supported on Linux/macOS via `scripts/load-tests/run-load-tests.sh`)  
**Executed Tier:** `smoke` (`load` and `stress` tiers configured and validated with `k6 inspect`, not executed against live target in this run)

---

## 1. Execution Environment & Setup

- **API Process:** `dotnet run --project backend/src/HotelSaas.WebApi --no-build --urls http://127.0.0.1:5055` (`ASPNETCORE_ENVIRONMENT=Development`)
- **Database Target:** Local PostgreSQL 17 on `localhost:5435` (`hotel_saas_dev_ngoc`, forced via `ConnectionStrings__DefaultConnection` from `appsettings.Development.json` so `.NET user-secrets` did not route load traffic to a shared remote database), with `Smtp__Enabled=false`.
- **VNPay Test Signing Config:** `Payment__Vnpay__TmnCode=TESTONLY` paired with an ephemeral HMAC-SHA512 test signing key passed identically to `HotelSaas.WebApi` and `k6` (`VNP_TMN_CODE`, `VNP_HASH_SECRET`).
- **Summary Secret Hygiene:** Both `run-load-tests.ps1` (`Protect-SummaryReport`) and `run-load-tests.sh` (`redact_summary_tokens`) automatically scrub ephemeral `setup_data.token` and `setup_data.checkoutLookupToken` values to `"<redacted>"` immediately after `--summary-export`.
- **Health Checks Before Suite Start:**
  - `GET /health` -> HTTP `200`
  - `GET /health/ready` -> HTTP `200` (`{"status":"ready","database":"connected"}`)
- **Clean Shutdown:** Background `HotelSaas.WebApi` process tree (`PID=24176`) terminated in `finally`; verified port `5055` had zero remaining listeners after completion.

### Configured Load Tiers (`TEST_TIER`)

| Script | `smoke` (Executed) | `load` (Configured) | `stress` (Configured) |
| :--- | :--- | :--- | :--- |
| [signalr-hub.k6.js](file:///c:/Projects/hotel-sass-rbac/scripts/load-tests/signalr-hub.k6.js) | `constant-vus`: 5 VUs for `15s` | `ramping-vus`: 5 -> 50 VUs (`20s` up, `30s` hold, `10s` down) | `ramping-vus`: 10 -> 50 -> 150 VUs (`15s` / `30s` / `15s`) |
| [vnpay-checkout-ipn.k6.js](file:///c:/Projects/hotel-sass-rbac/scripts/load-tests/vnpay-checkout-ipn.k6.js) | `constant-arrival-rate`: 5 req/s for `15s` (`preAllocatedVUs: 10`, `maxVUs: 30`) | `ramping-arrival-rate`: 10 -> 40 req/s (`20s` up, `30s` hold, `10s` down) | `ramping-arrival-rate`: 10 -> 40 -> 100 req/s (`15s` / `30s` / `15s`) |

---

## 2. SignalR NotificationHub Benchmark (`smoke`)

**Source Artifacts:** [signalr-hub.k6.js](file:///c:/Projects/hotel-sass-rbac/scripts/load-tests/signalr-hub.k6.js), [signalr-summary-smoke.json](file:///c:/Projects/hotel-sass-rbac/docs/reports/load-tests/signalr-summary-smoke.json)

### Self-Contained Seeding & Test Flow
1. `setup()` resolves a valid province code via `GET /api/locations/provinces`, registers a unique tenant + Branch 1 (`POST /api/auth/partner-register`), logs in as Owner (`POST /api/auth/login`), creates Branch 2 (`POST /api/properties`), provisions a `Receptionist` scoped strictly to Branch 1 (`POST /api/staff`), and logs in as that Receptionist.
2. `warmupSignalRHub()` runs one `negotiate` + `JoinProperty(Branch 1)` + `LeaveProperty(Branch 1)` handshake before VU iterations start so EF Core query compilation and SignalR dispatcher JIT do not skew VU percentiles.
3. Each VU iteration:
   - Calls `POST /hubs/notifications/negotiate?negotiateVersion=1`
   - Upgrades WebSocket (`GET /hubs/notifications?id=...&access_token=...`) and negotiates SignalR JSON protocol v1 (`\x1e` framing)
   - Invokes `JoinProperty(Branch 1)` (authorized — must succeed)
   - Invokes `JoinProperty(Branch 2)` (cross-branch — must throw `ERR_PROPERTY_FORBIDDEN` or `ERR_CROSS_TENANT_FORBIDDEN`)
   - Invokes `LeaveProperty(Branch 1)` and closes cleanly

### Observed Results (`306` VU Iterations, `307` WS Sessions, `313` HTTP Requests)

| Metric | Threshold | Observed (`smoke`) | Status |
| :--- | :--- | :--- | :--- |
| `checks` (`1,530` total) | 100% pass | `1,530 / 1,530` (`100.00%`, `0` fails) | PASS |
| `http_req_failed` | `rate < 0.01` | `0.00%` (`0 / 313`) | PASS |
| `signalr_negotiate_duration_ms` | `p(95) < 200ms`, `p(99) < 400ms` | `avg=1.74ms`, `med=1.51ms`, `p(90)=2.71ms`, `p(95)=4.02ms`, `p(99)=7.06ms`, `max=9.16ms` | PASS |
| `signalr_join_property_duration_ms` | `p(95) < 150ms`, `p(99) < 300ms` | `avg=20.17ms`, `min=6.00ms`, `med=18.00ms`, `p(90)=29.50ms`, `p(95)=33.00ms`, `p(99)=66.24ms`, `max=99.00ms` | PASS |
| `signalr_ws_connection_success` | `rate > 0.99` | `100.00%` (`306 / 306`) | PASS |
| `signalr_cross_branch_isolation_blocked` | `rate == 1.0` | `100.00%` (`306 / 306` blocked) | PASS |
| `ws_session_duration` | Informational | `avg=44.60ms`, `min=22.08ms`, `med=41.68ms`, `p(90)=61.29ms`, `p(95)=72.42ms`, `max=120.84ms` | PASS |

---

## 3. VNPay Checkout & IPN Concurrency Benchmark (`smoke`)

**Source Artifacts:** [vnpay-checkout-ipn.k6.js](file:///c:/Projects/hotel-sass-rbac/scripts/load-tests/vnpay-checkout-ipn.k6.js), [vnpay-summary-smoke.json](file:///c:/Projects/hotel-sass-rbac/docs/reports/load-tests/vnpay-summary-smoke.json)

### Self-Contained Seeding & Test Flow
1. `setup()` registers a dedicated partner hotel (`POST /api/auth/partner-register`), reads room types (`GET /api/public/properties/{slug}/room-types`), and creates two future guest holds via `POST /api/public/bookings/hold` (`firebaseIdToken: "dev-mock-token:<phone>"`):
   - **Hold 1 (Checkout URL):** exercised repeatedly on `POST /api/public/payments/vnpay/create-url` (`lookupToken`).
   - **Hold 2 (IPN Concurrency Target):** `confirmationCode=RES-334QY5`, `amountVnd=1200000`, `vnp_TransactionNo=VNP1794692422987` exercised concurrently under retry storm conditions.
2. Each VU iteration performs 3 sequential checks:
   - `POST /api/public/payments/vnpay/create-url` -> verifies HTTP `200` and `vnp_SecureHash=` signature generation
   - `GET /api/public/payments/vnpay/ipn` (valid HMAC-SHA512) -> verifies atomic confirmation (`00`) on first arrival and idempotent replay rejection (`02`) on subsequent retries
   - `GET /api/public/payments/vnpay/ipn` (tampered `vnp_Amount=100` with original signature) -> verifies fail-closed checksum rejection (`97`)

### Observed Results (`75` Iterations, `230` HTTP Requests)

| Metric | Threshold | Observed (`smoke`) | Status |
| :--- | :--- | :--- | :--- |
| `checks` (`300` total) | 100% pass | `300 / 300` (`100.00%`, `0` fails) | PASS |
| `http_req_failed` | `rate < 0.01` | `0.00%` (`0 / 230`) | PASS |
| `vnpay_create_url_duration_ms` | `p(95) < 250ms`, `p(99) < 500ms` | `avg=11.03ms`, `min=8.07ms`, `med=9.32ms`, `p(90)=12.66ms`, `p(95)=16.86ms`, `p(99)=36.07ms`, `max=79.53ms` | PASS |
| `vnpay_ipn_duration_ms` | `p(95) < 180ms`, `p(99) < 350ms` | `avg=15.12ms`, `min=10.03ms`, `med=11.72ms`, `p(90)=14.76ms`, `p(95)=19.75ms`, `p(99)=82.31ms`, `max=180.86ms` | PASS |
| `vnpay_idempotent_ipn_handled` | `rate == 1.0` | `100.00%` (`75 / 75`: `1` confirmed `00` + `74` duplicate blocked `02`) | PASS |
| `vnpay_tampered_checksum_rejected` | `rate == 1.0` | `100.00%` (`75 / 75` rejected with `97`) | PASS |

---

## 4. Prometheus `/metrics` Telemetry Verification

Snapshot captured from `GET http://127.0.0.1:5055/metrics` immediately after the smoke suite completed:

```text
hotelsaas_http_requests_total 853
hotelsaas_http_5xx_errors_total 0
hotelsaas_tenant_isolation_blocks_total 306
hotelsaas_tenant_isolation_blocks_by_reason_total{error_code="ERR_PROPERTY_FORBIDDEN"} 306
hotelsaas_signalr_active_connections 0
hotelsaas_vnpay_ipn_total{rsp_code="00"} 1
hotelsaas_vnpay_ipn_total{rsp_code="01"} 0
hotelsaas_vnpay_ipn_total{rsp_code="02"} 74
hotelsaas_vnpay_ipn_total{rsp_code="04"} 0
hotelsaas_vnpay_ipn_total{rsp_code="97"} 75
```

Route request counters confirmed zero 5xx errors and exact request accounting:
- `GET /hubs/notifications` (`status="101"`): `307` (`1` setup warmup + `306` test sessions)
- `POST /hubs/notifications/negotiate` (`status="200"`): `307` (`1` setup warmup + `306` test sessions)
- `POST /api/public/payments/vnpay/create-url` (`status="200"`): `75`
- `GET /api/public/payments/vnpay/ipn` (`status="200"`): `150` (`1` `00` + `74` `02` + `75` `97`)

*Note on SignalR connection gauge:* `hotelsaas_signalr_active_connections` returned to `0` after all `307` WebSocket sessions closed (no leaked connections). During earlier mid-SignalR `/metrics` sampling snapshots while VUs held concurrent sockets open, live values of `2` and `5` active connections were observed before dropping back to `0` on shutdown.

---

## 5. Diagnostic Findings Resolved During Verification

1. **Remote User-Secrets DB Override:** `.NET user-secrets` contained a remote database `ConnectionStrings:DefaultConnection`, which initially triggered `CloudDatabaseGuard` and added ~30ms WAN RTT per SQL query (`signalr_join_property_duration_ms p95=251.9ms`, `vnpay_ipn_duration_ms p95=531.27ms`). Injecting `ConnectionStrings__DefaultConnection` from `appsettings.Development.json` (`localhost:5435`) restored sub-20ms median query/transaction performance and isolated load tests from any shared database.
2. **Cold-Start Hub Compilation & Client Failsafe Timeout:** Adding `warmupSignalRHub()` in `signalr-hub.k6.js` `setup()` and extending the WebSocket failsafe timeout from `4000ms` to `10000ms` eliminated cold-start EF Core compilation lag and prevented premature client disconnects during initial concurrent `JoinProperty` invocations.
3. **Summary Secret Hygiene:** `run-load-tests.ps1` and `run-load-tests.sh` automatically redact `setup_data.token` and `setup_data.checkoutLookupToken` to `"<redacted>"` in exported `--summary-export` JSON files so CI secret scanners (`gitleaks`) never flag ephemeral test tokens.

---

## 6. Week 6 tier configuration update (2026-11-22)

The k6 scripts and Linux runner now use the required Week 6 targets. The benchmark results above are historical local smoke results from the earlier 15-second configuration; they do not represent a run of this updated schedule or a staging run.

| Scenario | Smoke | Load | Stress | Execution status for this update |
| :--- | :--- | :--- | :--- | :--- |
| SignalR | 5 VUs / 30s | 10 to 50 VUs / 2m ramp, 3m hold, 1m down | 100 VUs / ramp, 3m hold, 1m down | Not run in this update |
| VNPay IPN | 5 req/s / 30s | 10 to 50 req/s / 2m ramp, 3m hold, 1m down | 10 to 100 req/s / 1m ramp, 3m hold, 1m down | Not run in this update |

No new VU count, request rate, latency percentile, or error rate is reported because the Staging credentials, reservation identifiers, and VNPay signing configuration were not available in this session. VNPay setup now requires an explicit `VNP_TMN_CODE` and `VNP_HASH_SECRET`, plus either pre-seeded reservation data or valid Firebase ID tokens; it no longer sends `dev-mock-token` values.

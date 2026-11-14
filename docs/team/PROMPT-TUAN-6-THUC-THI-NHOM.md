# BỘ PROMPT THỰC THI & PHÂN CÔNG NHIỆM VỤ TUẦN 06 — HOTEL SAAS PLATFORM V2
### Dành cho 3 thành viên: Ngô Võ Tuấn An (Lead & DevOps), Nguyễn Khôi Nguyên (Reporting & Performance k6), Trần Trọng Tân (Operations & HTTP Security E2E)
- **Đơn vị:** Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE) — Khoa CNTT — Bộ môn CNPM
- **Đề tài ID:** `578` | **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
- **Nền tảng:** .NET 10 Clean Architecture + PostgreSQL 17 + Angular 22 Standalone Signals + Caddy + Docker
- **Môi trường Staging:** [https://luxustay.duckdns.org/](https://luxustay.duckdns.org/) | **Nhánh Git cơ sở:** `develop`
- **Vị trí trong Lộ trình 15 Tuần:** **Tuần 06 / 15** *(Hoàn tất yêu cầu GVHD Tuần 5, đóng lỗ hổng nghiêm trọng phát hiện khi rà soát mã nguồn & lập biên bản hồi quy trên VPS Staging)*

---

## 1. MỤC TIÊU TRỌNG TÂM TUẦN 06 (SAU RÀ SOÁT TOÀN BỘ SOURCE CODE)

Qua kiểm toán toàn diện mã nguồn hiện tại bằng Swarm, nhóm xác định **2 nhóm mục tiêu bắt buộc của Tuần 06** trước khi chuyển sang giai đoạn phát triển tính năng mới Tuần 7–15:

1. **Hoàn tất 3 hạng mục GVHD còn lại + Nghiệm thu thực tế trên VPS Staging (`https://luxustay.duckdns.org/`):**
   - **Ngô Võ Tuấn An:** Đưa cụm PLG có sẵn (`docker/docker-compose.observability.yml` + `docker/observability/`) lên mạng Staging, bổ sung Grafana Dashboard JSON, sửa đường dẫn Caddy `/hubs/*` & khóa `/metrics`, `/swagger*`; nối `ISystemMetricsRecorder` để metric SignalR & VNPay `RspCode 97` hoạt động thật; rà soát B2C OTP/OAuth & 5 tài khoản PMS.
   - **Nguyễn Khôi Nguyên:** Chạy thật 2 kịch bản k6 (`scripts/load-tests/`) trên Staging theo 3 cấp độ `smoke / load / stress`, xuất báo cáo số liệu tại `docs/reports/load-tests/`; kiểm tra hóa đơn PDF QR (`QRCoder`), VietQR ngân hàng & đối soát DB trang Báo cáo.
   - **Trần Trọng Tân:** Xây dựng bộ test HTTP E2E cô lập chéo chi nhánh `CrossBranchSecurityE2ETests.cs` (`WebApplicationFactory<Program>` + `JwtService` thật) chứng minh `403 Forbidden` trên `/api/rooms`, `/api/reservations/{id}/check-in`, `/api/reports/*`, giả mạo `X-Property-Id`; làm mới bộ `tests/bruno/hotel-saas/`; kiểm tra thực tế thu ngân D23 + SignalR Bell + quét hold 15 phút.
2. **Xử lý ngay 3 điểm nóng bảo mật & dữ liệu phát hiện khi kiểm toán mã nguồn:**
   - **An:** Chặn `dev-mock-token` trên môi trường Production/Staging trong `FirebaseAuthService.cs` và `firebase-auth.service.ts` (giữ sandbox `+84123456789` theo cấu hình an toàn non-Prod hoặc flag rõ ràng).
   - **Nguyên:** Gỡ bỏ tỷ lệ chia doanh thu thanh toán giả `0.45m / 0.35m / 0.20m` trong `ReportsController.cs` & `GetGroupAnalyticsQueryHandler.cs`, gỡ fallback số liệu giả trong `reports.page.ts`, và bổ sung `[RequirePermission("REPORTS", PermissionAction.Read)]` + kiểm tra `IsTenantWide`.
   - **Tân:** Kiểm chứng đường biên quyền hạn giữa các chi nhánh qua HTTP thực tế, không dựa vào mock `ICurrentTenantService`.

---

## 2. QUY TRÌNH GIT, TÁCH FILE & CỔNG CHẤT LƯỢNG (ZERO MERGE CONFLICT)

### Quy tắc tách biệt `ALLOWED FILES` Tuần 06 (`A ∩ B = ∅`, `A ∩ C = ∅`, `B ∩ C = ∅`):

| Thành viên | Nhánh Git Tuần 06 | Thư mục / File được phép chỉnh sửa (`ALLOWED FILES`) |
|---|---|---|
| **Ngô Võ Tuấn An** (`24TX810001`) | `feature/an-week6-observability-auth` | `docker/docker-compose.observability.yml`, `docker/observability/**`, `deploy/**`, `docker-compose.staging.yml`, `.github/workflows/cd-vps.yml`, `backend/src/HotelSaas.Application/Common/Interfaces/ISystemMetricsRecorder.cs` *(tạo mới)*, `backend/src/HotelSaas.Application/Payments/Commands/ProcessVnpayIpn/ProcessVnpayIpnCommand.cs`, `backend/src/HotelSaas.Infrastructure/Hubs/NotificationHub.cs`, `backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs`, `backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`, `backend/src/HotelSaas.WebApi/Program.cs`, `frontend/src/app/core/services/firebase-auth.service.ts`, `docs/reports/BAO-CAO-TUAN-6-NGO-VO-TUAN-AN-24TX810001.md` |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | `feature/nguyen-week6-k6-reports-audit` | `scripts/load-tests/**`, `docs/reports/load-tests/**`, `backend/src/HotelSaas.Application/Reports/**`, `backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`, `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`, `frontend/src/app/features/reports/**`, `docs/reports/BAO-CAO-TUAN-6-NGUYEN-KHOI-NGUYEN-24TX810011.md` |
| **Trần Trọng Tân** (`24TX810025`) | `feature/tan-week6-security-e2e-d23` | `backend/tests/HotelSaas.WebApi.Tests/Security/**`, `tests/bruno/**`, `frontend/src/app/features/payments/components/refund-approval/**`, `frontend/src/app/shared/components/notification-bell/**`, `docs/reports/BAO-CAO-TUAN-6-TRAN-TRONG-TAN-24TX810025.md` |

### Lệnh đồng bộ & kiểm định bắt buộc trước khi tạo PR:
```bash
git status
git checkout develop && git fetch origin && git pull origin develop
git checkout -b <ten-nhanh-cua-ban>

# Quality Gates:
dotnet build backend/HotelSaas.slnx --verbosity minimal
dotnet test backend/HotelSaas.slnx --no-build
npm --prefix frontend run build
npx --prefix frontend ng test --watch=false --progress=false
```

---

## 3. PHÂN CÔNG & PROMPT CHO NGÔ VÕ TUẤN AN (`24TX810001` — Lead, DevOps & Auth)
* **Nhánh:** `feature/an-week6-observability-auth` | **AI IDE:** Google Antigravity IDE (`Gemini 3.8 Flash`)

### 🔹 Prompt A01 — Kết Nối PLG Observability (`docker/`), Sửa Caddyfile & Nối Metric SignalR/VNPay-97
```text
Bạn là Senior DevOps & .NET Clean Architecture Engineer của dự án Hotel SaaS Platform v2 (.NET 10 + PostgreSQL 17 tại https://luxustay.duckdns.org/).

HIỆN TRẠNG MÃ NGUỒN ĐÃ RÀ SOÁT:
1. Cụm Prometheus + Loki + Promtail + Grafana ĐÃ CÓ SẴN tại `docker/docker-compose.observability.yml` và `docker/observability/` (KHÔNG tạo thư mục trùng `deploy/monitoring/`). Tuy nhiên:
   - `docker/observability/grafana/provisioning/` mới có `datasources/datasources.yml`, CHƯA CÓ thư mục `dashboards/` và các file Dashboard JSON.
   - `docker-compose.observability.yml` đang dùng network `hotelsaas-net` trong khi Staging dùng `hotelsaas-staging-network` (và đang tồn tại 2 file `docker-compose.staging.yml` ở root và `deploy/docker-compose.staging.yml`).
   - Grafana đang bind port public `3001:3000`.
2. `deploy/Caddyfile`:
   - Đang định tuyến `@signalr { path /hub/* }` trong khi `Program.cs` map `NotificationHub` tại `/hubs/notifications` -> SignalR không đi đúng nhánh Caddy.
   - Đang mở công khai `/metrics` và `/swagger*` ra Internet, và chưa có route `/grafana/*` được bảo vệ.
3. `backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`:
   - Class `SystemMetricsRegistry` đã định nghĩa `RecordVnpayIpnResult(string rspCode)`, `IncrementSignalRConnection()`, `DecrementSignalRConnection()` NHƯNG hiện chưa có nơi nào trong `backend/src/` gọi chúng (làm cảnh báo `VnpaySignatureTamperDetected` luôn bằng 0).
   - Lưu ý Clean Architecture: `Infrastructure` và `Application` KHÔNG được phép reference trực tiếp `WebApi`.

YÊU CẦU KỸ THUẬT:
1. Tạo interface `backend/src/HotelSaas.Application/Common/Interfaces/ISystemMetricsRecorder.cs` (chứa `RecordVnpayIpnResult`, `IncrementSignalRConnection`, `DecrementSignalRConnection`). Cho `SystemMetricsRegistry` (hoặc service wrapper trong `WebApi`) implement interface này và đăng ký DI trong `Program.cs`.
2. Inject `ISystemMetricsRecorder` (optional/null-safe để không vỡ các unit test constructor hiện có) vào `ProcessVnpayIpnCommand.cs` (ghi `00`, `02`, `97`) và `NotificationHub.cs` (`OnConnectedAsync` / `OnDisconnectedAsync`).
3. Thống nhất 1 cấu hình Staging tại `deploy/docker-compose.staging.yml` (xóa hoặc hợp nhất bản trùng ở root nếu không dùng trong `cd-vps.yml`), gắn `docker/docker-compose.observability.yml` dùng external network `hotelsaas-staging-network` và bind cổng Grafana/Prometheus về `127.0.0.1` hoặc mạng nội bộ.
4. Bổ sung `docker/observability/grafana/provisioning/dashboards/dashboards.yml` và file JSON Dashboard hoàn chỉnh hiển thị: HTTP RPS (2xx/4xx/5xx), Latency P50/P95/P99, API calls theo `PropertyId`, SignalR active connections, VNPay IPN results (`00`/`97`).
5. Sửa `deploy/Caddyfile`: đổi `@signalr` sang `path /hubs/*`, thêm reverse proxy `/grafana/*` có basicauth hoặc IP whitelist, chặn `/metrics` và `/swagger*` khỏi public Internet (chỉ cho localhost/internal network), cập nhật `deploy/deploy.sh` & `.github/workflows/cd-vps.yml` nếu cần đồng bộ stack.

RÀNG BUỘC FILE: Chỉ sửa các file thuộc `ALLOWED FILES` của Ngô Võ Tuấn An. Chạy `dotnet build backend/HotelSaas.slnx` và `dotnet test backend/HotelSaas.slnx` (hoặc subset non-DB nếu local PostgreSQL 5435 tắt) để xác nhận không lỗi biên dịch.
```

### 🔹 Prompt A02 — Khóa `dev-mock-token` Theo Môi Trường & Rà Soát Hồi Quy B2C/PMS Trên Staging
```text
Bạn là Lead Security & QA Engineer của Hotel SaaS Platform v2.

HIỆN TRẠNG MÃ NGUỒN CẦN XỬ LÝ:
- Trong `backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs` (khoảng dòng 121-130), tiền tố `dev-mock-token:` đang được chấp nhận VÔ ĐIỀU KIỆN ngay cả trên Production/Release build!
- Trong `frontend/src/app/core/services/firebase-auth.service.ts` (khoảng dòng 148-174), khi Firebase gặp lỗi runtime (quota, billing), client tự bật `isMockMode = true` và trả về `dev-mock-token:...` mà không kiểm tra `!environment.production`.

YÊU CẦU KỸ THUẬT:
1. Gating `FirebaseAuthService.cs` tương tự `GoogleAuthService.cs`: chỉ cho phép `dev-mock-token:` khi `#if DEBUG` VÀ môi trường là `Development` hoặc `Testing` (`IHostEnvironment`). Trên `Staging`/`Production` phải từ chối token giả ngay lập tức (fail-closed).
2. Trong `frontend/src/app/core/services/firebase-auth.service.ts`, chặn fallback sang `isMockMode = true` khi `environment.production === true` (hiển thị lỗi rõ ràng cho người dùng thay vì tự tạo token giả). Lưu ý: số test sandbox của Google Identity Platform (`+84123456789` / OTP `123456` cấu hình trên Firebase Console) vẫn giữ hoạt động qua Firebase thật.
3. Thực hiện rà soát hồi quy trên VPS Staging (`https://luxustay.duckdns.org/`) và xuất biên bản vào `docs/reports/BAO-CAO-TUAN-6-NGO-VO-TUAN-AN-24TX810001.md`:
   - B2C Guest Hold với Firebase SMS OTP (+84123456789 sandbox và SĐT thật) + PrimeNG DatePicker UTC+7 + đồng hồ đếm ngược 15 phút.
   - Google OAuth Login (kiểm tra `IsEmailVerified = true`).
   - Đăng nhập 5 tài khoản test PMS (`owner@hotelsaas.local`, `manager.both@hotelsaas.local`, `staff.single@hotelsaas.local`, `superadmin@hotelsaas.platform`, `guest.vip@hotelsaas.local`).
   - Trích 1 dòng log JSON thực tế từ `docker logs` có đủ `CorrelationId`, `TenantId`, `PropertyId`.
```

---

## 4. PHÂN CÔNG & PROMPT CHO NGUYỄN KHÔI NGUYÊN (`24TX810011` — Finance, Reports & k6 Performance)
* **Nhánh:** `feature/nguyen-week6-k6-reports-audit` | **AI IDE:** OpenAI Codex / Antigravity IDE

### 🔹 Prompt N01 — Chuẩn Hóa & Thực Thi k6 Load Test (SignalR + VNPay IPN) Trên VPS Staging
```text
Bạn là Senior Performance & Load Test Engineer của Hotel SaaS Platform v2.

HIỆN TRẠNG MÃ NGUỒN ĐÃ RÀ SOÁT (`scripts/load-tests/`):
1. Đã có sẵn `run-load-tests.sh`, `signalr-hub.k6.js`, `vnpay-checkout-ipn.k6.js`, nhưng CHƯA TỪNG ĐƯỢC CHẠY (`docs/reports/load-tests/` chưa tồn tại).
2. `signalr-hub.k6.js` mặc định `PROPERTY_ID='22222222-...'` và fallback `'demo-load-test-jwt-token'` (sẽ bị 401 nếu chạy thật). Kịch bản mặc định tăng tới 150 VUs.
3. `vnpay-checkout-ipn.k6.js` bắn tới 100 req/s với `RESERVATION_CODE='RES-VNP-LOAD01'` cố định và `run-load-tests.sh` dùng `--network=host` mà chưa truyền `JWT_TOKEN`, `PROPERTY_ID`, `VNP_HASH_SECRET`, chưa tách 3 chế độ `smoke | load | stress`.

YÊU CẦU KỸ THUẬT:
1. Nâng cấp `scripts/load-tests/run-load-tests.sh`, `signalr-hub.k6.js`, và `vnpay-checkout-ipn.k6.js`:
   - Hỗ trợ 3 tier truyền qua biến môi trường `TEST_TIER=smoke|load|stress`:
     * `smoke`: 5 VUs trong 30 giây (xác nhận kết nối & auth).
     * `load`: ramp-up 10 -> 50 VUs trong 2 phút, giữ 50 VUs trong 3 phút, ramp-down 1 phút (an toàn cho VPS Staging 2 vCPU / 4GB RAM, tránh kích hoạt Caddy rate-limit 429).
     * `stress`: 100 VUs WebSocket SignalR / 80-100 RPS VNPay IPN (kèm ngưỡng `http_req_failed < 1%`, `p(95) < 500ms` cho IPN, handshake `< 200ms` cho SignalR).
   - Bỏ token giả hardcoded mặc định: yêu cầu lấy `JWT_TOKEN` thật (hoặc đăng nhập qua `POST /api/auth/login` trong hàm `setup()` của k6 khi truyền `TEST_EMAIL`/`TEST_PASSWORD`) và kiểm tra biến `VNP_HASH_SECRET` cho VNPay IPN (kết hợp test chữ ký sai trả `RspCode: 97` để kích hoạt metric cảnh báo trên Grafana).
2. Chạy k6 thực tế nhắm tới `https://luxustay.duckdns.org/` (hoặc Docker Staging), lưu file kết quả thô JSON (`--summary-export`) và báo cáo tổng hợp bảng số liệu (VUs, Total Requests, RPS, P50/P90/P95, Error Rate) vào `docs/reports/load-tests/`.
```

### 🔹 Prompt N02 — Sửa Lỗ Hổng Dữ Liệu Báo Cáo & Rà Soát PDF QR (`QRCoder`), VietQR, SQL Reconciliation
```text
Bạn là Senior Backend Reporting & Financial Auditor cho Hotel SaaS Platform v2.

HIỆN TRẠNG MÃ NGUỒN CẦN SỬA GẤP:
1. `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`:
   - Thiếu hoàn toàn `[RequirePermission("REPORTS", PermissionAction.Read)]` trên các endpoint! Hiện mới có `[Authorize]` ở cấp class, khiến nhân viên không có quyền xem báo cáo vẫn gọi được API.
   - `GetRevenueSummary` (dòng 153-162) và `GetGroupAnalyticsQueryHandler.cs` (dòng 336-345) đang **giả lập tỷ lệ chia tiền** `0.45m / 0.35m / 0.20m` khi `totalPaymentCount == 0 && totalRevenue > 0`, đồng thời kéo danh sách `Reservations` về RAM bằng `.ToListAsync()` trước khi tổng hợp.
   - `GetGroupAnalyticsQueryHandler.cs` dùng `.IgnoreQueryFilters()` nhưng chưa kiểm tra người gọi có `IsTenantWide == true` hoặc quyền cấp tập đoàn.
2. `frontend/src/app/features/reports/reports.page.ts` (dòng 663-791):
   - Khi API `getGroupAnalytics` / `getPmsKpi` / `getRevenueSummary` lỗi, khối `catchError` đang **âm thầm ghi đè số liệu giả lập cứng** (ví dụ `784000000` VND) thay vì hiển thị trạng thái lỗi rõ ràng!

YÊU CẦU KỸ THUẬT:
1. Gắn `[RequirePermission("REPORTS", PermissionAction.Read)]` vào `ReportsController.cs`, và kiểm tra quyền `IsTenantWide` trong `GetGroupAnalyticsQueryHandler.cs` (trả `403` nếu nhân viên chỉ được phân 1 chi nhánh nhưng lại truy vấn toàn tập đoàn).
2. Xóa bỏ hoàn toàn logic chia tỷ lệ giả `0.45m / 0.35m / 0.20m` ở cả `ReportsController.cs` và `GetGroupAnalyticsQueryHandler.cs` (trả đúng dữ liệu thanh toán thực tế 0đ nếu chưa thu tiền; dùng DB-side `GroupBy`/`Sum` thay cho `.ToListAsync()` trên bảng lớn khi thích hợp).
3. Trong `reports.page.ts`, xóa fallback số liệu cứng; khi API thất bại, hiển thị banner thông báo lỗi + nút Thử lại bằng Angular Signals + giữ `ChangeDetectionStrategy.OnPush`. Cập nhật unit test `reports.page.spec.ts` nếu cần.
4. Thực hiện rà soát & lập biên bản vào `docs/reports/BAO-CAO-TUAN-6-NGUYEN-KHOI-NGUYEN-24TX810011.md`:
   - Tải Hóa đơn PDF từ Staging, quét mã QR `QRCoder` kiểm tra link `https://luxustay.duckdns.org/booking/lookup?token=...`.
   - Quét mã VietQR động trên app ngân hàng thật (khớp STK, tên tài khoản, số tiền).
   - Đối soát từng đồng giữa số liệu SQL PostgreSQL và màn hình `reports.page.ts`.
```

---

## 5. PHÂN CÔNG & PROMPT CHO TRẦN TRỌNG TÂN (`24TX810025` — Operations, Security E2E & Realtime)
* **Nhánh:** `feature/tan-week6-security-e2e-d23` | **AI IDE:** Google Antigravity IDE / OpenAI Codex

### 🔹 Prompt T01 — Viết Bộ Test Tự Động E2E HTTP API Chứng Minh Cô Lập Chéo Chi Nhánh (`CrossBranchSecurityE2ETests.cs`)
```text
Bạn là Senior .NET 10 Security & Integration Test Engineer của Hotel SaaS Platform v2.

HIỆN TRẠNG MÃ NGUỒN ĐÃ KIỂM CHỨNG:
1. Hiện dự án CHƯA CÓ thư mục `backend/tests/HotelSaas.WebApi.Tests/Security/` và CHƯA CÓ file `CrossBranchSecurityE2ETests.cs`.
2. Hệ thống WebApi hiện tại dùng route KHÔNG có tiền tố `/v1/`:
   - `GET /api/rooms` (`RoomsController` — `[Route("api/rooms")]`)
   - `POST /api/reservations/{id}/check-in?propertyId={propertyId}` (`ReservationsController` — `[Route("api/reservations")]`)
   - `GET /api/payments?propertyId={propertyId}` và `GET /api/payments/shift-report?propertyId={propertyId}` (`PaymentsController` — `[Route("api/payments")]`)
   - `GET /api/reports/revenue-summary?propertyId={propertyId}` (`ReportsController` — `[Route("api/reports")]`)
3. Cấu trúc test WebApplicationFactory + real PostgreSQL schema cô lập của dự án đã có mẫu chuẩn tại `backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs` (dùng `[Collection("RealDatabaseTests")]`, `TEST_DB_CONNECTION` hoặc `localhost:5435;Database=hotel_saas_p1b01a_test`, và tạo JWT thật bằng `JwtService`).

YÊU CẦU KỸ THUẬT:
Viết file `backend/tests/HotelSaas.WebApi.Tests/Security/CrossBranchSecurityE2ETests.cs` đi qua **100% HTTP Authentication/Authorization + `TenantPropertyContextMiddleware` pipeline thật** (TUYỆT ĐỐI KHÔNG mock `ICurrentTenantService` hay `ICurrentPropertyService` khi gọi `HttpClient`):
1. Seed 1 Tenant gồm 2 Chi nhánh (`BranchA`, `BranchB`), 2 User Lễ tân: `ReceptionistA` (chỉ thuộc `BranchA`) và `ReceptionistB` (chỉ thuộc `BranchB`), cùng Phòng và Đặt phòng của mỗi chi nhánh.
2. Ký JWT Token THẬT qua `JwtService` với đầy đủ `TenantId`, `PropertyId`, `Role`/`Permissions` claims.
3. Kiểm chứng các kịch bản Fail-Closed (tất cả trả về `HttpStatusCode.Forbidden` — `403`, không rò rỉ dữ liệu chi nhánh kia):
   - **TC01:** `ReceptionistA` gọi `GET /api/rooms` nhưng đính kèm header `X-Property-Id: {BranchB}` -> `403 Forbidden`.
   - **TC02:** `ReceptionistA` giữ nguyên `X-Property-Id: {BranchA}` (hoặc đổi sang `BranchB`) nhưng gọi `POST /api/reservations/{ReservationOfBranchB}/check-in?propertyId={BranchB}` -> `403 Forbidden`.
   - **TC03:** `ReceptionistA` gọi `GET /api/payments?propertyId={BranchB}` (hoặc `GET /api/reservations/{ReservationOfBranchB}/folio?propertyId={BranchB}`) -> `403 Forbidden`.
   - **TC04:** `ReceptionistA` cố tình gọi `GET /api/reports/revenue-summary?propertyId={BranchB}` với header `X-Property-Id: {BranchB}` -> `403 Forbidden`.
   - **TC05:** `ReceptionistA` gửi token mang `PropertyId = BranchA` nhưng giả mạo cả query `?propertyId={BranchB}` lẫn header `X-Property-Id: {BranchB}` -> Middleware phát hiện bất tương thích và chặn `403 Forbidden`.
   - **TC06 (Cross-Tenant):** User thuộc `Tenant 1` cố truy cập tài nguyên `Tenant 2` -> chặn `403` / `404` không làm lộ sự tồn tại bản ghi.
4. Nếu test đụng điều kiện PostgreSQL local chưa bật (`5435`), viết rõ hướng dẫn chạy kèm Docker test DB giống `BookingHttpPipelineTests.cs`. Chạy kiểm tra: `dotnet test backend/HotelSaas.slnx --filter "FullyQualifiedName~CrossBranchSecurity"`.
```

### 🔹 Prompt T02 — Làm Mới Bruno Collection & Rà Soát Thu Ngân D23, Hold 15 Phút, SignalR Bell Trên Staging
```text
Bạn là Senior Operations QA & Realtime Engineer của Hotel SaaS Platform v2.

HIỆN TRẠNG MÃ NGUỒN ĐÃ RÀ SOÁT:
- Thư mục `tests/bruno/hotel-saas/` hiện có 7 file `.bru` nhưng `Local.bru` trỏ cứng `http://127.0.0.1:5283`, còn dùng `dev-mock-token` và ngày đặt phòng cũ trong quá khứ (`2026-11-20`).
- Luồng Thu ngân D23 (`refund-approval.component.ts` + `ConfirmRefundPayoutCommandHandler.cs`) dùng khóa giao dịch `pg_advisory_xact_lock`, SignalR (`<app-notification-bell>` + `NotificationDispatcher`) và tác vụ nền `ExpiredHoldSweepBackgroundService` (15 giây) đã sẵn sàng để kiểm chứng trên VPS Staging.

YÊU CẦU KỸ THUẬT:
1. Cập nhật `tests/bruno/hotel-saas/`: thêm environment `Staging.bru` trỏ `https://luxustay.duckdns.org`, bỏ ngày quá khứ cố định (dùng biến động pre-request script `new Date()` + ngày tương lai hợp lệ), bỏ lệ thuộc `dev-mock-token` trên Staging.
2. Thực hiện kiểm tra toàn trình trên VPS Staging (`https://luxustay.duckdns.org/`) và lập biên bản chi tiết kèm bằng chứng ảnh chụp/log vào `docs/reports/BAO-CAO-TUAN-6-TRAN-TRONG-TAN-24TX810025.md`:
   - **Chuông SignalR Realtime (`<app-notification-bell>`):** Mở 2 tab (Lễ tân Chi nhánh Sài Gòn vs Khách đặt phòng), xác nhận toast + Web Audio + badge nhảy ngay lập tức; đổi sang Chi nhánh Đà Lạt khẳng định KHÔNG nhận nhầm thông báo của Sài Gòn.
   - **Phê duyệt & Chi hoàn tiền D23:** Tạo đơn -> Hủy phòng -> Duyệt hoàn tiền -> Mở 2 tab thu ngân cùng bấm "Xác nhận chi hoàn" để chứng minh `pg_advisory_xact_lock` chặn chi trùng 2 lần.
   - **Nhả giữ phòng 15 phút (`ExpiredHoldSweepBackgroundService`):** Xác nhận phòng hết hạn hold tự trả về trạng thái trống và phát SignalR `HoldExpired`.
```

---

## 6. MẪU PROMPT TỔNG HỢP BÁO CÁO CÁ NHÂN & KHAI BÁO AI TUẦN 06 (CHO TỪNG THÀNH VIÊN)

Sau khi hoàn thành code & chạy nghiệm thu trên Staging, mỗi thành viên điền form Khai báo AI theo đúng thực tế đã chỉnh sửa:

| Thành viên | Công cụ AI khai báo | Các lỗi thực tế của AI cần tự sửa ở Tuần 06 *(Minh chứng để điền Form)* |
|---|---|---|
| **Ngô Võ Tuấn An** (`24TX810001`) | Google Antigravity IDE (`Gemini 3.8 Flash`) | 1. AI tạo mới thư mục `deploy/monitoring/` gây trùng với `docker/docker-compose.observability.yml` có sẵn và phơi port `3001` ra `0.0.0.0`.<br>2. AI gọi trực tiếp `SystemMetricsRegistry` (`WebApi`) từ `NotificationHub` (`Infrastructure`), vi phạm Clean Architecture nên phải tạo `ISystemMetricsRecorder` ở `Application`.<br>3. AI bỏ sót chặn `dev-mock-token:` trên Production trong `FirebaseAuthService.cs`. |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | OpenAI Codex / Antigravity IDE | 1. AI bắn k6 ngay lập tức 150 VUs không có ramp-up và dùng token giả `demo-load-test-jwt-token` gây HTTP 401/429 trên Staging.<br>2. AI chia giả doanh thu phương thức thanh toán theo tỷ lệ cứng `0.45/0.35/0.20` và gắn fallback số tiền `784.000.000đ` khi API lỗi ở `reports.page.ts`, đồng thời quên `[RequirePermission("REPORTS", ...)]`. |
| **Trần Trọng Tân** (`24TX810025`) | Google Antigravity IDE / OpenAI Codex | 1. AI viết URL `/api/v1/properties/.../rooms` sai với định tuyến thật `/api/rooms` và mock giả `ICurrentTenantService` thay vì test qua HTTP middleware với `JwtService` thật.<br>2. AI giữ ngày test cứng `2026-11-20` trong Bruno `.bru` làm test thất bại theo thời gian thực. |

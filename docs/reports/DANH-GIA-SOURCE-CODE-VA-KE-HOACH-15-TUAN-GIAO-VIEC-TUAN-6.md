# BÁO CÁO ĐÁNH GIÁ TOÀN BỘ SOURCE CODE, CHUẨN HÓA TIẾN ĐỘ 15 TUẦN & PHÂN CÔNG TUẦN 06
### Dự án: Hotel SaaS Platform v2 (`hotel-saas-rbac` — Đề tài `578` HCMUTE)
- **Nhánh kiểm toán:** `develop` (đối soát trực tiếp toàn bộ `backend/`, `frontend/`, `deploy/`, `docker/`, `scripts/`, `docs/`)
- **Phương pháp thực hiện:** Swarm đa agent đọc-kiểm chứng chéo (`backend-auditor`, `frontend-auditor`, `infra-docs-auditor`, `verifier`, `monitor`)
- **Trạng thái Working Tree tại thời điểm đánh giá:** 33 tệp có thay đổi chưa commit (24 modified, 9 untracked — giữ nguyên 100%, không can thiệp)

---

## PHẦN I. ĐÁNH GIÁ TOÀN DIỆN SOURCE CODE HIỆN TẠI

### 1. Thống kê Quy mô & Kết quả Build / Test Thực tế

| Tầng Kiến trúc | Quy mô Code Đã Đếm Thực tế | Kết quả Build & Kiểm thử Trực tiếp |
|---|---|---|
| **Backend (.NET 10)** | **32** Entities, **25** Enums, **93** CQRS Handlers (**49** Commands / **44** Queries), **28** `AbstractValidator`, **20** Controller files (**19** API Controllers), **17** Infra Services, **1** `NotificationHub`, **2** EF Interceptors | • `dotnet build backend/HotelSaas.slnx`: **0 Error, 0 Warning**.<br>• `dotnet test` (khi PostgreSQL test `127.0.0.1:5435` đang tắt ở local): **362 Passed / 238 Failed / 600 Total** (`0` skipped). Toàn bộ **238/238** ca fail đều do `NpgsqlException`/`SocketException` chưa bật PostgreSQL `5435` (tất cả **303/303** unit test non-DB gồm Domain `1/1`, Application non-DB `280/280`, WebApi non-DB `22/22` đều **PASS 100%**). |
| **Frontend (Angular 22)** | **70** Components (**70/70** `standalone: true`, **42/70** `OnPush`), **53/70** dùng `signal()`, **41/70** dùng `computed()`, **29** Services trong `core/services/`, **0** vi phạm gọi `HttpClient` trực tiếp trong component, **21** feature modules, **121** `any` ở prod code | • `npm --prefix frontend run build`: **PASSED** (0 errors).<br>• Vitest unit tests (`npx ng test --watch=false`): **51/51 files, 628/628 tests PASSED** (0 failed).<br>• Playwright E2E: **0 spec files** (`playwright.config.*` & `@playwright/test` chưa được cài). |
| **DevOps, Hạ tầng & Tài liệu** | CI `.github/workflows/ci.yml` (4 jobs), CD `.github/workflows/cd-vps.yml` (3 jobs), PLG stack `docker/docker-compose.observability.yml`, `deploy/Caddyfile`, `scripts/load-tests/` (2 k6 scripts), `tests/bruno/hotel-saas/` (7 `.bru`), **25** `### US-` headings trong `docs/srs/03-user-stories.md` | • **CI/CD VPS Staging:** hoạt động thật qua GHCR.<br>• **k6 Load Tests:** **chưa từng chạy** (`docs/reports/load-tests/` chưa tồn tại).<br>• **Cross-Branch HTTP E2E:** `CrossBranchSecurityE2ETests.cs` **chưa tồn tại**. |

---

### 2. Các Điểm Đã Hoàn Thiện Tốt (Tuần 1 – Tuần 5)
1. **Kiến trúc Multi-Tenancy & Cô lập chi nhánh:** `ITenantScopedEntity`, `IPropertyScopedEntity`, `TenantPropertySaveChangesInterceptor`, `TenantPropertyContextMiddleware` và `PermissionAuthorizationHandler` (Bitmask 18 `PermissionFunction`) đã hoàn chỉnh ở tầng DB & Middleware.
2. **Đặt phòng & Chống trùng lịch (Anti-Overlap Concurrency):** `CreateReservationCommandHandler` sử dụng idempotency key + `pg_advisory_xact_lock` + `FOR UPDATE` + bắt lỗi PostgreSQL `23P01`; Public Hold 15 phút + tác vụ nền `ExpiredHoldSweepBackgroundService` (15 giây) hoạt động đầy đủ.
3. **Thanh toán VNPay, VietQR & Thu ngân D23:** `VnpayPaymentService` (HMAC-SHA512 + `FixedTimeEquals`), `ProcessVnpayIpnCommand` (row lock + idempotency `02`), `VietQrService`, và quy trình Duyệt/Chi hoàn tiền D23 (`ConfirmRefundPayoutCommandHandler` khóa `pg_advisory_xact_lock`) đã hoàn chỉnh kèm unit test đồng thời `Task.WhenAll`.
4. **Hóa đơn PDF QR & Realtime SignalR:** `ReportExportService` (`QuestPDF` + `ClosedXML` + `QRCoder`), `NotificationHub` (`/hubs/notifications`) + `NotificationDispatcher` + `<app-notification-bell>` cô lập theo chi nhánh hoạt động đồng bộ.
5. **Xác thực Dual-Verification & Giao diện B2C:** Firebase Phone OTP (`firebase-auth.service.ts`), Google OAuth (`GoogleAuthService`), Form đăng ký 2 Tab (`register.page.ts`), PrimeNG DatePicker UTC+7 (`BusinessDatePipe`).

---

### 3. Các Lỗ Hổng Bảo Mật (P0/P1) & Nợ Kỹ Thuật Phát Hiện Khi Audit (Cần Xử Lý Tuần 6 – Tuần 10)

#### 🔴 Nhóm A — Bảo mật Nghiêm Trọng (Cần vá ngay Tuần 6–7)
1. **`FirebaseAuthService.cs:121-130` & `firebase-auth.service.ts:148-174` (Cần vá NGAY Tuần 6):** Tiền tố `dev-mock-token:` đang được backend chấp nhận vô điều kiện kể cả bản Release/Production (khác với `GoogleAuthService.cs:41-52` đã chặn `#if DEBUG`), và frontend tự bật `isMockMode = true` khi Firebase lỗi mà không kiểm tra `!environment.production`.
2. **`PublicController.cs:216` & `CreateGuestHoldCommand.cs:99-116,454-480` (P0 Tuần 7):** Endpoint `[AllowAnonymous] CreateHold` tin tưởng `request.GuestUserId` từ body JSON khi user chưa đăng nhập -> nguy cơ giả mạo user khác, lách OTP và trừ điểm Loyalty của người khác.
3. **`ReportsController.cs` (Cần vá NGAY Tuần 6):** Toàn bộ 8 endpoint của `ReportsController` mới có `[Authorize]` ở cấp class, **thiếu `[RequirePermission("REPORTS", PermissionAction.Read)]`**; `GetGroupAnalyticsQueryHandler.cs:81-99` dùng `.IgnoreQueryFilters()` nhưng chưa xác minh `IsTenantWide`.
4. **`SubscriptionsController.cs:176-230` & `AuditLogsController.cs:22,106` (P0 Tuần 7):** Chưa gắn `[RequirePermission]` cho API nâng cấp gói cước và ghi Audit event; gói nâng cấp chưa gắn thanh toán thực.
5. **`PrintDocumentsController.cs:43,159,218-276` (P0 Tuần 7):** `GetPrintableInvoice`/`GetPrintableVoucher` để `[AllowAnonymous]` lộ PII không che khi tra bằng `confirmationCode` (vượt rào `LookupToken`), còn `GetPrintableContract` dùng `.IgnoreQueryFilters()` thiếu kiểm tra `TenantId`/`SuperAdmin`.
6. **Hardening khác (Tuần 7):** `Program.cs` chưa bật `AddRateLimiter`/`UseHsts`, CORS còn cứng `http://localhost:4200`; `SeedData.cs:203` seed cố định `HotelDev@2026!` không giới hạn môi trường; `login.page.ts` hiển thị nút Demo kèm mật khẩu ở mọi môi trường; Terraform `infra/terraform/main.tf` mở port `3001` cho `0.0.0.0/0`; `.gitleaks.toml` bỏ qua `docs/`, `backend/tests/`, `scripts/`.

#### 🟠 Nhóm B — Observability, Hạ tầng Caddy & Dữ liệu Giả (Xử lý ngay Tuần 6)
1. **Nhầm đường dẫn cụm Monitoring:** `deploy/monitoring/` không tồn tại; cụm PLG thật đã nằm ở `docker/docker-compose.observability.yml` + `docker/observability/`, nhưng thiếu Dashboard JSON, dùng sai network (`hotelsaas-net` thay vì `hotelsaas-staging-network`), và có 2 file `docker-compose.staging.yml` trùng nhau (root vs `deploy/`).
2. **`deploy/Caddyfile` sai route SignalR & hở `/metrics`:** Dòng 19-21 cấu hình `@signalr { path /hub/* }` trong khi `Program.cs` map `/hubs/notifications`; `/metrics` và `/swagger*` đang công khai trên Internet; chưa có route `/grafana/*`.
3. **Metric Prometheus chưa nối vào luồng chạy thật:** `SystemMetricsRegistry.RecordVnpayIpnResult` và `Increment/DecrementSignalRConnection` trong `CorrelationAndStructuredLogMiddleware.cs` có **0 nơi gọi**; `Application`/`Infrastructure` không thể gọi trực tiếp `WebApi` nên cần tạo interface `ISystemMetricsRecorder` ở `Application`.
4. **Dữ liệu giả trong Báo cáo (Cần sửa Tuần 6):** `ReportsController.cs:153-162` & `GetGroupAnalyticsQueryHandler.cs:336-345` tự bịa tỷ lệ `0.45m/0.35m/0.20m` khi chưa có Payment, đồng thời kéo dữ liệu về RAM bằng `.ToListAsync()`; `reports.page.ts:663-791` tự ghi đè doanh thu giả `784.000.000đ` khi API lỗi; `ops-readiness.page.ts` tính số liệu giả lập phía client.

#### 🟡 Nhóm C — Khoảng Trống Nghiệp vụ & Tiêu chuẩn Kỹ thuật (Cho Lộ trình Tuần 7–15)
1. **AI Concierge / Search chưa gọi Gemini API thật:** `AiController.cs` dùng regex/keyword rule và vẫn ghi `ModelUsed = "gemini-2.5-flash"` vào `AiUsageLogs`; `frontend/package.json` chưa có `@google/genai`, còn `proxy.conf.js` chặn nhầm `/api/ai/smart-search` & `/api/ai/concierge` khi chạy `ng serve`.
2. **Xung đột vai trò Housekeeping (`RoomsController.cs:202` vs `SeedData.cs:170-172`):** Seeded role `HOUSEKEEPER` có quyền `HOUSEKEEPING:ReadUpdate` nhưng API đổi trạng thái phòng lại đòi `ROOMS:Update`; thực thể `HousekeepingTask` tồn tại trong Domain nhưng chưa có `DbSet`/CQRS.
3. **Các phân hệ SRS chưa có đủ UI/API hoàn chỉnh:** `InvoicesController`, `TenantsController`, `RolesController`, `ForgotPassword/ResetPassword`, `Staff Invite Email`, `Promotions/Voucher` CRUD + áp mã giảm giá, `POL-IO01/02` phụ phí Check-in sớm/muộn, `POL-SUB01/02` giới hạn quota gói SaaS, **Night Audit** (`0` file), **IoT SmartLock** (mới mô phỏng PIN ở `Reservation`), **Playwright E2E** (`0` specs), `guest-profile.page.ts` thiếu input cập nhật Email cho user đăng ký bằng SĐT, `28/70` Angular component thiếu `OnPush`, `121` kiểu `any`, `docs/README.md:5` ghi sai tên GVHD (`ThS. Phùng Hữu Xuân`).

---

## PHẦN II. LỘ TRÌNH CHUẨN HÓA 15 TUẦN (TUẦN 1 $\rightarrow$ TUẦN 15)

| Giai đoạn | Tuần | Trọng tâm Chính | Chi tiết Phân bổ trong Tài liệu |
|---|---|---|---|
| **Giai đoạn 1: Nền tảng & Lõi PMS/OTA** | **Tuần 1 – 5** | Clean Arch, Multi-Tenant, RBAC, Catalog, Pricing, Reservations, Folio/VNPay/VietQR, Hold 15', SignalR, D23, Dual-Verification Auth, CI/CD VPS | **ĐÃ HOÀN THÀNH (100%)** |
| **Giai đoạn 2: Nghiệm thu GVHD, Vá Bảo mật & Nghiệp vụ Mở rộng** | **Tuần 6** *(P7B — Đã hoàn tất)* | **Đóng yêu cầu GVHD + Vá lỗi Audit nóng:**<br>• **An:** PLG Observability (`docker/`) live trên VPS `103.116.38.74` + Grafana Dashboard (bộ lọc point-and-click + Error Log panel) + Caddy (`/hubs/*`, `/grafana*`) + `ISystemMetricsRecorder` + `ObservabilityMetricsAndLoggingTests` + khóa `dev-mock-token` (BE + FE `isMockMode` guard) + Shared-VPS (`DOTNET_gcServer=0`, `mem_limit`, `json-file`, `deploy.sh --rollback`).<br>• **Nguyên:** k6 Load Test (`scripts/load-tests/` — đã chạy `smoke` benchmark, `load/stress` qua `k6 inspect`, báo cáo `docs/reports/load-tests/`) + `ReportsController` `[RequirePermission("REPORTS", 1)]`, `IsTenantWide` guard, xóa tỷ lệ chia giả `0.45/0.35/0.20` + xóa fallback `784000000`/`493000000` ở `reports.page.ts`.<br>• **Tân:** `CrossBranchSecurityE2ETests.cs` (7 HTTP E2E tests với `JwtService` thật) + Bruno `Staging.bru` & `script:pre-request` động + sửa shift-boundary `RefundApprovalManagementTests`. | **ĐÃ XONG (100%)** — Xem [ROADMAP-CHI-TIET-3-THANH-VIEN.md](file:///c:/Projects/hotel-sass-rbac/docs/team/ROADMAP-CHI-TIET-3-THANH-VIEN.md) và các báo cáo `BAO-CAO-TUAN-6-*.md` |
| | **Tuần 7** | **Burn-down Bảo mật P0 & Kiến trúc:** Chặn IDOR `PublicController`, Tenant guard `PrintDocuments`, RBAC `Subscriptions/AuditLogs`, `RateLimiter`/CORS/HTTPS, SHA-256 refresh tokens, DB Indexes, Validators, quyền `HOUSEKEEPER` | Phân công rõ cho cả 3 thành viên |
| | **Tuần 8** | **SRS Core Gaps I:** `TenantsController` & `RolesController`, Forgot/Reset Password, Mời nhân viên (`An`); `InvoicesController` & Phụ phí Check-in sớm/muộn (`Nguyên`); `HousekeepingTask` Entity + Auto-create on Check-out + Kanban (`Tân`) | Đóng đầy đủ các controller còn thiếu so với SDD-06 |
| | **Tuần 9** | **SRS Core Gaps II & CRM:** Giới hạn Quota SaaS `POL-SUB01/02` + `SupportAccessGrant` (`An`); Tìm kiếm OTA DB-side & `Promotions` CRUD (`Nguyên`); Áp Promo/Loyalty ở Checkout + API thật cho `guest-profile.page.ts` & sửa luồng đổi Email (`Tân`) | Đồng bộ 100% thiết kế Marketplace & Loyalty |
| | **Tuần 10** | **Night Audit, Gemini AI thật & Chart.js:** Gemini Function Calling + `AiUsageLog` + sửa `proxy.conf.js` (`An`); AI Pricing 1 chạm + `chart.js` Dashboard/Reports (`Nguyên`); Worker Kiểm toán Đêm `02:00` + Đóng/Mở ca thu ngân + SignalR Housekeeping (`Tân`) | Thay thế hoàn toàn stub AI & CSS bar đơn giản |
| **Giai đoạn 3: E2E Tự động, UX/Security & Bảo vệ** | **Tuần 11** | Playwright E2E (10 luồng lõi), xử lý `28` component chưa `OnPush` & `121` kiểu `any`, chuẩn hóa VI/EN i18n, gắn `authGuard` & lọc menu Admin theo quyền | Đảm bảo chất lượng code Angular 22 đồng nhất |
| | **Tuần 12** | Cổng CI Playwright + `npm audit` + `dotnet list --vulnerable`, +10 E2E specs, `axe-core` WCAG 2.1 AA, tinh chỉnh Mobile `375px`, Admin quản lý SmartLock PIN | Kiểm soát tự động trên mỗi Pull Request |
| | **Tuần 13** | Quét OWASP ZAP, SonarQube 0 Critical, diễn tập Backup/Restore DB; k6 Nghiệm thu 50–100 VUs; Stress Test 100+ kết nối SignalR & D23 đồng thời | Thu thập số liệu NFR chuẩn xác |
| | **Tuần 14** | UAT + Khảo sát SUS ($\ge 10$ người dùng, mục tiêu $\ge 80$), đồng bộ `docs/sdd/` & `docs/README.md`, chuẩn hóa Demo Seed Data 1 chạm | Khép kín tài liệu & minh chứng người dùng |
| | **Tuần 15** | Code Freeze nhánh `main`, đóng gói hồ sơ bằng chứng 15 tuần & AI Disclosure, diễn tập Demo live toàn trình & Bảo vệ trước Hội đồng | Sẵn sàng nghiệm thu 100% |

---

## PHẦN III. BẢNG PHÂN CÔNG CHI TIẾT TUẦN 06 (KHÔNG TRÙNG FILE — ĐÚNG VAI TRÒ CANONICAL)

> **Điều chỉnh quan trọng đã thực hiện:** Khắc phục tình trạng **tráo vai giữa Nguyên và Tân** trong bản nháp Tuần 5 trước đây (`PROMPT-TUAN-6-THUC-THI-NHOM.md` cũ giao nhầm k6 cho Tân và Cross-Branch E2E cho Nguyên). Bảng mới trả lại đúng sở trường từ Tuần 1–5 và tách biệt `ALLOWED FILES` 100%.

| Thành viên | Nhánh Git | Nhiệm vụ Trọng tâm Tuần 06 | Phạm vi File được phép sửa (`ALLOWED FILES`) |
|---|---|---|---|
| **Ngô Võ Tuấn An** (`24TX810001`) | `feature/an-week6-observability-auth` | 1. Gắn `docker/docker-compose.observability.yml` vào `hotelsaas-staging-network`, thêm Grafana Dashboards, thống nhất Staging compose.<br>2. Sửa `deploy/Caddyfile` (`/hubs/*`, `/grafana/*`, khóa `/metrics` & `/swagger*`).<br>3. Tạo `ISystemMetricsRecorder` nối SignalR & VNPay `RspCode 97`.<br>4. Khóa `dev-mock-token` chỉ cho `DEBUG`/`Development` trong `FirebaseAuthService.cs` & FE.<br>5. Nghiệm thu B2C OTP/OAuth & 5 tài khoản PMS trên Staging. | `docker/docker-compose.observability.yml`, `docker/observability/**`, `deploy/**`, `docker-compose.staging.yml`, `.github/workflows/cd-vps.yml`, `backend/src/HotelSaas.Application/Common/Interfaces/ISystemMetricsRecorder.cs`, `backend/src/HotelSaas.Application/Payments/Commands/ProcessVnpayIpn/ProcessVnpayIpnCommand.cs`, `backend/src/HotelSaas.Infrastructure/Hubs/NotificationHub.cs`, `backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs`, `backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`, `backend/src/HotelSaas.WebApi/Program.cs`, `frontend/src/app/core/services/firebase-auth.service.ts`, `docs/reports/BAO-CAO-TUAN-6-NGO-VO-TUAN-AN-24TX810001.md` |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | `feature/nguyen-week6-k6-reports-audit` | 1. Tham số hóa & chạy k6 (`smoke/load/stress`) lên Staging (`scripts/load-tests/`), xuất JSON & bảng báo cáo tại `docs/reports/load-tests/`.<br>2. Sửa `ReportsController.cs` & `GetGroupAnalyticsQueryHandler.cs`: gắn `[RequirePermission("REPORTS", Read)]`, check `IsTenantWide`, bỏ tỷ lệ chia giả `0.45/0.35/0.20`.<br>3. Bỏ fallback số giả ở `reports.page.ts`.<br>4. Nghiệm thu PDF QR (`QRCoder`), VietQR & đối soát DB. | `scripts/load-tests/**`, `docs/reports/load-tests/**`, `backend/src/HotelSaas.Application/Reports/**`, `backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`, `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`, `frontend/src/app/features/reports/**`, `docs/reports/BAO-CAO-TUAN-6-NGUYEN-KHOI-NGUYEN-24TX810011.md` |
| **Trần Trọng Tân** (`24TX810025`) | `feature/tan-week6-security-e2e-d23` | 1. Tạo `backend/tests/HotelSaas.WebApi.Tests/Security/CrossBranchSecurityE2ETests.cs` dùng `WebApplicationFactory<Program>` + `JwtService` thật chứng minh `403` trên `/api/rooms`, `/api/reservations/{id}/check-in`, `/api/payments`, `/api/reports/revenue-summary` và giả mạo `X-Property-Id`.<br>2. Làm mới `tests/bruno/hotel-saas/` (thêm `Staging.bru`, bỏ ngày cũ `2026-11-20`).<br>3. Nghiệm thu thực tế D23 `pg_advisory_xact_lock`, `ExpiredHoldSweepBackgroundService` & SignalR `<app-notification-bell>`. | `backend/tests/HotelSaas.WebApi.Tests/Security/**`, `tests/bruno/**`, `frontend/src/app/features/payments/components/refund-approval/**`, `frontend/src/app/shared/components/notification-bell/**`, `docs/reports/BAO-CAO-TUAN-6-TRAN-TRONG-TAN-24TX810025.md` |

---

## PHẦN IV. CÁC TÀI LIỆU ĐÃ CẬP NHẬT SẴN ĐỂ NHÓM SỬ DỤNG NGAY

1. **Lộ trình Tổng thể 15 Tuần:** [docs/team/ROADMAP-CHI-TIET-3-THANH-VIEN.md](file:///c:/Projects/hotel-sass-rbac/docs/team/ROADMAP-CHI-TIET-3-THANH-VIEN.md)
2. **Bộ Prompt Thực Thi Tuần 06 (copy-paste chạy thẳng cho từng thành viên):** [docs/team/PROMPT-TUAN-6-THUC-THI-NHOM.md](file:///c:/Projects/hotel-sass-rbac/docs/team/PROMPT-TUAN-6-THUC-THI-NHOM.md)

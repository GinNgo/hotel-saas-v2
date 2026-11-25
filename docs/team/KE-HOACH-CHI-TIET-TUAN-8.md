# KẾ HOẠCH CHI TIẾT TUẦN 08 - HOTEL SAAS PLATFORM V2
## Kiểm Chứng Staging Wave 11–12, Khóa Brute-Force, Gemini AI Tìm & Gợi Ý Phòng Thật, B2B Invoices, k6 Staging & Playwright E2E

- **Đề tài:** `578` - Nền tảng Quản lý Khách sạn Đa chi nhánh theo mô hình SaaS (**Hotel SaaS Platform v2**)
- **Đơn vị:** Khoa Công nghệ Thông tin - Bộ môn Công nghệ Phần mềm - Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE)
- **Giảng viên hướng dẫn:** `ThS. Huỳnh Xuân Phụng` (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** `https://github.com/GinNgo/hotel-saas-v2`
- **Môi trường Staging VPS:** `https://luxustay.duckdns.org/`
- **Baseline Git hiện tại:** `develop @ 369537f` (đã đồng bộ 100% với `origin/develop`, gồm `30` WebApi Controllers, `34` Domain Entities và `15` EF Migrations) | `origin/main @ 0ef301d` (**PR #30 ĐÃ MERGE**, khớp mã nguồn `369537f`).
  - **Trạng thái Bước 0 trước khi rẽ nhánh Tuần 08:** Nhánh `origin/develop @ 369537f` đã hoàn tất trọn vẹn **Wave 11** (`d1fefe1`/`aadf7aa`) và **Wave 12** (`d561630`/`2a2ceae`/`9837b7e`/`369537f`), đồng thời **PR #30 đã được merge vào `origin/main @ 0ef301d`**. Phần Bước 0 còn lại (nhóm trưởng An thực hiện trước khi cả nhóm rẽ nhánh và trước khi Nguyên chạy k6 lên Staging) chỉ gồm:
    1. Rà soát `/opt/hotel-saas/.env` trên VPS Staging: xác nhận `JWT_SECRET_KEY` đã xoay khỏi giá trị placeholder, đã cấu hình đầy đủ `SEPAY_*`, và tùy chọn bổ sung `GF_SECURITY_ADMIN_PASSWORD` (bật observability stack) cùng `GEMINI_API_KEY` (bật Gemini AI thật, tuyệt đối không commit vào Git).
    2. Xác nhận endpoint `https://luxustay.duckdns.org/health/ready` trả về HTTP `200`.
    3. Chạy và lưu biên bản kết quả baseline full test suite (`dotnet test` + `npm --prefix frontend test -- --watch=false`) tại mốc `369537f`.
  - **Lưu ý nhánh phụ cũ:** Nhánh `origin/feature/tan-week6-security-e2e-d23` (`807a3ae..71daa2f`) vẫn ở trạng thái chưa merge vào `develop`. Nhánh Tuần 08 của Tân phải cắt trực tiếp từ `origin/develop @ 369537f`.

### Danh Sách Thành Viên Nhóm

| STT | Họ và Tên | MSSV | GitHub | Vai Trò Chuẩn Tuần 08 | Nhánh Làm Việc Tuần 08 |
|:---:|---|---|---|---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `GinNgo` | Nhóm trưởng, Security Hardening, Gemini AI Tìm & Gợi Ý Phòng Thật & CI/CD | `feature/an-week8-gemini-lockout-ci` |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `khoinguyen1310` | Tài chính, B2B Invoices, Tối ưu Báo cáo SQL & k6 Staging Load/Stress | `feature/nguyen-week8-invoices-reports-k6` |
| 3 | **Trần Trọng Tân** | `24TX810025` | `trantrongtan096` | Vận hành, Playwright E2E, Housekeeping SignalR, RBAC Matrix & Guest CRM | `feature/tan-week8-playwright-housekeeping-crm` |

---

## 1. Đối Soát Các Hạng Mục ĐÃ HOÀN THÀNH Tại `develop @ 369537f` & `origin/main @ 0ef301d` (Không Làm Lặp Lại)

Qua kiểm tra trực tiếp mã nguồn trên `develop @ 369537f` và `origin/main @ 0ef301d`, toàn bộ các đợt cập nhật Tuần 07, PR #29, **Wave 11**, **Wave 12** và **PR #30** đều đã hoàn tất. **Cả nhóm KHÔNG làm lặp lại các hạng mục đã xong sau:**

| Hạng Mục Đã Xong | Bằng Chứng Mã Nguồn Thực Tế Tại `369537f` / `0ef301d` | Phần Còn Lại Chuyển Vào Tuần 08 / Tuần 09 |
| :--- | :--- | :--- |
| **PR #30 merge `develop` -> `main` (`0ef301d`)** | `origin/main @ 0ef301d` đã chứa trọn bộ commit Tuần 07 + Wave 11 + Wave 12 khớp `origin/develop @ 369537f`. | Bước 0 chỉ còn xác minh `/opt/hotel-saas/.env` VPS Staging, `/health/ready == 200` và ghi biên bản baseline full test suite tại `369537f` (An). |
| **Wave 11: Structured JSON Logging, Platform Audit & Grafana Ops (`d1fefe1` / `aadf7aa`)** | `RenderedJsonFormatter` trong `appsettings.json`, migration `20261123000000_AllowPlatformScopeAuditLogs`, `Wave11AuditCompletenessTests` & `ObservabilityMetricsAndLoggingTests`, Vietnamese Grafana Ops Dashboard (`hotelsaas-ops-logs-vn.json`), tự động deploy VPS observability trong `cd-vps.yml`, sửa CI PR `gitleaks`, hoàn thiện UI `ops-readiness` & `audit-logs`. | Gắn `[RequirePermission("AUDIT_LOGS", PermissionAction.Read)]` lên 2 action `GET` của `AuditLogsController.cs` (An). |
| **Wave 12: Per-Property SePay API Key, Dual HMAC-SHA256/Apikey Webhook & VietQR-Only B2C (`d561630` / `2a2ceae` / `9837b7e` / `369537f`)** | Migration `20261123120000_AddPerPropertySepayApiKey`, xác thực kép webhook `HMAC-SHA256` (`X-SePay-Signature`) + `Apikey` (global & per-property) trong `WebhooksController.cs` + `SepayWebhookTests.cs`, chuẩn hóa B2C checkout **chỉ dùng VietQR** (`booking-hold.page.ts`, `booking-status.page.ts`), Cashier SignalR tự làm mới live (`payments.page.ts`), sửa `copySepayWebhookUrl` đồng bộ (hết race Vitest). | Nghiệm thu thực tế luồng VietQR-only + SePay HMAC-SHA256/Apikey + PDF QR trên DB Staging (Nguyên) và bao phủ E2E Flow #4 (Tân). |
| **Google GIS & Rate Limiting (`AddRateLimiter` / `UseRateLimiter`)** | Nút Google GIS ở `social-auth.service.ts` & `login.page.ts` (đã xóa mã Facebook auth cũ); `Program.cs` đã bật `UseRateLimiter()` trên `AiController`, `PaymentsController`, `PublicController`, `SubscriptionsController`, `WebhooksController`. | Bổ sung khóa brute-force login theo tài khoản `BR-SEC03` trên `User` và giới hạn độ dài prompt/lịch sử AI (An). |
| **Đóng bypass `ConfirmationCode` 6 ký tự khi in hóa đơn** | `GetPrintableInvoiceQueryHandler.cs` (dòng 109-129) chỉ mở full PII cho phiên đăng nhập hợp lệ hoặc `LookupToken` đầy đủ còn hạn chưa thu hồi; có `GetPrintableInvoiceTests.cs`. | Tách thông tin pháp lý đang hardcode trong `GetPrintableContractQueryHandler.cs` sang `PlatformLegalOptions` (An). |
| **Khóa `NotificationHub`, `SeedData` Production & `dev-mock-token` Release** | `NotificationHub.cs` + `NotificationHubSecurityTests.cs`, `SeedData.cs` (`allowDevPlatformBootstrap`), `FirebaseAuthService.cs` (`a035261`), `Wave10SecurityHardeningTests.cs`. | Gắn `canActivate: [authGuard]` cho route `/booking/profile` trong `app.routes.ts` (An). |
| **Chế độ chặn `gitleaks` trong CI & Allowlist Firebase Web Config** | `.github/workflows/ci.yml` đã bỏ `continue-on-error` cho `gitleaks` và kiểm tra `needs.security.result`; `.gitleaks.toml` allowlist `environment*.ts` & `hotelsaas_dismissed_banners_v1`. | Bổ sung quét lỗ hổng dependency CVE (`dotnet list --vulnerable`, `npm audit`) và thu hẹp allowlist rộng trong `.gitleaks.toml` (An). |
| **Siết guard `GetGroupAnalyticsQueryHandler` & phân tầng k6 (PR #29)** | Đã gỡ secret VNPay mặc định & `dev-mock-token` khỏi kịch bản k6, phân tầng `smoke/load/stress` và siết thiếu context trong `GetGroupAnalyticsQueryHandler.cs`. | Bổ sung `public-search.k6.js`, tối ưu SQL `GetRevenueSummaryQueryHandler.cs` và chạy thực tế k6 `load`/`stress` lên Staging (Nguyên). |

---

## 2. Các Khoảng Trống Thực Tế Còn Tồn Đọng Tại `develop @ 369537f`

| Mã Gap | Mức Độ | Mô Tả Khoảng Trống Đã Xác Minh Trên Code (`develop @ 369537f`) | Người Phụ Trách |
|---|:---:|---|---|
| **GAP-01** | P0 | PR #30 đã merge vào `origin/main @ 0ef301d`, nhưng chưa hoàn tất checklist Bước 0 trên VPS Staging: xác minh `/opt/hotel-saas/.env` (`JWT_SECRET_KEY` đã xoay khỏi placeholder + `SEPAY_*` + tùy chọn `GF_SECURITY_ADMIN_PASSWORD` & `GEMINI_API_KEY`), kiểm tra `https://luxustay.duckdns.org/health/ready` trả `200`, và lưu biên bản chạy baseline full test suite tại `369537f`. | **Ngô Võ Tuấn An** |
| **GAP-02** | P0 | `User.cs` và `LoginCommandHandler.cs` chưa có trường `FailedLoginCount` / `LockoutEndUtc` để khóa brute-force (`BR-SEC03`); `GetPrintableContractQueryHandler.cs` (dòng 94-98) còn hardcode thông tin pháp lý; `AuditLogsController.cs` (dòng 49, 91) thiếu `[RequirePermission("AUDIT_LOGS", PermissionAction.Read)]` trên 2 action `GET`; `frontend/src/app/app.routes.ts` (dòng 152) thiếu `canActivate: [authGuard]` cho route `booking/profile`. | **Ngô Võ Tuấn An** |
| **GAP-03** | P0 | `.github/workflows/ci.yml` chưa có bước kiểm tra lỗ hổng thư viện (`dotnet list package --vulnerable` và `npm audit`); `.gitleaks.toml` (dòng 7-9) vẫn allowlist toàn bộ thư mục `docs/`, `backend/tests/`, `scripts/`. | **Ngô Võ Tuấn An** |
| **GAP-04** | P0 | Hệ thống AI tìm & gợi ý phòng chưa chạy Gemini thật và còn nhiều lỗ hổng grounding: chưa có `IGeminiAiClient` *(tạo mới)* / `GeminiAiClient` *(tạo mới)* / `GeminiOptions` *(tạo mới)* và env passthrough `Gemini__ApiKey`/`Gemini__Model` trong compose files; `ProcessAiConcierge` ghi giả `ModelUsed = "gemini-2.5-flash"`, chỉ nhận 6 thành phố, bỏ qua `IsPublished`/`Tenant.Status == Active`, không kiểm tra tồn phòng thực tế qua `Rooms`/`Reservations` hay `RoomTypeRates`/`IPricingCalculator`; `ProcessAiChat` bỏ qua lịch sử hội thoại và không trả room cards; `ProcessAiSmartSearch` bỏ sót `ProvinceCode`, `Guests`, `MaxPrice`, ngày, `OnlyPublished` nhưng vẫn khẳng định phòng còn trống; `ai-concierge-chat.component.ts` chưa có thẻ gợi ý phòng bấm được, còn hardcode `'Quán ăn ngon gần Grand Hotel Q1?'`, thiếu unit test; `AiService.smartSearch()` chưa gắn vào `explore-search.page.ts`; `frontend/proxy.conf.js` (dòng 29-33) còn trỏ `/api/ai` về cổng `3099`; `frontend/server/prod-server.js` chặn `/api/ai/chat` về `ai-chat-handler.js` (gọi model giả `'gemini-3.8-flash'`); còn trùng `ai.service.ts` và `ai-concierge.service.ts`; `docs/README.md` còn ghi sai tên GVHD và dữ liệu `63 Tỉnh`. | **Ngô Võ Tuấn An** |
| **GAP-05** | P1 | Chưa có `InvoicesController.cs` *(tạo mới)*, `Application/Invoices/**` *(tạo mới)* và giao diện sổ cái hóa đơn `InvoiceLedgerComponent` *(tạo mới)* trong `features/reports/`; `GetRevenueSummaryQueryHandler.cs` (dòng 72, 98) vẫn dùng `.ToListAsync()` tải dữ liệu thô về RAM thay vì SQL `GroupBy`/`Sum`; thiếu endpoint `GET /api/reports/ai-summary`. | **Nguyễn Khôi Nguyên** |
| **GAP-06** | P1 | Chưa có `scripts/load-tests/public-search.k6.js` *(tạo mới)* và chưa thực thi thực tế `TEST_TIER=load` (50 VUs) + `TEST_TIER=stress` (100 VUs) nhắm vào Staging VPS `https://luxustay.duckdns.org/` (đồng thời chưa có minh chứng đối soát thực tế PDF QR và luồng **VietQR-only B2C + SePay HMAC-SHA256/Apikey webhook** với DB Staging). | **Nguyễn Khôi Nguyên** |
| **GAP-07** | P1 | Chưa cài đặt Playwright E2E (`frontend/playwright.config.ts` *(tạo mới)*, `frontend/e2e/*.spec.ts` *(tạo mới)*); `housekeeping.page.ts` (dòng 987, 1370-1380) vẫn polling `setInterval` 10 giây và chưa đăng ký `NotificationService` (`ReceiveHousekeepingAlert`); chưa có `RbacPermissionMatrixE2ETests.cs` *(tạo mới)* phủ ma trận âm tính 19 `PermissionFunction`; Guest CRM (`GetGuestDirectoryQuery.cs`, `UpdateGuestNotesCommand.cs`) vẫn bỏ sót khách đặt phòng không có SĐT và gán cứng `IsBlacklisted = false`. | **Trần Trọng Tân** |

### 2.1. Đối Chiếu & Kế Thừa Từ Hệ Thống Legacy (`He-thong-quan-ly-khach-san` / LuxeStay) Cho GAP-04

Trước khi nâng cấp GAP-04, nhóm đã rà soát toàn bộ module AI/Gemini tìm & gợi ý phòng của hệ thống legacy LuxeStay (Spring Boot 3 + Angular 22 + SQL Server) để chọn lọc điểm mạnh và khắc phục triệt để các khiếm khuyết khi port sang **Hotel SaaS Platform v2** (`.NET 10 + Angular 22 + PostgreSQL 17`):

| Nhóm Đánh Giá | Chi Tiết Xác Minh Từ Hệ Thống Legacy (LuxeStay) | Quyết Định Áp Dụng Trong Hotel SaaS v2 (Tuần 08) |
| :--- | :--- | :--- |
| **Kế thừa & Nâng cấp (Keep & Upgrade)** | 1. **Backend-only Gemini REST proxy** gửi key qua HTTP header `x-goog-api-key` (không lộ key ra frontend, không đặt `?key=` trên URL).<br>2. **Thẻ gợi ý phòng/cơ sở bấm được** kèm ảnh có fallback, giá VND thật từ API, deep-link truyền đầy đủ `queryParams` (địa điểm, khách, ngân sách, ngày).<br>3. **UX & A11y tốt:** quick suggestion chips, safe XSS-escaped Markdown (`**bold**`, bullet/numbered list), nút Retry không nhân bản tin nhắn user, `role="dialog"`, `aria-live`, đóng bằng `Escape` & phục hồi focus, `prefers-reduced-motion`.<br>4. **Khả năng chịu lỗi (Fallback resilience):** tự chuyển sang chế độ dự phòng khi Gemini không sẵn sàng. | Giữ trọn các pattern UX/bảo mật này trong `.NET 10` (`GeminiAiClient`) và Angular 22 (`ai-concierge-chat` + `ai-smart-search-bar`), nâng cấp sâu hơn bằng **3-Stage DB Grounding**, nút **"Xem chi tiết"** (`/booking/properties/:slug`) & **"Giữ phòng ngay"** (`/booking/hold`), và đảm bảo thẻ gợi ý phòng **luôn hiển thị kể cả ở chế độ `"rule-fallback"`**. |
| **Lỗ hổng & Anti-pattern BẮT BUỘC Sửa Ở v2 (Must Fix)** | 1. **Zero Grounding & Regex frontend 18 địa danh:** Gemini không đọc DB và không biết thẻ nào đang hiển thị; frontend nối toàn bộ lịch sử khiến thành phố/ngân sách cũ ghi đè yêu cầu mới.<br>2. **Không bóc ngày & không kiểm tra tồn phòng thực tế:** không trích xuất `checkIn`/`checkOut`/tiện nghi/loại thuê; thẻ gợi ý không trừ `Reservations` đang giữ chỗ.<br>3. **Khóa sau login (`*ngIf="isLoggedIn()"`) & lệch CORS:** chặn khách vãng lai B2C, mất chuyển đổi đặt phòng; `@CrossOrigin("*")` xung đột `allowCredentials=true`.<br>4. **Thiếu Multi-Tenant & Property Isolation:** không có `TenantId`/`PropertyId` fail-closed.<br>5. **Thiếu Rate Limit, Prompt/History Cap & PII Scrubbing:** nguy cơ token-cost DoS, history forgery/prompt injection, rò rỉ SĐT/CCCD/email sang Gemini.<br>6. **Lỗi kỹ thuật/FE:** cờ `AtomicBoolean streamingUnavailable` tắt SSE vĩnh viễn sau 1 lỗi 404; thiếu HTTP timeout; config chết (`app.ai.gemini.*` không nối với `AiService`) & model giả (`gemini-3.5/3.6/3.8-flash`); `sendAiFallback()` làm mất sạch thẻ gợi ý; AI chat không tự cuộn xuống; `maxlength="2000"` lệch backend `@Size(max=500)`. | Khắc phục **100%** bằng Kiến trúc 3 Giai Đoạn bên dưới: Gemini Structured JSON (`responseSchema`, `thinkingBudget: 0`, `10s` `HttpClient` timeout, `IOptions<GeminiOptions>`, model GA `gemini-2.5-flash`), **latest-turn priority**, **PII scrubbing**, prompt cap `500` ký tự / `6` lượt lịch sử, lọc fail-closed `Active && IsPublished && Tenant.Status == Active` (B2C) và strict `TenantId` (staff), trừ tồn phòng thật `Rooms - Reservations` + `RoomTypeRates`/`IPricingCalculator`, giữ public `/api/ai/{chat,concierge,smart-search}` kèm rate-limit `"ai-chat"`, auto-scroll AI, và đồng bộ `maxlength="500"`. |

> **Quy tắc tránh xung đột EF Migration (Bắt buộc):** Trong Tuần 08, **chỉ duy nhất Ngô Võ Tuấn An** được phép sửa `User.cs`, `ApplicationDbContext.cs` và tạo EF Migration (`AddUserLockoutFields`). Các bảng DB mới như `GuestProfile` và `CashierShift` cùng hệ thống song ngữ VI/EN (i18n) và quản trị thiết bị SmartLock cấp phòng được cố định sang Tuần 09.

---

## 3. Phân Công Chi Tiết, Ranh Giới File & Tiêu Chí Nghiệm Thu Từng Thành Viên

### 3.1. Ngô Võ Tuấn An (`24TX810001` - Nhóm trưởng, Security Hardening, Gemini AI Tìm & Gợi Ý Phòng Thật & CI/CD)

- **Nhánh Git:** `feature/an-week8-gemini-lockout-ci` (rẽ từ `develop @ 369537f` sau khi hoàn thành checklist Bước 0)
- **Nhiệm vụ chi tiết:**
  1. **Bước 0 - Xác Minh VPS Staging Sau PR #30 (`origin/main @ 0ef301d`) & Ghi Biên Bản Baseline (`369537f`):**
     - Ghi nhận PR #30 (`develop` -> `main`) **đã merge** vào `origin/main @ 0ef301d` (gồm Wave 11 & Wave 12).
     - Kiểm tra `/opt/hotel-saas/.env` trên VPS Staging: xác nhận `JWT_SECRET_KEY` đã xoay khỏi placeholder, đã cấu hình `SEPAY_*`, và tùy chọn bổ sung `GF_SECURITY_ADMIN_PASSWORD` (bật observability stack) cùng `GEMINI_API_KEY` (tuyệt đối không commit plaintext secret vào Git).
     - Xác nhận `https://luxustay.duckdns.org/health/ready` trả về HTTP `200`.
     - Chạy và ghi lại biên bản kết quả thực tế của full `dotnet test` (cùng Docker PostgreSQL) và `npm --prefix frontend test -- --watch=false` tại mốc `369537f`.
  2. **Khóa Brute-Force Login (`BR-SEC03`) & Các Điểm Hở Bảo Mật Còn Lại:**
     - Bổ sung `FailedLoginCount` (`int`) và `LockoutEndUtc` (`DateTime?`) vào `backend/src/HotelSaas.Domain/Entities/User.cs` và `UserConfiguration.cs`; tạo 1 EF Migration duy nhất của Tuần 08 (`AddUserLockoutFields` *(tạo mới)* trong `Migrations/**`); cập nhật `LoginCommandHandler.cs` tăng số lần sai, khóa tạm 15 phút khi sai 5 lần liên tiếp và reset về `0` khi đăng nhập đúng.
     - Tạo `backend/src/HotelSaas.Application/Common/Options/PlatformLegalOptions.cs` *(tạo mới)*, cấu hình trong `Infrastructure/DependencyInjection.cs` và `appsettings.json` để thay thế thông tin pháp lý hardcode trong `GetPrintableContractQueryHandler.cs` (kèm unit test ở `backend/tests/HotelSaas.Application.Tests/Print/GetPrintableContractTests.cs` *(tạo mới)*).
     - Gắn `[RequirePermission("AUDIT_LOGS", PermissionAction.Read)]` lên `GetList` và `GetById` trong `AuditLogsController.cs`.
     - Gắn `canActivate: [authGuard]` cho route `booking/profile` trong `frontend/src/app/app.routes.ts` và bổ sung test trong `app.routes.spec.ts`.
  3. **Siết Cổng CI Dependency Scan & Thu Hẹp `.gitleaks.toml`:**
     - Cập nhật `.github/workflows/ci.yml`: bổ sung bước quét lỗ hổng gói thư viện (`dotnet list backend/HotelSaas.slnx package --vulnerable --include-transitive` và `npm --prefix frontend audit --audit-level=high`).
     - Thu hẹp `.gitleaks.toml`: bỏ allowlist nguyên thư mục `docs/`, `backend/tests/`, `scripts/`, chỉ allowlist đúng đường dẫn hoặc biểu thức mẫu test thật sự cần thiết mà vẫn qua được `gitleaks` trên toàn kho mã nguồn.
  4. **Port & Nâng Cấp Gemini AI Tìm Phòng & Gợi Ý Phòng Zero-Hallucination (Kiến Trúc 3 Giai Đoạn) + Dọn Proxy & `docs/README.md`:**
     - **Giai đoạn 1 — Gemini Structured JSON Intent Extraction (`.NET 10` Backend):**
       * Tạo `backend/src/HotelSaas.Application/Common/Options/GeminiOptions.cs` *(tạo mới)*, `backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs` *(tạo mới)* và `backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs` *(tạo mới)*; đăng ký `AddHttpClient<IGeminiAiClient, GeminiAiClient>()` với timeout `10s` và `IOptions<GeminiOptions>` trong `Infrastructure/DependencyInjection.cs` (**không sửa `Program.cs`**).
       * Gọi trực tiếp REST v1beta `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (mặc định `gemini-2.5-flash`) với HTTP header **`x-goog-api-key`** (không đưa key vào query string `?key=`).
       * Cấu hình `responseMimeType: "application/json"`, `responseSchema`, `thinkingConfig: { thinkingBudget: 0 }`, `temperature: 0.1`, nhúng ngày hiện tại theo múi giờ `Asia/Ho_Chi_Minh`.
       * Áp dụng **PII scrubbing** (ẩn SĐT, CCCD, email, số thẻ trước khi gửi sang Gemini), giới hạn prompt tối đa `500` ký tự & tối đa `6` lượt lịch sử hội thoại, áp quy tắc **ưu tiên lượt nhắn mới nhất (latest-turn priority)** để thành phố/ngân sách mới ghi đè lượt cũ, và prompt-injection guardrails trong `systemInstruction`.
       * Trích xuất đủ tiêu chí: `provinceCode`/`locationKeyword` (khớp đủ 34 tỉnh/thành qua `ILocationLookupService`), `checkInDate`, `checkOutDate`, `rentalType`, `guests`, `minPrice`, `maxPrice`, `propertyTypes`, `amenities`, `intent` (tự động fallback về rule-based `AiHelper` khi thiếu key/timeout/lỗi).
     - **Giai đoạn 2 — Authoritative PostgreSQL 17 Availability & Pricing Grounding:**
       * Siết cô lập Multi-Tenant & Public Fail-Closed: khách B2C ẩn danh **bắt buộc** lọc `Property.Status == Active && Property.IsPublished && Tenant.Status == Active`; nhân viên đã đăng nhập lọc chặt theo `TenantId` hiện hành (cấm fallback sang tenant khác khi rỗng).
       * Kiểm tra tồn phòng vật lý thực tế qua `Rooms` trừ các `Reservations` đang chặn lịch (`ReservationTimeHelper.IsBlockingReservation`) và tính giá thực tế qua `RoomTypeRates` / `IPricingCalculator` (tái sử dụng chuẩn logic availability & pricing).
       * Sửa triệt để lỗi wiring của `ProcessAiSmartSearchQueryHandler` (truyền đủ `ProvinceCode`, `Guests`, `MaxPrice`, `CheckInDate`, `CheckOutDate`, `OnlyPublished`, không filter chồng `TouristZoneSlug` + `LandmarkSlug`, loại `StartingPrice == null` khi có lọc giá) và `ProcessAiChatQueryHandler` (đọc lịch sử hội thoại thay vì bỏ qua khi `Message` có giá trị, áp lọc ngày/khách/published và ghi nhận `AiUsageLogs`).
       * Nối `IGeminiAiClient` (constructor optional `IGeminiAiClient? = null` để giữ tương thích test cũ `LocationsAndAiChatTests.cs`) vào `ProcessAiConciergeQueryHandler`, `ProcessAiChatQueryHandler`, `ProcessAiSmartSearchQueryHandler`; thêm unit tests trong `backend/tests/HotelSaas.Application.Tests/Ai/**` *(tạo mới)*.
     - **Giai đoạn 3 — Grounded Ranking/Reply, Clickable Room Cards & B2C AI Smart Search UI:**
       * Gemini chỉ sinh lời tư vấn tiếng Việt ngắn gọn & `MatchReason` cho từng phòng dựa trên JSON ứng viên thật từ PostgreSQL 17; Backend tự đính kèm mảng `RecommendedRooms[]` xác thực từ DB (`PropertySlug`, `RoomTypeId`, `RoomTypeName`, `ImageUrl`, `AvailableRooms`, `EstimatedPrice`, `BedType`, `SquareMeters`, `MatchReason`) cùng `ExtractedFilters`, `ModelUsed`, `IsFallback` vào DTO (`AiDtos.cs`, `AiSmartSearchResponseDto.cs`) — loại bỏ 100% ảo giác giá/tồn phòng.
       * Ghi nhận telemetry trung thực vào `AiUsageLogs` (khi có ngữ cảnh tenant hợp lệ, không tạo migration mới): `InputTokens`, `OutputTokens`, `DurationMs`, `ModelUsed` (`"gemini-2.5-flash"` chỉ khi gọi Gemini thành công HTTP 200; `"rule-fallback"` khi thiếu key/timeout/lỗi).
       * Giữ công khai (`[AllowAnonymous]`) các route `POST /api/ai/chat`, `POST /api/ai/concierge`, `POST /api/ai/smart-search` trong `AiController.cs` để không chặn khách vãng lai B2C, kết hợp rate limiter `"ai-chat"` sẵn có + validate giới hạn prompt `500` ký tự & `6` lượt lịch sử.
       * Nâng cấp `frontend/src/app/shared/components/ai-concierge-chat/**` (giữ public cho khách vãng lai): gộp `ai-concierge.service.ts` vào `ai.service.ts`; cập nhật `core/models/ai.model.ts` và `core/models/public-booking.model.ts`; hỗ trợ safe XSS-escaped Markdown, auto-scroll khi có tin AI mới, nút Retry không nhân bản tin nhắn user, `maxlength="500"`, A11y (`role="dialog"`, `Escape`, `aria-live`, phục hồi focus, `prefers-reduced-motion`), thay quick prompt giả `Grand Hotel Q1` bằng gợi ý tìm phòng tiếng Việt thật; hiển thị **Clickable Room Recommendation Cards** (ảnh + fallback, badge `"Còn X phòng"`, giá `VndCurrencyPipe`, giường/diện tích/`MatchReason`, nút **"Xem chi tiết"** -> `/booking/properties/:slug` + stay `queryParams` + `roomTypeId`, nút **"Giữ phòng ngay"** -> `/booking/hold` + đầy đủ `queryParams`; **thẻ gợi ý PHẢI vẫn hiển thị ở chế độ `"rule-fallback"`**); tạo unit tests tại `frontend/src/app/shared/components/ai-concierge-chat/ai-concierge-chat.component.spec.ts` *(tạo mới)*.
       * Tạo standalone component bổ sung `frontend/src/app/shared/components/ai-smart-search-bar/**` *(tạo mới)* (`OnPush` + Angular Signals) nối `AiService.smartSearch()` vào `frontend/src/app/features/public-booking/explore-search.page.ts` (**giữ nguyên 100% selector của `app-booking-filter-bar` để không ảnh hưởng Playwright E2E của Tân**), hiển thị tóm tắt Gemini, pill tiêu chí đã trích xuất, backend `SuggestedFilterChips` và 1-click áp bộ lọc vào URL `queryParams`; hỗ trợ tùy chọn đọc `roomTypeId` queryParam trong `property-detail.page.ts` (kèm `property-detail.page.spec.ts`) để chọn sẵn hạng phòng được AI gợi ý.
       * Dọn Proxy & Prod-Server + Cấu hình Env: sửa `frontend/proxy.conf.js` (xóa chặn `/api/ai` về cổng `3099`) và `frontend/server/prod-server.js` (xóa nhánh xử lý riêng `/api/ai/chat`) để toàn bộ `/api/ai/*` đi thẳng về `.NET` backend; ngừng dùng dữ liệu giả/model `'gemini-3.8-flash'` trong `frontend/server/ai-chat-handler.js`. Thêm env passthrough `Gemini__ApiKey=${GEMINI_API_KEY:-}` và `Gemini__Model=${GEMINI_MODEL:-gemini-2.5-flash}` vào `docker-compose.staging.yml`, `deploy/docker-compose.staging.yml`, `docker/docker-compose.full.yml` và cấu hình `"Gemini": { "ApiKey": "", "Model": "gemini-2.5-flash" }` rỗng trong `backend/src/HotelSaas.WebApi/appsettings.json` (tuyệt đối không commit API key thật).
       * Cập nhật `docs/README.md`: sửa đúng tên GVHD `ThS. Huỳnh Xuân Phụng`, tên thành viên `Nguyễn Khôi Nguyên` và dữ liệu hành chính `34` tỉnh/thành, `10.060` xã/phường/đặc khu.

- **`ALLOWED FILES` (An - 100% tách biệt):**
  - `.github/workflows/**`
  - `.gitleaks.toml`
  - `docker-compose.staging.yml`
  - `deploy/docker-compose.staging.yml`
  - `docker/docker-compose.full.yml`
  - `backend/src/HotelSaas.Domain/Entities/User.cs`
  - `backend/src/HotelSaas.Infrastructure/Migrations/**`
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
  - `backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Application/Common/Options/GeminiOptions.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Application/Common/Options/PlatformLegalOptions.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs`
  - `backend/src/HotelSaas.Infrastructure/HotelSaas.Infrastructure.csproj`
  - `backend/src/HotelSaas.Application/Auth/Commands/Login/**`
  - `backend/src/HotelSaas.Application/Ai/Queries/**`
  - `backend/src/HotelSaas.Application/Ai/Common/**`
  - `backend/src/HotelSaas.Application/Ai/DTOs/**`
  - `backend/src/HotelSaas.Application/Public/DTOs/AiSmartSearchResponseDto.cs`
  - `backend/src/HotelSaas.Application/Print/Queries/GetPrintableContract/**`
  - `backend/src/HotelSaas.WebApi/appsettings.json`
  - `backend/src/HotelSaas.WebApi/Controllers/AiController.cs`
  - `backend/src/HotelSaas.WebApi/Controllers/AuditLogsController.cs`
  - `backend/tests/HotelSaas.Application.Tests/Auth/**`
  - `backend/tests/HotelSaas.Application.Tests/Ai/**` *(tạo mới)*
  - `backend/tests/HotelSaas.Application.Tests/Print/GetPrintableContractTests.cs` *(tạo mới)*
  - `backend/tests/HotelSaas.WebApi.Tests/Controllers/LocationsAndAiChatTests.cs`
  - `frontend/proxy.conf.js`
  - `frontend/server/prod-server.js`
  - `frontend/server/ai-chat-handler.js`
  - `frontend/src/app/app.routes.ts`
  - `frontend/src/app/app.routes.spec.ts`
  - `frontend/src/app/core/models/ai.model.ts`
  - `frontend/src/app/core/models/public-booking.model.ts`
  - `frontend/src/app/core/services/ai.service.ts`
  - `frontend/src/app/core/services/ai-concierge.service.ts`
  - `frontend/src/app/shared/components/ai-concierge-chat/**` *(bao gồm `ai-concierge-chat.component.spec.ts` *(tạo mới)*)*
  - `frontend/src/app/shared/components/ai-smart-search-bar/**` *(tạo mới)*
  - `frontend/src/app/features/public-booking/explore-search.page.ts`
  - `frontend/src/app/features/public-booking/explore-search.page.spec.ts`
  - `frontend/src/app/features/public-booking/property-detail.page.ts`
  - `frontend/src/app/features/public-booking/property-detail.page.spec.ts`
  - `docs/README.md`
  - `docs/reports/BAO-CAO-TUAN-8-NGO-VO-TUAN-AN-24TX810001.md` *(tạo mới)*

- **`FORBIDDEN FILES` (An):**
  - `backend/src/HotelSaas.WebApi/Program.cs`
  - Mọi file thuộc `Application/Invoices/**`, `Application/Reports/**`, `Application/Guests/**`, `Application/Reservations/**`
  - `ReportsController.cs`, `InvoicesController.cs`, `GuestsController.cs`
  - `frontend/package.json`, `frontend/package-lock.json`, `frontend/playwright.config.ts`, `frontend/e2e/**`
  - `frontend/src/app/core/services/{invoice,report,guest}.service.ts`, `frontend/src/app/core/models/{invoice,report,guest}.model.ts`, `frontend/src/app/features/{reports,housekeeping,guests}/**`
  - `scripts/load-tests/**`, `docs/reports/load-tests/**`, `backend/tests/HotelSaas.WebApi.Tests/Security/**`, `backend/tests/HotelSaas.Application.Tests/{Reports,Invoices,Guest}/**`
  - Mọi file trong `ALLOWED FILES` của Nguyên và Tân.

- **Tiêu chí nghiệm thu (Definition of Done - An):**
  1. Đã hoàn tất Bước 0 sau PR #30 (`origin/main @ 0ef301d`): `/opt/hotel-saas/.env` trên VPS Staging đạt chuẩn (`JWT_SECRET_KEY` đã xoay, `SEPAY_*` đầy đủ, tùy chọn `GF_SECURITY_ADMIN_PASSWORD` & `GEMINI_API_KEY`), `https://luxustay.duckdns.org/health/ready` trả `200`, và đã lưu biên bản baseline full test suite tại `369537f`.
  2. Đăng nhập sai 5 lần bị khóa tạm 15 phút (`AddUserLockoutFields`); `GetPrintableContract` đọc cấu hình từ `PlatformLegalOptions`; `AuditLogsController` chặn user thiếu `AUDIT_LOGS:Read` trả `403`; `/booking/profile` tự redirect sang `/login` khi chưa đăng nhập.
  3. CI chạy đủ `gitleaks` (allowlist thu hẹp) + `dotnet list --vulnerable` + `npm audit`.
  4. Luồng Gemini AI 3 giai đoạn hoạt động trọn vẹn trên `/api/ai/chat`, `/api/ai/concierge`, `/api/ai/smart-search` (đi thẳng `.NET` qua dev proxy & `prod-server.js`, dùng `x-goog-api-key`, `gemini-2.5-flash`, PII scrubbing, latest-turn priority, kiểm tra tồn phòng/giá thật trên PostgreSQL 17, fail-closed multi-tenant/IsPublished, ghi `InputTokens`/`OutputTokens`/`DurationMs`/`"gemini-2.5-flash"` vs `"rule-fallback"` trung thực); `ai-concierge-chat` hiển thị thẻ gợi ý phòng bấm được (`/booking/properties/:slug` & `/booking/hold`) ngay cả ở chế độ `"rule-fallback"`; `ai-smart-search-bar` chạy trên `explore-search.page.ts` mà không thay đổi selector của `app-booking-filter-bar`.
  5. Không chứa secret/API key thật trong Git; compose files & `appsettings.json` chỉ chứa env passthrough/placeholder rỗng; `docs/README.md` hiển thị đúng tên GVHD và dữ liệu 34 tỉnh/thành.

- **Lệnh kiểm chứng (An):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Auth|FullyQualifiedName~Ai|FullyQualifiedName~Print|FullyQualifiedName~LocationsAndAiChat"
  npm --prefix frontend run build
  npm --prefix frontend test -- --watch=false --include="src/app/app.routes.spec.ts" --include="src/app/shared/components/ai-*/**/*.spec.ts" --include="src/app/features/public-booking/{explore-search,property-detail}.page.spec.ts"
  ```

---

### 3.2. Nguyễn Khôi Nguyên (`24TX810011` - B2B Invoices, Tối ưu Báo cáo SQL & k6 Staging Load/Stress)

- **Nhánh Git:** `feature/nguyen-week8-invoices-reports-k6` (rẽ từ `develop @ 369537f` sau Bước 0)
- **Nhiệm vụ chi tiết:**
  1. **Xây dựng `InvoicesController.cs` *(tạo mới)* & Tab Sổ cái Hóa đơn (Không sửa DbContext / Migration):**
     - Tạo các CQRS Queries/Commands trong `backend/src/HotelSaas.Application/Invoices/**` *(tạo mới)* và `backend/src/HotelSaas.WebApi/Controllers/InvoicesController.cs` *(tạo mới)*, tái sử dụng `DbSet<Invoice>` và `DbSet<InvoiceItem>` có sẵn trong `IApplicationDbContext`:
       * `GetInvoicesQuery`: danh sách hóa đơn phân trang, lọc theo `PropertyId`, `Status`, khoảng ngày, từ khóa (`InvoiceNumber`, `GuestName`, `ConfirmationCode`).
       * `GetInvoiceByIdQuery`: chi tiết hóa đơn kèm danh sách `InvoiceItems` và các giao dịch thanh toán liên quan.
       * `GetMonthlyArSummaryQuery`: tổng hợp công nợ phải thu theo tháng (Tổng giá trị xuất, Đã thu, Còn nợ, Số hóa đơn chưa thanh toán đủ).
       * `IssueOfficialInvoiceCommand` + `AbstractValidator`: phát hành hóa đơn chính thức từ `Reservation` đủ điều kiện.
     - Gắn `[RequirePermission("INVOICES", ...)]` và kiểm tra phạm vi Tenant/Property.
     - Tạo `frontend/src/app/core/models/invoice.model.ts` *(tạo mới)*, `frontend/src/app/core/services/invoice.service.ts` *(tạo mới)* và component `InvoiceLedgerComponent` *(tạo mới)* (Standalone + `ChangeDetectionStrategy.OnPush` + Angular Signals + `VndCurrencyPipe` + `BusinessDatePipe`) gắn làm tab bên trong `frontend/src/app/features/reports/`, mở trực tiếp tới `/print/invoice/:id` và nút xuất PDF QR.
  2. **Tối ưu SQL `GetRevenueSummaryQueryHandler.cs` & Thêm `GET /api/reports/ai-summary`:**
     - Tối ưu `backend/src/HotelSaas.Application/Reports/Queries/GetRevenueSummary/GetRevenueSummaryQueryHandler.cs`: thay `.ToListAsync()` tải toàn bộ danh sách `Reservations`/`Payments` về C# RAM bằng các truy vấn tổng hợp trực tiếp trên PostgreSQL (`GroupBy`, `Sum`, `Count`). Giữ nguyên signature constructor hiện có để không làm gãy `ReportsAndAiSecurityTests.cs`.
     - Thêm endpoint `GET /api/reports/ai-summary` vào `ReportsController.cs` + `Application/Reports/Queries/GetAiRevenueSummary/**` *(tạo mới)*: tổng hợp các chỉ số thực (Doanh thu, ADR, RevPAR, Occupancy, chênh lệch kỳ trước) thành bản tóm tắt tiếng Việt rõ ràng; phần lõi chạy độc lập với `IGeminiAiClient` để compile song song bình thường với nhánh An.
     - Hiển thị panel "Tóm tắt phân tích báo cáo" trong `features/reports/` với trạng thái loading/lỗi trung thực.
  3. **Bổ sung `public-search.k6.js` *(tạo mới)* & Chạy Full `load` + `stress` trên Staging VPS + Nghiệm thu PDF QR & VietQR-Only / SePay:**
     - Tạo `scripts/load-tests/public-search.k6.js` *(tạo mới)* mô phỏng tìm kiếm OTA theo 34 tỉnh/thành (`GET /api/locations/provinces`, `GET /api/public/properties`) hỗ trợ `TEST_TIER=smoke|load|stress`, cập nhật `scripts/load-tests/run-load-tests.sh` (và `.ps1` nếu cần).
     - Sau khi An hoàn tất Bước 0 xác minh Staging VPS (`origin/main @ 0ef301d` / `https://luxustay.duckdns.org/`), chạy thực tế `TEST_TIER=load` (10-50 VUs / req/s) và `TEST_TIER=stress` (tối đa 100 VUs / req/s) cho SignalR, VNPay IPN và Public Search lên Staging; lưu summary JSON đã che token và báo cáo đối chiếu Before/After vào `docs/reports/load-tests/`.
     - Thực hiện kiểm chứng thực tế trên Staging cho luồng xuất hóa đơn PDF có mã QR tra cứu (`QRCoder`) và luồng **VietQR-only B2C checkout** kết hợp đối soát webhook SePay xác thực kép (`HMAC-SHA256` `X-SePay-Signature` / `Apikey` theo global & per-property từ Wave 12) với bảng `Payments` / `Reservations` trong PostgreSQL, lưu kết quả vào báo cáo Tuần 08.

- **`ALLOWED FILES` (Nguyên - 100% tách biệt):**
  - `backend/src/HotelSaas.Application/Invoices/**` *(tạo mới)*
  - `backend/src/HotelSaas.WebApi/Controllers/InvoicesController.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Application/Reports/**`
  - `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`
  - `backend/tests/HotelSaas.Application.Tests/Reports/**`
  - `backend/tests/HotelSaas.Application.Tests/Invoices/**` *(tạo mới)*
  - `frontend/src/app/core/services/invoice.service.ts` *(tạo mới)*
  - `frontend/src/app/core/models/invoice.model.ts` *(tạo mới)*
  - `frontend/src/app/core/services/report.service.ts`
  - `frontend/src/app/core/models/report.model.ts`
  - `frontend/src/app/features/reports/**`
  - `scripts/load-tests/**`
  - `docs/reports/load-tests/**`
  - `docs/reports/BAO-CAO-TUAN-8-NGUYEN-KHOI-NGUYEN-24TX810011.md` *(tạo mới)*

- **`FORBIDDEN FILES` (Nguyên):**
  - `docker-compose.staging.yml`, `deploy/docker-compose.staging.yml`, `docker/docker-compose.full.yml`
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`, `backend/src/HotelSaas.Infrastructure/Migrations/**`, `backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs`, `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs`, `backend/src/HotelSaas.Domain/Entities/**`
  - `backend/src/HotelSaas.WebApi/Program.cs`, `backend/src/HotelSaas.WebApi/Controllers/{Ai,AuditLogs,Guests}Controller.cs`
  - `backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs`, `backend/src/HotelSaas.Application/Common/Options/**`, `backend/src/HotelSaas.Application/Public/DTOs/AiSmartSearchResponseDto.cs`
  - `backend/src/HotelSaas.Application/{Ai,Auth,Print,Guests}/**`, `backend/tests/HotelSaas.WebApi.Tests/**`
  - `frontend/src/app/app.routes.ts`, `frontend/package.json`, `frontend/package-lock.json`
  - `frontend/src/app/core/models/{ai,public-booking}.model.ts`, `frontend/src/app/core/services/ai*.ts`
  - `frontend/src/app/shared/components/{ai-concierge-chat,ai-smart-search-bar}/**`
  - `frontend/src/app/features/public-booking/{explore-search,property-detail}.page*.ts`, `frontend/src/app/features/{housekeeping,guests}/**`
  - Mọi file trong `ALLOWED FILES` của An và Tân.

- **Tiêu chí nghiệm thu (Definition of Done - Nguyên):**
  1. `InvoicesController.cs` *(tạo mới)* cung cấp đủ 4 endpoint (`GET /api/invoices`, `GET /api/invoices/{id}`, `GET /api/invoices/ar-summary`, `POST /api/invoices/issue`), bảo vệ bởi `[RequirePermission("INVOICES", ...)]`, có unit tests trong `Application.Tests/Invoices/` *(tạo mới)*.
  2. Tab Sổ cái hóa đơn (`InvoiceLedgerComponent` *(tạo mới)*) dùng `OnPush`, Angular Signals, `0` kiểu `any`, mở đúng `/print/invoice/:id`.
  3. `GetRevenueSummaryQueryHandler.cs` không còn `.ToListAsync()` kéo bản ghi thô về RAM để cộng dồn; `GET /api/reports/ai-summary` chạy đúng với số liệu thật; unit tests `Application.Tests/Reports/` và `reports.page.spec.ts` PASS 100%.
  4. Có `scripts/load-tests/public-search.k6.js` *(tạo mới)* và kết quả chạy thật `load` / `stress` trên VPS Staging `https://luxustay.duckdns.org/` lưu tại `docs/reports/load-tests/` kèm bảng P50/P95/P99 và bằng chứng nghiệm thu PDF QR + VietQR-only B2C / SePay HMAC-SHA256 & Apikey webhook.

- **Lệnh kiểm chứng (Nguyên):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Report|FullyQualifiedName~Invoice"
  npm --prefix frontend run build
  npm --prefix frontend test -- --watch=false --include="src/app/features/reports/**/*.spec.ts"
  TEST_TIER=load BASE_URL=https://luxustay.duckdns.org bash scripts/load-tests/run-load-tests.sh
  ```

---

### 3.3. Trần Trọng Tân (`24TX810025` - Playwright E2E, Housekeeping SignalR, RBAC Matrix & Guest CRM)

- **Nhánh Git:** `feature/tan-week8-playwright-housekeeping-crm` (rẽ từ `develop @ 369537f` sau Bước 0)
- **Nhiệm vụ chi tiết:**
  1. **Khởi tạo Playwright E2E & Tự động hóa 10 Luồng Cốt Lõi:**
     - Cài `@playwright/test` vào `frontend/package.json` (`package-lock.json`), tạo `frontend/playwright.config.ts` *(tạo mới)* (hỗ trợ chạy nhắm vào `BASE_URL` local hoặc Staging `https://luxustay.duckdns.org/`, lưu trace/screenshot khi fail).
     - Viết bộ test trong `frontend/e2e/*.spec.ts` *(tạo mới)* bao phủ 10 luồng chính:
       1. Tìm kiếm B2C theo 34 tỉnh/thành & bộ lọc thông minh (`/booking`).
       2. Xem chi tiết cơ sở lưu trú & chọn phòng trống (`/booking/properties/:slug`).
       3. Tạo đơn giữ phòng 15 phút + áp mã khuyến mãi (`/booking/hold`).
       4. Thanh toán **VietQR-only B2C** (hiển thị QR chuyển khoản tại `/booking/hold`, xác nhận webhook SePay `HMAC-SHA256` `X-SePay-Signature` / `Apikey`) & trang tra cứu trạng thái (`/booking/status/:token`, kèm kiểm tra tương thích route `/booking/vnpay-return`).
       5. Đăng nhập PMS & kiểm tra giữ ngữ cảnh chuỗi HQ khi nhấn F5 reload.
       6. Nghiệp vụ Lễ tân: Walk-in / Check-in / Check-out trên sơ đồ phòng.
       7. Nhân viên buồng phòng tự nhận task dọn phòng (`housekeeping` self-claim) và đổi trạng thái phòng.
       8. Phê duyệt và xác nhận chi hoàn tiền D23 (`/payments`).
       9. Quản trị SuperAdmin tại `/platform-users` và `/platform-tenants`.
       10. Kiểm chứng giao diện / guard chặn truy cập chéo chi nhánh (HTTP 403 / chuyển hướng bảo vệ).
  2. **Nối SignalR Realtime Push Trực Tiếp Vào `housekeeping.page.ts`:**
     - Inject `NotificationService` vào `frontend/src/app/features/housekeeping/housekeeping.page.ts`, lắng nghe sự kiện `ReceiveHousekeepingAlert` và `ReceiveReservationStatusUpdated` để cập nhật hàng đợi công việc buồng phòng và trạng thái phòng ngay khi có biến động từ Check-out / Lễ tân.
     - Giữ fallback polling 10 giây (`setInterval`) chỉ hoạt động khi kết nối SignalR đang ngắt; cập nhật `housekeeping.page.spec.ts`.
  3. **Mở rộng Ma Trận Test HTTP E2E Âm Tính RBAC (`RbacPermissionMatrixE2ETests.cs` *(tạo mới)*):**
     - Tạo `backend/tests/HotelSaas.WebApi.Tests/Security/RbacPermissionMatrixE2ETests.cs` *(tạo mới)* đi qua `WebApplicationFactory<Program>` + `JwtService` thật + PostgreSQL test DB thật (không mock `ICurrentTenantService` / `ICurrentPropertyService`).
     - Kiểm chứng HTTP `403 Forbidden` (và `401` khi ẩn danh) phủ đủ `19` `PermissionFunction` codes trong `SeedData.cs` (`DASHBOARD`, `PROPERTIES`, `ROOMS`, `ROOM_TYPES`, `RESERVATIONS`, `GUESTS`, `CHECK_IN_OUT`, `HOUSEKEEPING`, `PAYMENTS`, `INVOICES`, `REPORTS`, `STAFF`, `ROLES`, `SETTINGS`, `SUBSCRIPTIONS`, `PROMOTIONS`, `REVIEWS`, `AI_FEATURES`, `AUDIT_LOGS`) trên `6` vai trò (`HOUSEKEEPER`, `RECEPTIONIST`, `MANAGER`, `OWNER`, `SUPER_ADMIN`, `Customer`).
  4. **Sửa Lỗi Guest CRM Không Đụng Schema DB:**
     - `GetGuestDirectoryQuery.cs` & `GetGuestHistoryQuery.cs`: bỏ điều kiện lọc cứng `!string.IsNullOrWhiteSpace(r.GuestPhone)` làm rơi khách đặt phòng không có SĐT; gom nhóm dự phòng theo `GuestEmail` chuẩn hóa hoặc `GuestName` + `GuestUserId`/`ReservationId`, hỗ trợ xem lịch sử khách thiếu SĐT qua `GuestsController.cs` & `guest.service.ts`.
     - `ReservationSnapshot.cs`, `UpdateGuestNotesCommand.cs`, `UpdateGuestNotesCommandValidator.cs`, `guest.model.ts`, `guests.page.ts`: bổ sung `IsVip` (manual override) và `IsBlacklisted` vào `ReservationSnapshot` JSON (`Reservation.Notes`), đọc/hiển thị lại chính xác trong `GetGuestDirectoryQuery` / `GetGuestHistoryQuery` (thay giá trị gán cứng `IsBlacklisted = false`), hiển thị badge VIP/Blacklist trên `guests.page.ts`.
     - Bổ sung unit tests tại `backend/tests/HotelSaas.Application.Tests/Guest/GuestDirectoryAndNotesTests.cs` *(tạo mới)*.

- **`ALLOWED FILES` (Tân - 100% tách biệt):**
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `frontend/playwright.config.ts` *(tạo mới)*
  - `frontend/e2e/**` *(tạo mới)*
  - `frontend/src/app/features/housekeeping/**`
  - `frontend/src/app/features/guests/**`
  - `frontend/src/app/core/services/guest.service.ts`
  - `frontend/src/app/core/models/guest.model.ts`
  - `backend/src/HotelSaas.Application/Guests/**`
  - `backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs`
  - `backend/src/HotelSaas.WebApi/Controllers/GuestsController.cs`
  - `backend/tests/HotelSaas.Application.Tests/Guest/**`
  - `backend/tests/HotelSaas.WebApi.Tests/Security/**`
  - `docs/reports/BAO-CAO-TUAN-8-TRAN-TRONG-TAN-24TX810025.md` *(tạo mới)*

- **`FORBIDDEN FILES` (Tân):**
  - `docker-compose.staging.yml`, `deploy/docker-compose.staging.yml`, `docker/docker-compose.full.yml`
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`, `backend/src/HotelSaas.Infrastructure/Migrations/**`, `backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs`, `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs`, `backend/src/HotelSaas.Domain/Entities/**`
  - `backend/src/HotelSaas.WebApi/Program.cs`, `.github/workflows/**`, `frontend/src/app/app.routes.ts`
  - `backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs`, `backend/src/HotelSaas.Application/Common/Options/**`, `backend/src/HotelSaas.Application/Public/DTOs/AiSmartSearchResponseDto.cs`
  - `backend/src/HotelSaas.Application/{Auth,Ai,Print,Invoices,Reports}/**`, `backend/src/HotelSaas.WebApi/Controllers/{Ai,AuditLogs,Invoices,Reports}Controller.cs`
  - `frontend/src/app/core/models/{ai,public-booking}.model.ts`, `frontend/src/app/core/services/ai*.ts`
  - `frontend/src/app/shared/components/{ai-concierge-chat,ai-smart-search-bar}/**`
  - `frontend/src/app/features/public-booking/{explore-search,property-detail}.page*.ts`, `frontend/src/app/features/reports/**`
  - `scripts/load-tests/**`, `docs/reports/load-tests/**`
  - Mọi file trong `ALLOWED FILES` của An và Nguyên.

- **Tiêu chí nghiệm thu (Definition of Done - Tân):**
  1. `npx --prefix frontend playwright test` chạy qua cấu hình `playwright.config.ts` *(tạo mới)* và kiểm chứng đủ 10 kịch bản E2E cốt lõi (bao gồm luồng VietQR-only B2C & SePay HMAC-SHA256/Apikey ở Flow #4).
  2. `housekeeping.page.ts` nhận push trực tiếp `ReceiveHousekeepingAlert` / `ReceiveReservationStatusUpdated` từ `NotificationService`, chỉ bật polling 10s khi SignalR chưa kết nối; `housekeeping.page.spec.ts` PASS 100%.
  3. `RbacPermissionMatrixE2ETests.cs` *(tạo mới)* chạy qua `WebApplicationFactory<Program>` + PostgreSQL thật, kiểm chứng đầy đủ ma trận quyền trên 6 vai trò và PASS 100%.
  4. `GetGuestDirectoryQuery` hiển thị đầy đủ cả khách thiếu SĐT; cập nhật `Notes`, `IsVip`, `IsBlacklisted` lưu qua `ReservationSnapshot` JSON và hiển thị đúng trên API + `guests.page.ts` (`GuestDirectoryAndNotesTests.cs` *(tạo mới)* PASS 100%).

- **Lệnh kiểm chứng (Tân):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~CrossBranchSecurity|FullyQualifiedName~RbacPermissionMatrix|FullyQualifiedName~Guest"
  npm --prefix frontend run build
  npm --prefix frontend test -- --watch=false --include="src/app/features/{housekeeping,guests}/**/*.spec.ts"
  npx --prefix frontend playwright test
  ```

---

## 4. Trình Tự Tích Hợp, Phụ Thuộc & Dự Kiến Tuần 09

### 4.1. Thứ Tự Thực Thi & Merge (Zero Conflict)

```text
[Bước 0: PR #30 đã merge (0ef301d); An xác minh .env Staging + /health/ready=200 + baseline test 369537f]
                                    |
         +--------------------------+--------------------------+ (Bước 1: Song song)
         v                          v                          v
[Nhánh An]                  [Nhánh Nguyên]             [Nhánh Tân]
Lockout + Gemini 3-Stage +  Invoices + SQL Report +    Playwright + SignalR HK +
Room Cards + CI CVE/Audit   public-search.k6.js        RBAC Matrix + Guest CRM
         |                          |                          |
         +--------------------------+--------------------------+
                                    v (Bước 2: Thứ tự Merge vào develop)
         1. Merge An  --->  2. Merge Nguyên  --->  3. Merge Tân
                                    |
                                    v (Bước 3: Nghiệm thu toàn hệ thống)
   [Full dotnet test + Vitest + Staging k6 Load/Stress + Staging Playwright E2E]
```

1. **Bước 0 (An thực hiện trước khi rẽ nhánh):**
   - PR #30 (`develop` -> `main`) đã merge xong lên `origin/main @ 0ef301d`. An hoàn tất rà soát `/opt/hotel-saas/.env` trên VPS Staging (`JWT_SECRET_KEY`, `SEPAY_*`, tùy chọn `GF_SECURITY_ADMIN_PASSWORD` & `GEMINI_API_KEY`), xác nhận `https://luxustay.duckdns.org/health/ready` trả `200`, và lưu biên bản full test suite tại mốc `369537f`.
   - Sau đó An, Nguyên, Tân cùng cắt nhánh Tuần 08 trực tiếp từ `origin/develop @ 369537f`.
2. **Bước 1 (Phát triển song song trên 3 nhánh tách biệt):**
   - `ALLOWED FILES` giữa An, Nguyên, Tân có **0% giao nhau**; `Program.cs` không ai sửa và `frontend/package.json` độc quyền của Tân.
   - `GetAiRevenueSummaryQueryHandler` *(tạo mới)* của Nguyên tổng hợp số liệu thật trực tiếp từ DB mà không phụ thuộc bắt buộc vào `IGeminiAiClient` *(tạo mới)* của An, nên build song song luôn xanh.
   - `ai-smart-search-bar` *(tạo mới)* trên `explore-search.page.ts` của An chỉ bổ sung theo kiểu additive, giữ nguyên 100% selector của `app-booking-filter-bar` để Playwright E2E Flow #1 của Tân không bị ảnh hưởng.
3. **Bước 2 (Thứ tự Merge vào `develop`):**
   - **Thứ nhất - Merge An:** Đưa EF Migration `AddUserLockoutFields`, kiến trúc Gemini AI 3 giai đoạn (`IGeminiAiClient`/`GeminiAiClient`/`GeminiOptions`, DB availability/pricing grounding, clickable room cards, `ai-smart-search-bar`, compose env passthrough), `PlatformLegalOptions`, `AuditLogsController` RBAC, `/booking/profile` `authGuard` và CI vulnerability scan vào `develop`.
   - **Thứ hai - Merge Nguyên:** Rebase `develop`, hoàn thiện kết nối tùy chọn `IGeminiAiClient` nếu cần, chạy k6 `load` (50 VUs) và `stress` (100 VUs) lên Staging VPS sau Bước 0 cùng biên bản đối soát PDF QR & VietQR-only / SePay.
   - **Thứ ba - Merge Tân:** Rebase `develop`, chạy toàn trình 10 kịch bản Playwright E2E và `RbacPermissionMatrixE2ETests.cs` trên `develop` mới nhất.
4. **Bước 3 (Kiểm định tổng hợp sau merge):**
   ```bash
   dotnet build backend/HotelSaas.slnx --verbosity minimal
   dotnet test backend/HotelSaas.slnx --no-build
   npm --prefix frontend run build
   npm --prefix frontend test -- --watch=false
   npx --prefix frontend playwright test
   ```

### 4.2. Dự Kiến Hạng Mục Chuyển Tiếp Sang Tuần 09

Các thay đổi schema DB mở rộng và hạng mục toàn ứng dụng được cố định cho Tuần 09 sau khi Tuần 08 đóng dứt điểm bảo mật P0, Gemini AI tìm & gợi ý phòng thật, Invoices, k6 Staging và Playwright:
- **Song ngữ VI/EN (i18n):** Hiện `I18N_FILES_COUNT = 0`; Tuần 09 bổ sung dịch vụ dịch và bộ từ điển VI/EN toàn ứng dụng.
- **EF Migration `GuestProfile` & `CashierShift`:** Tách bảng hồ sơ khách độc lập (hỗ trợ lưu CCCD/Passport chuẩn hóa) và bảng mở/đóng ca thu ngân kiểm đếm két tiền tại quầy.
- **Quản trị thiết bị SmartLock cấp phòng:** Mở rộng từ cấp đặt phòng (`RegenerateSmartLockPin`/`RevokeSmartLockPin`) sang thực thể `SmartLockDevice`/`AccessLog` và giao diện quản trị khóa trên trang Phòng.
- **Đồng bộ tài liệu SDD:** Cập nhật `docs/sdd/06-api-design.md` khớp hoàn toàn với 30+ WebApi Controllers và 34+ Entities hiện hành.

# KẾ HOẠCH CHI TIẾT TUẦN 07 - HOTEL SAAS PLATFORM V2
## Lộ Trình Đóng Nợ Bảo Mật P0, Gemini AI Thật, B2B Invoices, k6 Staging & Playwright E2E

- **Đề tài:** `578` - Nền tảng Quản lý Khách sạn Đa chi nhánh theo mô hình SaaS (**Hotel SaaS Platform v2**)
- **Đơn vị:** Khoa Công nghệ Thông tin - Bộ môn Công nghệ Phần mềm - Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE)
- **Giảng viên hướng dẫn:** `ThS. Huỳnh Xuân Phụng` (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** `https://github.com/GinNgo/hotel-saas-v2`
- **Môi trường Staging VPS:** `https://luxustay.duckdns.org/`
- **Baseline Git hiện tại:** `develop @ 3ee927d`
  - **Cảnh báo đồng bộ Git (Bước 0 bắt buộc trước khi cắt nhánh Tuần 07):** Nhánh `develop` local tại `3ee927d` đang đi trước `origin/develop` (`c297b58`) **14 commit** (`55da312..3ee927d`, gồm Waves 1-8). Các commit này chưa được push lên GitHub và chưa được deploy lên VPS Staging (`origin/main` đang ở `5cf0a78`). Nhóm trưởng phải push `develop`, mở PR cập nhật `main` và deploy Waves 1-8 lên Staging trước khi Nguyên chạy k6 load/stress và trước khi các thành viên rẽ nhánh Tuần 07.
  - **Lưu ý nhánh tồn đọng:** Nhánh `origin/feature/tan-week6-security-e2e-d23` (`807a3ae..71daa2f`) hiện vẫn ở trạng thái chưa merge vào `develop` (các file `docs/reports/evidence/week6/` và `HoldExpiredPipelineTests.cs` không tồn tại trên `develop @ 3ee927d`). Nhánh Tuần 07 của Tân phải cắt từ `develop @ 3ee927d` sau khi đã đồng bộ với `origin/develop`.

### Danh Sách Thành Viên Nhóm

| STT | Họ và Tên | MSSV | GitHub | Vai Trò Chuẩn Tuần 07 | Nhánh Làm Việc Tuần 07 |
|:---:|---|---|---|---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `GinNgo` | Nhóm trưởng, Kiến trúc, Auth/Security, Gemini AI Thật & CI/CD Deploy | `feature/an-week7-security-gemini-deploy` |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `khoinguyen1310` | Tài chính, B2B Invoices, Tối ưu Báo cáo SQL & k6 Staging Load/Stress | `feature/nguyen-week7-invoices-reports-k6` |
| 3 | **Trần Trọng Tân** | `24TX810025` | `trantrongtan096` | Vận hành, Housekeeping SignalR, Guest CRM & Playwright E2E / RBAC Matrix | `feature/tan-week7-playwright-housekeeping-crm` |

---

## 1. Đối Soát Hạng Mục Lộ Trình Cũ (Tuần 7-11) ĐÃ HOÀN THÀNH Trong Waves 1-8

Qua kiểm toán toàn diện mã nguồn trên `develop @ 3ee927d`, nhiều đầu việc trong bảng lộ trình Tuần 7-11 cũ đã được hoàn thành ở Waves 1-8 (34 Domain Entities, 29 Controllers với `0` controller inject `IApplicationDbContext`, 79/79 Angular component dùng `OnPush` và `0` kiểu `any`). **Các thành viên KHÔNG lặp lại các phần đã xong dưới đây:**

| Nhóm Hạng Mục (Lộ trình cũ) | Trạng Thái Tại `3ee927d` | Bằng Chứng Mã Nguồn Thực Tế | Phần Còn Thiếu Chuyển Vào Tuần 07 / 08 |
| :--- | :---: | :--- | :--- |
| **SHA-256 Refresh Token, Forgot/Reset/Change Password & Staff Email Invite** | Đã xong | `backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs` (dòng 177), `RevokeTokenCommandHandler.cs`, `RefreshTokenCommandHandler.cs`, `Application/Auth/Commands/**`, `CreateStaffMemberCommand.cs`, `StaffController.cs`, `frontend/src/app/features/auth/{forgot-password,reset-password}/` | Còn thiếu `BR-SEC03` khóa brute-force login trên `User` (giao An Tuần 07). |
| **Dynamic CORS, `UseHsts`, Prod JWT Guard, `/metrics` Guard, IDOR `CreateHold`** | Đã xong | `backend/src/HotelSaas.WebApi/Program.cs` (dòng 89-116, 185-188, 204-215, 232-248), `TenantPropertyContextMiddleware.cs`, `PublicController.cs` (dòng 308-317) | Còn thiếu `AddRateLimiter`/`UseRateLimiter` trong `Program.cs` (giao An Tuần 07). |
| **RBAC `SubscriptionsController`, `ReportsController`, `PrintDocumentsController`, `AuditLogsController`, Demo UI & Terraform** | Đã xong phần lớn | `SubscriptionsController.cs`, `ReportsController.cs` (dòng 31), `GetGroupAnalyticsQueryHandler.cs`, `GetPrintableContractQueryHandler.cs`, `GetPrintableVoucherQueryHandler.cs`, `PrintDocumentsController.cs`, `GetAuditLogsQueryHandler.cs`, `login.page.ts`, `infra/terraform/main.tf` | Còn 4 điểm: bypass `ConfirmationCode` 6 ký tự và legal info hardcode ở Print; thiếu `[RequirePermission("AUDIT_LOGS", ...)]` ở `AuditLogsController` GET; `SeedData.cs` chưa chặn mật khẩu seed trên Prod; `/booking/profile` thiếu `authGuard` (giao An Tuần 07). |
| **DB Unique/Perf Indexes & CQRS Validators (`91/91` Commands) & `HOUSEKEEPER` RBAC** | Đã xong | `backend/src/HotelSaas.Infrastructure/Migrations/20261119090000_AddSupportGrantsAndIndexes.cs`, `RoomsController.cs` (dòng 202), `SeedData.cs` (19 `PermissionFunction` codes gồm cả `AUDIT_LOGS`) | Cần mở rộng test HTTP E2E phủ âm tính toàn bộ ma trận quyền trên 6 vai trò (giao Tân Tuần 07). |
| **Checkout Auto-Invoice, Phụ phí 24/24 (`POL-IO01/02`), `Promotions`, `Reviews`, `GuestPortal`, 34 Tỉnh/Thành** | Đã xong | `CheckOutReservationCommandHandler.cs`, `PricingCalculator.cs`, `PromotionsController.cs`, `ReviewsController.cs`, `GuestPortalController.cs`, `guest-profile.page.ts`, `DMTinhThanh_2Cap.csv` (34 dòng), `DMXaPhuong_2Cap.csv` (10.060 dòng), `LocationLookupService.cs` | Chưa có `InvoicesController` chuyên biệt cho kế toán B2B & Tab sổ cái hóa đơn ở UI (giao Nguyên Tuần 07). |
| **Platform Governance (`/platform-users`, `/platform-tenants`, `SupportAccessGrant`, `ISubscriptionQuotaGuard`)** | Đã xong | `PlatformTenantsController.cs`, `PlatformOverviewController.cs`, `PlatformUsersController.cs`, `TenantsController.cs`, `SubscriptionQuotaGuard.cs`, `features/platform-users/`, `features/support-grants/` | Cần đưa vào kịch bản E2E Playwright để kiểm thử hồi quy tự động (giao Tân Tuần 07). |
| **Housekeeping Kanban, `NightAuditBackgroundService`, SmartLock PIN Ops, Dynamic Pricing 1-Click, Chart.js & Angular Hygiene** | Đã xong | `HousekeepingController.cs`, `housekeeping.page.ts`, `NightAuditBackgroundService.cs`, `reservations.page.ts`, `booking-status.page.ts`, `AiController.cs` (dòng 128-178), `rates.page.ts`, `chart-card.component.ts` (`chart.js ^4.6.1`), `vnd-currency.pipe.ts` (130 chỗ), `79/79 OnPush`, `0 any` | `housekeeping.page.ts` vẫn polling `setInterval(10000)` thay vì nhận SignalR push trực tiếp; chưa có `Playwright` E2E; AI backend vẫn chạy bằng regex giả lập (giao Tân & An Tuần 07). |

---

## 2. Lỗ Hổng Còn Tồn Đọng & Phân Công Tuần 07 Theo Vai Trò Chuẩn

### Bảng Tổng Hợp Khoảng Trống Thực Tế Tại `develop @ 3ee927d`

| Mã Gap | Mức Độ | Mô Tả Khoảng Trống Kỹ Thuật Đã Xác Minh | Người Phụ Trách |
|---|:---:|---|---|
| **GAP-01** | P0 | 14 commit Waves 1-8 (`55da312..3ee927d`) mới nằm ở local `develop`, chưa push lên GitHub và chưa deploy lên VPS Staging (`https://luxustay.duckdns.org`). | **Ngô Võ Tuấn An** |
| **GAP-02** | P0 | `.github/workflows/ci.yml` để `gitleaks` `continue-on-error: true`, `ci-status` bỏ qua `needs.security.result`, thiếu `dotnet list package --vulnerable` / `npm audit`; `.gitleaks.toml` bỏ qua cả `docs/`, `backend/tests/`, `scripts/`. | **Ngô Võ Tuấn An** |
| **GAP-03** | P0 | `Program.cs` chưa có `AddRateLimiter`/`UseRateLimiter`; `User.cs` & `LoginCommandHandler.cs` chưa có cơ chế khóa đăng nhập sai liên tiếp (`BR-SEC03`). | **Ngô Võ Tuấn An** |
| **GAP-04** | P0 | `GetPrintableInvoiceQueryHandler.cs` mở toàn bộ PII chỉ bằng `ConfirmationCode` 6 ký tự trên endpoint `[AllowAnonymous]`; `GetPrintableContractQueryHandler.cs` hardcode thông tin pháp lý; `AuditLogsController.cs` thiếu `[RequirePermission]` ở 2 action `GET`; `SeedData.cs` tạo SuperAdmin mật khẩu cứng không phân biệt Production; `app.routes.ts` thiếu `authGuard` cho `/booking/profile`. | **Ngô Võ Tuấn An** |
| **GAP-05** | P0 | Backend AI (`ProcessAiConcierge`, `ProcessAiChat`, `ProcessAiSmartSearch`) chạy 100% bằng regex/template nhưng log giả `"gemini-2.5-flash"`; `frontend/proxy.conf.js` chặn `/api/ai` về cổng `3099` gây 404 các endpoint AI mới; `frontend/server/ai-chat-handler.js` gọi package `@google/genai` chưa cài & model `'gemini-3.8-flash'` không tồn tại kèm tên khách sạn giả; trùng lặp `ai.service.ts` và `ai-concierge.service.ts`; `docs/README.md` sai tên GVHD và dữ liệu 63 tỉnh. | **Ngô Võ Tuấn An** |
| **GAP-06** | P1 | Chưa có `InvoicesController.cs` *(tạo mới)*, `Application/Invoices/**` *(tạo mới)* và giao diện sổ cái hóa đơn B2B trong `features/reports/`; `GetRevenueSummaryQueryHandler.cs` vẫn dùng `.ToListAsync()` kéo dữ liệu thô về RAM thay vì SQL `GroupBy`/`Sum`; thiếu endpoint `GET /api/reports/ai-summary`. | **Nguyễn Khôi Nguyên** |
| **GAP-07** | P1 | Bộ k6 mới chạy cấp độ `smoke` (5 VUs) ở local `127.0.0.1:5055`, chưa có `public-search.k6.js` *(tạo mới)* và chưa chạy `load` (50 VUs) / `stress` (100 VUs) thực tế trên VPS Staging. | **Nguyễn Khôi Nguyên** |
| **GAP-08** | P1 | Chưa có Playwright E2E (`@playwright/test`, `playwright.config.ts` *(tạo mới)*, `frontend/e2e/*.spec.ts` *(tạo mới)*); `housekeeping.page.ts` chưa lắng nghe SignalR trực tiếp; chưa có `RbacPermissionMatrixE2ETests.cs` *(tạo mới)* phủ toàn bộ ma trận quyền âm tính 19 `PermissionFunction` (hiện mới có 7 test cô lập trong `CrossBranchSecurityE2ETests.cs`); Guest CRM (`GetGuestDirectoryQuery.cs`, `UpdateGuestNotesCommand.cs`) bỏ sót khách không có SĐT và gán cứng `IsBlacklisted = false`. | **Trần Trọng Tân** |

> **Quy tắc tránh xung đột EF Migration (Bắt buộc):** Trong Tuần 07, **chỉ duy nhất Ngô Võ Tuấn An** được phép sửa `User.cs`, `ApplicationDbContext.cs` và tạo EF Migration (`AddUserLockoutFields`). Các bảng DB mới như `GuestProfile` và `CashierShift` cùng tính năng song ngữ VI/EN và quản trị thiết bị SmartLock cấp phòng được dời gọn sang Tuần 08.

---

## 3. Phân Công Chi Tiết, Ranh Giới File & Tiêu Chí Nghiệm Thu Từng Thành Viên

### 3.1. Ngô Võ Tuấn An (`24TX810001` - Nhóm trưởng, Security Hardening, Gemini AI & CI/CD Deploy)

- **Nhánh Git:** `feature/an-week7-security-gemini-deploy` (rẽ từ `develop` sau khi hoàn thành Bước 0 push `3ee927d`)
- **Nhiệm vụ chi tiết:**
  1. **Bước 0 - Đồng bộ Git & Deploy Waves 1-8 lên Staging:**
     - Kiểm tra secret trên diff, push 14 commit (`55da312..3ee927d`) lên `origin/develop`, mở PR vào `main` và theo dõi `cd-vps.yml` deploy thành công lên `https://luxustay.duckdns.org`.
  2. **Siết cổng bảo mật CI/CD:**
     - Cập nhật `.github/workflows/ci.yml`: đặt `continue-on-error: false` cho `gitleaks`, cập nhật job `ci-status` kiểm tra cả `needs.security.result == 'success'`, bổ sung bước kiểm tra lỗ hổng thư viện `dotnet list backend/HotelSaas.slnx package --vulnerable --include-transitive` và `npm --prefix frontend audit --audit-level=high`.
     - Thu hẹp `.gitleaks.toml` (loại bỏ allowlist rộng cả `docs/`, `backend/tests/`, `scripts/`, chỉ whitelist mẫu test cụ thể bằng regex/đường dẫn hẹp nếu thật sự cần).
     - Đồng bộ hoặc dọn dẹp file workflow cũ bị lệch trong `deploy/workflows/`.
  3. **Rate Limiting & Khóa đăng nhập Brute-Force (`BR-SEC03`):**
     - Cấu hình `AddRateLimiter` / `UseRateLimiter` trong `backend/src/HotelSaas.WebApi/Program.cs` cho các nhóm nhạy cảm (`/api/auth/*`, `/api/public/bookings/hold`, `/api/ai/*`), trả mã HTTP `429 Too Many Requests` kèm header chuẩn.
     - Bổ sung `FailedLoginCount` (`int`) và `LockoutEndUtc` (`DateTime?`) vào `User.cs` + `UserConfiguration.cs`, tạo 1 EF Migration duy nhất của Tuần 07 (`AddUserLockoutFields` *(tạo mới)*), cập nhật `LoginCommandHandler.cs` tăng bộ đếm khi sai mật khẩu, khóa tạm thời khi đạt ngưỡng (ví dụ 5 lần sai khóa 15 phút) và reset về `0` khi đăng nhập thành công.
  4. **Đóng các điểm hở Print PII, Audit RBAC, SeedData & Route Guard:**
     - `GetPrintableInvoiceQueryHandler.cs`: bỏ nhánh mở toàn bộ PII bằng `ConfirmationCode` ngắn 6 ký tự trên endpoint ẩn danh; chỉ trả full PII cho tài khoản đã xác thực hợp lệ (SuperAdmin, nhân sự đúng Tenant, `GuestUserId` chính chủ) hoặc khách ẩn danh truyền đúng `LookupToken` đầy đủ chưa thu hồi (`!snapshot.IsTokenRevoked`). Cập nhật test tương ứng trong `LocationsAndAiChatTests.cs` và thêm unit test ở `backend/tests/HotelSaas.Application.Tests/Print/**` *(tạo mới)*.
     - `GetPrintableContractQueryHandler.cs`: tách thông tin pháp lý nền tảng đang hardcode sang `IOptions<PlatformLegalOptions>` *(tạo mới)* (lấy cấu hình từ `appsettings.json` / env, có default an toàn).
     - `AuditLogsController.cs`: gắn `[RequirePermission("AUDIT_LOGS", PermissionAction.Read)]` lên `GetList` và `GetById`.
     - `SeedData.cs`: không tự động tạo tài khoản SuperAdmin với mật khẩu mặc định `"HotelDev@2026!"` khi chạy ở môi trường Production (chỉ seed demo account ở `Development` / `Staging` hoặc khi không có `ASPNETCORE_ENVIRONMENT=Production`).
     - `frontend/src/app/app.routes.ts`: bổ sung `canActivate: [authGuard]` cho route `booking/profile` (cùng unit test trong `app.routes.spec.ts`).
  5. **Tích hợp Google Gemini SDK thật & Dọn Proxy/Prod-Server AI + Sửa `docs/README.md`:**
     - Tạo `IGeminiAiClient` (`backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs` *(tạo mới)*) và `GeminiAiClient` (`backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs` *(tạo mới)*) gọi Google Gemini REST/SDK thật với model `gemini-2.5-flash` thông qua cấu hình `GEMINI_API_KEY` (hoặc `Gemini:ApiKey`). Khi môi trường chưa cấu hình API key hoặc gọi lỗi, trả fallback rõ ràng và ghi model `"rule-fallback"` vào `AiUsageLogs` (không ghi giả `"gemini-2.5-flash"`).
     - Nối `IGeminiAiClient` (constructor optional `IGeminiAiClient? = null` để không làm gãy test hiện có) vào `ProcessAiConciergeQueryHandler`, `ProcessAiChatQueryHandler` và `ProcessAiSmartSearchQueryHandler`.
     - Sửa `frontend/proxy.conf.js` và `frontend/server/prod-server.js`: bỏ proxy cổng `3099` và bỏ chặn `/api/ai/chat` ở Node server để toàn bộ `/api/ai/*` đi thẳng vào `.NET` backend; ngừng sử dụng `frontend/server/ai-chat-handler.js` (gỡ bỏ stub tên khách sạn giả).
     - Gộp `frontend/src/app/core/services/ai-concierge.service.ts` vào `ai.service.ts` và cập nhật `frontend/src/app/shared/components/ai-concierge-chat/ai-concierge-chat.component.ts`.
     - Sửa metadata `docs/README.md`: đúng tên GVHD `ThS. Huỳnh Xuân Phụng`, đúng tên thành viên `Nguyễn Khôi Nguyên`, đúng dữ liệu hành chính `34` tỉnh/thành và `10.060` xã/phường.

- **`ALLOWED FILES` (An - 100% tách biệt):**
  - `.github/workflows/**`
  - `deploy/workflows/**`
  - `.gitleaks.toml`
  - `backend/src/HotelSaas.Domain/Entities/User.cs`
  - `backend/src/HotelSaas.Infrastructure/Migrations/**`
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
  - `backend/src/HotelSaas.Application/Common/Interfaces/IGeminiAiClient.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Application/Common/Options/PlatformLegalOptions.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Infrastructure/Services/GeminiAiClient.cs` *(tạo mới)*
  - `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs`
  - `backend/src/HotelSaas.Infrastructure/HotelSaas.Infrastructure.csproj`
  - `backend/src/HotelSaas.Application/Auth/Commands/Login/**`
  - `backend/src/HotelSaas.Application/Ai/Queries/**`
  - `backend/src/HotelSaas.Application/Ai/Common/**`
  - `backend/src/HotelSaas.Application/Ai/DTOs/**`
  - `backend/src/HotelSaas.Application/Print/Queries/GetPrintableInvoice/**`
  - `backend/src/HotelSaas.Application/Print/Queries/GetPrintableContract/**`
  - `backend/src/HotelSaas.WebApi/Program.cs`
  - `backend/src/HotelSaas.WebApi/appsettings.json`
  - `backend/src/HotelSaas.WebApi/Controllers/AuditLogsController.cs`
  - `backend/tests/HotelSaas.Application.Tests/Auth/**`
  - `backend/tests/HotelSaas.Application.Tests/Ai/**` *(tạo mới)*
  - `backend/tests/HotelSaas.Application.Tests/Print/**` *(tạo mới)*
  - `backend/tests/HotelSaas.WebApi.Tests/Controllers/LocationsAndAiChatTests.cs`
  - `frontend/proxy.conf.js`
  - `frontend/server/prod-server.js`
  - `frontend/server/ai-chat-handler.js`
  - `frontend/src/app/app.routes.ts`
  - `frontend/src/app/app.routes.spec.ts`
  - `frontend/src/app/core/services/ai.service.ts`
  - `frontend/src/app/core/services/ai-concierge.service.ts`
  - `frontend/src/app/shared/components/ai-concierge-chat/**`
  - `docs/README.md`
  - `docs/reports/BAO-CAO-TUAN-7-NGO-VO-TUAN-AN-24TX810001.md` *(tạo mới)*

- **`FORBIDDEN FILES` (An):**
  - Mọi file thuộc `Application/Invoices/**`, `Application/Reports/**`, `Application/Guests/**`, `Application/Reservations/**`
  - `ReportsController.cs`, `InvoicesController.cs`, `GuestsController.cs`
  - `frontend/package.json`, `frontend/package-lock.json`, `frontend/playwright.config.ts`, `frontend/e2e/**`, `frontend/src/app/features/{reports,housekeeping,guests}/**`
  - `scripts/load-tests/**`, `docs/reports/load-tests/**`, `backend/tests/HotelSaas.WebApi.Tests/Security/**`, `backend/tests/HotelSaas.Application.Tests/{Reports,Invoices,Guest}/**`

- **Tiêu chí nghiệm thu (Definition of Done - An):**
  1. Waves 1-8 đã được push lên `origin/develop`, merge vào `main` và deploy sống trên `https://luxustay.duckdns.org` (`/health/ready` trả `200`).
  2. CI `gitleaks` ở trạng thái blocking (`continue-on-error: false`), `ci-status` kiểm tra đủ `needs.security.result`, có quét dependency CVE (`dotnet list --vulnerable` và `npm audit`).
  3. Unit/Pipeline tests chứng minh: đăng nhập sai 5 lần liên tiếp bị khóa (`401`/`423` hoặc thông báo khóa); request vượt ngưỡng Rate Limit nhận HTTP `429`; `GetPrintableInvoice` từ chối mở PII bằng `ConfirmationCode` 6 ký tự; `AuditLogsController` từ chối user thiếu quyền `AUDIT_LOGS:Read` với `403`; `/booking/profile` chuyển hướng sang `/login` khi chưa đăng nhập.
  4. Gọi `/api/ai/chat`, `/api/ai/concierge`, `/api/ai/smart-search` qua Angular dev proxy và `prod-server.js` đều đi thẳng về `.NET` backend (không 404, không trả dữ liệu khách sạn giả); log AI ghi đúng tên model thực tế hoặc `"rule-fallback"`.
  5. Không commit bất kỳ `GEMINI_API_KEY` hay secret thật nào lên Git; `docs/README.md` hiển thị đúng tên GVHD `ThS. Huỳnh Xuân Phụng` và bộ 34 tỉnh/thành.

- **Lệnh kiểm chứng (An):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Auth|FullyQualifiedName~Ai|FullyQualifiedName~Print|FullyQualifiedName~LocationsAndAiChat"
  npm --prefix frontend run build
  npm --prefix frontend test -- --watch=false --include="src/app/app.routes.spec.ts"
  ```

---

### 3.2. Nguyễn Khôi Nguyên (`24TX810011` - B2B Invoices, Tối ưu Báo cáo SQL & k6 Staging Load/Stress)

- **Nhánh Git:** `feature/nguyen-week7-invoices-reports-k6` (rẽ từ `develop` sau Bước 0)
- **Nhiệm vụ chi tiết:**
  1. **Xây dựng `InvoicesController` B2B & Tab Sổ cái Hóa đơn (Không đụng EF Migration):**
     - Tạo các CQRS Queries/Commands trong `backend/src/HotelSaas.Application/Invoices/**` *(tạo mới)* và `backend/src/HotelSaas.WebApi/Controllers/InvoicesController.cs` *(tạo mới)*:
       * `GetInvoicesQuery`: danh sách hóa đơn phân trang, lọc theo `PropertyId`, `Status`, khoảng ngày, từ khóa (`InvoiceNumber`, `GuestName`, `ConfirmationCode`).
       * `GetInvoiceByIdQuery`: chi tiết hóa đơn kèm danh sách `InvoiceItems` và thông tin thanh toán liên quan.
       * `GetMonthlyArSummaryQuery`: tổng hợp công nợ phải thu theo tháng (Tổng giá trị xuất, Đã thu, Còn nợ, Số hóa đơn quá hạn/chưa thanh toán đủ).
       * `IssueOfficialInvoiceCommand` + `AbstractValidator`: phát hành hóa đơn chính thức từ `Reservation` đã Checkout/xác nhận thanh toán (tái sử dụng `DbSet<Invoice>` và `DbSet<InvoiceItem>` có sẵn trong `IApplicationDbContext`, không sửa `ApplicationDbContext.cs`).
     - Gắn chặt `[RequirePermission("INVOICES", ...)]` và kiểm tra phạm vi Tenant/Property.
     - Tạo `frontend/src/app/core/models/invoice.model.ts` *(tạo mới)*, `frontend/src/app/core/services/invoice.service.ts` *(tạo mới)* và component `InvoiceLedgerComponent` *(tạo mới)* (Standalone + `ChangeDetectionStrategy.OnPush` + Angular Signals + `VndCurrencyPipe` + `BusinessDatePipe`) gắn thành tab chuyên biệt bên trong `frontend/src/app/features/reports/reports.page.ts`, liên kết trực tiếp tới `/print/invoice/:id` và nút xuất PDF QR.
  2. **Tối ưu SQL `GetRevenueSummaryQueryHandler.cs` & Thêm `GET /api/reports/ai-summary`:**
     - Tối ưu `backend/src/HotelSaas.Application/Reports/Queries/GetRevenueSummary/GetRevenueSummaryQueryHandler.cs`: thay `.ToListAsync()` kéo toàn bộ bản ghi thô về C# RAM bằng các truy vấn tổng hợp trực tiếp trên PostgreSQL (`GroupBy`, `Sum`, `Count`). Giữ nguyên signature constructor `(IApplicationDbContext, ICurrentUserContext)` để không làm gãy `ReportsAndAiSecurityTests.cs`.
     - Thêm endpoint `GET /api/reports/ai-summary` vào `ReportsController.cs` + `Application/Reports/Queries/GetAiRevenueSummary/**` *(tạo mới)*: tổng hợp chỉ số kinh doanh thật (Doanh thu, ADR, RevPAR, Occupancy, xu hướng tăng/giảm so với kỳ trước) thành bản tóm tắt tiếng Việt cho người quản lý. Thiết kế phần tổng hợp số liệu chạy độc lập với `IGeminiAiClient` để compile song song bình thường; sau bước merge nhánh An ở Tích hợp sẽ có thể tiêm tùy chọn `IGeminiAiClient` nếu cần làm mượt câu chữ.
     - Hiển thị thẻ/panel "Tóm tắt phân tích báo cáo" trong `reports.page.ts` có trạng thái loading và xử lý lỗi rõ ràng (không fallback số liệu giả).
  3. **Bổ sung `public-search.k6.js` *(tạo mới)* & Chạy Full `load` (50 VUs) + `stress` (100 VUs) trên Live Staging VPS:**
     - Tạo `scripts/load-tests/public-search.k6.js` *(tạo mới)* mô phỏng khách tìm kiếm OTA theo 34 tỉnh thành (`GET /api/locations/provinces`, `GET /api/public/properties`), hỗ trợ `TEST_TIER=smoke|load|stress`, cập nhật `scripts/load-tests/run-load-tests.sh` (và `.ps1` nếu có).
     - Sau khi An hoàn tất deploy Waves 1-8 lên `https://luxustay.duckdns.org`, chạy thật `TEST_TIER=load` (50 VUs) và `TEST_TIER=stress` (100 VUs) cho SignalR, VNPay IPN và Public Search nhắm thẳng vào VPS Staging.
     - Lưu các file JSON `--summary-export` (đã loại bỏ hoàn toàn JWT/secret nếu có) và báo cáo đối chiếu Before/After (so với kết quả local smoke Tuần 06 và trước/sau tối ưu SQL `GroupBy`) vào `docs/reports/load-tests/`.

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
  - `docs/reports/BAO-CAO-TUAN-7-NGUYEN-KHOI-NGUYEN-24TX810011.md` *(tạo mới)*

- **`FORBIDDEN FILES` (Nguyên):**
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`, `backend/src/HotelSaas.Infrastructure/Migrations/**`, `backend/src/HotelSaas.Domain/Entities/**`
  - `backend/src/HotelSaas.WebApi/Program.cs`, `backend/src/HotelSaas.Application/Ai/**`, `backend/src/HotelSaas.Application/Auth/**`, `backend/src/HotelSaas.Application/Print/**`, `backend/src/HotelSaas.Application/Guests/**`
  - `frontend/src/app/app.routes.ts`, `frontend/package.json`, `frontend/src/app/features/{housekeeping,guests}/**`, `backend/tests/HotelSaas.WebApi.Tests/**`
  - Mọi file trong `ALLOWED FILES` của An và Tân.

- **Tiêu chí nghiệm thu (Definition of Done - Nguyên):**
  1. `InvoicesController` cung cấp đủ 4 endpoint (`GET /api/invoices`, `GET /api/invoices/{id}`, `GET /api/invoices/ar-summary`, `POST /api/invoices/issue`), bảo vệ bởi `[RequirePermission("INVOICES", ...)]`, có unit tests trong `Application.Tests/Invoices/` *(tạo mới)*.
  2. Tab Sổ cái hóa đơn trong `features/reports/` dùng `OnPush`, Angular Signals, không dùng `any`, xuất dữ liệu công nợ chính xác và mở được trang in hóa đơn `/print/invoice/:id`.
  3. `GetRevenueSummaryQueryHandler.cs` không còn `.ToListAsync()` tải nguyên danh sách `Reservations`/`Payments` thô để sum trên RAM; `GET /api/reports/ai-summary` trả về tóm tắt hợp lệ từ số liệu thực; unit tests `Application.Tests/Reports/` và `reports.page.spec.ts` PASS 100%.
  4. Có file `scripts/load-tests/public-search.k6.js` *(tạo mới)* và bộ kết quả thực tế từ VPS Staging `https://luxustay.duckdns.org` cho `load` (50 VUs) và `stress` (100 VUs) lưu tại `docs/reports/load-tests/` kèm bảng phân tích P50/P95/P99 và tỷ lệ lỗi thực tế.

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

- **Nhánh Git:** `feature/tan-week7-playwright-housekeeping-crm` (rẽ từ `develop` sau Bước 0)
- **Nhiệm vụ chi tiết:**
  1. **Khởi tạo Playwright E2E & Tự động hóa 10 Luồng Cốt Lõi:**
     - Cài đặt `@playwright/test` vào `frontend/package.json` (`package-lock.json`), cấu hình `frontend/playwright.config.ts` *(tạo mới)* (hỗ trợ chạy nhắm vào `BASE_URL` local hoặc Staging `https://luxustay.duckdns.org`, lưu trace/screenshot khi fail).
     - Xây dựng bộ test trong `frontend/e2e/*.spec.ts` *(tạo mới)* bao phủ 10 luồng chính:
       1. Tìm kiếm B2C theo 34 tỉnh/thành & bộ lọc thông minh (`/booking`).
       2. Xem chi tiết cơ sở lưu trú & chọn phòng trống.
       3. Tạo đơn giữ phòng 15 phút + áp mã khuyến mãi (`/booking/hold`).
       4. Xử lý kết quả thanh toán VNPay return / trang tra cứu trạng thái đơn (`/booking/vnpay-return`, `/booking/status/:token`).
       5. Đăng nhập PMS & kiểm tra bền vững ngữ cảnh chuỗi HQ khi nhấn F5 reload.
       6. Nghiệp vụ Lễ tân: Walk-in / Check-in / Check-out trên sơ đồ phòng.
       7. Nhân viên buồng phòng tự nhận task dọn phòng (`housekeeping` self-claim) và đổi trạng thái phòng.
       8. Phê duyệt và xác nhận chi hoàn tiền D23 (`/payments`).
       9. Quản trị SuperAdmin tại `/platform-users` và `/platform-tenants`.
       10. Kiểm chứng giao diện / guard chặn truy cập chéo chi nhánh (HTTP 403 / chuyển hướng bảo vệ).
  2. **Nối SignalR Realtime Push Trực Tiếp Vào `housekeeping.page.ts`:**
     - Inject `NotificationService` vào `frontend/src/app/features/housekeeping/housekeeping.page.ts`, lắng nghe luồng sự kiện `ReceiveHousekeepingAlert` và `ReceiveReservationStatusUpdated` để tự động làm mới hàng đợi task và trạng thái phòng ngay khi có biến động từ Check-out/Lễ tân.
     - Giữ fallback polling 10 giây (`setInterval`) chỉ hoạt động khi kết nối SignalR đang ngắt hoặc chưa sẵn sàng; cập nhật `housekeeping.page.spec.ts`.
  3. **Mở rộng Ma Trận Test HTTP E2E Âm Tính RBAC (`RbacPermissionMatrixE2ETests.cs` *(tạo mới)*):**
     - Tạo `backend/tests/HotelSaas.WebApi.Tests/Security/RbacPermissionMatrixE2ETests.cs` *(tạo mới)* đi qua `WebApplicationFactory<Program>` + `JwtService` thật + PostgreSQL test DB thật (không mock `ICurrentTenantService` / `ICurrentPropertyService`).
     - Kiểm chứng mã HTTP `403 Forbidden` (và `401` khi ẩn danh) phủ đủ các `PermissionFunction` codes trong `SeedData.cs` (19 codes: `DASHBOARD`, `PROPERTIES`, `ROOMS`, `ROOM_TYPES`, `RESERVATIONS`, `GUESTS`, `CHECK_IN_OUT`, `HOUSEKEEPING`, `PAYMENTS`, `INVOICES`, `REPORTS`, `STAFF`, `ROLES`, `SETTINGS`, `SUBSCRIPTIONS`, `PROMOTIONS`, `REVIEWS`, `AI_FEATURES`, `AUDIT_LOGS`) đối chiếu theo 6 vai trò: `HOUSEKEEPER`, `RECEPTIONIST`, `MANAGER`, `OWNER`, `SUPER_ADMIN` và `Customer`.
  4. **Sửa Lỗi Guest CRM Không Cần Migration DB:**
     - `GetGuestDirectoryQuery.cs` & `GetGuestHistoryQuery.cs`: bỏ điều kiện lọc cứng `!string.IsNullOrWhiteSpace(r.GuestPhone)` làm mất khách đặt phòng không có SĐT; triển khai khóa gom nhóm dự phòng (fallback) theo `GuestEmail` chuẩn hóa (chữ thường, trim) hoặc tổ hợp `GuestName` + `GuestUserId`/`ReservationId`, đồng thời hỗ trợ tra cứu lịch sử khách không có SĐT qua `GuestsController.cs` & `guest.service.ts`.
     - `ReservationSnapshot.cs`, `UpdateGuestNotesCommand.cs`, `UpdateGuestNotesCommandValidator.cs`, `guest.model.ts`, `guests.page.ts`: bổ sung thuộc tính `IsVip` (manual override) và `IsBlacklisted` vào `ReservationSnapshot` JSON (`Reservation.Notes`), ghi nhận và đọc lại chính xác trong `GetGuestDirectoryQuery` / `GetGuestHistoryQuery` (thay giá trị hardcode `IsBlacklisted = false`), hiển thị badge Blacklist/VIP rõ ràng trên `guests.page.ts`.
     - Viết unit tests kiểm chứng tại `backend/tests/HotelSaas.Application.Tests/Guest/GuestDirectoryAndNotesTests.cs` *(tạo mới trong thư mục `Guest/` có sẵn)*.

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
  - `docs/reports/BAO-CAO-TUAN-7-TRAN-TRONG-TAN-24TX810025.md` *(tạo mới)*

- **`FORBIDDEN FILES` (Tân):**
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`, `backend/src/HotelSaas.Infrastructure/Migrations/**`, `backend/src/HotelSaas.Domain/Entities/**`
  - `backend/src/HotelSaas.WebApi/Program.cs`, `.github/workflows/**`, `frontend/src/app/app.routes.ts`
  - `backend/src/HotelSaas.Application/{Auth,Ai,Print,Invoices,Reports}/**`, `backend/src/HotelSaas.WebApi/Controllers/{AuditLogs,Invoices,Reports}Controller.cs`
  - `frontend/src/app/features/reports/**`, `scripts/load-tests/**`, `docs/reports/load-tests/**`
  - Mọi file trong `ALLOWED FILES` của An và Nguyên.

- **Tiêu chí nghiệm thu (Definition of Done - Tân):**
  1. Chạy `npx --prefix frontend playwright test` (đối với bộ test đã cấu hình) thực thi được đủ 10 kịch bản E2E cốt lõi, có cấu hình `playwright.config.ts` sạch sẽ và hướng dẫn biến môi trường rõ ràng.
  2. `housekeeping.page.ts` nhận sự kiện `ReceiveHousekeepingAlert` / `ReceiveReservationStatusUpdated` từ `NotificationService` và chỉ bật polling 10s khi SignalR chưa kết nối; `housekeeping.page.spec.ts` PASS 100%.
  3. `RbacPermissionMatrixE2ETests.cs` chạy qua `WebApplicationFactory<Program>` + PostgreSQL test DB thật, kiểm chứng đầy đủ các nhóm `PermissionFunction` với 6 vai trò và PASS 100%.
  4. `GetGuestDirectoryQuery` hiển thị đầy đủ cả khách không có SĐT; cập nhật `Notes`, `IsVip` và `IsBlacklisted` được lưu bền vững vào `ReservationSnapshot` JSON và phản ánh lại chính xác trên API + UI `guests.page.ts` (`GuestDirectoryAndNotesTests.cs` PASS 100%).

- **Lệnh kiểm chứng (Tân):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~CrossBranchSecurity|FullyQualifiedName~RbacPermissionMatrix|FullyQualifiedName~Guest"
  npm --prefix frontend run build
  npm --prefix frontend test -- --watch=false --include="src/app/features/{housekeeping,guests}/**/*.spec.ts"
  npx --prefix frontend playwright test
  ```

---

## 4. Trình Tự Tích Hợp, Phụ Thuộc & Lộ Trình Tuần 08

### 4.1. Thứ Tự Thực Thi & Merge (Zero Conflict)

```text
[Bước 0: An push develop (3ee927d) -> PR main -> Deploy Waves 1-8 lên Staging]
                                    │
         ┌──────────────────────────┼──────────────────────────┐ (Bước 1: Song song)
         ▼                          ▼                          ▼
[Nhánh An]                  [Nhánh Nguyên]             [Nhánh Tân]
Security + Gemini +         Invoices + SQL Report +    Playwright + SignalR HK +
1 EF Migration User         public-search.k6.js        RBAC Matrix + Guest CRM
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    ▼ (Bước 2: Thứ tự Merge vào develop)
         1. Merge An  --->  2. Merge Nguyên  --->  3. Merge Tân
                                    │
                                    ▼ (Bước 3: Nghiệm thu toàn hệ thống)
   [Full dotnet test + Vitest + Staging k6 Load/Stress + Staging Playwright E2E]
```

1. **Bước 0 (Bắt buộc trước tiên - An):**
   - Push 14 commit local (`55da312..3ee927d`) lên `origin/develop`.
   - Mở PR `develop` -> `main`, chạy CI/CD deploy bản Waves 1-8 lên VPS Staging `https://luxustay.duckdns.org`.
   - Chỉ sau bước này các nhánh `feature/*-week7-*` mới rẽ từ `develop` đồng bộ, và Nguyên mới có API Waves 1-8 thật trên Staging để chạy k6 `load`/`stress`.
2. **Bước 1 (Phát triển song song trên 3 nhánh độc lập):**
   - Các `ALLOWED FILES` giữa An, Nguyên, Tân không giao nhau ở bất kỳ đường dẫn nào.
   - Lưu ý tách phụ thuộc cho `GET /api/reports/ai-summary`: Trong lúc chạy song song, Nguyên cài đặt `GetAiRevenueSummaryQueryHandler` tổng hợp chỉ số KPI thực tế từ PostgreSQL mà chưa cần tham chiếu `IGeminiAiClient` của An, nên build trên nhánh Nguyên luôn xanh 100%.
3. **Bước 2 (Thứ tự Merge vào `develop`):**
   - **Thứ nhất - Merge An:** Đưa migration `AddUserLockoutFields`, RateLimiter, `IGeminiAiClient`/`GeminiAiClient`, Print/Audit/Route security và CI gate mới vào `develop`.
   - **Thứ hai - Merge Nguyên:** Rebase `develop`, kiểm tra tương thích với `Program.cs` (RateLimiter) và tùy chọn nối thêm `IGeminiAiClient` vào `GetAiRevenueSummaryQueryHandler` nếu cần, sau đó thực thi k6 `load` (50 VUs) và `stress` (100 VUs) trên Staging VPS.
   - **Thứ ba - Merge Tân:** Rebase `develop`, chạy toàn bộ Playwright E2E 10 luồng và `RbacPermissionMatrixE2ETests.cs` trên bản `develop` đã có đủ Security + Invoices + Gemini proxy mới. Sau khi nhánh Tân merge, An bổ sung job Playwright vào `.github/workflows/ci.yml` nếu cần gate tự động.
4. **Bước 3 (Kiểm định tổng hợp sau merge):**
   ```bash
   dotnet build backend/HotelSaas.slnx --verbosity minimal
   dotnet test backend/HotelSaas.slnx --no-build
   npm --prefix frontend run build
   npm --prefix frontend test -- --watch=false
   npx --prefix frontend playwright test
   ```

### 4.2. Dự Kiến Hạng Mục Chuyển Tiếp Sang Tuần 08

Các hạng mục có thay đổi schema DB lớn hoặc cần phạm vi toàn ứng dụng được cố định sang Tuần 08 để Tuần 07 tập trung đóng dứt điểm các nợ P0/P1:
- **Ngôn ngữ VI/EN (i18n):** Hiện `I18N_FILES_COUNT = 0`; Tuần 08 triển khai hệ thống dịch song ngữ và file từ điển toàn ứng dụng.
- **EF Migration `GuestProfile` & `CashierShift`:** Tách bảng hồ sơ khách độc lập (hỗ trợ CCCD/Passport chuẩn hóa) và bảng mở/đóng ca thu ngân kiểm đếm két tiền.
- **Quản trị thiết bị SmartLock cấp phòng:** Mở rộng từ cấp đặt phòng (`RegenerateSmartLockPin`/`RevokeSmartLockPin`) sang thực thể `SmartLockDevice`/`AccessLog` và màn hình quản trị khóa trên trang Phòng (theo phạm vi `G0-03` M5).
- **Đồng bộ tài liệu SDD:** Cập nhật `docs/sdd/06-api-design.md` khớp hoàn toàn với 29+ controller `/api/*` thực tế.

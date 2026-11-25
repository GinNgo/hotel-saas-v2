# BÁO CÁO TIẾN ĐỘ TUẦN 07 VÀ KHAI BÁO SỬ DỤNG AI
**Đề tài 578:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**Đơn vị:** Khoa CNTT - Bộ môn CNPM - Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE)  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)  
**Thời gian báo cáo:** 19/11/2026 - 22/11/2026  
**GitHub:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (`origin/develop` tại [`67210a5`](https://github.com/GinNgo/hotel-saas-v2/commit/67210a5) | `origin/main` hiện ở [`5cf0a78`](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78))

| Thành viên | MSSV | GitHub | Phần việc trong Tuần 07 (19/11 - 22/11) |
| :--- | :---: | :---: | :--- |
| **Ngô Võ Tuấn An** | `24TX810001` | [`GinNgo`](https://github.com/GinNgo) | Đóng lỗ hổng bảo mật đa tầng & CI, tích hợp SePay VietQR webhook, nút Google GIS, Governance (`/platform-users`, `/platform-tenants`), PMS buồng phòng/kiểm toán đêm, 34 tỉnh 2 cấp & UI Angular 22 (`55da312..67210a5`) |
| **Nguyễn Khôi Nguyên** | `24TX810011` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | Gỡ secret VNPay mặc định & token mock khỏi k6, cập nhật cấu hình tải SignalR/VNPay và siết kiểm tra ngữ cảnh `GetGroupAnalyticsQueryHandler` (PR #29: [`d86b069`](https://github.com/GinNgo/hotel-saas-v2/commit/d86b069)) |
| **Trần Trọng Tân** | `24TX810025` | [`trantrongtan096`](https://github.com/trantrongtan096) | Rà soát luồng nghiệp vụ buồng phòng/hoàn tiền và chốt phạm vi kiểm thử Playwright E2E, ma trận phân quyền RBAC cho Tuần 08 (chưa phát sinh commit mới lên `develop` tuần này) |

---

## 1. Công việc đã hoàn thành trong Tuần 07

### 1.1. Bảo mật, xác thực và cổng kiểm tra CI/CD
* **Xác thực & phân quyền:** Chuyển lưu trữ/đối chiếu `RefreshToken` sang mã băm SHA-256; xóa nhánh tự bỏ qua kiểm tra quyền của `SuperAdmin` trong `PermissionAuthorizationHandler.cs`; khắc phục IDOR tại `PublicController.CreateHold` (chỉ lấy `GuestUserId` từ JWT claims); bổ sung kiểm tra sở hữu chặt theo `UserId` cho 5 handler thuộc phân hệ Loyalty và hóa đơn khách hàng.
* **Khóa rò rỉ dữ liệu & giới hạn truy cập:** Sửa `GetPrintableInvoiceQueryHandler.cs` để không mở PII đầy đủ qua mã xác nhận ngắn 6 ký tự trên endpoint ẩn danh (chỉ chấp nhận phiên hợp lệ hoặc `LookupToken` chưa thu hồi còn hạn); bật `AddRateLimiter`/`UseRateLimiter` trong `Program.cs` (áp dụng trên AI, thanh toán, đặt phòng công khai, gói cước và webhook); siết kiểm tra phạm vi tenant/chi nhánh trong `NotificationHub.cs`.
* **Kiểm soát môi trường Production & CI:** Thêm cờ `allowDevPlatformBootstrap` trong `SeedData.cs` để không nạp tài khoản seed mật khẩu cố định ở Production; chặn `dev-mock-token` trên bản build `Release` và stub `IFirebaseAuthService` trong test CI ([`a035261`](https://github.com/GinNgo/hotel-saas-v2/commit/a035261)); bật chế độ chặn build khi lỗi của `gitleaks` trong `.github/workflows/ci.yml` kèm allowlist đúng cấu hình Firebase Web Client công khai và khóa session banner ([`67210a5`](https://github.com/GinNgo/hotel-saas-v2/commit/67210a5)).

### 1.2. Nghiệp vụ PMS và thanh toán tự động SePay VietQR
* **SePay VietQR Webhook ([`672dc28`](https://github.com/GinNgo/hotel-saas-v2/commit/672dc28), [`2d685e7`](https://github.com/GinNgo/hotel-saas-v2/commit/2d685e7)):** Xây dựng `WebhooksController.cs` (`POST /api/webhooks/sepay` kèm endpoint mô phỏng chỉ chạy ở `Development`), xác thực `Apikey` thời gian hằng số; triển khai `ProcessSepayWebhookCommand.cs` đối soát cọc đặt phòng và thanh toán gói cước (`GetSubscriptionVietQrQuery.cs`), kiểm tra số tiền, tài khoản nhận và chống xử lý trùng webhook, kèm `SepayWebhookTests.cs`.
* **Đăng nhập Google GIS & dọn mã cũ:** Chuyển nút đăng nhập Google sang Google Identity Services chuẩn trên `login.page.ts`, `register.page.ts` và `social-auth.service.ts`; gỡ bỏ mã Facebook auth không còn dùng.
* **Vận hành phòng, giá và kiểm toán đêm ([`fd905ec`](https://github.com/GinNgo/hotel-saas-v2/commit/fd905ec)):** Hoàn thiện phối hợp lễ tân - buồng phòng (`HousekeepingController.cs`), tự sinh `Invoice` khi check-out, quản lý khuyến mãi (`PromotionsController.cs`), đánh giá lưu trú (`ReviewsController.cs`), thuật toán tách bảng giá 4 trường hợp và tác vụ nền kiểm toán đêm (`NightAuditBackgroundService.cs`) tự xử lý `NoShow` và thu hồi mã PIN SmartLock.

### 1.3. Quản trị nền tảng SaaS và cổng khách hàng B2C
* **Phân hệ quản trị nền tảng:** Xây dựng màn hình và API quản trị người dùng/Admin (`/platform-users`, `PlatformUsersController.cs`), duyệt xuất bản và tạm ngưng doanh nghiệp (`PlatformTenantsController.cs`), thống kê MRR/ARR (`PlatformOverviewController.cs`) và banner hệ thống (`AdminBannersController.cs`).
* **Ủy quyền hỗ trợ, gói cước & Clean Architecture ([`7afcce9`](https://github.com/GinNgo/hotel-saas-v2/commit/7afcce9)):** Triển khai `SupportAccessGrant` (`TenantsController.cs`), `SubscriptionQuotaGuard.cs` giới hạn số chi nhánh/phòng/nhân sự theo gói, các luồng Quên/Đặt lại/Đổi mật khẩu và mời nhân sự qua email, nối 5 API cổng khách hàng (`GuestPortalController.cs`), tách `GetPlatformAuditLogsQuery` kèm `AuditPayloadSanitizer`, và tái cấu trúc `30` controller sạch `IApplicationDbContext`.

### 1.4. Chuẩn hóa 34 tỉnh/thành 2 cấp, giao diện Angular 22 và PR #29 (k6 & báo cáo)
* **Địa giới & giao diện ([`55da312`](https://github.com/GinNgo/hotel-saas-v2/commit/55da312), [`76a2c14`](https://github.com/GinNgo/hotel-saas-v2/commit/76a2c14), [`93d5132`](https://github.com/GinNgo/hotel-saas-v2/commit/93d5132)):** Chuẩn hóa `DMTinhThanh_2Cap.csv` (34 tỉnh/thành) và `DMXaPhuong_2Cap.csv` (10.060 đơn vị); khôi phục bộ ảnh PNG nội bộ cho 96 hạng phòng / 56 cơ sở; tách 3 shell giao diện, Dark Mode ca đêm, biểu đồ Chart.js, thống nhất `VndCurrencyPipe` và đưa `79/79` component Angular 22 về `OnPush`, `0` kiểu `any`.
* **Kiểm toán k6 & báo cáo (PR #29 - Nguyễn Khôi Nguyên, [`d86b069`](https://github.com/GinNgo/hotel-saas-v2/commit/d86b069) / [`b19f66c`](https://github.com/GinNgo/hotel-saas-v2/commit/b19f66c)):** Gỡ bỏ secret VNPay mặc định và `dev-mock-token` khỏi kịch bản k6, đồng bộ cấu hình phân tầng `smoke`/`load`/`stress` cho SignalR & VNPay, và siết `GetGroupAnalyticsQueryHandler.cs` từ chối khi thiếu ngữ cảnh property hoặc thiếu `IsTenantWide`.

---

## 2. Tình trạng kiểm thử và đồng bộ Staging

| Hạng mục | Phạm vi / Bằng chứng | Trạng thái |
| :--- | :--- | :---: |
| **Kiểm thử E2E & Frontend (`93d5132`)** | Ghi nhận tại `docs/reports/BAO-CAO-TRAI-NGHIEM-E2E-VA-QUAN-TRI-ADMIN.md` | BE build `0` lỗi, `19/19` test trọng tâm & `692/692` Vitest (`55` files) PASS; `29/29` ảnh `/booking` HTTP `200` |
| **Bộ test bảo mật & SePay mới** | `SepayWebhookTests.cs`, `GetPrintableInvoiceTests.cs`, `NotificationHubSecurityTests.cs` | Đã tích hợp trên `origin/develop @ 67210a5` |
| **Deploy Staging & full suite `67210a5`** | `origin/main` vẫn ở [`5cf0a78`](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78) (PR #28) | Chưa merge `develop` vào `main` để deploy VPS và chạy k6 `load`/`stress` (chuyển sang Bước 0 Tuần 08) |

---

## 3. Commit tiêu biểu trên GitHub (`origin/develop`)

* [`55da312`](https://github.com/GinNgo/hotel-saas-v2/commit/55da312) - Chuẩn hóa 34 tỉnh/thành 2 cấp, SHA-256 Refresh Token, bỏ SuperAdmin bypass, sửa Loyalty & Walk-in.
* [`fd905ec`](https://github.com/GinNgo/hotel-saas-v2/commit/fd905ec) - Triển khai `HousekeepingController`, hóa đơn Check-out, `PromotionsController`, `ReviewsController`, tách giá và `NightAuditBackgroundService`.
* [`7afcce9`](https://github.com/GinNgo/hotel-saas-v2/commit/7afcce9) - Xây dựng `PlatformTenantsController`, `PlatformOverviewController`, `SupportAccessGrant`, `SubscriptionQuotaGuard`, `GuestPortalController` và CQRS refactor.
* [`76a2c14`](https://github.com/GinNgo/hotel-saas-v2/commit/76a2c14) & [`93d5132`](https://github.com/GinNgo/hotel-saas-v2/commit/93d5132) - Design System 3 shell, `OnPush`/Signals, bộ ảnh PNG nội bộ, `PlatformUsersController` (`/platform-users`) & báo cáo E2E.
* [`672dc28`](https://github.com/GinNgo/hotel-saas-v2/commit/672dc28) & [`2d685e7`](https://github.com/GinNgo/hotel-saas-v2/commit/2d685e7) - Tích hợp SePay VietQR webhook (`SepayWebhookTests.cs`), Google GIS, `VndCurrencyPipe` và phối hợp lễ tân - buồng phòng.
* [`d86b069`](https://github.com/GinNgo/hotel-saas-v2/commit/d86b069) (PR #29 [`b19f66c`](https://github.com/GinNgo/hotel-saas-v2/commit/b19f66c)) - Siết `GetGroupAnalyticsQueryHandler` và gỡ secret/token giả khỏi k6.
* [`0125249`](https://github.com/GinNgo/hotel-saas-v2/commit/0125249), [`a035261`](https://github.com/GinNgo/hotel-saas-v2/commit/a035261) & [`67210a5`](https://github.com/GinNgo/hotel-saas-v2/commit/67210a5) - Chặn seed dev trên Production, khóa `NotificationHub` & in hóa đơn 6 ký tự, bật `RateLimiter`, chặn `dev-mock-token` bản Release và tinh chỉnh `.gitleaks.toml`.

---

## 4. Khai báo sử dụng AI (AI Disclosure)

* **Ngô Võ Tuấn An (Google Antigravity IDE - Gemini):** AI ban đầu để mở PII in hóa đơn qua mã xác nhận 6 ký tự, thiếu ràng buộc nhóm trong `NotificationHub`, nạp tài khoản seed mật khẩu cố định ở Production và khiến `gitleaks` báo nhầm cấu hình Firebase web công khai sau khi bật chặn lỗi CI. Sinh viên đã sửa `GetPrintableInvoiceQueryHandler.cs` theo `LookupToken` hợp lệ, siết `NotificationHub.cs`, thêm cờ `allowDevPlatformBootstrap`, chặn `dev-mock-token` trên Release kèm stub `IFirebaseAuthService` trong test CI, kiểm tra SePay webhook trùng/thiếu tiền và cập nhật đúng `.gitleaks.toml`.
* **Nguyễn Khôi Nguyên (OpenAI Codex / Google Antigravity IDE):** Script k6 trước đó còn fallback secret VNPay mặc định, dùng `dev-mock-token` và `GetGroupAnalyticsQueryHandler.cs` chưa chặn chặt trường hợp thiếu service ngữ cảnh. Sinh viên đã gỡ secret/token mock khỏi bộ k6, yêu cầu biến môi trường thực tế khi đo VNPay, siết kiểm tra thiếu ngữ cảnh và ghi nhận trung thực tình trạng chưa chạy tải lên Staging.
* **Trần Trọng Tân (Google Antigravity IDE):** Khi kiểm tra lại mã nguồn trên `develop`, phát hiện `housekeeping.page.ts` vẫn dùng `setInterval` thay vì nhận push từ `NotificationService`, `GetGuestDirectoryQuery.cs` bỏ sót khách không có SĐT và gán cứng `IsBlacklisted = false`, đồng thời chưa có bộ test Playwright E2E và ma trận âm tính 19 `PermissionFunction`. Sinh viên đã tổng hợp các điểm này thành nhiệm vụ thực thi cho Tuần 08.

---

## 5. Kế hoạch Tuần 08 (cắt nhánh từ `origin/develop @ 67210a5`)

| Thành viên | Nhiệm vụ trọng tâm Tuần 08 |
| :--- | :--- |
| **Ngô Võ Tuấn An** (`24TX810001`) | Bước 0 merge `develop` vào `main` deploy Staging & chạy full test suite; thêm khóa brute-force `BR-SEC03` (migration `AddUserLockoutFields`), `PlatformLegalOptions`, RBAC `AuditLogsController`, `authGuard` `/booking/profile`, tích hợp Gemini API thật (`IGeminiAiClient`) & sửa proxy AI, quét CVE trong CI |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | Xây dựng `InvoicesController` B2B & `InvoiceLedgerComponent` (không tạo migration), tối ưu `GetRevenueSummaryQueryHandler` sang SQL `GroupBy`/`Sum`, thêm `GET /api/reports/ai-summary`, tạo `public-search.k6.js` và chạy k6 `load`/`stress` lên Staging kèm kiểm chứng PDF QR & SePay VietQR |
| **Trần Trọng Tân** (`24TX810025`) | Cài Playwright E2E tự động hóa 10 luồng chính, nối SignalR push trực tiếp vào `housekeeping.page.ts`, xây dựng `RbacPermissionMatrixE2ETests.cs` phủ 19 `PermissionFunction` x 6 vai trò, sửa Guest CRM hỗ trợ khách thiếu SĐT và lưu `IsVip`/`IsBlacklisted` qua `ReservationSnapshot` |

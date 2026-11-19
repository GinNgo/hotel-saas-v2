# Backlog Triển Khai Theo Làn Sóng (Spec Kit Tasks)

> **Hệ thống:** Hotel SaaS Platform v2 (`.NET 10 + Angular 22 + PostgreSQL 17`)  
> **Baseline:** `develop` @ `c297b58` | **Đặc tả & Kế hoạch:** [`spec.md`](./spec.md) · [`plan.md`](./plan.md) · [`contracts/feature-ux-gap-matrix.md`](./contracts/feature-ux-gap-matrix.md)  
> **Quy tắc File Ownership:** Trong cùng một Wave, các task được phân tách theo **Allowed Files** rời nhau để có thể chạy song song an toàn mà không ghi đè mã nguồn của nhau.

---

## Gate G0 — Phê Duyệt Quyết Định Sản Phẩm & Kiến Trúc

> **Trạng thái kiểm định nhánh `feature/wave1-p0-and-34provinces-2cap` (2026-11-19):**
> - **Backend Build:** `dotnet build backend/HotelSaas.slnx --verbosity minimal` — **0 Warnings, 0 Errors**.
> - **Backend Non-DB Unit/Controller Suites:** `HotelSaas.Domain.Tests` (**1/1**), `HotelSaas.WebApi.Tests` non-DB (**92/92**), `HotelSaas.Application.Tests` non-DB targeted suites (**366/366**; broader filtered run **386/520** where all **134** failures and **18** WebApi DB failures were `SocketException` to offline PostgreSQL `127.0.0.1:5435` / Docker daemon — `[Collection("RealDatabaseTests")]` & `5435` pipeline tests require PostgreSQL/Docker running).
> - **Frontend Build & Unit Tests:** `npm --prefix frontend run build` (**0 Errors**), `npm --prefix frontend test -- --watch=false` (**53/53 files, 670/670 tests**).
> - **CSV 34 Tỉnh 2 Cấp (`G0-01`):** `DMTinhThanh_2Cap.csv` (**35 dòng** = header + **34** tỉnh/TP), `DMXaPhuong_2Cap.csv` (**10,060** phường/xã/đặc khu, **13** `đặc khu`, **0** `thị trấn`, 2 bản `docs/resources/` & `Infrastructure/Resources/Locations/` khớp SHA-256).

### `T001` — Chốt 5 Quyết Định Mở Còn Lại Tại Gate G0 (`G0-02`–`G0-06`; `G0-01` Đã Chốt 34 Tỉnh 2 Cấp) `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Priority:** `G0 Gate` | **Owner Role:** `architect` (+ PO Sign-off)
- **Dependencies:** None
- **Allowed Files:** `docs/design/platform-360-reassessment/spec.md`, `PROJECT.md`
- **Scope & Acceptance Criteria:**
  - `G0-01` **đã chốt `[APPROVED]`**: Chuẩn hóa 100% hệ thống theo **34 tỉnh/thành phố chính thức và mô hình 2 cấp (`Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`)**, bỏ danh mục 63 tỉnh cũ và cấp Quận/Huyện/Thị trấn.
  - Cần chốt tiếp 5 quyết định còn lại: (1) Ẩn hay giữ Facebook OAuth (`G0-02`), (2) Phạm vi M5 Smart Lock (`G0-03`), (3) Tỷ lệ cọc 30% & chính sách VNPay Refund (`G0-04`), (4) Phạm vi `SystemBanner`, `NotificationsController` & Đổi lịch đặt phòng (`G0-05`), (5) Trạng thái hợp lệ gửi Review (`G0-06`).
- **Verification Commands:**
  - Kiểm tra mục `6` trong `docs/design/platform-360-reassessment/spec.md` đã ghi nhận trạng thái `[APPROVED]` cho toàn bộ `G0-01`–`G0-06`.

---

## Wave 1 — Bảo Mật Nghiêm Trọng & Thông Luồng Cốt Lõi Bị Gãy (Gate G1 — P0 Blockers)

### `T002` — Vá Core Auth Security: Hash `RefreshTokens` SHA-256, Gỡ `SuperAdmin` Bypass & Khóa Mock Tokens `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-C03`, `GAP-C06`, `GAP-C20`, `GAP-A08` | **Owner Role:** `security` + `backend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs`
  - `backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Auth/Commands/RefreshToken/RefreshTokenCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Auth/Commands/RevokeToken/RevokeTokenCommandHandler.cs`
  - `backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs`
  - `backend/src/HotelSaas.Infrastructure/Services/GoogleAuthService.cs`
  - `backend/tests/**` (Auth & Authorization unit/integration tests)
- **Acceptance Criteria:**
  - Xóa nhánh `GlobalUserRole.SuperAdmin` auto-succeed khỏi `PermissionAuthorizationHandler.cs#L40-45`.
  - Lưu & tra cứu `RefreshToken.Token` bằng `SHA-256` hex hash trong `Login`, `RefreshToken`, `RevokeToken`.
  - Bọc `#if DEBUG` + fail-closed khi `_environment == null` trong `FirebaseAuthService.cs#L128-147` (khớp `GoogleAuthService.cs#L41-79`).
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Auth|FullyQualifiedName~Permission"
  ```

### `T003` — Khóa Cấu Hình Docker Production, Fail-Fast JWT Secret & Bảo Vệ `/metrics` `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-C07`, `GAP-C21` | **Owner Role:** `devops`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `docker/docker-compose.full.yml`
  - `docker-compose.staging.yml`
  - `backend/src/HotelSaas.WebApi/Program.cs`
  - `backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs`
- **Acceptance Criteria:**
  - Xóa fallback JWT secret tĩnh và `AllowCloudDevSeed: "true"` khỏi `docker/docker-compose.full.yml`; kiểm soát cờ seed trong `docker-compose.staging.yml`.
  - Bổ sung startup check trong `Program.cs` chặn khởi động Production nếu `JwtSettings:SecretKey` rỗng, `< 32` bytes hoặc trùng chuỗi mẫu.
  - Gỡ `/metrics` khỏi public allowlist ở `TenantPropertyContextMiddleware.cs#L340`, bảo vệ `/metrics` bằng token hoặc IP allowlist nội bộ.
- **Verification Commands:**
  ```bash
  docker compose -f docker/docker-compose.full.yml config
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  ```

### `T004` — Vá Global Query Filter 5 Handler Loyalty, Chặn IDOR Hóa Đơn & Sửa `GuestBookings` `RentalType` `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-A02`, `GAP-A03`, `GAP-A18`, `ENT-D03`, `ENT-D04` | **Owner Role:** `backend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs`
  - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyPointTransactions/GetMyPointTransactionsQueryHandler.cs`
  - `backend/src/HotelSaas.Application/Loyalty/Commands/EnrollPropertyMembership/EnrollPropertyMembershipCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs`
  - `backend/src/HotelSaas.Application/Loyalty/Queries/GetGuestInvoicePrintView/GetGuestInvoicePrintViewQueryHandler.cs`
  - `backend/src/HotelSaas.Application/Guest/Queries/GetGuestBookings/GetGuestBookingsQueryHandler.cs`
  - `backend/src/HotelSaas.Application/Guest/Queries/GetGuestBookingDetail/GetGuestBookingDetailQueryHandler.cs`
  - `backend/src/HotelSaas.WebApi/Controllers/GuestPortalController.cs`
  - `backend/tests/**` (GuestPortal & Loyalty isolation tests)
- **Acceptance Criteria:**
  - Thêm `.IgnoreQueryFilters()` kèm điều kiện sở hữu chặt theo `UserId == _userContext.UserId` cho cả 5 handler `Application/Loyalty` (loại bỏ match lỏng lẻo theo SĐT/Email chưa xác minh trên `GetMyInvoices`).
  - `GetGuestInvoicePrintViewQueryHandler` inject `ICurrentUserContext`, trả `403/404` nếu `GuestUserId != _userContext.UserId`; đồng thời đọc `TaxRatePercent` và MST thật từ `Property`/`Tenant`.
  - Đọc `RentalType` thực từ `ReservationSnapshotHelper.TryDeserialize(r.Notes)` thay vì `CheckInDate == CheckOutDate ? "Hourly" : "Daily"`.
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Loyalty|FullyQualifiedName~Guest"
  ```

### `T005` — Vá Bảo Mật `PrintDocumentsController` & Đồng Nhất Hợp Đồng DTO In Hóa Đơn / Voucher / Hợp Đồng `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-A03`, `GAP-A04`, `GAP-B04`, `GAP-C01`, `GAP-C02`, `ENT-D11`, `04-audit` | **Owner Role:** `backend` + `frontend` (Contract-locked PR)
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs`
  - `backend/src/HotelSaas.Application/Common/Interfaces/IPrintTokenService.cs` (mới)
  - `backend/src/HotelSaas.Infrastructure/Services/PrintTokenService.cs` (mới)
  - `frontend/src/app/core/models/print-document.model.ts`
  - `frontend/src/app/core/services/print-documents.service.ts`
  - `frontend/src/app/features/print/print-invoice.page.ts`
  - `frontend/src/app/features/print/print-voucher.page.ts`
  - `frontend/src/app/features/print/print-contract.page.ts`
- **Acceptance Criteria:**
  - Gỡ `[AllowAnonymous]` khỏi `GetPrintableInvoice` & `GetPrintableVoucher` (bắt buộc JWT ownership hoặc `PrintToken` ký HMAC có TTL gắn `ReservationId` + `LookupToken` đầy đủ; luôn mask PII trên link chia sẻ); `GetTemplateConfig` gắn `[RequirePermission("SETTINGS", Read)]` và cấm `IgnoreQueryFilters()` khi `TenantId == null`, lọc đúng `propertyId` query param, xóa fallback STK giả `"0988889999"` & hardcode tên cá nhân đại diện (`#L271` -> `IOptions<PlatformLegalOptions>`).
  - `GetPrintableInvoice` lọc `!TransactionRef.Contains("REFUND")` khi tính `paidAmount`.
  - Khớp 100% schema JSON giữa Backend và `PrintInvoicePage` / `PrintVoucherPage`; sửa `print-invoice.page.ts:200-203` chỉ đóng dấu "ĐÃ XÁC NHẬN THANH TOÁN" khi `balanceDue <= 0`, sửa `print-contract.page.ts:135` không hiện hash/dấu ký giả khi hợp đồng chưa ký.
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Print"
  npm --prefix frontend test -- --watch=false --include="src/app/features/print/**/*.spec.ts"
  npm --prefix frontend run build
  ```

### `T006` — Gỡ Mật Khẩu Demo/OTP Giả Khỏi Production UI & Siết Xác Minh Hủy/Đánh Giá B2C `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-A07`, `GAP-A08`, `GAP-C10`, `GAP-C20` | **Owner Role:** `frontend` + `backend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `frontend/src/app/features/auth/login/login.page.ts`
  - `frontend/src/app/features/auth/phone-otp-modal/phone-otp-modal.component.ts`
  - `frontend/src/app/core/services/social-auth.service.ts`
  - `backend/src/HotelSaas.Application/Public/Commands/CancelGuestBooking/CancelGuestBookingCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Reviews/Commands/SubmitGuestReview/SubmitGuestReviewCommand.cs`
- **Acceptance Criteria:**
  - Xóa `'Admin@123456'`, `'HotelDev@2026!'` và logic auto-retry khỏi `login.page.ts`; bọc Demo Quick-Login & nút test OTP (`phone-otp-modal`) dưới `@if (!isProduction)`; xóa sinh `dev-mock-google-token` khỏi `social-auth.service.ts`.
  - `CancelGuestBookingCommandHandler` bắt buộc `VerificationEmailOrPhone` khớp Email/SĐT khi người dùng chưa đăng nhập đúng chủ đơn (`GuestUserId`).
  - `SubmitGuestReviewCommand` chặn `ConfirmationCode` 6 ký tự (chỉ nhận `LookupToken` hợp lệ hoặc authenticated owner), chặn trạng thái `Confirmed` theo `G0-06`, và không tự tạo `User` với `PasswordHash = ""` (`UserId` nullable trên `GuestReview` hoặc liên kết hợp lệ).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~CancelGuest|FullyQualifiedName~Review"
  npm --prefix frontend run build
  ```

### `T007` — Nối Hoàn Chỉnh VNPay Return Callback & Khóa VietQR Fallback STK Giả `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-A05`, `GAP-A06`, `GAP-A16` | **Owner Role:** `frontend` + `backend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs`
  - `frontend/src/app/features/public-booking/booking-status.page.ts`
  - `frontend/src/app/features/public-booking/vnpay-return/vnpay-return.page.ts` (nếu tách route)
  - `frontend/src/app/app.routes.ts` (chỉ nhánh public `booking/*`)
- **Acceptance Criteria:**
  - Đọc toàn bộ `vnp_*` query params khi VNPay redirect về `/booking/status/:token` (và hỗ trợ `/booking/vnpay-return`), gọi `GET /api/public/payments/vnpay/return` xác thực HMAC và hiển thị thông báo kết quả giao dịch tức thì.
  - `PaymentsController.GenerateVietQr` truy vấn `PrintTemplateConfig` của `Property`/`Tenant` trong DB thay vì fallback `"970422 / 0345678910 / HOTEL SAAS RESORT"`; trả lỗi/trạng thái rõ nếu cơ sở chưa cấu hình ngân hàng.
  - Sửa copy trên `BookingStatusPage` phân biệt rạch ròi VNPay (Webhook IPN tự động) vs VietQR/BankTransfer (chờ thu ngân xác nhận); hỗ trợ giữ nguyên tab `BankTransfer` và hiển thị Smart Lock PIN ở trạng thái `Confirmed || CheckedIn` (khi đã cọc & `Active`).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Payment|FullyQualifiedName~Vnpay"
  npm --prefix frontend test -- --watch=false --include="src/app/features/public-booking/booking-status.page.spec.ts"
  npm --prefix frontend run build
  ```

### `T008` — Sửa Link 404 Chi Tiết Đơn Đặt Phòng Trong Hồ Sơ Khách Hàng B2C `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-A01` | **Owner Role:** `frontend`
- **Dependencies:** `T004`
- **Allowed Files:**
  - `frontend/src/app/features/public-booking/member/guest-profile.page.ts`
  - `frontend/src/app/features/public-booking/member/guest-booking-detail.page.ts` (mới, hoặc modal/tab chi tiết)
  - `frontend/src/app/core/services/guest-account.service.ts`
  - `frontend/src/app/core/models/guest-account.model.ts`
- **Acceptance Criteria:**
  - Bấm "Chi tiết" tại `guest-profile.page.ts:469,540` gọi `GET /api/guest/bookings/{id}` (hoặc điều hướng bằng `LookupToken` hợp lệ) hiển thị đầy đủ chi tiết đơn, lịch sử thanh toán, nút in voucher/hóa đơn — 0 còn lỗi 404.
- **Verification Commands:**
  ```bash
  npm --prefix frontend test -- --watch=false --include="src/app/features/public-booking/member/**/*.spec.ts"
  npm --prefix frontend run build
  ```

### `T009` — Xóa Bỏ `localStorage` RBAC Override & Đồng Bộ Role Exceptions / Permission Functions `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-B06`, `GAP-C04`, `GAP-C23` | **Owner Role:** `frontend` + `backend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `frontend/src/app/core/services/staff.service.ts`
  - `frontend/src/app/features/staff/roles-management.component.ts`
  - `frontend/src/app/features/staff/roles-management.utils.ts`
  - `backend/src/HotelSaas.Application/Staff/Commands/UpdateRole/UpdateRoleCommand.cs`
  - `backend/src/HotelSaas.Application/Staff/Commands/DeleteRole/DeleteRoleCommand.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs`
- **Acceptance Criteria:**
  - Xóa hoàn toàn `CUSTOM_ROLES_STORAGE_KEY`, `STAFF_ROLE_OVERRIDES_KEY`, và mọi `catchError` giả lập thành công trong `staff.service.ts`.
  - Khóa chỉnh sửa System Role trên UI (chỉ cho xem hoặc Clone thành Custom Role thật lưu PostgreSQL); lỗi API hiển thị trung thực.
  - Sửa `UpdateRoleCommand` & `DeleteRoleCommand` dùng `ConflictException`/`BadRequestException` chuẩn (tránh 500); bổ sung `AUDIT_LOGS`, `AI_FEATURES` vào `SeedData.cs`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Role|FullyQualifiedName~Staff"
  npm --prefix frontend test -- --watch=false --include="src/app/features/staff/**/*.spec.ts"
  npm --prefix frontend run build
  ```

### `T010` — Sửa Deadlock Walk-in Trên `/rooms` & Tách Entity `GuestProfile` Bảo Vệ `Reservation.Notes` `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-B03`, `GAP-B07`, `ENT-D14` | **Owner Role:** `database` + `backend` + `frontend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.Domain/Entities/GuestProfile.cs` (mới)
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/GuestProfileConfiguration.cs` (mới)
  - `backend/src/HotelSaas.Infrastructure/Persistence/Migrations/*_AddGuestProfileEntity.cs` (mới)
  - `backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Guests/**`
  - `frontend/src/app/features/rooms/rooms.page.ts`
  - `frontend/src/app/features/guests/guests.page.ts`
- **Acceptance Criteria:**
  - Thêm cờ `ImmediateCheckIn` atomic trong `CreateReservationCommandHandler` (validate Clean room -> tạo `CheckedIn` -> cấp `SmartLockPin` -> đổi room `Occupied`) để Walk-in trên `rooms.page.ts` không bị kẹt ở `Confirmed` và bỏ `walkin@hotel.internal`.
  - Tạo bảng `GuestProfiles` (`TenantId`, `PhoneNumber`, `Email`, `Notes`, `IsVip`, `IsBlacklisted`, `IdCardNumber`); `UpdateGuestNotesCommand` tuyệt đối không ghi đè `Reservation.Notes`; `GetGuestDirectoryQuery` giải mã `CustomerNotes`, không bỏ sót khách thiếu SĐT, nối `GuestLoyaltyMemberships` và lọc đúng theo `LoyaltyTier`/`IsVip`.
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Reservation|FullyQualifiedName~Guest"
  npm --prefix frontend run build
  ```

### `T011` — Đồng Bộ `AdminContracts` FE/BE (Chữ Ký Server-Side) & Gỡ `/ops-readiness` Khỏi Menu B2B `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]`
- **Gap Refs:** `GAP-B01`, `GAP-C09` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T001`, `T007` (tuần tự cho `app.routes.ts`)
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/AdminContractsController.cs`
  - `frontend/src/app/core/models/admin-contract.model.ts`
  - `frontend/src/app/core/services/admin-contracts.service.ts`
  - `frontend/src/app/features/admin-contracts/admin-contracts.page.ts`
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts` (nhóm menu `ops-readiness` & `SuperAdmin`)
  - `frontend/src/app/app.routes.ts` (chỉ route `ops-readiness` guard -> `platformAdminGuard`)
- **Acceptance Criteria:**
  - Đồng bộ kiểu `BillingCycle`, `Note`/`Notes`, trả `TenantContractDetailDto` đầy đủ sau `PATCH status`; tính `DigitalSignatureHash` SHA-256 phía Server; xóa thông tin đại diện mẫu (`Nguyễn Văn Toàn`...) trên form tạo.
  - Ẩn `/ops-readiness` khỏi `isOwnerOrManager()` trên `admin-layout.ts`, chuyển sang `platformAdminGuard` cho SuperAdmin nội bộ.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Contract"
  npm --prefix frontend run build
  ```

---

## Wave 2 — Hoàn Thiện Nghiệp Vụ PMS Cốt Lõi & Toàn Vẹn Doanh Thu (Gate G2)

### `T012` — Kích Hoạt `HousekeepingTask` End-to-End (`DbContext` -> Auto Check-out -> Mobile Task Queue) `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-B05`, `GAP-B22`, `ENT-D01` | **Owner Role:** `database` + `backend` + `frontend`
- **Dependencies:** `T010`
- **Allowed Files:**
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/HousekeepingTaskConfiguration.cs` (mới)
  - `backend/src/HotelSaas.Infrastructure/Persistence/Migrations/*_WireHousekeepingTasks.cs` (mới)
  - `backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Housekeeping/**` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/HousekeepingController.cs` (mới)
  - `frontend/src/app/core/services/housekeeping.service.ts` (mới)
  - `frontend/src/app/features/housekeeping/housekeeping.page.ts`
- **Acceptance Criteria:**
  - Khai báo `DbSet<HousekeepingTask>`; `CheckOutReservationCommandHandler` tự động tạo `HousekeepingTask` trạng thái `Pending` (`BR-HK01`).
  - `HousekeepingController` hỗ trợ List, Assign, Self-Claim (`BR-HK06`), Start, Complete, Inspect, Urgent priority gắn với check-in kế tiếp (`[RequirePermission("HOUSEKEEPING", ...)]`).
  - `housekeeping.page.ts` hiển thị hàng đợi nhiệm vụ + độ ưu tiên check-in gấp, nút chạm tối thiểu `44×44px` (`gap-2`).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Housekeeping|FullyQualifiedName~CheckOut"
  npm --prefix frontend run build
  ```

### `T013` — Sinh Bản Ghi `Invoice` + `InvoiceItem` Khi Check-out & Gắn Nút In Hóa Đơn Tại PMS `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-B04`, `ENT-D03` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T012` (chia sẻ `CheckOutReservationCommandHandler.cs` tuần tự sau T012)
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Payments/Commands/AddFolioItem/AddFolioItemCommandHandler.cs`
  - `frontend/src/app/features/reservations/reservations.page.ts`
  - `frontend/src/app/features/payments/payments.page.ts`
- **Acceptance Criteria:**
  - Khi Check-out thành công, sinh bản ghi `Invoice` và các `InvoiceItem` (tiền phòng, phụ thu, minibar/dịch vụ thêm, VAT% & ServiceFee% của `Property`, tổng đã trả trừ `REFUND`).
  - Gắn nút "In hóa đơn" (`/print/invoice/:id`) ngay tại Check-out confirmation modal, Reservation Detail modal (`reservations.page.ts`) và Folio detail (`payments.page.ts`).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~CheckOut|FullyQualifiedName~Folio"
  npm --prefix frontend run build
  ```

### `T014` — Xây Dựng Trọn Bộ `Promotion` (B2B Management + B2C Deals API + Quote Engine) `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-A14`, `GAP-B02`, `ENT-D02` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T004`
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs` (`DbSet<Promotion>`)
  - `backend/src/HotelSaas.Application/Promotions/**` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/PromotionsController.cs` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` (thêm `/api/public/promotions`)
  - `backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs`
  - `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs`
  - `frontend/src/app/features/promotions/**` (mới cho B2B `/promotions`)
  - `frontend/src/app/core/services/public-booking.service.ts` (`getPromotions()` thật)
  - `frontend/src/app/features/public-booking/promotions.page.ts`
  - `frontend/src/app/features/public-booking/components/flash-deals-banner/flash-deals-banner.component.ts`
- **Acceptance Criteria:**
  - B2B Owner/Manager tạo/sửa/tạm dừng mã `Promotion` với hạn mức `MinNights`, `MaxUsage`, `StartsAtUtc`/`EndsAtUtc`.
  - `PricingCalculator` & `CreateGuestHold` kiểm tra điều kiện và trừ đúng số tiền khuyến mãi, tăng `CurrentUsage` an toàn dưới lock.
  - `/booking/deals` & `FlashDealsBanner` lấy dữ liệu thật từ `/api/public/promotions`, xóa 100% mảng tĩnh & đồng hồ đếm ngược giả lúc nửa đêm; bấm áp dụng giữ nguyên `promoCode` qua URL sang tìm phòng/đặt phòng.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Promotion|FullyQualifiedName~Quote"
  npm --prefix frontend run build
  ```

### `T015` — Xây Dựng Quản Lý Đánh Giá B2B (`GuestReview`) & Đồng Bộ Trạng Thái Review B2C `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-A17`, `GAP-B17`, `ENT-D05` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T006`
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Reviews/**` (`GetPropertyReviewsForPms`, `ReplyGuestReview`, `ToggleReviewVisibility`)
  - `backend/src/HotelSaas.WebApi/Controllers/ReviewsController.cs` (mới)
  - `backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs`
  - `frontend/src/app/features/reviews/**` (mới)
  - `frontend/src/app/features/public-booking/booking-lookup.page.ts`
  - `frontend/src/app/features/public-booking/booking-status.page.ts` (phần state `HasReviewed` & `ExistingReview`)
- **Acceptance Criteria:**
  - Owner/Manager xem, lọc đánh giá theo sao, trả lời `OwnerReply` và ẩn/hiện `IsPublished` từ PMS `/reviews` (gắn `[RequirePermission("REVIEWS", ...)]`).
  - `GetGuestBookingByTokenQuery` trả `HasReviewed` và `ExistingReview`; tải lại trang `BookingStatusPage` không cho gửi lại trùng gây 400; `BookingLookupPage` gỡ thông báo sai `"chưa hỗ trợ đánh giá"`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Review"
  npm --prefix frontend run build
  ```

### `T016` — Sửa Thuật Toán Interval Splitting Bảng Giá & Hoàn Thiện AI Dynamic Pricing `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-B12`, `GAP-B13`, `ENT-D09` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T001`
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommandHandler.cs`
  - `backend/src/HotelSaas.WebApi/Controllers/AiController.cs`
  - `backend/src/HotelSaas.Application/AiPricing/**` (nếu tách MediatR)
  - `frontend/src/app/features/rates/rates.page.ts`
  - `frontend/src/app/core/services/ai.service.ts`
- **Acceptance Criteria:**
  - `CreateRoomTypeRateCommandHandler` xử lý chuẩn 4 trường hợp interval algebra cho mọi rate giao cắt (kể cả multi-overlap, exact head, head-trim và sinh `tailRate` khi mid-split).
  - Bỏ `[AllowAnonymous]` khỏi `GET /api/ai/dynamic-pricing/recommendations` (yêu cầu `AI_FEATURES:Read` + kiểm tra quyền chi nhánh); xóa logic đếm `Reservations` làm quota AI; thêm `POST /api/ai/dynamic-pricing/apply` (ghi `AiUsageLog` + `RoomTypeRateAudit`) và UI Gợi ý giá AI 1-click trên `rates.page.ts`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~RoomTypeRate|FullyQualifiedName~Ai"
  npm --prefix frontend run build
  ```

### `T017` — Phụ Thu 24/24, Auto Phụ Thu Check-out, Night Audit / `NoShow`, Rules Đặt Phòng & Chính Sách `POL-C03` `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-B11`, `GAP-B14`, `GAP-B15`, `GAP-C22` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T013`, `T014` (tuần tự cho `PricingCalculator.cs`)
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs` (phần `TrySeedStarterInventory` & `CheckInTime` 14:00)
  - `backend/src/HotelSaas.Application/Properties/Commands/UpdatePropertyPolicies/UpdatePropertyPoliciesCommand.cs`
  - `backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandValidator.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Reservations/Commands/MarkNoShow/**` (mới)
  - `backend/src/HotelSaas.Infrastructure/BackgroundServices/NightAuditBackgroundService.cs` (mới)
  - `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs`
  - `frontend/src/app/features/policies/policies.page.ts`
  - `frontend/src/app/features/reservations/reservations.page.ts` (nút `NoShow` & đồng bộ cọc 30%)
- **Acceptance Criteria:**
  - Phụ thu sớm/trễ bao phủ 24/24 (gồm rule `> 18:00 = +1 đêm`), không ném `422` khi nhận 04:00 hay trả 20:00; Check-out tự tính phụ thu chênh lệch thực tế (cho phép Manager override có Audit Log).
  - Hỗ trợ `MarkNoShowCommand` + `NightAuditBackgroundService`; validate `MaxOccupancy` và hạn đặt trước `365 ngày` ở `CreateReservation`; cảnh báo thu cọc Check-in; đồng bộ tỷ lệ cọc **30%** (`G0-04`) và cho cấu hình `TaxRatePercent`, `ServiceFeeRatePercent`, `POL-C03` trên `/policies`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Pricing|FullyQualifiedName~Reservation|FullyQualifiedName~NightAudit"
  npm --prefix frontend run build
  ```

### `T018` — Sửa Báo Cáo Doanh Thu (`Hourly`/Refund/`EnsurePropertyAccess`) & Lỗi Chi Nhánh `/properties` `[COMPLETED — Verified on feature/wave2-pms-revenue-integrity]`
- **Gap Refs:** `GAP-B08`, `GAP-B09`, `GAP-B10`, `GAP-B20`, `GAP-C12`, `GAP-C15` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T017` (tuần tự cho `CreatePropertyCommand.cs`)
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs` (chỉ exception `ConflictException` & `IsPublished = false` mặc định)
  - `backend/src/HotelSaas.Application/Properties/Commands/UpdateProperty/UpdatePropertyCommand.cs`
  - `frontend/src/app/features/reports/reports.page.ts`
  - `frontend/src/app/features/properties/properties.page.ts`
- **Acceptance Criteria:**
  - `ReportsController` loại trừ `PendingPayment` và `NoShow` khỏi doanh thu thực hiện, loại trừ `REFUND-COMPLETED-` khỏi `paymentBreakdown`, tính doanh thu/công suất cho đơn `Hourly` (`CheckInDate == CheckOutDate`), và ép `_currentUser.PropertyId` trong `EnsurePropertyAccess(null)` khi `!IsTenantWide` (cùng `ExportInvoicePdf`); `reports.page.ts` mặc định `activeTab = 'branch'` cho nhân sự chi nhánh.
  - `CreatePropertyCommand` ném `ConflictException` (`409`) khi trùng Code/Slug; `UpdatePropertyCommand` bỏ default `IsPublished = true`; `properties.page.ts` sửa hardcode `VN-SG`, bổ sung các trường Phone/Email/StarRating và nút toggle `IsPublished` (hoặc trạng thái chờ SuperAdmin duyệt theo `G0`).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Report|FullyQualifiedName~Propert"
  npm --prefix frontend run build
  ```

---

## Wave 3 — Cổng Platform Governance, Trải Nghiệm Khách Hàng & Clean Architecture (Gate G3)

### `T019` — Xây Dựng Platform Tenant Lifecycle, Duyệt `IsPublished`, Platform Overview & Tách Menu SuperAdmin
- **Gap Refs:** `GAP-C04`, `GAP-C05`, `GAP-C12`, `GAP-C22`, `GAP-C23` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T011`, `T018`
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/PlatformTenantsController.cs` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/PlatformOverviewController.cs` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/AdminPlansController.cs` (`TogglePlanActive` DTO)
  - `backend/src/HotelSaas.Application/Platform/**` (mới)
  - `frontend/src/app/features/platform-tenants/**` (mới)
  - `frontend/src/app/features/dashboard/dashboard.page.ts` (nâng cấp mode `PLATFORM` dùng `/api/platform/overview` + fix `pageSize: 100` ở mode `PROPERTY` bằng `/api/dashboard/summary`)
  - `frontend/src/app/features/admin-contracts/admin-contracts.page.ts` (thay ô nhập GUID bằng `<app-searchable-select>` Tenant)
  - `frontend/src/app/features/admin-plans/admin-plans.page.ts` (`toggleActive`)
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts` (gỡ 6 menu PMS 403 khỏi SuperAdmin, thêm `/tenants`, `/banners`, `/support`)
- **Acceptance Criteria:**
  - SuperAdmin xem danh sách Tenant, duyệt hồ sơ/xuất bản chi nhánh (`POST /api/platform/properties/{id}/publish-approval`), tạm khóa/mở khóa Tenant, xem sử dụng thực tế vs định mức gói, và theo dõi doanh thu SaaS thực thu (`SubscriptionPayments` MRR/ARR) + `AiUsageLogs` liên-Tenant.
  - Sidebar SuperAdmin không còn bất kỳ link PMS chi nhánh nào gây `403`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Platform|FullyQualifiedName~Plan"
  npm --prefix frontend run build
  ```

### `T020` — Triển Khai `SupportAccessGrant` (`SDD-05 D24`), VNPay SaaS Billing & `ISubscriptionQuotaGuard`
- **Gap Refs:** `GAP-B18`, `GAP-C08`, `GAP-C11`, `ENT-D07`, `ENT-D13` | **Owner Role:** `database` + `backend` + `frontend`
- **Dependencies:** `T019`
- **Allowed Files:**
  - `backend/src/HotelSaas.Domain/Entities/SupportAccessGrant.cs` (mới)
  - `backend/src/HotelSaas.Domain/Entities/SupportAuditLog.cs` (mới)
  - `backend/src/HotelSaas.Application/Common/Interfaces/ISubscriptionQuotaGuard.cs` (mới)
  - `backend/src/HotelSaas.Application/SupportGrants/**` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/TenantsController.cs` (mới — `/api/tenants/current/support-grants`)
  - `backend/src/HotelSaas.WebApi/Controllers/SubscriptionsController.cs`
  - `backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs`
  - `backend/src/HotelSaas.Application/Staff/Commands/CreateStaffMember/CreateStaffMemberCommand.cs`
  - `frontend/src/app/features/subscriptions/subscriptions.page.ts`
  - `frontend/src/app/features/support-grants/**` (mới)
- **Acceptance Criteria:**
  - Tenant Owner cấp/thu hồi `SupportAccessGrant` có thời hạn & scope (`READ_ONLY`/`DIAGNOSTIC`), chặn mọi thao tác hỗ trợ nếu thiếu/hết hạn/đã thu hồi; ghi nhận `SupportAuditLog`.
  - `SubscriptionsController` đọc giá/định mức thật từ bảng `SubscriptionPlans` trong DB; nâng cấp gói tạo `SubscriptionPayment` trạng thái `Pending` -> VNPay IPN xác nhận mới đổi `Tier`.
  - `ISubscriptionQuotaGuard` chặn tạo vượt `MaxProperties`/`MaxRooms`/`MaxStaff` với `403 ERR_QUOTA_EXCEEDED`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Support|FullyQualifiedName~Subscription|FullyQualifiedName~Quota"
  npm --prefix frontend run build
  ```

### `T021` — Kích Hoạt `SystemBanner` & `NotificationsController` REST Persistence (`SDD-06 #2.11`)
- **Gap Refs:** `ENT-D06`, `ENT-D08` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T001` (`G0-05`)
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs` (`DbSet<Notification>`)
  - `backend/src/HotelSaas.Application/Banners/**` (mới)
  - `backend/src/HotelSaas.Application/Notifications/**` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/AdminBannersController.cs` (mới)
  - `backend/src/HotelSaas.WebApi/Controllers/NotificationsController.cs` (mới)
  - `frontend/src/app/core/services/notification.service.ts`
  - `frontend/src/app/shared/components/system-banner-bar/**` (mới)
- **Acceptance Criteria:**
  - SuperAdmin CRUD `SystemBanner` (bảo trì/thông báo); Shell Public & PMS hiển thị banner đang hiệu lực.
  - `NotificationsController` cung cấp GET paginated, unread-count, mark read/read-all/delete từ PostgreSQL đồng bộ với `NotificationService`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Banner|FullyQualifiedName~Notification"
  npm --prefix frontend run build
  ```

### `T022` — Hoàn Thiện Chain HQ Context Persistence (F5), EmptyStates, `PropertyName` & Audit Log Search
- **Gap Refs:** `GAP-C16`, `GAP-C17`, `GAP-C21`, `GAP-C25` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T019`
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQueryHandler.cs` (`PropertyName` in `RoomDto`)
  - `backend/src/HotelSaas.Application/AuditLogs/Queries/GetAuditLogs/GetAuditLogsQueryHandler.cs` (`search` keyword)
  - `frontend/src/app/core/services/auth.service.ts` (`hotelsaas_context_mode`)
  - `frontend/src/app/features/reservations/reservations.page.ts` (HQ EmptyState)
  - `frontend/src/app/features/rooms/rooms.page.ts` (HQ guard hoặc `PropertyName` badge + branch picker)
  - `frontend/src/app/features/room-types/room-types.page.ts` (HQ guard hoặc `PropertyName` badge)
  - `frontend/src/app/features/housekeeping/housekeeping.page.ts` (chặn polling khi HQ chưa chọn chi nhánh)
  - `frontend/src/app/features/policies/policies.page.ts` & `rates.page.ts` & `payments.page.ts` (nút mở ContextSelectorDialog trên EmptyState)
  - `frontend/src/app/features/audit-logs/audit-logs.page.ts` (tìm keyword thường + đồng bộ guard `AUDIT_LOGS`)
- **Acceptance Criteria:**
  - Owner chọn `Chain HQ` rồi bấm F5 vẫn giữ nguyên chế độ HQ (`activePropertyId() === null`).
  - `/reservations` ở HQ hiển thị EmptyState yêu cầu chọn chi nhánh thay vì "Chưa có đơn đặt phòng nào"; `/rooms` và `/room-types` gắn nhãn `PropertyName` rõ ràng hoặc yêu cầu chọn chi nhánh trước khi tạo; `AuditLogs` hỗ trợ tìm từ khóa không phải UUID.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~AuditLog|FullyQualifiedName~Room"
  npm --prefix frontend run build
  ```

### `T023` — Hoàn Thiện Auth (`Forgot/Reset/ChangePassword`, Resend Email, Social Link) & Staff Invite Token
- **Gap Refs:** `GAP-A09`, `GAP-A18`, `GAP-B19`, `GAP-A23`, `ENT-D10` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T002`, `T006`, `T020` (tuần tự cho `CreateStaffMemberCommand.cs`)
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Auth/Commands/ForgotPassword/**` (mới)
  - `backend/src/HotelSaas.Application/Auth/Commands/ResetPassword/**` (mới)
  - `backend/src/HotelSaas.Application/Auth/Commands/ChangePassword/**` (mới)
  - `backend/src/HotelSaas.Application/Auth/Commands/ResendConfirmation/**` (mới)
  - `backend/src/HotelSaas.Application/Auth/Commands/LinkSocialAccount/**` & `UnlinkSocialAccount/**` (mới)
  - `backend/src/HotelSaas.Application/Staff/Commands/CreateStaffMember/CreateStaffMemberCommand.cs` (bỏ `"Staff@123456"` & silent Customer promotion)
  - `backend/src/HotelSaas.WebApi/Controllers/AuthController.cs`
  - `frontend/src/app/features/auth/forgot-password/**` & `reset-password/**` (mới)
  - `frontend/src/app/features/auth/login/login.page.ts` (sửa link `Quên mật khẩu?` từ `/booking/lookup` -> `/auth/forgot-password`; xử lý nút Facebook theo `G0-02`)
  - `frontend/src/app/features/auth/register/register.page.ts` (đồng bộ regex password mạnh)
  - `frontend/src/app/features/auth/confirm-email/confirm-email.page.ts` (nút Gửi lại email + sửa chữ `LuxeStay`)
  - `frontend/src/app/features/staff/staff.page.ts` (bỏ placeholder `"Staff@123456"`)
- **Acceptance Criteria:**
  - Hoàn tất flow `US-1.4` (Forgot/Reset Password qua email token hash có TTL, invalidate refresh tokens cũ), Resend confirmation email, Change password, và Link/Unlink `SocialIdentity`.
  - Tạo nhân viên dùng invitation token hoặc random password + `MustChangePassword`; không tự ý đổi `Customer` của hệ thống thành `TenantStaff` nếu chưa xác nhận.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Auth|FullyQualifiedName~Staff"
  npm --prefix frontend run build
  ```

### `T024` — Nối 5 API Guest Portal, Đổi Điểm/Promo tại Checkout, Smart Lock M5 Scope & Đổi Lịch Đặt Phòng
- **Gap Refs:** `GAP-A14`, `GAP-A15`, `GAP-A16`, `GAP-A17`, `GAP-A18`, `GAP-A23`, `GAP-A24`, `GAP-B16`, `ENT-D12` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T004`, `T008`, `T014`, `T023` (tuần tự cho `LoginCommandHandler.cs`)
- **Allowed Files:**
  - `backend/src/HotelSaas.Application/Auth/DTOs/UserDto.cs` & `LoginCommandHandler.cs` (`PhoneNumber`, `IsPhoneVerified`)
  - `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs` (`SpecialRequests`)
  - `backend/src/HotelSaas.Application/Public/Commands/RescheduleGuestBooking/**` (mới, theo `G0-05`)
  - `backend/src/HotelSaas.Application/Reservations/Commands/RegenerateSmartLockPin/**` & `RevokeSmartLockPin/**` (theo `G0-03`)
  - `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` & `ReservationsController.cs`
  - `frontend/src/app/features/public-booking/member/guest-profile.page.ts` (nối 5 API, sửa dead-end Email banner, bỏ avatar preset tên cá nhân)
  - `frontend/src/app/features/public-booking/booking-hold.page.ts` (UI nhập `PromoCode`, `PointsToRedeem`, `SpecialRequests`, `isPhoneVerified`)
  - `frontend/src/app/features/public-booking/booking-status.page.ts` (Reschedule UI, xóa `if(false)`, escape thay `[innerHTML]`)
- **Acceptance Criteria:**
  - `GuestProfilePage` hiển thị đầy đủ Hóa đơn, Hồ sơ VAT, Sổ cái điểm (`loyalty-ledger`), Đăng ký thẻ hội viên (`enroll`), Liên kết MXH và luồng xác thực bổ sung Email thật.
  - `BookingHoldPage` kiểm tra đúng `isPhoneVerified`, cho nhập `PromoCode`, thanh kéo/ô nhập `PointsToRedeem`, và ghi chú `SpecialRequests`.
  - Hỗ trợ `RegeneratePin`/`RevokePin` & sửa/đổi lịch đặt phòng dưới row-lock (theo `G0-03`/`G0-05`).
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Hold|FullyQualifiedName~Reschedule|FullyQualifiedName~SmartLock"
  npm --prefix frontend run build
  ```

### `T025` — Trung Thực Dữ Liệu Discovery/Detail, Chuẩn Hóa 34 Tỉnh 2 Cấp (`G0-01`), Bulk Search, Multi-Pin Map & AI Concierge
- **34-Province 2-Tier Deliverable (`G0-01`):** `[COMPLETED — Verified on feature/wave1-p0-and-34provinces-2cap]` (`DMTinhThanh_2Cap.csv` 34 tỉnh/TP, `DMXaPhuong_2Cap.csv` 10,060 phường/xã + 13 đặc khu + 0 thị trấn, `LocationLookupService` alias 63->34, `GetPublicPropertiesQuery`, `RealData34ProvincesSeeder`, `vietnam-provinces.data.ts`, `destination-suggestions.util.ts`, `popular-destinations.component.ts`, `partner-register.page.ts`, `properties.page.ts`, `booking-filter-bar.component.ts`, `google-map-picker.component.ts`; Discovery/Detail media/rating & AI overflow remain for Wave 3).
- **Gap Refs:** `GAP-A10`–`GAP-A13`, `GAP-A19`–`GAP-A21`, `GAP-B10` | **Owner Role:** `backend` + `frontend`
- **Dependencies:** `T016`, `T024` (tuần tự cho `PublicController.cs` & `AiController.cs`)
- **Allowed Files:**
  - `docs/resources/DMTinhThanh_2Cap.csv` & `docs/resources/DMXaPhuong_2Cap.csv`
  - `backend/src/HotelSaas.Infrastructure/Resources/Locations/*`
  - `backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs`
  - `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs` (gỡ `CuratedGalleriesByType`, gỡ `4.9` fallback, thêm pagination/price/guests/bulk availability)
  - `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` & `LocationsController.cs` (`/api/public/brands`, API chuẩn 34 tỉnh 2 cấp)
  - `backend/src/HotelSaas.Infrastructure/Services/LocationLookupService.cs`
  - `backend/src/HotelSaas.WebApi/Controllers/AiController.cs` (đọc `Property.CheckInTime` thật)
  - `frontend/src/app/core/utils/hotel-image.util.ts` & `frontend/src/app/core/services/room-gallery.service.ts`
  - `frontend/src/app/core/data/vietnam-provinces.data.ts` & `frontend/src/app/core/models/location.model.ts`
  - `frontend/src/app/features/auth/partner-register/partner-register.page.ts` (nhãn `"34 tỉnh/thành phố"`, `"Phường / Xã / Đặc khu"`)
  - `frontend/src/app/features/public-booking/booking.page.ts`, `explore-search.page.ts`, `property-detail.page.ts`, `tenant-brand.page.ts`, `destination-explore.page.ts`
  - `frontend/src/app/features/public-booking/components/**` (`popular-destinations`, `curated-bento-grid`, `trust-pillars`, `booking-filter-bar`, xóa `ai-concierge-widget`)
  - `frontend/src/app/shared/components/room-detail-modal/room-detail-modal.component.ts` & `ai-concierge-chat/ai-concierge-chat.component.ts`
- **Acceptance Criteria:**
  - Xóa 100% ảnh stock tự bơm, `Da Nang Ocean Suites` giả, `4.9` fallback, 5 sao cứng, `10% VAT` cứng, badge `"Smart Lock 24/7"` giả, và nhãn `"3.8 Flash"`.
  - Chuẩn hóa toàn bộ dữ liệu & API địa giới sang **34 tỉnh/thành phố chính thức và mô hình 2 cấp (`Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`)** theo `G0-01`: cập nhật CSV nhúng + `LocationLookupService`, xóa bỏ `VIETNAM_63_PROVINCES` và danh sách 34 tỉnh du lịch giả ở `vietnam-provinces.data.ts`, xóa cấp `"Quận"`/`"Thị trấn"` khỏi `RealData34ProvincesSeeder` & `partner-register.page.ts`, và ánh xạ địa danh/tỉnh cũ (Phú Quốc -> An Giang, Hội An -> Đà Nẵng, Vũng Tàu -> TP.HCM, Phan Thiết/Mũi Né -> Lâm Đồng, Quy Nhơn -> Gia Lai...) thành `TouristZone` + search aliases; viết migration/script quy đổi dữ liệu cơ sở đang lưu mã tỉnh cũ sang 34 mã tỉnh mới.
  - Map/gỡ `'Guesthouse'`; thực thi phân trang, lọc giá/số khách/phòng trống server-side; nâng cấp bản đồ multi-marker; sửa `ai-concierge-chat` không tràn mobile `375px`.
- **Verification Commands:**
  ```bash
  dotnet test backend/HotelSaas.slnx --no-build --filter "FullyQualifiedName~Public|FullyQualifiedName~Location"
  npm --prefix frontend run build
  ```

### `T026` — Chuẩn Hóa Clean Architecture: Tách 6 Fat Controllers, Bổ Sung 27 Validators & DB Indexes
- **Gap Refs:** `GAP-C13`, `GAP-C14`, `GAP-C19`, `GAP-C23`, `GAP-C24` | **Owner Role:** `backend` + `database`
- **Dependencies:** `T005`, `T018`, `T019`, `T020`, `T021`, `T022`, `T025`
- **Allowed Files:**
  - `backend/src/HotelSaas.WebApi/Controllers/{AdminPlansController,AdminContractsController,SubscriptionsController,ReportsController,PrintDocumentsController,AiController}.cs`
  - `backend/src/HotelSaas.Application/**` (MediatR handlers cho 6 controller trên + 27 `AbstractValidator<T>` mới)
  - `backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs` (gỡ substring matching)
  - `backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs` (gỡ `throw new NotImplementedException()`)
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/ReservationConfiguration.cs` & `UserConfiguration.cs`
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs` (`ISoftDeletable` filter)
  - `backend/src/HotelSaas.Infrastructure/Persistence/Migrations/*_AddUniqueIndexesAndSoftDelete.cs` (mới)
- **Acceptance Criteria:**
  - `0` Controller inject `IApplicationDbContext`; `49/49` Commands có `AbstractValidator<T>`.
  - EF Migration thêm `UX_User_Email`, `UX_User_Username`, `IX_Reservations_ConfirmationCode`; tinh gọn cặp FK thừa trên `Reservations`.
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build
  ```

---

## Wave 4 — UI/UX Pro Max Design System & Hiện Đại Hóa Angular 22 (Gate G4)

### `T027` — Triển Khai 3-Layer CSS Tokens, 3 Shells (`marketplace` / `pms-ops` / `governance`), Dark Mode & Typography
- **Gap Refs:** `04-audit` Phần IV, Mục 3, 5, 6 | `NFR-DS01`–`NFR-DS03` | **Owner Role:** `frontend` (UI Architect)
- **Dependencies:** `T019`
- **Allowed Files:**
  - `frontend/src/index.html` (thêm `Be Vietnam Pro`, xóa `Playfair Display` & `Material+Icons`)
  - `frontend/src/styles.css` (Layer 1–3 CSS vars, xóa `.fixed.inset-0 { z-index: 100 !important }`, `@media (prefers-reduced-motion: reduce)`)
  - `frontend/tailwind.config.js` (`darkMode: ['selector', '[data-theme="dark"]']`, alias token)
  - `frontend/src/app/app.config.ts` (`darkModeSelector: '[data-theme="dark"]'`)
  - `frontend/src/app/layouts/guest-layout/guest-layout.ts` (`[attr.data-shell]="'marketplace'"`, `routerLinkActive`, bỏ `VN • VND` giả nút)
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts` (`[attr.data-shell]="isSuperAdmin() ? 'governance' : 'pms-ops'"`, thêm skip-link, tăng touch target topbar `>=44px`, bỏ dead `showUnimplementedNotice()`)
  - `frontend/src/app/layouts/auth-layout/auth-layout.ts` (`dark:bg-slate-900`, thêm skip-link, `OnPush`, `takeUntilDestroyed`)
- **Acceptance Criteria:**
  - Áp dụng đồng nhất 3 shell tokens, bật Dark Mode thực cho PrimeNG Aura + Tailwind, thay `z-index: 100 !important` bằng thang `--z-*`, dọn hoàn toàn `Material+Icons` & `Playfair Display`, và đạt sàn chữ `>= 12px`.
- **Verification Commands:**
  ```bash
  npm --prefix frontend run build
  ```

### `T028` — Nâng Cấp Shared Registry (`OnPush`, Signals, Touch 44px) & Chuẩn Hóa Pipe `businessDate`
- **Gap Refs:** `GAP-B23`, `04-audit` Mục 2, 4, §3.1, §3.5 | `NFR-NG01`, `NFR-NG03` | **Owner Role:** `frontend`
- **Dependencies:** `T027`
- **Allowed Files:**
  - `frontend/src/app/shared/components/{breadcrumb,date-range-filter,empty-state,loading-spinner,page-header,pagination,skeleton-table,stat-card,status-badge}/*`
  - `frontend/src/app/shared/components/booking-date-picker/booking-date-picker.component.ts` (`for`/`id` cho 7 `<label>`, `[touchUI]`, thống nhất duration)
  - `frontend/src/app/features/payments/payments.page.ts` (sửa `formatUtcDateTimeString` -> `businessDateTime`, tìm Folio theo mã/số phòng, `OnPush`, `cdkTrapFocus`, `<app-page-header>`)
  - `frontend/src/app/features/audit-logs/audit-logs.page.ts` (sửa `<app-empty-state icon="...">` -> `iconClass=`, `<app-page-header>`)
  - `frontend/src/app/features/reservations/reservations.page.ts` (sửa 2 chỗ `<app-empty-state icon="...">` -> `iconClass=`)
- **Acceptance Criteria:**
  - `9/9` Shared components đạt `OnPush`, Signals `input()`/`output()`, `>= 44px` touch target (`PaginationComponent`, `BreadcrumbComponent`), không dùng dynamic Tailwind `bg-${forcedColor}-500` ở `StatusBadge`, sửa cả 3 binding `iconClass=` bị sai.
  - Sửa bug UTC ở `payments.page.ts:42-56` và dùng pipe `businessDate`/`businessDateTime` thống nhất toàn app.
- **Verification Commands:**
  ```bash
  npm --prefix frontend test -- --watch=false --include="src/app/shared/**/*.spec.ts"
  npm --prefix frontend run build
  ```

### `T029` — Sửa A11y, Touch `>=44px`, `<img>` CLS & `OnPush` Cho Guest Portal & Auth Pages
- **Gap Refs:** `GAP-A22`, `GAP-A24`, `04-audit` Mục 1–8 | `NFR-A11Y01`–`NFR-A11Y04` | **Owner Role:** `frontend`
- **Dependencies:** `T025`, `T027`, `T028`
- **Allowed Files:**
  - `frontend/src/app/app.ts`
  - `frontend/src/app/features/auth/{login,register,confirm-email,partner-register,phone-otp-modal,context-selector}/**`
  - `frontend/src/app/features/public-booking/**`
  - `frontend/src/app/features/forbidden/forbidden.page.ts`
- **Acceptance Criteria:**
  - Sửa toàn bộ icon-only `aria-label`, thay `<div>` clickable (`context-selector.dialog.ts:56,106`, `booking-status.page.ts:378`, `explore-search.page.ts:638`, `booking-filter-bar.component.ts:210` nested click), nâng nút sao & `-`/`+` khách lên `>= 44×44px`, thêm `role="dialog"` + `cdkTrapFocus` cho `PhoneOtpModal` + dynamic dial code.
  - Khai báo `width`/`height` & `loading="lazy"` cho toàn bộ `<img>` B2C; thay `raw hex` bằng token; gắn `OnPush` & `takeUntilDestroyed` cho `app.ts`, `login`, `register`, `forbidden`, `curated-bento-grid`, `hotelier-cta-banner`, `trust-pillars`.
- **Verification Commands:**
  ```bash
  npm --prefix frontend test -- --watch=false --include="src/app/features/auth/**/*.spec.ts"
  npm --prefix frontend test -- --watch=false --include="src/app/features/public-booking/**/*.spec.ts"
  npm --prefix frontend run build
  ```

### `T030` — Sửa A11y, Modal Focus Trap, Touch `>=44px`, Hover-Trap & Emoji Sweep Cho B2B PMS & Governance
- **Gap Refs:** `GAP-B21`, `GAP-B22`, `GAP-B24`, `GAP-C25`, `04-audit` Mục 1, 2, 4, 8 | **Owner Role:** `frontend`
- **Dependencies:** `T027`, `T028`
- **Allowed Files:**
  - `frontend/src/app/features/{properties,rooms,room-types,housekeeping,policies,rates,reservations,guests,staff,admin-plans,admin-contracts}/**`
  - *(Ghi chú: Tách tuần tự sau T028 để tránh xung đột file `reservations.page.ts`)*
- **Acceptance Criteria:**
  - Bổ sung `aria-label` cho toàn bộ nút icon-only PMS/Governance; thay `10+` `<div>` clickable (`housekeeping`, `rooms`, `reservations`) bằng `<button>`; triển khai `cdkTrapFocus` + `role="dialog"` + `aria-modal="true"` + `Esc` cho toàn bộ modal tự dựng; gỡ nút sửa `20×20px` hover-only ở `rooms.page.ts:312-319`.
  - Debounce search 300ms + phím tắt `/` & `Ctrl+K` + nút 1-click Thu đủ & Trả phòng + thêm Minibar trên `reservations.page.ts`; thay `window.confirm()` bằng `AlertService`; thay `77+` dòng emoji ở `13` tệp bằng PrimeIcons; giảm `animate-pulse` khỏi badge tĩnh; sử dụng `<app-form-field>` & `<app-page-header>` đồng bộ.
- **Verification Commands:**
  ```bash
  npm --prefix frontend run build
  ```

### `T031` — Tích Hợp Chart.js (`<app-chart-card>`), `<p-table>`, Virtual Scroll & Hoàn Tất `OnPush`/`.subscribe()`/`any` Sweep
- **Gap Refs:** `04-audit` Mục 3, 10, §3.1–3.3 | `NFR-NG01`, `NFR-NG02` | **Owner Role:** `frontend`
- **Dependencies:** `T028`, `T029`, `T030`
- **Allowed Files:**
  - `frontend/package.json` (`chart.js`)
  - `frontend/src/app/shared/components/chart-card/**` (mới)
  - `frontend/src/app/features/reports/reports.page.ts`, `dashboard/dashboard.page.ts`, `subscriptions/subscriptions.page.ts`
  - `frontend/src/app/core/services/*.ts` & `frontend/src/app/core/models/*.ts` (loại `113` `any`)
  - Các page PMS còn thiếu `OnPush` (`housekeeping`, `policies`, `rates`, `reservations`, `subscriptions`) và `132` `.subscribe()` trần
- **Acceptance Criteria:**
  - Thay toàn bộ CSS `<div>` bar trên `reports`, `dashboard`, `subscriptions` bằng `<app-chart-card>` dùng Chart.js (đủ 4 trạng thái `loading`/`error`/`empty`/`data` + bảng dữ liệu fallback accessible).
  - Chuyển các bảng dữ liệu chính sang PrimeNG `<p-table>` có `aria-sort` + stacked card mobile; áp dụng `cdk-virtual-scroll` cho Audit Logs, Timeline phòng & Gantt đặt phòng.
  - Đạt **70/70 (`100%`) `OnPush`**, loại bỏ toàn bộ `.subscribe()` trần gây rò rỉ và loại bỏ `113` `any` + `2` `$any()`.
- **Verification Commands:**
  ```bash
  npm --prefix frontend test -- --watch=false
  npm --prefix frontend run build
  ```

### `T032` — Hợp Nhất Cây Route (`/admin/*` & `/auth/*`), `UnsavedChangesGuard` & Kiểm Định Toàn Hệ Thống
- **Gap Refs:** `GAP-C18`, `04-audit` Mục 8, 9 | **Owner Role:** `frontend` + `qa`
- **Dependencies:** `T026`, `T031`
- **Allowed Files:**
  - `frontend/src/app/app.routes.ts`
  - `frontend/src/app/core/guards/unsaved-changes.guard.ts` (mới)
  - `frontend/src/app/core/utils/breadcrumb.utils.ts`
  - `frontend/src/app/features/print/print-contract.page.ts` (link `/contracts`)
  - `frontend/src/app/features/forbidden/forbidden.page.ts` (điều hướng động theo `globalRole`)
- **Acceptance Criteria:**
  - Hợp nhất duy nhất 1 cây route chuẩn (alias `/admin/*` và `/auth/*` dùng `redirectTo`), xóa các metadata sai tên `permissions: '...'`, gắn `AUDIT_LOGS` guard riêng cho `/audit-logs`, gắn `UnsavedChangesGuard` cho các form cấu hình/hợp đồng/đặt phòng dài.
  - Chạy nghiệm thu toàn bộ regression suite Backend + Frontend + kiểm tra giao diện thực tế tại `375px`, `768px`, `1024px`, `1440px` cả Light & Dark Mode.
- **Verification Commands:**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  dotnet test backend/HotelSaas.slnx --no-build
  npm --prefix frontend test -- --watch=false
  npm --prefix frontend run build
  ```

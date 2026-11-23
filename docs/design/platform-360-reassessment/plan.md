# Kế Hoạch Khắc Phục & Nâng Cấp Toàn Diện 360° (Implementation Plan)

> **Hệ thống:** Hotel SaaS Platform v2 (`.NET 10 + Angular 22 + PostgreSQL 17`)  
> **Baseline:** `develop` @ `c297b58` | **Đặc tả đầu vào:** [`spec.md`](./spec.md) & [`contracts/feature-ux-gap-matrix.md`](./contracts/feature-ux-gap-matrix.md)

---

## 1. Bối Cảnh Kỹ Thuật & Ràng Buộc Bắt Buộc (`AGENTS.md`)

Mọi thay đổi phát sinh từ bộ tài liệu tái đánh giá 360° phải tuân thủ tuyệt đối 5 nguyên tắc bất biến của repository:

1. **Clean Architecture 4 tầng (`AGENTS.md §1`):**
   - `Domain` không phụ thuộc ngoài; `Application` chứa toàn bộ CQRS Commands/Queries (`IRequest<T>`), FluentValidation (`AbstractValidator<T>`), và interfaces (`IApplicationDbContext`, `ISubscriptionQuotaGuard`, v.v.); `Infrastructure` triển khai EF Core, Migrations, Background Workers và External APIs; `WebApi` chỉ chứa **Thin Controllers** điều phối qua `ISender` (`_mediator`).
   - Toàn bộ **6 Fat Controllers** hiện inject `IApplicationDbContext` (`AdminPlans`, `AdminContracts`, `Subscriptions`, `Reports`, `PrintDocuments`, `Ai`) phải được tái cấu trúc về `ISender`.
2. **Cách ly Đa-Tenant Fail-Closed (`AGENTS.md §2`):**
   - Mọi thực thể nghiệp vụ thuộc Tenant/Property bắt buộc triển khai `ITenantScopedEntity` / `IPropertyScopedEntity` và chịu Global Query Filter tại `ApplicationDbContext`.
   - Mọi handler B2C cross-tenant (`Application/Guest`, `Application/Loyalty`, `Application/Public`) sử dụng `.IgnoreQueryFilters()` **bắt buộc** kèm điều kiện ownership tường minh (`UserId == _userContext.UserId` hoặc token bí mật đã xác thực).
   - Nghiêm cấm nhận `TenantId`/`PropertyId` tin cậy từ payload client nếu chưa đối chiếu với context của `ICurrentUserContext` hoặc `SupportAccessGrant` hợp lệ (`SDD-05 D24`).
3. **Angular 22 Standalone Signals & Shared Registry (`AGENTS.md §3`):**
   - 100% Standalone + `ChangeDetectionStrategy.OnPush`; dùng `signal()`/`computed()`/`input()`/`output()`; chấm dứt `.subscribe()` không teardown (`takeUntilDestroyed`); cấm `any` và cấm inject `HttpClient` trực tiếp trong component.
   - Bắt buộc tái sử dụng `<app-page-header>`, `<app-stat-card>`, `<app-status-badge>`, `<app-pagination>`, `<app-empty-state>`, `<app-form-field>`, và pipe `businessDate`/`businessDateTime`.
4. **Git-First & Zero-Secrets (`AGENTS.md §4, §6`):**
   - Đồng bộ `git fetch origin && git pull origin develop` trước khi rẽ nhánh `feature/...`.
   - Tuyệt đối không commit secret, connection string, fallback JWT key hay mật khẩu mẫu trong `appsettings`, `docker-compose`, hoặc bundle Angular.
5. **Tách Ranh Giới 3 Shell UI/UX Pro Max (`04-audit` Phần IV):**
   - Mọi component giao diện phải gắn token semantic qua `[data-shell="marketplace" | "pms-ops" | "governance"]`, đạt sàn chữ `12px`, `tabular-nums` cho số liệu, target chạm `>= 44px`, và WCAG 2.1 AA (`4.5:1`, `cdkTrapFocus`, `aria-label`).

---

## 2. Cơ Chế Kiểm Soát Theo Cổng (Execution Gates `G0–G4`)

| Gate | Điều kiện Mở Cổng (Entry Criteria) | Trọng tâm Thực thi | Tiêu chí Qua Cổng (Exit Criteria) |
| :---: | :--- | :--- | :--- |
| **G0** *(Product & Security Sign-off)* | User/PO xác nhận 5 quyết định mở còn lại `G0-02`–`G0-06` trong `spec.md` (**`G0-01` ĐÃ CHỐT**: chuẩn hóa 100% theo **34 tỉnh/thành 2 cấp `Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`**, bỏ 63 tỉnh cũ & Quận/Huyện/Thị trấn). | Không sửa runtime code trong G0; khóa API contracts & schema migrations dự kiến. | Toàn bộ `G0-01`–`G0-06` có quyết định bằng văn bản; không mở rộng scope ngoài danh sách đã duyệt. |
| **G1** *(Wave 1 — Security & Critical P0 Fixes)* | G0 đã chốt; nhánh làm việc đồng bộ từ `develop@c297b58`. | Vá toàn bộ lỗ hổng bảo mật P0 (`PrintDocuments`, `SuperAdmin` bypass, `RefreshToken` SHA-256, Docker/Login/OTP secrets, IDOR Hóa đơn) & sửa các luồng gãy sống còn (Guest Profile 404, Loyalty QueryFilter, Walk-in deadlock, Print DTOs, `StaffService` `localStorage`, `UpdateGuestNotes` JSON overwrite, VNPay return + VietQR, Cancel/Review verification, `AdminContracts` mismatch). | `dotnet test` (gồm security negative tests cross-tenant/IDOR/RBAC) & `npm run build` + `vitest` pass 100%; 0 lỗi P0 bảo mật còn mở. |
| **G2** *(Wave 2 — Core PMS & Revenue Integrity)* | G1 hoàn tất & pass regression. | Đưa `HousekeepingTask` vào hoạt động end-to-end; xây `Promotion` B2B+B2C+Quote; tự tạo `Invoice` lúc Check-out; kích hoạt `GuestReview` B2B; vá `CreateRoomTypeRate` 4-case split, `PricingCalculator` 24/24 surcharge & checkout auto-surcharge, `NightAudit`/`NoShow`, `ReportsController` `Hourly`/refund, `CreateProperty` 409 & policies, `AiController` apply & auth. | Toàn bộ test nghiệp vụ PMS (Walk-in, Check-out Invoice, Housekeeping SLA, Interval split, Reports financial integrity, Quota) pass 100%. |
| **G3** *(Wave 3 — Guest Self-Service, Governance & Clean Arch)* | G2 hoàn tất & schema migrations cho `GuestProfile`, `SupportAccessGrant`, Indexes đã review. | Xây `PlatformTenantsController` & Tenant Lifecycle UI; triển khai `SupportAccessGrant` + `SystemBanner` + `NotificationsController`; nối `Subscriptions` vào `SubscriptionPlans` + VNPay + `ISubscriptionQuotaGuard`; sửa Chain HQ UX & F5 persistence; triển khai `Forgot/Reset/Change Password`; nối 5 API Guest Portal + `PointsToRedeem` + Reschedule + Server pagination/bulk availability; refactor 6 Fat Controllers & 27 Validators + DB indexes. | Không còn controller nào inject `IApplicationDbContext`; 49/49 Command có Validator; SuperAdmin không còn 403 trên sidebar; Guest Portal đạt 100% end-to-end flow. |
| **G4** *(Wave 4 — UI/UX Pro Max & Angular 22 Modernization)* | G3 hoàn tất chức năng & API contracts ổn định. | Triển khai 3-Layer CSS Tokens & 3 Shells + Dark Mode; dẹp `Playfair Display`/`Material+Icons`; cài thư viện Chart + `<p-table>`; vá toàn bộ A11y (`55` `aria-label`, `14` clickable `div`, `17` `cdkTrapFocus`, skip-links), `262` touch `<44px`, `1,190` text `<12px`, `tabular-nums`, `23` `<img>` CLS; đẩy `OnPush` cho `24` components, teardown `132` `.subscribe()`, loại `113` `any`, hợp nhất 1 cây route Admin/Auth, dọn `77+` emoji & `businessDate` pipe. | 0 vi phạm `AGENTS.md §3` (`70/70` `OnPush`, 0 bare subscribe critical, 0 `any` ở DTO/components mới); Browser QA đạt tại `375/768/1024/1440px` cả Light & Dark Mode. |

---

## 3. Phân Rã Kiến Trúc & Ranh Giới Thay Đổi Theo Tầng

### 3.1. Backend (.NET 10 + PostgreSQL 17)
- **EF Core Migrations (Additive & Safe):**
  1. Migration 1 (Wave 1/2): Bổ sung `GuestProfiles`, kích hoạt `HousekeepingTasks` (đăng ký `DbSet` & FK), thêm `SupportAccessGrants` & `SupportAuditLogs`.
  2. Migration 2 (Wave 3): Thêm `UX_User_Email`, `UX_User_Username`, `IX_Reservations_ConfirmationCode`; rà soát cặp FK thừa trên `Reservations`; thêm cột `TokenHash` (hoặc chuyển đổi an toàn `RefreshTokens.Token` -> hash); chuẩn hóa `ISoftDeletable` (`IsDeleted`).
  - *Lưu ý:* Không chạy migration phá hủy dữ liệu cũ (`DropColumn`/`DropTable`) trên bảng đang có dữ liệu; mọi migration `RefreshToken` cần thu hồi sạch hoặc migrate hash an toàn.
- **Security & Auth Pipeline:**
  - `PermissionAuthorizationHandler`: Xóa nhánh `SuperAdmin` auto-succeed (`PermissionAuthorizationHandler.cs#L40-45`).
  - `TenantPropertyContextMiddleware`: Bắt buộc `SupportAccessGrant` (`X-Support-Grant-Id`) khi `SuperAdmin` hỗ trợ dữ liệu Tenant; khóa `/metrics` và chặn `/api/print/*` ẩn danh.
  - `PrintTokenService`: Tạo & xác thực HMAC-SHA256 token ngắn hạn (gắn `ReservationId`/`DocumentType`/`Expiry`) cho việc xem/in hóa đơn & voucher công khai mà không lộ qua UUID hay mã 6 ký tự.
- **Application Layer Hygiene:**
  - Thêm interface `ISubscriptionQuotaGuard`, chuyển logic từ 6 Fat Controllers sang Handlers mới trong `Application/AdminPlans`, `Application/AdminContracts`, `Application/Subscriptions`, `Application/Reports`, `Application/PrintDocuments`, `Application/Ai`.
  - Tạo đầy đủ `AbstractValidator<T>` cho 27 Commands còn thiếu để `ValidationBehavior` tự động trả `400 ValidationException` trước khi vào Handler.

### 3.2. Frontend (Angular 22 Standalone Signals)
- **Thứ tự Refactor An toàn:**
  1. **Không sửa đại trà cùng lúc:** Chia theo wave độc lập file sở hữu (`core/services/*`, `shared/*`, `layouts/*`, từng `features/*`).
  2. **Shared Controls & Tokens trước:** Thiết lập 3-Layer CSS Tokens trong `styles.css`, `tailwind.config.js`, `app.config.ts` và nâng cấp `9` shared components (`OnPush` + `44px` + sửa `StatusBadge` dynamic color + sửa `<app-empty-state>` bindings) trước khi áp vào các feature pages.
  3. **Hợp nhất Route Tree:** Giữ 1 cây route chuẩn (ví dụ `/...` cho PMS, `/platform/...` cho SuperAdmin, `/auth/...` hoặc `/login` thống nhất) và đặt `redirectTo` cho alias cũ để không gãy bookmark/deep-link hiện tại.
  4. **Charting & Table Upgrade:** Cài đặt `chart.js` (tương thích PrimeNG `<p-chart>`) kèm component bọc `<app-chart-card>` (bắt buộc đủ 4 state: loading/error/empty/data + bảng dữ liệu fallback `sr-only`/toggle cho WCAG).

---

## 4. Chiến Lược Kiểm Chứng & Cổng Chất Lượng (Verification Strategy & Quality Gates)

Mỗi task hoặc Wave chỉ được nghiệm thu khi pass đủ 4 tầng kiểm tra:

1. **Backend Build & Automated Tests (`.NET 10`):**
   ```bash
   dotnet build backend/HotelSaas.slnx --verbosity minimal
   dotnet test backend/HotelSaas.slnx --no-build
   ```
   - Yêu cầu: **0 Errors, 0 Warnings**; 100% unit & integration tests (gồm các test mới cho IDOR, Cross-Tenant, `IgnoreQueryFilters` Loyalty, SHA-256 RefreshToken, Walk-in Atomic Check-in, Invoice Checkout, Interval Split 4 cases, Quota Guard, và Negative Auth cases) pass hoàn toàn.
2. **Frontend Build & Vitest Specs (`Angular 22`):**
   ```bash
   npm --prefix frontend run build
   npm --prefix frontend test -- --watch=false
   ```
   - Hoặc chạy targeted spec trước trong lúc dev:
     `npm --prefix frontend test -- --watch=false --include='<relative-spec-path>'`
   - Yêu cầu: **0 Build Errors**, bundle Production không chứa mật khẩu demo hay mock fallback.
3. **Static Compliance & Security Scan:**
   - Xác minh bằng grep/AST: `0` Controller inject `IApplicationDbContext`; `49/49` Commands có Validator; `0` component thiếu `OnPush`; `0` bare `.subscribe()` trên component/layout chính; `0` `any` ở DTO/new code; `0` `window.confirm()`; `0` `localStorage` RBAC fallback; `0` emoji cấu trúc; `0` hardcoded demo passwords.
4. **Browser & Accessibility Manual/Automated QA (Wave 4):**
   - Kiểm tra thực tế tại **4 viewport** (`375px`, `768px`, `1024px`, `1440px`) + **zoom 200%** cho cả Light Mode và Dark Mode trên cả 3 Shell (`marketplace`, `pms-ops`, `governance`).
   - Kiểm tra điều hướng bàn phím 100% (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape` đóng modal & trả focus), focus ring rõ ràng, contrast ratio >= 4.5:1 trên màu thực tế, và `prefers-reduced-motion`.

---

## 5. Kế Hoạch Phục Hồi Rủi Ro (Rollback Plan)

1. **Cô lập theo Wave & Feature Branch:** Mỗi Wave tách thành các PR nhỏ theo miền (`security-print-auth`, `pms-walkin-housekeeping`, `governance-platform`, `design-system-shell`) có thể revert độc lập bằng `git revert <merge-commit>` mà không ảnh hưởng các phần đã ổn định.
2. **An toàn Schema Migration:** Mọi thay đổi DB là additive (tạo bảng/cột/index mới trước khi ngừng dùng luồng cũ). Nếu một tính năng mới gặp sự cố ở Staging, có thể rollback code ứng dụng mà schema vẫn tương thích ngược.
3. **Tương thích Route & API trong Giai đoạn Chuyển tiếp:**
   - Khi hợp nhất 2 cây route (`/admin/*` vs `/*`, `/auth/*` vs `/*`), giữ `redirectTo` tạm thời để link cũ trong email/bookmark không bị 404.
   - Khi thay đổi DTO (`PrintInvoiceDto`, `PrintVoucherDto`, `AdminContractDto`, `UserDto`), cập nhật đồng thời cả Backend và Frontend trong cùng 1 PR hợp đồng (Contract-locked PR) để tránh lệch schema giữa hai phía.
4. **Bảo vệ dữ liệu đang chạy (Zero Data Loss):** Trước khi chạy script chuẩn hóa `RefreshTokens` (hash SHA-256) hoặc di trú ghi chú CRM sang `GuestProfile`, không ghi đè hoặc xóa chuỗi cũ nếu chưa kiểm chứng parse thành công `ReservationSnapshot`.

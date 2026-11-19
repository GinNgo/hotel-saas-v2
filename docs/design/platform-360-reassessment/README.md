# Tái Đánh Giá Toàn Diện 360° & Bộ Đặc Tả Cải Tiến (Platform 360 Reassessment Spec Kit)

> **Hệ thống:** Hotel SaaS Platform v2 (`.NET 10 Clean Architecture + Angular 22 Standalone Signals + PostgreSQL 17`)  
> **Baseline mã nguồn:** Nhánh `develop` @ commit `c297b58`  
> **Ngày đánh giá & tổng hợp:** 2026-11-19  
> **Chuẩn đối chiếu:** `AGENTS.md`, `PROJECT.md`, `docs/srs/*`, `docs/sdd/*`, `docs/design/experience-foundation/*`, `docs/design/booking-marketplace/*`, và **UI/UX Pro Max (10 Priority Categories)**

---

## 1. Tóm Tắt Điều Hành (Executive Summary)

Qua kiểm toán độc lập toàn bộ mã nguồn Backend (`.NET 10`) và Frontend (`Angular 22`, `158` tệp `.ts` phi-spec, `1` tệp `.html` rời, `70` `@Component`) tại commit `c297b58` bởi 4 chuyên gia kiểm định và đối chiếu chéo trực tiếp trên live codebase, **Hotel SaaS Platform v2 chưa sẵn sàng vận hành Production (Not Production-Ready)** dù phần xương sống giao dịch lõi (row-level lock chống double-booking, idempotency key, giữ phòng 15 phút, VNPay HMAC-SHA512 + IPN transaction, RBAC bitmask, EF Core Global Query Filter theo Tenant/Property) đã được xây dựng khá bài bản.

Bốn nghịch lý cấu trúc đang chặn khả năng Go-Live thương mại gồm:

1. **Đứt gãy tích hợp chéo Frontend ↔ Backend & Dead Entities:**
   - Nhiều thực thể đã có sẵn trong Domain/Migration nhưng bị "chết" hoặc nối sai hợp đồng: `HousekeepingTask` không có `DbSet` trong `ApplicationDbContext`/`IApplicationDbContext`; `Promotion` không có Controller/CQRS/B2B UI (trong khi B2C `/booking/deals` đọc dữ liệu giả); `Invoice` không được tạo khi Check-out và `PrintDocumentsController` lệch hoàn toàn DTO với `PrintInvoicePage` & `PrintVoucherPage`; 5 handler của `Application/Loyalty` thiếu `.IgnoreQueryFilters()` nên fail-closed trả 0 dữ liệu cho B2C Customer; `GuestProfilePage` truyền `Reservation.Id` vào `/booking/status/:token` gây 404 100%; `AdminContracts` lệch kiểu `BillingCycle` (`3` vs `"Monthly"`) & `notes`/`Note`.
2. **Lỗ hổng Bảo mật & Cách ly Đa-Tenant còn sót:**
   - `PrintDocumentsController` mở `[AllowAnonymous]` cho `/invoice/{id}` và `/voucher/{confirmationCode}` (lộ PII, số tiền, VietQR/STK ngân hàng), còn `GET /api/print/template-config` thiếu `[RequirePermission]` và gọi `IgnoreQueryFilters().FirstOrDefaultAsync()` không filter `TenantId` gây rò rỉ cấu hình Tenant khác.
   - `PermissionAuthorizationHandler` vẫn bypass toàn bộ `[RequirePermission]` cho `SuperAdmin`; `RefreshTokens` lưu plaintext trong DB; `AiController.GetDynamicPricingRecommendations` gắn `[AllowAnonymous]`; `/metrics` mở công khai; `StaffService` nuốt lỗi API và lưu giả lập System/Custom Role trong `localStorage`; `LoginPage` & `PhoneOtpModal` lộ nút demo + mật khẩu hardcoded (`Admin@123456`, `HotelDev@2026!`) và OTP test trong production bundle; `docker/docker-compose.full.yml` giữ JWT secret fallback tĩnh và `AllowCloudDevSeed: "true"`.
3. **Thiếu hụt Nền tảng Governance, Chuỗi HQ & Vận hành PMS Trọng yếu:**
   - Sidebar `SuperAdmin` mở 6 màn hình PMS bị Middleware chặn `403`, trong khi thiếu hoàn toàn quản lý Vòng đời Tenant (`/api/platform/tenants`), phê duyệt `IsPublished`, `SupportAccessGrant` (`SDD-05 D24`), `SystemBanner` CRUD, giám sát `AiUsageLog`, và thu phí SaaS VNPay cho `Subscriptions`.
   - `Walk-in` trên `/rooms` đổi phòng sang `Occupied` nhưng để đơn kẹt `Confirmed` (deadlock Check-out); `UpdateGuestNotesCommand` ghi đè JSON `ReservationSnapshot` trong `Reservation.Notes`; `CreateRoomTypeRate` lỗi multi-overlap & mất đoạn đuôi; thiếu `Night Audit / NoShow`, `Forgot/Reset Password`, B2B `GuestReview`, kiểm tra Quota gói SaaS (`MaxRooms`, `MaxProperties`, `MaxStaff`) và `MaxOccupancy` nội bộ.
4. **Nợ UI/UX Pro Max & Tuân thủ `AGENTS.md §3`:**
   - Chưa có Design System 3 Shell tách biệt (`Marketplace` vs `PMS Ops` vs `Governance`), dữ liệu tĩnh/giả lập còn tồn tại ở Home/Deals/Rating/OpsReadiness; `55` nút icon-only thiếu `aria-label`, `14` `<div>` clickable thiếu keyboard semantics, `3/21` overlay dùng `cdkTrapFocus`, `262` nút `< 44px`, `1,190` dòng chữ `< 12px`, `0` thư viện Chart, `0` `<p-table>`, `24/70` (`34.3%`) component thiếu `OnPush`, `132/196` `.subscribe()` thiếu teardown nội dòng, `113` `any`, `0` lượt dùng pipe `businessDate` trong template.

---

## 2. Thẻ Điểm Sẵn Sàng 360° (3-Persona + UI/UX Pro Max Readiness Scorecard)

### 2.1. Điểm Sẵn Sàng Theo 3 Khối Đối Tượng Người Dùng (Thang 0–100)

| Trụ cột / Phân hệ | Điểm Sẵn Sàng | Mức Rủi Ro | Số lượng Phát hiện (P0 / P1 / P2 / P3) | Báo cáo Chi tiết |
| :--- | :---: | :---: | :---: | :--- |
| **1. B2C Khách hàng (`Guest / Traveler & Member`)** | **45 / 100** *(TB 5 luồng)* | **CRITICAL** | **27** (`8` P0, `10` P1, `6` P2, `3` P3) | [01-audit-b2c-guest.md](./01-audit-b2c-guest.md) |
| ↳ Luồng 1: Discovery & Search | `52 / 100` | High | — | Dữ liệu giả trên Home, lệch địa giới 3 lớp (CSV 63 tỉnh cũ, 34 tỉnh du lịch giả, Quận/Thị trấn — **đã chốt `G0-01` theo 34 tỉnh 2 cấp**), thiếu phân trang/bulk availability |
| ↳ Luồng 2: Property Detail & Deals | `44 / 100` | High | — | Ảnh/tiện nghi/rating `4.9` giả, hardcode `10% VAT`, `/booking/deals` tĩnh 100% |
| ↳ Luồng 3: Quote, Hold 15p & Payment | `50 / 100` | Critical | — | `isUserPreVerified` sai contract, VietQR TK giả `0345678910`, thiếu VNPay return handler |
| ↳ Luồng 4: Post-Booking & Self-Service | `43 / 100` | Critical | — | Gãy Print Voucher DTO, lộ PII ẩn danh, hủy thiếu verify, thiếu Đổi lịch |
| ↳ Luồng 5: Member Account & Auth | `34 / 100` | Critical | — | Link đơn 404 (`b.id`), Loyalty/Invoice trả rỗng (QueryFilter) + IDOR, Facebook 503, thiếu Quên MK |
| **2. B2B Cơ sở Lưu trú (`Owner / Manager / Receptionist / Housekeeper`)** | **50 / 100** | **CRITICAL** | **25** (`7` P0, `15` P1, `2` P2, `1` P3) | [02-audit-b2b-property.md](./02-audit-b2b-property.md) |
| ↳ Onboarding, Chi nhánh & Chính sách | `52 / 100` | High | — | Thiếu toggle `IsPublished`, `CreateProperty` lỗi 500, `VN-SG` hardcode, lộ `/ops-readiness` |
| ↳ Catalog, Biểu giá, Khuyến mãi & AI | `48 / 100` | Critical | — | `Promotion` B2B 0%, `CreateRoomTypeRate` mất tail, AI lộ `[AllowAnonymous]` & thiếu Apply |
| ↳ Front-Desk & Stay Lifecycle | `55 / 100` | Critical | — | Walk-in deadlock `Confirmed`/`Occupied`, Check-out không tạo `Invoice`, Print Invoice crash |
| ↳ Buồng phòng (Housekeeping) | `38 / 100` | Critical | — | `HousekeepingTask` không có trong `DbContext`, không sinh task khi check-out, nút mobile `<44px` |
| ↳ Thu ngân, Hoàn tiền D23 & Báo cáo | `60 / 100` | High | — | `ReportsController` tính nhầm `REFUND` & bỏ qua `Hourly`, nâng gói miễn phí |
| ↳ CRM, Đánh giá & Nhân sự/RBAC | `44 / 100` | Critical | — | `StaffService` sửa Role trong `localStorage`, `UpdateGuestNotes` phá JSON Snapshot, 0% Review B2B |
| **3. Quản trị Nền tảng, Chain HQ & Bảo mật/Kiến trúc** | **48 / 100** | **CRITICAL** | **37** (`10` P0, `14` P1, `9` P2, `4` P3) | [03-audit-governance-management.md](./03-audit-governance-management.md) |
| ↳ Platform SuperAdmin (`GlobalRole`) | `38 / 100` | Critical | — | 6 màn hình PMS 403 trên sidebar, thiếu Tenant Lifecycle, `SupportAccessGrant`, `SystemBanner` |
| ↳ Chain HQ (`TenantWide`, `propertyId=null`) | `56 / 100` | High | — | `/reservations` empty state sai, `/rooms` trộn chi nhánh, F5 mất ngữ cảnh HQ, 2 cây route |
| ↳ Security, Multi-Tenant & Clean Arch | `51 / 100` | Critical | — | `RefreshTokens` plaintext, SuperAdmin bypass, `PrintDocuments` leak, 6 Fat Controllers, 27/49 Command thiếu Validator |

### 2.2. Thẻ Điểm UI/UX Pro Max (10 Danh mục) & Tuân thủ Angular 22 (`AGENTS.md §3`)

Nguồn xác minh: [04-ui-ux-pro-max-design-audit.md](./04-ui-ux-pro-max-design-audit.md) trên `158` tệp `.ts` phi-spec, `1` `.html`, `70` `@Component`.

| # | Hạng mục UI/UX Pro Max / Chuẩn Kỹ thuật | Điểm (/10) | Mức độ | Chỉ số Đo lường Thực tế trên `c297b58` |
| :-: | :--- | :---: | :---: | :--- |
| 1 | **Accessibility (WCAG 2.1 AA)** | **4.0** | **P0** | `55` nút icon-only thiếu `aria-label` (`26` thiếu cả `title`); `14` `<div>` clickable thiếu keyboard semantics; `3/21` overlay có `cdkTrapFocus`; `11` modal `fixed inset-0` thiếu `role="dialog"`/`aria-modal`; `199` `outline-none` trên `35` tệp; skip-link chỉ có ở `guest-layout.ts`. |
| 2 | **Touch & Interaction** | **4.5** | **P1** | `262` nút/link `< 44px` trên `45` tệp; hover-only controls (`rooms.page.ts:312-319`); nested clickable ở `booking-filter-bar`; `2` `window.confirm()`. |
| 3 | **Performance & CLS** | **5.0** | **P1** | `23/23` `<img>` thiếu `width`/`height`; `14/23` thiếu `loading="lazy"`/`ngSrc`; `75` URL `images.unsplash.com` cứng; `0` `cdk-virtual-scroll`; link `Material+Icons` chết (`0` lượt dùng). |
| 4 | **Style & Visual Cohesion** | **3.5** | **P0** | `77+` dòng emoji thay icon (`13` tệp); xung đột Indochine vs Slate/Indigo trong B2C; component chết `ai-concierge-widget`; dữ liệu tĩnh/giả lập trên Home, Deals, OpsReadiness, Print docs. |
| 5 | **Layout & Responsive (`375–1440px`)** | **5.0** | **P1** | `styles.css:628-650` ép `.fixed.inset-0` (`z-index: 100 !important`); `5` khối `w-[>=360px]` có nguy cơ tràn mobile (vd `ai-concierge-chat` 380px > 375px); `29` `<table>` thô trên `18` tệp. |
| 6 | **Typography & Color** | **4.0** | **P0** | `1,190` dòng chữ `< 12px` trên `59` tệp; `tabular-nums` chỉ ở `3` tệp (`20` lượt); `154` raw hex trong `14` tệp `app/`; `app.config.ts:27` đặt `darkModeSelector: false`; `0` lượt dùng `var(--brand-*)`. |
| 7 | **Animation & Motion** | **4.5** | **P2** | `44` `animate-pulse/ping/bounce` trên `19` tệp thiếu `motion-reduce`; chỉ `6` tệp xử lý `prefers-reduced-motion`. |
| 8 | **Forms & Feedback** | **4.0** | **P0** | `210` `ngModel` trên `35` tệp vs `<app-form-field>` ở `3` tệp (`13` thẻ); `0` `canDeactivate`/`beforeunload`; link Quên MK trỏ `/booking/lookup`; bug UTC ở `payments.page.ts:42-56`. |
| 9 | **Navigation Patterns** | **4.5** | **P1** | Trùng 2 cây route `/auth/*` & `/admin/*`; `AdminLayout` gộp PMS + Governance không tách shell; thiếu breadcrumb ở Guest flows. |
| 10 | **Charts & Data Tables** | **2.5** | **P0** | `0` thư viện biểu đồ (`reports`/`dashboard`/`subscriptions` vẽ bằng `<div>`); `0` `<p-table>`; `0` `aria-sort`; thiếu trạng thái loading/empty/error/table fallback cho biểu đồ. |
| — | **Angular 22 (`AGENTS.md §3`)** | **5.0** | **P1** | `24/70` (`34.3%`) component thiếu `OnPush`; `196` `.subscribe()` (`132` thiếu teardown); `113` `any` + `2` `$any()`; `0` template dùng pipe `businessDate`; `3` `<app-empty-state>` truyền sai prop `icon="..."`. |

---

## 3. Top Phát Hiện Nghiêm Trọng Nhất (`P0` / `P1` Highlights)

1. **Bảo mật & Multi-Tenant (P0):**
   - `PrintDocumentsController` (`#L43-44`, `#L169-170`, `#L297-319`): Cho phép `[AllowAnonymous]` xem hóa đơn/voucher chứa PII & STK ngân hàng, và `GetTemplateConfig` gọi `IgnoreQueryFilters().FirstOrDefaultAsync()` không filter `TenantId` gây rò rỉ cross-tenant.
   - `PermissionAuthorizationHandler.cs#L40-45`: Bypass mọi `[RequirePermission]` cho `SuperAdmin` (trái `SDD-05 D24`).
   - `RefreshTokens` (`LoginCommandHandler.cs#L173-182`, `RefreshTokenCommandHandler.cs#L86`): Lưu & đối chiếu token plaintext trong DB.
   - `GetGuestInvoicePrintViewQueryHandler.cs#L20-57`: Thiếu kiểm tra `GuestUserId` (nguy cơ IDOR sau khi mở `IgnoreQueryFilters()`).
   - `StaffService` (`staff.service.ts#L358-409, L475-579`): Nuốt lỗi API và sửa/lưu RBAC Role giả lập trong `localStorage`.
   - Production Exposure: `docker-compose.full.yml#L58, L62` (JWT fallback tĩnh + `AllowCloudDevSeed`), `login.page.ts#L466, L548-552` (hardcode `'Admin@123456'`, `'HotelDev@2026!'` + Demo buttons), `phone-otp-modal.component.ts#L136` (nút OTP giả), `AiController.cs#L294-295` (`[AllowAnonymous]` trên Dynamic Pricing).
2. **Đứt gãy Luồng Cốt Lõi (P0):**
   - `GuestProfilePage` (`#L469, L540`) truyền `b.id` vào `/booking/status/:token` -> **lỗi 404 100%**; 5 Loyalty handlers thiếu `.IgnoreQueryFilters()` -> **0 điểm / 0 hóa đơn / 404 Enroll**.
   - Walk-in trên `/rooms` (`rooms.page.ts#L1699-1721`) đổi phòng `Occupied` nhưng không Check-in đơn -> deadlock khi Check-out.
   - `PrintDocumentsController` lệch DTO hoàn toàn với cả `PrintInvoicePage` lẫn `PrintVoucherPage`; Check-out không sinh `Invoice`; `GetPrintableInvoice` cộng cả giao dịch `REFUND` vào `paidAmount`.
   - `UpdateGuestNotesCommand.cs#L50-53` ghi đè JSON `ReservationSnapshot` trong `Reservation.Notes` và bỏ qua `IsVip`.
   - `VNPay` thiếu route/xử lý return params tại `BookingStatusPage`, `VietQR` fallback STK giả `0345678910`, `CancelGuestBooking` cho phép bỏ trống verify Email/SĐT, `SubmitGuestReview` nhận mã 6 ký tự cho đơn chưa ở & tạo `User` rỗng mật khẩu.
   - `SubscriptionsController` nâng gói miễn phí lệch giá DB (`290k/690k/1.49M` vs `299k/699k/1.499M`); `AdminContracts` lỗi contract `billingCycle`/`notes` & hash chữ ký `Math.random()`.
   - Thiếu hoàn toàn `PlatformTenantsController` (`/api/platform/tenants`), `HousekeepingTask` DB wiring, và `Promotion` B2B/Quote integration.
3. **Thiếu hụt Nghiệp vụ & UI/UX Pro Max (P1):**
   - Sai chuẩn địa giới **34 tỉnh/thành phố 2 cấp** (`DMTinhThanh_2Cap.csv` vẫn 63 tỉnh cũ, `VIETNAM_34_PROVINCES` dùng 34 tỉnh du lịch giả từ danh sách cũ, Seeder/Onboarding còn `"Quận"`/`"Thị trấn"` — **đã chốt `G0-01`**) và lệch giờ Check-in **`12:00` vs `14:00`**; filter `Guesthouse` luôn ra 0 kết quả; thiếu phân trang/availability server-side; dữ liệu giả trên Hero/Deals/Ratings/OpsReadiness.
   - `CreateRoomTypeRate` lỗi multi-overlap & mất đoạn đuôi; `PricingCalculator` ném `422` khung `00:00–06:00` / `18:00–23:59`; `ReportsController` tính nhầm `REFUND`, `PendingPayment`, và bỏ qua `Hourly`.
   - Thiếu `Forgot/Reset Password`, `SupportAccessGrant`, `NightAudit / NoShow`, `Reviews` B2B, Quota gói SaaS (`MaxRooms`, `MaxProperties`, `MaxStaff`), `MaxOccupancy` nội bộ, và cơ chế sửa/đổi lịch đặt phòng.
   - `6` Fat Controllers + `27/49` Command thiếu FluentValidation + `CreatePropertyCommand` ném 500 + thiếu `UX_User_Email` & `ConfirmationCode` index.
   - Nợ nặng về WCAG (`aria-label`, `role="dialog"`, `cdkTrapFocus`, 44px touch targets), 3-shell Design Tokens, Dark Mode, Charts/Tables, và `OnPush`/Subscriptions cleanup.

---

## 4. Thứ Tự Đọc Tài Liệu (Reading Order)

Bộ tài liệu tái đánh giá 360° gồm **9 tệp** chuẩn Spec Kit tại `docs/design/platform-360-reassessment/`:

| Thứ tự | Tài liệu | Vai trò & Nội dung chính |
| :-: | :--- | :--- |
| **1** | [`README.md`](./README.md) *(Tệp này)* | Tổng quan điều hành, thẻ điểm 360°, top rủi ro P0/P1 và bản đồ đọc bộ tài liệu. |
| **2** | [`01-audit-b2c-guest.md`](./01-audit-b2c-guest.md) | Kiểm toán chuyên sâu 5 luồng B2C Guest / Member & 10 hạng mục UI/UX Pro Max (27 findings). |
| **3** | [`02-audit-b2b-property.md`](./02-audit-b2b-property.md) | Kiểm toán chuyên sâu 6 phân hệ PMS & 4 persona B2B (25 findings). |
| **4** | [`03-audit-governance-management.md`](./03-audit-governance-management.md) | Kiểm toán Platform SuperAdmin, Chain HQ, Delta bảo mật so với audit cũ & Clean Architecture (37 findings). |
| **5** | [`04-ui-ux-pro-max-design-audit.md`](./04-ui-ux-pro-max-design-audit.md) | Kiểm toán định lượng 10 hạng mục UI/UX Pro Max, tuân thủ `AGENTS.md §3` (Angular 22) và kiến trúc 3-Layer CSS Tokens cho 3 Shell. |
| **6** | [`contracts/feature-ux-gap-matrix.md`](./contracts/feature-ux-gap-matrix.md) | Ma trận truy vết đầy đủ 360° (Guest, PMS, Governance/Security, và toàn bộ Dead/Unwired Domain Entities). |
| **7** | [`spec.md`](./spec.md) | Đặc tả hình thức Spec Kit: Actors, User Stories (`US-G*`/`US-P*`/`US-M*`/`US-U*`), `FR-*`, `NFR-*`, kịch bản `Given/When/Then` và các cổng quyết định `G0`. |
| **8** | [`plan.md`](./plan.md) | Kế hoạch khắc phục & nâng cấp theo Gate `G0–G4`, ràng buộc Clean Architecture / Fail-Closed / Angular 22, chiến lược kiểm chứng và rollback. |
| **9** | [`tasks.md`](./tasks.md) | Backlog công việc tuần tự `T001`–`T032` chia 4 Wave ưu tiên, ranh giới Allowed Files chống xung đột, dependency và lệnh verify chính xác. |

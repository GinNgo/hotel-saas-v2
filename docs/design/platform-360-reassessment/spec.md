# Đặc Tả Chức Năng & Trải Nghiệm Toàn Diện 360° (Spec Kit Specification)

> **Hệ thống:** Hotel SaaS Platform v2 (`.NET 10 + Angular 22 + PostgreSQL 17`)  
> **Baseline:** `develop` @ `c297b58` | **Liên kết ma trận:** [`contracts/feature-ux-gap-matrix.md`](./contracts/feature-ux-gap-matrix.md)  
> **Trạng thái:** **Draft Chờ Duyệt Gate G0–G1** (Chưa mở triển khai runtime)

---

## 1. Actors & Outcomes (Đối Tượng Sử Dụng & Kết Quả Kỳ Vọng)

| Actor | Ngữ cảnh / Shell | Kết quả Kỳ vọng (Target Outcome) |
| :--- | :--- | :--- |
| **B2C Guest / Traveler** *(Vãng lai & Thành viên)* | `[data-shell="marketplace"]` (`/booking/*`, `/auth/*`, `/print/voucher/*`) | Tìm kiếm cơ sở lưu trú trung thực theo điểm đến/ngày/số khách/hình thức thuê (Giờ / Qua đêm / Ngày); xem ảnh, tiện nghi, đánh giá và thuế/phí thật; đặt giữ chỗ 15p (áp mã khuyến mãi hoặc đổi điểm Loyalty); thanh toán VNPay/VietQR với đối soát rõ ràng; tự tra cứu, hủy (có xác minh), đổi lịch, in voucher và quản lý hồ sơ/hóa đơn/điểm thưởng mà không gặp 404 hay lỗi lộ dữ liệu. |
| **B2B Property Staff** *(Owner, Manager, Receptionist, Housekeeper)* | `[data-shell="pms-ops"]` (`/dashboard`, `/rooms`, `/reservations`, `/housekeeping`, `/payments`, `/rates`, `/policies`, `/promotions`, `/reviews`, `/guests`, `/staff`, `/roles`, `/reports`) | Vận hành trọn vẹn vòng đời lưu trú trong < 2 phút: tạo/check-in walk-in đồng bộ trạng thái; tự tính phụ thu sớm/trễ & xuất `Invoice` + VietQR thật lúc check-out; quản lý `HousekeepingTask` từ mobile `>= 44px` với mức ưu tiên check-in kế tiếp; tạo bảng giá không mất đoạn đuôi; tạo khuyến mãi, phản hồi đánh giá khách, quản lý CRM không ghi đè dữ liệu đơn; phân quyền RBAC 100% qua DB (không giả lập `localStorage`). |
| **Chain HQ Manager / Owner** | `[data-shell="pms-ops"]` (`TenantWide`, `propertyId = null`) | Chuyển mượt giữa chế độ Tổng chuỗi (Chain HQ) và từng Chi nhánh mà không bị F5 ghi đè; thấy KPI/báo cáo hợp nhất đúng ngữ cảnh và thấy màn hình chọn chi nhánh rõ ràng thay vì empty state gây hiểu nhầm hay trộn dữ liệu phòng không nhãn. |
| **Platform SuperAdmin & Support** | `[data-shell="governance"]` (`/platform/*`, `/plans`, `/contracts`) | Tách biệt hoàn toàn khỏi menu vận hành PMS chi nhánh; quản lý vòng đời Tenant (`/api/platform/tenants`), duyệt xuất bản chi nhánh (`IsPublished`), gói cước/hợp đồng chữ ký server-side, banner hệ thống, giám sát `AiUsageLogs` & doanh thu SaaS thực thu; hỗ trợ dữ liệu khách sạn chỉ thông qua `SupportAccessGrant` có thời hạn & audit log (`SDD-05 D24`). |

---

## 2. User Stories Ưu Tiên (Prioritized User Stories)

### 2.1. Nhóm B2C Guest & Member (`US-G*`)
- **US-G01 (P0):** Là **Thành viên đã đăng nhập**, tôi muốn bấm vào từng đơn trong `/booking/profile` để xem chi tiết đơn, hóa đơn thật, lịch sử điểm thưởng và đăng ký thẻ hội viên chi nhánh mà không gặp 404 hoặc số dư 0 giả tạo (`GAP-A01`, `GAP-A02`).
- **US-G02 (P0):** Là **Khách thanh toán trực tuyến**, tôi muốn kết quả trả về từ VNPay được xác thực chữ ký ngay trên màn hình trạng thái và mã VietQR chỉ sinh từ tài khoản ngân hàng đã cấu hình của chính khách sạn, kèm mô tả chính xác quy trình xác nhận (`GAP-A05`, `GAP-A06`).
- **US-G03 (P0):** Là **Khách đặt phòng / Chủ đơn**, tôi muốn bản in Phiếu xác nhận (`/print/voucher/:token`) hoạt động đồng bộ, bảo vệ thông tin cá nhân (không lộ Email/SĐT unmasked qua mã 6 ký tự), và yêu cầu xác minh danh tính bắt buộc khi hủy đơn ẩn danh hoặc gửi đánh giá (`GAP-A03`, `GAP-A04`, `GAP-A07`).
- **US-G04 (P1):** Là **Người dùng quên mật khẩu hoặc dùng tài khoản SĐT**, tôi muốn tự khôi phục mật khẩu qua email (`US-1.4`), đổi mật khẩu, gửi lại email kích hoạt, thêm/xác thực Email thật và liên kết tài khoản Google/Facebook hợp lệ mà không gặp lỗi 503 (`GAP-A09`, `GAP-A18`).
- **US-G05 (P1):** Là **Khách tìm kiếm và đặt phòng**, tôi muốn thấy ảnh, đánh giá, giờ nhận/trả phòng và thuế VAT trung thực của từng cơ sở; lọc đúng loại hình/tỉnh thành/sức chứa/phòng trống theo ngày; nhập mã khuyến mãi (`PromoCode`) hoặc đổi điểm (`PointsToRedeem`) ngay tại trang giữ chỗ (`GAP-A10`–`GAP-A15`).
- **US-G06 (P1):** Là **Khách sau khi đặt phòng**, tôi muốn xem Smart Lock PIN ngay khi đơn `Confirmed` (đủ điều kiện tự nhận phòng), xem lại đánh giá đã gửi (không bị hỏi đánh giá lại sau F5), và yêu cầu đổi ngày/giờ/phòng khi thay đổi kế hoạch (`GAP-A16`, `GAP-A17`).

### 2.2. Nhóm B2B Property & Staff (`US-P*`)
- **US-P01 (P0):** Là **Lễ tân**, tôi muốn tạo đơn Walk-in trên `/rooms` tự động Check-in (đồng bộ `CheckedIn` + `Occupied` + cấp PIN) và thực hiện Check-out 1 chạm kèm tự sinh `Invoice` + nút in `/print/invoice/:id` khớp dữ liệu (`GAP-B03`, `GAP-B04`, `GAP-B21`).
- **US-P02 (P0):** Là **Nhân viên Buồng phòng & Quản lý**, tôi muốn Check-out tự động tạo `HousekeepingTask`, hỗ trợ giao việc, tự nhận việc (`self-claim`), ưu tiên phòng sắp check-in, và thao tác dễ dàng trên điện thoại `375px` với nút `>= 44×44px` (`GAP-B05`, `GAP-B22`).
- **US-P03 (P0):** Là **Chủ khách sạn (Owner)**, tôi muốn mọi chỉnh sửa vai trò RBAC lưu trực tiếp xuống PostgreSQL (không lưu giả lập `localStorage`), tạo ghi chú CRM khách hàng vào hồ sơ khách riêng (không ghi đè `Reservation.Notes`), và tạo/quản lý khuyến mãi thật cho cơ sở (`GAP-B02`, `GAP-B06`, `GAP-B07`).
- **US-P04 (P1):** Là **Quản lý Cơ sở (Manager)**, tôi muốn cấu hình VAT%/ServiceFee%/chính sách hủy `POL-C03`/VietQR theo từng chi nhánh, đặt bảng giá không mất đoạn đuôi khi chèn khoảng lễ, sử dụng AI gợi ý giá và bấm Áp dụng 1 chạm, xử lý `NoShow`/Night Audit, xem/trả lời đánh giá khách (`GuestReview`), và xem báo cáo doanh thu chính xác cả đơn `Hourly` lẫn trừ khoản `REFUND` (`GAP-B08`–`GAP-B20`).

### 2.3. Nhóm Platform SuperAdmin, Chain HQ & Bảo mật (`US-M*`)
- **US-M01 (P0):** Là **Platform SuperAdmin**, tôi muốn làm việc trong không gian Governance tách biệt (không hiện 6 menu PMS 403), quản lý vòng đời Tenant (`/api/platform/tenants`), duyệt xuất bản chi nhánh (`IsPublished`), ký hợp đồng bằng hash server-side với dropdown Tenant thật, và giám sát doanh thu SaaS (`SubscriptionPayments`) + `AiUsageLogs` (`GAP-C04`, `GAP-C05`, `GAP-C08`, `GAP-C09`, `GAP-C22`).
- **US-M02 (P0):** Là **Kỹ sư Bảo mật / Hệ thống**, tôi muốn xóa hoàn toàn SuperAdmin permission bypass (`SDD-05 D24`), băm SHA-256 `RefreshTokens`, khóa truy cập ẩn danh trên `/api/print/*` và `/api/ai/dynamic-pricing/*`, bảo vệ `/metrics`, loại bỏ secret/mật khẩu demo khỏi production bundle & Docker Compose, và thực thi quota gói SaaS ở mọi Command tạo mới (`GAP-C01`–`GAP-C03`, `GAP-C06`, `GAP-C07`, `GAP-C10`, `GAP-C21`, `GAP-B18`).
- **US-M03 (P1):** Là **Chủ chuỗi (Chain HQ)**, tôi muốn giữ nguyên ngữ cảnh Chain HQ sau khi F5, thấy màn hình hướng dẫn chọn chi nhánh rõ ràng tại `/reservations`/`/rooms`/`/room-types`/`/housekeeping`, sử dụng một cây route Admin thống nhất, và cấp/thu hồi `SupportAccessGrant` có thời hạn cho kỹ thuật viên nền tảng (`GAP-C11`, `GAP-C16`–`GAP-C18`).

### 2.4. Nhóm Hệ thống Thiết kế UI/UX Pro Max & Angular 22 (`US-U*`)
- **US-U01 (P0):** Là **Người dùng ở cả 3 Persona**, tôi muốn giao diện tuân thủ WCAG 2.1 AA (mọi nút icon có `aria-label`, mọi modal có `role="dialog"`/`aria-modal`/`cdkTrapFocus`/`Esc`, không dùng `<div>` clickable, target chạm `>= 44px`, chữ `>= 12px`, `tabular-nums` cho giá/KPI/timer) và chế độ Dark Mode không chói mắt cho ca đêm (`04-audit` Mục 1, 2, 5, 6).
- **US-U02 (P1):** Là **Nhân sự kỹ thuật Frontend**, tôi muốn toàn bộ giao diện áp dụng kiến trúc 3-Layer CSS Tokens cho 3 Shell (`marketplace`, `pms-ops`, `governance`), dùng thư viện Chart + `<p-table>` chuẩn, loại bỏ emoji cấu trúc & dữ liệu giả, và tuân thủ 100% chuẩn `AGENTS.md §3` (`OnPush`, Signals/teardown, không `any`, tái sử dụng `shared/` & pipe `businessDate`) (`04-audit` Phần II–IV).

---

## 3. Yêu Cầu Chức Năng Chi Tiết (`FR-*`)

### 3.1. Bảo mật, Xác thực & Cách ly Đa-Tenant (`FR-SEC-*`)
- **FR-SEC01:** `PermissionAuthorizationHandler` phải kiểm tra quyền dựa trên vai trò/chức năng thực hoặc `SupportAccessGrant` hợp lệ; **nghiêm cấm** auto-succeed cho `GlobalUserRole.SuperAdmin`.
- **FR-SEC02:** `RefreshTokens` phải lưu và đối chiếu bằng `SHA-256` hex hash; không lưu raw refresh token trong database.
- **FR-SEC03:** `PrintDocumentsController` phải đóng `[AllowAnonymous]` cho `/invoice/{id}`, `/voucher/{code}`, `/template-config`; truy cập chứng từ B2C phải dùng `PrintToken` ký HMAC có TTL hoặc phiên JWT đã xác minh chủ sở hữu; `GetTemplateConfig` bắt buộc `[RequirePermission("SETTINGS", Read)]` và không bao giờ dùng `IgnoreQueryFilters()` khi `TenantId == null`.
- **FR-SEC04:** `GetGuestInvoicePrintViewQueryHandler` bắt buộc inject `ICurrentUserContext` và kiểm tra `res.GuestUserId == _userContext.UserId` (kèm `.IgnoreQueryFilters()` để customer cross-tenant đọc được hóa đơn của chính mình).
- **FR-SEC05:** Toàn bộ 5 handler thuộc `Application/Loyalty` (`GetMyGuestProfile`, `GetMyPointTransactions`, `EnrollPropertyMembership`, `GetMyInvoices`, `GetGuestInvoicePrintView`) phải dùng `.IgnoreQueryFilters()` kết hợp điều kiện lọc bắt buộc theo `UserId == _userContext.UserId`.
- **FR-SEC06:** Gỡ bỏ mọi mật khẩu demo (`Admin@123456`, `HotelDev@2026!`, `Staff@123456`), nút Demo 1-chạm và nút test OTP khỏi build Production (`!environment.production`); `FirebaseAuthService` và `GoogleAuthService` phải bọc `#if DEBUG` cho mock token; `social-auth.service.ts` không được sinh `dev-mock-google-token` ở Production; `docker-compose.full.yml` bắt buộc env var `JWT_SECRET_KEY` (tối thiểu 32 bytes) và tắt `AllowCloudDevSeed`.
- **FR-SEC07:** Bảo vệ `/metrics` bằng IP allowlist nội bộ hoặc Bearer/Basic auth; bảo vệ `GET /api/ai/dynamic-pricing/recommendations` bằng `[RequirePermission("AI_FEATURES", Read)]` + kiểm tra scope chi nhánh; bắt buộc xác minh Email/SĐT khi hủy đơn ẩn danh (`CancelGuestBookingCommand`) và khóa `SubmitGuestReviewCommand` chỉ nhận `LookupToken`/authenticated owner khi đơn đã `CheckedOut` (hoặc `CheckedIn` nếu G0 chốt).
- **FR-SEC08:** Triển khai `ForgotPasswordCommand`, `ResetPasswordCommand`, `ChangePasswordCommand`, `ResendEmailConfirmationCommand`, và lời mời nhân viên qua email token thay vì gán mật khẩu mặc định `"Staff@123456"` hoặc tự nâng quyền tài khoản `Customer` sang `TenantStaff`.

### 3.2. B2C Guest Experience & Marketplace (`FR-B2C-*`)
- **FR-B2C01:** Liên kết xem đơn từ `GuestProfilePage` phải điều hướng bằng `LookupToken` hợp lệ hoặc mở route chi tiết thành viên gọi `GET /api/guest/bookings/{id}`; nối đủ 5 API của `GuestPortalController` (`vat-profile`, `loyalty-ledger`, `enroll`, `invoices`, `invoices/{id}/print`); đọc `RentalType` từ `ReservationSnapshotHelper`; mở luồng thêm/xác thực Email cho tài khoản SĐT.
- **FR-B2C02:** Đồng bộ contract DTO hai chiều cho `/print/voucher/:token` (`PrintVoucherDto`) và nối nút in từ `BookingStatusPage` / `BookingLookupPage`; đồng bộ hiển thị Smart Lock PIN ở trạng thái `Confirmed || CheckedIn` (khi đã cọc & `Active`).
- **FR-B2C03:** Xử lý callback `vnp_*` trên `BookingStatusPage` (và/hoặc route `/booking/vnpay-return`) gọi `GET /api/public/payments/vnpay/return`; `GenerateVietQr` truy vấn cấu hình ngân hàng thật của `Property`/`Tenant` (fail-closed không sinh mã nếu chưa cấu hình, bỏ STK dummy `0345678910`); hiển thị rõ trạng thái phương thức `BankTransfer` và không cam kết IPN giả cho VietQR.
- **FR-B2C04:** Loại bỏ toàn bộ dữ liệu ngụy tạo trên Marketplace (`CuratedGalleriesByType`, `RoomGalleryService`, `Da Nang Ocean Suites`, `4.9` fallback rating, 5 sao cứng, `10% VAT` hardcode, `Smart Lock 24/7` mặc định, `FlashDealsBanner` giả); chuẩn hóa danh mục địa giới hành chính theo **34 tỉnh/thành phố mô hình 2 cấp (`Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`)** (thay thế danh mục 63 tỉnh cũ trong `DMTinhThanh_2Cap.csv`/`DMXaPhuong_2Cap.csv`, thay danh mục "34 tỉnh du lịch" lỗi thời ở `vietnam-provinces.data.ts`, và ánh xạ địa danh nổi tiếng thuộc tỉnh sau sáp nhập như Phú Quốc -> An Giang, Hội An -> Đà Nẵng, Vũng Tàu -> TP.HCM, Phan Thiết/Mũi Né -> Lâm Đồng, Quy Nhơn -> Gia Lai, Tuy Hòa -> Đắk Lắk, Sa Pa/Mù Cang Chải -> Lào Cai, Đồng Văn -> Tuyên Quang, Măng Đen -> Quảng Ngãi thành `TouristZone` + alias tìm kiếm); sửa/map filter `Guesthouse`, hỗ trợ phân trang, lọc giá/số khách/tình trạng phòng trống trên `GetPublicPropertiesQuery`, và sửa bản đồ sang multi-marker + API `/api/public/brands`.
- **FR-B2C05:** Triển khai `/api/public/promotions` thật, tích hợp validation & tính giảm giá `PromoCode` + UI nhập `PromoCode` & `PointsToRedeem` tại `BookingHoldPage`; đồng bộ `UserDto.IsPhoneVerified`; trả `HasReviewed`/`ExistingReview` trong `GuestBookingDetailDto`; triển khai luồng Sửa/Đổi lịch đặt phòng (`RescheduleGuestBooking`) dưới row-lock.

### 3.3. B2B Property Operations & PMS (`FR-B2B-*`)
- **FR-B2B01:** Sửa luồng Walk-in trên `/rooms` thành atomic `Create + CheckIn` (trạng thái `CheckedIn`, phòng `Occupied`, cấp `SmartLockPin`); sinh bản ghi `Invoice` + `InvoiceItem` tự động khi Check-out; thống nhất DTO `PrintInvoiceDto` với `PrintDocumentsController` và gắn nút "In hóa đơn" ngay tại Check-out & Reservation Detail; lọc bỏ `REFUND` khi tính `paidAmount`.
- **FR-B2B02:** Đưa `HousekeepingTask` vào `ApplicationDbContext` & `IApplicationDbContext`; tự động sinh task khi Check-out (`BR-HK01`); triển khai `HousekeepingController` (List/Assign/Self-Claim/Start/Complete/Inspect/Urgent priority) và nâng cấp `/housekeeping` thành hàng đợi task thân thiện mobile.
- **FR-B2B03:** Tạo entity `GuestProfile` tách biệt khỏi `Reservation.Notes`; cập nhật `UpdateGuestNotesCommand` ghi vào `GuestProfile` (kèm `IsVip`, `IsBlacklisted`); hiển thị `CustomerNotes` đã giải mã trên `/guests`, nối `GuestLoyaltyMemberships` và kích hoạt filter `LoyaltyTier`/`IsVip`.
- **FR-B2B04:** Xóa 100% `localStorage` RBAC override trong `StaffService`; phân biệt System Role (read-only/clone) vs Custom Role (DB-persisted); đồng bộ danh sách `PermissionFunction` (`AUDIT_LOGS`, `AI_FEATURES`, `PROMOTIONS`, `REVIEWS`).
- **FR-B2B05:** Kích hoạt trọn bộ `Promotion` (`PromotionsController` + B2B `/promotions` + Quote engine); kích hoạt `ReviewsController` + UI PMS xem/trả lời/ẩn `GuestReview`; hoàn thiện AI Dynamic Pricing (`POST /api/ai/dynamic-pricing/apply` + panel trên `/rates` + log `AiUsageLogs` thật).
- **FR-B2B06:** Sửa thuật toán chia khoảng `CreateRoomTypeRateCommandHandler` xử lý đủ 4 trường hợp interval algebra cho mọi rate giao cắt (bao gồm sinh `tailRate`); phủ đủ khung phụ thu 24/24 khi tạo chi nhánh & tự tính phụ thu sớm/trễ lúc Check-out; bổ sung `MarkNoShowCommand` + `NightAuditBackgroundService`; kiểm tra `MaxOccupancy`, hạn đặt trước `365 ngày`, và đồng bộ tỷ lệ cọc.
- **FR-B2B07:** Sửa `ReportsController` loại trừ `PendingPayment`/`NoShow` khỏi doanh thu, loại trừ `REFUND-COMPLETED-` khỏi breakdown, tính doanh thu/công suất `Hourly`, và bổ sung phòng vệ `EnsurePropertyAccess(null)` + mặc định `activeTab = 'branch'` cho nhân sự chi nhánh.
- **FR-B2B08:** Cho phép cấu hình `TaxRatePercent`, `ServiceFeeRatePercent`, `POL-C03` tại `/policies`; sửa `PrintTemplateConfig` scope theo `propertyId`; sửa `CreatePropertyCommand` trả `409 ConflictException` khi trùng mã/slug; bind đúng `ProvinceCode` theo danh mục **34 tỉnh/thành phố 2 cấp (`Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`)** khi tạo/sửa chi nhánh và đăng ký đối tác (bỏ nhãn `"63 đơn vị"`, `"Thị trấn"`, và xóa cấp `"Quận/Huyện"` trong `RealData34ProvincesSeeder`); đồng bộ giờ Check-in mặc định (`14:00`) & xử lý kiểm soát `IsPublished`.

### 3.4. Platform Governance, Chain HQ & Clean Architecture (`FR-GOV-*`)
- **FR-GOV01:** Tách shell & navigation riêng cho `SuperAdmin` (gỡ 6 màn hình PMS 403 khỏi sidebar và chuyển `/ops-readiness` khỏi menu B2B Tenant); xây dựng `PlatformTenantsController` (`/api/platform/tenants`) & màn hình `/tenants` (List, Detail, Approve/Activate, Suspend, Usage vs Quota).
- **FR-GOV02:** Đồng bộ `AdminContracts` DTO FE/BE, hash SHA-256 chữ ký số tại server và thay ô nhập `TenantId` thủ công bằng dropdown Tenant; sửa `AdminPlans.toggleActive`; nối `SubscriptionsController` vào bảng `SubscriptionPlans` trong DB và bắt buộc luồng `SubscriptionPayment` qua VNPay; tạo `ISubscriptionQuotaGuard` chặn `MaxProperties`/`MaxRooms`/`MaxStaff` trong Create handlers.
- **FR-GOV03:** Triển khai `SupportAccessGrant` + `SupportAuditLog` + API `/tenants/current/support-grants` (`SDD-05 D24`, `SDD-06 #2.3`); mở rộng `/api/platform/overview` đo MRR/ARR từ `SubscriptionPayments` & AI quota từ `AiUsageLogs`; kích hoạt `SystemBannersController` & `NotificationsController` (hoặc dọn bỏ nếu G0 quyết định cắt).
- **FR-GOV04:** Khắc phục Chain HQ UX: lưu cờ `hotelsaas_context_mode` chống F5 nhảy chi nhánh; hiển thị EmptyState chọn chi nhánh có CTA tại `/reservations`, `/policies`, `/rates`, `/payments`; gắn nhãn `PropertyName` hoặc chặn HQ có chủ đích tại `/rooms`, `/room-types`, `/housekeeping`; hợp nhất 1 cây route Admin duy nhất (loại bỏ trùng `/admin/*` vs `/*`).
- **FR-GOV05:** Chuẩn hóa Clean Architecture (`AGENTS.md §1`): tái cấu trúc **6 Fat Controllers** (`AdminPlans`, `AdminContracts`, `Subscriptions`, `Reports`, `PrintDocuments`, `Ai`) sang MediatR; bổ sung FluentValidation cho **27 Command còn thiếu**; thay substring exception matching trong `ExceptionHandlingMiddleware` bằng domain exceptions chuẩn; thêm EF Migration tạo `UX_User_Email`, `IX_Reservations_ConfirmationCode`, tinh gọn FK song song trên `Reservations`, và bổ sung `ISoftDeletable` filter.

---

## 4. Yêu Cầu Phi Chức Năng & Chuẩn UI/UX Pro Max (`NFR-*`)

### 4.1. Kiến trúc 3-Layer Design Tokens & 3 Persona Shells (`NFR-DS-*`)
Theo phân tích lọc lý trí từ `04-ui-ux-pro-max-design-audit.md`:
- **NFR-DS01 (Typography Tiếng Việt & Số Học):** Sử dụng `Be Vietnam Pro` / `Plus Jakarta Sans` cho UI tiếng Việt, `Inter` cho bảng dữ liệu mật độ cao, `JetBrains Mono` chỉ cho mã đặt phòng/phòng/PIN/hash. **Cấm** dùng font serif (`Playfair Display`) trên UI tra cứu/vận hành/bảng biểu; xóa link CSS `Material+Icons` chết khỏi `index.html`. Sàn cỡ chữ tối thiểu là **`12px` (`text-xs`)** (loại bỏ `1,190` dòng `7px–11px`); áp dụng `font-variant-numeric: tabular-nums` cho toàn bộ giá tiền, công suất, đếm ngược và cột số.
- **NFR-DS02 (3 Persona Shells):** Định danh qua `[data-shell]`:
  - `[data-shell="marketplace"]` (B2C Guest): Hợp nhất hoàn toàn về Indochine ấm tin cậy (`--surface-canvas: #FBF9F5`, `--brand-primary: #0D2E28`, `--brand-cta: #C05621`, hỗ trợ Dark Mode `#0E1715`), xóa tình trạng xé đôi Indochine vs Slate/Indigo.
  - `[data-shell="pms-ops"]` (B2B PMS): Mật độ cao, sắc nét (`--brand-primary: #059669`), hỗ trợ Dark Mode ca đêm (`#0B1120` / `#111827`) đầy đủ cho mọi badge/cảnh báo `rose`/`sky`/`amber`, **cấm** dùng `backdrop-blur` / Glassmorphism trên nút/dropdown/card vận hành.
  - `[data-shell="governance"]` (Platform SuperAdmin): Tông điều hành quyền lực (`--brand-primary: #1E3A5F`, `--brand-accent: #4338CA`) tách biệt hoàn toàn với PMS chi nhánh.
- **NFR-DS03 (Tokenization & Dark Mode):** Thay `154` raw hex color trong `app/` bằng CSS variables Layer 1–3; bật `darkModeSelector: '[data-theme="dark"]'` trong `app.config.ts` và `tailwind.config.js`; gỡ rule `.fixed.inset-0 { z-index: 100 !important }` trong `styles.css:628-650`, thay bằng thang `--z-sticky (20)` -> `--z-drawer (45)` -> `--z-modal (65)` -> `--z-popover (80)` -> `--z-toast (100)`.
- **NFR-DS04 (No Emoji Icons & Honest Data):** Thay toàn bộ `77+` dòng emoji cấu trúc trên `13` tệp bằng PrimeIcons (`pi pi-*`) hoặc SVG thống nhất; 100% hình ảnh, đánh giá, số lượng, ưu đãi phải lấy từ API thật hoặc hiển thị empty-state trung thực.

### 4.2. Accessibility, Touch & Responsive (`NFR-A11Y-*`)
- **NFR-A11Y01 (WCAG 2.1 AA):** Độ tương phản chữ thường tối thiểu **4.5:1** (`--text-muted: #475569` trên nền sáng thay `slate-400`); 100% nút icon-only (`55` nút hiện thiếu) phải có `aria-label`; 100% phần tử tương tác (`14` `<div>` clickable hiện tại) phải là `<button>`/`<a>` thật hoặc có đủ `role/tabindex/keydown`; 100% modal/drawer (`17` tệp thiếu `cdkTrapFocus`, `11` tệp thiếu `role="dialog" aria-modal="true"`) phải khóa focus, đóng bằng `Escape` và trả focus về trigger; thêm skip-link cho `admin-layout.ts` & `auth-layout.ts`; giữ `focus-visible:ring-2` (xóa lạm dụng `outline-none`).
- **NFR-A11Y02 (Touch Target >= 44px):** Mọi nút bấm, link điều hướng, nút phân trang, sao đánh giá, nút hành động mobile trên `/housekeeping` (`262` controls `<44px` hiện tại) phải đạt tối thiểu **`44×44px`** với khoảng cách tối thiểu `8px` (`gap-2`); loại bỏ hover-only traps (`opacity-0 group-hover:opacity-100`).
- **NFR-A11Y03 (Responsive & Reduced Motion):** Không tràn ngang tại `375 / 768 / 1024 / 1440px` và zoom 200%; `ai-concierge-chat` co giãn `w-[calc(100vw-2rem)] sm:w-[420px]`; `29` bảng dữ liệu thô chuyển sang `<p-table>` hoặc responsive card stack trên mobile có `aria-sort`; bổ sung `@media (prefers-reduced-motion: reduce)` toàn cục và bỏ `animate-pulse` vô hạn khỏi chấm trạng thái tĩnh.
- **NFR-A11Y04 (Performance & CLS):** 100% thẻ `<img>` (`23/23`) phải khai báo `width`/`height` và `loading="lazy"` (hoặc `NgOptimizedImage`, riêng hero dùng `fetchpriority="high"`); áp dụng `cdk-virtual-scroll` cho Audit Logs, Timeline phòng & Gantt đặt phòng khi danh sách lớn.

### 4.3. Kiến trúc Frontend Angular 22 (`NFR-NG-*` — `AGENTS.md §3`)
- **NFR-NG01:** 100% `@Component` (`70/70`, gồm `24` component hiện thiếu) phải dùng `ChangeDetectionStrategy.OnPush` và Standalone Signals (`input()`/`output()`).
- **NFR-NG02:** Xử lý teardown cho `132` lời gọi `.subscribe()` trần bằng `takeUntilDestroyed(this.destroyRef)` hoặc chuyển sang Signal/async pipeline; loại bỏ `113` kiểu `any` và `2` `$any()`; 0 `HttpClient`/`fetch()` trực tiếp ngoài `core/services/`.
- **NFR-NG03:** Áp dụng đồng bộ Shared Registry (`<app-page-header>`, `<app-stat-card>`, `<app-status-badge>` bỏ dynamic Tailwind string, `<app-pagination>`, `<app-empty-state>` sửa 3 chỗ truyền sai `icon=`, `<app-form-field>` cho toàn bộ form trọng yếu + `UnsavedChangesGuard` `CanDeactivate`, và dùng 100% pipe `businessDate`/`businessDateTime` chuẩn `Asia/Ho_Chi_Minh`).

---

## 5. Kịch Bản Nghiệm Thu (Acceptance Scenarios — `Given / When / Then`)

1. **Scenario S1 — Bảo mật Print Documents & Query Filter Loyalty (`GAP-A02`, `GAP-A03`, `GAP-C01`, `GAP-C02`):**
   - **Given** khách hàng A đăng nhập (`GlobalRole = Customer`, `TenantId = null`) và có 1 thẻ thành viên + 1 hóa đơn tại Khách sạn X, còn khách hàng B có hóa đơn `invB`.
   - **When** khách A gọi `GET /api/guest/profile` và `GET /api/guest/invoices`, sau đó cố gọi `GET /api/guest/invoices/{invB}/print` hoặc gọi ẩn danh `GET /api/print/template-config` không có `tenantId`.
   - **Then** API trả về đúng hồ sơ điểm và danh sách hóa đơn của A (`HTTP 200`), trả **`403/404`** khi A đòi xem `invB`, và `GET /api/print/template-config` trả **`401/403`** thay vì trả dữ liệu Tenant đầu tiên trong DB.

2. **Scenario S2 — SuperAdmin Isolation & Platform Governance (`GAP-C03`, `GAP-C04`, `GAP-C05`, `GAP-C11`):**
   - **Given** tài khoản `SuperAdmin` đăng nhập thành công.
   - **When** mở Admin portal (`[data-shell="governance"]`), bấm xem danh sách đối tác (`/tenants`) và thử gọi trực tiếp một API nghiệp vụ chi nhánh (như `PUT /api/print/template-config`) mà chưa có `X-Support-Grant-Id`.
   - **Then** sidebar chỉ hiện các module Platform (`Overview`, `Tenants`, `Plans`, `Contracts`, `Banners`, `AI Usage`, `Support`), trang `/tenants` tải dữ liệu thật từ `/api/platform/tenants`, và API nghiệp vụ của Tenant từ chối với **`403 Forbidden`** (chỉ mở phạm vi đọc/chẩn đoán khi có `SupportAccessGrant` còn hiệu lực).

3. **Scenario S3 — Walk-in Atomic Check-in -> Housekeeping -> Invoice Check-out (`GAP-B03`, `GAP-B04`, `GAP-B05`):**
   - **Given** phòng 201 đang ở trạng thái `Clean`.
   - **When** lễ tân tạo đặt phòng Walk-in trên `/rooms`, sau đó thêm 1 nước suối vào Folio và bấm Check-out thu đủ tiền.
   - **Then** khi tạo Walk-in, đơn ở trạng thái `CheckedIn`, phòng thành `Occupied` và sinh `SmartLockPin`; khi Check-out thành công, đơn thành `CheckedOut`, hệ thống tự sinh `Invoice` + `InvoiceItem` (tách đúng VAT% của cơ sở), tự sinh 1 `HousekeepingTask` ở trạng thái `Pending` cho phòng 201, và bấm "In hóa đơn" mở `/print/invoice/{id}` hiển thị đầy đủ không lỗi `undefined`.

4. **Scenario S4 — RBAC Persistence Không `localStorage` & CRM Không Ghi Đè Snapshot (`GAP-B06`, `GAP-B07`):**
   - **Given** Owner sửa ma trận phân quyền của Custom Role `Kế toán` trên `/roles` và cập nhật ghi chú `"Khách VIP"` cho khách hàng trên `/guests`.
   - **When** mở phiên trình duyệt ẩn danh (Incognito) đăng nhập tài khoản nhân viên Kế toán đó, và mở lại chi tiết các đơn đặt phòng gần nhất của vị khách kia.
   - **Then** quyền của nhân viên Kế toán phản ánh đúng ma trận đã lưu trong PostgreSQL; cột `Reservation.Notes` vẫn giữ nguyên vẹn JSON `ReservationSnapshot` (ngày/giờ thuê, `LookupToken`, breakdown giá) trong khi ghi chú CRM được lưu tại bảng `GuestProfile`.

5. **Scenario S5 — B2C Booking End-to-End Trung Thực, Promo/Điểm & VNPay Return (`GAP-A05`, `GAP-A06`, `GAP-A11`, `GAP-A14`):**
   - **Given** khách sạn đã cấu hình 1 khuyến mãi `PromoCode`, 1 tài khoản ngân hàng VietQR thật, và 0 đánh giá trước đó.
   - **When** khách tìm kiếm cơ sở, chọn phòng, nhập `PromoCode` + `PointsToRedeem` tại `/booking/hold`, tạo đơn và thanh toán qua VNPay quay lại `/booking/status/:token?vnp_ResponseCode=00`.
   - **Then** trang chi tiết hiển thị `"Chưa có đánh giá"` (không hiện `4.9` giả), giá giữ chỗ trừ đúng giảm giá khuyến mãi & điểm thưởng, và sau khi VNPay redirect về trang trạng thái, frontend gọi `GET /api/public/payments/vnpay/return` xác thực chữ ký và hiển thị kết quả thanh toán rõ ràng.

6. **Scenario S6 — UI/UX Pro Max Accessibility, Touch `>= 44px` & Chain HQ F5 (`GAP-B22`, `GAP-C17`, `US-U01`):**
   - **Given** nhân viên buồng phòng dùng màn hình `375px` tại `/housekeeping` và Owner chọn chế độ `Chain HQ` rồi bấm `F5`.
   - **When** kiểm tra kích thước nút thao tác, điều hướng bàn phím qua các modal, và tải lại trang.
   - **Then** mọi nút hành động buồng phòng đạt tối thiểu `44×44px` không tràn ngang; mọi modal khóa focus bằng `cdkTrapFocus` và đóng được bằng `Escape`; và sau F5, Owner vẫn đứng nguyên ở chế độ `Chain HQ` (`activePropertyId() === null`) chứ không bị nhảy về chi nhánh 1.

---

## 6. Quyết Định Sản Phẩm / Thiết Kế Cần Xác Nhận Tại Gate G0 (Open Decisions)

Trước khi mở code triển khai (Wave 1+), Product Owner cần chốt 6 quyết định sau:

| Mã Gate | Câu hỏi / Phương án Cần Chốt | Phương án Đề xuất (Recommended) | Tác động nếu chưa chốt |
| :--- | :--- | :--- | :--- |
| **G0-01** | **Chuẩn địa giới hành chính Việt Nam (34 tỉnh/thành mô hình 2 cấp) `[APPROVED — 2026-11-19]`:** Phát hiện độ lệch 3 lớp trên `develop@c297b58`: (1) `DMTinhThanh_2Cap.csv` vẫn giữ 63 tỉnh cũ; (2) `VIETNAM_34_PROVINCES` chọn 34 tỉnh du lịch từ 63 tỉnh cũ (còn Quảng Nam, Bà Rịa-Vũng Tàu, Kiên Giang, Bình Định, Hà Giang... và thiếu 13 tỉnh sáp nhập thật); (3) `RealData34ProvincesSeeder` & `partner-register` còn `"Quận"`, `"Thị trấn"`, `"63 đơn vị"`. | **ĐÃ CHỐT (User Approved):** Chuẩn hóa **100% toàn hệ thống** (CSV nhúng, API `/api/locations`, B2B Onboarding/Properties, B2C Search/Showcase, Seeder) theo đúng **34 tỉnh/thành phố chính thức** (11 đơn vị giữ nguyên + 23 đơn vị hợp nhất) và **mô hình chính quyền 2 cấp (`Tỉnh/Thành phố` -> `Phường/Xã/Đặc khu`)** — bỏ hoàn toàn danh mục 63 tỉnh cũ và cấp Quận/Huyện/Thị trấn; ánh xạ tên tỉnh cũ & địa danh nổi tiếng (Phú Quốc/An Giang, Hội An/Đà Nẵng, Vũng Tàu/TP.HCM, Mũi Né/Lâm Đồng, Quy Nhơn/Gia Lai...) qua `TouristZone` + alias tìm kiếm. | Đã chốt, sẵn sàng triển khai đồng bộ trên toàn bộ tầng dữ liệu và giao diện. |
| **G0-02** | **Chính sách đăng nhập Facebook & Bắt buộc Email/SĐT (`GAP-A09`) `[APPROVED — 2026-11-19]`:** Hiện `POST /api/auth/social-login` bị khóa `503`. | **Phương án A:** Ẩn nút Facebook khỏi UI trong Wave 1 để tránh lỗi 503, sau đó triển khai `FacebookLoginCommand` xác thực `appsecret_proof` Graph API riêng (tương tự `GoogleLogin`) ở Wave 3 nếu cần giữ kênh Facebook. | Khách bấm nút Facebook tiếp tục gặp lỗi 503. |
| **G0-03** | **Phạm vi IoT Smart Lock M5 (`GAP-B16`, `ENT-D12`) `[APPROVED — 2026-11-19]`:** `PROJECT.md` mô tả `SmartLockPin`/`SmartLockAccessLog` đầy đủ, nhưng code chỉ có 3 cột trên `Reservation`. | **Phương án A:** Giữ lưu PIN trên `Reservation` + thêm API/UI `RegeneratePin` & `RevokePin` (ghi `AuditLog`) + hiển thị PIN khi `Confirmed` nếu đủ cọc; dời bảng `SmartLockAccessLog` & mô phỏng keypad sang phase Enterprise IoT riêng (cập nhật lại `PROJECT.md`). | Mâu thuẫn giữa tài liệu dự án `PROJECT.md` và mã nguồn thực tế. |
| **G0-04** | **Chính sách Hoàn tiền VNPay & Tỷ lệ Cọc (`GAP-B15`, `GAP-B16`) `[APPROVED — 2026-11-19]`:** Hiện hoàn tiền 100% thủ công và lễ tân hiển thị cọc 50% trong khi backend tính 30%. | **Phương án A:** Chuẩn hóa tỷ lệ cọc thống nhất **30%** (hoặc cấu hình trên `Property`, bỏ hardcode 50% ở `reservations.page.ts`), và giữ quy trình hoàn tiền D23 thủ công có đối soát chứng từ cho tới khi có merchant credential VNPay Refund API. | Sai lệch số tiền cọc thông báo cho khách giữa quầy lễ tân và cổng online. |
| **G0-05** | **Phạm vi Thực thể Treo (`SystemBanner`, `Notification` REST, Đổi lịch Đặt phòng B2C) `[APPROVED — 2026-11-19]`:** Cần chốt mức ưu tiên triển khai vs dọn bỏ. | **Phương án A:** Hoàn thiện `SystemBanner` (cho bảo trì sàn) và `NotificationsController` (`SDD-06 #2.11`) trong Wave 3; phê duyệt spec Đổi lịch đặt phòng (`RescheduleGuestBooking`) trước khi sửa Reservation FSM. | Rủi ro mở rộng scope ngoài kiểm soát nếu thiếu đặc tả chi tiết cho đổi lịch. |
| **G0-06** | **Quy tắc Đánh giá Khách hàng (`GAP-A07`) `[APPROVED — 2026-11-19]`:** Khách đang `CheckedIn` có được viết đánh giá hay bắt buộc `CheckedOut`? | **Phương án A:** Chỉ cho phép gửi đánh giá khi đơn ở trạng thái **`CheckedOut`** (hoặc đang `CheckedIn` có tối thiểu 1 đêm đã lưu trú), tuyệt đối chặn trạng thái `Confirmed` chưa nhận phòng. | Cho phép đánh giá trước khi khách từng bước vào phòng. |

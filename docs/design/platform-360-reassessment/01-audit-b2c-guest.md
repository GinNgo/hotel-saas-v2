# ĐÁNH GIÁ TOÀN DIỆN 360° — PHÂN HỆ KHÁCH HÀNG B2C (GUEST / TRAVELER & MEMBER)

- **Hệ thống:** Hotel SaaS Platform v2 (.NET 10 + Angular 22 Standalone Signals + PostgreSQL 17)
- **Phạm vi đánh giá:** Toàn bộ hành trình end-to-end của **Người dùng là Khách hàng (B2C Guest / Traveler & Registered Member)** gồm Frontend (`apps/routes`, `layouts`, `features/public-booking`, `features/auth`, `features/print`, `core`, `shared`) và Backend (`WebApi`, `Application`, `Infrastructure`, `Domain`).
- **Baseline kiểm tra:** Nhánh `develop`, commit `c297b58` (đọc và xác minh trực tiếp trong mã nguồn hiện hành).
- **Tài liệu đối chiếu:**
  - `docs/srs/02-actors-personas.md`, `docs/srs/03-user-stories.md`
  - `docs/design/booking-marketplace/spec.md`, `docs/design/experience-foundation/spec.md`, `docs/design/booking-marketplace/guest-account-api.md`
  - Khung đánh giá UI/UX 10 Danh mục Ưu tiên (`ui-ux-pro-max`)
  - *Lưu ý về Spec thay đổi đặt phòng:* File `docs/specs/p3a-reservation-change-spec.md` được nêu trong danh sách tham chiếu **không tồn tại** trên nhánh `develop` tại commit `c297b58` (toàn bộ thư mục `docs/specs/` chưa hiện diện trong repository).

---

## 1. Tóm tắt Điều hành (Executive Summary)

### Bức tranh tổng thể
Phân hệ Khách hàng B2C hiện đang ở trạng thái **chưa sẵn sàng vận hành Production (Not Production-Ready)** dù phần xương sống giao dịch lõi đã có nhiều nỗ lực kỹ thuật tốt (row-lock chống double-booking, idempotency key, giữ phòng 15 phút, tích hợp VNPay HMAC-SHA512 + IPN, chuẩn hóa tiếng Việt không dấu khi tìm kiếm).

Tuy nhiên, quá trình kiểm tra chéo end-to-end từ giao diện Angular đến tầng CQRS/EF Core ở commit `c297b58` phát hiện **ba nghịch lý hệ thống nghiêm trọng**:

1. **Lệch pha Frontend – Backend & Vô hiệu hóa ngầm toàn bộ Guest Portal:**
   - Trong `GuestProfilePage`, toàn bộ liên kết xem chi tiết đặt phòng truyền `Reservation.Id` (GUID) vào route `/booking/status/:token` trong khi backend `GetGuestBookingByTokenQuery` chỉ nhận `ConfirmationCode` hoặc `LookupToken` — gây lỗi **404 100%**.
   - Middleware `TenantPropertyContextMiddleware` chủ đích bỏ qua thiết lập `TenantId` cho `/api/guest/*` (vì Customer không thuộc một Tenant cố định), nhưng `ApplicationDbContext` lại áp dụng Global Query Filter *fail-closed* (`_currentTenantService.TenantId != null`). Vì toàn bộ handler Loyalty & Invoice (`GetMyGuestProfileQueryHandler`, `GetMyPointTransactionsQueryHandler`, `GetMyInvoicesQueryHandler`, `GetGuestInvoicePrintViewQueryHandler`, `EnrollPropertyMembershipCommandHandler`) đều **quên `.IgnoreQueryFilters()`**, mọi khách hàng B2C khi gọi các endpoint này đều nhận về **danh sách rỗng / 0 điểm / 404**.
   - Ngược lại, `GetGuestInvoicePrintViewQueryHandler` **không kiểm tra quyền sở hữu (`UserId`)**, tiềm ẩn lỗi **IDOR** nếu filter được gỡ mà thiếu kiểm soát ownership; và endpoint in voucher `/api/print/voucher/{confirmationCode}` mở `[AllowAnonymous]` chỉ cần mã 6 ký tự, trả về **Email và Số điện thoại nguyên vẹn không che (unmasked PII)** cùng cấu trúc JSON gãy hoàn toàn với `PrintVoucherPage`.

2. **Dữ liệu giả lập / Ngụy tạo tràn lan trên UI (Vi phạm cam kết "Honest Data" của SRS & Design Spec):**
   - Hero section trang chủ hiển thị khách sạn giả `Da Nang Ocean Suites & Spa Resort`, Popular Destinations dùng dữ liệu tĩnh `VIETNAM_34_PROVINCES` với số lượng cơ sở/giá/điểm đánh giá bịa đặt, Bento Grid ghép ảnh bãi biển cho Sa Pa/Đà Lạt, cả Backend (`CuratedGalleriesByType`) lẫn Frontend (`resolvePropertyGallery`, `RoomGalleryService`) tự động bơm ảnh Unsplash và tiện nghi giả khi cơ sở chưa upload dữ liệu thật.
   - Đánh giá mặc định rơi về `4.9` / `4.8` / `5.0` kèm 5 sao vàng cố định; trang `/booking/deals` và `FlashDealsBannerComponent` đọc dữ liệu tĩnh mâu thuẫn mã giảm giá với nhau và hoàn toàn không trừ được tiền trong `PricingCalculator` hay `CreateGuestHoldCommand`.

3. **Đứt gãy các luồng Self-Service & Xác thực tài khoản cơ bản:**
   - Thiếu hoàn toàn **Quên mật khẩu / Đặt lại mật khẩu / Đổi mật khẩu** (`US-1.4` — liên kết `"Quên mật khẩu?"` trên trang `/login` trỏ ngược về `/booking/lookup`).
   - Nút đăng nhập/đăng ký **Facebook** gọi endpoint `POST /api/auth/social-login` đã bị backend khóa cứng trả **HTTP 503**.
   - Thiếu hoàn toàn chức năng **Đổi lịch / Sửa thông tin đặt phòng** (Reschedule / Change Dates / Change Guests).
   - Callback thanh toán **VNPay** chuyển về `/booking/status/:token` nhưng component bỏ qua toàn bộ `vnp_*` query params; **VietQR** rơi về số tài khoản dummy hardcoded `0345678910 / HOTEL SAAS RESORT` trong khi UI hứa hẹn đối soát IPN tự động.

---

## 2. Bảng điểm Sẵn sàng (Readiness Scoreboard)

### 2.1. Điểm sẵn sàng theo 5 Luồng & Từng Màn hình (Thang 0–100)

*Quy ước đánh giá:* **85–100**: Sẵn sàng Production | **65–84**: Khá, cần hoàn thiện/vá | **40–64**: Yếu, gãy nghiệp vụ hoặc nhiều dữ liệu giả | **< 40**: Chặn (Blocked / Broken).

| Luồng / Màn hình | Đường dẫn / Thành phần chính | Điểm (0–100) | Trạng thái | Điểm nghẽn chính |
| :--- | :--- | :---: | :---: | :--- |
| **LUỒNG 1: Discovery & Search** | Tổng hợp Luồng 1 | **52** | Needs Major Work | Dữ liệu giả trên Home; xung đột 63 vs 34 tỉnh; thiếu filter/pagination server-side; maps 1 ghim |
| ↳ Trang chủ B2C | `/booking` (`BookingPageComponent`) | 48 | Needs Major Work | Hero card giả (`Da Nang Ocean Suites`), Bento/Popular giả, `onApplyPromoCode` rỗng, đổi tab RentalType nhảy trang ngay |
| ↳ Khám phá & Bản đồ | `/booking/explore` (`ExploreSearchPage`) | 56 | Needs Major Work | Filter `Guesthouse` luôn ra 0 kết quả; `pageSize:10` giả client-side; Maps embed 1 ghim đơn; thiếu bulk availability |
| ↳ Địa danh & Thương hiệu | `/booking/destinations`, `/booking/brands` | 54 | Needs Major Work | Brands gom nhóm client-side từ `getProperties()`; ảnh zone Unsplash cứng; sai lệch mã tỉnh 63 vs 34 |
| ↳ AI Concierge & Smart Search | `AiConciergeChatComponent` + `AiController` | 45 | Needs Major Work | Gắn nhãn `"Gemini 3.8 Flash"` / `"gemini-2.5-flash"` nhưng thực chất chạy regex/rule tĩnh + hardcode giờ 14:00; tràn màn hình 375px |
| **LUỒNG 2: Property Detail & Deals** | Tổng hợp Luồng 2 | **44** | Needs Major Work | Ảnh/tiện nghi/rating/VAT giả; trang Deals 100% tĩnh không áp dụng được |
| ↳ Chi tiết cơ sở | `/booking/properties/:slug` (`PropertyDetailPage`) | 52 | Needs Major Work | Fallback `4.9/4.8` & 5 sao cứng; hardcode `10% VAT` & giờ nhận/trả; bơm ảnh/tiện nghi giả; lọc sức chứa âm thầm |
| ↳ Kho Ưu đãi & Flash Deals | `/booking/deals` (`PromotionsPageComponent`) | 22 | Blocked / Fake | 100% `of([...])` hardcoded; xung đột mã với `FlashDealsBanner`; không nối với Checkout |
| **LUỒNG 3: Quote, 15-min Hold & Payment** | Tổng hợp Luồng 3 | **50** | Needs Major Work | Logic giữ phòng backend tốt nhưng UI/OTP pre-verify sai, VietQR dummy, VNPay return chưa xử lý |
| ↳ Tạo Giữ chỗ 15 phút | `/booking/hold` (`BookingHoldPage`) | 58 | Needs Major Work | `isUserPreVerified` check sai field; thiếu đổi điểm (`PointsToRedeem`), mã giảm giá, ghi chú; ép 1 phòng/lượt; PayAtHotel 15p vô lý |
| ↳ Xác thực SMS OTP | `PhoneOtpModalComponent` | 46 | Needs Work | Cố định tiền tố `+84` cho mọi quốc gia; lộ nút fill OTP test vô điều kiện; thiếu `role="dialog"`/`aria-modal` |
| ↳ Thanh toán VNPay & VietQR | `PaymentsController` + `BookingStatusPage` | 42 | Blocked / Broken | VNPay return params bị bỏ qua; VietQR fallback TK giả `0345678910` nhưng hứa tự động IPN; `BankTransfer` bị rơi rụng |
| **LUỒNG 4: Post-Booking & Self-Service** | Tổng hợp Luồng 4 | **43** | Blocked / Needs Work | Gãy Print Voucher; thiếu Đổi lịch đặt phòng; Hủy thiếu verify; Review sai trạng thái/không sửa được |
| ↳ Tra cứu công khai | `/booking/lookup` (`BookingLookupPage`) | 52 | Needs Work | Phủ nhận API đánh giá dù Backend đã có; mẫu in inline cứng `LUXESTAY` + `"bao gồm thuế"` |
| ↳ Trạng thái & Quản lý đơn | `/booking/status/:token` (`BookingStatusPage`) | 54 | Needs Work | Ẩn Smart Lock PIN ở `Confirmed`; không sửa ngày/giờ/phòng; cancel verify tùy chọn; review mất state sau F5 |
| ↳ Phiếu xác nhận in ấn | `/print/voucher/:token` (`PrintVoucherPage`) | 18 | Blocked / Broken | Lệch toàn bộ contract JSON Backend-Frontend; `[AllowAnonymous]` theo code 6 ký tự lộ PII unmasked |
| **LUỒNG 5: Member Account & Auth** | Tổng hợp Luồng 5 | **34** | Blocked / Critical Fail | Link đơn 404; Loyalty/Invoice 0 rows do QueryFilter + IDOR; Facebook 503; thiếu Quên mật khẩu |
| ↳ Hồ sơ Khách & Hội viên | `/booking/profile` (`GuestProfilePage`) | 28 | Blocked / Critical Fail | Link `b.id` ra 404; Loyalty/VAT/Ledger/Invoices mất sạch ở UI lẫn QueryFilter Backend; banner Email đi vào ngõ cụt |
| ↳ Đăng nhập / Đăng ký / Email | `/login`, `/register`, `/confirm-email` | 38 | Blocked / Critical Fail | `"Quên mật khẩu?"` trỏ `/booking/lookup`; Facebook 503; lộ password demo; validator password lệch; không resend email |

---

### 2.2. Chấm điểm theo 10 Danh mục Ưu tiên `ui-ux-pro-max`

| # | Danh mục (`ui-ux-pro-max`) | Mức độ ưu tiên | Điểm | Đánh giá tuân thủ & Vi phạm tiêu biểu |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Accessibility** | CRITICAL | **54/100** | Modal chuẩn (`PhotoGalleryModal`, `RoomDetailModal`) dùng `cdkTrapFocus` tốt, nhưng `PhoneOtpModal` thiếu `role="dialog"` / `aria-modal` / `aria-label` nút đóng (`phone-otp-modal.component.ts:29-50`), `BookingDatePicker` thiếu `for` trên toàn bộ `<label>` (`booking-date-picker.component.ts:35-208`), Recent Searches dùng `<div (click)>` lồng `<button>` (`booking-filter-bar.component.ts:209-235`), sao đánh giá phụ trong `BookingStatusPage` không đủ nhãn A11y rõ ràng. |
| **2** | **Touch & Interaction** | CRITICAL | **60/100** | Nhiều nút đáp ứng `min-h-11` (`RoomDetailModal`), nhưng nút tăng/giảm số khách ở `BookingFilterBarComponent:339,351` chỉ rộng `w-7 h-7` (28×28px < 44×44px tối thiểu). Chuyển tab Thuê theo giờ/Qua đêm/Theo ngày trên Home gọi `emitSearch()` chuyển trang ngay (`booking-filter-bar.component.ts:732`), gây hụt trải nghiệm khi khách mới chọn chế độ thuê. |
| **3** | **Performance** | HIGH | **48/100** | `GetProperties` trả toàn bộ danh sách cơ sở thay vì phân trang server (`PublicController.cs:57`), `GetTenantBrands()` tải lại toàn bộ properties rồi gom nhóm client (`public-booking.service.ts:381`), `GetPropertyReviewsQuery` tải toàn bộ review vào RAM trước khi `.Skip().Take()` (`GetPropertyReviewsQuery.cs:63-100`). Chưa có bulk availability check cho danh sách kết quả tìm kiếm. |
| **4** | **Style Selection** | HIGH | **55/100** | Pha trộn ngôn ngữ thiết kế thiếu đồng nhất: `PropertyDetailPage` dùng tông `#0D2E28` / `#FBF9F5` / `#C05621` (Editorial), trong khi `GuestProfilePage`, `BookingHoldPage`, `BookingStatusPage` dùng Slate + Indigo, còn tồn tại thương hiệu cũ `LUXESTAY` (`booking-lookup.page.ts:420`, `booking-status.page.ts:1160,1331`, `confirm-email.page.ts:65`). Một số nút CTA và nhãn ghi thời gian/giá thiếu trung thực (stock Unsplash giả làm ảnh thật). |
| **5** | **Layout & Responsive** | HIGH | **62/100** | `AiConciergeChatComponent:21,47` đặt `w-[360px]` cố định kèm `right-5` (20px) => tổng 380px, **tràn mép trái màn hình mobile 375px**. Chia cột grid nhìn chung đáp ứng tốt ở `ExploreSearch` và `PropertyDetail`, nhưng bảng bản đồ split-view chỉ render iframe 1 ghim tĩnh thay vì cụm marker. |
| **6** | **Typography & Color** | MEDIUM | **66/100** | Bảng màu sáng nhìn chung rõ ràng; dùng `font-mono` cho giá/mã giữ chỗ hợp lý. Tuy nhiên `AuthLayoutComponent:45` hardcode `bg-white` bất chấp trạng thái Dark Mode của `ThemeService`, gây chói và lỗi tương phản khi bật giao diện tối. |
| **7** | **Animation** | MEDIUM | **74/100** | `PhotoGalleryModal` tôn trọng `prefers-reduced-motion`; các hiệu ứng hover/transition ngắn gọn `150–200ms`. Tuy nhiên hero card `booking.page.ts:210` zoom ảnh và banner flash deal có đồng hồ đếm ngược giả chạy mỗi giây gây cảm giác gấp gáp nhân tạo. |
| **8** | **Forms & Feedback** | MEDIUM | **52/100** | `FormFieldComponent` xử lý inline validation chuẩn mực ở `BookingHoldPage`, nhưng `RegisterPage:375` chỉ validate `minLength(8)` khiến khách bấm submit mới bị Backend reject vì thiếu chữ hoa/số/ký tự đặc biệt. Nút `"Cập nhật Email ngay"` ở `GuestProfilePage:185` mở form khóa không cho sửa Email; `BookingLookupPage:371` báo sai tính năng Review chưa có. |
| **9** | **Navigation Patterns** | HIGH | **42/100** | Nhiều luồng điều hướng bị gãy: `GuestProfilePage:469,540` trỏ sai `b.id` ra 404; `LoginPage:106` link `"Quên mật khẩu?"` sang `/booking/lookup`; `PromotionsPage:192` nhấn áp dụng mã chỉ về `/booking` làm mất mã giảm giá; không có đường dẫn tới `/print/voucher/:token` từ Lookup hay Status; không có route `/booking/vnpay-return`. |
| **10** | **Charts & Data** | LOW | **58/100** | KPI Strip và thanh tiến trình đánh giá có định dạng rõ nhưng **hiển thị số liệu giả fallback** (`4.9`, `4.8`, `88+ chỗ nghỉ`, `1.500+ khách sạn`), thiếu trạng thái "Chưa có dữ liệu" trung thực ở nhiều biểu đồ/thẻ thống kê; dữ liệu địa lý 63 vs 34 tỉnh thiếu nhất quán. |

---

## 3. Phân tích Chi tiết Các Vấn đề (P0 → P1 → P2 → P3)

### NHÓM P0 — CRITICAL / BLOCKER (Gãy luồng cốt lõi, lỗ hổng bảo mật, hỏng dữ liệu)

#### [P0-01] Link "Xem chi tiết" trong Hồ sơ Khách truyền sai ID gây lỗi 404 100%
- **Luồng / UI-UX Category:** Luồng 5 (Member Account) — Navigation Patterns
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/member/guest-profile.page.ts:469` và `:540`: `[routerLink]="['/booking/status', b.id]"`
  - `frontend/src/app/core/models/guest-account.model.ts`: `GuestBookingSummaryDto` chỉ có `id`, `reference`, không có `lookupToken`
  - `backend/src/HotelSaas.Application/Guest/Queries/GetGuestBookings/GetGuestBookingsQueryHandler.cs:50-68`: DTO trả về `r.Id`, `r.ConfirmationCode`, không trích xuất `LookupToken` từ `r.Notes`
  - `backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs:42-54`: Chỉ khớp `r.ConfirmationCode` hoặc `snapshot.LookupToken`, **không** khớp `r.Id` (GUID)
- **Nguyên nhân gốc rễ:** Frontend chuyển hướng từ lịch sử đặt phòng cá nhân sang trang `/booking/status/:token` công khai nhưng truyền `ReservationId` (GUID) thay vì `LookupToken` hoặc `ConfirmationCode`, và bản thân DTO `GetGuestBookingsQueryHandler` cũng không trả về `LookupToken` (hoặc trang chi tiết thành viên chưa gọi `/api/guest/bookings/{id}`).
- **Tác động:** Khách đã đăng nhập bấm vào bất kỳ đơn đặt phòng nào trong trang Hồ sơ đều gặp màn hình lỗi "Không tìm thấy thông tin đặt phòng" (HTTP 404).
- **Giải pháp khuyến nghị:** Tạo trang/chế độ xem chi tiết đơn đã xác thực gọi `GET /api/guest/bookings/{id}` (kèm xác thực ownership theo `GuestUserId`) cho thành viên; hoặc chỉ trả `LookupToken` an toàn khi cần qua endpoint xác thực `/api/guest/bookings/{id}` thay vì nhồi token công khai vào danh sách.

---

#### [P0-02] Global Query Filter của `ApplicationDbContext` vô hiệu hóa 100% API Loyalty & Hóa đơn của Customer
- **Luồng / UI-UX Category:** Luồng 5 (Member Account) — Kiến trúc Đa Tenant & Dữ liệu
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs:118-125`: Nhánh `/api/guest` và `/api/v1/loyalty` không gán `tenantService.TenantId` (giữ `null` vì B2C Customer không thuộc Tenant nhân sự)
  - `backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs:172-196`: `ApplyTenantQueryFilter` và `ApplyPropertyQueryFilter` thực thi `_currentTenantService.TenantId != null && e.TenantId == _currentTenantService.TenantId` — trả về **0 dòng** khi `TenantId == null`
  - Các entity `GuestLoyaltyMembership` (`GuestLoyaltyMembership.cs:11`), `LoyaltyPointTransaction` (`LoyaltyPointTransaction.cs:10`), `Property` (`Property.cs:12`), `Invoice` (`Invoice.cs:10`) implement `ITenantScopedEntity`; `Reservation` (`Reservation.cs:9`) implement `IPropertyScopedEntity`
  - Các handler **bỏ quên `.IgnoreQueryFilters()`**:
    - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs:48,81`
    - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyPointTransactions/GetMyPointTransactionsQueryHandler.cs:36,47`
    - `backend/src/HotelSaas.Application/Loyalty/Commands/EnrollPropertyMembership/EnrollPropertyMembershipCommandHandler.cs:40,50`
    - `backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs:51,67`
    - `backend/src/HotelSaas.Application/Loyalty/Queries/GetGuestInvoicePrintView/GetGuestInvoicePrintViewQueryHandler.cs:30,49`
  - (So sánh đối chứng: `GetGuestBookingsQueryHandler.cs:34` có gọi `.IgnoreQueryFilters()`)
- **Nguyên nhân gốc rễ:** Áp dụng Global Query Filter theo `TenantId` của nhân sự PMS nhưng không nhất quán bổ sung `.IgnoreQueryFilters()` (kèm lọc chặt theo `_userContext.UserId`) ở các handler cross-tenant dành riêng cho Customer.
- **Tác động:** Mọi khách hàng B2C gọi `GET /api/guest/profile`, `GET /api/guest/loyalty-ledger`, `GET /api/guest/invoices` luôn nhận mảng rỗng / 0 điểm; gọi `POST /api/guest/memberships/enroll` luôn lỗi 404 `"Cơ sở lưu trú không tồn tại"`; gọi `GET /api/guest/invoices/{id}/print` luôn lỗi 404.
- **Giải pháp khuyến nghị:** Bổ sung `.IgnoreQueryFilters()` kèm điều kiện lọc tường minh theo `UserId == _userContext.UserId` (tránh tự động nối `GuestPhone`/`GuestEmail` khi chưa xác minh như tại `GetMyInvoicesQueryHandler.cs:58-60`), và giới hạn `[Authorize(Roles = "Customer")]` (hoặc kiểm tra role phù hợp) trên `GuestPortalController`.

---

#### [P0-03] Lỗ hổng Bảo mật IDOR ở API In Hóa đơn Khách & Lộ PII Unmasked qua API In Voucher Công khai
- **Luồng / UI-UX Category:** Luồng 4 & Luồng 5 — Bảo mật & Quyền riêng tư
- **Bằng chứng (`file:line`):**
  - **IDOR ở Hóa đơn Khách:** `backend/src/HotelSaas.Application/Loyalty/Queries/GetGuestInvoicePrintView/GetGuestInvoicePrintViewQueryHandler.cs:20-57` — Không inject `ICurrentUserContext`, truy vấn trực tiếp `Invoices.FirstOrDefaultAsync(i => i.Id == request.InvoiceOrReservationId)` hoặc `Reservations.FirstOrDefaultAsync(r => r.Id == ...)` mà không kiểm tra `GuestUserId`. Đồng thời `GuestPortalController.cs:23` chỉ gắn `[Authorize]` (không khóa role, nhân viên một tenant nếu có `TenantId` trong token hoặc sau khi sửa `IgnoreQueryFilters()` có thể đọc hóa đơn của người khác qua GUID).
  - **Lộ PII Unmasked ở Print Voucher:** `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs:170-206` — Endpoint `[AllowAnonymous] GET /api/print/voucher/{confirmationCode}` chỉ tra cứu bằng `ConfirmationCode` 6 ký tự ngắn (`RES-XXXXXX`, có thể brute-force) và trả thẳng **full plaintext `GuestName`, `GuestEmail`, `GuestPhone`** (`line 204-206`), trái ngược hoàn toàn với cơ chế che PII của `GetGuestBookingByTokenQuery.cs:206-208` và logic che PII ở chính `PrintDocumentsController.cs:141-142` cho các document khác.
- **Nguyên nhân gốc rễ:** Thiếu kiểm soát ownership (`_userContext.UserId`) trong `GetGuestInvoicePrintViewQueryHandler` và áp dụng nhầm `[AllowAnonymous]` trả toàn bộ PII cho mã xác nhận ngắn `ConfirmationCode` thay vì yêu cầu `LookupToken` bảo mật 48 ký tự hex (hoặc che PII).
- **Tác động:** Kẻ tấn công có thể dò `RES-XXXXXX` để thu thập hàng loạt tên, email, số điện thoại của khách hàng; người dùng đã xác thực có thể xem hóa đơn VAT & thông tin công ty của khách khác nếu biết GUID.
- **Giải pháp khuyến nghị:**
  1. Inject `ICurrentUserContext` vào `GetGuestInvoicePrintViewQueryHandler`, bắt buộc `res.GuestUserId == _userContext.UserId` (khi dùng Customer portal).
  2. Chuyển `/api/print/voucher/{token}` sang tra cứu bắt buộc bằng `LookupToken` (hoặc yêu cầu đăng nhập đúng chủ đơn) và luôn áp dụng `PiiMaskingHelper` cho mọi endpoint `[AllowAnonymous]`.

---

#### [P0-04] Gãy hoàn toàn Contract `/print/voucher/:token` giữa Backend & Frontend
- **Luồng / UI-UX Category:** Luồng 4 (Post-Booking) — Chức năng & Tích hợp
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/app.routes.ts:392-394`: Định nghĩa route `/print/voucher/:token`
  - `frontend/src/app/core/services/print-documents.service.ts:15-55`: Gọi `GET /api/print/voucher/${confirmationCode}`
  - `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs:173-220`: Nhận `confirmationCode` (chỉ so khớp `r.ConfirmationCode`, **không** nhận `LookupToken` 48 ký tự) và trả `PrintableVoucherDto` với các field: `Status`, `QrCodeData`, `PolicyNote`, `NumberOfGuests`, `PropertyPhone`.
  - `frontend/src/app/features/print/print-voucher.page.ts:54-106`: Template đọc các field **không tồn tại** trên `PrintableVoucherDto` của Backend: `v.holdStatus` (`:54`), `v.guestCount` (`:69`), `v.roomCount` (`:76`), `v.rentalType` (`:77`), `v.qrCodeUrl` (`:87-88`), `v.hotelInfo.hotline` (`:98`), `v.hotelInfo.footerNote` (`:106`).
  - `frontend/src/app/features/public-booking/booking-status.page.ts:2512` & `booking-lookup.page.ts`: Không có bất kỳ link hay nút nào điều hướng tới `/print/voucher/:token`.
- **Nguyên nhân gốc rễ:** Backend viết DTO mới (`PrintableVoucherDto`) nhưng không cập nhật khớp model `PrintVoucherDto` của Frontend, đồng thời trang `BookingStatusPage` & `BookingLookupPage` tự vẽ bản in inline `LUXESTAY` rồi gọi `window.print()`.
- **Tác động:** Mở `/print/voucher/{lookupToken}` luôn bị 404 (vì backend chỉ tìm theo `ConfirmationCode`); nếu mở theo `ConfirmationCode` thì dữ liệu bị rỗng hoặc lỗi runtime khi truy cập `v.hotelInfo.hotline` / `v.hotelInfo.footerNote` (`hotelInfo` là `undefined`).
- **Giải pháp khuyến nghị:** Thống nhất một DTO `PrintVoucherDto` duy nhất giữa Backend-Frontend, hỗ trợ tra cứu an toàn bằng `LookupToken` (hoặc session đã đăng nhập), tạo ảnh QR hợp lệ và nối nút "In phiếu xác nhận" từ `BookingStatusPage` sang `/print/voucher/:token`.

---

#### [P0-05] Luồng Callback VNPay bị đứt đoạn: Thiếu route `/booking/vnpay-return` & `BookingStatusPage` bỏ qua tham số trả về
- **Luồng / UI-UX Category:** Luồng 3 (Payment) — Chức năng & Navigation Patterns
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs:31`: Default return URL là `http://localhost:4200/booking/vnpay-return`
  - `frontend/src/app/app.routes.ts:64-150`: **Không tồn tại** route `vnpay-return` dưới `/booking`
  - `frontend/src/app/features/public-booking/booking-status.page.ts:2314`: Frontend tự ghi đè `returnUrl = ${window.location.origin}/booking/status/${detail.lookupToken}`
  - `frontend/src/app/features/public-booking/booking-status.page.ts:1738-1745`: `ngOnInit` chỉ đọc `params.get('paymentMethod')`, **hoàn toàn không đọc** `vnp_ResponseCode`, `vnp_TransactionStatus` hay gọi `GET /api/public/payments/vnpay/return` (`PaymentsController.cs:368-373`)
- **Nguyên nhân gốc rễ:** Backend cung cấp `GET /api/public/payments/vnpay/return` để xác thực chữ ký HMAC-SHA512 của kết quả return, nhưng Frontend không cấu hình route `/booking/vnpay-return` lẫn không parse tham số `vnp_*` tại `/booking/status/:token`.
- **Tác động:**
  1. Nếu VNPay trả về theo default returnUrl, người dùng rơi vào trang trắng / wildcard redirect về `/booking`.
  2. Khi trả về `/booking/status/:token?vnp_ResponseCode=24` (khách hủy thanh toán trên cổng VNPay) hoặc `00` (thành công), UI không hiển thị thông báo kết quả giao dịch tức thì; trong môi trường local/staging không nhận được VNPay IPN server-to-server, đơn mãi ở trạng thái `PendingPayment` dù khách vừa quét thẻ thành công.
- **Giải pháp khuyến nghị:** Thêm xử lý đọc query params `vnp_*` trong `BookingStatusPage` (hoặc bổ sung route `/booking/vnpay-return`), gọi `/api/public/payments/vnpay/return` để xác thực chữ ký với backend và phản hồi rõ ràng thành công / thất bại / hủy giao dịch ngay trên UI (kèm đối soát đồng bộ với IPN).

---

#### [P0-06] VietQR sử dụng tài khoản ngân hàng giả (`0345678910 / HOTEL SAAS RESORT`) trong khi UI cam kết tự động xác nhận IPN
- **Luồng / UI-UX Category:** Luồng 3 (Payment) — Trung thực dữ liệu & Giao dịch tài chính
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/booking-status.page.ts:2279-2283`: Gọi `generateVietQr` chỉ truyền `{ amount, confirmationCode, reservationId }`, **không truyền** `bankBin`, `accountNumber`, `accountName` của cơ sở lưu trú.
  - `backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs:414-417`: Backend rơi vào fallback cứng: `BankBin: "970422"`, `AccountNumber: "0345678910"`, `AccountName: "HOTEL SAAS RESORT"`.
  - `frontend/src/app/features/public-booking/booking-status.page.ts:977`: UI hiển thị lời hứa kỹ thuật sai sự thật: `"Đối soát tức thì & xác nhận tự động qua Webhook IPN"` (trên thực tế hệ thống chỉ có Webhook IPN cho VNPay; chuyển khoản VietQR cần thu ngân/lễ tân xác nhận thủ công qua `/api/public/bookings/{token}/confirm`).
- **Nguyên nhân gốc rễ:** `Property` / `Tenant` chưa cấu hình hoặc chưa truy vấn tài khoản ngân hàng thụ hưởng thật ở `PaymentsController.GenerateVietQr`, còn Frontend dán nhãn chung luồng VietQR và VNPay vào cùng mô tả Webhook IPN.
- **Tác động:** Khách hàng chuyển tiền thật qua QR sẽ chuyển vào số tài khoản giả `0345678910` (hoặc không khớp tài khoản cơ sở) và chờ vô vọng vì không hề có Webhook ngân hàng tự động cập nhật trạng thái đơn trước khi hết giữ phòng 15 phút.
- **Giải pháp khuyến nghị:** Truy vấn tài khoản ngân hàng đã cấu hình từ `Property`/`Tenant` phía Backend (fail-closed không sinh VietQR nếu cơ sở chưa cấu hình ngân hàng); tách rõ UI: VNPay là thanh toán cổng tự động, còn VietQR cần ghi rõ trạng thái chờ kế toán/lễ tân xác nhận (trừ khi tích hợp webhook Sepay/Casso thật).

---

#### [P0-07] Hủy đặt phòng thiếu lớp xác thực bắt buộc & Lỗ hổng bảo mật luồng Đánh giá ẩn danh
- **Luồng / UI-UX Category:** Luồng 4 (Post-Booking) — Bảo mật & Nghiệp vụ
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Public/Commands/CancelGuestBooking/CancelGuestBookingCommandHandler.cs:121-138`: Chỉ kiểm tra khớp Email/SĐT khi `!string.IsNullOrWhiteSpace(request.VerificationEmailOrPhone)` — nếu bỏ trống thì cho phép hủy ngay!
  - `frontend/src/app/features/public-booking/booking-status.page.ts:1568-1576`: Gắn chú thích `(Optional)` / `(Không bắt buộc)` cho ô xác minh Email/SĐT khi hủy phòng.
  - `backend/src/HotelSaas.Application/Reviews/Commands/SubmitGuestReview/SubmitGuestReviewCommand.cs:62-88,118-134`:
    1. Chấp nhận cả `ConfirmationCode` 6 ký tự (line 63, 78) thay vì bắt buộc `LookupToken` bảo mật như `Cancel` hay `ExtendHold`.
    2. Cho phép gửi đánh giá ngay khi đơn ở trạng thái `Confirmed` (line 88) — tức là khách chưa từng Check-in/lưu trú đã đánh giá công khai (`IsPublished = true`).
    3. Nếu đơn không gắn `GuestUserId` và chưa có user khớp email, handler âm thầm tạo tài khoản `User` mới trong DB với `PasswordHash = string.Empty` (line 127).
- **Nguyên nhân gốc rễ:** Thiết kế xác thực nới lỏng để tiện test nhưng mở rộng bề mặt tấn công (bất kỳ ai lỡ xem được link hoặc lịch sử trình duyệt chứa `lookupToken` đều hủy được đơn không cần xác nhận lại SĐT/Email; kẻ xấu dò mã `RES-XXXXXX` để spam review đơn chưa ở).
- **Tác động:** Rủi ro phá hoại đơn đặt phòng và thao túng điểm đánh giá (Review Spam) bằng mã ngắn; tạo ra bản ghi `User` rỗng mật khẩu gây rác dữ liệu xác thực.
- **Giải pháp khuyến nghị:**
  1. Nếu người dùng chưa đăng nhập đúng chủ đơn (`GuestUserId`), bắt buộc nhập khớp Email hoặc 4 số cuối/toàn bộ SĐT đã đặt phòng mới cho hủy.
  2. Chặn `SubmitGuestReviewCommand` với `ConfirmationCode` ngắn (bắt buộc `LookupToken` hoặc user đã đăng nhập); chỉ cho phép đánh giá khi `CheckedOut` (hoặc đang `CheckedIn`); không tự tạo `User` với `PasswordHash = ""` (lưu `UserId` nullable trên `GuestReview` hoặc liên kết riêng).

---

#### [P0-08] Lộ nút Đăng nhập 1-chạm (Demo Roles + mật khẩu cứng) & Điền nhanh OTP giả vô điều kiện trên UI
- **Luồng / UI-UX Category:** Luồng 3 & Luồng 5 (Auth / OTP) — Bảo mật Production
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/auth/login/login.page.ts:204-342,438-466,548-549`: Render công khai cụm `"Đăng nhập nhanh 1-chạm (Demo Roles)"` cho cả Guest lẫn `SuperAdmin`, `Owner`, `Manager`, `Staff`, prefill sẵn `guest.vip@hotelsaas.local` và hardcode trực tiếp mật khẩu `HotelDev@2026!`, `Admin@123456` trong bundle JS không hề kiểm tra `!environment.production`.
  - `frontend/src/app/features/auth/phone-otp-modal/phone-otp-modal.component.ts:136,208-211,270-271`: Hiển thị nút `"Dùng số kiểm thử (+84 123 456 789 / Mã: 123456)"` và `"Nhập mã mẫu 123456"` vô điều kiện trên giao diện (trong khi backend `FirebaseAuthService.cs:130-139` đã chặn `dev-mock-token:` ở Staging/Prod).
- **Nguyên nhân gốc rễ:** Quên bọc UI thử nghiệm dev/test bằng cờ môi trường `!environment.production`.
- **Tác động:** Khi build bản Production (`environment.ts` có `production: true`), toàn bộ khách hàng truy cập `/login` sẽ thấy danh sách nút Demo kèm nút vào tài khoản SuperAdmin/Owner ngay trên màn hình; nút test OTP làm khách hàng thật nhầm lẫn và bấm vào sẽ gặp lỗi từ chối từ backend Production.
- **Giải pháp khuyến nghị:** Gỡ bỏ hoàn toàn mật khẩu cứng khỏi mã nguồn frontend; bọc mọi nút quick-fill/mock OTP dưới điều kiện `@if (!isProduction)` và xóa form prefill mặc định.

---

### NHÓM P1 — HIGH SEVERITY (Thiếu năng lực cốt lõi, sai lệch dữ liệu trung thực, UX gãy)

#### [P1-01] Đứt gãy Đăng nhập Facebook (503) & Thiếu hoàn toàn Quên / Đặt lại mật khẩu (`US-1.4`)
- **Luồng / UI-UX Category:** Luồng 5 (Auth) — Chức năng & Navigation Patterns
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/app.routes.ts:18-60`: Không có route `/forgot-password` hay `/reset-password`.
  - `frontend/src/app/features/auth/login/login.page.ts:103-111`: Trên portal Guest, liên kết `"Quên mật khẩu?"` trỏ tới `routerLink="/booking/lookup"`.
  - `frontend/src/app/features/auth/login/login.page.ts:178-188` & `register.page.ts:298-310,470-496`: Hiển thị nút `Facebook`, gọi `authService.socialLogin(...)` (`POST /api/auth/social-login`).
  - `backend/src/HotelSaas.WebApi/Controllers/AuthController.cs:159-168`: Endpoint `social-login` trả cứng HTTP `503 SOCIAL_LOGIN_DISABLED`; controller cũng không có bất kỳ endpoint `forgot-password`, `reset-password` hay `change-password` nào.
- **Nguyên nhân gốc rễ:** Backend khóa vĩnh viễn endpoint `social-login` cũ vì lý do bảo mật nhưng chưa triển khai xác thực token Facebook Graph API riêng như `GoogleLogin`, đồng thời chưa phát triển flow khôi phục mật khẩu nhưng Frontend vẫn dựng sẵn nút Facebook và trỏ link Quên mật khẩu đi chỗ khác.
- **Tác động:** Khách hàng quên mật khẩu hoàn toàn không thể lấy lại tài khoản thành viên; khách bấm nút Facebook nhận lỗi 503 gây mất niềm tin nghiêm trọng.
- **Giải pháp khuyến nghị:** Triển khai `ForgotPasswordCommand` + `ResetPasswordCommand` (qua email token OTP/link có thời hạn); ẩn hoặc hoàn thiện xác thực server-side cho nút Facebook qua Graph API appsecret_proof trước khi hiển thị.

---

#### [P1-02] Ngụy tạo Ảnh phòng/cơ sở, Tiện nghi & Huy hiệu Smart Lock trái chuẩn trung thực dữ liệu
- **Luồng / UI-UX Category:** Luồng 1 & Luồng 2 — Data Honesty (`booking-marketplace/spec.md`, `experience-foundation/spec.md`)
- **Bằng chứng (`file:line`):**
  - Backend: `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs:419-480,754-781` — `PublicPropertyMappingHelper.ResolveVisualGallery` tự động sinh 3 ảnh Unsplash ngẫu nhiên theo hash tên/slug từ từ điển `CuratedGalleriesByType` thay vì ảnh thật của cơ sở.
  - Frontend: `frontend/src/app/core/utils/hotel-image.util.ts:78-108` (`resolvePropertyGallery`) tự nhồi thêm ảnh stock cho đủ 5 ảnh nếu thiếu.
  - Frontend Room Detail: `frontend/src/app/core/services/room-gallery.service.ts:23-170` tự gán 4 ảnh nội thất sang trọng (Jacuzzi, ban công biển…) và tự bịa danh sách tiện nghi (Wifi 6, Smart TV Netflix, Bồn tắm, Két sắt) chỉ dựa vào việc tên hạng phòng có chứa từ `"SUITE"`/`"DELUXE"`; `room-detail-modal.component.ts:64,131,173` hardcode badge `"Smart Lock 24/7"` cho mọi phòng bất kể cơ sở có gắn khóa thông minh hay không.
- **Nguyên nhân gốc rễ:** Tác giả dùng mock gallery/amenities để trang chi tiết trông bắt mắt trong quá trình phát triển nhưng không thay bằng dữ liệu thật từ DB (`Property`/`RoomType`).
- **Tác động:** Khách hàng đặt phòng homestay/nhà nghỉ bình dân thấy ảnh bồn tắm Jacuzzi và Smart Lock 24/7 nhưng thực tế không có, dẫn đến khiếu nại và vi phạm nguyên tắc "Honest missing states".
- **Giải pháp khuyến nghị:** Gỡ bỏ mọi hàm tự bơm ảnh/tiện nghi giả ở cả Backend lẫn Frontend; nếu cơ sở hoặc hạng phòng chưa có ảnh/tiện nghi thật, hiển thị placeholder trung thực `"Cơ sở chưa cập nhật ảnh/tiện nghi"`.

---

#### [P1-03] Dữ liệu Thống kê, Giá, Điểm đánh giá & Thuế VAT bịa đặt hoặc cứng nhắc trên Discovery & Detail
- **Luồng / UI-UX Category:** Luồng 1 & Luồng 2 — Charts & Data / Trust
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/booking.page.ts:208-265`: Hero section hardcode cơ sở ảo `Da Nang Ocean Suites & Spa Resort`, giá `1.250.000 ₫ / đêm`, `4.9/5 (480+ đánh giá thực tế)` nhưng nút "Khám phá" chỉ filter từ khóa `'Đà Nẵng'`.
  - `frontend/src/app/features/public-booking/components/popular-destinations/popular-destinations.component.ts:27,148,211`: Quảng cáo `"Hơn 1.500+ khách sạn..."` và render `propertyCount`, `startPrice`, `rating` tĩnh từ `vietnam-provinces.data.ts` (VD: Phú Quốc 88 chỗ nghỉ, Đà Nẵng 95 chỗ nghỉ).
  - `frontend/src/app/features/public-booking/components/curated-bento-grid/curated-bento-grid.component.ts:101-134`: Giá cứng `950.000 ₫`, `450.000 ₫`; mục `"Săn Mây & Thung Lũng Rừng Thông"` (Đà Lạt, Sa Pa) gắn nhầm URL ảnh bãi biển `photo-1507525428034-b723cf961d3e` (`:113`).
  - `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs:647-649`: Khi cơ sở chưa có review nào (`reviewStat.Count == 0`), Backend tự bịa `RatingAverage` (`4.9` cho 5 sao, `4.7` cho 4 sao, `4.6` mặc định).
  - `frontend/src/app/features/public-booking/property-detail.page.ts:588-655`: Khi đã có `totalReviews > 0`, nếu điểm tiêu chí phụ bị null thì UI fallback cứng về `4.9` / `4.8` và luôn vẽ cứng **5 biểu tượng sao vàng đầy** (`:592-596`) bất kể điểm trung bình là 2.0 hay 4.9.
  - `frontend/src/app/features/public-booking/property-detail.page.ts:762`: Hardcode `"Đã bao gồm 10% VAT & phí dịch vụ cơ sở"`, trong khi `Property.cs:99` đặt `TaxRatePercent` mặc định `0.00m` và `PricingCalculator.cs` hoàn toàn **không** cộng/tính tách dòng VAT hay phí dịch vụ.
- **Nguyên nhân gốc rễ:** Dữ liệu marketing/placeholder được viết thẳng vào template và helper mà chưa truy vấn tổng hợp từ DB thật.
- **Tác động:** Sai lệch nghiêm trọng về giá cả, chất lượng và nghĩa vụ thuế công bố với người tiêu dùng.
- **Giải pháp khuyến nghị:** Query số liệu thống kê điểm đến thực tế từ Backend; trả `RatingAverage = null` (hoặc `0`) khi chưa có review; tính sao vàng động theo `averageRating`; đồng bộ hiển thị thuế VAT theo `property.taxRatePercent` và `quote.breakdown` thực tế từ `PricingCalculator`.

---

#### [P1-04] Xung đột Dữ liệu Địa giới Hành chính Việt Nam: "34 Tỉnh Sáp nhập" vs "63 Tỉnh Truyền thống"
- **Luồng / UI-UX Category:** Luồng 1 (Discovery & Geo Search) — Tính nhất quán dữ liệu
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/core/data/vietnam-provinces.data.ts`: Định nghĩa hằng số `VIETNAM_34_PROVINCES` (đúng 34 phần tử) nhưng dùng mã **63 tỉnh cũ** và liệt kê các tỉnh cũ như `Quảng Nam (49)`, `Bình Định (52)`, `Bình Thuận (60)`, `Phú Yên (54)`, `Quảng Bình (44)`, `Kon Tum (62)`, `Bà Rịa - Vũng Tàu (77)`, `Kiên Giang (91)`, `Bình Dương (74)`.
  - `frontend/src/app/core/models/location.model.ts`: Định nghĩa `VIETNAM_63_PROVINCES` (63 phần tử, dùng mã `'1'` cho Hà Nội thay vì `'01'`).
  - `backend/src/HotelSaas.Infrastructure/Resources/Locations/DMTinhThanh_2Cap.csv:1-64`: File đặt tên `_2Cap` nhưng chứa **63 tỉnh thành** (vẫn có Bà Rịa-VT `77`, Kiên Giang `91`, Quảng Nam `49`...).
  - `backend/src/HotelSaas.Infrastructure/Services/LocationLookupService.cs:495-507`: Các `TouristZones` cũng map vào mã 63 tỉnh cũ (`"77"`, `"49"`, `"91"`, `"52"`, `"60"`).
  - `backend/src/HotelSaas.WebApi/Controllers/LocationsController.cs:29`: Docstring ghi `"Gets all 63 standardized Vietnamese provinces"`.
- **Nguyên nhân gốc rễ:** Dự án đổi tên và tuyên truyền thông điệp `"34 tỉnh thành sau sáp nhập"` ở tầng UI (`PopularDestinations`, `GuestLayout`, `RealData34ProvincesSeeder`), nhưng bộ danh mục CSV gốc và các module lọc vẫn giữ nguyên chuẩn 63 tỉnh, thậm chí `VIETNAM_34_PROVINCES` chỉ là bản cắt bớt 34 tỉnh nổi tiếng từ danh sách 63 tỉnh cũ.
- **Tác động:** Lọc theo tỉnh mới sáp nhập (VD: tìm TP.HCM nhưng muốn thấy Vũng Tàu/Bình Dương, hoặc tìm An Giang muốn thấy Phú Quốc) có nguy cơ trả sai hoặc thiếu kết quả; khách xem danh sách tỉnh thấy mâu thuẫn giữa các dropdown.
- **Giải pháp khuyến nghị:** Thống nhất một bảng mapping chính thức cấp hệ thống (63 mã cũ <-> 34 đơn vị mới hoặc dùng chuẩn hành chính duy nhất được PO phê duyệt), cập nhật đồng bộ `DMTinhThanh_2Cap.csv`, `LocationLookupService`, `location.model.ts` và `vietnam-provinces.data.ts` từ API `/api/locations/provinces`.

---

#### [P1-05] Bộ lọc Tìm kiếm Bị Lệch Contract & Thiếu Phân trang / Bulk Availability Server-side
- **Luồng / UI-UX Category:** Luồng 1 (Discovery & Search) — Performance & Filtering
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts:513` & `explore-search.page.ts:936,1305`: Đưa `'Guesthouse'` vào bộ lọc loại hình, trong khi `backend/src/HotelSaas.Domain/Enums/PropertyType.cs` chỉ có 8 giá trị `1..8` (`Hotel, Resort, Hostel, BedAndBreakfast, Villa, Apartment, Motel, Homestay`), **không có `Guesthouse`**; `BACKEND_PROPERTY_TYPE_MAP` (`public-booking.service.ts:34`) cũng chỉ map `1..8` -> lọc `Guesthouse` luôn ra **0 kết quả**.
  - `frontend/src/app/features/public-booking/booking.page.ts:723` & `explore-search.page.ts:966`: Gửi `pageSize: 10` lên Backend.
  - `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs:57` & `GetPublicPropertiesQuery.cs:24-36`: `GetPublicPropertiesQuery` **không hề nhận** `page`, `pageSize`, `minPrice`, `maxPrice`, `sortBy`, `guests`, `checkInDate`, `checkOutDate`.
  - Kết quả là Backend trả toàn bộ cơ sở active trong DB, còn Frontend tự lọc giá/số khách/sort và phân trang giả trên client (`booking.page.ts:463`, `explore-search.page.ts:1062-1063`). Ngoài ra trang kết quả tìm kiếm không kiểm tra phòng trống hàng loạt theo ngày/số khách.
- **Nguyên nhân gốc rễ:** Frontend bổ sung filter/pagination tham số nhưng chưa được implement ở `GetPublicPropertiesQuery`.
- **Tác động:**
  1. Chọn chip `Nhà nghỉ (Guesthouse)` luôn trả về trang trắng không có cơ sở.
  2. Khách tìm theo ngày và số khách (VD: 6 người cuối tuần) vẫn thấy khách sạn hiển thị sẵn sàng ở kết quả tìm kiếm, chỉ đến khi bấm vào trang chi tiết mới phát hiện đã hết phòng hoặc phòng chỉ chứa tối đa 2 khách.
  3. Tải nặng băng thông/CPU khi số lượng cơ sở tăng lên.
- **Giải pháp khuyến nghị:** Bỏ `'Guesthouse'` hoặc map chuẩn về `Motel`/`Homestay` (hoặc bổ sung enum nếu nghiệp vụ yêu cầu); triển khai phân trang, lọc khoảng giá, lọc sức chứa/lịch trống sơ bộ và sắp xếp ngay tại `GetPublicPropertiesQuery` trên Backend.

---

#### [P1-06] Trang Kho Ưu đãi `/booking/deals` Tĩnh Hoàn toàn & Không Thể Áp dụng Mã Giảm Giá / Đổi Điểm khi Thanh toán
- **Luồng / UI-UX Category:** Luồng 2 & Luồng 3 — Promotions & Loyalty Redemption
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Domain/Entities/Promotion.cs:9-71`: Database có bảng `Promotion` hoàn chỉnh (`Code`, `Type`, `Value`, `MinNights`, `MaxUsage`, `StartsAtUtc`, `EndsAtUtc`), nhưng không có endpoint Public/Customer nào đọc hay kiểm tra mã `Promotion`, và `PricingCalculator.cs` cũng **không tính** discount từ `Promotion`.
  - `frontend/src/app/core/services/public-booking.service.ts:587-639`: `getPromotions()` trả dữ liệu mock `of([...])` gồm các mã như `GIODAY20`, `DEMAUVIP`, `CUOITUAN15`, `THANHVIEN`.
  - `frontend/src/app/features/public-booking/components/flash-deals-banner/flash-deals-banner.component.ts:151-171`: Hardcode bộ mã **hoàn toàn khác** (`WELCOME15`, `WEEKEND200`, `HOURLY99K`), kèm đồng hồ đếm ngược nửa đêm và nhãn khan hiếm giả `"Còn 34 lượt hôm nay"`, `"giữ phòng trong 30 giây"`.
  - `frontend/src/app/features/public-booking/booking.page.ts:1576`: Hàm `onApplyPromoCode(code)` bỏ trống / không nối vào booking; `promotions.page.ts:192` (`applyAndBook`) chỉ copy clipboard và chuyển về `/booking` làm mất ngữ cảnh khuyến mãi.
  - **Đổi điểm Loyalty bị bỏ rơi ở Checkout:** `CreateGuestHoldCommand.cs:35,450-481` đã code đầy đủ logic `PointsToRedeem` (`1 điểm = 1.000đ`, tối đa 50% đơn, trừ từ `GuestLoyaltyMembership` và ghi sổ `LoyaltyPointTransaction`), `PublicController.cs:272` có nhận `PointsToRedeem`, nhưng `booking-hold.page.ts` hoàn toàn **không có UI** hiển thị số điểm khả dụng hay ô nhập/kéo thanh quy đổi điểm (lẫn không có ô nhập Promo Code).
- **Nguyên nhân gốc rễ:** Trang Deals/FlashBanner dựng bằng UI tĩnh từ trước; phía `CreateGuestHold` có hỗ trợ `PointsToRedeem` nhưng chưa làm phần Frontend checkout và API xem trước điểm theo chuỗi cơ sở.
- **Tác động:** Khách mất lòng tin khi thấy quảng cáo mã giảm giá rầm rộ nhưng đến bước thanh toán không có ô nhập mã; thành viên tích điểm cũng không tiêu được điểm trên Web.
- **Giải pháp khuyến nghị:** Xây dựng API `/api/public/promotions` và tích hợp kiểm tra/áp dụng `PromoCode` vào `PricingCalculator` + `CreateGuestHoldCommand`; đưa UI nhập `PromoCode` và `PointsToRedeem` (sau khi sửa lỗi Global Query Filter `P0-02`) vào `BookingHoldPage`.

---

#### [P1-07] Lỗi Hợp đồng Kiểm tra Xác thực SĐT (`isUserPreVerified`) tại Bước Giữ Phòng
- **Luồng / UI-UX Category:** Luồng 3 (Booking Hold & OTP) — Auth Contract & Forms
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Auth/DTOs/UserDto.cs:11`: `UserDto(Guid Id, string Email, string FullName, string GlobalRole, Guid? TenantId)` trả về từ `POST /api/auth/login` (`LoginCommandHandler.cs:184-189`) **không chứa** `PhoneNumber` lẫn `PhoneVerifiedAtUtc`.
  - `frontend/src/app/features/public-booking/booking-hold.page.ts:1190-1201`: Kiểm tra `isUserPreVerified = Boolean(currentUser && currentUser.phoneNumber && normalize(currentUser.phoneNumber) === normalizedPhone)`.
  - `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs:106-127`: Yêu cầu `guestUser.PhoneVerifiedAtUtc.HasValue` — nếu user đã nhập SĐT lúc đăng ký nhưng **chưa xác thực OTP**, backend ném lỗi `400 ERR_PHONE_VERIFICATION_REQUIRED`.
- **Nguyên nhân gốc rễ:** Frontend kiểm tra nhầm `currentUser.phoneNumber` (thay vì `isPhoneVerified`), đồng thời `UserDto` từ luồng login lại không trả về `phoneNumber` hay `isPhoneVerified`.
- **Tác động:** Hai kịch bản gãy song song: (1) Khách đã xác thực SĐT khi vào đặt phòng không thấy `currentUser.phoneNumber` trong state login nên vẫn bị ép bật modal OTP lại (trừ khi trang Hold tự gọi `/api/guest/me`); (2) Khách có SĐT chưa verify trong `currentUser` bị cho đi thẳng tới API `bookings/hold` rồi nhận lỗi 400.
- **Giải pháp khuyến nghị:** Bổ sung `PhoneNumber`, `PhoneVerifiedAtUtc` (hoặc `IsPhoneVerified`) vào `UserDto` và/hoặc gọi đồng bộ `GET /api/guest/me` trong `BookingHoldPage` để kiểm tra chính xác `isPhoneVerified === true` mới cho bỏ qua bước SMS OTP.

---

#### [P1-08] Bất nhất Phương thức Thanh toán (`BankTransfer` / `PayAtHotel`) & Ẩn sai Smart Lock PIN ở Trạng thái `Confirmed`
- **Luồng / UI-UX Category:** Luồng 3 & Luồng 4 — State Consistency & Self-Service
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/booking-hold.page.ts:484-495`: Cho phép chọn 4 phương thức: `VNPay`, `VietQR`, `PayAtHotel` (ghi `"Nộp cọc tại quầy trong 15 phút; nhân viên xác nhận đơn"`), và `BankTransfer`. Dòng `1263` gửi `PayAtHotel -> Cash` và `BankTransfer -> BankTransfer`.
  - `frontend/src/app/features/public-booking/booking-status.page.ts:1638,1742`: Signal `selectedPaymentMethod` chỉ hỗ trợ `'VNPay' | 'VietQR' | 'PayAtHotel'`, làm rơi mất lựa chọn `'BankTransfer'` khi điều hướng sang trang trạng thái (và mặc định rớt về `'VNPay'`).
  - `frontend/src/app/features/public-booking/booking-status.page.ts:806`: Chỉ hiển thị Smart Lock PIN khi `@if (detail.status === 'CheckedIn' && detail.smartLockPin && detail.smartLockStatus === 'Active')`, trong khi Backend `GetGuestBookingByTokenQuery.cs:133-134` cho phép trả PIN khi `Confirmed || CheckedIn` (phù hợp cam kết "nhận phòng tự động 24/7 không cần chờ lễ tân" ở `TrustPillarsComponent:74-75` & `PropertyDetailPage:797`).
- **Nguyên nhân gốc rễ:** Frontend chưa định nghĩa UI riêng cho `BankTransfer` trên `BookingStatusPage`, tự viết copy 15 phút vô lý cho khách trả tại quầy, và đặt điều kiện hiển thị PIN chặt hơn chính sách backend.
- **Tác động:** Khách chọn chuyển khoản ngân hàng thấy màn hình tự nhảy sang VNPay; khách kỳ vọng tự check-in bằng Smart Lock PIN sau khi cọc thành công (`Confirmed`) nhưng không thấy mã PIN cho tới khi lễ tân chuyển trạng thái `CheckedIn`.
- **Giải pháp khuyến nghị:** Hiển thị hướng dẫn chuyển khoản ngân hàng thật khi `BankTransfer`, rà soát lại thời hạn giữ chỗ/xác thực cho `PayAtHotel`, và đồng bộ điều kiện hiển thị Smart Lock PIN trên `BookingStatusPage` theo đúng `Confirmed || CheckedIn` khi `smartLockStatus === 'Active'` và đã đủ cọc.

---

#### [P1-09] Thiếu hoàn toàn Tính năng Đổi lịch / Sửa Đặt phòng & Mâu thuẫn nghiêm trọng ở Luồng Đánh giá
- **Luồng / UI-UX Category:** Luồng 4 (Post-Booking) — Missing Features & Broken Experience
- **Bằng chứng (`file:line`):**
  - **Đổi lịch / Sửa phòng (Modification / Reschedule):** Không có tài liệu `docs/specs/p3a-reservation-change-spec.md` trên `develop`; tìm kiếm toàn bộ `PublicController.cs`, `GuestPortalController.cs`, `booking-status.page.ts`, `booking-lookup.page.ts`, `guest-profile.page.ts` xác nhận **0 endpoint** và **0 nút UI** cho phép khách tự đổi ngày, đổi giờ, đổi hạng phòng hoặc cập nhật số khách/ghi chú sau khi đặt.
  - **Mâu thuẫn Review:**
    - `frontend/src/app/features/public-booking/booking-lookup.page.ts:354-377`: Khi đơn ở trạng thái `CheckedOut`, hiển thị cảnh báo `"Chức năng đánh giá trực tuyến chưa khả dụng — Hệ thống hiện tại chưa hỗ trợ gửi đánh giá trực tuyến qua API công khai"`, trong khi `PublicController.cs:446` đã có `POST /api/public/bookings/{lookupToken}/review` và `BookingStatusPage:449` đã gọi thành công.
    - `frontend/src/app/features/public-booking/booking-status.page.ts:425,1689,1814,2500`: Trạng thái đã đánh giá (`reviewSubmitted`) chỉ lưu trong Signal RAM ở client -> khi tải lại trang (F5), form đánh giá hiện lại, khách gửi lại sẽ dính lỗi `400 ERR_ALREADY_REVIEWED` (`SubmitGuestReviewCommand.cs:101`) mà không xem lại hay chỉnh sửa được đánh giá cũ (`GetGuestBookingByTokenQuery.cs` không trả cờ `HasReviewed` hay object review đã gửi).
- **Nguyên nhân gốc rễ:** Copy cũ trên `BookingLookupPage` không được cập nhật sau khi `SubmitGuestReviewCommand` ra đời; thiếu thiết kế dữ liệu hai chiều cho review và chưa triển khai spec Reservation Change.
- **Tác động:** Khách muốn đổi ngày bay/giờ nhận phòng buộc phải tự hủy đơn (chịu rủi ro mất cọc hoặc mất phòng) rồi đặt lại; khách đã gửi đánh giá xong tải lại trang lại bị mời đánh giá tiếp rồi báo lỗi.
- **Giải pháp khuyến nghị:** Đồng bộ `GuestBookingDetailDto` trả kèm trạng thái `HasReviewed` / `ExistingReview`; thống nhất hoặc điều hướng đánh giá giữa `Lookup` và `Status`; thiết kế và triển khai quy trình self-service sửa đặt phòng có kiểm tra chênh lệch giá & phòng trống dưới row-lock.

---

#### [P1-10] Guest Portal UI bỏ trống 5 API đã xây dựng ở Backend, Banner Email vào ngõ cụt & Phân loại sai đơn `Overnight`
- **Luồng / UI-UX Category:** Luồng 5 (Member Account) — Missing UI & Data Mismatch
- **Bằng chứng (`file:line`):**
  - Backend `GuestPortalController.cs:107-155` đã mở sẵn 5 API: `PUT /vat-profile`, `GET /loyalty-ledger`, `POST /memberships/enroll`, `GET /invoices`, `GET /invoices/{id}/print`.
  - Frontend `GuestAccountService` (`guest-account.service.ts:1-51`) chỉ gọi 4 API (`/me`, `PATCH /me`, `/bookings`, `/profile`) — **hoàn toàn không gọi** 5 API trên; `GuestProfilePage:62,485,675` đặt tên tab `"Đặt phòng & Hóa đơn"` nhưng chỉ render danh sách đặt phòng thô, không có bảng hóa đơn, không có form lưu thông tin xuất hóa đơn VAT, không có lịch sử biến động điểm (`loyalty-ledger`) và không có nút đăng ký thẻ thành viên theo cơ sở.
  - **Dead-end Banner Email:** `GuestProfilePage:170-190` hiển thị banner cho tài khoản đăng ký bằng SĐT (`@phone.hotelsaas.local`, sinh bởi `VerifyPhoneFirebaseCommandHandler.cs:110`) với nút `"Cập nhật Email ngay"` gọi `startEditing()`, nhưng ngay bên trong form `startEditing()` (`:371`) lại ghi: *"Email và Số điện thoại được bảo vệ và không thể thay đổi tại màn hình này"*.
  - **Không có Đổi mật khẩu & Quản lý SocialIdentity:** Không có API/UI để user đổi mật khẩu (`ChangePassword`), liên kết/gỡ liên kết Google (`SocialIdentity` entity tồn tại ở `SocialIdentity.cs`, được tạo ở `GoogleLoginCommandHandler` nhưng không có UI quản lý).
  - **Gán nhãn sai đơn Qua đêm:** `GetGuestBookingsQueryHandler.cs:61` và `GetGuestBookingDetailQueryHandler.cs:57` dùng biểu thức `r.CheckInDate == r.CheckOutDate ? "Hourly" : "Daily"` thay vì đọc `ReservationSnapshotHelper.TryDeserialize(r.Notes)` — khiến mọi đơn `Overnight` qua ngày bị hiển thị nhầm thành `"Daily"`.
- **Nguyên nhân gốc rễ:** Backend và Frontend phát triển lệch nhịp: một nhóm đã thêm Controller/Queries cho VAT/Invoices/Loyalty nhưng chưa nối lên `GuestAccountService`/`GuestProfilePage` (và cũng chưa vá QueryFilter ở `P0-02`), trong khi `GuestProfilePage` giữ banner từ UX cũ.
- **Tác động:** Khách đăng ký bằng SĐT bị kẹt vĩnh viễn với email giả `@phone.hotelsaas.local` và không thể nhận vé/hóa đơn qua email; người dùng không xem được hóa đơn, sổ cái điểm hay đổi mật khẩu.
- **Giải pháp khuyến nghị:** Kết nối đầy đủ 5 API của `GuestPortalController` lên Frontend (sau khi vá `P0-02` và `P0-03`); thêm luồng xác thực OTP/Email link để đổi/bổ sung Email và Đổi mật khẩu; đọc `RentalType` từ `ReservationSnapshotHelper` trong `GetGuestBookingsQueryHandler`.

---

### NHÓM P2 — MEDIUM SEVERITY (Lệch quy chuẩn UX, A11y, Dark Mode, Responsive & Logic phụ)

#### [P2-01] Bất nhất Khung giờ Hourly / Overnight / Daily & Điều hướng Sớm ở Bộ lọc Trang chủ
- **Luồng / UI-UX Category:** Luồng 1 & Luồng 2 — Touch & Interaction / Forms & Feedback
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Domain/Entities/Property.cs:77-82`: Quy định chuẩn Check-in `12:00` – Check-out `12:00` (Decision D06).
  - `frontend/src/app/features/public-booking/property-detail.page.ts:207`: Hardcode `'Theo ngày (Nhận 14:00 - Trả 12:00)'` và `'Qua đêm (21:00 - 10:00)'` bất chấp cấu hình thực tế của cơ sở (`hotel.checkInTime`, `hotel.checkOutTime`).
  - `frontend/src/app/shared/components/booking-date-picker/booking-date-picker.component.ts:182,220,246,267`: Hardcode `"Nhận 21:00 - 23:00"` / `"Trước 12:00 trưa"` cho Qua đêm; cung cấp `durationOptions: [1, 2, 3, 4, 5, 6, 8, 12]`, lệch với `BookingFilterBarComponent:525` chỉ có `[1, 2, 3, 4, 5, 6]`.
  - `frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts:93,732`: Chạm vào tab chuyển `Hourly / Overnight / Daily` gọi thẳng `emitSearch()` chuyển sang `/booking/explore` ngay trên trang chủ khi khách chưa kịp chọn điểm đến hoặc ngày giờ.
- **Nguyên nhân gốc rễ:** Khung giờ và danh sách thời lượng bị hardcode rải rác ở từng component UI thay vì đọc từ `PropertyDto` / cấu hình thống nhất.
- **Tác động:** Khách xem cùng một khách sạn thấy giờ nhận/trả phòng mâu thuẫn giữa bước tìm phòng, chi tiết phòng và trợ lý AI; trải nghiệm chạm tab trên Home bị giật/chuyển trang ngoài ý muốn.
- **Giải pháp khuyến nghị:** Render giờ nhận/trả phòng động từ `property.checkInTime`/`checkOutTime` và `maxHourlyHours`; trên Home (`mode === 'hero'`), chuyển tab hình thức thuê chỉ cập nhật state cục bộ của thanh tìm kiếm, không điều hướng trước khi khách bấm "Tìm kiếm".

---

#### [P2-02] Bản đồ Split-View chỉ hiển thị 1 Ghim đơn lẻ & Gom nhóm Thương hiệu Client-side
- **Luồng / UI-UX Category:** Luồng 1 (Explore & Brands) — Performance & Interactive Map
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/explore-search.page.ts:852-875`: Xây dựng `iframe` tới `https://maps.google.com/maps?q=${lat},${lng}&output=embed` — chỉ ghim được **1 điểm duy nhất** (khách sạn đang chọn, vị trí user, hoặc khách sạn đầu tiên), không thể hiển thị đồng thời các ghim giá của danh sách kết quả như trải nghiệm OTA.
  - `frontend/src/app/core/services/public-booking.service.ts:381-452` & `tenant-brand.page.ts`: `getTenantBrands()` gọi `this.getProperties()` (kéo toàn bộ cơ sở về trình duyệt) rồi tự nhóm theo `tenantId`.
- **Nguyên nhân gốc rễ:** Tránh cấu hình Google Maps JS SDK / Leaflet và thiếu API `GET /api/public/brands` chuyên biệt ở Backend.
- **Tác động:** Bản đồ split-view trên desktop không hỗ trợ so sánh trực quan vị trí/giá nhiều khách sạn cùng lúc; tải danh sách thương hiệu gây dư thừa payload.
- **Giải pháp khuyến nghị:** Nâng cấp bản đồ tương tác multi-marker (Leaflet/OpenStreetMap hoặc Google Maps SDK) kèm đồng bộ hover card; bổ sung API tổng hợp danh sách thương hiệu ở Backend.

---

#### [P2-03] Trợ lý AI Concierge: Gắn nhãn "Gemini 3.8 Flash" trên Logic Rule-based & Tràn màn hình Mobile 375px
- **Luồng / UI-UX Category:** Luồng 1 (AI Concierge) — Layout & Responsive / Trung thực sản phẩm
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/shared/components/ai-concierge-chat/ai-concierge-chat.component.ts:21,47`: Container đặt `right-5` (20px) và cửa sổ chat `w-[360px]` trên mobile -> tổng chiều rộng cần thiết **380px > 375px** (màn hình iPhone chuẩn), làm tràn cắt viền trái.
  - `frontend/src/app/shared/components/ai-concierge-chat/ai-concierge-chat.component.ts:61`: Hiển thị badge phiên bản không có thật `"3.8 Flash"`; Backend `AiController.cs:205` trả `ModelUsed = "gemini-2.5-flash"` nhưng thực tế hàm `ExtractSmartSearchCriteria` và luồng trả lời (`AiController.cs:393,437,519,665,669`) xử lý hoàn toàn bằng **if/else + regex từ khóa tĩnh** (không gọi LLM), thậm chí hardcode sai giờ nhận/trả `"Check-in từ 14:00 và trả phòng trước 12:00"` bất chấp cấu hình từng khách sạn.
- **Nguyên nhân gốc rễ:** Mock mô tả AI model trên UI khi hệ thống đang dùng rule-based parser và kích thước popup cố định chưa co giãn theo `calc(100vw - 24px)`.
- **Tác động:** Lỗi vỡ khung trên mobile 375px; trả lời sai chính sách check-in thực tế của khách sạn (nhất là cơ sở `12:00` hoặc thuê theo giờ).
- **Giải pháp khuyến nghị:** Đổi width mobile thành `w-[calc(100vw-2rem)] sm:w-[420px]`; hiển thị trung thực `"Trợ lý Tìm phòng Thông minh"` (cho đến khi tích hợp LLM thật) và truy vấn `Property.CheckInTime`/`CheckOutTime` thật từ DB khi trả lời về cơ sở.

---

#### [P2-04] Vi phạm Tiêu chuẩn Accessibility & Touch Target (`ui-ux-pro-max` Priorities 1 & 2)
- **Luồng / UI-UX Category:** Xuyên suốt các luồng — Accessibility & Touch & Interaction (CRITICAL)
- **Bằng chứng (`file:line`):**
  - **Clickable `div` lồng nút:** `booking-filter-bar.component.ts:209-235` dùng phần tử không ngữ nghĩa cho mỗi dòng tìm kiếm gần đây kèm nút xóa con bên trong, thiếu hỗ trợ bàn phím tiêu chuẩn.
  - **Vùng chạm nhỏ hơn 44×44px:** Nút giảm/tăng số khách tại `booking-filter-bar.component.ts:339,351` đặt `w-7 h-7` (28×28px), vi phạm ngưỡng tối thiểu 44×44px cho thiết bị cảm ứng.
  - **Thiếu liên kết `<label for>`:** Toàn bộ 7 thẻ `<label>` trong `booking-date-picker.component.ts:35,64,100,128,151,179,208` không có thuộc tính `for` trỏ tới `id` input/select tương ứng.
  - **Modal OTP thiếu ngữ nghĩa Dialog & Cố định `+84`:** `phone-otp-modal.component.ts:29-50` thiếu `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, nút đóng X thiếu `aria-label` và vùng bấm nhỏ (`p-1.5`); dòng `:84` và `:256` cố định hiển thị nhãn `+84` và strip `^\+84` ngay cả khi người dùng chọn mã quốc gia khác từ `BookingHoldPage`.
- **Nguyên nhân gốc rễ:** Một số component tự viết thiếu vòng kiểm tra WCAG / keyboard / touch target bằng `FormFieldComponent` hoặc Angular CDK `A11yModule` (như cách `PhotoGalleryModal` và `RoomDetailModal` đã làm tốt).
- **Tác động:** Khó thao tác bằng ngón tay trên điện thoại (nhấn nhầm/hụt nút số khách, nút đóng OTP), trình đọc màn hình không nhận diện được modal OTP hay nhãn ô chọn ngày.
- **Giải pháp khuyến nghị:** Áp dụng `cdkTrapFocus`, `role="dialog"`, `aria-modal="true"`, `min-h-11 min-w-11` (44px) cho các interactive controls; tách button chọn item và button xóa thành 2 sibling buttons; bổ sung `for`/`id` đầy đủ và truyền dynamic dial code cho `PhoneOtpModalComponent`.

---

#### [P2-05] Dark Mode gãy ở Auth Card, Nhận diện Thương hiệu cũ & Thiếu Gửi lại Email Xác thực
- **Luồng / UI-UX Category:** Luồng 5 (Auth) — Typography & Color / Forms & Feedback
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/layouts/auth-layout/auth-layout.ts:25,45`: Layout Auth cung cấp nút chuyển `themeService.toggleTheme()`, nhưng thẻ card chính dòng `45` hardcode `bg-white` mà không có `dark:bg-slate-900` — khi bật dark mode, card trắng nổi gắt hoặc chữ thừa kế bị giảm tương phản.
  - **Nhận diện cũ `LuxeStay` & Domain typo:** Còn sót ở `booking-lookup.page.ts:420,591,595`, `booking-status.page.ts:1160,1331,1335`, `confirm-email.page.ts:65`, và typo `https://luxustay.duckdns.org` ở `RegisterCommandHandler.cs:71` (`Program.cs:95`).
  - **Validation mật khẩu lệch & Thiếu Resend Email:** `register.page.ts:150-152,375` chỉ kiểm tra `Validators.minLength(8)` (không kiểm tra chữ hoa, số, ký tự đặc biệt như `RegisterCommandValidator.cs:22-24`); `confirm-email.page.ts` khi token hết hạn sau 30 phút không có nút `"Gửi lại email xác nhận"` (Backend `AuthController` cũng chưa có endpoint `resend-confirmation`).
- **Nguyên nhân gốc rễ:** Chuyển đổi tên nền tảng chưa quét hết string tĩnh; validation và email flow chưa khép kín hai đầu.
- **Tác động:** Khách bị từ chối đăng ký sau khi gửi form dù UI báo hợp lệ; link xác thực email hết hạn khiến khách không tự kích hoạt lại được; trải nghiệm Dark Mode ở Auth bị lỗi thẩm mỹ.
- **Giải pháp khuyến nghị:** Thêm dark variants đầy đủ cho `AuthLayout`; đồng bộ regex password giữa `RegisterPage` và `RegisterCommandValidator`; thêm `POST /api/auth/resend-confirmation`; rà soát thay thế toàn bộ string thương hiệu `LuxeStay`/`luxustay`.

---

#### [P2-06] Lệch Logic Nghiệp vụ Phụ: Chặn Đặt Nhiều Phòng, Thiếu Ghi chú Khách & Hardcode Thuế/MST Hóa đơn
- **Luồng / UI-UX Category:** Luồng 3, 4 & 5 — Tính hoàn chỉnh nghiệp vụ
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/core/models/public-stay-context.ts`: `readPublicStay` ném lỗi `'Hiện mỗi lượt đặt hỗ trợ một phòng.'` nếu `roomsCount !== 1` — khách đi nhóm/gia đình cần đặt 2–3 phòng phải tách nhiều đơn rời rạc kèm OTP nhiều lần.
  - `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs:502`: Hardcode `CustomerNotes = null` trong snapshot và không có trường `SpecialRequests`/`CustomerNotes` ở cả `CreateGuestHoldRequest` lẫn UI `BookingHoldPage`.
  - `backend/src/HotelSaas.Application/Loyalty/Queries/GetGuestInvoicePrintView/GetGuestInvoicePrintViewQueryHandler.cs:139,153`: Hardcode `PropertyTaxCode = "0109988776"` cho mọi khách sạn và tính cứng `TaxAmount = Math.Round(res.TotalAmount * 0.08m, 0)` (8%) bất kể cấu hình thuế của cơ sở (`Property.TaxRatePercent`).
- **Nguyên nhân gốc rễ:** Giới hạn MVP chưa mở rộng sang multi-room và thiếu trường lưu ghi chú/MST thật của từng Property.
- **Tác động:** Hạn chế giá trị đơn hàng (AOV) nhóm/gia đình; khách không thể dặn phòng tầng thấp/giường phụ/đón sân bay; hóa đơn hiển thị sai mã số thuế và thuế suất pháp lý.
- **Giải pháp khuyến nghị:** Mở trường `SpecialRequests` vào `CreateGuestHoldCommand`; đọc `TaxRatePercent` và MST thật từ `Property`/`Tenant` khi sinh hóa đơn; lập kế hoạch hỗ trợ giỏ nhiều phòng.

---

### NHÓM P3 — LOW SEVERITY (Vệ sinh mã nguồn, Dead Code, Polish UI)

#### [P3-01] Dữ liệu Cá nhân Lập trình viên Rò rỉ vào Avatar Preset & Hợp đồng In ấn
- **Luồng / UI-UX Category:** Luồng 5 (Guest Profile) & Tài liệu in — Code Hygiene
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/member/guest-profile.page.ts:620-621`: `avatarPresets` chứa `{ label: 'An Ngô Võ Tuấn', url: '/images/avatars/an-ngo-vo-tuan.png' }` thay vì bộ avatar mặc định trung lập của sản phẩm.
  - (Ghi nhận thêm tại `PrintDocumentsController.cs:271`: hardcode `PlatformRepresentative = "Ngô Võ Tuấn Anh (Tổng Giám Đốc)"`).
- **Giải pháp khuyến nghị:** Thay bằng bộ avatar minh họa trung lập hoặc dùng chữ cái đầu tên người dùng (initials avatar), đưa cấu hình đại diện nền tảng ra config.

#### [P3-02] Dead Code & Tài nguyên Thừa / Comment Sai Lệch
- **Luồng / UI-UX Category:** Bảo trì mã nguồn (Maintainability)
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/booking-status.page.ts:1750-1751`: Khối lệnh chết `if (false) { }`.
  - `frontend/src/app/features/public-booking/ai-concierge-widget/ai-concierge-widget.component.ts`: Widget AI cũ tồn tại song song nhưng `GuestLayoutComponent:8,263` đang mount `AiConciergeChatComponent` từ `shared/`.
  - `backend/src/HotelSaas.WebApi/Controllers/LocationsController.cs:29`: Docstring ghi `"63 standardized Vietnamese provinces"` mâu thuẫn với thông điệp 34 tỉnh ngoài trang chủ.
- **Giải pháp khuyến nghị:** Dọn dẹp nhánh `if (false)` và component `ai-concierge-widget` nếu không còn dùng; cập nhật comment chuẩn xác.

#### [P3-03] Render `[innerHTML]` không Sanitize tường minh & Thông điệp Đa tiền tệ/Ngôn ngữ Cố định
- **Luồng / UI-UX Category:** Luồng 4 & Layout — Security Hygiene / Localization
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/public-booking/booking-status.page.ts:1479,1546`: Binding `[innerHTML]="getCancellationTimelineFormattedHtml(prev)"` và `[innerHTML]="formatPolicyDescription(prev.policyDescription)"` trực tiếp từ chuỗi dữ liệu. Mặc dù Angular tự sanitize mặc định ở mức nhất định, việc không escape HTML đầu vào trước khi biến đổi chuỗi từ DB tiềm ẩn rủi ro nếu nội dung chính sách bị sửa đổi.
  - `frontend/src/app/layouts/guest-layout/guest-layout.ts:58`: Hiển thị badge `🇻🇳 VN • VND` tĩnh không thể bấm chuyển đổi tiền tệ/ngôn ngữ.
- **Giải pháp khuyến nghị:** Escape hoặc render chính sách qua cấu trúc template/thẻ văn bản an toàn thay vì `[innerHTML]`; loại bỏ cảm giác nút bấm giả hoặc ghi rõ trạng thái chỉ hỗ trợ Tiếng Việt / VNĐ.

---

## 4. Lộ trình Khắc phục Khuyến nghị (Remediation Roadmap)

| Giai đoạn | Hạng mục xử lý trọng tâm | Mã vấn đề | Nhóm phụ trách |
| :--- | :--- | :--- | :--- |
| **Wave 0 — Hotfix Blocker & Bảo mật** *(Ưu tiên tuyệt đối trước mọi đợt test UAT)* | 1. Sửa link `/booking/status/:token` trong `GuestProfilePage` (tạo view/route chi tiết `/api/guest/bookings/{id}` cho thành viên).<br>2. Vá `.IgnoreQueryFilters()` + lọc chặt `UserId` cho 5 handlers trong `Application/Loyalty`; bổ sung kiểm tra ownership ở `GetGuestInvoicePrintViewQueryHandler` (chặn IDOR).<br>3. Khóa hoặc yêu cầu `LookupToken` + che PII cho `PrintDocumentsController.GetPrintableVoucher`, thống nhất DTO với `PrintVoucherPage`.<br>4. Gỡ bỏ mật khẩu hardcoded, nút Demo 1-chạm và nút test OTP ở build Production (`!environment.production`).<br>5. Bắt buộc xác minh Email/SĐT khi hủy đơn chưa đăng nhập; chặn `ConfirmationCode` 6 ký tự trên `SubmitGuestReview`. | `P0-01`, `P0-02`, `P0-03`, `P0-04`, `P0-07`, `P0-08` | `backend`, `frontend`, `security`, `qa` |
| **Wave 1 — Khép kín Thanh toán, Auth & Dữ liệu Trung thực** | 1. Nối hoàn chỉnh VNPay return route/callback params; truy vấn tài khoản ngân hàng thật cho VietQR & gỡ cam kết IPN giả; sửa mapping `BankTransfer` và hiển thị Smart Lock PIN ở `Confirmed`.<br>2. Xây dựng Forgot/Reset/Change Password (`US-1.4`) và Resend Email; ẩn hoặc hoàn thiện Facebook OAuth; đồng bộ regex password.<br>3. Sửa `UserDto` (`isPhoneVerified`) để `BookingHoldPage` check đúng trạng thái OTP.<br>4. Gỡ toàn bộ dữ liệu giả/fallback (`CuratedGalleriesByType`, `RoomGalleryService`, Hero giả, `4.9/4.8`, `10% VAT` cứng, sao vàng cố định); sửa `Guesthouse` filter và thống nhất 34 vs 63 tỉnh. | `P0-05`, `P0-06`, `P1-01`..`P1-05`, `P1-07`, `P1-08`, `P2-05` | `backend`, `frontend`, `database`, `architect` |
| **Wave 2 — Self-Service, Guest Portal & UI/UX Pro Max** | 1. Nối 5 API Guest Portal (VAT Profile, Loyalty Ledger, Membership Enroll, Invoices & Print) lên `GuestProfilePage`; sửa bug banner Email cho tài khoản SĐT; sửa gán nhãn `Overnight` ở `GetGuestBookingsQueryHandler`.<br>2. Nối Promotions thật + UI nhập PromoCode & `PointsToRedeem` vào `BookingHoldPage`.<br>3. Khép kín Review (trả trạng thái đã review, chỉ review khi `CheckedOut`/đang ở, sửa `BookingLookupPage`), và thiết kế tính năng Sửa/Đổi lịch đặt phòng.<br>4. Chuẩn hóa phân trang/lọc/availability ở Backend, nâng cấp bản đồ multi-pin, khắc phục lỗi mobile chat 375px, A11y (`for`, `role="dialog"`, touch target 44px), Dark Mode Auth và dọn dead code/tên cá nhân. | `P1-06`, `P1-09`, `P1-10`, `P2-01`..`P2-06`, `P3-01`..`P3-03` | `backend`, `frontend`, `qa`, `reviewer` |

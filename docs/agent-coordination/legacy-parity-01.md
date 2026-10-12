# Báo Cáo Khảo Sát Parity Bản Cũ & Đề Xuất Lát Cắt Triển Khai (MVP-LEGACY-PARITY-01) — Vòng 2

- **Mã nhiệm vụ:** `MVP-LEGACY-PARITY-01`
- **Vòng (Round):** 2 (Hiệu chỉnh theo Reviewer Findings trong `review.md`)
- **Thời điểm lập:** 2026-10-12
- **Tác nhân:** `antigravity`
- **Kho lưu trữ cũ tham chiếu (Legacy Repo):** `https://github.com/GinNgo/He-thong-quan-ly-khach-san`
- **Commit SHA tham chiếu bản cũ:** `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9`
- **Kho lưu trữ mới (Target Repo):** `hotel-saas-v2` (`C:\Dev\hotel-saas-v2`)
- **Nhánh & Commit HEAD bản mới:** `develop` (`3f95339b4f4477ac5d421551d372dfdd5ed31e30`)
- **Chế độ kiểm tra:** Read-only đối với mã nguồn bản cũ; không chạy script/backend của bản cũ; không nạp database, secrets hoặc dữ liệu cá nhân; bảo toàn dirty baseline hiện hữu.

---

## 1. Mục Đích & Nguyên Tắc Hiệu Chỉnh Vòng 2

Bản sửa đổi Vòng 2 này giải quyết triệt để 4 phát hiện (Findings) từ Codex Reviewer:
1. **[P1] Chuẩn hóa chính xác 100% định danh DTO:** Sử dụng đúng các trường thực tế trong `payment.model.ts` và backend DTOs (`cashCollected`, `bankTransferCollected`, `creditCardCollected`, `totalCollected`, `completedCount` cho `PaymentSummaryDto`; `totalAmount`, `paidAmount`, `remainingBalance`, `isFullyPaid` cho `FolioDto`).
2. **[P1] Tách biệt hoàn toàn ngữ nghĩa ngày giờ giữa 2 luồng dữ liệu thanh toán:**
   - Luồng 1: Tổng kết thực thu trong ngày theo giờ địa phương Việt Nam (UTC+7) căn cứ vào `PaidAtUtc` của các giao dịch `Completed`.
   - Luồng 2: Lịch sử bản ghi giao dịch thanh toán căn cứ vào mốc `CreatedAtUtc` theo giờ chuẩn UTC.
   - **Tuyên bố rõ ràng:** Hai luồng dữ liệu độc lập, không cấu thành bảng kê đối soát ca đóng quỹ (không claim shift reconciliation hoặc khớp tổng). Không đề xuất thay đổi chính sách ngày giờ hay backend contract khi chưa có PO.
3. **[P2] Ánh xạ chính xác các tuyến đường Public API:** Chuẩn hóa đúng các route thực tế của `PublicController` (`GET api/public/properties`, `POST api/public/quotes/calculate`, `POST api/public/bookings/hold`, `GET api/public/bookings/{lookupToken}`). Ghim chính xác định danh tệp và symbol của mã nguồn bản cũ.
4. **[P2] Giới hạn phạm vi bằng chứng (Bounded Claims):** Loại bỏ mọi khẳng định bao quát ("100% permission scenarios", "full lifecycle parity", "standard Accessibility"). Đánh dấu rõ ràng các khía cạnh là **NOT VERIFIED** khi thiếu kiểm chứng độc lập.
5. **Kế hoạch Lát cắt Bounded `FE-CASHIER-PAYMENTS-01` (CHỈ ĐỌC - READ-ONLY):** Phạm vi thuần túy hiển thị báo cáo thu ngân và lịch sử giao dịch; không thêm chức năng tạo thanh toán mới, không thêm bảng đóng ca/đối soát, không in hóa đơn, không tạo NoShow API. Bổ sung bộ tiêu chí chấp nhận hành vi kiểm thử chi tiết (property-switch stale-response rejection, absent-property fail-closed, permission denial, independent error/retry, timezone boundary).

---

## 2. Ma Trận Đối Chiếu Parity 7 Luồng Nghiệp Vụ Cốt Lõi (Được Chuẩn Hóa Theo Symbol & Route Thực Tế)

### 2.1. Luồng 1: Phân Quyền & Quản Trị Danh Tính (Auth, RBAC & Multi-Tenancy Context)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Controller: `com.hotel.controllers.AuthController` (`login`, `register`, `refresh`, `logout`, `google`, `facebook`).
  - Phân quyền: `com.hotel.controllers.RoleController`, `RolePermissionController`.
  - Frontend: `core/services/auth.service.ts`, `core/services/permission.service.ts` (`FunctionCode`, `ActionCode`).
  - *Đặc điểm:* Hỗ trợ đăng nhập mạng xã hội (Google, Facebook). Quyền phân chia động theo module/chức năng, nhưng ngữ cảnh `hotelId` truyền thủ công qua tham số request, không có cơ chế cách ly tổ chức tự động.
- **Mã nguồn bản mới (`3f95339b`):**
  - Controller: `HotelSaas.WebApi.Controllers.AuthController` (`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh-token`, `POST /api/auth/switch-context`, `GET /api/auth/memberships`, `GET /api/auth/me`).
  - Middleware bảo vệ: `TenantPropertyContextMiddleware.cs` (bắt buộc header `X-Property-Id`, kiểm tra quyền thành viên `TenantStaff` tại chi nhánh, trả về 403 Forbidden nếu không đủ quyền).
  - Authorization: `PermissionAuthorizationHandler.cs`, thuộc tính `RequirePermissionAttribute` / `RequireAnyPermissionAttribute`.
  - Frontend: `auth.service.ts` (quản lý signals `activePropertyId`, `activePropertyName`), `permission.guard.ts`.
- **Khoảng cách thực tế (Gap Analysis):**
  - Bản cũ có OAuth mạng xã hội (Google/Facebook); bản mới tập trung vào xác thực nội bộ và chuyển đổi ngữ cảnh đa chi nhánh (`switch-context`).
  - Bản mới có kiến trúc cách ly dữ liệu nhiều tổ chức (multi-tenancy) fail-closed chặt chẽ hơn.
- **Trạng thái kiểm thử:**
  - Bản mới có test pipeline: `P1B02B_ContextAuthorizationIntegrationTests.cs`, `TenantPropertyContextMiddlewareTests.cs`.
  - *Giới hạn bằng chứng:* Được kiểm thử trong phạm vi harness Phase 1B; chưa kiểm chứng với các kịch bản IdP bên ngoài.
- **Phân định Owner:** Antigravity (Phase 1A / P1B-02B đã nghiệm thu).

---

### 2.2. Luồng 2: Quản Lý Cơ Sở & Chính Sách Vận Hành (Property & Operational Policies)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Controller: `com.hotel.controllers.HotelController` (`getHotels`, `getHotelById`, `updateHotel`), `com.hotel.controllers.LocationController`.
  - Frontend: `features/management/properties/`, `features/admin/property-management/`.
  - *Đặc điểm:* Lưu thông tin khách sạn cơ bản (tên, địa chỉ, số điện thoại, tiện ích). Giờ check-in/out lưu tĩnh trong bảng khách sạn; không có cấu hình phụ thu linh hoạt theo khung giờ.
- **Mã nguồn bản mới (`3f95339b`):**
  - Controller: `HotelSaas.WebApi.Controllers.PropertiesController` (`GET /api/properties/{id}/policies`, `PUT /api/properties/{id}/policies`).
  - Entity & DTO: `PropertySurchargePolicy`, `PropertyPoliciesDto`.
  - Quy tắc vận hành: Giờ tiêu chuẩn Check-in/Check-out, khung giờ và đơn giá phụ thu nhận sớm (`EarlyCheckInFeePerHour`, `EarlyCheckInThresholdHours`), phụ thu trả trễ (`LateCheckOutFeePerHour`, `LateCheckOutThresholdHours`), và đệm dọn phòng buồng phòng (`TurnoverBufferMinutes`).
  - Frontend: `features/policies/policies.page.ts`.
- **Khoảng cách thực tế (Gap Analysis):**
  - Bản mới có mô hình chính sách phụ thu và đệm thời gian dọn phòng chuẩn hóa theo từng chi nhánh, hỗ trợ cả lưu trú theo giờ và theo đêm.
  - Bản cũ có quản lý danh mục địa lý hành chính tĩnh (`LocationController`). Bản mới đang tạm dừng mở rộng schema địa phương (Tỉnh/Thành, Quận/Huyện, Phường/Xã) do đang chờ **PO Gates 3 & 4**.
- **Trạng thái kiểm thử:**
  - Pipeline test: `PricingAndPoliciesHttpPipelineTests.cs` (kiểm thử đọc và cập nhật chính sách).
- **Phân định Owner:** Antigravity (P2B-01 đã nghiệm thu); phần địa lý chờ quyết định PO.

---

### 2.3. Luồng 3: Quản Lý Bảng Giá & Báo Giá Tức Thì (Pricing, Rates & Real-Time Quotes)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Entity: `RoomType` (lưu trường `basePrice` cố định).
  - Controller: `com.hotel.controllers.PublicQuoteController` (`calculateQuote`).
  - *Đặc điểm:* Báo giá tính theo công thức đơn giản (số ngày $\times$ giá gốc); không có logic phụ phí nhận sớm/trả trễ theo giờ thực tế.
- **Mã nguồn bản mới (`3f95339b`):**
  - Entity & CQRS: `RoomTypeRate`, `PropertySurchargePolicy`, `RoomTypeRateAudit`, `CalculateQuoteQuery`.
  - Controller: `HotelSaas.WebApi.Controllers.QuotesController` (`POST /api/quotes`).
  - Quy tắc định giá: Hỗ trợ đồng thời giá theo giờ (`HourlyRateFirstHours`, `HourlyRateAdditionalHour`) và giá theo đêm (`OvernightRate`). Tự động tính phụ thu thêm khách vượt chuẩn (`ExtraAdultFeePerHour`, `ExtraAdultFeePerNight`), phụ thu giờ nhận sớm và trả trễ.
  - Snapshot: Sinh `QuoteDto` với bản chụp giá bất biến.
  - Frontend: `features/rates/rates.page.ts`.
- **Khoảng cách thực tế (Gap Analysis):**
  - Động cơ báo giá của bản mới mạnh mẽ và linh hoạt hơn nhiều so với bản cũ.
  - *Cổng chờ:* Cơ chế ghim giá (Price pinning 5 phút cho báo giá / 15 phút cho giữ chỗ) và chính sách xử lý khi biểu giá thay đổi giữa chừng vẫn đang chờ **PO Gate Quote**.
- **Trạng thái kiểm thử:**
  - Pipeline test: `PricingAndPoliciesHttpPipelineTests.cs` (kiểm thử tính toán biểu phí giờ/đêm và phụ thu).
- **Phân định Owner:** Antigravity (P2B-02 đã nghiệm thu).

---

### 2.4. Luồng 4: Đặt Phòng & Quản Lý Tồn Phòng (Reservations & Room Availability)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Controller: `com.hotel.controllers.ReservationController` (`createReservation`, `getAllReservations`, `getAvailableRooms`, `assignRooms`).
  - Frontend: `features/admin/reservation-management/reservation-management.ts` (`openRoomAssignment`, `assignSelectedRoom`).
  - *Đặc điểm:* Cho phép tạo đặt phòng chung theo loại phòng trước, sau đó lễ tân mở hộp thoại chọn phòng vật lý để gán (`assignRooms`).
- **Mã nguồn bản mới (`3f95339b`):**
  - Controller: `HotelSaas.WebApi.Controllers.ReservationsController`:
    - `POST /api/reservations`: Đặt phòng gắn trực tiếp phòng vật lý cụ thể, khóa phòng tức thì, lưu snapshot báo giá, kiểm tra xung đột đệm dọn phòng (`turnoverBufferMinutes`).
    - `GET /api/reservations`: Danh sách đặt phòng phân trang, lọc theo chi nhánh, trạng thái, dải ngày, từ khóa.
    - `GET /api/reservations/{id}`: Chi tiết đặt phòng.
    - `GET /api/reservations/availability`: Kiểm tra tồn phòng thực tế theo khoảng thời gian và đệm dọn phòng.
  - Frontend: `features/reservations/reservations.page.ts`.
- **Khoảng cách thực tế (Gap Analysis):**
  - Bản cũ hỗ trợ quy trình 2 bước: Đặt phòng $\to$ Gán phòng sau. Bản mới thiết kế gán phòng vật lý ngay khi tạo đơn để loại bỏ triệt để nguy cơ overbooking.
  - Giao diện danh sách đặt phòng bản mới thiếu các nút bấm lọc nhanh 1-click cho lễ tân theo ca trực (Hôm nay, Đến hôm nay - Arrivals, Đi hôm nay - Departures, Đang lưu trú - In-house).
- **Trạng thái kiểm thử:**
  - Pipeline test: `BookingHttpPipelineTests.cs`.
- **Phân định Owner:** Antigravity (P3B đã nghiệm thu).

---

### 2.5. Luồng 5: Vòng Đời Lưu Trú Nhận / Trả Phòng (Stay Lifecycle: Check-in, Check-out, Stay Actions)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Controller: `com.hotel.controllers.ReservationController` (`checkIn`, `checkout`, `cancelReservation`, `markNoShow`).
  - Logic buồng phòng: Khi check-in chuyển phòng sang `OCCUPIED`, khi check-out chuyển sang `DIRTY`.
  - Frontend: `features/admin/reservation-management/reservation-management.ts` (`checkIn`, `cancelOperational`, `updateStatus`).
- **Mã nguồn bản mới (`3f95339b`):**
  - Controller: `HotelSaas.WebApi.Controllers.ReservationsController`:
    - `POST /api/reservations/{id}/check-in`: Chuyển reservation sang `CheckedIn`, chuyển phòng sang `Occupied`.
    - `POST /api/reservations/{id}/check-out`: Chuyển reservation sang `CheckedOut`, chuyển phòng sang `Dirty`.
    - `POST /api/reservations/{id}/cancel`: Chuyển reservation sang `Cancelled`, lưu lý do hủy, giải phóng phòng.
  - Domain Enum: `ReservationStatus` (`PendingPayment = 1`, `Confirmed = 2`, `CheckedIn = 3`, `CheckedOut = 4`, `Cancelled = 5`, `NoShow = 6`).
  - Frontend: `features/reservations/reservations.page.ts` (có nút Check-in, Check-out, Cancel).
- **Khoảng cách thực tế (Gap Analysis):**
  - Enum `NoShow = 6` đã tồn tại trong domain backend v2, nhưng **chưa có endpoint `POST /api/reservations/{id}/no-show`** và Command chuyên biệt.
  - *Đánh giá tính đầy đủ:* **NOT VERIFIED đối với toàn bộ vòng đời** (vì thiếu hành động NoShow chuyên biệt).
- **Trạng thái kiểm thử:**
  - Pipeline test: `StayLifecycleHttpPipelineTests.cs` (kiểm thử 14 kịch bản Check-in, Check-out, Cancel).
- **Phân định Owner:** Antigravity (P4 đã nghiệm thu).

---

### 2.6. Luồng 6: Thu Ngân, Bảng Kê Folio & Thu Tiền Thủ Công (Payments, Cashier & Folio Statements)

#### Cấu trúc DTO & Hợp đồng Thực tế (Exact Concrete Contracts):
- **Bảng kê công nợ (`FolioDto`):**
  - Tệp: `frontend/src/app/core/models/payment.model.ts` & backend `GetFolioQueryHandler.cs`
  - Các trường chính xác:
    - `totalAmount: number` (Tổng giá trị đơn đặt phòng gồm tiền phòng và phụ phí)
    - `paidAmount: number` (Tổng tiền đã thanh toán thành công)
    - `remainingBalance: number` (Số dư còn nợ)
    - `isFullyPaid: boolean` (Cờ đã thanh toán đủ)
    - `payments: PaymentDto[]` (Danh sách các phiếu thanh toán đã thực hiện)
- **Tổng kết ca thu ngân (`PaymentSummaryDto`):**
  - Tệp: `frontend/src/app/core/models/payment.model.ts` & backend `GetPaymentSummaryQueryHandler.cs`
  - Các trường chính xác:
    - `propertyId: string` (Mã chi nhánh)
    - `date: string` (Ngày tổng kết theo định dạng `YYYY-MM-DD`)
    - `cashCollected: number` (Tiền mặt thực thu)
    - `bankTransferCollected: number` (Chuyển khoản thực thu)
    - `creditCardCollected: number` (Thẻ tín dụng thực thu)
    - `totalCollected: number` (Tổng thực thu trong ngày)
    - `completedCount: number` (Số lượng giao dịch thành công)
- **Bản ghi thanh toán (`PaymentDto`):**
  - `id: string`, `reservationId?: string`, `amount: number`, `currency: string`, `method: PaymentMethod`, `methodName: string`, `status: PaymentStatus`, `statusName: string`, `transactionRef?: string`, `notes?: string`, `createdAtUtc: string`.

#### Tách Biệt Ngữ Nghĩa Ngày Giờ (Distinct Date Semantics Analysis):
1. **Luồng Tổng kết Thực thu trong ngày (`GetPaymentSummaryQueryHandler`):**
   - Lọc theo ngày địa phương Việt Nam (UTC+7): `var vnNow = DateTime.UtcNow.AddHours(7); var targetDate = request.Date ?? DateOnly.FromDateTime(vnNow);`.
   - Chuyển đổi sang dải UTC tương ứng: `[startUtc, endUtc]`.
   - Tiêu chí lọc: **`Status == PaymentStatus.Completed` VÀ `PaidAtUtc >= startUtc && PaidAtUtc <= endUtc`**.
   - Ý nghĩa nghiệp vụ: Thống kê số tiền thực sự đã thu được vào tài khoản/két tiền trong ngày theo giờ Việt Nam.
2. **Luồng Nhật ký Giao dịch (`GetPaymentsQueryHandler`):**
   - Lọc theo dải ngày `DateFrom` / `DateTo` truyền vào: `var startUtc = request.DateFrom.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);`.
   - Tiêu chí lọc: **`CreatedAtUtc >= startUtc`** (dải ngày tính theo ranh giới chuẩn UTC).
   - Ý nghĩa nghiệp vụ: Xem lại lịch sử các bản ghi thanh toán được tạo trên hệ thống theo mốc giờ UTC.
3. **Tuyên bố Ranh giới Nghiệp vụ (Explicit Disclaimer):**
   - `PaymentDto` chỉ chứa `createdAtUtc`, không cung cấp `paidAtUtc`.
   - Do đó, danh sách giao dịch từ `GetPayments` và các số liệu KPI từ `GetPaymentSummary` **không cấu thành một bảng đối soát khớp dòng 1-1 (không phải shift reconciliation)**.
   - Giao diện người dùng phải hiển thị nhãn và vùng dữ liệu tách biệt hoàn toàn; không tự ý thay đổi chính sách ngày giờ hay backend handler (việc sửa đổi này đòi hỏi PO phê duyệt).

- **Khoảng cách thực tế (Gap Analysis):**
  - Backend API (`GET /api/payments` và `GET /api/payments/summary`) đã hoàn chỉnh và có test.
  - Client service `PaymentService.ts` đã viết sẵn các hàm gọi API tương ứng.
  - **Khoảng cách duy nhất:** Admin Layout chưa mở trang giao diện `/payments` để lễ tân/thu ngân tra cứu nhanh dữ liệu này.
- **Trạng thái kiểm thử:**
  - `PaymentAndFolioHttpPipelineTests.cs` tồn tại trong repo mới.
  - *Giới hạn bằng chứng:* **NOT VERIFIED như bằng chứng độc lập** vì test chạy trong môi trường cục bộ của tác giả với cấu hình riêng; cần bộ test giao diện hành vi độc lập trên frontend.
- **Phân định Owner:** Antigravity.

---

### 2.7. Luồng 7: Khách Vãng Lai & Đặt Phòng Trực Tuyến (Guest OTA Discovery, Hold & Confirmation)

- **Mã nguồn bản cũ (`7e7ed12c`):**
  - Controller: `com.hotel.controllers.PropertySearchController`, `PublicDiscoveryController` (`searchProperties`, `getFeaturedHotels`).
  - Thanh toán: Tích hợp VNPay sandbox tự động.
  - Frontend: `features/client/home/`, `features/client/booking-checkout/`.
- **Mã nguồn bản mới (`3f95339b`):**
  - Controller: `HotelSaas.WebApi.Controllers.PublicController`:
    - `GET api/public/properties`: Tìm kiếm cơ sở lưu trú với bộ so khớp mờ Fuzzy Matcher (query param: `search`).
    - `GET api/public/properties/{slug}`: Chi tiết cơ sở theo đường dẫn tĩnh (slug).
    - `GET api/public/properties/{slug}/room-types`: Danh sách loại phòng mở bán công khai.
    - `GET api/public/properties/{slug}/availability`: Kiểm tra tồn phòng thực tế của loại phòng.
    - `POST api/public/quotes/calculate`: Tính báo giá công khai chuẩn xác từ pricing engine.
    - `POST api/public/bookings/hold`: Tạo giữ phòng 15 phút, sinh `lookupToken`.
    - `GET api/public/bookings/{lookupToken}`: Tra cứu trạng thái đặt phòng ẩn danh.
  - Xác nhận: Lễ tân thu cọc và xác nhận qua `POST api/reservations/{id}/confirm`.
  - Frontend: `booking.page.ts`, `booking-hold.page.ts`, `booking-status.page.ts` (giao diện hiện đại, điều hướng bàn phím đã nghiệm thu Round 1 `P7-GUEST-KEYBOARD-CONTINUITY-04`).
- **Khoảng cách thực tế (Gap Analysis):**
  - Bản cũ có cổng VNPay tự động; bản mới dùng cơ chế giữ chỗ 15 phút kèm xác nhận cọc thủ công để phù hợp giai đoạn MVP học thuật.
  - Các cổng quyết định về API tìm kiếm (`GET /api/public/search/properties`), chính sách xuất bản (`IsPublished`), và tìm kiếm xuyên cơ sở vẫn đang chờ **PO Gates 1, 2, 5**.
- **Trạng thái kiểm thử:**
  - Pipeline test: `P5_GuestBookingHttpPipelineTests.cs`.
  - *Giới hạn bằng chứng:* Điều hướng bàn phím chỉ được nghiệm thu trong phạm vi bằng chứng synthetic traversal có giới hạn của Round 1, **KHÔNG PHẢI chứng nhận toàn diện WCAG hay mobile native keyboard**.
- **Phân định Owner:** Antigravity (P5/P7 đã nghiệm thu).

---

## 3. Ranh Giới Phân Công Đội Ngũ & 7 Cổng Quyết Định PO

1. **Ranh giới Phân công Đội ngũ (Team Boundary Protection):**
   - **Nguyên (Rooms & RoomTypes):** Quản lý danh mục phòng, loại phòng, tiện ích, trạng thái phòng $\implies$ **Giữ nguyên, không can thiệp, không giao việc chồng chéo**.
   - **Tân (Housekeeping):** Quản lý buồng phòng, phân công dọn dẹp, hoàn tất dọn phòng $\implies$ **Giữ nguyên, không can thiệp, không giao việc chồng chéo**.
2. **Bảo toàn 7 Cổng Quyết Định PO (`decisions.md`):**
   - Cổng D21: Lookup TTL & revoke/reissue contract $\implies$ `NeedsPO`.
   - Cổng Quote: Quote 5m / hold 15m price pinning và stale-quote policy $\implies$ `NeedsPO`.
   - Cổng PO Gate 1: Hợp đồng API tìm kiếm `/api/public/search/properties` $\implies$ `NeedsPO`.
   - Cổng PO Gate 2: Chính sách xuất bản `IsPublished` vs Active-only $\implies$ `NeedsPO`.
   - Cổng PO Gate 3: Nguồn dữ liệu địa lý hành chính Việt Nam & bản quyền $\implies$ `NeedsPO`.
   - Cổng PO Gate 4: Migration mở rộng địa bàn cho Property $\implies$ `NeedsPO`.
   - Cổng PO Gate 5: Cơ chế tìm kiếm phòng trống xuyên cơ sở $\implies$ `NeedsPO`.
3. **Phase 6 (AI Assistant):** Giữ nguyên trạng thái chưa mở (`unopened`).

---

## 4. Kế Hoạch Triển Khai Lát Cắt `FE-CASHIER-PAYMENTS-01` (CHỈ ĐỌC - READ-ONLY)

Theo chỉ đạo của Reviewer trong `review.md`, lát cắt triển khai được lựa chọn là **`FE-CASHIER-PAYMENTS-01`** với phạm vi được giới hạn nghiêm ngặt:

### 4.1. Phạm Vi Thực Hiện (Strict Scope & Non-Goals)
- **NẰM TRONG PHẠM VI (In-Scope):**
  - Xây dựng giao diện **Chỉ đọc (Read-Only)** hiển thị Báo cáo Tổng kết Thu ngân trong ngày và Nhật ký Giao dịch thanh toán tại tuyến đường `/payments`.
  - Kết nối với 2 API backend hiện hữu: `GET /api/payments/summary` và `GET /api/payments`.
  - Sử dụng service hiện hữu `PaymentService.ts`.
  - Gắn route guard `permissionGuard` kiểm tra quyền `PAYMENTS:Read` (`action: 1`).
  - Gắn menu item trong `admin-layout.ts` hiển thị khi có quyền `hasPaymentsPermission()`.
  - Tách biệt rõ ràng 2 khối hiển thị với nhãn múi giờ cụ thể.
- **TUYỆT ĐỐI NGOÀI PHẠM VI (Non-Goals / Excluded):**
  - Không tạo chức năng nộp tiền / thu tiền mới (`POST /api/payments` không đưa vào trang này).
  - Không tạo entity hay giao diện đóng ca / chốt quỹ (no shift-close / cashier shift audit).
  - Không tạo chức năng đối soát ngân hàng (no bank reconciliation).
  - Không tạo mẫu in biên nhận / xuất hóa đơn (no printable receipt / invoice).
  - Không tạo endpoint NoShow.
  - Không thay đổi mã nguồn backend, không sửa đổi chính sách ngày giờ.

---

### 4.2. Danh Sách Tệp Dự Kiến Tác Động
1. `frontend/src/app/features/payments/payments.page.ts` (Tạo mới: Trang hiển thị báo cáo thu ngân standalone).
2. `frontend/src/app/features/payments/payments.page.spec.ts` (Tạo mới: Bộ kiểm thử hành vi giao diện).
3. `frontend/src/app/app.routes.ts` (Thêm route `/payments` có `permissionGuard` với `{ permission: 'PAYMENTS', action: 1 }`).
4. `frontend/src/app/layouts/admin-layout/admin-layout.ts` (Thêm hàm `hasPaymentsPermission()` và mục menu "Thu ngân & Giao dịch").

---

### 4.3. Tiêu Chí Chấp Nhận Hành Vi Kiểm Thử (Behavioral Acceptance Criteria - BAC)

- **BAC 1: Tách biệt rõ ràng 2 luồng dữ liệu & Nhãn thời gian chuẩn mực**
  - **Khối 1: Tổng kết Thực thu trong ngày (Giờ Việt Nam UTC+7):**
    - Gọi API: `getPaymentSummary(propertyId, todayVnDate)`.
    - Dữ liệu hiển thị (từ `PaymentSummaryDto`):
      - Tiền mặt thực thu: `cashCollected` (định dạng VNĐ).
      - Chuyển khoản thực thu: `bankTransferCollected` (định dạng VNĐ).
      - Thẻ tín dụng thực thu: `creditCardCollected` (định dạng VNĐ).
      - Tổng tiền thực thu: `totalCollected` (định dạng VNĐ).
      - Số lượt thu thành công: `completedCount`.
    - Tiêu đề khối: *"Tổng kết Thực thu trong ngày (Giờ Việt Nam - UTC+7)"*.
  - **Khối 2: Nhật ký Giao dịch (Giờ chuẩn UTC):**
    - Gọi API: `getPayments({ propertyId, dateFrom, dateTo, page, pageSize })`.
    - Dữ liệu hiển thị bảng (từ `PaymentDto[]`): Mã giao dịch, Mã đặt phòng, Số tiền (`amount`), Phương thức (`methodName`), Trạng thái (`statusName`), Thời gian tạo UTC (`createdAtUtc`).
    - Tiêu đề khối: *"Nhật ký Giao dịch (Thời gian ghi nhận - Giờ UTC)"*.
  - **Thông điệp cảnh báo bắt buộc (Explicit UI Disclaimer):**
    - Hiển thị văn bản hướng dẫn: *"Lưu ý: Bảng tổng kết thực thu thống kê các giao dịch hoàn tất theo ngày phát sinh (Giờ VN UTC+7). Nhật ký giao dịch bên dưới được truy xuất theo thời điểm tạo bản ghi (Giờ UTC). Hai luồng dữ liệu độc lập và không cấu thành bảng đối soát khớp dòng."*

- **BAC 2: Loại bỏ phản hồi trễ khi chuyển chi nhánh (Property-Switch Stale-Response Rejection)**
  - Khi người dùng đổi chi nhánh trên Context Switcher (`activePropertyId` signal thay đổi):
    - Hủy bỏ các request đang xử lý của chi nhánh cũ (sử dụng RxJS `switchMap` hoặc cờ requestId).
    - Không bao giờ hiển thị kết quả của chi nhánh cũ đè lên chi nhánh mới.

- **BAC 3: Xử lý trạng thái chưa chọn chi nhánh (Absent-Property Fail-Closed)**
  - Nếu `authService.activePropertyId()` là `null` hoặc rỗng:
    - Hiển thị component `EmptyStateComponent` với thông báo: *"Vui lòng chọn cơ sở hoạt động để xem dữ liệu thu ngân."*.
    - Ngăn chặn triệt để việc gửi request HTTP với `propertyId` rỗng lên backend.

- **BAC 4: Kiểm soát phân quyền (Permission Denial)**
  - Tuyến đường `/payments` bị chặn bởi `permissionGuard` nếu token thiếu quyền `PAYMENTS:Read` (`action: 1`).
  - Chuyển hướng người dùng về `/forbidden` kèm thông báo *"Bạn không có quyền truy cập trang này."*.
  - Menu Admin Layout ẩn mục "Thu ngân & Giao dịch" nếu `hasPaymentsPermission()` trả về `false`.

- **BAC 5: Quản lý trạng thái độc lập cho cả 2 luồng (Independent Loading / Error / Empty / Retry)**
  - Quản lý các signal độc lập:
    - `isLoadingSummary` và `isLoadingPayments`.
    - `summaryError` và `paymentsError`.
    - `isSummaryEmpty` và `isPaymentsEmpty`.
  - Nếu luồng Summary lỗi kết nối (HTTP 500 / Network Error), hiển thị khối lỗi có nút "Thử lại" riêng cho Summary; luồng Payments list vẫn tải và hiển thị bình thường (và ngược lại).

- **BAC 6: Kiểm thử ranh giới múi giờ (Timezone Boundary Testing)**
  - Viết unit test xác nhận hàm chuyển đổi ngày lấy đúng ngày theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7) cho `PaymentSummaryDto`, không bị lùi ngày khi chạy ở múi giờ UTC hoặc âm.

---

### 4.4. Lệnh Kiểm Thử An Toàn & Định Nghĩa Hoàn Thành (Definition of Done)

- **Lệnh kiểm thử Frontend:**
  - Chạy test giao diện: `npm test -- --include src/app/features/payments/payments.page.spec.ts` (hoặc `npx vitest run src/app/features/payments`).
  - Kiểm tra biên dịch: `npm run build` (đảm bảo 0 lỗi TypeScript / template Angular).
- **Lệnh kiểm thử Backend (giữ nguyên không đổi):**
  - `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter "FullyQualifiedName~PaymentAndFolio" --no-restore`.
- **Định nghĩa Hoàn thành (DoD):**
  - Toàn bộ 6 tiêu chí BAC được đáp ứng và kiểm thử tự động pass.
  - Giao diện đáp ứng tốt trên Desktop ($\ge 1440\text{px}$), Tablet ($768\text{px}$) và Mobile ($375\text{px}$).
  - Không có lỗi console runtime; không thay đổi bất kỳ file backend hay database nào.

---

## 5. Kết Luận & Đề Nghị Hướng Xử Lý

Báo cáo Vòng 2 đã khắc phục hoàn toàn mọi phát hiện của Reviewer, làm rõ cấu trúc DTO thực tế, phân định ranh giới ngữ nghĩa ngày giờ và thiết lập kế hoạch triển khai `FE-CASHIER-PAYMENTS-01` thuần túy Chỉ đọc (Read-Only) với kiểm thử hành vi nghiêm ngặt.

Kính trình Reviewer (Codex) nghiệm thu báo cáo khảo sát parity và phê duyệt lát cắt `FE-CASHIER-PAYMENTS-01` để Antigravity tiến hành thực hiện trong lượt tiếp theo (`ApprovedNext`).

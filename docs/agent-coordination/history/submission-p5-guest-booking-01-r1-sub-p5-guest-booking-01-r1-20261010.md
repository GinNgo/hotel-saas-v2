# Submission: P5-GUEST-BOOKING-01 (Round 1)

- **TaskId:** P5-GUEST-BOOKING-01
- **Round:** 1
- **SubmissionId:** sub-p5-guest-booking-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T16:00:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Lát cắt P5-GUEST-BOOKING-01 (Guest Public Booking Engine & Shared Real-Time Inventory)

Lát cắt **P5-GUEST-BOOKING-01** hoàn thành trọn vẹn luồng khách hàng đặt phòng trực tuyến (Online Guest Booking) độc lập, không yêu cầu đăng nhập tài khoản trước, đồng bộ trực tiếp với kho phòng của khách sạn theo thời gian thực và tuân thủ tuyệt đối toàn bộ các quyết định kiến trúc P0 (D01–D25):

1. **Khám phá Bất động sản & Kiểm tra Phòng trống Công khai (Public Discovery & Availability):**
   - Tìm kiếm danh sách khách sạn đang hoạt động (`GetPublicPropertiesQuery`), hỗ trợ slug/tên khách sạn.
   - Liệt kê các hạng phòng (`GetPublicRoomTypesQuery`) kèm sức chứa, giá cơ bản, tiện ích, mô tả và hình ảnh.
   - Tra cứu phòng trống theo hạng phòng cho khoảng ngày lưu trú (`GetPublicAvailabilityQuery`), phản ánh chính xác số lượng phòng còn khả dụng theo thời gian thực.
   - Tính toán báo giá chính thức authoritative từ server (`CalculatePublicQuoteQuery` qua `PricingCalculator`), bao gồm phụ thu check-in sớm, check-out muộn, chiết khấu và thuế/phí theo chính sách khách sạn (D05).

2. **Tự động Gán Phòng Vật lý khi Giữ chỗ (Room Auto-Assignment on Hold - D01):**
   - Khách hàng trực tuyến chọn Hạng phòng (Room Type), server tự động tìm phòng vật lý khả dụng đầu tiên thuộc hạng phòng đó.
   - Xin khóa độc quyền trên dòng phòng được gán (`LockRoomRowAsync(room.Id)`) trong transaction để triệt tiêu mọi khả năng race condition hoặc overbooking (D01).

3. **Cơ chế Giữ chỗ 15 Phút & Kho Phòng Dùng chung (15-Minute Expiration & Shared Inventory - D03):**
   - Trực tuyến và nội bộ (Lễ tân/Admin) dùng chung 1 kho phòng thực tế, không phân chia hạn ngạch (allotment) riêng biệt.
   - Khi tạo hold, thời gian hết hạn được đóng dấu chính xác: `HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(15)`.
   - Giữ chỗ đang hoạt động (`IsBlockingReservation`) sẽ chặn cả việc đặt phòng từ lễ tân và khách trực tuyến khác. Khi hết hạn 15 phút, phòng tự động được giải phóng ngay lập tức trong mọi logic kiểm tra phòng trống mà không cần chờ background worker dọn dẹp. Cả `CreateReservationCommandHandler` và `GetRoomAvailabilityQueryHandler` đã được nâng cấp đồng bộ.

4. **Yêu cầu Đặt cọc 30% (30% Deposit Requirement - D15):**
   - Đơn giữ chỗ tính toán số tiền cọc bắt buộc: `DepositRequired = Math.Round(quote.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero)`.

5. **Tra cứu Bảo mật & Che giấu PII (Secure Lookup Token & PII Masking - D02, D21):**
   - Sinh mã tra cứu `LookupToken` ngẫu nhiên bảo mật bằng `RandomNumberGenerator` (48 ký tự hex), không thể đoán biết.
   - API tra cứu công khai `GetGuestBookingByTokenQuery` chỉ chấp nhận `LookupToken`.
   - Dữ liệu trả về che giấu PII nghiêm ngặt qua `PiiMaskingHelper`:
     - Email: `g***t@example.com`
     - Phone: `090****567`
     - Guest Name: `N***h`
   - Mã xác nhận nội bộ (`ConfirmationCode`) không được phép sử dụng để lộ dữ liệu cá nhân ra bên ngoài.

6. **Xác nhận Đặt cọc & Idempotency Replay (Confirm Booking & Deposit - D08, D15):**
   - Dưới khóa phòng (`LockRoomRowAsync`), kiểm tra hold chưa quá hạn (`HoldExpiresAtUtc > UtcNow`).
   - Ghi nhận giao dịch thanh toán tiền cọc vào Folio của đơn (`PaymentMethod.BankTransfer` / `CreditCard`, trạng thái `Completed`).
   - Chuyển trạng thái đơn sang `Confirmed` và lưu snapshot.
   - Replay với cùng token được xử lý idempotent, trả về ngay chi tiết đặt phòng hiện hành mà không thu tiền lần hai.

7. **Zero-Migration Compliance:**
   - Không tạo bất kỳ migration hay DDL nào đối với cơ sở dữ liệu.
   - Toàn bộ metadata giữ chỗ (`HoldExpiresAtUtc`, `LookupToken`, `DepositRequired`, `IsOnlineHold`) được serialize an toàn trong trường `Reservation.Notes` JSON snapshot.

---

## 2. Chi tiết Triển khai Kiến trúc & Thành phần Mã nguồn

### 2.1. Backend C# / ASP.NET Core & EF Core

1. **Snapshot & Domain Helper Updates:**
   - [`ReservationSnapshot.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs): Bổ sung `HoldExpiresAtUtc`, `LookupToken`, `DepositRequired`, `IsOnlineHold`.
   - [`ReservationTimeHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs): Thêm hàm `IsBlockingReservation(Reservation reservation, DateTime nowUtc)` nhận biết trạng thái `Pending` online hold đã hết hạn để giải phóng phòng tức thì.
   - [`CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs) & [`GetRoomAvailabilityQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs): Tích hợp kiểm tra phòng bị khóa với `IsBlockingReservation`.
   - [`TenantPropertyContextMiddleware.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Middlewares/TenantPropertyContextMiddleware.cs): Bổ sung `path.StartsWith("/api/public")` vào danh sách endpoint công khai, cho phép khách vãng lai gọi API mà không cần Bearer token hay tenant header.

2. **Pricing Engine:**
   - [`IPricingCalculator.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Quotes/Services/IPricingCalculator.cs) & [`PricingCalculator.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs): Bộ tính toán báo giá authoritative áp dụng giá ngày thường, giá cuối tuần, phụ thu early check-in/late check-out, giảm giá voucher, phí dịch vụ và thuế VAT theo chính sách của Property.

3. **Public DTOs & PII Masking:**
   - Thư mục `backend/src/HotelSaas.Application/Public/DTOs/`:
     - `PublicPropertyDto.cs`, `PublicRoomTypeDto.cs`, `PublicRoomTypeAvailabilityDto.cs`, `GuestHoldDto.cs`, `GuestBookingDetailDto.cs`.
   - [`PiiMaskingHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Helpers/PiiMaskingHelper.cs): Cung cấp các hàm regex/chuỗi `MaskEmail`, `MaskPhone`, `MaskName`.

4. **Public Queries & Commands (MediatR):**
   - Thư mục `backend/src/HotelSaas.Application/Public/Queries/`:
     - `GetPublicPropertiesQuery.cs`: Tìm kiếm property active theo tên/slug.
     - `GetPublicPropertyBySlugQuery.cs`: Lấy thông tin chi tiết property công khai.
     - `GetPublicRoomTypesQuery.cs`: Lấy danh sách hạng phòng active của khách sạn.
     - `GetPublicAvailabilityQuery.cs`: Tính toán số lượng phòng trống của từng hạng phòng cho khoảng ngày đặt.
     - `CalculatePublicQuoteQuery.cs`: Tính báo giá chi tiết, phân rã từng dòng mục phí.
     - `GetGuestBookingByTokenQuery.cs`: Tra cứu đơn bằng `LookupToken`, trả về thông tin bảo vệ PII.
   - Thư mục `backend/src/HotelSaas.Application/Public/Commands/`:
     - `CreateGuestHoldCommand.cs`: Tự động gán phòng vật lý khả dụng đầu tiên, xin khóa dòng `LockRoomRowAsync`, kiểm tra overlap không trùng lặp, tính quote & 30% deposit, tạo reservation trạng thái `Pending` với 15-phút hold và `LookupToken` 48 ký tự hex.
     - `ConfirmGuestBookingCommand.cs`: Dưới khóa dòng phòng, kiểm tra hold chưa quá hạn, tạo thanh toán tiền cọc `Payment`, chuyển trạng thái `Confirmed`, hỗ trợ idempotent replay.

5. **Public API Controller:**
   - [`PublicController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PublicController.cs):
     - `GET /api/public/properties`: Danh sách khách sạn.
     - `GET /api/public/properties/{slug}`: Chi tiết khách sạn.
     - `GET /api/public/properties/{propertyId}/room-types`: Danh sách loại phòng.
     - `GET /api/public/properties/{propertyId}/availability`: Tra cứu phòng trống.
     - `POST /api/public/quotes/calculate`: Tính toán báo giá authoritative.
     - `POST /api/public/bookings/hold`: Tạo giữ chỗ 15 phút kèm tự động gán phòng.
     - `POST /api/public/bookings/confirm`: Xác nhận thanh toán tiền cọc & đơn đặt phòng.
     - `GET /api/public/bookings/lookup`: Tra cứu chi tiết đơn bằng token (che PII).

---

### 2.2. Frontend Angular (Standalone Components & Signals)

1. **Models & Services:**
   - [`public-booking.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/public-booking.model.ts): Định nghĩa toàn bộ interfaces DTO cho flow công khai.
   - [`public-booking.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.ts): Tích hợp gọi đầy đủ 8 endpoint `/api/public/...`.
   - [`public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts): Bộ 8 unit tests cho service, mock `HttpClient`, pass 100%.

2. **Public UI Pages:**
   - [`booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts):
     - Khám phá chọn khách sạn, chọn ngày check-in/check-out.
     - Hiển thị danh sách hạng phòng kèm badge phòng trống còn lại (`AvailableRoomsCount`).
     - Tự động gọi tính báo giá authoritative (`quote`) khi chọn hạng phòng, hiển thị phân tích giá minh bạch.
     - Form thông tin khách đặt (Tên, Email, SĐT), gửi lệnh giữ chỗ `/api/public/bookings/hold` và điều hướng sang trang giữ chỗ với token.
   - [`booking-hold.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking-hold.page.ts):
     - Đồng hồ đếm ngược 15 phút số hóa theo thời gian thực (`mm:ss`).
     - Hiển thị cảnh báo vàng khi thời gian còn dưới 3 phút.
     - Tự động khóa giao diện và thông báo hết hạn khi đếm ngược về 00:00.
     - Chi tiết số tiền đặt cọc 30% cần thanh toán (`depositRequired`).
     - Hỗ trợ nút mô phỏng xác nhận đặt cọc (Demo Payment) chuyển trạng thái thành công.
   - [`booking-status.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking-status.page.ts):
     - Form tra cứu đơn đặt phòng qua token bảo mật (hỗ trợ đọc token từ route param hoặc nhập thủ công).
     - Hiển thị thông tin đặt phòng an toàn với dữ liệu PII đã được che mờ (Email, Phone, Tên).
     - Bảng sao kê tài chính Folio (Tổng tiền, Tiền cọc đã trả, Dư nợ còn lại cần trả khi nhận phòng).

3. **Routing Configuration:**
   - [`app.routes.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.routes.ts): Đăng ký các route công khai không yêu cầu AuthGuard:
     - `/booking`: Trang chọn phòng và đặt phòng chính.
     - `/booking/hold/:token`: Trang đếm ngược giữ chỗ và thanh toán cọc.
     - `/booking/lookup`: Trang tra cứu đơn đặt phòng.
     - `/booking/status/:token`: Trang chi tiết đơn đặt phòng bằng token.

4. **Component Tests:**
   - [`public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts): 7 integration tests kiểm tra toàn bộ luồng hiển thị, search, tính quote, đếm ngược hold timer, và tra cứu token có che mờ PII.

---

## 3. Bằng chứng Kiểm thử (Test Evidence)

### 3.1. Backend Tests (230 Application Tests + 45 WebApi Tests = 275 Tests PASS)

Chạy lệnh kiểm thử tự động với PostgreSQL đang chạy thực tế:
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P5_GuestBookingTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 8, Skipped: 0, Total: 8, Duration: 18 s
```

8 kịch bản kiểm thử toàn diện của `P5_GuestBookingTests`:
1. `CreateGuestHold_AssignsRoom_Sets15MinExpiration_And30PercentDeposit`: Tự động gán phòng, tính chính xác hạn 15 phút, yêu cầu cọc 30% và sinh `LookupToken` 48 ký tự.
2. `ActiveHold_BlocksInternalAndPublicBooking`: Hold đang hoạt động chặn hoàn toàn cả lễ tân nội bộ và khách trực tuyến đặt vào phòng đó.
3. `ExpiredHold_DoesNotBlockNewBooking`: Hold quá 15 phút tự động giải phóng phòng cho lượt đặt mới ngay cả khi chưa chạy worker.
4. `ConfirmGuestBooking_ValidHold_TransitionsToConfirmed_AndRecordsDeposit`: Xác nhận cọc hợp lệ chuyển đơn thành `Confirmed` và tạo bản ghi thanh toán.
5. `ConfirmGuestBooking_ExpiredHold_ThrowsConflictException`: Xác nhận hold đã quá 15 phút bị từ chối `ERR_HOLD_EXPIRED` (HTTP 409 Conflict).
6. `ConfirmGuestBooking_ReplayIsIdempotent`: Gọi xác nhận lặp lại với cùng token trả về thành công ngay lập tức mà không thu tiền hai lần.
7. `GetGuestBookingByToken_MasksPii`: Dữ liệu tra cứu đơn bằng token trả về PII đã che mờ (`g***t@example.com`, `090****567`, `N***h`).
8. `NoAvailableRooms_ThrowsConflictException`: Không còn phòng trống thuộc hạng phòng yêu cầu sẽ báo lỗi xung đột rõ ràng `ERR_NO_ROOM_AVAILABLE`.

Chạy toàn bộ regression test suite Backend:
- `backend/tests/HotelSaas.Application.Tests/`: **230/230 PASS**
- `backend/tests/HotelSaas.WebApi.Tests/`: **45/45 PASS**

### 3.2. Frontend Tests (145/145 Vitest Tests PASS)

```powershell
npm test -- --run
```
**Kết quả:**
```text
✓ src/app/core/services/public-booking.service.spec.ts (8 tests)
✓ src/app/features/public-booking/public-booking.page.spec.ts (7 tests)
✓ src/app/features/reservations/reservations.page.spec.ts (26 tests)
...
Test Files  11 passed (11)
     Tests  145 passed (145)
  Duration  17.76s
```

### 3.3. Production Angular Build

```powershell
npm run build
```
**Kết quả:**
```text
Application bundle generation complete. [7.653 seconds]
Output location: C:\Dev\hotel-saas-v2\frontend\dist\hotel-saas-frontend
Exit code: 0
```
Tất cả các chunk và lazy route công khai (`booking.page`, `booking-hold.page`, `booking-status.page`) được build thành công, không có bất kỳ lỗi TypeScript hay cảnh báo cú pháp nào.

---

## 4. Danh sách Tệp Tạo mới & Sửa đổi (Files Manifest)

| Tệp tin | Hành động | Mục đích |
|---|---|---|
| `backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs` | Sửa đổi | Bổ sung metadata hold (`HoldExpiresAtUtc`, `LookupToken`, `DepositRequired`, `IsOnlineHold`) |
| `backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs` | Sửa đổi | Thêm hàm `IsBlockingReservation` bỏ qua các hold đã hết hạn |
| `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs` | Sửa đổi | Dùng `IsBlockingReservation` kiểm tra phòng bị chặn |
| `backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs` | Sửa đổi | Dùng `IsBlockingReservation` khi tính toán phòng trống |
| `backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs` | Sửa đổi | Đăng ký engine tính toán báo giá authoritative |
| `backend/src/HotelSaas.Application/Public/DTOs/*.cs` | Tạo mới | DTOs công khai cho property, room type, availability, quote, hold, booking detail |
| `backend/src/HotelSaas.Application/Public/Helpers/PiiMaskingHelper.cs` | Tạo mới | Helper che mờ email, số điện thoại, tên khách hàng |
| `backend/src/HotelSaas.Application/Public/Queries/*.cs` | Tạo mới | 6 MediatR Queries công khai |
| `backend/src/HotelSaas.Application/Public/Commands/*.cs` | Tạo mới | 2 MediatR Commands công khai (`CreateGuestHold`, `ConfirmGuestBooking`) |
| `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` | Tạo mới | REST API Controller với 8 endpoint công khai |
| `backend/src/HotelSaas.WebApi/Middlewares/TenantPropertyContextMiddleware.cs` | Sửa đổi | Cho phép `/api/public/*` đi qua mà không bắt buộc JWT/Tenant header |
| `backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs` | Tạo mới | 8 bài kiểm thử tích hợp backend cho P5 |
| `frontend/src/app/core/models/public-booking.model.ts` | Tạo mới | TypeScript interfaces cho DTOs công khai |
| `frontend/src/app/core/services/public-booking.service.ts` | Tạo mới | Service Angular tương tác với `/api/public` |
| `frontend/src/app/core/services/public-booking.service.spec.ts` | Tạo mới | 8 unit tests cho PublicBookingService |
| `frontend/src/app/features/public-booking/booking.page.ts` | Tạo mới | Trang công khai tìm phòng, chọn ngày, tính quote, tạo hold |
| `frontend/src/app/features/public-booking/booking-hold.page.ts` | Tạo mới | Trang đếm ngược 15 phút, cảnh báo hết hạn, xác nhận cọc 30% |
| `frontend/src/app/features/public-booking/booking-status.page.ts` | Tạo mới | Trang tra cứu trạng thái đơn theo token, che mờ PII, hiển thị sao kê folio |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | Tạo mới | 7 tests cho các trang public booking |
| `frontend/src/app/app.routes.ts` | Sửa đổi | Đăng ký các route công khai `/booking`, `/booking/hold/:token`, `/booking/lookup`, `/booking/status/:token` |

---

## 5. Cam kết Không Phá vỡ & Vận hành Hợp tác

- **Zero DB Migrations:** Tuyệt đối không thay đổi schema PostgreSQL, dữ liệu hold được lưu trữ tương thích 100% trong JSON snapshot.
- **Cô lập Phạm vi:** Không sửa đổi bất kỳ tệp tin nào thuộc phạm vi quản lý của đồng nghiệp về Quản lý phòng (`Rooms`) hoặc Buồng phòng (`Housekeeping`).
- **Bảo toàn Dịch vụ Nền:** Daemon PostgreSQL (Cổng 5432) và daemon cron điều phối (`task-12898`) được duy trì hoạt động liên tục.

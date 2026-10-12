# Submission: P3-BOOKING-CORE-01 (Round 1)

- **TaskId:** P3-BOOKING-CORE-01
- **Round:** 1
- **SubmissionId:** sub-p3-booking-core-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T11:46:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt Lát cắt Triển khai: Lõi Đặt phòng Nội bộ (Booking Core)

Theo đúng phân công và đặc tả tại `docs/agent-coordination/assignment.md` và `docs/p3a-reservation-change-spec.md`, lát cắt `P3-BOOKING-CORE-01` đã hoàn thành toàn diện cả Backend lẫn Frontend:

### 1.1. Backend Architecture & Business Rules
1. **Kiểm tra Phòng trống (Availability) & Buffer Luân chuyển $\ge 30$ Phút (Decision D07):**
   - Thuật toán kiểm tra xung đột thời gian đối xứng giữa hai khoảng lưu trú $[S_1, E_1)$ và $[S_2, E_2)$ với buffer dọn phòng $B \ge 30$ phút:
     $$\text{Conflict} \iff S_1 < E_2 + B \quad \land \quad S_2 < E_1 + B$$
   - Áp dụng bình đẳng cho cả thuê theo giờ (`Hourly`) và thuê qua đêm (`Overnight`), ngăn chặn triệt để tình trạng nhận khách mới khi phòng chưa kịp dọn.
2. **Khóa chống Đặt trùng Hàng phòng (Row-Level Locking & Concurrency Guard):**
   - Bổ sung `LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken ct)` trong `ApplicationDbContext`:
     `SELECT "Id" FROM "Rooms" WHERE "Id" = {roomId} AND "TenantId" = {tenantId} AND "PropertyId" = {propertyId} FOR UPDATE;`
   - Toàn bộ quy trình tạo đặt phòng chạy trong một Database Transaction cô lập: khóa hàng phòng $\to$ tính quote/revalidate $\to$ kiểm tra overlap thời gian $\to$ sinh mã xác nhận độc nhất `RES-XXXXXX` $\to$ lưu bản ghi $\to$ commit.
   - Khi hai request đồng thời cạnh tranh cùng một phòng trong cùng khoảng thời gian: chính xác một bên thắng (HTTP 201 Created), bên thua nhận ngay HTTP 409 Conflict với error code `ERR_ROOM_UNAVAILABLE`.
3. **Tích hợp Quote Engine Thật & Snapshot Bất biến (Quote Immutability):**
   - Quy trình tạo đặt phòng điều phối trực tiếp tới MediatR Query `CalculateQuoteQuery` (tái sử dụng Quote Engine đã được nghiệm thu ở Phase P2).
   - Toàn bộ chi tiết giá, breakdown từng khoảng/đêm, nguồn giá áp dụng (`StandardNightlyRate`, `HourlyRate`), và chính sách chi nhánh tại thời điểm tạo được snapshot có cấu trúc bất biến vào `Reservation.Notes` (JSON format an toàn).
   - Khi bảng giá phòng (`RoomTypeRates`) hoặc chính sách phụ thu được cập nhật sau này, tổng tiền và bảng phân tích giá của đặt phòng đã xác nhận tuyệt đối không bị thay đổi.
4. **Phân quyền & Cách ly Chi nhánh (Branch Isolation & Authorization):**
   - Phân quyền `RESERVATIONS`: Read (`1`), Create (`2`).
   - Kiểm tra `MembershipLookupStatus.Success`, bắt buộc `TenantId` và `PropertyId` hợp lệ qua token và header `X-Property-Id`. Mọi request thiếu scope hoặc sai chi nhánh đều bị từ chối `fail-closed`.

### 1.2. Frontend UI/UX & Flow Hoàn chỉnh
1. **Giao diện Quản lý Đặt phòng (`/reservations`):**
   - Bảng danh sách đặt phòng với đầy đủ cột: Mã đặt phòng, Khách hàng, Phòng & Loại phòng, Hình thức thuê (Theo giờ / Qua đêm), Thời gian lưu trú, Tổng tiền, Trạng thái (badge màu tương ứng).
   - Bộ lọc đa năng: Ô tìm kiếm tức thì (mã, tên khách, SĐT, số phòng), dropdown lọc theo trạng thái, bộ lọc khoảng ngày (Từ ngày / Đến ngày), nút Làm mới và Xóa bộ lọc.
   - Phân trang server-side (`currentPage`, `pageSize`).
2. **Modal Xem Chi tiết Đặt phòng (Immutable Snapshot Modal):**
   - Hiển thị đầy đủ thông tin đặt phòng, phòng gán, thời gian check-in/out, thông tin liên hệ của khách.
   - Bảng phân rã chi phí chi tiết từ Snapshot bất biến: Ngày lưu trú, Loại giá áp dụng, Nguồn giá, Đơn giá/Thành tiền (VND).
   - Hiển thị chính sách áp dụng tại thời điểm đặt (Giờ check-in/out tiêu chuẩn, Buffer dọn phòng, Giới hạn giờ thuê).
3. **Modal Tạo Đặt phòng Mới (Interactive Booking Creation with Live Quote):**
   - Switch chuyển đổi hình thức thuê: Thuê theo giờ (`Hourly`) vs Thuê qua đêm (`Overnight`).
   - Bộ nhập thời gian chuẩn xác theo ngày giờ Việt Nam (UTC+7).
   - Nút **"Kiểm tra phòng trống & Tính giá"**: Gọi đồng thời Quote Engine thật và Availability API.
   - Hiển thị bảng tóm tắt báo giá trực quan (Tổng tiền, chi tiết từng đêm/giờ, thời hạn báo giá).
   - Danh sách phòng trống khả dụng: Hiển thị trạng thái buồng phòng, tự động chọn phòng đầu tiên hoặc cho phép lễ tân chọn phòng cụ thể. Các phòng đang có xung đột được đánh dấu không khả dụng kèm lý do rõ ràng.
   - Form thông tin khách: Họ tên, Email, Số điện thoại, Số lượng khách, Ghi chú.
   - Xử lý lỗi mượt mà: Bắt lỗi 409 Conflict hiển thị Toast cảnh báo phòng đã có người đặt, chống double-submit khi đang lưu.
4. **Tích hợp Hệ thống Menu & Navigation:**
   - Kích hoạt route `/reservations` trong `frontend/src/app/app.routes.ts` với `permissionGuard` (`RESERVATIONS.Read`).
   - Cập nhật `AdminLayoutComponent`: Đưa mục "Đặt phòng" vào nhóm "Nghiệp vụ hoạt động" khi user có quyền, loại bỏ nút placeholder chờ duyệt.

---

## 2. Bằng chứng Kiểm thử (Test Evidence)

### 2.1. Backend Tests (100% PASS, 237/237 tests)
1. **`HotelSaas.Application.Tests`:** **194/194 PASS** (Exit code: 0)
   - Lệnh: `dotnet test C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests`
   - Bao gồm 7/7 unit tests trong `ReservationBookingCoreTests.cs`:
     - Test buffer luân chuyển $\ge 30$ phút cho thuê theo giờ và qua đêm.
     - Test validator kiểm tra các trường bắt buộc, khoảng thời gian hợp lệ, email, số lượng khách.
     - Test tính bất biến của Snapshot khi parse và serialize.
   - Bao gồm 4/4 integration tests với PostgreSQL thật trong `P3_RealDatabaseBookingAndConcurrencyTests.cs` (DB test cô lập `hotel_saas_p1b01a_test`):
     - `CreateOvernightReservation_WithRealQuote_CreatesSuccessfully_AndSavesSnapshot`
     - `CreateHourlyReservation_WithRealQuote_CreatesSuccessfully_AndSavesSnapshot`
     - `SnapshotImmutability_WhenRatesChangeLater_ReservationBreakdownRemainsUnchanged`
     - `ConcurrentBooking_OnSameRoomSameTime_ResultsInExactlyOneWinner_AndOneConflict409`
2. **`HotelSaas.WebApi.Tests`:** **42/42 PASS** (Exit code: 0)
3. **`HotelSaas.Domain.Tests`:** **1/1 PASS** (Exit code: 0)

### 2.2. Frontend Tests (100% PASS, 99/99 tests)
1. **Vitest Test Suite:** **99/99 PASS** trên toàn bộ 8 test files (Exit code: 0)
   - Lệnh: `npx vitest run`
   - `src/app/features/reservations/reservations.page.spec.ts` (**11/11 tests PASS**):
     - Test 1: Khởi tạo và tải danh sách đặt phòng với phân trang và danh sách loại phòng.
     - Test 2: Tìm kiếm, lọc theo trạng thái, lọc theo ngày và xóa bộ lọc.
     - Test 3: Xử lý chuyển trang và thay đổi pageSize.
     - Test 4: Mở modal xem chi tiết và hiển thị bảng phân tích snapshot bất biến.
     - Test 5: Mở modal tạo mới và khởi tạo reactive form.
     - Test 6: Validate form khi thiếu trường bắt buộc.
     - Test 7: Tính giá quote thật và lấy danh sách phòng trống khả dụng.
     - Test 8: Submit tạo đặt phòng thành công, hiển thị mã xác nhận và làm mới danh sách.
     - Test 9: Xử lý lỗi xung đột 409 `ERR_ROOM_UNAVAILABLE` hiển thị thông báo phù hợp.
     - Test 10: Kiểm tra phân quyền ghi (`canCreate`).
     - Test 11: Chuyển đổi loại hình thuê (Hourly/Overnight) tự động reset quote và danh sách phòng.
2. **Angular Production Build:** **PASS (Exit code: 0)**
   - Lệnh: `npm run build` (`ng build`)
   - Tạo bundle production thành công với lazy chunk `reservations-page` (41.38 kB).

---

## 3. Danh sách Files Triển khai & Cập nhật

### 3.1. Backend
1. [`backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs):
   - Thêm phương thức `LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken ct)`.
2. [`backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs):
   - Triển khai `LockRoomRowAsync` với câu lệnh `SELECT "Id" FROM "Rooms" ... FOR UPDATE`.
3. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs):
   - Model dữ liệu cho snapshot bất biến: breakdown, policies, bufferMinutes, customerNotes.
4. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshotHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshotHelper.cs):
   - Helper serialize/deserialize JSON an toàn cho snapshot lưu trong `Reservation.Notes`.
5. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationDto.cs):
   - DTO danh sách đặt phòng.
6. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationDetailDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationDetailDto.cs):
   - DTO chi tiết đặt phòng kèm snapshot breakdown.
7. [`backend/src/HotelSaas.Application/Reservations/DTOs/RoomAvailabilityDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/RoomAvailabilityDto.cs):
   - DTO trạng thái phòng trống theo khoảng thời gian.
8. [`backend/src/HotelSaas.Application/Reservations/Helpers/ReservationTimeHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Helpers/ReservationTimeHelper.cs):
   - Helper tính toán khung thời gian lưu trú và công thức buffer $\ge 30$m.
9. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs):
   - Command & validator tạo đặt phòng.
10. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs):
    - Handler xử lý transaction nguyên tử, row lock, quote calculation, overlap check, mã xác nhận và snapshot.
11. [`backend/src/HotelSaas.Application/Reservations/Queries/GetReservations/GetReservationsQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetReservations/GetReservationsQuery.cs):
    - Query & Handler lấy danh sách đặt phòng có phân trang và bộ lọc.
12. [`backend/src/HotelSaas.Application/Reservations/Queries/GetReservationById/GetReservationByIdQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetReservationById/GetReservationByIdQuery.cs):
    - Query & Handler lấy chi tiết đặt phòng kèm phân tích giá snapshot.
13. [`backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQuery.cs):
    - Query & Handler kiểm tra tình trạng phòng trống theo thời gian và buffer.
14. [`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs):
    - Controller cung cấp 4 endpoints: `POST /api/reservations`, `GET /api/reservations`, `GET /api/reservations/{id}`, `GET /api/reservations/availability`.
15. [`backend/tests/HotelSaas.Application.Tests/Reservations/ReservationBookingCoreTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/ReservationBookingCoreTests.cs):
    - Unit tests cho buffer, overlap logic, validators, snapshot immutability.
16. [`backend/tests/HotelSaas.Application.Tests/Reservations/P3_RealDatabaseBookingAndConcurrencyTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/P3_RealDatabaseBookingAndConcurrencyTests.cs):
    - Real database integration tests cho booking theo giờ, qua đêm, snapshot immutability, và concurrency 409 conflict.

### 3.2. Frontend
1. [`frontend/src/app/core/models/reservation.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/reservation.model.ts):
   - Enums `RentalType`, `ReservationStatus`, interfaces DTOs và request.
2. [`frontend/src/app/core/services/reservation.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/reservation.service.ts):
   - Service gọi các API reservations, availability và quotes.
3. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
   - Component Quản lý Đặt phòng hoàn chỉnh: Bảng, lọc, phân trang, modal chi tiết snapshot, modal tạo booking với live quote & room picker.
4. [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts):
   - Unit test suite 11 tests cho component.
5. [`frontend/src/app/app.routes.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.routes.ts):
   - Đăng ký route `/reservations` có guard.
6. [`frontend/src/app/layouts/admin-layout/admin-layout.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/layouts/admin-layout/admin-layout.ts):
   - Kích hoạt menu "Đặt phòng" có phân quyền.

---

## 4. Cam kết Ranh giới & Trạng thái Bàn giao

- **Không tác động DB dev/prod/staging:** Toàn bộ test concurrency và integration chạy trên test database riêng biệt (`hotel_saas_p1b01a_test`).
- **Không xâm lấn phân công:** Giữ nguyên phạm vi của Nguyên (Rooms/RoomTypes accessibility) và Tân (Housekeeping UX).
- **Chuyển giao quyền điều khiển:**
  - `status`: `"Submitted"`
  - `writer`: `"none"`
  - `submissionId`: `"sub-p3-booking-core-01-r1-20261010"`
- Sẵn sàng để Codex tiến hành Review Round 1 cho `P3-BOOKING-CORE-01`.

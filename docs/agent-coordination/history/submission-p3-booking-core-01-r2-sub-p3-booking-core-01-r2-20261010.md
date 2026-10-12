# Submission: P3-BOOKING-CORE-01 (Round 2)

- **TaskId:** P3-BOOKING-CORE-01
- **Round:** 2
- **SubmissionId:** sub-p3-booking-core-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T12:15:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Giải trình & Khắc phục Chi tiết 4 Findings (Review Round 1)

### 1.1. Finding 1 (P1): ĐỒNG BỘ MỘT KHOẢNG THỜI GIAN AUTHORITATIVE CHO QUOTE VÀ INVENTORY
- **Vấn đề vòng 1:** `CreateReservationCommandHandler` và `GetRoomAvailabilityQueryHandler` tính quote theo `[StartAtUtc, EndAtUtc)` nhưng lại normalize về `Property.CheckInTime/CheckOutTime` (12:00) cho Overnight, làm lệch khoảng thời gian inventory thực tế khi khách quote early check-in/late check-out. Ngoài ra kiểm tra `!= default` coi `TimeOnly(0, 0)` là chưa cấu hình.
- **Biện pháp khắc phục đã triển khai:**
  1. [`backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs):
     - Loại bỏ kiểm tra `!= default`, cho phép `TimeOnly(0, 0)` là giờ nhận/trả phòng hợp lệ.
     - Hàm `ResolveAuthoritativeInterval` tôn trọng giờ đến sớm / trả muộn đã được chỉ định.
  2. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs):
     - Giữ nguyên một khoảng thời gian authoritative duy nhất `[request.StartAtUtc, request.EndAtUtc)` xuyên suốt: tính quote, kiểm tra xung đột phòng (`HasOverlap`), gán `StartAtUtc`/`EndAtUtc` trên entity `Reservation`, và ghi snapshot bất biến. Tuyệt đối không normalize đè về 12:00 khi khoảng thời gian đã được quote.
  3. [`backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs):
     - Sử dụng trực tiếp `[request.StartAtUtc, request.EndAtUtc)` để kiểm tra khả dụng thực tế của từng phòng, bảo toàn đầy đủ các giờ đến sớm hoặc trả muộn đã báo giá.
  4. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
     - Bổ sung trường `checkInTime` (mặc định '14:00') và `checkOutTime` (mặc định '12:00') vào reactive form và giao diện Overnight, không hardcode 12:00, cho phép nhân viên lễ tân tùy chỉnh giờ đến/đi theo chính sách chi nhánh.

---

### 1.2. Finding 2 (P1): BẢO VỆ CONTEXT & SCHEDULE TRÊN UI SUBSCRIPTIONS
- **Vấn đề vòng 1:** `reservations.page.ts` thiếu subscription cleanup, thiếu context generation tracking; form thay đổi không vô hiệu hóa quote cũ dẫn đến nguy cơ submit sai payload; chuyển đổi chi nhánh (A $\to$ B hoặc null) không hủy request in-flight và không đóng modal.
- **Biện pháp khắc phục đã triển khai:**
  1. **Subscription Cleanup & Teardown:**
     - Khai báo và quản lý tập trung toàn bộ subscriptions: `listSub`, `roomTypesSub`, `detailSub`, `quoteSub`, `availabilitySub`, `submitSub`.
     - `cancelPendingRequests()` tự động hủy bỏ mọi request in-flight khi ngữ cảnh thay đổi.
     - `ngOnDestroy()` gọi `cancelPendingRequests()` và dọn dẹp toàn diện.
  2. **Context Generation Tracking:**
     - Thiết lập các bộ đếm thế hệ request: `listRequestId`, `detailRequestId`, `quoteRequestId`. Bỏ qua mọi response trễ (out-of-order) không khớp với request mới nhất.
  3. **Verified Schedule Key Guard:**
     - Xây dựng cơ chế `verifiedScheduleKey = ${branchId}_${roomTypeId}_${rentalType}_${start}_${end}` gắn chặt báo giá và phòng trống với lịch trình đã kiểm tra.
     - Lắng nghe thay đổi trên toàn bộ form inputs (`checkInDate`, `checkOutDate`, `checkInTime`, `checkOutTime`, `roomTypeId`, `rentalType`, v.v.): khi người dùng thay đổi bất kỳ thông số nào, quote và danh sách phòng tự động reset về rỗng.
     - Guard `canSubmitCreate()` kiểm tra bắt buộc `verifiedScheduleKey === getCurrentScheduleKey()`, ngăn chặn triệt để việc submit khi form đã bị thay đổi sau khi quote.
  4. **Branch Context Switching (A $\to$ B và Null):**
     - `handlePropertyContextChange(newPropertyId)` hủy ngay các request in-flight, xóa sạch dữ liệu branch cũ (`reservations = []`, `totalCount = 0`, `roomTypes = []`, `selectedReservationDetail = null`), đóng modal tạo mới nếu đang mở; chỉ tải dữ liệu mới khi `newPropertyId` hợp lệ.
  5. **Unit Tests Toàn diện (16/16 tests PASS):**
     - [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts) bổ sung 5 Subject tests chuyên sâu:
       - Subject test 1: Danh sách out-of-order response (bỏ qua response cũ đến muộn).
       - Subject test 2: Reset quote và vô hiệu hóa submit khi thay đổi giờ/loại phòng trong lúc quote đang pending.
       - Subject test 3: Bỏ qua detail response đến muộn khi chi nhánh đã chuyển đổi từ A sang B.
       - Subject test 4: Bỏ qua kết quả tạo đặt phòng đến muộn khi chi nhánh đã đổi.
       - Subject test 5: Xử lý context branch null / destroy dọn dẹp sạch sẽ tài nguyên.

---

### 1.3. Finding 3 (P1): IDEMPOTENCY KEY VÀ REPLAY KẾT QUẢ ĐẶT PHÒNG
- **Vấn đề vòng 1:** `CreateReservationCommand` và controller chưa hỗ trợ idempotency key. Khi client retry sau sự cố mạng, request gặp chính booking của mình và bị từ chối với lỗi 409 thay vì replay kết quả đặt phòng trước đó.
- **Biện pháp khắc phục đã triển khai:**
  1. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs):
     - Bổ sung `string? IdempotencyKey = null` vào Command.
  2. [`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs):
     - Tự động trích xuất header `Idempotency-Key` hoặc `X-Idempotency-Key` và gắn vào command nếu body chưa có.
  3. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs):
     - Lưu trữ `IdempotencyKey` trong Snapshot JSON (lưu tại `Reservation.Notes`), đảm bảo không can thiệp schema DB thật.
  4. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs):
     - **Replay cùng payload:** Kiểm tra key trước transaction và re-check dưới row-level lock. Nếu trùng `IdempotencyKey` và cùng thông số đặt phòng (`RoomId`, `RentalType`, `StartAtUtc`, `EndAtUtc`), hoàn trả ngay DTO của đặt phòng trước đó với mã xác nhận ban đầu, không tạo bản ghi mới.
     - **Conflict khác payload:** Nếu trùng `IdempotencyKey` nhưng khác payload (khác phòng, khác giờ, hoặc gian lận), trả về HTTP 409 Conflict với error code `ERR_IDEMPOTENCY_CONFLICT`.
  5. [`frontend/src/app/core/services/reservation.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/reservation.service.ts) & [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
     - Tự động sinh `Idempotency-Key` dạng UUID/timestamp cho mỗi lần submit đặt phòng và truyền qua HTTP header.

---

### 1.4. Finding 4 (P2): BỔ SUNG HTTP PIPELINE INTEGRATION TEST GATE (`BookingHttpPipelineTests.cs`)
- **Vấn đề vòng 1:** Thiếu bài test HTTP pipeline thật qua `WebApplicationFactory` để chứng minh end-to-end routing, middleware, model binding, authorization, branch scoping, và database concurrency trên HTTP.
- **Biện pháp khắc phục đã triển khai:**
  - Tạo mới [`backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs) thuộc Collection `RealDatabaseTests`.
  - Khởi tạo WebApplicationFactory với test database PostgreSQL cô lập `hotel_saas_p1b01a_test`, schema GUID độc lập tự dọn dẹp sau khi chạy.
  - Kiểm thử đầy đủ 12 kịch bản qua HTTP thật:
    1. **POST Hourly (HTTP 201 Created):** Tạo đặt phòng theo giờ thành công, trả về confirmation code dạng `RES-XXXXXX`, tổng tiền và snapshot breakdown hợp lệ.
    2. **POST Overnight (HTTP 201 Created):** Tạo đặt phòng qua đêm thành công với rate breakdown 2 đêm bảo toàn chính xác.
    3. **GET List (HTTP 200 OK):** Truy vấn danh sách đặt phòng phân trang trả về đầy đủ các bản ghi.
    4. **GET Detail (HTTP 200 OK):** Truy vấn chi tiết đặt phòng trả về đầy đủ thông tin khách, số phòng, và bảng phân rã snapshot.
    5. **GET Availability (HTTP 200 OK):** Phòng đã đặt bị đánh dấu không khả dụng (`isAvailable: false`) do trùng lịch + buffer dọn dẹp $\ge 30$ phút; phòng khác khả dụng bình thường.
    6. **403 Forbidden on Missing Permission:** Nhân viên chỉ có quyền `RESERVATIONS.Read` (thiếu `Create`) gọi POST `/api/reservations` bị từ chối chính xác HTTP 403 Forbidden.
    7. **400 Bad Request on Branch Mismatch:** Request body có `propertyId` khác với header `X-Property-Id` bị từ chối chính xác HTTP 400 Bad Request (`ERR_CONTEXT_MISMATCH`).
    8. **403 Forbidden on Cross-Branch Header Tampering:** Header `X-Property-Id` cố tình ghi đè chi nhánh ngoài token scope bị từ chối chính xác HTTP 403 Forbidden (`ERR_PROPERTY_FORBIDDEN`).
    9. **Concurrency Competition (Row-Level Lock & Race Condition):** Hai request HTTP song song cạnh tranh cùng một phòng trong cùng khoảng thời gian $\to$ chính xác 1 winner nhận HTTP 201 Created và 1 conflict nhận HTTP 409 Conflict (`ERR_ROOM_OVERLAP`).
    10. **Idempotency Replay (HTTP 201/200):** Gửi lại request với cùng `Idempotency-Key` và cùng payload $\to$ trả về kết quả cũ với cùng ID và mã xác nhận; DB chỉ ghi nhận chính xác 1 bản ghi duy nhất.
    11. **Idempotency Conflict (HTTP 409):** Gửi request với cùng `Idempotency-Key` nhưng khác payload $\to$ trả về HTTP 409 Conflict (`ERR_IDEMPOTENCY_CONFLICT`).
    12. **Snapshot Immutability:** Cập nhật bảng giá trong cơ sở dữ liệu lên mức giá khác; truy vấn lại booking detail qua HTTP API $\to$ tổng tiền và bảng phân tích giá của booking đã tạo giữ nguyên bất biến.

---

## 2. Bằng chứng Kiểm thử (Independent Test Evidence)

### 2.1. Frontend Vitest Suites (100% PASS, 104/104 tests)
- **Lệnh thực thi:** `npx vitest run` tại thư mục `frontend`
- **Kết quả:** **104 passed (104), 8 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **16/16 tests PASS** (gồm 11 tests cơ bản + 5 tests Subject theo Finding 2)
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**
  - `src/app/app.spec.ts`: **1/1 test PASS**

### 2.2. Backend Test Suites (100% PASS, 238/238 tests)
1. **`HotelSaas.WebApi.Tests`:** **43/43 tests PASS** (Exit Code: 0)
   - Lệnh: `dotnet test backend/tests/HotelSaas.WebApi.Tests`
   - Bao gồm `BookingHttpPipelineTests` (12 bước HTTP pipeline qua WebApplicationFactory với PostgreSQL thật) **PASS 100%**.
2. **`HotelSaas.Application.Tests`:** **194/194 tests PASS** (Exit Code: 0)
   - Lệnh: `dotnet test backend/tests/HotelSaas.Application.Tests`
   - Bao gồm toàn bộ tests Unit & Integration của Booking Core, Policies, Rates, Auth, Context, và Rooms.
3. **`HotelSaas.Domain.Tests`:** **1/1 test PASS** (Exit Code: 0)

### 2.3. Build Verification
- **Backend Solution:** `dotnet build C:\Dev\hotel-saas-v2\backend\HotelSaas.slnx` $\to$ **Build succeeded. 0 Warning(s), 0 Error(s)**.

---

## 3. Danh sách Files Triển khai & Cập nhật trong Round 2

1. [`backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs): Bỏ kiểm tra `!= default` cho phép `TimeOnly(0, 0)` hợp lệ, giữ nguyên authoritative interval.
2. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommand.cs): Bổ sung `IdempotencyKey` và khôi phục `NumberOfGuests`.
3. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs): Thêm trường `IdempotencyKey` vào snapshot bất biến.
4. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs): Giữ nguyên authoritative interval cho quote, overlap, availability, và snapshot; kiểm tra idempotency replay & conflict trước transaction và dưới row-level lock.
5. [`backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Queries/GetRoomAvailability/GetRoomAvailabilityQueryHandler.cs): Đồng bộ authoritative interval khi kiểm tra phòng trống.
6. [`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs): Trích xuất header `Idempotency-Key` / `X-Idempotency-Key`.
7. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandValidator.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandValidator.cs): Bổ sung validation rule cho `IdempotencyKey`.
8. [`frontend/src/app/core/models/reservation.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/reservation.model.ts): Thêm trường `idempotencyKey?: string`.
9. [`frontend/src/app/core/services/reservation.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/reservation.service.ts): Truyền header `Idempotency-Key` khi tạo đặt phòng.
10. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts): Quản lý subscriptions, request generation tracking, `verifiedScheduleKey`, bảo vệ context change (A $\to$ B và null), hỗ trợ `checkInTime`/`checkOutTime`.
11. [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts): Cập nhật 16 tests toàn diện, bổ sung 5 Subject tests mô phỏng out-of-order, pending quote schedule change drop, pending detail branch change drop, pending create branch change drop, branch null / destroy cleanup.
12. [`backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs): Bộ test HTTP pipeline 12 kịch bản tích hợp WebApplicationFactory và PostgreSQL thật.

---

## 4. Cam kết Tuân thủ Quy trình Điều phối
- Không commit/deploy/migrate hoặc tác động cơ sở dữ liệu dev/staging/prod.
- Mọi kiểm thử database thực hiện trên schema GUID cô lập trong test database `hotel_saas_p1b01a_test` và được dọn dẹp sạch sẽ sau test run.
- Không mở rộng phạm vi sang các module downstream (thanh toán, hoàn tiền, lifecycle phòng) trước khi gate Booking Core được nghiệm thu.
- Bàn giao writer lock về `writer: "none"`, chuyển trạng thái `status: "Submitted"`, sẵn sàng cho Codex reviewer tiến hành thẩm định.

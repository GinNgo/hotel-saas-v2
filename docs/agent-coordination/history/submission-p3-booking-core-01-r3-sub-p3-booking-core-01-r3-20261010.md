# Submission: P3-BOOKING-CORE-01 (Round 3)

- **TaskId:** P3-BOOKING-CORE-01
- **Round:** 3
- **SubmissionId:** sub-p3-booking-core-01-r3-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T12:45:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Giải trình & Khắc phục Chi tiết 3 Findings (Review Round 2)

### 1.1. Finding 1 (P1): IDEMPOTENCY ATOMIC SERIALIZATION VÀ PRE-QUOTE REPLAY
- **Vấn đề vòng 2:**
  1. `CreateReservationCommandHandler` chỉ khóa row phòng (`LockRoomRowAsync`), do đó hai request gửi cùng một IdempotencyKey cho 2 phòng khác nhau khóa 2 row khác nhau có thể đồng thời insert vào DB, vi phạm tính duy nhất của idempotency.
  2. So sánh payload cũ chỉ so `room/type/start/end`, bỏ qua `guestName`, `guestEmail`, `guestPhone`, `numberOfGuests`, `customerNotes`, `expectedTotalAmount`, và ngày check-in/out.
  3. `CalculateQuoteQuery` và kiểm tra `ExpectedTotalAmount` chạy **trước** khi replay: nếu bảng giá phòng thay đổi sau khi đặt (ví dụ tăng từ 1.2M lên 2M), request replay của khách sẽ bị lỗi 422 `ERR_QUOTE_MISMATCH` thay vì trả lại snapshot đặt phòng cũ.
- **Biện pháp khắc phục đã hoàn tất:**
  1. **Atomic Key Serialization bằng PostgreSQL Advisory Lock:**
     - Bổ sung `Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default)` vào [`IApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs).
     - Triển khai trong [`ApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs): sử dụng Transaction-Scoped PostgreSQL Advisory Lock `SELECT pg_advisory_xact_lock(hashtext({lockKey}));` với key `idemp_{propertyId:N}_{idempotencyKey.Trim()}`. Khóa này tự động giải phóng khi transaction commit hoặc rollback, serialize tuần tự hóa tuyệt đối mọi request cùng scope + key xuyên suốt các physical rooms mà không cần sửa schema/table database.
  2. **So sánh Toàn diện Full Payload Fingerprint (`IsExactPayloadMatch`):**
     - Xây dựng static helper `IsExactPayloadMatch` trong [`CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs) kiểm tra đối chiếu toàn bộ 11 trường nghiệp vụ:
       - `RoomId`, `RentalType`, `EffectiveStartUtc`, `EffectiveEndUtc`
       - `CheckInDate`, `CheckOutDate`
       - `GuestName`, `GuestEmail`, `GuestPhone`, `NumberOfGuests`
       - `CustomerNotes`, `ExpectedTotalAmount`
     - Nếu trùng khớp 100%: hoàn trả ngay DTO của đặt phòng trước đó kèm snapshot bất biến.
     - Nếu sai lệch bất kỳ trường nào: ném ngay HTTP 409 Conflict với mã lỗi chuẩn `ERR_IDEMPOTENCY_CONFLICT`.
  3. **Đảo Thứ Tự: Pre-Quote Replay Check:**
     - Đưa việc xác định `effectiveStartUtc`, `effectiveEndUtc`, `checkInDate`, `checkOutDate` lên đầu.
     - Thực hiện kiểm tra Idempotency Replay **TRƯỚC** khi fetch room và **TRƯỚC** khi gọi engine tính live quote. Nếu tìm thấy booking cũ cùng key và full payload khớp, trả về ngay lập tức mà không tính quote. Nhờ vậy, ngay cả khi giá phòng hoặc surcharge policy của chi nhánh bị thay đổi sau đó, replay vẫn giữ nguyên 100% snapshot ban đầu mà không bị `ERR_QUOTE_MISMATCH`.
     - Trong transaction: Acquire `_context.LockIdempotencyKeyAsync(...)`, re-check dưới lock, rồi mới khóa room row `LockRoomRowAsync`, check availability, tính quote và insert.
  4. **Kiểm thử Integration Gate (`BookingHttpPipelineTests.cs`):**
     - **STEP 9b:** Thử nghiệm 2 request song song gửi cùng một `idempotencyKey` cho 2 phòng khác nhau (Room 101 và Room 102) $\to$ chính xác 1 winner nhận HTTP 201 Created và 1 request nhận HTTP 409 Conflict với error code `ERR_IDEMPOTENCY_CONFLICT`.
     - **STEP 11b:** Thử nghiệm cùng key nhưng khác thông tin khách (`guestName`) hoặc số lượng khách $\to$ ném HTTP 409 Conflict `ERR_IDEMPOTENCY_CONFLICT`.
     - **STEP 12b:** Thay đổi giá phòng trong DB từ 1.2M lên 9,999,999 VND; replay lại request booking cũ $\to$ trả về thành công HTTP 201 Created với tổng tiền cũ 2,400,000 VND, không hề bị `ERR_QUOTE_MISMATCH`.

---

### 1.2. Finding 2 (P1): CLIENT IDEMPOTENCY KEY LIFECYCLE VÀ RETRY REUSE
- **Vấn đề vòng 2:** `reservations.page.ts` tạo mới key bằng `Date.now() + Math.random()` ngay trong hàm `onSubmitCreate()`. Khi gặp sự cố mạng (timeout, rớt gói tin) và nhân viên bấm nút submit lại, hệ thống sinh ra key mới, khiến backend coi đây là booking mới và từ chối với lỗi 409 `ERR_ROOM_UNAVAILABLE` do trùng phòng với chính booking trước đó.
- **Biện pháp khắc phục đã hoàn tất:**
  1. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
     - Quản lý trạng thái key: `currentSubmissionKey` và `lastSubmittedFingerprint`.
     - Tạo fingerprint logical submission bao gồm các trường của form và quote: `${propId}_${roomId}_${rentalType}_${startAtUtc}_${endAtUtc}_${guestName}_${guestEmail}_${guestPhone}_${numberOfGuests}_${customerNotes}_${quote.totalAmount}`.
     - **Khi Retry (giữ nguyên form):** Giữ nguyên `currentSubmissionKey` đã cấp phát, gửi lại cùng một key lên backend để kích hoạt cơ chế idempotent replay an toàn.
     - **Khi Sửa Form:** Khi người dùng thay đổi bất kỳ thông tin nào trong form hoặc schedule, sinh ra `currentSubmissionKey` mới.
     - **Khi Thành Công hoặc Đóng Modal:** Reset `currentSubmissionKey = null` và `lastSubmittedFingerprint = null` để booking tiếp theo có key độc lập.
  2. **Unit Test Frontend ([`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts)):**
     - **Test 18:** Mô phỏng submit lần 1 thất bại do lỗi mạng 504 Gateway Timeout $\to$ bấm submit lần 2 (retry) giữ nguyên chính xác 100% `idempotencyKey` $\to$ tạo thành công $\to$ mở modal tạo đơn mới sinh ra key khác biệt.

---

### 1.3. Finding 3 (P2): GIỜ CHUẨN CHI NHÁNH ĐƯỢC NẠP TỪ POLICY THAY VÌ HARDCODE 14:00/12:00
- **Vấn đề vòng 2:** `initCreateForm()` và các hàm fallback submit vẫn hardcode giờ mặc định là 14:00 và 12:00, không nạp từ cấu hình `PropertyPoliciesDto` của chi nhánh. Nếu chi nhánh áp dụng khung giờ khác (ví dụ 10:00 - 15:00 hoặc 00:00), hệ thống sẽ tính phụ thu không mong muốn.
- **Biện pháp khắc phục đã hoàn tất:**
  1. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
     - Inject `PolicyService`, thêm state signal `branchPolicies = signal<PropertyPoliciesDto | null>(null)`.
     - Triển khai `loadBranchPolicies(propId)` nạp chính sách chi nhánh theo quyền `PROPERTIES.Read` (action mask 1).
     - Trong `initCreateForm()`: Lấy giờ chuẩn từ `branchPolicies()?.checkInTime` và `checkOutTime`.
     - **Trường hợp chưa có policy:** Khởi tạo rỗng `''` và thiết lập validation bắt buộc `[Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]`.
     - Hàm `canCheckAvailability()` yêu cầu bắt buộc phải có `checkInTime` và `checkOutTime` hợp lệ, loại bỏ hoàn toàn mọi fallback 14:00/12:00.
     - Giao diện template hiển thị rõ badge giờ chuẩn chi nhánh nếu có (`(Chuẩn: 10:00)`), hoặc `(Chọn giờ)` nếu chưa có cấu hình.
  2. **Unit Test Frontend ([`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts)):**
     - **Test 17:** Khởi tạo form với chi nhánh có giờ chuẩn tùy biến (10:00 và 15:00); kiểm tra boundary 00:00:00; kiểm tra khi không có policy thì form để trống và bắt buộc người dùng chọn giờ trước khi tính quote/availability.

---

## 2. Bằng chứng Kiểm thử Độc lập (Independent Test Evidence)

### 2.1. Frontend Vitest Suites (100% PASS, 106/106 tests)
- **Lệnh thực thi:** `npx vitest run` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **106 passed (106), 8 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **18/18 tests PASS** (bổ sung test 17 cho Branch Policy hours và test 18 cho Idempotency key lifecycle)
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**
  - `src/app/app.spec.ts`: **1/1 test PASS**

### 2.2. Backend Test Suites (100% PASS, 238/238 tests)
1. **`HotelSaas.WebApi.Tests`:** **43/43 tests PASS** (Exit Code: 0)
   - Lệnh: `dotnet test backend/tests/HotelSaas.WebApi.Tests --no-build`
   - `BookingHttpPipelineTests`: **100% PASS** với toàn bộ các bước kiểm tra Idempotency Advisory Lock concurrency (9b), Guest mismatch (11b), và Post-rate-change replay (12b).
2. **`HotelSaas.Application.Tests`:** **194/194 tests PASS** (Exit Code: 0)
   - Lệnh: `dotnet test backend/tests/HotelSaas.Application.Tests --no-build`
   - Bao gồm toàn bộ tests `P3_RealDatabaseBookingAndConcurrencyTests` (Turnover buffer, Overlap conflict `ERR_ROOM_UNAVAILABLE`, Concurrent row-lock competition).
3. **`HotelSaas.Domain.Tests`:** **1/1 test PASS** (Exit Code: 0)
   - Lệnh: `dotnet test backend/tests/HotelSaas.Domain.Tests --no-build`

### 2.3. Build Verification
- **Backend Solution:** `dotnet build C:\Dev\hotel-saas-v2\backend\HotelSaas.slnx` $\to$ **Build succeeded. 0 Warning(s), 0 Error(s)**.

---

## 3. Danh sách Files Cập nhật trong Round 3

1. [`backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs): Khai báo phương thức `LockIdempotencyKeyAsync`.
2. [`backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs): Triển khai `LockIdempotencyKeyAsync` dùng PostgreSQL `pg_advisory_xact_lock(hashtext(...))`.
3. [`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs): Đảo pre-quote idempotency replay lên trước live quote; so sánh full fingerprint với `IsExactPayloadMatch`; tích hợp advisory lock dưới transaction; ném `ERR_ROOM_UNAVAILABLE` cho overlap.
4. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts): Nạp `PropertyPoliciesDto` cho giờ nhận/trả phòng chuẩn; loại bỏ fallback 14:00/12:00; quản lý lifecycle và reuse `currentSubmissionKey`.
5. [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts): Cập nhật provider `PolicyService`, thêm test 17 (Custom branch policy hours) và test 18 (Client retry key reuse và form edit key regeneration).
6. [`backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/BookingHttpPipelineTests.cs): Bổ sung STEP 9b (Concurrent same-key different-rooms advisory lock race), STEP 11b (Guest payload mismatch conflict), STEP 12b (Replay after DB rate change).

---

## 4. Cam kết Tuân thủ Quy trình Điều phối
- Không commit/deploy/migrate hoặc tác động cơ sở dữ liệu dev/staging/prod.
- Mọi kiểm thử database thực hiện trên schema GUID cô lập trong test database `hotel_saas_p1b01a_test` và được dọn dẹp sạch sẽ sau test run.
- Không tự mở rộng scope sang Payments/Refunds trước khi Booking Core được nghiệm thu.
- Bàn giao writer lock về `writer: "none"`, chuyển trạng thái `status: "Submitted"`, sẵn sàng cho Codex reviewer tiến hành thẩm định Round 3.

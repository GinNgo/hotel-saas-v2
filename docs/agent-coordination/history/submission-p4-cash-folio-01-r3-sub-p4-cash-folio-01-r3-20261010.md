# Submission: P4-CASH-FOLIO-01 (Round 3)

- **TaskId:** P4-CASH-FOLIO-01
- **Round:** 3
- **SubmissionId:** sub-p4-cash-folio-01-r3-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T15:15:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Lát cắt & Xử lý Yêu cầu Đánh giá Vòng 2 (Review Findings Resolution)

Trong Vòng 3, toàn bộ 2 phát hiện mức độ cao (High Findings) từ Codex trong `docs/agent-coordination/review.md` đã được xử lý triệt để, có kiểm thử đơn vị, kiểm thử đồng thời (concurrency), và kiểm thử tích hợp xác thực:

### 1.1. Finding 1 (HIGH — IdempotencyKey Grammar Regex Validation, Structured Marker Prefix Replay, Reference Mismatch & Actor Audit)
- **Kiểm định Cú pháp IdempotencyKey nghiêm ngặt (Fail-Fast Grammar Validation):**
  - Trước khi xin khóa DB hay truy vấn transaction, `CreatePaymentCommandHandler` kiểm tra `request.IdempotencyKey`: độ dài từ 8 đến 128 ký tự, tuân thủ regex `^[a-zA-Z0-9_\-]+$`.
  - Nghiêm cấm hoàn toàn các ký tự phân tách `[`, `]`, `:`, khoảng trắng và ký tự điều khiển. Mọi khóa không hợp lệ đều bị từ chối ngay lập tức với `BadRequestException("ERR_INVALID_IDEMPOTENCY_KEY", ...)` (HTTP 400 Bad Request).
- **Khớp Tiền tố Cấu trúc Chính xác (Exact Structured Prefix Replay):**
  - Thay thế tìm kiếm chứa chuỗi lỏng lẻo bằng so khớp tiền tố chính xác: `p.TransactionRef.StartsWith($"[IK:{normalizedKey}][BY:")`.
  - Biện pháp này triệt tiêu triệt để nguy cơ giả mạo marker (marker injection) và ngăn chặn va chạm giữa các khóa hợp lệ có chung tiền tố (ví dụ: `key_prefix_10` vs `key_prefix_100`).
- **Phát hiện Bất đồng bộ Reference khi Replay (Payload Mismatch on Business Reference):**
  - Thêm helper trích xuất ghi chú nghiệp vụ `ExtractUserRef(existingReplay.TransactionRef)`.
  - So sánh đối chiếu `storedUserRef != safeUserRef`. Nếu cùng `IdempotencyKey` nhưng gửi reference khác nhau, ném `ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", ...)` (HTTP 409 Conflict).
- **Đóng dấu Actor Audit có thẩm quyền:**
  - Lấy `userId` tin cậy từ `_userContext.UserId` (JWT Claims) và đóng dấu vào `[IK:...][BY:{userId}]`.
  - Đã bổ sung assertion kiểm tra định dạng `[BY:{CashierUserId}]` trong integration test.

### 1.2. Finding 2 (HIGH — Enforce POL-IO03 Settle Balance Before Checkout)
- **Kiểm soát Dư nợ Dưới Khóa Phòng khi Trả phòng (`CheckOutReservationCommandHandler`):**
  - Dưới khóa dòng phòng độc quyền `LockRoomRowAsync(resHeader.RoomId)` và trong transaction, handler truy vấn tổng số tiền đã thanh toán `PaymentStatus.Completed` của đơn.
  - Tính toán `remainingBalance = reservation.TotalAmount - paidAmount`.
  - Nếu `remainingBalance > 0m`, transaction được rollback ngay lập tức và ném `ConflictException("ERR_OUTSTANDING_BALANCE", $"Đơn đặt phòng còn dư nợ chưa thanh toán ({remainingBalance:N0} đ). Vui lòng thu đủ thanh toán trước khi trả phòng.")`.
- **Đồng bộ Giao diện Khách hàng & Lễ tân (`reservations.page.ts` & Template):**
  - Khi `folio()?.remainingBalance > 0`, nút "Trả phòng" trên modal chi tiết đặt phòng bị disable kèm nhãn cảnh báo đỏ giải thích lý do cần thanh toán đủ dư nợ trước khi trả phòng.
  - Ẩn form thu tiền đối với các đơn đã ở trạng thái `CheckedOut` (`detail.status !== ReservationStatus.CheckedOut`).
  - Hàm `onCheckOut` được bọc guard kiểm tra dư nợ, hiển thị thông báo lỗi rõ ràng nếu còn tiền chưa thanh toán.
- **Cập nhật Toàn bộ Test Suite:**
  - `P3_StayLifecycleFsmTests.cs` & `StayLifecycleHttpPipelineTests.cs`: Bổ sung kịch bản kiểm tra trả phòng khi chưa trả tiền bị từ chối 409 Conflict (`ERR_OUTSTANDING_BALANCE`), sau đó nạp thanh toán đầy đủ và xác thực trả phòng thành công chuyển phòng sang `Dirty`.
  - `P4_CashFolioTests.cs`: Bổ sung 3 test chuyên sâu cho POL-IO03 gồm test từ chối khi dư nợ, test trả phòng thành công khi thanh toán đủ, và test đồng thời giữa thanh toán nốt công nợ và trả phòng dưới khóa phòng.
- **Chuẩn hóa TypeScript Model & Template Compilation:**
  - Sửa các trường `PaymentSummaryDto` trên template (`completedCount`, `cashCollected`, `bankTransferCollected`).
  - Chuẩn hóa payload `CreatePaymentRequest`, biên dịch production `npm run build` thành công 100% không cảnh báo/lỗi type.

---

## 2. Chi tiết File Cập nhật (Updated Files)

1. **[`CreatePaymentCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs):**
   - Regex validation `^[a-zA-Z0-9_\-]+$` (8-128 chars) ném `ERR_INVALID_IDEMPOTENCY_KEY`.
   - Tìm kiếm replay chính xác với `StartsWith($"[IK:{normalizedKey}][BY:")`.
   - Thêm hàm `ExtractUserRef` và so khớp `storedUserRef != safeUserRef` ném `ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`.

2. **[`CheckOutReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs):**
   - Ràng buộc POL-IO03 dưới khóa phòng: tính `remainingBalance`, ném `ERR_OUTSTANDING_BALANCE` nếu `> 0m`.

3. **[`P4_CashFolioTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs):**
   - `CreatePayment_InvalidIdempotencyKey_DelimitersOrInvalidLength_ThrowsBadRequestException`: PASS.
   - `CreatePayment_LegitimatePrefixKeys_AreNotConsideredReplay`: PASS.
   - Bổ sung case 4 kiểm thử mismatch TransactionRef trong `CreatePayment_SameKey_DifferentPayload_ThrowsConflictException_PayloadMismatch`: PASS.
   - Bổ sung assertion `[BY:{fixture.CashierUserId}]` trong `CreatePayment_ManualCash_RecordsPayment_AndTransitionsReservationToConfirmed`: PASS.
   - `CheckOut_WhenOutstandingBalance_ThrowsConflictException_ERR_OUTSTANDING_BALANCE`: PASS.
   - `CheckOut_WhenFullyPaid_TransitionsToCheckedOut`: PASS.
   - `Concurrency_FinalPaymentAndCheckOut_SerializedUnderRoomLock_ConsistentOutcome`: PASS.

4. **[`P3_StayLifecycleFsmTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs):**
   - Cập nhật fixture seed thanh toán đủ cho các đơn `CheckedIn`/`CheckedOut` để đáp ứng POL-IO03.

5. **[`StayLifecycleHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs):**
   - Bổ sung Step 5a kiểm thử check-out khi chưa thanh toán bị 409 Conflict (`ERR_OUTSTANDING_BALANCE`), seed thanh toán và xác nhận Step 5b check-out 200 OK.
   - Seed thanh toán cho `resPerm1Id` trong Step 9c trước khi staff check-out.

6. **[`reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):**
   - Cập nhật template: kiểm tra `folio()?.remainingBalance > 0` để disable nút trả phòng kèm tooltip cảnh báo.
   - Ẩn form thanh toán khi đặt phòng đã `CheckedOut`.
   - Bọc guard trong `onCheckOut`.
   - Sửa property binding `completedCount`, `cashCollected`, `bankTransferCollected`.
   - Bỏ `propertyId` khỏi `CreatePaymentDtoRequest`.

7. **[`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts):**
   - Cập nhật mock `PaymentSummaryDto` và payload assertion trong test 27 và test 29.

---

## 3. Bằng chứng Kiểm thử Độc lập (Independent Test Evidence)

### 3.1. Frontend Vitest Suites (100% PASS, 130/130 tests)
- **Lệnh thực thi:** `npx vitest run` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **130 passed (130), 9 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **38/38 tests PASS**
  - `src/app/core/services/payment.service.spec.ts`: **4/4 tests PASS**
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**
  - `src/app/app.spec.ts`: **1/1 test PASS**

### 3.2. Frontend Production Build (100% PASS)
- **Lệnh thực thi:** `npm run build` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **Application bundle generation complete! Exit Code: 0 (0 errors)**

### 3.3. Backend Integration & Concurrency Tests P4 (100% PASS, 17/17 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P4"`
- **Kết quả:** **17 passed (17), 0 failed, 0 skipped, Duration: 24 s, Exit Code: 0**
  - `CreatePayment_ManualCash_RecordsPayment_AndTransitionsReservationToConfirmed`: PASS (actor assertion verified)
  - `CreatePayment_FullPayment_SetsIsFullyPaidTrue_AndZeroBalance`: PASS
  - `CreatePayment_IdempotencyReplay_ReturnsExistingPaymentWithoutDuplicate`: PASS
  - `CreatePayment_SameKey_DifferentPayload_ThrowsConflictException_PayloadMismatch`: PASS (4 mismatch cases verified)
  - `CreatePayment_ExceedingRemainingBalance_ThrowsBadRequestException`: PASS
  - `CreatePayment_OnAlreadyFullyPaidFolio_ThrowsConflictException`: PASS
  - `CreatePayment_OnCancelledReservation_ThrowsConflictException`: PASS
  - `CreatePayment_InvalidAmountsAndMethods_ThrowsBadRequestException`: PASS
  - `CreatePayment_ConcurrentPayments_SerializeUnderRowLock_WithoutOvercharging`: PASS
  - `Concurrency_PaymentAndCancel_OnPendingPayment_SerializedUnderRoomLock_NeverRevivesCancelled`: PASS
  - `GetPaymentsAndSummary_CalculatesAggregatesCorrectly`: PASS
  - `CreatePayment_InvalidIdempotencyKey_DelimitersOrInvalidLength_ThrowsBadRequestException`: PASS
  - `CreatePayment_LegitimatePrefixKeys_AreNotConsideredReplay`: PASS
  - `CheckOut_WhenOutstandingBalance_ThrowsConflictException_ERR_OUTSTANDING_BALANCE`: PASS
  - `CheckOut_WhenFullyPaid_TransitionsToCheckedOut`: PASS
  - `Concurrency_FinalPaymentAndCheckOut_SerializedUnderRoomLock_ConsistentOutcome`: PASS
  - `(Seed/Setup fixture tests)`: PASS

### 3.4. Reservation & Payment Full Application Tests (100% PASS, 44/44 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Reservation|FullyQualifiedName~Payment"`
- **Kết quả:** **44 passed (44), 0 failed, 0 skipped, Duration: 47 s, Exit Code: 0**

### 3.5. Backend Full Application Test Suite (100% PASS, 222/222 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj`
- **Kết quả:** **222 passed (222), 0 failed, 0 skipped, Duration: 3 m 11 s, Exit Code: 0**

### 3.6. Backend WebApi Pipeline Tests (100% PASS, 45/45 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj`
- **Kết quả:** **45 passed (45), 0 failed, 0 skipped, Duration: 28 s, Exit Code: 0**

---

## 4. Cam kết Kỹ thuật & Ranh giới Phạm vi (Scope Boundaries & Commitments)

- **Không migration, không DML:** Tuân thủ 100% schema bảng `payments` hiện có trong database, bảo toàn cấu trúc hệ thống.
- **Không gateway tự động (No Automated Gateways):** Không tích hợp VNPay hay Stripe trực tiếp; toàn bộ thanh toán là thu tiền mặt/chuyển khoản đối soát thủ công tại quầy.
- **NeedsPO Items:** Hoàn tiền (Refunds), hủy cọc (Deposit forfeiture), và khấu trừ/điều chỉnh thủ công (Manual folio adjustments) được bảo lưu chờ quyết định PO.
- **Bảo toàn module đồng đội:** Không can thiệp vào các tệp thuộc phạm vi của Nguyên (Rooms) và Tân (Housekeeping).
- **Hệ thống điều phối:** Giữ nguyên standing coordination cron daemon (`task-12898`) phục vụ tự động hóa chu trình tiếp theo.

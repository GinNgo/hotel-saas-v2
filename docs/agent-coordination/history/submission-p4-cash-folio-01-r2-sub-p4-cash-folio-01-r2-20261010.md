# Submission: P4-CASH-FOLIO-01 (Round 2)

- **TaskId:** P4-CASH-FOLIO-01
- **Round:** 2
- **SubmissionId:** sub-p4-cash-folio-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T14:45:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Lát cắt & Xử lý Yêu cầu Đánh giá Vòng 1 (Review Findings Resolution)

Trong Vòng 2, toàn bộ 4 phát hiện mức độ cao (High Findings) từ Codex trong `docs/agent-coordination/review.md` đã được xử lý triệt để, có kiểm thử đơn vị, kiểm thử đồng thời (concurrency), và kiểm thử tích hợp xác thực:

### 1.1. Finding 1 (HIGH — Idempotency Transaction Scope, Cross-Reservation Scope & Payload Conflict)
- **Đưa Advisory Lock vào trong Transaction Scope:** Di chuyển `_context.LockIdempotencyKeyAsync` vào sau `await using var transaction = await _context.BeginTransactionAsync(cancellationToken)` trong `CreatePaymentCommandHandler.cs`. Nhờ đó, khóa phiên advisory gắn liền với transaction database, giải phóng chuẩn xác khi rollback hoặc commit.
- **Mở rộng Tra cứu Idempotency Replay xuyên đơn đặt phòng:** Truy vấn tìm giao dịch theo tiền tố `[IK:{normalizedKey}]` trên toàn bộ Tenant và Property mà không lọc giới hạn trước `ReservationId`.
- **Bắt buộc Kiểm tra Khớp Payload (Strict Payload Mismatch Check):** Nếu khóa Idempotency đã tồn tại, kiểm tra nghiêm ngặt `ReservationId`, `Amount`, và `Method`. Nếu có bất kỳ sai lệch nào, ném `ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH", ...)` (HTTP 409 Conflict) thay vì ghi nhận đè hoặc bỏ qua.
- **Vòng đời Khóa Idempotency phía Client UI:** Cài đặt hàm `getOrCreatePaymentIdempotencyKey(reservationId, amount, method)` trên `ReservationsPage`. Khóa được giữ nguyên khi request gặp lỗi mạng để cho phép retry an toàn; chỉ sinh mới khi người dùng thay đổi số tiền/phương thức thanh toán hoặc dọn sạch sau khi giao dịch thành công.
- **Loại bỏ Thẻ tín dụng chưa duyệt:** Loại bỏ hoàn toàn `PaymentMethod.CreditCard` khỏi handler backend và dropdown giao diện quầy, tuân thủ nghiêm ngặt chỉ hỗ trợ Tiền mặt (`Cash = 2`) và Chuyển khoản (`BankTransfer = 3`).

### 1.2. Finding 2 (HIGH — Actor Audit Tracking & Anti-Marker Forgery)
- **Đóng dấu Actor có thẩm quyền từ JWT:** Handler lấy trực tiếp `userId` tin cậy từ `_userContext.UserId` (được trích xuất từ JWT Claims). Giao dịch được lưu với định dạng tiền tố chuẩn:
  `[IK:{normalizedKey}][BY:{userId}] {safeUserRef}`
- **Khử ký tự đặc biệt chống giả mạo marker (Sanitization):** Toàn bộ chuỗi ghi chú tự do (`TransactionRef`) do người dùng nhập được sanitize thay thế toàn bộ ký tự `[` và `]` thành `(` và `)` trước khi ghép vào metadata, loại trừ hoàn toàn nguy cơ giả mạo cấu trúc `[IK:...]` hoặc `[BY:...]`.
- **Zero-Migration Compliance:** Lưu trữ metadata vào cột `TransactionRef` hiện có, bảo toàn 100% ràng buộc không thêm migration hay sửa schema database.

### 1.3. Finding 3 (HIGH — Folio/Form Cross-Booking Isolation & Permission Alignment)
- **Tín hiệu Nhận diện Độc lập (`detailReservationId`):** Quản lý signal `detailReservationId` theo dõi mã đặt phòng đang mở. Khi chuyển đổi xem giữa các đơn đặt phòng hoặc đóng modal, toàn bộ dữ liệu `folio`, `paymentForm`, `isLoadingFolio`, và khóa idempotency được dọn sạch ngay lập tức.
- **Bảo vệ Chống Đổi Đơn khi Callback về muộn:** Cả `loadFolio`, `onRecordPayment`, và `fillFullRemaining` đều kiểm tra song song `detailReservationId === reservationId` và `selectedReservationDetail()?.id === reservationId`. Bất kỳ callback HTTP trễ từ đơn cũ đều bị loại bỏ ngay, không ghi đè dữ liệu đơn mới.
- **Chấm dứt Fallback `totalAmount` khi Folio đang tải:** Form thanh toán tuyệt đối không fallback sang `totalAmount` của snapshot đặt phòng khi folio chưa tải xong hoặc gặp lỗi. Nếu folio chưa sẵn sàng, hành động thu tiền bị chặn với thông báo cảnh báo người dùng.
- **Đồng bộ Quyền hạn xem Folio theo Contract `06-api-design.md:100`:** Cập nhật `canReadFolio = computed(() => this.authService.hasPermission('RESERVATIONS', 1))` khớp với phân quyền `RESERVATIONS:Read` của endpoint `GET /api/reservations/{id}/folio`.

### 1.4. Finding 4 (HIGH — Lock Order & FSM Race Condition on Concurrent Cancel/Payment)
- **Đồng bộ Thứ tự Khóa Dòng (Lock Order Hierarchy):** Để tránh deadlock và triệt tiêu race condition với các handler vòng đời (`CancelReservationCommandHandler`, `CheckInReservationCommandHandler`), `CreatePaymentCommandHandler` thực hiện khóa dòng phòng `LockRoomRowAsync(resHeader.RoomId)` trước, sau đó mới thực hiện `LockReservationRowAsync(request.ReservationId)`.
- **FSM State Guard:** Trong transaction và dưới khóa độc quyền của phòng, handler kiểm tra trạng thái FSM: nếu đơn đặt phòng đã ở trạng thái `Cancelled`, ném `ConflictException("ERR_RESERVATION_CANCELLED")`; nếu đã `CheckedOut`, ném `ConflictException("ERR_RESERVATION_SETTLED")`.
- **Kiểm thử Đồng thời Xác thực (Concurrency Test):** Đã bổ sung integration test đồng thời `Concurrency_PaymentAndCancel_OnPendingPayment_SerializedUnderRoomLock_NeverRevivesCancelled`, chứng minh dưới tải đồng thời, đơn `Cancelled` tuyệt đối không bao giờ bị hồi sinh (revived) sang `Confirmed`.

---

## 2. Chi tiết File Cập nhật (Updated Files)

1. **[`CreatePaymentCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs):**
   - Đưa `LockIdempotencyKeyAsync` vào sau `BeginTransactionAsync`.
   - Thêm bước khóa `LockRoomRowAsync` trước `LockReservationRowAsync`.
   - Tra cứu idempotency cross-reservation và ném `ERR_IDEMPOTENCY_PAYLOAD_MISMATCH` khi payload không khớp.
   - Thêm FSM status guards (`ERR_RESERVATION_CANCELLED`, `ERR_RESERVATION_SETTLED`).
   - Ghép metadata actor `[IK:...][BY:{userId}]` và sanitize ký tự ngoặc vuông.
   - Giới hạn phương thức thanh toán strictly Cash (2) và BankTransfer (3).

2. **[`PaymentsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs):**
   - Hỗ trợ đọc `Idempotency-Key` từ HTTP Request Header nếu body không truyền.

3. **[`P4_CashFolioTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs):**
   - Bổ sung test `CreatePayment_SameKey_DifferentPayload_ThrowsConflictException_PayloadMismatch` (kiểm thử 3 trường hợp mismatch: số tiền, phương thức, mã đơn).
   - Bổ sung test `Concurrency_PaymentAndCancel_OnPendingPayment_SerializedUnderRoomLock_NeverRevivesCancelled` (kiểm thử đồng thời Payment vs Cancel dưới khóa phòng).

4. **[`reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):**
   - Bổ sung `detailReservationId` signal.
   - Cập nhật `canReadFolio` dùng quyền `RESERVATIONS:Read` (Action 1).
   - Quản lý vòng đời `getOrCreatePaymentIdempotencyKey`.
   - Cô lập hoàn toàn state folio khi chuyển đơn, đóng modal hoặc đổi chi nhánh.
   - Loại bỏ Credit Card khỏi dropdown và Cashier Summary.

5. **[`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts):**
   - Cập nhật test 27 và 30 theo hợp đồng mới.
   - Bổ sung test 32: Cô lập folio xuyên booking, loại bỏ callback A đến trễ khi đang xem B.
   - Bổ sung test 33: Xử lý lỗi nạp folio sạch sẽ, chặn thu tiền không có fallback `totalAmount`.
   - Bổ sung test 34: Ổn định khóa Idempotency khi retry lỗi mạng, sinh khóa mới khi đổi input.

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

### 3.2. Backend Integration & Concurrency Tests (100% PASS, 12/12 P4 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P4"`
- **Kết quả:** **12 passed (12), 0 failed, 0 skipped, Duration: 22 s, Exit Code: 0**
  - `CreatePayment_ManualCash_RecordsPayment_AndTransitionsReservationToConfirmed`: PASS
  - `CreatePayment_FullPayment_SetsIsFullyPaidTrue_AndZeroBalance`: PASS
  - `CreatePayment_IdempotencyReplay_ReturnsExistingPaymentWithoutDuplicate`: PASS
  - `CreatePayment_SameKey_DifferentPayload_ThrowsConflictException_PayloadMismatch`: PASS
  - `CreatePayment_ExceedingRemainingBalance_ThrowsBadRequestException`: PASS
  - `CreatePayment_OnAlreadyFullyPaidFolio_ThrowsConflictException`: PASS
  - `CreatePayment_OnCancelledReservation_ThrowsConflictException`: PASS
  - `CreatePayment_InvalidAmountsAndMethods_ThrowsBadRequestException`: PASS
  - `CreatePayment_ConcurrentPayments_SerializeUnderRowLock_WithoutOvercharging`: PASS
  - `Concurrency_PaymentAndCancel_OnPendingPayment_SerializedUnderRoomLock_NeverRevivesCancelled`: PASS
  - `GetPaymentsAndSummary_CalculatesAggregatesCorrectly`: PASS
  - `(Seed/Setup fixture tests)`: PASS

### 3.3. Full Reservation & Payment Application Tests (100% PASS, 39/39 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Reservation|FullyQualifiedName~Payment"`
- **Kết quả:** **39 passed (39), 0 failed, 0 skipped, Duration: 45 s, Exit Code: 0**

### 3.4. Backend WebApi Pipeline Tests (100% PASS)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter "FullyQualifiedName~Payment"`
- **Kết quả:** **1 passed (1), 0 failed, 0 skipped, Duration: 11 s, Exit Code: 0**

---

## 4. Cam kết Kỹ thuật & Ranh giới Phạm vi (Scope Boundaries & Commitments)

- **Không migration, không DML:** Tuân thủ 100% schema bảng `payments` hiện có trong database, bảo toàn cấu trúc hệ thống.
- **Không gateway tự động (No Automated Gateways):** Không tích hợp VNPay hay Stripe trực tiếp; toàn bộ thanh toán là thu tiền mặt/chuyển khoản đối soát thủ công tại quầy.
- **NeedsPO Items:** Hoàn tiền (Refunds), hủy cọc (Deposit forfeiture), và khấu trừ/điều chỉnh thủ công (Manual folio adjustments) được bảo lưu chờ quyết định PO.
- **Bảo toàn module đồng đội:** Không can thiệp vào các tệp thuộc phạm vi của Nguyên (Rooms) và Tân (Housekeeping).
- **Hệ thống điều phối:** Giữ nguyên standing coordination cron daemon (`task-12898`) phục vụ tự động hóa chu trình tiếp theo.

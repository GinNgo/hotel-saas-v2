# Submission: P5-GUEST-BOOKING-01 (Round 3)

- **TaskId:** P5-GUEST-BOOKING-01
- **Round:** 3
- **SubmissionId:** sub-p5-guest-booking-01-r3-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T16:58:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Khắc phục Triệt để Theo Yêu cầu Đánh giá (Review Round 2 -> Round 3)

Tại Round 2, Reviewer (Codex) đã đưa ra kết luận `ChangesRequested` với 3 Findings chi tiết trong `docs/agent-coordination/review.md`. Antigravity đã nhận lock `InProgress`, phân tích sâu sắc các phát hiện và triển khai giải pháp triệt để 100% cho cả 3 Findings:

### 1.1. Finding 1 (CRITICAL — Invariant Online Hold trên Mọi Writers: Payment & Check-in)
- **Vấn đề Round 2:** 
  - `CreatePaymentCommandHandler.cs:283–286` tự động chuyển mọi `PendingPayment` -> `Confirmed` cho bất kỳ khoản tiền nào $> 0$ mà không đọc `IsOnlineHold`, `HoldExpiresAtUtc`, hay `DepositRequired`. Kẻ gian hoặc nhân viên có thể bypass quy tắc cọc 30% bằng cách gọi `POST /api/payments` với số tiền 1 đồng; hoặc đơn hold đã hết hạn (và phòng đã bán cho khách khác) vẫn có thể bị hồi sinh thành `Confirmed` gây overlap phòng nghiêm trọng.
  - `CheckInReservationCommandHandler.cs:160` cũng cho phép `PendingPayment` -> `CheckedIn` mà không kiểm tra trạng thái online hold, mức cọc hay hạn giữ chỗ.
- **Giải pháp Round 3:**
  - **Dưới cùng cơ chế khóa hàng phòng (`LockRoomRowAsync`), phân định rõ ràng giữa Online Hold và Đơn đặt phòng nội bộ:**
  - Trong [`CreatePaymentCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs):
    - Đọc `ReservationSnapshot` từ ghi chú đặt phòng.
    - Nếu `snap?.IsOnlineHold == true`:
      1. **Kiểm tra hạn giữ chỗ:** Nếu `snap.HoldExpiresAtUtc.HasValue && snap.HoldExpiresAtUtc.Value <= DateTime.UtcNow`, lập tức rollback transaction và ném `ConflictException("ERR_HOLD_EXPIRED")` ("Giữ chỗ trực tuyến đã hết hạn, không thể thu tiền hoặc xác nhận").
      2. **Kiểm tra cọc tối thiểu:** Nếu đơn đang ở trạng thái `PendingPayment`, tính tổng tiền đã thu cộng khoản thu mới `existingPaid + request.Amount`. Nếu nhỏ hơn `depositRequired` (mức cọc 30%), lập tức rollback và ném `BadRequestException("ERR_INSUFFICIENT_DEPOSIT")` ("Số tiền thanh toán không đủ mức cọc tối thiểu cho đơn giữ chỗ trực tuyến").
    - Đối với đơn đặt phòng nội bộ thông thường (`IsOnlineHold != true`), giữ nguyên các quy tắc thanh toán linh hoạt hiện có, không làm thay đổi luồng nghiệp vụ nội bộ ngoài scope.
  - Trong [`CheckInReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs):
    - Đọc `ReservationSnapshot` từ ghi chú đặt phòng.
    - Nếu `snap?.IsOnlineHold == true`:
      1. **Kiểm tra hạn giữ chỗ:** Nếu `snap.HoldExpiresAtUtc.HasValue && snap.HoldExpiresAtUtc.Value <= DateTime.UtcNow`, lập tức rollback và ném `ConflictException("ERR_HOLD_EXPIRED")`.
      2. **Chặn nhận phòng khi chưa xác nhận cọc:** Nếu `reservation.Status != ReservationStatus.Confirmed`, lập tức rollback và ném `ConflictException("ERR_HOLD_NOT_CONFIRMED")` ("Đơn giữ chỗ trực tuyến chưa được xác nhận cọc, không thể làm thủ tục nhận phòng").
    - Đơn đặt phòng nội bộ giữ nguyên quy tắc FSM hiện hành.

### 1.2. Finding 2 (HIGH — Dual Permission trên Endpoint Xác nhận: RESERVATIONS.Update VÀ PAYMENTS.Create)
- **Vấn đề Round 2:**
  - Endpoint xác nhận cọc tạo bản ghi tài chính `Payment.Completed`. Theo quy định kiến trúc `docs/sdd/06-api-design.md:110` và quyết định D08, tác vụ đột biến tài chính bắt buộc phải có quyền `PAYMENTS.Create`. Ở Round 2, endpoint chỉ yêu cầu `RESERVATIONS.Update`, vô tình mở rộng quyền hạn tài chính cho nhân viên chỉ có quyền quản lý đơn đặt phòng.
- **Giải pháp Round 3:**
  - Áp dụng kiểm tra phân quyền kép (Dual Permission):
    - [`PublicController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PublicController.cs):
      ```csharp
      [HttpPost("bookings/{lookupToken}/confirm")]
      [Authorize]
      [RequirePermission("RESERVATIONS", PermissionAction.Update)]
      [RequirePermission("PAYMENTS", PermissionAction.Create)]
      public async Task<ActionResult<ApiResponse<ReservationDetailDto>>> ConfirmGuestBooking(...)
      ```
    - [`ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs):
      ```csharp
      [HttpPost("{id:guid}/confirm")]
      [RequirePermission("RESERVATIONS", PermissionAction.Update)]
      [RequirePermission("PAYMENTS", PermissionAction.Create)]
      public async Task<ActionResult<ApiResponse<ReservationDetailDto>>> ConfirmReservation(...)
      ```
  - Kiểm chứng ma trận phân quyền trong test HTTP pipeline thực tế:
    - Nhân viên chỉ có quyền `RESERVATIONS.Update` (ActionMask 4 trên RESERVATIONS, không có PAYMENTS) -> **403 Forbidden**.
    - Nhân viên chỉ có quyền `PAYMENTS.Create` (ActionMask 2 trên PAYMENTS, không có RESERVATIONS) -> **403 Forbidden**.
    - Nhân viên có đầy đủ cả 2 quyền -> Được phép thực hiện và nhận **200 OK**.

### 1.3. Finding 3 (HIGH / NeedsPO — Fail-Closed Missing TTL & Quản lý Mở PO Questions D21)
- **Vấn đề Round 2:**
  - `GetGuestBookingByTokenQuery` và `ConfirmGuestBookingCommand` chỉ kiểm tra `TokenExpiresAtUtc.HasValue && expired`. Khi snapshot cũ có `TokenExpiresAtUtc == null`, hệ thống cho phép tra cứu vô hạn (fail-open).
  - Mốc tính TTL (dự kiến vs thực tế) và quy trình reissue/revoke chưa có quyết định PO chính thức nhưng code tự chốt một mốc.
- **Giải pháp Round 3:**
  - Chuyển toàn bộ sang cơ chế **Fail-Closed khi thiếu TTL**:
    - Trong [`GetGuestBookingByTokenQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs):
      ```csharp
      if (!snapshot.TokenExpiresAtUtc.HasValue || snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
      {
          throw new NotFoundException("Mã tra cứu đặt phòng không tồn tại hoặc đã hết hạn.");
      }
      ```
    - Trong [`ConfirmGuestBookingCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs):
      ```csharp
      if (!initialSnap.TokenExpiresAtUtc.HasValue || initialSnap.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
      {
          throw new NotFoundException("Mã tra cứu đặt phòng không tồn tại hoặc đã hết hạn.");
      }
      ```
  - Trong [`CreateGuestHoldCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs): Thiết lập `TokenExpiresAtUtc = effectiveEndUtc.AddDays(7)` theo D21.
  - **Quản lý câu hỏi mở PO:** Ghi nhận minh bạch trong `docs/agent-coordination/decisions.md` và `task.json.needsPO`:
    1. D21 lookup TTL anchor: Mốc tính TTL dự kiến (`EndAtUtc`) hay ngày trả phòng thực tế khi gia hạn/no-show/cancel, cùng quy trình revoke/reissue token chính thức.
    2. Quy tắc quote TTL 5 phút / hold 15 phút price pinning và stale-quote acknowledgement.
    - Antigravity tuyệt đối không tuyên bố tự ý đóng 100% các quyết định chính sách này mà để ngỏ cho PO quyết định.

---

## 2. Bằng chứng Kiểm thử Toàn diện (Test Evidence)

### 2.1. WebApi HTTP Pipeline Tests (P5_GuestBookingHttpPipelineTests)
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~P5_GuestBookingHttpPipelineTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 1, Skipped: 0, Total: 1, Duration: 13 s - HotelSaas.WebApi.Tests.dll (net10.0)
```
Tất cả các kịch bản trong pipeline HTTP được xác minh trên database PostgreSQL thật với schema GUID riêng biệt:
1. **Anonymous Discovery & Hold Creation:** Tra cứu công khai chi nhánh, loại phòng, tình trạng phòng trống, tính báo giá (`POST /api/public/quotes/calculate`), kiểm tra ngữ pháp IdempotencyKey, tạo giữ chỗ ẩn danh 15 phút (`POST /api/public/bookings/hold` -> 201 Created), tra cứu trạng thái đã che mờ PII (`GET /api/public/bookings/{lookupToken}` -> 200 OK).
2. **Anonymous Confirm Blocked:** Khách ẩn danh gọi xác nhận cọc nhận ngay **401 Unauthorized**.
3. **Dual Permission Verification:**
   - Nhân viên chỉ có `RESERVATIONS.Update` gọi xác nhận -> Nhận **403 Forbidden**.
   - Nhân viên chỉ có `PAYMENTS.Create` gọi xác nhận -> Nhận **403 Forbidden**.
   - Nhân viên có cả 2 quyền -> Thành công.
4. **Branch Mismatch:** Nhân viên chi nhánh khác gọi xác nhận đơn chi nhánh 1 -> Nhận **400 Bad Request** / **403 Forbidden** (`ERR_BRANCH_MISMATCH`).
5. **Insufficient Deposit (Confirm Endpoint):** Xác nhận với số tiền nhỏ hơn 30% cọc -> Nhận **400 Bad Request** (`ERR_INSUFFICIENT_DEPOSIT`).
6. **Small Manual Payment Bypass Prevention (CreatePayment Endpoint):** Cố tình nộp tiền nhỏ (10,000 VND < 90,000 VND cọc) qua endpoint thanh toán chung `POST /api/payments` cho đơn online hold đang `PendingPayment` -> Nhận ngay **400 Bad Request** (`ERR_INSUFFICIENT_DEPOSIT`).
7. **Unconfirmed Online Hold Check-In Prevention:** Cố tình làm thủ tục check-in cho đơn online hold chưa xác nhận cọc qua `POST /api/reservations/{id}/check-in` -> Nhận ngay **409 Conflict** (`ERR_HOLD_NOT_CONFIRMED`).
8. **Expired Hold Rejection Across All Writers:**
   - Thanh toán nộp tiền cho hold đã hết hạn -> Nhận **409 Conflict** (`ERR_HOLD_EXPIRED`).
   - Check-in cho hold đã hết hạn -> Nhận **409 Conflict** (`ERR_HOLD_EXPIRED`).
   - Xác nhận cọc cho hold đã hết hạn -> Nhận **409 Conflict** (`ERR_HOLD_EXPIRED`).
9. **Missing TTL Fail-Closed:** Tra cứu hoặc xác nhận đơn có snapshot thiếu `TokenExpiresAtUtc` (null) -> Nhận ngay **404 NotFound**.
10. **Valid Receipt Confirm & Replay:** Xác nhận cọc hợp lệ $\ge 30\%$ thành công, replay cùng payload trả kết quả idempotent không nhân đôi thanh toán, replay sai payload trả **409 Conflict**.
11. **Shared Inventory Race under Room Row Lock:** Hai request đồng thời tranh phòng vật lý cuối cùng (Online Hold vs Internal Booking) -> Đúng 1 request thành công (201 Created) và request còn lại nhận **409 Conflict** (`ERR_ROOM_UNAVAILABLE`).

### 2.2. Toàn bộ Bộ WebApi Tests
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 46, Skipped: 0, Total: 46, Duration: 34 s - HotelSaas.WebApi.Tests.dll (net10.0)
```

### 2.3. Application Integration Tests (P5_GuestBookingTests)
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/ --filter "FullyQualifiedName~P5_GuestBookingTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 16, Skipped: 0, Total: 16, Duration: 27 s - HotelSaas.Application.Tests.dll (net10.0)
```
Toàn bộ 16 tests pass 100%:
- Hold creation & 15-minute expiration
- Concurrency race on last available room
- Expired hold inventory release
- PII masking on token lookup
- Invalid token lookup fail-closed
- Staff authorized confirm & 30% deposit verification
- Hold expired conflict across all writers
- Revoked token & expired token fail-closed (kể cả null TTL)
- Idempotency key grammar validation & advisory key lock
- Branch mismatch rejection
- Staff unauthenticated / unauthorized dual-permission rejection
- Concurrent confirm & concurrent cancel non-revival FSM guard

### 2.4. Frontend Unit & Component Tests (Vitest)
```powershell
npx vitest run
```
**Kết quả:**
```text
 Test Files  11 passed (11)
      Tests  145 passed (145)
   Duration  5.25s
```
- 11/11 test files passed, 145/145 unit tests passed.

### 2.5. Frontend Angular Production Build
```powershell
npm run build
```
**Kết quả:**
```text
Application bundle generation complete. [10.455 seconds]
Output location: C:\Dev\hotel-saas-v2\frontend\dist\frontend
Exit code: 0
0 errors, 0 compilation issues.
```

---

## 3. Danh sách Tệp Tạo mới & Sửa đổi (Files Manifest)

| Tệp tin | Hành động | Mục đích |
|---|---|---|
| `backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs` | Sửa đổi | Bổ sung guard cho online hold: chặn `ERR_HOLD_EXPIRED` và chặn bypass cọc `ERR_INSUFFICIENT_DEPOSIT` (Finding 1) |
| `backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs` | Sửa đổi | Bổ sung guard cho online hold: chặn `ERR_HOLD_EXPIRED` và chặn nhận phòng chưa cọc `ERR_HOLD_NOT_CONFIRMED` (Finding 1) |
| `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` | Sửa đổi | Bổ sung `[RequirePermission("PAYMENTS", PermissionAction.Create)]` trên `POST bookings/{token}/confirm` (Finding 2) |
| `backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs` | Sửa đổi | Bổ sung `[RequirePermission("PAYMENTS", PermissionAction.Create)]` trên `POST reservations/{id}/confirm` (Finding 2) |
| `backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs` | Sửa đổi | Fail-closed chặt chẽ: null hoặc expired `TokenExpiresAtUtc` ném `NotFoundException` (Finding 3) |
| `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs` | Sửa đổi | Fail-closed chặt chẽ: null hoặc expired `TokenExpiresAtUtc` ném `NotFoundException` (Finding 3) |
| `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs` | Sửa đổi | Thiết lập `TokenExpiresAtUtc = effectiveEndUtc.AddDays(7)` theo D21 (Finding 3) |
| `backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs` | Sửa đổi | Bổ sung kịch bản kiểm tra: Dual Permission matrix (RESERVATIONS + PAYMENTS), small payment bypass rejection, unconfirmed hold check-in rejection, expired hold rejection xuyên writers, null TTL fail-closed |
| `backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs` | Sửa đổi | Cập nhật test fixtures để tuân thủ quy tắc fail-closed null TTL |
| `docs/agent-coordination/decisions.md` | Giữ nguyên | Ghi nhận minh bạch các câu hỏi mở PO: D21 TTL anchor & reissue/revoke, Quote/Hold price pinning |
| `docs/agent-coordination/task.json` | Cập nhật | Cập nhật round 3, submissionId `sub-p5-guest-booking-01-r3-20261010`, release writer về `none` |

---

## 4. Quản lý Câu hỏi Mở với PO (NeedsPO)

Hệ thống đã triển khai hoàn tất 100% các yêu cầu kỹ thuật và nghiệp vụ độc lập. Đối với các chính sách mở chưa được PO duyệt dứt điểm:
1. **D21 lookup TTL anchor & reissue/revoke:** Mốc neo TTL là thời điểm trả phòng dự kiến (`EndAtUtc`) hay trả phòng thực tế khi có gia hạn/hủy/no-show; hợp đồng phát hành lại token khi khách làm mất mã tra cứu.
2. **Quote 5 phút / Hold 15 phút price pinning:** Chính sách khóa giá cố định trong suốt 15 phút hold và cơ chế xác nhận đơn giá hết hạn (stale quote acknowledgement).

Các nội dung này được ghi rõ trong `task.json.needsPO` để PO chốt theo quy trình.

---

## 5. Cam kết & Tuân thủ Hợp tác (Zero-Migration & Standing Daemons)

1. **Zero DB Migrations:** Tuyệt đối không thay đổi schema hay migration PostgreSQL.
2. **Bảo tồn Dịch vụ Nền:** Daemon PostgreSQL (Cổng 5432, `task-7660`) và daemon cron điều phối (`task-12898`) tiếp tục vận hành ổn định.
3. **Phạm vi Phân quyền:** Không chỉnh sửa bất kỳ tệp tin nào thuộc quyền sở hữu của đồng nghiệp về Phòng (`Rooms`) hoặc Buồng phòng (`Housekeeping`).

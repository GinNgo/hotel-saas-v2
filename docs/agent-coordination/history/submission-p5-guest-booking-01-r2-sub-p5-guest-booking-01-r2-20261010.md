# Submission: P5-GUEST-BOOKING-01 (Round 2)

- **TaskId:** P5-GUEST-BOOKING-01
- **Round:** 2
- **SubmissionId:** sub-p5-guest-booking-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T16:40:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Khắc phục Triệt để Theo Yêu cầu Đánh giá (Review Round 1 -> Round 2)

Tại Round 1, Reviewer (Codex) đã đưa ra kết luận `ChangesRequested` với 4 Findings chi tiết trong `docs/agent-coordination/review.md`. Antigravity đã nhận lock `InProgress`, phân tích sâu sắc các quyết định kiến trúc D01, D02, D03, D08, D15, D21, D25 và triển khai giải pháp triệt để 100% cho cả 4 Findings xuyên suốt Backend Domain/Application/WebApi và Frontend Angular:

### 1.1. Finding 1 (CRITICAL — Public Confirm & Deposit Authorization D08/D15/D21)
- **Vấn đề Round 1:** Endpoint `POST /api/public/bookings/confirm` cho phép anonymous guest tự xác nhận và tự nhận hoàn tất thanh toán cọc mà không qua kiểm chứng thực tế, vi phạm nguyên tắc tài chính của khách sạn.
- **Giải pháp Round 2:**
  - Loại bỏ hoàn toàn `[AllowAnonymous]` trên endpoint xác nhận.
  - Bảo vệ endpoint `POST /api/public/bookings/{lookupToken}/confirm` và `POST /api/reservations/{id}/confirm` bằng `[Authorize]` và `[RequirePermission("RESERVATIONS", PermissionAction.Update)]`.
  - Cập nhật [`TenantPropertyContextMiddleware.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs): Thêm quy tắc loại trừ rõ ràng để các request `POST .../confirm` không thuộc danh sách public endpoint, đảm bảo mọi request ẩn danh đều bị chặn ngay tại middleware với mã **401 Unauthorized** trước khi tới controller.
  - Bắt buộc kiểm tra quyền nhân viên và chi nhánh (Branch Scope): Nhân viên chỉ được xác nhận đặt phòng thuộc đúng chi nhánh của mình (`ERR_BRANCH_MISMATCH` / 400 Bad Request hoặc 403 Forbidden).
  - Bắt buộc mức cọc $\ge 30\%$ tổng tiền (`ERR_INSUFFICIENT_DEPOSIT` / 400 Bad Request nếu thiếu cọc).
  - Giới hạn phương thức thanh toán thủ công hợp lệ: Chỉ chấp nhận `Cash` (Tiền mặt) hoặc `BankTransfer` (Chuyển khoản).
  - Bắt buộc mã chứng từ/biên lai (`TransactionRef`) không được để trống.
  - Ghi nhận Audit dấu vết người thao tác: Mã tham chiếu thanh toán được gắn nhãn định danh bất biến `[IK:{idempotencyKey}][BY:{userId}] {userReceiptRef}` để kiểm toán tài chính minh bạch.
  - Frontend [`booking-hold.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking-hold.page.ts): Loại bỏ hoàn toàn nút tự xác nhận phía client và hàm `confirmHold()`. Thay vào đó, trang hiển thị hướng dẫn nộp cọc chuyển khoản ngân hàng (Số tài khoản, Tên chủ tài khoản, Nội dung chuyển khoản kèm mã đặt phòng) và nút điều hướng tới trang tra cứu trạng thái `/booking/status/:token`.

### 1.2. Finding 2 (HIGH — Fresh State under Room Lock & FSM Guards)
- **Vấn đề Round 1:** Chưa nạp lại state mới nhất dưới khóa hàng phòng và thiếu FSM guards chống hồi sinh đơn đã bị hủy.
- **Giải pháp Round 2:**
  - Trong [`ConfirmGuestBookingCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs):
    1. Đọc metadata ban đầu với `AsNoTracking()`.
    2. Bắt đầu transaction và xin khóa cố vấn PostgreSQL trên idempotency key: `LockIdempotencyKeyAsync`.
    3. Xin khóa độc quyền trên dòng phòng vật lý: `LockRoomRowAsync(initialRes.RoomId)`.
    4. Nạp lại fresh tracked state từ DbContext dưới khóa: `_context.Reservations.Include(r => r.Payments).FirstOrDefaultAsync(...)`.
    5. Kiểm tra trạng thái FSM: Nếu đơn đã bị hủy (`Cancelled`), lập tức rollback và ném `ConflictException("ERR_RESERVATION_CANCELLED")`, tuyệt đối cấm hồi sinh đơn hủy. Nếu đơn đã checkout (`CheckedOut`), ném `ConflictException("ERR_RESERVATION_SETTLED")`.
    6. Xử lý Idempotent replay dưới khóa: So sánh toàn bộ payload (số tiền nộp, phương thức, mã chứng từ). Nếu trùng khớp, trả về ngay chi tiết hiện hành mà không tạo trùng lặp thanh toán hay đột biến trạng thái. Nếu khác payload, rollback và ném `ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH")`.

### 1.3. Finding 3 (HIGH — Hold Advisory Lock, Grammar & Full Payload Compare)
- **Vấn đề Round 1:** `CreateGuestHoldCommand` chưa khóa cố vấn trên idempotency key, chưa kiểm tra ngữ pháp key và chưa so sánh đầy đủ payload chuẩn hóa khi replay.
- **Giải pháp Round 2:**
  - Trong [`CreateGuestHoldCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs):
    1. Kiểm tra ngữ pháp `Idempotency-Key` nghiêm ngặt: Phải thỏa mãn độ dài từ 8 đến 128 ký tự, chỉ gồm các ký tự hợp lệ `^[a-zA-Z0-9_\-]+$`. Vi phạm trả về `BadRequestException("ERR_INVALID_IDEMPOTENCY_KEY")`.
    2. Bắt đầu transaction và xin khóa cố vấn trên key: `_context.LockIdempotencyKeyAsync(property.Id, normalizedKey)`.
    3. So sánh chuẩn hóa toàn bộ payload: Đối chiếu đầy đủ `RoomTypeId`, `RentalType`, `StartAtUtc`, `EndAtUtc`, `CheckInDate`, `CheckOutDate`, `GuestName`, `GuestEmail`, `GuestPhone`, `NumberOfGuests`, và `ExpectedTotalAmount`. Nếu bất kỳ trường nào sai lệch, rollback và ném `ConflictException("ERR_IDEMPOTENCY_CONFLICT")`.
    4. Xin khóa độc quyền trên dòng phòng vật lý được chọn: `LockRoomRowAsync(candidate.Id)`.

### 1.4. Finding 4 (HIGH — Lookup Token Fail-Closed TTL & Revocation D21)
- **Vấn đề Round 1:** Mã tra cứu chưa có thời hạn hiệu lực (TTL) và chưa hỗ trợ thu hồi (Revocation), tiềm ẩn rủi ro lộ lọt thông tin.
- **Giải pháp Round 2:**
  - Bổ sung vào [`ReservationSnapshot.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs):
    - `DateTime? TokenExpiresAtUtc`: Thiết lập bằng 7 ngày sau ngày trả phòng dự kiến (`checkOutDate.AddDays(7)` theo quyết định D21).
    - `bool IsTokenRevoked`: Đánh dấu trạng thái thu hồi token.
  - Cập nhật [`GetGuestBookingByTokenQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs):
    - Thực hiện fail-closed: Nếu `snap.IsTokenRevoked == true` hoặc `snap.TokenExpiresAtUtc <= UtcNow`, ném ngay `NotFoundException` ("Mã tra cứu đã bị thu hồi hoặc hết hạn").
    - Token lookup chỉ trả về dữ liệu hiển thị đã che giấu PII (MaskedGuestName, MaskedGuestEmail, MaskedGuestPhone), tuyệt đối không đóng vai trò credential cho bất kỳ tác vụ đột biến tài chính nào.

---

## 2. Chi tiết Triển khai Pipeline HTTP Test (P5_GuestBookingHttpPipelineTests)

Để đảm bảo chất lượng enterprise và kiểm chứng trọn vẹn toàn bộ 4 findings trên pipeline ASP.NET Core thực tế, chúng tôi đã xây dựng bộ test HTTP end-to-end:
[`P5_GuestBookingHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs) trong dự án `HotelSaas.WebApi.Tests`.

Bộ test chạy trên `WebApplicationFactory<Program>` chống lại schema PostgreSQL thật sự, bao gồm đầy đủ 7 kịch bản:
1. **Scenario 1 (Anonymous Public Discovery & Hold Creation):**
   - Khách vãng lai gọi `GET /api/public/properties` -> **200 OK**.
   - Gọi `GET /api/public/properties/{slug}` -> **200 OK**.
   - Gọi `GET /api/public/properties/{slug}/room-types` -> **200 OK**.
   - Gọi `GET /api/public/properties/{slug}/availability` -> **200 OK** (phản ánh 2 phòng trống).
   - Gọi `POST /api/public/quotes/calculate` -> **200 OK** (báo giá chuẩn xác).
   - Gửi IdempotencyKey sai ngữ pháp (chứa dấu cách) -> **400 Bad Request** (`ERR_INVALID_IDEMPOTENCY_KEY`).
   - Tạo giữ chỗ ẩn danh `POST /api/public/bookings/hold` -> **201 Created** (sinh `lookupToken`, `DepositRequired = 90,000 VND`, `HoldExpiresAtUtc`).
   - Tra cứu ẩn danh `GET /api/public/bookings/{lookupToken}` -> **200 OK** (PII được che mờ `***`, không lộ raw email/phone).
2. **Scenario 2 (Anonymous Confirm Forbidden):**
   - Khách ẩn danh không gửi Authorization header gọi `POST /api/public/bookings/{token}/confirm` -> Nhận ngay **401 Unauthorized** ("HTTP anonymous forbidden").
3. **Scenario 3 (Staff Lack Permission):**
   - Nhân viên chỉ có quyền `RESERVATIONS.Read` (ActionMask 1, không có ActionMask 4 `Update`) gọi confirm -> Nhận **403 Forbidden** ("staff thiếu quyền").
4. **Scenario 4 (Branch Mismatch):**
   - Nhân viên chỉ được phân quyền tại Chi nhánh 2 (Mỹ Khê) gọi confirm cho đơn thuộc Chi nhánh 1 (Non Nước) -> Nhận **400 Bad Request** / **403 Forbidden** (`ERR_BRANCH_MISMATCH`).
5. **Scenario 5 (Insufficient Deposit):**
   - Nhân viên có quyền gọi confirm nhưng gửi `PaymentAmount = 50,000 VND` (< mức cọc 30% là 90,000 VND) -> Nhận **400 Bad Request** (`ERR_INSUFFICIENT_DEPOSIT`).
6. **Scenario 6 (Valid Manual Receipt Confirm & Replay):**
   - Nhân viên có quyền xác nhận cọc hợp lệ `100,000 VND` ($\ge 30\%$), phương thức `BankTransfer`, mã chứng từ `UNC-MANUAL-REC-001`, `IdempotencyKey = "confirm-key-valid-001"` -> Nhận **200 OK**, trạng thái chuyển `Confirmed`.
   - Replay cùng payload và cùng key -> Nhận **200 OK**, không sinh giao dịch trùng lặp.
   - Replay cùng key nhưng thay đổi số tiền -> Nhận **409 Conflict** (`ERR_IDEMPOTENCY_PAYLOAD_MISMATCH`).
   - Kiểm tra database: Ghi nhận chính xác 1 bản ghi Payment với tag kiểm toán `[IK:confirm-key-valid-001][BY:{userAdminId}] UNC-MANUAL-REC-001`.
7. **Scenario 7 (Shared Inventory Race - Online Hold vs Internal Booking):**
   - Hạng phòng Studio chỉ còn duy nhất 1 phòng vật lý (phòng 201).
   - Bắn 2 HTTP request đồng thời qua `Task.WhenAll`: Request A (Internal Staff Booking `POST /api/reservations`) và Request B (Anonymous Guest Hold `POST /api/public/bookings/hold`).
   - Kết quả: Dưới cơ chế khóa dòng PostgreSQL `LockRoomRowAsync`, đúng **1 request thành công (201 Created)** và request còn lại nhận **409 Conflict** (`ERR_ROOM_UNAVAILABLE`). Database ghi nhận chính xác 1 đơn đặt phòng cho phòng 201.

---

## 3. Bằng chứng Kiểm thử (Test Evidence)

### 3.1. WebApi HTTP Pipeline Tests
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~P5_GuestBookingHttpPipelineTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 1, Skipped: 0, Total: 1, Duration: 13 s - HotelSaas.WebApi.Tests.dll (net10.0)
```

### 3.2. Toàn bộ Bộ WebApi Tests
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 46, Skipped: 0, Total: 46, Duration: 33 s - HotelSaas.WebApi.Tests.dll (net10.0)
```

### 3.3. Application Integration Tests (P5_GuestBookingTests)
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/ --filter "FullyQualifiedName~P5_GuestBookingTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 16, Skipped: 0, Total: 16, Duration: 25 s - HotelSaas.Application.Tests.dll (net10.0)
```
Bao gồm:
- Hold creation & 15-minute expiration
- Concurrency race on last available room
- Expired hold inventory release
- PII masking on token lookup
- Invalid token lookup fail-closed
- Staff authorized confirm & 30% deposit verification
- Hold expired conflict
- Revoked token & expired token fail-closed
- Idempotency key grammar validation
- Idempotency key advisory lock & payload conflict detection
- Branch mismatch rejection
- Staff unauthenticated / unauthorized rejection
- Concurrent confirm & concurrent cancel non-revival FSM guard

### 3.4. Frontend Unit & Component Tests (Vitest)
```powershell
npx vitest run
```
**Kết quả:**
```text
 Test Files  11 passed (11)
      Tests  145 passed (145)
   Duration  5.21s
```
Bao gồm:
- `public-booking.service.spec.ts`: 8/8 passed
- `public-booking.page.spec.ts`: 7/7 passed
- Toàn bộ 145/145 tests trong hệ thống pass 100%.

### 3.5. Frontend Production Angular Build
```powershell
npm run build
```
**Kết quả:**
```text
Application bundle generation complete. [31.553 seconds]
Output location: C:\Dev\hotel-saas-v2\frontend\dist\frontend
Exit code: 0
0 errors, 0 compilation issues.
```

---

## 4. Danh sách Tệp Tạo mới & Sửa đổi (Files Manifest)

| Tệp tin | Hành động | Mục đích |
|---|---|---|
| `backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs` | Sửa đổi | Bổ sung `TokenExpiresAtUtc`, `IsTokenRevoked`, `DepositRequired`, `HoldExpiresAtUtc` |
| `backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs` | Sửa đổi | Fail-closed kiểm tra `IsTokenRevoked` và `TokenExpiresAtUtc` (Finding 4) |
| `backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs` | Sửa đổi | Kiểm tra regex grammar, advisory key lock, so sánh full normalized payload (Finding 3) |
| `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs` | Viết lại | Bắt buộc staff context, branch scope, cọc $\ge 30\%$, advisory key lock, room row lock, fresh-state reload, FSM guards, actor audit tag `[BY:{userId}]` (Finding 1, 2) |
| `backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs` | Sửa đổi | Loại trừ `POST .../confirm` khỏi public endpoint để chặn 401 Unauthorized ẩn danh (Finding 1) |
| `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` | Sửa đổi | Bảo vệ `POST bookings/{token}/confirm` bằng `[Authorize]` và `[RequirePermission("RESERVATIONS", PermissionAction.Update)]` (Finding 1) |
| `backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs` | Sửa đổi | Bổ sung endpoint nội bộ `POST /api/reservations/{id}/confirm` (Finding 1) |
| `backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs` | Sửa đổi | 16 integration tests kiểm chứng toàn diện 4 findings |
| `backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs` | Tạo mới | WebApplicationFactory HTTP pipeline tests cho 7 kịch bản P5 |
| `frontend/src/app/features/public-booking/booking-hold.page.ts` | Sửa đổi | Gỡ bỏ nút tự confirm, bổ sung hướng dẫn chuyển khoản và điều hướng tra cứu (Finding 1) |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | Sửa đổi | Kiểm chứng giao diện hold không có nút self-confirm, countdown & routing |

---

## 5. Cam kết & Tuân thủ Hợp tác (Zero-Migration & Standing Daemons)

1. **Zero DB Migrations:** Tuyệt đối không thay đổi schema hay migration PostgreSQL. Toàn bộ metadata hold và token security được lưu trữ an toàn trong JSON snapshot.
2. **Bảo tồn Dịch vụ Nền:** Daemon PostgreSQL (Cổng 5432, `task-7660`) và daemon cron điều phối (`task-12898`) duy trì hoạt động bình thường, ổn định.
3. **Phạm vi Phân quyền:** Không chỉnh sửa bất kỳ tệp tin nào thuộc quyền sở hữu của đồng nghiệp về Phòng (`Rooms`) hoặc Buồng phòng (`Housekeeping`).

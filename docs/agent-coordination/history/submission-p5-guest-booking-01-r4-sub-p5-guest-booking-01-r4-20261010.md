# Submission: P5-GUEST-BOOKING-01 (Round 4)

- **TaskId:** P5-GUEST-BOOKING-01
- **Round:** 4
- **SubmissionId:** sub-p5-guest-booking-01-r4-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T17:13:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Khắc phục Triệt để Theo Yêu cầu Đánh giá (Review Round 3 -> Round 4)

Tại Round 3, Reviewer (Codex) ghi nhận toàn bộ các fixes về phân quyền kép (`RESERVATIONS.Update` + `PAYMENTS.Create`) và fail-closed khi thiếu TTL (`TokenExpiresAtUtc == null`) đã đóng hoàn toàn, nhưng chỉ ra một điểm hồi quy phạm vi (scope regression):
- **Vấn đề Round 3:** Guard kiểm tra `HoldExpiresAtUtc <= now` trong `CreatePaymentCommandHandler` và `CheckInReservationCommandHandler` được áp dụng chung cho mọi đơn có `snap.IsOnlineHold == true`, kể cả khi đơn đó đã chuyển sang `Confirmed` hoặc `CheckedIn`. Do đó, khách đã nộp cọc hợp lệ đúng hạn 15 phút, nhưng khi đến khách sạn nhận phòng (lúc thời hạn 15 phút của hold ban đầu đã trôi qua) lại bị chặn check-in với lỗi `ERR_HOLD_EXPIRED`; và khách đang ở (`CheckedIn`) không thể thu nốt 70% số tiền còn lại trước khi trả phòng.
- **Nguyên tắc cốt lõi:** Thời hạn giữ chỗ 15 phút (`HoldExpiresAtUtc`) chỉ chi phối trạng thái **chờ thanh toán cọc (`PendingPayment`)** của đơn online hold. Một khi nhân viên đã xác nhận cọc thành công (`Confirmed`), đơn đã trở thành đặt phòng chính thức, khách phải được nhận phòng (`CheckedIn`) và thu nốt dư nợ bình thường bất kể mốc thời gian giữ phòng cũ.

### 1.1. Khắc phục Triệt để tại Các Handlers Dưới Room Lock
1. **[`CreatePaymentCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs):**
   - Phân biệt rõ ràng lifecycle: Điều kiện kiểm tra hết hạn giữ chỗ `HoldExpiresAtUtc` và kiểm tra mức cọc tối thiểu 30% (`depositRequired`) được đặt nghiêm ngặt bên trong phạm vi `reservation.Status == ReservationStatus.PendingPayment`.
   - Khi đơn ở trạng thái `Confirmed` hoặc `CheckedIn`, guard này không kích hoạt, cho phép thu toàn bộ số dư công nợ còn lại (`remainingBalance`) theo đúng chuẩn quy trình thanh toán.
2. **[`CheckInReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs):**
   - Đơn online hold ở trạng thái `PendingPayment` tuyệt đối không được phép check-in:
     - Nếu đã quá hạn giữ chỗ (`HoldExpiresAtUtc <= now`) hoặc thiếu TTL: ném ngay `ConflictException("ERR_HOLD_EXPIRED")`.
     - Nếu chưa quá hạn nhưng chưa được xác nhận cọc: ném `ConflictException("ERR_HOLD_NOT_CONFIRMED")`.
   - Đơn online hold đã ở trạng thái `Confirmed` được phép tiến hành làm thủ tục nhận phòng (`CheckedIn`) và cập nhật trạng thái phòng thành `Occupied`, bất kể thời hạn giữ phòng 15 phút ban đầu đã trôi qua.
3. **[`ConfirmGuestBookingCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs):**
   - Bảo đảm fail-closed: Nếu `snapshot.IsOnlineHold` và thiếu `HoldExpiresAtUtc` hoặc đã quá hạn, chặn xác nhận cọc ban đầu với `ConflictException("ERR_HOLD_EXPIRED")`.

---

## 2. Bằng chứng Kiểm thử Toàn diện (Test Evidence)

### 2.1. WebApi HTTP Pipeline Tests ([`P5_GuestBookingHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs))
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~P5_GuestBookingHttpPipelineTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 1, Skipped: 0, Total: 1, Duration: 13 s - HotelSaas.WebApi.Tests.dll (net10.0)
```
Bao gồm kiểm chứng trọn vẹn kịch bản vòng đời mới **Scenario 6.5**:
1. **Tạo giữ chỗ ẩn danh & Xác nhận cọc hợp lệ:** Hold 15 phút được tạo thành công, nhân viên xác nhận cọc 100,000 VND ($\ge 30\%$) -> Chuyển trạng thái `Confirmed`.
2. **Đẩy mốc thời gian giữ phòng vào quá khứ (Post-TTL):** Cập nhật `HoldExpiresAtUtc = UtcNow - 30 minutes` trong DB để mô phỏng khách đến nhận phòng sau khi thời hạn giữ cọc ban đầu đã qua.
3. **Check-in thành công (200 OK):** Gọi `POST /api/reservations/{id}/check-in` -> Trả về **200 OK**, trạng thái chuyển `CheckedIn`, phòng chuyển `Occupied`.
4. **Chặn trả phòng sớm khi còn dư nợ (POL-IO03):** Gọi `POST /api/reservations/{id}/check-out` khi còn thiếu 200,000 VND -> Bị chặn với **409 Conflict** (`ERR_OUTSTANDING_BALANCE`).
5. **Thu toàn bộ số dư còn lại (201 Created):** Gọi `POST /api/payments` thu nốt 200,000 VND tiền mặt trên đơn `CheckedIn` -> Trả về **201 Created**, thanh toán thành công không bị chặn bởi hold TTL.
6. **Trả phòng thành công (200 OK):** Gọi lại `POST /api/reservations/{id}/check-out` sau khi đã tất toán dư nợ -> Trả về **200 OK**, trạng thái chuyển `CheckedOut`, phòng chuyển `Dirty`.
7. **Bảo tồn các Invariants khác:**
   - Đơn online hold `PendingPayment` bị quá hạn vẫn bị chặn trên mọi writers: thanh toán (`ERR_HOLD_EXPIRED`), check-in (`ERR_HOLD_EXPIRED`), xác nhận cọc (`ERR_HOLD_EXPIRED`).
   - Đơn online hold `PendingPayment` chưa cọc bị chặn check-in (`ERR_HOLD_NOT_CONFIRMED`).
   - Cố tình nộp tiền nhỏ (< 30% cọc) trên đơn online `PendingPayment` bị chặn (`ERR_INSUFFICIENT_DEPOSIT`).
   - Ma trận phân quyền kép: chỉ `RESERVATIONS.Update` -> 403; chỉ `PAYMENTS.Create` -> 403; cả hai -> 200 OK.
   - Fail-closed khi token thiếu TTL (null) -> 404 NotFound.
   - Race condition phòng vật lý cuối cùng giữa Online Hold và Internal Booking dưới khóa `LockRoomRowAsync` -> Exact 1 Created (201) và 1 Conflict (409).

### 2.2. Toàn bộ Bộ WebApi Tests
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 46, Skipped: 0, Total: 46, Duration: 34 s - HotelSaas.WebApi.Tests.dll (net10.0)
```

### 2.3. Application Integration Tests ([`P5_GuestBookingTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs))
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/ --filter "FullyQualifiedName~P5_GuestBookingTests"
```
**Kết quả:**
```text
Passed!  - Failed: 0, Passed: 16, Skipped: 0, Total: 16, Duration: 25 s - HotelSaas.Application.Tests.dll (net10.0)
```

### 2.4. Frontend Unit & Component Tests (Vitest)
```powershell
npx vitest run
```
**Kết quả:**
```text
 Test Files  11 passed (11)
      Tests  145 passed (145)
   Duration  4.94s
```

### 2.5. Frontend Angular Production Build
```powershell
npm run build
```
**Kết quả:**
```text
Application bundle generation complete. [9.796 seconds]
Output location: C:\Dev\hotel-saas-v2\frontend\dist\frontend
Exit code: 0
0 errors, 0 compilation issues.
```

---

## 3. Danh sách Tệp Tạo mới & Sửa đổi (Files Manifest)

| Tệp tin | Hành động | Mục đích |
|---|---|---|
| `backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs` | Sửa đổi | Giới hạn guard hold TTL và mức cọc tối thiểu chỉ áp dụng khi `reservation.Status == ReservationStatus.PendingPayment`. Cho phép đơn `Confirmed` và `CheckedIn` thu dư nợ bình thường |
| `backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs` | Sửa đổi | Giới hạn guard hold TTL và `ERR_HOLD_NOT_CONFIRMED` chỉ áp dụng khi `PendingPayment`. Cho phép đơn `Confirmed` check-in thành công kể cả khi mốc 15 phút ban đầu đã trôi qua |
| `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs` | Sửa đổi | Fail-closed chặt chẽ nếu `HoldExpiresAtUtc == null` khi xác nhận cọc đơn online hold |
| `backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs` | Sửa đổi | Bổ sung Scenario 6.5: Hold -> Confirm -> Post-TTL -> CheckIn (200 OK) -> Outstanding balance block CheckOut (409) -> Settle balance (201 Created) -> CheckOut (200 OK) -> Room Dirty |
| `docs/agent-coordination/decisions.md` | Giữ nguyên | Ghi nhận minh bạch các câu hỏi mở PO: D21 TTL anchor & reissue/revoke, Quote/Hold price pinning |
| `docs/agent-coordination/task.json` | Cập nhật | Cập nhật round 4, submissionId `sub-p5-guest-booking-01-r4-20261010`, release writer về `none` |

---

## 4. Quản lý Câu hỏi Mở với PO (NeedsPO)

Hệ thống đã hoàn tất và kiểm chứng toàn bộ các yêu cầu kỹ thuật độc lập. Các câu hỏi mở cần PO phê duyệt chính sách tiếp tục được ghi nhận đầy đủ trong `task.json.needsPO`:
1. **D21 lookup TTL anchor & revoke/reissue:** Mốc tính TTL (dự kiến `EndAtUtc` hay ngày trả phòng thực tế khi có gia hạn/hủy/no-show) cùng quy trình cấp lại token khi khách làm mất mã tra cứu.
2. **Quote 5 phút / Hold 15 phút price pinning:** Chính sách khóa giá cố định và cơ chế stale-quote acknowledgement.

Sau khi nộp Round 4, nếu PO cần thêm thời gian để chốt các câu hỏi chính sách trên, Antigravity sẵn sàng chuyển tiếp sang task tiếp theo trong hàng đợi (như `P7-EVIDENCE-01`) theo đúng chỉ dẫn của Reviewer.

---

## 5. Cam kết & Tuân thủ Hợp tác (Zero-Migration & Standing Daemons)

1. **Zero DB Migrations:** Tuyệt đối không thay đổi schema hay migration PostgreSQL.
2. **Bảo tồn Dịch vụ Nền:** Daemon PostgreSQL (Cổng 5432, `task-7660`) và daemon cron điều phối (`task-12898`) tiếp tục vận hành ổn định.
3. **Phạm vi Phân quyền:** Không chỉnh sửa bất kỳ tệp tin nào thuộc quyền sở hữu của đồng nghiệp về Phòng (`Rooms`) hoặc Buồng phòng (`Housekeeping`).

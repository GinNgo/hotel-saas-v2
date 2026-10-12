# Submission: P3-STAY-LIFECYCLE-01 (Round 1)

- **TaskId:** P3-STAY-LIFECYCLE-01
- **Round:** 1
- **SubmissionId:** sub-p3-stay-lifecycle-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T13:10:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt Phạm vi & Triển khai Lát cắt P3-STAY-LIFECYCLE-01

Mục tiêu lát cắt: Triển khai toàn diện cỗ máy trạng thái (FSM) vòng đời lưu trú (Check-in, Check-out, Cancel), đồng bộ trạng thái buồng phòng (`Occupied` chỉ qua Check-in, `Dirty` khi Check-out, chu trình dọn dẹp buồng phòng trước khi nhận phòng mới), kiểm soát phân quyền và chi nhánh chặt chẽ, cùng giao diện người dùng trực quan trên cả danh sách đặt phòng và modal chi tiết.

### 1.1. Backend State Machine & Domain Logic (CQRS + DDD)

1. **Check-in (`CheckInReservationCommand` & Handler):**
   - **Transaction & Khóa vật lý:** Thực thi trong transaction, khóa row-level phòng vật lý bằng `_context.LockRoomRowAsync(roomId, tenantId, propertyId)` để chống race condition.
   - **FSM Guard Đặt phòng:** Chỉ cho phép chuyển từ `Confirmed` (2) hoặc `PendingPayment` (1) sang `CheckedIn` (3). Mọi trạng thái khác (đã CheckedIn, CheckedOut, Cancelled) đều bị từ chối với HTTP 409 Conflict (`ERR_INVALID_STATUS_TRANSITION`).
   - **Gate Trạng thái Buồng phòng:** Phòng phải ở trạng thái `Clean` (1). Nếu phòng đang `Dirty` (0) hoặc `Cleaning` (2) $\to$ ném HTTP 409 Conflict (`ERR_ROOM_NOT_CLEAN`). Nếu phòng đang `Occupied` (3) $\to$ ném HTTP 409 Conflict (`ERR_ROOM_OCCUPIED`).
   - **Đồng bộ Buồng phòng:** Tự động chuyển trạng thái phòng sang `Occupied` (3) ngay khi nhận phòng. Phòng `Occupied` được bảo vệ tuyệt đối không cho phép đổi trạng thái thủ công từ API Housekeeping (`RoomStatusTransitionValidator`).

2. **Check-out (`CheckOutReservationCommand` & Handler):**
   - **FSM Guard Đặt phòng:** Chỉ cho phép đặt phòng đang ở trạng thái `CheckedIn` (3) chuyển sang `CheckedOut` (4). Các trạng thái khác đều bị từ chối với HTTP 409 Conflict (`ERR_INVALID_STATUS_TRANSITION`).
   - **Đồng bộ Buồng phòng & Bàn giao Housekeeping:** Tự động chuyển phòng từ `Occupied` (3) sang `Dirty` (0). Phòng lập tức xuất hiện trong hàng đợi dọn dẹp của Housekeeping để nhân viên buồng phòng thực hiện chu trình `Dirty` $\to$ `Cleaning` $\to$ `Clean`.

3. **Cancel (`CancelReservationCommand` & Handler):**
   - **FSM Guard Đặt phòng:** Chỉ cho phép hủy khi đặt phòng ở trạng thái `Confirmed` (2) hoặc `PendingPayment` (1).
   - **Chặn Hủy khi đã/đang Lưu trú:** Nếu đơn đã `CheckedIn` hoặc `CheckedOut`, từ chối hủy với HTTP 409 Conflict (`ERR_INVALID_STATUS_TRANSITION`).
   - **Audit & Metadata Hủy:** Ghi nhận chính xác `CancelledAtUtc = DateTime.UtcNow` và lý do hủy `CancellationReason`.
   - **Idempotency Hủy:** Nếu đơn đã hủy trước đó, từ chối với HTTP 409 Conflict (`ERR_ALREADY_CANCELLED`). Phòng vật lý được giữ nguyên trạng thái `Clean` sẵn sàng cho khách khác.

4. **API Controller & Phân quyền Chi nhánh (`ReservationsController.cs`):**
   - Các endpoint mới:
     - `POST /api/reservations/{id}/check-in`
     - `POST /api/reservations/{id}/check-out`
     - `POST /api/reservations/{id}/cancel` (body: `{ reason?: string }`)
   - **Phân quyền linh hoạt:** Áp dụng `[RequireAnyPermission("CHECK_IN_OUT", PermissionAction.Update, "RESERVATIONS", PermissionAction.Update)]`. Cả vai trò quản lý đặt phòng và nhân viên lễ tân đều được cấp quyền thao tác. Nhân viên chỉ có quyền Read bị chặn với HTTP 403 Forbidden.
   - **Cách ly Chi nhánh:** Xác thực nghiêm ngặt header `X-Property-Id` khớp với query/token; mismatch bị từ chối với HTTP 400 Bad Request (`ERR_CONTEXT_MISMATCH`).

---

### 1.2. Frontend Stay Lifecycle UI & Interaction

1. **`ReservationService` (`frontend/src/app/core/services/reservation.service.ts`):**
   - Bổ sung các phương thức gọi API lifecycle: `checkIn(id, propertyId)`, `checkOut(id, propertyId)`, `cancel(id, propertyId, reason?)`.

2. **Giao diện Quản lý Đặt phòng (`reservations.page.ts` & `reservations.page.html`):**
   - **Permission Gate:** Computed signal `canManageStay` kiểm tra quyền `CHECK_IN_OUT` hoặc `RESERVATIONS` với action mask 4 (Update).
   - **Thao tác nhanh trên bảng danh sách:**
     - Với đơn `Confirmed` hoặc `PendingPayment`: Hiển thị nút "Nhận phòng" (emerald) và "Hủy" (rose).
     - Với đơn `CheckedIn`: Hiển thị nút "Trả phòng" (amber).
     - Có spinner loading độc lập theo từng dòng (`actionReservationId`) để ngăn ngừa double-click.
   - **Modal Chi tiết Đặt phòng (Detail Modal):**
     - Hiển thị khối "Thông tin hủy đặt phòng" nổi bật khi đơn đã bị hủy (bao gồm thời gian hủy và lý do hủy).
     - Bổ sung các nút hành động "Nhận phòng", "Trả phòng", "Hủy đặt phòng" ngay dưới footer modal.
   - **Modal Xác nhận Hủy phòng (Cancel Modal):**
     - Modal chuyên dụng hiển thị mã đặt phòng, tên khách, số phòng, thời gian thuê.
     - Textarea cho phép nhân viên nhập lý do hủy phòng trước khi bấm xác nhận.
     - Khóa nút và hiển thị spinner khi đang gửi yêu cầu lên server.

---

## 2. Bằng chứng Kiểm thử Độc lập (Independent Test Evidence)

### 2.1. Frontend Vitest Suites (100% PASS, 113/113 tests)
- **Lệnh thực thi:** `npx vitest run` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **113 passed (113), 8 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **25/25 tests PASS** (bổ sung toàn bộ tests 19–25 cho lifecycle: Check-in state update, Room not clean handling, Check-out to Dirty handling, Cancel modal & capture reason flow, Error handling, and Permission checking).
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**
  - `src/app/app.spec.ts`: **1/1 test PASS**

### 2.2. Backend Application Test Suite (100% PASS, 203/203 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests` tại `C:\Dev\hotel-saas-v2`
- **Kết quả:** **203 passed (203), Exit Code: 0**
  - Bao gồm `P3_StayLifecycleFsmTests.cs` (9/9 tests PASS):
    - `CheckIn_WhenConfirmedAndRoomClean_TransitionsToCheckedInAndOccupied`
    - `CheckIn_WhenRoomDirty_ThrowsRoomNotCleanException`
    - `CheckIn_WhenRoomCleaning_ThrowsRoomNotCleanException`
    - `CheckIn_WhenRoomOccupied_ThrowsRoomOccupiedException`
    - `CheckIn_WhenInvalidReservationStatus_ThrowsInvalidStatusTransitionException`
    - `CheckOut_WhenCheckedIn_TransitionsToCheckedOutAndRoomDirty`
    - `CheckOut_WhenNotCheckedIn_ThrowsInvalidStatusTransitionException`
    - `Cancel_WhenConfirmed_TransitionsToCancelledWithReasonAndRoomStaysClean`
    - `Cancel_WhenCheckedIn_ThrowsInvalidStatusTransitionException`

### 2.3. Backend WebApi HTTP Integration Pipeline Gate (100% PASS, 44/44 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.WebApi.Tests` tại `C:\Dev\hotel-saas-v2`
- **Kết quả:** **44 passed (44), Exit Code: 0**
  - `StayLifecycleHttpPipelineTests.cs`: **1/1 Fact PASS** bao gồm 10 bước kiểm thử HTTP pipeline hoàn chỉnh:
    - **Step 1:** Khởi tạo tài khoản Receptionist (quyền `CHECK_IN_OUT` + `RESERVATIONS` mask 4) và ReadOnlyStaff (mask 1).
    - **Step 2:** POST đặt phòng phòng 201 $\to$ 201 Created (Confirmed), kiểm tra phòng 201 vẫn Clean.
    - **Step 3:** POST Check-in phòng 201 $\to$ 200 OK, đơn chuyển `CheckedIn`, phòng 201 chuyển `Occupied`.
    - **Step 4:** Kiểm tra chặn transition không hợp lệ khi đang CheckedIn (Re-check-in $\to$ 409 Conflict, Cancel khi đang ở $\to$ 409 Conflict).
    - **Step 5:** POST Check-out phòng 201 $\to$ 200 OK, đơn chuyển `CheckedOut`, phòng 201 chuyển `Dirty`.
    - **Step 6:** Kiểm tra chặn transition không hợp lệ khi đã CheckedOut (Re-checkout $\to$ 409 Conflict, Check-in khi đã checkout $\to$ 409 Conflict).
    - **Step 7:** Chu trình Housekeeping: Đặt booking mới cho phòng 201; Check-in khi phòng Dirty $\to$ 409 `ERR_ROOM_NOT_CLEAN`; PATCH phòng Dirty $\to$ Cleaning; Check-in khi phòng Cleaning $\to$ 409 `ERR_ROOM_NOT_CLEAN`; PATCH Cleaning $\to$ Clean; Check-in khi phòng Clean $\to$ 200 OK thành công!
    - **Step 8:** Chu trình Hủy phòng 202: Hủy đặt phòng Confirmed kèm lý do $\to$ 200 OK, trạng thái `Cancelled`, lưu lý do hủy và thời gian hủy; phòng 202 vẫn giữ Clean; Re-cancel $\to$ 409 `ERR_ALREADY_CANCELLED`.
    - **Step 9:** Security Gate Phân quyền: Nhân viên chỉ có quyền Read gọi Check-in $\to$ 403 Forbidden.
    - **Step 10:** Security Gate Cách ly Chi nhánh: Gửi sai query `propertyId` so với header $\to$ 400 Bad Request `ERR_CONTEXT_MISMATCH`.

### 2.4. Build Verification
- **Solution Build:** `dotnet build C:\Dev\hotel-saas-v2\backend\HotelSaas.slnx` $\to$ **Build succeeded. 0 Warning(s), 0 Error(s)**.

---

## 3. Danh sách Files Cập nhật & Thêm mới

1. [`backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshotHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshotHelper.cs): Helper chuẩn hóa mapping `Reservation` và `Property` sang `ReservationDetailDto` đầy đủ snapshot và cancellation metadata.
2. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommand.cs): Command định nghĩa tham số nhận phòng.
3. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs): Xử lý FSM nhận phòng, khóa row phòng, kiểm tra phòng Clean, chuyển trạng thái đơn sang CheckedIn và phòng sang Occupied.
4. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommand.cs): Command định nghĩa tham số trả phòng.
5. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs): Xử lý FSM trả phòng, khóa row phòng, chuyển đơn sang CheckedOut và phòng sang Dirty.
6. [`backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommand.cs): Command định nghĩa tham số hủy đặt phòng kèm lý do.
7. [`backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommandHandler.cs): Xử lý FSM hủy đặt phòng, kiểm tra trạng thái Confirmed/PendingPayment, ghi nhận thời gian và lý do hủy.
8. [`backend/src/HotelSaas.WebApi/Models/CancelReservationRequest.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Models/CancelReservationRequest.cs): DTO body tiếp nhận lý do hủy từ request.
9. [`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs): Bổ sung 3 endpoints `/check-in`, `/check-out`, `/cancel` kèm phân quyền và cách ly chi nhánh.
10. [`frontend/src/app/core/services/reservation.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/reservation.service.ts): Bổ sung các phương thức gọi API `checkIn`, `checkOut`, `cancel`.
11. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts): Thêm computed signal `canManageStay`, các nút hành động nhận/trả/hủy trên bảng, thông tin hủy và nút hành động trong detail modal, cùng modal hủy phòng riêng biệt.
12. [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts): Mocks và 7 unit tests mới kiểm thử toàn diện hành vi UI, service calls, toast alerts, và permission gate.
13. [`backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs): 9 unit/integration tests trên database PostgreSQL kiểm thử FSM nghiệp vụ.
14. [`backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs): 10-step integration test gate qua WebApplicationFactory.

---

## 4. Cam kết Tuân thủ Quy trình Điều phối
- Không commit/deploy/migrate hoặc tác động cơ sở dữ liệu dev/staging/prod.
- Mọi kiểm thử database thực hiện trên schema GUID cô lập trong test database `hotel_saas_p1b01a_test` và được dọn dẹp sạch sẽ sau test run.
- Không chạm vào code Housekeeping của bạn Nguyên hoặc Rooms của bạn Tân.
- Bàn giao writer lock về `writer: "none"`, chuyển trạng thái `status: "Submitted"`, sẵn sàng cho Codex reviewer thẩm định Round 1 của `P3-STAY-LIFECYCLE-01`.

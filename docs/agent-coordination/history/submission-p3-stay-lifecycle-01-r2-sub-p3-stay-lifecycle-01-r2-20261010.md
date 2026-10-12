# Submission: P3-STAY-LIFECYCLE-01 (Round 2)

- **TaskId:** P3-STAY-LIFECYCLE-01
- **Round:** 2
- **SubmissionId:** sub-p3-stay-lifecycle-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T13:36:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt Khắc phục & Hoàn thiện Triệt để 3 Blocking Findings từ Round 1

Trong Round 2, toàn bộ 3 phát hiện (High Priority) của Reviewer Codex tại `docs/agent-coordination/review.md` đã được xử lý triệt để ở cả Backend và Frontend, đồng thời bổ sung đầy đủ các bộ kiểm thử tự động (Concurrency test with Barrier, Permission Contract Gate, Modal Scope & RxJS Lifecycle Guard).

---

### 1.1. Finding 1 (HIGH — Concurrency Lock & Fresh Read Pattern)
- **Vấn đề Round 1:** Đọc FSM đặt phòng và buồng phòng trước khi chiếm khóa row-level phòng; EF Core ChangeTracker giữ trạng thái entity cũ trong memory qua ranh giới lock, tiềm ẩn nguy cơ inconsistent state khi 2 giao dịch đồng thời xảy ra.
- **Giải pháp Round 2:**
  - Chuẩn hóa pattern **Lock-First Entity Tracking** xuyên suốt cả 3 command handlers:
    - [`CheckInReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs)
    - [`CheckOutReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs)
    - [`CancelReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommandHandler.cs)
  - **Quy trình chuẩn:**
    1. Đọc metadata tối thiểu bằng `.AsNoTracking()` (`resHeader.Id`, `resHeader.RoomId`) để xác định phòng vật lý cần khóa mà không đưa vào ChangeTracker.
    2. Chiếm khóa độc quyền trên dòng phòng vật lý bằng `_context.LockRoomRowAsync(resHeader.RoomId, ...)`, phát lệnh `SELECT 1 FROM rooms WHERE id = ... FOR UPDATE` trong transaction `ReadCommitted`.
    3. Chỉ **sau khi đã nắm giữ khóa độc quyền**, mới truy vấn các entity tracked (`Reservation`, `Room`) từ cơ sở dữ liệu. Nhờ vậy, EF Core đảm bảo nạp 100% dữ liệu đã commit mới nhất từ PostgreSQL, loại bỏ hoàn toàn đọc dữ liệu stale trong bộ nhớ.
    4. Kiểm tra FSM guard và buồng phòng trên dữ liệu tươi mới, thực hiện mutation và commit transaction.
- **Kiểm thử Concurrency độc lập:**
  - Bổ sung 3 test case đồng thời sử dụng `Task.WhenAll`, các instance `DbContext` riêng biệt, và `TaskCompletionSource` barrier trong [`P3_StayLifecycleFsmTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs):
    - `Concurrency_TestA_CheckIn_And_Cancel_OnSameReservation_ExactlyOneSucceeds`: Đua lệnh Check-in và Cancel trên cùng một đơn $\to$ đúng 1 lệnh thành công, lệnh thua bị ném `ConflictException(ERR_INVALID_STATUS_TRANSITION)`. Cơ sở dữ liệu duy trì tính toàn vẹn tuyệt đối: hoặc `CheckedIn` + `Occupied`, hoặc `Cancelled` + `Clean`, không bao giờ xảy ra tình trạng `Cancelled` + `Occupied`.
    - `Concurrency_TestB_TwoCheckIns_DifferentReservations_SamePhysicalRoom_ExactlyOneSucceeds`: Hai đơn khác nhau cùng tranh chấp Check-in vào cùng một phòng vật lý $\to$ đúng 1 đơn thành công, đơn còn lại bị ném `ConflictException(ERR_ROOM_OCCUPIED)`. Phòng chuyển sang `Occupied`, đúng 1 đơn `CheckedIn`, đơn kia giữ nguyên `Confirmed`.
    - `Concurrency_TestC_DuplicateCheckOut_OnSameReservation_ExactlyOneSucceeds`: Hai lệnh Check-out trùng lặp gửi cùng lúc $\to$ đúng 1 lệnh thành công, lệnh thua bị ném `ConflictException(ERR_INVALID_STATUS_TRANSITION)`. Phòng chuyển `Dirty`, đơn chuyển `CheckedOut`.

---

### 1.2. Finding 2 (HIGH — Phục hồi Contract Phân quyền Chuẩn Xác)
- **Vấn đề Round 1:** Mở rộng quyền bằng `RequireAnyPermission` cho phép tài khoản có `CHECK_IN_OUT` Update được phép Cancel (vi phạm hợp đồng API `docs/sdd/06-api-design.md:97–99`).
- **Giải pháp Round 2:**
  - **Backend Controller:** Khôi phục kiểm tra quyền đơn lẻ nghiêm ngặt theo đúng đặc tả API contract trong [`ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs):
    - `POST /api/reservations/{id}/check-in`: `[RequirePermission("CHECK_IN_OUT", PermissionAction.Update)]`
    - `POST /api/reservations/{id}/check-out`: `[RequirePermission("CHECK_IN_OUT", PermissionAction.Update)]`
    - `POST /api/reservations/{id}/cancel`: `[RequirePermission("RESERVATIONS", PermissionAction.Update)]`
  - **Frontend UI & Guards:** Tách biệt triệt để computed signal phân quyền trong [`reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts):
    - `canCheckInOut = computed(() => this.authService.hasPermission('CHECK_IN_OUT', 4));`
    - `canCancel = computed(() => this.authService.hasPermission('RESERVATIONS', 4));`
    - Nút Nhận phòng / Trả phòng trên bảng và trong detail modal được bảo vệ bởi `canCheckInOut`.
    - Nút Hủy và modal Hủy được bảo vệ bởi `canCancel`.
- **Kiểm thử Phân quyền:**
  - Bổ sung ma trận kiểm thử phân quyền trong [`StayLifecycleHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs):
    - Khởi tạo role `CheckInOutOnly` (chỉ có `CHECK_IN_OUT:Update` và `RESERVATIONS:Read`): Gọi check-in thành công (200 OK), gọi check-out thành công (200 OK), gọi cancel bị chặn với **403 Forbidden**!
    - Khởi tạo role `ReservationsOnly` (chỉ có `RESERVATIONS:Update` và `CHECK_IN_OUT:Read`): Gọi cancel thành công (200 OK), gọi check-in bị chặn với **403 Forbidden**, gọi check-out bị chặn với **403 Forbidden**!
    - Khởi tạo role `ReadOnly`: Cả 3 hành động đều bị chặn với **403 Forbidden**!
  - Bổ sung unit test tính toán phân quyền độc lập trong [`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts) (Test 21 & Test 22).

---

### 1.3. Finding 3 (HIGH — Modal Scope Leak & Asynchronous Context Guards)
- **Vấn đề Round 1:** Modal hủy phòng không lưu branch context, có thể rò rỉ khi chuyển chi nhánh; callback lifecycle thiếu bảo vệ chống response đến muộn và double-click.
- **Giải pháp Round 2:**
  - **Bảo vệ Modal Hủy theo Chi nhánh:**
    - Thêm signal `cancelModalTargetPropertyId`. Khi mở modal hủy phòng, lưu lại ID chi nhánh đích.
    - Phương thức `confirmCancelReservation()` đối soát nghiêm ngặt: nếu chi nhánh đang hoạt động hoặc `cancelModalTargetPropertyId` không khớp chi nhánh của đơn đặt phòng $\to$ lập tức đóng modal, hủy thao tác, không gửi request.
  - **Dọn dẹp triệt để khi đổi Chi nhánh:**
    - `handlePropertyContextChange(newPropertyId)` tự động gọi `closeCancelModal()`, xóa sạch dữ liệu modal hủy, xóa `actionReservationId`, đặt `isActionLoading = false`, và unsubscribe `lifecycleSub`.
  - **Phòng vệ Asynchronous Race Condition & Stale Response:**
    - Áp dụng bộ đếm tăng dần `lifecycleRequestId`: mỗi thao tác Check-in, Check-out, Cancel sinh một ID mới. Trong callback `next`/`error`, nếu `reqId !== this.lifecycleRequestId` hoặc `activePropertyId !== propId`, response lập tức bị hủy bỏ (discard), không toast thông báo sai branch và không ghi đè state.
  - **Phòng vệ Double-Submit:**
    - Các hàm `onCheckIn`, `onCheckOut`, `confirmCancelReservation` đều kiểm tra `isActionLoading()` và `actionReservationId()` $\to$ các click liên tiếp khi request đang in-flight bị từ chối ngay lập tức.
- **Kiểm thử Modal & Lifecycle Guards:**
  - Bổ sung unit tests trong [`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts):
    - Test 23: Chống double-submit / rapid click khi request đang in-flight.
    - Test 24: Đóng modal hủy và xóa sạch state khi chi nhánh thay đổi, ngăn chặn gửi lệnh hủy chéo chi nhánh.
    - Test 25: Hủy bỏ response check-in đến muộn nếu chi nhánh đã chuyển đổi trong thời gian chờ server phản hồi.

---

## 2. Bằng chứng Kiểm thử Độc lập (Independent Test Evidence)

### 2.1. Frontend Vitest Suites (100% PASS, 117/117 tests)
- **Lệnh thực thi:** `npx vitest run` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **117 passed (117), 8 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **29/29 tests PASS** (bổ sung đầy đủ tests 21–25 cho separated permissions, double-submit guard, modal branch isolation, và stale response discard).
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**
  - `src/app/app.spec.ts`: **1/1 test PASS**

### 2.2. Backend Application Test Suite (100% PASS, 206/206 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests` tại `C:\Dev\hotel-saas-v2`
- **Kết quả:** **206 passed (206), Exit Code: 0**
  - Bao gồm toàn bộ 12 test cases trong `P3_StayLifecycleFsmTests.cs` (PASS):
    - 9 baseline FSM transitions & exception cases.
    - 3 concurrency barrier integration tests (`Concurrency_TestA`, `Concurrency_TestB`, `Concurrency_TestC`).

### 2.3. Backend WebApi HTTP Integration Pipeline Gate (100% PASS, 44/44 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.WebApi.Tests` tại `C:\Dev\hotel-saas-v2`
- **Kết quả:** **44 passed (44), Exit Code: 0**
  - `StayLifecycleHttpPipelineTests.cs`: **1/1 Fact PASS** (toàn bộ 10 bước E2E HTTP pipeline bao gồm kiểm thử ma trận phân quyền 403 Forbidden cho `CheckInOutOnly`, `ReservationsOnly`, và `ReadOnly`).

---

## 3. Danh sách Files Chỉnh sửa trong Round 2

1. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs): Áp dụng lock-first entity tracking pattern (AsNoTracking lookup $\to$ Lock $\to$ tracked reload).
2. [`backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs): Áp dụng lock-first entity tracking pattern.
3. [`backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Reservations/Commands/CancelReservation/CancelReservationCommandHandler.cs): Áp dụng lock-first entity tracking pattern.
4. [`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs): Khôi phục chính xác phân quyền contract (`CHECK_IN_OUT` cho check-in/out, `RESERVATIONS` cho cancel).
5. [`frontend/src/app/features/reservations/reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts): Tách `canCheckInOut` và `canCancel`, thêm `cancelModalTargetPropertyId`, `lifecycleRequestId`, double-submit guards và cleanup khi đổi chi nhánh.
6. [`frontend/src/app/features/reservations/reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts): Mocks và 29 unit tests kiểm thử phân quyền độc lập, double-submit, branch context guard.
7. [`backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Reservations/P3_StayLifecycleFsmTests.cs): Thêm 3 test cases concurrency với barrier và ranh giới DbContext riêng biệt.
8. [`backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/StayLifecycleHttpPipelineTests.cs): Thêm seed role CheckInOutOnly, ReservationsOnly và kiểm thử HTTP 403 Forbidden khi thiếu quyền.

---

## 4. Cam kết & Chuyển giao Điều phối
- Giữ nguyên quy định: không can thiệp DB dev/staging/prod, mọi integration test chạy trên test DB cô lập `hotel_saas_p1b01a_test` với schema GUID tự động drop sau test.
- Không chạm vào code Housekeeping của bạn Nguyên hoặc Rooms của bạn Tân.
- Cập nhật `task.json`: `round: 2`, `status: "Submitted"`, `writer: "none"`, `submissionId: "sub-p3-stay-lifecycle-01-r2-20261010"`.
- Bàn giao quyền review Round 2 cho reviewer Codex.

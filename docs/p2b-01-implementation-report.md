# Báo cáo Thực thi & Nghiệm thu Giai đoạn P2B-01: Hardening CRUD Room/RoomType, State Machine Buồng phòng & Concurrency Protection

> **Giai đoạn:** P2B-01 (Backend Gate: Hardening CRUD Room/RoomType, Housekeeping State Machine, Atomic Optimistic Concurrency, Branch Scope Immutability, Active Booking Retention Guards, và E2E WebApplicationFactory HTTP Testing)  
> **Ngày thực hiện:** 2026-10-08  
> **Môi trường thử nghiệm:** PostgreSQL Test Database độc lập (`hotel_saas_p1b01a_test`, Dedicated Schemas `p2b01_test_*` và `p1b02b_http_*`)  
> **Ranh giới tuân thủ:** 0 migration mới, 0 thay đổi schema DB, DB dev/prod (`hotel_saas_dev`) được bảo vệ 100% nguyên vẹn; chưa triển khai Quote Engine, Rate Table hay Booking Reservation Lifecycle của Phase P2B-02/P3; P2B-01 là backend gate độc lập theo đúng chỉ đạo của PO.

---

## 1. Tóm tắt Đồng bộ Thiết kế P2A Theo Quyết định PO Đã Duyệt

Tài liệu `docs/p2a-room-pricing-design.md` đã được cập nhật lên phiên bản 2.2, phản ánh đầy đủ và nhất quán các quyết định nghiệp vụ đã chốt của PO:

1. **Hình thức lưu trú MVP:** Theo ngày/đêm và Theo giờ.
2. **Thuê theo ngày/đêm:** Khung check-in / check-out mặc định là 12:00 – 12:00 hôm sau, có thể cấu hình linh hoạt theo từng chi nhánh; không tính theo chu kỳ 24 giờ kể từ lúc khách đến. Khách ở từ ngày 10 đến ngày 13 tính tròn 3 đêm, đơn giá bằng tổng giá hiệu lực của từng đêm riêng biệt. Khách nhận phòng muộn không được tự động giảm giá phòng của đêm đó.
3. **Phụ thu nhận sớm / trả muộn:** Bắt buộc có chính sách phụ thu riêng. Nếu cơ sở chưa cấu hình bảng phụ thu, backend **fail-closed** và ném lỗi `ERR_SURCHARGE_NOT_CONFIGURED`, tuyệt đối không tự suy diễn hoặc đoán phí.
4. **Không triển khai gói qua đêm ngắn riêng hoặc thuê tháng** trong phạm vi MVP.
5. **Turnover buffer (thời gian dọn phòng):** Tối thiểu 30 phút, chi nhánh chỉ có quyền tăng thời gian này; khi hết buffer, hệ thống **không tự động chuyển phòng thành Clean** mà giữ nguyên trạng thái buồng phòng, bắt buộc nhân viên buồng phòng phải kiểm tra thực tế và cập nhật.
6. **Làm tròn số tiền:** Sử dụng phương pháp `MidpointRounding.AwayFromZero`, đồng tiền VND làm tròn đến 1 đồng.
7. **Bảng giá versioned:** Lưu trữ giá theo bảng rate version riêng biệt (`RoomTypeRates` và `RoomTypeRateAudits`).
8. **Thiếu bảng giá hiệu lực:** Hệ thống **fail-closed** từ chối tạo báo giá (`ERR_RATE_NOT_FOUND`), không tự ý fallback về `BasePrice`.
9. **Thuê theo giờ:** Cho phép mọi khoảng thời gian dương (> 0 phút), thu tối thiểu theo gói sàn cơ bản của phòng.
10. **Dung sai walk-in:** Cho phép dung sai hồi tố tối đa 30 phút cho khách vãng lai nhận phòng tức thời.
11. **Ghi nhận blocker P2B-02:** Thời lượng tối đa của một lượt thuê giờ (Max Hourly Duration) trước khi chuyển sang tính theo ngày được ghi nhận là blocker chờ PO phê duyệt trước khi lập trình Quote Engine.
12. **Cơ chế Rollback an toàn:** Script rollback kiểm tra dữ liệu bằng `current_schema()`, fail-closed nếu bảng có dữ liệu thực, sử dụng composite foreign key `ON DELETE RESTRICT` để chống drop âm thầm.
13. **Vị trí P2B-01:** Được xác định là **Backend Gate** của giai đoạn P2, không cấu thành nghiệm thu toàn bộ Phase P2.

---

## 2. Chi tiết Kỹ thuật Triển khai Giai đoạn P2B-01

### 2.1. State Machine Buồng phòng (`RoomStatusTransitionValidator.cs`)
- Đặt tại `backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs`.
- Ma trận chuyển trạng thái hợp lệ:
  - `Clean` $\to$ `Dirty`, `Cleaning`, `OutOfService`
  - `Dirty` $\to$ `Cleaning`, `OutOfService`
  - `Cleaning` $\to$ `Clean`, `Dirty`, `OutOfService`
  - `OutOfService` $\to$ `Dirty` (bắt buộc qua `Dirty` để quy trình buồng phòng ghi nhận dọn dẹp)
- Ràng buộc bất biến:
  - Trạng thái `Occupied` được bảo vệ tuyệt đối: nghiệp vụ vận hành buồng phòng không được chuyển sang hoặc chuyển từ `Occupied`. Trạng thái này chỉ được cập nhật thông qua quy trình Check-in và Check-out (Phase P3).
  - Không được chuyển trực tiếp từ `Dirty` sang `Clean` (bắt buộc phải qua `Cleaning`).
  - Vi phạm ném `BadRequestException("ERR_INVALID_STATUS_TRANSITION")`.

### 2.2. Atomic Optimistic Concurrency Cập Nhật Trạng thái (`UpdateRoomStatusCommandHandler.cs`)
- Phương thức raw SQL có tham số hóa `UpdateRoomStatusAtomicAsync` trong `ApplicationDbContext`:
  ```sql
  UPDATE "Rooms"
  SET "Status" = {newStatus}, "UpdatedAtUtc" = {nowUtc}
  WHERE "Id" = {roomId} AND "TenantId" = {tenantId} AND "PropertyId" = {propertyId} AND "Status" = {expectedOldStatus}
  ```
- **Không dựa vào Query Filter hay SaveChanges Interceptor cho Raw SQL**: Các điều kiện `"TenantId" = {tenantId}` và `"PropertyId" = {propertyId}` được ràng buộc hiển thị trực tiếp trong câu lệnh `WHERE` của SQL tham số hóa.
- **Bắt buộc `ExpectedOldStatus` (Finding 1):** `ExpectedOldStatus` là trường bắt buộc trong cả HTTP request, FluentValidation validator, và Command Handler; tuyệt đối **không fallback** về trạng thái trong DB (`room.Status`). Nếu client thiếu `ExpectedOldStatus`, hệ thống trả ngay HTTP 400 `ERR_VALIDATION` mà không thực hiện bất kỳ mutation nào. Nếu `ExpectedOldStatus` không khớp với trạng thái trong DB (hoặc số bản ghi raw SQL affected = 0), handler ném ngay HTTP 409 `ConflictException("ERR_STALE_STATE")`.
- Sử dụng `.AsNoTracking()` khi tra cứu ban đầu để loại bỏ nguy cơ lưu cache entity cũ trong EF Core ChangeTracker.

### 2.3. Hardening CRUD Room & Scope Immutability (`UpdateRoomCommandHandler.cs`, `DeleteRoomCommandHandler.cs`)
- **Bất biến Scope (`PropertyId` & `TenantId`):** `UpdateRoom` không cho phép đổi `PropertyId`. Nếu header `X-Property-Id` hoặc `PropertyId` trong lệnh không khớp với chi nhánh thực của phòng, ném HTTP 400 `BadRequestException("ERR_CONTEXT_MISMATCH")`.
- **Ràng buộc Loại phòng cùng Chi nhánh:** Không được gán loại phòng thuộc chi nhánh khác vào phòng của chi nhánh hiện tại. Vi phạm ném HTTP 409 `ConflictException("ERR_PROPERTY_MISMATCH")`.
- **Duy nhất Số phòng theo Chi nhánh & Mapping Lỗi Postgres (Finding 3):** Kiểm tra trùng `RoomNumber` trong cùng chi nhánh; cập nhật giữ nguyên số phòng cũ được chấp nhận, trùng với phòng khác trong chi nhánh ném HTTP 409 `ConflictException("ERR_CONFLICT")`. Khi xảy ra concurrent race khiến 2 transaction đồng thời insert cùng số phòng, PostgreSQL vi phạm unique constraint `UX_Room_PropertyId_RoomNumber` (SQLSTATE `23505`). EF Core `ApplicationDbContext.SaveChangesAsync` và `ExceptionHandlingMiddleware` bắt đúng tên constraint này và map thành HTTP 409 `ERR_CONFLICT` ("Số phòng đã tồn tại trong chi nhánh này."). Mọi `DbUpdateException` khác không thuộc whitelist constraint này vẫn được giữ nguyên để trả HTTP 500 `ERR_SYSTEM`.
- **Quy tắc Xóa Phòng Bảo vệ Dữ liệu:**
  - Nếu phòng có đặt phòng đang hoạt động (`ReservationStatus.Confirmed`, `CheckedIn`, `PendingPayment`): ném HTTP 409 `ConflictException("ERR_ROOM_HAS_ACTIVE_BOOKINGS")`.
  - Nếu phòng có đặt phòng trong lịch sử (`CheckedOut`, `Cancelled`): thực hiện **Soft Delete** (`room.IsActive = false`), giữ nguyên bản ghi phòng trong DB để bảo toàn toàn vẹn khóa ngoại composite `FK_Reservations_Rooms_Property_Room`.
  - Nếu phòng chưa từng có đặt phòng: thực hiện **Hard Delete** (xóa bản ghi khỏi DB).

### 2.4. Hardening CRUD RoomType (`UpdateRoomTypeCommandHandler.cs`, `DeleteRoomTypeCommandHandler.cs`)
- **Duy nhất Mã Loại phòng theo Chi nhánh & Mapping Lỗi Postgres (Finding 3):** Mã `Code` phải duy nhất trong phạm vi từng chi nhánh (`PropertyId`). Khi xảy ra concurrent race khiến 2 transaction cùng insert/update trùng code trong cùng chi nhánh, PostgreSQL vi phạm unique constraint `UX_RoomType_PropertyId_Code` (SQLSTATE `23505`), được map chọn lọc thành HTTP 409 `ERR_CONFLICT` ("Mã loại phòng đã tồn tại trong chi nhánh này.").
- **Bảo vệ Loại phòng Đang Sử dụng:** Không được xóa loại phòng nếu đang có phòng liên kết (`_context.Rooms.AnyAsync(...)`). Vi phạm ném HTTP 409 `ConflictException("ERR_ROOMTYPE_IN_USE")`. Loại phòng không có phòng liên kết được phép xóa hoàn toàn.

### 2.5. Fail-Closed Bảo Mật & Xác Thực Membership
- Mọi thao tác ghi (`CreateRoom`, `UpdateRoom`, `UpdateRoomStatus`, `DeleteRoom`, `CreateRoomType`, `UpdateRoomType`, `DeleteRoomType`) đều gọi bắt buộc `ResolveMembershipAsync` từ `IMembershipLookupService` xác thực quyền hạn trên chi nhánh đích.
- Nhân viên bị thu hồi quyền tại chi nhánh ném HTTP 403 `ForbiddenException("ERR_MEMBERSHIP_REVOKED")`.
- Thiếu `TenantId` hoặc `UserId` ném HTTP 401 `UnauthorizedAccessException` ngay đầu xử lý.

---

## 3. Bảng Mapping Khắc Phục 3 Findings Của Reviewer

| Finding # | Yêu cầu Reviewer | Source Implementation | Test Coverage |
| :--- | :--- | :--- | :--- |
| **Finding 1** | Bắt buộc `ExpectedOldStatus` trong HTTP request & command validation; không fallback sang trạng thái DB; thiếu trả 400 không mutation, stale trả 409 `ERR_STALE_STATE`. | - `UpdateRoomStatusCommandValidator.cs`: RuleFor `ExpectedOldStatus` bắt buộc `.NotNull().IsInEnum()`.<br>- `UpdateRoomStatusCommandHandler.cs`: Xóa fallback `?? room.Status`; kiểm tra `!request.ExpectedOldStatus.HasValue` $\to$ ném 400 `ERR_VALIDATION`. So sánh `expectedOldStatus != room.Status` $\to$ ném 409 `ERR_STALE_STATE`.<br>- `RoomsController.cs`: Validate bắt buộc trước khi gửi mediator.<br>- `UpdateRoomStatusRequest.cs`: Đánh dấu `ExpectedOldStatus` là bắt buộc. | - `UpdateRoomStatusCommandValidatorTests.cs` (5 tests unit).<br>- `BootstrapHttpPipelineWebApplicationFactoryTests.cs` (Step 6d: thiếu `expectedOldStatus` trả 400 `ERR_VALIDATION`, 0 DB mutation; Step 6c: stale trả 409 `ERR_STALE_STATE`).<br>- `P2B01_RoomAndRoomTypeHardeningTests.cs` (`UpdateRoomStatus_WhenExpectedOldStatusDoesNotMatch_ThrowsConflictException`). |
| **Finding 2** | Thay test race tuần tự bằng hai DbContext/kết nối đồng thời; dùng barrier điều phối để cả 2 đã đọc `Dirty` trước khi atomic UPDATE; xác nhận đúng 1 thành công, 1 `ERR_STALE_STATE` và trạng thái DB cuối; không dùng delay làm bằng chứng duy nhất. | - `P2B01_RoomAndRoomTypeHardeningTests.cs`: Tạo `BarrierSynchronizedMembershipLookupService` sử dụng `System.Threading.Barrier(2)` điều phối.<br>- Điều phối điểm hẹn chính xác: cả 2 handler đều đã load thành công phòng `Dirty` từ DB (Bước 1) và đến rào chắn trước khi bất kỳ handler nào thực thi câu lệnh raw SQL `UPDATE` (Bước 7). | - `P2B01_RoomAndRoomTypeHardeningTests.cs` (`UpdateRoomStatus_TwoConnectionsConcurrencyRace_OneWinsAndOneReceivesStaleState`): Chạy 2 `Task.Run` đồng thời qua `Barrier(2)`. Khẳng định: đúng 1 winner thành công, đúng 1 loser nhận 409 `ERR_STALE_STATE`, và DB cuối cùng ghi nhận chính xác trạng thái của winner. |
| **Finding 3** | Map unique violations 23505 của đúng các constraints `UX_Room_PropertyId_RoomNumber` và `UX_RoomType_PropertyId_Code` sang HTTP 409 `ERR_CONFLICT`; không biến mọi `DbUpdateException` thành 409; thêm tests concurrent uniqueness và kiểm chứng HTTP error mapping. | - `ApplicationDbContext.cs`: Wrap `base.SaveChangesAsync`; `TryGetPostgresUniqueViolation` kiểm tra `SqlState == "23505"`; chỉ map đúng 2 constraints `UX_Room_PropertyId_RoomNumber` và `UX_RoomType_PropertyId_Code` thành `ConflictException("ERR_CONFLICT", ...)`. Các exception khác giữ nguyên.<br>- `ExceptionHandlingMiddleware.cs`: Bắt `DbUpdateException` có PostgreSQL 23505 với đúng 2 constraints trên map sang HTTP 409; các lỗi khác (FK `23503`, constraint khác) rơi vào 500 `ERR_SYSTEM`. | - `P2B01_RoomAndRoomTypeHardeningTests.cs`:<br>  + `CreateRoom_ConcurrentDuplicateRoomNumber_OneWinsOneReceivesConflict`: 2 kết nối insert cùng số phòng qua `Barrier(2)`, 1 winner, 1 nhận 409 `ERR_CONFLICT`, DB chỉ có 1 phòng.<br>  + `CreateRoomType_ConcurrentDuplicateCode_OneWinsOneReceivesConflict`: 2 kết nối insert cùng mã code qua `Barrier(2)`, 1 winner, 1 nhận 409 `ERR_CONFLICT`, DB chỉ có 1 room type.<br>- `ExceptionHandlingMiddlewareTests.cs` (4 unit tests):<br>  + `WhenPostgresUniqueViolation_RoomNumberConstraint_ReturnsHttp409Conflict`<br>  + `WhenPostgresUniqueViolation_RoomTypeCodeConstraint_ReturnsHttp409Conflict`<br>  + `WhenPostgresUniqueViolation_OtherConstraint_ReturnsHttp500SystemError`<br>  + `WhenPostgresForeignKeyViolation_ReturnsHttp500SystemError` |

---

## 4. Kết quả Kiểm thử Toàn Solution (176/176 tests PASS, 100% GREEN)

```text
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Domain.Tests\bin\Debug\net10.0\HotelSaas.Domain.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed:   1, Skipped: 0, Total:   1, Duration: 36 ms - HotelSaas.Domain.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\bin\Debug\net10.0\HotelSaas.WebApi.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed:  40, Skipped: 0, Total:  40, Duration: 11 s - HotelSaas.WebApi.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\bin\Debug\net10.0\HotelSaas.Application.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed: 135, Skipped: 0, Total: 135, Duration: 1 m 53 s - HotelSaas.Application.Tests.dll (net10.0)

Total: 176 Passed / 176 Total (100% GREEN)
Exit Code: 0
```

---

## 5. Kết luận & Trạng thái Bàn giao

- Cả 3 findings của Reviewer cho giai đoạn **P2B-01 (Hardening CRUD Room/RoomType, State Machine Buồng phòng & Concurrency Protection)** đã được giải quyết triệt để, có đầy đủ bằng chứng kiểm thử trên cả unit tests, middleware tests, PostgreSQL concurrency integration tests và ASP.NET Core WebApplicationFactory HTTP tests.
- Hệ thống đạt **176/176 tests xanh (100% GREEN)**.
- Ranh giới kiến trúc được bảo toàn nguyên vẹn: 0 migration, 0 thay đổi schema DB, không đụng chạm DB dev/prod (`hotel_saas_dev`), không triển khai trước pricing/Quote Engine/UI.
- Dừng lại tại đây để chờ Reviewer kiểm tra và nghiệm thu gói P2B-01.

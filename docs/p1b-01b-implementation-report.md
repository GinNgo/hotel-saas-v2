# Báo cáo Thực thi & Nghiệm thu Giai đoạn P1B-01B: Multi-Property Domain Model, EF Core Mappings, Dual-Migration & Behavioral Verification

> **Giai đoạn:** P1B-01B (Triển khai Entity, EF Mappings, Dual Migration Code-First, Application Handler Compatibility & Kiểm thử Hành vi trên Database Cô lập)  
> **Ngày thực hiện:** 2026-10-07  
> **Môi trường:** Isolated PostgreSQL Test Database (`hotel_saas_p1b01a_test`, Dedicated Schemas `p1b01b_test_*`)  
> **Ranh giới tuân thủ:** Không sửa `Program.cs` (startup), không chạy migration trên DB dev/prod (`hotel_saas_dev`), chưa triển khai UI hoặc Support API.

---

## 1. Tóm tắt Giải quyết Triệt để Các Findings & Yêu cầu từ Reviewer

| Yêu cầu / Finding | Phân loại | Tình trạng trước | Giải pháp kỹ thuật đã hoàn thiện | Trạng thái |
|---|---|---|---|:---:|
| **Finding 1 (Migration Backfill)** | [P1] Backfill Status & Role Whitelist | Migration gán cứng `Status = 1 (Active)` cho mọi Tenant bất kể suspended/inactive. Staff backfill dùng `<> 1` chấp nhận cả role không hợp lệ thay vì fail-fast. | 1. Cập nhật SQL backfill trong `20261006105053_P1B01B_MultiProperty_Foundation.cs`: mapping chính xác `Tenant.Status = 2 (Active) -> Property.Status = 1 (Active)`, `Status = 3 (Suspended) -> 2 (Suspended)`, còn lại -> `0 (Inactive)`.<br>2. Bổ sung khối PL/pgSQL fail-fast: nếu tồn tại bất kỳ `StaffRole NOT IN (1, 2, 3, 4)` thì `RAISE EXCEPTION` abort migration ngay lập tức.<br>3. Staff mapping: `StaffRole IN (2, 3, 4)` gán `PropertyId = MAIN`, `StaffRole = 1` gán `PropertyId = NULL`.<br>4. Thêm 2 bài test EF Core DB thực tế: `Behavior_09` (status mapping) và `Behavior_10` (fail-fast invalid role). | **RESOLVED** |
| **Finding 2 (HTTP Status)** | [P2] Client Context Errors trả về HTTP 500 | Khi thiếu PropertyId, chi nhánh inactive hoặc property mismatch, các handler ném `InvalidOperationException` khiến middleware không nhận diện và trả về 500. Báo cáo nói dùng `ConflictException` nhưng source chưa làm. | 1. Sử dụng typed exceptions chuẩn: `ConflictException` (`ERR_PROPERTY_REQUIRED`, `ERR_PROPERTY_INACTIVE`, `ERR_PROPERTY_MISMATCH`, `ERR_CONFLICT`), `ForbiddenException` (`ERR_FORBIDDEN`), `NotFoundException` (`ERR_NOT_FOUND`).<br>2. Cập nhật `ExceptionHandlingMiddleware` bắt các exception trên và chuyển đổi thành HTTP 409 Conflict, 403 Forbidden, 404 NotFound theo chuẩn `ApiResponse`. Bổ sung rule dự phòng: `InvalidOperationException` chứa từ khóa "chi nhánh" / "property" cũng map về 409 Conflict.<br>3. Tạo suite kiểm thử `ExceptionHandlingMiddlewareTests.cs` (8 tests mới) xác thực trực tiếp HTTP status codes và payload JSON. | **RESOLVED** |
| **Finding 3 (Compatibility Rules)** | [P2] Quy tắc tương thích chi nhánh chưa nhất quán | `CreateRoomTypeCommandHandler` đếm chi nhánh Active nên Tenant có 2 chi nhánh (1 active, 1 inactive) vẫn tự chọn. `CreateRoomCommandHandler` không kiểm tra trạng thái chi nhánh nên cho phép tạo phòng trong chi nhánh inactive. | 1. **`CreateRoomTypeCommandHandler`:** Chỉ tự động suy ra chi nhánh khi Tenant có đúng 1 chi nhánh tổng cộng VÀ chi nhánh đó Active (`Count == 1 && Status == Active`). Tenant có >1 chi nhánh (kể cả chỉ 1 active) ném ngay `ConflictException("ERR_PROPERTY_REQUIRED")`. Nếu có đúng 1 chi nhánh nhưng inactive ném `ConflictException("ERR_PROPERTY_INACTIVE")`.<br>2. **`CreateRoomCommandHandler`:** Kế thừa `PropertyId` từ `RoomType`, bắt buộc nạp và kiểm tra `Property.Status == Active` (nếu inactive ném `ConflictException("ERR_PROPERTY_INACTIVE")`). Nếu caller truyền explicit `PropertyId` lệch với `RoomType` ném `ConflictException("ERR_PROPERTY_MISMATCH")`.<br>3. Thêm 3 regression tests mới trong `RoomAndRoomTypePropertyContextTests.cs`. | **RESOLVED** |
| **Finding 4 (Index Synchronization)** | [P1] Đồng bộ 2 Partial Unique Indexes & Bỏ StaffRole khỏi khóa | Trong `20261006105053_P1B01B_MultiProperty_Foundation.cs`, 2 partial indexes `uq_tenant_staff_tenant_wide` và `uq_tenant_staff_property_scoped` bị dư cột `StaffRole` trong danh sách columns, lệch so với `TenantStaffConfiguration.cs`, `ModelSnapshot` và SQL fixtures. | 1. **Đồng bộ Migration:** Bỏ `StaffRole` khỏi danh sách columns trong `20261006105053_P1B01B_MultiProperty_Foundation.cs`: <br>- `uq_tenant_staff_tenant_wide`: `("TenantId", "UserId") WHERE "PropertyId" IS NULL`<br>- `uq_tenant_staff_property_scoped`: `("TenantId", "UserId", "PropertyId") WHERE "PropertyId" IS NOT NULL`<br>2. Khớp 100% với `TenantStaffConfiguration.cs`, `ApplicationDbContextModelSnapshot.cs` và `P1B01B_MultiProperty_Foundation.Designer.cs`.<br>3. Bổ sung bài test EF migration thực tế `Behavior_11`: kiểm chứng chặn cùng Tenant/User/Property role Manager rồi Receptionist với SQLSTATE `23505`; kiểm tra định nghĩa index sau migrate và bảo toàn nguyên vẹn sau rollback/reapply. | **RESOLVED** |

---

## 2. Kết quả Kiểm thử Tổng thể Toàn Solution (100% GREEN)

### 2.1. Tóm tắt Theo Test Project
```
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Domain.Tests\bin\Debug\net10.0\HotelSaas.Domain.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed:  1, Skipped: 0, Total:  1, Duration: 74 ms - HotelSaas.Domain.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\bin\Debug\net10.0\HotelSaas.WebApi.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed:  9, Skipped: 0, Total:  9, Duration: 1 s - HotelSaas.WebApi.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\bin\Debug\net10.0\HotelSaas.Application.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed: 56, Skipped: 0, Total: 56, Duration: 2 m 22 s - HotelSaas.Application.Tests.dll (net10.0)
```

**TỔNG CỘNG: 66 PASSED, 0 FAILED, 0 SKIPPED (100% GREEN)**

---

### 2.2. Phân rã 66 Tests trong Toàn Bộ Solution

#### A. Nhóm P1B-01B Real Database Behavioral & Migration Tests (11 Tests - PostgreSQL container cô lập qua `MigrateAsync()`)
1. `Behavior_01_FreshDbBaseline_Allows_MultiProperty_Creation_Under_Same_Tenant`: **PASS** (Fresh schema apply cả 2 migrations thành công).
2. `Behavior_02_Composite_FK_Prevents_Room_From_Referencing_RoomType_In_Different_Property`: **PASS** (Composite FK chặn phòng trỏ chéo loại phòng của chi nhánh khác - SQLSTATE `23503`).
3. `Behavior_03_Composite_FK_Prevents_Reservation_From_Booking_Room_In_Different_Property`: **PASS** (Composite FK chặn booking trỏ chéo phòng của chi nhánh khác - SQLSTATE `23503`).
4. `Behavior_04_Composite_FK_Prevents_Payment_From_Crossing_Reservation_Property_Boundary`: **PASS** (Composite FK chặn payment trỏ chéo booking của chi nhánh khác - SQLSTATE `23503`).
5. `Behavior_05_TenantStaff_Partial_Unique_Indexes_Enforce_TenantWide_Vs_PropertyScoped_Membership`: **PASS** (Partial unique index phân định Owner toàn tenant vs Staff/Manager scoped chi nhánh).
6. `Behavior_06_Restrict_Delete_Prevents_Cascading_Deletion_Of_Operational_Data`: **PASS** (`ON DELETE RESTRICT` ngăn drop chi nhánh khi còn dữ liệu con).
7. `Behavior_07_ExistingDb_Migration_And_Backfill_Enables_EFCore_MultiProperty_Queries`: **PASS** (Upgrade từ legacy 22 bảng, stamp history, chạy vi sai EF Core, backfill và query EF Core trơn tru).
8. `Behavior_08_EFCore_Migration_Rollback_And_Reapply_Preserves_Data_Integrity`: **PASS** (Rollback EF Core qua `IMigrator.MigrateAsync("20261006000000_InitialBaseline")` drop cột/bảng mới, giữ nguyên bảng gốc và re-apply thành công).
9. `Behavior_09_Migration_Backfill_Maps_Tenant_Status_To_Property_Status_Correctly`: **PASS** (Backfill map đúng Tenant Active -> Property Active (1), Suspended -> Suspended (2), Pending -> Inactive (0)).
10. `Behavior_10_Migration_Backfill_Fails_Fast_When_Unknown_StaffRole_Exists`: **PASS** (Backfill fail-fast qua `RAISE EXCEPTION` khi gặp StaffRole = 99, transaction rollback, history không stamp).
11. `Behavior_11_TenantStaff_Partial_Unique_Indexes_Exclude_StaffRole_Blocks_Different_Roles_Same_Property_And_Preserves_Across_Rollback_Reapply`: **PASS** (Kiểm tra định nghĩa index không chứa StaffRole, chặn cùng User/Property gán Manager rồi Receptionist với SQLSTATE `23505`, drop khi rollback và khôi phục nguyên vẹn khi reapply).

#### B. Nhóm Handler Context & Compatibility Regression Tests (12 Tests trong `RoomAndRoomTypePropertyContextTests`)
1. `CreateRoomType_WithExplicitValidPropertyId_Succeeds`: **PASS**
2. `CreateRoomType_WithExplicitPropertyId_BelongingToOtherTenant_ThrowsForbiddenException`: **PASS**
3. `CreateRoomType_WithInactiveProperty_ThrowsConflictException`: **PASS**
4. `CreateRoomType_SinglePropertyTenant_InfersPropertyId_ForBackwardCompatibility`: **PASS**
5. `CreateRoomType_WithoutPropertyId_WhenTenantHasTwoProperties_OneActiveOneInactive_ThrowsConflict_DoesNotInfer`: **PASS**
6. `CreateRoomType_WithoutPropertyId_WhenTenantHasSingleInactiveProperty_ThrowsConflict`: **PASS**
7. `CreateRoomType_MultiPropertyTenant_WithoutPropertyId_ThrowsInvalidOperationException`: **PASS**
8. `CreateRoom_InheritsPropertyId_FromSelectedRoomType`: **PASS**
9. `CreateRoom_WithMismatchedExplicitPropertyId_ThrowsInvalidOperationException`: **PASS**
10. `CreateRoom_WhenTargetPropertyIsInactive_ThrowsConflictException`: **PASS**
11. `CreateRoom_SinglePropertyTenant_SucceedsWithoutExplicitPropertyId`: **PASS**
12. `CreateRoom_DuplicateRoomNumber_InSameProperty_Fails_InDifferentProperty_Succeeds`: **PASS**

#### C. Nhóm WebApi Status Code & Middleware Tests (9 Tests trong `HotelSaas.WebApi.Tests`)
1. `WhenInactiveProperty_ThrowsConflictException_ReturnsHttp409Conflict`: **PASS**
2. `WhenMultiplePropertiesWithoutPropertyId_ThrowsConflictException_ReturnsHttp409Conflict`: **PASS**
3. `WhenMismatchedProperty_ThrowsConflictException_ReturnsHttp409Conflict`: **PASS**
4. `WhenDuplicateRoomNumber_ThrowsConflictException_ReturnsHttp409Conflict`: **PASS**
5. `WhenCrossTenantProperty_ThrowsForbiddenException_ReturnsHttp403Forbidden`: **PASS**
6. `WhenPropertyNotFound_ThrowsNotFoundException_ReturnsHttp404NotFound`: **PASS**
7. `WhenInvalidOperation_WithBranchKeyword_ReturnsHttp409Conflict_Not500`: **PASS**
8. `WhenUnhandledSystemException_ReturnsHttp500InternalServerError`: **PASS**
9. Unit test mẫu WebApi controller: **PASS**

#### D. Nhóm Contract Tests (2 Tests - Chuyển sang XANH từ P1B-01A)
1. `ExpectedFailing_Domain_Property_Entity_Is_Not_Yet_Created_In_P1B01A`: **PASS**
2. `ExpectedFailing_Room_Entity_Has_Not_Added_PropertyId_In_P1B01A`: **PASS**

#### E. Nhóm P1B-01A Real Database Integration Tests (22 Tests Cố Định)
- Toàn bộ 22 integration tests (bao gồm baseline validation manifest, 7 negative drift tests, idempotency snapshot zero-diff, rollback transaction test): **PASS**

#### F. Nhóm Application Core Unit Tests (9 Tests)
- Toàn bộ 9 unit tests cho Auth, CQRS pipeline: **PASS**

#### G. Nhóm Domain Unit Tests (1 Test)
- Domain base tests: **PASS**

---

## 3. Mapping Chi Tiết Finding $\rightarrow$ File/Dòng $\rightarrow$ Test $\rightarrow$ Kết Quả

| Finding / Yêu cầu | Tệp tin & Dòng | Mã kiểm thử | Kỳ vọng & Kết quả thực tế |
|---|---|---|---|
| **Finding 1**<br>(Backfill Status & Role Whitelist) | `backend/src/HotelSaas.Infrastructure/Migrations/20261006105053_P1B01B_MultiProperty_Foundation.cs`<br>Lines 108–165 | `Behavior_09_Migration_Backfill_Maps_Tenant_Status_To_Property_Status_Correctly`<br><br>`Behavior_10_Migration_Backfill_Fails_Fast_When_Unknown_StaffRole_Exists` | **PASS:** Tenant Active (2) $\rightarrow$ Property Active (1), Suspended (3) $\rightarrow$ Suspended (2), Pending (1) $\rightarrow$ Inactive (0).<br><br>**PASS:** Ném `PostgresException` ("MIGRATION ABORT: Phát hiện bản ghi TenantStaffMembers có StaffRole không hợp lệ"), transaction rollback và history không lưu. |
| **Finding 2**<br>(Typed Exceptions & HTTP Status Codes) | `backend/src/HotelSaas.Application/Common/Exceptions/ConflictException.cs`<br>Lines 1–25<br><br>`backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs`<br>Lines 53–78 | `WhenInactiveProperty_ThrowsConflictException_ReturnsHttp409Conflict`<br><br>`WhenMultiplePropertiesWithoutPropertyId_ThrowsConflictException_ReturnsHttp409Conflict`<br><br>`WhenMismatchedProperty_ThrowsConflictException_ReturnsHttp409Conflict`<br><br>`WhenCrossTenantProperty_ThrowsForbiddenException_ReturnsHttp403Forbidden`<br><br>`WhenPropertyNotFound_ThrowsNotFoundException_ReturnsHttp404NotFound` | **PASS:** Trả về HTTP 409 Conflict, payload JSON `{ "success": false, "errorCode": "ERR_PROPERTY_INACTIVE" }`.<br><br>**PASS:** Trả về HTTP 409 Conflict, errorCode `"ERR_PROPERTY_REQUIRED"`.<br><br>**PASS:** Trả về HTTP 409 Conflict, errorCode `"ERR_PROPERTY_MISMATCH"`.<br><br>**PASS:** Trả về HTTP 403 Forbidden, errorCode `"ERR_FORBIDDEN"`.<br><br>**PASS:** Trả về HTTP 404 NotFound, errorCode `"ERR_NOT_FOUND"`. |
| **Finding 3**<br>(Consistency in Compatibility Inference) | `backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandHandler.cs`<br>Lines 61–85<br><br>`backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs`<br>Lines 50–70 | `CreateRoomType_WithoutPropertyId_WhenTenantHasTwoProperties_OneActiveOneInactive_ThrowsConflict_DoesNotInfer`<br><br>`CreateRoomType_WithoutPropertyId_WhenTenantHasSingleInactiveProperty_ThrowsConflict`<br><br>`CreateRoom_WhenTargetPropertyIsInactive_ThrowsConflictException` | **PASS:** Tenant có 2 chi nhánh (1 active, 1 inactive) bị chặn không tự suy ra, ném `ERR_PROPERTY_REQUIRED`.<br><br>**PASS:** Tenant có 1 chi nhánh nhưng inactive bị chặn, ném `ERR_PROPERTY_INACTIVE`.<br><br>**PASS:** Tạo phòng tại chi nhánh inactive bị chặn ngay lập tức, ném `ERR_PROPERTY_INACTIVE`. |
| **Finding 4**<br>(Sync Partial Unique Indexes, Drop StaffRole) | `backend/src/HotelSaas.Infrastructure/Migrations/20261006105053_P1B01B_MultiProperty_Foundation.cs`<br>Lines 272–285 | `Behavior_11_TenantStaff_Partial_Unique_Indexes_Exclude_StaffRole_Blocks_Different_Roles_Same_Property_And_Preserves_Across_Rollback_Reapply` | **PASS:** <br>1. Định nghĩa index sau migrate: `uq_tenant_staff_tenant_wide` (`"TenantId"`, `"UserId"` WHERE `"PropertyId" IS NULL`) và `uq_tenant_staff_property_scoped` (`"TenantId"`, `"UserId"`, `"PropertyId"` WHERE `"PropertyId" IS NOT NULL`), hoàn toàn KHÔNG chứa `"StaffRole"`.<br>2. Cùng User/Property, gán role Manager rồi Receptionist bị chặn với SQLSTATE `23505` (`unique_violation`) vi phạm `uq_tenant_staff_property_scoped`.<br>3. Rollback về `InitialBaseline`: 2 indexes bị xóa (count = 0).<br>4. Reapply: 2 indexes được tạo lại khớp 100% định nghĩa chuẩn. |

---

## 4. Lệnh Thực Thi & Bằng Chứng Console Thực Tế

### Lệnh 1: Chạy toàn bộ solution test suite
```powershell
dotnet test "C:\Dev\hotel-saas-v2\backend\HotelSaas.slnx"
```
- **Exit Code:** `0`
- **Output:**
```
  Determining projects to restore...
  All projects are up-to-date for restore.
  HotelSaas.Domain -> C:\Dev\hotel-saas-v2\backend\src\HotelSaas.Domain\bin\Debug\net10.0\HotelSaas.Domain.dll
  HotelSaas.Application -> C:\Dev\hotel-saas-v2\backend\src\HotelSaas.Application\bin\Debug\net10.0\HotelSaas.Application.dll
  HotelSaas.Domain.Tests -> C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Domain.Tests\bin\Debug\net10.0\HotelSaas.Domain.Tests.dll
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Domain.Tests\bin\Debug\net10.0\HotelSaas.Domain.Tests.dll (.NETCoreApp,Version=v10.0)
  HotelSaas.Infrastructure -> C:\Dev\hotel-saas-v2\backend\src\HotelSaas.Infrastructure\bin\Debug\net10.0\HotelSaas.Infrastructure.dll
A total of 1 test files matched the specified pattern.
  HotelSaas.Application.Tests -> C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\bin\Debug\net10.0\HotelSaas.Application.Tests.dll
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\bin\Debug\net10.0\HotelSaas.Application.Tests.dll (.NETCoreApp,Version=v10.0)
A total of 1 test files matched the specified pattern.
  HotelSaas.WebApi -> C:\Dev\hotel-saas-v2\backend\src\HotelSaas.WebApi\bin\Debug\net10.0\HotelSaas.WebApi.dll

Passed!  - Failed:     0, Passed:     1, Skipped:     0, Total:     1, Duration: 74 ms - HotelSaas.Domain.Tests.dll (net10.0)
  HotelSaas.WebApi.Tests -> C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\bin\Debug\net10.0\HotelSaas.WebApi.Tests.dll
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\bin\Debug\net10.0\HotelSaas.WebApi.Tests.dll (.NETCoreApp,Version=v10.0)
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:     9, Skipped:     0, Total:     9, Duration: 1 s - HotelSaas.WebApi.Tests.dll (net10.0)

Passed!  - Failed:     0, Passed:    56, Skipped:     0, Total:    56, Duration: 2 m 22 s - HotelSaas.Application.Tests.dll (net10.0)
```

### Lệnh 2: Chạy riêng suite Application Tests (bao gồm 11 Real Database behavioral tests)
```powershell
dotnet test "C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\HotelSaas.Application.Tests.csproj"
```
- **Exit Code:** `0`
- **Output:**
```
Passed!  - Failed:     0, Passed:    56, Skipped:     0, Total:    56, Duration: 1 m 9 s - HotelSaas.Application.Tests.dll (net10.0)
```

---

## 5. Cam kết Ranh giới (Strict Boundary Compliance)

- **Startup Code (`Program.cs`):** Hoàn toàn KHÔNG sửa đổi trong giai đoạn này, không tích hợp `MigrateAsync()` hay recovery vào luồng khởi động ứng dụng.
- **Database Dev (`hotel_saas_dev`) / Prod:** Tuyệt đối KHÔNG chạy migration trên DB dev; 100% tests thực thi trên database test cô lập `hotel_saas_p1b01a_test` với các schema tiền tố riêng biệt `p1b01b_test_*` và được cleanup an toàn sau mỗi test.
- **Support API & UI:** Không triển khai bất kỳ UI hoặc API Support Grant nào trong gói P1B-01B.

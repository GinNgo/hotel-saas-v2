# Submission: P2-PRICING-HARDEN-01 (Round 1)

- **TaskId:** P2-PRICING-HARDEN-01
- **Round:** 1
- **SubmissionId:** sub-p2-pricing-harden-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T09:37:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Phạm vi thực hiện & Yêu cầu đã giải quyết
Thực hiện trọn vẹn yêu cầu nhiệm vụ `P2-PRICING-HARDEN-01` theo phân công PO ngày 10/10/2026 trong `assignment.md`:

1. **Quote Permission Enforcement (`ROOMS.Read` HOẶC `RESERVATIONS.Read`):**
   - Không tự sáng tạo permission `PRICING` mới.
   - Tái sử dụng và mở rộng chuẩn xác pattern Authorization hiện có thông qua `RequireAnyPermissionAttribute` và `PermissionRequirement` hỗ trợ composite OR semantics.
   - Gắn `[RequireAnyPermission("ROOMS", PermissionAction.Read, "RESERVATIONS", PermissionAction.Read)]` tại endpoint `POST /api/quotes/calculate`.
   - Đảm bảo fail-closed: người dùng không có role hoặc thiếu cả 2 quyền đều bị chặn với HTTP 403 Forbidden.

2. **Strict Membership Validation trước DML (UpdatePropertyPolicies & CreateRoomTypeRate):**
   - Cả 2 command handlers `UpdatePropertyPoliciesCommandHandler` và `CreateRoomTypeRateCommandHandler` đều được cập nhật điều kiện kiểm tra fail-closed nghiêm ngặt: **CHỈ `MembershipLookupStatus.Success` MỚI ĐƯỢC PHÉP TIẾP TỤC**.
   - Mọi trạng thái membership khác (`MembershipRevoked`, `PropertyInactive`, `PropertyForbidden`, `TenantNotFoundOrInactive`, `UserNotFoundOrInactive`, `PropertyRequired`, `NoMembership`) đều từ chối với mã lỗi nghiệp vụ phù hợp (`ERR_MEMBERSHIP_REVOKED`, `ERR_PROPERTY_INACTIVE`, `ERR_PROPERTY_FORBIDDEN`, `ERR_TENANT_INACTIVE`, `ERR_USER_DEACTIVATED`, `ERR_PROPERTY_REQUIRED`, `ERR_FORBIDDEN`) **TRƯỚC KHI THỰC HIỆN BẤT KỲ THAO TÁC DML / MUTATION NÀO**.

3. **Xác minh các quy tắc nghiệp vụ tính giá & chính sách:**
   - `RentalType`: Bắt buộc hợp lệ (`Hourly` hoặc `Overnight`), từ chối mọi giá trị ngoài enum với `BadRequestException("ERR_INVALID_RENTAL_TYPE")`, không bao giờ trả về báo giá 0 VND.
   - Biên thời gian / ngày theo múi giờ chi nhánh Asia/Ho_Chi_Minh: Kiểm tra `CheckInDate` và `CheckOutDate` khớp chính xác với `StartAtUtc` và `EndAtUtc` sau khi quy đổi sang múi giờ chi nhánh.
   - Quyết định D14: Giới hạn thời gian thuê theo giờ `MaxHourlyHours` của chi nhánh (mặc định 1–24 giờ) được kiểm tra nghiêm ngặt, vượt quá sẽ trả về HTTP 422 `ERR_HOURLY_LIMIT_EXCEEDED`.
   - Thiếu bảng giá / phụ thu fail-closed: Trả về HTTP 422 `ERR_PRICING_NOT_CONFIGURED` / `ERR_SURCHARGE_NOT_CONFIGURED`.
   - Làm tròn tiền VND theo quy tắc `MidpointRounding.AwayFromZero` trên tất cả các dòng chi tiết và tổng tiền.

4. **Tuân thủ ranh giới an toàn:**
   - Không tạo schema migration mới, không deploy, không tác động cơ sở dữ liệu dev/prod/staging.

---

## 2. Files thay đổi & Tạo mới

### Backend Source Files:
- **`backend/src/HotelSaas.WebApi/Authorization/RequireAnyPermissionAttribute.cs`** *(Tạo mới)*:
  Attribute khai báo yêu cầu quyền tổng hợp dạng OR (`IAuthorizationRequirementData`).
- **`backend/src/HotelSaas.WebApi/Authorization/PermissionRequirement.cs`** *(Cập nhật)*:
  Hỗ trợ danh sách quyền thay thế (`AlternativePermissions`) với logic OR.
- **`backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs`** *(Cập nhật)*:
  Xử lý đánh giá `AlternativePermissions` qua cơ sở dữ liệu `RolePermissions`, chấp thuận khi có ít nhất một quyền hợp lệ.
- **`backend/src/HotelSaas.WebApi/Controllers/QuotesController.cs`** *(Cập nhật)*:
  Áp dụng `[RequireAnyPermission("ROOMS", PermissionAction.Read, "RESERVATIONS", PermissionAction.Read)]` trên `CalculateQuote`.
- **`backend/src/HotelSaas.Application/Properties/Commands/UpdatePropertyPolicies/UpdatePropertyPoliciesCommandHandler.cs`** *(Cập nhật)*:
  Ràng buộc `if (membership.Status != MembershipLookupStatus.Success)` chặn tất cả các trạng thái non-success trước khi sửa `Properties`.
- **`backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommandHandler.cs`** *(Cập nhật)*:
  Ràng buộc `if (membership.Status != MembershipLookupStatus.Success)` chặn tất cả các trạng thái non-success trước khi thêm `RoomTypeRate`.

### Test Files:
- **`backend/tests/HotelSaas.WebApi.Tests/PricingAndPoliciesHttpPipelineTests.cs`** *(Cập nhật)*:
  - Bổ sung Step 5 trong pipeline HTTP thật:
    - Step 5a: User không có `ROOMS` hoặc `RESERVATIONS` bị chặn với HTTP 403 Forbidden.
    - Step 5b: User chỉ có quyền `RESERVATIONS.Read` gọi báo giá thành công HTTP 200 OK (OR logic).
    - Step 5c: Gọi báo giá cho chi nhánh ngoài phạm vi token bị chặn với HTTP 400 (`ERR_CONTEXT_MISMATCH`).
- **`backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`** *(Cập nhật)*:
  - Thêm `Finding6_UpdatePropertyPolicies_AllNonSuccessMembershipStatuses_FailClosed_WithoutDml`: Kiểm tra toàn bộ 7 trạng thái non-success bị từ chối và kiểm tra DB không bị biến đổi policy.
  - Thêm `Finding7_CreateRoomTypeRate_AllNonSuccessMembershipStatuses_FailClosed_WithoutDml`: Kiểm tra toàn bộ 7 trạng thái non-success bị từ chối và kiểm tra DB không bị chèn bản ghi rate mới.

---

## 3. Kết quả kiểm thử & Exit Codes

1. **Biên dịch toàn bộ Solution Backend (`HotelSaas.slnx`):**
   - Command: `dotnet build C:\Dev\hotel-saas-v2\backend\HotelSaas.slnx`
   - **Kết quả: 0 Warning(s), 0 Error(s)**, **Exit Code: 0**.

2. **HTTP Pipeline End-to-End Tests (`PricingAndPoliciesHttpPipelineTests`):**
   - Command: `dotnet test C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\HotelSaas.WebApi.Tests.csproj --filter "FullyQualifiedName~PricingAndPoliciesHttpPipelineTests"`
   - **Kết quả: 1/1 PASSED** (Bao gồm đầy đủ 5 steps: Policies, Rates, Quotes calculation, Surcharges, Quote OR Authorization & Branch Isolation), **Exit Code: 0**.

3. **Application Pricing Tests (`P2B02_ReviewerFindingsRegressionTests` & `QuoteEngineCalculationTests`):**
   - Command: `dotnet test C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Pricing"`
   - **Kết quả: 25/25 PASSED**, **Exit Code: 0**.

4. **Frontend Unit Tests Regression:**
   - Command: `vitest run src/app/features/housekeeping/housekeeping.page.spec.ts src/app/core/utils/date-time.util.spec.ts src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`
   - **Kết quả: 48/48 PASSED**, **Exit Code: 0**.

---

## 4. Evidence (Bằng chứng)

- `dotnet build HotelSaas.slnx`: Succeeded (0 Errors, 0 Warnings).
- `dotnet test HotelSaas.WebApi.Tests (PricingAndPoliciesHttpPipelineTests)`: 1/1 PASS (Exit code 0).
- `dotnet test HotelSaas.Application.Tests (Pricing)`: 25/25 PASS (Exit code 0).
- `vitest Frontend`: 48/48 PASS (Exit code 0).
- Tiến trình WebApi daemon tại port 5283 và Angular dev server tại port 4200 đang chạy ổn định.

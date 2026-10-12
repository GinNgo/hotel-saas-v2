# Báo cáo Thực thi & Nghiệm thu Giai đoạn P1B-02B: Context & Authorization Hardening, Deterministic Resolution, Mutation Concurrency Guards, Unified JWT Key Validation & WebApplicationFactory HTTP Testing

> **Giai đoạn:** P1B-02B (Context & Authorization Hardening, Fail-Closed Global Query Filters, Mutation Guards, Refresh Token Rotation with Row-Level Locking, Unified JWT Key Fail-Fast Validation, và WebApplicationFactory HTTP Pipeline Testing)  
> **Ngày thực hiện:** 2026-10-08  
> **Môi trường:** Isolated PostgreSQL Test Database (`hotel_saas_p1b01a_test`, Dedicated Schemas `p1b02b_test_*` và `p1b02b_http_*`)  
> **Ranh giới tuân thủ:** 0 migration mới, không đổi schema, không migrate DB dev/prod (`hotel_saas_dev`), test host có cờ `SkipStartupDatabaseInit` ngăn chặn tuyệt đối startup seeding/migration trên DB dev/prod, chưa triển khai UI hoặc Support API.

---

## 1. Tóm tắt Giải quyết Triệt để Các Findings & Yêu cầu từ Reviewer

| Yêu cầu / Finding | Phân loại | Tình trạng trước | Giải pháp kỹ thuật đã hoàn thiện | Trạng thái |
|---|---|---|---|:---:|
| **Finding 1: Membership Validation Fail-Closed** | [P1] Handler có nhánh bỏ qua validation | `CreateRoom` và `CreateRoomType` có dependencies nullable và chỉ gọi resolver khi `_membershipLookupService != null && _userContext != null`. Nếu thiếu thì vẫn tiếp tục ghi DB. | 1. Chuyển `ICurrentPropertyService`, `ICurrentUserContext`, `IMembershipLookupService` thành dependencies bắt buộc non-nullable.<br>2. Kiểm tra fail-closed ngay đầu handler: thiếu Tenant/User identity ném ngay `UnauthorizedAccessException`.<br>3. Bắt buộc gọi `ResolveMembershipAsync` vô điều kiện trước mọi mutation.<br>4. Bổ sung 6 negative integration tests xác nhận 0 bản ghi DB được tạo. | **RESOLVED** |
| **Finding 2: Bootstrap Login Tra Cứu Memberships Độc Lập Scope** | [P1] Login ngầm chọn chi nhánh đầu tiên | `LoginCommandHandler` dùng `FirstOrDefault(ts => ts.IsActive)` ngầm gán chi nhánh đầu tiên cho nhân viên nhiều chi nhánh. Khi login, ambient context là null nên không tra cứu được memberships nếu không nới query filter. | 1. Xác thực mật khẩu qua `_passwordHasher.Verify` trước tiên tuyệt đối.<br>2. Tra cứu memberships chỉ cho user đã xác thực mật khẩu qua `IgnoreQueryFilters()` trên `TenantStaffMembers`, giữ nguyên 100% Global Query Filters fail-closed của các thực thể nghiệp vụ.<br>3. Kiểm tra chặt 3 tầng: `ts.IsActive`, `Tenant.Status == Active`, `Property.Status == Active`.<br>4. Nhân viên $\ge 2$ chi nhánh không có vai trò Tenant-Wide được cấp **Bootstrap Token** (`propertyId = null`, `scope = null`) kèm danh sách `validMemberships`. Bị chặn 403 nếu gọi Business Endpoint khi chưa chọn chi nhánh. | **RESOLVED** |
| **Finding 3: Test HTTP WebApplicationFactory / TestServer Thực Tế** | [P1] Yêu cầu test HTTP end-to-end với HttpClient | Kiểm thử trước đó mô phỏng qua context middleware trực tiếp, chưa chạy qua `HttpClient` và HTTP pipeline hoàn chỉnh của ASP.NET Core host. | 1. Xây dựng `BootstrapHttpPipelineWebApplicationFactoryTests` sử dụng `WebApplicationFactory<Program>` và `HttpClient`.<br>2. Routing, authentication (`JwtBearerDefaults`), authorization (`PermissionAuthorizationHandler`), middleware (`TenantPropertyContextMiddleware`), và DI thực tế 100%.<br>3. Chạy luồng thật: `POST /api/auth/login` (nhận Bootstrap Token) $\to$ `GET /api/auth/me/memberships` (HTTP 200) $\to$ `GET /api/rooms` (HTTP 403 `ERR_PROPERTY_REQUIRED`) $\to$ `POST /api/auth/switch-context` (HTTP 200 với scoped token) $\to$ `GET /api/rooms` (HTTP 200 chỉ trả về phòng thuộc $P_1$).<br>4. Không tự gán `HttpContext.User`, không gọi handler thay cho HTTP. | **RESOLVED** |
| **Finding 4: Cô Lập Host Test & Ngăn Chặn Startup DB Impact** | [P1] Tránh chạy startup seed/migration trên dev/prod | `Program.cs` có khối `EnsureCreatedAsync` và `SeedDefaultRolesAndPermissions` tại startup có thể tác động `hotel_saas_dev`. | 1. Bổ sung điều kiện kiểm tra `if (!app.Environment.IsEnvironment("Testing") && !builder.Configuration.GetValue<bool>("SkipStartupDatabaseInit"))` trong `Program.cs`.<br>2. `TestWebApplicationFactory` cấu hình `SkipStartupDatabaseInit = true` và nạp schema PostgreSQL cô lập trên `hotel_saas_p1b01a_test`. DB dev/prod được bảo vệ nguyên vẹn 100%. | **RESOLVED** |
| **Finding 5: Bỏ Hard-Code JWT Fallback, Thống Nhất Nguồn Khóa & Loại Bỏ PostConfigure** | [P1] Fallback JWT trong Program.cs che giấu lỗi cấu hình; WebApplicationFactory dùng PostConfigure ghi đè | `Program.cs` có hard-coded fallback `DevOnly_SuperSecretKey_ChangeInProduction_AtLeast32Chars!` khi secret trống; `JwtService` đọc riêng rẽ; test dùng `services.PostConfigure` che giấu quy trình nạp cấu hình thực tế. | 1. Xây dựng `JwtKeyValidator.cs` với quy tắc: ném `InvalidOperationException` fail-fast nếu key null, rỗng, whitespace hoặc $< 32$ bytes (256 bits cho HMAC-SHA256).<br>2. Bỏ hoàn toàn fallback hard-coded trong `Program.cs`. Cả `Program.cs` và `JwtService` dùng chung `JwtKeyValidator.ValidateSecretKey`.<br>3. `TestWebApplicationFactory` nạp khóa qua `builder.UseSetting` và `ConfigureAppConfiguration`, loại bỏ hoàn toàn `services.PostConfigure<JwtBearerOptions>`.<br>4. Thêm 13 unit và integration tests (`JwtConfigurationValidationTests`) kiểm tra cấu hình thiếu/rỗng/ngắn tại DI và startup WebHost. | **RESOLVED** |

---

## 2. Kết quả Kiểm thử Tổng thể Toàn Solution (100% GREEN)

```text
Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Domain.Tests\bin\Debug\net10.0\HotelSaas.Domain.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed:  1, Skipped: 0, Total:  1, Duration: 19 ms - HotelSaas.Domain.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.WebApi.Tests\bin\Debug\net10.0\HotelSaas.WebApi.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed: 36, Skipped: 0, Total: 36, Duration: 9 s - HotelSaas.WebApi.Tests.dll (net10.0)

Test run for C:\Dev\hotel-saas-v2\backend\tests\HotelSaas.Application.Tests\bin\Debug\net10.0\HotelSaas.Application.Tests.dll (.NETCoreApp,Version=v10.0)
Passed!  - Failed: 0, Passed: 89, Skipped: 0, Total: 89, Duration: 1 m 17 s - HotelSaas.Application.Tests.dll (net10.0)

Total: 126 Passed / 126 Total (100% GREEN)
Exit Code: 0
```

---

## 3. Phân Rã Các Bài Kiểm Thử Mới Bổ Sung

### 3.1. Unified JWT Configuration Validation Tests (`JwtConfigurationValidationTests.cs`)
File: `backend/tests/HotelSaas.WebApi.Tests/JwtConfigurationValidationTests.cs` (13 tests):
- `ValidateSecretKey_WhenNullOrWhitespace_ThrowsInvalidOperationException`: Kiểm thử với `null`, `""`, `"   "` $\to$ ném `InvalidOperationException` fail-fast chứa thông điệp `"is not configured or is empty"`.
- `ValidateSecretKey_WhenTooShort_ThrowsInvalidOperationException`: Kiểm thử với key ngắn (`"a"`, `"short-key"`, 31 bytes) $\to$ ném `InvalidOperationException` fail-fast yêu cầu tối thiểu 32 bytes (256 bits).
- `ValidateSecretKey_WhenValid_ReturnsKey`: Kiểm thử với key hợp lệ (32 bytes và 56 bytes) $\to$ trả về key thành công.
- `JwtService_GenerateTokens_WhenSecretKeyMissing_FailsFast`: Kiểm thử DI/service ném lỗi ngay khi key trống.
- `JwtService_GenerateTokens_WhenSecretKeyTooShort_FailsFast`: Kiểm thử DI/service ném lỗi ngay khi key $< 32$ bytes.
- `JwtService_GetPrincipalFromExpiredToken_WhenSecretKeyMissing_FailsFast`: Kiểm thử token validation ném lỗi khi key trống.
- `WebApplicationStartup_WhenSecretKeyIsEmpty_ThrowsInvalidOperationException`: Test WebHost startup fail-fast qua WebApplicationFactory khi `JwtSettings:SecretKey` rỗng.
- `WebApplicationStartup_WhenSecretKeyIsTooShort_ThrowsInvalidOperationException`: Test WebHost startup fail-fast qua WebApplicationFactory khi `JwtSettings:SecretKey` ngắn hơn 32 bytes.

### 3.2. WebApplicationFactory End-to-End HTTP Pipeline Test (`BootstrapHttpPipelineWebApplicationFactoryTests.cs`)
File: `backend/tests/HotelSaas.WebApi.Tests/BootstrapHttpPipelineWebApplicationFactoryTests.cs`:
- `HttpPipeline_EndToEnd_Login_Memberships_BlockedBusiness_SwitchContext_ScopedRooms`:
  - **Khởi tạo:** `WebApplicationFactory<Program>` không dùng `PostConfigure`, nạp cấu hình qua `builder.UseSetting` và `ConfigureAppConfiguration`. Chạy trên PostgreSQL schema cô lập `p1b02b_http_{guid}`.
  - **Step 1 (HTTP Login):** `client.PostAsJsonAsync("/api/auth/login", { email, password })` $\to$ HTTP 200 OK, trả về Bootstrap Token (không chứa `propertyId`, `pid`, `scope`) và 2 memberships ($P_1, P_2$).
  - **Step 2 (HTTP Memberships):** `client.GetAsync("/api/auth/me/memberships")` với Bearer Bootstrap Token $\to$ HTTP 200 OK, trả về danh sách 2 chi nhánh.
  - **Step 3 (HTTP Business Blocked):** `client.GetAsync("/api/rooms")` với Bearer Bootstrap Token $\to$ HTTP 403 Forbidden, `errorCode == "ERR_PROPERTY_REQUIRED"`. Middleware phát hiện nhân viên chưa chọn chi nhánh và chặn đứng trước khi vào controller!
  - **Step 4 (HTTP Switch-Context):** `client.PostAsJsonAsync("/api/auth/switch-context", { propertyId: p1 })` $\to$ HTTP 200 OK, nhận Scoped Token có `propertyId == p1` và `scope == "PropertyScoped"`.
  - **Step 5 (HTTP Business Scoped):** `client.GetAsync("/api/rooms")` với Bearer Scoped Token $\to$ HTTP 200 OK, trả về đúng 1 phòng (`101-SEA`) thuộc $P_1$. Phòng `201-MTN` thuộc $P_2$ bị Global Query Filter lọc sạch hoàn toàn!

### 3.3. PostgreSQL Tests Với DbContext Null Context (`P1B02B_ContextAuthorizationIntegrationTests.cs`)
- `Group8_Bootstrap_DbContext_NullContext_TwoBranches_ReturnsTwoMemberships_BootstrapToken`: DbContext khởi tạo với `TenantId = null`, `PropertyId = null`, nhân viên 2 chi nhánh nhận đủ 2 memberships và token bootstrap không chọn chi nhánh.
- `Group8_Bootstrap_DbContext_NullContext_SingleBranch_ResolvesContextDirectly`: DbContext khởi tạo với `TenantId = null`, `PropertyId = null`, nhân viên 1 chi nhánh nhận 1 membership và token trực tiếp nhận context $P_1$ với `scope == "PropertyScoped"`.
- `Group8_Bootstrap_DbContext_NullContext_WrongPassword_ThrowsUnauthorized_BeforeMembershipLookup`: Sai mật khẩu fail-closed ngay lập tức, không truy vấn danh sách nhân sự.

---

## 4. Cam kết Ranh giới Kiến trúc & Triển khai
- **0 migration mới**, không thay đổi schema cơ sở dữ liệu.
- Cơ sở dữ liệu dev/prod (`hotel_saas_dev`) được bảo vệ an toàn 100%, không bị ảnh hưởng bởi quá trình khởi động test host nhờ cờ `SkipStartupDatabaseInit` và `builder.UseEnvironment("Testing")`.
- Giữ nguyên các Global Query Filters fail-closed của các thực thể nghiệp vụ.
- Loại bỏ hoàn toàn fallback JWT hard-coded; cơ chế fail-fast nghiêm ngặt bảo đảm an toàn ở cả tầng ứng dụng và cấu hình máy chủ.
- Đã hoàn thành toàn bộ các yêu cầu của Reviewer, sẵn sàng bàn giao nghiệm thu.

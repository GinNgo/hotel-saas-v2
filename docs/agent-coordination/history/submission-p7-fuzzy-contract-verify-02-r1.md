# Submission P7-FUZZY-CONTRACT-VERIFY-02 — Round 1

- **TaskId:** `P7-FUZZY-CONTRACT-VERIFY-02`
- **Round:** 1
- **SubmissionId:** `sub-p7-fuzzy-contract-verify-02-r1-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-INTEGRATE-02` Round 2 Approved (`sub-p5-fuzzy-integrate-02-r2-20261011`), `P5-FUZZY-MATCHER-02` Round 3 Approved (`sub-p5-fuzzy-matcher-02-r3-20261011`), `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Xác minh độc lập tầng truyền tải JSON payload (Serialization), metadata controller endpoint `GET /api/public/properties?search`, và kiểm thử hồi quy Angular frontend service `PublicBookingService` qua `HttpTestingController`. **100% NO-DB synthetic fixtures, bảo toàn mảng trực tiếp `PublicPropertyDto[]`, không expose relevance score hay internal matching fields ra ngoài, không thay đổi runtime behavior, không đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Baseline Checkout & Tình Trạng Mã Nguồn
- **Môi trường:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` | **HEAD:** `3f95339` (`feat(auth): implement Auth + RBAC - Phase 1A complete`).
- **Dirty Baseline:** Tồn tại các file untracked/modified từ các lát cắt trước đã được nghiệm thu (P1A, P1B, P2A, P2B, P3, P4, P5, P7).
- **Ranh giới cô lập:**
  1. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs): 11 unit tests kiểm thực serialization JSON với production `JsonSerializerOptions`, negative assertions chặn rò rỉ điểm số, định dạng trường, và reflection controller metadata.
  2. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs): Mở rộng visibility `internal` cho test fake context để tái sử dụng thống nhất giữa các bộ test no-DB.
  3. [`frontend/src/app/core/services/public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts): Bổ sung 7 test cases qua `HttpTestingController` kiểm thực URL query encoding (tiếng Việt có dấu, typo, blank, no-match), direct array unwrap, latest-request-wins và HTTP error handling (tổng 15 tests service).
  4. [`docs/agent-coordination/evidence/fuzzy-contract-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/fuzzy-contract-verify-02/): Lưu trữ toàn bộ raw logs (`backend-test.log`, `frontend-test.log`) và `manifest.json` ghi nhận command, SHA256 hashes, timestamps, exit codes.

---

## 2. Chi Tiết Kiểm Thực Backend Serialization & Controller Metadata

File: [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs)

### 2.1. Cấu hình Serializer Thực Tế (ASP.NET Core WebApi Options)
Kiểm thử sử dụng chính xác cấu hình từ `Program.cs`:
```csharp
var WebApiProdOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    Converters = { new JsonStringEnumConverter() }
};
```

### 2.2. Kiểm Thực Hình Dạng Payload & Khóa Thuộc Tính (Payload Shape & Keys)
1. **Direct JSON Array:** Root element luôn là `JsonValueKind.Array` trực tiếp, không bị bọc ngoài bởi object trung gian (`{ "data": ... }` hoặc `{ "properties": ... }`).
2. **Khóa thuộc tính được phép:**
   - Dưới tùy chọn production (`WhenWritingNull`), mỗi phần tử DTO có chính xác 10 khóa:
     `id`, `name`, `code`, `slug`, `address`, `city`, `checkInTime`, `checkOutTime`, `bufferMinutes`, `maxHourlyHours`.
     (Trường `imageUrl` khi bằng `null` được lược bỏ theo cấu hình production).
   - Dưới tùy chọn mặc định (không lược bỏ null), mỗi phần tử có đúng 11 khóa, với `"imageUrl": null` (`JsonValueKind.Null`).
3. **Định dạng dữ liệu:**
   - `id`: chuỗi định dạng Guid 36 ký tự hợp lệ (`Guid.TryParse` thành công).
   - `name`, `code`, `slug`, `address`, `city`: chuỗi ký tự hợp lệ.
   - `checkInTime`, `checkOutTime`: chuỗi thời gian hợp lệ (`"14:00"` / `"12:00"`).
   - `bufferMinutes`: số nguyên (`30`).
   - `maxHourlyHours`: số nguyên (`12`).

### 2.3. Chặn Triệt Để Rò Rỉ Thông Tin Nội Bộ (Zero Leakage Negative Assertions)
Kiểm thử kiểm tra phủ định (Negative assertion) trên toàn bộ các phần tử trong mảng JSON:
- **Tuyệt đối không xuất hiện:** `score`, `Score`, `bestField`, `BestField`, `nameScore`, `cityScore`, `addressScore`.
- **Tuyệt đối không xuất hiện trường thực thể nội bộ:** `status`, `Status`, `tenant`, `Tenant`, `tenantId`, `isPublished`, `IsPublished`, `rooms`, `Rooms`, `ratePolicies`, `secrets`, `rowVersion`.

### 2.4. Xác Minh Kịch Bản Dữ Liệu
- **Blank / Normalized-Empty (`null`, `""`, `"   "`, `"\u0301"`):** Trả về đầy đủ 7 cơ sở Active theo đúng thứ tự `Name ASC`, `Id ASC`.
- **Typo Match (`"centxralz"`):** Trả về 3 cơ sở theo thứ tự xếp hạng tất định (P2, P2_TIE, P3) mà không để lộ điểm số.
- **No-Match (`"Khách sạn Không Tồn Tại 12345"`):** Trả về mảng rỗng trực tiếp `"[]"`.
- **Inactive Property (P6):** Dù query khớp tên P6 100%, kết quả serialize vẫn là `"[]"`.

### 2.5. Kiểm Thực Metadata Controller Qua Reflection
Sử dụng Reflection kiểm tra trực tiếp định nghĩa `PublicController`:
- Controller: gắn `[ApiController]`, `[Route("api/public")]`, `[Produces("application/json")]`.
- Phương thức `GetProperties`:
  - `[HttpGet("properties")]`
  - `[AllowAnonymous]`
  - `[ProducesResponseType(typeof(IReadOnlyList<PublicPropertyDto>), StatusCodes.Status200OK)]`
  - Tham số `search`: gắn `[FromQuery] string? search`.
Xác minh hợp đồng metadata route và query binding mà không cần khởi động server web thật hoặc mock giả MediatR.

---

## 3. Chi Tiết Kiểm Thực Frontend Client (`PublicBookingService` qua `HttpTestingController`)

File: [`frontend/src/app/core/services/public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts)

Kiểm thử hồi quy client service chạy trên môi trường Vitest + Angular standalone sử dụng `provideHttpClient(withNoXsrfProtection())` và `provideHttpClientTesting()` qua `HttpTestingController`:

1. **Vietnamese Accented Search Query (`"Đà Nẵng"`):**
   - Xác minh URL request: `GET /api/public/properties?search=Đà Nẵng` (param `search` được gán chính xác).
   - Nhận về mảng DTO trực tiếp.
2. **Typo / Fuzzy Query (`"centxralz"`):**
   - Xác minh request `search=centxralz`, nhận mảng 3 DTO đã xếp hạng theo thứ tự.
3. **Bypass Truy Vấn Rỗng / Khoảng Trắng (`undefined`, `"   "`):**
   - Xác minh URL gửi đi là `/api/public/properties` **hoàn toàn không có tham số `search`** (`params.has('search') === false`).
   - Nhận về đầy đủ 7 cơ sở.
4. **No-Match Query (`"Khách sạn Không Tồn Tại 12345"`):**
   - Nhận mảng rỗng `[]` an toàn.
5. **Hỗ trợ Direct Array và Wrapped Response:**
   - Khi server trả về mảng trực tiếp `[...]`: map sang mảng DTO thành công.
   - Khi server trả về bọc `{ data: [...] }`: unwrap `res.data` chính xác.
6. **Latest-Request-Wins / Consecutive Calls:**
   - Gửi liên tiếp 2 truy vấn `"Hà Nội"` và `"Da Nang"`, xác minh độc lập cả 2 HTTP request trong hàng đợi và cập nhật kết quả theo thứ tự.
7. **HTTP Error Handling:**
   - Server trả lỗi HTTP 500 / 400 được chuyển tiếp nguyên vẹn tới error handler của subscriber để xử lý retry trên giao diện.

---

## 4. Kết Quả Thực Thi Kiểm Thử (Test Execution Results)

### 4.1. Backend Test Suite (85/85 Passed):
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~FuzzyPropertyMatcherTests|FullyQualifiedName~GetPublicPropertiesSyntheticTests|FullyQualifiedName~GetPublicPropertiesSerializationTests" --logger "console;verbosity=normal"
```
- **Total tests:** 85
- **Passed:** 85 (100%)
- **Failed:** 0
- **Duration:** 2.31s
- **Exit code:** 0
- **Phân bổ:**
  - `FuzzyPropertyMatcherTests`: 46 passed.
  - `GetPublicPropertiesSyntheticTests`: 28 passed.
  - `GetPublicPropertiesSerializationTests`: 11 passed.

### 4.2. Frontend Test Suite (56/56 Passed):
```bash
node ./node_modules/vitest/vitest.mjs run src/app/core/services/public-booking.service.spec.ts src/app/features/public-booking/public-booking.page.spec.ts
```
- **Total tests:** 56
- **Passed:** 56 (100%)
- **Failed:** 0
- **Duration:** 1.67s
- **Exit code:** 0
- **Phân bổ:**
  - `public-booking.service.spec.ts`: 15 passed (8 existing + 7 new `HttpTestingController` contract regression tests).
  - `public-booking.page.spec.ts`: 41 passed.

---

## 5. Giới Hạn Kỹ Thuật (Limitations & Boundary Integrity)

Theo chỉ dẫn trong assignment, các giới hạn kỹ thuật được ghi nhận minh bạch:
1. **Cô lập Cơ Sở Dữ Liệu (No-DB Mandate):**
   - Toàn bộ suite kiểm thử chạy 100% in-memory không kết nối bất kỳ cơ sở dữ liệu PostgreSQL nào (dev/staging/prod/ambient).
2. **Khả năng dịch SQL của EF Core (SQL Translation):**
   - Kiểm thử in-memory fake LINQ không kiểm thực khả năng dịch SQL của EF Core Npgsql provider. Việc kiểm thực SQL thực tế được quản lý riêng tại harness tích hợp DB `GetPublicPropertiesQueryTests.cs`.
3. **Môi trường WebApplicationFactory HTTP Network Transport:**
   - Trong repo hiện tại, các test harness `WebApplicationFactory` (`BootstrapHttpPipelineWebApplicationFactoryTests`, `P5_GuestBookingHttpPipelineTests`) phụ thuộc `[Collection("RealDatabaseTests")]` và yêu cầu máy chủ PostgreSQL hoạt động.
   - Repo chưa có sẵn harness `WebApplicationFactory` chạy hoàn toàn in-memory không cần DB.
   - Để tuân thủ tuyệt đối quy tắc NO-DB (không kết nối database, không tự ý bổ sung dependency NuGet hay chạy startup server thật), hợp đồng endpoint được kiểm thực qua Reflection metadata trên Controller và `HttpTestingController` trên Angular frontend. Việc kiểm thực full-stack qua HTTP socket thật trên live server được ghi nhận là limitation có chủ đích cho lát cắt NO-DB này.

---

## 6. Danh Mục Minh Chứng (Evidence)

1. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`: 11 unit tests kiểm thực JSON serialization, shape, và controller metadata.
2. `frontend/src/app/core/services/public-booking.service.spec.ts`: 15 unit tests frontend service (`HttpTestingController` regression).
3. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`: 28 unit tests synthetic handler execution.
4. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests thuật toán matcher.
5. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/backend-test.log`: Log thực thi đầy đủ 85 backend tests (exit code 0).
6. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/frontend-test.log`: Log thực thi đầy đủ 56 frontend tests (exit code 0).
7. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/manifest.json`: Manifest ghi nhận metadata, commands, timestamps, SHA256 hashes, và limitations.
8. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả Version 9.0 Approved.
9. `docs/agent-coordination/submission.md`: Bản tường trình Submission P7-FUZZY-CONTRACT-VERIFY-02 Round 1.
10. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.
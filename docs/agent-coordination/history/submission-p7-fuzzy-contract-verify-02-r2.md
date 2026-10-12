# Submission P7-FUZZY-CONTRACT-VERIFY-02 — Round 2

- **TaskId:** `P7-FUZZY-CONTRACT-VERIFY-02`
- **Round:** 2
- **SubmissionId:** `sub-p7-fuzzy-contract-verify-02-r2-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-INTEGRATE-02` Round 2 Approved (`sub-p5-fuzzy-integrate-02-r2-20261011`), `P5-FUZZY-MATCHER-02` Round 3 Approved (`sub-p5-fuzzy-matcher-02-r3-20261011`), `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Xác minh độc lập tầng truyền tải JSON payload (Serialization), metadata controller endpoint `GET /api/public/properties?search`, và kiểm thử hồi quy Angular frontend service `PublicBookingService` qua `HttpTestingController`. **100% NO-DB synthetic fixtures, bảo toàn mảng trực tiếp `PublicPropertyDto[]`, không expose relevance score hay internal matching fields ra ngoài, không thay đổi runtime behavior, không đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Giải Quyết Triệt Để Findings từ Codex Round 1 Review

| Finding | Phân loại | Giải pháp thực hiện trong Round 2 | File / Vị trí |
|---|---|---|---|
| **Finding 1** | P2 — Phân loại kiểm thử Service Concurrency vs Component Latest-Wins | `PublicBookingService` là transport-pure HTTP client service, không tự ý hủy request hay can thiệp race condition. Test 6 được phân loại chính xác là kiểm tra các yêu cầu liên tiếp độc lập (consecutive independent completions). Bổ sung Test 7 xác minh phản hồi out-of-order không bị service nuốt/hủy ngầm. Cơ chế race management / latest-request-wins (RxJS `switchMap` / debounce) thuộc tầng component và được dẫn chứng, kiểm thực riêng tại `public-booking.page.spec.ts`. | [`frontend/src/app/core/services/public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts#L338-L388)<br>[`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) |
| **Finding 2** | P2 — Giá trị trường tuần tự hóa, fixture riêng biệt & phiên bản đo lường | Xây dựng `DistinctTestCatalog` với 3 cơ sở có toàn bộ giá trị trường khác biệt (checkIn: `14:15:00` vs `15:30:00` vs `13:00:00`; checkOut: `11:45:00` vs `12:15:00` vs `11:00:00`; buffer: `35` vs `45` vs `60`; maxHourly: `10` vs `8` vs `6`). Thêm test `Serialize_DistinctPropertyCatalog_PreservesExactPerPropertyValuesWithoutFieldSwaps` assert giá trị chính xác từng thuộc tính để loại trừ đảo trường. Assert đúng định dạng chuẩn .NET 10 `TimeOnly` có giây (`"HH:mm:ss"`). Ghi nhận `WebApiProdOptions` là bản sao source-equivalent, không claim DI runtime. Cập nhật `manifest.json` với phiên bản runtime đo lường chính xác (`dotnet 10.0.301`, `node v26.2.0`). | [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs#L32-L95)<br>[`docs/agent-coordination/evidence/fuzzy-contract-verify-02/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/fuzzy-contract-verify-02/manifest.json) |

---

## 2. Baseline & Tình Trạng Mã Nguồn
- **Môi trường:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` | **HEAD:** `3f95339` (`feat(auth): implement Auth + RBAC - Phase 1A complete`).
- **Ranh giới cô lập:**
  1. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs): 12 unit tests kiểm thực serialization JSON với production `JsonSerializerOptions` (source-equivalent), `DistinctTestCatalog` loại trừ rủi ro đảo trường, negative assertions chặn rò rỉ điểm số, định dạng `TimeOnly` chuẩn `"HH:mm:ss"`, và reflection controller metadata.
  2. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs): 28 unit tests synthetic handler execution với test fake context `internal`.
  3. [`frontend/src/app/core/services/public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts): 16 unit tests service (8 existing + 8 `HttpTestingController` contract regression tests: Vietnamese encoding, typo search, blank query bypass, no-match, direct vs wrapped unwrap, consecutive completions, out-of-order response handling, HTTP error propagation).
  4. [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts): 41 component tests xác minh logic tương tác người dùng, debounce, và `switchMap` latest-request-wins.
  5. [`docs/agent-coordination/evidence/fuzzy-contract-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/fuzzy-contract-verify-02/): Raw test logs (`backend-test.log`, `frontend-test.log`) và `manifest.json` ghi nhận chính xác runtime versions (`dotnet 10.0.301`, `node v26.2.0`), SHA256 hashes, và limitations.

---

## 3. Chi Tiết Kiểm Thực Backend Serialization & Controller Metadata

File: [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs)

### 3.1. Cấu hình Serializer Thực Tế (Source-Equivalent Copy)
Serializer options được cấu hình là bản sao tương đương trực tiếp từ `HotelSaas.WebApi/Program.cs` (dòng 54-60):
```csharp
private static readonly JsonSerializerOptions WebApiProdOptions = new()
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    Converters = { new JsonStringEnumConverter() }
};
```
*(Ghi chú minh bạch: Đây là cấu hình độc lập phục vụ kiểm thử unit contract, không phải instance resolve từ DI container của WebApplicationFactory).*

### 3.2. Fixture Khác Biệt Hoàn Toàn (`DistinctTestCatalog`) Chống Đảo Trường
Để giải quyết triệt để rủi ro các fixture chia sẻ chung giá trị số và giờ che giấu lỗi hoán đổi trường:
```csharp
internal static readonly Property[] DistinctTestCatalog = new[]
{
    new Property
    {
        Id = Guid.Parse("11111111-aaaa-1111-aaaa-111111111111"),
        Name = "Khách Sạn Biển Đông Đà Nẵng",
        Code = "P-DN-01",
        Slug = "bien-dong-danang",
        Address = "101 Võ Nguyên Giáp, Sơn Trà",
        City = "Đà Nẵng",
        Status = PropertyStatus.Active,
        CheckInTime = new TimeOnly(14, 15, 0),
        CheckOutTime = new TimeOnly(11, 45, 0),
        BufferMinutes = 35,
        MaxHourlyHours = 10
    },
    new Property
    {
        Id = Guid.Parse("22222222-bbbb-2222-bbbb-222222222222"),
        Name = "Khách Sạn Hà Nội Horizon",
        Code = "P-HN-02",
        Slug = "hanoi-horizon",
        Address = "202 Cát Linh, Đống Đa",
        City = "Hà Nội",
        Status = PropertyStatus.Active,
        CheckInTime = new TimeOnly(15, 30, 0),
        CheckOutTime = new TimeOnly(12, 15, 0),
        BufferMinutes = 45,
        MaxHourlyHours = 8
    },
    new Property
    {
        Id = Guid.Parse("33333333-cccc-3333-cccc-333333333333"),
        Name = "Khách Sạn Sài Gòn Central",
        Code = "P-SG-03",
        Slug = "saigon-central",
        Address = "303 Lê Lợi, Quận 1",
        City = "TP. Hồ Chí Minh",
        Status = PropertyStatus.Active,
        CheckInTime = new TimeOnly(13, 0, 0),
        CheckOutTime = new TimeOnly(11, 0, 0),
        BufferMinutes = 60,
        MaxHourlyHours = 6
    }
};
```
Test mới `Serialize_DistinctPropertyCatalog_PreservesExactPerPropertyValuesWithoutFieldSwaps` assert giá trị chính xác cho từng phần tử:
- `checkInTime` vs `checkOutTime`: `14:15:00` vs `11:45:00` (P1), `15:30:00` vs `12:15:00` (P2), `13:00:00` vs `11:00:00` (P3) -> Không bị đảo ngược.
- `bufferMinutes` vs `maxHourlyHours`: `35` vs `10` (P1), `45` vs `8` (P2), `60` vs `6` (P3) -> Không bị đảo ngược.
- `name`, `code`, `slug`, `address`, `city` bảo toàn 100% giá trị nguồn.

### 3.3. Định Dạng Chuẩn .NET 10 `TimeOnly`
`System.Text.Json` trong .NET 10 tuần tự hóa `TimeOnly` theo định dạng ISO 8601 có phần giây: `"HH:mm:ss"`.
Kiểm thử assert chính xác `"14:00:00"`, `"12:00:00"`, `"14:15:00"`, `"11:45:00"`, loại trừ các giả định không chuẩn xác.

### 3.4. Chặn Triệt Để Rò Rỉ Thông Tin Nội Bộ (Zero Leakage)
Negative assertions kiểm tra toàn bộ thuộc tính trong payload:
- **Không chứa điểm số:** `score`, `Score`, `bestField`, `nameScore`, `cityScore`, `addressScore`.
- **Không chứa trường nội bộ:** `status`, `tenant`, `isPublished`, `rooms`, `ratePolicies`, `secrets`, `rowVersion`.

### 3.5. Kiểm Thực Metadata Controller Qua Reflection
Sử dụng Reflection kiểm tra trực tiếp định nghĩa `PublicController`:
- Controller: `[ApiController]`, `[Route("api/public")]`, `[Produces("application/json")]`.
- Phương thức `GetProperties`:
  - `[HttpGet("properties")]`
  - `[AllowAnonymous]`
  - `[ProducesResponseType(typeof(IReadOnlyList<PublicPropertyDto>), StatusCodes.Status200OK)]`
  - Tham số `search`: `[FromQuery] string? search`.

---

## 4. Chi Tiết Kiểm Thực Frontend Client (`PublicBookingService` & Phân Định Trách Nhiệm)

File: [`frontend/src/app/core/services/public-booking.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.spec.ts)

### 4.1. Bản Chất Tầng Service: Transport-Pure Client
`PublicBookingService` là một client thuần túy (transport-pure):
- Mỗi lần gọi `getProperties(search)` trả về một `Observable<PublicPropertyDto[]>`.
- Service không giữ state, không debounce, không cancel request trước đó, và không áp dụng `switchMap` ngầm.
- Vì vậy, các test tại service được định nghĩa chính xác theo bản chất:
  - **Test 6:** `should handle multiple independent consecutive search requests with distinct parameters and completions (service is transport-pure; race management belongs to caller)`.
  - **Test 7:** `should process independent out-of-order HTTP responses faithfully without internal race suppression (service emits per call; latest-request-wins is coordinated at component level)`.
  - **Test 8:** `should propagate HTTP errors gracefully to subscriber`.

### 4.2. Tầng Quản Lý Race / Latest-Request-Wins: Component Layer
- Logic hủy request cũ khi người dùng gõ phím liên tục, debounce 300ms, và ưu tiên kết quả mới nhất (`latest-request-wins`) được thực hiện bằng `switchMap` trong `BookingPage`.
- Toàn bộ 41 test cases trong [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) chứng minh hành vi này ở tầng UI component mà không làm sai lệch bản chất của service.

---

## 5. Kết Quả Thực Thi Kiểm Thử (Test Execution Results)

### 5.1. Backend Test Suite (86/86 Passed):
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~FuzzyPropertyMatcherTests|FullyQualifiedName~GetPublicPropertiesSyntheticTests|FullyQualifiedName~GetPublicPropertiesSerializationTests" --logger "console;verbosity=normal" --no-restore
```
- **Total tests:** 86
- **Passed:** 86 (100%)
- **Failed:** 0
- **Duration:** 2.30s
- **Exit code:** 0
- **Phân bổ:**
  - `FuzzyPropertyMatcherTests`: 46 passed.
  - `GetPublicPropertiesSyntheticTests`: 28 passed.
  - `GetPublicPropertiesSerializationTests`: 12 passed (+1 test distinct fixture).

### 5.2. Frontend Test Suite (57/57 Passed across 2 Test Files):
```bash
node ./node_modules/vitest/vitest.mjs run src/app/core/services/public-booking.service.spec.ts src/app/features/public-booking/public-booking.page.spec.ts
```
- **Test Files:** 2 passed (2)
- **Total tests:** 57 passed (100%)
- **Failed:** 0
- **Duration:** 1.85s
- **Exit code:** 0
- **Phân bổ:**
  - `public-booking.service.spec.ts`: 16 passed (8 base + 8 `HttpTestingController` contract regression tests).
  - `public-booking.page.spec.ts`: 41 passed.

---

## 6. Giới Hạn Kỹ Thuật (Honest Limitations)

1. **No-DB Mandate:** Toàn bộ test suite chạy 100% in-memory không kết nối bất kỳ cơ sở dữ liệu PostgreSQL nào (dev/staging/prod/ambient).
2. **Khả năng dịch SQL của EF Core:** Kiểm thử in-memory fake LINQ không kiểm thực khả năng dịch SQL của Npgsql provider; việc này được cô lập tại harness có DB `GetPublicPropertiesQueryTests.cs`.
3. **HTTP Socket Transport:** Trong repo, `WebApplicationFactory` yêu cầu PostgreSQL thật (`RealDatabaseTests`). Nhằm tuân thủ tuyệt đối quy tắc NO-DB, hợp đồng endpoint được kiểm thực qua Reflection metadata trên Controller và `HttpTestingController` trên Angular frontend. Không đưa ra khẳng định chưa được đo lường về live HTTP socket transport.
4. **Serializer Options:** `WebApiProdOptions` là bản sao source-equivalent tương đương cấu hình `Program.cs`, không phải DI-resolved instance từ WebApplicationFactory.
5. **Phân định Service vs Component Concurrency:** `PublicBookingService` là transport-pure và phát tín hiệu độc lập theo từng lệnh gọi. Quản lý race, hủy request cũ qua `switchMap` và latest-request-wins thuộc về tầng UI component (`BookingPage`).

---

## 7. Danh Mục Minh Chứng (Evidence)

1. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSerializationTests.cs`: 12 unit tests kiểm thực JSON serialization, distinct per-property fixtures, shape, và controller metadata.
2. `frontend/src/app/core/services/public-booking.service.spec.ts`: 16 unit tests frontend service (`HttpTestingController` regression).
3. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`: 28 unit tests synthetic handler execution.
4. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests thuật toán matcher.
5. `frontend/src/app/features/public-booking/public-booking.page.spec.ts`: 41 component tests xác minh debounce và race coordination.
6. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/backend-test.log`: Log thực thi đầy đủ 86 backend tests (exit code 0).
7. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/frontend-test.log`: Log thực thi đầy đủ 57 frontend tests (exit code 0).
8. `docs/agent-coordination/evidence/fuzzy-contract-verify-02/manifest.json`: Manifest ghi nhận runtime versions (`dotnet 10.0.301`, `node v26.2.0`), SHA256 hashes, và explicit limitations.
9. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả Version 9.0 Approved.
10. `docs/agent-coordination/submission.md`: Bản tường trình Submission Round 2.
11. `docs/agent-coordination/history/review-p7-fuzzy-contract-verify-02-r1.md`: Lưu trữ hồ sơ Review Round 1.
12. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.
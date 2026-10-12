# Submission P5-FUZZY-INTEGRATE-02 — Round 2

- **TaskId:** `P5-FUZZY-INTEGRATE-02`
- **Round:** 2
- **SubmissionId:** `sub-p5-fuzzy-integrate-02-r2-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-MATCHER-02` Round 3 Approved (`sub-p5-fuzzy-matcher-02-r3-20261011`), `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Tích hợp helper `FuzzyPropertyMatcher` đã được phê duyệt vào handler tìm kiếm công khai hiện hữu `GetPublicPropertiesQueryHandler`. **Bảo toàn 100% endpoint `GET /api/public/properties?search`, mảng `PublicPropertyDto` trực tiếp, chính sách Active-only, không expose relevance score hay internal fields ra public API, projection tối thiểu `AsNoTracking()`. Tuyệt đối không chạm Database dev/staging/prod/ambient, không thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng Angular UI hay module của đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Tóm Tắt Giải Quyết Finding Vòng 1 (Round 1 Review Finding Resolution)

Trong Vòng 1, reviewer Codex đã đưa ra nhận xét:
> **Finding (P2):** Test synthetic sử dụng secondary internal constructor / loader riêng (`_propertyLoader`), sao chép lại logic lọc Active và projection, bỏ qua pipeline EF thực tế của handler (`_context.Properties.IgnoreQueryFilters().AsNoTracking()...ToListAsync()`). Cần loại bỏ constructor phụ, chỉ giữ duy nhất constructor production `GetPublicPropertiesQueryHandler(IApplicationDbContext context)`, và sử dụng test-only async `IQueryable`/`DbSet` fake với expression rewriter để chạy pipeline query thật trong synthetic unit tests.

### Các thay đổi đã thực hiện trong Vòng 2:
1. **Loại bỏ hoàn toàn secondary constructor và loader phụ:**
   - Xóa bỏ `internal GetPublicPropertiesQueryHandler(IEnumerable<Property> syntheticProperties)`.
   - Xóa bỏ delegate `_propertyLoader`.
   - Xóa bỏ `[assembly: InternalsVisibleTo("HotelSaas.Application.Tests")]` khỏi `GetPublicPropertiesQuery.cs`.
   - Handler chỉ có duy nhất một constructor duy nhất của production:
     ```csharp
     private readonly IApplicationDbContext _context;

     public GetPublicPropertiesQueryHandler(IApplicationDbContext context)
     {
         _context = context ?? throw new ArgumentNullException(nameof(context));
     }
     ```
2. **Thực thi pipeline production thực tế trong Handler:**
   ```csharp
   public async Task<IReadOnlyList<PublicPropertyDto>> Handle(GetPublicPropertiesQuery request, CancellationToken cancellationToken)
   {
       cancellationToken.ThrowIfCancellationRequested();

       var query = _context.Properties
           .IgnoreQueryFilters()
           .AsNoTracking()
           .Where(p => p.Status == PropertyStatus.Active);

       var properties = await query
           .OrderBy(p => p.Name)
           .ThenBy(p => p.Id)
           .Select(p => new PublicPropertyDto
           {
               Id = p.Id,
               Name = p.Name,
               Code = p.Code,
               Slug = p.Slug,
               Address = p.Address,
               City = p.City,
               CheckInTime = p.CheckInTime,
               CheckOutTime = p.CheckOutTime,
               BufferMinutes = p.BufferMinutes,
               MaxHourlyHours = p.MaxHourlyHours,
               ImageUrl = null
           })
           .ToListAsync(cancellationToken);

       return FilterAndRank(properties, request.Search);
   }
   ```
3. **Triển khai hạ tầng Synthetic Test Fake an toàn (`GetPublicPropertiesSyntheticTests.cs`):**
   - Xây dựng `TestApplicationDbContext : IApplicationDbContext` đóng gói `TestAsyncDbSet<Property>`.
   - `TestAsyncDbSet<T>` và `TestAsyncQueryable<T>` cài đặt `IOrderedQueryable<T>` và `IAsyncEnumerable<T>`, tương thích hoàn toàn với LINQ và `ToListAsync(cancellationToken)`.
   - `EfExpressionRewriter` kế thừa `ExpressionVisitor` để bóc tách các EF-specific annotation (`IgnoreQueryFilters()`, `AsNoTracking()`) trước khi ủy quyền cho LINQ to Objects đánh giá biểu thức `Where(p => p.Status == PropertyStatus.Active)`, `OrderBy`, `ThenBy`, và `Select(p => new PublicPropertyDto { ... })`.
   - Handler trong tất cả 28 synthetic tests được khởi tạo trực tiếp qua `new GetPublicPropertiesQueryHandler(new TestApplicationDbContext(catalog))`, trực tiếp kích hoạt 100% pipeline production C# mà không cần kết nối bất kỳ cơ sở dữ liệu nào.

---

## 2. Baseline Checkout & Tình Trạng Mã Nguồn
- **Môi trường:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` | **HEAD:** `3f95339` (`feat(auth): implement Auth + RBAC - Phase 1A complete`).
- **Dirty Baseline:** Tồn tại các file untracked/modified từ các lát cắt trước đã được nghiệm thu (P1A, P1B, P2A, P2B, P3, P4, P5, P7).
- **Ranh giới cô lập:**
  1. [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs): Wire `FuzzyPropertyMatcher` vào handler; duy nhất 1 production constructor `IApplicationDbContext`.
  2. [`backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs): Bổ sung overload tối thiểu cho `PublicPropertyDto` (`CompareProperties`, `SearchProperties`, `PublicPropertyMatchResult`).
  3. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs): 28 unit tests synthetic NO DB xác minh toàn diện wiring, mảng kết quả, thứ tự, DTO shape, Active guard, blank, no-match, accent, hoán vị và condensed qua `TestApplicationDbContext`.

---

## 3. Chi Tiết Triển Khai Tích Hợp (Implementation Details)

### 3.1. Bảo tồn Endpoint & Public DTO Contract
- Query: `GetPublicPropertiesQuery(string? Search = null) : IRequest<IReadOnlyList<PublicPropertyDto>>`.
- Controller và Route không thay đổi: `GET /api/public/properties?search`.
- Kết quả trả về là mảng trực tiếp `IReadOnlyList<PublicPropertyDto>`.
- **Tuyệt đối không expose relevance score hay internal matching fields** ra DTO công khai (`PublicPropertyDto` không thêm bất kỳ trường điểm số nào).

### 3.2. Projection Tối Thiểu & `AsNoTracking()`
- Tiếp tục truy vấn `_context.Properties.IgnoreQueryFilters().AsNoTracking().Where(p => p.Status == PropertyStatus.Active)` và `Select` trực tiếp ra `PublicPropertyDto`.
- Không tải full entity, navigation properties (Rooms, Rates, Tenancy) hay secrets chỉ để phục vụ fuzzy matching.

### 3.3. Overload Tối Thiểu Trên `FuzzyPropertyMatcher`
File: [`backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs)
1. `public sealed record PublicPropertyMatchResult(PublicPropertyDto Property, int Score, string BestField, int NameScore, int CityScore, int AddressScore);`
2. `public static int CompareProperties(PublicPropertyDto a, PublicPropertyDto b)`: So sánh `Name ASC` (`StringComparer.OrdinalIgnoreCase`), sau đó `Id ASC` (`Guid.CompareTo`).
3. `public static List<PublicPropertyMatchResult> SearchProperties(string? query, IEnumerable<PublicPropertyDto>? properties)`:
   - Xử lý bypass khi truy vấn rỗng/whitespace hoặc normalized-empty (`qNorm.Length == 0`): trả về toàn bộ danh sách DTO theo thứ tự `Name ASC`, `Id ASC` với `Score = 0`.
   - So khớp trên 3 trường `p.Name`, `p.City`, `p.Address` qua `ScoreProperty`.
   - Lọc các cơ sở có điểm > 0.
   - Sắp xếp tất định: `Score DESC`, `Name ASC` (`OrdinalIgnoreCase`), `Id ASC` (`Guid.CompareTo`).
4. Không tạo thêm bất kỳ service, abstraction hay dependency NuGet mới nào.

---

## 4. Bộ Unit Test Synthetic NO DB (`GetPublicPropertiesSyntheticTests.cs`)

File: [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs)

### Các nhóm kiểm thử bao phủ:
1. **Active-Only Guard:**
   - Cơ sở Inactive (P6: `"Khách Sạn Phú Quốc Sunset Resort"`) dù khớp 100% exact match vẫn bị loại trừ hoàn toàn bởi `Where(p => p.Status == PropertyStatus.Active)` trước khi chiếu DTO, trả về mảng rỗng `[]`.
2. **Bypass Truy Vấn Rỗng & Normalized-Empty:**
   - Truy vấn `null`, `""`, `"   "`, `"\u0301"` (dấu thanh đơn lẻ) trả về đầy đủ 7 cơ sở Active theo đúng thứ tự `Name ASC`, `Id ASC`. P6 luôn bị loại trừ.
3. **Truy Vấn Không Khớp (No-Match):**
   - Truy vấn `"Khách sạn Không Tồn Tại 12345"` trả về mảng rỗng `[]`.
4. **Toàn Bộ 15 Approved Fixtures & Kiểm Thực DTO Shape:**
   - Toàn bộ 15 kịch bản chuẩn từ contract v9.0 được kiểm thử trực tiếp qua `handler.Handle(...)`.
   - Kết quả khớp chính xác 100% mảng định danh (`Id`) và thứ tự mong đợi.
   - Xác minh toàn bộ các trường của `PublicPropertyDto` (`Name`, `Code`, `Slug`, `Address`, `City`, `CheckInTime`, `CheckOutTime`, `BufferMinutes`, `MaxHourlyHours`, `ImageUrl == null`).
5. **Kiểm Thực Điểm Số Nội Bộ & Field Breakdown:**
   - Xác minh qua `FuzzyPropertyMatcher.SearchProperties(query, dtos)`: điểm số (`Score`), trường khớp tốt nhất (`BestField`), và điểm từng trường (`NameScore`, `CityScore`, `AddressScore`) cho các trường hợp điển hình (`centxralz`, `nhxtrangg`, `Haoni`, `Sài Gòn`).
6. **Chuẩn Hóa Dấu Thanh & Canonical Equivalence (NFC / NFD):**
   - Các truy vấn tiếng Việt dạng NFC và NFD tạo ra kết quả mảng DTO giống nhau 100%.
   - Đảm bảo tính tương đương giữa `đ` và `Đ` trên cả chữ hoa và chữ thường.
7. **CancellationToken Propagation:**
   - Truyền token đã hủy kích hoạt `OperationCanceledException` hợp lệ.

---

## 5. Kết Quả Thực Thi Kiểm Thử (Test Execution Results)

### Lệnh thực thi:
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~FuzzyPropertyMatcherTests|FullyQualifiedName~GetPublicPropertiesSyntheticTests" --logger "console;verbosity=normal"
```

### Kết quả:
- **Total tests:** 74
- **Passed:** 74 (100%)
- **Failed:** 0
- **Duration:** 2.45s
- **Exit code:** 0

### Bảng phân bổ kiểm thử (74/74 passed):
| Test Suite | Số lượng test | Trạng thái | Ghi chú |
|---|---|---|---|
| `FuzzyPropertyMatcherTests` | 46 | PASS | Matcher thuần C#, 3-row buffer, stack/pool oracle $\ge 170$, sorting native |
| `GetPublicPropertiesSyntheticTests` | 28 | PASS | Synthetic NO DB, single production constructor, production EF query pipeline qua `TestApplicationDbContext` |
| **Tổng cộng** | **74** | **PASS** | **100% Passed, Exit code 0** |

---

## 6. Giới Hạn & Đánh Giá Kỹ Thuật (Limitations & Analysis)

1. **Giới Hạn Của Test Fake Không Có Cơ Sở Dữ Liệu (Test Fake Limitation):**
   - Hạ tầng `TestApplicationDbContext` và `EfExpressionRewriter` kiểm thực chính xác 100% luồng C# LINQ, logic lọc `Where(Status == Active)`, sắp xếp tiền đề, projection ra DTO, và `ToListAsync()`.
   - Tuy nhiên, vì test chạy 100% in-memory không có máy chủ PostgreSQL, test fake **không kiểm thực khả năng dịch SQL của EF Core Npgsql provider**. Việc kiểm thực dịch SQL thực tế được đảm nhiệm bởi harness tích hợp DB chuyên biệt tại `GetPublicPropertiesQueryTests.cs` (yêu cầu cấu hình Postgres local `hotel_saas_p1b01a_test`).
2. **Độ phức tạp tính toán:**
   - Chi phí tính toán là $O(\text{queries} \cdot \text{fields} \cdot \text{properties})$ thực thi in-memory trên tập danh mục cơ sở Active đã được chiếu DTO gọn nhẹ.
   - Dung lượng bộ nhớ cho OSA được tối ưu hóa tuyến tính $O(\min(l_1, l_2))$ qua bộ đệm 3 dòng cuộn (`stackalloc` $\le 512$ phần tử, `ArrayPool` cho chuỗi $\ge 170$).
3. **Không áp đặt giới hạn phi nghiệp vụ:**
   - Không tự ý cắt ngắn chuỗi truy vấn (no query truncation).
   - Không áp đặt giới hạn số lượng kết quả (no query cap). Các chính sách hiệu năng nâng cao (pagination/capping) tiếp tục chờ PO phê duyệt (`NeedsPO`).
4. **Bảo toàn CancellationToken:**
   - CancellationToken được tôn trọng và kiểm tra trước/trong suốt quá trình truy vấn và xử lý.
5. **Cách ly cơ sở dữ liệu:**
   - Toàn bộ suite kiểm thử chạy độc lập hoàn toàn, không kết nối database dev/staging/prod/ambient.

---

## 7. Danh Mục Minh Chứng (Evidence)

1. `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`: Handler tích hợp matcher, chiếu DTO gọn nhẹ, Active-only, không leak điểm số, duy nhất 1 production constructor `IApplicationDbContext`.
2. `backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`: Overload `SearchProperties` và `CompareProperties` cho `PublicPropertyDto`.
3. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`: 28 unit tests synthetic NO DB kiểm thực toàn diện handler production pipeline và DTO shape qua `TestApplicationDbContext`.
4. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests thuật toán matcher.
5. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 Approved.
6. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET CoreCLR.
7. `docs/agent-coordination/submission.md`: Bản tường trình Submission P5-FUZZY-INTEGRATE-02 Round 2.
8. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.
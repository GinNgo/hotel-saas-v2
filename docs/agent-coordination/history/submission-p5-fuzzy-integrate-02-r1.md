# Submission P5-FUZZY-INTEGRATE-02 — Round 1

- **TaskId:** `P5-FUZZY-INTEGRATE-02`
- **Round:** 1
- **SubmissionId:** `sub-p5-fuzzy-integrate-02-r1-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-MATCHER-02` Round 3 Approved (`sub-p5-fuzzy-matcher-02-r3-20261011`), `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Tích hợp helper `FuzzyPropertyMatcher` đã được phê duyệt vào handler tìm kiếm công khai hiện hữu `GetPublicPropertiesQueryHandler`. **Bảo toàn 100% endpoint `GET /api/public/properties?search`, mảng `PublicPropertyDto` trực tiếp, chính sách Active-only, không expose relevance score hay internal fields ra public API, projection tối thiểu `AsNoTracking()`. Tuyệt đối không chạm Database dev/staging/prod/ambient, không thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng Angular UI hay module của đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Baseline Checkout & Tình Trạng Mã Nguồn
- **Môi trường:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` | **HEAD:** `3f95339` (`feat(auth): implement Auth + RBAC - Phase 1A complete`).
- **Dirty Baseline:** Tồn tại các file untracked/modified từ các lát cắt trước đã được nghiệm thu (P1A, P1B, P2A, P2B, P3, P4, P5, P7).
- **Ranh giới cô lập:**
  1. [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs): Wire `FuzzyPropertyMatcher` vào handler; bổ sung constructor internal phục vụ synthetic test.
  2. [`backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs): Bổ sung overload tối thiểu cho `PublicPropertyDto` (`CompareProperties`, `SearchProperties`, `PublicPropertyMatchResult`).
  3. [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs): 28 unit tests synthetic NO DB xác minh toàn diện wiring, mảng kết quả, thứ tự, DTO shape, Active guard, blank, no-match, accent, hoán vị và condensed.

---

## 2. Chi Tiết Triển Khai Tích Hợp (Implementation Details)

### 2.1. Wiring `FuzzyPropertyMatcher` Vào `GetPublicPropertiesQueryHandler`
File: [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs)

1. **Bảo tồn Endpoint & Public DTO Contract:**
   - Query: `GetPublicPropertiesQuery(string? Search = null) : IRequest<IReadOnlyList<PublicPropertyDto>>`.
   - Controller và Route không thay đổi: `GET /api/public/properties?search`.
   - Kết quả trả về là mảng trực tiếp `IReadOnlyList<PublicPropertyDto>`.
   - **Tuyệt đối không expose relevance score hay internal matching fields** ra DTO công khai (`PublicPropertyDto` không thêm bất kỳ trường điểm số nào).
2. **Projection Tối Thiểu & `AsNoTracking()`:**
   - Tiếp tục truy vấn `_context.Properties.IgnoreQueryFilters().AsNoTracking().Where(p => p.Status == PropertyStatus.Active)` và `Select` trực tiếp ra `PublicPropertyDto`.
   - Không tải full entity, navigation properties (Rooms, Rates, Tenancy) hay secrets chỉ để phục vụ fuzzy matching.
3. **Thực thi So Khớp & Xếp Hạng Qua Matcher:**
   - Sau khi chiếu ra danh sách `properties` (`List<PublicPropertyDto>`), gọi `FuzzyPropertyMatcher.SearchProperties(request.Search, properties)`.
   - Trả về `matchResults.Select(r => r.Property).ToList()`.
4. **Hỗ Trợ Synthetic Testing Không Cần Database:**
   - Khởi tạo constructor internal: `internal GetPublicPropertiesQueryHandler(IEnumerable<Property> syntheticProperties)`.
   - Khởi tạo này mô phỏng chính xác hành vi của truy vấn DB (lọc `Status == PropertyStatus.Active`, sắp xếp ban đầu, chiếu ra DTO) và chuyển sang bộ lọc matcher, cho phép chạy test handler 100% in-memory mà không cần kết nối DB hay provider bên ngoài.

### 2.2. Overload Tối Thiểu Trên `FuzzyPropertyMatcher`
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

## 3. Bộ Unit Test Synthetic NO DB (`GetPublicPropertiesSyntheticTests.cs`)

File: [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs)

### Các nhóm kiểm thử bao phủ:
1. **Active-Only Guard:**
   - Cơ sở Inactive (P6: `"Khách Sạn Phú Quốc Sunset Resort"`) dù khớp 100% exact match vẫn bị loại trừ hoàn toàn trước khi chiếu DTO, trả về mảng rỗng `[]`.
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

## 4. Kết Quả Thực Thi Kiểm Thử (Test Execution Results)

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
| `GetPublicPropertiesSyntheticTests` | 28 | PASS | Synthetic NO DB, Active guard, 15 fixtures, DTO shape, NFC/NFD, cancellation |
| **Tổng cộng** | **74** | **PASS** | **100% Passed, Exit code 0** |

---

## 5. Chi Phí Runtime, Hiệu Năng & Giới Hạn

1. **Độ phức tạp tính toán:**
   - Chi phí tính toán là $O(\text{queries} \cdot \text{fields} \cdot \text{properties})$ thực thi in-memory trên tập danh mục cơ sở Active đã được chiếu DTO gọn nhẹ.
   - Dung lượng bộ nhớ cho OSA được tối ưu hóa tuyến tính $O(\min(l_1, l_2))$ qua bộ đệm 3 dòng cuộn (`stackalloc` $\le 512$ phần tử, `ArrayPool` cho chuỗi $\ge 170$).
2. **Không áp đặt giới hạn phi nghiệp vụ:**
   - Không tự ý cắt ngắn chuỗi truy vấn (no query truncation).
   - Không áp đặt giới hạn số lượng kết quả (no query cap). Các chính sách hiệu năng nâng cao (pagination/capping) tiếp tục chờ PO phê duyệt (`NeedsPO`).
3. **Bảo toàn CancellationToken:**
   - CancellationToken được tôn trọng và kiểm tra trước/trong suốt quá trình truy vấn và xử lý.
4. **Cách ly cơ sở dữ liệu:**
   - Toàn bộ suite kiểm thử chạy độc lập hoàn toàn, không kết nối database dev/staging/prod/ambient.
   - Suite kiểm thử harness có DB Postgres thực tế vẫn được bảo lưu tại `GetPublicPropertiesQueryTests.cs` (yêu cầu cấu hình Postgres local `hotel_saas_p1b01a_test`).

---

## 6. Danh Mục Minh Chứng (Evidence)

1. `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`: Handler tích hợp matcher, chiếu DTO gọn nhẹ, Active-only, không leak điểm số.
2. `backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`: Overload `SearchProperties` và `CompareProperties` cho `PublicPropertyDto`.
3. `backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesSyntheticTests.cs`: 28 unit tests synthetic NO DB kiểm thực toàn diện handler wiring và DTO shape.
4. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests thuật toán matcher.
5. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 Approved.
6. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET CoreCLR.
7. `docs/agent-coordination/submission.md`: Bản tường trình Submission P5-FUZZY-INTEGRATE-02 Round 1.
8. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.
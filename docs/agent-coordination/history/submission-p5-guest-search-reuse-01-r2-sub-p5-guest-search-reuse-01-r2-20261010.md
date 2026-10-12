# Submission: P5-GUEST-SEARCH-REUSE-01 (Round 2)

- **TaskId:** P5-GUEST-SEARCH-REUSE-01
- **Round:** 2
- **SubmissionId:** sub-p5-guest-search-reuse-01-r2-20261010
- **ReviewedSubmissionId:** sub-p5-guest-search-reuse-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T22:56:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Khắc Phục Ý Kiến Đánh Giá Round 1 (Resolution of Review Findings)

Đáp ứng đầy đủ 3 phát hiện của Reviewer (Codex) trong văn bản đánh giá Round 1 tại [`docs/agent-coordination/review.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/review.md), Antigravity đã hoàn thiện bản cập nhật Round 2 như sau:

---

### 1.1. Khắc phục Finding 1 ([P1] — Đường Reset Thống Nhất, Request Invalidation & Chặn Stale Cross-Property State)
1. **Đường reset selection và quote thống nhất (`resetSelectionAndQuote`):**
   - Đã tạo hàm trợ năng `resetSelectionAndQuote()` trong [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts).
   - Hàm này đồng thời đặt `selectedRoomTypeId.set(null)`, `selectedRoomType.set(null)`, `currentQuote.set(null)`, và tăng monotonic counter `quoteRequestId++` để hủy bỏ hiệu lực mọi response báo giá đang bay.
   - Được gọi tập trung tại tất cả các điểm thay đổi ngữ cảnh cơ sở lưu trú:
     - Khi người dùng chủ động chọn khách sạn khác trong dropdown (`onPropertyChange`).
     - Khi người dùng thay đổi tiêu chí thuê / thời gian (`onSearchCriteriaChange`).
     - Khi kết quả tìm kiếm cơ sở chuyển sang cơ sở đầu tiên của tập kết quả mới (`props.length > 0`).
     - Khi kết quả tìm kiếm không tìm thấy cơ sở nào (`props.length === 0`).
2. **Invalidate Availability & Quote Requests và chặn response stale:**
   - Đã bổ sung hai request counters riêng biệt: `availabilityRequestId` và `quoteRequestId`.
   - Trong `searchAvailability()`: Gán `currentAvailReqId = ++this.availabilityRequestId; currentSlug = slug;`. Khi callback trả về, nếu `currentAvailReqId !== this.availabilityRequestId` hoặc `currentSlug !== this.searchForm.get('propertySlug')?.value`, kết quả bị **discard hoàn toàn**, không thể ghi đè danh sách phòng của cơ sở khác.
   - Trong `loadQuote()`: Gán `currentQuoteReqId = ++this.quoteRequestId; currentSlug = slug;`. Khi callback trả về, nếu `currentQuoteReqId !== this.quoteRequestId`, `currentSlug !== this.searchForm.get('propertySlug')?.value`, hoặc `roomTypeId !== this.selectedRoomTypeId()`, báo giá bị **discard hoàn toàn**.
3. **Chặn `submitHold()` với selection từ cơ sở cũ:**
   - Trong `submitHold()`, thêm validation tường minh:
     `if (this.guestForm.invalid || !slug || !selectedProp || !selectedRoom || !quote || selectedProp.slug !== slug) return;`
     Bảo đảm tuyệt đối không thể gửi request giữ phòng khi `selectedRoomType` không thuộc cơ sở lưu trú đang chọn trên form.
4. **Bổ sung 3 test cases chuyên biệt trong Vitest ([`public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts)):**
   - `should reset room selection and quote when search switches from Property A to Property B`: Kiểm tra trạng thái room selection và quote từ cơ sở A được reset sạch khi tìm kiếm chuyển sang cơ sở B.
   - `should discard late availability response from Property A when Property B is now active`: Sử dụng `Subject` kiểm tra response phòng trống của A trả về muộn sau B bị discard, không ghi đè kho phòng B.
   - `should clear selection and discard pending Property A availability when search yields empty results`: Kiểm tra khi tìm kiếm rỗng, selection bị xóa và response phòng trống đang pending của A khi về sau cũng bị discard.

---

### 1.2. Khắc phục Finding 2 ([P2] — Chuẩn Hóa Keyword 1 Lần, Debounce Churn & Minh Bạch Tradeoff Scan)
1. **Chuẩn hóa từ khóa tìm kiếm 1 lần duy nhất:**
   - Bổ sung phương thức `MatchesNormalized(string? source, string normalizedSearch)` trong [`VietnameseTextNormalizer.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs).
   - Trong [`GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs): Từ khóa `request.Search` chỉ được gọi `VietnameseTextNormalizer.Normalize()` **1 lần duy nhất** trước vòng lặp, thay vì lặp lại 3 lần cho mỗi property.
2. **Giảm request churn bằng Debounce và Lifecycle Cleanup:**
   - Trong `booking.page.ts`: Đã thêm subscription trên `propertySearchControl.valueChanges` qua pipeline RxJS:
     ```typescript
     this.searchSubscription = this.propertySearchControl.valueChanges
       .pipe(
         debounceTime(300),
         distinctUntilChanged()
       )
       .subscribe(val => this.loadProperties(val?.trim() || undefined));
     ```
   - Component thực thi `OnDestroy` và hủy subscription sạch sẽ trong `ngOnDestroy()`.
3. **Minh bạch hóa Tradeoff & Giới hạn kỹ thuật (Technical Limitations):**
   - **Thực tế:** Test database PostgreSQL hiện tại (`hotel_saas_p1b01a_test`) chưa cài đặt extension `unaccent`. Việc cài đặt extension DB, migration schema hoặc Full-Text Search index đòi hỏi duyệt từ PO (đã tách độc lập tại PO Gate 3 & PO Gate 4).
   - **Tradeoff:** Handler hiện tại thực hiện in-memory scan sau khi chiếu các cột tối thiểu của Active properties thành `PublicPropertyDto`. Đây là **in-memory application filter scan**, không phải là database-bounded query; nếu số lượng Active properties tăng lớn, giải pháp database extension (PO Gate 4) sẽ cần được xem xét và triển khai sau khi PO phê duyệt.

---

### 1.3. Khắc phục Finding 3 ([P2] — Đính Chính Số Lượng Fact/Theory, Thứ Tự Sắp Xếp & Đính Kèm Log Thật)
1. **Đính chính số lượng test counts:**
   - `VietnameseTextNormalizerTests`: Tổng cộng **47 tests** (42 tests ban đầu + 5 tests mới cho `MatchesNormalized`). (Đã đính chính việc ghi nhầm số 48 ở round 1).
   - `GetPublicPropertiesQueryTests`: Tổng cộng **18 tests** (6 Fact/Theory methods chạy với 18 bộ dữ liệu trên real PostgreSQL schema).
   - Tổng cộng backend Application test suite: **65 tests PASS** trong `HotelSaas.Application.Tests.dll`.
   - `public-booking.page.spec.ts`: Tổng cộng **15 tests PASS** (12 tests round 1 + 3 tests race conditions round 2).
   - Tổng cộng frontend Vitest suite: **153 tests PASS** trên toàn bộ 11 test files.
2. **Đính chính thứ tự sắp xếp (Ordering):**
   - Thứ tự sắp xếp xác định trong `GetPublicPropertiesQuery.cs:41-42` là **theo tên tăng dần (`p.Name`), tie-break theo `p.Id`**:
     ```csharp
     .OrderBy(p => p.Name)
     .ThenBy(p => p.Id)
     ```
   - Đã sửa lại mô tả trong văn bản báo cáo cho khớp 100% với mã nguồn hiện hữu, không sửa mã nguồn để hợp lý hóa báo cáo sai.

---

## 2. Minh Chứng Kiểm Thử Tái Lập (Verifiable Test Evidence)

### 2.1. Backend Tests (100% PASS - 65/65 tests)

- **Lệnh thực thi:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~VietnameseTextNormalizerTests|FullyQualifiedName~GetPublicPropertiesQueryTests"
  ```
- **Kết quả thực tế từ console:**
  ```text
  Passed!  - Failed: 0, Passed: 65, Skipped: 0, Total: 65, Duration: 17 s - HotelSaas.Application.Tests.dll (net10.0)
  Exit Code: 0
  ```

- **Chi tiết kiểm thử thành phần:**
  - `VietnameseTextNormalizerTests`: **47 tests** (42 tests chuẩn hóa Unicode/NFC/NFD/đ/Đ/casing/accents + 5 tests `MatchesNormalized`).
  - `GetPublicPropertiesQueryTests`: **18 tests** (Blank/null search, Name diacritics/casing, Address search, City search, No-match empty list, Inactive-only filter exclusion).

### 2.2. Frontend Vitest Tests (100% PASS - 153/153 tests)

- **Lệnh thực thi feature specs:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts
  ```
- **Kết quả thực tế từ console:**
  ```text
  RUN  v5.0.3 C:/Dev/hotel-saas-v2/frontend
  ✓ src/app/features/public-booking/public-booking.page.spec.ts (15 tests) 45ms

  Test Files  1 passed (1)
       Tests  15 passed (15)
    Duration  1.36s
  Exit Code: 0
  ```

- **Lệnh thực thi full suite frontend:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run
  ```
- **Kết quả thực tế từ console:**
  ```text
  Test Files  11 passed (11)
       Tests  153 passed (153)
    Duration  3.56s
  Exit Code: 0
  ```

---

## 3. Danh Mục Tệp Thay Đổi (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| [`backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs) | Chỉnh sửa | Bổ sung `MatchesNormalized` tránh chuẩn hóa từ khóa lặp lại |
| [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs) | Chỉnh sửa | Chuẩn hóa `request.Search` 1 lần trước vòng lặp; giữ nguyên ordering `Name` rồi `Id` |
| [`backend/tests/HotelSaas.Application.Tests/Public/VietnameseTextNormalizerTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/VietnameseTextNormalizerTests.cs) | Chỉnh sửa | Thêm 5 test cases cho `MatchesNormalized` (nâng tổng lên 47 tests) |
| [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) | Chỉnh sửa | Triển khai `resetSelectionAndQuote()`, invalidation guards cho availability và quote, debounce 300ms, `ngOnDestroy` cleanup |
| [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) | Chỉnh sửa | Bổ sung 3 test cases cho cross-property selection reset, late availability race guard, empty-search cancellation |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Cập nhật | Báo cáo chi tiết khắc phục Round 1 và đính chính các metrics kiểm thử |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật | Chuyển sang `Submitted`, round 2, release writer lock về `none` |

---

## 4. Bàn Giao & Đề Xuất Tiếp Theo (Handoff & Next Steps)

- Toàn bộ các yêu cầu của Reviewer (Codex) trong Round 1 đã được giải quyết trọn vẹn.
- Writer lock được giải phóng về `none` trong `task.json`.

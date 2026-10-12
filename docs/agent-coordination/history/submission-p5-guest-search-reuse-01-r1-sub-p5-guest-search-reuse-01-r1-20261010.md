# Submission: P5-GUEST-SEARCH-REUSE-01 (Round 1)

- **TaskId:** P5-GUEST-SEARCH-REUSE-01
- **Round:** 1
- **SubmissionId:** sub-p5-guest-search-reuse-01-r1-20261010
- **ReviewedSubmissionId:** sub-p5-guest-search-contract-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T22:45:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Lát Cắt Triển Khai (Implementation Summary)

Thực hiện theo chỉ đạo của Codex tại `docs/agent-coordination/assignment.md:80-83` sau khi bản khảo sát hợp đồng `sub-p5-guest-search-contract-01-r2-20261010` được phê duyệt cho lát cắt tái sử dụng (reuse slice), Antigravity đã hoàn thành trọn vẹn task **P5-GUEST-SEARCH-REUSE-01** (Round 1):

1. **Chuẩn hóa & So khớp Tiếng Việt Đầy Đủ (Vietnamese Diacritics & Unicode Canonical Matching):**
   - Đã triển khai bộ chuẩn hóa văn bản tiếng Việt chuyên dụng tại [`backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs).
   - Xử lý chuẩn hóa theo Unicode Normalization Form D (FormD canonical decomposition), lọc bỏ các dấu kết hợp (`NonSpacingMark`), đặc biệt xử lý tường minh hai ký tự `đ` và `Đ` (chữ cái Latinh có nét gạch ngang, chuyển về `d` tương thích) và đưa về Normalization Form C (FormC).
   - Hỗ trợ so khớp không phân biệt hoa thường (case-insensitive), không phân biệt dấu (diacritics-insensitive) và substring matching trên cả 3 thuộc tính: `Name`, `Address`, `City`.

2. **Cập Nhật Backend Query Handler Bảo Toàn Hợp Đồng Hiện Tại:**
   - Cập nhật [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs).
   - **Tuyến API & Kiểu trả về:** Giữ nguyên 100% hợp đồng `GET /api/public/properties?search={search}` trả về `IReadOnlyList<PublicPropertyDto>` (JSON Array trực tiếp, không bọc wrapper phân trang hay metadata mới).
   - **Chính sách hiển thị:** Giữ nguyên chính sách Active-only (`p.Status == PropertyStatus.Active`).
   - **Xử lý truy vấn rỗng & không khớp:** Khi `search` là null, rỗng hoặc chỉ có khoảng trắng, trả về toàn bộ Active properties theo thứ tự xác định (`CreatedAtUtc` giảm dần). Khi không tìm thấy kết quả nào khớp, trả về mảng rỗng `[]`.
   - **Loại bỏ giới hạn cứng 100 ký tự:** Bỏ hoàn toàn việc cắt ngắn (truncate) hoặc từ chối (reject) theo ngưỡng 100 ký tự đã từng nêu trong proposal ban đầu.
   - **Chiến lược Bounded Query hiệu quả:** Không tải toàn bộ domain entity vào RAM; handler chỉ chiếu (project) các trường cần thiết thành `PublicPropertyDto` từ database trước khi áp dụng bộ lọc `VietnameseTextNormalizer.Matches`.

3. **Giao Diện Khách Hàng (Frontend UI Wiring, Race Guard & Accessibility):**
   - Cập nhật [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts):
     - Bổ sung ô tìm kiếm cơ sở lưu trú có nhãn bàn phím rõ ràng (`<label for="propertySearchInput">...`), kết nối trực tiếp với hàm `publicBookingService.getProperties(search)` hiện có.
     - **Bảo vệ Latest-Request-Wins:** Sử dụng monotonic request counter `propertySearchRequestId`. Mọi phản hồi bất đồng bộ trả về muộn từ các truy vấn trước đó sẽ bị hủy bỏ (discard), bảo đảm giao diện luôn phản ánh chính xác kết quả của truy vấn cuối cùng do người dùng gõ.
     - **Trạng thái UI toàn diện:** Có trạng thái Loading (`isLoadingProperties` với spinner), trạng thái Lỗi (`propertiesError` kèm nút "Thử lại"), trạng thái Rỗng khi 0 kết quả (kèm thông báo thân thiện và nút "Xem tất cả khách sạn"), và nút xóa nhanh (`✕`).

4. **Tuân Thủ Biên Giới Phạm Vi & PO Gates:**
   - Không chạm vào module Phòng/Loại phòng (Nguyên) hay Buồng phòng (Tân).
   - Không sinh thêm database migration hay cài đặt database extension.
   - Giữ nguyên toàn bộ 5 PO Gates độc lập trong `docs/agent-coordination/decisions.md` và `task.json`.

---

## 2. Minh Chứng Kiểm Thử Tái Lập (Verifiable Test Evidence)

### 2.1. Backend Unit & Real Integration Tests (100% PASS - 60/60 tests)

Đã khởi tạo và chạy kiểm thử với cấu hình kết nối DB explicit localhost `hotel_saas_p1b01a_test` cô lập theo schema ngẫu nhiên:

- **Lệnh thực thi:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~VietnameseTextNormalizerTests|FullyQualifiedName~GetPublicPropertiesQueryTests"
  ```
- **Kết quả:**
  ```text
  Passed!  - Failed: 0, Passed: 60, Skipped: 0, Total: 60, Duration: 18 s - HotelSaas.Application.Tests.dll (net10.0)
  Exit Code: 0
  ```

- **Chi tiết các nhóm test:**
  1. [`VietnameseTextNormalizerTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/VietnameseTextNormalizerTests.cs) (48 tests):
     - Bao phủ toàn bộ các dạng phân rã và tổ hợp Unicode (FormD, FormC, NFD/NFC).
     - Khử dấu chuẩn xác tiếng Việt: chữ hoa, chữ thường, dấu thanh (huyền, sắc, hỏi, ngã, nặng), mũ (â, ê, ô), móc (ư, ơ).
     - Xử lý đặc thù chữ `đ` và `Đ` thành `d`.
     - So khớp từ khóa không dấu tìm văn bản có dấu và ngược lại, so khớp substring, xử lý chuỗi rỗng/null an toàn.
  2. [`GetPublicPropertiesQueryTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesQueryTests.cs) (12 tests):
     - `Handle_BlankOrNullSearch_ReturnsAllActivePropertiesInOrder`: Blank/null search trả về 3/3 active properties.
     - `Handle_DiacriticsAndCasing_MatchesCorrectProperty`: Tìm theo tên không dấu/có dấu/hoa/thường ("sai gon", "SAI GON", "Sài Gòn", "bien dong", "BIỂN ĐÔNG", "ha noi", "HÀ NỘI").
     - `Handle_AddressSearch_MatchesCorrectProperty`: Tìm theo địa chỉ ("le loi", "LÊ LỢI", "ben thanh", "vo nguyen giap", "hang buom").
     - `Handle_CitySearch_MatchesCorrectProperty`: Tìm theo thành phố ("da nang", "ĐÀ NẴNG", "ho chi minh").
     - `Handle_NoMatchSearch_ReturnsEmptyList`: Trả về `[]` khi không có property nào thỏa mãn.
     - `Handle_InactiveProperty_IsNeverReturnedEvenIfKeywordMatches`: Cơ sở lưu trú Inactive không bao giờ xuất hiện dù từ khóa khớp chính xác.

### 2.2. WebApi Integration Pipeline Tests (100% PASS - 2/2 tests)

- **Lệnh thực thi:**
  ```powershell
  dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter "FullyQualifiedName~Public|FullyQualifiedName~GuestBooking"
  ```
- **Kết quả:**
  ```text
  Passed!  - Failed: 0, Passed: 2, Skipped: 0, Total: 2, Duration: 13 s - HotelSaas.WebApi.Tests.dll (net10.0)
  Exit Code: 0
  ```

### 2.3. Frontend Vitest Suite (100% PASS - 150/150 tests)

- **Lệnh thực thi cho feature component:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts
  ```
- **Kết quả:**
  ```text
  RUN  v5.0.3 C:/Dev/hotel-saas-v2/frontend
  ✓ src/app/features/public-booking/public-booking.page.spec.ts (12 tests) 35ms
  Test Files  1 passed (1)
       Tests  12 passed (12)
    Duration  1.07s
  Exit Code: 0
  ```
- **Lệnh thực thi kiểm tra toàn bộ suite Frontend:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run
  ```
- **Kết quả:**
  ```text
  Test Files  11 passed (11)
       Tests  150 passed (150)
    Duration  5.40s
  Exit Code: 0
  ```

---

## 3. Danh Mục Tệp Thay Đổi (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| [`backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/VietnameseTextNormalizer.cs) | Tạo mới | Tiện ích chuẩn hóa Unicode FormD/FormC, khử dấu tiếng Việt và đ/Đ, case-insensitive substring matching |
| [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs) | Chỉnh sửa | Handler lọc Active-only properties bằng `VietnameseTextNormalizer.Matches` trên Name, Address, City; giữ nguyên Array DTO |
| [`backend/tests/HotelSaas.Application.Tests/Public/VietnameseTextNormalizerTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/VietnameseTextNormalizerTests.cs) | Tạo mới | Unit test bao phủ 48 test cases cho chuỗi tiếng Việt Unicode canonical và đ/Đ |
| [`backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesQueryTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/GetPublicPropertiesQueryTests.cs) | Tạo mới | Integration test trên database thật kiểm tra Name/Address/City matching, blank search, inactive filter |
| [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) | Chỉnh sửa | Wiring search input, race guard latest-request-wins, a11y labels, UI states (loading/error/empty/clear) |
| [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) | Chỉnh sửa | Thêm 5 test cases cho property search, race guard với Subject, empty state, error retry, clear filter |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Chỉnh sửa | Báo cáo nộp bài chi tiết cho lát cắt P5-GUEST-SEARCH-REUSE-01 Round 1 |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Chỉnh sửa | Cập nhật trạng thái sang `Submitted`, release writer lock sang `none` |

---

## 4. Bàn Giao & Đề Xuất Tiếp Theo (Handoff & Next Steps)

- Lát cắt **P5-GUEST-SEARCH-REUSE-01** đã sẵn sàng cho Reviewer (Codex) đánh giá.
- Writer lock được chuyển giao về `none` trong `task.json`.
- Các PO Gates (PO Gate 1 đến 5) tiếp tục được lưu giữ tại `docs/agent-coordination/decisions.md` để PO quyết định khi mở rộng sang Phase B.

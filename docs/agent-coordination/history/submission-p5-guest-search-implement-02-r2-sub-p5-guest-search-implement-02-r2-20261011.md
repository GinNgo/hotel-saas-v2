# Submission: P5-GUEST-SEARCH-IMPLEMENT-02 (Round 2)

- **TaskId:** P5-GUEST-SEARCH-IMPLEMENT-02
- **Round:** 2
- **SubmissionId:** sub-p5-guest-search-implement-02-r2-20261011
- **ReviewedSubmissionId:** sub-p5-guest-search-implement-02-r1-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **Branch:** develop @ commit 3f95339
- **SubmittedAt:** 2026-10-11T12:15:00+07:00
- **Actor:** antigravity
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **0 can thiệp backend C#:** Giữ nguyên 100% backend; không chỉnh sửa controllers, DTOs hay services.
2. **0 kết nối database:** Không cấu hình connection strings, không migration, không DML tới bất kỳ cơ sở dữ liệu nào (dev/staging/prod).
3. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
4. **0 dependency mới:** Không cài thêm bất kỳ thư viện bên ngoài hay remote CDN nào; sử dụng hoàn toàn Angular 19/Tailwind tokens và inline SVG có sẵn.
5. **0 che giấu lỗi giao diện bằng `overflow-x: hidden`:** Không áp dụng `overflow-x: hidden` trên body/html để che hiện tượng tràn layout; 100% phần tử được co giãn và khống chế kích thước tự nhiên qua CSS Grid `minmax(0, 1fr)` và `min-w-0`.
6. **Không thêm comment inline mới:** Tuân thủ hướng dẫn repository, không thêm chú thích code inline mới vào `booking.page.ts`.

---

## 2. Giải Quyết Triệt Để Các Phát Hiện Từ Codex Review (Round 1 Findings)

### 2.1. Phát Hiện 1 (P1): Loại Bỏ Hoàn Toàn Tự Động Chọn Cơ Sở Khi Khám Phá (Discovery)
- **Vấn Đề Trong Round 1:** Khi `loadProperties` nhận được kết quả danh sách khách sạn (khởi tạo, tìm kiếm, xóa từ khóa, CTA), code cũ tự động gán `props[0]` vào `selectedProperty` và kích hoạt `searchAvailability()`, vi phạm mô hình tìm kiếm 2 bước và gây ngắt quãng giữa ô nhập điểm đến đang trống với khách sạn được chọn ngầm.
- **Biện Pháp Khắc Phục:**
  - Trong `booking.page.ts:loadProperties`: Loại bỏ hoàn toàn khối `else if (props.length > 0)`. Khi danh sách cơ sở trả về, nếu không trùng với slug đã chọn trước đó, `selectedProperty` được đặt về `null`, `propertySlug` đặt về `''` và **tuyệt đối không gọi `searchAvailability()`**.
  - Việc chọn cơ sở và truy vấn phòng trống chỉ được thực hiện thông qua hành động tường minh của khách hàng: nhấp vào thẻ khách sạn (`selectProperty(prop)`) hoặc chọn gợi ý từ combobox (`selectSuggestion(prop)`).
- **Kiểm Thử Bổ Sung:** Bổ sung test phát dữ liệu response khác rỗng trên cả 4 điểm khám phá (khởi tạo `ngOnInit`, tìm kiếm từ khóa `loadProperties('keyword')`, xóa tìm kiếm `clearPropertySearch()`, và nút CTA tìm kiếm `handleMainSearchCta()`), xác nhận `selectedProperty` luôn là `null` và `getAvailability` được gọi đúng 0 lần cho đến khi có hành động chọn tường minh.

### 2.2. Phát Hiện 2 (P1): Xóa Gợi Ý Đồng Bộ Tức Thời & Hủy Debounce Khi Chọn
- **Vấn Đề Trong Round 1:** Trong thời gian debounce 300ms sau khi người dùng gõ phím, gợi ý cũ vẫn tồn tại trong DOM và có thể được chọn bằng phím Enter; phản hồi API trễ có thể quay lại ghi đè kết quả; và chọn gợi ý không hủy timer debounce đang chờ.
- **Biện Pháp Khắc Phục:**
  - Trong `propertySearchControl.valueChanges` và `clearPropertySearch()`: Ngay khi người dùng gõ ký tự hoặc xóa tìm kiếm, đồng bộ xóa rỗng `properties.set([])`, đặt `activeSuggestionIndex.set(-1)`, tăng `propertySearchRequestId++`, và hủy subscription `propertiesSub?.unsubscribe()` trước khi thiết lập timer debounce 300ms.
  - Trong `selectSuggestion(prop)`: Gọi ngay `cancelPendingSearchDebounce()`, đặt `isLoadingProperties.set(false)`, tăng `propertySearchRequestId++` và hủy `propertiesSub` để triệt tiêu mọi request và timer đang chờ, bảo toàn lựa chọn tường minh của người dùng.
  - Trong computed signal `activeSuggestionId`: Thêm điều kiện kiểm tra nghiêm ngặt `(this.isComboboxOpen() && idx >= 0 && idx < props.length)`, đảm bảo thuộc tính `aria-activedescendant` không bao giờ trỏ tới phần tử không tồn tại trong danh sách hiển thị.
- **Kiểm Thử Bổ Sung:**
  - Test phản hồi hoãn lại (deferred response) đến trước 300ms bị hủy bỏ hoàn toàn bởi ID guard.
  - Test phím Enter trước 300ms không thể kích hoạt gợi ý cũ vì danh sách đã bị xóa rỗng tức thì.
  - Test chọn gợi ý trong cửa sổ debounce hủy triệt để timer và không để truy vấn từ khóa cũ ghi đè.
  - Test kiểm tra `activeSuggestionId` luôn trả về `undefined` khi danh sách rỗng hoặc chỉ số vượt quá giới hạn.

### 2.3. Phát Hiện 3 (P2): Kiểm Tra Tính Hợp Lệ Lịch Nghiêm Ngặt & Bảo Vệ Ngày Trả Phòng
- **Vấn Đề Trong Round 1:** `areDatesValid()` chỉ so sánh chuỗi cơ bản, không kiểm tra ngày có thực sự tồn tại trong lịch và không kiểm tra ngày quá khứ; `submitHold()` chưa được bảo vệ bởi guard này; `onDateChange('checkOut')` tự ý lùi ngày nhận phòng về quá khứ khi ngày trả phòng $\le$ ngày nhận phòng.
- **Biện Pháp Khắc Phục:**
  - Tích hợp hàm `parseDateParts` từ `date-time.util.ts`: Kiểm tra nghiêm ngặt định dạng `YYYY-MM-DD` và ngày thực tế trong lịch Gregory (từ chối 31/02, 31/04, 29/02 năm thường).
  - So sánh ngày với `getTodayVnDateString()`: Từ chối mọi ngày lưu trú trong quá khứ (`< today` theo giờ Việt Nam UTC+7).
  - Đặt guard `areDatesValid()` đồng nhất trên cả 3 biên hệ thống: kiểm tra phòng trống (`searchAvailability()`), tính toán báo giá (`loadQuote()`), và tạo giữ phòng (`submitHold()`).
  - Trong `onDateChange('checkOut')`: Khi ngày trả phòng $\le$ ngày nhận phòng, tự động điều chỉnh ngày trả phòng tiến lên thành `ngày nhận phòng + 1 ngày` cùng thông báo trợ năng `dateAdjustmentNotice` (role="status", aria-live="polite"), **tuyệt đối không bao giờ lùi ngày nhận phòng về quá khứ**.
- **Kiểm Thử Bổ Sung:**
  - Test các trường hợp biên: ngày null, rỗng, sai lịch (`2026-02-31`), ngày quá khứ (`2020-01-01`), ngày trả $\le$ ngày nhận phòng xác nhận trả về `false` và chặn 100% request tại availability, quote, và hold.
  - Test `onDateChange('checkOut')` với ngày trả phòng xung đột xác nhận ngày trả dời tiến lên `checkIn + 1 day`, ngày nhận phòng được giữ nguyên, và không phát request nếu ngày nhận phòng vốn ở quá khứ.

### 2.4. Tinh Gọn Giao Diện Mobile & Nút Thuê Phòng
- Giảm padding banner Hero từ `p-6 sm:p-10` xuống `p-4 sm:p-8`.
- Bỏ huy hiệu "Cổng Đặt Phòng Trực Tiếp" trùng lặp trong hero banner.
- Rút ngắn nhãn nút chuyển hình thức thuê phòng thành "Theo đêm" và "Theo giờ", kết hợp `flex-1 sm:flex-initial` giúp 2 nút nằm song song gọn gàng trên mobile 375px mà không bị đội chiều cao.

---

## 3. Kết Quả Xác Minh & Kiểm Thử Toàn Diện (Verification Results)

### 3.1. Targeted Behavioral Unit Tests
- **Lệnh thực thi:**
  ```bash
  npx vitest run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts
  ```
- **Kết quả:** **49 / 49 tests PASS** trên 2 test files (Exit Code: 0).
  - `public-booking.service.spec.ts`: 8/8 tests pass.
  - `public-booking.page.spec.ts`: 41/41 tests pass (bao gồm 7 behavioral tests mới cho Round 2).
- **Log file:** `docs/agent-coordination/evidence/guest-search-implement-02/vitest-targeted.log`

### 3.2. Full Frontend Test Suite
- **Lệnh thực thi:**
  ```bash
  npx vitest run
  ```
- **Kết quả:** **179 / 179 tests PASS** trên toàn bộ 11 test files (Exit Code: 0).
  - `date-time.util.spec.ts`: 28 passed
  - `payment.service.spec.ts`: 4 passed
  - `rate.service.spec.ts`: 3 passed
  - `rates.page.spec.ts`: 16 passed
  - `policies.page.spec.ts`: 20 passed
  - `housekeeping.page.spec.ts`: 14 passed
  - `reservations.page.spec.ts`: 38 passed
  - `public-booking.service.spec.ts`: 8 passed
  - `public-booking.page.spec.ts`: 41 passed
  - `app.spec.ts`: 1 passed
  - `date-range-filter.component.spec.ts`: 6 passed
- **Log file:** `docs/agent-coordination/evidence/guest-search-implement-02/vitest-full.log`

### 3.3. Production Build
- **Lệnh thực thi:**
  ```bash
  npm run build (ng build)
  ```
- **Kết quả:** Build thành công 100% (Exit Code: 0).
- **Log file:** `docs/agent-coordination/evidence/guest-search-implement-02/frontend-build.log`

---

## 4. Bằng Chứng Giao Diện Thực Tế Trên Chromium (Production UI Evidence)

Được chụp trực tiếp từ ứng dụng Angular thật thông qua `chrome-devtools-mcp` trên máy chủ fixture loopback (`http://127.0.0.1:4282`):

| Viewport | Kích Thước (W $\times$ H) | DPR | Kích Thước Tệp | SHA256 Hash |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop 1440px** | 1440 $\times$ 900 | 1.0 | 253,571 B | `18AAC74279256314815677FEC0CBDE8323F41E9ABABB01200B7C93B0A9D05A1C` |
| **Tablet 768px** | 768 $\times$ 1024 | 1.0 | 206,330 B | `F2CE85E0B805AC5CE54F4714F91FC9A095D1FEDA162DC63234899D03A480A2BB` |
| **Mobile 375px** | 375 $\times$ 812 | 2.0 | 339,381 B | `470FA0C232B9DE54855C7874C41B1EFD4BE0A50A06259FCA57B62A29D8781F20` |
| **Combobox Dropdown Open** | 1440 $\times$ 900 | 1.0 | 255,631 B | `C0EEBC72A9BBEA9BC6795901E9F94EB3AF0E2C2E10E8DCC44CD63ACC1F82A920` |

---

## 5. Danh Sách Tệp Thay Đổi & Hash SHA256 Xác Thực

1. `frontend/src/app/features/public-booking/booking.page.ts`:
   - SHA256: `DF1BD3B477C15879362DF11466D3472E864102ED92C64A7D8AF3409B175AB05E`
2. `frontend/src/app/features/public-booking/public-booking.page.spec.ts`:
   - SHA256: `0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`
3. `docs/agent-coordination/evidence/guest-search-implement-02/desktop-1440.png`:
   - SHA256: `18AAC74279256314815677FEC0CBDE8323F41E9ABABB01200B7C93B0A9D05A1C`
4. `docs/agent-coordination/evidence/guest-search-implement-02/tablet-768.png`:
   - SHA256: `F2CE85E0B805AC5CE54F4714F91FC9A095D1FEDA162DC63234899D03A480A2BB`
5. `docs/agent-coordination/evidence/guest-search-implement-02/mobile-375.png`:
   - SHA256: `470FA0C232B9DE54855C7874C41B1EFD4BE0A50A06259FCA57B62A29D8781F20`
6. `docs/agent-coordination/evidence/guest-search-implement-02/combobox-dropdown-open.png`:
   - SHA256: `C0EEBC72A9BBEA9BC6795901E9F94EB3AF0E2C2E10E8DCC44CD63ACC1F82A920`
7. `docs/agent-coordination/evidence/guest-search-implement-02/fixture-server.cjs`:
   - SHA256: `ADC4A9CE5FE46D8414AAFE6BC9A0A00D810FCF35046B2584CFB35C64EA0515B8`
8. `docs/agent-coordination/evidence/guest-search-implement-02/vitest-targeted.log`:
   - SHA256: `A9AD5AB3F955F42D2EDBCBD996E912CB9C69A2681E19C38B4573F6D4618295DB`
9. `docs/agent-coordination/evidence/guest-search-implement-02/vitest-full.log`:
   - SHA256: `09ABE7FB53F946C432EE75705D0DB0A7708577FBEB52A89F09329ABEB6BC2374`
10. `docs/agent-coordination/evidence/guest-search-implement-02/frontend-build.log`:
   - SHA256: `1EE07FEFACA05EFB817E8037BA993297187CB11EDB129D7EF98844BF7F95F143`
11. `docs/agent-coordination/evidence/guest-search-implement-02/manifest.json`:
   - Tệp manifest mô tả môi trường, kết quả kiểm thử, kích thước tệp và mã băm toàn vẹn.

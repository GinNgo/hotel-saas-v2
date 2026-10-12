# Đề Xuất Thiết Kế Lại Form Tìm Kiếm Khách Hàng Lấy Cảm Hứng Từ Agoda (P5-GUEST-SEARCH-FORM-02)

- **Mã Task:** `P5-GUEST-SEARCH-FORM-02`
- **Vòng (Round):** 4 (Khắc Phục Triệt Để Cắt Xén Ngang Phần Tử Trên Mobile 375px & Báo Cáo Đo Đạc Element Containment Rectangles Toàn Diện)
- **Tác giả:** Antigravity (Pair Programming Agent)
- **Ngày lập:** 11/10/2026
- **Workspace:** `C:\Dev\hotel-saas-v2` (`develop` @ commit `3f95339`)
- **Trạng thái:** Chờ Reviewer Codex thẩm định đề xuất Round 4 trước khi viết mã nguồn production

---

## 1. Audit Hiện Trạng & Phân Tích Khoảng Cách Với Mẫu Hình Agoda (UI Audit & Gap Analysis)

### 1.1. Phản hồi từ PO & Quan sát thực tế từ Agoda
- **Phản hồi của PO:** Giao diện khách hàng hiện tại còn thô, nặng tính kỹ thuật, bố cục chưa hấp dẫn; yêu cầu học hỏi form tìm kiếm hiện đại từ Agoda (`https://www.agoda.com/vi-vn/`).
- **Quan sát chuẩn từ Agoda (Observation live từ chat 11/10):**
  1. **Khối tìm kiếm nổi bật (Floating Search Card):** Một container màu trắng nổi bật, đổ bóng nhẹ nhàng trên nền hero banner, tạo tiêu điểm thị giác ngay khi khách truy cập.
  2. **Cấu trúc 4 phân đoạn liên hoàn:** Điểm đến / Khách sạn (Combobox) $\rightarrow$ Thời gian lưu trú $\rightarrow$ Số lượng khách $\rightarrow$ Nút CTA Tìm kiếm nổi bật.
  3. **Ngôn ngữ người dùng tự nhiên (Customer-centric Copy):** Hoàn toàn vắng bóng thuật ngữ kỹ thuật hay metadata nội bộ; chỉ tập trung vào trải nghiệm lưu trú và thông tin cần thiết.
  4. **Tối ưu hóa không gian Mobile (Search-First Compact Mobile, Zero Clipping):** Form chính và nút CTA hiển thị trọn vẹn trong màn hình đầu tiên ($375 \times 812$ px) mà không cần cuộn trang; các đường track CSS Grid co giãn linh hoạt (`minmax(0, 1fr)`), toàn bộ các phần tử con (`.field-box`, nút `+`, nút CTA, badge) nằm trọn vẹn bên trong thẻ tìm kiếm màu trắng với khoảng đệm an toàn.

### 1.2. Danh sách các vấn đề kỹ thuật và nội dung loại bỏ triệt để
Theo yêu cầu nghiêm ngặt từ PO và Reviewer Codex:
- ❌ **Loại bỏ thuật ngữ kỹ thuật nội bộ (Internal Jargon):**
  - Xóa: *"Thông tin ánh xạ từ PublicPropertyDto"*
  - Xóa: *"Báo giá chuẩn xác từ Pricing Engine"*
  - Xóa: Badge kỹ thuật *"Pricing Engine"*
  - Xóa: *"Khóa hàng độc quyền 15 phút ngay khi gửi yêu cầu"* $\rightarrow$ Thay bằng: *"Giữ phòng 15 phút"*
  - Xóa mã kỹ thuật khỏi tiêu đề thẻ khách sạn: *"Mã: BD01 • Slug: bien-dong-01"* $\rightarrow$ Khách chỉ cần Tên khách sạn và Địa chỉ.
  - Xóa mọi chuỗi kỹ thuật hướng khách: *"HTML5 Native"*, *"Hold-only"*, *"Task ID"* $\rightarrow$ Giữ nguyên nhãn chuẩn khách sạn: *"Thời gian lưu trú"*, *"Số lượng khách"*.
- ❌ **Loại bỏ việc sử dụng Emoji thay thế Icons:**
  - Thay thế toàn bộ emoji (`🏨`, `⏱️`, `🛏️`, `📍`, `⌛`, `✕`) bằng hệ thống **Inline SVG Vector Icons** sắc nét, vector chuẩn mực theo tiêu chuẩn `ui-ux-pro-max`.
- ❌ **Loại bỏ bố cục rời rạc:**
  - Hợp nhất ô tìm kiếm từ khóa và form chọn ngày thành **Một thanh tìm kiếm hợp nhất duy nhất (Unified Floating Search Card)**.

---

## 2. Bằng Chứng Mockup Visual Thực Tế & Kiểm Tra Bao Gói Phần Tử (Element Containment Audit)

Đã xây dựng tệp mockup độc lập bằng HTML/CSS/SVG tự chứa (100% offline, không CDN bên ngoài, không phụ thuộc thư viện mới): [`docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html).

### 2.1. Bảng đo đạc thực tế hình chữ nhật bao quanh (Containment Rectangles) trên Mobile 375px
Khắc phục hiện tượng cắt xén ngang bằng cách áp dụng `minmax(0, 1fr)` cho grid tracks, `min-width: 0` cho các phần tử con và bố cục lại sub-layout ngày theo dạng 2 cột co giãn:

| Phần Tử Giao Diện | Tọa Độ Trái (`left`) | Tọa Độ Phải (`right`) | Chiều Rộng (`width`) | Tràn Thẻ Card (`right > card.right`) | Tràn Màn Hình (`right > 375`) | Trạng Thái Bao Gói |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Hero Banner** | `8.0 px` | `367.2 px` | `359.2 px` | — | **FALSE** | An toàn trong viewport |
| **Search Card (Container trắng)** | `18.0 px` | **`357.2 px`** | `339.2 px` | — | **FALSE** | An toàn trong hero |
| **Fields Grid** | `26.8 px` | `348.4 px` | `321.6 px` | **FALSE** (Cách 8.8px) | **FALSE** | Nằm trọn trong card |
| **Field 1 (Địa điểm / Khách sạn)** | `26.8 px` | `348.4 px` | `321.6 px` | **FALSE** | **FALSE** | Nằm trọn trong card |
| **Nút xóa nhanh `[✕]`** | `295.6 px` | `339.6 px` | `44.0 px` | **FALSE** (Cách 17.6px) | **FALSE** | Nằm trọn trong card |
| **Field 2 (Thời gian lưu trú)** | `26.8 px` | `348.4 px` | `321.6 px` | **FALSE** | **FALSE** | Nằm trọn trong card |
| **Huy hiệu số đêm ("2 đêm")** | `298.2 px` | `339.6 px` | `41.4 px` | **FALSE** (Cách 17.6px) | **FALSE** | Nằm trọn trong card |
| **Field 3 (Số lượng khách)** | `26.8 px` | `348.4 px` | `321.6 px` | **FALSE** | **FALSE** | Nằm trọn trong card |
| **Nút Stepper Cộng `[+]`** | `295.6 px` | **`339.6 px`** | `44.0 px` | **FALSE** (Cách 17.6px) | **FALSE** | **Nằm trọn trong card** |
| **Field 4 / Nút CTA "Tìm phòng"** | `26.8 px` | **`348.4 px`** | `321.6 px` | **FALSE** (Cách 8.8px) | **FALSE** | **Nằm trọn trong card** |

- **Kiểm tra chẩn đoán màn hình 320px (Diagnostic 320px):**
  - Card width: $284.0$ px (`left: 18.0`, `right: 302.0`).
  - `allContainedInCard: true`, `allContainedInViewport: true` (Hoàn toàn không có hiện tượng cắt xén ngang).
- **Vị trí nút CTA theo phương dọc trên Mobile 375px:**
  - Đáy nút CTA nằm tại: **`539.6 px` $\le 812$ px**.
  - Khoảng trống hiển thị bên dưới nút CTA: **`272.4 px`** (`isCtaFullyInInitialViewport: true`).

### 2.2. Danh mục bằng chứng ảnh chụp thực tế trên Chromium

| Viewport / Kịch Bản | Độ Phân Giải (Declared) | DPR | Kích Thước File PNG Thực | Tràn Ngang (`scrollWidth > clientWidth`) | Bằng Chứng Hình Ảnh |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Desktop 1440px** | $1440 \times 900$ | 1.0 | **1440 × 900 px** (304,138 B) | **FALSE** ($1425 / 1425$ px) | [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png) |
| **Tablet 768px** | $768 \times 1024$ | 1.0 | **768 × 1024 px** (232,974 B) | **FALSE** ($753 / 753$ px) | [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png) |
| **Mobile 375px (Compact & Containment)** | $375 \times 812$ | 2.0 | **750 × 1624 px** (369,615 B) | **FALSE** ($375 / 375$ px) | [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) |
| **Trạng Thái Mở Dropdown Combobox** | $1440 \times 900$ | 1.0 | **1440 × 900 px** (309,001 B) | **FALSE** | [`calendar-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png) |

---

## 3. Kiến Trúc Form Tìm Kiếm Trọng Tâm (Search-First Component Architecture)

### 3.1. Bộ chuyển đổi hình thức thuê (Rental Type Switcher)
- Đặt ở góc trên của form tìm kiếm với phong cách pill switch hiện đại:
  - **Qua đêm (Overnight):** Mặc định (`rentalType = 2`).
  - **Theo giờ (Hourly):** Linh hoạt (`rentalType = 1`).
- Đạt chuẩn accessibility & touch targets: Thẻ cha có `role="group"` với `aria-label="Hình thức thuê phòng"`, từng nút có `[attr.aria-pressed]`, bo tròn `rounded-xl`, kích thước tối thiểu $\ge 44$px (`min-height: 44px; min-width: 44px;`), focus-visible indicator rõ ràng.

### 3.2. Khối 1: Điểm đến / Khách sạn (Destination / Property Selector)
- **Biểu tượng:** SVG `MapPin` tinh tế màu Indigo.
- **Tiêu đề trường:** "Địa điểm / Khách sạn".
- **Ô nhập liệu:** Input văn bản có nút xóa nhanh `[✕]` (`propertySearchControl`), kích thước nút xóa $44 \times 44$px dễ chạm ngón tay.
- **Gợi ý thả xuống (Autocomplete Combobox):**
  - Khi gõ từ khóa, hiển thị danh sách cơ sở lưu trú lọc từ API `getProperties(search)`.
  - Hiển thị tên khách sạn, địa chỉ, thành phố kèm badge "Đang hoạt động".
  - Tái sử dụng server search hiện có (tìm kiếm tiếng Việt có/không dấu, đ/Đ). Không nạp toàn bộ cơ sở dữ liệu vào client.

### 3.3. Khối 2: Thời gian lưu trú (HTML5 Native Date Controls)
- **Biểu tượng:** SVG `Calendar` thanh lịch.
- **Tiêu đề trường:** "Thời gian lưu trú".
- **Chốt giải pháp kỹ thuật:**
  - Thống nhất dùng **HTML5 Native Date Controls** (`<input type="date">`) được bọc trong container phong cách Agoda kết nối liền mạch giữa Ngày nhận & Ngày trả.
  - Sub-layout co giãn: Trên desktop hiển thị dạng hàng ngang, trên mobile co giãn dạng lưới 2 cột (`minmax(0, 1fr)`) với huy hiệu số đêm ("2 đêm") đặt ở tiêu đề.
  - Loại bỏ hoàn toàn sự phụ thuộc vào các thư viện date picker bên thứ ba, đảm bảo hoạt động ổn định trên mọi trình duyệt mobile và desktop.
- **Chế độ theo giờ (Hourly):** 1 trường chọn Ngày (`<input type="date">`) + 1 trường Dropdown thời lượng thuê (`<select>`: 2, 3, 4 giờ $\le$ `maxHourlyHours`).

### 3.4. Khối 3: Số lượng khách (Guest Counter Stepper)
- **Biểu tượng:** SVG `Users` thân thiện.
- **Tiêu đề trường:** "Số lượng khách".
- **Tương tác:** Stepper với 2 nút `[-]` và `[+]`, kích thước đạt chuẩn touch target tối thiểu **$44 \times 44$ px** (`width: 44px; height: 44px;`).
- **Đơn nguồn dữ liệu (Single Source of Truth):**
  - Gắn kết trực tiếp vào form control duy nhất: **`guestForm.get('numberOfGuests')`**.
  - Không tạo thêm form controls rời rạc hay state phân tách adults/children ngoài hợp đồng backend.

### 3.5. Khối 4: Nút Tìm kiếm (Search Action CTA)
- Nút màu tím Indigo nổi bật: `min-height: 48px`, full-width trên Mobile.
- Biểu tượng SVG `Search` + Chữ "Tìm phòng".

---

## 4. Chuẩn Hóa Chuyển Đổi Thời Gian UTC/VN & Bảng Ánh Xạ Trường (Time Conversion & Field Mapping)

### 4.1. Quy đổi chính xác múi giờ theo Source Code hiện tại
Tuân thủ tuyệt đối hành vi hiện hữu của source code (`booking.page.ts:862-873`):

1. **Thuê qua đêm (Overnight - `rentalType = 2`):**
   - Nhận phòng: `${checkInDate}T07:00:00Z` $\rightarrow$ Tương ứng **14:00 giờ Việt Nam (UTC+7)** (Giờ nhận phòng tiêu chuẩn).
   - Trả phòng: `${checkOutDate}T05:00:00Z` $\rightarrow$ Tương ứng **12:00 giờ Việt Nam (UTC+7)** (Giờ trả phòng tiêu chuẩn).
2. **Thuê theo giờ (Hourly - `rentalType = 1`):**
   - Bắt đầu: `${hourlyDate}T07:00:00Z` $\rightarrow$ Tương ứng **14:00 giờ Việt Nam (UTC+7)**.
   - Kết thúc: `endHour = 7 + durationHours`, định dạng `${hourlyDate}T${endHour}:00:00Z`.
   - Trường Model: **`hourlyDurationHours`** (kiểu `number`, giá trị 2, 3, 4 theo cấu hình `maxHourlyHours` của cơ sở lưu trú).

### 4.2. Bảng ánh xạ trường và hợp đồng API

| Trường Giao Diện | Tên Form Control | DTO Field Backend | Kiểu Dữ Liệu | Endpoint Sử Dụng | Quy Tắc Nghiệp Vụ & An Toàn |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Hình thức thuê** | `rentalType` | `RentalType` | `number` | `availability`, `quotes`, `hold` | 1 = Hourly, 2 = Overnight. Mặc định 2. |
| **Tìm khách sạn** | `propertySearchControl` | `search` | `string` | `GET /api/public/properties?search=` | Tìm kiếm không dấu/có dấu trên server. |
| **Cơ sở đã chọn** | `propertySlug` | `slug` | `string` | `GET /properties/{slug}/availability` | Lấy từ cơ sở lưu trú Active. |
| **Ngày nhận phòng** | `checkInDate` | `startAtUtc` | `string` | `availability`, `quotes`, `hold` | `${checkInDate}T07:00:00Z` (14:00 VN). |
| **Ngày trả phòng** | `checkOutDate` | `endAtUtc` | `string` | `availability`, `quotes`, `hold` | `${checkOutDate}T05:00:00Z` (12:00 VN). Trả sau Nhận. |
| **Ngày thuê theo giờ**| `hourlyDate` | `startAtUtc` | `string` | `availability`, `quotes`, `hold` | `${hourlyDate}T07:00:00Z` (14:00 VN). |
| **Thời lượng thuê** | `hourlyDurationHours` | `endAtUtc` | `number` | `availability`, `quotes`, `hold` | 2, 3, 4 giờ $\le$ `maxHourlyHours`. |
| **Số lượng khách** | `guestForm.numberOfGuests` | `NumberOfGuests` | `number` | `POST /api/public/bookings/hold` | Giới hạn 1 - 10 khách. Single control source. |

---

## 5. Đặc Tả Hợp Đồng Tương Tác Vòng Đời & Biên (Lifecycle & Edge Contracts)

### 5.1. Vòng đời Chỉnh Sửa / Xóa Điểm Đến (Destination Edit & Clear Lifecycle)
Khi người dùng nhập ký tự mới vào ô tìm kiếm hoặc nhấn nút xóa nhanh `[✕]`:
1. **Hủy ngay lập tức (Immediate Invalidation):**
   - Đặt lại danh sách gợi ý về rỗng (`suggestions = []`).
   - Xóa bỏ cơ sở đã chọn: `selectedProperty = null`, `propertySlug = null`.
   - Xóa bỏ kết quả phòng trống hiện tại: `availabilityResults = null`.
   - Xóa bỏ báo giá đang giữ: `currentQuote.set(null)`.
2. **Bảo vệ Stale Response (Stale Guard):**
   - Tăng Request ID: `propertySearchRequestId++`, `availabilityRequestId++`, `quoteRequestId++`.
   - Bất kỳ phản hồi mạng nào đang bay (in-flight) có Request ID cũ hơn giá trị hiện tại đều bị bỏ qua (ignored), tránh tình trạng ghi đè dữ liệu cũ lên giao diện.
3. **Chặn Event Bubbling:** Sử dụng `event.stopPropagation()` khi nhấp chọn thẻ gợi ý hoặc nút xóa `[✕]`.

### 5.2. Hợp Đồng Biên Về Ngày Lưu Trú (Date Edge Contracts)
1. **Ngày rỗng, chưa đủ hoặc không hợp lệ (Null/Empty/Partial Dates):**
   - Nếu `checkInDate` hoặc `checkOutDate` chưa được nhập hoặc chỉ mới nhập một vế (partial):
     - **Tuyệt đối không gửi request:** Không gọi `getAvailability`, không gọi `getQuote`, không gọi `holdBooking`.
     - Khu vực kho phòng hiển thị thông báo trạng thái hướng dẫn: *"Vui lòng chọn ngày nhận và trả phòng hợp lệ để tra cứu phòng trống."*
2. **Tự động điều chỉnh ngày trả phòng (Auto Checkout Adjustment):**
   - Nếu người dùng chọn `checkInDate >= checkOutDate`:
     - Tự động điều chỉnh: `checkOutDate = checkInDate + 1 ngày`.
     - Thông báo trực quan với thuộc tính tiếp cận `role="status"` và `aria-live="polite"`: *"Ngày trả phòng đã được tự động điều chỉnh thành dd/mm/yyyy (1 đêm)."*
3. **Chặn ngày trong quá khứ:** Thuộc tính `min = today` ngăn chặn chọn ngày trong quá khứ.
4. **Reset Báo Giá:** Mọi thao tác thay đổi ngày nhận, ngày trả hoặc thời lượng thuê giờ đều tự động gọi `currentQuote.set(null)`.

### 5.3. Hợp Đồng Trạng Thái Gợi Ý & Khả Năng Tiếp Cận ARIA (Autocomplete States & ARIA)
1. **3 Trạng thái phản hồi:**
   - **Đang tải (Loading):** Hiển thị spinner và dòng chữ *"Đang tìm kiếm cơ sở lưu trú..."*.
   - **Không có kết quả (Empty):** Hiển thị *"Không tìm thấy khách sạn phù hợp với từ khóa '{keyword}'"*.
   - **Lỗi kết nối (Error):** Hiển thị *"Không thể tải danh sách gợi ý"* kèm nút *"Thử lại"*.
2. **Thuộc tính ARIA chuẩn Combobox:**
   - Ô nhập giữ DOM focus: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded="true/false"`, `aria-controls="property-suggestions-list"`, `aria-activedescendant="suggestion-{index}"` (bỏ qua thuộc tính này khi chưa có mục active).
   - Danh sách dropdown: `id="property-suggestions-list"`, `role="listbox"`, `aria-label="Danh sách gợi ý khách sạn"`.
   - Từng mục: `id="suggestion-{index}"`, `role="option"`, `aria-selected="true/false"`.
3. **Điều hướng bàn phím:**
   - `ArrowDown` / `ArrowUp`: Di chuyển focus qua lại giữa các gợi ý (cập nhật `aria-activedescendant`).
   - `Enter`: Chọn mục đang highlight, gán `propertySlug`, đóng dropdown.
   - `Escape`: Đóng dropdown mà không đổi giá trị đã chọn.

### 5.4. Tính Minh Bạch Về Số Khách (Occupancy Transparency)
- Endpoint `GET /api/public/properties/{slug}/availability` **không** nhận tham số lọc số khách.
- Giá trị `numberOfGuests` chỉ phục vụ việc gửi thông tin khi tạo lệnh giữ phòng (`POST /api/public/bookings/hold`).
- Từng thẻ phòng trống hiển thị rõ ràng nhãn sức chứa tối đa (`maxOccupancy: X khách`) để khách hàng tự đối chiếu và đưa ra quyết định phù hợp.

---

## 6. Tiêu Chí Chấp Nhận (Acceptance Criteria)

1. **Bao gói phần tử Mobile 375px (Zero Horizontal Clipping):**
   - Toàn bộ các phần tử (`.field-box`, nút `+`, nút CTA, night badge, clear button) có `right <= card.right` và `right <= 375px`.
   - Form chính và nút CTA "Tìm phòng" hiển thị trọn vẹn trong màn hình đầu tiên ($375 \times 812$ px), đáy nút CTA nằm tại $\le 540$px, khoảng trống hiển thị phía dưới $\ge 270$px.
   - Tràn ngang: `scrollWidth === clientWidth === 375px` (`hasHorizontalOverflow: false`).
2. **Touch Targets Chuẩn:**
   - Mọi nút bấm, input, mode button và stepper button đều có kích thước tối thiểu $\ge 44 \times 44$ px. Nút CTA $\ge 48$ px.
3. **Độ Tin Cậy Hợp Đồng:**
   - 100% tuân thủ chuyển đổi thời gian hiện hữu (`T07:00:00Z` = 14:00 VN, `T05:00:00Z` = 12:00 VN).
   - Đơn nguồn dữ liệu duy nhất `guestForm.numberOfGuests`.
   - Zero production code edits trong giai đoạn proposal.
4. **Kiểm thử hồi quy:**
   - Toàn bộ 36 tests trong `public-booking.page.spec.ts` + `public-booking.service.spec.ts` tiếp tục PASS.
   - Toàn bộ 166 tests của full test suite tiếp tục PASS.
   - Production bundle build (`ng build`) đạt Exit code 0.

---

## 7. Kế Hoạch Triển Khai Cho Round Tiếp Theo (Implementation Plan)

- **Bước 1 (Template Refactoring):** Tái cấu trúc template form tìm kiếm trong `booking.page.ts` sang mô hình Agoda floating search card; tích hợp inline SVG icons và loại bỏ văn bản kỹ thuật.
- **Bước 2 (Stepper & Autocomplete Wiring):** Kết nối form control `numberOfGuests` với stepper đạt chuẩn 44px và hoàn thiện combobox gợi ý khách sạn có đầy đủ ARIA, keyboard navigation và stale guards.
- **Bước 3 (Date Validation & Conversion Integration):** Tích hợp HTML5 native date controls với quy đổi chuẩn UTC/VN (`T07:00:00Z` và `T05:00:00Z`), tự động điều chỉnh ngày trả phòng và reset quote khi thay đổi ngày.
- **Bước 4 (Regression & Unit Tests):** Cập nhật test cases trong `public-booking.page.spec.ts` để kiểm chứng cấu trúc form mới, stepper 44px, combobox ARIA và accessibility.
- **Bước 5 (Visual Evidence & Manifest):** Chạy kiểm chứng trên Chromium tại 375px, 768px, 1440px và xuất ảnh thực tế kèm manifest.

# Submission: P5-GUEST-SEARCH-FORM-02 (Round 2)

- **TaskId:** P5-GUEST-SEARCH-FORM-02
- **Round:** 2
- **SubmissionId:** sub-p5-guest-search-form-02-r2-20261011
- **ReviewedSubmissionId:** sub-p5-guest-search-form-02-r1-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T10:52:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Tuân thủ quy tắc PO & Reviewer Codex ("Không production code cho tới khi plan được duyệt"):** Round 2 là vòng hoàn thiện tài liệu đề xuất, mockup HTML visual thực tế trên Chromium và đặc tả hợp đồng tương tác. Giữ nguyên 100% mã nguồn production (`booking.page.ts`).
2. **0 can thiệp backend C#:** Giữ nguyên 100% backend; không chỉnh sửa controllers, DTOs hay services.
3. **0 kết nối database:** Không cấu hình connection strings, không migration, không DML tới bất kỳ cơ sở dữ liệu nào.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 dependency mới:** Không cài thêm bất kỳ gói npm bên ngoài nào; mockup hoàn toàn tự chứa (self-contained inline HTML/CSS/SVG), zero remote CDN, zero external fonts/scripts.

---

## 2. Giải Quyết Triệt Để 3 Yêu Cầu Thay Đổi Từ Reviewer Codex (Round 1 Findings Resolution)

### 2.1. Giải quyết Finding 1 (HIGH — Mockup visual HTML/CSS/SVG thực tế trên Chromium)
- **Vấn đề Round 1:** Chỉ có wireframe ASCII và bảng markdown, chưa có bằng chứng visual pixel thực tế cho các viewports 375px/768px/1440px.
- **Biện pháp giải quyết Round 2:**
  1. Đã xây dựng trang mockup hoàn chỉnh độc lập tại [`docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html) (SHA256: `A7B23312C47C4191778D20A20416B635743DE9C36D8D2D5744BDBFB7E480784C`).
  2. Sử dụng Chromium trực tiếp qua `chrome-devtools-mcp` với CDP `Emulation.setDeviceMetricsOverride` để kết xuất và chụp 4 ảnh bằng chứng thực tế:
     - **Desktop 1440px:** [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png) (1440x900 px, 366,831 bytes, `hasHorizontalOverflow: false`).
     - **Tablet 768px:** [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png) (768x1024 px, 264,827 bytes, `hasHorizontalOverflow: false`).
     - **Mobile 375px (Compact):** [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) (750x1624 px, DPR 2.0, 498,350 bytes, `hasHorizontalOverflow: false`).
     - **Popovers Mở (Dual Calendar & Autocomplete):** [`calendar-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png) (1440x900 px, 116,132 bytes).
  3. Lập manifest chi tiết xác thực toàn vẹn: [`docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json).

### 2.2. Giải quyết Finding 2 (MEDIUM — Sửa quy đổi giờ UTC/VN & Single Control numberOfGuests)
- **Vấn đề Round 1:** Ghi nhầm UTC `T07:00:00Z` là 07:00 VN và dùng tên trường chưa khớp model hiện hữu; tách rời state/control của số khách.
- **Biện pháp giải quyết Round 2:**
  1. **Đối chiếu chính xác hành vi source code (`booking.page.ts:862-873`):**
     - **Overnight (`rentalType = 2`):**
       - Nhận phòng: `${checkInDate}T07:00:00Z` $\rightarrow$ Tương ứng **14:00 giờ Việt Nam (UTC+7)** (giờ check-in tiêu chuẩn).
       - Trả phòng: `${checkOutDate}T05:00:00Z` $\rightarrow$ Tương ứng **12:00 giờ Việt Nam (UTC+7)** (giờ check-out tiêu chuẩn).
     - **Hourly (`rentalType = 1`):**
       - Bắt đầu: `${hourlyDate}T07:00:00Z` $\rightarrow$ Tương ứng **14:00 giờ Việt Nam (UTC+7)**.
       - Kết thúc: `endHour = 7 + durationHours`, định dạng `${hourlyDate}T${endHour}:00:00Z`.
       - Trường Model: **`hourlyDurationHours`** (kiểu `number`, giá trị 2, 3, 4 theo cấu hình `maxHourlyHours` của cơ sở lưu trú).
  2. **Đơn nguồn dữ liệu (Single Source of Truth) cho số lượng khách:**
     - Stepper tương tác (`[-]` và `[+]`, 1 đến 10 khách) gắn kết trực tiếp vào form control duy nhất: **`guestForm.get('numberOfGuests')`**.
     - Không phân tách `adults`/`children` ngoài hợp đồng DTO backend.

### 2.3. Giải quyết Finding 3 (MEDIUM — Đặc tả Hợp đồng Tương tác & Lựa chọn Thành phần)
- **Hành vi Nút CTA "Tìm phòng" trong Quy trình 2 bước (2-Step Discovery):**
  - **Bước 1 (Chưa chọn cơ sở lưu trú):** Nhấn "Tìm phòng" kích hoạt lọc danh sách khách sạn qua `getProperties(searchKeyword)` và cuộn mượt xuống danh sách. Nếu người dùng chọn từ gợi ý Autocomplete, gán `propertySlug` và chuyển sang Bước 2.
  - **Bước 2 (Đã chọn cơ sở & ngày):** Nhấn "Tìm phòng" gọi `getAvailability(...)` để tải danh sách phòng trống khả dụng.
  - **Minh bạch về số lượng khách (Occupancy Transparency):** API `getAvailability` hiện hữu không lọc theo số khách; `numberOfGuests` chỉ gửi khi tạo hold (`POST /api/public/bookings/hold`). Giao diện hiển thị rõ nhãn sức chứa tối đa (`maxOccupancy`) trên từng thẻ phòng để khách tự đối chiếu.
- **Hợp đồng Autocomplete Dropdown:**
  - Phím `ArrowDown`/`ArrowUp` di chuyển highlight, `Enter` chọn mục và đóng dropdown, `Escape` đóng mà không thay đổi giá trị.
  - Nút xóa nhanh `[✕]` xóa từ khóa, khôi phục danh sách và hủy timer debounce (300ms).
  - Bảo vệ stale response: Sử dụng `propertySearchRequestId++` để loại bỏ phản hồi chậm khi từ khóa đã thay đổi.
  - Ngăn chặn event bubbling: `event.stopPropagation()` khi click chọn thẻ gợi ý.
- **Hợp đồng Xác thực Khoảng ngày (Date Range Validation):**
  - `checkInDate` không nằm trong quá khứ (`min = today`).
  - `checkOutDate` bắt buộc sau `checkInDate`; tự động tăng `checkOutDate = checkInDate + 1` nếu người dùng chọn ngày nhận $\ge$ ngày trả.
  - Thay đổi bất kỳ thông tin ngày/giờ nào đều tự động reset báo giá hiện tại: `currentQuote.set(null)`.
- **Lựa chọn thành phần (Component Choice):**
  - Chọn kiến trúc **Agoda-style Connected Segment Container** tích hợp HTML5 date controls tối ưu hóa định dạng hiển thị `dd/mm/yyyy` và nhãn số đêm tự động tính toán.
  - Loại trừ rủi ro xung đột theme PrimeNG, đảm bảo 0 dependency mới và hoạt động tự nhiên trên mobile/desktop.

---

## 3. Danh Mục Artifacts Gửi Kèm

| Loại Tài Liệu | Đường Dẫn Tệp | SHA256 / Mô Tả |
| :--- | :--- | :--- |
| **Đề Xuất & Đặc Tả** | [`docs/agent-coordination/guest-search-form-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-search-form-proposal.md) | Bản đề xuất Round 2 cập nhật đầy đủ hợp đồng & visual |
| **Bản Lưu Trữ Round 1** | [`docs/agent-coordination/history/submission-p5-guest-search-form-02-r1-20261011.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/history/submission-p5-guest-search-form-02-r1-20261011.md) | Lưu trữ bản nộp Round 1 phục vụ truy vết |
| **Trang Mockup HTML** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html) | `A7B23312C47C4191778D20A20416B635743DE9C36D8D2D5744BDBFB7E480784C` |
| **Ảnh Desktop 1440px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png) | `5C862B5BACAEEE4196ADC16EBFF4554EBD2DC8F7BC9E68EDC50A8430A202A6AC` |
| **Ảnh Tablet 768px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png) | `45CB8F6F758EDD390D2956EE1263AAC27A84BFB4635492AE74A842A2845EC912` |
| **Ảnh Mobile 375px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) | `6B1DDC94FBA774D9A4CCAC87F6DDF1AA950494FD75871D294B953CEC18FFE6EA` |
| **Ảnh Popovers Mở** | [`docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png) | `EFA94ED54CACA1EAC10FBFAC882C68A97EF7BA21EB25FC6F64C031505DCFD989` |
| **Manifest Xác Thực** | [`docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json) | Bảng băm SHA256 & thông số kỹ thuật trình duyệt Chromium |

---

## 4. Trạng Thái Baseline & Kế Hoạch Tiếp Theo

- **Mã nguồn:** Giữ nguyên 100% baseline commit `develop` @ `3f95339`.
- **Kế hoạch tiếp theo:** Khi Reviewer Codex phê duyệt kế hoạch đề xuất Round 2 (`Approved` hoặc `ApprovedNext`), tiến hành triển khai mã nguồn production trên `booking.page.ts` và test cases trên `public-booking.page.spec.ts` theo đúng 5 bước đã được phê duyệt.

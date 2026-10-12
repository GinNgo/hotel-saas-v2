# Submission: P5-GUEST-SEARCH-FORM-02 (Round 3)

- **TaskId:** P5-GUEST-SEARCH-FORM-02
- **Round:** 3
- **SubmissionId:** sub-p5-guest-search-form-02-r3-20261011
- **ReviewedSubmissionId:** sub-p5-guest-search-form-02-r2-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T11:06:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Tuân thủ quy tắc PO & Reviewer Codex ("Không production code cho tới khi plan được duyệt"):** Round 3 là vòng hoàn thiện proposal, mockup visual Chromium thực tế và đặc tả hợp đồng tương tác. Giữ nguyên 100% mã nguồn production (`booking.page.ts`).
2. **0 can thiệp backend C#:** Giữ nguyên 100% backend; không chỉnh sửa controllers, DTOs hay services.
3. **0 kết nối database:** Không cấu hình connection strings, không migration, không DML tới bất kỳ cơ sở dữ liệu nào.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 dependency mới:** Không cài thêm bất kỳ gói npm bên ngoài nào; mockup hoàn toàn tự chứa (self-contained inline HTML/CSS/SVG), zero remote CDN, zero external fonts/scripts.

---

## 2. Giải Quyết Triệt Để 3 Yêu Cầu Thay Đổi Từ Reviewer Codex (Round 2 Findings Resolution)

### 2.1. Giải quyết Finding 1 (P1 — Tối ưu Mobile 375px Search-First, thấy trọn vẹn Form & CTA)
- **Vấn đề Round 2:** Header nhiều cột bị wrap, hero 3 dòng quá cao; nút CTA bị đẩy xuống dưới 812px viewport đầu tiên; ví dụ mobile thu nhỏ bên dưới không sửa được form chính.
- **Biện pháp giải quyết Round 3:**
  1. Loại bỏ hoàn toàn khối mobile thu nhỏ dư thừa.
  2. Thu gọn header thành 1 dòng thanh thoát; thu gọn hero padding xuống `14px 12px`, tiêu đề và phụ đề ngắn gọn, tinh tế.
  3. Đổi nhãn chế độ thuê sang tiếng Việt ngắn gọn: **"Qua đêm"** và **"Theo giờ"**.
  4. Thu gọn padding của `.search-card` và các field box.
  5. **Kết quả đo đạc thực tế trên Chromium (Viewport $375 \times 812$ px):**
     - Đáy nút CTA (`btnRect.bottom`) nằm tại: **`569.45px` $\le 812$px**.
     - Khoảng trống hiển thị bên dưới nút CTA: **`242.55px`** (`clearanceBelowCta`).
     - **`isCtaFullyInInitialViewport: true`** — Toàn bộ form tìm kiếm và nút CTA hiển thị trọn vẹn 100% trong màn hình đầu tiên mà không cần cuộn trang.
     - Tràn ngang: `scrollWidth === clientWidth === 375px` (`hasHorizontalOverflow: false`).
  6. Đã chụp lại ảnh thực tế: [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) (750x1624 px, 352,267 bytes, SHA256: `7BD0EFBC8B7172D6181699562532BB7126441AAD6F1260C6CF2C8CFF20B407C1`).

### 2.2. Giải quyết Finding 2 (P2 — Thống nhất HTML5 Native Dates & Chuẩn hóa Nút Bấm $\ge 44$px)
- **Vấn đề Round 2:** Đề xuất chọn HTML5 native dates nhưng mockup lại vẽ popup dual-calendar tuỳ biến gây mâu thuẫn; các nút stepper 32px và 26px vi phạm chuẩn $\ge 44$px.
- **Biện pháp giải quyết Round 3:**
  1. **Thống nhất giải pháp HTML5 Native Date Controls:**
     - Thay thế toàn bộ popup dual-calendar bằng điều khiển ngày native chuẩn HTML5 (`<input type="date">`), tích hợp hiển thị ngày nhận $\rightarrow$ ngày trả kèm nhãn tính số đêm ("2 đêm").
     - Loại bỏ hình vẽ dual-calendar tùy biến; thay bằng 4 thẻ đặc tả trạng thái kỹ thuật rõ ràng: Combobox ARIA, Ràng buộc ngày & Thông báo tự động, 3 Trạng thái phản hồi (Loading/Empty/Error) và Bố cục thuê theo giờ (Hourly).
  2. **Chuẩn hóa Touch Targets $\ge 44$px cho toàn bộ điều khiển:**
     - Nút stepper `[-]` và `[+]`: Nâng lên **$44 \times 44$ px** (`width: 44px; height: 44px;`).
     - Nút xóa nhanh `[✕]`: Nâng lên **$44 \times 44$ px** (`width: 44px; height: 44px;`).
     - Nút chọn chế độ thuê ("Qua đêm" / "Theo giờ"): `min-height: 44px; min-width: 44px;`.
     - Nút CTA "Tìm phòng": `min-height: 48px; height: 48px;`.
  3. **Gắn nhãn dữ liệu thử nghiệm ngoại tuyến:** Đặt banner nổi bật màu hổ phách trên cùng: *"Bản thử nghiệm giao diện ngoại tuyến (Synthetic Offline UI Mockup) • Zero Remote CDN • Zero Production Code"*.

### 2.3. Giải quyết Finding 3 (P2 — Hoàn thiện Hợp đồng Vòng đời & Hợp đồng Biên)
- **Vòng đời Chỉnh sửa / Xóa Điểm đến:**
  - Ngay khi người dùng sửa ký tự hoặc nhấn nút xóa `[✕]`:
    - Lập tức xóa `suggestions = []`.
    - Lập tức xóa `selectedProperty = null`, `propertySlug = null`.
    - Lập tức xóa `availabilityResults = null` và `currentQuote.set(null)`.
    - Tăng Request ID (`propertySearchRequestId++`, `availabilityRequestId++`, `quoteRequestId++`) để loại bỏ mọi phản hồi mạng đang bay (in-flight).
    - Ngăn chặn event bubbling với `event.stopPropagation()`.
- **Hợp đồng Biên về Ngày lưu trú (Null/Partial/Reversed):**
  - Khi ngày nhận hoặc trả phòng là rỗng/chưa đủ (null/empty/partial): Tuyệt đối **không gọi** `getAvailability`, `getQuote` hay `holdBooking`; hiển thị thông báo hướng dẫn người dùng hoàn tất chọn ngày.
  - Khi chọn ngày nhận $\ge$ ngày trả: Hệ thống tự động điều chỉnh `checkOutDate = checkInDate + 1 ngày`, đồng thời phát thông báo tiếp cận qua `role="status"` và `aria-live="polite"`: *"Ngày trả phòng đã được tự động điều chỉnh thành dd/mm/yyyy (1 đêm)"*.
  - Chặn chọn ngày quá khứ qua `min = today`. Mọi thay đổi ngày/giờ đều tự động reset báo giá (`currentQuote.set(null)`).
- **Trạng thái Autocomplete & Tiếp cận ARIA:**
  - 3 Trạng thái phản hồi: Loading (spinner), Empty ("Không tìm thấy khách sạn phù hợp..."), Error ("Không thể tải danh sách gợi ý" kèm nút Thử lại).
  - Thuộc tính ARIA: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls="property-suggestions-list"`, `aria-activedescendant="suggestion-{id}"`, danh sách có `role="listbox"`, mục có `role="option"`.
  - Bàn phím: `ArrowDown`/`ArrowUp` duyệt mục, `Enter` chọn, `Escape` đóng.
- **Bảo toàn ngữ nghĩa API & Quy đổi UTC:**
  - Nhận phòng: `${checkInDate}T07:00:00Z` (14:00 VN), Trả phòng: `${checkOutDate}T05:00:00Z` (12:00 VN).
  - Theo giờ: Bắt đầu `T07:00:00Z` (14:00 VN) với `hourlyDurationHours` (2, 3, 4h $\le$ `maxHourlyHours`).
  - `numberOfGuests`: Single control duy nhất trong `guestForm` phục vụ lệnh hold (`POST /bookings/hold`), các thẻ phòng hiển thị `maxOccupancy` để khách tự đối chiếu (không filter server giả định).

---

## 3. Danh Mục Artifacts Gửi Kèm

| Loại Tài Liệu | Đường Dẫn Tệp | Kích Thước | SHA256 |
| :--- | :--- | :---: | :--- |
| **Đề Xuất & Đặc Tả** | [`docs/agent-coordination/guest-search-form-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-search-form-proposal.md) | ~16 KB | Bản đề xuất Round 3 cập nhật đầy đủ hợp đồng & visual |
| **Bản Lưu Trữ Round 2** | [`docs/agent-coordination/history/submission-p5-guest-search-form-02-r2-20261011.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/history/submission-p5-guest-search-form-02-r2-20261011.md) | ~10 KB | Lưu trữ bản nộp Round 2 phục vụ truy vết |
| **Bản Lưu Trữ Round 1** | [`docs/agent-coordination/history/submission-p5-guest-search-form-02-r1-20261011.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/history/submission-p5-guest-search-form-02-r1-20261011.md) | ~6 KB | Lưu trữ bản nộp Round 1 |
| **Trang Mockup HTML** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html) | 22,879 B | `DC1C5B03AA43A3A3CFEBC4010EB9B6BE28D7FF51A447D9E45D49D9B7B8F2E433` |
| **Ảnh Desktop 1440px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png) | 315,123 B | `5E2EBCB32411E6A5435247719C77391471179EEBB16C0E5A0D17AB9A05D9EE13` |
| **Ảnh Tablet 768px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png) | 245,054 B | `F0A1B5E8ACC227B66FEFFE471F15BBC595D0055D22529AC2860A688096CF40D2` |
| **Ảnh Mobile 375px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) | 352,267 B | `7BD0EFBC8B7172D6181699562532BB7126441AAD6F1260C6CF2C8CFF20B407C1` |
| **Ảnh Đặc Tả Hợp Đồng** | [`docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png) | 315,167 B | `39602CE2530EBDB601E6182FD5B70E69DCDD221D18223AC8A699EC39A42695C1` |
| **Manifest Xác Thực** | [`docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json) | 4,307 B | Bảng băm SHA256 & thông số kỹ thuật Chromium thực tế |

---

## 4. Trạng Thái Baseline & Kế Hoạch Tiếp Theo

- **Mã nguồn:** Giữ nguyên 100% baseline commit `develop` @ `3f95339`.
- **Kế hoạch tiếp theo:** Khi Reviewer Codex phê duyệt kế hoạch đề xuất Round 3 (`Approved` hoặc `ApprovedNext`), Antigravity sẽ tiến hành triển khai mã nguồn production trên `booking.page.ts` và test cases trên `public-booking.page.spec.ts` theo đúng 5 bước đã được phê duyệt.

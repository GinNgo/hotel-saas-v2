# Submission: P5-GUEST-SEARCH-FORM-02 (Round 4)

- **TaskId:** P5-GUEST-SEARCH-FORM-02
- **Round:** 4
- **SubmissionId:** sub-p5-guest-search-form-02-r4-20261011
- **ReviewedSubmissionId:** sub-p5-guest-search-form-02-r3-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T11:16:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Tuân thủ quy tắc PO & Reviewer Codex ("Không production code cho tới khi plan được duyệt"):** Round 4 là vòng hoàn thiện đề xuất, khắc phục triệt để hiện tượng cắt xén phần tử trên mobile, và đo đạc element containment rectangles thực tế trên Chromium. Giữ nguyên 100% mã nguồn production (`booking.page.ts`).
2. **0 can thiệp backend C#:** Giữ nguyên 100% backend; không chỉnh sửa controllers, DTOs hay services.
3. **0 kết nối database:** Không cấu hình connection strings, không migration, không DML tới bất kỳ cơ sở dữ liệu nào.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 dependency mới:** Không cài thêm bất kỳ gói npm bên ngoài nào; mockup hoàn toàn tự chứa (self-contained inline HTML/CSS/SVG), zero remote CDN, zero external fonts/scripts.

---

## 2. Giải Quyết Triệt Để Yêu Cầu Cắt Xén Ngang Phần Tử (Round 3 Finding Resolution)

### 2.1. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)
- Trong Round 3, mặc dù `scrollWidth === clientWidth === 375px` (do thẻ cha `.hero-section` có `overflow: hidden`), các phần tử con (`.field-box`, nút `+`, nút CTA) đã bị phình to vượt quá chiều rộng của thẻ card trắng (card width: 331.2px, nhưng các field mở rộng đến 345.9px và right edge đạt 378.7px).
- Nguyên nhân: Track grid mặc định `1fr` thực chất là `minmax(auto, 1fr)`. Hai điều khiển `<input type="date">` chuẩn native cùng dải phân cách và badge đặt trên cùng một dòng ngang có kích thước nội tại (intrinsic min-content width) vượt quá không gian khả dụng, đẩy toàn bộ track grid dãn ra ngoài thẻ card và bị cắt xén ở mép phải.

### 2.2. Biện pháp kỹ thuật khắc phục triệt để (Shrinkable Layout Implementation)
1. **Chuyển đổi toàn bộ Grid tracks sang co giãn linh hoạt:**
   - Sử dụng `minmax(0, 1fr)` thay thế cho `1fr` thuần túy trên toàn bộ container grid.
   - Thêm `min-width: 0` trên tất cả grid items, flex containers (`.field-box`, `.field-input-row`, `.native-dates-container`, `.stepper`).
2. **Tái cấu trúc Sub-layout Ngày lưu trú trên Mobile:**
   - Trên mobile (< 640px), tách ngày nhận và ngày trả thành 2 cột co giãn cân đối (`grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`), chuyển huy hiệu số đêm ("2 đêm") lên dòng tiêu đề trường.
   - Mỗi ô nhập ngày có đầy đủ không gian hiển thị (~140px) mà không bị xung đột kích thước nội tại.
3. **Bảo toàn kích thước nút chuẩn $\ge 44$px:**
   - Nút stepper `[-]` và `[+]`: Giữ nguyên **$44 \times 44$ px**, nằm hoàn toàn bên trong thẻ card với khoảng đệm an toàn 17.6px từ mép phải (`plusBtn.right = 339.6px` < `card.right = 357.2px`).
   - Nút xóa `[✕]`: $44 \times 44$ px, nằm trọn vẹn trong card.
   - Nút CTA: Chiều cao $48$px, chiều rộng $321.6$px, nằm gọn trong card với khoảng đệm 8.8px.
4. **Làm sạch văn bản hướng tới khách hàng (Customer-facing Copy Clean-up):**
   - Loại bỏ toàn bộ thuật ngữ nội bộ ("HTML5 Native", "Hold-only", "Task ID").
   - Giữ nguyên nhãn khách sạn chuẩn mực: "Thời gian lưu trú", "Số lượng khách", "Hotel Portal".

---

## 3. Bằng Chứng Đo Đạc Thực Tế Trên Chromium (Element Containment Evidence)

Đã kiểm chứng trực tiếp qua CDP `evaluate_script` trên Chromium tại Viewport Mobile 375px ($375 \times 812$ px, DPR 2.0):

```json
{
  "viewport": { "width": 375, "height": 812 },
  "hero": { "left": 8.0, "right": 367.2, "width": 359.2 },
  "card": { "left": 18.0, "right": 357.2, "width": 339.2 },
  "grid": { "left": 26.8, "right": 348.4, "width": 321.6 },
  "elements": [
    { "name": "fieldDestination", "left": 26.8, "right": 348.4, "width": 321.6, "overflowsCardRight": false },
    { "name": "fieldDates", "left": 26.8, "right": 348.4, "width": 321.6, "overflowsCardRight": false },
    { "name": "fieldGuests", "left": 26.8, "right": 348.4, "width": 321.6, "overflowsCardRight": false },
    { "name": "fieldCta", "left": 26.8, "right": 348.4, "width": 321.6, "overflowsCardRight": false },
    { "name": "clearBtn", "left": 295.6, "right": 339.6, "width": 44.0, "overflowsCardRight": false },
    { "name": "nightBadge", "left": 298.2, "right": 339.6, "width": 41.4, "overflowsCardRight": false },
    { "name": "plusBtn", "left": 295.6, "right": 339.6, "width": 44.0, "overflowsCardRight": false },
    { "name": "searchBtn", "left": 26.8, "right": 348.4, "width": 321.6, "top": 491.6, "bottom": 539.6, "overflowsCardRight": false }
  ],
  "allContainedInCard": true,
  "allContainedInViewport": true,
  "ctaBottom": 539.6,
  "clearanceBelowCta": 272.4
}
```

- **Kết quả chẩn đoán tại màn hình siêu nhỏ 320px (Diagnostic 320px):**
  - Card width: $284.0$ px (`left: 18.0`, `right: 302.0`).
  - `allContainedInCard: true`, `allContainedInViewport: true` (100% phần tử nằm gọn trong card và viewport).

---

## 4. Danh Mục Artifacts Gửi Kèm

| Loại Tài Liệu | Đường Dẫn Tệp | Kích Thước | SHA256 |
| :--- | :--- | :---: | :--- |
| **Đề Xuất & Đặc Tả** | [`docs/agent-coordination/guest-search-form-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-search-form-proposal.md) | ~17 KB | Bản đề xuất Round 4 cập nhật bảng đo đạc containment |
| **Bản Lưu Trữ Round 3** | [`docs/agent-coordination/history/submission-p5-guest-search-form-02-r3-20261011.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/history/submission-p5-guest-search-form-02-r3-20261011.md) | ~10 KB | Lưu trữ bản nộp Round 3 |
| **Trang Mockup HTML** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mockup.html) | 27,772 B | `05BAF166E6019F22FA2823D877B9455DEF425865E6C4475178233C096C6C0F7A` |
| **Ảnh Desktop 1440px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/desktop-1440.png) | 304,138 B | `076710655409DBEB3F150683F32E378CB83A3FE5C413841C807C130839A3E107` |
| **Ảnh Tablet 768px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/tablet-768.png) | 232,974 B | `CA2FABB2F572E5D0501C299FDC371AEFDA86D5AF26517B433355CF54CC000D7B` |
| **Ảnh Mobile 375px** | [`docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/mobile-375.png) | 369,615 B | `0B42703605CAB01D8C8BBD31843A53090BC4D804F79E08327B748076BB4E26C8` |
| **Ảnh Combobox Mở** | [`docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/calendar-dropdown-open.png) | 309,001 B | `7B519807EB4DCA18937B76DD872FD0F9D88DDFBF5398F7A7E048A4321D2837EA` |
| **Manifest Xác Thực** | [`docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-form-mockup/manifest.json) | 4,496 B | Đo đạc bounding containment rectangles & hashes |

---

## 5. Trạng Thái Baseline & Kế Hoạch Tiếp Theo

- **Mã nguồn:** Giữ nguyên 100% baseline commit `develop` @ `3f95339` (0 dòng code production bị sửa).
- **Kế hoạch tiếp theo:** Khi Reviewer Codex phê duyệt kế hoạch đề xuất Round 4 (`Approved` hoặc `ApprovedNext`), Antigravity sẽ tiến hành triển khai mã nguồn production trên `booking.page.ts` và test cases trên `public-booking.page.spec.ts` theo đúng 5 bước đã được phê duyệt.

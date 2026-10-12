# Báo Cáo Nghiệm Thu: P7-GUEST-SEARCH-VERIFY-02 (Round 1)

- **TaskId:** P7-GUEST-SEARCH-VERIFY-02
- **Round:** 1
- **SubmissionId:** sub-p7-guest-search-verify-02-r1-20261011
- **ReviewedSubmissionId:** sub-p5-guest-search-implement-02-r2-20261011
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** 2026-10-11T12:35:00+07:00
- **Actor:** antigravity
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Invariants)

1. **Xác minh browser thực trên Angular production build (Zero code changes):** Toàn bộ thử nghiệm thực thi trên bản build production thực tế (`dist/hotel-saas-frontend/browser`), phục vụ qua fixture loopback server độc lập (`http://127.0.0.1:4282`). Không có bất kỳ dòng mã nguồn nào bị thay đổi.
2. **0 kết nối database ngoài:** Tuyệt đối không cấu hình hay kết nối tới database dev, staging hay production (0 connection strings, 0 queries, 0 migrations).
3. **100% Cô lập mạng Loopback:** Fixture server `fixture-server.cjs` chạy tại `127.0.0.1:4282`. Kiểm toán qua Chrome DevTools Network Inspector xác nhận 100% API calls đến từ và đi tới loopback local.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Giữ nguyên vẹn mã nguồn của các module Nguyên (`Rooms`/`RoomTypes`) và Tân (`Housekeeping`).
5. **0 che đậy lỗi layout bằng `overflow-x: hidden`:** Kiểm chứng tự nhiên tại các breakpoint 1440px, 768px, 375px và 320px; không sử dụng bất kỳ thủ thuật CSS overflow ẩn nào.
6. **Trung thực về khả năng tiếp cận (Accessibility):** Không bịa đặt chứng chỉ WCAG hay screen-reader; báo cáo chính xác các thuộc tính DOM (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`, `aria-activedescendant`), keyboard events và kích thước touch targets đo đạc thực tế.

---

## 2. Xác Minh Hành Vi Tương Tác Trình Duyệt Thực (Browser Behavior Verification)

Xác minh trực tiếp qua Chromium rendering engine (thông qua `chrome-devtools-mcp` và Chrome DevTools Protocol):

| Mã hành vi | Tiêu chí nghiệm thu | Trạng thái | Chi tiết kiểm chứng thực tế trên DOM |
| :--- | :--- | :---: | :--- |
| **BEH-01** | **Discovery trả nonempty, không tự chọn property hay query inventory** | **PASS** | Truy cập `/booking`: ô tìm kiếm rỗng (`""`), hiển thị 2 thẻ khách sạn khả dụng ("Khách sạn Sài Gòn Central", "Khách Sạn Biển Đông Đà Nẵng"), `selectedProperty = null`, 0 room cards được tải (`hasAvailabilityLoaded: false`). Không có request availability nào được gửi. |
| **BEH-02** | **Explicit selection kích hoạt nạp phòng** | **PASS** | Nhấp chuột vào nút "Chọn cơ sở này & Xem phòng" trên thẻ Khách sạn Sài Gòn Central: `selectedPropertyId` cập nhật thành `"prop-central-sg"`, tải chính xác 2 hạng phòng ("Deluxe Double Room", "Executive Suite"). |
| **BEH-03** | **Immediate context invalidation & Autocomplete keyboard navigation** | **PASS** | Gõ ký tự vào combobox `#propertySearchInput`: ngay lập tức hủy chọn cơ sở hiện tại, gửi request autocomplete debounced, mở dropdown listbox, cập nhật `aria-expanded="true"`. Nhấn `ArrowDown`: `aria-activedescendant` gán thành `"suggestion-0"`. Nhấn `Enter`: chọn mục tương ứng. Nhấn `Escape`: đóng dropdown ngay lập tức. |
| **BEH-04** | **Clear button reset** | **PASS** | Nhấp nút Clear (biểu tượng "×"): xóa trắng nội dung input về `""`, đồng thời reset hoàn toàn lựa chọn cơ sở lưu trú về `null`. |
| **BEH-05** | **Synthetic hold reservation flow** | **PASS** | Chọn hạng phòng "Executive Suite", điền thông tin khách (Họ tên, SĐT, Email), nhấp nút CTA "Tiến hành giữ phòng 15 phút": hệ thống tạo hold token hợp lệ `tok-mv3domni-0vsdm` và chuyển hướng mượt mà sang `/booking/hold/tok-mv3domni-0vsdm`, kích hoạt đồng hồ đếm ngược giữ phòng 15 phút (`14:56`). |

---

## 3. Đo Lường Bố Cục Trình Duyệt & Containment (Real Browser Viewport Measurements)

Toàn bộ thông số được đo lường trực tiếp qua `evaluate_script` (`getBoundingClientRect()`, `window.getComputedStyle()`) trên Chromium thật:

### Bảng tổng hợp Viewports

| Viewport | CSS Dimensions (px) | DPR | `scrollWidth` / `clientWidth` | Tràn ngang | Popup Width / Bounds | Touch Targets ($\ge 44$px) | Bằng chứng ảnh |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Desktop** | $1440 \times 900$ | 1.0 | 1425 / 1425 px | **FALSE** | — | Min-height $44$–$48$px | [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/desktop-1440.png) |
| **Dropdown Open** | $1440 \times 900$ | 1.0 | 1425 / 1425 px | **FALSE** | $357.9$px (z-index: 50) | Option height $54.1$px | [`combobox-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/combobox-dropdown-open.png) |
| **Tablet** | $768 \times 1024$ | 1.0 | 753 / 753 px | **FALSE** | — | Min-height $44$–$48$px | [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/tablet-768.png) |
| **Mobile** | $375 \times 812$ | 2.0 | 375 / 375 px | **FALSE** | — | Controls $44$–$48$px | [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375.png) |
| **Mobile Popup** | $375 \times 812$ | 2.0 | 375 / 375 px | **FALSE** | $276.0$px (z-index: 50) | Option height $54.1$px | [`mobile-375-popup.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375-popup.png) |
| **Diagnostic 320** | $320 \times 568$ | 2.0 | 320 / 320 px | **FALSE** | $220.8$px (right: $270.4$) | Tất cả nút $\le 283.2$px | *Đo lường trong JSON* |

### Chi tiết đo đạc chuyên sâu

1. **Màn hình Mobile 375px (`mobile-375.png`):**
   - Không tràn ngang: `scrollWidth = clientWidth = 375px`.
   - Nút chuyển hình thức thuê cạnh nhau (Side-by-side): "Theo đêm" (`134.8 × 44px`), "Theo giờ" (`134.8 × 44px`), tổng ngang ~278px vừa vặn trong thẻ form.
   - Nút tăng giảm khách: `44 × 44px` (đáp ứng tiêu chuẩn touch target di động).
   - Nút CTA "Tìm phòng": `277.6 × 48px`, min-height $48$px.
   - Nút chọn cơ sở: `301.6 × 44px`, min-height $44$px.
2. **Popup Gợi Ý Trên Mobile 375px (`mobile-375-popup.png`):**
   - Danh sách `#property-suggestions-list`: `width = 276.0px`, `left = 49.6px`, `right = 325.6px` (hoàn toàn nằm gọn trong 375px).
   - `z-index: 50`, `clippedAncestors = []` (0 tổ tiên nào bị `overflow: hidden` cắt xén).
   - Mỗi option mục gợi ý có `height = 54.1px` ($> 44$px), văn bản gồm tên khách sạn, địa chỉ và thành phố hiển thị rõ nét.
3. **Thử nghiệm chuẩn đoán trên màn hình hẹp 320px (Diagnostic 320px):**
   - `scrollWidth = clientWidth = 320px`, `overflowingElementsCount = 0` (0 phần tử nào tràn mép phải 320px).
   - Nút CTA và form controls co giãn tự nhiên: "Theo đêm" (right: 156.0px), "Theo giờ" (right: 271.2px), "Tìm phòng" (right: 271.2px), "Chọn cơ sở" (right: 283.2px).
   - Popup suggestions tại 320px: `width = 220.8px`, `right = 270.4px` (nằm gọn trong 320px).

---

## 4. Kiểm Toán Mạng Outbound Trình Duyệt (Browser Outbound Network Audit)

Kiểm toán trực tiếp qua DevTools Protocol (`list_network_requests`):
- **Tổng số request trong phiên:** 18 requests.
- **Phân loại requests:**
  - `GET http://127.0.0.1:4282/booking` [200 OK] (Document)
  - `GET http://127.0.0.1:4282/chunk-*.js`, `polyfills-*.js`, `main-*.js`, `styles-*.css` [200 OK] (Static bundles)
  - `GET http://127.0.0.1:4282/api/public/properties` [200 OK] (Khám phá ban đầu, không kèm query params hay availability)
  - `GET http://127.0.0.1:4282/api/public/properties?search=S` [200 OK] (Autocomplete debounced)
  - `GET http://127.0.0.1:4282/api/public/properties?search=Kh%C3%A1ch%20s%E1%BA%A1n` [200 OK] (Tìm kiếm theo từ khóa)
  - Duy nhất 1 tài nguyên ngoài là font chữ từ cache trình duyệt: `https://fonts.gstatic.com/...`
- **Kết luận:** 100% request logic và dữ liệu được cách ly tuyệt đối với loopback `127.0.0.1:4282`. Không có bất kỳ kết nối mạng nào ra cơ sở dữ liệu thật hay môi trường cloud.

---

## 5. Danh Mục Bằng Chứng & Bảng Băm SHA256 (Evidence Artifacts & Hashes)

Toàn bộ các tệp bằng chứng được lưu tại thư mục [`docs/agent-coordination/evidence/guest-search-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/):

| Tệp tin bằng chứng | Kích thước (bytes) | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/browser-measurements.json) | 6,236 | `3738ef0e8cc5dc1c2599d0592ac731d7ffd73ee5ee884814368c0470a9c80f7d` | Toàn bộ chỉ số đo đạc DOM, tọa độ rect, z-index, và trạng thái kiểm thử |
| [`combobox-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/combobox-dropdown-open.png) | 255,631 | `c0eebc72a9bbea9bc6795901e9f94eb3af0e2c2e10e8dcc44cd63acc1f82a920` | Ảnh chụp dropdown combobox mở tại 1440px |
| [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/desktop-1440.png) | 253,571 | `18aac74279256314815677fec0cbde8323f41e9ababb01200b7c93b0a9d05a1c` | Ảnh chụp giao diện Desktop chuẩn 1440px |
| [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/fixture-server.cjs) | 12,565 | `adc4a9ce5fe46d8414aafe6bc9a0a00d810fcf35046b2584cfb35c64ea0515b8` | Máy chủ loopback phục vụ static build và synthetic mock endpoints |
| [`frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/frontend-build.log) | 3,039 | `1ee07fefaca05efb817e8037ba993297187cb11edb129d7ef98844bf7f95f143` | Log thực thi `npm run build` không lỗi (exit code 0) |
| [`mobile-375-popup.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375-popup.png) | 372,976 | `0b11bde82445beb6859c7a6818ceae9b605a4f9c15b92fbb440464cc91a76d74` | Ảnh chụp dropdown combobox mở trên Mobile 375px |
| [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375.png) | 339,381 | `470fa0c232b9de54855c7874c41b1efd4be0a50a06259fca57b62a29d8781f20` | Ảnh chụp giao diện Mobile 375px (hero gọn, buttons side-by-side) |
| [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/tablet-768.png) | 207,205 | `763f105cb0e2d2dc554d3ea3f80268a19934a3abe90eaa9b2a48aaee937c0311` | Ảnh chụp giao diện Tablet 768px |
| [`vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/vitest-full.log) | 2,049 | `09abe7fb53f946c432ee75705d0db0a7708577fbeb52a89f09329abeb6bc2374` | Log chạy toàn bộ test suite frontend (179/179 tests pass) |
| [`vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/vitest-targeted.log) | 625 | `a9ad5ab3f955f42d2edbcbd996e912cb9c69a2681e19c38b4573f6d4618295db` | Log chạy targeted booking spec suite (49/49 tests pass) |

---

## 6. Bằng Chứng Thực Thi & Kiểm Thử Đã Duyệt (Test & Build Provenance)

Theo chỉ dẫn của assignment: Reviewer Codex đã độc lập chạy và xác minh `49 targeted / 179 full / build 0` trong review của task P5 trước đó. Do không có bất kỳ thay đổi nào về source code trong lát cắt xác minh P7 này, các kết quả test và build hoàn toàn hợp lệ và nhất quán:
1. **Targeted Vitest Suite:** `49/49` tests passed (`vitest-targeted.log`, exit code: 0).
2. **Full Frontend Suite:** `179/179` tests passed across 11 test files (`vitest-full.log`, exit code: 0).
3. **Production Build:** Angular build thành công tới `dist/hotel-saas-frontend/browser` (`frontend-build.log`, exit code: 0).

---

## 7. Các Cổng Phê Duyệt PO Còn Mở (Open PO Gates & Next Steps)

Giữ nguyên danh sách NeedsPO đã được ghi nhận trong `decisions.md` và `task.json`:
- **PO Gate 1:** Hợp đồng API tìm kiếm: Giữ endpoint hiện tại hay tạo `GET /api/public/search/properties` và kế hoạch di chuyển client.
- **PO Gate 2:** Chính sách xuất bản: Đồng bộ enforce `IsPublished == true` trên toàn bộ public discovery hay giữ Active-only.
- **PO Gate 3:** Nguồn Dataset Hành chính Việt Nam có thẩm quyền, phiên bản, ngày hiệu lực và license.
- **PO Gate 4:** Kế hoạch Migration bổ sung `ProvinceCode`, `Ward`, `WardCode`, `LandmarkTags` cho Property.
- **PO Gate 5:** Cơ chế tìm kiếm phòng trống xuyên cơ sở: Two-step discovery vs Aggregated search theo Tỉnh/Thành.
- **Business Gate:** D21 lookup TTL mốc dự kiến/thực tế + revoke/reissue contract; Quote 5min/hold 15min price pinning.

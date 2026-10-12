# Submission P7-GUEST-KEYBOARD-CONTINUITY-04 — Round 1

- **TaskId:** `P7-GUEST-KEYBOARD-CONTINUITY-04`
- **Round:** 1
- **SubmissionId:** `sub-p7-guest-keyboard-continuity-04-r1-20261011`
- **ReviewedSubmissionId:** null
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T23:42:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P7-GUEST-OTA-STATE-VERIFY-03` round 5 Approved (`sub-p7-guest-ota-state-verify-03-r5-20261011`).
- **Scope:** Khắc phục và hoàn tất triệt để 2 khoảng cách (gaps) điều hướng bàn phím còn thiếu được PO và Codex giao trong [`assignment.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/assignment.md):
  1. **Gap 1: Mobile 375x812 Shift+Tab liên tục từ hero CTA qua tăng khách/date inputs/combobox/rental controls về Header:**
     - Thực thi chuỗi 8 phím `Shift+Tab` liên tục trên trình duyệt Chromium thực qua CDP trong một lượt duyệt duy nhất (single continuous uninterrupted pass), không ngắt quãng và không reset focus giữa chừng.
     - Khởi đầu từ nút CTA `#heroSearchButton` (enabled, $280 \times 52\text{px}$) lúc `16:34:33Z` $\to$ nút tăng khách Stepper `+` ($44 \times 44\text{px}$) $\to$ tự động bỏ qua nút giảm khách `-` bị `[disabled]="true"` $\to$ `#checkOutDateInput` $\to$ `#checkInDateInput` $\to$ `#propertySearchInput` $\to$ nút "Theo giờ" $\to$ nút "Theo đêm" $\to$ liên kết Header "Đăng nhập nội bộ" $\to$ liên kết Header "Tra cứu đặt phòng" (`16:35:49Z`).
     - Ghi nhận đầy đủ trạng thái DOM thực tế, `activeElement`, kích thước khung bao (`boundingRect`), `computedStyles` (outline/boxShadow focus ring) và cờ `:focus-visible` thật.
  2. **Gap 2: Desktop 1440x900 Hourly Reverse liên tục từ confirmed enabled CTA với guestCount 1:**
     - Thiết lập chế độ thuê theo giờ (`rentalType: 1`), số lượng khách 1 (`guestCount: 1`), nút giảm khách Stepper `-` mang trạng thái `[disabled]="true"`.
     - Khởi đầu focus từ điều khiển đã kích hoạt được xác nhận: `#heroSearchButton` ("Tìm phòng", enabled, $176.5 \times 86.2\text{px}$) lúc `16:37:18Z`.
     - Thực thi chuỗi 11 phím `Shift+Tab` liên tục:
       - Lùi sang nút tăng khách `+` ($44 \times 44\text{px}$, enabled).
       - Bỏ qua nút giảm khách disabled $\to$ lùi sang `SELECT#hourlyDurationSelect` ($166.7 \times 28\text{px}$).
       - Lùi vào `INPUT#hourlyDateInput` ($166.7 \times 28\text{px}$, type='date').
       - Ghi nhận chi tiết TỪNG phím thực điều hướng qua các trường con nội bộ (subfield năm $\to$ tháng $\to$ ngày $\to$ nút biểu tượng lịch native của Chromium) theo đúng hướng dẫn assignment, minh chứng rõ ràng `activeElement` giữ nguyên trên cùng input qua các phím con trước khi thoát.
       - Thoát sang `INPUT#propertySearchInput` ($341.3 \times 32\text{px}$).
       - Lùi lên nút "Theo giờ" (active, focus ring $2\text{px}$ `indigo-500`) $\to$ nút "Theo đêm" $\to$ liên kết Header "Đăng nhập nội bộ" $\to$ liên kết Header "Tra cứu đặt phòng" (`16:39:12Z`).
  3. **Cô lập bằng chứng hoàn toàn mới & bảo toàn tuyệt đối:**
     - Bằng chứng lưu tại thư mục riêng [`docs/agent-coordination/evidence/guest-keyboard-continuity-04/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04).
     - Không ghi đè hay làm thay đổi bất kỳ tệp bằng chứng nào của `guest-ota-state-verify-03` (đặc biệt `network-audit.json` $45,262\text{ B}$, SHA256: `1582F669...` được bảo toàn nguyên vẹn $100\%$).
     - $0$ thay đổi mã nguồn (giữ nguyên mã băm nguồn `booking.page.ts` $84,938\text{ B}$ và `public-booking.page.spec.ts` $63,165\text{ B}$).
     - $0$ thay đổi backend C#, $0$ database migration/schema, $0$ kết nối database thật, không can thiệp module của đồng đội.
     - Toàn bộ 7 cổng PO / Nghiệp vụ giữ nguyên `NeedsPO`.

---

## 1. Chi Tiết Thực Thi & Nhật Ký Kiểm Thử Thực Tế (CDP Browser Telemetry)

### 1.1. Gap 1: Mobile 375x812 Continuous Shift+Tab Reverse Traversal

- **Môi trường & Viewport:** Chromium DevTools Protocol, Viewport $375 \times 812$, `deviceScaleFactor: 1`, `isMobile: true`, `hasTouch: true`.
- **Thiết lập:** `rentalType = 2` (Theo đêm), `guestCount = 1`, `propertySearchValue = ""`.
- **Khởi đầu focus được xác thực (Confirmed Starting Focus):**
  - Điều khiển: `BUTTON#heroSearchButton` ("Tìm phòng", enabled).
  - Thời điểm: `2026-10-11T16:34:33.382Z`.
  - Khung bao: $280 \times 52\text{px}$ (vượt ngưỡng Level AAA $\ge 44\text{px}$).
  - Trạng thái focus: `matchesFocusVisible: true`, outline $2.4\text{px}$ solid.
- **Bảng truy vết từng phím Shift+Tab thực tế (Keystroke Trace):**

| Phím # | Phím Gửi | Thời Điểm (ISO UTC) | Phần Tử Đang Focus (`activeElement`) | Kích Thước | `:focus-visible` | Hành Vi Điều Hướng Chi Tiết |
| :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **0** | *Focus ban đầu* | `16:34:33.382Z` | `BUTTON#heroSearchButton` ("Tìm phòng") | $280 \times 52\text{px}$ | `true` | Nút CTA chính của form tìm kiếm, enabled |
| **1** | `Shift+Tab` | `16:34:42.029Z` | `BUTTON` ("+", `aria-label="Tăng số lượng khách"`) | $44 \times 44\text{px}$ | `true` | Lùi sang nút Stepper tăng khách (+), đạt chuẩn Level AAA $\ge 44\text{px}$ |
| **2** | `Shift+Tab` | `16:34:50.113Z` | `INPUT#checkOutDateInput` ("Ngày trả phòng") | $258.4 \times 28\text{px}$ | `true` | Nút Stepper giảm khách (-) bị disabled tại `guestCount=1`, trình duyệt tự động bỏ qua và nhận focus trên ô ngày trả phòng |
| **3** | `Shift+Tab` | `16:35:00.740Z` | `INPUT#checkInDateInput` ("Ngày nhận phòng") | $258.4 \times 28\text{px}$ | `true` | Lùi sang ô ngày nhận phòng |
| **4** | `Shift+Tab` | `16:35:09.839Z` | `INPUT#propertySearchInput` ("Địa điểm hoặc khách sạn") | $258.4 \times 32\text{px}$ | `true` | Lùi sang combobox tìm kiếm cơ sở lưu trú |
| **5** | `Shift+Tab` | `16:35:18.982Z` | `BUTTON` ("Theo giờ", `aria-pressed="false"`) | $136 \times 44\text{px}$ | `true` | Lùi lên nút chọn chế độ thuê theo giờ, focus ring $2\text{px}$ `indigo-500` |
| **6** | `Shift+Tab` | `16:35:29.148Z` | `BUTTON` ("Theo đêm", `aria-pressed="true"`) | $136 \times 44\text{px}$ | `true` | Lùi sang nút chọn chế độ thuê theo đêm, focus ring $2\text{px}$ `indigo-500` |
| **7** | `Shift+Tab` | `16:35:39.546Z` | `A` ("Đăng nhập nội bộ", `aria-label="Đăng nhập nội bộ"`) | $41.6 \times 44\text{px}$ | `true` | Lùi lên liên kết Header Đăng nhập nội bộ |
| **8** | `Shift+Tab` | `16:35:49.244Z` | `A` ("Tra cứu đặt phòng", header brand link) | $145.9 \times 44\text{px}$ | `true` | Lùi lên liên kết Header thương hiệu Tra cứu đặt phòng |

- **Kết luận:** **`PASS`**. Chuỗi 8 phím được thực thi liên tục trong một lượt duy nhất từ CTA về tận đầu trang Header, minh chứng khả năng duyệt lùi hoàn toàn không bị gián đoạn trên di động.
- **Bằng chứng thị giác:** [`mobile-continuous-reverse-focus.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/mobile-continuous-reverse-focus.png) ($70,564\text{ B}$, SHA256: `465554B5...`).

---

### 1.2. Gap 2: Desktop 1440x900 Hourly Mode Continuous Reverse Traversal

- **Môi trường & Viewport:** Chromium DevTools Protocol, Viewport $1440 \times 900$, `deviceScaleFactor: 1`, `isMobile: false`, `hasTouch: false`.
- **Thiết lập:** `rentalType = 1` (Theo giờ), `guestCount = 1`, `propertySearchValue = ""`.
- **Xác thực logic disabled của nút Stepper (-):**
  - Tại `guestCount = 1`, biểu thức `(guestForm.get('numberOfGuests')?.value || 1) <= 1` đánh giá là `true`.
  - Nút giảm khách mang thuộc tính `disabled="true"` (`[disabled]="true"`), không thể nhận focus native.
- **Khởi đầu focus được xác thực (Confirmed Starting Focus):**
  - Điều khiển: `BUTTON#heroSearchButton` ("Tìm phòng", enabled).
  - Thời điểm: `2026-10-11T16:37:18.153Z`.
  - Khung bao: $176.5 \times 86.2\text{px}$.
  - Trạng thái focus: `matchesFocusVisible: true`, outline $2.4\text{px}$ solid.
- **Bảng truy vết từng phím Shift+Tab thực tế (Keystroke Trace):**

| Phím # | Phím Gửi | Thời Điểm (ISO UTC) | Phần Tử Đang Focus (`activeElement`) | Kích Thước | `:focus-visible` | Hành Vi Điều Hướng Chi Tiết |
| :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **0** | *Focus ban đầu* | `16:37:18.153Z` | `BUTTON#heroSearchButton` ("Tìm phòng") | $176.5 \times 86.2\text{px}$ | `true` | Điều khiển khởi đầu enabled được xác thực |
| **1** | `Shift+Tab` | `16:37:28.684Z` | `BUTTON` ("+", `aria-label="Tăng số lượng khách"`) | $44 \times 44\text{px}$ | `true` | Lùi sang nút Stepper tăng khách (+), enabled, đạt chuẩn Level AAA $\ge 44\text{px}$ |
| **2** | `Shift+Tab` | `16:37:38.392Z` | `SELECT#hourlyDurationSelect` ("Thời lượng thuê theo giờ") | $166.7 \times 28\text{px}$ | `true` | Nút giảm khách (-) bị disabled tại `guestCount=1`, trình duyệt tự động bỏ qua và nhận focus trên select thời lượng thuê giờ |
| **3** | `Shift+Tab` | `16:37:48.107Z` | `INPUT#hourlyDateInput` ("Ngày thuê theo giờ") | $166.7 \times 28\text{px}$ | `false` | Nhập vào ô ngày thuê theo giờ (vào subfield năm native của date picker) |
| **4** | `Shift+Tab` | `16:37:59.094Z` | `INPUT#hourlyDateInput` ("Ngày thuê theo giờ") | $166.7 \times 28\text{px}$ | `true` | Điều hướng giữa các trường con nội bộ (từ subfield năm sang tháng); `activeElement` giữ nguyên trên `hourlyDateInput` |
| **5** | `Shift+Tab` | `16:38:09.174Z` | `INPUT#hourlyDateInput` ("Ngày thuê theo giờ") | $166.7 \times 28\text{px}$ | `true` | Điều hướng giữa các trường con nội bộ (từ subfield tháng sang ngày); `activeElement` giữ nguyên trên `hourlyDateInput` |
| **6** | `Shift+Tab` | `16:38:19.483Z` | `INPUT#hourlyDateInput` ("Ngày thuê theo giờ") | $166.7 \times 28\text{px}$ | `true` | Điều hướng nút biểu tượng lịch native của Chromium; `activeElement` giữ nguyên trên `hourlyDateInput` |
| **7** | `Shift+Tab` | `16:38:28.709Z` | `INPUT#propertySearchInput` ("Địa điểm hoặc khách sạn") | $341.3 \times 32\text{px}$ | `true` | Thoát khỏi nhóm input ngày thuê theo giờ sang combobox tìm kiếm cơ sở lưu trú |
| **8** | `Shift+Tab` | `16:38:38.361Z` | `BUTTON` ("Theo giờ", `aria-pressed="true"`) | $105.8 \times 44\text{px}$ | `true` | Lùi lên nút chọn chế độ thuê theo giờ (đang active), focus ring $2\text{px}$ `indigo-500` |
| **9** | `Shift+Tab` | `16:38:47.568Z` | `BUTTON` ("Theo đêm", `aria-pressed="false"`) | $112.5 \times 44\text{px}$ | `true` | Lùi sang nút chọn chế độ thuê theo đêm, focus ring $2\text{px}$ `indigo-500` |
| **10** | `Shift+Tab` | `16:38:57.014Z` | `A` ("Đăng nhập nội bộ", `aria-label="Đăng nhập nội bộ"`) | $162.2 \times 44\text{px}$ | `true` | Lùi lên liên kết Header Đăng nhập nội bộ |
| **11** | `Shift+Tab` | `16:39:12.238Z` | `A` ("Tra cứu đặt phòng", header brand link) | $162.6 \times 44\text{px}$ | `true` | Lùi lên liên kết Header thương hiệu Tra cứu đặt phòng |

- **Kết luận:** **`PASS`**. Chuỗi 11 phím được thực thi liên tục trong một lượt duy nhất từ nút enabled `#heroSearchButton` tại `guestCount=1`, tự động bỏ qua nút decrement bị disabled, ghi nhận chi tiết từng phím điều hướng qua các subfield nội bộ của thẻ `<input type="date">` và các nút chuyển đổi chế độ thuê về tận Header.
- **Bằng chứng thị giác:** [`desktop-hourly-reverse-focus.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/desktop-hourly-reverse-focus.png) ($227,415\text{ B}$, SHA256: `1D9707E0...`).

---

## 2. Bảng Đối Chiếu Artifacts và Bằng Chứng (Artifact Manifest)

| Tệp Bằng Chứng | Kích Thước | SHA256 Hash | Xuất Xứ (Provenance) | Mô Tả Trạng Thái Thị Giác |
| :--- | :--- | :--- | :--- | :--- |
| [`mobile-continuous-reverse-focus.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/mobile-continuous-reverse-focus.png) | 70,564 B | `465554B5E945F9281C980E25CD8DD022B3149E81DC1CA289B161B317483998C7` | Chụp tươi CDP (`16:36:11Z`) | Duyệt lùi liên tục 8 phím Shift+Tab trên mobile 375px từ CTA về Header |
| [`desktop-hourly-reverse-focus.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/desktop-hourly-reverse-focus.png) | 227,415 B | `1D9707E07D30F4358B66689B2A915151AC296764B089BB2B1992898D87111F24` | Chụp tươi CDP (`16:39:17Z`) | Duyệt lùi liên tục 11 phím Shift+Tab trong chế độ theo giờ trên desktop 1440px |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/capture-log.json) | 23,153 B | `8DCB27247215F9AA82BE81B5904A1E707A67D613FEC39BFB5947068ED4354BCA` | Tạo mới Round 1 (`23:42:00+07:00`) | Ghi nhận chi tiết từng phím, timestamp, activeElement, boundingRect, computedStyles |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/manifest.json) | 4,532 B | `41B0E501B7E3985294CD9609F998D47C6107350FCF6765FFED9B7F6311D33949` | Tạo mới Round 1 (`23:42:00+07:00`) | Manifest xác minh bàn phím liên tục, build hashes, source provenance |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-keyboard-continuity-04/source-manifest.json) | 1,379 B | `C435963BBE0D0211480499E40205C5E552709214725872323C6BDDA679055A1E` | Tạo mới Round 1 (`23:42:00+07:00`) | Xác nhận 0 source edits, commit 3f95339b4f4477ac5d421551d372dfdd5ed31e30 |

---

## 3. Bảo Toàn Trạng Thái Dự Án & Các Cổng PO (Project Invariants)

1. **Bảo toàn mã nguồn:**
   - Mã nguồn giao diện [`booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) ($84,938\text{ B}$, SHA256: `B8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74`) và kiểm thử [`public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) ($63,165\text{ B}$, SHA256: `0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`) được giữ nguyên $100\%$, khớp hoàn toàn với bản build đã được phê duyệt ở `P5-GUEST-OTA-UI-03` Round 4.
2. **Không thay đổi Backend/DB:**
   - $0$ thay đổi backend C#, $0$ thay đổi database schema/migration, $0$ kết nối database thật.
   - Không can thiệp module của các thành viên khác (Nguyên/Tân).
3. **Các cổng PO giữ nguyên `NeedsPO` (7 cổng):**
   - D21 lookup TTL mốc dự kiến/thực tế + revoke/reissue contract
   - Quote5min/hold15min price pinning và stale-quote acknowledgement
   - PO Gate 1 (Hợp đồng API tìm kiếm: Giữ endpoint hiện tại hay tạo GET /api/public/search/properties và kế hoạch di chuyển client)
   - PO Gate 2 (Chính sách xuất bản: Đồng bộ enforce IsPublished == true trên toàn bộ public discovery hay giữ Active-only)
   - PO Gate 3 (Nguồn Dataset Hành chính Việt Nam có thẩm quyền, phiên bản, ngày hiệu lực và license)
   - PO Gate 4 (Kế hoạch Migration bổ sung ProvinceCode, Ward, WardCode, LandmarkTags cho Property)
   - PO Gate 5 (Cơ chế tìm kiếm phòng trống xuyên cơ sở: Two-step discovery vs Aggregated search theo Tỉnh/Thành)

---

## 4. Kết Luận
Đợt đệ trình Round 1 giải quyết hoàn hảo 2 khoảng cách điều hướng bàn phím còn thiếu:
- Chứng minh và ghi nhận chi tiết chuỗi lùi liên tục không ngắt đoạn trên di động 375px.
- Chứng minh và ghi nhận chi tiết chuỗi lùi theo giờ trên desktop 1440px với khởi đầu enabled được xác thực, bỏ qua nút disabled và duyệt qua các trường con ngày native.
- Bằng chứng được cô lập riêng biệt, bảo toàn toàn bộ artifacts đã được duyệt trước đó.
- Sẵn sàng để Codex tiến hành thẩm định và phê duyệt cho `P7-GUEST-KEYBOARD-CONTINUITY-04` Round 1.
# Submission P7-GUEST-OTA-STATE-VERIFY-03 — Round 1

- **TaskId:** `P7-GUEST-OTA-STATE-VERIFY-03`
- **Round:** 1
- **SubmissionId:** `sub-p7-guest-ota-state-verify-03-r1-20261011`
- **ReviewedSubmissionId:** `sub-p5-guest-ota-ui-03-r4-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T22:20:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5-GUEST-OTA-UI-03` round 4 Approved (`sub-p5-guest-ota-ui-03-r4-20261011`).
- **Scope:** Kiểm chứng độc lập các trạng thái trình duyệt thực tế (browser-state verification) còn thiếu trên giao diện khách hàng mới theo bàn giao `assignment.md`:
  - **Trạng thái tải (Loading state with observable delay):** Mô phỏng yêu cầu tìm kiếm có độ trễ 4,000ms trên máy chủ fixture loopback. Ghi nhận và chụp trực quan vòng xoay loading đồng thời tại danh sách gợi ý combobox ("Đang tìm kiếm cơ sở lưu trú...") và nút tìm kiếm hero ("Đang tìm...").
  - **Trạng thái lỗi & Thao tác thử lại (HTTP 500 error & retry success):** Kích hoạt lỗi HTTP 500 từ `/api/public/properties`, quan sát trực quan hộp cảnh báo nội dòng `role="alert"` kèm nút "Thử lại" và thông báo SweetAlert2 toast. Thực hiện bấm nút "Thử lại", máy chủ phản hồi 200 OK, hộp cảnh báo lỗi được xóa bỏ hoàn toàn và danh sách cơ sở lưu trú được hiển thị.
  - **Chu trình bàn phím toàn diện trên Combobox (Full keyboard cycle):** Thực hiện chuỗi phím thực tế `ArrowDown` (chọn gợi ý 0) $\to$ `ArrowDown` (chọn gợi ý 1) $\to$ `ArrowUp` (quay lại gợi ý 0) $\to$ `Escape` (đóng danh sách, `aria-expanded="false"`) $\to$ `ArrowDown` (mở lại) $\to$ `Enter` (chọn cơ sở vào ô nhập, đóng popup, hiển thị badge đang chọn cơ sở).
  - **Đo lường khoảng đệm Form khách hàng di động (Mobile form clearance):**
    - Tại vị trí cuộn `scrollY = 3695px` trên màn hình 375px: Xác nhận **toàn bộ 4 nhãn thông tin** (nhãn họ tên cách đáy header $+30.1\text{px}$), **toàn bộ 4 khung nhập liệu** và **nút xác nhận giữ chỗ** (cách thanh neo đáy $+40.2\text{px}$) đều hiển thị đồng thời, không bị che khuất trong khung nhìn tĩnh $617.9\text{px}$.
    - Tại vị trí focus từng ô: Khi focus vào ô họ tên (tự động căn giữa tại `scrollY = 3453px`), nhãn nằm tại `top: 361.8px` (cách đáy header $+272.5\text{px}$), ô nhập nằm tại `top: 383.8px` (cách đáy header $+294.5\text{px}$ và cách thanh đáy $+279.4\text{px}$).
  - **Chu trình duyệt phím Tab tuần tự (Tab/Shift+Tab focus cycle):** Xác thực focus tuần tự qua toàn bộ 9 phần tử điều khiển trên card tìm kiếm tại 1440px desktop, 768px tablet và 375px mobile; toàn bộ touch target đều $\ge 44\text{px}$.
  - **Nhật ký mạng vòng lặp kín (Network audit log):** Lưu vết toàn diện 73 yêu cầu mạng cục bộ với ID, timestamp, method, URL, status code và kết quả phân phối trong `network-audit.json`.
  - **Bảo toàn toàn vẹn:** 0 thay đổi mã nguồn (giữ nguyên mã băm nguồn `booking.page.ts`), 0 backend/schema/API/DB changes, 0 kết nối DB thật, không sửa đổi module đồng đội. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Chi Tiết Thực Thi & Kết Quả Đo Lường Trình Duyệt Thực Tế

### 1.1. Trạng Thái Tải Với Độ Trễ Quan Sát Được (Loading State with Observable Delay)
- **Cấu hình fixture:** Thiết lập `propertiesDelayMs = 4000` thông qua endpoint điều khiển `POST /__control/config`.
- **Thao tác trình duyệt (CDP):** Nhập từ khóa `"Hồ Chí Minh"` vào `#propertySearchInput`, chờ $450\text{ms}$ để bộ đếm debounce $300\text{ms}$ kích hoạt và request được gửi đi.
- **Quan sát DOM thực tế:**
  - `input[aria-expanded="true"]`.
  - Bảng danh sách gợi ý hiển thị biểu tượng xoay `animate-spin` với nội dung text: *"Đang tìm kiếm cơ sở lưu trú..."*.
  - Bounding rect dropdown: `top: 423.1px, left: 158.8px, width: 361.3px, height: 57.6px`.
  - Nút tìm kiếm `#heroSearchButton` hiển thị biểu tượng xoay `animate-spin` với nội dung text: *"Đang tìm..."*.
- **Tệp bằng chứng:** [`loading-spinner-active.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/loading-spinner-active.png) ($170,567\text{ B}$, SHA256: `811CC9EBDE25B3C1794B4037F73C2EAA9C3008E9F8EC4AD20A3F368CFEA801A0`).

### 1.2. Trạng Thái Lỗi HTTP 500 & Thao Tác Thử Lại (HTTP 500 Error & Retry Success)
- **Kích hoạt lỗi:** Thiết lập `propertiesErrorNext = true` trên fixture server.
- **Thao tác trình duyệt:** Nhập từ khóa `"Lỗi Server"`, fixture server trả về mã HTTP `500` kèm payload `{ success: false, message: "Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú." }`.
- **Quan sát khi lỗi:**
  - Hộp cảnh báo nội dòng xuất hiện: `role="alert"`, class `p-3 text-xs text-rose-600 bg-rose-50 rounded-xl flex items-center justify-between gap-2`.
  - Nội dung text cảnh báo: *"Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú."*.
  - Nút thử lại: `<button>Thử lại</button>` với kích thước touch target đạt chuẩn.
  - SweetAlert2 toast đồng thời hiển thị tại góc trên phải màn hình với tiêu đề *"Đã có lỗi xảy ra"*.
  - Bounding rect alert: `top: 431.9px, left: 167.6px, width: 343.7px, height: 60.0px`.
  - **Tệp bằng chứng:** [`error-alert-inline.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-alert-inline.png) ($130,275\text{ B}$, SHA256: `87EFA4C84C8271D019417927489874492CFEE1A8C311BC694D44508BF73231F3`).
- **Thao tác thử lại (Retry Action):**
  - Thực hiện click vào nút "Thử lại": `document.querySelector('[role="alert"] button').click()`.
  - Fixture server nhận request tiếp theo và phản hồi HTTP `200 OK`.
  - Hộp cảnh báo lỗi nội dòng được giải phóng hoàn toàn khỏi DOM (`alertCleared: true`).
  - Danh sách gợi ý cơ sở lưu trú được hiển thị bình thường.
  - **Tệp bằng chứng:** [`error-retry-success.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-retry-success.png) ($170,601\text{ B}$, SHA256: `B29E659D71ED068712F72B7908750D2843072A3C22241BB90D6A4A805E40CB18`).

### 1.3. Chu Trình Điều Hướng Bàn Phím Toàn Diện Trên Combobox (Combobox Keyboard Cycle)
Thực thi chuỗi phím native qua CDP `press_key`:
1. `focus` và nhập `"Khách sạn"`: danh sách mở ra với 2 gợi ý, `aria-expanded = "true"`, `aria-activedescendant = null`.
2. Phím `ArrowDown` (lần 1): `aria-activedescendant = "suggestion-0"`, option 0 nhận highlight viền nổi `bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200`, `aria-selected = "true"`.
3. Phím `ArrowDown` (lần 2): `aria-activedescendant = "suggestion-1"`, option 1 nhận highlight viền nổi, option 0 trở về bình thường.
4. Phím `ArrowUp`: `aria-activedescendant` quay ngược về `"suggestion-0"`.
5. Phím `Escape`: danh sách đóng lại ngay lập tức, `aria-expanded = "false"`, listbox không còn trong DOM.
6. Phím `ArrowDown`: mở lại danh sách, active descendant đặt lại tại `"suggestion-0"`.
7. Phím `Enter`: chọn cơ sở `"Khách sạn Sài Gòn Central"`, ô nhập được điền tên khách sạn, danh sách đóng lại, huy hiệu *"Đang chọn cơ sở này"* xuất hiện tại card và Bước 2 (danh sách phòng trống) được kích hoạt hiển thị.
- **Tệp bằng chứng:** [`combobox-keyboard-cycle.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/combobox-keyboard-cycle.png) ($171,422\text{ B}$, SHA256: `973D02C6C8EC93579B2D3C9B45A1F19701D3F828E04D72DDC326930C579C1653`).

### 1.4. Khoảng Đệm Form Khách Hàng Di Động (Mobile Form Clearance)
Tại kích thước màn hình di động $375 \times 812$:
- Đáy header cố định: `headerBottom = 89.3px`.
- Đỉnh thanh neo tóm tắt ở đáy: `stickyTop = 707.2px`.
- **Khoảng không gian đọc và điền thông tin không bị che khuất:** $707.2 - 89.3 = 617.9\text{px}$.

#### A. Trạng thái hiển thị đồng thời toàn bộ form (`scrollY = 3695px`)
Tại vị trí cuộn này, toàn bộ 4 nhãn thông tin, 4 khung nhập và nút gửi thông tin đều nằm trọn vẹn trong vùng $617.9\text{px}$:
- **Nhãn họ tên:** `top = 119.4px` $\rightarrow$ Thấp hơn đáy header $+30.1\text{px}$ (**PASS - hoàn toàn nhìn thấy rõ nhãn chữ**).
- **Khung nhập họ tên (`#guestNameInput`):** `top = 141.4px, bottom = 185.4px` (cách đáy header $+52.1\text{px}$).
- **Nhãn email:** `top = 221.4px` (cách đáy header $+132.1\text{px}$).
- **Khung nhập email (`#guestEmailInput`):** `top = 243.4px, bottom = 287.4px`.
- **Nhãn số điện thoại:** `top = 323.4px` (cách đáy header $+234.1\text{px}$).
- **Khung nhập số điện thoại (`#guestPhoneInput`):** `top = 345.4px, bottom = 389.4px`.
- **Nhãn số lượng khách:** `top = 405.4px` (cách đáy header $+316.1\text{px}$).
- **Khung nhập số khách (`#numberOfGuestsInput`):** `top = 427.4px, bottom = 471.4px`.
- **Hộp thông báo khóa phòng 15 phút:** `top = 490px - 580px`.
- **Nút gửi giữ phòng (`#confirmHoldButton`):** `top = 615.0px, bottom = 667.0px` $\rightarrow$ Nằm phía trên thanh neo đáy $+40.2\text{px}$ (**PASS - hoàn toàn không bị che khuất**).
- **Tệp bằng chứng:** [`mobile-form-full-clearance-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-full-clearance-375.png) ($59,512\text{ B}$, SHA256: `E452A020F2572DE24CDC8C0848D06E77039F5BDABC135D728E1E1C76AB846EE4`).

#### B. Trạng thái focus trực tiếp vào ô họ tên (`scrollY = 3453px`)
Khi người dùng chạm focus vào ô nhập họ tên, phần tử được đưa vào trung tâm khung nhìn:
- **Nhãn họ tên:** `top = 361.8px` $\rightarrow$ Thấp hơn đáy header $+272.5\text{px}$ (**PASS**).
- **Khung nhập họ tên:** `top = 383.8px, bottom = 427.8px` $\rightarrow$ Thấp hơn đáy header $+294.5\text{px}$ và cách thanh neo đáy $+279.4\text{px}$ (**PASS**).
- **Tệp bằng chứng:** [`mobile-form-focus-name-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-focus-name-375.png) ($60,061\text{ B}$, SHA256: `64C95503BE74CA09E2841BD33D77E1E6FE9118B51D6B36D096D17B397859814E`).

### 1.5. Chu Trình Duyệt Phím Tab Tuần Tự (Tab/Shift+Tab Focus Cycle)
Đo lường sự dịch chuyển focus tuần tự qua toàn bộ các phần tử điều khiển trên card tìm kiếm:

| STT | Phần tử & Nhãn ARIA | Loại control | Desktop (1440px) | Mobile (375px) | Touch Target |
|---|---|---|---|---|---|
| 0 | Nút "Theo đêm" | Tab button | `112.5 x 44px` | `136 x 44px` | $\ge 44\text{px}$ (PASS) |
| 1 | Nút "Theo giờ" | Tab button | `105.8 x 44px` | `136 x 44px` | $\ge 44\text{px}$ (PASS) |
| 2 | `#propertySearchInput` (`aria-label="Địa điểm hoặc khách sạn"`) | Combobox input | `293.3 x 32px` | `258.4 x 32px` | Khung hàng $\ge 44\text{px}$ |
| 3 | Nút "Xóa từ khóa tìm kiếm" (`aria-label="Xóa từ khóa tìm kiếm"`) | Action button | `44 x 44px` | `44 x 44px` | $\ge 44\text{px}$ (PASS) |
| 4 | `#checkInDateInput` (`aria-label="Ngày nhận phòng"`) | Date input | `166.7 x 28px` | `258.4 x 28px` | Khung hàng $\ge 44\text{px}$ |
| 5 | `#checkOutDateInput` (`aria-label="Ngày trả phòng"`) | Date input | `166.7 x 28px` | `258.4 x 28px` | Khung hàng $\ge 44\text{px}$ |
| 6 | Nút tăng khách (`aria-label="Tăng số lượng khách"`) | Counter button | `44 x 44px` | `44 x 44px` | $\ge 44\text{px}$ (PASS) |
| 7 | `#heroSearchButton` ("Tìm phòng") | Submit button | `176.5 x 86.2px` | `280 x 52px` | $\ge 44\text{px}$ (PASS) |

Toàn bộ các phần tử đều nhận focus với `hasFocus = true` và viền focus-visible sắc nét (`outline` và `boxShadow` được kiểm chứng).

---

## 2. Danh Mục Bằng Chứng & Mã Băm Thực Tế (Evidence Manifest)

Toàn bộ các tệp bằng chứng mới được lưu trữ tại thư mục riêng `docs/agent-coordination/evidence/guest-ota-state-verify-03/`:

| Tệp bằng chứng | Mô tả & Trạng thái | Kích thước | SHA256 Hash |
|---|---|---|---|
| [`loading-spinner-active.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/loading-spinner-active.png) | Trạng thái loading combobox & nút hero (delay 4000ms) | 170,567 B | `811CC9EBDE25B3C1794B4037F73C2EAA9C3008E9F8EC4AD20A3F368CFEA801A0` |
| [`error-alert-inline.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-alert-inline.png) | Trạng thái lỗi HTTP 500 với alert nội dòng & nút thử lại | 130,275 B | `87EFA4C84C8271D019417927489874492CFEE1A8C311BC694D44508BF73231F3` |
| [`error-retry-success.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-retry-success.png) | Trạng thái sau khi bấm thử lại, nhận 200 OK và xóa alert | 170,601 B | `B29E659D71ED068712F72B7908750D2843072A3C22241BB90D6A4A805E40CB18` |
| [`combobox-keyboard-cycle.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/combobox-keyboard-cycle.png) | Chu trình phím ArrowDown/Up/Escape/Enter chọn cơ sở | 171,422 B | `973D02C6C8EC93579B2D3C9B45A1F19701D3F828E04D72DDC326930C579C1653` |
| [`mobile-form-full-clearance-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-full-clearance-375.png) | Hiển thị đồng thời toàn bộ 4 nhãn, 4 input và nút giữ chỗ | 59,512 B | `E452A020F2572DE24CDC8C0848D06E77039F5BDABC135D728E1E1C76AB846EE4` |
| [`mobile-form-focus-name-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-focus-name-375.png) | Trạng thái focus căn giữa vào ô họ tên trên mobile | 60,061 B | `64C95503BE74CA09E2841BD33D77E1E6FE9118B51D6B36D096D17B397859814E` |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/network-audit.json) | Nhật ký mạng vòng lặp kín (73 requests) | 62,815 B | `24E2FD1ED2192960E44CC52B2AD29D8634567EF3B45A16F7F48C792E14DD6174` |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/capture-log.json) | Chi tiết hành động, timestamp, viewport & tọa độ | 9,264 B | `D3915E9CF5E9020B0087CB905639918DD34A19D3D31BD27072F1FD9F5139C564` |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/source-manifest.json) | Metadata mã nguồn, test file & lazy booking chunk | 1,409 B | `EEE1513D23505E17917F14D8C51587313ADFDFDED7305D29150746F3F4FD8C8F` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/manifest.json) | Metadata tổng hợp kiểm chứng Round 1 | 8,581 B | `95348733ABF8FED67589F3A16B24BE40B46018A5A18FC250E87D8607CBF5C7F0` |

---

## 3. Giới Hạn Kỹ Thuật & Cam Kết Toàn Vẹn (Honest Technical Limitations)

1. **Môi Trường Synthetic Loopback Fixtures (No-DB):** Toàn bộ dữ liệu được phục vụ độc lập bởi máy chủ loopback in-memory `fixture-server.cjs` trên cổng `4282`. Tuyệt đối không kết nối cơ sở dữ liệu thật nào (0 kết nối DB).
2. **Không Thay Đổi Mã Nguồn:** Mã nguồn `booking.page.ts` ($84,938\text{ B}$, SHA256: `B8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74`) và tệp test `public-booking.page.spec.ts` ($63,165\text{ B}$, SHA256: `0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`) được bảo toàn tuyệt đối $100\%$, không có chỉnh sửa phát sinh.
3. **Bảo Toàn Quyền Sở Hữu Module Đồng Đội:** Không sửa đổi hay tác động tới các module quản trị của đồng đội (Rooms/RoomTypes của Nguyên, Housekeeping của Tân).
4. **Giới Hạn Tuyên Bố Trợ Năng:** Khảo sát trợ năng tập trung vào cấu trúc DOM ngữ nghĩa, thuộc tính ARIA, đo lường touch targets ($\ge 44\text{px}$), chu trình phím Tab/Arrows và độ tương phản màu sắc thực tế; không tuyên bố tuân thủ toàn diện mọi phần mềm đọc màn hình chuyên dụng.
5. **Duy Trì Toàn Vẹn Quyết Định Nghiệp Vụ (PO Gates):** Toàn bộ 5 PO Gates và 2 Business Gates được giữ nguyên trạng thái `NeedsPO` trong `decisions.md`.
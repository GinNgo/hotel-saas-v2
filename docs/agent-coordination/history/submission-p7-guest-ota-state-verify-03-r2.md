# Submission P7-GUEST-OTA-STATE-VERIFY-03 — Round 2

- **TaskId:** `P7-GUEST-OTA-STATE-VERIFY-03`
- **Round:** 2
- **SubmissionId:** `sub-p7-guest-ota-state-verify-03-r2-20261011`
- **ReviewedSubmissionId:** `sub-p7-guest-ota-state-verify-03-r1-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T22:37:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5-GUEST-OTA-UI-03` round 4 Approved (`sub-p5-guest-ota-ui-03-r4-20261011`).
- **Scope:** Khắc phục triệt để 3 nhóm phát hiện từ đợt đánh giá vòng 1 (`history/review-p7-guest-ota-state-verify-03-r1.md`), bảo toàn toàn bộ mã nguồn giao diện đã được chấp thuận:
  - **Khắc phục ảnh chụp trạng thái tải thực tế (Finding 1 — P2):** Chụp lại `loading-spinner-active.png` trong lúc request 16 (`GET /api/public/properties?search=H%E1%BB%93%20Ch%C3%AD%20Minh`) đang thực sự in-flight dưới độ trễ 30,000ms. Hình ảnh ghi nhận rõ biểu tượng xoay `animate-spin` và văn bản *"Đang tìm kiếm cơ sở lưu trú..."* trong listbox dropdown, nút `#heroSearchButton` hiển thị xoay *"Đang tìm..."*, và nhãn đếm kết quả hiển thị "0 cơ sở".
  - **Ghi nhận chu trình phím Tab/Shift+Tab thực tế, phân định enabled/disabled, và công bố trung thực vùng bấm (Finding 2 — P2):**
    - Đo lường chi tiết chu trình duyệt phím `Tab` tuần tự (tiến 1 $\to$ 8) và `Shift+Tab` (lùi 8 $\to$ 1) qua toàn bộ các phần tử điều khiển trên card tìm kiếm: overnight, hourly, combobox, check-in, check-out, decrement guests, increment guests, hero search button trên Desktop 1440px và Mobile 375px.
    - Phân định rõ ràng nút giảm khách ("-"): khi `numberOfGuests = 1`, nút bị vô hiệu hóa (`[disabled]="true"`) và được trình duyệt bỏ qua; khi `numberOfGuests = 2` (sau khi tăng khách), nút được kích hoạt (`disabled = false`) và nhận focus bình thường (`hasFocus = true`).
    - Làm rõ ảnh `combobox-keyboard-cycle.png`: Thừa nhận trung thực ảnh này chỉ thể hiện **một trạng thái thị giác đơn lẻ** khi option `suggestion-0` được highlight và focus nằm trên ô nhập; không khẳng định thể hiện toàn bộ các phím vào một ảnh tĩnh. Chuỗi phím thực tế (`ArrowDown`, `ArrowDown`, `ArrowUp`, `Escape`, `ArrowDown`, `Enter`) và DOM state tương ứng được ghi nhận chi tiết theo từng bước.
    - Đo lường và công bố trung thực diện tích vùng bấm: Các nút chức năng đều đạt chuẩn Level AAA $\ge 44\text{px}$. Công bố giới hạn chiều cao ô nhập combobox là 32px (nằm trong hàng container 56px), ô nhập ngày là 28px (nằm trong card container 56px), và nút "Thử lại" nội dòng là 36px (min-h-[36px]); không tự nhận mọi ô nhập đều có bounding box độc lập $\ge 44\text{px}$.
    - Thừa nhận phương pháp định vị căn giữa trên di động là gọi `scrollIntoView({ block: 'center' })` để đo đạc dung tích hình học giữa header và sticky bar, không tuyên bố đây là hành vi tự cuộn của bàn phím ảo hệ điều hành.
  - **Phân tách rành mạch nguồn gốc và số lượng kết quả của 2 chuỗi Error & Retry (Finding 3 — P2):**
    - Phân định rành mạch:
      - **Chuỗi A (Zero-match query retry):** Request 47 (HTTP 500 error cho `Lỗi Server`) $\to$ hiển thị alert nội dòng kèm nút "Thử lại" $\to$ click nút "Thử lại" $\to$ Request 48 (HTTP 200 OK với 0 items) $\to$ alert biến mất, listbox hiển thị thông báo trống: *"Không tìm thấy cơ sở lưu trú nào phù hợp với từ khóa này."*.
      - **Chuỗi B (Valid-match query retry):** Request 50 (HTTP 500 error cho `Sài Gòn`) $\to$ hiển thị alert nội dòng $\to$ click nút "Thử lại" $\to$ Request 51 (HTTP 200 OK với 1 item) $\to$ alert biến mất, listbox hiển thị **1 gợi ý cơ sở lưu trú** ("Khách sạn Sài Gòn Central") và nhãn đếm hiển thị "1 cơ sở" (như thể hiện trong `error-retry-success.png`, đính chính nhận định nhầm lẫn 4 card ở vòng 1).
    - Công bố rõ ràng: Các mốc thời gian và nhãn outcome trong `network-audit.json` ghi nhận vòng đời phía máy chủ loopback, không phải telemetry nhận gói tin độc lập của client hay chứng minh 100% chặn outbound.
  - **Bảo toàn toàn vẹn:** 0 thay đổi mã nguồn (giữ nguyên mã băm nguồn `booking.page.ts` $84,938\text{ B}$ và `public-booking.page.spec.ts` $63,165\text{ B}$), 0 backend/schema/API/DB changes, 0 kết nối DB thật, không sửa đổi module đồng đội. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Chi Tiết Khắc Phục Các Điểm Đánh Giá Từ Vòng 1 (Review Findings Resolution)

### 1.1. Finding 1 (P2 — Loading Screenshot & Observable Pending Request)
- **Vấn đề vòng 1:** Ảnh `loading-spinner-active.png` trước đây được chụp sau khi yêu cầu tìm kiếm đã kết thúc, thể hiện kết quả tìm kiếm đã hoàn tất thay vì vòng xoay loading.
- **Giải pháp xử lý:**
  1. Cấu hình fixture server với `propertiesDelayMs = 30000` (độ trễ 30 giây).
  2. Tại kích thước Desktop 1440px, nhập từ khóa `"Hồ Chí Minh"`, request số 16 (`GET /api/public/properties?search=H%E1%BB%93%20Ch%C3%AD%20Minh`) được gửi đi vào lúc `2026-10-11T15:29:50.515Z`.
  3. Tại thời điểm $5\text{s}$ sau khi request được dispatch (trong lúc request đang thực sự pending in-flight), tiến hành chụp màn hình ngay lập tức:
     - Biểu tượng xoay `animate-spin` hiển thị trong listbox dropdown kèm dòng chữ *"Đang tìm kiếm cơ sở lưu trú..."*.
     - Bounding rect listbox dropdown: `top: 423.1px, left: 158.8px, width: 361.3px, height: 57.6px`.
     - Biểu tượng xoay `animate-spin` hiển thị trên nút `#heroSearchButton` kèm chữ *"Đang tìm..."*.
     - Nhãn đếm hiển thị *"0 cơ sở"* do kết quả đang chờ tải.
  4. Lưu tệp bằng chứng mới: [`loading-spinner-active.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/loading-spinner-active.png) ($126,700\text{ B}$, SHA256: `6324E43C5F3F7C19E251215848C3F3C6C427DA23A2BEC2C7B99A95D071FD8F3F`).

### 1.2. Finding 2 (P2 — Full Keyboard Actions, Disabled/Enabled Distinction, Hit Areas & Method Disclosures)
- **Chu trình phím Tab/Shift+Tab thực tế (1440px Desktop & 375px Mobile):**
  - Thực thi duyệt phím `Tab` tuần tự (Forward) và `Shift+Tab` (Reverse) qua toàn bộ 8 phần tử điều khiển cốt lõi (9 khi có nút xóa từ khóa):
    1. Bước 1: Nút "Theo đêm" (`measuredHitArea: 112.5 x 44px`, `hasFocus: true`).
    2. Bước 2: Nút "Theo giờ" (`measuredHitArea: 105.8 x 44px`, `hasFocus: true`).
    3. Bước 3: `#propertySearchInput` (`role="combobox"`, `measuredHitArea: 341.3 x 32px`, container hàng 56px, `hasFocus: true`).
    4. Bước 4: `#checkInDateInput` (`aria-label="Ngày nhận phòng"`, `measuredHitArea: 166.7 x 28px`, container hàng 56px, `hasFocus: true`).
    5. Bước 5: `#checkOutDateInput` (`aria-label="Ngày trả phòng"`, `measuredHitArea: 166.7 x 28px`, container hàng 56px, `hasFocus: true`).
    6. Bước 6: Nút giảm khách ("-"):
       - **Tại số khách = 1:** Nút có `[disabled]="true"`, trình duyệt bỏ qua nút này trong chu trình Tab và chuyển tiếp tới nút tăng khách.
       - **Tại số khách = 2 (sau khi tăng khách):** Nút có `disabled = false`, nhận focus bình thường với `hasFocus: true`, `measuredHitArea: 44 x 44px`.
    7. Bước 7: Nút tăng khách ("+") (`aria-label="Tăng số lượng khách"`, `measuredHitArea: 44 x 44px`, `hasFocus: true`).
    8. Bước 8: `#heroSearchButton` ("Tìm phòng", `measuredHitArea: 176.5 x 86.2px`, `hasFocus: true`).
  - Chu trình duyệt ngược `Shift+Tab` đảo chiều chính xác từ nút tìm phòng $\to$ tăng khách $\to$ giảm khách (khi enabled) $\to$ ngày trả $\to$ ngày nhận $\to$ combobox $\to$ theo giờ $\to$ theo đêm.
- **Minh bạch ảnh chụp combobox (`combobox-keyboard-cycle.png`):**
  - Công bố trung thực: Ảnh [`combobox-keyboard-cycle.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/combobox-keyboard-cycle.png) ($171,422\text{ B}$, SHA256: `973D02C6...`) thể hiện **một trạng thái thị giác đơn lẻ** khi option `suggestion-0` được highlight (`bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200`) và focus được giữ trên ô nhập; không tuyên bố chụp tất cả các phím trong một ảnh tĩnh.
  - Chuỗi thao tác phím native (`ArrowDown`, `ArrowDown`, `ArrowUp`, `Escape`, `ArrowDown`, `Enter`) và DOM properties tương ứng được ghi nhận chi tiết theo từng bước trong `capture-log.json`.
- **Đo lường vùng bấm thực tế (Hit Areas) & Giới hạn trung thực:**
  - Các nút hành động đều đạt chuẩn Level AAA $\ge 44\text{px}$:
    - Nút Theo đêm: $112.5 \times 44\text{px}$ (Desktop) / $136 \times 44\text{px}$ (Mobile).
    - Nút Theo giờ: $105.8 \times 44\text{px}$ (Desktop) / $136 \times 44\text{px}$ (Mobile).
    - Nút Xóa từ khóa: $44 \times 44\text{px}$.
    - Nút Giảm khách: $44 \times 44\text{px}$.
    - Nút Tăng khách: $44 \times 44\text{px}$.
    - Nút Tìm phòng: $176.5 \times 86.2\text{px}$ (Desktop) / $280 \times 52\text{px}$ (Mobile).
    - Nút Xác nhận giữ phòng: $277.6 \times 52\text{px}$.
  - **Giới hạn kỹ thuật công bố trung thực:**
    - Chiều cao ô nhập văn bản combobox là $32\text{px}$ (nằm trong container hàng có chiều cao $56\text{px}$).
    - Chiều cao ô nhập ngày là $28\text{px}$ (nằm trong container card có chiều cao $56\text{px}$).
    - Chiều cao nút "Thử lại" nội dòng là $36\text{px}$ (`min-h-[36px]`). Công bố trung thực là $36\text{px}$, không tự nhận đạt $44\text{px}$.
- **Công bố phương pháp định vị trên di động:**
  - Định vị focus căn giữa từng ô nhập trên mobile ($375\text{px}$) được thực hiện bằng lệnh programmatic `scrollIntoView({ block: 'center' })` để kiểm chứng khả năng dung nạp hình học giữa header cố định và sticky footer. Đây là ghi nhận khả năng hiển thị hình học, không tuyên bố là hành vi tự cuộn của bàn phím ảo hệ điều hành.

### 1.3. Finding 3 (P2 — Retry Sequences Mapping & Request/Count Traceability)
Phân định rành mạch giữa 2 chuỗi lỗi và thử lại trong `network-audit.json`:

1. **Chuỗi A (Zero-match query retry sequence):**
   - **Request ID 47:** `GET /api/public/properties?search=L%E1%BB%97i%20Server` lúc `2026-10-11T15:33:52.278Z`.
     - Server phản hồi HTTP `500` `{ success: false, message: "Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú." }`.
     - Trình duyệt hiển thị hộp cảnh báo nội dòng `role="alert"` kèm nút "Thử lại" và SweetAlert2 toast, chụp trong [`error-alert-inline.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-alert-inline.png).
   - **Request ID 48:** `GET /api/public/properties?search=L%E1%BB%97i%20Server` lúc `2026-10-11T15:33:52.415Z`.
     - Kích hoạt khi người dùng click nút "Thử lại".
     - Server phản hồi HTTP `200` với body `[]` (0 items).
     - Trình duyệt xóa bỏ alert lỗi và hiển thị thông báo trống: *"Không tìm thấy cơ sở lưu trú nào phù hợp với từ khóa này."*.

2. **Chuỗi B (Valid-match query retry sequence):**
   - **Request ID 50:** `GET /api/public/properties?search=S%C3%A0i%20G%C3%B2n` lúc `2026-10-11T15:34:08.659Z`.
     - Server phản hồi HTTP `500`, trình duyệt hiển thị hộp alert nội dòng.
   - **Request ID 51:** `GET /api/public/properties?search=S%C3%A0i%20G%C3%B2n` lúc `2026-10-11T15:34:08.808Z`.
     - Kích hoạt khi người dùng click nút "Thử lại".
     - Server phản hồi HTTP `200` với 1 item (`"Khách sạn Sài Gòn Central"`).
     - Trình duyệt xóa bỏ alert lỗi và hiển thị **1 gợi ý cơ sở lưu trú** trong listbox combobox, nhãn đếm hiển thị *"1 cơ sở"*, chụp trong [`error-retry-success.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-retry-success.png). (Đính chính thông tin: ảnh chụp thể hiện 1 gợi ý cơ sở lưu trú trong dropdown, không phải 4 thẻ phòng).

3. **Công bố giới hạn vòng đời máy chủ:**
   - Các mốc thời gian và nhãn outcome trong `network-audit.json` phản ánh tiến trình của máy chủ fixture loopback nội bộ. Đây không phải dữ liệu đo đạc độc lập về việc client nhận gói tin hay bằng chứng chứng minh toàn bộ các kết nối ra ngoài bị chặn.

---

## 2. Danh Mục Bằng Chứng & Mã Băm Thực Tế (Evidence Manifest)

Toàn bộ các tệp bằng chứng được lưu trữ tại `docs/agent-coordination/evidence/guest-ota-state-verify-03/`:

| Tệp bằng chứng | Mô tả & Trạng thái | Kích thước | SHA256 Hash |
|---|---|---|---|
| [`loading-spinner-active.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/loading-spinner-active.png) | Trạng thái loading thực tế khi request 16 đang in-flight (delay 30s) | 126,700 B | `6324E43C5F3F7C19E251215848C3F3C6C427DA23A2BEC2C7B99A95D071FD8F3F` |
| [`error-alert-inline.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-alert-inline.png) | Trạng thái lỗi HTTP 500 (Request 47) với alert nội dòng & nút thử lại | 130,275 B | `87EFA4C84C8271D019417927489874492CFEE1A8C311BC694D44508BF73231F3` |
| [`error-retry-success.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-retry-success.png) | Trạng thái sau khi bấm thử lại (Request 51), nhận 200 OK, 1 gợi ý | 170,601 B | `B29E659D71ED068712F72B7908750D2843072A3C22241BB90D6A4A805E40CB18` |
| [`combobox-keyboard-cycle.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/combobox-keyboard-cycle.png) | Trạng thái thị giác đơn lẻ của highlight gợi ý 0 với focus trên ô nhập | 171,422 B | `973D02C6C8EC93579B2D3C9B45A1F19701D3F828E04D72DDC326930C579C1653` |
| [`mobile-form-full-clearance-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-full-clearance-375.png) | Hiển thị đồng thời toàn bộ 4 nhãn, 4 input và nút giữ chỗ (`scrollY = 3695`) | 59,512 B | `E452A020F2572DE24CDC8C0848D06E77039F5BDABC135D728E1E1C76AB846EE4` |
| [`mobile-form-focus-name-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-focus-name-375.png) | Trạng thái focus căn giữa vào ô họ tên trên mobile (`scrollY = 3453`) | 60,061 B | `64C95503BE74CA09E2841BD33D77E1E6FE9118B51D6B36D096D17B397859814E` |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/network-audit.json) | Nhật ký mạng vòng lặp kín (ghi nhận request 16, 47, 48, 50, 51) | 45,262 B | `1582F66986191B8D444AD1FE6DE58004A7DC110A0EFC1EABD27D65EBF5377612` |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/capture-log.json) | Chi tiết hành động, timestamp, viewport, tọa độ & disclosures | 12,254 B | `8C1C70E48A615993C2A2F1505BDF594C39EE3A2759901CC748C55A1CCBD099F6` |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/source-manifest.json) | Metadata mã nguồn, test file & lazy booking chunk | 1,409 B | `7A7AF511FB60625AAE67F2227165505BC011203B70485B1006955A4BD323C8AB` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/manifest.json) | Metadata tổng hợp kiểm chứng Round 2 | 9,020 B | `BE512B191FE6483633267581B9AC0C3EF89A4C4810C015500B1724361C657937` |

---

## 3. Giới Hạn Kỹ Thuật & Cam Kết Toàn Vẹn (Honest Technical Limitations)

1. **Môi Trường Synthetic Loopback Fixtures (No-DB):** Toàn bộ dữ liệu được phục vụ độc lập bởi máy chủ loopback in-memory `fixture-server.cjs` trên cổng `4282`. Tuyệt đối không kết nối cơ sở dữ liệu thật nào (0 kết nối DB).
2. **Không Thay Đổi Mã Nguồn:** Mã nguồn `booking.page.ts` ($84,938\text{ B}$, SHA256: `B8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74`) và tệp test `public-booking.page.spec.ts` ($63,165\text{ B}$, SHA256: `0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`) được bảo toàn tuyệt đối $100\%$, không có chỉnh sửa phát sinh.
3. **Bảo Toàn Quyền Sở Hữu Module Đồng Đội:** Không sửa đổi hay tác động tới các module quản trị của đồng đội (Rooms/RoomTypes của Nguyên, Housekeeping của Tân).
4. **Giới Hạn Tuyên Bố Trợ Năng:** Khảo sát trợ năng tập trung vào cấu trúc DOM ngữ nghĩa, thuộc tính ARIA, đo lường touch targets, chu trình phím Tab/Arrows và độ tương phản màu sắc thực tế; không tuyên bố tuân thủ toàn diện mọi phần mềm đọc màn hình chuyên dụng.
5. **Duy Trì Toàn Vẹn Quyết Định Nghiệp Vụ (PO Gates):** Toàn bộ 5 PO Gates và 2 Business Gates được giữ nguyên trạng thái `NeedsPO` trong `decisions.md`.
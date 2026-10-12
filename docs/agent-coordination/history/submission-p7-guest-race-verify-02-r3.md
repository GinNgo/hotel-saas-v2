# Submission P7-GUEST-RACE-VERIFY-02 — Round 3

- **TaskId:** `P7-GUEST-RACE-VERIFY-02`
- **Round:** 3
- **SubmissionId:** `sub-p7-guest-race-verify-02-r3-20261011`
- **ReviewedSubmissionId:** `sub-p7-guest-race-verify-02-r2-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T16:10:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 3` Approved partial, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Hoàn tất toàn diện 4 browser gaps đã giao trong P7, giải quyết triệt để 2 findings của Codex Reviewer Round 2:
  1. **BEH-10b:** Delayed Discovery Positive Control (Unmutated baseline) & In-Flight Race Client Transport Abort (Clear mutation).
  2. **BEH-06b:** Delayed Quote Calculation Positive Control (Unmutated baseline, safe body consumption) & In-Flight Cancellation (Scenario 1: Date Edit, Scenario 2: Rental Mode Switch).
  3. **BEH-11:** Fixture HTTP 500 error & In-browser retry recovery.
  4. **BEH-09:** Rendered keyboard navigation transitions (ArrowDown/Up/Enter/Escape) & focus-visible styling thực tế (2px ring, 54px touch targets).
  **100% NO-DB synthetic loopback fixtures, 0 production code changes, 0 thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội.** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Giải Quyết Triệt Để Findings Từ Reviewer Codex (Round 2)

| Finding | Phân loại | Giải pháp thực hiện trong Round 3 | Vị trí / Minh chứng |
|---|---|---|---|
| **Finding 1** | P2 — Fixture Server Lifecycle Instrumentation & Cancellation Audit | 1. **Sửa đổi toàn diện cơ chế đo lường lifecycle trong `fixture-server.cjs`:** Loại bỏ giả định sai từ `req.on('close')`. Theo dõi độc lập `res.on('finish')` (ghi nhận `responseFinished: true`, `deliveredStatusCode: res.statusCode`, `deliveryOutcome: 'DeliveredToClient'`) và `res.on('close')` khi `!res.writableFinished` (ghi nhận chính xác `responseClosedPrematurely: true`, `deliveredStatusCode: null`, `deliveryOutcome: 'PrematureConnectionClosure'`). Mã `Status499_ClientAbortedBeforeResponseFinish` được định nghĩa là internal audit label, không phải HTTP status được gửi qua mạng.<br>2. **Tiêu thụ an toàn request body trước khi trễ:** Trong `POST /api/public/quotes`, body được parse hoàn toàn trước (`requestCompletedAt` được ghi nhận) rồi mới kích hoạt timer delay.<br>3. **Bổ sung Delayed Positive Controls (Không thao tác UI):** Thiết lập 1500ms delay cho cả Discovery và Quote, người dùng không thao tác gì. Cả hai request hoàn tất bình thường với `deliveredStatusCode: 200`, hiển thị kết quả đầy đủ trên DOM (khẳng định pipeline trễ hoạt động tốt trước khi kiểm thử đua).<br>4. **Lặp lại các kịch bản đột biến:** Kiểm thử Clear (Discovery), Date Edit (Quote Sc.1), Rental Mode Switch (Quote Sc.2) với đầy đủ timestamp và request IDs. | [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/fixture-server.cjs#L130-L280)<br>[`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L26-L165)<br>[`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) |
| **Finding 2** | P2 — Độ chính xác của phát biểu, Build Hashes & Nguồn gốc bằng chứng | 1. **Chuẩn hóa phát biểu hủy kết nối cấp transport:** Xác nhận rõ ràng trong browser runtime, Angular `HttpClient` đã chủ động hủy kết nối TCP (`prematureConnectionClosure: true`, `deliveredStatusCode: null`). Gói tin trễ không đến qua đường truyền mạng (`responseWritten: false`). Cơ chế tăng `requestId` trong Angular là phòng thủ chiều sâu (defense-in-depth) ở tầng mã nguồn, không bị kích hoạt trực tiếp trong runtime vì socket đã bị hủy sạch sẽ.<br>2. **Ghi nhận chính xác mã băm tài nguyên frontend được phục vụ (Served Build Hashes):** Đo lường và đối soát SHA256 cho `index.html`, `main-XPMUQAAX.js`, `polyfills-LVNOU2XZ.js`, `styles-TOZBSW7J.css`.<br>3. **Minh định nguồn gốc ảnh chụp và kiểm chứng bàn phím:** Ảnh `combobox-error-alert.png` được chụp từ R1 và tái xác thực trong R2/R3; ảnh `combobox-keyboard-activedescendant.png` được chụp trong R2 thể hiện cả 2 gợi ý kèm highlight `suggestion-0`. Toàn bộ các bước chuyển đổi ArrowDown/ArrowUp/Enter/Escape được kiểm chứng và đo lường bằng assertions thuộc tính DOM thực tế (`activeSuggestionId`, `aria-activedescendant`, `aria-selected`, `aria-expanded`). | [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L12-L24)<br>[`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/manifest.json#L13-L20)<br>[`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) |

---

## 2. Bảng Mã Băm Tài Nguyên Frontend Được Phục Vụ (Served Build Hashes)

Tất cả các tệp bundle phục vụ ứng dụng phía client tại `frontend/dist/frontend/browser` đã được định danh và kiểm tra mã băm SHA256:

| Tệp bundle | Kích thước (bytes) | SHA256 Hash |
|---|---|---|
| `index.html` | 14,454 | `2A0A27251A43D29811816102C17D288BAC0BF474FD15DB94946E7A61478B3F37` |
| `main-XPMUQAAX.js` | 298,527 | `D43B0BA74960DB8F9FAEF612BAD3341AA35DD534A6B278BB71165389CAFB6442` |
| `polyfills-LVNOU2XZ.js` | 35,876 | `F1B35A3B4DB37B73CA0281D6B6247701465FF9E56A7A7B3AFF9784518DC2C30A` |
| `styles-TOZBSW7J.css` | 62,451 | `90A6E9D59479FBCF9FEE4C1FC81C49E324C3F6BE62B4B77C5A077B41CA7F23A0` |

---

## 3. Kết Quả Kiểm Thực Chi Tiết Các Kịch Bản Đo Lường

Tất cả các thử nghiệm được thực thi tự động qua CDP (`chrome-devtools-mcp`) kết nối máy chủ loopback có khả năng điều khiển độ trễ mạng và tiêm lỗi (`fixture-server.cjs` trên cổng `4282`):

### 3.1. Nhóm BEH-10b: Tìm Kiếm Cơ Sở Lưu Trú (Discovery)
- **Positive Control (Trễ 1500ms, Không Đột Biến):**
  - Cấu hình server: `propertiesDelayMs = 1500`. Nhập truy vấn có dấu `"Sài Gòn"`. Người dùng không thao tác.
  - Server Audit (Req #2): `requestStartedAt: 09:03:33.230Z`, `plannedStatusCode: 200`, `responseFinished: true`, `deliveredStatusCode: 200`, `deliveryOutcome: 'DeliveredToClient'`, `responseBodyCount: 1` (`prop-001`).
  - Browser DOM: Spinner hiển thị tại `t = 404ms`. Tại `t = 2114ms`, spinner tắt, dropdown hiển thị 1 tùy chọn duy nhất: `"Khách sạn Sài Gòn Central"`. Khẳng định đường truyền trễ hoạt động chính xác khi không có đột biến.
- **In-Flight Race & Client Abort (Trễ 2500ms, Nhấp Clear ×):**
  - Cấu hình server: `propertiesDelayMs = 2500`. Nhập `"Sài Gòn"`. Sau 300ms debounce, request bay ra mạng (spinner kích hoạt tại `t = 420ms`). Tại `t = 420ms`, người dùng nhấp Clear (×).
  - Server Audit (Req #5): `requestStartedAt: 09:03:59.745Z`, `requestAbortedIncomplete: true`, `responseClosedPrematurely: true`, `responseClosedAt: 09:03:59.857Z` (~112ms sau khi gửi), `deliveredStatusCode: null`, `deliveryOutcome: 'PrematureConnectionClosure'`.
  - Browser DOM: Giá trị ô nhập lập tức về rỗng `""`. Tại quan sát chân trời `t = 3634ms` (vượt quá 2500ms delay), `finalOptionsCount: 0`, `resurrected: false`. Không có dữ liệu Sài Gòn nào bị hiển thị sống lại.

### 3.2. Nhóm BEH-06b: Tính Toán Báo Giá Động (Dynamic Quote)
- **Positive Control (Trễ 1500ms, Không Đột Biến, Safe Body Consumption):**
  - Cấu hình server: `quoteDelayMs = 1500`. Người dùng chọn phòng Deluxe Double Room.
  - Server Audit (Req #13): Request body được đọc an toàn ngay khi nhận (`requestCompletedAt: 09:04:49.308Z`, chứa đầy đủ `{ propertySlug: "khach-san-sai-gon-central", roomTypeId: "rt-deluxe", rentalType: 2, checkInDate: "2026-10-11", checkOutDate: "2026-10-12" }`).
  - Sau delay 1500ms, response hoàn tất bình thường: `responseFinished: true`, `deliveredStatusCode: 200`, `deliveryOutcome: 'DeliveredToClient'`.
  - Browser DOM: Tại `t = 2113ms`, spinner tắt, khối `#quoteSection` gắn vào DOM hiển thị báo giá chính thức: `"Deluxe Double Room (2 đêm) - 2.400.000 đ"`.
- **Scenario 1 (Đổi Ngày checkOutDate Khi Báo Giá Đang Tính):**
  - Cấu hình server: `quoteDelayMs = 2500`. Người dùng bấm nhận báo giá. Tại `t = 404ms` khi request đang bay, người dùng sửa `checkOutDate` thành `2026-10-25`.
  - Server Audit (Req #16): Body đã được đọc an toàn lúc `09:05:16.418Z`. Khi Angular phát hiện thay đổi tiêu chí, `quoteSub.unsubscribe()` kích hoạt, socket đóng sớm lúc `09:05:16.824Z` (`responseClosedPrematurely: true`, `deliveredStatusCode: null`).
  - Browser DOM: Khối `#quoteSection` bị gỡ bỏ hoàn toàn khỏi DOM tại `t = 3621ms`, không tồn tại báo giá cũ.
- **Scenario 2 (Chuyển Hình Thức Thuê "Theo giờ" Khi Báo Giá Đang Tính):**
  - Cấu hình server: `quoteDelayMs = 2500`. Người dùng bấm nhận báo giá qua đêm. Tại `t = 410ms` khi request đang bay, người dùng bấm nút "Theo giờ".
  - Server Audit (Req #19): Socket đóng sớm lúc `09:05:51.634Z` (`responseClosedPrematurely: true`, `deliveredStatusCode: null`).
  - Browser DOM: Trạng thái thuê chuyển thành "Theo giờ", `#quoteSection` bị gỡ bỏ tại `t = 3614ms`, không để lại báo giá qua đêm cũ.

### 3.3. BEH-11: Fixture HTTP 500 Error & In-Browser Retry Recovery
- Server tiêm mã lỗi HTTP 500 một lần (Req #23: `deliveredStatusCode: 500`, `deliveryOutcome: 'DeliveredError'`).
- Dropdown hiển thị vùng `<div role="alert">` chứa thông điệp *"Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú."* và nút `<button>Thử lại</button>`.
- Nhấp "Thử lại", request mới (Req #24) gửi đi nhận HTTP 200 OK, vùng alert nội bộ dropdown biến mất hoàn toàn, danh sách cơ sở lưu trú hồi phục bình thường (`prop-001`).
- Ảnh minh chứng: [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png).

### 3.4. BEH-09: Rendered Keyboard Navigation & Focus-Visible Styling
- **Kiểm chứng chuyển đổi bàn phím:**
  - Nhập "khách sạn" hiển thị 2 cơ sở (`suggestion-0`: Sài Gòn Central, `suggestion-1`: Biển Đông Đà Nẵng).
  - Phím `ArrowDown`: `aria-activedescendant` trỏ tới `"suggestion-0"`, `aria-selected="true"`, phần tử nhận class highlight `bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200`.
  - Phím `ArrowDown` lần 2: `aria-activedescendant` trỏ tới `"suggestion-1"`, `aria-selected="true"`.
  - Phím `ArrowUp`: `aria-activedescendant` quay lại `"suggestion-0"`.
  - Phím `Enter`: Chấp nhận chọn `"Khách sạn Sài Gòn Central"`, dropdown đóng lại (`aria-expanded="false"`).
  - Phím `Escape`: Đóng dropdown (`aria-expanded="false"`).
- **Kiểm chứng Touch Target & Focus Style:**
  - Chiều cao touch target của các option đo được là `54px`, vượt tiêu chuẩn tối thiểu `44px` của WCAG 2.5.5 / 2.5.8.
  - Vòng focus-visible hiển thị rõ nét với `boxShadow: 2px` (`rgb(224, 231, 255) 0px 0px 0px 2px`) và viền `0.8px solid rgb(79, 70, 229)`.
  - Ảnh minh chứng: [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png).

---

## 4. Danh Mục Bằng Chứng & Xác Thực Mã Băm (Manifest)

Tất cả các tệp bằng chứng được định vị tại thư mục `docs/agent-coordination/evidence/guest-race-verify-02/`:

| Tệp bằng chứng | Dung lượng (bytes) | SHA256 Hash |
|---|---|---|
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json) | 12,279 | `17280DD60D037401F64A44155EBA6ADA1669ACC15C77C42905367CB5F2F982D8` |
| [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/fixture-server.cjs) | 16,792 | `70121E36FFAF3DA94DCB48350CF3C2B2C0A28576433F644FA4E0264B9E02BA68` |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) | 29,717 | `5EFBA2AA0602964D7EC9B473967C3A89AA5380631F23B424ABD7E751AE3A1891` |
| [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png) | 253,002 | `DC3153AA9DEA8B78000348051753C9AA1513D792B65E57DCE5929F7975887ED3` |
| [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) | 256,700 | `2A06B44CB8F5419A46F7521431913D2193E77AF7E598ABA8E9AE5A8F98ACC1CA` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/manifest.json) | — | Quản lý toàn bộ metadata và xác thực độc lập |

---

## 5. Giới Hạn & Cam Kết Kỹ Thuật (Honest Limitations)

1. **Synthetic Loopback Fixtures (No-DB):** 100% các cuộc gọi API được phục vụ bởi máy chủ in-memory `fixture-server.cjs` tại `127.0.0.1:4282`. Không kết nối bất kỳ cơ sở dữ liệu thật (dev, test, staging hay PostgreSQL ambient) nào.
2. **Inbound Server Logging vs OS Outbound Isolation:** Nhật ký mạng ghi nhận 34 request nội bộ `127.0.0.1`, chứng minh các request phục vụ bài test diễn ra hoàn toàn cục bộ. Tuy nhiên, nhật ký máy chủ chỉ là bằng chứng ở cổng vào (inbound), không thay thế cho việc cô lập mạng hoàn toàn ở mức hệ điều hành.
3. **Phòng thủ đa tầng:** Xác nhận rằng Angular `HttpClient` chủ động hủy kết nối socket khi unregister subscription; cơ chế tăng `requestId` là lớp bảo vệ dự phòng bổ sung của tầng component trong tình huống gối gói tin trễ ngoài tầm kiểm soát mạng.
4. **Bảo toàn ranh giới PO:** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`. Không có bất kỳ thay đổi nào đối với logic nghiệp vụ, schema, policy, hay mã nguồn production.
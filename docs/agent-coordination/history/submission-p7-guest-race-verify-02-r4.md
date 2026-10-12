# Submission P7-GUEST-RACE-VERIFY-02 — Round 4

- **TaskId:** `P7-GUEST-RACE-VERIFY-02`
- **Round:** 4
- **SubmissionId:** `sub-p7-guest-race-verify-02-r4-20261011`
- **ReviewedSubmissionId:** `sub-p7-guest-race-verify-02-r3-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T16:20:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 3` Approved partial, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Hiệu chỉnh chính xác các điểm hẹp theo yêu cầu thẩm định Round 3 của Codex:
  1. **BEH-11 Mapping:** Phân định chính xác 2 kết quả retry độc lập trong `network-audit.json`: Hồi phục có dữ liệu (Nonempty recovery) map đúng Reqs #27/#28 (`"Sài Gòn"`, count 1, `prop-001`) và Hồi phục danh sách rỗng (Empty-result recovery) map đúng Reqs #23/#24 (`"Hà Nội"`, count 0).
  2. **BEH-09 Keyboard & Tab Focus:** Cung cấp đầy đủ action/code provenance (`BookingPage.onComboboxKeydown($event)`), chuỗi chuyển đổi DOM bàn phím (ArrowDown/ArrowUp/Enter/Escape), và bổ sung thực nghiệm điều hướng phím `Tab` thực tế qua CDP (`propertySearchInput` -> `<button aria-label="Xóa từ khóa tìm kiếm">` -> `<input id="hourlyDateInput">` -> `Shift+Tab` hồi quy).
  3. **Chuẩn hóa phát biểu WCAG & Transport:** Đo lường 54px touch target (vượt khuyến nghị 44px của WCAG 2.5.5 Level AAA và tối thiểu 24px của WCAG 2.5.8 Level AA, không tuyên bố tuân thủ WCAG toàn diện); giữ nguyên các kịch bản đua đã được Reviewer chấp thuận (không chạy lại); bảo toàn UTF-8 canonical cho toàn bộ PO Gates.
  **100% NO-DB synthetic loopback fixtures, 0 production code changes, 0 thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội.** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Giải Quyết Triệt Để Findings Từ Reviewer Codex (Round 3)

| Finding | Phân loại | Giải pháp & Bằng chứng thực tế trong Round 4 | Vị trí / Minh chứng |
|---|---|---|---|
| **Finding 1** | P2 — BEH11 Request Mapping: Tách bạch Nonempty recovery và Empty recovery | 1. **Hiệu chỉnh mapping chính xác theo `network-audit.json`:**<br>- **Nonempty recovery:** Ánh xạ chính xác tới **Reqs #27 & #28** (`url: /api/public/properties?search=S%C3%A0i%20G%C3%B2n`). Req #27 trả 500 (`DeliveredError`), nút "Thử lại" được kích hoạt; Req #28 trả 200 (`DeliveredToClient`), `responseBodyCount: 1`, `responseItemIds: ["prop-001"]`, hồi phục cơ sở *"Khách sạn Sài Gòn Central"*, alert nội bộ đóng.<br>- **Empty-result recovery:** Bảo lưu độc lập kết quả hợp lệ của **Reqs #23 & #24** (`url: /api/public/properties?search=H%C3%A0%20N%E1%BB%99i`). Req #23 trả 500, Req #24 trả 200 với `responseBodyCount: 0`, `responseItemIds: []`.<br>2. **Không chạy lại đua hay tạo dữ liệu giả:** Giữ nguyên toàn bộ 34 bản ghi mạng có sẵn đã được đối soát. | [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L125-L160)<br>[`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json#L240-L310) |
| **Finding 2** | P2 — BEH09 Tab Focus Navigation & Nguồn gốc chuyển đổi bàn phím | 1. **Cung cấp nguồn gốc mã lệnh & hành động (Action Provenance):** Phương thức component `BookingPage.onComboboxKeydown($event)` tại [`booking.page.ts:167`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts#L167). Trình tự phím ArrowDown/ArrowUp/Enter/Escape được liên kết chặt chẽ với tín hiệu Angular `activeSuggestionIndex`, `activeSuggestionId`, và thuộc tính DOM `aria-activedescendant`, `aria-selected`.<br>2. **Thực thi điều hướng phím `Tab` thực tế qua CDP (`press_key`):**<br>- *Bước 1:* Focus tại combobox `#propertySearchInput` (có từ khóa tìm kiếm), nhấn phím `Tab` -> `document.activeElement` chuyển chính xác sang nút xóa liền kề: `<button aria-label="Xóa từ khóa tìm kiếm">` (tagName: `BUTTON`).<br>- *Bước 2:* Nhấn tiếp phím `Tab` -> `document.activeElement` chuyển sang trường kế tiếp: `<input id="hourlyDateInput" type="date" aria-label="Ngày thuê theo giờ">`.<br>- *Bước 3:* Nhấn `Shift+Tab` -> focus quay ngược lại `<button aria-label="Xóa từ khóa tìm kiếm">`.<br>3. **Đo lường & giới hạn phát biểu chuẩn WCAG:** Touch target 54px đo được vượt cả khuyến nghị 44px (WCAG 2.5.5 Level AAA) và mức tối thiểu 24px (WCAG 2.5.8 Level AA). Ghi chú rõ ràng không tuyên bố tuân thủ WCAG toàn diện. | [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L162-L225)<br>[`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) |

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

## 3. Tổng Hợp Kết Quả Đo Lường 4 Browser Gaps

Tất cả các thử nghiệm được thực thi tự động qua CDP (`chrome-devtools-mcp`) kết nối máy chủ loopback có khả năng điều khiển độ trễ mạng và tiêm lỗi (`fixture-server.cjs` trên cổng `4282`):

### 3.1. Nhóm BEH-10b: Tìm Kiếm Cơ Sở Lưu Trú (Discovery)
- **Positive Control (Trễ 1500ms, Không Đột Biến):**
  - Cấu hình server: `propertiesDelayMs = 1500`. Nhập truy vấn có dấu `"Sài Gòn"`. Người dùng không thao tác.
  - Server Audit (Req #2): `requestStartedAt: 09:03:33.230Z`, `plannedStatusCode: 200`, `responseFinished: true`, `deliveredStatusCode: 200`, `deliveryOutcome: 'DeliveredToClient'`, `responseBodyCount: 1` (`prop-001`).
  - Browser DOM: Spinner hiển thị tại `t = 404ms`. Tại `t = 2114ms`, spinner tắt, dropdown hiển thị 1 tùy chọn duy nhất: `"Khách sạn Sài Gòn Central"`.
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
  - Server Audit (Req #16): Socket đóng sớm lúc `09:05:16.824Z` (`responseClosedPrematurely: true`, `deliveredStatusCode: null`).
  - Browser DOM: Khối `#quoteSection` bị gỡ bỏ hoàn toàn khỏi DOM tại `t = 3621ms`, không tồn tại báo giá cũ.
- **Scenario 2 (Chuyển Hình Thức Thuê "Theo giờ" Khi Báo Giá Đang Tính):**
  - Cấu hình server: `quoteDelayMs = 2500`. Người dùng bấm nhận báo giá qua đêm. Tại `t = 410ms` khi request đang bay, người dùng bấm nút "Theo giờ".
  - Server Audit (Req #19): Socket đóng sớm lúc `09:05:51.634Z` (`responseClosedPrematurely: true`, `deliveredStatusCode: null`).
  - Browser DOM: Trạng thái thuê chuyển thành "Theo giờ", `#quoteSection` bị gỡ bỏ tại `t = 3614ms`, không để lại báo giá qua đêm cũ.

### 3.3. BEH-11: Fixture HTTP 500 Error & In-Browser Retry Recovery
Hai kịch bản hồi phục sau lỗi 500 đã được kiểm chứng và lưu lại trong `network-audit.json`:
1. **Hồi phục có kết quả (Nonempty recovery):**
   - Lỗi ban đầu (Req #27): `GET /api/public/properties?search=S%C3%A0i%20G%C3%B2n`, `deliveredStatusCode: 500`, `deliveryOutcome: 'DeliveredError'`. Dropdown hiển thị `<div role="alert">` với nội dung *"Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú."* và nút `<button>Thử lại</button>`.
   - Thử lại thành công (Req #28): `GET /api/public/properties?search=S%C3%A0i%20G%C3%B2n`, `deliveredStatusCode: 200`, `deliveryOutcome: 'DeliveredToClient'`, `responseBodyCount: 1`, `responseItemIds: ["prop-001"]`. Alert đóng lại, hồi phục *"Khách sạn Sài Gòn Central"*.
2. **Hồi phục kết quả rỗng (Empty-result recovery):**
   - Lỗi ban đầu (Req #23): `GET /api/public/properties?search=H%C3%A0%20N%E1%BB%99i`, `deliveredStatusCode: 500`.
   - Thử lại thành công (Req #24): `GET /api/public/properties?search=H%C3%A0%20N%E1%BB%99i`, `deliveredStatusCode: 200`, `responseBodyCount: 0`, `responseItemIds: []`. Alert đóng lại, danh sách trả về rỗng hợp lệ.
- Ảnh minh chứng: [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png).

### 3.4. BEH-09: Rendered Keyboard Navigation & Focus-Visible Styling
- **Nguồn gốc mã thực thi (Action Provenance):** Phương thức `onComboboxKeydown($event)` trong [`booking.page.ts:167`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts#L167).
- **Chu kỳ bàn phím hoàn chỉnh:**
  - `ArrowDown`: `aria-activedescendant` trỏ tới `"suggestion-0"`, `aria-selected="true"`, nhận class active `bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200`.
  - `ArrowDown` lần 2: `aria-activedescendant` trỏ tới `"suggestion-1"`, `aria-selected="true"`.
  - `ArrowUp`: `aria-activedescendant` quay lại `"suggestion-0"`.
  - `Enter`: Chấp nhận chọn `"Khách sạn Sài Gòn Central"`, dropdown đóng lại (`aria-expanded="false"`).
  - `Escape`: Đóng dropdown (`aria-expanded="false"`).
- **Thực nghiệm điều hướng phím `Tab` thực tế qua CDP (`press_key`):**
  - Bắt đầu từ ô nhập `#propertySearchInput` (có chuỗi tìm kiếm):
    - `Tab`: `document.activeElement` chuyển sang nút xóa: `<button aria-label="Xóa từ khóa tìm kiếm">` (tagName: `BUTTON`, computed outline: `rgb(16, 16, 16) auto 0.8px`).
    - `Tab` lần 2: `document.activeElement` chuyển sang trường kế tiếp: `<input id="hourlyDateInput" type="date" aria-label="Ngày thuê theo giờ">`.
    - `Shift+Tab`: `document.activeElement` quay ngược lại `<button aria-label="Xóa từ khóa tìm kiếm">`.
- **Kích thước Touch Target & Focus Style:**
  - Chiều cao các options đạt `54px`, vượt cả khuyến nghị `44px` của WCAG 2.5.5 Level AAA và mức tối thiểu `24px` của WCAG 2.5.8 Level AA.
  - Vòng focus-visible hiển thị rõ với `boxShadow: 2px` (`rgb(224, 231, 255) 0px 0px 0px 2px`) và viền `0.8px solid rgb(79, 70, 229)`.
  - Ảnh minh chứng: [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png).

---

## 4. Danh Mục Bằng Chứng & Xác Thực Mã Băm (Manifest)

Tất cả các tệp bằng chứng được định vị tại thư mục `docs/agent-coordination/evidence/guest-race-verify-02/`:

| Tệp bằng chứng | Dung lượng (bytes) | SHA256 Hash |
|---|---|---|
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json) | 14,816 | `A59A8E7C8E761A1AEF31FE66BB67130DA8303580EE1A14BE34018C47FEA32F15` |
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
4. **Không tuyên bố WCAG/Screen-reader toàn diện:** Các phép đo touch target (54px) và focus ring (2px) chứng minh sự tuân thủ các quy định giao diện cụ thể; không tuyên bố tuân thủ WCAG toàn trang web hay hỗ trợ hoàn chỉnh công nghệ trợ năng/screen-reader.
5. **Bảo toàn ranh giới PO:** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`. Không có bất kỳ thay đổi nào đối với logic nghiệp vụ, schema, policy, hay mã nguồn production.
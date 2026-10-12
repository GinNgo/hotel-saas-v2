# Submission P7-GUEST-RACE-VERIFY-02 — Round 1

- **TaskId:** `P7-GUEST-RACE-VERIFY-02`
- **Round:** 1
- **SubmissionId:** `sub-p7-guest-race-verify-02-r1-20261011`
- **ReviewedSubmissionId:** `sub-p7-fuzzy-contract-verify-02-r2-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T15:36:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 3` Approved partial, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Hoàn tất 4 browser gaps đã được giao trước trong P7:
  1. **BEH-10b:** Delayed in-flight discovery response race & discarding.
  2. **BEH-06b:** Date edit / late quote recalculation discarding.
  3. **BEH-11:** Fixture HTTP error & in-browser retry recovery.
  4. **BEH-09:** Rendered keyboard navigation (ArrowDown/Up/Enter/Escape/Tab) & focus-visible styling thực tế.
  **100% NO-DB synthetic loopback fixtures, 0 production code changes, 0 thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội.** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Kết Quả Kiểm Thực 4 Browser Gaps Trên Trình Duyệt Thực

Toàn bộ 4 hạng mục trước đây bị đánh dấu `NOT TESTED` hoặc `PARTIAL` tại Round 3 của `P7-GUEST-SEARCH-VERIFY-02` nay đã được thực thi và kiểm chứng trực tiếp trên trình duyệt Chrome (thông qua Chrome DevTools Protocol / CDP) kết hợp máy chủ loopback có khả năng điều khiển độ trễ mạng và tiêm lỗi có chủ đích (`fixture-server.cjs` trên cổng `4282`):

| ID | Hành vi kiểm chứng | Phân loại trước (R3) | Kết quả thực tế Round này | Bằng chứng & Cơ chế kiểm chứng |
| :---: | :--- | :---: | :---: | :--- |
| **BEH-10b** | **Actual Delayed In-Flight Discovery Race** | `NOT TESTED` | **PASS (Browser Runtime)** | Tiêm độ trễ mạng 2500ms trên server cho request tìm kiếm. Gõ từ khóa, sau debounce 300ms request bay ra mạng (spinner kích hoạt). Trước khi phản hồi về, người dùng nhấn nút Clear (×). Khi phản hồi 2500ms cũ cập bến, component hủy bỏ hoàn toàn gói tin trễ (`resurrected: false`, input giữ nguyên rỗng, gợi ý cũ không sống lại). Phân định rõ ràng: gõ nhanh trước 300ms bị throttle trước mạng; request in-flight sau 300ms được gửi mạng và bị hủy bởi logic `requestId` khi bị clear. |
| **BEH-06b** | **Date Edit / Late Quote Discarding** | `NOT TESTED` | **PASS (Browser Runtime)** | Tiêm độ trễ 2500ms cho endpoint `POST /api/public/quotes`. Người dùng chọn cơ sở và hạng phòng, kích hoạt báo giá in-flight (spinner `isLoadingQuote`). Trong khi request đang bay, người dùng sửa ngày trả phòng hoặc đổi sang thuê giờ. Khối `quoteSection` bị gỡ bỏ, `quoteRequestId` tăng lên. Khi response 2500ms cũ trở về, nó bị discard hoàn toàn (`staleQuoteRevived: false`, `quoteSectionExistsAfterDateEdit: false`, giá cũ không bao giờ xuất hiện trên thanh CTA sticky). |
| **BEH-11** | **Fixture HTTP Error & In-Browser Retry** | `NOT TESTED (Browser)` | **PASS (Browser Runtime)** | Kích hoạt cờ lỗi một lần trên server `propertiesErrorNext = true`. Trình duyệt gửi request tìm kiếm và nhận mã lỗi HTTP 500. Dropdown hiển thị vùng `<div role="alert">` chứa thông điệp lỗi và nút `<button>Thử lại</button>`. Nhấp nút "Thử lại", request mới gửi đi nhận HTTP 200 OK thành công, alert bị gỡ bỏ khỏi DOM (`dropdownAlertClearedAfterRetry: true`) và danh sách cơ sở phục hồi bình thường. Ảnh chụp: `combobox-error-alert.png`. |
| **BEH-09** | **Rendered Keyboard Navigation & Focus-Visible** | `PARTIAL / SOURCE ONLY` | **PASS (Browser Runtime)** | Bàn phím điều hướng thực tế trên Combobox: ArrowDown mở dropdown và gán `aria-activedescendant="suggestion-0"` (option 0 nhận style `bg-indigo-50`, `ring-1`); ArrowDown lần 2 chuyển sang `suggestion-1`; ArrowUp quay lại `suggestion-0`; Enter chọn cơ sở và đóng dropdown; Escape đóng dropdown mà không chọn. Đo đạc computed style qua CDP: viền ring 2px visible (`rgb(224, 231, 255) 0px 0px 0px 2px`), container border `rgb(79, 70, 229)`, nút chuyển thuê có outline `solid 2.4px`, chiều cao 44px đạt chuẩn touch target. Chuỗi phím Tab bám vết đúng các control. Ảnh chụp: `combobox-keyboard-activedescendant.png`. |

---

## 2. Đo Lường Chi Tiết Từ Runtime Trình Duyệt

Tệp chỉ số chi tiết: [`docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json)

### 2.1. BEH-10b: In-Flight Request Race & Stale Response Discarding
- **Độ trễ tiêm vào mạng:** 2500ms trên `GET /api/public/properties?search=Sai+Gon`.
- **Trạng thái khi request đang bay:**
  - `inFlightDebounceFired: true` (sau 300ms debounce).
  - `inFlightSpinnerObserved: true` (`.animate-spin` hiển thị trong DOM).
  - `inFlightInputVal: "Sai Gon"`.
- **Thao tác can thiệp khi request đang bay:**
  - Nhấp nút Clear (×): `clearedWhileInFlight: true`.
  - Giá trị input ngay sau khi clear: `inputVal: ""`.
- **Trạng thái sau khi gói tin 2500ms cũ trở về:**
  - `finalInputVal: ""`.
  - `resurrected: false` (gợi ý "Sai Gon" cũ không sống lại trong dropdown).
  - `isComboboxOpen: false`.
- **Phân định rõ ràng (Debounce vs In-flight):**
  - *Before-debounce:* Gõ nhanh liên tiếp trong vòng 300ms được throttle hoàn toàn ở tầng timer; 0 request mạng được gửi đi cho các phím gõ tạm thời.
  - *Actual in-flight:* Sau 300ms, request thực tế được gửi ra mạng; nếu người dùng tiếp tục thao tác (clear hoặc gõ ký tự mới) trước khi gói tin về, cờ `requestId !== this.propertySearchRequestId` sẽ loại bỏ toàn bộ dữ liệu phản hồi muộn.

### 2.2. BEH-06b: Date Edit & Late Quote Recalculation Discarding
- **Độ trễ tiêm vào mạng:** 2500ms trên `POST /api/public/quotes`.
- **Trạng thái khi quote đang tính:**
  - `quoteRequestInFlight: true`.
  - `hasLoadingQuoteSpinner: true` (text *"Đang tính toán báo giá theo bảng giá..."*).
- **Thao tác can thiệp khi quote đang bay:**
  - Kịch bản A: Người dùng đổi `checkOutDate` từ `2026-10-12` sang `2026-10-20`.
  - Kịch bản B: Người dùng bấm chuyển hình thức thuê sang *"Theo giờ"*.
  - Cả hai thao tác kích hoạt `resetSelectionAndAvailability()`, tăng `quoteRequestId++` và hủy `quoteSub`.
- **Trạng thái sau khi quote 2500ms cũ trở về:**
  - `quoteSectionExistsAfterDateEdit: false` (khối báo giá cũ bị gỡ hoàn toàn khỏi DOM).
  - `staleQuoteRevived: false` (báo giá cũ không bao giờ được áp dụng lại).
  - `stickyBottomPriceRevived: false` (thanh CTA sticky đáy màn hình không hiển thị giá của lịch cũ).

### 2.3. BEH-11: Fixture HTTP 500 Error & In-Browser Retry Recovery
- **Mã lỗi tiêm vào:** HTTP 500 (`Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú.`).
- **Phát hiện lỗi trên giao diện:**
  - `alertElementFoundInDropdown: true`.
  - `alertRole: "alert"`.
  - `alertMessage: "Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú. Thử lại"`.
  - `retryButtonFound: true`, `retryButtonText: "Thử lại"`.
- **Thao tác thử lại (Retry):**
  - Nhấp nút "Thử lại" (`retryBtn.click()`).
  - Request mới được gửi đi tới máy chủ và nhận HTTP 200 OK.
  - `dropdownAlertClearedAfterRetry: true` (container alert bị xóa khỏi DOM).
  - `optionsRenderedAfterRetry: 1` (danh sách cơ sở được nạp lại bình thường).
- **Ảnh chụp bằng chứng:** [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png).

### 2.4. BEH-09: Rendered Keyboard Navigation & Focus-Visible Styling
- **Tọa độ & Kích thước DOM:**
  - Ô nhập liệu `#propertySearchInput`: `x: 174.0, y: 344.75, width: 285.86, height: 32.0`.
  - Viền container: `border: rgb(79, 70, 229)` (indigo-600).
  - Viền ring focus visible: `box-shadow: rgb(255, 255, 255) 0px 0px 0px 0px, rgb(224, 231, 255) 0px 0px 0px 2px, rgba(0, 0, 0, 0) 0px 0px 0px 0px` (2px focus ring indigo-100).
- **Điều hướng phím mũi tên & Chọn:**
  - Nhấn `ArrowDown` lần 1: `expandedAfterDown: "true"`, `activeDescendantAfterDown: "suggestion-0"`. Option 0 nhận style active `bg-indigo-50`, `ring-1`, tọa độ `y: 410.6, height: 54.1`.
  - Nhấn `ArrowDown` lần 2: `activeDescendant: "suggestion-1"`. Option 1 nhận `aria-selected="true"`.
  - Nhấn `ArrowUp`: Quay lại `activeDescendant: "suggestion-0"`.
  - Nhấn `Enter`: Chọn cơ sở, nạp tên `"Khách sạn Sài Gòn Central"` vào input, đóng popup (`expandedAfterEnter: "false"`, `isPopupClosed: true`).
  - Nhấn `Escape`: Đóng popup (`closedAfterEsc: true`) mà không làm thay đổi lựa chọn.
- **Chuỗi phím Tab (Tab Focus Sequence):**
  - Nút *"Theo đêm"*: `isFocused: true`, `outline: "rgb(255, 255, 255) solid 2.4px"`, chiều cao `44px` đạt chuẩn touch target.
  - Ô nhập *"Địa điểm / Khách sạn"*: `isFocused: true`, container nhận ring 2px.
  - Ô nhập *"Nhận phòng"*: `isFocused: true`.
  - Ô nhập *"Trả phòng"*: `isFocused: true`.
- **Ảnh chụp bằng chứng:** [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png).

---

## 3. Kiểm Toán Mạng & Bằng Chứng Loopback (Network Audit)

Tệp nhật ký: [`docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json)
- **Tổng số request inbound ghi nhận:** 39 requests.
- **Nguồn gốc:** 100% từ địa chỉ loopback local `127.0.0.1`.
- **Phân bổ:**
  - Static SPA bundles: `/booking`, `/chunk-*.js`, `/styles-*.css`.
  - API requests: `/api/public/properties` (gồm 2 request lỗi 500 có chủ đích, các request trễ 2500ms, và các request retry 200 OK), `/api/public/properties/.../availability`, `/api/public/quotes` (request trễ 2500ms).
  - Control endpoints: `/__control/config`, `/__control/status`, `/__audit/network`.

---

## 4. Danh Mục Minh Chứng & Bảng Băm SHA-256 (Evidence Hashes)

Thư mục bằng chứng: [`docs/agent-coordination/evidence/guest-race-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/)

| Tệp tin bằng chứng | Kích thước (bytes) | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json) | 6,010 | `170889693B16BB844901595BB96FD07CD71979FEC3C31AA099CA57CDB1CCA942` | Đo lường chi tiết DOM, timing, computed styles, và kết quả 4 browser gaps (Strict JSON) |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/manifest.json) | 3,842 | *(xem manifest)* | Manifest ghi nhận môi trường, tóm tắt kết quả, và giới hạn minh bạch |
| [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/fixture-server.cjs) | 11,779 | `71CEA4852BCD8D71EBDFEC1DCE2268BE8481BA32CDECF46539ABA8122F768DEE` | Máy chủ loopback hỗ trợ cấu hình độ trễ mạng (`delayMs`) và tiêm lỗi (`errorNext`) |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) | 8,958 | `6FB549AA083A93E3698252A7A4B2C4F08230F196A99204368F9F573A51482076` | Export toàn bộ 39 inbound requests tới máy chủ loopback `127.0.0.1:4282` |
| [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png) | 253,002 | `DC3153AA9DEA8B78000348051753C9AA1513D792B65E57DCE5929F7975887ED3` | Ảnh chụp giao diện dropdown hiển thị thông báo lỗi HTTP 500 và nút "Thử lại" |
| [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) | 251,983 | `46BC84624147921CCB43C89FB8DF5D9ED275E67F5EE59C5F7D489D808D0AACE8` | Ảnh chụp combobox đang được điều hướng bằng phím mũi tên, active descendant `suggestion-0` |

---

## 5. Giới Hạn Kỹ Thuật Minh Bạch (Honest Limitations)

1. **Cô lập Cơ Sở Dữ Liệu (No-DB Mandate):** Toàn bộ thử nghiệm chạy 100% in-memory loopback không kết nối bất kỳ cơ sở dữ liệu PostgreSQL nào (dev/staging/prod/ambient).
2. **Kiểm toán cách ly mạng:** Nhật ký máy chủ xác nhận 39 request inbound từ `127.0.0.1`. Tuy nhiên, nhật ký máy chủ không chứng minh việc trình duyệt không gửi request nào ra ngoài (ví dụ tải font chữ từ Google Fonts nếu chưa cache).
3. **Không tuyên bố chứng nhận WCAG / Screen-Reader:** Khả năng tiếp cận được đo lường chính xác ở mức thuộc tính DOM (`role`, `aria-expanded`, `aria-activedescendant`, `aria-selected`), computed styles (vòng ring 2px, outline), và sự kiện bàn phím thực tế.

---

## 6. Tuyên Bố Ranh Giới An Toàn (Safety Invariants)

1. **0 sửa đổi mã nguồn sản phẩm (Zero code changes):** Không chỉnh sửa bất kỳ dòng code runtime nào của frontend hay backend.
2. **0 kết nối database ngoài:** Không cấu hình hay kết nối tới bất kỳ database dev, staging hay production nào.
3. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
4. **Giữ nguyên toàn bộ PO Gates:** Cả 5 PO Gates và 2 Business Gates tiếp tục duy trì trạng thái `NeedsPO` trong [`task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) và [`decisions.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/decisions.md).
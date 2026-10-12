# Submission P7-GUEST-RACE-VERIFY-02 — Round 2

- **TaskId:** `P7-GUEST-RACE-VERIFY-02`
- **Round:** 2
- **SubmissionId:** `sub-p7-guest-race-verify-02-r2-20261011`
- **ReviewedSubmissionId:** `sub-p7-guest-race-verify-02-r1-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T15:48:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 3` Approved partial, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Hoàn tất 4 browser gaps đã được giao trước trong P7:
  1. **BEH-10b:** Delayed in-flight discovery response race & discarding (Non-vacuous accented query baseline).
  2. **BEH-06b:** Date edit / late quote recalculation discarding (Tách riêng 2 kịch bản: Date edit & Rental mode switch).
  3. **BEH-11:** Fixture HTTP error & in-browser retry recovery.
  4. **BEH-09:** Rendered keyboard navigation & focus-visible styling thực tế.
  **100% NO-DB synthetic loopback fixtures, 0 production code changes, 0 thay đổi schema/migration/policy/inventory/pricing/TTL, không ảnh hưởng modules đồng đội.** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Giải Quyết Triệt Để Findings Từ Reviewer Codex (Round 1)

| Finding | Phân loại | Giải pháp thực hiện trong Round 2 | Vị trí / Minh chứng |
|---|---|---|---|
| **Finding 1** | P2 — Non-vacuous discovery race & positive baseline | Xác thực positive baseline trước: truy vấn có dấu `"Sài Gòn"` trả về chính xác 1 cơ sở `prop-001` ("Khách sạn Sài Gòn Central"). Sau đó chạy kịch bản đua in-flight với 2500ms delay trên chính truy vấn này; người dùng nhấp Clear (×) khi request đang bay. Khi response 2500ms chứa dữ liệu thực cập bến, component hủy bỏ toàn bộ gói tin, không làm sống lại gợi ý cũ. Loại bỏ triệt để tính rỗng ngầm (non-vacuous proof). | [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L26-L65)<br>[`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) |
| **Finding 2** | P2 — Captured event timeline, socket cancellation vs late delivery & tách biệt kịch bản quote | 1. Xây dựng timeline chi tiết từng millisecond cho các sự kiện: nhập liệu (`t0`), debounce/request bay (`t1`), thao tác người dùng (`t2`), và mốc quan sát DOM cuối (`t3`).<br>2. Đo lường độc lập hai tầng: Server audit log ghi nhận Angular `HttpClient` đã phát tín hiệu abort socket ngay khi người dùng Clear hoặc đổi ngày (`deliveredStatusCode: 499`, `ClientAbortedBeforeDelivery`), đồng thời ở tầng component `propertySearchRequestId++` / `quoteRequestId++` ngăn chặn mọi phản hồi muộn.<br>3. Tách biệt độc lập 2 kịch bản quote: Scenario 1 (Date Edit) và Scenario 2 (Rental Mode Switch).<br>4. Cập nhật ảnh chụp [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) hiển thị toàn bộ 2 gợi ý với `suggestion-0` được highlight. | [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json#L37-L140)<br>[`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/fixture-server.cjs#L110-L150)<br>[`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) |

---

## 2. Kết Quả Kiểm Thực 4 Browser Gaps Trên Trình Duyệt Thực

Tất cả các thử nghiệm được thực thi tự động qua CDP (`chrome-devtools-mcp`) kết nối máy chủ loopback có khả năng điều khiển độ trễ mạng và tiêm lỗi (`fixture-server.cjs` trên cổng `4282`):

| ID | Hành vi kiểm chứng | Kết quả thực tế | Cơ chế & Bằng chứng xác minh |
| :---: | :--- | :---: | :--- |
| **BEH-10b** | **Actual Delayed In-Flight Discovery Race (Non-Vacuous)** | **PASS (Browser Runtime)** | - **Positive Baseline:** Truy vấn `"Sài Gòn"` trả về đúng 1 kết quả (`prop-001`, *"Khách sạn Sài Gòn Central"*).<br>- **In-Flight Race:** Đặt server delay 2500ms cho `GET /api/public/properties?search=S%C3%A0i+G%C3%B2n`. Sau debounce 300ms, request bay ra mạng (spinner kích hoạt tại `t = 413ms`). Tại `t = 415ms`, người dùng nhấp Clear (×).<br>- **Cơ chế kép:** Angular `HttpClient` lập tức hủy socket (`clientAborted: true`, HTTP status 499 tại server), đồng thời `propertySearchRequestId++` tăng lên. Tại `t = 3428ms`, DOM xác nhận `finalInputVal: ""`, `optionsCount: 0`, gợi ý Sài Gòn hoàn toàn không sống lại (`resurrected: false`). |
| **BEH-06b (Sc. 1)** | **Date Edit During In-Flight Quote Calculation** | **PASS (Browser Runtime)** | Đặt server delay 2500ms cho `POST /api/public/quotes`. Người dùng bấm nhận báo giá (`t = 1022ms`), spinner tính giá kích hoạt (`t = 1378ms`). Tại `t = 1380ms`, người dùng đổi `checkOutDate` từ `2026-10-12` sang `2026-10-25`. Socket in-flight bị abort (`clientAborted: true`, status 499), `quoteRequestId++` tăng lên. Tại `t = 4385ms`, `quoteSectionExists: false`, báo giá cũ bị gỡ hoàn toàn khỏi DOM, không hiển thị giá cũ trên thanh sticky. |
| **BEH-06b (Sc. 2)** | **Rental Mode Switch During In-Flight Quote Calculation** | **PASS (Browser Runtime)** | Đặt server delay 2500ms cho `POST /api/public/quotes`. Người dùng bấm nhận báo giá (`t = 610ms`), spinner tính giá kích hoạt (`t = 963ms`). Tại `t = 964ms`, người dùng bấm chuyển sang *"Theo giờ"*. Socket in-flight bị abort (status 499). Tại `t = 3972ms`, `activeMode: "Theo giờ"`, `quoteSectionExists: false`, báo giá cũ không sống lại. |
| **BEH-11** | **Fixture HTTP Error & In-Browser Retry Recovery** | **PASS (Browser Runtime)** | Server tiêm mã lỗi HTTP 500 một lần. Trình duyệt gửi request tìm kiếm, dropdown hiển thị vùng `<div role="alert">` chứa thông điệp *"Máy chủ gặp sự cố khi tìm kiếm cơ sở lưu trú."* và nút `<button>Thử lại</button>`. Nhấp "Thử lại", request mới gửi đi nhận HTTP 200 OK, alert biến mất khỏi DOM (`dropdownAlertClearedAfterRetry: true`), danh sách cơ sở hồi phục bình thường. Ảnh: [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png). |
| **BEH-09** | **Rendered Keyboard Navigation & Focus-Visible Styling** | **PASS (Browser Runtime)** | Điều hướng phím trên Combobox: ArrowDown mở dropdown và gán `aria-activedescendant="suggestion-0"` (option 0 nhận style active `bg-indigo-50`, `ring-1`); ArrowDown lần 2 chuyển sang `suggestion-1`; ArrowUp quay lại `suggestion-0`; Enter chọn cơ sở và đóng dropdown; Escape đóng dropdown mà không chọn. Đo đạc computed style qua CDP: viền ring 2px visible (`rgb(224, 231, 255) 0px 0px 0px 2px`), container border `rgb(79, 70, 229)`, nút chuyển thuê có outline `solid 2.4px`, chiều cao 44px đạt chuẩn touch target. Chuỗi phím Tab bám vết đúng các control. Ảnh: [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) (hiển thị đầy đủ 2 gợi ý với suggestion-0 được chọn). |

---

## 3. Nhật Ký Sự Kiện & Đo Lường Timeline Chi Tiết

Tệp chỉ số đầy đủ: [`docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json)

### 3.1. Timeline BEH-10b (Delayed In-Flight Discovery)
- `t = 0ms`: `input_entered` (value: `"Sài Gòn"`).
- `t = 413ms`: `debounce_fired_in_flight` (request bay ra mạng với delay 2500ms, `hasSpinner: true`).
- `t = 415ms`: `clear_button_clicked` (người dùng nhấp Clear, input lập tức về `""`).
- `t = 3428ms`: `observation_horizon_reached` (sau khi gói tin 2500ms hoàn tất trên mạng, `finalInputVal: ""`, `optionsCount: 0`, `resurrected: false`).
- **Server Audit (Request ID 16):** `url: /api/public/properties?search=S%C3%A0i%20G%C3%B2n`, `delayConfiguredMs: 2500`, `clientAborted: true`, `deliveredStatusCode: 499`, `deliveryOutcome: "ClientAbortedBeforeDelivery"`.

### 3.2. Timeline BEH-06b Scenario 1 (Date Edit During Quote)
- `t = 1017ms`: `property_selected` ("Khách sạn Sài Gòn Central").
- `t = 1022ms`: `quote_button_clicked` ("Deluxe Double Room").
- `t = 1378ms`: `quote_in_flight_observed` (`hasLoadingQuote: true`).
- `t = 1380ms`: `checkout_date_mutated_while_in_flight` (`prevDate: "2026-10-12"`, `newDate: "2026-10-25"`).
- `t = 4385ms`: `observation_horizon_reached` (`quoteSectionExists: false`, `staleQuoteRevived: false`, `stickyBarPresent: false`).
- **Server Audit (Request ID 23):** `url: /api/public/quotes`, `delayConfiguredMs: 2500`, `clientAborted: true`, `deliveredStatusCode: 499`, `deliveryOutcome: "ClientAbortedBeforeDelivery"`.

### 3.3. Timeline BEH-06b Scenario 2 (Rental Mode Switch During Quote)
- `t = 610ms`: `quote_button_clicked` ("Deluxe Double Room").
- `t = 963ms`: `quote_in_flight_observed` (`hasLoadingQuote: true`).
- `t = 964ms`: `rental_mode_switched_while_in_flight` (người dùng chuyển sang `"Theo giờ"`).
- `t = 3972ms`: `observation_horizon_reached` (`activeMode: "Theo giờ"`, `quoteSectionExists: false`, `staleQuoteRevived: false`, `stickyBarPresent: false`).
- **Server Audit (Request ID 26):** `url: /api/public/quotes`, `delayConfiguredMs: 2500`, `clientAborted: true`, `deliveredStatusCode: 499`, `deliveryOutcome: "ClientAbortedBeforeDelivery"`.

---

## 4. Danh Mục Minh Chứng & Bảng Băm SHA-256 (Evidence Hashes)

Thư mục bằng chứng: [`docs/agent-coordination/evidence/guest-race-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/)

| Tệp tin bằng chứng | Kích thước | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/browser-measurements.json) | 10,378 B | `22B1B0BABBBF7F63F94883744C4945F7C352F2C930F62C47E28C5AD8F4C19C9A` | Đo lường chi tiết DOM, positive baseline, event timelines từng ms, transport audits (Strict JSON) |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/manifest.json) | 3,783 B | `8CCA75AAFF79D33133B55F152F856AECF2FD0005BB93208B5218F43F3A70CE16` | Manifest Round 2 ghi nhận môi trường, tóm tắt kết quả và limitations minh bạch |
| [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/fixture-server.cjs) | 14,098 B | `68425177254A47A49CC3A24E473168E64F8BD0C8A18B8CD0B4FB79963A6C14CD` | Máy chủ loopback hỗ trợ delay, error injection, và theo dõi chi tiết socket abort / delivery outcome |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/network-audit.json) | 14,391 B | `6562369269EA167ECD11A4CDCFCC3D2CB06D2F48DA772676F281AA5184CCD79C` | Export toàn bộ 31 inbound requests với thời điểm bắt đầu, kết thúc, mã status và delivery outcome |
| [`combobox-error-alert.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-error-alert.png) | 253,002 B | `DC3153AA9DEA8B78000348051753C9AA1513D792B65E57DCE5929F7975887ED3` | Ảnh chụp giao diện dropdown hiển thị thông báo lỗi HTTP 500 và nút "Thử lại" |
| [`combobox-keyboard-activedescendant.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-race-verify-02/combobox-keyboard-activedescendant.png) | 256,700 B | `2A06B44CB8F5419A46F7521431913D2193E77AF7E598ABA8E9AE5A8F98ACC1CA` | Ảnh chụp combobox mở với đầy đủ 2 gợi ý, option 0 active (`suggestion-0`) |

---

## 5. Giới Hạn Kỹ Thuật Minh Bạch (Honest Limitations)

1. **Cô lập Cơ Sở Dữ Liệu (No-DB Mandate):** Toàn bộ thử nghiệm chạy 100% in-memory loopback không kết nối bất kỳ cơ sở dữ liệu PostgreSQL nào (dev/staging/prod/ambient).
2. **Kiểm toán cách ly mạng:** Nhật ký máy chủ xác nhận 31 request inbound từ `127.0.0.1`. Tuy nhiên, nhật ký máy chủ không chứng minh việc trình duyệt không gửi request nào ra ngoài (ví dụ tải font chữ từ Google Fonts nếu chưa cache).
3. **Không tuyên bố chứng nhận WCAG / Screen-Reader:** Khả năng tiếp cận được đo lường chính xác ở mức thuộc tính DOM (`role`, `aria-expanded`, `aria-activedescendant`, `aria-selected`), computed styles (vòng ring 2px, outline), và sự kiện bàn phím thực tế.

---

## 6. Tuyên Bố Ranh Giới An Toàn (Safety Invariants)

1. **0 sửa đổi mã nguồn sản phẩm (Zero code changes):** Không chỉnh sửa bất kỳ dòng code runtime nào của frontend hay backend.
2. **0 kết nối database ngoài:** Không cấu hình hay kết nối tới bất kỳ database dev, staging hay production nào.
3. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
4. **Giữ nguyên toàn bộ PO Gates:** Cả 5 PO Gates và 2 Business Gates tiếp tục duy trì trạng thái `NeedsPO` trong [`task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) và [`decisions.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/decisions.md).
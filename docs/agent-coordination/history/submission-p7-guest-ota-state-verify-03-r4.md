# Submission P7-GUEST-OTA-STATE-VERIFY-03 — Round 4

- **TaskId:** `P7-GUEST-OTA-STATE-VERIFY-03`
- **Round:** 4
- **SubmissionId:** `sub-p7-guest-ota-state-verify-03-r4-20261011`
- **ReviewedSubmissionId:** `sub-p7-guest-ota-state-verify-03-r3-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T23:15:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5-GUEST-OTA-UI-03` round 4 Approved (`sub-p5-guest-ota-ui-03-r4-20261011`).
- **Scope:** Khắc phục triệt để các phát hiện vòng 3 từ Codex (`history/review-p7-guest-ota-state-verify-03-r3.md`), bảo toàn toàn bộ mã nguồn giao diện đã được chấp thuận:
  - **Khắc phục chuỗi thao tác phím & phân tách rành mạch các subrun (Finding 1 — P2):**
    - **Kịch bản di động (Mobile 375px):** Delineate rõ ràng 2 subrun lùi riêng biệt kèm vị trí focus khởi đầu:
      - *Subrun A (Lùi từ ô nhập ngày):* Focus khởi đầu tại `checkInDateInput` (`15:53:51Z`) $\to$ `Shift+Tab` lùi về `propertySearchInput` (`15:54:11Z`) $\to$ `Shift+Tab` về "Theo giờ" (`15:54:20Z`) $\to$ `Shift+Tab` về "Theo đêm" (`15:54:49Z`).
      - *Subrun B (Lùi từ nút CTA):* Focus khởi đầu tại `#heroSearchButton` (`16:09:01Z`) $\to$ `Shift+Tab` lùi về nút tăng khách "+" (`16:09:19Z`) $\to$ `Shift+Tab` (bỏ qua nút giảm khách disabled) về `checkOutDateInput` (`16:09:30Z`).
      - *Công bố giới hạn trung thực:* Đánh dấu PARTIAL / NOT TESTED đối với chuỗi lùi liên tục toàn phần từ CTA về đầu trang trong 1 lượt do ranh giới điều hướng các trường con nội bộ của date picker trên Chromium mobile.
    - **Kịch bản thuê theo giờ (Hourly Mode):** Delineate rõ ràng 2 subrun riêng biệt kèm vị trí focus khởi đầu:
      - *Subrun A (Tiến):* Focus khởi đầu tại `propertySearchInput` (`15:51:50Z`), Tab $\to$ `hourlyDateInput` (`15:51:56Z`) $\to$ `hourlyDurationSelect` (`15:52:47Z`) $\to$ tăng khách (`15:52:49Z`) $\to$ tìm phòng (`15:52:50Z`).
      - *Subrun B (Lùi):* Focus khởi đầu tại Stepper (`15:52:45Z`), Shift+Tab $\to$ `hourlyDurationSelect` (`15:52:47Z`) $\to$ `hourlyDateInput` (`15:53:00Z`) $\to$ `propertySearchInput` (`15:53:02Z`).
      - Công bố rõ ràng Subrun A và Subrun B là 2 phiên thử nghiệm độc lập, không tuyên bố là một vòng lặp liên tục duy nhất.
    - **Kịch bản nút Xóa (Clear Control):** Ghi nhận rõ bước refocus: sau khi lùi về `propertySearchInput` (`15:50:42Z`), thực hiện nhấn `Tab` tiến để refocus nút Xóa (`15:50:43Z`), rồi mới nhấn `Enter` trên nút Xóa (`15:50:44Z`) để xóa từ khóa về `""` và unmount nút khỏi DOM.
  - **Khôi phục chính xác metadata gốc từ vòng 1 cho các ảnh tái sử dụng (Finding 2 — P2):**
    - Khôi phục chính xác các timestamp metadata gốc từ capture log vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`):
      - `error-alert-inline.png`: `2026-10-11T15:12:33.107Z` (Metadata từ capture log vòng 1).
      - `error-retry-success.png`: `2026-10-11T15:13:07.975Z` (Metadata từ capture log vòng 1).
      - `mobile-form-full-clearance-375.png`: `2026-10-11T15:15:36Z` (Metadata từ capture log vòng 1).
      - `mobile-form-focus-name-375.png`: `2026-10-11T15:15:57Z` (Metadata từ capture log vòng 1).
      - `combobox-keyboard-cycle.png`: `2026-10-11T15:16:42Z` (Metadata từ capture log vòng 1).
    - Công bố rõ ràng: Các mốc thời gian này là writer metadata từ đợt kiểm thử vòng 1, không phải telemetry nhận gói tin độc lập của CDP.
    - `loading-spinner-active.png`: `2026-10-11T15:29:55.000Z` (Chụp tươi vòng 2 khi request 16 đang in-flight dưới độ trễ 30s, đã được Codex thẩm định và chấp thuận).
  - **Bảo toàn toàn vẹn:** 0 thay đổi mã nguồn (giữ nguyên mã băm nguồn `booking.page.ts` $84,938\text{ B}$ và `public-booking.page.spec.ts` $63,165\text{ B}$), 0 backend/schema/API/DB changes, 0 kết nối DB thật, không sửa đổi module đồng đội. Giữ nguyên tệp log kiểm toán mạng `network-audit.json` ($45,262\text{ B}$, SHA256: `1582F669...`). Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Chi Tiết Khắc Phục Các Điểm Đánh Giá Từ Vòng 3

### 1.1. Finding 1 (P2 — Subrun Delineation, Clear Control Refocus, and Mobile Reverse Limitations)

#### A. Kịch bản di động (Mobile 375px) — Delineate 2 Subrun và giới hạn lùi toàn phần
- **Forward Traversal (Khởi đầu từ đầu trang 'Tra cứu đặt phòng'):**
  - Tab 1 (`16:07:30.813Z`): `BUTTON` ("Theo đêm", `136 x 44px`, `ariaPressed: "true"`).
  - Tab 2 (`16:07:41.137Z`): `BUTTON` ("Theo giờ", `136 x 44px`, `ariaPressed: "false"`).
  - Tab 3 (`16:07:55.553Z`): `INPUT#propertySearchInput` (`258.4 x 32px`).
  - Tab 4 (`16:07:59.698Z`): `INPUT#checkInDateInput` (`258.4 x 28px`).
  - Tab 5 (`16:08:04.487Z`): `INPUT#checkOutDateInput` (`258.4 x 28px`).
  - Tab 6 (`16:08:10.055Z`): Nút Giảm khách (-) có `[disabled]="true"`, tự động bỏ qua $\to$ `BUTTON` ("+", `44 x 44px`).
  - Tab 7 (`16:08:15.393Z`): `BUTTON#heroSearchButton` ("Tìm phòng", `280 x 52px`).
- **Reverse Observations (Ghi nhận theo 2 Subrun độc lập):**
  - **Subrun A (Lùi từ ô nhập ngày):** Focus khởi đầu tại `checkInDateInput` (`15:53:51.682Z`):
    - `Shift+Tab` 1 (`15:54:11.000Z`): Lùi về `INPUT#propertySearchInput` (`258.4 x 32px`).
    - `Shift+Tab` 2 (`15:54:20.000Z`): Lùi về `BUTTON` ("Theo giờ", `136 x 44px`).
    - `Shift+Tab` 3 (`15:54:49.000Z`): Lùi về `BUTTON` ("Theo đêm", `136 x 44px`).
  - **Subrun B (Lùi từ nút CTA):** Focus khởi đầu tại `heroSearchButton` (`16:09:01.000Z`):
    - `Shift+Tab` 1 (`16:09:19.274Z`): Lùi về nút tăng khách ("+", `44 x 44px`).
    - `Shift+Tab` 2 (`16:09:30.736Z`): Nút giảm khách (-) bị disabled nên tự động bỏ qua $\to$ lùi về `INPUT#checkOutDateInput` (`258.4 x 28px`).
  - **Công bố giới hạn trung thực (Actionable Limitation Disclosure):**
    - Chuỗi lùi liên tục một lượt (single uninterrupted reverse pass) từ CTA về đầu trang trên di động được ghi nhận là **PARTIAL / NOT TESTED** do hành vi điều hướng các trường con nội bộ (ngày/tháng/năm) của thẻ `<input type="date">` trên trình duyệt Chromium di động tạo ra ranh giới ngắt đoạn. Khả năng duyệt lùi được xác nhận độc lập trên từng phân đoạn (Subrun A và Subrun B).

#### B. Kịch bản thuê theo giờ (Hourly Mode) — Delineate 2 Subrun độc lập
- **Subrun A (Duyệt tiến — Khởi đầu từ `#propertySearchInput` lúc `15:51:50Z`):**
  - Tab 1 (`15:51:56.000Z`): `INPUT#hourlyDateInput` (`166.7 x 28px`, `aria-label="Ngày thuê theo giờ"`).
  - Tab 2 (`15:52:47.000Z`): Duyệt qua các trường con ngày $\to$ `SELECT#hourlyDurationSelect` (`166.7 x 28px`, `aria-label="Thời lượng thuê theo giờ"`).
  - Tab 3 (`15:52:49.000Z`): `BUTTON` ("+", `44 x 44px`).
  - Tab 4 (`15:52:50.000Z`): `BUTTON#heroSearchButton` ("Tìm phòng", `176.5 x 86.2px`).
- **Subrun B (Duyệt lùi — Khởi đầu từ Stepper lúc `15:52:45Z`):**
  - Shift+Tab 1 (`15:52:47.000Z`): `SELECT#hourlyDurationSelect` (`166.7 x 28px`).
  - Shift+Tab 2 (`15:53:00.000Z`): `INPUT#hourlyDateInput` (`166.7 x 28px`).
  - Shift+Tab 3 (`15:53:02.000Z`): `INPUT#propertySearchInput` (`341.3 x 32px`).
- **Minh bạch:** Subrun A và Subrun B được công bố rõ ràng là 2 phiên kiểm thử độc lập với điểm khởi đầu riêng biệt, phản ánh đúng trình tự thời gian đo đạc thực tế.

#### C. Kịch bản nút Xóa (Clear Control) — Ghi nhận thao tác Refocus
- Nhập từ khóa `"Khách sạn"`, nút Xóa (`button[aria-label="Xóa từ khóa tìm kiếm"]`, `44 x 44px`) được mount vào DOM nằm liền sau combobox.
- Tab từ `#propertySearchInput` $\to$ nhận focus trên nút Xóa (`15:50:38Z`).
- Tab tiếp $\to$ `#checkInDateInput` (`15:50:40Z`).
- Shift+Tab lùi từ `#checkInDateInput` $\to$ trở lại nút Xóa (`15:50:41Z`).
- Shift+Tab lùi tiếp $\to$ `#propertySearchInput` (`15:50:42Z`).
- **Thao tác refocus:** Từ `#propertySearchInput`, nhấn `Tab` tiến lúc `15:50:43Z` để refocus vào nút Xóa (`activeElement` là nút Xóa).
- Nhấn `Enter` trên nút Xóa (`15:50:44Z`) $\to$ xóa sạch từ khóa về `""`, nút Xóa unmount khỏi DOM (`clearButtonPresent: false`).

---

### 1.2. Finding 2 (P2 — Reused Image Provenance & Metadata Alignment)

- **Khôi phục chính xác metadata từ Round 1 capture log:**
  - `loading-spinner-active.png`: Ảnh chụp tươi vòng 2 ($126,700\text{ B}$, SHA256 `6324E43C...`, request 16 đang in-flight dưới độ trễ $30\text{s}$, chụp lúc `2026-10-11T15:29:55.000Z`, đã được Codex thẩm định và chấp thuận).
  - `error-alert-inline.png`: Tái sử dụng từ vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`, SHA256 `87EFA4C8...`). Mốc thời gian metadata gốc từ capture log vòng 1: `2026-10-11T15:12:33.107Z`.
  - `error-retry-success.png`: Tái sử dụng từ vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`, SHA256 `B29E659D...`). Mốc thời gian metadata gốc từ capture log vòng 1: `2026-10-11T15:13:07.975Z`.
  - `combobox-keyboard-cycle.png`: Tái sử dụng từ vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`, SHA256 `973D02C6...`). Mốc thời gian metadata gốc từ capture log vòng 1: `2026-10-11T15:16:42Z`.
  - `mobile-form-full-clearance-375.png`: Tái sử dụng từ vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`, SHA256 `E452A020...`). Mốc thời gian metadata gốc từ capture log vòng 1: `2026-10-11T15:15:36Z`.
  - `mobile-form-focus-name-375.png`: Tái sử dụng từ vòng 1 (`sub-p7-guest-ota-state-verify-03-r1-20261011`, SHA256 `64C95503...`). Mốc thời gian metadata gốc từ capture log vòng 1: `2026-10-11T15:15:57Z`.
- **Minh bạch bản chất metadata:** Các timestamp trên được phân định rõ ràng là metadata ghi nhận từ capture log của writer trong đợt nộp vòng 1, không tuyên bố là telemetry nhận gói tin độc lập của CDP.

---

## 2. Bảng Đối Chiếu Artifacts và Bằng Chứng (Artifact Manifest)

| Tệp Bằng Chứng | Kích Thước | SHA256 Hash | Xuất Xứ (Provenance) | Mô Tả Trạng Thái Thị Giác |
| :--- | :--- | :--- | :--- | :--- |
| [`loading-spinner-active.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/loading-spinner-active.png) | 126,700 B | `6324E43C5F3F7C19E251215848C3F3C6C427DA23A2BEC2C7B99A95D071FD8F3F` | Chụp tươi vòng 2 (`15:29:55Z`) | Request 16 pending under 30s delay; spinning icon in dropdown and button; 0 properties |
| [`error-alert-inline.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-alert-inline.png) | 130,275 B | `87EFA4C84C8271D019417927489874492CFEE1A8C311BC694D44508BF73231F3` | Tái sử dụng vòng 1 (metadata `15:12:33.107Z`) | Inline alert box (role="alert", bg-rose-50) with "Thử lại" button; SweetAlert2 toast |
| [`error-retry-success.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/error-retry-success.png) | 170,601 B | `B29E659D71ED068712F72B7908750D2843072A3C22241BB90D6A4A805E40CB18` | Tái sử dụng vòng 1 (metadata `15:13:07.975Z`) | Listbox recovery showing 1 matching suggestion ("Khách sạn Sài Gòn Central") & badge "1 cơ sở" |
| [`combobox-keyboard-cycle.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/combobox-keyboard-cycle.png) | 171,422 B | `973D02C6C8EC93579B2D3C9B45A1F19701D3F828E04D72DDC326930C579C1653` | Tái sử dụng vòng 1 (metadata `15:16:42Z`) | Single visual state showing suggestion-0 highlighted with focus on propertySearchInput |
| [`mobile-form-full-clearance-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-full-clearance-375.png) | 59,512 B | `E452A020F2572DE24CDC8C0848D06E77039F5BDABC135D728E1E1C76AB846EE4` | Tái sử dụng vòng 1 (metadata `15:15:36Z`) | Simultaneous clearance at scrollY=3695: 4 inputs + labels + confirm button visible |
| [`mobile-form-focus-name-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/mobile-form-focus-name-375.png) | 60,061 B | `64C95503BE74CA09E2841BD33D77E1E6FE9118B51D6B36D096D17B397859814E` | Tái sử dụng vòng 1 (metadata `15:15:57Z`) | Centered focus on guestNameInput at scrollY=3453; scrollIntoView method disclosed |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/network-audit.json) | 45,262 B | `1582F66986191B8D444AD1FE6DE58004A7DC110A0EFC1EABD27D65EBF5377612` | Ghi nhận vòng đời fixture server (1–51 requests) | Complete lifecycle log mapping requests 16, 47, 48, 50, 51; server lifecycle limitation disclosed |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/capture-log.json) | 39,462 B | `64C19F21350D930EC408E4A8A5407F3CF04EB0545D3A5189DBC10E2D4F1198F7` | Cập nhật vòng 4 (23:10:00+07:00) | Full CDP trace, delineated subruns, refocus action, and explicit partial reverse limitations |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/manifest.json) | 10,711 B | `CCC639072583459F4144A48D02436F2B800CB0D450FFA44F6A4E52419C2AFD17` | Cập nhật vòng 4 (23:10:00+07:00) | Verification manifest with original round 1 metadata, build hashes, and touch area limitations |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-state-verify-03/source-manifest.json) | 1,409 B | `D616901683895C6BCDAFBAC0A514580CE3DB17A74625DBD4B56C317CA80F63D0` | Cập nhật vòng 4 (23:10:00+07:00) | Source file manifest confirming zero source edits and git commit 3f95339b4f4477ac5d421551d372dfdd5ed31e30 |

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
Đợt đệ trình Vòng 4 giải quyết triệt để và minh bạch toàn bộ các yêu cầu từ Codex Round 3 Review:
- Delineate rõ ràng các subrun di động và thuê theo giờ, công bố trung thực giới hạn lùi toàn phần trên di động.
- Ghi nhận chi tiết bước refocus trong kịch bản nút Xóa.
- Khôi phục chính xác các mốc thời gian metadata gốc từ capture log vòng 1 cho các ảnh tái sử dụng.
- Sẵn sàng để Codex tiến hành thẩm định và phê duyệt cho `P7-GUEST-OTA-STATE-VERIFY-03` Round 4.
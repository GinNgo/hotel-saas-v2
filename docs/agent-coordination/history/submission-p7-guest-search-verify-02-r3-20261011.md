# Báo Cáo Nghiệm Thu: P7-GUEST-SEARCH-VERIFY-02 (Round 3)

- **TaskId:** P7-GUEST-SEARCH-VERIFY-02
- **Round:** 3
- **SubmissionId:** sub-p7-guest-search-verify-02-r3-20261011
- **ReviewedSubmissionId:** sub-p7-guest-search-verify-02-r2-20261011
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** 2026-10-11T12:47:30+07:00
- **Actor:** antigravity
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Giải Quyết Triệt Để Các Findings Từ Reviewer Codex (Round 2)

### 1.1. Phân Loại Nhãn Bằng Chứng Chuẩn Xác (Narrow Evidence Classification)
Theo chỉ dẫn của Reviewer Codex, báo cáo Round 3 loại bỏ hoàn toàn tuyên bố "11/11 browser PASS" giả định, đồng thời phân định minh bạch giữa các hành vi trình duyệt thực tế đã được kiểm chứng, các quan sát mã nguồn/unit test riêng biệt, và các kịch bản chưa được kiểm thử tại runtime:

1. **BEH-11 (Lỗi & Nút thử lại trên trình duyệt):** Được đánh dấu trung thực là **NOT TESTED** trên trình duyệt vì máy chủ fixture trả về HTTP 200 OK trong toàn bộ phiên chạy; cấu trúc `<div *ngIf="propertiesError()" role="alert">` kèm nút `<button (click)="retryLoadProperties()">Thử lại</button>` và logic xử lý lỗi được ghi nhận tách biệt là **bằng chứng mã nguồn & unit spec** (`public-booking.page.spec.ts`).
2. **BEH-10 (Debounce vs Đua phản hồi trễ - Stale response race):** Phân tách thành hai mục:
   - **BEH-10a (Keystroke Debounce Throttling):** **PASS** — Gõ nhanh nhiều phím trong 100ms được quan sát thực tế bị throttle thành một request duy nhất hiển thị kết quả cuối cùng.
   - **BEH-10b (Delayed In-Flight Response Race):** **NOT TESTED** — Kịch bản đua thứ tự phản hồi (request 1 về sau request 2) chưa được mô phỏng vì máy chủ fixture phản hồi đồng bộ, không có độ trễ mạng nhân tạo.
3. **BEH-09 (Tab & Focus-Visible):** Đánh dấu là **PARTIAL / SOURCE ONLY** — Điều hướng phím Tab và bám vết `document.activeElement` được xác nhận; các class CSS `focus-visible:ring-2 focus-visible:ring-indigo-500` có mặt trong source, nhưng độ duy trì vòng viền focus thực tế dưới phím Tab chưa được đo đạc qua CDP computed style hay ảnh chụp focus riêng.
4. **BEH-06 (Chuyển đổi hình thức thuê vs Chỉnh sửa ngày thực tế):** Phân tách thành hai mục:
   - **BEH-06a (Rental Mode Button Toggle):** **PASS** — Chuyển đổi giữa "Theo đêm" và "Theo giờ" cập nhật `aria-pressed` và thích ứng số lượng date input từ 2 xuống 1.
   - **BEH-06b (Date Edit & Late Quote Recalculation):** **NOT TESTED** — Kịch bản người dùng chỉnh sửa ngày cụ thể trên lịch và tính toán lại báo giá trễ chưa được thực thi tại runtime trong phiên trình duyệt.

### 1.2. Kiểm Toán Mạng & Giới Hạn Cách Ly Mạng Thực Tế (Network Audit Phrasing)
- **Loại bỏ triệt để các tuyên bố phóng đại:** Đã xóa bỏ toàn bộ các khẳng định "100% application/data isolation" khỏi manifest, measurements và submission.
- **Giới hạn trung thực (Honest Limitation):**
  - [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/network-audit.json) ghi nhận 36 inbound request đến máy chủ fixture local tại `127.0.0.1:4282`.
  - Log máy chủ inbound chỉ xác định các request gửi tới máy chủ này; log này **không thể và không chứng minh** trình duyệt không gửi request nào ra ngoài. Do đó, **không tuyên bố cách ly mạng 100% ở mức OS hay trình duyệt**.
  - Chrome DevTools network inspector ghi nhận 1 request tải font ngoài tới `https://fonts.gstatic.com/s/inter/...` (trạng thái cache chưa được kiểm chứng độc lập).
  - Không có bất kỳ kết nối cơ sở dữ liệu thật hay môi trường cloud nào được cấu hình hay sử dụng.

---

## 2. Ma Trận Nghiệm Thu Trình Duyệt Thực Tế (Browser Verification Matrix)

| ID | Hành vi kiểm chứng | Phân loại | Kết quả thực tế & Ghi nhận giới hạn |
| :---: | :--- | :---: | :--- |
| **BEH-01** | Discovery ban đầu trả nonempty, không tự chọn cơ sở, 0 room cards | **PASS** | Ô tìm kiếm rỗng (`""`), nạp 2 cơ sở, `selectedProperty = null`, 0 thẻ phòng được nạp (`hasAvailabilityLoaded: false`). |
| **BEH-02** | Explicit selection nạp đúng 2 hạng phòng | **PASS** | Nhấp *"Chọn cơ sở này & Xem phòng"* nạp đúng 2 hạng phòng ("Deluxe Double Room", "Executive Suite"). |
| **BEH-03** | Immediate invalidation khi gõ, combobox autocomplete, ArrowDown & Escape | **PASS** | Gõ phím hủy chọn cơ sở cũ, mở dropdown listbox (`aria-expanded="true"`), ArrowDown gán `aria-activedescendant="suggestion-0"`, Escape đóng dropdown. |
| **BEH-04** | Nút Clear (×) xóa trắng input và reset cơ sở | **PASS** | Nhấp nút Clear đặt lại input về `""` và `selectedProperty` về `null`. |
| **BEH-05** | Luồng giữ phòng tổng hợp điều hướng tới trang hold | **PASS** | Điền thông tin và nhấp giữ phòng tạo token `tok-mv3domni-0vsdm`, điều hướng tới `/booking/hold/tok-mv3domni-0vsdm`, countdown timer `14:56`. |
| **BEH-06a** | Chuyển đổi nút hình thức thuê (Rental mode toggle) | **PASS** | Toggling overnight $\leftrightarrow$ hourly cập nhật `aria-pressed` và thích ứng số lượng date input từ 2 xuống 1. |
| **BEH-06b** | Chỉnh sửa ngày & Tính toán lại báo giá trễ | **NOT TESTED** | *Giới hạn:* Chưa thực hiện thao tác nhập sửa ngày cụ thể và quan sát recalculation tại runtime trình duyệt. |
| **BEH-07** | Hiển thị thông báo đang tải (Loading state) trong DOM | **PASS** | Dropdown DOM hiển thị `popupText = "Đang tìm kiếm cơ sở lưu trú..."` trong khi request autocomplete đang gửi. |
| **BEH-08** | Hiển thị thông báo không tìm thấy (Empty state) trong DOM | **PASS** | Nhập `khach-san-khong-ton-tai-xyz` hiển thị `popupText = "Không tìm thấy cơ sở lưu trú nào phù hợp."` sau debounce. |
| **BEH-09** | Duy trì viền focus-visible khi điều hướng Tab | **PARTIAL / SOURCE ONLY** | Bám vết phím Tab và `activeElement` xác nhận; source chứa class `focus-visible:ring-indigo-500`, nhưng viền ring thực tế chưa đo bằng CDP computed style. |
| **BEH-10a** | Throttling debounce khi gõ phím nhanh | **PASS** | Gõ nhanh trong 100ms được throttle thành 1 query duy nhất hiển thị kết quả cuối cùng (*"Khách Sạn Biển Đông Đà Nẵng"*). |
| **BEH-10b** | Đua thứ tự phản hồi mạng trễ (Delayed in-flight race) | **NOT TESTED** | *Giới hạn:* Máy chủ fixture phản hồi đồng bộ, chưa tiêm độ trễ mạng để kiểm chứng đảo ngược thứ tự gói tin. |
| **BEH-11** | Báo lỗi & Nút thử lại trên trình duyệt (Error & Retry) | **NOT TESTED (Browser) / PASS (Unit/Source)** | *Giới hạn trình duyệt:* Fixture luôn trả về 200 OK nên error alert chưa kích hoạt tại runtime. *Xác minh mã nguồn:* Template có `<div *ngIf="propertiesError()" role="alert">...<button (click)="retryLoadProperties()">Thử lại</button></div>`; logic được kiểm thử độc lập qua unit test `public-booking.page.spec.ts`. |

---

## 3. Đo Lường Bố Cục Trình Duyệt & Bằng Chứng Viewports

| Viewport | CSS Dimensions (px) | DPR | `scrollWidth` / `clientWidth` | Tràn ngang | Bằng chứng ảnh |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Desktop** | $1440 \times 900$ | 1.0 | 1425 / 1425 px | **FALSE** | [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/desktop-1440.png) |
| **Dropdown Open** | $1440 \times 900$ | 1.0 | 1425 / 1425 px | **FALSE** | [`combobox-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/combobox-dropdown-open.png) (Rộng 357.9px, z-index 50, 0 clipped ancestors) |
| **Tablet** | $768 \times 1024$ | 1.0 | 753 / 753 px | **FALSE** | [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/tablet-768.png) |
| **Mobile** | $375 \times 812$ | 2.0 | 375 / 375 px | **FALSE** | [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375.png) (Nút thuê cạnh nhau 134.8px) |
| **Mobile Popup** | $375 \times 812$ | 2.0 | 375 / 375 px | **FALSE** | [`mobile-375-popup.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375-popup.png) (Rộng 276.0px, options cao 54.1px) |
| **Diagnostic 320** | $320 \times 568$ | 2.0 | 320 / 320 px | **FALSE** | *Đo lường trong browser-measurements.json* (Rộng 220.8px, nút $\le 283.2$px) |

---

## 4. Danh Mục Bằng Chứng & Bảng Băm SHA-256 (Evidence Hashes)

Thư mục bằng chứng: [`docs/agent-coordination/evidence/guest-search-verify-02/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/):

| Tệp tin bằng chứng | Kích thước (bytes) | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`browser-measurements.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/browser-measurements.json) | 9,402 | `fc845e560c12845c7b3a40fa8968ffcab253fbf7ed1067aa2c5f44d487998e72` | Chỉ số đo đạc DOM, phân loại ma trận kiểm thử trung thực, audit network (Strict JSON) |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/manifest.json) | 8,819 | *(xem manifest)* | Bảng manifest Round 3 phân định rõ ràng các kịch bản và giới hạn |
| [`network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/network-audit.json) | 7,122 | `d3b72a140287a0e1385ca018f1f3b9db33eb04536e4bcb15c5fac9d172b4cede` | Export 36 request inbound tới máy chủ fixture loopback |
| [`combobox-dropdown-open.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/combobox-dropdown-open.png) | 255,631 | `c0eebc72a9bbea9bc6795901e9f94eb3af0e2c2e10e8dcc44cd63acc1f82a920` | Ảnh chụp dropdown mở tại Desktop 1440px |
| [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/desktop-1440.png) | 253,571 | `18aac74279256314815677fec0cbde8323f41e9ababb01200b7c93b0a9d05a1c` | Ảnh chụp giao diện Desktop 1440px |
| [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/fixture-server.cjs) | 12,565 | `adc4a9ce5fe46d8414aafe6bc9a0a00d810fcf35046b2584cfb35c64ea0515b8` | Máy chủ loopback phục vụ static build và synthetic mock endpoints |
| [`frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/frontend-build.log) | 3,039 | `1ee07fefaca05efb817e8037ba993297187cb11edb129d7ef98844bf7f95f143` | Log build baseline từ P5-R2 (output: `frontend/dist/frontend/browser`) |
| [`mobile-375-popup.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375-popup.png) | 372,976 | `0b11bde82445beb6859c7a6818ceae9b605a4f9c15b92fbb440464cc91a76d74` | Ảnh chụp dropdown mở trên Mobile 375px |
| [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/mobile-375.png) | 339,381 | `470fa0c232b9de54855c7874c41b1efd4be0a50a06259fca57b62a29d8781f20` | Ảnh chụp giao diện Mobile 375px |
| [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/tablet-768.png) | 207,205 | `763f105cb0e2d2dc554d3ea3f80268a19934a3abe90eaa9b2a48aaee937c0311` | Ảnh chụp giao diện Tablet 768px |
| [`vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/vitest-full.log) | 2,049 | `09abe7fb53f946c432ee75705d0db0a7708577fbeb52a89f09329abeb6bc2374` | Log test suite frontend baseline từ P5-R2 (179/179 pass) |
| [`vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-search-verify-02/vitest-targeted.log) | 625 | `a9ad5ab3f955f42d2edbcbd996e912cb9c69a2681e19c38b4573f6d4618295db` | Log targeted booking spec baseline từ P5-R2 (49/49 pass) |

---

## 5. Tuyên Bố Ranh Giới An Toàn (Safety Invariants)

1. **0 sửa đổi mã nguồn sản phẩm (Zero code changes):** Giữ nguyên vẹn mã nguồn frontend đã được duyệt; chỉ cập nhật tệp bằng chứng và nhãn kiểm chứng.
2. **0 kết nối database ngoài:** Không cấu hình hay kết nối tới bất kỳ database dev, staging hay production nào.
3. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
4. **0 che đậy lỗi layout bằng `overflow-x: hidden`:** Kiểm chứng tự nhiên tại các breakpoint 1440px, 768px, 375px và 320px.
5. **Trung thực về kiểm toán và giới hạn:** Phân biệt rõ ràng giữa các kịch bản đã kiểm chứng trực tiếp, các kịch bản chưa được kiểm thử tại runtime, và nguồn gốc các tệp log baseline.

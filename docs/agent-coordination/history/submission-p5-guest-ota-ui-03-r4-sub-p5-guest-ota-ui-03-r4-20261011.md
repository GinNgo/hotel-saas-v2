# Submission P5-GUEST-OTA-UI-03 — Round 4

- **TaskId:** `P5-GUEST-OTA-UI-03`
- **Round:** 4
- **SubmissionId:** `sub-p5-guest-ota-ui-03-r4-20261011`
- **ReviewedSubmissionId:** `sub-p5-guest-ota-ui-03-r3-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T22:05:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 4` Approved, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Khắc phục chính xác 2 nhóm phát hiện về metadata/chú thích/giới hạn từ đợt đánh giá vòng 3 (`history/review-p5-guest-ota-ui-03-r3.md`), bảo toàn toàn bộ mã nguồn giao diện đã vượt qua kiểm thử:
  - **Khắc phục định danh bằng chứng (Finding 1 — P2):** Cập nhật chính xác mã băm tệp kiểm thử `public-booking.page.spec.ts` (`0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`, 63,165 bytes) và kích thước tệp lazy chunk thực tế trên đĩa `chunk-BBKId7t-.js` (72,447 bytes, SHA256: `51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD`).
  - **Độ chính xác chú thích & Minh bạch giới hạn kiểm thử (Finding 2 — P3):**
    - Chú thích trung thực cho `mobile-form-clearance-375.png`: Xác nhận toàn bộ 4 khung nhập liệu (`#guestNameInput`, `#guestEmailInput`, `#guestPhoneInput`, `#numberOfGuestsInput`) và nút `#confirmHoldButton` hoàn toàn hiển thị, tương tác tốt và không bị che khuất (`confirmHoldButtonBottom: 591.8px <= stickyTop: 707.2px`, khoảng đệm 115.4px). Thừa nhận trung thực nhãn chữ phía trên ô họ tên (*'Họ và tên \*'*) bị chạm/che một phần dưới thanh header cố định tại vị trí `scrollY = 3730px`.
    - Phân tách nguồn gốc ảnh rõ ràng: Phân định rành mạch giữa các ảnh chụp mới ở Vòng 3 (`after-1440.png`, `availability-cards-1440.png`, `selected-room-768.png`, `mobile-form-clearance-375.png`, `combobox-keyboard-active.png`) và các ảnh tham chiếu tái sử dụng từ Vòng 2 (`after-768.png`, `after-375.png`, `selected-room-1440.png`, `selected-room-375.png`).
    - Công bố tường minh trạng thái `NOT TESTED` trong phiên giao diện trực quan cho: `newUiErrorAlert`, `newUiLoadingSpinner`, `newUiFullTabFocusCycle`, `screenReaderAudioOutput` và `fullCheckoutPaymentGateway`.
  - **Giới hạn kỹ thuật:** 0 backend/schema/API changes, 0 kết nối DB thật, không sửa đổi module của đồng đội (Nguyên/Tân). Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.

---

## 1. Chi Tiết Khắc Phục Các Điểm Đánh Giá Từ Vòng 3 (Review Findings Resolution)

### 1.1. Finding 1 (P2 — Evidence Identity Correction: Test File Hash & Lazy Booking Chunk Size)
- **Vấn đề vòng 3:**
  1. Tệp kiểm thử `public-booking.page.spec.ts` trong bảng Vòng 3 trước đây ghi sai mã băm SHA256 (ghi mã băm của tệp test cũ thay vì mã băm thực tế trên đĩa).
  2. Kích thước lazy chunk `chunk-BBKId7t-.js` trong bảng Vòng 3 trước đây ghi 74,188 bytes, trong khi kích thước tệp thực tế biên dịch trên đĩa là 72,447 bytes (ng build báo 72.45 kB).
- **Giải pháp xử lý:**
  1. Kiểm tra trực tiếp trên đĩa bằng PowerShell (`Get-FileHash` và `Get-Item`):
     - `public-booking.page.spec.ts`: kích thước thực tế **63,165 bytes**, SHA256: `0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED`.
     - `chunk-BBKId7t-.js`: kích thước thực tế **72,447 bytes**, SHA256: `51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD`.
     - `booking.page.ts`: kích thước thực tế **84,938 bytes**, SHA256: `B8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74`.
  2. Đồng bộ hóa toàn bộ các thông số thực tế này vào [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/source-manifest.json), [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/manifest.json) và bản đệ trình này.

### 1.2. Finding 2 (P3 — Caption Precision & Honest Test Disclosures)
- **Độ chính xác chú thích cho `mobile-form-clearance-375.png`:**
  - Tại vị trí cuộn `scrollY = 3730px` trên mobile 375px:
    - Đáy header cố định: `headerBottom = 89.3px`.
    - Đầu khung nhập họ tên: `nameInputTop = 106.2px` (lọt xuống dưới đáy header 16.9px).
    - Đáy nút xác nhận giữ chỗ: `confirmHoldButtonBottom = 591.8px`.
    - Đỉnh thanh tóm tắt neo đáy: `stickyTop = 707.2px` (khoảng cách an toàn phía trên thanh neo: 115.4px).
    - **Quan sát trung thực:** Toàn bộ 4 khung nhập liệu (`#guestNameInput`, `#guestEmailInput`, `#guestPhoneInput`, `#numberOfGuestsInput`) và nút `#confirmHoldButton` hoàn toàn hiển thị và tương tác tốt. Tuy nhiên, phần nhãn chữ phía trên ô họ tên (*'Họ và tên \*'*) bị nằm dưới vùng header cố định tại vị trí cuộn này. Chú thích và metadata đã được hiệu chỉnh chính xác để không khẳng định nhãn chữ hiển thị 100%.
- **Phân định rõ ràng nguồn gốc ảnh chụp (Image Provenance Categorization):**
  - **Ảnh chụp mới ở Vòng 3 (chứa các cải tiến uncropped badge và scroll-mt-24):**
    - `after-1440.png` (Desktop 1440px): Badge minh họa ngoài SVG.
    - `availability-cards-1440.png` (Desktop 1440px): 2 thẻ phòng trống với badge ngoài SVG.
    - `selected-room-768.png` (Tablet 768px): Tiêu đề Bước 3 với `scroll-mt-24` không bị che bởi sticky header.
    - `mobile-form-clearance-375.png` (Mobile 375px): Khung nhập form và nút giữ chỗ cách thanh đáy 115.4px.
    - `combobox-keyboard-active.png` (Desktop 1440px): Trace phím ArrowDown chọn option gợi ý.
  - **Ảnh tham chiếu tái sử dụng từ Vòng 2 (trạng thái ban đầu không thay đổi):**
    - `after-768.png` (Tablet 768px ban đầu).
    - `after-375.png` (Mobile 375px ban đầu).
    - `selected-room-1440.png` (Desktop 1440px downstream).
    - `selected-room-375.png` (Mobile 375px downstream quote breakdown).
  - **Ảnh baseline lịch sử trước khi redesign:**
    - `before-1440.png`, `before-768.png`, `before-375.png`.
- **Minh bạch các hạng mục không kiểm thử trong phiên chụp trực quan (Explicit NOT TESTED Disclosures):**
  - `newUiErrorAlert`: **NOT TESTED** trong phiên chụp giao diện (không kích hoạt thông báo lỗi toast giả lập).
  - `newUiLoadingSpinner`: **NOT TESTED** trong phiên chụp giao diện (máy chủ fixture loopback phản hồi tức thì nên không duy trì spinner).
  - `newUiFullTabFocusCycle`: **NOT TESTED** trong phiên chụp giao diện (đã xác thực tương tác phím ArrowDown trong combobox; chu trình duyệt Tab/Shift+Tab toàn trang chưa chạy lại trên template mới).
  - `screenReaderAudioOutput`: **NOT TESTED** (đánh giá trợ năng tập trung vào cấu trúc DOM ngữ nghĩa, thuộc tính ARIA, độ tương phản computed style và kích thước touch target $\ge 44\text{px}$).
  - `fullCheckoutPaymentGateway`: **NOT TESTED** (ngoài phạm vi của giao diện đặt phòng công khai; bảo lưu cổng PO).

---

## 2. Kết Quả Kiểm Thử Kỹ Thuật

### 2.1. Kiểm Thử Đơn Vị (Vitest Unit Tests)
- **Lệnh thực thi:**
  ```bash
  npx vitest run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts
  ```
- **Kết quả:** **57 passed / 57 tests (100% pass)** trong 2.04s:
  - `public-booking.page.spec.ts`: **41 passed / 41 tests** (Xác thực ARIA attributes, zero emoji, các ID bắt buộc `#heroSearchCard`, `#heroSearchButton`, `#propertyListSection`, `#quoteSection`, `#stickySummaryBar`, `#stickyBottomCtaButton`, `#confirmHoldButton`).
  - `public-booking.service.spec.ts`: **16 passed / 16 tests**.

### 2.2. Kiểm Thử Biên Dịch (Production Build & Warning Report)
- **Lệnh thực thi:**
  ```bash
  npm run build
  ```
- **Kết quả:** Biên dịch thành công với exit code **0**.
- **Kích thước bundle:** Lazy chunk `booking-page` (`chunk-BBKId7t-.js`) đạt **72.45 kB** (chính xác **72,447 bytes** trên đĩa; transfer gzip xấp xỉ **14.47 kB**).
- **Cảnh báo trung thực:** Quá trình build đạt exit code 0, không phát sinh lỗi (0 Errors). Giữ nguyên cảnh báo tối ưu hóa CommonJS tiền khả dụng của module toàn cục `sweetalert2` mà không tự nhận "0 warnings".

### 2.3. Đo Lường Tràn Ngang (CDP Audit)
- **Desktop (1440px):** `winWidth: 1440px`, `docScrollWidth: 1425px` (PASS - không tràn).
- **Tablet (768px):** `winWidth: 768px`, `docScrollWidth: 753px` (PASS - không tràn).
- **Mobile (375px):** `winWidth: 375px`, `docScrollWidth: 375px`, `overflowCount: 0` (PASS - khớp 100%, không tràn).

---

## 3. Danh Mục Bằng Chứng & Mã Băm Thực Tế (Evidence Manifest)

### 3.1. Mã Băm Bundle Phân Phối (Served Build Hashes)
- `index.html`: `5136EDFCCC7F9F7242B1E45A63A38A8A2A4381B71926EB473C236E408EE68471`
- `main-VOVICY46.js`: `E7E4AF2A6B315A47B1BEE0A0727DABC9FBC4F7C74662972294E65E83E772EDAC`
- `polyfills-LVNOU2XZ.js`: `F1B35A3B4DB37B73CA0281D6B6247701465FF9E56A7A7B3AFF9784518DC2C30A`
- `styles-6JJ6BZPE.css`: `8AC14F155576052F789B1812B070DF7776332AE59B5D99419C01CE4B38952FF5`
- `chunk-BBKId7t-.js` (booking-page lazy chunk): `51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD` (72,447 bytes)

### 3.2. Ảnh Chụp Bằng Chứng & Tệp Metadata
Lưu trữ đầy đủ tại `docs/agent-coordination/evidence/guest-ota-ui-03/`:

| Tệp bằng chứng | Giai đoạn & Phân loại nguồn gốc | Kích thước | SHA256 Hash |
|---|---|---|---|
| `before-1440.png` | Baseline lịch sử — Desktop (1440px) | 431,677 B | `92F028DA1476B41D90FF6480EFCF5231E19B10C6136E7BA7581B550CB1DFEB85` |
| `before-768.png` | Baseline lịch sử — Tablet (768px) | 363,961 B | `A8C99AD18071CACCD7727FDF867887E58B899808821D1C834B005281379EC16B` |
| `before-375.png` | Baseline lịch sử — Mobile (375px) | 185,086 B | `914ED11376180AD2F0CBFACEC69FD172599B15B438863E9CBF2682C5F7B29EDA` |
| `after-1440.png` | Ảnh chụp mới Vòng 3 — Desktop (1440px) | 212,312 B | `98DDD6D4836E52067380C4127863BAF35727B49949FBE698742E5B316466616F` |
| `after-768.png` | Tham chiếu tái sử dụng Vòng 2 — Tablet (768px) | 181,318 B | `26739773612EDBA3E27F0EDDA19E77F1B1CACA7658097832D9ABDA3155408337` |
| `after-375.png` | Tham chiếu tái sử dụng Vòng 2 — Mobile (375px) | 58,128 B | `956BB044F361928BE4A038DF692E1878F09DBE37D5F03FE4501E839D21674ADC` |
| `availability-cards-1440.png` | Ảnh chụp mới Vòng 3 — Availability Desktop (1440px) | 92,885 B | `CD7F8557089B7A20F09AF6FB2C6FD507A848BF3C1ABB37B52ACEB0CA67BB350A` |
| `selected-room-1440.png` | Tham chiếu tái sử dụng Vòng 2 — Downstream Desktop (1440px) | 137,801 B | `914524CD6BBBAB2143D8B14CDB2F42C6330326E112B9EFC430E35ADE9AAD9520` |
| `selected-room-768.png` | Ảnh chụp mới Vòng 3 — Downstream Tablet (768px) | 111,538 B | `6517E2CAF3C1E04879BD6AB2D42D26C737A9BF863B1ED3AB68DDF20179A1F0DD` |
| `selected-room-375.png` | Tham chiếu tái sử dụng Vòng 2 — Downstream Mobile (375px) | 61,830 B | `90AD70047D722CF393089B284F6DF5638A5963F7D7B77974384E9D7377C47EB5` |
| `mobile-form-clearance-375.png` | Ảnh chụp mới Vòng 3 — Form Clearance Mobile (375px) | 56,130 B | `92F6A079DF98B48E39211EB7DA61459347A67C887557DB6BC0AEC8F433C7E922` |
| `combobox-keyboard-active.png` | Ảnh chụp mới Vòng 3 — Keyboard Trace Desktop (1440px) | 171,550 B | `C0FCA3823E8942F3F97EF5C22AE2658DDF062E1E9E700A75D28ED727634F4EE4` |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/capture-log.json) | Báo cáo chi tiết thao tác, tọa độ & phân loại | 5,991 B | `23F820B2F7DF2663ED678DA77A1F8FE6378903C5B7BC99947DEE32FD58364E16` |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/source-manifest.json) | Metadata mã nguồn, test file & lazy chunk | 1,399 B | `BFD4FBB371E1D6102F015646D0848F7DA9FA4D0495CB127AC95F032EBC740B94` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/manifest.json) | Metadata tổng hợp Vòng 4 | 11,499 B | `67C82FC5362C4D2BE70701EF38BCA309038EA0ECE395DED24AB3E21C4A5211AB` |

---

## 4. Giới Hạn Kỹ Thuật & Cam Kết Toàn Vẹn (Honest Technical Limitations)

1. **Môi Trường Synthetic Loopback Fixtures (No-DB):** Toàn bộ dữ liệu hiển thị trong quá trình kiểm thử và chụp ảnh bằng chứng được phục vụ bởi máy chủ loopback in-memory `fixture-server.cjs` trên cổng `4282`. Tuyệt đối không kết nối bất kỳ cơ sở dữ liệu thật nào.
2. **Không Thay Đổi Hợp Đồng API & Backend:** Không có bất kỳ thay đổi nào đối với mã nguồn backend .NET, schema cơ sở dữ liệu, API controller hay DTO serialization.
3. **Bảo Toàn Quyền Sở Hữu Module Đồng Đội:** Không sửa đổi hay tác động tới các module quản trị của đồng đội (Rooms/RoomTypes của Nguyên, Housekeeping của Tân).
4. **Giới Hạn Tuyên Bố Trợ Năng (A11y/WCAG Claims):** Đo lường touch targets ($\ge 44\text{px}$), ARIA attributes và kiểm tra bàn phím xác nhận sự tuân thủ các quy chuẩn giao diện cụ thể; không tuyên bố tuân thủ toàn diện mọi phần mềm đọc màn hình chuyên dụng.
5. **Duy Trì Toàn Vẹn Quyết Định Nghiệp Vụ (PO Gates):** Toàn bộ 5 PO Gates và 2 Business Gates được giữ nguyên trạng thái `NeedsPO` trong `decisions.md`.
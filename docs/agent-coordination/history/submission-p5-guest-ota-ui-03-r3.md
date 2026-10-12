# Submission P5-GUEST-OTA-UI-03 — Round 3

- **TaskId:** `P5-GUEST-OTA-UI-03`
- **Round:** 3
- **SubmissionId:** `sub-p5-guest-ota-ui-03-r3-20261011`
- **ReviewedSubmissionId:** `sub-p5-guest-ota-ui-03-r2-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T21:52:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 4` Approved, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Khắc phục triệt để 3 nhóm phát hiện từ đợt đánh giá vòng 2 (`history/review-p5-guest-ota-ui-03-r2.md`), bảo toàn toàn bộ bố cục, header và copy đã được chấp thuận:
  - **100% bảo toàn hợp đồng dữ liệu hiện hữu:** Chỉ sử dụng các trường `Name`, `Address`, `City`, `ImageUrl`, `availableRooms`, `isAvailable`, `estimatedPrice` từ DTO thực tế.
  - **Nhãn minh họa kiến trúc ngoài SVG & Copy giá trung tính:** Đưa nhãn cảnh báo ra ngoài SVG dưới dạng overlay viền nổi không bị crop bởi `preserveAspectRatio="xMidYMid slice"`, thay thế cụm từ "giá ưu đãi" bằng "mức giá ước tính theo ngày lưu trú".
  - **Cung cấp đủ bằng chứng downstream state & đo lường thực tế:** Bổ sung ảnh thẻ phòng trống (`availability-cards-1440.png`), khoảng đệm form khách hàng di động (`mobile-form-clearance-375.png`), tiêu đề bước 3 không bị che bởi sticky header (`selected-room-768.png`), và trace phím combobox (`combobox-keyboard-active.png`).
  - **Nguồn gốc mã nguồn & Mã băm lazy chunk:** Cung cấp `source-manifest.json` ghi nhận mã băm nguồn `booking.page.ts` và lazy chunk `chunk-BBKId7t-.js`, công bố trung thực giới hạn không lưu baseline lịch sử trước vòng 1 của file untracked, và cung cấp `capture-log.json` với tọa độ đo đạc thực tế.
  - **0 backend/schema/API changes, 0 kết nối DB thật, không sửa đổi module của đồng đội (Nguyên/Tân). Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.**

---

## 1. Chi Tiết Khắc Phục Các Điểm Đánh Giá Từ Vòng 2 (Review Findings Resolution)

### 1.1. Finding 1 (P2 — Visible Illustration Disclosure Outside Cropped SVG & Neutral Price Copy)
- **Vấn đề vòng 2:** Nhãn định danh hình minh họa trước đây nằm bên trong thẻ SVG ở tọa độ $y=214$, nhưng do SVG sử dụng `preserveAspectRatio="xMidYMid slice"` với chiều cao cố định $h=48$ ($192\text{px}$) trên các thẻ desktop rộng (500-600px), nhãn bị crop hoàn toàn khỏi khung nhìn và không hiển thị. Đồng thời phụ đề bước 1 vẫn còn cụm từ *"mức giá ưu đãi"* dù không có dữ liệu giảm giá.
- **Giải pháp xử lý:**
  1. **Đưa nhãn minh họa ra ngoài SVG dưới dạng badge overlay tương phản cao:**
     - Tại thẻ cơ sở lưu trú: Bổ sung container badge overlay ở góc dưới phải:
       ```html
       <div *ngIf="!prop.imageUrl" class="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-slate-700/80 shadow-xs pointer-events-none">
         Hình minh họa — chưa có ảnh cơ sở
       </div>
       ```
       Đo đạc CDP: `top: 735.7px, left: 501.5px, width: 186.1px, height: 24.6px`, hiển thị rõ ràng $100\%$ không bị crop.
     - Tại thẻ hạng phòng: Bổ sung container badge overlay tương tự:
       ```html
       <div *ngIf="!rt.imageUrl" class="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-700/70 shadow-2xs pointer-events-none">
         Hình minh họa — bố trí phòng mẫu
       </div>
       ```
  2. **Chỉnh sửa copy trung tính:** Thay thế *"mức giá ưu đãi"* ở dòng 361 bằng *"mức giá ước tính theo ngày lưu trú"*, tuyệt đối trung thực với dữ liệu hiển thị.

### 1.2. Finding 2 (P2 — Complete Downstream States, Sticky Header Clearance & Observable Actions)
- **Bổ sung ảnh thẻ phòng khả dụng (`availability-cards-1440.png`):**
  - Chụp trực quan Bước 2 sau khi chọn cơ sở lưu trú: hiển thị trọn vẹn 2 thẻ phòng ("Deluxe Double Room" và "Executive Suite") với thông số giường, diện tích, sức chứa, giá ước tính và badge *"Hình minh họa — bố trí phòng mẫu"*.
- **Quan sát khoảng đệm form khách hàng di động (`mobile-form-clearance-375.png`):**
  - Tại viewport di động $375 \times 812$, cuộn tới Bước 3 tại vị trí `scrollY = 3730px`.
  - Đo đạc thực tế qua CDP cho thấy:
    - Đáy header cố định: `headerBottom = 89.3px`.
    - Đầu trường họ tên: `nameInputTop = 106.2px` $\rightarrow$ Thấp hơn đáy header $16.9\text{px}$ (**PASS - không bị header che khuất**).
    - Đáy nút xác nhận giữ chỗ: `confirmHoldButtonBottom = 591.8px`.
    - Đỉnh thanh neo đáy: `stickyBarTop = 707.2px` $\rightarrow$ Nằm trên thanh neo đáy $115.4\text{px}$ (**PASS - không bị thanh neo che khuất**).
    - **Toàn bộ 4 trường thông tin** (`#guestNameInput`, `#guestEmailInput`, `#guestPhoneInput`, `#numberOfGuestsInput`) và nút `#confirmHoldButton` đều hiển thị đồng thời và trọn vẹn trong khung nhìn giữa 2 thanh cố định.
- **Khắc phục tiêu đề Bước 3 bị che khuất trên tablet (`selected-room-768.png`):**
  - Bổ sung `scroll-mt-24` ($96\text{px}$) cho `#propertyListSection`, `#roomTypesSection`, `#availabilitySection` và `#quoteSection`.
  - Khi cuộn tới Bước 3 trên tablet 768px:
    - Đáy header: `headerBottom = 89.3px`.
    - Huy hiệu bước: `badgeTop = 129.85px` $\rightarrow$ Cách đáy header $40.55\text{px}$ (**PASS**).
    - Tiêu đề H2: `headingTop = 161.05px` $\rightarrow$ Cách đáy header $71.75\text{px}$ (**PASS**).
    - Tiêu đề hoàn toàn không bị che khuất bởi header cố định.
- **Trace phím điều hướng Combobox (`combobox-keyboard-active.png`):**
  - Thực hiện nhập từ khóa "Sài Gòn", nhấn phím `ArrowDown` qua CDP.
  - Quan sát: `aria-expanded = "true"`, `aria-activedescendant = "suggestion-0"`, mục gợi ý được highlight bằng class `bg-indigo-50 border-indigo-200`.
- **Minh bạch các hạng mục không kiểm thử trong phiên UI:** Ghi nhận rõ trong `capture-log.json`: `networkRetryInUi`, `screenReaderAudioOutput` và `fullCheckoutPaymentGateway` là NOT TESTED trong phiên chụp ảnh UI (dựa trên bộ test tự động riêng).

### 1.3. Finding 3 (P2 — Source Baseline/Provenance, Lazy Chunk Hashes & Capture Log)
- **Công bố trung thực về Baseline lịch sử:**
  - File `booking.page.ts` bắt nguồn từ tệp làm việc untracked trong quá trình phát triển P5 trên nhánh `develop` (commit `3f95339b4f4477ac5d421551d372dfdd5ed31e30`). Do không được commit trước Vòng 1, nhóm thực hiện công bố trung thực giới hạn này thay vì tái tạo dữ liệu lịch sử giả định.
- **Lưu trữ metadata nguồn & Lazy Booking Chunk:**
  - Tạo tệp [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/source-manifest.json):
    - Mã nguồn `booking.page.ts`: 84,938 bytes, SHA256: `B8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74`.
    - Lazy chunk `chunk-BBKId7t-.js`: 74,188 bytes, SHA256: `51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD`.
- **Nhật ký thao tác & Tọa độ đo đạc (Provenance Log):**
  - Tạo tệp [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/capture-log.json) ghi nhận chi tiết từng hành động điều hướng, vị trí cuộn `scrollY`, kích thước bounding rectangle và trạng thái quan sát thực tế.

---

## 2. Kết Quả Kiểm Thử Kỹ Thuật

### 2.1. Kiểm Thử Đơn Vị (Vitest Unit Tests)
- **Lệnh thực thi:**
  ```bash
  npx vitest run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts
  ```
- **Kết quả:** **57 passed / 57 tests (100% pass)** trong 2.04s:
  - `public-booking.page.spec.ts`: **41 passed / 41 tests** (Toàn bộ kiểm tra ARIA, zero emoji, các ID bắt buộc `#heroSearchCard`, `#heroSearchButton`, `#propertyListSection`, `#quoteSection`, `#stickySummaryBar`, `#stickyBottomCtaButton`, `#confirmHoldButton`).
  - `public-booking.service.spec.ts`: **16 passed / 16 tests**.

### 2.2. Kiểm Thử Biên Dịch (Production Build & Warning Report)
- **Lệnh thực thi:**
  ```bash
  npm run build
  ```
- **Kết quả:** Biên dịch thành công với exit code **0**.
- **Kích thước bundle:** Lazy chunk `booking-page` (`chunk-BBKId7t-.js`) đạt **72.45 kB** (transfer gzip xấp xỉ **14.47 kB**).
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
- `chunk-BBKId7t-.js` (booking-page lazy chunk): `51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD`

### 3.2. Ảnh Chụp Bằng Chứng & Tệp Metadata
Lưu trữ đầy đủ tại `docs/agent-coordination/evidence/guest-ota-ui-03/`:

| Tệp bằng chứng | Giai đoạn & Viewport | Kích thước | SHA256 Hash |
|---|---|---|---|
| `before-1440.png` | Before — Desktop (1440px) | 431,677 B | `92F028DA1476B41D90FF6480EFCF5231E19B10C6136E7BA7581B550CB1DFEB85` |
| `before-768.png` | Before — Tablet (768px) | 363,961 B | `A8C99AD18071CACCD7727FDF867887E58B899808821D1C834B005281379EC16B` |
| `before-375.png` | Before — Mobile (375px) | 185,086 B | `914ED11376180AD2F0CBFACEC69FD172599B15B438863E9CBF2682C5F7B29EDA` |
| `after-1440.png` | Round 3 Initial — Desktop (1440px) | 212,312 B | `98DDD6D4836E52067380C4127863BAF35727B49949FBE698742E5B316466616F` |
| `after-768.png` | Round 3 Initial — Tablet (768px) | 181,318 B | `26739773612EDBA3E27F0EDDA19E77F1B1CACA7658097832D9ABDA3155408337` |
| `after-375.png` | Round 3 Initial — Mobile (375px) | 58,128 B | `956BB044F361928BE4A038DF692E1878F09DBE37D5F03FE4501E839D21674ADC` |
| `availability-cards-1440.png` | Round 3 Availability — Desktop (1440px) | 92,885 B | `CD7F8557089B7A20F09AF6FB2C6FD507A848BF3C1ABB37B52ACEB0CA67BB350A` |
| `selected-room-1440.png` | Downstream — Desktop (1440px) | 137,801 B | `914524CD6BBBAB2143D8B14CDB2F42C6330326E112B9EFC430E35ADE9AAD9520` |
| `selected-room-768.png` | Round 3 Downstream — Tablet (768px) | 111,538 B | `6517E2CAF3C1E04879BD6AB2D42D26C737A9BF863B1ED3AB68DDF20179A1F0DD` |
| `selected-room-375.png` | Downstream — Mobile (375px) | 61,830 B | `90AD70047D722CF393089B284F6DF5638A5963F7D7B77974384E9D7377C47EB5` |
| `mobile-form-clearance-375.png` | Round 3 Form Clearance — Mobile (375px) | 56,130 B | `92F6A079DF98B48E39211EB7DA61459347A67C887557DB6BC0AEC8F433C7E922` |
| `combobox-keyboard-active.png` | Round 3 Keyboard Trace — Desktop (1440px) | 171,550 B | `C0FCA3823E8942F3F97EF5C22AE2658DDF062E1E9E700A75D28ED727634F4EE4` |
| [`capture-log.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/capture-log.json) | Báo cáo chi tiết thao tác & tọa độ | 4,577 B | `714FBC99F02A6611ECECE4C41AA26D39B6C35B3E116C51531E2BBD76214B7BAF` |
| [`source-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/source-manifest.json) | Metadata mã nguồn & lazy chunk | 1,399 B | `FD1CD6427A58EB877240B84A1632C4401138B6B0CEEF1ADC862DE1CDE91DB0D7` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/manifest.json) | Metadata tổng hợp Vòng 3 | 6,397 B | Khớp 100% các tệp, kích thước, viewport, clearance metrics và SHA256 hashes |

---

## 4. Giới Hạn Kỹ Thuật & Cam Kết Toàn Vẹn (Honest Technical Limitations)

1. **Môi Trường Synthetic Loopback Fixtures (No-DB):** Toàn bộ dữ liệu hiển thị trong quá trình kiểm thử và chụp ảnh bằng chứng được phục vụ bởi máy chủ loopback in-memory `fixture-server.cjs` trên cổng `4282`. Tuyệt đối không kết nối bất kỳ cơ sở dữ liệu thật nào.
2. **Không Thay Đổi Hợp Đồng API & Backend:** Không có bất kỳ thay đổi nào đối với mã nguồn backend .NET, schema cơ sở dữ liệu, API controller hay DTO serialization.
3. **Bảo Toàn Quyền Sở Hữu Module Đồng Đội:** Không sửa đổi hay tác động tới các module quản trị của đồng đội (Rooms/RoomTypes của Nguyên, Housekeeping của Tân).
4. **Giới Hạn Tuyên Bố Trợ Năng (A11y/WCAG Claims):** Đo lường touch targets ($\ge 44\text{px}$), ARIA attributes và kiểm tra bàn phím xác nhận sự tuân thủ các quy chuẩn giao diện cụ thể; không tuyên bố tuân thủ toàn diện mọi phần mềm đọc màn hình chuyên dụng.
5. **Duy Trì Toàn Vẹn Quyết Định Nghiệp Vụ (PO Gates):** Toàn bộ 5 PO Gates và 2 Business Gates được giữ nguyên trạng thái `NeedsPO` trong `decisions.md`.
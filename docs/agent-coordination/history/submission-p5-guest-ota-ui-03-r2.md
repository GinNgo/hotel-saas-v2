# Submission P5-GUEST-OTA-UI-03 — Round 2

- **TaskId:** `P5-GUEST-OTA-UI-03`
- **Round:** 2
- **SubmissionId:** `sub-p5-guest-ota-ui-03-r2-20261011`
- **ReviewedSubmissionId:** `sub-p5-guest-ota-ui-03-r1-20261011`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-11T21:36:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Dependency:** `P5 guest implementation` Approved, `P7 guest verify round 4` Approved, `P7 fuzzy contract verify round 2` Approved.
- **Scope:** Giải quyết triệt để 4 nhóm phát hiện (P1 + 3x P2) từ kết quả đánh giá vòng 1 (`history/review-p5-guest-ota-ui-03-r1.md`), hoàn thiện giao diện đặt phòng công khai cho khách (Guest Booking Presentation) theo chuẩn OTA quốc tế chuyên nghiệp (Booking.com, Agoda, Traveloka) nhưng đảm bảo tính trung thực thông tin, không sao chép nhãn hiệu thương mại, đo lường chính xác không tràn ngang (zero overflow) trên mobile 375px, và cung cấp bằng chứng downstream states toàn diện.
  - **100% bảo toàn hợp đồng dữ liệu hiện hữu:** Chỉ sử dụng các trường `Name`, `Address`, `City`, `ImageUrl`, `availableRooms`, `isAvailable`, `estimatedPrice` từ DTO thực tế.
  - **Tuyệt đối trung thực dữ liệu & thông điệp:** Không bịa đặt hotline, chính sách bồi thường giá, cam kết tức thì, chuẩn bảo mật PCI-DSS, đánh giá hay tiện ích chưa được hỗ trợ.
  - **Tuyệt đối loại bỏ Emoji:** Toàn bộ template không sử dụng bất kỳ emoji nào (kiểm soát tự động bằng regex trong unit test suite).
  - **0 backend/schema/API changes, 0 kết nối DB thật, không sửa đổi module của đồng đội (Nguyên/Tân). Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên `NeedsPO`.**

---

## 1. Chi Tiết Khắc Phục Các Điểm Đánh Giá Từ Vòng 1 (Review Findings Resolution)

### 1.1. Finding 1 (P1 — Truthful Copy, Neutral Branding & Transparent Illustrations)
- **Loại bỏ hoàn toàn các khẳng định chưa được xác thực:**
  - Xóa bỏ khẩu hiệu *"Đảm bảo giá gốc từ khách sạn"* trên thanh micro-banner. Thay thế bằng thông điệp trung thực và chuyên nghiệp: *"Hệ thống đặt phòng trực tiếp • Thông tin xác thực từ cơ sở lưu trú"*.
  - Xóa bỏ hotline không có thực *"Hỗ trợ 24/7 qua 1900 6868"*, cam kết *"Xác nhận tức thì"*, và tuyên bố tuân thủ *"Tiêu chuẩn bảo mật PCI-DSS"*.
  - Thay thế mô tả fallback bịa đặt *"nội thất cao cấp"* (khi `description` của phòng là null) bằng mô tả trung tính, chính xác theo thông số hệ thống.
- **Làm sạch hình minh họa vector SVG & ghi chú minh bạch:**
  - Loại bỏ các chữ `STAYVISTA`, `BOUTIQUE`, `LUXURY`, `PREMIUM` khỏi vector art.
  - Bổ sung nhãn định danh rõ ràng, minh bạch ngay trên hình vẽ fallback:
    - Tại thẻ cơ sở lưu trú: **"HÌNH MINH HỌA KIẾN TRÚC"** (Architectural Twilight Illustration).
    - Tại thẻ hạng phòng: **"HÌNH MINH HỌA HẠNG PHÒNG"** (Room Type Layout Illustration).
  - Đảm bảo người dùng hiểu rõ đây là hình vẽ kiến trúc minh họa vị trí khi cơ sở lưu trú chưa tải ảnh chụp thực tế.

### 1.2. Finding 2 (P2 — Mobile 375px Overflow & Header Constraints)
- **Khắc phục triệt để tràn ngang trên mobile (375px):**
  - **Nguyên nhân vòng 1:** Thanh micro-banner và header navigation chứa hai nút văn bản đầy đủ kèm biểu tượng đặt cạnh nhau (`px-3.5 py-2`), khiến độ rộng nội dung header vượt quá 375px (đẩy `docWidth` lên 381px) và gây hiện tượng chữ xếp chồng dọc ("Tra cứu", "đặt phòng").
  - **Giải pháp:** Tối ưu hóa thanh header di động bằng cách rút gọn nhãn text thành các nút biểu tượng tinh gọn (icon-only button) có thuộc tính trợ năng `aria-label="Tra cứu đặt phòng"` đạt chuẩn touch target $\ge 44\text{px}$.
  - Điều chỉnh lưới ngày lưu trú trong `#heroSearchCard` sang dạng cột đơn trên màn hình cực hẹp (`grid-cols-1 sm:grid-cols-2`), bảo toàn đầy đủ các điều khiển và nhãn ngày.
- **Đo lường thực tế trên Chrome DevTools (CDP) tại 375px:**
  - `window.innerWidth`: **375px**
  - `document.documentElement.clientWidth`: **375px**
  - `document.documentElement.scrollWidth`: **375px**
  - `document.body.scrollWidth`: **375px**
  - `isOverflow`: **false** (Tỷ lệ tràn: **0%**, số phần tử vượt ngưỡng: **0**).
- **Khoảng cách đệm an toàn với thanh neo đáy (Clearance Metrics):**
  - Lớp đệm đáy container chính: `pb-36 sm:pb-28` $\rightarrow$ đo thực tế `144px`.
  - Chiều cao thanh neo đáy (`#stickySummaryBar`): `104.8px`.
  - Khoảng đệm thở khả dụng thực tế: **39.2px**.
  - Toàn bộ các trường biểu mẫu nhập thông tin khách hàng (`#guestNameInput`, `#guestEmailInput`, `#guestPhoneInput`, `#numberOfGuestsInput`) và nút giữ chỗ đều cuộn hiển thị trọn vẹn, không bị che khuất hay đè lấp bởi thanh neo đáy ở cả trạng thái ban đầu và trạng thái downstream.

### 1.3. Finding 3 (P2 — Hospitality Editorial Layout & Symmetrical Grids)
- **Tiết chế khu vực Hero:**
  - Thay thế gradient màu tối đa tầng bằng thẻ hero tối giản, sang trọng (`bg-slate-900`) với tiêu đề editorial súc tích, tinh tế.
  - Loại bỏ các huy hiệu trang trí rườm rà không cần thiết.
- **Lưới thẻ cơ sở đối xứng (Symmetrical 2-Column Grid):**
  - Thay đổi lưới hiển thị thẻ cơ sở từ 3 cột (`grid-cols-3`) sang 2 cột đối xứng (`grid-cols-1 md:grid-cols-2`). Khi backend trả về 2 khách sạn mẫu, giao diện hiển thị cân xứng hoàn hảo, xóa bỏ hoàn toàn khoảng trống ở vị trí cột thứ 3.
  - Loại bỏ mã nội bộ (`Mã: {{ prop.code }}`) và thông số đệm dọn phòng chuyên môn kỹ thuật (`Dọn dẹp: {{ prop.bufferMinutes }} phút`).
- **Lưới thẻ hạng phòng đối xứng & Trạng thái chờ tinh tế:**
  - Chuyển đổi lưới hạng phòng sang 2 cột đối xứng (`grid-cols-1 md:grid-cols-2`).
  - Khi chưa chọn cơ sở lưu trú (`!selectedProperty()`), thay thế khung trống lớn bằng thông báo viền nét đứt tinh gọn (`border-dashed border-slate-300 bg-slate-50/60 rounded-2xl p-6`).
  - Làm sạch thuật ngữ DTO thô trong bước chiết tính giá và giữ chỗ: loại bỏ `(depositRequired)`, thay bằng văn phong tiếng Việt tự nhiên và chuẩn mực.

### 1.4. Finding 4 (P2 — Downstream State Evidence & Honest Reporting)
- Chụp ảnh bằng chứng đầy đủ cho cả hai trạng thái:
  - **Trạng thái khởi tạo (Initial state):** Desktop 1440px, Tablet 768px, Mobile 375px.
  - **Trạng thái downstream (Selected Property, Room Availability, Quote Breakdown, Sticky CTA Bar):** Desktop 1440px, Tablet 768px, Mobile 375px.
- Ghi nhận trung thực kết quả biên dịch và mã băm thực tế được phân phối từ máy chủ kiểm thử.

---

## 2. Kết Quả Kiểm Thử Kỹ Thuật & Đo Lường Thực Tế

### 2.1. Kiểm Thử Đơn Vị (Vitest Unit Tests)
- **Lệnh thực thi:**
  ```bash
  npx vitest run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts
  ```
- **Kết quả:** **57 passed / 57 tests (100% pass)** trong 1.97s:
  - `public-booking.page.spec.ts`: **41 passed / 41 tests** (Kiểm tra toàn bộ ARIA semantics, role, aria-pressed, không tồn tại emoji, các ID bắt buộc `#heroSearchCard`, `#heroSearchButton`, `#propertyListSection`, `#quoteSection`, `#stickySummaryBar`, `#stickyBottomCtaButton`).
  - `public-booking.service.spec.ts`: **16 passed / 16 tests** (Bao phủ API service, chuyển đổi DTO, tính toán báo giá, xử lý lỗi).

### 2.2. Kiểm Thử Biên Dịch (Production Build & Warning Report)
- **Lệnh thực thi:**
  ```bash
  npm run build
  ```
- **Kết quả:** Biên dịch thành công với exit code **0**.
- **Kích thước bundle:** Lazy chunk `booking-page` tối ưu đạt **71.20 kB** (dung lượng truyền tải gzip xấp xỉ **14.28 kB**).
- **Báo cáo cảnh báo trung thực (Honest Warning Disclosure):**
  - Quá trình biên dịch phát sinh 0 lỗi (0 Errors).
  - Có 1 cảnh báo tiền khả dụng từ thư viện bên ngoài đã có sẵn trong dự án:
    ```
    ▲ [WARNING] Module 'sweetalert2' used by 'src/app/core/services/alert.service.ts' is not ESM
      CommonJS or AMD dependencies can cause optimization bailouts.
    ```
  - Khẳng định trung thực: Quá trình build đạt exit code 0 nhưng **không tự nhận "0 warnings"**, nguyên nhân do module `sweetalert2` là CommonJS dependency toàn cục của dự án. Mã nguồn của `booking.page.ts` hoàn toàn sạch, không tạo thêm bất kỳ cảnh báo nào.

### 2.3. Đo Lường Tràn Ngang & Tương Thích Viewport (Chrome DevTools CDP Audit)
Thực hiện tự động qua Chrome DevTools MCP trên máy chủ Loopback `http://127.0.0.1:4282/booking`:

| Viewport | Kích thước màn hình | Chiều rộng viewport (`winWidth`) | Chiều rộng tài liệu (`docScrollWidth`) | Phần tử tràn (`overflowCount`) | Đánh giá |
|---|---|---|---|---|---|
| **Desktop** | $1440 \times 900$ | $1440\text{px}$ | $1425\text{px}$ | 0 | **PASS (Không tràn)** |
| **Tablet** | $768 \times 1024$ | $768\text{px}$ | $753\text{px}$ | 0 | **PASS (Không tràn)** |
| **Mobile** | $375 \times 812$ | $375\text{px}$ | $375\text{px}$ | 0 | **PASS (Khớp 100%, không tràn)** |

### 2.4. Đo Lường Kích Thước Vùng Chạm (Touch Targets — WCAG 2.5.5 Level AAA)
Tất cả các điều khiển tương tác trên giao diện đều đạt và vượt ngưỡng khuyến nghị $44\times 44\text{px}$:

| Phần tử điều khiển | Kích thước đo đạc thực tế | Chuẩn WCAG 2.5.5 ($\ge 44\text{px}$) | Trạng thái |
|---|---|---|---|
| Nút xóa từ khóa tìm kiếm (`Clear ×`) | $44 \times 44\text{px}$ | Đạt chuẩn Level AAA | **PASS** |
| Nút giảm số lượng khách (`-`) | $44 \times 44\text{px}$ | Đạt chuẩn Level AAA | **PASS** |
| Nút tăng số lượng khách (`+`) | $44 \times 44\text{px}$ | Đạt chuẩn Level AAA | **PASS** |
| Nút tìm kiếm Hero (`#heroSearchButton`) | $171 \times 92\text{px}$ | Đạt chuẩn Level AAA | **PASS** |
| Nút chuyển hình thức thuê ("Theo đêm") | $112 \times 44\text{px}$ | Đạt chuẩn Level AAA | **PASS** |
| Nút CTA neo đáy (`#stickyBottomCtaButton`) | $255 \times 44\text{px}$ | Đạt chuẩn Level AAA | **PASS** |

---

## 3. Danh Mục Bằng Chứng & Mã Băm Thực Tế (Evidence Manifest)

### 3.1. Mã Băm Bundle Được Phân Phối (Served Build Hashes)
Máy chủ kiểm thử loopback `fixture-server.cjs` xác nhận phân phối các bản dựng với mã băm SHA256:
- `index.html`: `D4381F9C7F5D53F7CE25A4E74E49ADA24042C0B6F8489B40CA4C9EA1DE376911`
- `main-LLWI4DXA.js`: `C70447D9314D79D4A9D081BBA0E53A39B67A3DDEE3877DC06CE33AA59EAAF610`
- `polyfills-LVNOU2XZ.js`: `F1B35A3B4DB37B73CA0281D6B6247701465FF9E56A7A7B3AFF9784518DC2C30A`
- `styles-H6FLE3QK.css`: `E6EFE47811527492AF34A0946F76930311233F4BA32BAC595F4EC234E4C6315B`

### 3.2. Ảnh Chụp Bằng Chứng Trực Quan (Visual Evidence Screenshots)
Lưu trữ đầy đủ tại `docs/agent-coordination/evidence/guest-ota-ui-03/`:

| Tệp bằng chứng | Giai đoạn & Viewport | Kích thước (bytes) | SHA256 Hash |
|---|---|---|---|
| `before-1440.png` | Before — Desktop (1440px) | 431,677 | `92F028DA1476B41D90FF6480EFCF5231E19B10C6136E7BA7581B550CB1DFEB85` |
| `before-768.png` | Before — Tablet (768px) | 363,961 | `A8C99AD18071CACCD7727FDF867887E58B899808821D1C834B005281379EC16B` |
| `before-375.png` | Before — Mobile (375px) | 185,086 | `914ED11376180AD2F0CBFACEC69FD172599B15B438863E9CBF2682C5F7B29EDA` |
| `after-1440.png` | Round 2 Initial — Desktop (1440px) | 211,202 | `4C966CF7D019ECA83795685A50714FCEE81867787E48D2B0D62BBDFC98CAF467` |
| `after-768.png` | Round 2 Initial — Tablet (768px) | 181,318 | `26739773612EDBA3E27F0EDDA19E77F1B1CACA7658097832D9ABDA3155408337` |
| `after-375.png` | Round 2 Initial — Mobile (375px) | 58,128 | `956BB044F361928BE4A038DF692E1878F09DBE37D5F03FE4501E839D21674ADC` |
| `selected-room-1440.png` | Round 2 Downstream — Desktop (1440px) | 137,801 | `914524CD6BBBAB2143D8B14CDB2F42C6330326E112B9EFC430E35ADE9AAD9520` |
| `selected-room-768.png` | Round 2 Downstream — Tablet (768px) | 111,745 | `0EB1D735DCBFAF631B8F18F812A7127EA7B1C74071922D44F79EC4DBE2F50B2E` |
| `selected-room-375.png` | Round 2 Downstream — Mobile (375px) | 61,830 | `90AD70047D722CF393089B284F6DF5638A5963F7D7B77974384E9D7377C47EB5` |
| [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ota-ui-03/manifest.json) | Metadata tổng hợp Vòng 2 | 5,618 | Khớp 100% các tệp, kích thước, viewport, clearance metrics và SHA256 hashes |

---

## 4. Giới Hạn Kỹ Thuật & Cam Kết Toàn Vẹn (Honest Technical Limitations)

1. **Môi Trường Synthetic Loopback Fixtures (No-DB):** Toàn bộ dữ liệu hiển thị trong quá trình kiểm thử và chụp ảnh bằng chứng được phục vụ bởi máy chủ loopback in-memory `fixture-server.cjs` trên cổng `4282`. Tuyệt đối không kết nối bất kỳ cơ sở dữ liệu thật nào (dev, test, staging hay PostgreSQL ambient).
2. **Không Thay Đổi Hợp Đồng API & Backend:** Không có bất kỳ thay đổi nào đối với mã nguồn backend .NET, schema cơ sở dữ liệu, API controller hay DTO serialization.
3. **Bảo Toàn Quyền Sở Hữu Module Đồng Đội:** Không sửa đổi hay tác động tới các module quản trị của đồng đội (Rooms/RoomTypes của Nguyên, Housekeeping của Tân).
4. **Giới Hạn Tuyên Bố Trợ Năng (A11y/WCAG Claims):** Việc đo lường touch targets ($\ge 44\text{px}$), ARIA attributes và kiểm tra bàn phím xác nhận sự tuân thủ các quy chuẩn giao diện cụ thể; không tuyên bố tuân thủ toàn diện WCAG hay tương thích 100% mọi phần mềm đọc màn hình chuyên dụng.
5. **Duy Trì Toàn Vẹn Quyết Định Nghiệp Vụ (PO Gates):** Toàn bộ 5 PO Gates và 2 Business Gates được giữ nguyên trạng thái `NeedsPO` trong `decisions.md`.
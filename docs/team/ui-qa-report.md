# BÁO CÁO NGHIỆM THU UI QA: RESPONSIVE, DESIGN TOKENS, ICONS VÀ ASSETS

**Mã ticket:** UI-QA-01 (Ticket 9: Mandatory UI QA)  
**Thời gian thực hiện:** 2026-10-09  
**Môi trường kiểm thử:** Chrome 126+ (Chrome DevTools Protocol Emulation), Windows 11  
**Ứng dụng:** Frontend Angular v19 (`http://localhost:4200`), Backend .NET 10 WebApi (`http://localhost:5283`), PostgreSQL 17  

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ

| Hạng mục kiểm tra | Tiêu chuẩn | Kết quả | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Responsive Viewports** | 360, 390, 768, 1024, 1440px | Không có horizontal overflow toàn trang; bảng scroll riêng | **PASS** |
| **Design Tokens & Spacing** | Nhất quán bảng màu, typography, padding/gap | Tailwind Slate/Emerald tokens, không dùng giá trị tùy tiện | **PASS** |
| **Navigation & Z-Index** | Sidebar, topbar, modal, pagination trên mobile | Không bị đè lớp hay cắt xén; context switcher co giãn an toàn | **PASS** |
| **Modal Usability** | Max height 90vh, scrollable 75vh, pinned footer | Vừa vặn viewport mobile; nút hành động luôn thao tác được | **PASS** |
| **Accessibility (Form & Nav)** | Keyboard nav, explicit IDs/labels, aria-labels | Form inputs có `<label for>`, icon buttons có aria-label *(xem giới hạn)* | **PASS (Theo phạm vi)** |
| **Zoom 200% (Reflow)** | WCAG 1.4.10 Reflow (tương đương 720px viewport) | Bố cục co giãn mượt mà, zero horizontal page scroll | **PASS** |
| **Icons Integrity** | PrimeIcons chính quy, đúng glyph, không lỗi font | 0 icon lỗi, kích thước chuẩn, không dùng emoji cho nghiệp vụ | **PASS** |
| **Images & Assets** | 0 lỗi 404, không broken links, không mixed content | 0 broken assets trong Console & Network tab | **PASS** |

---

## 2. MA TRẬN KIỂM TRA RESPONSIVE VIEWPORT

Kiểm tra bằng công cụ tự động CDP `evaluate_script` đo lường `document.documentElement.scrollWidth` so với `window.innerWidth`:

| Viewport (px) | Thiết bị mẫu | Inner Width | Scroll Width | Body Scroll Width | Overflow toàn trang | Ghi chú xử lý bảng dữ liệu |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **360** | Small Android (Galaxy S8) | 360px | 360px | 360px | **FALSE (0px)** | Bảng rộng 759px cuộn mượt mà trong thẻ `div.overflow-x-auto` (326px) |
| **390** | Mobile Standard (iPhone 12/13/14) | 390px | 390px | 390px | **FALSE (0px)** | Topbar truncate tên chi nhánh `max-w-[140px]`; pagination xuống dòng flex-wrap |
| **768** | Tablet Portrait (iPad Mini) | 768px | 768px | 768px | **FALSE (0px)** | Header mở rộng hiển thị tên đầy đủ; bộ lọc hiển thị 2 cột cân đối |
| **1024** | Tablet Landscape / Small Laptop | 1024px | 1024px | 1024px | **FALSE (0px)** | Sidebar cố định 260px; bảng dữ liệu hiển thị rộng rãi, không cần scroll |
| **1440** | Desktop HD Monitor | 1440px | 1440px | 1440px | **FALSE (0px)** | Căn lề chuẩn tỷ lệ 16:9, typography thoáng đãng, shadow mượt mà |

---

## 3. CÁC LỖI ĐÃ PHÁT HIỆN VÀ KHẮC PHỤC

### 3.1. Sửa lỗi Horizontal Overflow 35px tại Viewport 360px (Topbar Header)
- **Hiện tượng:** Tại màn hình `360px`, tên chi nhánh dài (VD: `Grand Hotel Sài Gòn (Quận 1)`) làm nút Context Switcher phình to, đẩy thanh topbar vượt quá chiều rộng màn hình 35px.
- **Nguyên nhân:** Thiếu ràng buộc `max-width` và `truncate` cho nút chuyển chi nhánh trên thiết bị di động cực nhỏ.
- **Khắc phục:** 
  - Cập nhật `frontend/src/app/layouts/admin-layout/admin-layout.ts`: Thêm `max-w-[140px] sm:max-w-[240px] lg:max-w-none truncate`.
  - Ẩn vạch ngăn cách trên mobile (`hidden sm:block`).
  - Thu nhỏ avatar từ `w-8 h-8` thành `w-7 h-7 sm:w-8 sm:h-8`.
  - Giảm padding container header từ `px-4 sm:px-6` thành `px-3 sm:px-4 lg:px-6`.

### 3.2. Sửa cảnh báo Form Field Accessibility (Chrome DevTools Warnings)
- **Hiện tượng:** Chrome DevTools phát hiện 9 input/select trong form không có thuộc tính `id` hoặc `name` tương ứng với `<label>`.
- **Khắc phục:**
  - Bổ sung cặp `id` và `name` tường minh trên tất cả các trường: `roomNumberInput`, `floorInput`, `roomTypeIdSelect`, `statusSelect`, `notesInput`, `searchRoomInput`, `filterStatusSelect`, `filterRoomTypeSelect`, `filterFloorSelect`, `pageSizeSelect`, `roomTypeCodeInput`, `roomTypeMaxOccupancyInput`, `roomTypeNameInput`, `roomTypeBasePriceInput`, `roomTypeBedTypeInput`, `roomTypeDescInput`.
  - Bổ sung thuộc tính `for="..."` trên toàn bộ các thẻ `<label>` tương ứng.

### 3.3. Chuẩn hóa Accessible Labels cho Icon-only Buttons
- **Hiện tượng:** Các nút chỉ có biểu tượng icon (như Sửa, Xóa, Làm mới danh sách, Đóng dialog, Điều hướng phân trang) thiếu văn bản đọc màn hình (`aria-label`).
- **Khắc phục:**
  - Nút Refresh: Thêm `aria-label="Làm mới danh sách"`.
  - Nút Edit: Thêm `[attr.aria-label]="'Chỉnh sửa thông tin phòng ' + room.roomNumber"`.
  - Nút Delete: Thêm `[attr.aria-label]="'Xóa phòng ' + room.roomNumber"`.
  - Nút Pagination: Thêm `aria-label="Trang đầu"`, `Trang trước`, `Trang sau`, `Trang cuối`, `Đến trang X`, và `aria-current="page"`.
  - Dialog Close Buttons: Bổ sung thuộc tính `closeAriaLabel="Đóng hộp thoại"` trên toàn bộ `<p-dialog>` (Rooms, Room Types, Context Selector).
  - Không sử dụng emoji làm icon thao tác nghiệp vụ; sử dụng 100% PrimeIcons (`pi pi-pencil`, `pi pi-trash`, `pi pi-refresh`, `pi pi-plus`, `pi pi-times`).

### 3.4. Giới hạn Chiều cao và Cuộn Dialog trên Mobile
- **Hiện tượng:** Khi mở bàn phím ảo hoặc trên màn hình chiều dọc ngắn, modal form có thể bị tràn ra khỏi màn hình khiến các nút hành động (Hủy, Lưu) bị khuất.
- **Khắc phục:**
  - Thêm cấu hình kích thước responsive: `[style]="{ width: '480px', maxWidth: '95vw', maxHeight: '90vh' }"`.
  - Cấu hình vùng nội dung tự cuộn: `[contentStyle]="{ maxHeight: '75vh', overflow: 'auto' }"`.
  - Ghim cố định thanh nút bấm chân trang: `sticky bottom-0 bg-white pt-3 border-t border-slate-100 flex items-center justify-end gap-2`.

### 3.5. Sửa lỗi Badge Mã Chi Nhánh Mobile bị Chèn Ép (`CN-PN`)
- **Hiện tượng:** Tại viewport 360px, badge mã chi nhánh bị cố định kích thước `w-6 h-6`, khiến các mã có 5 ký tự như `CN-PN` bị cắt cụt, gãy thành 2 hàng hoặc tràn viền chữ.
- **Khắc phục:**
  - Cập nhật `frontend/src/app/layouts/admin-layout/admin-layout.ts`:
  - Đổi từ `w-6 h-6 rounded` sang `min-w-[24px] px-1.5 h-6 sm:h-7 rounded-md whitespace-nowrap text-[10px] sm:text-xs font-bold`.
  - Badge tự động co giãn theo độ dài mã chi nhánh mà không phá vỡ bố cục header.

### 3.6. Bổ sung Accessible Labels cho Bộ Lọc Ngày (Date Picker Inputs)
- **Hiện tượng:** Các trường `<input type="date">` lọc ngày đơn và khoảng ngày chưa có thuộc tính `id`, `name`, `<label for>` tương ứng.
- **Khắc phục:**
  - Cập nhật `frontend/src/app/shared/components/date-range-filter/date-range-filter.component.html`:
  - Thêm `singleDateFilterInput`, `startDateFilterInput`, `endDateFilterInput` với `<label for="...">` và `aria-label` tương ứng.

### 3.7. Minh Bạch Hóa Phạm Vi Dữ Liệu Dashboard (Dashboard Data Scope Disclosure)
- **Hiện tượng:** Màn hình Dashboard lấy dữ liệu trạng thái buồng phòng từ trang 1 (tối đa 100 phòng) nhưng trước đó trình bày như thống kê toàn chi nhánh; đồng thời hiển thị tỷ lệ dọn phòng ảo `cleanRooms / totalRooms * 100%`.
- **Khắc phục:**
  - Thêm banner thông báo phạm vi dữ liệu rõ ràng: *"Phạm vi dữ liệu: Tổng số phòng tính toàn chi nhánh. Trạng thái buồng phòng tính trên mẫu X phòng hiển thị (chưa có API aggregate trạng thái toàn chi nhánh)."*
  - Phân định rõ: Thẻ "Tổng số phòng" phản ánh toàn chi nhánh; các thẻ "Phòng sạch", "Cần dọn", "Bảo trì" ghi rõ phạm vi theo mẫu hiển thị.
  - Loại bỏ hoàn toàn tỷ lệ phần trăm ảo; không tải toàn bộ database về client để tính gộp tạm thời.

### 3.8. Tích hợp PrimeNG p-datepicker và Chuẩn Hóa Múi Giờ Nghiệp Vụ (Asia/Ho_Chi_Minh)
- **Nâng cấp:** Thay thế hoàn toàn date inputs mặc định bằng PrimeNG `p-datepicker` (phiên bản `22.1.2`, không thêm thư viện ngoài).
- **Locale & Tuần:**
  - Cấu hình locale tiếng Việt (`vi`), tuần bắt đầu Thứ Hai (`firstDayOfWeek: 1`).
  - Tên thứ rút gọn: `T2, T3, T4, T5, T6, T7, CN`.
  - Tên tháng: `Tháng 1` đến `Tháng 12`.
  - Nút chân trang: `Hôm nay` và `Xóa`.
- **Định dạng hiển thị:**
  - Ngày đơn / khoảng ngày: `dd/mm/yyyy` (token PrimeNG `dateFormat="dd/mm/yy"`).
  - Datetime: `dd/mm/yyyy HH:mm`, định dạng 24 giờ (`hourFormat="24"`).
  - Timestamp từ backend: Hiển thị theo múi giờ nghiệp vụ `Asia/Ho_Chi_Minh` (UTC+7), không phụ thuộc timezone mặc định của browser.
- **Tương tác & UX/A11y:**
  - Cấu hình `appendTo="body"`: Khung popup lịch nổi hoàn toàn trên `<body>`, không bị cắt xén bởi container bảng hay thẻ cuộn.
  - Tự động kích hoạt `[touchUI]="isMobile()"` trên màn hình mobile (< 768px): Hiển thị modal lịch cảm ứng dạng dialog giữa màn hình kèm backdrop mờ.
  - Cặp `inputId` và `<label for="...">` liên kết tường minh, placeholder và `aria-label` đầy đủ.
  - Date-only trích xuất ngày lịch thuần (`YYYY-MM-DD`), không dùng `toISOString()` chuyển UTC tùy tiện.
  - Truy vấn timestamp quy đổi chính xác biên nửa mở `[startUtc, endExclusiveUtc)` theo múi giờ `Asia/Ho_Chi_Minh`.
  - Kiểm chứng biên ngày: `09/10/2026` tại Việt Nam tương ứng chính xác khoảng UTC `[2026-10-08T17:00:00.000Z, 2026-10-09T17:00:00.000Z)`.

---

## 4. TỔNG HỢP MINH CHỨNG THỰC TẾ (SCREENSHOTS EVIDENCE)

Tất cả các hình ảnh minh chứng được chụp trực tiếp từ trình duyệt Chrome thông qua Chrome DevTools Protocol, lưu trữ tại thư mục cục bộ `docs/team/assets/screenshots/` (tuyệt đối không sử dụng đường dẫn tuyệt đối máy cá nhân):

| Tên File Minh Chứng | Kích Thước | Mô Tả Nội Dung |
| :--- | :---: | :--- |
| `docs/team/assets/screenshots/qa-datepicker-popup.png` | 158 KB | Popup PrimeNG p-datepicker tiếng Việt, tuần bắt đầu Thứ Hai (T2), nút Hôm nay/Xóa, không bị cắt xén |
| `docs/team/assets/screenshots/qa-datepicker-mobile-touch.png` | 64 KB | Viewport 360px: DatePicker hiển thị giao diện touchUI dialog modal giữa màn hình tối ưu cho cảm ứng |
| `docs/team/assets/screenshots/qa-dashboard-scope.png` | 137 KB | Dashboard hiển thị banner minh bạch phạm vi dữ liệu mẫu và các thẻ thống kê phân định rõ |
| `docs/team/assets/screenshots/qa-branch-badge-mobile.png` | 148 KB | Viewport 360px: Badge chi nhánh `CN-PN` hiển thị trọn vẹn, không bị đứt chữ; bộ lọc ngày có nhãn accessible |
| `docs/team/assets/screenshots/qa-rooms-360px.png` | 141 KB | Giao diện Quản lý phòng tại Viewport 360px: 0px overflow, topbar co giãn gọn gàng |
| `docs/team/assets/screenshots/qa-modal-mobile.png` | 147 KB | Modal Thêm phòng mới trên Mobile: Vừa vặn viewport, các trường input và nút ghim rõ ràng |
| `docs/team/assets/screenshots/qa-room-types-desktop.png` | 96 KB | Màn hình Quản lý Loại phòng tại Desktop 1440px: Bảng dữ liệu, filter, 0 lỗi console |
| `docs/team/assets/screenshots/qa-dashboard-desktop.png` | 164 KB | Tổng quan Dashboard tại Desktop 1440px: Thống kê KPI, trạng thái phòng, context bar |
| `docs/team/assets/screenshots/branch-select-mobile.png` | 174 KB | Hộp thoại Chọn chi nhánh trên màn hình di động |
| `docs/team/assets/screenshots/catalog-delete-confirmation.png` | 160 KB | Hộp thoại xác nhận xóa phòng an toàn chống xóa nhầm |

---

## 5. TRẠNG THÁI CONSOLE & NETWORK LOGS

- **Lỗi JavaScript Console:** `0 errors` (Chỉ có log kết nối Vite HMR và thông báo license PrimeUI môi trường dev).
- **Lỗi Assets / Network:** `0 lỗi 404`, `0 broken images`, `0 mixed content`.
- **Dữ liệu API:** Tải phân trang server-side 100% khớp DTO contract, định dạng tiền tệ VNĐ và thời gian ISO chuẩn.

---

## 6. GIỚI HẠN KIỂM THỬ & KIẾN NGHỊ (TEST LIMITATIONS REGISTER)

Để đảm bảo tính trung thực kỹ thuật, không tự ý tuyên bố "100% WCAG/a11y", các giới hạn kiểm thử sau đây được ghi nhận rõ:

1. **Phạm vi Accessibility Đã Kiểm Chứng:**
   - Đã kiểm tra tính có mặt của cặp `id` / `<label for="...">` trên toàn bộ các trường nhập liệu form của Rooms, RoomTypes, Date Filter.
   - Đã kiểm tra `aria-label` cho tất cả các icon-only button (Sửa, Xóa, Làm mới, Phân trang) và thuộc tính `aria-current="page"`.
   - Đã kiểm tra cơ chế điều hướng phím Tab/Enter cơ bản trên Chrome DevTools.
2. **Các Hạng Mục Chưa Kiểm Chứng (Chờ Đợt Audit Chuyên Sâu):**
   - **Screen Reader:** Chưa kiểm thử thực tế với phần mềm đọc màn hình chuyên dụng (NVDA, JAWS, VoiceOver).
   - **Tương phản màu (Color Contrast Audit):** Mới kiểm tra trực quan trên palette màu Tailwind chuẩn (Slate/Emerald); chưa chạy audit contrast ma trận tự động cho tất cả các trạng thái hover/focus/disabled.
   - **Touch Target Sizes trên thiết bị vật lý:** Đã đo lường trên CDP Emulation (đạt $\ge 32\text{px}\times 32\text{px}$); chưa kiểm thử thực tế trên màn hình cảm ứng vật lý với nhiều kích thước ngón tay khác nhau.
3. **Trạng thái Ticket:**
   - Ticket `DELIVERY-CATALOG-01` hiện ở trạng thái **`In Review`**.
   - Quyền nghiệm thu cuối cùng thuộc về Technical Reviewer và Product Owner.


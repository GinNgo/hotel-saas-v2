# Báo Cáo Kiểm Toán Hệ Thống Thiết Kế & UI/UX Pro Max Toàn Diện (360°)
**Dự án:** Hotel SaaS Platform v2 (`.NET 10 + Angular 22 + PostgreSQL 17`)  
**Nhánh / Commit kiểm toán:** `develop` @ `c297b58`  
**Vai trò thực hiện:** `uiux-architect` (UI/UX Pro Max Design System & Angular 22 Standards Specialist)  
**Phạm vi kiểm toán:** Toàn bộ mã nguồn Frontend tại `frontend/src/` (`158` tệp `.ts` phi-spec, `1` tệp `.html` rời, `70` `@Component`, `styles.css`, `index.html`, `angular.json`, `package.json`, `tailwind.config.js`, `app.config.ts`, `app.routes.ts`, 3 layouts, `shared/`, và toàn bộ `features/`), đối chiếu cùng `docs/design/booking-marketplace/spec.md`, `docs/design/experience-foundation/spec.md` và `AGENTS.md` §3.

---

## Tóm Tắt Điều Hành & Scorecard Sẵn Sàng

### Đánh Giá Tổng Quan
Mã nguồn giao diện của Hotel SaaS Platform v2 thể hiện nỗ lực xây dựng nhanh nhiều phân hệ nghiệp vụ phong phú (Marketplace đa khách sạn, Console vận hành PMS, và Bảng quản trị nền tảng Governance), nhưng **chưa có Design System hợp nhất** giữa 3 persona. Ba vấn đề mang tính cấu trúc lớn nhất là:

1. **Đứt gãy bản sắc thị giác & Dark Mode nửa vời:** Persona Guest bị xẻ đôi giữa hai ngôn ngữ thiết kế xung đột (Indochine `#EFECE6/#FAF7F2/#0D2E28/#C05621` + `Playfair Display` và SaaS Indigo/Slate), trong khi `app.config.ts:L27` tắt hẳn Dark Mode của PrimeNG (`darkModeSelector: false`) còn `styles.css:L657-930` vá bằng hàng trăm rule `!important` không phủ nổi các hex Indochine.
2. **Nợ Accessibility (WCAG AA) & Cảm ứng Mobile:** Có **`55` nút icon-only thiếu `aria-label`** (`26` nút thiếu cả `aria-label` lẫn `title`), **`14` thành phần tương tác dùng `<div>` gắn `(click)` thiếu `role="button"`/`tabindex`/`keydown`** (trên tổng `47` non-button `(click)`), **`11` tệp modal/drawer `fixed inset-0` thiếu `role="dialog"`/`aria-modal`** (ngoài `loading-overlay` dùng `role="status"`), chỉ **`3/21` tệp overlay/dialog có `cdkTrapFocus`**, **`262` nút/liên kết trên `45` tệp gợi ý kích thước `< 44px`**, và **`1,190` dòng dùng micro-text `7px–11px`**.
3. **Tuân thủ Angular 22 (`AGENTS.md` §3) & Tính trung thực dữ liệu UI:** **`24/70` (`34.3%`) component thiếu `ChangeDetectionStrategy.OnPush`**, **`196` lời gọi `.subscribe()`** (`132` lời gọi không có cleanup nội dòng `takeUntilDestroyed`/`takeUntil`), **`113` chú thích `any` + `2` `$any()`**, Shared Registry bị bỏ qua hàng loạt (`<app-stat-card>` chỉ dùng ở `2` trang, `<app-status-badge>` ở `2` trang, `<app-form-field>` ở `3` trang, pipe `businessDate` = `0` lượt dùng), và nhiều màn hình public/governance vẫn trộn dữ liệu tĩnh/mô phỏng (`booking.page.ts` hero review giả, `flash-deals-banner` đếm ngược reset nửa đêm, `public-booking.service.ts:getPromotions()`, `ops-readiness.page.ts` toàn bộ telemetry giả lập, `booking-status.page.ts` lộ thẻ test VNPay).

### Scorecard Sẵn Sàng Theo 10 Hạng Mục UI/UX Pro Max & 3 Persona

| # | Hạng mục Kiểm toán | Điểm (/10) | Mức độ Rủi ro | Guest (B2C) | Property Staff (PMS) | Governance Admin | Tóm tắt Khoảng trống Chính |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | **Accessibility (A11y)** | **4.0** | **P0** | Trung bình–Kém | Kém | Kém | 55 nút thiếu `aria-label`, 14 `<div>` clickable thiếu keyboard, 18/21 modal/dialog thiếu `cdkTrapFocus`, thiếu skip-link ở Admin/Auth. |
| 2 | **Touch & Interaction** | **4.5** | **P1** | Kém | Kém | Trung bình | 262 controls `<44px` (star rating `p-1`, pagination `w-7 h-7`, housekeeping mobile buttons `py-1.5`), nested interactive click. |
| 3 | **Performance & CLS** | **5.0** | **P1** | Kém | Kém | Trung bình | 23/23 `<img>` thiếu HTML `width/height`, 14/23 thiếu `loading`, 0 virtual scroll, 24/70 thiếu `OnPush`, font `Material+Icons` chết. |
| 4 | **Style & Visual Cohesion** | **3.5** | **P0** | Rất rời rạc | Trung bình | Kém | 77+ dòng emoji thay icon (13 tệp), đứt gãy Indochine vs Slate/Indigo, 75 Unsplash URL cứng, dữ liệu tĩnh/giả lập trên UI thật. |
| 5 | **Layout & Responsive** | **5.0** | **P1** | Trung bình | Kém | Trung bình | `styles.css:L628` ép `.fixed.inset-0` `z-index: 100 !important` đè drawer/popup; 29 `<table>` thô; 5 khối `w-[>=360px]`. |
| 6 | **Typography & Color** | **4.0** | **P0** | Kém | Kém | Kém | 1,190 dòng `<12px` khó đọc dấu tiếng Việt; `tabular-nums` chỉ có ở 3 tệp; 154 raw hex trong `app/`; Dark Mode Aura bị tắt. |
| 7 | **Animation & Motion** | **4.5** | **P2** | Trung bình | Kém | Trung bình | 44 `animate-pulse/ping/bounce` trên 19 tệp; chỉ 6 tệp hỗ trợ `prefers-reduced-motion`; không có reset motion toàn cục. |
| 8 | **Forms & Feedback** | **4.0** | **P0** | Trung bình | Kém | Kém | 210 `[(ngModel)]` vs `<app-form-field>` (3 tệp); 2 `window.confirm()`; 0 `canDeactivate`; link Quên MK trỏ nhầm `/booking/lookup`. |
| 9 | **Navigation Patterns** | **4.5** | **P1** | Trung bình | Kém | Kém | Trùng lặp cây route (`/auth/*` vs `/login`; `/admin/*` vs root); 3 shell dùng chung 2 layout; thiếu breadcrumb ở Guest. |
| 10 | **Charts & Data Tables** | **2.5** | **P0** | N/A (ít bảng) | Kém | Rất kém | 0 thư viện biểu đồ (dùng CSS `<div>` chồng chữ); 0 `<p-table>`; 0 `aria-sort`; thiếu empty/loading/error chart states. |
| — | **Angular 22 (`AGENTS.md` §3)** | **5.0** | **P1** | Trung bình | Kém | Trung bình | 24/70 thiếu `OnPush`; 132/196 `.subscribe()` trần; 113 `any`; Shared Registry bị bỏ quên; 3 `<app-empty-state>` truyền sai prop `icon`. |

---

## Phần I: Tổng Hợp UI/UX Pro Max CLI Intelligence & Bộ Lọc Lý Trí Cho Dự Án

Thực thi bộ truy vấn `python C:\Users\ngovo\.gemini\config\skills\ui-ux-pro-max\scripts\search.py` (không dùng `--persist` theo ranh giới bảo toàn repo) cho 3 Persona cùng các truy vấn bổ trợ về UX, Chart, Vietnamese Typography và Angular Signals.

### 1.1. Kết quả UI/UX Pro Max CLI theo 3 Persona

| Truy vấn CLI | Style / Pattern Gợi ý | Bảng màu & Typography Gợi ý | Quyết định Lọc Lý Trí (Đối chiếu `booking-marketplace/spec.md` & `experience-foundation/spec.md`) |
| :--- | :--- | :--- | :--- |
| **1. Public Marketplace**<br>(`"hotel booking marketplace multi property trustworthy" --design-system --variance 5 --motion 4 --density 4`) | **Soft UI Evolution** · Pattern: *Marketplace / Directory* · Parallax Scroll | `#0F766E` Teal + `#14B8A6` + `#0369A1` Blue; Typography: *Cinzel / Josefin Sans* | **GIỮ:** Cấu trúc Marketplace/Directory phân cấp tìm kiếm – lọc – kết quả rõ ràng, bảng màu Teal sâu (`#0D2E28` Indochine tương hợp `#0F766E`), CTA rõ nét.<br>**LOẠI BỎ:** Phông *Cinzel / Josefin Sans / Playfair Display* ở mọi UI tra cứu, giá cả, bảng, thẻ phòng vì nét chân mảnh làm chậm tốc độ quét mắt (fast-scan) và dễ gãy/khít dấu tiếng Việt (`ắ`, `ộ`, `ử`, `ễ`). Loại bỏ Parallax Scroll gây nặng GPU/CLS và vi phạm `prefers-reduced-motion`. |
| **2. PMS Staff Console**<br>(`"hotel property management pms dashboard operations" --design-system --variance 4 --motion 3 --density 8`) | **SaaS Mobile (High-Tech Boutique / Dark partial)** · Pattern: *Real-Time / Operations* · Glassmorphism `BlurView` | `#0F766E` + `#0369A1` + `#F0FDFA`; Typography: *Fira Code / Fira Sans* | **GIỮ:** Mật độ thông tin vận hành cao có trật tự (density 8), phân biệt Day/Night Mode cho lễ tân ca đêm, Real-Time status semantics rõ ràng.<br>**LOẠI BỎ:** Mọi hiệu ứng *Glassmorphism / `backdrop-blur`* trên nút bấm, dropdown, thẻ KPI và bảng phòng vận hành (theo `experience-foundation/spec.md` NFR: không đánh đổi độ rõ nét & tương phản lấy mờ kính). Thay *Fira Code* ở tiêu đề bằng font Sans tiếng Việt chuẩn, chỉ giữ Mono cho mã phòng/PIN/mã đặt chỗ. |
| **3. Governance Admin**<br>(`"saas admin governance billing multi-tenant analytics" --design-system --variance 4 --motion 3 --density 7`) | **Soft UI Evolution** · Pattern: *Analytics / Billing Governance* | Navy `#1E3A5F` + `#2563EB` + `#059669` + Slate `#F8FAFC`/`#0F172A`; *Fira Code / Fira Sans* | **GIỮ:** Ngôn ngữ quyền lực – tin cậy (Deep Navy + Trust Blue/Indigo + Paid Emerald) tách biệt hoàn toàn với PMS chi nhánh để tránh nhầm lẫn thao tác đa tenant.<br>**LOẠI BỎ:** Dùng Mono cho tiêu đề bảng/card; chỉ dùng `tabular-nums` trên số tiền gói cước, tỷ lệ sử dụng quota, thời gian audit. |
| **4. UX & Forms**<br>(`--domain ux "accessibility forms validation responsive dark mode"`) | 15 nguyên tắc UX cốt lõi | Validation tại `blur`, `min-h/w 44px`, label cố định, không horizontal scroll, `150–300ms` transitions, responsive tables | **ÁP DỤNG 100%:** Đặt làm tiêu chuẩn bắt buộc cho kiểm toán Phần II (Mục 1, 2, 5, 7, 8). |
| **5. Charts & Analytics**<br>(`"trend line bar dashboard" --domain chart -n 10`) | 10 quy chuẩn Biểu đồ Doanh thu / Công suất | Line/Area (xu hướng), Bullet/Gauge (so KPI mục tiêu), Bar (`<=15` danh mục), Line+Band (dự báo); `<1000` điểm dùng SVG, `>=1000` dùng Canvas; Bảng dữ liệu fallback cho Screen Reader | **ÁP DỤNG 100%:** Làm chuẩn thay thế toàn bộ CSS `<div>` bar hiện có trong `reports.page.ts`, `dashboard.page.ts`, `subscriptions.page.ts`. |
| **6. Vietnamese Typography**<br>(`--domain typography "vietnamese sans serif readable dashboard"`) | #1 **Vietnamese Friendly** (`Be Vietnam Pro` + `Noto Sans`); #2 **Dashboard Data** (`Fira Code` + `Fira Sans`) | Khoảng cách dấu tiếng Việt tối ưu ở 12px–16px | **ÁP DỤNG & ĐIỀU CHỈNH:** Đề xuất nâng cấp `Plus Jakarta Sans` + `Inter` hiện tại sang **`Be Vietnam Pro`** (headings & UI tiếng Việt) + **`Inter`** (dense tables/metrics) + **`JetBrains Mono`** (chỉ mã booking, số phòng, PIN, hash SHA-256), bỏ hoàn toàn `Playfair Display` và link `Material+Icons` chết ở `index.html:L14-15`. |
| **7. Angular 22 Stack**<br>(`--stack angular "signals onpush forms"`) | 15 quy tắc Angular hiện đại | `OnPush` 100%, Typed Reactive Forms thay `[(ngModel)]`, `signal()`/`computed()`/`input()`/`output()`, `updateOn: 'blur'`, tránh `effect()` cho state dẫn xuất | **ÁP DỤNG 100%:** Song hành trực tiếp cùng `AGENTS.md` §3 ở Phần III. |

---

## Phần II: Đánh Giá Sâu 10 Hạng Mục UI/UX Pro Max Qua 3 Persona

### 1. Accessibility (Khả Năng Tiếp Cận — WCAG 2.1 AA) — **[P0 — Nghiêm trọng]**
**Ảnh hưởng:** Cả 3 Persona (Guest, Property Staff, Governance Admin)

- **55 nút icon-only thiếu `aria-label` (trong đó `26` nút trên `13` tệp thiếu cả `aria-label` lẫn `title`):**
  - Toàn bộ hệ thống có `55` thẻ `<button>` chỉ chứa `<i>` hoặc `<svg>` mà không có `aria-label` / `[attr.aria-label]`. Trong số đó, `26` nút không có cả `title` fallback khiến Screen Reader chỉ đọc `"button"`:
    - **Governance:** `admin-contracts.page.ts:L236`, `admin-plans.page.ts:L229, L347`.
    - **Auth:** `phone-otp-modal.component.ts:L44` (nút đóng modal).
    - **PMS Staff:** `reservations.page.ts:L697, L1143, L1613, L1689, L1812, L1962` (`6` nút), `rooms.page.ts:L670, L896, L1071` (`3` nút), `staff.page.ts:L380, L465, L579` (`3` nút), `guests.page.ts:L255`, `payments.page.ts:L1130`, `refund-approval.component.ts:L1135`, `properties.page.ts:L326`, `room-types.page.ts:L407`.
    - **Guest:** `booking-status.page.ts:L503, L522, L541, L560` (`4` nút chấm điểm sao phụ cleanliness/location/service/value), `popular-destinations.component.ts:L44` (nút xóa từ khóa tìm kiếm).
- **14 phần tử không phải nút (`<div>`) gắn `(click)` nhưng thiếu `role="button"`, `tabindex="0"` và `(keydown.enter/space)`** (trong tổng `47` non-button `(click)`, sau khi loại trừ `16` wrapper `stopPropagation`, `12` phần tử đã chuẩn hóa và `5` lớp phủ backdrop):
  - **Auth:** `context-selector.dialog.ts:L56, L106` (card chọn Chain HQ & Chi nhánh làm việc — người dùng bàn phím không thể chọn chi nhánh sau đăng nhập!).
  - **PMS Staff:** `housekeeping.page.ts:L99, L112, L127, L142, L157, L172` (`6` thẻ KPI lọc trạng thái phòng), `rooms.page.ts:L301` (card phòng ở Grid view) & `L607` (chip booking trên Timeline), `reservations.page.ts:L629` (khối đặt phòng trên Gantt).
  - **Guest:** `booking-status.page.ts:L378` (bấm sao chép mã xác nhận), `explore-search.page.ts:L638` (card chọn khách sạn trên bản đồ), `booking-filter-bar.component.ts:L210` (mục tìm kiếm gần đây dạng `<div (click)>` lại chứa `<button>` xóa lồng bên trong — vi phạm HTML interactive nesting).
- **Quản lý Focus Modal yếu (`3/21` tệp overlay/dialog có `cdkTrapFocus`):**
  - Trong `21` tệp có `fixed inset-0` (`19` tệp) hoặc `role="dialog"` (`2` popover/panel bổ sung), chỉ có `3` component triển khai `cdkTrapFocus` (`refund-approval.component.ts`, `photo-gallery-modal.component.ts`, `room-detail-modal.component.ts`).
  - `11` tệp modal/drawer `fixed inset-0` tự chế không có cả `role="dialog"` lẫn `aria-modal="true"`: `admin-contracts.page.ts`, `admin-plans.page.ts`, `phone-otp-modal.component.ts`, `guests.page.ts`, `payments.page.ts`, `properties.page.ts`, `rates.page.ts`, `room-types.page.ts`, `rooms.page.ts`, `staff.page.ts`, `admin-layout.ts` (mobile drawer; riêng `loading-overlay.component.ts` dùng `role="status"`). Các dialog/panel đã có `role="dialog"` nhưng **thiếu `cdkTrapFocus`** gồm `audit-logs.page.ts`, `booking-status.page.ts`, `reservations.page.ts` (6 modal), `roles-management.component.ts`, `ai-concierge-chat.component.ts`, `notification-bell.component.ts`.
- **Xóa Focus Ring tràn lan (`199` lượt `outline-none` / `focus:outline-hidden` trên `35` tệp):**
  - Nhiều `<select>` và `<input>` tự chế đặt `outline-none` mà không đảm bảo `focus-visible:ring-2`: điển hình `pagination.component.ts:L38`, `guests.page.ts:L92, L100`, `policies.page.ts` (`15` lượt `outline-none`), `refund-approval.component.ts` (`10` lượt), `properties.page.ts` (`9` lượt), `partner-register.page.ts` (`8` lượt), `brand-logo.component.ts:L11` (`focus:outline-none`), `breadcrumb.component.ts:L40` (`focus:outline-hidden`).
- **Skip-links & Semantic Landmarks thiếu đồng bộ:**
  - Chỉ `guest-layout.ts:L31` có `<a href="#booking-content" class="skip-link">Đến nội dung chính</a>`. Cả `admin-layout.ts` (sidebar nhiều nhóm menu dài) lẫn `auth-layout.ts` đều thiếu hoàn toàn skip-link.
- **Độ tương phản & `prefers-contrast`:**
  - `prefers-contrast` = `0` lượt trong toàn repo. Một số chữ phụ `text-slate-400` trên nền `#FBF9F5`/`#EFECE6`/`bg-slate-50` (ví dụ `booking-date-picker.component.ts:L35-38`, `room-detail-modal.component.ts:L100`, `audit-logs.page.ts:L375`) không đạt chuẩn WCAG AA `4.5:1`. Trên Dark Mode, các trang PMS/Guest dùng `bg-white`, `text-slate-800` không có biến tối sẽ bị chữ tối trên nền tối nếu PrimeNG hoặc override CSS sót selector.

**Khuyến nghị sửa:** Tạo một `UiModalDirective` hoặc chuẩn hóa CDK `Dialog`/`cdkTrapFocus` + `aria-modal="true"` + Escape handler cho toàn bộ `17` tệp modal/drawer/panel tương tác còn thiếu (`18` tính cả `loading-overlay` đã có `role="status"`); thay `14` `<div>` clickable bằng `<button type="button">`; ép chuẩn `focus-visible:ring-2` toàn cục và bổ sung `aria-label` tiếng Việt cho toàn bộ `55` nút icon-only.

---

### 2. Touch & Interaction (Cảm Ứng & Tương Tác) — **[P1 — Cao]**
**Ảnh hưởng:** Guest (Mobile Booking), Property Staff (Housekeeping dùng máy tính bảng/điện thoại)

- **262 phần tử `<button>` / `<a>` trên `45` tệp có kích thước `< 44px` (`w-4..w-9`, `h-4..h-9`, `p-1`, `p-1.5`, `py-1`, `py-1.5` không có `min-h-11` / `h-11` / `h-12`):**
  - **PMS Staff (đứng đầu danh sách):** `reservations.page.ts` (`28` nút), `rooms.page.ts` (`19`), `roles-management.component.ts` (`15`), `refund-approval.component.ts` (`11`), `payments.page.ts` (`10`), `permissions-matrix.component.ts` (`10`), `room-types.page.ts` (`9`), `housekeeping.page.ts` (`8` nút đổi trạng thái dọn phòng trực tiếp trên mobile dùng `py-1.5 text-[11px]`), `reports.page.ts` (`7`), `staff.page.ts` (`5`).
  - **Guest:** `explore-search.page.ts` (`14`), `booking-status.page.ts` (`11` — gồm `4` nút sao đánh giá `p-1` tại L503–L560 cực khó bấm ngón tay), `booking.page.ts` (`10`), `booking-hold.page.ts` (`5`), `popular-destinations.component.ts` (`5`), `tenant-brand.page.ts` (`5`), `ai-concierge-chat.component.ts` (`5`), `guest-profile.page.ts:L129` (nút sửa avatar `w-6 h-6` = `24x24px`).
  - **Shared UI:** `pagination.component.ts` (nút trang `w-7 h-7` = `28x28px`, `<select>` nhỏ), `breadcrumb.component.ts:L25` (nút quay lại `w-7 h-7` = `28x28px`), `booking-filter-bar.component.ts:L339, L351` (nút `-`/`+` chọn số khách `w-7 h-7` = `28x28px`), `notification-bell.component.ts:L152, L168` (`w-7 h-7` tắt âm/đóng), `loading-overlay.component.ts` (`p-1.5`).
  - **Auth:** `login.page.ts` (`6` nút), `register.page.ts` (selector mã vùng điện thoại `h-10` = `40px`), `phone-otp-modal.component.ts:L44` (`p-1.5`).
- **Tương tác lồng nhau & Hover-only:**
  - `booking-filter-bar.component.ts:L210-234`: thẻ `<div (click)="selectRecentSearch(recent)">` bọc bên ngoài `<button (click)="removeRecentSearch(...)">`, dễ gây bấm nhầm trên màn hình chạm.
  - `booking-date-picker.component.ts`: đã dùng `<p-datepicker>` nhưng thiếu `[touchUI]` thích ứng mobile (khác với `date-range-filter.component.ts` có `window:resize` chuyển `touchUI`).

**Khuyến nghị sửa:** Thêm utility `.touch-target { min-width: 44px; min-height: 44px; }` (hoặc `min-h-11 min-w-11`) cho toàn bộ nút hành động ở `PaginationComponent`, `HousekeepingPage`, `BookingFilterBarComponent`, `BookingStatusPage`, `BreadcrumbComponent`, `NotificationBellComponent`; tách nút xóa lịch sử tìm kiếm ra ngoài `<button>` chính bằng flex container.

---

### 3. Performance (Hiệu Năng, CLS & Tài Nguyên Tải) — **[P1 — Cao]**
**Ảnh hưởng:** Cả 3 Persona (nặng nhất ở Guest Marketplace & PMS Timeline)

- **Hình ảnh & Cumulative Layout Shift (CLS):**
  - Toàn bộ **`23` thẻ `<img>`** trong `.ts` (tất cả đều có `alt`, `0` thiếu alt — điểm cộng) nhưng **`23/23` (`100%`) thiếu thuộc tính `width` / `height` HTML** (chỉ dựa vào class Tailwind) và **`14/23` (`60.9%`) thiếu `loading="lazy"` hoặc `ngSrc`** (bao gồm `booking.page.ts:L207`, `destination-explore.page.ts:L69, L257`, `promotions.page.ts:L103`, `property-detail.page.ts:L125`, `tenant-brand.page.ts:L331`, `room-detail-modal.component.ts:L30`, `guest-profile.page.ts:L115, L310`, `room-types.page.ts:L214`).
  - **`75` dòng chứa URL `images.unsplash.com` cứng trên `8` tệp** (`vietnam-provinces.data.ts` 33, `room-gallery.service.ts` 15, `destination-explore.page.ts` 13, `curated-bento-grid.component.ts` 4, `public-booking.service.ts` 4, `explore-search.page.ts` 3, `guest-profile.page.ts` 2, `room-types.page.ts` 1) — phụ thuộc CDN bên thứ ba, dễ lỗi mạng hoặc giật layout khi tải chậm.
- **Font Loading & Tài nguyên chết (FOIT / Waste):**
  - `frontend/src/index.html:L14-15` tải **4 họ Google Fonts** (`Inter`, `JetBrains Mono`, `Playfair Display`, `Plus Jakarta Sans`) CỘNG THÊM link CSS **`Material+Icons` (`index.html:L15`)** nhưng kết quả quét cho thấy **`0` lượt sử dụng `material-icons` / `material-symbols` / `<mat-`** trong toàn bộ mã nguồn!
- **Thiếu Virtual Scrolling (`0` `cdk-virtual-scroll`):**
  - `reservations.page.ts` (Gantt + bảng danh sách đơn đặt phòng, file dài `3,789` dòng), `rooms.page.ts` (Timeline + lưới phòng), `audit-logs.page.ts` (4 bảng), `explore-search.page.ts` render toàn bộ phần tử DOM qua `@for` / `*ngFor` không dùng `cdk-virtual-scroll`.
- **Change Detection & Reactive Overhead:**
  - `24/70` (`34.3%`) component vẫn chạy Default Change Detection (chi tiết ở Phần III) và **`67` lượt `backdrop-blur` trên `35` tệp** gây tốn chi phí composite GPU trên thiết bị di động tầm trung.
  - `styles.css:L657-930` có gần `275` dòng CSS override `!important` đánh vào từng class utility của Tailwind khi ở Dark Mode — tăng kích thước CSS toàn cục và độ phức tạp tính toán style.

**Khuyến nghị sửa:** Xóa ngay link `Material+Icons` và `Playfair Display` ở `index.html:L14-15`; bổ sung `width`/`height` + `loading="lazy"` (`fetchpriority="high"` cho ảnh Hero duy nhất) trên toàn bộ 23 `<img>`; chuyển dữ liệu ảnh sang `NgOptimizedImage` hoặc local/managed CDN assets; kích hoạt `OnPush` cho 24 component còn lại và áp dụng `cdk-virtual-scroll` cho Audit Logs & Gantt/Timeline khi danh sách lớn.

---

### 4. Style Selection & Visual Cohesion (Thẩm Mỹ, Đồng Nhất & Tính Trung Thực UI) — **[P0 — Nghiêm trọng]**
**Ảnh hưởng:** Guest (trầm trọng nhất), PMS Staff, Governance Admin

- **Vi phạm Emoji-as-Icon tràn lan (`13` tệp, `77+` dòng):**
  - Trái chuẩn UI/UX Pro Max (cấm dùng emoji thay vector icon để tránh sai lệch hiển thị giữa Windows/iOS/Android), mã nguồn rải đầy emoji ngay trong badge giá, dropdown lọc, sơ đồ phòng và bản đồ:
    - `explore-search.page.ts` (`22` dòng: `📍 🏨 ★ 💰 🌙`)
    - `booking.page.ts` (`16` dòng: `🌸 🏝 🌉 🌊 🏛 ★ 📍 💰 🌙 ⚡ 📅`)
    - `properties.page.ts` (`8` dòng L579–586: `🏨 🏖 🛏 ☕ 🏡 🏢 ⚡ 🌿`)
    - `destination-explore.page.ts` (`8` dòng: `📍 🚶 🏨 ★ 🌙 ☀`)
    - `booking-filter-bar.component.ts` (`8` dòng: `📍 Gần tôi`)
    - `promotions.page.ts` (`3`: `🌙 📍`), `property-detail.page.ts` (`3`: `★ 🌙 ☀ ✓`), `tenant-brand.page.ts` (`3`: `📍`), `reservations.page.ts` (`3`: `➔`), `rooms.page.ts` (`3` L1554–1559: `⚡ 🌙 📅`), `staff.page.ts` (`2` L159, 162: `✓`), `ai-concierge-chat.component.ts` (`2`: `📍`), `google-map-picker.component.ts` (`2`: `📍 📌`).
  - Ngoài ra `guest-layout.ts:L58` dùng flag emoji `🇻🇳 VN`, `register.page.ts` dùng flag emoji quốc gia, `brand-logo.component.ts` + `room-detail-modal.component.ts` dùng SVG thô trộn với `pi pi-*` của PrimeIcons.
- **Đứt gãy Ngôn ngữ Thị giác giữa 3 Shell & Nội bộ Shell Guest:**
  - **Shell Guest bị phân mảnh làm 2 nửa:**
    - Nhóm Indochine (`#EFECE6`, `#FAF7F2`, `#F5F2EB`, `#0D2E28`, `#C05621` + `font-serif`): `booking.page.ts`, `explore-search.page.ts`, `property-detail.page.ts`, `booking-hold.page.ts`, `booking-status.page.ts` — nhưng chính bên trong lại pha nút `bg-indigo-600`, `bg-amber-600`, `bg-slate-900` tạo cảm giác ghép vá!
    - Nhóm SaaS Slate/Indigo: `guest-layout.ts`, `booking-lookup.page.ts`, `promotions.page.ts`, `destination-explore.page.ts`, `tenant-brand.page.ts`, `guest-profile.page.ts`.
  - **Shell Governance không có bản sắc riêng tách khỏi PMS:**
    - Dùng chung `AdminLayoutComponent` (`admin-layout.ts`), nhưng `admin-plans.page.ts` chọn tông Indigo, `admin-contracts.page.ts` chọn tông Emerald giống PMS lễ tân, còn `dashboard.page.ts` phải tự gánh 3 chế độ (Platform / Chain HQ / Property).
  - **Component chết & trùng lặp:** `ai-concierge-widget.component.ts` tồn tại với `0` lượt sử dụng (trong khi `GuestLayout` dùng `ai-concierge-chat.component.ts` có gắn nhãn `"3.8 Flash"` ở `L61`).
  - **Rủi ro Purge CSS Tailwind ở `status-badge.component.ts:L152`:** Ghép chuỗi động ``bg-${forcedColor}-500`` có thể bị Tailwind tree-shaker loại bỏ khi build production nếu màu không xuất hiện tĩnh ở nơi khác.
- **Vi phạm Tính Trung Thực Dữ Liệu UI (Fake / Hardcoded Content trên Production UI):**
  - `booking.page.ts:L208-268`: Hardcode card Hero `"Da Nang Ocean Suites & Spa Resort"`, điểm `"4.9/5"`, `"480+ đánh giá thực tế"`, giá `"1.250.000 ₫"` không đến từ API thực.
  - `flash-deals-banner.component.ts:L36, L158, L190-208`: Đồng hồ đếm ngược giả tự reset 24h lúc nửa đêm, hardcode mã `WELCOME15`/`WEEKEND200`/`HOURLY99K`, hardcode `"Còn 34 lượt hôm nay"` và cam kết `"giữ phòng trong 30 giây"`.
  - `public-booking.service.ts:L587-638`: `getPromotions()` trả về `of([...])` dữ liệu khuyến mãi & ảnh Unsplash tĩnh hoàn toàn.
  - `popular-destinations.component.ts` & `curated-bento-grid.component.ts`: Hardcode số lượng khách sạn, đánh giá và `startPrice`.
  - `trust-pillars.component.ts` & `guest-profile.page.ts:L253-256` & `room-detail-modal.component.ts:L64`: Tuyên bố `"tích hợp Smart Lock 24/7"`, `"Cấp mã PIN tự động"`, `"Hủy phòng miễn phí trước 24 giờ"` như tính năng mặc định toàn hệ thống dù không gắn với cấu hình chính sách thực của từng Property.
  - **`ops-readiness.page.ts` & `ops-readiness.utils.ts`:** Toàn bộ trang SRE/Ops Readiness (Isolations Assertions, Load Test, Structured Logs) là hàm giả lập `setTimeout` ở client nhưng trình bày như telemetry vận hành hệ thống thực tế!

**Khuyến nghị sửa:** Xóa toàn bộ `77+` emoji thay bằng `pi pi-*` hoặc SVG chuẩn đồng bộ; dẹp `ai-concierge-widget.component.ts`; thay dữ liệu tĩnh/mô phỏng ở Hero Marketplace, Flash Deals, Promotions và Ops Readiness bằng API thực hoặc banner thông báo minh bạch / `empty-state` trung thực; hợp nhất 3 Shell Token rõ ràng (Phần IV).

---

### 5. Layout & Responsive (`375px / 768px / 1024px / 1440px`) — **[P1 — Cao]**
**Ảnh hưởng:** Cả 3 Persona

- **Xung đột `z-index` và Lớp phủ toàn cục tại `styles.css:L628-650`:**
  - `styles.css:L628-650` đặt quy tắc toàn cục lên `.fixed.inset-0`: ép `width: 100vw; height: 100vh; z-index: 100 !important`. Hệ quả:
    - Chồng chéo với `admin-layout.ts:L39` (mobile sidebar backdrop chỉ có `z-40`), các modal đặt `z-[110]` (`rooms.page.ts:L1192`), và xung đột tiềm ẩn với dropdown `appendTo="body"` của PrimeNG `<p-datepicker>`.
    - Trong khi đó, LuxeStay Toast của SweetAlert2 dùng `z-index: 99999` và `margin: 76px 16px` (`styles.css`), có thể che lấp nút thao tác góc trên phải ở màn hình `375px`.
- **Rủi ro Tràn Ngang (Horizontal Overflow) tại `375px / 768px`:**
  - Có `5` phần tử gắn chiều rộng cứng `>= 360px`: `rooms.page.ts:L546` (`700px` cho timeline), `booking.page.ts:L113` (`500px`), `ai-concierge-chat.component.ts:L47` (`360px` / `420px`), `ai-concierge-widget.component.ts:L46` (`420px`). Ở viewport `375px`, khung chat `360px` + padding/margin hoặc khối `500px` dễ chạm mép hoặc gây scroll ngang nếu thiếu `max-w-[calc(100vw-2rem)]`.
  - **`29` thẻ `<table>` thô across `18` tệp** (`audit-logs` 4 bảng, `reservations` 4, `refund-approval` 2, `rooms` 2, `rates` 2, `booking-lookup` 2, `booking-status` 2, v.v.): trên màn hình `375px`/`768px`, phần lớn không có chế độ chuyển sang stacked-card cho mobile (trừ phần thẻ danh sách di động riêng ở vài trang như `housekeeping`), buộc nhân viên lễ tân/admin phải cuộn ngang liên tục.
  - Header ở `guest-layout.ts` gồm cả utility bar trên cùng + navigation bar chính + các nút Auth/Language/Saved khiến chiều cao và mật độ nút chật chội ở breakpoint `768px–1024px`. `reports.page.ts` nhồi 4 nút chọn nhanh kỳ báo cáo + 3 nút xuất Excel/CSV/PDF trong cùng cụm tiêu đề.

**Khuyến nghị sửa:** Gỡ bỏ hoàn toàn override `.fixed.inset-0 { z-index: 100 !important }` khỏi `styles.css`, chuyển sang thang `--z-sticky / --z-drawer / --z-modal / --z-popover / --z-toast` (Phần IV); thêm `max-w-[calc(100vw-1.5rem)]` cho `ai-concierge-chat` và chuẩn hóa responsive table/card stack ở breakpoint `< 768px`.

---

### 6. Typography & Color (Phông Chữ Tiếng Việt, Số Học & Hệ Màu) — **[P0 — Nghiêm trọng]**
**Ảnh hưởng:** Cả 3 Persona

- **Vấn đề Typography & Tiếng Việt:**
  - `font-serif` (`Playfair Display`) được dùng **`20` lần trên `9` tệp**, trong đó có `print-contract.page.ts` (hợp đồng pháp lý dày đặc chữ tiếng Việt nhỏ) và các tiêu đề B2C (`booking.page.ts`, `explore-search.page.ts`, `property-detail.page.ts`, `brand-logo.component.ts`). Dấu phụ tiếng Việt ở nét serif có độ tương phản nét mảnh/đậm lớn dễ bị dính hoặc mờ khi co nhỏ trên mobile.
  - **Lạm dụng Micro-text `< 12px`:** Có **`1,190` dòng sử dụng `text-[7px]`–`text-[11px]` trên `59` tệp** — nhãn dữ liệu, phụ đề form, badge trạng thái phòng, chi tiết audit log dưới `12px` làm suy giảm tốc độ đọc và vi phạm chuẩn ergonomic PMS ca đêm.
  - **Thiếu `tabular-nums` trên dữ liệu tài chính & đếm ngược:** Toàn bộ repo chỉ có **`20` lượt `tabular-nums` trên vỏn vẹn `3` tệp** (`refund-approval.component.ts` 18, `booking-status.page.ts` 1, `loading-overlay.component.ts` 1). Toàn bộ giá phòng VND ở `booking.page.ts`, `explore-search.page.ts`, `property-detail.page.ts`, đồng hồ đếm ngược giữ chỗ ở `booking-hold.page.ts`, thẻ KPI ở `dashboard.page.ts`, `reports.page.ts`, `admin-plans.page.ts`, `subscriptions.page.ts`, và hóa đơn `print-invoice.page.ts` đều thiếu `tabular-nums`, khiến cột số lệch hàng khi cập nhật hoặc so sánh giá.
- **Vấn đề Màu Sắc & Dark Mode Đứt Gãy:**
  - **`154` raw hex color xuất hiện trong `14` tệp `app/`** (dù `tailwind.config.js` đã khai báo `indochine`, `terracotta`, `linen`): `property-detail.page.ts` (`74` hex), `explore-search.page.ts` (`23`), `booking-status.page.ts` (`11`), `brand-logo.component.ts` (`9`), `booking-hold.page.ts` (`8`), `booking-filter-bar.component.ts` (`7`), `enums.ts` (`5`), `login.page.ts` (`5`), `register.page.ts` (`5`), v.v. Thêm vào đó `styles.css` cũng hardcode `#4f46e5` / `#059669` cho `.p-button-primary` / `.p-button-success`.
  - **Áp dụng CSS Token gần như bằng 0:** Chỉ `6` tệp có `dark:` hoặc `var(--surface-*)` (`guest-layout` 14 var, `admin-layout` 3, `auth-layout` 3, `breadcrumb` 3 `dark:` + 2 var, `brand-logo` 3 `dark:`, `popular-destinations` 1 `dark:`), và **`0` lượt dùng `var(--brand-*)`** trong `app/`.
  - **Dark Mode của PrimeNG bị vô hiệu hóa hoàn toàn:** `app.config.ts:L27` cấu hình `options: { darkModeSelector: false }`, và `tailwind.config.js` chưa bật `darkMode: ['selector', '[data-theme="dark"]']`. Lớp CSS vá tạm ở `styles.css:L657-930` chỉ ánh xạ `.bg-[#fbfbfa]` và `.bg-[#EFECE6]`, bỏ sót hoàn toàn `#FBF9F5`, `#FAF7F2`, `#F5F2EB`, `#0D2E28`, `#C05621`.

**Khuyến nghị sửa:** Áp dụng kiến trúc 3 tầng Token ở Phần IV; bật `darkMode: ['selector', '[data-theme="dark"]']` ở `tailwind.config.js` và `darkModeSelector: '[data-theme="dark"]'` ở `app.config.ts`; nâng sàn cỡ chữ UI lên tối thiểu `12px` (`text-xs`), bổ sung `.tabular-nums` cho mọi giá tiền/KPI/timer/bảng; xóa `Playfair Display` & `Material+Icons`.

---

### 7. Animation & Motion (Chuyển Động & Giảm Chuyển Động) — **[P2 — Trung bình]**
**Ảnh hưởng:** Guest, Property Staff

- **Thiếu hỗ trợ `prefers-reduced-motion`:**
  - Chỉ **`6` tệp** xử lý `prefers-reduced-motion` hoặc `motion-reduce:` (`alert.service.ts`, `admin-layout.ts`, `loading-overlay.component.ts`, `photo-gallery-modal.component.ts`, `skeleton-table.component.ts`, `styles.css`).
  - Trong khi đó, **`44` lượt `animate-pulse` / `animate-ping` / `animate-bounce` chạy vô hạn trên `19` tệp** (nổi bật: `dashboard.page.ts` 7, `housekeeping.page.ts` 4, `payments.page.ts` 3, `booking-status.page.ts` 3, `refund-approval` 2, `properties` 2, `booking` 2, `ai-concierge-widget` 2) không gắn tiền tố `motion-reduce:animate-none`.
- **Chuyển động trạng thái & Skeleton:**
  - `phone-otp-modal.component.ts:L29-30` trộn lẫn `animate-fade-in` + `animate-in fade-in zoom-in duration-150`, còn `room-detail-modal.component.ts:L15` dùng `animate-fadeIn` — tên animation không đồng nhất. Chưa có rule `@media (prefers-reduced-motion: reduce)` toàn cục để hạ `animation-duration` và `transition-duration` về `0.01ms`.

**Khuyến nghị sửa:** Bổ sung block `@media (prefers-reduced-motion: reduce)` chuẩn vào `styles.css`; bỏ `animate-ping`/`animate-pulse` khỏi các chấm trạng thái tĩnh trên `dashboard.page.ts` và `housekeeping.page.ts` (giữ `animate-pulse` chỉ cho skeleton loading đi kèm `motion-reduce:animate-none`).

---

### 8. Forms, Validation, Feedback & Trust Guardrails — **[P0 — Nghiêm trọng]**
**Ảnh hưởng:** Cả 3 Persona

- **Lạm dụng `[(ngModel)]` và bỏ qua `<app-form-field>`:**
  - Hệ thống có tới **`210` lượt `ngModel` trên `35` tệp** (`payments.page.ts` 15, `admin-contracts.page.ts` 13, `admin-plans.page.ts` 13, `refund-approval.component.ts` 10, v.v.), thay vì Typed Reactive Forms với `updateOn: 'blur'`.
  - Component chuẩn **`<app-form-field>`** (`form-field.component.ts` viết rất tốt: `OnPush`, Signal, tự gắn `aria-describedby`, `aria-invalid`, `role="alert"`) **chỉ được dùng ở `3` tệp** (`login.page.ts`, `properties.page.ts`, `booking-hold.page.ts`, tổng `13` thẻ)! Các form quan trọng như `register.page.ts`, `partner-register.page.ts`, `admin-plans.page.ts`, `admin-contracts.page.ts`, `guests.page.ts`, `staff.page.ts`, `policies.page.ts` tự viết `<label>` và lỗi rời rạc không liên kết ARIA (`policies.page.ts:L115` banner lỗi thiếu `role="alert"`).
  - Trong `register.page.ts` và `partner-register.page.ts`, `passwordMatchValidator` gán lỗi lên `confirmPassword` mà không xử lý clear lỗi sạch sẽ khi hai ô khớp lại.
- **Thiếu Bảo vệ Dữ liệu Chưa Lưu & Hộp thoại Xác nhận Chuẩn:**
  - **`0` `canDeactivate` route guard** và **`0` `beforeunload` listener** trên toàn bộ `158` tệp — rời trang khi đang điền hợp đồng, chính sách, giá phòng hoặc form đặt phòng dài gây mất trắng dữ liệu không cảnh báo.
  - **`2` lượt gọi `window.confirm()` gốc của trình duyệt** phá vỡ trải nghiệm & chặn thread UI: `admin-contracts.page.ts:L534` (chấm dứt hợp đồng) và `subscriptions.page.ts:L296` (đổi gói cước). *(Lưu ý: `firebase-auth.service.ts:L229` là lời gọi SDK `confirmationResult.confirm(trimmedOtp)`, không phải browser confirm).*
- **Lỗi Luồng Nghiệp Vụ, PII Giả & Rò Rỉ Thông Tin Nhạy Cảm Trên Form:**
  - **`login.page.ts:L106`:** Liên kết `"Quên mật khẩu?"` dẫn người dùng tới **`/booking/lookup`** (trang tra cứu mã đặt phòng!) do chưa có route khôi phục mật khẩu thực sự.
  - **`login.page.ts:L205-349`:** Hiển thị công khai cụm nút **Đăng nhập Demo 1-click** (`guest.vip`, `superadmin`, `owner`, `manager.both`, `staff.single`) mà không bọc điều kiện `isDevMode()`.
  - **`admin-contracts.page.ts:L381-383, L472-474, L517`:** Điền sẵn thông tin người đại diện giả (`'Nguyễn Văn Toàn'`, `'owner@hotelsaas.local'`, `'0909123456'`), tự gán `newTenantId` bằng hợp đồng đầu danh sách, yêu cầu nhập `TenantId` UUID thô thay vì searchable tenant picker, và tạo chữ ký bằng `Math.random()` ở client!
  - **`print-contract.page.ts:L135` & `print-invoice.page.ts:L200-203`:** `print-contract` fallback sang chuỗi hash cứng `'SHA256:7a9c8b2d...'` và in dấu `[DIGITALLY SIGNED]` ngay cả khi hợp đồng chưa ký; `print-invoice` đóng dấu `"ĐÃ XÁC NHẬN THANH TOÁN"` ngay cả khi `balanceDue > 0`!
  - **`booking-status.page.ts:L1001-1003`:** Hardcode số thẻ sandbox VNPay (`9704198526191432198`, `NGUYEN VAN A`, OTP `123456`) ngay trong giao diện thanh toán của khách thực, kèm stub chết `if (false) {}` tại `L1750`.
  - **Thời gian Business Timezone (UTC+7) không nhất quán:** Pipe `businessDate` / `businessDateTime` có **`0` lượt sử dụng** trong mọi template; `payments.page.ts:L40-56` viết hàm `formatUtcDateTimeString` có comment ghi `UTC+7` nhưng thân hàm lại gọi `getUTCDate()` và ghép chữ `UTC`; `print-contract.page.ts` cắt chuỗi `signedAtUtc | slice:0:19 UTC` thay vì giờ Việt Nam.

**Khuyến nghị sửa:** Triển khai `UnsavedChangesGuard` (`CanDeactivate`) cho các form cấu hình/đặt phòng; thay `window.confirm()` bằng `AlertService` / dialog chuẩn; xây dựng route `/auth/forgot-password` (hoặc ẩn link nếu chưa có backend); đưa Demo Login & VNPay sandbox hint ra sau cờ môi trường `!environment.production`; sửa `payments.page.ts` dùng `formatBusinessDateTime` / `businessDate` pipe; sửa ngay logic đóng dấu `print-invoice` & `print-contract`.

---

### 9. Navigation Patterns (Điều Hướng, Tách Shell & Định Tuyến) — **[P1 — Cao]**
**Ảnh hưởng:** Cả 3 Persona

- **Trùng lặp Cây Route (`app.routes.ts:L14-60, L159-384`):**
  - **Auth trùng 2 cây:** `/auth/login`, `/auth/register`, `/auth/confirm-email`, `/auth/partner-register` song song với `/login`, `/register`, `/confirm-email`, `/partner-register`. Hệ quả là liên kết nội bộ bị phân mảnh: `hotelier-cta-banner` và `forbidden.page.ts` trỏ `/login`, còn menu/layout khác dùng `/auth/*`.
  - **Admin/PMS trùng 2 cây:** `/admin/*` (L159–271) nhân bản toàn bộ cây PMS gốc `/dashboard`, `/reservations`, `/rooms`, ..., `/plans`, `/contracts`, `/ops-readiness` (L274–384). `print-contract.page.ts` trỏ về `/admin/contracts` còn `print-invoice.page.ts` trỏ về `/reservations`.
- **Ranh giới 3 Shell chưa tách bạch (`admin-layout.ts`):**
  - SuperAdmin (Governance Admin) và nhân viên/quản lý chi nhánh (Property PMS) dùng chung `AdminLayoutComponent`, chung header, chung style sidebar (chỉ khác nhóm menu phân quyền).
  - Trong `admin-layout.ts:L577, L585`, `hasRatesPermission` tái sử dụng quyền `ROOM_TYPES` và `hasPoliciesPermission` tái sử dụng quyền `PROPERTIES`; vẫn còn method chết `showUnimplementedNotice()` tại `L623-660`.
- **Breadcrumb, Active State & Nhãn Điều Hướng:**
  - `<app-breadcrumb>` chỉ gắn duy nhất tại `admin-layout.ts` (`1` lượt); luồng Guest nhiều tầng (`/booking/destination/:slug` -> `/booking/property/:id` -> `/booking/hold/:id` -> `/booking/status/:token`) không có breadcrumb chuẩn.
  - Link điều hướng ở `guest-layout.ts` thiếu `routerLinkActive` để tô sáng trang hiện tại; mục `/booking/profile` bị đặt nhãn `"Hồ sơ, ví điểm và hóa đơn"` (`guest-layout.ts:L287`) trong khi hóa đơn/ví có phạm vi nghiệp vụ khác nhau.

**Khuyến nghị sửa:** Hợp nhất 1 cây route chuẩn (chuyển hướng `redirectTo` cho alias cũ nếu cần tương thích ngược); tách 2 shell rõ rệt hoặc cấu hình `[data-shell="pms-ops"]` vs `[data-shell="governance"]` trên layout shell theo ngữ cảnh quyền; gắn `routerLinkActive` cho `GuestLayoutComponent` và breadcrumb cho flow đặt phòng.

---

### 10. Charts & Data Tables (Biểu Đồ Phân Tích & Bảng Dữ Liệu) — **[P0 — Nghiêm trọng]**
**Ảnh hưởng:** Governance Admin & Property Staff (Quản lý/Kế toán)

- **Biểu đồ: `0` thư viện Charting chuyên dụng & Giao diện biểu đồ tự chế lỗi:**
  - `package.json` không cài đặt bất kỳ thư viện chart nào (`chart.js`, `echarts`, `ngx-charts`, `apexcharts`).
  - `reports.page.ts:L401-415, L549-562`, `dashboard.page.ts:L885-890` và `subscriptions.page.ts:L114` tự dựng thanh tiến độ CSS `<div>` để mô phỏng biểu đồ doanh thu / tỷ lệ lấp đầy / quota.
  - **Hệ quả thực tế:** Nhãn phần trăm `right-2` ở `reports.page.ts` đè chồng lên thanh màu khi thanh dài gần 100%; `subscriptions.page.ts:L114` chia cứng mẫu số `10` khi limit `>= 999`; **không có trạng thái Empty / Loading / Error riêng cho biểu đồ**, **không có tooltip bàn phím**, và **không có bảng dữ liệu fallback (`sr-only` hoặc toggle Table/Chart) cho Screen Reader** như UI/UX Pro Max `--domain chart` yêu cầu.
- **Bảng dữ liệu: `0` `<p-table>` trên `29` `<table>` thô (`18` tệp) & `0` `aria-sort`:**
  - Dù PrimeNG `^22.1.2` đã cài sẵn, toàn bộ `29` bảng dữ liệu ở `audit-logs` (4 bảng), `reservations` (4), `refund-approval` (2), `rooms` (2), `rates` (2), `booking-lookup` (2), `booking-status` (2), `admin-contracts`, `dashboard`, `guests`, `ops-readiness`, `payments`, `print-invoice`, `reports`, `room-types`, `permissions-matrix`, `roles-management`, `staff` đều tự viết HTML `<table>` thủ công.
  - **`aria-sort` = `0` lượt** trên toàn repo — cột sắp xếp không thông báo chiều sắp xếp (`ascending`/`descending`) cho công nghệ hỗ trợ.
  - `reports.page.ts` có xuất Excel/CSV/PDF nhưng cần chuẩn hóa tiêu đề cột tiếng Việt, định dạng ngày `UTC+7` nhất quán với `businessDateTime`, và tách bộ lọc/xuất khỏi cụm tiêu đề chật trên tablet.

**Khuyến nghị sửa:** Tích hợp chuẩn PrimeNG `<p-table>` (hỗ trợ sort `aria-sort`, virtual/lazy paging, responsive stack) và một thư viện biểu đồ nhẹ hỗ trợ Canvas/SVG + `prefers-reduced-motion` (`chart.js` qua PrimeNG `p-chart` hoặc `echarts`) kèm wrapper `<app-chart-card>` có đủ 4 trạng thái (`loading` / `error` / `empty` / `data` + nút chuyển xem bảng số liệu truy cập được bằng bàn phím).

---

## Phần III: Kiểm Toán Tuân Thủ Angular 22 (`AGENTS.md` §3)

Theo `AGENTS.md` §3 (*Angular 22 Standalone Signals*), mọi component phải đạt 100% Standalone + `ChangeDetectionStrategy.OnPush`, dùng Signals thay cho subscription thủ công rò rỉ bộ nhớ, tuyệt đối không dùng `any`, không inject `HttpClient` vào component, và tái sử dụng các component/pipe chuẩn trong `src/app/shared/`.

### 3.1. Thiếu `ChangeDetectionStrategy.OnPush`: `24 / 70` Components (`34.3%` Vi phạm)

Tổng kiểm tra trên `70` class `@Component` trong `frontend/src/app/`: **`46` đạt chuẩn `OnPush`, `24` thiếu `OnPush`**. Danh sách đầy đủ 24 tệp:

| Nhóm Module | Số lượng | Đường dẫn tệp chính xác (`frontend/src/app/...`) |
| :--- | :---: | :--- |
| **Root & Layouts** | **3** | `app.ts`, `layouts/admin-layout/admin-layout.ts`, `layouts/auth-layout/auth-layout.ts` |
| **Auth & Security Pages** | **3** | `features/auth/login/login.page.ts`, `features/auth/register/register.page.ts`, `features/forbidden/forbidden.page.ts` |
| **PMS & Subscription Features** | **6** | `features/housekeeping/housekeeping.page.ts`, `features/payments/payments.page.ts`, `features/policies/policies.page.ts`, `features/rates/rates.page.ts`, `features/reservations/reservations.page.ts` (`3,789` dòng), `features/subscriptions/subscriptions.page.ts` |
| **Public Booking Components** | **3** | `features/public-booking/components/curated-bento-grid/curated-bento-grid.component.ts`, `features/public-booking/components/hotelier-cta-banner/hotelier-cta-banner.component.ts`, `features/public-booking/components/trust-pillars/trust-pillars.component.ts` |
| **Shared Registry Components** | **9** | `shared/components/breadcrumb/breadcrumb.component.ts`, `shared/components/date-range-filter/date-range-filter.component.ts`, `shared/components/empty-state/empty-state.component.ts`, `shared/components/loading-spinner/loading-spinner.ts`, `shared/components/page-header/page-header.ts`, `shared/components/pagination/pagination.component.ts`, `shared/components/skeleton-table/skeleton-table.component.ts`, `shared/components/stat-card/stat-card.component.ts`, `shared/components/status-badge/status-badge.component.ts` |

*(Ghi chú: Toàn bộ `9/9` Shared component cốt lõi bị thiếu `OnPush` và nhiều component trong đó như `PaginationComponent`, `EmptyStateComponent`, `BreadcrumbComponent`, `DateRangeFilterComponent`, `BrandLogoComponent`, `SearchableSelectComponent`, `BookingDatePickerComponent` vẫn dùng decorator cũ `@Input()`/`@Output()` thay vì Angular Signals `input()`/`output()`.)*

### 3.2. Lạm dụng `.subscribe()` Thủ Công: `196` Lời Gọi (`132` Thiếu Cleanup Nội Dòng)

Quét toàn bộ `frontend/src/app/`: có **`196` lời gọi `.subscribe()`** trải trên `42` tệp — chỉ **`64` lượt** có `.pipe(takeUntilDestroyed(...))` / `takeUntil(...)` kề trước, còn lại **`132` lượt (67.3%) là `.subscribe()` trần không có teardown gắn liền**, tạo rủi ro memory leak và cập nhật state sau khi destroy (đặc biệt trên các luồng dài như `router.events`, `queryParamMap`, hoặc HTTP chưa hủy khi đổi chi nhánh nhanh):

- **Top tệp có `.subscribe()` trần (không có `takeUntilDestroyed`/`DestroyRef`/`ngOnDestroy` trong tệp hoặc thiếu pipe kề trước):**
  - `features/rooms/rooms.page.ts`: **`13/13` trần** (`L1444..L2049`, tệp không có cleanup ref).
  - `features/dashboard/dashboard.page.ts`: **`11/11` trần** (`L1210..L1378`, tệp không có cleanup ref).
  - `features/staff/staff.page.ts`: **`11/11` trần** (`L744..L1099`, tệp không có cleanup ref).
  - `features/public-booking/booking-status.page.ts`: **`8/13` trần** (`L1712, L2018, L2316, L2497, L2566, L2599, L2680, L2718`).
  - `features/properties/properties.page.ts`: **`7/7` trần** (`L656..L892`).
  - `features/reports/reports.page.ts`: **`7/7` trần** (`L627..L778`).
  - `features/staff/roles-management.component.ts`: **`7/7` trần** (`L841..L1114`).
  - `features/payments/components/refund-approval/refund-approval.component.ts`: **`6/6` trần** (`L1432..L1650`).
  - `features/reservations/reservations.page.ts`: **`5/20` trần** (`L2524, L2810, L2832, L3134, L3159`).
  - `features/admin-contracts/admin-contracts.page.ts`: **`5/5` trần** (`L445..L539`).
  - `features/auth/login/login.page.ts`: **`5/5` trần** (gồm `L444` subscribe trực tiếp vào `queryParamMap`!).
  - `features/admin-plans/admin-plans.page.ts`: **`4/4` trần**, `housekeeping.page.ts`: **`4/4` trần**, `room-types.page.ts`: **`4/4` trần**.
  - Các tệp có **`1–3` lượt trần** gồm `layouts/auth-layout/auth-layout.ts:L68` (`router.events` không teardown!), `core/services/auth.service.ts` (`3`), `audit-logs` (`3`), `context-selector.dialog.ts` (`3`), `guests` (`3`), `partner-register` (`3`), `register` (`3`), `subscriptions` (`3`), `ai-concierge-widget` (`3`), `policies` (`2/4`), `payments` (`1/7`), `confirm-email` (`1`), `phone-otp-modal` (`1`), `promotions` (`1`), `ai-concierge-chat` (`1`), `print-contract/invoice/voucher` (`mỗi file 1`).

### 3.3. Vi phạm Kiểu Dữ Liệu `any`: `113` Chú Thích + `2` `$any()` Template

- **`113` lần dùng `any` (phi-comment) trên `29` tệp:**
  - **Trong `core/services/` (`80` lượt trên `14` service — cần gõ DTO rõ ràng):** `public-booking.service.ts` (`17`), `payment.service.ts` (`10`), `social-auth.service.ts` (`9`), `reservation.service.ts` (`8`), `auth.service.ts` (`6`), `admin-plans.service.ts` (`5`), `print-documents.service.ts` (`5`), `admin-contracts.service.ts` (`4`), `ai.service.ts` (`3`), `property-management.service.ts` (`3`), `report.service.ts` (`3`), `subscription.service.ts` (`3`), `audit-log.service.ts` (`2`), `guest-account.service.ts` (`2`).
  - **Trong `core/models/` & `core/utils/` (`3` lượt):** `public-booking.model.ts` (`2`: L111, L119), `housekeeping-concurrency.util.ts` (`1`: L17).
  - **Trong Components & Pages (`30` lượt trên `12` tệp):** `booking-hold.page.ts` (`6`: L772, L800, L887, L898, L909, L1436), `register.page.ts` (`4`: L404, L436, L464, L494), `login.page.ts` (`3`), `phone-otp-modal.component.ts` (`3`), `policies.page.ts` (`3`), `rates.page.ts` (`3`), `audit-logs.page.ts` (`1`: L901), `housekeeping.page.ts` (`1`: L503), `booking-lookup.page.ts` (`1`: L735), `booking-status.page.ts` (`1`: L1905), `flash-deals-banner.component.ts` (`1`: L146), `guest-profile.page.ts` (`1`: L659), `booking-date-picker.component.ts` (`1`: L375).
- **`$any(...)` trong template (`2` lượt):** `popular-destinations.component.ts:L122` và `rates.page.ts:L130`.

### 3.4. Cô lập `HttpClient` Trong `core/services/`: **ĐẠT (0 Vi phạm Component)**
- Không có component hay layout nào inject `HttpClient` trực tiếp (`22` service trong `core/services/` đảm nhận toàn bộ, thông qua `authInterceptor`, `loadingInterceptor`, `errorInterceptor` ở `app.config.ts:L21`).
- **Lưu ý nhỏ:** `core/services/social-auth.service.ts:L117` gọi thẳng `fetch('https://www.googleapis.com/oauth2/v3/userinfo', ...)` — nên ghi nhận để đồng bộ timeout/cancellation/error handling qua `HttpClient` hoặc AbortController nếu cần.

### 3.5. Tái Sử Dụng `shared/` Registry: Mức Độ Áp Dụng Thấp & Lỗi Binding

| Shared Artifact (`frontend/src/app/shared/`) | Số Lần / Số Tệp Sử Dụng | Tình Trạng & Ghi Chú Tuân Thủ `AGENTS.md` §3 |
| :--- | :---: | :--- |
| `<app-empty-state>` | `21` thẻ / **`13` tệp** | Khá tốt, nhưng **3 chỗ truyền nhầm prop `icon="..."` thay vì `iconClass="..."`**: `audit-logs.page.ts:L179` (`icon="pi-history"`), `reservations.page.ts:L247` (`icon="pi pi-calendar"`), `reservations.page.ts:L565` (`icon="pi pi-building"`), khiến cả 3 fallback sai về `pi-inbox`. |
| `<app-pagination>` | `7` thẻ / **`7` tệp** | Tự viết phân trang ở các bảng khác; bản thân component thiếu `OnPush`, dùng `w-7 h-7`, `outline-none`. |
| `<app-page-header>` | `5` thẻ / **`5` tệp** | **Bị bỏ qua bởi phần lớn PMS/Governance** (`dashboard`, `reservations`, `housekeeping`, `payments`, `rates`, `policies`, `guests`, `staff`, `reports`, `admin-plans`, `admin-contracts`, `subscriptions` đều tự vẽ header riêng). |
| `<app-loading-spinner>` | `4` thẻ / **`4` tệp** | `properties`, `explore-search`, `room-types`, `rooms` — thiếu `OnPush`. |
| `<app-form-field>` | `13` thẻ / **`3` tệp** | Chỉ dùng ở `login`, `properties`, `booking-hold`. Toàn bộ form phức tạp còn lại tự viết HTML input + error riêng. |
| `<app-date-range-filter>` | `3` thẻ / **`3` tệp** | `audit-logs`, `reports`, `reservations` — thiếu `OnPush`. |
| `<app-photo-gallery-modal>` | `3` thẻ / **`3` tệp** | Chuẩn A11y (`OnPush`, `cdkTrapFocus`, Escape/Arrow, `prefers-reduced-motion`). |
| `<app-stat-card>` | `8` thẻ / **`2` tệp** | Chỉ `properties` và `room-types` dùng; `dashboard`, `housekeeping`, `reports`, `admin-plans`, `guest-profile` tự viết card KPI riêng (với `stat-card.component.ts` cũng đang dùng `backdrop-blur-sm` và thiếu `OnPush` + `tabular-nums`). |
| `<app-status-badge>` | `2` thẻ / **`2` tệp** | Chỉ `properties` và `rooms` dùng; phần lớn PMS/Admin tự chế badge `<span class="...">`; chứa lỗi dynamic Tailwind ``bg-${forcedColor}-500`` ở `L152`. |
| `<app-skeleton-table>` | `4` thẻ / **`2` tệp** | Chỉ `housekeeping` và `rates` dùng; các bảng khác dùng text `"Đang tải..."` hoặc để trống. |
| `<app-google-map-picker>` | `2` thẻ / **`2` tệp** | `partner-register`, `properties`. |
| `<app-searchable-select>` | `2` thẻ / **`1` tệp** | Chỉ `partner-register` dùng (`admin-contracts` lại bắt nhập tay `TenantId`!). |
| `<app-breadcrumb>` | `1` thẻ / **`1` tệp** | Chỉ `admin-layout`; vắng mặt ở Guest flows. |
| `<app-notification-bell>` | `1` thẻ / **`1` tệp** | `admin-layout` (chuẩn `OnPush`, signals, keyboard nav, fail-closed tenant filter). |
| `<app-loading-overlay>` | `1` thẻ / **`1` tệp** | `app.ts` (`OnPush`, `role="status"`, `tabular-nums`, `motion-reduce`). |
| `<app-room-detail-modal>` | `1` thẻ / **`1` tệp** | `booking.page.ts` (`OnPush`, `cdkTrapFocus`). |
| `<app-booking-date-picker>` | `1` thẻ / **`1` tệp** | `booking-filter-bar`. |
| `<app-ai-concierge-chat>` | `1` thẻ / **`1` tệp** | `guest-layout` (còn `ai-concierge-widget.component.ts` = **`0` lượt**, dead component). |
| **`businessDate` / `businessDateTime` pipe** | **`0` lượt** | Vi phạm đồng bộ múi giờ nghiệp vụ (`date:'dd/MM/yyyy'`, `slice:0:19`, và bug UTC ở `payments.page.ts:L42-56`). |

---

## Phần IV: Kiến Trúc Design Token Chuẩn Hóa Đề Xuất Cho 3 Shell

Để chấm dứt tình trạng `154` raw hex color, đứt gãy Indochine vs Indigo, và Dark Mode nửa vời, đề xuất kiến trúc **3-Layer CSS Custom Properties** kết hợp `tailwind.config.js` (`darkMode: ['selector', '[data-theme="dark"]']`) và PrimeNG Aura (`darkModeSelector: '[data-theme="dark"]'` trong `app.config.ts`).

### 4.1. Layer 1 & Layer 2: Tokens Nền Tảng (Typography, Motion, Touch, Z-Index, Surfaces)

```css
/* ==========================================================================
   LAYER 1 & 2: SEMANTIC CORE TOKENS (LIGHT DEFAULT + DARK MODE)
   ========================================================================== */
:root {
  /* Typography: Vietnamese-first Sans + Tabular Metrics */
  --font-sans: 'Be Vietnam Pro', 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Be Vietnam Pro', 'Plus Jakarta Sans', sans-serif; /* Loại bỏ Playfair Display trên UI vận hành */
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* Typography Scale (Floor 12px cho khả năng đọc dấu tiếng Việt) */
  --text-xs: 0.75rem;      /* 12px - Minimum label/badge */
  --text-sm: 0.875rem;     /* 14px - Dense table / operational UI */
  --text-base: 1rem;       /* 16px - Standard copy */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px - Page header */
  --text-3xl: 1.875rem;    /* 30px - Marketplace Hero */

  /* Touch, Radius & Motion Guardrails */
  --touch-min: 44px;       /* WCAG / Apple HIG target floor */
  --radius-sm: 0.5rem;     /* 8px */
  --radius-md: 0.75rem;    /* 12px */
  --radius-lg: 1rem;       /* 16px */
  --radius-xl: 1.5rem;     /* 24px */
  --duration-fast: 150ms;
  --duration-normal: 220ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Explicit Z-Index Layering Scale (Thay thế .fixed.inset-0 { z-index: 100 !important }) */
  --z-sticky: 20;
  --z-header: 30;
  --z-drawer-backdrop: 40;
  --z-drawer: 45;
  --z-modal-backdrop: 60;
  --z-modal: 65;
  --z-popover: 80;         /* PrimeNG appendTo="body" DatePicker/Select */
  --z-toast: 100;          /* AlertService / Toast cao hơn mọi modal */

  /* Semantic Light Surfaces & Text (WCAG AA >= 4.5:1) */
  --surface-canvas: #F8FAFC;
  --surface-card: #FFFFFF;
  --surface-subtle: #F1F5F9;
  --surface-elevated: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-muted: #475569;   /* Thay slate-400 (#94A3B8) để luôn đạt >= 4.5:1 trên nền sáng */
  --border-subtle: #E2E8F0;
  --border-strong: #CBD5E1;

  /* Semantic Operational Status Tokens */
  --status-success-bg: #ECFDF5; --status-success-fg: #065F46; --status-success-border: #A7F3D0;
  --status-warning-bg: #FFFBEB; --status-warning-fg: #92400E; --status-warning-border: #FDE68A;
  --status-danger-bg:  #FFF1F2; --status-danger-fg:  #9F1239; --status-danger-border:  #FECDD3;
  --status-info-bg:    #EFF6FF; --status-info-fg:    #1E40AF; --status-info-border:    #BFDBFE;
}

[data-theme="dark"] {
  --surface-canvas: #0B1120;
  --surface-card: #111827;
  --surface-subtle: #1E293B;
  --surface-elevated: #1F2937;
  --text-primary: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #94A3B8;   /* Đạt > 5.2:1 trên nền #111827 */
  --border-subtle: #1E293B;
  --border-strong: #334155;

  --status-success-bg: rgba(16, 185, 129, 0.16); --status-success-fg: #6EE7B7; --status-success-border: rgba(16, 185, 129, 0.35);
  --status-warning-bg: rgba(245, 158, 11, 0.16); --status-warning-fg: #FCD34D; --status-warning-border: rgba(245, 158, 11, 0.35);
  --status-danger-bg:  rgba(244, 63, 94, 0.16);  --status-danger-fg:  #FDA4AF; --status-danger-border:  rgba(244, 63, 94, 0.35);
  --status-info-bg:    rgba(59, 130, 246, 0.16); --status-info-fg:    #93C5FD; --status-info-border: rgba(59, 130, 246, 0.35);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 4.2. Layer 3: Shell Overrides Cho 3 Persona (`[data-shell="..."]`)

Gắn `[attr.data-shell]` trực tiếp trên root của từng Layout/Context (`GuestLayout` = `marketplace`, `AdminLayout` khi ngữ cảnh chi nhánh/chuỗi = `pms-ops`, `AdminLayout` khi ngữ cảnh Platform SuperAdmin = `governance`):

```css
/* ==========================================================================
   SHELL 1: PUBLIC BOOKING MARKETPLACE (Persona Guest — Indochine Thống Nhất)
   Hợp nhất GuestLayout, Home, Search, PropertyDetail, Hold, Lookup, Profile
   ========================================================================== */
[data-shell="marketplace"] {
  --surface-canvas: #FBF9F5;      /* Warm Linen thống nhất (thay thế cả #EFECE6 và bg-slate-50) */
  --surface-card: #FFFFFF;
  --surface-subtle: #F3EDE2;
  --text-primary: #142420;
  --text-secondary: #374B45;
  --border-subtle: #E6DFD3;

  --brand-primary: #0D2E28;       /* Heritage Teal — Header, Active Nav, Trust Accents */
  --brand-primary-fg: #FFFFFF;
  --brand-cta: #C05621;           /* Terracotta — Nút Đặt phòng / Tìm phòng / Thanh toán chính */
  --brand-cta-hover: #9C4215;     /* Đảm bảo contrast >= 5.1:1 với chữ #FFFFFF */
  --brand-accent: #B45309;        /* Warm Gold nhấn thành viên VIP */
  --focus-ring: #0D2E28;
}
[data-theme="dark"][data-shell="marketplace"],
[data-theme="dark"] [data-shell="marketplace"] {
  --surface-canvas: #0E1715;      /* Deep Indochine Night — không còn mảng trắng chói */
  --surface-card: #15221F;
  --surface-subtle: #1D2E2A;
  --text-primary: #F5F2EB;
  --text-secondary: #CBD5E1;
  --border-subtle: #283D38;
  --brand-primary: #2DD4BF;
  --brand-primary-fg: #0B1916;
  --brand-cta: #EA580C;
  --focus-ring: #2DD4BF;
}

/* ==========================================================================
   SHELL 2: PMS NIGHT/DAY OPERATIONS CONSOLE (Persona Property Staff)
   Dashboard chi nhánh/chuỗi, Sơ đồ phòng, Lễ tân, Buồng phòng, Thu ngân, Giá
   ========================================================================== */
[data-shell="pms-ops"] {
  --surface-canvas: #F8FAFC;
  --surface-card: #FFFFFF;
  --surface-subtle: #F1F5F9;

  --brand-primary: #059669;       /* Operational Emerald */
  --brand-primary-hover: #047857;
  --brand-primary-fg: #FFFFFF;
  --focus-ring: #059669;

  /* Semantic Room Lifecycle Tokens (Thay thế dynamic bg-${color}-500 ở StatusBadge) */
  --room-clean-bg: #ECFDF5;     --room-clean-fg: #065F46;
  --room-dirty-bg: #FFFBEB;     --room-dirty-fg: #92400E;
  --room-cleaning-bg: #EFF6FF;  --room-cleaning-fg: #1E40AF;
  --room-occupied-bg: #EEF2FF;  --room-occupied-fg: #3730A3;
  --room-oos-bg: #FFF1F2;       --room-oos-fg: #9F1239;
}
[data-theme="dark"][data-shell="pms-ops"],
[data-theme="dark"] [data-shell="pms-ops"] {
  --surface-canvas: #0B1120;      /* Ergonomic Night Shift Mode cho Lễ tân ca đêm */
  --surface-card: #111827;
  --surface-subtle: #1E293B;
  --brand-primary: #10B981;
  --brand-primary-hover: #34D399;
  --brand-primary-fg: #052E16;
}

/* ==========================================================================
   SHELL 3: PLATFORM GOVERNANCE ADMIN (Persona SuperAdmin)
   Quản trị Gói cước SaaS, Hợp đồng Tenant, Audit Logs Toàn nền tảng, SRE
   ========================================================================== */
[data-shell="governance"] {
  --surface-canvas: #F8FAFC;
  --surface-card: #FFFFFF;
  --surface-subtle: #EEF2FF;

  --brand-primary: #1E3A5F;       /* Executive Governance Navy */
  --brand-primary-hover: #172E4D;
  --brand-primary-fg: #FFFFFF;
  --brand-accent: #4338CA;        /* Trust Indigo cho biểu đồ/bộ lọc/link phân quyền */
  --focus-ring: #4338CA;
}
[data-theme="dark"][data-shell="governance"],
[data-theme="dark"] [data-shell="governance"] {
  --surface-canvas: #090D16;
  --surface-card: #111827;
  --surface-subtle: #1E2538;
  --brand-primary: #3B82F6;
  --brand-primary-hover: #60A5FA;
  --brand-primary-fg: #FFFFFF;
  --brand-accent: #818CF8;
}
```

### 4.3. Mapping với Tailwind v3 & PrimeNG Aura (`app.config.ts` + `tailwind.config.js`)
1. **`app.config.ts`:** Đổi `darkModeSelector: false` -> `darkModeSelector: '[data-theme="dark"]'` và nối semantic tokens của PrimeNG Aura với `--brand-primary`, `--surface-card`.
2. **`tailwind.config.js`:** Khai báo `darkMode: ['selector', '[data-theme="dark"]']`, ánh xạ `colors.brand.DEFAULT = 'var(--brand-primary)'`, `colors.cta.DEFAULT = 'var(--brand-cta)'`, `colors.surface.canvas = 'var(--surface-canvas)'`, `colors.surface.card = 'var(--surface-card)'` để component viết class sạch (`bg-surface-card text-text-primary border-border-subtle`) thay cho `154` hex cứng.
3. **Class chuẩn hóa bắt buộc dùng lại:** `.num-tabular { font-variant-numeric: tabular-nums; }`, `.touch-target { min-width: 44px; min-height: 44px; }`, `.focus-ring { @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2; }`.

---

## Phần V: Lộ Trình Khắc Phục Ưu Tiên (`Wave P0 -> P3`)

1. **Wave P0 (Khẩn cấp — Tin cậy, An toàn & A11y Cốt Lõi):**
   - Gỡ/ẩn sau cờ `!environment.production`: Demo Login buttons (`login.page.ts`), VNPay sandbox test card/OTP (`booking-status.page.ts`), giả lập SRE (`ops-readiness.page.ts` chuyển sang dữ liệu thật hoặc đánh dấu rõ Sandbox Demo Mode tách biệt Production Nav).
   - Xử lý dữ liệu giả/sai trên chứng từ & public UI: sửa `print-invoice.page.ts` (chỉ đóng dấu đã thanh toán khi `balanceDue <= 0`), sửa `print-contract.page.ts` (bỏ hash fallback giả `'SHA256:...'`), bỏ pre-fill PII & `Math.random()` signature ở `admin-contracts.page.ts`, sửa link `"Quên mật khẩu?"` ở `login.page.ts:L106`, sửa bug UTC vs UTC+7 ở `payments.page.ts:L42-56`, chuyển Hero/Flash Deals/Promotions sang API thực hoặc empty-state trung thực.
   - Đóng các lỗ hổng bàn phím (`14` `<div>` clickable tương tác chuyển thành `<button>` kèm `5` backdrop overlay hỗ trợ Escape, thêm `cdkTrapFocus` + `role="dialog"` + `aria-modal="true"` cho `17` tệp modal/drawer/panel còn thiếu, thêm `aria-label` cho `55` nút icon-only, thêm skip-link cho `admin-layout.ts` & `auth-layout.ts`).
2. **Wave P1 (Hệ Thống Token, Shared UI & Angular 22 Compliance):**
   - Triển khai 3-Layer CSS Tokens (Phần IV), bật `darkModeSelector: '[data-theme="dark"]'` ở PrimeNG & Tailwind, gỡ hack `.fixed.inset-0 { z-index: 100 !important }` trong `styles.css:L628`, dẹp `Material+Icons` & `Playfair Display`, bổ sung `tabular-nums` cho giá/KPI/timer và tăng cỡ chữ tối thiểu lên `12px`.
   - Đẩy `OnPush` cho `24` component còn lại (ưu tiên `9` shared component & `app.ts`/`admin-layout.ts`/`reservations.page.ts`), gắn `takeUntilDestroyed` cho `132` `.subscribe()` trần, loại `any` khỏi DTO & sửa 3 chỗ truyền sai `icon` trên `<app-empty-state>`.
   - Chuẩn hóa kích thước cảm ứng `>= 44px` cho `262` nút nhỏ (`PaginationComponent`, `HousekeepingPage`, `BookingFilterBarComponent`, `BookingStatusPage` star rating) và tách `ai-concierge-widget.component.ts` chết.
3. **Wave P2 (Charts, `<p-table>`, Responsive & Route Hygiene):**
   - Cài thư viện Chart + xây `<app-chart-card>` thay CSS `<div>` bars ở `reports`, `dashboard`, `subscriptions` (đầy đủ loading/empty/error/table fallback).
   - Chuẩn hóa `29` bảng thô sang `<p-table>` hoặc table wrapper có `aria-sort` + mobile card fallback; áp `cdk-virtual-scroll` cho Gantt/Timeline/Audit Logs; bổ sung `width`/`height` + `loading="lazy"` cho `23` `<img>` & thay `75` URL Unsplash cứng.
   - Hợp nhất cây route trùng (`/auth/*`, `/admin/*`), tách rạch ròi `[data-shell="pms-ops"]` vs `[data-shell="governance"]`, bổ sung `UnsavedChangesGuard`.
4. **Wave P3 (Độ Mịn Trải Nghiệm & Tự Động Hóa Kiểm Định):**
   - Thay toàn bộ `77+` dòng emoji ở `13` tệp bằng PrimeIcons/SVG thống nhất; chuyển `210` `[(ngModel)]` dần sang Typed Reactive Forms + `<app-form-field>`; thêm `@media (prefers-reduced-motion: reduce)` toàn cục và bổ sung unit/a11y tests cho `shared/`.

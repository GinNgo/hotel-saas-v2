# Báo Cáo Đánh Giá Toàn Diện 360° — Khách Hàng B2B Cơ Sở Lưu Trú (Property / Tenant PMS)

- **Phạm vi kiểm toán:** Góc nhìn Khách hàng B2B Cơ sở lưu trú (Tenant Owner, Property Manager, Receptionist, Housekeeper) trên nhánh `develop` tại commit `c297b58`.
- **Chuẩn tham chiếu:**
  - Nghiệp vụ & Kiến trúc nội bộ: `docs/srs/02-actors-personas.md`, `03-user-stories.md`, `04-business-processes.md`, `05-business-rules.md`, `docs/sdd/07-ui-ux-design.md`, `PROJECT.md`, `AGENTS.md`.
  - Tiêu chuẩn giao diện & trải nghiệm: **UI/UX Pro Max — 10 Priority Categories** (`Accessibility`, `Touch & Interaction`, `Performance`, `Style Selection`, `Layout & Responsive`, `Typography & Color`, `Animation`, `Forms & Feedback`, `Navigation Patterns`, `Charts & Data`).
- **Nguyên tắc kiểm chứng:** Mọi phát hiện dưới đây đều đã được đối chiếu trực tiếp tại mã nguồn hiện hành trên `develop` (`c297b58`), không sao chép từ các báo cáo cũ.

---

## 1. Tóm Tắt Điều Hành & Điểm Sẵn Sàng (Readiness Scorecard)

### 1.1 Điểm Sẵn Sàng Theo Phân Hệ PMS

| Phân hệ PMS | Phạm vi Route / Module chính | Điểm (/100) | Trạng thái tổng quan | Điểm nghẽn cốt lõi |
| :--- | :--- | :---: | :--- | :--- |
| **1. Onboarding, Chi nhánh & Chính sách** | `/partner-register`, `/properties`, `/policies`, `/ops-readiness` | **52 / 100** | Cần gia cố | Thiếu toggle `IsPublished`; `CreateProperty` ném 500 khi trùng mã/slug; hardcode `VN-SG` khi sửa; thiếu VAT%/ServiceFee%/POL-C03; trang SRE giả lập lộ vào menu B2B. |
| **2. Catalog, Biểu giá, Khuyến mãi & AI** | `/room-types`, `/rates`, `Promotion`, `AiController` | **48 / 100** | Thiếu hụt lớn | `Promotion` B2B = 0% (B2C `/booking/deals` trả mảng tĩnh); `CreateRoomTypeRate` lỗi multi-overlap & bỏ rơi tail; AI Pricing thiếu endpoint `apply`, thiếu UI PMS, lộ `[AllowAnonymous]`. |
| **3. Front-Desk & Stay Lifecycle** | `/rooms`, `/reservations`, Check-in/out, Folio, Print, SmartLock | **55 / 100** | Đứt gãy liên thông | Walk-in trên `/rooms` để đơn ở `Confirmed` (không check-in); Check-out không tạo `Invoice`; `/print/invoice/:id` lệch schema DTO gây crash & không có nút mở; thiếu Night Audit/No-Show; SmartLock M5 thiếu log/UI/API. |
| **4. Buồng phòng (Housekeeping)** | `/housekeeping`, `HousekeepingTask` | **38 / 100** | Rất sơ khai | `HousekeepingTask` tồn tại trong Domain/Migration nhưng **không có trong `DbContext`**; chỉ đổi trạng thái phòng vật lý; không sinh task khi check-out (`BR-HK01`); nút mobile <44px. |
| **5. Thu ngân, Hoàn tiền D23 & Báo cáo** | `/payments`, `refund-approval`, `/reports`, `/subscriptions` | **60 / 100** | Khá tốt ở lõi | Quy trình D23 3 bước & Shift Report tốt, nhưng hoàn tiền VNPay làm thủ công; `ReportsController` cộng nhầm tiền hoàn vào doanh thu & bỏ qua booking `Hourly`; `upgrade` gói không qua thanh toán, không chặn quota. |
| **6. Khách hàng CRM, Reviews & Nhân sự/RBAC** | `/guests`, `GuestReview`, `/staff`, `/roles`, `/audit-logs` | **44 / 100** | **Rủi ro P0** | **`StaffService` lưu giả lập System/Custom Role vào `localStorage`**, làm Owner tưởng đã sửa quyền nhưng DB không đổi; `CreateStaffMember` có mật khẩu mặc định `Staff@123456`; `UpdateGuestNotes` ghi đè JSON snapshot; **B2B Review Management = 0%**. |
| **TỔNG HỢP B2B PROPERTY** | Toàn bộ cổng vận hành PMS | **50 / 100** | **Chưa sẵn sàng Production** | Cần xử lý dứt điểm 7 lỗi **P0** (đặc biệt RBAC bypass, Walk-in FSM, Print Invoice crash, Ghi đè Notes, Doanh thu/Quota) trước khi onboard khách sạn thật. |

### 1.2 Điểm Sẵn Sàng Theo Chân Dung Người Dùng (Personas)

| Persona | Mức sẵn sàng | Trải nghiệm thực tế khi dùng hệ thống hiện tại |
| :--- | :---: | :--- |
| **Tenant Owner (Chủ chuỗi / Chủ khách sạn)** | **52 / 100** | Theo dõi được KPI chuỗi đa chi nhánh, Audit Logs chi tiết và gói cước. Tuy nhiên bị đánh lừa khi sửa phân quyền Role (`localStorage` giả lập), không tạo được mã khuyến mãi cho chuỗi, không xem/trả lời được đánh giá của khách (`GuestReview`), không bật/tắt xuất bản chi nhánh (`IsPublished`), và thấy mục "Kiểm định SRE" kỹ thuật không liên quan trong menu. |
| **Property Manager (Quản lý cơ sở)** | **56 / 100** | Phê duyệt hoàn tiền D23 rõ ràng và cấu hình được phụ thu/giờ nhận trả. Nhưng không thể giao việc/kiểm tra `HousekeepingTask`, không dùng được AI Dynamic Pricing trên `/rates`, không đánh dấu `NoShow` hay chạy Night Audit, và xem báo cáo doanh thu bị sai lệch với đơn `Hourly` hoặc đơn có hoàn tiền. |
| **Receptionist (Lễ tân / Thu ngân ca đêm & ngày)** | **58 / 100** | Có sơ đồ phòng (Rack) + Timeline Gantt 7/14 ngày + tra cứu Folio + VietQR/Phiếu thu. Nhưng thao tác bị xé lẻ across 3 màn hình (`/rooms`, `/reservations`, `/payments`); Walk-in tại `/rooms` tạo đơn `Confirmed` dù phòng thành `Occupied` gây tắc lúc trả phòng; tìm kiếm đặt phòng không debounce; thiếu phím tắt; Dark Mode còn nhiều vùng nền sáng chói (`bg-rose-50/70`, `text-slate-400`); không có nút in `/print/invoice/:id`. |
| **Housekeeper (Nhân viên buồng phòng)** | **35 / 100** | Xem được phòng theo tầng với polling 10s. Nhưng giao diện web trên màn hình điện thoại `375px` dùng button nhỏ `~26px` (không đạt `44×44px`), khoảng cách nút `6px` (`< 8px`), không nhận/giao task cụ thể (`BR-HK01..06`), không thấy phòng nào khách sắp check-in gấp để ưu tiên dọn trước. |

---

## 2. Đánh Giá Chuẩn UI/UX Pro Max (10 Priority Categories) & Chuẩn Angular 22 (`AGENTS.md`)

### 2.1 Kiểm Toán Theo 10 Nhóm Ưu Tiên Của UI/UX Pro Max

| # | Category (Mức độ) | Trạng thái | Vi phạm & Bằng chứng cụ thể trong mã nguồn B2B |
| :-: | :--- | :---: | :--- |
| **1** | **Accessibility** *(CRITICAL)* | **Đạt một phần** | - **Nút chỉ có icon thiếu `aria-label`**: các nút bảo trì/dọn lại trong `housekeeping.page.ts:340-394` (`title="..."`, không có `aria-label`); nút sửa phòng trên Rack `rooms.page.ts:312-319` không có `aria-label`; nút đóng modal trong `reservations.page.ts:1143-1149, 1613-1619, 1689-1695, 1812-1818` thiếu `aria-label`.<br>- **Thiếu Focus Trap & ESC key**: Chỉ `refund-approval.component.ts:562-564` dùng `cdkTrapFocus` + `(keydown.escape)` và `audit-logs.page.ts:688-693` dùng `@HostListener('document:keydown.escape')`. Các modal trọng yếu của Lễ tân (`reservations.page.ts`, `rooms.page.ts`, `payments.page.ts`, `staff.page.ts`) **không khóa focus và không đóng bằng `Esc`**.<br>- **Thiếu skip-link & `color-not-only`**: `admin-layout.ts:36-528` chưa có skip-to-content link; một số trạng thái dựa nhiều vào chấm màu (`rooms.page.ts:320-325` chỉ hiện chấm tròn 10px trên góc thẻ). |
| **2** | **Touch & Interaction** *(CRITICAL)* | **Không đạt** | - **Nút bấm dưới `44×44px`**: `housekeeping.page.ts:332-403` dùng `px-2.5 py-1.5 text-[11px]` (~26px cao) với `gap-1.5` (6px < chuẩn 8px); `reservations.page.ts:334-365` dùng `px-2.5 py-1` (~24px); `admin-layout.ts:414-421` nút mở menu mobile `p-1.5 sm:p-2` (~28–36px) và nút toggle theme `w-9 h-9` (36px) tại `admin-layout.ts:469`.<br>- **Hover-only trap**: Nút sửa phòng trên thẻ Rack `rooms.page.ts:312-319` dùng `opacity-0 group-hover:opacity-100 w-5 h-5` (`20×20px` + ẩn hoàn toàn trên tablet/mobile cảm ứng!). Tương tự nhãn `+ Thêm` tại `rooms.page.ts:957` dùng `opacity-0 group-hover:opacity-100`.<br>- **Native `confirm()`**: `subscriptions.page.ts:296` gọi `window.confirm(...)` thay vì dialog/AlertService chuẩn. |
| **3** | **Performance** *(HIGH)* | **Trung bình** | - **Tìm kiếm không debounce**: `reservations.page.ts:179, 2576-2581` gọi `this.loadReservations()` ngay lập tức ở mỗi phím gõ (`onSearchInput`) — gây spam API khi lễ tân gõ tên khách hoặc mã đặt phòng.<br>- **Thiếu `ChangeDetectionStrategy.OnPush`**: 6/17 trang `.page.ts` B2B được kiểm toán thiếu `OnPush` (`housekeeping.page.ts:26`, `payments.page.ts:73`, `policies.page.ts:22`, `rates.page.ts:40`, `reservations.page.ts:79`, `subscriptions.page.ts:7`), làm tăng chi phí change detection trên bảng dài và timer polling 10s.<br>- **Dashboard tải dữ liệu thừa & giới hạn tĩnh**: `dashboard.page.ts:1337, 1367` tải `pageSize: 100` phòng và `pageSize: 20` reservations về client để tự đếm KPI thay vì gọi API aggregate. |
| **4** | **Style Selection** *(HIGH)* | **Khá tốt** | - **Vi phạm `no-emoji-icons`**: `properties.page.ts:579-580` dùng emoji `'🏨 Khách sạn (Hotel)'`, `'🏖️ Resort nghỉ dưỡng'`; `rooms.page.ts:1554-1559` dùng `'⚡ Theo giờ'`, `'🌙 Qua đêm'`, `'📅 Theo ngày'` thay vì PrimeIcons SVG đồng bộ.<br>- **Thiếu nhất quán component dùng chung**: `<app-page-header>` mới dùng ở 5 trang (`audit-logs`, `ops-readiness`, `properties`, `room-types`, `rooms`), còn 10 màn hình B2B khác tự viết header.<br>- **Dark Mode chưa đồng bộ hoàn chỉnh**: `styles.css:663-774` override `.bg-white`, `.bg-emerald-50`, `.bg-amber-50`, nhưng **bỏ sót** nhiều class opacity của Tailwind như `bg-rose-50/70` (`reservations.page.ts:846, 1029`), `bg-sky-50/40` (`housekeeping.page.ts:159`), `bg-emerald-50/40`, `text-rose-800/900`, `text-sky-800/900`. |
| **5** | **Layout & Responsive** *(HIGH)* | **Đạt một phần** | - **Bảng thiếu Card view trên mobile `375px`**: `refund-approval.component.ts:471` và `payments.page.ts:985` làm tốt Card view cho mobile; ngược lại `reservations.page.ts:254`, `guests.page.ts`, `staff.page.ts`, `reports.page.ts:296`, `audit-logs.page.ts:186` chỉ bọc `overflow-x-auto`, buộc người dùng mobile kéo ngang bảng nhiều cột.<br>- **Modals & Topbar**: `admin-layout.ts:437` xử lý cắt chữ `max-w-[200px]` tốt trên mobile, nhưng thanh action topbar trang `reports.page.ts:34-66` nhồi 7 nút liền nhau (3 nút Export + 4 nút Tuần/Tháng/Quý/Năm) làm rớt dòng lộn xộn. |
| **6** | **Typography & Color** *(MEDIUM)* | **Cần chỉnh** | - **Chữ quá nhỏ (<12px)**: Toàn bộ giao diện B2B lạm dụng `text-[10px]` và `text-[11px]` cho cả nội dung thao tác, label input (`reservations.page.ts:967, 978, 989`, `payments.page.ts:726, 741`), cảnh báo công nợ và badge trạng thái.<br>- **Độ tương phản Dark Mode**: `--text-light: #64748b` trên `--surface-card: #111827` (`styles.css:97, 104`) và `.text-slate-400` mapped sang `--text-muted: #94a3b8` ổn cho label phụ, nhưng các class không có trong rule override như `text-emerald-600`, `text-amber-600`, `text-rose-600`, `text-slate-500` trên nền pastel chưa được override trong Dark Mode gây chói hoặc giảm contrast ca đêm.<br>- **Numeric alignment**: Một số nơi đã dùng `tabular-nums` (`refund-approval.component.ts:411-427`), nhưng bảng `reservations.page.ts:317` và `payments.page.ts:1058` chưa áp dụng `tabular-nums`. |
| **7** | **Animation** *(MEDIUM)* | **Tốt** | - `styles.css` có quy tắc `prefers-reduced-motion`, chuyển cảnh modal nhẹ (`duration-150`, `duration-200`). Tuy nhiên `animate-pulse` trên chấm Online (`admin-layout.ts:402`) và `Cleaning` dot (`housekeeping.page.ts:135, 913`) chạy liên tục gây phân tâm nếu có nhiều phòng đang dọn. |
| **8** | **Forms & Feedback** *(MEDIUM)* | **Trung bình** | - Form `rates.page.ts:983-1022` chỉ tổng hợp lỗi khi bấm Submit (`validateForm()`), thiếu inline validation khi blur từng trường.<br>- `CreatePropertyCommand.cs:63, 73` và `UpdateRoleCommand.cs:58` ném exception không khớp `ExceptionHandlingMiddleware`, trả về toast `"Đã xảy ra lỗi hệ thống"` (500) thay vì feedback rõ ràng tại field.<br>- `CreateReservation` trên `reservations.page.ts:1330-1340` bắt lễ tân bấm thủ công nút `"Kiểm tra & Tính giá"` sau mỗi lần đổi giờ/loại phòng thay vì tự debounce tính giá. |
| **9** | **Navigation Patterns** *(HIGH)* | **Chưa tối ưu** | - **Luồng lễ tân bị phân mảnh**: Minibar/Dịch vụ nằm ở `rooms.page.ts`, Check-in/Check-out nằm ở `reservations.page.ts` (và Room Drawer không cho Check-out thu tiền trực tiếp), Hoàn tiền & Xuất phiếu thu nằm ở `payments.page.ts`, còn `/print/invoice/:id` **không có bất kỳ nút/link điều hướng nào** trong toàn bộ B2B PMS!<br>- **Menu điều hướng sai đối tượng**: `admin-layout.ts:249-257` hiện `"Kiểm định & Giám sát SRE"` cho cả Hotel Owner/Manager. |
| **10** | **Charts & Data** *(LOW)* | **Sơ khai** | - `reports.page.ts:400-415, 549-562` vẽ thanh bar doanh thu thủ công bằng `div` HTML thuần, chỉ cắt `.slice(-10)` ngày cuối dù người dùng chọn 30 ngày hoặc cả năm; không có tooltip chi tiết khi rê/chạm, không có so sánh cùng kỳ (YoY/MoM), không có chart thư viện thực thụ. |

### 2.2 Kiểm Toán Tuân Thủ `AGENTS.md` (Angular 22 Standalone Signals)

- **Đạt:** 100% Standalone components; **0 vi phạm `HttpClient`** trong `frontend/src/app/features/` (đều tách qua `core/services/`).
- **Chưa đạt:**
  - `6/17` trang `.page.ts` B2B được kiểm toán thiếu `ChangeDetectionStrategy.OnPush`: `housekeeping.page.ts:26`, `payments.page.ts:73`, `policies.page.ts:22`, `rates.page.ts:40`, `reservations.page.ts:79`, `subscriptions.page.ts:7`.
  - Pipe `businessDate` bắt buộc tại `AGENTS.md` §3.2 **không được dùng ở bất kỳ trang B2B nào** (`0` kết quả grep trên `features/`); các trang tự viết hàm format `formatUtcTime`, `formatVietnamDate`, `formatUtcDateTimeString` không đồng nhất (thậm chí `payments.page.ts:53` ép hiển thị chữ `"UTC"` dù cột bảng ghi `"Thời Gian Tạo (Giờ VN)"` tại `payments.page.ts:1028`!).
  - `<app-page-header>` mới áp dụng ở 5 trang; còn lại tự code header.

---

## 3. Phân Tích Chi Tiết Các Lỗ Hổng & Lỗi UX Theo 6 Khu Vực (Phân Cấp `P0 / P1 / P2 / P3`)

> **Quy ước mức độ ưu tiên:**
> - **P0 (Blocker):** Lỗi bảo mật, sai lệch dữ liệu tài chính/pháp lý, giả lập persistence, crash runtime, hoặc làm gãy luồng nghiệp vụ cốt lõi.
> - **P1 (Critical):** Thiếu tính năng B2B trọng yếu theo SRS/Domain, sai logic tính toán/phụ thu/báo cáo, UX gây kẹt vận hành hàng ngày.
> - **P2 (Major):** Bất cập trải nghiệm ca đêm/mobile/hiệu suất, thiếu tự động hóa và thông báo hữu ích, không nhất quán dữ liệu phụ.
> - **P3 (Minor):** Cải tiến polish, emoji thành SVG icon, hoàn thiện biểu đồ và phím tắt phụ trợ.

---

### Khu Vực 1: Partner Onboarding, Chi Nhánh & Readiness

#### [P0-01] Trang SRE kỹ thuật giả lập (`/ops-readiness`) hiển thị thẳng trong menu của Chủ/Quản lý khách sạn
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts:248-257` & `613-621`: Điều kiện `@if (isOwnerOrManager())` hiển thị menu `"Kiểm định & Giám sát SRE"` (`/ops-readiness`) cho bất kỳ Owner, Manager, hoặc staff có `STAFF:Read`/`ROLES:Read`.
  - `frontend/src/app/app.routes.ts:237-241, 350-354`: Route `ops-readiness` mở cho tenant user có quyền `SETTINGS`.
  - `frontend/src/app/features/ops-readiness/ops-readiness.page.ts:7-13, 41-95`: Toàn bộ KPI "Isolation Test", "SignalR Load Test", "VNPay IPN Concurrency Storm", "CI/CD VPS & Observability (PLG)" gọi các hàm mô phỏng cục bộ (`runAllIsolationAssertions`, `simulateLoadTestRun`, `generateStructuredLogEntries`).
- **Nguyên nhân gốc rễ:** Công cụ kiểm thử/demo kỹ thuật dành cho DevOps/Platform nội bộ được gắn nhầm vào nhóm menu quản trị của Tenant Hotel.
- **Tác động vận hành:** Khách hàng B2B (Chủ khách sạn/Quản lý) nhìn thấy dữ liệu load-test giả lập (p95 latency, Terraform, Prometheus/Loki) trong phần mềm vận hành hàng ngày, gây hoang mang, mất uy tín sản phẩm và nhầm lẫn giữa dữ liệu thật vs mô phỏng.
- **Đề xuất khắc phục:** Gỡ `/ops-readiness` khỏi `admin-layout.ts` đối với Tenant B2B; chuyển về `platformAdminGuard` (chỉ SuperAdmin dev/ops nội bộ) hoặc thay bằng màn hình **"Checklist Sẵn sàng Đón khách" (Go-Live Readiness)** thực tế (đã cấu hình STK VietQR, đã có >=1 hạng phòng & bảng giá active, đã có biểu phụ thu 24/24, đã bật `IsPublished`).

#### [P1-01] Thiếu hoàn toàn nút Bật/Tắt xuất bản (`IsPublished`) & rào chắn thông tin tối thiểu khi tạo chi nhánh
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Domain/Entities/Property.cs:146-150`: Docstring ghi rõ `"Default is false (safety guard: no auto-publishing)"` và `IsPublished` khởi tạo `= false`.
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs:105` & `RegisterPartnerCommandHandler.cs:197`: Cả hai đều ép `IsPublished = true` ngay khi vừa tạo!
  - `backend/src/HotelSaas.Application/Properties/Commands/UpdateProperty/UpdatePropertyCommand.cs:31, 83`: Có `bool IsPublished = true`, nhưng trong toàn bộ UI `frontend/src/app/features/properties/properties.page.ts` (grep `IsPublished|isPublished` = 0 kết quả) **không có nút toggle hoặc trường chỉnh sửa `IsPublished`**!
- **Nguyên nhân gốc rễ:** Backend bỏ qua safety guard `IsPublished = false` của Domain để tiện seed nhanh, trong khi Frontend `/properties` chỉ cho sửa `isActive` mà quên render switch `IsPublished`.
- **Tác động vận hành:** Chủ khách sạn mới tạo chi nhánh chưa kịp sửa ảnh, giá, hoặc tiện nghi thật (chỉ có 4 phòng mẫu starter inventory) đã tự động lên sàn B2C nhận đặt phòng; ngược lại khi muốn tạm ẩn cơ sở khỏi B2C để sửa chữa nhưng vẫn giữ PMS hoạt động nội bộ (`isActive = true, isPublished = false`) thì không có cách nào tắt từ giao diện.
- **Đề xuất khắc phục:** Khởi tạo `IsPublished = false` cho chi nhánh mới (hoặc thêm switch kiểm duyệt ngay trên card `/properties`), bổ sung điều kiện gating tối thiểu trước khi cho phép Publish (có ảnh thật, ít nhất 1 phòng Clean, cấu hình VietQR/Surcharge đầy đủ).

#### [P1-02] Lỗi HTTP 500 giả mạo khi tạo chi nhánh trùng Mã/Slug & thiếu trường thông tin quan trọng trên `/properties`
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs:2, 63, 73`: Import `using System.ComponentModel.DataAnnotations;` và ném `DataAnnotations.ValidationException` khi trùng `Code` hoặc `Slug`.
  - `backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs:57, 86`: Middleware chỉ bắt `HotelSaas.Application.Common.Exceptions.ValidationException`, nên `DataAnnotations.ValidationException` rơi vào `_ => Status500InternalServerError ("ERR_SYSTEM")`.
  - `frontend/src/app/features/properties/properties.page.ts:744`: Khi mở modal chỉnh sửa chi nhánh (`openEditModal`), code **hardcode `provinceCode: 'VN-SG'`** thay vì map từ địa chỉ/tỉnh của cơ sở; đồng thời form tạo/sửa trên `/properties` không có trường `PhoneNumber`, `Email`, `StarRating`, `TaxRatePercent`, `ServiceFeeRatePercent` (dù Entity `Property.cs:72, 99, 104` và `CreatePropertyCommand.cs:21-24` đều có).
- **Nguyên nhân gốc rễ:** Nhầm namespace `ValidationException` trong handler và form `/properties` chưa đồng bộ với `Property` DTO/Entity.
- **Tác động vận hành:** Owner tạo chi nhánh bị trùng slug nhận thông báo lỗi hệ thống 500 chung chung; khi mở sửa chi nhánh ở Hà Nội/Đà Nẵng lại bị gắn mặc định tỉnh `VN-SG` (TP.HCM).
- **Đề xuất khắc phục:** Đổi sang `ConflictException`/`BadRequestException` trong `CreatePropertyCommand.cs`; bổ sung đủ `PhoneNumber`, `Email`, `StarRating`, `ProvinceCode` đúng dữ liệu thực vào `/properties`.

#### [P1-03] Lệch chuẩn danh mục hành chính giữa B2B Partner Register (63 tỉnh) và B2C Marketplace (34 tỉnh) + Lệch giờ Check-in mặc định (`12:00` vs `14:00`)
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/auth/partner-register/partner-register.page.ts:319`: Nhãn ghi `"Tỉnh / Thành phố (63 đơn vị)"` và gọi API đọc `backend/src/HotelSaas.Infrastructure/Resources/Locations/DMTinhThanh_2Cap.csv:1-64` (63 tỉnh thành cũ, vd Hà Giang, Quảng Nam, Bình Thuận...).
  - `frontend/src/app/core/data/vietnam-provinces.data.ts:21` & `backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs:48`: B2C Showcase và Seeder dùng **34 tỉnh/trọng điểm du lịch** (`VIETNAM_34_PROVINCES`).
  - `backend/src/HotelSaas.Domain/Entities/Property.cs:77` & `frontend/src/app/features/policies/policies.page.ts:670` đặt `CheckInTime` mặc định `12:00`, trong khi `RegisterPartnerCommandHandler.cs:190` và `partner-register.page.ts:478` và `AiController.cs:393` và `PrintTemplateConfig.cs:79` đặt **`14:00`**. Còn `CreatePropertyCommand.cs:84-109` không set `CheckInTime`, nên chi nhánh tạo mới từ `/properties` lại lấy `12:00` từ `Property.cs`!
- **Nguyên nhân gốc rễ:** Không đồng bộ nguồn dữ liệu tỉnh/thành và hằng số mặc định giữa onboarding B2B, tạo chi nhánh con, chính sách và AI/Print.
- **Tác động vận hành:** Chi nhánh 1 của Owner mặc định nhận phòng `14:00`, nhưng chi nhánh 2 tạo trên `/properties` lại thành `12:00`, làm xung đột biểu phụ thu nhận phòng sớm (`09:00-14:00` vẫn bị seed bởi `TrySeedStarterInventory` tại `CreatePropertyCommand.cs:245-253` dù `CheckInTime = 12:00`!). Đối tác chọn tỉnh cũ trên `/partner-register` có thể bị lệch matching vùng du lịch trên B2C.
- **Đề xuất khắc phục:** Chuẩn hóa 1 nguồn địa danh thống nhất giữa B2B/B2C và thống nhất `CheckInTime = 14:00` (hoặc đồng bộ khung giờ phụ thu `TrySeedStarterInventory` theo đúng `property.CheckInTime`).

#### [P1-04] Đứt gãy cấu hình Thuế VAT %, Phí dịch vụ %, Chính sách hủy (`POL-C03`) & Bug mất phạm vi Chi nhánh khi lưu Mẫu in/VietQR
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/policies/policies.page.ts:668-690, 973-979` & `UpdatePropertyPoliciesCommand.cs` (grep `TaxRatePercent|ServiceFeeRatePercent|CancellationPolicy` = 0 kết quả): Không có chỗ nào trong PMS cho Owner cấu hình `Property.TaxRatePercent`, `Property.ServiceFeeRatePercent` hoặc chính sách hủy linh hoạt theo cơ sở (`POL-C03`).
  - `frontend/src/app/core/services/print-documents.service.ts:36-54`: `getTemplateConfig(propertyId)` và `updateTemplateConfig(req, propertyId)` gửi `?propertyId=...` trên **query string**.
  - `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs:298-319`: `GetTemplateConfig([FromQuery] Guid? tenantId)` **hoàn toàn bỏ qua `propertyId`**; thậm chí nếu `effectiveTenantId` null (lines 313-319) sẽ query `FirstOrDefaultAsync()` không filter tenant -> **nguy cơ rò rỉ mẫu in & STK ngân hàng của tenant khác**! Khi lưu (`SaveTemplateConfig`), controller chỉ đọc `request.PropertyId` trong JSON body mà `printConfigForm` không có field `propertyId`!
  - `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs:94, 100-101, 157`: Hardcode fallback thuế `0.08m` (8% VAT, bỏ qua `Property.TaxRatePercent`), và fallback STK `"MBBank" / "0988889999" / "KHACH SAN BIEN DONG"`. Tương tự `PaymentsController.cs:401-422` `POST /api/payments/vietqr/generate` gắn `[AllowAnonymous]` và fallback `"970422" / "0345678910" / "HOTEL SAAS RESORT"`.
- **Nguyên nhân gốc rễ:** Frontend/Backend không khớp tham số query vs body trên `/api/print/template-config`; `PrintDocumentsController` chưa nối `Property` tax rates và `PaymentsController` chưa tách public/private VietQR.
- **Tác động vận hành:** Khách sạn có 2 chi nhánh dùng 2 tài khoản ngân hàng khác nhau sẽ bị ghi đè cấu hình chung; nếu quên cấu hình hoặc cấu hình lỗi, hóa đơn có thể hiển thị nhầm STK `"0988889999"` của mẫu, dẫn đến khách chuyển nhầm tiền. Khách sạn hộ kinh doanh không chịu VAT 8% hoặc chịu 10% không chỉnh sửa được tỷ lệ thuế.
- **Đề xuất khắc phục:** Sửa `PrintDocumentsController` nhận `[FromQuery] Guid? propertyId` bắt buộc trong scope Tenant (xóa fallback query xuyên tenant và STK giả `"0988889999"` nếu chưa config thì ẩn VietQR); bổ sung cấu hình `TaxRatePercent`, `ServiceFeeRatePercent` và mức phí/giờ hủy (`POL-C03`) vào `/policies`.

---

### Khu Vực 2: Catalog, Biểu Giá, Khuyến Mãi & AI Dynamic Pricing

#### [P0-02] Phân hệ Quản lý Khuyến mãi & Voucher B2B hoàn toàn bị bỏ trống (`0%`), B2C dùng dữ liệu giả hardcode
- **Bằng chứng (`file:line`):**
  - Domain & DB đã có sẵn: `backend/src/HotelSaas.Domain/Entities/Promotion.cs:9-70` (đầy đủ `Code`, `Name`, `Type`, `Value`, `MinNights`, `MaxUsage`, `CurrentUsage`, `StartsAtUtc`, `EndsAtUtc`, `IsActive`), `ApplicationDbContext.cs:114` (`DbSet<Promotion>`), `SeedData.cs:44` (Permission `PROMOTIONS`), `roles-management.utils.ts:123-127`.
  - **Không có gì ở Application/WebApi/B2B UI**: `IApplicationDbContext.cs` không khai báo `DbSet<Promotion>`; không có `PromotionsController`, không có CQRS Command/Query, không có route/menu trong `app.routes.ts` hay `admin-layout.ts`.
  - Ở chiều ngược lại, trang B2C `frontend/src/app/features/public-booking/promotions.page.ts:189` gọi `PublicBookingService.getPromotions()` (`public-booking.service.ts:587-630`), vốn **trả về mảng `of([...])` hardcode 4 mã giả** (`GIODAY20`, `QUADEM15`, `DALAT50K`, `BIENVUNGTAU`) không hề kiểm tra hay trừ giá trong Quote Engine!
- **Nguyên nhân gốc rễ:** Entity `Promotion` được tạo từ baseline nhưng chưa từng triển khai tầng Application, API và UI quản trị; trang `/booking/deals` được dựng mock để demo B2C.
- **Tác động vận hành:** Chủ khách sạn và Quản lý bị tước hoàn toàn công cụ kinh doanh cơ bản (tạo mã giảm giá giờ vàng, flash deal cuối tuần, voucher khách quen); trong khi khách đặt phòng thấy quảng cáo `"GIẢM 20% GIODAY20"` nhưng khi thanh toán lại không áp dụng được hoặc không trừ tiền thật.
- **Đề xuất khắc phục:** Khai báo `Promotions` trong `IApplicationDbContext`, xây dựng `PromotionsController` + CQRS CRUD (gắn `[RequirePermission("PROMOTIONS", ...)]`), tích hợp validation & áp dụng mã vào `PricingCalculator` + `CreateGuestHold` + `CreateReservation`, xây dựng màn hình B2B `/promotions`, và kết nối `/booking/deals` về API thật.

#### [P1-05] Thuật toán chia khoảng bảng giá (`Interval Splitting`) lỗi khi đè nhiều bảng giá hoặc chèn lọt lòng/đầu khoảng
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommandHandler.cs:145-204`:
    1. Chỉ dùng `existingRates.FirstOrDefault(r => r.EffectiveFrom < request.EffectiveTo && request.EffectiveFrom < r.EffectiveTo)` -> nếu bảng giá mới (vd 1 tháng cao điểm) phủ qua **2 hoặc nhiều bảng giá cũ liên tiếp**, handler chỉ xử lý bảng giá đầu tiên, còn bảng giá thứ 2 bị **PostgreSQL Exclusion Constraint ném `409 ERR_RATE_OVERLAP`**.
    2. **Lỗi Case 1 (`Exact Head match`)** tại lines `151-175`: Nếu bảng giá cũ là `[01/06 -> 31/08)` và bảng giá mới chỉ là `[01/06 -> 15/06)`, code đánh dấu `overlappingRate.IsActive = false` toàn bộ, **làm mất trắng giá từ `15/06 -> 31/08`** (tạo lỗ hổng không có giá, khiến Quote Engine báo lỗi không đặt phòng được!).
    3. **Lỗi Head-Overlap (`request.EffectiveFrom < overlappingRate.EffectiveFrom < request.EffectiveTo < overlappingRate.EffectiveTo`)**: Không có nhánh xử lý dời `EffectiveFrom` của bảng giá cũ lên `request.EffectiveTo`, nên bị DB chặn `409`.
    4. **Lỗi Mid-Split (`overlappingRate.EffectiveFrom < request.EffectiveFrom && request.EffectiveTo < overlappingRate.EffectiveTo`)**: Chỉ rút ngắn `overlappingRate.EffectiveTo = request.EffectiveFrom` mà **không sinh đoạn đuôi `[request.EffectiveTo -> originalEnd)`**, làm mất giá đoạn sau khi hết đợt tăng giá lễ!
- **Nguyên nhân gốc rễ:** Handler thiết kế chỉ xử lý 1 bản ghi overlap và chỉ cắt đầu mà không cắt đuôi / không lặp trên tập `overlappingRates.ToList()`.
- **Tác động vận hành:** Khi Quản lý thiết lập giá cuối tuần hoặc giá 3 ngày Lễ 30/4 nằm trong gói giá cả năm, toàn bộ giá phần còn lại của năm sau ngày Lễ bị mất hoặc rút ngắn vĩnh viễn -> khách tìm phòng sau ngày Lễ bị báo lỗi chưa có giá!
- **Đề xuất khắc phục:** Viết lại logic overlap theo 4 trường hợp chuẩn interval algebra cho tất cả các rate giao cắt (bao gồm tách đoạn đuôi `tailRate` khi `originalEnd > request.EffectiveTo`), bọc unit tests cho đủ case (mid-split tạo tail, multi-overlap, head-trim).

#### [P1-06] AI Dynamic Pricing thiếu endpoint `Apply`, thiếu UI trong `/rates`, vi phạm `BR-AI01/04`, và endpoint lộ `[AllowAnonymous]`
- **Bằng chứng (`file:line`):**
  - `PROJECT.md:95, 119-124`: Khai báo M4 AI Dynamic Pricing gồm `SuggestPriceAsync`, `ApplyPriceAsync`, UI `ai-pricing.page.ts`. Trên nhánh `develop` hiện tại, không tồn tại `AiPricingController`, `ApplyPriceAsync`, hay bất kỳ component nào ở `frontend/` gọi `/api/ai/dynamic-pricing/recommendations` (`git grep dynamic-pricing` chỉ thấy `AiController.cs` & `DynamicPricingService.cs`).
  - `backend/src/HotelSaas.WebApi/Controllers/AiController.cs:294-300`: Endpoint `GET /api/ai/dynamic-pricing/recommendations` gắn **`[AllowAnonymous]`** — cho phép bất kỳ ai ngoài internet truyền `?propertyId=...` để xem phân tích công suất và chiến lược giá nội bộ của đối thủ!
  - `AiController.cs:266-279`: `GetAiUsageStatus` nếu chưa có `AiUsageLogs` (do SmartSearch/Concierge không ghi log) lại **đếm `Reservations + RoomTypeRateAudits` để làm `UsedCount` AI**! Nghĩa là khách sạn càng bán được nhiều phòng thì quota AI tự tụt về 0 dù chưa từng bấm dùng AI!
- **Nguyên nhân gốc rễ:** M4 mới code được service tính gợi ý ở backend, gắn nhầm `[AllowAnonymous]` để test, thiếu API apply 1 chạm tạo `RoomTypeRate` kèm Audit Log (`BR-AI04`), thiếu UI PMS và logic tính quota fallback viết sai bản chất.
- **Tác động vận hành:** Owner nâng cấp gói Pro/Enterprise vì tính năng `"AI gợi ý giá phòng"` (`SeedData.cs:266`) nhưng không có chỗ bấm xem hoặc áp dụng giá trong PMS; đồng thời đối thủ có thể query công suất/giá gợi ý qua API ẩn danh.
- **Đề xuất khắc phục:** Bỏ `[AllowAnonymous]` trên `dynamic-pricing/recommendations`, thay bằng `[RequirePermission("AI_FEATURES", PermissionAction.Read)]` + tenant/property membership check; thêm endpoint `POST /api/ai/dynamic-pricing/apply` (gắn permission `ROOM_TYPES:Update` + ghi `AiUsageLog`); tích hợp panel **"Gợi ý giá AI"** kèm nút 1-click Áp dụng vào `/rates`; xóa fallback đếm `Reservations` trong `GetAiUsageStatus`.

---

### Khu Vực 3: Front-Desk Lifecycle, Folio, In Hóa Đơn, Night Audit & Smart Lock

#### [P0-03] Luồng Walk-in trên Sơ đồ phòng (`/rooms`) bỏ qua Check-in: Phòng thành `Occupied` nhưng Đơn kẹt ở `Confirmed`
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/rooms/rooms.page.ts:1699-1721`: Khi lễ tân bấm chọn phòng trống `Clean` để mở modal `"Nhận phòng nhanh (Walk-in)"` và submit, hàm gọi `this.reservationService.createReservation(req)` (tạo đơn với `Status = ReservationStatus.Confirmed` tại `CreateReservationCommandHandler.cs:327`), rồi ngay lập tức gọi `this.roomService.updateRoomStatus(selectedRoom.id, RoomStatus.Occupied, RoomStatus.Clean)` **mà KHÔNG gọi `checkInReservation(res.id)`**!
  - `backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs:162-167`: Chặn Check-out với `409 ERR_INVALID_STATUS_TRANSITION` nếu `reservation.Status != ReservationStatus.CheckedIn`!
  - `frontend/src/app/features/rooms/rooms.page.ts:1680, 1692`: Ngoài ra còn hardcode `guestEmail: 'walkin@hotel.internal'` (làm rác CRM) và dùng `new Date(formVal.checkOutDate); outD.setHours(12,0,0,0); outD.toISOString()` (lệ thuộc timezone trình duyệt thay vì `+07:00`).
- **Nguyên nhân gốc rễ:** Nhánh walk-in trên `/rooms` tự gọi rời rạc 2 API `CreateReservation` + `UpdateRoomStatus` thay vì gọi endpoint Check-in chuẩn hoặc 1 command atomically "Create + CheckIn".
- **Tác động vận hành:** Khách vãng lai (walk-in) nhận phòng xong, phòng sáng đỏ `Occupied`, nhưng trên sổ đặt phòng đơn vẫn là `Confirmed`, không sinh `SmartLockPin` check-in (`CheckInReservationCommandHandler.cs:227-232`). Đến lúc khách trả phòng, lễ tân **không thể Check-out** (bị API báo `"Khách chưa thực hiện nhận phòng"`), và nếu bấm Check-in bù thì lại văng lỗi `ERR_ROOM_OCCUPIED` vì phòng đã bị đổi sang `Occupied` trước đó — rơi vào **deadlock trạng thái**!
- **Đề xuất khắc phục:** Khi tạo Walk-in nhận phòng ngay trên `/rooms`, backend nên hỗ trợ cờ `ImmediateCheckIn = true` trong `CreateReservationCommand` (atomic transaction: validate clean room -> tạo `CheckedIn` -> cấp `SmartLockPin` -> đổi room sang `Occupied`) hoặc frontend gọi tuần tự `createReservation` -> `checkIn` (không tự gọi `updateRoomStatus(Occupied)`).

#### [P0-04] Trang In Hóa Đơn (`/print/invoice/:id`) có nguy cơ crash runtime do lệch hợp đồng DTO và bị "mồ côi" (không có nút điều hướng từ PMS)
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs:43-60, 130-161`: Endpoint `GET /api/print/invoice/{reservationId}` gắn `[AllowAnonymous]` và trả về `PrintableInvoiceDto` dạng **phẳng** (`headerCompanyName`, `headerAddress`, `taxNumber`, `hotline`, `vietQrImageUrl`, `items`, `totalAmount`, `remainingAmount`, `bankName`...).
  - `frontend/src/app/core/models/print-document.model.ts:24-54` & `frontend/src/app/features/print/print-invoice.page.ts:41-185`: Frontend mong đợi object **lồng nhau** `inv.hotelInfo.headerCompanyName`, `inv.lineItems`, `inv.vietQrUrl`, `inv.grandTotal`, `inv.balanceDue`, `inv.vatRate`, `inv.roomTotal`!
  - Kết quả grep `/print/invoice` và `PrintDocumentsService` trên toàn bộ `frontend/src/app/features/`: **0 nơi gắn link** tới `/print/invoice/:id` hay `/print/voucher/:token` (`reservations.page.ts`, `rooms.page.ts`, `payments.page.ts` đều không gọi).
  - Thêm vào đó, `backend/src/HotelSaas.Application/` và `WebApi/`: Grep `new Invoice` trên toàn `backend/src` = **0 kết quả**! `CheckOutReservationCommandHandler` không hề sinh bản ghi `Invoice` + `InvoiceItem`, khiến `PrintDocumentsController` luôn dùng fallback hardcode `8% VAT` (line 94) và làm `AddFolioItemCommandHandler.cs:114-137` rơi vào nhánh `invoice == null` (khiến các mục minibar/dịch vụ thêm sau chỉ sửa chuỗi JSON `Notes` mà không có bảng `InvoiceItems` chính thức). Đồng thời `PrintDocumentsController.cs:96` tính `paidAmount` không lọc bỏ giao dịch `REFUND-COMPLETED-...`, làm sai số tiền đã trả nếu đơn từng có giao dịch hoàn!
- **Nguyên nhân gốc rễ:** Frontend `PrintInvoicePage` và Backend `PrintDocumentsController` được viết theo 2 DTO contract khác nhau hoàn toàn; unit test `print-invoice.page.spec.ts` chỉ pass nhờ mock service nên che khuất lỗi tích hợp; và quy trình sinh `Invoice` khi Check-out bị bỏ qua.
- **Tác động vận hành:** Nếu mở `/print/invoice/:id` chạy thật với API, Angular throw `TypeError: Cannot read properties of undefined (reading 'headerCompanyName')` (màn hình trắng); đồng thời lễ tân cũng không có nút nào trên màn hình Đặt phòng/Thu ngân để in hóa đơn chuẩn có VAT & VietQR (chỉ in được `"Phiếu xác nhận thu tiền nội bộ"` trong `payments.page.ts:1128`).
- **Đề xuất khắc phục:** Chuẩn hóa thống nhất DTO giữa `PrintDocumentsController` và `PrintInvoiceDto` (loại bỏ `[AllowAnonymous]` hoặc bắt buộc token ký/auth); triển khai tạo bản ghi `Invoice` + `InvoiceItem` tự động khi Check-out (dùng đúng `Property.TaxRatePercent` & `ServiceFeeRatePercent`); gắn nút **"In hóa đơn"** ngay trong Check-out modal & Reservation Detail modal; lọc bỏ `REFUND` khi tính `paidAmount`.

#### [P1-07] Lỗi `PricingCalculator` trả HTTP 422 ngoài khung giờ phụ thu mặc định & Check-in/Check-out thực tế không tự tính phụ thu sớm/muộn
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs:225-282`: Starter inventory chỉ seed 4 khung giờ phụ thu: Early `06:00-09:00` (50%), `09:00-14:00` (30%); Late `12:00-15:00` (30%), `15:00-18:00` (50%). **Bỏ trống hoàn toàn `00:00-06:00` và `18:00-23:59`!**
  - `backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs:205-209, 247-251`: Nếu đặt phòng Overnight có giờ nhận `04:00` sáng hoặc giờ trả `20:00` tối, `matchingPolicy == null` -> ném **`422 ERR_SURCHARGE_NOT_CONFIGURED`** chặn đặt phòng!
  - Ngược lại, trong `CheckInReservationCommandHandler.cs:225-238` và `CheckOutReservationCommandHandler.cs:169-197`: Nếu khách đặt theo giờ chuẩn (ví dụ check-out `12:00`), nhưng thực tế lễ tân bấm **Check-in sớm lúc `08:00` hoặc Check-out trễ lúc `16:00`**, hệ thống **không tự động tính và cộng phụ thu** (`PropertySurchargePolicy`) vào Folio trước khi thu tiền trả phòng!
- **Nguyên nhân gốc rễ:** Khung giờ seed không bao phủ 24/24 và thiếu rule `> 18:00 = +100% (1 đêm)` như đặc tả `POL-IO01` (`05-business-rules.md:209`); đồng thời handler Check-in/out không đối chiếu `DateTime.UtcNow` (giờ VN) với `CheckInTime`/`CheckOutTime`.
- **Tác động vận hành:** Khách đặt nhận phòng rạng sáng hoặc trả tối muộn gặp lỗi 422 bí ẩn; khách ở lố giờ check-out 4 tiếng vẫn trả phòng được với giá 0đ phụ thu, gây thất thoát doanh thu cho chủ khách sạn.
- **Đề xuất khắc phục:** Khi tạo chi nhánh, seed đủ dải phụ thu hoặc hỗ trợ quy tắc `> 18:00 (+1 đêm)`; trong flow `CheckOutReservation` (và preview trước check-out ở UI), tính phụ thu phát sinh dựa trên giờ trả phòng thực tế so với `CheckOutTime` (cho phép Manager override/miễn giảm có lý do ghi Audit Log).

#### [P1-08] Thiếu quy trình Night Audit / Đánh dấu `NoShow` tự động & Không ràng buộc `MaxOccupancy` / Giới hạn 365 ngày khi đặt phòng
- **Bằng chứng (`file:line`):**
  - Grep `NoShow` trên toàn codebase chỉ có ở Enum, `DeleteRoomCommandHandler.cs:141`, `CancellationPolicyService.cs:135`, `ReportsController.cs:393`, `reservations.page.ts:200` (dropdown filter) — **0 Command/Endpoint/BackgroundJob/Nút bấm** để chuyển đơn quá giờ check-in sang `NoShow` hoặc thực hiện Night Audit cuối ngày!
  - `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandValidator.cs:66-70`: Hardcode `NumberOfGuests <= 20` thay vì đối chiếu `roomType.MaxOccupancy` (trái với B2C `CreateGuestHoldCommand.cs:175-179` vốn có check `ERR_OCCUPANCY_EXCEEDED`); cũng **không có rule giới hạn đặt trước 365 ngày (`BR-R03`) hay ngày nhận >= hôm nay (`BR-R02`)**.
  - `CheckInReservationCommandHandler.cs:164-187`: Chỉ chặn `PendingPayment` nếu `snapshot.IsOnlineHold == true`. Với booking nội bộ nếu trạng thái `PendingPayment` hoặc `Confirmed` với `paidAmount = 0`, lễ tân vẫn check-in bình thường không có cảnh báo thu cọc (`POL-IO02` bước 3).
  - Lệch tỷ lệ cọc hiển thị: `reservations.page.ts:1369, 2196` tính & hiển thị `"Tiền cọc yêu cầu giữ chỗ (50%)"` (`* 0.5`), trong khi Backend (`CreateGuestHoldCommand.cs:485`, `CancellationPolicyService.cs:149`, `CreatePaymentCommandHandler.cs:293`) dùng **`30%` (`0.30m`)**.
- **Nguyên nhân gốc rễ:** Thiếu module vận hành Night Audit và thiếu đồng bộ validation rule giữa B2C (`CreateGuestHold`) và B2B (`CreateReservation`).
- **Tác động vận hành:** Phòng khách không đến (No-show) tiếp tục khóa inventory mãi mãi ở trạng thái `Confirmed` trừ khi lễ tân tự hủy tay; lễ tân có thể xếp 6 người vào phòng Standard 2 người; và Lễ tân báo khách đặt cọc 50% trong khi cổng B2C/Folio tính 30%.
- **Đề xuất khắc phục:** Bổ sung `MarkNoShowCommand` (kèm action trên UI & Background Service quét quá giờ cutoff); kiểm tra `NumberOfGuests <= roomType.MaxOccupancy` và `<= Today + 365 days` trong `CreateReservationCommandHandler`; thống nhất cấu hình tỷ lệ cọc từ `Property` (hoặc đồng bộ 30%).

#### [P1-09] Khoảng trống giữa tài liệu M5 Smart Lock IoT (`PROJECT.md`) với hiện thực & Hoàn tiền VNPay chỉ làm thủ công
- **Bằng chứng (`file:line`):**
  - `PROJECT.md:96, 127-134`: Khẳng định M5 IoT Smart Lock gồm entities `SmartLockPin`, `SmartLockAccessLog`, `ISmartLockService` (Generate/Validate/Revoke/Regenerate/Expire), dashboard và simulation UI. Kiểm tra trực tiếp trên `develop`: **không có bất kỳ file nào** (`SmartLockPin.cs`, `SmartLockAccessLog.cs`, `SmartLockController.cs`, `features/smart-lock/` đều 0 tồn tại). Chỉ có 3 cột string trên `Reservation.cs:162-172` (`SmartLockPin`, `SmartLockStatus`, `SmartLockActivatedAtUtc`) — không có nhật ký mở cửa, không có nút cấp lại/hủy PIN khẩn cấp trên UI lễ tân!
  - `frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts:1194-1195` & `ConfirmRefundPayoutCommandHandler.cs:178-182`: Dù `docs/srs/05-business-rules.md:187` thiết kế nhánh `VNPay -> VNPay refund API`, thực tế 100% refund payout là **chi trả thủ công ngoài hệ thống** rồi nhập tay `BankTransactionRef` (`VnpayPaymentService.cs` chỉ có `CreatePaymentUrl` và `VerifyCallback`).
- **Nguyên nhân gốc rễ:** Tài liệu `PROJECT.md` mô tả kế hoạch lý tưởng chưa khớp code thực tế trên `develop`.
- **Tác động vận hành:** Lễ tân không thể thu hồi/cấp lại mã khóa phòng khi khách làm lộ mã hoặc gia hạn phòng (nếu dùng SmartLock); khách đặt qua VNPay hủy phòng không được hoàn tự động về ví/thẻ mà phụ thuộc kế toán chuyển khoản tay.
- **Đề xuất khắc phục:** Bổ sung tối thiểu `RegeneratePin` / `RevokePin` API + hiển thị thẻ SmartLock PIN trên Detail Modal/Room Drawer (kèm quyền & AuditLog) nếu SmartLock nằm trong cam kết gói Enterprise; ghi chú rõ quy trình hoàn tiền thủ công hoặc tích hợp VNPay Refund Transaction API.

---

### Khu Vực 4: Quy Trình Buồng Phòng (Housekeeping Workflow)

#### [P0-05] `HousekeepingTask` là mã chết ngoài `DbContext`; Quy trình Buồng phòng thiếu gán việc, nhận việc, kiểm tra (`BR-HK01`–`BR-HK06`)
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs:9-60` định nghĩa đầy đủ `RoomId`, `AssignedToUserId`, `Status` (`HousekeepingTaskStatus`), `Priority` (`HousekeepingPriority`), `Notes`, `StartedAtUtc`, `CompletedAtUtc`; `AuditSaveChangesInterceptor.cs:166-172` đăng ký audit `HousekeepingTask`; `audit-logs.page.ts:107` có dropdown lọc `HousekeepingTask`.
  - **Tuy nhiên**, `ApplicationDbContext.cs:34-127` và `IApplicationDbContext.cs` **hoàn toàn không khai báo `DbSet<HousekeepingTask>`**! Không có Controller, không có Command/Query cho task buồng phòng.
  - `CheckOutReservationCommandHandler.cs:193-198`: Khi trả phòng chỉ đổi `room.Status = RoomStatus.Dirty`, **không sinh bản ghi `HousekeepingTask`** (`BR-HK01`).
  - `frontend/src/app/features/housekeeping/housekeeping.page.ts:329-410`: Chỉ hiển thị lưới phòng gọi `PATCH /api/rooms/{id}/status` (`Dirty -> Cleaning -> Clean`). Không có: (1) Danh sách task riêng; (2) Phân công nhân viên dọn (`AssignedToUserId`); (3) Housekeeper bấm "Nhận việc" (`Self-claim`, `BR-HK06`); (4) Cấp độ ưu tiên phòng sắp có khách check-in (`Urgent`); (5) Checklist minibar/kiểm tra đồ thất lạc/báo hỏng kèm ghi chú.
- **Nguyên nhân gốc rễ:** Đã tạo entity `HousekeepingTask` ở tầng Domain & Migration nhưng sau đó đi tắt bằng `Room.Status` (`Dirty/Cleaning/Clean`) mà quên gỡ hoặc hoàn thiện luồng Task.
- **Tác động vận hành:** Không truy vết được **ai đã dọn phòng nào, mất bao nhiêu phút** (`StartedAtUtc`/`CompletedAtUtc`), không chia ca dọn theo tầng cho nhiều nhân viên buồng phòng làm song song, và Housekeeper không biết phòng nào khách VIP sắp check-in sau 30 phút để dọn trước.
- **Đề xuất khắc phục:** Thêm `DbSet<HousekeepingTask>` vào `ApplicationDbContext` & `IApplicationDbContext`; tự động tạo `HousekeepingTask` trong `CheckOutReservationCommandHandler`; xây dựng `HousekeepingController` (List/Assign/Self-Claim/Start/Complete/Inspect/Urgent priority); nâng cấp `/housekeeping` hiển thị hàng đợi nhiệm vụ + sắp xếp theo độ ưu tiên check-in kế tiếp.

---

### Khu Vực 5: Khách Hàng CRM, Đánh Giá, Nhân Sự/RBAC & Hạn Ngạch Gói Cước

#### [P0-06] LỖ HỔNG BẢO MẬT & RBAC NGHIÊM TRỌNG: `StaffService` bỏ qua API, sửa System Role và tạo Custom Role giả lập trong `localStorage`
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/core/services/staff.service.ts:475-494`:
    ```ts
    const isSystemRole = this.cachedSystemRoles.some(r => r.id === id && r.isSystemRole);
    const isLocalCustom = this.loadLocalCustomRoles().some(r => r.id === id);
    if (isSystemRole || isLocalCustom) {
      return of(this.buildLocalUpdatedRole(id, request));
    }
    ```
    Khi Owner sửa ma trận quyền của `MANAGER`, `RECEPTIONIST`, hoặc `HOUSEKEEPER` trên `/roles` hoặc `/staff`, Frontend **không gửi bất kỳ HTTP PUT nào lên Backend** — chỉ ghi vào `localStorage` (`hotel_saas_custom_roles_v1`)!
  - `staff.service.ts:358-409, 492, 509-513`: Nếu API `POST/PUT/DELETE /api/staff/roles` trả lỗi (kể cả lỗi 400/403/500!), **`catchError` nuốt trọn lỗi và lưu giả lập vào `localStorage` rồi trả về `of(...)` thành công**!
  - `staff.service.ts:517-579`: Khi gán nhân viên vào một Role tự tạo (lưu trong `localStorage`), Frontend **xóa `roleId: undefined`** trước khi gửi lên `POST/PUT /api/staff`, và lưu `STAFF_ROLE_OVERRIDES_KEY` giả trong trình duyệt!
  - Ở phía Backend: `UpdateRoleCommand.cs:56-59` & `DeleteRoleCommand.cs:39-42` cấm sửa/xóa system role bằng `InvalidOperationException` (không khớp `ExceptionHandlingMiddleware.cs:73-79` -> **lỗi 500**); và `SeedData.cs:27-47` thiếu function `AUDIT_LOGS` trong khi `roles-management.utils.ts:143` lại liệt kê, còn `staff.service.ts:37-55` thiếu `AI_FEATURES` và lệch quyền mặc định của `MANAGER` so với `SeedData.cs:138-142`.
- **Nguyên nhân gốc rễ:** Cơ chế "local fallback" được viết để che lỗi API/chống 500 khi demo offline nhưng bị để lại trong code production, phá vỡ hoàn toàn tính xác thực của RBAC giữa Client UI và Database/JWT.
- **Tác động vận hành:** **Rủi ro bảo mật P0**: Chủ khách sạn vào ma trận RBAC bỏ tick quyền xóa hoặc quyền thu tiền của Lễ tân, thấy thông báo `"Đã lưu ma trận phân quyền thành công"`, nhưng **Lễ tân đăng nhập ở máy tính khác vẫn giữ nguyên toàn bộ quyền cũ** vì DB không hề thay đổi! Tương tự, tạo role `Kế toán` trên máy Chủ khách sạn nhưng sang máy khác vai trò này biến mất và nhân viên bị gán nhầm thành `Receptionist` ở Backend!
- **Đề xuất khắc phục:** Xóa bỏ 100% `CUSTOM_ROLES_STORAGE_KEY`, `STAFF_ROLE_OVERRIDES_KEY` và mọi `catchError` giả lập thành công trong `staff.service.ts`; phân biệt rõ System Role là **chỉ xem** trên UI (hoặc cho phép clone thành Custom Role thật lưu DB); sửa `CreateRole/UpdateRole/DeleteRole` dùng `ConflictException`/`BadRequestException` chuẩn; đồng bộ danh sách `PermissionFunction` (thêm `AUDIT_LOGS`, `AI_FEATURES`) giữa `SeedData.cs` và Frontend.

#### [P0-07] Lỗi CRM Khách hàng (`/guests`): Ghi đè nát JSON `Reservation.Notes`, bỏ sót khách không có SĐT và dữ liệu giả lập
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Guests/Commands/UpdateGuestNotes/UpdateGuestNotesCommand.cs:11, 39-53`:
    `foreach (var b in recentBookings) { b.Notes = request.Notes; }` — Ghi thẳng text ghi chú mới vào cột `Reservation.Notes` của 5 booking gần nhất, đồng thời khai báo `public bool? IsVip { get; init; }` tại dòng `11` nhưng handler **hoàn toàn bỏ qua không lưu `IsVip`**! Vì hệ thống lưu toàn bộ `ReservationSnapshot` JSON (`RentalType`, `StartAtUtc`, `EndAtUtc`, `Breakdown`, `LookupToken`, `DepositRequired`, `IdempotencyKey`...) ngay trong `Reservation.Notes` (`CreateReservationCommandHandler.cs:328`), hành động lưu ghi chú CRM **phá hủy vĩnh viễn JSON Snapshot** của 5 đơn đặt phòng! Hậu quả kéo theo: `ReservationTimeHelper.GetEffectiveStayUtcInterval` rơi về giờ mặc định, mất breakdown giá, mất lookup token và mất giờ thuê `Hourly`!
  - `backend/src/HotelSaas.Application/Guests/Queries/GetGuestDirectory/GetGuestDirectoryQuery.cs:45, 64, 72`: Loại bỏ mọi khách hàng có `GuestPhone == null/empty` (bỏ sót khách walk-in chỉ nhập tên/email); gán cứng `IdCardNumber = null`; trả nguyên JSON snapshot vào `Notes` khiến UI bảng `guests.page.ts:198` hiển thị chuỗi JSON thô `{ "RentalType": 2, ... }`!
  - `GetGuestDirectoryQuery.cs:13-14`: Khai báo `LoyaltyTier` và `IsVip` trên query record nhưng **handler hoàn toàn không lọc theo 2 tham số này** (filter Tier trên `guests.page.ts` bị vô hiệu!).
  - `backend/src/HotelSaas.Application/Guests/Queries/GetGuestHistory/GetGuestHistoryQuery.cs:88-92`: Hardcode `LoyaltyTier = completedStays >= 3 ? "Gold" ...` và `PointsBalance = 0` và `IsBlacklisted = false`, không query bảng `GuestLoyaltyMemberships`!
- **Nguyên nhân gốc rễ:** Chưa có bảng `GuestProfile` riêng cho CRM; dùng tạm `Reservations` group by `GuestPhone` và dùng chung cột `Reservation.Notes` vốn đang bị quá tải bởi `ReservationSnapshot` JSON.
- **Tác động vận hành:** Nhân viên lễ tân bấm cập nhật ghi chú `"Khách dị ứng hải sản"` trên trang CRM sẽ vô tình làm hỏng dữ liệu giờ/giá/token của tối đa 5 đơn đặt phòng thật của khách đó! Bộ lọc hạng VIP/Loyalty không chạy và bảng khách hàng hiện toàn chuỗi JSON khó đọc.
- **Đề xuất khắc phục:** Dừng ngay hành vi ghi đè `Reservation.Notes` (tạo bảng `GuestProfile` theo `TenantId` + Phone/Email để lưu `Notes`, `IsBlacklisted`, `VipOverride`, `Preferences`); giải mã `ReservationSnapshotHelper.TryDeserialize` để chỉ hiển thị `CustomerNotes` ở directory; nối `GetGuestHistoryQuery` với `GuestLoyaltyMemberships`; thực thi filter `LoyaltyTier`/`IsVip`.

#### [P1-10] Không có quản lý Đánh giá khách hàng (`GuestReview`) trong B2B PMS
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Domain/Entities/GuestReview.cs:65-78`: Entity có sẵn `OwnerReply`, `RepliedAtUtc`, `IsPublished`.
  - `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs` & `Application/Reviews/`: Chỉ có `SubmitGuestReviewCommand` và `GetPropertyReviewsQuery` cho khách B2C.
  - Grep toàn bộ WebApi Admin Controllers, Application và `frontend/src/app/features/`: **0 endpoint, 0 route, 0 màn hình PMS** để Owner/Manager xem danh sách đánh giá theo chi nhánh, lọc đánh giá sao thấp (1–2 sao), trả lời phản hồi (`OwnerReply`), hoặc ẩn đánh giá vi phạm!
- **Nguyên nhân gốc rễ:** Module Reviews mới làm chiều B2C viết & xem, bỏ quên chiều B2B phản hồi (`US` & permission `REVIEWS` trong `SeedData.cs:45`).
- **Tác động vận hành:** Khách phàn nàn chất lượng phòng công khai trên sàn B2C nhưng Chủ khách sạn không nhận được thông báo cũng như không có chỗ nào để trả lời (`OwnerReply`) giải thích hoặc cải thiện điểm uy tín.
- **Đề xuất khắc phục:** Tạo `ReviewsController` (`/api/reviews`, gắn `[RequirePermission("REVIEWS", ...)]`) với GET list (theo rating/chưa trả lời) + `POST /{id}/reply` + `PATCH /{id}/visibility`; bổ sung mục `"Đánh giá khách hàng"` vào menu PMS và cảnh báo SignalR khi có review <= 3 sao.

#### [P1-11] Không kiểm tra hạn ngạch Subscription (`MaxRooms`, `MaxProperties`, `MaxStaff`) & Nâng cấp gói không qua thanh toán
- **Bằng chứng (`file:line`):**
  - Grep `MaxRooms|MaxProperties|MaxStaff` trên toàn bộ `Application/Rooms/`, `Application/Properties/`, `Application/Staff/`: **0 kết quả**. Các command `CreatePropertyCommandHandler`, `CreateRoomCommandHandler`, `CreateStaffMemberCommandHandler` **không hề kiểm tra gói cước hiện tại của Tenant**.
  - `backend/src/HotelSaas.WebApi/Controllers/SubscriptionsController.cs:181-237`: `POST /api/subscriptions/upgrade` cập nhật ngay `subscription.Tier = targetTier; subscription.Status = Active` mà **không kiểm tra thanh toán / hợp đồng / phê duyệt**!
- **Nguyên nhân gốc rễ:** Endpoint nâng cấp và kiểm tra quota chỉ mới dựng phần hiển thị trên `/subscriptions`, chưa gắn guardrail vào các Create handlers và chưa nối luồng thanh toán SaaS.
- **Tác động vận hành:** Bất kỳ Tenant Starter (giới hạn 15 phòng, 1 chi nhánh, 3 nhân sự) có thể tạo 500 phòng, 20 chi nhánh, 100 nhân viên không tốn đồng nào, hoặc tự bấm nâng cấp lên gói Enterprise miễn phí ngay trên UI (`subscriptions.page.ts:295-309`).
- **Đề xuất khắc phục:** Viết `ISubscriptionQuotaService` chặn ở Application layer với mã lỗi rõ ràng (`403/409 ERR_QUOTA_EXCEEDED`) khi tạo Room/Property/Staff vượt ngưỡng gói; chuyển nút `"Chuyển sang gói này"` sang tạo hóa đơn/yêu cầu thanh toán VNPay/VietQR hoặc hợp đồng nâng cấp có đối soát.

#### [P1-12] Tạo nhân viên mới dùng mật khẩu mặc định yếu & tự động chiếm/chuyển tài khoản Guest thành Staff không cần đồng ý
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.Application/Staff/Commands/CreateStaffMember/CreateStaffMemberCommand.cs:66-108`:
    - Line `72`: Nếu bỏ trống password, gán cứng mật khẩu mặc định `"Staff@123456"` (và frontend `staff.page.ts:510` còn ghi rõ placeholder `"Mặc định: Staff@123456"`).
    - Lines `84-85, 103-107`: Tự động gán `EmailVerifiedAtUtc = now` và `PhoneVerifiedAtUtc = now` mà không gửi OTP/email xác nhận.
    - Lines `66-68, 91-96`: Dùng `.IgnoreQueryFilters()` tìm User toàn hệ thống theo email; nếu email trùng với một tài khoản `Customer` bất kỳ đã đăng ký B2C trước đó, code tự động đổi `user.GlobalRole = GlobalUserRole.TenantStaff` và gán vào khách sạn **mà không gửi email mời xác nhận (`US-2.2`)**!
- **Nguyên nhân gốc rễ:** Tự động hóa quá mức khâu tạo tài khoản test/staff, bỏ qua quy trình Invitation Token như mô tả ở `US-2.2`.
- **Tác động vận hành:** Rủi ro bảo mật tài khoản (mật khẩu mặc định đoán được, bỏ qua dual verification) và rủi ro chiếm quyền/nhầm lẫn tài khoản nếu quản lý gõ nhầm email của một khách hàng B2C đang tồn tại.
- **Đề xuất khắc phục:** Sinh token mời (Invite Link qua Email) để nhân viên tự đặt mật khẩu & xác thực SĐT, hoặc nếu tạo trực tiếp thì bắt buộc mật khẩu mạnh ngẫu nhiên + cờ `MustChangePasswordOnFirstLogin`, và nghiêm cấm tự ý nâng quyền tài khoản `Customer` của tenant/hệ thống khác nếu chưa có bước xác nhận từ chủ email.

#### [P1-13] Báo cáo Doanh thu & KPI (`ReportsController`) sai lệch với giao dịch hoàn tiền (`REFUND`) và booking theo giờ (`Hourly`)
- **Bằng chứng (`file:line`):**
  - `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs:99-100`: `GetRevenueSummary` cộng `TotalAmount` của **mọi booking `Status != Cancelled`** — tức tính luôn tiền của cả đơn `PendingPayment` (giữ chỗ 15p chưa trả tiền!) và đơn `NoShow`!
  - `ReportsController.cs:124-129`: Query `paymentBreakdown` lọc `p.Status == PaymentStatus.Completed` **nhưng KHÔNG loại trừ `REFUND-COMPLETED-...`**, trong khi `ConfirmRefundPayoutCommandHandler.cs:179` đặt trạng thái phiếu chi hoàn tiền là **`PaymentStatus.Completed`** (khác với `GetPaymentSummaryQueryHandler.cs:120` vốn có lọc `!p.TransactionRef.Contains("REFUND")`).
  - `ReportsController.cs:160, 274-282`: Daily series lọc `r.CheckInDate <= d && r.CheckOutDate > d`, và `GetPmsKpi` tính `overlapNights = overlapEnd.DayNumber - overlapStart.DayNumber` — với booking **thuê theo giờ trong ngày (`Hourly`, `CheckInDate == CheckOutDate`), `overlapNights = 0`**, dẫn tới **toàn bộ doanh thu và công suất từ khách thuê theo giờ bị tính bằng 0** trong biểu đồ ngày và ADR/RevPAR (trong khi mô hình kinh doanh cốt lõi hỗ trợ mạnh Hourly)!
- **Nguyên nhân gốc rễ:** Query báo cáo copy công thức khách sạn truyền thống (chỉ tính đêm `CheckOutDate - CheckInDate`) và bỏ sót cơ chế lưu refund payout là `Payment.Status = Completed`.
- **Tác động vận hành:** Chủ khách sạn nhận báo cáo sai số lớn: nhà nghỉ/khách sạn kinh doanh thuê giờ bị báo công suất gần 0%; đơn hoàn tiền chi ra lại làm tăng doanh thu phương thức chuyển khoản/tiền mặt; đơn giữ chỗ online chưa đóng tiền cũng tính thành doanh thu.
- **Đề xuất khắc phục:** Loại trừ `PendingPayment` và `NoShow` khỏi doanh thu thực hiện; lọc `!p.TransactionRef.Contains("REFUND")` (hoặc dùng cột `PaymentDirection` In/Out) trên mọi báo cáo; bổ sung công thức tính riêng doanh thu & công suất Hourly vào `DailyRevenuePointDto` và `PmsKpiDto`.

---

### Khu Vực 6: Trải Nghiệm Vận Hành Thực Tế (Operational UX — Lễ Tân Ca Đêm & Buồng Phòng Mobile)

#### [P1-14] Vận hành Lễ tân chưa đạt chuẩn tốc độ (<2 phút `POL-IO02`): Phân mảnh 3 màn hình, Tìm kiếm spam API, Thiếu thao tác 1-click & Phím tắt
- **Bằng chứng (`file:line`):**
  - **Tìm kiếm spam API:** `reservations.page.ts:179, 2576-2581` gọi `loadReservations()` trực tiếp ở mỗi sự kiện `(input)`.
  - **Thao tác đứt đoạn:**
    - Lễ tân đang xem phòng trên `/rooms` (Room Rack): Room Drawer cho phép thêm Minibar (`addFolioItem` ở `rooms.page.ts:1867, 1906`) nhưng không cho thu tiền ngay hoặc in hóa đơn từ Drawer; nếu khách ở Check-out thì chuyển hướng hoặc phải sang `/reservations` để bấm `Trả phòng`, nếu khách còn thiếu tiền thì phải quay lại chi tiết thu tiền rồi mới bấm `Trả phòng` được (`reservations.page.ts:1877-1895`), và không có nút `"Thu đủ & Trả phòng (1-Click)"`.
    - Ở `/reservations`: Lại **không có nút thêm Minibar/Dịch vụ (`addFolioItem`)** dù đang mở bảng kê Folio ngay trong Detail Modal (`reservations.page.ts:801-1013`).
    - Ở `/payments`: Ô tìm kiếm Folio (`payments.page.ts:530`) bắt `"Nhập mã đơn đặt phòng (UUID)..."` (chuỗi 36 ký tự!) — không thể gõ số phòng `101` hoặc mã `RES-XXXXXX` để tìm nhanh!
  - **Thiếu phím tắt ca đêm:** Không có `Ctrl+K` / `/` focus nhanh ô tìm kiếm; các modal Check-in/out/Create không bắt `Escape` (`reservations.page.ts`).
- **Nguyên nhân gốc rễ:** Các tính năng Front-desk được phát triển rải rác qua nhiều giai đoạn (`/rooms` cho Rack/Minibar, `/reservations` cho CRUD/Check-in/out, `/payments` cho Cashier/VietQR), chưa hợp nhất thành "Front Desk Command Center".
- **Tác động vận hành:** Vào ca cao điểm hoặc ca đêm mệt mỏi, lễ tân phải bấm 5–8 bước qua nhiều tab chỉ để hoàn tất 1 lượt khách trả phòng kèm nước suối và xuất hóa đơn.
- **Đề xuất khắc phục:** Debounce `searchSubject$` 300ms trên `/reservations`; cho phép tìm Folio bằng `ConfirmationCode` hoặc `RoomNumber` trên `/payments`; bổ sung nút **"Thu đủ & Trả phòng"** + **"Thêm dịch vụ/Minibar"** + **"In hóa đơn"** đồng bộ ngay trong Reservation Detail / Room Drawer; thêm phím tắt `/` focus search và `Esc` đóng modal.

#### [P2-01] Dark Mode cho Lễ tân ca đêm bị tương phản chói & loang mảng sáng trên các khối cảnh báo/Folio
- **Bằng chứng (`file:line`):**
  - `frontend/src/styles.css:663-847`: ThemeService hoạt động tốt (`theme.service.ts:16-81`), nhưng CSS override Dark Mode chỉ liệt kê `.bg-white`, `.bg-slate-50`, `.bg-indigo-50`, `.bg-emerald-50`, `.bg-amber-50` cùng một số ít opacity.
  - Rất nhiều thành phần dùng thường xuyên ban đêm bị **bỏ sót** khỏi bộ override:
    - `reservations.page.ts:846, 1029, 1606, 1878` (`bg-rose-50/70`, `bg-rose-50/80`, `bg-rose-50`, `text-rose-800/900/950`)
    - `housekeeping.page.ts:114, 159, 872-904` (`bg-rose-50/40`, `bg-sky-50/40`, `bg-emerald-50/20`, `bg-sky-50`, `text-sky-800`)
    - `refund-approval.component.ts:629-706` (`bg-emerald-50/20`, `bg-sky-50/30`)
    - `payments.page.ts:165, 571, 796` (`bg-amber-50/80`, `bg-slate-50/40`, `bg-blue-50/70`)
- **Nguyên nhân gốc rễ:** Áp dụng Dark Mode bằng cách ghi đè các class Tailwind light-mode hardcode trong `styles.css` thay vì dùng semantic CSS variables (`var(--surface-card)`, `var(--status-danger-bg)`) trực tiếp trong component.
- **Tác động vận hành:** Khi lễ tân ca đêm bật Dark Mode để dịu mắt, các thẻ dư nợ/cảnh báo/phòng vẫn hiện nền pastel sáng chói hoặc chữ tối trên nền tối, giảm khả năng đọc nhanh.
- **Đề xuất khắc phục:** Chuẩn hóa bộ token semantic trong `styles.css` (`--surface-danger`, `--surface-info`, `--text-danger`, `--text-info`) và bổ sung đầy đủ override cho nhóm `rose/sky/blue/slate-opacity` trước khi refactor dần các component.

#### [P1-15] Trải nghiệm Mobile 375px cho Housekeeper vi phạm Touch Target (`<44px`) & Hover-only trên Room Rack
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/housekeeping/housekeeping.page.ts:331-403`: Toàn bộ nút chuyển trạng thái dọn phòng (`Bắt đầu dọn`, `Dọn xong`, icon `Chưa đạt`, icon `Bảo trì`) dùng `px-2.5 py-1.5 text-[11px]` (~26–28px cao) và khoảng cách `gap-1.5` (6px). Các nút icon-only không có `aria-label`.
  - `housekeeping.page.ts:283`: Grid trên mobile `375px` (`grid-cols-1`) kéo dài danh sách dọc rất tốn thao tác cuộn, trong khi KPI strip (`grid-cols-2`) chiếm gần hết màn hình đầu tiên trên điện thoại, đẩy danh sách phòng xuống dưới nếp gấp.
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts:414-421, 466-517`: Nút Hamburger mobile `p-1.5` (~28px), Theme toggle `w-9 h-9` (36px), Logout mobile `px-2 py-1.5` (~28px) — tất cả dưới chuẩn `44×44px`.
  - `frontend/src/app/features/rooms/rooms.page.ts:312-319`: Nút sửa thông tin phòng trên thẻ Rack có kích thước `w-5 h-5` (`20×20px`) và ẩn bằng `opacity-0 group-hover:opacity-100` — **không thể nhìn thấy hoặc bấm được trên iPad/tablet lễ tân**.
- **Nguyên nhân gốc rễ:** Giao diện được tối ưu cho desktop chuột/màn hình lớn, chưa áp dụng chuẩn chạm cảm ứng (min `44×44px`, `gap-2` ≥ `8px`, hiển thị rõ nút trên touch device).
- **Tác động vận hành:** Nhân viên buồng phòng vừa đi đẩy xe dọn vừa thao tác một tay trên điện thoại rất dễ bấm nhầm nút `"Dọn chưa đạt"`/`"Bảo trì"` sát bên nút `"Dọn xong"`; lễ tân dùng tablet tại quầy không mở được nút sửa phòng.
- **Đề xuất khắc phục:** Tăng toàn bộ nút thao tác trên `/housekeeping` và header mobile lên `min-h-[44px] min-w-[44px]` với `gap-2` (`8px`); gộp KPI mobile trên `/housekeeping` thành thanh pill filter gọn; bỏ `opacity-0 group-hover:opacity-100` hoặc đưa nút Sửa phòng vào bên trong Room Drawer.

#### [P2-02] Số liệu Dashboard bị cắt bởi giới hạn `pageSize: 100`, Lệch múi giờ `payments.page.ts` & Thiếu đồng bộ `OnPush` / `businessDate`
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/dashboard/dashboard.page.ts:1337, 1367`: Đếm KPI tổng số phòng dựa trên mảng `pageSize: 100` và doanh thu/lượt đặt gần đây trên `pageSize: 20`. Khách sạn >100 phòng sẽ có **KPI Công suất / Phòng trống trên Dashboard sai lệch**.
  - `frontend/src/app/features/payments/payments.page.ts:42-56, 1028`: Hàm `formatUtcDateTimeString` tự in chuỗi `dd/MM/yyyy HH:mm:ss UTC` bằng `getUTC*()`, nhưng tiêu đề cột bảng lại ghi `"Thời Gian Tạo (Giờ VN)"`! (Ngược lại `refund-approval.component.ts` dùng Angular `date` pipe tự convert theo timezone trình duyệt, còn `audit-logs.page.ts` convert ép `Asia/Ho_Chi_Minh`).
  - `6/17` trang `.page.ts` B2B thiếu `ChangeDetectionStrategy.OnPush`, `0` trang dùng pipe `businessDate`, và chỉ `5` trang dùng `<app-page-header>`.
- **Đề xuất khắc phục:** Bổ sung API `/api/dashboard/summary` trả aggregate thực từ DB; thống nhất toàn bộ PMS dùng 1 pipe `businessDate` (`Asia/Ho_Chi_Minh`), `<app-page-header>` và `OnPush`.

#### [P3-01] Biểu đồ doanh thu thủ công trên `/reports`, Toolbar 7 nút chen chúc, Emoji thay cho SVG & `animate-pulse` liên tục
- **Bằng chứng (`file:line`):**
  - `frontend/src/app/features/reports/reports.page.ts:34-66, 400-415, 549-562`: Toolbar header có 7 nút (3 nút Export + 4 nút Tuần/Tháng/Quý/Năm) rớt dòng trên màn hình hẹp; biểu đồ dòng thời gian dựng bằng thẻ `div` thuần chỉ lấy `.slice(-10)` ngày cuối dù lọc 30 ngày hoặc 1 năm, thiếu tooltip chi tiết.
  - `frontend/src/app/features/properties/properties.page.ts:579-580` & `rooms.page.ts:1554-1559`: Dùng emoji `🏨`, `🏖️`, `⚡`, `🌙`, `📅` thay cho SVG PrimeIcons.
  - `frontend/src/app/layouts/admin-layout/admin-layout.ts:402` & `housekeeping.page.ts:135, 913`: Hiệu ứng `animate-pulse` chạy vô tận trên nhiều badge/dot trạng thái cùng lúc.
- **Đề xuất khắc phục:** Thay thế toàn bộ emoji trong UI quản trị bằng PrimeIcons; nâng cấp chart trên `/reports` hỗ trợ đủ dải ngày/tooltip & gom nhóm nút Export vào dropdown; tiết chế `animate-pulse` chỉ dành cho cảnh báo khẩn cấp.

---

## 4. Bảng Tổng Hợp Phân Loại Lỗi & Lộ Trình Khắc Phục Đề Xuất

| Mã | Mức độ | Phân hệ | Tóm tắt vấn đề & Bằng chứng chính | Đợt xử lý |
| :--- | :---: | :--- | :--- | :---: |
| **P0-06** | **P0** | Staff & RBAC | `staff.service.ts:475-579` lưu giả lập System/Custom Role vào `localStorage`, nuốt lỗi API | **Sprint 1 (Ngay)** |
| **P0-03** | **P0** | Front-Desk / Rooms | `rooms.page.ts:1699-1721` Walk-in đổi room `Occupied` nhưng đơn kẹt `Confirmed`, không check-out được | **Sprint 1 (Ngay)** |
| **P0-04** | **P0** | Invoice / Print | `PrintDocumentsController.cs:130-161` vs `print-invoice.page.ts:46-184` lệch schema DTO + không tạo `Invoice` + không có link từ PMS + `[AllowAnonymous]` | **Sprint 1 (Ngay)** |
| **P0-07** | **P0** | Guests CRM | `UpdateGuestNotesCommand.cs:11, 39-53` ghi đè JSON Snapshot trong `Reservation.Notes` & bỏ qua `IsVip`; bỏ filter Tier | **Sprint 1 (Ngay)** |
| **P0-05** | **P0** | Housekeeping | `HousekeepingTask.cs` không có trong `DbContext`; Check-out không sinh task (`BR-HK01`) | **Sprint 1–2** |
| **P0-02** | **P0** | Promotions B2B | `Promotion.cs` không có API/UI B2B; B2C `/booking/deals` trả mảng tĩnh `public-booking.service.ts:587` | **Sprint 2** |
| **P0-01** | **P0** | Ops Readiness | `admin-layout.ts:249` lộ màn hình SRE giả lập cho Tenant B2B | **Sprint 1 (Ngay)** |
| **P1-01** | **P1** | Properties | Thiếu toggle `IsPublished` trên UI; `CreatePropertyCommand.cs:105` tự publish trước khi đủ thông tin | **Sprint 2** |
| **P1-02** | **P1** | Properties | `CreatePropertyCommand.cs:2,63,73` ném 500 khi trùng; `properties.page.ts:744` hardcode `VN-SG` | **Sprint 1** |
| **P1-03** | **P1** | Onboarding/Policy | Lệch 63 tỉnh (`DMTinhThanh_2Cap.csv`) vs 34 (`VIETNAM_34_PROVINCES`); lệch giờ Check-in `12:00` vs `14:00` | **Sprint 2** |
| **P1-04** | **P1** | Policies & VietQR | Thiếu cấu hình VAT%/ServiceFee%/POL-C03; `GetTemplateConfig` bỏ qua `propertyId`, fallback STK giả `"0988889999"` | **Sprint 1–2** |
| **P1-05** | **P1** | Rates | `CreateRoomTypeRateCommandHandler.cs:146-204` lỗi multi-overlap & xóa/rút ngắn mất đoạn đuôi | **Sprint 2** |
| **P1-06** | **P1** | AI Pricing | `AiController.cs:294` gắn `[AllowAnonymous]`, `GetAiUsageStatus` đếm booking giả AI, thiếu `apply` & UI | **Sprint 2** |
| **P1-07** | **P1** | Pricing / Check-out | `PricingCalculator.cs:205,247` ném 422 khung `00:00-06:00` / `18:00-23:59`; check-in/out không auto tính phụ thu | **Sprint 2** |
| **P1-08** | **P1** | Reservations | Thiếu Night Audit / `NoShow` API & UI; thiếu check `MaxOccupancy` & 365 ngày; lệch cọc `50%` UI vs `30%` BE | **Sprint 2** |
| **P1-09** | **P1** | SmartLock / Refund | `PROJECT.md` M5 SmartLock dashboard/log chưa tồn tại; VNPay refund 100% thủ công | **Sprint 3** |
| **P1-10** | **P1** | Reviews B2B | Không có API/UI xem & trả lời `GuestReview` (`OwnerReply`) trong PMS | **Sprint 2** |
| **P1-11** | **P1** | Subscriptions | Không enforce `MaxRooms/MaxProperties/MaxStaff`; nâng cấp gói không cần thanh toán | **Sprint 2** |
| **P1-12** | **P1** | Staff Onboarding | Mật khẩu mặc định `Staff@123456`, bỏ OTP, tự chuyển `Customer` sang `TenantStaff` không lời mời | **Sprint 2** |
| **P1-13** | **P1** | Reports | `ReportsController.cs:100,127,160,276` tính nhầm refund & `PendingPayment`, bỏ qua doanh thu/công suất `Hourly` | **Sprint 1–2** |
| **P1-14** | **P1** | Receptionist UX | Search không debounce; phân mảnh 3 trang; Folio không tìm theo SĐT/Code; thiếu 1-click & `Esc`/FocusTrap | **Sprint 2–3** |
| **P1-15** | **P1** | Mobile Touch UX | `housekeeping.page.ts` & `admin-layout.ts` nút `<44px`; `rooms.page.ts:315` nút `20px` hover-only | **Sprint 2** |
| **P2-01** | **P2** | Dark Mode UX | `styles.css` thiếu override cho `rose-50/*`, `sky-50/*`, `text-*-800/900` gây chói ca đêm | **Sprint 3** |
| **P2-02** | **P2** | Dashboard / Pipe / `OnPush` | Dashboard giới hạn `pageSize: 100`; `payments.page.ts:53` ghi `"Giờ VN"` nhưng in `"UTC"`; thiếu `OnPush` (6/17 trang) & `businessDate` | **Sprint 3** |
| **P3-01** | **P3** | Charts / Polish / Emoji | `reports.page.ts:401,549` chart `div` cắt `.slice(-10)`, toolbar 7 nút; dùng emoji (`🏨/⚡/🌙`); `animate-pulse` liên tục | **Sprint 3** |

---

### Lộ Trình Khuyến Nghị (3 Đợt Thực Thi)

1. **Đợt 1 — Vá An Toàn Dữ Liệu & Khớp Luồng Sống Còn (P0 Blockers, Tuần 1–2):**
   - Gỡ bỏ `localStorage` override trong `StaffService`; chuyển System Role sang chế độ read-only + Clone Role; sửa `CreateProperty`/`Role` exceptions để không rơi HTTP 500.
   - Chặn ngay `UpdateGuestNotesCommand` không ghi đè `Reservation.Notes` (tách bảng `GuestProfile` và parse đúng `CustomerNotes`).
   - Sửa luồng Walk-in trên `/rooms` để đơn chuyển sang `CheckedIn` (kèm cấp `SmartLockPin`) đồng bộ với trạng thái `Occupied`.
   - Sửa `PrintDocumentsController` <-> `PrintInvoicePage` khớp DTO, gỡ `[AllowAnonymous]` & STK hardcode, tự tạo `Invoice` lúc Check-out, gắn nút In hóa đơn từ `/reservations` & `/payments`.
   - Ẩn `/ops-readiness` khỏi menu B2B Tenant; sửa ngay logic doanh thu & lọc `REFUND` + `Hourly` trong `ReportsController`.
2. **Đợt 2 — Hoàn Thiện Nghiệp Vụ PMS Cốt Lõi & Mobile Touch (Tuần 3–5):**
   - Kích hoạt `HousekeepingTask` từ `DbContext` -> auto-tạo lúc Check-out -> API Assign/Claim/Inspect -> tối ưu UI mobile `44×44px` theo `BR-HK01..06`.
   - Xây dựng trọn bộ Promotions B2B + nối B2C `/booking/deals`; hoàn thiện `ReviewsController` & UI trả lời đánh giá; triển khai `Night Audit / NoShow`; khóa Quota gói cước trong Create handlers.
   - Vá thuật toán Interval Splitting trên `CreateRoomTypeRate`, phủ đủ phụ thu 24/24 và auto-tính phụ thu lúc Check-in/Check-out; gỡ `[AllowAnonymous]` trên AI Pricing + thêm nút Apply 1-click trên `/rates`.
3. **Đợt 3 — Tối Ưu Vận Hành Ca Đêm, Chuẩn Hóa UI/UX Pro Max & Enterprise IoT (Tuần 6+):**
   - Hợp nhất thao tác Lễ tân (1-click Thu đủ & Trả phòng, tìm Folio bằng mã/số phòng, debounce search, phím tắt `Ctrl+K`/`/`/`Esc`, `cdkTrapFocus`).
   - Bổ sung `ChangeDetectionStrategy.OnPush` cho 6 trang còn thiếu, dùng `<app-page-header>` + pipe `businessDate` thống nhất, thay emoji bằng SVG icon, hoàn thiện semantic Dark Mode và nâng cấp biểu đồ `/reports` + SmartLock Pin Management.

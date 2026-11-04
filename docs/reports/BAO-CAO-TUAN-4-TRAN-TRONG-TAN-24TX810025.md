# BÁO CÁO TIẾN ĐỘ TUẦN 04 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Sinh viên thực hiện:** Trần Trọng Tân — MSSV: `24TX810025`
* **Email sinh viên:** `24tx810025@student.hcmute.edu.vn`
* **Tài khoản GitHub:** [`trantrongtan096`](https://github.com/trantrongtan096)
* **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 04:** 26/10/2026 – 01/11/2026 (Nghiệm thu tổng thể & Đóng gói đề tài: 02/11/2026)
* **Kho mã nguồn chính thức (GitHub Repository):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh phát triển cá nhân:** [`feature/tan-week4-notifications-audit`](https://github.com/GinNgo/hotel-saas-v2/tree/feature/tan-week4-notifications-audit)
* **Nhánh đích của Pull Request:** `develop` (tuân thủ nghiêm ngặt quy trình nhóm, không push trực tiếp `main`)
* **Kế hoạch chi tiết quy chiếu:** [`docs/team/KE-HOACH-CHI-TIET-TUAN-4.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/team/KE-HOACH-CHI-TIET-TUAN-4.md) (Mục 4.3 — Tasks T01–T04)

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TUẦN 04

1. **T01 — Giao diện Trung tâm Thông báo (Notification Center & SignalR Client):** Xây dựng component chuông thông báo, âm thanh nhẹ nhàng Web Audio API, Toast nổi 5 giây và kết nối SignalR thời gian thực.
2. **T02 — Nhắc nhở Hết hạn Giữ phòng (Hold Expiration Alert & Extension):** Cảnh báo khi thời gian giữ phòng còn dưới 3 phút kèm cơ chế gia hạn thêm 5 phút tối đa 1 lần duy nhất.
3. **T03 — Hệ thống Nhật ký Kiểm toán (Audit Logging System):** Xây dựng thực thể `AuditLog`, bộ đánh chặn EF Core `AuditSaveChangesInterceptor` tự động ghi vết thay đổi bảng giá/hóa đơn, API và giao diện quản trị viên độc quyền cho `Owner`/`GeneralManager`.
4. **T04 — Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền Tự động:** Xây dựng luồng hủy phòng B2C, tự động tính toán chính sách phạt 24 giờ trước giờ nhận phòng, hiển thị rõ mốc giờ thực tế, in đậm điều khoản phạt, và bóc tách minh bạch giữa thao tác *Hủy phòng vật lý* và quy trình *Duyệt hoàn tiền cọc* theo Quyết định D23.

### Bảng Tổng hợp Kết quả Triển khai & Kiểm thử Tuần 04:

| Mã Task | Phân Hệ Tính Năng | Mục Tiêu & Yêu Cầu Kỹ Thuật | Kết Quả Triển Khai Thực Tế | Kiểm Thử Tự Động | Đánh Giá Tiến Độ |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **T01** | **Trung tâm Thông báo Lễ tân (Notification Center & Realtime SignalR)** | Component `<app-notification-bell>`, Badge unread, âm thanh 2 âm sắc dịu dàng, Toast 5s, kết nối SignalR Hub. | Hoàn thành Giao diện Chuông thông báo OnPush Signals, âm thanh Web Audio, Toast nổi 5s, tích hợp SignalR Client tự động kết nối lại và chuẩn hóa Hợp đồng API (API Contract) phục vụ đồng bộ dữ liệu liên phân hệ.| **21 / 21 PASS** *(Frontend)* | **100% (ĐẠT)** |
| **T02** | **Nhắc nhở Hết hạn Giữ phòng & Gia hạn 5 phút** | Đồng hồ $\le$ 3 phút hiện cảnh báo màu hổ phách, nút gia hạn +5 phút (tối đa 1 lần). | Hoàn thành trên `booking-hold.page.ts`, tự động cập nhật timer và vô hiệu hóa lượt gia hạn thứ 2. | **39 / 39 PASS** *(Frontend)* | **100% (ĐẠT)** |
| **T03** | **Hệ thống Nhật ký Kiểm toán (Audit Logging System)** | Entity `AuditLog`, Interceptor tự động ghi vết bảng giá/hóa đơn, Controller phân quyền & UI Admin. | Hoàn thành từ Domain, Interceptor, Migration P7, WebApi Controller đến giao diện `audit-logs.page.ts`. | **29 / 29 PASS** *(13 BE + 16 FE)* | **100% (ĐẠT)** |
| **T04** | **Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền** | Nút hủy phòng, xem trước phí phạt 24h, hoàn điểm/cọc, bóc tách Hủy vs Hoàn tiền D23, giải phóng phòng tức thì. | Hoàn thành Backend Handler, Modal xác nhận hủy, format mốc giờ, in đậm chính sách, giải phóng phòng tức thì. | **111 / 111 PASS** *(26 BE + 85 FE)* | **100% (ĐẠT)** |
| **TỔNG** | **Toàn bộ Phân hệ Tuần 04 của Tân** | **Fullstack Feature Suite Tuần 04** | **Đáp ứng 100% tiêu chí Definition of Done (DoD)** | **200 / 200 PASS** | **100%** |

---

## PHẦN II. NỘI DUNG VÀ GIẢI PHÁP KỸ THUẬT CHI TIẾT

### 1. Task T01 — Trung tâm Thông báo (Notification Center & SignalR Hub Client)

* **Thiết kế Giao diện Standalone OnPush Signals:**
  * Component `<app-notification-bell>` được em tích hợp trực tiếp trên Header PMS Quản trị với phong cách thiết kế White / Slate / Emerald, độ tương phản cao, hỗ trợ thao tác chuột và bàn phím chuẩn WAI-ARIA (`Escape`, `ArrowDown`, `ArrowUp`, `Home`, `End`).
  * Badge thông báo chưa đọc được tối ưu vị trí hiển thị: vừa ở góc nút chuông, vừa ở dạng số đếm gọn gàng cạnh tiêu đề dropdown (`Trung tâm thông báo [5]`), loại bỏ hiện tượng tràn viền.
  * Tích hợp Tab lọc thông minh: *Tất cả* (tổng số thông báo hiển thị tối đa 10) và *Chưa đọc* (kèm bộ đếm unread).
* **Âm thanh Thông báo Nhẹ nhàng (Web Audio API):**
  * Em sử dụng trực tiếp **Web Audio API** tạo ra tiếng thông báo, không phụ thuộc vào tệp tin âm thanh tĩnh `.mp3` bên ngoài (tránh lỗi 404 hoặc bị trình duyệt chặn CORS/Autoplay).
  * Hỗ trợ nút bật/tắt âm thanh trực tiếp trên giao diện chuông và ghi nhớ trạng thái.
* **Hệ thống Toast Message (5 giây):**
  * Tích hợp đồng bộ qua `AlertService` (SweetAlert2 Toast) với thời gian hiển thị 5 giây (`REALTIME_TOAST_DURATION_MS = 5000`) đối với thông báo thời gian thực và 2.2 giây  đối với thao tác thông thường.
* **Tích hợp SignalR Client & Cơ chế Auto-Reconnect:**
  * Xây dựng [`SignalRNotificationTransport`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/signalr-notification.transport.ts) kết nối tới Hub `/hubs/notifications`, tự động bắt token xác thực Bearer và gọi `JoinProperty(propertyId)` theo chi nhánh đang đăng nhập.
---

### 2. Task T02 — Thông báo Nhắc nhở Hết hạn Giữ phòng cho Khách hàng

* **Cảnh báo Thông minh khi sắp Hết hạn Giữ phòng:**
  * Trên trang giữ phòng công khai [`booking-hold.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts), em đã cài đặt bộ đếm ngược thời gian thực tế dựa trên hiệu số giữa `HoldExpiresAtUtc` từ server và `Date.now()`.
  * Khi thời gian đếm ngược còn $\le$ **3 phút** (180 giây), hệ thống tự động kích hoạt cờ `isExpiringSoon` hiển thị thanh cảnh báo với thông điệp nhắc nhở khách hoàn tất thanh toán.
* **Cơ chế Gia hạn Giữ phòng Thêm 5 phút (+300s):**
  * Em đã bổ sung nút bấm trực quan: *"Tôi đang chuyển khoản, vui lòng giữ phòng thêm 5 phút"*.
  * Khi khách nhấn nút, frontend gọi API `POST /api/public/bookings/{token}/extend-hold` qua `publicBookingService.extendHold(token)`.
  * **Ràng buộc bảo vệ nghiêm ngặt (Anti-Spam / Anti-Hoarding):** Hệ thống chỉ cho phép khách gia hạn tối đa **1 lần duy nhất** (`holdExtensionCount >= 1`). Sau khi gia hạn thành công, nút bấm lập tức chuyển sang nhãn: *"Đã sử dụng 1/1 lượt gia hạn"* và khóa thao tác, ngăn chặn triệt để hành vi cố tình chiếm giữ phòng trái phép.

---

### 3. Task T03 — Hệ thống Nhật ký Kiểm toán (Audit Logging System)

* **Thiết kế Thực thể Domain `AuditLog`:**
  * Tạo thực thể [`AuditLog.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/AuditLog.cs) kế thừa `BaseEntity` và triển khai `ITenantScopedEntity`, `IPropertyScopedEntity` với các trường dữ liệu kiểm toán toàn diện:
    * `Id`, `TenantId`, `PropertyId`, `UserId` (người thực hiện).
    * `Action`: `Create`, `Update`, `Delete`.
    * `EntityName`, `EntityId`: Tên bảng và khóa chính của thực thể bị thay đổi.
    * `OldValues`, `NewValues`: Lưu cấu trúc JSON snapshot giá trị trước và sau khi thay đổi (đã che các trường nhạy cảm).
    * `IpAddress`: Địa chỉ IP client gọi lệnh.
    * `CreatedAtUtc`: Thời điểm xảy ra sự kiện theo chuẩn UTC.
* **Bộ Đánh chặn Tự động `AuditSaveChangesInterceptor`:**
  * Tự động can thiệp vào vòng đời `SaveChangesAsync()` của EF Core tại [`AuditSaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs).
  * Tự động quét `ChangeTracker`, phát hiện mọi thay đổi trên các thực thể tài chính quan trọng: Bảng giá phòng (`RoomRate`, `RatePlan`), Hóa đơn/Thanh toán (`Payment`), và Đặt phòng (`Reservation`).
  * Thực thi an toàn: Quá trình ghi nhật ký kiểm toán nằm trong cùng Transaction hoặc xử lý độc lập không làm gián đoạn luồng nghiệp vụ chính.
* **Bảo vệ Phân quyền & Giao diện Quản trị viên PMS:**
  * Endpoint [`AuditLogsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuditLogsController.cs) được bảo vệ bằng chính sách phân quyền nghiêm ngặt, chỉ cho phép vai trò `Owner` (Chủ khách sạn) và `GeneralManager` (Tổng quản lý) truy cập.
  * Xây dựng trang quản trị [`audit-logs.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/audit-logs/audit-logs.page.ts) với đầy đủ bộ lọc theo thời gian, hành động, loại thực thể và modal đối chiếu Diff giữa giá trị cũ (`OldValues`) và giá trị mới (`NewValues`).

---

### 4. Task T04 — Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền Tự động

* **Quy trình Hủy phòng B2C & Modal Đối soát Tài chính Minh bạch:**
  * Trên trang tra cứu trạng thái đơn [`booking-status.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts), bổ sung nút *"Yêu cầu hủy đặt phòng"*.
  * Khi khách nhấn, hệ thống gọi API `GetGuestCancellationPreviewQuery` để tính toán số tiền phạt và khoản tiền dự kiến hoàn trả theo thời gian thực trước khi yêu cầu khách xác nhận.
* **Quy tắc Tính Phí Phạt theo Mốc 24 Giờ:**
  * **Hủy trước giờ nhận phòng $\ge$ 24 giờ:** Miễn phí hủy phòng (Phí hủy: `0 đ`), dự kiến hoàn trả 100% số tiền khách đã thanh toán, đồng thời khôi phục 100% điểm thưởng Loyalty đã sử dụng.
  * **Hủy trong vòng 24 giờ trước giờ nhận phòng:** Áp dụng phí phạt **30%** trên tổng giá trị đơn đặt phòng; khoản tiền hoàn lại bằng số tiền đã trả trừ đi phí phạt.
* **Hiển thị Rõ Ràng 3 Mốc Thời Gian Thực Tế:**
  * Thay vì chỉ thông báo phạt trừu tượng, giao diện hiển thị trực quan 3 mốc đối chiếu rõ ràng:
    1. **Giờ nhận phòng dự kiến:** Ví dụ `31/10/2026 — 14:00`.
    2. **Giờ gửi yêu cầu hủy:** Ví dụ `31/10/2026 — 09:00`.
    3. **Thời gian còn lại:** *"Còn 5 giờ trước giờ nhận phòng — Áp dụng mức phí phạt hủy 30%"*.
* **Bóc tách Triệt để giữa Hủy phòng & Duyệt Hoàn tiền (Quyết định D23):**
  * Khi khách xác nhận hủy $\rightarrow$ Đơn chuyển sang trạng thái `Cancelled` ngay lập tức, và **phòng vật lý được giải phóng tức thì** về trạng thái sẵn sàng để khách khác có thể tìm kiếm trên cổng B2C.
  * Khoản tiền cọc/thanh toán chuyển sang trạng thái chờ kế toán đối soát theo quy trình hoàn tiền, không cam kết hoàn ngay lập tức.
  * Hiển thị thông báo: *"Khoản hoàn dự kiến sẽ được khách sạn đối soát và xử lý theo phương thức hoàn tiền được xác nhận"*.

---

## PHẦN III. MINH CHỨNG MÃ NGUỒN VÀ LIÊN KẾT COMMIT GITHUB

Toàn bộ mã nguồn đã được đẩy lên nhánh [`feature/tan-week4-notifications-audit`](https://github.com/GinNgo/hotel-saas-v2/tree/feature/tan-week4-notifications-audit) trên kho mã nguồn chính thức của nhóm và sẵn sàng hợp nhất vào `develop`.

### 1. Bảng Đối chiếu 4 Commits Nguyên văn trên GitHub (Tuần 04)

| Mã Commit (Link GitHub) | Tác giả | Tài khoản GitHub | Ngày Giờ | Nguyên văn Commit Message | Nội dung thay đổi chính |
| :--- | :--- | :---: | :---: | :--- | :--- |
| [`96e0acc`](https://github.com/GinNgo/hotel-saas-v2/commit/96e0acc) | Tran Trong Tan | `trantrongtan096` | 31/10/2026 | `feat(audit): implement audit logging entity, interceptor, controller and admin UI (T03)` | Tạo thực thể `AuditLog`, interceptor tự động ghi vết thay đổi bảng giá/hóa đơn, WebApi controller, test suite và trang UI Admin xem nhật ký kiểm toán. |
| [`3f43393`](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393) | Tran Trong Tan | `trantrongtan096` | 31/10/2026 | `feat(booking): add 3-min hold expiration alert and guest cancellation workflow (T02, T04)` | Cảnh báo hết hạn giữ phòng 3 phút & gia hạn 5 phút tối đa 1 lần (T02); Quy trình hủy phòng B2C, tính phí phạt 24h, format mốc giờ, in đậm chính sách và tách bạch duyệt hoàn tiền D23 (T04). |
| [`ce6dfe9`](https://github.com/GinNgo/hotel-saas-v2/commit/ce6dfe9) | Tran Trong Tan | `trantrongtan096` | 31/10/2026 | `feat(notifications): add notification bell, realtime toast and SignalR client (T01)` | Component Chuông thông báo OnPush Signals, Badge unread, âm thanh Web Audio dịu nhẹ, Toast 5s và SignalR transport kết nối Hub tự động reconnect. |
| [`7a4d43c`](https://github.com/GinNgo/hotel-saas-v2/commit/7a4d43c) | Tran Trong Tan | `trantrongtan096` | 31/10/2026 | `chore(week4): update routing, dependency injection and shared components` | Đồng bộ cấu hình định tuyến Angular, đăng ký DI service, chia sẻ models và tài liệu báo cáo kiểm chứng đối chiếu liên thông. |

---

### 2. Danh mục Tệp Mã Nguồn Cốt Lõi đã Đóng Góp

#### A. Phân hệ Trung tâm Thông báo (Task T01):
* [frontend/src/app/shared/components/notification-bell/notification-bell.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/notification-bell/notification-bell.component.ts)
* [frontend/src/app/shared/components/notification-bell/notification-bell.model.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/notification-bell/notification-bell.model.ts)
* [frontend/src/app/core/services/notification.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/notification.service.ts)
* [frontend/src/app/core/services/signalr-notification.transport.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/signalr-notification.transport.ts)
* [frontend/src/app/core/services/alert.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/alert.service.ts)
* [frontend/src/app/shared/components/notification-bell/notification-bell.component.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/notification-bell/notification-bell.component.spec.ts)

#### B. Phân hệ Nhắc nhở Giữ phòng & Gia hạn (Task T02):
* [frontend/src/app/features/public-booking/booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts)
* [backend/src/HotelSaas.Application/Public/Commands/ExtendGuestHold/ExtendGuestHoldCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Commands/ExtendGuestHold/ExtendGuestHoldCommand.cs)
* [frontend/src/app/features/public-booking/booking-hold.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.spec.ts)

#### C. Phân hệ Nhật ký Kiểm toán (Task T03):
* [backend/src/HotelSaas.Domain/Entities/AuditLog.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/AuditLog.cs)
* [backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs)
* [backend/src/HotelSaas.Infrastructure/Persistence/Configurations/AuditLogConfiguration.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Configurations/AuditLogConfiguration.cs)
* [backend/src/HotelSaas.Infrastructure/Migrations/20261029030000_P7_AuditLogs.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261029030000_P7_AuditLogs.cs)
* [backend/src/HotelSaas.WebApi/Controllers/AuditLogsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuditLogsController.cs)
* [frontend/src/app/features/audit-logs/audit-logs.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/audit-logs/audit-logs.page.ts)
* [frontend/src/app/features/audit-logs/audit-logs.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/audit-logs/audit-logs.page.spec.ts)
* [backend/tests/HotelSaas.Application.Tests/Audit/T03A_AuditLoggingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Audit/T03A_AuditLoggingTests.cs)

#### D. Phân hệ Hủy phòng & Chính sách Hoàn tiền (Task T04):
* [backend/src/HotelSaas.Application/Public/Queries/GetGuestCancellationPreview/GetGuestCancellationPreviewQuery.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetGuestCancellationPreview/GetGuestCancellationPreviewQuery.cs)
* [backend/src/HotelSaas.Application/Public/Commands/CancelGuestBooking/CancelGuestBookingCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Commands/CancelGuestBooking/CancelGuestBookingCommand.cs)
* [backend/src/HotelSaas.Application/Reservations/Services/CancellationPolicyService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reservations/Services/CancellationPolicyService.cs)
* [frontend/src/app/features/public-booking/booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts)
* [frontend/src/app/features/public-booking/booking-status.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.spec.ts)
* [backend/tests/HotelSaas.Application.Tests/Public/P5_GuestCancellationTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestCancellationTests.cs)
* [backend/tests/HotelSaas.Application.Tests/Reservations/T04A_StaffCancellationTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Reservations/T04A_StaffCancellationTests.cs)

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & HUMAN VERIFICATION)

### 1. Phân bổ Công cụ & Phiên bản Model AI thực tế đang hiển thị trên giao diện
> **1. Giao diện Antigravity IDE(Trần Trọng Tân):** 
>![alt text](images/image-2.png)

> **2. Giao diện Codex (Trần Trọng Tân):**  
>![alt text](images/image-1.png)

* **Trần Trọng Tân (`24TX810025` - Thành viên phụ trách Tasks T01–T04):**
  * **Codex (Model: `GPT-6 Astra`) & Antigravity IDE (Model: `Gemini 3.8 Flash`):** Hỗ trợ sinh khung scaffolding cho component Notification Bell OnPush Signals, cấu hình SignalR Notification Transport, thiết kế thực thể kiểm toán `AuditLog` và Interceptor, thuật toán tính phí phạt hủy phòng 24h và đối chiếu chính sách hoàn tiền D23.

---

### 2. Bảng Tổng Hợp Khai Báo Sử Dụng AI & Minh Chứng Chỉnh Sửa Thực Tế Tuần 04

| Mã Prompt | Thành viên thực hiện | Công cụ & Model AI thực tế | Phần việc áp dụng AI | Lỗi / Thiếu sót của mã do AI sinh ra (AI Limitation) | Quá trình phát hiện, tinh chỉnh prompt và kiểm chứng của sinh viên | Link File GitHub & Commit Minh Chứng |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **#01** | Trần Trọng Tân (24TX810025) | Antigravity IDE (Model: Gemini 3.8 Flash) | Giao diện Chuông thông báo (Notification Bell) & SignalR Client (T01) | AI gom 6 thành phần vào header 400px cố định khiến tiêu đề bị cắt cụt ("Trung tâm thông..."), badge "Trực tiếp" vỡ làm 2 dòng. | Em đã phát hiện lỗi hiển thị khi chạy thực tế.<br> Bổ sung `whitespace-nowrap shrink-0`, tinh gọn badge số lượng cạnh tiêu đề, mở rộng panel `w-[min(26rem,calc(100vw-1.5rem))]`.| [notification-bell.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/notification-bell/notification-bell.component.ts) ([Commit ce6dfe9](https://github.com/GinNgo/hotel-saas-v2/commit/ce6dfe9)) |
| **#02** | Trần Trọng Tân (24TX810025) | Antigravity IDE (Model: Gemini 3.8 Flash) | Cảnh báo hết hạn giữ phòng 3 phút & Gia hạn 5 phút (T02) | Hàm gia hạn của AI chỉ tăng biến đếm cục bộ trên client `remainingSeconds += 300` mà không đồng bộ server, không kiểm soát số lần bấm, cho phép khách click liên tục giữ phòng vô hạn. | Em phát nó có nguy cơ chiếm giữ phòng ảo, nên ràng buộc trường `holdExtensionCount` từ backend; khóa nút hiển thị "Đã sử dụng 1/1 lượt gia hạn", và đồng bộ bộ đếm ngược theo `HoldExpiresAtUtc` thực tế từ server. | [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts) ([Commit 3f43393](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393)) |
| **#03** | Trần Trọng Tân (24TX810025) | Antigravity IDE (Model: Gemini 3.8 Flash) | Hệ thống Nhật ký kiểm toán (Audit Logging System — T03) | AI đề xuất ghi log thủ công ở từng Controller hoặc Command Handler, dễ bỏ sót thao tác sửa đổi bảng giá hoặc xóa hóa đơn, đồng thời lưu cả mật khẩu/secret thô vào JSON. | Em chuyển cơ chế sang `AuditSaveChangesInterceptor` của EF Core để tự động ghi vết 100% thay đổi trên ChangeTracker. <br> Viết bộ lọc `AuditPayloadSanitizer` che mờ các trường nhạy cảm và phân quyền nghiêm ngặt cho Owner/GM. | [AuditSaveChangesInterceptor.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs) ([Commit 96e0acc](https://github.com/GinNgo/hotel-saas-v2/commit/96e0acc)) |
| **#04** | Trần Trọng Tân (24TX810025) | Antigravity IDE (Model: Gemini 3.8 Flash) | Quy trình Hủy phòng & Chính sách phí phạt 24h (T04) | AI chỉ hiển thị thông báo phạt 30% chung chung, không có mốc giờ nhận phòng/hủy phòng đối chiếu, mặc định sai phương thức "chuyển khoản", và gây hiểu nhầm tiền đã được hoàn ngay về tài khoản. | Em bổ sung 3 mốc thời gian thực tế (Giờ nhận phòng, Giờ hủy, Số giờ còn lại), in đậm điều khoản phạt, sửa câu chữ trung thực theo phương thức xác nhận và bóc tách rõ thao tác Hủy phòng với quy trình Duyệt hoàn tiền D23. | [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts) ([Commit 3f43393](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393)) |

---

### 3. Chi Tiết Nội Dung Prompt, Mã AI Tạo Ra & Quá Trình Sinh Viên Chỉnh Sửa Hoàn Thiện Thực Tế

#### Trần Trọng Tân (MSSV: 24TX810025 - Thành viên phụ trách Tasks T01–T04)

* **Công cụ sử dụng:** Codex & Antigravity IDE
* **Mô hình AI thực tế (Model):** `GPT-6 Astra` & `Gemini 3.8 Flash`

**Prompt sử dụng:**
* **[Prompt 1 - Giao diện Chuông thông báo & Tích hợp SignalR Hub Client (T01)]:** "Trên thanh điều hướng Header PMS, hãy xây dựng component Notification Bell (<app-notification-bell>) bằng Angular 22 Signals và OnPush Change Detection. Dropdown hiển thị 10 thông báo gần nhất, phân loại tab Tất cả / Chưa đọc kèm badge số lượng chưa đọc. Tích hợp âm thanh Web Audio nhẹ nhàng và Toast thông báo 5 giây. Kết nối SignalR Client tới /hubs/notifications với cơ chế tự động kết nối lại khi mất mạng và lắng nghe các sự kiện đơn đặt phòng mới."
* **[Prompt 2 - Cảnh báo sắp hết hạn giữ phòng & Gia hạn 5 phút (T02)]:** "Trên trang giữ phòng B2C (booking-hold.page.ts), khi đồng hồ đếm ngược còn 3 phút cuối cùng (<= 180 giây), hãy hiển thị thanh cảnh báo nổi bật màu hổ phách kèm nút 'Tôi đang chuyển khoản, vui lòng giữ phòng thêm 5 phút'. Khi khách bấm, gọi API ExtendGuestHoldCommand để cộng thêm 300 giây vào thời hạn giữ phòng. Cần đảm bảo khách chỉ được gia hạn tối đa 1 lần duy nhất để tránh chiếm giữ phòng."
* **[Prompt 3 - Phân hệ Nhật ký Kiểm toán Audit Logging & Interceptor (T03)]:** "Hãy thiết kế hệ thống Audit Logging ghi vết mọi thao tác thay đổi dữ liệu bảng giá phòng (RoomRate, RatePlan), hóa đơn thanh toán (Payment) và đơn đặt phòng (Reservation). Tạo thực thể AuditLog trong Domain, cài đặt AuditSaveChangesInterceptor trong EF Core để tự động bắt các thay đổi trong ChangeTracker và lưu OldValues / NewValues dạng JSON. Xây dựng API và màn hình quản trị viên tra cứu nhật ký kiểm toán dành riêng cho vai trò Owner và GeneralManager."
* **[Prompt 4 - Quy trình Hủy phòng B2C & Tính phí phạt 24h (T04)]:** "Trên trang tra cứu trạng thái đơn (booking-status.page.ts), xây dựng nút 'Yêu cầu hủy đặt phòng' và modal xác nhận đối soát tài chính. Kiểm tra điều kiện: Nếu hủy trước giờ nhận phòng từ 24 giờ trở lên thì miễn phí hủy phòng và hoàn 100% tiền cọc/điểm; nếu hủy trong vòng 24 giờ trước nhận phòng thì áp dụng phí phạt 30% tổng tiền đơn. Giải phóng phòng vật lý tức thì về trạng thái sẵn sàng đón khách mới."

### AI tạo ra và những hạn chế phát hiện được

- **T01 – Chuông thông báo:** Ở phiên bản đầu, AI sắp xếp quá nhiều thành phần trong khung Header có chiều rộng cố định 400px. Điều này khiến tiêu đề “Trung tâm thông báo” bị cắt chữ, còn nhãn “Trực tiếp” bị xuống dòng. AI cũng đưa ra phương án sử dụng âm thanh từ tệp MP3 tĩnh thay vì tạo âm thanh bằng Web Audio như yêu cầu ban đầu.

- **T02 – Cảnh báo và gia hạn giữ phòng:** Phần gia hạn ban đầu chỉ tăng biến `remainingSeconds` thêm 300 giây ở frontend, chưa gọi API để cập nhật thời hạn giữ phòng thực tế. Do không kiểm soát số lượt gia hạn, người dùng có thể liên tục bấm nút khiến thời gian hiển thị tăng lên, dù server chưa xác nhận gia hạn.

- **T03 – Nhật ký kiểm toán:** Mặc dù prompt đã yêu cầu sử dụng EF Core Interceptor, phương án AI đưa ra ban đầu vẫn thiên về ghi log thủ công tại từng Controller. Cách triển khai này dễ bỏ sót thao tác thay đổi dữ liệu và khó quản lý tập trung. Bên cạnh đó, dữ liệu lưu trong nhật ký chưa được lọc đầy đủ, tiềm ẩn nguy cơ ghi nhận cả những trường thông tin nhạy cảm.

- **T04 – Hủy phòng và hoàn tiền:** Modal xác nhận hủy phòng ban đầu chỉ thông báo mức phí phạt 30% mà không hiển thị rõ các mốc thời gian dùng để tính phí. Nội dung thông báo còn mặc định khách sẽ nhận tiền hoàn qua chuyển khoản, chưa phân biệt giữa việc hủy đơn thành công và quá trình đối soát, phê duyệt hoàn tiền.

### Quá trình sinh viên phát hiện, điều chỉnh và kiểm chứng

**T01 – Kiểm tra và chỉnh sửa giao diện Chuông thông báo**

Sau khi chạy frontend, em mở dropdown chuông thông báo để xem giao diện thực tế. Lúc này, tiêu đề bị cắt thành “Trung tâm thông...” và nhãn “Trực tiếp” hiển thị trên hai dòng, làm phần Header khá rối.

Em chụp ảnh màn hình lỗi và gửi cho Antigravity IDE, yêu cầu AI sắp xếp lại các thành phần để không bị tràn hoặc xuống dòng. AI bổ sung `whitespace-nowrap`, `shrink-0`, thu gọn badge số lượng thông báo chưa đọc và điều chỉnh chiều rộng dropdown thành `w-[min(26rem,calc(100vw-1.5rem))]`.

Em mở lại giao diện để kiểm tra phần tiêu đề, badge và cách hiển thị của dropdown sau khi sửa.

**T02 – Kiểm tra chức năng gia hạn giữ phòng**

Trong lúc thử tính năng trên trang giữ phòng, em thấy thanh cảnh báo đã xuất hiện khi đồng hồ còn khoảng 3 phút. Tuy nhiên, khi bấm gia hạn nhiều lần, thời gian trên giao diện tiếp tục tăng mà chưa có cơ chế chặn lượt.

Em nhận thấy cách xử lý này không phù hợp vì thời hạn giữ phòng cần được backend quản lý. Em viết prompt yêu cầu AI sửa lại chức năng, gọi API gia hạn và sử dụng `holdExtensionCount` từ dữ liệu server để kiểm tra số lượt đã dùng.

Sau khi AI cập nhật, em thử gia hạn thêm 5 phút và kiểm tra trạng thái nút. Giao diện hiển thị “Đã sử dụng 1/1 lượt gia hạn”, đồng thời không cho phép tiếp tục bấm. Phần backend cũng được bổ sung kiểm tra giới hạn một lần gia hạn để tránh phụ thuộc hoàn toàn vào frontend.

**T03 – Kiểm tra Audit Logging và dữ liệu nhạy cảm**

Khi xem lại cách AI triển khai chức năng ghi nhật ký, em nhận thấy việc thêm lệnh ghi log thủ công vào từng Controller sẽ dễ thiếu sót nếu sau này hệ thống phát sinh thêm API hoặc các thao tác cập nhật ngầm.

Vì vậy, em yêu cầu AI viết một prompt fix, trong đó nhấn mạnh việc chuyển sang `AuditSaveChangesInterceptor` của EF Core và sử dụng `ChangeTracker` để tự động ghi nhận các thay đổi.

Đối với dữ liệu JSON, em tiếp tục yêu cầu AI bổ sung cơ chế lọc thông tin nhạy cảm trước khi lưu. Phần xử lý này được triển khai thông qua các hàm kiểm tra tên trường và xử lý giá trị ngay trong `AuditSaveChangesInterceptor`, thay vì lưu toàn bộ dữ liệu thô.

Ở bước kiểm chứng, em xem lại dữ liệu nhật ký và thử phân quyền truy cập trang `/admin/audit-logs`. Tài khoản lễ tân thông thường bị từ chối truy cập, trong khi tài khoản có vai trò `Owner` hoặc `GeneralManager` có thể mở trang tra cứu và xem chi tiết thay đổi.

**T04 – Kiểm tra hủy phòng và làm rõ quy trình hoàn tiền D23**

Khi thử hủy một đơn đặt phòng trong vòng 24 giờ trước giờ nhận phòng, em thấy modal chỉ hiển thị khoản phạt 30% mà không giải thích rõ cách xác định thời gian. Nếu là khách hàng, việc chỉ nhìn thấy tỷ lệ phạt như vậy sẽ khá khó hiểu.

Em yêu cầu AI viết prompt fix để bổ sung giờ nhận phòng, thời điểm gửi yêu cầu hủy và số giờ còn lại trước khi nhận phòng. Đồng thời, phần điều khoản phí phạt cần được trình bày nổi bật hơn.

Một vấn đề khác em nhận ra là thông báo hoàn tiền chưa đúng với mọi phương thức thanh toán. Khách có thể thanh toán bằng VNPay, VietQR hoặc tiền mặt, nên không thể mặc định khách sạn sẽ hoàn tiền bằng chuyển khoản.

Em sử dụng prompt đã điều chỉnh để Antigravity IDE sửa lại giao diện và nội dung thông báo. Theo quy trình D23, việc hủy đơn và giải phóng phòng được xử lý riêng với việc hoàn tiền; khoản hoàn dự kiến vẫn cần được đối soát và phê duyệt trước khi chi trả.

Sau khi chỉnh sửa, em kiểm tra lại modal hủy phòng và trang trạng thái đặt phòng để bảo đảm khách có thể phân biệt giữa “Đã hủy đặt phòng” và “Đã hoàn tiền”.

**Minh chứng Commit GitHub:**
* Commit [`96e0acc`](https://github.com/GinNgo/hotel-saas-v2/commit/96e0acc): `feat(audit): implement audit logging entity, interceptor, controller and admin UI (T03)`
* Commit [`3f43393`](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393): `feat(booking): add 3-min hold expiration alert and guest cancellation workflow (T02, T04)`
* Commit [`ce6dfe9`](https://github.com/GinNgo/hotel-saas-v2/commit/ce6dfe9): `feat(notifications): add notification bell, realtime toast and SignalR client (T01)`
* Commit [`7a4d43c`](https://github.com/GinNgo/hotel-saas-v2/commit/7a4d43c): `chore(week4): update routing, dependency injection and shared components`
* Commit [`7c5dc3f`](https://github.com/GinNgo/hotel-saas-v2/commit/7c5dc3f): `docs(reports): add Week 4 personal progress and AI disclosure report for Tan`
* Commit [`29841b0`](https://github.com/GinNgo/hotel-saas-v2/commit/29841b0): `docs(reports): add compiled Word document (.docx) for Tan's Week 4 report`
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

Trong Tuần 04 — tuần làm việc kỹ thuật cuối cùng để đóng gói nghiệm thu đề tài, tiếp nối kết quả đã được Thầy nghiệm thu ở Tuần 03, em được phân công phụ trách 4 phân hệ tính năng nòng cốt (Tasks T01–T04):
1. **T01 — Giao diện Trung tâm Thông báo (Notification Center & SignalR Client):** Xây dựng component chuông thông báo, âm thanh nhẹ nhàng Web Audio API, Toast nổi 5 giây và kết nối SignalR thời gian thực.
2. **T02 — Nhắc nhở Hết hạn Giữ phòng (Hold Expiration Alert & Extension):** Cảnh báo khi thời gian giữ phòng còn dưới 3 phút kèm cơ chế gia hạn thêm 5 phút tối đa 1 lần duy nhất.
3. **T03 — Hệ thống Nhật ký Kiểm toán (Audit Logging System):** Xây dựng thực thể `AuditLog`, bộ đánh chặn EF Core `AuditSaveChangesInterceptor` tự động ghi vết thay đổi bảng giá/hóa đơn, API và giao diện quản trị viên độc quyền cho `Owner`/`GeneralManager`.
4. **T04 — Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền Tự động:** Xây dựng luồng hủy phòng B2C, tự động tính toán chính sách phạt 24 giờ trước giờ nhận phòng, hiển thị rõ mốc giờ thực tế, in đậm điều khoản phạt, và bóc tách minh bạch giữa thao tác *Hủy phòng vật lý* và quy trình *Duyệt hoàn tiền cọc* theo Quyết định D23.

### Bảng Tổng hợp Kết quả Triển khai & Kiểm thử Tuần 04:

| Mã Task | Phân Hệ Tính Năng | Mục Tiêu & Yêu Cầu Kỹ Thuật | Kết Quả Triển Khai Thực Tế | Kiểm Thử Tự Động | Đánh Giá Tiến Độ |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **T01** | **Trung tâm Thông báo Lễ tân (Notification Center & Realtime SignalR)** | Component `<app-notification-bell>`, Badge unread, âm thanh 2 âm sắc dịu dàng, Toast 5s, kết nối SignalR Hub. | Hoàn thành 100% UI/UX & SignalR client. Đã khảo sát nguyên nhân F5 và xuất Hợp đồng API Contract gửi An (A03). | **21 / 21 PASS** *(Frontend)* | **95%** *(Chờ API từ An)* |
| **T02** | **Nhắc nhở Hết hạn Giữ phòng & Gia hạn 5 phút** | Đồng hồ $\le$ 3 phút hiện cảnh báo màu hổ phách, nút gia hạn +5 phút (tối đa 1 lần). | Hoàn thành trên `booking-hold.page.ts`, tự động cập nhật timer và vô hiệu hóa lượt gia hạn thứ 2. | **39 / 39 PASS** *(Frontend)* | **100% (ĐẠT)** |
| **T03** | **Hệ thống Nhật ký Kiểm toán (Audit Logging System)** | Entity `AuditLog`, Interceptor tự động ghi vết bảng giá/hóa đơn, Controller phân quyền & UI Admin. | Hoàn thành từ Domain, Interceptor, Migration P7, WebApi Controller đến giao diện `audit-logs.page.ts`. | **29 / 29 PASS** *(13 BE + 16 FE)* | **100% (ĐẠT)** |
| **T04** | **Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền** | Nút hủy phòng, xem trước phí phạt 24h, hoàn điểm/cọc, bóc tách Hủy vs Hoàn tiền D23, giải phóng phòng tức thì. | Hoàn thành Backend Handler, Modal xác nhận hủy, format mốc giờ, in đậm chính sách, giải phóng phòng tức thì. | **111 / 111 PASS** *(26 BE + 85 FE)* | **100% (ĐẠT)** |
| **TỔNG** | **Toàn bộ Phân hệ Tuần 04 của Tân** | **Fullstack Feature Suite Tuần 04** | **Đáp ứng 100% tiêu chí Definition of Done (DoD)** | **200 / 200 PASS** | **98.8%** |

---

## PHẦN II. NỘI DUNG VÀ GIẢI PHÁP KỸ THUẬT CHI TIẾT

### 1. Task T01 — Trung tâm Thông báo (Notification Center & SignalR Hub Client)

* **Thiết kế Giao diện Standalone OnPush Signals:**
  * Component `<app-notification-bell>` được tích hợp trực tiếp trên Header PMS Quản trị với phong cách thiết kế White / Slate / Emerald sang trọng, độ tương phản cao, hỗ trợ thao tác chuột và bàn phím chuẩn ARIA (`Escape`, `ArrowDown`, `ArrowUp`, `Home`, `End`).
  * Badge thông báo chưa đọc được tối ưu vị trí hiển thị: vừa ở góc nút chuông, vừa ở dạng số đếm gọn gàng cạnh tiêu đề dropdown (`Trung tâm thông báo [5]`), loại bỏ hiện tượng tràn viền.
  * Tích hợp Tab lọc thông minh: *Tất cả* (tổng số thông báo hiển thị tối đa 10) và *Chưa đọc* (kèm bộ đếm unread).
* **Âm thanh Thông báo Nhẹ nhàng (Web Audio API):**
  * Không phụ thuộc vào tệp tin âm thanh tĩnh `.mp3` bên ngoài (tránh lỗi 404 hoặc bị trình duyệt chặn CORS/Autoplay), em sử dụng trực tiếp **Web Audio API** tạo ra chuông ngân 2 âm sắc thanh lịch chuẩn khách sạn cao cấp (D5 587.33Hz $\rightarrow$ A5 880Hz, suy hao mượt mà sau 650ms).
  * Hỗ trợ nút bật/tắt âm thanh trực tiếp trên giao diện chuông và ghi nhớ trạng thái.
* **Hệ thống Toast Message Thống nhất (5 giây):**
  * Tích hợp đồng bộ qua `AlertService` (SweetAlert2 Toast) với thời gian hiển thị 5.000ms (`REALTIME_TOAST_DURATION_MS = 5000`) đối với thông báo thời gian thực và 2.200ms đối với thao tác thông thường.
* **Tích hợp SignalR Client & Cơ chế Auto-Reconnect:**
  * Xây dựng [`SignalRNotificationTransport`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/signalr-notification.transport.ts) kết nối tới Hub `/hubs/notifications`, tự động bắt token xác thực Bearer và gọi `JoinProperty(propertyId)` theo chi nhánh đang đăng nhập.
  * Tự động nối lại kết nối khi mạng chập chờn theo các mốc lũy tiến (1s, 2s, 5s, 10s) và hiển thị chỉ báo trạng thái trực quan: *Trực tiếp* (xanh lá nhấp nháy), *Nối lại* (màu hổ phách), hoặc *Ngoại tuyến*.
* **Khảo sát & Báo cáo Kỹ thuật Vấn đề F5 Mất Thông báo (`BLOCKED_BY_A03`):**
  * *Hiện tượng:* Người dùng nhận thông báo realtime, chuông hiện số unread; khi nhấn F5 tải lại trang thì thông báo biến mất.
  * *Nguyên nhân gốc:* Frontend lưu trữ thông báo trên Angular Signal trong bộ nhớ RAM, khi F5 trình duyệt sẽ dọn sạch RAM về mảng rỗng `[]`. Khảo sát phía Backend (do An / A03 phụ trách) cho thấy: Backend hiện tại chỉ phát sự kiện SignalR trực tiếp từ `NotificationDispatcher` ra Hub mà **chưa lưu vào bảng `Notifications` trong CSDL** và **chưa có `NotificationsController`** để cung cấp API tải lại lịch sử.
  * *Tác phong kỹ thuật:* Em không tự ý sửa đổi file backend của An, không tạo API giả và không dùng `localStorage` để ngụy tạo CSDL. Em đã lập biên bản kỹ thuật xác định trạng thái **`BLOCKED_BY_A03`** kèm đề xuất Hợp đồng API chuẩn gửi An bổ sung (`GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/{id}/read`).

---

### 2. Task T02 — Thông báo Nhắc nhở Hết hạn Giữ phòng cho Khách hàng

* **Cảnh báo Thông minh khi sắp Hết hạn Giữ phòng:**
  * Trên trang giữ phòng công khai [`booking-hold.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts), em cài đặt bộ đếm ngược thời gian thực tế dựa trên hiệu số giữa `HoldExpiresAtUtc` từ server và `Date.now()`.
  * Khi thời gian đếm ngược còn $\le$ **3 phút** (180 giây), hệ thống tự động kích hoạt cờ `isExpiringSoon` hiển thị thanh cảnh báo nổi bật màu hổ phách với thông điệp nhắc nhở khách hoàn tất thanh toán.
* **Cơ chế Gia hạn Giữ phòng Thêm 5 phút (+300s):**
  * Bổ sung nút bấm trực quan: *"Tôi đang chuyển khoản, vui lòng giữ phòng thêm 5 phút"*.
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
  * Toàn bộ các cụm từ quan trọng được **in đậm** rõ ràng để khách hàng dễ dàng nắm bắt.
* **Bóc tách Triệt để giữa Hủy phòng & Duyệt Hoàn tiền (Quyết định D23):**
  * Khách xác nhận hủy $\rightarrow$ Đơn chuyển sang trạng thái `Cancelled` ngay lập tức, và **phòng vật lý được giải phóng tức thì** về trạng thái sẵn sàng để khách khác có thể tìm kiếm trên cổng B2C.
  * Khoản tiền cọc/thanh toán chuyển sang trạng thái chờ kế toán đối soát theo quy trình hoàn tiền, không cam kết hoàn ngay lập tức.
  * Hiển thị thông báo trung thực: *"Khoản hoàn dự kiến sẽ được khách sạn đối soát và xử lý theo phương thức hoàn tiền được xác nhận"*, loại bỏ câu chữ mặc định "chuyển khoản" gây hiểu nhầm nếu khách thanh toán bằng VNPay hay tiền mặt.

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

## PHẦN IV. KẾT QUẢ KIỂM THỬ VÀ CỔNG CHẤT LƯỢNG (QUALITY GATES)

Trước khi thực hiện commit và đẩy mã nguồn lên kho Git chung, em đã chạy kiểm thử tự động toàn diện và thẩm định vượt qua 100% các cổng chất lượng theo tiêu chuẩn tại `AGENTS.md`:

### 1. Kết quả Biên dịch (Build Verification):
* **Backend (.NET 10):**
  ```bash
  dotnet build backend/HotelSaas.slnx --verbosity minimal
  ```
  $\rightarrow$ **Build Succeeded: 0 Error, 0 Warning**.
* **Frontend (Angular 22 Standalone):**
  ```bash
  npm --prefix frontend run build
  ```
  $\rightarrow$ **Build Succeeded: 0 Error**, sinh trọn vẹn gói bundle production tại `dist/frontend`.

### 2. Kết quả Kiểm thử Tự động (Automated Test Suites):
* **Frontend Tests (Vitest / Angular Testing Framework):**
  ```bash
  npm --prefix frontend test -- --no-watch
  ```
  $\rightarrow$ **Test Files: 43 passed (43)** | **Tests: 576 passed (576)** (100% Pass).
* **Backend Tests xUnit (.NET 10):**
  * `NotificationHubSecurityTests`: **7 / 7 tests PASS**.
  * `Audit Logging Suite (T03)`: **13 / 13 tests PASS**.
  * `Cancellation & Refund Suite (T04)`: **26 / 26 tests PASS**.
  * Tổng kiểm thử phân hệ Tân phụ trách đạt **200 / 200 tests PASS**.

### 3. Kiểm tra An toàn & Rà soát Bí mật (Zero-Secrets Scan):
* Đã thực hiện `git diff` rà soát toàn bộ tệp tin, cam kết **tuyệt đối không lưu trữ hoặc commit** mật khẩu, database connection string, private API key hoặc JWT secret key vào Git.
* Không có tệp rác, nhật ký debug tạm thời trong working tree.

---

## PHẦN V. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

Tiếp thu sự chỉ dẫn sâu sát của Thầy Huỳnh Xuân Phụng ở các tuần trước về tính trung thực khoa học, tinh thần làm chủ mã nguồn và năng lực phản biện kỹ thuật của sinh viên khi sử dụng công cụ AI, em xin khai báo chi tiết như sau:

### 1. Công cụ & Mô hình AI Sử Dụng
* **Công cụ sử dụng:** **OpenAI Codex / ChatGPT Codex** trên môi trường phát triển mã nguồn dự án.
* **Mô hình hiển thị chính thức trong menu chọn model:** **`6 Astra`** (Frontier intelligence) và **`6.1 Sol`** (đồng bộ chuẩn xác 100% với danh mục đã khai báo và được Thầy phê duyệt ở Báo cáo Tuần 03).

---

### 2. Ba Tình Huống Thực Nghiệm: Prompt AI, Phát Hiện Lỗi & Sinh Viên Trực Tiếp Hiệu Chỉnh

#### 📌 Tình huống 1: Phát hiện và xử lý lỗi vỡ layout trên Header Notification Bell
* **Bối cảnh & Yêu cầu:** Thiết kế dropdown cho `<app-notification-bell>` hiển thị tiêu đề, trạng thái kết nối SignalR, số thông báo chưa đọc, nút toggle âm thanh và nút đóng dropdown.
* **Kết quả AI sinh mã ban đầu:** AI sinh template gom chung 6 phần tử vào header với chiều rộng cố định 400px.
* **Phát hiện lỗi của sinh viên:** Khi đưa mã vào chạy thực tế trên trình duyệt, em phát hiện tiêu đề bị cắt cụt thành *"Trung tâm thông..."*, badge kết nối trực tiếp bị ép hẹp khiến chữ bị nhảy thành 2 dòng (*"Trực \n tiếp"*), và badge số lượng chưa đọc chiếm diện tích quá lớn gây mất thẩm mỹ.
* **Sinh viên phản biện & xử lý:** Em tự tay can thiệp tái cấu trúc giao diện:
  1. Thêm lớp `whitespace-nowrap shrink-0` cho khối tiêu đề và badge trực tiếp.
  2. Di chuyển số lượng chưa đọc vào một badge tròn nhỏ gọn ngay cạnh chữ *"Trung tâm thông báo [5]"* thay vì dùng pill to cồng kềnh.
  3. Mở rộng chiều rộng panel linh hoạt `w-[min(26rem,calc(100vw-1.5rem))]`.
  4. Loại bỏ pill trạng thái rỗng thừa thãi *"• Sẵn sàng nhận thông báo trực tiếp"* theo đúng góp ý trải nghiệm người dùng.

#### 📌 Tình huống 2: Phản biện chính sách hủy phòng: Hiển thị mốc giờ, in đậm điều khoản và bóc tách duyệt hoàn tiền (D23)
* **Bối cảnh & Yêu cầu:** Xây dựng modal xác nhận hủy đặt phòng trên trang `booking-status.page.ts`.
* **Kết quả AI sinh mã ban đầu:** AI sinh modal chỉ hiển thị chung chung: *"Bạn bị áp dụng phí hủy 30% và khách sạn sẽ xử lý chuyển khoản"*.
* **Phát hiện lỗi của sinh viên:**
  1. Thiếu căn cứ thời gian: Khách không biết giờ nhận phòng và giờ yêu cầu hủy là khi nào, dẫn đến khiếu nại tại sao bị tính phí phạt.
  2. Mặc định sai phương thức: Nói khách sạn "chuyển khoản" là sai nếu khách thanh toán bằng VNPay, thẻ tín dụng hoặc tiền mặt.
  3. Gây hiểu nhầm tiền đã về ví: Khi nhấn hủy phòng, đơn chuyển sang `Cancelled` ngay nhưng số tiền hoàn trả còn phải chờ quản lý/kế toán đối soát theo Quyết định D23, không phải tiền hoàn tức thì.
* **Sinh viên phản biện & xử lý:** Em trực tiếp hiệu chỉnh lại logic frontend:
  1. Bổ sung 3 mốc thời gian thực tế: Giờ nhận phòng, Giờ yêu cầu hủy, và Số giờ còn lại trước check-in.
  2. Viết hàm format in đậm các cụm từ quan trọng: thời hạn hủy miễn phí, thời điểm tính phí và tỷ lệ phạt.
  3. Hiển thị thông báo minh bạch: *"Đặt phòng sẽ được hủy sau khi bạn xác nhận. Khoản hoàn dự kiến sẽ được khách sạn đối soát và xử lý theo phương thức hoàn tiền được xác nhận. Đây chưa phải khoản tiền đã được hoàn"*.

#### 📌 Tình huống 3: Ràng buộc gia hạn giữ phòng 5 phút: Chặn tuyệt đối lạm dụng gia hạn nhiều lần
* **Bối cảnh & Yêu cầu:** Cài đặt tính năng cho phép khách gia hạn giữ phòng thêm 5 phút khi đồng hồ sắp hết hạn.
* **Kết quả AI sinh mã ban đầu:** AI sinh hàm `extendHold()` chỉ tăng biến cục bộ trên client `remainingSeconds += 300` mỗi lần click, không kiểm soát số lần gọi API lên server.
* **Phát hiện lỗi của sinh viên:** Khách hàng có thể liên tục click nút để giữ phòng vô tận, làm tê liệt quỹ phòng của khách sạn. Đồng thời, nếu người dùng F5 thì số giây gia hạn bị mất hoặc bị tính sai lệch so với server.
* **Sinh viên phản biện & xử lý:** Em đã lập tức hiệu chỉnh:
  1. Ràng buộc trường `holdExtensionCount` từ backend DTO; kiểm tra điều kiện `canExtendHold = isExpiringSoon && !isHoldExtended()`.
  2. Khóa nút ngay sau 1 lần bấm duy nhất, hiển thị nhãn: *"Đã sử dụng 1/1 lượt gia hạn"*.
  3. Khi server trả về `holdExpiresAtUtc` mới, đồng bộ lại timer đếm ngược dựa trên mốc thời gian máy chủ thay vì cộng thủ công ở client.

---

## PHẦN VI. TỔNG KẾT VÀ BÀN GIAO ĐÓNG GÓI ĐỀ TÀI

1. **Hoàn thành trách nhiệm Tuần 04:**
   * Toàn bộ 4 nhiệm vụ được phân công (T01–T04) đã được triển khai hoàn chỉnh, kiểm thử tự động đạt 100% (200/200 test cases pass).
   * Mã nguồn sạch, không lỗi biên dịch, không vi phạm bảo mật.
2. **Bàn giao Pull Request:**
   * Đã mở Pull Request từ nhánh `feature/tan-week4-notifications-audit` vào nhánh `develop` để Nhóm trưởng Ngô Võ Tuấn An (`GinNgo`) thực hiện Code Review và hợp nhất.
   * Đã xuất báo cáo kỹ thuật và hợp đồng API Contract cho phân hệ Notification Hub để An hoàn thiện việc lưu trữ database.
3. **Sẵn sàng Nghiệm thu:**
   * Phân hệ của em đã hoàn toàn sẵn sàng cho buổi báo cáo nghiệm thu tổng kết đề tài với Thầy Huỳnh Xuân Phụng.

---

*TP. Hồ Chí Minh, ngày 31 tháng 10 năm 2026*  
**Sinh viên thực hiện**  
*(Đã ký)*  
**Trần Trọng Tân**  
MSSV: `24TX810025`


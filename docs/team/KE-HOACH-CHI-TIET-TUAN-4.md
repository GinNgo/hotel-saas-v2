# KẾ HOẠCH CHI TIẾT TUẦN 4 — NGUYÊN, TÂN VÀ AN
## Hotel SaaS Platform v2 (.NET 10 + Angular 22 + PostgreSQL 17)

## 1. Mục tiêu và căn cứ phân công

- **Dự án:** Hotel SaaS Platform v2 — Nền tảng quản lý khách sạn đa chi nhánh và sàn đặt phòng B2C.
- **Ngày lập:** 26/10/2026. Đây là kế hoạch giao việc chi tiết cho Tuần 04, tiếp nối thành quả đã nghiệm thu của Tuần 03.
- **Thời gian thực hiện:** 26/10/2026 – 01/11/2026 (Nghiệm thu tổng thể & đóng gói đề tài: 02/11/2026).
- **Kết quả cần đạt:**
  1. Tích hợp thanh toán trực tuyến thực tế qua **Cổng VNPay Sandbox** và **VietQR Pay động** kèm quy trình xử lý Webhook IPN bất đồng bộ an toàn, tự động kích hoạt đơn giữ phòng sang trạng thái `Confirmed`.
  2. Xây dựng hệ thống thông báo thời gian thực (**Realtime SignalR Notification Hub**) cảnh báo đơn đặt phòng mới và buồng phòng tức thì.
  3. Phân hệ xuất báo cáo tài chính và sổ cái kế toán ra định dạng chuẩn **Excel (.xlsx)** và **PDF**.
  4. Hệ thống ghi vết kiểm toán (**Audit Logging**) lưu vết lịch sử mọi giao dịch tài chính và can thiệp giá phòng.
  5. Chạy kịch bản kiểm thử tải đồng thời (**Concurrency Stress Testing**) trên Cloud DB PostgreSQL 17 Staging, hoàn tất đóng gói mã nguồn và tài liệu phục vụ nghiệm thu kết thúc đề tài.
- **Nhánh đích của PR:** `develop`; không push trực tiếp `main`.

---

## 2. Phân công tổng quát 3 Thành viên

| Thành viên | MSSV | Tài khoản GitHub | Phạm vi phụ trách Tuần 04 | Đầu việc chính | Sản phẩm bàn giao |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Ngô Võ Tuấn An** | `24TX810001` | [`ngovotuanan`](https://github.com/ngovotuanan) / [`GinNgo`](https://github.com/GinNgo) | **Điều phối, Cổng thanh toán VNPay/VietQR, Webhook IPN, SignalR Hub & Kiểm thử tải** | A01–A05 | Webhook IPN xác thực HMAC-SHA512, SignalR Hub, kịch bản test tải k6, CI/CD Gatekeeper |
| **Nguyễn Khôi Nguyên** | `24TX810011` | [`N-Golden`](https://github.com/N-Golden) | **Xuất báo cáo Doanh thu/Sổ cái ra Excel & PDF, Giao diện Thanh toán B2C đa phương thức** | N01–N04 | Service xuất Excel/PDF, UI chọn phương thức thanh toán B2C, mã VietQR động, test suite |
| **Trần Trọng Tân** | `24TX810025` | [`trantrongtan096`](https://github.com/trantrongtan096) | **Trung tâm thông báo Lễ tân, Hệ thống Audit Logging & Quy trình Hủy phòng/Hoàn tiền** | T01–T04 | Component Toast/Notification, Audit Logging FSM, nghiệp vụ hủy đơn & hoàn tiền, cross-test |

---

## 3. Ranh giới File và Quy tắc Phối hợp Tránh Xung đột

### G0 — Baseline sạch và Phân định nhánh làm việc
- Toàn bộ 3 thành viên bắt đầu Tuần 04 từ commit nghiệm thu Tuần 03 trên nhánh `feature/an-experience-foundation` (hoặc `develop` sau khi merge).
- Nhánh của Nguyên: `feature/nguyen-week4-invoicing-export`.
- Nhánh của Tân: `feature/tan-week4-notifications-audit`.
- Nhánh của An: `feature/an-week4-payments-realtime`.

### G1 — Phân định quyền sở hữu File (Ownership)
| Thành viên | Tệp tin / Phạm vi độc quyền chỉnh sửa |
| :--- | :--- |
| **An** | `backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs`, `backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs` (phần IPN Webhook), `backend/src/HotelSaas.Infrastructure/Hubs/NotificationHub.cs`, cấu hình CORS/SignalR trong `Program.cs`. |
| **Nguyên** | `backend/src/HotelSaas.Application/Reports/Services/IReportExportService.cs`, `backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`, `frontend/src/app/features/public-booking/booking-hold.page.ts` (phần phương thức thanh toán & VietQR), `frontend/src/app/features/reports/reports.page.ts` (nút xuất Excel/PDF). |
| **Tân** | `backend/src/HotelSaas.Domain/Entities/AuditLog.cs`, `backend/src/HotelSaas.Application/Common/Interfaces/IAuditLogService.cs`, `frontend/src/app/shared/components/notification-bell/`, `frontend/src/app/features/public-booking/booking-status.page.ts` (nút hủy đơn & chính sách hoàn tiền). |

---

## 4. Chi tiết Nhiệm vụ của Từng Thành viên

### 4.1. Nhiệm vụ của Ngô Võ Tuấn An (Nhóm trưởng)

#### A01 — Tích hợp Webhook IPN VNPay với chữ ký điện tử HMAC-SHA512
- **Story:** Khi khách thanh toán qua cổng VNPay, hệ thống VNPay gọi ngầm về Webhook IPN của khách sạn để xác nhận tiền đã vào tài khoản mà không phụ thuộc vào việc trình duyệt khách có bị tắt hay mất mạng hay không.
- **Yêu cầu kỹ thuật:**
  - Xác thực chữ ký `vnp_SecureHash` bằng thuật toán HMAC-SHA512 với khóa bí mật cấu hình an toàn trong `IConfiguration`.
  - Phân tích mã phản hồi `vnp_ResponseCode`: Nếu `00` (Thành công), gọi MediatR Command chuyển trạng thái đơn phòng sang `Confirmed`, ghi nhận khoản thu cọc vào Folio và kích hoạt mã PIN khóa thông minh.
  - Cài đặt cơ chế kiểm soát xử lý Idempotent: Nếu VNPay gửi lại IPN cho cùng một mã giao dịch `vnp_TxnRef`, hệ thống trả về mã `{ "RspCode": "02", "Message": "Order already confirmed" }` và không tạo thêm giao dịch trùng.
- **Tiêu chí nghiệm thu:**
  - Chữ ký giả mạo bị từ chối với HTTP 400.
  - Giao dịch hợp lệ cập nhật đúng số tiền và trạng thái phòng tức thì trên CSDL Cloud PostgreSQL.

#### A02 — Tích hợp Sinh mã VietQR Pay Động (VietQR NAPAS 24/7)
- **Story:** Khách hàng không có thẻ ngân hàng có thể quét mã QR từ bất kỳ ứng dụng ngân hàng nào tại Việt Nam để chuyển khoản nhanh.
- **Yêu cầu kỹ thuật:**
  - Sinh chuỗi mã QR chuẩn EMVCo / NAPAS 247: Ngân hàng thụ hưởng, số tài khoản, số tiền cọc chính xác đến từng đồng và nội dung chuyển khoản mã hóa chứa Mã đặt phòng.
  - Cài đặt polling kiểm tra giao dịch chuyển khoản hoặc webhook báo có tiền để tự động mở khóa phòng.

#### A03 — Hệ thống Thông báo Thời gian thực (Realtime SignalR Hub)
- **Story:** Lễ tân đang ngồi trực quầy nghe thấy tiếng chuông thông báo và thấy thẻ đơn đặt phòng mới xuất hiện ngay trên màn hình mà không cần phải nhấn F5 tải lại trang.
- **Yêu cầu kỹ thuật:**
  - Xây dựng `NotificationHub` với nhóm kết nối theo từng chi nhánh (`PropertyId`).
  - Khi có sự kiện đặt phòng mới hoặc hủy phòng, server phát sự kiện `ReceiveNewReservation` tới các client đang trực ca tại cơ sở đó.
  - Tự động kết nối lại khi mất mạng (auto-reconnect).

#### A04 — Kiểm thử Tải Đồng thời (Concurrency Stress Testing)
- **Story:** Đảm bảo hệ thống vận hành an toàn tuyệt đối, không bao giờ xảy ra tình trạng bán quá số phòng (Overbooking) khi có khuyến mãi lớn.
- **Yêu cầu kỹ thuật:**
  - Viết kịch bản test bằng k6 hoặc script concurrency xUnit: Giả lập 50 request cùng lúc giữ chỗ cho 1 phòng vật lý duy nhất.
  - Kiểm chứng rằng duy nhất 1 request thành công nhận được phòng (`HTTP 200`), 49 request còn lại nhận thông báo phòng đã hết (`HTTP 409 Conflict`).

---

### 4.2. Nhiệm vụ của Nguyễn Khôi Nguyên (24TX810011 - N-Golden)

#### N01 — Phân hệ Xuất Báo cáo Doanh thu & Sổ cái ra Excel (.xlsx)
- **Story:** Chủ khách sạn và kế toán trưởng cần xuất sổ cái thu ngân và doanh thu theo ngày/tháng ra file Excel để làm báo cáo thuế và lưu trữ nội bộ.
- **Yêu cầu kỹ thuật:**
  - Sử dụng thư viện `ClosedXML` ở backend để tạo file Excel định dạng đẹp: Header có tên khách sạn, địa chỉ, ngày xuất báo cáo, các cột mã đơn, tên khách, ngày nhận/trả, tiền phòng, phụ thu dịch vụ, thuế VAT và thực thu.
  - Định dạng số tiền kiểu Việt Nam (`#,##0 ₫`), có dòng tổng cộng (SUM formula) tự động.
  - Stream file trực tiếp về client với `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

#### N02 — Phân hệ Xuất Hóa đơn & Báo cáo ra tệp PDF chuẩn in ấn
- **Story:** Lễ tân cần in phiếu xác nhận đặt phòng hoặc hóa đơn thanh toán cho khách khi trả phòng.
- **Yêu cầu kỹ thuật:**
  - Sử dụng `QuestPDF` ở backend để tạo mẫu PDF chuẩn khổ A4/A5, hỗ trợ font tiếng Việt Unicode không bị lỗi dấu.
  - Xuất hóa đơn có mã QR tra cứu, mã số thuế của cơ sở, danh mục các khoản thanh toán và chữ ký đại diện khách sạn.

#### N03 — Giao diện Lựa chọn Đa Phương thức Thanh toán B2C & Hiển thị VietQR
- **Story:** Khách hàng tại bước giữ chỗ có thể linh hoạt chọn phương thức thanh toán phù hợp nhất với mình.
- **Yêu cầu kỹ thuật:**
  - Tại [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts), bổ sung 3 tùy chọn:
    1. *Thanh toán thẻ / VNPAY-QR* $\rightarrow$ Chuyển hướng sang cổng thanh toán VNPay Sandbox.
    2. *Chuyển khoản VietQR 24/7* $\rightarrow$ Render mã QR động hiển thị số tiền và cú pháp chuyển tiền, kèm nút copy số tài khoản tiện lợi.
    3. *Thanh toán khi nhận phòng (Pay at Hotel)* $\rightarrow$ Áp dụng theo chính sách của cơ sở.
  - Giao diện đáp ứng tốt trên cả điện thoại di động và máy tính.

#### N04 — Bộ Kiểm thử Tự động cho Service Xuất Báo cáo & VietQR
- **Yêu cầu kỹ thuật:**
  - Viết bài test xUnit kiểm chứng file Excel sinh ra không bị rỗng (`byte[].Length > 0`), các ô công thức tính tổng khớp đúng số liệu kế toán.
  - Viết test kiểm tra chuỗi URL VietQR sinh ra đúng định dạng quy chuẩn ngân hàng.

---

### 4.3. Nhiệm vụ của Trần Trọng Tân (24TX810025 - trantrongtan096)

#### T01 — Giao diện Trung tâm Thông báo (Notification Center & Toast UI)
- **Story:** Nhân viên lễ tân và buồng phòng nhận được thông báo tức thời ngay trên giao diện làm việc khi có sự kiện mới.
- **Yêu cầu kỹ thuật:**
  - Tạo component `<app-notification-bell>` trên thanh điều hướng đầu trang (Header): Hiển thị số lượng thông báo chưa đọc, dropdown danh sách 10 thông báo gần nhất.
  - Tích hợp thư viện âm thanh thông báo nhẹ nhàng khi có đơn đặt phòng mới phát sinh qua SignalR.
  - Cài đặt thông báo nổi (Toast Message) hiển thị ở góc màn hình tự động biến mất sau 5 giây.

#### T02 — Thông báo Nhắc nhở Hết hạn Giữ phòng cho Khách hàng
- **Story:** Khách đang ở trang giữ phòng được nhắc nhở kịp thời trước khi đơn phòng bị giải phóng.
- **Yêu cầu kỹ thuật:**
  - Khi đồng hồ đếm ngược còn 3 phút cuối cùng, hiển thị thanh cảnh báo màu hổ phách kèm nút *"Tôi đang chuyển khoản, vui lòng giữ phòng thêm 5 phút"* (chỉ cho phép gia hạn tối đa 1 lần nếu cơ sở còn phòng).

#### T03 — Hệ thống Nhật ký Kiểm toán (Audit Logging System)
- **Story:** Giám đốc khách sạn có thể tra cứu lịch sử để biết nhân viên nào đã chỉnh sửa giá phòng hoặc xóa hóa đơn.
- **Yêu cầu kỹ thuật:**
  - Tạo thực thể `AuditLog` trong Domain: `Id`, `TenantId`, `PropertyId`, `UserId`, `Action` (Create, Update, Delete), `EntityName`, `EntityId`, `OldValues`, `NewValues`, `IpAddress`, `CreatedAtUtc`.
  - Tự động ghi vết trong `AuditSaveChangesInterceptor` mỗi khi có thao tác chỉnh sửa bảng giá hoặc xóa hóa đơn.
  - Xây dựng màn hình xem lịch sử kiểm toán trong trang quản trị dành riêng cho vai trò `Owner` và `GeneralManager`.

#### T04 — Nghiệp vụ Hủy phòng & Chính sách Hoàn tiền Tự động
- **Story:** Khách hàng có thể tự hủy đơn đặt phòng trên trang tra cứu nếu có việc bận đột xuất theo đúng chính sách hoàn hủy của khách sạn.
- **Yêu cầu kỹ thuật:**
  - Trên trang [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts), bổ sung nút *"Yêu cầu hủy đặt phòng"*.
  - Kiểm tra điều kiện: Nếu hủy trước giờ check-in 24 giờ $\rightarrow$ Chuyển trạng thái sang `Cancelled`, tự động hoàn 100% điểm thưởng Loyalty và hoàn tiền cọc; Nếu hủy muộn hơn $\rightarrow$ Áp dụng trừ phí phạt theo chính sách.
  - Giải phóng ngay lập tức phòng vật lý về trạng thái sẵn sàng để khách khác có thể tìm thấy trên cổng B2C.

---

## 5. Lịch Thực Hiện Đề Xuất Tuần 04

| Ngày | Ngô Võ Tuấn An (Leader) | Nguyễn Khôi Nguyên | Trần Trọng Tân |
| :---: | :--- | :--- | :--- |
| **26/10 (T2)** | Họp nhóm đầu tuần, chốt baseline, phân tách nhiệm vụ A01-A05, N01-N04, T01-T04. | Khảo sát thư viện `ClosedXML` & `QuestPDF`, thiết kế DTO xuất báo cáo. | Thiết kế thực thể `AuditLog` và cấu hình SignalR Client trên Angular. |
| **27/10 (T3)** | Cài đặt endpoint Webhook IPN VNPay với chữ ký HMAC-SHA512. | Xây dựng Service xuất Excel (.xlsx) cho Báo cáo Doanh thu & Sổ cái Thu ngân. | Xây dựng component `<app-notification-bell>` và tích hợp SignalR Client. |
| **28/10 (T4)** | Hoàn thiện SignalR `NotificationHub` trên backend và cấu hình kênh lắng nghe. | Xây dựng Service xuất PDF hóa đơn thanh toán và phiếu nhận phòng. | Cài đặt `AuditSaveChangesInterceptor` tự động ghi vết thay đổi bảng giá. |
| **29/10 (T5)** | Tích hợp sinh mã VietQR NAPAS 24/7 và kiểm thử luồng IPN giả lập. | Nâng cấp trang [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts) với giao diện chọn phương thức thanh toán. | Triển khai nút Hủy đặt phòng và chính sách hoàn tiền/điểm trên trang Status. |
| **30/10 (T6)** | Chạy kịch bản kiểm thử tải đồng thời (Concurrency Test) 50 request tranh chấp. | Viết unit test cho các Service xuất Excel/PDF; rà soát format tiền tệ. | Kiểm thử liên thông chuỗi Hủy phòng $\rightarrow$ Nhả phòng trống tức thì trên B2C. |
| **31/10 (T7)** | Review PR của Nguyên và Tân, hợp nhất vào `develop`, chạy CI/CD quality gates. | Sửa các lỗi UI phát sinh, kiểm tra responsive trên mobile và tablet. | Hoàn thiện giao diện xem Audit Log cho quản trị viên chuỗi. |
| **01/11 (CN)** | Tổng duyệt toàn bộ hệ thống trên Cloud VPS Staging; viết Báo cáo Tổng kết đề tài. | Chuẩn bị dữ liệu demo cho phân hệ Báo cáo & Xuất file. | Chuẩn bị kịch bản demo cho luồng Thanh toán $\rightarrow$ Realtime Thông báo. |

---

## 6. Tiêu chí Nghiệm thu Chất lượng Tuần 04 (Definition of Done)

Trước khi nghiệm thu đóng gói đề tài, toàn bộ dự án phải vượt qua các cổng chất lượng sau:
1. **0 Lỗi Biên dịch:**
   ```bash
   dotnet build backend/HotelSaas.slnx --verbosity minimal  # 0 Warning, 0 Error
   npm --prefix frontend run build                         # Thành công 100%
   ```
2. **100% Kiểm thử Tự động vượt qua:**
   ```bash
   dotnet test backend/HotelSaas.slnx --no-build           # 100% Tests Pass
   npm --prefix frontend test -- --watch=false            # 100% Tests Pass
   ```
3. **Tính Toàn vẹn Dữ liệu trên Cloud:**
   - CSDL Cloud PostgreSQL 17 Staging trên VPS (`103.116.38.74:5435`) kết nối ổn định qua TLS.
   - Luồng thanh toán VNPay Sandbox và VietQR Pay hoạt động thực tế với Webhook IPN chuẩn xác.
4. **Không có mã rác hoặc thông tin bảo mật:**
   - Không commit mật khẩu, khóa bí mật API vào kho mã nguồn Git.
   - Không có file rác, script debug tạm thời tồn tại trong repo.

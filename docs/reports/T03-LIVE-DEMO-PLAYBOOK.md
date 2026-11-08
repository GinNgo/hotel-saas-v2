# KỊCH BẢN TRÌNH DIỄN NGHIỆP VỤ 5 PHÚT (T03 — LIVE DEMO PLAYBOOK)
## LuxeStay Cloud — Hotel SaaS Platform v2 (.NET 10 + Angular 22 Signals + PostgreSQL 17)

---

## 1. TỔNG QUAN KỊCH BẢN & MỤC TIÊU BÁO CÁO

* **Mã tài liệu:** `T03-LIVE-DEMO-PLAYBOOK`
* **Vị trí phụ trách:** Lead QA Engineer, Solutions Architect & Technical Demo Coordinator
* **Người thực hiện:** Trần Trọng Tân (MSSV: 24TX810025)
* **Thời lượng mục tiêu:** **Đúng 05 phút (300 giây)**
* **Mục tiêu cốt lõi:**
  1. Trình diễn mượt mà luồng nghiệp vụ khép kín từ **Khách hàng đặt phòng trực tuyến (B2C)** đến **Vận hành tiền sảnh & Thu ngân tại khách sạn (PMS B2B)**.
  2. Minh chứng năng lực kỹ thuật nổi bật: **SignalR WebSockets thời gian thực (Zero F5)**, **Đếm ngược giữ phòng 15 phút an toàn (Hold Countdown)**, **Thanh toán VNPay Sandbox xác thực qua IPN backend**, **Đồng bộ trạng thái Room Map & Inventory**, và **Xuất hóa đơn điện tử PDF kèm mã QR tra cứu**.
  3. Bảo đảm tính bảo mật đa chi nhánh (*Multi-Tenant / Multi-Property Isolation*), phân lập kênh tài chính theo vai trò (*RBAC Scoping*), và không để lộ dữ liệu nhạy cảm.

---

## 2. BỐ TRÍ HAI MÀN HÌNH SONG SONG (DUAL-SCREEN SETUP)

Để mang lại hiệu ứng thị giác trực quan nhất cho Giảng viên hướng dẫn và Hội đồng, kịch bản được thiết kế chia đôi màn hình (hoặc sử dụng 2 thiết bị/trình duyệt độc lập):

```
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│  MÀN HÌNH 1: KHÁCH HÀNG (PUBLIC BOOKING)      │  MÀN HÌNH 2: TIỀN SẢNH PMS (RECEPTIONIST)    │
│  - Trình duyệt: Guest Window / Edge Mobile   │  - Trình duyệt: Chrome Profile Lễ Tân        │
│  - Địa chỉ: http://localhost:4200/booking    │  - Địa chỉ: http://localhost:4200/reservations│
│  - Phiên: Không đăng nhập tài khoản nội bộ   │  - Tài khoản: staff.single@hotelsaas.local   │
│  - Vai trò: Khách đặt phòng trực tuyến       │  - Vai trò: Lễ tân Grand Hotel Sài Gòn (Q1)  │
│  - Trạng thái: Sẵn sàng tìm kiếm & thanh toán│  - Trạng thái: SignalR Connected, Chuông ON  │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Quy tắc cách ly phiên:** Hai màn hình **tuyệt đối không dùng chung một session hoặc cửa sổ ẩn danh cùng cookie**. Màn hình 1 là khách vãng lai (không có JWT). Màn hình 2 là nhân viên Lễ tân có JWT và ngữ cảnh chi nhánh Grand Hotel Sài Gòn Q1.

---

## 3. BẢNG TIẾN TRÌNH TRÌNH DIỄN CHI TIẾT (STEP-BY-STEP PLAYBOOK — 5 PHÚT)

| Mốc thời gian | Phân cảnh & Màn hình | Thao tác thực tế của Người trình bày | Phản hồi hệ thống mong đợi | Lời thoại thuyết trình mẫu (Script) | Kế hoạch dự phòng (Fallback) |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **00:00 – 00:40** *(40 giây)* | **Màn hình 1:** Public Booking Portal | 1. Mở trang chủ `/booking`.<br/>2. Chọn cơ sở: **Grand Hotel Sài Gòn (Quận 1)**.<br/>3. Dùng DatePicker chọn ngày nhận (ví dụ: ngày mai) và ngày trả phòng (sau 2 đêm).<br/>4. Chọn 2 khách.<br/>5. Nhấn **"Tìm phòng"**.<br/>6. Chọn hạng phòng **Deluxe Double / Suite**. | - DatePicker mở mượt mà, định dạng ngày chuẩn Việt Nam `dd/mm/yyyy`.<br/>- Danh sách phòng hiển thị giá cước chính xác từ API (không giật lag, responsive đẹp).<br/>- Nút **"Đặt ngay"** rõ ràng. | *"Kính thưa Thầy và Hội đồng, đây là Cổng đặt phòng trực tuyến LuxeStay Cloud. Khách hàng dễ dàng tìm kiếm và kiểm tra phòng trống theo thời gian thực mà không cần gọi điện tới quầy lễ tân. Em chọn hạng phòng Deluxe tại chi nhánh Quận 1 với lịch trình 2 đêm."* | Nếu cơ sở Quận 1 hết phòng, chuyển sang chi nhánh Phú Nhuận (có phòng Executive Suite). |
| **00:40 – 01:25** *(45 giây)* | **Màn hình 1:** Booking Hold & Guest Info | 1. Điền thông tin khách: *Nguyễn Văn An*, Email: `an.demo@hotelsaas.test`, SĐT: `0901234567`.<br/>2. Nhấn **"Xác nhận đặt phòng & Giữ chỗ"**.<br/>3. Màn hình chuyển sang trang `/booking/hold/:token`.<br/>4. Chỉ tay vào **đồng hồ đếm ngược 15:00**. | - Backend tạo bản ghi `Reservation` trạng thái `Reserved`.<br/>- Sinh mã đơn duy nhất (ví dụ: `RES-GRJ5LS`).<br/>- Bộ đếm ngược 15 phút chạy lùi từng giây chuẩn xác theo giờ máy chủ.<br/>- Khóa kho phòng tạm thời chống đặt trùng. | *"Ngay khi khách nhấn đặt chỗ, hệ thống kích hoạt cơ chế khóa phòng tạm thời (Hold Inventory) với thời hạn 15 phút được kiểm soát chặt chẽ từ máy chủ .NET 10. Trong 15 phút này, không khách hàng nào khác có thể chiếm mất phòng này."* | Nếu khách nhấn đúp, cơ chế Idempotency chặn không tạo 2 booking. |
| **01:25 – 02:15** *(50 giây)* | **Màn hình 1:** Cổng thanh toán Sandbox | 1. Chọn phương thức thanh toán **"VNPay / Thẻ ATM Nội địa"** (hoặc VietQR).<br/>2. Nhấn **"Thanh toán ngay"**.<br/>3. Trên cổng VNPay Sandbox, nhập thẻ test NCB chuẩn.<br/>4. Nhập OTP `123456` và bấm **"Xác nhận"**.<br/>5. Chờ VNPay callback về backend IPN. | - Backend nhận IPN từ cổng thanh toán, xác thực chữ ký HMAC SHA512.<br/>- Đổi trạng thái booking sang `Confirmed` và thanh toán `Completed`.<br/>- Trang khách chuyển sang `/booking/status` thông báo **"Thanh toán thành công"**. | *"Thay vì dựa vào phản hồi chuyển hướng đơn thuần từ trình duyệt, backend LuxeStay nhận Webhook IPN có ký số bảo mật, xác thực số tiền trước khi ghi nhận thanh toán hoàn tất và phát sự kiện vào luồng thời gian thực."* | Nếu mạng sandbox chậm, sử dụng phương thức Chuyển khoản VietQR với mã xác thực có sẵn. |
| **02:15 – 03:00** *(45 giây)* | **Màn hình 2:** Tiền sảnh PMS (Quan sát Realtime) | 1. **TUYỆT ĐỐI KHÔNG BẤM F5**.<br/>2. Quan sát góc phải màn hình 2.<br/>3. Ngay khi thanh toán thành công, **chuông NotificationBell reo tiếng chime**.<br/>4. Badge đỏ nhảy từ 0 lên 1.<br/>5. Pop-up Toast xuất hiện ở góc màn hình.<br/>6. Nhấp vào thông báo để mở trực tiếp đơn. | - SignalR đẩy thông báo tức thì qua WebSocket.<br/>- Lễ tân nhận: *"Đơn RES-XXXXXX đã được xác nhận thanh toán thành công."*<br/>- Tuyệt đối không để lộ số tiền hay thông tin thanh toán nhạy cảm (sanitized).<br/>- Không nhận trùng thông báo. | *"Kính mời Thầy quan sát màn hình của Lễ tân bên phải: Hoàn toàn không nhấn F5 tải lại trang, chuông thông báo đã reo ngay lập tức qua SignalR WebSockets. Bản tin gửi cho lễ tân đã được lọc bỏ thông tin nhạy cảm để đảm bảo bảo mật."* | Nếu trình duyệt chặn âm thanh autoplay, chỉ tay vào Toast thông báo và Badge số 1. |
| **03:00 – 03:45** *(45 giây)* | **Màn hình 2:** PMS Hồ sơ & Sơ đồ phòng | 1. Xem chi tiết hồ sơ đơn vừa mở: Mã đơn khớp, trạng thái `Confirmed / Đã thanh toán`.<br/>2. Nhấn vào menu **"Sơ đồ phòng"** (`/rooms`).<br/>3. Chỉ vào phòng tương ứng (ví dụ: Phòng 201).<br/>4. Giải thích rõ ràng sự khác biệt giữa phòng **Đã Đặt Trước (Reserved/Confirmed)** và **Đang Có Khách (Occupied)**. | - Hồ sơ đặt phòng hiển thị đầy đủ chi tiết khách và lịch lưu trú.<br/>- Sơ đồ phòng hiển thị badge gắn đơn đặt chỗ tương ứng.<br/>- Trạng thái vật lý phòng vẫn là Clean/Available cho tới khi khách làm thủ tục Check-in thực tế. | *"Trên hệ thống PMS, hồ sơ đặt phòng của khách đã được đồng bộ 100%. Tại sơ đồ phòng, hệ thống thể hiện đúng nghiệp vụ khách sạn chuẩn quốc tế: Phòng được đánh dấu Đã Đặt (Reserved), nhưng trạng thái buồng phòng vật lý chỉ chuyển sang 'Occupied - Có khách' khi lễ tân thực hiện Check-in."* | Nếu sơ đồ phòng đang ở bộ lọc tầng khác, bấm chọn "Tất cả các tầng". |
| **03:45 – 05:00** *(75 giây)* | **Màn hình 2 & Màn hình 1:** Xuất Hóa đơn & Quét QR | 1. Tại hồ sơ booking, nhấn nút **"In Phiếu / Hóa đơn"** (`/print/invoice/:id`).<br/>2. Hiển thị phiếu in hóa đơn điện tử chuyên nghiệp có VAT 8%, mã VietQR và mã vạch.<br/>3. Nhấn chuyển sang xem **Phiếu Xác Nhận Đặt Phòng (Voucher)** có mã QR Check-in.<br/>4. Người trình bày cầm điện thoại thật quét mã QR trên màn hình.<br/>5. Điện thoại tự động mở trang tra cứu `/booking/lookup` hiển thị đúng đơn của khách! | - Trang in hiển thị sắc nét, chuẩn responsive in ấn A4 (Ctrl + P).<br/>- Mã QR chứa đường dẫn tra cứu bảo mật.<br/>- Trang tra cứu hiển thị đầy đủ thông tin vé điện tử, không để lộ thông tin thẻ hay bí mật nội bộ. | *"Bước cuối cùng, lễ tân có thể xuất hóa đơn điện tử hoặc Phiếu xác nhận đặt phòng. Trên phiếu có tích hợp mã QR động. Khách hàng chỉ cần dùng điện thoại quét mã QR là có thể tra cứu thông tin đặt phòng mọi lúc mọi nơi trên thiết bị di động cá nhân. Toàn bộ luồng khép kín chỉ diễn ra trong đúng 5 phút."* | Nếu máy chiếu mờ điện thoại khó quét QR, copy đường link tra cứu dán trực tiếp vào tab khách. |

---

## 4. KỊCH BẢN BỔ SUNG NẾU ĐƯỢC YÊU CẦU (OPTIONAL EXTENSIONS)

### Phần bổ sung 1: Trình diễn Hoàn tiền Quyết định D23 (Dành cho Quản lý — T01)
*Thời lượng dự kiến: 2 phút (chỉ thực hiện khi Giảng viên yêu cầu kiểm tra phần việc tài chính của Tân).*
1. Khách hàng bấm **"Hủy đặt phòng"** từ trang tra cứu.
2. SignalR đẩy sự kiện `ReceiveBookingCancellationRequested` vào nhóm `Property_{id}_financial`.
3. Đăng nhập tài khoản Quản lý (`manager.both@hotelsaas.local`), mở tab **"Quản lý & Phê duyệt Hoàn tiền (D23)"** tại `/payments`.
4. Quan sát 4 thẻ KPI cập nhật số liệu. Mở yêu cầu hoàn tiền vừa nhận.
5. Kiểm tra chi tiết 3 bước tiến trình D23: Phí hủy theo chính sách, số tiền hoàn tính tự động.
6. Bấm **"Phê duyệt"** (chuyển sang `ApprovedPendingPayout`), sau đó bấm **"Xác nhận đã chi trả"**, nhập mã bút toán ngân hàng và ghi chú đối soát. Trạng thái chuyển thành `Refunded`.

### Phần bổ sung 2: Trình diễn Hết hạn giữ phòng (Hold Expired — T02)
*Thời lượng dự kiến: 1 phút.*
1. Sử dụng endpoint quét nền có sẵn: `POST /api/reservations/sweep-expired-holds`.
2. Hệ thống phát hiện đơn giữ chỗ quá 15 phút chưa thanh toán.
3. Chuông Lễ tân nhận ngay thông báo: *"Đơn giữ phòng RES-XXXXXX đã hết hạn giữ chỗ và phòng đã được tự động hoàn về kho trống."*
4. Quét lại lần 2: 0 thông báo phát sinh (chứng minh chống trùng lặp tuyệt đối).

---

## 5. LỜI THOẠI MẪU CHO NGƯỜI TRÌNH BÀY (PRESENTATION SPEECH)

```text
"Kính chào Thầy và các bạn trong Hội đồng nghiệm thu!

Hôm nay, em xin đại diện nhóm trình diễn luồng nghiệp vụ cốt lõi của nền tảng LuxeStay Cloud
trong vòng 5 phút, minh chứng cho sự phối hợp nhịp nhàng giữa Cổng đặt phòng trực tuyến của
khách hàng B2C và Hệ thống quản trị tiền sảnh PMS của khách sạn B2B.

Bên tay trái của Thầy là màn hình khách hàng đang truy cập trên thiết bị di động.
Bên tay phải là màn hình lễ tân khách sạn Grand Hotel Sài Gòn đang trực quầy.

[00:00 - 00:40] Em tiến hành tìm kiếm phòng Deluxe tại chi nhánh Quận 1 cho 2 đêm. Bộ lọc
và lịch DatePicker đã được chuẩn hóa theo múi giờ Việt Nam.

[00:40 - 01:25] Em điền thông tin khách Nguyễn Văn An và nhấn Đặt chỗ. Máy chủ .NET 10 lập
tức kích hoạt cơ chế Hold Inventory trong 15 phút. Chiếc đồng hồ đếm ngược này được đồng bộ
chặt chẽ từ backend để tránh hoàn toàn tình trạng đặt trùng phòng (Overbooking).

[01:25 - 02:15] Khách hàng lựa chọn cổng thanh toán VNPay Sandbox. Sau khi nhập mã thẻ thử
nghiệm và xác nhận OTP, giao dịch được backend tiếp nhận qua kênh Webhook IPN bảo mật và cập
nhật trạng thái đặt phòng thành công.

[02:15 - 03:00] Kính mời Thầy quan sát màn hình lễ tân bên phải: Hoàn toàn không nhấn F5 tải
lại trang, chuông thông báo PMS reo lên ngay lập tức nhờ công nghệ SignalR WebSockets. Dữ liệu
gửi về cho lễ tân đã được lọc bỏ thông tin tài chính nhạy cảm theo đúng chuẩn SDD-05 RBAC.

[03:00 - 03:45] Lễ tân mở hồ sơ và kiểm tra sơ đồ phòng. Khách sạn ghi nhận đơn đã xác nhận.
Trạng thái vật lý phòng vẫn được giữ ở trạng thái Sạch để sẵn sàng cho quy trình Check-in.

[03:45 - 05:00] Cuối cùng, lễ tân xuất phiếu xác nhận đặt phòng có mã QR Check-in. Em dùng
điện thoại cá nhân quét mã QR này, thiết bị lập tức mở ra trang tra cứu vé điện tử chính xác.

Toàn bộ quy trình diễn ra trơn tru, bảo mật và đúng tiến độ 5 phút. Em xin trân trọng cảm ơn
Thầy đã lắng nghe và kính mời Thầy đặt câu hỏi phản biện!"
```

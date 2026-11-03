# TỔNG HỢP KẾT QUẢ THỰC HIỆN VÀ TRỌN BỘ PROMPT TUẦN 04
## DỰ ÁN: HOTEL SAAS PLATFORM V2 (.NET 10 + ANGULAR 22 + POSTGRESQL 17)
**Trường Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh — Khoa CNTT — Bộ môn CNPM**  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng  
**Nhóm sinh viên thực hiện:**
1. **Ngô Võ Tuấn An** — MSSV: `24TX810001` (Trưởng nhóm — Lead)
2. **Nguyễn Khôi Nguyên** — MSSV: `24TX810011`
3. **Trần Trọng Tấn** — MSSV: `24TX810025`

**Kho mã nguồn:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
**Nhánh tích hợp chính:** `develop` | **Staging VPS:** [https://luxustay.duckdns.org/](https://luxustay.duckdns.org/)

---

# PHẦN I. TỔNG HỢP KẾT QUẢ THỰC TẾ ĐẠT ĐƯỢC TRONG TUẦN 04

Tuần 04 là tuần bản lề hoàn thiện và khép kín toàn bộ chu trình nghiệp vụ cốt lõi: **Thanh toán trực tuyến VNPay / VietQR $\rightarrow$ Gửi email kích hoạt & Hóa đơn $\rightarrow$ Thông báo thời gian thực SignalR $\rightarrow$ Cảnh báo & Gia hạn giữ chỗ $\rightarrow$ Nhật ký kiểm toán Audit Log $\rightarrow$ Xuất báo cáo tài chính Excel/PDF $\rightarrow$ Đóng gói Staging VPS.**

### 1. Phân hệ của Ngô Võ Tuấn An (`24TX810001` — Trưởng nhóm)
* **Cổng thanh toán trực tuyến VNPay Sandbox & Webhook IPN ngầm:**
  * Xây dựng `VnpayPaymentService`: Ký số HMAC-SHA512 chuẩn xác theo RFC, đối soát hai chiều query string tránh lỗi Checksum 97.
  * Webhook IPN ngầm (`POST /api/v1/payments/vnpay-ipn`): Phân lập TenantId/PropertyId chặt chẽ theo nguyên tắc Fail-Closed, tự động chuyển đơn sang `Confirmed` khi thanh toán thành công.
* **Xác thực danh tính & Email Verification Token:**
  * Tạo token xác thực email chuẩn Stateless JWT ký HMAC-SHA256 có thời hạn 30 phút, claim `purpose: email_verification`.
  * Tích hợp dịch vụ gửi mail chào mừng và đường link kích hoạt qua Gmail SMTP (`MailKit`).
  * Xây dựng trang xác nhận `ConfirmEmailPage` trên Angular 22 Signals.
* **Tối ưu hóa giao diện B2C Luxury Hospitality & DatePicker:**
  * Khắc phục hiện tượng nền trắng lóa (washed-out white), tăng cường độ tương phản viền khối theo phong cách khách sạn cao cấp.
  * Chuẩn hóa toàn bộ DatePicker trên 100% trang giao diện, loại bỏ hoàn toàn lỗi icon đè lên ngày tháng `dd/mm/yyyy`.
* **Vận hành Staging VPS:**
  * Duy trì máy chủ thực tế tại [https://luxustay.duckdns.org/](https://luxustay.duckdns.org/) (Caddy Reverse Proxy tự động SSL Let's Encrypt + Docker Compose).
* **Commit tiêu biểu:** [`dbaaed8`](https://github.com/GinNgo/hotel-saas-v2/commit/dbaaed8), [`5353c1e`](https://github.com/GinNgo/hotel-saas-v2/commit/5353c1e), [`9c48602`](https://github.com/GinNgo/hotel-saas-v2/commit/9c48602), [`fe0cc91`](https://github.com/GinNgo/hotel-saas-v2/commit/fe0cc91), [`4a7927b`](https://github.com/GinNgo/hotel-saas-v2/commit/4a7927b), [`e781ac1`](https://github.com/GinNgo/hotel-saas-v2/commit/e781ac1), [`befef49`](https://github.com/GinNgo/hotel-saas-v2/commit/befef49), [`6155738`](https://github.com/GinNgo/hotel-saas-v2/commit/6155738), [`786fa5a`](https://github.com/GinNgo/hotel-saas-v2/commit/786fa5a), [`3218817`](https://github.com/GinNgo/hotel-saas-v2/commit/3218817).

### 2. Phân hệ của Nguyễn Khôi Nguyên (`24TX810011`)
* **Xuất báo cáo tài chính đa định dạng (Excel & PDF):**
  * Xây dựng `ReportExportService` dùng thư viện `ClosedXML` để xuất file Excel (.xlsx) có tiêu đề, chi nhánh, thời gian, danh sách đơn và dòng tổng cộng dùng công thức tính `SUM` tự động.
  * Tích hợp `QuestPDF` xuất báo cáo doanh thu và hóa đơn thanh toán PDF.
  * Dữ liệu phân lập theo đúng quyền Tenant và Chi nhánh của tài khoản đăng nhập.
* **Tùy chọn phương thức thanh toán B2C:**
  * Bổ sung giao diện lựa chọn thanh toán: VNPay Sandbox, VietQR động và Tiền mặt tại quầy (yêu cầu nộp cọc 30% trong 15 phút giữ chỗ).
  * Hiển thị thông tin chuyển khoản VietQR kèm nút sao chép số tài khoản tiện lợi.
* **Commit tiêu biểu:** [`4983182`](https://github.com/GinNgo/hotel-saas-v2/commit/4983182) (`feat(reports): add Excel and PDF exports with payment options`).

### 3. Phân hệ của Trần Trọng Tấn (`24TX810025`)
* **T01 — Trung tâm thông báo Lễ tân (Notification Center & SignalR Hub Client):**
  * Xây dựng `<app-notification-bell>` OnPush Signals trên Header PMS, âm thanh Web Audio dịu nhẹ, Toast nổi 5s, tự động reconnect khi mất mạng. **(21/21 tests pass)**.
* **T02 — Cảnh báo hết hạn giữ phòng 3 phút & Gia hạn 5 phút:**
  * Đếm ngược $\le$ 3 phút đổi sang màu hổ phách cảnh báo, cho phép gia hạn thêm 5 phút tối đa 1 lần duy nhất, đồng bộ hạn chót với server. **(39/39 tests pass)**.
* **T03 — Hệ thống Nhật ký kiểm toán (Audit Logging System):**
  * Thực thể `AuditLog`, bộ đánh chặn EF Core `AuditSaveChangesInterceptor` tự động ghi vết mọi can thiệp giá phòng và hóa đơn qua ChangeTracker, giao diện `audit-logs.page.ts`. **(29/29 tests pass)**.
* **T04 — Quy trình Hủy phòng B2C & Bóc tách Hoàn tiền D23:**
  * Luồng hủy phòng khách hàng, tự động tính phí phạt 24h trước giờ nhận phòng, giải phóng phòng tức thì về kho và chuyển giao dịch sang trạng thái chờ duyệt hoàn tiền D23 tại quầy thu ngân. **(111/111 tests pass)**.
* **Commit tiêu biểu:** [`96e0acc`](https://github.com/GinNgo/hotel-saas-v2/commit/96e0acc), [`3f43393`](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393), [`ce6dfe9`](https://github.com/GinNgo/hotel-saas-v2/commit/ce6dfe9).

### 4. Tổng hợp chỉ số kiểm thử & Cổng chất lượng (Quality Gates)
* **Frontend Test Suite:** Toàn bộ **578 / 578 unit tests đều PASS 100%** (`43 test files`).
* **Frontend Production Build:** `npm --prefix frontend run build` đạt **0 lỗi, 0 cảnh báo**.
* **Backend Build:** `dotnet build backend/HotelSaas.slnx` đạt **0 Warning, 0 Error**.
* **Trạng thái Git:** 100% mã nguồn đã được hợp nhất an toàn vào nhánh `develop`.

---

# PHẦN II. TRỌN BỘ PROMPT NGUYÊN VĂN KẾT QUẢ TUẦN 04 (PROMPTS #01 ĐẾN #09)

Dưới đây là nguyên văn các câu prompt được sử dụng trong Tuần 04, kèm phân tích hạn chế của AI và cách sinh viên đối soát, chỉnh sửa:

---

### 👤 PROMPT CHO NGÔ VÕ TUẤN AN (24TX810001)

#### 🔹 Prompt #01 — Ký số bảo mật VNPay HMAC-SHA512
```text
Bạn là Senior Backend Developer chuyên về tích hợp Cổng thanh toán trực tuyến (.NET 10 Clean Architecture).
HÃY XÂY DỰNG DỊCH VỤ VnpayPaymentService ĐỂ TẠO URL THANH TOÁN VÀ KIỂM TRA CHỮ KÝ SỐ VNPay THEO CHUẨN HMAC-SHA512:
1. Thuật toán: Sắp xếp các tham số truy vấn (query parameters) theo thứ tự alphabet (ASCII).
2. Tạo chuỗi dữ liệu ký (hash data) và tính mã băm HMAC-SHA512 với bí mật vnp_HashSecret.
3. Tạo hàm ValidateSignature(IQueryCollection query) để đối soát chữ ký số trả về từ VNPay.
Lưu ý: Không làm sai lệch thứ tự tham số và phải tương thích với chuẩn VNPay Sandbox.
```
* **Lỗi do AI sinh ra (AI Limitation):** AI sử dụng `HttpUtility.UrlEncode` mã hóa từng giá trị trước khi đưa vào hàm băm HMAC-SHA512, khiến chữ ký băm sinh ra bị lệch so với phía VNPay, dẫn đến lỗi Checksum (Mã lỗi 97).
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Hãy điều chỉnh hàm tạo chữ ký VNPay: khi xây dựng rawHashData, chỉ lấy raw string của các trường có tiền tố 'vnp_' (loại trừ vnp_SecureHash và vnp_SecureHashType) nối bằng '&', KHÔNG UrlEncode các ký tự dấu cách thành '+' trước khi tính băm. Cung cấp thêm cơ chế fallback kiểm tra cả unencoded và encoded để bảo đảm tương thích hai chiều.
  ```
* **Minh chứng:** [VnpayPaymentService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs) (Commit [`e781ac1`](https://github.com/GinNgo/hotel-saas-v2/commit/e781ac1) & [`fe0cc91`](https://github.com/GinNgo/hotel-saas-v2/commit/fe0cc91)).

---

#### 🔹 Prompt #02 — Xử lý Webhook VNPay IPN ngầm
```text
Bạn là Backend Architect của Hotel SaaS Platform v2 (.NET 10 + EF Core 10).
HÃY VIẾT MediatR Command Handler ProcessVnpayIpnCommand ĐỂ TIẾP NHẬN VÀ XỬ LÝ KẾT QUẢ THANH TOÁN TỪ WEBHOOK IPN CỦA VNPAY:
1. Xác minh chữ ký số của VNPay.
2. Kiểm tra mã giao dịch (vnp_TxnRef), đối soát số tiền (vnp_Amount).
3. Cập nhật trạng thái Booking từ PendingPayment sang Confirmed, lưu lại mã giao dịch ngân hàng.
4. Trả về đúng định dạng JSON mà VNPay yêu cầu: {"RspCode": "00", "Message": "Confirm Success"}.
```
* **Lỗi do AI sinh ra (AI Limitation):** Webhook IPN chạy dưới dạng background request không có User context (không có Header `X-Tenant-Id` hay Token của người dùng), mã do AI sinh ra bị DbContext chặn lại hoặc vi phạm nguyên tắc cách ly dữ liệu đa chi nhánh Fail-Closed.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Vì Webhook IPN là unauthenticated callback từ máy chủ VNPay, hãy truy vấn Booking bằng TransactionRef trước mà không bật global query filter, sau đó nạp TenantId và PropertyId từ chính bản ghi Booking vào ICurrentTenantService trước khi gọi SaveChangesAsync() để đảm bảo tuân thủ TenantPropertySaveChangesInterceptor.
  ```
* **Minh chứng:** [ProcessVnpayIpnCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ProcessVnpayIpn/ProcessVnpayIpnCommand.cs) (Commit [`4a7927b`](https://github.com/GinNgo/hotel-saas-v2/commit/4a7927b)).

---

#### 🔹 Prompt #03 — Xác thực Email & Tạo Token bảo mật Stateless
```text
Bạn là Security Engineer trong hệ thống Hotel SaaS Platform v2.
HÃY THIẾT KẾ CƠ CHẾ KÍCH HOẠT TÀI KHOẢN QUA EMAIL CHO KHÁCH HÀNG MỚI ĐĂNG KÝ:
1. Sau khi đăng ký thành công, gửi email kích hoạt tài khoản có chứa đường link xác nhận.
2. Khi khách click vào link, hệ thống kích hoạt cờ IsEmailVerified = true và chuyển hướng về trang đăng nhập.
```
* **Lỗi do AI sinh ra (AI Limitation):** AI đề xuất lưu mã OTP 6 số và thời gian hết hạn trực tiếp vào cột trong bảng `Users`. Việc này làm tăng độ phức tạp của CSDL, đòi hỏi thêm migration và phải quản lý vòng đời xóa mã OTP sau khi dùng.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Không thêm cột OTP vào cơ sở dữ liệu. Hãy triển khai cơ chế Stateless JWT Token: ký HMAC-SHA256 với secret của hệ thống, thêm claim "purpose": "email_verification", thời hạn sống 30 phút. Backend giải mã và kiểm tra chữ ký token khi người dùng bấm vào link /confirm-email?token=...
  ```
* **Minh chứng:** [JwtService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs) (Commit [`9c48602`](https://github.com/GinNgo/hotel-saas-v2/commit/9c48602)).

---

### 👤 PROMPT CHO NGUYỄN KHÔI NGUYÊN (24TX810011)

#### 🔹 Prompt #04 — Xuất báo cáo Doanh thu Excel bằng ClosedXML
```text
Bạn là .NET Developer phụ trách phân hệ báo cáo trong Hotel SaaS Platform v2.
HÃY XÂY DỰNG ReportExportService SỬ DỤNG THƯ VIỆN ClosedXML ĐỂ XUẤT BÁO CÁO DOANH THU KHÁCH SẠN RA FILE EXCEL (.xlsx):
1. Bảng tính gồm: Tiêu đề báo cáo, Tên chi nhánh, Khoảng thời gian từ ngày - đến ngày.
2. Danh sách các cột: Mã đặt phòng, Tên khách hàng, Phòng, Ngày đến, Ngày đi, Doanh thu phòng, Doanh thu minibar/dịch vụ, Tổng cộng.
3. Có định dạng tiền tệ VND, căn chỉnh lề chuyên nghiệp và dòng Tổng cộng ở cuối bảng.
```
* **Lỗi do AI sinh ra (AI Limitation):** AI tính tổng doanh thu bằng code C# ở server rồi ghi số cứng vào ô tổng cộng. Nếu người dùng mở file Excel và điều chỉnh số liệu của một hàng thì ô tổng cộng không tự cập nhật lại.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Hãy thay thế giá trị số cứng ở dòng Tổng cộng bằng công thức Excel '=SUM(H{startRow}:H{endRow})'. Đồng thời bổ sung kiểm tra phân lập TenantId/PropertyId trong hàm truy vấn dữ liệu trước khi nạp vào ClosedXML.
  ```
* **Minh chứng:** [ReportExportService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) (Commit [`4983182`](https://github.com/GinNgo/hotel-saas-v2/commit/4983182)).

---

#### 🔹 Prompt #05 — Xuất Hóa đơn Thanh toán PDF bằng QuestPDF
```text
Bạn là Full-Stack Developer chuyên về tạo tài liệu PDF trong .NET 10 với QuestPDF.
HÃY XÂY DỰNG TÍNH NĂNG XUẤT HÓA ĐƠN ĐẶT PHÒNG / PHIẾU THU PDF:
1. Layout chuẩn khổ A4 dọc, có Header thương hiệu khách sạn, Mã hóa đơn, Thông tin khách hàng.
2. Chi tiết các khoản mục tiền phòng, phụ phí, thuế GTGT, số tiền đã thanh toán và số tiền còn lại.
3. Thiết kế bảng đẹp mắt, rõ ràng và có chữ ký xác nhận của thu ngân.
```
* **Lỗi do AI sinh ra (AI Limitation):** AI chèn mã QR tra cứu bằng cách gọi URL Google Charts API (`https://chart.googleapis.com/...`), làm hệ thống phụ thuộc vào kết nối internet bên ngoài, vi phạm tính riêng tư và gây lỗi đơ luồng khi mất mạng.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Tạm thời loại bỏ lệnh gọi HTTP đến Google Charts API để đảm bảo bản build 0 lỗi và xuất PDF offline an toàn. Chuyển phần mã QR tra cứu sang kế hoạch Tuần 5 để tích hợp thư viện sinh SVG QR Code nội bộ (QRCoder).
  ```
* **Minh chứng:** [ReportExportService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) (Commit [`4983182`](https://github.com/GinNgo/hotel-saas-v2/commit/4983182)).

---

### 👤 PROMPT CHO TRẦN TRỌNG TẤN (24TX810025)

#### 🔹 Prompt #06 — Trung tâm Thông báo Realtime SignalR & Toast Lễ tân
```text
Bạn là Frontend Specialist chuyên về Angular 22 Standalone Signals và SignalR Client.
HÃY XÂY DỰNG COMPONENT NotificationBellComponent ĐỂ TÍCH HỢP TRÊN HEADER PMS:
1. Biểu tượng chuông thông báo, hiển thị badge số lượng thông báo chưa đọc.
2. Dropdown danh sách 10 thông báo gần nhất, phân loại icon theo sự kiện (Booking, Payment, Room).
3. Hỗ trợ thao tác bàn phím WAI-ARIA (Escape để đóng, ArrowUp/ArrowDown để di chuyển).
4. Khi có thông báo mới từ SignalR Hub, tự động phát âm thanh nhẹ nhàng và hiện thông báo Toast nổi 5 giây.
```
* **Lỗi do AI sinh ra (AI Limitation):** AI sử dụng file âm thanh MP3 bên ngoài (`audio.src = 'assets/bell.mp3'`) dẫn đến lỗi 404 khi deploy lên VPS, đồng thời dùng `setInterval` gây rò rỉ bộ nhớ khi component bị destroy.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Không load file MP3 từ assets. Hãy sử dụng Web Audio API (AudioContext) để tổng hợp âm thanh chuông 2 âm sắc (dual-tone chime: 880Hz -> 1046.5Hz) trực tiếp bằng mã JavaScript. Đảm bảo dọn dẹp subscription và unregister handler khi OnDestroy.
  ```
* **Minh chứng:** [notification-bell.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/notification-bell/notification-bell.component.ts) (Commit [`ce6dfe9`](https://github.com/GinNgo/hotel-saas-v2/commit/ce6dfe9)).

---

#### 🔹 Prompt #07 — Cảnh báo Hết hạn Giữ phòng 3 phút & Gia hạn 5 phút
```text
Bạn là Angular 22 Signals Developer.
TẠI MÀN HÌNH GIỮ PHÒNG booking-hold.page.ts, HÃY CẢI TIẾN BỘ ĐẾM NGƯỢC THỜI GIAN 15 PHÚT:
1. Khi thời gian còn <= 3 phút (180 giây), chuyển màu đồng hồ sang màu hổ phách cảnh báo và hiển thị thông báo giục khách hoàn tất thanh toán.
2. Bổ sung nút 'Gia hạn thêm 5 phút' để khách có thêm thời gian thanh toán.
```
* **Lỗi do AI sinh ra (AI Limitation):** Nút gia hạn của AI chỉ tăng biến cục bộ trên frontend (`remainingSeconds += 300`) mà không đồng bộ thời gian với máy chủ, cho phép khách click liên tục nhiều lần để giữ phòng vô hạn.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Bắt buộc đồng bộ thời gian hết hạn với backend; thêm biến đếm holdExtensionCount và chỉ cho phép gia hạn tối đa ĐÚNG 1 LẦN. Sau khi gia hạn thành công, vô hiệu hóa (disable) nút bấm ngay lập tức.
  ```
* **Minh chứng:** [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts) (Commit [`3f43393`](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393)).

---

#### 🔹 Prompt #08 — Ghi Nhật ký Kiểm toán (Audit Logging System)
```text
Bạn là Senior Backend Developer (.NET 10 + EF Core 10).
HÃY XÂY DỰNG HỆ THỐNG GHI NHẬT KÝ KIỂM TOÁN (AUDIT LOGGING) CHO KHÁCH SẠN:
1. Lưu lại mọi hành động thay đổi dữ liệu nhạy cảm (Đổi giá phòng, Sửa hóa đơn, Hủy đặt phòng).
2. Lưu thông tin: UserId, UserName, Action, EntityName, RecordId, OldValues, NewValues, Timestamp.
3. Xây dựng API và giao diện trang quản trị để tra cứu lịch sử kiểm toán.
```
* **Lỗi do AI sinh ra (AI Limitation):** Ban đầu AI gợi ý gọi hàm ghi log thủ công ở từng Controller, dễ bỏ sót khi có luồng nghiệp vụ mới. Ngoài ra, chuỗi JSON lưu cả mật khẩu và thông tin thẻ tín dụng mà không có bộ lọc dữ liệu nhạy cảm.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Hãy chuyển cơ chế ghi log sang EF Core SaveChangesInterceptor (AuditSaveChangesInterceptor) tự động bắt các thay đổi Entity State trong ChangeTracker. Thêm bộ lọc loại trừ các thuộc tính nhạy cảm (PasswordHash, SecurityStamp, CreditCard) trước khi serialize sang JSON. Phân quyền chỉ Owner và GeneralManager mới được xem nhật ký.
  ```
* **Minh chứng:** [AuditSaveChangesInterceptor.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/AuditSaveChangesInterceptor.cs) (Commit [`96e0acc`](https://github.com/GinNgo/hotel-saas-v2/commit/96e0acc)).

---

#### 🔹 Prompt #09 — Quy trình Hủy phòng B2C & Tính phí phạt 24h (D23 Policy)
```text
Bạn là Full-Stack Developer am hiểu nghiệp vụ Khách sạn.
HÃY XÂY DỰNG CHỨC NĂNG HỦY ĐẶT PHÒNG TRÊN TRANG TRA CỨU booking-status.page.ts:
1. Khách hàng bấm nút 'Yêu cầu hủy phòng'.
2. Hiển thị modal tính toán chính sách phạt: Hủy trước 24h giờ nhận phòng thì miễn phí, hủy trong vòng 24h thì phạt 100% tiền cọc đêm đầu tiên.
3. Khi khách xác nhận, cập nhật trạng thái đơn thành Cancelled và giải phóng phòng trống.
```
* **Lỗi do AI sinh ra (AI Limitation):** Giao diện của AI chỉ hiện tỷ lệ phạt chung chung mà không hiển thị rõ mốc giờ check-in thực tế; thông báo mặc định chuyển khoản trả tiền ngay khiến khách hiểu nhầm việc hủy phòng đồng nghĩa với việc tiền đã được ngân hàng tự động chuyển trả.
* **Quá trình sinh viên kiểm chứng & tinh chỉnh (Prompt Fix):**
  ```text
  Prompt Fix: Hãy tính toán và hiển thị rõ: Giờ check-in dự kiến, Thời điểm yêu cầu hủy, Số giờ còn lại trước giờ nhận phòng; in đậm điều khoản phạt. Tách bạch rõ ràng thông báo: 'Đã hủy giữ phòng thành công. Yêu cầu hoàn tiền đã được chuyển sang bộ phận Kế toán đối soát và giải ngân theo quy định D23'.
  ```
* **Minh chứng:** [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts) (Commit [`3f43393`](https://github.com/GinNgo/hotel-saas-v2/commit/3f43393)).

---

# PHẦN III. MASTER PROMPT TỔNG HỢP & BẢO VỆ KẾT QUẢ TUẦN 04
*(Dành cho các thành viên khi cần sinh báo cáo cá nhân, làm slide thuyết trình hoặc tóm tắt nghiệm thu)*

```text
Bạn là Thư ký Kỹ thuật và Lead QA của dự án Hotel SaaS Platform v2 (.NET 10 + Angular 22 + PostgreSQL 17 Staging trên https://luxustay.duckdns.org/).
DỰA TRÊN KẾT QUẢ THỰC TẾ TUẦN 04 ĐÃ ĐƯỢC NGHIỆM THU VÀ MERGE VÀO NHÁNH DEVELOP:
- Ngô Võ Tuấn An (24TX810001 - Lead): VNPay Sandbox HMAC-SHA512, Webhook IPN Fail-Closed, Email Verification Token HMAC-SHA256, Nâng cấp giao diện Luxury B2C, Chuẩn hóa 100% PrimeNG DatePicker.
- Nguyễn Khôi Nguyên (24TX810011): Xuất Excel ClosedXML với công thức SUM động, Xuất PDF QuestPDF, UI thanh toán B2C tiền mặt & VietQR.
- Trần Trọng Tấn (24TX810025): Notification Bell OnPush Signals (21 tests), Cảnh báo giữ phòng 3 phút & gia hạn 5 phút (39 tests), Audit Logging Interceptor (29 tests), Hủy phòng B2C & chính sách D23 (111 tests).
- Chất lượng: 578/578 frontend unit tests pass, 0 compile errors, 0 warnings.

HÃY SINH RA BẢN TỔNG HỢP NGHIỆM THU ĐẦY ĐỦ GỒM:
1. Bảng số liệu định lượng (Tests, Commits, API Endpoints, UI Components).
2. Tóm tắt đóng góp nổi bật của từng bạn kèm mã Commit GitHub tương ứng.
3. Kịch bản tóm tắt 3 phút trình diễn cho Giảng viên hướng dẫn (ThS. Huỳnh Xuân Phụng).
```

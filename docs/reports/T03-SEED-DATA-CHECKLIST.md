# DANH SÁCH DỮ LIỆU MẪU & CẤU HÌNH TRÌNH DIỄN (T03 — SEED DATA CHECKLIST)
## LuxeStay Cloud — Hotel SaaS Platform v2 (.NET 10 + Angular 22 Signals + PostgreSQL 17)

---

## 1. MỤC ĐÍCH & NGUYÊN TẮC QUẢN LÝ DỮ LIỆU DEMO

* **Mã tài liệu:** `T03-SEED-DATA-CHECKLIST`
* **Mục tiêu:** Thiết lập bảng kiểm định toàn diện về dữ liệu mẫu (*Seed Data*), tài khoản người dùng, danh mục phòng và cấu hình tích hợp nhằm bảo đảm buổi trình diễn nghiệp vụ Tuần 5 diễn ra trôi chảy 100%, không gặp lỗi phát sinh do thiếu dữ liệu hay xung đột kho phòng.
* **Nguyên tắc an toàn (Security Guardrail):**
  - Tuân thủ nghiêm ngặt **Quy tắc số 6 (Zero-Secrets Policy)** trong `AGENTS.md`.
  - Tuyệt đối không ghi mật khẩu production, private API keys hay thông tin thẻ ngân hàng thật vào tài liệu.
  - Sử dụng các tài khoản thử nghiệm nội bộ và thẻ kiểm thử chính thức được cung cấp bởi cổng thanh toán VNPay Sandbox.

---

## 2. BẢNG KIỂM ĐỊNH CƠ SỞ & KHÁCH SẠN (PROPERTIES CHECKLIST)

| Thuộc tính | Cơ sở chính (Primary Demo Property) | Cơ sở phụ / Dự phòng (Alternative Property) |
| :--- | :--- | :--- |
| **Tên cơ sở** | **Grand Hotel Sài Gòn (Quận 1)** | **Grand Hotel Phú Nhuận** |
| **Mã định danh (PropertyId)** | `ed955ce2-2e01-4437-9bc8-391def32acdf` | `f885e3d7-4638-4228-b80c-279fb6d9c7e0` |
| **Mã chi nhánh (Code)** | `CN-Q1` | `CN-PN` |
| **Tập đoàn chủ quản (Tenant)** | Grand Hotel Group (`tenant.id = 1`) | Grand Hotel Group (`tenant.id = 1`) |
| **Địa chỉ hiển thị** | 128 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh | 253 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh |
| **Số điện thoại & Hotline** | `028-38234567` / `1900-6868` | `028-39956789` / `1900-6868` |
| **Giờ quy chuẩn (Check-in / Out)** | Nhận phòng: **14:00** — Trả phòng: **12:00** | Nhận phòng: **14:00** — Trả phòng: **12:00** |
| **Ghi chú môi trường** | Môi trường Local: Sẵn sàng 100% | Môi trường Local: Sẵn sàng 100% |
| **Tham chiếu Staging** | Tương đương cụm khách sạn Sài Gòn Lex trên `https://luxustay.duckdns.org/` | Dự phòng khi cơ sở 1 đầy phòng |

---

## 3. DANH MỤC PHÒNG & TÌNH TRẠNG KHO BÁN (ROOMS & INVENTORY)

### 3.1. Hạng phòng thử nghiệm (Room Types)

| Mã hạng | Tên hạng phòng | Cơ sở | Giá lưu trú qua đêm | Số khách chuẩn | Giường & Diện tích | Trạng thái bán |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`DLX-Q1`** | **Deluxe Double (Q1)** | Quận 1 | **1.200.000 đ** | 2 người | 1 Giường King (32 m²) | Khả dụng bán |
| **`STD-Q1`** | **Standard Twin (Q1)** | Quận 1 | **800.000 đ** | 2 người | 2 Giường đơn (24 m²) | Khả dụng bán |
| **`SUI-PN`** | **Executive Suite (PN)** | Phú Nhuận | **2.000.000 đ** | 3 người | 1 King + 1 Sofa bed (48 m²) | Khả dụng bán |

### 3.2. Danh sách phòng vật lý phục vụ Demo (Physical Rooms)

| Số phòng | Hạng phòng | Cơ sở | Tầng | Trạng thái buồng phòng | Điều kiện sử dụng cho Demo |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **`101`** | Deluxe Double | Quận 1 | Tầng 1 | `Clean` (Sạch sẽ) | Dành cho demo đặt phòng qua đêm |
| **`201`** | Deluxe Double | Quận 1 | Tầng 2 | `Clean` (Sạch sẽ) | Dành cho demo thanh toán & đối soát |
| **`301`** | Executive Suite | Phú Nhuận | Tầng 3 | `Clean` (Sạch sẽ) | Dành cho demo hạng Suite cao cấp |
| **`102`** | Standard Twin | Quận 1 | Tầng 1 | `Dirty` (Chưa dọn) | Giữ nguyên để minh họa sơ đồ phòng đa trạng thái |
| **`302`** | Superior King | Phú Nhuận | Tầng 3 | `Cleaning` (Đang dọn) | Giữ nguyên để minh họa trạng thái buồng phòng |

> [!TIP]
> **Khuyến nghị trước buổi Demo:** Chạy lệnh kiểm tra kho phòng trống trên backend để đảm bảo Phòng `101` và `201` không bị vướng lịch đặt phòng cũ trong khoảng thời gian diễn ra buổi báo cáo.

---

## 4. TÀI KHOẢN NGƯỜI DÙNG & PHÂN QUYỀN RBAC (USER ACCOUNTS)

Mọi tài khoản đều tuân thủ nguyên tắc cách ly quyền hạn (*Role-Based Access Control*):

| Vai trò (Role) | Họ và tên hiển thị | Email đăng nhập | Cơ sở phụ trách | Quyền hạn nghiệp vụ (Permissions) |
| :--- | :--- | :--- | :---: | :--- |
| **Khách hàng Demo (Guest)** | Nguyễn Văn An | `an.demo@hotelsaas.test` *(hoặc khách vãng lai không cần login)* | — | Đặt phòng B2C, nhận mã Hold Token, thanh toán trực tuyến, tra cứu booking bằng mã đặt chỗ. |
| **Lễ tân (Receptionist)** | Lê Lễ Tân | `staff.single@hotelsaas.local` | Grand Hotel Sài Gòn (Q1) | Xem danh sách đặt phòng, nhận thông báo SignalR (sanitized payload), xem sơ đồ phòng, xuất hóa đơn / phiếu voucher. |
| **Quản lý (Manager)** | Trần Quản Lý | `manager.both@hotelsaas.local` | Cả 2 chi nhánh (Q1 & PN) | Có toàn quyền chi nhánh và quyền tài chính: `PAYMENTS:Approve` (bit 16), duyệt yêu cầu hoàn tiền D23, xem báo cáo doanh thu. |
| **Mật khẩu dùng chung cho môi trường Local Dev** | Được thiết lập tự động bởi seeder dev từ biến môi trường `LOCAL_DEV_SEED_PASSWORD` / cấu hình cục bộ (tuyệt đối không lưu mật khẩu plaintext trong tài liệu hay mã nguồn theo Zero-Secrets Policy). |

---

## 5. THÔNG SỐ CỔNG THANH TOÁN THỬ NGHIỆM (PAYMENT SANDBOX)

### 5.1. Cổng thanh toán VNPay Sandbox (Bắt buộc cho luồng thanh toán thật)

* **Môi trường:** VNPay Sandbox Gateway (`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`)
* **Thẻ ATM thử nghiệm chính thức của VNPay:**
  - **Ngân hàng:** NCB (Ngân hàng Quốc Dân)
  - **Số thẻ:** `9704198526191432198`
  - **Tên chủ thẻ:** `NGUYEN VAN A`
  - **Ngày phát hành:** `07/15`
  - **Mã OTP xác nhận:** `123456`
* **Đường dẫn Webhook / IPN tiếp nhận:**
  - Endpoint: `POST /api/payments/vnpay-ipn`
  - Chữ ký bảo mật: HMAC SHA-512 (đã cấu hình an toàn trên backend)
  - Cơ chế: Xác thực số tiền `vnp_Amount / 100` khớp với `Reservation.TotalAmount` trước khi cập nhật `PaymentStatus.Completed`.

### 5.2. Chuyển khoản VietQR 24/7 (Phương thức hỗ trợ / Giả lập)

* **Định dạng mã VietQR chuẩn:**
  ```text
  https://img.vietqr.io/image/MBBank-0988889999-compact2.png?amount={RemainingAmount}&addInfo=THANHTOAN%20{ConfirmationCode}
  ```
* **Thông tin tài khoản nhận tiền thụ hưởng:**
  - **Ngân hàng:** Ngân hàng Quân Đội (MBBank)
  - **Số tài khoản:** `0988889999`
  - **Chủ tài khoản:** `KHACH SAN GRAND HOTEL SAI GON`
  - **Cú pháp chuyển khoản:** `THANHTOAN [Mã_Đặt_Phòng]`

---

## 6. HÓA ĐƠN ĐIỆN TỬ, PHIẾU XÁC NHẬN & MÃ QR TRA CỨU (PRINT & QR)

* **Phiếu in Hóa đơn Dịch vụ (Guest Invoice / Folio):**
  - Đường dẫn truy cập: `/print/invoice/:reservationId`
  - Định dạng hiển thị: A4 chuẩn, có thuế GTGT VAT 8%, tách dòng chi phí phòng và phụ thu, đóng dấu tròn *"ĐÃ XÁC NHẬN THANH TOÁN"*.
* **Phiếu xác nhận đặt phòng (Booking Voucher):**
  - Đường dẫn truy cập: `/print/voucher/:confirmationCode`
  - Mã QR Check-in: Tích hợp mã QR chuẩn quốc tế chứa cú pháp làm thủ tục nhanh:
    `HOTEL-CHECKIN:{confirmationCode}:{guestName}`
* **Cổng tra cứu Booking công khai của khách (Guest Lookup):**
  - Đường dẫn truy cập: `/booking/lookup`
  - Tra cứu bằng: `Mã đặt phòng (ConfirmationCode)` + `Email` hoặc `Số điện thoại`.

---

## 7. BẢNG KIỂM TRA MÔI TRƯỜNG TRƯỚC GIỜ BÁO CÁO (PRE-FLIGHT CHECKLIST)

Thực hiện kiểm tra tuần tự trước giờ demo 15 phút:

- [x] **1. Cơ sở dữ liệu PostgreSQL:** Container `hotelsaas-db` đang chạy trên cổng `5435`.
- [x] **2. Backend .NET 10 WebApi:** Server Kestrel khởi động trên `http://localhost:5283` (HTTP 200 OK tại `/api/health`).
- [x] **3. Frontend Angular 22:** Ứng dụng chạy trên `http://localhost:4200` (Không có lỗi compile, không có lỗi console đỏ).
- [x] **4. SignalR WebSocket:** Kết nối tới `/hubs/notifications` báo trạng thái `Connected`.
- [x] **5. Âm thanh chuông báo:** Kiểm tra trên trình duyệt lễ tân đã bật quyền phát âm thanh (không bị chặn Autoplay).
- [x] **6. Kho phòng trống:** Phòng `101` hoặc `201` đang ở trạng thái `Clean` và không có lịch đặt trùng.

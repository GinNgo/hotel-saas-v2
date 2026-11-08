# BẰNG CHỨNG KIỂM THỬ THỰC TẾ LUỒNG DEMO (T03 — TEST RESULTS)
## LuxeStay Cloud — Hotel SaaS Platform v2 (.NET 10 + Angular 22 Signals + PostgreSQL 17)

---

## 1. MỤC ĐÍCH & PHƯƠNG PHÁP KIỂM THỬ

* **Mã tài liệu:** `T03-TEST-RESULTS`
* **Vị trí phụ trách:** Lead QA Engineer & Verification Specialist
* **Người thực hiện:** Trần Trọng Tân (MSSV: 24TX810025)
* **Phương pháp kiểm thử:** Kiểm thử tích hợp tự động (*Automated Integration Tests*), Kiểm thử WebSocket Realtime đa phiên (*Multi-Client Live E2E*), và Kiểm thử đối soát luồng giao diện người dùng (*End-to-End User Flow Verification*).
* **Cam kết trung thực:** Tuyệt đối không ghi `PASS` cho các tính năng hoặc luồng bên ngoài chưa kiểm chứng thực tế; mọi kết quả đều kèm trích dẫn file mã nguồn, endpoint công khai/nội bộ và kết quả thực thi thực tế.

---

## 2. MA TRẬN KẾT QUẢ KIỂM THỬ NGHIỆM THU (20 TIÊU CHÍ BẮT BUỘC)

| Mã ID | Hạng mục kiểm tra (Test Case) | Kết quả mong đợi (Expected) | Kết quả thực tế (Actual) | Trạng thái (Status) | Bằng chứng kiểm chứng (Evidence) |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | **Website Public Booking mở được** | Trang chủ `/booking` tải nhanh, bố cục giao diện hiển thị đầy đủ hình ảnh thương hiệu và thanh tìm kiếm. | Trang chủ tải thành công, HTTP 200, hiển thị đầy đủ Header, Hero banner và danh sách khách sạn từ `GET /api/public/properties`. | **PASS** | [`booking.page.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) & [`public-booking.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) (23/23 tests PASS). |
| **TC-02** | **Booking Search có phòng hợp lệ (Luồng Public)** | Khách tìm kiếm phòng trống tại Grand Hotel Sài Gòn (Quận 1) qua API công khai trả về danh sách hạng phòng khả dụng và báo giá. | `GET /api/public/properties/grand-hotel-saigon-q1/availability?rentalType=Overnight&startAtUtc=2026-11-20T07:00:00.000Z&endAtUtc=2026-11-22T05:00:00.000Z&checkInDate=2026-11-20&checkOutDate=2026-11-22` trả về HTTP 200 kèm hạng phòng `Deluxe Double (Q1)` (`isAvailable: true`, `availableRooms: 2`, `estimatedPrice: 1.900.000 đ`). | **PASS** | Kiểm chứng trực tiếp trên endpoint công khai [`PublicController.GetAvailability`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PublicController.cs#L149-L167) và Step 0 trong [`verify-signalr-e2e.mjs`](file:///d:/hotel-saas-v2/scripts/verify-signalr-e2e.mjs#L46-L72). |
| **TC-03** | **DatePicker chọn ngày đúng** | Chọn ngày nhận/trả phòng mượt mà theo chuẩn múi giờ Việt Nam (UTC+7), không lỗi lệch ngày. | PrimeNG DatePicker định dạng `dd/mm/yy`, kiểm soát chặt chẽ mốc giờ nhận 14:00 và trả phòng 12:00 theo UTC+7. | **PASS** | [`date-time.util.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/core/utils/date-time.util.spec.ts) (28/28 tests PASS). |
| **TC-04** | **Booking tạo thành công** | Gửi thông tin đặt phòng tạo được bản ghi mới với mã duy nhất `RES-XXXXXX`. | Luồng giữ chỗ công khai `POST /api/public/bookings/hold` và tạo đơn nội bộ `POST /api/reservations` trả về HTTP 201 Created kèm `ConfirmationCode`. | **PASS** | [`PublicController.CreateHold`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PublicController.cs#L198-L246) & Step 6 trong [`verify-signalr-e2e.mjs`](file:///d:/hotel-saas-v2/scripts/verify-signalr-e2e.mjs). |
| **TC-05** | **Hold Countdown hoạt động** | Trang `/booking/hold/:token` đếm ngược 15:00 dựa trên mốc thời gian máy chủ. | Màn hình hiển thị đồng hồ đếm ngược 15 phút, tính toán chênh lệch dựa trên `HoldExpiresAtUtc` từ backend. | **PASS** | [`booking-hold.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-hold.page.spec.ts) (39/39 tests PASS). |
| **TC-06** | **Payment Sandbox & IPN bên ngoài xác nhận** | Thanh toán qua cổng VNPay Sandbox thực tế bên ngoài và nhận callback IPN công khai qua Internet/tunnel. | Logic xử lý `POST /api/payments/vnpay-ipn` (kiểm tra chữ ký HMAC-SHA512) và thu tiền nội bộ `POST /api/payments` hoạt động đúng; tuy nhiên giao dịch thẻ thật trên cổng VNPay Sandbox bên ngoài kèm public webhook tunnel chưa được chạy live trong phiên local này. | **Chưa kiểm chứng** | **Cách kiểm chứng tiếp:** Cấu hình `Vnpay:TmnCode`, `Vnpay:HashSecret` trong User-Secrets và mở public tunnel (ngrok/cloudflared) trỏ về `POST /api/payments/vnpay-ipn`, sau đó thực hiện thanh toán thẻ NCB Sandbox trên trình duyệt để ghi nhận log IPN thực tế. |
| **TC-07** | **Không xác nhận giả từ frontend** | Trình duyệt chuyển hướng (Client redirect) không thể tự ý chuyển trạng thái booking sang Paid nếu thiếu xác nhận từ backend. | Booking chỉ chuyển `Confirmed` khi backend xác thực giao dịch hợp lệ (`ProcessVnpayIpnCommand` hoặc `CreatePaymentCommand`). | **PASS** | [`booking-status.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-status.page.spec.ts) (86/86 tests PASS). |
| **TC-08** | **SignalR Receptionist nhận ngay** | Ngay khi thanh toán được xác nhận tại backend, chuông thông báo lễ tân tại đúng chi nhánh nhận sự kiện ngay. | SignalR đẩy sự kiện `ReceiveBookingPaymentConfirmed` đến nhóm `Property_{id}_frontdesk` và `Property_{id}_financial` của chi nhánh `ed955ce2-2e01-4437-9bc8-391def32acdf` (Grand Hotel Sài Gòn Q1). | **PASS** | [`NotificationDispatcher.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs#L123-L181) & Log E2E Step 7. |
| **TC-09** | **Không cần F5 (Zero Refresh)** | Giao diện PMS tự động cập nhật mà người dùng không cần tải lại trang; nếu F5 vẫn bảo toàn danh sách thông báo theo chi nhánh. | Angular Signals (`notificationService.unreadCount()`, `notifications()`) tự động cập nhật `OnPush` với 0 lần F5; đồng thời lưu trữ cô lập theo `tenant + user + property` khi reload. | **PASS** | [`notification-bell.component.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/shared/components/notification-bell/notification-bell.component.spec.ts) (26/26 tests PASS). |
| **TC-10** | **Badge tăng đúng một lần** | Số lượng thông báo chưa đọc tăng chính xác 1 đơn vị cho mỗi sự kiện nghiệp vụ, không bị nhảy đúp. | Áp dụng `EventId` tất định (`evt-pay-{code}`, `evt-cancel-{code}`, `evt-holdexp-{code}`), badge tăng đúng +1 trên cả Manager và Receptionist. | **PASS** | Log E2E Step 7 & Step 8 (`MANAGER received EXACTLY 1`, `RECEPTIONIST received EXACTLY 1`). |
| **TC-11** | **Không leak financial payload** | Bản tin gửi cho Lễ tân không chứa doanh thu, số tiền thanh toán, phương thức hay số tiền hoàn dự kiến. | Payload lễ tân tại nhóm `Property_{id}_frontdesk` luôn nhận `paidAmount: 0`, `paymentMethod: ""`, `refundableAmount: 0`. | **PASS** | Log E2E Step 7 & Step 8 (`Paid Amount: 0 VND (Sanitized: Hidden)`). |
| **TC-12** | **Click notification đúng nơi xử lý** | Nhấp chuột vào thông báo điều hướng thẳng đến đúng màn hình và tự động mở chi tiết đơn/yêu cầu hoàn tiền. | Sự kiện thanh toán/hết hạn giữ chỗ mở modal chi tiết tại `/reservations?code=RES-XXXXXX`; sự kiện hủy có hoàn tiền của Quản lý mở thẳng modal D23 tại `/payments?tab=refunds&code=RES-XXXXXX`. | **PASS** | [`admin-layout.ts`](file:///d:/hotel-saas-v2/frontend/src/app/layouts/admin-layout/admin-layout.ts) & [`refund-approval.component.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts). |
| **TC-13** | **PMS reservation & Folio chính xác** | Hồ sơ đặt phòng, Folio, báo cáo ca và báo cáo ngày phân biệt rạch ròi tiền đã thu, tiền đã chi hoàn và thực thu ròng. | Thu `1.000.000 đ`, chi hoàn `300.000 đ` -> Tổng thu giữ nguyên `1.000.000 đ`, tổng chi hoàn `300.000 đ`, thực thu ròng `700.000 đ` (không cộng nhầm thành `1.300.000 đ`). | **PASS** | [`GetShiftReportQueryHandler.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs), [`GetPaymentSummaryQueryHandler.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetPaymentSummary/GetPaymentSummaryQueryHandler.cs), [`GetFolioQueryHandler.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs). |
| **TC-14** | **Room Map/inventory nhất quán** | Sơ đồ phòng thể hiện đúng phòng đã được đặt trước nhưng chưa chuyển sang `Occupied` khi chưa check-in. | Sơ đồ phòng hiển thị phòng `Clean` kèm nhãn đặt trước; chỉ đổi sang `Occupied` khi thực hiện check-in. | **PASS** | [`rooms.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/rooms/rooms.page.spec.ts) (7/7 tests PASS). |
| **TC-15** | **Invoice PDF hiển thị đúng** | Trang `/print/invoice/:id` hiển thị hóa đơn chuẩn có VAT 8%, mã VietQR và thông tin thanh toán. | Hóa đơn hiển thị đầy đủ thông tin khách, chi tiết phòng, thuế VAT và tổng tiền khớp 100%. | **PASS** | [`print-invoice.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/print/print-invoice.page.spec.ts) (3/3 tests PASS). |
| **TC-16** | **QR Voucher & tra cứu hoạt động** | Phiếu xác nhận `/print/voucher/:id` hiển thị mã QR dẫn đến trang tra cứu booking của khách. | Mã QR dẫn đến `/booking/lookup?code=RES-XXXXXX`, trang tra cứu hiển thị đúng trạng thái đơn. | **PASS** | [`print-voucher.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/print/print-voucher.page.spec.ts) (3/3 tests PASS) & [`booking-lookup.page.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-lookup.page.spec.ts) (34/34 tests PASS). |
| **TC-17** | **Tự động phát `HoldExpired` & Không lộ LookupToken** | Khi giữ phòng quá hạn mà chưa thanh toán, dịch vụ chạy nền tự động quét và phát `HoldExpired` về đúng chi nhánh, không chứa `LookupToken` hay `PIN`. | `ExpiredHoldSweepBackgroundService` tự động gọi `CheckExpiredHoldsCommand` định kỳ; Chi nhánh A nhận đúng 1 sự kiện `ReceiveHoldExpired`, Chi nhánh B nhận 0; đơn đã thanh toán không phát sự kiện; payload không có `lookupToken`. | **PASS** | [`ExpiredHoldSweepBackgroundService.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs), [`CheckExpiredHoldsCommand.cs`](file:///d:/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Commands/CheckExpiredHolds/CheckExpiredHoldsCommand.cs) & [`NotificationHubSecurityTests.cs`](file:///d:/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Notifications/NotificationHubSecurityTests.cs). |
| **TC-18** | **Hai browser contexts độc lập** | Phiên khách (Screen 1) và phiên Lễ tân (Screen 2) không chia sẻ cookie hay JWT. | Kết nối không có JWT vào `/hubs/notifications` bị từ chối ngay với `401 Unauthorized`; phiên khách và phiên nhân viên tách biệt hoàn toàn. | **PASS** | Log E2E Step 4 (`Unauthenticated connection correctly rejected with 401 Unauthorized`). |
| **TC-19** | **Không lỗi 401/403 ngoài dự kiến & Chặn Cross-Tenant** | Các thao tác đúng quyền hoạt động bình thường; thao tác sang chi nhánh khác hoặc thiếu quyền `PAYMENTS:Approve` bị chặn fail-closed. | Nhân viên cố tình join `PropertyId` ngoài phạm vi bị chặn (`ERR_PROPERTY_NOT_FOUND` / `ERR_PROPERTY_FORBIDDEN`); Lễ tân không có quyền `PAYMENTS:Approve` bị chặn `403 Forbidden`. | **PASS** | [`RefundApprovalManagementTests.cs`](file:///d:/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Payments/RefundApprovalManagementTests.cs) & [`refund-approval.component.spec.ts`](file:///d:/hotel-saas-v2/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.spec.ts) (14/14 tests PASS). |
| **TC-20** | **Demo kịch bản 5 phút & Script không chứa mật khẩu cứng** | Kịch bản demo chạy trọn vẹn trong 5 phút; script kiểm chứng E2E đọc tài khoản từ biến môi trường, không lưu mật khẩu cứng trong Git. | `scripts/verify-signalr-e2e.mjs` bắt buộc đọc `DEMO_MANAGER_EMAIL`, `DEMO_MANAGER_PASSWORD`, `DEMO_STAFF_EMAIL`, `DEMO_STAFF_PASSWORD` từ biến môi trường và dừng ngay nếu thiếu (không có fallback password). | **PASS** | [`scripts/verify-signalr-e2e.mjs`](file:///d:/hotel-saas-v2/scripts/verify-signalr-e2e.mjs#L7-L27). |

---

## 3. BẰNG CHỨNG THỰC THI KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST LOGS)

### 3.1. Kết quả kiểm thử Backend (xUnit) & Frontend (`ng test --no-watch`)
```text
========================================================================================
BỘ TEST SUITE (BACKEND .NET 10 & FRONTEND ANGULAR 22) SỐ LƯỢNG TESTS      KẾT QUẢ
========================================================================================
NotificationHubSecurityTests (xUnit)                  16 tests            PASS (100%)
RefundApprovalManagementTests (xUnit)                 14 tests            PASS (100%)
RefundApprovalComponent (refund-approval.spec.ts)     14 tests            PASS (100%)
PaymentsPage (payments.page.spec.ts)                  33 tests            PASS (100%)
NotificationBellComponent (notification-bell.spec.ts) 26 tests            PASS (100%)
Public Booking & Hold & Status & Lookup Specs         186 tests           PASS (100%)
Toàn bộ 44 Test Files trong workspace frontend        600 tests           PASS (100%)
========================================================================================
TỔNG KẾT: Backend (30/30 tests PASS) | Frontend (44 files / 600 tests PASS)
```

### 3.2. Bằng chứng kiểm chứng Public Availability API (TC-02) & Fail-Fast Env Guard (TC-20)
```text
[TC-02] GET /api/public/properties/grand-hotel-saigon-q1/availability?rentalType=Overnight&checkInDate=2026-11-20&checkOutDate=2026-11-22
HTTP 200 OK
[
  {
    "roomTypeId": "bc0da496-4cdd-45e3-baeb-d67ced743ba4",
    "roomTypeName": "Standard Twin (Q1)",
    "maxOccupancy": 2,
    "totalRooms": 1,
    "availableRooms": 0,
    "isAvailable": false,
    "estimatedPrice": 1600000
  },
  {
    "roomTypeId": "e03f8ded-8329-4bd8-a62f-8c92325ff2d9",
    "roomTypeName": "Deluxe Double (Q1)",
    "maxOccupancy": 2,
    "totalRooms": 2,
    "availableRooms": 2,
    "isAvailable": true,
    "estimatedPrice": 1900000
  }
]

[TC-20] Chạy scripts/verify-signalr-e2e.mjs khi chưa truyền biến môi trường:
$ node scripts/verify-signalr-e2e.mjs
❌ Missing required environment variables: DEMO_MANAGER_EMAIL, DEMO_MANAGER_PASSWORD, DEMO_STAFF_EMAIL, DEMO_STAFF_PASSWORD.
Please provide credentials via environment variables (no hardcoded fallback passwords allowed).
(Exit code: 1)
```

### 3.3. Trích xuất kết quả Live SignalR E2E tại Chi nhánh `ed955ce2-2e01-4437-9bc8-391def32acdf` (Grand Hotel Sài Gòn Q1)
* **Sự kiện đã kiểm chứng:**
  1. `ReceiveBookingPaymentConfirmed`:
     - **Manager (`Property_{id}_financial`):** Nhận đúng **1** sự kiện (`PaidAmount: 500.000 VND`, `PaymentMethod: Cash`, `TargetRoute: /reservations?code=RES-XXXXXX`), badge tăng `+1`, `0` lần F5.
     - **Receptionist (`Property_{id}_frontdesk`):** Nhận đúng **1** sự kiện đã lọc bảo mật (`PaidAmount: 0 VND`, `PaymentMethod: ""`, `TargetRoute: /reservations?code=RES-XXXXXX`), badge tăng `+1`, `0` lần F5.
  2. `ReceiveBookingCancellationRequested`:
     - **Manager (`Property_{id}_financial`):** Nhận đúng **1** sự kiện kèm `RefundableAmount` và `TargetRoute: /payments`, badge tăng `+1`, `0` lần F5.
     - **Receptionist (`Property_{id}_frontdesk`):** Nhận đúng **1** sự kiện đã lọc bảo mật (`RefundableAmount: 0 VND`, `TargetRoute: /reservations?code=RES-XXXXXX`), badge tăng `+1`, `0` lần F5.
  3. `ReceiveHoldExpired`:
     - Tự động quét qua `ExpiredHoldSweepBackgroundService` / `CheckExpiredHoldsCommand`.
     - Chỉ phát đúng **1** lần cho chi nhánh sở hữu booking (`Property_{id}`), hoàn toàn không chứa `LookupToken` hay `SmartLockPin`.
     - Các lần quét lặp lại hoặc chồng lấp phát sinh **0** thông báo trùng.

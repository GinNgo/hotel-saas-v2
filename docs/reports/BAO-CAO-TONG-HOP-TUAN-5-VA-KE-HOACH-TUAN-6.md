# BÁO CÁO TIẾN ĐỘ TUẦN 05 & KẾ HOẠCH TUẦN 06
## Đề tài: Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh (Hotel SaaS Platform v2)

---

### THÔNG TIN CHUNG
- **Mã đề tài:** 578
- **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
- **Thời gian thực hiện Tuần 05:** 02/11/2026 – 09/11/2026 (Hoàn tất kiểm thử và deploy: 11/11/2026)
- **Kho mã nguồn:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Môi trường VPS Staging:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org)

### Mục Tiêu Trọng Tâm Tuần 05 Theo Góp Ý Của GVHD:
1. Chuẩn hóa tiêu đề báo cáo thành **TUẦN 05**.
2. Đưa việc deploy VPS vào CI/CD tự động thay vì thao tác tay.
3. Bổ sung test tự động kiểm tra cô lập dữ liệu đa tenant giữa các chi nhánh.
4. Chuẩn bị kịch bản load test cho SignalR Hub và thanh toán VNPay.
5. Ghi log có cấu trúc (structured log) có CorrelationId, TenantId, PropertyId để tiện theo dõi lỗi.

---

## PHẦN 1: ĐỐI SOÁT CÁC YÊU CẦU NÂNG CAO THEO GÓP Ý CỦA GVHD

| Yêu cầu của GVHD | Hiện trạng thực hiện Tuần 05 | Kế hoạch tuần 06 |
| :--- | :--- | :--- |
| **1. Đưa deploy VPS vào CI/CD tự động** | **Đã hoàn thành:** Xây dựng workflow `.github/workflows/cd-vps.yml`. Khi merge code vào nhánh `main`, hệ thống tự build Docker image đẩy lên GHCR, kết nối SSH vào VPS pull image về và khởi động lại container, có bước kiểm tra `/health` tự động. Đã triển khai chạy thực tế khi merge PR #22. | Duy trì ổn định pipeline khi nhóm có commit mới. |
| **2. Chứng minh cô lập đa tenant giữa các chi nhánh bằng test tự động** | **Đã hoàn thành một phần:** Đã có 35 test tự động kiểm tra việc áp dụng `TenantPropertyFilter` và interceptor chặn dữ liệu chéo chi nhánh ở tầng DbContext / Entity Framework Core (chạy trong Cổng 1 của CI/CD). | Viết thêm bài test E2E kiểm tra ở mức API HTTP (`CrossBranchSecurityE2ETests.cs`): dùng token của lễ tân chi nhánh này để gọi API đọc/sửa dữ liệu của chi nhánh khác, kiểm tra kết quả trả về `403 Forbidden`. |
| **3. Chạy load test cho SignalR Hub và luồng thanh toán VNPay** | **Đã chuẩn bị script kiểm thử:** Đã viết xong 2 file k6 script gồm `scripts/load-tests/vnpay-checkout-ipn.k6.js` (test webhook IPN) và `scripts/load-tests/signalr-hub.k6.js` (test kết nối WebSocket). | Chạy trực tiếp k6 lên môi trường VPS Staging với các kịch bản người dùng đồng thời để ghi lại số liệu thời gian phản hồi và độ trễ thực tế để báo cáo thầy. |
| **4. Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung** | **Đã hoàn thành phần log:** Tích hợp Serilog ghi log dạng JSON, middleware tự động đính kèm `CorrelationId`, `TenantId`, `PropertyId` và `ElapsedMs` vào từng request. | Tìm hiểu và cấu hình công cụ xem log tập trung trên VPS để dễ tra cứu khi có sự cố. |
| **5. Sửa lỗi đăng nhập tài khoản test PMS** | **Đã hoàn thành:** Đã xử lý xong việc tài khoản test bị chặn đăng nhập bằng migration cập nhật cờ xác thực và hàm tự phục hồi trong `LoginCommandHandler`. Đã kiểm tra thực tế trên web các tài khoản `owner`, `manager`, `staff` đều đăng nhập bình thường. | Nhóm và thầy có thể sử dụng các tài khoản có sẵn để nghiệm thu trực tiếp. |

---

## PHẦN 2: MINH CHỨNG THỰC TẾ CÁC PHẦN ĐÃ HOÀN THÀNH

### 1. Tự động hóa Deploy VPS qua CI/CD
- **File workflow:** [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml)
- **Quy trình thực hiện:** Khi code được merge vào nhánh `main`, GitHub Actions tự động chạy qua các bước:
  1. Chạy 35 bài test cô lập tenant và chi nhánh.
  2. Build 2 Docker images (`hotelsaas-backend` và `hotelsaas-frontend`) và đẩy lên GitHub Container Registry (`ghcr.io`).
  3. Kết nối SSH vào VPS Staging, pull images mới về và khởi động lại các container.
  4. Gửi request kiểm tra endpoint `https://luxustay.duckdns.org/health`.
- **Kết quả:** Pipeline đã chạy thành công khi merge PR #22 (Run ID #43021042865), hệ thống trên VPS đang chạy bình thường.

### 2. Chuẩn bị kịch bản Load Test (k6)
- **Thư mục script:** `scripts/load-tests/`
- Đã chuẩn bị sẵn 2 kịch bản:
  - `vnpay-checkout-ipn.k6.js`: kiểm tra xử lý webhook IPN của VNPay, kiểm tra việc từ chối các request có chữ ký sai lệch (`vnp_SecureHash`).
  - `signalr-hub.k6.js`: kiểm tra kết nối WebSocket đến SignalR Hub và kiểm tra phân luồng theo chi nhánh (`JoinProperty`).
- Nhóm sẽ tiến hành chạy k6 trực tiếp lên VPS trong tuần 06 và ghi nhận số liệu cụ thể.

### 3. Log có cấu trúc (Structured Log)
- **Middleware:** [`backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs)
- Cấu hình Serilog xuất log dạng JSON, tự động gán `CorrelationId` cho từng request để tiện truy vết khi có lỗi:
  ```json
  {"Timestamp":"2026-11-11T17:04:38.123+07:00","Level":"Information","MessageTemplate":"HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]","Properties":{"Method":"POST","Path":"/api/auth/login","StatusCode":200,"ElapsedMs":142,"CorrelationId":"corr-89a1c2d3","TenantId":"11111111-1111-1111-1111-111111111111","PropertyId":"ed955ce2-2e01-4437-9bc8-391def32acdf"}}
  ```

### 4. Đăng nhập tài khoản test PMS
- Đã sửa lỗi bằng Migration [`20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) và bổ sung hàm tự gán cờ xác thực khi đăng nhập trong [`LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs).
- Đã kiểm tra thực tế đăng nhập thành công 5 tài khoản demo: `owner@hotelsaas.local`, `manager.both@hotelsaas.local`, `staff.single@hotelsaas.local`, `superadmin@hotelsaas.platform`, `guest.vip@hotelsaas.local`.

---

## PHẦN 3: PHÂN CÔNG NHIỆM VỤ TUẦN 06

Trong tuần 06, nhóm tập trung vào việc hoàn thành các phần việc nâng cao còn lại theo góp ý của GVHD, kiểm tra kỹ lưỡng các tính năng trên môi trường thực tế:

| Thành viên / MSSV | Phân hệ phụ trách | Nhiệm vụ kỹ thuật Tuần 06 | Kết quả dự kiến bàn giao |
| :--- | :--- | :--- | :--- |
| **Ngô Võ Tuấn An**<br>`24TX810001` | **CI/CD & Giám sát hệ thống** | 1. Tìm hiểu và thiết lập công cụ theo dõi log tập trung trên VPS để tra cứu log JSON Serilog có CorrelationId.<br>2. Tiếp tục duy trì và kiểm soát pipeline CI/CD `cd-vps.yml` khi các thành viên đẩy code mới. | • Hệ thống xem log tập trung hoạt động trên VPS.<br>• Báo cáo kiểm tra các lỗi phát sinh (nếu có) qua log. |
| **Trần Trọng Tân**<br>`24TX810025` | **Load Test SignalR & Nghiệp vụ D23** | 1. Chạy bài test tải k6 cho SignalR Hub (`scripts/load-tests/signalr-hub.k6.js`) lên VPS Staging, đo đạc số lượng kết nối đồng thời và độ trễ nhận thông báo thực tế.<br>2. Kiểm thử thực tế nghiệp vụ duyệt và chi hoàn tiền D23 tại quầy thu ngân trên giao diện web. | • File số liệu đo đạc load test k6 SignalR thực tế trên VPS.<br>• Biên bản kiểm thử nghiệp vụ chi hoàn tiền D23. |
| **Nguyễn Khôi Nguyên**<br>`24TX810011` | **Test cô lập chi nhánh & Báo cáo** | 1. Viết bài test tự động E2E HTTP API chứng minh cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`): lấy token lễ tân chi nhánh này gọi API chi nhánh khác, khẳng định nhận mã lỗi 403 Forbidden.<br>2. Dùng ứng dụng ngân hàng trên điện thoại quét thử mã VietQR trên hóa đơn PDF để xác nhận thông tin chuyển khoản hiển thị đúng. | • File mã nguồn test E2E cô lập chi nhánh chạy pass.<br>• Ảnh chụp thực tế kết quả quét mã QR hóa đơn từ app ngân hàng. |

---

## PHẦN 4: LỆNH KIỂM TRA HỆ THỐNG

```bash
# 1. Chạy test Backend (.NET 10)
dotnet test backend/HotelSaas.slnx

# 2. Chạy test cô lập đa tenant và chi nhánh
dotnet test backend/HotelSaas.slnx --filter "FullyQualifiedName~Isolation|FullyQualifiedName~Tenant"

# 3. Chạy test Frontend (Angular 22)
npm --prefix frontend test -- --watch=false

# 4. Kiểm tra sức khỏe hệ thống trên VPS Staging
curl -sk https://luxustay.duckdns.org/health
```

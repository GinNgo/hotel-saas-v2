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

Nhóm đối soát rõ ràng tình trạng thực hiện các yêu cầu nâng cao của Thầy Huỳnh Xuân Phụng:

### 1. Các Yêu Cầu Đã Hoàn Thành 100% Trong Tuần 05:
* **Yêu cầu 1 (Đưa deploy VPS vào CI/CD tự động):** **ĐÃ XONG 100%**. Xây dựng workflow `.github/workflows/cd-vps.yml`. Khi merge code vào nhánh `main`, hệ thống tự build Docker image đẩy lên GHCR, kết nối SSH vào VPS pull image về và khởi động lại container, có bước kiểm tra `/health` tự động. Đã triển khai chạy thực tế khi merge PR #22.
* **Xử lý đăng nhập tài khoản test PMS:** **ĐÃ XONG 100%**. Đã xử lý xong việc tài khoản test bị chặn đăng nhập bằng migration cập nhật cờ xác thực và hàm tự phục hồi trong `LoginCommandHandler`. Đã kiểm tra thực tế trên web các tài khoản `owner`, `manager`, `staff` đều đăng nhập bình thường.

### 2. Các Yêu Cầu Đã Chuẩn Bị Xong Nền Tảng Trong Tuần 05 & Chuyển Sang Tuần 06 Hoàn Thiện:
* **Yêu cầu 2 (Chứng minh cô lập đa tenant giữa các chi nhánh bằng test tự động):**
  * *Tuần 05 đã làm:* Đã có 35 test tự động kiểm tra việc áp dụng `TenantPropertyFilter` và interceptor chặn dữ liệu chéo chi nhánh ở tầng DbContext / Entity Framework Core (chạy trong Cổng 1 của CI/CD).
  * *Chuyển sang Tuần 06:* Viết thêm bài test E2E kiểm tra ở mức API HTTP (`CrossBranchSecurityE2ETests.cs`): dùng token của lễ tân chi nhánh này để gọi API đọc/sửa dữ liệu của chi nhánh khác, kiểm tra kết quả trả về `403 Forbidden`.
* **Yêu cầu 3 (Chạy load test cho SignalR Hub và luồng thanh toán VNPay):**
  * *Tuần 05 đã làm:* Đã viết xong 2 file k6 script gồm `scripts/load-tests/vnpay-checkout-ipn.k6.js` (test webhook IPN) và `scripts/load-tests/signalr-hub.k6.js` (test kết nối WebSocket).
  * *Chuyển sang Tuần 06:* Chạy trực tiếp k6 lên môi trường VPS Staging với các kịch bản người dùng đồng thời để ghi lại số liệu thời gian phản hồi và độ trễ thực tế để báo cáo thầy.
* **Yêu cầu 4 (Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung):**
  * *Tuần 05 đã làm:* Tích hợp Serilog ghi log dạng JSON, middleware tự động đính kèm `CorrelationId`, `TenantId`, `PropertyId` và `ElapsedMs` vào từng request; tạo endpoint `/metrics` trong backend .NET 10.
  * *Chuyển sang Tuần 06:* Triển khai cụm Dashboard giám sát tập trung (Prometheus + Grafana) lên VPS để theo dõi số liệu trực quan bằng giao diện web.

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

## PHẦN 3: KẾ HOẠCH & PHÂN CÔNG NHIỆM VỤ TUẦN 06

Trong tuần 06, nhóm không vội vàng mở rộng tính năng mới mà tập trung vào 2 mục tiêu lớn:
1. **Kiểm tra và rà soát lại toàn diện các tính năng đã làm từ Tuần 1 đến Tuần 5 trực tiếp trên web Staging VPS (`https://luxustay.duckdns.org`)** để đảm bảo mọi luồng nghiệp vụ hoạt động ổn định và chính xác trên thực tế.
2. **Hoàn thành các phần việc còn lại trong 4 yêu cầu nâng cao của GVHD** (Giám sát tập trung, Load test SignalR k6, Test tự động cô lập chéo chi nhánh qua API HTTP).

### Bảng Phân Công Nhiệm Vụ Cụ Thể Tuần 06:

| Thành viên / MSSV | Phân hệ phụ trách | Nhiệm vụ kỹ thuật cụ thể Tuần 06 | Kết quả dự kiến bàn giao |
| :--- | :--- | :--- | :--- |
| **Ngô Võ Tuấn An**<br>`24TX810001`<br>*(Lead & DevOps)* | **Rà soát xác thực & Giám sát tập trung** | 1. **Kiểm tra lại tính năng:** Rà soát toàn bộ luồng khách hàng đặt phòng trên web thật: chọn phòng, điền thông tin, nhận mã OTP SMS qua Firebase (thử cả số sandbox và số điện thoại thật), đăng nhập Google OAuth, và đăng nhập các tài khoản nhân sự PMS.<br>2. **Nhiệm vụ GVHD:** Triển khai cụm Dashboard giám sát tập trung (Prometheus + Grafana) lên VPS để quan sát trực quan lưu lượng request, mã lỗi và độ trễ qua giao diện web.<br>3. Tiếp tục duy trì và kiểm soát pipeline CI/CD `cd-vps.yml` khi nhóm cập nhật code mới. | • Báo cáo biên bản kiểm tra lại luồng xác thực trên web thật.<br>• Dashboard Grafana giám sát hệ thống hoạt động thật trên VPS.<br>• Báo cáo kiểm tra log và độ ổn định hệ thống. |
| **Trần Trọng Tân**<br>`24TX810025`<br>*(Operations & Realtime)* | **Rà soát thu ngân & Load Test SignalR** | 1. **Kiểm tra lại tính năng:** Rà soát kỹ lưỡng quy trình thu ngân quầy trên web thật: tạo yêu cầu hủy phòng, duyệt hoàn tiền D23, xác nhận chi trả thực tế; kiểm tra chuông thông báo SignalR xem có nổ thông báo về máy lễ tân theo đúng chi nhánh không.<br>2. **Nhiệm vụ GVHD:** Chạy bài test tải k6 cho SignalR Hub (`scripts/load-tests/signalr-hub.k6.js`) lên VPS Staging, đo đạc số lượng kết nối đồng thời và độ trễ nhận thông báo thực tế. | • Báo cáo biên bản kiểm tra nghiệp vụ hoàn tiền D23 và chuông SignalR trên web thật.<br>• File số liệu và biểu đồ đo đạc load test k6 SignalR thực tế trên VPS. |
| **Nguyễn Khôi Nguyên**<br>`24TX810011`<br>*(Finance & Reporting)* | **Rà soát báo cáo & Test cô lập chi nhánh** | 1. **Kiểm tra lại tính năng:** Rà soát quy trình xuất hóa đơn PDF có nhúng mã QR, dùng ứng dụng ngân hàng trên điện thoại quét thử mã VietQR xem có nhận diện đúng số tài khoản và số tiền không; kiểm tra số liệu trên trang báo cáo doanh thu xem có khớp với cơ sở dữ liệu không.<br>2. **Nhiệm vụ GVHD:** Viết bài test tự động E2E HTTP API chứng minh cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`): lấy token lễ tân chi nhánh này gọi API chi nhánh khác, khẳng định nhận mã lỗi 403 Forbidden. | • Báo cáo biên bản kiểm tra hóa đơn QR và số liệu báo cáo doanh thu.<br>• Ảnh chụp thực tế kết quả quét mã QR hóa đơn từ app ngân hàng.<br>• File mã nguồn test E2E cô lập chi nhánh chạy pass 100%. |

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

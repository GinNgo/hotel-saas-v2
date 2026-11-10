# BÁO CÁO TIẾN ĐỘ TUẦN 05 & KẾ HOẠCH NGHIỆM THU TUẦN 06
## Dự Án: Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh (Hotel SaaS Platform v2)
### Định hướng Tuần 06: *"Làm Chậm Lại Để Đào Sâu Nghiệp Vụ & Kiểm Thử Hoạt Động Thực Tế"*

---

> **Căn cứ đánh giá từ Giảng viên Hướng dẫn (Tuần 5):**
> - **Kết quả:** **ĐÃ DUYỆT**.
> - **Nhận xét:** Đánh giá cao tính minh bạch (MSSV, GitHub, phân mảng độc lập), bộ số kiểm thử thực tế (27/27, 578/578, 200/200 PASS), môi trường Staging VPS Caddy HTTPS thật và khai báo AI trung thực.
> - **Góp ý cải tiến:**
>   1. Chuẩn hóa tiêu đề báo cáo thành **TUẦN 05** theo đúng tiến trình hệ thống LMS trường.
>   2. Thực hiện 4 yêu cầu nâng cao: Kiểm thử tự động cô lập đa chi nhánh, Load test SignalR & VNPay, Đưa deploy VPS vào CI/CD tự động, và Giám sát log có cấu trúc.

---

## PHẦN 1: TỔNG HỢP KẾT QUẢ THỰC HIỆN TUẦN 05

### 1. Thông Tin Thành Viên & Phân Mảng Nghiệp Vụ
| STT | Họ và Tên | MSSV | Tài khoản GitHub | Phân hệ phụ trách chính | Trạng thái Tuần 05 |
| :---: | :--- | :---: | :---: | :--- | :---: |
| 1 | **Ngô Võ Tuấn An** *(Nhóm trưởng)* | `24TX810001` | `@GinNgo` | **A01-A03:** Cổng OTP xác thực SĐT Option A, Dual-Verification Policy, Google OAuth, Staging Caddy VPS. | **Hoàn thành 100%** |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `@khoinguyen1310` | **N01-N03:** In hóa đơn Dynamic QR (QuestPDF), Thuộc tính `PaymentMethodPreference`, Báo cáo quản lý Excel/PDF. | **Hoàn thành 100%** |
| 3 | **Trần Trọng Tân** | `24TX810025` | `@tan-tran` | **T01-T03:** D23 Duyệt hoàn tiền quầy thu ngân (advisory lock), SignalR Hub realtime, Quét buồng hết hạn, Demo Playbook. | **Hoàn thành 100%** |

### 2. Minh Chứng Hoạt Động Thực Tế Của Các Tính Năng Đã Xây Dựng
Qua đối chiếu với bản kiến trúc **Spec Kit**, toàn bộ các tính năng đều được triển khai bằng **code thực thi nghiệp vụ hoàn chỉnh**, tương tác trực tiếp với cơ sở dữ liệu PostgreSQL và dịch vụ bên thứ ba:

1. **Cơ sở dữ liệu & Cô lập Tenant (PostgreSQL 17):**
   - Hơn 30 bảng vật lý trên PostgreSQL 17.
   - EF Core Global Query Filter tự động lọc dữ liệu theo `TenantId` và `PropertyId`.
   - `TenantPropertySaveChangesInterceptor` chặn đứng mọi hành vi giả mạo hoặc sửa đổi trái phép Tenant/Branch ID.
   - Khóa phân tán cấp giao dịch `pg_advisory_xact_lock` chống hiện tượng đặt trùng phòng (Overbooking).
2. **Cổng thanh toán & Webhook IPN (VNPay Sandbox):**
   - `VnpayPaymentService` sinh URL thật chuyển hướng sang `sandbox.vnpayment.vn`.
   - Ký số thuật toán băm HMAC-SHA512 với `vnp_SecureHash` chuẩn spec.
   - Endpoint IPN Webhook xử lý idempotent chống trùng tiền và cập nhật trạng thái đặt phòng tự động.
3. **Trung tâm thông báo Realtime & Quét buồng quá hạn (SignalR + Background Worker):**
   - `NotificationHub` duy trì kết nối WebSocket thời gian thực giữa server và màn hình lễ tân.
   - `ExpiredHoldSweepBackgroundService` chạy ngầm độc lập mỗi 15 giây, tự động quét và giải phóng các phòng giữ chỗ quá 15 phút chưa thanh toán.
4. **Xuất hóa đơn & Báo cáo tài chính:**
   - QuestPDF sinh file `.pdf` hóa đơn có mã QR động.
   - ClosedXML xuất file `.xlsx` bảng kê doanh thu và báo cáo ca thu ngân.
5. **Môi trường Staging Hoạt Động Thật:**
   - Đang vận hành trên VPS với Caddy reverse proxy, cấp SSL Let's Encrypt tự động, kết nối trực tiếp frontend Angular 22 và backend WebApi qua mạng Internet.

---

## PHẦN 2: ĐỊNH HƯỚNG & KẾ HOẠCH TUẦN 06 — *"LÀM CHẬM LẠI ĐỂ ĐÀO SÂU NGHIỆP VỤ & KIỂM THỬ THỰC TẾ"*

> [!TIP]
> **Triết lý thực hiện Tuần 06:** Nhóm **tạm dừng việc mở rộng tính năng mới ngoài phạm vi**, tập trung tối đa nguồn lực vào việc:
> 1. Rà soát tận tay từng luồng nghiệp vụ nhạy cảm trên giao diện người dùng và API thật.
> 2. Đưa các kịch bản kiểm thử tự động trong **Spec Kit** vào chạy thực tế để lấy số liệu định lượng (đo tải, đo độ trễ, chứng minh không rò rỉ dữ liệu).
> 3. Tự động hóa khâu triển khai lên VPS bằng GitHub Actions CI/CD để không phải thao tác tay.

---

### 1. Bốn Trọng Tâm Nghiệp Vụ Cần Kiểm Thử Thực Tế Tận Tay (Real-World Sanity Check)

#### Trọng tâm 1: Chống Đặt Trùng Phòng & Khóa Giữ Chỗ Đồng Thời (Anti-Overbooking & Race Condition)
- **Tình huống nghiệp vụ thực tế:** 2 khách hàng cùng lúc chọn 1 phòng duy nhất còn trống trong cùng 1 khung giờ và cùng bấm "Giữ phòng".
- **Kỳ vọng:** Chỉ có 1 khách giữ phòng thành công. Khách thứ hai phải nhận được thông báo phòng vừa có người giữ, không bao giờ xảy ra tình trạng 1 phòng cấp cho 2 người.
- **Phương pháp kiểm thử:** Chạy script k6 giả lập 100 request đồng thời và kiểm tra khóa `pg_advisory_xact_lock` trên PostgreSQL.

#### Trọng tâm 2: Luồng Tiền & Đối Soát Quầy Thu Ngân (Zero Cash Variance)
- **Tình huống nghiệp vụ thực tế:** Khách đặt phòng $\rightarrow$ Hủy phòng trong thời hạn hoàn tiền $\rightarrow$ Lễ tân/Thu ngân tạo yêu cầu hoàn tiền $\rightarrow$ Kế toán duyệt $\rightarrow$ Thực hiện chi tiền.
- **Kỳ vọng:**
  - Tiền trong báo cáo ca thu ngân (Shift Report) và số dư Folio phải khớp từng đồng (0 đồng sai lệch).
  - Không thể bấm hoàn tiền 2 lần (chống double-refund bằng advisory lock).

#### Trọng tâm 3: Cô Lập Tuyệt Đối Giữa Các Chi Nhánh (Multi-Branch Hard Isolation)
- **Tình huống nghiệp vụ thực tế:** Tập đoàn khách sạn có Chi nhánh Sài Gòn và Chi nhánh Đà Nẵng.
- **Kỳ vọng:**
  - Lễ tân chi nhánh Sài Gòn tuyệt đối không thấy danh sách phòng, khách lưu trú, hóa đơn và doanh thu của chi nhánh Đà Nẵng.
  - Khi cố tình gửi request API kèm Header giả mạo `X-Property-Id` của chi nhánh khác $\rightarrow$ Hệ thống phải lập tức trả về lỗi `403 Forbidden`.

#### Trọng tâm 4: Tự Động Hóa CI/CD & Giám Sát Tập Trung
- **Tình huống nghiệp vụ thực tế:** Đội ngũ đẩy code mới lên GitHub $\rightarrow$ Tự động kiểm tra chất lượng và cập nhật lên VPS mà không cần SSH gõ lệnh thủ công.
- **Kỳ vọng:** Thiết lập GitHub Actions Pipeline và cấu hình hệ thống giám sát thời gian thực bằng Log có cấu trúc (Grafana/Loki/Seq).

---

### 2. Bảng Phân Công Nhiệm Vụ Tuần 06 Chi Tiết Cho Từng Thành Viên

```
========================================================================================
BẢNG PHÂN CÔNG NHIỆM VỤ TUẦN 06 (THEO 4 TRỤ CỘT SPEC KIT)
========================================================================================
```

| Thành viên / MSSV | Phân mảng đảm nhiệm | Nhiệm vụ kỹ thuật chi tiết Tuần 06 | Sản phẩm bàn giao (Deliverables) |
| :--- | :--- | :--- | :--- |
| **Ngô Võ Tuấn An**<br>`24TX810001`<br>*(Lead & DevOps)* | **Trụ cột 3: CI/CD VPS**<br>&<br>**Trụ cột 2: Load Test VNPay** | 1. Cấu hình GitHub Secrets (`VPS_HOST`, `VPS_SSH_KEY`) để kích hoạt hoàn chỉnh pipeline `.github/workflows/cd-vps.yml`.<br>2. Chạy test rolling deploy tự động lên VPS không gián đoạn dịch vụ, xác minh probe `/health`.<br>3. Chạy k6 load test cho luồng VNPay Checkout & IPN Webhook (`scripts/load-tests/vnpay-checkout-ipn.k6.js`), đo đạc chống duplicate webhook. | - Pipeline CD chạy tự động có tick xanh trên GitHub Actions.<br>- Báo cáo kết quả đo tải k6 VNPay (RPS, $p_{95}$, zero race condition). |
| **Trần Trọng Tân**<br>`24TX810025`<br>*(Operations & Realtime)* | **Trụ cột 2: Load Test SignalR**<br>&<br>**Trụ cột 4: Observability** | 1. Chạy k6 load test SignalR Notification Hub (`scripts/load-tests/signalr-hub.k6.js`) với 500 CCU kết nối đồng thời.<br>2. Khởi động Docker Observability stack (`docker/docker-compose.observability.yml`), cấu hình Grafana/Loki thu thập log theo `{TenantId, PropertyId}`.<br>3. Thực hiện kịch bản test thực tế tận tay quy trình Hoàn tiền D23 tại quầy thu ngân trên giao diện web. | - Báo cáo số liệu hiệu năng SignalR ($p_{95} < 200\text{ ms}$, tỷ lệ rớt kết nối $0\%$).<br>- Ảnh chụp màn hình Dashboard giám sát Grafana/Loki có log theo cấu trúc.<br>- Biên bản kiểm thử nghiệp vụ hoàn tiền D23. |
| **Nguyễn Khôi Nguyên**<br>`24TX810011`<br>*(Finance & Reporting)* | **Trụ cột 1: Cô lập Chi nhánh**<br>&<br>**Báo cáo Tài chính Thực tế** | 1. Kích hoạt và chạy bộ test tự động chứng minh cô lập đa chi nhánh (`MultiTenantBranchIsolationTests.cs`), ghi nhận log minh chứng `Proof1` và `Proof2`.<br>2. Kiểm tra thực tế trên giao diện: Đăng nhập tài khoản Chi nhánh 1, xác minh không thể xem hoặc xuất báo cáo tài chính của Chi nhánh 2.<br>3. Kiểm tra quét mã QR hóa đơn thật trên ứng dụng ngân hàng di động đảm bảo thông tin số tiền và nội dung chuyển khoản chuẩn 100%. | - File kết quả test cô lập đa chi nhánh (`isolation-proof.log`).<br>- Mẫu hóa đơn PDF có mã QR thật được kiểm chứng bằng app ngân hàng.<br>- Báo cáo đối soát doanh thu chi nhánh không bị rò rỉ. |

---

### 3. Kế Hoạch Kiểm Tra & Lệnh CLI Nghiệm Thu (Quality Gate Commands)

Các thành viên sẽ sử dụng các lệnh chuẩn hóa sau để kiểm tra và lấy số liệu minh chứng:

```bash
# 1. Kiểm tra toàn diện cô lập Multi-Tenant & Multi-Property
dotnet test backend/HotelSaas.slnx \
  --filter "FullyQualifiedName~MultiTenantBranchIsolationTests|FullyQualifiedName~TenantPropertyContextMiddlewareTests" \
  --logger "console;verbosity=detailed"

# 2. Chạy kiểm thử tải k6 cho SignalR Hub (Trần Trọng Tân)
k6 run scripts/load-tests/signalr-hub.k6.js

# 3. Chạy kiểm thử tải k6 cho luồng VNPay Checkout & IPN (Ngô Võ Tuấn An)
k6 run scripts/load-tests/vnpay-checkout-ipn.k6.js

# 4. Kiểm tra sức khỏe hệ thống và Log có cấu trúc trên VPS
curl -sk https://luxustay.duckdns.org/health
curl -sk https://luxustay.duckdns.org/health/ready
```

---

## PHẦN 3: NHẬT KÝ SỬ DỤNG TRỢ LÝ AI (AI USAGE DISCLOSURE)

1. **Mục đích sử dụng:**
   - Hỗ trợ phân tích xung đột khi merge các nhánh tính năng của thành viên vào nhánh `develop`.
   - Thiết kế kịch bản kiểm thử tải k6 và rà soát kiến trúc cô lập đa chi nhánh theo tiêu chuẩn Clean Architecture.
2. **Các lỗi kỹ thuật AI đã phát hiện và xử lý:**
   - Phát hiện lỗi `NullReferenceException` trong test case `SocialLogin_DoesNotDispatchUnverifiedIdentity` do thiếu kiểm tra null của mediator trong môi trường unconfigured test harness $\rightarrow$ Đã bổ sung guard check an toàn trả về 503 Service Unavailable.
   - Phát hiện thiếu ánh xạ thuộc tính `PaymentMethodPreference` trong `ReservationSnapshot` khi merge nhánh của Khôi Nguyên $\rightarrow$ Đã khắc phục và cập nhật migration thành công.
3. **Đánh giá và cam kết của nhóm:**
   - Toàn bộ nghiệp vụ, logic bảo mật và kịch bản kiểm thử đều do các thành viên trực tiếp rà soát, kiểm chứng và chạy thử trên hệ thống thật trước khi bàn giao.

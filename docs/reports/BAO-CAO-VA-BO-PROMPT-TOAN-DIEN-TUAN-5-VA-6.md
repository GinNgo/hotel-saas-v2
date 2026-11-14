# BÁO CÁO TOÀN DIỆN TIẾN ĐỘ TUẦN 05, KHAI BÁO AI & BỘ PROMPT THỰC THI TUẦN 06
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## 📌 THÔNG TIN CHUNG CỦA ĐỀ TÀI

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 05:** 02/11/2026 – 09/11/2026 (Hoàn tất kiểm thử, tích hợp nhánh và deploy VPS: 11/11/2026)
* **Thời gian thực hiện Tuần 06:** 10/11/2026 – 17/11/2026
* **Kho mã nguồn chính thức (GitHub):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) | **Nhánh phát hành:** [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)
* **Địa chỉ môi trường VPS Staging:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org) (Caddy Reverse Proxy, Docker, PostgreSQL 17)

### Danh Sách 3 Thành Viên Nhóm

| STT | Họ và Tên | MSSV | Email sinh viên | Tài khoản GitHub | Vai trò & Nhiệm vụ chính |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | [`GinNgo`](https://github.com/GinNgo) | **Nhóm trưởng & DevOps**: Xác thực Firebase SMS OTP thật + sandbox; chính sách kích hoạt tài khoản Dual-Verification; đăng nhập Google OAuth / Facebook OAuth; sửa lỗi đăng nhập tài khoản test; thiết lập pipeline GitHub Actions deploy tự động lên VPS. |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | **Finance & Reporting**: Nhúng mã QR tra cứu vào hóa đơn PDF; thêm trường lưu phương thức thanh toán ưu tiên `PaymentMethodPreference`; bổ sung bộ lọc báo cáo doanh thu theo kỳ hạn và loại phòng; tối ưu truy vấn Group By tại database. |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | [`trantrongtan096`](https://github.com/trantrongtan096) | **Operations & Realtime**: Màn hình và API duyệt/chi hoàn tiền D23 tại quầy thu ngân (dùng khóa PostgreSQL tránh 2 người chi trùng); mở rộng SignalR Hub thêm 3 sự kiện; tác vụ nền kiểm tra đơn giữ phòng hết hạn và gửi thông báo theo chi nhánh; script kiểm chứng E2E. |

---

# PHẦN I. BÁO CÁO TIẾN ĐỘ TUẦN 05 & KẾT QUẢ NGHIỆM THU

### 1. Phân hệ của Ngô Võ Tuấn An (24TX810001)
* **Xác thực số điện thoại qua Firebase SMS OTP:**
  * Tích hợp trực tiếp Firebase Web SDK v13 và Google Identity Platform để gửi mã OTP về số điện thoại khi khách vãng lai đặt giữ phòng.
  * Hỗ trợ số điện thoại sandbox `+84123456789` với mã OTP cố định `123456` để nhóm và thầy có thể test mà không bị trừ tiền SMS viễn thông.
  * Tinh gọn form đăng ký thành **2 Tab riêng biệt**: Tab 1 chỉ cần Họ tên, Email, Mật khẩu (5 giây hoàn tất, không ép nhập SĐT); Tab 2 đăng ký bằng SĐT qua mã SMS OTP.
* **Chính sách kích hoạt tài khoản (Dual-Verification):**
  * Khách đặt phòng: bắt buộc xác thực số điện thoại qua OTP mới được giữ phòng (`POST /api/public/bookings/hold`), tránh tình trạng giữ phòng ảo.
  * Nhân sự PMS: yêu cầu tài khoản đã kích hoạt email hoặc xác thực số điện thoại trước khi đăng nhập. Riêng các tài khoản seed phục vụ kiểm thử được xử lý tự phục hồi theo danh sách cấu hình.
* **Sửa lỗi đăng nhập tài khoản test PMS:**
  * Viết Migration cập nhật cờ xác thực cho các tài khoản test có sẵn trong cơ sở dữ liệu (`owner`, `manager`, `staff`).
  * Bổ sung hàm tự gán cờ xác thực khi đăng nhập cho tài khoản seed để đảm bảo người kiểm thử đăng nhập bình thường trên Staging VPS.
* **Đăng nhập bằng Google OAuth & Facebook OAuth Native:**
  * Tiếp nhận Google ID Token và Facebook Access Token từ popup chuẩn của nhà cung cấp, xác thực chữ ký qua thư viện `Google.Apis.Auth` ở backend và tạo phiên làm việc cho người dùng.
* **Tự động hóa CI/CD deploy lên VPS Staging:**
  * Viết workflow GitHub Actions tại [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml).
  * Quy trình tự động: chạy test cô lập tenant $\rightarrow$ build Docker images đẩy lên GitHub Container Registry (`ghcr.io`) $\rightarrow$ SSH vào VPS pull image mới và khởi động lại container $\rightarrow$ kiểm tra endpoint `/health`.
  * Đã merge Pull Request #22 vào nhánh `main` và deploy thành công lên VPS thực tế.

### 2. Phân hệ của Nguyễn Khôi Nguyên (24TX810011)
* **Nhúng mã QR tra cứu vào hóa đơn PDF:**
  * Sử dụng thư viện `QRCoder` để sinh mã QR dạng ảnh PNG trực tiếp trong bộ nhớ backend, không cần gọi API tạo mã QR từ dịch vụ bên ngoài.
  * Nội dung QR chứa đường dẫn tra cứu đặt phòng dựa trên `LookupToken` hợp lệ. Mã QR được nhúng vào hóa đơn PDF nhằm giúp khách mở trang tra cứu thông tin đặt phòng và trạng thái liên quan.
* **Lưu trữ phương thức thanh toán ưu tiên (`PaymentMethodPreference`):**
  * Bổ sung cột `PaymentMethodPreference` vào bảng `Reservations` trong cơ sở dữ liệu để ghi nhận hình thức khách chọn khi đặt (VNPay, VietQR, tiền mặt, chuyển khoản).
* **Bộ lọc báo cáo doanh thu và tối ưu truy vấn:**
  * Bổ sung khả năng lọc báo cáo theo tuần, tháng, quý, năm và theo loại phòng, giúp nhân viên quản lý theo dõi doanh thu theo từng phạm vi cần xem.
  * Đối với các nhóm số liệu phù hợp, sử dụng LINQ `GroupBy` và `Sum` để PostgreSQL thực hiện tổng hợp trước khi trả kết quả về backend, qua đó giảm lượng dữ liệu cần xử lý trong bộ nhớ ứng dụng.

### 3. Phân hệ của Trần Trọng Tân (24TX810025)
* **Quản lý và phê duyệt hoàn tiền D23 tại quầy thu ngân:**
  * Xây dựng giao diện duyệt hoàn tiền: xem danh sách yêu cầu, xem lý do hủy, tỷ lệ phí phạt và số tiền cần hoàn.
  * Xây dựng các API: duyệt yêu cầu, từ chối yêu cầu và xác nhận đã chi tiền cho khách (ghi nhận hình thức chi tiền mặt hoặc chuyển khoản).
  * Bổ sung cơ chế khóa giao dịch PostgreSQL `pg_advisory_xact_lock`, kết hợp `SemaphoreSlim` để kiểm soát các yêu cầu xác nhận chi hoàn đồng thời.
  * Xây dựng bài kiểm thử sử dụng `Task.WhenAll` với hai DbContext độc lập để mô phỏng hai thu ngân cùng xác nhận chi hoàn cho một hồ sơ. Kết quả kiểm thử cho thấy chỉ một yêu cầu được ghi nhận thành công, ngăn chặn tuyệt đối việc chi trùng tiền.
* **Mở rộng thông báo thời gian thực SignalR Hub:**
  * Thêm 3 sự kiện gửi qua SignalR: thanh toán thành công, khách gửi yêu cầu hủy phòng, và đơn giữ phòng hết hạn.
  * Phân luồng thông báo theo đúng `TenantId` và `PropertyId` của từng chi nhánh.
  * Viết tác vụ nền chạy mỗi 15 giây để kiểm tra các đơn giữ phòng quá hạn và tự động phát thông báo `HoldExpired` về đúng chi nhánh.
* **Script kiểm chứng tự động luồng đặt phòng E2E:**
  * Cập nhật script `scripts/verify-signalr-e2e.mjs` chạy qua các bước: tìm phòng trống $\rightarrow$ giữ chỗ $\rightarrow$ tra cứu đơn $\rightarrow$ nhận thông báo SignalR $\rightarrow$ hủy phòng $\rightarrow$ duyệt hoàn tiền D23.

---

### Bảng Tổng Hợp Kết Quả Kiểm Thử Toàn Dự Án:

| Hạng mục kiểm thử | Công cụ thực hiện | Kết quả thực tế | Trạng thái |
| :--- | :--- | :---: | :---: |
| **Backend Unit & Integration Tests** | `dotnet test backend/HotelSaas.slnx` | 600/600 bài kiểm thử đạt, không có bài thất bại | **PASS** |
| **Frontend Unit Tests** | `npm test -- --watch=false` (Vitest) | 51/51 test files, 628/628 test cases chạy thành công, 0 lỗi | **PASS** |
| **Isolation Gate — Bảo mật & Cô lập dữ liệu** | GitHub Actions `cd-vps.yml` | 35/35 bài kiểm thử đạt, bao gồm kiểm tra Tenant/Property, SignalR và VNPay | **PASS** |
| **Hợp nhất mã nguồn (Pull Request #22)** | GitHub CLI (`gh pr merge 22 --merge`) | Đã merge từ `develop` vào `main`, không có xung đột mã nguồn | **MERGED** |
| **Triển khai tự động lên VPS Staging** | GitHub Actions (`cd-vps.yml` Run #43021042865) | Build 2 Docker images lên GHCR, SSH cập nhật container và kiểm tra `/health` thành công | **SUCCESS** |

---

# PHẦN II. ĐỐI SOÁT CÁC YÊU CẦU NÂNG CAO CỦA GVHD

| Yêu cầu của GVHD | Tình trạng thực tế Tuần 05 | Kế hoạch hoàn tất Tuần 06 |
| :--- | :--- | :--- |
| **1. Deploy VPS vào CI/CD tự động** | **ĐÃ HOÀN TẤT 100%**. Workflow `cd-vps.yml` tự động build GHCR, SSH cập nhật VPS và kiểm tra `/health`. | Tiếp tục duy trì và kiểm soát pipeline ổn định. |
| **2. Chứng minh cô lập chi nhánh bằng test tự động** | **ĐÃ XONG TẦNG NỀN TẢNG**. Chạy đạt 35/35 test cô lập DbContext trong CI/CD. | Viết bài test E2E HTTP API `CrossBranchSecurityE2ETests.cs` chứng minh token chi nhánh A gọi API chi nhánh B nhận `403 Forbidden`. |
| **3. Load test SignalR Hub và VNPay IPN** | **ĐÃ XONG SCRIPT K6**. Đã viết `signalr-hub.k6.js` và `vnpay-checkout-ipn.k6.js`. | Chạy load test trực tiếp lên VPS Staging, đo đạc số liệu 50 VUs và P95 latency để nộp báo cáo. |
| **4. Giám sát tập trung và log có cấu trúc** | **ĐÃ XONG LOG & METRICS**. Đã gắn CorrelationId, TenantId, PropertyId và tạo endpoint `/metrics`. | Triển khai cụm Dashboard trực quan (Prometheus + Grafana) trên VPS Staging. |

---

# PHẦN III. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

* **Ngô Võ Tuấn An:** Google Antigravity IDE (model `Gemini 3.8 Flash`).
* **Nguyễn Khôi Nguyên:** OpenAI Codex (model `GPT-6 Astra`).
* **Trần Trọng Tân:** Google Antigravity IDE (`Gemini 3.8 Flash`) và OpenAI Codex (`GPT-6 Astra`).

### Chi Tiết Lỗi Của AI & Cách Sinh Viên Phát Hiện, Chỉnh Sửa Thực Tế:

1. **Ngô Võ Tuấn An (24TX810001):**
   * *Lỗi AI 1:* AI chỉ viết luồng gửi SMS thật khiến quá trình test liên tục bị cạn hạn ngạch Firebase. Em đã yêu cầu bổ sung chế độ Sandbox OTP `123456` với số test `+84123456789`, đồng thời tách biệt token thử nghiệm `dev-mock-token`.
   * *Lỗi AI 2:* Áp dụng chính sách xác thực Hard-Gating khiến các tài khoản test hạt giống (`owner`, `manager`, `staff`) bị chặn đăng nhập `ERR_VERIFICATION_REQUIRED`. Em đã viết Migration cập nhật trạng thái và thêm hàm tự phục hồi xác thực trong `LoginCommandHandler`.
   * *Lỗi AI 3:* AI đề xuất build trực tiếp trên VPS làm tràn RAM và nghẽn CPU. Em đã chuyển sang mô hình build Docker trên GitHub Actions đẩy GHCR, VPS chỉ pull image và restart container.

2. **Nguyễn Khôi Nguyên (24TX810011):**
   * *Lỗi AI 1:* AI đề xuất gọi API bên thứ ba để tạo mã QR trên hóa đơn PDF, gây rủi ro phụ thuộc mạng ngoài. Em đã chuyển sang dùng thư viện `QRCoder` sinh mã QR trong bộ nhớ backend an toàn và độc lập.
   * *Lỗi AI 2:* AI tải toàn bộ dữ liệu đơn phòng về RAM backend rồi mới lọc C#, gây chậm khi dữ liệu lớn. Em đã yêu cầu tối ưu bằng LINQ `GroupBy` và `Sum` để tính toán trực tiếp tại PostgreSQL.

3. **Trần Trọng Tân (24TX810025):**
   * *Lỗi AI 1:* Báo cáo thu ngân ban đầu cộng dồn cả khoản chi hoàn vào tổng doanh thu (thu 1.000.000đ, hoàn 300.000đ nhưng doanh thu lại tính 1.300.000đ). Em đã phát hiện và điều chỉnh lại công thức tách biệt giao dịch thu và hoàn tiền.
   * *Lỗi AI 2:* Chỉ dùng khóa trong bộ nhớ `SemaphoreSlim` để kiểm soát duyệt hoàn tiền. Em đã bổ sung khóa cơ sở dữ liệu `pg_advisory_xact_lock` để ngăn chặn tuyệt đối nguy cơ chi trùng tiền khi chạy nhiều container backend.
   * *Lỗi AI 3:* Script E2E ban đầu gọi API nội bộ `POST /api/reservations` thay vì API đặt phòng công khai. Em đã viết lại toàn bộ luồng E2E đúng chuẩn hành trình khách hàng: `Availability → Hold → Lookup → Confirm → SignalR → Cancel → D23`.

---

# PHẦN IV. KẾ HOẠCH & BỘ PROMPT THỰC THI TUẦN 06

### Kế Hoạch Trọng Tâm Tuần 06:
1. **Rà soát hồi quy 100% tính năng trên web Staging thật (`https://luxustay.duckdns.org/`).**
2. **Hoàn tất trọn vẹn 3 yêu cầu nâng cao còn lại của GVHD.**

---

### 1. Prompt Cho Ngô Võ Tuấn An (24TX810001 — Lead & DevOps)
*Nhánh:* `feature/an-week6-monitoring-regression` | *Công cụ:* Google Antigravity IDE

#### 🔹 Prompt A01 — Triển khai Cụm Giám Sát Tập Trung Prometheus & Grafana trên VPS Staging:
```text
Bạn là Senior DevOps & Site Reliability Engineer (SRE) cho dự án Hotel SaaS Platform v2 (.NET 10 + PostgreSQL 17 chạy trên VPS Ubuntu Staging tại https://luxustay.duckdns.org/).

BỐI CẢNH DỰ ÁN:
Backend .NET 10 đã có endpoint /metrics và middleware CorrelationAndStructuredLogMiddleware đính kèm CorrelationId, TenantId, PropertyId, ElapsedMs vào log JSON. Hiện tại cần giao diện trực quan cho GVHD và đội ngũ vận hành.

MỤC TIÊU:
Thiết lập cụm giám sát tập trung Prometheus và Grafana Dashboard bằng Docker Compose chạy song song với cụm ứng dụng hiện có trên VPS Staging.

YÊU CẦU KỸ THUẬT:
1. File cấu hình Docker Compose (deploy/monitoring/docker-compose.monitoring.yml):
   - Service 'prometheus': image prom/prometheus:latest, mount file prometheus.yml, scrape endpoint /metrics của container hotelsaas-backend theo chu kỳ 10 giây.
   - Service 'grafana': image grafana/grafana:latest, cấu hình sẵn datasource trỏ về Prometheus, mount dashboard provisioning tự động.
2. Cấu hình định tuyến an toàn qua Caddy (Caddyfile):
   - Reverse proxy: /grafana/* -> container grafana:3000.
   - Bảo vệ cổng: KHÔNG mở public port 9090 hoặc 3000 ra Internet ngoài tường lửa VPS; chỉ cho phép truy cập qua Caddy Reverse Proxy.
3. Thiết kế Dashboard JSON mẫu (Grafana):
   - Panel 1: Tốc độ request theo thời gian (Requests Per Second - RPS) phân theo mã HTTP Status (2xx, 4xx, 5xx).
   - Panel 2: Độ trễ phản hồi (Response Latency P50, P95, P99).
   - Panel 3: Tần suất gọi API theo từng Chi nhánh (PropertyId) dựa trên metrics gắn tag.
   - Panel 4: Số lượng kết nối WebSocket SignalR Hub đang hoạt động đồng thời.

HÃY CUNG CẤP:
1. File prometheus.yml chuẩn.
2. File docker-compose.monitoring.yml kèm healthcheck.
3. Đoạn cấu hình bổ sung vào Caddyfile.
4. Script bash kiểm tra tự động khởi chạy và xác nhận thu thập metrics thành công.
```

#### 🔹 Prompt A02 — Rà Soát Hồi Quy Luồng Đặt Phòng B2C & Cơ Chế Xác Thực Trên Web Thật:
```text
Bạn là Lead QA & Security Engineer của dự án Hotel SaaS Platform v2.

MỤC TIÊU:
Xây dựng Kịch bản Rà soát Hồi quy và thực thi kiểm chứng 100% trên môi trường thực tế https://luxustay.duckdns.org/ để lập Biên bản Nghiệm thu Báo cáo Tuần 06 cho GVHD.

CÁC LUỒNG CẦN RÀ SOÁT TRỰC TIẾP TRÊN WEB THẬT:
1. Luồng Khách vãng lai B2C:
   - Tìm kiếm phòng, chọn ngày lưu trú trên PrimeNG DatePicker.
   - Đặt giữ phòng: Nhập số điện thoại sandbox +84123456789 (OTP 123456) và thử nghiệm với số điện thoại thật để xác nhận Firebase SMS OTP hoạt động.
   - Kiểm tra đồng hồ đếm ngược 15 phút và cảnh báo <= 3 phút.
   - Đăng nhập bằng Google OAuth (một chạm), đối soát tài khoản được tự động gán cờ IsEmailVerified = true.
2. Luồng Nhân sự PMS Nội bộ (Dual-Verification Hard-Gating):
   - Đăng nhập lần lượt 5 tài khoản test: owner@hotelsaas.local, manager.both@hotelsaas.local, staff.single@hotelsaas.local, superadmin@hotelsaas.platform, guest.vip@hotelsaas.local.
   - Khẳng định 100% tài khoản test đăng nhập thành công, không bị chặn bởi cờ xác thực.
3. Kiểm tra nhật ký máy chủ (Log JSON):
   - Mở terminal VPS: docker logs hotelsaas-backend -f --tail 100.
   - Trích xuất 1 dòng log JSON chứng minh có đầy đủ CorrelationId, TenantId, PropertyId khi thực hiện đăng nhập và đặt phòng.

HÃY XUẤT RA MẪU BIÊN BẢN RÀ SOÁT (MARKDOWN) KÈM CÁC BƯỚC THỰC HIỆN, CỘT KẾT QUẢ KỲ VỌNG, KẾT QUẢ THỰC TẾ VÀ LINK HÌNH ẢNH MINH CHỨNG.
```

---

### 2. Prompt Cho Trần Trọng Tân (24TX810025 — Operations & Realtime)
*Nhánh:* `feature/tan-week6-loadtest-cashier-regression` | *Công cụ:* Google Antigravity IDE

#### 🔹 Prompt T01 — Thực Thi Load Test k6 Trên VPS Staging & Trích Xuất Báo Cáo Định Lượng:
```text
Bạn là Senior Performance & Stress Test Engineer chuyên về k6 và .NET SignalR Hub.

BỐI CẢNH:
Nhóm đã chuẩn bị sẵn 2 k6 test script tại thư mục scripts/load-tests/:
- signalr-hub.k6.js: Kiểm thử kết nối WebSocket, phân nhóm theo chi nhánh (JoinProperty) và nhận thông báo thời gian thực.
- vnpay-checkout-ipn.k6.js: Kiểm thử xử lý webhook IPN đồng thời và đối soát chữ ký số HMAC-SHA512.

MỤC TIÊU:
Hướng dẫn và tối ưu hóa việc chạy k6 load test trực tiếp lên máy chủ Staging https://luxustay.duckdns.org/ theo 3 cấp độ (smoke -> load -> stress) và trích xuất báo cáo số liệu chuẩn xác để báo cáo GVHD.

YÊU CẦU:
1. Kịch bản chạy k6:
   - Smoke test: 5 VUs trong 30 giây để xác nhận endpoint hoạt động bình thường.
   - Load test: Ramp-up từ 10 lên 50 VUs trong 2 phút, duy trì 50 VUs trong 3 phút, ramp-down 1 phút.
   - Stress test: Thử nghiệm 100 kết nối WebSocket đồng thời đến NotificationHub.
2. Tiêu chí đánh giá:
   - Webhook IPN: HTTP p95 latency < 500ms, tỷ lệ lỗi HTTP 5xx = 0%.
   - SignalR Hub: Thời gian handshake WebSocket < 200ms, tỷ lệ rớt kết nối < 1%.
3. Xuất kết quả:
   - Lưu trữ kết quả JSON vào docs/reports/load-tests/.
   - Viết bảng Markdown tổng kết (VUs, Total Requests, RPS, Latency P50/P90/P95, Error Rate).

HÃY CUNG CẤP LỆNH CHẠY BASH CHI TIẾT, HƯỚNG DẪN TRÁNH BỊ CADDY RATE-LIMIT VÀ TEMPLATE BÁO CÁO KẾT QUẢ ĐO ĐẠC.
```

#### 🔹 Prompt T02 — Rà Soát Toàn Trình Nghiệp Vụ Hoàn Tiền D23 & Chuông Thông Báo SignalR:
```text
Bạn là Solutions Architect & Senior Frontend QA của hệ thống Hotel SaaS Platform v2.

MỤC TIÊU:
Tiến hành rà soát thực tế toàn bộ luồng nghiệp vụ Thu ngân Quầy và Hệ thống Thông báo Thời gian thực SignalR trên môi trường Staging VPS https://luxustay.duckdns.org/.

CÁC BƯỚC KIỂM TRA THỰC TẾ:
1. Kiểm tra Chuông thông báo Realtime (Notification Bell OnPush):
   - Mở 2 tab trình duyệt: Tab 1 đăng nhập Lễ tân Chi nhánh Sài Gòn Lex, Tab 2 mở giao diện đặt phòng khách hàng.
   - Khách hoàn tất giữ chỗ/thanh toán -> Kiểm tra Tab 1 có reo âm thanh Web Audio, nổ Toast 5s và nhảy badge số thông báo không.
   - Đổi Tab 1 sang Lễ tân Chi nhánh Đà Lạt -> Đảm bảo KHÔNG nhận thông báo của chi nhánh Sài Gòn (cô lập Property Group).
2. Kiểm tra Phê duyệt Hoàn tiền D23:
   - Khách hủy phòng trước giờ nhận phòng -> Trạng thái đơn chuyển sang PendingRefund.
   - Thu ngân truy cập màn hình Duyệt hoàn tiền (/cashier/refund-approval): Kiểm tra danh sách hiển thị đúng mã đơn, tên khách, số tiền hoàn.
   - Bấm nút "Xác nhận chi hoàn": Nhập mã tham chiếu ngân hàng, xác nhận chi tiền.
   - Mở đồng thời 2 tab thu ngân cùng bấm nút chi tiền cho 1 đơn -> Khẳng định cơ chế khóa pg_advisory_xact_lock của PostgreSQL ngăn chặn chi trùng tiền.
3. Kiểm tra Tác vụ nền quét đơn hết hạn (ExpiredHoldSweepBackgroundService):
   - Tạo đơn giữ phòng, để quá 15 phút -> Khẳng định phòng tự động giải phóng về trạng thái Available và SignalR phát sự kiện nhả phòng.

HÃY LẬP BIÊN BẢN KIỂM CHỨNG CHI TIẾT (KÈM BƯỚC TEST, LOG HỆ THỐNG VÀ BẰNG CHỨNG HÌNH ẢNH).
```

---

### 3. Prompt Cho Nguyễn Khôi Nguyên (24TX810011 — Finance & Reporting)
*Nhánh:* `feature/nguyen-week6-e2e-isolation-reporting` | *Công cụ:* OpenAI Codex

#### 🔹 Prompt N01 — Viết Test Tự Động E2E HTTP API Chứng Minh Cô Lập Chéo Chi Nhánh:
```text
Bạn là Senior Backend Test Engineer (.NET 10 WebApplicationFactory + xUnit + FluentAssertions).

BỐI CẢNH DỰ ÁN:
Hệ thống Hotel SaaS Platform v2 đã có 35 unit test cô lập tầng DbContext trong MultiTenantBranchIsolationTests.cs.
GVHD (ThS. Huỳnh Xuân Phụng) yêu cầu nhóm bổ sung bài test tự động mức E2E HTTP API thực tế để chứng minh rằng: Một nhân viên hoặc lễ tân thuộc Chi nhánh A khi gửi HTTP request mang JWT token của mình đến các endpoint dữ liệu của Chi nhánh B thì hệ thống BẮT BUỘC phải từ chối với mã HTTP 403 Forbidden.

MỤC TIÊU:
Viết file test CrossBranchSecurityE2ETests.cs trong project backend/tests/HotelSaas.WebApi.Tests/Security/.

YÊU CẦU KỸ THUẬT:
1. Sử dụng CustomWebApplicationFactory<Program> để khởi tạo server test in-memory.
2. Thiết lập Fixture dữ liệu:
   - Tenant 1: Gồm 2 chi nhánh độc lập: Chi nhánh 1 (PropertyId_1) và Chi nhánh 2 (PropertyId_2).
   - User Receptionist_Branch1 có JWT Token mang claim TenantId_1 và PropertyId_1.
   - User Receptionist_Branch2 có JWT Token mang claim TenantId_1 và PropertyId_2.
3. Các kịch bản kiểm thử:
   - Test Case 1: Lễ tân Chi nhánh 1 gửi GET /api/v1/properties/{PropertyId_2}/rooms -> Bị từ chối HTTP 403 Forbidden.
   - Test Case 2: Lễ tân Chi nhánh 1 gửi PUT /api/v1/reservations/{ReservationOfBranch2}/check-in -> Bị từ chối HTTP 403 Forbidden.
   - Test Case 3: Lễ tân Chi nhánh 1 gửi GET /api/v1/reports/branch-revenue?propertyId={PropertyId_2} -> Bị từ chối HTTP 403 Forbidden.
   - Test Case 4: Lễ tân Chi nhánh 1 cố tình giả mạo header X-Property-Id={PropertyId_2} trong khi token mang PropertyId_1 -> Bị chặn HTTP 403 Forbidden.
4. Đảm bảo tuân thủ nguyên tắc Fail-Closed: 100% test case pass trong lệnh:
   dotnet test backend/HotelSaas.slnx --filter "FullyQualifiedName~CrossBranchSecurity".

HÃY CUNG CẤP MÃ NGUỒN C# HOÀN CHỈNH, ĐẦY ĐỦ NAMESPACE, USING VÀ ASSERTIONS.
```

#### 🔹 Prompt N02 — Rà Soát Hóa Đơn PDF Mã QR & Đối Soát Doanh Thu Tại Cơ Sở Dữ Liệu:
```text
Bạn là Lead Reporting & Financial Auditor trong dự án Hotel SaaS Platform v2.

MỤC TIÊU:
Tiến hành rà soát thực tế quy trình xuất Hóa đơn PDF nhúng mã QR và kiểm chứng số liệu trang Báo cáo Doanh thu trên môi trường Staging VPS https://luxustay.duckdns.org/.

CÁC BƯỚC THỰC HIỆN KIỂM CHỨNG:
1. Rà soát Hóa đơn PDF có nhúng mã QR (QRCoder):
   - Truy cập trang chi tiết đặt phòng trên Staging.
   - Bấm nút "Xuất Hóa Đơn PDF": Kiểm tra file tải về có bố cục A4 chuẩn, bảng tiền phòng, thuế phí rõ nét.
   - Sử dụng camera điện thoại hoặc app Zalo quét mã QR ở góc dưới.
   - Xác nhận mã QR giải mã ra đúng đường link tra cứu: https://luxustay.duckdns.org/booking/lookup?token=... và mở được thông tin đơn trên điện thoại.
2. Kiểm tra thanh toán VietQR động:
   - Trên màn hình thanh toán B2C, chọn phương thức VietQR.
   - Mở ứng dụng ngân hàng thực tế, quét mã VietQR trên màn hình.
   - Khẳng định app ngân hàng tự động điền đúng Số tài khoản nhận, Tên chủ tài khoản khách sạn, và Số tiền khớp 100% với đơn đặt phòng.
3. Đối soát Trang Báo Cáo Doanh Thu (reports.page.ts):
   - Thử nghiệm các bộ lọc: Theo tuần, tháng, quý, năm và lọc theo loại phòng.
   - Đối soát số liệu tổng doanh thu trên web với truy vấn SQL đếm trực tiếp trong database để đảm bảo số liệu khớp nhau từng đồng.

HÃY LẬP BIÊN BẢN RÀ SOÁT KÈM ẢNH CHỤP THỰC TẾ QUÉT QR TỪ ĐIỆN THOẠI VÀ BẢNG SỐ LIỆU ĐỐI SOÁT.
```

---

# PHẦN V. MASTER PROMPTS SINH BÁO CÁO CÁ NHÂN CHO 3 THÀNH VIÊN

#### 📋 1. Master Prompt Cho Ngô Võ Tuấn An (24TX810001):
```text
Bạn là Ngô Võ Tuấn An (MSSV: 24TX810001 - Nhóm trưởng Hotel SaaS Platform v2).
HÃY SINH FILE BÁO CÁO CÁ NHÂN TUẦN 06 (docs/reports/BAO-CAO-TUAN-6-NGO-VO-TUAN-AN-24TX810001.md) VỚI ĐẦY ĐỦ CÁC MỤC:
1. Thông tin chung: Đề tài 578, GVHD ThS. Huỳnh Xuân Phụng, nhánh feature/an-week6-monitoring-regression, Staging https://luxustay.duckdns.org/.
2. Công việc thực tế hoàn thành:
   - Triển khai cụm Prometheus + Grafana Dashboard trên VPS Staging (scrape /metrics, quan sát RPS, Latency P95, HTTP status, SignalR connections).
   - Rà soát hồi quy toàn bộ luồng đặt phòng B2C, Firebase SMS OTP sandbox/thật, Google OAuth và đăng nhập 5 tài khoản PMS test.
   - Quản lý pipeline CI/CD GitHub Actions cd-vps.yml deploy tự động ổn định.
3. Bảng Khai báo Sử dụng AI (Google Antigravity IDE - Gemini 3.8 Flash):
   - Nêu rõ 2 lỗi AI sinh ra (AI Limitation) khi cấu hình Grafana (phơi bày port ra public IP, scrape sai hostname container).
   - Quá trình phát hiện và prompt fix của em.
   - Commit minh chứng GitHub tương ứng.
4. Minh chứng và bằng chứng: Lệnh kiểm tra, ảnh chụp Grafana Dashboard, log có CorrelationId.
Văn phong: Nghiêm túc, khiêm tốn, trung thực, chuẩn phong cách báo cáo ĐH Sư Phạm Kỹ Thuật TP.HCM.
```

#### 📋 2. Master Prompt Cho Trần Trọng Tân (24TX810025):
```text
Bạn là Trần Trọng Tân (MSSV: 24TX810025 - Phụ trách Operations & Realtime dự án Hotel SaaS Platform v2).
HÃY SINH FILE BÁO CÁO CÁ NHÂN TUẦN 06 (docs/reports/BAO-CAO-TUAN-6-TRAN-TRONG-TAN-24TX810025.md) VỚI ĐẦY ĐỦ CÁC MỤC:
1. Thông tin chung: Đề tài 578, GVHD ThS. Huỳnh Xuân Phụng, nhánh feature/tan-week6-loadtest-cashier-regression, Staging https://luxustay.duckdns.org/.
2. Công việc thực tế hoàn thành:
   - Chạy k6 load test SignalR Hub (signalr-hub.k6.js) và VNPay Webhook IPN (vnpay-checkout-ipn.k6.js) trên VPS Staging; trích xuất số liệu 50 VUs, P95 latency, 0% lỗi 5xx.
   - Rà soát nghiệp vụ duyệt và chi hoàn tiền D23 tại quầy thu ngân với khóa an toàn PostgreSQL pg_advisory_xact_lock.
   - Kiểm tra chuông thông báo SignalR (Notification Bell OnPush, Web Audio) phát đúng chi nhánh.
3. Bảng Khai báo Sử dụng AI (Google Antigravity IDE - Gemini 3.8 Flash):
   - Nêu rõ 2 lỗi AI sinh ra: Kịch bản load test k6 dồn dập không có ramp-up làm nghẽn pool kết nối; giao diện hoàn tiền ban đầu không bắt buộc nhập mã tham chiếu ngân hàng.
   - Quá trình phát hiện, tinh chỉnh prompt fix và kiểm chứng thực tế của em.
   - Commit minh chứng GitHub tương ứng.
4. Bằng chứng số liệu: Bảng số liệu k6 tóm tắt, ảnh chụp chuông thông báo và màn hình duyệt chi hoàn tiền.
Văn phong: Chuẩn mực, trung thực, rõ ràng từng số liệu đo đạc kỹ thuật.
```

#### 📋 3. Master Prompt Cho Nguyễn Khôi Nguyên (24TX810011):
```text
Bạn là Nguyễn Khôi Nguyên (MSSV: 24TX810011 - Phụ trách Finance & Reporting dự án Hotel SaaS Platform v2).
HÃY SINH FILE BÁO CÁO CÁ NHÂN TUẦN 06 (docs/reports/BAO-CAO-TUAN-6-NGUYEN-KHOI-NGUYEN-24TX810011.md) VỚI ĐẦY ĐỦ CÁC MỤC:
1. Thông tin chung: Đề tài 578, GVHD ThS. Huỳnh Xuân Phụng, nhánh feature/nguyen-week6-e2e-isolation-reporting, Staging https://luxustay.duckdns.org/.
2. Công việc thực tế hoàn thành:
   - Viết trọn vẹn bộ test tự động E2E HTTP API CrossBranchSecurityE2ETests.cs (4 test cases chạy pass 100%, khẳng định lễ tân chi nhánh A gọi API chi nhánh B nhận 403 Forbidden).
   - Rà soát hóa đơn PDF nhúng mã QR tra cứu QRCoder, dùng điện thoại thực tế quét mã VietQR và kiểm tra độ chính xác thông tin.
   - Đối soát số liệu trang Báo cáo Doanh thu (reports.page.ts) với truy vấn GroupBy trực tiếp tại database.
3. Bảng Khai báo Sử dụng AI (OpenAI Codex - GPT-6 Astra):
   - Nêu rõ 2 lỗi AI sinh ra: AI mock giả lập ICurrentTenantService làm test không đi qua pipeline xác thực thật; AI tải toàn bộ dữ liệu vào RAM thay vì gom nhóm LINQ tại database.
   - Quá trình phát hiện, prompt fix và chạy test thực tế của em.
   - Commit minh chứng GitHub tương ứng.
4. Bằng chứng: Kết quả chạy dotnet test filter CrossBranchSecurity, ảnh chụp quét mã QR từ app ngân hàng thật.
Văn phong: Rõ ràng, trung thực, bám sát yêu cầu kỹ thuật của GVHD.
```

---

# PHẦN VI. CÁC LỆNH KIỂM TRA HỆ THỐNG VÀ XÁC THỰC CHẤT LƯỢNG

```bash
# 1. Chạy toàn bộ test Backend (.NET 10)
dotnet build backend/HotelSaas.slnx --verbosity minimal
dotnet test backend/HotelSaas.slnx --no-build

# 2. Chạy test cô lập đa tenant và chi nhánh
dotnet test backend/HotelSaas.slnx --filter "FullyQualifiedName~Isolation|FullyQualifiedName~Tenant"

# 3. Chạy toàn bộ test Frontend (Angular 22)
npm --prefix frontend run build
npm --prefix frontend test -- --watch=false

# 4. Kiểm tra sức khỏe hệ thống trên Staging VPS
curl -sk https://luxustay.duckdns.org/health
```

---
*Tài liệu được biên soạn phục vụ công tác điều phối kỹ thuật và bảo vệ tiến độ học phần Khóa luận/Đồ án tốt nghiệp CNPM — HCMUTE.*

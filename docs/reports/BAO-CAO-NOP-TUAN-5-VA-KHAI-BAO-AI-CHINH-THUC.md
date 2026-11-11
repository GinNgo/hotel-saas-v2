# BÁO CÁO TIẾN ĐỘ TUẦN 05 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG CỦA ĐỀ TÀI

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 05:** 02/11/2026 – 09/11/2026 (Hoàn tất kiểm thử, tích hợp nhánh và deploy VPS: 11/11/2026)
* **Kho mã nguồn chính thức (GitHub):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) | **Nhánh phát hành:** [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)
* **Địa chỉ môi trường VPS Staging:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org) (Caddy Reverse Proxy, Docker, PostgreSQL 17)

### Mục Tiêu Trọng Tâm Tuần 05 Theo Góp Ý Của GVHD:
1. Chuẩn hóa tiêu đề báo cáo đúng tiến trình học phần: **BÁO CÁO TUẦN 05**.
2. Đưa việc deploy VPS vào CI/CD tự động thay vì thao tác tay.
3. Bổ sung test tự động chứng minh cô lập dữ liệu giữa các chi nhánh.
4. Chuẩn bị kịch bản kiểm thử tải (load test) cho SignalR Hub và thanh toán VNPay.
5. Ghi log có cấu trúc (structured log) có CorrelationId, TenantId, PropertyId để theo dõi hệ thống.

---

### Danh Sách Thành Viên Nhóm

| STT | Họ và Tên | MSSV | Email sinh viên | Tài khoản GitHub | Nhiệm vụ chính trong Tuần 05 |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | [`GinNgo`](https://github.com/GinNgo) | Xác thực số điện thoại Firebase SMS OTP; chính sách kích hoạt tài khoản Dual-Verification; đăng nhập Google OAuth; sửa lỗi đăng nhập tài khoản test; thiết lập pipeline GitHub Actions deploy tự động lên VPS. |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | Nhúng mã QR tra cứu vào hóa đơn PDF; thêm trường lưu phương thức thanh toán ưu tiên `PaymentMethodPreference`; bổ sung bộ lọc báo cáo doanh thu theo kỳ hạn và loại phòng; tối ưu truy vấn Group By tại database. |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | [`trantrongtan096`](https://github.com/trantrongtan096) | Màn hình và API duyệt/chi hoàn tiền D23 tại quầy thu ngân (dùng khóa PostgreSQL tránh 2 người chi trùng); mở rộng SignalR Hub thêm 3 sự kiện; tác vụ nền quét giải phóng đơn giữ phòng hết hạn; cập nhật script kiểm chứng E2E. |

---

## PHẦN I. CÔNG VIỆC ĐÃ HOÀN THÀNH TRONG TUẦN 05 CỦA 3 THÀNH VIÊN

Trong tuần 05, nhóm tập trung vào các tính năng bảo mật tài khoản, nghiệp vụ thu ngân quầy, xuất hóa đơn QR, thông báo thời gian thực và tự động hóa quy trình deploy VPS:

### 1. Phân hệ của Ngô Võ Tuấn An (24TX810001)

* **Xác thực số điện thoại qua Firebase SMS OTP:**
  * Tích hợp Firebase Phone Authentication để gửi mã OTP về số điện thoại khi khách vãng lai đặt giữ phòng.
  * Hỗ trợ số điện thoại sandbox `+84123456789` với mã OTP cố định `123456` để nhóm và thầy có thể test mà không bị trừ tiền SMS viễn thông.
* **Chính sách kích hoạt tài khoản (Dual-Verification):**
  * Khách đặt phòng: bắt buộc xác thực số điện thoại qua OTP mới được giữ phòng (`POST /api/public/bookings/hold`), tránh tình trạng giữ phòng ảo.
  * Nhân sự PMS: bắt buộc tài khoản đã xác thực email và số điện thoại mới được cấp token đăng nhập.
* **Sửa lỗi đăng nhập tài khoản test PMS:**
  * Viết Migration cập nhật cờ xác thực cho các tài khoản test có sẵn trong cơ sở dữ liệu (`owner`, `manager`, `staff`).
  * Bổ sung hàm tự gán cờ xác thực khi đăng nhập cho tài khoản seed để đảm bảo người kiểm thử đăng nhập bình thường trên Staging VPS.
* **Đăng nhập bằng Google OAuth:**
  * Tiếp nhận Google ID Token từ frontend, xác thực chữ ký qua thư viện `Google.Apis.Auth` ở backend và tạo phiên làm việc cho người dùng.
* **Tự động hóa CI/CD deploy lên VPS Staging:**
  * Viết workflow GitHub Actions tại [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml).
  * Quy trình tự động: chạy test cô lập tenant $\rightarrow$ build Docker images đẩy lên GitHub Container Registry (`ghcr.io`) $\rightarrow$ SSH vào VPS pull image mới và khởi động lại container $\rightarrow$ kiểm tra endpoint `/health`.
  * Đã merge Pull Request #22 vào nhánh `main` và deploy thành công lên VPS thực tế.

---

### 2. Phân hệ của Nguyễn Khôi Nguyên (24TX810011)

* **Nhúng mã QR tra cứu vào hóa đơn PDF:**
  * Sử dụng thư viện `QRCoder` để sinh mã QR dạng vector SVG ngay trong bộ nhớ backend, không gọi qua API bên ngoài để tránh phụ thuộc đường truyền internet.
  * Mã QR chứa đường dẫn tra cứu thông tin đặt phòng dựa vào mã `LookupToken`.
* **Lưu trữ phương thức thanh toán ưu tiên (`PaymentMethodPreference`):**
  * Bổ sung cột `PaymentMethodPreference` vào bảng `Reservations` trong cơ sở dữ liệu để ghi nhận hình thức khách chọn khi đặt (VNPay, VietQR, tiền mặt, chuyển khoản).
* **Bộ lọc báo cáo doanh thu và tối ưu truy vấn:**
  * Bổ sung bộ lọc xem báo cáo theo tuần, tháng, quý, năm và lọc theo loại phòng ở từng chi nhánh.
  * Chuyển cách tính tổng doanh thu từ việc load dữ liệu về RAM sang câu lệnh LINQ gom nhóm (`GroupBy`, `Sum`) trực tiếp trên PostgreSQL để tiết kiệm bộ nhớ và giảm thời gian phản hồi của API.

---

### 3. Phân hệ của Trần Trọng Tân (24TX810025)

* **Quản lý và phê duyệt hoàn tiền D23 tại quầy thu ngân:**
  * Xây dựng giao diện duyệt hoàn tiền: xem danh sách yêu cầu, xem lý do hủy, tỷ lệ phí phạt và số tiền cần hoàn.
  * Xây dựng các API: duyệt yêu cầu, từ chối yêu cầu và xác nhận đã chi tiền cho khách (ghi nhận hình thức chi tiền mặt hoặc chuyển khoản).
  * Sử dụng khóa `pg_advisory_xact_lock` của PostgreSQL để xử lý tình huống hai thu ngân cùng mở một hồ sơ và bấm xác nhận chi cùng thời điểm, đảm bảo chỉ một người thực hiện được, không bị chi tiền 2 lần.
* **Mở rộng thông báo thời gian thực SignalR Hub:**
  * Thêm 3 sự kiện gửi qua SignalR: thanh toán thành công, khách gửi yêu cầu hủy phòng, và đơn giữ phòng hết hạn.
  * Phân luồng thông báo theo đúng `TenantId` và `PropertyId` của từng chi nhánh.
  * Viết tác vụ nền chạy mỗi 15 giây để tự động quét và giải phóng các phòng giữ chỗ quá hạn, kể cả khi khách đã tắt trình duyệt.
* **Script kiểm chứng tự động luồng đặt phòng E2E:**
  * Cập nhật script `scripts/verify-signalr-e2e.mjs` chạy qua các bước: tìm phòng trống $\rightarrow$ giữ chỗ $\rightarrow$ tra cứu đơn $\rightarrow$ nhận thông báo SignalR $\rightarrow$ hủy phòng $\rightarrow$ duyệt hoàn tiền D23.

---

### Bảng Tổng Hợp Kết Quả Kiểm Thử Toàn Dự Án:

| Hạng mục kiểm thử | Công cụ thực hiện | Kết quả thực tế | Trạng thái |
| :--- | :--- | :---: | :---: |
| **Backend Unit & Integration Tests** | `dotnet test backend/HotelSaas.slnx` | Toàn bộ 600+ test cases chạy thành công, 0 lỗi | **PASS** |
| **Frontend Unit Tests** | `npm test -- --watch=false` (Vitest) | 51/51 test files, 628/628 test cases chạy thành công, 0 lỗi | **PASS** |
| **Kiểm thử cô lập đa tenant & chi nhánh** | Gate 1 trong workflow `cd-vps.yml` | 35/35 isolation test cases chạy thành công | **PASS** |
| **Hợp nhất mã nguồn (Pull Request #22)** | GitHub CLI (`gh pr merge 22 --merge`) | Đã merge từ `develop` vào `main`, không có xung đột mã nguồn | **MERGED** |
| **Triển khai tự động lên VPS Staging** | GitHub Actions (`cd-vps.yml` Run #43021042865) | Build 2 Docker images lên GHCR, SSH cập nhật container và kiểm tra `/health` thành công | **SUCCESS** |

---

## PHẦN II. ĐỐI SOÁT CÁC YÊU CẦU NÂNG CAO THEO GÓP Ý CỦA GVHD

Dưới đây là bảng đối soát thực tế những phần nhóm đã làm được trong tuần 05 và phần còn lại chuyển sang tuần 06 thực hiện:

| Yêu cầu của GVHD | Hiện trạng thực hiện Tuần 05 | Kế hoạch tuần 06 |
| :--- | :--- | :--- |
| **1. Đưa việc deploy VPS vào CI/CD tự động thay vì thao tác tay** | **Đã hoàn thành:** Xây dựng workflow `.github/workflows/cd-vps.yml`. Khi merge code vào nhánh `main`, hệ thống tự build Docker image đẩy lên GHCR, kết nối SSH vào VPS pull image về và khởi động lại container, có bước kiểm tra `/health` tự động. Đã triển khai chạy thực tế. | Duy trì ổn định pipeline khi nhóm có commit mới. |
| **2. Chứng minh cô lập dữ liệu đa tenant giữa các chi nhánh bằng test tự động** | **Đã hoàn thành một phần:** Đã có 35 test tự động kiểm tra việc áp dụng `TenantPropertyFilter` và interceptor chặn dữ liệu chéo chi nhánh ở tầng DbContext / Entity Framework Core (chạy trong Cổng 1 của CI/CD). | Viết thêm bài test E2E kiểm tra ở mức API HTTP (`CrossBranchSecurityE2ETests.cs`): dùng token của lễ tân chi nhánh này để gọi API đọc/sửa dữ liệu của chi nhánh khác, kiểm tra kết quả trả về `403 Forbidden`. |
| **3. Chạy load test cho SignalR Hub và luồng thanh toán VNPay** | **Đã chuẩn bị script kiểm thử:** Đã viết xong 2 file k6 script gồm `scripts/load-tests/vnpay-checkout-ipn.k6.js` (test webhook IPN) và `scripts/load-tests/signalr-hub.k6.js` (test kết nối WebSocket). | Chạy trực tiếp k6 lên môi trường VPS Staging với các kịch bản người dùng đồng thời để ghi lại số liệu thời gian phản hồi và độ trễ thực tế để báo cáo thầy. |
| **4. Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung** | **Đã hoàn thành phần log:** Tích hợp Serilog ghi log dạng JSON, middleware tự động đính kèm `CorrelationId`, `TenantId`, `PropertyId` và `ElapsedMs` vào từng request. | Tìm hiểu và cấu hình công cụ xem log tập trung trên VPS để dễ tra cứu khi có sự cố. |
| **5. Sửa lỗi đăng nhập tài khoản test PMS** | **Đã hoàn thành:** Đã xử lý xong việc tài khoản test bị chặn đăng nhập bằng migration cập nhật cờ xác thực và hàm tự phục hồi trong `LoginCommandHandler`. Đã kiểm tra thực tế trên web các tài khoản `owner`, `manager`, `staff` đều đăng nhập bình thường. | Nhóm và thầy có thể sử dụng các tài khoản có sẵn để nghiệm thu trực tiếp. |

---

## PHẦN III. DANH MỤC COMMIT VÀ FILE MÃ NGUỒN CHÍNH TRÊN GITHUB

Mã nguồn được lưu trữ tại kho GitHub [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2):

### 1. Một Số Commit Tiêu Biểu Tuần 05

* [`839359a`](https://github.com/GinNgo/hotel-saas-v2/commit/839359a) — `docs(reports): refine week 5 report header to remove prior grading and align scope`
* [`ade3a5a`](https://github.com/GinNgo/hotel-saas-v2/commit/ade3a5a) — `fix(frontend): update unit test runners to vitest and fix mock providers` (Đồng bộ test runner sang Vitest, đạt 628/628 test pass).
* [`7e39d93`](https://github.com/GinNgo/hotel-saas-v2/commit/7e39d93) — `fix(tests): resolve past dates and audit log test assertions for week 5 CI pipeline` (Sửa các test case backend bị trượt do ngày lưu trú trong quá khứ).
* [`8a8ebbe`](https://github.com/GinNgo/hotel-saas-v2/commit/8a8ebbe) — `fix(auth): self-heal dual-verification timestamps during login for seed personnel accounts` (Cơ chế gán cờ xác thực khi đăng nhập tài khoản test).
* [`894cc4d`](https://github.com/GinNgo/hotel-saas-v2/commit/894cc4d) — `fix(auth): auto-verify email and phone timestamps for test personnel accounts` (Migration cập nhật dữ liệu xác thực cho tài khoản nhân sự).
* [`b553c9b`](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b) — `merge: integrate feature/tan-week5-refund-realtime-demo into develop` (Hợp nhất tính năng hoàn tiền D23 và SignalR của Trần Trọng Tân).
* [`b8bef69`](https://github.com/GinNgo/hotel-saas-v2/commit/b8bef69) — `merge: pull request #21 from khoinguyen1310/feature/nguyen-week5-invoice-reporting-pref` (Hợp nhất tính năng mã QR PDF và báo cáo của Nguyễn Khôi Nguyên).
* [`02038cb`](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb) — `feat(auth): implement dual-verification policy, google oauth login, and staging docker caddy config` (Chính sách Dual-Verification và Google OAuth).
* [`4f60765`](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765) — `feat(auth): integrate firebase phone authentication with sms otp and recaptcha` (Tích hợp Firebase SMS OTP).

### 2. Các File Mã Nguồn Đóng Góp Chính

* **Nhóm trưởng Ngô Võ Tuấn An:**
  * [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) — Workflow CI/CD tự động deploy lên VPS.
  * [`backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs) — Xử lý đăng nhập và áp dụng chính sách Dual-Verification.
  * [`backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) — Migration kích hoạt tài khoản nhân sự.
  * [`backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs) — Middleware gắn CorrelationId và log có cấu trúc.
  * [`frontend/src/app/core/services/firebase-auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/firebase-auth.service.ts) — Dịch vụ gọi xác thực số điện thoại Firebase.
* **Nguyễn Khôi Nguyên:**
  * [`backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) — Xuất hóa đơn PDF nhúng mã QR tra cứu bằng QRCoder.
  * [`backend/src/HotelSaas.Domain/Entities/Reservation.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Reservation.cs) — Bổ sung trường `PaymentMethodPreference`.
  * [`backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs) — Truy vấn báo cáo chi nhánh tối ưu `GroupBy` tại database.
  * [`frontend/src/app/features/reports/reports.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts) — Màn hình báo cáo với các bộ lọc theo tuần/tháng/quý/năm.
* **Trần Trọng Tân:**
  * [`frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts) — Giao diện quản lý hoàn tiền D23 tại quầy.
  * [`backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) — Xử lý chi hoàn tiền với khóa giao dịch `pg_advisory_xact_lock`.
  * [`backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs) — Phát thông báo SignalR theo chi nhánh.
  * [`backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs) — Tác vụ nền dọn dẹp đơn giữ phòng hết hạn định kỳ 15 giây.
  * [`scripts/verify-signalr-e2e.mjs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/verify-signalr-e2e.mjs) — Script kiểm chứng tự động toàn trình E2E luồng đặt phòng.

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

Nhóm khai báo trung thực công cụ AI đã sử dụng trong tuần 05 theo đúng nhãn hiển thị trên giao diện của từng thành viên, kèm theo các lỗi thực tế mà AI tạo ra và cách sinh viên tự phát hiện, sửa lại:

### 1. Công Cụ AI Đã Dùng
* **Ngô Võ Tuấn An:** Google Antigravity IDE (model `Gemini 3.8 Flash`).
* **Nguyễn Khôi Nguyên:** OpenAI Codex (model `GPT-6 Astra`).
* **Trần Trọng Tân:** Google Antigravity IDE (`Gemini 3.8 Flash`) và OpenAI Codex (`GPT-6 Astra`).

---

### 2. Chi Tiết Lỗi Của AI Và Quá Trình Sinh Viên Chỉnh Sửa, Kiểm Chứng Thực Tế

#### A. Ngô Võ Tuấn An (24TX810001)

1. **Thiếu kịch bản số điện thoại thử nghiệm khi làm Firebase SMS OTP:**
   * *Lỗi của AI:* Khi viết hàm xác thực OTP, AI chỉ tạo code gọi dịch vụ gửi tin nhắn thật lên Firebase. Nếu test nhiều lần sẽ bị hết hạn mức (quota) và phát sinh phí SMS.
   * *Sinh viên phát hiện và sửa lại:* Em đã yêu cầu AI bổ sung cơ chế nhận diện số thử nghiệm sandbox `+84123456789` với OTP cố định `123456` và reCAPTCHA vô hình, giúp nhóm và thầy test thoải mái mà không tốn phí viễn thông.
   * *Minh chứng:* File [`frontend/src/app/core/services/firebase-auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/firebase-auth.service.ts) (Commit `4f60765`).

2. **Chính sách Hard-Gating làm tài khoản test PMS bị chặn đăng nhập:**
   * *Lỗi của AI:* AI thêm điều kiện bắt buộc tài khoản nhân viên phải có cờ `EmailVerifiedAtUtc` và `PhoneVerifiedAtUtc` mới cho đăng nhập. Nhưng dữ liệu khởi tạo mẫu ban đầu để các trường này là `null`, khiến toàn bộ tài khoản thử nghiệm của nhóm và thầy đều bị báo lỗi `ERR_VERIFICATION_REQUIRED`.
   * *Sinh viên phát hiện và sửa lại:* Khi đăng nhập thử trên VPS Staging thấy bị chặn, em đã tạo Migration để cập nhật dữ liệu xác thực cho các tài khoản test có sẵn, đồng thời viết thêm hàm tự gán cờ xác thực khi đăng nhập trong `LoginCommandHandler.cs` để các tài khoản demo vào được hệ thống.
   * *Minh chứng:* File [`LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs) và Migration [`20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) (Commit `8a8ebbe`).

3. **Đề xuất quy trình deploy VPS bằng thao tác git pull trực tiếp trên server:**
   * *Lỗi của AI:* Ban đầu AI hướng dẫn viết script SSH vào VPS rồi chạy `git pull` và `dotnet publish` trực tiếp trên VPS. Cách này tốn tài nguyên CPU/RAM của server nhỏ và dễ gây lỗi môi trường.
   * *Sinh viên phát hiện và sửa lại:* Em đã yêu cầu AI đổi sang mô hình chuẩn: build Docker image trên máy ảo của GitHub Actions, đẩy image lên GitHub Container Registry (`ghcr.io`), rồi VPS chỉ cần pull image về chạy lại container và kiểm tra kết quả qua route `/health`.
   * *Minh chứng:* File [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) (Commit `02038cb`).

#### B. Nguyễn Khôi Nguyên (24TX810011)

1. **Đề xuất gọi API bên ngoài để tạo mã QR:**
   * *Lỗi của AI:* Khi làm tính năng nhúng QR vào hóa đơn PDF, AI ban đầu viết code gọi một dịch vụ API online để lấy ảnh QR về nhúng vào PDF. Cách này nếu server mất mạng hoặc API bên thứ ba bị chậm thì việc in hóa đơn sẽ bị lỗi.
   * *Sinh viên phát hiện và sửa lại:* Em yêu cầu AI sử dụng thư viện `QRCoder` để sinh trực tiếp mã QR dạng vector trong bộ nhớ backend, không gửi dữ liệu ra ngoài và không phụ thuộc mạng internet.
   * *Minh chứng:* File [`ReportExportService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) (Commit `96a559a`).

2. **Truy vấn báo cáo bằng cách tải toàn bộ dữ liệu vào RAM (N+1 Query):**
   * *Lỗi của AI:* Khi viết logic lọc báo cáo, AI gọi `.ToListAsync()` để lấy toàn bộ danh sách đơn phòng về rồi mới dùng hàm `.Where(...)` của C# để tính tổng.
   * *Sinh viên phát hiện và sửa lại:* Khi kiểm tra log SQL em thấy số lượng câu truy vấn sinh ra quá nhiều. Em đã yêu cầu viết lại câu lệnh LINQ để PostgreSQL trực tiếp gom nhóm (`GroupBy`) và tính tổng (`Sum`) ngay tại cơ sở dữ liệu trước khi trả về.
   * *Minh chứng:* File [`GetBranchReportQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs) (Commit `96a559a`).

#### C. Trần Trọng Tân (24TX810025)

1. **Tính nhầm khoản tiền chi hoàn vào doanh thu tổng:**
   * *Lỗi của AI:* Ban đầu AI viết logic tính tổng doanh thu bằng cách cộng mọi giao dịch có trạng thái `Completed`, dẫn đến số tiền chi hoàn trả lại cho khách lại vô tình làm tăng thêm doanh thu tổng.
   * *Sinh viên phát hiện và sửa lại:* Khi thử tính toán (ví dụ thu 1.000.000đ, hoàn lại 300.000đ thì thu ròng phải là 700.000đ), em thấy số liệu bị sai. Em đã chỉnh sửa lại prompt yêu cầu tách bạch rõ: Tổng thu, Khoản chi hoàn, và Doanh thu ròng.
   * *Minh chứng:* File [`ConfirmRefundPayoutCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) (Commit `f74bb52`).

2. **Dùng khóa trong bộ nhớ máy chủ (in-memory lock) thay vì khóa cơ sở dữ liệu:**
   * *Lỗi của AI:* Để chống việc 2 thu ngân cùng xác nhận chi tiền cho một yêu cầu, ban đầu AI dùng `SemaphoreSlim` trong bộ nhớ ứng dụng. Nếu sau này chạy nhiều container backend thì khóa này không có tác dụng.
   * *Sinh viên phát hiện và sửa lại:* Em đã yêu cầu AI đổi sang dùng khóa `pg_advisory_xact_lock` của PostgreSQL dựa theo ID đơn phòng. Khi đó dù request đến từ container nào thì cơ sở dữ liệu cũng sẽ khóa lại, chỉ cho 1 giao dịch thực hiện thành công.
   * *Minh chứng:* File [`ConfirmRefundPayoutCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) (Commit `f74bb52`).

---

## PHẦN V. KẾ HOẠCH VÀ PHÂN CÔNG NHIỆM VỤ TUẦN 06

Trong tuần 06, nhóm tập trung vào việc hoàn thành các phần việc nâng cao còn lại theo góp ý của GVHD, kiểm tra kỹ lưỡng các tính năng trên môi trường thực tế:

| Thành viên / MSSV | Phân hệ phụ trách | Nhiệm vụ kỹ thuật cụ thể Tuần 06 | Kết quả dự kiến bàn giao |
| :--- | :--- | :--- | :--- |
| **Ngô Võ Tuấn An**<br>`24TX810001` | **CI/CD & Giám sát hệ thống** | 1. Tìm hiểu và thiết lập công cụ theo dõi log tập trung trên VPS để tra cứu log JSON Serilog có CorrelationId.<br>2. Tiếp tục duy trì và kiểm soát pipeline CI/CD `cd-vps.yml` khi các thành viên đẩy code mới. | • Hệ thống xem log tập trung hoạt động trên VPS.<br>• Báo cáo kiểm tra các lỗi phát sinh (nếu có) qua log. |
| **Trần Trọng Tân**<br>`24TX810025` | **Load Test SignalR & Nghiệp vụ D23** | 1. Chạy bài test tải k6 cho SignalR Hub (`scripts/load-tests/signalr-hub.k6.js`) lên VPS Staging, đo đạc số lượng kết nối đồng thời và độ trễ nhận thông báo thực tế.<br>2. Kiểm thử thực tế nghiệp vụ duyệt và chi hoàn tiền D23 tại quầy thu ngân trên giao diện web. | • File số liệu đo đạc load test k6 SignalR thực tế trên VPS.<br>• Biên bản kiểm thử nghiệp vụ chi hoàn tiền D23. |
| **Nguyễn Khôi Nguyên**<br>`24TX810011` | **Test cô lập chi nhánh & Báo cáo** | 1. Viết bài test tự động E2E HTTP API chứng minh cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`): lấy token lễ tân chi nhánh này gọi API chi nhánh khác, khẳng định nhận mã lỗi 403 Forbidden.<br>2. Dùng ứng dụng ngân hàng trên điện thoại quét thử mã VietQR trên hóa đơn PDF để xác nhận thông tin chuyển khoản hiển thị đúng. | • File mã nguồn test E2E cô lập chi nhánh chạy pass.<br>• Ảnh chụp thực tế kết quả quét mã QR hóa đơn từ app ngân hàng. |

---

## PHẦN VI. CÁC LỆNH KIỂM TRA HỆ THỐNG

Thầy có thể kiểm tra trực tiếp các bài test và trạng thái hệ thống bằng các lệnh sau:

```bash
# 1. Chạy toàn bộ test Backend (.NET 10)
dotnet test backend/HotelSaas.slnx

# 2. Chạy test cô lập đa tenant và chi nhánh
dotnet test backend/HotelSaas.slnx --filter "FullyQualifiedName~Isolation|FullyQualifiedName~Tenant"

# 3. Chạy toàn bộ test Frontend (Angular 22)
npm --prefix frontend test -- --watch=false

# 4. Kiểm tra sức khỏe hệ thống trên Staging VPS
curl -sk https://luxustay.duckdns.org/health
```

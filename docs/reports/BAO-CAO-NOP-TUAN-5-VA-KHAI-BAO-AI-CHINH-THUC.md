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
  * Sử dụng thư viện `QRCoder` để sinh mã QR dạng ảnh PNG trực tiếp trong bộ nhớ backend, không cần gọi API tạo mã QR từ dịch vụ bên ngoài.
  * Nội dung QR chứa đường dẫn tra cứu đặt phòng dựa trên `LookupToken` hợp lệ. Mã QR được nhúng vào hóa đơn PDF nhằm giúp khách mở trang tra cứu thông tin đặt phòng và trạng thái liên quan.
* **Lưu trữ phương thức thanh toán ưu tiên (`PaymentMethodPreference`):**
  * Bổ sung cột `PaymentMethodPreference` vào bảng `Reservations` trong cơ sở dữ liệu để ghi nhận hình thức khách chọn khi đặt (VNPay, VietQR, tiền mặt, chuyển khoản).
* **Bộ lọc báo cáo doanh thu và tối ưu truy vấn:**
  * Bổ sung khả năng lọc báo cáo theo tuần, tháng, quý, năm và theo loại phòng, giúp nhân viên quản lý theo dõi doanh thu theo từng phạm vi cần xem.
  * Đối với các nhóm số liệu phù hợp, sử dụng LINQ `GroupBy` và `Sum` để PostgreSQL thực hiện tổng hợp trước khi trả kết quả về backend, qua đó giảm lượng dữ liệu cần xử lý trong bộ nhớ ứng dụng.
  * Một số phép tính doanh thu và thống kê theo ngày vẫn được thực hiện sau khi tải dữ liệu, nên việc tối ưu toàn bộ truy vấn báo cáo tiếp tục được rà soát trong các giai đoạn sau.

---

### 3. Phân hệ của Trần Trọng Tân (24TX810025)

* **Quản lý và phê duyệt hoàn tiền D23 tại quầy thu ngân:**
  * Xây dựng giao diện duyệt hoàn tiền: xem danh sách yêu cầu, xem lý do hủy, tỷ lệ phí phạt và số tiền cần hoàn.
  * Xây dựng các API: duyệt yêu cầu, từ chối yêu cầu và xác nhận đã chi tiền cho khách (ghi nhận hình thức chi tiền mặt hoặc chuyển khoản).
  * Bổ sung cơ chế khóa giao dịch PostgreSQL `pg_advisory_xact_lock`, kết hợp `SemaphoreSlim` để kiểm soát các yêu cầu xác nhận chi hoàn đồng thời. Khóa nghiệp vụ được xác định theo phạm vi chi nhánh và khoản thanh toán cần xử lý.
  * Xây dựng bài kiểm thử sử dụng `Task.WhenAll` với hai DbContext độc lập để mô phỏng hai thu ngân cùng xác nhận chi hoàn cho một hồ sơ. Kết quả kiểm thử cho thấy chỉ một yêu cầu được ghi nhận thành công, hạn chế nguy cơ cập nhật trùng khoản hoàn tiền trong hệ thống.
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

Nhóm đối soát rõ ràng tình trạng thực hiện các yêu cầu nâng cao của Thầy Huỳnh Xuân Phụng, phân định rõ cái nào đã xong và cái nào chuyển sang tuần 06:

### 1. Các Yêu Cầu Đã Hoàn Thành 100% Trong Tuần 05:
* **Yêu cầu 1 (Đưa việc deploy VPS vào CI/CD tự động thay vì thao tác tay):** **ĐÃ XONG 100%**. Nhóm đã xây dựng hoàn chỉnh pipeline GitHub Actions [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml). Khi merge mã nguồn vào nhánh `main`, hệ thống tự build Docker image đẩy lên GHCR, SSH vào VPS pull image mới và khởi động lại container, có bước kiểm tra `/health` tự động. Đã triển khai chạy thực tế thành công khi merge PR #22.
* **Xử lý đăng nhập tài khoản test PMS:** **ĐÃ XONG 100%**. Đã xử lý triệt để việc tài khoản test bị chặn đăng nhập do chính sách Hard-Gating bằng Migration cập nhật dữ liệu và hàm tự phục hồi trong `LoginCommandHandler`. Đã kiểm tra thực tế trên web các tài khoản `owner`, `manager`, `staff` đều đăng nhập bình thường.

### 2. Các Yêu Cầu Đã Chuẩn Bị Xong Nền Tảng Trong Tuần 05 & Chuyển Sang Tuần 06 Hoàn Thiện:
* **Yêu cầu 2 (Chứng minh cô lập dữ liệu đa tenant giữa các chi nhánh bằng test tự động):**
  * *Tuần 05 đã làm:* Nhóm hoàn thiện Isolation Gate trong GitHub Actions, lựa chọn các bộ kiểm thử liên quan đến cô lập Tenant/Property, middleware, bảo mật SignalR và một số tình huống tích hợp VNPay. Lượt chạy CI/CD được kiểm tra ghi nhận **35/35 bài kiểm thử đạt yêu cầu**.
  * *Chuyển sang Tuần 06:* Bổ sung bài kiểm thử E2E ở mức HTTP API (`CrossBranchSecurityE2ETests.cs`). Sử dụng token nhân viên thuộc một chi nhánh để thử truy cập dữ liệu của chi nhánh khác, kiểm tra việc backend từ chối truy cập theo chính sách phân quyền và phạm vi dữ liệu.
* **Yêu cầu 3 (Chạy load test cho SignalR Hub và luồng thanh toán VNPay):**
  * *Tuần 05 đã làm:* Đã viết xong 2 file k6 script gồm `scripts/load-tests/vnpay-checkout-ipn.k6.js` (test webhook IPN) và `scripts/load-tests/signalr-hub.k6.js` (test kết nối WebSocket).
  * *Chuyển sang Tuần 06:* Chạy trực tiếp k6 lên môi trường VPS Staging với các kịch bản người dùng đồng thời để ghi lại số liệu thời gian phản hồi và độ trễ thực tế để báo cáo thầy.
* **Yêu cầu 4 (Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung):**
  * *Tuần 05 đã làm:* Tích hợp Serilog ghi log dạng JSON, middleware tự động đính kèm `CorrelationId`, `TenantId`, `PropertyId` và `ElapsedMs` vào từng request; tạo endpoint `/metrics` trong backend .NET 10.
  * *Chuyển sang Tuần 06:* Triển khai công cụ Dashboard giám sát trực quan (Prometheus + Grafana) lên VPS để xem số liệu trực tiếp bằng giao diện web.

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
  * [`backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs) — API báo cáo doanh thu, xử lý điều kiện lọc theo loại phòng và tổng hợp số liệu thanh toán theo phương thức.
  * [`backend/src/HotelSaas.Application/Reports/Queries/GetGroupAnalytics/GetGroupAnalyticsQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetGroupAnalytics/GetGroupAnalyticsQueryHandler.cs) — Truy vấn thống kê và tổng hợp dữ liệu phục vụ báo cáo phân tích theo nhóm khách sạn.
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

1. **Bổ sung chế độ thử nghiệm cho chức năng Firebase SMS OTP::**
* **Vấn đề gặp phải:**
  * Trong quá trình tích hợp xác thực số điện thoại, phương án ban đầu tập trung vào việc gửi OTP thông qua Firebase. Cách này phù hợp với luồng xác thực thực tế nhưng khá bất tiện khi nhóm cần thử nhiều lần các trường hợp nhập mã, gửi lại mã hoặc kiểm tra giao diện.
  * Nếu liên tục sử dụng SMS thật để test, nhóm có thể gặp giới hạn dịch vụ hoặc phát sinh chi phí không cần thiết.

* **Cách em xử lý:**
  * Em bổ sung yêu cầu hỗ trợ chế độ OTP mô phỏng, sử dụng mã `123456` trong quá trình phát triển và kiểm thử. Nhờ đó, nhóm có thể kiểm tra luồng nhập OTP mà không cần gửi SMS thật cho mỗi lần chạy.
  * Phần frontend vẫn tích hợp Firebase Authentication và reCAPTCHA để phục vụ xác thực khi có cấu hình Firebase hợp lệ.
  * Tuy nhiên, chế độ mô phỏng cần được tách khỏi xác thực thật. Phần backend hiện còn phải giới hạn việc sử dụng `dev-mock-token` theo môi trường, tránh để token thử nghiệm được chấp nhận trên Staging hoặc Production.

* **Minh chứng:** [firebase-auth.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/firebase-auth.service.ts) và [FirebaseAuthService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs) — Commit [`4f60765`](https://github.com/GinNgo/hotel-saas-v2/commit/4f6076592eae9e7b3527908fc82b43ffd9da186d).

**2. Tài khoản thử nghiệm PMS bị chặn sau khi bổ sung chính sách xác thực**

Ở phần đăng nhập, em gặp vấn đề khi áp dụng chính sách yêu cầu tài khoản nhân viên phải xác thực email và số điện thoại. Các tài khoản thử nghiệm đã được tạo từ trước như `owner`, `manager` và `staff` chưa có đầy đủ thông tin xác thực nên không thể đăng nhập, mặc dù mật khẩu vẫn chính xác.

Khi kiểm tra, hệ thống trả về lỗi `ERR_VERIFICATION_REQUIRED`. Nếu bỏ điều kiện xác thực để tài khoản test đăng nhập được thì lại không đúng với yêu cầu bảo mật mới.

Em xử lý bằng cách bổ sung Migration cập nhật trạng thái xác thực cho các tài khoản thử nghiệm có sẵn. Đồng thời, phần `LoginCommandHandler` được điều chỉnh để nhận diện và bổ sung thông tin xác thực cho những tài khoản seed được chỉ định.

Cách xử lý này giúp nhóm tiếp tục sử dụng các tài khoản demo mà không phải loại bỏ chính sách xác thực đối với người dùng thông thường.

* **Minh chứng:** [LoginCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs) và [Migration cập nhật tài khoản test](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) — Commit [`8a8ebbe`](https://github.com/GinNgo/hotel-saas-v2/commit/8a8ebbe0a5005b099b3fe691aa39779aee331c0d).

**3. Thay đổi cách triển khai ứng dụng lên VPS**

* **Phương án AI đề xuất ban đầu:** SSH vào VPS, sử dụng `git pull` để cập nhật mã nguồn rồi thực hiện build và chạy lại ứng dụng trực tiếp trên máy chủ.
* **Điểm chưa phù hợp:** VPS của nhóm có tài nguyên giới hạn. Nếu vừa chạy ứng dụng vừa thực hiện build frontend và backend thì có thể làm tăng mức sử dụng CPU, RAM và khiến quá trình triển khai khó kiểm soát.
* **Phương án em lựa chọn:** Chuyển công đoạn build sang GitHub Actions. Pipeline thực hiện kiểm thử, tạo Docker images và đẩy lên GitHub Container Registry (`ghcr.io`). VPS chỉ cần tải image mới, cập nhật container và kiểm tra tình trạng ứng dụng qua endpoint `/health`.
* **Kết quả:** Quy trình đã chạy thành công trong đợt triển khai sau khi nhóm merge PR #22 vào `main`. Các bước kiểm thử, build và cập nhật VPS đều có log trên GitHub Actions để theo dõi.

* **Minh chứng:** [cd-vps.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) và [GitHub Actions Run #43021042865](https://github.com/GinNgo/hotel-saas-v2/actions/runs/43021042865).

---

#### B. Nguyễn Khôi Nguyên (24TX810011)

**1. Điều chỉnh cách tạo mã QR trên hóa đơn PDF**

Khi thực hiện chức năng xuất hóa đơn, em cần tạo mã QR để khách có thể quét và truy cập lại thông tin đặt phòng. Phương án AI đưa ra ban đầu là sử dụng một dịch vụ bên ngoài để sinh ảnh QR rồi đưa vào file PDF.

Cách này có thể hoạt động, nhưng em thấy không cần thiết phải phụ thuộc vào một API khác chỉ để tạo mã QR. Nếu dịch vụ phản hồi chậm hoặc đường truyền gặp vấn đề thì chức năng in hóa đơn cũng có thể bị ảnh hưởng.

Em chuyển sang dùng thư viện `QRCoder` để sinh mã QR trực tiếp trong backend. Với phiên bản mã nguồn hiện tại, QR được tạo dưới dạng ảnh PNG trong bộ nhớ, sau đó nhúng vào hóa đơn PDF. Nội dung mã QR chứa đường dẫn tra cứu đặt phòng dựa trên `LookupToken` hợp lệ.

Nhờ vậy, chức năng tạo mã QR không còn phụ thuộc vào API sinh QR bên ngoài. Dữ liệu dùng để tạo QR cũng được xử lý ngay trong hệ thống.

* **Minh chứng:** [ReportExportService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) — Commit [`96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a252e27c197e8d8bfb21f2362fefb7135a).

**2. Rà soát cách xử lý dữ liệu báo cáo doanh thu**

* **Hạn chế của phương án ban đầu:**
  * Một số truy vấn lấy danh sách dữ liệu từ cơ sở dữ liệu về backend rồi mới thực hiện lọc hoặc tính tổng bằng C#.
  * Khi số lượng đơn đặt phòng tăng lên, việc tải nhiều bản ghi chỉ để tính toán có thể làm tăng lượng dữ liệu truyền về ứng dụng và chiếm thêm bộ nhớ.

* **Phần em điều chỉnh:**
  * Em xem lại những phép tính có thể thực hiện trực tiếp tại cơ sở dữ liệu, sau đó áp dụng `GroupBy` và `Sum` trong truy vấn LINQ ở các trường hợp phù hợp.
  * Các bộ lọc theo thời gian và loại phòng vẫn được giữ theo yêu cầu. Sau khi thay đổi cách truy vấn, em tiếp tục đối chiếu kết quả tổng hợp để tránh ảnh hưởng đến số liệu báo cáo.

* **Đánh giá sau chỉnh sửa:**
  * Một số phép tổng hợp đã được thực hiện tại PostgreSQL thay vì phải tải toàn bộ dữ liệu về ứng dụng.
  * Dù vậy, vẫn còn những phép thống kê xử lý trong bộ nhớ backend. Vì thế, em chưa xem đây là việc đã tối ưu hoàn toàn hệ thống báo cáo và sẽ tiếp tục rà soát khi cần cải thiện hiệu năng.

* **Minh chứng:** [ReportsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs) và [GetGroupAnalyticsQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetGroupAnalytics/GetGroupAnalyticsQueryHandler.cs).

---

#### C. Trần Trọng Tân (24TX810025)

**1. Khoản chi hoàn bị tính chung vào tổng doanh thu**

Trong lúc rà soát chức năng hoàn tiền D23, em tập trung kiểm tra số liệu trên báo cáo thu ngân sau khi khách được hoàn tiền. Em lấy trường hợp quầy đã thu **1.000.000 đồng**, sau đó trả lại khách **300.000 đồng** để đối chiếu.

Theo nghiệp vụ, tổng thu vẫn phải là 1.000.000 đồng, tổng chi hoàn là 300.000 đồng và thu ròng còn 700.000 đồng. Tuy nhiên, phần xử lý ban đầu chưa phân biệt đầy đủ giao dịch thu với giao dịch chi hoàn khi tổng hợp các khoản có trạng thái `Completed`.

Nếu cộng chung tất cả giao dịch, số tiền trả lại khách có thể khiến tổng doanh thu tăng lên, trong khi thực tế khách sạn đang chi tiền ra.

Em sử dụng ví dụ này để điều chỉnh prompt và yêu cầu AI kiểm tra lại cách tính. Sau khi sửa, em đối chiếu trên báo cáo ca, báo cáo ngày và Folio, đồng thời bổ sung bài kiểm thử để bảo đảm ba nơi phản ánh cùng một kết quả.

* **Minh chứng:** [RefundApprovalManagementTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Payments/RefundApprovalManagementTests.cs) và [GetShiftReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs).

**2. Kiểm tra tình huống hai thu ngân xác nhận chi hoàn cùng lúc**

Sau khi chức năng duyệt và xác nhận chi hoàn hoạt động, em xem xét thêm một trường hợp có thể xảy ra ở quầy: hai thu ngân cùng mở một hồ sơ hoàn tiền đang chờ xử lý và bấm xác nhận gần như đồng thời.

Cách xử lý ban đầu sử dụng `SemaphoreSlim` để kiểm soát các request trong cùng một tiến trình. Tuy nhiên, nếu sau này hệ thống chạy nhiều backend hoặc nhiều container thì mỗi tiến trình lại có bộ nhớ riêng. Vì vậy, chỉ dùng khóa trong bộ nhớ chưa đủ để kiểm soát trường hợp này.

Em bổ sung yêu cầu sử dụng `pg_advisory_xact_lock` của PostgreSQL, kết hợp kiểm tra trạng thái hồ sơ trước khi xác nhận chi. Phần kiểm thử được mở rộng bằng `Task.WhenAll` với hai DbContext độc lập để mô phỏng hai thu ngân cùng thao tác.

Kết quả kiểm thử local ghi nhận chỉ một yêu cầu xác nhận được xử lý thành công, yêu cầu còn lại bị từ chối do xung đột trạng thái. Bộ kiểm thử backend T01 sau khi cập nhật đạt **15/15 bài**.

Cơ chế này giúp hạn chế việc ghi nhận trùng khoản chi hoàn trong hệ thống. Việc chuyển tiền mặt hoặc chuyển khoản thực tế vẫn được nhân viên thực hiện bên ngoài phần mềm.

* **Minh chứng:** [ConfirmRefundPayoutCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) — Commit [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c).

**3. Thông báo hết hạn giữ phòng khi khách đã đóng trình duyệt**

Ở T02, em đặt ra tình huống khách đã giữ phòng nhưng đóng trình duyệt trước khi hết thời gian đếm ngược. Nếu việc kiểm tra chỉ phụ thuộc vào frontend hoặc chờ người dùng thao tác thì lễ tân có thể không nhận được thông báo khi đơn hết hạn.

Vì vậy, em yêu cầu chuyển việc kiểm tra thời hạn giữ phòng về backend. AI hỗ trợ bổ sung `ExpiredHoldSweepBackgroundService` để tự động quét các đơn quá hạn theo chu kỳ, không phụ thuộc vào việc khách còn mở website hay không.

Sau khi có tác vụ nền, em tiếp tục xem xét trường hợp nhiều backend cùng chạy. Nếu hai backend cùng phát hiện một đơn hết hạn thì cần tránh việc xử lý và phát thông báo trùng lặp.

Em bổ sung yêu cầu sử dụng khóa PostgreSQL và xây dựng bài kiểm thử với hai DbContext độc lập để mô phỏng việc quét đồng thời. Ngoài việc kiểm tra chống trùng, bài test còn đối chiếu sự kiện chỉ được gửi về đúng chi nhánh sở hữu đơn.

Theo kết quả kiểm thử local, bộ backend T02 đạt **17/17 bài** sau khi bổ sung các trường hợp mới. Kết quả này chứng minh tình huống đồng thời đã được mô phỏng trong bài kiểm thử, chưa thay thế việc kiểm thử tải trên nhiều máy chủ triển khai thực tế.

* **Minh chứng:** [CheckExpiredHoldsCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Commands/CheckExpiredHolds/CheckExpiredHoldsCommand.cs) và [NotificationHubSecurityTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Notifications/NotificationHubSecurityTests.cs).

**4. Script E2E ban đầu chưa đi đúng luồng đặt phòng của khách**

Khi chuẩn bị kịch bản demo T03, em cần kiểm chứng quá trình từ lúc khách tìm phòng trên website cho đến khi lễ tân nhận thông báo và xử lý nghiệp vụ trên PMS.

Trong lúc rà lại script `verify-signalr-e2e.mjs`, em phát hiện bước tìm phòng đã sử dụng API công khai nhưng bước tạo đơn lại gọi `POST /api/reservations` dành cho nghiệp vụ nội bộ.

Dù các bước riêng lẻ có thể chạy thành công, cách này chưa chứng minh được khách hàng có thể tự thực hiện toàn bộ quy trình đặt phòng trên website. Đây cũng là điểm chưa phù hợp với mục tiêu trình diễn hai màn hình của T03.

Em điều chỉnh yêu cầu gửi AI để script sử dụng cùng một đơn qua các bước:

`Availability → Hold → Lookup → Confirm → SignalR → Cancel → D23`

Sau khi sửa, script kiểm tra việc khách tạo giữ chỗ công khai, tra cứu bằng `LookupToken`, xác nhận đặt cọc và gửi yêu cầu hủy phòng. Ở phía PMS, em đối chiếu sự kiện SignalR nhận được giữa tài khoản Manager và Receptionist, sau đó tiếp tục kiểm tra quy trình duyệt và xác nhận chi hoàn D23.

Trong lần kiểm chứng local được ghi nhận, script thực hiện các bước trên cùng một đơn thử nghiệm, với khoản đặt cọc và khoản chi hoàn là **480.000 đồng**.

Riêng thanh toán VNPay, em phân biệt rõ việc xác nhận đặt cọc bằng API local với giao dịch thật trên VNPay Sandbox. Script chạy thành công không có nghĩa cổng thanh toán đã gửi IPN từ Internet. Vì vậy, **TC-06 vẫn được ghi ở trạng thái Chưa kiểm chứng**.

* **Minh chứng:** [verify-signalr-e2e.mjs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/verify-signalr-e2e.mjs) và [T03-TEST-RESULTS.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/T03-TEST-RESULTS.md) — Commit [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c).

---

## PHẦN V. KẾ HOẠCH VÀ PHÂN CÔNG NHIỆM VỤ TUẦN 06

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

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN – BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

# KHAI BÁO SỬ DỤNG AI VÀ PROMPT THỰC HIỆN TUẦN 05 – TUẦN 06

**Đề tài 578:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**GVHD:** ThS. Huỳnh Xuân Phụng (phunghx@hcmute.edu.vn)  
**Thời gian báo cáo:** 02/11/2026 – 18/11/2026  
**Kho mã nguồn:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
**Môi trường thử nghiệm:** [luxustay.duckdns.org](https://luxustay.duckdns.org)  
**Mốc chốt báo cáo:** `develop` [c297b58](https://github.com/GinNgo/hotel-saas-v2/commit/c297b58), `main` [5cf0a78](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78)  
**Báo cáo tiến độ:** [BAO-CAO-NOP-TUAN-5-6-CHUNG.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-NOP-TUAN-5-6-CHUNG.md)

Trong tuần 05 và tuần 06, nhóm sử dụng AI để hỗ trợ tìm hướng triển khai, xây dựng chức năng, chỉnh sửa mã nguồn, cấu hình hạ tầng và viết các kịch bản kiểm thử.

---

## 1. Ngô Võ Tuấn An (24TX810001)

**Vai trò:** Nhóm trưởng, phụ trách kiến trúc, xác thực và hạ tầng.

### Ô 1. Công cụ AI

Google Antigravity IDE.

### Ô 2. Phiên bản / model

Gemini 3.8 Flash.

### Ô 3. Prompt đã dùng

**Tuần 05**

1. **Xác thực số điện thoại:** Tích hợp Firebase Phone OTP sử dụng Firebase Web SDK `^13.2.0`, chuẩn hóa số điện thoại theo định dạng E.164 (+84), sử dụng reCAPTCHA và cấu hình số điện thoại sandbox để kiểm thử.
2. **Xác thực tài khoản:** Xây dựng chính sách Dual-Verification cho khách đặt phòng và nhân viên PMS. Tích hợp Google OAuth, Facebook OAuth native và bổ sung migration xác minh tài khoản nhân viên kiểm thử.
3. **Triển khai hệ thống:** Xây dựng workflow GitHub Actions để kiểm thử, build Docker image, lưu trữ trên GHCR và tự động triển khai lên VPS.

**Tuần 06**

4. **Giám sát hệ thống:** Triển khai Prometheus, Loki, Promtail và Grafana trên VPS dùng chung. Bổ sung bộ lọc log theo container, doanh nghiệp, chi nhánh và mức độ lỗi.
5. **Kiến trúc và bảo mật:** Tách `ISystemMetricsRecorder` về tầng Application, ghi nhận metric thực tế từ SignalR và VNPay. Chặn `dev-mock-token:` trên môi trường Production/Staging.
6. **Hạ tầng và tìm kiếm:** Giới hạn RAM container, bổ sung cơ chế rollback, cấu hình bảo mật Caddy, hoàn thiện tìm kiếm theo 34 tỉnh/thành và xác định địa chỉ từ GPS.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05**

- Luồng xác thực ban đầu chỉ gửi SMS thật, dẫn đến lỗi `auth/quota-exceeded` khi kiểm thử nhiều lần.
- Chính sách xác thực làm một số tài khoản nhân viên kiểm thử không thể đăng nhập, trả về lỗi `ERR_VERIFICATION_REQUIRED`.
- Đề xuất build Docker trực tiếp trên VPS, chưa phù hợp với tài nguyên máy chủ.
- Sử dụng modal giả lập thay cho popup OAuth native.

**Tuần 06**

- Tạo thêm cấu hình monitoring không cần thiết và chạy trùng container Caddy, gây xung đột cổng 80/443.
- Gọi trực tiếp `SystemMetricsRegistry` thuộc WebApi từ Infrastructure, chưa đúng hướng phụ thuộc của Clean Architecture.
- Frontend vẫn có thể kích hoạt `isMockMode` trên môi trường thật.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05**

- Bổ sung số điện thoại và mã OTP sandbox để kiểm thử mà không phụ thuộc vào SMS thật.
- Tạo migration `20261111163000_AutoVerifyPersonnelTestAccounts` và bổ sung cơ chế khôi phục trạng thái xác thực cho tài khoản seed.
- Chuyển quá trình build Docker sang GitHub Actions và GHCR để giảm tải cho VPS.
- Sử dụng OAuth native thay cho giao diện giả lập.

Kết quả triển khai tại [PR #22](https://github.com/GinNgo/hotel-saas-v2/pull/22) và [CD Run 43021042865](https://github.com/GinNgo/hotel-saas-v2/actions/runs/43021042865).

**Tuần 06**

- Gom cấu hình giám sát vào `docker-compose.observability.yml`, sử dụng mạng Docker hiện có và giới hạn CIDR truy cập Grafana về `127.0.0.1/32`.
- Tách `ISystemMetricsRecorder` về tầng Application và bổ sung 17 trường hợp kiểm thử liên quan đến metric và logging.
- Bổ sung điều kiện `!environment.production` cùng unit test để ngăn sử dụng mock OTP sai môi trường.
- Hoàn thiện cấu hình rollback và giới hạn tài nguyên container.

**Kết quả kiểm thử và triển khai của nhóm:**

| Hạng mục | Kết quả |
| :--- | :--- |
| Backend | 633/633 PASS |
| Frontend | 640/640 PASS |
| Triển khai VPS | Success |
| Health Check và Grafana | HTTP 200 |

**Minh chứng:**

- [CI Backend](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152640902).
- [CI Frontend](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213642).
- [Deploy VPS](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152641100).
- [PR #23](https://github.com/GinNgo/hotel-saas-v2/pull/23), [PR #24](https://github.com/GinNgo/hotel-saas-v2/pull/24), [PR #25](https://github.com/GinNgo/hotel-saas-v2/pull/25), [PR #28](https://github.com/GinNgo/hotel-saas-v2/pull/28).

---

## 2. Nguyễn Khôi Nguyên (24TX810011)

**Vai trò:** Phụ trách hóa đơn, kiểm thử tải và phân hệ báo cáo.

### Ô 1. Công cụ AI

OpenAI Codex.

### Ô 2. Phiên bản / model

GPT-6 Astra.

### Ô 3. Prompt đã dùng

**Tuần 05**

- **N01 – QR hóa đơn:** Sử dụng QRCoder để sinh mã QR trực tiếp trong bộ nhớ backend, nhúng vào hóa đơn PDF và liên kết đến trang tra cứu đặt phòng thông qua `LookupToken`.
- **N02 – Phương thức thanh toán:** Bổ sung `PaymentMethodPreference` vào `Reservation` để lưu phương thức thanh toán khách đã chọn.
- **N03 – Báo cáo:** Bổ sung bộ lọc doanh thu theo tuần, tháng, quý, năm và loại phòng. Tối ưu truy vấn LINQ để thực hiện các phép tổng hợp tại PostgreSQL.

**Tuần 06**

- **N01 – Kiểm thử tải:** Hoàn thiện hai script k6 cho SignalR và VNPay IPN theo ba mức smoke, load và stress. Tạo tài khoản kiểm thử hợp lệ, bổ sung warm-up và che token trước khi xuất kết quả.
- **N02 – Phân quyền báo cáo:** Bổ sung `[RequirePermission("REPORTS", 1)]`, kiểm tra `IsTenantWide` và `EnsurePropertyAccess`. Loại bỏ dữ liệu thanh toán và doanh thu giả ở backend và frontend.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05**

AI đề xuất gọi dịch vụ bên ngoài để tạo mã QR, khiến quá trình xuất hóa đơn phụ thuộc vào kết nối mạng. Phần xử lý báo cáo ban đầu cũng tải nhiều dữ liệu đặt phòng vào bộ nhớ rồi mới thực hiện lọc và tổng hợp bằng C#.

**Tuần 06**

Kịch bản k6 ban đầu chạy ngay 150 VUs mà không tăng tải theo từng giai đoạn, sử dụng JWT giả gây lỗi HTTP 401 và chưa có bước warm-up. Kết nối database từ xa cũng ảnh hưởng đến kết quả đo.

Trong phân hệ báo cáo, AI vẫn giữ tỷ lệ thanh toán mẫu `0.45 / 0.35 / 0.20`, các số liệu doanh thu fallback và chưa bổ sung đầy đủ kiểm tra quyền đọc báo cáo.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05**

Em chuyển sang sử dụng QRCoder để tạo ảnh QR trực tiếp trong bộ nhớ, không phụ thuộc dịch vụ bên ngoài. Phần truy vấn báo cáo được điều chỉnh để PostgreSQL thực hiện các phép tổng hợp thay vì tải toàn bộ dữ liệu về ứng dụng.

Các thay đổi được đưa vào [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21).

**Tuần 06**

Em chia bộ kiểm thử k6 thành ba mức tải, bổ sung `warmupSignalRHub()` và tạo tenant, tài khoản kiểm thử hợp lệ trong `setup()`. Khi chạy benchmark, em chuyển kết nối sang PostgreSQL Local và bổ sung cơ chế che token trong kết quả xuất ra.

**Kết quả kiểm thử smoke trên Local:**

| Chỉ số | SignalR | VNPay |
| :--- | :--- | :--- |
| Checks thành công | 1.530/1.530 (100%) | 300/300 (100%) |
| P95 | Negotiate: 4,02 ms | IPN: 19,75 ms |
| Lỗi HTTP 5xx | 0 | 0 |

Hai mức load và stress mới được kiểm tra bằng `k6 inspect`, chưa chạy thực tế trên VPS Staging.

Đối với phân hệ báo cáo, em bổ sung quyền `REPORTS:Read`, kiểm tra phạm vi doanh nghiệp và chi nhánh tại backend. Các tỷ lệ thanh toán giả và dữ liệu fallback được loại bỏ, thay bằng dữ liệu thực tế từ database.

**Minh chứng:**

- [Commit 96a559a](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a).
- [PR #21 – Hóa đơn và báo cáo](https://github.com/GinNgo/hotel-saas-v2/pull/21).
- [PR #23 – Kiểm thử tải và bảo mật](https://github.com/GinNgo/hotel-saas-v2/pull/23).
- [PR #27 – Phân quyền báo cáo](https://github.com/GinNgo/hotel-saas-v2/pull/27).

---

## 3. Trần Trọng Tân (24TX810025)

**Vai trò:** Phụ trách nghiệp vụ hoàn tiền D23, thông báo thời gian thực và kiểm thử E2E.

### Ô 1. Công cụ AI

Google Antigravity IDE và OpenAI Codex.

### Ô 2. Phiên bản / model

- Google Antigravity IDE (Gemini 4 Neon).
- OpenAI Codex (GPT-6 Astra).

### Ô 3. Prompt đã dùng

**Tuần 05**

1. **Hoàn tiền D23:** Xây dựng quy trình duyệt, từ chối và xác nhận chi hoàn tiền tại quầy. Phân biệt tiền thu, tiền hoàn và thu ròng. Bổ sung khóa giao dịch PostgreSQL `pg_advisory_xact_lock` để tránh chi trùng khi nhiều thu ngân cùng thao tác.
2. **Thông báo SignalR:** Bổ sung ba sự kiện gồm thanh toán thành công, yêu cầu hủy phòng và đơn giữ phòng hết hạn. Phân phối thông báo theo `TenantId` và `PropertyId`.
3. **Xử lý đơn hết hạn và kiểm thử:** Xây dựng `ExpiredHoldSweepBackgroundService` để kiểm tra đơn giữ phòng hết hạn mỗi 15 giây. Cập nhật script `verify-signalr-e2e.mjs` để kiểm chứng luồng đặt phòng và hoàn tiền.

**Tuần 06**

4. **Kiểm thử cô lập dữ liệu:** Xây dựng `CrossBranchSecurityE2ETests.cs` sử dụng `WebApplicationFactory<Program>`, `JwtService`, `TenantPropertyContextMiddleware` và PostgreSQL thật. Kiểm tra trường hợp giả mạo `X-Property-Id`, truy cập chéo chi nhánh và chéo doanh nghiệp.
5. **Bruno Staging:** Bổ sung cấu hình `Staging.bru` không sử dụng token mock. Thay ngày cố định bằng ngày tính tự động trong `script:pre-request` và xử lý lỗi fixture hoàn tiền liên quan đến mốc chuyển ca 22:00 giờ Việt Nam.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05**

Trong quá trình kiểm tra nghiệp vụ D23, em phát hiện phần tính toán ban đầu chưa phân biệt đúng khoản tiền thu và khoản chi hoàn, dẫn đến việc cộng tiền hoàn vào tổng doanh thu.

Cơ chế `SemaphoreSlim` chỉ kiểm soát thao tác đồng thời trong một tiến trình, chưa đáp ứng trường hợp triển khai nhiều backend. Phần kiểm tra đơn hết hạn ban đầu cũng phụ thuộc vào frontend, trong khi hệ thống cần tiếp tục xử lý ngay cả khi khách đã đóng trang đặt phòng.

Ngoài ra, script E2E sử dụng API nội bộ để tạo đơn thay vì kiểm tra xuyên suốt luồng đặt phòng công khai.

**Tuần 06**

Khi rà soát bộ kiểm thử bảo mật, em phát hiện một số test sử dụng sai route và mock `ICurrentTenantService`, khiến quá trình kiểm thử chưa đi qua đầy đủ luồng xác thực và phân quyền thực tế.

Một số request Bruno sử dụng ngày cố định nên không còn phù hợp khi chạy lại. Bộ test hoàn tiền cũng gặp lỗi do fixture phụ thuộc vào thời điểm chạy, đặc biệt khi đi qua mốc 22:00 giờ Việt Nam.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05**

Em điều chỉnh lại cách tính tiền thu, tiền hoàn và thu ròng để phản ánh đúng số tiền thực tế tại quầy. Đối với trường hợp nhiều thu ngân cùng xác nhận chi hoàn, em bổ sung khóa `pg_advisory_xact_lock` của PostgreSQL và kiểm thử đồng thời bằng `Task.WhenAll`.

Em chuyển việc kiểm tra đơn giữ phòng hết hạn về backend để hệ thống có thể tự động xử lý mà không phụ thuộc vào thao tác của khách hàng.

Đồng thời, em cập nhật script `verify-signalr-e2e.mjs` theo luồng API công khai, từ tìm phòng, giữ phòng đến xác nhận thanh toán, thông báo và hoàn tiền D23.

**Kết quả kiểm thử:**

| Hạng mục | Kết quả |
| :--- | :--- |
| Kiểm thử nghiệp vụ hoàn tiền D23 | 15/15 PASS |
| Kiểm thử xử lý giữ phòng hết hạn và thông báo | 17/17 PASS |

**Tuần 06**

Em sửa các route theo API thực tế và sử dụng JWT kết hợp PostgreSQL thật để kiểm tra khả năng cô lập dữ liệu giữa các chi nhánh. Bộ `CrossBranchSecurityE2ETests.cs` được nhóm ghi nhận đạt 7/7 trường hợp kiểm thử sau tích hợp.

Đối với Bruno, em bổ sung cấu hình Staging và thay ngày cố định bằng ngày tính tự động. Nhóm cũng sửa fixture trong `RefundApprovalManagementTests.cs` để tránh lỗi khi chạy qua mốc chuyển ca 22:00.

**Minh chứng:**

- [Commit f74bb52 – Hoàn tiền D23](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52).
- [Commit b553c9b – Tích hợp công việc tuần 05](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b).
- [PR #23 – Kiểm thử HTTP E2E](https://github.com/GinNgo/hotel-saas-v2/pull/23).
- [PR #26 – Sửa fixture hoàn tiền](https://github.com/GinNgo/hotel-saas-v2/pull/26).
- [PR #27 – Bruno Staging](https://github.com/GinNgo/hotel-saas-v2/pull/27).

---

## 4. Tổng hợp minh chứng GitHub

| Tuần | Pull request | Nội dung |
| :---: | :--- | :--- |
| 05 | [#21](https://github.com/GinNgo/hotel-saas-v2/pull/21) | Hóa đơn QR và báo cáo |
| 05 | [#22](https://github.com/GinNgo/hotel-saas-v2/pull/22) | Xác thực, hoàn tiền, SignalR và triển khai VPS |
| 06 | [#23](https://github.com/GinNgo/hotel-saas-v2/pull/23) | HTTP E2E, k6, giám sát và phân quyền |
| 06 | [#24](https://github.com/GinNgo/hotel-saas-v2/pull/24), [#25](https://github.com/GinNgo/hotel-saas-v2/pull/25) | Hạ tầng VPS và giám sát hệ thống |
| 06 | [#26](https://github.com/GinNgo/hotel-saas-v2/pull/26) | Sửa fixture hoàn tiền |
| 06 | [#27](https://github.com/GinNgo/hotel-saas-v2/pull/27) | Bảo mật xác thực, báo cáo và Bruno Staging |
| 06 | [#28](https://github.com/GinNgo/hotel-saas-v2/pull/28) | Tìm kiếm theo tỉnh/thành và GPS |

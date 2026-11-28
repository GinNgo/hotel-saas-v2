# KHAI BÁO SỬ DỤNG AI VÀ PROMPT THỰC HIỆN TUẦN 05 – TUẦN 06

**Trường:** Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh  
**Khoa:** Công nghệ Thông tin – Bộ môn Công nghệ Phần mềm  
**Mã đề tài:** 578  
**Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (phunghx@hcmute.edu.vn)  
**Thời gian báo cáo:** 02/11/2026 – 18/11/2026  
**Kho mã nguồn:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
**Mốc chốt mã nguồn:** [develop – c297b58](https://github.com/GinNgo/hotel-saas-v2/commit/c297b58), [main – 5cf0a78](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78)  
**Môi trường thử nghiệm:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org)  
**Báo cáo tiến độ đi kèm:** [BAO-CAO-TUAN-05-06-DE-TAI-578-HCMUTE.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-05-06-DE-TAI-578-HCMUTE.md)

Trong tuần 05 và tuần 06, nhóm sử dụng AI để hỗ trợ tìm hướng triển khai, viết và sửa code, cấu hình hệ thống và xây dựng các kịch bản kiểm thử. Nội dung dưới đây trình bày theo từng thành viên, gồm công cụ sử dụng, tóm tắt yêu cầu đã gửi AI, các vấn đề gặp phải và phần sinh viên đã chỉnh sửa, kiểm tra lại.

---

## 1. Ngô Võ Tuấn An – MSSV: 24TX810001

**Vai trò:** Nhóm trưởng, phụ trách kiến trúc, xác thực và hạ tầng.

### Ô 1. Công cụ AI

Google Antigravity IDE.

### Ô 2. Phiên bản / model

- Tuần 05: Gemini 3.8 Flash.
- Tuần 06: Gemini trong Google Antigravity IDE.

### Ô 3. Prompt đã dùng

**Tuần 05**

1. **Xác thực số điện thoại:** Hỗ trợ tích hợp Firebase Web SDK v13 (`^13.2.0`) để khách vãng lai có thể xác thực số điện thoại theo định dạng E.164 (+84). Sử dụng reCAPTCHA Invisible, cấu hình số điện thoại sandbox để kiểm thử mà không gửi SMS thật, đồng thời tách giao diện đăng ký thành hai tab Email và SĐT.
2. **Xác thực tài khoản và triển khai VPS:** Hỗ trợ xây dựng chính sách Dual-Verification cho khách giữ phòng và nhân sự PMS; tích hợp Google OAuth bằng `Google.Apis.Auth` và Facebook OAuth native trong `SocialAuthService`. Bổ sung migration xác thực tài khoản nhân sự kiểm thử và workflow `.github/workflows/cd-vps.yml` để build image, đưa lên GHCR và triển khai Staging tự động.

**Tuần 06**

3. **Giám sát hệ thống:** Cấu hình Prometheus, Loki, Promtail và Grafana trong `docker/docker-compose.observability.yml`, sử dụng chung mạng `treeseo-production_edge` trên VPS. Bổ sung bộ lọc log theo `container`, `level`, `tenant_id`, `property_id` và panel Loki Error Log. Điều chỉnh Caddy để cho phép các đường dẫn `/hubs/*`, `/grafana*`, chặn truy cập công khai đến `/metrics`, `/swagger*` và bổ sung tùy chọn `--rollback` trong `deploy/deploy.sh`.
4. **Kiến trúc, bảo mật và tìm kiếm địa chỉ:** Tách `ISystemMetricsRecorder` về tầng Application để `ProcessVnpayIpnCommand` và `NotificationHub` có thể ghi metric thực tế. Kiểm tra và chặn `dev-mock-token:` trên Production/Staging ở cả backend và frontend. Hoàn thiện tìm kiếm theo 34 tỉnh/thành, reverse geocode từ GPS và xử lý các vấn đề về CORS, in ấn.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05:** Luồng xác thực ban đầu chỉ gửi SMS thật, dẫn đến lỗi `auth/quota-exceeded` khi kiểm thử nhiều lần. Một số tài khoản nhân sự dùng để test PMS cũng không đăng nhập được do lỗi `ERR_VERIFICATION_REQUIRED`. AI còn đề xuất build Docker trực tiếp trên VPS, không phù hợp với lượng RAM hiện có, và sử dụng modal giả lập thay cho popup OAuth native.

**Tuần 06:** Phương án giám sát ban đầu tạo thêm thư mục monitoring và chạy một container Caddy mới, gây xung đột cổng 80/443 với dịch vụ có sẵn. Phần ghi metric gọi trực tiếp `SystemMetricsRegistry` thuộc WebApi từ Infrastructure, chưa đúng hướng phụ thuộc của Clean Architecture. Ở frontend, chế độ `isMockMode = true` vẫn có thể được kích hoạt trên môi trường thật.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05:** Em bổ sung số điện thoại và mã OTP dành riêng cho môi trường sandbox, tạo migration `20261111163000_AutoVerifyPersonnelTestAccounts` và xử lý khôi phục cờ xác thực của tài khoản seed khi đăng nhập. Để giảm tải cho VPS, em chuyển việc build Docker sang GitHub Actions, lưu image trên GHCR rồi mới triển khai lên máy chủ. [PR #22](https://github.com/GinNgo/hotel-saas-v2/pull/22) đã được triển khai thành công (backend 600/600 test, frontend 628/628 test); minh chứng workflow: [CD Run 43021042865](https://github.com/GinNgo/hotel-saas-v2/actions/runs/43021042865).

**Tuần 06:** Em gom các dịch vụ giám sát vào `docker-compose.observability.yml`, tận dụng mạng Docker hiện có và điều chỉnh cấu hình CIDR Grafana về `127.0.0.1/32`. Em tách interface `ISystemMetricsRecorder` ở tầng Application và bổ sung kiểm thử cho phần ghi metric (`ObservabilityMetricsAndLoggingTests` với 17 trường hợp kiểm thử). Đối với chế độ mock OTP, em thêm điều kiện `!environment.production` cùng unit test để chặn sử dụng sai môi trường.

Kết quả CI/CD xác nhận backend đạt 633/633 test ([CI Run 44152640902](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152640902)), frontend đạt 640/640 test ([CI Run 44169213642](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213642)); triển khai Staging hoàn tất tại [Deploy Run 44152641100](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152641100), [Deploy Run 44169213609](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213609) và [Deploy Run 44186521915](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44186521915), các endpoint `/health`, `/health/ready` và `/grafana/api/health` trả HTTP 200.

**Commit minh chứng:** [4f60765](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765), [894cc4d](https://github.com/GinNgo/hotel-saas-v2/commit/894cc4d), [8a8ebbe](https://github.com/GinNgo/hotel-saas-v2/commit/8a8ebbe), [02038cb](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb), [ef4693d](https://github.com/GinNgo/hotel-saas-v2/commit/ef4693d), [a634207](https://github.com/GinNgo/hotel-saas-v2/commit/a634207), [4938464](https://github.com/GinNgo/hotel-saas-v2/commit/4938464), [706c3ac](https://github.com/GinNgo/hotel-saas-v2/commit/706c3ac), [2c76cb5](https://github.com/GinNgo/hotel-saas-v2/commit/2c76cb5), [e57aa4a](https://github.com/GinNgo/hotel-saas-v2/commit/e57aa4a), [3deffa2](https://github.com/GinNgo/hotel-saas-v2/commit/3deffa2).

---

## 2. Nguyễn Khôi Nguyên – MSSV: 24TX810011

**Vai trò:** Phụ trách hóa đơn QR, kiểm thử tải k6 và phân hệ báo cáo.

### Ô 1. Công cụ AI

OpenAI Codex và Google Antigravity IDE.

### Ô 2. Phiên bản / model

- Tuần 05: GPT-6 Astra.
- Tuần 06: OpenAI Codex và Google Antigravity IDE.

### Ô 3. Prompt đã dùng

**Tuần 05**

1. **Hóa đơn PDF:** Hỗ trợ sử dụng QRCoder để tạo ảnh PNG mã QR trực tiếp trong bộ nhớ backend, sau đó nhúng vào hóa đơn PDF khổ A4. Mã QR dẫn đến trang tra cứu đơn đặt phòng thông qua `LookupToken`, không cần gọi dịch vụ tạo QR bên ngoài.
2. **Phương thức thanh toán và bộ lọc báo cáo:** Bổ sung `PaymentMethodPreference` vào bảng `Reservations`, hỗ trợ lọc doanh thu theo tuần, tháng, quý, năm và loại phòng. Tối ưu truy vấn LINQ để `GroupBy` và `Sum` được thực hiện tại PostgreSQL thay vì tải toàn bộ dữ liệu về ứng dụng.

**Tuần 06**

3. **Kiểm thử tải:** Hoàn thiện hai script `scripts/load-tests/signalr-hub.k6.js` và `scripts/load-tests/vnpay-checkout-ipn.k6.js` với ba mức `smoke`, `load`, `stress`. Tạo tenant và tài khoản kiểm thử hợp lệ trong `setup()`, bổ sung `warmupSignalRHub()` để hạn chế ảnh hưởng của JIT, đồng thời che thông tin token trước khi xuất kết quả JSON.
4. **Phân quyền báo cáo:** Bổ sung `[RequirePermission("REPORTS", 1)]` tại `ReportsController.cs`, kiểm tra `IsTenantWide` và `EnsurePropertyAccess` để ngăn truy cập báo cáo ngoài phạm vi được cấp. Xóa tỷ lệ thanh toán giả ở backend và số liệu fallback cứng trong `reports.page.ts`.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05:** AI đề xuất sử dụng một dịch vụ bên ngoài để tạo mã QR, khiến việc xuất hóa đơn phụ thuộc vào kết nối mạng. Cách xử lý báo cáo ban đầu cũng tải toàn bộ đơn đặt phòng vào bộ nhớ rồi mới lọc và tổng hợp bằng C#, chưa phù hợp khi lượng dữ liệu tăng.

**Tuần 06:** Script k6 ban đầu chạy ngay 150 VUs mà không có giai đoạn tăng tải. JWT giả `demo-load-test-jwt-token` làm các yêu cầu trả về HTTP 401. Script chưa warm-up JIT và cấu hình `.NET user-secrets` còn trỏ tới database từ xa, với WAN RTT khoảng 30 ms, ảnh hưởng đến kết quả đo. Trong phân hệ báo cáo, AI vẫn giữ tỷ lệ thanh toán mẫu `0.45 / 0.35 / 0.20` và các giá trị fallback `784000000 / 493000000`, đồng thời thiếu bước kiểm tra quyền đọc báo cáo.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05:** Em chuyển sang tạo QR trong bộ nhớ bằng QRCoder, sau đó kiểm tra mã trên hóa đơn bằng camera điện thoại. Phần tổng hợp doanh thu được điều chỉnh để PostgreSQL thực hiện phép `GroupBy` trực tiếp. Nội dung này thuộc [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21).

**Tuần 06:** Em chia bộ kiểm thử thành ba mức tải, thêm warm-up và tạo tenant thật trong môi trường test. Khi đo, em chuyển kết nối sang PostgreSQL local tại cổng 5435 và che token trong dữ liệu xuất ra.

Kết quả chạy smoke trên local:

| Nội dung | Kết quả |
| --- | --- |
| SignalR – số checks thành công | 1.530/1.530 (100%) |
| SignalR – P95 negotiate | 4,02 ms |
| VNPay – số checks thành công | 300/300 (100%) |
| VNPay – P95 IPN | 19,75 ms |
| Lỗi HTTP 5xx | 0 |

Hai mức load và stress mới được kiểm tra cấu hình bằng `k6 inspect`, chưa chạy trên VPS Staging. Vì vậy, kết quả smoke chỉ phản ánh kịch bản đã chạy trên local, chưa đủ để kết luận khả năng chịu tải của môi trường triển khai.

Em cũng bổ sung quyền `REPORTS`, kiểm tra phạm vi truy cập và xóa dữ liệu báo cáo giả ở backend lẫn frontend. Các thay đổi tích hợp được thể hiện tại [PR #23](https://github.com/GinNgo/hotel-saas-v2/pull/23) và [PR #27](https://github.com/GinNgo/hotel-saas-v2/pull/27).

**Commit minh chứng:** [96a559a](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a), [b8bef69](https://github.com/GinNgo/hotel-saas-v2/commit/b8bef69), [a634207](https://github.com/GinNgo/hotel-saas-v2/commit/a634207), [4938464](https://github.com/GinNgo/hotel-saas-v2/commit/4938464), [e57aa4a](https://github.com/GinNgo/hotel-saas-v2/commit/e57aa4a).

---

## 3. Trần Trọng Tân – MSSV: 24TX810025

**Vai trò:** Phụ trách nghiệp vụ hoàn tiền D23, thông báo realtime và kiểm thử E2E.

### Ô 1. Công cụ AI

Google Antigravity IDE và OpenAI Codex.

### Ô 2. Phiên bản / model

Gemini 3.8 Flash và GPT-6 Astra.

### Ô 3. Prompt đã dùng

**Tuần 05**

1. **Hoàn tiền D23:** Hỗ trợ xây dựng màn hình duyệt, xác nhận chi hoàn tiền tại quầy và các MediatR command tương ứng. Sử dụng `pg_advisory_xact_lock` của PostgreSQL để ngăn xử lý trùng giao dịch khi nhiều thu ngân thao tác đồng thời.
2. **SignalR và đơn giữ phòng hết hạn:** Bổ sung ba sự kiện trong `NotificationHub`, phân phối thông báo theo `TenantId` và `PropertyId`. Xây dựng `ExpiredHoldSweepBackgroundService` để kiểm tra các đơn giữ phòng quá hạn mỗi 15 giây và cập nhật `scripts/verify-signalr-e2e.mjs` để kiểm tra luồng nghiệp vụ.

**Tuần 06**

3. **Kiểm thử cô lập dữ liệu:** Viết bảy test `[Fact]` trong `CrossBranchSecurityE2ETests.cs`, sử dụng `WebApplicationFactory<Program>`, `JwtService`, `TenantPropertyContextMiddleware` và PostgreSQL thật. Các test cần kiểm tra trường hợp giả mạo header `X-Property-Id`, truy cập chéo chi nhánh và chéo tenant.
4. **Bruno và dữ liệu kiểm thử:** Bổ sung môi trường `tests/bruno/hotel-saas/environments/Staging.bru` không sử dụng token mock. Thay ngày cố định bằng dữ liệu động trong `script:pre-request` và xử lý lỗi test liên quan đến mốc chuyển ca 22:00 giờ Việt Nam trong `RefundApprovalManagementTests.cs`.

### Ô 4. Nội dung AI tạo ra còn sai sót

**Tuần 05:** AI cộng khoản chi hoàn tiền vào tổng doanh thu của thu ngân, chưa phân biệt đúng hai loại giao dịch thu và chi. Phương án dùng `SemaphoreSlim` chỉ kiểm soát trong một tiến trình, không đủ khi triển khai nhiều container. Script E2E ban đầu gọi API nội bộ thay vì đi theo luồng API công khai; việc kiểm tra hết hạn giữ phòng cũng mới được xử lý tại frontend.

**Tuần 06:** Một số test sử dụng sai route `/api/v1/properties/.../rooms`. AI còn đề xuất mock `ICurrentTenantService`, khiến bộ HTTP E2E không kiểm tra đầy đủ luồng xác thực và ngữ cảnh thực tế. Một số request Bruno dùng ngày cố định `2026-11-20`, dễ mất hiệu lực khi chạy lại sau đó. Fixture của test D23 cũng phụ thuộc vào thời điểm chạy, dẫn đến lỗi khi đi qua mốc 22:00 theo UTC+7.

### Ô 5. Phần sinh viên đã sửa và kiểm chứng

**Tuần 05:** Em tách lại công thức tính thu và hoàn tiền, thay khóa trong bộ nhớ bằng `pg_advisory_xact_lock` và bổ sung trường hợp kiểm tra đồng thời sử dụng `Task.WhenAll` (bộ test hoàn tiền đạt 15/15 và bộ test xử lý giữ phòng hết hạn đạt 17/17). Em cũng điều chỉnh `scripts/verify-signalr-e2e.mjs` để chạy theo luồng API công khai, từ tìm phòng đến nghiệp vụ hoàn tiền D23.

**Tuần 06:** Em sửa route theo API thực tế và sử dụng `JwtService` kết hợp PostgreSQL thật cho bộ `CrossBranchSecurityE2ETests.cs` (đạt 7/7 trường hợp `[Fact]`). Nhóm bổ sung `Staging.bru`, tạo ngày động bằng `script:pre-request` và cố định mốc chuyển ca trong `RefundApprovalManagementTests.cs` để test chạy ổn định hơn.

Các thay đổi được tích hợp trong [PR #23](https://github.com/GinNgo/hotel-saas-v2/pull/23), [PR #26](https://github.com/GinNgo/hotel-saas-v2/pull/26) (commit `48184cc` do nhóm trưởng xử lý sửa lỗi chuyển ca chung) và [PR #27](https://github.com/GinNgo/hotel-saas-v2/pull/27).

**Commit minh chứng:** [f74bb52](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52), [b553c9b](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b), [a634207](https://github.com/GinNgo/hotel-saas-v2/commit/a634207), [48184cc](https://github.com/GinNgo/hotel-saas-v2/commit/48184cc), [e57aa4a](https://github.com/GinNgo/hotel-saas-v2/commit/e57aa4a).

---

## 4. Danh sách Pull Request đối chiếu

| Tuần | Pull Request | Nội dung chính |
| --- | --- | --- |
| 05 | [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21) | Hóa đơn PDF QR, bộ lọc báo cáo |
| 05 | [PR #22](https://github.com/GinNgo/hotel-saas-v2/pull/22) | Xác thực, hoàn tiền, SignalR, triển khai VPS |
| 06 | [PR #23](https://github.com/GinNgo/hotel-saas-v2/pull/23) | HTTP E2E, k6, giám sát, phân quyền |
| 06 | [PR #24](https://github.com/GinNgo/hotel-saas-v2/pull/24) | Prometheus và cấu hình VPS |
| 06 | [PR #25](https://github.com/GinNgo/hotel-saas-v2/pull/25) | Bộ lọc Grafana, Loki Error Log |
| 06 | [PR #26](https://github.com/GinNgo/hotel-saas-v2/pull/26) | Sửa test liên quan mốc chuyển ca |
| 06 | [PR #27](https://github.com/GinNgo/hotel-saas-v2/pull/27) | Chặn mock OTP, bỏ số liệu báo cáo giả, Bruno Staging |
| 06 | [PR #28](https://github.com/GinNgo/hotel-saas-v2/pull/28) | Tìm kiếm 34 tỉnh/thành, GPS, CORS và in ấn |

# BÁO CÁO TIẾN ĐỘ TUẦN 06 (TỔNG HỢP TUẦN 05 - 06) VÀ KHAI BÁO SỬ DỤNG AI
**Đề tài 578:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**Đơn vị:** Khoa CNTT - Bộ môn CNPM - Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE)  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)  
**Thời gian báo cáo:** 02/11/2026 - 18/11/2026 (Tuần 05: PR #21-#22; Tuần 06: PR #23-#28)  
**GitHub:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (`develop` tại [`c297b58`](https://github.com/GinNgo/hotel-saas-v2/commit/c297b58) | `main` tại [`5cf0a78`](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78))  
**Staging VPS:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org)

| Thành viên | MSSV | GitHub | Vai trò & Phạm vi Tuần 05 - 06 |
| :--- | :---: | :---: | :--- |
| **Ngô Võ Tuấn An** | `24TX810001` | [`GinNgo`](https://github.com/GinNgo) | Nhóm trưởng: Xác thực OTP/OAuth, CI/CD VPS, cụm giám sát PLG, metric Prometheus, khóa token mock, tìm kiếm 34 tỉnh/thành |
| **Nguyễn Khôi Nguyên** | `24TX810011` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | Hóa đơn PDF gắn QR, bộ lọc báo cáo, bộ k6 đo tải SignalR/VNPay, bảo mật RBAC & gỡ số liệu giả phân hệ Báo cáo |
| **Trần Trọng Tân** | `24TX810025` | [`trantrongtan096`](https://github.com/trantrongtan096) | Duyệt/chi hoàn tiền D23 (`pg_advisory_xact_lock`), SignalR 3 sự kiện, `ExpiredHoldSweepBackgroundService`, `CrossBranchSecurityE2ETests.cs`, Bruno Staging |

---

## 1. Kết quả hoàn thành giai đoạn Tuần 05 - Tuần 06

### 1.1. Kiến trúc, xác thực, hạ tầng giám sát và địa giới hành chính (Ngô Võ Tuấn An)
* **Xác thực & CI/CD (Tuần 05):** Tích hợp Firebase Phone OTP kèm số sandbox `+84123456789` (mã `123456`), Google OAuth (`Google.Apis.Auth`), migration mở khóa tài khoản nhân sự test (`20261111163000_AutoVerifyPersonnelTestAccounts`) và pipeline tự động deploy VPS `.github/workflows/cd-vps.yml` qua GHCR (PR #22).
* **Cụm giám sát PLG & tối ưu VPS dùng chung (Tuần 06):** Cấu hình Prometheus, Loki, Promtail, Grafana tại `docker/docker-compose.observability.yml` nối vào mạng dùng chung `treeseo-production_edge`; bổ sung dropdown lọc theo `container`, `level`, `tenant_id`, `property_id` và panel Loki Error Log; cấu hình Caddy mở `/hubs/*`, `/grafana*`, chặn `/metrics`, `/swagger*` từ Internet; giới hạn RAM container và bổ sung `--rollback` trong `deploy/deploy.sh`.
* **Clean Architecture & bảo mật token:** Tách interface `ISystemMetricsRecorder` ở tầng Application để `ProcessVnpayIpnCommand` và `NotificationHub` ghi metric thật (`17` case test); chặn `dev-mock-token:` ở Production/Staging trên cả `FirebaseAuthService.cs` lẫn `firebase-auth.service.ts`.
* **Tìm kiếm 34 tỉnh/thành & bản đồ:** Hoàn thiện tìm kiếm địa lý 34 tỉnh/thành, reverse geocode GPS, AI maps chat và kiểm soát CORS/in ấn (PR #28).

### 1.2. Hóa đơn PDF QR, benchmark k6 và phân hệ Báo cáo (Nguyễn Khôi Nguyên)
* **Hóa đơn PDF & tối ưu truy vấn (Tuần 05):** Dùng `QRCoder` tạo ảnh QR nhúng trực tiếp vào PDF hóa đơn theo `LookupToken` không phụ thuộc mạng ngoài; bổ sung `PaymentMethodPreference` và bộ lọc báo cáo theo kỳ/loại phòng (PR #21).
* **Bộ test tải k6 (`scripts/load-tests/`):** Tham số hóa `signalr-hub.k6.js` và `vnpay-checkout-ipn.k6.js` theo 3 mức `smoke` / `load` / `stress`, tạo tenant và tài khoản thật trong `setup()`, thêm `warmupSignalRHub()` tránh nhiễu JIT và tự che token nhạy cảm trước khi xuất báo cáo JSON. Đã chạy thực tế mức `smoke` trên local API (`127.0.0.1:5055`) nối PostgreSQL 17 (`localhost:5435`); hai mức `load` (50 VUs) và `stress` (100-150 VUs) mới kiểm tra cú pháp qua `k6 inspect`, chưa chạy lên VPS Staging.
* **Sửa bảo mật & dữ liệu giả phân hệ Báo cáo:** Gắn `[RequirePermission("REPORTS", 1)]` tại `ReportsController.cs`, kiểm tra `IsTenantWide` và `EnsurePropertyAccess` chặn xem chéo chi nhánh; gỡ bỏ tỷ lệ chia thanh toán giả `0.45 / 0.35 / 0.20` ở backend và xóa fallback cứng `784000000` / `493000000` trong `reports.page.ts`.

### 1.3. Hoàn tiền D23, Realtime và HTTP E2E cô lập chi nhánh (Trần Trọng Tân)
* **Hoàn tiền D23 & thông báo Realtime (Tuần 05):** Xây dựng luồng duyệt/chi hoàn tiền tại quầy với khóa `pg_advisory_xact_lock`, mở rộng `NotificationHub` thêm 3 sự kiện theo `TenantId` + `PropertyId`, thêm `ExpiredHoldSweepBackgroundService` quét đơn hết hạn mỗi 15 giây và cập nhật `scripts/verify-signalr-e2e.mjs`.
* **HTTP E2E cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`):** Triển khai `7` test `[Fact]` đi qua `WebApplicationFactory<Program>`, `JwtService` thật, `TenantPropertyContextMiddleware` và PostgreSQL thật, chứng minh chặn giả mạo header `X-Property-Id`, check-in/thanh toán/báo cáo chéo chi nhánh, leo thang ngữ cảnh và truy cập chéo tenant.
* **Bruno Staging & ổn định test:** Thêm `tests/bruno/hotel-saas/environments/Staging.bru` không dùng token mock, đổi ngày cố định sang `script:pre-request` động và sửa lỗi fixture lệch ranh giới ca 22:00 giờ Việt Nam trong `RefundApprovalManagementTests.cs` (PR #26). Các bổ sung riêng trên nhánh `origin/feature/tan-week6-security-e2e-d23` (`807a3ae..71daa2f`) hiện chưa merge vào `develop`.

---

## 2. Kết quả kiểm thử và đối soát góp ý của GVHD

| Hạng mục kiểm chứng | Phạm vi / Công cụ | Kết quả xác nhận |
| :--- | :--- | :--- |
| **Tuần 05 Full Suite & Deploy** | `dotnet test` + Vitest + `cd-vps.yml` (Run `#43021042865`) | Backend `600/600` PASS; Frontend `628/628` PASS (`51` files); CI Isolation Gate `35/35`; deploy PR #22 thành công |
| **Tuần 06 CI Pipeline (Run `44152640902`)** | GitHub Actions + PostgreSQL 17 | Backend **`633/633` PASS** (`541` App, `1` Domain, `91` WebApi, gồm `7/7` `CrossBranchSecurityE2ETests`, `17` cases `ObservabilityMetricsAndLoggingTests`, `15/15` `RefundApprovalManagementTests`); Frontend `632/632` -> **`640/640` (`52` files)** sau `e57aa4a` |
| **Staging VPS Probes (Run `44152641100`)** | `https://luxustay.duckdns.org` | Deploy `main` `4m8s`; `/health`, `/health/ready`, `/grafana/api/health` trả `HTTP 200`; `/metrics` và `/swagger` bị chặn từ bên ngoài |
| **k6 Benchmark (`smoke` local `127.0.0.1:5055`)** | `signalr-hub.k6.js` + `vnpay-checkout-ipn.k6.js` + `/metrics` | SignalR `1,530/1,530` checks (`100%`), `p95` negotiate `4.02ms`, join `33.00ms`, chặn chéo chi nhánh `306/306`; VNPay `300/300` checks (`100%`), `p95` IPN `19.75ms`, chống trùng `75/75`, chặn giả `vnp_Amount` `75/75`, `0` lỗi 5xx |

---

## 3. Commit minh chứng chính trên GitHub

* **Tuần 05:** [`4f60765`](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765) (Firebase OTP), [`02038cb`](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb) (Dual-Verification & Google OAuth), [`96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a) / [`b8bef69`](https://github.com/GinNgo/hotel-saas-v2/commit/b8bef69) (PR #21 PDF QR & báo cáo), [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52) / [`b553c9b`](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b) (D23 & SignalR), [`894cc4d`](https://github.com/GinNgo/hotel-saas-v2/commit/894cc4d) (migration tài khoản test), [`ef4693d`](https://github.com/GinNgo/hotel-saas-v2/commit/ef4693d) (PR #22).
* **Tuần 06:** [`a634207`](https://github.com/GinNgo/hotel-saas-v2/commit/a634207) (PR #23: Cross-branch E2E, k6 suite, PLG observability, `ISystemMetricsRecorder`, `ReportsController` RBAC), [`4938464`](https://github.com/GinNgo/hotel-saas-v2/commit/4938464) & [`706c3ac`](https://github.com/GinNgo/hotel-saas-v2/commit/706c3ac) (PR #24: Prometheus & mạng VPS), [`2c76cb5`](https://github.com/GinNgo/hotel-saas-v2/commit/2c76cb5) (PR #25: Grafana filter & Loki panel), [`48184cc`](https://github.com/GinNgo/hotel-saas-v2/commit/48184cc) (PR #26: sửa test ca 22:00), [`e57aa4a`](https://github.com/GinNgo/hotel-saas-v2/commit/e57aa4a) (PR #27: guard FE mock OTP, xóa fallback báo cáo, Bruno Staging), [`3deffa2`](https://github.com/GinNgo/hotel-saas-v2/commit/3deffa2) (PR #28: tìm kiếm 34 tỉnh/thành & GPS).

---

## 4. Khai báo sử dụng AI (AI Disclosure)

* **Ngô Võ Tuấn An (Google Antigravity IDE - Gemini):** AI ban đầu chỉ viết luồng gửi SMS thật dễ cạn quota Firebase, làm tài khoản test PMS bị chặn `ERR_VERIFICATION_REQUIRED`, gọi `SystemMetricsRegistry` trực tiếp từ tầng Infrastructure vi phạm Clean Architecture, mở cổng Grafana `3001` và chạy trùng Caddy trên port 80/443, đồng thời Frontend vẫn tự bật `isMockMode = true` khi lỗi quota. Sinh viên đã bổ sung sandbox OTP `123456`, viết migration `20261111163000`, tách interface `ISystemMetricsRecorder`, khóa CIDR Grafana và bỏ tạo Caddy trùng lặp, thêm guard `!environment.production` kèm unit test.
* **Nguyễn Khôi Nguyên (OpenAI Codex / Antigravity IDE):** AI ban đầu gọi API ngoài tạo QR, chạy k6 thẳng 150 VUs với JWT giả `demo-load-test-jwt-token` và trỏ `.NET user-secrets` vào DB từ xa gây chậm WAN RTT (~30ms), đồng thời giữ tỷ lệ chia giả `0.45/0.35/0.20` và số fallback `784000000` ở giao diện. Sinh viên chuyển sang `QRCoder` in-memory, tách 3 cấp k6 có `warmupSignalRHub()`, tạo tenant thật trong `setup()`, ép nối DB local `5435` khi đo và gỡ bỏ toàn bộ số liệu giả trên BE lẫn FE.
* **Trần Trọng Tân (Google Antigravity IDE / OpenAI Codex):** AI ban đầu cộng tiền hoàn vào doanh thu, chỉ khóa `SemaphoreSlim` trong RAM, gọi sai route `/api/v1/properties/.../rooms` và mock `ICurrentTenantService` trong bài test E2E, giữ ngày quá khứ `2026-11-20` trong Bruno và làm test D23 lỗi sau 22:00 UTC+7. Sinh viên đã tách công thức thu/chi, thêm `pg_advisory_xact_lock` với test `Task.WhenAll`, sửa đúng route thật chạy qua `JwtService` + PostgreSQL, thêm ngày động cho Bruno và cố định mốc thời gian trong test fixture.

---

## 5. Kế hoạch triển khai Tuần 07

| Thành viên | Trọng tâm chuyển tiếp sang Tuần 07 |
| :--- | :--- |
| **Ngô Võ Tuấn An** (`24TX810001`) | Rà soát đóng lỗ hổng bảo mật P0/P1, chuẩn hóa kiến trúc đa tầng, xác thực và các phân hệ Governance/PMS |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | Hoàn thiện xuất hóa đơn, khuyến mãi/báo cáo và chuẩn hóa tham số phân tầng k6 không chứa secret mặc định |
| **Trần Trọng Tân** (`24TX810025`) | Rà soát vận hành điều phối buồng phòng/hoàn tiền và chuẩn bị phạm vi kiểm thử Playwright E2E cùng ma trận phân quyền |

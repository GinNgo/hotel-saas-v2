# BÁO CÁO TIẾN ĐỘ TUẦN 05 - TUẦN 06 VÀ KHAI BÁO SỬ DỤNG AI
**Trường:** Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh - Khoa Công nghệ Thông tin - Bộ môn Công nghệ Phần mềm  
**Đề tài 578:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)  
**Thời gian tổng hợp:** 02/11/2026 - 18/11/2026 (Tuần 05: PR #21-#22; Tuần 06: PR #23-#28)  
**GitHub:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (`develop` tại [`c297b58`](https://github.com/GinNgo/hotel-saas-v2/commit/c297b58) | `main` tại [`5cf0a78`](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78))  
**Staging VPS:** [https://luxustay.duckdns.org](https://luxustay.duckdns.org)

| STT | Thành viên | MSSV | GitHub | Phạm vi thực hiện Tuần 05 - 06 |
| :-: | :--- | :---: | :---: | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | [`GinNgo`](https://github.com/GinNgo) | Nhóm trưởng: Xác thực OTP/OAuth, CI/CD VPS, cụm giám sát PLG, metric Prometheus, khóa token mock, tìm kiếm 34 tỉnh/thành |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | Hóa đơn PDF gắn QR, bộ lọc báo cáo, bộ k6 đo tải SignalR/VNPay, phân quyền RBAC và gỡ số liệu giả phân hệ Báo cáo |
| 3 | **Trần Trọng Tân** | `24TX810025` | [`trantrongtan096`](https://github.com/trantrongtan096) | Hoàn tiền D23 (`pg_advisory_xact_lock`), SignalR 3 sự kiện, `ExpiredHoldSweepBackgroundService`, `CrossBranchSecurityE2ETests.cs`, Bruno Staging |

---

## 1. Kết quả công việc Tuần 05 - Tuần 06

### 1.1. Ngô Võ Tuấn An (`24TX810001`) - Kiến trúc, Xác thực, Hạ tầng Giám sát & Địa giới
* **Tuần 05 (Xác thực & CI/CD VPS):** Tích hợp Firebase Phone OTP kèm số sandbox `+84123456789` (mã `123456`), Google OAuth (`Google.Apis.Auth`), migration mở khóa tài khoản nhân sự test (`20261111163000_AutoVerifyPersonnelTestAccounts`) và pipeline tự động deploy VPS `.github/workflows/cd-vps.yml` qua GHCR (PR #22).
* **Tuần 06 (Cụm giám sát PLG & tối ưu VPS dùng chung):** Cấu hình Prometheus, Loki, Promtail, Grafana tại `docker/docker-compose.observability.yml` nối vào mạng dùng chung `treeseo-production_edge`; thêm bộ lọc dropdown theo `container`, `level`, `tenant_id`, `property_id` và panel Loki Error Log; cấu hình Caddy mở `/hubs/*`, `/grafana*`, chặn `/metrics`, `/swagger*` từ Internet; giới hạn RAM container và bổ sung `--rollback` trong `deploy/deploy.sh`.
* **Tuần 06 (Clean Architecture, bảo mật token & 34 tỉnh):** Tách interface `ISystemMetricsRecorder` ở tầng Application để `ProcessVnpayIpnCommand` và `NotificationHub` ghi metric thật (`17` case test); chặn `dev-mock-token:` ở Production/Staging trên cả `FirebaseAuthService.cs` và `firebase-auth.service.ts`; hoàn thiện tìm kiếm địa lý 34 tỉnh/thành, reverse geocode GPS và kiểm soát CORS/in ấn (PR #28).

### 1.2. Nguyễn Khôi Nguyên (`24TX810011`) - Hóa đơn PDF QR, k6 Benchmark & Báo cáo
* **Tuần 05 (Hóa đơn PDF QR & bộ lọc báo cáo):** Dùng `QRCoder` sinh ảnh QR trực tiếp trong bộ nhớ backend nhúng vào PDF hóa đơn theo `LookupToken` không phụ thuộc mạng ngoài; bổ sung cột `PaymentMethodPreference` và bộ lọc báo cáo theo kỳ hạn/loại phòng (PR #21).
* **Tuần 06 (Bộ test tải k6 `scripts/load-tests/`):** Tham số hóa `signalr-hub.k6.js` và `vnpay-checkout-ipn.k6.js` theo 3 cấp `smoke` / `load` / `stress`, tạo tenant và tài khoản thật trong `setup()`, thêm `warmupSignalRHub()` tránh nhiễu JIT và che token nhạy cảm trước khi xuất JSON. Đã chạy thực tế mức `smoke` trên local API (`127.0.0.1:5055`) nối PostgreSQL 17 (`localhost:5435`); hai mức `load` (50 VUs) và `stress` (100-150 VUs) đã kiểm tra bằng `k6 inspect`, chưa chạy lên VPS Staging.
* **Tuần 06 (Bảo mật & làm sạch phân hệ Báo cáo):** Gắn `[RequirePermission("REPORTS", 1)]` tại `ReportsController.cs`, bổ sung kiểm tra `IsTenantWide` và `EnsurePropertyAccess` chặn xem chéo chi nhánh; xóa tỷ lệ chia thanh toán giả `0.45 / 0.35 / 0.20` ở backend và bỏ toàn bộ fallback cứng `784000000` / `493000000` trong `reports.page.ts`.

### 1.3. Trần Trọng Tân (`24TX810025`) - Hoàn tiền D23, Realtime & HTTP E2E Cô lập Chi nhánh
* **Tuần 05 (Hoàn tiền D23 & SignalR Realtime):** Xây dựng màn hình và API duyệt/chi hoàn tiền tại quầy với khóa PostgreSQL `pg_advisory_xact_lock`, mở rộng `NotificationHub` thêm 3 sự kiện theo `TenantId` + `PropertyId`, thêm `ExpiredHoldSweepBackgroundService` quét đơn giữ phòng hết hạn mỗi 15 giây và cập nhật `scripts/verify-signalr-e2e.mjs`.
* **Tuần 06 (HTTP E2E cô lập chéo chi nhánh):** Triển khai `7` test `[Fact]` trong `CrossBranchSecurityE2ETests.cs` đi qua `WebApplicationFactory<Program>`, `JwtService` thật, `TenantPropertyContextMiddleware` và PostgreSQL thật, chứng minh chặn giả mạo header `X-Property-Id`, check-in/thanh toán/báo cáo chéo chi nhánh, leo thang ngữ cảnh và truy cập chéo tenant.
* **Tuần 06 (Bruno Staging & ổn định test):** Thêm `tests/bruno/hotel-saas/environments/Staging.bru` không dùng token mock, chuyển ngày cố định sang `script:pre-request` động và sửa lỗi fixture lệch ranh giới ca 22:00 giờ Việt Nam trong `RefundApprovalManagementTests.cs` (PR #26). Các bổ sung riêng trên nhánh `origin/feature/tan-week6-security-e2e-d23` (`807a3ae..71daa2f`) hiện chưa merge vào `develop`.

---

## 2. Kết quả kiểm thử và đối soát góp ý GVHD

| Hạng mục kiểm chứng | Phạm vi / Công cụ | Kết quả xác nhận |
| :--- | :--- | :--- |
| **Tuần 05 Full Suite & Deploy** | `dotnet test` + Vitest + `cd-vps.yml` (Run `#43021042865`) | Backend `600/600` PASS; Frontend `628/628` PASS (`51` files); CI Isolation Gate `35/35`; deploy PR #22 thành công |
| **Tuần 06 CI Pipeline (Run `44152640902`)** | GitHub Actions + PostgreSQL 17 | Backend **`633/633` PASS** (`541` App, `1` Domain, `91` WebApi, gồm `7/7` `CrossBranchSecurityE2ETests`, `17` cases `ObservabilityMetricsAndLoggingTests`, `15/15` `RefundApprovalManagementTests`); Frontend `632/632` -> **`640/640` (`52` files)** sau `e57aa4a` |
| **Staging VPS Probes (Run `44152641100`)** | `https://luxustay.duckdns.org` | Deploy `main` `4m8s`; `/health`, `/health/ready`, `/grafana/api/health` trả `HTTP 200`; `/metrics` và `/swagger` chặn từ bên ngoài |
| **k6 Benchmark (`smoke` local `127.0.0.1:5055`)** | `signalr-hub.k6.js` + `vnpay-checkout-ipn.k6.js` + `/metrics` | SignalR `1,530/1,530` checks (`100%`), `p95` negotiate `4.02ms`, join `33.00ms`, chặn chéo chi nhánh `306/306`; VNPay `300/300` checks (`100%`), `p95` IPN `19.75ms`, chống trùng `75/75`, chặn giả `vnp_Amount` `75/75`, `0` lỗi 5xx |

---

## 3. Commit minh chứng chính trên GitHub

* **Tuần 05:** [`4f60765`](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765) (Firebase OTP), [`02038cb`](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb) (Dual-Verification & Google OAuth), [`96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a) / [`b8bef69`](https://github.com/GinNgo/hotel-saas-v2/commit/b8bef69) (PR #21 PDF QR & báo cáo), [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52) / [`b553c9b`](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b) (D23 & SignalR), [`894cc4d`](https://github.com/GinNgo/hotel-saas-v2/commit/894cc4d) (migration tài khoản test), [`ef4693d`](https://github.com/GinNgo/hotel-saas-v2/commit/ef4693d) (PR #22).
* **Tuần 06:** [`a634207`](https://github.com/GinNgo/hotel-saas-v2/commit/a634207) (PR #23: Cross-branch E2E, k6 suite, PLG observability, `ISystemMetricsRecorder`, `ReportsController` RBAC), [`4938464`](https://github.com/GinNgo/hotel-saas-v2/commit/4938464) & [`706c3ac`](https://github.com/GinNgo/hotel-saas-v2/commit/706c3ac) (PR #24: Prometheus & mạng VPS), [`2c76cb5`](https://github.com/GinNgo/hotel-saas-v2/commit/2c76cb5) (PR #25: Grafana filter & Loki panel), [`48184cc`](https://github.com/GinNgo/hotel-saas-v2/commit/48184cc) (PR #26: sửa test ca 22:00), [`e57aa4a`](https://github.com/GinNgo/hotel-saas-v2/commit/e57aa4a) (PR #27: guard FE mock OTP, xóa fallback báo cáo, Bruno Staging), [`3deffa2`](https://github.com/GinNgo/hotel-saas-v2/commit/3deffa2) (PR #28: tìm kiếm 34 tỉnh/thành & GPS).

---

## 4. Khai báo sử dụng AI và Prompt đã dùng (Tuần 05 - Tuần 06)

### 4.1. Ngô Võ Tuấn An (`24TX810001`)
* **Công cụ & Model:** Google Antigravity IDE (`Gemini 3.8 Flash` ở Tuần 05; `Gemini` trong Google Antigravity IDE ở Tuần 06).
* **Prompt chính đã dùng:** Tích hợp Firebase Phone OTP (kèm số sandbox), Google OAuth và pipeline GitHub Actions deploy VPS; thiết lập cụm giám sát PLG trên VPS dùng chung, tách interface `ISystemMetricsRecorder` ở tầng Application, chặn `dev-mock-token` trên môi trường Production/Staging và hoàn thiện tìm kiếm 34 tỉnh/thành.
* **Nội dung AI tạo ra còn sai sót:** AI ban đầu chỉ viết luồng gửi SMS thật làm cạn quota Firebase và làm tài khoản test PMS bị chặn đăng nhập (`ERR_VERIFICATION_REQUIRED`); tạo thư mục monitoring thừa và chạy trùng container Caddy đè cổng 80/443; gọi trực tiếp `SystemMetricsRegistry` (`WebApi`) từ `Infrastructure` vi phạm Clean Architecture; để Frontend tự bật `isMockMode = true` trên môi trường thật.
* **Phần sinh viên đã sửa & kiểm chứng:** Bổ sung sandbox OTP `123456` (`+84123456789`) và migration `20261111163000`; chuyển build Docker lên GitHub Actions + GHCR; gom cấu hình vào `docker-compose.observability.yml` nối mạng `treeseo-production_edge`, khóa CIDR Grafana `127.0.0.1/32`, tách `ISystemMetricsRecorder` (`17` test cases) và thêm guard `!environment.production` kèm unit test.

### 4.2. Nguyễn Khôi Nguyên (`24TX810011`)
* **Công cụ & Model:** OpenAI Codex (`GPT-6 Astra`) và Google Antigravity IDE.
* **Prompt chính đã dùng:** Dùng `QRCoder` sinh mã QR in-memory nhúng vào PDF hóa đơn và lọc báo cáo theo kỳ hạn; chuẩn hóa k6 load test cho SignalR và VNPay IPN; gắn phân quyền RBAC cho `ReportsController` và loại bỏ toàn bộ dữ liệu giả lập trong phân hệ Báo cáo.
* **Nội dung AI tạo ra còn sai sót:** AI gợi ý gọi API ngoài để sinh mã QR; bắn k6 thẳng 150 VUs không ramp-up với JWT giả `demo-load-test-jwt-token` gây HTTP 401, không warmup JIT và trỏ `.NET user-secrets` vào DB từ xa gây chậm WAN RTT (~30ms); giữ tỷ lệ chia thanh toán giả `0.45/0.35/0.20` ở backend, fallback cứng `784000000` ở `reports.page.ts` và thiếu kiểm tra quyền đọc báo cáo.
* **Phần sinh viên đã sửa & kiểm chứng:** Dùng `QRCoder` in-memory (PR #21); chia 3 cấp `smoke`/`load`/`stress`, thêm `warmupSignalRHub()`, tạo tenant thật trong `setup()`, ép nối DB local `5435` khi đo, tự che token và chạy `smoke` đạt 100% (`1,530/1,530` SignalR, `300/300` VNPay, `0` lỗi 5xx); gắn `[RequirePermission("REPORTS", 1)]` và xóa sạch số liệu giả BE + FE.

### 4.3. Trần Trọng Tân (`24TX810025`)
* **Công cụ & Model:** Google Antigravity IDE (`Gemini 3.8 Flash`) và OpenAI Codex (`GPT-6 Astra`).
* **Prompt chính đã dùng:** Xây dựng luồng duyệt/chi hoàn tiền D23 với `pg_advisory_xact_lock`, mở rộng SignalR Hub 3 sự kiện và tác vụ nền quét giữ phòng hết hạn; viết bộ HTTP E2E cô lập chéo chi nhánh `CrossBranchSecurityE2ETests.cs`, cấu hình Bruno Staging với ngày động và sửa lỗi test lệch mốc ca 22:00 giờ Việt Nam.
* **Nội dung AI tạo ra còn sai sót:** AI cộng tiền hoàn vào tổng doanh thu, chỉ dùng `SemaphoreSlim` trong RAM và kiểm tra hết hạn ở frontend; viết sai route `/api/v1/properties/.../rooms` và gợi ý mock `ICurrentTenantService` trong HTTP E2E; giữ ngày quá khứ cố định `2026-11-20` trong Bruno và để fixture test D23 lỗi khi chạy sau 22:00 UTC+7.
* **Phần sinh viên đã sửa & kiểm chứng:** Tách công thức thu/chi, bổ sung `pg_advisory_xact_lock` với test `Task.WhenAll` (`15/15`) và `ExpiredHoldSweepBackgroundService` (`17/17`); sửa đúng route thật chạy qua `JwtService` + PostgreSQL trong `CrossBranchSecurityE2ETests.cs` (`7/7` `[Fact]` pass); thêm `Staging.bru` + `script:pre-request` động và cố định mốc ca trong `RefundApprovalManagementTests.cs`.

---

## 5. Kế hoạch chuyển tiếp sang Tuần 07

| Thành viên | Trọng tâm triển khai Tuần 07 |
| :--- | :--- |
| **Ngô Võ Tuấn An** (`24TX810001`) | Rà soát đóng lỗ hổng bảo mật P0/P1, chuẩn hóa kiến trúc đa tầng, xác thực và các phân hệ Governance/PMS |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | Hoàn thiện xuất hóa đơn, khuyến mãi/báo cáo và chuẩn hóa tham số phân tầng k6 không chứa secret mặc định |
| **Trần Trọng Tân** (`24TX810025`) | Rà soát vận hành điều phối buồng phòng/hoàn tiền và chuẩn bị phạm vi kiểm thử Playwright E2E cùng ma trận phân quyền |

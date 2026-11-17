# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO CÁ NHÂN TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 06 (P7B)
### VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

* **Họ và tên sinh viên:** Ngô Võ Tuấn An
* **Mã số sinh viên:** `24TX810001`
* **Vai trò trong nhóm:** Nhóm trưởng (Team Leader), Kiến trúc, Bảo mật & DevOps/Observability
* **Đề tài / Topic:** 578 — Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 6:** 10/11/2026 – 18/11/2026
* **Email liên hệ:** `ngovotuananh@gmail.com` / `24tx810001@student.hcmute.edu.vn`
* **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh tích hợp & phát hành:** `fix/week6-ux-rbac-stabilization` $\to$ `develop` $\to$ `main` ([`https://luxustay.duckdns.org`](https://luxustay.duckdns.org))

---

## I. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC PHÂN CÔNG TRONG TUẦN 6

1. **Hoàn thiện cụm Giám sát Tập trung PLG (Prometheus + Loki + Promtail + Grafana) trên VPS Staging (`103.116.38.74`):**
   - Kết nối cụm observability tại `docker/docker-compose.observability.yml` vào đúng mạng Docker dùng chung trên VPS (`treeseo-production_edge`), tuyệt đối không ảnh hưởng tới 5 container sản xuất của hệ thống dùng chung (`treeseo-production-*`).
   - Bổ sung Dashboard JSON (`hotelsaas-sre-security-dashboard.json`) với bộ lọc point-and-click (`container`, `level`, `tenant_id`, `property_id`, `search`) và panel Error Log từ Loki.
   - Sửa `deploy/Caddyfile` (`/hubs/*` cho SignalR, `/grafana*` cho Grafana, khóa `/metrics` và `/swagger*` khỏi Internet công khai).
2. **Nối Metric Prometheus thật qua Clean Architecture (`ISystemMetricsRecorder`):**
   - Tách interface `ISystemMetricsRecorder` ở tầng `Application` để `ProcessVnpayIpnCommand` (`rsp_code` `00`/`02`/`97`) và `NotificationHub` (số kết nối SignalR active) ghi nhận dữ liệu thật mà không vi phạm phụ thuộc vào `WebApi`.
   - Bổ sung bộ test `ObservabilityMetricsAndLoggingTests.cs` (`17` test cases: `12` `[Fact]` + `1` `[Theory]` với `5` `[InlineData]`).
3. **Khóa `dev-mock-token:` theo môi trường (Fail-Closed):**
   - Chặn triệt để `dev-mock-token:` trên `Production` và `Staging` tại `FirebaseAuthService.cs` (Backend).
   - Rà soát và bổ sung kiểm tra `!environment.production` cho mọi fallback `isMockMode` trong `firebase-auth.service.ts` (Frontend) kèm unit test.
4. **Tối ưu Shared-VPS RAM Thấp, Hạ tầng Terraform & Cơ chế Rollback:**
   - Giới hạn RAM và tối ưu GC .NET 10 (`DOTNET_gcServer=0`, `DOTNET_GCConserveMemory=9`, `DOTNET_GCHeapHardLimitPercent=70`, `mem_limit`) cùng `json-file` log rotation (`20m`/`5` files).
   - Nâng cấp `deploy/deploy.sh` (hỗ trợ `--rollback` từ `.rollback_state`, kiểm tra kép `/health` + `/health/ready`) và `deploy/workflows/cd-vps.yml`.
   - Khóa mặc định `grafana_allowed_cidrs = ["127.0.0.1/32"]` trong `infra/terraform/main.tf`.

---

## II. KẾT QUẢ TRIỂN KHAI & MINH CHỨNG MÃ NGUỒN / HẠ TẦNG

### 1. Bảng Đối Chiếu Commit & Pull Request Thực Tế (Tuần 6)

| Commit / PR | Tác giả | Ngày | Nội dung chính |
| :---: | :--- | :---: | :--- |
| [`a634207`](https://github.com/GinNgo/hotel-saas-v2/commit/a634207) / **PR #23** | Tuấn An (`GinNgo`) | 15–16/11/2026 | `ISystemMetricsRecorder`, `ObservabilityMetricsAndLoggingTests.cs`, `FirebaseAuthService.cs` fail-closed guard, `deploy/Caddyfile`, `deploy/deploy.sh`, `infra/terraform/main.tf`, `.NET` GC low-RAM env trong `Dockerfile` & `docker-compose.staging.yml`, tích hợp test & k6. |
| [`b79400d`](https://github.com/GinNgo/hotel-saas-v2/commit/b79400d) | Tuấn An (`GinNgo`) | 16/11/2026 | Sửa lỗi test flaky khi chạy cấu hình `Release` và ngày cố định trong `GoogleLoginAndDualVerificationPolicyTests.cs`, `BookingHttpPipelineTests.cs`, `StayLifecycleHttpPipelineTests.cs`. |
| [`4938464`](https://github.com/GinNgo/hotel-saas-v2/commit/4938464) / **PR #24** | Tuấn An (`GinNgo`) | 16/11/2026 | Sửa target scrape Prometheus từ `backend:5000` sang `hotelsaas-backend-api:5000` trong `docker/observability/prometheus.yml`. |
| [`706c3ac`](https://github.com/GinNgo/hotel-saas-v2/commit/706c3ac) / **PR #24** | Tuấn An (`GinNgo`) | 16/11/2026 | Đồng bộ `deploy/deploy.sh` và `deploy/workflows/cd-vps.yml` với kiến trúc shared-VPS edge (`treeseo-production_edge` + shared Caddy, bỏ thao tác tạo container Caddy trùng lặp). |
| [`2c76cb5`](https://github.com/GinNgo/hotel-saas-v2/commit/2c76cb5) / **PR #25** | Tuấn An (`GinNgo`) | 17/11/2026 | Nâng cấp `hotelsaas-sre-security-dashboard.json` với dropdown lọc point-and-click và panel Error Log từ Loki. |
| [`48184cc`](https://github.com/GinNgo/hotel-saas-v2/commit/48184cc) / **PR #26** | Tuấn An (`GinNgo`) | 17–18/11/2026 | Khắc phục lỗi ranh giới ca 22:00 UTC+7 trong `RefundApprovalManagementTests.cs`. |

*(Lưu ý quy trình GitHub: Do token OAuth CLI hiện tại chưa có quyền `workflow`, các bản nâng cấp pipeline chứa `infra-validation` và rollback CD được lưu trữ đồng bộ tại `deploy/workflows/ci.yml` và `deploy/workflows/cd-vps.yml` thay vì ghi đè trực tiếp `.github/workflows/`.)*

### 2. Kết Quả Vận Hành Thực Tế trên VPS Staging (`https://luxustay.duckdns.org`)

- **Cụm PLG Observability chạy ổn định trong giới hạn tài nguyên:**
  - `hotelsaas-prometheus` (`192m`, retention `7d`/`256MB`), `hotelsaas-loki` (`192m`, retention `360h`), `hotelsaas-promtail` (`64m`, lọc `regex: '/(hotelsaas-.*)'`), `hotelsaas-grafana` (`160m`, subpath `/grafana/`).
  - `hotelsaas-backend-api` (`512m` limit), `hotelsaas-frontend-app` (`64m` limit), `hotelsaas-redis` (`64m` limit) gắn log `json-file` (`max-size: 20m`, `max-file: 5`).
- **Kiểm chứng Probes HTTPS trực tiếp:**
  - `GET https://luxustay.duckdns.org/health` $\to$ `HTTP 200` (`{"status":"healthy",...}`)
  - `GET https://luxustay.duckdns.org/health/ready` $\to$ `HTTP 200` (`{"status":"ready","database":"connected",...}`)
  - `GET https://luxustay.duckdns.org/grafana/api/health` $\to$ `HTTP 200` (`{"database":"ok","version":"11.2.0"}`)
  - `GET https://luxustay.duckdns.org/metrics` và `/swagger`: Không phơi API backend ra Internet (trên VPS dùng chung chỉ forward `/api/*`, `/hubs/*`, `/health*`, `/grafana*`; mọi đường dẫn khác rơi về fallback SPA frontend).
- **Kiểm chứng CI/CD & Test Suites:**
  - Trên GitHub Actions (`CI Pipeline` Run `44152640902`, có PostgreSQL 17 service container): **633/633** Backend tests **PASS** (`541` Application + `1` Domain + `91` WebApi) và **632/632** Frontend Vitest tests **PASS** (`51` files); sau bản vá FE `firebase-auth.service.spec.ts` & `reports.page.spec.ts` trên `fix/week6-ux-rbac-stabilization`, tổng Frontend Vitest đạt **640/640** tests **PASS** (`52` test files).
  - Trên máy local khi PostgreSQL `5435` tắt: toàn bộ **303/303** non-DB unit tests đều PASS; các integration test yêu cầu PostgreSQL được xác minh đầy đủ qua CI PostgreSQL.
  - `CD — Deploy to Production VPS` (Run `44152641100` trên `main`): **SUCCESS** (`4m8s`).

---

## III. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

| Lần | Công cụ AI | Nhiệm vụ áp dụng | Lỗi thực tế của AI đã phát hiện & Sinh viên sửa chữa | Commit / Minh chứng |
| :---: | :--- | :--- | :--- | :---: |
| **#01** | Google Antigravity IDE (`Gemini`) | Triển khai PLG Observability & Caddyfile | AI ban đầu tạo thư mục mới `deploy/monitoring/`, gán sai network `hotelsaas-net` và mở port Grafana `3001` ra `0.0.0.0/0` $\to$ Sinh viên hợp nhất dùng `docker/docker-compose.observability.yml` có sẵn, nối đúng mạng bridge và khóa `grafana_allowed_cidrs` mặc định `127.0.0.1/32` trong Terraform. | `a634207` |
| **#02** | Google Antigravity IDE (`Gemini`) | Kết nối Metric SignalR & VNPay `97` | AI gọi trực tiếp `SystemMetricsRegistry` (tầng `WebApi`) từ `NotificationHub` (`Infrastructure`), gây lỗi vi phạm Clean Architecture $\to$ Sinh viên tạo interface `ISystemMetricsRecorder` ở `Application` và đăng ký DI tại `Program.cs`. | `a634207` |
| **#03** | Google Antigravity IDE (`Gemini`) | Shared-VPS Deploy Alignment | AI định nghĩa `up -d caddy` và `scp` ghi đè toàn bộ `docker-compose.staging.yml`, có nguy cơ xung đột cổng 80/443 với `treeseo-production-caddy-1` của khách hàng $\to$ Sinh viên loại bỏ container Caddy phụ trong `deploy.sh` & `deploy/workflows/cd-vps.yml`, chỉ cập nhật `backend`, `frontend` và mạng `treeseo-production_edge`. | `706c3ac` |
| **#04** | Google Antigravity IDE (`Gemini`) | Khóa `dev-mock-token` trên Frontend | Backend đã chặn `dev-mock-token:` nhưng `firebase-auth.service.ts` vẫn tự bật `isMockMode = true` khi lỗi quota mà không kiểm tra `!environment.production` $\to$ Sinh viên bổ sung guard Fail-Closed khi `environment.production === true` kèm unit test. | `fix/week6-ux-rbac-stabilization` |

---

## IV. KẾ HOẠCH TUẦN 07 (P8 — BURN-DOWN BẢO MẬT P0 & KIẾN TRÚC)
1. Bổ sung `AddRateLimiter`, `UseHsts` và CORS động trong `Program.cs`; băm Refresh Token bằng SHA-256.
2. Chặn lỗ hổng IDOR `GuestUserId` tại `PublicController.CreateHold`, bổ sung Tenant/RBAC guard cho `PrintDocumentsController` và `AuditLogsController`.
3. Khóa `gitleaks` fail-closed trong CI và đồng bộ bản workflow mới khi có token quyền `workflow`.

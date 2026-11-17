# Báo cáo cá nhân tuần 06 (P7B) — Nguyễn Khôi Nguyên

**Đề tài:** Hotel SaaS Platform v2 (Đề tài 578 — HCMUTE)

**MSSV:** `24TX810011`

**Tài khoản GitHub:** [`khoinguyen1310`](https://github.com/khoinguyen1310)

**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)

**Thời gian báo cáo:** 10/11/2026 – 18/11/2026

**Nhánh:** `fix/week6-ux-rbac-stabilization` $\to$ `develop` $\to$ `main`

**Commits & Pull Requests liên quan:**
- [`a634207`](https://github.com/GinNgo/hotel-saas-v2/commit/a634207) — `feat(ops): add cross-branch isolation e2e tests, k6 load suite, plg observability, and shared-vps ram/rollback optimization` ([PR #23](https://github.com/GinNgo/hotel-saas-v2/pull/23))
- [`4938464`](https://github.com/GinNgo/hotel-saas-v2/commit/4938464) — `fix(observability): scrape backend metrics by hotelsaas-backend-api container name` ([PR #24](https://github.com/GinNgo/hotel-saas-v2/pull/24))
- Cập nhật hoàn thiện Frontend `reports.page.ts` trên nhánh `fix/week6-ux-rbac-stabilization`

---

## 1. Công việc đã thực hiện

Tuần 06 tập trung xử lý các hạng mục kiểm thử hiệu năng k6 và vá toàn diện lỗ hổng bảo mật / dữ liệu giả lập tại phân hệ Báo cáo (Reports) đã phát hiện trong đợt rà soát source code.

### N01 — Chuẩn hóa & Thực thi k6 Load Test (SignalR Hub + VNPay Checkout/IPN)

1. **Tham số hóa kịch bản (`scripts/load-tests/`):**
   - Nâng cấp `signalr-hub.k6.js` và `vnpay-checkout-ipn.k6.js` hỗ trợ 3 cấp độ qua biến `TEST_TIER`:
     - `smoke`: `5 VUs` trong `15s` (SignalR) / `5 req/s` trong `15s` (VNPay).
     - `load`: ramp `5 -> 50 VUs` (SignalR) / `10 -> 40 req/s` (VNPay) trong `60s`.
     - `stress`: ramp `10 -> 150 VUs` (SignalR) / `10 -> 100 req/s` (VNPay) trong `60s`.
   - Loại bỏ hoàn toàn JWT token giả mặc định: hàm `setup()` tự đăng ký tenant/chi nhánh mới, tạo tài khoản lễ tân/đơn giữ phòng thực tế qua API.
   - Bổ sung hàm `warmupSignalRHub()` trước khi đo để tránh sai số biên dịch EF Core / JIT ở những request đầu.
   - Script điều phối `run-load-tests.ps1` (`Protect-SummaryReport`) và `run-load-tests.sh` (`redact_summary_tokens`) tự động thay thế token tạm thời bằng `"<redacted>"` trước khi xuất JSON để bảo đảm an toàn không lộ bí mật trên Git.

2. **Kết quả chạy thực tế (`smoke` tier) & Minh chứng số liệu:**
   - **Phạm vi thực thi thực tế:** Đã chạy thật cấp độ `smoke` trên local API (`http://127.0.0.1:5055`) kết nối PostgreSQL 17 (`localhost:5435`). Hai cấp độ `load` và `stress` đã được kiểm tra hợp lệ cú pháp/kịch bản bằng `k6 inspect`, **chưa bắn trực tiếp lên VPS Staging** (sẽ thực hiện trong đợt nghiệm thu tải NFR Tuần 13 theo lộ trình).
   - **Kết quả SignalR (`signalr-summary-smoke.json`):**
     - `306` VU iterations (`307` WS sessions, `313` HTTP requests): **`1,530 / 1,530` checks PASS (`100.00%`)**, `0%` lỗi HTTP.
     - `signalr_negotiate_duration_ms`: `avg = 1.74ms`, `p(95) = 4.02ms`, `p(99) = 7.06ms` (ngưỡng `< 200ms`).
     - `signalr_join_property_duration_ms`: `avg = 20.17ms`, `p(95) = 33.00ms`, `p(99) = 66.24ms`.
     - Cô lập chéo chi nhánh dưới tải: **`306 / 306` (`100.00%`)** lượt cố tình `JoinProperty(Branch 2)` bị chặn chuẩn `ERR_PROPERTY_FORBIDDEN`.
   - **Kết quả VNPay Checkout & IPN (`vnpay-summary-smoke.json`):**
     - `75` iterations (`230` HTTP requests): **`300 / 300` checks PASS (`100.00%`)**, `0%` lỗi HTTP.
     - `vnpay_create_url_duration_ms`: `avg = 11.03ms`, `p(95) = 16.86ms`.
     - `vnpay_ipn_duration_ms`: `avg = 15.12ms`, `p(95) = 19.75ms`, `p(99) = 82.31ms`.
     - Idempotency IPN dưới tải: **`75 / 75`** (`1` đơn xác nhận `00`, `74` gói tin trùng bị chặn `02`); **`75 / 75`** gói tin giả mạo `vnp_Amount` bị từ chối chuẩn mã `97` (`hotelsaas_vnpay_ipn_total{rsp_code="97"} = 75` trên `/metrics`).
   - Toàn bộ số liệu và đối chiếu `/metrics` đã lưu tại `docs/reports/load-tests/BENCHMARK-SIGNALR-VNPAY-REPORT.md`.

### N02 — Bảo mật & Loại bỏ Dữ liệu Giả ở Phân hệ Báo cáo (`Reports`)

1. **Backend (`ReportsController.cs` & `GetGroupAnalyticsQueryHandler.cs`):**
   - Gắn `[RequirePermission("REPORTS", 1)]` (`PermissionAction.Read`) tại `ReportsController.cs` (dòng 31), chặn nhân viên không có quyền xem báo cáo.
   - Bổ sung kiểm tra `IsTenantWide` trong `GetGroupAnalyticsQueryHandler.cs` (dòng 43–48) và `EnsurePropertyAccess` trong `ReportsController.cs` (dòng 490–501): từ chối `403 Forbidden` nếu nhân viên chỉ được phân công 1 chi nhánh nhưng truy vấn báo cáo cấp tập đoàn hoặc chi nhánh khác.
   - **Xóa bỏ hoàn toàn** logic tự chia tỷ lệ thanh toán giả `0.45m / 0.35m / 0.20m` ở cả `ReportsController.cs` và `GetGroupAnalyticsQueryHandler.cs`; thay thế bằng tổng hợp thực tế theo phương thức thanh toán từ dữ liệu `Payments` (trả `0` nếu chưa thu tiền, được kiểm chứng tự động qua test case `Reports_UncollectedReservations_DoNotSimulateFakePaymentDistribution`).

2. **Frontend (`reports.page.ts` & `reports.page.spec.ts`):**
   - Xóa bỏ toàn bộ dữ liệu fallback giả lập cứng (`totalRevenue: 784000000`, `totalRooms: 25`, `totalRevenue: 493000000`) bên trong các khối xử lý lỗi của `reports.page.ts`.
   - Khi API gặp lỗi, giao diện cập nhật signal báo lỗi trung thực và cung cấp nút thử lại thay vì âm thầm hiển thị số liệu giả.

---

## 2. Kiểm tra và Phần còn lại

- **Kiểm thử tự động:**
  - `CI Pipeline` (Run `44152640902` có PostgreSQL 17): **633/633** Backend tests **PASS** (`541` Application + `1` Domain + `91` WebApi) và **632/632** Frontend Vitest tests **PASS** (`51` files); sau khi bổ sung unit test cho `reports.page.spec.ts` & `firebase-auth.service.spec.ts` trên `fix/week6-ux-rbac-stabilization`, toàn bộ Frontend Vitest đạt **640/640** tests **PASS** (`52` test files).
  - Lưu ý trung thực về môi trường: tại thời điểm chạy local một số phiên bản không bật container PostgreSQL cổng `5435`, chỉ các unit test non-DB (`303/303`) chạy trực tiếp ở local; toàn bộ bộ test tích hợp DB được CI PostgreSQL chạy và xác nhận 100% PASS.
- **Tồn đọng chuyển tiếp theo lộ trình:**
  - Cấp độ tải `load` (50 VUs) và `stress` (100–150 VUs) trên VPS Staging sẽ thực hiện ở Tuần 13 (NFR Stress Test) để đo độ trễ Production/Staging sau khi hoàn tất toàn bộ tối ưu truy vấn SQL ở Tuần 7.
  - Refactor toàn bộ các phép tính còn lại trong `ReportsController.cs` sang thuần MediatR CQRS và bổ sung index DB (`UX_*`) thực hiện ở Tuần 7.

---

## 3. Ghi nhận sử dụng AI (AI Disclosure)

| Lần | Công cụ AI | Nội dung áp dụng | Sai sót thực tế của AI & Cách xử lý | Minh chứng |
| :---: | :--- | :--- | :--- | :---: |
| **#01** | OpenAI Codex / Antigravity IDE | Viết k6 Load Tests cho SignalR & VNPay | AI ban đầu bắn thẳng 150 VUs không ramp-up, dùng token giả `demo-load-test-jwt-token` gây HTTP 401 và không xử lý biên dịch JIT khiến p95 vượt ngưỡng (kèm việc `.NET user-secrets` trỏ DB từ xa làm chậm WAN RTT ~30ms) $\to$ Em tách 3 tier `smoke/load/stress`, thêm `warmupSignalRHub()`, tạo tenant/token thật trong `setup()` và ép biến `ConnectionStrings__DefaultConnection` về local DB khi đo benchmark. | `a634207`, `BENCHMARK-SIGNALR-VNPAY-REPORT.md` |
| **#02** | OpenAI Codex / Antigravity IDE | Rà soát `ReportsController` & `reports.page.ts` | AI trước đó tự tạo tỷ lệ chia thanh toán giả `0.45/0.35/0.20` ở backend, gắn fallback cứng `784000000` ở `reports.page.ts` và thiếu `[RequirePermission("REPORTS", 1)]` $\to$ Em gỡ bỏ toàn bộ số liệu giả ở cả BE lẫn FE, bổ sung kiểm tra quyền và xác nhận bằng test E2E. | `a634207`, `fix/week6-ux-rbac-stabilization` |

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN – BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

# BÁO CÁO TIẾN ĐỘ TUẦN 05 – TUẦN 06 VÀ KHAI BÁO SỬ DỤNG AI

**Đề tài 578:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**GVHD:** Huỳnh Xuân Phụng (phunghx@hcmute.edu.vn)  
**Thời gian báo cáo:** 02/11/2026 – 18/11/2026  
**Kho mã nguồn:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
**Môi trường thử nghiệm:** [luxustay.duckdns.org](https://luxustay.duckdns.org)  
**Mốc chốt báo cáo:** `develop` [c297b58](https://github.com/GinNgo/hotel-saas-v2/commit/c297b58), `main` [5cf0a78](https://github.com/GinNgo/hotel-saas-v2/commit/5cf0a78)

| STT | Họ và tên | MSSV | GitHub |
| :---: | :--- | :--- | :--- |
| 1 | Ngô Võ Tuấn An (Nhóm trưởng) | 24TX810001 | [GinNgo](https://github.com/GinNgo) |
| 2 | Nguyễn Khôi Nguyên | 24TX810011 | [khoinguyen1310](https://github.com/khoinguyen1310) |
| 3 | Trần Trọng Tân | 24TX810025 | [trantrongtan096](https://github.com/trantrongtan096) |

---

## 1. Kết quả công việc tuần 05

### 1.1. Ngô Võ Tuấn An – Xác thực và triển khai

- **Xác thực:** Tích hợp Firebase Phone OTP (Firebase Web SDK `^13.2.0`), Google OAuth và số điện thoại sandbox. Bổ sung migration xác minh tài khoản nhân viên dùng trong quá trình kiểm thử.
- **Triển khai:** Cấu hình GitHub Actions và GHCR để tự động triển khai hệ thống lên VPS.
- **Minh chứng:** [PR #22](https://github.com/GinNgo/hotel-saas-v2/pull/22).

### 1.2. Nguyễn Khôi Nguyên – Hóa đơn và báo cáo

- **N01 – QR hóa đơn:** Em sử dụng QRCoder để sinh mã QR từ `LookupToken` ngay trong backend và nhúng vào PDF, không phụ thuộc dịch vụ tạo QR bên ngoài.
- **N02 – Thanh toán:** Bổ sung `PaymentMethodPreference` để lưu phương thức thanh toán khách đã chọn.
- **N03 – Báo cáo:** Bổ sung bộ lọc theo kỳ hạn và loại phòng.

Các thay đổi được đưa vào [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21).

### 1.3. Trần Trọng Tân – Hoàn tiền và thông báo thời gian thực

Em triển khai quy trình duyệt và xác nhận chi hoàn tiền D23 tại quầy. Để tránh chi trùng khi hai thu ngân cùng thao tác, em sử dụng khóa giao dịch PostgreSQL `pg_advisory_xact_lock`.

Em cũng bổ sung ba sự kiện SignalR theo phạm vi doanh nghiệp và chi nhánh, xây dựng tác vụ nền kiểm tra đơn giữ phòng hết hạn mỗi 15 giây và cập nhật script kiểm thử `verify-signalr-e2e.mjs`.

**Minh chứng:** [Commit f74bb52](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52), [commit tích hợp b553c9b](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b).

---

## 2. Kết quả công việc tuần 06

### 2.1. Ngô Võ Tuấn An – Hạ tầng, kiến trúc và xác thực

- **Giám sát hệ thống:** Triển khai Prometheus, Loki, Promtail và Grafana trên VPS dùng chung; bổ sung bộ lọc log theo doanh nghiệp, chi nhánh và mức độ lỗi.
- **Hạ tầng:** Giới hạn RAM container, bổ sung cơ chế rollback khi triển khai và cấu hình Caddy để không công khai API metrics và Swagger của backend.
- **Kiến trúc và bảo mật:** Tách `ISystemMetricsRecorder` về tầng Application, bổ sung kiểm thử metric và chặn `dev-mock-token:` trên Production/Staging.
- **Tìm kiếm:** Hoàn thiện tìm kiếm theo 34 tỉnh/thành, xác định địa chỉ từ GPS và xử lý lỗi CORS, in ấn.

### 2.2. Nguyễn Khôi Nguyên – Kiểm thử tải và phân quyền báo cáo

**N01 – Kiểm thử tải:** Em chuẩn hóa kịch bản k6 cho SignalR và VNPay theo ba mức smoke, load và stress. Kịch bản sử dụng tài khoản kiểm thử thật, có bước warm-up và che token khi xuất kết quả. Hiện nhóm đã chạy smoke trên Local; hai mức load và stress mới được kiểm tra cấu hình bằng `k6 inspect`, chưa chạy trên Staging.

**N02 – Bảo mật báo cáo:** Em bổ sung quyền `REPORTS:Read` và kiểm tra phạm vi doanh nghiệp, chi nhánh tại backend. Các tỷ lệ thanh toán và số liệu báo cáo giả được loại bỏ ở backend và frontend.

### 2.3. Trần Trọng Tân – Kiểm thử bảo mật và Bruno

Trong tuần 06, em tập trung kiểm tra khả năng cách ly dữ liệu giữa các chi nhánh. Bộ `CrossBranchSecurityE2ETests.cs` kiểm tra các trường hợp giả mạo ngữ cảnh chi nhánh, truy cập đặt phòng, thanh toán, báo cáo và truy cập chéo doanh nghiệp bằng HTTP, JWT và PostgreSQL thật. Kết quả sau tích hợp được nhóm ghi nhận là 7/7 bài kiểm thử đạt.

Em bổ sung cấu hình Bruno Staging, không sử dụng token mock và thay các ngày cố định bằng ngày tính tự động. Nhóm cũng xử lý lỗi fixture hoàn tiền liên quan đến mốc 22:00 giờ Việt Nam tại [PR #26](https://github.com/GinNgo/hotel-saas-v2/pull/26).

---

## 3. Kết quả kiểm thử và triển khai

Kết quả dưới đây được tổng hợp từ báo cáo và minh chứng CI/CD của nhóm.

| Hạng mục | Tuần 05 | Tuần 06 |
| :--- | :--- | :--- |
| Backend | 600/600 PASS | 633/633 PASS ([CI PR #26](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152640902)) |
| Frontend | 628/628 PASS (51 file) | 632/632, sau đó 640/640 PASS (52 file, [CI PR #27](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213642)) |
| CI Isolation Gate | 35/35 PASS | 7/7 HTTP E2E + bộ unit/integration cô lập PASS |
| Triển khai VPS | [Success (PR #22)](https://github.com/GinNgo/hotel-saas-v2/actions/runs/43021042865) | [PR #26](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152641100) (4m08s), [PR #27](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213609), [PR #28](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44186521915) đều Success |

Trong Tuần 06, bộ kiểm thử tự động xác nhận 7/7 bài kiểm thử cô lập chéo chi nhánh đạt, 15/15 bài kiểm thử hoàn tiền đạt và 17 trường hợp kiểm thử liên quan đến metric và logging.

### 3.1. Kiểm thử hiệu năng k6 trên Local (smoke)

| Chỉ số | SignalR | VNPay |
| :--- | :--- | :--- |
| Checks thành công | 1.530/1.530 (100%) | 300/300 (100%) |
| P95 | Negotiate: 4,02 ms; Join: 33,00 ms | IPN: 19,75 ms |
| Kiểm tra bảo mật và nghiệp vụ | Chặn chéo chi nhánh: 306/306 | Chống trùng: 75/75; chặn giả số tiền: 75/75 |
| Lỗi HTTP 5xx | 0 | 0 |

Kết quả này chỉ phản ánh mức smoke trên Local, chưa xác nhận khả năng chịu tải trên VPS.

### 3.2. Triển khai và bảo mật

Theo kết quả kiểm tra của nhóm sau khi triển khai trên [luxustay.duckdns.org](https://luxustay.duckdns.org), các endpoint kiểm tra tình trạng hệ thống (`/health`, `/health/ready`) và `/grafana/api/health` trả HTTP 200; API `/metrics` và `/swagger` của backend bị chặn từ bên ngoài qua Caddy.

Các workflow CI/CD của Tuần 06 ([CI PR #26](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44152640902), [CI PR #27](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44169213642), [CI PR #28](https://github.com/GinNgo/hotel-saas-v2/actions/runs/44186522037)) đều hoàn thành các bước build và kiểm thử Backend, Frontend. Nhóm sẽ tiếp tục rà soát Security Scan trong tuần tiếp theo.

---

## 4. Khai báo sử dụng AI

Chi tiết khai báo theo biểu mẫu: [KHAI-BAO-AI-TUAN-05-06-DE-TAI-578.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/KHAI-BAO-AI-TUAN-05-06-DE-TAI-578.md).

### 4.1. Ngô Võ Tuấn An (24TX810001)

- **Công cụ AI:** Google Antigravity IDE (Gemini 3.8 Flash).
- **Nội dung prompt:** Tích hợp Firebase OTP, Google OAuth, CI/CD; thiết lập hệ thống giám sát PLG, ghi nhận metric và bảo mật xác thực.
- **Sai sót:** AI sử dụng SMS thật gây cạn quota, cấu hình trùng Caddy, tạo phụ thuộc sai giữa các tầng và cho phép frontend bật mock mode trên môi trường thật.
- **Phần chỉnh sửa:** Bổ sung sandbox OTP và migration cho tài khoản kiểm thử, chuyển build Docker lên GitHub Actions/GHCR, điều chỉnh mạng Docker và giới hạn truy cập Grafana. Tách interface ghi metric, bổ sung guard chặn mock mode và kiểm thử.

### 4.2. Nguyễn Khôi Nguyên (24TX810011)

- **Công cụ AI:** OpenAI Codex (GPT-6 Astra).
- **Nội dung prompt:** Tạo QR cho PDF, bổ sung bộ lọc báo cáo, xây dựng kịch bản k6 và kiểm tra phân quyền báo cáo.
- **Sai sót và phần chỉnh sửa:** AI đề xuất dịch vụ tạo QR bên ngoài nên em chuyển sang QRCoder in-memory. Kịch bản k6 ban đầu thiếu ramp-up, dùng JWT giả và chưa warm-up; em chia lại ba mức tải, sử dụng tenant kiểm thử thật, kết nối database Local và che token. Em cũng bổ sung kiểm tra quyền và bỏ các số liệu báo cáo giả.

### 4.3. Trần Trọng Tân (24TX810025)

**Công cụ AI:** Google Antigravity IDE (Gemini 4 Neon) và OpenAI Codex (GPT-6 Astra).

**Nội dung prompt:** Xây dựng quy trình D23, thông báo SignalR, tác vụ xử lý đơn hết hạn, kiểm thử E2E chéo chi nhánh và Bruno Staging.

Trong quá trình rà soát, em phát hiện phần xử lý ban đầu cộng khoản hoàn vào doanh thu, chỉ dùng khóa trong bộ nhớ và kiểm tra hết hạn ở frontend. Em điều chỉnh cách tính thu/chi, sử dụng khóa PostgreSQL kết hợp kiểm thử đồng thời và chuyển việc xử lý hết hạn về backend.

Em cũng sửa các kịch bản E2E sử dụng sai route hoặc mock ngữ cảnh tenant, chuyển sang kiểm thử bằng JWT và PostgreSQL thật, đồng thời thay ngày cố định trong Bruno bằng ngày tính tự động.

---

## 5. Minh chứng GitHub

| Tuần | Pull request | Nội dung |
| :---: | :--- | :--- |
| 05 | [#21](https://github.com/GinNgo/hotel-saas-v2/pull/21) | Hóa đơn QR và báo cáo |
| 05 | [#22](https://github.com/GinNgo/hotel-saas-v2/pull/22) | Xác thực, D23, SignalR và tích hợp |
| 06 | [#23](https://github.com/GinNgo/hotel-saas-v2/pull/23) | E2E, k6, PLG, metric và RBAC |
| 06 | [#24](https://github.com/GinNgo/hotel-saas-v2/pull/24), [#25](https://github.com/GinNgo/hotel-saas-v2/pull/25) | Hạ tầng VPS và giám sát |
| 06 | [#26](https://github.com/GinNgo/hotel-saas-v2/pull/26) | Sửa fixture hoàn tiền |
| 06 | [#27](https://github.com/GinNgo/hotel-saas-v2/pull/27) | Guard OTP, báo cáo và Bruno |
| 06 | [#28](https://github.com/GinNgo/hotel-saas-v2/pull/28) | Tìm kiếm theo tỉnh/thành và GPS |

---

## 6. Kế hoạch thực hiện tuần 07

| Thành viên | Công việc dự kiến |
| :--- | :--- |
| Ngô Võ Tuấn An | Rà soát bảo mật P0/P1, chuẩn hóa kiến trúc, tiếp tục xác thực và Governance/PMS. |
| Nguyễn Khôi Nguyên | Hoàn thiện hóa đơn, khuyến mãi, báo cáo và cấu hình k6; bỏ secret mặc định. |
| Trần Trọng Tân | Rà soát buồng phòng, hoàn tiền; xây dựng Playwright E2E và ma trận phân quyền. |

Nhóm tiếp tục xử lý các vấn đề bảo mật, xác nhận trạng thái tích hợp và chuẩn bị kiểm thử load/stress trên Staging.

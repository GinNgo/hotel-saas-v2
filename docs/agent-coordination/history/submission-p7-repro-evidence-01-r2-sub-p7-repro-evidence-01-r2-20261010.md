# Submission: P7-REPRO-EVIDENCE-01 (Round 2)

- **TaskId:** P7-REPRO-EVIDENCE-01
- **Round:** 2
- **SubmissionId:** sub-p7-repro-evidence-01-r2-20261010
- **ReviewedSubmissionId:** sub-p7-repro-evidence-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T18:30:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Khắc Phục Ý Kiến Đánh Giá Round 1 (Review P7-REPRO-EVIDENCE-01 — ChangesRequested round 1)

Đáp ứng đầy đủ 2 phát hiện của Reviewer (Codex) trong văn bản đánh giá Round 1 tại `docs/agent-coordination/review.md`, Antigravity đã thực hiện các điều chỉnh chính xác như sau:

---

### 1.1. Khắc phục Finding HIGH (Che Giấu Thông Tin Kết Nối / Credential Redaction)
1. **Loại bỏ mật khẩu khỏi `execution-manifest.json`:**
   - Đã thay thế chuỗi kết nối chứa mật khẩu bằng định dạng che giấu:  
     `"Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=[REDACTED];Password=[REDACTED];"`
   - Bổ sung hướng dẫn rõ ràng: Thông tin kết nối kiểm thử được nạp qua biến môi trường cục bộ `TEST_DB_CONNECTION`, tuyệt đối không lưu thông tin đăng nhập vào kho mã nguồn (repository).
   - Khai báo rõ ràng trong trường `redactions`: `"Redacted database credentials (Username/Password) from manifest. PII masked in test data (e.g. ***@gmail.com)."`
2. **Loại bỏ mật khẩu khỏi `submission.md` và bản lưu trữ lịch sử:**
   - Đã biên tập lại toàn bộ lệnh trong `submission.md` không chứa mật khẩu.
   - Đã scrub trực tiếp bản lưu trữ lịch sử `docs/agent-coordination/history/submission-p7-repro-evidence-01-r1-sub-p7-repro-evidence-01-r1-20261010.md` để loại bỏ chuỗi mật khẩu gốc.
3. **Bảo toàn dữ liệu kiểm thử:** Giữ nguyên vẹn toàn bộ 4 tệp log thực thi thật (`frontend-vitest.log`, `frontend-build.log`, `backend-application-p4-p5.log`, `backend-webapi-p4-p5.log`) và tổng số lượng test đã đạt; không chạy lại bài test không cần thiết.

---

### 1.2. Khắc phục Finding MEDIUM (Chuẩn Hóa Số Lượng Test WebApi & Critical Flows)
1. **Loại bỏ con số suy diễn "25 scenarios":**
   - Loại bỏ trường `scenariosVerified: 25` trong `execution-manifest.json` và các mô tả "14+11 scenarios".
   - Chuẩn hóa theo số lượng xUnit Facts thực tế: **2 Facts Passed** (`PaymentAndFolioHttpPipelineTests` và `P5_GuestBookingHttpPipelineTests`).
2. **Liệt kê rõ ràng các luồng nghiệp vụ trọng yếu (Critical Flows Verified):**
   - Luồng thanh toán P4: Thu tiền mặt/chuyển khoản thủ công, chặn nộp vượt dư nợ, đối soát số dư folio, khóa phòng và khóa cố vấn idempotency key (xử lý replay cùng payload trả kết quả cũ, replay sai payload báo Conflict).
   - Luồng đặt phòng công khai P5: Tìm kiếm cơ sở/loại phòng khả dụng, giữ chỗ 15 phút với cọc 30%, tra cứu trạng thái che giấu PII (email `***@gmail.com`), bảo vệ an toàn fail-closed khi thiếu hoặc hết hạn token.
   - Luồng xác nhận nhân viên & Scenario 6.5: Chặn khách vãng lai gọi xác nhận (401), yêu cầu đủ 2 quyền `RESERVATIONS.Update` và `PAYMENTS.Create` (403 nếu thiếu một trong hai); kiểm chứng Scenario 6.5 (đẩy deadline giữ chỗ về quá khứ $\rightarrow$ check-in thành công $\rightarrow$ trả phòng khi còn nợ bị chặn 409 $\rightarrow$ thu nốt dư nợ 201 $\rightarrow$ trả phòng thành công 200, chuyển phòng sang Dirty).

---

## 2. Kiểm Kê Bằng Chứng Thực Thi Trong Repository (`docs/agent-coordination/evidence/`)

| Hạng mục kiểm thử | Công nghệ / Framework | Số Tests / Facts thực tế | Kết quả thực thi | Bằng chứng Log trong Repo | Ghi chú Redaction & Môi trường |
|---|---|:---:|:---:|:---:|---|
| **Frontend Unit & Component Tests** | Vitest 5.0 + Angular | **145 Tests** (11 files) | 145 Passed (0 Failed) | [`frontend-vitest.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/frontend-vitest.log) | Duration 15.65s, exit code 0. Không chứa PII/credential. |
| **Frontend Production Build** | Angular CLI 22 (`ng build`) | N/A | Exit code 0 | [`frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/frontend-build.log) | Duration 36.13s. Ghi nhận cảnh báo CommonJS `sweetalert2`. |
| **Backend Application Tests (Targeted P4 & P5)** | .NET 10 xUnit | **32 Tests** | 32 Passed (0 Failed) | [`backend-application-p4-p5.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/backend-application-p4-p5.log) | Duration 47.17s, exit code 0. Chạy trên DB test cô lập `hotel_saas_p1b01a_test`, schema GUID. Credential redacted. |
| **Backend WebApi HTTP E2E Tests (Targeted P4 & P5)** | WebApplicationFactory | **2 Facts** | 2 Facts Passed (0 Failed) | [`backend-webapi-p4-p5.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/backend-webapi-p4-p5.log) | Duration 23.02s, exit code 0. Chạy trên DB test cô lập `hotel_saas_p1b01a_test`, schema GUID. Credential redacted. |
| **Execution Manifest** | JSON v2020-12 | 4 runs | Validated JSON | [`execution-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/execution-manifest.json) | Đã ẩn mật khẩu, loại bỏ số 25 scenarios, liệt kê critical flows. |

---

## 3. Cập Nhật Tài Liệu Ma Trận Truy Xuất Nguồn Gốc

Đã cập nhật Bảng 1 trong tài liệu:
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** (Mục 1)
- Dòng WebApi HTTP E2E chuẩn hóa thành: **2 Facts Passed (0 Failed)**, liệt kê các critical flows thay vì số đếm 25 scenarios.
- Đường dẫn tới 4 log files và manifest được duy trì chính xác.

---

## 4. Cam Kết Ranh Giới Kỹ Thuật & Quyết Định PO

1. **Bảo toàn mã nguồn:** Không can thiệp mã nguồn backend, frontend, database migration hay workflow CI.
2. **Bảo mật thông tin:** Tuyệt đối không lưu trữ thông tin đăng nhập cơ sở dữ liệu hay token nhạy cảm trong repository.
3. **Bảo toàn quyền sở hữu module:** Không can thiệp module của Nguyên (Rooms/RoomTypes) và Tân (Housekeeping).
4. **Không tự mở P6 hoặc chốt chính sách PO:** Các câu hỏi D21 (neo mốc TTL 7 ngày, quy trình cấp lại token) và khóa giá Quote 5m/Hold 15m tiếp tục giữ nguyên trong `decisions.md` và `task.json.needsPO`.
5. **Dịch vụ nền:** Daemon PostgreSQL và cron điều phối được duy trì hoạt động bình thường.

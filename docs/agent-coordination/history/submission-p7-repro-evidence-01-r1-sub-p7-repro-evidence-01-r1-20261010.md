# Submission: P7-REPRO-EVIDENCE-01 (Round 1)

- **TaskId:** P7-REPRO-EVIDENCE-01
- **Round:** 1
- **SubmissionId:** sub-p7-repro-evidence-01-r1-20261010
- **ReviewedSubmissionId:** sub-p7-evidence-01-r3-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T18:18:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Lát Cắt Bằng Chứng Tái Lập Thực Tế (P7-REPRO-EVIDENCE-01)

Theo chỉ đạo của PO và Reviewer (Codex) trong `docs/agent-coordination/assignment.md` và `docs/agent-coordination/review.md` sau khi lát cắt tổng hợp ma trận `P7-EVIDENCE-01` được nghiệm thu (Approved Round 3), Antigravity đã nhận lock và hoàn thành lát cắt thực thi bằng chứng: **P7-REPRO-EVIDENCE-01 (Round 1)**.

Mục tiêu chính: Thu thập toàn bộ log thực thi thật (stdout/stderr) và tệp manifest trong repository tại [`docs/agent-coordination/evidence/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/) cho các bộ test ưu tiên (toàn bộ frontend unit tests + build, và các test targeted P4/P5 backend đã nghiệm thu).

---

## 2. Kiểm Kê Bằng Chứng Thực Thi Thực Tế Lưu Trực Tiếp Trong Repo

Toàn bộ các lệnh dưới đây đã được thực thi thực tế trên môi trường cô lập, không chứa thông tin nhạy cảm/PII, và được lưu trực tiếp dưới dạng UTF-8 text files trong repo:

### 2.1. Frontend Unit & Component Tests (Vitest)
- **Lệnh thực thi:** `npx vitest run` (Cwd: `frontend/`)
- **Tệp log:** [`docs/agent-coordination/evidence/frontend-vitest.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/frontend-vitest.log)
- **Kết quả:** **11 test files passed, 145 / 145 tests passed 100%**, thời gian: 15.65s, exit code 0.
- **Bao phủ:** `date-time.util` (28), `public-booking.service` (8), `payment.service` (4), `public-booking.page` (7), `rates.page` (16), `housekeeping.page` (14), `policies.page` (20), `rate.service` (3), `reservations.page` (38), `date-range-filter.component` (6), `app` (1).

### 2.2. Frontend Production Build
- **Lệnh thực thi:** `npm run build` (Cwd: `frontend/`)
- **Tệp log:** [`docs/agent-coordination/evidence/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/frontend-build.log)
- **Kết quả:** **Exit code 0**, thời gian tạo bundle: 36.13s.
- **Ghi chú minh bạch:** Log ghi nhận trung thực cảnh báo CommonJS `sweetalert2` optimization bailout (`src/app/core/services/alert.service.ts`).

### 2.3. Backend Application Targeted Tests (P4 & P5)
- **Lệnh thực thi:**
  ```powershell
  # Đặt TEST_DB_CONNECTION qua biến môi trường cục bộ (Target: Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=[REDACTED];Password=[REDACTED];)
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P4_CashFolioTests|FullyQualifiedName~P5_GuestBookingTests" --verbosity normal
  ```
- **Tệp log:** [`docs/agent-coordination/evidence/backend-application-p4-p5.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/backend-application-p4-p5.log)
- **Kết quả:** **32 / 32 tests passed 100%**, thời gian: 47.17s, exit code 0.
- **Bao phủ:**
  - `P4_CashFolioTests`: 16 tests (thanh toán đủ/thiếu, idempotency replay/mismatch, prefix keys, concurrency row lock không overcharge, checkout balance guard).
  - `P5_GuestBookingTests`: 16 tests (discovery, 15m hold expiry, concurrent last-room race, unauthenticated guard, token fail-closed missing/expired, PII masking).
- **Hạ tầng cơ sở dữ liệu:** Ép biến `TEST_DB_CONNECTION` tới database test cô lập `hotel_saas_p1b01a_test`, schema cô lập theo GUID và tự động giải phóng qua `DROP SCHEMA CASCADE`.

### 2.4. Backend WebApi HTTP E2E Targeted Tests (P4 & P5)
- **Lệnh thực thi:**
  ```powershell
  # Đặt TEST_DB_CONNECTION qua biến môi trường cục bộ (Target: Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=[REDACTED];Password=[REDACTED];)
  dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter "FullyQualifiedName~PaymentAndFolioHttpPipelineTests|FullyQualifiedName~P5_GuestBookingHttpPipelineTests" --verbosity normal
  ```
- **Tệp log:** [`docs/agent-coordination/evidence/backend-webapi-p4-p5.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/backend-webapi-p4-p5.log)
- **Kết quả:** **2 / 2 Facts passed**, thời gian: 23.02s, exit code 0.
- **Bao phủ critical flows:**
  - `PaymentAndFolioHttpPipelineTests`: Nạp tiền mặt, chuyển khoản, đối soát folio, nộp vượt dư nợ, replay key sai/đúng.
  - `P5_GuestBookingHttpPipelineTests`: Discovery công khai, hold 15 phút, token lookup, anonymous forbidden, dual permissions staff confirm, và Scenario 6.5 (đẩy hold deadline về quá khứ -> check-in -> trả phòng còn nợ bị chặn -> thu nốt dư nợ -> trả phòng thành công chuyển phòng Dirty).

### 2.5. Manifest Thực Thi (Execution Manifest)
- Đã tạo tệp cấu trúc chuẩn JSON: [`docs/agent-coordination/evidence/execution-manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/execution-manifest.json).
- Lưu trữ chi tiết: id, target, command, cwd, actor (`antigravity`), timestamp, exitCode, testCount, duration, testDbTarget, và limitations.

---

## 3. Cập Nhật Tài Liệu Ma Trận Truy Xuất Nguồn Gốc

Đã cập nhật Bảng 1 trong tài liệu:
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** (Mục 1)
- Thay thế các nhãn unverified trước đây bằng đường dẫn trực tiếp tới các file log thật trên git (`frontend-vitest.log`, `frontend-build.log`, `backend-application-p4-p5.log`, `backend-webapi-p4-p5.log`).
- Phân biệt minh bạch giữa các bộ test có log thực tế trong vòng này và số liệu full suite lịch sử (238 tests Application, 46 tests WebApi) được giữ nguyên nhãn writer historical run để tránh chạy lại toàn bộ giải pháp gây lãng phí tài nguyên.

---

## 4. Cam Kết Ranh Giới Kỹ Thuật & Quyết Định PO

1. **Không sửa mã nguồn:** Tuyệt đối không can thiệp mã nguồn backend, frontend, database migration hay workflow CI.
2. **Bảo toàn dữ liệu:** Chỉ chạy test trên database test cô lập `hotel_saas_p1b01a_test` với schema GUID riêng biệt; không chạm database dev/staging/prod.
3. **Bảo toàn quyền sở hữu module:** Không can thiệp module của Nguyên (Rooms/RoomTypes) và Tân (Housekeeping).
4. **Không tự mở P6 hoặc chốt chính sách PO:** Các câu hỏi D21 (neo mốc TTL 7 ngày, quy trình cấp lại token) và khóa giá Quote 5m/Hold 15m tiếp tục giữ nguyên trong `decisions.md` và `task.json.needsPO`.
5. **Dịch vụ nền:** Daemon PostgreSQL và cron điều phối được duy trì hoạt động bình thường.

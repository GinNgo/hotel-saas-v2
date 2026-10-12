# Submission: P7-EVIDENCE-01 (Round 1)

- **TaskId:** P7-EVIDENCE-01
- **Round:** 1
- **SubmissionId:** sub-p7-evidence-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T17:28:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Lát Cắt Bằng Chứng & Ma Trận Truy Xuất Nguồn Gốc (P7-EVIDENCE-01)

Theo chỉ đạo của PO và Reviewer (Codex) trong `docs/agent-coordination/assignment.md` và `docs/agent-coordination/review.md`, Antigravity đã nhận lock và hoàn thành lát cắt **P7-EVIDENCE-01 (Round 1)**.

Hệ thống đã xây dựng tài liệu chính thức:
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)**

Tài liệu cung cấp ma trận truy xuất nguồn gốc (Traceability Matrix) toàn diện và minh bạch cho toàn bộ hệ thống tính đến ngày 10/10/2026:
- **Chuỗi truy xuất nguồn gốc chuẩn:** `Route / Method` $\rightarrow$ `Contract / Quyết định kiến trúc` $\rightarrow$ `Lệnh kiểm thử tái lập` $\rightarrow$ `Bằng chứng thực thi thực tế` $\rightarrow$ `Hạn chế / Tồn đọng (Limitations)`.
- Bao phủ đầy đủ **6 nhóm API nghiệp vụ**:
  1. *Nhóm 1:* Xác thực & Ngữ cảnh Đa Chi Nhánh (P1B-02B — 6 endpoints: register, login, memberships, switch-context, refresh-token, revoke-token).
  2. *Nhóm 2:* Danh Mục Cơ Sở, Chính Sách & Bảng Giá (P2A, P2B-01, P2B-02, ADMIN-HK-PAGING-01 — policies, room types, rates, rooms, patch status housekeeping).
  3. *Nhóm 3:* Tính Giá & Đặt Phòng Nội Bộ (P3-BOOKING-CORE-01 — quotes, availability, create reservation, list/detail).
  4. *Nhóm 4:* Vòng Đời Lưu Trú FSM (P3-STAY-LIFECYCLE-01 — check-in, check-out, cancel).
  5. *Nhóm 5:* Thu Tiền Thủ Công, Quản Lý Folio & Công Nợ (P4-CASH-FOLIO-01 — get folio balance, create cash/bank transfer payment, settle before checkout).
  6. *Nhóm 6:* Đặt Phòng Trực Tuyến Ẩn Danh, Giữ Chỗ & Xác Nhận Cọc (P5-GUEST-BOOKING-01 — public properties, room types, availability, quote calculator, hold 15m, lookup token fail-closed, staff confirm dual permissions).

---

## 2. Bằng Chứng Thực Nghiệm & Số Liệu Kiểm Thử Tự Động Toàn Hệ Thống

Toàn bộ các bộ test tự động đã được thực thi và kiểm chứng trực tiếp trên môi trường thực:

### 2.1. Backend Application Integration & Domain Tests
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/
```
**Kết quả thực tế:**
```text
Passed!  - Failed: 0, Passed: 238, Skipped: 0, Total: 238, Duration: 3 m 44 s - HotelSaas.Application.Tests.dll (net10.0)
```
- **238 / 238 tests PASS 100%** trên 13 test files.
- Bao gồm toàn bộ các bài test về domain entity, Global Query Filters, context authorization, pricing calculator, rate overlapping, housekeeping state machine, booking concurrency, stay lifecycle FSM, cash folio, và guest booking.

### 2.2. Backend HTTP Pipeline E2E Tests (WebApplicationFactory)
```powershell
dotnet test backend/tests/HotelSaas.WebApi.Tests/
```
**Kết quả thực tế:**
```text
Passed!  - Failed: 0, Passed: 46, Skipped: 0, Total: 46, Duration: 34 s - HotelSaas.WebApi.Tests.dll (net10.0)
```
- **46 / 46 tests PASS 100%** trên 9 test files chạy với schema PostgreSQL cô lập theo GUID.
- Bao gồm các Facts tích hợp chuỗi kịch bản nghiệp vụ phức tạp:
  - `BootstrapHttpPipelineWebApplicationFactoryTests`: 12 scenarios
  - `BookingHttpPipelineTests`: 12 scenarios
  - `StayLifecycleHttpPipelineTests`: 10 scenarios
  - `PaymentAndFolioHttpPipelineTests`: 14 scenarios
  - `P5_GuestBookingHttpPipelineTests`: 11 scenarios (bao gồm Scenario 6.5 post-TTL check-in, thu dư nợ và check-out)

### 2.3. Frontend Unit & Component Tests (Vitest)
```powershell
npx vitest run
```
**Kết quả thực tế:**
```text
 Test Files  11 passed (11)
      Tests  145 passed (145)
   Duration  4.94s
```
- **145 / 145 tests PASS 100%** trên 11 test files Angular 22.

### 2.4. Frontend Production Build
```powershell
npm run build
```
**Kết quả thực tế:**
```text
Application bundle generation complete. [9.796 seconds]
Output location: C:\Dev\hotel-saas-v2\frontend\dist\frontend
Exit code: 0 (0 compilation errors, 0 defects)
```

**Tổng cộng số lượng test tự động:** **429 / 429 Automated Tests PASS 100%** trên toàn dự án.

---

## 3. Phân Biệt Kết Quả Báo Cáo Của Tác Giả vs Thẩm Định Độc Lập Của Reviewer

Tài liệu đã lập bảng đối chiếu chi tiết trong Mục 3 của [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md):
- **Phân định rõ ràng vai trò:** Ghi nhận rành mạch giữa số liệu do Writer báo cáo và kết quả được Reviewer (Codex) chạy lại độc lập trên môi trường sandbox.
- **Phân biệt Fact xUnit vs Kịch bản:** Nêu rõ số lượng xUnit Facts (thường gộp nhiều bước) và số lượng Scenarios thực tế được assert (ví dụ: `P5_GuestBookingHttpPipelineTests` là 1 xUnit Fact nhưng chứa 11 kịch bản kiểm thử riêng biệt).

---

## 4. Kiểm Kê Bằng Chứng Trực Quan (Screenshots Inventory)

- **Ảnh có thật trên ổ đĩa (`docs/team/assets/screenshots/`):**
  - Đăng nhập/Đăng ký: `login.png`, `login-desktop.png`, `login-mobile.png`, `register.png`.
  - Dashboard & Context Switcher: `dashboard.png`, `dashboard-desktop.png`, `dashboard-mobile.png`, `branch-select-desktop.png`, `branch-select-mobile.png`, `qa-branch-badge-mobile.png`.
  - Quản lý Phòng & Loại phòng: `rooms-desktop.png`, `rooms-mobile.png`, `room-types-desktop.png`, `room-types-mobile.png`, `catalog-delete-confirmation.png`, `qa-rooms-360px.png`.
  - Buồng phòng & Phân trang: `housekeeping_pagination.jpg` (artifacts).
  - Datepicker & Modal: `qa-datepicker-popup.png`, `qa-datepicker-mobile-touch.png`, `qa-modal-mobile.png`.
- **Khoảng trống còn thiếu (Gap analysis):**
  - Thiếu ảnh chụp màn hình trực tiếp trên trình duyệt thật cho luồng Đặt phòng Trực tuyến (Public Booking: search, hold instruction, lookup status) và Modal Thu tiền Folio của Lễ tân. Hai nội dung này mới có code giao diện và unit tests, chưa có file ảnh lưu trữ.

---

## 5. Hiện Trạng CI Pipeline & Disaster Recovery

- **CI Workflow (`.github/workflows/ci.yml`):** Đã được cấu hình đầy đủ 4 stages (backend, frontend, security, ci-status). Tuy nhiên, repo hiện tại chưa được kích hoạt GitHub Actions Cloud runner do chưa cấu hình remote secrets; toàn bộ kiểm thử được diễn tập cục bộ (rehearsal) trên môi trường tương thích.
- **Sao lưu / Phục hồi:** Kiểm thử tự động đã kiểm chứng cơ chế giải phóng schema cô lập (`DROP SCHEMA CASCADE`). Hệ thống chưa có cron script tự động hóa backup `pg_dump` định kỳ lên đám mây, phụ thuộc vào cơ chế backup tiêu chuẩn của hạ tầng PostgreSQL.

---

## 6. Cam Kết Tuân Thủ & Không Bịa Đặt Số Liệu

1. **Không kết luận điểm từ self-assessment:** Khẳng định rõ `rubric-self-assessment.md` chỉ là tài liệu nháp tự đánh giá, không phải điểm chính thức.
2. **Không bịa số liệu:** Thừa nhận rõ ràng chưa có khảo sát SUS trên người dùng thật (0 users), chưa có báo cáo SonarQube CI Cloud, chưa deploy staging/production.
3. **Bảo toàn cơ sở dữ liệu:** Tuyệt đối không chạy migration hoặc can thiệp database dev/prod (`hotel_saas_dev`).
4. **Không làm trùng công việc:** Không chỉnh sửa bất kỳ module nào thuộc quyền sở hữu của Nguyên (Rooms/RoomTypes accessibility/responsive) hoặc Tân (Housekeeping empty/error/loading).
5. **Duy trì dịch vụ nền:** Daemon PostgreSQL (5432, `task-7660`) và cron điều phối (`task-12898`) tiếp tục vận hành bình thường.

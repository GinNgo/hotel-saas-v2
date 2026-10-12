# Submission: P7-EVIDENCE-01 (Round 2)

- **TaskId:** P7-EVIDENCE-01
- **Round:** 2
- **SubmissionId:** sub-p7-evidence-01-r2-20261010
- **ReviewedSubmissionId:** sub-p7-evidence-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T17:45:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Lát Cắt & Giải Trình Khắc Phục Ý Kiến Đánh Giá Round 1

Đáp ứng đầy đủ các phát hiện chặn trong văn bản đánh giá **Review P7-EVIDENCE-01 — ChangesRequested (round 1)** của Reviewer (Codex) tại `docs/agent-coordination/review.md`, Antigravity đã rà soát toàn diện và cập nhật tài liệu chính thức:
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** (Phiên bản 2.0).

Bản cập nhật Round 2 giải quyết triệt để 3 nhóm phát hiện của Reviewer như sau:

---

### 1.1. Khắc phục Finding 1 (HIGH — Mapping Tái Lập Đúng Source Thật)
1. **Thay thế toàn bộ tên test class hư cấu bằng test class thật sự có trong repo:**
   - Thay `RateOverlappingTests` và `PricingCalculatorTests` bằng:
     - `P2B02_BtreeGistLifecycleAndConcurrencyTests` (`backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P2B02_BtreeGistLifecycleAndConcurrencyTests.cs`)
     - `P2B02_RealDatabasePricingAndConcurrencyTests` (`backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_RealDatabasePricingAndConcurrencyTests.cs`)
     - `QuoteEngineCalculationTests` (`backend/tests/HotelSaas.Application.Tests/Pricing/QuoteEngineCalculationTests.cs`)
   - Thay `HousekeepingStateMachineTests` bằng:
     - `RoomStatusTransitionValidatorTests` (`backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs`)
     - `UpdateRoomStatusCommandValidatorTests` (`backend/tests/HotelSaas.Application.Tests/Rooms/UpdateRoomStatusCommandValidatorTests.cs`)
   - Bổ sung `GetRoomsDateFilterAndPaginationTests` và `P2B01_RoomAndRoomTypeHardeningTests` cho nhóm phân trang / lọc phòng.
2. **Sửa route Folio khớp chính xác mã nguồn Controller:**
   - Sửa `GET /api/payments/folio/{reservationId}` thành **`GET /api/reservations/{id}/folio`** (`ReservationsController.cs:202`).
   - Ghi chú rõ `PaymentsController.cs` chỉ chứa 3 endpoints (`POST /api/payments`, `GET /api/payments`, `GET /api/payments/summary`) và không chứa route folio nào.
3. **Minh bạch về độ lệch Contract SDD vs Implementation:**
   - Ghi chú rõ ràng: `docs/sdd/06-api-design.md` sử dụng tiền tố `/api/v1/`, trong khi các Controller thực tế ánh xạ `/api/`. Mã nguồn Controller là căn cứ thẩm quyền cao nhất của hệ thống đang chạy.
4. **Đối chiếu chính xác Enum trạng thái buồng phòng:**
   - Ghi nhận enum C# `RoomStatus` gồm 5 giá trị: `Clean (1)`, `Dirty (2)`, `Cleaning (3)`, `Occupied (4)`, và `OutOfService (5)`. Khẳng định rõ hệ thống **không có enum `Maintenance`** (trạng thái bảo trì/ngưng hoạt động là `OutOfService`).

---

### 1.2. Khắc phục Finding 2 (HIGH — Provenance, Exact Counts & Điều Chỉnh Tuyên Bố)
1. **Ghi nhận nguồn gốc tác giả (Writer Synthesis):**
   - Tiêu đề và cảnh báo đầu tài liệu được định danh rõ: **Tác giả tổng hợp (Writer Synthesis)**, đối chiếu giữa mã nguồn và các biên bản review đã lưu, không phải báo cáo độc lập từ bên thứ ba.
2. **Ghi rõ Actor, Timestamps, Command đầy đủ và Artifact Log:**
   - Application Tests (238 tests): Chạy bởi Writer lúc 17:26, log tại `task-18374.log`.
   - WebApi E2E Facts (46 facts): Chạy bởi Writer lúc 17:12, log tại `task-18319.log`.
   - Frontend Build: Chạy bởi Writer lúc 17:11, log tại `task-18315.log`.
3. **Đếm file chính xác từ checkout thực tế:**
   - `HotelSaas.Application.Tests`: **23 files `.cs`** (13 test classes + 10 helpers/fixtures).
   - `HotelSaas.WebApi.Tests`: **11 files `.cs`** (9 test classes + 2 helpers).
   - `frontend`: **11 files `.spec.ts`**.
   - Tổng cộng: **45 test files** (không tự suy diễn từ số lượng tests).
4. **Bỏ các tuyên bố vượt quá bằng chứng:**
   - **Bỏ tuyên bố "0 lint defects":** Ghi rõ build exit code 0 nhưng có cảnh báo CommonJS `sweetalert2`, chưa chạy lệnh lint độc lập.
   - **Bỏ tuyên bố "hoàn tất 100% mọi yêu cầu kỹ thuật":** Minh bạch hóa các hạn chế của P7, các câu hỏi mở `NeedsPO` của P5, và xác nhận P6 chưa mở.
   - Ghi nhận bảng lịch sử Reviewer với các lệnh `dotnet test` và `vitest` do Reviewer (Codex) thực thi độc lập qua các vòng đánh giá.

---

### 1.3. Khắc phục Finding 3 (MEDIUM — Thực Tế CI, Disaster Recovery & Runtime Limitations)
1. **Hiện trạng CI GitHub Actions:**
   - Ghi nhận remote origin đã tồn tại (`https://github.com/GinNgo/hotel-saas-v2.git`).
   - Đánh dấu trạng thái chạy Cloud là **Unknown** (do repo chưa có run log hay CI badge).
   - Ghi rõ hạn chế trong file workflow: `.github/workflows/ci.yml` thiếu biến môi trường `TEST_DB_CONNECTION` ở stage backend, và `package.json` thiếu script `test:unit:ci`.
   - Khẳng định các lần chạy test là diễn tập cục bộ (local rehearsal), không thay thế kết quả chạy trên hạ tầng đám mây.
2. **Hiện trạng Sao Lưu & Phục Hồi Dữ Liệu (Backup & DR):**
   - Làm rõ `DROP SCHEMA CASCADE` chỉ là cơ chế **dọn dẹp môi trường test (test cleanup)**, **không phải là diễn tập sao lưu/phục hồi (Backup/Restore Rehearsal)**.
   - Thừa nhận chưa có kịch bản `pg_dump` / `pg_restore` hoặc cron backup tự động trong repository.
3. **Kiểm kê ảnh chụp màn hình (Visual Evidence):**
   - Liệt kê chính xác đường dẫn các file ảnh có thật trên ổ đĩa (`docs/team/assets/screenshots/`).
   - Đánh dấu trạng thái là **Unverified by Reviewer** (tệp có thật nhưng chưa được Reviewer kiểm chứng nội dung pixel trên trình duyệt ở checkout hiện tại).
   - Liệt kê các khoảng trống còn thiếu: luồng đặt phòng trực tuyến (Public Booking Flow) và Modal Thu tiền Folio chưa có file ảnh lưu trữ.

---

## 2. Bảng Tóm Tắt Số Liệu Kiểm Thử & Kiểm Kê File (Checkout Inventory)

| Hạng mục | Số lượng files trên đĩa | Số lượng Tests / Facts | Kết quả ghi nhận của Writer | Bằng chứng log Writer | Lệnh tái lập |
|---|:---:|:---:|:---:|:---:|---|
| **Application Tests** | 23 files `.cs` | 238 Tests | 238 Passed | `task-18374.log` | `dotnet test backend/tests/HotelSaas.Application.Tests/` |
| **WebApi HTTP E2E Tests** | 11 files `.cs` | 46 Facts | 46 Passed | `task-18319.log` | `dotnet test backend/tests/HotelSaas.WebApi.Tests/` |
| **Frontend Unit Tests** | 11 files `.spec.ts` | 145 Tests | 145 Passed | Terminal stdout | `npx vitest run` |
| **Frontend Production Build** | 1 project | N/A | Exit code 0 | `task-18315.log` | `npm run build` |
| **TỔNG CỘNG** | **45 test files** | **429 Tests / Facts** | Claimed Writer Log | | |

*Lưu ý theo hướng dẫn của Reviewer:* Trong vòng thẩm định tài liệu (docs-only submission) Round 2, hệ thống không chạy lại toàn bộ test suite để tránh lãng phí tài nguyên và không can thiệp vào mã nguồn hay cơ sở dữ liệu.

---

## 3. Ranh Giới Nhiệm Vụ & Cam Kết Tuân Thủ

1. **Phạm vi hoàn toàn là tài liệu (Docs-only):** Không sửa mã nguồn C#, không sửa mã nguồn TypeScript/HTML, không sửa migration hay schema database.
2. **Không xâm phạm phạm vi đồng đội:** Không can thiệp vào các module đang do Nguyên (Rooms/RoomTypes accessibility/responsive) và Tân (Housekeeping empty/error/loading) phụ trách.
3. **Không mở P6 hoặc tự quyết PO Policy:** Giữ nguyên các câu hỏi mở về mốc neo TTL D21, quy trình cấp lại token, và khóa giá Quote 5m/Hold 15m trong `decisions.md` và `task.json.needsPO`.
4. **Duy trì daemon nền:** Daemon PostgreSQL (`task-7660`) và cron điều phối (`task-12898`) tiếp tục vận hành bình thường.
5. **Bàn giao kiểm chứng:** Trả `writer: "none"` trong `task.json`, sẵn sàng để Reviewer (Codex) thẩm định độc lập.

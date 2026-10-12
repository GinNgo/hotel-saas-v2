# Submission: P7-EVIDENCE-01 (Round 3)

- **TaskId:** P7-EVIDENCE-01
- **Round:** 3
- **SubmissionId:** sub-p7-evidence-01-r3-20261010
- **ReviewedSubmissionId:** sub-p7-evidence-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T17:57:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Khắc Phục Ý Kiến Đánh Giá Round 2 (Review P7-EVIDENCE-01 — ChangesRequested round 2)

Antigravity đã tiếp thu đầy đủ ý kiến đánh giá từ Reviewer (Codex) và cập nhật tài liệu chính thức:
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** (Phiên bản 3.0).

Bản cập nhật Round 3 giải quyết chính xác các phát hiện còn lại của Reviewer:

---

### 1.1. Khắc phục Finding HIGH (Provenance Reviewer IDs, History References & Log Verification)
1. **Khôi phục toàn bộ Submission ID chính xác từ hồ sơ `review.md`:**
   - `ADMIN-HK-PAGING-01`: Đã sửa thành `sub-admin-hk-paging-01-r2-20261010` (tiêu đề tại dòng 553, lệnh `vitest housekeeping.page.spec.ts` 14/14 PASS).
   - `P2-PRICING-HARDEN-01`: Đã sửa thành `sub-p2-pricing-harden-01-r1-20261010` (tiêu đề tại dòng 524, lệnh `dotnet test` Pricing 25/25, WebApi 42/42).
   - `P2-POLICY-UI-01`: Đã sửa thành `sub-p2-policy-ui-01-r2-20261010` (tiêu đề tại dòng 470, lệnh `vitest` 69/69, Policies 20/20, `npm run build` exit 0).
   - `P2-RATES-UI-01`: Đã sửa thành `sub-p2-rates-ui-01-r2-20261010` (tiêu đề tại dòng 418, lệnh `vitest` 88/88, Rates 16 + service 3).
   - `P3-BOOKING-CORE-01`: `sub-p3-booking-core-01-r3-20261010` (tiêu đề tại dòng 333, `vitest` 18/18, WebApi 1/1 Fact).
   - `P3-STAY-LIFECYCLE-01`: `sub-p3-stay-lifecycle-01-r2-20261010` (tiêu đề tại dòng 274, `vitest` 29/29, Application 12/12, WebApi 1/1 Fact).
   - `P4-CASH-FOLIO-01`: `sub-p4-cash-folio-01-r3-20261010` (tiêu đề tại dòng 174, `vitest` 42/42, Application 16/16, WebApi 2/2 Facts).
   - `P5-GUEST-BOOKING-01`: `sub-p5-guest-booking-01-r4-20261010` (tiêu đề tại dòng 51, WebApi 1/1 Fact, Application 16/16).
2. **Minh bạch các hàng P1:**
   - Các hàng P1A, P1B-01B, P1B-02B được ghi nhận rõ: **"Chưa có record trong review.md (Unverified)"** (do các phân kỳ này diễn ra trước khi thiết lập cơ chế lưu trữ lịch sử review trong `review.md`), tuyệt đối không tự tạo Submission ID.
3. **Minh bạch về Artifact Log của Writer:**
   - Các file log cục bộ của Writer (`task-18374.log`, `task-18319.log`, `task-18315.log`) là log thực thi ngoài repo; trong tài liệu ma trận đã chuyển toàn bộ sang nhãn **"Writer claimed / Unverified in repository"** để đảm bảo tính khách quan.

---

### 1.2. Khắc phục Finding MEDIUM (Kiểm Kê File, Fact vs Theory, DB Conflict Assertion & Controller Line Numbers)
1. **Kiểm kê tệp mã nguồn test chính xác theo checkout:**
   - `HotelSaas.Application.Tests`: **23 files `.cs`** (gồm 20 files `*Tests.cs` + 1 `UnitTest1.cs` + 2 helper files `PostgresExtensionLifecycleHelper.cs`, `PostgresTestDatabaseGuard.cs`).
   - `HotelSaas.WebApi.Tests`: **11 files `.cs`** (gồm 10 files `*Tests.cs` + 1 `UnitTest1.cs`).
   - `frontend`: **11 files `.spec.ts`**.
   - Tổng cộng: **45 source test files** (34 `.cs` + 11 `.spec.ts`).
2. **Làm rõ nhãn Tests (Facts & Theories):**
   - 46 tests của WebApi được ghi nhận gồm cả xUnit **Facts** và **Theories**, trong đó các Fact tích hợp chứa nhiều scenarios tuần tự. Tổng 429 tests được định danh là **"Writer claimed / Unverified by Reviewer"**.
3. **Tách bạch Validator vs DB Conflict trong Buồng Phòng:**
   - Endpoint `PATCH /api/rooms/{id}/status`:
     - Tầng Validator: `RoomStatusTransitionValidatorTests` & `UpdateRoomStatusCommandValidatorTests` (kiểm tra tính hợp lệ của chuyển đổi FSM giữa Clean, Dirty, Cleaning, Occupied, OutOfService).
     - Tầng DB Conflict: `P2B01_RoomAndRoomTypeHardeningTests` (`backend/tests/HotelSaas.Application.Tests/Rooms/P2B01_RoomAndRoomTypeHardeningTests.cs`) (assert xung đột cập nhật lạc quan tại database khi `ExpectedOldStatus` bị stale).
4. **Đối chiếu chính xác số dòng khai báo Action trong các Controller:**
   - `AuthController.cs`: `Register:41`, `Login:62`, `RefreshToken:83`, `RevokeToken:104`, `SwitchContext:127`, `GetMyMemberships:149`.
   - `PublicController.cs`: `GetProperties:43`, `GetPropertyBySlug:55`, `GetRoomTypes:68`, `GetAvailability:81`, `CalculateQuote:104`, `CreateHold:129`, `GetBookingByToken:169`, `ConfirmBooking:184`.
   - `PropertiesController.cs`: `GetPolicies:35`, `UpdatePolicies:50`.
   - `RoomTypesController.cs`: `Create:44`, `GetList:66`, `GetById:87`, `Update:115`, `Delete:145`, `GetRates:161`, `GetRateHistory:179`, `CreateRate:197`.
   - `RoomsController.cs`: `Create:49`, `GetList:80`, `GetById:121`, `Update:149`, `Delete:179`, `UpdateStatus:201`.
   - `QuotesController.cs`: `CalculateQuote:38` (Route là `POST /api/quotes/calculate`).
   - `ReservationsController.cs`: `Create:54`, `GetList:81`, `GetById:102`, `GetAvailability:119`, `CheckIn:141`, `CheckOut:161`, `Cancel:181`, `GetFolio:202`, `ConfirmReservation:221`.
   - `PaymentsController.cs`: `CreatePayment:38`, `GetPayments:80`, `GetPaymentSummary:120`.

---

## 2. Bảng Tóm Tắt Kiểm Kê Mã Nguồn Kiểm Thử Thực Tế

| Nhóm Kiểm Thử | Số lượng tệp mã nguồn (.cs / .spec.ts) | Số Tests (Facts / Theories) | Nguồn thẩm định |
|---|:---:|:---:|---|
| **Application Tests** | 23 files `.cs` (20 `*Tests.cs` + 1 `UnitTest1.cs` + 2 helpers) | 238 Tests | Writer claimed / Unverified in repo |
| **WebApi HTTP E2E Tests** | 11 files `.cs` (10 `*Tests.cs` + 1 `UnitTest1.cs`) | 46 Tests (Facts & Theories) | Writer claimed / Unverified in repo |
| **Frontend Unit Tests** | 11 files `.spec.ts` | 145 Tests | Writer claimed / Unverified in repo |
| **Frontend Production Build** | 1 Angular project | Exit code 0 (Warning `sweetalert2`) | Writer claimed / Unverified in repo |
| **TỔNG CỘNG** | **45 source test files** | **429 Tests / Executions** | **Writer claimed / Unverified by Reviewer** |

---

## 3. Ranh Giới Nhiệm Vụ & Cam Kết Tuân Thủ

1. **Phạm vi tài liệu (Docs-only):** Không can thiệp mã nguồn backend, frontend, database hay migration.
2. **Không xâm phạm phạm vi đồng đội:** Không chỉnh sửa module của Nguyên (Rooms/RoomTypes) và Tân (Housekeeping).
3. **Bảo lưu chính sách PO:** Các câu hỏi về mốc neo TTL D21 và khóa giá Quote 5m/Hold 15m được bảo lưu trong `decisions.md` và `task.json.needsPO`.
4. **Trạng thái dịch vụ nền:** Tác giả ghi nhận daemon PostgreSQL và cron điều phối đang chạy cục bộ; đối với thẩm định độc lập của Reviewer đây là trạng thái unverified.
5. **Bàn giao kiểm chứng:** Chuyển trạng thái `Submitted`, trả `writer: "none"` trong `task.json` để Codex thẩm định độc lập Round 3.

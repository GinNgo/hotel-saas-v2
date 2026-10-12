# Submission: P4-CASH-FOLIO-01 (Round 1)

- **TaskId:** P4-CASH-FOLIO-01
- **Round:** 1
- **SubmissionId:** sub-p4-cash-folio-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T14:18:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng quan Lát cắt Hoàn thành (Scope & Deliverables)

Lát cắt **P4-CASH-FOLIO-01** hoàn thiện toàn diện cơ chế thu tiền mặt và chuyển khoản thủ công (manual cash/transfer collection), quản lý bảng kê công nợ (financial folio balance statement), đối soát lịch sử giao dịch bất biến (immutable audit history), kiểm soát trùng lặp (advisory idempotency locks & row-level locking), và bảng tổng kết thu ngân trong ngày (daily cashier summary dashboard) theo đúng hợp đồng nghiệp vụ và API contract đã duyệt:

1. **Ghi nhận Thanh toán & Đặt cọc Thủ công (`POST /api/payments`):**
   - Hỗ trợ phương thức tiền mặt (`PaymentMethod.Cash = 2`), chuyển khoản (`PaymentMethod.BankTransfer = 3`), và thẻ tín dụng trực tiếp (`PaymentMethod.CreditCard = 4`). Chặn các cổng tự động (`PaymentMethod.VNPay = 1`) trong lát cắt này với mã lỗi `ERR_PAYMENT_METHOD_NOT_SUPPORTED`.
   - Cơ chế phòng vệ kép:
     - **Advisory Idempotency Lock** (`LockIdempotencyKeyAsync` qua hash 64-bit của tenantId + propertyId + idempotencyKey) bảo vệ chống submit đồng thời.
     - **Row-Level Lock** (`LockReservationRowAsync` phát `SELECT 1 FROM reservations WHERE id = ... FOR UPDATE`) bảo vệ chống overpayment khi nhiều nhân viên thu tiền cùng lúc trên một đơn.
   - Guard nghiệp vụ chặt chẽ:
     - Chặn thanh toán số tiền $\le 0$ (`ERR_INVALID_AMOUNT`).
     - Chặn thanh toán vượt quá dư nợ còn lại (`ERR_AMOUNT_EXCEEDS_BALANCE`).
     - Chặn thanh toán trên đơn đã trả đủ 100% (`ERR_FOLIO_ALREADY_PAID`).
     - Chặn thanh toán trên đơn đã bị hủy (`ERR_RESERVATION_CANCELLED`).
     - Tự động chuyển trạng thái đơn đặt phòng từ `PendingPayment` $\to$ `Confirmed` khi ghi nhận khoản thanh toán/cọc hợp lệ đầu tiên.
   - Lưu trữ audit bất biến: bảng `payments` ghi nhận `Id`, `ReservationId`, `Amount`, `Method`, `Status = Completed (2)`, `TransactionRef`, `ProcessedByUserId`, `CreatedAtUtc`.

2. **Bảng kê Công nợ & Đối soát Folio (`GET /api/reservations/{id}/folio`):**
   - Trả về snapshot tài chính tức thời:
     - `TotalAmount`: Tổng tiền phòng snapshot bất biến từ reservation.
     - `PaidAmount`: Tổng thực thu lũy kế từ tất cả các giao dịch thanh toán thành công (`PaymentStatus.Completed`).
     - `RemainingBalance`: Số dư nợ còn lại (`TotalAmount - PaidAmount`).
     - `IsFullyPaid`: `RemainingBalance <= 0`.
     - `Payments`: Danh sách lịch sử giao dịch đã định dạng (`id`, `amount`, `methodName`, `statusName`, `transactionRef`, `createdAtUtc`).
   - Truy vấn độc lập `Room` và `RoomType` theo `RoomId` và `PropertyId`, tránh lỗi mismatch quan hệ navigation EF Core.

3. **Báo cáo Thu ngân trong Ngày (`GET /api/payments/summary`):**
   - Tổng hợp số liệu thu tiền theo ngày (mặc định hôm nay) theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh` UTC+7).
   - Chỉ số KPI: `TotalCollected`, `CashTotal`, `BankTransferTotal`, `CreditCardTotal`, `TransactionCount`, `SuccessfulTransactionCount`.
   - Phục vụ kiểm soát quỹ tiền mặt tại quầy lễ tân khi bàn giao ca trực.

4. **Giao diện Người dùng (Frontend UI Angular 19 Signals):**
   - **Bảng kê Folio & Lịch sử Thu tiền:** Hiển thị trực quan trong modal chi tiết đặt phòng với các thẻ KPI (`Tổng tiền phòng`, `Đã thanh toán`, `Dư nợ còn lại`), badge trạng thái thanh toán, và bảng lịch sử giao dịch.
   - **Form Thu tiền Thủ công tại Quầy:** Cho phép thu tiền mặt/chuyển khoản, nút tiện ích "Thu đủ dư nợ" tự động điền số dư còn lại, validate chặt chẽ không cho nhập quá dư nợ, xử lý loading spinner chống double-submit.
   - **Modal Báo cáo Thu ngân:** Nút "Báo cáo thu ngân" trên thanh tiêu đề mở modal thống kê tổng thu và phân loại theo tiền mặt / chuyển khoản trong ngày theo giờ VN.
   - **Bảo vệ Phân quyền & Cách ly Chi nhánh:** Kiểm soát chặt chẽ bằng `canCreatePayment` (`PAYMENTS:Create`) và `canReadPayment` (`PAYMENTS:Read`). Tự động dọn dẹp state và hủy bỏ request in-flight khi đổi chi nhánh.

---

## 2. Chi tiết File Thay đổi & Bổ sung (Files Implemented)

### 2.1. Backend Domain & Persistence
- [`IApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs): Bổ sung interface `LockReservationRowAsync(Guid reservationId, CancellationToken ct)`.
- [`ApplicationDbContext.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs): Cài đặt `LockReservationRowAsync` sử dụng raw SQL PostgreSQL `SELECT 1 FROM reservations WHERE id = {0} FOR UPDATE`.

### 2.2. Backend Application Layer (`HotelSaas.Application/Payments/`)
- [`PaymentDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/DTOs/PaymentDto.cs): DTO dữ liệu giao dịch thanh toán.
- [`FolioDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs): DTO bảng kê công nợ đặt phòng.
- [`PaymentSummaryDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/DTOs/PaymentSummaryDto.cs): DTO báo cáo tổng kết thu ngân.
- [`CreatePaymentCommand.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs): Command MediatR ghi nhận thanh toán.
- [`CreatePaymentCommandHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs): Xử lý giao dịch với khóa advisory idempotency, khóa dòng reservation, validation overpayment, và auto-confirm.
- [`GetFolioQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQuery.cs): Query lấy bảng kê công nợ folio.
- [`GetFolioQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs): Handler tính toán folio balance và nạp danh sách giao dịch.
- [`GetPaymentsQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetPayments/GetPaymentsQuery.cs) & [`GetPaymentsQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetPayments/GetPaymentsQueryHandler.cs): Query phân trang lịch sử thanh toán theo chi nhánh.
- [`GetPaymentSummaryQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetPaymentSummary/GetPaymentSummaryQuery.cs) & [`GetPaymentSummaryQueryHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Payments/Queries/GetPaymentSummary/GetPaymentSummaryQueryHandler.cs): Query tổng kết thu ngân theo ngày UTC+7.

### 2.3. Backend WebApi Layer
- [`CreatePaymentRequest.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Models/CreatePaymentRequest.cs): Request model tiếp nhận request body HTTP.
- [`PaymentsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs): Controller `POST /api/payments` (`[RequirePermission("PAYMENTS", PermissionAction.Create)]`), `GET /api/payments` (`[RequirePermission("PAYMENTS", PermissionAction.Read)]`), `GET /api/payments/summary` (`[RequirePermission("PAYMENTS", PermissionAction.Read)]`).
- [`ReservationsController.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs): Thêm endpoint `GET /api/reservations/{id}/folio` (`[RequirePermission("PAYMENTS", PermissionAction.Read)]`).

### 2.4. Backend Tests
- [`P4_CashFolioTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs): 10 unit & logic test cases kiểm thử:
  - Tạo thanh toán tiền mặt thành công.
  - Idempotency key lặp lại trả về bản ghi cũ không nhân đôi số tiền.
  - Chặn số tiền không hợp lệ ($\le 0$).
  - Chặn thanh toán vượt quá số dư còn lại (`ERR_AMOUNT_EXCEEDS_BALANCE`).
  - Chặn thanh toán khi folio đã trả đủ (`ERR_FOLIO_ALREADY_PAID`).
  - Chặn phương thức không hỗ trợ (`VNPay` $\to$ `ERR_PAYMENT_METHOD_NOT_SUPPORTED`).
  - Tự động chuyển trạng thái `PendingPayment` $\to$ `Confirmed`.
  - Tính toán folio balance chính xác (`TotalAmount`, `PaidAmount`, `RemainingBalance`, `IsFullyPaid`).
  - Lấy danh sách giao dịch phân trang theo chi nhánh.
  - Tổng hợp báo cáo thu ngân trong ngày múi giờ Việt Nam.
- [`PaymentAndFolioHttpPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/PaymentAndFolioHttpPipelineTests.cs): Test pipeline HTTP end-to-end trên WebApplicationFactory thực tế.

### 2.5. Frontend Implementation & Tests
- [`payment.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/payment.model.ts): Interfaces & Enums cho Folio, Payment, Summary.
- [`payment.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/payment.service.ts): Service gọi API folio, payments, summary.
- [`payment.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/payment.service.spec.ts): 4 unit tests kiểm thử API endpoints.
- [`reservations.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts): Tích hợp Folio UI, Payment Form, và Cashier Summary Modal.
- [`reservations.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.spec.ts): 35 unit tests (trong đó có 6 unit tests chuyên sâu cho Cash & Folio).

---

## 3. Bằng chứng Kiểm thử Độc lập (Independent Test Evidence)

### 3.1. Frontend Vitest Suites (100% PASS, 127/127 tests)
- **Lệnh thực thi:** `npx vitest run` tại `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **127 passed (127), 9 test files, Exit Code: 0**
  - `src/app/features/reservations/reservations.page.spec.ts`: **35/35 tests PASS** (bổ sung tests 26–31 cho Folio loading, overpayment guard, auto-fill remaining balance, cashier summary modal, PAYMENTS permission gate, và branch context reset).
  - `src/app/core/services/payment.service.spec.ts`: **4/4 tests PASS**.
  - `src/app/core/utils/date-time.util.spec.ts`: **28/28 tests PASS**.
  - `src/app/core/services/rate.service.spec.ts`: **3/3 tests PASS**.
  - `src/app/features/policies/policies.page.spec.ts`: **20/20 tests PASS**.
  - `src/app/features/rates/rates.page.spec.ts`: **16/16 tests PASS**.
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **14/14 tests PASS**.
  - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: **6/6 tests PASS**.
  - `src/app/app.spec.ts`: **1/1 test PASS**.

### 3.2. Backend Application Tests (100% PASS, 10/10 P4 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P4"`
- **Kết quả:** **10 passed (10), 0 failed, 0 skipped, Exit Code: 0**

### 3.3. Backend WebApi Pipeline Tests (100% PASS, 45/45 tests)
- **Lệnh thực thi:** `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj`
- **Kết quả:** **45 passed (45), 0 failed, 0 skipped, Exit Code: 0** (bao gồm `PaymentAndFolioHttpPipelineTests`).

---

## 4. Cam kết Kỹ thuật & Ranh giới Phạm vi (Scope Boundaries & Commitments)

- **Không migration, không DML:** Lát cắt tận dụng 100% schema bảng `payments` hiện có trong database; hoàn toàn không sinh thêm migration và không phát lệnh DML trực tiếp trên DB dev/staging/prod.
- **Không gateway tự động (No Automated Gateways):** Không tích hợp VNPay hay Stripe trực tiếp trong lát cắt này; toàn bộ thanh toán là thu tiền mặt/chuyển khoản đối soát thủ công tại quầy.
- **NeedsPO Items:** Các chính sách hoàn tiền (Refunds), hủy cọc (Deposit forfeiture policy), và khấu trừ/điều chỉnh thủ công (Manual folio adjustments) được giữ riêng dưới dạng NeedsPO chờ PO phê duyệt đặc tả kế toán chi tiết.
- **Bảo toàn module đồng đội:** Không can thiệp vào các tệp thuộc phạm vi quản lý của Nguyên (Rooms/RoomTypes) và Tân (Housekeeping).

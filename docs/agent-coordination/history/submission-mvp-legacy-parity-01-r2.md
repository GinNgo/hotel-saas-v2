# Submission MVP-LEGACY-PARITY-01 — Round 2

- **TaskId:** `MVP-LEGACY-PARITY-01`
- **Round:** 2
- **SubmissionId:** `sub-mvp-legacy-parity-01-r2-20261012`
- **ReviewedSubmissionId:** `sub-mvp-legacy-parity-01-r1-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T09:44:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`
- **Kho lưu trữ cũ tham chiếu:** `https://github.com/GinNgo/He-thong-quan-ly-khach-san` (Commit SHA: `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9`).
- **Mã nguồn dự án mới:** `hotel-saas-v2` (`develop`, Commit HEAD: `3f95339b4f4477ac5d421551d372dfdd5ed31e30`).

---

## 1. Giải Trình & Khắc Phục Triệt Để Các Phát Hiện Của Reviewer (Findings Resolution)

Trong Vòng 2, Antigravity đã rà soát và hiệu chỉnh toàn diện báo cáo [`docs/agent-coordination/legacy-parity-01.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/legacy-parity-01.md) theo 4 phát hiện của Codex Reviewer:

### 1.1. Khắc phục Phát hiện 1: [P1] Chuẩn hóa chính xác các trường DTO
- **Đã sửa trong `legacy-parity-01.md` (Mục 2.6 & Mục 4):**
  - Khớp 100% với `PaymentSummaryDto`: `cashCollected`, `bankTransferCollected`, `creditCardCollected`, `totalCollected`, `completedCount` (loại bỏ hoàn toàn các tên bị sai lệch ở Round 1).
  - Khớp 100% với `FolioDto`: `totalAmount`, `paidAmount`, `remainingBalance`, `isFullyPaid`, `payments` (loại bỏ các tên `totalCharges`/`balanceAmount`).
  - Khớp 100% với `PaymentDto`: `amount`, `currency`, `method`, `methodName`, `status`, `statusName`, `transactionRef`, `notes`, `createdAtUtc`.

### 1.2. Khắc phục Phát hiện 2: [P1] Phân định rõ ràng ngữ nghĩa ngày giờ giữa 2 luồng
- **Phân tích bản chất kỹ thuật trong báo cáo:**
  - `GetPaymentSummaryQueryHandler`: Lọc theo ngày địa phương Việt Nam (UTC+7 ngày ranh giới) chuyển sang dải UTC, chỉ tính các thanh toán `Status == PaymentStatus.Completed` căn cứ trên trường `PaidAtUtc`.
  - `GetPaymentsQueryHandler`: Lọc theo tham số `DateFrom`/`DateTo` với mốc bắt đầu tính theo ranh giới chuẩn UTC, căn cứ trên trường `CreatedAtUtc`.
  - Do `PaymentDto` chỉ chứa `createdAtUtc` (không có `paidAtUtc`), danh sách giao dịch không phải là bảng đối soát khớp dòng (không claim shift reconciliation hoặc khớp tổng).
- **Thiết kế giao diện:**
  - Hiển thị 2 khối riêng biệt với tiêu đề rõ ràng:
    - Khối 1: *"Tổng kết Thực thu trong ngày (Giờ Việt Nam - UTC+7)"*.
    - Khối 2: *"Nhật ký Giao dịch (Thời gian ghi nhận - Giờ UTC)"*.
  - Bổ sung văn bản hướng dẫn/cảnh báo (Disclaimer) trên giao diện.
  - Tuyệt đối không thay đổi mã backend hay chính sách ngày giờ (giữ nguyên hợp đồng hiện hữu).

### 1.3. Khắc phục Phát hiện 3: [P2] Ánh xạ chính xác các tuyến đường Public API & Bằng chứng Repo cũ
- **Chuẩn hóa các route thực tế của `PublicController`:**
  - `GET api/public/properties` (hỗ trợ query `search` qua bộ so khớp mờ Fuzzy Matcher)
  - `GET api/public/properties/{slug}`
  - `GET api/public/properties/{slug}/room-types`
  - `GET api/public/properties/{slug}/availability`
  - `POST api/public/quotes/calculate`
  - `POST api/public/bookings/hold`
  - `GET api/public/bookings/{lookupToken}`
- **Ghim chính xác định danh tệp và symbol của mã nguồn bản cũ:**
  - `com.hotel.controllers.AuthController` (`login`, `register`, `refresh`, `logout`, `google`, `facebook`)
  - `com.hotel.controllers.HotelController` (`getHotels`, `getHotelById`, `updateHotel`)
  - `com.hotel.controllers.ReservationController` (`createReservation`, `checkIn`, `checkout`, `cancelReservation`, `markNoShow`)
  - `com.hotel.controllers.PaymentController` (`createPayment`, `getPayments`)
  - `com.hotel.controllers.InvoiceController` (`getInvoice`, `exportInvoice`)
  - `com.hotel.controllers.PropertySearchController` & `PublicDiscoveryController` (`searchProperties`, `getFeaturedHotels`)
  - Frontend: `reservation-management.ts`, `reservation-checkout.component.ts`, `operational-tasks.component.ts`.

### 1.4. Khắc phục Phát hiện 4: [P2] Giới hạn bằng chứng (Bounded Claims) & Kế hoạch Lát cắt CHỈ ĐỌC
- Loại bỏ toàn bộ các khẳng định bao quát ("100% permission scenarios", "full lifecycle parity", "standard Accessibility"). Ghi rõ các giới hạn và đánh dấu **NOT VERIFIED** khi thiếu kiểm chứng độc lập.
- Thiết kế chi tiết kế hoạch lát cắt **`FE-CASHIER-PAYMENTS-01` (CHỈ ĐỌC - READ-ONLY)**:
  - **Phạm vi strictly Read-Only:** Không tạo thanh toán mới, không có entity đóng ca/chốt quỹ, không đối soát ngân hàng, không in hóa đơn, không tạo NoShow API.
  - **Bảo vệ Phân quyền:** Route `/payments` bảo vệ bởi `permissionGuard` với `data: { permission: 'PAYMENTS', action: 1 }` (`PAYMENTS:Read`). Menu item trong `admin-layout.ts` bảo vệ bởi `hasPaymentsPermission()`.
  - **Active Property Pattern:** Gắn kết chặt chẽ với tín hiệu `authService.activePropertyId`.
  - **6 Tiêu chí Chấp nhận Hành vi Kiểm thử (BAC):**
    1. BAC 1: Tách biệt rõ ràng 2 luồng Summary (VN UTC+7) và Payments List (UTC) kèm Disclaimer.
    2. BAC 2: Xử lý đổi chi nhánh và hủy phản hồi trễ (Property-switch stale-response rejection).
    3. BAC 3: Xử lý trạng thái chưa chọn chi nhánh (Absent-property fail-closed).
    4. BAC 4: Kiểm soát từ chối quyền (Permission denial).
    5. BAC 5: Quản lý trạng thái tải/lỗi/trống/thử lại độc lập cho cả 2 luồng (Independent loading/error/empty/retry).
    6. BAC 6: Kiểm thử ranh giới múi giờ (Timezone boundary testing) cho ngày Việt Nam.

---

## 2. Danh Sách Tài Liệu Trình Nộp Round 2

1. [`docs/agent-coordination/legacy-parity-01.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/legacy-parity-01.md) (bản cập nhật Vòng 2 hoàn chỉnh)
2. [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) (hồ sơ giải trình Vòng 2)
3. [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) (cập nhật trạng thái `Submitted`, giải phóng writer lock về `none`)
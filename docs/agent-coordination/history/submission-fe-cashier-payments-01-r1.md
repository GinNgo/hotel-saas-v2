# Submission FE-CASHIER-PAYMENTS-01 — Round 1

- **TaskId:** `FE-CASHIER-PAYMENTS-01`
- **Round:** 1
- **SubmissionId:** `sub-fe-cashier-payments-01-r1-20261012`
- **ReviewedSubmissionId:** null
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T10:02:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tóm Tắt Triển Khai (Executive Summary)

Theo phê duyệt `MVP-LEGACY-PARITY-01` Round 2 và nhiệm vụ `FE-CASHIER-PAYMENTS-01` được giao trong `assignment.md`, Antigravity đã hoàn thành lát cắt giao diện Quản lý Thu ngân & Nhật ký Giao dịch với các đặc tính kỹ thuật cốt lõi:

1. **Phạm vi Strictly READ-ONLY:**
   - Hoàn toàn chỉ thực hiện truy vấn dữ liệu đọc (`GET /api/payments/summary` và `GET /api/payments`).
   - Tuyệt đối không tạo mutation thanh toán mới, không tạo entity chốt ca/đóng quỹ (shift-close), không đối soát ngân hàng/kiểm đếm két, không xuất hóa đơn, không NoShow API.
2. **Triển khai Component Độc lập:**
   - Xây dựng component standalone [`frontend/src/app/features/payments/payments.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/payments/payments.page.ts).
   - Tích hợp tuyến đường `/payments` vào [`frontend/src/app/app.routes.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.routes.ts) bảo vệ bởi `permissionGuard` với quyền `PAYMENTS:Read` (Action mask: 1).
   - Cập nhật [`frontend/src/app/layouts/admin-layout/admin-layout.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/layouts/admin-layout/admin-layout.ts): thay thế nút placeholder roadmap bằng liên kết điều hướng thực tế `routerLink="/payments"` hiển thị có điều kiện qua `hasPaymentsPermission()`.
3. **Bộ Kiểm thử Hành vi Toàn diện (Behavioral Acceptance Criteria Tests):**
   - Xây dựng test suite [`frontend/src/app/features/payments/payments.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/payments/payments.page.spec.ts) gồm 9 unit/behavior tests bao phủ toàn bộ các kịch bản BAC 1 đến BAC 6.
   - Kết quả: **9/9 tests PASS** với Vitest, biên dịch frontend `npm run build` thành công **100% (exit code 0)**.
4. **Bảo toàn Ranh giới Nhóm & 7 Cổng Quyết định PO (PO Gates):**
   - Zero backend C# code changes / Zero database migration or connection.
   - Giữ nguyên vẹn mã nguồn của Nguyên (`Rooms`, `RoomTypes`) và Tân (`Housekeeping`).
   - Bảo toàn toàn bộ 7 PO Gates trong `decisions.md` (`NeedsPO`) và Phase 6 (AI) chưa mở.

---

## 2. Chi Tiết Thực Hiện Các Tiêu Chí Chấp Nhận Hành Vi (BAC 1 - BAC 6)

### BAC 1: Hiển thị Đúng Trường DTO & Phân tách 2 Luồng Dữ liệu
- **Luồng 1 (Tổng kết Thực thu trong ngày):** Sử dụng chính xác các trường của `PaymentSummaryDto`:
  - `totalCollected`: Tổng tiền thực thu.
  - `cashCollected`: Thực thu tiền mặt.
  - `bankTransferCollected`: Thực thu chuyển khoản ngân hàng.
  - `creditCardCollected`: Thực thu thẻ tín dụng/POS.
  - `completedCount`: Số lượng giao dịch thành công.
- **Luồng 2 (Nhật ký Giao dịch):** Sử dụng chính xác các trường của `PaymentDto`:
  - `amount`, `currency`, `method`, `methodName`, `status`, `statusName`, `transactionRef`, `notes`, `createdAtUtc`.
- **Disclaimer Banner Rõ ràng:** Hiển thị thông báo giải thích rõ ràng ngay trên giao diện: Luồng 1 tính theo ngày phát sinh tại Việt Nam (UTC+7, lọc theo `PaidAtUtc` của các giao dịch `Completed`); Luồng 2 hiển thị các bản ghi tạo trên hệ thống theo giờ chuẩn quốc tế UTC (`CreatedAtUtc`). Không khẳng định hai khối khớp dòng đối soát ca trực.

### BAC 2: Chuyển Đổi Chi Nhánh & Chống Phản hồi Muộn (Stale-Response Rejection)
- Khi người dùng chuyển đổi chi nhánh từ Chi nhánh A sang Chi nhánh B (`activePropertyId` thay đổi):
  - Dữ liệu của Chi nhánh A ngay lập tức được dọn sạch (`summary.set(null)`, `payments.set([])`).
  - Gán tăng `requestId` (`summaryRequestId`, `paymentsRequestId`). Mọi phản hồi HTTP đến muộn của Chi nhánh A (kể cả kết quả thành công hay lỗi 403/500) đều bị từ chối/bỏ qua, bảo vệ giao diện không bị nhiễm bẩn dữ liệu chéo giữa các chi nhánh.

### BAC 3: Fail-Closed Khi Thiếu Ngữ cảnh Chi Nhánh
- Khi `activePropertyId` là `null` hoặc rỗng:
  - Hệ thống lập tức fail-closed: xóa toàn bộ dữ liệu đang hiển thị và dừng trạng thái loading.
  - Tuyệt đối **không gửi bất kỳ HTTP request nào** đến máy chủ backend.
  - Hiển thị giao diện hướng dẫn người dùng chọn chi nhánh công tác.

### BAC 4: Kiểm Soát Phân Quyền (PAYMENTS:Read Action Mask 1)
- Tuyến đường `/payments` được bảo vệ bởi `permissionGuard` với `data: { permission: 'PAYMENTS', action: 1 }`.
- Giao diện component kiểm tra phương thức `canReadPayments()`. Khi người dùng không có quyền đọc:
  - Hiển thị cảnh báo phân quyền an toàn, ẩn toàn bộ biểu mẫu và số liệu.
  - Menu điều hướng tại `admin-layout.ts` chỉ hiển thị khi `hasPaymentsPermission()` trả về `true`.

### BAC 5: Trạng thái Tải, Lỗi, Rỗng & Thử lại Độc lập
- Luồng 1 và Luồng 2 có cờ `isLoadingSummary`, `isLoadingPayments`, `summaryError`, `paymentsError` riêng biệt.
- Khi một luồng gặp lỗi (ví dụ HTTP 500 ở Summary), luồng còn lại (Payments List) vẫn hoạt động và hiển thị bình thường.
- Nút "Thử lại" (Retry) của từng luồng chỉ thực hiện tải lại luồng đó mà không làm mất hoặc gián đoạn dữ liệu của luồng bên cạnh.

### BAC 6: Ngữ Nghĩa Ngày Giờ & Ranh Giới Múi Giờ Việt Nam (UTC+7)
- Bộ lọc Luồng 1 mặc định chọn ngày phát sinh tại Việt Nam theo múi giờ `Asia/Ho_Chi_Minh` thông qua helper `getTodayVietnamDateString()`.
- Hàm ánh xạ ranh giới múi giờ kiểm chứng chính xác:
  - Mốc `18:00 UTC` (sau ngưỡng 17:00 UTC) ánh xạ chính xác sang ngày lịch tiếp theo tại Việt Nam (+7 giờ = 01:00 ngày hôm sau).
  - Mốc `10:00 UTC` (trước ngưỡng 17:00 UTC) giữ nguyên cùng ngày lịch tại Việt Nam (+7 giờ = 17:00 cùng ngày).
- Bộ lọc Luồng 2 sử dụng các trường ngày UTC rõ ràng, định dạng thời gian trong bảng có hậu tố `... UTC` minh bạch để nhân viên thu ngân không bị nhầm lẫn.
- Phân trang: Thay đổi bộ lọc hoặc đổi chi nhánh tự động reset `currentPage` về `1`.

---

## 3. Bằng Chứng Kiểm Thử & Biên Dịch (Verification Evidence)

### 3.1. Chạy Kiểm thử Đơn vị Vitest
- **Command:** `node ./node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts`
- **Working Directory:** `C:\Dev\hotel-saas-v2\frontend`
- **Exit Code:** `0`
- **Kết quả:**
  ```text
   RUN  v5.0.3 C:/Dev/hotel-saas-v2/frontend

   ✓ src/app/features/payments/payments.page.spec.ts (9 tests) 34ms
     ✓ BAC 1: should fetch and render actual DTO fields for Summary and Payments list
     ✓ BAC 2: should reject stale response when switching from Property A to Property B
     ✓ BAC 3: should fail-closed when property is absent, clearing data and not calling HTTP
     ✓ BAC 4: should verify PAYMENTS:Read permission through authService
     ✓ BAC 5: summary failure should not prevent payments list from rendering, and retry should recover
     ✓ BAC 6: Timezone Boundary Functions
       ✓ should map 18:00 UTC (after 17:00 UTC boundary) to the next calendar date in Vietnam (UTC+7)
       ✓ should map 10:00 UTC (before 17:00 UTC boundary) to the same calendar date in Vietnam (UTC+7)
       ✓ should format UTC timestamp clearly with explicit UTC suffix
     ✓ should reset currentPage to 1 when filters change or are cleared

   Test Files  1 passed (1)
        Tests  9 passed (9)
     Duration  1.45s
  ```

### 3.2. Biên Dịch Dự Án Frontend (Angular Build)
- **Command:** `npm run build`
- **Working Directory:** `C:\Dev\hotel-saas-v2\frontend`
- **Exit Code:** `0`
- **Kết quả:**
  ```text
  > frontend@0.0.0 build
  > ng build

  Application bundle generation complete. [42.186 seconds]
  Lazy chunk: chunk-BXRTTJMT.js | payments-page | 24.31 kB
  Output location: C:\Dev\hotel-saas-v2\frontend\dist\frontend
  ```

---

## 4. Danh Sách Tệp Thay Đổi

1. [`frontend/src/app/features/payments/payments.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/payments/payments.page.ts) — *Component standalone Quản lý Thu ngân & Nhật ký Giao dịch*.
2. [`frontend/src/app/features/payments/payments.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/payments/payments.page.spec.ts) — *Bộ kiểm thử 9 kịch bản hành vi BAC 1-6*.
3. [`frontend/src/app/app.routes.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.routes.ts) — *Đăng ký route `/payments` có `permissionGuard` (`PAYMENTS:Read` action 1)*.
4. [`frontend/src/app/layouts/admin-layout/admin-layout.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/layouts/admin-layout/admin-layout.ts) — *Thêm liên kết navigation Thu ngân & Giao dịch, loại bỏ nút placeholder roadmap*.
5. [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) — *Báo cáo đệ trình Round 1*.
6. [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) — *Cập nhật trạng thái `Submitted`, `writer: "none"`*.

---

## 5. Giữ Nguyên 7 Cổng PO & Tuyên Bố Giới Hạn (Non-Goals & Limitations)

- **7 PO Gates Giữ Nguyên:** Toàn bộ 7 cổng quyết định (D21 lookup TTL, Quote/Hold price pinning, Search API compatibility, Active-only vs IsPublished, Dataset địa giới hành chính, Migration mở rộng Property, Cơ chế tìm kiếm phòng trống xuyên cơ sở) tiếp tục ở trạng thái `NeedsPO` trong `decisions.md`.
- **Phase 6 (AI Search) Chưa Mở:** Không bổ sung bất kỳ logic AI hay dependency bên ngoài nào.
- **Giới hạn Môi trường Kiểm thử:** Kiểm thử trực tiếp trên runner Vitest và Angular build của frontend đã cài đặt sẵn trong workspace. Không can thiệp database thật và không chạy migration.
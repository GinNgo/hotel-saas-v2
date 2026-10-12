# Submission: P2-RATES-UI-01 (Round 1)

- **TaskId:** P2-RATES-UI-01
- **Round:** 1
- **SubmissionId:** sub-p2-rates-ui-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T10:45:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt phạm vi & Mục tiêu triển khai

Thực hiện lát cắt giao diện Quản lý Bảng giá phòng (`P2-RATES-UI-01`) theo đúng hợp đồng nghiệp vụ, đặc tả phân quyền và cơ chế tự động chia khoảng (interval splitting) của hệ thống:
1. **API Integration:** Tích hợp đầy đủ 3 API RoomTypes hiện có:
   - `GET /api/room-types/{id}/rates?propertyId={propertyId}` (Requires `ROOM_TYPES.Read`)
   - `GET /api/room-types/{id}/rates/history?propertyId={propertyId}` (Requires `ROOM_TYPES.Read`)
   - `POST /api/room-types/{id}/rates` (Requires `ROOM_TYPES.Update`, payload `CreateRoomTypeRateCommand`)
2. **Date-effective Versioning & Interval Splitting:**
   - Hỗ trợ xem các khoảng giá đang áp dụng và sắp áp dụng theo ngày (`effectiveFrom` $\to$ `effectiveTo`, `firstHours`, `firstHoursPrice`, `additionalHourPrice`, `nightlyPrice`, `currency: 'VND'`, `changeReason`).
   - Modal thiết lập bảng giá mới kèm giải thích cơ chế chia khoảng tự động (Interval Splitting).
   - Bảng lịch sử kiểm toán hiển thị trực quan các hành vi phân tách khoảng thời gian (`Created`, `Split_Created`, `Split_Shortened`, `Replaced`, `Replaced_Created`), đối chiếu khoảng ngày cũ/mới và giá cũ/mới.
3. **Xử lý Xung đột 409 Conflict:**
   - Bắt và diễn giải chi tiết lỗi HTTP 409 Conflict khi khoảng ngày bị chồng lấn bất thường hoặc vi phạm ràng buộc không thể chia tự động.
   - Giữ nguyên dữ liệu trên form trong modal để người dùng điều chỉnh ngày bắt đầu/kết thúc thay vì đóng form gây mất dữ liệu.
4. **Nguyên tắc Hợp đồng & Bảo vệ Ranh giới (Boundary Protection):**
   - **Tuyệt đối KHÔNG fallback sang `roomType.basePrice`:** Nếu loại phòng chưa có cấu hình bảng giá có thời hạn, hiển thị empty state thông báo rõ ràng cần thiết lập bảng giá mới; không tự ý lấy `basePrice` cũ thay thế làm giá đặt phòng.
   - **Phân quyền nghiêm ngặt theo Hợp đồng:** Yêu cầu quyền `ROOM_TYPES.Read` (1) để xem và `ROOM_TYPES.Update` (4) để thêm/sửa bảng giá. Không fallback sang `SETTINGS`. Người dùng chỉ có quyền Read sẽ ở chế độ Read-Only (ẩn/khóa nút tạo và từ chối gọi API mutation).
   - **Cách ly Chi nhánh (Branch Context Isolation):** Tự động đồng bộ với `authService.activePropertyId()`. Khi đổi hoặc bỏ chọn chi nhánh, lập tức hủy các request in-flight, xóa state cũ và tải danh sách loại phòng/bảng giá của chi nhánh mới.
   - **Chống Double-Submit:** Cài đặt signal `isSaving` và guard kiểm tra tại entry point của phương thức submit.
   - **Không xung đột với công việc của team:** Giữ nguyên các file của Tân/Nguyên (`room-types.page.ts` thuộc phạm vi TEAM-NGUYEN-01).

---

## 2. Danh sách Files đã tạo / chỉnh sửa

1. [`frontend/src/app/core/models/rate.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/rate.model.ts):
   - Khai báo DTOs khớp 100% với backend: `RoomTypeRateDto`, `RoomTypeRateAuditDto`, `CreateRoomTypeRateRequest`.
2. [`frontend/src/app/core/services/rate.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/rate.service.ts):
   - Service gọi `GET /api/room-types/{id}/rates`, `GET /api/room-types/{id}/rates/history` và `POST /api/room-types/{id}/rates`.
3. [`frontend/src/app/core/services/rate.service.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/rate.service.spec.ts):
   - 3 unit tests kiểm tra HTTP method, query param `propertyId`, và payload body.
4. [`frontend/src/app/features/rates/rates.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/rates/rates.page.ts):
   - Toàn bộ giao diện trang Quản lý Bảng giá phòng, Selector chọn loại phòng, Tab bảng giá đang áp dụng/sắp tới, Tab lịch sử kiểm toán & chia khoảng, Modal thiết lập bảng giá mới, validation ngày/giờ/giá, xử lý 409 conflict, timezone UTC+7 và trạng thái hiệu lực.
5. [`frontend/src/app/features/rates/rates.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/rates/rates.page.spec.ts):
   - 13 unit tests bao phủ:
     - Khởi tạo & tải dữ liệu loại phòng & bảng giá.
     - Enforce read permission guard (`ROOM_TYPES.Read`).
     - Enforce update permission (`ROOM_TYPES.Update`): khóa modal và chặn mutation cho user chỉ đọc.
     - Validate ngày: từ chối ngày trong quá khứ và `effectiveTo <= effectiveFrom`.
     - Validate giá: từ chối số giờ $\le 0$ và đơn giá âm.
     - Submit thành công bảng giá mới và reload dữ liệu.
     - Xử lý lỗi HTTP 409 Conflict.
     - Chuyển đổi loại phòng & cập nhật query params URL.
     - Cách ly ngữ cảnh chi nhánh khi bỏ chọn hoặc đổi chi nhánh.
     - Guard chống double-submit khi đang lưu.
     - Phân loại trạng thái hiệu lực (active, upcoming, expired).
     - Ánh xạ nhãn tiếng Việt và màu sắc badge cho audit actions (`Created`, `Split_Created`, `Split_Shortened`, `Replaced`, `Replaced_Created`).
     - Quy tắc không fallback sang `roomType.basePrice`.
6. [`frontend/src/app/app.routes.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.routes.ts):
   - Đăng ký route `/rates` kèm `permissionGuard('ROOM_TYPES', 1)` và lazy load `RatesPage`.
7. [`frontend/src/app/layouts/admin-layout/admin-layout.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/layouts/admin-layout/admin-layout.ts):
   - Mở menu điều hướng chính "Bảng giá phòng" với icon dollar, badge "Mới" và phương thức `hasRatesPermission()` (`ROOM_TYPES.Read`).

---

## 3. Kết quả Kiểm thử & Biên dịch (Exit Codes & Evidence)

1. **Targeted Frontend Spec (`rates.page.spec.ts` & `rate.service.spec.ts`):**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run src/app/features/rates/rates.page.spec.ts`
   - Kết quả: **13/13 PASS** (55ms, Exit Code: 0).
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run src/app/core/services/rate.service.spec.ts`
   - Kết quả: **3/3 PASS** (15ms, Exit Code: 0).

2. **Full Frontend Vitest Suite:**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run`
   - Kết quả: **85/85 PASS** trên toàn bộ 7 test files (Exit Code: 0).
     - `src/app/core/utils/date-time.util.spec.ts` (28 tests PASS)
     - `src/app/core/services/rate.service.spec.ts` (3 tests PASS)
     - `src/app/features/rates/rates.page.spec.ts` (13 tests PASS)
     - `src/app/features/policies/policies.page.spec.ts` (20 tests PASS)
     - `src/app/features/housekeeping/housekeeping.page.spec.ts` (14 tests PASS)
     - `src/app/app.spec.ts` (1 test PASS)
     - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts` (6 tests PASS)

3. **Frontend Production Build (`ng build`):**
   - Lệnh: `npm run build`
   - Kết quả: **Exit Code 0** (Application bundle generation complete, chunk `rates-page` 36.16 kB tạo thành công).

4. **Backend Regression Verification (`dotnet test`):**
   - Lệnh: `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Pricing|FullyQualifiedName~Rate"`
   - Kết quả: **27/27 PASS** (Duration: 28s, Exit Code: 0).

---

## 4. Trạng thái Runtime & Hướng dẫn Review

- **Angular Dev Server:** Đang chạy tại `http://localhost:4200` (PID / daemon `task-11020`).
- **.NET 10 WebApi:** Đang chạy tại `http://localhost:5283` (PID / daemon `task-13765`).
- **PostgreSQL 17 WSL:** Đang chạy tại cổng 5432 (PID / daemon `task-7660`).
- **Đường dẫn xem tính năng:** Đăng nhập hệ thống $\to$ Chọn menu **Bảng giá phòng** (`/rates`).

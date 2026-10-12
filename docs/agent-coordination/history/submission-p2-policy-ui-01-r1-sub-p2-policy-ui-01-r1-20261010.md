# Submission: P2-POLICY-UI-01 (Round 1)

- **TaskId:** P2-POLICY-UI-01
- **Round:** 1
- **SubmissionId:** sub-p2-policy-ui-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T10:05:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Phạm vi thực hiện & Yêu cầu đã giải quyết
Thực hiện trọn vẹn yêu cầu nhiệm vụ `P2-POLICY-UI-01` theo phân công PO trong `assignment.md`:

1. **Giao diện quản lý chính sách vận hành chi nhánh (Property Policies):**
   - Tích hợp chuẩn xác với API backend hiện có: `GET /api/properties/{id}/policies` và `PUT /api/properties/{id}/policies`.
   - **Giờ nhận / trả phòng tiêu chuẩn:** Input chuẩn HTML5 time (`HH:mm`), tự động format `HH:mm:ss` khi gửi lên backend; mặc định 14:00 và 12:00 theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
   - **Thời gian đệm dọn phòng (`bufferMinutes`):** Bắt buộc $\ge 30$ phút (turnover buffer giữa 2 lượt khách), validate client và backend fail-closed từ chối nếu $< 30$.
   - **Giới hạn thuê theo giờ (`maxHourlyHours`):** Từ 1 đến 24 giờ tuân thủ nghiêm ngặt Quyết định D14.
   - **Chính sách phụ thu nhận sớm & trả muộn (`surcharges`):**
     - Hỗ trợ thêm/sửa/xóa và bật/tắt (`isActive`) từng quy tắc phụ thu.
     - Phân loại phụ thu: Nhận phòng sớm (`EarlyCheckIn = 1`) và Trả phòng muộn (`LateCheckOut = 2`).
     - Ràng buộc khung giờ: Bắt buộc `toTime > fromTime`.
     - Chống chồng lấn (Interval Overlap Validation): Kiểm tra phát hiện và chặn các khung giờ bị trùng lặp trong cùng một loại phụ thu trước khi gửi API.
     - Cách tính: Hỗ trợ linh hoạt theo % giá đêm phòng (`PercentageOfNightly`, $1 - 100\%$) hoặc Số tiền cố định (`FlatAmount`, $\ge 0$ VND).

2. **Kiểm soát phân quyền & Ngữ cảnh chi nhánh (Branch Context & Authorization):**
   - Phân quyền theo contract: `PROPERTIES.Read` (xem) và `PROPERTIES.Update` (cập nhật), đồng thời hỗ trợ tương thích với `SETTINGS` cho các vai trò quản trị hiện có.
   - Khi tài khoản chỉ có quyền Read: Form hiển thị badge "Chỉ đọc (Read-Only)", các input ở trạng thái readonly và ẩn/khóa nút Lưu.
   - Khi tài khoản có quyền Update: Hiển thị đầy đủ chức năng thêm phụ thu, sửa thông số và lưu thay đổi.
   - Đổi chi nhánh: Liên kết trực tiếp với `activePropertyId()` của `AuthService`, tự động tải lại chính sách khi chuyển ngữ cảnh chi nhánh.

3. **UX & Trạng thái tải:**
   - Loading skeleton trong quá trình tải dữ liệu.
   - Empty state nếu chưa chọn chi nhánh hoặc chưa cấu hình phụ thu.
   - Nút "Lưu thay đổi chính sách" tích hợp trạng thái spinner khi đang lưu (`isSaving`), chống double-submit triệt để.
   - Thông báo kết quả qua Toast SweetAlert2 (`alertService.toastSuccess`, `alertService.toastError`).

4. **Ranh giới an toàn:**
   - Không can thiệp DB dev/prod/staging, không tạo migration mới, không thay đổi nghiệp vụ tính giá.

---

## 2. Files thay đổi & Tạo mới

### Frontend Files:
- **`frontend/src/app/core/models/policy.model.ts`** *(Tạo mới)*:
  Định nghĩa các interface DTO, enum `SurchargeType`, `SurchargeCalculationMethod`, labels và payload request.
- **`frontend/src/app/core/services/policy.service.ts`** *(Tạo mới)*:
  Service gọi API `GET` và `PUT /api/properties/{id}/policies`.
- **`frontend/src/app/features/policies/policies.page.ts`** *(Tạo mới)*:
  Component trang quản lý chính sách chi nhánh với Reactive Form, FormArray surcharges, validation chồng lấn và phân quyền.
- **`frontend/src/app/features/policies/policies.page.spec.ts`** *(Tạo mới)*:
  Bộ 11 unit tests toàn diện kiểm tra validation, interval overlap, permissions, add/remove rules và API handling.
- **`frontend/src/app/app.routes.ts`** *(Cập nhật)*:
  Đăng ký route `/policies` với `permissionGuard` kiểm tra quyền `PROPERTIES.Read`.
- **`frontend/src/app/layouts/admin-layout/admin-layout.ts`** *(Cập nhật)*:
  Bổ sung menu "Chính sách chi nhánh" vào nhóm Nghiệp vụ hoạt động trong Sidebar, chuyển nút Bảng giá phòng sang chờ task `P2-RATES-UI-01`.
- **`frontend/src/app/core/services/token-storage.service.ts`** *(Cập nhật)*:
  Hỗ trợ fallback tương thích giữa `PROPERTIES` và `SETTINGS`.

### Backend Files:
- **`backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs`** *(Cập nhật)*:
  Hỗ trợ đánh giá quyền `PROPERTIES` linh hoạt với fallback `SETTINGS` cho các role quản trị hiện có.

---

## 3. Kết quả kiểm thử & Exit Codes

1. **Frontend Vitest Suite (Toàn bộ 4 files liên quan):**
   - Command: `node ./node_modules/vitest/vitest.mjs run src/app/features/policies/policies.page.spec.ts src/app/features/housekeeping/housekeeping.page.spec.ts src/app/core/utils/date-time.util.spec.ts src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`
   - **Kết quả: 59/59 PASSED** (11/11 Policies, 14/14 Housekeeping, 28/28 DateTime, 6/6 DateRangeFilter), **Exit Code: 0**.

2. **Frontend Production Build:**
   - Command: `npm run build`
   - **Kết quả: Bundle generation complete** (`policies-page` chunk 23.70 kB), **Exit Code: 0**.

3. **Backend HTTP Pipeline End-to-End Tests:**
   - Command: `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~PricingAndPoliciesHttpPipelineTests`
   - **Kết quả: 1/1 PASSED**, **Exit Code: 0**.

4. **Backend Application Pricing Tests:**
   - Command: `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~Pricing`
   - **Kết quả: 25/25 PASSED**, **Exit Code: 0**.

5. **Backend Solution Build:**
   - Command: `dotnet build backend/HotelSaas.slnx`
   - **Kết quả: 0 Warning(s), 0 Error(s)**, **Exit Code: 0**.

---

## 4. Bằng chứng kiểm thử thực tế (Evidence)

- **Ảnh chụp màn hình thực tế:** `docs/agent-coordination/property_policies.png`
  - Giao diện Admin hiển thị chi nhánh "Grand Hotel Phú Nhuận" (User: Nguyễn Văn Chủ - Hotel Owner).
  - Giờ nhận phòng 14:00, Giờ trả phòng 12:00, Turnover buffer: 45 phút, Max hourly: 8 giờ.
  - Khung quy tắc phụ thu #1 hoạt động: Từ 06:00 đến 14:00, cố định 100.000đ.
  - Nút lưu thay đổi hoạt động với HTTP 200 persistence thật (`PUT /api/properties/{id}/policies`).
- **Dev Servers:**
  - Angular Dev Server chạy cổng 4200.
  - WebApi Daemon chạy cổng 5283.

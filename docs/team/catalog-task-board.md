# 📋 Bảng Quản Lý Công Việc Danh Mục Full-Stack (Catalog Task Board)
## Dự Án: Hotel SaaS Platform — Giai Đoạn Đẩy Nhanh Danh Mục (DELIVERY-CATALOG-01)

> **Mã tài liệu:** `CATALOG-TASK-BOARD` | **Phiên bản:** 1.0  
> **Cập nhật:** 2026-10-09 | **Trạng thái chung:** Phân công theo ranh giới module độc lập.  
> **Nguyên tắc cốt lõi:**  
> 1. **Phân rã module cô lập:** Không để 2 kỹ sư sửa chung file lõi hoặc chung controller/service để triệt tiêu merge conflict.  
> 2. **Trách nhiệm Full-Stack:** Mỗi kỹ sư chịu trách nhiệm hoàn thiện từ UI Frontend, API Backend, DB Queries cho đến Integration/Unit Tests của module mình.  
> 3. **Peer Cross-Review:** Nguyên và Tân review chéo cho nhau trước khi Tech Lead / PO nghiệm thu.  
> 4. **Giới hạn trạng thái:** Agent chỉ chuyển các task mẫu hoàn thiện đến tối đa `In Review`; reviewer con người và PO mới có thẩm quyền chuyển `Done`.  
> 5. **Chống lặp lại:** Các phần Agent đã triển khai (Auth Switcher, Rooms Reference Screen, Shared UI Kit, AlertService) được đánh dấu hoàn tất kiểm chứng, không giao làm lại.  
> 6. **Blocker Guard:** Các module thuộc Phase 3 (Reservations, Payments, Reports) để trạng thái `Blocked (P3A/P3B)` hoặc `Backlog`, tuyệt đối không tự ý dựng dữ liệu giả thành dữ liệu thật.

---

## 1. MA TRẬN PHÂN CÔNG TỔNG THỂ

| Mã Task | Tên Module / Tính Năng | Người Phụ Trách | Reviewer Chéo | Phạm Vi File | Trạng Thái |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **`REF-ROOM-01`** | **Màn hình mẫu Quản lý Phòng (Rooms Reference)** | **AI Agent** | **Tech Lead** | `rooms.page.ts`, `shared/*`, `GetRoomsQueryHandler.cs` | 🟢 **`In Review`** *(Đã chạy thật)* |
| **`REF-KIT-01`** | **Bộ UI Dùng Chung & SweetAlert2 (Shared Kit)** | **AI Agent** | **Tech Lead** | `alert.service.ts`, `date-range-filter`, `pagination`, `empty-state` | 🟢 **`In Review`** *(Đã chạy thật)* |
| **`CAT-HK-01`** | **Bảng Lưới Buồng Phòng (Housekeeping Board)** | **Nguyên** (Full-Stack) | **Tân** (Full-Stack) | `features/housekeeping/*`, `HousekeepingTasksController.cs` | 🟡 **`Ready`** *(Đã có spec)* |
| **`CAT-PROP-01`** | **Cài Đặt Chi Nhánh & Chính Sách (Property Policies)** | **Nguyên** (Full-Stack) | **Tân** (Full-Stack) | `features/properties/*`, `PropertiesController.cs` | 🟡 **`Ready`** *(Đã có spec)* |
| **`CAT-RATE-01`** | **Bảng Giá & Lịch Sử Biến Động (Room Type Rates)** | **Tân** (Full-Stack) | **Nguyên** (Full-Stack) | `features/room-type-rates/*`, `RoomTypesController.cs` (Rates) | 🟡 **`Ready`** *(Đã có spec)* |
| **`CAT-STAFF-01`** | **Quản Lý Nhân Viên & Phân Quyền (Staff & RBAC)** | **Tân** (Full-Stack) | **Nguyên** (Full-Stack) | `features/staff/*`, `TenantStaffController.cs` | 🟡 **`Ready`** *(Đã có spec)* |
| **`BL-BOOK-01`** | Đặt phòng & Quản lý Booking (Reservations) | *(Chờ Phase 3A)* | *(Chờ Phase 3A)* | `ReservationsController.cs` (Chưa phát hành) | 🔴 **`Blocked (P3A)`** |
| **`BL-PAY-01`** | Thanh toán & Thu ngân (Payments & Invoices) | *(Chờ Phase 3B)* | *(Chờ Phase 3B)* | `PaymentsController.cs` (Chưa phát hành) | 🔴 **`Blocked (P3B)`** |
| **`BL-REP-01`** | Báo cáo doanh thu & Thống kê lấp đầy (Reports) | *(Chờ P3 Analytics)* | *(Chờ P3 Analytics)* | `ReportsController.cs` (Chưa phát hành) | ⚪ **`Backlog`** |

---

## 2. CHI TIẾT TỪNG NHIỆM VỤ ĐƯỢC GIAO

---

### 🎫 TASK 01: `CAT-HK-01` — Bảng Lưới Buồng Phòng & Cập Nhật Trạng Thái
- **Mã Task:** `CAT-HK-01`
- **Kỹ sư phụ trách:** **Nguyên** (Full-Stack)
- **Kỹ sư review chéo:** **Tân** (Full-Stack)
- **Tài liệu nghiệp vụ:** [`docs/team/modules/housekeeping.md`](./modules/housekeeping.md)
- **Phụ thuộc:** `REF-ROOM-01` (Kế thừa mô hình phòng và status machine), `AlertService`.
- **Trạng thái:** **`Ready`** *(Kỹ sư tạo nhánh `feat/cat-hk-01` để bắt đầu)*
- **Phạm vi Frontend:**
  1. Xây dựng màn hình `/housekeeping` dạng bảng thẻ phòng (Room Cards Grid) nhóm theo từng tầng (`Floor`).
  2. Màu sắc thẻ tuân thủ chuẩn PMS: Xanh lá (`Clean`), Đỏ (`Dirty`), Cam (`Cleaning`), Xanh dương (`Occupied`), Xám (`OutOfService`).
  3. Thanh lọc trạng thái: Nút chọn nhanh lọc phòng cần dọn (`Dirty`), phòng đang dọn (`Cleaning`).
  4. Nút đổi trạng thái buồng phòng nhanh: Tuân thủ state machine, gửi `expectedOldStatus` trong body.
  5. Xử lý đồng thời: Bắt mã lỗi 409 `ERR_STALE_STATE` bằng SweetAlert2 warning toast và tự động reload bảng.
- **Phạm vi Backend:**
  1. Tận dụng `PATCH /api/rooms/{id}/status` hiện có với bảo vệ `ExpectedOldStatus`.
  2. Bổ sung endpoint `GET /api/rooms/housekeeping-summary` (trả về số lượng phòng theo từng trạng thái buồng phòng cho chi nhánh hiện tại).
  3. Đảm bảo AsNoTracking, Tenant/Property query filters fail-closed.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Hiển thị chính xác lưới phòng của chi nhánh đang chọn.
  - [ ] Chuyển trạng thái từ Dirty sang Cleaning, từ Cleaning sang Clean thành công.
  - [ ] Khóa không cho phép chuyển trạng thái thủ công đối với phòng đang có khách (`Occupied`).
  - [ ] Xung đột đồng thời: Giả lập 2 tab cùng đổi 1 phòng, tab thứ 2 nhận thông báo 409 và rollback trạng thái mượt mà.
  - [ ] 100% test pass, 0 lỗi TypeScript lint.

---

### 🎫 TASK 02: `CAT-PROP-01` — Cài Đặt Chi Nhánh & Chính Sách Hoạt Động
- **Mã Task:** `CAT-PROP-01`
- **Kỹ sư phụ trách:** **Nguyên** (Full-Stack)
- **Kỹ sư review chéo:** **Tân** (Full-Stack)
- **Tài liệu nghiệp vụ:** [`docs/team/modules/property-policies.md`](./modules/property-policies.md)
- **Phụ thuộc:** API P2A `PropertiesController.cs` (`/api/properties/{id}/policies`), `AlertService`.
- **Trạng thái:** **`Ready`** *(Kỹ sư tạo nhánh `feat/cat-prop-01`)*
- **Phạm vi Frontend:**
  1. Xây dựng màn hình `/settings/property-policies`.
  2. Form cấu hình giờ nhận phòng (Check-in time), giờ trả phòng (Check-out time), thời gian đệm buồng phòng (`TurnoverBufferMinutes`).
  3. Bảng cấu hình khung phụ thu nhận sớm (Early Check-In Surcharges) và trả muộn (Late Check-Out Surcharges) theo tỷ lệ phần trăm hoặc số tiền cố định.
  4. Tích hợp `AlertService` cho thông báo lưu thành công và cảnh báo xác nhận.
- **Phạm vi Backend:**
  1. Tích hợp `GET /api/properties/{id}/policies` và `PUT /api/properties/{id}/policies`.
  2. Validation: Giờ check-in phải sau giờ check-out cộng thời gian đệm (`TurnoverBufferMinutes`), phụ thu $\ge 0$.
  3. Bổ sung Integration Tests cho `UpdatePropertyPoliciesCommand`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Load đúng chính sách của chi nhánh hiện hành.
  - [ ] Cập nhật thành công và lưu vào CSDL, tải lại trang dữ liệu vẫn bảo toàn.
  - [ ] Chặn form nếu nhập giờ check-in/check-out vô lý (ví dụ đệm dọn phòng âm).
  - [ ] Phân quyền chặt chẽ: Chỉ `PropertyManager` hoặc `Owner` mới có quyền Update (`PROPERTIES:Update`). Nhân viên lễ tân chỉ có quyền xem.

---

### 🎫 TASK 03: `CAT-RATE-01` — Bảng Giá Theo Mùa & Lịch Sử Biến Động Giá
- **Mã Task:** `CAT-RATE-01`
- **Kỹ sư phụ trách:** **Tân** (Full-Stack)
- **Kỹ sư review chéo:** **Nguyên** (Full-Stack)
- **Tài liệu nghiệp vụ:** [`docs/team/modules/room-type-rates.md`](./modules/room-type-rates.md)
- **Phụ thuộc:** `RoomTypesController.cs` (`/api/room-types/{id}/rates`), `DateRangeFilterComponent`, `AlertService`.
- **Trạng thái:** **`Ready`** *(Kỹ sư tạo nhánh `feat/cat-rate-01`)*
- **Phạm vi Frontend:**
  1. Xây dựng màn hình `/room-types/:id/rates` (hoặc mở rộng modal bảng giá từ trang Loại phòng).
  2. Hiển thị bảng giá hiện hành: Loại giá (Theo giờ, Qua đêm, Theo ngày), Đơn giá áp dụng, Khoảng thời gian áp dụng (`[EffectiveDate, ExpirationDate)`).
  3. Tích hợp `DateRangeFilterComponent` để lọc bảng giá theo khoảng thời gian hiệu lực.
  4. Tab / Modal xem lịch sử phân tách khoảng giá (`/rates/history` - Audit Trail).
  5. Form thêm mới khoảng giá có kiểm tra chồng lấn thời gian.
- **Phạm vi Backend:**
  1. Tích hợp `GET /api/room-types/{id}/rates`, `GET /api/room-types/{id}/rates/history`, `POST /api/room-types/{id}/rates`.
  2. Kiểm tra nghiệp vụ: Khi tạo bảng giá mới đè lên khoảng thời gian cũ, hệ thống tự động phân tách khoảng (Interval Splitting) và ghi nhật ký kiểm toán vào `RoomTypeRateAudits`.
  3. Thêm test kiểm tra xung đột khoảng ngày biên.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Hiển thị chính xác các khoảng giá theo từng loại phòng.
  - [ ] Lọc ngày bằng `DateRangeFilterComponent` trả về đúng các rate schedule có hiệu lực trong khoảng.
  - [ ] Thêm khoảng giá mới tự động split khoảng cũ chính xác và ghi nhận lịch sử audit.
  - [ ] Phân quyền: Cần quyền `ROOM_TYPES:Update`.

---

### 🎫 TASK 04: `CAT-STAFF-01` — Quản Lý Nhân Viên Chi Nhánh & Phân Quyền
- **Mã Task:** `CAT-STAFF-01`
- **Kỹ sư phụ trách:** **Tân** (Full-Stack)
- **Kỹ sư review chéo:** **Nguyên** (Full-Stack)
- **Tài liệu nghiệp vụ:** [`docs/team/modules/staff-management.md`](./modules/staff-management.md)
- **Phụ thuộc:** `TenantStaff` entity, `AccessRole` entity, `AlertService`, `PaginationComponent`.
- **Trạng thái:** **`Ready`** *(Kỹ sư tạo nhánh `feat/cat-staff-01`)*
- **Phạm vi Frontend:**
  1. Xây dựng màn hình `/staff`: Danh sách nhân viên thuộc chi nhánh hiện tại.
  2. Tìm kiếm theo Tên, Email, lọc theo Vai trò (`Manager`, `FrontDesk`, `Housekeeping`).
  3. Phân trang server-side qua `app-pagination`.
  4. Modal gán vai trò / thêm nhân viên vào chi nhánh.
  5. Xác nhận xóa / vô hiệu hóa nhân viên chi nhánh bằng `AlertService.confirmDelete`.
- **Phạm vi Backend:**
  1. Xây dựng `TenantStaffController.cs` với các endpoint:
     - `GET /api/staff` (Lọc theo PropertyId, search, paging, AsNoTracking).
     - `POST /api/staff` (Gán nhân viên vào chi nhánh với vai trò).
     - `DELETE /api/staff/{id}` (Thu hồi quyền chi nhánh).
  2. Đảm bảo bảo vệ Isolation: Không cho phép nhân viên chi nhánh A xem hoặc chỉnh sửa nhân viên chi nhánh B.
  3. Thêm Unit/Integration tests cho Staff queries và commands.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Danh sách nhân viên hiển thị đúng người thuộc chi nhánh hiện hành.
  - [ ] Đổi chi nhánh trên Topbar lập tức chuyển danh sách nhân viên tương ứng.
  - [ ] Không cho phép tự xóa chính tài khoản đang đăng nhập.
  - [ ] 100% test pass, không vi phạm isolation.

---

## 3. CHECKLIST QUY CHUẨN KỸ THUẬT BẮT BUỘC (DEVELOPER CHECKLIST)

Khi triển khai bất kỳ module nào, kỹ sư bắt buộc tuân thủ:
1. **Giao diện & UX:**
   - [ ] Nền sáng trung tính ấm (`#fbfbfa`), màu nhấn Emerald (`#059669`). Không dùng full-page dark background.
   - [ ] Sử dụng `AlertService` cho tất cả thông báo Toast và Confirm Dialog.
   - [ ] Sử dụng `SkeletonTableComponent` cho loading và `EmptyStateComponent` cho trạng thái rỗng.
   - [ ] Phân trang dùng `PaginationComponent`; tìm kiếm có debounce 250-300ms và `switchMap` hủy request cũ.
   - [ ] Bộ lọc ngày dùng `DateRangeFilterComponent` với quy ước inclusive trên UI $\rightarrow$ query `[start, endExclusive)`.
2. **Backend & Cơ sở dữ liệu:**
   - [ ] Mọi truy vấn đọc phải có `.AsNoTracking()`, DTO projection, sort ổn định có tie-breaker `Id`.
   - [ ] Giới hạn `pageSize` trong khoảng `[1, 100]`.
   - [ ] Fail-closed: Mọi query đều lọc theo `TenantId` và `PropertyId` hợp lệ.
   - [ ] Không tự tiện chạy migration DDL lên dev/staging/prod database.

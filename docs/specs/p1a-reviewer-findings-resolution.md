# Báo cáo Toàn diện Xử lý Findings của Reviewer — Giai đoạn P1A

> **Dự án:** Hotel SaaS Platform (.NET 10 + PostgreSQL + Angular 22)  
> **Giai đoạn:** P1A (Khảo sát & Thiết kế Kiến trúc Nền tảng)  
> **Phiên bản:** 2.1 (Cập nhật phản hồi Reviewer & Bàn giao Gói P1B-01 — 2026-10-06)  
> **Cam kết kỹ thuật:** Chỉ hiệu chỉnh tài liệu kỹ thuật và artifacts; tuyệt đối không can thiệp code nghiệp vụ (.cs, .ts) và không chạy database migration trong đợt này; phân định rạch ròi giữa Quyết định đã duyệt và Tham số đang mở; chưa sửa code cho đến khi Reviewer duyệt gói P1B-01.

---

## 1. Tổng hợp Trạng thái Xử lý các Findings của Reviewer

| STT | Nội dung Finding của Reviewer | Trạng thái Đóng / Xử lý | Vị trí Cập nhật Tài liệu & Minh chứng |
|:---:|---|:---:|---|
| **1** | **Loại Accountant khỏi quyền duyệt hoàn tiền theo D23** | ✅ **Đã được Reviewer ĐÓNG** | [`docs/sdd/05-rbac-design.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/05-rbac-design.md)<br/>[`docs/sdd/06-api-design.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/06-api-design.md)<br/>[`docs/srs/06-data-dictionary.md`](file:///C:/Dev/hotel-saas-v2/docs/srs/06-data-dictionary.md) |
| **2** | **Gỡ bỏ unique cũ, thay bằng 2 Partial Unique Indexes** | ✅ **Đã được Reviewer ĐÓNG** | [`docs/sdd/01-erd.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/01-erd.md)<br/>[`docs/sdd/05-rbac-design.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/05-rbac-design.md) |
| **3** | **Check-in 12:00 (D06) & Booking Timestamps UTC (D11)** | ✅ **Đã được Reviewer ĐÓNG** | [`docs/sdd/01-erd.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/01-erd.md)<br/>[`docs/srs/06-data-dictionary.md`](file:///C:/Dev/hotel-saas-v2/docs/srs/06-data-dictionary.md) |
| **4** | **Phân loại RefreshToken / Notification là Protected Data**| ✅ **Đã được Reviewer ĐÓNG** | [`docs/srs/06-data-dictionary.md`](file:///C:/Dev/hotel-saas-v2/docs/srs/06-data-dictionary.md) |
| **5** | **Cung cấp hai artifacts được viện dẫn trực tiếp** | ✅ **Đã hoàn thành** | Đã xuất bản trực tiếp vào thư mục dự án:<br/>• [`docs/p1a-foundation-architecture-design.md`](file:///C:/Dev/hotel-saas-v2/docs/p1a-foundation-architecture-design.md)<br/>• [`docs/p1a-reviewer-findings-resolution.md`](file:///C:/Dev/hotel-saas-v2/docs/p1a-reviewer-findings-resolution.md) |
| **6** | **Thống nhất mô hình ERD, timestamps và scopes** | ✅ **Đã hoàn thành** | Đồng bộ toàn diện: `Reservation` có `StartAtUtc`, `EndAtUtc`, `CheckInDate`, `CheckOutDate`, `StayType`; `Payment`, `Invoice`, `HousekeepingTask` đều có `PropertyId`. |
| **7** | **Tách Allowlist Người nhận khỏi Allowlist Hành động Support**| ✅ **Đã hoàn thành** | Tách bạch độc lập giữa **`PlatformSupportRecipientAllowlist`** (ai được nhận grant) và **`SupportActionAllowlist`** (được làm gì: Read-only vs Diagnostic) kèm danh mục cấm Blacklisted Operations. |
| **8** | **Sửa báo cáo “đã bỏ bypass” thành “thiết kế, chưa implement”**| ✅ **Đã hoàn thành** | Xác nhận rõ: Hiện tại code `PermissionAuthorizationHandler.cs` chưa sửa; P1A chỉ ở mức thiết kế tài liệu; việc xóa code bypass sẽ triển khai trong P1B-01. |
| **9** | **Không tự ý áp dụng quy tắc sau 6 giờ đổi sang giá ngày** | ✅ **Đã hoàn thành** | Xóa bỏ mọi giả định tự ý quy đổi giá; xác định D14 là Open Decision theo `docs/p0-decisions.md`, để cơ sở cấu hình hoặc chờ PO quyết định. |
| **10**| **Chuẩn bị Gói P1B-01 nhỏ có Migration Fixture và Test Plan** | ✅ **Đã hoàn thành** | Lập đặc tả chi tiết gói P1B-01, script SQL Fixture baselining `__EFMigrationsHistory`, backfill logic và test matrix 16 ca âm tính; cam kết chưa sửa code cho đến khi Reviewer duyệt. |

---

## 2. Chi tiết Giải trình & Khắc phục các Yêu cầu còn lại

### 2.1. Cung cấp Hai Artifacts được Viện dẫn
Trước đây, hai artifacts kỹ thuật được lưu trong đường dẫn nội bộ của agent, khiến Reviewer khó tiếp cận trực tiếp trong không gian dự án.
- **Biện pháp khắc phục:** Cả hai tài liệu đã được ghi trực tiếp vào thư mục `docs/` của repository:
  1. [`docs/p1a-foundation-architecture-design.md`](file:///C:/Dev/hotel-saas-v2/docs/p1a-foundation-architecture-design.md): Đặc tả kiến trúc nền tảng P1A toàn diện.
  2. [`docs/p1a-reviewer-findings-resolution.md`](file:///C:/Dev/hotel-saas-v2/docs/p1a-reviewer-findings-resolution.md): Báo cáo xử lý và đối chiếu chi tiết từng finding của Reviewer.

### 2.2. Thống nhất ERD, Timestamps và Phân loại Scopes
- **Thống nhất Scopes:** Phân định rõ 6 scopes trong [`docs/srs/06-data-dictionary.md`](file:///C:/Dev/hotel-saas-v2/docs/srs/06-data-dictionary.md):
  - `[Platform / System]`: Dùng chung toàn SaaS.
  - `[Tenant-wide]`: Cấp doanh nghiệp.
  - `[Property-scoped]`: Cấp chi nhánh (`Property`, `Room`, `RoomType`, `Reservation`, `Payment`, `Invoice`, `HousekeepingTask`).
  - `[Protected / Security Data]`: `RefreshToken`.
  - `[Protected / User Data]`: `Notification`.
  - `[Public / Ephemeral]`: Catalog phòng, `GuestReview`, `AiUsageLog`.
- **Thống nhất Timestamps trong ERD ([`docs/sdd/01-erd.md`](file:///C:/Dev/hotel-saas-v2/docs/sdd/01-erd.md)):**
  - Thực thể `Reservation`: Lưu chuẩn UTC `StartAtUtc`, `EndAtUtc` (thời điểm thực tế); `CheckInDate`, `CheckOutDate` (ngày địa phương theo Asia/Ho_Chi_Minh); `StayType` (1: Hourly, 2: Overnight); `TotalAmount` và `Currency` (VND theo D11).
  - Thực thể `Payment`: Bổ sung `PropertyId` (FK -> `Property`), `RefundApprovedById` (FK -> `User`, chỉ Owner/Manager theo D23; **loại trừ Accountant**), `RefundReason`.
  - Thực thể `Invoice` & `HousekeepingTask`: Bổ sung `PropertyId` (FK -> `Property`).
  - Bảng quan hệ tổng hợp Section 6 trong `01-erd.md`: Chuẩn hóa 100% theo mô hình đa chi nhánh `Tenant -> Property (1:N)`, `Property -> Room/RoomType/Reservation/Payment/Invoice/HousekeepingTask (1:N)`.

### 2.3. Tách biệt Support Recipient Allowlist & Support Action Allowlist
Hệ thống giải quyết triệt để rủi ro bảo mật bằng cách phân định 2 lớp kiểm soát độc lập:

1. **Lớp 1 — Support Recipient Allowlist (`PlatformSupportRecipientAllowlist`):**
   - Kiểm soát **Ai có thể nhận quyền hỗ trợ**.
   - Chỉ các tài khoản nhân viên Platform thuộc danh sách này và có `IsActive = true` mới có thể được Tenant Owner chỉ định khi tạo `SupportAccessGrant`.
   - Nếu nhập `UserId` ngoài danh sách -> Từ chối với lỗi `400 Bad Request` (`ERR_SUPPORT_USER_NOT_IN_ALLOWLIST`).
2. **Lớp 2 — Support Action Allowlist (`SupportActionAllowlist`):**
   - Kiểm soát **Nhân viên hỗ trợ được làm gì** trên hệ thống khách hàng:
     - **Scope `READ_ONLY`:** Chỉ cho phép HTTP `GET` trên các cấu hình buồng phòng (`/room-types`, `/rooms`, `/housekeeping`) và tra cứu booking cụ thể (`/reservations/{id}`).
     - **Scope `DIAGNOSTIC`:** Thêm quyền `GET` trên nhật ký đồng bộ (`/telemetry/sync-logs`), log mã phản hồi cổng thanh toán (`/payments/{id}/metadata`), audit trail hệ thống.
   - **Danh mục Hành vi BỊ CẤM TUYỆT ĐỐI (Blacklisted Operations — Bất kể Scope):**
     - ❌ **CẤM ĐỘT BIẾN NGHIỆP VỤ:** Tuyệt đối cấm mọi thao tác `POST`, `PUT`, `PATCH`, `DELETE` trên dữ liệu kinh doanh của khách (không tạo/sửa/hủy phòng, không tạo/hủy booking, không tạo hóa đơn).
     - ❌ **CẤM DUYỆT TÀI CHÍNH / HOÀN TIỀN:** Cấm gọi `POST /payments/{id}/refund` hoặc thay đổi trạng thái giao dịch tiền tệ.
     - ❌ **CẤM XUẤT DỮ LIỆU HÀNG LOẠT:** Chặn toàn bộ hành động có bitmask `Export` (32) (VD: `/reports/*`, `/invoices/monthly-summary`, `/customers/export`) để chống thất thoát dữ liệu (data exfiltration).
     - ❌ **CẤM TRUY CẬP DỮ LIỆU BẢO MẬT & PII:** Không được đọc bảng `RefreshToken`, `User.PasswordHash`, API secrets, hoặc danh sách lương/hoa hồng nhân sự.
     - ❌ **CẤM SỬA CẤU HÌNH TÀI KHOẢN:** Không được đổi thông tin chủ sở hữu, số tài khoản ngân hàng nhận tiền.
   - **Cưỡng chế:** Gọi API ngoài Action Allowlist hoặc thuộc danh mục cấm sẽ bị `SupportAuthorizationMiddleware` chặn với **`403 Forbidden`** (`ERR_SUPPORT_ACTION_NOT_PERMITTED`).

### 2.4. Đính chính Báo cáo: "Thiết kế, Chưa Implement" Bãi bỏ Bypass
- **Hiện trạng:** Trong mã nguồn C# hiện tại ([`PermissionAuthorizationHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs)), logic bypass cho `SuperAdmin` vẫn đang tồn tại vật lý.
- **Đính chính trung thực:** Nhóm kỹ thuật **chưa sửa file code này trong Phase P1A**. Báo cáo trước đây dùng từ "đã bãi bỏ bypass" là chưa chuẩn xác.
- **Trạng thái đúng:** Trong P1A, nhóm kỹ thuật đã **thiết kế phương án bãi bỏ bypass** và thay thế bằng `SupportAuthorizationMiddleware`. Việc xóa bỏ đoạn code bypass này sẽ được **triển khai chính thức trong gói code P1B-01**.

### 2.5. Xử lý Quy tắc Giờ Thuê theo Giờ (D14)
- **Đính chính:** Nhóm kỹ thuật **xóa bỏ hoàn toàn đề xuất tự áp dụng quy tắc "sau 6 giờ đổi sang giá ngày"**.
- **Căn cứ:** Theo `docs/p0-decisions.md` (D14), mức trần thời gian thuê theo giờ là tham số đang mở (Open Decision), chưa được Product Owner chốt.
- **Thiết kế:** Hệ thống sẽ để tham số này linh hoạt theo chính sách cấu hình của từng chi nhánh hoặc chờ quyết định chính thức từ PO trước khi cài đặt logic tính giá tại Phase P2/P3.

---

## 3. Kế hoạch Gói Nhỏ P1B-01: Multi-Property Foundation & Migration Fixture

Để đảm bảo an toàn tuyệt đối và có thể review/rollback dễ dàng, Phase P1B được chia nhỏ, bắt đầu với **Gói P1B-01**:

### 3.1. Phạm vi Gói P1B-01
1. **Domain:**
   - Thêm interface `IPropertyScopedEntity.cs`.
   - Thêm entity `Property.cs`, `SupportAccessGrant.cs`, `PlatformSupportRecipientAllowlist.cs`.
   - Thêm property `PropertyId` (nullable trong giai đoạn chuyển đổi) vào `Room`, `RoomType`, `Reservation`, `Payment`, `TenantStaff`.
2. **Persistence & Migration Fixture (Tránh lỗi EnsureCreated `42P07`):**
   - Tạo migration baseline `20261006000000_InitialBaseline.cs`.
   - Chạy script SQL Fixture nạp `__EFMigrationsHistory` để PostgreSQL không báo lỗi bảng đã tồn tại.
   - Tạo differential migration `20261006_P1B01_MultiProperty_Foundation.cs`:
     - Tạo bảng `Properties`.
     - Script backfill tự động tạo 1 `Property` mặc định cho mỗi `Tenant` hiện có.
     - Thêm cột `PropertyId` vào các bảng con, populate giá trị từ chi nhánh mặc định, chuyển `SET NOT NULL` (trừ `TenantStaff` cho phép null nếu là Tenant-wide).
     - Tạo khóa ngoại và 2 partial unique indexes: `uq_tenant_staff_tenant_wide` và `uq_tenant_staff_property_scoped`.
     - Tạo bảng `SupportAccessGrants` và `PlatformSupportRecipientAllowlist`.
   - Cập nhật `Program.cs` thay `EnsureCreatedAsync()` bằng `MigrateAsync()`.
3. **Context Services & Security Middleware:**
   - `ICurrentPropertyService` & `CurrentPropertyService`.
   - `TenantMiddleware`: Xử lý header `X-Property-Id`, `X-Support-Grant-Id`.
   - `PropertyScopeValidationBehavior`: Chặn các truy cập sai chi nhánh / sai doanh nghiệp.
   - `SupportAuthorizationMiddleware`: Thực thi Recipient Allowlist, Action Allowlist và kiểm tra revoke realtime.
   - **Xóa bỏ đoạn code bypass SuperAdmin** trong `PermissionAuthorizationHandler.cs`.
4. **Endpoints:**
   - `PropertiesController`: CRUD chi nhánh (chỉ dành cho Owner/Admin).
   - `AuthController`: Endpoint `POST /api/v1/auth/switch-context`.
   - `SupportGrantsController`: Tạo và thu hồi support grant.

### 3.2. Test Plan & Negative Test Matrix cho Gói P1B-01
Gói P1B-01 đi kèm ma trận kiểm thử 16 test cases âm tính nghiêm ngặt:
- **Membership (TC-MB-01..04):** Chặn trùng lặp chi nhánh, chặn trùng lặp tenant-wide, chặn gán sai doanh nghiệp, chặn nhân sự bị vô hiệu hóa.
- **Context (TC-CTX-01..03):** Chặn xung đột giữa `X-Property-Id` và JWT claim (`ERR_CONTEXT_MISMATCH`), chặn thiếu context (`ERR_MISSING_PROPERTY_CONTEXT`), chặn truy cập chi nhánh trái phép.
- **Support Zero-Trust (TC-SUP-01..05):** Chặn nhân viên Platform thiếu grant (`ERR_SUPPORT_GRANT_REQUIRED`), chặn nhân viên ngoài Recipient Allowlist, chặn thao tác ngoài Action Allowlist (`ERR_SUPPORT_ACTION_NOT_PERMITTED`), chặn gọi export dữ liệu hàng loạt, chặn grant đã bị revoke.
- **Financial Permissions (TC-REF-01..02):** Chặn Kế toán (`Accountant`) và Lễ tân (`Receptionist`) duyệt hoàn tiền theo D23.
- **Migration & Backfill (TC-MIG-01..02):** Kiểm chứng chạy migration trên DB `EnsureCreated` không lỗi `42P07` và backfill đầy đủ 1 chi nhánh mặc định cho mỗi tenant.

---

## 4. Cam kết Thực hiện

Nhóm kỹ thuật cam kết:
1. **Tuyệt đối chưa sửa bất kỳ file code (.cs, .ts) nào** trong vòng P1A này.
2. Toàn bộ thiết kế kiến trúc, mô hình dữ liệu, cơ chế bảo mật Zero-Trust và kế hoạch migration fixture đã được hoàn thiện và đồng bộ 100% trong các tài liệu.
3. **Chờ Reviewer phê duyệt chính thức gói P1B-01** trước khi bắt đầu tạo file và sửa code.

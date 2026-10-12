# 📖 Data Dictionary (Từ điển dữ liệu Hệ thống Hotel SaaS)

> **Tài liệu:** SRS-06 | **Phiên bản:** 2.0 (Cập nhật Kiến trúc Đa chi nhánh P1A - 2026-10-06)  
> **Rubric mapping:** TC2.1 Mức 5 (Từ điển dữ liệu chuẩn hóa, phân loại Scope rõ ràng)

---

## 0. Ma trận Phân loại Phạm vi Thực thể (Entity Scope Classification)

Hệ thống phân định các phạm vi dữ liệu độc lập nhằm thực thi triệt để nguyên tắc **Fail-Closed**, **Zero-Trust** và **Bảo vệ dữ liệu nhạy cảm**:

| Phạm vi (Scope) | Định nghĩa & Nguyên tắc Cách ly | Danh sách Thực thể |
|---|---|---|
| **[Platform / System]** | Toàn bộ nền tảng SaaS dùng chung; chỉ SuperAdmin hoặc luồng hệ thống truy cập. | `User`, `AccessRole`, `PermissionFunction`, `RolePermission`, `SubscriptionPlan`, `SystemBanner` |
| **[Tenant-wide]** | Cấp Doanh nghiệp / Pháp nhân sở hữu; quản lý gói cước và toàn chuỗi chi nhánh. | `Tenant`, `TenantStaff` (khi `PropertyId IS NULL`), `Subscription`, `SubscriptionPayment`, `SupportAccessGrant` |
| **[Property-scoped]** | Cấp Chi nhánh khách sạn vật lý; bắt buộc có `PropertyId`. Thiếu context -> Fail-Closed. | `Property`, `TenantStaff` (khi `PropertyId IS NOT NULL`), `RoomType`, `RoomTypeRate`, `Room`, `Reservation`, `Payment`, `Invoice`, `InvoiceItem`, `HousekeepingTask`, `GuestReview`, `Promotion` |
| **[Protected / Security Data]** | Dữ liệu bảo mật nhạy cảm cao; kiểm soát phiên xác thực, mã hóa nghiêm ngặt. | `RefreshToken` (Quản lý phiên đăng nhập, chống đánh cắp danh tính) |
| **[Protected / User Data]** | Dữ liệu thông tin cá nhân và thông báo riêng tư của người dùng; cách ly theo User/Tenant. | `Notification` (Chứa PII, mã đơn đặt phòng, cảnh báo phân công việc) |
| **[Public / Ephemeral]** | Dữ liệu công khai cho khách tìm kiếm hoặc dữ liệu viễn trắc/nhật ký nặc danh. | Danh mục phòng xuất bản, Đánh giá công khai (`GuestReview`), `AiUsageLog` (Telemetry nặc danh) |

---

## 1. Tenant (Doanh nghiệp / Pháp nhân kinh doanh) `[Tenant-wide]`

Đại diện cho một công ty, hộ kinh doanh hoặc chủ sở hữu chuỗi lưu trú ký hợp đồng sử dụng nền tảng SaaS.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh duy nhất của doanh nghiệp |
| Name | varchar(200) | ✗ | — | — | Tên pháp nhân / Tên thương hiệu doanh nghiệp |
| Code | varchar(50) | ✗ | — | UNIQUE | Mã định danh nội bộ doanh nghiệp (VD: "sen-vang-group") |
| Slug | varchar(200) | ✗ | — | UNIQUE | URL slug đại diện doanh nghiệp |
| TaxCode | varchar(50) | ✓ | null | — | Mã số thuế doanh nghiệp |
| BusinessLicenseNumber | varchar(100) | ✓ | null | — | Số giấy phép đăng ký kinh doanh |
| LegalRepresentative | varchar(200) | ✓ | null | — | Họ tên người đại diện theo pháp luật |
| HeadquartersAddress | varchar(500) | ✓ | null | — | Địa chỉ trụ sở chính của doanh nghiệp |
| ContactEmail | varchar(200) | ✗ | — | — | Email liên hệ chính thức nhận hóa đơn SaaS |
| ContactPhone | varchar(20) | ✗ | — | — | Số điện thoại liên hệ đại diện doanh nghiệp |
| Status | enum | ✗ | Active | — | Trạng thái (`PendingApproval`, `Active`, `Suspended`) |
| SubscriptionTier | enum | ✗ | Basic | — | Gói cước SaaS đang sử dụng (`Basic`, `Pro`, `Enterprise`) |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm đăng ký doanh nghiệp |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm cập nhật hồ sơ doanh nghiệp |

---

## 2. Property (Chi nhánh / Cơ sở lưu trú vật lý) `[Property-scoped]`

Đại diện cho một khách sạn, resort hoặc cơ sở lưu trú vật lý cụ thể thuộc quyền sở hữu của Tenant. Khách sạn độc lập có đúng 1 Property.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh chi nhánh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc doanh nghiệp nào |
| Name | varchar(200) | ✗ | — | — | Tên chi nhánh (VD: "Khách sạn Sen Vàng - Chi nhánh Đà Nẵng") |
| Code | varchar(50) | ✗ | — | UNIQUE per Tenant | Mã chi nhánh (VD: "SV-DN") |
| Slug | varchar(200) | ✗ | — | UNIQUE | URL slug công khai để khách đặt phòng |
| Address | varchar(500) | ✗ | — | — | Địa chỉ vật lý chi tiết |
| City | varchar(100) | ✗ | — | — | Thành phố / Tỉnh |
| ProvinceCode | varchar(20) | ✓ | null | — | Mã tỉnh/thành theo danh mục hành chính |
| Ward | varchar(150) | ✓ | null | — | Phường / Xã |
| WardCode | varchar(20) | ✓ | null | — | Mã phường/xã |
| PhoneNumber | varchar(20) | ✓ | null | — | Số điện thoại lễ tân chi nhánh |
| Email | varchar(200) | ✓ | null | — | Email lễ tân / tiếp nhận booking |
| PropertyType | enum | ✗ | Hotel | — | Loại hình (`Hotel`, `Resort`, `Hostel`, `BAndB`, `Villa`, `Homestay`, `Apartment`) |
| StarRating | int | ✗ | 0 | 0-5 | Tiêu chuẩn sao |
| CheckInTime | time | ✗ | 12:00 | Theo D06 | **Giờ nhận phòng tiêu chuẩn mặc định 12:00** (Quyết định D06 thay thế mốc 14:00 cũ) |
| CheckOutTime | time | ✗ | 12:00 | Theo D06 | **Giờ trả phòng tiêu chuẩn mặc định 12:00 ngày hôm sau** |
| HousekeepingBufferMinutes | int | ✗ | 30 | Theo D07 (≥ 30) | Thời gian tối thiểu đệm dọn phòng giữa 2 lượt khách (min 30 phút) |
| CancellationPolicy | text | ✓ | null | — | Chính sách hủy phòng áp dụng tại chi nhánh |
| ChildrenPolicy | text | ✓ | null | — | Chính sách trẻ em |
| PetPolicy | text | ✓ | null | — | Chính sách thú cưng |
| HouseRules | text | ✓ | null | — | Nội quy chi nhánh |
| TaxRatePercent | decimal(5,2) | ✗ | 10.00 | ≥ 0 | Thuế VAT áp dụng tại chi nhánh (%) |
| ServiceFeeRatePercent | decimal(5,2) | ✗ | 5.00 | ≥ 0 | Phí phục vụ (%) |
| Latitude | double | ✓ | null | -90 to 90 | Tọa độ GPS vĩ độ |
| Longitude | double | ✓ | null | -180 to 180 | Tọa độ GPS kinh độ |
| IsPublished | bool | ✗ | false | — | Đã duyệt và xuất bản trên cổng tìm kiếm công khai? |
| IsActive | bool | ✗ | true | — | Chi nhánh đang mở cửa hoạt động? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm cập nhật |

---

## 3. User (Người dùng toàn cục) `[Platform / System]`

Tài khoản cá nhân duy nhất của người dùng trên toàn hệ thống.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh tài khoản |
| Username | varchar(100) | ✗ | — | UNIQUE | Tên đăng nhập |
| Email | varchar(200) | ✗ | — | UNIQUE | Email đăng nhập & nhận mã bảo mật |
| PasswordHash | varchar(500) | ✗ | — | — | Bcrypt hash |
| FullName | varchar(200) | ✗ | — | — | Họ tên đầy đủ |
| PhoneNumber | varchar(20) | ✓ | null | — | Số điện thoại liên hệ |
| AvatarUrl | varchar(500) | ✓ | null | — | Ảnh đại diện |
| EmailVerifiedAtUtc | datetime | ✓ | null | — | Thời điểm xác minh email |
| GlobalRole | enum | ✗ | Customer | — | Vai trò nền tảng (`SuperAdmin`, `Customer`, `TenantStaff`) |
| IsActive | bool | ✗ | true | — | Trạng thái tài khoản |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 4. TenantStaff (Hồ sơ Nhân sự & Phân quyền) `[Tenant / Property Scope]`

Liên kết giữa tài khoản `User` với một doanh nghiệp (`Tenant`) và chi nhánh (`Property`) kèm vai trò RBAC.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh hồ sơ nhân sự |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp quản lý |
| PropertyId | UUID | ✓ | null | FK → Property | **Chi nhánh được gán** (Null = Quyền cấp Doanh nghiệp Tenant-wide) |
| UserId | UUID | ✗ | — | FK → User | Tài khoản người dùng |
| RoleId | UUID | ✗ | — | FK → AccessRole | Vai trò RBAC tương ứng |
| StaffRole | enum | ✗ | Staff | — | Chức danh hiển thị (`Owner`, `Manager`, `Receptionist`, `Housekeeper`) |
| IsActive | bool | ✗ | true | — | Trạng thái hoạt động của nhân sự |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm bổ nhiệm |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

> **Ràng buộc duy nhất (Uniqueness Constraints):**
> 1. `uq_tenant_staff_tenant_wide`: UNIQUE (`TenantId`, `UserId`) WHERE `PropertyId IS NULL`. (Tối đa 1 vai trò Tenant-wide trên 1 DN).
> 2. `uq_tenant_staff_property_scoped`: UNIQUE (`TenantId`, `UserId`, `PropertyId`) WHERE `PropertyId IS NOT NULL`. (Tối đa 1 vai trò trên mỗi chi nhánh cụ thể).

---

## 5. SupportAccessGrant (Ủy quyền Hỗ trợ Kỹ thuật Platform) `[Tenant-wide / Security]`

Bản ghi cấp quyền tạm thời, có thời hạn và lý do cho nhân viên Platform truy cập dữ liệu của khách hàng.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh đợt ủy quyền |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp cấp quyền |
| PropertyId | UUID | ✓ | null | FK → Property | Giới hạn chi nhánh (Null = Hỗ trợ toàn bộ chi nhánh) |
| GrantedToUserId | UUID | ✗ | — | FK → User, Allowlist | Tài khoản nhân viên Platform (bắt buộc thuộc Support Allowlist) |
| GrantedByUserId | UUID | ✗ | — | FK → User | Tài khoản Tenant Owner ký duyệt cấp quyền |
| Reason | text | ✗ | — | min 20 chars | Lý do cấp quyền hỗ trợ kỹ thuật (bắt buộc) |
| Scope | enum | ✗ | READ_ONLY | — | Phạm vi thao tác (`READ_ONLY`, `DIAGNOSTIC`) |
| ExpiresAtUtc | datetime | ✗ | — | max 8 hours | Thời điểm hết hạn hiệu lực (tối đa 480 phút) |
| RevokedAtUtc | datetime | ✓ | null | — | Thời điểm bị hủy quyền sớm (nếu có) |
| RevokedByUserId | UUID | ✓ | null | FK → User | Người thực hiện thu hồi quyền (Owner hoặc SuperAdmin khẩn cấp) |
| RevocationReason | text | ✓ | null | — | Lý do thu hồi quyền sớm |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm khởi tạo |

---

## 6. RoomType (Loại phòng) `[Property-scoped]`

Danh mục phân loại buồng phòng thuộc một chi nhánh cụ thể.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh loại phòng |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp sở hữu |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh trực thuộc** |
| Name | varchar(100) | ✗ | — | — | Tên loại phòng (VD: "Deluxe Double Ocean View") |
| Code | varchar(50) | ✗ | — | UNIQUE per Property | Mã loại phòng (VD: "DLX-OV") |
| Description | text | ✓ | null | — | Mô tả tiện nghi chi tiết |
| BasePrice | decimal(18,2) | ✗ | — | > 0 | Giá niêm yết cơ bản / đêm (VND) |
| MaxOccupancy | int | ✗ | 2 | ≥ 1 | Số khách tối đa |
| BedType | varchar(50) | ✓ | null | — | Loại giường (Single/Double/Twin/King) |
| SquareMeters | decimal(8,2) | ✓ | null | > 0 | Diện tích phòng (m²) |
| ImageUrl | varchar(500) | ✓ | null | — | Ảnh đại diện loại phòng |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 7. Room (Phòng vật lý) `[Property-scoped]`

Phòng vật lý thực tế tại chi nhánh.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh phòng |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp sở hữu |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh trực thuộc** |
| RoomTypeId | UUID | ✗ | — | FK → RoomType | Thuộc loại phòng nào |
| RoomNumber | varchar(20) | ✗ | — | UNIQUE per Property | Số phòng hiển thị (VD: "201", "B-305") |
| Floor | int | ✗ | 1 | ≥ 0 | Tầng phòng |
| Status | enum | ✗ | Clean | — | Trạng thái buồng phòng (`Clean`, `Dirty`, `Cleaning`, `Occupied`, `OutOfService`) |
| Notes | text | ✓ | null | — | Ghi chú vận hành bảo trì |
| IsActive | bool | ✗ | true | — | Phòng sẵn sàng kinh doanh? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 8. Reservation (Đơn đặt phòng) `[Property-scoped]`

Giao dịch đặt phòng của khách tại một chi nhánh cụ thể (Lưu trữ UTC timestamps theo D11, hiển thị/tính ngày theo giờ cơ sở D06).

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh đơn đặt phòng |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp sở hữu |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh tiếp nhận booking** |
| RoomId | UUID | ✗ | — | FK → Room | Phòng được phân bổ |
| GuestUserId | UUID | ✓ | null | FK → User | Tài khoản khách đã đăng nhập (null = walk-in / guest checkout) |
| GuestName | varchar(200) | ✗ | — | — | Họ tên khách đại diện đặt phòng |
| GuestEmail | varchar(200) | ✗ | — | — | Email nhận xác nhận |
| GuestPhone | varchar(20) | ✓ | null | — | SĐT khách |
| StartAtUtc | datetime | ✗ | — | Theo D11 | **Thời điểm bắt đầu lưu trú chuẩn UTC** |
| EndAtUtc | datetime | ✗ | — | > StartAtUtc | **Thời điểm kết thúc lưu trú chuẩn UTC** |
| StayType | enum | ✗ | Overnight | Theo D04 | Hình thức thuê (`Hourly = 1`, `Overnight = 2`) |
| CheckInDate | date | ✗ | — | Local date | Ngày nhận phòng tính theo giờ địa phương (Asia/Ho_Chi_Minh) |
| CheckOutDate | date | ✗ | — | Local date | Ngày trả phòng tính theo giờ địa phương |
| NumberOfGuests | int | ✗ | 1 | ≥ 1 | Số lượng khách |
| TotalAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tổng tiền đơn đặt (VND) |
| Currency | char(3) | ✗ | VND | Theo D11 | Tiền tệ đơn hàng |
| PricingSnapshot | jsonb | ✗ | — | Immutable | Bản chụp chi tiết giá từng đêm, thuế, phí |
| Status | enum | ✗ | PendingPayment | — | Trạng thái đơn (`PendingPayment`, `Confirmed`, `CheckedIn`, `CheckedOut`, `Cancelled`, `NoShow`) |
| ConfirmationCode | varchar(6) | ✗ | auto | UNIQUE per Property | Mã đặt phòng rút gọn cho khách tra cứu |
| CancelledAtUtc | datetime | ✓ | null | — | Thời điểm hủy (nếu có) |
| CancellationReason | text | ✓ | null | — | Lý do hủy đơn |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo đơn |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 9. Payment (Thanh toán) `[Property-scoped]`

Giao dịch thanh toán tiền phòng và dịch vụ tại chi nhánh.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh giao dịch thanh toán |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp thụ hưởng |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh phát sinh thu chi** |
| ReservationId | UUID | ✗ | — | FK → Reservation | Gắn với đơn đặt phòng nào |
| Amount | decimal(18,2) | ✗ | — | > 0 | Số tiền thanh toán (VND) |
| Method | enum | ✗ | — | — | Phương thức (`Cash`, `BankTransfer`, `VNPay`, `CreditCard`) |
| Status | enum | ✗ | Pending | — | Trạng thái (`Pending`, `Completed`, `Failed`, `Refunded`) |
| TransactionRef | varchar(100) | ✓ | null | — | Mã tham chiếu cổng thanh toán |
| IdempotencyKey | varchar(100) | ✗ | auto | UNIQUE | Khóa chống trùng lặp thanh toán |
| RefundApprovedById | UUID | ✓ | null | FK → User | **Người duyệt hoàn tiền** (Chỉ Tenant Owner/Admin hoặc Property Manager theo D23; **Accountant KHÔNG có quyền duyệt**) |
| RefundReason | text | ✓ | null | — | Lý do duyệt hoàn tiền |
| PaidAtUtc | datetime | ✓ | null | — | Thời điểm giao dịch hoàn tất |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

---

## 10. Invoice (Hóa đơn lưu trú) `[Property-scoped]`

Chứng từ xuất hóa đơn thanh toán cho khách tại chi nhánh.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh hóa đơn |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp phát hành |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh xuất hóa đơn** |
| ReservationId | UUID | ✗ | — | FK → Reservation | Gắn với booking |
| InvoiceNumber | varchar(50) | ✗ | auto | UNIQUE per Property | Số hóa đơn (VD: "INV-202610-001") |
| SubTotal | decimal(18,2) | ✗ | — | ≥ 0 | Tiền trước thuế và phí dịch vụ |
| TaxAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tiền thuế GTGT |
| ServiceFeeAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tiền phí dịch vụ |
| TotalAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tổng tiền thanh toán cuối cùng |
| Status | enum | ✗ | Draft | — | Trạng thái (`Draft`, `Issued`, `Paid`, `Void`, `Refunded`) |
| IssuedAtUtc | datetime | ✓ | null | — | Thời điểm phát hành hóa đơn |
| PaidAtUtc | datetime | ✓ | null | — | Thời điểm thanh toán |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 11. HousekeepingTask (Nhiệm vụ Buồng phòng) `[Property-scoped]`

Công việc dọn dẹp vệ sinh phòng tại chi nhánh.

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh nhiệm vụ dọn phòng |
| TenantId | UUID | ✗ | — | FK → Tenant | Doanh nghiệp sở hữu |
| PropertyId | UUID | ✗ | — | FK → Property | **Chi nhánh phát sinh việc** |
| RoomId | UUID | ✗ | — | FK → Room | Phòng cần dọn |
| AssignedToId | UUID | ✓ | null | FK → User | Nhân viên buồng phòng được phân công |
| CreatedById | UUID | ✗ | — | FK → User | Người tạo task (Lễ tân/Hệ thống tự động) |
| Priority | enum | ✗ | Normal | — | Mức ưu tiên (`Low`, `Normal`, `High`, `Urgent`) |
| Status | enum | ✗ | Pending | — | Trạng thái (`Pending`, `Claimed`, `InProgress`, `Completed`) |
| CompletedAtUtc | datetime | ✓ | null | — | Thời điểm hoàn thành dọn phòng |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 12. Enums Reference Chuẩn hóa

| Tên Enum | Giá trị Enum (`int`) | Ý nghĩa nghiệp vụ |
|---|---|---|
| **GlobalUserRole** | `SuperAdmin = 1`, `Customer = 2`, `TenantStaff = 3` | Vai trò định danh toàn cục trên nền tảng |
| **StaffRole** | `Owner = 1`, `Manager = 2`, `Receptionist = 3`, `Housekeeper = 4` | Chức vụ nhân sự |
| **TenantStatus** | `PendingApproval = 1`, `Active = 2`, `Suspended = 3` | Trạng thái doanh nghiệp |
| **PropertyType** | `Hotel = 1`, `Resort = 2`, `Hostel = 3`, `BAndB = 4`, `Villa = 5`, `Apartment = 6`, `Motel = 7`, `Homestay = 8` | Phân loại cơ sở lưu trú |
| **RoomStatus** | `Clean = 1`, `Dirty = 2`, `Cleaning = 3`, `Occupied = 4`, `OutOfService = 5` | Trạng thái vận hành phòng |
| **ReservationStatus**| `PendingPayment = 1`, `Confirmed = 2`, `CheckedIn = 3`, `CheckedOut = 4`, `Cancelled = 5`, `NoShow = 6` | Vòng đời đơn đặt phòng |
| **PaymentStatus** | `Pending = 1`, `Completed = 2`, `Failed = 3`, `Refunded = 4`, `Expired = 5` | Trạng thái giao dịch tiền |
| **PaymentMethod** | `VNPay = 1`, `Cash = 2`, `BankTransfer = 3`, `CreditCard = 4` | Phương thức thanh toán |
| **HousekeepingTaskStatus** | `Pending = 1`, `Claimed = 2`, `InProgress = 3`, `Completed = 4` | Trạng thái nhiệm vụ buồng phòng |
| **SupportGrantScope**| `READ_ONLY = 1`, `DIAGNOSTIC = 2` | Phạm vi quyền hạn Platform Support |

# 📖 Data Dictionary (Từ điển dữ liệu)

> **Tài liệu:** SRS-06 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (từ điển dữ liệu)

---

## 1. Tenant (Cơ sở lưu trú)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| Name | varchar(200) | ✗ | — | — | Tên cơ sở (VD: "Nhà nghỉ Hoa Đào") |
| Code | varchar(50) | ✗ | — | UNIQUE | Mã nội bộ (VD: "hoa-dao") |
| Slug | varchar(200) | ✗ | — | UNIQUE | URL slug cho public page |
| Description | text | ✓ | null | — | Mô tả chi tiết |
| Address | varchar(500) | ✗ | — | — | Địa chỉ đầy đủ |
| City | varchar(100) | ✗ | — | — | Thành phố / tỉnh |
| PhoneNumber | varchar(20) | ✓ | null | — | SĐT liên hệ |
| Email | varchar(200) | ✓ | null | — | Email liên hệ |
| LogoUrl | varchar(500) | ✓ | null | — | URL logo |
| PropertyType | enum | ✗ | Hotel | — | Loại hình (Hotel, Hostel, B&B, Villa, Homestay, Motel, Apartment, Resort) |
| StarRating | int | ✗ | 0 | 0-5 | Số sao |
| CheckInTime | time | ✗ | 14:00 | — | Giờ check-in mặc định |
| CheckOutTime | time | ✗ | 12:00 | — | Giờ check-out mặc định |
| CancellationPolicy | text | ✓ | null | — | Chính sách hủy (hiển thị cho khách) |
| ChildrenPolicy | text | ✓ | null | — | Chính sách trẻ em |
| PetPolicy | text | ✓ | null | — | Chính sách vật nuôi |
| HouseRules | text | ✓ | null | — | Nội quy cơ sở |
| TaxRatePercent | decimal(5,2) | ✗ | 10.00 | ≥0 | Thuế VAT (%) |
| ServiceFeeRatePercent | decimal(5,2) | ✗ | 5.00 | ≥0 | Phí dịch vụ (%) |
| Latitude | double | ✓ | null | -90 to 90 | Tọa độ vĩ độ |
| Longitude | double | ✓ | null | -180 to 180 | Tọa độ kinh độ |
| SubscriptionTier | enum | ✗ | Basic | — | Gói dịch vụ (Basic/Pro/Enterprise) |
| Status | enum | ✗ | Active | — | Trạng thái (PendingApproval/Active/Suspended) |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 2. User (Người dùng)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| Username | varchar(100) | ✗ | — | UNIQUE | Tên đăng nhập |
| Email | varchar(200) | ✗ | — | UNIQUE | Email (dùng để login) |
| PasswordHash | varchar(500) | ✗ | — | — | Bcrypt hash (≥10 rounds) |
| FullName | varchar(200) | ✗ | — | — | Họ tên đầy đủ |
| PhoneNumber | varchar(20) | ✓ | null | — | Số điện thoại |
| AvatarUrl | varchar(500) | ✓ | null | — | URL ảnh đại diện |
| EmailVerifiedAtUtc | datetime | ✓ | null | — | Thời điểm xác minh email |
| GlobalRole | enum | ✗ | Customer | — | Vai trò toàn cục (SuperAdmin/Customer/TenantStaff) |
| IsActive | bool | ✗ | true | — | Tài khoản active? |
| TenantId | UUID | ✓ | null | FK → Tenant | Tenant mặc định (nếu là staff) |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 3. RoomType (Loại phòng)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| Name | varchar(100) | ✗ | — | — | Tên loại phòng (VD: "Deluxe Double") |
| Code | varchar(50) | ✗ | — | — | Mã nội bộ |
| Description | text | ✓ | null | — | Mô tả tiện nghi |
| BasePrice | decimal(18,2) | ✗ | — | > 0 | Giá cơ bản / đêm (VND) |
| MaxOccupancy | int | ✗ | 2 | ≥ 1 | Số khách tối đa |
| BedType | varchar(50) | ✓ | null | — | Loại giường (Single/Double/Twin/King) |
| SquareMeters | decimal(8,2) | ✓ | null | > 0 | Diện tích (m²) |
| ImageUrl | varchar(500) | ✓ | null | — | Ảnh đại diện |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 4. Room (Phòng)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| RoomTypeId | UUID | ✗ | — | FK → RoomType | Loại phòng |
| RoomNumber | varchar(20) | ✗ | — | UNIQUE per Tenant | Số phòng (VD: "101", "A-205") |
| Floor | int | ✗ | 1 | ≥ 0 | Tầng |
| Status | enum | ✗ | Clean | — | Trạng thái (Clean/Dirty/Cleaning/Occupied/OutOfService) |
| Notes | text | ✓ | null | — | Ghi chú (VD: "View đẹp", "Điều hòa mới") |
| IsActive | bool | ✗ | true | — | Phòng đang hoạt động? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 5. Reservation (Đặt phòng)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| RoomId | UUID | ✗ | — | FK → Room | Phòng được đặt |
| GuestUserId | UUID | ✓ | null | FK → User | Khách đã đăng ký (null = walk-in) |
| GuestName | varchar(200) | ✗ | — | — | Tên khách |
| GuestEmail | varchar(200) | ✗ | — | — | Email khách |
| GuestPhone | varchar(20) | ✓ | null | — | SĐT khách |
| CheckInDate | date | ✗ | — | ≥ today | Ngày check-in |
| CheckOutDate | date | ✗ | — | > CheckInDate | Ngày check-out |
| NumberOfGuests | int | ✗ | 1 | ≥ 1, ≤ MaxOccupancy | Số khách |
| TotalAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tổng tiền (VND) |
| Status | enum | ✗ | PendingPayment | — | Trạng thái booking |
| Notes | text | ✓ | null | — | Yêu cầu đặc biệt |
| ConfirmationCode | varchar(6) | ✗ | auto | UNIQUE | Mã xác nhận |
| CancelledAtUtc | datetime | ✓ | null | — | Thời điểm hủy |
| CancellationReason | text | ✓ | null | — | Lý do hủy |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 6. Payment (Thanh toán)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| ReservationId | UUID | ✗ | — | FK → Reservation | Booking liên quan |
| Amount | decimal(18,2) | ✗ | — | > 0 | Số tiền (VND) |
| Method | enum | ✗ | — | — | Phương thức (VNPay/Cash/BankTransfer/CreditCard) |
| Status | enum | ✗ | Pending | — | Trạng thái (Pending/Completed/Failed/Refunded/Expired) |
| TransactionRef | varchar(100) | ✓ | null | — | Mã giao dịch VNPay |
| IdempotencyKey | varchar(100) | ✗ | auto | UNIQUE | Chống duplicate |
| PaidAtUtc | datetime | ✓ | null | — | Thời điểm thanh toán thành công |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

---

## 7. Enums Reference

| Enum | Values | Mô tả |
|------|--------|-------|
| GlobalUserRole | SuperAdmin=1, Customer=2, TenantStaff=3 | Vai trò toàn cục |
| StaffRole | Owner=1, Manager=2, Receptionist=3, Housekeeper=4 | Vai trò nhân viên |
| TenantStatus | PendingApproval=1, Active=2, Suspended=3 | Trạng thái property |
| SubscriptionTier | Basic=1, Pro=2, Enterprise=3 | Gói subscription |
| PropertyType | Hotel=1, Resort=2, Hostel=3, BAndB=4, Villa=5, Apartment=6, Motel=7, Homestay=8 | Loại cơ sở |
| RoomStatus | Clean=1, Dirty=2, Cleaning=3, Occupied=4, OutOfService=5 | Trạng thái phòng |
| ReservationStatus | PendingPayment=1, Confirmed=2, CheckedIn=3, CheckedOut=4, Cancelled=5, NoShow=6 | Trạng thái booking |
| PaymentStatus | Pending=1, Completed=2, Failed=3, Refunded=4, Expired=5 | Trạng thái thanh toán |
| PaymentMethod | VNPay=1, Cash=2, BankTransfer=3, CreditCard=4 | Phương thức thanh toán |
| HousekeepingTaskStatus | Pending=1, InProgress=2, Completed=3, Claimed=4 | Trạng thái task dọn phòng |
| HousekeepingPriority | Low=1, Normal=2, High=3, Urgent=4 | Mức ưu tiên |
| FolioItemType | RoomCharge=1, Minibar=2, Laundry=3, Restaurant=4, Surcharge=5, Discount=6, DepositPayment=7, Tax=8, ServiceCharge=9 | Loại mục trên folio |
| SubscriptionStatus | Trial=1, Active=2, PastDue=3, Cancelled=4, Expired=5 | Trạng thái subscription |
| BillingCycle | Monthly=1, Yearly=2 | Chu kỳ thanh toán subscription |
| InvoiceStatus | Draft=1, Issued=2, Paid=3, Void=4, Refunded=5 | Trạng thái hóa đơn |
| NotificationType | Booking=1, Housekeeping=2, Payment=3, Subscription=4, Review=5, System=6 | Loại thông báo |
| PromotionType | Percentage=1, FixedAmount=2, FreeNight=3 | Loại khuyến mãi |

---

*Tài liệu này mô tả 16 entities chính + 17 enums, phục vụ TC2.1 (từ điển dữ liệu).*
*Các entities phụ (HousekeepingTask, Notification, AuditLog, AiUsageLog) xem thêm tại ERD.*

---

## 8. Subscription (Gói đăng ký)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant, UNIQUE | Thuộc property nào (1:1) |
| Plan | enum | ✗ | Basic | — | Gói (Basic/Pro/Enterprise) |
| Status | enum | ✗ | Trial | — | Trạng thái (Trial/Active/PastDue/Cancelled/Expired) |
| BillingCycle | enum | ✗ | Monthly | — | Chu kỳ thanh toán (Monthly/Yearly) |
| CurrentPeriodStart | date | ✗ | — | — | Ngày bắt đầu kỳ hiện tại |
| CurrentPeriodEnd | date | ✗ | — | > CurrentPeriodStart | Ngày kết thúc kỳ hiện tại |
| TrialEndsAt | date | ✓ | null | — | Ngày hết trial |
| CancelledAtUtc | datetime | ✓ | null | — | Thời điểm hủy |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 9. SubscriptionPayment (Thanh toán gói đăng ký)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| SubscriptionId | UUID | ✗ | — | FK → Subscription | Thuộc subscription nào |
| Amount | decimal(18,2) | ✗ | — | > 0 | Số tiền (VND) |
| Currency | varchar(3) | ✗ | VND | — | Mã tiền tệ |
| Status | enum | ✗ | Pending | — | Trạng thái (Pending/Completed/Failed/Refunded) |
| Method | enum | ✗ | — | — | Phương thức (VNPay/BankTransfer/CreditCard) |
| TransactionRef | varchar(100) | ✓ | null | — | Mã giao dịch |
| IdempotencyKey | varchar(100) | ✗ | auto | UNIQUE | Chống duplicate |
| PeriodStart | date | ✗ | — | — | Kỳ thanh toán bắt đầu |
| PeriodEnd | date | ✗ | — | > PeriodStart | Kỳ thanh toán kết thúc |
| PaidAtUtc | datetime | ✓ | null | — | Thời điểm thanh toán thành công |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

---

## 10. Invoice (Hóa đơn)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| ReservationId | UUID | ✗ | — | FK → Reservation | Booking liên quan |
| InvoiceNumber | varchar(50) | ✗ | auto | UNIQUE | Số hóa đơn (auto-generated) |
| SubTotal | decimal(18,2) | ✗ | — | ≥ 0 | Tổng phụ trước thuế/phí |
| TaxAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tiền thuế |
| ServiceFeeAmount | decimal(18,2) | ✗ | — | ≥ 0 | Phí dịch vụ |
| TotalAmount | decimal(18,2) | ✗ | — | ≥ 0 | Tổng cộng |
| Status | enum | ✗ | Draft | — | Trạng thái (Draft/Issued/Paid/Void/Refunded) |
| IssuedAtUtc | datetime | ✓ | null | — | Thời điểm phát hành |
| PaidAtUtc | datetime | ✓ | null | — | Thời điểm thanh toán |
| Notes | text | ✓ | null | — | Ghi chú |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 11. InvoiceItem (Mục hóa đơn)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| InvoiceId | UUID | ✗ | — | FK → Invoice | Thuộc hóa đơn nào |
| Description | varchar(500) | ✗ | — | — | Mô tả mục (VD: "Phòng Deluxe 2 đêm") |
| Quantity | int | ✗ | 1 | ≥ 1 | Số lượng |
| UnitPrice | decimal(18,2) | ✗ | — | ≥ 0 | Đơn giá (VND) |
| LineTotal | decimal(18,2) | ✗ | — | ≥ 0 | Thành tiền (Quantity × UnitPrice) |
| Category | varchar(50) | ✗ | — | — | Phân loại (RoomCharge/Minibar/Laundry/Tax/ServiceFee/Discount) |
| SortOrder | int | ✗ | 0 | ≥ 0 | Thứ tự hiển thị |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

---

## 12. HousekeepingTask (Nhiệm vụ dọn phòng)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| RoomId | UUID | ✗ | — | FK → Room | Phòng cần dọn |
| AssignedToId | UUID | ✓ | null | FK → User | Nhân viên được giao (housekeeper) |
| CreatedById | UUID | ✗ | — | FK → User | Người tạo task (manager/hệ thống) |
| Priority | enum | ✗ | Normal | — | Mức ưu tiên (Low/Normal/High/Urgent) |
| Status | enum | ✗ | Pending | — | Trạng thái (Pending/InProgress/Completed/Claimed) |
| Notes | text | ✓ | null | — | Ghi chú |
| CompletedAtUtc | datetime | ✓ | null | — | Thời điểm hoàn thành |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 13. Notification (Thông báo)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| UserId | UUID | ✗ | — | FK → User | Người nhận |
| TenantId | UUID | ✓ | null | FK → Tenant | Thuộc property nào (null = system-wide) |
| Title | varchar(200) | ✗ | — | — | Tiêu đề thông báo |
| Message | text | ✗ | — | — | Nội dung chi tiết |
| Type | enum | ✗ | System | — | Loại (Booking/Housekeeping/Payment/Subscription/Review/System) |
| IsRead | bool | ✗ | false | — | Đã đọc chưa? |
| ActionUrl | varchar(500) | ✓ | null | — | URL điều hướng khi click |
| ReadAtUtc | datetime | ✓ | null | — | Thời điểm đọc |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

---

## 14. Promotion (Khuyến mãi)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| Code | varchar(50) | ✗ | — | UNIQUE per Tenant | Mã khuyến mãi (VD: "SUMMER2026") |
| Name | varchar(200) | ✗ | — | — | Tên chương trình |
| Description | text | ✓ | null | — | Mô tả chi tiết |
| PromotionType | enum | ✗ | Percentage | — | Loại (Percentage/FixedAmount/FreeNight) |
| DiscountValue | decimal(18,2) | ✗ | — | > 0 | Giá trị giảm (% hoặc VND tùy loại) |
| MinOrderAmount | decimal(18,2) | ✓ | null | ≥ 0 | Đơn hàng tối thiểu để áp dụng |
| MaxUsageCount | int | ✓ | null | ≥ 1 | Số lần sử dụng tối đa (null = không giới hạn) |
| CurrentUsageCount | int | ✗ | 0 | ≥ 0 | Số lần đã sử dụng |
| ValidFrom | date | ✗ | — | — | Ngày bắt đầu hiệu lực |
| ValidTo | date | ✗ | — | ≥ ValidFrom | Ngày hết hiệu lực |
| IsActive | bool | ✗ | true | — | Đang hoạt động? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 15. GuestReview (Đánh giá của khách)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✗ | — | FK → Tenant | Thuộc property nào |
| ReservationId | UUID | ✗ | — | FK → Reservation | Booking liên quan |
| UserId | UUID | ✗ | — | FK → User | Khách viết đánh giá |
| Rating | int | ✗ | — | 1-5 | Điểm đánh giá (1 sao → 5 sao) |
| Comment | text | ✓ | null | — | Nội dung đánh giá |
| OwnerReply | text | ✓ | null | — | Phản hồi từ chủ property |
| RepliedAtUtc | datetime | ✓ | null | — | Thời điểm phản hồi |
| IsPublished | bool | ✗ | true | — | Hiển thị công khai? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |
| UpdatedAtUtc | datetime | ✗ | utcnow() | — | Cập nhật lần cuối |

---

## 16. AiUsageLog (Nhật ký sử dụng AI)

| Field | Type | Null | Default | Constraint | Mô tả |
|-------|------|:----:|---------|-----------|-------|
| Id | UUID | ✗ | newguid() | PK | Mã định danh |
| TenantId | UUID | ✓ | null | FK → Tenant | Thuộc property nào (null = system-level) |
| UserId | UUID | ✓ | null | FK → User | Người dùng kích hoạt (null = hệ thống tự động) |
| Tool | varchar(100) | ✗ | — | — | Mô hình AI (VD: "gemini-2.5-flash") |
| Scope | varchar(50) | ✗ | — | — | Phạm vi sử dụng (concierge/pricing/report) |
| PromptSummary | text | ✗ | — | — | Tóm tắt prompt đầu vào |
| ResponseSummary | text | ✗ | — | — | Tóm tắt kết quả trả về |
| TokensUsed | int | ✗ | — | ≥ 0 | Số tokens tiêu thụ |
| LatencyMs | int | ✗ | — | ≥ 0 | Thời gian phản hồi (ms) |
| IsSuccessful | bool | ✗ | — | — | Thành công? |
| CreatedAtUtc | datetime | ✗ | utcnow() | — | Thời điểm tạo |

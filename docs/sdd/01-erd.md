# 📊 Entity Relationship Diagram (ERD)

> **Tài liệu:** SDD-01 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (≥4 loại sơ đồ — ERD là loại thứ 1)

---

## 1. ERD Tổng quan

```mermaid
erDiagram
    Tenant ||--o{ Room : "has"
    Tenant ||--o{ RoomType : "has"
    Tenant ||--o{ Reservation : "has"
    Tenant ||--o{ TenantStaff : "employs"

    User ||--o{ TenantStaff : "works at"
    User ||--o{ RefreshToken : "authenticates with"
    User ||--o{ Reservation : "books (as guest)"

    RoomType ||--o{ Room : "categorizes"
    Room ||--o{ Reservation : "booked for"

    Reservation ||--o{ Payment : "paid via"

    AccessRole ||--o{ RolePermission : "has"
    PermissionFunction ||--o{ RolePermission : "grants"
    AccessRole ||--o{ TenantStaff : "assigned to"

    Reservation ||--o{ HousekeepingTask : "triggers"
    Room ||--o{ HousekeepingTask : "cleaned by"
    TenantStaff ||--o{ HousekeepingTask : "assigned to"

    Tenant ||--|| Subscription : "has"
    Subscription ||--o{ SubscriptionPayment : "paid via"
    Reservation ||--o{ Invoice : "invoiced"
    Invoice ||--o{ InvoiceItem : "contains"
    User ||--o{ Notification : "receives"
    Tenant ||--o{ Promotion : "offers"
    Reservation ||--o{ GuestReview : "reviewed"
    User ||--o{ GuestReview : "writes"
    User ||--o{ AiUsageLog : "triggers"
```

---

## 2. ERD Module: Authentication & RBAC

```mermaid
erDiagram
    User {
        uuid Id PK
        string Username UK
        string Email UK
        string PasswordHash
        string FullName
        string PhoneNumber
        string AvatarUrl
        datetime EmailVerifiedAtUtc
        enum GlobalRole "SuperAdmin | Customer | TenantStaff"
        bool IsActive
        uuid TenantId FK "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    RefreshToken {
        uuid Id PK
        uuid UserId FK
        string Token UK
        datetime ExpiresAtUtc
        datetime RevokedAtUtc "nullable"
        string ReplacedByToken "nullable"
        datetime CreatedAtUtc
    }

    Tenant {
        uuid Id PK
        string Name
        string Code UK
        string Slug UK
        string Description "nullable"
        string Address
        string City
        string PhoneNumber "nullable"
        string Email "nullable"
        string LogoUrl "nullable"
        enum PropertyType "Hotel | Hostel | B&B | Villa | Homestay"
        int StarRating
        time CheckInTime "default 14:00"
        time CheckOutTime "default 12:00"
        decimal TaxRatePercent
        decimal ServiceFeeRatePercent
        double Latitude "nullable"
        double Longitude "nullable"
        enum SubscriptionTier "Basic | Pro | Enterprise"
        enum Status "PendingApproval | Active | Suspended"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    TenantStaff {
        uuid Id PK
        uuid TenantId FK
        uuid UserId FK
        uuid RoleId FK
        enum StaffRole "Owner | Manager | Receptionist | Housekeeper"
        bool IsActive
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    AccessRole {
        uuid Id PK
        string Code UK
        string Name
        string Description "nullable"
        bool IsSystemRole
        uuid TenantId FK "nullable - null means global"
        datetime CreatedAtUtc
    }

    PermissionFunction {
        uuid Id PK
        string Code UK "e.g. RESERVATION, ROOM, PAYMENT"
        string Name
        string ModuleCode
        int SupportedActionMask "default 127 (all 7 actions)"
        bool IsActive
    }

    RolePermission {
        uuid Id PK
        uuid RoleId FK
        uuid FunctionId FK
        int ActionMask "bitmask: Read=1 Create=2 Update=4 Delete=8 Export=16 Approve=32 Execute=64"
    }

    User ||--o{ RefreshToken : "has"
    User ||--o{ TenantStaff : "profiles"
    Tenant ||--o{ TenantStaff : "staff"
    AccessRole ||--o{ RolePermission : "permissions"
    PermissionFunction ||--o{ RolePermission : "granted in"
    AccessRole ||--o{ TenantStaff : "assigned via"
```

---

## 3. ERD Module: Room & Reservation

```mermaid
erDiagram
    RoomType {
        uuid Id PK
        uuid TenantId FK
        string Name
        string Code
        string Description "nullable"
        decimal BasePrice
        int MaxOccupancy
        string BedType "nullable"
        decimal SquareMeters "nullable"
        string ImageUrl "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    Room {
        uuid Id PK
        uuid TenantId FK
        uuid RoomTypeId FK
        string RoomNumber
        int Floor
        enum Status "Clean | Dirty | Cleaning | Occupied | OutOfService"
        string Notes "nullable"
        bool IsActive
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    Reservation {
        uuid Id PK
        uuid TenantId FK
        uuid RoomId FK
        uuid GuestUserId FK "nullable - walk-in guest"
        string GuestName
        string GuestEmail
        string GuestPhone "nullable"
        date CheckInDate
        date CheckOutDate
        int NumberOfGuests
        decimal TotalAmount
        enum Status "PendingPayment | Confirmed | CheckedIn | CheckedOut | Cancelled | NoShow"
        string Notes "nullable"
        string ConfirmationCode UK "6-char uppercase"
        datetime CancelledAtUtc "nullable"
        string CancellationReason "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    Payment {
        uuid Id PK
        uuid TenantId FK
        uuid ReservationId FK
        decimal Amount
        enum Method "VNPay | Cash | BankTransfer | CreditCard"
        enum Status "Pending | Completed | Failed | Refunded | Expired"
        string TransactionRef "nullable - VNPay txn ref"
        string IdempotencyKey UK
        datetime PaidAtUtc "nullable"
        datetime CreatedAtUtc
    }

    RoomType ||--o{ Room : "categorizes"
    Room ||--o{ Reservation : "booked"
    Reservation ||--o{ Payment : "paid via"
    User ||--o{ Reservation : "guest"
```

---

## 4. ERD Module: Operations

```mermaid
erDiagram
    HousekeepingTask {
        uuid Id PK
        uuid TenantId FK
        uuid RoomId FK
        uuid AssignedToId FK "nullable - TenantStaff"
        uuid CreatedById FK "TenantStaff or system"
        enum Priority "Low | Normal | High | Urgent"
        enum Status "Pending | InProgress | Completed | Claimed"
        string Notes "nullable"
        datetime CompletedAtUtc "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    Notification {
        uuid Id PK
        uuid UserId FK
        string Title
        string Message
        string Type "booking | housekeeping | payment | system"
        bool IsRead
        string ActionUrl "nullable"
        datetime CreatedAtUtc
    }

    AuditLog {
        uuid Id PK
        uuid TenantId FK "nullable"
        uuid UserId FK
        string EntityType
        uuid EntityId
        string Action "Create | Update | Delete"
        string OldValues "JSON nullable"
        string NewValues "JSON nullable"
        string IpAddress "nullable"
        datetime CreatedAtUtc
    }

    AiUsageLog {
        uuid Id PK
        uuid TenantId FK "nullable"
        uuid UserId FK "nullable"
        string Tool "gemini-2.5-flash"
        string Scope "concierge | pricing | report"
        string PromptSummary
        string ResponseSummary
        int TokensUsed
        int LatencyMs
        bool IsSuccessful
        datetime CreatedAtUtc
    }

    Room ||--o{ HousekeepingTask : "cleaned"
    TenantStaff ||--o{ HousekeepingTask : "assigned"
    User ||--o{ Notification : "receives"
```

---

## 6. Quan hệ tổng hợp

| Quan hệ | Kiểu | Mô tả |
|---------|------|-------|
| Tenant → Room | 1:N | Mỗi property có nhiều phòng |
| Tenant → RoomType | 1:N | Mỗi property có nhiều loại phòng |
| Tenant → TenantStaff | 1:N | Mỗi property có nhiều nhân viên |
| Tenant → Reservation | 1:N | Mỗi property có nhiều booking |
| RoomType → Room | 1:N | Mỗi loại phòng có nhiều phòng thực tế |
| Room → Reservation | 1:N | Mỗi phòng có nhiều booking (theo thời gian) |
| Reservation → Payment | 1:N | Mỗi booking có thể có nhiều payment attempts |
| User → TenantStaff | 1:N | 1 user có thể làm ở nhiều property |
| User → Reservation | 1:N | 1 guest có thể đặt nhiều booking |
| User → RefreshToken | 1:N | 1 user có nhiều refresh tokens (multi-device) |
| AccessRole → RolePermission | 1:N | 1 role có nhiều permissions |
| PermissionFunction → RolePermission | 1:N | 1 function được gán cho nhiều roles |
| AccessRole → TenantStaff | 1:N | 1 role được gán cho nhiều staff |
| Room → HousekeepingTask | 1:N | 1 phòng có nhiều task theo thời gian |
| Tenant → Subscription | 1:1 | Mỗi property có 1 subscription |
| Subscription → SubscriptionPayment | 1:N | Mỗi subscription có nhiều thanh toán |
| Reservation → Invoice | 1:N | Mỗi booking có thể có nhiều hóa đơn |
| Invoice → InvoiceItem | 1:N | Mỗi hóa đơn có nhiều line items |
| User → HousekeepingTask | 1:N | 1 user được gán nhiều task dọn phòng |
| User → Notification | 1:N | 1 user nhận nhiều thông báo |
| Tenant → Promotion | 1:N | Mỗi property có nhiều khuyến mãi |
| Reservation → GuestReview | 1:N | Mỗi booking có thể có đánh giá |
| User → GuestReview | 1:N | 1 khách viết nhiều đánh giá |
| User → AiUsageLog | 1:N | 1 user có nhiều AI usage logs |

---

## 7. Index Strategy

| Table | Index | Columns | Type | Lý do |
|-------|-------|---------|------|-------|
| Reservation | IX_Reservation_TenantId | TenantId | Non-clustered | Multi-tenant filter |
| Reservation | IX_Reservation_RoomId_Dates | RoomId, CheckInDate, CheckOutDate | Composite | Overlap check |
| Reservation | IX_Reservation_ConfirmCode | ConfirmationCode | Unique | Quick lookup |
| Room | IX_Room_TenantId_Status | TenantId, Status | Composite | Available rooms query |
| Payment | IX_Payment_IdempotencyKey | IdempotencyKey | Unique | Prevent duplicate |
| User | IX_User_Email | Email | Unique | Login lookup |
| TenantStaff | IX_Staff_TenantId_UserId | TenantId, UserId | Unique | Prevent duplicate staff |

---

*Tài liệu này chứa 5 ERD diagrams (tổng quan + 4 module), phục vụ TC2.1 Mức 5. Tổng 23 entities, 56 quan hệ.*


## 5. ERD — Payment, Subscription & Operations

```mermaid
erDiagram
    Subscription {
        uuid Id PK
        uuid TenantId FK "UK — one per tenant"
        enum Plan "Basic | Pro | Enterprise"
        enum Status "Trial | Active | PastDue | Cancelled | Expired"
        enum BillingCycle "Monthly | Yearly"
        date CurrentPeriodStart
        date CurrentPeriodEnd
        date TrialEndsAt "nullable"
        datetime CancelledAtUtc "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    SubscriptionPayment {
        uuid Id PK
        uuid SubscriptionId FK
        decimal Amount
        string Currency "default VND"
        enum Status "Pending | Completed | Failed | Refunded"
        enum Method "VNPay | BankTransfer | CreditCard"
        string TransactionRef "nullable"
        string IdempotencyKey UK
        date PeriodStart
        date PeriodEnd
        datetime PaidAtUtc "nullable"
        datetime CreatedAtUtc
    }

    Invoice {
        uuid Id PK
        uuid TenantId FK
        uuid ReservationId FK
        string InvoiceNumber UK "auto-generated"
        decimal SubTotal
        decimal TaxAmount
        decimal ServiceFeeAmount
        decimal TotalAmount
        enum Status "Draft | Issued | Paid | Void | Refunded"
        datetime IssuedAtUtc "nullable"
        datetime PaidAtUtc "nullable"
        string Notes "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    InvoiceItem {
        uuid Id PK
        uuid InvoiceId FK
        string Description
        int Quantity
        decimal UnitPrice
        decimal LineTotal
        string Category "RoomCharge | Minibar | Laundry | Tax | ServiceFee | Discount"
        int SortOrder
        datetime CreatedAtUtc
    }

    HousekeepingTask {
        uuid Id PK
        uuid TenantId FK
        uuid RoomId FK
        uuid AssignedToId FK "nullable — User (housekeeper)"
        uuid CreatedById FK "User (manager/system)"
        enum Priority "Low | Normal | High | Urgent"
        enum Status "Pending | InProgress | Completed | Claimed"
        string Notes "nullable"
        datetime CompletedAtUtc "nullable"
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    Notification {
        uuid Id PK
        uuid UserId FK
        uuid TenantId FK "nullable"
        string Title
        string Message
        enum Type "Booking | Housekeeping | Payment | Subscription | Review | System"
        bool IsRead
        string ActionUrl "nullable"
        datetime ReadAtUtc "nullable"
        datetime CreatedAtUtc
    }

    Promotion {
        uuid Id PK
        uuid TenantId FK
        string Code UK "per tenant"
        string Name
        string Description "nullable"
        enum PromotionType "Percentage | FixedAmount | FreeNight"
        decimal DiscountValue
        decimal MinOrderAmount "nullable"
        int MaxUsageCount "nullable"
        int CurrentUsageCount "default 0"
        date ValidFrom
        date ValidTo
        bool IsActive
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    GuestReview {
        uuid Id PK
        uuid TenantId FK
        uuid ReservationId FK
        uuid UserId FK "guest user"
        int Rating "1-5"
        string Comment "nullable"
        string OwnerReply "nullable"
        datetime RepliedAtUtc "nullable"
        bool IsPublished
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
    }

    AiUsageLog {
        uuid Id PK
        uuid TenantId FK "nullable"
        uuid UserId FK "nullable"
        string Tool "gemini-2.5-flash"
        string Scope "concierge | pricing | report"
        string PromptSummary
        string ResponseSummary
        int TokensUsed
        int LatencyMs
        bool IsSuccessful
        datetime CreatedAtUtc
    }

    %% Relationships
    Tenant ||--|| Subscription : "has"
    Subscription ||--o{ SubscriptionPayment : "paid via"
    Reservation ||--o{ Invoice : "invoiced"
    Invoice ||--o{ InvoiceItem : "contains"
    Room ||--o{ HousekeepingTask : "cleaned"
    User ||--o{ HousekeepingTask : "assigned to"
    User ||--o{ Notification : "receives"
    Tenant ||--o{ Promotion : "offers"
    Reservation ||--o{ GuestReview : "reviewed"
    User ||--o{ GuestReview : "writes"
    User ||--o{ AiUsageLog : "triggers"
```

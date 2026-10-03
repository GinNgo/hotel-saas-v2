# 🔐 RBAC Design (Phân quyền chi tiết)

> **Tài liệu:** SDD-05 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (class diagram — loại sơ đồ thứ 5)

---

## 1. Mô hình RBAC 3 tầng

```mermaid
flowchart TD
    subgraph Global["🌍 Tầng 1: Global Level"]
        SA["SuperAdmin<br/>Quản trị platform"]
        Cust["Customer<br/>Khách hàng (Guest)"]
    end

    subgraph Tenant["🏢 Tầng 2: Tenant Level"]
        Owner["Owner<br/>Chủ cơ sở"]
        Manager["Manager<br/>Quản lý"]
        Recep["Receptionist<br/>Lễ tân"]
        HK["Housekeeper<br/>Buồng phòng"]
        Acc["Accountant<br/>Kế toán"]
        Custom["Custom Role...<br/>Tự tạo"]
    end

    subgraph Permission["🔑 Tầng 3: Permission Level"]
        Func["14 Permission Functions"]
        Act["7 Actions (bitmask)"]
        Func --- Act
    end

    SA -->|"bypass tenant filter"| Tenant
    Owner -->|"tạo & gán"| Custom
    Tenant -->|"gán permissions"| Permission

    style Global fill:#e8f5e9
    style Tenant fill:#e3f2fd
    style Permission fill:#fff3e0
```

---

## 2. Class Diagram — RBAC Entities

```mermaid
classDiagram
    class User {
        +Guid Id
        +string Email
        +string PasswordHash
        +GlobalUserRole GlobalRole
        +bool IsActive
        +ICollection~TenantStaff~ TenantStaffProfiles
    }

    class TenantStaff {
        +Guid Id
        +Guid TenantId
        +Guid UserId
        +Guid RoleId
        +StaffRole StaffRole
        +bool IsActive
    }

    class AccessRole {
        +Guid Id
        +string Code
        +string Name
        +bool IsSystemRole
        +Guid? TenantId
        +ICollection~RolePermission~ Permissions
    }

    class RolePermission {
        +Guid Id
        +Guid RoleId
        +Guid FunctionId
        +int ActionMask
        +bool HasAction(int action)
    }

    class PermissionFunction {
        +Guid Id
        +string Code
        +string Name
        +string ModuleCode
        +int SupportedActionMask
    }

    class PermissionAuthorizationHandler {
        +HandleRequirementAsync()
        -ExtractPermissions(claims)
        -CheckBitmask(userMask, requiredMask)
    }

    User "1" --> "*" TenantStaff : profiles
    TenantStaff "*" --> "1" AccessRole : has role
    AccessRole "1" --> "*" RolePermission : permissions
    RolePermission "*" --> "1" PermissionFunction : function
    PermissionAuthorizationHandler ..> RolePermission : checks
```

---

## 3. Permission Matrix đầy đủ

### Actions (Bitmask)

| Bit | Value | Action | Mô tả |
|:---:|:-----:|--------|-------|
| 0 | 1 | **Read** | Xem danh sách, chi tiết |
| 1 | 2 | **Create** | Tạo mới |
| 2 | 4 | **Update** | Sửa, cập nhật |
| 3 | 8 | **Delete** | Xóa |
| 4 | 16 | **Export** | Xuất PDF, Excel |
| 5 | 32 | **Approve** | Duyệt, phê duyệt |
| 6 | 64 | **Execute** | Thực thi action đặc biệt |

### Permission Functions × Default Roles

| Function | Module | Owner | Manager | Receptionist | Housekeeper | Accountant |
|----------|--------|:-----:|:-------:|:------------:|:-----------:|:----------:|
| **RESERVATION** | Booking | 127 | 127 | 7 (R,C,U) | 1 (R) | 1 (R) |
| **ROOM** | Rooms | 127 | 15 (R,C,U,D) | 1 (R) | 1 (R) | — |
| **ROOM_TYPE** | Rooms | 127 | 15 | 1 (R) | — | — |
| **HOUSEKEEPING** | Operations | 127 | 71 (R,C,U,Exec) | 1 (R) | 65 (R,Exec) | — |
| **PAYMENT** | Finance | 127 | 51 (R,C,Export) | 3 (R,C) | — | 49 (R,Export,Approve) |
| **INVOICE** | Finance | 127 | 17 (R,Export) | 1 (R) | — | 17 (R,Export) |
| **REPORT** | Analytics | 127 | 17 (R,Export) | — | — | 17 (R,Export) |
| **PRICING** | Revenue | 127 | 37 (R,U,Approve) | 1 (R) | — | 1 (R) |
| **NOTIFICATION** | System | 127 | 7 (R,C,U) | 1 (R) | 1 (R) | 1 (R) |
| **USER** | Admin | 127 | 7 (R,C,U) | — | — | — |
| **ROLE** | Admin | 127 | 1 (R) | — | — | — |
| **ROLE_PERMISSION** | Admin | 127 | — | — | — | — |
| **CHECKIN** | FrontDesk | 64 | 64 (Exec) | 64 (Exec) | — | — |
| **CHECKOUT** | FrontDesk | 64 | 64 (Exec) | 64 (Exec) | — | — |
| **PROMOTION** | Marketing | 127 | 39 (R,C,U,Approve) | 1 (R) | — | — |
| **AI_TASK** | AI | 127 | 35 (R,C,Approve) | — | — | — |
| **SETTINGS** | Admin | 127 | 5 (R,U) | — | — | — |

### Ví dụ bitmask calculation

```
Owner cho RESERVATION: Read(1) + Create(2) + Update(4) + Delete(8) +
                        Export(16) + Approve(32) + Execute(64) = 127

Receptionist cho RESERVATION: Read(1) + Create(2) + Update(4) = 7

Check: Does Receptionist have Delete?
  userMask = 7, requiredMask = 8 (Delete)
  (7 & 8) == 8 → (0) == 8 → FALSE → ❌ Denied
```

---

## 4. Frontend Permission Guard Strategy

```mermaid
flowchart TD
    Route["Angular Route<br/>/reservations"] --> Guard["PermissionGuard"]
    Guard --> Check{"Has permission<br/>RESERVATION:Read?"}
    Check -->|✅ Có| Allow["Render component"]
    Check -->|❌ Không| Deny["Redirect /403"]

    Allow --> Template["Template"]
    Template --> Directive["*hasPermission directive"]
    Directive --> BtnCheck{"User has<br/>RESERVATION:Create?"}
    BtnCheck -->|✅| ShowBtn["Hiện nút 'Tạo booking'"]
    BtnCheck -->|❌| HideBtn["Ẩn nút"]
```

### Implementation pattern

```typescript
// Route guard (functional)
export const reservationGuard = () =>
  inject(PermissionService).hasPermission('RESERVATION', Action.Read);

// Template directive
<button *hasPermission="['RESERVATION', 'Create']">
  Tạo đặt phòng
</button>

// Service check
if (permissionService.hasPermission('PRICING', Action.Update)) {
  // Show pricing editor
}
```

---

*Tài liệu này phục vụ TC2.1 Mức 5 (class diagram + RBAC design). Gồm 17 permission functions × 7 actions × 5 default roles.*

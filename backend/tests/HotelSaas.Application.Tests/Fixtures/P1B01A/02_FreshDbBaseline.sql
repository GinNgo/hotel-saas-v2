-- ==============================================================================
-- FIXTURE 02: Fresh Database Baseline DDL Script
-- Dự án: Hotel SaaS Platform (.NET 10 + PostgreSQL)
-- Giai đoạn: P1B-01A (Dual Baseline Migration Strategy)
-- Mục đích: Khởi tạo toàn diện lược đồ chuẩn cho một Database mới tinh (Empty DB),
--          bám sát 1:1 Domain Model thực tế trong HotelSaas.Domain,
--          đảm bảo quy tắc Không Cascade Dữ liệu Vận hành (RESTRICT),
--          2 Partial Unique Indexes cho Membership, và Composite Cross-Scope Guards.
-- ==============================================================================

-- 1. Bảng lịch sử EF Migrations
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
    "ProductVersion" character varying(32) NOT NULL
);

-- 2. Bảng Users (Tài khoản người dùng toàn cục - bám sát User.cs)
CREATE TABLE IF NOT EXISTS "Users" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Users" PRIMARY KEY,
    "Username" character varying(100) NOT NULL,
    "Email" character varying(200) NOT NULL,
    "PasswordHash" character varying(500) NOT NULL,
    "FullName" character varying(200) NOT NULL,
    "PhoneNumber" character varying(20),
    "AvatarUrl" character varying(500),
    "EmailVerifiedAtUtc" timestamp with time zone,
    "GlobalRole" integer NOT NULL DEFAULT 2,
    "IsActive" boolean NOT NULL DEFAULT true,
    "TenantId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_User_Email" ON "Users" ("Email");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_User_Username" ON "Users" ("Username");

-- 3. Bảng Tenants (Doanh nghiệp / Pháp nhân kinh doanh - bám sát Tenant.cs)
CREATE TABLE IF NOT EXISTS "Tenants" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Tenants" PRIMARY KEY,
    "Name" character varying(200) NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Slug" character varying(200) NOT NULL,
    "Description" text,
    "Address" character varying(500) NOT NULL,
    "City" character varying(100) NOT NULL,
    "PhoneNumber" character varying(20),
    "Email" character varying(200),
    "LogoUrl" character varying(500),
    "PropertyType" integer NOT NULL DEFAULT 1,
    "StarRating" integer NOT NULL DEFAULT 0,
    "CheckInTime" time without time zone NOT NULL DEFAULT '14:00:00',
    "CheckOutTime" time without time zone NOT NULL DEFAULT '12:00:00',
    "CancellationPolicy" text,
    "ChildrenPolicy" text,
    "PetPolicy" text,
    "HouseRules" text,
    "TaxRatePercent" numeric(5,2) NOT NULL DEFAULT 0.00,
    "ServiceFeeRatePercent" numeric(5,2) NOT NULL DEFAULT 0.00,
    "Latitude" double precision,
    "Longitude" double precision,
    "SubscriptionTier" integer NOT NULL DEFAULT 1,
    "Status" integer NOT NULL DEFAULT 1,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenant_Code" ON "Tenants" ("Code");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenant_Slug" ON "Tenants" ("Slug");

-- Khóa ngoại từ Users về Tenants (nếu có)
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "FK_Users_Tenants_TenantId";
ALTER TABLE "Users" ADD CONSTRAINT "FK_Users_Tenants_TenantId" 
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE SET NULL;

-- 4. Bảng Properties (Chi nhánh / Khách sạn vật lý) - KHÔNG CASCADE
CREATE TABLE IF NOT EXISTS "Properties" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Properties" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Slug" character varying(200) NOT NULL,
    "Description" text,
    "Address" character varying(500) NOT NULL,
    "City" character varying(100) NOT NULL,
    "PhoneNumber" character varying(20),
    "Email" character varying(200),
    "PropertyType" integer NOT NULL DEFAULT 1,
    "StarRating" integer NOT NULL DEFAULT 0,
    "CheckInTime" time without time zone NOT NULL DEFAULT '12:00:00',
    "CheckOutTime" time without time zone NOT NULL DEFAULT '12:00:00',
    "BufferMinutes" integer NOT NULL DEFAULT 30,
    "TaxRatePercent" numeric(5,2) NOT NULL DEFAULT 0.00,
    "ServiceFeeRatePercent" numeric(5,2) NOT NULL DEFAULT 0.00,
    "Latitude" double precision,
    "Longitude" double precision,
    "IsPublished" boolean NOT NULL DEFAULT false,
    "Status" integer NOT NULL DEFAULT 1,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Properties_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Property_TenantId_Code" ON "Properties" ("TenantId", "Code");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Property_Slug" ON "Properties" ("Slug");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Property_TenantId_Id" ON "Properties" ("TenantId", "Id");

-- 5. Bảng RBAC: AccessRoles, PermissionFunctions, RolePermissions (bám sát model AccessRole.cs, PermissionFunction.cs, RolePermission.cs)
CREATE TABLE IF NOT EXISTS "AccessRoles" (
    "Id" uuid NOT NULL CONSTRAINT "PK_AccessRoles" PRIMARY KEY,
    "TenantId" uuid,
    "Name" character varying(100) NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Description" character varying(250),
    "IsSystemRole" boolean NOT NULL DEFAULT false,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_AccessRoles_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "PermissionFunctions" (
    "Id" uuid NOT NULL CONSTRAINT "PK_PermissionFunctions" PRIMARY KEY,
    "Code" character varying(50) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "ModuleCode" character varying(50) NOT NULL,
    "SupportedActionMask" integer NOT NULL DEFAULT 127,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "RolePermissions" (
    "Id" uuid NOT NULL CONSTRAINT "PK_RolePermissions" PRIMARY KEY,
    "RoleId" uuid NOT NULL,
    "FunctionId" uuid NOT NULL,
    "ActionMask" integer NOT NULL DEFAULT 0,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_RolePermissions_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AccessRoles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RolePermissions_PermissionFunctions_FunctionId" FOREIGN KEY ("FunctionId") REFERENCES "PermissionFunctions" ("Id") ON DELETE CASCADE
);

-- 6. Bảng TenantStaffMembers (Hồ sơ Nhân sự & Phân quyền - bám sát TenantStaff.cs)
CREATE TABLE IF NOT EXISTS "TenantStaffMembers" (
    "Id" uuid NOT NULL CONSTRAINT "PK_TenantStaffMembers" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid,
    "UserId" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "StaffRole" integer NOT NULL DEFAULT 4,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_TenantStaffMembers_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_TenantStaffMembers_Properties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_TenantStaffMembers_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_TenantStaffMembers_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AccessRoles" ("Id") ON DELETE RESTRICT
);

-- 2 PARTIAL UNIQUE INDEXES CHO MEMBERSHIP
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_tenant_wide
ON "TenantStaffMembers" ("TenantId", "UserId")
WHERE "PropertyId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_property_scoped
ON "TenantStaffMembers" ("TenantId", "UserId", "PropertyId")
WHERE "PropertyId" IS NOT NULL;

-- 7. Bảng RoomTypes & Rooms (bám sát RoomType.cs & Room.cs - KHÔNG CASCADE VẬN HÀNH)
CREATE TABLE IF NOT EXISTS "RoomTypes" (
    "Id" uuid NOT NULL CONSTRAINT "PK_RoomTypes" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "Name" character varying(100) NOT NULL,
    "Code" character varying(20) NOT NULL,
    "Description" text,
    "BasePrice" numeric(18,2) NOT NULL,
    "MaxOccupancy" integer NOT NULL DEFAULT 2,
    "BedType" character varying(50),
    "SquareMeters" numeric(6,2),
    "ImageUrl" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_RoomTypes_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_RoomTypes_Properties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_RoomType_PropertyId_Code" ON "RoomTypes" ("PropertyId", "Code");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_RoomTypes_PropertyId_Id" ON "RoomTypes" ("PropertyId", "Id");

CREATE TABLE IF NOT EXISTS "Rooms" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Rooms" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "RoomTypeId" uuid NOT NULL,
    "RoomNumber" character varying(20) NOT NULL,
    "Floor" integer NOT NULL DEFAULT 1,
    "Status" integer NOT NULL DEFAULT 1,
    "Notes" text,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Rooms_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Rooms_Properties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Rooms_RoomTypes_RoomTypeId" FOREIGN KEY ("RoomTypeId") REFERENCES "RoomTypes" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Room_PropertyId_RoomNumber" ON "Rooms" ("PropertyId", "RoomNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Rooms_PropertyId_Id" ON "Rooms" ("PropertyId", "Id");

-- 8. Bảng Reservations & Payments (bám sát Reservation.cs & Payment.cs - KHÔNG CASCADE VẬN HÀNH/TÀI CHÍNH)
CREATE TABLE IF NOT EXISTS "Reservations" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Reservations" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "RoomId" uuid NOT NULL,
    "GuestUserId" uuid,
    "GuestName" character varying(200) NOT NULL,
    "GuestEmail" character varying(200) NOT NULL,
    "GuestPhone" character varying(20),
    "CheckInDate" date NOT NULL,
    "CheckOutDate" date NOT NULL,
    "NumberOfGuests" integer NOT NULL DEFAULT 1,
    "TotalAmount" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL DEFAULT 1,
    "Notes" text,
    "ConfirmationCode" character varying(6) NOT NULL,
    "CancelledAtUtc" timestamp with time zone,
    "CancellationReason" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Reservations_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Reservations_Properties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Reservations_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Reservations_Users_GuestUserId" FOREIGN KEY ("GuestUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Reservation_ConfirmationCode" ON "Reservations" ("ConfirmationCode");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Reservations_PropertyId_Id" ON "Reservations" ("PropertyId", "Id");

CREATE TABLE IF NOT EXISTS "Payments" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Payments" PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "ReservationId" uuid NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "Method" integer NOT NULL DEFAULT 1,
    "Status" integer NOT NULL DEFAULT 1,
    "TransactionRef" character varying(100),
    "PaidAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Payments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_Properties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_Reservations_ReservationId" FOREIGN KEY ("ReservationId") REFERENCES "Reservations" ("Id") ON DELETE RESTRICT
);

-- 9. Bảng RefreshTokens (Protected Security Data - bám sát RefreshToken.cs)
CREATE TABLE IF NOT EXISTS "RefreshTokens" (
    "Id" uuid NOT NULL CONSTRAINT "PK_RefreshTokens" PRIMARY KEY,
    "UserId" uuid NOT NULL,
    "Token" character varying(500) NOT NULL,
    "ExpiresAtUtc" timestamp with time zone NOT NULL,
    "RevokedAtUtc" timestamp with time zone,
    "ReplacedByToken" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_RefreshTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_RefreshToken_Token" ON "RefreshTokens" ("Token");

-- 10. RÀNG BUỘC PHỨC HỢP NGĂN CHẶN LỖI CHÉO SCOPE (CROSS-SCOPE CONSTRAINT GUARDS)
-- 10.1. Buộc Room.TenantId == Property.TenantId
ALTER TABLE "Rooms" DROP CONSTRAINT IF EXISTS "FK_Rooms_Properties_Tenant_Property";
ALTER TABLE "Rooms" ADD CONSTRAINT "FK_Rooms_Properties_Tenant_Property"
    FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;

-- 10.2. Buộc RoomType.TenantId == Property.TenantId
ALTER TABLE "RoomTypes" DROP CONSTRAINT IF EXISTS "FK_RoomTypes_Properties_Tenant_Property";
ALTER TABLE "RoomTypes" ADD CONSTRAINT "FK_RoomTypes_Properties_Tenant_Property"
    FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;

-- 10.3. Buộc Room.PropertyId == RoomType.PropertyId
ALTER TABLE "Rooms" DROP CONSTRAINT IF EXISTS "FK_Rooms_RoomTypes_Property_RoomType";
ALTER TABLE "Rooms" ADD CONSTRAINT "FK_Rooms_RoomTypes_Property_RoomType"
    FOREIGN KEY ("PropertyId", "RoomTypeId") REFERENCES "RoomTypes" ("PropertyId", "Id") ON DELETE RESTRICT;

-- 10.4. Buộc Reservation.TenantId == Property.TenantId
ALTER TABLE "Reservations" DROP CONSTRAINT IF EXISTS "FK_Reservations_Properties_Tenant_Property";
ALTER TABLE "Reservations" ADD CONSTRAINT "FK_Reservations_Properties_Tenant_Property"
    FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;

-- 10.5. Buộc Payment.TenantId == Property.TenantId
ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "FK_Payments_Properties_Tenant_Property";
ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Properties_Tenant_Property"
    FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;

-- 10.6. Buộc Reservation.PropertyId == Room.PropertyId
ALTER TABLE "Reservations" DROP CONSTRAINT IF EXISTS "FK_Reservations_Rooms_Property_Room";
ALTER TABLE "Reservations" ADD CONSTRAINT "FK_Reservations_Rooms_Property_Room"
    FOREIGN KEY ("PropertyId", "RoomId") REFERENCES "Rooms" ("PropertyId", "Id") ON DELETE RESTRICT;

-- 10.7. Buộc Payment.PropertyId == Reservation.PropertyId
ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "FK_Payments_Reservations_Property_Res";
ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Reservations_Property_Res"
    FOREIGN KEY ("PropertyId", "ReservationId") REFERENCES "Reservations" ("PropertyId", "Id") ON DELETE RESTRICT;

-- 10.8. Buộc TenantStaff.TenantId == Property.TenantId (khi PropertyId IS NOT NULL)
ALTER TABLE "TenantStaffMembers" DROP CONSTRAINT IF EXISTS "FK_TenantStaffMembers_Properties_Tenant_Property";
ALTER TABLE "TenantStaffMembers" ADD CONSTRAINT "FK_TenantStaffMembers_Properties_Tenant_Property"
    FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;

-- 11. Đánh dấu Migration History cho Fresh DB
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES 
    ('20261006000000_InitialBaseline', '10.0.12'),
    ('20261006010000_P1B01A_MultiProperty_Foundation', '10.0.12')
ON CONFLICT DO NOTHING;

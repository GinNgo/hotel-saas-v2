CREATE TABLE "PermissionFunctions" (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "ModuleCode" text NOT NULL,
    "SupportedActionMask" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PermissionFunctions" PRIMARY KEY ("Id")
);


CREATE TABLE "Promotions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "Type" integer NOT NULL,
    "Value" numeric NOT NULL,
    "MinNights" integer NOT NULL,
    "MaxUsage" integer,
    "CurrentUsage" integer NOT NULL,
    "StartsAtUtc" timestamp with time zone NOT NULL,
    "EndsAtUtc" timestamp with time zone NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Promotions" PRIMARY KEY ("Id")
);


CREATE TABLE "SubscriptionPlans" (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "MonthlyPrice" numeric NOT NULL,
    "YearlyPrice" numeric NOT NULL,
    "MaxRooms" integer NOT NULL,
    "MaxStaff" integer NOT NULL,
    "HasVnPay" boolean NOT NULL,
    "HasAdvancedReports" boolean NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SubscriptionPlans" PRIMARY KEY ("Id")
);


CREATE TABLE "SystemBanners" (
    "Id" uuid NOT NULL,
    "Title" text NOT NULL,
    "ImageUrl" text NOT NULL,
    "TargetUrl" text,
    "TargetPlanCode" text,
    "ValidFromUtc" timestamp with time zone,
    "ValidToUtc" timestamp with time zone,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SystemBanners" PRIMARY KEY ("Id")
);


CREATE TABLE "Tenants" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "Slug" text NOT NULL,
    "Description" text,
    "Address" text NOT NULL,
    "City" text NOT NULL,
    "PhoneNumber" text,
    "Email" text,
    "LogoUrl" text,
    "PropertyType" integer NOT NULL,
    "StarRating" integer NOT NULL,
    "CheckInTime" time without time zone NOT NULL,
    "CheckOutTime" time without time zone NOT NULL,
    "CancellationPolicy" text,
    "ChildrenPolicy" text,
    "PetPolicy" text,
    "HouseRules" text,
    "TaxRatePercent" numeric NOT NULL,
    "ServiceFeeRatePercent" numeric NOT NULL,
    "Latitude" double precision,
    "Longitude" double precision,
    "SubscriptionTier" integer NOT NULL,
    "Status" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Tenants" PRIMARY KEY ("Id")
);


CREATE TABLE "AccessRoles" (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "IsSystemRole" boolean NOT NULL,
    "TenantId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AccessRoles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AccessRoles_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id")
);


CREATE TABLE "RoomTypes" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "Description" text,
    "BasePrice" numeric NOT NULL,
    "MaxOccupancy" integer NOT NULL,
    "BedType" text,
    "SquareMeters" numeric,
    "ImageUrl" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_RoomTypes" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RoomTypes_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
);


CREATE TABLE "Subscriptions" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Tier" integer NOT NULL,
    "BillingCycle" integer NOT NULL,
    "Status" integer NOT NULL,
    "PricePerCycle" numeric NOT NULL,
    "Currency" text NOT NULL,
    "TrialEndsAtUtc" timestamp with time zone,
    "CurrentPeriodStartUtc" timestamp with time zone NOT NULL,
    "CurrentPeriodEndUtc" timestamp with time zone NOT NULL,
    "AutoRenew" boolean NOT NULL,
    "CancelledAtUtc" timestamp with time zone,
    "CancelReason" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Subscriptions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Subscriptions_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
);


CREATE TABLE "Users" (
    "Id" uuid NOT NULL,
    "Username" text NOT NULL,
    "Email" text NOT NULL,
    "PasswordHash" text NOT NULL,
    "FullName" text NOT NULL,
    "PhoneNumber" text,
    "AvatarUrl" text,
    "EmailVerifiedAtUtc" timestamp with time zone,
    "GlobalRole" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Users_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id")
);


CREATE TABLE "RolePermissions" (
    "Id" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "FunctionId" uuid NOT NULL,
    "ActionMask" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_RolePermissions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RolePermissions_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AccessRoles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RolePermissions_PermissionFunctions_FunctionId" FOREIGN KEY ("FunctionId") REFERENCES "PermissionFunctions" ("Id") ON DELETE CASCADE
);


CREATE TABLE "Rooms" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "RoomTypeId" uuid NOT NULL,
    "RoomNumber" text NOT NULL,
    "Floor" integer NOT NULL,
    "Status" integer NOT NULL,
    "Notes" text,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Rooms" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Rooms_RoomTypes_RoomTypeId" FOREIGN KEY ("RoomTypeId") REFERENCES "RoomTypes" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Rooms_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
);


CREATE TABLE "SubscriptionPayments" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "SubscriptionId" uuid NOT NULL,
    "Amount" numeric NOT NULL,
    "Method" integer NOT NULL,
    "Status" integer NOT NULL,
    "TransactionRef" text,
    "InvoiceNumber" text,
    "PaidAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SubscriptionPayments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SubscriptionPayments_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES "Subscriptions" ("Id") ON DELETE CASCADE
);


CREATE TABLE "AiUsageLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "UserId" uuid,
    "Feature" text NOT NULL,
    "Prompt" text NOT NULL,
    "Response" text NOT NULL,
    "ModelUsed" text NOT NULL,
    "InputTokens" integer NOT NULL,
    "OutputTokens" integer NOT NULL,
    "DurationMs" integer NOT NULL,
    "IsSuccess" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AiUsageLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AiUsageLogs_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id")
);


CREATE TABLE "Notifications" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Type" integer NOT NULL,
    "Title" text NOT NULL,
    "Message" text NOT NULL,
    "IsRead" boolean NOT NULL,
    "ReadAtUtc" timestamp with time zone,
    "Data" text,
    "RelatedEntityId" uuid,
    "RelatedEntityType" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Notifications_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);


CREATE TABLE "RefreshTokens" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Token" text NOT NULL,
    "ExpiresAtUtc" timestamp with time zone NOT NULL,
    "RevokedAtUtc" timestamp with time zone,
    "ReplacedByToken" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_RefreshTokens" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RefreshTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);


CREATE TABLE "TenantStaffMembers" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "StaffRole" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TenantStaffMembers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TenantStaffMembers_AccessRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AccessRoles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_TenantStaffMembers_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_TenantStaffMembers_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);


CREATE TABLE "HousekeepingTasks" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "RoomId" uuid NOT NULL,
    "AssignedToUserId" uuid,
    "AssignedToId" uuid,
    "Status" integer NOT NULL,
    "Priority" integer NOT NULL,
    "Notes" text,
    "StartedAtUtc" timestamp with time zone,
    "CompletedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_HousekeepingTasks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_HousekeepingTasks_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_HousekeepingTasks_Users_AssignedToId" FOREIGN KEY ("AssignedToId") REFERENCES "Users" ("Id")
);


CREATE TABLE "Reservations" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "RoomId" uuid NOT NULL,
    "GuestUserId" uuid,
    "GuestName" text NOT NULL,
    "GuestEmail" text NOT NULL,
    "GuestPhone" text,
    "CheckInDate" date NOT NULL,
    "CheckOutDate" date NOT NULL,
    "NumberOfGuests" integer NOT NULL,
    "TotalAmount" numeric NOT NULL,
    "Status" integer NOT NULL,
    "Notes" text,
    "ConfirmationCode" text NOT NULL,
    "CancelledAtUtc" timestamp with time zone,
    "CancellationReason" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Reservations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Reservations_Rooms_RoomId" FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Reservations_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Reservations_Users_GuestUserId" FOREIGN KEY ("GuestUserId") REFERENCES "Users" ("Id")
);


CREATE TABLE "GuestReviews" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "ReservationId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "OverallRating" integer NOT NULL,
    "CleanlinessRating" integer,
    "LocationRating" integer,
    "ServiceRating" integer,
    "ValueRating" integer,
    "Comment" text,
    "OwnerReply" text,
    "RepliedAtUtc" timestamp with time zone,
    "IsPublished" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_GuestReviews" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_GuestReviews_Reservations_ReservationId" FOREIGN KEY ("ReservationId") REFERENCES "Reservations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_GuestReviews_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);


CREATE TABLE "Invoices" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "ReservationId" uuid NOT NULL,
    "InvoiceNumber" text NOT NULL,
    "IssuedAtUtc" timestamp with time zone NOT NULL,
    "GuestName" text NOT NULL,
    "GuestIdNumber" text,
    "GuestPhone" text,
    "GuestEmail" text,
    "PropertyName" text NOT NULL,
    "PropertyAddress" text NOT NULL,
    "PropertyPhone" text,
    "PropertyTaxCode" text,
    "Subtotal" numeric NOT NULL,
    "TaxRate" numeric NOT NULL,
    "TaxAmount" numeric NOT NULL,
    "ServiceFeeRate" numeric NOT NULL,
    "ServiceFeeAmount" numeric NOT NULL,
    "DiscountAmount" numeric NOT NULL,
    "GrandTotal" numeric NOT NULL,
    "PaidAmount" numeric NOT NULL,
    "Balance" numeric NOT NULL,
    "Notes" text,
    "Status" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Invoices" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Invoices_Reservations_ReservationId" FOREIGN KEY ("ReservationId") REFERENCES "Reservations" ("Id") ON DELETE CASCADE
);


CREATE TABLE "Payments" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "ReservationId" uuid NOT NULL,
    "Amount" numeric NOT NULL,
    "Method" integer NOT NULL,
    "Status" integer NOT NULL,
    "TransactionRef" text,
    "PaidAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Payments_Reservations_ReservationId" FOREIGN KEY ("ReservationId") REFERENCES "Reservations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Payments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
);


CREATE TABLE "InvoiceItems" (
    "Id" uuid NOT NULL,
    "InvoiceId" uuid NOT NULL,
    "ItemCode" text NOT NULL,
    "Description" text NOT NULL,
    "Quantity" integer NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "Amount" numeric NOT NULL,
    "SortOrder" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_InvoiceItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_InvoiceItems_Invoices_InvoiceId" FOREIGN KEY ("InvoiceId") REFERENCES "Invoices" ("Id") ON DELETE CASCADE
);


CREATE INDEX "IX_AccessRoles_TenantId" ON "AccessRoles" ("TenantId");


CREATE INDEX "IX_AiUsageLogs_UserId" ON "AiUsageLogs" ("UserId");


CREATE INDEX "IX_GuestReviews_ReservationId" ON "GuestReviews" ("ReservationId");


CREATE INDEX "IX_GuestReviews_UserId" ON "GuestReviews" ("UserId");


CREATE INDEX "IX_HousekeepingTasks_AssignedToId" ON "HousekeepingTasks" ("AssignedToId");


CREATE INDEX "IX_HousekeepingTasks_RoomId" ON "HousekeepingTasks" ("RoomId");


CREATE INDEX "IX_InvoiceItems_InvoiceId" ON "InvoiceItems" ("InvoiceId");


CREATE INDEX "IX_Invoices_ReservationId" ON "Invoices" ("ReservationId");


CREATE INDEX "IX_Notifications_UserId" ON "Notifications" ("UserId");


CREATE INDEX "IX_Payments_ReservationId" ON "Payments" ("ReservationId");


CREATE INDEX "IX_Payments_TenantId" ON "Payments" ("TenantId");


CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");


CREATE INDEX "IX_Reservations_GuestUserId" ON "Reservations" ("GuestUserId");


CREATE INDEX "IX_Reservations_RoomId" ON "Reservations" ("RoomId");


CREATE INDEX "IX_Reservations_TenantId" ON "Reservations" ("TenantId");


CREATE INDEX "IX_RolePermissions_FunctionId" ON "RolePermissions" ("FunctionId");


CREATE INDEX "IX_RolePermissions_RoleId" ON "RolePermissions" ("RoleId");


CREATE INDEX "IX_Rooms_RoomTypeId" ON "Rooms" ("RoomTypeId");


CREATE INDEX "IX_Rooms_TenantId" ON "Rooms" ("TenantId");


CREATE INDEX "IX_RoomTypes_TenantId" ON "RoomTypes" ("TenantId");


CREATE INDEX "IX_SubscriptionPayments_SubscriptionId" ON "SubscriptionPayments" ("SubscriptionId");


CREATE INDEX "IX_Subscriptions_TenantId" ON "Subscriptions" ("TenantId");


CREATE INDEX "IX_TenantStaffMembers_RoleId" ON "TenantStaffMembers" ("RoleId");


CREATE INDEX "IX_TenantStaffMembers_TenantId" ON "TenantStaffMembers" ("TenantId");


CREATE INDEX "IX_TenantStaffMembers_UserId" ON "TenantStaffMembers" ("UserId");


CREATE INDEX "IX_Users_TenantId" ON "Users" ("TenantId");



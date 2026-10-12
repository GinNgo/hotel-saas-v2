-- ==============================================================================
-- FIXTURE 01: Schema Pre-Check & Recovery Script
-- Dự án: Hotel SaaS Platform (.NET 10 + PostgreSQL)
-- Giai đoạn: P1B-01A (Dual Baseline Migration Strategy)
-- Mục đích: Kiểm tra toàn diện 100% lược đồ baseline đối chiếu với EF Core model:
--          1. Toàn bộ 22 bảng baseline của ApplicationDbContext
--          2. Định nghĩa Primary Key (PK) trên toàn bộ 22 bảng (PRIMARY KEY ("Id"))
--          3. Định nghĩa Foreign Key (FK) toàn diện: xác thực bảng nguồn, cột nguồn,
--             bảng đích, cột đích và hành vi tham chiếu qua pg_get_constraintdef
--          4. Các chỉ mục (Indexes) do mô hình EF Core sinh ra
--          5. Cột, kiểu dữ liệu (data_type) và nullability (is_nullable)
--          CHỈ recovery bản ghi InitialBaseline khi ĐÃ ĐỐI CHIẾU 100% CẤU TRÚC TRÊN.
--          Phát hiện sai lệch kiểu dữ liệu, thiếu bảng, hoặc FK trỏ sai -> ABORT NGAY.
-- ==============================================================================

-- 1. Tạo bảng __EFMigrationsHistory nếu chưa tồn tại trong schema hiện tại
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
    "ProductVersion" character varying(32) NOT NULL
);

-- 2. Khối Pre-check đối chiếu toàn bộ Schema Baseline & Verified Recovery
DO $$
DECLARE
    v_schema text := current_schema();
    v_has_properties boolean := false;
    v_has_rooms_property_id boolean := false;
    v_has_baseline_record boolean := false;
    
    v_total_required_tables integer := 22;
    v_existing_tables_count integer := 0;
    v_missing_elements text := '';
    
    v_tbl_exists boolean;
    v_col_valid boolean;
    v_pk_valid boolean;
    v_fk_valid boolean;
    v_idx_valid boolean;
    v_tbl text;
    
    -- Danh sách toàn bộ 22 bảng baseline theo EF Core ApplicationDbContext
    v_required_tables text[] := ARRAY[
        'Tenants', 'Users', 'AccessRoles', 'PermissionFunctions', 'RolePermissions',
        'TenantStaffMembers', 'RefreshTokens', 'RoomTypes', 'Rooms', 'Reservations',
        'Payments', 'Subscriptions', 'SubscriptionPayments', 'Invoices', 'InvoiceItems',
        'HousekeepingTasks', 'Notifications', 'Promotions', 'GuestReviews', 'AiUsageLogs',
        'SubscriptionPlans', 'SystemBanners'
    ];

    -- Manifest toàn bộ 134 cột thuộc 22 bảng baseline theo EF Core ApplicationDbContext
    -- Cấu trúc: [table_name, column_name, data_type, is_nullable, character_maximum_length, numeric_precision, numeric_scale, column_default]
    v_column_manifest text[][] := ARRAY[
        ARRAY['AccessRoles', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'Description', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'IsSystemRole', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'TenantId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AccessRoles', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'DurationMs', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['AiUsageLogs', 'Feature', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'InputTokens', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['AiUsageLogs', 'IsSuccess', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'ModelUsed', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'OutputTokens', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['AiUsageLogs', 'Prompt', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'Response', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['AiUsageLogs', 'UserId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'CleanlinessRating', 'integer', 'YES', 'NA', '32', '0', 'NONE'],
        ARRAY['GuestReviews', 'Comment', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'IsPublished', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'LocationRating', 'integer', 'YES', 'NA', '32', '0', 'NONE'],
        ARRAY['GuestReviews', 'OverallRating', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['GuestReviews', 'OwnerReply', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'RepliedAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'ReservationId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'ServiceRating', 'integer', 'YES', 'NA', '32', '0', 'NONE'],
        ARRAY['GuestReviews', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'UserId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['GuestReviews', 'ValueRating', 'integer', 'YES', 'NA', '32', '0', 'NONE'],
        ARRAY['HousekeepingTasks', 'AssignedToId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'AssignedToUserId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'CompletedAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'Notes', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'Priority', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['HousekeepingTasks', 'RoomId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'StartedAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['HousekeepingTasks', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['HousekeepingTasks', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'Amount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'Description', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'InvoiceId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'ItemCode', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'Quantity', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['InvoiceItems', 'SortOrder', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['InvoiceItems', 'UnitPrice', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['InvoiceItems', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'Balance', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'DiscountAmount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'GrandTotal', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'GuestEmail', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'GuestIdNumber', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'GuestName', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'GuestPhone', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'InvoiceNumber', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'IssuedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'Notes', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'PaidAmount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'PropertyAddress', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'PropertyName', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'PropertyPhone', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'PropertyTaxCode', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'ReservationId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'ServiceFeeAmount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'ServiceFeeRate', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Invoices', 'Subtotal', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'TaxAmount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'TaxRate', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Invoices', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'Data', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'IsRead', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'Message', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'ReadAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'RelatedEntityId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'RelatedEntityType', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'Title', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'Type', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Notifications', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Notifications', 'UserId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'Amount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'Method', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Payments', 'PaidAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'ReservationId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Payments', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'TransactionRef', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Payments', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'ModuleCode', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['PermissionFunctions', 'SupportedActionMask', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['PermissionFunctions', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'CurrentUsage', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Promotions', 'Description', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'EndsAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'MaxUsage', 'integer', 'YES', 'NA', '32', '0', 'NONE'],
        ARRAY['Promotions', 'MinNights', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Promotions', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'StartsAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'Type', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Promotions', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Promotions', 'Value', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'ExpiresAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'ReplacedByToken', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'RevokedAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'Token', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RefreshTokens', 'UserId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'CancellationReason', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'CancelledAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'CheckInDate', 'date', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'CheckOutDate', 'date', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'ConfirmationCode', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'GuestEmail', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'GuestName', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'GuestPhone', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'GuestUserId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'Notes', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'NumberOfGuests', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Reservations', 'RoomId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Reservations', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'TotalAmount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Reservations', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RolePermissions', 'ActionMask', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['RolePermissions', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RolePermissions', 'FunctionId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RolePermissions', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RolePermissions', 'RoleId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RolePermissions', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'BasePrice', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'BedType', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'Description', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'ImageUrl', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'MaxOccupancy', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['RoomTypes', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'SquareMeters', 'numeric', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['RoomTypes', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'Floor', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Rooms', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'Notes', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'RoomNumber', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'RoomTypeId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Rooms', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Rooms', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'Amount', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'InvoiceNumber', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'Method', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['SubscriptionPayments', 'PaidAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['SubscriptionPayments', 'SubscriptionId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'TransactionRef', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPayments', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'HasAdvancedReports', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'HasVnPay', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'MaxRooms', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['SubscriptionPlans', 'MaxStaff', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['SubscriptionPlans', 'MonthlyPrice', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SubscriptionPlans', 'YearlyPrice', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'AutoRenew', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'BillingCycle', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Subscriptions', 'CancelReason', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'CancelledAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'Currency', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'CurrentPeriodEndUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'CurrentPeriodStartUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'PricePerCycle', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Subscriptions', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'Tier', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Subscriptions', 'TrialEndsAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Subscriptions', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'ImageUrl', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'TargetPlanCode', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'TargetUrl', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'Title', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'ValidFromUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['SystemBanners', 'ValidToUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'RoleId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'StaffRole', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['TenantStaffMembers', 'TenantId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['TenantStaffMembers', 'UserId', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Address', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'CancellationPolicy', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'CheckInTime', 'time without time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'CheckOutTime', 'time without time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'ChildrenPolicy', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'City', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Code', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Description', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Email', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'HouseRules', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Latitude', 'double precision', 'YES', 'NA', '53', 'NA', 'NONE'],
        ARRAY['Tenants', 'LogoUrl', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Longitude', 'double precision', 'YES', 'NA', '53', 'NA', 'NONE'],
        ARRAY['Tenants', 'Name', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'PetPolicy', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'PhoneNumber', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'PropertyType', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Tenants', 'ServiceFeeRatePercent', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'Slug', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'StarRating', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Tenants', 'Status', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Tenants', 'SubscriptionTier', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Tenants', 'TaxRatePercent', 'numeric', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Tenants', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'AvatarUrl', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'CreatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'Email', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'EmailVerifiedAtUtc', 'timestamp with time zone', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'FullName', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'GlobalRole', 'integer', 'NO', 'NA', '32', '0', 'NONE'],
        ARRAY['Users', 'Id', 'uuid', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'IsActive', 'boolean', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'PasswordHash', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'PhoneNumber', 'text', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'TenantId', 'uuid', 'YES', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'UpdatedAtUtc', 'timestamp with time zone', 'NO', 'NA', 'NA', 'NA', 'NONE'],
        ARRAY['Users', 'Username', 'text', 'NO', 'NA', 'NA', 'NA', 'NONE']
    ];
    v_col_row text[];

    -- Manifest toàn bộ 26 Non-PK Indexes độc lập đã chuẩn hóa schema theo EF Core ApplicationDbContext
    -- Cấu trúc: [table_name, index_name, is_unique, access_method, key_columns, predicate, normalized_def]
    v_index_manifest text[][] := ARRAY[
        ARRAY['AccessRoles', 'IX_AccessRoles_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_AccessRoles_TenantId" ON "AccessRoles" USING btree ("TenantId")'],
        ARRAY['AiUsageLogs', 'IX_AiUsageLogs_UserId', 'NO', 'btree', '("UserId")', 'NONE', 'CREATE INDEX "IX_AiUsageLogs_UserId" ON "AiUsageLogs" USING btree ("UserId")'],
        ARRAY['GuestReviews', 'IX_GuestReviews_ReservationId', 'NO', 'btree', '("ReservationId")', 'NONE', 'CREATE INDEX "IX_GuestReviews_ReservationId" ON "GuestReviews" USING btree ("ReservationId")'],
        ARRAY['GuestReviews', 'IX_GuestReviews_UserId', 'NO', 'btree', '("UserId")', 'NONE', 'CREATE INDEX "IX_GuestReviews_UserId" ON "GuestReviews" USING btree ("UserId")'],
        ARRAY['HousekeepingTasks', 'IX_HousekeepingTasks_AssignedToId', 'NO', 'btree', '("AssignedToId")', 'NONE', 'CREATE INDEX "IX_HousekeepingTasks_AssignedToId" ON "HousekeepingTasks" USING btree ("AssignedToId")'],
        ARRAY['HousekeepingTasks', 'IX_HousekeepingTasks_RoomId', 'NO', 'btree', '("RoomId")', 'NONE', 'CREATE INDEX "IX_HousekeepingTasks_RoomId" ON "HousekeepingTasks" USING btree ("RoomId")'],
        ARRAY['InvoiceItems', 'IX_InvoiceItems_InvoiceId', 'NO', 'btree', '("InvoiceId")', 'NONE', 'CREATE INDEX "IX_InvoiceItems_InvoiceId" ON "InvoiceItems" USING btree ("InvoiceId")'],
        ARRAY['Invoices', 'IX_Invoices_ReservationId', 'NO', 'btree', '("ReservationId")', 'NONE', 'CREATE INDEX "IX_Invoices_ReservationId" ON "Invoices" USING btree ("ReservationId")'],
        ARRAY['Notifications', 'IX_Notifications_UserId', 'NO', 'btree', '("UserId")', 'NONE', 'CREATE INDEX "IX_Notifications_UserId" ON "Notifications" USING btree ("UserId")'],
        ARRAY['Payments', 'IX_Payments_ReservationId', 'NO', 'btree', '("ReservationId")', 'NONE', 'CREATE INDEX "IX_Payments_ReservationId" ON "Payments" USING btree ("ReservationId")'],
        ARRAY['Payments', 'IX_Payments_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_Payments_TenantId" ON "Payments" USING btree ("TenantId")'],
        ARRAY['RefreshTokens', 'IX_RefreshTokens_UserId', 'NO', 'btree', '("UserId")', 'NONE', 'CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" USING btree ("UserId")'],
        ARRAY['Reservations', 'IX_Reservations_GuestUserId', 'NO', 'btree', '("GuestUserId")', 'NONE', 'CREATE INDEX "IX_Reservations_GuestUserId" ON "Reservations" USING btree ("GuestUserId")'],
        ARRAY['Reservations', 'IX_Reservations_RoomId', 'NO', 'btree', '("RoomId")', 'NONE', 'CREATE INDEX "IX_Reservations_RoomId" ON "Reservations" USING btree ("RoomId")'],
        ARRAY['Reservations', 'IX_Reservations_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_Reservations_TenantId" ON "Reservations" USING btree ("TenantId")'],
        ARRAY['RolePermissions', 'IX_RolePermissions_FunctionId', 'NO', 'btree', '("FunctionId")', 'NONE', 'CREATE INDEX "IX_RolePermissions_FunctionId" ON "RolePermissions" USING btree ("FunctionId")'],
        ARRAY['RolePermissions', 'IX_RolePermissions_RoleId', 'NO', 'btree', '("RoleId")', 'NONE', 'CREATE INDEX "IX_RolePermissions_RoleId" ON "RolePermissions" USING btree ("RoleId")'],
        ARRAY['RoomTypes', 'IX_RoomTypes_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_RoomTypes_TenantId" ON "RoomTypes" USING btree ("TenantId")'],
        ARRAY['Rooms', 'IX_Rooms_RoomTypeId', 'NO', 'btree', '("RoomTypeId")', 'NONE', 'CREATE INDEX "IX_Rooms_RoomTypeId" ON "Rooms" USING btree ("RoomTypeId")'],
        ARRAY['Rooms', 'IX_Rooms_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_Rooms_TenantId" ON "Rooms" USING btree ("TenantId")'],
        ARRAY['SubscriptionPayments', 'IX_SubscriptionPayments_SubscriptionId', 'NO', 'btree', '("SubscriptionId")', 'NONE', 'CREATE INDEX "IX_SubscriptionPayments_SubscriptionId" ON "SubscriptionPayments" USING btree ("SubscriptionId")'],
        ARRAY['Subscriptions', 'IX_Subscriptions_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_Subscriptions_TenantId" ON "Subscriptions" USING btree ("TenantId")'],
        ARRAY['TenantStaffMembers', 'IX_TenantStaffMembers_RoleId', 'NO', 'btree', '("RoleId")', 'NONE', 'CREATE INDEX "IX_TenantStaffMembers_RoleId" ON "TenantStaffMembers" USING btree ("RoleId")'],
        ARRAY['TenantStaffMembers', 'IX_TenantStaffMembers_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_TenantStaffMembers_TenantId" ON "TenantStaffMembers" USING btree ("TenantId")'],
        ARRAY['TenantStaffMembers', 'IX_TenantStaffMembers_UserId', 'NO', 'btree', '("UserId")', 'NONE', 'CREATE INDEX "IX_TenantStaffMembers_UserId" ON "TenantStaffMembers" USING btree ("UserId")'],
        ARRAY['Users', 'IX_Users_TenantId', 'NO', 'btree', '("TenantId")', 'NONE', 'CREATE INDEX "IX_Users_TenantId" ON "Users" USING btree ("TenantId")']
    ];
    v_idx_row text[];

    -- Danh sách toàn diện 26 Foreign Keys cốt lõi: (Bảng nguồn, Cột nguồn, Bảng đích, Cột đích, ON DELETE action: 'a'=NO ACTION, 'c'=CASCADE)
    v_fk_checks text[][] := ARRAY[
        ARRAY['AccessRoles', 'TenantId', 'Tenants', 'Id', 'a'],
        ARRAY['AiUsageLogs', 'UserId', 'Users', 'Id', 'a'],
        ARRAY['GuestReviews', 'ReservationId', 'Reservations', 'Id', 'c'],
        ARRAY['GuestReviews', 'UserId', 'Users', 'Id', 'c'],
        ARRAY['HousekeepingTasks', 'AssignedToId', 'Users', 'Id', 'a'],
        ARRAY['HousekeepingTasks', 'RoomId', 'Rooms', 'Id', 'c'],
        ARRAY['InvoiceItems', 'InvoiceId', 'Invoices', 'Id', 'c'],
        ARRAY['Invoices', 'ReservationId', 'Reservations', 'Id', 'c'],
        ARRAY['Notifications', 'UserId', 'Users', 'Id', 'c'],
        ARRAY['Payments', 'ReservationId', 'Reservations', 'Id', 'c'],
        ARRAY['Payments', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['RefreshTokens', 'UserId', 'Users', 'Id', 'c'],
        ARRAY['Reservations', 'GuestUserId', 'Users', 'Id', 'a'],
        ARRAY['Reservations', 'RoomId', 'Rooms', 'Id', 'c'],
        ARRAY['Reservations', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['RolePermissions', 'FunctionId', 'PermissionFunctions', 'Id', 'c'],
        ARRAY['RolePermissions', 'RoleId', 'AccessRoles', 'Id', 'c'],
        ARRAY['RoomTypes', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['Rooms', 'RoomTypeId', 'RoomTypes', 'Id', 'c'],
        ARRAY['Rooms', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['SubscriptionPayments', 'SubscriptionId', 'Subscriptions', 'Id', 'c'],
        ARRAY['Subscriptions', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['TenantStaffMembers', 'RoleId', 'AccessRoles', 'Id', 'c'],
        ARRAY['TenantStaffMembers', 'TenantId', 'Tenants', 'Id', 'c'],
        ARRAY['TenantStaffMembers', 'UserId', 'Users', 'Id', 'c'],
        ARRAY['Users', 'TenantId', 'Tenants', 'Id', 'a']
    ];
    v_fk_row text[];
BEGIN
    -- 2.1. ĐẾM VÀ KIỂM TRA SỰ TỒN TẠI CỦA TOÀN BỘ 22 BẢNG BASELINE
    FOREACH v_tbl IN ARRAY v_required_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = v_schema AND table_name = v_tbl
        ) INTO v_tbl_exists;

        IF v_tbl_exists THEN
            v_existing_tables_count := v_existing_tables_count + 1;
        ELSE
            v_missing_elements := v_missing_elements || '[Table ' || v_tbl || '] ';
        END IF;
    END LOOP;

    -- TÌNH HUỐNG 1: Fresh Empty Database (0 bảng baseline)
    IF v_existing_tables_count = 0 THEN
        RAISE NOTICE '[PRE-CHECK] Database hoàn toàn mới (0 baseline tables). Sẵn sàng cho 02_FreshDbBaseline.sql. KHÔNG auto-stamp baseline.';
        RETURN;
    END IF;

    -- TÌNH HUỐNG 2: Thiếu bảng baseline
    IF v_existing_tables_count < v_total_required_tables THEN
        RAISE EXCEPTION '[PRE-CHECK ABORT] Phát hiện Schema Drift! Tìm thấy %/22 bảng baseline nhưng thiếu: %. Hủy thực thi để bảo toàn dữ liệu.', 
            v_existing_tables_count, TRIM(v_missing_elements);
    END IF;

    -- 2.2. KIỂM TRA ĐỊNH NGHĨA PRIMARY KEY TRÊN TOÀN BỘ 22 BẢNG
    FOREACH v_tbl IN ARRAY v_required_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class cl ON cl.oid = c.conrelid
            WHERE c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = v_schema)
              AND c.contype = 'p'
              AND cl.relname = v_tbl
              AND pg_get_constraintdef(c.oid) LIKE 'PRIMARY KEY ("Id")%'
        ) INTO v_pk_valid;

        IF NOT v_pk_valid THEN
            v_missing_elements := v_missing_elements || '[PK Definition on ' || v_tbl || '] ';
        END IF;
    END LOOP;

    -- 2.3. KIỂM TRA ĐỊNH NGHĨA TOÀN DIỆN 26 FOREIGN KEYS (BẢNG NGUỒN, CỘT NGUỒN, BẢNG ĐÍCH, CỘT ĐÍCH, ON DELETE ACTION, TARGET SCHEMA)
    FOREACH v_fk_row SLICE 1 IN ARRAY v_fk_checks
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class cl_src ON cl_src.oid = c.conrelid
            JOIN pg_class cl_dst ON cl_dst.oid = c.confrelid
            WHERE c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = v_schema)
              AND cl_dst.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v_schema)
              AND c.contype = 'f'
              AND c.confdeltype = v_fk_row[5]
              AND cl_src.relname = v_fk_row[1]
              AND cl_dst.relname = v_fk_row[3]
              AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY ("' || v_fk_row[2] || '") REFERENCES %("' || v_fk_row[4] || '")%'
        ) INTO v_fk_valid;

        IF NOT v_fk_valid THEN
            v_missing_elements := v_missing_elements || '[FK ' || v_fk_row[1] || '.' || v_fk_row[2] || ' -> ' || v_fk_row[3] || '.' || v_fk_row[4] || ' (del=' || v_fk_row[5] || ' in schema ' || v_schema || ')] ';
        END IF;
    END LOOP;

    -- 2.4. KIỂM TRA ĐỊNH NGHĨA CÁC CHỈ MỤC (INDEXES) CỦA EF CORE
    -- 2.4.1. Unique Indexes trên toàn bộ 22 bảng baseline (PK Unique Indexes do EF Core sinh ra)
    FOREACH v_tbl IN ARRAY v_required_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes i
            WHERE i.schemaname = v_schema 
              AND i.tablename = v_tbl 
              AND i.indexname = 'PK_' || v_tbl
              AND i.indexdef LIKE '%UNIQUE INDEX%'
        ) INTO v_idx_valid;

        IF NOT v_idx_valid THEN
            v_missing_elements := v_missing_elements || '[Unique Index PK_' || v_tbl || ' on ' || v_tbl || '] ';
        END IF;
    END LOOP;

    -- 2.4.2. Toàn bộ 26 Chỉ mục độc lập (Non-PK Independent Indexes do EF Core sinh ra)
    -- FOREACH loop checking normalized index definition (method, uniqueness, key/include columns, predicate)
    FOREACH v_idx_row SLICE 1 IN ARRAY v_index_manifest
    LOOP
        SELECT EXISTS (
            SELECT 1 
            FROM pg_index idx
            JOIN pg_class c_idx ON c_idx.oid = idx.indexrelid
            JOIN pg_class c_tbl ON c_tbl.oid = idx.indrelid
            JOIN pg_am am ON am.oid = c_idx.relam
            WHERE c_tbl.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v_schema)
              AND c_tbl.relname = v_idx_row[1]
              AND c_idx.relname = v_idx_row[2]
              AND (CASE WHEN idx.indisunique THEN 'YES' ELSE 'NO' END) = v_idx_row[3]
              AND am.amname = v_idx_row[4]
              AND TRIM(REGEXP_REPLACE(
                    REGEXP_REPLACE(pg_get_indexdef(c_idx.oid), '^.* USING [a-z]+ ', ''),
                    ' WHERE .*$', ''
                  )) = v_idx_row[5]
              AND COALESCE(pg_get_expr(idx.indpred, idx.indrelid), 'NONE') = v_idx_row[6]
              AND REPLACE(REPLACE(pg_get_indexdef(c_idx.oid), v_schema || '.', ''), '"' || v_schema || '".', '') = v_idx_row[7]
        ) INTO v_idx_valid;

        IF NOT v_idx_valid THEN
            v_missing_elements := v_missing_elements || '[Index ' || v_idx_row[1] || '.' || v_idx_row[2] || ' (method=' || v_idx_row[4] || ', unique=' || v_idx_row[3] || ', cols=' || v_idx_row[5] || ', pred=' || v_idx_row[6] || ')] ';
        END IF;
    END LOOP;

    -- 2.5. KIỂM TRA ĐỐI CHIẾU 100% CỘT VỚI MANIFEST BASELINE EF CORE (ĐẦY ĐỦ TYPE, NULLABILITY, LENGTH, PRECISION, SCALE, DEFAULT)
    FOREACH v_col_row SLICE 1 IN ARRAY v_column_manifest
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = v_schema 
              AND c.table_name = v_col_row[1] 
              AND c.column_name = v_col_row[2]
              AND c.data_type = v_col_row[3]
              AND c.is_nullable = v_col_row[4]
              AND COALESCE(c.character_maximum_length::text, 'NA') = v_col_row[5]
              AND COALESCE(c.numeric_precision::text, 'NA') = v_col_row[6]
              AND COALESCE(c.numeric_scale::text, 'NA') = v_col_row[7]
              AND COALESCE(c.column_default, 'NONE') = v_col_row[8]
        ) INTO v_col_valid;

        IF NOT v_col_valid THEN
            v_missing_elements := v_missing_elements || '[Col ' || v_col_row[1] || '.' || v_col_row[2] || ' (' || v_col_row[3] || ', null=' || v_col_row[4] || ', len=' || v_col_row[5] || ', prec=' || v_col_row[6] || ', scale=' || v_col_row[7] || ', def=' || v_col_row[8] || ')] ';
        END IF;
    END LOOP;
    -- 2.6. NẾU CÓ BẤT KỲ SAI LỆCH NÀO -> ABORT NGAY LẬP TỨC
    IF v_missing_elements <> '' THEN
        RAISE EXCEPTION '[PRE-CHECK ABORT] Phát hiện Schema Drift! Cơ sở dữ liệu không đạt chuẩn baseline. Thiếu hoặc sai lệch: %. Hủy thực thi, KHÔNG stamp InitialBaseline.', 
            TRIM(v_missing_elements);
    END IF;

    -- 2.7. XÁC NHẬN VÀ STAMP BẢN GHI LỊCH SỬ KHI TOÀN DIỆN SCHEMA HỢP LỆ
    SELECT EXISTS (
        SELECT 1 FROM "__EFMigrationsHistory" 
        WHERE "MigrationId" = '20261006000000_InitialBaseline'
    ) INTO v_has_baseline_record;

    IF NOT v_has_baseline_record THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20261006000000_InitialBaseline', '10.0.12');
        RAISE NOTICE '[PRE-CHECK RECOVERY] Đã kiểm chứng toàn diện 100%% 22 bảng, PK, 26 FK (source+target), indexes và cột cốt lõi. Đã seed an toàn InitialBaseline.';
    ELSE
        RAISE NOTICE '[PRE-CHECK] Database đã có đầy đủ cấu trúc và bản ghi InitialBaseline.';
    END IF;

    -- Kiểm tra trạng thái lược đồ P1B
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = v_schema AND table_name = 'Properties'
    ) INTO v_has_properties;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = v_schema AND table_name = 'Rooms' AND column_name = 'PropertyId'
    ) INTO v_has_rooms_property_id;

    IF v_has_properties AND v_has_rooms_property_id THEN
        RAISE NOTICE '[PRE-CHECK] Lược đồ Properties và PropertyId đã tồn tại. Sẵn sàng hoạt động.';
    ELSE
        RAISE NOTICE '[PRE-CHECK] Cần thực thi script differential migration 03_ExistingDbMigrationBackfill.sql.';
    END IF;

END $$;

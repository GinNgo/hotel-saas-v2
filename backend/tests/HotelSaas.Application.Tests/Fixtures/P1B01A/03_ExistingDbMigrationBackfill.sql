-- ==============================================================================
-- FIXTURE 03: Existing Database Migration & Explicit Backfill Script
-- Dự án: Hotel SaaS Platform (.NET 10 + PostgreSQL)
-- Giai đoạn: P1B-01A (Dual Baseline Migration Strategy)
-- Mục đích: Chuyển đổi an toàn cho database hiện hữu sinh từ EnsureCreated:
--   1. Schema Pre-check từng element & Baseline recovery (chỉ stamp khi verify đủ 11 bảng)
--   2. Tạo bảng Properties (Tax/Fee mặc định 0.00 theo D25)
--   3. Backfill chi nhánh MAIN kế thừa trung thực địa điểm/policy/thuế/phí/publication
--   4. Kiểm tra unknown role trước khi map, fail-fast nếu gặp role lạ
--   5. Mapping PropertyId tường minh (không dùng mệnh đề giới hạn tùy tiện)
--   6. Kiểm tra ràng buộc scope (Scope Constraint Validation)
--   7. Khóa ngoại Không Cascade Dữ liệu Vận hành (RESTRICT)
--   8. Gỡ bỏ unique cũ và tạo 2 Partial Unique Indexes
--   9. Thiết lập khóa ngoại phức hợp ngăn ngừa triệt để lỗi chéo scope (Cross-scope Guard)
-- ==============================================================================

-- BƯỚC 1: ĐẢM BẢO BẢNG LỊCH SỬ VÀ KIỂM CHỨNG SCHEMA TỪNG ELEMENT
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
    "ProductVersion" character varying(32) NOT NULL
);

DO $$
DECLARE
    v_schema text := current_schema();
    v_total_required_tables integer := 22;
    v_existing_tables_count integer := 0;
    v_missing_elements text := '';
    v_tbl_exists boolean;
    v_col_valid boolean;
    v_pk_valid boolean;
    v_fk_valid boolean;
    v_idx_valid boolean;
    v_has_baseline_record boolean := false;
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
    -- 1.1. ĐẾM VÀ KIỂM TRA SỰ TỒN TẠI CỦA TOÀN BỘ 22 BẢNG BASELINE
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

    IF v_existing_tables_count < v_total_required_tables THEN
        RAISE EXCEPTION '[MIGRATION ABORT] Phát hiện Schema Drift! Tìm thấy %/22 bảng baseline nhưng thiếu: %. Hủy giao dịch để bảo toàn dữ liệu.', 
            v_existing_tables_count, TRIM(v_missing_elements);
    END IF;

    -- 1.2. KIỂM TRA ĐỊNH NGHĨA PRIMARY KEY TRÊN TOÀN BỘ 22 BẢNG
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

    -- 1.3. KIỂM TRA ĐỊNH NGHĨA TOÀN DIỆN 26 FOREIGN KEYS (BẢNG NGUỒN, CỘT NGUỒN, BẢNG ĐÍCH, CỘT ĐÍCH, ON DELETE ACTION, TARGET SCHEMA)
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

    -- 1.4. KIỂM TRA ĐỊNH NGHĨA CÁC CHỈ MỤC (INDEXES) CỦA EF CORE
    -- 1.4.1. Unique Indexes trên toàn bộ 22 bảng baseline (PK Unique Indexes do EF Core sinh ra)
    FOREACH v_tbl IN ARRAY v_required_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_index idx
            JOIN pg_class c_idx ON c_idx.oid = idx.indexrelid
            JOIN pg_class c_tbl ON c_tbl.oid = idx.indrelid
            WHERE c_tbl.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v_schema)
              AND c_tbl.relname = v_tbl
              AND c_idx.relname = 'PK_' || v_tbl
              AND idx.indisunique = true
        ) INTO v_idx_valid;

        IF NOT v_idx_valid THEN
            v_missing_elements := v_missing_elements || '[Unique Index PK_' || v_tbl || ' on ' || v_tbl || '] ';
        END IF;
    END LOOP;

    -- 1.4.2. Toàn bộ 26 Chỉ mục độc lập (Non-PK Independent Indexes do EF Core sinh ra)
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

    -- 1.5. KIỂM TRA ĐỐI CHIẾU 100% CỘT VỚI MANIFEST BASELINE EF CORE (ĐẦY ĐỦ TYPE, NULLABILITY, LENGTH, PRECISION, SCALE, DEFAULT)
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
    -- 1.6. NẾU CÓ BẤT KỲ SAI LỆCH NÀO -> ABORT NGAY LẬP TỨC
    IF v_missing_elements <> '' THEN
        RAISE EXCEPTION '[MIGRATION ABORT] Phát hiện Schema Drift! Cơ sở dữ liệu không đạt chuẩn baseline. Thiếu hoặc sai lệch: %. Hủy giao dịch để bảo toàn dữ liệu.', 
            TRIM(v_missing_elements);
    END IF;

    -- 1.7. XÁC NHẬN VÀ STAMP BẢN GHI LỊCH SỬ KHI TOÀN DIỆN SCHEMA HỢP LỆ
    SELECT EXISTS (
        SELECT 1 FROM "__EFMigrationsHistory" 
        WHERE "MigrationId" = '20261006000000_InitialBaseline'
    ) INTO v_has_baseline_record;

    IF NOT v_has_baseline_record THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20261006000000_InitialBaseline', '10.0.12');
        RAISE NOTICE '[MIGRATION RECOVERY] Đã kiểm chứng toàn diện 100%% cấu trúc 22 bảng, PK, 26 FK (source+target), indexes và cột cốt lõi. Đã seed an toàn InitialBaseline.';
    END IF;
END $$;

-- BƯỚC 2: TẠO BẢNG PROPERTIES (MẶC ĐỊNH THUẾ/PHÍ = 0.00 THEO D25)
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
    "CheckInTime" time without time zone NOT NULL DEFAULT '14:00:00',
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

-- BƯỚC 3: BACKFILL CHI NHÁNH MẶC ĐỊNH — BẢO TOÀN TRUNG THỰC ĐỊA ĐIỂM, POLICY, THUẾ, PHÍ & PUBLICATION
INSERT INTO "Properties" (
    "Id", "TenantId", "Name", "Code", "Slug", "Description",
    "Address", "City", "PhoneNumber", "Email", "PropertyType",
    "StarRating", "CheckInTime", "CheckOutTime", "BufferMinutes", 
    "TaxRatePercent", "ServiceFeeRatePercent",
    "Latitude", "Longitude",
    "IsPublished", "Status",
    "CreatedAtUtc", "UpdatedAtUtc"
)
SELECT 
    gen_random_uuid(),
    t."Id",
    CONCAT(t."Name", ' - Chi nhánh chính'),
    'MAIN',
    CONCAT(t."Slug", '-main'),
    t."Description",
    COALESCE(NULLIF(t."Address", ''), 'Chưa cập nhật địa chỉ'),
    COALESCE(NULLIF(t."City", ''), 'Chưa cập nhật tỉnh/thành'),
    t."PhoneNumber",
    t."Email",
    COALESCE(t."PropertyType", 1),
    COALESCE(t."StarRating", 0),
    COALESCE(t."CheckInTime", '14:00:00'::time),               -- BẢO TOÀN GIỜ CHECK-IN CỦA TENANT
    COALESCE(t."CheckOutTime", '12:00:00'::time),              -- BẢO TOÀN GIỜ CHECK-OUT CỦA TENANT
    30,
    COALESCE(t."TaxRatePercent", 0.00),                        -- BẢO TOÀN THUẾ ĐÃ CẤU HÌNH (KHÔNG ÉP CỐ ĐỊNH)
    COALESCE(t."ServiceFeeRatePercent", 0.00),                 -- BẢO TOÀN PHÍ ĐÃ CẤU HÌNH (KHÔNG ÉP CỐ ĐỊNH)
    t."Latitude",
    t."Longitude",
    FALSE,                                                     -- BỎ ACTIVE->PUBLISHED: Không tự động publish, mặc định false để bảo đảm an toàn dữ liệu
    CASE WHEN t."Status" = 2 THEN 1 ELSE 0 END,
    NOW() AT TIME ZONE 'UTC',
    NOW() AT TIME ZONE 'UTC'
FROM "Tenants" t
WHERE NOT EXISTS (
    SELECT 1 FROM "Properties" p WHERE p."TenantId" = t."Id" AND p."Code" = 'MAIN'
);

-- BƯỚC 4: THÊM CỘT PropertyId (NULLABLE BAN ĐẦU) VÀO CÁC BẢNG LIÊN QUAN
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'Rooms' AND column_name = 'PropertyId') THEN
        ALTER TABLE "Rooms" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'RoomTypes' AND column_name = 'PropertyId') THEN
        ALTER TABLE "RoomTypes" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'Reservations' AND column_name = 'PropertyId') THEN
        ALTER TABLE "Reservations" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'Payments' AND column_name = 'PropertyId') THEN
        ALTER TABLE "Payments" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'TenantStaffMembers' AND column_name = 'PropertyId') THEN
        ALTER TABLE "TenantStaffMembers" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'Invoices') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'Invoices' AND column_name = 'PropertyId') THEN
        ALTER TABLE "Invoices" ADD COLUMN "PropertyId" uuid;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'HousekeepingTasks') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = v_schema AND table_name = 'HousekeepingTasks' AND column_name = 'PropertyId') THEN
        ALTER TABLE "HousekeepingTasks" ADD COLUMN "PropertyId" uuid;
    END IF;
END $$;

-- BƯỚC 5: KIỂM TRA ROLE HỢP LỆ TRƯỚC KHI MAPPING (UNKNOWN ROLE FAIL)
DO $$
DECLARE
    v_unknown_role_count integer := 0;
BEGIN
    SELECT COUNT(*) INTO v_unknown_role_count
    FROM "TenantStaffMembers"
    WHERE "StaffRole" NOT IN (1, 2, 3, 4);

    IF v_unknown_role_count > 0 THEN
        RAISE EXCEPTION '[MIGRATION ABORT] Phát hiện % nhân sự có StaffRole không hợp lệ. Dừng toàn bộ migration.', v_unknown_role_count;
    END IF;
END $$;

-- BƯỚC 6: MAPPING PROPERTY TƯỜNG MINH (EXPLICIT MAPPING)
-- 6.1. Rooms: Map qua TenantId và Code = 'MAIN'
UPDATE "Rooms" r
SET "PropertyId" = p."Id"
FROM "Properties" p
WHERE p."TenantId" = r."TenantId" 
  AND p."Code" = 'MAIN'
  AND r."PropertyId" IS NULL;

-- 6.2. RoomTypes: Map qua TenantId và Code = 'MAIN'
UPDATE "RoomTypes" rt
SET "PropertyId" = p."Id"
FROM "Properties" p
WHERE p."TenantId" = rt."TenantId" 
  AND p."Code" = 'MAIN'
  AND rt."PropertyId" IS NULL;

-- 6.3. Reservations: Map ưu tiên theo Room đã có PropertyId cùng Tenant
UPDATE "Reservations" res
SET "PropertyId" = r."PropertyId"
FROM "Rooms" r
WHERE r."Id" = res."RoomId"
  AND r."TenantId" = res."TenantId"
  AND res."PropertyId" IS NULL;

-- 6.4. Reservations fallback: Map về chi nhánh MAIN cùng Tenant
UPDATE "Reservations" res
SET "PropertyId" = p."Id"
FROM "Properties" p
WHERE p."TenantId" = res."TenantId"
  AND p."Code" = 'MAIN'
  AND res."PropertyId" IS NULL;

-- 6.5. Payments: Map qua Reservation cùng TenantId
UPDATE "Payments" pay
SET "PropertyId" = res."PropertyId"
FROM "Reservations" res
WHERE res."Id" = pay."ReservationId"
  AND res."TenantId" = pay."TenantId"
  AND pay."PropertyId" IS NULL;

-- 6.6. Invoices (nếu có): Map qua Reservation cùng TenantId
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'Invoices') THEN
        UPDATE "Invoices" inv
        SET "PropertyId" = res."PropertyId"
        FROM "Reservations" res
        WHERE res."Id" = inv."ReservationId" 
          AND res."TenantId" = inv."TenantId"
          AND inv."PropertyId" IS NULL;
    END IF;
END $$;

-- 6.7. HousekeepingTasks (nếu có): Map qua Room cùng TenantId
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'HousekeepingTasks') THEN
        UPDATE "HousekeepingTasks" ht
        SET "PropertyId" = r."PropertyId"
        FROM "Rooms" r
        WHERE r."Id" = ht."RoomId" 
          AND r."TenantId" = ht."TenantId"
          AND ht."PropertyId" IS NULL;
    END IF;
END $$;

-- BƯỚC 7: BACKFILL MEMBERSHIP PHÂN ĐỊNH THEO ROLE
-- 7.1. Cấp Chi nhánh (Manager=2, Receptionist=3, Housekeeper=4) -> Gán PropertyId chi nhánh MAIN
UPDATE "TenantStaffMembers" staff
SET "PropertyId" = p."Id"
FROM "Properties" p
WHERE p."TenantId" = staff."TenantId"
  AND p."Code" = 'MAIN'
  AND staff."StaffRole" IN (2, 3, 4)
  AND staff."PropertyId" IS NULL;

-- 7.2. Cấp Doanh nghiệp (Owner=1) -> BẮT BUỘC PropertyId = NULL (Tenant-wide)
UPDATE "TenantStaffMembers" staff
SET "PropertyId" = NULL
WHERE staff."StaffRole" = 1;

-- BƯỚC 8: KIỂM TRA RÀNG BUỘC PHẠM VI (SCOPE CONSTRAINT VALIDATION)
DO $$
DECLARE
    v_unmapped_rooms integer := 0;
    v_unmapped_reservations integer := 0;
    v_unmapped_payments integer := 0;
    v_scope_mismatch integer := 0;
BEGIN
    SELECT COUNT(*) INTO v_unmapped_rooms FROM "Rooms" WHERE "PropertyId" IS NULL;
    IF v_unmapped_rooms > 0 THEN
        RAISE EXCEPTION '[SCOPE CHECK] Phát hiện % phòng chưa được gán PropertyId. Aborting.', v_unmapped_rooms;
    END IF;

    SELECT COUNT(*) INTO v_unmapped_reservations FROM "Reservations" WHERE "PropertyId" IS NULL;
    IF v_unmapped_reservations > 0 THEN
        RAISE EXCEPTION '[SCOPE CHECK] Phát hiện % đơn đặt phòng chưa được gán PropertyId. Aborting.', v_unmapped_reservations;
    END IF;

    SELECT COUNT(*) INTO v_unmapped_payments FROM "Payments" WHERE "PropertyId" IS NULL;
    IF v_unmapped_payments > 0 THEN
        RAISE EXCEPTION '[SCOPE CHECK] Phát hiện % giao dịch thanh toán chưa được gán PropertyId. Aborting.', v_unmapped_payments;
    END IF;

    -- Kiểm tra lệch scope giữa Room và Reservation
    SELECT COUNT(*) INTO v_scope_mismatch
    FROM "Reservations" res
    JOIN "Rooms" r ON res."RoomId" = r."Id"
    WHERE res."TenantId" <> r."TenantId" OR res."PropertyId" <> r."PropertyId";

    IF v_scope_mismatch > 0 THEN
        RAISE EXCEPTION '[SCOPE CHECK] Phát hiện % đơn đặt phòng lệch TenantId hoặc PropertyId so với phòng được chọn. Aborting.', v_scope_mismatch;
    END IF;

    -- Kiểm tra lệch scope giữa Payment và Reservation
    SELECT COUNT(*) INTO v_scope_mismatch
    FROM "Payments" pay
    JOIN "Reservations" res ON pay."ReservationId" = res."Id"
    WHERE pay."TenantId" <> res."TenantId" OR pay."PropertyId" <> res."PropertyId";

    IF v_scope_mismatch > 0 THEN
        RAISE EXCEPTION '[SCOPE CHECK] Phát hiện % giao dịch thanh toán lệch TenantId hoặc PropertyId so với đơn đặt phòng. Aborting.', v_scope_mismatch;
    END IF;
END $$;

-- BƯỚC 9: THIẾT LẬP NOT NULL VÀ TẠO KHÓA NGOẠI KHÔNG CASCADE (ON DELETE RESTRICT)
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    ALTER TABLE "Rooms" ALTER COLUMN "PropertyId" SET NOT NULL;
    ALTER TABLE "RoomTypes" ALTER COLUMN "PropertyId" SET NOT NULL;
    ALTER TABLE "Reservations" ALTER COLUMN "PropertyId" SET NOT NULL;
    ALTER TABLE "Payments" ALTER COLUMN "PropertyId" SET NOT NULL;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'Invoices') THEN
        ALTER TABLE "Invoices" ALTER COLUMN "PropertyId" SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = v_schema AND table_name = 'HousekeepingTasks') THEN
        ALTER TABLE "HousekeepingTasks" ALTER COLUMN "PropertyId" SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Rooms_Properties_PropertyId') THEN
        ALTER TABLE "Rooms" ADD CONSTRAINT "FK_Rooms_Properties_PropertyId" 
            FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_RoomTypes_Properties_PropertyId') THEN
        ALTER TABLE "RoomTypes" ADD CONSTRAINT "FK_RoomTypes_Properties_PropertyId" 
            FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Reservations_Properties_PropertyId') THEN
        ALTER TABLE "Reservations" ADD CONSTRAINT "FK_Reservations_Properties_PropertyId" 
            FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Payments_Properties_PropertyId') THEN
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Properties_PropertyId" 
            FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_TenantStaffMembers_Properties_PropertyId') THEN
        ALTER TABLE "TenantStaffMembers" ADD CONSTRAINT "FK_TenantStaffMembers_Properties_PropertyId" 
            FOREIGN KEY ("PropertyId") REFERENCES "Properties" ("Id") ON DELETE RESTRICT;
    END IF;
END $$;

-- BƯỚC 10: GỠ BỎ UNIQUE CŨ VÀ TẠO 2 PARTIAL UNIQUE INDEXES
ALTER TABLE "TenantStaffMembers" DROP CONSTRAINT IF EXISTS "UX_Staff_TenantId_UserId";
DROP INDEX IF EXISTS "UX_Staff_TenantId_UserId";

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_tenant_wide
ON "TenantStaffMembers" ("TenantId", "UserId")
WHERE "PropertyId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_property_scoped
ON "TenantStaffMembers" ("TenantId", "UserId", "PropertyId")
WHERE "PropertyId" IS NOT NULL;

-- BƯỚC 11: RÀNG BUỘC PHỨC HỢP NGĂN CHẶN LỖI CHÉO SCOPE (CROSS-SCOPE CONSTRAINT GUARD)
DO $$
DECLARE
    v_schema text := current_schema();
BEGIN
    -- 11.1. Composite Unique Keys làm đích trỏ
    CREATE UNIQUE INDEX IF NOT EXISTS "UX_RoomTypes_PropertyId_Id" ON "RoomTypes" ("PropertyId", "Id");
    CREATE UNIQUE INDEX IF NOT EXISTS "UX_Rooms_PropertyId_Id" ON "Rooms" ("PropertyId", "Id");
    CREATE UNIQUE INDEX IF NOT EXISTS "UX_Reservations_PropertyId_Id" ON "Reservations" ("PropertyId", "Id");

    -- 11.2. Khóa ngoại phức hợp giữa RoomType và Property (buộc RoomType.TenantId == Property.TenantId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_RoomTypes_Properties_Tenant_Property') THEN
        ALTER TABLE "RoomTypes" ADD CONSTRAINT "FK_RoomTypes_Properties_Tenant_Property"
            FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.3. Khóa ngoại phức hợp giữa Room và Property (buộc Room.TenantId == Property.TenantId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Rooms_Properties_Tenant_Property') THEN
        ALTER TABLE "Rooms" ADD CONSTRAINT "FK_Rooms_Properties_Tenant_Property"
            FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.4. Khóa ngoại phức hợp giữa Room và RoomType (buộc Room.PropertyId == RoomType.PropertyId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Rooms_RoomTypes_Property_RoomType') THEN
        ALTER TABLE "Rooms" ADD CONSTRAINT "FK_Rooms_RoomTypes_Property_RoomType"
            FOREIGN KEY ("PropertyId", "RoomTypeId") REFERENCES "RoomTypes" ("PropertyId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.5. Khóa ngoại phức hợp giữa Reservation và Property (buộc Reservation.TenantId == Property.TenantId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Reservations_Properties_Tenant_Property') THEN
        ALTER TABLE "Reservations" ADD CONSTRAINT "FK_Reservations_Properties_Tenant_Property"
            FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.6. Khóa ngoại phức hợp giữa Payment và Property (buộc Payment.TenantId == Property.TenantId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Payments_Properties_Tenant_Property') THEN
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Properties_Tenant_Property"
            FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.7. Khóa ngoại phức hợp giữa Reservation và Room (buộc Reservation.PropertyId == Room.PropertyId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Reservations_Rooms_Property_Room') THEN
        ALTER TABLE "Reservations" ADD CONSTRAINT "FK_Reservations_Rooms_Property_Room"
            FOREIGN KEY ("PropertyId", "RoomId") REFERENCES "Rooms" ("PropertyId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.8. Khóa ngoại phức hợp giữa Payment và Reservation (buộc Payment.PropertyId == Reservation.PropertyId)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_Payments_Reservations_Property_Res') THEN
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Reservations_Property_Res"
            FOREIGN KEY ("PropertyId", "ReservationId") REFERENCES "Reservations" ("PropertyId", "Id") ON DELETE RESTRICT;
    END IF;

    -- 11.9. Khóa ngoại phức hợp giữa TenantStaff và Property (buộc TenantStaff.TenantId == Property.TenantId khi PropertyId IS NOT NULL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = v_schema AND constraint_name = 'FK_TenantStaffMembers_Properties_Tenant_Property') THEN
        ALTER TABLE "TenantStaffMembers" ADD CONSTRAINT "FK_TenantStaffMembers_Properties_Tenant_Property"
            FOREIGN KEY ("TenantId", "PropertyId") REFERENCES "Properties" ("TenantId", "Id") ON DELETE RESTRICT;
    END IF;
END $$;

-- BƯỚC 12: GHI NHẬN MIGRATION HOÀN TẤT
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261006010000_P1B01A_MultiProperty_Foundation', '10.0.12')
ON CONFLICT DO NOTHING;

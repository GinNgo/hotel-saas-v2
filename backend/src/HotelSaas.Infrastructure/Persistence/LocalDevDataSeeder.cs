using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Configuration options for the local development mock data seeder.
/// </summary>
public sealed class LocalDevSeedOptions
{
    /// <summary>
    /// Default password to hash and store for the seeded accounts. Must be at least 8 characters.
    /// Default: "HotelDev@2026!"
    /// </summary>
    public string DefaultPassword { get; set; } = "HotelDev@2026!";

    /// <summary>
    /// If true, allows execution on authorized test databases (e.g. hotel_saas_p1b01a_test, hotel_saas_tmp_*).
    /// Used by automated test suites.
    /// </summary>
    public bool AllowTestDatabases { get; set; } = false;

    /// <summary>
    /// Target schema to inspect and seed (default: "public").
    /// </summary>
    public string TargetSchema { get; set; } = "public";
}

/// <summary>
/// Detailed result and summary of a local dev seeding execution.
/// </summary>
public sealed record LocalDevSeedResult(
    Guid TenantId,
    string TenantCode,
    Guid Property1Id,
    string Property1Code,
    string Property1Name,
    Guid Property2Id,
    string Property2Code,
    string Property2Name,
    string OwnerEmail,
    string ManagerBothEmail,
    string ReceptionistSingleEmail,
    int UsersCreatedCount,
    int MembershipsCreatedCount,
    int RoomTypesCreatedCount,
    int RoomsCreatedCount,
    bool IsExistingDataPreserved);

/// <summary>
/// Dedicated, manual, and idempotent mock data provisioning tool for local developers and testing teams.
/// Ticket: BE-SEED-01.
/// Strictly enforces:
/// 1. Only allows dedicated local dev databases (e.g. hotel_saas_dev_{username}) or authorized test databases.
/// 2. Strictly rejects shared dev (hotel_saas_dev), staging, and production databases before any DML.
/// 3. Does NOT create or migrate database schemas. Fails fast if required tables or foundation migrations are missing.
/// 4. Hashes passwords using BCrypt via PasswordHasherService. Never logs or prints passwords or raw connection secrets.
/// 5. Executes inside an atomic database transaction. Idempotent across multiple runs (zero duplicates, no password/role mutations).
/// 6. Aborts and rolls back immediately if conflicting data not belonging to the seed set is encountered.
/// </summary>
public static class LocalDevDataSeeder
{
    public const string SeedTenantCode = "GHG";
    public const string SeedTenantSlug = "grand-hotel-group";
    public const string SeedTenantName = "Grand Hotel Group";

    public const string SeedProperty1Code = "CN-Q1";
    public const string SeedProperty1Slug = "grand-hotel-saigon-q1";
    public const string SeedProperty1Name = "Grand Hotel Sài Gòn (Quận 1)";

    public const string SeedProperty2Code = "CN-PN";
    public const string SeedProperty2Slug = "grand-hotel-phu-nhuan";
    public const string SeedProperty2Name = "Grand Hotel Phú Nhuận";

    public const string SeedOwnerEmail = "owner@hotelsaas.local";
    public const string SeedManagerBothEmail = "manager.both@hotelsaas.local";
    public const string SeedReceptionistSingleEmail = "staff.single@hotelsaas.local";

    private sealed class SeedTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; } = null;
    }

    private sealed class SeedPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; } = null;
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; } = null;
        public Guid? TokenPropertyId { get; set; } = null;
    }

    /// <summary>
    /// Redacts sensitive credentials (e.g. Password) from a connection string for safe logging.
    /// </summary>
    public static string RedactConnectionString(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return "[EMPTY_CONNECTION_STRING]";

        try
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            if (!string.IsNullOrEmpty(builder.Password))
            {
                builder.Password = "******";
            }
            return builder.ConnectionString;
        }
        catch
        {
            return "[REDACTED_MALFORMED_CONNECTION_STRING]";
        }
    }

    /// <summary>
    /// Validates that the target database specified in the connection string is strictly an authorized
    /// local dev database (hotel_saas_dev_{username}) or an authorized test database.
    /// Throws InvalidOperationException on unauthorized databases before any DML is attempted.
    /// </summary>
    public static void ValidateTargetDatabase(string connectionString, bool allowTestDatabases = false)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("[DATABASE TARGET ERROR] Connection string cannot be null or empty.", nameof(connectionString));
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(dbName))
        {
            throw new InvalidOperationException("[DATABASE TARGET ERROR] Connection string does not specify a target database.");
        }

        var normalized = dbName.ToLowerInvariant();

        // 1. Strict ban on shared hotel_saas_dev
        if (normalized == "hotel_saas_dev")
        {
            throw new InvalidOperationException(
                "[CRITICAL SECURITY ALERT] Seeding into shared database 'hotel_saas_dev' is strictly prohibited by team handoff policy! " +
                "Each team member must configure and seed their own dedicated local database 'hotel_saas_dev_<username>'.");
        }

        // 2. Strict ban on production, staging, system databases
        if (normalized.Contains("prod") || normalized.Contains("production"))
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Target database '{dbName}' appears to be a PRODUCTION database! Refusing to run dev seeding.");
        }

        if (normalized.Contains("staging"))
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Target database '{dbName}' appears to be a STAGING database! Dev seeder is strictly for local development.");
        }

        if (normalized == "postgres" || normalized == "template1")
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Refusing to run dev seeding on PostgreSQL system database '{dbName}'.");
        }

        // 3. Match dedicated developer database convention: hotel_saas_dev_<username>
        if (normalized.StartsWith("hotel_saas_dev_", StringComparison.Ordinal) && normalized.Length > "hotel_saas_dev_".Length)
        {
            return; // Valid local developer database!
        }

        // 4. In automated test runs, allow test databases
        if (allowTestDatabases)
        {
            if (normalized == "hotel_saas_p1b01a_test" || Regex.IsMatch(normalized, @"^hotel_saas_tmp_[0-9a-fA-F]{32}$"))
            {
                return; // Valid test database!
            }
        }

        throw new InvalidOperationException(
            $"[CRITICAL SECURITY ALERT] Target database '{dbName}' is NOT an authorized local dev database! " +
            "Target database must follow the convention 'hotel_saas_dev_<username>' (e.g. 'hotel_saas_dev_ngoc').");
    }

    /// <summary>
    /// Inspects the target database schema and __EFMigrationsHistory.
    /// Fails fast without executing any DML if required tables or foundation migrations are missing.
    /// </summary>
    public static async Task ValidateSchemaAndMigrationsAsync(string connectionString, string schema)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        await using var conn = new NpgsqlConnection(builder.ConnectionString);
        await conn.OpenAsync();

        // 1. Verify schema exists
        await using (var schemaCmd = conn.CreateCommand())
        {
            schemaCmd.CommandText = "SELECT 1 FROM information_schema.schemata WHERE schema_name = @s;";
            schemaCmd.Parameters.AddWithValue("s", schema);
            var exists = await schemaCmd.ExecuteScalarAsync();
            if (exists == null)
            {
                throw new InvalidOperationException(
                    $"[SEED FAIL-FAST] Target schema '{schema}' does not exist in database '{builder.Database}'. " +
                    "Please execute EF Core migrations first (dotnet ef database update).");
            }
        }

        // 2. Verify all required core tables exist
        var requiredTables = new[]
        {
            "Tenants",
            "Properties",
            "Users",
            "TenantStaffMembers",
            "AccessRoles",
            "RolePermissions",
            "PermissionFunctions",
            "RoomTypes",
            "Rooms",
            "__EFMigrationsHistory"
        };

        var foundTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var tablesCmd = conn.CreateCommand())
        {
            tablesCmd.CommandText = "SELECT table_name FROM information_schema.tables WHERE table_schema = @s;";
            tablesCmd.Parameters.AddWithValue("s", schema);
            await using var reader = await tablesCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                foundTables.Add(reader.GetString(0));
            }
        }

        foreach (var table in requiredTables)
        {
            if (!foundTables.Contains(table))
            {
                throw new InvalidOperationException(
                    $"[SEED FAIL-FAST] Missing required table '{table}' in schema '{schema}'. " +
                    $"Target database '{builder.Database}' must be fully migrated before running dev seeding. " +
                    "Please run 'dotnet ef database update'.");
            }
        }

        // 3. Verify foundation migrations exist in __EFMigrationsHistory
        await using (var migCmd = conn.CreateCommand())
        {
            migCmd.CommandText = $"SELECT \"MigrationId\" FROM \"{schema}\".\"__EFMigrationsHistory\";";
            var appliedMigrations = new List<string>();
            await using var reader = await migCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                appliedMigrations.Add(reader.GetString(0));
            }

            if (!appliedMigrations.Any(m => m.Contains("InitialBaseline")))
            {
                throw new InvalidOperationException(
                    $"[SEED FAIL-FAST] Foundation migration 'InitialBaseline' has not been applied to '{builder.Database}'. " +
                    "Please run 'dotnet ef database update' first.");
            }
        }
    }

    /// <summary>
    /// Executes the complete seeding workflow inside an atomic database transaction.
    /// Idempotent across multiple runs: leaves existing passwords, roles, and entities untouched.
    /// Aborts and rolls back on conflicts.
    /// </summary>
    public static async Task<LocalDevSeedResult> SeedAsync(
        string connectionString,
        LocalDevSeedOptions? options = null,
        IPasswordHasher? passwordHasher = null)
    {
        options ??= new LocalDevSeedOptions();
        passwordHasher ??= new PasswordHasherService();

        // 1. Validate connection string & target database
        ValidateTargetDatabase(connectionString, options.AllowTestDatabases);

        // 2. Validate password
        if (string.IsNullOrWhiteSpace(options.DefaultPassword) || options.DefaultPassword.Length < 8)
        {
            throw new ArgumentException("[SEED SECURITY ERROR] Password must be at least 8 characters long.", nameof(options));
        }

        // 3. Fail-fast check on schema and migrations
        await ValidateSchemaAndMigrationsAsync(connectionString, options.TargetSchema);

        // 4. Construct ApplicationDbContext scoped to target schema
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = options.TargetSchema
        };

        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;

        await using var context = new ApplicationDbContext(dbOptions, new SeedTenantService(), new SeedPropertyService());

        // 5. Execute within transaction
        await using var transaction = await context.Database.BeginTransactionAsync();
        try
        {
            var result = await ExecuteSeedTransactionAsync(context, options, passwordHasher);
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static async Task<LocalDevSeedResult> ExecuteSeedTransactionAsync(
        ApplicationDbContext context,
        LocalDevSeedOptions options,
        IPasswordHasher passwordHasher)
    {
        // ── Step 1: Ensure RBAC Roles & Permissions exist ─────────────────
        await SeedData.SeedDefaultRolesAndPermissions(context);

        var ownerRole = await context.AccessRoles.FirstAsync(r => r.Code == "OWNER");
        var managerRole = await context.AccessRoles.FirstAsync(r => r.Code == "MANAGER");
        var receptionistRole = await context.AccessRoles.FirstAsync(r => r.Code == "RECEPTIONIST");

        int usersCreated = 0;
        int membershipsCreated = 0;
        int roomTypesCreated = 0;
        int roomsCreated = 0;
        bool existingDataPreserved = false;

        // ── Step 2: Seed Tenant ───────────────────────────────────────────
        var existingTenantByCode = await context.Tenants
            .FirstOrDefaultAsync(t => t.Code == SeedTenantCode);
        var existingTenantBySlug = await context.Tenants
            .FirstOrDefaultAsync(t => t.Slug == SeedTenantSlug);

        if (existingTenantByCode != null && existingTenantBySlug != null && existingTenantByCode.Id != existingTenantBySlug.Id)
        {
            throw new InvalidOperationException(
                $"[SEED CONFLICT] Conflicting tenant records found for code '{SeedTenantCode}' and slug '{SeedTenantSlug}'. Aborting.");
        }

        Tenant tenant;
        if (existingTenantByCode != null)
        {
            tenant = existingTenantByCode;
            existingDataPreserved = true;
        }
        else if (existingTenantBySlug != null)
        {
            throw new InvalidOperationException(
                $"[SEED CONFLICT] Tenant with slug '{SeedTenantSlug}' already exists under code '{existingTenantBySlug.Code}'. Aborting.");
        }
        else
        {
            tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Code = SeedTenantCode,
                Name = SeedTenantName,
                Slug = SeedTenantSlug,
                Address = "123 Lê Lợi, Bến Nghé, Quận 1",
                City = "Hồ Chí Minh",
                PhoneNumber = "02838222222",
                Email = "contact@grandhotel.local",
                PropertyType = PropertyType.Hotel,
                StarRating = 5,
                CheckInTime = new TimeOnly(14, 0),
                CheckOutTime = new TimeOnly(12, 0),
                Status = TenantStatus.Active,
                SubscriptionTier = SubscriptionTier.Enterprise,
                TaxRatePercent = 8.00m,
                ServiceFeeRatePercent = 5.00m,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync();
        }

        // ── Step 3: Seed Properties ───────────────────────────────────────
        var prop1 = await context.Properties.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TenantId == tenant.Id && p.Code == SeedProperty1Code);

        if (prop1 == null)
        {
            var conflictProp1 = await context.Properties.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Slug == SeedProperty1Slug);
            if (conflictProp1 != null)
            {
                throw new InvalidOperationException(
                    $"[SEED CONFLICT] Property with slug '{SeedProperty1Slug}' already exists under tenant '{conflictProp1.TenantId}'. Aborting.");
            }

            prop1 = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = SeedProperty1Code,
                Name = SeedProperty1Name,
                Slug = SeedProperty1Slug,
                Address = "123 Lê Lợi, Phường Bến Nghé, Quận 1",
                City = "Hồ Chí Minh",
                PhoneNumber = "02838111111",
                Email = "saigon-q1@grandhotel.local",
                PropertyType = PropertyType.Hotel,
                StarRating = 5,
                CheckInTime = new TimeOnly(14, 0, 0),
                CheckOutTime = new TimeOnly(12, 0, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12,
                TaxRatePercent = 8.00m,
                ServiceFeeRatePercent = 5.00m,
                Latitude = 10.7769,
                Longitude = 106.7009,
                TouristZoneSlug = "quan-1-tphcm",
                TouristZoneName = "TP. Hồ Chí Minh - Trung Tâm Quận 1",
                NearbyLandmarksJson = "[{\"Name\":\"Chợ Bến Thành\",\"Category\":\"Chợ & Mua sắm\",\"DistanceKm\":0.3},{\"Name\":\"Phố Đi Bộ Nguyễn Huệ\",\"Category\":\"Quảng trường\",\"DistanceKm\":0.4}]",
                AllowHourlyBooking = true,
                AllowOvernightBooking = true,
                AllowDailyBooking = true,
                IsPublished = true,
                Status = PropertyStatus.Active,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            context.Properties.Add(prop1);
            await context.SaveChangesAsync();
        }
        else
        {
            existingDataPreserved = true;
        }

        var prop2 = await context.Properties.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TenantId == tenant.Id && p.Code == SeedProperty2Code);

        if (prop2 == null)
        {
            var conflictProp2 = await context.Properties.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Slug == SeedProperty2Slug);
            if (conflictProp2 != null)
            {
                throw new InvalidOperationException(
                    $"[SEED CONFLICT] Property with slug '{SeedProperty2Slug}' already exists under tenant '{conflictProp2.TenantId}'. Aborting.");
            }

            prop2 = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = SeedProperty2Code,
                Name = SeedProperty2Name,
                Slug = SeedProperty2Slug,
                Address = "456 Phan Xích Long, Phường 2, Quận Phú Nhuận",
                City = "Hồ Chí Minh",
                PhoneNumber = "02838222233",
                Email = "phunhuan@grandhotel.local",
                PropertyType = PropertyType.Motel,
                StarRating = 3,
                CheckInTime = new TimeOnly(14, 0, 0),
                CheckOutTime = new TimeOnly(12, 0, 0),
                BufferMinutes = 30,
                MaxHourlyHours = 12,
                TaxRatePercent = 8.00m,
                ServiceFeeRatePercent = 5.00m,
                Latitude = 10.7992,
                Longitude = 106.6881,
                TouristZoneSlug = "quan-1-tphcm",
                TouristZoneName = "TP. Hồ Chí Minh - Trung Tâm Quận 1",
                NearbyLandmarksJson = "[{\"Name\":\"Sân bay Quốc tế Tân Sơn Nhất\",\"Category\":\"Sân bay\",\"DistanceKm\":3.2}]",
                AllowHourlyBooking = true,
                AllowOvernightBooking = true,
                AllowDailyBooking = true,
                IsPublished = true,
                Status = PropertyStatus.Active,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            context.Properties.Add(prop2);
            await context.SaveChangesAsync();
        }
        else
        {
            existingDataPreserved = true;
        }

        // ── Step 4: Seed Users (Idempotent: preserve passwords and roles) ──
        async Task<User> EnsureUserAsync(string email, string fullName)
        {
            var existing = await context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existing != null)
            {
                if (existing.Username != email)
                {
                    throw new InvalidOperationException(
                        $"[SEED CONFLICT] User '{email}' exists with unexpected username '{existing.Username}'. Aborting.");
                }
                existingDataPreserved = true;
                return existing;
            }

            var conflictUsername = await context.Users.FirstOrDefaultAsync(u => u.Username == email);
            if (conflictUsername != null)
            {
                throw new InvalidOperationException(
                    $"[SEED CONFLICT] Username '{email}' is taken by user with email '{conflictUsername.Email}'. Aborting.");
            }

            var newUser = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                Username = email,
                FullName = fullName,
                PasswordHash = passwordHasher.Hash(options.DefaultPassword),
                GlobalRole = GlobalUserRole.TenantStaff,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            context.Users.Add(newUser);
            await context.SaveChangesAsync();
            usersCreated++;
            return newUser;
        }

        var ownerUser = await EnsureUserAsync(SeedOwnerEmail, "Nguyễn Văn Chủ (Owner)");
        var managerUser = await EnsureUserAsync(SeedManagerBothEmail, "Trần Quản Lý (Two Branches)");
        var receptionistUser = await EnsureUserAsync(SeedReceptionistSingleEmail, "Lê Lễ Tân (Single Branch)");

        // ── Step 5: Seed TenantStaff Memberships ──────────────────────────
        // 5a. Owner: Tenant-wide (PropertyId = null)
        var ownerStaff = await context.TenantStaffMembers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(ts => ts.TenantId == tenant.Id && ts.UserId == ownerUser.Id && ts.PropertyId == null);

        if (ownerStaff == null)
        {
            context.TenantStaffMembers.Add(new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = null, // Tenant-wide
                UserId = ownerUser.Id,
                RoleId = ownerRole.Id,
                StaffRole = StaffRole.Owner,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            membershipsCreated++;
        }

        // 5b. Manager: Memberships at BOTH Property 1 and Property 2
        var managerP1 = await context.TenantStaffMembers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(ts => ts.TenantId == tenant.Id && ts.UserId == managerUser.Id && ts.PropertyId == prop1.Id);

        if (managerP1 == null)
        {
            context.TenantStaffMembers.Add(new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop1.Id,
                UserId = managerUser.Id,
                RoleId = managerRole.Id,
                StaffRole = StaffRole.Manager,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            membershipsCreated++;
        }

        var managerP2 = await context.TenantStaffMembers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(ts => ts.TenantId == tenant.Id && ts.UserId == managerUser.Id && ts.PropertyId == prop2.Id);

        if (managerP2 == null)
        {
            context.TenantStaffMembers.Add(new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop2.Id,
                UserId = managerUser.Id,
                RoleId = managerRole.Id,
                StaffRole = StaffRole.Manager,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            membershipsCreated++;
        }

        // 5c. Receptionist: Membership at ONLY Property 1
        var receptionistP1 = await context.TenantStaffMembers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(ts => ts.TenantId == tenant.Id && ts.UserId == receptionistUser.Id && ts.PropertyId == prop1.Id);

        if (receptionistP1 == null)
        {
            context.TenantStaffMembers.Add(new TenantStaff
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop1.Id,
                UserId = receptionistUser.Id,
                RoleId = receptionistRole.Id,
                StaffRole = StaffRole.Receptionist,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            membershipsCreated++;
        }

        await context.SaveChangesAsync();

        // ── Step 6: Seed RoomTypes & Rooms for Property 1 ──────────────────
        async Task<RoomType> EnsureRoomTypeAsync(Guid propertyId, string code, string name, decimal basePrice, int maxOccupancy)
        {
            var existing = await context.RoomTypes.IgnoreQueryFilters()
                .FirstOrDefaultAsync(rt => rt.TenantId == tenant.Id && rt.PropertyId == propertyId && rt.Code == code);

            if (existing != null)
                return existing;

            var newRt = new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                Code = code,
                Name = name,
                BasePrice = basePrice,
                MaxOccupancy = maxOccupancy,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            context.RoomTypes.Add(newRt);
            await context.SaveChangesAsync();
            roomTypesCreated++;
            return newRt;
        }

        async Task EnsureRoomAsync(Guid propertyId, Guid roomTypeId, string roomNumber, int floor, RoomStatus status)
        {
            var existing = await context.Rooms.IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.TenantId == tenant.Id && r.PropertyId == propertyId && r.RoomNumber == roomNumber);

            if (existing != null)
                return;

            context.Rooms.Add(new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                RoomTypeId = roomTypeId,
                RoomNumber = roomNumber,
                Floor = floor,
                Status = status,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
            roomsCreated++;
        }

        // Property 1 RoomTypes & Rooms
        var rtDlxQ1 = await EnsureRoomTypeAsync(prop1.Id, "DLX-Q1", "Deluxe Double (Q1)", 1200000m, 2);
        var rtStdQ1 = await EnsureRoomTypeAsync(prop1.Id, "STD-Q1", "Standard Twin (Q1)", 800000m, 2);

        await EnsureRoomAsync(prop1.Id, rtDlxQ1.Id, "101", 1, RoomStatus.Clean);
        await EnsureRoomAsync(prop1.Id, rtStdQ1.Id, "102", 1, RoomStatus.Dirty);
        await EnsureRoomAsync(prop1.Id, rtDlxQ1.Id, "201", 2, RoomStatus.Clean);

        // Property 2 RoomTypes & Rooms
        var rtSuiPn = await EnsureRoomTypeAsync(prop2.Id, "SUI-PN", "Executive Suite (PN)", 2000000m, 3);
        var rtSupPn = await EnsureRoomTypeAsync(prop2.Id, "SUP-PN", "Superior King (PN)", 1000000m, 2);

        await EnsureRoomAsync(prop2.Id, rtSuiPn.Id, "301", 3, RoomStatus.Clean);
        await EnsureRoomAsync(prop2.Id, rtSupPn.Id, "302", 3, RoomStatus.Cleaning);
        await EnsureRoomAsync(prop2.Id, rtSuiPn.Id, "401", 4, RoomStatus.Clean);

        // ── Step 7: Seed RoomTypeRates (Authoritative Pricing Schedules) ──
        async Task EnsureRateAsync(Guid propertyId, Guid roomTypeId, decimal nightlyPrice, decimal firstHoursPrice, decimal additionalHourPrice)
        {
            var existing = await context.RoomTypeRates.IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.TenantId == tenant.Id && r.PropertyId == propertyId && r.RoomTypeId == roomTypeId && r.IsActive);
            if (existing != null)
                return;

            context.RoomTypeRates.Add(new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                RoomTypeId = roomTypeId,
                FirstHours = 2,
                FirstHoursPrice = firstHoursPrice,
                AdditionalHourPrice = additionalHourPrice,
                NightlyPrice = nightlyPrice,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 1, 1),
                EffectiveTo = new DateOnly(2030, 1, 1),
                CreatedByUserId = ownerUser.Id,
                ChangeReason = "Bảng giá tiêu chuẩn hệ thống",
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await EnsureRateAsync(prop1.Id, rtDlxQ1.Id, 1200000m, 300000m, 100000m);
        await EnsureRateAsync(prop1.Id, rtStdQ1.Id, 800000m, 200000m, 70000m);
        await EnsureRateAsync(prop2.Id, rtSuiPn.Id, 2000000m, 500000m, 150000m);
        await EnsureRateAsync(prop2.Id, rtSupPn.Id, 1000000m, 250000m, 80000m);

        // ── Step 8: Seed PropertySurchargePolicies ────────────────────────
        async Task EnsureSurchargeAsync(Guid propertyId, SurchargeType surchargeType, TimeOnly fromTime, TimeOnly toTime, decimal percentage)
        {
            var existing = await context.PropertySurchargePolicies.IgnoreQueryFilters()
                .FirstOrDefaultAsync(sp => sp.TenantId == tenant.Id && sp.PropertyId == propertyId && sp.SurchargeType == surchargeType && sp.FromTime == fromTime);
            if (existing != null)
                return;

            context.PropertySurchargePolicies.Add(new PropertySurchargePolicy
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = propertyId,
                SurchargeType = surchargeType,
                FromTime = fromTime,
                ToTime = toTime,
                CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                Percentage = percentage,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        // Policies for Prop 1
        await EnsureSurchargeAsync(prop1.Id, SurchargeType.EarlyCheckIn, new TimeOnly(6, 0), new TimeOnly(9, 0), 50m);
        await EnsureSurchargeAsync(prop1.Id, SurchargeType.EarlyCheckIn, new TimeOnly(9, 0), new TimeOnly(14, 0), 30m);
        await EnsureSurchargeAsync(prop1.Id, SurchargeType.LateCheckOut, new TimeOnly(12, 0), new TimeOnly(15, 0), 30m);
        await EnsureSurchargeAsync(prop1.Id, SurchargeType.LateCheckOut, new TimeOnly(15, 0), new TimeOnly(18, 0), 50m);

        // Policies for Prop 2
        await EnsureSurchargeAsync(prop2.Id, SurchargeType.EarlyCheckIn, new TimeOnly(6, 0), new TimeOnly(9, 0), 50m);
        await EnsureSurchargeAsync(prop2.Id, SurchargeType.EarlyCheckIn, new TimeOnly(9, 0), new TimeOnly(14, 0), 30m);
        await EnsureSurchargeAsync(prop2.Id, SurchargeType.LateCheckOut, new TimeOnly(12, 0), new TimeOnly(15, 0), 30m);
        await EnsureSurchargeAsync(prop2.Id, SurchargeType.LateCheckOut, new TimeOnly(15, 0), new TimeOnly(18, 0), 50m);

        return new LocalDevSeedResult(
            TenantId: tenant.Id,
            TenantCode: tenant.Code,
            Property1Id: prop1.Id,
            Property1Code: prop1.Code,
            Property1Name: prop1.Name,
            Property2Id: prop2.Id,
            Property2Code: prop2.Code,
            Property2Name: prop2.Name,
            OwnerEmail: ownerUser.Email,
            ManagerBothEmail: managerUser.Email,
            ReceptionistSingleEmail: receptionistUser.Email,
            UsersCreatedCount: usersCreated,
            MembershipsCreatedCount: membershipsCreated,
            RoomTypesCreatedCount: roomTypesCreated,
            RoomsCreatedCount: roomsCreated,
            IsExistingDataPreserved: existingDataPreserved);
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Real database execution tests for P1B-01A migration scripts against an isolated PostgreSQL test database.
/// Strictly executes actual SQL scripts, verifies element-by-element pre-checks, data preservation,
/// foreign key RESTRICT constraints, cross-scope constraint guards, byte-for-byte idempotency,
/// and mid-execution failure transaction rollbacks.
/// Uses dynamically named test schemas for scoped isolation without dropping the shared public schema.
/// Never silent-passes if the database is missing.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P1B01A_RealDatabaseExecutionTests
{
    private readonly ITestOutputHelper _output;

    private static readonly HashSet<string> DisallowedDatabases = new(StringComparer.OrdinalIgnoreCase)
    {
        "postgres",
        "template1",
        "hotel_saas_dev",
        "hotel_saas_prod",
        "production",
        "master"
    };

    public P1B01A_RealDatabaseExecutionTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static string GetConnectionString()
    {
        var rawConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
               ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING")
               ?? "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(rawConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
        };
        return builder.ConnectionString;
    }

    /// <summary>
    /// Validates that the target database is an authorized test database before executing any DDL/DML.
    /// Strictly rejects development, production, and system databases.
    /// </summary>
    internal static void ValidateTestDatabaseTarget(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new ArgumentException("Connection string cannot be empty", nameof(connectionString));

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database;

        if (string.IsNullOrWhiteSpace(dbName))
            throw new InvalidOperationException("[SECURITY VIOLATION] Database name is not specified in connection string.");

        if (DisallowedDatabases.Contains(dbName) || (!dbName.EndsWith("_test", StringComparison.OrdinalIgnoreCase) && !dbName.Equals("hotel_saas_p1b01a_test", StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException(
                $"[SECURITY VIOLATION] Target database '{dbName}' is NOT an authorized test database. " +
                "Execution refused to protect development and production environments.");
        }
    }

    /// <summary>
    /// Robustly masks credentials in connection strings using NpgsqlConnectionStringBuilder.
    /// Safely handles passwords with semicolons, quotes, and Pwd alias without secret leakage.
    /// </summary>
    internal static string RedactConnectionString(string connStr)
    {
        if (string.IsNullOrWhiteSpace(connStr)) return connStr;
        try
        {
            var builder = new NpgsqlConnectionStringBuilder(connStr);
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

    private static readonly string FixturesDirectory =
        Directory.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A"))
            ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A")
            : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Fixtures", "P1B01A");

    private sealed class TestCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; } = null;
    }

    private static ApplicationDbContext CreateDbContext(string connString)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connString)
            .Options;
        return new ApplicationDbContext(options, new TestCurrentTenantService());
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        try
        {
            await conn.OpenAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"[TEST HARNESS FAILURE] Không thể kết nối tới cơ sở dữ liệu test PostgreSQL tại '{RedactConnectionString(connStr)}'. " +
                "Bộ test tích hợp thực tế bắt buộc phải có kết nối database hoạt động và không được silent-pass.", ex);
        }

        // Dedicated test schema isolation: 'public' is strictly EXCLUDED from search_path
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01a_(test|drift)_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        // Cleanup strictly drops only the test's own schema, surfacing any errors without swallowing
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SET search_path TO public; DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();

        NpgsqlConnection.ClearAllPools();
    }

    /// <summary>
    /// Seeds legacy schema exactly mirroring EF Core ApplicationDbContext model before P1B-01A.
    /// Strictly generated by ctx.Database.GenerateCreateScript() for 100% EF Core model fidelity.
    /// </summary>
    private async Task SeedLegacyEnsureCreatedSchemaAsync(NpgsqlConnection conn)
    {
        var legacyBaselinePath = Path.Combine(FixturesDirectory, "00_LegacyEnsureCreatedBaseline.sql");
        string ddl;
        if (File.Exists(legacyBaselinePath))
        {
            ddl = await File.ReadAllTextAsync(legacyBaselinePath);
        }
        else
        {
            using var ctx = CreateDbContext(conn.ConnectionString);
            ddl = ctx.Database.GenerateCreateScript();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = ddl;
        await cmd.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// Seeds sample data with distinct policies and tax rates across two tenants to verify faithful preservation.
    /// </summary>
    private async Task SeedLegacyDataAsync(NpgsqlConnection conn, Guid tenantAId, Guid tenantBId)
    {
        var ownerUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var managerUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var housekeeperUserId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var guestUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");

        var roleOwnerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var roleManagerId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        var roomTypeAId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var roomAId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var resAId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var payAId = Guid.Parse("88888888-8888-8888-8888-888888888888");

        const string seedDataSql = @"
        INSERT INTO ""Users"" (""Id"", ""Username"", ""Email"", ""PasswordHash"", ""FullName"", ""GlobalRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES 
            (@OwnerUserId, 'owner_a', 'owner@hotel-a.com', 'hash', 'Owner A', 3, true, NOW(), NOW()),
            (@ManagerUserId, 'manager_a', 'mgr@hotel-a.com', 'hash', 'Manager A', 3, true, NOW(), NOW()),
            (@HousekeeperUserId, 'hk_a', 'hk@hotel-a.com', 'hash', 'HK A', 3, true, NOW(), NOW()),
            (@GuestUserId, 'guest1', 'guest@example.com', 'hash', 'Guest One', 2, true, NOW(), NOW());

        -- Tenant A: Đã cấu hình thuế 8.00%, phí 3.00%, Check-in 15:00, Check-out 11:00, StarRating 4, Status = Active (2)
        INSERT INTO ""Tenants"" (""Id"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"", ""PhoneNumber"", ""Email"", ""PropertyType"", ""StarRating"", ""CheckInTime"", ""CheckOutTime"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""SubscriptionTier"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES 
            (@TenantAId, 'Khách Sạn Biển Xanh', 'KSBX', 'khach-san-bien-xanh', '123 Tran Phu', 'Da Nang', '0901234567', 'info@bienxanh.com', 1, 4, '15:00:00'::time, '11:00:00'::time, 8.00, 3.00, 1, 2, NOW(), NOW()),
            -- Tenant B: Chưa cấu hình thuế (0.00), phí (0.00), Check-in 14:00, Check-out 12:00, StarRating 3, Status = PendingApproval/Draft (1)
            (@TenantBId, 'Khách Sạn Núi Cao', 'KSNC', 'khach-san-nui-cao', '456 Fansipan', 'Sapa', '0907654321', 'info@nuicao.com', 1, 3, '14:00:00'::time, '12:00:00'::time, 0.00, 0.00, 1, 1, NOW(), NOW());

        INSERT INTO ""AccessRoles"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""IsSystemRole"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES 
            (@RoleOwnerId, @TenantAId, 'Chủ khách sạn', 'OWNER', false, NOW(), NOW()),
            (@RoleManagerId, @TenantAId, 'Quản lý', 'MANAGER', false, NOW(), NOW());

        INSERT INTO ""PermissionFunctions"" (""Id"", ""Code"", ""Name"", ""ModuleCode"", ""SupportedActionMask"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES 
            (gen_random_uuid(), 'ROOMS', 'Room Management', 'ROOMS', 127, true, NOW(), NOW());

        INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES 
            (gen_random_uuid(), @TenantAId, @OwnerUserId, @RoleOwnerId, 1, true, NOW(), NOW()),
            (gen_random_uuid(), @TenantAId, @ManagerUserId, @RoleManagerId, 2, true, NOW(), NOW()),
            (gen_random_uuid(), @TenantAId, @HousekeeperUserId, @RoleManagerId, 4, true, NOW(), NOW());

        INSERT INTO ""RoomTypes"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""BasePrice"", ""MaxOccupancy"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES (@RoomTypeAId, @TenantAId, 'Phòng Deluxe Hướng Biển', 'DLX', 1500000, 2, NOW(), NOW());

        INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES (@RoomAId, @TenantAId, @RoomTypeAId, '101', 1, 1, true, NOW(), NOW());

        INSERT INTO ""Reservations"" (""Id"", ""TenantId"", ""RoomId"", ""GuestUserId"", ""GuestName"", ""GuestEmail"", ""CheckInDate"", ""CheckOutDate"", ""NumberOfGuests"", ""TotalAmount"", ""Status"", ""ConfirmationCode"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES (@ResAId, @TenantAId, @RoomAId, @GuestUserId, 'Guest One', 'guest@example.com', CURRENT_DATE, CURRENT_DATE + 2, 1, 3000000, 1, 'CONF01', NOW(), NOW());

        INSERT INTO ""Payments"" (""Id"", ""TenantId"", ""ReservationId"", ""Amount"", ""Method"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
        VALUES (@PayAId, @TenantAId, @ResAId, 3000000, 1, 1, NOW(), NOW());
        ";

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = seedDataSql;
        cmd.Parameters.AddWithValue("OwnerUserId", ownerUserId);
        cmd.Parameters.AddWithValue("ManagerUserId", managerUserId);
        cmd.Parameters.AddWithValue("HousekeeperUserId", housekeeperUserId);
        cmd.Parameters.AddWithValue("GuestUserId", guestUserId);
        cmd.Parameters.AddWithValue("TenantAId", tenantAId);
        cmd.Parameters.AddWithValue("TenantBId", tenantBId);
        cmd.Parameters.AddWithValue("RoleOwnerId", roleOwnerId);
        cmd.Parameters.AddWithValue("RoleManagerId", roleManagerId);
        cmd.Parameters.AddWithValue("RoomTypeAId", roomTypeAId);
        cmd.Parameters.AddWithValue("RoomAId", roomAId);
        cmd.Parameters.AddWithValue("ResAId", resAId);
        cmd.Parameters.AddWithValue("PayAId", payAId);
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task PreCheck_And_Migration_Abort_When_Index_Converted_To_Partial_Index_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Case A: Script 01 (Pre-check) must detect partial index conversion, abort with Schema Drift, and NOT stamp history
        var schemaA = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using (var connA = await CreateTestConnectionAsync(schemaA))
        {
            try
            {
                await SeedLegacyEnsureCreatedSchemaAsync(connA);

                // Preserve same index name and same column on Rooms.TenantId, but convert to partial index (add WHERE predicate)
                await using (var alterIdxCmd = connA.CreateCommand())
                {
                    alterIdxCmd.CommandText = @"
                        DROP INDEX ""IX_Rooms_TenantId"";
                        CREATE INDEX ""IX_Rooms_TenantId"" ON ""Rooms"" (""TenantId"") WHERE (""IsActive"" IS TRUE);";
                    await alterIdxCmd.ExecuteNonQueryAsync();
                }

                var exA = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await using var cmd = connA.CreateCommand();
                    cmd.CommandText = sql01;
                    await cmd.ExecuteNonQueryAsync();
                });

                Assert.Contains("Schema Drift", exA.MessageText);
                Assert.Contains("IX_Rooms_TenantId", exA.MessageText);

                // History MUST NOT be stamped in Script 01
                await using (var checkCmd = connA.CreateCommand())
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                    var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                    if (tableExists)
                    {
                        checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                        Assert.Equal(0, count);
                    }
                }
            }
            finally
            {
                await CleanupTestSchemaAsync(connA, schemaA);
            }
        }

        // Case B: Script 03 (Existing DB Migration) must also detect partial index conversion, abort with Schema Drift, and NOT stamp history
        var schemaB = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using (var connB = await CreateTestConnectionAsync(schemaB))
        {
            try
            {
                await SeedLegacyEnsureCreatedSchemaAsync(connB);

                // Preserve same index name and same column on Rooms.TenantId, but convert to partial index (add WHERE predicate)
                await using (var alterIdxCmd = connB.CreateCommand())
                {
                    alterIdxCmd.CommandText = @"
                        DROP INDEX ""IX_Rooms_TenantId"";
                        CREATE INDEX ""IX_Rooms_TenantId"" ON ""Rooms"" (""TenantId"") WHERE (""IsActive"" IS TRUE);";
                    await alterIdxCmd.ExecuteNonQueryAsync();
                }

                var exB = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await using var cmd = connB.CreateCommand();
                    cmd.CommandText = sql03;
                    await cmd.ExecuteNonQueryAsync();
                });

                Assert.Contains("Schema Drift", exB.MessageText);
                Assert.Contains("IX_Rooms_TenantId", exB.MessageText);

                // History MUST NOT be stamped in Script 03
                await using (var checkCmd = connB.CreateCommand())
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                    var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                    if (tableExists)
                    {
                        checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\";";
                        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                        Assert.Equal(0, count);
                    }
                }
            }
            finally
            {
                await CleanupTestSchemaAsync(connB, schemaB);
            }
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_Column_Type_Or_Nullability_Outside_Eight_Is_Altered_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // Alter nullability of Users.Email (outside the original 8 manual columns)
            await using (var alterCmd = conn.CreateCommand())
            {
                alterCmd.CommandText = "ALTER TABLE \"Users\" ALTER COLUMN \"Email\" DROP NOT NULL;";
                await alterCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("Users.Email", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_NonPk_Index_Is_Dropped_Or_Altered_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // Drop non-PK independent index on Rooms.TenantId
            await using (var dropIdxCmd = conn.CreateCommand())
            {
                dropIdxCmd.CommandText = "DROP INDEX \"IX_Rooms_TenantId\";";
                await dropIdxCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("IX_Rooms_TenantId", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_Scenario1_FullMigration_PreservesPoliciesTaxesAndPublication()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantAId = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var tenantBId = Guid.Parse("20000000-0000-0000-0000-000000000002");

            await SeedLegacyEnsureCreatedSchemaAsync(conn);
            await SeedLegacyDataAsync(conn, tenantAId, tenantBId);

            // Execute 01 Pre-check
            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd01 = conn.CreateCommand()) { cmd01.CommandText = sql01; await cmd01.ExecuteNonQueryAsync(); }

            // Execute 03 Backfill
            var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));
            await using (var cmd03 = conn.CreateCommand()) { cmd03.CommandText = sql03; await cmd03.ExecuteNonQueryAsync(); }

            // Verify Property A: Faithful preservation of configured Tax (8.00%), Fee (3.00%), Check-in (15:00), Check-out (11:00), and IsPublished (false - bỏ Active->Published)
            await using (var propCmd = conn.CreateCommand())
            {
                propCmd.CommandText = @"
                    SELECT ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""CheckInTime"", ""CheckOutTime"", ""StarRating"", ""IsPublished""
                    FROM ""Properties"" WHERE ""TenantId"" = @tId;";
                propCmd.Parameters.AddWithValue("tId", tenantAId);
                await using var r = await propCmd.ExecuteReaderAsync();
                Assert.True(await r.ReadAsync());
                Assert.Equal(8.00m, r.GetDecimal(0));
                Assert.Equal(3.00m, r.GetDecimal(1));
                Assert.Equal(TimeSpan.FromHours(15), r.GetTimeSpan(2));
                Assert.Equal(TimeSpan.FromHours(11), r.GetTimeSpan(3));
                Assert.Equal(4, r.GetInt32(4));
                Assert.False(r.GetBoolean(5)); // Bỏ Active->Published: Mặc định false để bảo đảm an toàn dữ liệu
            }

            // Verify Property B: Faithful preservation of Zero Tax (0.00%), Zero Fee (0.00%), Check-in (14:00), Check-out (12:00), and IsPublished (false)
            await using (var propCmd = conn.CreateCommand())
            {
                propCmd.CommandText = @"
                    SELECT ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""CheckInTime"", ""CheckOutTime"", ""StarRating"", ""IsPublished""
                    FROM ""Properties"" WHERE ""TenantId"" = @tId;";
                propCmd.Parameters.AddWithValue("tId", tenantBId);
                await using var r = await propCmd.ExecuteReaderAsync();
                Assert.True(await r.ReadAsync());
                Assert.Equal(0.00m, r.GetDecimal(0));
                Assert.Equal(0.00m, r.GetDecimal(1));
                Assert.Equal(TimeSpan.FromHours(14), r.GetTimeSpan(2));
                Assert.Equal(TimeSpan.FromHours(12), r.GetTimeSpan(3));
                Assert.Equal(3, r.GetInt32(4));
                Assert.False(r.GetBoolean(5)); // Draft tenant -> IsPublished = false
            }

            // Verify Staff Membership segregation
            await using (var staffCmd = conn.CreateCommand())
            {
                staffCmd.CommandText = @"SELECT ""StaffRole"", ""PropertyId"" FROM ""TenantStaffMembers"" ORDER BY ""StaffRole"";";
                await using var r = await staffCmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    var role = r.GetInt32(0);
                    if (role == 1) // Owner
                        Assert.True(r.IsDBNull(1), "Owner must remain PropertyId = NULL (Tenant-wide)");
                    else if (role is 2 or 4) // Manager, Housekeeper
                        Assert.False(r.IsDBNull(1), "Operational staff must be mapped to MAIN Property");
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_Scenario2_Constraints_Enforces_CrossScope_And_CascadeRestrictions()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantAId = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var tenantBId = Guid.Parse("20000000-0000-0000-0000-000000000002");

            await SeedLegacyEnsureCreatedSchemaAsync(conn);
            await SeedLegacyDataAsync(conn, tenantAId, tenantBId);

            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql01; await cmd.ExecuteNonQueryAsync(); }
            var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql03; await cmd.ExecuteNonQueryAsync(); }

            Guid propAId, propBId;
            await using (var getPropCmd = conn.CreateCommand())
            {
                getPropCmd.CommandText = "SELECT \"Id\" FROM \"Properties\" WHERE \"TenantId\" = @tId;";
                getPropCmd.Parameters.AddWithValue("tId", tenantAId);
                propAId = (Guid)(await getPropCmd.ExecuteScalarAsync())!;
            }
            await using (var getPropCmd = conn.CreateCommand())
            {
                getPropCmd.CommandText = "SELECT \"Id\" FROM \"Properties\" WHERE \"TenantId\" = @tId;";
                getPropCmd.Parameters.AddWithValue("tId", tenantBId);
                propBId = (Guid)(await getPropCmd.ExecuteScalarAsync())!;
            }

            // 1. Test ON DELETE RESTRICT on Properties
            var fkRestrictEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var delCmd = conn.CreateCommand();
                delCmd.CommandText = "DELETE FROM \"Properties\" WHERE \"Id\" = @propId;";
                delCmd.Parameters.AddWithValue("propId", propAId);
                await delCmd.ExecuteNonQueryAsync();
            });
            Assert.True(fkRestrictEx.SqlState is "23001" or "23503", "Deleting property with existing rooms must be restricted");

            // 2. Test Partial Unique Index 1 (Tenant-Wide: PropertyId IS NULL)
            var ownerUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var roleOwnerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
            var uqTenantWideEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var dupCmd = conn.CreateCommand();
                dupCmd.CommandText = @"
                    INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""PropertyId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tId, NULL, @uId, @rId, 1, true, NOW(), NOW());";
                dupCmd.Parameters.AddWithValue("tId", tenantAId);
                dupCmd.Parameters.AddWithValue("uId", ownerUserId);
                dupCmd.Parameters.AddWithValue("rId", roleOwnerId);
                await dupCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23505", uqTenantWideEx.SqlState);
            Assert.Contains("uq_tenant_staff_tenant_wide", uqTenantWideEx.ConstraintName);

            // 3. Test Cross-Scope Violation 1: Insert Room of Tenant A with Property of Tenant B
            var crossScopeRoomEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var crossCmd = conn.CreateCommand();
                crossCmd.CommandText = @"
                    INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tA, @pB, '55555555-5555-5555-5555-555555555555', '999', 1, 1, true, NOW(), NOW());";
                crossCmd.Parameters.AddWithValue("tA", tenantAId);
                crossCmd.Parameters.AddWithValue("pB", propBId); // Property belongs to Tenant B!
                await crossCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23503", crossScopeRoomEx.SqlState); // FK violation on composite key (TenantId, PropertyId)

            // 4. Test Cross-Scope Violation 2: Insert Reservation of Property A referencing Room of Property B
            var crossScopeResEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                var roomBId = Guid.NewGuid();
                var roomTypeBId = Guid.NewGuid();
                await using (var seedBCmd = conn.CreateCommand())
                {
                    seedBCmd.CommandText = @"
                        INSERT INTO ""RoomTypes"" (""Id"", ""TenantId"", ""PropertyId"", ""Name"", ""Code"", ""BasePrice"", ""MaxOccupancy"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                        VALUES (@rtId, @tB, @pB, 'Standard B', 'STDB', 1000000, 2, NOW(), NOW());
                        INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                        VALUES (@rId, @tB, @pB, @rtId, '201', 1, 1, true, NOW(), NOW());";
                    seedBCmd.Parameters.AddWithValue("rtId", roomTypeBId);
                    seedBCmd.Parameters.AddWithValue("rId", roomBId);
                    seedBCmd.Parameters.AddWithValue("tB", tenantBId);
                    seedBCmd.Parameters.AddWithValue("pB", propBId);
                    await seedBCmd.ExecuteNonQueryAsync();
                }

                await using var crossResCmd = conn.CreateCommand();
                crossResCmd.CommandText = @"
                    INSERT INTO ""Reservations"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomId"", ""GuestName"", ""GuestEmail"", ""CheckInDate"", ""CheckOutDate"", ""NumberOfGuests"", ""TotalAmount"", ""Status"", ""ConfirmationCode"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tA, @pA, @rB, 'Bad Guest', 'bad@example.com', CURRENT_DATE, CURRENT_DATE + 1, 1, 1000000, 1, 'BAD001', NOW(), NOW());";
                crossResCmd.Parameters.AddWithValue("tA", tenantAId);
                crossResCmd.Parameters.AddWithValue("pA", propAId);
                crossResCmd.Parameters.AddWithValue("rB", roomBId); // Room belongs to Property B!
                await crossResCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23503", crossScopeResEx.SqlState); // FK violation on (PropertyId, RoomId)

            // 5. Test Cross-Scope Violation 3: Room in Property A using RoomType of Property B
            var crossScopeRoomTypeEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var crossRoomCmd = conn.CreateCommand();
                crossRoomCmd.CommandText = @"
                    INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tA, @pA, @rtB, '999', 1, 1, true, NOW(), NOW());";
                crossRoomCmd.Parameters.AddWithValue("tA", tenantAId);
                crossRoomCmd.Parameters.AddWithValue("pA", propAId);
                crossRoomCmd.Parameters.AddWithValue("rtB", Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")); // RoomType of Property B
                await crossRoomCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23503", crossScopeRoomTypeEx.SqlState); // FK violation on (PropertyId, RoomTypeId)

            // 6. Test Cross-Scope Violation 4: TenantStaff of Tenant A assigned to Property of Tenant B
            var crossScopeStaffEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var crossStaffCmd = conn.CreateCommand();
                crossStaffCmd.CommandText = @"
                    INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""PropertyId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tA, @pB, gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, true, NOW(), NOW());";
                crossStaffCmd.Parameters.AddWithValue("tA", tenantAId);
                crossStaffCmd.Parameters.AddWithValue("pB", propBId); // Property belongs to Tenant B!
                await crossStaffCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23503", crossScopeStaffEx.SqlState); // FK violation on (TenantId, PropertyId)
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_Scenario3_DeepData_IdempotencySnapshot_VerifiesZeroDiff()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantAId = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var tenantBId = Guid.Parse("20000000-0000-0000-0000-000000000002");

            await SeedLegacyEnsureCreatedSchemaAsync(conn);
            await SeedLegacyDataAsync(conn, tenantAId, tenantBId);

            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

            // Run 1
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql01; await cmd.ExecuteNonQueryAsync(); }
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql03; await cmd.ExecuteNonQueryAsync(); }

            // Capture Snapshot 1 (Full row data of all entities + Schema metadata)
            var dataSnap1 = await CaptureDatabaseSnapshotAsync(conn);
            var schemaSnap1 = await CaptureSchemaMetadataSnapshotAsync(conn);

            // Run 2 (Re-execution of both scripts)
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql01; await cmd.ExecuteNonQueryAsync(); }
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql03; await cmd.ExecuteNonQueryAsync(); }

            // Capture Snapshot 2
            var dataSnap2 = await CaptureDatabaseSnapshotAsync(conn);
            var schemaSnap2 = await CaptureSchemaMetadataSnapshotAsync(conn);

            // Assert 1: Exact, deep byte-for-byte equality across all tables
            Assert.Equal(dataSnap1.Count, dataSnap2.Count);
            foreach (var kvp in dataSnap1)
            {
                Assert.True(dataSnap2.ContainsKey(kvp.Key), $"Table {kvp.Key} missing in Data Snapshot 2");
                Assert.Equal(kvp.Value, dataSnap2[kvp.Key]);
            }

            // Assert 2: Exact schema, index, and constraint equality across both runs
            Assert.Equal(schemaSnap1.Count, schemaSnap2.Count);
            foreach (var kvp in schemaSnap1)
            {
                Assert.True(schemaSnap2.ContainsKey(kvp.Key), $"Metadata category {kvp.Key} missing in Schema Snapshot 2");
                Assert.Equal(kvp.Value, schemaSnap2[kvp.Key]);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    private static async Task<Dictionary<string, List<string>>> CaptureDatabaseSnapshotAsync(NpgsqlConnection conn)
    {
        var snapshot = new Dictionary<string, List<string>>();

        // 1. Discover all tables currently present in the schema
        var tables = new List<string>();
        await using (var getTablesCmd = conn.CreateCommand())
        {
            getTablesCmd.CommandText = @"
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
                ORDER BY table_name;";
            await using var r = await getTablesCmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                tables.Add(r.GetString(0));
            }
        }

        // Always track 'Properties' state explicitly even if not yet created (e.g. before migration or after rollback)
        if (!tables.Contains("Properties"))
        {
            snapshot["Properties"] = new List<string> { "[TABLE_DOES_NOT_EXIST]" };
        }

        foreach (var table in tables)
        {
            // Dynamically discover 100% of physical columns in ordinal order (never omitting any column like RoleId, RoomTypeId)
            var columns = new List<string>();
            await using (var getColsCmd = conn.CreateCommand())
            {
                getColsCmd.CommandText = @"
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = current_schema() AND table_name = @tbl
                    ORDER BY ordinal_position;";
                getColsCmd.Parameters.AddWithValue("tbl", table);
                await using var r = await getColsCmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    columns.Add(r.GetString(0));
                }
            }

            if (columns.Count == 0)
            {
                snapshot[table] = new List<string>();
                continue;
            }

            var colList = string.Join(", ", columns.Select(c => $"\"{c}\""));
            var orderClause = columns.Contains("Id") 
                ? "\"Id\"" 
                : (columns.Contains("MigrationId") ? "\"MigrationId\"" : colList);

            var rows = new List<string>();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT {colList} FROM \"{table}\" ORDER BY {orderClause};";

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var rowData = new List<string>();
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var colName = columns[i];
                    var val = reader.IsDBNull(i) ? "NULL" : reader.GetValue(i).ToString()!;
                    rowData.Add($"{colName}={val}");
                }
                rows.Add(string.Join(" | ", rowData));
            }
            snapshot[table] = rows;
        }

        return snapshot;
    }

    private static async Task<Dictionary<string, List<string>>> CaptureSchemaMetadataSnapshotAsync(NpgsqlConnection conn)
    {
        var metadata = new Dictionary<string, List<string>>();

        // 1. Columns & data types & nullability & character length & precision & scale
        var columns = new List<string>();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                SELECT table_name, column_name, data_type, is_nullable, 
                       COALESCE(character_maximum_length::text, 'NA'),
                       COALESCE(numeric_precision::text, 'NA'),
                       COALESCE(numeric_scale::text, 'NA'),
                       COALESCE(column_default, 'NONE')
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                ORDER BY table_name, column_name;";
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                columns.Add($"{r.GetString(0)}.{r.GetString(1)} | type={r.GetString(2)} | len={r.GetString(4)} | prec={r.GetString(5)} | scale={r.GetString(6)} | nullable={r.GetString(3)} | default={r.GetString(7)}");
            }
        }
        metadata["COLUMNS"] = columns;

        // 2. Constraints (PK, FK, CHECK, UNIQUE) with full constraint definition via pg_get_constraintdef
        var constraints = new List<string>();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                SELECT conname, contype, conrelid::regclass::text, pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
                ORDER BY conname;";
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                constraints.Add($"{r.GetString(0)} | type={r.GetChar(1)} | table={r.GetString(2)} | def={r.GetString(3)}");
            }
        }
        metadata["CONSTRAINTS"] = constraints;

        // 3. Indexes
        var indexes = new List<string>();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                SELECT indexname, tablename, indexdef
                FROM pg_indexes
                WHERE schemaname = current_schema()
                ORDER BY indexname;";
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                indexes.Add($"{r.GetString(0)} | table={r.GetString(1)} | def={r.GetString(2)}");
            }
        }
        metadata["INDEXES"] = indexes;

        return metadata;
    }

    [Fact]
    public async Task RealDb_Scenario4_ElementByElement_SchemaDrift_AbortsAndReportsMissingElement()
    {
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            // Seed incomplete schema missing column TaxRatePercent on Tenants
            const string driftedSchemaSql = @"
            CREATE TABLE ""Tenants"" (""Id"" uuid PRIMARY KEY, ""Name"" varchar(200), ""Code"" varchar(50));
            CREATE TABLE ""Users"" (""Id"" uuid PRIMARY KEY, ""Email"" varchar(200), ""GlobalRole"" integer DEFAULT 2);
            ";
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = driftedSchemaSql; await cmd.ExecuteNonQueryAsync(); }

            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd01 = conn.CreateCommand();
                cmd01.CommandText = sql01;
                await cmd01.ExecuteNonQueryAsync();
            });

            // Assert: Explicitly identifies schema drift and missing element
            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("Table AccessRoles", ex.MessageText);

            // Assert: __EFMigrationsHistory was NOT stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_Scenario5_MidExecutionFailure_RollsBackTransactionCleanly()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantAId = Guid.Parse("10000000-0000-0000-0000-000000000001");
            await SeedLegacyEnsureCreatedSchemaAsync(conn);
            await SeedLegacyDataAsync(conn, tenantAId, Guid.NewGuid());

            // Pre-check 01 runs and verifies baseline
            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd = conn.CreateCommand()) { cmd.CommandText = sql01; await cmd.ExecuteNonQueryAsync(); }

            // Capture full snapshot of Data and Schema BEFORE the failing migration attempt
            var preFailureData = await CaptureDatabaseSnapshotAsync(conn);
            var preFailureSchema = await CaptureSchemaMetadataSnapshotAsync(conn);

            // Inject corrupt data: Unknown StaffRole = 999
            await using (var badDataCmd = conn.CreateCommand())
            {
                badDataCmd.CommandText = @"
                    INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES (gen_random_uuid(), @tId, '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 999, true, NOW(), NOW());";
                badDataCmd.Parameters.AddWithValue("tId", tenantAId);
                await badDataCmd.ExecuteNonQueryAsync();
            }

            var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

            // Execute 03 in an explicit transaction to test mid-execution failure rollback
            await using var tx = await conn.BeginTransactionAsync();
            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd03 = conn.CreateCommand();
                cmd03.Transaction = tx;
                cmd03.CommandText = sql03;
                await cmd03.ExecuteNonQueryAsync();
            });

            Assert.Contains("StaffRole không hợp lệ", ex.MessageText);
            await tx.RollbackAsync();

            // Clean up the corrupt probe row injected outside the migration transaction
            await using (var cleanCmd = conn.CreateCommand())
            {
                cleanCmd.CommandText = "DELETE FROM \"TenantStaffMembers\" WHERE \"StaffRole\" = 999;";
                await cleanCmd.ExecuteNonQueryAsync();
            }

            // Capture full snapshot of Data and Schema AFTER the rollback
            var postRollbackData = await CaptureDatabaseSnapshotAsync(conn);
            var postRollbackSchema = await CaptureSchemaMetadataSnapshotAsync(conn);

            // Deep verification: Data before attempt and after rollback must be 100% IDENTICAL
            Assert.Equal(preFailureData.Count, postRollbackData.Count);
            foreach (var kvp in preFailureData)
            {
                Assert.True(postRollbackData.ContainsKey(kvp.Key), $"Table {kvp.Key} missing after rollback");
                Assert.Equal(kvp.Value, postRollbackData[kvp.Key]);
            }

            // Deep verification: Schema metadata before attempt and after rollback must be 100% IDENTICAL
            Assert.Equal(preFailureSchema.Count, postRollbackSchema.Count);
            foreach (var kvp in preFailureSchema)
            {
                Assert.True(postRollbackSchema.ContainsKey(kvp.Key), $"Category {kvp.Key} missing in schema after rollback");
                Assert.Equal(kvp.Value, postRollbackSchema[kvp.Key]);
            }

            // Specific DDL checks
            Assert.Equal("[TABLE_DOES_NOT_EXIST]", postRollbackData["Properties"][0]);
            await using (var verifyCmd = conn.CreateCommand())
            {
                verifyCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Properties';";
                var propTableCount = Convert.ToInt32(await verifyCmd.ExecuteScalarAsync());
                Assert.Equal(0, propTableCount);

                verifyCmd.CommandText = "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Rooms' AND column_name = 'PropertyId';";
                var colCount = Convert.ToInt32(await verifyCmd.ExecuteScalarAsync());
                Assert.Equal(0, colCount);

                verifyCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_P1B01A_PropertyBranchScopeMigration';";
                var histCount = Convert.ToInt32(await verifyCmd.ExecuteScalarAsync());
                Assert.Equal(0, histCount);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_Scenario6_FreshDatabase_BaselineScript_ExecutesCleanly()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd01 = conn.CreateCommand()) { cmd01.CommandText = sql01; await cmd01.ExecuteNonQueryAsync(); }

            // Empty schema -> 0 migration stamps
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\";";
                var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                Assert.Equal(0, count);
            }

            // Execute 02 Fresh DB Baseline
            var sql02 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "02_FreshDbBaseline.sql"));
            await using (var cmd02 = conn.CreateCommand()) { cmd02.CommandText = sql02; await cmd02.ExecuteNonQueryAsync(); }

            // Verify Users.GlobalRole default is 2 (Customer)
            await using (var roleCmd = conn.CreateCommand())
            {
                roleCmd.CommandText = @"
                    SELECT column_default FROM information_schema.columns 
                    WHERE table_schema = current_schema() AND table_name = 'Users' AND column_name = 'GlobalRole';";
                var defVal = (string)(await roleCmd.ExecuteScalarAsync())!;
                Assert.Contains("2", defVal);
            }

            // Verify Properties TaxRatePercent and ServiceFeeRatePercent default is 0.00
            await using (var taxCmd = conn.CreateCommand())
            {
                taxCmd.CommandText = @"
                    SELECT column_default FROM information_schema.columns 
                    WHERE table_schema = current_schema() AND table_name = 'Properties' AND column_name = 'TaxRatePercent';";
                var taxDef = (string)(await taxCmd.ExecuteScalarAsync())!;
                Assert.Contains("0.00", taxDef);
            }

            // Verify both migration stamps exist
            await using (var histCmd = conn.CreateCommand())
            {
                histCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\";";
                var count = Convert.ToInt32(await histCmd.ExecuteScalarAsync());
                Assert.Equal(2, count);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Theory]
    [InlineData("Host=localhost;Database=hotel_saas_dev;Username=postgres;Password=postgres")]
    [InlineData("Host=localhost;Database=hotel_saas_prod;Username=postgres;Password=postgres")]
    [InlineData("Host=localhost;Database=postgres;Username=postgres;Password=postgres")]
    [InlineData("Host=localhost;Database=template1;Username=postgres;Password=postgres")]
    [InlineData("Host=localhost;Database=production;Username=postgres;Password=postgres")]
    public void Harness_Rejects_NonTest_Database_Target_Before_Executing_DDL(string invalidConnectionString)
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
        {
            ValidateTestDatabaseTarget(invalidConnectionString);
        });

        Assert.Contains("[SECURITY VIOLATION]", ex.Message);
        Assert.Contains("NOT an authorized test database", ex.Message);
    }

    [Fact]
    public async Task Harness_SearchPath_Excludes_Public_And_Cannot_Access_Public_Tables()
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        var probeSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        var probeTableName = $"p1b01a_probe_{Guid.NewGuid():N}";

        NpgsqlConnection? probeConn = null;
        NpgsqlConnection? harnessConn = null;

        try
        {
            // 1. Create probe table in a dedicated isolated probe test schema (NEVER public schema)
            probeConn = await CreateTestConnectionAsync(probeSchema);
            await using (var cmd = probeConn.CreateCommand())
            {
                cmd.CommandText = $"CREATE TABLE \"{probeTableName}\" (id int);";
                await cmd.ExecuteNonQueryAsync();
            }

            // 2. Connect via test harness connection for testSchema
            harnessConn = await CreateTestConnectionAsync(testSchema);

            // 3. Verify SHOW search_path strictly excludes 'public'
            await using (var showCmd = harnessConn.CreateCommand())
            {
                showCmd.CommandText = "SHOW search_path;";
                var currentSearchPath = (string)(await showCmd.ExecuteScalarAsync())!;
                Assert.DoesNotContain("public", currentSearchPath, StringComparison.OrdinalIgnoreCase);
                Assert.Contains(testSchema, currentSearchPath);
            }

            // 4. Attempt unqualified query to table in another schema -> must fail with 42P01 (undefined_table)
            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var queryCmd = harnessConn.CreateCommand();
                queryCmd.CommandText = $"SELECT * FROM \"{probeTableName}\";";
                await queryCmd.ExecuteNonQueryAsync();
            });

            Assert.Equal("42P01", ex.SqlState);
        }
        finally
        {
            // Cleanup both test schemas safely without swallowing exceptions
            if (harnessConn != null)
            {
                try { await CleanupTestSchemaAsync(harnessConn, testSchema); }
                finally { await harnessConn.DisposeAsync(); }
            }

            if (probeConn != null)
            {
                try { await CleanupTestSchemaAsync(probeConn, probeSchema); }
                finally { await probeConn.DisposeAsync(); }
            }
        }
    }

    [Fact]
    public void Redaction_NpgsqlConnectionStringBuilder_Handles_Semicolons_Quotes_And_PwdAlias()
    {
        var cases = new[]
        {
            ("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;Password=\"secret;with;semicolon\";", "secret;with;semicolon"),
            ("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;Password='secret''with\"\"quotes';", "secret'with\"quotes"),
            ("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;Pwd=my_pwd_secret_123;", "my_pwd_secret_123"),
            ("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;PASSWORD=plain_secret_value;", "plain_secret_value")
        };

        foreach (var (rawConnStr, rawPassword) in cases)
        {
            var redacted = RedactConnectionString(rawConnStr);

            // Raw password MUST NOT appear anywhere in the redacted string
            Assert.DoesNotContain(rawPassword, redacted);

            // Redacted string must contain masked password
            Assert.Contains("Password=******", redacted, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_DataType_Or_Constraint_Is_Invalid_And_DoesNotStampBaseline()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));

        // Case A: Wrong Data Type (TaxRatePercent altered to integer instead of numeric)
        var schemaWrongType = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using (var connA = await CreateTestConnectionAsync(schemaWrongType))
        {
            try
            {
                await SeedLegacyEnsureCreatedSchemaAsync(connA);

                // Alter column type to integer
                await using (var alterCmd = connA.CreateCommand())
                {
                    alterCmd.CommandText = "ALTER TABLE \"Tenants\" ALTER COLUMN \"TaxRatePercent\" TYPE integer USING \"TaxRatePercent\"::integer;";
                    await alterCmd.ExecuteNonQueryAsync();
                }

                var exA = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await using var cmd = connA.CreateCommand();
                    cmd.CommandText = sql01;
                    await cmd.ExecuteNonQueryAsync();
                });

                Assert.Contains("Schema Drift", exA.MessageText);
                Assert.Contains("TaxRatePercent", exA.MessageText);

                // History MUST NOT be stamped
                await using (var checkCmd = connA.CreateCommand())
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                    var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                    if (tableExists)
                    {
                        checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                        Assert.Equal(0, count);
                    }
                }
            }
            finally
            {
                await CleanupTestSchemaAsync(connA, schemaWrongType);
            }
        }

        // Case B: Missing FK Constraint (Drop FK between Rooms and RoomTypes)
        var schemaMissingConstraint = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using (var connB = await CreateTestConnectionAsync(schemaMissingConstraint))
        {
            try
            {
                await SeedLegacyEnsureCreatedSchemaAsync(connB);

                // Drop FK constraint on Rooms -> RoomTypes
                await using (var dropFkCmd = connB.CreateCommand())
                {
                    dropFkCmd.CommandText = @"
                        DO $$
                        DECLARE
                            v_con text;
                        BEGIN
                            SELECT c.conname INTO v_con 
                            FROM pg_constraint c
                            JOIN pg_class cl_src ON cl_src.oid = c.conrelid
                            JOIN pg_class cl_dst ON cl_dst.oid = c.confrelid
                            WHERE c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
                              AND c.contype = 'f'
                              AND cl_src.relname = 'Rooms'
                              AND cl_dst.relname = 'RoomTypes'
                            LIMIT 1;
                            IF v_con IS NOT NULL THEN
                                EXECUTE 'ALTER TABLE ""Rooms"" DROP CONSTRAINT ""' || v_con || '""';
                            END IF;
                        END $$;";
                    await dropFkCmd.ExecuteNonQueryAsync();
                }

                var exB = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await using var cmd = connB.CreateCommand();
                    cmd.CommandText = sql01;
                    await cmd.ExecuteNonQueryAsync();
                });

                Assert.Contains("Schema Drift", exB.MessageText);
                Assert.Contains("FK Rooms.RoomTypeId -> RoomTypes", exB.MessageText);

                // History MUST NOT be stamped
                await using (var checkCmd = connB.CreateCommand())
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                    var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                    if (tableExists)
                    {
                        checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                        Assert.Equal(0, count);
                    }
                }
            }
            finally
            {
                await CleanupTestSchemaAsync(connB, schemaMissingConstraint);
            }
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_Column_Outside_Original_Eight_Is_Missing_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // Drop column outside the original eight (Users.Email)
            await using (var dropColCmd = conn.CreateCommand())
            {
                dropColCmd.CommandText = "ALTER TABLE \"Users\" DROP COLUMN \"Email\";";
                await dropColCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("Users.Email", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_Unique_Index_Is_Missing_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // Drop PK constraint/unique index on SystemBanners (no incoming FK references)
            await using (var dropPkCmd = conn.CreateCommand())
            {
                dropPkCmd.CommandText = "ALTER TABLE \"SystemBanners\" DROP CONSTRAINT \"PK_SystemBanners\";";
                await dropPkCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("PK_SystemBanners", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_FK_Target_Schema_Is_Invalid_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        var auxSchema = $"p1b01a_drift_{Guid.NewGuid():N}";

        await using var conn = await CreateTestConnectionAsync(testSchema);
        await using var auxConn = await CreateTestConnectionAsync(auxSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // In auxSchema, create a dummy Tenants table
            await using (var auxCmd = auxConn.CreateCommand())
            {
                auxCmd.CommandText = "CREATE TABLE \"Tenants\" (\"Id\" uuid PRIMARY KEY);";
                await auxCmd.ExecuteNonQueryAsync();
            }

            // In testSchema, re-point FK_AccessRoles_Tenants_TenantId to auxSchema."Tenants"
            await using (var repointCmd = conn.CreateCommand())
            {
                repointCmd.CommandText = $@"
                    ALTER TABLE ""AccessRoles"" DROP CONSTRAINT ""FK_AccessRoles_Tenants_TenantId"";
                    ALTER TABLE ""AccessRoles"" ADD CONSTRAINT ""FK_AccessRoles_Tenants_TenantId""
                        FOREIGN KEY (""TenantId"") REFERENCES ""{auxSchema}"".""Tenants"" (""Id"") ON DELETE NO ACTION;";
                await repointCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("FK AccessRoles.TenantId -> Tenants.Id", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            try { await CleanupTestSchemaAsync(conn, testSchema); }
            finally { await CleanupTestSchemaAsync(auxConn, auxSchema); }
        }
    }

    [Fact]
    public async Task PreCheck_Aborts_When_FK_Delete_Action_Is_Altered_And_DoesNotStampHistory()
    {
        var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
        var testSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            await SeedLegacyEnsureCreatedSchemaAsync(conn);

            // Alter delete action of FK_Rooms_RoomTypes_RoomTypeId from CASCADE to RESTRICT
            await using (var alterFkCmd = conn.CreateCommand())
            {
                alterFkCmd.CommandText = @"
                    ALTER TABLE ""Rooms"" DROP CONSTRAINT ""FK_Rooms_RoomTypes_RoomTypeId"";
                    ALTER TABLE ""Rooms"" ADD CONSTRAINT ""FK_Rooms_RoomTypes_RoomTypeId""
                        FOREIGN KEY (""RoomTypeId"") REFERENCES ""RoomTypes"" (""Id"") ON DELETE RESTRICT;";
                await alterFkCmd.ExecuteNonQueryAsync();
            }

            var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = sql01;
                await cmd.ExecuteNonQueryAsync();
            });

            Assert.Contains("Schema Drift", ex.MessageText);
            Assert.Contains("FK Rooms.RoomTypeId -> RoomTypes.Id", ex.MessageText);

            // History MUST NOT be stamped
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '__EFMigrationsHistory';";
                var tableExists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
                if (tableExists)
                {
                    checkCmd.CommandText = "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '20261006000000_InitialBaseline';";
                    var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    Assert.Equal(0, count);
                }
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RealDb_EvidenceGeneration_PrintsAllTablesAndConstraints()
    {
        var testSchema = $"p1b01a_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantAId = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var tenantBId = Guid.Parse("20000000-0000-0000-0000-000000000002");

            await SeedLegacyEnsureCreatedSchemaAsync(conn);
            await SeedLegacyDataAsync(conn, tenantAId, tenantBId);

            _output.WriteLine($"Database: {RedactConnectionString(GetConnectionString())} | Dedicated Schema: {testSchema}");
            _output.WriteLine("\n=== [EVIDENCE 1: DATA TRƯỚC MIGRATION (EnsureCreated)] ===");
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT \"Name\", \"Code\", \"TaxRatePercent\", \"ServiceFeeRatePercent\", \"CheckInTime\", \"Status\" FROM \"Tenants\" ORDER BY \"Code\";";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    _output.WriteLine($"Tenant: {r.GetString(0)} | Code: {r.GetString(1)} | Tax={r.GetDecimal(2)}% | Fee={r.GetDecimal(3)}% | In={r.GetTimeSpan(4)} | Status={r.GetInt32(5)}");
            }

            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd01 = conn.CreateCommand()) { cmd01.CommandText = sql01; await cmd01.ExecuteNonQueryAsync(); }

            var sql03 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));
            await using (var cmd03 = conn.CreateCommand()) { cmd03.CommandText = sql03; await cmd03.ExecuteNonQueryAsync(); }

            _output.WriteLine("\n=== [EVIDENCE 2: DATA SAU MIGRATION & BACKFILL (BẢO TOÀN POLICY, THUẾ/PHÍ, BỎ ACTIVE->PUBLISHED)] ===");
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT ""Name"", ""Code"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""CheckInTime"", ""CheckOutTime"", ""IsPublished"" 
                    FROM ""Properties"" ORDER BY ""Code"";";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    _output.WriteLine($"Property: {r.GetString(0)} | Code: {r.GetString(1)} | Tax={r.GetDecimal(2)}% | Fee={r.GetDecimal(3)}% | In={r.GetTimeSpan(4)} | Out={r.GetTimeSpan(5)} | IsPublished={r.GetBoolean(6)} (Active->Published ĐÃ BỎ)");
            }

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT \"StaffRole\", \"PropertyId\", \"UserId\" FROM \"TenantStaffMembers\" ORDER BY \"StaffRole\";";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    var role = r.GetInt32(0);
                    var propIdStr = r.IsDBNull(1) ? "NULL (Tenant-wide)" : r.GetGuid(1).ToString();
                    _output.WriteLine($"TenantStaff: Role={role} ({((StaffRole)role)}) | PropertyId={propIdStr} | UserId={r.GetGuid(2)}");
                }
            }

            _output.WriteLine("\n=== [EVIDENCE 3: CONSTRAINTS & COMPOSITE CROSS-SCOPE GUARDS] ===");
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT conname, contype, confdeltype 
                    FROM pg_constraint 
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
                      AND conname LIKE 'FK_%' ORDER BY conname;";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    var delType = r.GetChar(2);
                    var delTypeStr = delType == 'r' ? "RESTRICT (No Cascade)" : delType.ToString();
                    _output.WriteLine($"Constraint: {r.GetString(0)} | Type: {r.GetChar(1)} | OnDelete: {delTypeStr}");
                }
            }

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT indexname, indexdef 
                    FROM pg_indexes 
                    WHERE schemaname = current_schema() AND indexname LIKE 'uq_tenant_staff_%' 
                    ORDER BY indexname;";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    _output.WriteLine($"Partial Unique Index: {r.GetString(0)} | Def: {r.GetString(1)}");
            }

            _output.WriteLine("\n=== [EVIDENCE 4: RECOVERY EVIDENCE (PRE-CHECK KHÔI PHỤC INITIALBASELINE)] ===");
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT \"MigrationId\", \"ProductVersion\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";";
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    _output.WriteLine($"Migration: {r.GetString(0)} | ProductVersion: {r.GetString(1)}");
            }

            _output.WriteLine("\n=== [EVIDENCE 5: SCHEMA DRIFT DETECTION EVIDENCE (FAIL-FAST TRÊN TỪNG ELEMENT)] ===");
            var driftSchema = $"p1b01a_drift_{Guid.NewGuid():N}";
            await using var driftConn = await CreateTestConnectionAsync(driftSchema);
            try
            {
                await SeedLegacyEnsureCreatedSchemaAsync(driftConn);
                await using (var dropCmd = driftConn.CreateCommand())
                {
                    dropCmd.CommandText = "DROP TABLE \"RefreshTokens\" CASCADE;";
                    await dropCmd.ExecuteNonQueryAsync();
                }

                try
                {
                    await using var driftPreCheckCmd = driftConn.CreateCommand();
                    driftPreCheckCmd.CommandText = sql01;
                    await driftPreCheckCmd.ExecuteNonQueryAsync();
                    _output.WriteLine("Schema drift was unexpectedly NOT caught.");
                }
                catch (PostgresException pex)
                {
                    _output.WriteLine($"[DRIFT DETECTED & ABORTED] SqlState={pex.SqlState} | Message={pex.MessageText}");
                }
            }
            finally
            {
                await CleanupTestSchemaAsync(driftConn, driftSchema);
            }

            _output.WriteLine("\n=== [EVIDENCE 6: IDEMPOTENCY EVIDENCE (SNAPSHOT ZERO-DIFF VERIFICATION)] ===");
            var snap1 = await CaptureDatabaseSnapshotAsync(conn);
            var schemaSnap1 = await CaptureSchemaMetadataSnapshotAsync(conn);

            await using (var cmd03Repeat = conn.CreateCommand())
            {
                cmd03Repeat.CommandText = sql03;
                await cmd03Repeat.ExecuteNonQueryAsync();
            }

            var snap2 = await CaptureDatabaseSnapshotAsync(conn);
            var schemaSnap2 = await CaptureSchemaMetadataSnapshotAsync(conn);

            _output.WriteLine($"Idempotency Check Run 2: Data Snapshot 1 ({snap1.Count} tables) vs Snapshot 2 ({snap2.Count} tables)");
            var discrepancies = 0;
            foreach (var table in snap1.Keys)
            {
                var match = snap2.ContainsKey(table) && snap1[table].SequenceEqual(snap2[table]);
                if (!match) discrepancies++;
                _output.WriteLine($"Table \"{table}\": Rows={snap1[table].Count} | Content Match={match}");
            }

            var schemaDiscrepancies = 0;
            foreach (var cat in schemaSnap1.Keys)
            {
                var match = schemaSnap2.ContainsKey(cat) && schemaSnap1[cat].SequenceEqual(schemaSnap2[cat]);
                if (!match) schemaDiscrepancies++;
                _output.WriteLine($"Schema Category \"{cat}\": Items={schemaSnap1[cat].Count} | Content Match={match}");
            }

            _output.WriteLine($"Total Discrepancies Count: Data={discrepancies}, Schema={schemaDiscrepancies} (Zero-diff achieved: {discrepancies == 0 && schemaDiscrepancies == 0})");
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}

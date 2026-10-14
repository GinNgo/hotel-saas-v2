using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Tests.MigrationFixtures;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace HotelSaas.Application.Tests.Seed;

/// <summary>
/// Unit and integration test suite for LocalDevDataSeeder (Ticket BE-SEED-01).
/// Verifies database safety guards, schema fail-fast validations,
/// atomic transactional data provisioning, idempotency, and conflict rollbacks.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class LocalDevDataSeederTests
{
    private readonly ITestOutputHelper _output;

    public LocalDevDataSeederTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
    }

    private static ApplicationDbContext CreateDbContext(string connString, string testSchema)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;

        return new ApplicationDbContext(options, new DummyTenantService(), new DummyPropertyService());
    }

    private sealed class DummyTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; } = null;
    }

    private sealed class DummyPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; } = null;
        public bool IsTenantWide { get; set; } = true;
        public System.Collections.Generic.IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; } = null;
        public Guid? TokenPropertyId { get; set; } = null;
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        PostgresTestDatabaseGuard.ValidateConnectionTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        // Ensure btree_gist extension is available in public
        await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
        await cmd.ExecuteNonQueryAsync();

        return conn;
    }

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^seed_test_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid test schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task SeedAsync_OnValidMigratedDatabase_CreatesCompleteMockDataSet()
    {
        var testSchema = $"seed_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Apply EF Core migrations to test schema
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var hasher = new PasswordHasherService();
            var options = new LocalDevSeedOptions
            {
                AllowTestDatabases = true,
                TargetSchema = testSchema,
                DefaultPassword = "TestPassword@123"
            };

            // Run Seeder
            var result = await LocalDevDataSeeder.SeedAsync(conn.ConnectionString, options, hasher);

            // Assert Returned Result
            Assert.Equal(LocalDevDataSeeder.SeedTenantCode, result.TenantCode);
            Assert.Equal(LocalDevDataSeeder.SeedProperty1Code, result.Property1Code);
            Assert.Equal(LocalDevDataSeeder.SeedProperty2Code, result.Property2Code);
            Assert.Equal(3, result.UsersCreatedCount);
            Assert.Equal(4, result.MembershipsCreatedCount);
            Assert.Equal(4, result.RoomTypesCreatedCount);
            Assert.Equal(6, result.RoomsCreatedCount);
            Assert.False(result.IsExistingDataPreserved);

            // Verify Database State directly
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                // 1. Tenant
                var tenant = await verifyCtx.Tenants.FirstOrDefaultAsync(t => t.Code == LocalDevDataSeeder.SeedTenantCode);
                Assert.NotNull(tenant);
                Assert.Equal(TenantStatus.Active, tenant.Status);

                // 2. Properties (2 active, published)
                var properties = await verifyCtx.Properties.IgnoreQueryFilters().ToListAsync();
                Assert.Equal(2, properties.Count);
                Assert.All(properties, p =>
                {
                    Assert.True(p.IsPublished);
                    Assert.Equal(PropertyStatus.Active, p.Status);
                    Assert.Equal(tenant.Id, p.TenantId);
                });

                // 3. Users (3 users with BCrypt password hashes)
                var users = await verifyCtx.Users.ToListAsync();
                Assert.Equal(3, users.Count);
                foreach (var user in users)
                {
                    Assert.True(user.IsActive);
                    Assert.True(hasher.Verify("TestPassword@123", user.PasswordHash));
                }

                // 4. Staff Memberships
                var memberships = await verifyCtx.TenantStaffMembers.IgnoreQueryFilters().ToListAsync();
                Assert.Equal(4, memberships.Count);

                var ownerStaff = memberships.Single(m => m.UserId == users.Single(u => u.Email == LocalDevDataSeeder.SeedOwnerEmail).Id);
                Assert.Null(ownerStaff.PropertyId); // Tenant-wide
                Assert.Equal(StaffRole.Owner, ownerStaff.StaffRole);

                var managerStaff = memberships.Where(m => m.UserId == users.Single(u => u.Email == LocalDevDataSeeder.SeedManagerBothEmail).Id).ToList();
                Assert.Equal(2, managerStaff.Count); // Memberships in BOTH branches
                Assert.Contains(managerStaff, m => m.PropertyId == result.Property1Id);
                Assert.Contains(managerStaff, m => m.PropertyId == result.Property2Id);
                Assert.All(managerStaff, m => Assert.Equal(StaffRole.Manager, m.StaffRole));

                var receptionistStaff = memberships.Single(m => m.UserId == users.Single(u => u.Email == LocalDevDataSeeder.SeedReceptionistSingleEmail).Id);
                Assert.Equal(result.Property1Id, receptionistStaff.PropertyId); // Scoped to Branch 1 only
                Assert.Equal(StaffRole.Receptionist, receptionistStaff.StaffRole);

                // 5. RoomTypes (2 per property)
                var roomTypes = await verifyCtx.RoomTypes.IgnoreQueryFilters().ToListAsync();
                Assert.Equal(4, roomTypes.Count);
                Assert.Equal(2, roomTypes.Count(rt => rt.PropertyId == result.Property1Id));
                Assert.Equal(2, roomTypes.Count(rt => rt.PropertyId == result.Property2Id));

                // 6. Rooms (3 per property)
                var rooms = await verifyCtx.Rooms.IgnoreQueryFilters().ToListAsync();
                Assert.Equal(6, rooms.Count);
                Assert.Equal(3, rooms.Count(r => r.PropertyId == result.Property1Id));
                Assert.Equal(3, rooms.Count(r => r.PropertyId == result.Property2Id));

                // Check room statuses
                var p1Rooms = rooms.Where(r => r.PropertyId == result.Property1Id).ToList();
                Assert.Equal(RoomStatus.Clean, p1Rooms.Single(r => r.RoomNumber == "101").Status);
                Assert.Equal(RoomStatus.Dirty, p1Rooms.Single(r => r.RoomNumber == "102").Status);
                Assert.Equal(RoomStatus.Clean, p1Rooms.Single(r => r.RoomNumber == "201").Status);

                var p2Rooms = rooms.Where(r => r.PropertyId == result.Property2Id).ToList();
                Assert.Equal(RoomStatus.Clean, p2Rooms.Single(r => r.RoomNumber == "301").Status);
                Assert.Equal(RoomStatus.Cleaning, p2Rooms.Single(r => r.RoomNumber == "302").Status);
                Assert.Equal(RoomStatus.Clean, p2Rooms.Single(r => r.RoomNumber == "401").Status);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task SeedAsync_ExecutedTwice_IsIdempotent_CreatesZeroDuplicates_PreservesPasswordsAndRoles()
    {
        var testSchema = $"seed_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var hasher = new PasswordHasherService();
            var options = new LocalDevSeedOptions
            {
                AllowTestDatabases = true,
                TargetSchema = testSchema,
                DefaultPassword = "FirstRunPassword@2026"
            };

            // Run 1
            var run1Result = await LocalDevDataSeeder.SeedAsync(conn.ConnectionString, options, hasher);
            Assert.Equal(3, run1Result.UsersCreatedCount);
            Assert.False(run1Result.IsExistingDataPreserved);

            // Record initial password hash of owner
            string ownerHashRun1;
            await using (var checkCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var ownerUser = await checkCtx.Users.FirstAsync(u => u.Email == LocalDevDataSeeder.SeedOwnerEmail);
                ownerHashRun1 = ownerUser.PasswordHash;
            }

            // Run 2 (with different default password to verify non-overwrite)
            var options2 = new LocalDevSeedOptions
            {
                AllowTestDatabases = true,
                TargetSchema = testSchema,
                DefaultPassword = "DifferentPassword@999"
            };

            var run2Result = await LocalDevDataSeeder.SeedAsync(conn.ConnectionString, options2, hasher);

            // Assert Run 2 created ZERO new records
            Assert.Equal(0, run2Result.UsersCreatedCount);
            Assert.Equal(0, run2Result.MembershipsCreatedCount);
            Assert.Equal(0, run2Result.RoomTypesCreatedCount);
            Assert.Equal(0, run2Result.RoomsCreatedCount);
            Assert.True(run2Result.IsExistingDataPreserved);

            // Verify Exact counts remain identical
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                Assert.Equal(1, await verifyCtx.Tenants.CountAsync());
                Assert.Equal(2, await verifyCtx.Properties.IgnoreQueryFilters().CountAsync());
                Assert.Equal(3, await verifyCtx.Users.CountAsync());
                Assert.Equal(4, await verifyCtx.TenantStaffMembers.IgnoreQueryFilters().CountAsync());
                Assert.Equal(4, await verifyCtx.RoomTypes.IgnoreQueryFilters().CountAsync());
                Assert.Equal(6, await verifyCtx.Rooms.IgnoreQueryFilters().CountAsync());

                // Password hash preserved from Run 1, NOT overwritten by Run 2
                var ownerUser = await verifyCtx.Users.FirstAsync(u => u.Email == LocalDevDataSeeder.SeedOwnerEmail);
                Assert.Equal(ownerHashRun1, ownerUser.PasswordHash);
                Assert.True(hasher.Verify("FirstRunPassword@2026", ownerUser.PasswordHash));
                Assert.False(hasher.Verify("DifferentPassword@999", ownerUser.PasswordHash));
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public void ValidateTargetDatabase_RejectsUnauthorizedDatabases_BeforeAnyDML()
    {
        // 1. Shared hotel_saas_dev
        var exDev = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_dev;Username=postgres;Password=pw"));
        Assert.Contains("hotel_saas_dev", exDev.Message);
        Assert.Contains("team handoff policy", exDev.Message);

        // 2. Production
        var exProd = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_production;Username=postgres;Password=pw"));
        Assert.Contains("PRODUCTION", exProd.Message);

        // 3. Staging
        var exStaging = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_staging_db;Username=postgres;Password=pw"));
        Assert.Contains("STAGING", exStaging.Message);

        // 4. System databases
        var exPostgres = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=postgres;Username=postgres;Password=pw"));
        Assert.Contains("system database", exPostgres.Message);

        var exTemplate = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=template1;Username=postgres;Password=pw"));
        Assert.Contains("system database", exTemplate.Message);

        // 5. Arbitrary unapproved database
        var exArbitrary = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=some_other_database;Username=postgres;Password=pw"));
        Assert.Contains("hotel_saas_dev_<username>", exArbitrary.Message);

        // 6. Test database when allowTestDatabases is false (default)
        var exTestBlocked = Assert.Throws<InvalidOperationException>(() =>
            LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;Password=pw", allowTestDatabases: false));
        Assert.Contains("hotel_saas_dev_<username>", exTestBlocked.Message);
    }

    [Fact]
    public void ValidateTargetDatabase_AllowsDedicatedDeveloperDatabase_AndTestDatabase()
    {
        // 1. Dedicated dev databases
        LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_dev_ngoc;Username=postgres;Password=pw");
        LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_dev_john_doe;Username=postgres;Password=pw");
        LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=HOTEL_SAAS_DEV_ALICE;Username=postgres;Password=pw");

        // 2. Test databases when explicitly enabled
        LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_p1b01a_test;Username=postgres;Password=pw", allowTestDatabases: true);
        LocalDevDataSeeder.ValidateTargetDatabase("Host=localhost;Database=hotel_saas_tmp_0123456789abcdef0123456789abcdef;Username=postgres;Password=pw", allowTestDatabases: true);
    }

    [Fact]
    public async Task ValidateSchemaAndMigrationsAsync_FailsFast_WhenRequiredTablesOrMigrationsMissing()
    {
        var testSchema = $"seed_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Do NOT run migrations: schema is completely empty
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await LocalDevDataSeeder.ValidateSchemaAndMigrationsAsync(conn.ConnectionString, testSchema);
            });

            Assert.Contains("[SEED FAIL-FAST] Missing required table", ex.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task SeedAsync_RollsBackTransaction_WhenConflictingDataEncountered()
    {
        var testSchema = $"seed_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            // Insert a pre-existing user with same email but conflicting username
            await using (var seedConflictCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                seedConflictCtx.Users.Add(new User
                {
                    Id = Guid.NewGuid(),
                    Email = LocalDevDataSeeder.SeedOwnerEmail,
                    Username = "conflicting_username_not_matching_email",
                    FullName = "Conflicting User",
                    PasswordHash = "some_hash",
                    GlobalRole = GlobalUserRole.Customer,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                });
                await seedConflictCtx.SaveChangesAsync();
            }

            var options = new LocalDevSeedOptions
            {
                AllowTestDatabases = true,
                TargetSchema = testSchema
            };

            // Seeder should detect conflict and abort with transaction rollback
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await LocalDevDataSeeder.SeedAsync(conn.ConnectionString, options);
            });

            Assert.Contains("[SEED CONFLICT]", ex.Message);

            // Verify that Tenant GHG was rolled back and does NOT exist
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = await verifyCtx.Tenants.FirstOrDefaultAsync(t => t.Code == LocalDevDataSeeder.SeedTenantCode);
                Assert.Null(tenant);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public void RedactConnectionString_MasksPasswordsProperly()
    {
        var connWithPw = "Host=localhost;Database=hotel_saas_dev_ngoc;Username=postgres;Password=SuperSecretPassword123;";
        var redacted = LocalDevDataSeeder.RedactConnectionString(connWithPw);

        Assert.DoesNotContain("SuperSecretPassword123", redacted);
        Assert.Contains("Password=******", redacted);
        Assert.Contains("Database=hotel_saas_dev_ngoc", redacted);

        var empty = LocalDevDataSeeder.RedactConnectionString("");
        Assert.Equal("[EMPTY_CONNECTION_STRING]", empty);
    }
}

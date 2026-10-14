using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Regression and concurrency tests for BE-FIX-01:
/// Verifies PostgreSQL btree_gist extension lifecycle, database-level advisory locking,
/// stable 'public' schema placement, isolation against CASCADE schema drops,
/// fail-fast protection against unauthorized schemas without data destruction,
/// and strict database guard enforcement.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P2B02_BtreeGistLifecycleAndConcurrencyTests
{
    private readonly ITestOutputHelper _output;

    public P2B02_BtreeGistLifecycleAndConcurrencyTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static string GetBaseConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
               ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING");
        var rawConn = !string.IsNullOrWhiteSpace(envConn) ? envConn : "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
        var builder = new NpgsqlConnectionStringBuilder(rawConn)
        {
            Pooling = false
        };
        return builder.ConnectionString;
    }

    private static string CreateDatabaseConnectionString(string databaseName)
    {
        var builder = new NpgsqlConnectionStringBuilder(GetBaseConnectionString())
        {
            Database = databaseName,
            Pooling = false
        };
        return builder.ConnectionString;
    }

    private sealed class TestCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; } = null;
    }

    private static ApplicationDbContext CreateDbContext(string connString, string testSchema, Guid? tenantId = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        return new ApplicationDbContext(options, new TestCurrentTenantService { TenantId = tenantId });
    }

    private async Task CreateTemporaryDatabaseAsync(string databaseName)
    {
        PostgresTestDatabaseGuard.ValidateAuthorizedTestDatabaseName(databaseName);

        var rootConnStr = new NpgsqlConnectionStringBuilder(GetBaseConnectionString())
        {
            Database = "postgres"
        }.ConnectionString;

        await using var conn = new NpgsqlConnection(rootConnStr);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"CREATE DATABASE \"{databaseName}\";";
        await cmd.ExecuteNonQueryAsync();

        PostgresTestDatabaseGuard.RecordDatabaseCreated(databaseName);
        _output.WriteLine($"[SETUP] Created temporary test database: {databaseName}");
    }

    private async Task DropTemporaryDatabaseAsync(string databaseName)
    {
        // 1. Guard check and unregister ownership
        PostgresTestDatabaseGuard.ValidateAndUnregisterForDrop(databaseName);

        // 2. Clear ONLY the connection pool for this specific temporary database (no ClearAllPools)
        var targetConnStr = CreateDatabaseConnectionString(databaseName);
        await using (var tempConn = new NpgsqlConnection(targetConnStr))
        {
            NpgsqlConnection.ClearPool(tempConn);
        }

        // 3. Terminate lingering sessions and drop database from postgres root connection
        var rootConnStr = new NpgsqlConnectionStringBuilder(GetBaseConnectionString())
        {
            Database = "postgres"
        }.ConnectionString;

        await using var conn = new NpgsqlConnection(rootConnStr);
        await conn.OpenAsync();

        await using (var termCmd = conn.CreateCommand())
        {
            termCmd.CommandTimeout = 120;
            termCmd.CommandText = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @db AND pid <> pg_backend_pid();";
            termCmd.Parameters.AddWithValue("db", databaseName);
            await termCmd.ExecuteNonQueryAsync();
        }

        await using var dropCmd = conn.CreateCommand();
        dropCmd.CommandTimeout = 120;
        dropCmd.CommandText = $"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE);";
        await dropCmd.ExecuteNonQueryAsync();
        _output.WriteLine($"[TEARDOWN] Dropped temporary test database: {databaseName}");
    }

    // =========================================================================
    // SECTION 1: DATABASE GUARD NEGATIVE TESTS (NO DESTRUCTIVE DDL)
    // =========================================================================

    [Fact]
    public void DatabaseGuard_Negative_01_InvalidDatabaseNames_Throw_Without_DDL()
    {
        var invalidNames = new[]
        {
            "",
            "   ",
            "random_database",
            "hotel_saas_test",
            "test_something",
            "hotel_saas_tmp_invalidguid",
            "hotel_saas_tmp_123",
            "my_test_db"
        };

        foreach (var invalidName in invalidNames)
        {
            var ex = Assert.ThrowsAny<Exception>(() =>
            {
                PostgresTestDatabaseGuard.ValidateAuthorizedTestDatabaseName(invalidName);
            });
            Assert.True(ex is ArgumentException || ex is InvalidOperationException);
        }

        Assert.Throws<ArgumentException>(() =>
        {
            PostgresTestDatabaseGuard.ValidateAuthorizedTestDatabaseName(null!);
        });

        // Verify connection string guard also rejects
        var badConnStr = "Host=localhost;Database=unauthorized_db;Username=postgres;Password=postgres;";
        var connEx = Assert.Throws<InvalidOperationException>(() =>
        {
            PostgresTestDatabaseGuard.ValidateConnectionTarget(badConnStr);
        });
        Assert.Contains("[CRITICAL SECURITY ALERT]", connEx.Message);
    }

    [Fact]
    public void DatabaseGuard_Negative_02_DevAndProdDatabaseNames_Throw_Without_DDL()
    {
        var dangerousNames = new[]
        {
            "hotel_saas_dev",
            "hotel_saas_prod",
            "hotel_saas_production",
            "hotel_saas_staging",
            "postgres",
            "template1",
            "hotel_saas_dev_test"
        };

        foreach (var dangerousName in dangerousNames)
        {
            var ex = Assert.Throws<InvalidOperationException>(() =>
            {
                PostgresTestDatabaseGuard.ValidateAuthorizedTestDatabaseName(dangerousName);
            });
            Assert.Contains("[CRITICAL SECURITY ALERT]", ex.Message);
            Assert.Contains("NOT an authorized test database", ex.Message);
        }
    }

    [Fact]
    public void DatabaseGuard_Negative_03_UnownedDatabase_RefusesDrop_Without_DDL()
    {
        // Name matches format but was never recorded as created by harness
        var unownedName = $"hotel_saas_tmp_{Guid.NewGuid():N}";

        var ex = Assert.Throws<InvalidOperationException>(() =>
        {
            PostgresTestDatabaseGuard.ValidateAndUnregisterForDrop(unownedName);
        });

        Assert.Contains("[CRITICAL SECURITY ALERT]", ex.Message);
        Assert.Contains("Refusing to drop unowned database", ex.Message);
    }

    [Fact]
    public void DatabaseGuard_Negative_04_SharedDatabase_RefusesDrop_Without_DDL()
    {
        // Shared test database is valid for test operations but MUST NEVER be dropped
        PostgresTestDatabaseGuard.ValidateAuthorizedTestDatabaseName(PostgresTestDatabaseGuard.SharedTestDatabaseName);

        var ex = Assert.Throws<InvalidOperationException>(() =>
        {
            PostgresTestDatabaseGuard.ValidateAndUnregisterForDrop(PostgresTestDatabaseGuard.SharedTestDatabaseName);
        });

        Assert.Contains("[CRITICAL SECURITY ALERT]", ex.Message);
        Assert.Contains("Refusing to drop shared test database", ex.Message);
    }

    // =========================================================================
    // SECTION 2: REAL EF CORE MIGRATION TESTS
    // =========================================================================

    /// <summary>
    /// Real Migration Test 1:
    /// On a clean database, executing REAL EF Core Migrations (Database.MigrateAsync)
    /// installs btree_gist extension strictly in schema 'public', establishes gist_uuid_ops,
    /// and records P2B-02 migration in __EFMigrationsHistory.
    /// </summary>
    [Fact]
    public async Task RealMigration_01_CleanDatabase_EFMigration_Installs_BtreeGist_In_Public()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            var testSchema = "mig_clean_test";

            // 1. Verify extension does not exist initially
            await using (var probeConn = new NpgsqlConnection(targetConnStr))
            {
                await probeConn.OpenAsync();
                var initialSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(probeConn);
                Assert.Null(initialSchema);

                // Create dedicated test schema for EF migrations
                await using var schemaCmd = probeConn.CreateCommand();
                schemaCmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\";";
                await schemaCmd.ExecuteNonQueryAsync();
            }

            // 2. Execute REAL EF Core Migrations
            await using (var ctx = CreateDbContext(targetConnStr, testSchema))
            {
                await ctx.Database.MigrateAsync();
            }

            // 3. Verify extension was installed strictly in 'public'
            await using (var verifyConn = new NpgsqlConnection(targetConnStr))
            {
                await verifyConn.OpenAsync();

                var extensionSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(verifyConn);
                Assert.Equal(PostgresExtensionLifecycleHelper.TargetStableSchema, extensionSchema);

                // Verify gist_uuid_ops exists in 'public'
                await using var opCmd = verifyConn.CreateCommand();
                opCmd.CommandText = "SELECT opcname, opcnamespace::regnamespace::text FROM pg_opclass WHERE opcname = 'gist_uuid_ops';";
                await using var reader = await opCmd.ExecuteReaderAsync();
                Assert.True(await reader.ReadAsync(), "gist_uuid_ops operator class must be present.");
                Assert.Equal("public", reader.GetString(1));
                await reader.CloseAsync();

                // Verify __EFMigrationsHistory contains P2B-02 migration
                await using var migCmd = verifyConn.CreateCommand();
                migCmd.CommandText = $"SELECT \"MigrationId\" FROM \"{testSchema}\".\"__EFMigrationsHistory\" WHERE \"MigrationId\" LIKE '%P2B02%';";
                var migId = (string?)await migCmd.ExecuteScalarAsync();
                Assert.NotNull(migId);
                Assert.Contains("P2B02_Rates_Policies_Quote", migId);
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    /// <summary>
    /// Real Migration Test 2:
    /// Two concurrent runners on separate schemas in the SAME clean database, synchronized via Barrier,
    /// both execute REAL EF Core Migrations (Database.MigrateAsync) concurrently.
    /// Advisory transaction locking serializes extension initialization, preventing 23505 unique catalog
    /// collisions and deadlocks. Both migrations succeed and btree_gist exists once in 'public'.
    /// </summary>
    [Fact]
    public async Task RealMigration_02_ConcurrentRunners_WithBarrier_Migrate_Without_Collision_Or_Deadlock()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            const string schema1 = "mig_conc_schema_1";
            const string schema2 = "mig_conc_schema_2";

            // Initialize schemas
            await using (var initConn = new NpgsqlConnection(targetConnStr))
            {
                await initConn.OpenAsync();
                await using var cmd = initConn.CreateCommand();
                cmd.CommandText = $@"
                    CREATE SCHEMA IF NOT EXISTS ""{schema1}"";
                    CREATE SCHEMA IF NOT EXISTS ""{schema2}"";";
                await cmd.ExecuteNonQueryAsync();
            }

            using var barrier = new Barrier(2);
            Exception? ex1 = null;
            Exception? ex2 = null;

            var task1 = Task.Run(async () =>
            {
                try
                {
                    await using var ctx1 = CreateDbContext(targetConnStr, schema1);
                    barrier.SignalAndWait();
                    await ctx1.Database.MigrateAsync();
                }
                catch (Exception ex)
                {
                    ex1 = ex;
                }
            });

            var task2 = Task.Run(async () =>
            {
                try
                {
                    await using var ctx2 = CreateDbContext(targetConnStr, schema2);
                    barrier.SignalAndWait();
                    await ctx2.Database.MigrateAsync();
                }
                catch (Exception ex)
                {
                    ex2 = ex;
                }
            });

            await Task.WhenAll(task1, task2);

            Assert.True(ex1 == null, $"Runner 1 migration failed: {ex1}");
            Assert.True(ex2 == null, $"Runner 2 migration failed: {ex2}");

            // Verify extension state in database
            await using (var verifyConn = new NpgsqlConnection(targetConnStr))
            {
                await verifyConn.OpenAsync();

                // Extension installed exactly once in 'public'
                await using var countCmd = verifyConn.CreateCommand();
                countCmd.CommandText = "SELECT count(*), extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'btree_gist' GROUP BY extnamespace;";
                await using var reader = await countCmd.ExecuteReaderAsync();
                Assert.True(await reader.ReadAsync(), "btree_gist must exist.");
                Assert.Equal(1L, reader.GetInt64(0));
                Assert.Equal("public", reader.GetString(1));
                await reader.CloseAsync();

                // Both schemas have migration history stamped
                foreach (var s in new[] { schema1, schema2 })
                {
                    await using var chkMigCmd = verifyConn.CreateCommand();
                    chkMigCmd.CommandText = $"SELECT count(*) FROM \"{s}\".\"__EFMigrationsHistory\" WHERE \"MigrationId\" LIKE '%P2B02%';";
                    var count = (long)(await chkMigCmd.ExecuteScalarAsync() ?? 0L);
                    Assert.Equal(1L, count);
                }
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    /// <summary>
    /// Real Migration Test 3:
    /// When btree_gist resides in an unauthorized schema, executing REAL EF Core Migrations
    /// fails-fast during Step 0 of P2B-02, preserves the unauthorized extension and existing data 100%,
    /// and does NOT stamp P2B-02 in __EFMigrationsHistory.
    /// </summary>
    [Fact]
    public async Task RealMigration_03_UnauthorizedSchema_Migration_FailsFast_PreservesData_DoesNotStampMigration()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            const string unauthorizedSchema = "custom_unauthorized_schema";
            var testSchema = "mig_unauthorized_test";

            // 1. Manually setup extension in unauthorized schema with critical table data
            await using (var setupConn = new NpgsqlConnection(targetConnStr))
            {
                await setupConn.OpenAsync();
                await using var setupCmd = setupConn.CreateCommand();
                setupCmd.CommandText = $@"
                    CREATE SCHEMA ""{unauthorizedSchema}"";
                    CREATE EXTENSION btree_gist SCHEMA ""{unauthorizedSchema}"";
                    CREATE TABLE ""{unauthorizedSchema}"".""ImportantOperationalData"" (
                        id int PRIMARY KEY,
                        payload text NOT NULL
                    );
                    INSERT INTO ""{unauthorizedSchema}"".""ImportantOperationalData"" VALUES (999, 'uncompromised_payload');
                    CREATE SCHEMA ""{testSchema}"";";
                await setupCmd.ExecuteNonQueryAsync();
            }

            // 2. Invoking REAL EF Core Migrations must fail-fast with error message
            await using (var ctx = CreateDbContext(targetConnStr, testSchema))
            {
                var ex = await Assert.ThrowsAnyAsync<Exception>(async () =>
                {
                    await ctx.Database.MigrateAsync();
                });

                var fullError = ex.ToString();
                Assert.Contains("[EXTENSION CONFIGURATION ERROR]", fullError);
                Assert.Contains(unauthorizedSchema, fullError);
                Assert.Contains("Manual intervention required", fullError);
            }

            // 3. Verify safety invariants
            await using (var verifyConn = new NpgsqlConnection(targetConnStr))
            {
                await verifyConn.OpenAsync();

                // Extension was NOT dropped or relocated
                var currentSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(verifyConn);
                Assert.Equal(unauthorizedSchema, currentSchema);

                // Operational data remains intact
                await using var probeCmd = verifyConn.CreateCommand();
                probeCmd.CommandText = $@"
                    SELECT payload 
                    FROM ""{unauthorizedSchema}"".""ImportantOperationalData"" 
                    WHERE id = 999;";
                var payload = (string?)await probeCmd.ExecuteScalarAsync();
                Assert.Equal("uncompromised_payload", payload);

                // Migration P2B-02 was NOT stamped
                await using var checkMigCmd = verifyConn.CreateCommand();
                checkMigCmd.CommandText = $@"
                    SELECT count(*) 
                    FROM ""{testSchema}"".""__EFMigrationsHistory"" 
                    WHERE ""MigrationId"" LIKE '%P2B02%';";
                var stampedCount = (long)(await checkMigCmd.ExecuteScalarAsync() ?? 0L);
                Assert.Equal(0L, stampedCount);
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    /// <summary>
    /// Real Migration Test 4:
    /// When btree_gist resides in 'public' after real EF migration, dropping another ephemeral schema CASCADE
    /// does NOT drop btree_gist, and leaves GiST exclusion constraints on other schemas fully operational.
    /// </summary>
    [Fact]
    public async Task RealMigration_04_DropEphemeralSchemaCascade_Preserves_Extension_And_OtherSchemaConstraints()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            const string schemaA = "schema_mig_a";
            const string schemaB = "schema_mig_b";

            await using (var initConn = new NpgsqlConnection(targetConnStr))
            {
                await initConn.OpenAsync();
                await using var cmd = initConn.CreateCommand();
                cmd.CommandText = $@"
                    CREATE SCHEMA ""{schemaA}"";
                    CREATE SCHEMA ""{schemaB}"";";
                await cmd.ExecuteNonQueryAsync();
            }

            // 1. Run real EF migration on Schema A
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var userId = Guid.NewGuid();

            await using (var ctxA = CreateDbContext(targetConnStr, schemaA))
            {
                await ctxA.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Test Tenant",
                    Code = "TT01",
                    Slug = "test-tenant",
                    Address = "123 Test St",
                    City = "Da Nang",
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var prop = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Test Property",
                    Code = "TP01",
                    Slug = "test-prop",
                    Address = "10 Hang Bong",
                    City = "Hanoi",
                    PropertyType = PropertyType.Hotel,
                    CheckInTime = new TimeOnly(14, 0, 0),
                    CheckOutTime = new TimeOnly(12, 0, 0),
                    BufferMinutes = 30,
                    TaxRatePercent = 8.00m,
                    ServiceFeeRatePercent = 5.00m,
                    IsPublished = true,
                    Status = PropertyStatus.Active,
                    MaxHourlyHours = 12,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Standard Room",
                    Code = "STD",
                    BasePrice = 500000m,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctxA.Tenants.Add(tenant);
                ctxA.Properties.Add(prop);
                ctxA.RoomTypes.Add(roomType);
                await ctxA.SaveChangesAsync();
            }

            // 2. Populate initial valid rate in Schema A
            await using (var seedConn = new NpgsqlConnection(targetConnStr))
            {
                await seedConn.OpenAsync();
                await using var seedCmd = seedConn.CreateCommand();
                seedCmd.CommandText = $@"
                    INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""FirstHours"", ""FirstHoursPrice"", ""AdditionalHourPrice"", ""NightlyPrice"", ""Currency"", ""EffectiveFrom"", ""EffectiveTo"", ""CreatedByUserId"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{Guid.NewGuid()}', '{tenantId}', '{propId}', '{roomTypeId}', 2, 200000, 50000, 800000, 'VND', '2026-01-01', '2026-01-10', '{userId}', true, now(), now());";
                await seedCmd.ExecuteNonQueryAsync();
            }

            // 3. Create dummy table in Schema B and drop Schema B CASCADE
            await using (var bConn = new NpgsqlConnection(targetConnStr))
            {
                await bConn.OpenAsync();
                await using var bCmd = bConn.CreateCommand();
                bCmd.CommandText = $@"
                    CREATE TABLE ""{schemaB}"".""DummyTable"" (id int);
                    INSERT INTO ""{schemaB}"".""DummyTable"" VALUES (1);
                    DROP SCHEMA ""{schemaB}"" CASCADE;";
                await bCmd.ExecuteNonQueryAsync();
            }

            // 4. Verify btree_gist extension is still in 'public'
            await using (var verifyConn = new NpgsqlConnection(targetConnStr))
            {
                await verifyConn.OpenAsync();
                var extensionSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(verifyConn);
                Assert.Equal("public", extensionSchema);

                // 5. Verify Schema A's GiST exclusion constraint is still fully operational
                // (a) Overlapping date range must fail with PostgresException 23P01 (exclusion_violation)
                var overlapEx = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await using var badCmd = verifyConn.CreateCommand();
                    badCmd.CommandText = $@"
                        INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""FirstHours"", ""FirstHoursPrice"", ""AdditionalHourPrice"", ""NightlyPrice"", ""Currency"", ""EffectiveFrom"", ""EffectiveTo"", ""CreatedByUserId"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                        VALUES ('{Guid.NewGuid()}', '{tenantId}', '{propId}', '{roomTypeId}', 2, 200000, 50000, 800000, 'VND', '2026-01-05', '2026-01-15', '{userId}', true, now(), now());";
                    await badCmd.ExecuteNonQueryAsync();
                });
                Assert.Equal("23P01", overlapEx.SqlState);

                // (b) Non-overlapping date range must succeed
                await using var goodCmd = verifyConn.CreateCommand();
                goodCmd.CommandText = $@"
                    INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""PropertyId"", ""RoomTypeId"", ""FirstHours"", ""FirstHoursPrice"", ""AdditionalHourPrice"", ""NightlyPrice"", ""Currency"", ""EffectiveFrom"", ""EffectiveTo"", ""CreatedByUserId"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{Guid.NewGuid()}', '{tenantId}', '{propId}', '{roomTypeId}', 2, 200000, 50000, 800000, 'VND', '2026-01-15', '2026-01-20', '{userId}', true, now(), now());";
                var rows = await goodCmd.ExecuteNonQueryAsync();
                Assert.Equal(1, rows);
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    // =========================================================================
    // SECTION 3: HELPER TESTS (LOW-LEVEL DIRECT LIFECYCLE TESTS)
    // =========================================================================

    [Fact]
    public async Task Helper_01_CleanDatabase_Initializes_Extension_In_Public_Schema()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            await using (var conn = new NpgsqlConnection(targetConnStr))
            {
                await conn.OpenAsync();

                var initialSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(conn);
                Assert.Null(initialSchema);

                await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);

                var resolvedSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(conn);
                Assert.Equal(PostgresExtensionLifecycleHelper.TargetStableSchema, resolvedSchema);

                await using var opClassCmd = conn.CreateCommand();
                opClassCmd.CommandText = @"
                    SELECT opcname, opcnamespace::regnamespace::text 
                    FROM pg_opclass 
                    WHERE opcname = 'gist_uuid_ops';";
                await using var reader = await opClassCmd.ExecuteReaderAsync();
                Assert.True(await reader.ReadAsync(), "gist_uuid_ops operator class must be registered.");
                Assert.Equal("public", reader.GetString(1));
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    [Fact]
    public async Task Helper_02_ConcurrentRunners_Initialize_Without_CatalogCollision_Or_Deadlock()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            const int runnerCount = 10;

            var tasks = Enumerable.Range(0, runnerCount).Select(async i =>
            {
                await using var conn = new NpgsqlConnection(targetConnStr);
                await conn.OpenAsync();
                await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);
            });

            await Task.WhenAll(tasks);

            await using var verifyConn = new NpgsqlConnection(targetConnStr);
            await verifyConn.OpenAsync();

            await using var countCmd = verifyConn.CreateCommand();
            countCmd.CommandText = "SELECT count(*), extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'btree_gist' GROUP BY extnamespace;";
            await using var reader = await countCmd.ExecuteReaderAsync();

            Assert.True(await reader.ReadAsync(), "btree_gist must exist in pg_extension.");
            Assert.Equal(1L, reader.GetInt64(0));
            Assert.Equal("public", reader.GetString(1));
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }

    [Fact]
    public async Task Helper_03_EphemeralSchemaDropCascade_Preserves_Extension_And_OtherSchemaConstraints()
    {
        var connStr = GetBaseConnectionString();
        PostgresTestDatabaseGuard.ValidateConnectionTarget(connStr);

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);

        var schemaA = $"p1b01b_repro_a_{Guid.NewGuid():N}";
        var schemaB = $"p1b01b_repro_b_{Guid.NewGuid():N}";

        try
        {
            await using (var cmdA = conn.CreateCommand())
            {
                cmdA.CommandText = $@"
                    CREATE SCHEMA ""{schemaA}"";
                    CREATE TABLE ""{schemaA}"".""RoomTypeRates"" (
                        ""Id"" uuid PRIMARY KEY,
                        ""TenantId"" uuid NOT NULL,
                        ""EffectiveRange"" daterange NOT NULL,
                        CONSTRAINT ""EXCLUDE_RoomTypeRates_NoOverlap"" EXCLUDE USING gist (
                            ""TenantId"" WITH =,
                            ""EffectiveRange"" WITH &&
                        )
                    );";
                await cmdA.ExecuteNonQueryAsync();
            }

            var tenantId = Guid.NewGuid();

            await using (var insertCmd = conn.CreateCommand())
            {
                insertCmd.CommandText = $@"
                    INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""EffectiveRange"")
                    VALUES ('{Guid.NewGuid()}', '{tenantId}', '[2026-01-01, 2026-01-10)');";
                await insertCmd.ExecuteNonQueryAsync();
            }

            await using (var cmdB = conn.CreateCommand())
            {
                cmdB.CommandText = $@"
                    CREATE SCHEMA ""{schemaB}"";
                    CREATE TABLE ""{schemaB}"".""DummyTable"" (id int);
                    INSERT INTO ""{schemaB}"".""DummyTable"" VALUES (1);";
                await cmdB.ExecuteNonQueryAsync();
            }

            await using (var dropBCmd = conn.CreateCommand())
            {
                dropBCmd.CommandText = $"DROP SCHEMA \"{schemaB}\" CASCADE;";
                await dropBCmd.ExecuteNonQueryAsync();
            }

            var extensionSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(conn);
            Assert.Equal("public", extensionSchema);

            var overlapEx = await Assert.ThrowsAsync<PostgresException>(async () =>
            {
                await using var badCmd = conn.CreateCommand();
                badCmd.CommandText = $@"
                    INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""EffectiveRange"")
                    VALUES ('{Guid.NewGuid()}', '{tenantId}', '[2026-01-05, 2026-01-15)');";
                await badCmd.ExecuteNonQueryAsync();
            });
            Assert.Equal("23P01", overlapEx.SqlState);

            await using (var goodCmd = conn.CreateCommand())
            {
                goodCmd.CommandText = $@"
                    INSERT INTO ""{schemaA}"".""RoomTypeRates"" (""Id"", ""TenantId"", ""EffectiveRange"")
                    VALUES ('{Guid.NewGuid()}', '{tenantId}', '[2026-01-15, 2026-01-20)');";
                var rows = await goodCmd.ExecuteNonQueryAsync();
                Assert.Equal(1, rows);
            }
        }
        finally
        {
            await using var cleanupCmd = conn.CreateCommand();
            cleanupCmd.CommandText = $@"
                DROP SCHEMA IF EXISTS ""{schemaA}"" CASCADE;
                DROP SCHEMA IF EXISTS ""{schemaB}"" CASCADE;";
            await cleanupCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Helper_04_ExtensionInUnauthorizedSchema_FailsFast_Without_DataLoss_Or_Relocation()
    {
        var tempDb = PostgresTestDatabaseGuard.GenerateEphemeralDatabaseName();
        await CreateTemporaryDatabaseAsync(tempDb);

        try
        {
            var targetConnStr = CreateDatabaseConnectionString(tempDb);
            await using (var conn = new NpgsqlConnection(targetConnStr))
            {
                await conn.OpenAsync();

                const string unauthorizedSchema = "custom_unauthorized_schema";

                await using (var setupCmd = conn.CreateCommand())
                {
                    setupCmd.CommandText = $@"
                        CREATE SCHEMA ""{unauthorizedSchema}"";
                        CREATE EXTENSION btree_gist SCHEMA ""{unauthorizedSchema}"";
                        CREATE TABLE ""{unauthorizedSchema}"".""ImportantOperationalData"" (
                            id int PRIMARY KEY,
                            payload text NOT NULL
                        );
                        INSERT INTO ""{unauthorizedSchema}"".""ImportantOperationalData"" VALUES (999, 'uncompromised_payload');";
                    await setupCmd.ExecuteNonQueryAsync();
                }

                var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);
                });

                Assert.Contains("[EXTENSION CONFIGURATION ERROR]", ex.Message);
                Assert.Contains(unauthorizedSchema, ex.Message);
                Assert.Contains("Manual intervention required", ex.Message);

                var currentSchema = await PostgresExtensionLifecycleHelper.GetBtreeGistSchemaAsync(conn);
                Assert.Equal(unauthorizedSchema, currentSchema);

                await using (var probeCmd = conn.CreateCommand())
                {
                    probeCmd.CommandText = $@"
                        SELECT payload 
                        FROM ""{unauthorizedSchema}"".""ImportantOperationalData"" 
                        WHERE id = 999;";
                    var payload = (string?)await probeCmd.ExecuteScalarAsync();
                    Assert.Equal("uncompromised_payload", payload);
                }
            }
        }
        finally
        {
            await DropTemporaryDatabaseAsync(tempDb);
        }
    }
}

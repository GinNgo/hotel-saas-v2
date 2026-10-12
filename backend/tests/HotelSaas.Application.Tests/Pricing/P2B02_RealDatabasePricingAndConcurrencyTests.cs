using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Pricing;

/// <summary>
/// Real database integration and concurrency tests for Phase P2B-02 verifying:
/// 1. Concurrent rate overlap rejection via btree_gist exclusion constraint (23P01 -> ERR_RATE_OVERLAP).
/// 2. Composite cross-scope foreign key validation (FK_RoomTypeRates_RoomTypes_Composite).
/// 3. Rate interval splitting (Mid, Head) and audit trail verification.
/// 4. Migration fail-closed rollback behavior when data exists.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P2B02_RealDatabasePricingAndConcurrencyTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        var isAllowed = dbName.EndsWith("_test", StringComparison.Ordinal)
                     || dbName == "hotel_saas_p1b01a_test"
                     || dbName.Contains("test_");

        if (!isAllowed)
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Target database '{builder.Database}' is NOT an authorized test database! " +
                "Refusing to execute DDL/DML. Target database name must contain '_test'.");
        }
    }

    private sealed class MockCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockCurrentPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class MockCurrentUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "tester@hotel.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Owner;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsurePropertyContext() { }
        public void EnsureTenantContext() { }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide) { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
    }

    private sealed class MockMembershipLookupService : IMembershipLookupService
    {
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                Domain.Enums.StaffRole.Owner,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }
    }

    private static ApplicationDbContext CreateDbContext(string connString, string testSchema, ICurrentTenantService tenantService)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ApplicationDbContext(options, tenantService);
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01(a|b)_(test|drift)_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<(Tenant tenant, Property prop1, Property prop2, RoomType rt1)> SeedBaseHierarchyAsync(
        ApplicationDbContext ctx,
        Guid tenantId,
        Guid prop1Id,
        Guid prop2Id,
        Guid roomTypeId)
    {
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Khách sạn Sài Gòn Concurrency",
            Code = $"SG-{tenantId:N}"[..12],
            Slug = $"sg-concurrency-{tenantId:N}"[..24],
            Address = "123 Le Loi",
            City = "TP. Ho Chi Minh",
            Status = TenantStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Tenants.Add(tenant);

        var prop1 = new Property
        {
            Id = prop1Id,
            TenantId = tenantId,
            Name = "Chi nhánh Quận 1",
            Code = $"SG-Q1-{prop1Id:N}"[..12],
            Slug = $"sg-q1-{prop1Id:N}",
            Address = "123 Le Loi, Q1",
            City = "TP. Ho Chi Minh",
            Status = PropertyStatus.Active,
            MaxHourlyHours = 12,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Properties.Add(prop1);

        var prop2 = new Property
        {
            Id = prop2Id,
            TenantId = tenantId,
            Name = "Chi nhánh Quận 3",
            Code = $"SG-Q3-{prop2Id:N}"[..12],
            Slug = $"sg-q3-{prop2Id:N}",
            Address = "456 Vo Van Tan, Q3",
            City = "TP. Ho Chi Minh",
            Status = PropertyStatus.Active,
            MaxHourlyHours = 12,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.Properties.Add(prop2);

        var roomType = new RoomType
        {
            Id = roomTypeId,
            TenantId = tenantId,
            PropertyId = prop1Id,
            Name = "Phòng Deluxe",
            Code = $"DLX-{roomTypeId:N}"[..10],
            BasePrice = 1000000m,
            MaxOccupancy = 2,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.RoomTypes.Add(roomType);

        await ctx.SaveChangesAsync();
        return (tenant, prop1, prop2, roomType);
    }

    [Fact]
    public async Task ConcurrentRateInsert_WithExclusionConstraint_BarrierGuaranteesConflictAndOneWinner()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();
                await SeedBaseHierarchyAsync(seedCtx, tenantId, prop1Id, prop2Id, roomTypeId);
            }

            // Prepare two independent DbContexts to simulate concurrent DB connections
            await using var ctx1 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await using var ctx2 = CreateDbContext(conn.ConnectionString, testSchema, tenantService);

            var barrier = new Barrier(2);

            var rate1 = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = prop1Id,
                RoomTypeId = roomTypeId,
                FirstHours = 2,
                FirstHoursPrice = 300000m,
                AdditionalHourPrice = 100000m,
                NightlyPrice = 1000000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 11, 1),
                EffectiveTo = new DateOnly(2026, 11, 15),
                CreatedByUserId = Guid.NewGuid(),
                ChangeReason = "Racer 1",
                IsActive = true
            };

            var rate2 = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = prop1Id,
                RoomTypeId = roomTypeId,
                FirstHours = 2,
                FirstHoursPrice = 350000m,
                AdditionalHourPrice = 120000m,
                NightlyPrice = 1200000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 11, 5), // Overlaps with rate1!
                EffectiveTo = new DateOnly(2026, 11, 20),
                CreatedByUserId = Guid.NewGuid(),
                ChangeReason = "Racer 2",
                IsActive = true
            };

            ctx1.RoomTypeRates.Add(rate1);
            ctx2.RoomTypeRates.Add(rate2);

            Exception? ex1 = null;
            Exception? ex2 = null;

            var task1 = Task.Run(async () =>
            {
                barrier.SignalAndWait();
                try
                {
                    await ctx1.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    ex1 = ex;
                }
            });

            var task2 = Task.Run(async () =>
            {
                barrier.SignalAndWait();
                try
                {
                    await ctx2.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    ex2 = ex;
                }
            });

            await Task.WhenAll(task1, task2);

            // Exactly one must succeed and one must fail
            var successCount = (ex1 == null ? 1 : 0) + (ex2 == null ? 1 : 0);
            var failureCount = (ex1 != null ? 1 : 0) + (ex2 != null ? 1 : 0);

            Assert.Equal(1, successCount);
            Assert.Equal(1, failureCount);

            var failedException = ex1 ?? ex2;
            Assert.NotNull(failedException);

            // Verify the failure is mapped to ConflictException or 23P01 exclusion violation
            bool isConflictOrExclusion =
                (failedException is ConflictException conflict && conflict.ErrorCode == "ERR_RATE_OVERLAP") ||
                (failedException is DbUpdateException dbEx && dbEx.InnerException is PostgresException pgEx && pgEx.SqlState == "23P01");

            Assert.True(isConflictOrExclusion, $"Expected 23P01 or ERR_RATE_OVERLAP, but received: {failedException}");

            // Verify exactly one active rate is in the database
            await using var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            var ratesInDb = await verifyCtx.RoomTypeRates
                .Where(r => r.RoomTypeId == roomTypeId && r.IsActive)
                .ToListAsync();

            Assert.Single(ratesInDb);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task RoomTypeRate_CompositeForeignKey_CrossPropertyViolation_ThrowsDbUpdateException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedBaseHierarchyAsync(ctx, tenantId, prop1Id, prop2Id, roomTypeId);

            // Attempt to insert a rate for RoomType RT1 (which belongs to Prop1), but specifying PropertyId = Prop2
            var invalidRate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = prop2Id, // Cross-property! RT1 belongs to prop1Id
                RoomTypeId = roomTypeId,
                FirstHours = 2,
                FirstHoursPrice = 300000m,
                AdditionalHourPrice = 100000m,
                NightlyPrice = 1000000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 12, 1),
                EffectiveTo = new DateOnly(2026, 12, 10),
                CreatedByUserId = Guid.NewGuid(),
                ChangeReason = "Cross property probe",
                IsActive = true
            };

            ctx.RoomTypeRates.Add(invalidRate);

            var dbEx = await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
            Assert.NotNull(dbEx.InnerException);
            var pgEx = Assert.IsType<PostgresException>(dbEx.InnerException);

            // Postgres 23503: foreign_key_violation
            Assert.Equal("23503", pgEx.SqlState);
            Assert.Contains("FK_RoomTypeRates_RoomTypes_Composite", pgEx.ConstraintName ?? pgEx.Message);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task IntervalSplitting_MidAndHead_UpdatesContinuousCoverageAndPersistsAudits()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };
            var propService = new MockCurrentPropertyService { PropertyId = prop1Id, HeaderPropertyId = prop1Id };
            var userContext = new MockCurrentUserContext { TenantId = tenantId, PropertyId = prop1Id };
            var membershipLookup = new MockMembershipLookupService();

            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService);
            await ctx.Database.MigrateAsync();
            await SeedBaseHierarchyAsync(ctx, tenantId, prop1Id, prop2Id, roomTypeId);

            var handler = new CreateRoomTypeRateCommandHandler(
                ctx, tenantService, propService, userContext, membershipLookup);

            // Step 1: Create initial baseline rate [2026-11-01, 2026-11-30]
            var cmd1 = new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeId,
                PropertyId: prop1Id,
                FirstHours: 2,
                FirstHoursPrice: 300000m,
                AdditionalHourPrice: 100000m,
                NightlyPrice: 1000000m,
                Currency: "VND",
                EffectiveFrom: new DateOnly(2026, 11, 1),
                EffectiveTo: new DateOnly(2026, 11, 30),
                ChangeReason: "Initial baseline schedule");

            var res1 = await handler.Handle(cmd1, CancellationToken.None);
            Assert.NotNull(res1);
            Assert.Equal(1000000m, res1.NightlyPrice);

            // Step 2: Mid-interval update [2026-11-15, 2026-11-30] with price 1,500,000
            // Should split:
            // - Existing rate shortened to [2026-11-01, 2026-11-15]
            // - New rate created [2026-11-15, 2026-11-30]
            var cmd2 = new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeId,
                PropertyId: prop1Id,
                FirstHours: 2,
                FirstHoursPrice: 400000m,
                AdditionalHourPrice: 150000m,
                NightlyPrice: 1500000m,
                Currency: "VND",
                EffectiveFrom: new DateOnly(2026, 11, 15),
                EffectiveTo: new DateOnly(2026, 11, 30),
                ChangeReason: "Mid-month holiday rate increase");

            var res2 = await handler.Handle(cmd2, CancellationToken.None);
            Assert.NotNull(res2);
            Assert.Equal(1500000m, res2.NightlyPrice);

            // Verify database state after Mid split
            var activeRatesAfterMid = await ctx.RoomTypeRates
                .Where(r => r.RoomTypeId == roomTypeId && r.IsActive)
                .OrderBy(r => r.EffectiveFrom)
                .ToListAsync();

            Assert.Equal(2, activeRatesAfterMid.Count);
            Assert.Equal(new DateOnly(2026, 11, 1), activeRatesAfterMid[0].EffectiveFrom);
            Assert.Equal(new DateOnly(2026, 11, 15), activeRatesAfterMid[0].EffectiveTo);
            Assert.Equal(1000000m, activeRatesAfterMid[0].NightlyPrice);

            Assert.Equal(new DateOnly(2026, 11, 15), activeRatesAfterMid[1].EffectiveFrom);
            Assert.Equal(new DateOnly(2026, 11, 30), activeRatesAfterMid[1].EffectiveTo);
            Assert.Equal(1500000m, activeRatesAfterMid[1].NightlyPrice);

            // Step 3: Exact Head replacement [2026-11-01, 2026-11-15] with price 1,200,000
            // Should deactivate existing [2026-11-01, 2026-11-15] rate and create new one
            var cmd3 = new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeId,
                PropertyId: prop1Id,
                FirstHours: 2,
                FirstHoursPrice: 350000m,
                AdditionalHourPrice: 120000m,
                NightlyPrice: 1200000m,
                Currency: "VND",
                EffectiveFrom: new DateOnly(2026, 11, 1),
                EffectiveTo: new DateOnly(2026, 11, 15),
                ChangeReason: "Early-month promotion adjustment");

            var res3 = await handler.Handle(cmd3, CancellationToken.None);
            Assert.NotNull(res3);
            Assert.Equal(1200000m, res3.NightlyPrice);

            // Verify active rates after Head replacement
            var activeRatesFinal = await ctx.RoomTypeRates
                .Where(r => r.RoomTypeId == roomTypeId && r.IsActive)
                .OrderBy(r => r.EffectiveFrom)
                .ToListAsync();

            Assert.Equal(2, activeRatesFinal.Count);
            Assert.Equal(new DateOnly(2026, 11, 1), activeRatesFinal[0].EffectiveFrom);
            Assert.Equal(new DateOnly(2026, 11, 15), activeRatesFinal[0].EffectiveTo);
            Assert.Equal(1200000m, activeRatesFinal[0].NightlyPrice);

            Assert.Equal(new DateOnly(2026, 11, 15), activeRatesFinal[1].EffectiveFrom);
            Assert.Equal(new DateOnly(2026, 11, 30), activeRatesFinal[1].EffectiveTo);
            Assert.Equal(1500000m, activeRatesFinal[1].NightlyPrice);

            // Verify audit records
            var audits = await ctx.RoomTypeRateAudits
                .Where(a => a.RoomTypeId == roomTypeId)
                .OrderBy(a => a.ChangedAtUtc)
                .ToListAsync();

            Assert.Contains(audits, a => a.ActionType == "Created");
            Assert.Contains(audits, a => a.ActionType == "Split_Shortened");
            Assert.Contains(audits, a => a.ActionType == "Split_Created");
            Assert.Contains(audits, a => a.ActionType == "Replaced");
            Assert.Contains(audits, a => a.ActionType == "Replaced_Created");
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task MigrationRollback_FailClosed_WhenDataExists_RefusesTableDrop()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var tenantService = new MockCurrentTenantService { TenantId = tenantId };

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await ctx.Database.MigrateAsync();
                await SeedBaseHierarchyAsync(ctx, tenantId, prop1Id, prop2Id, roomTypeId);

                // Insert business rate data
                var rate = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = prop1Id,
                    RoomTypeId = roomTypeId,
                    FirstHours = 2,
                    FirstHoursPrice = 300000m,
                    AdditionalHourPrice = 100000m,
                    NightlyPrice = 1000000m,
                    Currency = "VND",
                    EffectiveFrom = new DateOnly(2026, 11, 1),
                    EffectiveTo = new DateOnly(2026, 11, 15),
                    CreatedByUserId = Guid.NewGuid(),
                    ChangeReason = "Preserve test data",
                    IsActive = true
                };
                ctx.RoomTypeRates.Add(rate);
                await ctx.SaveChangesAsync();
            }

            // Down SQL logic from 20261008000000_P2B02_Rates_Policies_Quote.cs
            var downSql = @"
                DO $$
                DECLARE
                    v_rates_count bigint := 0;
                    v_audits_count bigint := 0;
                    v_surcharges_count bigint := 0;
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'RoomTypeRates') THEN
                        SELECT count(*) INTO v_rates_count FROM ""RoomTypeRates"";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'RoomTypeRateAudits') THEN
                        SELECT count(*) INTO v_audits_count FROM ""RoomTypeRateAudits"";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'PropertySurchargePolicies') THEN
                        SELECT count(*) INTO v_surcharges_count FROM ""PropertySurchargePolicies"";
                    END IF;

                    -- Fail-closed guard: Abort if any business data exists
                    IF v_rates_count > 0 OR v_audits_count > 0 OR v_surcharges_count > 0 THEN
                        RAISE EXCEPTION 'MIGRATION ROLLBACK ABORTED (FAIL-CLOSED): Schema ""%"" contains business data (RoomTypeRates: %, RoomTypeRateAudits: %, PropertySurchargePolicies: %). Table drop aborted.', current_schema(), v_rates_count, v_audits_count, v_surcharges_count;
                    END IF;

                    -- Only drop when empty
                    DROP TABLE IF EXISTS ""PropertySurchargePolicies"";
                    DROP TABLE IF EXISTS ""RoomTypeRateAudits"";
                    DROP TABLE IF EXISTS ""RoomTypeRates"";
                END $$;";

            // 1. Attempt rollback while data exists -> Must throw PostgresException with FAIL-CLOSED
            await using (var rollbackCmd = conn.CreateCommand())
            {
                rollbackCmd.CommandText = downSql;
                var pgEx = await Assert.ThrowsAsync<PostgresException>(() => rollbackCmd.ExecuteNonQueryAsync());
                Assert.Contains("MIGRATION ROLLBACK ABORTED (FAIL-CLOSED)", pgEx.Message);
            }

            // Verify tables still exist
            await using (var checkCmd = conn.CreateCommand())
            {
                checkCmd.CommandText = @"
                    SELECT count(*) FROM information_schema.tables 
                    WHERE table_schema = current_schema() 
                      AND table_name IN ('RoomTypeRates', 'PropertySurchargePolicies', 'RoomTypeRateAudits');";
                var tableCount = (long)(await checkCmd.ExecuteScalarAsync() ?? 0L);
                Assert.Equal(3L, tableCount);
            }

            // 2. Clean business data and re-attempt rollback -> Must succeed and drop tables
            await using (var cleanCmd = conn.CreateCommand())
            {
                cleanCmd.CommandText = "DELETE FROM \"RoomTypeRates\";";
                await cleanCmd.ExecuteNonQueryAsync();
            }

            await using (var rollbackCmd2 = conn.CreateCommand())
            {
                rollbackCmd2.CommandText = downSql;
                await rollbackCmd2.ExecuteNonQueryAsync(); // Must succeed now
            }

            // Verify tables are now dropped
            await using (var checkCmd2 = conn.CreateCommand())
            {
                checkCmd2.CommandText = @"
                    SELECT count(*) FROM information_schema.tables 
                    WHERE table_schema = current_schema() 
                      AND table_name IN ('RoomTypeRates', 'PropertySurchargePolicies', 'RoomTypeRateAudits');";
                var tableCountAfterDrop = (long)(await checkCmd2.ExecuteScalarAsync() ?? 0L);
                Assert.Equal(0L, tableCountAfterDrop);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}

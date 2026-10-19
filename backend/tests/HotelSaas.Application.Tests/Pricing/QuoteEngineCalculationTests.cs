using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Pricing;

/// <summary>
/// Unit and integration tests for the Quote Engine verifying Hourly, Overnight, Surcharge Fail-Closed,
/// and Decision D05, D06, D12, D13, D14, D19, D20, D25 pricing rules.
/// Executed on isolated schemas in the authorized PostgreSQL test database.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class QuoteEngineCalculationTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
        };
        return builder.ConnectionString;
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

    private static async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
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

    private static async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
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

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "user@test.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Manager;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
        public void SetMembershipContext(
            Guid tenantId,
            TenantStatus tenantStatus,
            Guid? propertyId,
            PropertyStatus? propertyStatus,
            StaffRole? staffRole,
            Guid? roleId,
            bool isTenantWide)
        {
            TenantId = tenantId;
            TenantStatus = tenantStatus;
            PropertyId = propertyId;
            PropertyStatus = propertyStatus;
            StaffRole = staffRole;
            RoleId = roleId;
            IsTenantWide = isTenantWide;
        }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public MembershipLookupStatus StatusToReturn { get; set; } = MembershipLookupStatus.Success;

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId, Guid userId, Guid? targetPropertyId, CancellationToken cancellationToken = default)
        {
            if (StatusToReturn == MembershipLookupStatus.Success)
                return Task.FromResult(MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Receptionist, targetPropertyId, true));
            return Task.FromResult(MembershipLookupResult.Failed(StatusToReturn, "Membership error"));
        }

        public Task<IReadOnlyList<UserMembershipDto>> GetUserMembershipsAsync(
            Guid userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<UserMembershipDto>>(Array.Empty<UserMembershipDto>());
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

    private static async Task<(Tenant tenant, Property property, RoomType roomType)> SeedBaselineEntitiesAsync(
        ApplicationDbContext context,
        int maxHourlyHours = 12)
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = "Luxury Hotel Group",
            Code = $"LUX_{Guid.NewGuid():N}"[..12],
            Status = TenantStatus.Active
        };
        context.Tenants.Add(tenant);

        var property = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Danang Beach Resort",
            Code = $"DN_{Guid.NewGuid():N}"[..12],
            Slug = $"dn_{Guid.NewGuid():N}"[..24],
            Address = "123 Vo Nguyen Giap",
            City = "Da Nang",
            CheckInTime = new TimeOnly(12, 0, 0),
            CheckOutTime = new TimeOnly(12, 0, 0),
            BufferMinutes = 30,
            MaxHourlyHours = maxHourlyHours,
            Status = PropertyStatus.Active
        };
        context.Properties.Add(property);

        var roomType = new RoomType
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            PropertyId = property.Id,
            Name = "Deluxe Ocean View",
            Code = $"DOV_{Guid.NewGuid():N}"[..12],
            BasePrice = 400000m,
            MaxOccupancy = 2
        };
        context.RoomTypes.Add(roomType);

        await context.SaveChangesAsync();
        return (tenant, property, roomType);
    }

    [Fact]
    public async Task CalculateQuote_Hourly_ExactPackageHours_ReturnsFirstHoursPrice()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 1, 1),
                EffectiveTo = new DateOnly(2026, 12, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2);
            var result = await handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None);

            Assert.Equal(150000m, result.TotalAmount);
            Assert.Single(result.Breakdown);
            Assert.Equal("Gói 2 giờ đầu tiên", result.Breakdown[0].Description);
            Assert.Equal(150000m, result.Breakdown[0].Amount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Hourly_ExceedsBy1Minute_RoundsUpTo1ExtraHour_PerDecisionD05()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 1, 1),
                EffectiveTo = new DateOnly(2026, 12, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddMinutes(121);
            var result = await handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None);

            Assert.Equal(200000m, result.TotalAmount);
            Assert.Equal(2, result.Breakdown.Count);
            Assert.Equal(150000m, result.Breakdown[0].Amount);
            Assert.Equal(50000m, result.Breakdown[1].Amount);
            Assert.Equal("Giờ phát sinh (1 giờ thêm)", result.Breakdown[1].Description);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Hourly_ExceedsBy61Minutes_RoundsUpTo2ExtraHours_PerDecisionD05()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 1, 1),
                EffectiveTo = new DateOnly(2026, 12, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddMinutes(181);
            var result = await handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None);

            Assert.Equal(250000m, result.TotalAmount);
            Assert.Equal(2, result.Breakdown.Count);
            Assert.Equal(100000m, result.Breakdown[1].Amount);
            Assert.Equal("Giờ phát sinh (2 giờ thêm)", result.Breakdown[1].Description);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Hourly_ExceedsMaxHourlyLimit_ThrowsUnprocessableEntity_PerDecisionD14()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx, maxHourlyHours: 12);
            tenantSvc.TenantId = tenant.Id;

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 6, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(13);

            var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() =>
                handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None));

            Assert.Equal("ERR_HOURLY_LIMIT_EXCEEDED", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Overnight_Standard3Nights_SumsDailyRates_PerDecisionD06()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 10, 1),
                EffectiveTo = new DateOnly(2026, 10, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 10, 5, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 10, 13, 5, 0, 0, DateTimeKind.Utc);

            var query = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                start,
                end,
                CheckInDate: new DateOnly(2026, 10, 10),
                CheckOutDate: new DateOnly(2026, 10, 13));

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(1200000m, result.TotalAmount);
            Assert.Equal(3, result.Breakdown.Count);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Overnight_EarlyCheckIn_WithPolicy_CalculatesPercentageSurcharge_PerDecisionD19_D25()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 10, 1),
                EffectiveTo = new DateOnly(2026, 10, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);

            var surcharge = new PropertySurchargePolicy
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                SurchargeType = SurchargeType.EarlyCheckIn,
                FromTime = new TimeOnly(9, 0, 0),
                ToTime = new TimeOnly(12, 0, 0),
                CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                Percentage = 30.0m,
                IsActive = true
            };
            ctx.PropertySurchargePolicies.Add(surcharge);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 3, 0, 0, DateTimeKind.Utc); // 10:00 ICT
            var end = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);   // 12:00 ICT

            var query = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                start,
                end,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16));

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(520000m, result.TotalAmount);
            Assert.Equal(2, result.Breakdown.Count);
            Assert.Equal(400000m, result.Breakdown[0].Amount);
            Assert.Equal(120000m, result.Breakdown[1].Amount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Overnight_EarlyCheckIn_WithoutPolicy_FailsClosed_PerDecisionD19()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 400000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 10, 1),
                EffectiveTo = new DateOnly(2026, 10, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 2, 0, 0, DateTimeKind.Utc); // 09:00 ICT
            var end = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);   // 12:00 ICT

            var query = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                start,
                end,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16));

            var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() =>
                handler.Handle(query, CancellationToken.None));

            Assert.Equal("ERR_SURCHARGE_NOT_CONFIGURED", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task CalculateQuote_Hourly_MissingPricing_ThrowsUnprocessableEntity_PerDecisionBR_PRICE03()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);
            tenantSvc.TenantId = tenant.Id;

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2);

            var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() =>
                handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None));

            Assert.Equal("ERR_PRICING_NOT_CONFIGURED", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}

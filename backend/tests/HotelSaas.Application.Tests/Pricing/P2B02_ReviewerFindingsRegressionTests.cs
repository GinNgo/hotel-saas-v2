using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Pricing;

/// <summary>
/// Regression test suite strictly verifying the resolution of 5 Reviewer Findings for Phase P2B-02:
/// - Finding 1: Decision D14 is pending PO approval; interim branch hourly limit enforced.
/// - Finding 2: Quote authorization; membership must be strictly Success; missing context/revoked/inactive fail closed.
/// - Finding 3: CheckInDate/CheckOutDate must strictly match StartAtUtc/EndAtUtc in branch local timezone, preventing missed nights.
/// - Finding 4: RentalType outside enum is rejected with BadRequest; never returns a 0 VND quote.
/// - Finding 5: Exact duration calculation without prior minute rounding; VND amounts rounded with AwayFromZero.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P2B02_ReviewerFindingsRegressionTests
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

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public MembershipLookupStatus StatusToReturn { get; set; } = MembershipLookupStatus.Success;

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId, Guid userId, Guid? targetPropertyId, CancellationToken cancellationToken = default)
        {
            if (StatusToReturn == MembershipLookupStatus.Success)
                return Task.FromResult(MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Receptionist, targetPropertyId, true));
            return Task.FromResult(MembershipLookupResult.Failed(StatusToReturn, $"Membership resolution returned status {StatusToReturn}"));
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
            Name = "Reviewer Test Group",
            Code = $"REV_{Guid.NewGuid():N}"[..12],
            Status = TenantStatus.Active
        };
        context.Tenants.Add(tenant);

        var property = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = "Findings Resolution Hotel",
            Code = $"PROP_{Guid.NewGuid():N}"[..12],
            Slug = $"prop_{Guid.NewGuid():N}"[..24],
            Address = "456 Tran Phu, Da Nang",
            City = "Da Nang",
            CheckInTime = new TimeOnly(14, 0, 0),
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
            Name = "Executive Suite",
            Code = $"EXEC_{Guid.NewGuid():N}"[..12],
            BasePrice = 400000m,
            MaxOccupancy = 2
        };
        context.RoomTypes.Add(roomType);

        await context.SaveChangesAsync();
        return (tenant, property, roomType);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 1: Decision D14 is Pending PO Approval (Chờ PO phê duyệt)
    // Interim branch policy limit (1..24, default 12) enforced without claiming finality.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding1_D14_PendingPOApproval_InterimConfiguration_DocumentedAndEnforced()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            // Seed property with interim limit of 8 hours
            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx, maxHourlyHours: 8);
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

            // Test A: Requesting 8 hours 1 second (exceeds interim limit 8h) -> 422 ERR_HOURLY_LIMIT_EXCEEDED
            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var endExceeded = start.AddHours(8).AddSeconds(1);

            var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() =>
                handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, endExceeded), CancellationToken.None));

            Assert.Equal("ERR_HOURLY_LIMIT_EXCEEDED", ex.ErrorCode);
            Assert.Contains("vượt quá giới hạn tối đa cho phép của chi nhánh (8 giờ)", ex.Message);

            // Test B: Requesting within interim limit (exact 8 hours) -> Success
            var endWithin = start.AddHours(8);
            var result = await handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, endWithin), CancellationToken.None);
            Assert.NotNull(result);
            Assert.Equal(8, result.AppliedPolicies.MaxHourlyHours);
            Assert.Equal(150000m + (6 * 50000m), result.TotalAmount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 2: Quote authorization; membership only Success proceeds; fail-closed.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding2a_Quote_MissingTenantOrUserContext_FailsClosed_ThrowsUnauthorizedAccessException()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, roomType) = await SeedBaselineEntitiesAsync(ctx);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2);
            var query = new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end);

            // Case 1: TenantId is null
            tenantSvc.TenantId = null;
            var userCtx1 = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler1 = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx1, membershipSvc);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler1.Handle(query, CancellationToken.None));

            // Case 2: UserId is empty
            tenantSvc.TenantId = tenant.Id;
            var userCtx2 = new StubUserContext { UserId = Guid.Empty };
            var handler2 = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx2, membershipSvc);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler2.Handle(query, CancellationToken.None));
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Finding2b_Quote_ContextMismatch_ThrowsBadRequestException()
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
            var propSvc = new StubPropertyService
            {
                HeaderPropertyId = Guid.NewGuid() // Mismatched header property
            };

            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc, propSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2);
            var query = new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end);

            var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(query, CancellationToken.None));

            Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Theory]
    [InlineData(MembershipLookupStatus.MembershipRevoked, "ERR_MEMBERSHIP_REVOKED", typeof(ForbiddenException))]
    [InlineData(MembershipLookupStatus.PropertyInactive, "ERR_PROPERTY_INACTIVE", typeof(ConflictException))]
    [InlineData(MembershipLookupStatus.PropertyForbidden, "ERR_PROPERTY_FORBIDDEN", typeof(ForbiddenException))]
    [InlineData(MembershipLookupStatus.TenantNotFoundOrInactive, "ERR_TENANT_INACTIVE", typeof(ForbiddenException))]
    public async Task Finding2c_Quote_MembershipNotSuccess_FailsClosed(
        MembershipLookupStatus status, string expectedErrorCode, Type expectedExceptionType)
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
            var membershipSvc = new StubMembershipLookupService { StatusToReturn = status };
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2);
            var query = new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end);

            var ex = await Assert.ThrowsAsync(expectedExceptionType, () =>
                handler.Handle(query, CancellationToken.None));

            if (ex is ForbiddenException fe)
            {
                Assert.Equal(expectedErrorCode, fe.ErrorCode);
            }
            else if (ex is ConflictException ce)
            {
                Assert.Equal(expectedErrorCode, ce.ErrorCode);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 3: CheckInDate/CheckOutDate must match StartAtUtc/EndAtUtc in local timezone.
    // Prevents underbilling or missed nights.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding3_DatesMustMatchStartEndUtc_InBranchTimeZone_PreventsNightLoss()
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

            // 3 nights stay in Vietnam time (UTC+7):
            // Start: 2026-10-15 14:00 local = 2026-10-15T07:00:00Z
            // End:   2026-10-18 12:00 local = 2026-10-18T05:00:00Z
            var startUtc = new DateTime(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc);
            var endUtc = new DateTime(2026, 10, 18, 5, 0, 0, DateTimeKind.Utc);

            // Case A: Client passes mismatched CheckOutDate (trying to pay only 1 night from Oct 15 to Oct 16)
            var mismatchCheckoutQuery = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                startUtc,
                endUtc,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16)); // MISMATCH: EndAtUtc is Oct 18!

            var exA = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(mismatchCheckoutQuery, CancellationToken.None));

            Assert.Equal("ERR_DATE_TIMEZONE_MISMATCH", exA.ErrorCode);
            Assert.Contains("Ngày trả phòng", exA.Message);

            // Case B: Client passes mismatched CheckInDate
            var mismatchCheckinQuery = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                startUtc,
                endUtc,
                CheckInDate: new DateOnly(2026, 10, 16), // MISMATCH: StartAtUtc is Oct 15!
                CheckOutDate: new DateOnly(2026, 10, 18));

            var exB = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(mismatchCheckinQuery, CancellationToken.None));

            Assert.Equal("ERR_DATE_TIMEZONE_MISMATCH", exB.ErrorCode);
            Assert.Contains("Ngày nhận phòng", exB.Message);

            // Case C: Matching dates accurately computes all 3 nights without loss
            var matchingQuery = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                startUtc,
                endUtc,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 18));

            var result = await handler.Handle(matchingQuery, CancellationToken.None);
            Assert.Equal(3 * 400000m, result.TotalAmount); // Exactly 1,200,000 VND for 3 nights
            Assert.Equal(3, result.Breakdown.Count);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 4: RentalType outside enum is rejected; never returns 0 VND quote.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding4_InvalidRentalType_RejectedWithBadRequest_NeverReturnsZeroVndQuote()
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

            // Test A: RentalType = 99
            var invalidEnumQuery = new CalculateQuoteQuery(property.Id, roomType.Id, (RentalType)99, start, end);
            var ex99 = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(invalidEnumQuery, CancellationToken.None));

            Assert.Equal("ERR_INVALID_RENTAL_TYPE", ex99.ErrorCode);

            // Test B: RentalType = 0
            var zeroEnumQuery = new CalculateQuoteQuery(property.Id, roomType.Id, (RentalType)0, start, end);
            var ex0 = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(zeroEnumQuery, CancellationToken.None));

            Assert.Equal("ERR_INVALID_RENTAL_TYPE", ex0.ErrorCode);

            // Test C: Validator also rejects invalid RentalType
            var validator = new CalculateQuoteQueryValidator();
            var validationResult = await validator.ValidateAsync(invalidEnumQuery);
            Assert.False(validationResult.IsValid);
            Assert.Contains(validationResult.Errors, e => e.ErrorCode == "ERR_INVALID_RENTAL_TYPE");
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 5: Exact duration calculation without Math.Round on minutes;
    // AwayFromZero integer VND rounding.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding5a_ExactDuration_WithoutIntermediateMinuteRounding_CeilsExtraHour()
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

            // Duration: 2 hours and 20 seconds (= 120 minutes 20 seconds)
            // With previous Math.Round((End - Start).TotalMinutes), 120.33 was rounded DOWN to 120,
            // resulting in 0 extra hours and charging only 150,000 VND.
            // With exact TimeSpan and Ceiling(extraDuration.TotalHours), 20 seconds is correctly billed as 1 extra hour.
            var start = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc);
            var end = start.AddHours(2).AddSeconds(20);

            var result = await handler.Handle(new CalculateQuoteQuery(property.Id, roomType.Id, RentalType.Hourly, start, end), CancellationToken.None);

            Assert.Equal(200000m, result.TotalAmount); // 150,000 (2h) + 50,000 (1 extra hour)
            Assert.Equal(2, result.Breakdown.Count);
            Assert.Equal("Gói 2 giờ đầu tiên", result.Breakdown[0].Description);
            Assert.Equal(150000m, result.Breakdown[0].Amount);
            Assert.Equal("Giờ phát sinh (1 giờ thêm)", result.Breakdown[1].Description);
            Assert.Equal(50000m, result.Breakdown[1].Amount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Finding5b_AwayFromZero_VndRounding_EnforcedOnAllLineItemsAndTotal()
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

            // Rate with fractional amount: 350,001 VND
            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomTypeId = roomType.Id,
                FirstHours = 2,
                FirstHoursPrice = 150000m,
                AdditionalHourPrice = 50000m,
                NightlyPrice = 350001m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 1, 1),
                EffectiveTo = new DateOnly(2026, 12, 31),
                CreatedByUserId = Guid.NewGuid(),
                IsActive = true
            };
            ctx.RoomTypeRates.Add(rate);

            // Policy with percentage producing midpoint: 12.5% of 350,001 = 43,750.125
            // Or let's test a policy with 50% on 350,001: 350,001 * 0.5 = 175,000.5
            // In AwayFromZero rounding: 175,000.5 -> 175,001.0 (in standard bankers/ToEven it would round to 175,000)
            var surcharge = new PropertySurchargePolicy
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                SurchargeType = SurchargeType.EarlyCheckIn,
                FromTime = new TimeOnly(8, 0, 0),
                ToTime = new TimeOnly(13, 59, 59),
                CalculationMethod = SurchargeCalculationMethod.PercentageOfNightly,
                Percentage = 50.0m, // 50% of 350,001 = 175,000.5
                IsActive = true
            };
            ctx.PropertySurchargePolicies.Add(surcharge);
            await ctx.SaveChangesAsync();

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CalculateQuoteQueryHandler(ctx, tenantSvc, userCtx, membershipSvc);

            // Check-in at 10:00 ICT = 03:00 UTC (Early check-in)
            // Check-out at 12:00 ICT = 05:00 UTC
            var start = new DateTime(2026, 10, 15, 3, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 10, 16, 5, 0, 0, DateTimeKind.Utc);

            var query = new CalculateQuoteQuery(
                property.Id,
                roomType.Id,
                RentalType.Overnight,
                start,
                end,
                CheckInDate: new DateOnly(2026, 10, 15),
                CheckOutDate: new DateOnly(2026, 10, 16));

            var result = await handler.Handle(query, CancellationToken.None);

            // Midpoint AwayFromZero: 175,000.5 rounds UP to 175,001
            Assert.Equal(2, result.Breakdown.Count);
            Assert.Equal(350001m, result.Breakdown[0].Amount);
            Assert.Equal(175001m, result.Breakdown[1].Amount); // Midpoint rounded AwayFromZero!
            Assert.Equal(350001m + 175001m, result.TotalAmount); // 525,002 VND
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 6: UpdatePropertyPolicies strictly requires MembershipLookupStatus.Success.
    // Non-success statuses fail closed without any DML mutation to policies.
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding6_UpdatePropertyPolicies_AllNonSuccessMembershipStatuses_FailClosed_WithoutDml()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);
        try
        {
            var tenantSvc = new StubTenantService();
            await using var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc);
            await ctx.Database.MigrateAsync();

            var (tenant, property, _) = await SeedBaselineEntitiesAsync(ctx, maxHourlyHours: 12);
            tenantSvc.TenantId = tenant.Id;

            var userCtx = new StubUserContext { UserId = Guid.NewGuid() };
            var propSvc = new StubPropertyService();
            var membershipSvc = new StubMembershipLookupService();
            var handler = new UpdatePropertyPoliciesCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipSvc);

            var testCases = new (MembershipLookupStatus Status, string ExpectedErrorCode, Type ExpectedException)[]
            {
                (MembershipLookupStatus.MembershipRevoked, "ERR_MEMBERSHIP_REVOKED", typeof(ForbiddenException)),
                (MembershipLookupStatus.PropertyInactive, "ERR_PROPERTY_INACTIVE", typeof(ConflictException)),
                (MembershipLookupStatus.PropertyForbidden, "ERR_PROPERTY_FORBIDDEN", typeof(ForbiddenException)),
                (MembershipLookupStatus.TenantNotFoundOrInactive, "ERR_TENANT_INACTIVE", typeof(ForbiddenException)),
                (MembershipLookupStatus.UserNotFoundOrInactive, "ERR_USER_DEACTIVATED", typeof(UnauthorizedAccessException)),
                (MembershipLookupStatus.PropertyRequired, "ERR_PROPERTY_REQUIRED", typeof(ForbiddenException)),
                (MembershipLookupStatus.NoMembership, "ERR_FORBIDDEN", typeof(ForbiddenException))
            };

            var command = new UpdatePropertyPoliciesCommand(
                property.Id,
                null,
                null,
                45,
                8,
                null);

            foreach (var tc in testCases)
            {
                membershipSvc.StatusToReturn = tc.Status;
                var ex = await Assert.ThrowsAsync(tc.ExpectedException, () =>
                    handler.Handle(command, CancellationToken.None));

                if (ex is ForbiddenException fe)
                {
                    Assert.Equal(tc.ExpectedErrorCode, fe.ErrorCode);
                }
                else if (ex is ConflictException ce)
                {
                    Assert.Equal(tc.ExpectedErrorCode, ce.ErrorCode);
                }
            }

            // Verify fail-closed: NO DML mutation took place
            var unchangedProp = await ctx.Properties.AsNoTracking().FirstAsync(p => p.Id == property.Id);
            Assert.Equal(30, unchangedProp.BufferMinutes); // Unchanged original value
            Assert.Equal(12, unchangedProp.MaxHourlyHours); // Unchanged original value
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FINDING 7: CreateRoomTypeRate strictly requires MembershipLookupStatus.Success.
    // Non-success statuses fail closed without any DML mutation (no rates inserted).
    // ─────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Finding7_CreateRoomTypeRate_AllNonSuccessMembershipStatuses_FailClosed_WithoutDml()
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
            var propSvc = new StubPropertyService();
            var membershipSvc = new StubMembershipLookupService();
            var handler = new CreateRoomTypeRateCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipSvc);

            var testCases = new (MembershipLookupStatus Status, string ExpectedErrorCode, Type ExpectedException)[]
            {
                (MembershipLookupStatus.MembershipRevoked, "ERR_MEMBERSHIP_REVOKED", typeof(ForbiddenException)),
                (MembershipLookupStatus.PropertyInactive, "ERR_PROPERTY_INACTIVE", typeof(ConflictException)),
                (MembershipLookupStatus.PropertyForbidden, "ERR_PROPERTY_FORBIDDEN", typeof(ForbiddenException)),
                (MembershipLookupStatus.TenantNotFoundOrInactive, "ERR_TENANT_INACTIVE", typeof(ForbiddenException)),
                (MembershipLookupStatus.UserNotFoundOrInactive, "ERR_USER_DEACTIVATED", typeof(UnauthorizedAccessException)),
                (MembershipLookupStatus.PropertyRequired, "ERR_PROPERTY_REQUIRED", typeof(ForbiddenException)),
                (MembershipLookupStatus.NoMembership, "ERR_FORBIDDEN", typeof(ForbiddenException))
            };

            var command = new CreateRoomTypeRateCommand(
                roomType.Id,
                property.Id,
                2,
                300000m,
                100000m,
                1200000m,
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20)),
                "VND",
                "Unauthorized attempt");

            foreach (var tc in testCases)
            {
                membershipSvc.StatusToReturn = tc.Status;
                var ex = await Assert.ThrowsAsync(tc.ExpectedException, () =>
                    handler.Handle(command, CancellationToken.None));

                if (ex is ForbiddenException fe)
                {
                    Assert.Equal(tc.ExpectedErrorCode, fe.ErrorCode);
                }
                else if (ex is ConflictException ce)
                {
                    Assert.Equal(tc.ExpectedErrorCode, ce.ErrorCode);
                }
            }

            // Verify fail-closed: NO DML mutation took place (0 rates inserted)
            var rateCount = await ctx.RoomTypeRates.CountAsync(r => r.RoomTypeId == roomType.Id);
            Assert.Equal(0, rateCount);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}

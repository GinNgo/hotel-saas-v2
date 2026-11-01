using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Audit;

/// <summary>
/// Comprehensive PostgreSQL integration and unit tests for T03-A Backend Audit Logging System.
/// Covers all 13 mandatory verification scenarios on isolated PostgreSQL schemas.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class T03A_AuditLoggingTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
                   ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING");
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
                $"[CRITICAL SECURITY ALERT] Target database '{builder.Database}' is NOT an authorized test database!");
        }
    }

    private static async Task<NpgsqlConnection> CreateIsolatedSchemaAsync(string testSchema)
    {
        NpgsqlConnection.ClearAllPools();
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

    private static async Task DropIsolatedSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01b_test_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid test schema name '{testSchema}'.");
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
        NpgsqlConnection.ClearAllPools();
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "manager@luxestay.vn";
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
        public string? IpAddress { get; private set; } = "203.113.148.55";

        public void SetIpAddress(string? ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress))
            {
                IpAddress = null;
                return;
            }

            IpAddress = System.Net.IPAddress.TryParse(ipAddress.Trim(), out var parsed)
                ? parsed.ToString()
                : null;
        }

        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }

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
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                StaffRole.Manager,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }

        public Task<IReadOnlyList<UserMembershipDto>> GetUserMembershipsAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<UserMembershipDto>>(Array.Empty<UserMembershipDto>());
        }
    }

    private static ApplicationDbContext CreateAuditedDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        AuditInterceptorOptions? customOptions = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };

        var tenantInterceptor = new TenantPropertySaveChangesInterceptor(tenantService, propertyService);
        var auditInterceptor = new AuditSaveChangesInterceptor(tenantService, propertyService, userContext, customOptions);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(tenantInterceptor, auditInterceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propertyService);
    }

    private static async Task<(Guid TenantId, Guid PropertyAId, Guid PropertyBId, Guid RoomTypeAId, Guid RoomTypeBId)> SeedBaselineHierarchyAsync(
        string connString,
        string testSchema)
    {
        var tenantId = Guid.NewGuid();
        var propertyAId = Guid.NewGuid();
        var propertyBId = Guid.NewGuid();
        var roomTypeAId = Guid.NewGuid();
        var roomTypeBId = Guid.NewGuid();

        var tenantService = new StubTenantService { TenantId = tenantId };
        var propertyService = new StubPropertyService { IsTenantWide = true };
        var userContext = new StubUserContext { TenantId = tenantId };

        await using var ctx = CreateAuditedDbContext(connString, testSchema, tenantService, propertyService, userContext);
        await ctx.Database.MigrateAsync();

        ctx.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "LuxeStay Hospitality Group",
            Code = $"LSG-{tenantId.ToString("N")[..6]}",
            Slug = $"luxestay-{tenantId.ToString("N")[..6]}",
            Address = "100 Nguyễn Huệ",
            City = "Hồ Chí Minh",
            Status = TenantStatus.Active
        });

        ctx.Properties.AddRange(
            new Property
            {
                Id = propertyAId,
                TenantId = tenantId,
                Name = "LuxeStay Quận 1",
                Code = "CN-Q1",
                Slug = $"luxestay-q1-{propertyAId.ToString("N")[..6]}",
                Address = "100 Nguyễn Huệ, Quận 1",
                City = "Hồ Chí Minh",
                Status = PropertyStatus.Active
            },
            new Property
            {
                Id = propertyBId,
                TenantId = tenantId,
                Name = "LuxeStay Đà Nẵng",
                Code = "CN-DN",
                Slug = $"luxestay-dn-{propertyBId.ToString("N")[..6]}",
                Address = "200 Võ Nguyên Giáp, Đà Nẵng",
                City = "Đà Nẵng",
                Status = PropertyStatus.Active
            });

        ctx.RoomTypes.AddRange(
            new RoomType
            {
                Id = roomTypeAId,
                TenantId = tenantId,
                PropertyId = propertyAId,
                Code = "DLX-Q1",
                Name = "Deluxe Quận 1",
                BasePrice = 850_000m,
                MaxOccupancy = 2
            },
            new RoomType
            {
                Id = roomTypeBId,
                TenantId = tenantId,
                PropertyId = propertyBId,
                Code = "DLX-DN",
                Name = "Deluxe Đà Nẵng",
                BasePrice = 900_000m,
                MaxOccupancy = 2
            });

        await ctx.SaveChangesAsync();
        return (tenantId, propertyAId, propertyBId, roomTypeAId, roomTypeBId);
    }

    // =========================================================================
    // SCENARIOS 1, 2, 3, 4: CREATE, UPDATE, EXACT DIFF, AND NO-OP SUPPRESSION
    // =========================================================================

    [Fact]
    public async Task T03A_01_02_03_04_RoomTypeRate_Create_Update_ExactDiff_And_NoOpSuppression()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantId, propertyAId, _, roomTypeAId, _) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var actorUserId = Guid.NewGuid();

            var tenantSvc = new StubTenantService { TenantId = tenantId };
            var propSvc = new StubPropertyService { PropertyId = propertyAId, IsTenantWide = false };
            var userCtx = new StubUserContext { UserId = actorUserId, TenantId = tenantId, PropertyId = propertyAId };
            userCtx.SetIpAddress("118.69.12.34");

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);

            // 1. Create RoomTypeRate -> Generates AuditLog Create
            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyAId,
                RoomTypeId = roomTypeAId,
                FirstHours = 2,
                FirstHoursPrice = 300_000m,
                AdditionalHourPrice = 80_000m,
                NightlyPrice = 850_000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 11, 1),
                EffectiveTo = new DateOnly(2026, 12, 1),
                CreatedByUserId = actorUserId,
                ChangeReason = "Bảng giá tiêu chuẩn tháng 11",
                IsActive = true
            };

            ctx.RoomTypeRates.Add(rate);
            await ctx.SaveChangesAsync();

            var createLogs = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityName == nameof(RoomTypeRate) && a.EntityId == rate.Id)
                .ToListAsync();

            Assert.Single(createLogs);
            var createLog = createLogs[0];
            Assert.Equal(AuditActions.Create, createLog.Action);
            Assert.Equal(tenantId, createLog.TenantId);
            Assert.Equal(propertyAId, createLog.PropertyId);
            Assert.Equal(actorUserId, createLog.UserId);
            Assert.Equal("118.69.12.34", createLog.IpAddress);
            Assert.Null(createLog.OldValues);
            Assert.NotNull(createLog.NewValues);

            using (var doc = JsonDocument.Parse(createLog.NewValues!))
            {
                Assert.Equal(roomTypeAId, doc.RootElement.GetProperty(nameof(RoomTypeRate.RoomTypeId)).GetGuid());
                Assert.Equal(2, doc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHours)).GetInt32());
                Assert.Equal(300_000m, doc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHoursPrice)).GetDecimal());
                Assert.Equal(80_000m, doc.RootElement.GetProperty(nameof(RoomTypeRate.AdditionalHourPrice)).GetDecimal());
                Assert.Equal(850_000m, doc.RootElement.GetProperty(nameof(RoomTypeRate.NightlyPrice)).GetDecimal());
                Assert.Equal("VND", doc.RootElement.GetProperty(nameof(RoomTypeRate.Currency)).GetString());
                Assert.Equal("2026-11-01", doc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveFrom)).GetString());
                Assert.Equal("2026-12-01", doc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
                Assert.Equal("Bảng giá tiêu chuẩn tháng 11", doc.RootElement.GetProperty(nameof(RoomTypeRate.ChangeReason)).GetString());
                Assert.True(doc.RootElement.GetProperty(nameof(RoomTypeRate.IsActive)).GetBoolean());
            }

            // 2 & 3. Update RoomTypeRate (850.000 -> 950.000) -> Generates AuditLog Update with ONLY modified fields
            rate.NightlyPrice = 950_000m;
            rate.ChangeReason = "Điều chỉnh giá cuối tuần";
            await ctx.SaveChangesAsync();

            var allLogsAfterUpdate = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityName == nameof(RoomTypeRate) && a.EntityId == rate.Id)
                .OrderBy(a => a.CreatedAtUtc)
                .ToListAsync();

            Assert.Equal(2, allLogsAfterUpdate.Count);
            var updateLog = allLogsAfterUpdate.Single(a => a.Action == AuditActions.Update);
            Assert.NotNull(updateLog.OldValues);
            Assert.NotNull(updateLog.NewValues);

            using (var oldDoc = JsonDocument.Parse(updateLog.OldValues!))
            using (var newDoc = JsonDocument.Parse(updateLog.NewValues!))
            {
                // Verify exact before & after values
                Assert.Equal(850_000m, oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.NightlyPrice)).GetDecimal());
                Assert.Equal(950_000m, newDoc.RootElement.GetProperty(nameof(RoomTypeRate.NightlyPrice)).GetDecimal());
                Assert.Equal("Bảng giá tiêu chuẩn tháng 11", oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.ChangeReason)).GetString());
                Assert.Equal("Điều chỉnh giá cuối tuần", newDoc.RootElement.GetProperty(nameof(RoomTypeRate.ChangeReason)).GetString());

                // Unchanged properties (e.g., FirstHoursPrice, Currency) must NOT be logged in Update diff
                Assert.False(oldDoc.RootElement.TryGetProperty(nameof(RoomTypeRate.FirstHoursPrice), out _));
                Assert.False(newDoc.RootElement.TryGetProperty(nameof(RoomTypeRate.FirstHoursPrice), out _));
                Assert.False(oldDoc.RootElement.TryGetProperty(nameof(RoomTypeRate.Currency), out _));
            }

            // 3b. Update hourly prices (FirstHours, FirstHoursPrice, AdditionalHourPrice) & effective dates (EffectiveFrom, EffectiveTo)
            rate.FirstHours = 3;
            rate.FirstHoursPrice = 380_000m;
            rate.AdditionalHourPrice = 100_000m;
            rate.EffectiveFrom = new DateOnly(2026, 11, 2);
            rate.EffectiveTo = new DateOnly(2026, 12, 5);
            await ctx.SaveChangesAsync();

            var logsAfterHourlyAndDateUpdate = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityName == nameof(RoomTypeRate) && a.EntityId == rate.Id && a.Action == AuditActions.Update)
                .OrderBy(a => a.CreatedAtUtc)
                .ToListAsync();

            Assert.Equal(2, logsAfterHourlyAndDateUpdate.Count);
            var hourlyDateUpdateLog = logsAfterHourlyAndDateUpdate[1];
            using (var oldDoc = JsonDocument.Parse(hourlyDateUpdateLog.OldValues!))
            using (var newDoc = JsonDocument.Parse(hourlyDateUpdateLog.NewValues!))
            {
                Assert.Equal(2, oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHours)).GetInt32());
                Assert.Equal(3, newDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHours)).GetInt32());
                Assert.Equal(300_000m, oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHoursPrice)).GetDecimal());
                Assert.Equal(380_000m, newDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHoursPrice)).GetDecimal());
                Assert.Equal(80_000m, oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.AdditionalHourPrice)).GetDecimal());
                Assert.Equal(100_000m, newDoc.RootElement.GetProperty(nameof(RoomTypeRate.AdditionalHourPrice)).GetDecimal());
                Assert.Equal("2026-11-01", oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveFrom)).GetString());
                Assert.Equal("2026-11-02", newDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveFrom)).GetString());
                Assert.Equal("2026-12-01", oldDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
                Assert.Equal("2026-12-05", newDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
                Assert.False(oldDoc.RootElement.TryGetProperty(nameof(RoomTypeRate.NightlyPrice), out _));
            }

            // 4. No-op Update (marking Modified or setting identical decimal scale 950000.00m) -> Does NOT create extra AuditLog
            ctx.Entry(rate).Property(r => r.NightlyPrice).CurrentValue = 950_000.00m;
            ctx.Entry(rate).Property(r => r.NightlyPrice).IsModified = true;
            ctx.Entry(rate).State = EntityState.Modified;
            await ctx.SaveChangesAsync();

            var countAfterNoOp = await ctx.AuditLogs
                .CountAsync(a => a.EntityName == nameof(RoomTypeRate) && a.EntityId == rate.Id);

            Assert.Equal(3, countAfterNoOp);

            // 5. Delete RoomTypeRate -> Generates AuditLog Delete with OldValues and NewValues = null
            ctx.RoomTypeRates.Remove(rate);
            await ctx.SaveChangesAsync();

            var deleteRateLog = await ctx.AuditLogs
                .AsNoTracking()
                .SingleAsync(a => a.EntityName == nameof(RoomTypeRate) && a.EntityId == rate.Id && a.Action == AuditActions.Delete);

            Assert.Null(deleteRateLog.NewValues);
            Assert.NotNull(deleteRateLog.OldValues);
            using (var delOldDoc = JsonDocument.Parse(deleteRateLog.OldValues!))
            {
                Assert.Equal(950_000m, delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.NightlyPrice)).GetDecimal());
                Assert.Equal(3, delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHours)).GetInt32());
                Assert.Equal(380_000m, delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHoursPrice)).GetDecimal());
                Assert.Equal(100_000m, delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.AdditionalHourPrice)).GetDecimal());
                Assert.Equal("2026-11-02", delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveFrom)).GetString());
                Assert.Equal("2026-12-05", delOldDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
            }
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 5 & 9: INVOICE DELETE AUDIT, PROPERTY SCOPE RESOLUTION & REDACTION
    // =========================================================================

    [Fact]
    public async Task T03A_05_09_Invoice_Delete_ResolvesReservationPropertyScope_And_ExcludesSensitiveFields()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantId, propertyAId, propertyBId, roomTypeAId, _) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var actorUserId = Guid.NewGuid();

            var tenantSvc = new StubTenantService { TenantId = tenantId };
            // Owner is tenant-wide, currently viewing Property B (or tenant-wide), while Reservation belongs to Property A
            var propSvc = new StubPropertyService { PropertyId = propertyBId, IsTenantWide = true };
            var userCtx = new StubUserContext { UserId = actorUserId, TenantId = tenantId, PropertyId = propertyBId, IsTenantWide = true };

            // Spoofed/malformed IP string must be rejected safely (never trusted if invalid)
            userCtx.SetIpAddress("spoofed-header-injection; DROP TABLE AuditLogs;");
            Assert.Null(userCtx.IpAddress);

            var roomId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var invoiceId = Guid.NewGuid();

            await using (var seedCtx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx))
            {
                seedCtx.Rooms.Add(new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propertyAId,
                    RoomTypeId = roomTypeAId,
                    RoomNumber = "101",
                    Floor = 1,
                    Status = RoomStatus.Clean
                });

                seedCtx.Reservations.Add(new Reservation
                {
                    Id = reservationId,
                    TenantId = tenantId,
                    PropertyId = propertyAId,
                    RoomId = roomId,
                    ConfirmationCode = "RES-AUDIT-01",
                    GuestName = "Nguyễn Văn A",
                    GuestEmail = "nguyenvana@example.com",
                    GuestPhone = "0901234567",
                    CheckInDate = new DateOnly(2026, 11, 5),
                    CheckOutDate = new DateOnly(2026, 11, 7),
                    NumberOfGuests = 2,
                    TotalAmount = 1_900_000m,
                    Status = ReservationStatus.Confirmed,
                    SmartLockPin = "998877"
                });

                await seedCtx.SaveChangesAsync();
            }

            // Create Invoice in a fresh DbContext where Reservation is NOT loaded in ChangeTracker (invoice.Reservation == null)
            await using (var createInvCtx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx))
            {
                var invoice = new Invoice
                {
                    Id = invoiceId,
                    TenantId = tenantId,
                    ReservationId = reservationId,
                    InvoiceNumber = "INV-20261029-001",
                    IssuedAtUtc = DateTime.UtcNow,
                    GuestName = "Nguyễn Văn A",
                    GuestIdNumber = "079099001234", // Sensitive CCCD/Passport - MUST NOT be logged!
                    GuestPhone = "0901234567",
                    GuestEmail = "nguyenvana@example.com",
                    PropertyName = "LuxeStay Quận 1",
                    PropertyAddress = "100 Nguyễn Huệ, Quận 1",
                    Subtotal = 1_750_000m,
                    TaxRate = 0.08m,
                    TaxAmount = 150_000m,
                    GrandTotal = 1_900_000m,
                    PaidAmount = 1_900_000m,
                    Balance = 0m,
                    Status = InvoiceStatus.Issued,
                    Notes = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
                };

                Assert.Null(invoice.Reservation);
                createInvCtx.Invoices.Add(invoice);
                await createInvCtx.SaveChangesAsync();
            }

            // Branch-scoped staff on Property B (IsTenantWide = false) attempting to delete Property A's Invoice MUST be blocked fail-closed
            var branchBStaffPropSvc = new StubPropertyService { PropertyId = propertyBId, IsTenantWide = false };
            await using (var unauthorizedCtx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, branchBStaffPropSvc, userCtx))
            {
                var invToAttemptDelete = await unauthorizedCtx.Invoices.SingleAsync(i => i.Id == invoiceId);
                unauthorizedCtx.Invoices.Remove(invToAttemptDelete);
                var crossBranchEx = await Assert.ThrowsAsync<ForbiddenException>(() => unauthorizedCtx.SaveChangesAsync());
                Assert.Equal("ERR_CROSS_PROPERTY_MUTATION", crossBranchEx.ErrorCode);
            }

            // Owner (IsTenantWide = true, ambient PropertyId = null) deletes Invoice in a fresh DbContext without .Include(i => i.Reservation)
            var tenantWidePropSvc = new StubPropertyService { PropertyId = null, IsTenantWide = true };
            await using (var deleteCtx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, tenantWidePropSvc, userCtx))
            {
                var persistedInvoice = await deleteCtx.Invoices.SingleAsync(i => i.Id == invoiceId);
                Assert.Null(persistedInvoice.Reservation);

                deleteCtx.Invoices.Remove(persistedInvoice);
                await deleteCtx.SaveChangesAsync();

                var invoiceLogs = await deleteCtx.AuditLogs
                    .AsNoTracking()
                    .Where(a => a.EntityName == nameof(Invoice) && a.EntityId == invoiceId)
                    .ToListAsync();

                Assert.Equal(2, invoiceLogs.Count);
                var createInvLog = invoiceLogs.Single(a => a.Action == AuditActions.Create);
                var deleteLog = invoiceLogs.Single(a => a.Action == AuditActions.Delete);

                // Both Create and Delete AuditLogs MUST resolve PropertyId = propertyAId from the linked Reservation (NOT propertyBId and NOT null)
                Assert.Equal(propertyAId, createInvLog.PropertyId);
                Assert.Equal(propertyAId, deleteLog.PropertyId);
                Assert.Equal(tenantId, deleteLog.TenantId);
                Assert.Equal(actorUserId, deleteLog.UserId);
                Assert.Null(deleteLog.NewValues);
                Assert.NotNull(deleteLog.OldValues);

                // Verify OldValues captured pre-deletion invoice state
                using var oldDoc = JsonDocument.Parse(deleteLog.OldValues!);
                Assert.Equal("INV-20261029-001", oldDoc.RootElement.GetProperty(nameof(Invoice.InvoiceNumber)).GetString());
                Assert.Equal(1_900_000m, oldDoc.RootElement.GetProperty(nameof(Invoice.GrandTotal)).GetDecimal());

                // Scenario 9: Sensitive CCCD/Passport (GuestIdNumber) and embedded JWT Bearer token MUST NOT appear in raw logs
                Assert.False(oldDoc.RootElement.TryGetProperty(nameof(Invoice.GuestIdNumber), out _));
                Assert.DoesNotContain("079099001234", deleteLog.OldValues!);
                Assert.DoesNotContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", deleteLog.OldValues!);
                Assert.Contains("[REDACTED]", oldDoc.RootElement.GetProperty(nameof(Invoice.Notes)).GetString()!);
            }
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 6, 11, 13: FAILED SAVE, RETRY DEDUPLICATION, AND TX ROLLBACK
    // =========================================================================

    [Fact]
    public async Task T03A_06_11_13_FailedSave_RetryDeduplication_And_TransactionRollback_PreserveAtomicity()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantId, propertyAId, _, roomTypeAId, _) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var tenantSvc = new StubTenantService { TenantId = tenantId };
            var propSvc = new StubPropertyService { PropertyId = propertyAId, IsTenantWide = false };
            var userCtx = new StubUserContext { TenantId = tenantId, PropertyId = propertyAId };

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);

            // Scenario 6 & 11: Business save fails due to FK violation (non-existent RoomTypeId), then succeeds on retry
            var nonExistentRoomTypeId = Guid.NewGuid();
            var rate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyAId,
                RoomTypeId = nonExistentRoomTypeId, // Invalid FK -> causes DbUpdateException
                FirstHours = 2,
                FirstHoursPrice = 250_000m,
                AdditionalHourPrice = 70_000m,
                NightlyPrice = 750_000m,
                Currency = "VND",
                EffectiveFrom = new DateOnly(2026, 12, 1),
                EffectiveTo = new DateOnly(2026, 12, 15),
                CreatedByUserId = userCtx.UserId,
                IsActive = true
            };

            ctx.RoomTypeRates.Add(rate);

            await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());

            // Verify Scenario 6: Failed save MUST NOT commit any AuditLog to database
            var logsAfterFailedSave = await ctx.AuditLogs
                .AsNoTracking()
                .CountAsync(a => a.EntityId == rate.Id);
            Assert.Equal(0, logsAfterFailedSave);

            // Scenario 11: Fix RoomTypeId and retry SaveChangesAsync on the SAME DbContext -> Must produce exactly 1 AuditLog (no duplicate)
            rate.RoomTypeId = roomTypeAId;
            await ctx.SaveChangesAsync();

            var logsAfterRetry = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityId == rate.Id)
                .ToListAsync();
            Assert.Single(logsAfterRetry);

            // Scenario 13: Explicit transaction rollback must roll back both business mutation and AuditLog atomically
            await using (var tx = await ctx.BeginTransactionAsync())
            {
                rate.NightlyPrice = 1_200_000m;
                await ctx.SaveChangesAsync();

                // Inside uncommitted transaction, 2 logs exist
                var inTxCount = await ctx.AuditLogs.CountAsync(a => a.EntityId == rate.Id);
                Assert.Equal(2, inTxCount);

                await tx.RollbackAsync();
            }

            await using var verifyCtx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);
            var persistedRate = await verifyCtx.RoomTypeRates.AsNoTracking().SingleAsync(r => r.Id == rate.Id);
            Assert.Equal(750_000m, persistedRate.NightlyPrice);

            var logsAfterRollback = await verifyCtx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityId == rate.Id)
                .ToListAsync();
            Assert.Single(logsAfterRollback);
            Assert.Equal(AuditActions.Create, logsAfterRollback[0].Action);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 7 & 8: MULTI-TENANT & MULTI-PROPERTY ISOLATION
    // =========================================================================

    [Fact]
    public async Task T03A_07_08_CrossTenant_Blocked_And_MultiPropertyOwner_LogsExactEntityBranch()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantAId, propertyAId, propertyBId, _, roomTypeBId) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var tenantBId = Guid.NewGuid();

            var tenantSvc = new StubTenantService { TenantId = tenantAId };
            // Owner is tenant-wide, currently viewing Property A, but modifies a rate belonging to Property B
            var propSvc = new StubPropertyService { PropertyId = propertyAId, IsTenantWide = true };
            var userCtx = new StubUserContext { TenantId = tenantAId, PropertyId = propertyAId, IsTenantWide = true };

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);

            // Scenario 7: Tenant A attempting to insert a RoomTypeRate stamped with Tenant B's ID -> Blocked with ForbiddenException
            var crossTenantRate = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantBId,
                PropertyId = propertyAId,
                RoomTypeId = roomTypeBId,
                FirstHours = 2,
                FirstHoursPrice = 200_000m,
                AdditionalHourPrice = 50_000m,
                NightlyPrice = 600_000m,
                EffectiveFrom = new DateOnly(2026, 11, 10),
                EffectiveTo = new DateOnly(2026, 11, 20),
                CreatedByUserId = userCtx.UserId
            };

            ctx.RoomTypeRates.Add(crossTenantRate);
            var crossEx = await Assert.ThrowsAsync<ForbiddenException>(() => ctx.SaveChangesAsync());
            Assert.Equal("ERR_CROSS_TENANT_MUTATION", crossEx.ErrorCode);
            ctx.Entry(crossTenantRate).State = EntityState.Detached;

            Assert.Equal(0, await ctx.AuditLogs.IgnoreQueryFilters().CountAsync(a => a.TenantId == tenantBId));

            // Scenario 8: Owner (IsTenantWide = true) creates a rate for Property B -> AuditLog.PropertyId MUST be Property B (not Property A!)
            var rateBranchB = new RoomTypeRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantAId,
                PropertyId = propertyBId,
                RoomTypeId = roomTypeBId,
                FirstHours = 2,
                FirstHoursPrice = 350_000m,
                AdditionalHourPrice = 90_000m,
                NightlyPrice = 990_000m,
                EffectiveFrom = new DateOnly(2026, 11, 10),
                EffectiveTo = new DateOnly(2026, 11, 25),
                CreatedByUserId = userCtx.UserId
            };

            ctx.RoomTypeRates.Add(rateBranchB);
            await ctx.SaveChangesAsync();

            var branchBLog = await ctx.AuditLogs
                .AsNoTracking()
                .SingleAsync(a => a.EntityId == rateBranchB.Id);

            Assert.Equal(tenantAId, branchBLog.TenantId);
            Assert.Equal(propertyBId, branchBLog.PropertyId);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIOS 10 & 12: NO SELF-AUDIT RECURSION, IMMUTABILITY, AND ROOMTYPERATEAUDIT COEXISTENCE
    // =========================================================================

    [Fact]
    public async Task T03A_10_12_AuditLog_Immutability_NoRecursion_And_CoexistsWith_RoomTypeRateAudit()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantId, propertyAId, _, roomTypeAId, _) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var tenantSvc = new StubTenantService { TenantId = tenantId };
            var propSvc = new StubPropertyService { PropertyId = propertyAId, IsTenantWide = true };
            var userCtx = new StubUserContext { TenantId = tenantId, PropertyId = propertyAId };
            var membershipSvc = new StubMembershipLookupService();

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);

            var handler = new CreateRoomTypeRateCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipSvc);

            // Step 1: Create initial rate via CreateRoomTypeRateCommandHandler [today+5 .. today+25]
            var start1 = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
            var end1 = start1.AddDays(20);
            var createdRateDto = await handler.Handle(new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeAId,
                PropertyId: propertyAId,
                FirstHours: 2,
                FirstHoursPrice: 300_000m,
                AdditionalHourPrice: 80_000m,
                NightlyPrice: 850_000m,
                EffectiveFrom: start1,
                EffectiveTo: end1,
                Currency: "VND",
                ChangeReason: "Giá khởi tạo"), CancellationToken.None);

            // Step 2: Interval-split via CreateRoomTypeRateCommandHandler [start1+10 .. end1+5] at 950.000 VND
            var splitStart = start1.AddDays(10);
            var splitEnd = end1.AddDays(5);
            var splitRateDto = await handler.Handle(new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeAId,
                PropertyId: propertyAId,
                FirstHours: 2,
                FirstHoursPrice: 320_000m,
                AdditionalHourPrice: 90_000m,
                NightlyPrice: 950_000m,
                EffectiveFrom: splitStart,
                EffectiveTo: splitEnd,
                Currency: "VND",
                ChangeReason: "Tăng giá cao điểm"), CancellationToken.None);

            // Step 3: Exact Head-Match Replacement via CreateRoomTypeRateCommandHandler [splitStart .. splitEnd] at 1.050.000 VND
            var replacedRateDto = await handler.Handle(new CreateRoomTypeRateCommand(
                RoomTypeId: roomTypeAId,
                PropertyId: propertyAId,
                FirstHours: 3,
                FirstHoursPrice: 360_000m,
                AdditionalHourPrice: 95_000m,
                NightlyPrice: 1_050_000m,
                EffectiveFrom: splitStart,
                EffectiveTo: splitEnd,
                Currency: "VND",
                ChangeReason: "Thay thế bảng giá cao điểm"), CancellationToken.None);

            // Verify Scenario 12: Specialized RoomTypeRateAudits still has all 5 records (Created, Split_Shortened, Split_Created, Replaced, Replaced_Created)
            var rateAudits = await ctx.RoomTypeRateAudits
                .AsNoTracking()
                .Where(a => a.RoomTypeId == roomTypeAId)
                .OrderBy(a => a.ChangedAtUtc)
                .ToListAsync();

            Assert.Equal(5, rateAudits.Count);
            Assert.Contains(rateAudits, a => a.ActionType == "Created");
            Assert.Contains(rateAudits, a => a.ActionType == "Split_Shortened");
            Assert.Contains(rateAudits, a => a.ActionType == "Split_Created");
            Assert.Contains(rateAudits, a => a.ActionType == "Replaced");
            Assert.Contains(rateAudits, a => a.ActionType == "Replaced_Created");

            // Verify Scenario 10 & 12: General AuditLogs has:
            // - 1 Create for initial rate
            // - 1 Update for shortened initial rate (EffectiveTo shortened)
            // - 1 Create for split rate
            // - 1 Update for deactivated split rate (IsActive: true -> false)
            // - 1 Create for replacement rate
            // And 0 logs for AuditLog or RoomTypeRateAudit!
            var generalAuditLogs = await ctx.AuditLogs
                .AsNoTracking()
                .ToListAsync();

            Assert.Equal(5, generalAuditLogs.Count);
            Assert.All(generalAuditLogs, l => Assert.Equal(nameof(RoomTypeRate), l.EntityName));
            Assert.Single(generalAuditLogs, l => l.EntityId == createdRateDto.Id && l.Action == AuditActions.Create);

            var shortenedUpdateLog = Assert.Single(generalAuditLogs, l => l.EntityId == createdRateDto.Id && l.Action == AuditActions.Update);
            using (var oldShortDoc = JsonDocument.Parse(shortenedUpdateLog.OldValues!))
            using (var newShortDoc = JsonDocument.Parse(shortenedUpdateLog.NewValues!))
            {
                Assert.Equal(end1.ToString("yyyy-MM-dd"), oldShortDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
                Assert.Equal(splitStart.ToString("yyyy-MM-dd"), newShortDoc.RootElement.GetProperty(nameof(RoomTypeRate.EffectiveTo)).GetString());
            }

            Assert.Single(generalAuditLogs, l => l.EntityId == splitRateDto.Id && l.Action == AuditActions.Create);

            var replacedUpdateLog = Assert.Single(generalAuditLogs, l => l.EntityId == splitRateDto.Id && l.Action == AuditActions.Update);
            using (var oldRepDoc = JsonDocument.Parse(replacedUpdateLog.OldValues!))
            using (var newRepDoc = JsonDocument.Parse(replacedUpdateLog.NewValues!))
            {
                Assert.True(oldRepDoc.RootElement.GetProperty(nameof(RoomTypeRate.IsActive)).GetBoolean());
                Assert.False(newRepDoc.RootElement.GetProperty(nameof(RoomTypeRate.IsActive)).GetBoolean());
            }

            var replacedCreateLog = Assert.Single(generalAuditLogs, l => l.EntityId == replacedRateDto.Id && l.Action == AuditActions.Create);
            using (var repNewDoc = JsonDocument.Parse(replacedCreateLog.NewValues!))
            {
                Assert.Equal(1_050_000m, repNewDoc.RootElement.GetProperty(nameof(RoomTypeRate.NightlyPrice)).GetDecimal());
                Assert.Equal(3, repNewDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHours)).GetInt32());
                Assert.Equal(360_000m, repNewDoc.RootElement.GetProperty(nameof(RoomTypeRate.FirstHoursPrice)).GetDecimal());
                Assert.Equal(95_000m, repNewDoc.RootElement.GetProperty(nameof(RoomTypeRate.AdditionalHourPrice)).GetDecimal());
                Assert.Equal("Thay thế bảng giá cao điểm", repNewDoc.RootElement.GetProperty(nameof(RoomTypeRate.ChangeReason)).GetString());
            }

            // Verify Scenario 10: Attempting to modify or delete an existing AuditLog is strictly forbidden
            var trackedAuditLog = await ctx.AuditLogs.FirstAsync();
            trackedAuditLog.Action = "Tampered";
            var modifyEx = await Assert.ThrowsAsync<ForbiddenException>(() => ctx.SaveChangesAsync());
            Assert.Equal("ERR_AUDIT_LOG_IMMUTABLE", modifyEx.ErrorCode);

            ctx.Entry(trackedAuditLog).State = EntityState.Unchanged;
            ctx.AuditLogs.Remove(trackedAuditLog);
            var deleteEx = await Assert.ThrowsAsync<ForbiddenException>(() => ctx.SaveChangesAsync());
            Assert.Equal("ERR_AUDIT_LOG_IMMUTABLE", deleteEx.ErrorCode);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // SCENARIO 14: REAL UPDATEPROPERTYPOLICIESCOMMANDHANDLER SURCHARGE AUDITING
    // =========================================================================

    [Fact]
    public async Task T03A_14_UpdatePropertyPoliciesCommandHandler_Audits_PropertySurchargePolicy_Create_Update_Deactivate()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var (tenantId, propertyAId, _, _, _) = await SeedBaselineHierarchyAsync(conn.ConnectionString, testSchema);
            var actorUserId = Guid.NewGuid();
            var tenantSvc = new StubTenantService { TenantId = tenantId };
            var propSvc = new StubPropertyService { PropertyId = propertyAId, IsTenantWide = true };
            var userCtx = new StubUserContext { UserId = actorUserId, TenantId = tenantId, PropertyId = propertyAId };
            userCtx.SetIpAddress("14.161.22.88");
            var membershipSvc = new StubMembershipLookupService();

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);
            var handler = new UpdatePropertyPoliciesCommandHandler(ctx, tenantSvc, propSvc, userCtx, membershipSvc);

            // Step 1: Create 2 surcharge policies (EarlyCheckIn Percentage & LateCheckOut FlatAmount) via real handler
            var createdResult = await handler.Handle(new UpdatePropertyPoliciesCommand(
                PropertyId: propertyAId,
                CheckInTime: new TimeOnly(14, 0),
                CheckOutTime: new TimeOnly(12, 0),
                BufferMinutes: 30,
                MaxHourlyHours: 6,
                Surcharges: new List<UpdateSurchargeItemCommand>
                {
                    new(
                        Id: null,
                        SurchargeType: SurchargeType.EarlyCheckIn,
                        FromTime: new TimeOnly(6, 0),
                        ToTime: new TimeOnly(9, 0),
                        CalculationMethod: SurchargeCalculationMethod.PercentageOfNightly,
                        Percentage: 30.00m,
                        FlatAmount: null,
                        IsActive: true),
                    new(
                        Id: null,
                        SurchargeType: SurchargeType.LateCheckOut,
                        FromTime: new TimeOnly(12, 0),
                        ToTime: new TimeOnly(15, 0),
                        CalculationMethod: SurchargeCalculationMethod.FlatAmount,
                        Percentage: null,
                        FlatAmount: 250_000m,
                        IsActive: true)
                }), CancellationToken.None);

            Assert.Equal(2, createdResult.Surcharges.Count);
            var earlyPolicyDto = createdResult.Surcharges.Single(s => s.SurchargeType == SurchargeType.EarlyCheckIn);
            var latePolicyDto = createdResult.Surcharges.Single(s => s.SurchargeType == SurchargeType.LateCheckOut);

            var createAuditLogs = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityName == nameof(PropertySurchargePolicy))
                .ToListAsync();

            Assert.Equal(2, createAuditLogs.Count);
            var earlyCreateLog = createAuditLogs.Single(a => a.EntityId == earlyPolicyDto.Id);
            Assert.Equal(AuditActions.Create, earlyCreateLog.Action);
            Assert.Equal(tenantId, earlyCreateLog.TenantId);
            Assert.Equal(propertyAId, earlyCreateLog.PropertyId);
            Assert.Equal(actorUserId, earlyCreateLog.UserId);
            Assert.Equal("14.161.22.88", earlyCreateLog.IpAddress);
            Assert.Null(earlyCreateLog.OldValues);

            using (var earlyDoc = JsonDocument.Parse(earlyCreateLog.NewValues!))
            {
                Assert.Equal(nameof(SurchargeType.EarlyCheckIn), earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.SurchargeType)).GetString());
                Assert.Equal("06:00:00", earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FromTime)).GetString());
                Assert.Equal("09:00:00", earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.ToTime)).GetString());
                Assert.Equal(nameof(SurchargeCalculationMethod.PercentageOfNightly), earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.CalculationMethod)).GetString());
                Assert.Equal(30.00m, earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.Percentage)).GetDecimal());
                Assert.Equal(JsonValueKind.Null, earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FlatAmount)).ValueKind);
                Assert.True(earlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.IsActive)).GetBoolean());
            }

            var lateCreateLog = createAuditLogs.Single(a => a.EntityId == latePolicyDto.Id);
            using (var lateDoc = JsonDocument.Parse(lateCreateLog.NewValues!))
            {
                Assert.Equal(nameof(SurchargeType.LateCheckOut), lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.SurchargeType)).GetString());
                Assert.Equal("12:00:00", lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FromTime)).GetString());
                Assert.Equal("15:00:00", lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.ToTime)).GetString());
                Assert.Equal(nameof(SurchargeCalculationMethod.FlatAmount), lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.CalculationMethod)).GetString());
                Assert.Equal(JsonValueKind.Null, lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.Percentage)).ValueKind);
                Assert.Equal(250_000m, lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FlatAmount)).GetDecimal());
                Assert.True(lateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.IsActive)).GetBoolean());
            }

            // Step 2: Update EarlyCheckIn (FromTime 06:00->05:00, ToTime 09:00->09:30, Percentage 30%->50%)
            // and omit LateCheckOut so UpdatePropertyPoliciesCommandHandler deactivates it (IsActive: true -> false)
            await handler.Handle(new UpdatePropertyPoliciesCommand(
                PropertyId: propertyAId,
                CheckInTime: null,
                CheckOutTime: null,
                BufferMinutes: null,
                MaxHourlyHours: null,
                Surcharges: new List<UpdateSurchargeItemCommand>
                {
                    new(
                        Id: earlyPolicyDto.Id,
                        SurchargeType: SurchargeType.EarlyCheckIn,
                        FromTime: new TimeOnly(5, 0),
                        ToTime: new TimeOnly(9, 30),
                        CalculationMethod: SurchargeCalculationMethod.PercentageOfNightly,
                        Percentage: 50.00m,
                        FlatAmount: null,
                        IsActive: true)
                }), CancellationToken.None);

            var updateAuditLogs = await ctx.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityName == nameof(PropertySurchargePolicy) && a.Action == AuditActions.Update)
                .ToListAsync();

            Assert.Equal(2, updateAuditLogs.Count);

            var earlyUpdateLog = updateAuditLogs.Single(a => a.EntityId == earlyPolicyDto.Id);
            using (var oldEarlyDoc = JsonDocument.Parse(earlyUpdateLog.OldValues!))
            using (var newEarlyDoc = JsonDocument.Parse(earlyUpdateLog.NewValues!))
            {
                Assert.Equal("06:00:00", oldEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FromTime)).GetString());
                Assert.Equal("05:00:00", newEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.FromTime)).GetString());
                Assert.Equal("09:00:00", oldEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.ToTime)).GetString());
                Assert.Equal("09:30:00", newEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.ToTime)).GetString());
                Assert.Equal(30.00m, oldEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.Percentage)).GetDecimal());
                Assert.Equal(50.00m, newEarlyDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.Percentage)).GetDecimal());
                Assert.False(oldEarlyDoc.RootElement.TryGetProperty(nameof(PropertySurchargePolicy.SurchargeType), out _));
            }

            var lateDeactivateLog = updateAuditLogs.Single(a => a.EntityId == latePolicyDto.Id);
            using (var oldLateDoc = JsonDocument.Parse(lateDeactivateLog.OldValues!))
            using (var newLateDoc = JsonDocument.Parse(lateDeactivateLog.NewValues!))
            {
                Assert.True(oldLateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.IsActive)).GetBoolean());
                Assert.False(newLateDoc.RootElement.GetProperty(nameof(PropertySurchargePolicy.IsActive)).GetBoolean());
            }
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }

    // =========================================================================
    // MIGRATION UP & DOWN ROLLBACK VERIFICATION
    // =========================================================================

    [Fact]
    public async Task T03A_Migration_Up_And_Down_Rollback_Cleanly_On_PostgreSQL()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);

        try
        {
            var tenantSvc = new StubTenantService { TenantId = Guid.NewGuid() };
            var propSvc = new StubPropertyService();
            var userCtx = new StubUserContext();

            await using var ctx = CreateAuditedDbContext(conn.ConnectionString, testSchema, tenantSvc, propSvc, userCtx);
            var migrator = ctx.Database.GetService<IMigrator>();

            // Apply all migrations including 20261029030000_P7_AuditLogs
            await migrator.MigrateAsync("20261029030000_P7_AuditLogs");

            // Roll back to previous migration 20261017144540_P6_SocialAuth_And_SmartLock
            await migrator.MigrateAsync("20261017144540_P6_SocialAuth_And_SmartLock");

            // Re-apply 20261029030000_P7_AuditLogs
            await migrator.MigrateAsync("20261029030000_P7_AuditLogs");

            var applied = await ctx.Database.GetAppliedMigrationsAsync();
            Assert.Contains("20261029030000_P7_AuditLogs", applied);
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }
}


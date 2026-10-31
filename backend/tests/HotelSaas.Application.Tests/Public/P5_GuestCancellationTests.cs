using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Public.Commands.CancelGuestBooking;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetGuestCancellationPreview;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

[Collection("SequentialTestCollection")]
public sealed class P5_GuestCancellationTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn)) return envConn;

        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
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
                $"Target database '{builder.Database}' is NOT an authorized test database! Target database name must contain '_test'.");
        }
    }

    private sealed class MockTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class MockUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.Empty;
        public string Email { get; set; } = string.Empty;
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public HotelSaas.Domain.Enums.TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public HotelSaas.Domain.Enums.PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public HotelSaas.Domain.Enums.StaffRole? StaffRole { get; set; } = HotelSaas.Domain.Enums.StaffRole.Receptionist;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public string? IpAddress => "127.0.0.1";
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
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
            HotelSaas.Domain.Enums.TenantStatus tenantStatus,
            Guid? propertyId,
            HotelSaas.Domain.Enums.PropertyStatus? propertyStatus,
            HotelSaas.Domain.Enums.StaffRole? staffRole,
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

    private static ApplicationDbContext CreateDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propertyService = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var propSvc = propertyService ?? new MockPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propSvc);
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

    private sealed class TestFixture : IAsyncDisposable
    {
        public string ConnectionString { get; }
        public string TestSchema { get; }
        public NpgsqlConnection Connection { get; }
        public Guid TenantId { get; }
        public Guid PropertyId { get; }
        public string PropertySlug { get; }
        public Guid RoomTypeId { get; }
        public Guid RoomId { get; }

        private TestFixture(
            string connectionString,
            string testSchema,
            NpgsqlConnection connection,
            Guid tenantId,
            Guid propertyId,
            string propertySlug,
            Guid roomTypeId,
            Guid roomId)
        {
            ConnectionString = connectionString;
            TestSchema = testSchema;
            Connection = connection;
            TenantId = tenantId;
            PropertyId = propertyId;
            PropertySlug = propertySlug;
            RoomTypeId = roomTypeId;
            RoomId = roomId;
        }

        public static async Task<TestFixture> CreateAsync(P5_GuestCancellationTests suite)
        {
            var connStr = GetConnectionString();
            ValidateTestDatabaseTarget(connStr);

            var testSchema = $"p5_cancel_test_{Guid.NewGuid():N}";
            var conn = await suite.CreateTestConnectionAsync(testSchema);

            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var propertySlug = $"chi-nhanh-cancel-{Guid.NewGuid():N}"[..20];
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propertyId };

            await using (var ctx = P5_GuestCancellationTests.CreateDbContext(connStr, testSchema, tenantService, propertyService))
            {
                await ctx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Khách Sạn Biển Xanh",
                    Code = "KSBX",
                    Slug = "ksbx",
                    Address = "100 Vo Nguyen Giap",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };

                var property = new Property
                {
                    Id = propertyId,
                    TenantId = tenantId,
                    Name = "Khách Sạn Biển Xanh - Chi Nhánh 1",
                    Code = "BX01",
                    Slug = propertySlug,
                    Address = "100 Vo Nguyen Giap",
                    City = "Da Nang",
                    CheckInTime = new TimeOnly(14, 0),
                    CheckOutTime = new TimeOnly(12, 0),
                    BufferMinutes = 30,
                    MaxHourlyHours = 12,
                    Status = PropertyStatus.Active
                };

                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    Name = "Deluxe Ocean Suite",
                    Code = "DOS",
                    BasePrice = 1_000_000m,
                    MaxOccupancy = 2
                };

                var room = new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "301",
                    Floor = 3,
                    Status = RoomStatus.Dirty,
                    IsActive = true
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(property);
                ctx.RoomTypes.Add(roomType);
                ctx.Rooms.Add(room);

                await ctx.SaveChangesAsync();
            }

            return new TestFixture(connStr, testSchema, conn, tenantId, propertyId, propertySlug, roomTypeId, roomId);
        }

        public ApplicationDbContext CreateDbContext(ICurrentTenantService? tSvc = null, ICurrentPropertyService? pSvc = null)
        {
            var tenantService = tSvc ?? new MockTenantService { TenantId = TenantId };
            var propertyService = pSvc ?? new MockPropertyService { PropertyId = PropertyId };
            return P5_GuestCancellationTests.CreateDbContext(ConnectionString, TestSchema, tenantService, propertyService);
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                await using var cmd = Connection.CreateCommand();
                cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{TestSchema}\" CASCADE;";
                await cmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // Ignore cleanup errors
            }
            finally
            {
                await Connection.CloseAsync();
                await Connection.DisposeAsync();
            }
        }
    }

    [Fact]
    public async Task Preview_Hourly_FreeCancellation_WhenMoreThan2HoursBeforeStart()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_hourly_free_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddHours(5); // 5 hours > 2 hours threshold
        var endUtc = startUtc.AddHours(3);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Hourly,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 500000m,
            DepositRequired = 150000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId,
            RoomTypeName = "Deluxe Ocean Suite"
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Trần Trọng Tân",
            GuestEmail = "tan@hotelsaas.local",
            GuestPhone = "0912345678",
            TotalAmount = 500000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-PREVIEW-01",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Add 500,000 completed payment
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            Amount = 500000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.BankTransfer,
            PaidAtUtc = nowUtc
        });
        await ctx.SaveChangesAsync();

        var handler = new GetGuestCancellationPreviewQueryHandler(ctx);
        var preview = await handler.Handle(new GetGuestCancellationPreviewQuery(token), CancellationToken.None);

        Assert.NotNull(preview);
        Assert.Equal(resId, preview.ReservationId);
        Assert.True(preview.IsFreeCancellation);
        Assert.Equal(0m, preview.CancellationFee);
        Assert.Equal(500000m, preview.RefundableAmount);
        Assert.Equal(500000m, preview.PaidAmount);
        Assert.Equal(2, preview.FreeCancellationThresholdHours);
        Assert.True(preview.CanCancel);
    }

    [Fact]
    public async Task Preview_Hourly_LateCancellation_WhenLessThan2HoursBeforeStart()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_hourly_late_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddMinutes(90); // 1.5 hours < 2 hours threshold
        var endUtc = startUtc.AddHours(2);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Hourly,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 400000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Nguyễn Văn A",
            GuestEmail = "vana@hotelsaas.local",
            TotalAmount = 400000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-PREVIEW-02",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Paid 400,000 VND
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            Amount = 400000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.BankTransfer,
            PaidAtUtc = nowUtc
        });
        await ctx.SaveChangesAsync();

        var handler = new GetGuestCancellationPreviewQueryHandler(ctx);
        var preview = await handler.Handle(new GetGuestCancellationPreviewQuery(token), CancellationToken.None);

        Assert.False(preview.IsFreeCancellation);
        Assert.Equal(120000m, preview.CancellationFee); // 30% of 400,000 = 120,000
        Assert.Equal(280000m, preview.RefundableAmount); // 400,000 - 120,000 = 280,000
        Assert.True(preview.CanCancel);
    }

    [Fact]
    public async Task Preview_Overnight_FreeCancellation_WhenMoreThan24HoursBeforeStart()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_overnight_free_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddDays(3); // 72 hours > 24 hours threshold
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 1000000m,
            DepositRequired = 300000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Lê Thị B",
            GuestEmail = "lethib@hotelsaas.local",
            TotalAmount = 1000000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-PREVIEW-03",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Paid deposit 300,000 VND
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            Amount = 300000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.BankTransfer,
            PaidAtUtc = nowUtc
        });
        await ctx.SaveChangesAsync();

        var handler = new GetGuestCancellationPreviewQueryHandler(ctx);
        var preview = await handler.Handle(new GetGuestCancellationPreviewQuery(token), CancellationToken.None);

        Assert.True(preview.IsFreeCancellation);
        Assert.Equal(0m, preview.CancellationFee);
        Assert.Equal(300000m, preview.RefundableAmount); // 100% of deposit paid
        Assert.Equal(24, preview.FreeCancellationThresholdHours);
    }

    [Fact]
    public async Task Cancel_UnpaidPendingPayment_SuccessfullyCancels_ZeroRefund()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_unpaid_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddDays(2);
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 800000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Hoàng C",
            GuestEmail = "hoangc@hotelsaas.local",
            GuestPhone = "0987654321",
            TotalAmount = 800000m,
            Status = ReservationStatus.PendingPayment,
            ConfirmationCode = "CONF-CANCEL-01",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        var command = new CancelGuestBookingCommand(
            LookupToken: token,
            VerificationEmailOrPhone: "hoangc@hotelsaas.local",
            Reason: "Có việc bận đột xuất");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Cancelled", result.Status);
        Assert.Equal(0m, result.PaidAmount);
        Assert.Equal(0m, result.RefundableAmount);
        Assert.Equal("Revoked", result.SmartLockStatus);
        Assert.Null(result.SmartLockPin);
        Assert.Equal("Có việc bận đột xuất", result.CancellationReason);

        // Verify in DB
        var dbRes = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == resId);
        Assert.Equal(ReservationStatus.Cancelled, dbRes.Status);
        Assert.NotNull(dbRes.CancelledAtUtc);
    }

    [Fact]
    public async Task Cancel_PendingPayment_ZeroPaid_LessThan24Hours_FeeIsZero()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_unpaid_late_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddHours(5); // Within 24h
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 2_000_000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Tran D",
            GuestEmail = "trand@hotelsaas.local",
            GuestPhone = "0912345678",
            TotalAmount = 2_000_000m,
            Status = ReservationStatus.PendingPayment,
            ConfirmationCode = "CONF-UNPAID-LATE",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        // 1. Check preview
        var previewHandler = new GetGuestCancellationPreviewQueryHandler(ctx);
        var preview = await previewHandler.Handle(new GetGuestCancellationPreviewQuery(token), CancellationToken.None);

        Assert.True(preview.CanCancel);
        Assert.True(preview.IsFreeCancellation);
        Assert.True(preview.IsHold);
        Assert.Equal(0m, preview.PaidAmount);
        Assert.Equal(0m, preview.CancellationFee);
        Assert.Equal(0m, preview.RefundableAmount);

        // 2. Perform cancel
        var userContext = new MockUserContext();
        var cancelHandler = new CancelGuestBookingCommandHandler(ctx, userContext);
        var command = new CancelGuestBookingCommand(token, "trand@hotelsaas.local", "Khách tự hủy giữ phòng");
        var result = await cancelHandler.Handle(command, CancellationToken.None);

        Assert.Equal("Cancelled", result.Status);
        Assert.Equal(0m, result.CancellationFee);
        Assert.Equal(0m, result.RefundableAmount);

        // 3. Verify no pending refund was created
        var refunds = await ctx.Payments
            .IgnoreQueryFilters()
            .Where(p => p.ReservationId == resId && p.Status == PaymentStatus.Pending)
            .ToListAsync();
        Assert.Empty(refunds);
    }

    [Fact]
    public async Task Cancel_DepositPaid_LateCancellation_FeeDeductedFromDeposit()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_deposit_late_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddHours(12); // Late cancel (< 24h)
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 1000000m,
            DepositRequired = 300000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Đặng D",
            GuestEmail = "dangd@hotelsaas.local",
            GuestPhone = "0933333333",
            TotalAmount = 1000000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-CANCEL-02",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Paid deposit 300,000 VND
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            Amount = 300000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.BankTransfer,
            PaidAtUtc = nowUtc
        });
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        var result = await handler.Handle(new CancelGuestBookingCommand(token, "0933333333"), CancellationToken.None);

        Assert.Equal("Cancelled", result.Status);
        Assert.Equal(300000m, result.PaidAmount);
        Assert.Equal(300000m, result.CancellationFee); // 30% of 1,000,000 = 300,000
        Assert.Equal(0m, result.RefundableAmount); // 300,000 - 300,000 = 0
    }

    [Fact]
    public async Task Cancel_FullyPaid_LateCancellation_RefundsRemainingBalance()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_full_late_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddHours(10); // Late cancel (< 24h)
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 1000000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Bùi E",
            GuestEmail = "buie@hotelsaas.local",
            TotalAmount = 1000000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-CANCEL-03",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);

        // Paid full 1,000,000 VND
        ctx.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            Amount = 1000000m,
            Status = PaymentStatus.Completed,
            Method = PaymentMethod.BankTransfer,
            PaidAtUtc = nowUtc
        });
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        var result = await handler.Handle(new CancelGuestBookingCommand(token, "buie@hotelsaas.local"), CancellationToken.None);

        Assert.Equal("Cancelled", result.Status);
        Assert.Equal(1000000m, result.PaidAmount);
        Assert.Equal(300000m, result.CancellationFee); // 30% fee
        Assert.Equal(700000m, result.RefundableAmount); // 70% refund
        Assert.Equal("PendingApproval", result.RefundStatus);

        // Verify Decision D23: A pending refund Payment record is created in Status = Pending (awaiting manual approval), NOT Completed.
        var pendingRefund = await ctx.Payments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.ReservationId == resId && p.Status == PaymentStatus.Pending);
        Assert.NotNull(pendingRefund);
        Assert.Equal(700000m, pendingRefund.Amount);
        Assert.Equal(PaymentStatus.Pending, pendingRefund.Status);
        Assert.StartsWith("REFUND-PENDING-", pendingRefund.TransactionRef);
    }

    [Fact]
    public async Task Cancel_LoyaltyPoints_RefundedExactlyOnce_Idempotent()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var guestUserId = Guid.NewGuid();
        var membershipId = Guid.NewGuid();
        var token = "tok_loyalty_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddDays(3);
        var endUtc = startUtc.AddDays(1);

        // Create Customer User
        var user = new User
        {
            Id = guestUserId,
            Email = "vip@hotelsaas.local",
            FullName = "Thành Viên VIP",
            PasswordHash = "hash",
            GlobalRole = GlobalUserRole.Customer
        };
        ctx.Users.Add(user);

        // Create Member with 50 points remaining after 50 redeemed
        var member = new GuestLoyaltyMembership
        {
            Id = membershipId,
            TenantId = fixture.TenantId,
            EnrolledPropertyId = fixture.PropertyId,
            UserId = guestUserId,
            MemberCode = "AUR-882910",
            Tier = LoyaltyTier.Silver,
            PointsBalance = 50,
            LifetimePoints = 100
        };
        ctx.GuestLoyaltyMemberships.Add(member);

        // Original redemption transaction
        ctx.LoyaltyPointTransactions.Add(new LoyaltyPointTransaction
        {
            Id = Guid.NewGuid(),
            MembershipId = membershipId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            ReservationId = resId,
            TransactionType = LoyaltyPointTransactionType.RedeemedOnPayment,
            PointsDelta = -50,
            BalanceAfter = 50,
            Description = "Dùng 50 điểm",
            CreatedAtUtc = nowUtc
        });

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 750000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestUserId = guestUserId,
            GuestName = "Thành Viên VIP",
            GuestEmail = "vip@hotelsaas.local",
            TotalAmount = 750000m,
            PointsRedeemed = 50,
            PointsRefunded = 0,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-CANCEL-LOYALTY",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        // First cancellation
        var result1 = await handler.Handle(new CancelGuestBookingCommand(token, "vip@hotelsaas.local"), CancellationToken.None);
        Assert.Equal("Cancelled", result1.Status);

        var memberAfter = await ctx.GuestLoyaltyMemberships.FirstAsync(m => m.Id == membershipId);
        Assert.Equal(100, memberAfter.PointsBalance); // 50 refunded -> 100 balance

        var resAfter = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == resId);
        Assert.Equal(50, resAfter.PointsRefunded);

        // Second cancellation (Duplicate retry)
        var result2 = await handler.Handle(new CancelGuestBookingCommand(token, "vip@hotelsaas.local"), CancellationToken.None);
        Assert.Equal("Cancelled", result2.Status);

        var memberAfter2 = await ctx.GuestLoyaltyMemberships.FirstAsync(m => m.Id == membershipId);
        Assert.Equal(100, memberAfter2.PointsBalance); // Still 100, NOT 150!
    }

    [Fact]
    public async Task Cancel_CheckedInReservation_ThrowsConflict_ERR_INVALID_STATUS_TRANSITION()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_checkedin_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddHours(-2),
            EndAtUtc = nowUtc.AddDays(1),
            TotalAmount = 800000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Khách Đang Ở",
            GuestEmail = "staying@hotelsaas.local",
            TotalAmount = 800000m,
            Status = ReservationStatus.CheckedIn,
            ConfirmationCode = "CONF-CHECKEDIN",
            CheckInDate = DateOnly.FromDateTime(nowUtc),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(1)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CancelGuestBookingCommand(token, "staying@hotelsaas.local"), CancellationToken.None));

        Assert.Equal("ERR_INVALID_STATUS_TRANSITION", ex.ErrorCode);
    }

    [Fact]
    public async Task Cancel_ConfirmationCodeAlone_WithoutLookupToken_ThrowsForbiddenException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var secretToken = "tok_secret_unguessable_" + Guid.NewGuid().ToString("N");
        var confirmationCode = "CONF-PUBLIC-12345";
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddDays(2),
            EndAtUtc = nowUtc.AddDays(3),
            TotalAmount = 600000m,
            LookupToken = secretToken,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Khách Hàng",
            GuestEmail = "guest@hotelsaas.local",
            TotalAmount = 600000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = confirmationCode,
            CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        // Attacker attempts to cancel using ONLY the confirmation code from invoice/paper
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new CancelGuestBookingCommand(confirmationCode, "guest@hotelsaas.local"), CancellationToken.None));

        Assert.Equal("ERR_AUTHORIZATION_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task Preview_ConfirmationCodeAlone_WithoutLookupToken_ThrowsForbiddenException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var secretToken = "tok_secret_unguessable_" + Guid.NewGuid().ToString("N");
        var confirmationCode = "CONF-PUBLIC-PREVIEW-12345";
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddDays(2),
            EndAtUtc = nowUtc.AddDays(3),
            TotalAmount = 600000m,
            LookupToken = secretToken,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Khách Hàng",
            GuestEmail = "guest@hotelsaas.local",
            TotalAmount = 600000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = confirmationCode,
            CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var previewHandler = new GetGuestCancellationPreviewQueryHandler(ctx);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            previewHandler.Handle(new GetGuestCancellationPreviewQuery(confirmationCode), CancellationToken.None));

        Assert.Equal("ERR_AUTHORIZATION_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task Cancel_WithWrongVerificationEmailOrPhone_ThrowsForbiddenException()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_verify_mismatch_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddDays(2),
            EndAtUtc = nowUtc.AddDays(3),
            TotalAmount = 600000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Nguyễn Chính Chủ",
            GuestEmail = "chinhchu@hotelsaas.local",
            GuestPhone = "0909123456",
            TotalAmount = 600000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-VERIFY-MISMATCH",
            CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);

        // Mismatched email/phone
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new CancelGuestBookingCommand(token, "ke_gian@hotelsaas.local"), CancellationToken.None));

        Assert.Equal("ERR_VERIFICATION_FAILED", ex.ErrorCode);
    }

    [Fact]
    public async Task Cancel_ImmediatelyReleasesRoomInventory_InReservationTimeHelper()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_release_inv_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var startUtc = nowUtc.AddDays(2);
        var endUtc = startUtc.AddDays(1);

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            TotalAmount = 900000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Khách Hủy Phòng",
            GuestEmail = "release@hotelsaas.local",
            TotalAmount = 900000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-RELEASE-INV",
            CheckInDate = DateOnly.FromDateTime(startUtc),
            CheckOutDate = DateOnly.FromDateTime(endUtc),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        // 1. Before cancel: blocks inventory
        bool isBlockingBefore = ReservationTimeHelper.IsBlockingReservation(res, nowUtc);
        Assert.True(isBlockingBefore);

        // 2. Execute cancellation
        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);
        await handler.Handle(new CancelGuestBookingCommand(token, "release@hotelsaas.local"), CancellationToken.None);

        // 3. After cancel: immediately released
        var resAfter = await ctx.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == resId);
        bool isBlockingAfter = ReservationTimeHelper.IsBlockingReservation(resAfter, nowUtc);
        Assert.False(isBlockingAfter);
    }

    [Fact]
    public async Task Cancel_PhysicalRoomStatus_PreservedAndNotAltered()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_dirty_room_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddDays(2),
            EndAtUtc = nowUtc.AddDays(3),
            TotalAmount = 500000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId, // Room 301 is Dirty
            GuestName = "Khách Phòng Dirty",
            GuestEmail = "dirty@hotelsaas.local",
            TotalAmount = 500000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-DIRTY-ROOM",
            CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(2)),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);
        await handler.Handle(new CancelGuestBookingCommand(token, "dirty@hotelsaas.local"), CancellationToken.None);

        // Ensure physical room is still Dirty, not magically Cleaned
        var room = await ctx.Rooms.IgnoreQueryFilters().FirstAsync(r => r.Id == fixture.RoomId);
        Assert.Equal(RoomStatus.Dirty, room.Status);
    }

    [Fact]
    public async Task Cancel_AuditLog_RecordedWithSanitizedPayload()
    {
        await using var fixture = await TestFixture.CreateAsync(this);
        await using var ctx = fixture.CreateDbContext();

        var token = "tok_audit_test_" + Guid.NewGuid().ToString("N");
        var resId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var snap = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = nowUtc.AddDays(3),
            EndAtUtc = nowUtc.AddDays(4),
            TotalAmount = 1000000m,
            LookupToken = token,
            TokenExpiresAtUtc = nowUtc.AddDays(7),
            RoomTypeId = fixture.RoomTypeId
        };

        var res = new Reservation
        {
            Id = resId,
            TenantId = fixture.TenantId,
            PropertyId = fixture.PropertyId,
            RoomId = fixture.RoomId,
            GuestName = "Audit User",
            GuestEmail = "audit@hotelsaas.local",
            TotalAmount = 1000000m,
            Status = ReservationStatus.Confirmed,
            ConfirmationCode = "CONF-AUDIT-TEST",
            CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
            CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(4)),
            Notes = ReservationSnapshotHelper.Serialize(snap)
        };
        ctx.Reservations.Add(res);
        await ctx.SaveChangesAsync();

        var userContext = new MockUserContext();
        var handler = new CancelGuestBookingCommandHandler(ctx, userContext);
        await handler.Handle(new CancelGuestBookingCommand(token, "audit@hotelsaas.local", "Kế hoạch gia đình thay đổi"), CancellationToken.None);

        var auditLogs = await ctx.AuditLogs
            .IgnoreQueryFilters()
            .Where(a => a.EntityId == resId && a.EntityName == "Reservation")
            .ToListAsync();

        Assert.NotEmpty(auditLogs);
        var log = auditLogs.First();
        Assert.Equal(AuditActions.Update, log.Action);
        Assert.Contains("Cancelled", log.NewValues);
        Assert.Contains("Kế hoạch gia đình thay đổi", log.NewValues);
    }
}

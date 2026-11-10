using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ApproveRefund;
using HotelSaas.Application.Payments.Commands.ConfirmRefundPayout;
using HotelSaas.Application.Payments.Commands.RejectRefund;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Payments.Queries.GetPaymentSummary;
using HotelSaas.Application.Payments.Queries.GetRefundRequests;
using HotelSaas.Application.Payments.Queries.GetRefundRequestDetail;
using HotelSaas.Application.Payments.Queries.GetShiftReport;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Comprehensive verification suite for Task Week 05 T01 â€” Refund Approval Management (Decision D23).
/// Verifies:
/// 1. Listing pending refunds and filtering by status/date.
/// 2. Tenant and Property isolation (Fail-closed guards).
/// 3. Accurate refund amount, cancellation fee, and audit steps calculation.
/// 4. Manager with PAYMENTS:Approve (Action 16) approval workflow.
/// 5. Receptionist without PAYMENTS:Approve blocked with 403 Forbidden.
/// 6. Idempotency guards against double approval and double payout.
/// 7. Mandatory bank reference validation on payout confirmation.
/// 8. Rejection workflow with mandatory reason.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class RefundApprovalManagementTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
                   ?? Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION")
                   ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(envConn)) return envConn;

        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";
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
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "manager@luxestay.com";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public HotelSaas.Domain.Enums.TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public HotelSaas.Domain.Enums.PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public HotelSaas.Domain.Enums.StaffRole? StaffRole { get; set; } = HotelSaas.Domain.Enums.StaffRole.Manager;
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

    private sealed class MockMembershipLookupService : IMembershipLookupService
    {
        public MembershipLookupStatus ReturnStatus { get; set; } = MembershipLookupStatus.Success;

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken)
        {
            if (ReturnStatus == MembershipLookupStatus.Success)
            {
                return Task.FromResult(MembershipLookupResult.Succeeded(
                    Guid.NewGuid(),
                    StaffRole.Manager,
                    targetPropertyId,
                    isTenantWide: true));
            }

            return Task.FromResult(MembershipLookupResult.Failed(ReturnStatus, "Membership check failed."));
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

    private static async Task<string> InitializeTestSchemaAsync(string connStr)
    {
        var schemaName = $"test_refund_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA \"{schemaName}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var dummyTenant = new MockTenantService();
        var dummyProp = new MockPropertyService();
        await using var context = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
        await context.Database.MigrateAsync();

        return schemaName;
    }

    private static async Task DropTestSchemaAsync(string connStr, string schemaName)
    {
        try
        {
            await using var conn = new NpgsqlConnection(connStr);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Ignore cleanup errors
        }
    }

    private static async Task<(Tenant Tenant, Property Property, Room Room)> SeedHierarchyAsync(
        ApplicationDbContext context,
        MockTenantService tenantService,
        MockPropertyService propertyService)
    {
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var roomTypeId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        tenantService.TenantId = tenantId;
        propertyService.PropertyId = propertyId;
        propertyService.HeaderPropertyId = propertyId;

        var tenant = new Tenant { Id = tenantId, Name = "LuxeStay Group", Code = $"LXG_{Guid.NewGuid():N}"[..10], Slug = $"tenant_{Guid.NewGuid():N}"[..20], Address = "123 Le Loi", City = "HCM" };
        var property = new Property { Id = propertyId, TenantId = tenantId, Name = $"LuxeStay_{Guid.NewGuid():N}"[..18], Code = $"SGN_{Guid.NewGuid():N}"[..10], Slug = $"prop_{Guid.NewGuid():N}"[..20], Address = "123 Le Loi" };
        var roomType = new RoomType { Id = roomTypeId, TenantId = tenantId, PropertyId = propertyId, Name = "Deluxe Room", Code = $"DLX_{Guid.NewGuid():N}"[..10], BasePrice = 1_000_000m, MaxOccupancy = 2 };
        var room = new Room { Id = roomId, TenantId = tenantId, PropertyId = propertyId, RoomTypeId = roomTypeId, RoomNumber = "101", Status = RoomStatus.Clean };

        context.Tenants.Add(tenant);
        context.Properties.Add(property);
        context.RoomTypes.Add(roomType);
        context.Rooms.Add(room);
        await context.SaveChangesAsync();

        return (tenant, property, room);
    }

    [Fact]
    public async Task GetRefundRequests_MissingTenant_ThrowsUnauthorizedAccessException()
    {
        var connStr = GetConnectionString();
        var tenantService = new MockTenantService { TenantId = null };
        var userContext = new MockUserContext();
        var membershipService = new MockMembershipLookupService();

        var dummyProp = new MockPropertyService();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr)
            .Options;
        await using var context = new ApplicationDbContext(options, tenantService, dummyProp);

        var handler = new GetRefundRequestsQueryHandler(context, tenantService, userContext, membershipService);
        var query = new GetRefundRequestsQuery(Guid.NewGuid());

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task GetRefundRequests_ContextMismatch_ThrowsBadRequestException()
    {
        var connStr = GetConnectionString();
        var propertyId1 = Guid.NewGuid();
        var propertyId2 = Guid.NewGuid();

        var tenantService = new MockTenantService { TenantId = Guid.NewGuid() };
        var propertyService = new MockPropertyService { HeaderPropertyId = propertyId1 };
        var userContext = new MockUserContext();
        var membershipService = new MockMembershipLookupService();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr)
            .Options;
        await using var context = new ApplicationDbContext(options, tenantService, propertyService);

        var handler = new GetRefundRequestsQueryHandler(context, tenantService, userContext, membershipService, propertyService);
        var query = new GetRefundRequestsQuery(propertyId2); // Mismatched

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(query, CancellationToken.None));
        Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
    }

    [Fact]
    public async Task ApproveRefund_WithoutApprovePermission_ThrowsForbiddenException()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, _) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            // Seed Role and RolePermission without Approve bit (Only Read=1 + Create=2 = 3)
            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Receptionist" };
            var function = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
            if (function == null)
            {
                function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 3 };
                context.PermissionFunctions.Add(function);
            }
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 3 // NO 16 (Approve)
            });
            await context.SaveChangesAsync();

            var handler = new ApproveRefundCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var command = new ApproveRefundCommand(Guid.NewGuid(), property.Id);

            var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN_APPROVE", ex.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ApproveRefund_WithApprovePermission_SetsApprovedState_AndAudit()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            // Seed Role with Approve bit (51 = 1+2+16+32)
            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Property Manager" };
            var function = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
            if (function == null)
            {
                function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
                context.PermissionFunctions.Add(function);
            }
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16
            });

            // Seed Reservation & Pending Refund Payment
            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF12345",
                GuestName = "Tran Trong Tan",
                GuestEmail = "tan@example.com",
                GuestPhone = "0987654321",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 2_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3))
            };
            context.Reservations.Add(reservation);

            // Original completed payment
            var origPayment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 2_000_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = "TXN-ORIG-01",
                PaidAtUtc = DateTime.UtcNow.AddDays(-1)
            };
            context.Payments.Add(origPayment);

            // Pending refund payment
            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 1_400_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = $"REFUND-PENDING-REF12345",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ApproveRefundCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var command = new ApproveRefundCommand(paymentId, property.Id, "Duyá»‡t hoÃ n 70% theo chÃ­nh sÃ¡ch");

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Approved", result.Status);
            Assert.Equal("Đã duyệt - Chờ chi trả", result.StatusName);
            Assert.Equal(1_400_000m, result.RefundableAmount);
            Assert.Equal(600_000m, result.CancellationFee);
            Assert.Contains("REFUND-APPROVED", result.TransactionRef);

            // Verify in DB
            var updatedPayment = await context.Payments.FindAsync(paymentId);
            Assert.NotNull(updatedPayment);
            Assert.Equal(PaymentStatus.Pending, updatedPayment.Status);
            Assert.Contains("REFUND-APPROVED", updatedPayment.TransactionRef);

            // Idempotency check: approving again throws Conflict
            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
            Assert.Equal("ERR_ALREADY_APPROVED", ex.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_RequiresBankRef_And_SetsCompleted()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            // Seed Role with Approve bit (51 = 1+2+16+32)
            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Property Manager" };
            var function = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
            if (function == null)
            {
                function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
                context.PermissionFunctions.Add(function);
            }
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16
            });

            // Seed approved refund payment
            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF99999",
                GuestName = "Nguyen Van B",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 700_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-APPROVED-REF99999",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);

            // Validation check: empty bank ref throws BadRequest
            var invalidCommand = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "");
            var exReq = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(invalidCommand, CancellationToken.None));
            Assert.Equal("ERR_BANK_REF_REQUIRED", exReq.ErrorCode);

            // Valid execution
            var validCommand = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-1234567890", "ÄÃ£ chuyá»ƒn khoáº£n Vietcombank");
            var result = await handler.Handle(validCommand, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Completed", result.Status);
            Assert.Equal("Đã hoàn tiền", result.StatusName);
            Assert.Equal("VCB-1234567890", result.BankTransactionRef);
            Assert.NotNull(result.PaidAtUtc);

            // Verify in DB
            var dbPayment = await context.Payments.FindAsync(paymentId);
            Assert.NotNull(dbPayment);
            Assert.Equal(PaymentStatus.Completed, dbPayment.Status);
            Assert.NotNull(dbPayment.PaidAtUtc);

            // Double execution guard
            var exConflict = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(validCommand, CancellationToken.None));
            Assert.Equal("ERR_ALREADY_COMPLETED", exConflict.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task RejectRefund_SetsFailedState_And_RequiresReason()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            // Seed Role with Approve bit (51)
            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Property Manager" };
            var function = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
            if (function == null)
            {
                function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
                context.PermissionFunctions.Add(function);
            }
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51
            });

            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REFREJ01",
                GuestName = "Khach Hang X",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 500_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-PENDING-REFREJ01",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new RejectRefundCommandHandler(context, tenantService, userContext, membershipService, propertyService);

            // Rejection reason is required
            var exReason = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(new RejectRefundCommand(paymentId, property.Id, ""), CancellationToken.None));
            Assert.Equal("ERR_REASON_REQUIRED", exReason.ErrorCode);

            // Valid rejection
            var result = await handler.Handle(new RejectRefundCommand(paymentId, property.Id, "Thông tin tài khoản sai lệch"), CancellationToken.None);
            Assert.Equal("Rejected", result.Status);
            Assert.Equal("Đã từ chối", result.StatusName);
            Assert.Equal("Thông tin tài khoản sai lệch", result.RejectionReason);

            // Verify in DB
            var dbPayment = await context.Payments.FindAsync(paymentId);
            Assert.NotNull(dbPayment);
            Assert.Equal(PaymentStatus.Failed, dbPayment.Status);
            Assert.Contains("REFUND-REJECTED", dbPayment.TransactionRef);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task GetRefundRequests_WithFilters_ReturnsCorrectDtos()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = Guid.NewGuid(), TenantId = tenant.Id };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var resId = Guid.NewGuid();
            var reservation = new Reservation
            {
                Id = resId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-FILTER-01",
                GuestName = "Le Van A",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 2_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            // Completed payment
            context.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = resId,
                Amount = 2_000_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = "TXN-ORIG-F1",
                PaidAtUtc = DateTime.UtcNow.AddDays(-1)
            });

            // Pending refund payment
            var pendingRefundId = Guid.NewGuid();
            context.Payments.Add(new Payment
            {
                Id = pendingRefundId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = resId,
                Amount = 1_600_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-PENDING-REF-FILTER-01",
                CreatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            var handler = new GetRefundRequestsQueryHandler(context, tenantService, userContext, membershipService, propertyService);
            var query = new GetRefundRequestsQuery(property.Id, Status: "PendingApproval", Page: 1, PageSize: 10);

            var response = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(response);
            Assert.Equal(1, response.TotalCount);
            var item = response.Items.First();
            Assert.Equal(pendingRefundId, item.PaymentId);
            Assert.Equal("PendingApproval", item.Status);
            Assert.Equal("Chờ phê duyệt", item.StatusName);
            Assert.Equal(1_600_000m, item.RefundableAmount);
            Assert.Equal(400_000m, item.CancellationFee);
            Assert.Equal("Le Van A", item.GuestName);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task GetRefundRequestDetail_CalculatesAccurateAmounts_AndAuditSteps()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = Guid.NewGuid(), TenantId = tenant.Id };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var resId = Guid.NewGuid();
            var reservation = new Reservation
            {
                Id = resId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-DETAIL-01",
                GuestName = "Tran Thi B",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 3_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4))
            };
            context.Reservations.Add(reservation);

            // Completed payment
            context.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = resId,
                Amount = 3_000_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = "TXN-ORIG-D1",
                PaidAtUtc = DateTime.UtcNow.AddDays(-1)
            });

            // Pending refund payment
            var pendingRefundId = Guid.NewGuid();
            context.Payments.Add(new Payment
            {
                Id = pendingRefundId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = resId,
                Amount = 2_100_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-PENDING-REF-DETAIL-01",
                CreatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            var handler = new GetRefundRequestDetailQueryHandler(context, tenantService, userContext, membershipService, new CancellationPolicyService(), propertyService);
            var query = new GetRefundRequestDetailQuery(pendingRefundId, property.Id);

            var detail = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(detail);
            Assert.Equal(pendingRefundId, detail.PaymentId);
            Assert.Equal("PendingApproval", detail.Status);
            Assert.Equal(3_000_000m, detail.TotalAmount);
            Assert.Equal(3_000_000m, detail.PaidAmount);
            Assert.Equal(0m, detail.CancellationFee);
            Assert.True(detail.IsFreeCancellation);
            Assert.Equal(2_100_000m, detail.RefundableAmount);
            Assert.Equal(3, detail.AuditTrail.Count);
            Assert.Equal("completed", detail.AuditTrail[0].State);
            Assert.Equal("current", detail.AuditTrail[1].State);
            Assert.Equal("upcoming", detail.AuditTrail[2].State);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_WithoutApprovePermission_ThrowsForbiddenException()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            // Seed Role WITHOUT Approve bit (ActionMask = 3: Read + Create, lacks 16 Approve)
            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Frontdesk Receptionist" };
            var function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
            context.PermissionFunctions.Add(function);
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 3 // Lacks bit 16
            });

            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-UNAUTH-01",
                GuestName = "Test Guest",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-APPROVED-REF-UNAUTH-01",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var cmd = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-888999");

            var ex = await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_FORBIDDEN_APPROVE", ex.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_UnapprovedRefund_ThrowsConflictException()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Manager" };
            var function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
            context.PermissionFunctions.Add(function);
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16
            });

            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-NOT-APP-01",
                GuestName = "Test Guest 2",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            // Refund request that is still PENDING and NOT YET APPROVED
            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-PENDING-REF-NOT-APP-01",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var cmd = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-888999");

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_NOT_APPROVED", ex.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_AlreadyRejected_ThrowsConflictException()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Manager" };
            var function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
            context.PermissionFunctions.Add(function);
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16
            });

            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-REJ-01",
                GuestName = "Test Guest 3",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            // Refund request that was REJECTED
            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Failed,
                TransactionRef = "REFUND-REJECTED-REF-REJ-01|Reason:KhÃ´ng Ä‘á»§ Ä‘iá»u kiá»‡n",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var cmd = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-888999");

            var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None));
            Assert.Equal("ERR_ALREADY_REJECTED", ex.ErrorCode);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_CrossTenant_ThrowsNotFoundException()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenantA, propA, roomA) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            // Seed Tenant B using isolated seedContextB
            var tenantBService = new MockTenantService();
            var propBService = new MockPropertyService();
            await using var seedContextB = CreateDbContext(connStr, schemaName, tenantBService, propBService);
            var (tenantB, propB, roomB) = await SeedHierarchyAsync(seedContextB, tenantBService, propBService);

            var resB = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB.Id,
                PropertyId = propB.Id,
                RoomId = roomB.Id,
                ConfirmationCode = "REF-TENANT-B",
                GuestName = "Guest B",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            seedContextB.Reservations.Add(resB);

            var paymentBId = Guid.NewGuid();
            var paymentB = new Payment
            {
                Id = paymentBId,
                TenantId = tenantB.Id,
                PropertyId = propB.Id,
                ReservationId = resB.Id,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-APPROVED-REF-TENANT-B",
                CreatedAtUtc = DateTime.UtcNow
            };
            seedContextB.Payments.Add(paymentB);
            await seedContextB.SaveChangesAsync();

            // Attacker context is authenticated to Tenant A
            var tenantServiceA = new MockTenantService { TenantId = tenantA.Id };
            var propertyServiceA = new MockPropertyService { PropertyId = propA.Id, HeaderPropertyId = propA.Id };
            var userContextA = new MockUserContext { UserId = Guid.NewGuid(), TenantId = tenantA.Id, RoleId = null };
            var membershipService = new MockMembershipLookupService();

            await using var contextA = CreateDbContext(connStr, schemaName, tenantServiceA, propertyServiceA);
            var handler = new ConfirmRefundPayoutCommandHandler(contextA, tenantServiceA, userContextA, membershipService, propertyServiceA);

            // Attempt to confirm payout on Tenant B's payment
            var cmd = new ConfirmRefundPayoutCommand(paymentBId, propA.Id, PaymentMethod.BankTransfer, "VCB-ATTACK");

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(cmd, CancellationToken.None));
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_DoubleSpending_EnsuresIdempotencyAndNoDuplicatePayout()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Manager" };
            var function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
            context.PermissionFunctions.Add(function);
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16
            });

            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "REF-DOUBLE-01",
                GuestName = "Test Guest 4",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 2_000_000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
            };
            context.Reservations.Add(reservation);

            var refundPayment = new Payment
            {
                Id = paymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 1_500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-APPROVED-REF-DOUBLE-01",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            var handler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);

            // First payout attempt: SUCCESS
            var firstCmd = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-FIRST-PAYOUT", "Lần chi trả 1");
            var firstResult = await handler.Handle(firstCmd, CancellationToken.None);

            Assert.NotNull(firstResult);
            Assert.Equal("Completed", firstResult.Status);
            Assert.Equal("VCB-FIRST-PAYOUT", firstResult.BankTransactionRef);

            var firstPaidAt = firstResult.PaidAtUtc;
            Assert.NotNull(firstPaidAt);

            // Second payout attempt (Double Spending): MUST FAIL with ConflictException
            var secondCmd = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.Cash, "CASH-SECOND-PAYOUT", "Cố tình chi trả lần 2");
            var conflictEx = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(secondCmd, CancellationToken.None));
            Assert.Equal("ERR_ALREADY_COMPLETED", conflictEx.ErrorCode);

            // Assert database integrity: data was not overwritten or duplicated
            var dbPayment = await context.Payments.FindAsync(paymentId);
            Assert.NotNull(dbPayment);
            Assert.Equal(PaymentStatus.Completed, dbPayment.Status);
            Assert.Equal(PaymentMethod.BankTransfer, dbPayment.Method); // Still BankTransfer, not overwritten by Cash
            Assert.Equal(firstPaidAt, dbPayment.PaidAtUtc); // Timestamp unchanged
            Assert.Contains("BankRef:VCB-FIRST-PAYOUT", dbPayment.TransactionRef); // Original reference preserved
            Assert.DoesNotContain("CASH-SECOND-PAYOUT", dbPayment.TransactionRef);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task RefundPayout_DoesNotInflateCollectedRevenue_InShiftReport_DailySummary_OrFolio()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var userId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var userContext = new MockUserContext { UserId = userId, TenantId = tenant.Id, RoleId = roleId };
            var membershipService = new MockMembershipLookupService();

            await using var context = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Property Manager" };
            var function = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
            if (function == null)
            {
                function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
                context.PermissionFunctions.Add(function);
            }
            context.AccessRoles.Add(role);
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                FunctionId = function.Id,
                ActionMask = 51 // Has bit 16 (Approve)
            });

            // Use current Vietnam business date and determine active shift so ConfirmRefundPayout (which sets PaidAtUtc = DateTime.UtcNow) lands in the same shift
            var nowUtc = DateTime.UtcNow;
            var vnNow = nowUtc.AddHours(7);
            var vnTime = TimeOnly.FromDateTime(vnNow);
            ShiftType currentShift;
            DateOnly reportDate;

            if (vnTime >= new TimeOnly(6, 0) && vnTime < new TimeOnly(14, 0))
            {
                currentShift = ShiftType.Morning;
                reportDate = DateOnly.FromDateTime(vnNow);
            }
            else if (vnTime >= new TimeOnly(14, 0) && vnTime < new TimeOnly(22, 0))
            {
                currentShift = ShiftType.Afternoon;
                reportDate = DateOnly.FromDateTime(vnNow);
            }
            else
            {
                currentShift = ShiftType.Night;
                reportDate = vnTime < new TimeOnly(6, 0)
                    ? DateOnly.FromDateTime(vnNow).AddDays(-1)
                    : DateOnly.FromDateTime(vnNow);
            }

            var otherShift = currentShift == ShiftType.Morning ? ShiftType.Afternoon : ShiftType.Morning;
            var dailySummaryDate = DateOnly.FromDateTime(vnNow);

            var reservationId = Guid.NewGuid();
            var reservation = new Reservation
            {
                Id = reservationId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "RES-REV-1000",
                GuestName = "Tran Trong Tan",
                GuestEmail = "tan@luxestay.vn",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 1_000_000m,
                CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(2)),
                CancelledAtUtc = nowUtc
            };
            context.Reservations.Add(reservation);

            // 1. Collected 1,000,000 VND (BankTransfer) in the current shift/date
            var collectedPayment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 1_000_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = "COLLECT-1000K",
                PaidAtUtc = nowUtc.AddMinutes(-1),
                CreatedAtUtc = nowUtc.AddMinutes(-1)
            };
            context.Payments.Add(collectedPayment);

            // 2. Pending refund (200,000 VND), Approved-but-unpaid refund (150,000 VND), Rejected refund (100,000 VND) on other reservations
            // None of these should ever count as paid out or collected
            var otherResId = Guid.NewGuid();
            context.Reservations.Add(new Reservation
            {
                Id = otherResId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = room.Id,
                ConfirmationCode = "RES-OTHER-01",
                GuestName = "Other Guest",
                Status = ReservationStatus.Cancelled,
                TotalAmount = 500_000m,
                CheckInDate = DateOnly.FromDateTime(nowUtc.AddDays(3)),
                CheckOutDate = DateOnly.FromDateTime(nowUtc.AddDays(4))
            });
            context.Payments.AddRange(
                new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    ReservationId = otherResId,
                    Amount = 200_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Pending,
                    TransactionRef = "REFUND-PENDING-RES-OTHER-01",
                    CreatedAtUtc = nowUtc
                },
                new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    ReservationId = otherResId,
                    Amount = 150_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Pending,
                    TransactionRef = "REFUND-APPROVED-RES-OTHER-01",
                    CreatedAtUtc = nowUtc
                },
                new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    ReservationId = otherResId,
                    Amount = 100_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Failed,
                    TransactionRef = "REFUND-REJECTED-RES-OTHER-01|Reason:Quá hạn",
                    CreatedAtUtc = nowUtc
                }
            );

            // 3. Approved refund request of 300,000 VND for our main reservation, ready to confirm external payout
            var refundPaymentId = Guid.NewGuid();
            var refundPayment = new Payment
            {
                Id = refundPaymentId,
                TenantId = tenant.Id,
                PropertyId = property.Id,
                ReservationId = reservationId,
                Amount = 300_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = "REFUND-APPROVED-RES-REV-1000",
                CreatedAtUtc = nowUtc
            };
            context.Payments.Add(refundPayment);
            await context.SaveChangesAsync();

            // Before confirming payout: TotalCollected = 1,000,000; TotalRefunded = 0; NetCollected = 1,000,000
            var shiftHandler = new GetShiftReportQueryHandler(context, tenantService, userContext, membershipService, propertyService);
            var summaryHandler = new GetPaymentSummaryQueryHandler(context, tenantService, userContext, membershipService, propertyService);
            var folioHandler = new GetFolioQueryHandler(context, tenantService, userContext, membershipService, propertyService);

            var preShift = await shiftHandler.Handle(new GetShiftReportQuery(property.Id, reportDate, currentShift), CancellationToken.None);
            Assert.Equal(1_000_000m, preShift.TotalCollected);
            Assert.Equal(0m, preShift.TotalRefunded);
            Assert.Equal(1_000_000m, preShift.NetCollected);

            // Confirm external payout of 300,000 VND (Decision D23)
            var payoutHandler = new ConfirmRefundPayoutCommandHandler(context, tenantService, userContext, membershipService, propertyService);
            var confirmCmd = new ConfirmRefundPayoutCommand(refundPaymentId, property.Id, PaymentMethod.BankTransfer, "FT-EXT-300K", "Đã chi hoàn ngoài hệ thống");
            var payoutDto = await payoutHandler.Handle(confirmCmd, CancellationToken.None);
            Assert.Equal("Completed", payoutDto.Status);
            Assert.Equal(300_000m, payoutDto.RefundableAmount);

            // Re-sending confirmation must be rejected (idempotency / no double payout)
            await Assert.ThrowsAsync<ConflictException>(() => payoutHandler.Handle(confirmCmd, CancellationToken.None));

            // Verify Shift Report in active shift: Collected = 1,000,000; Refunded = 300,000; NetCollected = 700,000 (NEVER 1,300,000!)
            var postShift = await shiftHandler.Handle(new GetShiftReportQuery(property.Id, reportDate, currentShift), CancellationToken.None);
            Assert.Equal(1_000_000m, postShift.TotalCollected);
            Assert.Equal(1_000_000m, postShift.BankTransferCollected);
            Assert.Equal(0m, postShift.CashCollected);
            Assert.Equal(1, postShift.CompletedCount);
            Assert.Equal(300_000m, postShift.TotalRefunded);
            Assert.Equal(700_000m, postShift.NetCollected);

            // Verify another shift on the same day has 0 collected and 0 refunded
            var emptyShift = await shiftHandler.Handle(new GetShiftReportQuery(property.Id, reportDate, otherShift), CancellationToken.None);
            Assert.Equal(0m, emptyShift.TotalCollected);
            Assert.Equal(0m, emptyShift.TotalRefunded);
            Assert.Equal(0m, emptyShift.NetCollected);

            // Verify Daily Payment Summary on payout date: Collected = 1,000,000; Refunded = 300,000; NetCollected = 700,000
            var dailySummary = await summaryHandler.Handle(new GetPaymentSummaryQuery(property.Id, dailySummaryDate), CancellationToken.None);
            Assert.Equal(1_000_000m, dailySummary.TotalCollected);
            Assert.Equal(1_000_000m, dailySummary.BankTransferCollected);
            Assert.Equal(1, dailySummary.CompletedCount);
            Assert.Equal(300_000m, dailySummary.TotalRefunded);
            Assert.Equal(700_000m, dailySummary.NetCollected);

            // Verify Folio: PaidAmount = 1,000,000; TotalRefunded = 300,000; NetCollected = 700,000
            var folio = await folioHandler.Handle(new GetFolioQuery(reservationId, property.Id), CancellationToken.None);
            Assert.Equal(1_000_000m, folio.PaidAmount);
            Assert.Equal(300_000m, folio.TotalRefunded);
            Assert.Equal(700_000m, folio.NetCollected);
            Assert.Equal("Refunded", folio.RefundStatus);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }

    [Fact]
    public async Task ConfirmRefundPayout_TwoCashiersSimultaneously_OnlyOneSucceedsAndOneThrowsConflict()
    {
        var connStr = GetConnectionString();
        var schemaName = await InitializeTestSchemaAsync(connStr);

        try
        {
            var dummyTenant = new MockTenantService();
            var dummyProp = new MockPropertyService();
            await using var seedContext = CreateDbContext(connStr, schemaName, dummyTenant, dummyProp);
            var (tenant, property, room) = await SeedHierarchyAsync(seedContext, dummyTenant, dummyProp);

            var roleId = Guid.NewGuid();
            var cashier1Id = Guid.NewGuid();
            var cashier2Id = Guid.NewGuid();
            var reservationId = Guid.NewGuid();
            var paymentId = Guid.NewGuid();

            var tenantService = new MockTenantService { TenantId = tenant.Id };
            var propertyService = new MockPropertyService { PropertyId = property.Id, HeaderPropertyId = property.Id };
            var membershipService = new MockMembershipLookupService();

            await using (var setupContext = CreateDbContext(connStr, schemaName, tenantService, propertyService))
            {
                var role = new AccessRole { Id = roleId, TenantId = tenant.Id, Name = "Cashier / Manager" };
                var function = await setupContext.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PAYMENTS");
                if (function == null)
                {
                    function = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE", SupportedActionMask = 127 };
                    setupContext.PermissionFunctions.Add(function);
                }
                setupContext.AccessRoles.Add(role);
                setupContext.RolePermissions.Add(new RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FunctionId = function.Id,
                    ActionMask = 51 // Has bit 16 (Approve)
                });

                var reservation = new Reservation
                {
                    Id = reservationId,
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    RoomId = room.Id,
                    ConfirmationCode = "RES-CONCURRENT-01",
                    GuestName = "Khach Hang Dong Thoi",
                    Status = ReservationStatus.Cancelled,
                    TotalAmount = 1_000_000m,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2))
                };
                setupContext.Reservations.Add(reservation);

                // Original collected payment: 1,000,000 VND
                setupContext.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    ReservationId = reservationId,
                    Amount = 1_000_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "COLLECT-ORIG-1M",
                    PaidAtUtc = DateTime.UtcNow.AddMinutes(-5),
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
                });

                // Approved refund awaiting payout confirmation: 300,000 VND
                setupContext.Payments.Add(new Payment
                {
                    Id = paymentId,
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    ReservationId = reservationId,
                    Amount = 300_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Pending,
                    TransactionRef = "REFUND-APPROVED-RES-CONCURRENT-01",
                    CreatedAtUtc = DateTime.UtcNow
                });

                await setupContext.SaveChangesAsync();
            }

            // Two independent DbContext instances representing two cashier sessions clicking "Confirm Payout" simultaneously
            await using var contextCashier1 = CreateDbContext(connStr, schemaName, tenantService, propertyService);
            await using var contextCashier2 = CreateDbContext(connStr, schemaName, tenantService, propertyService);

            var userContext1 = new MockUserContext { UserId = cashier1Id, Email = "cashier1@luxestay.vn", TenantId = tenant.Id, RoleId = roleId };
            var userContext2 = new MockUserContext { UserId = cashier2Id, Email = "cashier2@luxestay.vn", TenantId = tenant.Id, RoleId = roleId };

            var handler1 = new ConfirmRefundPayoutCommandHandler(contextCashier1, tenantService, userContext1, membershipService, propertyService);
            var handler2 = new ConfirmRefundPayoutCommandHandler(contextCashier2, tenantService, userContext2, membershipService, propertyService);

            var cmd1 = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.BankTransfer, "VCB-CASHIER-01", "Thu ngân 1 xác nhận");
            var cmd2 = new ConfirmRefundPayoutCommand(paymentId, property.Id, PaymentMethod.Cash, "CASH-CASHIER-02", "Thu ngân 2 xác nhận cùng lúc");

            using var startGate = new ManualResetEventSlim(false);

            async Task<(RefundRequestDto? Result, Exception? Error)> RunCashierAsync(
                ConfirmRefundPayoutCommandHandler handler,
                ConfirmRefundPayoutCommand command)
            {
                await Task.Run(() => startGate.Wait());
                try
                {
                    var dto = await handler.Handle(command, CancellationToken.None);
                    return (dto, null);
                }
                catch (Exception ex)
                {
                    return (null, ex);
                }
            }

            var task1 = RunCashierAsync(handler1, cmd1);
            var task2 = RunCashierAsync(handler2, cmd2);

            // Release both cashiers at the exact same instant
            startGate.Set();
            var outcomes = await Task.WhenAll(task1, task2);

            var successes = outcomes.Where(o => o.Result != null).ToList();
            var failures = outcomes.Where(o => o.Error != null).ToList();

            // Exactly 1 cashier must succeed, and 1 cashier must receive ConflictException (ERR_ALREADY_COMPLETED)
            Assert.Single(successes);
            Assert.Single(failures);

            var conflictEx = Assert.IsType<ConflictException>(failures[0].Error);
            Assert.Equal("ERR_ALREADY_COMPLETED", conflictEx.ErrorCode);

            var winnerDto = successes[0].Result!;
            Assert.Equal("Completed", winnerDto.Status);

            // Verify database state and audit logs using a fresh context
            await using var verifyContext = CreateDbContext(connStr, schemaName, tenantService, propertyService);
            var dbPayment = await verifyContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
            Assert.NotNull(dbPayment);
            Assert.Equal(PaymentStatus.Completed, dbPayment.Status);
            Assert.Contains($"BankRef:{winnerDto.BankTransactionRef}", dbPayment.TransactionRef);

            var loserRef = winnerDto.BankTransactionRef == "VCB-CASHIER-01" ? "CASH-CASHIER-02" : "VCB-CASHIER-01";
            Assert.DoesNotContain(loserRef, dbPayment.TransactionRef);

            var auditCount = await verifyContext.AuditLogs
                .AsNoTracking()
                .CountAsync(a => a.EntityName == nameof(Payment) && a.EntityId == paymentId);
            Assert.Equal(1, auditCount);

            var folioHandler = new GetFolioQueryHandler(verifyContext, tenantService, userContext1, membershipService, propertyService);
            var folio = await folioHandler.Handle(new GetFolioQuery(reservationId, property.Id), CancellationToken.None);
            Assert.Equal(1_000_000m, folio.PaidAmount);
            Assert.Equal(300_000m, folio.TotalRefunded);
            Assert.Equal(700_000m, folio.NetCollected);
        }
        finally
        {
            await DropTestSchemaAsync(connStr, schemaName);
        }
    }
}

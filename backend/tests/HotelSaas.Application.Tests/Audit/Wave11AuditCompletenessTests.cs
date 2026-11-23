using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;
using HotelSaas.Application.Platform.Queries.GetPlatformAuditLogs;
using HotelSaas.Application.Staff.Commands.UpdateRole;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xunit;

namespace HotelSaas.Application.Tests.Audit;

/// <summary>
/// Isolated fast unit tests verifying Wave 11 Audit Log completeness, security auditing (LoginFailed,
/// RolePermission updates), actor/property/tenant search, TenantName hydration, 18 canonical actions,
/// and SePay webhook Prometheus metrics recording.
/// </summary>
public sealed class Wave11AuditCompletenessTests
{
    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Entries.Add((logLevel, formatter(state, exception)));
        }
    }

    private sealed class SpyMetricsRecorder : ISystemMetricsRecorder
    {
        public List<string> SepayStatuses { get; } = new();
        public List<string> RateLimitPolicies { get; } = new();

        public void RecordVnpayIpnResult(string rspCode) { }
        public void IncrementSignalRConnection() { }
        public void DecrementSignalRConnection() { }
        public void RecordIsolationBlock(string errorCode) { }
        public void RecordSepayWebhook(string status) => SepayStatuses.Add(status);
        public void RecordRateLimited(string policy) => RateLimitPolicies.Add(policy);
    }

    private sealed class NoopTransaction : IDbContextTransaction
    {
        public Guid TransactionId { get; } = Guid.NewGuid();
        public void Commit() { }
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Dispose() { }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Rollback() { }
        public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class EfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;
        private EfExpressionRewriter(IQueryable effectiveRoot) => _effectiveRoot = effectiveRoot;

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new EfExpressionRewriter(effectiveRoot).Visit(expression);

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking" or "Include" or "ThenInclude" or "AsSplitQuery")
            {
                return Visit(node.Arguments[0]);
            }

            return base.VisitMethodCall(node);
        }

        protected override Expression VisitConstant(ConstantExpression node)
        {
            if (node.Value != null && node.Value.GetType().IsGenericType)
            {
                var genDef = node.Value.GetType().GetGenericTypeDefinition();
                if (genDef == typeof(InMemoryAsyncDbSet<>) || genDef == typeof(InMemoryAsyncQueryable<>))
                {
                    return _effectiveRoot.Expression;
                }
            }

            return base.VisitConstant(node);
        }
    }

    private sealed class InMemoryAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public InMemoryAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private sealed class InMemoryAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        public InMemoryAsyncQueryProvider(List<TEntity> backingData) => _backingData = backingData;

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(InMemoryAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new InMemoryAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = _backingData.AsQueryable();
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = _backingData.AsQueryable();
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = _backingData.AsQueryable();
            var rewritten = EfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class InMemoryAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;
        public InMemoryAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator() => _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TElement>(GetEnumerator());
    }

    private sealed class InMemoryAsyncDbSet<TEntity> : DbSet<TEntity>, IQueryable<TEntity>, IAsyncEnumerable<TEntity>
        where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly InMemoryAsyncQueryProvider<TEntity> _provider;
        private readonly Expression _expression;

        public InMemoryAsyncDbSet(List<TEntity> backingData)
        {
            _backingData = backingData;
            _provider = new InMemoryAsyncQueryProvider<TEntity>(backingData);
            _expression = Expression.Constant(this);
        }

        public override Microsoft.EntityFrameworkCore.Metadata.IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator() => _backingData.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default)
            => new InMemoryAsyncEnumerator<TEntity>(GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _backingData.Add(entity);
            return null!;
        }

        public override void RemoveRange(IEnumerable<TEntity> entities)
        {
            foreach (var item in entities.ToList())
            {
                _backingData.Remove(item);
            }
        }
    }

    private sealed class FakeAuditDbContext : IApplicationDbContext
    {
        public List<User> UserList { get; } = new();
        public List<RefreshToken> RefreshTokenList { get; } = new();
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<AccessRole> AccessRoleList { get; } = new();
        public List<PermissionFunction> PermissionFunctionList { get; } = new();
        public List<RolePermission> RolePermissionList { get; } = new();
        public List<TenantStaff> TenantStaffList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<Payment> PaymentList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();
        public List<Subscription> SubscriptionList { get; } = new();
        public List<SubscriptionPayment> SubscriptionPaymentList { get; } = new();

        public DbSet<User> Users => new InMemoryAsyncDbSet<User>(UserList);
        public DbSet<RefreshToken> RefreshTokens => new InMemoryAsyncDbSet<RefreshToken>(RefreshTokenList);
        public DbSet<Tenant> Tenants => new InMemoryAsyncDbSet<Tenant>(TenantList);
        public DbSet<Property> Properties => new InMemoryAsyncDbSet<Property>(PropertyList);
        public DbSet<AccessRole> AccessRoles => new InMemoryAsyncDbSet<AccessRole>(AccessRoleList);
        public DbSet<PermissionFunction> PermissionFunctions => new InMemoryAsyncDbSet<PermissionFunction>(PermissionFunctionList);
        public DbSet<RolePermission> RolePermissions => new InMemoryAsyncDbSet<RolePermission>(RolePermissionList);
        public DbSet<TenantStaff> TenantStaffMembers => new InMemoryAsyncDbSet<TenantStaff>(TenantStaffList);
        public DbSet<AuditLog> AuditLogs => new InMemoryAsyncDbSet<AuditLog>(AuditLogList);
        public DbSet<Reservation> Reservations => new InMemoryAsyncDbSet<Reservation>(ReservationList);
        public DbSet<Payment> Payments => new InMemoryAsyncDbSet<Payment>(PaymentList);
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => new InMemoryAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList);
        public DbSet<Subscription> Subscriptions => new InMemoryAsyncDbSet<Subscription>(SubscriptionList);
        public DbSet<SubscriptionPayment> SubscriptionPayments => new InMemoryAsyncDbSet<SubscriptionPayment>(SubscriptionPaymentList);

        public DbSet<RoomType> RoomTypes => new InMemoryAsyncDbSet<RoomType>(new());
        public DbSet<Room> Rooms => new InMemoryAsyncDbSet<Room>(new());
        public DbSet<SubscriptionPlan> SubscriptionPlans => new InMemoryAsyncDbSet<SubscriptionPlan>(new());
        public DbSet<SystemBanner> SystemBanners => new InMemoryAsyncDbSet<SystemBanner>(new());
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => new InMemoryAsyncDbSet<PropertySurchargePolicy>(new());
        public DbSet<RoomTypeRate> RoomTypeRates => new InMemoryAsyncDbSet<RoomTypeRate>(new());
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => new InMemoryAsyncDbSet<RoomTypeRateAudit>(new());
        public DbSet<Invoice> Invoices => new InMemoryAsyncDbSet<Invoice>(new());
        public DbSet<InvoiceItem> InvoiceItems => new InMemoryAsyncDbSet<InvoiceItem>(new());
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => new InMemoryAsyncDbSet<GuestLoyaltyMembership>(new());
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => new InMemoryAsyncDbSet<LoyaltyPointTransaction>(new());
        public DbSet<TenantContract> TenantContracts => new InMemoryAsyncDbSet<TenantContract>(new());
        public DbSet<SocialIdentity> SocialIdentities => new InMemoryAsyncDbSet<SocialIdentity>(new());
        public DbSet<GuestReview> GuestReviews => new InMemoryAsyncDbSet<GuestReview>(new());
        public DbSet<AiUsageLog> AiUsageLogs => new InMemoryAsyncDbSet<AiUsageLog>(new());

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default)
            => Task.FromResult(1);
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
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
        public string Email { get; set; } = "owner@hotel.vn";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Owner;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public string? IpAddress { get; set; } = "203.113.10.22";

        public void SetIpAddress(string? ipAddress) => IpAddress = ipAddress;
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide)
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
        public Task<MembershipLookupResult> ResolveMembershipAsync(Guid tenantId, Guid userId, Guid? targetPropertyId, CancellationToken cancellationToken = default)
            => Task.FromResult(MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, targetPropertyId, isTenantWide: true));
    }

    private sealed class StubPasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"HASH::{password}";
        public bool Verify(string password, string hash) => hash == $"HASH::{password}";
    }

    private sealed class StubJwtService : IJwtService
    {
        public (string accessToken, string refreshToken, DateTime expiresAtUtc) GenerateTokens(
            Guid userId, string email, string fullName, string globalRole, Guid? tenantId,
            IReadOnlyList<string>? permissions, Guid? propertyId = null, string? scope = null, string? staffRole = null)
            => ("access", "refresh", DateTime.UtcNow.AddMinutes(30));
        public string GenerateRefreshToken() => "refresh";
        public int GetRefreshTokenExpirationDays() => 7;
        public System.Security.Claims.ClaimsPrincipal GetPrincipalFromExpiredToken(string token) => new();
        public string GenerateEmailVerificationToken(Guid userId, string email, TimeSpan validity) => "verify";
        public (bool isValid, Guid userId, string email) ValidateEmailVerificationToken(string token) => (false, Guid.Empty, string.Empty);
    }

    private sealed class StubHostEnvironment : IHostEnvironment
    {
        public StubHostEnvironment(string envName) => EnvironmentName = envName;
        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "HotelSaas.WebApi";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class DummySender : ISender
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            if (typeof(TResponse) == typeof(ProcessSepayWebhookResult))
            {
                object res = new ProcessSepayWebhookResult("unauthorized", "Unauthorized SePay API key.");
                return Task.FromResult((TResponse)res);
            }

            throw new NotSupportedException();
        }
        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
            => throw new NotSupportedException();
        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    [Fact]
    public async Task LoginCommandHandler_FailedAttempts_EmitWarningAndAuditLog_WithoutLeakingPassword()
    {
        var db = new FakeAuditDbContext();
        var tenantId = Guid.NewGuid();
        var activeStaff = new User
        {
            Id = Guid.NewGuid(),
            Email = "manager@luxestay.vn",
            Username = "manager",
            FullName = "Nguyen Manager",
            PasswordHash = "HASH::CorrectPass#123",
            GlobalRole = GlobalUserRole.TenantStaff,
            TenantId = tenantId,
            IsActive = true
        };
        var lockedUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "locked@luxestay.vn",
            Username = "locked",
            FullName = "Locked User",
            PasswordHash = "HASH::LockedPass#123",
            GlobalRole = GlobalUserRole.Customer,
            TenantId = null,
            IsActive = false
        };
        db.UserList.AddRange(new[] { activeStaff, lockedUser });

        var logger = new CapturingLogger<LoginCommandHandler>();
        var userCtx = new StubUserContext { IpAddress = "113.161.22.99" };
        var handler = new LoginCommandHandler(db, new StubPasswordHasher(), new StubJwtService(), logger, userCtx);

        // 1. Wrong password on active tenant user
        const string wrongSecret = "SuperSecretWrongPass!987";
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(new LoginCommand("manager@luxestay.vn", wrongSecret), CancellationToken.None));

        // 2. Inactive account (null TenantId -> Guid.Empty)
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(new LoginCommand("locked@luxestay.vn", "LockedPass#123"), CancellationToken.None));

        // 3. Unknown email
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(new LoginCommand("nobody@luxestay.vn", "AnotherSecret!111"), CancellationToken.None));

        Assert.Equal(3, logger.Entries.Count(e => e.Level == LogLevel.Warning));
        Assert.All(logger.Entries, e =>
        {
            Assert.DoesNotContain(wrongSecret, e.Message);
            Assert.DoesNotContain("LockedPass#123", e.Message);
            Assert.DoesNotContain("AnotherSecret!111", e.Message);
        });

        Assert.Equal(3, db.AuditLogList.Count);
        Assert.All(db.AuditLogList, a =>
        {
            Assert.Equal("Auth", a.EntityName);
            Assert.Equal(AuditActions.LoginFailed, a.Action);
            Assert.Equal("113.161.22.99", a.IpAddress);
            Assert.DoesNotContain(wrongSecret, a.NewValues ?? string.Empty);
            Assert.DoesNotContain("LockedPass#123", a.NewValues ?? string.Empty);
            Assert.DoesNotContain("AnotherSecret!111", a.NewValues ?? string.Empty);
        });

        var staffAudit = Assert.Single(db.AuditLogList, a => a.UserId == activeStaff.Id);
        Assert.Equal(tenantId, staffAudit.TenantId);
        Assert.Contains("InvalidPassword", staffAudit.NewValues);

        var lockedAudit = Assert.Single(db.AuditLogList, a => a.UserId == lockedUser.Id);
        Assert.Equal(Guid.Empty, lockedAudit.TenantId);
        Assert.Contains("AccountInactive", lockedAudit.NewValues);
    }

    [Fact]
    public async Task UpdateRoleCommandHandler_WhenOnlyPermissionsChange_PersistsExplicitAccessRoleAuditLog()
    {
        var db = new FakeAuditDbContext();
        var tenantId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var funcBookings = new PermissionFunction { Id = Guid.NewGuid(), Code = "RESERVATIONS", Name = "Reservations", ModuleCode = "PMS" };
        var funcPayments = new PermissionFunction { Id = Guid.NewGuid(), Code = "PAYMENTS", Name = "Payments", ModuleCode = "FINANCE" };
        db.PermissionFunctionList.AddRange(new[] { funcBookings, funcPayments });

        var existingPerm = new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = roleId,
            FunctionId = funcBookings.Id,
            Function = funcBookings,
            ActionMask = 1
        };
        var role = new AccessRole
        {
            Id = roleId,
            TenantId = tenantId,
            Code = "FRONT_DESK",
            Name = "Front Desk",
            Description = "Front desk role",
            IsSystemRole = false,
            Permissions = new List<RolePermission> { existingPerm }
        };
        db.AccessRoleList.Add(role);
        db.RolePermissionList.Add(existingPerm);

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var userCtx = new StubUserContext { UserId = actorId, TenantId = tenantId, IpAddress = "10.20.30.40" };
        var handler = new UpdateRoleCommandHandler(db, tenantSvc, userCtx);

        // Keep Name and Description 100% IDENTICAL, only grant PAYMENTS Read+Approve (17)
        await handler.Handle(new UpdateRoleCommand
        {
            Id = roleId,
            Name = "Front Desk",
            Description = "Front desk role",
            Permissions = new[]
            {
                new RolePermissionInput { FunctionId = funcBookings.Id, CanRead = true },
                new RolePermissionInput { FunctionId = funcPayments.Id, CanRead = true, CanApprove = true }
            }
        }, CancellationToken.None);

        var audit = Assert.Single(db.AuditLogList);
        Assert.Equal(nameof(AccessRole), audit.EntityName);
        Assert.Equal(AuditActions.Update, audit.Action);
        Assert.Equal(roleId, audit.EntityId);
        Assert.Equal(tenantId, audit.TenantId);
        Assert.Equal(actorId, audit.UserId);
        Assert.Equal("10.20.30.40", audit.IpAddress);
        Assert.Contains("RESERVATIONS:1", audit.OldValues);
        Assert.Contains("PAYMENTS:17", audit.NewValues);
    }

    [Fact]
    public async Task AuditLogQueries_Support18CanonicalActions_ActorAndPropertySearch_AndTenantName()
    {
        // 1. Verify all 18 canonical actions including LoginFailed pass GetAuditLogsQueryValidator
        var canonicalActions = new[]
        {
            "Create", "Update", "Delete",
            "NightAuditAutoNoShow", "Reschedule", "MarkNoShow",
            "RegenerateSmartLockPin", "RevokeSmartLockPin",
            "CheckInDepositWarning", "OverrideLateCheckOutSurcharge",
            "ApproveRefund", "RejectRefund", "ConfirmRefundPayout",
            "Cancel", "StatusToggle", "PublishApproval", "Upgrade", "LoginFailed"
        };
        Assert.Equal(18, canonicalActions.Length);
        var validator = new GetAuditLogsQueryValidator();
        foreach (var action in canonicalActions)
        {
            var res = await validator.ValidateAsync(new GetAuditLogsQuery(Action: action));
            Assert.True(res.IsValid, $"Canonical action '{action}' should be valid.");
        }
        Assert.False((await validator.ValidateAsync(new GetAuditLogsQuery(Action: "InvalidAction"))).IsValid);

        // 2. Seed multi-tenant audit logs + users + properties + tenants
        var db = new FakeAuditDbContext();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var propSaigon = Guid.NewGuid();
        var propDanang = Guid.NewGuid();
        var staffLan = Guid.NewGuid();
        var staffMinh = Guid.NewGuid();

        db.TenantList.AddRange(new[]
        {
            new Tenant { Id = tenantA, Name = "Aurora Luxury Hotels", Code = "AUR", Slug = "aurora" },
            new Tenant { Id = tenantB, Name = "Mekong Riverside Group", Code = "MKG", Slug = "mekong" }
        });
        db.PropertyList.AddRange(new[]
        {
            new Property { Id = propSaigon, TenantId = tenantA, Name = "Aurora Sài Gòn Q1", Code = "AUR-SG" },
            new Property { Id = propDanang, TenantId = tenantB, Name = "Mekong Đà Nẵng Beach", Code = "MKG-DN" }
        });
        db.UserList.AddRange(new[]
        {
            new User { Id = staffLan, FullName = "Trần Thị Lan Anh", Email = "lan.anh@aurora.vn" },
            new User { Id = staffMinh, FullName = "Lê Hoàng Minh", Email = "minh.le@mekong.vn" }
        });

        var logA = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            PropertyId = propSaigon,
            UserId = staffLan,
            Action = AuditActions.ApproveRefund,
            EntityName = nameof(Payment),
            EntityId = Guid.NewGuid(),
            NewValues = "{\"Status\":\"Approved\",\"PasswordHash\":\"DO_NOT_SEARCH_ME_999\"}",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-2)
        };
        var logB = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantB,
            PropertyId = propDanang,
            UserId = staffMinh,
            Action = AuditActions.Cancel,
            EntityName = nameof(Reservation),
            EntityId = Guid.NewGuid(),
            NewValues = "{\"Status\":\"Cancelled\"}",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-1)
        };
        var logPlatform = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            PropertyId = null,
            UserId = null,
            Action = AuditActions.LoginFailed,
            EntityName = "Auth",
            EntityId = Guid.Empty,
            NewValues = "{\"Email\":\"hacker@bad.test\",\"Reason\":\"InvalidPassword\"}",
            CreatedAtUtc = DateTime.UtcNow
        };
        db.AuditLogList.AddRange(new[] { logA, logB, logPlatform });

        // 3. Tenant-scoped GetAuditLogsQueryHandler: searches by UserFullName, UserEmail, PropertyName (case-insensitive)
        var tenantSvc = new StubTenantService { TenantId = tenantA };
        var propSvc = new StubPropertyService { IsTenantWide = true };
        var ownerCtx = new StubUserContext { UserId = staffLan, TenantId = tenantA, StaffRole = StaffRole.Owner };
        var tenantHandler = new GetAuditLogsQueryHandler(db, tenantSvc, propSvc, ownerCtx, new StubMembershipLookupService());

        Assert.Single((await tenantHandler.Handle(new GetAuditLogsQuery(Search: "lan anh"), CancellationToken.None)).Data!.Items);
        Assert.Single((await tenantHandler.Handle(new GetAuditLogsQuery(Search: "LAN.ANH@AURORA.VN"), CancellationToken.None)).Data!.Items);
        Assert.Single((await tenantHandler.Handle(new GetAuditLogsQuery(Search: "sài gòn q1"), CancellationToken.None)).Data!.Items);
        // Secret inference remains blocked
        Assert.Empty((await tenantHandler.Handle(new GetAuditLogsQuery(Search: "DO_NOT_SEARCH_ME_999"), CancellationToken.None)).Data!.Items);

        // 4. Platform-wide GetPlatformAuditLogsQueryHandler: populates TenantName, filters by TenantId/Action=LoginFailed, searches actor/property/tenant
        var superAdminCtx = new StubUserContext { UserId = Guid.NewGuid(), GlobalRole = GlobalUserRole.SuperAdmin };
        var platformHandler = new GetPlatformAuditLogsQueryHandler(db, superAdminCtx);

        var allPlatform = await platformHandler.Handle(new GetPlatformAuditLogsQuery(Page: 1, PageSize: 20), CancellationToken.None);
        Assert.Equal(3, allPlatform.Data!.TotalCount);
        Assert.Equal("Nền tảng SaaS", allPlatform.Data.Items.Single(i => i.Id == logPlatform.Id).TenantName);
        Assert.Equal("Aurora Luxury Hotels", allPlatform.Data.Items.Single(i => i.Id == logA.Id).TenantName);
        Assert.Equal("Mekong Riverside Group", allPlatform.Data.Items.Single(i => i.Id == logB.Id).TenantName);

        var byActorEmail = await platformHandler.Handle(new GetPlatformAuditLogsQuery(Search: "minh.le@mekong.vn"), CancellationToken.None);
        Assert.Single(byActorEmail.Data!.Items);
        Assert.Equal(logB.Id, byActorEmail.Data.Items[0].Id);

        var byPropertyName = await platformHandler.Handle(new GetPlatformAuditLogsQuery(Search: "Đà Nẵng Beach"), CancellationToken.None);
        Assert.Single(byPropertyName.Data!.Items);
        Assert.Equal(logB.Id, byPropertyName.Data.Items[0].Id);

        var byLoginFailed = await platformHandler.Handle(new GetPlatformAuditLogsQuery(Action: AuditActions.LoginFailed), CancellationToken.None);
        Assert.Single(byLoginFailed.Data!.Items);
        Assert.Equal(logPlatform.Id, byLoginFailed.Data.Items[0].Id);

        var byTenantFilter = await platformHandler.Handle(new GetPlatformAuditLogsQuery(TenantId: tenantB), CancellationToken.None);
        Assert.Single(byTenantFilter.Data!.Items);
        Assert.Equal(logB.Id, byTenantFilter.Data.Items[0].Id);

        // 5. Detail endpoint also populates TenantName
        var detailHandler = new GetPlatformAuditLogByIdQueryHandler(db, superAdminCtx);
        var detailResp = await detailHandler.Handle(new GetPlatformAuditLogByIdQuery(logA.Id), CancellationToken.None);
        Assert.Equal("Aurora Luxury Hotels", detailResp.Data!.TenantName);
    }

    [Fact]
    public async Task SepayWebhook_RecordsMetricsOnAuthFailedAndHandlerOutcomes()
    {
        var metrics = new SpyMetricsRecorder();
        var logger = new CapturingLogger<WebhooksController>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Payment:Sepay:ApiKey"] = "valid-test-key" })
            .Build();

        var controller = new WebhooksController(
            new DummySender(),
            config,
            new StubHostEnvironment(Environments.Production),
            logger,
            metrics)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Items["CorrelationId"] = "corr-sepay-401";
        controller.HttpContext.Request.Headers["Authorization"] = "Apikey bad-key";

        var unauthRes = await controller.HandleSepayWebhook(new SepayWebhookPayload { Id = 999 }, CancellationToken.None);
        var unauthObj = Assert.IsType<UnauthorizedObjectResult>(unauthRes);
        var err = Assert.IsType<SepayWebhookErrorResponse>(unauthObj.Value);
        Assert.Equal("corr-sepay-401", err.CorrelationId);
        Assert.Contains("auth_failed", metrics.SepayStatuses);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("corr-sepay-401"));

        // Handler metrics recording on ignored transfer
        var db = new FakeAuditDbContext();
        var handler = new ProcessSepayWebhookCommandHandler(db, metricsRecorder: metrics);
        var res = await handler.Handle(new ProcessSepayWebhookCommand(
            Id: 12345,
            Gateway: "MBBank",
            TransactionDate: "2026-11-23 10:00:00",
            AccountNumber: "0987654321",
            SubAccount: null,
            Code: null,
            Content: "OUTGOING",
            TransferType: "out",
            Description: null,
            TransferAmount: 100_000m,
            Accumulated: null,
            ReferenceCode: "FT-1"), CancellationToken.None);

        Assert.Equal("ignored", res.Status);
        Assert.Contains("ignored", metrics.SepayStatuses);
    }
}

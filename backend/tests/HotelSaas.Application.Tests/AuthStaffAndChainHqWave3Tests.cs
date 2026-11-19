using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.Auth.Commands.ChangePassword;
using HotelSaas.Application.Auth.Commands.ForgotPassword;
using HotelSaas.Application.Auth.Commands.GoogleLogin;
using HotelSaas.Application.Auth.Commands.LinkSocialAccount;
using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RefreshToken;
using HotelSaas.Application.Auth.Commands.ResendConfirmation;
using HotelSaas.Application.Auth.Commands.ResetPassword;
using HotelSaas.Application.Auth.Commands.UnlinkSocialAccount;
using HotelSaas.Application.Auth.Queries.GetSocialIdentities;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.Queries.GetRooms;
using HotelSaas.Application.Staff.Commands.CreateStaffMember;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.Application.Tests;

/// <summary>
/// Wave 3 (T022 + T023) unit & behavioral test suite verifying:
/// - RoomDto PropertyName hydration
/// - Non-UUID audit log search (safe jsonb in-memory matching with sanitization enforcement)
/// - Forgot / Reset / Change Password & single-use PasswordHash fingerprint invalidation
/// - Resend Confirmation & Social Account Link / Unlink lockout safeguards
/// - CreateStaffMember cryptographic random invite flow, quota guard, and explicit Customer promotion confirmation
/// - Consistent PhoneNumber / IsPhoneVerified / IsEmailVerified flags across Auth UserDtos
/// </summary>
public sealed class AuthStaffAndChainHqWave3Tests
{
    #region In-Memory Filter-Aware Test Harness

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
        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; }
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
            IsAuthenticated = userId != Guid.Empty;
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
        public MembershipLookupResult ResultToReturn { get; set; } =
            MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, null, true);

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(ResultToReturn);
    }

    private sealed class StubPasswordHasher : IPasswordHasher
    {
        public List<string> RawPasswordsHashed { get; } = new();

        public string Hash(string password)
        {
            RawPasswordsHashed.Add(password);
            return $"HASH::{password}";
        }

        public bool Verify(string password, string hash)
            => string.Equals(hash, $"HASH::{password}", StringComparison.Ordinal);
    }

    private sealed class RecordingEmailService : IEmailService
    {
        public List<(string Email, string Name, string Url, long Expires)> VerificationEmails { get; } = new();
        public List<(string Email, string Name, string Url, long Expires)> PasswordResetEmails { get; } = new();
        public List<(string Email, string Name, string Url, long Expires)> StaffInvitationEmails { get; } = new();

        public Task<bool> SendVerificationEmailAsync(
            string targetEmail,
            string customerName,
            string verificationUrl,
            long expiresInMinutes = 30,
            CancellationToken cancellationToken = default)
        {
            VerificationEmails.Add((targetEmail, customerName, verificationUrl, expiresInMinutes));
            return Task.FromResult(true);
        }

        public Task<bool> SendWelcomeEmailAsync(
            string targetEmail,
            string customerName,
            CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> SendPasswordResetEmailAsync(
            string targetEmail,
            string customerName,
            string resetUrl,
            long expiresInMinutes = 30,
            CancellationToken cancellationToken = default)
        {
            PasswordResetEmails.Add((targetEmail, customerName, resetUrl, expiresInMinutes));
            return Task.FromResult(true);
        }

        public Task<bool> SendStaffInvitationEmailAsync(
            string targetEmail,
            string staffName,
            string setupPasswordUrl,
            long expiresInMinutes = 1440,
            CancellationToken cancellationToken = default)
        {
            StaffInvitationEmails.Add((targetEmail, staffName, setupPasswordUrl, expiresInMinutes));
            return Task.FromResult(true);
        }
    }

    private sealed class StubQuotaGuard : ISubscriptionQuotaGuard
    {
        public bool ThrowOnCreateStaff { get; set; }
        public int StaffQuotaChecks { get; private set; }

        public Task EnsureCanCreatePropertyAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task EnsureCanCreateRoomAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task EnsureCanCreateStaffAsync(Guid tenantId, CancellationToken cancellationToken = default)
        {
            StaffQuotaChecks++;
            if (ThrowOnCreateStaff)
            {
                throw new ForbiddenException("ERR_QUOTA_STAFF_LIMIT", "Đã đạt giới hạn nhân sự của gói đăng ký.");
            }
            return Task.CompletedTask;
        }
    }

    private sealed class StubGoogleAuthService : IGoogleAuthService
    {
        public GoogleTokenVerificationResult Result { get; set; } =
            new(true, "google-sub-1", "guest@gmail.com", "Google Guest", "https://avatar.test/pic.png");

        public Task<GoogleTokenVerificationResult> VerifyGoogleTokenAsync(
            string idToken,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Result);
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

    private sealed class FilterAwareEfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _effectiveRoot;

        private FilterAwareEfExpressionRewriter(IQueryable effectiveRoot)
        {
            _effectiveRoot = effectiveRoot;
        }

        public static bool HasIgnoreQueryFilters(Expression expression)
        {
            var finder = new MethodFinder("IgnoreQueryFilters");
            finder.Visit(expression);
            return finder.Found;
        }

        public static Expression Rewrite(Expression expression, IQueryable effectiveRoot)
            => new FilterAwareEfExpressionRewriter(effectiveRoot).Visit(expression);

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
                if (genDef == typeof(FilterAwareAsyncDbSet<>) || genDef == typeof(FilterAwareAsyncQueryable<>))
                {
                    return _effectiveRoot.Expression;
                }
            }

            return base.VisitConstant(node);
        }

        private sealed class MethodFinder : ExpressionVisitor
        {
            private readonly string _methodName;
            public bool Found { get; private set; }
            public MethodFinder(string methodName) => _methodName = methodName;
            protected override Expression VisitMethodCall(MethodCallExpression node)
            {
                if (node.Method.Name == _methodName) Found = true;
                return base.VisitMethodCall(node);
            }
        }
    }

    private sealed class FilterAwareAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _backingData;
        private readonly ICurrentTenantService _tenantService;

        public FilterAwareAsyncQueryProvider(List<TEntity> backingData, ICurrentTenantService tenantService)
        {
            _backingData = backingData;
            _tenantService = tenantService;
        }

        private IQueryable<TEntity> ResolveEffectiveQueryable(Expression expression)
        {
            var isScoped = typeof(ITenantScopedEntity).IsAssignableFrom(typeof(TEntity)) ||
                           typeof(IPropertyScopedEntity).IsAssignableFrom(typeof(TEntity));

            if (!isScoped || FilterAwareEfExpressionRewriter.HasIgnoreQueryFilters(expression))
            {
                return _backingData.AsQueryable();
            }

            if (!_tenantService.TenantId.HasValue)
            {
                return Array.Empty<TEntity>().AsQueryable();
            }

            var tenantId = _tenantService.TenantId.Value;
            return _backingData
                .Where(e => ((ITenantScopedEntity)e).TenantId == tenantId)
                .AsQueryable();
        }

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(FilterAwareAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
            => new FilterAwareAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            return effective.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var effective = ResolveEffectiveQueryable(expression);
            var rewritten = FilterAwareEfExpressionRewriter.Rewrite(expression, effective);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(effective.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class FilterAwareAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public FilterAwareAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator()
            => _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new AsyncEnumeratorWrapper<TElement>(GetEnumerator());
        }
    }

    private sealed class AsyncEnumeratorWrapper<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public AsyncEnumeratorWrapper(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
    }

    private sealed class FilterAwareAsyncDbSet<T> : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly List<T> _data;
        private readonly IQueryable<T> _rootQueryable;
        private readonly FilterAwareAsyncQueryProvider<T> _provider;

        public FilterAwareAsyncDbSet(List<T> data, ICurrentTenantService tenantService)
        {
            _data = data;
            _rootQueryable = _data.AsQueryable();
            _provider = new FilterAwareAsyncQueryProvider<T>(_data, tenantService);
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _rootQueryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        public override EntityEntry<T> Add(T entity)
        {
            _data.Add(entity);
            return null!;
        }

        public override EntityEntry<T> Remove(T entity)
        {
            _data.Remove(entity);
            return null!;
        }

        public override void RemoveRange(IEnumerable<T> entities)
        {
            foreach (var entity in entities.ToList())
            {
                _data.Remove(entity);
            }
        }

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            var enumerable = _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression);
            return new AsyncEnumeratorWrapper<T>(enumerable.GetEnumerator());
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator()
            => _provider.Execute<IEnumerable<T>>(_rootQueryable.Expression).GetEnumerator();
    }

    private sealed class FakeWave3DbContext : IApplicationDbContext
    {
        public List<User> UserList { get; } = new();
        public List<RefreshToken> RefreshTokenList { get; } = new();
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<AccessRole> AccessRoleList { get; } = new();
        public List<PermissionFunction> PermissionFunctionList { get; } = new();
        public List<RolePermission> RolePermissionList { get; } = new();
        public List<TenantStaff> TenantStaffList { get; } = new();
        public List<RoomType> RoomTypeList { get; } = new();
        public List<Room> RoomList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();
        public List<SocialIdentity> SocialIdentityList { get; } = new();
        public List<GuestLoyaltyMembership> LoyaltyMembershipList { get; } = new();

        public FakeWave3DbContext(ICurrentTenantService tenantService)
        {
            Users = new FilterAwareAsyncDbSet<User>(UserList, tenantService);
            RefreshTokens = new FilterAwareAsyncDbSet<RefreshToken>(RefreshTokenList, tenantService);
            Tenants = new FilterAwareAsyncDbSet<Tenant>(TenantList, tenantService);
            Properties = new FilterAwareAsyncDbSet<Property>(PropertyList, tenantService);
            AccessRoles = new FilterAwareAsyncDbSet<AccessRole>(AccessRoleList, tenantService);
            PermissionFunctions = new FilterAwareAsyncDbSet<PermissionFunction>(PermissionFunctionList, tenantService);
            RolePermissions = new FilterAwareAsyncDbSet<RolePermission>(RolePermissionList, tenantService);
            TenantStaffMembers = new FilterAwareAsyncDbSet<TenantStaff>(TenantStaffList, tenantService);
            RoomTypes = new FilterAwareAsyncDbSet<RoomType>(RoomTypeList, tenantService);
            Rooms = new FilterAwareAsyncDbSet<Room>(RoomList, tenantService);
            AuditLogs = new FilterAwareAsyncDbSet<AuditLog>(AuditLogList, tenantService);
            SocialIdentities = new FilterAwareAsyncDbSet<SocialIdentity>(SocialIdentityList, tenantService);
            GuestLoyaltyMemberships = new FilterAwareAsyncDbSet<GuestLoyaltyMembership>(LoyaltyMembershipList, tenantService);
        }

        public DbSet<User> Users { get; }
        public DbSet<RefreshToken> RefreshTokens { get; }
        public DbSet<Tenant> Tenants { get; }
        public DbSet<Property> Properties { get; }
        public DbSet<AccessRole> AccessRoles { get; }
        public DbSet<PermissionFunction> PermissionFunctions { get; }
        public DbSet<RolePermission> RolePermissions { get; }
        public DbSet<TenantStaff> TenantStaffMembers { get; }
        public DbSet<RoomType> RoomTypes { get; }
        public DbSet<Room> Rooms { get; }
        public DbSet<AuditLog> AuditLogs { get; }
        public DbSet<SocialIdentity> SocialIdentities { get; }
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships { get; }

        public DbSet<Reservation> Reservations => throw new NotImplementedException();
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IDbContextTransaction>(new NoopTransaction());
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => Task.FromResult(1);
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private static IJwtService CreateJwtService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "SuperSecretKeyForWave3AuthAndResetTesting1234567890!",
            ["JwtSettings:Issuer"] = "HotelSaas",
            ["JwtSettings:Audience"] = "HotelSaasClient",
            ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
            ["JwtSettings:RefreshTokenExpirationDays"] = "7"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new JwtService(config);
    }

    #endregion

    [Fact]
    public async Task GetRoomsQueryHandler_PopulatesPropertyName_FromPropertyNavigation()
    {
        var tenantId = Guid.NewGuid();
        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var db = new FakeWave3DbContext(tenantSvc);

        var propSgn = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Hotel Saigon Center", Code = "SGN", Status = PropertyStatus.Active };
        var propHan = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Hotel Hanoi Old Quarter", Code = "HAN", Status = PropertyStatus.Active };
        var rt1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propSgn.Id, Name = "Deluxe", Code = "DLX" };
        var rt2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propHan.Id, Name = "Suite", Code = "STE" };

        db.PropertyList.AddRange(new[] { propSgn, propHan });
        db.RoomTypeList.AddRange(new[] { rt1, rt2 });
        db.RoomList.AddRange(new[]
        {
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propSgn.Id, Property = propSgn, RoomTypeId = rt1.Id, RoomType = rt1, RoomNumber = "101", Floor = 1 },
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propHan.Id, Property = propHan, RoomTypeId = rt2.Id, RoomType = rt2, RoomNumber = "201", Floor = 2 }
        });

        var handler = new GetRoomsQueryHandler(db);
        var result = await handler.Handle(new GetRoomsQuery(), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Contains(result.Items, r => r.RoomNumber == "101" && r.PropertyName == "Hotel Saigon Center");
        Assert.Contains(result.Items, r => r.RoomNumber == "201" && r.PropertyName == "Hotel Hanoi Old Quarter");
    }

    [Fact]
    public async Task GetAuditLogsQueryHandler_Search_MatchesKeywordsAcrossFieldsAndBlocksSecretInference()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var targetEntityId = Guid.NewGuid();

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var db = new FakeWave3DbContext(tenantSvc);

        db.UserList.Add(new User { Id = actorId, Email = "owner@hotel.vn", FullName = "Nguyen Owner" });
        db.PropertyList.Add(new Property { Id = propId, TenantId = tenantId, Name = "Main Branch", Code = "MB1", Status = PropertyStatus.Active });

        db.AuditLogList.AddRange(new[]
        {
            new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                UserId = actorId,
                Action = "Update",
                EntityName = "RoomTypeRate",
                EntityId = targetEntityId,
                OldValues = "{\"BasePrice\":500000}",
                NewValues = "{\"BasePrice\":750000,\"PasswordHash\":\"TOP_SECRET_HASH_XYZ\"}",
                IpAddress = "203.113.10.5",
                CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
            },
            new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                UserId = actorId,
                Action = "Create",
                EntityName = "Reservation",
                EntityId = Guid.NewGuid(),
                NewValues = "{\"GuestName\":\"Tran Van Khach\"}",
                IpAddress = "10.0.0.99",
                CreatedAtUtc = DateTime.UtcNow
            }
        });

        var propertySvc = new StubPropertyService { IsTenantWide = true };
        var userCtx = new StubUserContext { IsAuthenticated = true, UserId = actorId, TenantId = tenantId, GlobalRole = GlobalUserRole.TenantStaff, StaffRole = StaffRole.Owner };
        var membershipLookup = new StubMembershipLookupService
        {
            ResultToReturn = MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, null, true)
        };
        var handler = new GetAuditLogsQueryHandler(db, tenantSvc, propertySvc, userCtx, membershipLookup);

        // Non-UUID EntityName search
        var byEntity = await handler.Handle(new GetAuditLogsQuery(Search: "roomtyperate"), CancellationToken.None);
        Assert.Single(byEntity.Data!.Items);
        Assert.Equal(targetEntityId, byEntity.Data.Items[0].EntityId);

        // Payload jsonb sanitized search
        var byPayload = await handler.Handle(new GetAuditLogsQuery(Search: "750000"), CancellationToken.None);
        Assert.Single(byPayload.Data!.Items);

        // IP search
        var byIp = await handler.Handle(new GetAuditLogsQuery(Search: "203.113.10.5"), CancellationToken.None);
        Assert.Single(byIp.Data!.Items);

        // Security guard: searching redacted sensitive value must return zero results
        var bySecret = await handler.Handle(new GetAuditLogsQuery(Search: "TOP_SECRET_HASH_XYZ"), CancellationToken.None);
        Assert.Empty(bySecret.Data!.Items);
    }

    [Fact]
    public async Task ForgotAndResetPassword_ValidTokenWorksOnce_AndRevokesRefreshTokens()
    {
        var tenantSvc = new StubTenantService();
        var db = new FakeWave3DbContext(tenantSvc);
        var jwt = CreateJwtService();
        var email = new RecordingEmailService();
        var hasher = new StubPasswordHasher();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "staff@hotelsaas.vn",
            Username = "staff@hotelsaas.vn",
            FullName = "Nguyen Nhan Vien",
            PasswordHash = hasher.Hash("OldPass@123"),
            GlobalRole = GlobalUserRole.TenantStaff,
            IsActive = true
        };
        db.UserList.Add(user);

        db.RefreshTokenList.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = "active-refresh-1",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(5),
            RevokedAtUtc = null
        });

        // 1. Unknown email still succeeds generically without sending email
        var forgotHandler = new ForgotPasswordCommandHandler(db, jwt, email, NullLogger<ForgotPasswordCommandHandler>.Instance);
        var unknownRes = await forgotHandler.Handle(new ForgotPasswordCommand("nobody@hotelsaas.vn", "https://app.hotelsaas.vn"), CancellationToken.None);
        Assert.True(unknownRes.Success);
        Assert.Empty(email.PasswordResetEmails);

        // 2. Known user sends reset link containing token
        var knownRes = await forgotHandler.Handle(new ForgotPasswordCommand(user.Email, "https://app.hotelsaas.vn"), CancellationToken.None);
        Assert.True(knownRes.Success);
        Assert.Single(email.PasswordResetEmails);
        var sentUrl = email.PasswordResetEmails[0].Url;
        var tokenPrefix = "token=";
        var token = Uri.UnescapeDataString(sentUrl.Substring(sentUrl.IndexOf(tokenPrefix, StringComparison.Ordinal) + tokenPrefix.Length));

        // 3. ResetPassword updates hash and revokes active refresh tokens
        var resetHandler = new ResetPasswordCommandHandler(db, jwt, hasher);
        var resetRes = await resetHandler.Handle(new ResetPasswordCommand(token, "NewStrong@999"), CancellationToken.None);
        Assert.True(resetRes.Success);
        Assert.True(hasher.Verify("NewStrong@999", user.PasswordHash));
        Assert.NotNull(db.RefreshTokenList[0].RevokedAtUtc);

        // 4. Reusing the same reset token fails immediately because PasswordHash fingerprint changed
        await Assert.ThrowsAsync<BadRequestException>(() =>
            resetHandler.Handle(new ResetPasswordCommand(token, "AnotherStrong@888"), CancellationToken.None));
    }

    [Fact]
    public async Task ChangePassword_VerifiesCurrentPassword_AndRevokesRefreshTokens()
    {
        var db = new FakeWave3DbContext(new StubTenantService());
        var hasher = new StubPasswordHasher();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "user@hotelsaas.vn",
            FullName = "User Test",
            PasswordHash = hasher.Hash("Current@123"),
            IsActive = true
        };
        db.UserList.Add(user);
        db.RefreshTokenList.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = "rt-active",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(3)
        });

        var userCtx = new StubUserContext();
        userCtx.SetUser(user.Id, user.Email, GlobalUserRole.Customer);

        var handler = new ChangePasswordCommandHandler(db, userCtx, hasher);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new ChangePasswordCommand("Wrong@123", "NewPass@456"), CancellationToken.None));

        var res = await handler.Handle(new ChangePasswordCommand("Current@123", "NewPass@456"), CancellationToken.None);
        Assert.True(res.Success);
        Assert.True(hasher.Verify("NewPass@456", user.PasswordHash));
        Assert.NotNull(db.RefreshTokenList[0].RevokedAtUtc);
    }

    [Fact]
    public async Task ResendConfirmation_SendsOnlyWhenUnverified()
    {
        var db = new FakeWave3DbContext(new StubTenantService());
        var jwt = CreateJwtService();
        var email = new RecordingEmailService();

        var unverified = new User
        {
            Id = Guid.NewGuid(),
            Email = "pending@hotelsaas.vn",
            FullName = "Pending User",
            IsActive = true,
            EmailVerifiedAtUtc = null
        };
        var verified = new User
        {
            Id = Guid.NewGuid(),
            Email = "verified@hotelsaas.vn",
            FullName = "Verified User",
            IsActive = true,
            EmailVerifiedAtUtc = DateTime.UtcNow
        };
        db.UserList.AddRange(new[] { unverified, verified });

        var anonCtx = new StubUserContext { IsAuthenticated = false };
        var handler = new ResendConfirmationCommandHandler(db, anonCtx, jwt, email, NullLogger<ResendConfirmationCommandHandler>.Instance);

        var anonUnverified = await handler.Handle(new ResendConfirmationCommand(unverified.Email, "https://app.hotelsaas.vn"), CancellationToken.None);
        Assert.True(anonUnverified.Success);
        Assert.Single(email.VerificationEmails);

        var anonVerified = await handler.Handle(new ResendConfirmationCommand(verified.Email, "https://app.hotelsaas.vn"), CancellationToken.None);
        Assert.True(anonVerified.Success);
        Assert.Single(email.VerificationEmails); // No duplicate verification email sent
    }

    [Fact]
    public async Task SocialAccounts_LinkAndUnlink_PreventsLockoutWhenNoPasswordExists()
    {
        var db = new FakeWave3DbContext(new StubTenantService());
        var passwordlessUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "socialonly@gmail.com",
            FullName = "Social User",
            PasswordHash = string.Empty,
            IsActive = true
        };
        db.UserList.Add(passwordlessUser);

        var userCtx = new StubUserContext();
        userCtx.SetUser(passwordlessUser.Id, passwordlessUser.Email, GlobalUserRole.Customer);

        var googleSvc = new StubGoogleAuthService
        {
            Result = new GoogleTokenVerificationResult(true, "g-sub-99", "socialonly@gmail.com", "Social User", null)
        };

        var linkHandler = new LinkSocialAccountCommandHandler(db, userCtx, googleSvc);
        var linked = await linkHandler.Handle(new LinkSocialAccountCommand("valid-id-token", "Google"), CancellationToken.None);
        Assert.True(linked.Success);
        Assert.Equal("Google", linked.Data!.Provider);

        var queryHandler = new GetSocialIdentitiesQueryHandler(db, userCtx);
        var list = await queryHandler.Handle(new GetSocialIdentitiesQuery(), CancellationToken.None);
        Assert.False(list.Data!.HasPassword);
        Assert.Single(list.Data.Accounts);

        var unlinkHandler = new UnlinkSocialAccountCommandHandler(db, userCtx);
        // Must block removing last auth method when user has no password
        await Assert.ThrowsAsync<BadRequestException>(() =>
            unlinkHandler.Handle(new UnlinkSocialAccountCommand("Google"), CancellationToken.None));

        // After setting a local password, unlink must succeed
        passwordlessUser.PasswordHash = "HASH::Strong@123";
        var unlinked = await unlinkHandler.Handle(new UnlinkSocialAccountCommand("Google"), CancellationToken.None);
        Assert.True(unlinked.Success);
        Assert.Empty(db.SocialIdentityList);
    }

    [Fact]
    public async Task CreateStaffMember_BlankPasswordGeneratesRandomSecretAndInvite_AndRequiresCustomerConfirmation()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var db = new FakeWave3DbContext(tenantSvc);

        var role = new AccessRole { Id = Guid.NewGuid(), Code = "RECEPTIONIST", Name = "Receptionist", IsSystemRole = true };
        var prop = new Property { Id = propId, TenantId = tenantId, Name = "Branch SGN", Code = "SGN", Status = PropertyStatus.Active };
        db.AccessRoleList.Add(role);
        db.PropertyList.Add(prop);

        var existingCustomer = new User
        {
            Id = Guid.NewGuid(),
            Email = "loyal.customer@example.com",
            Username = "loyal.customer@example.com",
            FullName = "Loyal Guest",
            PasswordHash = "HASH::GuestPass123",
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        };
        db.UserList.Add(existingCustomer);

        var hasher = new StubPasswordHasher();
        var quotaGuard = new StubQuotaGuard();
        var jwt = CreateJwtService();
        var email = new RecordingEmailService();

        var handler = new CreateStaffMemberCommandHandler(db, tenantSvc, hasher, quotaGuard, jwt, email);

        // 1. Existing Customer without explicit confirmation -> Conflict ERR_CUSTOMER_ACCOUNT_EXISTS
        var conflictEx = await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CreateStaffMemberCommand
            {
                FullName = "Loyal Guest",
                Email = existingCustomer.Email,
                PropertyId = propId,
                StaffRole = StaffRole.Receptionist,
                ConfirmCustomerPromotion = false
            }, CancellationToken.None));
        Assert.Equal("ERR_CUSTOMER_ACCOUNT_EXISTS", conflictEx.ErrorCode);
        Assert.Equal(GlobalUserRole.Customer, existingCustomer.GlobalRole);

        // 2. Existing Customer with ConfirmCustomerPromotion = true -> succeeds
        var promotedDto = await handler.Handle(new CreateStaffMemberCommand
        {
            FullName = "Loyal Guest",
            Email = existingCustomer.Email,
            PropertyId = propId,
            StaffRole = StaffRole.Receptionist,
            ConfirmCustomerPromotion = true
        }, CancellationToken.None);
        Assert.Equal(GlobalUserRole.TenantStaff, existingCustomer.GlobalRole);
        Assert.False(promotedDto.InvitedViaEmail);
        Assert.Equal(1, quotaGuard.StaffQuotaChecks);

        // 3. New staff with blank password -> cryptographic 32-byte secret + invitation email, never "Staff@123456"
        var invitedDto = await handler.Handle(new CreateStaffMemberCommand
        {
            FullName = "New Receptionist",
            Email = "new.staff@hotelsaas.vn",
            PropertyId = propId,
            StaffRole = StaffRole.Receptionist,
            Password = null,
            AppUrl = "https://app.hotelsaas.vn"
        }, CancellationToken.None);

        Assert.True(invitedDto.InvitedViaEmail);
        Assert.Single(email.StaffInvitationEmails);
        Assert.Contains("mode=invite", email.StaffInvitationEmails[0].Url);

        var createdUser = db.UserList.Single(u => u.Email == "new.staff@hotelsaas.vn");
        Assert.False(hasher.Verify("Staff@123456", createdUser.PasswordHash));
        Assert.Equal(32, Convert.FromBase64String(hasher.RawPasswordsHashed.Last()).Length);

        // 4. Quota guard exceeded blocks creation
        quotaGuard.ThrowOnCreateStaff = true;
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new CreateStaffMemberCommand
            {
                FullName = "Over Quota",
                Email = "over.quota@hotelsaas.vn",
                PropertyId = propId,
                StaffRole = StaffRole.Receptionist
            }, CancellationToken.None));
    }

    [Fact]
    public async Task LoginAndRefreshToken_UserDtoIncludesPhoneAndEmailVerificationFlags()
    {
        var db = new FakeWave3DbContext(new StubTenantService());
        var hasher = new StubPasswordHasher();
        var jwt = CreateJwtService();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "verified.guest@hotelsaas.vn",
            Username = "verified.guest@hotelsaas.vn",
            FullName = "Verified Guest",
            PasswordHash = hasher.Hash("Guest@1234"),
            GlobalRole = GlobalUserRole.Customer,
            PhoneNumber = "+84909123456",
            PhoneVerifiedAtUtc = DateTime.UtcNow,
            EmailVerifiedAtUtc = DateTime.UtcNow,
            IsActive = true
        };
        db.UserList.Add(user);

        var loginHandler = new LoginCommandHandler(db, hasher, jwt);
        var loginRes = await loginHandler.Handle(new LoginCommand(user.Email, "Guest@1234"), CancellationToken.None);

        Assert.Equal("+84909123456", loginRes.User.PhoneNumber);
        Assert.True(loginRes.User.IsPhoneVerified);
        Assert.True(loginRes.User.IsEmailVerified);

        var refreshHandler = new RefreshTokenCommandHandler(db, jwt, new StubMembershipLookupService());
        var refreshRes = await refreshHandler.Handle(
            new RefreshTokenCommand(loginRes.AccessToken, loginRes.RefreshToken),
            CancellationToken.None);

        Assert.Equal("+84909123456", refreshRes.User.PhoneNumber);
        Assert.True(refreshRes.User.IsPhoneVerified);
        Assert.True(refreshRes.User.IsEmailVerified);

        var googleHandler = new GoogleLoginCommandHandler(
            db,
            new StubGoogleAuthService
            {
                Result = new GoogleTokenVerificationResult(true, "g-sub-verified", user.Email, user.FullName, null)
            },
            hasher,
            jwt,
            NullLogger<GoogleLoginCommandHandler>.Instance);

        var googleRes = await googleHandler.Handle(new GoogleLoginCommand("google-id-token"), CancellationToken.None);
        Assert.Equal("+84909123456", googleRes.User.PhoneNumber);
        Assert.True(googleRes.User.IsPhoneVerified);
        Assert.True(googleRes.User.IsEmailVerified);
    }

    [Fact]
    public void Validators_RejectWeakPasswordsAndInvalidInputs()
    {
        var resetValidator = new ResetPasswordCommandValidator();
        Assert.False(resetValidator.Validate(new ResetPasswordCommand("tok", "weakpass")).IsValid);
        Assert.False(resetValidator.Validate(new ResetPasswordCommand("tok", "Weakpass1")).IsValid); // missing special char
        Assert.True(resetValidator.Validate(new ResetPasswordCommand("tok", "Strong@123")).IsValid);

        var changeValidator = new ChangePasswordCommandValidator();
        Assert.False(changeValidator.Validate(new ChangePasswordCommand("Same@1234", "Same@1234")).IsValid);
        Assert.True(changeValidator.Validate(new ChangePasswordCommand("OldPass@1", "NewPass@2")).IsValid);

        var forgotValidator = new ForgotPasswordCommandValidator();
        Assert.False(forgotValidator.Validate(new ForgotPasswordCommand("not-an-email")).IsValid);
        Assert.True(forgotValidator.Validate(new ForgotPasswordCommand("user@example.com")).IsValid);
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Payments.Queries.GenerateVietQr;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

public sealed class GenerateVietQrQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenPropertyAndTenantPrintConfigsExist_PrefersPropertyLevelConfig()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-PROP01"
        };
        db.ReservationList.Add(reservation);

        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = null,
            HeaderCompanyName = "Tenant Group HQ",
            BankName = "Vietcombank",
            BankAccountNumber = "1111111111",
            BankAccountHolder = "TENANT GROUP ACCOUNT"
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Branch Riverside",
            BankName = "ACB",
            BankAccountNumber = "2222222222",
            BankAccountHolder = "BRANCH RIVERSIDE ACCOUNT"
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 500_000m, ReservationId: reservation.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal("970416", result.BankBin);
        Assert.Equal("2222222222", result.AccountNumber);
        Assert.Equal("BRANCH RIVERSIDE ACCOUNT", result.AccountName);
        Assert.Equal(500_000m, result.Amount);
        Assert.Equal("RES-PROP01", result.ConfirmationCode);
    }

    [Fact]
    public async Task Handle_WhenOnlyTenantLevelPrintConfigExists_FallsBackToTenantLevelConfig()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-TNT01"
        };
        db.ReservationList.Add(reservation);
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = null,
            HeaderCompanyName = "Chain Group Co",
            BankName = "MB BANK",
            BankAccountNumber = "0998877665",
            BankAccountHolder = "CHAIN GROUP CO"
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 350_000m, ReservationId: reservation.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal("970422", result.BankBin);
        Assert.Equal("0998877665", result.AccountNumber);
        Assert.Equal("CHAIN GROUP CO", result.AccountName);
    }

    [Theory]
    [InlineData(false, "", "")]
    [InlineData(true, "MBBank", "")]
    [InlineData(true, "", "0987654321")]
    [InlineData(true, "   ", "   ")]
    public async Task Handle_WhenConfigOrBankDetailsMissing_ThrowsUnprocessableEntityMentioningSepayAndNotVnpay(
        bool seedConfig,
        string bankName,
        string bankAccountNumber)
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-NOCFG"
        };
        db.ReservationList.Add(reservation);

        if (seedConfig)
        {
            db.PrintTemplateConfigList.Add(new PrintTemplateConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                HeaderCompanyName = "Hotel Without Bank",
                BankName = bankName,
                BankAccountNumber = bankAccountNumber,
                BankAccountHolder = "HOTEL WITHOUT BANK"
            });
        }

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 250_000m, ReservationId: reservation.Id);

        // Act
        var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() => handler.Handle(query, CancellationToken.None));

        // Assert
        Assert.Equal("ERR_BANK_ACCOUNT_NOT_CONFIGURED", ex.ErrorCode);
        Assert.Contains("SePay", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("VNPay", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_WhenBankAccountHolderIsEmpty_FallsBackToHeaderCompanyName()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.PropertiesList.Add(new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "Biển Xanh Resort",
            Code = "BXR",
            Slug = "bien-xanh-resort",
            Status = PropertyStatus.Active
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Khách Sạn Biển Xanh",
            BankName = "ACB",
            BankAccountNumber = "33958647",
            BankAccountHolder = "   "
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 600_000m, PropertyId: propertyId);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal("KHACH SAN BIEN XANH", result.AccountName);
        Assert.Equal("970416", result.BankBin);
        Assert.Equal("33958647", result.AccountNumber);
    }

    [Fact]
    public async Task Handle_WhenBothBankAccountHolderAndHeaderCompanyNameAreEmpty_ThrowsUnprocessableEntity()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.PropertiesList.Add(new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "No Holder Hotel",
            Code = "NHH",
            Slug = "no-holder-hotel",
            Status = PropertyStatus.Active
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "  ",
            BankName = "ACB",
            BankAccountNumber = "33958647",
            BankAccountHolder = ""
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 600_000m, PropertyId: propertyId);

        // Act
        var ex = await Assert.ThrowsAsync<UnprocessableEntityException>(() => handler.Handle(query, CancellationToken.None));

        // Assert
        Assert.Equal("ERR_BANK_ACCOUNT_NOT_CONFIGURED", ex.ErrorCode);
    }

    [Theory]
    [InlineData("ACB", "970416")]
    [InlineData("MB BANK", "970422")]
    [InlineData("mb bank", "970422")]
    [InlineData("MBBank", "970422")]
    [InlineData("Vietcombank", "970436")]
    [InlineData("TP BANK", "970423")]
    [InlineData("970418", "970418")]
    [InlineData("970499", "970499")]
    public async Task Handle_WhenBankNameOrRawSixDigitBinConfigured_MapsToExpectedBankBin(
        string configuredBankName,
        string expectedBankBin)
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.PropertiesList.Add(new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = "BIN Test Hotel",
            Code = "BIN",
            Slug = "bin-test-hotel",
            Status = PropertyStatus.Active
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "BIN Test Hotel",
            BankName = configuredBankName,
            BankAccountNumber = "0123456789",
            BankAccountHolder = "BIN TEST HOLDER"
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 100_000m, PropertyId: propertyId);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal(expectedBankBin, result.BankBin);
    }

    [Fact]
    public async Task Handle_WhenLookedUpByConfirmationCode_ResolvesReservationAndBankConfig()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-CODE88"
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Code Lookup Hotel",
            BankName = "ACB",
            BankAccountNumber = "8888999900",
            BankAccountHolder = "CODE LOOKUP HOTEL"
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 750_000m, ConfirmationCode: "res-code88");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal("970416", result.BankBin);
        Assert.Equal("8888999900", result.AccountNumber);
        Assert.Equal("RES-CODE88", result.ConfirmationCode);
        Assert.Equal("DATPHONG RESCODE88", result.Description);
    }

    [Fact]
    public async Task Handle_WhenLookedUpBySnapshotLookupToken_ResolvesReservationAndBankConfig()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        const string lookupToken = "tok-snapshot-9911";
        var snapshot = new ReservationSnapshot
        {
            LookupToken = lookupToken,
            IsOnlineHold = true,
            RoomTypeName = "Deluxe",
            TotalAmount = 900_000m
        };
        db.ReservationList.Add(new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            ConfirmationCode = "RES-SNAP77",
            Notes = ReservationSnapshotHelper.Serialize(snapshot)
        });
        db.PrintTemplateConfigList.Add(new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Snapshot Hotel",
            BankName = "MB BANK",
            BankAccountNumber = "0777666555",
            BankAccountHolder = "SNAPSHOT HOTEL"
        });

        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 450_000m, ConfirmationCode: lookupToken);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.Equal("970422", result.BankBin);
        Assert.Equal("0777666555", result.AccountNumber);
        Assert.Equal("RES-SNAP77", result.ConfirmationCode);
        Assert.Equal("DATPHONG RESSNAP77", result.Description);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-500000)]
    public async Task Handle_WhenAmountIsZeroOrNegative_ThrowsBadRequestException(decimal invalidAmount)
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: invalidAmount, PropertyId: Guid.NewGuid());

        // Act
        var ex = await Assert.ThrowsAsync<BadRequestException>(() => handler.Handle(query, CancellationToken.None));

        // Assert
        Assert.Equal("ERR_INVALID_AMOUNT", ex.ErrorCode);
    }

    [Fact]
    public async Task Handle_WhenReservationIdNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var db = new FakeVietQrDbContext();
        var handler = new GenerateVietQrQueryHandler(db, new VietQrService());
        var query = new GenerateVietQrQuery(Amount: 200_000m, ReservationId: Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(query, CancellationToken.None));
    }

    // ── Minimal Fake IApplicationDbContext ──────────────────────────────────

    private sealed class FakeVietQrDbContext : IApplicationDbContext
    {
        public List<Property> PropertiesList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();

        public FakeVietQrDbContext()
        {
            Properties = new FakeAsyncDbSet<Property>(PropertiesList);
            Reservations = new FakeAsyncDbSet<Reservation>(ReservationList);
            PrintTemplateConfigs = new FakeAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList);
        }

        public DbSet<Property> Properties { get; }
        public DbSet<Reservation> Reservations { get; }
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<RoomType> RoomTypes => throw new NotImplementedException();
        public DbSet<Room> Rooms => throw new NotImplementedException();
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class EfMethodStripper : ExpressionVisitor
    {
        private readonly IQueryable _root;
        private EfMethodStripper(IQueryable root) => _root = root;

        public static Expression Strip(Expression expression, IQueryable root) =>
            new EfMethodStripper(root).Visit(expression);

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
                var def = node.Value.GetType().GetGenericTypeDefinition();
                if (def == typeof(FakeAsyncDbSet<>) || def == typeof(FakeAsyncQueryable<>))
                {
                    return _root.Expression;
                }
            }

            return base.VisitConstant(node);
        }
    }

    private sealed class FakeAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public FakeAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private sealed class FakeAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _data;
        public FakeAsyncQueryProvider(List<TEntity> data) => _data = data;

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(FakeAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression) =>
            new FakeAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var root = _data.AsQueryable();
            return root.Provider.Execute(EfMethodStripper.Strip(expression, root));
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var root = _data.AsQueryable();
            return root.Provider.Execute<TResult>(EfMethodStripper.Strip(expression, root));
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var root = _data.AsQueryable();
            var rewritten = EfMethodStripper.Strip(expression, root);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(root.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class FakeAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public FakeAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator() =>
            _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new FakeAsyncEnumerator<TElement>(GetEnumerator());
    }

    private sealed class FakeAsyncDbSet<TEntity> : DbSet<TEntity>, IQueryable<TEntity>, IAsyncEnumerable<TEntity>
        where TEntity : class
    {
        private readonly List<TEntity> _data;
        private readonly FakeAsyncQueryProvider<TEntity> _provider;
        private readonly Expression _expression;

        public FakeAsyncDbSet(List<TEntity> data)
        {
            _data = data;
            _provider = new FakeAsyncQueryProvider<TEntity>(data);
            _expression = Expression.Constant(this);
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator() => _data.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _data.GetEnumerator();

        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new FakeAsyncEnumerator<TEntity>(_data.GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _data.Add(entity);
            return null!;
        }
    }
}

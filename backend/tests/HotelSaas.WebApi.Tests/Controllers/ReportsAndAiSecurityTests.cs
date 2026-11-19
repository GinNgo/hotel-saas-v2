using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using ClosedXML.Excel;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Application.Properties.Commands.CreateProperty;
using HotelSaas.Application.Properties.Commands.UpdateProperty;
using HotelSaas.Application.Reports.Queries.GetGroupAnalytics;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.WebApi.Tests.Controllers;

public sealed class ReportsAndAiSecurityTests
{
    private static readonly LocationLookupService LocationService = new();

    #region In-Memory EF & Service Test Stubs

    private interface IRootDbSet
    {
        Expression RootExpression { get; }
    }

    private interface IWrappedQueryable
    {
        Expression InnerExpression { get; }
    }

    private sealed class FakeAsyncQueryProvider<TEntity> : IAsyncQueryProvider
    {
        private readonly IQueryable _source;

        public FakeAsyncQueryProvider(IQueryable source) => _source = source;

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().FirstOrDefault() ?? typeof(TEntity);
            var queryableType = typeof(FakeAsyncQueryable<>).MakeGenericType(elementType);
            return (IQueryable)Activator.CreateInstance(queryableType, expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression) =>
            new FakeAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression) =>
            _source.Provider.Execute(EfExpressionStripper.Rewrite(expression));

        public TResult Execute<TResult>(Expression expression) =>
            _source.Provider.Execute<TResult>(EfExpressionStripper.Rewrite(expression));

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var rewritten = EfExpressionStripper.Rewrite(expression);
            var resultType = typeof(TResult);
            if (resultType.IsGenericType && resultType.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var innerType = resultType.GetGenericArguments()[0];
                var executionResult = typeof(IQueryProvider)
                    .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                    .MakeGenericMethod(innerType)
                    .Invoke(_source.Provider, new object[] { rewritten });

                return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(innerType)
                    .Invoke(null, new[] { executionResult })!;
            }

            return _source.Provider.Execute<TResult>(rewritten);
        }
    }

    private sealed class FakeAsyncQueryable<T> : IOrderedQueryable<T>, IAsyncEnumerable<T>, IWrappedQueryable
    {
        private readonly Expression _expression;
        private readonly IQueryProvider _provider;

        public FakeAsyncQueryable(Expression expression, IQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        public Expression InnerExpression => _expression;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<T> GetEnumerator() =>
            _provider.Execute<IEnumerable<T>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new FakeAsyncEnumerator<T>(GetEnumerator());
        }
    }

    private sealed class EfExpressionStripper : ExpressionVisitor
    {
        public static Expression Rewrite(Expression expression) => new EfExpressionStripper().Visit(expression);

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
            if (node.Value is IRootDbSet dbSet)
            {
                return dbSet.RootExpression;
            }

            if (node.Value is IWrappedQueryable wrapped)
            {
                return Visit(wrapped.InnerExpression);
            }

            return base.VisitConstant(node);
        }
    }

    private sealed class FakeAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public FakeAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        public ValueTask<bool> MoveNextAsync() => new(_inner.MoveNext());
    }

    private sealed class FakeDbSet<T> : DbSet<T>, IOrderedQueryable<T>, IAsyncEnumerable<T>, IRootDbSet where T : class
    {
        public List<T> Items { get; }
        private readonly IQueryable<T> _queryable;
        private readonly FakeAsyncQueryProvider<T> _provider;

        public FakeDbSet(IEnumerable<T>? seed = null)
        {
            Items = seed != null ? seed.ToList() : new List<T>();
            _queryable = Items.AsQueryable();
            _provider = new FakeAsyncQueryProvider<T>(_queryable);
        }

        public Expression RootExpression => _queryable.Expression;
        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _queryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        public override EntityEntry<T> Add(T entity)
        {
            Items.Add(entity);
            return null!;
        }

        public override void AddRange(params T[] entities) => Items.AddRange(entities);

        public override void AddRange(IEnumerable<T> entities) => Items.AddRange(entities);

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new FakeAsyncEnumerator<T>(Items.GetEnumerator());
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator() => Items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => Items.GetEnumerator();
    }

    private sealed class FakeReportsDbContext : IApplicationDbContext
    {
        public FakeDbSet<Property> PropertiesSet { get; } = new();
        public FakeDbSet<RoomType> RoomTypesSet { get; } = new();
        public FakeDbSet<Room> RoomsSet { get; } = new();
        public FakeDbSet<Reservation> ReservationsSet { get; } = new();
        public FakeDbSet<Payment> PaymentsSet { get; } = new();
        public FakeDbSet<Invoice> InvoicesSet { get; } = new();
        public FakeDbSet<InvoiceItem> InvoiceItemsSet { get; } = new();
        public FakeDbSet<RoomTypeRate> RoomTypeRatesSet { get; } = new();
        public FakeDbSet<PropertySurchargePolicy> SurchargePoliciesSet { get; } = new();
        public FakeDbSet<AiUsageLog> AiUsageLogsSet { get; } = new();

        public DbSet<Property> Properties => PropertiesSet;
        public DbSet<RoomType> RoomTypes => RoomTypesSet;
        public DbSet<Room> Rooms => RoomsSet;
        public DbSet<Reservation> Reservations => ReservationsSet;
        public DbSet<Payment> Payments => PaymentsSet;
        public DbSet<Invoice> Invoices => InvoicesSet;
        public DbSet<InvoiceItem> InvoiceItems => InvoiceItemsSet;
        public DbSet<RoomTypeRate> RoomTypeRates => RoomTypeRatesSet;
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => SurchargePoliciesSet;
        public DbSet<AiUsageLog> AiUsageLogs => AiUsageLogsSet;

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> UpdateRoomStatusAtomicAsync(Guid roomId, Guid tenantId, Guid propertyId, RoomStatus expectedOldStatus, RoomStatus newStatus, DateTime updatedAtUtc, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class StubSender : ISender
    {
        public List<object> SentRequests { get; } = new();

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            return Task.FromResult(default(TResponse)!);
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            SentRequests.Add(request);
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            return Task.FromResult<object?>(null);
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubDynamicPricingService : IDynamicPricingService
    {
        public Task<DynamicPricingAdjustmentDto?> CalculateDynamicAdjustmentAsync(
            Guid propertyId,
            Guid roomTypeId,
            RentalType rentalType,
            DateOnly startDate,
            DateOnly endDate,
            decimal basePrice,
            CancellationToken cancellationToken = default)
            => Task.FromResult<DynamicPricingAdjustmentDto?>(null);

        public Task<DynamicPricingSummaryDto> GetPricingRecommendationsAsync(
            Guid propertyId,
            DateOnly targetDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new DynamicPricingSummaryDto(
                propertyId,
                "Test Hotel",
                targetDate,
                0.75,
                "High",
                Array.Empty<RoomTypePricingRecommendationDto>()));
    }

    private static CurrentUserContext CreateUserContext(
        Guid? tenantId,
        Guid? propertyId,
        bool isTenantWide,
        bool authenticated = true)
    {
        var tenantSvc = new CurrentTenantService { TenantId = tenantId };
        var propSvc = new CurrentPropertyService { PropertyId = propertyId, IsTenantWide = isTenantWide };
        var ctx = new CurrentUserContext(tenantSvc, propSvc);
        if (authenticated)
        {
            ctx.SetUser(Guid.NewGuid(), "staff@hotel.vn", GlobalUserRole.TenantStaff);
        }
        return ctx;
    }

    #endregion

    [Fact]
    public async Task ReportsController_GetRevenueSummary_AttributesHourlyStays_And_ExcludesPendingNoShowCancelledAndRefunds()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var dayBefore = new DateOnly(2026, 11, 9);
        var targetDay = new DateOnly(2026, 11, 10);
        var dayAfter = new DateOnly(2026, 11, 11);

        var db = new FakeReportsDbContext();
        db.ReservationsSet.AddRange(
            // Hourly / same-day stay: CheckInDate == CheckOutDate
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-H1",
                GuestName = "Khach Theo Gio",
                CheckInDate = targetDay,
                CheckOutDate = targetDay,
                NumberOfGuests = 2,
                TotalAmount = 350_000m,
                Status = ReservationStatus.CheckedOut
            },
            // Multi-night stay covering Nov 9 and Nov 10 nights
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-N1",
                GuestName = "Khach Hai Dem",
                CheckInDate = dayBefore,
                CheckOutDate = dayAfter,
                NumberOfGuests = 2,
                TotalAmount = 1_000_000m,
                Status = ReservationStatus.CheckedIn
            },
            // PendingPayment MUST be excluded
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-PEND",
                GuestName = "Cho Thanh Toan",
                CheckInDate = targetDay,
                CheckOutDate = targetDay,
                NumberOfGuests = 1,
                TotalAmount = 400_000m,
                Status = ReservationStatus.PendingPayment
            },
            // NoShow MUST be excluded
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-NS",
                GuestName = "Khong Den",
                CheckInDate = targetDay,
                CheckOutDate = dayAfter,
                NumberOfGuests = 1,
                TotalAmount = 500_000m,
                Status = ReservationStatus.NoShow
            },
            // Cancelled MUST be excluded
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-CAN",
                GuestName = "Da Huy",
                CheckInDate = targetDay,
                CheckOutDate = dayAfter,
                NumberOfGuests = 1,
                TotalAmount = 600_000m,
                Status = ReservationStatus.Cancelled
            });

        var paidAt = new DateTime(2026, 11, 10, 10, 0, 0, DateTimeKind.Utc);
        db.PaymentsSet.AddRange(
            new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                Amount = 1_000_000m,
                Method = PaymentMethod.VNPay,
                Status = PaymentStatus.Completed,
                TransactionRef = "VNPAY-TXN-001",
                PaidAtUtc = paidAt
            },
            new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                Amount = 350_000m,
                Method = PaymentMethod.Cash,
                Status = PaymentStatus.Completed,
                TransactionRef = null,
                PaidAtUtc = paidAt
            },
            new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                Amount = 500_000m,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Completed,
                TransactionRef = "REFUND-COMPLETED-001",
                PaidAtUtc = paidAt
            },
            new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                Amount = 100_000m,
                Method = PaymentMethod.Cash,
                Status = PaymentStatus.Completed,
                TransactionRef = "manual-refund-002",
                PaidAtUtc = paidAt
            });

        var userCtx = CreateUserContext(tenantId, propId, isTenantWide: false);
        var exportService = new ReportExportService(db, userCtx);
        var controller = new ReportsController(db, userCtx, new StubSender(), exportService);

        var actionResult = await controller.GetRevenueSummary(dayBefore, dayAfter, null, null, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(actionResult);
        var summary = Assert.IsType<RevenueSummaryDto>(ok.Value);

        Assert.Equal(1_350_000m, summary.TotalRevenue);
        Assert.Equal(2, summary.TotalBookings);

        var nov9 = summary.DailySeries.Single(d => d.Date == "2026-11-09");
        var nov10 = summary.DailySeries.Single(d => d.Date == "2026-11-10");
        Assert.Equal(500_000m, nov9.Revenue);
        Assert.Equal(1, nov9.BookingsCount);
        Assert.Equal(850_000m, nov10.Revenue);
        Assert.Equal(2, nov10.BookingsCount);

        Assert.Equal(1_000_000m, summary.PaymentBreakdown.Single(p => p.Method == "VNPay").Amount);
        Assert.Equal(1, summary.PaymentBreakdown.Single(p => p.Method == "VNPay").Count);
        Assert.Equal(350_000m, summary.PaymentBreakdown.Single(p => p.Method == "Tiền mặt (Cash)").Amount);
        Assert.Equal(1, summary.PaymentBreakdown.Single(p => p.Method == "Tiền mặt (Cash)").Count);
        Assert.Equal(0m, summary.PaymentBreakdown.Single(p => p.Method == "Chuyển khoản (Bank)").Amount);
        Assert.Equal(0, summary.PaymentBreakdown.Single(p => p.Method == "Chuyển khoản (Bank)").Count);
    }

    [Fact]
    public async Task ReportsController_GetPmsKpi_CountsHourlyStayAsOneSoldUnit_And_ExcludesPendingAndNoShow()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var dayBefore = new DateOnly(2026, 11, 9);
        var targetDay = new DateOnly(2026, 11, 10);
        var dayAfter = new DateOnly(2026, 11, 11);

        var db = new FakeReportsDbContext();
        db.RoomsSet.AddRange(
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, RoomNumber = "101" },
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propId, RoomNumber = "102" });

        db.ReservationsSet.AddRange(
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-H1",
                CheckInDate = targetDay,
                CheckOutDate = targetDay,
                NumberOfGuests = 2,
                TotalAmount = 350_000m,
                Status = ReservationStatus.CheckedOut
            },
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-N1",
                CheckInDate = dayBefore,
                CheckOutDate = dayAfter,
                NumberOfGuests = 2,
                TotalAmount = 1_000_000m,
                Status = ReservationStatus.CheckedIn
            },
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-PEND",
                CheckInDate = targetDay,
                CheckOutDate = targetDay,
                NumberOfGuests = 1,
                TotalAmount = 400_000m,
                Status = ReservationStatus.PendingPayment
            },
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-NS",
                CheckInDate = targetDay,
                CheckOutDate = dayAfter,
                NumberOfGuests = 1,
                TotalAmount = 500_000m,
                Status = ReservationStatus.NoShow
            },
            new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propId,
                ConfirmationCode = "RES-CAN",
                CheckInDate = targetDay,
                CheckOutDate = dayAfter,
                NumberOfGuests = 1,
                TotalAmount = 600_000m,
                Status = ReservationStatus.Cancelled
            });

        var userCtx = CreateUserContext(tenantId, propId, isTenantWide: false);
        var controller = new ReportsController(db, userCtx, new StubSender(), new ReportExportService(db, userCtx));

        var result = await controller.GetPmsKpi(targetDay, targetDay, null, null, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var kpi = Assert.IsType<PmsKpiDto>(ok.Value);

        Assert.Equal(2, kpi.TotalRooms);
        Assert.Equal(2, kpi.TotalAvailableNights);
        Assert.Equal(2, kpi.TotalSoldNights);
        Assert.Equal(100.0, kpi.OccupancyRate);
        Assert.Equal(850_000m, kpi.TotalRevenue);
        Assert.Equal(425_000m, kpi.AverageDailyRate);
        Assert.Equal(425_000m, kpi.RevPAR);
        Assert.Equal(2, kpi.TotalBookings);
        Assert.Equal(4, kpi.TotalGuests);
        Assert.Equal(1, kpi.CancelledBookings);
        Assert.Equal(20.0, kpi.CancellationRate);
    }

    [Fact]
    public async Task ReportsController_BranchIsolation_ForcesSingleBranchWhenNull_And_Throws403OnCrossBranch()
    {
        var tenantId = Guid.NewGuid();
        var propA = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Branch A", Code = "BRA" };
        var propB = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Branch B", Code = "BRB" };
        var day = new DateOnly(2026, 11, 10);

        var resAId = Guid.NewGuid();
        var resBId = Guid.NewGuid();

        var db = new FakeReportsDbContext();
        db.PropertiesSet.AddRange(propA, propB);
        db.RoomsSet.AddRange(
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propA.Id, RoomNumber = "A101" },
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propB.Id, RoomNumber = "B201" },
            new Room { Id = Guid.NewGuid(), TenantId = tenantId, PropertyId = propB.Id, RoomNumber = "B202" });

        var resA = new Reservation
        {
            Id = resAId,
            TenantId = tenantId,
            PropertyId = propA.Id,
            Property = propA,
            ConfirmationCode = "BRANCH-A-01",
            GuestName = "Guest A",
            CheckInDate = day,
            CheckOutDate = day,
            NumberOfGuests = 2,
            TotalAmount = 400_000m,
            Status = ReservationStatus.Confirmed
        };
        var resB = new Reservation
        {
            Id = resBId,
            TenantId = tenantId,
            PropertyId = propB.Id,
            Property = propB,
            ConfirmationCode = "BRANCH-B-02",
            GuestName = "Guest B",
            CheckInDate = day,
            CheckOutDate = day,
            NumberOfGuests = 2,
            TotalAmount = 900_000m,
            Status = ReservationStatus.Confirmed
        };
        db.ReservationsSet.AddRange(resA, resB);
        db.InvoicesSet.Add(new Invoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ReservationId = resBId,
            Reservation = resB,
            InvoiceNumber = "INV-B-02",
            PropertyName = propB.Name,
            PropertyAddress = "Address B",
            GuestName = "Guest B"
        });

        var branchAUser = CreateUserContext(tenantId, propA.Id, isTenantWide: false);
        var exportSvc = new ReportExportService(db, branchAUser);
        var controller = new ReportsController(db, branchAUser, new StubSender(), exportSvc);

        // Passing propertyId: null MUST force propA scope (no chain-wide leak)
        var summaryOk = Assert.IsType<OkObjectResult>(
            await controller.GetRevenueSummary(day, day, null, null, CancellationToken.None));
        var summary = Assert.IsType<RevenueSummaryDto>(summaryOk.Value);
        Assert.Equal(400_000m, summary.TotalRevenue);
        Assert.Equal(1, summary.TotalBookings);

        var kpiOk = Assert.IsType<OkObjectResult>(
            await controller.GetPmsKpi(day, day, null, null, CancellationToken.None));
        var kpi = Assert.IsType<PmsKpiDto>(kpiOk.Value);
        Assert.Equal(1, kpi.TotalRooms);
        Assert.Equal(400_000m, kpi.TotalRevenue);

        var csvFile = Assert.IsType<FileContentResult>(
            await controller.ExportCsv(day, day, null, CancellationToken.None));
        var csvText = System.Text.Encoding.UTF8.GetString(csvFile.FileContents);
        Assert.Contains("BRANCH-A-01", csvText, StringComparison.Ordinal);
        Assert.DoesNotContain("BRANCH-B-02", csvText, StringComparison.Ordinal);

        // Cross-branch attempts MUST throw ForbiddenException (HTTP 403)
        var exSummary = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.GetRevenueSummary(day, day, propB.Id, null, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exSummary.ErrorCode);

        var exKpi = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.GetPmsKpi(day, day, propB.Id, null, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exKpi.ErrorCode);

        var exCsv = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.ExportCsv(day, day, propB.Id, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exCsv.ErrorCode);

        var exExcel = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.ExportExcel(day, day, propB.Id, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exExcel.ErrorCode);

        var exPdf = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.ExportPdf(day, day, propB.Id, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exPdf.ErrorCode);

        var exGroup = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.GetGroupAnalytics(day, day, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exGroup.ErrorCode);

        var exInvoice = await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.ExportInvoicePdf(resBId, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", exInvoice.ErrorCode);

        // Non-tenant-wide user without PropertyId MUST fail closed
        var missingPropUser = CreateUserContext(tenantId, null, isTenantWide: false);
        var missingPropController = new ReportsController(db, missingPropUser, new StubSender(), new ReportExportService(db, missingPropUser));
        var exMissing = await Assert.ThrowsAsync<ForbiddenException>(() =>
            missingPropController.GetRevenueSummary(day, day, null, null, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_REQUIRED", exMissing.ErrorCode);
    }

    [Fact]
    public async Task ReportExportService_ExcludesRefundTransactions_InExcelAndPdf_And_ChecksInvoiceBranchOwnership()
    {
        var tenantId = Guid.NewGuid();
        var propA = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Saigon Hotel", Code = "SG01", Address = "1 Le Loi" };
        var propB = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Hanoi Hotel", Code = "HN01", Address = "2 Trang Tien" };
        var day = new DateOnly(2026, 11, 10);

        var resAId = Guid.NewGuid();
        var resBId = Guid.NewGuid();

        var db = new FakeReportsDbContext();
        db.PropertiesSet.AddRange(propA, propB);
        db.ReservationsSet.AddRange(
            new Reservation
            {
                Id = resAId,
                TenantId = tenantId,
                PropertyId = propA.Id,
                Property = propA,
                ConfirmationCode = "EXP-A1",
                GuestName = "Nguyen Van A",
                CheckInDate = day,
                CheckOutDate = day.AddDays(1),
                TotalAmount = 1_200_000m,
                Status = ReservationStatus.CheckedOut,
                Payments = new List<Payment>
                {
                    new()
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propA.Id,
                        ReservationId = resAId,
                        Amount = 1_200_000m,
                        Method = PaymentMethod.VNPay,
                        Status = PaymentStatus.Completed,
                        TransactionRef = "VNPAY-REAL-01"
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propA.Id,
                        ReservationId = resAId,
                        Amount = 300_000m,
                        Method = PaymentMethod.BankTransfer,
                        Status = PaymentStatus.Completed,
                        TransactionRef = "REFUND-COMPLETED-01"
                    }
                }
            },
            new Reservation
            {
                Id = resBId,
                TenantId = tenantId,
                PropertyId = propB.Id,
                Property = propB,
                ConfirmationCode = "EXP-B2",
                GuestName = "Tran Thi B",
                CheckInDate = day,
                CheckOutDate = day.AddDays(1),
                TotalAmount = 800_000m,
                Status = ReservationStatus.Confirmed
            });

        var branchAUser = CreateUserContext(tenantId, propA.Id, isTenantWide: false);
        var exportService = new ReportExportService(db, branchAUser);

        var xlsxBytes = await exportService.ExportReservationsExcelAsync(day, day.AddDays(1), null, CancellationToken.None);
        Assert.NotEmpty(xlsxBytes);
        using (var workbook = new XLWorkbook(new MemoryStream(xlsxBytes)))
        {
            var sheet = workbook.Worksheet("Doanh thu");
            Assert.Equal("EXP-A1", sheet.Cell("A5").GetString());
            Assert.Equal(1_200_000m, sheet.Cell("I5").GetValue<decimal>());
            Assert.True(string.IsNullOrWhiteSpace(sheet.Cell("A6").GetString()));
        }

        var pdfBytes = await exportService.ExportRevenuePdfAsync(day, day.AddDays(1), null, CancellationToken.None);
        Assert.True(pdfBytes.Length > 500);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(pdfBytes, 0, 4));

        // Even when no Invoice exists yet, branch A user targeting branch B's reservation must get ForbiddenException
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            exportService.ExportInvoicePdfAsync(resBId, CancellationToken.None));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", ex.ErrorCode);
    }

    [Fact]
    public async Task CreatePropertyCommandHandler_ThrowsConflictOnDuplicates_And_SeedsDefaultsAnd24HourSurcharges()
    {
        var tenantId = Guid.NewGuid();
        var existing = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Saigon Stay",
            Code = "SG01",
            Slug = "saigon-stay",
            Address = "10 Dong Khoi",
            City = "TP. Hồ Chí Minh"
        };

        var db = new FakeReportsDbContext();
        db.PropertiesSet.Add(existing);

        var tenantSvc = new StubTenantService { TenantId = tenantId };
        var createHandler = new CreatePropertyCommandHandler(db, tenantSvc, LocationService);

        var dupCodeEx = await Assert.ThrowsAsync<ConflictException>(() =>
            createHandler.Handle(new CreatePropertyCommand(
                Name: "Another Hotel",
                Code: "sg01",
                Slug: "another-hotel",
                Address: "20 Le Loi",
                City: "TP. Hồ Chí Minh"), CancellationToken.None));
        Assert.Equal("ERR_DUPLICATE_PROPERTY_CODE", dupCodeEx.ErrorCode);

        var dupSlugEx = await Assert.ThrowsAsync<ConflictException>(() =>
            createHandler.Handle(new CreatePropertyCommand(
                Name: "Saigon Stay 2",
                Code: "SG02",
                Slug: "SAIGON-STAY",
                Address: "30 Le Loi",
                City: "TP. Hồ Chí Minh"), CancellationToken.None));
        Assert.Equal("ERR_DUPLICATE_PROPERTY_SLUG", dupSlugEx.ErrorCode);

        var createdDto = await createHandler.Handle(new CreatePropertyCommand(
            Name: "Da Nang Ocean",
            Code: "DN01",
            Slug: "da-nang-ocean",
            Address: "50 Vo Nguyen Giap",
            City: "Đà Nẵng",
            PhoneNumber: "0905111222",
            Email: "dn@hotel.vn",
            StarRating: 4), CancellationToken.None);

        Assert.False(createdDto.IsPublished);

        var createdEntity = db.PropertiesSet.Items.Single(p => p.Id == createdDto.Id);
        Assert.False(createdEntity.IsPublished);
        Assert.Equal(new TimeOnly(14, 0, 0), createdEntity.CheckInTime);
        Assert.Equal(new TimeOnly(12, 0, 0), createdEntity.CheckOutTime);

        var policies = db.SurchargePoliciesSet.Items.Where(sp => sp.PropertyId == createdEntity.Id).ToList();
        Assert.Equal(6, policies.Count);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.EarlyCheckIn && p.FromTime == new TimeOnly(0, 0, 0) && p.ToTime == new TimeOnly(6, 0, 0) && p.Percentage == 100m);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.EarlyCheckIn && p.FromTime == new TimeOnly(6, 0, 0) && p.ToTime == new TimeOnly(9, 0, 0) && p.Percentage == 50m);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.EarlyCheckIn && p.FromTime == new TimeOnly(9, 0, 0) && p.ToTime == new TimeOnly(14, 0, 0) && p.Percentage == 30m);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.LateCheckOut && p.FromTime == new TimeOnly(12, 0, 0) && p.ToTime == new TimeOnly(15, 0, 0) && p.Percentage == 30m);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.LateCheckOut && p.FromTime == new TimeOnly(15, 0, 0) && p.ToTime == new TimeOnly(18, 0, 0) && p.Percentage == 50m);
        Assert.Contains(policies, p => p.SurchargeType == SurchargeType.LateCheckOut && p.FromTime == new TimeOnly(18, 0, 0) && p.ToTime == new TimeOnly(23, 59, 59) && p.Percentage == 100m);

        // UpdatePropertyCommand with IsPublished = null MUST NOT auto-publish
        var updateHandler = new UpdatePropertyCommandHandler(db, tenantSvc, LocationService);
        var updatedNullPublish = await updateHandler.Handle(new UpdatePropertyCommand(
            PropertyId: createdEntity.Id,
            Name: "Da Nang Ocean Updated",
            Address: "50 Vo Nguyen Giap",
            City: "Đà Nẵng"), CancellationToken.None);
        Assert.False(updatedNullPublish.IsPublished);
        Assert.False(createdEntity.IsPublished);

        // Explicit IsPublished = true toggles publish state
        var updatedPublished = await updateHandler.Handle(new UpdatePropertyCommand(
            PropertyId: createdEntity.Id,
            Name: "Da Nang Ocean Updated",
            Address: "50 Vo Nguyen Giap",
            City: "Đà Nẵng",
            IsPublished: true), CancellationToken.None);
        Assert.True(updatedPublished.IsPublished);
        Assert.True(createdEntity.IsPublished);
    }

    [Fact]
    public async Task AiController_DynamicPricingRecommendations_HasNoAllowAnonymous_And_RejectsUnauthenticatedAndWrongBranch()
    {
        var method = typeof(AiController).GetMethod(nameof(AiController.GetDynamicPricingRecommendations))!;
        Assert.Empty(method.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true));
        Assert.NotEmpty(method.GetCustomAttributes<AuthorizeAttribute>(inherit: true));
        var permAttrs = method.GetCustomAttributes<RequirePermissionAttribute>(inherit: true).ToList();
        Assert.Contains(permAttrs, a => a.FunctionCode == "AI_FEATURES" && (a.RequiredAction & PermissionAction.Read) == PermissionAction.Read);

        var tenantId = Guid.NewGuid();
        var propA = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Branch A", Code = "A", Status = PropertyStatus.Active };
        var propB = new Property { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Branch B", Code = "B", Status = PropertyStatus.Active };

        var db = new FakeReportsDbContext();
        db.PropertiesSet.AddRange(propA, propB);

        // 1. Unauthenticated caller -> 401 Unauthorized
        var anonCtx = CreateUserContext(null, null, isTenantWide: false, authenticated: false);
        var anonController = new AiController(db, anonCtx, new StubSender(), LocationService, new StubDynamicPricingService());
        var anonRes = await anonController.GetDynamicPricingRecommendations(propA.Id, null, CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(anonRes);

        // 2. Wrong-branch single-branch staff -> 403 Forbid
        var branchACtx = CreateUserContext(tenantId, propA.Id, isTenantWide: false, authenticated: true);
        var branchAController = new AiController(db, branchACtx, new StubSender(), LocationService, new StubDynamicPricingService());
        var wrongBranchRes = await branchAController.GetDynamicPricingRecommendations(propB.Id, null, CancellationToken.None);
        Assert.IsType<ForbidResult>(wrongBranchRes);

        // 3. Same-branch authorized staff -> 200 OK
        var sameBranchRes = await branchAController.GetDynamicPricingRecommendations(propA.Id, null, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(sameBranchRes);
        var dto = Assert.IsType<DynamicPricingSummaryDto>(ok.Value);
        Assert.Equal(propA.Id, dto.PropertyId);
    }
}

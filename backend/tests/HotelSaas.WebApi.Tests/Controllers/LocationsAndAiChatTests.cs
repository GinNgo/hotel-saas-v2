using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.DTOs;
using HotelSaas.Application.AuditLogs.Services;
using HotelSaas.Application.Ai.Queries.GetDynamicPricingRecommendations;
using HotelSaas.Application.Ai.Queries.ProcessAiChat;
using HotelSaas.Application.Ai.Queries.ProcessAiConcierge;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Queries.GenerateVietQr;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Application.Print.Commands.SavePrintTemplateConfig;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Application.Print.Queries.GetPrintableContract;
using HotelSaas.Application.Print.Queries.GetPrintableInvoice;
using HotelSaas.Application.Print.Queries.GetPrintableVoucher;
using HotelSaas.Application.Print.Queries.GetPrintTemplateConfig;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace HotelSaas.WebApi.Tests.Controllers;

/// <summary>
/// Controller-level tests verifying GPS reverse geocoding, grounded AI chat with Google Maps chunks,
/// anonymous IgnoreQueryFilters access on AI endpoints, and PublicController CreateHold IDOR protection.
/// </summary>
public sealed class LocationsAndAiChatTests
{
    private static readonly LocationLookupService LocationService = new();

    private sealed class CapturingSender : ISender
    {
        private readonly Func<object, CancellationToken, Task<object?>> _responder;
        public List<object> SentRequests { get; } = new();

        public CapturingSender(Func<object, object?>? responder = null)
        {
            _responder = responder == null
                ? (_, _) => Task.FromResult<object?>(null)
                : (req, _) => Task.FromResult(responder(req));
        }

        public CapturingSender(Func<object, CancellationToken, Task<object?>> asyncResponder)
        {
            _responder = asyncResponder ?? throw new ArgumentNullException(nameof(asyncResponder));
        }

        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            var response = await _responder(request, cancellationToken);
            return (TResponse)response!;
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            SentRequests.Add(request);
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            return _responder(request, cancellationToken);
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private static AiController CreateAiController(
        IApplicationDbContext db,
        ICurrentUserContext userCtx,
        ISender innerSender,
        ILocationLookupService? locationService = null,
        IDynamicPricingService? dynamicPricingService = null)
    {
        var locSvc = locationService ?? LocationService;
        var dispatcher = new CapturingSender(async (req, ct) => req switch
        {
            ProcessAiConciergeQuery q => await new ProcessAiConciergeQueryHandler(db, userCtx).Handle(q, ct),
            GetDynamicPricingRecommendationsQuery q => await new GetDynamicPricingRecommendationsQueryHandler(db, userCtx, dynamicPricingService).Handle(q, ct),
            ProcessAiChatQuery q => await new ProcessAiChatQueryHandler(innerSender, locSvc).Handle(q, ct),
            _ => await innerSender.Send(req, ct)
        });
        return new AiController(dispatcher);
    }

    private static PrintDocumentsController CreatePrintController(
        IApplicationDbContext db,
        ICurrentUserContext userCtx)
    {
        var dispatcher = new CapturingSender(async (req, ct) => req switch
        {
            GetPrintableInvoiceQuery q => await new GetPrintableInvoiceQueryHandler(db, userCtx).Handle(q, ct),
            GetPrintableVoucherQuery q => await new GetPrintableVoucherQueryHandler(db, userCtx).Handle(q, ct),
            GetPrintableContractQuery q => await new GetPrintableContractQueryHandler(db, userCtx).Handle(q, ct),
            GetPrintTemplateConfigQuery q => await new GetPrintTemplateConfigQueryHandler(db, userCtx).Handle(q, ct),
            _ => throw new NotSupportedException($"Unexpected request: {req.GetType().Name}")
        });
        return new PrintDocumentsController(dispatcher);
    }

    private static ICurrentUserContext CreateAnonymousUserContext() =>
        new CurrentUserContext(new CurrentTenantService(), new CurrentPropertyService());

    private sealed class TrackingAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly IQueryable<TEntity> _source;
        private readonly Action<Expression> _onExecute;

        public TrackingAsyncQueryProvider(IQueryable<TEntity> source, Action<Expression> onExecute)
        {
            _source = source;
            _onExecute = onExecute;
        }

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(TrackingAsyncQueryable<>).MakeGenericType(elementType),
                expression, this, _onExecute)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression) =>
            new TrackingAsyncQueryable<TElement>(expression, this, _onExecute);

        public object? Execute(Expression expression)
        {
            _onExecute(expression);
            var rewritten = TrackingEfExpressionRewriter.StripEfMethods(expression, _source);
            return _source.Provider.Execute(rewritten);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            _onExecute(expression);
            var rewritten = TrackingEfExpressionRewriter.StripEfMethods(expression, _source);
            return _source.Provider.Execute<TResult>(rewritten);
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            _onExecute(expression);
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var rewritten = TrackingEfExpressionRewriter.StripEfMethods(expression, _source);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(_source.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class TrackingAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;
        private readonly Action<Expression> _onExecute;

        public TrackingAsyncQueryable(Expression expression, IAsyncQueryProvider provider, Action<Expression> onExecute)
        {
            _expression = expression;
            _provider = provider;
            _onExecute = onExecute;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator() =>
            _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _onExecute(_expression);
            return new TrackingAsyncEnumerator<TElement>(GetEnumerator());
        }
    }

    private sealed class TrackingEfExpressionRewriter : ExpressionVisitor
    {
        private readonly IQueryable _rootQueryable;

        private TrackingEfExpressionRewriter(IQueryable rootQueryable) => _rootQueryable = rootQueryable;

        public static Expression StripEfMethods(Expression expression, IQueryable rootQueryable) =>
            new TrackingEfExpressionRewriter(rootQueryable).Visit(expression);

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
                if (genDef == typeof(TrackingAsyncDbSet<>) || genDef == typeof(TrackingAsyncQueryable<>))
                {
                    return _rootQueryable.Expression;
                }
            }

            return base.VisitConstant(node);
        }
    }

    private sealed class TrackingAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public TrackingAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
        public ValueTask<bool> MoveNextAsync() => new(_inner.MoveNext());
    }

    private sealed class TrackingAsyncDbSet<T> : DbSet<T>, IQueryable<T>, IAsyncEnumerable<T> where T : class
    {
        private readonly List<T> _items;
        private readonly IQueryable<T> _queryable;
        private readonly Action<Expression> _onExecute;
        private readonly TrackingAsyncQueryProvider<T> _provider;

        public TrackingAsyncDbSet(IEnumerable<T> data, Action<Expression> onExecute)
        {
            _onExecute = onExecute;
            _items = data.ToList();
            _queryable = _items.AsQueryable();
            _provider = new TrackingAsyncQueryProvider<T>(_queryable, _onExecute);
        }

        public override EntityEntry<T> Add(T entity)
        {
            _items.Add(entity);
            return null!;
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(T);
        Expression IQueryable.Expression => _queryable.Expression;
        IQueryProvider IQueryable.Provider => _provider;

        public override IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        {
            _onExecute(_queryable.Expression);
            return new TrackingAsyncEnumerator<T>(_queryable.GetEnumerator());
        }

        IEnumerator<T> IEnumerable<T>.GetEnumerator() => _queryable.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _queryable.GetEnumerator();
    }

    private sealed class AiFakeDbContext : IApplicationDbContext
    {
        public List<string> ExecutedExpressions { get; } = new();

        public AiFakeDbContext(
            IEnumerable<Property> properties,
            IEnumerable<RoomType> roomTypes,
            IEnumerable<Reservation>? reservations = null,
            IEnumerable<TenantContract>? tenantContracts = null,
            IEnumerable<PrintTemplateConfig>? printTemplateConfigs = null,
            IEnumerable<Invoice>? invoices = null,
            IEnumerable<Room>? rooms = null,
            IEnumerable<SupportAccessGrant>? supportAccessGrants = null)
        {
            Properties = new TrackingAsyncDbSet<Property>(properties, e => ExecutedExpressions.Add(e.ToString()));
            RoomTypes = new TrackingAsyncDbSet<RoomType>(roomTypes, e => ExecutedExpressions.Add(e.ToString()));
            Reservations = new TrackingAsyncDbSet<Reservation>(reservations ?? Array.Empty<Reservation>(), e => ExecutedExpressions.Add(e.ToString()));
            TenantContracts = new TrackingAsyncDbSet<TenantContract>(tenantContracts ?? Array.Empty<TenantContract>(), e => ExecutedExpressions.Add(e.ToString()));
            PrintTemplateConfigs = new TrackingAsyncDbSet<PrintTemplateConfig>(printTemplateConfigs ?? Array.Empty<PrintTemplateConfig>(), e => ExecutedExpressions.Add(e.ToString()));
            Invoices = new TrackingAsyncDbSet<Invoice>(invoices ?? Array.Empty<Invoice>(), e => ExecutedExpressions.Add(e.ToString()));
            Rooms = new TrackingAsyncDbSet<Room>(rooms ?? Array.Empty<Room>(), e => ExecutedExpressions.Add(e.ToString()));
            SupportAccessGrants = new TrackingAsyncDbSet<SupportAccessGrant>(supportAccessGrants ?? Array.Empty<SupportAccessGrant>(), e => ExecutedExpressions.Add(e.ToString()));
        }

        public DbSet<Property> Properties { get; }
        public DbSet<RoomType> RoomTypes { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<Tenant> Tenants => throw new NotImplementedException();
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<Room> Rooms { get; }
        public DbSet<Reservation> Reservations { get; }
        public DbSet<Payment> Payments => throw new NotImplementedException();
        public DbSet<Subscription> Subscriptions => throw new NotImplementedException();
        public DbSet<SubscriptionPlan> SubscriptionPlans => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices { get; }
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts { get; }
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs { get; }
        public DbSet<SupportAccessGrant> SupportAccessGrants { get; }
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

    private sealed class StubDynamicPricingService : IDynamicPricingService
    {
        public Task<DynamicPricingAdjustmentDto?> CalculateDynamicAdjustmentAsync(
            Guid propertyId, Guid roomTypeId, RentalType rentalType, DateOnly startDate, DateOnly endDate, decimal basePrice, CancellationToken cancellationToken = default)
            => Task.FromResult<DynamicPricingAdjustmentDto?>(null);

        public Task<DynamicPricingSummaryDto> GetPricingRecommendationsAsync(Guid propertyId, DateOnly targetDate, CancellationToken cancellationToken = default)
            => Task.FromResult(new DynamicPricingSummaryDto(propertyId, "Test Hotel", targetDate, 0.5, "Normal", Array.Empty<RoomTypePricingRecommendationDto>()));
    }

    [Fact]
    public void LocationsController_Reverse_ValidCoordinates_ReturnsOkWithDisplayLabel()
    {
        var controller = new LocationsController(LocationService);
        var result = controller.ReverseGeocode(10.7725, 106.6980);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var dataProp = ok.Value.GetType().GetProperty("data")!;
        var dto = Assert.IsType<ReverseGeocodeResultDto>(dataProp.GetValue(ok.Value));
        Assert.Equal("cho-ben-thanh", dto.NearestLandmarkSlug);
        Assert.StartsWith("Gần Chợ Bến Thành", dto.DisplayLabel, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(-90.1, 106.7)]
    [InlineData(90.1, 106.7)]
    [InlineData(10.7, -180.1)]
    [InlineData(10.7, 180.1)]
    [InlineData(double.NaN, 106.7)]
    [InlineData(10.7, double.PositiveInfinity)]
    public void LocationsController_Reverse_InvalidCoordinates_Returns400BadRequest(double lat, double lng)
    {
        var controller = new LocationsController(LocationService);
        var result = controller.ReverseGeocode(lat, lng);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task AiController_Chat_EmptyMessage_Returns400BadRequest()
    {
        var sender = new CapturingSender();
        var controller = CreateAiController(
            new AiFakeDbContext(Array.Empty<Property>(), Array.Empty<RoomType>()),
            CreateAnonymousUserContext(),
            sender,
            LocationService);

        var result = await controller.ProcessChatQuery(
            new AiChatRequest { Message = "   " },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(sender.SentRequests);
    }

    [Fact]
    public async Task AiController_Chat_WithLocationAndQuery_ReturnsGroundedPropertiesAndMapsLinks()
    {
        var prop = new PublicPropertyDto
        {
            Id = Guid.NewGuid(),
            Name = "Saigon Luxe Boutique",
            City = "TP. Hồ Chí Minh",
            ProvinceName = "TP. Hồ Chí Minh",
            Address = "10 Lê Lợi, Quận 1",
            Latitude = 10.7731,
            Longitude = 106.6988,
            DistanceMeters = 120,
            DistanceFormatted = "Cách 120m",
            HourlyStartingPrice = 250000m,
            OvernightStartingPrice = 950000m,
            StartingPrice = 950000m
        };

        var sender = new CapturingSender(req =>
            req is GetPublicPropertiesQuery ? new[] { prop } : null);

        var controller = CreateAiController(
            new AiFakeDbContext(Array.Empty<Property>(), Array.Empty<RoomType>()),
            CreateAnonymousUserContext(),
            sender,
            LocationService);

        var result = await controller.ProcessChatQuery(
            new AiChatRequest
            {
                Message = "Tìm khách sạn gần tôi",
                Messages = new List<AiChatHistoryMessage>(),
                Location = new AiChatLocation { Latitude = 10.7725, Longitude = 106.6980 }
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<AiChatResponse>(ok.Value);
        Assert.Contains("Saigon Luxe Boutique", body.Text, StringComparison.Ordinal);
        Assert.Contains("Check-in", body.Text, StringComparison.Ordinal);
        Assert.Contains("Gần Chợ Bến Thành", body.Text, StringComparison.Ordinal);

        var chunk = Assert.Single(body.GroundingChunks);
        Assert.NotNull(chunk.Maps);
        Assert.Contains("Saigon Luxe Boutique", chunk.Maps!.Title, StringComparison.Ordinal);
        Assert.Equal("https://www.google.com/maps/search/?api=1&query=10.7731,106.6988", chunk.Maps.Uri);
    }

    [Fact]
    public async Task AiController_ConciergePolicyInquiry_UsesConfiguredPropertyCheckInAndCheckOutTimes()
    {
        var prop = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Name = "Custom Hours Boutique",
            Slug = "custom-hours-boutique",
            City = "Đà Nẵng",
            Address = "200 Võ Nguyên Giáp",
            CheckInTime = new TimeOnly(15, 30),
            CheckOutTime = new TimeOnly(11, 0),
            Status = PropertyStatus.Active
        };

        var db = new AiFakeDbContext(new[] { prop }, Array.Empty<RoomType>());
        var controller = CreateAiController(
            db,
            CreateAnonymousUserContext(),
            new CapturingSender(),
            LocationService);

        var res = await controller.ProcessConciergeQuery(
            new AiConciergeRequest { Message = "Chính sách nhận phòng và trả phòng thế nào?", PropertySlug = "custom-hours-boutique" },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(res);
        var dto = Assert.IsType<AiConciergeResponse>(ok.Value);
        Assert.Equal("PolicyInquiry", dto.Intent);
        Assert.Contains("15:30", dto.Reply, StringComparison.Ordinal);
        Assert.Contains("11:00", dto.Reply, StringComparison.Ordinal);
        Assert.DoesNotContain("14:00", dto.Reply, StringComparison.Ordinal);
        Assert.DoesNotContain("12:00", dto.Reply, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AiController_Chat_UsesTopPropertyCheckInAndCheckOutTimes_AndFallsBackWhenEmpty()
    {
        var prop = new PublicPropertyDto
        {
            Id = Guid.NewGuid(),
            Name = "Early Checkout Villa",
            City = "Đà Lạt",
            ProvinceName = "Lâm Đồng",
            Address = "5 Trần Phú",
            CheckInTime = new TimeOnly(15, 0),
            CheckOutTime = new TimeOnly(11, 30),
            StartingPrice = 1200000m
        };

        var matchedController = CreateAiController(
            new AiFakeDbContext(Array.Empty<Property>(), Array.Empty<RoomType>()),
            CreateAnonymousUserContext(),
            new CapturingSender(req => req is GetPublicPropertiesQuery ? new[] { prop } : null),
            LocationService);

        var matchedOk = Assert.IsType<OkObjectResult>(await matchedController.ProcessChatQuery(
            new AiChatRequest { Message = "Tìm villa ở Đà Lạt" },
            CancellationToken.None));
        var matchedBody = Assert.IsType<AiChatResponse>(matchedOk.Value);
        Assert.Contains("15:00", matchedBody.Text, StringComparison.Ordinal);
        Assert.Contains("11:30", matchedBody.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("14:00", matchedBody.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("12:00", matchedBody.Text, StringComparison.Ordinal);

        var emptyController = CreateAiController(
            new AiFakeDbContext(Array.Empty<Property>(), Array.Empty<RoomType>()),
            CreateAnonymousUserContext(),
            new CapturingSender(req => req is GetPublicPropertiesQuery ? Array.Empty<PublicPropertyDto>() : null),
            LocationService);

        var emptyOk = Assert.IsType<OkObjectResult>(await emptyController.ProcessChatQuery(
            new AiChatRequest { Message = "Tìm khách sạn" },
            CancellationToken.None));
        var emptyBody = Assert.IsType<AiChatResponse>(emptyOk.Value);
        Assert.Contains("14:00", emptyBody.Text, StringComparison.Ordinal);
        Assert.Contains("12:00", emptyBody.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AiController_AnonymousConciergeAndPricing_ApplyIgnoreQueryFilters()
    {
        var propId = Guid.NewGuid();
        var prop = new Property
        {
            Id = propId,
            TenantId = Guid.NewGuid(),
            Name = "Public Concierge Stay",
            Slug = "public-concierge-stay",
            City = "Đà Nẵng",
            Address = "100 Võ Nguyên Giáp",
            Status = PropertyStatus.Active
        };
        var rt = new RoomType
        {
            Id = Guid.NewGuid(),
            TenantId = prop.TenantId,
            PropertyId = propId,
            Name = "Deluxe Sea View",
            MaxOccupancy = 2,
            BasePrice = 800000m
        };

        var db = new AiFakeDbContext(new[] { prop }, new[] { rt });
        var controller = CreateAiController(
            db,
            CreateAnonymousUserContext(),
            new CapturingSender(),
            LocationService,
            new StubDynamicPricingService());

        var conciergeRes = await controller.ProcessConciergeQuery(
            new AiConciergeRequest { Message = "Tôi muốn tìm phòng cho 2 người" },
            CancellationToken.None);
        var conciergeOk = Assert.IsType<OkObjectResult>(conciergeRes);
        var conciergeDto = Assert.IsType<AiConciergeResponse>(conciergeOk.Value);
        Assert.Single(conciergeDto.SuggestedRooms);

        var pricingRes = await controller.GetDynamicPricingRecommendations(null, null, CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(pricingRes);

        Assert.Contains(db.ExecutedExpressions, expr => expr.Contains("Property", StringComparison.Ordinal));
        Assert.Contains(db.ExecutedExpressions, expr => expr.Contains("RoomType", StringComparison.Ordinal));
        Assert.Contains(db.ExecutedExpressions, expr => expr.Contains("Take(6)", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PublicController_CreateHold_AnonymousRequest_IgnoresBodyGuestUserId_PreventingIdor()
    {
        var expectedHold = new GuestHoldDto
        {
            ReservationId = Guid.NewGuid(),
            ConfirmationCode = "HOLD-123",
            LookupToken = "lookup-token",
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(15),
            TotalAmount = 1_000_000m,
            Status = "PendingPayment",
            PropertyName = "Public Stay",
            AssignedRoomNumber = "101",
            IsPhoneVerified = true
        };

        var sender = new CapturingSender(_ => expectedHold);
        var controller = new PublicController(sender, LocationService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var spoofedVictimId = Guid.NewGuid();
        var req = new CreateGuestHoldRequest(
            PropertySlug: "public-stay",
            RoomTypeId: Guid.NewGuid(),
            RentalType: RentalType.Overnight,
            StartAtUtc: DateTime.UtcNow.AddDays(5),
            EndAtUtc: DateTime.UtcNow.AddDays(6),
            GuestName: "Attacker",
            GuestEmail: "attacker@example.com",
            GuestPhone: "+84123456789",
            NumberOfGuests: 1,
            GuestUserId: spoofedVictimId,
            FirebaseIdToken: "valid-token");

        var res = await controller.CreateHold(req, CancellationToken.None);
        var created = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);

        var dispatched = Assert.IsType<CreateGuestHoldCommand>(Assert.Single(sender.SentRequests));
        Assert.Null(dispatched.GuestUserId);
    }

    [Fact]
    public async Task PublicController_CreateHold_AuthenticatedRequest_UsesClaimUserId_IgnoringBodySpoof()
    {
        var expectedHold = new GuestHoldDto
        {
            ReservationId = Guid.NewGuid(),
            ConfirmationCode = "HOLD-456",
            LookupToken = "lookup-token-2",
            HoldExpiresAtUtc = DateTime.UtcNow.AddMinutes(15),
            TotalAmount = 1_000_000m,
            Status = "PendingPayment",
            PropertyName = "Public Stay",
            AssignedRoomNumber = "102",
            IsPhoneVerified = true
        };

        var sender = new CapturingSender(_ => expectedHold);
        var authenticatedUserId = Guid.NewGuid();
        var spoofedVictimId = Guid.NewGuid();

        var identity = new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.ToString()) },
            authenticationType: "Bearer");

        var controller = new PublicController(sender, LocationService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(identity)
                }
            }
        };

        var req = new CreateGuestHoldRequest(
            PropertySlug: "public-stay",
            RoomTypeId: Guid.NewGuid(),
            RentalType: RentalType.Overnight,
            StartAtUtc: DateTime.UtcNow.AddDays(5),
            EndAtUtc: DateTime.UtcNow.AddDays(6),
            GuestName: "Real Member",
            GuestEmail: "member@example.com",
            GuestPhone: "+84123456789",
            NumberOfGuests: 1,
            GuestUserId: spoofedVictimId);

        await controller.CreateHold(req, CancellationToken.None);

        var dispatched = Assert.IsType<CreateGuestHoldCommand>(Assert.Single(sender.SentRequests));
        Assert.Equal(authenticatedUserId, dispatched.GuestUserId);
        Assert.NotEqual(spoofedVictimId, dispatched.GuestUserId);
    }

    [Fact]
    public async Task PrintDocumentsController_GetPrintableContract_EnforcesTenantIsolationAndAllowsOwnerOrSuperAdmin()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var contract = new TenantContract
        {
            Id = Guid.NewGuid(),
            TenantId = tenantB,
            ContractNumber = "HD-2026-PRO-009",
            PlanCode = "PRO",
            PlanName = "Gói Chuyên Nghiệp",
            RepresentativeName = "Tran Van B",
            RepresentativeEmail = "rep@tenantb.vn",
            RepresentativePhone = "0909998888",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 12, 31),
            ContractValue = 24_000_000m,
            Status = TenantContractStatus.Active
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            tenantContracts: new[] { contract });

        // Cross-tenant user must be rejected with 403 Forbid
        var crossTenantUser = CreateAnonymousUserContext();
        crossTenantUser.SetUser(Guid.NewGuid(), "manager@tenanta.vn", GlobalUserRole.TenantStaff);
        crossTenantUser.SetMembershipContext(tenantA, TenantStatus.Active, null, null, StaffRole.Manager, null, isTenantWide: true);
        var crossTenantController = CreatePrintController(fakeDb, crossTenantUser);

        var forbiddenResult = await crossTenantController.GetPrintableContract(contract.Id, CancellationToken.None);
        Assert.IsType<ForbidResult>(forbiddenResult);

        // Same-tenant user succeeds
        var sameTenantUser = CreateAnonymousUserContext();
        sameTenantUser.SetUser(Guid.NewGuid(), "owner@tenantb.vn", GlobalUserRole.TenantStaff);
        sameTenantUser.SetMembershipContext(tenantB, TenantStatus.Active, null, null, StaffRole.Owner, null, isTenantWide: true);
        var sameTenantController = CreatePrintController(fakeDb, sameTenantUser);

        var sameTenantResult = await sameTenantController.GetPrintableContract(contract.Id, CancellationToken.None);
        var sameTenantOk = Assert.IsType<OkObjectResult>(sameTenantResult);
        var sameTenantDto = Assert.IsType<PrintableContractDocumentDto>(sameTenantOk.Value);
        Assert.Equal("HD-2026-PRO-009", sameTenantDto.ContractNumber);

        // SuperAdmin succeeds across tenants
        var superAdmin = CreateAnonymousUserContext();
        superAdmin.SetUser(Guid.NewGuid(), "admin@platform.vn", GlobalUserRole.SuperAdmin);
        var superAdminController = CreatePrintController(fakeDb, superAdmin);

        var superAdminResult = await superAdminController.GetPrintableContract(contract.Id, CancellationToken.None);
        var superAdminOk = Assert.IsType<OkObjectResult>(superAdminResult);
        var superAdminDto = Assert.IsType<PrintableContractDocumentDto>(superAdminOk.Value);
        Assert.Equal("HD-2026-PRO-009", superAdminDto.ContractNumber);

        // Same-tenant Receptionist without SUBSCRIPTIONS permission -> 403 Forbid
        var sameTenantReceptionist = CreateAnonymousUserContext();
        sameTenantReceptionist.SetUser(Guid.NewGuid(), "receptionist@tenantb.vn", GlobalUserRole.TenantStaff);
        sameTenantReceptionist.SetMembershipContext(tenantB, TenantStatus.Active, Guid.NewGuid(), PropertyStatus.Active, StaffRole.Receptionist, null, isTenantWide: false);
        var receptionistController = CreatePrintController(fakeDb, sameTenantReceptionist);
        Assert.IsType<ForbidResult>(await receptionistController.GetPrintableContract(contract.Id, CancellationToken.None));
    }

    [Fact]
    public async Task PrintDocumentsController_GetPrintableInvoice_MasksPiiForAnonymous_UnlessAuthorizedOrCodeMatches()
    {
        var tenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var guestUserId = Guid.NewGuid();
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            GuestUserId = guestUserId,
            ConfirmationCode = "LUX8899",
            GuestName = "Nguyen Van Khach",
            GuestEmail = "guest.secret@example.com",
            GuestPhone = "0901234567",
            CheckInDate = new DateOnly(2026, 6, 1),
            CheckOutDate = new DateOnly(2026, 6, 3),
            NumberOfGuests = 2,
            TotalAmount = 2_400_000m,
            Room = new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                RoomNumber = "305",
                RoomType = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    Name = "Deluxe River View"
                }
            },
            Payments = new List<Payment>()
        };

        var printConfig = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            HeaderCompanyName = "Khách sạn Sông Hàn",
            BankName = "MBBank",
            BankAccountNumber = "999988887777",
            BankAccountHolder = "CTY KHACH SAN SONG HAN",
            ShowVietQrCode = true
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            reservations: new[] { reservation },
            printTemplateConfigs: new[] { printConfig });

        // 1. Anonymous without confirmation code -> masked PII & hidden VietQR
        var anonController = CreatePrintController(fakeDb, CreateAnonymousUserContext());
        var anonOk = Assert.IsType<OkObjectResult>(await anonController.GetPrintableInvoice(reservation.Id, null, CancellationToken.None));
        var anonDto = Assert.IsType<PrintableInvoiceDto>(anonOk.Value);
        Assert.NotEqual("Nguyen Van Khach", anonDto.GuestName);
        Assert.Equal("N*** V*** K***", anonDto.GuestName);
        Assert.Equal("g***@example.com", anonDto.GuestEmail);
        Assert.Equal("090****567", anonDto.GuestPhone);
        Assert.Equal("***", anonDto.RoomNumber);
        Assert.False(anonDto.ShowVietQrCode);
        Assert.Equal(string.Empty, anonDto.VietQrImageUrl);
        Assert.NotEqual("999988887777", anonDto.BankAccountNumber);
        Assert.EndsWith("777", anonDto.BankAccountNumber);
        Assert.Equal("C*** K*** S*** S*** H***", anonDto.BankAccountHolder);
        Assert.DoesNotContain("305", anonDto.Items[0].Description);

        // 2. Anonymous with matching confirmation code -> unmasked PII & VietQR visible
        var codeOk = Assert.IsType<OkObjectResult>(await anonController.GetPrintableInvoice(reservation.Id, "lux8899", CancellationToken.None));
        var codeDto = Assert.IsType<PrintableInvoiceDto>(codeOk.Value);
        Assert.Equal("Nguyen Van Khach", codeDto.GuestName);
        Assert.Equal("guest.secret@example.com", codeDto.GuestEmail);
        Assert.Equal("0901234567", codeDto.GuestPhone);
        Assert.Equal("305", codeDto.RoomNumber);
        Assert.True(codeDto.ShowVietQrCode);
        Assert.Contains("img.vietqr.io", codeDto.VietQrImageUrl);
        Assert.Equal("999988887777", codeDto.BankAccountNumber);

        // 3. Authenticated guest owner -> unmasked PII & VietQR visible
        var guestContext = CreateAnonymousUserContext();
        guestContext.SetUser(guestUserId, "guest.secret@example.com", GlobalUserRole.Customer);
        var guestController = CreatePrintController(fakeDb, guestContext);
        var guestOk = Assert.IsType<OkObjectResult>(await guestController.GetPrintableInvoice(reservation.Id, null, CancellationToken.None));
        var guestDto = Assert.IsType<PrintableInvoiceDto>(guestOk.Value);
        Assert.Equal("Nguyen Van Khach", guestDto.GuestName);
        Assert.Equal("guest.secret@example.com", guestDto.GuestEmail);
        Assert.Equal("0901234567", guestDto.GuestPhone);
        Assert.Equal("305", guestDto.RoomNumber);
        Assert.True(guestDto.ShowVietQrCode);
        Assert.Contains("img.vietqr.io", guestDto.VietQrImageUrl);
        Assert.Equal("999988887777", guestDto.BankAccountNumber);

        // 4. Authenticated unrelated user in different tenant without code -> masked PII & hidden VietQR
        var outsiderContext = CreateAnonymousUserContext();
        outsiderContext.SetUser(Guid.NewGuid(), "outsider@other.vn", GlobalUserRole.TenantStaff);
        outsiderContext.SetMembershipContext(otherTenantId, TenantStatus.Active, null, null, StaffRole.Manager, null, isTenantWide: true);
        var outsiderController = CreatePrintController(fakeDb, outsiderContext);
        var outsiderOk = Assert.IsType<OkObjectResult>(await outsiderController.GetPrintableInvoice(reservation.Id, null, CancellationToken.None));
        var outsiderDto = Assert.IsType<PrintableInvoiceDto>(outsiderOk.Value);
        Assert.NotEqual("Nguyen Van Khach", outsiderDto.GuestName);
        Assert.Equal("g***@example.com", outsiderDto.GuestEmail);
        Assert.Equal("090****567", outsiderDto.GuestPhone);
        Assert.Equal("***", outsiderDto.RoomNumber);
        Assert.False(outsiderDto.ShowVietQrCode);
        Assert.Equal(string.Empty, outsiderDto.VietQrImageUrl);
        Assert.NotEqual("999988887777", outsiderDto.BankAccountNumber);
    }

    [Fact]
    public async Task PrintDocumentsController_GetTemplateConfig_ForbidsMissingAndCrossTenant_AndHasNoDummyBankFallback()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var propA1 = Guid.NewGuid();
        var propA2 = Guid.NewGuid();

        var configTenantADefault = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            PropertyId = null,
            HeaderCompanyName = "Chuỗi Khách Sạn A",
            BankName = "Techcombank",
            BankAccountNumber = "1903000111222",
            BankAccountHolder = "CTY A HQ",
            ShowVietQrCode = true
        };
        var configPropA1 = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            PropertyId = propA1,
            HeaderCompanyName = "Chi nhánh A1",
            BankName = "Vietcombank",
            BankAccountNumber = "0071000111222",
            BankAccountHolder = "CHI NHANH A1",
            ShowVietQrCode = true
        };
        var configTenantB = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantB,
            PropertyId = null,
            HeaderCompanyName = "Khách Sạn B",
            BankName = "BIDV",
            BankAccountNumber = "3141000999888",
            BankAccountHolder = "CTY B",
            ShowVietQrCode = true
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            printTemplateConfigs: new[] { configTenantADefault, configPropA1, configTenantB });

        // 1. Anonymous user without tenant -> Forbid
        var anonController = CreatePrintController(fakeDb, CreateAnonymousUserContext());
        Assert.IsType<ForbidResult>(await anonController.GetTemplateConfig(null, null, CancellationToken.None));

        // 2. SuperAdmin without tenantId -> Forbid
        var superAdmin = CreateAnonymousUserContext();
        superAdmin.SetUser(Guid.NewGuid(), "admin@platform.vn", GlobalUserRole.SuperAdmin);
        var superAdminController = CreatePrintController(fakeDb, superAdmin);
        Assert.IsType<ForbidResult>(await superAdminController.GetTemplateConfig(null, null, CancellationToken.None));

        // 3. Tenant A user attempting cross-tenant query for Tenant B -> Forbid
        var tenantAUser = CreateAnonymousUserContext();
        tenantAUser.SetUser(Guid.NewGuid(), "owner@tenanta.vn", GlobalUserRole.TenantStaff);
        tenantAUser.SetMembershipContext(tenantA, TenantStatus.Active, null, null, StaffRole.Owner, null, isTenantWide: true);
        var tenantAController = CreatePrintController(fakeDb, tenantAUser);
        Assert.IsType<ForbidResult>(await tenantAController.GetTemplateConfig(tenantB, null, CancellationToken.None));

        // 4. Tenant A requesting propA1 prefers propA1 config over tenantA default
        var propA1Ok = Assert.IsType<OkObjectResult>(await tenantAController.GetTemplateConfig(null, propA1, CancellationToken.None));
        var propA1Dto = Assert.IsType<PrintTemplateConfigDto>(propA1Ok.Value);
        Assert.Equal("0071000111222", propA1Dto.BankAccountNumber);
        Assert.Equal("Vietcombank", propA1Dto.BankName);

        // 5. Tenant A requesting propA2 (no specific config) falls back to tenantA default (never Tenant B)
        var propA2Ok = Assert.IsType<OkObjectResult>(await tenantAController.GetTemplateConfig(null, propA2, CancellationToken.None));
        var propA2Dto = Assert.IsType<PrintTemplateConfigDto>(propA2Ok.Value);
        Assert.Equal("1903000111222", propA2Dto.BankAccountNumber);

        // 6. Tenant with no PrintTemplateConfig at all gets empty bank fields (never dummy "0988889999")
        var tenantC = Guid.NewGuid();
        var tenantCUser = CreateAnonymousUserContext();
        tenantCUser.SetUser(Guid.NewGuid(), "owner@tenantc.vn", GlobalUserRole.TenantStaff);
        tenantCUser.SetMembershipContext(tenantC, TenantStatus.Active, null, null, StaffRole.Owner, null, isTenantWide: true);
        var tenantCController = CreatePrintController(fakeDb, tenantCUser);
        var tenantCOk = Assert.IsType<OkObjectResult>(await tenantCController.GetTemplateConfig(null, null, CancellationToken.None));
        var tenantCDto = Assert.IsType<PrintTemplateConfigDto>(tenantCOk.Value);
        Assert.Equal(string.Empty, tenantCDto.BankAccountNumber);
        Assert.NotEqual("0988889999", tenantCDto.BankAccountNumber);
        Assert.False(tenantCDto.ShowVietQrCode);
    }

    [Fact]
    public async Task PrintDocumentsController_GetPrintableInvoice_ExcludesRefundTransactionsFromPaidAmount()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var resId = Guid.NewGuid();

        var reservation = new Reservation
        {
            Id = resId,
            TenantId = tenantId,
            PropertyId = propId,
            ConfirmationCode = "INV-REF-01",
            GuestName = "Tran Thi Thu",
            GuestEmail = "thu@example.com",
            GuestPhone = "0911222333",
            CheckInDate = new DateOnly(2026, 7, 1),
            CheckOutDate = new DateOnly(2026, 7, 3),
            NumberOfGuests = 2,
            TotalAmount = 2_000_000m,
            Payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    ReservationId = resId,
                    Amount = 1_500_000m,
                    Method = PaymentMethod.VNPay,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "VNPAY-20260701-01",
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-30)
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    ReservationId = resId,
                    Amount = 500_000m,
                    Method = PaymentMethod.BankTransfer,
                    Status = PaymentStatus.Completed,
                    TransactionRef = "REFUND-COMPLETED-001",
                    CreatedAtUtc = DateTime.UtcNow.AddMinutes(-10)
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    ReservationId = resId,
                    Amount = 500_000m,
                    Method = PaymentMethod.Cash,
                    Status = PaymentStatus.Pending,
                    TransactionRef = "CASH-PENDING-002",
                    CreatedAtUtc = DateTime.UtcNow
                }
            }
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            reservations: new[] { reservation });

        var staffContext = CreateAnonymousUserContext();
        staffContext.SetUser(Guid.NewGuid(), "cashier@hotel.vn", GlobalUserRole.TenantStaff);
        staffContext.SetMembershipContext(tenantId, TenantStatus.Active, propId, PropertyStatus.Active, StaffRole.Receptionist, null, isTenantWide: false);

        var controller = CreatePrintController(fakeDb, staffContext);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetPrintableInvoice(resId, null, CancellationToken.None));
        var dto = Assert.IsType<PrintableInvoiceDto>(ok.Value);

        Assert.Equal(1_500_000m, dto.PaidAmount);
        Assert.Equal(500_000m, dto.RemainingAmount);
        Assert.Equal("CÒN CÔNG NỢ", dto.Status);
        Assert.Equal(string.Empty, dto.BankAccountNumber);
        Assert.Equal(1_851_852m, dto.SubTotal);
        Assert.Equal(148_148m, dto.VatAmount);
        Assert.Equal(dto.TotalAmount, dto.SubTotal + dto.VatAmount);
    }

    [Fact]
    public async Task PrintDocumentsController_GetPrintableVoucher_SupportsLookupTokenAndConfirmationCode_WithPiiMasking()
    {
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var snapshot = new ReservationSnapshot
        {
            RentalType = RentalType.Overnight,
            StartAtUtc = DateTime.UtcNow.AddDays(1),
            EndAtUtc = DateTime.UtcNow.AddDays(2),
            BufferMinutes = 30,
            RoomTypeName = "Suite Deluxe",
            LookupToken = "vch-secret-lookup-token-999",
            TokenExpiresAtUtc = DateTime.UtcNow.AddDays(10),
            CustomerNotes = "Phòng tầng cao yên tĩnh"
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propId,
            ConfirmationCode = "VCH9900",
            GuestName = "Nguyen Van An",
            GuestEmail = "an.guest@example.com",
            GuestPhone = "0909888777",
            CheckInDate = new DateOnly(2026, 8, 1),
            CheckOutDate = new DateOnly(2026, 8, 2),
            NumberOfGuests = 2,
            TotalAmount = 1_800_000m,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapshot)
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            reservations: new[] { reservation });

        var anonController = CreatePrintController(fakeDb, CreateAnonymousUserContext());

        // 1. Anonymous lookup by short ConfirmationCode -> PII masked
        var codeOk = Assert.IsType<OkObjectResult>(await anonController.GetPrintableVoucher("VCH9900", CancellationToken.None));
        var codeDto = Assert.IsType<PrintableVoucherDto>(codeOk.Value);
        Assert.NotEqual("Nguyen Van An", codeDto.GuestName);
        Assert.NotEqual("an.guest@example.com", codeDto.GuestEmail);
        Assert.NotEqual("0909888777", codeDto.GuestPhone);
        Assert.Null(codeDto.SpecialRequests);

        // 2. Anonymous lookup by full LookupToken -> unmasked PII
        var tokenOk = Assert.IsType<OkObjectResult>(await anonController.GetPrintableVoucher("vch-secret-lookup-token-999", CancellationToken.None));
        var tokenDto = Assert.IsType<PrintableVoucherDto>(tokenOk.Value);
        Assert.Equal("Nguyen Van An", tokenDto.GuestName);
        Assert.Equal("an.guest@example.com", tokenDto.GuestEmail);
        Assert.Equal("0909888777", tokenDto.GuestPhone);
        Assert.Equal("Phòng tầng cao yên tĩnh", tokenDto.SpecialRequests);
    }

    [Fact]
    public async Task PrintDocumentsController_GetPrintableContract_UnsignedContract_ReturnsEmptyDigitalSignatureHash()
    {
        var tenantId = Guid.NewGuid();
        var unsignedContract = new TenantContract
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ContractNumber = "HD-DRAFT-001",
            PlanCode = "PRO",
            PlanName = "Pro",
            RepresentativeName = "Le Van Draft",
            RepresentativeEmail = "draft@tenant.vn",
            RepresentativePhone = "0901111222",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 12, 31),
            ContractValue = 12_000_000m,
            Status = TenantContractStatus.Draft,
            SignedAtUtc = null,
            DigitalSignatureHash = null
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            tenantContracts: new[] { unsignedContract });

        var superAdmin = CreateAnonymousUserContext();
        superAdmin.SetUser(Guid.NewGuid(), "admin@platform.vn", GlobalUserRole.SuperAdmin);
        var controller = CreatePrintController(fakeDb, superAdmin);

        var ok = Assert.IsType<OkObjectResult>(await controller.GetPrintableContract(unsignedContract.Id, CancellationToken.None));
        var dto = Assert.IsType<PrintableContractDocumentDto>(ok.Value);

        Assert.False(dto.IsSigned);
        Assert.Equal(string.Empty, dto.DigitalSignatureHash);
        Assert.Null(dto.SignedAtUtc);
    }

    [Fact]
    public async Task PaymentsController_GenerateVietQr_Returns422WhenBankNotConfigured_AndUsesPropertyConfig()
    {
        var tenantId = Guid.NewGuid();
        var propUnconfigured = Guid.NewGuid();
        var propConfigured = Guid.NewGuid();

        var resUnconfigured = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propUnconfigured,
            ConfirmationCode = "RES-NOBANK"
        };
        var resConfigured = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propConfigured,
            ConfirmationCode = "RES-HASBANK"
        };

        var bankConfig = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propConfigured,
            HeaderCompanyName = "Sao Mai Hotel",
            BankName = "Vietcombank",
            BankAccountNumber = "1122334455",
            BankAccountHolder = "KHACH SAN SAO MAI",
            ShowVietQrCode = true
        };

        var fakeDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            reservations: new[] { resUnconfigured, resConfigured },
            printTemplateConfigs: new[] { bankConfig });

        var vietQrService = new VietQrService();
        var controller = new PaymentsController(new CapturingSender(async (req, ct) => req switch
        {
            GenerateVietQrQuery q => await new GenerateVietQrQueryHandler(fakeDb, vietQrService).Handle(q, ct),
            _ => null
        }));

        // 1. Property without configured bank -> 422 UnprocessableEntity
        var unconfResult = await controller.GenerateVietQr(
            new VietQrApiRequest(500_000m, "RES-NOBANK", resUnconfigured.Id),
            CancellationToken.None);
        Assert.IsType<UnprocessableEntityObjectResult>(unconfResult);

        // 2. Property with configured bank -> 200 OK with real bank account (never dummy "0345678910")
        var confResult = await controller.GenerateVietQr(
            new VietQrApiRequest(500_000m, "RES-HASBANK", resConfigured.Id),
            CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(confResult);
        var apiResp = Assert.IsType<ApiResponse<VietQrResult>>(ok.Value);
        Assert.True(apiResp.Success);
        Assert.NotNull(apiResp.Data);
        Assert.Equal("970436", apiResp.Data!.BankBin);
        Assert.Equal("1122334455", apiResp.Data.AccountNumber);
        Assert.Equal("KHACH SAN SAO MAI", apiResp.Data.AccountName);
        Assert.NotEqual("0345678910", apiResp.Data.AccountNumber);
    }

    [Fact]
    public async Task SavePrintTemplateConfigCommandHandler_SuperAdminWithoutTenant_RequiresActiveDiagnosticGrant()
    {
        var supportUserId = Guid.NewGuid();
        var targetTenantId = Guid.NewGuid();
        var cmd = new SavePrintTemplateConfigCommand(
            TenantId: targetTenantId,
            BodyPropertyId: null,
            QueryPropertyId: null,
            HeaderCompanyName: "Grand Test Hotel",
            HeaderAddress: "88 Bach Dang",
            TaxNumber: "0312345678",
            Hotline: "1900 1234",
            LogoUrl: null,
            BankName: "Vietcombank",
            BankAccountNumber: "0071000999888",
            BankAccountHolder: "CTY TEST",
            FooterNote: "Cam on quy khach",
            CheckInPolicyText: "14:00 - 12:00",
            ShowVietQrCode: true,
            DefaultPaperSize: "A4");

        // 1. No grants -> ERR_SUPPORT_GRANT_REQUIRED
        var noGrantDb = new AiFakeDbContext(Array.Empty<Property>(), Array.Empty<RoomType>());
        var superAdminNoTenant = CreateAnonymousUserContext();
        superAdminNoTenant.SetUser(supportUserId, "support@platform.vn", GlobalUserRole.SuperAdmin);
        var noGrantHandler = new SavePrintTemplateConfigCommandHandler(noGrantDb, superAdminNoTenant);

        var exNoGrant = await Assert.ThrowsAsync<ForbiddenException>(() => noGrantHandler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_SUPPORT_GRANT_REQUIRED", exNoGrant.ErrorCode);

        // 2. Only READ_ONLY grant -> ERR_SUPPORT_GRANT_REQUIRED
        var readOnlyDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            supportAccessGrants: new[]
            {
                new SupportAccessGrant
                {
                    Id = Guid.NewGuid(),
                    TenantId = targetTenantId,
                    TargetSupportUserId = supportUserId,
                    Scope = "READ_ONLY",
                    ExpiresAtUtc = DateTime.UtcNow.AddHours(2),
                    RevokedAtUtc = null
                }
            });
        var readOnlyHandler = new SavePrintTemplateConfigCommandHandler(readOnlyDb, superAdminNoTenant);
        var exReadOnly = await Assert.ThrowsAsync<ForbiddenException>(() => readOnlyHandler.Handle(cmd, CancellationToken.None));
        Assert.Equal("ERR_SUPPORT_GRANT_REQUIRED", exReadOnly.ErrorCode);

        // 3. Active DIAGNOSTIC grant -> succeeds
        var diagnosticDb = new AiFakeDbContext(
            Array.Empty<Property>(),
            Array.Empty<RoomType>(),
            supportAccessGrants: new[]
            {
                new SupportAccessGrant
                {
                    Id = Guid.NewGuid(),
                    TenantId = targetTenantId,
                    TargetSupportUserId = supportUserId,
                    Scope = "DIAGNOSTIC",
                    ExpiresAtUtc = DateTime.UtcNow.AddHours(2),
                    RevokedAtUtc = null
                }
            });
        var diagnosticHandler = new SavePrintTemplateConfigCommandHandler(diagnosticDb, superAdminNoTenant);
        var saved = await diagnosticHandler.Handle(cmd, CancellationToken.None);
        Assert.Equal(targetTenantId, saved.TenantId);
        Assert.Equal("Vietcombank", saved.BankName);
    }

    [Fact]
    public void AuditPayloadSanitizer_RedactsNestedLookupTokenInSerializedReservationNotes()
    {
        var rawNewValues = "{\"ConfirmationCode\":\"RES-334QY5\",\"Notes\":\"{\\\"RentalType\\\":2,\\\"LookupToken\\\":\\\"secret-lookup-token-999\\\",\\\"RoomTypeName\\\":\\\"Deluxe\\\"}\"}";

        var sanitized = AuditPayloadSanitizer.SanitizeAndSummarize(
            "Update",
            "Reservation",
            null,
            rawNewValues);

        Assert.NotNull(sanitized.SanitizedNewValuesJson);
        Assert.DoesNotContain("secret-lookup-token-999", sanitized.SanitizedNewValuesJson!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[REDACTED]", sanitized.SanitizedNewValuesJson!, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-lookup-token-999", sanitized.ChangeSummary, StringComparison.OrdinalIgnoreCase);
    }
}

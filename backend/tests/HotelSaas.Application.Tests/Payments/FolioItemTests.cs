using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.AddFolioItem;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

[Collection("RealDatabaseTests")]
public sealed class FolioItemTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static ApplicationDbContext CreateDbContext(
        string connStr,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propertyService = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr)
        {
            SearchPath = testSchema
        };
        var propSvc = propertyService ?? new DummyPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propSvc);
    }

    private sealed class DummyTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class DummyPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private sealed class DummyUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "staff@hotelsaastest.local";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = HotelSaas.Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = HotelSaas.Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = HotelSaas.Domain.Enums.StaffRole.Receptionist;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();

        public void EnsurePropertyContext() { }
        public void EnsureTenantContext() { }
        public void SetMembershipContext(Guid tenantId, TenantStatus tenantStatus, Guid? propertyId, PropertyStatus? propertyStatus, StaffRole? staffRole, Guid? roleId, bool isTenantWide) { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole) { }
    }

    private sealed class DummyMembershipLookupService : IMembershipLookupService
    {
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                StaffRole.Receptionist,
                targetPropertyId,
                isTenantWide: true,
                Array.Empty<Guid>()));
        }
    }

    private sealed class DummyMediator : ISender
    {
        private readonly ApplicationDbContext _context;
        private readonly DummyTenantService _tenantService;
        private readonly DummyUserContext _userContext;
        private readonly DummyMembershipLookupService _membershipService;

        public DummyMediator(
            ApplicationDbContext context,
            DummyTenantService tenantService,
            DummyUserContext userContext,
            DummyMembershipLookupService membershipService)
        {
            _context = context;
            _tenantService = tenantService;
            _userContext = userContext;
            _membershipService = membershipService;
        }

        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            if (request is GetFolioQuery q)
            {
                var handler = new GetFolioQueryHandler(_context, _tenantService, _userContext, _membershipService);
                var result = await handler.Handle(q, cancellationToken);
                return (TResponse)(object)result;
            }
            throw new NotImplementedException();
        }

        Task ISender.Send<TRequest>(TRequest request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }
    }

    [Fact]
    public async Task AddFolioItem_ShouldPostMinibarCharge_AndUpdateTotalAndBreakdown()
    {
        var connStr = GetConnectionString();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var tenantService = new DummyTenantService { TenantId = tenantId };
        var userContext = new DummyUserContext { UserId = userId };
        var propertyService = new DummyPropertyService { HeaderPropertyId = propertyId, TokenPropertyId = propertyId };
        var membershipService = new DummyMembershipLookupService();

        var testSchema = $"folio_test_{Guid.NewGuid():N}";
        await using (var initConn = new NpgsqlConnection(connStr))
        {
            await initConn.OpenAsync();
            await using var cmd = initConn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            await using var context = CreateDbContext(connStr, testSchema, tenantService, propertyService);
            await context.Database.MigrateAsync();

            // Seed tenant, property, room, and reservation
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Folio Test Hotel Group",
                Code = $"TF_{Guid.NewGuid():N}"[..10],
                Slug = $"folio-hotel-{Guid.NewGuid():N}"[..18],
                Status = TenantStatus.Active,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Tenants.Add(tenant);

            var property = new Property
            {
                Id = propertyId,
                TenantId = tenantId,
                Name = "Folio Chi Nhanh 1",
                Code = $"P1_{Guid.NewGuid():N}"[..8],
                Slug = $"chi-nhanh-1-{Guid.NewGuid():N}"[..18],
                Address = "123 Le Duan",
                Status = PropertyStatus.Active,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Properties.Add(property);

            var roomType = new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                Name = "Deluxe Room",
                Code = $"DLX_{Guid.NewGuid():N}"[..8],
                BasePrice = 1000000m,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.RoomTypes.Add(roomType);

            var room = new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                RoomTypeId = roomType.Id,
                RoomNumber = "305",
                Status = RoomStatus.Clean,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Rooms.Add(room);

            var initialSnapshot = new ReservationSnapshot
            {
                RentalType = RentalType.Daily,
                StartAtUtc = DateTime.UtcNow,
                EndAtUtc = DateTime.UtcNow.AddDays(2),
                RoomTypeId = roomType.Id,
                RoomTypeName = roomType.Name,
                TotalAmount = 2000000m,
                Breakdown = new List<QuoteBreakdownItemDto>
                {
                    new()
                    {
                        Description = "Tiền phòng 2 đêm",
                        Quantity = 2,
                        UnitPrice = 1000000m,
                        Amount = 2000000m,
                        Category = "Room"
                    }
                }
            };

            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                RoomId = room.Id,
                GuestName = "Tran Minh Anh",
                GuestEmail = "minhanh@test.local",
                GuestPhone = "0987654321",
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                NumberOfGuests = 2,
                TotalAmount = 2000000m,
                Status = ReservationStatus.Confirmed,
                ConfirmationCode = $"RES-{Guid.NewGuid():N}"[..8].ToUpperInvariant(),
                Notes = ReservationSnapshotHelper.Serialize(initialSnapshot),
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Reservations.Add(reservation);
            await context.SaveChangesAsync();

            // Execute AddFolioItemCommand: 2 x Red Bull @ 30,000 = 60,000 VND
            var mediator = new DummyMediator(context, tenantService, userContext, membershipService);
            var handler = new AddFolioItemCommandHandler(context, tenantService, userContext, membershipService, mediator);

            var command = new AddFolioItemCommand(
                ReservationId: reservation.Id,
                PropertyId: propertyId,
                ItemCode: "MINIBAR_REDBULL",
                Description: "Bò Húc Red Bull lon",
                Quantity: 2,
                UnitPrice: 30000m,
                Category: "Service");

            var folio = await handler.Handle(command, CancellationToken.None);

            Assert.NotNull(folio);
            Assert.Equal(2060000m, folio.TotalAmount);
            Assert.Equal(2060000m, folio.RemainingBalance);
            Assert.Equal(60000m, folio.ServicesAmount);
            Assert.Contains(folio.Breakdown, b => b.Description.Contains("Bò Húc") && b.Amount == 60000m);

            // Verify DB update
            var updatedRes = await context.Reservations.IgnoreQueryFilters().FirstAsync(r => r.Id == reservation.Id);
            Assert.Equal(2060000m, updatedRes.TotalAmount);
        }
        finally
        {
            await using var cleanConn = new NpgsqlConnection(connStr);
            await cleanConn.OpenAsync();
            await using var cmd = cleanConn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
    }
}

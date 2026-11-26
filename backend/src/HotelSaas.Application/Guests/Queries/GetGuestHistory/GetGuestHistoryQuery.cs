using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Guests.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guests.Queries.GetGuestHistory;

public sealed record GetGuestHistoryQuery : IRequest<GuestDetailDto>
{
    public string PhoneNumber { get; init; } = string.Empty;
    public string? GuestKey { get; init; }
}

public sealed class GetGuestHistoryQueryHandler : IRequestHandler<GetGuestHistoryQuery, GuestDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public GetGuestHistoryQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<GuestDetailDto> Handle(
        GetGuestHistoryQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Không xác định được tổ chức lưu trú (Tenant).");
        }

        var normalizedPhone = request.PhoneNumber?.Trim() ?? string.Empty;

        var bookings = await GuestIdentity.ForGuest(_context.Reservations
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Where(r => r.TenantId == tenantId.Value), request.GuestKey, normalizedPhone)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ThenBy(r => r.Id)
            .ToListAsync(cancellationToken);

        if (bookings.Count == 0)
        {
            throw new NotFoundException("Không tìm thấy hồ sơ khách hàng trong phạm vi truy cập.");
        }

        var latest = bookings[0];
        var totalSpent = bookings
            .Where(r => r.Status == Domain.Enums.ReservationStatus.CheckedOut || r.Status == Domain.Enums.ReservationStatus.CheckedIn || r.Status == Domain.Enums.ReservationStatus.Confirmed)
            .Sum(r => r.TotalAmount);
        var completedStays = bookings.Count(r => r.Status == Domain.Enums.ReservationStatus.CheckedOut);
        var cancelled = bookings.Count(r => r.Status == Domain.Enums.ReservationStatus.Cancelled);

        var bookingItems = bookings.Select(b => new GuestBookingHistoryItemDto
        {
            ReservationId = b.Id,
            BookingCode = b.ConfirmationCode,
            PropertyId = b.PropertyId,
            PropertyName = b.Property != null ? b.Property.Name : "—",
            RoomNumber = b.Room != null ? b.Room.RoomNumber : "—",
            RoomTypeName = b.Room?.RoomType != null ? b.Room.RoomType.Name : "—",
            CheckInDate = b.CheckInDate,
            CheckOutDate = b.CheckOutDate,
            TotalAmount = b.TotalAmount,
            Status = b.Status.ToString(),
            CreatedAtUtc = b.CreatedAtUtc
        }).ToList();

        var loyaltyTier = completedStays >= 2 ? "Silver" : "Standard";
        var pointsBalance = 0;
        if (latest.GuestUserId.HasValue)
        {
            var membership = await _context.GuestLoyaltyMemberships
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.TenantId == tenantId.Value && m.UserId == latest.GuestUserId.Value, cancellationToken);
            if (membership != null)
            {
                loyaltyTier = membership.Tier.ToString();
                pointsBalance = membership.PointsBalance;
            }
        }

        var latestSnapshot = ReservationSnapshotHelper.TryDeserialize(latest.Notes);
        var cleanNotes = ReservationSnapshotHelper.CleanCustomerNotes(latest.Notes, latestSnapshot);

        var profile = new GuestDirectoryItemDto
        {
            Id = latest.GuestUserId ?? latest.Id,
            GuestKey = GuestIdentity.Key.Compile()(latest),
            VipOverride = latestSnapshot?.IsVip,
            UserId = latest.GuestUserId,
            FullName = latest.GuestName,
            Email = latest.GuestEmail,
            PhoneNumber = latest.GuestPhone ?? normalizedPhone,
            IdCardNumber = null,
            TotalBookings = bookings.Count,
            CompletedStays = completedStays,
            CancelledBookings = cancelled,
            TotalSpent = totalSpent,
            LastStayDate = latest.CreatedAtUtc,
            LoyaltyTier = loyaltyTier,
            PointsBalance = pointsBalance,
            IsVip = latestSnapshot?.IsVip ?? (totalSpent >= 5_000_000 || completedStays >= 3 || loyaltyTier != "Standard"),
            IsBlacklisted = latestSnapshot?.IsBlacklisted ?? false,
            Notes = cleanNotes
        };

        return new GuestDetailDto
        {
            Profile = profile,
            Bookings = bookingItems
        };
    }
}

using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Guests.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guests.Queries.GetGuestHistory;

public sealed record GetGuestHistoryQuery : IRequest<GuestDetailDto>
{
    public string PhoneNumber { get; init; } = string.Empty;
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

        var normalizedPhone = request.PhoneNumber.Trim();

        var bookings = await _context.Reservations
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Where(r => r.TenantId == tenantId.Value && r.GuestPhone == normalizedPhone)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        if (bookings.Count == 0)
        {
            throw new NotFoundException($"Không tìm thấy hồ sơ khách hàng với số điện thoại {normalizedPhone}.");
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

        var profile = new GuestDirectoryItemDto
        {
            Id = latest.GuestUserId ?? latest.Id,
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
            LoyaltyTier = completedStays >= 3 ? "Gold" : (completedStays >= 1 ? "Silver" : "Standard"),
            PointsBalance = 0,
            IsVip = totalSpent >= 5_000_000 || completedStays >= 3,
            IsBlacklisted = false,
            Notes = latest.Notes
        };

        return new GuestDetailDto
        {
            Profile = profile,
            Bookings = bookingItems
        };
    }
}

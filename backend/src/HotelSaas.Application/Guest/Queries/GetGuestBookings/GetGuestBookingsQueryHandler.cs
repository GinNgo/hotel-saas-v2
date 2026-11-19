using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guest.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guest.Queries.GetGuestBookings;

public sealed class GetGuestBookingsQueryHandler : IRequestHandler<GetGuestBookingsQuery, PagedResult<GuestBookingSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetGuestBookingsQueryHandler(IApplicationDbContext context, ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<PagedResult<GuestBookingSummaryDto>> Handle(GetGuestBookingsQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản khách.");
        }

        var baseQuery = _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .Where(r => r.GuestUserId == userId);

        var totalCount = await baseQuery.CountAsync(cancellationToken);

        var skip = (request.Page - 1) * request.PageSize;

        var rows = await baseQuery
            .OrderByDescending(r => r.CreatedAtUtc)
            .ThenByDescending(r => r.Id)
            .Skip(skip)
            .Take(request.PageSize)
            .Select(r => new
            {
                r.Id,
                r.ConfirmationCode,
                r.PropertyId,
                PropertyName = r.Property != null ? r.Property.Name : "Cơ sở lưu trú",
                PropertySlug = r.Property != null ? r.Property.Slug : string.Empty,
                PropertyAddress = r.Property != null ? r.Property.Address : null,
                PropertyCity = r.Property != null ? r.Property.City : null,
                RoomTypeName = r.Room != null && r.Room.RoomType != null ? r.Room.RoomType.Name : "Phòng tiêu chuẩn",
                r.CheckInDate,
                r.CheckOutDate,
                r.Status,
                r.TotalAmount,
                r.CreatedAtUtc,
                r.Notes,
                r.GuestUserId
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r =>
        {
            var (rentalType, lookupToken) = ResolveSnapshotMetadata(
                r.Notes,
                r.GuestUserId,
                userId,
                r.CheckInDate,
                r.CheckOutDate);

            return new GuestBookingSummaryDto(
                r.Id,
                r.ConfirmationCode,
                new GuestPropertySummaryDto(
                    r.PropertyId,
                    r.PropertyName,
                    r.PropertySlug,
                    r.PropertyAddress,
                    r.PropertyCity
                ),
                r.RoomTypeName,
                rentalType,
                r.CheckInDate,
                r.CheckOutDate,
                r.Status.ToString(),
                r.TotalAmount,
                "VND",
                r.CreatedAtUtc,
                lookupToken
            );
        }).ToList();

        return new PagedResult<GuestBookingSummaryDto>(items, totalCount, request.Page, request.PageSize);
    }

    internal static (string RentalType, string? LookupToken) ResolveSnapshotMetadata(
        string? notes,
        Guid? guestUserId,
        Guid currentUserId,
        DateOnly checkInDate,
        DateOnly checkOutDate)
    {
        var snapshot = ReservationSnapshotHelper.TryDeserialize(notes);
        var rentalType = snapshot?.RentalType.ToString()
            ?? (checkInDate == checkOutDate ? "Hourly" : "Daily");

        var lookupToken = guestUserId.HasValue &&
                          guestUserId.Value == currentUserId &&
                          snapshot != null &&
                          !snapshot.IsTokenRevoked &&
                          !string.IsNullOrWhiteSpace(snapshot.LookupToken)
            ? snapshot.LookupToken
            : null;

        return (rentalType, lookupToken);
    }
}

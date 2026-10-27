using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guest.DTOs;
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

        var items = await baseQuery
            .OrderByDescending(r => r.CreatedAtUtc)
            .ThenByDescending(r => r.Id)
            .Skip(skip)
            .Take(request.PageSize)
            .Select(r => new GuestBookingSummaryDto(
                r.Id,
                r.ConfirmationCode,
                new GuestPropertySummaryDto(
                    r.PropertyId,
                    r.Property != null ? r.Property.Name : "Cơ sở lưu trú",
                    r.Property != null ? r.Property.Slug : string.Empty,
                    r.Property != null ? r.Property.Address : null,
                    r.Property != null ? r.Property.City : null
                ),
                r.Room != null && r.Room.RoomType != null ? r.Room.RoomType.Name : "Phòng tiêu chuẩn",
                r.CheckInDate == r.CheckOutDate ? "Hourly" : "Daily",
                r.CheckInDate,
                r.CheckOutDate,
                r.Status.ToString(),
                r.TotalAmount,
                "VND",
                r.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<GuestBookingSummaryDto>(items, totalCount, request.Page, request.PageSize);
    }
}

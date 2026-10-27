using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Guest.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guest.Queries.GetGuestBookingDetail;

public sealed class GetGuestBookingDetailQueryHandler : IRequestHandler<GetGuestBookingDetailQuery, GuestBookingDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetGuestBookingDetailQueryHandler(IApplicationDbContext context, ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<GuestBookingDetailDto> Handle(GetGuestBookingDetailQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản khách.");
        }

        var r = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.Id && r.GuestUserId == userId, cancellationToken);

        if (r == null)
        {
            throw new NotFoundException("Đơn đặt phòng không tồn tại hoặc không thuộc quyền sở hữu của bạn.");
        }

        return new GuestBookingDetailDto(
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
            r.Room != null ? r.Room.RoomNumber : null,
            r.CheckInDate == r.CheckOutDate ? "Hourly" : "Daily",
            r.CheckInDate,
            r.CheckOutDate,
            r.Status.ToString(),
            r.TotalAmount,
            r.NumberOfGuests,
            r.PointsRedeemed,
            r.PointsDiscountAmount,
            r.BuyerCompanyName,
            r.BuyerTaxCode,
            r.BuyerAddress,
            "VND",
            r.CreatedAtUtc
        );
    }
}
